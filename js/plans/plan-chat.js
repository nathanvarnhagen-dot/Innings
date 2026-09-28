// ── PER-PLAN GROUP CHAT ──
window._futureChatStarted = {};

function startFutureMomentChat(momentId) {
  if (window._futureChatStarted[momentId]) return;
  if (!window.db) return;
  window._futureChatStarted[momentId] = true;
  window.db.collection('futureMomentChat').where('momentId','==',momentId).limit(300).onSnapshot(function(snap){
    if (window._openFutureId !== momentId) return;
    var msgs = [];
    snap.forEach(function(doc){ msgs.push(Object.assign({ _id: doc.id }, doc.data())); });
    msgs.sort(function(a,b){ return (a.ts || 0) - (b.ts || 0); });
    renderFutureMomentChat(msgs);
  }, function(err){
    console.error('Future moment chat error:', err);
    window._futureChatStarted[momentId] = false;
    if (typeof ib_toast==='function') ib_toast('Chat unavailable — check Firestore rules');
  });
}

function renderFutureMomentChat(msgs) {
  var box = document.getElementById('future-chat-msgs');
  var empty = document.getElementById('future-chat-empty');
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
          '<div class="bubble me" onclick="_msgDoubleTap(this,\'futureMomentChat\',\'' + c._id + '\',true)" style="max-width:100%;cursor:pointer">' + _replyQuoteHtml(c.replyTo, true) + '<div class="b-txt">' + _renderMessageTextWithMentions(c.text, true) + '</div><div class="b-t">' + _fmtTime(c.ts) + (c.edited ? ' · Edited' : '') + '</div></div>' +
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
        '<div class="bubble them" onclick="_msgDoubleTap(this,\'futureMomentChat\',\'' + c._id + '\',false)" style="max-width:100%;cursor:pointer">' + _replyQuoteHtml(c.replyTo, false) + '<div class="b-who">' + _escapeHtml(c.author) + '</div><div class="b-txt">' + _renderMessageTextWithMentions(c.text, false) + '</div><div class="b-t">' + _fmtTime(c.ts) + (c.edited ? ' · Edited' : '') + '</div></div>' +
        badges +
      '</div></div>';
  });
  var panel = document.getElementById('fd-scroll');
  if (panel) panel.scrollTop = panel.scrollHeight;
}

