// ══ PRIVATE GAME CHATS — ASK TO JOIN (v7.26.0, locked down v7.27.0) ═══
// Each game chat belongs to the people in it.
// · Say something in a game and you've started a chat; only you see it.
// · A friend who opens that game sees "Nathan and Alex are chatting", not
//   the chat, with Ask to join (or start their own).
// · Anyone in the chat can Let in or say Not now; once in, you see the
//   whole conversation from the start.
// · Leave from the line at the top (tap twice).
//
// Two ways it's stored, and the app picks by what the database allows:
//
// 1. Private chats (v7.27.0, once the gameChatRooms rules are published).
//    gameChatRooms/<id>: { pk, gamePk, members: [uid], names: {uid: name},
//    asks: {uid: {name, ts}}, no: {uid: ts}, replayOf, founder, createdAt },
//    and its messages in gameChatRooms/<id>/messages. The rules let only
//    members read or write the messages, so the chat is private in the
//    database too, not just hidden in the app.
//
// 2. Until then (v7.26.0): everything sits in the open gameChats collection.
//    Chat events are messages shaped like the "reacted to" lines (system:
//    true, systemType: 'room', text: a small JSON note — ask / cancel / ok /
//    no / leave), and who's in which chat is worked out by replaying a
//    game's messages in order: a message from someone not in a chat starts
//    one (id: their uid + the message time); ok brings the asker in; leave
//    takes you out; everything said before GC_ROOMS_START is one chat,
//    'legacy', for the people who were in it.
//
// Once (1) is on, (2) is still read for what was said before: your chat's
// old messages show above the new ones, and the first time someone in an
// old chat opens the game it gets a gameChatRooms doc of its own (replayOf
// = its old id), with the same people in it.
var GC_ROOMS_START = Date.parse('2026-10-07T04:15:00Z'); // v7.26.0 went out
window._gcr = window._gcr || {};
function _gcrS(key) {
  return window._gcr[key] || (window._gcr[key] = { all: [], mode: null, rooms: [], rmsgs: {}, listenRid: null, runsub: null, migrating: {}, carried: {}, own: false, seenAsk: {}, prevMine: null, asked: false, leaveArm: 0 });
}
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
function _gcrFV() { return (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) || null; }
function _gcrJson(t) { try { var p = JSON.parse(t || ''); return p && typeof p === 'object' ? p : null; } catch (e) { return null; } }
// "Nathan let Sarah in" — from whoever's reading it
function _gcrLineText(act, byUid, byName, who, whoName, me) {
  var by = byUid === me ? 'You' : _gcrFirst(byName);
  if (act === 'ok') return who === me ? by + ' let you in' : (byUid === me ? 'You let ' : by + ' let ') + _gcrFirst(whoName) + ' in';
  if (act === 'leave') return by + ' left the chat';
  return '';
}

