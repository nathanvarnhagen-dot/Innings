// ═══ TEAM PAGE (v5.65.0) ══════════════════════════════════════════════
// Tap a team on a game's cheat sheet → record, roster, and the whole
// season (football: a week-by-week board; baseball: a month calendar).
// Data: /api/espn?mode=team (NFL, CFB) and /api/mlb?mode=team. Other
// leagues get the page by adding them here once their layout is checked.
var _TM_LEAGUES = { nfl: true, cfb: true, mlb: true };
var _TM_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
window._tmCache = window._tmCache || {};
window._tm = window._tm || null;

// 'YYYY-MM-DD' in the viewer's own time zone
function _tmLocalDay(iso) {
  if (!iso) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  var d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  var p = function (n) { return n < 10 ? '0' + n : String(n); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
// Attributes that make any element open a team page. data-* rather than
// an inline string so names with apostrophes can't break the handler.
function _tmTapAttrs(league, id, name) {
  if (!_TM_LEAGUES[league] || (id == null && !name) || (id === '' && !name)) return '';
  return ' role="button" tabindex="0" data-tm-league="' + _escapeHtml(league) + '" data-tm-id="' + _escapeHtml(id != null ? String(id) : '') + '" data-tm-name="' + _escapeHtml(name || '') + '"' +
    ' onclick="event.stopPropagation();openTeamPageFromEl(this)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click();}"' +
    ' aria-label="Open ' + _escapeHtml(name || 'team') + ' team page"';
}
function openTeamPageFromEl(el) {
  openTeamPage(el.getAttribute('data-tm-league'), el.getAttribute('data-tm-id') || null, el.getAttribute('data-tm-name') || null);
}
function openTeamPage(league, id, name) {
  if (!_TM_LEAGUES[league]) return;
  window._tm = { league: league, id: id || null, name: name || null, data: null, err: null, tab: 'roster', month: null, grp: 'All', token: Date.now() };
  var t = document.getElementById('tm-title');
  if (t) t.textContent = name || 'Team';
  _tmTabStyles();
  nav('team');
  var body = document.getElementById('tm-body');
  if (body) body.scrollTop = 0;
  _ptrAttach(body, tmRefresh);
  _tmLoad();
}
function tmRefresh() {
  var s = window._tm;
  if (!s) return Promise.resolve();
  s.err = null;
  s.fresh = true;
  s.token = Date.now();
  return _tmLoad();
}
function tmRetry() { if (window._tm) { window._tm.err = null; window._tm.token = Date.now(); _tmLoad(); } }
function _tmLoad() {
  var s = window._tm;
  if (!s) return;
  var token = s.token;
  _tmRender();
  var stale = function () { return !window._tm || window._tm.token !== token; };
  var fresh = !!s.fresh;
  s.fresh = false;
  return _tmResolveId(s.league, s.id, s.name).then(function (id) {
    if (stale()) return null;
    if (id == null) throw new Error('Couldn\'t match this team to a schedule.');
    s.id = id;
    var key = s.league + ':' + id;
    var hit = window._tmCache[key];
    if (!fresh && hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.data;
    var url = s.league === 'mlb'
      ? '/api/mlb?mode=team&teamId=' + encodeURIComponent(id)
      : '/api/espn?league=' + encodeURIComponent(s.league) + '&mode=team&teamId=' + encodeURIComponent(id);
    if (fresh) url += '&_fresh=' + Date.now(); // skips Vercel's edge cache
    return fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || d.error || !d.team) throw new Error((d && d.error) || 'No team data came back.');
      d.league = s.league;
      d.groups = d.groups || [];
      d.games = d.games || [];
      window._tmCache[key] = { at: Date.now(), data: d };
      return d;
    });
  }).then(function (d) {
    if (stale() || !d) return;
    s.data = d;
    var t = document.getElementById('tm-title');
    if (t) t.textContent = d.team.name || s.name || 'Team';
    _tmRender();
  }).catch(function (err) {
    console.error('[team page] load failed:', err);
    if (stale()) return;
    s.err = (err && err.message) || 'Something went wrong.';
    _tmRender();
  });
}
// ESPN hands us its team id; MLB's live/final box score only carries names,
// so those are matched against the team list.
function _tmResolveId(league, id, name) {
  if (id != null && id !== '') return Promise.resolve(id);
  if (league !== 'mlb' || !name) return Promise.resolve(null);
  return fetch('/api/mlb?mode=teams').then(function (r) { return r.json(); }).then(function (d) {
    var teams = (d && d.teams) || [];
    var exact = teams.filter(function (t) { return String(t.name).toLowerCase() === String(name).toLowerCase(); })[0];
    var loose = exact || teams.filter(function (t) { return _ghSameTeamName(t.name, name); })[0];
    return loose ? loose.id : null;
  });
}
function tmTab(key) {
  if (!window._tm) return;
  window._tm.tab = key;
  _tmTabStyles();
  _tmRender();
}
function _tmTabStyles() {
  var tab = (window._tm && window._tm.tab) || 'roster';
  ['roster', 'schedule'].forEach(function (k) {
    var b = document.getElementById('tm-tab-' + k);
    if (!b) return;
    b.classList.toggle('on', k === tab);
    b.setAttribute('aria-selected', k === tab ? 'true' : 'false');
  });
}
function tmShowCalendar() {
  tmTab('schedule');
  var el = document.getElementById('tm-sched');
  var body = document.getElementById('tm-body');
  if (!el || !body) return;
  var top = body.scrollTop + el.getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
  body.scrollTo({ top: Math.max(0, top), behavior: _ghReducedMotion() ? 'auto' : 'smooth' });
}
function tmFilter(label) { if (window._tm) { window._tm.grp = label; _tmRender(); } }
function tmMonth(ym) { if (window._tm) { window._tm.month = ym; _tmRender(); } }
function tmOpenGame(i) {
  var d = window._tm && window._tm.data;
  var g = d && d.games[i];
  if (!g) return;
  var me = d.team.name || '', opp = g.oppName || g.opp || '';
  openGameScreen(String(g.id), g.home ? opp : me, g.home ? me : opp, d.league, g.day || _tmLocalDay(g.date));
}

