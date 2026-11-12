// ══ HOME · THE STACK (v7.93.0) ═════════════════════════════════════════
// Home's games are a pile of cards in team colors. The top card is the game
// that matters most to you right now, shown in full; the three behind it
// peek out with their score and clock.
//   · swipe UP on the pile: the top card lifts, folds to a strip and slips
//     in at the back; the next game comes forward. Swipe DOWN goes back.
//   · tap the top card to open the game; tap a card behind to bring it up.
//   · the order: your favorite teams, games you or a friend are in, teams
//     you follow, playoff games, then every other live game. On a day with
//     none of those it's the day's games by start time.
//   · "+ Follow" sits under any team you don't follow, and an "Add a team"
//     card waits at the back of the pile until your first swipe.
//   · tap "Tonight" for a drop-down: Yesterday / Tomorrow and a calendar (v7.97.0).
//   · "Guide" beside Add opens the TV guide: every game by channel (v7.98.0). Upcoming cards show the start
//     time and the network (js: g.network, sent by the schedule endpoints).
//
// Nothing was removed: the tiles this replaces (the friends' game, the live
// list, Tonight, Last night, Coming up) are still built by glass.js and are
// only hidden while the Stack is on. Multi view's board and On this day keep
// their tiles. Last night's recaps and your plans are rows under the pile.
//
// Turning it off: Profile › Home › Tiles (saved on this device), or open the
// app with ?home=tiles. ?home=stack turns it back on.