// ── (2) replay a game's open messages: who's in which chat
function _gcrFold(all, me) {
  var rooms = {}, where = {}, said = [], lines = [];
  var room = function (rid, founder) { return rooms[rid] || (rooms[rid] = { id: rid, kind: 'old', founder: founder || null, legacy: rid === 'legacy', members: {}, asks: {}, no: {} }); };
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
      var p = _gcrJson(m.text);
      if (!p || !p.room || !rooms[p.room]) return;
      var R = rooms[p.room], member = where[m.uid] === p.room;
      if (p.act === 'ask' && !member) { R.asks[m.uid] = { uid: m.uid, name: m.author || 'Someone', ts: m.ts || 0, m: m }; delete R.no[m.uid]; }
      else if (p.act === 'cancel') delete R.asks[m.uid];
      else if (p.act === 'ok' && member && p.who && where[p.who] !== p.room) {
        var nm = p.name || (R.asks[p.who] && R.asks[p.who].name) || 'Someone';
        join(p.who, nm, p.room);
        lines.push({ m: m, room: p.room, act: 'ok', who: p.who, whoName: nm });
      } else if (p.act === 'no' && member && p.who) { delete R.asks[p.who]; R.no[p.who] = m.ts || 0; }
      else if (p.act === 'leave' && member) { delete R.members[m.uid]; delete where[m.uid]; lines.push({ m: m, room: p.room, act: 'leave' }); }
      return;
    }
    // something said: from someone who isn't in a chat yet, this starts one
    if (!where[m.uid]) { var rid = (m.ts || 0) < GC_ROOMS_START ? 'legacy' : m.uid + '_' + (m.ts || 0); room(rid, m.uid); join(m.uid, m.author, rid); }
    else if (m.author) rooms[where[m.uid]].members[m.uid] = m.author;
    said.push({ m: m, room: where[m.uid] });
  });
  return { rooms: rooms, where: where, mine: (me && where[me]) || null, said: said, lines: lines };
}
// an old chat's messages and its "let in / left" lines
function _gcrOldItems(f, rid, me) {
  var out = [];
  if (!rid) return out;
  f.said.forEach(function (x) { if (x.room === rid) out.push(x.m); });
  f.lines.forEach(function (x) { if (x.room === rid) out.push(Object.assign({}, x.m, { _line: _gcrLineText(x.act, x.m.uid, x.m.author, x.who, x.whoName, me) })); });
  return out;
}
function _gcrAskItems(R) {
  return Object.keys(R.asks || {}).map(function (u) {
    var a = R.asks[u];
    return { _id: 'ask:' + u + ':' + (a.ts || 0), uid: u, author: a.name, ts: a.ts || 0, systemType: 'room', _line: _gcrFirst(a.name) + ' asked to join', _ask: true };
  });
}

// ── the chats you can see, which one is yours, and what's in it
function _gcrView(key) {
  var st = _gcrS(key), me = _gcrMe(), f0 = _gcrFold(st.all, me), list = [], mine = null, vis = [];
  if (st.mode !== 'rooms') {
    Object.keys(f0.rooms).forEach(function (k) { list.push(f0.rooms[k]); });
    mine = f0.mine ? f0.rooms[f0.mine] : null;
    if (mine) vis = _gcrOldItems(f0, mine.id, me).concat(_gcrAskItems(mine));
  } else {
    var byOld = {};
    (st.rooms || []).forEach(function (d) {
      var names = d.names || {}, members = {};
      (d.members || []).forEach(function (u) { members[u] = names[u] || 'Someone'; });
      var R = { id: d.id, kind: 'new', members: members, asks: d.asks || {}, no: d.no || {}, replayOf: d.replayOf || null };
      if (R.replayOf) byOld[R.replayOf] = R;
      list.push(R);
    });
    // old chats nobody has moved over yet
    Object.keys(f0.rooms).forEach(function (k) { if (!byOld[k] && Object.keys(f0.rooms[k].members).length) list.push(f0.rooms[k]); });
    // in more than one (let into a friend's chat while you had your own): the bigger one is yours
    var inNew = list.filter(function (R) { return R.kind === 'new' && R.members[me]; }).sort(function (a, b) { return Object.keys(b.members).length - Object.keys(a.members).length; });
    mine = inNew[0] || null;
    st.extraRooms = inNew.slice(1).filter(function (R) { return Object.keys(R.members).length === 1; }).map(function (R) { return R.id; });
    if (!mine && f0.mine && !byOld[f0.mine]) mine = f0.rooms[f0.mine];
    if (mine) {
      vis = _gcrOldItems(f0, mine.kind === 'new' ? mine.replayOf : mine.id, me);
      if (mine.kind === 'new') {
        (st.rmsgs[mine.id] || []).forEach(function (m) {
          if (m.systemType !== 'room') { vis.push(m); return; }
          var p = _gcrJson(m.text);
          if (p) vis.push(Object.assign({}, m, { _line: _gcrLineText(p.act, m.uid, m.author, p.who, p.name, me) }));
        });
      }
      vis = vis.concat(_gcrAskItems(mine));
    }
  }
  vis = vis.filter(function (m) { return m.systemType !== 'room' || m._line; });
  vis.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
  return { mode: st.mode === 'rooms' ? 'rooms' : 'replay', f0: f0, rooms: list, mine: mine, visible: vis };
}
// chats with a friend in them, that you're not in
function _gcrFriendRooms(v) {
  var friends = {};
  (window._myFriendUids || []).forEach(function (u) { friends[u] = 1; });
  return v.rooms.filter(function (R) {
    if (R === v.mine) return false;
    var us = Object.keys(R.members);
    return us.length && us.some(function (u) { return friends[u]; });
  });
}

