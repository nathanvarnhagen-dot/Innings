// ══ MULTI VIEW (v7.38.0) ══════════════════════════════════════════════
// Up to four live games on one board — any sport, side by side. Each tile
// is a game: the score, where it stands (count and runners, down and
// distance, who's ahead), who's up, and which friends are in its room. A
// tile turns gold for a minute and a half when that game scores. Tap a tile
// to open the game.
//
// Three ways in:
//   · Games (the league picker): the first tile, left of MLB
//   · inside a game: pull the scoreboard down, "Multi view" sits on top
//   · Home: if the app is reloaded while Multi view is up, the board is the
//     first thing on Home until it's closed or every game on it has ended
//
// The board fills itself with whatever's live (your friends' games first)
// until you edit it; from then on it's exactly the games you picked. It's
// saved on this device (localStorage), not in the cloud.
//
// Everything on a tile is real: it comes from the same schedule feeds Home's
// "Live now" list reads (js/core/glass.js), which carry the count, runners
// and batter for baseball (api/mlb.js) and down & distance + the last play
// for football (api/espn.js). Whatever a feed doesn't send is left off.

var MV_KEY = 'innings_multi_v1', MV_MAX = 4, MV_FLAG_MS = 90000, MV_TICK_MS = 20000;
window._mv = window._mv || { st: null, sched: null, at: 0, loaded: false, loading: null, edit: false, prev: {}, flags: {}, timer: null, shown: [], also: [] };

var MV_ICON = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="2" y="2" width="6.5" height="6.5" rx="2"/><rect x="11.5" y="2" width="6.5" height="6.5" rx="2"/><rect x="2" y="11.5" width="6.5" height="6.5" rx="2"/><rect x="11.5" y="11.5" width="6.5" height="6.5" rx="2"/></svg>';
var MV_CHEV = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>';
var MV_X = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>';

// ── small helpers ──
function _mv$(id) { return document.getElementById(id); }
function _mvEsc(s) {
  s = s == null ? '' : String(s);
  return typeof _escapeHtml === 'function' ? _escapeHtml(s) : s.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}
function _mvToday() { return typeof _todayLocal === 'function' ? _todayLocal() : new Date().toISOString().slice(0, 10); }
function _mvKey(sport, gamePk) { return sport + ':' + gamePk; }
function _mvActive() { var el = _mv$('screen-multi'); return !!(el && el.classList.contains('active')); }
function _mvLook(sport, name, abbr, color, alt) {
  try { if (typeof _teamLook === 'function') return _teamLook(sport, name, abbr, color, alt); } catch (e) {}
  return { abbr: abbr || String(name || '').slice(0, 3).toUpperCase(), bg: '#3D3580', fg: '#FFFFFF', accent: '#A89FE8' };
}
function _mvLeague(sport) {
  var s = (typeof GAMES_SPORTS !== 'undefined' ? GAMES_SPORTS : []).filter(function (x) { return x.key === sport; })[0];
  return s ? (s.key === 'cfb' ? 'CFB' : s.name) : String(sport || '').toUpperCase();
}
function _mvLast(full) {
  var p = String(full || '').trim().split(/\s+/);
  return p.length > 1 ? p.slice(1).join(' ') : p[0];
}
function _mvIsLive(sport, g) {
  if (!g) return false;
  if (g.state) return g.state === 'in';
  return typeof _isGameStatusLive === 'function' && !(typeof _isGameConcluded === 'function' && _isGameConcluded(g.status)) && _isGameStatusLive(g.status);
}
function _mvPhase(sport, g) {
  if (_mvIsLive(sport, g)) return 'live';
  if (g.state) return g.state === 'post' ? 'post' : 'pre';
  return typeof _isGameConcluded === 'function' && _isGameConcluded(g.status) ? 'post' : 'pre';
}
// Which friends are in a game's room (same lists Home reads)
function _mvFriends(gamePk) {
  var key = String(gamePk);
  var by = (window._friendsWatchingCache && window._friendsWatchingCache.byGame) || {};
  var uids = (by[key] && by[key].uids) || [];
  var mine = (window._watchingList || []).some(function (w) { return String(w.gamePk != null ? w.gamePk : w._id) === key; });
  return { names: uids.map(function (u) { return (window._friendNameCache || {})[u] || 'A friend'; }), mine: mine };
}