function deleteFutureMomentMessage(msgId) {
  if (!window.db || !msgId) return;
  window.db.collection('futureMomentChat').doc(msgId).delete()
    .catch(function(err){ console.error('Delete future chat message error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}

function sendFutureMomentMessage() {
  if (!window._openFutureId) return;
  var inp = document.getElementById('fd-chat-field');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in to chat'); return; }
  var author = (window.userData && window.userData.name) || 'You';
  var momentId = window._openFutureId;
  if (inp) inp.value = '';
  var msgData = { momentId: momentId, uid: user.uid, author: author, text: text, ts: Date.now() };
  var replyTo = _consumeReplyForSend('futureMomentChat');
  if (replyTo) msgData.replyTo = replyTo;
  var url = _extractFirstUrl(text);
  if (!url) {
    window.db.collection('futureMomentChat').add(msgData)
      .catch(function(err){ console.error('Future chat send error:', err); if (typeof ib_toast==='function') ib_toast('Could not send — ' + (err && err.message ? err.message : 'check Firestore rules')); });
    return;
  }
  _fetchLinkPreview(url).then(function(lp){
    if (lp && lp.url) msgData.linkPreview = lp;
    return window.db.collection('futureMomentChat').add(msgData);
  }).catch(function(err){ console.error('Future chat send error:', err); if (typeof ib_toast==='function') ib_toast('Could not send — ' + (err && err.message ? err.message : 'check Firestore rules')); });
}

function renderFutureEdit(m) {
  var box = document.getElementById('fd-scroll');
  if (!box) return;
  var theme = m.theme || 'linear-gradient(135deg,#FF6B6B 0%,#FFA94D 45%,#845EF7 100%)';
  var custom = (window.userData && window.userData.customVibes) || [];
  var customStrs = custom.map(function(v){ return (v.emoji || '🏷️') + ' ' + v.label; });
  var knownVibes = FUTURE_VIBE_FIXED.concat(customStrs);
  var savedVibe = m.vibe || '';
  window._fdVibe = savedVibe;
  window._fdVibeMode = knownVibes.indexOf(savedVibe) !== -1 ? 'fixed' : 'other';
  var themes = ['linear-gradient(135deg,#FF6B6B 0%,#FFA94D 45%,#845EF7 100%)','linear-gradient(135deg,#4ADE80 0%,#22D3EE 100%)','linear-gradient(135deg,#F472B6 0%,#FB923C 100%)','linear-gradient(135deg,#60A5FA 0%,#A78BFA 100%)','linear-gradient(135deg,#FBBF24 0%,#F87171 100%)','linear-gradient(135deg,#34D399 0%,#3B82F6 100%)','linear-gradient(135deg,#F87171 0%,#EC4899 100%)','linear-gradient(135deg,#A78BFA 0%,#38BDF8 100%)','linear-gradient(135deg,#FACC15 0%,#4ADE80 100%)','linear-gradient(135deg,#818CF8 0%,#F472B6 100%)'];
  var themeSwatches = themes.map(function(t){
    var active = t === theme;
    return '<div onclick="fdSelectTheme(this,\'' + t + '\')" style="width:34px;height:34px;border-radius:50%;background:' + t + ';cursor:pointer;border:2px solid ' + (active?'#0D0820':'transparent') + ';flex-shrink:0"></div>';
  }).join('');
  var fdBoxScoreHtml = m.boxScore ?
    _boxScoreCardHtml(m.boxScore, false) +
    '<div onclick="futureRemoveBoxScore(\'' + m._id + '\')" style="font-size:12px;color:var(--subtle);font-weight:600;cursor:pointer;margin-top:8px;text-align:center">Remove box score</div>' :
    '<div onclick="openBoxScoreModal({type:\'future\',id:\'' + m._id + '\'},\'' + _escapeHtml(m.date || '') + '\')" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:var(--bg);border:1.5px dashed var(--rule);cursor:pointer">' +
      '<div style="font-size:20px">⚾</div>' +
      '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--black)">Attach a game</div><div style="font-size:11px;color:var(--subtle)">Pulls the final score once it\'s in — any sport</div></div>' +
    '</div>';

  window._fdCoverPhoto = m.coverPhoto || '';
  var fdCoverHasPhoto = !!m.coverPhoto;

  box.innerHTML =
    '<div id="fd-hero" style="background:' + theme + ';padding:28px 20px;position:relative;overflow:hidden">' +
      '<div id="fd-hero-bg-photo" style="position:absolute;inset:0;background-size:cover;background-position:center;opacity:' + (fdCoverHasPhoto ? '1' : '0') + ';transition:opacity 0.2s' + (fdCoverHasPhoto ? ';background-image:url(' + m.coverPhoto + ')' : '') + '"></div>' +
      '<div id="fd-hero-overlay" style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.55));opacity:' + (fdCoverHasPhoto ? '1' : '0') + ';transition:opacity 0.2s;pointer-events:none"></div>' +
      '<div style="position:relative;z-index:2">' +
        '<input id="fd-title" value="' + _escapeHtml(m.title || '') + '" style="width:100%;background:transparent;border:none;outline:none;font-size:24px;font-weight:800;color:white;-webkit-text-fill-color:white;caret-color:white;font-family:inherit;letter-spacing:-0.5px">' +
      '</div>' +
    '</div>' +
    '<div style="background:var(--card);padding:16px 20px;border-bottom:0.5px solid var(--rule)">' +
      '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">Theme</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px" id="fd-theme-pills">' + themeSwatches + '</div>' +
    '</div>' +
    '<div style="background:var(--card);padding:16px 20px;border-bottom:0.5px solid var(--rule)">' +
      '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">Cover photo</div>' +
      '<input type="file" id="fd-cover-input" accept="image/*" style="display:none" onchange="fdPreviewCoverPhoto(this)">' +
      '<div style="position:relative">' +
        '<div id="fd-cover-preview" style="width:100%;height:110px;border-radius:14px;background:var(--bg);border:' + (fdCoverHasPhoto ? 'none' : '1.5px dashed var(--rule)') + ';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;cursor:pointer;overflow:hidden;background-size:cover;background-position:center' + (fdCoverHasPhoto ? ';background-image:url(' + m.coverPhoto + ')' : '') + '" onclick="document.getElementById(\'fd-cover-input\').click()">' +
          (fdCoverHasPhoto ? '' :
            '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--subtle)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
            '<div style="font-size:12px;color:var(--subtle);font-weight:500">Add a cover photo</div>' +
            '<div style="font-size:10px;color:var(--subtle);opacity:0.6;text-align:center;padding:0 12px">optional — shown wherever this plan appears</div>') +
        '</div>' +
        '<button id="fd-cover-remove" onclick="event.stopPropagation();fdRemoveCoverPhoto()" style="display:' + (fdCoverHasPhoto ? 'flex' : 'none') + ';position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;background:rgba(10,10,15,0.6);border:none;color:white;font-size:14px;font-weight:700;cursor:pointer;align-items:center;justify-content:center;font-family:inherit">✕</button>' +
      '</div>' +
    '</div>' +
    '<div style="background:var(--card);padding:16px 20px;border-bottom:0.5px solid var(--rule);display:flex;align-items:center;justify-content:space-between">' +
      '<div style="font-size:14px;font-weight:600;color:var(--black)">Date</div>' +
      '<input type="date" id="fd-date" value="' + _escapeHtml(m.date || '') + '" style="font-size:14px;color:var(--indigo);font-weight:600;border:none;outline:none;background:transparent;font-family:inherit">' +
    '</div>' +
    '<div style="background:var(--card);padding:16px 20px;border-bottom:0.5px solid var(--rule);display:flex;align-items:center;justify-content:space-between">' +
      '<div style="font-size:14px;font-weight:600;color:var(--black)">Time</div>' +
      '<input type="time" id="fd-time" value="' + _escapeHtml(m.time || '') + '" style="font-size:14px;color:var(--indigo);font-weight:600;border:none;outline:none;background:transparent;font-family:inherit">' +
    '</div>' +
    '<div style="background:var(--card);padding:16px 20px;border-bottom:0.5px solid var(--rule)">' +
      '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Where</div>' +
      '<input id="fd-location" value="' + _escapeHtml(m.location || '') + '" placeholder="Add a location" oninput="_updateLocationLinks(\'fd\', this.value)" style="width:100%;font-size:15px;color:var(--black);border:none;outline:none;background:transparent;font-family:inherit">' +
      '<div id="fd-location-preview" style="display:none;margin-top:12px;border-radius:14px;border:0.5px solid var(--rule);padding:12px 14px;background:var(--bg)">' +
        '<div id="fd-location-preview-text" style="font-size:13px;font-weight:600;color:var(--black);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:10px"></div>' +
        '<div style="display:flex;gap:8px">' +
          '<a id="fd-location-google" target="_blank" rel="noopener" style="flex:1;text-align:center;background:var(--card);border:0.5px solid var(--rule);border-radius:10px;padding:8px 4px;font-size:11.5px;font-weight:700;color:var(--indigo);text-decoration:none">Google Maps</a>' +
          '<a id="fd-location-apple" target="_blank" rel="noopener" style="flex:1;text-align:center;background:var(--card);border:0.5px solid var(--rule);border-radius:10px;padding:8px 4px;font-size:11.5px;font-weight:700;color:var(--indigo);text-decoration:none">Apple Maps</a>' +
          '<a id="fd-location-waze" target="_blank" rel="noopener" style="flex:1;text-align:center;background:var(--card);border:0.5px solid var(--rule);border-radius:10px;padding:8px 4px;font-size:11.5px;font-weight:700;color:var(--indigo);text-decoration:none">Waze</a>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div style="background:var(--card);padding:16px 20px;border-bottom:0.5px solid var(--rule)">' +
      '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Game</div>' +
      fdBoxScoreHtml +
    '</div>' +
    '<div style="background:var(--card);padding:16px 20px;border-bottom:0.5px solid var(--rule)">' +
      '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">What kind of plan</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px" id="fd-vibe-pills"></div>' +
      '<div id="fd-other-input-row" style="display:none;gap:8px;margin-top:10px">' +
        '<input id="fd-other-emoji" style="width:56px;font-size:20px;text-align:center;border:0.5px solid var(--rule);border-radius:12px;padding:12px 0;outline:none;font-family:inherit;background:var(--bg)" placeholder="🏷️" oninput="_syncFdOtherVibe()">' +
        '<input id="fd-other-label" style="flex:1;font-size:15px;font-weight:500;color:var(--black);border:0.5px solid var(--rule);border-radius:12px;padding:12px 14px;outline:none;background:var(--bg);font-family:inherit" placeholder="What kind of plan is this?" oninput="_syncFdOtherVibe()">' +
      '</div>' +
    '</div>' +
    '<div style="background:var(--card);padding:16px 20px;border-bottom:0.5px solid var(--rule)">' +
      '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Tickets</div>' +
      '<input id="fd-ticket-link" value="' + _escapeHtml(m.ticketLink || '') + '" placeholder="Paste a ticket link (SeatGeek, Ticketmaster, etc.)" style="width:100%;font-size:14px;color:var(--black);border:0.5px solid var(--rule);border-radius:12px;padding:11px 14px;outline:none;background:var(--bg);font-family:inherit">' +
      (m.ticketLink ? '<div onclick="document.getElementById(\'fd-ticket-link\').value=\'\'" style="font-size:11px;color:var(--subtle);font-weight:600;cursor:pointer;margin-top:6px">Clear link</div>' : '<div style="font-size:11px;color:var(--subtle);margin-top:6px;line-height:1.4">Optional — everyone invited will see a "Get Tickets" button that opens this link.</div>') +
    '</div>' +
    '<div style="background:var(--card);padding:16px 20px;border-bottom:0.5px solid var(--rule)">' +
      '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">Stops</div>' +
      '<div id="fd-stops-editor"></div>' +
    '</div>' +
    '<div style="background:var(--card);padding:16px 20px;border-bottom:0.5px solid var(--rule)">' +
      '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px">Who\'s invited</div>' +
      '<div id="fd-guest-list"></div>' +
      '<div style="display:flex;gap:16px;margin-top:10px">' +
        '<div style="font-size:12px;color:var(--indigo);font-weight:600;cursor:pointer" onclick="fdToggleAddFriends()">＋ Add more friends</div>' +
      '</div>' +
      '<div id="fd-add-friends" style="display:none;margin-top:10px"></div>' +
      '<div onclick="fdShareInvite()" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:var(--bg);border:1.5px dashed var(--rule);cursor:pointer;margin-top:12px">' +
        '<div style="font-size:20px">📲</div>' +
        '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--black)">Invite someone new</div><div style="font-size:11px;color:var(--subtle)">Share a link — they\'ll join this plan the moment they sign up</div></div>' +
      '</div>' +
    '</div>' +
    '<div style="background:var(--card);padding:16px 20px;border-bottom:0.5px solid var(--rule);display:flex;align-items:center;justify-content:space-between">' +
      '<div style="max-width:220px">' +
        '<div style="font-size:14px;font-weight:600;color:var(--black)">Make it public</div>' +
        '<div style="font-size:12px;color:var(--subtle);margin-top:2px;line-height:1.4">Anyone in your Innings circle can see it in their feed and ask to come.</div>' +
      '</div>' +
      '<div id="fd-public-toggle" onclick="fdTogglePublic()" style="width:46px;height:28px;border-radius:20px;background:' + (m.public ? 'var(--indigo)' : 'var(--rule)') + ';position:relative;cursor:pointer;flex-shrink:0">' +
        '<div id="fd-public-knob" style="width:22px;height:22px;border-radius:50%;background:white;position:absolute;top:3px;left:' + (m.public ? '21px' : '3px') + ';transition:left 0.2s ease;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></div>' +
      '</div>' +
    '</div>' +
    '<div style="padding:20px">' +
      '<button onclick="futureDetailSave()" style="width:100%;background:var(--indigo);color:white;border:none;border-radius:16px;padding:16px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">Save changes</button>' +
    '</div>';

  window._fdTheme = theme;
  window._fdInvitees = (m.taggedUids || []).slice();
  window._fdPublic = !!m.public;
  window._stopsEditorContainerId = 'fd-stops-editor';
  window._stopsEditorList = (m.stops || []).map(function(s){ return Object.assign({}, s); });
  renderFdGuestList(m);
  renderFdVibePills();
  renderStopsEditor();
  _updateLocationLinks('fd', m.location);
}

function fdTogglePublic() {
  window._fdPublic = !window._fdPublic;
  var track = document.getElementById('fd-public-toggle');
  var knob = document.getElementById('fd-public-knob');
  if (track) track.style.background = window._fdPublic ? 'var(--indigo)' : 'var(--rule)';
  if (knob) knob.style.left = window._fdPublic ? '21px' : '3px';
}

function renderFdGuestList(m) {
  var listEl = document.getElementById('fd-guest-list');
  if (!listEl || !window.db) return;
  var uids = window._fdInvitees || [];
  if (!uids.length) { listEl.innerHTML = '<div style="font-size:13px;color:var(--subtle)">No one invited yet</div>'; return; }
  listEl.innerHTML = '<div style="font-size:13px;color:var(--subtle)">Loading…</div>';
  Promise.all(uids.map(function(uid){ return window.db.collection('users').doc(uid).get(); })).then(function(docs){
    var rsvps = m.rsvps || {};
    listEl.innerHTML = docs.map(function(doc){
      var d = doc.data() || {};
      var nm = d.name || 'Friend';
      var status = rsvps[doc.id] || 'pending';
      var label = status === 'going' ? 'Going' : status === 'maybe' ? 'Maybe' : status === 'no' ? "Can't go" : 'Pending';
      var color = status === 'going' ? 'var(--win)' : status === 'no' ? 'var(--loss)' : 'var(--subtle)';
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--rule)">' +
        '<div style="width:34px;height:34px;border-radius:50%;background:var(--indigo-light);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--indigo)">' + _escapeHtml(_initialsFallback(nm)) + '</div>' +
        '<div style="flex:1;font-size:14px;font-weight:600;color:var(--black)">' + _escapeHtml(nm) + '</div>' +
        '<div style="font-size:11px;font-weight:700;color:' + color + '">' + label + '</div>' +
        '<div onclick="fdRemoveInvitee(\'' + doc.id + '\')" style="width:20px;height:20px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--subtle);cursor:pointer">×</div>' +
      '</div>';
    }).join('');
  });
}

function fdRemoveInvitee(uid) {
  window._fdInvitees = (window._fdInvitees || []).filter(function(u){ return u !== uid; });
  var m = (window._futureMomentsCache || {})[window._openFutureId];
  if (m) renderFdGuestList(m);
}

function fdToggleAddFriends() {
  var el = document.getElementById('fd-add-friends');
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    fdLoadAddableFriends();
  } else {
    el.style.display = 'none';
  }
}

function fdLoadAddableFriends() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var el = document.getElementById('fd-add-friends');
  if (!user || !window.db || !el) return;
  el.innerHTML = '<div style="font-size:12px;color:var(--subtle)">Loading friends…</div>';
  Promise.all([
    window.db.collection('friendRequests').where('fromUid','==',user.uid).where('status','==','accepted').get(),
    window.db.collection('friendRequests').where('toUid','==',user.uid).where('status','==','accepted').get()
  ]).then(function(results){
    var uids = [];
    results[0].forEach(function(d){ uids.push(d.data().toUid); });
    results[1].forEach(function(d){ uids.push(d.data().fromUid); });
    uids = uids.filter(function(v,i){ return uids.indexOf(v) === i; });
    if (!uids.length) { el.innerHTML = '<div style="font-size:12px;color:var(--subtle)">You don\'t have any confirmed Innings friends yet — send a friend request from someone\'s profile, and once they accept, they\'ll show up here.</div>'; return; }
    var already = window._fdInvitees || [];
    Promise.all(uids.map(function(uid){ return window.db.collection('users').doc(uid).get(); })).then(function(docs){
      el.innerHTML = docs.map(function(doc){
        var d = doc.data() || {};
        var nm = d.name || 'Friend';
        var isTagged = already.indexOf(doc.id) !== -1;
        if (isTagged) {
          return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;opacity:0.5">' +
            '<div style="width:32px;height:32px;border-radius:50%;background:var(--indigo-light);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--indigo)">' + _escapeHtml(_initialsFallback(nm)) + '</div>' +
            '<div style="flex:1;font-size:13px;font-weight:600;color:var(--black)">' + _escapeHtml(nm) + '</div>' +
            '<div style="font-size:11px;color:var(--subtle)">Already invited</div>' +
          '</div>';
        }
        return '<div onclick="fdAddInvitee(\'' + doc.id + '\')" style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer">' +
          '<div style="width:32px;height:32px;border-radius:50%;background:var(--indigo-light);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--indigo)">' + _escapeHtml(_initialsFallback(nm)) + '</div>' +
          '<div style="flex:1;font-size:13px;font-weight:600;color:var(--black)">' + _escapeHtml(nm) + '</div>' +
          '<div style="font-size:12px;color:var(--indigo);font-weight:700">+ Add</div>' +
        '</div>';
      }).join('');
    }).catch(function(err){
      console.error('Load friend profiles error:', err);
      el.innerHTML = '<div style="font-size:12px;color:var(--subtle)">Could not load friends — try again</div>';
    });
  }).catch(function(err){
    console.error('Load addable friends error:', err);
    el.innerHTML = '<div style="font-size:12px;color:var(--subtle)">Could not load friends — ' + (err && err.message ? err.message : 'try again') + '</div>';
  });
}

function fdAddInvitee(uid) {
  window._fdInvitees = window._fdInvitees || [];
  if (window._fdInvitees.indexOf(uid) === -1) window._fdInvitees.push(uid);
  var m = (window._futureMomentsCache || {})[window._openFutureId];
  if (m) renderFdGuestList(m);
  fdLoadAddableFriends();
}

function fdSelectTheme(el, gradient) {
  document.querySelectorAll('#fd-theme-pills > div').forEach(function(p){ p.style.borderColor = 'transparent'; });
  el.style.borderColor = '#0D0820';
  window._fdTheme = gradient;
  var hero = document.getElementById('fd-hero');
  if (hero) hero.style.background = gradient;
}

function fdPreviewCoverPhoto(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    _downscaleImage(e.target.result, 1200, function(small) {
      window._fdCoverPhoto = small;
      var preview = document.getElementById('fd-cover-preview');
      if (preview) {
        preview.style.backgroundImage = 'url(' + small + ')';
        preview.style.border = 'none';
        preview.innerHTML = '';
      }
      var removeBtn = document.getElementById('fd-cover-remove');
      if (removeBtn) removeBtn.style.display = 'flex';
      _applyFdHeroCoverPhoto(small);
    });
  };
  reader.readAsDataURL(input.files[0]);
}