// ── listening
(function () {
  if (typeof startGameChat !== 'function') return;
  startGameChat = function (gamePk) {
    var key = String(gamePk);
    if (window._gameChatStarted[key]) return;
    if (!window.db) return;
    window._gameChatStarted[key] = true;
    var st = _gcrS(key); st.gamePk = gamePk;
    if (typeof _loadFriendUids === 'function') { try { Promise.resolve(_loadFriendUids()).then(function () { _gcrPublish(key); }, function () {}); } catch (e) {} }
    // everything said in the open (all of it, before private chats)
    window.db.collection('gameChats').where('gamePk', '==', gamePk).limit(600).onSnapshot(function (snap) {
      var msgs = [];
      snap.forEach(function (doc) { msgs.push(Object.assign({ _id: doc.id }, doc.data())); });
      msgs.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
      st.all = msgs;
      _gcrPublish(key);
    }, function (err) {
      console.error('Game chat error:', err);
      window._gameChatStarted[key] = false;
      if (typeof ib_toast === 'function') ib_toast('Chat unavailable — check Firestore rules');
    });
    // the private chats — if the database lets us, they're on
    window.db.collection('gameChatRooms').where('pk', '==', key).onSnapshot(function (snap) {
      var rooms = [];
      snap.forEach(function (doc) { rooms.push(Object.assign({ id: doc.id }, doc.data())); });
      st.mode = 'rooms'; st.rooms = rooms;
      _gcrPublish(key);
    }, function (err) {
      if (st.mode !== 'replay') console.info('[game chat] private chats are off until the gameChatRooms rules are published (' + ((err && err.code) || err) + ')');
      st.mode = 'replay';
      _gcrPublish(key);
    });
  };
})();
function _gcrListenRoom(key, rid) {
  var st = _gcrS(key);
  if (st.listenRid === rid) return;
  if (st.runsub) { try { st.runsub(); } catch (e) {} st.runsub = null; }
  st.listenRid = rid;
  if (!rid || !window.db) return;
  st.runsub = window.db.collection('gameChatRooms').doc(rid).collection('messages').limit(600).onSnapshot(function (snap) {
    var arr = [];
    snap.forEach(function (doc) { arr.push(Object.assign({ _id: doc.id, _col: 'gameChatRooms/' + rid + '/messages' }, doc.data())); });
    st.rmsgs[rid] = arr;
    _gcrPublish(key);
  }, function (err) {
    console.error('[game chat] room messages', err);
    if (st.listenRid === rid) { st.listenRid = null; st.runsub = null; }
  });
}
function _gcrPublish(key) {
  var st = _gcrS(key), v = _gcrView(key);
  st.view = v;
  var vis = v.visible;
  window._gameChatRaw[key] = vis;
  if (typeof _gdlChatFilter === 'function') vis = _gdlChatFilter(key, vis);
  window._gameChatMsgs[key] = vis;
  if (v.mode === 'rooms') _gcrEnsure(key, v);
  if (_gcrKey() !== key) return;
  // you just got let in
  if (v.mine && !st.prevMine && st.asked) {
    st.asked = false; st.own = false;
    var by = '';
    v.visible.forEach(function (m) { if (m._line && / let you in$/.test(m._line)) by = m._line.replace(/ let you in$/, ''); });
    if (typeof ib_toast === 'function') ib_toast('You’re in' + (by ? ' — ' + by + ' let you in' : ''));
  }
  st.prevMine = v.mine ? v.mine.id : null;
  // someone wants in (while you're looking at something else)
  if (v.mine) Object.keys(v.mine.asks || {}).forEach(function (u) {
    var a = v.mine.asks[u], k = u + ':' + (a.ts || 0);
    if (st.seenAsk[k]) return;
    st.seenAsk[k] = 1;
    if (st.booted && !_gcrChatShowing() && typeof ib_toast === 'function') ib_toast(_gcrFirst(a.name) + ' wants to join your chat');
  });
  st.booted = true;
  if (typeof renderGameChat === 'function') renderGameChat(vis);
  _gcrPaint();
}
// private chats on: move your old chat over, carry over old-style asks, listen to yours
function _gcrEnsure(key, v) {
  var st = _gcrS(key), me = _gcrMe(), f0 = v.f0;
  if (!me) return;
  if (v.mine && v.mine.kind === 'old') _gcrMigrate(key, v.mine.id).catch(function () {});
  // a chat that was only you, left behind when someone let you into theirs
  var FV = _gcrFV();
  (st.extraRooms || []).forEach(function (rid) {
    if (!FV || st.migrating['x:' + rid]) return;
    st.migrating['x:' + rid] = 1;
    window.db.collection('gameChatRooms').doc(rid).update({ members: FV.arrayRemove(me) }).catch(function (err) { console.error('[game chat] leave old solo chat', err); });
  });
  if (v.mine && v.mine.kind === 'new' && v.mine.replayOf && f0.rooms[v.mine.replayOf] && window.db) {
    var old = f0.rooms[v.mine.replayOf].asks, upd = {}, n = 0;
    Object.keys(old).forEach(function (u) {
      var a = old[u], k = u + ':' + a.ts;
      if (v.mine.members[u] || v.mine.asks[u] || (v.mine.no[u] && v.mine.no[u] >= a.ts) || st.carried[k]) return;
      st.carried[k] = 1; upd['asks.' + u] = { name: a.name, ts: a.ts }; n++;
    });
    if (n) window.db.collection('gameChatRooms').doc(v.mine.id).update(upd).catch(function (err) { console.error('[game chat] carry asks', err); });
  }
  _gcrListenRoom(key, v.mine && v.mine.kind === 'new' ? v.mine.id : null);
}
function _gcrDocId(key, rid) { return key + '__' + String(rid).replace(/[^A-Za-z0-9_-]/g, '_'); }
// an old chat gets its own private doc, with the same people in it
function _gcrMigrate(key, rid) {
  var st = _gcrS(key), v = st.view, me = _gcrMe(), R = v && v.f0.rooms[rid];
  if (!R || !window.db) return Promise.reject(new Error('no chat'));
  if (st.migrating[rid]) return st.migrating[rid];
  var id = _gcrDocId(key, rid), ref = window.db.collection('gameChatRooms').doc(id);
  st.migrating[rid] = ref.get().then(function (d) {
    if (d.exists) return (d.data().members || []).indexOf(me) >= 0 ? id : _gcrNewRoom(key);
    var asks = {};
    Object.keys(R.asks).forEach(function (u) { asks[u] = { name: R.asks[u].name, ts: R.asks[u].ts }; });
    return ref.set({ pk: key, gamePk: st.gamePk != null ? st.gamePk : key, replayOf: rid, founder: me, members: Object.keys(R.members), names: R.members, asks: asks, no: {}, createdAt: Date.now() }).then(function () { return id; });
  }).catch(function (err) { console.error('[game chat] move old chat', err); st.migrating[rid] = null; throw err; });
  return st.migrating[rid];
}
function _gcrNewRoom(key) {
  var st = _gcrS(key), me = _gcrMe(), id = _gcrDocId(key, me + '_' + Date.now()), names = {};
  names[me] = _gcrMyName();
  return window.db.collection('gameChatRooms').doc(id).set({ pk: key, gamePk: st.gamePk != null ? st.gamePk : key, replayOf: null, founder: me, members: [me], names: names, asks: {}, no: {}, createdAt: Date.now() }).then(function () { return id; });
}
// every message goes here (game-chat.js, pitch-talk.js, memory-ticket.js call _gcAdd)
_gcAdd = function (data) {
  var key = _gcrKey(), st = key ? _gcrS(key) : null, v = st && st.view;
  if (!v || v.mode !== 'rooms') return window.db.collection('gameChats').add(data);
  var p = v.mine && v.mine.kind === 'new' ? Promise.resolve(v.mine.id) : v.mine ? _gcrMigrate(key, v.mine.id) : _gcrNewRoom(key);
  return p.then(function (rid) { return window.db.collection('gameChatRooms').doc(rid).collection('messages').add(data); });
};
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
  var key = _gcrKey(), st = key ? _gcrS(key) : null, v = st && st.view;
  if (!v) return null;
  var fr = _gcrFriendRooms(v);
  return { key: key, st: st, v: v, me: _gcrMe(), mine: v.mine, friendRooms: fr, locked: !v.mine && fr.length > 0 && !st.own };
}
function _gcrFindRoom(rid) { var S = _gcrState(); if (!S) return null; var hit = null; S.v.rooms.forEach(function (R) { if (R.id === rid) hit = R; }); return hit; }
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
      var asked = !!(R.asks && R.asks[me]), passed = !asked && R.no && R.no[me] != null, rid = esc(R.id);
      var who = us.length === 1 ? names[0] + ' is chatting' : _gcrList(names.length > 3 ? names.slice(0, 2).concat([(names.length - 2) + ' others']) : names) + ' are chatting';
      var act = asked
        ? '<div class="gcr-wait" role="status"><div class="gcr-wt">' + GCR_LOCK.replace('width="12" height="12"', 'width="15" height="15"') + 'Asked · waiting on ' + esc(us.length === 1 ? names[0] : us.length === 2 ? names[0] + ' or ' + names[1] : 'them') + '</div><div class="gcr-ws">You’ll get a notification when you’re in.</div><button type="button" class="gcr-sec" onclick="gcrCancel(\'' + rid + '\')">Cancel request</button></div>'
        : '<button type="button" class="gcr-pri" onclick="gcrAsk(\'' + rid + '\')">' + (passed ? 'Ask again' : 'Ask to join') + '</button>' + (passed ? '<div class="gcr-ws">They didn’t let you in last time.</div>' : '');
      return '<div class="gcr-room"><div class="gcr-faces">' + faces + '</div><div class="gcr-who">' + esc(who) + '</div>' +
        '<div class="gcr-sub">Their chat is just for them. Ask, and ' + (us.length === 1 ? names[0] + ' can' : 'any of them can') + ' let you in.</div>' + act + '</div>';
    }).join('') + '<button type="button" class="gcr-sec gcr-own" onclick="gcrOwn()">Start your own chat instead</button>';
  } else E.lock.innerHTML = '';
  // in it: anyone asking, pinned to the top
  var asks = S.mine ? Object.keys(S.mine.asks || {}).map(function (u) { return Object.assign({ uid: u }, S.mine.asks[u]); }).sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); }) : [];
  E.req.innerHTML = asks.slice(0, 3).map(function (a) {
    var u = esc(a.uid), rid = esc(S.mine.id);
    return '<div class="gcr-ask" role="status"><span class="gcr-av sm" style="background:' + _gcrColor(a.uid) + '">' + esc(_gcrFirst(a.name).charAt(0).toUpperCase()) + '</span>' +
      '<div class="gcr-at"><b>' + esc(_gcrFirst(a.name)) + '</b> wants to join</div>' +
      '<button type="button" class="gcr-no" onclick="gcrNotNow(\'' + rid + '\',\'' + u + '\')">Not now</button>' +
      '<button type="button" class="gcr-yes" onclick="gcrLetIn(\'' + rid + '\',\'' + u + '\',this)" data-name="' + esc(a.name || 'Someone') + '">Let in</button></div>';
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
function _gcrPostOld(payload) {
  var g = window._activeBrowseGame, me = _gcrMe();
  if (!g || !me || !window.db) { if (typeof ib_toast === 'function') ib_toast('Sign in to chat'); return Promise.reject(new Error('signed out')); }
  return window.db.collection('gameChats').add({ gamePk: g.gamePk, uid: me, author: _gcrMyName(), text: JSON.stringify(payload), ts: Date.now(), system: true, systemType: 'room' });
}
function _gcrPostLine(rid, payload) {
  var g = window._activeBrowseGame, me = _gcrMe();
  return window.db.collection('gameChatRooms').doc(rid).collection('messages').add({ gamePk: g ? g.gamePk : null, uid: me, author: _gcrMyName(), text: JSON.stringify(payload), ts: Date.now(), system: true, systemType: 'room' });
}
function _gcrRoomRef(rid) { return window.db.collection('gameChatRooms').doc(rid); }
function _gcrFail(err) { console.error('[game chat] ' + ((err && err.code) || ''), err); if (typeof ib_toast === 'function') ib_toast('Couldn’t do that — ' + ((err && err.code) || 'try again')); }
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
  var S = _gcrState(), R = _gcrFindRoom(rid), me = _gcrMe();
  if (!S || !R || !me) return;
  S.st.asked = true;
  var done = function () { _gcrNotify(Object.keys(R.members), 'game_chat_request', ''); };
  if (R.kind === 'new') { var upd = {}; upd['asks.' + me] = { name: _gcrMyName(), ts: Date.now() }; _gcrRoomRef(rid).update(upd).then(done, _gcrFail); }
  else _gcrPostOld({ act: 'ask', room: rid }).then(done, _gcrFail);
}
function gcrCancel(rid) {
  var S = _gcrState(), R = _gcrFindRoom(rid), me = _gcrMe(), FV = _gcrFV();
  if (S) S.st.asked = false;
  if (!R) return;
  if (R.kind === 'new' && FV) { var upd = {}; upd['asks.' + me] = FV.delete(); _gcrRoomRef(rid).update(upd).catch(_gcrFail); }
  else _gcrPostOld({ act: 'cancel', room: rid }).catch(_gcrFail);
}
function gcrLetIn(rid, uid, btn) {
  var R = _gcrFindRoom(rid), FV = _gcrFV(), name = (btn && btn.getAttribute('data-name')) || 'Someone';
  if (!R) return;
  if (btn) btn.disabled = true;
  var done = function () { _gcrNotify([uid], 'game_chat_approved', ''); };
  var undo = function (err) { if (btn) btn.disabled = false; _gcrFail(err); };
  if (R.kind === 'new' && FV) {
    var upd = { members: FV.arrayUnion(uid) };
    upd['names.' + uid] = name; upd['asks.' + uid] = FV.delete();
    _gcrRoomRef(rid).update(upd).then(function () { return _gcrPostLine(rid, { act: 'ok', who: uid, name: name }); }).then(done, undo);
  } else _gcrPostOld({ act: 'ok', room: rid, who: uid, name: name }).then(done, undo);
}
function gcrNotNow(rid, uid) {
  var R = _gcrFindRoom(rid), FV = _gcrFV();
  if (!R) return;
  if (R.kind === 'new' && FV) { var upd = {}; upd['asks.' + uid] = FV.delete(); upd['no.' + uid] = Date.now(); _gcrRoomRef(rid).update(upd).catch(_gcrFail); }
  else _gcrPostOld({ act: 'no', room: rid, who: uid }).catch(_gcrFail);
}
function gcrLeave() {
  var S = _gcrState(), FV = _gcrFV();
  if (!S || !S.mine) return;
  if (!(S.st.leaveArm && Date.now() - S.st.leaveArm < 3500)) { S.st.leaveArm = Date.now(); _gcrPaint(); setTimeout(_gcrPaint, 3600); return; }
  S.st.leaveArm = 0; S.st.own = false;
  var R = S.mine;
  if (R.kind === 'new' && FV) _gcrPostLine(R.id, { act: 'leave' }).then(function () { return _gcrRoomRef(R.id).update({ members: FV.arrayRemove(S.me) }); }).catch(_gcrFail);
  else _gcrPostOld({ act: 'leave', room: R.id }).catch(_gcrFail);
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
