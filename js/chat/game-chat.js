// ── OPEN GAME CHAT — flat gameChats collection filtered by gamePk, with
// no groupId and no membership check: anyone signed in can read and post,
// on purpose, per the "just for the beta" call on this one. Deliberately
// plain (no reactions/replies/link-previews) to match.
window._gameChatStarted = {};
window._gameChatMsgs = {}; // v7.20.1: each game's messages, kept so the Chat tab can count the ones you haven't seen
function startGameChat(gamePk) {
  var key = String(gamePk);
  if (window._gameChatStarted[key]) return;
  if (!window.db) return;
  window._gameChatStarted[key] = true;
  window.db.collection('gameChats').where('gamePk', '==', gamePk).limit(300).onSnapshot(function (snap) {
    var msgs = [];
    snap.forEach(function (doc) { msgs.push(Object.assign({ _id: doc.id }, doc.data())); });
    msgs.sort(function (a, b) { return (a.ts || 0) - (b.ts || 0); });
    window._gameChatMsgs[key] = msgs;
    if (!window._activeBrowseGame || window._activeBrowseGame.gamePk != gamePk) return;
    renderGameChat(msgs);
  }, function (err) {
    console.error('Game chat error:', err);
    window._gameChatStarted[key] = false;
    if (typeof ib_toast === 'function') ib_toast('Chat unavailable — check Firestore rules');
  });
}

// renderGameChat moved to the v5.68.0 block (photos, link previews, play replies, reaction lines).

function sendGameMessage() {
  if (!window._activeBrowseGame) return;
  var inp = document.getElementById('game-chat-field');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast === 'function') ib_toast('Sign in to chat'); return; }
  var author = (window.userData && window.userData.name) || 'You';
  var g = window._activeBrowseGame;
  var gamePk = g.gamePk;
  if (inp) inp.value = '';
  var msgData = { gamePk: gamePk, uid: user.uid, author: author, text: text, ts: Date.now() };
  var replyTo = _consumeReplyForSend('gameChats');
  if (replyTo) msgData.replyTo = replyTo;
  var url = typeof _extractFirstUrl === 'function' ? _extractFirstUrl(text) : null;
  var sendPromise = url
    ? _fetchLinkPreview(url).then(function (lp) {
        if (lp && lp.url) msgData.linkPreview = lp;
        return window.db.collection('gameChats').add(msgData);
      })
    : window.db.collection('gameChats').add(msgData);
  sendPromise.then(function () {
    _notifyFriendsWatchingOfChatMessage(g, text);
  }).catch(function (err) {
    console.error('Game chat send error:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not send — ' + (err && err.message ? err.message : 'check Firestore rules'));
  });
}

// Same friend/watching cross-reference as _notifyFriendsAlreadyWatching
// above, fired on a new chat message instead of on joining the watch
// list — only reaches friends who are actually watching this game, not
// everyone in the open gameChats thread (that stays membership-free on
// purpose; this notification is scoped to "watching together" specifically).
function _notifyFriendsWatchingOfChatMessage(g, text) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  _friendsWatchingGame(g.gamePk).then(function (uids) {
    if (!uids.length) return;
    var myName = (window.userData && window.userData.name) || 'Someone';
    var preview = text.length > 80 ? text.slice(0, 80) + '…' : text;
    var batch = window.db.batch();
    uids.forEach(function (uid) {
      batch.set(window.db.collection('notifications').doc(), {
        toUid: uid,
        type: 'game_chat_message',
        fromUid: user.uid,
        fromName: myName,
        gamePk: g.gamePk,
        away: g.away || null,
        home: g.home || null,
        sport: g.sport || 'mlb',
        messagePreview: preview,
        ts: Date.now(),
        read: false
      });
    });
    batch.commit().catch(function (err) { console.error('Notify chat message error:', err); });
  }).catch(function (err) { console.error('Notify chat message lookup error:', err); });
}

window._gdGameChatStarted = {};
function startGroupGameChat(groupId, gamePk) {
  var key = groupId + ':' + gamePk;
  if (window._gdGameChatStarted[key]) return;
  if (!window.db) return;
  window._gdGameChatStarted[key] = true;
  window.db.collection('groupGameChat').where('groupId','==',groupId).where('gamePk','==',gamePk).limit(300).onSnapshot(function(snap){
    if (!window._gdActiveGame || window._gdActiveGame.groupId !== groupId || window._gdActiveGame.gamePk !== gamePk) return;
    var msgs = [];
    snap.forEach(function(doc){ msgs.push(Object.assign({ _id: doc.id }, doc.data())); });
    msgs.sort(function(a,b){ return (a.ts || 0) - (b.ts || 0); });
    renderGroupGameChat(msgs);
  }, function(err){
    console.error('Group game chat error:', err);
    window._gdGameChatStarted[key] = false;
    if (typeof ib_toast==='function') ib_toast('Chat unavailable — check Firestore rules');
  });
}

