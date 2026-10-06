// ── MESSAGE REACTIONS (tapbacks) — shared by OSL chat, Feedback chat, Artist chat ──
var REACTION_EMOJIS = ['❤️','👍','👎','😂','‼️','❓'];
window._reactionSheetTarget = null;

// Double tap/click detection: fires openReactionSheet() on the second tap
// within 400ms, mirroring iMessage's tapback gesture. Single taps do nothing.
// Link-preview cards need BOTH behaviors a plain <a> can't give us at once:
// a single tap should open the link, but a double tap (like every other
// bubble) should open the reaction/delete sheet. A bare <a> would navigate
// on the very first tap, so this waits briefly to see if a second tap
// follows before deciding which one actually happened.
function _linkCardTap(el, url, collection, msgId, isMine) {
  var now = Date.now();
  if (el._lastTapTs && (now - el._lastTapTs) < 400) {
    el._lastTapTs = 0;
    clearTimeout(el._tapTimer);
    openReactionSheet(collection, msgId, isMine);
  } else {
    el._lastTapTs = now;
    el._tapTimer = setTimeout(function(){
      window.open(url, '_blank', 'noopener,noreferrer');
    }, 400);
  }
}

function _msgDoubleTap(el, collection, msgId, isMine) {
  var now = Date.now();
  if (el._lastTapTs && (now - el._lastTapTs) < 400) {
    el._lastTapTs = 0;
    openReactionSheet(collection, msgId, isMine);
  } else {
    el._lastTapTs = now;
  }
}

// Same double-tap gesture as messages, pointed at a dedicated
// gamePlayReactions collection instead of a chat message — plays from
// the live feed aren't Firestore documents themselves (they're
// re-derived from the API on every poll), so they can't share a
// message's {collection, msgId} the way replies-as-new-messages do.
// canDelete is always false: there's no message here to edit or
// delete, only a reactions map. onDone refreshes just this play's own
// badge immediately, instead of waiting for the next 15-second poll.
function _playDoubleTap(el, playId, tag, text) {
  var now = Date.now();
  if (el._lastTapTs && (now - el._lastTapTs) < 400) {
    el._lastTapTs = 0;
    openReactionSheet('gamePlayReactions', playId, false, function () { _loadPlayReactions([playId]); }, { tag: tag, text: text });
  } else {
    el._lastTapTs = now;
  }
}

// Batched fetch for however many plays are currently on screen. A whole
// game's play list runs well past Firestore's 10-item 'in' query limit,
// so it goes up in chunks of ten — still far fewer reads than one per
// play, and nothing past the tenth gets silently dropped.
function _loadPlayReactions(playIds) {
  if (!playIds || !playIds.length) return;
  for (var i = 0; i < playIds.length; i += 10) _loadPlayReactionsChunk(playIds.slice(i, i + 10));
}
function _loadPlayReactionsChunk(playIds) {
  if (!playIds || !playIds.length || !window.db || typeof firebase === 'undefined') return;
  window.db.collection('gamePlayReactions').where(firebase.firestore.FieldPath.documentId(), 'in', playIds).get().then(function (snap) {
    var byId = {};
    snap.forEach(function (doc) { byId[doc.id] = (doc.data() && doc.data().reactions) || {}; });
    playIds.forEach(function (id) {
      var el = document.getElementById('play-react-' + id);
      if (el) el.innerHTML = _reactionBadgesHtml(byId[id] || {}, true);
    });
  }).catch(function (err) { console.error('Load play reactions error:', err); });
}

function openReactionSheet(collection, msgId, canDelete, onDone, playContext) {
  window._reactionSheetTarget = { collection: collection, msgId: msgId, onDone: onDone, playContext: playContext };
  var box = document.getElementById('msg-reaction-emojis');
  if (box) {
    box.innerHTML = REACTION_EMOJIS.map(function(e){
      return '<button onclick="_pickReaction(\'' + e + '\')" style="flex:1;background:none;border:none;font-size:28px;cursor:pointer;padding:6px 2px;line-height:1">' + e + '</button>';
    }).join('');
  }
  var editBtn = document.getElementById('msg-reaction-edit-btn');
  if (editBtn) editBtn.style.display = canDelete ? 'block' : 'none';
  var delBtn = document.getElementById('msg-reaction-delete-btn');
  if (delBtn) delBtn.style.display = canDelete ? 'block' : 'none';
  var sheet = document.getElementById('msg-reaction-sheet');
  if (sheet) sheet.style.display = 'flex';
}

function closeReactionSheet() {
  var sheet = document.getElementById('msg-reaction-sheet');
  if (sheet) sheet.style.display = 'none';
  window._reactionSheetTarget = null;
}

