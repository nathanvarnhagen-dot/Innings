// ══ CREWS — a standing group you bring into any game's chat (v7.44.0) ═══
// · Make a crew once under Friends: a name and which friends are in it. A
//   crew is a list, not a chat — it only talks when it's brought into a game.
// · Every game's Chat tab shows your crews as tiles (with how many of them
//   are on this game already). Tap Start and a private game chat opens
//   (js/chat/game-chat-rooms.js) named after the crew, with you running it.
// · Everyone in the crew gets "Nate started Baseball Nerds for MIL @ LAD".
//   Tapping it opens the game on Chat with Join. Nobody has to let them in.
// · Whoever joins sees the chat from the moment they join, never before —
//   the room's joined[uid] is their join time, the same way an ask works.
//
// Stored: crews/<id> { owner, name, members: [uid] (owner included),
// names: {uid: name}, createdAt, updatedAt }. The room it starts carries
// crewId + crewName and an invite per member (invites.<uid>.crew = true).
window._crews = window._crews || { list: [], on: false, unsub: null, edit: null, starting: {}, ready: false };
var CREW_MAX = 24;
function _crwMe() { return (typeof _gcrMe === 'function' && _gcrMe()) || null; }
function _crwName() { return (window.userData && window.userData.name) || 'Someone'; }
function _crwFirst(n) { return String(n || 'Someone').trim().split(/\s+/)[0] || 'Someone'; }
function _crwEsc(s) { return typeof _escapeHtml === 'function' ? _escapeHtml(s) : String(s == null ? '' : s); }
function _crwColor(uid) { return typeof _gcrColor === 'function' ? _gcrColor(uid) : '#A89FE8'; }
function _crwToast(m) { if (typeof ib_toast === 'function') ib_toast(m); }
function _crwFV() { return (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) || null; }

// ── your crews, live
function crwListen() {
  var me = _crwMe(), C = window._crews;
  if (!me || !window.db || C.on === me) return;
  if (C.unsub) { try { C.unsub(); } catch (e) {} }
  C.on = me;
  C.unsub = window.db.collection('crews').where('members', 'array-contains', me).onSnapshot(function (snap) {
    var list = [];
    snap.forEach(function (d) { list.push(Object.assign({ id: d.id }, d.data())); });
    list.sort(function (a, b) { return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0); });
    C.list = list; C.ready = true;
    _crwPaintFriends(); _crwPaintChat();
  }, function (err) {
    C.on = false; C.ready = true;
    console.info('[crews] off until the crews rules are published (' + ((err && err.code) || err) + ')');
    _crwPaintFriends(); _crwPaintChat();
  });
}
function _crwMine() { var me = _crwMe(); return window._crews.list.filter(function (c) { return c.owner === me; }); }
function _crwFind(id) { var hit = null; window._crews.list.forEach(function (c) { if (c.id === id) hit = c; }); return hit; }
function _crwFaces(c, n) {
  var me = _crwMe(), us = (c.members || []).filter(function (u) { return u !== me; });
  return us.slice(0, n).map(function (u, i) {
    return '<span class="crw-av" style="background:' + _crwColor(u) + (i ? ';margin-left:-9px' : '') + '">' + _crwEsc(_crwFirst((c.names || {})[u]).charAt(0).toUpperCase()) + '</span>';
  }).join('') + (us.length > n ? '<span class="crw-av more" style="margin-left:-9px">+' + (us.length - n) + '</span>' : '');
}

