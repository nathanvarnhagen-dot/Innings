// ══ STAY ON THE NEWEST BUILD (v7.18.1) ══════════════════════════════════
// A phone can keep Innings open for days, so friends end up on an old build
// (a fix that went out today never reaches them). Every couple of minutes,
// and whenever the app comes back to the front, this asks for the deployed
// build stamp. When it's newer:
//   · the app is in the background → it reloads the moment you come back
//   · you're looking at it → a small "New version · Refresh" pill drops in
// Either way, a game you had open reopens on the same tab after the reload.

(function () {
  var CUR = window.INNINGS_BUILD;
  if (!CUR || !window.fetch) return;
  var RESUME_KEY = 'innings_resume';
  var lastAt = 0, pending = null;

  function check(force) {
    if (!force && Date.now() - lastAt < 60000) return;
    lastAt = Date.now();
    fetch('js/core/build.js?ts=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (t) {
        var m = String(t || '').match(/INNINGS_BUILD\s*=\s*'([^']+)'/);
        if (!m || m[1] === CUR) return;
        pending = m[1];
        if (!document.hidden) showPill();
      })
      .catch(function () {});
  }

  function typing() {
    var a = document.activeElement;
    return !!(a && ((a.tagName === 'TEXTAREA' && a.value) || (a.tagName === 'INPUT' && a.value && a.type !== 'search')));
  }

  // what to put back after the reload
  function rememberPlace() {
    try {
      var act = document.querySelector('.screen.active');
      var id = act ? act.id.replace('screen-', '') : null;
      var data = { at: Date.now(), screen: id };
      var g = window._activeBrowseGame;
      if (id === 'game' && g && g.gamePk != null) {
        var vis = function (pid) { var e = document.getElementById(pid); return !!(e && e.style.display !== 'none' && e.offsetParent !== null); };
        var tab = vis('game-chat-panel') ? 'chat' : vis('game-plays-panel') ? 'plays' : vis('game-box-panel') ? 'box' : vis('game-watch-panel') ? 'watch' : vis('game-rules-panel') ? 'rules' : 'sheet';
        data.game = { gamePk: g.gamePk, away: g.away, home: g.home, sport: g.sport || 'mlb', date: g.date || window._gamesDate || null, tab: tab };
      }
      sessionStorage.setItem(RESUME_KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function reload() {
    rememberPlace();
    try { var u = new URL(location.href); u.searchParams.set('b', pending || String(Date.now())); location.replace(u.toString()); }
    catch (e) { location.reload(); }
  }
  window.inningsUpdateNow = reload;

  function showPill() {
    if (document.getElementById('upd-pill')) return;
    var b = document.createElement('button');
    b.id = 'upd-pill';
    b.type = 'button';
    b.setAttribute('aria-label', 'A new version of Innings is ready. Refresh');
    b.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg><span>New version of Innings</span><b>Refresh</b>';
    b.onclick = reload;
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add('on'); });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (pending && !typing()) { reload(); return; }
    check(true);
  });
  setInterval(function () { check(false); }, 120000);
  setTimeout(function () { check(true); }, 15000);

  // ── after a reload: back to the game you had open
  var saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(RESUME_KEY) || 'null'); sessionStorage.removeItem(RESUME_KEY); } catch (e) {}
  if (!saved || Date.now() - (saved.at || 0) > 5 * 60000) return;
  var SIMPLE = { home: 1, feed: 1, games: 1, 'games-picker': 1, friends: 1, memories: 1, calendar: 1, profile: 1, notifications: 1 };
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var ready = (window.currentUser || (window.auth && window.auth.currentUser)) && document.querySelector('.screen.active');
    if (!ready) { if (tries > 60) clearInterval(t); return; }
    var act = document.querySelector('.screen.active').id;
    // wait for the app to land on its first screen after sign-in
    if (!/screen-(feed|home)$/.test(act) && tries < 60) return;
    clearInterval(t);
    try {
      if (saved.game && typeof openGameScreen === 'function') {
        var G = saved.game;
        openGameScreen(G.gamePk, G.away, G.home, G.sport, G.date);
        if (G.tab && G.tab !== 'sheet' && typeof gameDetailTab === 'function') setTimeout(function () { gameDetailTab(G.tab); }, 600);
      } else if (saved.screen && SIMPLE[saved.screen] && typeof nav === 'function' && !/^(feed|home)$/.test(saved.screen)) {
        nav(saved.screen);
      }
    } catch (e) { console.error('[resume after update]', e); }
  }, 250);
})();
