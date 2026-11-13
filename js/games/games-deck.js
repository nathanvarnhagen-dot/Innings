// ══ GAMES · THE LEAGUE RAIL AND THE STACK (v7.95.0) ═════════════════════
// The Games page, redrawn:
//   · no title bar. A rail of leagues runs along the top (emoji over the
//     league's name, a count while games are live). Multi view sits first.
//     Tapping a league shows it right here instead of leaving the page.
//   · under it, the league's line — name, date, how many are live, where the
//     season stands — with search, standings / playoff picture, your teams
//     and "?" (how this page works). v7.96.0: arrows under it step through
//     days (football: weeks, listed a day at a time) without leaving the page;
//     no league opens its old schedule page from here any more.
//   · THE STACK: only the league's live games and your teams' games, as a
//     pile of team-color cards. Live games first. Swipe up for the next one
//     (it glides away and the glow behind the pile turns the next game's
//     colors), swipe down to go back, tap to open the game. A live card
//     carries the score by period, the win chance when the feed has one, and
//     the state of the game (fouls, timeouts, the bonus; down and distance;
//     shots and the power play; outs, count and runners), then the last play.
//   · EVERY GAME of the day in a list under the pile, tinted in the teams'
//     colors. Tap a row to open that game.
//
// Nothing was removed: the tiles, "Which league…", the playoff cards and the
// recap rings are all still built by breaks-weeks-and-flourishes.js. The
// tiles and the question are hidden while this is on; the playoff cards and
// recaps sit under the list. Tennis, golf and F1 open their own pages from
// the rail, as do leagues that are "coming soon".
//
// Turning it off: open the app with ?games=tiles (saved on this device);
// ?games=deck turns it back on.

