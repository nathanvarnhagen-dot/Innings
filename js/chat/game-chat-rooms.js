// ══ PRIVATE GAME CHATS — ASK TO JOIN (v7.26.0) ════════════════════════
// A game's chat used to be one open room: open a game and you were reading
// whoever was talking about it. Now each chat belongs to the people in it.
// · Say something in a game and you've started a chat; only you see it.
// · A friend who opens that game sees "Nathan and Alex are chatting", not
//   the chat, with Ask to join (or start their own).
// · Anyone in the chat can Let in or say Not now; once in, you see the
//   whole conversation from the start.
// · Leave from the line at the top.
//
// How it's stored: no new collection, so nothing waits on a database rules
// change. Every chat event is a message in the same gameChats collection,
// shaped like the "reacted to" lines (system: true, systemType: 'room',
// text: a small JSON note — ask / cancel / ok / no / leave). Who's in which
// chat is worked out by replaying a game's messages in order:
// · a message from someone who isn't in a chat starts one (id: their uid
//   plus the message time, the same on every phone);
// · ok (from someone already in it) brings the asker in; leave takes you out;
// · everything said before rooms existed (GC_ROOMS_START) is one chat,
//   'legacy', for the people who were in it.
// A message shows to you if it was said in your chat. (The chat is hidden in
// the app; the database itself is as open as before until its rules change.)
var GC_ROOMS_START = Date.parse('2026-10-07T04:15:00Z'); // v7.26.0 went out
window._gcr = window._gcr || {};
function _gcrS(key) { return window._gcr[key] || (window._gcr[key] = { all: [], own: false, seenAsk: {}, prevMine: null, asked: false, leaveArm: 0 }); }
function _gcrMe() { var u = window.currentUser || (window.auth && window.auth.currentUser); return u ? u.uid : null; }
function _gcrMyName() { return (window.userData && window.userData.name) || 'Someone'; }
function _gcrFirst(n) { return String(n || 'Someone').trim().split(/\s+/)[0] || 'Someone'; }
function _gcrKey() { var g = window._activeBrowseGame; return g && g.gamePk != null ? String(g.gamePk) : ''; }
function _gcrList(names) {
  names = names.filter(Boolean);
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return names[0] + ' and ' + names[1];
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

// ── replay a game's messages: who's in which chat, and what you get to see
function _gcrFold(all, me) {
  var rooms = {}, where = {}, said = [], lines = [];
  var room = function (rid, founder) { return rooms[rid] || (rooms[rid] = { id: rid, founder: founder || null, legacy: rid === 'legacy', members: {}, asks: {}, no: {} }); };
  var join = function (uid, name, rid) {
    var was = where[uid];
    if (was && was !== rid && rooms[was]) delete rooms[was].members[uid];
    where[uid] = rid;
    var R = room(rid);
    R.members[uid] = name || R.members[uid] || 'Someone';
    delete R.asks[uid]; delete R.no[uid];
  };
  (all || []).forEach(function (m) {
    if (!m || !m.uid) return;
    if (m.systemType === 'room') {
      var p = null; try { p = JSON.parse(m.text || ''); } catch (e) {}
      if (!p || !p.room || !rooms[p.room]) return;
      var R = rooms[p.room], member = where[m.uid] === p.room;
      if (p.act === 'ask' && !member) { R.asks[m.uid] = { uid: m.uid, name: m.author || 'Someone', ts: m.ts || 0, m: m }; delete R.no[m.uid]; }
      else if (p.act === 'cancel') delete R.asks[m.uid];
      else if (p.act === 'ok' && member && p.who && where[p.who] !== p.room) {
        var nm = p.name || (R.asks[p.who] && R.asks[p.who].name) || 'Someone';
        join(p.who, nm, p.room);
        lines.push({ m: m, room: p.room, kind: 'ok', who: p.who, whoName: nm });
      } else if (p.act === 'no' && member && p.who) { delete R.asks[p.who]; R.no[p.who] = m.ts || 0; }
      else if (p.act === 'leave' && member) { delete R.members[m.uid]; delete where[m.uid]; lines.push({ m: m, room: p.room, kind: 'leave' }); }
      return;
    }
    // something said: from someone who isn't in a chat yet, this starts one
    if (!where[m.uid]) { var rid = (m.ts || 0) < GC_ROOMS_START ? 'legacy' : m.uid + '_' + (m.ts || 0); room(rid, m.uid); join(m.uid, m.author, rid); }
    else if (m.author) rooms[where[m.uid]].members[m.uid] = m.author;
    said.push({ m: m, room: where[m.uid] });
  });
  var mine = (me && where[me]) || null, vis = [];
  if (mine) {
    said.forEach(function (x) { if (x.room === mine) vis.push(x.m); });
    lines.forEach(function (x) {
      if (x.room !== mine) return;
      var by = x.m.uid === me ? 'You' : _gcrFirst(x.m.author), t;
      if (x.kind === 'ok') t = x.who === me ? by + ' let you in' : (x.m.uid === me ? 'You let ' : by + ' let ') + _gcrFirst(x.whoName) + ' in';
      else t = by + ' left the chat';
      vis.push(Object.assign({}, x.m, { _line: t }));
    });
    var R = rooms[mine];
    Object.keys(R.asks).forEach(function (u) { var a = R.asks[u]; vis.push(Object.assign({}, a.m, { _line: _gcrFirst(a.name) + ' asked to join', _ask: true })); });
    vis.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
  }
  return { rooms: rooms, where: where, mine: mine, visible: vis };
}

// chats with a friend in them, that you're not in
function _gcrFriendRooms(f, me) {
  var friends = {};
  (window._myFriendUids || []).forEach(function (u) { friends[u] = 1; });
  return Object.keys(f.rooms).map(function (k) { return f.rooms[k]; }).filter(function (R) {
    if (R.id === f.mine) return false;
    var us = Object.keys(R.members);
    return us.length && us.some(function (u) { return friends[u]; });
  });
}

// ── listening: the same query as before, then sorted into chats
(function () {
  if (typeof startGameChat !== 'function') return;
  startGameChat = function (gamePk) {
    var key = String(gamePk);
    if (window._gameChatStarted[key]) return;
    if (!window.db) return;
    window._gameChatStarted[key] = true;
    if (typeof _loadFriendUids === 'function') { try { Promise.resolve(_loadFriendUids()).then(function () { _gcrPublish(key); }, function () {}); } catch (e) {} }
    window.db.collection('gameChats').where('gamePk', '==', gamePk).limit(600).onSnapshot(function (snap) {
      var msgs = [];
      snap.forEach(function (doc) { msgs.push(Object.assign({ _id: doc.id }, doc.data())); });
      msgs.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
      var st = _gcrS(key); st.all = msgs; st.gamePk = gamePk;
      _gcrPublish(key);
    }, function (err) {
      console.error('Game chat error:', err);
      window._gameChatStarted[key] = false;
      if (typeof ib_toast === 'function') ib_toast('Chat unavailable — check Firestore rules');
    });
  };
})();
function _gcrPublish(key) {
  var st = _gcrS(key), me = _gcrMe(), f = _gcrFold(st.all, me);
  st.f = f;
  var vis = f.visible;
  window._gameChatRaw[key] = vis;
  if (typeof _gdlChatFilter === 'function') vis = _gdlChatFilter(key, vis);
  window._gameChatMsgs[key] = vis;
  if (_gcrKey() !== key) return;
  // you just got let in
  if (f.mine && !st.prevMine && st.asked) {
    st.asked = false; st.own = false;
    var R = f.rooms[f.mine], by = '';
    (f.visible || []).forEach(function (m) { if (m._line && / let you in$/.test(m._line)) by = m._line.replace(/ let you in$/, ''); });
    if (typeof ib_toast === 'function') ib_toast('You’re in' + (by ? ' — ' + by + ' let you in' : ''));
  }
  st.prevMine = f.mine;
  // someone wants in (while you're looking at something else)
  if (f.mine) {
    var asks = f.rooms[f.mine].asks;
    Object.keys(asks).forEach(function (u) {
      if (st.seenAsk[u + ':' + asks[u].ts]) return;
      st.seenAsk[u + ':' + asks[u].ts] = 1;
      if (st.booted && !_gcrChatShowing() && typeof ib_toast === 'function') ib_toast(_gcrFirst(asks[u].name) + ' wants to join your chat');
    });
  }
  st.booted = true;
  if (typeof renderGameChat === 'function') renderGameChat(vis);
  _gcrPaint();
}
function _gcrChatShowing() {
  var scr = document.getElementById('screen-game');
  if (!scr || !scr.classList.contains('active') || document.hidden) return false;
  if (typeof _isDesk === 'function' && _isDesk()) return true;
  var p = document.getElementById('game-chat-panel');
  return !!(p && p.style.display !== 'none' && p.offsetParent !== null);
}

// ── what you see
var GCR_LOCK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
var GCR_COLORS = ['#A89FE8', '#F2C869', '#7CF29C', '#FF9A8E', '#7FC8F8', '#E8A1F0', '#FFB86B', '#9BE8D8'];
function _gcrColor(uid) { var h = 0; String(uid || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return GCR_COLORS[h % GCR_COLORS.length]; }
function _gcrEls() {
  var panel = document.getElementById('game-chat-panel');
  if (!panel) return null;
  var lock = document.getElementById('gcr-lock'), req = document.getElementById('gcr-req');
  if (!req) { req = document.createElement('div'); req.id = 'gcr-req'; req.className = 'gcr-req'; panel.insertBefore(req, panel.firstChild); }
  if (!lock) { lock = document.createElement('div'); lock.id = 'gcr-lock'; lock.className = 'gcr-lock'; var msgs = document.getElementById('game-chat-msgs'); panel.insertBefore(lock, msgs || null); }
  return { panel: panel, lock: lock, req: req, beta: panel.querySelector('.gc-beta'), empty: document.getElementById('game-chat-empty') };
}
function _gcrState() {
  var key = _gcrKey(), st = key ? _gcrS(key) : null, f = st && st.f;
  if (!f) return null;
  var me = _gcrMe(), fr = _gcrFriendRooms(f, me);
  return { key: key, st: st, f: f, me: me, mine: f.mine ? f.rooms[f.mine] : null, friendRooms: fr, locked: !f.mine && fr.length > 0 && !st.own };
}
function _gcrPaint() {
  var E = _gcrEls(), S = _gcrState(), scr = document.getElementById('screen-game');
  if (!E || !scr) return;
  if (!S) { scr.classList.remove('gcr-locked'); E.lock.innerHTML = ''; E.req.innerHTML = ''; return; }
  var me = S.me, esc = _escapeHtml;
  scr.classList.toggle('gcr-locked', S.locked);
  // not in it: who's talking, and a way in
  if (S.locked) {
    E.lock.innerHTML = S.friendRooms.map(function (R) {
      var us = Object.keys(R.members), names = us.map(function (u) { return _gcrFirst(R.members[u]); });
      var faces = us.slice(0, 3).map(function (u, i) { return '<span class="gcr-av" style="background:' + _gcrColor(u) + (i ? ';margin-left:-10px' : '') + '">' + esc(_gcrFirst(R.members[u]).charAt(0).toUpperCase()) + '</span>'; }).join('');
      var asked = !!R.asks[me], passed = !asked && R.no[me] != null, rid = esc(R.id);
      var who = us.length === 1 ? names[0] + ' is chatting' : _gcrList(names.length > 3 ? names.slice(0, 2).concat([(names.length - 2) + ' others']) : names) + ' are chatting';
      var act = asked
        ? '<div class="gcr-wait" role="status"><div class="gcr-wt">' + GCR_LOCK.replace('width="12" height="12"', 'width="15" height="15"') + 'Asked · waiting on ' + esc(us.length === 1 ? names[0] : us.length === 2 ? names[0] + ' or ' + names[1] : 'them') + '</div><div class="gcr-ws">You’ll get a notification when you’re in.</div><button type="button" class="gcr-sec" onclick="gcrCancel(\'' + rid + '\')">Cancel request</button></div>'
        : '<button type="button" class="gcr-pri" onclick="gcrAsk(\'' + rid + '\')">' + (passed ? 'Ask again' : 'Ask to join') + '</button>' + (passed ? '<div class="gcr-ws">They didn’t let you in last time.</div>' : '');
      return '<div class="gcr-room"><div class="gcr-faces">' + faces + '</div><div class="gcr-who">' + esc(who) + '</div>' +
        '<div class="gcr-sub">Their chat is just for them. Ask, and ' + (us.length === 1 ? names[0] + ' can' : 'any of them can') + ' let you in.</div>' + act + '</div>';
    }).join('') + '<button type="button" class="gcr-sec gcr-own" onclick="gcrOwn()">Start your own chat instead</button>';
  } else E.lock.innerHTML = '';
  // in it: anyone asking, pinned to the top
  var asks = S.mine ? Object.keys(S.mine.asks).map(function (u) { return S.mine.asks[u]; }).sort(function (a, b) { return a.ts - b.ts; }) : [];
  E.req.innerHTML = asks.slice(0, 3).map(function (a) {
    var u = esc(a.uid), rid = esc(S.mine.id);
    return '<div class="gcr-ask" role="status"><span class="gcr-av sm" style="background:' + _gcrColor(a.uid) + '">' + esc(_gcrFirst(a.name).charAt(0).toUpperCase()) + '</span>' +
      '<div class="gcr-at"><b>' + esc(_gcrFirst(a.name)) + '</b> wants to join</div>' +
      '<button type="button" class="gcr-no" onclick="gcrNotNow(\'' + rid + '\',\'' + u + '\')">Not now</button>' +
      '<button type="button" class="gcr-yes" onclick="gcrLetIn(\'' + rid + '\',\'' + u + '\',this)" data-name="' + esc(a.name) + '">Let in</button></div>';
  }).join('');
  // the line at the top: who's in
  if (E.beta) {
    if (S.locked) E.beta.style.display = 'none';
    else {
      E.beta.style.display = '';
      var others = S.mine ? Object.keys(S.mine.members).filter(function (u) { return u !== me; }).map(function (u) { return _gcrFirst(S.mine.members[u]); }) : [];
      var txt = !S.mine ? 'Only people you let in can see it' : !others.length ? 'Just you so far' : others.length === 1 ? 'You and ' + others[0] : 'You, ' + _gcrList(others);
      var armed = S.st.leaveArm && Date.now() - S.st.leaveArm < 3500;
      E.beta.innerHTML = '<span class="gcr-line">' + GCR_LOCK + '<span>Private · ' + esc(txt) + '</span>' +
        (S.mine ? '<span class="gcr-dot">·</span><button type="button" class="gcr-leave" onclick="gcrLeave()">' + (armed ? 'Tap again to leave' : 'Leave') + '</button>' : '') + '</span>';
    }
  }
  if (E.empty) {
    var t = E.empty.querySelector('.gcr-et'), d = E.empty.querySelector('.gcr-ed');
    if (t) t.textContent = S.mine ? 'No messages yet' : 'Start the chat';
    if (d) d.textContent = S.mine ? 'Talk about the game right here.' : 'Only people you let in can see it. Friends who open this game can ask to join.';
  }
  if (typeof window._gdcFillHd === 'function') { try { window._gdcFillHd(); } catch (e) {} }
}
// the desktop chat header's line
function _gcrSubLine() {
  var S = _gcrState();
  if (!S) return '';
  if (S.locked) return 'Private chats';
  if (!S.mine) return 'Private · only people you let in';
  var others = Object.keys(S.mine.members).filter(function (u) { return u !== S.me; }).map(function (u) { return _gcrFirst(S.mine.members[u]); });
  return others.length ? 'Private · You' + (others.length === 1 ? ' and ' + others[0] : ', ' + _gcrList(others)) : 'Private · just you so far';
}
function _gcrFaces() {
  var S = _gcrState();
  if (!S || !S.mine) return null;
  return Object.keys(S.mine.members).filter(function (u) { return u !== S.me; }).map(function (u) { return S.mine.members[u]; });
}

// ── doing things
function _gcrPost(payload) {
  var g = window._activeBrowseGame, me = _gcrMe();
  if (!g || !me || !window.db) { if (typeof ib_toast === 'function') ib_toast('Sign in to chat'); return Promise.reject(new Error('signed out')); }
  return window.db.collection('gameChats').add({ gamePk: g.gamePk, uid: me, author: _gcrMyName(), text: JSON.stringify(payload), ts: Date.now(), system: true, systemType: 'room' })
    .catch(function (err) { console.error('[gameChats:room] ' + (err && err.code), err); if (typeof ib_toast === 'function') ib_toast('Couldn’t do that — ' + ((err && err.code) || 'try again')); throw err; });
}
function _gcrNotify(uids, type, preview) {
  var g = window._activeBrowseGame, me = _gcrMe();
  if (!g || !me || !window.db || !uids.length) return;
  var batch = window.db.batch();
  uids.forEach(function (uid) {
    if (!uid || uid === me) return;
    batch.set(window.db.collection('notifications').doc(), { toUid: uid, type: type, fromUid: me, fromName: _gcrMyName(), gamePk: g.gamePk, away: g.away || null, home: g.home || null, sport: g.sport || 'mlb', messagePreview: preview || '', ts: Date.now(), read: false });
  });
  batch.commit().catch(function (err) { console.error('[gameChats:notify ' + type + ']', err); });
}
function gcrAsk(rid) {
  var S = _gcrState(); if (!S) return;
  var R = S.f.rooms[rid]; if (!R) return;
  S.st.asked = true;
  _gcrPost({ act: 'ask', room: rid }).then(function () { _gcrNotify(Object.keys(R.members), 'game_chat_request', ''); }, function () {});
}
function gcrCancel(rid) { var S = _gcrState(); if (S) S.st.asked = false; _gcrPost({ act: 'cancel', room: rid }).catch(function () {}); }
function gcrLetIn(rid, uid, btn) {
  var name = (btn && btn.getAttribute('data-name')) || 'Someone';
  if (btn) btn.disabled = true;
  _gcrPost({ act: 'ok', room: rid, who: uid, name: name }).then(function () { _gcrNotify([uid], 'game_chat_approved', ''); }, function () { if (btn) btn.disabled = false; });
}
function gcrNotNow(rid, uid) { _gcrPost({ act: 'no', room: rid, who: uid }).catch(function () {}); }
function gcrLeave() {
  var S = _gcrState(); if (!S || !S.mine) return;
  if (!(S.st.leaveArm && Date.now() - S.st.leaveArm < 3500)) { S.st.leaveArm = Date.now(); _gcrPaint(); setTimeout(_gcrPaint, 3600); return; }
  S.st.leaveArm = 0; S.st.own = false;
  _gcrPost({ act: 'leave', room: S.mine.id }).catch(function () {});
}
function gcrOwn() {
  var S = _gcrState(); if (!S) return;
  S.st.own = true;
  _gcrPaint();
  var f = document.getElementById('game-chat-field'); if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 50);
}

// ── hooks
(function () {
  // a reaction only posts its "reacted to" line into a chat you're in
  if (typeof _gcPostPlayReaction === 'function') {
    var prevRx = _gcPostPlayReaction;
    _gcPostPlayReaction = function () { var S = _gcrState(); if (!S || !S.mine) return; return prevRx.apply(this, arguments); };
  }
  // a new message notifies the people in your chat (it used to go to friends watching)
  _notifyFriendsWatchingOfChatMessage = function (g, text) {
    var S = _gcrState(), me = _gcrMe();
    var members = S && S.mine ? Object.keys(S.mine.members).filter(function (u) { return u !== me; }) : [];
    if (!members.length) return;
    _gcrNotify(members, 'game_chat_message', String(text || '').length > 80 ? String(text).slice(0, 80) + '…' : String(text || ''));
  };
  // keep the lock, the asks and the line painted through tab switches and re-renders
  ['gameDetailTab', '_showGameScreen'].forEach(function (name) {
    var f = window[name];
    if (typeof f !== 'function') return;
    window[name] = function () { var r = f.apply(this, arguments); try { _gcrPaint(); } catch (e) {} return r; };
  });
})();