function _pickReaction(emoji) {
  var target = window._reactionSheetTarget;
  closeReactionSheet();
  if (!target || !window.db) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user) { if (typeof ib_toast==='function') ib_toast('Sign in to react'); return; }
  var ref = window.db.collection(target.collection).doc(target.msgId);
  var added = false;
  ref.get().then(function(doc){
    var current = (doc.exists && doc.data() && doc.data().reactions) || {};
    added = current[user.uid] !== emoji;
    // Nested map, NOT a 'reactions.<uid>' key: only update() reads dots
    // as a path. set() stored it as a literal top-level field named
    // "reactions.<uid>", so affectedKeys() was never ['reactions'] and
    // every chat's reactions rule denied it.
    var mine = {};
    mine[user.uid] = (current[user.uid] === emoji) ? firebase.firestore.FieldValue.delete() : emoji;
    var update = { reactions: mine };
    // set+merge instead of update: identical behavior for an existing
    // message doc, but also correctly CREATES the doc when it doesn't
    // exist yet — which is the normal case for a play reaction, since
    // nothing else ever creates that document first the way sending a
    // message does for chat reactions.
    return ref.set(update, { merge: true });
  }).then(function(){
    if (typeof target.onDone === 'function') target.onDone();
    if (added && target.collection === 'gamePlayReactions' && target.playContext && typeof _gcPostPlayReaction === 'function') {
      _gcPostPlayReaction({ tag: target.playContext.tag, text: target.playContext.text, playId: target.msgId }, emoji);
    }
  }).catch(function(err){ console.error('[react:' + target.collection + '] ' + (err && err.code), err); if (typeof ib_toast==='function') ib_toast('Could not react — ' + ((err && err.code) || 'try again')); });
}

function _reactionSheetDelete() {
  var target = window._reactionSheetTarget;
  closeReactionSheet();
  if (!target) return;
  if (target.collection === 'oslChat') deleteOslMessage(target.msgId);
  else if (target.collection === 'feedbackChat') deleteFeedbackMessage(target.msgId);
  else if (target.collection === 'actChat') deleteActMessage(target.msgId);
  else if (target.collection === 'futureMomentChat') deleteFutureMomentMessage(target.msgId);
  else if (target.collection === 'groupChats') deleteGroupMessage(target.msgId);
  else if (target.collection === 'groupGameChat') deleteGroupGameMessage(target.msgId);
  else if (target.collection === 'birthdayChat') deleteBirthdayMessage(target.msgId);
  else if (target.collection === 'birthdayStopChat') deleteBdayStopMessage(target.msgId);
  else if (target.collection === 'gameChats') deleteGameChatMessage(target.msgId);
}

// ── EDIT MESSAGE — reuses the same {collection, msgId} the reaction sheet
// already tracks. Fetches the live doc to prefill the textarea (rather than
// hunting down the right in-memory render cache for whichever chat this
// is), then writes just {text, edited} back — Firestore rules restrict
// updates to the author's own messages and only those two fields, same
// shape as the existing reactions-only allowance.
window._editMessageTarget = null;

function _reactionSheetEdit() {
  var target = window._reactionSheetTarget;
  closeReactionSheet();
  if (!target || !window.db) return;
  window.db.collection(target.collection).doc(target.msgId).get().then(function(doc){
    if (!doc.exists) { if (typeof ib_toast==='function') ib_toast('Message no longer exists'); return; }
    openEditMessageModal(target.collection, target.msgId, (doc.data() || {}).text || '');
  }).catch(function(err){
    console.error('Load message for edit error:', err);
    if (typeof ib_toast==='function') ib_toast('Could not load message — try again');
  });
}

function openEditMessageModal(collection, msgId, currentText) {
  window._editMessageTarget = { collection: collection, msgId: msgId };
  var input = document.getElementById('edit-message-input');
  if (input) input.value = currentText;
  var modal = document.getElementById('edit-message-modal');
  if (modal) modal.style.display = 'flex';
}

// ── REPLY — shared by every chat surface. Reuses the same generic
// {collection, msgId} the reaction sheet already tracks for react/edit/
// delete. Each surface just needs a tiny bit of wiring: a reply-preview
// chip above its own composer, and a call to _consumeReplyForSend() right
// before it writes a new message.
window._replyingTo = null;

