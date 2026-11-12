// ══ THE TV GUIDE (v7.99.0) ═══════════════════════════════════════════
// A sheet that slides up over whatever screen opened it: every game of a
// day, one row per channel (the channels your teams are on first, then the
// ones with live games), time running left to right with a red line at now.
// Every game shows its network on it. Tap a game for its card; Open goes in.
//
// Opened from (v7.99.0 moved it off Home's top row):
//   · Games › any league: the TV button beside search — that league's games
//     for the day (football: the week, a day at a time)
//   · Multi view: "Guide" beside Edit board — every sport, today
//   · Home › Yours: "Guide" over the pile, only when two or more of your
//     teams play that day — just your teams' games
//
// innGuide({ date: 'YYYY-MM-DD', dates: [...] (optional day chips),
//            sports: ['nba'] | null (every sport), label: 'NBA' (optional),
//            filter: function (it) → bool (optional; it.mine 2 fav, 1 follow) })

(function () {
  var GPX = 104; // px per hour
  var DUR = { mlb: 3, nfl: 3.25, cfb: 3.5, nba: 2.4, wnba: 2, cbb: 2, nhl: 2.6, mls: 2, nwsl: 2 };
  var TV = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="2.5"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>';
  var STAR = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l2.8 5.9 6.2.8-4.6 4.3 1.2 6.3L12 17.3 6.4 20.3l1.2-6.3L3 9.7l6.2-.8z"/></svg>';
  var G = { open: false, opts: null, date: null, sel: null, cache: {}, list: [], timer: null, prefs: null, prefsAt: 0 };
  window.TV_ICON = TV;

  function esc(s) { return typeof _glEsc === 'function' ? _glEsc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return typeof _todayLocal === 'function' ? _todayLocal() : iso(new Date()); }
  function noon(s) { return new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)), 12); }
  function diff(s) { return Math.round((noon(s) - noon(today())) / 864e5); }
  function dayPhrase(s) {
    var d = diff(s);
    if (d === 0) return new Date().getHours() >= 17 ? 'tonight' : 'today';
    if (d === -1) return 'yesterday';
    if (d === 1) return 'tomorrow';
    if (d > 1 && d < 7) return noon(s).toLocaleDateString(undefined, { weekday: 'long' });
    return noon(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
  }
  function chipWord(s) {
    var d = diff(s);
    if (d === 0) return 'Today';
    if (d === -1) return 'Yesterday';
    if (d === 1) return 'Tomorrow';
    return noon(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).replace(',', '');
  }
  function sportKeys() {
    var all = (typeof GAMES_SPORTS !== 'undefined' ? GAMES_SPORTS : []).map(function (s) { return s.key; });
    return G.opts && G.opts.sports ? G.opts.sports.filter(function (k) { return all.indexOf(k) !== -1 || true; }) : all;
  }

  // ── your teams (to put their channels first) ──
  function user() { return window.currentUser || (window.auth && window.auth.currentUser) || null; }
  function loadPrefs() {
    var u = user();
    if (!u || !window.db || typeof GAMES_SPORTS === 'undefined') return Promise.resolve();
    if (G.prefs && Date.now() - G.prefsAt < 120000) return Promise.resolve();
    var out = {};
    return Promise.all(GAMES_SPORTS.map(function (s) {
      return window.db.collection('users').doc(u.uid).collection('teamPrefs').doc(s.key).get()
        .then(function (doc) { var d = doc.exists ? doc.data() : {}; out[s.key] = { favorite: d.favorite || null, following: d.following || [] }; })
        .catch(function () {});
    })).then(function () { G.prefs = out; G.prefsAt = Date.now(); });
  }
  function mine(sport, team) {
    var p = G.prefs && G.prefs[sport];
    if (!p || !team) return 0;
    if (p.favorite === team) return 2;
    return (p.following || []).indexOf(team) !== -1 ? 1 : 0;
  }
  window._tvgMine = mine;

  // ── the day's games ──
  function fetchSport(sport, date) {
    var k = sport + '|' + date, c = G.cache[k], ttl = date === today() ? 30000 : 300000;
    if (c && Date.now() - c.at < ttl) return Promise.resolve(c.games);
    if (date === today() && window._glSched && window._glLiveAt && Date.now() - window._glLiveAt < 30000) {
      var hit = window._glSched.filter(function (x) { return x.sport === sport; })[0];
      if (hit) { G.cache[k] = { at: Date.now(), games: hit.games || [] }; return Promise.resolve(hit.games || []); }
    }
    if (typeof _bsModalScheduleUrl !== 'function') return Promise.resolve([]);
    return fetch(_bsModalScheduleUrl(sport, date))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { var gs = (d && d.games) || []; G.cache[k] = { at: Date.now(), games: gs }; return gs; })
      .catch(function () { return c ? c.games : []; });
  }
  function load() {
    var date = G.date;
    return Promise.all(sportKeys().map(function (s) { return fetchSport(s, date).then(function (gs) { return { sport: s, games: gs }; }); }))
      .then(function (res) { if (G.date === date) build(res); });
  }
  function build(res) {
    var out = [], d0 = noon(G.date); d0.setHours(0, 0, 0, 0);
    res.forEach(function (x) {
      (x.games || []).forEach(function (g) {
        if (!g || g.gamePk == null || !g.away || !g.home) return;
        try { if (typeof _cbbWorthy === 'function' && !_cbbWorthy(x.sport, g)) return; } catch (e) {}
        var t = Date.parse(g.startTime || ''); if (!t) return;
        var ma = mine(x.sport, g.away), mh = mine(x.sport, g.home);
        var nets = String(g.network || '').split(' · ').filter(Boolean);
        var it = { id: x.sport + ':' + g.gamePk, sport: x.sport, g: g, h: (t - d0) / 3600000, dur: DUR[x.sport] || 2.5,
          ph: typeof _glPhase === 'function' ? _glPhase(x.sport, g) : 'pre', net: nets[0] || '', nets: nets.join(' · '),
          mine: Math.max(ma, mh), mineTeam: ma >= mh ? g.away : g.home };
        if (G.opts.filter && !G.opts.filter(it)) return;
        out.push(it);
      });
    });
    G.list = out;
    G.loaded = true;
    if (G.open) render();
  }

  // ── drawing ──
  function root() {
    var el = document.getElementById('tvg');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'tvg';
    el.innerHTML = '<div class="tvg-shade" onclick="innGuideClose()"></div><div class="tvg-sheet" role="dialog" aria-modal="true" aria-label="TV guide"><div class="tvg-top"><span class="grab"></span><div class="hd"><div><b></b><small></small></div><button class="x" onclick="innGuideClose()" aria-label="Close the guide"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button></div><div class="tvg-days"></div></div><div class="tvg-body"></div><div class="tvg-det"></div></div>';
    document.body.appendChild(el);
    var top = el.querySelector('.tvg-top'), sheet = el.querySelector('.tvg-sheet');
    var y0 = null, dy = 0;
    var start = function (y) { y0 = y; dy = 0; sheet.style.transition = 'none'; };
    var move = function (y) { if (y0 == null) return; dy = Math.max(0, y - y0); sheet.style.transform = 'translateY(' + dy + 'px)'; };
    var end = function () { if (y0 == null) return; y0 = null; sheet.style.transition = ''; sheet.style.transform = ''; if (dy > 90) innGuideClose(); };
    top.addEventListener('touchstart', function (e) { if (e.target.closest('button')) return; var t = e.touches[0]; if (t) start(t.clientY); }, { passive: true });
    top.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) move(t.clientY); }, { passive: true });
    top.addEventListener('touchend', end, { passive: true });
    top.addEventListener('mousedown', function (e) { if (e.target.closest('button')) return; start(e.clientY); var mm = function (ev) { move(ev.clientY); }, mu = function () { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); end(); }; document.addEventListener('mousemove', mm); document.addEventListener('mouseup', mu); });
    return el;
  }
  function hourLabel(h) { var x = ((Math.floor(h) % 24) + 24) % 24; return (x % 12 || 12) + (x < 12 ? ' AM' : ' PM'); }
  function when(it) { return (typeof _formatGameTime === 'function' && _formatGameTime(it.g.startTime)) || ''; }
  function status(it) {
    var g = it.g, sc = g.awayScore != null && g.homeScore != null ? g.awayScore + '–' + g.homeScore + ' · ' : '';
    if (it.ph === 'live') return sc + (typeof _glRowStatus === 'function' ? _glRowStatus(it.sport, g, 'live') : 'Live');
    if (it.ph === 'post') return sc + 'Final';
    if (typeof _glOff === 'function' && _glOff(g)) return typeof _glRowStatus === 'function' ? _glRowStatus(it.sport, g, 'pre') : 'Postponed';
    if (typeof _glTbd === 'function' && _glTbd(g)) return 'TBD';
    return when(it);
  }
  function look(it, side) {
    var g = it.g;
    if (typeof _glTeam !== 'function') return { abbr: String(side === 'a' ? g.away : g.home).slice(0, 3).toUpperCase(), bg: '#3D3580', fg: '#fff' };
    return side === 'a' ? _glTeam(it.sport, g.away, g.awayAbbr, g.awayColor, g.awayAlt) : _glTeam(it.sport, g.home, g.homeAbbr, g.homeColor, g.homeAlt);
  }
  function short(n) { return typeof _glShort === 'function' ? _glShort(n) : n; }
  function render() {
    var el = root(), body = el.querySelector('.tvg-body'), o = G.opts;
    el.querySelector('.hd b').textContent = (o.label ? o.label + ' on TV ' : 'On TV ') + dayPhrase(G.date);
    var days = el.querySelector('.tvg-days');
    days.innerHTML = o.dates && o.dates.length > 1 ? o.dates.map(function (d) {
      return '<button class="' + (d === G.date ? 'on' : '') + '" aria-pressed="' + (d === G.date) + '" onclick="innGuideDay(\'' + d + '\')">' + esc(chipWord(d)) + '</button>';
    }).join('') : '';
    days.style.display = days.innerHTML ? '' : 'none';
    var sub = el.querySelector('.hd small');
    if (!G.loaded) { sub.textContent = 'Loading the games…'; body.innerHTML = '<div class="tvg-empty">Loading…</div>'; det(null); return; }
    var list = G.list;
    if (!list.length) { sub.textContent = 'No games'; body.innerHTML = '<div class="tvg-empty">No games ' + esc(dayPhrase(G.date)) + '.</div>'; det(null); return; }
    var rows = {}, keys = [];
    list.forEach(function (it) { var k = it.net || '~'; if (!rows[k]) { rows[k] = []; keys.push(k); } rows[k].push(it); });
    var nCh = keys.filter(function (k) { return k !== '~'; }).length;
    sub.textContent = list.length + ' game' + (list.length === 1 ? '' : 's') + ' on ' + nCh + ' channel' + (nCh === 1 ? '' : 's') + (list.some(function (it) { return it.mine; }) ? ' · your teams’ channels first' : '');
    var score = function (k) {
      var r = rows[k], m = Math.max.apply(null, r.map(function (it) { return it.mine; })), lv = r.some(function (it) { return it.ph === 'live'; });
      return k === '~' ? 1e6 : (2 - m) * 1000 + (lv ? 0 : 100) - r.length;
    };
    keys.sort(function (a, b) { return score(a) - score(b) || a.localeCompare(b); });
    var lo = Math.floor(Math.min.apply(null, list.map(function (it) { return it.h; })));
    var hi = Math.ceil(Math.max.apply(null, list.map(function (it) { return it.h + it.dur; })));
    if (hi - lo < 4) hi = lo + 4;
    var hours = '';
    for (var hh = lo; hh < hi; hh++) hours += '<span style="left:' + ((hh - lo) * GPX + 6) + 'px">' + hourLabel(hh) + '</span>';
    if (!G.sel || !list.some(function (it) { return it.id === G.sel; })) {
      var pick = list.filter(function (it) { return it.mine && it.ph !== 'post'; }).sort(function (a, b) { return (b.mine - a.mine) || (a.h - b.h); })[0]
        || list.filter(function (it) { return it.ph === 'live'; })[0];
      G.sel = pick ? pick.id : null;
    }
    var labs = '', grid = '';
    keys.forEach(function (k) {
      var r = rows[k].sort(function (a, b) { return a.h - b.h; }), lanes = [];
      r.forEach(function (it) {
        var x = (it.h - lo) * GPX, wd = Math.max(it.dur * GPX - 4, 96), L = 0;
        while (lanes[L] != null && lanes[L] > x) L++;
        lanes[L] = x + wd + 4; it._x = x; it._w = wd; it._l = L;
      });
      var H = Math.max(1, lanes.length) * 64 + 4;
      var my = r.filter(function (it) { return it.mine; }).sort(function (a, b) { return b.mine - a.mine; })[0];
      labs += '<div class="lr' + (my ? ' mine' : '') + '" style="height:' + H + 'px"><b>' + esc(k === '~' ? 'No TV listed' : k) + '</b>' + (my ? '<small>' + esc(short(my.mineTeam)) + '</small>' : '') + '</div>';
      grid += '<div class="gr" style="height:' + H + 'px">' + r.map(function (it) {
        var a = look(it, 'a'), h = look(it, 'h');
        return '<button class="blk' + (it.ph === 'live' ? ' live' : '') + (it.ph === 'post' ? ' post' : '') + (it.mine ? ' mine' : '') + (it.id === G.sel ? ' on' : '') + '" data-id="' + esc(it.id) + '" style="left:' + (it._x + 2) + 'px;width:' + it._w + 'px;top:' + (it._l * 64 + 4) + 'px;background:linear-gradient(rgba(12,9,32,.28),rgba(12,9,32,.28)),linear-gradient(100deg,' + a.bg + ',' + h.bg + ')" onclick="innGuidePick(this.dataset.id)" aria-label="' + esc(short(it.g.away) + ' at ' + short(it.g.home) + ', ' + status(it) + ', on ' + (it.nets || 'no TV listed')) + '">' +
          '<b>' + (it.mine === 2 ? STAR : '') + esc(a.abbr + ' at ' + h.abbr) + '</b>' +
          '<small>' + (it.ph === 'live' ? '<i class="ld"></i>' : '') + esc(status(it)) + '</small>' +
          '<em>' + TV + esc(it.nets || 'No TV listed') + '</em></button>';
      }).join('') + '</div>';
    });
    var nowX = null;
    if (diff(G.date) === 0) { var n = new Date(), nh = n.getHours() + n.getMinutes() / 60; if (nh >= lo && nh <= hi) nowX = (nh - lo) * GPX; }
    var scr = body.querySelector('.scr'), keepL = scr && G.keep ? scr.scrollLeft : null, keepT = body.scrollTop;
    body.innerHTML = '<div class="gd"><div class="lab"><div class="lh"></div>' + labs + '</div>' +
      '<div class="scr"><div class="cv" style="width:' + ((hi - lo) * GPX) + 'px"><div class="hrs">' + hours + '</div>' + grid +
      (nowX != null ? '<div class="nowl" style="left:' + nowX + 'px"><span>Now</span></div>' : '') + '</div></div></div>';
    scr = body.querySelector('.scr');
    if (keepL != null) { scr.scrollLeft = keepL; body.scrollTop = keepT; }
    else {
      // today: open on now; any other day: open on the first game
      scr.scrollLeft = nowX != null ? Math.max(0, nowX - GPX * 0.6) : 0;
    }
    G.keep = true;
    det(list.filter(function (it) { return it.id === G.sel; })[0] || null);
  }
  function det(it) {
    var el = root().querySelector('.tvg-det');
    if (!it) { el.innerHTML = '<div class="tip">Tap a game for its channel and to open it.</div>'; return; }
    var g = it.g, a = look(it, 'a'), h = look(it, 'h'), lg = typeof _glLeagueName === 'function' ? _glLeagueName(it.sport) : it.sport.toUpperCase();
    var st = it.ph === 'live' ? 'Live · ' + lg + ' · ' + (typeof _glRowStatus === 'function' ? _glRowStatus(it.sport, g, 'live') : '') : it.ph === 'post' ? 'Final · ' + lg : lg + ' · ' + status(it);
    var sc = it.ph !== 'pre' && g.awayScore != null ? esc(g.awayScore) + '–' + esc(g.homeScore) : '';
    var badge = function (t) { return typeof _glBadgeStyle === 'function' ? _glBadgeStyle(t) : 'background:' + t.bg + ';color:#fff'; };
    el.innerHTML = '<div class="dc" style="background:linear-gradient(rgba(12,9,32,.35),rgba(12,9,32,.35)),linear-gradient(120deg,' + a.bg + ',' + h.bg + ')">' +
      '<div class="dl"><span class="bds"><span class="bd" style="' + badge(a) + '">' + esc(a.abbr) + '</span><span class="bd" style="' + badge(h) + '">' + esc(h.abbr) + '</span></span>' +
      '<span class="nm"><b>' + esc(short(g.away) + ' at ' + short(g.home)) + '</b><small>' + (it.ph === 'live' ? '<i class="ld"></i>' : '') + esc(st) + '</small></span>' + (sc ? '<span class="sc gl-num">' + sc + '</span>' : '') + '</div>' +
      '<div class="ex"><span class="tv">' + TV + (it.nets ? 'Watch on <b>' + esc(it.nets) + '</b>' : 'No TV listed') + '</span><button class="gl-join" onclick="innGuideOpenGame()">Open</button></div></div>';
  }

  // ── open / close ──
  window.innGuide = function (opts) {
    G.opts = opts || {};
    G.date = G.opts.date || today();
    if (G.opts.dates && G.opts.dates.length && G.opts.dates.indexOf(G.date) === -1) G.date = G.opts.dates[0];
    G.sel = null; G.loaded = false; G.list = []; G.keep = false;
    var el = root();
    el.querySelector('.tvg-body').scrollTop = 0;
    G.open = true;
    render();
    document.documentElement.classList.add('tvg-on');
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('on'); }); });
    loadPrefs().then(load);
    clearInterval(G.timer);
    G.timer = setInterval(function () { if (G.open && diff(G.date) === 0) load(); }, 30000);
  };
  window.innGuideClose = function () {
    G.open = false;
    clearInterval(G.timer);
    document.documentElement.classList.remove('tvg-on');
    var el = document.getElementById('tvg');
    if (el) el.classList.remove('on');
  };
  window.innGuideDay = function (d) {
    if (d === G.date) return;
    G.date = d; G.sel = null; G.loaded = false; G.keep = false;
    render(); load();
  };
  window.innGuidePick = function (id) {
    G.sel = id;
    Array.prototype.forEach.call(root().querySelectorAll('.blk'), function (b) { b.classList.toggle('on', b.dataset.id === id); });
    det(G.list.filter(function (it) { return it.id === id; })[0] || null);
  };
  window.innGuideOpenGame = function () {
    var it = G.list.filter(function (x) { return x.id === G.sel; })[0];
    if (!it) return;
    var date = G.date;
    innGuideClose();
    if (typeof openGameScreen === 'function') setTimeout(function () { openGameScreen(it.g.gamePk, it.g.away, it.g.home, it.sport, date); }, 220);
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && G.open) innGuideClose(); });
})();
