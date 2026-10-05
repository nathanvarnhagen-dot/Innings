// ══ PLAYOFF PICTURE — MLB and NFL (see the trophy button in the Games
// header, gated to both in _refreshPlayoffBtnVisibility). CFB is NOT
// included: its seeding comes from the CFP Selection Committee's
// rankings, not from computable win-loss standings the way MLB's and
// NFL's do, and those rankings don't even exist yet this early in the
// season (the first real CFP ranking doesn't publish until November).
// Building a bracket around a made-up ranking would be actively wrong,
// not just incomplete, so this stays MLB+NFL only for now.
//
// window._ppSport picks which of two genuinely different bracket
// engines apply: MLB's is fixed (2 byes, no reseeding — the whole
// bracket is knowable from seeding alone), NFL's reseeds after the
// Wild Card round (only 1 bye, and the Divisional round pairs whoever
// actually survives, so it can't be shown as a fixed diagram the way
// MLB's can — see _ppNflDivMatchups). window._ppPicks holds shared
// simulator state across both engines; window._ppData caches whichever
// sport's /mode=standings payload was last fetched.
window._ppSport = 'mlb';
window._ppData = null;
window._ppPicks = {};
window._ppTab = 'al';

function _ppLeagueKeys() { return window._ppSport === 'nfl' ? ['afc', 'nfc'] : ['al', 'nl']; }
function _ppLeagueLabel(key) { return key.toUpperCase(); }

function openPlayoffPicture(sport) {
  window._ppSport = (sport === 'nfl') ? 'nfl' : 'mlb';
  window._ppData = null;
  window._ppPicks = {};
  window._ppTab = _ppLeagueKeys()[0];
  nav('playoff-picture');
  ppShowTab(window._ppTab);
  var contentEl = document.getElementById('pp-content');
  if (contentEl) contentEl.innerHTML = '<div style="text-align:center;padding:24px 0;font-size:13px;color:rgba(255,255,255,.4)">Loading standings…</div>';
  var asofEl = document.getElementById('pp-asof');
  if (asofEl) {
    var d = new Date(_todayLocal() + 'T12:00:00');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    asofEl.textContent = 'If the season ended today, ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  var url = window._ppSport === 'nfl' ? '/api/espn?league=nfl&mode=standings' : '/api/mlb?mode=standings';
  var keys = _ppLeagueKeys();
  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || data.error || !data[keys[0]] || !data[keys[1]]) {
        if (contentEl) contentEl.innerHTML = '<div style="text-align:center;padding:24px 0;font-size:13px;color:rgba(255,255,255,.4)">Standings aren\'t available right now.</div>';
        return;
      }
      window._ppData = data;
      _ppRender();
    })
    .catch(function (err) {
      console.error('Load standings error:', err);
      if (contentEl) contentEl.innerHTML = '<div style="text-align:center;padding:24px 0;font-size:13px;color:rgba(255,255,255,.4)">Couldn\'t load standings.</div>';
    });
}

function _ppTabsHtml() {
  var keys = _ppLeagueKeys();
  var tabs = [
    { key: keys[0], label: _ppLeagueLabel(keys[0]) },
    { key: keys[1], label: _ppLeagueLabel(keys[1]) },
    { key: 'ws', label: '🏆 Finals' }
  ];
  return tabs.map(function (t) {
    var on = window._ppTab === t.key;
    return '<button onclick="ppShowTab(\'' + t.key + '\')" style="flex:1;text-align:center;padding:9px 4px;border-radius:12px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit;background:' +
      (on ? 'rgba(168,159,232,.2)' : 'rgba(255,255,255,.05)') + ';color:' + (on ? '#fff' : 'rgba(255,255,255,.45)') + ';border:1px solid ' + (on ? 'rgba(168,159,232,.4)' : 'transparent') + '">' + t.label + '</button>';
  }).join('');
}

function ppShowTab(key) {
  window._ppTab = key;
  var tabsEl = document.getElementById('pp-tabs');
  if (tabsEl) tabsEl.innerHTML = _ppTabsHtml();
  if (window._ppData) _ppRender();
}

function _ppGb(leaderW, leaderL, w, l) {
  var diff = ((leaderW - leaderL) - (w - l)) / 2;
  return diff <= 0 ? '–' : (diff % 1 === 0 ? diff : diff.toFixed(1));
}

function _ppBySeed(league) {
  var m = {};
  ((window._ppData[league] || {}).seeds || []).forEach(function (s) { m[s.seed] = s; });
  return m;
}

