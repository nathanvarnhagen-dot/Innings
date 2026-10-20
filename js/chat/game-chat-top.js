// ══ WHO'S ON THIS GAME — the top of the Chat tab (v7.48.0) ═══════════════
// A rail above the chat with two kinds of tile:
//   · the other chats you're in on this game (a crew's, a friend's you were
//     let into) — tap one to switch the chat below to it
//   · friends watching or attending this game who aren't in the chat you're
//     in — tap to invite them (they get the same alert as an @), or to open
//     their profile when you're not in a chat
// v7.58.0: when you’re not in a chat, the chats going are the tiles (Ask in / Join)
// and the watching friends follow; the room cards below stepped aside.
// It takes over from the green "N friends watching" strip (live-feed.js),
// which stays in the code but no longer shows.
function _gctHost() {
  var panel = document.getElementById('game-chat-panel');
  if (!panel) return null;
  var host = document.getElementById('gct');
  if (!host) {
    host = document.createElement('div'); host.id = 'gct'; host.className = 'gct';
    var req = document.getElementById('gcr-req');
    if (req) req.insertAdjacentElement('afterend', host); else panel.insertBefore(host, panel.firstChild);
  }
  return host;
}
// friends on this game: anyone marked watching/attending, plus any friend in a chat
// on it (v7.48.1 — a friend who started a chat is on the game even if he never tapped Watching)
function _gctPeople(v) {
  var g = window._activeBrowseGame, W = window._gameWatchers, out = [], seen = {}, me = _gcrMe();
  if (g && W && W.gamePk == g.gamePk) (W.people || []).forEach(function (p) { if (!seen[p.uid]) { seen[p.uid] = 1; out.push(p); } });
  var friends = {}; (window._myFriendUids || []).forEach(function (u) { friends[u] = 1; });
  ((v && v.rooms) || []).forEach(function (R) {
    Object.keys(R.members || {}).forEach(function (u) {
      if (u === me || seen[u] || !friends[u]) return;
      seen[u] = 1; out.push({ uid: u, name: R.members[u] || 'A friend', first: _gcrFirst(R.members[u]) });
    });
  });
  return out;
}
// you invited them to this chat, and they haven't passed since
function _gctInvited(R, uid, me) {
  var i = R && R.invites && R.invites[uid];
  return !!(i && i.by === me && (i.ts || 0) > ((R.no && R.no[uid]) || 0));
}
// the chat on this game a friend is in, if any (the biggest, like the view does for you)
function _gctRoomOf(v, uid) {
  var hit = null;
  (v.rooms || []).forEach(function (R) { if (R.members[uid] && (!hit || Object.keys(R.members).length > Object.keys(hit.members).length)) hit = R; });
  return hit;
}
// v7.58.0: not in a chat yet — the rail is the way in. Each chat going on the
// game is a tile you ask into (or Join, when you were invited); friends who are
// only watching come after. The "Chats on this game" cards below are gone.
function _gctRoomTile(R, me, key) {
  var esc = _escapeHtml, rid = esc(R.id), m = _gcrModOf(R), modName = _gcrFirst(R.members[m]), n = Object.keys(R.members).length;
  var inv = _gcrInviteFor(R, key, me), asked = !!(R.asks && R.asks[me]), passed = !asked && R.no && R.no[me] != null;
  var title = R.crewName || modName + '’s chat';
  var sub, act, on;
  if (inv) {
    sub = _gcrFirst(inv.byName) + ' invited you';
    act = asked ? '<span class="gct-tag">Joining…</span>' : '<span class="gct-go">Join</span>';
    on = asked ? '' : 'gcrJoin(\'' + rid + '\')';
  } else if (asked) {
    sub = 'Waiting on ' + modName;
    act = '<span class="gct-tag">Asked</span>'; on = '';
  } else {
    sub = passed ? modName + ' passed last time' : n === 1 ? 'Just ' + modName + ' · ' + (R.crewName ? 'crew' : 'runs it') : n + ' in · ' + modName + ' lets you in';
    act = '<span class="gct-go">' + (passed ? 'Ask again' : 'Ask in') + '</span>'; on = 'gcrAsk(\'' + rid + '\')';
  }
  return '<button type="button" class="gct-t chat' + (inv ? ' inv' : '') + (asked ? ' wait' : '') + '"' + (on ? ' onclick="' + on + '"' : ' aria-disabled="true"') + '>' +
    '<span class="gct-faces">' + _gcrFacesHtml(R, 3, 'xs') + '</span>' +
    '<span class="gct-n">' + esc(title) + '</span><span class="gct-s">' + esc(sub) + '</span>' + act + '</button>';
}
function _gctPaintOutside(host, S) {
  var me = S.me, esc = _escapeHtml, rooms = S.friendRooms || [];
  var inRoom = {}; rooms.forEach(function (R) { Object.keys(R.members).forEach(function (u) { inRoom[u] = 1; }); });
  var people = _gctPeople(S.v).filter(function (p) { return p.uid !== me && !inRoom[p.uid]; });
  if (!rooms.length && !people.length) { host.innerHTML = ''; host.style.display = 'none'; return; }
  host.style.display = '';
  var tiles = rooms.map(function (R) { return _gctRoomTile(R, me, S.key); });
  people.forEach(function (p) {
    tiles.push('<button type="button" class="gct-t lite" onclick="openUserProfile(\'' + esc(p.uid) + '\')">' +
      '<span class="gct-faces"><span class="gcr-av xs" style="background:' + _gcrColor(p.uid) + '">' + esc(_gcrFirst(p.name).charAt(0).toUpperCase()) + '</span></span>' +
      '<span class="gct-n">' + esc(_gcrFirst(p.name)) + '</span><span class="gct-s">Watching · no chat</span><span class="gct-tag dim">Profile</span></button>');
  });
  var ct = (rooms.length ? rooms.length + ' chat' + (rooms.length === 1 ? '' : 's') + ' going' : '') + (rooms.length && people.length ? ' · ' : '') + (people.length ? people.length + ' watching' : '');
  host.innerHTML = '<div class="gct-hd"><span class="gcr-hd">On this game</span><span class="gct-ct">' + ct + '</span></div>' +
    '<div class="gct-rail">' + tiles.join('') + '</div>';
}
function _gctPaint() {
  var host = _gctHost();
  if (!host) return;
  var S = typeof _gcrState === 'function' ? _gcrState() : null, me = S && S.me, esc = _escapeHtml;
  if (!S || !me || !S.v) { host.innerHTML = ''; host.style.display = 'none'; return; }
  var v = S.v, mine = S.mine;
  if (!mine) { _gctPaintOutside(host, S); return; }
  var others = (v.rooms || []).filter(function (R) { return R !== mine && R.members[me] && Object.keys(R.members).length > 1; });
  var people = _gctPeople(v).filter(function (p) { return p.uid !== me && !(mine && mine.members[p.uid]); });
  if (!others.length && !people.length) { host.innerHTML = ''; host.style.display = 'none'; return; }
  host.style.display = '';
  var tiles = [];
  others.forEach(function (R) {
    var n = Object.keys(R.members).length;
    tiles.push('<button type="button" class="gct-t chat" onclick="gctSwitch(\'' + esc(R.id) + '\')">' +
      '<span class="gct-faces">' + _gcrFacesHtml(R, 3, 'xs') + '</span>' +
      '<span class="gct-n">' + esc(_gcrRoomTitle(R, me)) + '</span>' +
      '<span class="gct-s">' + n + ' in</span><span class="gct-go alt">Switch</span></button>');
  });
  people.forEach(function (p) {
    var R = _gctRoomOf(v, p.uid), uid = esc(p.uid);
    var where = R ? (R.crewName || _gcrFirst(R.members[_gcrModOf(R)]) + '’s chat') + (R.asks && R.asks[me] ? ' · you asked in' : '') : null;
    var inv = mine && _gctInvited(mine, p.uid, me), asked = !!(mine && mine.asks && mine.asks[p.uid]);
    var canInvite = mine && !inv && !asked;
    var act = !mine ? '' : asked ? '<span class="gct-tag">Wants in</span>' : inv ? '<span class="gct-tag">Invited</span>' : '<span class="gct-go">Invite</span>';
    var on = canInvite ? 'gctInvite(\'' + uid + '\',' + JSON.stringify(String(p.name || 'A friend')).replace(/"/g, '&quot;') + ')' : 'openUserProfile(\'' + uid + '\')';
    tiles.push('<button type="button" class="gct-t" onclick="' + on + '">' +
      '<span class="gct-faces"><span class="gcr-av xs" style="background:' + _gcrColor(p.uid) + '">' + esc(_gcrFirst(p.name).charAt(0).toUpperCase()) + '</span></span>' +
      '<span class="gct-n">' + esc(_gcrFirst(p.name)) + '</span>' +
      '<span class="gct-s">' + esc(where ? 'In ' + where : 'Watching') + '</span>' + act + '</button>');
  });
  var n = others.length + people.length;
  host.innerHTML = '<div class="gct-hd"><span class="gcr-hd">On this game</span><span class="gct-ct">' +
    (others.length ? others.length + ' other chat' + (others.length === 1 ? '' : 's') : '') + (others.length && people.length ? ' · ' : '') +
    (people.length ? people.length + ' friend' + (people.length === 1 ? '' : 's') + (mine ? ' not in yours' : ' watching') : '') + '</span></div>' +
    '<div class="gct-rail">' + tiles.join('') + '</div>';
}
// switch the chat below to another one you're in on this game
function gctSwitch(rid) {
  var key = typeof _gcrKey === 'function' ? _gcrKey() : '';
  if (!key) return;
  var st = _gcrS(key), R = _gcrFindRoom(rid);
  if (!R) return;
  st.pickRoom = rid;
  _gcrPublish(key);
  if (typeof ib_toast === 'function') ib_toast('Now in ' + _gcrRoomTitle(R, _gcrMe()));
  var msgs = document.getElementById('game-chat-msgs');
  if (msgs && msgs.lastElementChild) { try { msgs.lastElementChild.scrollIntoView({ block: 'end' }); } catch (e) {} }
}
// invite a friend who's on the game into the chat you're in — same path as an @
function gctInvite(uid, name) {
  var S = _gcrState(), me = _gcrMe(), g = window._activeBrowseGame;
  if (!S || !S.mine || !me || !g || !uid) return;
  var mine = S.mine, now = Date.now(), first = _gcrFirst(name);
  mine.invites = mine.invites || {};
  mine.invites[uid] = { by: me, byName: _gcrMyName(), name: name || 'A friend', ts: now };
  _gctPaint();
  _gcrNotify([uid], 'game_chat_mention', 'Join ' + _gcrFirst(_gcrMyName()) + '’s chat on ' + (g.away && g.home ? g.away + ' @ ' + g.home : 'the game'), { roomId: mine.id, invite: true, atTs: now }, g);
  var FV = _gcrFV();
  if (mine.kind === 'new' && FV && window.db) {
    var upd = {}; upd['invites.' + uid] = { by: me, byName: _gcrMyName(), name: name || 'A friend', ts: now };
    _gcrRoomRef(mine.id).update(upd).catch(function (err) { console.info('[game chat] invitation not noted on the chat (' + ((err && err.code) || err) + ') — the alert still carries it'); });
  }
  if (typeof ib_toast === 'function') ib_toast(first + ' invited — they can join from the alert');
}
(function () {
  // repaint with the chat, and whenever the friends-on-this-game lookup lands
  if (typeof _gcrPaint === 'function') {
    var prevPaint = _gcrPaint;
    _gcrPaint = function () { var r = prevPaint.apply(this, arguments); try { _gctPaint(); } catch (e) { console.error('[chat top] paint', e); } return r; };
  }
  if (typeof _renderGameWatchers === 'function') {
    var prevW = _renderGameWatchers;
    _renderGameWatchers = function (gamePk) {
      var r = prevW.apply(this, arguments);
      var strip = document.getElementById('game-chat-watchers');
      if (strip) strip.style.display = 'none';
      try { _gctPaint(); } catch (e) { console.error('[chat top] watchers', e); }
      return r;
    };
  }
})();