function _tmColors(d, abbr) {
  if (d.league === 'mlb') return _ghTeamColors(abbr);
  var c = (d.teamColors && d.teamColors[abbr]) || {};
  return _gxColors(d.league, abbr, c.color, c.alt);
}
function _tmSelfColors(d) {
  return d.league === 'mlb' ? _ghTeamColors(d.team.abbr) : _gxColors(d.league, d.team.abbr, d.team.color, d.team.alt);
}
function _tmBadge(c, abbr, size, cls) {
  abbr = abbr || '?';
  var sz = size ? 'width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * (abbr.length > 2 ? 0.34 : 0.42)) + 'px;' : '';
  return '<span class="tm-badge' + (cls ? ' ' + cls : '') + '" style="' + sz + 'background:' + c.bg + ';color:' + c.fg + '">' + _escapeHtml(abbr) + '</span>';
}
function _tmRec(games) {
  var w = 0, l = 0, t = 0;
  games.forEach(function (g) { if (g.res === 'W') w++; else if (g.res === 'L') l++; else if (g.res === 'T') t++; });
  return w + '-' + l + (t ? '-' + t : '');
}
function _tmStreak(finals) {
  if (!finals.length) return '';
  var last = finals[finals.length - 1].res, n = 0;
  for (var i = finals.length - 1; i >= 0 && finals[i].res === last; i--) n++;
  return (last === 'W' ? 'Won ' : last === 'L' ? 'Lost ' : 'Tied ') + n;
}
function _tmDayLabel(g) {
  var day = g.day || _tmLocalDay(g.date);
  return day ? _ghL10DateLabel(day) : '';
}
function _tmShortDate(g) {
  var day = g.day || _tmLocalDay(g.date);
  if (!day) return '';
  var p = day.split('-');
  return _TM_MONTHS[Number(p[1]) - 1] + ' ' + Number(p[2]);
}
function _tmTime(g) {
  if (g.timeTbd) return 'TBD';
  return (g.date && _formatGameTime(g.date)) || '';
}
function _tmOutHtml(g, compact) {
  if (g.res) return compact
    ? '<span class="tm-out ' + g.res + '"><span>' + g.res + '</span> <span>' + g.us + '-' + g.them + '</span></span>'
    : '<span class="tm-out ' + g.res + '">' + g.res + ' ' + g.us + '–' + g.them + '</span>';
  if (g.state === 'in') return '<span class="tm-out in">Live</span>';
  if (g.state === 'post') return '<span class="tm-out pre">' + _escapeHtml(g.status || 'Final') + '</span>';
  var today = (g.day || _tmLocalDay(g.date)) === _todayLocal();
  // Calendar cells are ~36px wide on a phone: "6:45p" instead of "6:45 PM"
  var tm = compact ? _tmTime(g).replace(/\s*([AaPp])\.?[Mm]\.?$/, function (x, ap) { return ap.toLowerCase(); }) : _tmTime(g);
  return '<span class="tm-out pre">' + _escapeHtml(today ? (compact ? 'Today' : 'Today ' + tm) : tm) + '</span>';
}
// Live game first, otherwise the next one that hasn't started
function _tmNextIndex(d) {
  for (var i = 0; i < d.games.length; i++) if (d.games[i].state === 'in') return i;
  for (var j = 0; j < d.games.length; j++) if (d.games[j].state === 'pre') return j;
  return -1;
}