// ── Friends: the section
function _crwFriendsHost() {
  var host = document.getElementById('glf-crews');
  if (host) return host;
  var after = document.getElementById('glf-friends') || document.getElementById('my-friends-empty');
  if (!after) return null;
  host = document.createElement('div'); host.id = 'glf-crews'; host.className = 'gl-sec crw-sec';
  if (after.id === 'glf-friends') after.parentNode.insertBefore(host, after.nextSibling);
  else after.parentNode.insertBefore(host, after.nextSibling);
  return host;
}
function _crwPaintFriends() {
  var host = _crwFriendsHost(), me = _crwMe();
  if (!host) return;
  var C = window._crews, esc = _crwEsc;
  var rows = C.list.map(function (c) {
    var n = (c.members || []).length, own = c.owner === me;
    var sub = own ? n + ' of you' : 'By ' + esc(_crwFirst((c.names || {})[c.owner])) + ' · ' + n + ' of you';
    return '<button type="button" class="gl-row crw-row" onclick="crwOpen(\'' + esc(c.id) + '\')"><span class="crw-faces">' + _crwFaces(c, 3) + '</span>' +
      '<span class="tx"><b>' + esc(c.name || 'Crew') + '</b><small>' + sub + '</small></span><span class="crw-chev">›</span></button>';
  }).join('');
  host.innerHTML = '<div class="crw-hd"><div class="sec-title" style="margin-bottom:0">Crews</div><div class="crw-add" onclick="crwNew()">+ New</div></div>' +
    (rows || '<div class="crw-empty"><div>No crews yet. A crew is a group of friends you can bring into any game’s chat with one tap — everyone in it gets the call.</div>' +
      '<button type="button" class="crw-mk" onclick="crwNew()">+ Make a crew</button></div>');
}

