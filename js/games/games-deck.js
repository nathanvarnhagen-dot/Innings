// ══ GAMES · THE LEAGUE RAIL AND THE STACK (v7.95.0) ═════════════════════
// The Games page, redrawn:
//   · no title bar. A rail of leagues runs along the top (emoji over the
//     league's name, a count while games are live). Multi view sits first.
//     Tapping a league shows it right here instead of leaving the page.
//   · under it, the league's line — name, date, how many are live, where the
//     season stands — with "?" (how this page works) and "Full schedule",
//     which opens the league's own page exactly as its tile used to.
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
  root.innerHTML = '<div id="gdk-rail" role="tablist" aria-label="Leagues"></div><div id="gdk-head"></div>' +
    '<div id="gdk-stage"><div id="gdk-glow" aria-hidden="true"><i></i><i></i></div><div id="gdk-deck"></div></div><div id="gdk-list"></div>';
  sc.insertBefore(root, sc.firstChild);
  var railEl = root.children[0], headEl = root.children[1], stageEl = root.children[2], listEl = root.children[3];
  var glowEl = stageEl.children[0], deckEl = stageEl.children[1];

  var S = { sport: null, picked: false, auto: false, order: [], items: {}, all: [], prefs: {}, prefsAt: 0, glance: {}, glanceAt: {}, more: false, busy: 0, sig: {}, drag: null };
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
  function build(sport) {
    var out = [];
    allGames().forEach(function (x) {
      var g = x.g;
      if (x.sport !== sport || !g || g.gamePk == null || !g.away || !g.home) return;
      var ph = phase(sport, g), ma = mine(sport, g.away), mh = mine(sport, g.home);
      out.push({ id: sport + ':' + g.gamePk, sport: sport, g: g, ph: ph, ma: ma, mh: mh, mine: Math.max(ma, mh),
        la: look(sport, g, 'a'), lh: look(sport, g, 'h'), t: Date.parse(g.startTime || '') || 0 });
    });
    return out;
  }
  // what goes in the pile: live games, and your teams' games whatever their state
  function inStack(it) {
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
    var w = function (s) { return c.live[s.key] ? 0 : c.day[s.key] ? 1 : 2; };
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
  function renderHead(c) {
    var s = league(S.sport); if (!s) { headEl.innerHTML = ''; return; }
    var d = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
    var n = c.live[s.key] || 0, day = c.day[s.key] || 0, ph = '';
    try { var p = typeof _gsPhaseState === 'function' ? _gsPhaseState().by[s.key] : null; ph = (p && p.label) || ''; } catch (e) {}
    var word = new Date().getHours() >= 17 ? 'tonight' : 'today';
    var sub = esc(d) + (n ? ' · <b>' + n + ' live</b>' : '') + (day ? ' · ' + day + ' ' + word : '');
    var html = '<div class="tx"><span class="nm' + (s.name.length > 6 ? ' long' : '') + '">' + esc(s.name) + '</span><span class="sub">' + sub + '</span>' + (ph ? '<span class="ph">' + esc(ph) + '</span>' : '') + '</div>' +
      '<div class="bt">' + (typeof window.hiwPlay === 'function' ? '<button class="gdk-q" onclick="hiwPlay(\'games\')" aria-label="How Games works"><span>?</span></button>' : '') +
      '<button class="gdk-all" data-lg="' + esc(s.key) + '" onclick="gdkLeague(this.dataset.lg)" aria-label="' + esc(s.name + ' full schedule') + '">Full schedule ›</button></div>';
    if (S.sig.head === html) return;
    S.sig.head = html;
    headEl.innerHTML = html;
  }

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
      : '<span class="gdk-st' + (it.mine ? ' fav' : '') + '">' + (it.mine ? 'Your team · ' : '') + (new Date().getHours() >= 17 ? 'Tonight' : 'Today') + '</span>';
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
    Array.prototype.forEach.call(listEl.querySelectorAll('.gdk-row'), function (r) { r.classList.toggle('top', r.dataset.id === id); });
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
    var day = typeof _todayLocal === 'function' ? _todayLocal() : null;
    openGameScreen(it.g.gamePk, it.g.away, it.g.home, it.sport, day);
  }
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
  function renderList() {
    var s = league(S.sport), all = S.all.slice().sort(listRank);
    if (!all.length) {
      var ph = '';
      try { var p = typeof _gsPhaseState === 'function' ? _gsPhaseState().by[S.sport] : null; ph = (p && p.label) || ''; } catch (e) {}
      var html0 = '<div class="gdk-empty" style="margin:0">' + (hasData()
        ? '<b>No ' + esc(s ? label(s) : '') + ' games today</b><small>' + (ph ? esc(ph) + '. ' : '') + 'The full schedule has every other day, the standings and your teams.</small>' +
          '<button data-lg="' + esc(S.sport) + '" onclick="gdkLeague(this.dataset.lg)">Open ' + esc(s ? label(s) : 'league') + '</button>'
        : '<small>Loading games…</small>') + '</div>';
      if (S.sig.list !== html0) { S.sig.list = html0; listEl.innerHTML = html0; }
      return;
    }
    var CAP = 14, show = S.more || all.length <= CAP + 2 ? all : all.slice(0, CAP);
    var top = S.order[0];
    var html = '<div class="gdk-lh"><span>All ' + all.length + (all.length === 1 ? ' game' : ' games') + '</span></div>' + show.map(function (it) {
      var g = it.g, scored = it.ph !== 'pre' && g.awayScore != null && g.homeScore != null, st = statusOf(it.sport, g, it.ph);
      var aLo = scored && it.ph === 'post' && Number(g.awayScore) < Number(g.homeScore), hLo = scored && it.ph === 'post' && Number(g.homeScore) < Number(g.awayScore);
      var m = scored
        ? '<span class="' + (aLo ? 'lo' : '') + '">' + esc(it.la.abbr) + ' ' + esc(g.awayScore) + '</span><i>·</i><span class="' + (hLo ? 'lo' : '') + '">' + esc(it.lh.abbr) + ' ' + esc(g.homeScore) + '</span>'
        : esc(it.la.abbr) + '<i>@</i>' + esc(it.lh.abbr);
      var right = (it.mine && it.ph !== 'live' ? '★ ' : '') + st;
      return '<button class="gdk-row' + (it.id === top ? ' top' : '') + '" data-id="' + esc(it.id) + '" onclick="gdkOpen(this.dataset.id)" style="background:' + rowBg(it) + '" aria-label="' + esc(g.away + ' at ' + g.home + ', ' + st) + '">' +
        '<span class="m">' + m + '</span><span class="s' + (it.ph === 'live' ? ' live' : it.mine ? ' fav' : '') + '">' + esc(right) + '</span></button>';
    }).join('') + (show.length < all.length ? '<button class="gdk-more" onclick="gdkMore()">Show all ' + all.length + ' games</button>' : '');
    if (S.sig.list !== html) { S.sig.list = html; listEl.innerHTML = html; }
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
    renderRail(c); renderHead(c); renderDeck(); renderList();
  }
  window.gdkPick = function (key) {
    var s = league(key); if (!s) return;
    if (!inPage(s)) { if (typeof pickGamesSport === 'function') pickGamesSport(key); return; }
    if (key === S.sport && S.picked) return;
    S.sport = key; S.picked = true; S.order = []; S.more = false;
    try { localStorage.setItem(KEY + '_lg', key); } catch (e) {}
    render(); railReveal();
  };
  // the league's own page: its schedule by day, standings, teams — as its tile always opened
  window.gdkLeague = function (key) { if (typeof pickGamesSport === 'function') pickGamesSport(key); };
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
      try { if (name === 'renderGamesSportGrid') { S.auto = false; S.more = false; render(); load(false).then(railReveal); } else render(); } catch (e) { console.error('[games deck]', e); }
      return r;
    };
  });
  setInterval(function () { if (!document.hidden && active()) load(false); }, 15000);
  if (active()) load(false);
})();
