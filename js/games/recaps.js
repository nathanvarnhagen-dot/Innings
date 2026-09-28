// ═══ RECAP STORIES (v7.4.0) ═══════════════════════════════════════════════
// Story rings at the top of the Games screens: one per sport, each a recap
// of the last finished day (MLB, NBA, WNBA, NHL) or week (NFL, college,
// MLS, NWSL, plus an MLB week). Tap a ring to watch; the big-moment slides
// replay each play on the field, court, rink or pitch.
//
// Data: /api/recap (api/recap.js) — one cached request per sport.
// Drawing: every moment carries `anim` facts from the server (where the ball
// landed, who ran where, yard lines, shot distance). _rcBuild* below turn
// those facts into a list of actors with keyframes, and _rcDraw paints a
// frame of them on the sport's surface.
//
// Depends on: _todayLocal, _loadFavTeams, _ghTeamColors, _gxColors,
// openGameScreen, nav, chooseMomentType, mnPickKind, _bsModalBoxscoreUrl,
// _applyBoxScoreToContext, ib_toast.

var RC_SPORTS = [
  { key: 'mlb', emoji: '⚾', league: 'mlb' },
  { key: 'mlbw', emoji: '📅', league: 'mlb' },
  { key: 'nfl', emoji: '🏈', league: 'nfl' },
  { key: 'cfb', emoji: '🎓', league: 'cfb' },
  { key: 'nba', emoji: '🏀', league: 'nba' },
  { key: 'wnba', emoji: '🏀', league: 'wnba' },
  { key: 'nhl', emoji: '🏒', league: 'nhl' },
  { key: 'mls', emoji: '⚽', league: 'mls' },
  { key: 'nwsl', emoji: '⚽', league: 'nwsl' }
];
window._rcFetchCache = window._rcFetchCache || {};
window._rcList = [];

// ── dates ────────────────────────────────────────────────────────────────
function _rcAdd(ymd, n) { var d = new Date(ymd + 'T12:00:00'); d.setDate(d.getDate() + n); var m = d.getMonth() + 1, dd = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; }
function _rcDow(ymd) { return new Date(ymd + 'T12:00:00').getDay(); }
// The window each recap covers, as of today
function _rcWindows(today) {
  var y = _rcAdd(today, -1);
  var dow = _rcDow(today);
  var lastSun = _rcAdd(today, -(dow === 0 ? 7 : dow));               // most recent Sunday before today
  var lastSat = _rcAdd(today, -(((dow - 6) + 7) % 7 || 7));          // most recent Saturday before today
  return {
    mlb: [y, y], nba: [y, y], wnba: [y, y], nhl: [y, y],
    mlbw: [_rcAdd(lastSun, -6), lastSun],
    mls: [_rcAdd(lastSun, -6), lastSun], nwsl: [_rcAdd(lastSun, -6), lastSun],
    nfl: [_rcAdd(lastSun, -5), _rcAdd(lastSun, 1)],    // Tue→Mon around the last Sunday; Monday night joins once it's final
    cfb: [_rcAdd(lastSat, -4), lastSat]                // Tuesday through Saturday
  };
}
function _rcFetch(key, win) {
  var url = '/api/recap?sport=' + key + '&start=' + win[0] + '&end=' + win[1];
  var hit = window._rcFetchCache[url];
  if (hit && (Date.now() - hit.t < 30 * 60 * 1000)) return hit.p;
  var p = fetch(url).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { return d && !d.empty && d.moments ? d : null; })
    .catch(function () { delete window._rcFetchCache[url]; return null; });
  window._rcFetchCache[url] = { t: Date.now(), p: p };
  return p;
}

// ── seen rings ───────────────────────────────────────────────────────────
function _rcSeen() { try { return JSON.parse(localStorage.getItem('innings_recaps_seen') || '{}') || {}; } catch (e) { return window._rcSeenMem || (window._rcSeenMem = {}); } }
function _rcMarkSeen(id) {
  var s = _rcSeen(); if (s[id]) return; s[id] = Date.now();
  // keep the last 60 so this never grows forever
  var keys = Object.keys(s).sort(function (a, b) { return s[b] - s[a]; }).slice(0, 60), out = {};
  keys.forEach(function (k) { out[k] = s[k]; });
  window._rcSeenMem = out;
  try { localStorage.setItem('innings_recaps_seen', JSON.stringify(out)); } catch (e) {}
}

// ── helpers ──────────────────────────────────────────────────────────────
function _rcEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function _rcColors(league, t) {
  t = t || {};
  if (league === 'mlb' && typeof _ghTeamColors === 'function') return _ghTeamColors(t.abbr);
  if (typeof _gxColors === 'function') return _gxColors(league, t.abbr, t.color, t.alt);
  return { bg: '#3D3580', fg: '#fff', accent: '#A89FE8' };
}
function _rcPrep(r) {
  // Team lookup by abbreviation and by name, with colors
  r._teams = {};
  (r.games || []).forEach(function (g) {
    [g.away, g.home].forEach(function (t) { if (!t) return; t.colors = _rcColors(r.league, t); r._teams[t.abbr] = t; r._teams[t.name] = t; });
  });
  r._games = {};
  (r.games || []).forEach(function (g) { r._games[String(g.id)] = g; });
  var meta = RC_SPORTS.filter(function (s) { return s.key === r.sport; })[0] || {};
  r._emoji = meta.emoji || '🏆';
  return r;
}
function _rcTeam(r, t) { return (t && (r._teams[t.abbr] || r._teams[t.name])) || Object.assign({ colors: _rcColors(r.league, t || {}) }, t || {}); }
function _rcLo(t, size) {
  t = t || {}; var c = t.colors || { bg: '#3D3580', fg: '#fff' };
  var ab = String(t.abbr || '').slice(0, 4);
  return '<span class="rc-lo' + (size ? ' rc-lo-' + size : '') + '" style="background:' + c.bg + ';color:' + c.fg + '">' + _rcEsc(ab) + '</span>';
}
function _rcWinner(g) { return g.home.score > g.away.score ? g.home : g.away; }
function _rcIsWeek(r) { return r.kind === 'week'; }

// ═══ RINGS ═══════════════════════════════════════════════════════════════
function recapsRefresh() {
  var hosts = ['games-recaps', 'games-picker-recaps'].map(function (id) { return document.getElementById(id); }).filter(Boolean);
  if (!hosts.length) return;
  var today = typeof _todayLocal === 'function' ? _todayLocal() : new Date().toISOString().slice(0, 10);
  var W = _rcWindows(today);
  Promise.all(RC_SPORTS.map(function (s) { return _rcFetch(s.key, W[s.key]); })).then(function (all) {
    var list = all.filter(Boolean).map(_rcPrep);
    window._rcList = list;
    // Your teams, for the last slide (cached after the first read)
    var leagues = {}; list.forEach(function (r) { leagues[r.league] = 1; });
    if (typeof _loadFavTeams === 'function') Object.keys(leagues).forEach(function (l) { _loadFavTeams(l); });
    _rcRenderRings();
  });
}
function _rcOrdered() {
  var seen = _rcSeen(), cur = window._gamesSport;
  var onGames = !!(document.querySelector('#screen-games.active'));
  var rank = function (r, i) {
    var mine = onGames && (r.sport === cur || (cur === 'mlb' && r.sport === 'mlbw'));
    return (mine ? 0 : 100) + (seen[r.id] ? 50 : 0) + i;
  };
  return window._rcList.map(function (r, i) { return { r: r, k: rank(r, i) }; }).sort(function (a, b) { return a.k - b.k; }).map(function (x) { return x.r; });
}
function _rcRenderRings() {
  var seen = _rcSeen(), list = _rcOrdered();
  window._rcOrder = list;
  var html = list.length ? '<div class="rc-rings" role="list" aria-label="Recaps">' + list.map(function (r, i) {
    var hg = r.hero && r._games[String(r.hero.gameId)], w = hg ? _rcWinner(hg) : null;
    var col = w && w.colors ? w.colors.bg : '#3D3580';
    return '<button class="rc-ring' + (seen[r.id] ? ' rc-seen' : '') + '" role="listitem" onclick="recapsOpen(' + i + ')" aria-label="' + _rcEsc(r.title) + ' recap">' +
      '<span class="rc-r"><span class="rc-in" style="background:radial-gradient(circle at 30% 30%,' + col + ',#140E34)">' + r._emoji + '<b>' + _rcEsc(r.ring && r.ring.sub || '') + '</b></span></span>' +
      '<span class="rc-l">' + _rcEsc(r.ring && r.ring.label || r.sport.toUpperCase()) + '</span></button>';
  }).join('') + '</div>' : '';
  ['games-recaps', 'games-picker-recaps'].forEach(function (id) { var el = document.getElementById(id); if (el) { el.innerHTML = html; el.style.display = list.length ? '' : 'none'; } });
}