// ── MLB matchup resolution — fixed bracket, no reseeding. Each round's
// participants come from fixed seeding or the previous round's pick;
// changing an earlier pick has to invalidate everything built on top
// of it (see _ppMlbClearDownstream) or the bracket could show a team
// who's already been eliminated one round back.
function _ppMlbMatchupTeams(league, id) {
  var s = _ppBySeed(league);
  if (id === 'wc1') return [s[4], s[5]];
  if (id === 'wc2') return [s[3], s[6]];
  if (id === 'ds1') return [s[1], window._ppPicks[league + '-wc1'] || null];
  if (id === 'ds2') return [s[2], window._ppPicks[league + '-wc2'] || null];
  if (id === 'cs') return [window._ppPicks[league + '-ds1'] || null, window._ppPicks[league + '-ds2'] || null];
  return [null, null];
}
function _ppMlbClearDownstream(league, id) {
  if (id === 'wc1') { delete window._ppPicks[league + '-ds1']; delete window._ppPicks[league + '-cs']; delete window._ppPicks.ws; }
  if (id === 'wc2') { delete window._ppPicks[league + '-ds2']; delete window._ppPicks[league + '-cs']; delete window._ppPicks.ws; }
  if (id === 'ds1' || id === 'ds2') { delete window._ppPicks[league + '-cs']; delete window._ppPicks.ws; }
  if (id === 'cs') { delete window._ppPicks.ws; }
}

// ── NFL matchup resolution — only #1 has a bye; the NFL reseeds after
// the Wild Card round, so unlike MLB's ds1/ds2 the Divisional round
// isn't tied to one specific earlier matchup. It depends on all three
// Wild Card results together: once all three are in, the four
// survivors (the #1 seed plus the three winners) are sorted by seed
// and re-paired best-vs-worst, second-best-vs-second-worst — the
// actual NFL rule ("the #1 seed always plays the lowest remaining
// seed"). 'div1' is always the game that includes the #1 seed (since
// sorting a set that always contains seed 1 always puts it first);
// 'div2' is the other one.
function _ppNflWcTeams(conf, id) {
  var s = _ppBySeed(conf);
  if (id === 'wc1') return [s[2], s[7]];
  if (id === 'wc2') return [s[3], s[6]];
  if (id === 'wc3') return [s[4], s[5]];
  return [null, null];
}
function _ppNflDivMatchups(conf) {
  var s = _ppBySeed(conf);
  var w1 = window._ppPicks[conf + '-wc1'], w2 = window._ppPicks[conf + '-wc2'], w3 = window._ppPicks[conf + '-wc3'];
  if (!s[1] || !w1 || !w2 || !w3) return null;
  var survivors = [s[1], w1, w2, w3].slice().sort(function (a, b) { return a.seed - b.seed; });
  return [[survivors[0], survivors[3]], [survivors[1], survivors[2]]];
}
function _ppNflMatchupTeams(conf, id) {
  if (id === 'wc1' || id === 'wc2' || id === 'wc3') return _ppNflWcTeams(conf, id);
  if (id === 'div1' || id === 'div2') {
    var m = _ppNflDivMatchups(conf);
    if (!m) return [null, null];
    return id === 'div1' ? m[0] : m[1];
  }
  if (id === 'cc') return [window._ppPicks[conf + '-div1'] || null, window._ppPicks[conf + '-div2'] || null];
  return [null, null];
}
function _ppNflClearDownstream(conf, id) {
  if (id === 'wc1' || id === 'wc2' || id === 'wc3') { delete window._ppPicks[conf + '-div1']; delete window._ppPicks[conf + '-div2']; delete window._ppPicks[conf + '-cc']; delete window._ppPicks.ws; }
  if (id === 'div1' || id === 'div2') { delete window._ppPicks[conf + '-cc']; delete window._ppPicks.ws; }
  if (id === 'cc') { delete window._ppPicks.ws; }
}

function _ppMatchupTeams(league, id) { return window._ppSport === 'nfl' ? _ppNflMatchupTeams(league, id) : _ppMlbMatchupTeams(league, id); }
function _ppClearDownstream(league, id) { return window._ppSport === 'nfl' ? _ppNflClearDownstream(league, id) : _ppMlbClearDownstream(league, id); }
function _ppWsTeams() {
  var keys = _ppLeagueKeys();
  var champId = window._ppSport === 'nfl' ? '-cc' : '-cs';
  return [window._ppPicks[keys[0] + champId] || null, window._ppPicks[keys[1] + champId] || null];
}

function ppPickWinner(league, id, teamName) {
  var team = _ppMatchupTeams(league, id).filter(function (t) { return t && t.team === teamName; })[0];
  if (!team) return;
  _ppClearDownstream(league, id);
  window._ppPicks[league + '-' + id] = team;
  _ppRender();
}
function ppPickWs(teamName) {
  var team = _ppWsTeams().filter(function (t) { return t && t.team === teamName; })[0];
  if (!team) return;
  window._ppPicks.ws = team;
  _ppRender();
}
function ppResetPicks() { window._ppPicks = {}; _ppRender(); }