var REPLY_PREVIEW_MAP = {
  oslChat: { chip: 'osl-reply-preview', field: 'osl-chat-field' },
  feedbackChat: { chip: 'feedback-reply-preview', field: 'feedback-chat-field' },
  actChat: { chip: 'act-reply-preview', field: 'act-detail-chat-field' },
  futureMomentChat: { chip: 'future-reply-preview', field: 'fd-chat-field' },
  groupChats: { chip: 'group-reply-preview', field: 'group-chat-field' },
  groupGameChat: { chip: 'group-game-reply-preview', field: 'gd-game-chat-field' },
  birthdayChat: { chip: 'bday-reply-preview', field: 'bday-chat-field' },
  birthdayStopChat: { chip: 'bday-stop-reply-preview', field: 'bday-stop-chat-field' },
  gameChats: { chip: 'game-reply-preview', field: 'game-chat-field' }
};

function _reactionSheetReply() {
  var target = window._reactionSheetTarget;
  closeReactionSheet();
  if (!target || !window.db) return;
  // A play reaction's msgId is a playId into gamePlayReactions, not a
  // real chat message — that document only ever has a reactions map,
  // no author/text, so the generic lookup below would both fetch the
  // wrong thing and reply into the wrong collection. Route through the
  // same tag/text-based path the existing ↩ reply icon already uses.
  if (target.collection === 'gamePlayReactions' && target.playContext) {
    _replyToPlay(target.playContext.tag, target.playContext.text);
    return;
  }
  window.db.collection(target.collection).doc(target.msgId).get().then(function(doc){
    if (!doc.exists) { if (typeof ib_toast==='function') ib_toast('Message no longer exists'); return; }
    var d = doc.data() || {};
    _setReplyTarget(target.collection, target.msgId, d.author || 'Someone', d.text || '');
  }).catch(function(err){
    console.error('Load message for reply error:', err);
    if (typeof ib_toast==='function') ib_toast('Could not load message — try again');
  });
}

function _setReplyTarget(collection, msgId, author, text) {
  window._replyingTo = { collection: collection, msgId: msgId, author: author, text: text };
  _renderReplyPreview();
  var mapEntry = REPLY_PREVIEW_MAP[collection];
  var field = mapEntry && document.getElementById(mapEntry.field);
  if (field) field.focus();
}

// Replying to a play works exactly like replying to a message — same
// {collection, msgId, author, text} shape the reply preview/consume/
// quote machinery already handles — except there's no real message doc
// to react to or delete, so msgId is null. That's fine: nothing ever
// looks up a play's own doc, it's just quoted context on whatever new
// chat message gets sent.
// Replying to a play works exactly like replying to a message — same
// {collection, msgId, author, text} shape the reply preview/consume/
// quote machinery already handles — except there's no real message doc
// to react to or delete, so msgId is null. That's fine: nothing ever
// looks up a play's own doc, it's just quoted context on whatever new
// chat message gets sent. Switches to the Chat tab FIRST: the reply
// button lives on the Cheat Sheet tab, and _setReplyTarget's own
// .focus() call is a no-op on a still-hidden, display:none input — the
// person needs to already be looking at Chat for anything to visibly
// happen.
function _replyToPlay(tag, text) {
  if (typeof gameDetailTab === 'function') gameDetailTab('chat');
  _setReplyTarget('gameChats', null, tag || 'Play', text || '');
  // v5.68.0: keep which play this is (and the score at the time) so the
  // quote in chat can open the play's context later.
  if (window._replyingTo && typeof _gcPlayRow === 'function') {
    try {
      var pid = _gcPlayIdFromRow(_gcPlayRow(text));
      var f = _gcFindPlay(text, pid), p = f.idx >= 0 ? f.list[f.idx] : null, score = null;
      if (p && f.box && p.awayScore != null && p.homeScore != null) score = _ghScoreChip(p, f.box.awayAbbr || _ghAbbrFallback(f.box.away), f.box.homeAbbr || _ghAbbrFallback(f.box.home));
      window._replyingTo.play = { tag: tag || 'Play', text: text || '', playId: pid || null, score: score || null };
    } catch (e) { console.error('[reply to play] context lookup failed', e); }
  }
}

function _cancelReply() {
  window._replyingTo = null;
  _renderReplyPreview();
}