function renderGroupGameChat(msgs) {
  var box = document.getElementById('gd-game-chat-msgs');
  var empty = document.getElementById('gd-game-chat-empty');
  if (!box) return;
  if (empty) empty.style.display = msgs.length ? 'none' : 'flex';
  var myUid = (window.currentUser && window.currentUser.uid) || (window.auth && window.auth.currentUser && window.auth.currentUser.uid);
  box.innerHTML = _chatHtmlWithDayDividers(msgs, function(c){
    var mine = c.uid && c.uid === myUid;
    var badges = _reactionBadgesHtml(c.reactions, false);
    var lpHtml = c.linkPreview ? _linkPreviewCardHtml(c.linkPreview) : '';
    var linkOnly = !!(c.linkPreview && c.text && c.text.trim() === c.linkPreview.url);
    if (mine) {
      if (linkOnly) {
        return '<div class="msg mine"><div class="m-av av-a">' + _escapeHtml(_initials(c.author)) + '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;max-width:76%;min-width:0">' +
            lpHtml +
            '<div style="font-size:10px;color:var(--subtle);padding:0 2px">' + _fmtTime(c.ts) + '</div>' +
            badges +
          '</div></div>';
      }
      return '<div class="msg mine"><div class="m-av av-a">' + _escapeHtml(_initials(c.author)) + '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;max-width:76%;min-width:0">' +
          lpHtml +
          '<div class="bubble me" onclick="_msgDoubleTap(this,\'groupGameChat\',\'' + c._id + '\',true)" style="max-width:100%;cursor:pointer">' + _replyQuoteHtml(c.replyTo, true) + '<div class="b-txt">' + _renderMessageTextWithMentions(c.text, true) + '</div><div class="b-t">' + _fmtTime(c.ts) + (c.edited ? ' · Edited' : '') + '</div></div>' +
          badges +
        '</div></div>';
    }
    if (linkOnly) {
      return '<div class="msg"><div class="m-av av-b">' + _escapeHtml(_initials(c.author)) + '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-start;max-width:76%;min-width:0">' +
          '<div class="b-who" style="margin-bottom:2px">' + _escapeHtml(c.author) + '</div>' +
          lpHtml +
          '<div style="font-size:10px;color:var(--subtle);padding:0 2px">' + _fmtTime(c.ts) + '</div>' +
          badges +
        '</div></div>';
    }
    return '<div class="msg"><div class="m-av av-b">' + _escapeHtml(_initials(c.author)) + '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-start;max-width:76%;min-width:0">' +
        lpHtml +
        '<div class="bubble them" onclick="_msgDoubleTap(this,\'groupGameChat\',\'' + c._id + '\',false)" style="max-width:100%;cursor:pointer">' + _replyQuoteHtml(c.replyTo, false) + '<div class="b-who">' + _escapeHtml(c.author) + '</div><div class="b-txt">' + _renderMessageTextWithMentions(c.text, false) + '</div><div class="b-t">' + _fmtTime(c.ts) + (c.edited ? ' · Edited' : '') + '</div></div>' +
        badges +
      '</div></div>';
  }, true);
  var panel = document.getElementById('gd-game-chat');
  if (panel) panel.scrollTop = panel.scrollHeight;
}

function deleteGroupGameMessage(msgId) {
  if (!window.db || !msgId) return;
  window.db.collection('groupGameChat').doc(msgId).delete()
    .catch(function(err){ console.error('Delete group game message error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}

function deleteGameChatMessage(msgId) {
  if (!window.db || !msgId) return;
  window.db.collection('gameChats').doc(msgId).delete()
    .catch(function(err){ console.error('Delete game message error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}

function sendGroupGameMessage() {
  if (!window._gdActiveGame) return;
  var inp = document.getElementById('gd-game-chat-field');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in to chat'); return; }
  var author = (window.userData && window.userData.name) || 'You';
  var groupId = window._gdActiveGame.groupId;
  var gamePk = window._gdActiveGame.gamePk;
  var gameLabel = window._gdActiveGame.label || 'a game';
  if (inp) inp.value = '';
  var msgData = { groupId: groupId, gamePk: gamePk, uid: user.uid, author: author, text: text, ts: Date.now() };
  var replyTo = _consumeReplyForSend('groupGameChat');
  if (replyTo) msgData.replyTo = replyTo;
  var url = _extractFirstUrl(text);
  var sendPromise = url
    ? _fetchLinkPreview(url).then(function(lp){
        if (lp && lp.url) msgData.linkPreview = lp;
        return window.db.collection('groupGameChat').add(msgData);
      })
    : window.db.collection('groupGameChat').add(msgData);
  sendPromise.then(function(){
    _postGroupGameActivityNotice(groupId, gamePk, gameLabel, author, user.uid, text);
  }).catch(function(err){ console.error('Group game chat send error:', err); if (typeof ib_toast==='function') ib_toast('Could not send — ' + (err && err.message ? err.message : 'check Firestore rules')); });
}

// Mirrors a game-chat message into the main group Chat so nothing said in
// a specific game's thread gets missed by people just watching the main
// feed — rendered there as a distinct, clickable card (see renderGroupChat)
// that jumps straight into that game via jumpToGroupGame().
function _postGroupGameActivityNotice(groupId, gamePk, gameLabel, author, uid, text) {
  if (!window.db) return;
  window.db.collection('groupChats').add({
    groupId: groupId,
    uid: uid,
    author: author,
    text: text,
    ts: Date.now(),
    system: true,
    systemType: 'game',
    gamePk: gamePk,
    gameLabel: gameLabel
  }).catch(function(err){ console.error('Post game activity notice error:', err); });
}