function _ppMiniBracketSvg(bye, wcA, wcB) {
  var lineColor = 'rgba(255,255,255,.28)';
  function box(x, y, w, h, cls, inner) {
    return '<foreignObject x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"><div xmlns="http://www.w3.org/1999/xhtml" class="pp-bx ' + cls + '">' + inner + '</div></foreignObject>';
  }
  // Seeds 1-3 are division winners, so the division is the more useful
  // thing to show next to the name; wild cards keep their record.
  var teamInner = function (t, extra) { return '<div class="pp-bx-seed">' + t.seed + '</div><div class="pp-bx-name">' + _escapeHtml(t.team) + '</div><div class="pp-bx-rec">' + _escapeHtml(t.division || t.rec) + '</div>' + (extra || ''); };
  var svg = '<svg viewBox="0 0 380 140" width="100%" height="140" style="display:block">';
  svg += '<path d="M200,20 H240 V58" fill="none" stroke="' + lineColor + '" stroke-width="1.5"/>';
  svg += '<path d="M200,70 H225 V95" fill="none" stroke="' + lineColor + '" stroke-width="1.5"/>';
  svg += '<path d="M200,120 H225 V95" fill="none" stroke="' + lineColor + '" stroke-width="1.5"/>';
  svg += '<path d="M225,95 H240 V58" fill="none" stroke="' + lineColor + '" stroke-width="1.5"/>';
  svg += '<path d="M240,58 H270" fill="none" stroke="' + lineColor + '" stroke-width="1.5"/>';
  svg += box(0, 2, 200, 36, 'bye', teamInner(bye, '<span class="pp-bx-tag">Bye</span>'));
  svg += box(0, 52, 200, 36, '', teamInner(wcA));
  svg += box(0, 102, 200, 36, '', teamInner(wcB));
  svg += box(270, 34, 110, 48, 'slot', '<div class="pp-bx-name">Winner faces #' + bye.seed + ' ' + _escapeHtml(bye.team) + '</div><div class="pp-bx-rec">Division Series</div>');
  svg += '</svg>';
  return svg;
}

// NFL's bracket isn't a fixed diagram the way MLB's is — only the Wild
// Card round is knowable in advance, since the Divisional round
// reseeds around whoever actually survives. So this shows the Wild
// Card matchups as plain rows plus a text explainer, rather than
// trying to draw a "winner faces X" slot that isn't actually true.
function _ppNflBracketHtml(conf) {
  var s = _ppBySeed(conf);
  if (!s[1] || !s[2] || !s[3] || !s[4] || !s[5] || !s[6] || !s[7]) return '';
  var html = '<div class="pp-section-title">Bracket</div>';
  html += '<div class="pp-bracket-sub">Only #1 gets a bye. #2 vs #7, #3 vs #6, #4 vs #5 in the Wild Card round — the NFL reseeds after, so the Divisional round isn\'t fixed: whoever survives, #1 always plays the lowest remaining seed. See Play It Out below.</div>';
  html += '<div class="pp-pair" style="margin-bottom:8px"><div class="pp-pick" style="cursor:default"><div class="pp-pick-name">#' + s[1].seed + ' ' + _escapeHtml(s[1].team) + '</div><div class="pp-pick-rec">' + _escapeHtml(s[1].rec) + '</div></div></div>';
  [['wc1', s[2], s[7]], ['wc2', s[3], s[6]], ['wc3', s[4], s[5]]].forEach(function (pair) {
    html += '<div class="pp-pair" style="margin-bottom:8px">' +
      '<div class="pp-pick" style="cursor:default"><div class="pp-pick-name">#' + pair[1].seed + ' ' + _escapeHtml(pair[1].team) + '</div><div class="pp-pick-rec">' + _escapeHtml(pair[1].rec) + '</div></div>' +
      '<div class="pp-pick" style="cursor:default"><div class="pp-pick-name">#' + pair[2].seed + ' ' + _escapeHtml(pair[2].team) + '</div><div class="pp-pick-rec">' + _escapeHtml(pair[2].rec) + '</div></div>' +
      '</div>';
  });
  return html;
}

function _ppBracketHtml(league) {
  if (window._ppSport === 'nfl') return _ppNflBracketHtml(league);
  var s = _ppBySeed(league);
  if (!s[1] || !s[2] || !s[3] || !s[4] || !s[5] || !s[6]) return '';
  var html = '<div class="pp-section-title">Bracket</div>';
  html += '<div class="pp-bracket-sub">Top 2 seeds bye to the Division Series. #3 hosts #6, #4 hosts #5 (best-of-3). No reseeding after.</div>';
  html += _ppMiniBracketSvg(s[1], s[4], s[5]);
  html += '<div style="height:14px"></div>';
  html += _ppMiniBracketSvg(s[2], s[3], s[6]);
  return html;
}