function _renderReplyPreview() {
  Object.keys(REPLY_PREVIEW_MAP).forEach(function(coll){
    var chipId = REPLY_PREVIEW_MAP[coll].chip;
    var el = document.getElementById(chipId);
    if (!el) return;
    if (window._replyingTo && window._replyingTo.collection === coll) {
      var preview = window._replyingTo.text.length > 60 ? window._replyingTo.text.slice(0, 60) + '…' : window._replyingTo.text;
      el.style.display = 'flex';
      el.innerHTML =
        '<div style="flex:1;min-width:0;border-left:2.5px solid var(--indigo);padding-left:8px">' +
          '<div style="font-size:11px;font-weight:700;color:var(--indigo)">Replying to ' + _escapeHtml(window._replyingTo.author) + '</div>' +
          '<div style="font-size:12px;color:var(--subtle);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(preview) + '</div>' +
        '</div>' +
        '<button onclick="_cancelReply()" style="background:none;border:none;color:var(--subtle);font-size:18px;cursor:pointer;padding:0 4px;flex-shrink:0;font-family:inherit">✕</button>';
    } else {
      el.style.display = 'none';
      el.innerHTML = '';
    }
  });
}

// Called by each send function right before writing. Returns the replyTo
// object to attach if the person was replying to something in THIS
// collection, or null otherwise — and always clears the reply state, so a
// stale "replying to" chip never lingers into the next message.
function _consumeReplyForSend(collection) {
  var replyTo = null;
  if (window._replyingTo && window._replyingTo.collection === collection) {
    replyTo = { msgId: window._replyingTo.msgId, author: window._replyingTo.author, text: window._replyingTo.text };
    if (window._replyingTo.play) replyTo.play = window._replyingTo.play;
    if (window._replyingTo.stat) replyTo.stat = window._replyingTo.stat; // v7.18.0: a stat from a player card
  }
  _cancelReply();
  return replyTo;
}

// Shared quoted-snippet shown inside a bubble when a message is a reply —
// same look everywhere. isMine flips the color treatment since "mine"
// bubbles are dark (indigo, light text) and "them" bubbles are light
// (white/card, dark text) consistently across every surface.
function _replyQuoteHtml(replyTo, isMine) {
  if (!replyTo) return '';
  // Strip mention markup to plain "@Name" BEFORE truncating by raw
  // character count — truncating first risks slicing a
  // @[Name](uid)-style tag in half and showing broken markup instead
  // of a name.
  var plainText = _stripMentionMarkup(replyTo.text || '');
  var preview = plainText.length > 80 ? plainText.slice(0, 80) + '…' : plainText;
  var borderColor = isMine ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.15)';
  var textColor = isMine ? 'rgba(255,255,255,0.75)' : 'var(--subtle)';
  var authorColor = isMine ? 'rgba(255,255,255,0.95)' : 'var(--mid)';
  return '<div style="border-left:2.5px solid ' + borderColor + ';padding:3px 0 3px 8px;margin-bottom:6px;max-width:100%">' +
    '<div style="font-size:10.5px;font-weight:700;color:' + authorColor + '">' + _escapeHtml(replyTo.author || 'Someone') + '</div>' +
    '<div style="font-size:12px;color:' + textColor + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(preview) + '</div>' +
  '</div>';
}

function closeEditMessageModal() {
  var modal = document.getElementById('edit-message-modal');
  if (modal) modal.style.display = 'none';
  window._editMessageTarget = null;
}

function saveEditedMessage() {
  var target = window._editMessageTarget;
  if (!target || !window.db) { closeEditMessageModal(); return; }
  var input = document.getElementById('edit-message-input');
  var text = input ? input.value.trim() : '';
  if (!text) { if (typeof ib_toast==='function') ib_toast('Message can\'t be empty'); return; }
  window.db.collection(target.collection).doc(target.msgId).update({ text: text, edited: true })
    .then(function(){ closeEditMessageModal(); if (typeof ib_toast==='function') ib_toast('Message updated'); })
    .catch(function(err){
      console.error('Edit message error:', err);
      if (typeof ib_toast==='function') ib_toast('Could not save — ' + (err && err.message ? err.message : 'check Firestore rules'));
    });
}

// Renders grouped emoji badges (with a count if more than one person picked
// the same reaction) just under a message bubble.
function _reactionBadgesHtml(reactions, dark) {
  reactions = reactions || {};
  var counts = {};
  Object.keys(reactions).forEach(function(uid){ var e = reactions[uid]; if (e) counts[e] = (counts[e] || 0) + 1; });
  var emojis = Object.keys(counts);
  if (!emojis.length) return '';
  var bg = dark ? 'rgba(255,255,255,0.16)' : 'var(--card)';
  var border = dark ? 'none' : '0.5px solid var(--rule)';
  var color = dark ? '#fff' : 'var(--black)';
  return '<div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">' +
    emojis.map(function(e){
      return '<div style="background:' + bg + ';border:' + border + ';border-radius:10px;padding:2px 7px;font-size:11px;color:' + color + '">' + e + (counts[e] > 1 ? ' ' + counts[e] : '') + '</div>';
    }).join('') +
    '</div>';
}