(function () {
  var KEY = 'innings_games';
  function wanted() {
    try {
      var q = new URLSearchParams(location.search).get('games');
      if (q === 'deck' || q === 'tiles') localStorage.setItem(KEY, q);
      return localStorage.getItem(KEY) !== 'tiles';
    } catch (e) { return true; }
  }
  var ON = wanted();
  window.gdkSetMode = function (mode) {
    if ((mode === 'deck') === ON) return;
    try { localStorage.setItem(KEY, mode); } catch (e) {}
    try { var u = new URL(location.href); u.searchParams.set('games', mode); location.replace(u.toString()); }
    catch (e) { location.reload(); }
  };
  if (!ON) return;
  var scr = document.getElementById('screen-games-picker');
  var sc = scr && scr.querySelector('.scroll-bare');
  if (!sc || typeof GAMES_SPORTS === 'undefined') return;
  document.documentElement.classList.add('gdk-on');

  var root = document.createElement('div');
  root.id = 'gdk';
  // v7.100.0: the league's art sits behind the top; the rail rides in a purple glass oval over it
  root.innerHTML = '<div id="gdk-art" aria-hidden="true"></div><div id="gdk-band"><div id="gdk-rail" role="tablist" aria-label="Leagues"></div></div><div id="gdk-head"></div>' +
    '<div id="gdk-stage"><div id="gdk-glow" aria-hidden="true"><i></i><i></i></div><div id="gdk-deck"></div></div><div id="gdk-list"></div>';
  sc.insertBefore(root, sc.firstChild);
  var artEl = root.children[0], railEl = root.children[1].firstChild, headEl = root.children[2], stageEl = root.children[3], listEl = root.children[4];
  var glowEl = stageEl.children[0], deckEl = stageEl.children[1];

  var S = { sport: null, picked: false, auto: false, order: [], items: {}, all: [], prefs: {}, prefsAt: 0, glance: {}, glanceAt: {}, more: false, busy: 0, sig: {}, drag: null, off: {}, wk: {}, cache: {}, loading: {} };
  try { S.sport = localStorage.getItem(KEY + '_lg') || null; } catch (e) {}
  var SHORT = { cfb: 'CFB', cbb: 'CBB' }, EMOJI = { cfb: '🎓' };
  var BK = { nba: 1, wnba: 1, cbb: 1 }, FB = { nfl: 1, cfb: 1 }, SOC = { mls: 1, nwsl: 1 };
  var GRID = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>';
  var UP = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F3F1FF" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6l6 6"/></svg>';

  function esc(s) { return typeof _escapeHtml === 'function' ? _escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function active() { return scr.classList.contains('active'); }
  function leagues() { return GAMES_SPORTS.concat(window._fsTiles || []); }
  function league(key) { return leagues().filter(function (s) { return s.key === key; })[0] || null; }
  function inPage(s) { return !!(s && s.live && !s.ev); }
  function label(s) { return SHORT[s.key] || s.name; }

  // ── colors: deep enough for white type ──
  function rgb(c) {
    c = String(c || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(c)) c = c.replace(/./g, '$&$&');
    if (!/^[0-9a-f]{6}$/i.test(c)) return null;
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  }
  function mix(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }
  function lum(c) { var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
  function deep(hex) {
    var c = rgb(hex) || [61, 53, 128];
    for (var i = 0; i < 8 && lum(c) > 0.11; i++) c = mix(c, [0, 0, 0], 0.16);
    if (lum(c) < 0.012) c = mix(c, [120, 110, 190], 0.2); // a black team still reads as a color
    return c;
  }
  function css(c, a) { return a == null ? 'rgb(' + c.join(',') + ')' : 'rgba(' + c.join(',') + ',' + a + ')'; }
  function look(sport, g, side) {
    var a = side === 'a';
    var nm = a ? g.away : g.home, ab = a ? g.awayAbbr : g.homeAbbr, col = a ? g.awayColor : g.homeColor, alt = a ? g.awayAlt : g.homeAlt;
    var t = null;
    try { if (typeof _teamLook === 'function') t = _teamLook(sport, nm, ab, col, alt); } catch (e) {}
    if (!t) t = { abbr: ab || String(nm || '').slice(0, 3).toUpperCase(), bg: '#3D3580' };
    return { abbr: String(t.abbr || '').toUpperCase().slice(0, 4), c: deep(t.bg), name: typeof _glShort === 'function' ? _glShort(nm) : nm };
  }
  function cardBg(it) { return 'linear-gradient(100deg,' + css(it.la.c) + ' 0%,#16122E 50%,' + css(it.lh.c) + ' 100%)'; }
  function rowBg(it) { return 'linear-gradient(100deg,' + css(it.la.c, 0.62) + ' 0%,rgba(22,18,46,.6) 50%,' + css(it.lh.c, 0.62) + ' 100%)'; }

  // ── your teams ──
  function user() { return window.currentUser || (window.auth && window.auth.currentUser) || null; }
  function loadPrefs() {
    var u = user();
    if (!u || !window.db) return Promise.resolve();
    if (S.prefsAt && Date.now() - S.prefsAt < 60000) return Promise.resolve();
    S.prefsAt = Date.now();
    return Promise.all(GAMES_SPORTS.map(function (s) {
      return window.db.collection('users').doc(u.uid).collection('teamPrefs').doc(s.key).get()
        .then(function (doc) { var d = doc.exists ? doc.data() : {}; S.prefs[s.key] = { favorite: d.favorite || null, following: d.following || [] }; })
        .catch(function (e) { console.error('[games deck] team prefs', s.key, e); });
    }));
  }
  function mine(sport, team) {
    var p = S.prefs[sport] || {};
    return p.favorite === team ? 2 : (p.following || []).indexOf(team) !== -1 ? 1 : 0;
  }

  // ── today's games (the same lists Multi view and Home read) ──
  function allGames() { try { return typeof _mvAll === 'function' ? _mvAll() : []; } catch (e) { return []; } }
  function hasData() { try { return typeof _mvHasData === 'function' ? _mvHasData() : false; } catch (e) { return false; } }
  function phase(sport, g) {
    try {
      if (typeof _glPhase === 'function') return _glPhase(sport, g);
      if (typeof _mvPhase === 'function') return _mvPhase(sport, g);
    } catch (e) {}
    return g.state === 'in' ? 'live' : g.state === 'post' ? 'post' : 'pre';
  }
  function statusOf(sport, g, ph) {
    try { if (typeof _glRowStatus === 'function') return _glRowStatus(sport, g, ph); } catch (e) {}
    if (ph === 'pre') return (typeof _formatGameTime === 'function' && _formatGameTime(g.startTime)) || 'Today';
    return g.statusDetail || g.status || (ph === 'post' ? 'Final' : 'Live');
  }
  function counts() {
    var live = {}, day = {};
    allGames().forEach(function (x) {
      day[x.sport] = (day[x.sport] || 0) + 1;
      if (phase(x.sport, x.g) === 'live') live[x.sport] = (live[x.sport] || 0) + 1;
    });
    Object.keys(window._fsLive || {}).forEach(function (k) { live[k] = (live[k] || 0) + (Number(window._fsLive[k]) || 0); });
    return { live: live, day: day };
  }
  // ── v7.96.0: which day (or, for football, which week) of a league is showing ──
  // Nothing on this page leaves for the league's old schedule page any more:
  // the arrows under the league's name step through days or weeks right here.
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return typeof _todayLocal === 'function' ? _todayLocal() : iso(new Date()); }
  function noon(s) { return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)), 12); }
  function addDays(s, n) { var d = noon(s); d.setDate(d.getDate() + n); return iso(d); }
  function curWk() {
    if (typeof FOOTBALL_CURRENT_WEEK_TUESDAY !== 'undefined') return FOOTBALL_CURRENT_WEEK_TUESDAY;
    var d = noon(today()); d.setDate(d.getDate() - ((d.getDay() - 2 + 7) % 7)); return iso(d);
  }
  function wkOf(sport) { return S.wk[sport] || curWk(); }
  function dayOf(sport) { return addDays(today(), S.off[sport] || 0); }
  function atNow(sport) { return FB[sport] ? wkOf(sport) === curWk() : !(S.off[sport] || 0); }
  function viewKey(sport) { return FB[sport] ? sport + ':w' + wkOf(sport) : sport + ':' + dayOf(sport); }
  function viewDates(sport) {
    if (!FB[sport]) return [dayOf(sport)];
    var out = [], w = wkOf(sport);
    for (var i = 0; i < 7; i++) out.push(addDays(w, i));
    return out;
  }
  function needsFetch(sport) { return FB[sport] || !!(S.off[sport] || 0); }
  function ensure(sport) {
    if (!needsFetch(sport) || typeof _bsModalScheduleUrl !== 'function' || !window.fetch) return;
    var key = viewKey(sport), c = S.cache[key], dates = viewDates(sport);
    var ttl = dates.indexOf(today()) !== -1 ? 60000 : 300000;
    if (S.loading[key] || (c && Date.now() - c.at < ttl)) return;
    S.loading[key] = true;
    Promise.all(dates.map(function (d) {
      return fetch(_bsModalScheduleUrl(sport, d))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return { day: d, games: (j && j.games) || [], ok: !!(j && j.games) }; })
        .catch(function () { return { day: d, games: [], ok: false }; });
    })).then(function (res) {
      S.loading[key] = false;
      if (!res.some(function (x) { return x.ok; }) && S.cache[key]) { S.cache[key].at = Date.now() - ttl + 20000; return; } // every request failed: keep what's there, ask again soon
      var seen = {}, list = [];
      res.forEach(function (x) { x.games.forEach(function (g) { if (!g || g.gamePk == null || seen[g.gamePk]) return; seen[g.gamePk] = 1; list.push({ g: g, day: x.day }); }); });
      S.cache[key] = { at: Date.now(), list: list };
      render();
    });
  }
  function loaded(sport) { return needsFetch(sport) ? !!S.cache[viewKey(sport)] : hasData(); }
  // the games of the day or week that's showing → [{ g, day }]
  function source(sport) {
    var t = today(), live = [];
    allGames().forEach(function (x) { if (x.sport === sport) live.push({ g: x.g, day: t }); });
    if (!needsFetch(sport)) return live;
    var c = S.cache[viewKey(sport)], list = c ? c.list.slice() : [];
    // today's games are fresher in the lists Home and Multi view keep
    if (viewDates(sport).indexOf(t) !== -1) {
      var at = {};
      list.forEach(function (x, i) { at[x.g.gamePk] = i; });
      live.forEach(function (x) { if (at[x.g.gamePk] != null) list[at[x.g.gamePk]] = { g: x.g, day: list[at[x.g.gamePk]].day }; else if (c) list.push(x); });
    }
    return list;
  }
  function build(sport) {
    var out = [];
    source(sport).forEach(function (x) {
      var g = x.g;
      if (!g || g.gamePk == null || !g.away || !g.home) return;
      var ph = phase(sport, g), ma = mine(sport, g.away), mh = mine(sport, g.home);
      out.push({ id: sport + ':' + g.gamePk, sport: sport, g: g, day: x.day, ph: ph, ma: ma, mh: mh, mine: Math.max(ma, mh),
        la: look(sport, g, 'a'), lh: look(sport, g, 'h'), t: Date.parse(g.startTime || '') || 0 });
    });
    return out;
  }
  var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function dayWord(d, short) {
    var diff = Math.round((noon(d) - noon(today())) / 864e5);
    if (diff === 0) return new Date().getHours() >= 17 ? 'Tonight' : 'Today';
    if (diff === -1) return 'Yesterday';
    if (diff === 1) return 'Tomorrow';
    if (short || Math.abs(diff) > 6) return noon(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
    return DOW[noon(d).getDay()];
  }
  // what goes in the pile: live games, and your teams' games whatever their state
  // v7.101.0: every game of the day (or week) is in the pile now, live games and your teams first;
  // the list under it marks the one on top, and a tap on a row brings that game up
  function inStack(it) {
    return true;
    if (it.mine) return true;
    if (it.ph !== 'live') return false;
    try { return typeof _cbbWorthy !== 'function' || _cbbWorthy(it.sport, it.g); } catch (e) { return true; }
  }
  var PH = { live: 0, pre: 1, post: 2 };
  function stackRank(a, b) { return (PH[a.ph] - PH[b.ph]) || (b.mine - a.mine) || (a.t - b.t); }
  function listRank(a, b) { return (PH[a.ph] - PH[b.ph]) || (a.t - b.t); }

  function pickDefault(c) {
    var ok = function (k) { var s = league(k); return inPage(s); };
    if ((S.picked || S.auto) && ok(S.sport)) return S.sport;
    var keys = GAMES_SPORTS.filter(inPage).map(function (s) { return s.key; });
    // a league with one of your teams playing today, then the one with the most live games
    var withMine = keys.filter(function (k) { return build(k).some(function (it) { return it.mine && it.ph !== 'post'; }); });
    var liveSorted = keys.filter(function (k) { return c.live[k]; }).sort(function (a, b) { return c.live[b] - c.live[a]; });
    var mineLive = withMine.filter(function (k) { return c.live[k]; });
    if (mineLive.length) return mineLive[0];
    if (S.sport && ok(S.sport) && (c.live[S.sport] || (!liveSorted.length && c.day[S.sport]))) return S.sport;
    if (liveSorted.length) return liveSorted[0];
    if (withMine.length) return withMine[0];
    if (S.sport && ok(S.sport) && c.day[S.sport]) return S.sport;
    var today = keys.filter(function (k) { return c.day[k]; });
    return today[0] || (ok(S.sport) ? S.sport : keys[0]);
  }

  // ── the rail ──
  function renderRail(c) {
    var ls = leagues().slice();
    // leagues with something live lead, then leagues playing today; the rest keep their order
    // v7.100.1: tennis, golf and F1 are still in progress, so they always sit at the back of the rail
    var w = function (s) { return s.ev ? 3 : c.live[s.key] ? 0 : c.day[s.key] ? 1 : 2; };
    ls = ls.map(function (s, i) { return { s: s, i: i }; }).sort(function (a, b) { return (w(a.s) - w(b.s)) || (a.i - b.i); }).map(function (x) { return x.s; });
    var mvLive = 0;
    try { mvLive = typeof _mvLiveCount === 'function' ? _mvLiveCount() : 0; } catch (e) {}
    var html = typeof multiOpen === 'function'
      ? '<button class="gdk-lg" onclick="multiOpen()" aria-label="Multi view, up to 4 games at once"><span class="em">' + GRID + '</span><span class="nm">Multi</span>' +
        (mvLive ? '<span class="lv"><i></i>' + mvLive + '</span>' : '') + '</button>'
      : '';
    html += ls.map(function (s) {
      var n = c.live[s.key] || 0, on = s.key === S.sport, quiet = !n && !c.day[s.key] && !s.ev;
      return '<button class="gdk-lg' + (on ? ' on' : '') + (quiet ? ' quiet' : '') + '" role="tab" aria-selected="' + on + '" data-lg="' + esc(s.key) + '" onclick="gdkPick(this.dataset.lg)" aria-label="' + esc(s.name + (n ? ', ' + n + ' live' : '')) + '">' +
        '<span class="em" aria-hidden="true">' + (EMOJI[s.key] || s.emoji) + '</span><span class="nm">' + esc(label(s)) + '</span>' +
        (s.ev ? '<span class="wip">In progress</span>' : !s.live ? '<span class="wip">Coming soon</span>' : '') +
        (n ? '<span class="lv"><i></i>' + n + '</span>' : '') + '</button>';
    }).join('');
    if (S.sig.rail === html) return;
    S.sig.rail = html;
    var left = railEl.scrollLeft;
    railEl.innerHTML = html;
    railEl.scrollLeft = left;
  }
  function railReveal() {
    var on = railEl.querySelector('.gdk-lg.on');
    if (!on) return;
    var l = on.offsetLeft - 14, r = l + on.offsetWidth + 28;
    if (l < railEl.scrollLeft) railEl.scrollLeft = l;
    else if (r > railEl.scrollLeft + railEl.clientWidth) railEl.scrollLeft = r - railEl.clientWidth;
  }

  // ── the league line ──
  var IC_SEARCH = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>';
  var IC_CUP = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7l-1-3h-5z"/></svg>';
  var IC_TEAMS = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.6 6.7 19.5l1.1-6L3.4 9.3l6-.8z"/></svg>';
  var IC_TV = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2.5"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
  var CUP = { mlb: 'Playoff picture', nfl: 'Playoff picture', nba: 'Standings', cbb: 'Top 25' };
  function renderHead(c) {
    var s = league(S.sport); if (!s) { headEl.innerHTML = ''; return; }
    headEl.dataset.lg = s.key;
    var k = s.key, fb = !!FB[k], now = atNow(k), ph = '';
    var phOff = false;
      try { var p = typeof _gsPhaseState === 'function' ? _gsPhaseState().by[k] : null; ph = (p && p.label) || ''; phOff = !!(p && p.phase === 'off'); } catch (e) {}
    var live = S.all.filter(function (it) { return it.ph === 'live'; }).length, tot = S.all.length;
    var lab, sub;
    if (fb) {
      var wn = null;
      try { wn = typeof _footballWeekNumber === 'function' ? _footballWeekNumber(k, wkOf(k)) : null; } catch (e) {}
      lab = wn != null && wn >= 1 ? 'Week ' + wn : dayWord(wkOf(k), true);
      var w0 = noon(wkOf(k)), w1 = noon(addDays(wkOf(k), 6)), f = function (d) { return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
      sub = esc(f(w0) + ' – ' + f(w1)) + (live ? ' · <b>' + live + ' live</b>' : '') + (tot ? ' · ' + tot + (tot === 1 ? ' game' : ' games') : '');
    } else {
      lab = dayWord(dayOf(k));
      var d = noon(dayOf(k)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
      sub = esc(d) + (live ? ' · <b>' + live + ' live</b>' : '') + (tot ? ' · ' + tot + (tot === 1 ? ' game' : ' games') : '');
    }
    var ib = function (fn, label, icon) { return '<button class="gdk-ib" data-lg="' + esc(k) + '" onclick="' + fn + '(this.dataset.lg)" aria-label="' + esc(label) + '">' + icon + '</button>'; };
    // v7.99.1: the date line sits under the name and the buttons, full width, so it never runs under them
    var meta = '<div class="meta"><span class="sub">' + sub + '</span>' + (ph && !(fb && /^week/i.test(ph)) ? '<span class="ph">' + esc(ph) + '</span>' : '') + '</div>';
    // v7.100.0: the NFL's week as the chain gang's sticks
    if (k === 'nfl' && wn != null && wn >= 1 && wn <= 18) meta += '<div class="gdk-chain" aria-hidden="true"><i></i><u></u><i></i><b>Week ' + wn + ' of 18</b></div>';
    var html = '<div class="row"><div class="tx"><span class="nm' + (s.name.length > 6 ? ' long' : '') + '">' + esc(s.name) + '</span></div>' +
      '<div class="bt">' + (typeof innGuide === 'function' && GAMES_SPORTS.some(function (x) { return x.key === k; }) ? ib('gdkGuide', s.name + ' on TV', IC_TV) : '') +
      (typeof openInningsSearch === 'function' ? ib('gdkSearch', 'Search players, teams and rules', IC_SEARCH) : '') +
      (CUP[k] && typeof openPlayoffPicture === 'function' ? ib('gdkCup', s.name + ' ' + CUP[k], IC_CUP) : '') +
      (typeof openTeamPrefs === 'function' ? ib('gdkTeams', 'Your ' + s.name + ' teams', IC_TEAMS) : '') +
      (typeof window.hiwPlay === 'function' ? '<button class="gdk-ib" onclick="hiwPlay(\'games\')" aria-label="How Games works">?</button>' : '') + '</div></div>' + meta +
      '<div class="gdk-sw"><button class="ar" onclick="gdkShift(-1)" aria-label="' + (fb ? 'Previous week' : 'Previous day') + '">‹</button>' +
      '<button class="lb" onclick="gdkNow()"' + (now ? ' disabled' : '') + ' aria-label="' + esc(lab + (now ? '' : ', back to ' + (fb ? 'this week' : 'today'))) + '"><b>' + esc(lab) + '</b>' + (now ? '' : '<small>Back to ' + (fb ? 'this week' : 'today') + '</small>') + '</button>' +
      '<button class="ar" onclick="gdkShift(1)" aria-label="' + (fb ? 'Next week' : 'Next day') + '">›</button></div>';
    if (S.sig.head === html) return;
    S.sig.head = html;
    headEl.innerHTML = html;
  }
  // v7.99.0: the TV guide for the league and day showing (football: the week, a day at a time)
  window.gdkGuide = function (k) {
    if (typeof innGuide !== 'function' || !k) return;
    var s = league(k), opts = { sports: [k], label: s ? s.name : k.toUpperCase() };
    if (FB[k]) {
      var days = {};
      build(k).forEach(function (it) { if (it.day) days[it.day] = 1; });
      var ds = Object.keys(days).sort();
      opts.dates = ds.length ? ds : viewDates(k);
      opts.date = opts.dates.indexOf(today()) !== -1 ? today() : (opts.dates.filter(function (d) { return d >= today(); })[0] || opts.dates[0]);
    } else opts.date = dayOf(k);
    innGuide(opts);
  };
  window.gdkShift = function (dir) {
    var k = S.sport; if (!k) return;
    if (FB[k]) S.wk[k] = addDays(wkOf(k), dir * 7); else S.off[k] = Math.max(-365, Math.min(365, (S.off[k] || 0) + dir));
    S.order = []; S.more = false; render();
  };
  window.gdkNow = function () { var k = S.sport; if (!k || atNow(k)) return; delete S.wk[k]; delete S.off[k]; S.order = []; S.more = false; render(); };
  window.gdkSearch = function () { if (typeof openInningsSearch === 'function') openInningsSearch(); };
  window.gdkCup = function (k) { if (typeof openPlayoffPicture === 'function') openPlayoffPicture(k); };
  window.gdkTeams = function (k) { S.prefsAt = 0; if (typeof openTeamPrefs === 'function') openTeamPrefs(k); };

  // ── a card ──
  function perHtml(it) {
    var per = it.g.per;
    if (!per || it.ph === 'pre') return '';
    var a = per.a || [], h = per.h || [], n = Math.max(a.length, h.length);
    if (!n) return '';
    var sp = it.sport, reg = sp === 'mlb' ? 9 : sp === 'nhl' ? 3 : (SOC[sp] || sp === 'cbb') ? 2 : 4;
    var cols = Math.max(reg, n), start = cols > 10 ? cols - 9 : 0, hd = '', ra = '', rh = '';
    var cell = function (v) { return '<span class="c">' + (v == null ? '–' : esc(v)) + '</span>'; };
    for (var i = start; i < cols; i++) {
      var lb = sp === 'mlb' || i < reg ? String(i + 1) : (cols - reg > 1 ? 'OT' + (i - reg + 1) : 'OT');
      hd += '<span class="c">' + lb + '</span>'; ra += cell(a[i]); rh += cell(h[i]);
    }
    var tot = function (v) { return '<span class="tot">' + (v == null ? '' : esc(v)) + '</span>'; };
    return '<div class="gdk-ls hd"><span class="t"></span>' + hd + '<span class="tot">T</span></div>' +
      '<div class="gdk-ls"><span class="t">' + esc(it.la.abbr) + '</span>' + ra + tot(it.g.awayScore) + '</div>' +
      '<div class="gdk-ls"><span class="t">' + esc(it.lh.abbr) + '</span>' + rh + tot(it.g.homeScore) + '</div>';
  }
  function wpHtml(it) {
    var w = Number(it.g.wp);
    if (it.ph !== 'live' || it.g.wp == null || !isFinite(w)) return '';
    return '<div class="gdk-wp" aria-label="Win chance: ' + esc(it.la.abbr) + ' ' + (100 - w) + ' percent, ' + esc(it.lh.abbr) + ' ' + w + ' percent"><span class="l">' + esc(it.la.abbr) + ' ' + (100 - w) + '%</span>' +
      '<span class="bar"><i style="width:' + (100 - w) + '%"></i></span><span class="r">' + w + '% ' + esc(it.lh.abbr) + '</span></div>';
  }
  // the state of a live game → { facts: [[text, gold?]], last }
  function stateOf(it) {
    var g = it.g, sp = it.sport, sit = g.sit || {}, facts = [], last = '';
    if (it.ph === 'pre') {
      if (g.network) facts.push([g.network]);
      if (g.venue) facts.push([g.venue]);
      return { facts: facts, last: '' };
    }
    if (it.ph !== 'live') return { facts: [], last: g.headline && !/^final/i.test(g.headline) ? String(g.headline).replace(/\s+-\s+/g, ' · ') : '' };
    if (BK[sp]) {
      var gl = S.glance[it.id];
      if (gl) {
        if (gl.fouls) facts.push(['Fouls ' + gl.fouls.a + ' · ' + gl.fouls.h]);
        if (gl.timeouts) facts.push(['TO used ' + gl.timeouts.a + ' · ' + gl.timeouts.h]);
        if (gl.fouls && sp !== 'cbb') {
          var ab = gl.fouls.h >= 5, hb = gl.fouls.a >= 5; // five team fouls in a quarter puts the other side in the bonus
          if (ab || hb) facts.push([ab && hb ? 'Both in bonus' : (ab ? it.la.abbr : it.lh.abbr) + ' in bonus', true]);
        }
        if (gl.run && gl.run.pts >= 8) last = (gl.run.side === 'a' ? it.la.abbr : it.lh.abbr) + ' on a ' + gl.run.pts + '–' + (gl.run.opp || 0) + ' run';
        else if (gl.last && gl.last.text) last = gl.last.text;
      }
    } else if (FB[sp]) {
      if (sit.dd) facts.push([(sit.poss ? sit.poss + ' · ' : '') + sit.dd + (sit.spot ? ' at ' + sit.spot : '')]);
      if (sit.toA != null && sit.toH != null) facts.push(['Timeouts ' + sit.toA + ' · ' + sit.toH]);
      if (sit.rz) facts.push(['Red zone', true]);
      last = sit.last || '';
    } else if (sp === 'nhl') {
      if (sit.sogA != null && sit.sogH != null) facts.push(['Shots ' + sit.sogA + ' · ' + sit.sogH]);
      if (sit.pp) facts.push([(sit.pp.abbr || '') + ' power play' + (sit.pp.clock ? ' ' + sit.pp.clock : ''), true]);
      if (sit.en) facts.push([(sit.en === 'a' ? it.la.abbr : it.lh.abbr) + ' net empty', true]);
      last = sit.last ? 'Last goal: ' + sit.last : '';
    } else if (sp === 'mlb') {
      if (g.outs != null) facts.push([g.outs + (g.outs === 1 ? ' out' : ' outs')]);
      if (g.balls != null && g.strikes != null) facts.push(['Count ' + g.balls + '-' + g.strikes]);
      if (g.bases) {
        var on = ['first', 'second', 'third'].filter(function (b) { return g.bases[b]; }).map(function (b) { return { first: '1st', second: '2nd', third: '3rd' }[b]; });
        facts.push([on.length === 3 ? 'Bases loaded' : on.length ? 'On ' + on.join(' & ') : 'Bases empty', on.length >= 2]);
      }
      last = (g.batter ? 'At bat: ' + g.batter : '') + (g.batter && g.pitcher ? ' · ' : '') + (g.pitcher ? 'Pitching: ' + g.pitcher : '');
    } else if (SOC[sp]) {
      var goals = (g.goals || []).filter(function (x) { return x && /goal|pk|og/.test(x.k); }), lg = goals[goals.length - 1];
      if (lg) last = 'Last goal: ' + (lg.who || 'Goal') + (lg.t ? ' ' + lg.t : '') + (lg.s ? ' · ' + (lg.s === 'a' ? it.la.abbr : it.lh.abbr) : '');
    }
    return { facts: facts.slice(0, 3), last: last };
  }
  function cardHtml(it, pos, total) {
    var g = it.g, ph = it.ph, st = statusOf(it.sport, g, ph);
    var scored = ph !== 'pre' && g.awayScore != null && g.homeScore != null;
    var cap = ph === 'live' ? '<span class="gdk-st live"><i></i>Live · ' + esc(st) + '</span>'
      : ph === 'post' ? '<span class="gdk-st' + (it.mine ? ' fav' : '') + '">' + (it.mine ? 'Your team · ' : '') + esc(st) + '</span>'
      : '<span class="gdk-st' + (it.mine ? ' fav' : '') + '">' + (it.mine ? 'Your team · ' : '') + esc(dayWord(it.day || today())) + '</span>';
    var nextBtn = total > 1 ? '<button class="gdk-next" onclick="event.stopPropagation();gdkNext()" aria-label="Next game, ' + pos + ' of ' + total + '">' + pos + ' OF ' + total + UP + '</button>' : '';
    var mid;
    if (scored) {
      var aLo = Number(g.awayScore) < Number(g.homeScore), hLo = Number(g.homeScore) < Number(g.awayScore);
      var big = String(g.awayScore).length > 2 || String(g.homeScore).length > 2;
      mid = '<span class="gdk-sc' + (big ? ' big3' : '') + '"><span class="' + (ph === 'post' && aLo ? 'dim' : '') + '">' + esc(g.awayScore) + '</span><i>–</i><span class="' + (ph === 'post' && hLo ? 'dim' : '') + '">' + esc(g.homeScore) + '</span></span>';
    } else {
      var m = String(st).match(/^(\d{1,2}:\d{2})\s*(AM|PM)?$/i);
      mid = '<span class="gdk-when"><small>AT</small><span>' + (m ? esc(m[1]) + (m[2] ? '<em>' + esc(m[2].toUpperCase()) + '</em>' : '') : '<span style="font-size:24px;line-height:30px">' + esc(st) + '</span>') + '</span></span>';
    }
    var tm = function (L, mineN, r) { return '<span class="gdk-tm' + (r ? ' r' : '') + '"><b>' + esc(L.abbr) + '</b><small class="' + (mineN ? 'fav' : '') + '">' + (mineN ? '★ ' : '') + esc(L.name) + '</small></span>'; };
    var so = stateOf(it), per = perHtml(it), wp = wpHtml(it);
    var fx = so.facts.length ? '<div class="gdk-fx">' + so.facts.map(function (f) { return '<span class="' + (f[1] ? 'gold' : '') + '">' + esc(f[0]) + '</span>'; }).join('') + '</div>' : '';
    var inner = per + (per && wp ? '<div class="gdk-rule"></div>' : '') + wp + fx;
    return '<div class="gdk-top">' + cap + nextBtn + '</div>' +
      '<div class="gdk-board">' + tm(it.la, it.ma) + mid + tm(it.lh, it.mh, true) + '</div>' +
      (inner ? '<div class="gdk-pn">' + inner + '</div>' : '') +
      (so.last ? '<div class="gdk-last">' + esc(so.last) + '</div>' : '');
  }

  // ── the pile ──
  function glow(it) {
    try { if (window.gdkArt) gdkArt.game(artEl, S.sport, it ? it.la.c : null, it ? it.lh.c : null, it ? it.day : null); } catch (e) { console.error('[gdk] art', e); }
    var a = glowEl.children[0], b = glowEl.children[1];
    a.style.backgroundColor = it ? css(it.la.c) : 'transparent';
    b.style.backgroundColor = it ? css(it.lh.c) : 'transparent';
  }
  function renderDeck(how) {
    var N = S.order.length;
    stageEl.style.display = N ? '' : 'none';
    if (!N) { deckEl.innerHTML = ''; S.sig.deck = ''; glow(null); return; }
    var front = S.items[S.order[0]], next = N > 1 ? S.items[S.order[1]] : null;
    var html = '';
    if (N > 2) html += '<div class="gdk-pk p1" style="background:' + cardBg(S.items[S.order[2]]) + '"></div>';
    if (N > 3) html += '<div class="gdk-pk p2" style="background:' + cardBg(S.items[S.order[3]]) + '"></div>';
    if (next) html += '<div class="gdk-card behind" aria-hidden="true" style="background:' + cardBg(next) + '">' + cardHtml(next, 2, N) + '</div>';
    html += '<div class="gdk-card front' + (how === 'in' ? ' in' : '') + '" role="button" tabindex="0" data-id="' + esc(front.id) + '" aria-label="' + esc(front.g.away + ' at ' + front.g.home + ', open the game') + '" style="background:' + cardBg(front) + '">' + cardHtml(front, 1, N) + '</div>';
    deckEl.classList.toggle('has-peek', N > 2);
    if (S.sig.deck !== html) { S.sig.deck = html; deckEl.innerHTML = html; }
    glow(front);
    glanceLoad(front);
  }
  function frontEl() { return deckEl.querySelector('.gdk-card.front'); }
  function markTop() {
    var id = S.order[0];
    Array.prototype.forEach.call(listEl.querySelectorAll('.gdk-row'), function (r) { var on = r.dataset.id === id; r.classList.toggle('top', on); r.setAttribute('aria-current', on); });
    listEl.classList.toggle('has-top', !!id);
  }
  window.gdkNext = function () {
    if (S.order.length < 2 || Date.now() < S.busy) return;
    var f = frontEl(), b = deckEl.querySelector('.gdk-card.behind');
    S.busy = Date.now() + 400;
    if (f) { f.classList.remove('settle', 'in'); f.style.transform = ''; f.classList.add('out'); }
    if (b) b.classList.add('fwd');
    glow(S.items[S.order[1]]);
    setTimeout(function () { S.order.push(S.order.shift()); S.busy = 0; renderDeck(); markTop(); }, 390);
  };
  window.gdkPrev = function () {
    if (S.order.length < 2 || Date.now() < S.busy) return;
    S.order.unshift(S.order.pop());
    renderDeck('in'); markTop();
  };
  function openItem(it) {
    if (!it || typeof openGameScreen !== 'function') return;
    openGameScreen(it.g.gamePk, it.g.away, it.g.home, it.sport, it.day || today());
  }
  // a row in the list: bring its game to the top of the pile; the row already on top opens the game
  window.gdkRow = function (id) {
    if (!S.items[id] || S.order[0] === id) { gdkOpen(id); return; }
    if (Date.now() < S.busy) return;
    S.order = [id].concat(S.order.filter(function (x) { return x !== id; }));
    renderDeck('in'); markTop();
    try { var r = stageEl.getBoundingClientRect(); if (r.top < 60 || r.top > window.innerHeight * 0.6) stageEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  };
  window.gdkOpen = function (id) { openItem(S.all.filter(function (it) { return it.id === id; })[0]); };

  // drag the top card: up for the next game, down for the last one, a tap opens it
  deckEl.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest('.gdk-next')) return;
    if (Date.now() < S.busy || !frontEl()) return;
    S.drag = { y: e.clientY, x: e.clientX, dy: 0, moved: false, id: e.pointerId };
  });
  deckEl.addEventListener('pointermove', function (e) {
    var d = S.drag; if (!d || d.id !== e.pointerId) return;
    d.dy = e.clientY - d.y;
    if (!d.moved && Math.abs(d.dy) < 7 && Math.abs(e.clientX - d.x) < 7) return;
    d.moved = true;
    var f = frontEl(); if (!f) return;
    f.classList.remove('settle', 'in');
    f.style.transform = 'translateY(' + d.dy + 'px) rotate(' + (d.dy * 0.02) + 'deg)';
    var b = deckEl.querySelector('.gdk-card.behind');
    if (b) b.classList.toggle('fwd', d.dy < -8);
  });
  function dragEnd(e, cancelled) {
    var d = S.drag; if (!d || (e && e.pointerId != null && d.id !== e.pointerId)) return;
    S.drag = null;
    var f = frontEl();
    if (!d.moved) { if (!cancelled && f && e && e.type === 'pointerup') openItem(S.items[f.dataset.id]); return; }
    if (!cancelled && d.dy < -50 && S.order.length > 1) { window.gdkNext(); return; }
    if (f) { f.classList.add('settle'); f.style.transform = ''; }
    var b = deckEl.querySelector('.gdk-card.behind');
    if (b) b.classList.remove('fwd');
    if (!cancelled && d.dy > 50 && S.order.length > 1) window.gdkPrev();
  }
  deckEl.addEventListener('pointerup', function (e) { dragEnd(e, false); });
  deckEl.addEventListener('pointercancel', function (e) { dragEnd(e, true); });
  deckEl.addEventListener('pointerleave', function (e) { if (S.drag && S.drag.moved) dragEnd(e, false); });
  deckEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { var f = frontEl(); if (f && e.target === f) { e.preventDefault(); openItem(S.items[f.dataset.id]); } }
  });

  // fouls, timeouts, the run and the last play for the basketball card on top
  function glanceLoad(it) {
    if (!it || it.ph !== 'live' || !BK[it.sport] || !window.fetch) return;
    if (S.glanceAt[it.id] && Date.now() - S.glanceAt[it.id] < 10000) return;
    S.glanceAt[it.id] = Date.now();
    fetch('/api/espn?league=' + it.sport + '&mode=glance&ids=' + encodeURIComponent(it.g.gamePk))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var gl = d && d.games && d.games[String(it.g.gamePk)];
        if (!gl) return;
        S.glance[it.id] = gl;
        if (S.order[0] === it.id && Date.now() >= S.busy && !S.drag) renderDeck();
      }).catch(function () {});
  }

  // ── every game ──
  function rowHtml(it, top) {
    var g = it.g, scored = it.ph !== 'pre' && g.awayScore != null && g.homeScore != null, st = statusOf(it.sport, g, it.ph);
    var aLo = scored && it.ph === 'post' && Number(g.awayScore) < Number(g.homeScore), hLo = scored && it.ph === 'post' && Number(g.homeScore) < Number(g.awayScore);
    var m = scored
      ? '<span class="' + (aLo ? 'lo' : '') + '">' + esc(it.la.abbr) + ' ' + esc(g.awayScore) + '</span><i>·</i><span class="' + (hLo ? 'lo' : '') + '">' + esc(it.lh.abbr) + ' ' + esc(g.homeScore) + '</span>'
      : esc(it.la.abbr) + '<i>@</i>' + esc(it.lh.abbr);
    var right = (it.mine && it.ph !== 'live' ? '★ ' : '') + st;
    return '<button class="gdk-row' + (it.id === top ? ' top' : '') + '" data-id="' + esc(it.id) + '" onclick="gdkRow(this.dataset.id)" aria-current="' + (it.id === top) + '" style="background:' + rowBg(it) + '" aria-label="' + esc(g.away + ' at ' + g.home + ', ' + st + (it.id === top ? ', on top of the stack, open the game' : ', bring to the top of the stack')) + '">' +
      '<span class="m">' + m + '</span><span class="s' + (it.ph === 'live' ? ' live' : it.mine ? ' fav' : '') + '">' + esc(right) + '</span></button>';
  }
  function renderList() {
    var s = league(S.sport), k = S.sport, fb = !!FB[k], all = S.all.slice();
    if (!all.length) {
      var ph = '';
      var phOff = false;
      try { var p = typeof _gsPhaseState === 'function' ? _gsPhaseState().by[k] : null; ph = (p && p.label) || ''; phOff = !!(p && p.phase === 'off'); } catch (e) {}
      var o = S.off[k] || 0;
      var when = fb ? (atNow(k) ? 'this week' : 'that week') : o === 0 ? 'today' : o === -1 ? 'yesterday' : o === 1 ? 'tomorrow' : 'on ' + dayWord(dayOf(k), true);
      var off = k === 'mlb' && (phOff || /off/i.test(ph));
      var html0 = '<div class="gdk-empty" style="margin:0">' + (loaded(k)
        ? '<b>No ' + esc(s ? label(s) : '') + ' games ' + esc(when) + '</b><small>' + (ph ? esc(ph) + '. ' : '') + 'Use the arrows above to look at another ' + (fb ? 'week' : 'day') + '.</small>' +
          ''
        : '<small>Loading games…</small>') + '</div>';
      // v7.102.0: no baseball for a while, so its page is the offseason one — player search, compare and the Hot Stove
      if (off && loaded(k) && typeof hsDeck === 'function') html0 = '<div id="gdk-hs"></div>';
      if (S.sig.list !== html0) { S.sig.list = html0; listEl.innerHTML = html0; }
      if (off && document.getElementById('gdk-hs')) { try { hsDeck(); } catch (e) { console.error('[games-deck] offseason:', e); } }
      return;
    }
    var top = S.order[0], html;
    if (fb) {
      // the week, a day at a time
      all.sort(function (a, b) { return (a.day < b.day ? -1 : a.day > b.day ? 1 : 0) || (a.t - b.t); });
      var CAPW = 40, showW = S.more || all.length <= CAPW + 4 ? all : all.slice(0, CAPW), last = null;
      html = showW.map(function (it) {
        var hd = it.day !== last ? '<div class="gdk-lh' + (last ? ' gap' : '') + '"><span>' + esc(dayWord(it.day)) + '</span></div>' : '';
        last = it.day;
        return hd + rowHtml(it, top);
      }).join('') + (showW.length < all.length ? '<button class="gdk-more" onclick="gdkMore()">Show all ' + all.length + ' games</button>' : '');
    } else {
      all.sort(listRank);
      var CAP = 14, show = S.more || all.length <= CAP + 2 ? all : all.slice(0, CAP);
      html = '<div class="gdk-lh"><span>All ' + all.length + (all.length === 1 ? ' game' : ' games') + '</span></div>' + show.map(function (it) { return rowHtml(it, top); }).join('') +
        (show.length < all.length ? '<button class="gdk-more" onclick="gdkMore()">Show all ' + all.length + ' games</button>' : '');
    }
    if (S.sig.list !== html) { S.sig.list = html; listEl.innerHTML = html; }
    listEl.classList.toggle('has-top', !!top);
  }
  window.gdkMore = function () { S.more = true; renderList(); };

  // ── everything ──
  function render() {
    if (!active()) return;
    if (Date.now() < S.busy || S.drag) { clearTimeout(S.later); S.later = setTimeout(render, 450); return; }
    var c = counts();
    S.sport = pickDefault(c);
    if (hasData()) S.auto = true; // the league it opened on stays put while the page is up
    S.all = build(S.sport);
    ensure(S.sport);
    var items = {}, ids = [];
    S.all.filter(inStack).sort(stackRank).forEach(function (it) { items[it.id] = it; ids.push(it.id); });
    // keep the pile where you left it; a game that just went live joins at the front
    var keep = S.order.filter(function (id) { return items[id]; });
    var fresh = ids.filter(function (id) { return keep.indexOf(id) === -1; });
    S.order = keep.length ? fresh.filter(function (id) { return items[id].ph === 'live'; }).concat(keep, fresh.filter(function (id) { return items[id].ph !== 'live'; })) : ids;
    if (keep.length && fresh.length && items[keep[0]]) { // …but never out from under the card you're looking at
      S.order = [keep[0]].concat(S.order.filter(function (id) { return id !== keep[0]; }));
    }
    S.items = items;
    try { if (window.gdkArt) { gdkArt.show(artEl, S.sport); root.classList.toggle('art', gdkArt.has(S.sport)); } } catch (e) { console.error('[gdk] art', e); }
    renderRail(c); renderHead(c); renderDeck(); renderList();
  }
  window.gdkPick = function (key) {
    var s = league(key); if (!s) return;
    if (!inPage(s)) { if (typeof pickGamesSport === 'function') pickGamesSport(key); return; }
    // tapping the league you're on brings it back to today (or this week)
    if (key === S.sport && S.picked && atNow(key)) return;
    delete S.wk[key]; delete S.off[key];
    S.sport = key; S.picked = true; S.order = []; S.more = false;
    try { localStorage.setItem(KEY + '_lg', key); } catch (e) {}
    render(); railReveal();
  };
  // v7.96.0: only baseball's offseason page (player search, compare, Hot Stove) is still opened from here
  window.gdkLeague = function (key) { if (typeof pickGamesSport === 'function') pickGamesSport(key); };
  // …and the Games tab always lands on this page, never on a league's old schedule
  if (typeof window.glassGames === 'function') {
    window.glassGames = function () {
      if (!window._glGamesOnce && typeof playSportsHub === 'function') { window._glGamesOnce = true; playSportsHub(); return; }
      window._glGamesOnce = true;
      nav('games-picker');
    };
  }
  window.gdkRender = render;

  function load(force) {
    var p;
    try { p = typeof _mvLoad === 'function' ? _mvLoad(!!force) : null; } catch (e) { p = null; }
    return Promise.all([p || Promise.resolve(), loadPrefs()]).then(render, render);
  }
  // the page opens (and its season lines or live counts are redrawn): draw ours too
  ['renderGamesSportGrid', '_gsPhasePaint'].forEach(function (name) {
    var orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      var r = orig.apply(this, arguments);
      try { if (name === 'renderGamesSportGrid') { S.auto = false; S.more = false; S.prefsAt = 0; render(); load(false).then(railReveal); } else render(); } catch (e) { console.error('[games deck]', e); }
      return r;
    };
  });
  setInterval(function () { if (!document.hidden && active()) load(false); }, 15000);
  if (active()) load(false);
})();