function _ppWildCardStandingsHtml(league) {
  var race = (window._ppData[league] || {}).wildcardRace || [];
  var cutIn = race.filter(function (t) { return t.status === 'in'; });
  var cutOut = race.filter(function (t) { return t.status === 'out'; });
  if (!cutIn.length) return '';
  var lastIn = cutIn[cutIn.length - 1];
  var html = '<div class="pp-section-title" style="margin-top:22px">Wild Card Standings</div>';
  cutIn.forEach(function (t, i) {
    var g = cutOut.length ? _ppGb(t.w, t.l, cutOut[0].w, cutOut[0].l) : '–';
    html += '<div class="pp-wc-row in"><div class="rk">' + (i + 1) + '</div><div class="nm">' + _escapeHtml(t.team) + '</div><div class="wl">' + t.w + '-' + t.l + '</div><div class="gbv">' + (cutOut.length ? '+' + g : '+–') + '</div></div>';
  });
  if (cutOut.length) {
    html += '<div class="pp-wc-cutline"><span>Cut line</span></div>';
    cutOut.forEach(function (t, i) {
      html += '<div class="pp-wc-row out"><div class="rk">' + (cutIn.length + i + 1) + '</div><div class="nm">' + _escapeHtml(t.team) + '</div><div class="wl">' + t.w + '-' + t.l + '</div><div class="gbv">' + _ppGb(lastIn.w, lastIn.l, t.w, t.l) + '</div></div>';
    });
  }
  return html;
}

// The rounds each sport actually plays, in order. MLB's bracket is
// fixed; the NFL reseeds, which _ppNflMatchupTeams already handles.
function _ppFinalsRounds() {
  return window._ppSport === 'nfl'
    ? [['wc1', 'Wild card'], ['wc2', 'Wild card'], ['wc3', 'Wild card'], ['div1', 'Divisional'], ['div2', 'Divisional'], ['cc', 'Conference']]
    : [['wc1', 'Wild card'], ['wc2', 'Wild card'], ['ds1', 'Division'], ['ds2', 'Division'], ['cs', 'Pennant']];
}

// A pick row narrow enough that two leagues fit side by side on a phone.
function _ppMiniRowHtml(league, id, t, picked, onclick) {
  var isPicked = picked && picked.team === t.team;
  var isElim = picked && !isPicked;
  return '<div class="pp-mini' + (isPicked ? ' picked' : '') + (isElim ? ' elim' : '') + '"' +
    ' data-league="' + _escapeHtml(league) + '" data-id="' + _escapeHtml(id) + '" data-team="' + _escapeHtml(t.team) + '"' +
    ' onclick="' + onclick + '">' +
    '<span class="sd">' + t.seed + '</span>' +
    '<span class="nm">' + _escapeHtml(t.team) + '</span>' +
    '<span class="mt">' + _escapeHtml(t.division || t.rec || '') + '</span></div>';
}

function _ppFinalsColumnHtml(league) {
  var html = '<div class="pp-col"><div class="pp-col-lg">' + _escapeHtml(_ppLeagueLabel(league)) + '</div>';
  _ppFinalsRounds().forEach(function (r) {
    var id = r[0];
    var teams = _ppMatchupTeams(league, id);
    html += '<div class="pp-rd">' + _escapeHtml(r[1]) + '</div>';
    if (!teams[0] || !teams[1]) {
      html += '<div class="pp-pending" style="margin-bottom:9px;padding:11px 8px">Decide the round above</div>';
      return;
    }
    var picked = window._ppPicks[league + '-' + id];
    html += '<div class="pp-pair" style="margin-bottom:9px">' + teams.map(function (t) {
      return _ppMiniRowHtml(league, id, t, picked, 'ppPickWinner(this.dataset.league,this.dataset.id,this.dataset.team)');
    }).join('') + '</div>';
  });
  return html + '</div>';
}