function _tmRender() {
  var el = document.getElementById('tm-body');
  if (!el) return;
  var s = window._tm;
  if (!s) { el.innerHTML = ''; return; }
  if (s.err) {
    el.innerHTML = '<div class="tm-empty"><b>This team didn\'t load</b><div>' + _escapeHtml(s.err) + '</div><button class="tm-btn" onclick="tmRetry()">Try again</button></div>';
    return;
  }
  if (!s.data) {
    el.innerHTML = '<div class="tm-wrap"><div class="tm-hero" aria-busy="true"><span class="tm-badge tm-badge-hero" style="background:rgba(168,159,232,.14)"></span>' +
      '<div class="tm-hero-txt" style="display:flex;flex-direction:column;gap:10px"><div class="tm-skel" style="width:40%"></div><div class="tm-skel" style="width:65%;height:20px"></div><div class="tm-skel" style="width:30%;height:28px"></div></div></div>' +
      '<div class="tm-card"><div class="tm-skel" style="width:50%;margin-bottom:12px"></div><div class="tm-skel" style="margin-bottom:10px"></div><div class="tm-skel" style="margin-bottom:10px"></div><div class="tm-skel"></div></div></div>';
    return;
  }
  var d = s.data;
  var body = s.tab === 'schedule'
    ? '<div id="tm-sched">' + (d.league === 'mlb' ? _tmCalendarHtml(d, s) : _tmWeeksHtml(d)) + '</div>'
    : _tmRosterHtml(d, s);
  el.innerHTML = '<div class="tm-wrap">' + _tmHeroHtml(d) + body + '</div>';
}