// Refresh the rings whenever a Games screen opens
(function () {
  if (typeof _navApplyScreen !== 'function') return;
  var orig = _navApplyScreen;
  _navApplyScreen = function (id) {
    var out = orig.apply(this, arguments);
    if (id === 'games' || id === 'games-picker') { try { recapsRefresh(); } catch (e) { console.error('Recaps refresh error:', e); } }
    return out;
  };
})();

// ═══ SURFACES ════════════════════════════════════════════════════════════
var RC_SC = {
  baseball: '<rect width="360" height="250" fill="#1E5A36"/><path d="M8 140 Q180 -64 352 140 L180 250Z" fill="#23693F"/>' + [0, 1, 2, 3, 4, 5].map(function (i) { return '<path d="M180 250 L' + (8 + i * 62) + ' ' + (140 - Math.sin(i / 5 * Math.PI) * 98) + '" stroke="rgba(255,255,255,.035)" stroke-width="22"/>'; }).join('') +
    '<path d="M8 140 Q180 -64 352 140" fill="none" stroke="#2B1D3E" stroke-width="7"/><path d="M8 140 Q180 -64 352 140" fill="none" stroke="#F2C869" stroke-width="1.2" opacity=".6"/>' +
    '<path d="M180 232 L252 162 L180 90 L108 162Z" fill="#9A6A3E"/><path d="M180 232 L262 150 A118 118 0 0 0 98 150Z" fill="#9A6A3E" opacity=".35"/><path d="M180 222 L240 162 L180 102 L120 162Z" fill="#23693F"/><circle cx="180" cy="166" r="9" fill="#9A6A3E"/>' +
    '<path d="M180 232 L8 60 M180 232 L352 60" stroke="rgba(255,255,255,.55)" stroke-width="1.2"/>' + [[248, 160], [180, 92], [112, 160]].map(function (b) { return '<rect x="' + (b[0] - 4) + '" y="' + (b[1] - 4) + '" width="8" height="8" transform="rotate(45 ' + b[0] + ' ' + b[1] + ')" fill="#fff"/>'; }).join('') + '<path d="M175 228h10l0 5-5 4-5-4z" fill="#fff"/>',
  football: function (m) {
    var h = '<rect width="360" height="250" fill="#1E5A36"/>';
    for (var i = 0; i < 10; i++) h += '<rect x="' + (24 + i * 31.2) + '" y="0" width="15.6" height="250" fill="rgba(255,255,255,.03)"/>';
    h += '<rect x="0" y="0" width="24" height="250" fill="' + (m.lez || '#3D3580') + '" opacity=".85"/><rect x="336" y="0" width="24" height="250" fill="' + (m.rez || '#3D3580') + '" opacity=".85"/>';
    for (var y = 0; y <= 100; y += 10) { var x = 24 + y * 3.12; h += '<line x1="' + x + '" x2="' + x + '" y1="18" y2="232" stroke="rgba(255,255,255,' + (y === 50 ? .6 : .35) + ')" stroke-width="' + (y === 50 ? 1.6 : 1) + '"/>'; if (y > 0 && y < 100) h += '<text x="' + x + '" y="244" text-anchor="middle" font-size="9" font-weight="800" fill="rgba(255,255,255,.55)" font-family="-apple-system,sans-serif">' + (y <= 50 ? y : 100 - y) + '</text>'; }
    h += '<line x1="0" x2="360" y1="18" y2="18" stroke="#fff" stroke-width="1.5" opacity=".7"/><line x1="0" x2="360" y1="232" y2="232" stroke="#fff" stroke-width="1.5" opacity=".7"/>';
    h += '<path d="M354 104v42M354 104h4M354 146h4M6 104v42M6 104h-4M6 146h-4" stroke="#F2C869" stroke-width="2.5"/>';
    return h;
  },
  court: '<rect width="360" height="250" fill="#8A5A2E"/>' + Array.apply(null, { length: 18 }).map(function (_, i) { return '<rect x="' + i * 20 + '" y="0" width="10" height="250" fill="rgba(0,0,0,.05)"/>'; }).join('') +
    '<rect x="138" y="20" width="84" height="120" fill="rgba(29,66,138,.55)" stroke="#fff" stroke-width="1.5"/><circle cx="180" cy="140" r="30" fill="none" stroke="#fff" stroke-width="1.5"/>' +
    '<path d="M34 20 L34 70 A146 146 0 0 0 326 70 L326 20" fill="none" stroke="#fff" stroke-width="1.8"/><line x1="0" x2="360" y1="20" y2="20" stroke="#fff" stroke-width="2"/>' +
    '<line x1="160" x2="200" y1="30" y2="30" stroke="#fff" stroke-width="3"/><circle cx="180" cy="40" r="8" fill="none" stroke="#FF6A28" stroke-width="2.5"/><path d="M175 46l5 8 5-8" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1"/>',
  rink: '<rect width="360" height="250" fill="#E9EEF5"/><rect x="4" y="4" width="352" height="242" rx="40" fill="#F4F7FB" stroke="#9FB0C4" stroke-width="2"/>' +
    '<line x1="4" x2="356" y1="40" y2="40" stroke="#D9304A" stroke-width="2"/><line x1="4" x2="356" y1="214" y2="214" stroke="#2D5FB8" stroke-width="6"/>' +
    '<path d="M160 40 A20 20 0 0 0 200 40Z" fill="rgba(90,160,230,.35)" stroke="#D9304A" stroke-width="1.5"/><rect x="164" y="22" width="32" height="18" rx="4" fill="rgba(0,0,0,.08)" stroke="#D9304A" stroke-width="2"/>' +
    [[90, 110], [270, 110]].map(function (c) { return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="36" fill="none" stroke="#D9304A" stroke-width="1.5"/><circle cx="' + c[0] + '" cy="' + c[1] + '" r="3" fill="#D9304A"/>'; }).join(''),
  pitch: '<rect width="360" height="250" fill="#1F6B3A"/>' + Array.apply(null, { length: 8 }).map(function (_, i) { return '<rect x="0" y="' + i * 34 + '" width="360" height="17" fill="rgba(255,255,255,.035)"/>'; }).join('') +
    '<g fill="none" stroke="rgba(255,255,255,.8)" stroke-width="1.6"><line x1="4" x2="356" y1="14" y2="14"/><rect x="70" y="14" width="220" height="92"/><rect x="128" y="14" width="104" height="34"/><path d="M146 106 A40 40 0 0 0 214 106"/><path d="M340 14 A12 12 0 0 0 356 26"/><path d="M4 26 A12 12 0 0 0 20 14"/></g>' +
    '<circle cx="180" cy="80" r="2.4" fill="#fff"/><rect x="156" y="4" width="48" height="10" fill="rgba(255,255,255,.18)" stroke="#fff" stroke-width="2"/>'
};

// ═══ ANIMATION ENGINE ═══════════════════════════════════════════════════
// spec = { scene, actors:[{k:'ball'|'puck'|'hero'|'off'|'def', tr:[[t,x,y,arc]], show:[t0,t1], after:'hero'}],
//          labels:[[t, text, 'chip'|'burst'|'clock'|'shot'|'confetti', x, y]] }
function _rcEase(u) { return u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
function _rcAt(tr, t) {
  if (t <= tr[0][0]) return [tr[0][1], tr[0][2], 0];
  for (var i = 1; i < tr.length; i++) {
    if (t <= tr[i][0]) { var a = tr[i - 1], b = tr[i], u = (t - a[0]) / ((b[0] - a[0]) || 1), e = _rcEase(u); return [a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e, (b[3] || 0) * Math.sin(Math.PI * u)]; }
  }
  var l = tr[tr.length - 1]; return [l[1], l[2], 0];
}
function _rcDraw(svg, spec, col, t) {
  var base = typeof RC_SC[spec.scene] === 'function' ? RC_SC[spec.scene](spec) : RC_SC[spec.scene];
  var h = base, pos = {}, dark = spec.scene === 'rink', F = function (n) { return n.toFixed(1); };
  spec.actors.forEach(function (a) {
    if (a.show && (t < a.show[0] || t > a.show[1])) return;
    var p = _rcAt(a.tr, t); if (a.k === 'hero') pos.hero = p;
    if (a.after === 'hero' && t > a.tr[a.tr.length - 1][0] && pos.hero) p = [pos.hero[0] + 5, pos.hero[1] - 2, 0];
    if (a.k === 'ball' || a.k === 'puck') {
      if (!(a.after === 'hero' && t > a.tr[a.tr.length - 1][0])) {
        var trail = ''; for (var s = 0; s <= 24; s++) { var tt = Math.max(a.show ? a.show[0] : 0, t - s * .012); var q = _rcAt(a.tr, tt); trail += (s ? ' L' : 'M') + F(q[0]) + ' ' + F(q[1] - q[2]); }
        h += '<path d="' + trail + '" fill="none" stroke="' + (a.k === 'puck' ? 'rgba(20,30,60,.35)' : 'rgba(255,255,255,.55)') + '" stroke-width="2" stroke-linecap="round"/>';
      }
      if (p[2] > 1) h += '<ellipse cx="' + F(p[0]) + '" cy="' + F(p[1]) + '" rx="4" ry="2" fill="rgba(0,0,0,.35)"/>';
      var sc = 1 + p[2] / 70;
      h += a.k === 'puck' ? '<ellipse cx="' + F(p[0]) + '" cy="' + F(p[1]) + '" rx="4.5" ry="3" fill="#111"/>' :
        spec.scene === 'football' ? '<g transform="translate(' + F(p[0]) + ',' + F(p[1] - p[2]) + ') scale(' + sc.toFixed(2) + ')"><ellipse rx="5" ry="3.2" fill="#8B4A22" stroke="#5A2C10" stroke-width=".8"/></g>' :
        spec.scene === 'court' ? '<circle cx="' + F(p[0]) + '" cy="' + F(p[1] - p[2]) + '" r="' + F(4.5 * sc) + '" fill="#E8762A" stroke="#6A2E0A" stroke-width=".8"/>' :
        '<circle cx="' + F(p[0]) + '" cy="' + F(p[1] - p[2]) + '" r="' + F(3.6 * sc) + '" fill="#fff" stroke="#bbb" stroke-width=".6"/>';
    } else {
      var fill = a.k === 'def' ? '#5A6A8A' : col, ring = a.k === 'hero' ? '#F2C869' : dark ? '#fff' : 'rgba(255,255,255,.85)';
      h += '<circle cx="' + F(p[0]) + '" cy="' + F(p[1]) + '" r="' + (a.k === 'hero' ? 7 : 5.5) + '" fill="' + fill + '" stroke="' + ring + '" stroke-width="' + (a.k === 'hero' ? 2.2 : 1.4) + '" opacity="' + (a.k === 'off' ? .85 : 1) + '"/>';
      if (a.k === 'hero' && t > 0) h += '<circle cx="' + F(p[0]) + '" cy="' + F(p[1]) + '" r="' + F(10 + 4 * Math.sin(t * 20)) + '" fill="none" stroke="#F2C869" stroke-width="1" opacity=".5"/>';
    }
  });
  var clk = null;
  (spec.labels || []).forEach(function (l) {
    if (t < l[0]) return; var age = t - l[0];
    if (l[2] === 'clock') { clk = l[1]; return; }
    if (l[2] === 'shot') { h += '<circle cx="' + l[3].toFixed(0) + '" cy="' + l[4].toFixed(0) + '" r="5" fill="' + (l[5] ? '#F2C869' : col) + '" stroke="#fff" stroke-width="1.5"/>'; return; }
    if (l[2] === 'chip') { var tx = _rcEsc(l[1]), w = l[1].length * 7.2 + 16, cx = Math.max(w / 2 + 4, Math.min(356 - w / 2, l[3])), cy = Math.max(12, Math.min(238, l[4])); h += '<g opacity="' + Math.min(1, age * 10) + '"><rect x="' + F(cx - w / 2) + '" y="' + F(cy - 9) + '" width="' + F(w) + '" height="18" rx="9" fill="rgba(0,0,0,.6)"/><text x="' + F(cx) + '" y="' + F(cy + 4) + '" text-anchor="middle" font-size="10.5" font-weight="900" fill="#fff" font-family="-apple-system,sans-serif" letter-spacing=".5">' + tx + '</text></g>'; return; }
    if (l[2] === 'burst') { var s = Math.min(1, age * 8), bs = 1.6 - .6 * s; h += '<g transform="translate(180 128) scale(' + bs.toFixed(2) + ')" opacity="' + s + '"><text text-anchor="middle" y="12" font-size="' + (l[1].length > 11 ? 26 : l[1].length > 8 ? 32 : 40) + '" font-weight="900" font-style="italic" fill="' + col + '" stroke="#fff" stroke-width="5" paint-order="stroke" font-family="-apple-system,sans-serif" letter-spacing="-1">' + _rcEsc(l[1]) + '</text></g>'; return; }
    if (l[2] === 'confetti') { for (var i = 0; i < 40; i++) { var x = (i * 37) % 360, y = -10 + age * 420 * (0.6 + (i % 5) / 6) + ((i * 13) % 40), r = (i * 47 + age * 900) % 360; if (y < 260) h += '<rect x="' + x + '" y="' + y.toFixed(0) + '" width="5" height="9" fill="' + ['#F2C869', '#fff', col, '#A89FE8'][i % 4] + '" transform="rotate(' + r.toFixed(0) + ' ' + x + ' ' + y.toFixed(0) + ')"/>'; } }
  });
  if (clk) h += '<g><rect x="286" y="8" width="66" height="22" rx="7" fill="rgba(0,0,0,.65)"/><text x="319" y="23" text-anchor="middle" font-size="12" font-weight="900" fill="' + (/^0?:?0?0(\.0)?$|^0:00(\.0)?$/.test(clk) ? '#FF6A58' : '#fff') + '" font-family="ui-monospace,Menlo,monospace">' + _rcEsc(clk) + '</text></g>';
  svg.innerHTML = h;
}
function _rcHash(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function _rcBig(m) { return /walk-off|walks it off|wins it|at the buzzer|overtime|shootout|clinch/i.test(m.title || ''); }

// ── baseball ──
var RC_BASE = { B: [180, 230], '1B': [248, 160], '2B': [180, 92], '3B': [112, 160], score: [180, 230] };
var RC_ORDER = ['B', '1B', '2B', '3B', 'score'];
var RC_FIELD = { 1: [180, 166], 2: [180, 242], 3: [236, 150], 4: [210, 118], 5: [124, 150], 6: [150, 118], 7: [84, 76], 8: [180, 50], 9: [276, 76] };
var RC_MLB_WORD = { single: 'BASE HIT', double: 'DOUBLE', triple: 'TRIPLE', sac_fly: 'SAC FLY', strikeout: 'STRIKEOUT', walk: 'BALL FOUR', intent_walk: 'BALL FOUR', hit_by_pitch: 'HIT BY PITCH', field_error: 'ERROR', grounded_into_double_play: 'DOUBLE PLAY', double_play: 'DOUBLE PLAY', fielders_choice: 'SAFE', fielders_choice_out: 'OUT', force_out: 'OUT', field_out: 'OUT', sac_bunt: 'BUNT' };
function _rcMlbLand(a, m) {
  var ft = a.ft, ang = null, txt = String(m.sub || '').toLowerCase();
  if (a.coord) { var dx = a.coord[0] - 125.42, dy = 198.27 - a.coord[1]; ang = Math.atan2(dx, dy); if (!ft) ft = Math.sqrt(dx * dx + dy * dy) * 2.5; }
  if (ang == null) {
    var K = [[/left field line/, -42], [/left-center|left center/, -22], [/right field line/, 42], [/right-center|right center/, 22], [/left field|to left\b/, -32], [/right field|to right\b/, 32], [/center/, 0], [/third baseman/, -36], [/shortstop/, -14], [/second baseman/, 14], [/first baseman/, 36]];
    for (var i = 0; i < K.length; i++) if (K[i][0].test(txt)) { ang = K[i][1] * Math.PI / 180; if (!ft && i >= 7) ft = 110; break; }
    if (ang == null) ang = ((_rcHash(m.title) % 50) - 25) * Math.PI / 180;
  }
  if (!ft) ft = a.ev === 'home_run' ? 405 : ({ ground_ball: 115, line_drive: 230, fly_ball: 300, popup: 160 })[a.traj] || 200;
  ang = Math.max(-0.82, Math.min(0.82, ang));
  var r = ft <= 127 ? ft * 1.1 : 140 + (Math.min(ft, 380) - 127) * 0.2 + Math.max(0, ft - 380) * 0.6;
  r = Math.min(r, 225);
  return { x: 180 + r * Math.sin(ang), y: 232 - r * Math.cos(ang), ft: Math.round(ft) };
}
function _rcBuildMlb(a, m) {
  var actors = [{ k: 'def', tr: [[0, 180, 160]] }], labels = [];
  var hr = a.ev === 'home_run', noBall = /strikeout|walk|hit_by_pitch/.test(a.ev || '') && !a.coord;
  var ball = [[0, 180, 168], [.14, 180, 226]];
  var land = null;
  if (!noBall) {
    land = _rcMlbLand(a, m);
    var arc = hr ? 70 : ({ fly_ball: 55, popup: 90, line_drive: 12, ground_ball: 2 })[a.traj] || 20;
    var tLand = hr ? .56 : a.traj === 'ground_ball' ? .38 : .5;
    ball.push([tLand, land.x, land.y, arc]);
    if (!hr) {
      // who fields it: the credited fielder, or whoever stands closest
      var code = a.fielder && RC_FIELD[a.fielder] ? a.fielder : null;
      if (!code) { var best = 1e9; Object.keys(RC_FIELD).forEach(function (c) { if (c === '1' || c === '2') return; var p = RC_FIELD[c], d = Math.hypot(p[0] - land.x, p[1] - land.y); if (d < best) { best = d; code = c; } }); }
      var fp = RC_FIELD[code] || [180, 50];
      actors.push({ k: 'def', tr: [[0, fp[0], fp[1]], [tLand + .04, land.x + (fp[0] > land.x ? 4 : -4), land.y + 3]] });
      if (a.out && a.traj === 'ground_ball') ball.push([.62, 248, 162, 8]);                      // throw to first
      else if (!a.out) ball.push([.8, 180 + (land.x - 180) * .25, 120 + (land.y < 120 ? 0 : 20), 14]); // back to the infield
    }
  } else if (/strikeout/.test(a.ev)) { ball.push([.3, 182, 241]); }
  actors.push({ k: 'ball', tr: ball });
  // runners — the batter is the hero
  var firstScore = null, runs = 0;
  (a.runners || []).forEach(function (rn) {
    var s = rn[0] || 'B', e = rn[1] || (rn[2] ? null : s), out = !!rn[2], batter = !!rn[3];
    var si = RC_ORDER.indexOf(s === '4B' ? 'score' : s), ei = RC_ORDER.indexOf(e === '4B' ? 'score' : e);
    if (si < 0) si = 0;
    if (ei < 0) ei = out ? Math.min(si + 1, 4) : si;
    var tr = [[0, RC_BASE[RC_ORDER[si]][0], RC_BASE[RC_ORDER[si]][1]]];
    var t = noBall ? .32 : .15, seg = hr ? .21 : .12;
    tr.push([t, tr[0][1], tr[0][2]]);
    for (var i = si + 1; i <= ei; i++) { t += seg; var b = RC_BASE[RC_ORDER[i]]; tr.push([Math.min(1, t), b[0] + (out && i === ei ? (i === 1 ? -8 : 8) : 0), b[1] + (out && i === ei ? 6 : 0)]); }
    if (ei === 4 && !out) { runs++; if (firstScore == null || t < firstScore) firstScore = Math.min(1, t); }
    if (out && ei > si) labels.push([Math.min(.95, t), 'OUT', 'chip', tr[tr.length - 1][1], tr[tr.length - 1][2] + 16]);
    actors.push({ k: batter ? 'hero' : 'off', tr: tr });
  });
  if (!(a.runners || []).some(function (r) { return r[3]; }) && !a.out) actors.push({ k: 'hero', tr: [[0, 180, 230]] });
  var word = a.walkoff ? 'WALK-OFF' : hr ? (a.rbi === 4 ? 'GRAND SLAM' : 'GONE') : (RC_MLB_WORD[a.ev] || (a.out ? 'OUT' : 'SAFE'));
  if (hr && land) labels.push([.56, land.ft + ' FT', 'chip', land.x, land.y + 18]);
  else if (land && land.ft >= 200 && !a.out) labels.push([.52, land.ft + ' FT', 'chip', land.x, land.y + 18]);
  if (runs && !hr) labels.push([firstScore, runs === 1 ? '1 RUN SCORES' : runs + ' RUNS SCORE', 'chip', 180, 212]);
  var tb = hr ? .6 : noBall ? .36 : Math.max(.52, (firstScore || .6) + .02);
  labels.push([tb, word, 'burst']);
  if (a.walkoff || _rcBig(m)) labels.push([tb, '', 'confetti']);
  return { scene: 'baseball', actors: actors, labels: labels };
}

// ── football ── (the team that benefited drives right unless it's an interception return)
function _rcX(y) { return 24 + Math.max(-7.5, Math.min(107.5, y)) * 3.12; }
function _rcBuildFb(a, m, col, opp) {
  var from = a.from != null ? a.from : 50, to = a.to != null ? a.to : from + (a.yds || 0);
  var lanes = { l: 78, m: 125, r: 172 }, ly = lanes[a.lane] || 125;
  var L = _rcX(from), actors = [], labels = [], spec = { scene: 'football', lez: opp, rez: col, actors: actors, labels: labels };
  var line = function (kOff, kDef) {
    for (var i = 0; i < 5; i++) { actors.push({ k: kOff, tr: [[0, L - 5, 105 + i * 10], [.3, L - 2, 105 + i * 10]] }); actors.push({ k: kDef, tr: [[0, L + 5, 104 + i * 10.5], [.3, L + 1, 104 + i * 10.5]] }); }
  };
  var yds = a.yds != null ? a.yds : Math.round(to - from);
  var endT = .78;
  if (a.clock) labels.push([0, a.clock, 'clock']);
  if (a.kind === 'fg') {
    var d = a.to || (100 - from + 17), spot = 110 - d, los = spot + 7;
    L = _rcX(los);
    for (var i = 0; i < 5; i++) { actors.push({ k: 'off', tr: [[0, L - 4, 104 + i * 8]] }); actors.push({ k: 'def', tr: [[0, L + 6, 102 + i * 9], [.3, L + 2, 103 + i * 9]] }); }
    actors.push({ k: 'off', tr: [[0, _rcX(spot), 116]] });
    actors.push({ k: 'hero', tr: [[0, _rcX(spot) - 12, 120], [.26, _rcX(spot) - 3, 114]] });
    actors.push({ k: 'ball', tr: [[0, L - 2, 110], [.12, _rcX(spot), 112], [.28, _rcX(spot), 112], [.82, a.good === false ? 354 : 354, a.good === false ? 98 : 124, 62]] });
    labels.push([.83, a.good === false ? 'NO GOOD' : 'GOOD', 'burst'], [.84, d + ' YDS', 'chip', 300, 60]);
    if (a.clock && _rcBig(m)) labels.push([.82, '0:00', 'clock'], [.84, '', 'confetti']);
    return spec;
  }
  if (a.kind === 'int') {
    // the passing team (gray) goes right; the defender (hero) takes it back left
    spec.lez = col; spec.rez = opp;
    line('def', 'off');
    var cx = _rcX(from + 12), end = a.td ? -4 : from + 12 - (a.ret || 15);
    actors.push({ k: 'def', tr: [[0, L - 3, 125], [.15, L - 20, 125]] });
    actors.push({ k: 'def', tr: [[0, L, ly - 40], [.45, cx + 8, ly]] });
    actors.push({ k: 'hero', tr: [[0, L + 30, ly - 10], [.45, cx, ly], [.9, _rcX(end), ly + (ly < 125 ? 20 : -20)]] });
    actors.push({ k: 'ball', tr: [[0, L - 3, 125], [.14, L - 20, 125], [.45, cx, ly, 30]], after: 'hero' });
    labels.push([.92, a.td ? 'PICK-SIX' : 'PICKED OFF', 'burst']);
    if (a.ret) labels.push([.92, a.ret + ' YD RETURN', 'chip', _rcX(end) + 20, ly - 22]);
    return spec;
  }
  if (a.kind === 'ret') {
    var st = Math.max(2, (a.td ? 100 : to) - Math.max(20, yds || 60));
    actors.push({ k: 'def', tr: [[0, _rcX(st + 40), 70], [.8, _rcX(Math.min(100, st + 70)), 110]] });
    actors.push({ k: 'def', tr: [[0, _rcX(st + 35), 170], [.8, _rcX(Math.min(100, st + 60)), 150]] });
    actors.push({ k: 'hero', tr: [[0, _rcX(st), 125], [.22, _rcX(st), 125], [.45, _rcX(st + (yds || 60) * .35), 88], [.62, _rcX(st + (yds || 60) * .65), 160], [.85, _rcX(a.td ? 104 : to), 120]] });
    actors.push({ k: 'ball', tr: [[0, _rcX(st + 45), 60], [.22, _rcX(st), 125, 80]], after: 'hero' });
    labels.push([.87, a.td ? 'TOUCHDOWN' : 'BIG RETURN', 'burst'], [.87, (yds || '') + ' YDS', 'chip', _rcX(a.td ? 100 : to) - 20, 60]);
    return spec;
  }
  line('off', 'def');
  var target = a.td ? 104 : to;
  if (a.kind === 'pass' || a.kind === 'inc') {
    var catchY = a.kind === 'inc' ? Math.min(98, from + Math.max(8, Math.abs(yds || 12))) : a.td && yds > 15 ? Math.min(98, from + yds * .7) : from + Math.max(5, (yds || 10) * .6);
    var wide = ly === 78 ? 40 : ly === 172 ? 210 : 70;
    var CX = _rcX(catchY), air = catchY - (from - 7);
    actors.push({ k: 'off', tr: [[0, L - 3, 125], [.15, _rcX(from - 7), 125]] });
    actors.push({ k: 'def', tr: [[0, L + 24, wide + 10], [.5, CX + 10, ly + 6], [.8, _rcX(target) - 16, ly + 12]] });
    actors.push({ k: 'hero', tr: [[0, L - 2, wide], [.5, CX, ly], [.8, a.kind === 'inc' ? CX + 6 : _rcX(target), ly + 4]] });
    var arc = Math.min(90, 20 + air * 1.2);
    if (a.kind === 'inc') {
      actors.push({ k: 'ball', tr: [[0, L - 3, 125], [.15, _rcX(from - 7), 125], [.5, CX + 3, ly - 2, arc], [.62, CX + 14, ly + 12, 6]] });
      labels.push([.6, 'INCOMPLETE', 'burst']);
      return spec;
    }
    actors.push({ k: 'ball', tr: [[0, L - 3, 125], [.15, _rcX(from - 7), 125], [.5, CX, ly, arc]], after: 'hero' });
    endT = .82;
  } else if (a.kind === 'sack') {
    actors.push({ k: 'off', tr: [[0, L - 3, 125], [.2, _rcX(from - 7), 125], [.5, _rcX(from - 8), 128]] });
    actors.push({ k: 'hero', tr: [[0, L + 5, 150], [.45, _rcX(from - 7) + 4, 128]] });
    actors.push({ k: 'ball', tr: [[0, L - 3, 125], [.2, _rcX(from - 7), 125]] });
    labels.push([.5, 'SACK', 'burst'], [.52, Math.abs(yds || 0) + ' YD LOSS', 'chip', _rcX(from - 8), 160]);
    return spec;
  } else {
    actors.push({ k: 'off', tr: [[0, L - 3, 125], [.1, L - 8, 125]] });
    actors.push({ k: 'def', tr: [[0, L + 26, ly + 30], [.8, _rcX(target) - 18, ly + 14]] });
    actors.push({ k: 'hero', tr: [[0, _rcX(from - 6), 125], [.16, L, ly], [.5, _rcX(from + (target - from) * .5), ly + (ly < 125 ? 16 : -16)], [.78, _rcX(target), ly]] });
    actors.push({ k: 'ball', tr: [[0, L - 3, 125], [.12, _rcX(from - 6), 125]], after: 'hero' });
  }
  if (a.td) labels.push([endT, 'TOUCHDOWN', 'burst']);
  else labels.push([endT, a.kind === 'fum' ? 'FUMBLE' : yds >= 20 ? 'BIG PLAY' : 'FIRST DOWN', 'burst']);
  if (yds) labels.push([endT + .01, yds + ' YDS', 'chip', Math.min(320, _rcX(target)), ly < 125 ? ly + 36 : ly - 36]);
  if (a.clock && _rcBig(m)) labels.push([endT, '0:00', 'clock'], [endT, '', 'confetti']);
  return spec;
}

// ── basketball ──
function _rcBkPt(side, dist) { var r = Math.max(12, Math.min(205, (dist || 12) * 7)), an = (side || 0) * 1.3; return [180 + r * Math.sin(an), 40 + r * Math.cos(an)]; }
function _rcBuildBk(a, m) {
  var actors = [], labels = [];
  if (a.k === 'bkchart') {
    var shots = a.shots || [], n = shots.length || 1;
    shots.forEach(function (s, i) { var p = _rcBkPt(s[0], s[1]); labels.push([.05 + i * (.8 / n), '', 'shot', p[0], p[1], s[2]]); });
    var pts = (String(m.title).match(/(\d+)\s*$/) || [])[1];
    labels.push([.9, (pts || '') + ' POINTS', 'burst']);
    return { scene: 'court', actors: actors, labels: labels };
  }
  var p = _rcBkPt(a.side, a.kind === 'ft' ? 15 : a.dist), drive = a.kind === 'dunk' || a.kind === 'layup';
  var sx = p[0] + (a.side || 0) * -24, sy = Math.min(236, p[1] + 50);
  if (drive) { p = [180 + (a.side || .3) * 40, 150]; sx = p[0] + (a.side || .3) * 40; sy = 214; }
  actors.push({ k: 'def', tr: [[0, (sx + 180) / 2, sy - 30], [.3, p[0] + 10, p[1] - 12], [.45, p[0] + 6, p[1] - 16]] });
  if (drive) {
    actors.push({ k: 'hero', tr: [[0, sx, sy], [.3, p[0], p[1]], [.52, 180, 54]] });
    actors.push({ k: 'ball', tr: [[0, sx + 4, sy + 4], [.3, p[0] + 4, p[1] + 4], [.52, 182, 50], [.58, 180, 40, 10]] });
  } else {
    actors.push({ k: 'hero', tr: [[0, sx, sy], [.3, p[0], p[1]]] });
    actors.push({ k: 'ball', tr: [[0, sx + 4, sy + 4], [.3, p[0] + 3, p[1] + 3], [.36, p[0] + 2, p[1] - 2], [.74, 180, 40, 30 + (a.dist || 12) * 2.4]] });
  }
  var tHit = drive ? .6 : .76;
  if (a.clock) labels.push([0, a.clock, 'clock']);
  if (a.buzzer) labels.push([tHit - .1, '0:00.0', 'clock']);
  labels.push([tHit, a.buzzer ? 'BUZZER-BEATER' : a.kind === 'dunk' ? 'SLAM' : a.kind === 'three' ? 'SPLASH' : a.kind === 'ft' ? 'FREE THROW' : 'BUCKET', 'burst']);
  if (a.dist && !drive && a.kind !== 'ft') labels.push([tHit + .02, a.dist + ' FT', 'chip', 180, 110]);
  if (a.buzzer || _rcBig(m)) labels.push([tHit, '', 'confetti']);
  return { scene: 'court', actors: actors, labels: labels };
}

// ── hockey ──
function _rcBuildHk(a, m) {
  var actors = [], labels = [], title = String(m.title || '');
  if (a.so) {
    actors.push({ k: 'def', tr: [[0, 180, 52], [.55, 160, 54], [.64, 190, 52], [.74, 176, 50]] });
    actors.push({ k: 'hero', tr: [[0, 180, 236], [.4, 180, 120], [.55, 150, 80], [.66, 196, 68]] });
    actors.push({ k: 'puck', tr: [[0, 186, 230], [.4, 186, 116], [.55, 156, 82], [.66, 198, 70], [.78, 180, 32]] });
    labels.push([.8, 'GOAL', 'burst'], [.82, 'SHOOTOUT', 'chip', 180, 100], [.8, '', 'confetti']);
    return { scene: 'rink', actors: actors, labels: labels };
  }
  if (/goalie goal/i.test(title)) {
    actors.push({ k: 'puck', tr: [[0, 180, 262], [.8, 180, 32]] });
    labels.push([0, 'EMPTY NET', 'chip', 180, 100], [.84, 'GOALIE GOAL', 'burst'], [.84, '', 'confetti']);
    return { scene: 'rink', actors: actors, labels: labels };
  }
  var h = _rcHash(title), depth = a.depth != null ? a.depth : 18 + h % 30, lat = a.lat != null ? a.lat : ((h % 50) - 25);
  var x = Math.max(34, Math.min(326, 180 + lat * 2.7)), y = Math.max(56, Math.min(226, 40 + depth * 2.7));
  var side = x > 180 ? 1 : -1, net = 180 + (x > 180 ? -9 : 9);
  if (!a.en) actors.push({ k: 'def', tr: [[0, 180, 50], [.45, 180 + side * 8, 51], [.62, 180 + side * 10, 52]] });
  actors.push({ k: 'def', tr: [[0, x - side * 30, y - 20], [.4, x - side * 10, y - 12]] });
  actors.push({ k: 'hero', tr: [[0, x + side * 40, Math.min(240, y + 60)], [.4, x, y]] });
  actors.push({ k: 'puck', tr: [[0, x + side * 44, Math.min(240, y + 64)], [.4, x + 4, y + 4], [.46, x + 2, y - 2], [.62, net, 32]] });
  var word = /hat trick/i.test(title) ? 'HAT TRICK' : 'GOAL';
  labels.push([.64, word, 'burst']);
  if (a.en) labels.push([.1, 'EMPTY NET', 'chip', 180, 90]);
  else if (/overtime/i.test(title) || m.when === 'OT') labels.push([.66, 'OVERTIME', 'chip', 180, 200]);
  if (a.depth != null) labels.push([.66, Math.round(Math.hypot(depth, lat)) + ' FT', 'chip', x, y + 18]);
  if (word !== 'GOAL' || _rcBig(m)) labels.push([.64, '', 'confetti']);
  return { scene: 'rink', actors: actors, labels: labels };
}

// ── soccer ──
function _rcBuildSc(a, m) {
  var s = a.side || 1, actors = [], labels = [], corner = 180 + s * 16, tg = [[.7, corner, 9]];
  actors.push({ k: 'def', tr: [[0, 180, 18], [.55, 180 - s * 14, 20]] }); // keeper, the wrong way
  if (a.t === 'pen') {
    actors.push({ k: 'hero', tr: [[0, 180 - s * 10, 118], [.35, 182, 88]] });
    actors.push({ k: 'ball', tr: [[0, 180, 80], [.35, 180, 80], [.6, corner, 9, 8]] });
    labels.push([.62, 'GOAL', 'burst'], [.64, 'PENALTY', 'chip', 180, 196]);
  } else if (a.t === 'header') {
    var hx = 180 - s * 22;
    actors.push({ k: 'def', tr: [[0, hx + 12, 56], [.45, hx + 6, 50]] });
    actors.push({ k: 'hero', tr: [[0, hx - s * 20, 110], [.45, hx, 50]] });
    actors.push({ k: 'off', tr: [[0, 180 + s * 150, 60], [.12, 180 + s * 160, 52]] });
    actors.push({ k: 'ball', tr: [[0, 180 + s * 150, 62], [.12, 180 + s * 162, 54], [.45, hx, 48, 46], [.62, corner, 9, 4]] });
    labels.push([.64, 'GOAL', 'burst'], [.66, 'HEADER', 'chip', 180, 196]);
  } else if (a.t === 'fk') {
    var fx = 180 + s * 70;
    for (var i = 0; i < 4; i++) actors.push({ k: 'def', tr: [[0, fx - s * (26 + i * 9), 116 - i * 4]] });
    actors.push({ k: 'hero', tr: [[0, fx + s * 12, 164], [.3, fx + s * 3, 146]] });
    actors.push({ k: 'ball', tr: [[0, fx, 142], [.3, fx, 142], [.72, 180 - s * 20, 8, 60]] });
    labels.push([.74, 'GOAL', 'burst'], [.76, 'FREE KICK', 'chip', 180, 190]);
  } else if (a.t === 'og') {
    actors.push({ k: 'hero', tr: [[0, 180 + s * 150, 40], [.1, 180 + s * 156, 34]] });
    actors.push({ k: 'def', tr: [[0, 180 + s * 30, 60], [.4, 180 + s * 10, 30]] });
    actors.push({ k: 'ball', tr: [[0, 180 + s * 150, 42], [.4, 180 + s * 12, 30, 24], [.58, 180 - s * 6, 9, 3]] });
    labels.push([.6, 'OWN GOAL', 'burst']);
  } else {
    var px = 180 + s * 50;
    actors.push({ k: 'def', tr: [[0, px + s * 20, 150], [.4, px + s * 6, 116]] });
    actors.push({ k: 'hero', tr: [[0, 180 + s * 80, 176], [.4, px, 110]] });
    actors.push({ k: 'ball', tr: [[0, 180 + s * 86, 180], [.4, px - s * 3, 106], [.64, 180 - s * 18, 9, 10]] });
    labels.push([.66, 'GOAL', 'burst']);
  }
  if (a.min) labels.push([.7, a.min + '′', 'chip', 180 + s * 90, 150]);
  if (_rcBig(m) || a.min >= 85) labels.push([.66, '', 'confetti']);
  return { scene: 'pitch', actors: actors, labels: labels };
}
function _rcSpec(r, m) {
  var a = m.anim || {}, g = r._games[String(m.gameId)], t = _rcTeam(r, m.team);
  var col = (t.colors && t.colors.accent) || '#A89FE8';
  var opp = g ? (g.home.abbr === t.abbr ? g.away : g.home) : null, oppCol = opp && opp.colors ? opp.colors.bg : '#3D3580';
  try {
    if (a.k === 'mlb') return _rcBuildMlb(a, m);
    if (a.k === 'fb') return _rcBuildFb(a, m, (t.colors && t.colors.bg) || col, oppCol);
    if (a.k === 'bk' || a.k === 'bkchart') return _rcBuildBk(a, m);
    if (a.k === 'hk') return _rcBuildHk(a, m);
    if (a.k === 'sc') return _rcBuildSc(a, m);
  } catch (e) { console.error('Recap animation error:', e); }
  return null;
}

// ═══ STORY PLAYER ═══════════════════════════════════════════════════════
window._rc = { cur: 0, si: 0, raf: null, t0: 0, a0: 0, pausedAt: 0, slides: null };
function _rcBg(t) { var c = (t && t.colors && t.colors.bg) || '#3D3580'; return 'background:radial-gradient(120% 70% at 50% 100%,' + c + 'bb,transparent 65%),linear-gradient(180deg,#140E34,#05030F)'; }
function _rcWpSvg(d, fill) {
  var pts = d.map(function (v, i) { return (i / (d.length - 1) * 300).toFixed(0) + ' ' + (70 - v * .6).toFixed(1); }).join(' L');
  return '<svg viewBox="0 0 300 70" preserveAspectRatio="none" aria-hidden="true"><line x1="0" x2="300" y1="40" y2="40" stroke="rgba(255,255,255,.2)" stroke-dasharray="3 4"/><path d="M' + pts + ' L300 70 L0 70Z" fill="' + fill + '" opacity=".3"/><path class="rc-draw" d="M' + pts + '" fill="none" stroke="#fff" stroke-width="2.2"/></svg>';
}
function _rcFinal(r, g) {
  if (!g) return '';
  var aw = g.away.score > g.home.score;
  return '<button class="rc-fin" onclick="event.stopPropagation();recapsOpenGame(\'' + _rcEsc(String(g.id)) + '\')"><span class="rc-kk rc-kk-dim">' + _rcEsc(g.note || 'FINAL').toUpperCase() + '</span>' + _rcLo(g.away, 's') + '<span class="' + (aw ? '' : 'rc-lz') + '">' + g.away.score + '</span><span class="rc-lz">–</span><span class="' + (aw ? 'rc-lz' : '') + '">' + g.home.score + '</span>' + _rcLo(g.home, 's') + '<span class="rc-go">Open game ›</span></button>';
}
function _rcYours(r) {
  var favs = (window._favTeamsCache || {})[r.league];
  if (!favs) return null;
  var names = [favs.favorite].concat(favs.following || []).filter(Boolean);
  for (var i = 0; i < names.length; i++) {
    var n = names[i];
    var g = (r.games || []).filter(function (x) { return x.away.name === n || x.home.name === n; })[0];
    if (r.sport === 'mlbw' && r.teamWeek && r.teamWeek[n]) {
      var wk = r.teamWeek[n], team = g ? (g.home.name === n ? g.home : g.away) : _rcTeam(r, { name: n, abbr: '' });
      var race = (r.race || []).filter(function (x) { return x.name === n; })[0];
      if (!team.abbr && race) team = Object.assign({}, team, { abbr: race.abbr, colors: _rcColors('mlb', { abbr: race.abbr }) });
      var short = typeof _teamShortName === 'function' ? _teamShortName(n) : n;
      return { team: team, title: 'The ' + short + ' went ' + wk[0] + '–' + wk[1] + ' this week', sub: race ? race.rec + ' · ' + race.status : '', game: g || null };
    }
    if (g) {
      var mine = g.home.name === n ? g.home : g.away, other = mine === g.home ? g.away : g.home, won = mine.score > other.score;
      var mo = (r.moments || []).filter(function (m) { return String(m.gameId) === String(g.id); })[0];
      var sn = function (t) { return typeof _teamShortName === 'function' ? _teamShortName(t.name) : t.short || t.name; };
      var w = won ? mine : other, l = won ? other : mine;
      return { team: mine, title: sn(w) + ' ' + w.score + ', ' + sn(l) + ' ' + l.score + (g.note && g.note !== 'Final' ? ' (' + g.note.replace(/^F\//, '') + ')' : ''), sub: mo ? mo.title + '.' : (won ? 'A win' : 'A loss') + (g.date ? ' on ' + new Date(g.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' }) : '') + '.', game: g };
    }
  }
  return null;
}
function _rcSlides(r) {
  var s = [], week = _rcIsWeek(r), h = r.hero, hg = h && r._games[String(h.gameId)];
  s.push({ dur: 4500, html: '<div class="rc-slide rc-end"><div class="rc-bgA" style="background:radial-gradient(90% 60% at 50% 30%,rgba(242,200,105,.3),transparent 70%),linear-gradient(180deg,#1d1450,#05030F)"></div><span class="rc-kk">' + _rcEsc(r.kick) + '</span><div class="rc-big">' + _rcEsc(r.title) + '</div><div class="rc-sm">' + _rcEsc(r.dek) + '</div></div>' });
  if (hg) {
    var w = _rcWinner(hg), wp = h.wp && h.wp.length > 3 ? (w === hg.home ? h.wp : h.wp.map(function (v) { return 100 - v; })) : null;
    s.push({ dur: 6000, html: '<div class="rc-slide rc-end"><div class="rc-bgA" style="' + _rcBg(w) + '"></div><span class="rc-kk">' + (week ? 'GAME OF THE WEEK' : 'GAME OF THE DAY') + '</span>' +
      '<div class="rc-scbig"><div class="rc-tm">' + _rcLo(hg.away, 'l') + '<b class="' + (w === hg.away ? '' : 'rc-lose') + '">' + hg.away.score + '</b></div><span class="rc-kk rc-kk-dim">' + _rcEsc(hg.note || 'Final').toUpperCase() + '</span><div class="rc-tm">' + _rcLo(hg.home, 'l') + '<b class="' + (w === hg.home ? '' : 'rc-lose') + '">' + hg.home.score + '</b></div></div>' +
      '<div class="rc-mid">' + _rcEsc(h.line) + '</div>' +
      (wp ? '<div class="rc-kk rc-kk-dim">WIN PROBABILITY · ' + _rcEsc(w.abbr) + '</div><div class="rc-wp">' + _rcWpSvg(wp, (w.colors && w.colors.accent) || '#A89FE8') + '</div>' : '') +
      '<div class="rc-cta"><button onclick="event.stopPropagation();recapsOpenGame(\'' + _rcEsc(String(hg.id)) + '\')">Open game ›</button></div></div>' });
  }
  (r.moments || []).forEach(function (m, i) {
    var t = _rcTeam(r, m.team), g = r._games[String(m.gameId)];
    var chip = g ? _rcEsc(g.away.abbr + ' @ ' + g.home.abbr) + (m.when ? ' · ' + _rcEsc(m.when) : '') : _rcEsc(m.when || '');
    s.push({ dur: 8500, moment: m, col: (t.colors && t.colors.accent) || '#A89FE8', html: '<div class="rc-slide rc-mo"><div class="rc-bgA" style="' + _rcBg(t) + '"></div>' +
      '<div class="rc-anim"><span class="rc-gm">' + _rcLo(t, 's') + chip + '</span><svg viewBox="0 0 360 250" class="rc-asvg" role="img" aria-label="' + _rcEsc(m.title) + '"></svg><button class="rc-rp" onclick="event.stopPropagation();recapsReplay()">↻ Replay</button></div>' +
      '<span class="rc-kk" style="margin-top:6px">' + (i === 0 ? 'MOMENT OF THE ' + (week ? 'WEEK' : 'DAY') : 'NO. ' + (i + 1)) + '</span><div class="rc-mid">' + _rcEsc(m.title) + '</div><div class="rc-sm">' + _rcEsc(m.sub) + '</div>' +
      (m.swing >= 5 ? '<div class="rc-row"><span class="rc-tag">+' + m.swing + '% WIN PROBABILITY</span></div>' : '') + _rcFinal(r, g) + '</div>' });
  });
  var games = (r.games || []).slice().sort(function (a, b) { return (b.ex || 0) - (a.ex || 0); }).slice(0, 10);
  s.push({ dur: 5500, html: '<div class="rc-slide rc-end"><div class="rc-bgA" style="background:linear-gradient(180deg,#1d1450,#05030F)"></div>' +
    ((r.nums || []).length ? '<span class="rc-kk">BY THE NUMBERS</span><div class="rc-nums">' + r.nums.map(function (n) { return '<div><b>' + _rcEsc(n[0]) + '</b><span>' + _rcEsc(n[1]) + '</span></div>'; }).join('') + '</div>' : '') +
    '<span class="rc-kk" style="margin-top:6px">AROUND THE LEAGUE</span><div class="rc-mini">' + games.map(function (g) { var aw = g.away.score > g.home.score; return '<button onclick="event.stopPropagation();recapsOpenGame(\'' + _rcEsc(String(g.id)) + '\')">' + _rcLo(g.away, 's') + '<span class="' + (aw ? 'rc-w' : 'rc-lz') + '">' + g.away.score + '</span><span style="opacity:.4">–</span><span class="' + (aw ? 'rc-lz' : 'rc-w') + '">' + g.home.score + '</span>' + _rcLo(g.home, 's') + '</button>'; }).join('') + '</div></div>' });
  if (r.race && r.race.length) {
    s.push({ dur: 6000, html: '<div class="rc-slide rc-end"><div class="rc-bgA" style="background:radial-gradient(90% 60% at 50% 20%,rgba(124,242,156,.18),transparent 70%),linear-gradient(180deg,#1d1450,#05030F)"></div><span class="rc-kk">THE RACE</span><div class="rc-mid">How the contenders played this week</div><div class="rc-race">' +
      r.race.map(function (x) { var t = { abbr: x.abbr, colors: _rcColors('mlb', { abbr: x.abbr }) }; return '<div>' + _rcLo(t, 's') + '<span class="rc-rn">' + _rcEsc(typeof _teamShortName === 'function' ? _teamShortName(x.name) : x.name) + '<small>' + _rcEsc(x.rec + (x.status ? ' · ' + x.status : '')) + '</small></span><b class="' + (x.net > 0 ? 'rc-up' : x.net < 0 ? 'rc-down' : '') + '">' + _rcEsc(x.week) + '</b></div>'; }).join('') + '</div></div>' });
  }
  var y = _rcYours(r);
  if (y) {
    s.push({ dur: 6000, yours: y, html: '<div class="rc-slide rc-end"><div class="rc-bgA" style="' + _rcBg(y.team) + '"></div><span class="rc-kk" style="color:#7CF29C">YOUR TEAM</span>' + _rcLo(y.team, 'l') + '<div class="rc-big" style="font-size:32px">' + _rcEsc(y.title) + '</div><div class="rc-sm">' + _rcEsc(y.sub) + '</div>' +
      '<div class="rc-cta"><button onclick="event.stopPropagation();recapsShare()">↗ Share</button>' + (y.game ? '<button onclick="event.stopPropagation();recapsSaveMemory(\'' + _rcEsc(String(y.game.id)) + '\')">★ Save to memories</button>' : '') + '</div></div>' });
  }
  return s;
}
function _rcEl() {
  var el = document.getElementById('rc-story');
  if (!el) {
    el = document.createElement('div'); el.id = 'rc-story'; el.className = 'rc-story'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Recap story');
    document.body.appendChild(el);
    document.addEventListener('keydown', function (e) {
      if (!el.classList.contains('rc-on')) return;
      if (e.key === 'Escape') recapsClose(); else if (e.key === 'ArrowRight') recapsStep(1); else if (e.key === 'ArrowLeft') recapsStep(-1);
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden && el.classList.contains('rc-on')) _rcPause(); else if (!document.hidden && window._rc.pausedAt) _rcResume(); });
  }
  return el;
}
function recapsOpen(i) {
  var R = window._rc; R.list = (window._rcOrder || window._rcList).slice(); R.cur = i; R.si = 0; R.slides = null;
  if (!R.list[i]) return;
  var el = _rcEl(); el.classList.add('rc-on');
  document.documentElement.classList.add('rc-lock');
  _rcShow();
}
function recapsClose() {
  var R = window._rc; cancelAnimationFrame(R.raf); R.pausedAt = 0;
  var el = document.getElementById('rc-story'); if (el) { el.classList.remove('rc-on'); el.innerHTML = ''; }
  document.documentElement.classList.remove('rc-lock');
  _rcRenderRings();
}
function _rcShow() {
  var R = window._rc, r = R.list[R.cur];
  if (!R.slides) R.slides = _rcSlides(r);
  var S = R.slides, s = S[R.si];
  _rcMarkSeen(r.id);
  var el = _rcEl();
  el.innerHTML = '<div class="rc-stage"><div class="rc-bars">' + S.map(function (_, i) { return '<i class="' + (i < R.si ? 'rc-done' : '') + '"><b></b></i>'; }).join('') + '</div>' +
    '<div class="rc-top"><span class="rc-lo rc-lo-s" style="background:#3D3580;color:#fff">' + r._emoji + '</span>' + _rcEsc(r.title) + '<span style="opacity:.55;font-weight:600">· Recap</span><button class="rc-x" onclick="recapsClose()" aria-label="Close">✕</button></div>' + s.html +
    '<button class="rc-tap rc-tap-l" aria-label="Previous"></button><button class="rc-tap rc-tap-r" aria-label="Next"></button></div>';
  // tap to step, press and hold to pause
  [['.rc-tap-l', -1], ['.rc-tap-r', 1]].forEach(function (x) {
    var b = el.querySelector(x[0]), down = 0;
    b.addEventListener('pointerdown', function () { down = Date.now(); _rcPause(); });
    b.addEventListener('pointerup', function () { var held = Date.now() - down; _rcResume(); if (held < 260) recapsStep(x[1]); });
    b.addEventListener('pointerleave', function () { if (window._rc.pausedAt) _rcResume(); });
    b.addEventListener('click', function (e) { if (e.detail === 0) recapsStep(x[1]); }); // keyboard
  });
  R.t0 = R.a0 = performance.now(); R.pausedAt = 0;
  _rcLoop();
}
function _rcPause() { var R = window._rc; if (!R.pausedAt) { R.pausedAt = performance.now(); cancelAnimationFrame(R.raf); } }
function _rcResume() { var R = window._rc; if (!R.pausedAt) return; var d = performance.now() - R.pausedAt; R.t0 += d; R.a0 += d; R.pausedAt = 0; _rcLoop(); }
function recapsReplay() { var R = window._rc; R.a0 = performance.now(); R.t0 = Math.min(R.t0, R.a0); _rcLoop(); }
function _rcLoop() {
  var R = window._rc, el = document.getElementById('rc-story');
  cancelAnimationFrame(R.raf);
  var s = R.slides[R.si], r = R.list[R.cur];
  var svg = el.querySelector('.rc-asvg'), bar = el.querySelectorAll('.rc-bars i b')[R.si];
  if (s.moment && !s.spec) s.spec = _rcSpec(r, s.moment) || false;
  var AD = 6200, reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (svg && !s.spec) { var box = svg.parentNode; if (box) box.style.display = 'none'; }
  var f = function (now) {
    var p = Math.min(1, (now - R.t0) / s.dur);
    if (bar) bar.style.width = (p * 100) + '%';
    if (s.spec && svg) _rcDraw(svg, s.spec, s.col, reduce ? 1 : Math.min(1, (now - R.a0) / AD));
    if (p >= 1) { recapsStep(1); return; }
    R.raf = requestAnimationFrame(f);
  };
  R.raf = requestAnimationFrame(f);
}
function recapsStep(d) {
  var R = window._rc; R.si += d;
  if (R.si < 0) { if (R.cur > 0) { R.cur--; R.slides = _rcSlides(R.list[R.cur]); R.si = R.slides.length - 1; } else R.si = 0; }
  else if (R.si >= R.slides.length) { if (R.cur < R.list.length - 1) { R.cur++; R.si = 0; R.slides = null; } else { recapsClose(); return; } }
  _rcShow();
}
function _rcGame(id) { var r = window._rc.list[window._rc.cur]; return { r: r, g: r && r._games[String(id)] }; }
function recapsOpenGame(id) {
  var x = _rcGame(id); if (!x.g) return;
  recapsClose();
  if (typeof openGameScreen === 'function') openGameScreen(x.g.id, x.g.away.name, x.g.home.name, x.r.league, x.g.date);
}
function recapsShare() {
  var R = window._rc, r = R.list[R.cur], s = R.slides[R.si], y = s && s.yours;
  var text = y ? y.title + (y.sub ? ' — ' + y.sub : '') : r.title + ': ' + r.dek;
  var url = location.origin;
  if (navigator.share) { _rcPause(); navigator.share({ title: r.title, text: text, url: url }).catch(function () {}).then(_rcResume); return; }
  var done = function () { if (typeof ib_toast === 'function') ib_toast('Copied to share'); };
  try { navigator.clipboard.writeText(text + ' ' + url).then(done, done); } catch (e) { done(); }
}
function recapsSaveMemory(id) {
  var x = _rcGame(id); if (!x.g) return;
  var sport = x.r.league, g = x.g;
  recapsClose();
  if (typeof nav !== 'function') return;
  nav('create-group');
  if (typeof chooseMomentType === 'function') chooseMomentType('past');
  if (typeof mnPickKind === 'function') mnPickKind('game');
  var d = document.getElementById('moment-date'); if (d && g.date) d.value = g.date;
  window._bsModalContext = { type: 'moment-create' };
  window._bsModalSport = sport;
  fetch(_bsModalBoxscoreUrl(sport, g.id)).then(function (r) { return r.json(); })
    .then(function (box) { window._bsModalContext = { type: 'moment-create' }; window._bsModalSport = sport; _applyBoxScoreToContext(box); if (typeof mnRenderStub === 'function' && window._stubMode === 'game') mnRenderStub(); })
    .catch(function (err) { console.error('Recap save error:', err); if (typeof ib_toast === 'function') ib_toast('Couldn’t attach the game — add it from the stub'); });
}