// ── what's saved: the board, and whether Multi view is up ──
//   ids   the games on the board, in order: [{ sport, gamePk, away, home }]
//   auto  true until the board is edited — it keeps itself full of live games
//   on    Multi view is open (cleared by its Back button)
//   home  show the board on Home (set when the app loads with `on` still set)
//   day   the day the board belongs to; a new day starts a fresh one
function _mvState() {
  var M = window._mv;
  if (M.st) return M.st;
  var st = null;
  try { st = JSON.parse(localStorage.getItem(MV_KEY) || 'null'); } catch (e) {}
  if (!st || typeof st !== 'object' || !Array.isArray(st.ids)) st = { ids: [], auto: true, on: false, home: false, day: null };
  st.ids = st.ids.filter(function (p) { return p && p.sport && p.gamePk != null; }).slice(0, MV_MAX);
  M.st = st;
  return st;
}
function _mvSave() { try { localStorage.setItem(MV_KEY, JSON.stringify(_mvState())); } catch (e) {} }
// The app just loaded. If Multi view was up when it went away, it comes back
// on Home.
(function () {
  var st = _mvState();
  if (st.on) { st.on = false; st.home = true; _mvSave(); }
})();

// ── today's games, every league ──
function _mvSource() {
  var M = window._mv;
  // Home loads the same lists on its own clock — use whichever is newer
  if (window._glSched && (window._glLiveAt || 0) > M.at) return window._glSched;
  return M.sched || window._glSched || [];
}
function _mvHasData() { return !!(window._mv.loaded || window._glLiveLoaded); }
function _mvAll() {
  var out = [];
  _mvSource().forEach(function (x) { (x.games || []).forEach(function (g) { if (g && g.gamePk != null) out.push({ sport: x.sport, g: g }); }); });
  return out;
}
function _mvLoad(force) {
  var M = window._mv;
  if (typeof _bsModalScheduleUrl !== 'function' || typeof GAMES_SPORTS === 'undefined' || !window.fetch) return Promise.resolve();
  if (M.loading) return M.loading;
  if (!force && M.at && Date.now() - M.at < MV_TICK_MS) return Promise.resolve();
  var today = _mvToday();
  M.loading = Promise.all(GAMES_SPORTS.map(function (s) {
    return fetch(_bsModalScheduleUrl(s.key, today))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return { sport: s.key, games: (d && d.games) || [], ok: !!(d && d.games) }; })
      .catch(function () { return { sport: s.key, games: [], ok: false }; });
  })).then(function (res) {
    // a league whose request failed keeps what it had, so its games don't
    // blink off the board
    var old = {};
    (M.sched || []).forEach(function (x) { old[x.sport] = x; });
    M.sched = res.map(function (x) { return !x.ok && old[x.sport] ? old[x.sport] : x; });
    M.at = Date.now(); M.loaded = true; M.loading = null;
    multiIngest(M.sched);
    _mvRenderAll();
  }).catch(function (err) { M.loading = null; console.error('[multi view] load failed:', err); });
  return M.loading;
}
// Every fresh set of scores passes through here (ours and Home's): a score
// that went up since the last look flags that game for a minute and a half.
// Basketball is left out — it scores every few seconds.
function multiIngest(res) {
  var M = window._mv, now = Date.now();
  (res || []).forEach(function (x) {
    (x.games || []).forEach(function (g) {
      if (!g || g.gamePk == null || g.awayScore == null || g.homeScore == null) return;
      var k = _mvKey(x.sport, g.gamePk), a = Number(g.awayScore), h = Number(g.homeScore), p = M.prev[k];
      if (isNaN(a) || isNaN(h)) return;
      if (p && _mvIsLive(x.sport, g) && x.sport !== 'nba' && x.sport !== 'wnba') {
        var da = a - p.a, dh = h - p.h;
        if (da > 0 || dh > 0) {
          var side = da >= dh ? 'away' : 'home', by = da >= dh ? da : dh, cur = M.flags[k];
          // football: the extra point right after a touchdown doesn't replace it
          var tail = (x.sport === 'nfl' || x.sport === 'cfb') && by <= 2 && cur && cur.side === side && now - cur.at < 240000;
          if (!tail) M.flags[k] = { at: now, side: side, by: by };
        }
      }
      // the high-water mark, so an older copy of the feed arriving late (or a
      // run taken off the board and put back) can't flag the same score twice
      M.prev[k] = p ? { a: Math.max(a, p.a), h: Math.max(h, p.h) } : { a: a, h: h };
    });
  });
}
function _mvFlag(key) {
  var f = window._mv.flags[key];
  return f && Date.now() - f.at < MV_FLAG_MS ? f : null;
}
// Only what the score itself proves: 6+ at once in football is a touchdown,
// 3 is a field goal; a hockey or soccer score is a goal.
function _mvFlagWord(sport, f) {
  if (sport === 'nhl' || sport === 'mls' || sport === 'nwsl') return 'GOAL';
  if (sport === 'nfl' || sport === 'cfb') return f.by >= 6 ? 'TOUCHDOWN' : f.by === 3 ? 'FIELD GOAL' : 'SCORE';
  if (sport === 'mlb') return f.by + (f.by === 1 ? ' RUN' : ' RUNS');
  return 'SCORE';
}
function _mvFlagText(sport, f, abbr) { return _mvFlagWord(sport, f) + ' · ' + abbr; }