// ── @MENTIONS — works the same way across every chat surface: a
// mention is stored inline in the message's own text field as
// @[Name](uid), not a separate array to keep in sync. That keeps the
// write path identical to a plain message everywhere it already
// exists, and keeps rendering simple: parse the one pattern, render
// everything else as before.
var MENTION_PATTERN = /@\[([^\]]+)\]\(([a-zA-Z0-9_-]+)\)/g;

// isMine picks a mention color that's actually readable against that
// bubble's background — "me" bubbles are solid indigo (var(--indigo)
// text would vanish into it), "them" bubbles are light.
function _renderMessageTextWithMentions(text, isMine) {
  text = text || '';
  var mentionColor = isMine ? '#CECBF6' : 'var(--indigo)';
  var out = '', lastIndex = 0, m;
  MENTION_PATTERN.lastIndex = 0;
  while ((m = MENTION_PATTERN.exec(text)) !== null) {
    out += _escapeHtml(text.slice(lastIndex, m.index));
    out += '<span onclick="event.stopPropagation();openUserProfile(\'' + m[2] + '\')" style="color:' + mentionColor + ';font-weight:700;cursor:pointer">@' + _escapeHtml(m[1]) + '</span>';
    lastIndex = MENTION_PATTERN.lastIndex;
  }
  out += _escapeHtml(text.slice(lastIndex));
  return out;
}

// Plain "@Name" for contexts that truncate by raw character count (reply
// previews, notification lines) — rendering the full clickable markup
// there risks slicing a mention in half mid-tag.
function _stripMentionMarkup(text) {
  return String(text || '').replace(MENTION_PATTERN, function (full, name) { return '@' + name; });
}

// Autocomplete: one shared dropdown element and match cache reused by
// every chat input, rather than one per surface.
window._mentionContext = null;
window._mentionMatches = [];

function _handleMentionInput(inputEl) {
  var value = inputEl.value;
  var caret = inputEl.selectionStart != null ? inputEl.selectionStart : value.length;
  var uptoCaret = value.slice(0, caret);
  var atIndex = uptoCaret.lastIndexOf('@');
  // Only trigger at the start of the input or right after whitespace —
  // not mid-word, so something like an email address never fires this.
  if (atIndex === -1 || (atIndex > 0 && !/\s/.test(uptoCaret[atIndex - 1]))) { _closeMentionDropdown(); return; }
  var query = uptoCaret.slice(atIndex + 1);
  if (/\s/.test(query)) { _closeMentionDropdown(); return; }
  window._mentionContext = { inputEl: inputEl, atIndex: atIndex };
  _ensureMyFriendsLoaded(function (profiles) {
    // The friends fetch only actually takes time on the first mention
    // typed in a session (cached after); guard against the input having
    // moved on by the time it resolves.
    if (!window._mentionContext || window._mentionContext.inputEl !== inputEl) return;
    var q = query.toLowerCase();
    var matches = Object.keys(profiles).filter(function (uid) {
      return profiles[uid].toLowerCase().indexOf(q) !== -1;
    }).slice(0, 6).map(function (uid) { return { uid: uid, name: profiles[uid] }; });
    if (!matches.length) { _closeMentionDropdown(); return; }
    _showMentionDropdown(inputEl, matches);
  });
}

function _showMentionDropdown(inputEl, matches) {
  var box = document.getElementById('mention-dropdown');
  if (!box) return;
  window._mentionMatches = matches;
  box.innerHTML = matches.map(function (f, i) {
    return '<div onmousedown="event.preventDefault();_pickMention(' + i + ')" style="padding:10px 14px;font-size:14px;color:var(--black);cursor:pointer;border-bottom:0.5px solid var(--rule)">' + _escapeHtml(f.name) + '</div>';
  }).join('');
  var rect = inputEl.getBoundingClientRect();
  box.style.left = rect.left + 'px';
  box.style.width = Math.max(180, rect.width) + 'px';
  box.style.bottom = (window.innerHeight - rect.top + 6) + 'px';
  box.style.display = 'block';
}

function _closeMentionDropdown() {
  var box = document.getElementById('mention-dropdown');
  if (box) box.style.display = 'none';
  window._mentionContext = null;
}

// Fires on blur too (tapping away without picking a suggestion) — the
// delay is so a tap ON a dropdown item registers first; onmousedown
// above (rather than onclick) is the other half of that same race,
// firing before the input's blur does.
function _handleMentionBlur() {
  setTimeout(_closeMentionDropdown, 200);
}

