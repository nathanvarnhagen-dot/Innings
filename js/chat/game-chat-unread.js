// ══ CHAT TAB = MESSAGES YOU HAVEN'T SEEN (v7.20.1) ═══════════════════════
// The number on a game's Chat tab used to be how many friends were watching
// (already said under the score: "Alexa is also watching"). It's now how many
// messages from other people you haven't seen, and it's gone once you have.
//   · seen = the Chat tab is open (or the desktop chat column is showing)
//     while the app is in front
//   · the chat starts listening as soon as a game opens, so the count shows
//     up on the Cheat Sheet and the other tabs too
//   · what you've seen is remembered on this device per game, so a reload or
//     coming back later doesn't count old messages again
(function () {
  var KEY = 'innings_gc_seen', MAX_GAMES = 40;
  var store = null;
  function load() {
    if (store) return store;
    try { store = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { store = null; }
    // first run on this device: messages from before today's update count as
    // seen, so nobody opens a game to a pile of old "unread" chats
    if (!store || typeof store !== 'object') store = { since: Date.now(), g: {} };
    if (!store.g) store.g = {};
    return store;
  }
  function save() {
    var st = load(), pks = Object.keys(st.g);
    if (pks.length > MAX_GAMES) pks.sort(function (a, b) { return (st.g[a].at || 0) - (st.g[b].at || 0); }).slice(0, pks.length - MAX_GAMES).forEach(function (k) { delete st.g[k]; });
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  }
  function me() { var u = window.currentUser || (window.auth && window.auth.currentUser); return u ? u.uid : null; }
  function activePk() { var g = window._activeBrowseGame; return g && g.gamePk != null ? String(g.gamePk) : null; }
  function others(pk) {
    var uid = me(), since = load().since || 0;
    return ((window._gameChatMsgs || {})[pk] || []).filter(function (m) { return m && m._id && m.uid !== uid && (m.ts || 0) >= since; });
  }
  function chatShowing() {
    if (document.hidden) return false;
    var scr = document.getElementById('screen-game');
    if (!scr || !scr.classList.contains('active')) return false;
    if (typeof _isDesk === 'function' && _isDesk()) return true;
    var p = document.getElementById('game-chat-panel');
    return !!(p && p.style.display !== 'none' && p.offsetParent !== null);
  }
  function markSeen(pk) {
    var list = others(pk);
    if (!list.length) return;
    var st = load(), rec = st.g[pk] || (st.g[pk] = { at: 0, ids: [] }), have = {}, changed = false;
    rec.ids.forEach(function (id) { have[id] = 1; });
    list.forEach(function (m) { if (!have[m._id]) { rec.ids.push(m._id); changed = true; } });
    if (!changed) return;
    if (rec.ids.length > 400) rec.ids = rec.ids.slice(-400);
    rec.at = Date.now();
    save();
  }
  function unread(pk) {
    var rec = load().g[pk], have = {};
    if (rec) rec.ids.forEach(function (id) { have[id] = 1; });
    return others(pk).filter(function (m) { return !have[m._id]; }).length;
  }
  function paint(n) {
    var btn = document.getElementById('game-tab-chat');
    if (!btn) return;
    var html = 'Chat' + (n > 0 ? '<span class="gc-unread" style="display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;padding:0 5px;margin-left:6px;border-radius:9px;background:rgba(124,242,156,.2);color:#9be8ac;font-size:10.5px;font-weight:800;vertical-align:1px">' + (n > 99 ? '99+' : n) + '</span>' : '');
    if (btn.innerHTML !== html) btn.innerHTML = html;
    btn.setAttribute('aria-label', n > 0 ? 'Chat, ' + n + ' unread' : 'Chat');
  }
  function update() {
    var pk = activePk();
    if (!pk) { paint(0); return; }
    if (chatShowing()) markSeen(pk);
    paint(unread(pk));
  }
  window._gcUnreadUpdate = update;

  // the old friends-watching number → the unread number
  _renderChatTabCount = function () { update(); };

  if (typeof renderGameChat === 'function') {
    var prevRender = renderGameChat;
    renderGameChat = function () { var r = prevRender.apply(this, arguments); try { update(); } catch (e) {} return r; };
  }
  if (typeof gameDetailTab === 'function') {
    var prevTab = gameDetailTab;
    gameDetailTab = function () { var r = prevTab.apply(this, arguments); try { update(); } catch (e) {} return r; };
  }
  // opening a game starts its chat right away (so the count works from any
  // tab) and redraws what's already here, instead of the last game's chat
  if (typeof _showGameScreen === 'function') {
    var prevShow = _showGameScreen;
    _showGameScreen = function (g) {
      var r = prevShow.apply(this, arguments);
      try {
        var pk = g && g.gamePk != null ? String(g.gamePk) : null;
        if (pk && me() && typeof startGameChat === 'function') startGameChat(g.gamePk);
        var have = pk && (window._gameChatMsgs || {})[pk];
        if (have && typeof renderGameChat === 'function') renderGameChat(have);
        else update();
      } catch (e) { console.error('[chat unread]', e); }
      return r;
    };
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) try { update(); } catch (e) {} });
})();