// Both leagues on one screen, each running down its own column, meeting
// at the final. Picking a winner anywhere clears whatever downstream of
// it that pick invalidated — _ppClearDownstream already owns that rule.
function _ppFinalsHtml() {
  var keys = _ppLeagueKeys();
  var champId = window._ppSport === 'nfl' ? '-cc' : '-cs';
  var finalName = window._ppSport === 'nfl' ? 'Super Bowl' : 'World Series';
  var html = '<div class="pp-section-title">Play It Out <span class="pp-reset" onclick="ppResetPicks()">Reset</span></div>';
  html += '<div class="pp-bracket-sub">Tap a winner in each round. ' +
    (window._ppSport === 'nfl' ? 'Only the top seed sits out the Wild Card round.' : 'The top two seeds are already through to the Division Series.') + '</div>';
  html += '<div class="pp-cols">' + _ppFinalsColumnHtml(keys[0]) + _ppFinalsColumnHtml(keys[1]) + '</div>';
  html += '<div class="pp-conv"><svg viewBox="0 0 344 26" width="100%" height="26" style="display:block" aria-hidden="true">' +
    '<path d="M86,0 V13 H172 V26" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5"/>' +
    '<path d="M258,0 V13 H172 V26" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5"/></svg></div>';

  var a = window._ppPicks[keys[0] + champId], b = window._ppPicks[keys[1] + champId];
  var won = window._ppPicks.ws;
  if (won && a && b) {
    var lost = (won.team === a.team) ? b : a;
    html += '<div class="pp-champ" style="margin-top:10px"><div class="lbl">' + _escapeHtml(finalName) + ' champion</div>' +
      '<div class="nm">' + _escapeHtml(won.team) + '</div>' +
      '<div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:3px">over the ' + _escapeHtml(lost.team) + '</div></div>';
    return html;
  }
  if (!a || !b) {
    html += '<div class="pp-pending" style="margin-top:10px">Win ' + (window._ppSport === 'nfl' ? 'a conference' : 'a pennant') + ' on each side to set the ' + _escapeHtml(finalName) + '</div>';
    return html;
  }
  html += '<div class="pp-ws-pair"><div class="pp-ws-hdr">' + _escapeHtml(finalName) + '</div>' +
    _ppMiniRowHtml(keys[0], 'ws', a, null, 'ppPickWs(this.dataset.team)') +
    _ppMiniRowHtml(keys[1], 'ws', b, null, 'ppPickWs(this.dataset.team)') + '</div>';
  return html;
}

function _ppStandingsHtml(league) {
  var divisions = (window._ppData[league] || {}).divisions || [];
  var html = '<div class="pp-section-title" style="margin-top:22px">Standings</div>';
  divisions.forEach(function (div) {
    var leader = div.teams[0];
    html += '<div class="pp-div-table"><div class="pp-div-name">' + _escapeHtml(div.name) + '</div>';
    html += '<div class="pp-col-hdr"><span class="sp"></span><span class="w1">W-L</span><span class="w2">GB</span></div>';
    div.teams.forEach(function (t, i) {
      var tagHtml = t.tag ? '<span class="pp-tag ' + t.tag + '">' + (t.tag === 'div' ? 'Div' : 'WC') + '</span>' : '';
      html += '<div class="pp-row' + (i === 0 ? ' leader' : '') + '"><div class="pp-rank">' + (i + 1) + '</div><div class="pp-name">' + _escapeHtml(t.name) + tagHtml + '</div><div class="pp-wl">' + t.w + '-' + t.l + '</div><div class="pp-gb">' + _ppGb(leader.w, leader.l, t.w, t.l) + '</div></div>';
    });
    html += '</div>';
  });
  return html;
}

function _ppRender() {
  var el = document.getElementById('pp-content');
  if (!el || !window._ppData) return;
  if (window._ppTab === 'ws') { el.innerHTML = _ppFinalsHtml(); return; }
  var league = window._ppTab;
  el.innerHTML = _ppBracketHtml(league) + _ppWildCardStandingsHtml(league) + _ppStandingsHtml(league);
}

// ══ TEAM PREFERENCES — favorite team (one) + any number of followed
// teams, per sport. Stored at users/{uid}/teamPrefs/{sport} as
// {favorite, following, updatedAt}, written in full on every toggle
// (simplest — these are small documents, no need for incremental
// updates). window._tpTeams caches the fetched team list per visit;
// window._tpPrefs holds the current {favorite, following} state.
function _tpTeamsUrl(sport) {
  if (sport === 'mlb') return '/api/mlb?mode=teams';
  return '/api/espn?league=' + encodeURIComponent(sport) + '&mode=teams';
}

window._tpSport = null;
window._tpTeams = [];
window._tpPrefs = { favorite: null, following: [], rivals: [] };

function openTeamPrefs(sport) {
  window._tpSport = sport;
  var sportMeta = GAMES_SPORTS.filter(function (s) { return s.key === sport; })[0];
  var titleEl = document.getElementById('tp-title');
  if (titleEl) titleEl.textContent = (sportMeta ? sportMeta.name : sport.toUpperCase()) + ' Teams';
  var searchEl = document.getElementById('tp-search');
  if (searchEl) searchEl.value = '';
  var listEl = document.getElementById('tp-list');
  if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:24px 0;font-size:13px;color:rgba(255,255,255,.4)">Loading teams…</div>';
  nav('team-prefs');

  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var prefsPromise = (user && window.db)
    ? window.db.collection('users').doc(user.uid).collection('teamPrefs').doc(sport).get()
      .then(function (doc) { return doc.exists ? doc.data() : { favorite: null, following: [] }; })
      .catch(function (err) { console.error('Load team prefs error:', err); return { favorite: null, following: [] }; })
    : Promise.resolve({ favorite: null, following: [] });

  Promise.all([
    fetch(_tpTeamsUrl(sport)).then(function (r) { return r.json(); }).catch(function () { return { teams: [] }; }),
    prefsPromise
  ]).then(function (results) {
    if (window._tpSport !== sport) return; // superseded by a later visit
    window._tpTeams = (results[0] && results[0].teams) || [];
    window._tpPrefs = { favorite: results[1].favorite || null, following: results[1].following || [], rivals: results[1].rivals || [] };
    if (!window._tpTeams.length) {
      if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:24px 0;font-size:13px;color:rgba(255,255,255,.4)">Couldn\'t load the team list right now.</div>';
      return;
    }
    _tpRenderList();
  });
}

