// ── LINK PREVIEWS (iMessage-style rich cards for pasted URLs) ──
// Calls a small Vercel serverless function (/api/unfurl) that fetches the
// page server-side and pulls its Open Graph tags — this can't be done
// directly from the browser because most sites block cross-origin fetches.
function _extractFirstUrl(text) {
  var m = (text || '').match(/https?:\/\/[^\s]+/i);
  return m ? m[0].replace(/[),.!?\]]+$/, '') : null;
}

function _fetchLinkPreview(url) {
  var timeout = new Promise(function(resolve){ setTimeout(function(){ resolve(null); }, 4000); });
  var req = fetch('/api/unfurl?url=' + encodeURIComponent(url)).then(function(r){
    return r.ok ? r.json() : null;
  }).catch(function(){ return null; });
  return Promise.race([req, timeout]);
}

function _linkPreviewCardHtml(lp) {
  if (!lp || !lp.url) return '';
  var imgHtml = lp.image ? '<img src="' + _escapeHtml(lp.image) + '" style="width:100%;aspect-ratio:1.9/1;object-fit:cover;display:block;background:var(--bg)" onerror="this.style.display=\'none\'">' : '';
  return '<a href="' + _escapeHtml(lp.url) + '" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;border-radius:14px;overflow:hidden;border:0.5px solid var(--rule);background:var(--card);max-width:230px;margin-bottom:5px">' +
    imgHtml +
    '<div style="padding:8px 10px">' +
      (lp.title ? '<div style="font-size:12.5px;font-weight:700;color:var(--black);line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">' + _escapeHtml(lp.title) + '</div>' : '') +
      '<div style="font-size:11px;color:var(--subtle);margin-top:2px">' + _escapeHtml(lp.siteName || '') + '</div>' +
    '</div>' +
  '</a>';
}

// OSL Feed's own take on a link preview — a slightly-rotated polaroid with
// a handwritten-style caption, rather than the plain card every other chat
// surface uses. Scoped to renderOslChat only.
function _oslPolaroidLinkPreviewHtml(lp, msgId, isMine) {
  if (!lp || !lp.url) return '';
  var imgHtml = lp.image ? '<img src="' + _escapeHtml(lp.image) + '" style="width:100%;height:120px;object-fit:cover;display:block;border-radius:1px;background:var(--bg)" onerror="this.style.display=\'none\'">' : '';
  var caption = lp.title || lp.siteName || '';
  var safeUrl = _escapeHtml(lp.url).replace(/'/g, "\\'");
  var tapHandler = msgId
    ? '_linkCardTap(this,\'' + safeUrl + '\',\'oslChat\',\'' + msgId + '\',' + (isMine ? 'true' : 'false') + ')'
    : '';
  return '<div' + (tapHandler ? ' onclick="' + tapHandler + '"' : '') + ' style="display:block;cursor:pointer;background:white;padding:8px;box-shadow:0 6px 16px rgba(61,53,128,0.15);border-radius:2px;transform:rotate(-1.2deg);width:180px;margin-bottom:8px">' +
    imgHtml +
    (caption ? '<div style="margin-top:8px;font-size:14px;font-weight:600;color:var(--black);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(caption) + '</div>' : '') +
  '</div>';
}

function renderGroupChat(msgs) {
  var box = document.getElementById('group-chat-msgs');
  var empty = document.getElementById('group-chat-empty');
  if (!box) return;
  if (empty) empty.style.display = msgs.length ? 'none' : 'flex';
  var myUid = (window.currentUser && window.currentUser.uid) || (window.auth && window.auth.currentUser && window.auth.currentUser.uid);
  box.innerHTML = _chatHtmlWithDayDividers(msgs, function(c){
    if (c.system && c.systemType === 'game') {
      return '<div onclick="jumpToGroupGame(' + c.gamePk + ')" style="cursor:pointer;background:var(--indigo-light);border-radius:14px;padding:10px 14px;display:flex;align-items:center;gap:10px">' +
        '<div style="font-size:20px;flex-shrink:0">⚾</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:11px;font-weight:700;color:var(--indigo);text-transform:uppercase;letter-spacing:0.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(c.author) + ' in ' + _escapeHtml(c.gameLabel || 'a game') + '</div>' +
          '<div style="font-size:13px;color:var(--black);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(_stripMentionMarkup(c.text)) + '</div>' +
        '</div>' +
        '<svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="var(--subtle)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="1 1 6 6 1 11"/></svg>' +
      '</div>';
    }
    if (c.system && c.systemType === 'join') {
      return '<div style="text-align:center;padding:2px 0 4px"><span style="font-size:11.5px;color:var(--subtle);background:var(--bg);padding:5px 12px;border-radius:12px;display:inline-block">👋 ' + _escapeHtml(c.author) + ' joined the group</span></div>';
    }
    var mine = c.uid && c.uid === myUid;
    var badges = _reactionBadgesHtml(c.reactions, false);
    var lpHtml = c.linkPreview ? _linkPreviewCardHtml(c.linkPreview) : '';
    var linkOnly = !!(c.linkPreview && c.text && c.text.trim() === c.linkPreview.url);
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
          '<div class="bubble me" onclick="_msgDoubleTap(this,\'groupChats\',\'' + c._id + '\',true)" style="max-width:100%;cursor:pointer">' + _replyQuoteHtml(c.replyTo, true) + '<div class="b-txt">' + _renderMessageTextWithMentions(c.text, true) + '</div><div class="b-t">' + _escapeHtml(tsLabel) + (c.edited ? ' · Edited' : '') + '</div></div>' +
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
        '<div class="bubble them" onclick="_msgDoubleTap(this,\'groupChats\',\'' + c._id + '\',false)" style="max-width:100%;cursor:pointer">' + _replyQuoteHtml(c.replyTo, false) + '<div class="b-who">' + _escapeHtml(c.author) + '</div><div class="b-txt">' + _renderMessageTextWithMentions(c.text, false) + '</div><div class="b-t">' + _fmtTime(c.ts) + (c.edited ? ' · Edited' : '') + '</div></div>' +
        badges +
      '</div></div>';
  });
  var panel = document.getElementById('gd-chat-panel');
  if (panel) panel.scrollTop = panel.scrollHeight;
}

function sendGroupMessage() {
  var inp = document.getElementById('group-chat-field');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var groupId = window._activeGroupId;
  if (!user || !window.db || !groupId) { if (typeof ib_toast==='function') ib_toast('Sign in to chat'); return; }
  var author = (window.userData && window.userData.name) || 'You';
  if (inp) inp.value = '';
  var msgData = { groupId: groupId, uid: user.uid, author: author, text: text, ts: Date.now() };
  var replyTo = _consumeReplyForSend('groupChats');
  if (replyTo) msgData.replyTo = replyTo;
  var url = _extractFirstUrl(text);
  if (!url) {
    window.db.collection('groupChats').add(msgData)
      .catch(function(err){ console.error('Group send error:', err); if (typeof ib_toast==='function') ib_toast('Could not send — ' + (err && err.message ? err.message : 'check Firestore rules')); });
    return;
  }
  _fetchLinkPreview(url).then(function(lp){
    if (lp && lp.url) msgData.linkPreview = lp;
    return window.db.collection('groupChats').add(msgData);
  }).catch(function(err){ console.error('Group send error:', err); if (typeof ib_toast==='function') ib_toast('Could not send — ' + (err && err.message ? err.message : 'check Firestore rules')); });
}

function deleteGroupMessage(msgId) {
  if (!window.db || !msgId) return;
  window.db.collection('groupChats').doc(msgId).delete()
    .catch(function(err){ console.error('Delete group message error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}