function _pickMention(index) {
  var match = window._mentionMatches[index];
  var ctx = window._mentionContext;
  if (!match || !ctx) return;
  var inputEl = ctx.inputEl;
  var value = inputEl.value;
  var caret = inputEl.selectionStart != null ? inputEl.selectionStart : value.length;
  var safeName = String(match.name || 'Friend').replace(/[\[\]()]/g, '');
  var mentionMarkup = '@[' + safeName + '](' + match.uid + ') ';
  inputEl.value = value.slice(0, ctx.atIndex) + mentionMarkup + value.slice(caret);
  var newCaret = ctx.atIndex + mentionMarkup.length;
  inputEl.focus();
  if (inputEl.setSelectionRange) inputEl.setSelectionRange(newCaret, newCaret);
  _closeMentionDropdown();
}

// Called from inside each input's existing Enter-to-send handler,
// before it sends: if the dropdown is open, Enter picks the first
// suggestion instead of sending — same convention as every other
// @mention autocomplete. Returns true when it intercepted the keypress
// (caller should NOT also send in that case).
function _mentionEnterIntercept() {
  var box = document.getElementById('mention-dropdown');
  if (box && box.style.display === 'block' && window._mentionMatches && window._mentionMatches.length) {
    _pickMention(0);
    return true;
  }
  return false;
}

