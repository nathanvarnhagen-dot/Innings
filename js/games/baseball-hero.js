// ── GAME RECAP — plays once per session (in-memory flag, no Firestore
// write) when a game's box score first comes back Final. Beats are built
// fresh from the same box score data _boxScoreCardHtml already renders —
// nothing new to fetch.
window._gameRecapShown = {};
var _gameRecapTimer = null;
var _gameRecapStep = 0;
var _gameRecapBeats = [];

function _teamShortName(name) {
  if (!name) return '';
  if (/Red Sox$/.test(name)) return 'Red Sox';
  if (/White Sox$/.test(name)) return 'White Sox';
  var parts = name.trim().split(' ');
  return parts[parts.length - 1];
}

// Highlights are capped at 2 regardless of how many the game actually had,
// so a 6-homer blowout still finishes in a few seconds — the last 2
// chronologically (closest to how it actually ended), since there's no
// win-probability data available to judge "biggest" by instead.
function _buildGameRecapBeats(box, sport) {
  var beats = [{ type: 'final' }];
  beats.push({
    type: 'score',
    awayLabel: _teamShortName(box.away),
    homeLabel: _teamShortName(box.home),
    awayScore: box.awayScore,
    homeScore: box.homeScore,
    awayWins: box.awayScore != null && box.homeScore != null && box.awayScore > box.homeScore,
    homeWins: box.awayScore != null && box.homeScore != null && box.homeScore > box.awayScore
  });
  var highlightSource = (sport === 'mlb')
    ? (box.homeRuns || []).map(function (hr) { return { icon: '⚾', text: hr.description || (hr.batter ? hr.batter + ' home run' : 'Home run') }; })
    : (box.highlights || []).map(function (h) { return { icon: h.emoji || '🏈', text: h.text || '' }; });
  highlightSource.slice(-2).forEach(function (h) { if (h.text) beats.push({ type: 'highlight', icon: h.icon, text: h.text }); });
  if (sport === 'mlb' && box.winningPitcher) {
    var decisionParts = ['W: ' + _escapeHtml(box.winningPitcher)];
    if (box.losingPitcher) decisionParts.push('L: ' + _escapeHtml(box.losingPitcher));
    if (box.savePitcher) decisionParts.push('SV: ' + _escapeHtml(box.savePitcher));
    beats.push({ type: 'decision', html: decisionParts.join('<br>') });
  }
  return beats;
}

function _gameRecapBeatHtml(beat) {
  if (beat.type === 'final') return '<div class="gr-final-stamp gr-beat-in">FINAL</div>';
  if (beat.type === 'score') {
    return '<div class="gr-teams gr-beat-in">' + _escapeHtml(beat.awayLabel) + ' @ ' + _escapeHtml(beat.homeLabel) + '</div>' +
      '<div class="gr-final-line gr-beat-in">' +
      '<div class="gr-team-score"><div class="gr-team-abbr">' + _escapeHtml(beat.awayLabel.toUpperCase()) + '</div><div class="gr-team-num' + (beat.awayWins ? ' winner' : '') + '">' + (beat.awayScore != null ? beat.awayScore : '-') + '</div></div>' +
      '<div class="gr-dash">–</div>' +
      '<div class="gr-team-score"><div class="gr-team-abbr">' + _escapeHtml(beat.homeLabel.toUpperCase()) + '</div><div class="gr-team-num' + (beat.homeWins ? ' winner' : '') + '">' + (beat.homeScore != null ? beat.homeScore : '-') + '</div></div>' +
      '</div>';
  }
  if (beat.type === 'highlight') return '<div class="gr-hl-icon gr-beat-in">' + beat.icon + '</div><div class="gr-hl-text gr-beat-in">' + _escapeHtml(beat.text) + '</div>';
  if (beat.type === 'decision') return '<div class="gr-decision-line gr-beat-in">' + beat.html + '</div>';
  return '';
}

