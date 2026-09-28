// ═══ POSTSEASON (v6.8.0) ═══════════════════════════════════════════════
// Games from Wild Card to World Series carry the round (gameType F/D/L/W),
// its game number and the series status from MLB's schedule. The whole
// season's postseason games (/api/mlb?mode=postseason) drive the bracket,
// each series' strip, and whether a win clinched it.
var PS_ROUND = {
  F: { name: 'Wild Card Series', rc: '#5AD1C9', rc2: '#1E6F6A', best: 3, next: 'DS' },
  D: { name: 'Division Series', rc: '#B8C8F2', rc2: '#2E3A66', best: 5, next: 'CS' },
  L: { name: 'Championship Series', rc: '#D6A8FF', rc2: '#4A2A73', best: 7, next: 'WS' },
  W: { name: 'World Series', rc: '#F2C869', rc2: '#6B4A12', best: 7, next: null }
};
var PS_EMB = {
  F: '<svg width="40" height="40" viewBox="0 0 46 46" aria-hidden="true"><rect x="9" y="8" width="22" height="30" rx="4" transform="rotate(-10 20 23)" fill="none" stroke="#5AD1C9" stroke-width="2"/><rect x="15" y="8" width="22" height="30" rx="4" transform="rotate(8 26 23)" fill="rgba(90,209,201,.18)" stroke="#5AD1C9" stroke-width="2"/></svg>',
  D: '<svg width="40" height="40" viewBox="0 0 46 46" aria-hidden="true"><path d="M23 5l5 10 11 1.6-8 7.8 2 11L23 30l-10 5.4 2-11-8-7.8L18 15z" fill="rgba(184,200,242,.18)" stroke="#B8C8F2" stroke-width="2" stroke-linejoin="round"/></svg>',
  L: '<svg width="40" height="40" viewBox="0 0 46 46" aria-hidden="true"><path d="M8 34h30l-3-18-7 7-5-12-5 12-7-7z" fill="rgba(214,168,255,.18)" stroke="#D6A8FF" stroke-width="2" stroke-linejoin="round"/><rect x="8" y="35" width="30" height="4" rx="2" fill="#D6A8FF"/></svg>',
  W: '<svg width="40" height="40" viewBox="0 0 46 46" aria-hidden="true"><path d="M15 8h16v8a8 8 0 0 1-16 0z" fill="rgba(242,200,105,.22)" stroke="#F2C869" stroke-width="2"/><path d="M15 11h-5a5 5 0 0 0 5 7M31 11h5a5 5 0 0 1-5 7" fill="none" stroke="#F2C869" stroke-width="2"/><path d="M23 24v7M17 38h12l-2-7h-8z" fill="rgba(242,200,105,.22)" stroke="#F2C869" stroke-width="2" stroke-linejoin="round"/></svg>'
};
window._psData = window._psData || null;
function _psRound(g) { return g && g.gameType && PS_ROUND[g.gameType] ? PS_ROUND[g.gameType] : null; }
function _psName(g) {
  var t = g.gameType, lg = g.league || '';
  if (t === 'W') return 'World Series';
  if (t === 'F') return (lg ? lg + ' ' : '') + 'Wild Card';
  return (lg || '') + (t === 'D' ? 'DS' : 'CS');
}
function _psNeed(g) { return Math.ceil((g.gamesInSeries || (PS_ROUND[g.gameType] || {}).best || 7) / 2); }
function _psAbbr(g, side) { return side === 'away' ? (g.awayAbbr || _ghAbbrFallback(g.away || '')) : (g.homeAbbr || _ghAbbrFallback(g.home || '')); }
function _psFinalWinnerId(x) { if (x.state !== 'Final' || x.awayScore == null || x.homeScore == null || x.awayScore === x.homeScore) return null; return x.awayScore > x.homeScore ? x.awayId : x.homeId; }
function _psSeries(g) {
  var d = window._psData;
  if (!d || !g || g.awayId == null) return null;
  var ids = [g.awayId, g.homeId].sort().join('-');
  return d.games.filter(function (x) { return x.gameType === g.gameType && [x.awayId, x.homeId].sort().join('-') === ids; })
    .sort(function (a, b) { return (a.seriesGameNumber || 0) - (b.seriesGameNumber || 0); });
}
// Wins for each side of `g`, counting the series' finished games before
// this one (after: include this game once it's final).
function _psWins(g, after) {
  var list = _psSeries(g), w = { away: 0, home: 0 };
  if (list && list.length) {
    list.forEach(function (x) {
      var n = x.seriesGameNumber || 0, me = g.seriesGameNumber || 0;
      if (n > me || (n === me && !after)) return;
      var wid = _psFinalWinnerId(x);
      if (wid == null) return;
      if (wid === g.awayId) w.away++; else if (wid === g.homeId) w.home++;
    });
    return w;
  }
  // fall back to MLB's series status on the game itself
  var s = g.series;
  if (!s || s.wins == null) return w;
  if (s.tied) { w.away = w.home = s.wins; return w; }
  if (s.leader) { w[s.leader] = s.wins; w[s.leader === 'away' ? 'home' : 'away'] = s.losses || 0; }
  return w;
}
function _psDone(g) { return /final|game over|completed/i.test(g.status || '') || g.state === 'Final'; }
// "Game 1" for game 1 (until it's over), the series score after that
function _psScoreText(g) {
  var done = _psDone(g), w = _psWins(g, done), need = _psNeed(g);
  var a = _psAbbr(g, 'away'), h = _psAbbr(g, 'home');
  if (!w.away && !w.home) return '';
  if (w.away === w.home) return 'Series tied ' + w.away + '\u2013' + w.home;
  var lead = w.away > w.home ? a : h, hi = Math.max(w.away, w.home), lo = Math.min(w.away, w.home);
  return lead + (hi >= need ? ' wins ' : ' leads ') + hi + '\u2013' + lo;
}
function _psStakes(g) {
  if (_psDone(g)) return '';
  var w = _psWins(g, false), need = _psNeed(g), a = _psAbbr(g, 'away'), h = _psAbbr(g, 'home');
  if (w.away === need - 1 && w.home === need - 1) return g.gameType === 'W' ? 'GAME ' + (g.seriesGameNumber || '') + ' \u00b7 WINNER TAKES THE TITLE' : 'WINNER-TAKE-ALL';
  if (w.away === need - 1) return a + ' CAN ' + (g.gameType === 'W' ? 'WIN IT ALL' : 'CLINCH') + ' TONIGHT';
  if (w.home === need - 1) return h + ' CAN ' + (g.gameType === 'W' ? 'WIN IT ALL' : 'CLINCH') + ' TONIGHT';
  return '';
}
function _psListLineHtml(g) {
  var R = _psRound(g); if (!R) return '';
  var sc = _psScoreText(g), st = _psStakes(g);
  return '<div class="ps-lc"><span class="ps-chip" style="background:' + _ghHexAlpha(R.rc, .16) + ';color:' + R.rc + '">' + _escapeHtml((_psName(g) + ' \u00b7 Game ' + (g.seriesGameNumber || '')).toUpperCase()) + '</span>' +
    (sc ? '<span class="ps-ser">' + _escapeHtml(sc) + '</span>' : '') + (st ? '<span class="ps-hot">' + _escapeHtml(st) + '</span>' : '') + '</div>';
}
function _psVars(R) { return '--rc:' + R.rc + ';--rc2:' + R.rc2 + ';--rcx:' + _ghHexAlpha(R.rc, .15) + ';--rcb:' + _ghHexAlpha(R.rc, .45); }
function _psBannerHtml(games) {
  var ps = (games || []).filter(function (g) { return _psRound(g); });
  if (!ps.length) return '';
  var order = 'FDLW', g = ps.slice().sort(function (a, b) { return order.indexOf(b.gameType) - order.indexOf(a.gameType); })[0], R = _psRound(g);
  var yr = (window._gamesDate || '').slice(0, 4) || String(new Date().getFullYear());
  return '<button class="ps-ban" style="' + _psVars(R) + '" onclick="psOpenBracket(' + yr + ')"><span class="ps-shine"></span>' + PS_EMB[g.gameType] +
    '<span><span class="k" style="display:block">' + yr + ' POSTSEASON</span><span class="t" style="display:block">' + _escapeHtml(g.gameType === 'W' ? 'World Series' : R.name) + '</span><span class="s" style="display:block">' + ps.length + (ps.length === 1 ? ' game' : ' games') + ' today</span></span>' +
    '<span class="go">Bracket \u203a</span></button>';
}
function _psLoad(season, cb) {
  var d = window._psData;
  if (d && d.season === season && Date.now() - d.at < 60000) { cb && cb(d); return; }
  if (window._psLoading) { (window._psWaiters = window._psWaiters || []).push(cb); return; }
  window._psLoading = true;
  fetch('/api/mlb?mode=postseason&season=' + season).then(function (r) { return r.json(); }).then(function (j) {
    window._psData = { season: season, at: Date.now(), games: (j && j.games) || [] };
  }).catch(function () {}).then(function () {
    window._psLoading = false;
    var w = window._psWaiters || []; window._psWaiters = [];
    cb && cb(window._psData); w.forEach(function (f) { f && f(window._psData); });
  });
}
// The open game, with its postseason fields (from the list, or the season's postseason games)
function _psGame() {
  var g = window._activeBrowseGame;
  if (!g || (g.sport || 'mlb') !== 'mlb') return null;
  var pk = String(g.gamePk), hit = null;
  (window._gamesListCache || []).forEach(function (x) { if (x && String(x.gamePk) === pk && x.gameType) hit = x; });
  if (window._psData) window._psData.games.forEach(function (x) { if (String(x.gamePk) === pk) hit = Object.assign({}, hit || {}, x); });
  return hit && _psRound(hit) ? hit : null;
}
function _psSeason() { var g = window._activeBrowseGame; var d = (g && g.date) || window._gamesDate || ''; return parseInt(String(d).slice(0, 4), 10) || new Date().getFullYear(); }
function _psShortTag() { var g = _psGame(); return g ? (_psName(g).replace('Wild Card', 'WC').replace('World Series', 'WS') + ' \u00b7 G' + (g.seriesGameNumber || '')).toUpperCase() : ''; }
function _psDecorate() {
  var panel = document.getElementById('game-sheet-panel');
  if (!panel) return;
  var old = document.getElementById('ps-rib');
  var g = _psGame();
  var bar = document.getElementById('game-sb');
  if (!g) {
    if (old) old.remove();
    // opened from somewhere other than the list during October: look it up once
    var ab = window._activeBrowseGame, mo = ab && ab.date ? parseInt(String(ab.date).slice(5, 7), 10) : 0;
    if (ab && (ab.sport || 'mlb') === 'mlb' && mo >= 9 && !window._psTried) { window._psTried = true; _psLoad(_psSeason(), function () { if (_psGame()) _psDecorate(); }); }
    return;
  }
  if (!window._psData || window._psData.season !== _psSeason() || Date.now() - window._psData.at > 60000) _psLoad(_psSeason(), function () { _psDecorate(); if (typeof _gshRefresh === 'function') _gshRefresh(); });
  var R = _psRound(g), sc = _psScoreText(g), st = _psStakes(g), n = g.seriesGameNumber || '';
  var list = _psSeries(g) || [], need = _psNeed(g), total = g.gamesInSeries || R.best;
  var pips = '';
  if (list.length) {
    for (var k = 1; k <= total; k++) {
      var x = list.filter(function (y) { return y.seriesGameNumber === k; })[0];
      var now = x && String(x.gamePk) === String(g.gamePk);
      var wid = x ? _psFinalWinnerId(x) : null;
      var lab = wid != null ? (wid === x.awayId ? _psAbbr(x, 'away') : _psAbbr(x, 'home')) + ' ' + Math.max(x.awayScore, x.homeScore) + '\u2013' + Math.min(x.awayScore, x.homeScore)
        : now ? (_psDone(g) ? 'Final' : 'Now') : x ? (x.state === 'Live' ? 'Live' : 'Upcoming') : 'If needed';
      pips += '<button class="ps-pip' + (now ? ' now' : '') + (wid != null ? ' w' : '') + '"' + (x && !now ? ' onclick="psOpenGame(' + x.gamePk + ')"' : '') + (x ? '' : ' disabled') + '><b>G' + k + '</b>' + _escapeHtml(lab) + '</button>';
    }
  }
  var html = '<div class="ps-rib" style="' + _psVars(R) + '"><span class="ps-shine"></span><span class="emb">' + PS_EMB[g.gameType] + '</span>' +
    '<div class="k">' + _psSeason() + ' POSTSEASON</div><div class="t">' + _escapeHtml(g.gameType === 'W' ? 'World Series' : _psName(g).replace(/DS$/, ' Division Series').replace(/CS$/, ' Championship Series').replace(/^(AL|NL) Wild Card$/, '$1 Wild Card Series')) + '</div>' +
    '<div class="s">Game ' + n + (sc ? ' \u00b7 ' + _escapeHtml(sc) : '') + '</div>' +
    (st ? '<div style="margin-top:8px"><span class="ps-hot">' + _escapeHtml(st) + '</span></div>' : '') +
    (pips ? '<div class="ps-pips">' + pips + '</div>' : '') + '</div>';
  // only touch the DOM when something changed (keeps the shine running)
  if (old && old._psh === html && old.parentNode === panel && panel.firstChild === old) { if (bar) bar.style.setProperty('--gsb-rc', R.rc); return; }
  var wrap = document.createElement('div'); wrap.innerHTML = html;
  var el = wrap.firstChild; el.id = 'ps-rib'; el._psh = html;
  if (old) old.remove();
  panel.insertBefore(el, panel.firstChild);
  if (bar) bar.style.setProperty('--gsb-rc', R.rc);
}
function psOpenGame(pk) {
  var x = window._psData && window._psData.games.filter(function (y) { return String(y.gamePk) === String(pk); })[0];
  if (!x) return;
  psCloseBracket();
  openGameScreen(x.gamePk, x.away, x.home, 'mlb', x.date);
}
// ── bracket ──
function psOpenBracket(season) {
  var el = document.getElementById('ps-bracket');
  if (!el) { el = document.createElement('div'); el.id = 'ps-bracket'; el.className = 'psb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Postseason bracket'); document.body.appendChild(el); }
  el.innerHTML = '<div class="psb-hd"><h2>' + season + ' Postseason</h2><button class="psb-x" onclick="psCloseBracket()" aria-label="Close">\u2715</button></div><div class="psb-tbd">Loading the bracket\u2026</div>';
  el.classList.add('on');
  _psLoad(season, function (d) { el.innerHTML = _psBracketHtml(season, d); var cur = el.querySelectorAll('.psb-rounds'); cur.forEach(function (r) { var c = r.querySelector('.psb-col.cur'); if (c) r.scrollLeft = c.offsetLeft - r.offsetLeft - 4; }); });
}
function psCloseBracket() { var el = document.getElementById('ps-bracket'); if (el) el.classList.remove('on'); }
function _psBracketHtml(season, d) {
  var games = (d && d.games) || [];
  var head = '<div class="psb-hd"><h2>' + season + ' Postseason</h2><button class="psb-x" onclick="psCloseBracket()" aria-label="Close">\u2715</button></div>';
  if (!games.length) return head + '<div class="psb-tbd">No postseason games yet.</div>';
  // group into series
  var map = {}, series = [];
  games.forEach(function (x) {
    var k = x.gameType + ':' + [x.awayId, x.homeId].sort().join('-');
    if (!map[k]) { map[k] = { type: x.gameType, league: x.league, games: [], teams: {} }; series.push(map[k]); }
    map[k].games.push(x);
    [['away', x.awayId], ['home', x.homeId]].forEach(function (p) {
      var id = p[1]; if (id == null) return;
      var t = map[k].teams[id] || (map[k].teams[id] = { id: id, abbr: _psAbbr(x, p[0]), name: _teamShortName(x[p[0]] || '') || _psAbbr(x, p[0]), seed: x[p[0] + 'Seed'], w: 0 });
      if (t.seed == null && x[p[0] + 'Seed'] != null) t.seed = x[p[0] + 'Seed'];
    });
  });
  series.forEach(function (s) {
    s.games.forEach(function (x) { var wid = _psFinalWinnerId(x); if (wid != null && s.teams[wid]) s.teams[wid].w++; });
    s.need = Math.ceil((s.games[0].gamesInSeries || PS_ROUND[s.type].best) / 2);
    s.list = Object.keys(s.teams).map(function (k) { return s.teams[k]; }).sort(function (a, b) { return (a.seed || 99) - (b.seed || 99); });
    s.next = s.games.filter(function (x) { return x.state !== 'Final'; }).sort(function (a, b) { return (a.seriesGameNumber || 0) - (b.seriesGameNumber || 0); })[0] || s.games[s.games.length - 1];
  });
  var latest = 'F'; series.forEach(function (s) { if ('FDLW'.indexOf(s.type) > 'FDLW'.indexOf(latest)) latest = s.type; });
  var card = function (s) {
    var R = PS_ROUND[s.type], a = s.list[0], b = s.list[1];
    if (!a || !b) return '';
    var over = a.w >= s.need || b.w >= s.need, lead = a.w === b.w ? null : (a.w > b.w ? a : b);
    var row = function (t, lose) {
      var c = typeof _ghTeamColors === 'function' ? _ghTeamColors(t.abbr) : { bg: '#3D3580', fg: '#fff' }, pips = '';
      for (var i = 0; i < s.need; i++) pips += '<i class="' + (i < t.w ? 'on' : '') + '"></i>';
      return '<span class="psb-tr' + (lose ? ' out' : '') + '"><span class="sd">' + (t.seed != null ? t.seed : '') + '</span><span class="lo" style="background:' + c.bg + ';color:' + c.fg + '">' + _escapeHtml(t.abbr) + '</span><span class="n">' + _escapeHtml(t.name) + '</span><span class="w">' + pips + '</span></span>';
    };
    var st = over ? '<b>' + _escapeHtml(lead.abbr) + '</b> won ' + lead.w + '\u2013' + Math.min(a.w, b.w)
      : lead ? '<b>' + _escapeHtml(lead.abbr) + '</b> leads ' + lead.w + '\u2013' + Math.min(a.w, b.w) + (s.next ? ' \u00b7 Game ' + s.next.seriesGameNumber + ' next' : '')
      : (a.w ? 'Series tied ' + a.w + '\u2013' + b.w : 'Game 1') + (s.next && a.w ? ' \u00b7 Game ' + s.next.seriesGameNumber + ' next' : '');
    return '<button class="psb-s" style="--rcs:' + R.rc + '" onclick="psOpenGame(' + s.next.gamePk + ')">' + row(a, over && b.w > a.w) + row(b, over && a.w > b.w) + '<span class="psb-st">' + st + '</span></button>';
  };
  // each league scrolls to the latest round it has reached
  var latestIn = function (lg) { var l = 'F'; series.forEach(function (s) { if (s.league === lg && 'FDL'.indexOf(s.type) > 'FDL'.indexOf(l)) l = s.type; }); return l; };
  var col = function (type, lg, title) {
    var list = series.filter(function (s) { return s.type === type && (type === 'W' || s.league === lg); });
    var R = PS_ROUND[type];
    var cur = type === 'W' ? true : type === latestIn(lg);
    return '<div class="psb-col' + (cur ? ' cur' : '') + '" style="' + _psVars(R) + '"><h3>' + title + '</h3>' + (list.length ? list.map(card).join('') : '<div class="psb-tbd">Not set yet</div>') + '</div>';
  };
  var ws = series.filter(function (s) { return s.type === 'W'; });
  var h = head;
  if (ws.length) h += '<div class="psb-lg">WORLD SERIES</div><div class="psb-rounds">' + col('W', null, 'WORLD SERIES') + '</div>';
  ['NL', 'AL'].forEach(function (lg) {
    h += '<div class="psb-lg">' + (lg === 'NL' ? 'NATIONAL LEAGUE' : 'AMERICAN LEAGUE') + '</div><div class="psb-rounds">' +
      col('F', lg, 'WILD CARD') + col('D', lg, lg + 'DS') + col('L', lg, lg + 'CS') + '</div>';
  });
  return h;
}
// ── the end of a series: clinch or champions, in place of the win graphic ──
function _psClinchHtml(end, box, W, L, ws, ls, t0) {
  var g = _psGame();
  if (!g || !window._psData) return '';
  var need = _psNeed(g), w = _psWins(g, true);
  var winSide = end.winner, wWins = w[winSide], lWins = w[winSide === 'home' ? 'away' : 'home'];
  if (wWins < need) return '';
  var R = _psRound(g);
  var d = function (ms) { return 'style="animation-delay:calc(var(--t0) + ' + ms + 'ms)"'; };
  var logo = function (T) { return '<i style="background:' + T.c.bg + ';color:' + T.c.fg + '">' + _escapeHtml(T.abbr) + '</i>'; };
  var score = '<div class="sc" ' + d(700) + '><span class="s">' + logo(W) + '<b>' + ws + '</b></span><span class="dash"></span><span class="s lo"><b>' + ls + '</b>' + logo(L) + '</span></div>';
  var yr = _psSeason();
  if (g.gameType === 'W') {
    var rays = ''; for (var i = 0; i < 24; i++) { var a = i * 15 * Math.PI / 180, b = a + .07; rays += '<polygon points="260,260 ' + (260 + Math.sin(a) * 280).toFixed(0) + ',' + (260 - Math.cos(a) * 280).toFixed(0) + ' ' + (260 + Math.sin(b) * 280).toFixed(0) + ',' + (260 - Math.cos(b) * 280).toFixed(0) + '" fill="' + (i % 2 ? '#F2C869' : W.c.bg) + '" opacity="' + (i % 2 ? .12 : .16) + '"/>'; }
    var tro = '<svg class="tro" viewBox="0 0 120 150" aria-hidden="true"><defs><linearGradient id="pstg" x1="0" x2="1"><stop offset="0" stop-color="#B7822A"/><stop offset=".5" stop-color="#FFF1C4"/><stop offset="1" stop-color="#B7822A"/></linearGradient></defs><g fill="url(#pstg)">';
    for (var k = 0; k < 12; k++) { var x = 14 + k * 8; tro += '<path d="M' + x + ' 18 L' + (x + 6) + ' 18 L' + (60 + (x - 57) * .15).toFixed(1) + ' 96 L' + (58 + (x - 57) * .15).toFixed(1) + ' 96 Z"/>'; }
    tro += '<ellipse cx="60" cy="18" rx="48" ry="6"/><rect x="52" y="94" width="16" height="22"/><path d="M34 116h52l6 18H28z"/><rect x="24" y="134" width="72" height="8" rx="2"/></g></svg>';
    return '<div class="gw gw-champ" style="--t0:' + t0 + '"><svg class="rays" viewBox="0 0 520 520" aria-hidden="true">' + rays + '</svg>' +
      '<div class="ct"><span ' + d(200) + '>' + tro + '</span><span class="fin" style="--wa:#F2C869;animation-delay:calc(var(--t0) + 380ms)">' + yr + ' WORLD SERIES</span><span class="big" ' + d(480) + '>CHAMPIONS</span>' +
      '<span class="ln" ' + d(600) + '>' + _escapeHtml((end.winner === 'home' ? box.home : box.away) || W.name) + '</span>' +
      '<span class="rec" ' + d(700) + '>Beat the ' + _escapeHtml(L.name) + ' ' + wWins + '\u2013' + lWins + '</span></div></div>';
  }
  var nextName = R.next === 'WS' ? 'World Series' : (g.league || '') + R.next;
  return '<div class="gw gw-win gw-ps" style="--t0:' + t0 + ';--wc:' + _ghHexAlpha(W.c.bg, .55) + ';--rc:' + R.rc + ';--rc2:' + R.rc2 + ';--wa:' + R.rc + '">' +
    '<div class="bg"></div><div class="sw"></div>' +
    '<div class="ct"><span class="fin" ' + d(0) + '>' + _escapeHtml(_psName(g).toUpperCase()) + '</span><span class="team" ' + d(110) + '>' + _escapeHtml(W.name.toUpperCase()) + ' ADVANCE</span>' +
    '<span class="ln" ' + d(240) + '>Won the series ' + wWins + '\u2013' + lWins + '</span>' +
    '<span class="nx" ' + d(420) + '><em>NEXT</em>' + _escapeHtml(nextName) + '</span></div></div>';
}