function _tmHeroHtml(d) {
  var t = d.team, c = _tmSelfColors(d);
  var finals = d.games.filter(function (g) { return g.res; });
  var regular = finals.filter(function (g) { return !g.post; });
  var rec = t.record || _tmRec(regular);
  var chips = [];
  if (t.standing) chips.push(t.standing);
  var sk = _tmStreak(finals);
  if (sk) chips.push(sk);
  if (d.league === 'mlb' && finals.length >= 10) chips.push('Last 10: ' + _tmRec(finals.slice(-10)));
  var ni = _tmNextIndex(d), next = '';
  if (ni >= 0) {
    var g = d.games[ni];
    var when = g.state === 'in' ? 'Live now' : ((g.day || _tmLocalDay(g.date)) === _todayLocal() ? 'Today' : _tmDayLabel(g)) + (g.state === 'in' ? '' : ', ' + _tmTime(g));
    next = '<button class="tm-next" onclick="tmOpenGame(' + ni + ')">' + _tmBadge(_tmColors(d, g.opp), g.opp, 36) +
      '<span class="tm-next-txt"><small>' + (g.state === 'in' ? 'Playing now' : 'Next game') + '</small><b>' + (g.home ? 'vs ' : '@ ') + _escapeHtml(g.oppShort || g.oppName || g.opp) + '</b><small>' + _escapeHtml(when) + '</small></span>' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9C95D0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 5 16 12 9 19"/></svg></button>';
  }
  var cal = '<button class="tm-calbtn" onclick="tmShowCalendar()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>Full season calendar</button>';
  return '<div class="tm-hero" style="background:radial-gradient(ellipse at 0% 0%,' + _ghHexAlpha(c.bg, .4) + ',transparent 62%),#1A1640">' +
    _tmBadge(c, t.abbr, 0, 'tm-badge-hero') +
    '<div class="tm-hero-txt">' + (t.location ? '<div class="tm-loc">' + _escapeHtml(t.location) + '</div>' : '') +
      '<div class="tm-name">' + _escapeHtml(t.short || t.name || '') + '</div>' +
      '<div class="tm-rec">' + _escapeHtml(rec) + '</div>' +
      (chips.length ? '<div class="tm-chips">' + chips.map(function (x) { return '<span class="tm-chip">' + _escapeHtml(x) + '</span>'; }).join('') + '</div>' : '') +
    '</div><div class="tm-hero-side">' + next + cal + '</div></div>';
}

function _tmRosterHtml(d, s) {
  if (!d.groups.length) return '<div class="tm-card"><div class="tm-empty" style="padding:24px 10px"><b>No roster yet</b><div>The roster for this team isn\'t available right now.</div></div></div>';
  var grp = s.grp;
  if (grp !== 'All' && !d.groups.some(function (g) { return g.label === grp; })) grp = 'All';
  var total = d.groups.reduce(function (n, g) { return n + g.players.length; }, 0);
  var h = '<div class="tm-card">';
  if (d.groups.length > 1) {
    h += '<div class="tm-filters">' + ['All'].concat(d.groups.map(function (g) { return g.label; })).map(function (l) {
      return '<button class="' + (l === grp ? 'on' : '') + '" data-grp="' + _escapeHtml(l) + '" onclick="tmFilter(this.dataset.grp)">' + _escapeHtml(l) + '</button>';
    }).join('') + '</div>';
  }
  d.groups.forEach(function (g) {
    if (grp !== 'All' && g.label !== grp) return;
    h += '<div class="tm-group"><div class="tm-eyebrow">' + _escapeHtml(g.label) + '<span>' + g.players.length + (g.players.length === 1 ? ' player' : ' players') + '</span></div><div class="tm-roster">' +
      g.players.map(function (p) {
        var meta = p.exp == null ? '' : (p.exp === 0 ? 'Rookie' : p.exp + (p.exp === 1 ? ' yr' : ' yrs'));
        return '<div class="tm-prow" role="button" tabindex="0" data-name="' + _escapeHtml(p.name) + '" data-id="' + _escapeHtml(String(p.id || '')) + '" data-league="' + d.league + '" onclick="openPlayerLinkSheet(this.dataset.name,this.dataset.id||null,this.dataset.league)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.click();}">' +
          '<span class="tm-num">' + _escapeHtml(p.jersey || '') + '</span>' +
          '<div class="tm-pmain"><b>' + _escapeHtml(p.name) + '</b><span>' + _escapeHtml(p.posName || p.pos || '') + '</span></div>' +
          (meta ? '<span class="tm-pmeta">' + meta + '</span>' : '') + '</div>';
      }).join('') + '</div></div>';
  });
  return h + (grp === 'All' ? '<div class="tm-legend">' + total + ' players · tap a name for reference links</div>' : '') + '</div>';
}