function maybePlayGameRecap(box, sport, gamePk) {
  if (!box || box.error) return;
  if (window._gameRecapShown[gamePk]) return;
  window._gameRecapShown[gamePk] = true;
  var beats = _buildGameRecapBeats(box, sport);
  if (beats.length < 2) return; // final score missing — nothing worth a sequence over
  _gameRecapBeats = beats;
  _gameRecapStep = 0;
  var overlay = document.getElementById('game-recap-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  requestAnimationFrame(function () { overlay.style.opacity = '1'; });
  _showGameRecapStep();
}

function _showGameRecapStep() {
  var beatEl = document.getElementById('game-recap-beat');
  if (_gameRecapStep >= _gameRecapBeats.length) { _finishGameRecap(); return; }
  if (beatEl) beatEl.innerHTML = _gameRecapBeatHtml(_gameRecapBeats[_gameRecapStep]);
  var delay = _gameRecapStep === 0 ? 900 : 1500;
  _gameRecapStep++;
  _gameRecapTimer = setTimeout(_showGameRecapStep, delay);
}

function _finishGameRecap() {
  var overlay = document.getElementById('game-recap-overlay');
  if (!overlay) return;
  overlay.style.opacity = '0';
  setTimeout(function () { overlay.style.display = 'none'; }, 300);
}

function skipGameRecap() {
  clearTimeout(_gameRecapTimer);
  _finishGameRecap();
}

// ── GAME-STATE HERO (v5.40.0) — the animated card at the top of the game
// screen. Three phases, picked from whatever the game screen has loaded:
//   pre   → /api/mlb?mode=pregame (probable pitchers, records, standings)
//   live  → /api/mlb?mode=boxscore while Live (score, situation, scoring plays)
//   final → the same boxscore once Final (linescore, decisions, star, recap)
// MLB only for now. Each phase is built from a sport-neutral model
// (_ghModelFromMlbPregame / _ghModelFromMlbBox) so other leagues only
// need their own model builder later, not a new renderer.
//
// The card is a plain HTML string re-injected by renderGameCheatSheet on
// every live refresh tick, so animation state lives in window._ghState:
// entry animations run on the FIRST render of each phase only, a play
// animates in (with a NEW tag) only when it wasn't in the previous
// render, and a score only flashes when it changed since the last one.
window._ghState = null;
window._ghCountdownTimer = null;

function _ghResetForGame(gamePk) {
  if (window._ghState) { clearTimeout(window._ghState.liveModeTimer); clearTimeout(window._ghState.finalModeTimer); }
  window._ghState = { gamePk: gamePk, animated: {}, seenPlays: null, newAt: {}, lastScore: null, startCheckAt: 0 };
  window._ghInningOpen = {}; // which half-innings the reader has open, cleared per game
  window._gxDriveOpen = {}; // same, for football drives
  if (window._ghCountdownTimer) { clearInterval(window._ghCountdownTimer); window._ghCountdownTimer = null; }
}

// Primary / on-dark accent per MLB abbreviation (as the Stats API sends
// it). bg+fg paint the badge; accent is the version that stays readable
// on the dark card for bars, tags and text.
var GH_MLB_COLORS = {
  AZ: ['#A71930', '#fff', '#E3526A'], ARI: ['#A71930', '#fff', '#E3526A'], ATL: ['#CE1141', '#fff', '#F0567A'],
  BAL: ['#DF4601', '#fff', '#FF8A4C'], BOS: ['#BD3039', '#fff', '#EE6A72'], CHC: ['#0E3386', '#fff', '#6F95E8'],
  CWS: ['#27251F', '#fff', '#C4CED4'], CIN: ['#C6011F', '#fff', '#F2566B'], CLE: ['#E31937', '#fff', '#F2627A'],
  COL: ['#333366', '#fff', '#A7A7E0'], DET: ['#0C2340', '#fff', '#FA8C4F'], HOU: ['#EB6E1F', '#1A1640', '#F59A5E'],
  KC: ['#004687', '#fff', '#6FA8E8'], LAA: ['#BA0021', '#fff', '#EE5A70'], LAD: ['#005A9C', '#fff', '#4A8FD9'],
  MIA: ['#00A3E0', '#1A1640', '#4CC4F0'], MIL: ['#12284B', '#FFC52F', '#FFC52F'], MIN: ['#002B5C', '#fff', '#E8557A'],
  NYM: ['#002D72', '#fff', '#FF7A3D'], NYY: ['#0C2340', '#fff', '#AEB8C6'], ATH: ['#003831', '#EFB21E', '#EFB21E'],
  OAK: ['#003831', '#EFB21E', '#EFB21E'], PHI: ['#E81828', '#fff', '#F5606B'], PIT: ['#FDB827', '#1A1640', '#FDC94F'],
  SD: ['#2F241D', '#FFC425', '#FFC425'], SF: ['#FD5A1E', '#1A1640', '#FD7A48'], SEA: ['#0C2C56', '#fff', '#2BC4B8'],
  STL: ['#C41E3A', '#fff', '#EE5E75'], TB: ['#092C5C', '#fff', '#8FBCE6'], TEX: ['#003278', '#fff', '#F0566A'],
  TOR: ['#134A8E', '#fff', '#5B9BE8'], WSH: ['#AB0003', '#fff', '#EE5458']
};
function _ghTeamColors(abbr) {
  var c = GH_MLB_COLORS[String(abbr || '').toUpperCase()];
  return c ? { bg: c[0], fg: c[1], accent: c[2] } : { bg: '#3D3580', fg: '#fff', accent: '#A89FE8' };
}
function _ghHexAlpha(hex, a) {
  var h = String(hex || '').replace('#', '');
  if (h.length !== 6) return 'rgba(168,159,232,' + a + ')';
  return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
}
function _ghAbbrFallback(name) {
  var short = _teamShortName(name || '');
  return short ? short.slice(0, 3).toUpperCase() : '—';
}
// "Patrick Bailey" → "Bailey", "Vladimir Guerrero Jr." → "Guerrero Jr."
function _ghLastName(full) {
  if (!full) return '';
  var parts = String(full).trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || '';
  var last = parts[parts.length - 1];
  if (/^(Jr\.?|Sr\.?|II|III|IV)$/i.test(last) && parts.length > 2) return parts[parts.length - 2] + ' ' + last;
  return last;
}
function _ghInitials(full) {
  var parts = String(full || '').trim().split(/\s+/).filter(function (p) { return !/^(Jr\.?|Sr\.?|II|III|IV)$/i.test(p); });
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
function _ghShortInitialName(full) {
  var parts = String(full || '').trim().split(/\s+/);
  if (parts.length < 2) return full || '';
  return parts[0][0] + '. ' + _ghLastName(full);
}
function _ghDelay(s) { return 'animation-delay:' + s.toFixed(2) + 's;'; }

// "2-run homer", "RBI double", "sac fly", "wild pitch"…
function _ghPlayLabel(p) {
  var ev = String(p.event || '').toLowerCase();
  var rbi = p.rbi || 0;
  if (p.eventType === 'home_run' || ev === 'home run') {
    if (rbi >= 4) return 'grand slam';
    return rbi <= 1 ? 'solo homer' : rbi + '-run homer';
  }
  if (ev === 'sac fly') return 'sac fly';
  if (ev === 'sac bunt') return 'sac bunt';
  if (ev === 'walk' || ev === 'intent walk') return rbi ? 'bases-loaded walk' : 'walk';
  if (ev === 'hit by pitch') return rbi ? 'bases-loaded HBP' : 'hit by pitch';
  if (ev === 'grounded into dp') ev = 'double play';
  if (ev === 'field error') ev = 'error';
  if (ev === 'fielders choice' || ev === 'fielders choice out') ev = "fielder's choice";
  if (!ev) ev = 'scoring play';
  if (rbi >= 2) return rbi + '-run ' + ev;
  if (rbi === 1) return 'RBI ' + ev;
  return ev;
}
function _ghArticle(label) { return /^([aeiou]|RBI|8-|11-|18-)/i.test(label) ? 'an' : 'a'; }
function _ghPlayHeadline(p) {
  var label = _ghPlayLabel(p);
  if (!p.rbi && p.eventType !== 'home_run') return label.charAt(0).toUpperCase() + label.slice(1);
  return (p.batter ? _ghLastName(p.batter) + ' ' : '') + label;
}
function _ghScoreChip(p, awayAbbr, homeAbbr) {
  if (p.awayScore == null || p.homeScore == null) return '';
  if (p.awayScore === p.homeScore) return 'Tied ' + p.awayScore + '–' + p.homeScore;
  return p.awayScore > p.homeScore
    ? awayAbbr + ' ' + p.awayScore + '–' + p.homeScore
    : homeAbbr + ' ' + p.homeScore + '–' + p.awayScore;
}

// ── MODELS ────────────────────────────────────────────────────────────
function _ghSideFromPregame(s) {
  var abbr = s.abbr || _ghAbbrFallback(s.name);
  var st = s.standing || {};
  var f = s.feat;
  return {
    id: s.id != null ? s.id : null,
    name: s.name, short: _teamShortName(s.name), abbr: abbr, colors: _ghTeamColors(abbr),
    record: s.record || null, divRank: st.divRank || null, divName: st.divName || null,
    l10: st.l10 || null, streak: st.streak || null,
    last10: (s.last10 && s.last10.length) ? s.last10 : null,
    pitcher: f ? { name: f.name, id: f.id || null, hand: f.hand || null, stats: f.stats || null } : null
  };
}
function _ghModelFromMlbPregame(data) {
  if (!data || !data.away || !data.home) return null;
  return { phase: 'pre', away: _ghSideFromPregame(data.away), home: _ghSideFromPregame(data.home), startTime: data.startTime || null, venue: data.venue || null };
}
function _ghModelFromMlbBox(box) {
  if (!box || box.error || !box.home) return null;
  var status = box.status || '';
  var sl = String(status).toLowerCase();
  if (sl.indexOf('postponed') !== -1 || sl.indexOf('cancel') !== -1) return null;
  var phase = box.gameState === 'Final' || _isGameConcluded(status) ? 'final'
    : ((box.gameState === 'Live' || (box.gameState !== 'Preview' && _isGameStatusLive(status))) ? 'live' : null);
  if (!phase) return null;
  var side = function (key) {
    var name = box[key];
    var abbr = box[key + 'Abbr'] || _ghAbbrFallback(name);
    return {
      name: name, short: _teamShortName(name), abbr: abbr, colors: _ghTeamColors(abbr),
      score: box[key + 'Score'], hits: box[key + 'Hits'], errors: box[key + 'Errors'], record: box[key + 'Record'] || null
    };
  };
  return {
    phase: phase, status: status, venue: box.venue || null,
    away: side('away'), home: side('home'),
    innings: box.innings || [], situation: box.situation || null,
    plays: (box.scoringPlays || []).slice(),
    decisions: box.decisionsDetail || null,
    fallbackDecisions: { w: box.winningPitcher, l: box.losingPitcher, s: box.savePitcher },
    star: box.starOfGame || null
  };
}

// ── SHARED PIECES ─────────────────────────────────────────────────────
function _ghBadge(side, size) {
  var fs = Math.round(size * (side.abbr.length > 2 ? 0.36 : 0.42));
  return '<div class="gh-badge" style="width:' + size + 'px;height:' + size + 'px;background:' + side.colors.bg + ';color:' + side.colors.fg + ';font-size:' + fs + 'px;box-shadow:0 0 0 3px rgba(255,255,255,.08),0 8px 22px ' + _ghHexAlpha(side.colors.bg, .45) + '">' + _escapeHtml(side.abbr) + '</div>';
}
function _ghInningTag(half, inning, model) {
  var team = half === 'top' ? model.away : model.home;
  return '<span class="gh-tag" style="background:' + _ghHexAlpha(team.colors.accent, .2) + ';color:' + team.colors.accent + '">' + (half === 'top' ? 'T' : 'B') + (inning || '') + '</span>';
}
function _ghHeader(chipClass, chipInner, meta, rightHtml) {
  return '<div class="gh-row"><span class="gh-chip ' + chipClass + '">' + chipInner + '</span>' +
    (rightHtml || (meta ? '<span class="gh-meta">' + _escapeHtml(meta) + '</span>' : '')) + '</div>';
}

// ── PRE-GAME ──────────────────────────────────────────────────────────
function _ghCountdownText(startIso) {
  var t = startIso ? new Date(startIso).getTime() : NaN;
  if (isNaN(t)) return null;
  var diff = Math.floor((t - Date.now()) / 1000);
  if (diff <= 0) return 'Any minute';
  if (diff >= 86400) {
    var d = new Date(t);
    return d.toLocaleDateString(undefined, { weekday: 'short' }) + ' ' + (_formatGameTime(startIso) || '');
  }
  var pad = function (n) { return n < 10 ? '0' + n : String(n); };
  return pad(Math.floor(diff / 3600)) + ':' + pad(Math.floor((diff % 3600) / 60)) + ':' + pad(diff % 60);
}

// Keeps #gh-countdown ticking without re-rendering the card. Once first
// pitch has passed it re-checks the box score once a minute, so a
// pre-game screen left open flips itself to the live card.
function _ghStartCountdown(startIso) {
  if (window._ghCountdownTimer) clearInterval(window._ghCountdownTimer);
  window._ghCountdownTimer = setInterval(function () {
    var el = document.getElementById('gh-countdown');
    var screenEl = document.getElementById('screen-game');
    if (!el || !screenEl || !screenEl.classList.contains('active')) { clearInterval(window._ghCountdownTimer); window._ghCountdownTimer = null; return; }
    var txt = _ghCountdownText(startIso);
    if (txt != null && el.textContent !== txt) el.textContent = txt;
    var st = window._ghState;
    var game = window._activeBrowseGame;
    if (st && game && new Date(startIso).getTime() <= Date.now() && Date.now() - st.startCheckAt > 60000) {
      st.startCheckAt = Date.now();
      var pk = game.gamePk;
      _refreshBoxScore(pk).then(function (isLive) {
        if (isLive && window._activeBrowseGame && window._activeBrowseGame.gamePk == pk && !window._gameLiveRefreshTimer) _startGameLiveRefresh(pk);
      });
    }
  }, 1000);
}

function _ghCompareRow(label, a, b, lowerBetter, delay, aNum, bNum) {
  var na = aNum != null ? Number(aNum) : parseFloat(a), nb = bNum != null ? Number(bNum) : parseFloat(b);
  if (isNaN(na) || isNaN(nb)) return '';
  var pa, pb;
  if (lowerBetter) { var mn = Math.max(Math.min(na, nb), 0.01); pa = mn / Math.max(na, 0.01); pb = mn / Math.max(nb, 0.01); }
  else { var mx = Math.max(na, nb, 0.01); pa = na / mx; pb = nb / mx; }
  var clamp = function (v) { return Math.max(14, Math.min(92, Math.round(v * 90))); };
  var aBetter = lowerBetter ? na < nb : na > nb;
  var bBetter = lowerBetter ? nb < na : nb > na;
  var cA = this.away.colors.accent, cB = this.home.colors.accent;
  return '<div style="display:flex;align-items:center;gap:8px;height:24px">' +
    '<span class="gh-num" style="width:44px;flex-shrink:0;font-size:15px;color:' + (aBetter ? '#fff' : '#B9B3E6') + '">' + _escapeHtml(String(a)) + '</span>' +
    '<div class="gh-bar-track" style="justify-content:flex-end"><div class="gh-bar gh-grow-l" style="width:' + clamp(pa) + '%;background:' + cA + ';opacity:' + (aBetter ? 1 : .45) + ';' + _ghDelay(delay) + '"></div></div>' +
    '<span style="width:' + (String(label).length > 5 ? 70 : 42) + 'px;flex-shrink:0;text-align:center;font-size:' + (String(label).length > 5 ? 9.5 : 10.5) + 'px;font-weight:800;letter-spacing:.06em;color:#9C95D0;text-transform:uppercase;white-space:nowrap">' + _escapeHtml(label) + '</span>' +
    '<div class="gh-bar-track"><div class="gh-bar gh-grow-r" style="width:' + clamp(pb) + '%;background:' + cB + ';opacity:' + (bBetter ? 1 : .45) + ';' + _ghDelay(delay) + '"></div></div>' +
    '<span class="gh-num" style="width:44px;flex-shrink:0;text-align:right;font-size:15px;color:' + (bBetter ? '#fff' : '#B9B3E6') + '">' + _escapeHtml(String(b)) + '</span>' +
  '</div>';
}

function _ghPreHtml(m, st, animating) {
  var meta = [_formatGameTime(m.startTime), m.venue].filter(Boolean).join(' · ');
  var h = _ghHeader('pre', '<span class="gh-dot pre"></span>PRE-GAME', meta);

  var teamTile = function (s, cls, delay) {
    var rec = s.record ? (s.record.w + '–' + s.record.l) : '—';
    var place = (s.divRank && s.divName) ? _ordinalSuffix(s.divRank) + ' · ' + s.divName : '';
    var tap = _tmTapAttrs('mlb', s.id, s.name);
    return '<div class="gh-team ' + cls + (tap ? ' tm-tap' : '') + '"' + tap + ' style="' + _ghDelay(delay) + '">' + _ghBadge(s, 50) +
      '<div style="font-size:12.5px;font-weight:700;margin-top:4px;max-width:104px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(s.short) + '</div>' +
      '<div class="gh-num" style="font-size:28px;line-height:1">' + rec + '</div>' +
      (place ? '<div style="font-size:10.5px;color:#B9B3E6">' + _escapeHtml(place) + '</div>' : '') + (tap ? '<div class="tm-hint">Team page ›</div>' : '') + '</div>';
  };
  h += '<div class="gh-stage">' +
    '<svg viewBox="0 0 314 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' +
      '<polygon class="gh-beam" points="8,0 34,0 146,150 114,150" fill="#A89FE8"/>' +
      '<polygon class="gh-beam" points="280,0 306,0 200,150 168,150" fill="#A89FE8" style="animation-delay:-1.7s"/>' +
      '<rect class="gh-bulb" x="6" y="0" width="30" height="5" rx="2" fill="#E9E5FF"/>' +
      '<rect class="gh-bulb" x="278" y="0" width="30" height="5" rx="2" fill="#E9E5FF" style="animation-delay:-1.7s"/>' +
      '<path class="gh-draw" d="M 47 112 Q 157 -18 267 112" fill="none" stroke="#A89FE8" stroke-width="1.5" style="opacity:.45"/>' +
      '<path class="gh-draw" d="M157 144 L213 98 L157 52 L101 98 Z" fill="none" stroke="#A89FE8" stroke-width="1.5" style="opacity:.7;animation-delay:.4s"/>' +
      '<circle cx="157" cy="100" r="4" fill="#A89FE8" style="opacity:.5"/>' +
    '</svg>' +
    '<div class="gh-teams">' +
      teamTile(m.away, 'gh-from-l', .25) +
      '<div style="display:flex;flex-direction:column;align-items:center;gap:6px">' +
        '<div class="gh-spin" style="width:34px;height:34px"><svg width="34" height="34" viewBox="0 0 36 36" style="display:block"><circle cx="18" cy="18" r="16" fill="#F4F1FF"/>' +
        '<path d="M8 6 C 14 12, 14 24, 8 30" fill="none" stroke="#FF7A6B" stroke-width="1.6" stroke-dasharray="2.4 2.2"/>' +
        '<path d="M28 6 C 22 12, 22 24, 28 30" fill="none" stroke="#FF7A6B" stroke-width="1.6" stroke-dasharray="2.4 2.2"/></svg></div>' +
        '<div style="font-size:12px;letter-spacing:.2em;color:#B9B3E6;font-weight:800">VS</div>' +
      '</div>' +
      teamTile(m.home, 'gh-from-r', .35) +
    '</div></div>';

  var cd = _ghCountdownText(m.startTime);
  if (cd) {
    h += '<div class="gh-panel gh-up gh-row" style="' + _ghDelay(.55) + '">' +
      '<span class="gh-eyebrow">First pitch</span>' +
      '<span id="gh-countdown" class="gh-num" style="font-size:24px;line-height:1.15">' + _escapeHtml(cd) + '</span></div>';
  }

  var pa = m.away.pitcher, pb = m.home.pitcher;
  h += '<div style="display:flex;flex-direction:column;gap:10px">' +
    '<div class="gh-eyebrow gh-up" style="' + _ghDelay(.7) + '">Probable pitchers</div>';
  var pitcherCell = function (p, side, alignRight, cls, delay) {
    var sub = p && p.stats && p.stats.w != null ? ((p.hand ? p.hand + 'HP · ' : '') + p.stats.w + '–' + p.stats.l) : (p && p.hand ? p.hand + 'HP' : 'Not announced');
    // Tapping an announced pitcher opens the same Savant / Reference link sheet as everywhere else
    var linkAttrs = (p && p.id)
      ? ' role="button" tabindex="0" aria-label="Player links for ' + _escapeHtml(p.name) + '" data-name="' + _escapeHtml(p.name) + '" data-id="' + _escapeHtml(String(p.id)) + '" data-league="mlb" onclick="openPlayerLinkSheet(this.dataset.name,this.dataset.id,this.dataset.league)" onkeydown="if(event.key===\'Enter\')this.click()"'
      : '';
    return '<div class="' + cls + '"' + linkAttrs + ' style="' + _ghDelay(delay) + 'display:flex;align-items:center;gap:10px;min-width:0;min-height:44px;' + (p && p.id ? 'cursor:pointer;' : '') + (alignRight ? 'flex-direction:row-reverse;text-align:right' : '') + '">' +
      '<div style="width:38px;height:38px;border-radius:50%;background:#2A2560;border:2px solid ' + side.colors.accent + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;box-sizing:border-box;font-size:13px;font-weight:800">' + (p ? _escapeHtml(_ghInitials(p.name)) : '?') + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:1px;min-width:0">' +
        '<span style="font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + (p && p.id ? 'text-decoration:underline;text-decoration-color:rgba(255,255,255,.3);text-underline-offset:3px' : '') + '">' + (p ? _escapeHtml(_ghShortInitialName(p.name)) : 'TBD') + '</span>' +
        '<span class="gh-sub">' + _escapeHtml(sub) + '</span></div></div>';
  };
  h += '<div class="gh-row">' + pitcherCell(pa, m.away, false, 'gh-from-l', .8) + pitcherCell(pb, m.home, true, 'gh-from-r', .85) + '</div>';
  if (pa && pb && pa.stats && pb.stats) {
    var rows = _ghCompareRow.call(m, 'ERA', pa.stats.era, pb.stats.era, true, 1.0) +
      _ghCompareRow.call(m, 'WHIP', pa.stats.whip, pb.stats.whip, true, 1.1) +
      _ghCompareRow.call(m, 'K', pa.stats.so, pb.stats.so, false, 1.2);
    if (rows) h += '<div style="display:flex;flex-direction:column;gap:3px">' + rows + '</div>';
  }
  h += '</div>';

  if (m.away.last10 || m.home.last10) {
    h += _ghLast10Html(m, st, animating);
  } else if (m.away.l10 || m.home.l10) {
    var formRow = function (s, delay) {
      if (!s.l10) return '';
      var pct = Math.round((s.l10.w / Math.max(1, s.l10.w + s.l10.l)) * 100);
      var streak = s.streak ? '<span class="gh-tag" style="background:' + (/^W/.test(s.streak) ? 'rgba(124,242,156,.16);color:#9be8ac' : 'rgba(255,122,107,.16);color:#FFC2BA') + '">' + _escapeHtml(s.streak) + '</span>' : '';
      return '<div style="display:flex;align-items:center;gap:10px">' +
        '<span style="width:34px;font-size:12.5px;font-weight:800;color:' + s.colors.accent + '">' + _escapeHtml(s.abbr) + '</span>' +
        '<div class="gh-bar-track"><div class="gh-bar gh-grow-r" style="width:' + pct + '%;background:' + s.colors.accent + ';' + _ghDelay(delay) + '"></div></div>' +
        '<span class="gh-num" style="width:36px;text-align:right;font-size:15px">' + s.l10.w + '–' + s.l10.l + '</span>' + streak + '</div>';
    };
    h += '<div class="gh-up" style="' + _ghDelay(1.3) + 'display:flex;flex-direction:column;gap:8px">' +
      '<div class="gh-eyebrow">Last 10</div>' + formRow(m.away, 1.4) + formRow(m.home, 1.5) + '</div>';
  }
  return h;
}

// ── LAST 10 — one circle per game, oldest → latest, in the OPPONENT's
// colors with their abbreviation inside; green ring = win, red ring +
// dimmed = loss, W/L letter underneath. Tap a circle for the score.
// Record + streak are computed from the same list; on the first render
// the circles pop in one by one while the record counts up.
function _ghL10Record(games) {
  var w = games.filter(function (g) { return g.res === 'W'; }).length;
  var streak = '';
  if (games.length) {
    var last = games[games.length - 1].res, n = 0;
    for (var i = games.length - 1; i >= 0 && games[i].res === last; i--) n++;
    streak = last + n;
  }
  return { rec: w + '–' + (games.length - w), streak: streak };
}
function _ghL10DateLabel(iso) {
  var p = String(iso || '').split('-');
  if (p.length !== 3) return iso || '';
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function _ghL10DetailInner(g, key, i) {
  var win = g.res === 'W';
  var line = '<div class="gh-l10-line">' +
    '<span class="gh-tag" style="font-size:11px;' + (win ? 'background:rgba(124,242,156,.16);color:#9be8ac' : 'background:rgba(255,122,107,.16);color:#FFC2BA') + '">' + g.res + ' ' + g.us + '–' + g.them + '</span>' +
    '<span style="font-weight:700">' + (g.home ? 'vs ' : 'at ') + _escapeHtml(_teamShortName(g.oppName || '') || g.opp || '') + '</span>' +
    '<span style="color:#9C95D0;margin-left:auto">' + _escapeHtml(_ghL10DateLabel(g.date)) + '</span></div>';
  if (key == null || (!g.gamePk && !g.date)) return line; // nothing to find that game by
  return line + '<button class="gh-l10-open" onclick="ghL10Open(\'' + key + '\',' + i + ',this)">' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 5 16 12 9 19"/></svg>Open this game</button>';
}

// Tapping a circle shows the score; the button under it goes to that
// game's own screen. The pregame payload carries no id for those older
// games, so one is found the way a stale attached box score already heals
// itself — pull that day's schedule and match on the two team names.
function _ghSameTeamName(a, b) {
  a = String(a || '').toLowerCase().trim();
  b = String(b || '').toLowerCase().trim();
  if (!a || !b) return false;
  return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
}
function _ghL10OpenFailed(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = 'That game isn\'t available — tap to try again';
}
function ghL10Open(key, i, btn) {
  var data = window._gdPregame && window._gdPregame.data;
  var side = data && data[key];
  var g = side && side.last10 && side.last10[i];
  if (!g) return;
  var teamName = side.name || '';
  var oppName = g.oppName || g.opp || '';
  var away = g.home ? oppName : teamName;
  var home = g.home ? teamName : oppName;
  var go = function (gamePk) { openGameScreen(gamePk, away, home, 'mlb', g.date || null); };
  if (g.gamePk) { go(g.gamePk); return; }
  if (!g.date) { _ghL10OpenFailed(btn); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Finding that game…'; }
  fetch('/api/mlb?mode=schedule&date=' + encodeURIComponent(g.date))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var hits = ((d && d.games) || []).filter(function (x) {
        return _ghSameTeamName(x.away, away) && _ghSameTeamName(x.home, home);
      });
      // A doubleheader puts the same matchup on one date twice — the
      // score is what tells the two apart.
      if (hits.length > 1) {
        var byScore = hits.filter(function (x) {
          var us = g.home ? x.homeScore : x.awayScore;
          var them = g.home ? x.awayScore : x.homeScore;
          return us != null && them != null && String(us) === String(g.us) && String(them) === String(g.them);
        });
        if (byScore.length) hits = byScore;
      }
      if (!hits.length || hits[0].gamePk == null) { _ghL10OpenFailed(btn); return; }
      go(hits[0].gamePk);
    })
    .catch(function (err) { console.error('Open past game error:', err); _ghL10OpenFailed(btn); });
}
function _ghLast10Html(m, st, animating) {
  var sel = st && st.l10Sel;
  var h = '<div class="gh-up" style="' + _ghDelay(1.3) + 'display:flex;flex-direction:column;gap:12px">' +
    '<div class="gh-row" style="align-items:baseline"><span class="gh-eyebrow">Last 10</span><span style="font-size:11px;color:#9C95D0">oldest → latest · tap a game</span></div>';
  [['away', m.away], ['home', m.home]].forEach(function (pair, ti) {
    var key = pair[0], s = pair[1];
    var games = s.last10;
    if (!games) return;
    var r = _ghL10Record(games);
    var streakWin = /^W/.test(r.streak);
    var base = 1.45 + ti * 0.08;
    h += '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<span style="font-size:13px;font-weight:800;color:' + s.colors.accent + ';width:36px">' + _escapeHtml(s.abbr) + '</span>' +
        '<span class="gh-sub" style="flex:1">' + _escapeHtml(s.short) + '</span>' +
        '<span id="gh-l10-rec-' + key + '" class="gh-num" style="font-size:17px">' + (animating ? '0–0' : r.rec) + '</span>' +
        (r.streak ? '<span class="gh-tag gh-l10-pop" style="' + _ghDelay(base + games.length * 0.11) + (streakWin ? 'background:rgba(124,242,156,.16);color:#9be8ac' : 'background:rgba(255,122,107,.16);color:#FFC2BA') + '">' + r.streak + '</span>' : '') +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;gap:2px">';
    games.forEach(function (g, i) {
      var win = g.res === 'W';
      var c = _ghTeamColors(g.opp);
      var isSel = sel && sel.side === key && sel.i === i;
      var label = (win ? 'Won ' : 'Lost ') + g.us + ' to ' + g.them + (g.home ? ' vs ' : ' at ') + (g.oppName || g.opp || '') + ', ' + _ghL10DateLabel(g.date);
      h += '<button class="gh-l10-dot gh-l10-pop' + (win ? '' : ' loss') + (isSel ? ' sel' : '') + '" data-side="' + key + '" data-i="' + i + '" onclick="ghL10Pick(this)" aria-label="' + _escapeHtml(label) + '" aria-pressed="' + (isSel ? 'true' : 'false') + '"' +
        ' style="' + _ghDelay(base + i * 0.11) + 'background:' + c.bg + ';color:' + c.fg + ';box-shadow:0 0 0 2px ' + (win ? '#7CF29C' : '#FF7A6B') + '">' + _escapeHtml(g.opp || '?') + '</button>';
    });
    h += '</div><div style="display:flex;justify-content:space-between;gap:2px;margin-top:-4px" aria-hidden="true">';
    games.forEach(function (g, i) {
      h += '<span class="gh-l10-wl gh-l10-pop" style="' + _ghDelay(base + i * 0.11 + 0.05) + 'color:' + (g.res === 'W' ? '#7CF29C' : '#FF9A8E') + '">' + g.res + '</span>';
    });
    var selGame = sel && sel.side === key ? games[sel.i] : null;
    h += '</div><div id="gh-l10-detail-' + key + '" class="gh-l10-detail' + (selGame ? ' on' : '') + '">' + (selGame ? _ghL10DetailInner(selGame, key, sel.i) : '') + '</div></div>';
    if (animating) _ghL10CountUp(key, games, base);
  });
  return h + '</div>';
}
function _ghL10CountUp(key, games, base) {
  if (_ghReducedMotion()) { setTimeout(function () { var el = document.getElementById('gh-l10-rec-' + key); if (el) el.textContent = _ghL10Record(games).rec; }, 0); return; }
  games.forEach(function (g, i) {
    setTimeout(function () {
      var el = document.getElementById('gh-l10-rec-' + key);
      if (el) el.textContent = _ghL10Record(games.slice(0, i + 1)).rec;
    }, Math.round((base + i * 0.11) * 1000) + 120);
  });
}
function ghL10Pick(btn) {
  var st = window._ghState;
  var data = window._gdPregame && window._gdPregame.data;
  if (!st || !data) return;
  var key = btn.getAttribute('data-side'), i = Number(btn.getAttribute('data-i'));
  var games = data[key] && data[key].last10;
  if (!games || !games[i]) return;
  var same = st.l10Sel && st.l10Sel.side === key && st.l10Sel.i === i;
  st.l10Sel = same ? null : { side: key, i: i };
  // Update in place — no re-render, so nothing re-animates
  document.querySelectorAll('#game-sheet-panel .gh-l10-dot.sel').forEach(function (b) { b.classList.remove('sel'); b.setAttribute('aria-pressed', 'false'); });
  ['away', 'home'].forEach(function (k) {
    var d = document.getElementById('gh-l10-detail-' + k);
    if (!d) return;
    var show = st.l10Sel && st.l10Sel.side === k;
    d.className = 'gh-l10-detail' + (show ? ' on' : '');
    d.innerHTML = show ? _ghL10DetailInner(games[i], key, i) : '';
  });
  if (!same) { btn.classList.add('sel'); btn.setAttribute('aria-pressed', 'true'); }
}

// ── LIVE ──────────────────────────────────────────────────────────────
function _ghScoreboard(m, centerHtml, flash, finalMode) {
  var a = m.away, b = m.home;
  var aWin = finalMode && a.score > b.score, bWin = finalMode && b.score > a.score;
  var scoreEl = function (s, isFlash, isWin, isLose) {
    var cls = 'gh-num' + (isFlash ? ' gh-flash' : '') + (isWin ? ' gh-win' : '');
    var big = (a.score >= 100 || b.score >= 100) ? 40 : 52;
    var color = isLose ? '#7F79B0' : ((finalMode && !isWin) || (!finalMode && s.score < (s === a ? b.score : a.score)) ? '#C4BFE8' : '#fff');
    return '<span class="' + cls + '" style="font-size:' + big + 'px;line-height:.95;color:' + color + '">' + (s.score != null ? s.score : '–') + '</span>';
  };
  var sideHtml = function (s, isRight, isFlash, isWin, isLose) {
    var label = isWin ? '<span style="font-size:11.5px;font-weight:800;white-space:nowrap;color:' + s.colors.accent + '">' + _escapeHtml(s.short) + ' win</span>'
      : '<span class="gh-sub" style="white-space:nowrap">' + _escapeHtml(s.short) + '</span>';
    var tap = _tmTapAttrs(m.league || 'mlb', s.id, s.name);
    return '<div' + (tap ? ' class="tm-tap"' + tap : '') + ' style="display:flex;align-items:center;gap:10px;min-width:0;' + (isRight ? 'flex-direction:row-reverse' : '') + (isLose ? ';opacity:.85' : '') + '">' +
      _ghBadge(s, 42) +
      '<div style="display:flex;flex-direction:column;min-width:0;' + (isRight ? 'align-items:flex-end' : '') + '">' + label + scoreEl(s, isFlash, isWin, isLose) + '</div></div>';
  };
  return '<div class="gh-row gh-up" style="' + _ghDelay(.15) + '">' +
    sideHtml(a, false, flash.away, aWin, bWin) + centerHtml + sideHtml(b, true, flash.home, bWin, aWin) + '</div>';
}

function _ghSituationStrip(s) {
  var baseRect = function (x, y, on, delay) {
    var cx = x + 6, cy = y + 6;
    return on
      ? '<rect class="gh-runner" x="' + x + '" y="' + y + '" width="12" height="12" fill="#A89FE8" transform="rotate(45 ' + cx + ' ' + cy + ')" style="animation-delay:' + delay + 's"/>'
      : '<rect x="' + x + '" y="' + y + '" width="12" height="12" fill="none" stroke="#6E68A6" stroke-width="1.5" transform="rotate(45 ' + cx + ' ' + cy + ')"/>';
  };
  var b = s.bases || {};
  var outs = s.outs != null ? s.outs : 0;
  var dots = [0, 1, 2].map(function (i) {
    return i < outs ? '<span style="width:10px;height:10px;border-radius:50%;background:#FF7A6B"></span>'
      : '<span style="width:10px;height:10px;border-radius:50%;border:1.5px solid #6E68A6;box-sizing:border-box"></span>';
  }).join('');
  var runners = [b.first && '1st', b.second && '2nd', b.third && '3rd'].filter(Boolean);
  var runnerText = !runners.length ? 'Bases empty' : (runners.length === 3 ? 'Bases loaded' : 'On ' + runners.join(' & '));
  return '<div class="gh-panel gh-up gh-row" style="' + _ghDelay(.3) + 'gap:14px">' +
    '<svg width="48" height="48" viewBox="0 0 56 56" role="img" aria-label="' + runnerText + '" style="flex-shrink:0">' +
      baseRect(22, 4, b.second, -.35) + baseRect(40, 22, b.first, 0) + baseRect(4, 22, b.third, -.7) +
      '<rect x="24" y="42" width="8" height="8" fill="#6E68A6" transform="rotate(45 28 46)"/></svg>' +
    '<div style="display:flex;flex-direction:column;gap:5px"><span class="gh-eyebrow" style="font-size:9.5px;color:#9C95D0">Outs</span><div style="display:flex;gap:5px">' + dots + '</div></div>' +
    '<div style="display:flex;flex-direction:column;gap:1px"><span class="gh-eyebrow" style="font-size:9.5px;color:#9C95D0">Count</span>' +
      '<span class="gh-num" style="font-size:20px;line-height:1">' + (s.balls != null ? s.balls : 0) + '–' + (s.strikes != null ? s.strikes : 0) + '</span></div>' +
    '<div style="flex:1;text-align:right;font-size:12px;color:#D9D4FA">' + runnerText + '</div>' +
  '</div>';
}

function _ghReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// Highlights mode for the live and final cards (kept per phase in
// _ghState). First render of a game open → 'intro' (unless reduced motion
// or there's nothing to show): the list shows, then flies up and settles
// to 'compact'. Transitional modes re-render as their settled version so a
// refresh never replays them.

// Are you watching or attending the game on screen? (either the choice
// already loaded for this game, or your watching list)
function _ghIsWatchingThis() {
  var g = window._activeBrowseGame;
  if (!g) return false;
  var s = window._gatt;
  if (s && s.mode && String(s.gamePk) === String(g.gamePk)) return true;
  if ((window._watchingList || []).some(function (w) { return String(w.gamePk != null ? w.gamePk : w._id) === String(g.gamePk); })) return true;
  // on a reload the lists above may not be back yet — use the last known list
  try { return (JSON.parse(localStorage.getItem('innings_watching_ids') || '[]')).indexOf(String(g.gamePk)) !== -1; } catch (e) { return false; }
}

function _ghPhaseMode(st, key, playCount) {
  if (!st[key]) {
    // v5.86.0: if you're watching/attending this game, highlights start
    // closed — the Highlights button still opens them.
    var skipIntro = _ghReducedMotion() || !playCount || _ghIsWatchingThis();
    st[key] = skipIntro ? 'compact' : 'intro';
    if (!skipIntro) {
      clearTimeout(st[key + 'Timer']);
      st[key + 'Timer'] = setTimeout(function () { if (st[key] === 'intro') st[key] = 'compact'; }, 4800);
    }
    return st[key];
  }
  if (st[key] === 'opening') return 'open';
  if (st[key] === 'closing') return 'compact';
  return st[key];
}
function _ghLiveMode(st, playCount) { return _ghPhaseMode(st, 'liveMode', playCount); }

function ghToggleHighlights() {
  var st = window._ghState;
  if (!st) return;
  var el = document.querySelector('#game-sheet-panel .gh');
  var phase = el ? el.getAttribute('data-phase') : 'live';
  var key = phase === 'final' ? 'finalMode' : 'liveMode';
  var reduce = _ghReducedMotion();
  var isOpen = st[key] === 'open' || st[key] === 'opening';
  var next = isOpen ? (reduce ? 'compact' : 'closing') : (reduce ? 'open' : 'opening');
  st[key] = next;
  clearTimeout(st[key + 'Timer']);
  if (next === 'closing') st[key + 'Timer'] = setTimeout(function () { if (st[key] === 'closing') st[key] = 'compact'; }, 1000);
  if (next === 'opening') st[key + 'Timer'] = setTimeout(function () { if (st[key] === 'opening') st[key] = 'open'; }, 700);
  st.newSeenAt = Date.now(); // opening the list counts as having seen new plays
  if (!el) { if (typeof renderGameCheatSheet === 'function') renderGameCheatSheet(); return; }
  // Swap classes in place — no re-render, so only the highlight motion runs.
  el.className = el.className.replace(/\bgh-m-[a-z]+\b/, 'gh-m-' + next).replace(/\s*\bgh-anim\b/, '');
  var btn = el.querySelector('.gh-hl-btn');
  if (btn) {
    btn.setAttribute('aria-expanded', (next === 'open' || next === 'opening') ? 'true' : 'false');
    btn.classList.remove('gh-hl-btn-new');
  }
}

function _ghHlButtonHtml(count, expanded, pulse) {
  return '<button class="gh-hl-btn' + (pulse && !expanded ? ' gh-hl-btn-new' : '') + '" onclick="ghToggleHighlights()" aria-expanded="' + expanded + '">Highlights<span class="gh-hl-count">' + count + '</span>' +
    '<svg class="gh-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button>';
}

function _ghPlayKey(p) { return String(p.atBatIndex != null ? p.atBatIndex : (p.inning + p.half + p.text)); }

function _ghLiveHtml(m, st) {
  var s = m.situation || {};
  var plays = m.plays.slice().reverse();
  var seen = st.seenPlays;
  plays.forEach(function (p) {
    var key = _ghPlayKey(p);
    if (seen && !seen[key]) st.newAt[key] = Date.now(); // arrived since the last render
  });
  var recentNew = plays.some(function (p) { var t = st.newAt[_ghPlayKey(p)]; return t && Date.now() - t < 120000 && (!st.newSeenAt || t > st.newSeenAt); });
  var mode = _ghLiveMode(st, plays.length);
  st.renderMode = mode;

  // Header — LIVE chip + highlights toggle
  var expanded = mode === 'open';
  var h = '<div class="gh-row"><span class="gh-chip live"><span class="gh-dot live"></span>LIVE</span>' +
    (plays.length
      ? _ghHlButtonHtml(plays.length, expanded, recentNew)
      : '<span class="gh-meta">' + _escapeHtml((m.status && !/in progress/i.test(m.status)) ? m.status : (m.venue || '')) + '</span>') +
    '</div>';

  // Scoreboard — condenses via the mode class
  var prev = st.lastScore;
  var betweenHalves = s.outs === 3;
  var stateLabel = betweenHalves ? (s.half === 'top' ? 'Mid' : 'End') : (s.half === 'top' ? 'Top' : 'Bot');
  var runners = s.bases || {};
  var miniBase = function (x, y, on, cx, cy) {
    return on ? '<rect x="' + x + '" y="' + y + '" width="12" height="12" fill="#A89FE8" transform="rotate(45 ' + cx + ' ' + cy + ')"/>'
      : '<rect x="' + x + '" y="' + y + '" width="12" height="12" fill="none" stroke="#6E68A6" stroke-width="3" transform="rotate(45 ' + cx + ' ' + cy + ')"/>';
  };
  var outsN = s.outs != null ? s.outs : 0;
  var mini = betweenHalves ? '' : '<div class="gh-mini" aria-hidden="true">' +
    '<svg width="20" height="20" viewBox="0 0 56 56">' + miniBase(22, 4, runners.second, 28, 10) + miniBase(40, 22, runners.first, 46, 28) + miniBase(4, 22, runners.third, 10, 28) + '</svg>' +
    [0, 1, 2].map(function (i) { return i < outsN ? '<span style="width:6px;height:6px;border-radius:50%;background:#FF7A6B"></span>' : '<span style="width:6px;height:6px;border-radius:50%;border:1px solid #6E68A6;box-sizing:border-box"></span>'; }).join('') +
    '<span class="gh-num" style="font-size:13px;margin-left:2px">' + (s.balls != null ? s.balls : 0) + '–' + (s.strikes != null ? s.strikes : 0) + '</span></div>';
  var center = '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0">' +
    (s.inning ? '<div style="display:flex;align-items:center;gap:4px">' +
      (betweenHalves ? '' : '<svg width="10" height="10" viewBox="0 0 10 10">' + (s.half === 'top' ? '<polygon points="5,1 9,8 1,8" fill="#A89FE8"/>' : '<polygon points="1,2 9,2 5,9" fill="#A89FE8"/>') + '</svg>') +
      '<span class="gh-num" style="font-size:22px;line-height:1">' + s.inning + '</span>' +
      '<span class="gh-eyebrow" style="font-size:9.5px;color:#9C95D0;margin-left:2px">' + stateLabel + '</span></div>' : '<span class="gh-eyebrow">Live</span>') +
    mini + '</div>';
  var side = function (t, isRight, flash) {
    var trailing = t.score != null && (t === m.away ? m.home.score : m.away.score) > t.score;
    var tapA = _tmTapAttrs('mlb', t.id, t.name);
    var badge = '<div class="gh-badge gh-sb-badge' + (tapA ? ' tm-tap' : '') + '"' + tapA + ' style="background:' + t.colors.bg + ';color:' + t.colors.fg + '">' + _escapeHtml(t.abbr) + '</div>';
    return '<div style="display:flex;align-items:center;gap:10px;min-width:0;' + (isRight ? 'flex-direction:row-reverse' : '') + '">' + badge +
      '<div style="display:flex;flex-direction:column;min-width:0;' + (isRight ? 'align-items:flex-end' : '') + '">' +
        '<span class="gh-sub gh-sb-name">' + _escapeHtml(t.short) + '</span>' +
        '<span class="gh-num gh-sb-score' + ((m.away.score >= 100 || m.home.score >= 100) ? ' gh-sb3' : '') + '" style="color:' + (trailing ? '#C4BFE8' : '#fff') + '"><span class="' + (flash ? 'gh-flash' : '') + '">' + (t.score != null ? t.score : '–') + '</span></span>' +
      (m.sport === 'football' ? _fbbTimeoutsHtml(m, t === m.away ? 'a' : 'h') : '') +
      '</div></div>';
  };
  h += '<div class="gh-row gh-up" style="' + _ghDelay(.15) + '">' +
    side(m.away, false, !!(prev && prev.away !== m.away.score)) + center + side(m.home, true, !!(prev && prev.home !== m.home.score)) + '</div>';

  // Situation strip (folds away once condensed)
  if (m.situation) {
    h += betweenHalves
      ? '<div class="gh-panel gh-strip" style="text-align:center;font-size:12.5px;color:#D9D4FA">' + (s.half === 'top' ? 'Middle' : 'End') + ' of the ' + _escapeHtml(_ordinalSuffix(s.inning)) + '</div>'
      : _ghSituationStrip(s).replace('class="gh-panel gh-up gh-row"', 'class="gh-panel gh-strip gh-row"').replace(/animation-delay:[\d.]+s;/, ''); // inline delay would override the collapse timing
  }

  h += _ghHighlightsListHtml(m, plays, st, { cap: 8, withNew: true });
  return h;
}

// Shared "Highlights so far" list (newest first) for the live and final
// cards. cap limits rows (live shows 8 + "N earlier"); withNew turns on the
// NEW tag for plays that arrived during this viewing.
function _ghHighlightsListHtml(m, plays, st, opts) {
  opts = opts || {};
  if (!plays.length) return '';
  var shown = opts.cap ? plays.slice(0, opts.cap) : plays;
  // max-height is only the collapse animation's starting point — sized to the list so the fold starts right away
  var h = '<div class="gh-hl" style="max-height:' + (60 + shown.length * 90) + 'px"><div class="gh-hlrow gh-hlhead gh-r0"><span class="gh-eyebrow">' + (opts.title || 'Highlights so far') + '</span>' +
    '<span style="font-size:11.5px;color:#9C95D0">' + plays.length + (plays.length === 1 ? ' scoring play' : ' scoring plays') + '</span></div>';
  shown.forEach(function (p, i) {
    var key = _ghPlayKey(p);
    var t = opts.withNew ? st.newAt[key] : null;
    var isNew = !!t && Date.now() - t < 120000;
    var isTop = i === 0;
    var last = i === shown.length - 1;
    var sub = [p.distance && p.eventType === 'home_run' ? p.distance + ' ft' : '', p.text || ''].filter(Boolean).join(' · ');
    var chip = _ghScoreChip(p, m.away.abbr, m.home.abbr);
    h += '<div class="gh-hlrow gh-r' + Math.min(i + 1, 9) + (isTop ? ' gh-first' : '') + '">' +
      '<div style="width:32px;display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0">' + _ghInningTag(p.half, p.inning, m) +
        (!isTop && !last ? '<span style="flex:1;width:2px;background:rgba(168,159,232,.18);border-radius:1px"></span>' : '') + '</div>' +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding-bottom:6px">' +
        '<div class="gh-row" style="gap:8px"><span style="font-size:13.5px;font-weight:700;min-width:0">' + _escapeHtml(_ghPlayHeadline(p)) + '</span>' +
          (isNew ? '<span class="gh-new">NEW</span>' : '<span class="gh-num" style="font-size:14.5px;white-space:nowrap;color:' + (isTop ? '#fff' : '#D9D4FA') + '">' + _escapeHtml(chip) + '</span>') + '</div>' +
        (isNew && chip ? '<span class="gh-num" style="font-size:14.5px;color:#fff">' + _escapeHtml(chip) + '</span>' : '') +
        (sub ? '<span class="gh-sub gh-clamp" style="line-height:1.4">' + _escapeHtml(sub) + '</span>' : '') +
        (isTop && p.eventType === 'home_run' ? '<div style="position:relative;width:160px;height:26px;margin-top:4px"><svg width="160" height="26" viewBox="0 0 160 26" style="position:absolute;left:0;top:0" aria-hidden="true"><path d="M4 22 Q 80 -10 156 16" fill="none" stroke="#A89FE8" stroke-width="1.5" stroke-dasharray="3 4" opacity=".5"/></svg><span class="gh-fly"></span></div>' : '') +
      '</div></div>';
  });
  if (plays.length > shown.length) h += '<div class="gh-hlrow gh-r9 gh-sub" style="padding-left:56px">+' + (plays.length - shown.length) + ' earlier</div>';
  return h + '</div>';
}

// ── LIVE DETAIL — everything the old live box score card showed, in the
// new card style: at-bat (matchup, strike zone, pitch list), line score,
// play by play (replies + double-tap reactions, same ids/handlers as
// before), and the full box score toggle.

// v5.83.0: the pitcher's game so far, under his season line — small
// TODAY label over four columns: IP · TP (total pitches) · S · B.
function _ghPitcherTodayHtml(t) {
  var cols = [['IP', t.ip], ['TP', t.tp], ['S', t.s], ['B', t.b]].filter(function (c) { return c[1] != null; });
  if (!cols.length) return '';
  return '<span style="font-size:9.5px;font-weight:700;letter-spacing:.12em;color:#9C95D0;margin-top:5px">TODAY</span>' +
    '<span style="display:grid;grid-template-columns:repeat(' + cols.length + ',auto);column-gap:12px;justify-content:start">' +
    cols.map(function (c) { return '<span class="gh-num" style="font-size:12.5px">' + _escapeHtml(String(c[1])) + '</span>'; }).join('') +
    cols.map(function (c) { return '<span style="font-size:9px;font-weight:700;letter-spacing:.06em;color:#9C95D0">' + c[0] + '</span>'; }).join('') + '</span>';
}


// ══ INNING BREAK CARD (v5.91.0) — "Middle of the 1st", "End of the 5th"
// Fills the at-bat square between halves: the score, what the half that
// just ended did (R · H · LOB), and who's due up next. Animates in once
// per break; later refreshes just show it.
function _ghInningBreakHtml(box, m, s) {
  var n = s.inning || 1, mid = s.inningState === 'Middle';
  var inn = (box.innings || [])[n - 1] || {};
  var done = mid ? m.away : m.home, next = mid ? m.home : m.away;
  var R = mid ? inn.away : inn.home, H = mid ? inn.awayH : inn.homeH, L = mid ? inn.awayLob : inn.homeLob;
  var key = (window._activeBrowseGame ? window._activeBrowseGame.gamePk : '') + ':' + n + ':' + s.inningState;
  var seen = window._ibSeen || (window._ibSeen = {});
  var anim = !seen[key] && !(typeof _ghReducedMotion === 'function' && _ghReducedMotion());
  seen[key] = 1;
  var a = function (d) { return anim ? 'animation:ibUp .5s cubic-bezier(.2,.8,.2,1) ' + d + 's both;' : ''; };
  var badge = function (t) { return '<span style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;background:' + t.colors.bg + ';color:' + t.colors.fg + ';box-shadow:0 0 0 3px rgba(255,255,255,.08)">' + _escapeHtml(t.abbr) + '</span>'; };
  var line = [R != null ? R + ' R' : null, H != null ? H + ' H' : null, L != null ? L + ' LOB' : null].filter(Boolean).join(' · ');
  var due = (s.dueUp || []).map(function (x) { return _ghLastName(x); });
  return '<div style="height:220px;box-sizing:border-box;padding:14px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;background:radial-gradient(120% 90% at 50% 0%,rgba(168,159,232,.18),transparent 70%)">' +
    '<span class="gh-eyebrow" style="font-size:11px;color:#D9D4FA;' + a(0) + '">' + (mid ? 'Middle' : 'End') + ' of the ' + _ordinalSuffix(n) + '</span>' +
    '<div style="display:flex;align-items:center;gap:16px;' + a(.08) + '">' + badge(m.away) + '<span class="gh-num" style="font-size:40px">' + (m.away.score != null ? m.away.score : '') + '</span>' +
      '<span style="width:14px;height:2px;background:rgba(168,159,232,.4)"></span><span class="gh-num" style="font-size:40px">' + (m.home.score != null ? m.home.score : '') + '</span>' + badge(m.home) + '</div>' +
    (line ? '<span style="font-size:13px;color:#D9D4FA;' + a(.16) + '"><b style="color:' + done.colors.accent + '">' + _escapeHtml(done.short || done.abbr) + '</b> ' + _escapeHtml(line) + '</span>' : '') +
    (due.length ? '<span style="font-size:12.5px;color:#B9B3E6;' + a(.24) + '">Due up for the ' + _escapeHtml(next.short || next.abbr) + ': <b style="color:#fff">' + _escapeHtml(due.join(', ')) + '</b></span>' : '') +
  '</div>';
}

function _ghLiveDetailHtml(box) {
  var m = _ghModelFromMlbBox(box);
  if (!m) return '';
  if (typeof _paNote === 'function') _paNote(box);
  if (typeof _savGame === 'function' && window._activeBrowseGame && (window._activeBrowseGame.sport || 'mlb') === 'mlb') _savGame(window._activeBrowseGame.gamePk, true);
  var s = box.situation || {};
  var out = '<div class="gh-detail">';
  var sub = 'rgba(255,255,255,.65)';

  // At bat
  var mp = box.matchup && box.matchup.pitcher, mb = box.matchup && box.matchup.batter;
  var seq = box.pitchSequence;
  if (mp || mb || seq) {
    var sitText = s.inning ? ((s.half === 'top' ? 'Top' : 'Bottom') + ' ' + _ordinalSuffix(s.inning) + (s.outs != null && s.outs < 3 ? ' · ' + s.outs + (s.outs === 1 ? ' out' : ' outs') : '')) : '';
    out += '<div class="gh-card"><div class="gh-card-head"><span class="gh-eyebrow">At bat</span><span class="gh-sub">' + _escapeHtml(sitText) + '</span></div>';
    if (mp || mb) {
      var who = function (label, p, right) {
        return '<div style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;' + (right ? 'align-items:flex-end;text-align:right' : '') + '">' +
          '<span class="gh-eyebrow" style="font-size:9.5px;color:#9C95D0">' + label + '</span>' +
          '<span style="font-size:15px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">' + _clickablePlayerNameHtml(p, 'mlb') + '</span>' +
          (p && p.line ? '<span style="font-size:12px;color:#CECBF6">' + _escapeHtml(p.line) + '</span>' : '') +
          (!right && p && p.today ? _ghPitcherTodayHtml(p.today) : '') +
          (right && abStarted && typeof _bvpColsHtml === 'function' ? _bvpColsHtml(mb, mp) : '') + '</div>';
      };
      // v5.90.0: career batter-vs-pitcher sits centered until the first pitch
      // of the at-bat, then moves under the batter, lined up with the
      // pitcher's TODAY numbers.
      var abStarted = !!(seq && seq.pitches && seq.pitches.length);
      out += '<div class="gh-row" style="align-items:center;margin-bottom:' + (seq ? '14px' : '0') + '">' + who('Pitching', mp, false) +
        '<span style="font-size:11px;font-weight:800;color:#9C95D0;flex-shrink:0">VS</span>' + who('At bat', mb, true) + '</div>' + (!abStarted && typeof _bvpLineHtml === 'function' ? _bvpLineHtml(mb, mp) : '');
    }
    if (seq) {
      var lastP = seq.pitches.length ? seq.pitches[seq.pitches.length - 1] : null;
      var flyE = typeof _livePitchAnimE === 'function' ? _livePitchAnimE(seq) : null;
      var parts = _strikeZoneSectionHtml(flyE != null ? Object.assign({}, seq, { pitches: seq.pitches.slice(0, -1) }) : seq, 'rgba(255,255,255,.1)', sub, '#fff', true);
      var svg = parts.svg;
      if (flyE != null && lastP) svg = svg.replace(/<\/svg>$/, _pitchFlightSvg(lastP, 0, flyE, seq.pitchHand, 'live') + '</svg>');
      // v5.91.0: between halves the square becomes the inning-break card
      var brk = !!(s && (s.inningState === 'Middle' || s.inningState === 'End'));
      if (brk && typeof _ghInningBreakHtml === 'function') svg = _ghInningBreakHtml(box, m, s);
      if (lastP && !_ghReducedMotion()) {
        svg = svg.replace(/<\/svg>$/, '<circle class="gh-ring-pitch" cx="' + _szX(lastP.px).toFixed(1) + '" cy="' + _szY(lastP.pz).toFixed(1) + '" r="10.5" fill="none" stroke="' + _pitchCallColor(lastP.call) + '" stroke-width="3"/></svg>');
      }
      // v5.70.0: the square is also where the last play animates (#gh-pa-slot,
      // filled after each render so a refresh picks the animation up mid-way).
      // Tap a play in the play-by-play to replay it here.
      // v6.0.0: count panel, purple zone glow, play label above the square
      // and the Statcast strip under it.
      if (!brk) { out += _bbCountHtml(s) + (typeof _absLeftHtml === 'function' ? _absLeftHtml(box) : ''); svg = _bbZoneGlow(svg, seq); if (typeof _absZoneMarks === 'function') svg = _absZoneMarks(svg, seq.pitches); }
      out += '<div id="gh-pa-label" class="pa-lab"></div>';
      out += '<div style="position:relative;border-radius:16px;overflow:hidden;background:rgba(13,8,32,.45);border:1px solid rgba(168,159,232,.12)">' + svg + '<div id="gh-pa-slot"></div>' + (!brk && typeof _absNoticeHtml === 'function' ? _absNoticeHtml(seq, box, s) : '') + '</div>';
      out += '<div id="gh-pa-stats" class="pa-sc"></div>';
      if (!brk && seq.pitches.length) {
        out += '<div style="display:flex;flex-direction:column;gap:6px;margin-top:12px">' + seq.pitches.slice().reverse().map(function (p) {
          var c = _pitchCallColor(p.call);
          return '<div style="display:flex;align-items:center;gap:10px;min-height:26px">' +
            '<span style="width:20px;height:20px;border-radius:50%;background:' + c + ';color:#0D0820;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + p.num + '</span>' +
            (p.speed ? '<span class="gh-num" style="font-size:14px;flex-shrink:0">' + p.speed + ' mph</span>' : '') +
            '<span style="font-size:13px;color:#D9D4FA;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(p.type || '') + '</span>' +
            (typeof _savPitchExtrasHtml === 'function' ? _savPitchExtrasHtml(p, seq, window._activeBrowseGame && window._activeBrowseGame.gamePk) : '') +
            (p.call ? '<span style="font-size:11.5px;font-weight:700;color:' + c + ';flex-shrink:0;filter:brightness(1.25)">' + _escapeHtml(p.call) + '</span>' : '') + '</div>' + (typeof _absLineHtml === 'function' ? _absLineHtml(p, box, s.half) : '');
        }).join('') + '</div>' + (typeof _savVeloNoteHtml === 'function' ? _savVeloNoteHtml(seq) : '');
      } else if (!brk) {
        out += '<div class="gh-sub" style="margin-top:12px">No pitches yet this at-bat</div>';
      }
      if (!brk) out += '<div style="display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:12px;font-size:11px;color:#B9B3E6">' +
        ['Ball', 'Strike', 'In play'].map(function (label) {
          return '<span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:' + _pitchCallColor(label) + '"></span>' + label + '</span>';
        }).join('') + '</div>';
    }
    out += '</div>';
  }

  // Line score
  var inns = box.innings || [];
  if (inns.length) {
    var n = Math.max(inns.length, 9);
    var cols = 'grid-template-columns:38px repeat(' + n + ',minmax(0,1fr)) repeat(3,24px)';
    var curIdx = s.inning ? s.inning - 1 : -1;
    var cell = function (txt, idx, bright, extra) {
      var cur = idx === curIdx;
      return '<span style="' + (cur ? 'background:rgba(168,159,232,.14);border-radius:6px;' : '') + (bright ? 'color:#fff;' : '') + (extra || '') + '">' + txt + '</span>';
    };
    var head = '<span></span>';
    for (var i = 0; i < n; i++) head += cell((inns[i] && inns[i].num != null) ? inns[i].num : i + 1, i, i === curIdx);
    head += '<span style="border-left:1px solid rgba(168,159,232,.22);color:#D9D4FA">R</span><span style="color:#D9D4FA">H</span><span style="color:#D9D4FA">E</span>';
    var teamRow = function (t, key) {
      var r = '<span style="text-align:left;color:' + t.colors.accent + '">' + _escapeHtml(t.abbr) + '</span>';
      for (var j = 0; j < n; j++) {
        var v = inns[j] ? inns[j][key] : null;
        r += cell(v != null ? v : '', j, v > 0 || j === curIdx);
      }
      r += '<span style="border-left:1px solid rgba(168,159,232,.22);color:#fff">' + (t.score != null ? t.score : '') + '</span>' +
        '<span style="color:#F5F3FF">' + (t.hits != null ? t.hits : '') + '</span><span style="color:#F5F3FF">' + (t.errors != null ? t.errors : '') + '</span>';
      return '<div class="gh-ls gh-num" style="' + cols + ';height:24px;font-size:' + (n > 10 ? 12.5 : 14) + 'px;color:#9C95D0">' + r + '</div>';
    };
    out += '<div class="gh-card" style="padding:14px 16px"><div class="gh-eyebrow" style="margin-bottom:8px">Line score</div>' +
      '<div style="overflow-x:auto"><div style="min-width:' + (38 + n * 20 + 72) + 'px;display:flex;flex-direction:column;gap:4px">' +
      '<div class="gh-ls gh-num" style="' + cols + ';height:18px;font-size:11px;color:#9C95D0">' + head + '</div>' +
      teamRow(m.away, 'away') + teamRow(m.home, 'home') + '</div></div></div>';
  }

  // Play by play, grouped into half-innings (v5.49.0)
  out += _ghPlaysByInningHtml(box);

  // Full box score (same expand/team-toggle state as before)
  var detailHtml = _boxScoreDetailSectionHtml(box.boxScoreDetail, box.away, box.home, 'rgba(255,255,255,.08)', sub, '#fff', true);
  if (detailHtml) out += '<div class="gh-card">' + detailHtml + '</div>';

  if (box.venue) {
    out += '<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#9C95D0;padding:0 4px"><i class="ti ti-map-pin"></i>' + _escapeHtml(box.venue) + '</div>';
  }
  return out + '</div>';
}

// ── PLAY BY PLAY, BY INNING (v5.49.0) ─────────────────────────────────
// Every play the box score carries, grouped into half-innings and left in
// the order the game was played. Each half-inning is a row you can open;
// the one the game is in (or ended on) starts open, and whatever the
// reader opens after that is remembered across live-refresh ticks.
//
// Runs come off the linescore rather than off the plays, so a header is
// right even for a half-inning whose plays aren't in this payload.
//
// Reads box.allPlays when the API sends the full game and falls back to
// box.recentPlays, which only carries the last handful. On that fallback
// only the half-innings actually covered are listed, so a finished game
// shows five plays in two innings rather than eighteen empty rows.
function _ghHalfLabel(half, inning) {
  return (half === 'top' ? 'Top ' : 'Bottom ') + _ordinalSuffix(inning);
}
function _ghPlaysByInningHtml(box, bare) {
  var m = _ghModelFromMlbBox(box);
  if (!m) return '';
  var full = !!(box.allPlays && box.allPlays.length);
  var plays = full ? box.allPlays : (box.recentPlays || []);
  if (!plays.length) return '';
  var innings = box.innings || [];
  var groups = {}, keys = [];
  var group = function (inning, half) {
    var k = inning + (half === 'top' ? 'T' : 'B');
    if (!groups[k]) { groups[k] = { inning: inning, half: half, plays: [] }; keys.push(k); }
    return groups[k];
  };
  if (full) {
    innings.forEach(function (inn, idx) {
      var num = inn.num != null ? inn.num : idx + 1;
      group(num, 'top');
      if (inn.home != null) group(num, 'bottom'); // a walk-off home half never gets played
    });
  }
  plays.forEach(function (pl) {
    if (!pl.inning) return;
    group(pl.inning, pl.half === 'top' ? 'top' : 'bottom').plays.push(pl);
  });
  if (!keys.length) return '';
  keys.sort(function (a, b) {
    var A = groups[a], B = groups[b];
    return (A.inning - B.inning) || ((A.half === 'top' ? 0 : 1) - (B.half === 'top' ? 0 : 1));
  });
  var runsIn = function (inning, half) {
    for (var i = 0; i < innings.length; i++) {
      var num = innings[i].num != null ? innings[i].num : i + 1;
      if (num === inning) return half === 'top' ? innings[i].away : innings[i].home;
    }
    return null;
  };
  var sit = box.situation || {};
  var liveKey = sit.inning ? (sit.inning + (sit.half === 'top' ? 'T' : 'B')) : null;
  var startOpen = (liveKey && groups[liveKey]) ? liveKey : keys[keys.length - 1];
  var open = window._ghInningOpen = window._ghInningOpen || {};
  var playIds = [];
  var rows = '';
  // Live games list the current half-inning first (v5.66.1); finals keep
  // reading top of the 1st down to the last out.
  if (m.phase === 'live') keys.reverse();

  keys.forEach(function (k) {
    var grp = groups[k];
    var batting = grp.half === 'top' ? m.away : m.home;
    var runs = runsIn(grp.inning, grp.half);
    var isOpen = open[k] != null ? !!open[k] : (k === startOpen);
    rows += '<div style="border-top:.5px solid rgba(255,255,255,.07)">' +
      '<button onclick="ghInningToggle(\'' + k + '\',this)" aria-expanded="' + (isOpen ? 'true' : 'false') + '" aria-controls="gh-inn-' + k + '" ' +
        'style="width:100%;display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 0;background:none;border:0;color:#fff;font-family:inherit;text-align:left;cursor:pointer">' +
        '<svg data-chev width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#B9B3E6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;transition:transform .18s ease' + (isOpen ? ';transform:rotate(90deg)' : '') + '"><polyline points="9 5 16 12 9 19"/></svg>' +
        '<span class="gh-tag" style="background:' + _ghHexAlpha(batting.colors.accent, .2) + ';color:' + batting.colors.accent + '">' + (grp.half === 'top' ? 'T' : 'B') + grp.inning + '</span>' +
        '<span style="flex:1;min-width:0;font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(_ghHalfLabel(grp.half, grp.inning)) +
          '<span class="gh-sub" style="font-weight:400"> · ' + _escapeHtml(batting.short || batting.abbr) + '</span></span>' +
        (runs > 0 ? '<span class="gh-tag" style="background:rgba(124,242,156,.16);color:#9be8ac">' + runs + (runs === 1 ? ' run' : ' runs') + '</span>' : '') +
      '</button>' +
      '<div id="gh-inn-' + k + '" style="display:' + (isOpen ? 'flex' : 'none') + ';flex-direction:column;padding-bottom:6px">';

    var ordered = grp.plays.slice();
    // atBatIndex is the game's own play order — only trust it to sort when
    // every play in the half-inning carries one.
    if (ordered.length && ordered.every(function (pl) { return pl.atBatIndex != null; })) {
      ordered.sort(function (a, b) { return a.atBatIndex - b.atBatIndex; });
    }
    if (!ordered.length) rows += '<div class="gh-sub" style="padding:2px 0 8px 21px">No plays yet.</div>';
    ordered.forEach(function (pl, idx) {
      var tag = pl.tag != null ? pl.tag : ((pl.half === 'top' ? 'T' : 'B') + (pl.inning || ''));
      var idPart = pl.atBatIndex != null ? pl.atBatIndex : (pl.playId != null ? pl.playId : (k + '_' + idx));
      var playId = box.gamePk != null ? (box.gamePk + '_' + idPart) : null;
      if (playId && isOpen) playIds.push(playId); // only what's on screen gets a read
      var chip = (pl.awayScore != null && pl.homeScore != null) ? _ghScoreChip(pl, m.away.abbr, m.home.abbr) : '';
      var rowAttrs = playId
        ? ' onclick="_playDoubleTap(this,\'' + playId + '\',this.dataset.rtag,this.dataset.rtext)" data-rtag="' + _escapeHtml(tag) + '" data-rtext="' + _escapeHtml(pl.text) + '"'
        : '';
      rows += '<div class="gh-plays-row"' + rowAttrs + ' style="border-top:0;padding:6px 0 6px 21px">' +
        '<div style="display:flex;gap:10px;align-items:flex-start">' +
          '<span style="flex:1;font-size:13px;line-height:1.45;color:#F5F3FF">' + _escapeHtml(pl.text) + '</span>' +
          (chip ? '<span class="gh-num" style="font-size:12px;color:#D9D4FA;flex-shrink:0;white-space:nowrap">' + _escapeHtml(chip) + '</span>' : '') +
          '<button class="gh-reply" aria-label="Reply to this play" data-tag="' + _escapeHtml(tag) + '" data-text="' + _escapeHtml(pl.text) + '" onclick="event.stopPropagation();_replyToPlay(this.dataset.tag,this.dataset.text)">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14l-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 0 8h-1"/></svg></button>' +
        '</div>' +
        (typeof _ruleChipHtml === 'function' ? _ruleChipHtml('mlb', pl.text) : '') +
        (playId ? '<div id="play-react-' + _escapeHtml(playId) + '"></div>' : '') +
        '</div>';
    });
    rows += '</div></div>';
  });

  if (playIds.length) setTimeout(function () { _loadPlayReactions(playIds); }, 0);
  var head = '<div class="gh-card-head" style="margin-bottom:2px"><span class="gh-eyebrow">Play by play</span>' +
    '<span style="font-size:11px;color:#9C95D0">' + (full ? 'Double-tap a play to react' : 'Latest plays only') + '</span></div>';
  if (bare) return '<div style="margin-top:10px;padding-top:10px;border-top:0.5px solid rgba(255,255,255,.1)">' + head + rows + '</div>';
  return '<div class="gh-card" style="padding-bottom:10px">' + head + rows + '</div>';
}

// Opened and closed in the DOM rather than through a re-render, so a live
// tick mid-read can't collapse what someone is looking at.
function ghInningToggle(key, btn) {
  var body = document.getElementById('gh-inn-' + key);
  if (!body || !btn) return;
  var wasOpen = body.style.display !== 'none';
  body.style.display = wasOpen ? 'none' : 'flex';
  btn.setAttribute('aria-expanded', wasOpen ? 'false' : 'true');
  var chev = btn.querySelector('[data-chev]');
  if (chev) chev.style.transform = wasOpen ? '' : 'rotate(90deg)';
  (window._ghInningOpen = window._ghInningOpen || {})[key] = !wasOpen;
  // Reactions are only fetched for what's on screen, so a half-inning
  // opened for the first time has to ask for its own.
  if (!wasOpen) {
    var ids = [];
    body.querySelectorAll('[id^="play-react-"]').forEach(function (el) {
      if (!el.innerHTML) ids.push(el.id.slice('play-react-'.length));
    });
    if (ids.length) _loadPlayReactions(ids);
  }
}

// ── FINAL ─────────────────────────────────────────────────────────────
// Recap sentence built from the scoring plays: the play that put the
// winner ahead for good, and the last insurance run after it.
function _ghRecap(m) {
  var a = m.away, b = m.home;
  if (a.score == null || b.score == null || a.score === b.score) return '';
  var winKey = a.score > b.score ? 'away' : 'home';
  var W = winKey === 'away' ? a : b, L = winKey === 'away' ? b : a;
  var plays = m.plays.filter(function (p) { return p.awayScore != null && p.homeScore != null; });
  var lead = function (p) { return winKey === 'away' ? p.awayScore - p.homeScore : p.homeScore - p.awayScore; };
  var decisive = -1;
  for (var i = plays.length - 1; i >= 0; i--) {
    if (lead(plays[i]) > 0) decisive = i; else break;
  }
  if (decisive < 0) return 'The ' + W.short + ' beat the ' + L.short + ' ' + W.score + '–' + L.score + '.';
  var p = plays[decisive];
  var before = decisive > 0 ? plays[decisive - 1] : { awayScore: 0, homeScore: 0 };
  var wB = winKey === 'away' ? before.awayScore : before.homeScore;
  var lB = winKey === 'away' ? before.homeScore : before.awayScore;
  var who = p.batter && (p.rbi || p.eventType === 'home_run') ? _ghLastName(p.batter) + '\u2019s ' + _ghPlayLabel(p) : _ghArticle(_ghPlayLabel(p)) + ' ' + _ghPlayLabel(p);
  var inn = 'the ' + _ordinalSuffix(p.inning);
  var s1;
  var walkoff = winKey === 'home' && p.half === 'bottom' && p.inning >= 9 && decisive === plays.length - 1;
  if (walkoff) s1 = (p.batter ? _ghLastName(p.batter) : 'The ' + W.short) + ' walked it off with ' + _ghArticle(_ghPlayLabel(p)) + ' ' + _ghPlayLabel(p) + ' in ' + inn + '.';
  else if (wB < lB) s1 = 'Down ' + lB + '–' + wB + ' in ' + inn + ', ' + who + ' flipped it.';
  else if (wB === lB && wB > 0) s1 = 'Tied ' + wB + '–' + lB + ' in ' + inn + ', ' + who + ' put the ' + W.short + ' ahead for good.';
  else s1 = who.charAt(0).toUpperCase() + who.slice(1) + ' in ' + inn + ' put the ' + W.short + ' ahead for good.';
  var s2 = '';
  for (var j = plays.length - 1; j > decisive; j--) {
    var q = plays[j];
    var scorer = q.half === 'top' ? 'away' : 'home';
    if (scorer === winKey && q.batter && (q.rbi || q.eventType === 'home_run')) {
      s2 = ' ' + _ghLastName(q.batter) + '\u2019s ' + _ghPlayLabel(q) + ' in the ' + _ordinalSuffix(q.inning) + ' added insurance.';
      break;
    }
  }
  return s1 + s2;
}

function _ghKeyMoments(m) {
  var a = m.away, b = m.home;
  var plays = m.plays;
  if (!plays.length) return [];
  var winKey = a.score > b.score ? 'away' : 'home';
  var lead = function (p) { return winKey === 'away' ? p.awayScore - p.homeScore : p.homeScore - p.awayScore; };
  var decisive = -1;
  for (var i = plays.length - 1; i >= 0; i--) { if (lead(plays[i]) > 0) decisive = i; else break; }
  var picks = {};
  if (decisive >= 0) picks[decisive] = true;
  var ranked = plays.map(function (p, idx) { return { idx: idx, w: (p.eventType === 'home_run' ? 3 : 0) + (p.rbi || 0) }; })
    .sort(function (x, y) { return y.w - x.w || y.idx - x.idx; });
  ranked.forEach(function (r) { if (Object.keys(picks).length < 3 && r.w >= 2) picks[r.idx] = true; });
  if (Object.keys(picks).length < 3 && plays.length) picks[plays.length - 1] = true;
  return Object.keys(picks).map(Number).sort(function (x, y) { return x - y; }).map(function (idx) { return plays[idx]; });
}

function _ghFinalHtml(m, st) {
  var a = m.away, b = m.home, reel = '';
  var allPlays = m.plays.slice().reverse();
  var fMode = _ghPhaseMode(st, 'finalMode', allPlays.length);
  st.finalRenderMode = fMode;
  var winner = a.score > b.score ? a : (b.score > a.score ? b : null);
  var h = '';
  if (winner) {
    var sparkColors = [winner.colors.accent, '#A89FE8', '#E9E5FF'];
    var winRight = winner === b;
    [[.9, 0, 70], [1.4, 8, 84], [1.1, 16, 66], [1.8, 24, 90], [2.3, 12, 100], [2.7, 28, 60], [3.1, 4, 96], [3.5, 20, 78]].forEach(function (sp, i) {
      h += '<span class="gh-spark" style="' + (winRight ? 'right:' : 'left:') + (6 + sp[1]) + '%;top:' + sp[2] + 'px;background:' + sparkColors[i % 3] + ';' + _ghDelay(sp[0]) + '"></span>';
    });
  }
  h += _ghHeader('final', '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D9D4FA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>' + (/final|game over/i.test(m.status || 'final') ? 'GAME OVER' : _escapeHtml(String(m.status).toUpperCase())), m.venue || '',
    allPlays.length ? ((reel = (typeof _reelHtml === 'function' ? _reelHtml(m) : '')) ? _reelBtnHtml(allPlays.length) : _ghHlButtonHtml(allPlays.length, fMode === 'open', false)) : ''); // highlights button takes the venue's spot
  var extra = m.innings.length > 9 ? '<span class="gh-sub" style="font-weight:700">' + m.innings.length + ' inn</span>' : '';
  var center = '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0"><span class="gh-stamp gh-stamp-in">FINAL</span>' + extra + '</div>';
  h += _ghScoreboard(m, center, { away: false, home: false }, true);
  h += reel ? reel : _ghHighlightsListHtml(m, allPlays, st, { title: 'Every scoring play' });

  var recap = _ghRecap(m);
  if (recap) h += '<p class="gh-up" style="' + _ghDelay(.8) + 'margin:0;font-size:13.5px;line-height:1.5;color:#D9D4FA">' + _escapeHtml(recap) + '</p>';

  if (m.innings.length) {
    var n = m.innings.length;
    var cols = 'grid-template-columns:34px repeat(' + n + ',minmax(0,1fr)) repeat(3,minmax(18px,1fr))';
    var fs = n > 10 ? 13 : 15;
    var cell = function (v, delay, bright, color, first) {
      return '<span class="gh-pop" style="' + _ghDelay(delay) + (first ? 'border-left:1px solid rgba(168,159,232,.22);' : '') + (bright ? 'font-weight:800;color:' + (color || '#fff') : 'color:#9C95D0') + '">' + v + '</span>';
    };
    var row = function (s, key, offs) {
      var out = '<span style="text-align:left;font-weight:800;color:' + s.colors.accent + '">' + _escapeHtml(s.abbr) + '</span>';
      m.innings.forEach(function (inn, i) {
        var v = inn[key];
        var txt = v != null ? v : ((key === 'home' && i === n - 1 && b.score > a.score) ? 'x' : '');
        out += cell(txt, .9 + i * .08 + offs, v > 0, v > 1 ? s.colors.accent : '#fff');
      });
      var d = .95 + n * .08 + offs;
      out += cell(s.score != null ? s.score : '', d, true, '#fff', true) + cell(s.hits != null ? s.hits : '', d, s === winner, '#F4F1FF') + cell(s.errors != null ? s.errors : '', d, s === winner, '#F4F1FF');
      return '<div class="gh-ls gh-num" style="' + cols + ';height:24px;font-size:' + fs + 'px">' + out + '</div>';
    };
    var head = '<span></span>' + m.innings.map(function (inn, i) { return '<span>' + (inn.num != null ? inn.num : i + 1) + '</span>'; }).join('') +
      '<span style="color:#D9D4FA;border-left:1px solid rgba(168,159,232,.22)">R</span><span style="color:#D9D4FA">H</span><span style="color:#D9D4FA">E</span>';
    h += '<div class="gh-panel gh-up" style="' + _ghDelay(.9) + 'padding:8px 12px;display:flex;flex-direction:column;gap:2px;overflow-x:auto">' +
      '<div class="gh-ls gh-num" style="' + cols + ';height:18px;font-size:11.5px;color:#9C95D0">' + head + '</div>' +
      row(a, 'away', 0) + row(b, 'home', .05) + '</div>';
  }

  var d = m.decisions;
  var dec = function (letter, color, p, fallbackName, isSave) {
    var name = p ? p.name : fallbackName;
    if (!name) return '';
    var rec = p && p.rec ? ' (' + p.rec + ')' : '';
    return '<span style="white-space:nowrap"><span style="font-weight:800;color:' + color + '">' + letter + '</span> ' + _escapeHtml(_ghLastName(name) + rec) + '</span>';
  };
  var decHtml = [
    dec('W', winner ? winner.colors.accent : '#A89FE8', d && d.winner, m.fallbackDecisions.w),
    dec('L', '#9C95D0', d && d.loser, m.fallbackDecisions.l),
    dec('S', '#A89FE8', d && d.save, m.fallbackDecisions.s, true)
  ].filter(Boolean).join('');
  if (decHtml) h += '<div class="gh-up" style="' + _ghDelay(1.1) + 'display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px">' + decHtml + '</div>';

  if (m.star && m.star.name) {
    var starSide = m.star.side === 'away' ? a : (m.star.side === 'home' ? b : (winner || b));
    var c = starSide.colors;
    h += '<div class="gh-up gh-shimmer" style="' + _ghDelay(1.25) + 'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:' + _ghHexAlpha(c.accent, .1) + ';border:1px solid ' + _ghHexAlpha(c.accent, .3) + '">' +
      '<div class="gh-badge" style="width:42px;height:42px;background:' + c.bg + ';color:' + c.fg + ';font-size:15px">' + _escapeHtml(_ghInitials(m.star.name)) + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0">' +
        '<span class="gh-eyebrow" style="font-size:9.5px;color:' + c.accent + '">Star of the game</span>' +
        '<span style="font-size:14.5px;font-weight:700">' + _clickablePlayerNameHtml({ name: m.star.name, id: m.star.id }, 'mlb') + '</span>' +
        (m.star.summary ? '<span style="font-size:12px;color:#D9D4FA">' + _escapeHtml(m.star.summary) + '</span>' : '') + '</div>' +
      '<i class="ti ti-star" style="font-size:20px;color:' + c.accent + '"></i></div>';
  }

  var moments = _ghKeyMoments(m);
  if (moments.length) {
    h += '<div style="display:flex;flex-direction:column;gap:8px"><span class="gh-eyebrow gh-up" style="' + _ghDelay(1.4) + '">Moments that decided it</span>';
    moments.forEach(function (p, i) {
      h += '<div class="gh-up" style="' + _ghDelay(1.5 + i * .1) + 'display:flex;align-items:center;gap:10px">' + _ghInningTag(p.half, p.inning, m) +
        '<span style="font-size:13.5px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(_ghPlayHeadline(p)) + '</span>' +
        '<span class="gh-num" style="font-size:14.5px;white-space:nowrap">' + _escapeHtml(_ghScoreChip(p, a.abbr, b.abbr)) + '</span></div>';
    });
    h += '</div>';
  }
  return h;
}

// ── ENTRY POINT — called by renderGameCheatSheet on every render ──────
function _ghHtmlForState(state) {
  var game = window._activeBrowseGame;
  if (!state || !game) return '';
  if ((game.sport || 'mlb') !== 'mlb') return typeof _gxHtmlForState === 'function' ? _gxHtmlForState(state) : '';
  var st = window._ghState;
  if (!st || st.gamePk != game.gamePk) { _ghResetForGame(game.gamePk); st = window._ghState; }
  var model = _ghModelFromMlbBox(state.heroBox) || _ghModelFromMlbPregame(state.data && (state.data.league || 'mlb') === 'mlb' ? state.data : null);
  if (!model) return '';
  _gattNoteModel(model);

  var body;
  try {
    if (model.phase === 'pre') body = _ghPreHtml(model, st, !st.animated.pre);
    else if (model.phase === 'live') body = _ghLiveHtml(model, st);
    else body = _ghFinalHtml(model, st);
  } catch (err) {
    console.error('[gh] hero render failed:', err);
    return '';
  }
  var animate = !st.animated[model.phase];
  st.animated[model.phase] = true;
  if (model.phase !== 'pre' && window._ghCountdownTimer) { clearInterval(window._ghCountdownTimer); window._ghCountdownTimer = null; }
  if (model.phase === 'pre' && model.startTime && !window._ghCountdownTimer) setTimeout(function () { _ghStartCountdown(model.startTime); }, 0);
  if (model.phase !== 'pre') {
    var seen = {};
    (model.plays || []).forEach(function (p) { seen[String(p.atBatIndex != null ? p.atBatIndex : (p.inning + p.half + p.text))] = true; });
    st.seenPlays = seen;
    st.lastScore = { away: model.away.score, home: model.home.score };
  }
  var modeCls = model.phase === 'live' ? ' gh-m-' + (st.renderMode || 'compact')
    : (model.phase === 'final' ? ' gh-m-' + (st.finalRenderMode || 'compact') : '');
  return '<div class="gh' + (animate ? ' gh-anim' : '') + modeCls + '" data-phase="' + model.phase + '">' +
    '<div class="gh-orb" style="' + (model.phase === 'live' ? 'right:-90px;top:-40px' : 'left:-80px;top:-30px') + '"></div>' +
    '<div class="gh-body">' + body + '</div></div>';
}

// ══════════════════════════════════════════════════════════════════════
// MULTI-SPORT GAME HERO (v5.44.0) — football (NFL/CFB), basketball
// (NBA/WNBA), hockey (NHL) and soccer (MLS/NWSL) on the game screen, in
// the same style as the MLB hero. Data: /api/espn?mode=gamecast and
// /api/nhlgame?mode=gamecast, both returning one normalized model kept in
// window._gdPregame.gx. Reuses the _gh* helpers, CSS and highlight modes
// (intro fly-up → compact, Highlights button) from the MLB build.
// Leagues that share a sport share the same design.