function deleteOslMessage(msgId) {
  if (!window.db || !msgId) return;
  window.db.collection('oslChat').doc(msgId).delete()
    .catch(function(err){ console.error('Delete message error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}

function _fmtTime(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  var h = d.getHours(), m = d.getMinutes();
  var ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return h + ':' + (m < 10 ? '0' + m : m) + ' ' + ap;
}

// ── DAY DIVIDERS (iMessage-style "Today" / "Yesterday" / weekday breaks) ──
// Shared by every chat's render function — group() below turns a flat list
// of messages into groups keyed by calendar day, in original order.
function _chatDayKey(ts) {
  var d = new Date(ts || Date.now());
  return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
}
function _fmtChatDayDivider(ts) {
  var d = new Date(ts || Date.now());
  var now = new Date();
  var startOfDay = function(x){ return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
  var diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  var opts = { month: 'long', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}
// Builds the message HTML with a day-divider inserted wherever the calendar
// day changes between one message and the next. renderOne(c) must return the
// HTML for a single message (everything each chat already builds per-item).
// Pass dark=true for chats on a dark background (e.g. the feedback group).
function _chatHtmlWithDayDividers(msgs, renderOne, mode) {
  var html = '';
  var lastDayKey = null;
  var style = mode === true ? 'text-align:center;font-size:11px;color:rgba(255,255,255,0.5);font-weight:600' : '';
  msgs.forEach(function(c){
    var dayKey = _chatDayKey(c.ts);
    if (dayKey !== lastDayKey) {
      if (mode === 'osl') {
        html += '<div style="text-align:center;margin:4px 0 10px"><span style="display:inline-block;background:var(--indigo-deep);color:#C9C1F0;font-size:10.5px;font-weight:700;padding:5px 16px;border-radius:20px;letter-spacing:0.08em;text-transform:uppercase">' + _escapeHtml(_fmtChatDayDivider(c.ts)) + '</span></div>';
      } else if (mode) {
        html += '<div style="' + style + '">' + _escapeHtml(_fmtChatDayDivider(c.ts)) + '</div>';
      } else {
        html += '<div class="date-div">' + _escapeHtml(_fmtChatDayDivider(c.ts)) + '</div>';
      }
      lastDayKey = dayKey;
    }
    html += renderOne(c);
  });
  return html;
}

function renderOslChat(msgs) {
  var box = document.getElementById('osl-chat-msgs');
  var empty = document.getElementById('osl-chat-empty');
  if (!box) return;
  if (empty) empty.style.display = msgs.length ? 'none' : 'flex';
  var myUid = (window.currentUser && window.currentUser.uid) || (window.auth && window.auth.currentUser && window.auth.currentUser.uid);
  box.innerHTML = _chatHtmlWithDayDividers(msgs, function(c){
    if (c.system) {
      return _oslFeedNoticeHtml(c);
    }
    var mine = c.uid && c.uid === myUid;
    var badges = _reactionBadgesHtml(c.reactions, false);
    var lpHtml = c.linkPreview ? _oslPolaroidLinkPreviewHtml(c.linkPreview, c._id, mine) : '';
    var linkOnly = !!(c.linkPreview && c.text && c.text.trim() === c.linkPreview.url);
    // Tapping someone else's avatar jumps straight to their profile — no
    // equivalent for your own avatar since there's nowhere useful to send you
    var theirAvAttrs = c.uid ? ' onclick="openUserProfile(\'' + c.uid.replace(/'/g, "\\'") + '\')" style="cursor:pointer"' : '';
    if (mine) {
      var tsLabel = _fmtTime(c.ts);
      if (linkOnly) {
        return '<div class="msg mine"><div class="m-av av-a">' + _escapeHtml(_initials(c.author)) + '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;max-width:76%;min-width:0">' +
            lpHtml +
            '<div style="font-size:10px;color:var(--subtle);padding:0 2px">' + _escapeHtml(tsLabel) + '</div>' +
            badges +
          '</div></div>';
      }
      return '<div class="msg mine"><div class="m-av av-a">' + _escapeHtml(_initials(c.author)) + '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;max-width:76%;min-width:0">' +
          lpHtml +
          '<div class="bubble me" onclick="_msgDoubleTap(this,\'oslChat\',\'' + c._id + '\',true)" style="max-width:100%;cursor:pointer;background:linear-gradient(135deg,var(--indigo),#4E3F9E);box-shadow:0 4px 14px rgba(61,53,128,0.25)">' + _replyQuoteHtml(c.replyTo, true) + '<div class="b-txt">' + _renderMessageTextWithMentions(c.text, true) + '</div><div class="b-t">' + _escapeHtml(tsLabel) + (c.edited ? ' · Edited' : '') + '</div></div>' +
          badges +
        '</div></div>';
    }
    if (linkOnly) {
      return '<div class="msg"><div class="m-av av-b"' + theirAvAttrs + '>' + _escapeHtml(_initials(c.author)) + '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-start;max-width:76%;min-width:0">' +
          '<div class="b-who" style="margin-bottom:2px">' + _escapeHtml(c.author) + '</div>' +
          lpHtml +
          '<div style="font-size:10px;color:var(--subtle);padding:0 2px">' + _fmtTime(c.ts) + '</div>' +
          badges +
        '</div></div>';
    }
    return '<div class="msg"><div class="m-av av-b"' + theirAvAttrs + '>' + _escapeHtml(_initials(c.author)) + '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-start;max-width:76%;min-width:0">' +
        lpHtml +
        '<div class="bubble them" onclick="_msgDoubleTap(this,\'oslChat\',\'' + c._id + '\',false)" style="max-width:100%;cursor:pointer;background:var(--card);border:0.5px solid rgba(255,255,255,0.08)">' + _replyQuoteHtml(c.replyTo, false) + '<div class="b-who">' + _escapeHtml(c.author) + '</div><div class="b-txt">' + _renderMessageTextWithMentions(c.text, false) + '</div><div class="b-t">' + _fmtTime(c.ts) + (c.edited ? ' · Edited' : '') + '</div></div>' +
        badges +
      '</div></div>';
  }, 'osl');
  var panel = document.getElementById('osl2-chat');
  if (panel) panel.scrollTop = panel.scrollHeight;
}

// Posts a card into the OSL Feed for activity worth surfacing to everyone
// — a new song added, photos added, an RSVP, a message written in an
// artist's sub-chat, someone joining — deliberately NOT used for reactions
// (those only ever update a reactions field on an existing doc, they never
// create a new one, so they can never trigger this in the first place).
function _postOslFeedNotice(data) {
  if (!window.db) return;
  var payload = Object.assign({ ts: Date.now(), system: true }, data);
  window.db.collection('oslChat').add(payload).catch(function(err){ console.error('Post OSL feed notice error:', err); });
}

// One shared renderer for every notice type the Feed carries — keeps the
// "clickable purple card, icon, author line, jump-back" look consistent
// regardless of what kind of activity it's reporting.
function _oslFeedNoticeHtml(c) {
  var icon = '🎤', onclick = '', headline = '', detail = '';
  if (c.systemType === 'song') {
    icon = '🎵';
    onclick = "_jumpToActFromFeed('" + (c.actName || '').replace(/'/g, "\\'") + "')";
    headline = _escapeHtml(c.author) + ' added a song';
    detail = _escapeHtml(_stripMentionMarkup(c.text)) + ' · ' + _escapeHtml(c.actName || '');
  } else if (c.systemType === 'photo') {
    icon = '📷';
    onclick = "_jumpToOslPhotosFromFeed()";
    headline = _escapeHtml(c.author) + ' added ' + (c.photoCount > 1 ? c.photoCount + ' photos' : 'a photo');
  } else if (c.systemType === 'rsvp') {
    icon = '🎫';
    onclick = "_jumpToActFromFeed('" + (c.actName || '').replace(/'/g, "\\'") + "')";
    headline = _escapeHtml(c.author) + ' ' + _escapeHtml(c.text);
    detail = _escapeHtml(c.actName || '');
  } else if (c.systemType === 'actmsg') {
    icon = '💬';
    onclick = "_jumpToActFromFeed('" + (c.actName || '').replace(/'/g, "\\'") + "')";
    headline = _escapeHtml(c.author) + ' in ' + _escapeHtml(c.actName || '');
    detail = _escapeHtml(_stripMentionMarkup(c.text));
  } else if (c.systemType === 'join') {
    icon = '👋';
    onclick = c.uid ? "openUserProfile('" + c.uid.replace(/'/g, "\\'") + "')" : '';
    headline = _escapeHtml(c.author) + ' joined';
  } else {
    return '';
  }
  return '<div' + (onclick ? ' onclick="' + onclick + '" style="cursor:pointer' : ' style="') + ';background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.1);border-radius:18px;padding:12px 14px;display:flex;align-items:center;gap:12px;margin-bottom:2px">' +
    '<div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">' + icon + '</div>' +
    '<div style="flex:1;min-width:0">' +
      '<div style="font-size:11px;font-weight:700;color:rgba(168,159,232,1);text-transform:uppercase;letter-spacing:0.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + headline + '</div>' +
      (detail ? '<div style="font-size:13px;color:white;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + detail + '</div>' : '') +
    '</div>' +
    (onclick ? '<svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="1 1 6 6 1 11"/></svg>' : '') +
  '</div>';
}

// Looks up an act's time/headliner status from the lineup data so a feed
// notice only needs to carry the act's name, not duplicate the rest.
function _findActMeta(actName) {
  for (var day in stageData) {
    for (var stage in stageData[day]) {
      var acts = (stageData[day][stage] || {}).acts || [];
      for (var i = 0; i < acts.length; i++) {
        if (acts[i].name === actName) return { time: acts[i].time, headliner: !!acts[i].headliner };
      }
    }
  }
  return { time: '', headliner: false };
}

function _jumpToActFromFeed(actName) {
  var meta = _findActMeta(actName);
  openActDetail(actName, meta.time, meta.headliner);
}

// You're always already on the OSL screen when you'd see this notice (the
// Feed only ever renders there), so this just needs to flip to the More
// tab and open Photos directly — Photos no longer has its own top-level
// tab now that it lives behind the More menu.
function _jumpToOslPhotosFromFeed() {
  var tabs = document.querySelectorAll('.osl-main-tab');
  var moreTab = null;
  tabs.forEach(function(t){ if (t.textContent.trim() === 'More') moreTab = t; });
  oslTab('more', moreTab ? { target: moreTab } : null);
  oslMoreOpenPhotos();
}

function sendOslMessage() {
  console.log('[oslChat] sendOslMessage called');
  var inp = document.getElementById('osl-chat-field');
  console.log('[oslChat] input element found:', !!inp);
  var text = inp ? inp.value.trim() : '';
  console.log('[oslChat] text value:', JSON.stringify(text));
  if (!text) { console.log('[oslChat] aborting: empty text'); return; }
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  console.log('[oslChat] user:', user ? user.uid : null, 'db present:', !!window.db);
  if (!user || !window.db) {
    console.log('[oslChat] aborting: no user or no db');
    if (typeof ib_toast==='function') ib_toast('Sign in to chat');
    return;
  }
  var author = (window.userData && window.userData.name) || 'You';
  if (inp) inp.value = '';
  var msgData = { uid: user.uid, author: author, text: text, ts: Date.now() };
  var replyTo = _consumeReplyForSend('oslChat');
  if (replyTo) msgData.replyTo = replyTo;
  var url = _extractFirstUrl(text);
  console.log('[oslChat] writing to Firestore…');
  if (!url) {
    window.db.collection('oslChat').add(msgData)
      .then(function(ref){ console.log('[oslChat] write succeeded, doc id:', ref.id); })
      .catch(function(err){ console.error('[oslChat] write FAILED:', err.code, err.message); if (typeof ib_toast==='function') ib_toast('Chat unavailable — ' + (err && err.message ? err.message : 'check Firestore rules')); });
    return;
  }
  _fetchLinkPreview(url).then(function(lp){
    if (lp && lp.url) msgData.linkPreview = lp;
    return window.db.collection('oslChat').add(msgData);
  }).then(function(ref){ console.log('[oslChat] write succeeded, doc id:', ref.id); })
    .catch(function(err){ console.error('[oslChat] write FAILED:', err.code, err.message); if (typeof ib_toast==='function') ib_toast('Chat unavailable — ' + (err && err.message ? err.message : 'check Firestore rules')); });
}