// Football: one tile per week, bye weeks filled in from gaps in the
// regular-season week numbers, postseason tiles after.
function _tmWeeksHtml(d) {
  if (!d.games.length) return '<div class="tm-card"><div class="tm-empty" style="padding:24px 10px"><b>No schedule yet</b><div>This season\'s schedule isn\'t out yet.</div></div></div>';
  var ni = _tmNextIndex(d);
  var reg = [], post = [];
  d.games.forEach(function (g, i) { (g.post ? post : reg).push({ g: g, i: i }); });
  var tiles = [];
  var lastWeek = null;
  reg.forEach(function (x) {
    var w = x.g.week;
    if (d.league === 'nfl' && w != null && lastWeek != null) for (var b = lastWeek + 1; b < w; b++) tiles.push({ bye: b });
    if (w != null) lastWeek = w;
    tiles.push(x);
  });
  post.forEach(function (x) { tiles.push(x); });
  var finals = d.games.filter(function (g) { return g.res && !g.post; });
  var yr = (d.games[0].day || _tmLocalDay(d.games[0].date) || '').slice(0, 4);
  var h = '<div class="tm-card"><div class="tm-eyebrow">' + _escapeHtml(yr) + ' season<span>' + _escapeHtml(_tmRec(finals)) + '</span></div><div class="tm-weeks">';
  tiles.forEach(function (x) {
    if (x.bye) { h += '<div class="tm-wk bye"><span>Week ' + x.bye + '</span><b>Bye</b></div>'; return; }
    var g = x.g;
    var label = g.post ? (g.label || 'Playoffs') : (g.week != null ? 'Week ' + g.week : (g.label || ''));
    h += '<button class="tm-wk' + (x.i === ni ? ' now' : '') + '" onclick="tmOpenGame(' + x.i + ')" aria-label="' + _escapeHtml(label + ', ' + (g.home ? 'vs ' : 'at ') + (g.oppName || g.opp) + ', ' + _tmDayLabel(g)) + '">' +
      '<span class="tm-wk-top"><span style="overflow:hidden;text-overflow:ellipsis">' + _escapeHtml(label) + '</span><span>' + _escapeHtml(_tmShortDate(g)) + '</span></span>' +
      '<span class="tm-wk-opp">' + _tmBadge(_tmColors(d, g.opp), g.opp, 26) + '<span><small>' + (g.neutral ? 'vs' : (g.home ? 'vs' : '@')) + '</small> ' + _escapeHtml(g.opp) + '</span></span>' +
      _tmOutHtml(g, false) + '</button>';
  });
  return h + '</div><div class="tm-legend"><span>Outlined week is up next</span><span>Tap any week to open the game</span></div></div>';
}