// ── make / edit
function crwNew() { _crwEditOpen(null); }
// v7.44.1: from a game's Chat tab — Create makes the crew and starts it on this game right away
function crwNewHere() { _crwEditOpen(null); if (window._crews.edit) window._crews.edit.startHere = !!window._activeBrowseGame; }
function crwOpen(id) { _crwEditOpen(_crwFind(id)); }
function _crwEditOpen(c) {
  var me = _crwMe();
  if (!me) { _crwToast('Sign in first'); return; }
  var own = !c || c.owner === me;
  window._crews.edit = { id: c ? c.id : null, name: c ? c.name || '' : '', picked: {}, own: own, c: c || null, q: '' };
  (c ? c.members || [] : []).forEach(function (u) { if (u !== me) window._crews.edit.picked[u] = (c.names || {})[u] || 'Innings User'; });
  var sheet = document.getElementById('crw-sheet');
  if (!sheet) {
    sheet = document.createElement('div'); sheet.id = 'crw-sheet'; sheet.className = 'crw-sheet';
    sheet.setAttribute('onclick', 'if(event.target===this)crwClose()');
    (document.querySelector('.app') || document.body).appendChild(sheet);
  }
  sheet.style.display = 'flex';
  _crwEditPaint();
  var load = typeof _ensureMyFriendsLoaded === 'function' ? _ensureMyFriendsLoaded : function (cb) { cb({}); };
  load(function () { _crwEditPaint(); var f = document.getElementById('crw-name'); if (f && !c) setTimeout(function () { try { f.focus(); } catch (e) {} }, 60); });
}
function crwClose() { var s = document.getElementById('crw-sheet'); if (s) s.style.display = 'none'; window._crews.edit = null; }
function _crwEditPaint() {
  var E = window._crews.edit, sheet = document.getElementById('crw-sheet');
  if (!E || !sheet) return;
  var esc = _crwEsc, me = _crwMe(), friends = window._myFriendProfiles || {}, q = E.q.toLowerCase();
  var uids = Object.keys(friends).sort(function (a, b) { return String(friends[a]).localeCompare(String(friends[b])); });
  var n = Object.keys(E.picked).length;
  var list = uids.filter(function (u) { return !q || String(friends[u]).toLowerCase().indexOf(q) >= 0; }).map(function (u) {
    var on = !!E.picked[u];
    return '<button type="button" class="crw-fr' + (on ? ' on' : '') + '" onclick="crwPick(\'' + esc(u) + '\')"' + (E.own ? '' : ' disabled') + '><span class="crw-av md" style="background:' + _crwColor(u) + '">' + esc(_crwFirst(friends[u]).charAt(0).toUpperCase()) + '</span>' +
      '<span class="nm">' + esc(friends[u]) + '</span><span class="crw-chk">' + (on ? '✓' : '') + '</span></button>';
  }).join('');
  // someone in the crew who isn't a friend any more still shows
  Object.keys(E.picked).forEach(function (u) { if (!friends[u] && E.own) list += '<button type="button" class="crw-fr on" onclick="crwPick(\'' + esc(u) + '\')"><span class="crw-av md" style="background:' + _crwColor(u) + '">' + esc(_crwFirst(E.picked[u]).charAt(0).toUpperCase()) + '</span><span class="nm">' + esc(E.picked[u]) + '</span><span class="crw-chk">✓</span></button>'; });
  sheet.innerHTML = '<div class="crw-box" role="dialog" aria-label="' + (E.id ? 'Edit crew' : 'New crew') + '">' +
    '<div class="crw-grab"></div>' +
    '<div class="crw-top"><button type="button" class="crw-x" onclick="crwClose()">Cancel</button><b>' + (E.id ? (E.own ? 'Edit crew' : esc(E.name)) : 'New crew') + '</b>' +
      (E.own ? '<button type="button" class="crw-save" onclick="crwSave()"' + (E.name.trim() && n ? '' : ' disabled') + '>' + (E.id ? 'Save' : E.startHere ? 'Create & start' : 'Create') + '</button>' : '<button type="button" class="crw-x" onclick="crwLeave()">Leave</button>') + '</div>' +
    '<div class="crw-body">' +
      (E.own ? '<div class="crw-lab">Name</div><input id="crw-name" class="crw-in" placeholder="Baseball Nerds" maxlength="32" value="' + esc(E.name) + '" oninput="window._crews.edit.name=this.value;_crwEditSaveBtn()">' : '') +
      '<div class="crw-lab">' + (E.own ? 'Who’s in · ' + n + (n >= CREW_MAX ? ' (max)' : '') : 'In this crew') + '</div>' +
      (E.own && uids.length > 8 ? '<input class="crw-in sm" placeholder="Search friends" value="' + esc(E.q) + '" oninput="window._crews.edit.q=this.value;_crwEditPaint()">' : '') +
      '<div class="crw-list">' + (list || '<div class="crw-note">' + (Object.keys(friends).length ? 'No one matches.' : 'Add friends first — a crew is made of them.') + '</div>') + '</div>' +
      '<div class="crw-note">' + (E.startHere ? 'Create & start opens this crew’s chat on this game: everyone in it gets a notification, and they see the chat from the moment they join.' : 'A crew is a list, not a chat. Bring it into any game from the Chat tab and everyone in it gets a notification. They see the chat from the moment they join, not before.') + '</div>' +
      (E.id && E.own ? '<button type="button" class="crw-del" onclick="crwDelete()">Delete crew</button>' : '') +
    '</div></div>';
}
function _crwEditSaveBtn() { var E = window._crews.edit, b = document.querySelector('#crw-sheet .crw-save'); if (E && b) b.disabled = !(E.name.trim() && Object.keys(E.picked).length); }
function crwPick(uid) {
  var E = window._crews.edit; if (!E || !E.own) return;
  if (E.picked[uid]) delete E.picked[uid];
  else { if (Object.keys(E.picked).length >= CREW_MAX) { _crwToast('A crew holds up to ' + CREW_MAX); return; } E.picked[uid] = (window._myFriendProfiles || {})[uid] || E.picked[uid] || 'Innings User'; }
  _crwEditPaint();
}
function crwSave() {
  var E = window._crews.edit, me = _crwMe();
  if (!E || !me || !window.db) return;
  var name = E.name.trim().slice(0, 32), uids = Object.keys(E.picked);
  if (!name || !uids.length) return;
  var names = {}; names[me] = _crwName(); uids.forEach(function (u) { names[u] = E.picked[u]; });
  var doc = { owner: me, name: name, members: [me].concat(uids), names: names, updatedAt: Date.now() };
  var ref = E.id ? window.db.collection('crews').doc(E.id) : window.db.collection('crews').doc();
  var p = E.id ? ref.update(doc) : ref.set(Object.assign({ createdAt: Date.now() }, doc));
  var btn = document.querySelector('#crw-sheet .crw-save'); if (btn) btn.disabled = true;
  var isNew = !E.id, added = uids.filter(function (u) { return !(E.c && (E.c.members || []).indexOf(u) >= 0); }), startHere = !!E.startHere;
  p.then(function () {
    crwClose();
    if (startHere) { _crwStartCrew(Object.assign({ id: ref.id }, doc)); }
    else _crwToast(isNew ? name + ' · bring it into any game from Chat' : 'Saved');
    // the people you added hear about it
    if (added.length) _crwNotify(added, 'crew_added', { crewId: ref.id, crewName: name });
  }, function (err) { if (btn) btn.disabled = false; console.error('[crews] save', err); _crwToast('Couldn’t save — ' + ((err && err.code) || 'try again')); });
}
function crwDelete() {
  var E = window._crews.edit;
  if (!E || !E.id || !window.db) return;
  if (!E.armDel) { E.armDel = true; var b = document.querySelector('#crw-sheet .crw-del'); if (b) b.textContent = 'Tap again to delete'; return; }
  window.db.collection('crews').doc(E.id).delete().then(function () { crwClose(); _crwToast('Crew deleted'); }, function (err) { console.error('[crews] delete', err); _crwToast('Couldn’t delete'); });
}
function crwLeave() {
  var E = window._crews.edit, me = _crwMe(), FV = _crwFV();
  if (!E || !E.id || !me || !FV) return;
  var upd = { members: FV.arrayRemove(me) }; upd['names.' + me] = FV.delete();
  window.db.collection('crews').doc(E.id).update(upd).then(function () { crwClose(); _crwToast('You left ' + E.name); }, function (err) { console.error('[crews] leave', err); _crwToast('Couldn’t leave'); });
}
function _crwNotify(uids, type, extra, game) {
  var me = _crwMe(), g = game || null;
  if (!me || !window.db || !uids.length) return;
  var batch = window.db.batch();
  uids.forEach(function (uid) {
    if (!uid || uid === me) return;
    batch.set(window.db.collection('notifications').doc(), Object.assign({ toUid: uid, type: type, fromUid: me, fromName: _crwName(), ts: Date.now(), read: false },
      g ? { gamePk: g.gamePk, away: g.away || null, home: g.home || null, sport: g.sport || 'mlb' } : {}, extra || {}));
  });
  batch.commit().catch(function (err) { console.error('[crews:notify ' + type + ']', err); });
}