// ── the board ──
function _mvRank(a, b) {
  var fa = _mvFriends(a.g.gamePk), fb = _mvFriends(b.g.gamePk);
  var ra = fa.names.length || fa.mine ? 0 : 1, rb = fb.names.length || fb.mine ? 0 : 1;
  if (ra !== rb) return ra - rb;
  var order = (typeof GAMES_SPORTS !== 'undefined' ? GAMES_SPORTS : []).map(function (s) { return s.key; });
  var oa = order.indexOf(a.sport), ob = order.indexOf(b.sport);
  if (oa !== ob) return oa - ob;
  return (Date.parse(a.g.startTime || '') || 0) - (Date.parse(b.g.startTime || '') || 0);
}
function _mvEntry(x) { return { sport: x.sport, gamePk: x.g.gamePk, away: x.g.away || null, home: x.g.home || null }; }
// → [{ sport, gamePk, away, home, g, phase }] — g is null until its league has loaded
function _mvBoard() {
  var st = _mvState(), today = _mvToday();
  if (st.day && st.day !== today) { st.ids = []; st.auto = true; st.home = false; st.day = today; _mvSave(); }
  var all = _mvAll(), by = {}, have = {};
  all.forEach(function (x) { by[_mvKey(x.sport, x.g.gamePk)] = x; have[x.sport] = true; });
  var ids = st.ids.slice(), changed = false;
  if (_mvHasData()) {
    // a game that's off today's slate comes off the board (only when its
    // league's list actually arrived)
    var kept = ids.filter(function (p) { return !have[p.sport] || !!by[_mvKey(p.sport, p.gamePk)]; });
    if (kept.length !== ids.length) { ids = kept; changed = true; }
    if (st.auto) {
      var on = {};
      ids.forEach(function (p) { on[_mvKey(p.sport, p.gamePk)] = true; });
      var cands = all.filter(function (x) { return _mvIsLive(x.sport, x.g) && !on[_mvKey(x.sport, x.g.gamePk)]; }).sort(_mvRank);
      while (ids.length < MV_MAX && cands.length) { ids.push(_mvEntry(cands.shift())); changed = true; }
      // a finished game gives its spot to one that's live
      for (var i = 0; i < ids.length && cands.length; i++) {
        var cur = by[_mvKey(ids[i].sport, ids[i].gamePk)];
        if (cur && _mvPhase(cur.sport, cur.g) === 'post') { ids[i] = _mvEntry(cands.shift()); changed = true; }
      }
    }
  }
  if (changed) { st.ids = ids; st.day = today; _mvSave(); }
  return ids.map(function (p) {
    var x = by[_mvKey(p.sport, p.gamePk)];
    return { sport: p.sport, gamePk: p.gamePk, away: (x && x.g.away) || p.away, home: (x && x.g.home) || p.home, g: x ? x.g : null, phase: x ? _mvPhase(p.sport, x.g) : null };
  });
}
// Live games that aren't on the board
function _mvAlso(board) {
  var on = {};
  board.forEach(function (e) { on[_mvKey(e.sport, e.gamePk)] = true; });
  return _mvAll().filter(function (x) { return _mvIsLive(x.sport, x.g) && !on[_mvKey(x.sport, x.g.gamePk)]; }).sort(_mvRank);
}
function _mvLiveCount() { return _mvAll().filter(function (x) { return _mvIsLive(x.sport, x.g); }).length; }