function _tpFilterList() { _tpRenderList(); }

function _tpRenderList() {
  var listEl = document.getElementById('tp-list');
  if (!listEl) return;
  var query = ((document.getElementById('tp-search') || {}).value || '').trim().toLowerCase();
  var teams = query ? window._tpTeams.filter(function (t) { return t.name.toLowerCase().indexOf(query) !== -1; }) : window._tpTeams;
  if (!teams.length) { listEl.innerHTML = '<div style="text-align:center;padding:24px 0;font-size:13px;color:rgba(255,255,255,.4)">No teams match “' + _escapeHtml(query) + '”.</div>'; return; }
  listEl.innerHTML = teams.map(function (t) {
    var isFav = window._tpPrefs.favorite === t.name;
    var isFollowing = window._tpPrefs.following.indexOf(t.name) !== -1;
    var isRival = (window._tpPrefs.rivals || []).indexOf(t.name) !== -1;
    return '<div style="display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:0.5px solid rgba(255,255,255,.06)">' +
      '<div data-team="' + _escapeHtml(t.name) + '" onclick="tpToggleFavorite(this.dataset.team)" style="cursor:pointer;font-size:19px;width:24px;text-align:center;flex-shrink:0;color:' + (isFav ? '#F2C869' : 'rgba(255,255,255,.25)') + '">' + (isFav ? '★' : '☆') + '</div>' +
      '<div style="flex:1;font-size:14px;font-weight:600;color:#fff">' + _escapeHtml(t.name) + '</div>' +
      '<div data-team="' + _escapeHtml(t.name) + '" onclick="tpToggleRival(this.dataset.team)" role="button" aria-pressed="' + isRival + '" aria-label="Mark ' + _escapeHtml(t.name) + ' as a rival" style="cursor:pointer;height:24px;padding:0 8px;border-radius:7px;border:1.5px solid ' + (isRival ? 'rgba(255,154,142,.6)' : 'rgba(255,255,255,.2)') + ';background:' + (isRival ? 'rgba(255,154,142,.18)' : 'transparent') + ';display:flex;align-items:center;flex-shrink:0;color:' + (isRival ? '#FF9A8E' : 'rgba(255,255,255,.45)') + ';font-size:10.5px;font-weight:800;letter-spacing:.06em">RIVAL</div>' +
      '<div data-team="' + _escapeHtml(t.name) + '" onclick="tpToggleFollow(this.dataset.team)" style="cursor:pointer;width:22px;height:22px;border-radius:7px;border:1.5px solid ' + (isFollowing ? 'rgba(124,242,156,.5)' : 'rgba(255,255,255,.2)') + ';background:' + (isFollowing ? 'rgba(124,242,156,.18)' : 'transparent') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#9be8ac;font-size:13px;font-weight:800">' + (isFollowing ? '✓' : '') + '</div>' +
    '</div>';
  }).join('');
}

function _tpSavePrefs() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db || !window._tpSport) return;
  window.db.collection('users').doc(user.uid).collection('teamPrefs').doc(window._tpSport)
    .set({ favorite: window._tpPrefs.favorite, following: window._tpPrefs.following, rivals: window._tpPrefs.rivals || [], updatedAt: Date.now() })
    .then(function () {
      if (typeof _invalidateFavTeamsCache === 'function') _invalidateFavTeamsCache(window._tpSport);
      if (window._yw && window._yw.prefs) delete window._yw.prefs[window._tpSport]; // the fan angle reads these
    })
    .catch(function (err) {
      console.error('Save team prefs error:', err);
      if (typeof ib_toast === 'function') ib_toast('Could not save — ' + (err && err.message ? err.message : 'check Firestore rules'));
    });
}

function tpToggleFavorite(teamName) {
  window._tpPrefs.favorite = (window._tpPrefs.favorite === teamName) ? null : teamName;
  if (window._tpPrefs.favorite && window._tpPrefs.rivals) { // a team can't be both your favorite and your rival
    var ri = window._tpPrefs.rivals.indexOf(teamName);
    if (ri !== -1) window._tpPrefs.rivals.splice(ri, 1);
  }
  _tpRenderList();
  _tpSavePrefs();
}

function tpToggleRival(teamName) {
  if (window._tpPrefs.favorite === teamName) { if (typeof ib_toast === 'function') ib_toast('That\u2019s your favorite team'); return; }
  if (!window._tpPrefs.rivals) window._tpPrefs.rivals = [];
  var idx = window._tpPrefs.rivals.indexOf(teamName);
  if (idx === -1) window._tpPrefs.rivals.push(teamName);
  else window._tpPrefs.rivals.splice(idx, 1);
  _tpRenderList();
  _tpSavePrefs();
}

