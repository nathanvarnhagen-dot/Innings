// ══ TYPING DOTS (v7.67.0, mock "A · in-thread bubble") ════════════════════
// When someone else in your game chat is typing, a dots bubble sits where
// their message will land — their avatar and first name for one person,
// overlapping avatars and "Alex, Sam and Jordan" for a few, "Alex and 3
// others" past three. Private chats only (gameChatRooms): each member
// stamps typing.<uid> = now on the chat's doc at most every 2.5 s while
// typing and clears it on send, on an empty box, or when they leave the
// box. A stamp older than 6 s counts as stopped, so a closed app never
// leaves dots hanging.
var GTY_SEND_MS = 2500, GTY_STALE_MS = 6000;
window._gty = window._gty || { last: 0, rid: null, off: false, html: '', tick: null };

function _gtyMine() {
  var key = typeof _gcrKey === 'function' ? _gcrKey() : '';
  var st = key && window._gcr ? window._gcr[key] : null, v = st && st.view;
  if (!v || v.mode !== 'rooms' || !v.mine || v.mine.kind !== 'new') return null;
  return v.mine;
}
function _gtyWrite(rid, val) {
  var T = window._gty;
  if (T.off || !rid || !window.db || typeof _gcrMe !== 'function') return;
  var me = _gcrMe(), FV = typeof _gcrFV === 'function' ? _gcrFV() : null;
  if (!me || !FV) return;
  var upd = {};
  upd['typing.' + me] = val == null ? FV.delete() : val;
  window.db.collection('gameChatRooms').doc(rid).update(upd).catch(function (err) {
    // the database won't take it: stop trying for this session, say it once in the console
    if (err && err.code === 'permission-denied') { T.off = true; console.info('[typing] off — the gameChatRooms rules don’t allow a typing.<uid> field yet'); }
  });
}
// you're typing
function _gtyInput(inp) {
  var R = _gtyMine(), T = window._gty;
  if (!R) return;
  var has = !!(inp && inp.value.trim());
  if (!has) { _gtyStop(); return; }
  var now = Date.now();
  if (T.rid === R.id && now - T.last < GTY_SEND_MS) return;
  T.rid = R.id; T.last = now;
  _gtyWrite(R.id, now);
}
function _gtyStop() {
  var T = window._gty;
  if (!T.rid) return;
  _gtyWrite(T.rid, null);
  T.rid = null; T.last = 0;
}

// who else is typing in your chat right now
function _gtyWho() {
  var R = _gtyMine(), me = typeof _gcrMe === 'function' ? _gcrMe() : null;
  if (!R || !R.typing) return [];
  var now = Date.now(), out = [];
  Object.keys(R.typing).forEach(function (u) {
    var t = Number(R.typing[u]) || 0;
    if (u === me || !R.members[u] || now - t > GTY_STALE_MS || t - now > 60000) return;
    out.push({ uid: u, name: R.members[u], ts: t });
  });
  out.sort(function (a, b) { return a.ts - b.ts; });
  return out;
}
function _gtyHtml(who) {
  if (!who.length) return '';
  var esc = _escapeHtml, first = function (n) { return typeof _gcrFirst === 'function' ? _gcrFirst(n) : String(n || '').split(' ')[0]; };
  var ini = function (n) { return typeof _initials === 'function' ? _initials(n) : String(n || '?').charAt(0).toUpperCase(); };
  var names = who.map(function (x) { return first(x.name); });
  var label = names.length > 3 ? names[0] + ' and ' + (names.length - 1) + ' others' : (typeof _gcrList === 'function' ? _gcrList(names) : names.join(', '));
  var avs = who.slice(0, 3).map(function (x, i) {
    return '<span class="m-av gty-av gty-c' + (i % 3) + '"' + (i ? ' style="margin-left:-10px"' : '') + '>' + esc(ini(x.name)) + '</span>';
  }).join('');
  return '<div class="msg gty" role="status" aria-label="' + esc(label + (who.length > 1 ? ' are' : ' is') + ' typing') + '">' +
    '<div class="gty-avs" aria-hidden="true">' + avs + '</div>' +
    '<div class="gty-col"><span class="gty-nm" aria-hidden="true">' + esc(label) + '</span>' +
    '<span class="gty-b" aria-hidden="true"><i></i><i></i><i></i></span></div></div>';
}
function _gtyPaint() {
  var panel = document.getElementById('game-chat-panel'), msgs = document.getElementById('game-chat-msgs');
  if (!panel || !msgs) return;
  var el = document.getElementById('gc-typing');
  if (!el) { el = document.createElement('div'); el.id = 'gc-typing'; msgs.insertAdjacentElement('afterend', el); }
  var html = _gtyHtml(_gtyWho()), T = window._gty;
  if (html === T.html) return;
  // stay pinned to the bottom if you were there
  var atBottom = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 80;
  T.html = html;
  el.innerHTML = html;
  if (atBottom && html) panel.scrollTop = panel.scrollHeight;
  // while anyone's dots are up, re-check each second so they drop off on time
  if (html && !T.tick) T.tick = setInterval(function () { _gtyPaint(); if (!window._gty.html) { clearInterval(window._gty.tick); window._gty.tick = null; } }, 1000);
}

(function () {
  // the chat doc's typing map rides along with the rest of the room
  if (typeof _gcrView === 'function') {
    var prevView = _gcrView;
    _gcrView = function (key) {
      var v = prevView.apply(this, arguments), st = window._gcr && window._gcr[key];
      if (v && v.mine && v.mine.kind === 'new' && st && st.rooms) {
        for (var i = 0; i < st.rooms.length; i++) if (st.rooms[i].id === v.mine.id) { v.mine.typing = st.rooms[i].typing || {}; break; }
      }
      return v;
    };
  }
  if (typeof _gcrPaint === 'function') {
    var prevPaint = _gcrPaint;
    _gcrPaint = function () { var r = prevPaint.apply(this, arguments); try { _gtyPaint(); } catch (e) {} return r; };
  }
  // a message sent clears your dots for everyone
  if (typeof sendGameMessage === 'function') {
    var prevSend = sendGameMessage;
    sendGameMessage = function () { try { _gtyStop(); } catch (e) {} return prevSend.apply(this, arguments); };
  }
  var bind = function () {
    var inp = document.getElementById('game-chat-field');
    if (!inp || inp._gtyB) return;
    inp._gtyB = 1;
    inp.addEventListener('input', function () { _gtyInput(inp); });
    inp.addEventListener('blur', _gtyStop);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
  window.addEventListener('pagehide', _gtyStop);
  document.addEventListener('visibilitychange', function () { if (document.hidden) _gtyStop(); });
})();