// ── what a tile says ──
function _mvStatus(sport, g, phase) {
  if (!g) return '';
  if (phase === 'post') { var fd = String(g.statusDetail || g.status || ''); return /^final/i.test(fd) ? fd.toUpperCase() : 'FINAL'; }
  if (phase === 'pre') {
    if (/postponed|suspended|delayed/i.test(g.status || '')) return String(g.status).toUpperCase();
    if (g.startTimeTBD || /\bTBD\b/i.test(g.statusDetail || '')) return 'TBD';
    return String((typeof _formatGameTime === 'function' && _formatGameTime(g.startTime)) || 'Today').toUpperCase();
  }
  if (sport === 'mlb') {
    var half = { Top: 'TOP', Bottom: 'BOT', Middle: 'MID', End: 'END' }[g.inningState || g.inningHalf] || '';
    return half && g.inning ? half + ' ' + g.inning : String(g.status || 'Live').toUpperCase();
  }
  var d = String(g.statusDetail || g.status || 'Live');
  // "8:42 - 3rd" → "Q3 8:42"
  var m = d.match(/^(\d{1,2}:\d{2}(?:\.\d)?)\s*-\s*(\d)(?:st|nd|rd|th)\b/i);
  if (m && /^(nfl|cfb|nba|wnba)$/.test(sport)) return 'Q' + m[2] + ' ' + m[1];
  var ot = d.match(/^(\d{1,2}:\d{2}(?:\.\d)?)\s*-\s*(\d?OT)\b/i);
  if (ot) return ot[2].toUpperCase() + ' ' + ot[1];
  return d.toUpperCase();
}
function _mvBases(b, w, h) {
  b = b || {};
  var d = function (x, y, cx, cy, on) {
    return '<rect x="' + x + '" y="' + y + '" width="11" height="11" transform="rotate(45 ' + cx + ' ' + cy + ')" fill="' + (on ? '#E8C766' : 'none') + '" stroke="' + (on ? '#E8C766' : 'rgba(255,255,255,.5)') + '" stroke-width="1.4"/>';
  };
  var who = [b.first ? 'first' : '', b.second ? 'second' : '', b.third ? 'third' : ''].filter(Boolean);
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 46 34" role="img" aria-label="' + (who.length ? 'Runners on ' + who.join(' and ') : 'Bases empty') + '">' +
    d(17.5, 2.5, 23, 8, b.second) + d(30.5, 15.5, 36, 21, b.first) + d(4.5, 15.5, 10, 21, b.third) + '</svg>';
}
function _mvLead(as, hs, ca, ch) {
  var d = Number(as) - Number(hs);
  if (isNaN(d)) return '';
  return d === 0 ? 'TIED' : (d > 0 ? ca.abbr : ch.abbr) + ' BY ' + Math.abs(d);
}
// How far down the field the offense is, 0–100, and where the first-down
// marker sits — only when the spot and who has the ball both came through
function _mvField(sit) {
  if (!sit || !sit.poss || !sit.spot) return null;
  var spot = String(sit.spot).trim(), pct = null;
  if (spot === '50') pct = 50;
  else {
    var m = spot.match(/^([A-Z]{1,4})\s+(\d{1,2})$/);
    if (!m) return null;
    pct = m[1] === sit.poss ? Number(m[2]) : 100 - Number(m[2]);
  }
  var tg = String(sit.dd || '').match(/&\s*(\d{1,2})\b/);
  return { pct: Math.max(0, Math.min(100, pct)), mark: tg ? Math.max(0, Math.min(100, pct + Number(tg[1]))) : (/goal/i.test(sit.dd || '') ? 100 : null) };
}
function _mvSitHtml(e, ca, ch, flag) {
  var sport = e.sport, g = e.g, ph = e.phase;
  if (!g) return '<span class="mv-sit tx"><small>LOADING</small></span>';
  if (flag) return '<span class="mv-sit gold"><b>' + _mvEsc(_mvFlagWord(sport, flag)) + '</b><small>' + _mvEsc((flag.side === 'away' ? ca : ch).abbr) + ' · JUST NOW</small></span>';
  if (ph === 'pre') return '<span class="mv-sit tx"><b>' + _mvEsc(_mvStatus(sport, g, ph)) + '</b><small>NOT STARTED</small></span>';
  var lead = g.awayScore != null && g.homeScore != null ? _mvLead(g.awayScore, g.homeScore, ca, ch) : '';
  if (ph === 'post') return '<span class="mv-sit tx"><b>FINAL</b>' + (lead ? '<small>' + _mvEsc(lead) + '</small>' : '') + '</span>';
  if (sport === 'mlb') {
    if (g.inningState === 'Middle' || g.inningState === 'End') return '<span class="mv-sit tx"><b class="sm">BETWEEN INNINGS</b>' + (lead ? '<small>' + _mvEsc(lead) + '</small>' : '') + '</span>';
    var count = g.balls != null && g.strikes != null ? g.balls + '-' + g.strikes : '';
    var outs = g.outs != null ? g.outs + (Number(g.outs) === 1 ? ' OUT' : ' OUTS') : '';
    if (!g.bases && !count && !outs) return '<span class="mv-sit tx"><b>' + _mvEsc(lead || 'LIVE') + '</b></span>';
    return '<span class="mv-sit bb">' + (g.bases ? _mvBases(g.bases, 54, 40) : '') + '<span class="col"><b>' + _mvEsc(count) + '</b><small>' + _mvEsc(outs) + '</small></span></span>';
  }
  var sit = g.sit;
  if ((sport === 'nfl' || sport === 'cfb') && sit && sit.dd) {
    var f = _mvField(sit), pc = sit.poss ? (sit.poss === ca.abbr ? ca : sit.poss === ch.abbr ? ch : null) : null;
    var where = [sit.poss, sit.spot].filter(Boolean).join(' · ');
    return '<span class="mv-sit fb"><b>' + _mvEsc(String(sit.dd).toUpperCase()) + '</b>' + (where ? '<small>' + _mvEsc(where) + '</small>' : '') +
      (f ? '<span class="bar" role="img" aria-label="Ball on the ' + _mvEsc(sit.spot) + '"><i style="width:' + f.pct + '%;background:' + ((pc && pc.accent) || '#A89FE8') + '"></i>' + (f.mark != null ? '<u style="left:' + f.mark + '%"></u>' : '') + '</span>' : '') + '</span>';
  }
  return '<span class="mv-sit tx"><b>' + _mvEsc(lead || 'LIVE') + '</b>' + (sit && sit.poss ? '<small>' + _mvEsc(sit.poss) + ' BALL</small>' : '') + '</span>';
}
// The one-line version, for the small tiles on Home
function _mvSitLine(e, ca, ch, flag) {
  var sport = e.sport, g = e.g, ph = e.phase;
  if (!g) return '';
  if (flag) return _mvFlagText(sport, flag, (flag.side === 'away' ? ca : ch).abbr) + ' · JUST NOW';
  if (ph === 'pre') return 'NOT STARTED';
  var lead = g.awayScore != null && g.homeScore != null ? _mvLead(g.awayScore, g.homeScore, ca, ch) : '';
  if (ph === 'post') return lead || 'FINAL';
  if (sport === 'mlb') {
    if (g.inningState === 'Middle' || g.inningState === 'End') return 'BETWEEN INNINGS';
    // the runners are drawn beside this (a small diamond), not spelled out
    var bits = [];
    if (g.balls != null && g.strikes != null) bits.push(g.balls + '-' + g.strikes);
    if (g.outs != null) bits.push(g.outs + (Number(g.outs) === 1 ? ' OUT' : ' OUTS'));
    return bits.join(' · ') || lead;
  }
  var sit = g.sit;
  if ((sport === 'nfl' || sport === 'cfb') && sit && sit.dd) return [String(sit.dd).toUpperCase(), sit.spot].filter(Boolean).join(' · ');
  return lead || 'LIVE';
}
function _mvNoteText(e) {
  var g = e.g;
  if (!g) return '';
  if (e.phase === 'live') {
    if (e.sport === 'mlb' && (g.batter || g.pitcher) && g.inningState !== 'Middle' && g.inningState !== 'End') {
      return [g.batter ? _mvLast(g.batter) + ' at bat' : '', g.pitcher ? _mvLast(g.pitcher) + ' pitching' : ''].filter(Boolean).join(' · ');
    }
    if (g.sit && g.sit.last) return g.sit.last;
  }
  return g.venue || '';
}
function _mvFriendsHtml(gamePk) {
  var fw = _mvFriends(gamePk), n = fw.names.length;
  if (!n) return '<span class="mv-fr">' + (fw.mine ? 'You’re watching' : 'No friends in yet') + '</span>';
  var ini = function (name) { return String(name || '?').trim().charAt(0).toUpperCase(); }; // one letter: these are 18px
  var avs = fw.names.slice(0, 2).map(function (nm) { return '<i>' + _mvEsc(ini(nm)) + '</i>'; }).join('');
  return '<span class="mv-fr on"><span class="avs">' + avs + '</span>' + _mvEsc(n === 1 ? String(fw.names[0]).split(/\s+/)[0] + ' is here' : n + ' friends here') + '</span>';
}
function _mvTeams(e, cls) {
  var g = e.g || {}, ph = e.phase;
  var ca = _mvLook(e.sport, e.away, g.awayAbbr, g.awayColor, g.awayAlt), ch = _mvLook(e.sport, e.home, g.homeAbbr, g.homeColor, g.homeAlt);
  var as = g.awayScore, hs = g.homeScore, scored = !!ph && ph !== 'pre' && as != null && hs != null;
  var row = function (c, sc, lo) {
    return '<span class="' + cls + '-row' + (lo ? ' lo' : '') + '"><i style="background:' + c.accent + '"></i><span class="ab">' + _mvEsc(c.abbr) + '</span><span class="sc">' + (scored ? _mvEsc(sc) : '') + '</span></span>';
  };
  return { ca: ca, ch: ch, html: row(ca, as, scored && Number(as) < Number(hs)) + row(ch, hs, scored && Number(hs) < Number(as)) };
}
function _mvTileHtml(e, i) {
  var t = _mvTeams(e, 'mv'), flag = e.phase === 'live' ? _mvFlag(_mvKey(e.sport, e.gamePk)) : null;
  var label = (e.away || 'Away') + ' at ' + (e.home || 'Home');
  return '<div class="mv-tile' + (flag ? ' scored' : '') + '">' +
    '<button class="mv-open" onclick="multiOpenGame(' + i + ')" aria-label="' + _mvEsc(label) + '">' +
      '<span class="mv-top"><span class="lg">' + _mvEsc(_mvLeague(e.sport)) + '</span><span class="st' + (e.phase === 'live' ? ' live' : '') + '">' + (e.phase === 'live' ? '<i></i>' : '') + _mvEsc(_mvStatus(e.sport, e.g, e.phase)) + '</span></span>' +
      '<span class="mv-tm">' + t.html + '</span>' +
      _mvSitHtml(e, t.ca, t.ch, flag) +
      '<span class="mv-note">' + _mvEsc(_mvNoteText(e)) + '</span>' +
      _mvFriendsHtml(e.gamePk) +
    '</button>' +
    '<button class="mv-x" onclick="multiRemove(' + i + ')" aria-label="Take ' + _mvEsc(label) + ' off the board">' + MV_X + '</button>' +
  '</div>';
}