// ── the Chat tab: your crews as tiles
function _crwChatHost() {
  var panel = document.getElementById('game-chat-panel');
  if (!panel) return null;
  var host = document.getElementById('crw-tiles');
  if (!host) {
    host = document.createElement('div'); host.id = 'crw-tiles'; host.className = 'crw-tiles';
    var ref = document.getElementById('gcr-lock') || document.getElementById('game-chat-empty');
    panel.insertBefore(host, ref || null);
  }
  return host;
}
// who from a crew is on this game already (watching / attending) — from the names the game screen already loaded
function _crwHereCount(c) {
  var me = _crwMe(), g = window._activeBrowseGame, W = window._gameWatchers;
  if (!g || !W || W.gamePk != g.gamePk) return null;
  var here = {}; (W.people || []).forEach(function (p) { here[p.uid] = 1; });
  return (c.members || []).filter(function (u) { return u !== me && here[u]; }).length;
}
function _crwPaintChat() {
  var host = _crwChatHost(), me = _crwMe();
  if (!host) return;
  var g = window._activeBrowseGame, S = typeof _gcrState === 'function' ? _gcrState() : null;
  var mine = S && S.mine, esc = _crwEsc, C = window._crews;
  // in a chat already (crew or not): the tiles step aside; the crew's name sits in the line at the top
  if (!g || !me || !(S && S.v) || mine || S.v.mode !== 'rooms') { host.innerHTML = ''; host.style.display = 'none'; return; }
  host.style.display = '';
  var sport = g.sport || 'mlb';
  var rooms = (S.v.rooms || []);
  host.innerHTML = '<div class="crw-hd"><div class="gcr-hd">Your crews</div></div><div class="crw-rail">' + C.list.map(function (c) {
    var own = c.owner === me, n = (c.members || []).length - 1, here = _crwHereCount(c);
    // a room for this crew already going on this game (someone else started it)
    var going = null; rooms.forEach(function (R) { if (R.crewId === c.id && Object.keys(R.members || {}).length) going = R; });
    var sub = going ? 'Going · ' + Object.keys(going.members).length + ' in' : here != null ? here + ' of ' + n + ' on this game' : n + ' friend' + (n === 1 ? '' : 's');
    var btn;
    if (going) btn = '<button type="button" class="crw-go" onclick="crwJoinGoing(\'' + esc(going.id) + '\')">Join</button>';
    else if (own) btn = '<button type="button" class="crw-go" onclick="crwStart(\'' + esc(c.id) + '\')"' + (C.starting[c.id] ? ' disabled' : '') + '>' + (C.starting[c.id] ? 'Starting…' : 'Start') + '</button>';
    else btn = '<span class="crw-wait">' + esc(_crwFirst((c.names || {})[c.owner])) + ' starts it</span>';
    return '<div class="crw-tile' + (going ? ' live' : '') + '"><div class="crw-faces">' + _crwFaces(c, 3) + '</div><div class="n">' + esc(c.name) + '</div><div class="s">' + sub + '</div>' + btn + '</div>';
  }).join('') + '<button type="button" class="crw-tile crw-new" onclick="crwNewHere()"><span class="plus">+</span><div class="n">New crew</div><div class="s">Pick friends, start it here</div></button>' +
    '</div><div class="crw-ws">' + (C.list.length ? 'Start a crew and everyone in it gets a notification. They see the chat from the moment they join.' : 'A crew is a group of friends you can bring into any game’s chat with one tap.') + '</div>';
}
// Start the crew on this game: a private chat you run, an invite for every member, and the alerts
function crwStart(id) { var c = _crwFind(id); if (c) _crwStartCrew(c); }
function _crwStartCrew(c) {
  var id = c && c.id, me = _crwMe(), g = window._activeBrowseGame, key = typeof _gcrKey === 'function' ? _gcrKey() : '';
  var st = key && typeof _gcrS === 'function' ? _gcrS(key) : null, v = st && st.view, C = window._crews;
  if (!c || !me || !g || !st || !window.db) { _crwToast('Sign in to chat'); return; }
  if (c.owner !== me) return;
  if (v && v.mine) { _crwToast('You’re already in a chat on this game — leave it first'); return; }
  if (!v || v.mode !== 'rooms') { _crwToast('Crew chats need the private-chat rules published'); return; }
  if (C.starting[id]) return;
  C.starting[id] = 1; st.starting = true; st.own = true; _crwPaintChat();
  var now = Date.now(), others = (c.members || []).filter(function (u) { return u !== me; });
  var names = {}, invites = {};
  names[me] = _crwName();
  others.forEach(function (u) { invites[u] = { by: me, byName: _crwName(), name: (c.names || {})[u] || 'Innings User', ts: now, crew: true }; });
  var rid = typeof _gcrDocId === 'function' ? _gcrDocId(key, 'crew_' + id + '_' + now) : key + '__crew_' + id + '_' + now;
  window.db.collection('gameChatRooms').doc(rid).set({ pk: key, gamePk: st.gamePk != null ? st.gamePk : g.gamePk, replayOf: null, founder: me, mod: me, members: [me], names: names, joined: {}, asks: {}, no: {}, invites: invites, crewId: id, crewName: c.name, createdAt: now })
    .then(function () {
      delete C.starting[id]; st.starting = false;
      var away = g.away || '', home = g.home || '';
      _crwNotify(others, 'game_chat_crew', { roomId: rid, invite: true, atTs: now, crewId: id, crewName: c.name, messagePreview: c.name + ' · ' + (away && home ? away + ' @ ' + home : 'a game') }, g);
      _crwToast(c.name + ' started · ' + others.length + ' notified');
      var f = document.getElementById('game-chat-field'); if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 50);
    }, function (err) { delete C.starting[id]; st.starting = false; st.own = false; _crwPaintChat(); console.error('[crews] start', err); _crwToast('Couldn’t start — ' + ((err && err.code) || 'try again')); });
}
function crwJoinGoing(rid) { if (typeof gcrJoin === 'function') gcrJoin(rid); }

