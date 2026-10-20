// ══ GAME CHAT STAYS ON THE NEWEST MESSAGE (v7.63.0) ══════════════════════
// The bug: a new message re-renders the chat and scrolls to the bottom right
// away — then more lands after that scroll (the game tags on each message,
// the time separators, the rail of games and chats above it, photos and link
// cards loading), so the newest messages end up below the fold and you have
// to scroll down to see them.
// Now the scroll happens after all of that, and again as photos load:
//   · you were at (or near) the bottom, or it's your own message → you stay
//     on the newest message
//   · you'd scrolled up to read → you stay right where you were
window._gcs = window._gcs || { depth: 0, was: null, seen: false, mineAt: 0 };
var GCS_NEAR = 180; // px from the bottom that still counts as "at the newest"
function _gcsPanel() { return document.getElementById('game-chat-panel'); }
function _gcsAtBottom(p) { return p.scrollHeight - p.scrollTop - p.clientHeight < GCS_NEAR; }
function _gcsStick() {
  var p = _gcsPanel();
  if (p) p.scrollTop = p.scrollHeight;
}
// to the newest now, after the next paint, and once the slow bits are in
function _gcsToBottom() {
  _gcsStick();
  window._gcs.stickUntil = Date.now() + 1500;
  if (window.requestAnimationFrame) requestAnimationFrame(function () { _gcsStick(); requestAnimationFrame(_gcsStick); });
  setTimeout(_gcsStick, 150);
  setTimeout(_gcsStick, 600);
  var box = document.getElementById('game-chat-msgs');
  if (box) Array.prototype.forEach.call(box.querySelectorAll('img'), function (im) {
    if (im.complete || im._gcs) return;
    im._gcs = 1;
    im.addEventListener('load', function () { var p = _gcsPanel(); if (p && (Date.now() < (window._gcs.stickUntil || 0) || _gcsAtBottom(p))) _gcsStick(); }, { once: true });
  });
}
function _gcsBefore() {
  var G = window._gcs, p = _gcsPanel();
  if (G.depth++ > 0) return;
  if (!p) { G.was = null; return; }
  var shown = p.offsetParent !== null && p.style.display !== 'none';
  // the first time the chat is showing, and right after you sent something: the newest
  var bottom = !G.seen || !shown || _gcsAtBottom(p) || Date.now() - G.mineAt < 4000 || Date.now() < (G.stickUntil || 0);
  G.was = { bottom: bottom, top: p.scrollTop, h: p.scrollHeight };
  if (shown) G.seen = true;
}
function _gcsAfter() {
  var G = window._gcs, p = _gcsPanel(), was = G.was;
  if (--G.depth > 0) return;
  G.depth = 0;
  if (!p || !was) return;
  if (was.bottom) _gcsToBottom();
  else p.scrollTop = was.top; // reading older messages: leave them where they are
}
(function () {
  var wrap = function (name) {
    var f = window[name];
    if (typeof f !== 'function') return;
    window[name] = function () {
      _gcsBefore();
      try { return f.apply(this, arguments); }
      finally { try { _gcsAfter(); } catch (e) { console.error('[chat scroll]', e); } }
    };
  };
  // the chat's own render, and the whole publish (render + the rail above it)
  wrap('renderGameChat');
  wrap('_gcrPublish');
  // you sent something: go to it
  ['sendGameMessage', '_gcAdd'].forEach(function (name) {
    var f = window[name];
    if (typeof f !== 'function') return;
    window[name] = function () { window._gcs.mineAt = Date.now(); return f.apply(this, arguments); };
  });
  // opening the Chat tab, or a different game: start on the newest
  ['gameDetailTab', '_showGameScreen'].forEach(function (name) {
    var f = window[name];
    if (typeof f !== 'function') return;
    window[name] = function (key) {
      var r = f.apply(this, arguments);
      if (name === '_showGameScreen') window._gcs.seen = false;
      if (name === '_showGameScreen' || key === 'chat') { window._gcs.seen = true; _gcsToBottom(); }
      return r;
    };
  });
})();