// ── the screen ──
function _mvRender() {
  var body = _mv$('mv-body');
  if (!body) return;
  var M = window._mv, board = _mvBoard(), also = _mvAlso(board), loaded = _mvHasData();
  M.shown = board; M.also = also;
  var liveN = board.filter(function (e) { return e.phase === 'live'; }).length;
  var lv = _mv$('mv-live');
  if (lv) { lv.style.display = liveN ? '' : 'none'; lv.innerHTML = '<i></i>' + liveN + ' LIVE'; }
  if (!board.length) M.edit = false;
  var eb = _mv$('mv-edit');
  if (eb) { eb.style.display = board.length ? '' : 'none'; eb.textContent = M.edit ? 'Done' : 'Edit board'; eb.setAttribute('aria-pressed', M.edit ? 'true' : 'false'); }
  body.classList.toggle('mv-editing', !!M.edit);
  var h = '';
  if (board.length) h += '<div class="mv-grid">' + board.map(_mvTileHtml).join('') + '</div>';
  else if (!loaded) h += '<div class="mv-empty"><b>Loading today’s games…</b></div>';
  else if (!also.length) h += '<div class="mv-empty"><b>Nothing’s live right now</b><span>When games are on, up to four of them show here side by side.</span><button class="mv-cta" onclick="multiTodaysGames()">Today’s games</button></div>';
  else h += '<div class="mv-empty"><b>Your board’s empty</b><span>Add a live game from the list below.</span></div>';
  if (also.length) {
    var full = board.length >= MV_MAX;
    h += '<div class="mv-sec"><div class="mv-lab">ALSO LIVE' + (full ? '<small>The board holds four. Take one off to add another.</small>' : '') + '</div>' +
      also.map(function (x, i) {
        var g = x.g, ca = _mvLook(x.sport, g.away, g.awayAbbr, g.awayColor, g.awayAlt), ch = _mvLook(x.sport, g.home, g.homeAbbr, g.homeColor, g.homeAlt);
        var sc = g.awayScore != null && g.homeScore != null;
        return '<div class="mv-also"><span class="sc"><span>' + _mvEsc(ca.abbr) + (sc ? ' ' + _mvEsc(g.awayScore) : '') + '</span><span>' + _mvEsc(ch.abbr) + (sc ? ' ' + _mvEsc(g.homeScore) : '') + '</span><small>' + _mvEsc(_mvStatus(x.sport, g, 'live')) + '</small></span>' +
          (full ? '' : '<button onclick="multiAdd(' + i + ')" aria-label="Add ' + _mvEsc((g.away || '') + ' at ' + (g.home || '')) + ' to the board">Add to board</button>') + '</div>';
      }).join('') + '</div>';
  }
  body.innerHTML = h;
}
function _mvRenderAll() {
  try { if (_mvActive()) _mvRender(); } catch (e) { console.error('[multi view] render', e); }
  try { multiHomeRender(); } catch (e2) { console.error('[multi view] home', e2); }
  try { _mvPickPill(); _mvDropText(); } catch (e3) {}
}
// Runs every time the screen comes up (opened, or come back to from a game)
function _mvShown() {
  var M = window._mv, body = _mv$('mv-body');
  if (body && typeof _ptrAttach === 'function') _ptrAttach(body, function () { return _mvLoad(true); });
  if (typeof startWatchingList === 'function' && !window._watchingStarted) { try { startWatchingList(); } catch (e) {} }
  _mvRender();
  _mvLoad(M.at > 0);
  if (!M.timer) M.timer = setInterval(function () { if (!document.hidden && _mvActive()) _mvLoad(true); }, MV_TICK_MS);
}

