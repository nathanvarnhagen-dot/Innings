// ══ TENNIS, GOLF AND FORMULA 1 (v7.65.0) ══════════════════════════════════
// Three new tiles on the Games page, each with its own live page built the
// way baseball's is: a hero picture up top (a broadcast-angle court, a hole,
// the whole circuit), a takeover band that fires only on what the data
// confirms, a fixed panel under it, and a caps tab bar with a Chat tab.
//   · tennis — ATP + WTA singles from ESPN's scoreboard: set and game
//     scores, tiebreaks, seeds, round, court. The band calls games, sets and
//     the match as they happen. ESPN doesn't send points or the server, so
//     neither is drawn.
//   · golf — this week's PGA TOUR leaderboard (ESPN). Star players to follow
//     ("My guys"); the band calls birdies and eagles by the leaders and your
//     guys; tap a player for his card.
//   · F1 — OpenF1: the circuit traced from a real lap, cars on it while a
//     session is live, the timing tower with tyres and pit stops, a tyre
//     strategy chart, and the championship (Jolpica). OpenF1's live feed is
//     paid — set OPENF1_TOKEN in Vercel; until then a session fills in once
//     it's over.
// Data comes from /api/events. Chat rides the same gameChats collection as
// every other game, keyed "ev:<sport>:<id>".

var FS_LEAGUES = { tennis: { name: 'Tennis', emoji: '🎾' }, golf: { name: 'Golf', emoji: '⛳' }, f1: { name: 'Formula 1', emoji: '🏎️' } };
window._fs = window._fs || { league: null, date: null, list: null, ev: null, data: null, prev: null, tab: 'live', to: null, sig: {}, track: {}, golfFilter: 'top', golfOpen: null, msgs: [], unsub: null, timer: null, nextAt: 0, standings: null };
window._fsLive = window._fsLive || {};

// The Games page draws these after the team leagues. They're kept out of
// GAMES_SPORTS itself, which Home, the plan builder, rulebooks and the team
// picker read as "leagues with teams and a schedule" (js/games/breaks-weeks-and-flourishes.js).
window._fsTiles = ['tennis', 'golf', 'f1'].map(function (k) { return { key: k, name: FS_LEAGUES[k].name, emoji: FS_LEAGUES[k].emoji, live: true, ev: true }; });
(function () {
  if (typeof pickGamesSport !== 'function') return;
  var prev = pickGamesSport;
  window.pickGamesSport = function (key) { if (FS_LEAGUES[key]) { fsOpenLeague(key); return; } return prev.apply(this, arguments); };
})();

function _fsEsc(s) { return typeof _escapeHtml === 'function' ? _escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function _fsJson(url) {
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var tm = ctrl ? setTimeout(function () { ctrl.abort(); }, 20000) : null;
  return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (v) { if (tm) clearTimeout(tm); return v; });
}
function _fsTime(iso) {
  var d = new Date(iso);
  if (!isFinite(d.getTime())) return '';
  var h = d.getHours(), m = d.getMinutes();
  return (h % 12 || 12) + ':' + ('0' + m).slice(-2) + (h < 12 ? ' AM' : ' PM');
}
function _fsDay(iso) {
  var d = new Date(iso);
  if (!isFinite(d.getTime())) return '';
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()] + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getDate();
}
function _fsToday() { return typeof _todayLocal === 'function' ? _todayLocal() : new Date().toISOString().slice(0, 10); }
function _fsLast(name) { var p = String(name || '').trim().split(/\s+/); return p.length > 1 ? p.slice(1).join(' ') : p[0] || ''; }
function _fsSet(id, html, sigKey) {
  var el = document.getElementById(id);
  if (!el) return null;
  var k = sigKey || id;
  if (window._fs.sig[k] === html && el.innerHTML) return false;
  window._fs.sig[k] = html;
  el.innerHTML = html;
  // whatever lived inside it is gone: its pieces draw again
  if (id === 'fs-hero') delete window._fs.sig['fs-bandw'];
  return true;
}
var FS_BACK = '<svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="var(--mid)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="7 1 1 6.5 7 12"/></svg>';
var FS_STAR = '<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/></svg>';