function tpToggleFollow(teamName) {
  var idx = window._tpPrefs.following.indexOf(teamName);
  if (idx === -1) window._tpPrefs.following.push(teamName);
  else window._tpPrefs.following.splice(idx, 1);
  _tpRenderList();
  _tpSavePrefs();
}

function openGameScreen(gamePk, away, home, sport, date) {
  // Opening a different game from the game screen itself (a Last 5 circle)
  // keeps the one being left on the back stack.
  var cur = document.querySelector('.screen.active');
  if (cur && cur.id === 'screen-game' && window._activeBrowseGame && String(window._activeBrowseGame.gamePk) !== String(gamePk)) {
    window._navStack.push('game');
    window._gameBackStack.push(Object.assign({}, window._activeBrowseGame));
  }
  _showGameScreen({ gamePk: gamePk, away: away, home: home, sport: sport, date: date }, true);
}
function _showGameScreen(g, doNav) {
  var gamePk = g.gamePk, away = g.away, home = g.home;
  window._activeBrowseGame = { gamePk: gamePk, away: away || null, home: home || null, sport: g.sport || 'mlb', date: g.date || null };
  var titleEl = document.getElementById('game-detail-title');
  if (titleEl) {
    var tFull = (away && home) ? (away + ' @ ' + home) : 'Game';
    var tShort = (away && home) ? (_teamShortName(away) + ' @ ' + _teamShortName(home)) : 'Game';
    titleEl.innerHTML = '<span class="gd-t-full">' + _escapeHtml(tFull) + '</span><span class="gd-t-short" id="game-detail-title-short">' + _escapeHtml(tShort) + '</span>';
  }
  var rowEl = document.getElementById('game-watching-with-row');
  if (rowEl) rowEl.style.display = 'none'; // hide until (if) this game's watchers resolve, rather than show stale data from the last game
  window._gameWatchers = { gamePk: gamePk, people: [] };
  _renderChatTabCount(0);
  var stripEl = document.getElementById('game-chat-watchers');
  if (stripEl) stripEl.style.display = 'none';
  if (typeof skipGameRecap === 'function') skipGameRecap(); // don't let a still-playing recap from the last game bleed into this one
  if (doNav) nav('game');
  _ptrAttach(document.getElementById('game-sheet-panel'), gameRefreshNow);
  gameDetailTab('sheet');
  loadGameCheatSheet(gamePk);
  _refreshGameWatchButton(gamePk);
  _loadWatchingWithRow(gamePk);
}

function gameDetailTab(key) {
  var sheetBtn = document.getElementById('game-tab-sheet');
  var chatBtn = document.getElementById('game-tab-chat');
  var rulesBtn = document.getElementById('game-tab-rules');
  var sheetPanel = document.getElementById('game-sheet-panel');
  var chatPanel = document.getElementById('game-chat-panel');
  var rulesPanel = document.getElementById('game-rules-panel');
  var inputZone = document.getElementById('game-chat-input-zone');
  if (!sheetBtn || !chatBtn) return;
  var onStyle = 'background:rgba(255,255,255,.14);color:#fff;border:none;border-radius:20px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit';
  var offStyle = 'background:transparent;color:rgba(255,255,255,.5);border:none;border-radius:20px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit';
  // Desktop (v5.69.0): chat is always open in its own column, so asking
  // for it just keeps the left side as it was and puts the cursor there.
  var desk = typeof _isDesk === 'function' && _isDesk();
  if (desk && key === 'chat') {
    key = window._gdLeftTab || 'sheet';
    setTimeout(function () { var f = document.getElementById('game-chat-field'); if (f) f.focus(); }, 0);
  }
  if (key !== 'chat' && key !== 'rules') key = 'sheet';
  if (key !== 'chat') window._gdLeftTab = key;
  sheetBtn.style.cssText = key === 'sheet' ? onStyle : offStyle;
  chatBtn.style.cssText = key === 'chat' ? onStyle : offStyle;
  if (rulesBtn) rulesBtn.style.cssText = key === 'rules' ? onStyle : offStyle;
  if (sheetPanel) sheetPanel.style.display = key === 'sheet' ? 'block' : 'none';
  if (chatPanel) chatPanel.style.display = key === 'chat' ? 'flex' : 'none';
  if (rulesPanel) rulesPanel.style.display = key === 'rules' ? 'block' : 'none';
  if (typeof _gshSetup === 'function') setTimeout(_gshSetup, 0); // v6.5.0
  if (inputZone) inputZone.style.display = key === 'chat' ? 'flex' : 'none';
  if (key === 'chat') {
    var gamePk = window._activeBrowseGame && window._activeBrowseGame.gamePk;
    if (gamePk) {
      startGameChat(gamePk);
      _loadWatchingWithRow(gamePk); // friends come and go; re-check on open
    }
  } else if (key === 'rules' && typeof renderGameRules === 'function') {
    renderGameRules();
  }
  if (desk && key !== 'chat') {
    var pk = window._activeBrowseGame && window._activeBrowseGame.gamePk;
    if (pk) { startGameChat(pk); _loadWatchingWithRow(pk); }
  }
}