(function () {
  if (!window.INNINGS_GLASS) return;
  var KEY = 'innings_home';
  function wanted() {
    try {
      var q = new URLSearchParams(location.search).get('home');
      if (q === 'stack' || q === 'tiles') localStorage.setItem(KEY, q);
      return localStorage.getItem(KEY) !== 'tiles';
    } catch (e) { return true; }
  }
  var ON = wanted();
  window.stkSetHome = function (mode) {
    if ((mode === 'stack') === ON) return;
    try { localStorage.setItem(KEY, mode); } catch (e) {}
    try { var u = new URL(location.href); u.searchParams.set('home', mode); location.replace(u.toString()); }
    catch (e) { location.reload(); }
  };
  // Profile › Home (shows either way, so you can always flip back)
  try {
    var rows = document.getElementById('gl-prows');
    if (rows && !document.getElementById('stk-prow')) {
      rows.insertAdjacentHTML('beforeend', '<div class="gl-prow" id="stk-prow" style="cursor:default"><span class="ic">' + GL_ICON.home + '</span>' +
        '<span class="tx"><b>Home</b><small>' + (ON ? 'Your games as a pile of cards.' : 'The tiles. The pile is one tap away.') + '</small></span>' +
        '<span class="gl-seg2" role="group" aria-label="Home layout"><button class="' + (ON ? 'on' : '') + '" aria-pressed="' + ON + '" onclick="stkSetHome(\'stack\')">Stack</button>' +
        '<button class="' + (ON ? '' : 'on') + '" aria-pressed="' + !ON + '" onclick="stkSetHome(\'tiles\')">Tiles</button></span></div>');
    }
  } catch (e) { console.error('[stack] profile row', e); }
  if (!ON) return;

  var bento = document.querySelector('#gl-home-body .gl-bento');
  if (!bento) return;
  document.documentElement.classList.add('stk-on');
  var wrap = document.createElement('div');
  wrap.className = 'gl-c2'; wrap.id = 'stk-wrap';
  wrap.innerHTML = '<div id="stk-head"></div><div id="stk-deck"></div><div id="stk-rows"></div>';
  var multi = document.getElementById('gl-multi');
  if (multi && multi.nextSibling) bento.insertBefore(wrap, multi.nextSibling); else bento.insertBefore(wrap, bento.firstChild);
  var head = wrap.children[0], deck = wrap.children[1], rowsEl = wrap.children[2];

  var esc = _glEsc;
  var S = { day: 0, open: false, order: [], items: {}, els: {}, touched: false, anim: null, busy: 0, swiped: 0,
    prefs: {}, prefsAt: 0, prefsReady: false, prefsDirty: false, cache: {}, loaded: {}, sig: '' };
  var MAX = 24, PEEK = 54, FRONT = 316, STRIP = 120;
  // v7.94.1: the pile sits in from the edges, leaving a gutter on each side to scroll Home with
  var SIDE = 14;
  var EASE = 'cubic-bezier(.22,1,.36,1)';
  var T_MOVE = 'top .32s ' + EASE + ',left .32s ' + EASE + ',right .32s ' + EASE + ',height .32s ' + EASE + ',opacity .26s ease,box-shadow .26s ease';
  var T_LIFT = 'top .15s cubic-bezier(.3,.7,.3,1),left .15s ease,right .15s ease,height .15s cubic-bezier(.3,.7,.3,1),opacity .12s ease,box-shadow .12s ease';
  var T_TUCK = 'top .24s ' + EASE + ',left .24s ' + EASE + ',right .24s ' + EASE + ',opacity .24s ease,box-shadow .2s ease';
  var IC = {
    down: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>',
    plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="6" x2="12" y2="18"/><line x1="6" y1="12" x2="18" y2="12"/></svg>',
    tv: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2.5"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    star: '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l2.8 5.9 6.2.8-4.6 4.3 1.2 6.3L12 17.3 6.4 20.3l1.2-6.3L3 9.7l6.2-.8z"/></svg>',
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>'
  };

  // ── dates ──
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dateFor(off) { var d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  // v7.97.0: any day can be picked from the calendar, so past ±1 a day is named by its weekday (this week) or its date
  function dayWord(off) {
    if (off === 0) return new Date().getHours() >= 17 ? 'Tonight' : 'Today';
    if (off === -1) return 'Yesterday';
    if (off === 1) return 'Tomorrow';
    var d = new Date(); d.setDate(d.getDate() + off);
    if (off > 1 && off < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
  }
  function relWord(off) { return off >= -1 && off <= 1 ? dayWord(off).toLowerCase() : dayWord(off); }
  function shortDate(off) { var d = new Date(); d.setDate(d.getDate() + off); return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }

  // ── colors: a card is its team's color, deep enough for white type ──
  function rgb(c) {
    c = String(c || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(c)) c = c.replace(/./g, '$&$&');
    if (!/^[0-9a-f]{6}$/i.test(c)) return null;
    return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
  }
  function mix(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }
  function lum(c) { var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
  function css(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function cardBg(hex) {
    var c = rgb(hex) || [61, 53, 128];
    for (var i = 0; i < 8 && lum(c) > 0.13; i++) c = mix(c, [0, 0, 0], 0.16);
    if (lum(c) < 0.012) c = mix(c, [120, 110, 190], 0.16); // a black team still reads as a card
    return 'linear-gradient(165deg,' + css(mix(c, [255, 255, 255], 0.1)) + ' 0%,' + css(mix(c, [0, 0, 0], 0.22)) + ' 55%,' + css(mix(c, [11, 8, 32], 0.74)) + ' 100%)';
  }

  // ── your teams (favorite, following, rivals) for every league ──
  function user() { return window.currentUser || (window.auth && window.auth.currentUser) || null; }
  function loadPrefs(force) {
    var u = user();
    if (!u || !window.db || typeof GAMES_SPORTS === 'undefined') { S.prefsReady = true; return Promise.resolve(); }
    if (!force && S.prefsAt && Date.now() - S.prefsAt < 60000) return Promise.resolve();
    S.prefsAt = Date.now();
    return Promise.all(GAMES_SPORTS.map(function (s) {
      return window.db.collection('users').doc(u.uid).collection('teamPrefs').doc(s.key).get()
        .then(function (doc) { var d = doc.exists ? doc.data() : {}; S.prefs[s.key] = { favorite: d.favorite || null, following: d.following || [], rivals: d.rivals || [] }; })
        .catch(function (e) { console.error('[stack] team prefs', s.key, e); });
    })).then(function () { S.prefsReady = true; S.prefsDirty = false; });
  }
  function tag(sport, team) {
    var p = S.prefs[sport] || {};
    if (p.favorite === team) return 'fav';
    if ((p.rivals || []).indexOf(team) !== -1) return 'rival';
    if ((p.following || []).indexOf(team) !== -1) return 'fol';
    return '';
  }

  // ── the day's games, ranked ──
  function rank(res, off) {
    var top = [], rest = [];
    (res || []).forEach(function (x) {
      (x.games || []).forEach(function (g) {
        if (!g || g.gamePk == null || !g.away || !g.home) return;
        var ta = tag(x.sport, g.away), th = tag(x.sport, g.home);
        var fav = ta === 'fav' || th === 'fav', fol = ta === 'fol' || th === 'fol';
        var fw = off === 0 ? _glFriendsOn(g.gamePk) : { names: [], mine: false };
        var ph = _glPhase(x.sport, g), po = _glIsPost(x.sport, g);
        var worthy = typeof _cbbWorthy !== 'function' || _cbbWorthy(x.sport, g);
        var tier = fav ? 0 : (fw.names.length || fw.mine) ? 1 : fol ? 2 : (po && worthy) ? 3 : (off === 0 && ph === 'live' && worthy) ? 4 : 9;
        var it = { id: x.sport + ':' + g.gamePk, sport: x.sport, g: g, ph: ph, ta: ta, th: th, fw: fw, tier: tier, worthy: worthy, t: Date.parse(g.startTime || '') || 0 };
        (tier < 9 ? top : rest).push(it);
      });
    });
    // none of your teams, no friends, no playoffs, nothing live: the day's games
    if (!top.length) top = rest.filter(function (it) { return it.worthy; });
    var phR = { live: 0, pre: 1, post: 2 };
    top.sort(function (a, b) { return (a.tier - b.tier) || (phR[a.ph] - phR[b.ph]) || (b.fw.names.length - a.fw.names.length) || (a.t - b.t); });
    return top.slice(0, MAX);
  }
  function ingest(res) {
    if (!S.prefsReady) return;
    var list = rank(res, S.day), items = {}, ids = [];
    list.forEach(function (it) { items[it.id] = it; ids.push(it.id); });
    // keep the pile in the order you left it; new games join by rank
    var keep = S.order.filter(function (id) { return items[id]; });
    var order = keep.length ? keep.concat(ids.filter(function (id) { return keep.indexOf(id) === -1; })) : ids;
    S.items = items; S.order = order; S.loaded[S.day] = true;
    render();
  }
  function fetchDay(off) {
    var date = dateFor(off), c = S.cache[date];
    if (c && Date.now() - c.at < 120000) return Promise.resolve(c.res);
    return Promise.all(GAMES_SPORTS.map(function (s) {
      return fetch(_bsModalScheduleUrl(s.key, date))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { return { sport: s.key, games: (d && d.games) || [] }; })
        .catch(function () { return { sport: s.key, games: [] }; });
    })).then(function (res) { S.cache[date] = { at: Date.now(), res: res }; return res; });
  }
  function refresh() {
    var off = S.day;
    if (off === 0) {
      if (window._glSched) ingest(window._glSched);
      else if (typeof _glLoadLive === 'function') _glLoadLive(false);
      return;
    }
    fetchDay(off).then(function (res) { if (S.day === off) ingest(res); });
  }

  // ── one card ──
  function when(it) { return (typeof _formatGameTime === 'function' && _formatGameTime(it.g.startTime)) || ''; }
  function names(n) { return n.length === 1 ? n[0] + ' is' : n.length === 2 ? n[0] + ' and ' + n[1] + ' are' : n[0] + ', ' + n[1] + ' and ' + (n.length === 3 ? n[2] : (n.length - 2) + ' others') + ' are'; }
  function teamHtml(it, side) {
    var g = it.g, nm = side === 'a' ? g.away : g.home, tg = side === 'a' ? it.ta : it.th;
    var t = _glTeam(it.sport, nm, side === 'a' ? g.awayAbbr : g.homeAbbr, side === 'a' ? g.awayColor : g.homeColor, side === 'a' ? g.awayAlt : g.homeAlt);
    var rk = side === 'a' ? g.awayRank : g.homeRank;
    var sub = tg === 'fav' ? '<span class="sub fav">' + IC.star + 'Your team</span>'
      : tg === 'rival' ? '<span class="sub">Rival</span>'
      : tg === 'fol' ? '<span class="sub">Following</span>'
      : '<button class="stk-fol" data-sport="' + esc(it.sport) + '" data-team="' + esc(nm) + '" onclick="event.stopPropagation();stkFollow(this.dataset.sport,this.dataset.team)" aria-label="Follow the ' + esc(_glShort(nm)) + '">+ Follow</button>';
    return '<span class="stk-tm"><span class="stk-d" style="' + _glBadgeStyle(t) + '">' + esc(t.abbr) + '</span><b>' + (rk ? '<i>' + esc(rk) + '</i> ' : '') + esc(_glShort(nm)) + '</b>' + sub + '</span>';
  }
  function cardHtml(it) {
    var g = it.g, sp = it.sport, ph = it.ph, off = _glOff(g);
    var lg = _glLeagueName(sp);
    var scored = ph !== 'pre' && g.awayScore != null && g.homeScore != null;
    var aLo = scored && Number(g.awayScore) < Number(g.homeScore), hLo = scored && Number(g.homeScore) < Number(g.awayScore);
    var tm = when(it), status = _glRowStatus(sp, g, ph);
    var title = _glShort(g.away) + ' at ' + _glShort(g.home);
    // the strip a card shows while it's behind the top one
    var pkSt = ph === 'live' ? status : ph === 'post' ? status : off ? status : (g.network || lg);
    var pkSc = scored ? esc(g.awayScore) + '–' + esc(g.homeScore) : (ph === 'pre' && !off && !_glTbd(g) ? esc(tm.replace(/\s?(AM|PM)$/, '')) : '');
    var peek = '<span class="stk-pk"><span class="nm">' + esc(title) + '</span><span class="st' + (ph === 'live' ? ' live' : '') + '">' + esc(pkSt) + '</span><span class="sc gl-num">' + pkSc + '</span></span>';
    // the full card
    var capL = ph === 'live' ? '<span class="gl-ldot"></span>Live · ' + esc(lg) : ph === 'post' ? 'Final · ' + esc(lg) : (S.day >= -1 && S.day < 7 ? esc(dayWord(S.day)) + ' · ' : '') + esc(lg);
    var capR = ph === 'live' ? esc(status) : ph === 'post' ? (/^final$/i.test(status) ? (S.day !== 0 ? esc(shortDate(S.day)) : '') : esc(status)) : (S.day !== 0 ? esc(shortDate(S.day)) : '');
    var mid;
    if (scored) {
      var big = String(g.awayScore).length > 2 || String(g.homeScore).length > 2;
      mid = '<span class="stk-sc gl-num' + (big ? ' big3' : '') + '"><span class="' + (aLo ? 'dim' : '') + '">' + esc(g.awayScore) + '</span><i></i><span class="' + (hLo ? 'dim' : '') + '">' + esc(g.homeScore) + '</span></span>';
    } else if (off || _glTbd(g) || !tm) {
      mid = '<span class="stk-sc gl-num sm">' + esc(off ? status : _glTbd(g) ? 'TBD' : 'VS') + '</span>';
    } else {
      var m = tm.match(/^(\S+)\s*(AM|PM)?$/) || [0, tm, ''];
      mid = '<span class="stk-sc gl-num">' + esc(m[1]) + '<small>' + esc(m[2] || '') + '</small></span>';
    }
    var extra = '';
    if (ph === 'pre' && g.network) extra = '<span class="stk-chip">' + IC.tv + esc(g.network) + '</span>';
    else if (ph === 'live' && g.sit && g.sit.dd) extra = '<span class="stk-chip">' + esc((g.sit.poss ? g.sit.poss + ' ball · ' : '') + g.sit.dd + (g.sit.spot ? ' at ' + g.sit.spot : '')) + '</span>';
    else if (g.headline && _glIsPost(sp, g)) extra = '<span class="stk-chip">' + esc(String(g.headline).replace(/\s+-\s+/g, ' · ')) + '</span>';
    else if (sp === 'mlb' && typeof _psName === 'function' && g.gameType && /^[FDLW]$/.test(g.gameType)) extra = '<span class="stk-chip">' + esc(_psName(g) + (g.seriesGameNumber ? ' · Game ' + (typeof _psSeq === 'function' ? _psSeq(g) : g.seriesGameNumber) : '')) + '</span>';
    var fn = it.fw.names, label, cta;
    if (ph === 'live') {
      label = fn.length ? names(fn) + ' in the room' : it.fw.mine ? 'You’re watching' : 'No one’s in yet. Start the room.';
      cta = fn.length ? 'Join' : 'Watch';
    } else if (ph === 'post') {
      label = 'See how it happened'; cta = 'Open';
    } else {
      label = fn.length ? names(fn) + ' watching' : it.fw.mine ? 'You’re in for this one' : (g.venue || 'Lineups, matchups and the room');
      cta = 'Open';
    }
    var avs = fn.slice(0, 3).map(function (n) { return '<span class="gl-av">' + esc(_glInitials(n)) + '</span>'; }).join('');
    return peek + '<span class="stk-full">' +
      '<span class="stk-top"><span class="stk-cap' + (ph === 'live' ? ' live' : '') + '">' + capL + '</span><span class="stk-cap r">' + capR + '</span></span>' +
      '<span class="stk-board">' + teamHtml(it, 'a') + mid + teamHtml(it, 'h') + '</span>' +
      (extra ? '<span class="stk-x">' + extra + '</span>' : '') +
      '<span class="stk-ft">' + (avs ? '<span class="gl-avs">' + avs + '</span>' : '') + '<span class="tx">' + esc(label) + '</span><span class="gl-join">' + cta + '</span></span></span>';
  }
  function featured(it) {
    var g = it.g, away = it.ta === 'fav' || (it.ta === 'fol' && it.th !== 'fav');
    var t = away ? _glTeam(it.sport, g.away, g.awayAbbr, g.awayColor, g.awayAlt) : _glTeam(it.sport, g.home, g.homeAbbr, g.homeColor, g.homeAlt);
    return t.bg;
  }

  // ── the label row: Tonight ⌄ · Add ──
  // v7.97.0: tapping the day opens a drop-down — Yesterday / Today / Tomorrow
  // up top, then a two-week calendar (Sun–Sat) with a dot in a team's colors
  // on every day one of your teams plays. ‹ › pages two weeks at a time.
  function renderHead() {
    var w = dayWord(S.day);
    head.innerHTML = '<div class="stk-days"><button class="stk-day cur' + (S.open ? ' open' : '') + '" onclick="stkDays()" aria-label="' + esc(w) + ', change the day" aria-haspopup="dialog" aria-expanded="' + S.open + '">' + esc(w) + IC.down + '</button></div>' +
      '<span class="stk-hr"><button class="stk-gb" onclick="stkGuide()" aria-label="TV guide">' + IC.tv + 'Guide</button><button class="stk-add" onclick="stkAdd()" aria-label="Add a team">Add</button></span>' + (S.open ? popHtml() : '');
    head.classList.toggle('open', !!S.open); wrap.classList.toggle('pop', !!S.open);
    if (S.open) loadDots();
  }
  var DAY = 86400000;
  function mid0(d) { var x = new Date(d); x.setHours(12, 0, 0, 0); return x; }
  function offOf(d) { return Math.round((mid0(d) - mid0(new Date())) / DAY); }
  function weekStart(page) { var d = mid0(new Date()); d.setDate(d.getDate() - d.getDay() + page * 14); return d; }
  function popHtml() {
    var q = [[-1, 'Yesterday'], [0, dayWord(0)], [1, 'Tomorrow']].map(function (d) {
      return '<button class="stk-q' + (d[0] === S.day ? ' on' : '') + '" aria-pressed="' + (d[0] === S.day) + '" onclick="stkDay(' + d[0] + ')">' + d[1] + '</button>';
    }).join('');
    var st = weekStart(S.page || 0), end = new Date(st); end.setDate(end.getDate() + 13);
    var m1 = st.toLocaleDateString(undefined, { month: 'long' }), m2 = end.toLocaleDateString(undefined, { month: 'long' });
    var mon = m1 === m2 ? m1 + ' ' + st.getFullYear() : st.toLocaleDateString(undefined, { month: 'short' }) + ' – ' + end.toLocaleDateString(undefined, { month: 'short' }) + ' ' + end.getFullYear();
    var dow = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (x) { return '<span>' + x + '</span>'; }).join('');
    var cells = '';
    for (var i = 0; i < 14; i++) {
      var d = new Date(st); d.setDate(st.getDate() + i);
      var o = offOf(d), key = dateFor(o);
      var full = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      cells += '<button class="stk-cd' + (o === 0 ? ' now' : '') + (o === S.day ? ' on' : '') + (o < 0 ? ' past' : '') + '" data-date="' + key + '" onclick="stkDay(' + o + ')" aria-label="' + esc(full) + '" aria-pressed="' + (o === S.day) + '">' +
        '<b class="gl-num">' + d.getDate() + '</b><span class="dots">' + dotsHtml(key) + '</span></button>';
    }
    var any = mySports().length, a = S.popAnim; S.popAnim = false;
    return '<div class="stk-pop-shade' + (a ? ' anim' : '') + '"></div>' +
      '<div class="stk-pop' + (a ? ' anim' : '') + '" role="dialog" aria-label="Pick a day">' +
        '<div class="stk-qs">' + q + '</div>' +
        '<div class="stk-cal-hd"><button class="ar" onclick="stkPage(-1)" aria-label="Earlier two weeks">‹</button><b>' + esc(mon) + '</b><button class="ar" onclick="stkPage(1)" aria-label="Next two weeks">›</button></div>' +
        '<div class="stk-dow">' + dow + '</div>' +
        '<div class="stk-cal">' + cells + '</div>' +
        '<div class="stk-cal-ft">' + (any ? '<span class="dot"></span>Your teams play' : 'Follow a team to see its games here') +
          ((S.page || 0) !== 0 || S.day !== 0 ? '<button onclick="stkDay(0)">Back to today</button>' : '') + '</div>' +
      '</div>';
  }

  // the dots: your favorite and followed teams' games on each day showing
  var DOTS = {}, DQ = [], DRUN = 0;
  function mySports() { return GAMES_SPORTS.filter(function (s) { var p = S.prefs[s.key]; return p && (p.favorite || (p.following || []).length); }); }
  function dotsHtml(date) {
    var list = [], seen = {};
    mySports().forEach(function (s) {
      var c = S.cache[date], games = null;
      if (c) c.res.forEach(function (x) { if (x.sport === s.key) games = x.games; });
      if (!games && DOTS[date + '|' + s.key]) games = DOTS[date + '|' + s.key].games;
      (games || []).forEach(function (g) {
        if (!g || !g.away || !g.home) return;
        [['a', g.away, g.awayAbbr, g.awayColor, g.awayAlt], ['h', g.home, g.homeAbbr, g.homeColor, g.homeAlt]].forEach(function (t) {
          var tg = tag(s.key, t[1]);
          if ((tg !== 'fav' && tg !== 'fol') || seen[s.key + t[1]]) return;
          seen[s.key + t[1]] = 1;
          var lk = _glTeam(s.key, t[1], t[2], t[3], t[4]);
          list.push({ fav: tg === 'fav', bg: lk.bg, ab: lk.abbr });
        });
      });
    });
    list.sort(function (a, b) { return (b.fav ? 1 : 0) - (a.fav ? 1 : 0); });
    var h = list.slice(0, 3).map(function (x) { return '<i class="' + (x.fav ? 'fav' : '') + '" style="background:' + x.bg + '" title="' + esc(x.ab) + '"></i>'; }).join('');
    return h + (list.length > 3 ? '<em>+' + (list.length - 3) + '</em>' : '');
  }
  function loadDots() {
    if (!S.prefsReady) return;
    var st = weekStart(S.page || 0), sp = mySports();
    for (var i = 0; i < 14; i++) {
      var d = new Date(st); d.setDate(st.getDate() + i);
      var date = dateFor(offOf(d));
      if (S.cache[date]) continue;
      sp.forEach(function (s) {
        var k = date + '|' + s.key, c = DOTS[k];
        if (c && (c.busy || Date.now() - c.at < 600000)) return;
        DOTS[k] = { busy: true, at: 0, games: c ? c.games : [] };
        DQ.push([date, s.key]);
      });
    }
    pump();
  }
  function pump() {
    while (DRUN < 4 && DQ.length) (function (job) {
      DRUN++;
      fetch(_bsModalScheduleUrl(job[1], job[0]))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { DOTS[job[0] + '|' + job[1]] = { at: Date.now(), games: (d && d.games) || [] }; })
        .catch(function () { DOTS[job[0] + '|' + job[1]] = { at: Date.now() - 540000, games: [] }; })
        .then(function () {
          DRUN--;
          var cell = S.open && head.querySelector('.stk-cd[data-date="' + job[0] + '"] .dots');
          if (cell) cell.innerHTML = dotsHtml(job[0]);
          pump();
        });
    })(DQ.shift());
  }

  // ── the pile ──
  function render() {
    if (Date.now() < S.busy) { clearTimeout(S.later); S.later = setTimeout(render, S.busy - Date.now() + 30); return; }
    renderHead();
    var sig = S.day + '|' + S.order.map(function (id) { return id + JSON.stringify([S.items[id].ph, S.items[id].g.awayScore, S.items[id].g.homeScore, S.items[id].g.statusDetail || S.items[id].g.status, S.items[id].g.inning, S.items[id].g.inningHalf, S.items[id].ta, S.items[id].th, S.items[id].fw.names, S.items[id].fw.mine, S.items[id].g.network, S.items[id].g.sit && S.items[id].g.sit.dd]); }).join('|');
    if (sig === S.sig && deck.firstChild) { layout(); return; }
    S.sig = sig;
    if (!S.order.length) {
      S.els = {};
      deck.style.height = '';
      var w = relWord(S.day);
      deck.innerHTML = '<div class="stk-empty">' + (S.loaded[S.day]
        ? '<b>Nothing on ' + esc(w) + '</b><small>No games for your teams, your friends or anyone else' + (S.day === 0 ? ' right now' : '') + '.</small>' +
          '<span class="bt">' + (S.day < 1 ? '<button onclick="stkDay(1)">See tomorrow</button>' : '<button onclick="stkDays()">Pick a day</button>') + '<button onclick="glassGames()">All leagues</button><button onclick="stkAdd()">Add a team</button></span>'
        : '<small>Loading games…</small>') + '</div>';
      amb(null);
      return;
    }
    var html = '<button class="stk-strip" onclick="stkAdd()" aria-label="Add a team"><span>' + IC.plus + 'Add a team</span></button>';
    html += S.order.map(function (id) {
      var it = S.items[id];
      return '<div class="stk-card" role="button" tabindex="0" data-id="' + esc(id) + '" aria-label="' + esc(it.g.away + ' at ' + it.g.home) + '" style="background:' + cardBg(featured(it)) + '">' + cardHtml(it) + '</div>';
    }).join('');
    deck.innerHTML = html;
    S.els = {};
    Array.prototype.forEach.call(deck.querySelectorAll('.stk-card'), function (el) { S.els[el.dataset.id] = el; });
    S.strip = deck.querySelector('.stk-strip');
    layout(true);
  }
  function amb(it) {
    if (!S.amb) return;
    if (!it) { S.amb(null); return; }
    var g = it.g;
    S.amb([_glTeam(it.sport, g.away, g.awayAbbr, g.awayColor, g.awayAlt).bg, _glTeam(it.sport, g.home, g.homeAbbr, g.homeColor, g.homeAlt).bg]);
  }
  function layout(instant) {
    var N = S.order.length; if (!N) return;
    var vis = Math.min(N - 1, 3), strip = !S.touched, R = strip ? Math.min(vis + 1, 3) : vis;
    var a = S.anim;
    deck.style.height = (R * PEEK + FRONT) + 'px';
    var set = function (el, st, tr, front) {
      el.style.transition = instant ? 'none' : tr;
      el.style.top = st.top + 'px'; el.style.left = st.m + 'px'; el.style.right = st.m + 'px'; el.style.height = st.h + 'px';
      el.style.opacity = st.op; el.style.zIndex = st.z; el.style.pointerEvents = st.op === 0 ? 'none' : '';
      el.classList.toggle('front', !!front); el.classList.toggle('up', !!st.up);
      if (st.op === 0) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden');
    };
    var backM = SIDE + 8 * Math.max(R, 1);
    S.order.forEach(function (id, pos) {
      var el = S.els[id]; if (!el) return;
      var st, tr = T_MOVE, front = pos === 0;
      if (pos === 0) st = { top: R * PEEK, h: FRONT, m: SIDE, op: 1, z: 40 };
      else if (pos <= R && !(strip && pos === R)) st = { top: (R - pos) * PEEK, h: STRIP, m: SIDE + 8 * pos, op: [1, 1, 0.85, 0.7][pos], z: 40 - pos * 10 };
      else st = { top: 0, h: STRIP, m: backM, op: 0, z: 1 };
      if (a && a.id === id) {
        if (a.kind === 'lift') { st = { top: -78, h: STRIP, m: backM - 4, op: 1, z: 50, up: true }; tr = T_LIFT; front = false; }
        else if (a.kind === 'tuck') { st.z = 1; tr = T_TUCK; }
        else if (a.kind === 'rise') { st = { top: -78, h: STRIP, m: backM - 4, op: 1, z: st.op === 0 ? 1 : st.z }; tr = T_LIFT; }
        else if (a.kind === 'land') { st.z = 50; st.up = true; }
      }
      set(el, st, tr, front);
    });
    if (S.strip) {
      var s = S.strip.style;
      s.transition = instant ? 'none' : 'opacity .38s ease,transform .55s ' + EASE + ',top .5s ' + EASE;
      s.left = s.right = (SIDE + 8 * R) + 'px'; s.top = '0px';
      s.opacity = strip ? 1 : 0; s.transform = strip ? 'none' : 'translateY(-16px) scale(.96)'; s.pointerEvents = strip ? '' : 'none';
      if (strip) S.strip.removeAttribute('aria-hidden'); else S.strip.setAttribute('aria-hidden', 'true');
    }
    if (!a) amb(S.items[S.order[0]]);
  }
  // v7.94.2: a flip starts the moment your finger moves, takes about a third
  // of a second, and never blocks the next one — a new swipe cuts the last
  // animation short instead of waiting for it
  function settle() {
    clearTimeout(S.t1); clearTimeout(S.t2);
    if (S.pend) { var p = S.pend; S.pend = null; p(); }
    S.anim = null;
  }
  function next() {
    var N = S.order.length; if (N < 2) return;
    settle();
    S.busy = Date.now() + 400; S.touched = true; deck.classList.add('flip');
    var f = S.order[0];
    S.order = S.order.slice(1).concat(f);
    S.anim = { id: f, kind: 'lift' }; layout();
    S.t1 = setTimeout(function () { S.anim = { id: f, kind: 'tuck' }; layout(); }, 140);
    S.t2 = setTimeout(function () { S.anim = null; deck.classList.remove('flip'); layout(); }, 390);
  }
  function prev() {
    var N = S.order.length; if (N < 2) return;
    settle();
    S.busy = Date.now() + 400; S.touched = true; deck.classList.add('flip');
    var b = S.order[N - 1];
    S.anim = { id: b, kind: 'rise' }; layout();
    S.pend = function () { S.order = [b].concat(S.order.filter(function (id) { return id !== b; })); };
    S.t1 = setTimeout(function () { var p = S.pend; S.pend = null; if (p) p(); S.anim = { id: b, kind: 'land' }; layout(); }, 120);
    S.t2 = setTimeout(function () { S.anim = null; deck.classList.remove('flip'); layout(); }, 390);
  }
  function bring(id) {
    settle();
    var i = S.order.indexOf(id); if (i < 1) return;
    S.busy = Date.now() + 340; S.touched = true;
    S.order = S.order.slice(i).concat(S.order.slice(0, i));
    layout();
  }
  function openGame(id) {
    var it = S.items[id];
    if (it && typeof openGameScreen === 'function') openGameScreen(it.g.gamePk, it.g.away, it.g.home, it.sport, dateFor(S.day));
  }

  // ── touch: up for the next game, down for the last one ──
  var startY = null, startX = null;
  function down(y, x) { startY = y; startX = x; }
  function move(y, x) {
    if (startY == null) return;
    var dy = y - startY, dx = x - startX;
    if (Math.abs(dy) < 16 || Math.abs(dy) < Math.abs(dx)) return;
    startY = null; // one flip per swipe
    S.swiped = Date.now();
    if (dy < 0) next(); else prev();
  }
  function up(y, x) { move(y, x); startY = null; }
  var grab = function (el) { return el.closest(S.anim ? '.stk-card' : '.stk-card.front'); }; // mid-flip, whichever card is under your finger takes the next swipe
  deck.addEventListener('pointerdown', function (e) { if (grab(e.target)) down(e.clientY, e.clientX); });
  deck.addEventListener('pointermove', function (e) { move(e.clientY, e.clientX); });
  deck.addEventListener('pointerup', function (e) { up(e.clientY, e.clientX); });
  deck.addEventListener('pointercancel', function () { startY = null; });
  deck.addEventListener('touchstart', function (e) { var t = e.touches[0]; if (t && grab(e.target)) down(t.clientY, t.clientX); }, { passive: true });
  deck.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) move(t.clientY, t.clientX); }, { passive: true });
  deck.addEventListener('touchend', function (e) { var t = e.changedTouches[0]; if (t) up(t.clientY, t.clientX); }, { passive: true });
  function tap(e) {
    if (Date.now() - S.swiped < 450) return;
    var c = e.target.closest('.stk-card'); if (!c) return;
    if (S.order[0] === c.dataset.id) openGame(c.dataset.id); else bring(c.dataset.id);
  }
  deck.addEventListener('click', tap);
  deck.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { if (e.target.classList && e.target.classList.contains('stk-card')) { e.preventDefault(); tap(e); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); prev(); }
  });

  // ── the day ──
  window.stkDays = function () {
    S.open = !S.open;
    if (S.open) { S.popAnim = true; S.page = Math.floor((S.day + new Date().getDay()) / 14); } // open on the two weeks holding the day you're on
    renderHead();
  };
  window.stkDaysClose = function () { if (!S.open) return; S.open = false; renderHead(); };
  window.stkPage = function (n) { S.page = (S.page || 0) + n; renderHead(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.open) stkDaysClose(); });
  // a tap anywhere outside the drop-down closes it (and only closes it)
  var swallow = false;
  document.addEventListener('pointerdown', function (e) {
    if (!S.open || e.target.closest('.stk-pop') || e.target.closest('.stk-day.cur')) return;
    swallow = true; stkDaysClose();
  }, true);
  document.addEventListener('click', function (e) { if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); } }, true);
  window.stkDay = function (off) {
    S.open = false;
    if (off !== S.day) { clearTimeout(S.t1); clearTimeout(S.t2); S.pend = null; S.day = off; S.order = []; S.items = {}; S.sig = ''; S.anim = null; S.busy = 0; }
    render();
    refresh();
  };

  // ── v7.98.0: the TV guide ──
  // "Guide" beside Add opens a sheet over Home: every game of the day you're
  // on, one row per channel (the channels your teams are on first, then the
  // ones with live games), time running left to right with a red line at now.
  // Every game says its network on it. Tap a game for its card; Open goes in.
  var GD = { open: false, sel: null, drag: null };
  var GPX = 104; // px per hour
  var GDUR = { mlb: 3, nfl: 3.25, cfb: 3.5, nba: 2.4, wnba: 2, cbb: 2, nhl: 2.6, mls: 2, nwsl: 2 };
  function gdRoot() {
    var el = document.getElementById('stk-gd');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'stk-gd';
    el.innerHTML = '<div class="stk-gd-shade" onclick="stkGuideClose()"></div><div class="stk-gd-sheet" role="dialog" aria-modal="true" aria-label="TV guide"><div class="stk-gd-top"><span class="grab"></span><div class="hd"><div><b></b><small></small></div><button class="x" onclick="stkGuideClose()" aria-label="Close the guide"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button></div></div><div class="stk-gd-body"></div><div class="stk-gd-det"></div></div>';
    document.body.appendChild(el);
    // drag the top of the sheet down to close it
    var top = el.querySelector('.stk-gd-top'), sheet = el.querySelector('.stk-gd-sheet');
    var y0 = null, dy = 0;
    var start = function (y) { y0 = y; dy = 0; sheet.style.transition = 'none'; };
    var move = function (y) { if (y0 == null) return; dy = Math.max(0, y - y0); sheet.style.transform = 'translateY(' + dy + 'px)'; };
    var end = function () { if (y0 == null) return; y0 = null; sheet.style.transition = ''; sheet.style.transform = ''; if (dy > 90) stkGuideClose(); };
    top.addEventListener('touchstart', function (e) { var t = e.touches[0]; if (t) start(t.clientY); }, { passive: true });
    top.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) move(t.clientY); }, { passive: true });
    top.addEventListener('touchend', end, { passive: true });
    top.addEventListener('mousedown', function (e) { if (e.target.closest('.x')) return; start(e.clientY); var mm = function (ev) { move(ev.clientY); }, mu = function () { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); end(); }; document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu); });
    return el;
  }
  function gdGames(cb) {
    var date = dateFor(S.day), c = S.cache[date];
    var res = (S.day === 0 && window._glSched) || (c && c.res);
    if (!res) { fetchDay(S.day).then(function () { if (GD.open) cb(); }); return null; }
    var out = [], d0 = new Date(); d0.setDate(d0.getDate() + S.day); d0.setHours(0, 0, 0, 0);
    res.forEach(function (x) {
      (x.games || []).forEach(function (g) {
        if (!g || g.gamePk == null || !g.away || !g.home) return;
        if (typeof _cbbWorthy === 'function' && !_cbbWorthy(x.sport, g)) return;
        var t = Date.parse(g.startTime || ''); if (!t) return;
        var ta = tag(x.sport, g.away), th = tag(x.sport, g.home);
        var nets = String(g.network || '').split(' · ').filter(Boolean);
        out.push({ id: x.sport + ':' + g.gamePk, sport: x.sport, g: g, h: (t - d0) / 3600000, dur: GDUR[x.sport] || 2.5, ph: _glPhase(x.sport, g),
          net: nets[0] || '', nets: nets.join(' · '), mine: ta === 'fav' || th === 'fav' ? 2 : (ta === 'fol' || th === 'fol') ? 1 : 0, ta: ta, th: th });
      });
    });
    return out;
  }
  function gdHour(h) { var x = ((Math.floor(h) % 24) + 24) % 24; return (x % 12 || 12) + (x < 12 ? ' AM' : ' PM'); }
  function gdBlockStatus(it) {
    var g = it.g;
    if (it.ph === 'live') return (g.awayScore != null ? g.awayScore + '–' + g.homeScore + ' · ' : '') + _glRowStatus(it.sport, g, 'live');
    if (it.ph === 'post') return (g.awayScore != null ? g.awayScore + '–' + g.homeScore + ' · ' : '') + 'Final';
    return _glOff(g) ? _glRowStatus(it.sport, g, 'pre') : _glTbd(g) ? 'TBD' : when(it);
  }
  function gdLook(it, side) { var g = it.g; return side === 'a' ? _glTeam(it.sport, g.away, g.awayAbbr, g.awayColor, g.awayAlt) : _glTeam(it.sport, g.home, g.homeAbbr, g.homeColor, g.homeAlt); }
  function renderGuide() {
    var el = gdRoot(), body = el.querySelector('.stk-gd-body');
    var w = dayWord(S.day);
    el.querySelector('.hd b').textContent = 'On TV ' + (S.day === 0 ? (w === 'Tonight' ? 'tonight' : 'today') : relWord(S.day));
    var list = gdGames(renderGuide);
    if (!list) { el.querySelector('.hd small').textContent = 'Loading the day’s games…'; body.innerHTML = '<div class="stk-gd-empty">Loading…</div>'; renderDet(null); return; }
    var nNet = {};
    list.forEach(function (it) { nNet[it.net || '~'] = 1; });
    el.querySelector('.hd small').textContent = list.length ? list.length + ' game' + (list.length === 1 ? '' : 's') + ' on ' + Object.keys(nNet).filter(function (k) { return k !== '~'; }).length + ' channels · your teams’ channels first' : 'No games';
    if (!list.length) { body.innerHTML = '<div class="stk-gd-empty">No games on ' + esc(relWord(S.day)) + '.</div>'; renderDet(null); return; }
    // rows: one per channel
    var rows = {}, keys = [];
    list.forEach(function (it) { var k = it.net || '~'; if (!rows[k]) { rows[k] = []; keys.push(k); } rows[k].push(it); });
    var score = function (k) {
      var r = rows[k], m = Math.max.apply(null, r.map(function (it) { return it.mine; })), lv = r.some(function (it) { return it.ph === 'live'; });
      return k === '~' ? 1e6 : (2 - m) * 1000 + (lv ? 0 : 100) - r.length;
    };
    keys.sort(function (a, b) { return score(a) - score(b) || a.localeCompare(b); });
    // the hours shown
    var lo = Math.floor(Math.min.apply(null, list.map(function (it) { return it.h; })));
    var hi = Math.ceil(Math.max.apply(null, list.map(function (it) { return it.h + it.dur; })));
    if (hi - lo < 4) hi = lo + 4;
    var W = (hi - lo) * GPX;
    var hours = '';
    for (var hh = lo; hh < hi; hh++) hours += '<span style="left:' + ((hh - lo) * GPX + 6) + 'px">' + gdHour(hh) + '</span>';
    var labs = '', lanesHtml = '';
    if (!GD.sel || !list.some(function (it) { return it.id === GD.sel; })) {
      var pick = list.filter(function (it) { return it.mine && it.ph !== 'post'; }).sort(function (a, b) { return (b.mine - a.mine) || (a.h - b.h); })[0];
      GD.sel = pick ? pick.id : null;
    }
    keys.forEach(function (k) {
      var r = rows[k].sort(function (a, b) { return a.h - b.h; }), lanes = [];
      r.forEach(function (it) {
        var x = (it.h - lo) * GPX, wd = Math.max(it.dur * GPX - 4, 96), L = 0;
        while (lanes[L] != null && lanes[L] > x) L++;
        lanes[L] = x + wd + 4; it._x = x; it._w = wd; it._l = L;
      });
      var nL = Math.max(1, lanes.length), H = nL * 64 + 4;
      var my = r.filter(function (it) { return it.mine; })[0];
      var mineName = my ? _glShort(my.ta === 'fav' || my.ta === 'fol' ? my.g.away : my.g.home) : '';
      labs += '<div class="lr' + (my ? ' mine' : '') + '" style="height:' + H + 'px"><b>' + esc(k === '~' ? 'No TV listed' : k) + '</b>' + (mineName ? '<small>' + esc(mineName) + '</small>' : '') + '</div>';
      lanesHtml += '<div class="gr" style="height:' + H + 'px">' + r.map(function (it) {
        var a = gdLook(it, 'a'), h = gdLook(it, 'h');
        return '<button class="blk' + (it.ph === 'live' ? ' live' : '') + (it.ph === 'post' ? ' post' : '') + (it.mine ? ' mine' : '') + (it.id === GD.sel ? ' on' : '') + '" style="left:' + (it._x + 2) + 'px;width:' + it._w + 'px;top:' + (it._l * 64 + 4) + 'px;background:linear-gradient(rgba(12,9,32,.28),rgba(12,9,32,.28)),linear-gradient(100deg,' + a.bg + ',' + h.bg + ')" onclick="stkGuidePick(\'' + esc(it.id) + '\')" aria-label="' + esc(_glShort(it.g.away) + ' at ' + _glShort(it.g.home) + ', ' + gdBlockStatus(it) + ', on ' + (it.nets || 'no TV listed')) + '">' +
          '<b>' + (it.mine === 2 ? IC.star : '') + esc(a.abbr + ' at ' + h.abbr) + '</b>' +
          '<small>' + (it.ph === 'live' ? '<i class="ld"></i>' : '') + esc(gdBlockStatus(it)) + '</small>' +
          '<em>' + IC.tv + esc(it.nets || 'No TV listed') + '</em></button>';
      }).join('') + '</div>';
    });
    var nowX = null;
    if (S.day === 0) { var n = new Date(), nh = n.getHours() + n.getMinutes() / 60; if (nh >= lo && nh <= hi) nowX = (nh - lo) * GPX; }
    var scr = body.querySelector('.scr'), keepL = scr ? scr.scrollLeft : null, keepT = body.scrollTop;
    body.innerHTML = '<div class="gd"><div class="lab"><div class="lh"></div>' + labs + '</div>' +
      '<div class="scr"><div class="cv" style="width:' + W + 'px"><div class="hrs">' + hours + '</div>' + lanesHtml +
      (nowX != null ? '<div class="nowl" style="left:' + nowX + 'px"><span>Now</span></div>' : '') + '</div></div></div>';
    scr = body.querySelector('.scr');
    if (keepL != null) { scr.scrollLeft = keepL; body.scrollTop = keepT; }
    else scr.scrollLeft = Math.max(0, (nowX != null ? nowX : 0) - GPX * 0.6);
    GD.list = list;
    renderDet(list.filter(function (it) { return it.id === GD.sel; })[0] || null);
  }
  function renderDet(it) {
    var el = gdRoot().querySelector('.stk-gd-det');
    if (!it) { el.innerHTML = '<div class="tip">Tap a game for its channel and to open it.</div>'; return; }
    var g = it.g, a = gdLook(it, 'a'), h = gdLook(it, 'h'), lg = _glLeagueName(it.sport);
    var st = it.ph === 'live' ? 'Live · ' + lg + ' · ' + _glRowStatus(it.sport, g, 'live') : it.ph === 'post' ? 'Final · ' + lg : lg + ' · ' + gdBlockStatus(it);
    var sc = it.ph !== 'pre' && g.awayScore != null ? esc(g.awayScore) + '–' + esc(g.homeScore) : '';
    el.innerHTML = '<div class="dc" style="background:linear-gradient(rgba(12,9,32,.35),rgba(12,9,32,.35)),linear-gradient(120deg,' + a.bg + ',' + h.bg + ')">' +
      '<div class="dl"><span class="bds"><span class="bd" style="' + _glBadgeStyle(a) + '">' + esc(a.abbr) + '</span><span class="bd" style="' + _glBadgeStyle(h) + '">' + esc(h.abbr) + '</span></span>' +
      '<span class="nm"><b>' + esc(_glShort(g.away) + ' at ' + _glShort(g.home)) + '</b><small>' + (it.ph === 'live' ? '<i class="ld"></i>' : '') + esc(st) + '</small></span>' + (sc ? '<span class="sc gl-num">' + sc + '</span>' : '') + '</div>' +
      '<div class="ex"><span class="tv">' + IC.tv + (it.nets ? 'Watch on <b>' + esc(it.nets) + '</b>' : 'No TV listed') + '</span><button class="gl-join" onclick="stkGuideOpenGame()">Open</button></div></div>';
  }
  window.stkGuide = function () {
    if (S.open) { S.open = false; renderHead(); }
    var el = gdRoot();
    GD.open = true; GD.sel = null;
    var body = el.querySelector('.stk-gd-body'); body.innerHTML = ''; body.scrollTop = 0;
    renderGuide();
    document.documentElement.classList.add('stk-gd-on');
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('on'); }); });
  };
  window.stkGuideClose = function () {
    var el = document.getElementById('stk-gd');
    GD.open = false;
    document.documentElement.classList.remove('stk-gd-on');
    if (el) el.classList.remove('on');
  };
  window.stkGuidePick = function (id) {
    GD.sel = id;
    var el = gdRoot();
    Array.prototype.forEach.call(el.querySelectorAll('.blk'), function (b) { b.classList.toggle('on', b.getAttribute('onclick').indexOf("'" + id + "'") !== -1); });
    renderDet((GD.list || []).filter(function (it) { return it.id === id; })[0] || null);
  };
  window.stkGuideOpenGame = function () {
    var it = (GD.list || []).filter(function (x) { return x.id === GD.sel; })[0];
    if (!it) return;
    stkGuideClose();
    if (typeof openGameScreen === 'function') setTimeout(function () { openGameScreen(it.g.gamePk, it.g.away, it.g.home, it.sport, dateFor(S.day)); }, 220);
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && GD.open) stkGuideClose(); });

  // ── following a team from its card ──
  window.stkFollow = function (sport, team) {
    var u = user();
    if (!u || !window.db || !team) return;
    var p = S.prefs[sport] || (S.prefs[sport] = { favorite: null, following: [], rivals: [] });
    if (p.following.indexOf(team) === -1) p.following.push(team);
    Object.keys(S.items).forEach(function (id) { var it = S.items[id]; if (it.sport === sport) { it.ta = tag(sport, it.g.away); it.th = tag(sport, it.g.home); } });
    render();
    // arrayUnion + merge: this can only ever add the team, never touch your favorite or rivals
    window.db.collection('users').doc(u.uid).collection('teamPrefs').doc(sport)
      .set({ following: firebase.firestore.FieldValue.arrayUnion(team), updatedAt: Date.now() }, { merge: true })
      .then(function () {
        if (typeof _invalidateFavTeamsCache === 'function') _invalidateFavTeamsCache(sport);
        if (window._yw && window._yw.prefs) delete window._yw.prefs[sport];
        if (typeof ib_toast === 'function') ib_toast('Following the ' + _glShort(team));
      })
      .catch(function (err) {
        console.error('[stack] follow', err);
        var i = p.following.indexOf(team); if (i !== -1) p.following.splice(i, 1);
        S.prefsAt = 0; S.sig = ''; refresh();
        if (typeof ib_toast === 'function') ib_toast('Could not follow — ' + (err && err.message ? err.message : 'try again'));
      });
  };

  // ── Add a team (v7.93.1): a glass sheet of league tiles, each showing the
  // teams you already have there. It slides up, follows your finger when you
  // drag it down, and slides away (or tap Done / outside it). ──
  function leagueTile(s) {
    var p = S.prefs[s.key] || {}, fav = p.favorite, n = (p.following || []).filter(function (t) { return t !== fav; }).length;
    var dot = fav ? _glTeam(s.key, fav).bg : null;
    var sub = fav ? '<span class="fav">' + IC.star + esc(_glShort(fav)) + '</span>' + (n ? '<span> +' + n + '</span>' : '')
      : n ? '<span>' + n + (n === 1 ? ' team' : ' teams') + '</span>' : '<span class="none">None yet</span>';
    return '<button class="stk-lg" onclick="stkAddLeague(\'' + s.key + '\')"><i style="background:' + (dot || 'rgba(207,199,255,.22)') + '"></i>' +
      '<span class="tx"><b>' + esc(s.key === 'cfb' ? 'College FB' : s.key === 'cbb' ? 'College BB' : s.name) + '</b><small>' + sub + '</small></span>' + IC.plus + '</button>';
  }
  function sheetEl() {
    var sh = document.getElementById('stk-sheet');
    if (sh) return sh;
    sh = document.createElement('div'); sh.id = 'stk-sheet';
    sh.innerHTML = '<div class="stk-shade"></div><div class="stk-panel" role="dialog" aria-modal="true" aria-label="Add a team">' +
      '<div class="stk-grabz"><div class="grab"></div></div>' +
      '<div class="hd"><span><b>Add a team</b><small>Pick a league</small></span><button class="done" onclick="stkAddClose()">Done</button></div>' +
      '<div class="grid"></div></div>';
    (document.querySelector('.app') || document.body).appendChild(sh);
    var panel = sh.querySelector('.stk-panel'), shade = sh.querySelector('.stk-shade');
    shade.addEventListener('click', function () { stkAddClose(); });
    // drag the sheet down to put it away
    var y0 = null, t0 = 0, dy = 0;
    var start = function (y) { y0 = y; t0 = Date.now(); dy = 0; panel.style.transition = 'none'; shade.style.transition = 'none'; };
    var move = function (y) {
      if (y0 == null) return;
      dy = Math.max(0, y - y0);
      panel.style.transform = 'translateY(' + dy + 'px)';
      shade.style.opacity = Math.max(0, 1 - dy / (panel.offsetHeight || 400));
    };
    var end = function () {
      if (y0 == null) return;
      var v = dy / Math.max(1, Date.now() - t0); y0 = null;
      panel.style.transition = ''; shade.style.transition = '';
      if (dy > 90 || (dy > 24 && v > 0.5)) { S.sheetDrag = Date.now(); stkAddClose(); }
      else { panel.style.transform = ''; shade.style.opacity = ''; }
    };
    panel.addEventListener('touchstart', function (e) { var t = e.touches[0]; if (t) start(t.clientY); }, { passive: true });
    panel.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) { move(t.clientY); if (dy > 0 && e.cancelable) e.preventDefault(); } }, { passive: false });
    panel.addEventListener('touchend', end);
    panel.addEventListener('touchcancel', end);
    panel.addEventListener('mousedown', function (e) { start(e.clientY); var mm = function (ev) { move(ev.clientY); }, mu = function () { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); end(); }; document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu); });
    return sh;
  }
  window.stkAdd = function () {
    var sh = sheetEl(), panel = sh.querySelector('.stk-panel'), shade = sh.querySelector('.stk-shade');
    sh.querySelector('.grid').innerHTML = GAMES_SPORTS.map(leagueTile).join('');
    clearTimeout(S.sheetT);
    panel.style.transform = ''; shade.style.opacity = '';
    sh.classList.add('on');
    void sh.offsetHeight; // start from below the screen, then slide up
    sh.classList.add('show');
  };
  window.stkAddClose = function (then) {
    var sh = document.getElementById('stk-sheet'); if (!sh) return;
    var panel = sh.querySelector('.stk-panel'), shade = sh.querySelector('.stk-shade');
    panel.style.transform = ''; shade.style.opacity = '';
    sh.classList.remove('show');
    clearTimeout(S.sheetT);
    S.sheetT = setTimeout(function () { sh.classList.remove('on'); if (typeof then === 'function') then(); }, 340);
  };
  window.stkTeamsChanged = function () { S.prefsDirty = true; };
  window.stkAddLeague = function (key) {
    if (S.sheetDrag && Date.now() - S.sheetDrag < 400) return; // that was a drag, not a tap
    S.prefsDirty = true;
    stkAddClose(function () { if (typeof openTeamPrefs === 'function') openTeamPrefs(key); });
  };

  // ── under the pile: last night's recaps, your plans ──
  function row(cap, text, right, attrs) {
    return '<button class="stk-row" ' + attrs + '><span class="k">' + esc(cap) + '</span><span class="t">' + text + '</span>' + (right || IC.chev) + '</button>';
  }
  function renderRows() {
    var out = '';
    try {
      var rc = (window._rcOrders && window._rcOrders.p) || [];
      if (rc.length && typeof recapsOpen === 'function') out += row('Last night', rc.length + (rc.length === 1 ? ' recap' : ' recaps') + ' for you', '', 'onclick="recapsOpen(0,\'p\')"');
      var cache = window._feedMomentsCache, me = user();
      var arr = cache ? Object.keys(cache).map(function (k) { return cache[k]; }).sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); }) : [];
      arr.slice(0, 2).forEach(function (m) {
        var wd = 'Soon';
        if (m.date) { var d = new Date(m.date + 'T12:00:00'); if (!isNaN(d.getTime())) wd = d.toLocaleDateString(undefined, { weekday: 'long' }); }
        var by = me && m.ownerUid === me.uid ? 'your plan' : (String(m.ownerName || 'A friend').split(' ')[0] + ' is going');
        out += row(wd, esc(m.title || 'Untitled plan') + '<i> · ' + esc(by) + '</i>', '', 'data-id="' + esc(m._id) + '" onclick="openFutureDetail(this.dataset.id)"');
      });
      if (arr.length > 2) out += row('Plans', 'All ' + arr.length + ' coming up', '', 'onclick="nav(\'friends\')"');
      out += row('Coming up', arr.length ? 'Plan something' : 'Post what’s coming up', '', 'onclick="startFuturePlan()"');
    } catch (e) { console.error('[stack] rows', e); }
    rowsEl.innerHTML = out;
  }

  // ── wiring into Home ──
  function wrapFn(name, after) {
    var prev = window[name];
    if (typeof prev !== 'function') return;
    window[name] = function () { var o = prev.apply(this, arguments); try { after(); } catch (e) { console.error('[stack] ' + name, e); } return o; };
  }
  // the ambient glow follows the top card, not the (hidden) friends' tile
  if (typeof _glAmbient === 'function') { S.amb = _glAmbient; window._glAmbient = function () {}; }
  wrapFn('_glRenderLive', function () { if (S.day === 0) { if (S.prefsReady) ingest(window._glSched || []); else loadPrefs().then(refresh); if (GD.open) renderGuide(); } });
  wrapFn('_glRenderRecaps', renderRows);
  wrapFn('_glRenderComing', renderRows);
  wrapFn('_glHomeOpen', function () {
    S.touched = false; S.open = false;
    loadPrefs(S.prefsDirty).then(function () { S.sig = ''; render(); refresh(); });
    renderRows();
  });
  renderHead();
  render();
  renderRows();
})();