// ── LEAGUE LISTS ─────────────────────────────────────────────────────────
function fsOpenLeague(key) {
  var F = window._fs;
  F.league = key;
  if (key === 'golf') { fsOpenEvent({ sport: 'golf', id: 'pga' }); return; }
  if (key === 'tennis' && !F.date) F.date = _fsToday();
  nav('ev-list');
  var t = document.getElementById('fs-list-title');
  if (t) t.textContent = FS_LEAGUES[key].name;
  var dn = document.getElementById('fs-list-nav');
  if (dn) dn.style.display = key === 'tennis' ? 'flex' : 'none';
  fsLoadList();
}
function fsListDay(delta) {
  var F = window._fs;
  if (delta === 0) F.date = _fsToday();
  else { var d = new Date(F.date + 'T12:00:00'); d.setDate(d.getDate() + delta); F.date = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  fsLoadList();
}
function fsLoadList() {
  var F = window._fs, el = document.getElementById('fs-list');
  if (!el) return;
  el.innerHTML = '<div class="fs-empty">Loading…</div>';
  if (F.league === 'tennis') {
    var lab = document.getElementById('fs-list-day');
    if (lab) lab.textContent = F.date === _fsToday() ? 'Today' : _fsDay(F.date + 'T12:00:00');
    var want = F.date;
    _fsJson('/api/events?mode=tennis&date=' + want.replace(/-/g, '')).then(function (d) {
      if (F.league !== 'tennis' || F.date !== want) return;
      F.list = d;
      el.innerHTML = _fsTennisListHtml(d);
    });
  } else if (F.league === 'f1') {
    _fsJson('/api/events?mode=f1sched').then(function (d) {
      if (F.league !== 'f1') return;
      F.list = d;
      el.innerHTML = _fsF1ListHtml(d);
    });
  }
}

function _fsSetsLine(m, i) {
  return m.p[i].sets.map(function (s) {
    return '<span class="' + (s.won ? 'w' : '') + '">' + (s.g == null ? '' : s.g) + (s.tb != null && !s.won ? '<sup>' + s.tb + '</sup>' : '') + '</span>';
  }).join('');
}
function _fsTennisListHtml(d) {
  if (!d || !d.matches) return '<div class="fs-empty">Couldn’t load tennis — try again</div>';
  if (!d.matches.length) return '<div class="fs-empty">No singles matches on this day</div>';
  var by = {};
  d.matches.forEach(function (m, i) { var k = m.tour + ' · ' + m.event; (by[k] = by[k] || []).push({ m: m, i: i }); });
  return Object.keys(by).map(function (k) {
    return '<div class="fs-grp">' + _fsEsc(k) + '</div>' + by[k].map(function (e) {
      var m = e.m, st = m.state === 'in' ? '<span class="fs-lv"><i></i>LIVE</span>' : m.state === 'pre' ? _fsEsc(_fsTime(m.start)) : 'Final';
      var row = function (i) {
        var p = m.p[i];
        return '<span class="fs-mr' + (m.state === 'post' && !p.winner ? ' dn' : '') + '"><span class="nm">' + _fsEsc(p.short || p.name) + (p.seed ? ' <small>' + p.seed + '</small>' : '') + '</span><span class="ss">' + _fsSetsLine(m, i) + '</span></span>';
      };
      return '<button type="button" class="fs-mc" onclick="fsOpenTennis(' + e.i + ')"><span class="fs-mh"><span>' + _fsEsc([m.round, m.court].filter(Boolean).join(' · ')) + '</span><span>' + st + '</span></span>' + row(0) + row(1) + '</button>';
    }).join('');
  }).join('');
}
function fsOpenTennis(i) {
  var F = window._fs, m = F.list && F.list.matches && F.list.matches[i];
  if (!m) return;
  fsOpenEvent({ sport: 'tennis', id: m.id, date: F.date, seed: m });
}

function _fsF1ListHtml(d) {
  if (!d || !d.meetings) return '<div class="fs-empty">Couldn’t load the F1 calendar — try again</div>';
  if (!d.meetings.length) return '<div class="fs-empty">No calendar yet for this season</div>';
  var now = Date.now();
  var cur = d.meetings.filter(function (m) { return Date.parse(m.end) + 6 * 3600e3 >= now; })[0] || null;
  var done = d.meetings.filter(function (m) { return Date.parse(m.end) + 6 * 3600e3 < now; }).reverse();
  var later = d.meetings.filter(function (m) { return cur && Date.parse(m.start) > Date.parse(cur.start); });
  var sess = function (s) {
    var on = now >= Date.parse(s.start) && now <= Date.parse(s.end), past = now > Date.parse(s.end);
    return '<button type="button" class="fs-ss" onclick="fsOpenF1(' + s.key + ')"><span class="nm">' + _fsEsc(s.name) + '</span><span class="tm">' + (on ? '<span class="fs-lv"><i></i>LIVE</span>' : _fsEsc(_fsDay(s.start) + (past ? '' : ' · ' + _fsTime(s.start)))) + '</span></button>';
  };
  var html = '';
  if (cur) html += '<div class="fs-grp">' + (now >= Date.parse(cur.start) ? 'This weekend' : 'Next up') + '</div><div class="fs-wk"><div class="fs-wkh"><span class="nm">' + _fsEsc(cur.name) + '</span><span class="sub">' + _fsEsc([cur.circuit, cur.country].filter(Boolean).join(' · ')) + '</span></div>' + cur.sessions.map(sess).join('') + '</div>';
  if (done.length) html += '<div class="fs-grp">Earlier this season</div>' + done.map(function (m) {
    var race = m.sessions.filter(function (s) { return /^race$/i.test(s.name); })[0] || m.sessions[m.sessions.length - 1];
    return '<button type="button" class="fs-mc fs-mt" onclick="fsOpenF1(' + race.key + ')"><span class="nm">' + _fsEsc(m.name) + '</span><span class="sub">' + _fsEsc(_fsDay(race.start)) + ' · Race</span></button>';
  }).join('');
  if (later.length) html += '<div class="fs-grp">Still to come</div>' + later.map(function (m) {
    return '<div class="fs-mc fs-mt dim"><span class="nm">' + _fsEsc(m.name) + '</span><span class="sub">' + _fsEsc(_fsDay(m.start)) + '</span></div>';
  }).join('');
  return html;
}
function fsOpenF1(key) { fsOpenEvent({ sport: 'f1', id: String(key) }); }

// ── THE EVENT PAGE ───────────────────────────────────────────────────────
var FS_TABS = { tennis: ['live', 'chat'], golf: ['live', 'field', 'chat'], f1: ['live', 'tyres', 'standings', 'chat'] };
function fsOpenEvent(ev) {
  var F = window._fs;
  var same = F.ev && F.ev.sport === ev.sport && String(F.ev.id) === String(ev.id);
  if (!same) {
    _fsChatStop();
    F.data = ev.seed || null; F.prev = null; F.to = null; F.sig = {}; F.tab = 'live'; F.golfOpen = null;
  }
  F.ev = ev; F.league = ev.sport;
  nav('ev');
  _fsTabsHtml();
  _fsRender();
  fsRefresh();
  _fsTimerStart();
}
function _fsTabsHtml() {
  var F = window._fs, tabs = FS_TABS[F.ev.sport];
  var el = document.getElementById('fs-ev-tabs');
  if (!el) return;
  el.style.gridTemplateColumns = 'repeat(' + tabs.length + ', minmax(0,1fr))';
  el.innerHTML = tabs.map(function (t) { return '<button type="button" class="' + (F.tab === t ? 'on' : '') + '" onclick="fsTab(\'' + t + '\')"' + (F.tab === t ? ' aria-current="page"' : '') + '>' + t.toUpperCase() + '</button>'; }).join('');
}
function fsTab(t) {
  var F = window._fs;
  F.tab = t; F.sig = {};
  _fsTabsHtml();
  _fsRender();
  if (t === 'chat') _fsChatStart();
  if (t === 'standings' && !F.standings) _fsJson('/api/events?mode=f1standings').then(function (d) { F.standings = d || { drivers: [] }; if (F.tab === 'standings') _fsRender(); });
  var b = document.getElementById('fs-ev-body');
  if (b) b.scrollTop = 0;
}
function fsRefresh() {
  var F = window._fs, ev = F.ev;
  if (!ev) return Promise.resolve();
  var url = ev.sport === 'tennis' ? '/api/events?mode=tennis&date=' + String(ev.date || _fsToday()).replace(/-/g, '')
    : ev.sport === 'golf' ? '/api/events?mode=golf' : '/api/events?mode=f1&session=' + encodeURIComponent(ev.id);
  if (ev.sport === 'f1' && !F.track[ev.id]) {
    F.track[ev.id] = { loading: true };
    _fsJson('/api/events?mode=f1track&session=' + encodeURIComponent(ev.id)).then(function (t) {
      F.track[ev.id] = t && t.pts ? t : { none: true, at: Date.now() };
      if (F.ev === ev) _fsRender();
    });
  }
  return _fsJson(url).then(function (d) {
    if (F.ev !== ev || !d) return;
    var cur = d;
    if (ev.sport === 'tennis') cur = (d.matches || []).filter(function (m) { return String(m.id) === String(ev.id); })[0] || null;
    if (!cur) return;
    var prev = F.data && !F.data._seed ? F.data : null;
    if (ev.seed && F.data === ev.seed) prev = null;
    F.prev = prev;
    F.data = cur;
    _fsDetect(ev.sport, prev, cur);
    _fsRender();
    // a circuit with no lap on file yet is asked for again once laps exist
    if (ev.sport === 'f1' && F.track[ev.id] && F.track[ev.id].none && cur.lap >= 4 && Date.now() - F.track[ev.id].at > 60e3) delete F.track[ev.id];
  });
}
function _fsPollMs() {
  var F = window._fs, d = F.data;
  if (!F.ev || !d) return 30000;
  if (F.ev.sport === 'f1') return d.live ? 6000 : (d.liveBlocked ? 60000 : (d.over ? 0 : 60000));
  if (F.ev.sport === 'tennis') return d.state === 'in' ? 12000 : d.state === 'pre' ? 60000 : 0;
  return d.state === 'in' ? 30000 : 0;
}
function _fsTimerStart() {
  var F = window._fs;
  if (F.timer) return;
  F.nextAt = Date.now() + 6000;
  F.timer = setInterval(function () {
    var scr = document.getElementById('screen-ev');
    if (!scr || !scr.classList.contains('active')) { clearInterval(F.timer); F.timer = null; return; }
    if (document.hidden || Date.now() < F.nextAt) return;
    var ms = _fsPollMs();
    if (!ms) { F.nextAt = Date.now() + 60000; return; }
    F.nextAt = Date.now() + ms;
    fsRefresh();
  }, 1000);
}

// What the band calls: only what changed between two answers
function _fsDetect(sport, a, b) {
  var F = window._fs, now = Date.now(), to = null;
  if (!a || !b) return;
  if (sport === 'tennis') {
    var setsA = a.p[0].sets.length, setsB = b.p[0].sets.length;
    if (b.state === 'post' && a.state !== 'post') to = { k: 'GAME, SET, MATCH' };
    else if (setsB > setsA && setsA > 0) to = { k: 'SET' };
    else {
      var ga = _fsGames(a), gb = _fsGames(b);
      if (gb[0] + gb[1] > ga[0] + ga[1]) to = { k: 'GAME', who: gb[0] > ga[0] ? 0 : 1 };
    }
  } else if (sport === 'golf') {
    var old = {};
    (a.players || []).forEach(function (p) { old[p.id] = p; });
    var follow = _fsFollow(), best = null;
    (b.players || []).forEach(function (p, i) {
      var o = old[p.id];
      if (!o) return;
      var hb = _fsHoles(p), ha = _fsHoles(o);
      if (hb.length <= ha.length) return;
      var h = hb[hb.length - 1];
      if (h.rel == null) return;
      var mine = !!follow[p.id], top = i < 10;
      if (!mine && !top) return;
      if (h.rel > 0 && !mine && i > 0) return; // bogeys: only the leader's and your guys'
      var w = (h.rel <= -2 ? 30 : h.rel === -1 ? 20 : 10) + (mine ? 5 : 0) + (i === 0 ? 3 : 0);
      if (!best || w > best.w) best = { w: w, p: p, h: h };
    });
    if (best) to = { k: best.h.rel <= -3 ? 'ALBATROSS' : best.h.rel === -2 ? (best.h.v === 1 ? 'HOLE IN ONE' : 'EAGLE') : best.h.rel === -1 ? 'BIRDIE' : best.h.rel === 1 ? 'BOGEY' : best.h.rel === 0 ? 'PAR' : 'DOUBLE', id: best.p.id, hole: best.h.h };
  } else if (sport === 'f1') {
    if (b.stop && (!a.stop || a.stop.at !== b.stop.at)) to = { k: 'PIT STOP' };
    else if (b.flag !== a.flag && b.flag !== 'GREEN') to = { k: 'FLAG' };
  }
  if (to) { to.at = now; F.to = to; }
}
function _fsGames(m) {
  var i = m.p[0].sets.length - 1;
  if (i < 0) return [0, 0];
  return [m.p[0].sets[i].g || 0, m.p[1].sets[i] ? (m.p[1].sets[i].g || 0) : 0];
}

function _fsRender() {
  var F = window._fs, ev = F.ev;
  if (!ev) return;
  var d = F.data;
  _fsHeader();
  var body = document.getElementById('fs-ev-body');
  if (!body) return;
  if (F.tab === 'chat') { _fsChatRender(); return; }
  if (!d) { _fsSet('fs-ev-body', '<div class="fs-empty">Loading…</div>', 'body'); return; }
  var shell = '<div id="fs-hero" class="fs-hero"></div><div id="fs-under"></div>';
  if (F.tab === 'live') {
    if (!document.getElementById('fs-hero')) { window._fs.sig = {}; body.innerHTML = shell; }
    if (ev.sport === 'tennis') _fsTennisLive(d);
    else if (ev.sport === 'golf') _fsGolfLive(d);
    else _fsF1Live(d);
  } else {
    var html = ev.sport === 'golf' ? _fsGolfFieldHtml(d) : F.tab === 'tyres' ? _fsF1TyresHtml(d) : _fsF1StandingsHtml(F.standings);
    _fsSet('fs-ev-body', html, 'body');
  }
}
function _fsHeader() {
  var F = window._fs, ev = F.ev, d = F.data || {};
  var eb = '', sub = '', right = '';
  var live = '<span class="fs-lv"><i></i>LIVE</span>';
  if (ev.sport === 'tennis') {
    eb = (d.tour || '') + (d.event ? ' · ' + d.event : '');
    sub = [d.round, d.court].filter(Boolean).join(' · ');
    right = d.state === 'in' ? live : '';
  } else if (ev.sport === 'golf') {
    eb = 'PGA TOUR' + (d.round ? ' · ROUND ' + d.round : '');
    sub = d.short || d.name || '';
    right = d.state === 'in' ? live : '';
  } else {
    eb = 'FORMULA 1 · ' + (d.name || '').toUpperCase();
    sub = d.location ? d.location + (d.country && d.country !== d.location ? ' · ' + d.country : '') : '';
    right = d.race && d.lap ? '<span class="fs-lap"><b>' + d.lap + '</b><small>LAP</small></span>' : d.live ? live : '';
  }
  _fsSet('fs-ev-eb', _fsEsc(String(eb).toUpperCase()));
  _fsSet('fs-ev-sub', _fsEsc(sub));
  _fsSet('fs-ev-right', right);
}

// Band (the takeover). Plays its entrance only when it's news.
function _fsBand(o) {
  var anim = o.fresh ? ' fresh' : '';
  return '<div class="fs-band' + anim + '" style="--b1:' + (o.bg || '#3D3580') + ';--b2:' + (o.bg2 || '#231E55') + ';--bk:' + (o.ink || '#fff') + ';--bs:' + (o.sub || '#D9D4F7') + ';--bc:' + (o.kc || '#F2C869') + '">' +
    '<div class="tx"><div class="k">' + _fsEsc(o.k) + '</div><div class="w">' + _fsEsc(o.w) + '</div>' + (o.s ? '<div class="s">' + _fsEsc(o.s) + '</div>' : '') + '</div>' + (o.right || '') + '</div>';
}
function _fsFresh() { var to = window._fs.to; return !!(to && Date.now() - to.at < 6000); }

// ── TENNIS ───────────────────────────────────────────────────────────────
function _fsTennisCourtSvg(m) {
  var g = m.p[0].sets.length ? _fsGames(m) : null;
  var far = m.p[1], near = m.p[0];
  return '<svg class="fs-svg" viewBox="0 0 358 222" aria-hidden="true">' +
    '<defs><linearGradient id="fsTcS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2D57A0"/><stop offset="1" stop-color="#3A6BC0"/></linearGradient>' +
    '<linearGradient id="fsTcN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(10,12,30,.55)"/><stop offset="1" stop-color="rgba(10,12,30,.25)"/></linearGradient>' +
    '<pattern id="fsTcM" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0 L4 4 M4 0 L0 4" stroke="rgba(255,255,255,.18)" stroke-width=".6"/></pattern></defs>' +
    '<rect width="358" height="222" fill="#1A2B5E"/>' +
    '<path d="M 52 0 L 306 0 L 358 236 L 0 236 Z" fill="#22407E"/>' +
    '<path d="M 78 20 L 280 20 L 334 206 L 24 206 Z" fill="url(#fsTcS)"/>' +
    (g ? '<text x="179" y="54" text-anchor="middle" font-size="30" font-weight="900" fill="rgba(255,255,255,.16)" font-family="system-ui,sans-serif">' + g[1] + '</text>' +
      '<text x="179" y="196" text-anchor="middle" font-size="46" font-weight="900" fill="rgba(255,255,255,.16)" font-family="system-ui,sans-serif">' + g[0] + '</text>' : '') +
    '<g fill="none" stroke="#fff" stroke-linecap="round"><path d="M 78 20 L 280 20 L 334 206 L 24 206 Z" stroke-width="2.4"/>' +
    '<path d="M 103 20 L 63 206 M 255 20 L 295 206" stroke-width="1.8"/><path d="M 96.5 50.5 L 261.5 50.5 M 75.5 147.5 L 282.5 147.5" stroke-width="1.8"/>' +
    '<path d="M 179 50.5 L 179 147.5" stroke-width="1.8"/><path d="M 179 20 L 179 25 M 179 206 L 179 199" stroke-width="2.4"/></g>' +
    '<ellipse cx="179" cy="96" rx="134" ry="5" fill="rgba(0,0,0,.25)"/>' +
    '<rect x="49" y="74" width="260" height="20" fill="url(#fsTcN)"/><rect x="49" y="74" width="260" height="20" fill="url(#fsTcM)"/>' +
    '<path d="M 49 74 L 309 74" stroke="#fff" stroke-width="2.6"/><path d="M 179 74 L 179 94" stroke="#fff" stroke-width="1.6" opacity=".8"/>' +
    '<path d="M 49 72 L 49 95 M 309 72 L 309 95" stroke="#C9CEDD" stroke-width="3.4" stroke-linecap="round"/>' +
    '</svg>' +
    '<span class="fs-tag far">' + _fsEsc(_fsLast(far.name).toUpperCase()) + '</span><span class="fs-tag near">' + _fsEsc(_fsLast(near.name).toUpperCase()) + '</span>';
}
function _fsSetsWon(m, i) { return m.p[i].sets.filter(function (s) { return s.won; }).length; }
function _fsScoreStr(m, i) {
  var o = 1 - i;
  return m.p[i].sets.map(function (s, k) {
    var t = m.p[o].sets[k] || {};
    return (s.g == null ? '' : s.g) + '–' + (t.g == null ? '' : t.g) + (s.tb != null || t.tb != null ? '(' + Math.min(s.tb != null ? s.tb : 99, t.tb != null ? t.tb : 99) + ')' : '');
  }).join(' ');
}
function _fsTennisBand(m) {
  var F = window._fs, to = F.to, fresh = _fsFresh();
  var p0 = _fsLast(m.p[0].name), p1 = _fsLast(m.p[1].name);
  if (m.state === 'pre') return _fsBand({ k: 'UP NEXT', w: (p0 + ' vs ' + p1).toUpperCase(), s: [_fsTime(m.start), m.court].filter(Boolean).join(' · ') });
  if (m.state === 'post') {
    var wi = m.p[0].winner ? 0 : m.p[1].winner ? 1 : (_fsSetsWon(m, 0) >= _fsSetsWon(m, 1) ? 0 : 1);
    return _fsBand({ fresh: fresh && to && to.k === 'GAME, SET, MATCH', k: to && to.k === 'GAME, SET, MATCH' ? 'GAME, SET, MATCH' : 'FINAL', w: _fsLast(m.p[wi].name).toUpperCase(), s: 'd. ' + _fsLast(m.p[1 - wi].name) + ' · ' + _fsScoreStr(m, wi) });
  }
  var g = _fsGames(m), setNo = m.p[0].sets.length;
  if (to && to.k === 'SET') {
    var k2 = setNo - 2, a = m.p[0].sets[k2] || {}, wi2 = a.won ? 0 : 1;
    return _fsBand({ fresh: fresh, k: 'SET ' + (k2 + 1), w: _fsLast(m.p[wi2].name).toUpperCase(), s: 'Takes it ' + (m.p[wi2].sets[k2].g) + '–' + (m.p[1 - wi2].sets[k2].g) + ' · sets ' + _fsSetsWon(m, wi2) + '–' + _fsSetsWon(m, 1 - wi2) });
  }
  if (to && to.k === 'GAME') {
    var who = m.p[to.who];
    var tb = g[0] === 6 && g[1] === 6;
    return _fsBand({ fresh: fresh, k: tb ? 'TIEBREAK' : 'GAME', w: _fsLast(who.name).toUpperCase(), s: tb ? 'Six all — tiebreak in set ' + setNo : 'Set ' + setNo + ' · ' + g[to.who] + '–' + g[1 - to.who] });
  }
  var lead = g[0] === g[1] ? 'Level at ' + g[0] + '–' + g[1] : _fsLast(m.p[g[0] > g[1] ? 0 : 1].name) + ' leads ' + Math.max(g[0], g[1]) + '–' + Math.min(g[0], g[1]);
  return _fsBand({ k: 'SET ' + setNo, w: lead.toUpperCase(), s: 'Sets ' + _fsSetsWon(m, 0) + '–' + _fsSetsWon(m, 1) + ' · ' + (m.detail || 'In play') });
}
function _fsTennisLive(m) {
  var nSets = Math.max(m.bestOf || 3, m.p[0].sets.length);
  var cols = '14px minmax(0,1fr) ' + new Array(nSets + 1).join('28px ');
  var curIdx = m.state === 'in' ? m.p[0].sets.length - 1 : -1;
  var row = function (i) {
    var p = m.p[i], o = m.p[1 - i];
    var cells = '';
    for (var k = 0; k < nSets; k++) {
      var s = p.sets[k], t = o.sets[k];
      var v = s && s.g != null ? s.g : '';
      var cls = !s ? 'e' : s.won ? 'w' : (k === curIdx ? 'c' : 'l');
      cells += '<span class="' + cls + '">' + v + (s && s.tb != null && !s.won && t && t.won ? '<sup>' + s.tb + '</sup>' : '') + '</span>';
    }
    var win = m.state === 'post' && p.winner;
    return '<div class="fs-sbr' + (m.state === 'post' && !p.winner ? ' dn' : '') + '" style="grid-template-columns:' + cols + '"><span class="dot">' + (win ? '✓' : '') + '</span>' +
      '<span class="nm">' + _fsEsc(p.name) + ' <small>' + _fsEsc([p.flag, p.seed ? '[' + p.seed + ']' : ''].filter(Boolean).join(' ')) + '</small></span>' + cells + '</div>';
  };
  var head = '<div class="fs-sbr hd" style="grid-template-columns:' + cols + '"><span></span><span>' + _fsEsc(m.state === 'in' ? 'SET ' + m.p[0].sets.length : m.state === 'post' ? 'FINAL' : _fsTime(m.start)) + '</span>';
  for (var k = 0; k < nSets; k++) head += '<span>' + (k + 1) + '</span>';
  head += '</div>';
  var sb = '<div class="fs-sb">' + head + row(0) + '<div class="fs-rule"></div>' + row(1) + '</div>';
  var hero = document.getElementById('fs-hero');
  if (hero && hero.parentNode && !document.getElementById('fs-sb')) { var div = document.createElement('div'); div.id = 'fs-sb'; hero.parentNode.insertBefore(div, hero); }
  _fsSet('fs-sb', sb);
  _fsSet('fs-hero', '<div id="fs-art" class="fs-art t">' + _fsTennisCourtSvg(m) + '</div><div id="fs-bandw"></div>', 'hero-' + JSON.stringify(_fsGames(m)) + m.p[0].name);
  _fsSet('fs-bandw', _fsTennisBand(m));
  _fsSet('fs-under', _fsTennisPanel(m));
}
function _fsTennisPanel(m) {
  var a = m.p[0], b = m.p[1];
  var bar = function (x, y, more) {
    var t = (x + y) || 1, pa = Math.round(x / t * 100);
    var hi = more === 'low' ? (x <= y ? 'a' : 'b') : (x >= y ? 'a' : 'b');
    return '<span class="fs-pb"><i class="' + (hi === 'a' ? 'on' : '') + '" style="flex:0 0 ' + pa + '%"></i><i class="' + (hi === 'b' ? 'on' : '') + '" style="flex:1 1 0"></i></span>';
  };
  var rows = [];
  // ESPN's per-player numbers, when the match has them
  var sb = {}; b.stats.forEach(function (s) { sb[s.n] = s; });
  a.stats.forEach(function (s) {
    var o = sb[s.n];
    if (!o || rows.length >= 5) return;
    var x = parseFloat(s.v), y = parseFloat(o.v);
    rows.push({ l: s.l, a: s.v, b: o.v, bar: isFinite(x) && isFinite(y) ? bar(x, y, /error|fault/i.test(s.l) ? 'low' : 'high') : '' });
  });
  var title = 'MATCH STATS';
  if (!rows.length) {
    title = 'BY SET';
    a.sets.forEach(function (s, k) {
      var t = b.sets[k] || {};
      rows.push({ l: 'Set ' + (k + 1) + (s.tb != null || t.tb != null ? ' · tiebreak' : ''), a: s.g, b: t.g, bar: bar(s.g || 0, t.g || 0, 'high') });
    });
    var ga = 0, gb = 0;
    a.sets.forEach(function (s, k) { ga += s.g || 0; gb += (b.sets[k] && b.sets[k].g) || 0; });
    if (a.sets.length) rows.push({ l: 'Games won', a: ga, b: gb, bar: bar(ga, gb, 'high') });
  }
  if (!rows.length) return '<div class="fs-panel"><div class="fs-ph"><span>' + _fsEsc(_fsLast(a.name).toUpperCase()) + '</span><span>MATCH</span><span>' + _fsEsc(_fsLast(b.name).toUpperCase()) + '</span></div><div class="fs-empty sm">Stats fill in once the first ball is struck</div></div>';
  return '<div class="fs-panel"><div class="fs-ph"><span>' + _fsEsc(_fsLast(a.name).toUpperCase()) + '</span><span>' + title + '</span><span>' + _fsEsc(_fsLast(b.name).toUpperCase()) + '</span></div>' +
    rows.slice(0, 6).map(function (r) {
      return '<div class="fs-pr"><span class="v">' + _fsEsc(r.a == null ? '–' : r.a) + '</span><span class="m"><span class="l">' + _fsEsc(r.l) + '</span>' + r.bar + '</span><span class="v r">' + _fsEsc(r.b == null ? '–' : r.b) + '</span></div>';
    }).join('') + '</div>';
}

// ── GOLF ─────────────────────────────────────────────────────────────────
var FS_FOLLOW_KEY = 'innings_golf_follow_v1';
function _fsFollow() { try { return JSON.parse(localStorage.getItem(FS_FOLLOW_KEY) || '{}') || {}; } catch (e) { return {}; } }
function fsGolfStar(id, ev) {
  if (ev) ev.stopPropagation();
  var f = _fsFollow();
  if (f[id]) delete f[id]; else f[id] = 1;
  try { localStorage.setItem(FS_FOLLOW_KEY, JSON.stringify(f)); } catch (e) {}
  window._fs.sig = {};
  _fsRender();
}
function fsGolfFilter(k) { window._fs.golfFilter = k; _fsRender(); }
function fsGolfRow(id) { var F = window._fs; F.golfOpen = F.golfOpen === id ? null : id; _fsRender(); }
function _fsHoles(p) {
  var d = window._fs.data || {}, r = (p.rounds || []).filter(function (x) { return x.r === d.round; })[0];
  return r ? r.holes : [];
}
function _fsRelStr(n) { return n == null ? '' : n === 0 ? 'E' : n > 0 ? '+' + n : '−' + Math.abs(n); }
function _fsToParCls(s) { var t = String(s || ''); return /^-/.test(t) ? 'u' : /^\+/.test(t) ? 'o' : 'e'; }
function _fsGolfHoleSvg(num, par) {
  return '<svg class="fs-svg" viewBox="0 0 358 214" aria-hidden="true">' +
    '<rect width="358" height="214" fill="#11241F"/><ellipse cx="110" cy="80" rx="190" ry="130" fill="#173A2E"/>' +
    '<path d="M 30 170 C 70 150, 110 150, 150 120 S 240 60, 300 54 C 330 52, 340 74, 324 92 C 300 116, 250 104, 200 134 S 110 196, 52 196 C 30 196, 20 182, 30 170 Z" fill="#2F7A55" opacity=".85"/>' +
    '<ellipse cx="300" cy="72" rx="34" ry="24" fill="#4FB37A"/><ellipse cx="248" cy="112" rx="18" ry="10" fill="#E8D9A8" opacity=".85"/>' +
    '<path d="M 330 40 C 350 70, 350 120, 326 150" fill="none" stroke="#3A78C2" stroke-width="16" opacity=".7" stroke-linecap="round"/>' +
    '<rect x="44" y="172" width="16" height="10" rx="2" fill="#E9F5EC" opacity=".7"/>' +
    '<line x1="306" y1="68" x2="306" y2="40" stroke="#fff" stroke-width="2"/><path d="M 306 40 L 320 45 L 306 50 Z" fill="#F2C869"/><circle cx="306" cy="69" r="2.5" fill="#0B1A14"/></svg>' +
    '<div class="fs-hn"><b>' + _fsEsc(num) + '</b>' + (par ? '<span>PAR ' + par + '</span>' : '') + '</div>';
}
function _fsGolfBand(d) {
  var F = window._fs, to = F.to, ps = d.players || [];
  var lead = ps[0];
  if (to && to.id && _fsFresh() || (to && to.id && Date.now() - to.at < 10 * 60e3)) {
    var p = ps.filter(function (x) { return x.id === to.id; })[0];
    if (p) {
      var mine = !!_fsFollow()[p.id];
      return _fsBand({ fresh: _fsFresh(), k: to.k, w: (_fsLast(p.name) + ' · ' + _fsRelStr(p.totN)).toUpperCase(), s: 'Hole ' + to.hole + (mine ? ' · one of your guys' : '') + ' · ' + (p.pos ? p.pos + ' on the board' : ''), kc: to.k === 'BOGEY' || to.k === 'DOUBLE' ? '#9CC3FF' : '#F2C869' });
    }
  }
  if (!lead) return _fsBand({ k: 'THIS WEEK', w: (d.short || d.name || 'PGA TOUR').toUpperCase(), s: d.detail || '' });
  var second = ps[1], gap = second && lead.totN != null && second.totN != null ? second.totN - lead.totN : null;
  if (d.state === 'post') return _fsBand({ k: 'CHAMPION', w: (_fsLast(lead.name) + ' · ' + lead.tot).toUpperCase(), s: d.short || d.name || '' });
  if (d.state === 'pre') return _fsBand({ k: 'THIS WEEK', w: (d.short || d.name || '').toUpperCase(), s: 'Starts ' + _fsDay(d.start) });
  return _fsBand({ k: 'LEADER', w: (_fsLast(lead.name) + ' · ' + lead.tot).toUpperCase(), s: (lead.thru ? (lead.thru === 'F' ? 'Done for the day' : 'Thru ' + lead.thru) : '') + (gap != null ? (gap === 0 ? ' · tied' : ' · ' + gap + '-shot lead') : '') });
}
function _fsGolfRowHtml(p, follow) {
  var F = window._fs, mine = !!follow[p.id], open = F.golfOpen === p.id;
  var today = p.today == null ? '–' : String(p.today).replace(/^-/, '−');
  var row = '<div class="fs-gr' + (open ? ' open' : '') + (p.cut ? ' cut' : '') + '" role="button" tabindex="0" onclick="fsGolfRow(\'' + _fsEsc(p.id) + '\')" onkeydown="if(event.key===\'Enter\')fsGolfRow(\'' + _fsEsc(p.id) + '\')">' +
    '<span class="ps">' + _fsEsc(p.pos || '') + '</span>' +
    '<span class="nm"><button type="button" class="st' + (mine ? ' on' : '') + '" aria-label="' + (mine ? 'Stop following ' : 'Follow ') + _fsEsc(p.name) + '" aria-pressed="' + mine + '" onclick="fsGolfStar(\'' + _fsEsc(p.id) + '\',event)">' + FS_STAR + '</button>' + _fsEsc(p.short || p.name) + '</span>' +
    '<span class="td ' + _fsToParCls(p.today) + '">' + _fsEsc(today) + '</span><span class="th">' + _fsEsc(p.thru || '') + '</span><span class="tt">' + _fsEsc(String(p.tot || '').replace(/^-/, '−')) + '</span></div>';
  if (open) row += _fsGolfCardHtml(p);
  return row;
}
function _fsGolfCardHtml(p) {
  var d = window._fs.data || {}, holes = _fsHoles(p), by = {};
  holes.forEach(function (h) { by[h.h] = h; });
  var cell = function (n) {
    var h = by[n], par = d.par && d.par[n];
    var cls = !h || h.rel == null ? '' : h.rel <= -2 ? 'eg' : h.rel === -1 ? 'bd' : h.rel === 1 ? 'bg' : h.rel >= 2 ? 'db' : '';
    return '<span class="c"><small>' + n + '</small><b class="' + cls + '">' + (h && h.v != null ? h.v : '') + '</b><i>' + (par || '') + '</i></span>';
  };
  var nine = function (a) { var s = ''; for (var i = a; i < a + 9; i++) s += cell(i); return '<div class="fs-cd9">' + s + '</div>'; };
  return '<div class="fs-cd"><div class="fs-cdh">ROUND ' + _fsEsc(d.round || '') + ' · ' + _fsEsc(_fsRelStr(holes.reduce(function (t, h) { return t + (h.rel || 0); }, 0))) + '<span>' + (p.rounds || []).filter(function (r) { return r.total; }).map(function (r) { return 'R' + r.r + ' ' + r.total; }).join(' · ') + '</span></div>' + nine(1) + nine(10) + '</div>';
}
function _fsGolfLive(d) {
  var F = window._fs, ps = d.players || [], follow = _fsFollow();
  var lead = ps[0], lh = lead ? _fsHoles(lead) : [];
  var hole = !lead ? '' : lh.length >= 18 ? 18 : lh.length + 1;
  if (lead && lh.length && lh.length < 18) {
    // the leader's next hole (a shotgun start can start him anywhere)
    var played = {}; lh.forEach(function (h) { played[h.h] = 1; });
    var last = lh[lh.length - 1].h, nx = last % 18 + 1;
    while (played[nx] && nx !== last) nx = nx % 18 + 1;
    hole = nx;
  }
  _fsSet('fs-hero', '<div class="fs-art g">' + (hole ? _fsGolfHoleSvg(hole, d.par && d.par[hole]) : _fsGolfHoleSvg('', null)) + '</div><div id="fs-bandw"></div>', 'hero-' + hole);
  _fsSet('fs-bandw', _fsGolfBand(d));
  var mineList = ps.filter(function (p) { return follow[p.id]; });
  var list = F.golfFilter === 'mine' ? mineList : ps.slice(0, 10);
  var tool = '<div class="fs-tool"><span class="fs-ey">LEADERBOARD</span><span class="fs-pills"><button type="button" class="' + (F.golfFilter !== 'mine' ? 'on' : '') + '" onclick="fsGolfFilter(\'top\')">Top 10</button><button type="button" class="' + (F.golfFilter === 'mine' ? 'on' : '') + '" onclick="fsGolfFilter(\'mine\')">My guys · ' + mineList.length + '</button></span></div>';
  var board = list.length ? '<div class="fs-panel fs-lb"><div class="fs-gr hd"><span>POS</span><span>PLAYER</span><span>TODAY</span><span>THRU</span><span>TOT</span></div>' + list.map(function (p) { return _fsGolfRowHtml(p, follow); }).join('') + '</div>'
    : '<div class="fs-panel"><div class="fs-empty sm">' + (F.golfFilter === 'mine' ? 'Tap the star by any player to follow him here' : 'The field posts once the first tee time goes off') + '</div></div>';
  var call = '';
  mineList.some(function (p) {
    var h = _fsHoles(p).slice(-4), b = h.filter(function (x) { return x.rel != null && x.rel < 0; }).length;
    if (b >= 2) { call = 'Your guy ' + _fsLast(p.name) + ': ' + b + ' under-par holes in his last ' + h.length; return true; }
    if (p === ps[0] || (p.pos && /^T?1$/.test(p.pos))) { call = 'Your guy ' + _fsLast(p.name) + ' has a share of the lead'; return true; }
    return false;
  });
  _fsSet('fs-under', tool + board + (call ? '<div class="fs-call">' + FS_STAR + _fsEsc(call) + '</div>' : ''));
}
function _fsGolfFieldHtml(d) {
  var follow = _fsFollow(), ps = d.players || [];
  if (!ps.length) return '<div class="fs-empty">The field posts once the first tee time goes off</div>';
  return '<div class="fs-pad"><div class="fs-panel fs-lb"><div class="fs-gr hd"><span>POS</span><span>PLAYER</span><span>TODAY</span><span>THRU</span><span>TOT</span></div>' + ps.map(function (p) { return _fsGolfRowHtml(p, follow); }).join('') + '</div></div>';
}

// ── FORMULA 1 ────────────────────────────────────────────────────────────
var FS_TYRE = { SOFT: ['#E8002D', 'S'], MEDIUM: ['#F2C869', 'M'], HARD: ['#F4F4F4', 'H'], INTERMEDIATE: ['#43B047', 'I'], WET: ['#0067AD', 'W'] };
function _fsTyreChip(c) {
  var t = FS_TYRE[String(c || '').toUpperCase()];
  if (!t) return '<span class="fs-ty e" aria-label="Tyre unknown">–</span>';
  return '<span class="fs-ty" style="border-color:' + t[0] + '" aria-label="' + _fsEsc(c.toLowerCase()) + ' tyres">' + t[1] + '</span>';
}
function _fsF1Map(d) {
  var F = window._fs, tr = F.track[F.ev.id];
  if (!tr || tr.loading) return '<div class="fs-art f"><div class="fs-empty sm">Tracing the circuit…</div></div>';
  if (!tr.pts) return '<div class="fs-art f"><div class="fs-empty sm">The circuit draws in once the first laps are run</div></div>';
  // fit the lap into the space above the band
  var W = 358, H = 206, pad = 18, s = Math.min((W - pad * 2) / tr.box.w, (H - pad * 2 - 20) / tr.box.h);
  var ox = (W - tr.box.w * s) / 2, oy = 30 + (H - 30 - tr.box.h * s) / 2;
  var pt = function (x, y) { return (ox + x * s).toFixed(1) + ',' + (oy + y * s).toFixed(1); };
  var path = tr.pts.map(function (p) { return pt(p[0], p[1]); }).join(' ');
  var a = tr.pts[0];
  var cars = (d.live ? d.cars || [] : []).map(function (c) {
    var x = (c.x - tr.box.minX) * tr.box.s, y = (tr.box.maxY - c.y) * tr.box.s;
    var r = (d.rows || []).filter(function (q) { return q.n === c.n; })[0];
    var lead = r && r.pos === 1;
    return '<circle cx="' + (ox + x * s).toFixed(1) + '" cy="' + (oy + y * s).toFixed(1) + '" r="' + (lead ? 7 : 5.5) + '" fill="' + c.color + '" stroke="' + (lead ? '#F2C869' : '#fff') + '" stroke-width="' + (lead ? 2.5 : 1.5) + '"/>';
  }).join('');
  var flag = d.flag || 'GREEN';
  var fcls = { GREEN: 'g', SC: 'y', VSC: 'y', RED: 'r', CHEQUERED: 'c' }[flag] || 'g';
  var fword = { GREEN: 'GREEN', SC: 'SAFETY CAR', VSC: 'VIRTUAL SC', RED: 'RED FLAG', CHEQUERED: 'CHEQUERED' }[flag] || flag;
  return '<div class="fs-art f"><svg class="fs-svg" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
    '<polyline points="' + path + '" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<polyline points="' + path + '" fill="none" stroke="rgba(233,229,255,.6)" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="' + pt(a[0], a[1]).split(',')[0] + '" cy="' + pt(a[0], a[1]).split(',')[1] + '" r="4" fill="#fff"/>' + cars + '</svg>' +
    '<div class="fs-chips">' + (d.live || d.over ? '<span class="fs-chip ' + fcls + '">' + fword + '</span>' : '') + (d.live && d.drs != null ? '<span class="fs-chip">DRS ' + (d.drs ? 'ON' : 'OFF') + '</span>' : '') + '</div></div>';
}
function _fsF1Band(d) {
  var F = window._fs, to = F.to, rows = d.rows || [];
  if (d.liveBlocked) return _fsBand({ k: 'LIVE TIMING', w: 'SESSION UNDERWAY', s: 'The free timing feed opens when it ends' });
  if (to && to.k === 'FLAG' && _fsFresh()) return _fsBand({ fresh: true, k: 'RACE CONTROL', w: ({ SC: 'SAFETY CAR', VSC: 'VIRTUAL SAFETY CAR', RED: 'RED FLAG', CHEQUERED: 'CHEQUERED FLAG' }[d.flag] || d.flag), s: (d.msgs && d.msgs.length ? d.msgs[d.msgs.length - 1].m : ''), bg: d.flag === 'RED' ? '#B3122B' : '#C9A21C', bg2: d.flag === 'RED' ? '#5E0A17' : '#6E5710', ink: '#1A1640', sub: '#2B1A00', kc: '#1A1640' });
  if (d.over && rows[0]) {
    var w = rows[0];
    var word = d.race ? 'WINNER' : /qual|shootout/i.test(d.name) ? 'POLE' : 'FASTEST';
    return _fsBand({ k: word, w: (w.name || w.code).toUpperCase(), s: (w.team || '') + (d.race && rows[1] ? ' · ahead of ' + rows[1].code + (rows[2] ? ', ' + rows[2].code : '') : ''), bg: w.color, bg2: _fsDarken(w.color), ink: _fsInk(w.color), sub: _fsInk(w.color) === '#1A1640' ? '#2B1A00' : '#E9E5FF', kc: _fsInk(w.color) });
  }
  if (d.stop && d.live) {
    var st = d.stop, r = rows.filter(function (q) { return q.n === st.n; })[0];
    var c = st.color;
    return _fsBand({ fresh: !!(to && to.k === 'PIT STOP' && _fsFresh()), k: 'PIT STOP · LAP ' + (st.lap || ''), w: st.code + ' · ' + (st.dur != null ? Number(st.dur).toFixed(1) + ' S' : ''), s: (st.tyre ? 'Out on ' + String(st.tyre).toLowerCase() + 's' : '') + (r && r.pos ? ' · rejoins P' + r.pos : ''), bg: c, bg2: _fsDarken(c), ink: _fsInk(c), sub: _fsInk(c) === '#1A1640' ? '#2B1A00' : '#E9E5FF', kc: _fsInk(c), right: st.tyre ? '<span class="fs-bty">' + _fsTyreChip(st.tyre) + '</span>' : '' });
  }
  if (d.live && rows[0]) return _fsBand({ k: d.race ? 'LEADER' : 'TOP OF THE TIMES', w: (rows[0].name || rows[0].code).toUpperCase(), s: rows[0].team || '' });
  return _fsBand({ k: (d.name || 'SESSION').toUpperCase(), w: ((d.location || '') + ' · ' + _fsDay(d.start)).toUpperCase(), s: 'Lights out ' + _fsTime(d.start) });
}
function _fsDarken(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#231E55';
  var n = parseInt(m[1], 16), f = .45;
  var r = Math.round((n >> 16 & 255) * f), g = Math.round((n >> 8 & 255) * f), b = Math.round((n & 255) * f);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function _fsInk(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#fff';
  var n = parseInt(m[1], 16), L = (.299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255;
  return L > .6 ? '#1A1640' : '#fff';
}
function _fsGap(r, d, i) {
  if (r.dnf) return 'DNF';
  if (r.dns) return 'DNS';
  if (r.dsq) return 'DSQ';
  var g = r.gap;
  if (Array.isArray(g)) { var nn = g.filter(function (x) { return x != null; }); g = nn.length ? nn[nn.length - 1] : null; }
  if (i === 0) return d.race ? 'Leader' : (r.best ? 'Fastest' : 'P1');
  if (g == null || g === '') return '';
  if (typeof g === 'string') return g.indexOf('+') === 0 || /lap/i.test(g) ? g : '+' + g;
  g = Number(g);
  return isFinite(g) ? '+' + (g < 10 ? g.toFixed(3) : g.toFixed(1)) : '';
}
function _fsF1Tower(d) {
  var rows = (d.rows || []).filter(function (r) { return r.pos || d.over; });
  if (!rows.length) return '<div class="fs-panel"><div class="fs-empty sm">' + (d.liveBlocked ? 'Timing fills in when the session ends' : 'The tower fills in once the cars are out') + '</div></div>';
  return '<div class="fs-panel fs-tw"><div class="fs-tr hd"><span>P</span><span></span><span>DRIVER</span><span>' + (d.race ? 'INTERVAL' : 'GAP') + '</span><span>TYRE</span><span>AGE</span></div>' +
    rows.map(function (r, i) {
      var gained = d.race && r.start && r.pos ? r.start - r.pos : 0;
      return '<div class="fs-tr' + (r.inPit ? ' pit' : '') + '"><span class="p">' + (r.pos || '–') + '</span><span class="bar" style="background:' + r.color + '"></span>' +
        '<span class="cd">' + _fsEsc(r.code) + (gained > 0 ? '<em class="up">▲' + gained + '</em>' : gained < 0 && d.over ? '<em class="dn">▼' + (-gained) + '</em>' : '') + (r.inPit ? '<em class="tag pit">PIT</em>' : '') + (r.best ? '<em class="tag fl">FASTEST LAP</em>' : '') + '</span>' +
        '<span class="gp">' + _fsEsc(_fsGap(r, d, i)) + '</span>' + _fsTyreChip(r.tyre) + '<span class="ag">' + (r.age != null ? r.age : '') + '</span></div>';
    }).join('') + '</div>';
}
function _fsF1Live(d) {
  var map = _fsF1Map(d);
  _fsSet('fs-hero', map + '<div id="fs-bandw"></div>', 'hero-map');
  // the cars move every poll: just the map is redrawn, not the band
  var art = document.querySelector('#fs-hero .fs-art.f');
  if (art) {
    var tmp = document.createElement('div'); tmp.innerHTML = map;
    if (art.innerHTML !== tmp.firstChild.innerHTML) art.innerHTML = tmp.firstChild.innerHTML;
  }
  _fsSet('fs-bandw', _fsF1Band(d));
  var note = d.liveBlocked ? '<div class="fs-call">Live F1 timing comes from OpenF1’s paid feed. This session fills in the moment it ends.</div>' : '';
  _fsSet('fs-under', note + _fsF1Tower(d));
}
function _fsF1TyresHtml(d) {
  var rows = (d.rows || []).filter(function (r) { return r.stints && r.stints.length; });
  if (!rows.length) return '<div class="fs-empty">Tyre stints show once the cars are out</div>';
  var maxLap = Math.max.apply(null, rows.map(function (r) { return Math.max(r.laps || 0, r.stints.reduce(function (m, s) { return Math.max(m, s.b || s.a); }, 0)); }).concat([1]));
  return '<div class="fs-pad"><div class="fs-panel"><div class="fs-ph"><span>DRIVER</span><span>STINTS</span><span>LAP ' + maxLap + '</span></div>' +
    rows.map(function (r) {
      var segs = r.stints.map(function (s) {
        var t = FS_TYRE[String(s.c || '').toUpperCase()] || ['#7F77DD', '?'];
        var a = s.a || 1, b = s.b || r.laps || a;
        var w = Math.max(2, (b - a + 1) / maxLap * 100);
        return '<i style="width:' + w.toFixed(1) + '%;background:' + t[0] + '" title="' + _fsEsc((s.c || '') + ' laps ' + a + '–' + b) + '"><b style="color:' + _fsInk(t[0]) + '">' + t[1] + '</b></i>';
      }).join('');
      return '<div class="fs-st"><span class="cd"><span class="bar" style="background:' + r.color + '"></span>' + _fsEsc(r.code) + '</span><span class="sg">' + segs + '</span></div>';
    }).join('') + '<div class="fs-key">' + Object.keys(FS_TYRE).map(function (k) { return '<span><i style="background:' + FS_TYRE[k][0] + '"></i>' + k.charAt(0) + k.slice(1).toLowerCase() + '</span>'; }).join('') + '</div></div></div>';
}
function _fsF1StandingsHtml(s) {
  if (!s) return '<div class="fs-empty">Loading standings…</div>';
  if (!s.drivers || !s.drivers.length) return '<div class="fs-empty">Standings unavailable right now</div>';
  var tbl = function (title, list, nm) {
    return '<div class="fs-panel"><div class="fs-ph"><span>' + title + '</span><span>' + (s.round ? 'AFTER ROUND ' + s.round : '') + '</span><span>PTS</span></div>' +
      list.map(function (x) { return '<div class="fs-sr"><span class="p">' + _fsEsc(x.pos) + '</span><span class="nm">' + nm(x) + '</span><span class="pt">' + _fsEsc(x.pts) + '</span></div>'; }).join('') + '</div>';
  };
  return '<div class="fs-pad">' + tbl('DRIVERS', s.drivers, function (x) { return _fsEsc(x.name) + '<small>' + _fsEsc(x.team) + '</small>'; }) +
    (s.teams && s.teams.length ? tbl('CONSTRUCTORS', s.teams, function (x) { return _fsEsc(x.name); }) : '') + '</div>';
}

// ── CHAT (gameChats, keyed by event) ─────────────────────────────────────
function _fsChatKey() { var ev = window._fs.ev; return ev ? 'ev:' + ev.sport + ':' + ev.id : null; }
function _fsChatStart() {
  var F = window._fs, key = _fsChatKey();
  if (!key || F.unsub && F.unsubKey === key) return;
  _fsChatStop();
  if (!window.db) { F.msgs = null; _fsChatRender(); return; }
  F.unsubKey = key;
  F.unsub = window.db.collection('gameChats').where('gamePk', '==', key).limit(300).onSnapshot(function (snap) {
    var msgs = [];
    snap.forEach(function (doc) { msgs.push(Object.assign({ _id: doc.id }, doc.data())); });
    msgs.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
    F.msgs = msgs;
    if (F.tab === 'chat' && _fsChatKey() === key) _fsChatRender();
  }, function (err) {
    console.error('[event chat]', err);
    F.msgs = null; F.chatErr = true;
    if (F.tab === 'chat') _fsChatRender();
  });
}
function _fsChatStop() { var F = window._fs; if (F.unsub) { try { F.unsub(); } catch (e) {} } F.unsub = null; F.unsubKey = null; F.msgs = []; F.chatErr = false; }
function _fsChatRender() {
  var F = window._fs, body = document.getElementById('fs-ev-body');
  if (!body) return;
  var me = (window.currentUser || (window.auth && window.auth.currentUser) || {}).uid;
  var msgs = F.msgs || [];
  var list = F.chatErr || F.msgs === null ? '<div class="fs-empty">Chat is unavailable right now</div>'
    : !msgs.length ? '<div class="fs-empty">Nobody’s said anything yet. Start it.</div>'
    : msgs.map(function (m) {
      var mine = m.uid === me;
      return '<div class="fs-msg' + (mine ? ' me' : '') + '">' + (mine ? '' : '<span class="au">' + _fsEsc(m.author || '') + '</span>') + '<span class="bb">' + _fsEsc(m.text || '') + '</span></div>';
    }).join('');
  var hadInput = document.getElementById('fs-chat-in');
  var draft = hadInput ? hadInput.value : '';
  var focused = hadInput && document.activeElement === hadInput;
  var html = '<div class="fs-chat"><div class="fs-msgs" id="fs-msgs">' + list + '</div>' +
    '<form class="fs-cin" onsubmit="event.preventDefault();fsChatSend()"><label class="fs-sr-only" for="fs-chat-in">Message</label><input id="fs-chat-in" class="msg-input" placeholder="Message…" autocomplete="off"><button type="submit" aria-label="Send">' +
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></form></div>';
  if (F.sig.body === html) return;
  F.sig.body = html;
  body.innerHTML = html;
  var inp = document.getElementById('fs-chat-in');
  if (inp) { inp.value = draft; if (focused) inp.focus(); }
  body.scrollTop = body.scrollHeight;
}
function fsChatSend() {
  var inp = document.getElementById('fs-chat-in'), text = inp ? inp.value.trim() : '';
  if (!text) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast === 'function') ib_toast('Sign in to chat'); return; }
  var key = _fsChatKey(), ev = window._fs.ev, d = window._fs.data || {};
  inp.value = '';
  var label = ev.sport === 'tennis' && d.p ? _fsLast(d.p[0].name) + ' vs ' + _fsLast(d.p[1].name) : ev.sport === 'golf' ? (d.short || d.name || 'Golf') : ((d.location || '') + ' ' + (d.name || '')).trim();
  window.db.collection('gameChats').add({ gamePk: key, sport: ev.sport, label: label, uid: user.uid, author: (window.userData && window.userData.name) || 'You', text: text, ts: Date.now() })
    .catch(function (err) { console.error('[event chat] send', err); if (typeof ib_toast === 'function') ib_toast('Could not send — ' + (err && err.message ? err.message : 'try again')); });
}