// ── opening and closing ──
function multiOpen() {
  var st = _mvState();
  st.on = true;
  if (!st.ids.length) st.auto = true; // an emptied board goes back to "whatever's live"
  _mvSave();
  window._mv.edit = false;
  nav('multi');
}
// From a game's pull-down scoreboard: that game goes on the board first
function multiOpenFromGame() {
  var g = window._activeBrowseGame;
  if (typeof gshCloseDrop === 'function') gshCloseDrop();
  if (g && g.gamePk != null) {
    var st = _mvState(), key = _mvKey(g.sport || 'mlb', g.gamePk);
    var rest = st.ids.filter(function (p) { return _mvKey(p.sport, p.gamePk) !== key; });
    st.ids = [{ sport: g.sport || 'mlb', gamePk: g.gamePk, away: g.away || null, home: g.home || null }].concat(rest).slice(0, MV_MAX);
    st.day = _mvToday();
    _mvSave();
  }
  multiOpen();
}
function multiBack() {
  var st = _mvState();
  st.on = false; _mvSave();
  window._mv.edit = false;
  navBack('feed');
}
function multiOpenGame(i) {
  var M = window._mv, e = M.shown[i];
  if (!e || M.edit || typeof openGameScreen !== 'function') return;
  openGameScreen(e.gamePk, e.away, e.home, e.sport, _mvToday());
}
function multiTodaysGames() { if (typeof glassLeagues === 'function') glassLeagues(); else nav('games-picker'); }