function fdRemoveCoverPhoto() {
  window._fdCoverPhoto = '';
  var preview = document.getElementById('fd-cover-preview');
  if (preview) {
    preview.style.backgroundImage = '';
    preview.style.border = '1.5px dashed var(--rule)';
    preview.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--subtle)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
      '<div style="font-size:12px;color:var(--subtle);font-weight:500">Add a cover photo</div>' +
      '<div style="font-size:10px;color:var(--subtle);opacity:0.6;text-align:center;padding:0 12px">optional — shown wherever this plan appears</div>';
  }
  var removeBtn = document.getElementById('fd-cover-remove');
  if (removeBtn) removeBtn.style.display = 'none';
  var input = document.getElementById('fd-cover-input');
  if (input) input.value = '';
  _applyFdHeroCoverPhoto('');
}

function _applyFdHeroCoverPhoto(url) {
  var bgEl = document.getElementById('fd-hero-bg-photo');
  var overlayEl = document.getElementById('fd-hero-overlay');
  if (bgEl) {
    bgEl.style.backgroundImage = url ? 'url(' + url + ')' : '';
    bgEl.style.opacity = url ? '1' : '0';
  }
  if (overlayEl) overlayEl.style.opacity = url ? '1' : '0';
}

function renderFdVibePills() {
  var container = document.getElementById('fd-vibe-pills');
  if (!container) return;
  var custom = (window.userData && window.userData.customVibes) || [];
  var customStrs = custom.map(function(v){ return (v.emoji || '🏷️') + ' ' + v.label; });
  var all = FUTURE_VIBE_FIXED.concat(customStrs);
  var current = window._fdVibe || '';
  var isOther = window._fdVibeMode === 'other';
  container.innerHTML = all.map(function(v){
    var active = !isOther && v === current;
    return '<div onclick="fdSelectVibe(this,\'' + v.replace(/'/g, "\\'") + '\')" style="padding:8px 14px;border-radius:20px;background:' + (active ? 'var(--indigo-light)' : 'var(--bg)') + ';border:0.5px solid ' + (active ? 'transparent' : 'var(--rule)') + ';font-size:13px;font-weight:' + (active ? '600' : '500') + ';color:' + (active ? 'var(--indigo)' : 'var(--subtle)') + ';cursor:pointer">' + _escapeHtml(v) + '</div>';
  }).join('') +
  '<div onclick="fdSelectOther()" style="padding:8px 14px;border-radius:20px;background:' + (isOther ? 'var(--indigo-light)' : 'var(--bg)') + ';border:0.5px solid ' + (isOther ? 'transparent' : 'var(--rule)') + ';font-size:13px;font-weight:' + (isOther ? '600' : '500') + ';color:' + (isOther ? 'var(--indigo)' : 'var(--subtle)') + ';cursor:pointer">+ Other</div>';
  var row = document.getElementById('fd-other-input-row');
  if (row) row.style.display = isOther ? 'flex' : 'none';
  if (isOther) {
    var emojiEl = document.getElementById('fd-other-emoji');
    var labelEl = document.getElementById('fd-other-label');
    if (emojiEl && labelEl && !labelEl.value && current) {
      var parts = current.split(' ');
      emojiEl.value = parts[0] || '';
      labelEl.value = parts.slice(1).join(' ');
    }
  }
}

function fdSelectVibe(el, v) {
  window._fdVibeMode = 'fixed';
  window._fdVibe = v;
  renderFdVibePills();
}

function fdSelectOther() {
  window._fdVibeMode = 'other';
  var emojiEl = document.getElementById('fd-other-emoji');
  var labelEl = document.getElementById('fd-other-label');
  var wasCustom = FUTURE_VIBE_FIXED.indexOf(window._fdVibe || '') === -1;
  if (!wasCustom) {
    if (emojiEl) emojiEl.value = '';
    if (labelEl) labelEl.value = '';
    window._fdVibe = '';
  }
  renderFdVibePills();
  if (labelEl && !labelEl.value) setTimeout(function(){ labelEl.focus(); }, 50);
}

function _syncFdOtherVibe() {
  var emojiEl = document.getElementById('fd-other-emoji');
  var labelEl = document.getElementById('fd-other-label');
  var emoji = emojiEl ? emojiEl.value.trim() : '';
  var label = labelEl ? labelEl.value.trim() : '';
  window._fdVibe = label ? (emoji || '🏷️') + ' ' + label : '';
}

function futureDetailSave() {
  var id = window._openFutureId;
  if (!id || !window.db) return;
  if (!_futureIsMine((window._futureMomentsCache || {})[id])) {
    if (typeof ib_toast === 'function') ib_toast('Only the person who posted this can change it');
    return;
  }
  var t = document.getElementById('fd-title');
  var d = document.getElementById('fd-date');
  var tm = document.getElementById('fd-time');
  var l = document.getElementById('fd-location');
  var tl = document.getElementById('fd-ticket-link');
  var ticketLink = tl && tl.value.trim() ? tl.value.trim() : '';
  var coverPhoto = window._fdCoverPhoto || '';
  var stops = _sanitizeForFirestore((window._stopsEditorList || []).slice()) || [];
  window.db.collection('futureMoments').doc(id).update({
    title: t && t.value.trim() ? t.value.trim() : 'Untitled plan',
    date: d ? d.value : '',
    time: tm ? tm.value : '',
    location: l && l.value.trim() ? l.value.trim() : '',
    theme: window._fdTheme || 'linear-gradient(135deg,#FF6B6B 0%,#FFA94D 45%,#845EF7 100%)',
    vibe: window._fdVibe || '',
    ticketLink: ticketLink,
    coverPhoto: coverPhoto,
    taggedUids: window._fdInvitees || [],
    public: !!window._fdPublic,
    stops: stops
  }).then(function(){
    if (typeof ib_toast === 'function') ib_toast('Plan updated');
    _persistCustomVibeIfNewFromFuture(window._fdVibe || '');
    if (typeof loadFutureMoments === 'function') loadFutureMoments();
    if (typeof loadFeedMoments === 'function') loadFeedMoments();
    var m = (window._futureMomentsCache || {})[id];
    if (m) {
      m.title = t && t.value.trim() ? t.value.trim() : 'Untitled plan';
      m.date = d ? d.value : '';
      m.time = tm ? tm.value : '';
      m.location = l && l.value.trim() ? l.value.trim() : '';
      m.theme = window._fdTheme || m.theme;
      m.vibe = window._fdVibe || m.vibe;
      m.ticketLink = ticketLink;
      m.coverPhoto = coverPhoto;
      m.taggedUids = window._fdInvitees || [];
      m.public = !!window._fdPublic;
      m.stops = stops;
    }
    exitFutureEdit();
  }).catch(function(err){
    console.error('Save future detail error:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not save — try again');
  });
}

function futureDetailDelete() {
  var id = window._openFutureId;
  var m = (window._futureMomentsCache || {})[id];
  if (!id || !window.db) return;
  // Deleting someone else's plan is refused by the Firestore rules, and
  // "try again" is the wrong thing to tell someone about a request that
  // is never going to succeed.
  if (!_futureIsMine(m)) {
    if (typeof ib_toast === 'function') ib_toast('Only ' + _futureOwnerFirstName(m) + ' can delete this plan');
    return;
  }
  if (!confirm('Delete "' + (m && m.title ? m.title : 'this plan') + '"? This can\'t be undone.')) return;
  window.db.collection('futureMoments').doc(id).delete()
    .then(function(){
      if (typeof ib_toast === 'function') ib_toast('Plan deleted');
      if (typeof loadFutureMoments === 'function') loadFutureMoments();
      if (typeof loadFeedMoments === 'function') loadFeedMoments();
      nav('feed');
    }).catch(function(err){
      console.error('Delete future moment error:', err);
      var denied = !!(err && (err.code === 'permission-denied' || /permission/i.test(err.message || '')));
      if (typeof ib_toast === 'function') ib_toast(denied ? 'Firestore rules blocked that delete' : 'Could not delete — try again');
    });
}