// Baseball: a month at a time, every game on its day, doubleheaders stacked.
function _tmCalendarHtml(d, s) {
  if (!d.games.length) return '<div class="tm-card"><div class="tm-empty" style="padding:24px 10px"><b>No schedule yet</b><div>This season\'s schedule isn\'t out yet.</div></div></div>';
  var byDay = {}, months = [];
  d.games.forEach(function (g, i) {
    var day = g.day || _tmLocalDay(g.date);
    if (!day) return;
    (byDay[day] = byDay[day] || []).push(i);
    var ym = day.slice(0, 7);
    if (months.indexOf(ym) === -1) months.push(ym);
  });
  months.sort();
  var cur = s.month;
  if (!cur || months.indexOf(cur) === -1) {
    var today = _todayLocal().slice(0, 7);
    var ni = _tmNextIndex(d);
    cur = months.indexOf(today) !== -1 ? today : (ni >= 0 ? (d.games[ni].day || _tmLocalDay(d.games[ni].date)).slice(0, 7) : months[months.length - 1]);
    s.month = cur;
  }
  var finals = d.games.filter(function (g) { return g.res; });
  var h = '<div class="tm-card"><div class="tm-months">' + months.map(function (ym) {
    var mFinals = finals.filter(function (g) { return (g.day || _tmLocalDay(g.date) || '').slice(0, 7) === ym; });
    return '<button class="' + (ym === cur ? 'on' : '') + '" onclick="tmMonth(\'' + ym + '\')">' + _TM_MONTHS[Number(ym.slice(5, 7)) - 1] + '<small>' + (mFinals.length ? _tmRec(mFinals) : '—') + '</small></button>';
  }).join('') + '</div>';
  var reg = finals.filter(function (g) { return !g.post; });
  var left = d.games.filter(function (g) { return !g.post && !g.res && g.state !== 'post'; }).length;
  h += '<div class="tm-splits"><span class="tm-chip">Home ' + _tmRec(reg.filter(function (g) { return g.home; })) + '</span><span class="tm-chip">Away ' + _tmRec(reg.filter(function (g) { return !g.home; })) + '</span>' +
    (left ? '<span class="tm-chip">' + left + ' left</span>' : '') + '</div>';
  var y = Number(cur.slice(0, 4)), mo = Number(cur.slice(5, 7)) - 1;
  var first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
  var todayStr = _todayLocal();
  h += '<div class="tm-cal">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (x) { return '<div class="tm-dow">' + x + '</div>'; }).join('');
  for (var e = 0; e < first; e++) h += '<div class="tm-day empty"></div>';
  for (var dd = 1; dd <= days; dd++) {
    var key = cur + '-' + (dd < 10 ? '0' + dd : dd);
    var idx = byDay[key] || [];
    var cls = 'tm-day' + (idx.length ? '' : ' off') + (key === todayStr ? ' today' : '');
    h += '<div class="' + cls + '"><span class="tm-dn">' + dd + '</span>';
    idx.forEach(function (i) {
      var g = d.games[i];
      h += '<button class="tm-dg" onclick="tmOpenGame(' + i + ')" aria-label="' + _escapeHtml((g.home ? 'vs ' : 'at ') + (g.oppName || g.opp) + ', ' + _tmDayLabel(g) + (g.res ? ', ' + (g.res === 'W' ? 'won ' : 'lost ') + g.us + ' to ' + g.them : '')) + '">' +
        '<span class="tm-dg-ha">' + (g.home ? 'vs' : '@') + '</span>' +
        '<span class="tm-dg-opp">' + _tmBadge(_tmColors(d, g.opp), g.opp, 18) + _escapeHtml(g.opp) + '</span>' + _tmOutHtml(g, true) + '</button>';
    });
    h += '</div>';
  }
  return h + '</div><div class="tm-legend"><span>Outlined day is today</span><span>Tap any game to open it</span></div></div>';
}

// Cheat sheets: before a game starts, MLB shows a probable-pitcher
// feature + batting order (or active roster if the lineup isn't posted
// yet), and NFL/CFB show the whole roster ranked by position. Once a
// game is actually live or has finished, the box score (same
// _boxScoreCardHtml already used for memory-attached box scores) is
// prepended ABOVE that same cheat sheet content — not a replacement for
// it, the pregame info is still worth having for reference once the
// game's underway. Box score and cheat sheet load independently and in
// parallel; whichever resolves second just re-renders the panel with
// both pieces now in place. Works for any sport with a boxscore
// endpoint (mlb.js and espn.js both feed it the same shape) — it just
// doesn't have anywhere to surface for NBA/WNBA/NHL/MLS/NWSL yet since
// those don't have real schedules wired into the Games browser to reach
// a game screen from.