// ── editing the board ──
function multiToggleEdit() {
  var M = window._mv, st = _mvState();
  M.edit = !M.edit;
  // finishing with nothing on it hands the board back to "whatever's live"
  if (!M.edit && !st.ids.length) { st.auto = true; _mvSave(); }
  _mvRender();
}
function multiRemove(i) {
  var M = window._mv, st = _mvState(), e = M.shown[i];
  if (!e) return;
  var key = _mvKey(e.sport, e.gamePk);
  st.ids = st.ids.filter(function (p) { return _mvKey(p.sport, p.gamePk) !== key; });
  st.auto = false; st.day = _mvToday();
  _mvSave();
  _mvRender();
}
function multiAdd(i) {
  var M = window._mv, st = _mvState(), x = M.also[i];
  if (!x || st.ids.length >= MV_MAX) return;
  st.ids.push(_mvEntry(x));
  st.auto = false; st.day = _mvToday();
  _mvSave();
  _mvRender();
}

// ── Games (the league picker): the first tile ──
function multiPickTileHtml() {
  return '<button class="mv-pick" onclick="multiOpen()">' +
    '<svg width="34" height="36" viewBox="0 0 34 36" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="3" y="4" width="12" height="12" rx="3.5"/><rect x="19" y="4" width="12" height="12" rx="3.5"/><rect x="3" y="20" width="12" height="12" rx="3.5"/><rect x="19" y="20" width="12" height="12" rx="3.5"/></svg>' +
    '<span class="nm">Multi view</span><span class="pill" id="mv-pick-pill"></span></button>';
}
function _mvPickPill() {
  var el = _mv$('mv-pick-pill');
  if (!el) return;
  var n = _mvLiveCount(), loaded = _mvHasData();
  el.textContent = !loaded ? 'Up to 4 games' : n ? n + ' live now' : 'Nothing live';
  el.classList.toggle('off', loaded && !n);
}
function multiPickSync() { _mvPickPill(); _mvLoad(false); }