// ── LAST 5 (ESPN leagues) — tap a circle for the score, then open that
// game (v5.65.0). Same interaction as MLB's Last 10. The gamecast payload
// carries each game's ESPN event id; if it's missing (older cached
// response) the game is found on that day's scoreboard by team names.
function _gxFormDay(iso) { return _tmLocalDay(iso); }
function _gxFormDetailInner(m, key, i) {
  var g = m.form && m.form[key] && m.form[key][i];
  if (!g) return '';
  var tone = g.res === 'W' ? 'background:rgba(124,242,156,.16);color:#9be8ac' : (g.res === 'L' ? 'background:rgba(255,122,107,.16);color:#FFC2BA' : 'background:rgba(255,255,255,.08);color:#D9D4FA');
  var home = String(g.atVs || '').indexOf('@') === -1;
  var day = _gxFormDay(g.date);
  var line = '<div class="gh-l10-line">' +
    '<span class="gh-tag" style="font-size:11px;' + tone + '">' + _escapeHtml(g.res + (g.score ? ' ' + g.score : '')) + '</span>' +
    '<span style="font-weight:700">' + (home ? 'vs ' : 'at ') + _escapeHtml(_teamShortName(g.oppName || '') || g.opp || '') + '</span>' +
    '<span style="color:#9C95D0;margin-left:auto">' + _escapeHtml(day ? _ghL10DateLabel(day) : '') + '</span></div>';
  if (m.league === 'nhl' || (!g.id && !day)) return line;
  return line + '<button class="gh-l10-open" onclick="gxFormOpen(\'' + key + '\',' + i + ',this)">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 5 16 12 9 19"/></svg>Open this game</button>';
}
function gxFormPick(btn) {
  var st = window._ghState;
  var m = window._gdPregame && window._gdPregame.gx;
  if (!st || !m || !m.form) return;
  var key = btn.getAttribute('data-side'), i = Number(btn.getAttribute('data-i'));
  if (!m.form[key] || !m.form[key][i]) return;
  var same = st.formSel && st.formSel.side === key && st.formSel.i === i;
  st.formSel = same ? null : { side: key, i: i };
  // Update in place — no re-render, so nothing re-animates
  document.querySelectorAll('#game-sheet-panel .gh-l10-dot.sel').forEach(function (b) { b.classList.remove('sel'); b.setAttribute('aria-pressed', 'false'); });
  ['away', 'home'].forEach(function (k) {
    var d = document.getElementById('gx-form-detail-' + k);
    if (!d) return;
    var show = st.formSel && st.formSel.side === k;
    d.className = 'gh-l10-detail' + (show ? ' on' : '');
    d.innerHTML = show ? _gxFormDetailInner(m, k, st.formSel.i) : '';
  });
  if (!same) { btn.classList.add('sel'); btn.setAttribute('aria-pressed', 'true'); }
}
function gxFormOpen(key, i, btn) {
  var m = window._gdPregame && window._gdPregame.gx;
  var g = m && m.form && m.form[key] && m.form[key][i];
  if (!g) return;
  var side = m[key] || {};
  var teamName = side.name || side.short || '';
  var oppName = g.oppName || g.opp || '';
  var isHome = String(g.atVs || '').indexOf('@') === -1;
  var away = isHome ? oppName : teamName, home = isHome ? teamName : oppName;
  var day = _gxFormDay(g.date);
  var league = m.league;
  var go = function (id) { openGameScreen(String(id), away, home, league, day); };
  if (g.id) { go(g.id); return; }
  if (!day) { _ghL10OpenFailed(btn); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Finding that game…'; }
  // A night game can sit on the next UTC day, so the UTC day is a second try.
  var days = [day];
  var utc = String(g.date || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(utc) && utc !== day) days.push(utc);
  var tryDay = function (k) {
    if (k >= days.length) { _ghL10OpenFailed(btn); return; }
    fetch('/api/espn?league=' + encodeURIComponent(league) + '&mode=schedule&date=' + encodeURIComponent(_toEspnDate(days[k])))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var hit = ((d && d.games) || []).filter(function (x) { return _ghSameTeamName(x.away, away) && _ghSameTeamName(x.home, home); })[0];
        if (hit && hit.gamePk != null) go(hit.gamePk); else tryDay(k + 1);
      })
      .catch(function (err) { console.error('Open past game error:', err); tryDay(k + 1); });
  };
  tryDay(0);
}