// ── hooks into the game chat
(function () {
  // the room invite listener only knew @ invitations; crew starts are invitations too
  if (typeof _gcrInvListen === 'function') {
    _gcrInvListen = function () {
      var me = _crwMe(), I = window._gcrInv;
      if (!me || !window.db || I.on === me) return;
      if (I.unsub) { try { I.unsub(); } catch (e) {} }
      I.on = me; I.by = {};
      I.unsub = window.db.collection('notifications').where('toUid', '==', me).where('type', 'in', ['game_chat_mention', 'game_chat_crew']).limit(200).onSnapshot(function (snap) {
        var by = {};
        snap.forEach(function (doc) {
          var n = doc.data() || {};
          if (!n.invite || !n.roomId || n.gamePk == null || !n.fromUid) return;
          var g = by[String(n.gamePk)] || (by[String(n.gamePk)] = {}), cur = g[n.roomId];
          var at = n.atTs || n.ts || 0;
          if (!cur || at > cur.ts) g[n.roomId] = { by: n.fromUid, byName: n.fromName || 'Someone', ts: at, crew: n.type === 'game_chat_crew' ? (n.crewName || 'crew') : null };
        });
        I.by = by;
        var key = typeof _gcrKey === 'function' ? _gcrKey() : '';
        if (key && window._gcr[key] && window._gcr[key].view) _gcrPublish(key);
      }, function (err) { console.error('[game chat] invitations', err); I.on = false; });
    };
  }
  // a crew invitation reads from when you join, never from when it was sent
  if (typeof _gcrInviteFor === 'function') {
    var prevInv = _gcrInviteFor;
    _gcrInviteFor = function (R, key, me) {
      var x = prevInv.apply(this, arguments);
      if (!x) return null;
      var c = (R.invites && R.invites[me] && R.invites[me].crew) || (R.crewId && (((window._gcrInv.by || {})[key] || {})[R.id] || {}).crew);
      if (c) x.crew = R.crewName || (typeof c === 'string' ? c : 'crew');
      return x;
    };
  }
  // the moderator's app lets a crew member who asked in straight in (rules that don't allow self-join)
  if (typeof _gcrMentionOf === 'function') {
    var prevMention = _gcrMentionOf;
    _gcrMentionOf = function (v, uid) {
      var hit = prevMention.apply(this, arguments);
      if (hit) return hit;
      var R = v && v.mine, inv = R && R.invites && R.invites[uid];
      if (inv && inv.crew && R.members[inv.by]) return { by: inv.by, byName: inv.byName || R.members[inv.by], ts: null };
      return null;
    };
  }
  // "Nathan's chat" → "Baseball Nerds" when the chat is a crew's
  if (typeof _gcrRoomTitle === 'function') {
    var prevTitle = _gcrRoomTitle;
    _gcrRoomTitle = function (R, me) { return R && R.crewName ? R.crewName : prevTitle.apply(this, arguments); };
  }
  // the room card for a chat you're not in: a crew invite says so
  if (typeof _gcrRoomCard === 'function') {
    var prevCard = _gcrRoomCard;
    _gcrRoomCard = function (R, me) {
      var h = prevCard.apply(this, arguments);
      if (!R || !R.crewName) return h;
      var mod = _crwEsc(_crwFirst(R.members[_gcrModOf(R)]));
      return h.replace(/invited you<\/div>/, 'started ' + _crwEsc(R.crewName) + '</div>').replace(mod + '’s chat · ', _crwEsc(R.crewName) + ' · ')
        .replace(/You’ll see the chat from [^<]*’s @ on\./, 'You’ll see the chat from the moment you join.');
    };
  }
  // the view gains the crew fields off the room doc
  if (typeof _gcrView === 'function') {
    var prevView = _gcrView;
    _gcrView = function (key) {
      var v = prevView.apply(this, arguments), st = window._gcr[key];
      if (v && st && st.rooms) { var by = {}; st.rooms.forEach(function (d) { by[d.id] = d; }); (v.rooms || []).forEach(function (R) { var d = by[R.id]; if (d && d.crewId) { R.crewId = d.crewId; R.crewName = d.crewName || ''; } }); }
      return v;
    };
  }
  // repaint the tiles whenever the chat repaints
  if (typeof _gcrPaint === 'function') {
    var prevPaint = _gcrPaint;
    _gcrPaint = function () { var r = prevPaint.apply(this, arguments); try { _crwPaintChat(); } catch (e) { console.error('[crews] paint', e); } return r; };
  }
  // "Sarah joined the chat" line for a crew member
  if (typeof _gcrLineText === 'function') {
    var prevLine = _gcrLineText;
    _gcrLineText = function (act, byUid, byName, p, me) {
      var L = prevLine.apply(this, arguments);
      if (L && act === 'ok' && p && p.crew) {
        var nm = _crwFirst(p.name);
        if (p.who === me) return { t: 'You joined ' + p.crew, s: 'You see the chat from here on.' };
        return { t: nm + ' joined ' + p.crew, s: nm + ' sees the chat from here on.' };
      }
      return L;
    };
  }
  // joining on a crew invite: join time is now, and the line names the crew
  if (typeof gcrJoin === 'function') {
    gcrJoin = function (rid) {
      var S = _gcrState(), R = _gcrFindRoom(rid), me = _crwMe(), FV = _crwFV();
      if (!S || !R || !me) return;
      var inv = _gcrInviteFor(R, S.key, me);
      if (!inv || !(R.kind === 'new' && FV && R.invites && R.invites[me])) { gcrAsk(rid); return; }
      S.st.asked = true;
      var now = Date.now(), since = inv.crew ? now : (inv.ts && inv.ts < now ? inv.ts : now), upd = { members: FV.arrayUnion(me) };
      upd['names.' + me] = _crwName(); upd['joined.' + me] = since; upd['asks.' + me] = FV.delete(); upd['invites.' + me] = FV.delete();
      _gcrRoomRef(rid).update(upd).then(function () {
        var line = { act: 'ok', who: me, name: _crwName(), inv: inv.by, invName: inv.byName, since: since };
        if (inv.crew) line.crew = R.crewName || inv.crew;
        _gcrPostLine(rid, line, now).catch(function (err) { console.error('[game chat] joined line', err); });
      }, function (err) {
        console.info('[game chat] joining straight from an invitation isn’t allowed by the database rules (' + ((err && err.code) || err) + ') — asking in instead');
        gcrAsk(rid);
      });
    };
  }
  // the moderator letting a crew member in: the line names the crew too
  if (typeof _gcrLetInDo === 'function') {
    var prevLet = _gcrLetInDo;
    _gcrLetInDo = function (rid, uid, name, btn, at, key) {
      var R = null;
      if (key && key !== _gcrKey()) { var st = _gcrS(key); ((st.view && st.view.rooms) || []).forEach(function (x) { if (x.id === rid) R = x; }); } else R = _gcrFindRoom(rid);
      if (R && R.crewName && at && !at.ts) at = Object.assign({}, at, { crew: R.crewName });
      return prevLet.call(this, rid, uid, name, btn, at, key);
    };
    // the ok line carries the crew name through _gcrPostLine
    var prevPost = _gcrPostLine;
    _gcrPostLine = function (rid, payload, ts, game) {
      if (payload && payload.act === 'ok' && !payload.crew && payload.inv) {
        var R = null;
        Object.keys(window._gcr || {}).forEach(function (k) { var st = window._gcr[k]; ((st && st.view && st.view.rooms) || []).forEach(function (x) { if (x.id === rid) R = x; }); });
        if (R && R.crewName) payload.crew = R.crewName;
      }
      return prevPost.apply(this, arguments);
    };
  }
  // Friends screen: paint when it opens
  if (typeof _glFriendsOpen === 'function') {
    var prevOpen = _glFriendsOpen;
    _glFriendsOpen = function () { var r = prevOpen.apply(this, arguments); try { crwListen(); _crwPaintFriends(); } catch (e) { console.error('[crews] friends', e); } return r; };
  }
  if (typeof loadMyFriendsList === 'function') {
    var prevFr = loadMyFriendsList;
    loadMyFriendsList = function () { var r = prevFr.apply(this, arguments); try { crwListen(); _crwPaintFriends(); } catch (e) {} return r; };
  }
  // start listening once signed in, so the Chat tab has the crews on first open
  if (typeof startGameChat === 'function') {
    var prevStart = startGameChat;
    startGameChat = function () { try { crwListen(); } catch (e) {} return prevStart.apply(this, arguments); };
  }
})();