// ── inside a game: the row in the pull-down scoreboard ──
function multiDropRowHtml() {
  return '<button class="gsbd-multi" onclick="multiOpenFromGame()"><span class="ic">' + MV_ICON + '</span>' +
    '<span class="tx"><b>Multi view</b><small id="gsbd-multi-sub">Watch this game next to up to three more</small></span>' + MV_CHEV + '</button>';
}
function _mvDropText() {
  var el = _mv$('gsbd-multi-sub');
  if (!el || !_mvHasData()) return;
  var g = window._activeBrowseGame, me = g ? _mvKey(g.sport || 'mlb', g.gamePk) : '';
  var others = _mvAll().filter(function (x) { return _mvIsLive(x.sport, x.g) && _mvKey(x.sport, x.g.gamePk) !== me; });
  var txt = others.length ? 'This game + ' + others.length + ' more live' : 'Nothing else is live right now';
  var hot = others.filter(function (x) { return !!_mvFlag(_mvKey(x.sport, x.g.gamePk)); })[0];
  if (hot) {
    var f = _mvFlag(_mvKey(hot.sport, hot.g.gamePk)), away = f.side === 'away';
    txt += ' · ' + _mvLook(hot.sport, away ? hot.g.away : hot.g.home, away ? hot.g.awayAbbr : hot.g.homeAbbr).abbr + ' just scored';
  }
  el.textContent = txt;
}
function multiDropSync() { _mvDropText(); _mvLoad(false); }

// ── Home: the board, after a reload ──
function multiHomeClose() {
  var st = _mvState();
  st.home = false; _mvSave();
  multiHomeRender();
}
function multiHomeOpenGame(i) {
  var e = (window._mv.homeShown || [])[i];
  if (!e || typeof openGameScreen !== 'function') return;
  openGameScreen(e.gamePk, e.away, e.home, e.sport, _mvToday());
}
function multiHomeRender() {
  var el = _mv$('gl-multi');
  if (!el) return;
  var st = _mvState(), hide = function () { if (el.style.display !== 'none') { el.style.display = 'none'; el.innerHTML = ''; } };
  if (!st.home || !_mvHasData()) { hide(); return; }
  var board = _mvBoard().filter(function (e) { return !!e.g; });
  // closed for you once there's nothing left to watch on it
  if (!board.some(function (e) { return e.phase !== 'post'; })) {
    if (!_mvAll().length) { hide(); return; } // lists not in yet — wait
    st.home = false; _mvSave(); hide(); return;
  }
  window._mv.homeShown = board;
  var liveN = board.filter(function (e) { return e.phase === 'live'; }).length;
  el.innerHTML = '<div class="gl-g mvh"><div class="gl-lh"><span class="gl-lab">' + (liveN ? '<span class="gl-ldot"></span>' : '') + 'Your multi view' + (liveN ? ' · ' + liveN + ' live' : '') + '</span>' +
    '<button class="mvh-x" onclick="multiHomeClose()" aria-label="Close multi view">' + MV_X + '</button></div>' +
    '<div class="mvh-grid">' + board.map(function (e, i) {
      var t = _mvTeams(e, 'mvh'), flag = e.phase === 'live' ? _mvFlag(_mvKey(e.sport, e.gamePk)) : null;
      var atBat = e.sport === 'mlb' && e.phase === 'live' && !flag && e.g.bases && e.g.inningState !== 'Middle' && e.g.inningState !== 'End';
      return '<button class="mvh-t' + (flag ? ' scored' : '') + '" onclick="multiHomeOpenGame(' + i + ')" aria-label="' + _mvEsc((e.away || 'Away') + ' at ' + (e.home || 'Home')) + '">' +
        '<span class="mvh-top"><span>' + _mvEsc(_mvLeague(e.sport)) + '</span><span class="st' + (e.phase === 'live' ? ' live' : '') + '">' + _mvEsc(_mvStatus(e.sport, e.g, e.phase)) + '</span></span>' +
        '<span class="mvh-tm">' + t.html + '</span>' +
        '<span class="mvh-sit' + (flag ? ' gold' : '') + '">' + (atBat ? _mvBases(e.g.bases, 24, 18) : '') + '<span>' + _mvEsc(_mvSitLine(e, t.ca, t.ch, flag)) + '</span></span></button>';
    }).join('') + '</div>' +
    '<div class="gl-lf"><p>Right where you left it</p><button class="gl-join mvh-open" onclick="multiOpen()">Open multi view</button></div></div>';
  el.style.display = '';
}

// ── wiring ──
// The screen has no loader of its own in navigation.js, so it hooks the
// screen switch (the same way js/core/glass.js does)
(function () {
  if (typeof _navApplyScreen !== 'function') return;
  var prev = _navApplyScreen;
  window._navApplyScreen = function (id) {
    var out = prev.apply(this, arguments);
    try { if (id === 'multi') _mvShown(); } catch (e) { console.error('[multi view] open', e); }
    return out;
  };
})();
// Coming back to the app catches the board up right away
document.addEventListener('visibilitychange', function () { if (!document.hidden && _mvActive()) _mvLoad(true); });
