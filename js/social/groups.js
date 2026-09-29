// ── FEEDBACK GROUP CHAT (Pros / Cons / Bugs / Suggestions) ──
window._feedbackChatStarted = false;
window._activeFeedbackTab = 'pros';
var FEEDBACK_TAB_PLACEHOLDERS = { pros: 'Share a pro...', cons: 'Share a con...', bugs: 'Report a bug...', suggestions: 'Share a suggestion...' };
var FEEDBACK_TAB_COLORS = { pros: '#4ADE80', cons: '#F87171', bugs: '#FB923C', suggestions: '#A89FE8' };

function feedbackTab(category, evt) {
  evt = evt || window.event;
  window._activeFeedbackTab = category;
  document.querySelectorAll('#feedback-tabs .fb-tab').forEach(function(t){
    t.style.color = 'rgba(255,255,255,0.55)';
    t.style.borderBottom = '2px solid transparent';
  });
  var activeTabEl = evt && evt.target ? evt.target.closest('.fb-tab') : document.querySelector('#feedback-tabs .fb-tab[data-category="' + category + '"]');
  if (activeTabEl) {
    activeTabEl.style.color = FEEDBACK_TAB_COLORS[category];
    activeTabEl.style.borderBottom = '2px solid ' + FEEDBACK_TAB_COLORS[category];
  }
  document.querySelectorAll('.feedback-chat-panel').forEach(function(p){ p.style.display = 'none'; });
  var panel = document.getElementById('feedback-chat-' + category);
  if (panel) { panel.style.display = 'flex'; panel.scrollTop = panel.scrollHeight; }
  var field = document.getElementById('feedback-chat-field');
  if (field) field.placeholder = FEEDBACK_TAB_PLACEHOLDERS[category] || 'Share your feedback...';
}

function startFeedbackChat() {
  if (window._feedbackChatStarted) return;
  if (!window.db) return;
  window._feedbackChatStarted = true;
  window.db.collection('feedbackChat').orderBy('ts').limit(600).onSnapshot(function(snap){
    var byCategory = { pros: [], cons: [], bugs: [], suggestions: [] };
    snap.forEach(function(doc){
      var d = Object.assign({ _id: doc.id }, doc.data());
      var cat = byCategory[d.category] ? d.category : null;
      if (cat) byCategory[cat].push(d);
    });
    Object.keys(byCategory).forEach(function(cat){ renderFeedbackChat(cat, byCategory[cat]); });
  }, function(err){
    console.error('Feedback chat error:', err);
    window._feedbackChatStarted = false;
    if (typeof ib_toast==='function') ib_toast('Feedback unavailable — check Firestore rules');
  });
}

function renderFeedbackChat(category, msgs) {
  var box = document.getElementById('feedback-chat-msgs-' + category);
  if (!box) return;
  var myUid = (window.currentUser && window.currentUser.uid) || (window.auth && window.auth.currentUser && window.auth.currentUser.uid);
  box.innerHTML = _chatHtmlWithDayDividers(msgs, function(c){
    var mine = c.uid && c.uid === myUid;
    var tsLabel = _fmtTime(c.ts);
    var badges = _reactionBadgesHtml(c.reactions, true);
    var lpHtml = c.linkPreview ? _linkPreviewCardHtml(c.linkPreview) : '';
    var linkOnly = !!(c.linkPreview && c.text && c.text.trim() === c.linkPreview.url);
    if (mine) {
      return '<div style="display:flex;flex-direction:column;align-items:flex-end">' +
        lpHtml +
        (linkOnly ? '' : '<div onclick="_msgDoubleTap(this,\'feedbackChat\',\'' + c._id + '\',true)" style="max-width:78%;background:var(--indigo);color:#fff;border-radius:18px 18px 4px 18px;padding:11px 15px;font-size:14.5px;line-height:1.5;cursor:pointer">' +
        _replyQuoteHtml(c.replyTo, true) +
        '<div class="b-txt" style="color:#fff">' + _renderMessageTextWithMentions(c.text, true) + '</div>' +
        '<div class="b-t" style="font-size:10px;color:rgba(255,255,255,0.55);margin-top:3px">' + _escapeHtml(tsLabel) + '</div>' +
        '</div>') +
        (linkOnly ? '<div style="font-size:10px;color:rgba(255,255,255,0.5)">' + _escapeHtml(tsLabel) + '</div>' : '') +
        badges + '</div>';
    }
    return '<div style="display:flex;gap:8px;align-items:flex-end">' +
      '<div style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.16);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">' + _escapeHtml(_initials(c.author)) + '</div>' +
      '<div style="max-width:74%">' +
        '<div style="font-size:11px;color:rgba(255,255,255,0.6);margin:0 0 3px 4px">' + _escapeHtml(c.author) + '</div>' +
        lpHtml +
        (linkOnly ? '' : '<div onclick="_msgDoubleTap(this,\'feedbackChat\',\'' + c._id + '\',false)" style="background:rgba(255,255,255,0.94);color:#1A1640;border-radius:18px 18px 18px 4px;padding:11px 15px;font-size:14.5px;line-height:1.5;cursor:pointer">' + _replyQuoteHtml(c.replyTo, false) + _renderMessageTextWithMentions(c.text, false) + '</div>') +
        badges +
      '</div></div>';
  }, true);
  if (window._activeFeedbackTab === category) {
    var panel = document.getElementById('feedback-chat-' + category);
    if (panel) panel.scrollTop = panel.scrollHeight;
  }
}

function deleteFeedbackMessage(msgId) {
  if (!window.db || !msgId) return;
  window.db.collection('feedbackChat').doc(msgId).delete()
    .catch(function(err){ console.error('Delete feedback message error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}

// Looks up Nathan by phone (not a hardcoded uid, since we only know his
// number) and notifies him whenever someone else posts feedback. Skips
// notifying him about his own posts.
function _notifyNathanOfFeedback(category, authorName, authorUid) {
  if (!window.db) return;
  window.db.collection('users').where('phone', '==', '+14152979471').limit(1).get().then(function(snap){
    if (snap.empty) return;
    var nathanUid = snap.docs[0].id;
    if (nathanUid === authorUid) return;
    return window.db.collection('notifications').add({
      toUid: nathanUid,
      type: 'feedback_post',
      fromUid: authorUid,
      fromName: authorName,
      category: category,
      ts: Date.now(),
      read: false
    });
  }).catch(function(err){ console.error('Feedback notification error:', err); });
}

function sendFeedbackMessage() {
  var inp = document.getElementById('feedback-chat-field');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in to send feedback'); return; }
  var author = (window.userData && window.userData.name) || 'You';
  var category = window._activeFeedbackTab || 'pros';
  if (inp) inp.value = '';
  var msgData = { uid: user.uid, author: author, text: text, ts: Date.now(), category: category };
  var replyTo = _consumeReplyForSend('feedbackChat');
  if (replyTo) msgData.replyTo = replyTo;
  var url = _extractFirstUrl(text);
  if (!url) {
    window.db.collection('feedbackChat').add(msgData)
      .then(function(){ _notifyNathanOfFeedback(category, author, user.uid); })
      .catch(function(err){ console.error('Feedback send error:', err); if (typeof ib_toast==='function') ib_toast('Could not send — ' + (err && err.message ? err.message : 'check Firestore rules')); });
    return;
  }
  _fetchLinkPreview(url).then(function(lp){
    if (lp && lp.url) msgData.linkPreview = lp;
    return window.db.collection('feedbackChat').add(msgData);
  }).then(function(){ _notifyNathanOfFeedback(category, author, user.uid); })
  .catch(function(err){ console.error('Feedback send error:', err); if (typeof ib_toast==='function') ib_toast('Could not send — ' + (err && err.message ? err.message : 'check Firestore rules')); });
}

// One-time migration (hardened): the first time Nathan (matched by phone,
// not a hardcoded uid) opens the app after this update, the old single-
// thread feedback history gets archived into a private group under his
// profile — preserved, but out of the way of the new Pros/Cons/Bugs/
// Suggestions layout. The original version checked its "already archived"
// flag from a snapshot taken before the archive finished writing, so every
// reload during that async window (fetch messages → create group → copy
// messages → set flag) raced past the check and spun up another duplicate
// group — no lock existed. This version claims the migration atomically
// with a transaction before doing any work, cleans up whatever duplicates
// that bug already created (keeping the oldest one), and then locks itself
// out permanently with a second flag so it can never run again.
window._feedbackArchiveRunning = false;
function _archiveFeedbackIfNeeded(user, pdata) {
  if (!window.db || !user) return;
  if (window._feedbackArchiveRunning) return;
  var myPhone = (user.phoneNumber || '').replace(/\D/g, '');
  if (myPhone.slice(-10) !== '4152979471') return;
  if (pdata && pdata.feedbackArchiveCleanedV1) return;
  window._feedbackArchiveRunning = true;

  window.db.collection('groups').where('createdBy', '==', user.uid).where('name', '==', 'Feedback (Archived)').get()
    .then(function(snap) {
      var groups = [];
      snap.forEach(function(doc){ groups.push({ id: doc.id, data: doc.data() }); });
      groups.sort(function(a, b){ return (a.data.createdAt || 0) - (b.data.createdAt || 0); });

      if (groups.length > 1) {
        // Duplicates from the old racy version — keep the oldest, delete the
        // rest. Each group's cleanup catches its own errors so a permission
        // problem on one doesn't abort the whole batch (or block this from
        // ever completing) — the display-side dedup in renderMyGroups is
        // the real guarantee Nathan only ever sees one, regardless of
        // whether these deletes are actually allowed by the current rules.
        var toDelete = groups.slice(1);
        var deletedCount = 0;
        return Promise.all(toDelete.map(function(g){
          return window.db.collection('groupChats').where('groupId', '==', g.id).get().then(function(msgSnap){
            var deletes = [];
            msgSnap.forEach(function(doc){ deletes.push(doc.ref.delete().catch(function(e){ console.error('Delete archived chat message failed:', e); })); });
            return Promise.all(deletes);
          }).then(function(){
            return window.db.collection('groups').doc(g.id).delete();
          }).then(function(){
            deletedCount++;
          }).catch(function(err){
            console.error('Delete duplicate archive group failed (' + g.id + '):', err);
          });
        })).then(function(){
          if (deletedCount && typeof ib_toast === 'function') ib_toast('Cleaned up ' + deletedCount + ' duplicate archive group' + (deletedCount === 1 ? '' : 's'));
        });
      }

      if (groups.length === 1) return; // already archived once, nothing to do

      // No archive exists yet — claim the migration atomically, then create it
      var userRef = window.db.collection('users').doc(user.uid);
      return window.db.runTransaction(function(tx){
        return tx.get(userRef).then(function(doc){
          if (doc.exists && doc.data().feedbackArchivedV1) throw new Error('ALREADY_CLAIMED');
          tx.set(userRef, { feedbackArchivedV1: true }, { merge: true });
        });
      }).then(function(){
        return window.db.collection('feedbackChat').orderBy('ts').get();
      }).then(function(msgSnap){
        var msgs = [];
        msgSnap.forEach(function(doc){ msgs.push(doc.data()); });
        if (!msgs.length) return;
        var groupData = {
          name: 'Feedback (Archived)',
          icon: '🗄️',
          createdBy: user.uid,
          createdAt: Date.now(),
          memberUids: [user.uid],
          members: [{ uid: user.uid, name: (window.userData && window.userData.name) || 'Nathan' }],
          features: ['chat']
        };
        return window.db.collection('groups').add(groupData).then(function(ref){
          var groupId = ref.id;
          return Promise.all(msgs.map(function(m){
            return window.db.collection('groupChats').add({
              groupId: groupId,
              uid: m.uid || user.uid,
              author: m.author || 'Unknown',
              text: m.text || '',
              ts: m.ts || Date.now()
            });
          }));
        }).then(function(){
          if (typeof ib_toast === 'function') ib_toast('Old feedback archived to your groups');
        });
      }).catch(function(err){
        if (err && err.message === 'ALREADY_CLAIMED') return; // another tab/reload already handled it
        throw err;
      });
    })
    .then(function(){
      return window.db.collection('users').doc(user.uid).set({ feedbackArchivedV1: true, feedbackArchiveCleanedV1: true }, { merge: true });
    })
    .then(function(){
      window._feedbackArchiveRunning = false;
      if (typeof loadMyGroups === 'function') { window._myGroupsStarted = false; loadMyGroups(); }
    })
    .catch(function(err){
      window._feedbackArchiveRunning = false;
      console.error('Feedback archive error:', err);
    });
}

// ── USER-CREATED GROUPS ──
window._myGroupsStarted = false;
function loadMyGroups() {
  if (window._myGroupsStarted) return;
  if (!window.db) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user) return;
  window._myGroupsStarted = true;
  window.db.collection('groups').where('memberUids', 'array-contains', user.uid).onSnapshot(function(snap){
    var groups = [];
    snap.forEach(function(doc){ groups.push(Object.assign({ _id: doc.id }, doc.data())); });
    groups.sort(function(a,b){ return (b.createdAt || 0) - (a.createdAt || 0); });
    window._myGroups = groups;
    renderMyGroups(groups);
  }, function(err){
    console.error('My groups error:', err);
    window._myGroupsStarted = false;
    if (typeof ib_toast==='function') ib_toast('Groups unavailable — check Firestore rules');
  });
}

function renderMyGroups(groups) {
  var list = document.getElementById('my-groups-list');
  var empty = document.getElementById('my-groups-empty');
  if (!list) return;
  // The old feedback-archive migration bug created many duplicate "Feedback
  // (Archived)" groups before it was fixed. The fix cleans those up in
  // Firestore going forward, but that depends on delete being permitted by
  // the current rules — so regardless of whether that backend cleanup
  // succeeds, collapse any group with that exact name down to the single
  // oldest one right here at render time. This is the actual guarantee.
  var byCreatedAsc = groups.slice().sort(function(a, b){ return (a.createdAt || 0) - (b.createdAt || 0); });
  var seenArchive = false;
  var deduped = [];
  byCreatedAsc.forEach(function(g){
    if (g.name === 'Feedback (Archived)') {
      if (seenArchive) return;
      seenArchive = true;
    }
    deduped.push(g);
  });
  deduped.sort(function(a, b){ return (b.createdAt || 0) - (a.createdAt || 0); });
  if (empty) empty.style.display = deduped.length ? 'none' : 'block';
  list.innerHTML = deduped.map(function(g){
    var count = (g.members && g.members.length) || (g.memberUids && g.memberUids.length) || 1;
    return '<div style="background:linear-gradient(135deg,#1A1640,#3D3580);border-radius:16px;padding:14px 16px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="openGroupById(\'' + g._id + '\')">' +
      '<div style="font-size:28px">' + _escapeHtml(g.icon || '💬') + '</div>' +
      '<div style="flex:1">' +
        '<div style="font-size:14px;font-weight:700;color:white">' + _escapeHtml(g.name || 'Group') + '</div>' +
        '<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px">' + count + ' member' + (count === 1 ? '' : 's') + ' · Tap to open →</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function openGroupById(groupId) {
  var g = (window._myGroups || []).filter(function(x){ return x._id === groupId; })[0];
  if (!g) return;
  openGroup(g);
}

// ── EDIT AN EXISTING GROUP (name/icon — any member can do this, matching
// the existing groups security rule; cover photo is creator-only, gated
// client-side since Nathan wants only the creator setting it) ──
window._pendingGroupBgPhoto = undefined; // undefined = no change, null = remove, dataURL = new photo
function showEditGroupModal() {
  var g = window._activeGroup;
  if (!g) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  window._pendingGroupBgPhoto = undefined;
  var nameEl = document.getElementById('edit-group-name');
  var iconEl = document.getElementById('edit-group-icon');
  if (nameEl) nameEl.value = g.name || '';
  if (iconEl) iconEl.value = g.icon || '';
  var bgSection = document.getElementById('edit-group-bg-section');
  var isCreator = !!(user && g.createdBy === user.uid);
  if (bgSection) bgSection.style.display = isCreator ? 'block' : 'none';
  _renderEditGroupBgPreview(g.backgroundPhoto || '');
  var m = document.getElementById('edit-group-modal');
  if (m) m.style.display = 'flex';
}
function hideEditGroupModal() {
  var m = document.getElementById('edit-group-modal');
  if (m) m.style.display = 'none';
  window._pendingGroupBgPhoto = undefined;
}
function _renderEditGroupBgPreview(url) {
  var preview = document.getElementById('edit-group-bg-preview');
  var removeBtn = document.getElementById('edit-group-bg-remove');
  if (!preview) return;
  if (url) {
    preview.style.backgroundImage = 'url(' + url + ')';
    preview.textContent = '';
    if (removeBtn) removeBtn.style.display = 'block';
  } else {
    preview.style.backgroundImage = '';
    preview.textContent = 'No cover photo yet';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}
function groupBgPhotoSelected(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    _downscaleImage(e.target.result, 1200, function(small) {
      window._pendingGroupBgPhoto = small;
      _renderEditGroupBgPreview(small);
    });
  };
  reader.readAsDataURL(input.files[0]);
  input.value = '';
}
function removeGroupBgPhoto() {
  window._pendingGroupBgPhoto = null;
  _renderEditGroupBgPreview('');
}
function _applyGroupBgPhoto(url) {
  var bgEl = document.getElementById('gd-bg-photo');
  var overlayEl = document.getElementById('gd-bg-overlay');
  if (bgEl) {
    bgEl.style.backgroundImage = url ? 'url(' + url + ')' : '';
    bgEl.style.opacity = url ? '1' : '0';
  }
  if (overlayEl) overlayEl.style.opacity = url ? '1' : '0';
}
function saveGroupEdits() {
  var g = window._activeGroup;
  if (!g || !window.db) return;
  var nameEl = document.getElementById('edit-group-name');
  var iconEl = document.getElementById('edit-group-icon');
  var name = nameEl ? nameEl.value.trim() : '';
  var icon = iconEl ? iconEl.value.trim() : '';
  if (!name) { if (typeof ib_toast==='function') ib_toast('Give your group a name'); return; }
  var updates = { name: name, icon: icon || '💬' };
  var bgChanged = window._pendingGroupBgPhoto !== undefined;
  if (bgChanged) updates.backgroundPhoto = window._pendingGroupBgPhoto || firebase.firestore.FieldValue.delete();
  window.db.collection('groups').doc(g._id).update(updates).then(function(){
    g.name = name;
    g.icon = icon || '💬';
    if (bgChanged) g.backgroundPhoto = window._pendingGroupBgPhoto || '';
    var iconDisp = document.getElementById('gd-icon');
    var nameDisp = document.getElementById('gd-name');
    var emptyIcon = document.getElementById('group-chat-empty-icon');
    var fieldEl = document.getElementById('group-chat-field');
    if (iconDisp) iconDisp.textContent = g.icon;
    if (nameDisp) nameDisp.textContent = g.name;
    if (emptyIcon) emptyIcon.textContent = g.icon;
    if (fieldEl) fieldEl.placeholder = 'Message ' + g.name + '...';
    if (bgChanged) _applyGroupBgPhoto(g.backgroundPhoto || '');
    if (window._myGroups) {
      var cached = window._myGroups.filter(function(x){ return x._id === g._id; })[0];
      if (cached) { cached.name = g.name; cached.icon = g.icon; if (bgChanged) cached.backgroundPhoto = g.backgroundPhoto; renderMyGroups(window._myGroups); }
    }
    hideEditGroupModal();
    if (typeof ib_toast==='function') ib_toast('Group updated');
  }).catch(function(err){
    console.error('Edit group error:', err);
    if (typeof ib_toast==='function') ib_toast('Could not update group — ' + (err && err.message ? err.message : 'try again'));
  });
}

function openGroup(g) {
  window._activeGroupId = g._id;
  window._activeGroup = g;
  if (!window._activeGroup.features) window._activeGroup.features = [];
  window._gdGamesDate = _todayLocal();
  if (typeof closeGroupGameDetail === 'function') closeGroupGameDetail();
  var iconEl = document.getElementById('gd-icon');
  var nameEl = document.getElementById('gd-name');
  var subEl = document.getElementById('gd-sub');
  var count = (g.members && g.members.length) || (g.memberUids && g.memberUids.length) || 1;
  if (iconEl) iconEl.textContent = g.icon || '💬';
  if (nameEl) nameEl.textContent = g.name || 'Group';
  if (subEl) subEl.textContent = count + ' member' + (count === 1 ? '' : 's') + ' · Invite only';
  _applyGroupBgPhoto(g.backgroundPhoto || '');
  var emptyIcon = document.getElementById('group-chat-empty-icon');
  if (emptyIcon) emptyIcon.textContent = g.icon || '💬';
  var fieldEl = document.getElementById('group-chat-field');
  if (fieldEl) fieldEl.placeholder = 'Message ' + (g.name || 'the group') + '...';
  renderGroupMembersStrip();
  renderGroupTabs();
  nav('group-detail');
}

function renderGroupMembersStrip() {
  var strip = document.getElementById('gd-members-strip');
  if (!strip) return;
  var g = window._activeGroup;
  var members = (g && g.members) || [];
  var colors = ['av-a', 'av-b', 'av-c', 'av-d', 'av-e'];
  strip.innerHTML = members.map(function(m, i){
    return '<div class="mem-item"><div class="m-av-sm ' + colors[i % colors.length] + '">' + _escapeHtml(_initials(m.name)) + '</div><div class="m-nm-sm">' + _escapeHtml(m.name) + '</div></div>';
  }).join('');
}

function renderGroupMembers() {
  var grid = document.getElementById('gd-members-grid');
  if (!grid) return;
  var g = window._activeGroup;
  var members = (g && g.members) || [];
  var colors = ['av-a', 'av-b', 'av-c', 'av-d', 'av-e'];
  grid.innerHTML = members.map(function(m, i){
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:6px"><div class="m-av-sm ' + colors[i % colors.length] + '" style="width:44px;height:44px;font-size:13px">' + _escapeHtml(_initials(m.name)) + '</div><div class="m-nm-sm">' + _escapeHtml(m.name) + '</div></div>';
  }).join('');
}

// ── ADD FRIENDS TO AN EXISTING GROUP (any member can do this) ──
function groupToggleAddFriends() {
  var el = document.getElementById('gd-add-friends');
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    groupLoadAddableFriends();
  } else {
    el.style.display = 'none';
  }
}

function groupLoadAddableFriends() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var el = document.getElementById('gd-add-friends');
  if (!user || !window.db || !el) return;
  el.innerHTML = '<div style="font-size:12px;color:var(--subtle)">Loading friends…</div>';
  var existingUids = (window._activeGroup && window._activeGroup.memberUids) || [];
  Promise.all([
    window.db.collection('friendRequests').where('fromUid','==',user.uid).where('status','==','accepted').get(),
    window.db.collection('friendRequests').where('toUid','==',user.uid).where('status','==','accepted').get()
  ]).then(function(results){
    var uids = [];
    results[0].forEach(function(d){ uids.push(d.data().toUid); });
    results[1].forEach(function(d){ uids.push(d.data().fromUid); });
    uids = uids.filter(function(v,i){ return uids.indexOf(v) === i; });
    if (!uids.length) { el.innerHTML = '<div style="font-size:12px;color:var(--subtle)">You don\'t have any confirmed Innings friends yet — send a friend request from someone\'s profile, and once they accept, they\'ll show up here.</div>'; return; }
    Promise.all(uids.map(function(uid){ return window.db.collection('users').doc(uid).get(); })).then(function(docs){
      el.innerHTML = docs.map(function(doc){
        var d = doc.data() || {};
        var nm = d.name || 'Friend';
        var isMember = existingUids.indexOf(doc.id) !== -1;
        if (isMember) {
          return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;opacity:0.5">' +
            '<div style="width:32px;height:32px;border-radius:50%;background:var(--indigo-light);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--indigo)">' + _escapeHtml(_initialsFallback(nm)) + '</div>' +
            '<div style="flex:1;font-size:13px;font-weight:600;color:var(--black)">' + _escapeHtml(nm) + '</div>' +
            '<div style="font-size:11px;color:var(--subtle)">Already in group</div>' +
          '</div>';
        }
        return '<div onclick="groupAddMember(\'' + doc.id + '\',\'' + nm.replace(/'/g,"\\'") + '\')" style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer">' +
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
    el.innerHTML = '<div style="font-size:12px;color:var(--subtle)">Could not load friends</div>';
  });
}

function groupAddMember(uid, name) {
  var g = window._activeGroup;
  if (!g || !window.db) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var myName = (window.userData && window.userData.name) || 'Someone';
  var memberUids = (g.memberUids || []).slice();
  var members = (g.members || []).slice();
  if (memberUids.indexOf(uid) !== -1) return;
  memberUids.push(uid);
  members.push({ uid: uid, name: name });
  window.db.collection('groups').doc(g._id).update({ memberUids: memberUids, members: members }).then(function(){
    g.memberUids = memberUids;
    g.members = members;
    var count = members.length;
    var subEl = document.getElementById('gd-sub');
    if (subEl) subEl.textContent = count + ' member' + (count === 1 ? '' : 's') + ' · Invite only';
    renderGroupMembersStrip();
    renderGroupMembers();
    groupLoadAddableFriends();
    if (typeof ib_toast==='function') ib_toast(name + ' added to the group');
    if (user) {
      window.db.collection('notifications').add({
        toUid: uid,
        type: 'added_to_group',
        fromUid: user.uid,
        fromName: myName,
        groupId: g._id,
        groupName: g.name || 'a group',
        ts: Date.now(),
        read: false
      }).catch(function(err){ console.error('Added-to-group notification error:', err); });
    }
    window.db.collection('groupChats').add({ groupId: g._id, uid: user.uid, author: name, ts: Date.now(), system: true, systemType: 'join' })
      .catch(function(err){ console.error('Post join notice error:', err); });
  }).catch(function(err){
    console.error('Add member error:', err);
    if (typeof ib_toast==='function') ib_toast('Could not add — ' + (err && err.message ? err.message : 'check Firestore rules'));
  });
}

// ── INVITE BY TEXT (works for anyone, not just existing friends — they join
// the group automatically the moment they create an Innings account with
// this phone number) ──

// Writes the pending invite (so the group auto-adds them at signup) and,
// unless silent, opens the native text-message composer with the invite link.
// Invite links for groups and future plans. Rather than asking the sender
// to type a phone number (nobody has those memorized), this hands the
// invite off to the device's native share sheet — the person picks a
// contact straight from Messages/AirDrop/etc, exactly like sharing a photo.
// The link itself carries everything needed to join (see the URL-param
// parser near the top of this script, and consumePendingInviteLinks below);
// there's no separate per-recipient registration step.
function groupShareInvite() {
  var g = window._activeGroup;
  if (!g) return;
  var inviterName = (window.userData && window.userData.name) || 'A friend';
  var groupName = g.name || 'the group';
  var inviteUrl = 'https://innings-zeta.vercel.app/?groupInvite=' + encodeURIComponent(g._id) +
    '&groupName=' + encodeURIComponent(groupName) + '&inviter=' + encodeURIComponent(inviterName);
  var message = inviterName + ' invited you to "' + groupName + '" on Innings — a private space for memories with the people that matter. Tap to join: ' + inviteUrl;
  _shareInviteLink(inviteUrl, message, 'Join ' + groupName + ' on Innings');
}

function fdShareInvite() {
  var momentId = window._openFutureId;
  var m = (window._futureMomentsCache || {})[momentId];
  if (!momentId || !m) return;
  var inviterName = (window.userData && window.userData.name) || 'A friend';
  var title = m.title || 'this plan';
  var inviteUrl = 'https://innings-zeta.vercel.app/?futureInvite=' + encodeURIComponent(momentId) +
    '&title=' + encodeURIComponent(title) + '&inviter=' + encodeURIComponent(inviterName);
  var message = inviterName + ' invited you to "' + title + '" on Innings — a private space for memories with the people that matter. Tap to join: ' + inviteUrl;
  _shareInviteLink(inviteUrl, message, 'Join ' + title + ' on Innings');
}

function _shareInviteLink(url, message, shareTitle) {
  if (navigator.share) {
    // message already has the link embedded — a separate `url` field made
    // some share targets duplicate the link preview (see sendInviteText)
    navigator.share({ title: shareTitle, text: message }).catch(function(){});
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(message).then(function(){
      if (typeof ib_toast === 'function') ib_toast('Link copied — paste it in a text');
    }).catch(function(){
      if (typeof ib_toast === 'function') ib_toast('Could not copy the link — try again');
    });
  } else if (typeof ib_toast === 'function') {
    ib_toast('Copy this link: ' + url);
  }
}

// Called right after a phone-auth account is created or logged into. Reads
// whatever invite link the person arrived on (parsed near the top of this
// script into window._pendingGroupInviteId / _pendingFutureInviteId) and
// joins them to that specific group or plan. Safe to call every time
// someone signs in — it's a no-op once there's nothing pending.
function consumePendingInviteLinks(user, name) {
  if (!user || !window.db) return;
  var frid = window._pendingFriendInviteUid;
  if (frid) {
    window._pendingFriendInviteUid = null;
    _acceptFriendInviteLink(user, name, frid, window._pendingFriendInviteName || 'your friend');
  }
  var gid = window._pendingGroupInviteId;
  var gName = window._pendingGroupInviteName;
  if (gid) {
    window._pendingGroupInviteId = null;
    window.db.collection('groups').doc(gid).update({
      memberUids: firebase.firestore.FieldValue.arrayUnion(user.uid),
      members: firebase.firestore.FieldValue.arrayUnion({ uid: user.uid, name: name || 'New member' })
    }).then(function(){
      if (typeof loadMyGroups === 'function') loadMyGroups();
      if (typeof ib_toast === 'function') ib_toast('Added to "' + (gName || 'the group') + '" 🎉');
      window.db.collection('groupChats').add({ groupId: gid, uid: user.uid, author: name || 'New member', ts: Date.now(), system: true, systemType: 'join' })
        .catch(function(err){ console.error('Post join notice error:', err); });
    }).catch(function(err){ console.error('Join group via link error:', err); });
  }
  var fid = window._pendingFutureInviteId;
  var fTitle = window._pendingFutureInviteTitle;
  if (fid) {
    window._pendingFutureInviteId = null;
    window.db.collection('futureMoments').doc(fid).update({
      taggedUids: firebase.firestore.FieldValue.arrayUnion(user.uid)
    }).then(function(){
      if (typeof ib_toast === 'function') ib_toast('Added to "' + (fTitle || 'the plan') + '" 🎉');
    }).catch(function(err){ console.error('Join plan via link error:', err); });
  }
}

// Friend invite link → friendship. Checks for an existing request between the
// two first (either direction) so a repeat tap never duplicates anything:
// already friends → no-op; they already asked you → accept theirs; otherwise
// write an accepted request from you to them. If the Firestore rules refuse
// an accepted-on-create doc, falls back to a normal pending request so the
// link still does something the inviter can see and accept.
function _acceptFriendInviteLink(user, name, inviterUid, inviterName) {
  if (!inviterUid || inviterUid === user.uid) {
    try { localStorage.removeItem('innings_pendingFriendInvite'); } catch (e) {}
    return;
  }
  var db = window.db;
  var myName = name || (window.userData && window.userData.name) || 'Someone';
  var stage = 'lookup';
  Promise.all([
    db.collection('friendRequests').where('fromUid','==',user.uid).where('toUid','==',inviterUid).get(),
    db.collection('friendRequests').where('fromUid','==',inviterUid).where('toUid','==',user.uid).get()
  ]).then(function(res){
    var all = res[0].docs.concat(res[1].docs);
    if (all.some(function(d){ return (d.data() || {}).status === 'accepted'; })) return 'already';
    var theirs = res[1].docs.filter(function(d){ return (d.data() || {}).status === 'pending'; })[0];
    if (theirs) {
      stage = 'accept-theirs';
      return theirs.ref.update({ status: 'accepted' }).then(function(){ return 'accepted'; });
    }
    var mine = res[0].docs.filter(function(d){ return (d.data() || {}).status === 'pending'; })[0];
    if (mine) {
      stage = 'upgrade-mine';
      return mine.ref.update({ status: 'accepted', viaInvite: true }).then(function(){ return 'accepted'; })
        .catch(function(){ return 'pending'; });
    }
    stage = 'create-accepted';
    return db.collection('friendRequests').add({ fromUid: user.uid, toUid: inviterUid, status: 'accepted', viaInvite: true, ts: Date.now() })
      .then(function(){ return 'accepted'; })
      .catch(function(err){
        console.warn('Invite link: accepted-on-create refused, falling back to pending', err);
        stage = 'create-pending';
        return db.collection('friendRequests').add({ fromUid: user.uid, toUid: inviterUid, status: 'pending', viaInvite: true, ts: Date.now() })
          .then(function(docRef){ window._inviteReqId = docRef.id; return 'pending'; });
      });
  }).then(function(outcome){
    // Done (or already friends) — stop retrying on future loads
    try { localStorage.removeItem('innings_pendingFriendInvite'); } catch (e) {}
    if (!outcome || outcome === 'already') return;
    if (typeof _ensureFriendListed === 'function' && outcome === 'accepted') _ensureFriendListed(inviterUid);
    if (typeof loadMyFriendsList === 'function') loadMyFriendsList();
    if (typeof ib_toast === 'function') {
      ib_toast(outcome === 'accepted' ? 'You and ' + inviterName + ' are friends now' : 'Friend request sent to ' + inviterName);
    }
    var notif = outcome === 'accepted'
      ? { toUid: inviterUid, type: 'friend_joined', fromUid: user.uid, fromName: myName, ts: Date.now(), read: false }
      : { toUid: inviterUid, type: 'friend_request', fromUid: user.uid, fromName: myName, ts: Date.now(), read: false, requestId: window._inviteReqId || null };
    return db.collection('notifications').add(notif);
  }).catch(function(err){
    console.error('Friend invite link error [' + stage + ']:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not add ' + inviterName + ' [' + stage + '] — ' + (err && err.message ? err.message : 'try again'));
  });
}

// ── ADD A FEATURE TO A GROUP (blank canvas → chosen modules) ──
function showFeaturePicker() {
  var m = document.getElementById('feature-picker-modal');
  if (m) m.style.display = 'flex';
}
function hideFeaturePicker() {
  var m = document.getElementById('feature-picker-modal');
  if (m) m.style.display = 'none';
}
function addGroupFeature(key) {
  var g = window._activeGroup;
  if (!g || !window.db) return;
  var features = (g.features || []).slice();
  if (features.indexOf(key) === -1) features.push(key);
  window.db.collection('groups').doc(g._id).update({ features: features }).then(function(){
    g.features = features;
    hideFeaturePicker();
    renderGroupTabs();
    if (typeof ib_toast==='function' && key === 'chat') ib_toast('Group Feed added 💬');
    if (typeof ib_toast==='function' && key === 'games') ib_toast('Games added ⚾');
    if (typeof ib_toast==='function' && key === 'polls') ib_toast('Polls added 🗳️');
  }).catch(function(err){
    console.error('Add feature error:', err);
    if (typeof ib_toast==='function') ib_toast('Could not add feature — try again');
  });
}

// ── POLLS — ask a group, or the guests on a specific plan, to vote on
// something (e.g. "Saturday or Sunday before my birthday?"). Scope-generic:
// one poll can belong to a group (scopeType 'group') or a single future
// plan (scopeType 'future'), each tracked with its own realtime listener so
// switching between screens doesn't cross-contaminate what's showing. One
// vote per person stored as votes.<uid> = optionIndex, so re-tapping a
// different option just moves your vote rather than adding a second one.
window._groupPollsUnsub = null;
window._groupPollsSubscribedId = null;
window._futurePollsUnsub = null;
window._futurePollsSubscribedId = null;
window._pollsCache = {};
window._pollContext = null; // { type: 'group'|'future', id }

function startGroupPolls(groupId) {
  if (!window.db || !groupId) return;
  if (window._groupPollsSubscribedId === groupId && window._groupPollsUnsub) return;
  if (window._groupPollsUnsub) { window._groupPollsUnsub(); window._groupPollsUnsub = null; }
  window._groupPollsSubscribedId = groupId;
  window._groupPollsUnsub = window.db.collection('polls').where('scopeType', '==', 'group').where('scopeId', '==', groupId).onSnapshot(function(snap){
    var polls = [];
    snap.forEach(function(doc){ polls.push(Object.assign({ _id: doc.id }, doc.data())); });
    polls.sort(function(a,b){ return (b.ts || 0) - (a.ts || 0); });
    polls.forEach(function(p){ window._pollsCache[p._id] = p; });
    renderPolls('gd-polls-list', polls, '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:40px 24px">' +
      '<div style="font-size:32px">🗳️</div>' +
      '<div style="font-size:16px;font-weight:700;color:var(--black)">No polls yet</div>' +
      '<div style="font-size:13px;color:var(--subtle);max-width:230px;line-height:1.6">Ask the group something — like which day works best.</div>' +
    '</div>');
  }, function(err){
    console.error('Group polls error:', err);
    window._groupPollsSubscribedId = null;
    if (typeof ib_toast==='function') ib_toast('Polls unavailable — check Firestore rules');
  });
}

function startFuturePolls(momentId) {
  if (!window.db || !momentId) return;
  if (window._futurePollsSubscribedId === momentId && window._futurePollsUnsub) return;
  if (window._futurePollsUnsub) { window._futurePollsUnsub(); window._futurePollsUnsub = null; }
  window._futurePollsSubscribedId = momentId;
  window._futurePollsUnsub = window.db.collection('polls').where('scopeType', '==', 'future').where('scopeId', '==', momentId).onSnapshot(function(snap){
    var polls = [];
    snap.forEach(function(doc){ polls.push(Object.assign({ _id: doc.id }, doc.data())); });
    polls.sort(function(a,b){ return (b.ts || 0) - (a.ts || 0); });
    polls.forEach(function(p){ window._pollsCache[p._id] = p; });
    renderPolls('future-polls-list', polls, ''); // blank when none — this sits inline above a conversation, not its own tab
  }, function(err){
    console.error('Future plan polls error:', err);
    window._futurePollsSubscribedId = null;
    if (typeof ib_toast==='function') ib_toast('Polls unavailable — check Firestore rules');
  });
}

function renderPolls(containerId, polls, emptyHtml) {
  var list = document.getElementById(containerId);
  if (!list) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!polls.length) {
    list.innerHTML = emptyHtml || '';
    return;
  }
  list.innerHTML = polls.map(function(p){
    var votes = p.votes || {};
    var counts = (p.options || []).map(function(){ return 0; });
    var totalVotes = 0;
    Object.keys(votes).forEach(function(uid){
      var idx = votes[uid];
      if (typeof idx === 'number' && counts[idx] !== undefined) { counts[idx]++; totalVotes++; }
    });
    var myVote = user ? votes[user.uid] : undefined;
    var isCreator = !!(user && p.createdBy === user.uid);
    var optionsHtml = (p.options || []).map(function(opt, i){
      var pct = totalVotes ? Math.round((counts[i] / totalVotes) * 100) : 0;
      var mine = myVote === i;
      var disabled = !!p.closed;
      return '<div ' + (disabled ? '' : 'onclick="votePoll(\'' + p._id + '\',' + i + ')"') + ' style="position:relative;border-radius:12px;overflow:hidden;border:1.5px solid ' + (mine ? 'var(--indigo)' : 'var(--rule)') + ';cursor:' + (disabled ? 'default' : 'pointer') + ';margin-bottom:8px;background:var(--bg)">' +
        '<div style="position:absolute;top:0;bottom:0;left:0;width:' + pct + '%;background:' + (mine ? 'var(--indigo-light)' : 'rgba(61,53,128,0.06)') + ';transition:width 0.3s ease"></div>' +
        '<div style="position:relative;display:flex;align-items:center;justify-content:space-between;padding:11px 14px">' +
          '<div style="font-size:14px;font-weight:' + (mine ? '700' : '500') + ';color:' + (mine ? 'var(--indigo)' : 'var(--black)') + '">' + (mine ? '✓ ' : '') + _escapeHtml(opt) + '</div>' +
          '<div style="font-size:12px;font-weight:700;color:var(--subtle);flex-shrink:0">' + pct + '% · ' + counts[i] + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
    var footer = '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">' +
      '<div style="font-size:11px;color:var(--subtle)">' + totalVotes + ' vote' + (totalVotes === 1 ? '' : 's') + (p.closed ? ' · Closed' : '') + '</div>' +
      (isCreator ? '<div style="display:flex;gap:12px">' +
        (p.closed ? '' : '<div onclick="closePoll(\'' + p._id + '\')" style="font-size:11px;color:var(--indigo);font-weight:600;cursor:pointer">Close poll</div>') +
        '<div onclick="deletePoll(\'' + p._id + '\')" style="font-size:11px;color:var(--loss);font-weight:600;cursor:pointer">Delete</div>' +
      '</div>' : '') +
    '</div>';
    return '<div class="card" style="padding:14px 16px">' +
      '<div style="font-size:15px;font-weight:700;color:var(--black);margin-bottom:10px;line-height:1.4">' + _escapeHtml(p.question || 'Untitled poll') + '</div>' +
      optionsHtml + footer +
    '</div>';
  }).join('');
}

function votePoll(pollId, optionIndex) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in to vote'); return; }
  var update = {};
  update['votes.' + user.uid] = optionIndex;
  window.db.collection('polls').doc(pollId).update(update)
    .catch(function(err){ console.error('Vote poll error:', err); if (typeof ib_toast==='function') ib_toast('Could not vote — try again'); });
}

function closePoll(pollId) {
  if (!window.db) return;
  window.db.collection('polls').doc(pollId).update({ closed: true })
    .catch(function(err){ console.error('Close poll error:', err); if (typeof ib_toast==='function') ib_toast('Could not close — try again'); });
}

function deletePoll(pollId) {
  if (!window.db) return;
  if (!confirm('Delete this poll? This can\'t be undone.')) return;
  window.db.collection('polls').doc(pollId).delete()
    .catch(function(err){ console.error('Delete poll error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}

function showCreatePollModal(scopeType, scopeId) {
  if (!scopeId) { if (typeof ib_toast==='function') ib_toast('Could not open the poll creator — try reopening this page'); return; }
  window._pollContext = { type: scopeType, id: scopeId };
  var qEl = document.getElementById('poll-question');
  if (qEl) qEl.value = '';
  var listEl = document.getElementById('poll-options-list');
  if (listEl) {
    listEl.innerHTML = '';
    pollAddOptionField();
    pollAddOptionField();
  }
  var m = document.getElementById('create-poll-modal');
  if (m) m.style.display = 'flex';
}

function hideCreatePollModal() {
  var m = document.getElementById('create-poll-modal');
  if (m) m.style.display = 'none';
}

var POLL_MAX_OPTIONS = 6;
function pollAddOptionField() {
  var listEl = document.getElementById('poll-options-list');
  if (!listEl) return;
  if (listEl.children.length >= POLL_MAX_OPTIONS) { if (typeof ib_toast==='function') ib_toast('Up to ' + POLL_MAX_OPTIONS + ' options'); return; }
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center';
  row.innerHTML = '<input class="poll-option-input" placeholder="Option" style="flex:1;font-size:14px;border:0.5px solid var(--rule);border-radius:12px;padding:10px 14px;outline:none;font-family:inherit;color:var(--black);background:var(--bg)">' +
    '<div onclick="this.parentElement.remove()" style="width:28px;height:28px;border-radius:50%;background:var(--bg);border:0.5px solid var(--rule);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--subtle);cursor:pointer;flex-shrink:0">×</div>';
  listEl.appendChild(row);
}

function saveNewPoll() {
  var ctx = window._pollContext;
  if (!ctx || !ctx.id || !window.db) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user) { if (typeof ib_toast==='function') ib_toast('Sign in to create a poll'); return; }
  var qEl = document.getElementById('poll-question');
  var question = qEl ? qEl.value.trim() : '';
  if (!question) { if (typeof ib_toast==='function') ib_toast('Give your poll a question'); return; }
  var options = [];
  document.querySelectorAll('#poll-options-list .poll-option-input').forEach(function(inp){ var v = inp.value.trim(); if (v) options.push(v); });
  if (options.length < 2) { if (typeof ib_toast==='function') ib_toast('Add at least 2 options'); return; }
  window.db.collection('polls').add({
    scopeType: ctx.type,
    scopeId: ctx.id,
    question: question,
    options: options,
    votes: {},
    closed: false,
    createdBy: user.uid,
    createdByName: (window.userData && window.userData.name) || 'You',
    ts: Date.now()
  }).then(function(){
    hideCreatePollModal();
    if (typeof ib_toast==='function') ib_toast('Poll created 🗳️');
  }).catch(function(err){
    console.error('Create poll error:', err);
    if (typeof ib_toast==='function') ib_toast('Could not create poll — ' + (err && err.message ? err.message : 'check Firestore rules'));
  });
}

// ── NEW GROUP CREATION ──
window._newGroupInvitees = [];
function showNewGroupModal() {
  window._newGroupInvitees = [];
  renderNewGroupInviteeList();
  var addEl = document.getElementById('new-group-add-friends');
  if (addEl) addEl.style.display = 'none';
  var m = document.getElementById('new-group-modal');
  if (m) m.style.display = 'flex';
}
function hideNewGroupModal() {
  var m = document.getElementById('new-group-modal');
  if (m) m.style.display = 'none';
  var nameEl = document.getElementById('new-group-name');
  var iconEl = document.getElementById('new-group-icon');
  if (nameEl) nameEl.value = '';
  if (iconEl) iconEl.value = '';
  window._newGroupInvitees = [];
}
function quickGroupIcon(emoji) {
  var iconEl = document.getElementById('new-group-icon');
  if (iconEl) iconEl.value = emoji;
}

function renderNewGroupInviteeList() {
  var listEl = document.getElementById('new-group-invitee-list');
  if (!listEl) return;
  var invitees = window._newGroupInvitees || [];
  if (!invitees.length) { listEl.innerHTML = '<div style="font-size:13px;color:var(--subtle)">Just you so far</div>'; return; }
  listEl.innerHTML = invitees.map(function(m){
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--rule)">' +
      '<div style="width:32px;height:32px;border-radius:50%;background:var(--indigo-light);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--indigo)">' + _escapeHtml(_initialsFallback(m.name)) + '</div>' +
      '<div style="flex:1;font-size:14px;font-weight:600;color:var(--black)">' + _escapeHtml(m.name) + '</div>' +
      '<div onclick="newGroupRemoveInvitee(\'' + m.uid + '\')" style="width:20px;height:20px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--subtle);cursor:pointer">×</div>' +
    '</div>';
  }).join('');
}

function newGroupToggleAddFriends() {
  var el = document.getElementById('new-group-add-friends');
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    newGroupLoadAddableFriends();
  } else {
    el.style.display = 'none';
  }
}

function newGroupLoadAddableFriends() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var el = document.getElementById('new-group-add-friends');
  if (!user || !window.db || !el) return;
  el.innerHTML = '<div style="font-size:12px;color:var(--subtle)">Loading friends…</div>';
  var existingUids = (window._newGroupInvitees || []).map(function(x){ return x.uid; });
  Promise.all([
    window.db.collection('friendRequests').where('fromUid','==',user.uid).where('status','==','accepted').get(),
    window.db.collection('friendRequests').where('toUid','==',user.uid).where('status','==','accepted').get()
  ]).then(function(results){
    var uids = [];
    results[0].forEach(function(d){ uids.push(d.data().toUid); });
    results[1].forEach(function(d){ uids.push(d.data().fromUid); });
    uids = uids.filter(function(v,i){ return uids.indexOf(v) === i; });
    if (!uids.length) { el.innerHTML = '<div style="font-size:12px;color:var(--subtle)">You don\'t have any confirmed Innings friends yet — send a friend request from someone\'s profile, and once they accept, they\'ll show up here.</div>'; return; }
    Promise.all(uids.map(function(uid){ return window.db.collection('users').doc(uid).get(); })).then(function(docs){
      el.innerHTML = docs.map(function(doc){
        var d = doc.data() || {};
        var nm = d.name || 'Friend';
        var isAdded = existingUids.indexOf(doc.id) !== -1;
        if (isAdded) {
          return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;opacity:0.5">' +
            '<div style="width:32px;height:32px;border-radius:50%;background:var(--indigo-light);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--indigo)">' + _escapeHtml(_initialsFallback(nm)) + '</div>' +
            '<div style="flex:1;font-size:13px;font-weight:600;color:var(--black)">' + _escapeHtml(nm) + '</div>' +
            '<div style="font-size:11px;color:var(--subtle)">Already added</div>' +
          '</div>';
        }
        return '<div onclick="newGroupAddInvitee(\'' + doc.id + '\',\'' + nm.replace(/'/g,"\\'") + '\')" style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer">' +
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
    console.error('Load new-group addable friends error:', err);
    el.innerHTML = '<div style="font-size:12px;color:var(--subtle)">Could not load friends</div>';
  });
}

function newGroupAddInvitee(uid, name) {
  window._newGroupInvitees = window._newGroupInvitees || [];
  if (window._newGroupInvitees.map(function(x){ return x.uid; }).indexOf(uid) === -1) {
    window._newGroupInvitees.push({ uid: uid, name: name });
  }
  renderNewGroupInviteeList();
  newGroupLoadAddableFriends();
}

function newGroupRemoveInvitee(uid) {
  window._newGroupInvitees = (window._newGroupInvitees || []).filter(function(x){ return x.uid !== uid; });
  renderNewGroupInviteeList();
}

function saveNewGroup() {
  var nameEl = document.getElementById('new-group-name');
  var iconEl = document.getElementById('new-group-icon');
  var name = nameEl ? nameEl.value.trim() : '';
  var icon = iconEl ? iconEl.value.trim() : '';
  if (!name) { if (typeof ib_toast==='function') ib_toast('Give your group a name'); return; }
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in to create a group'); return; }
  var author = (window.userData && window.userData.name) || 'You';
  var invitees = window._newGroupInvitees || [];
  var memberUids = [user.uid].concat(invitees.map(function(m){ return m.uid; }));
  var members = [{ uid: user.uid, name: author }].concat(invitees.map(function(m){ return { uid: m.uid, name: m.name }; }));
  var groupData = {
    name: name,
    icon: icon || '💬',
    createdBy: user.uid,
    createdAt: Date.now(),
    memberUids: memberUids,
    members: members,
    features: []
  };
  window.db.collection('groups').add(groupData).then(function(ref){
    hideNewGroupModal();
    openGroup(Object.assign({ _id: ref.id }, groupData));
    if (invitees.length) {
      Promise.all(invitees.map(function(m){
        return window.db.collection('notifications').add({
          toUid: m.uid,
          type: 'added_to_group',
          fromUid: user.uid,
          fromName: author,
          groupId: ref.id,
          groupName: name,
          ts: Date.now(),
          read: false
        });
      })).catch(function(err){ console.error('Added-to-group notification error:', err); });
    }
  }).catch(function(err){
    console.error('Create group error:', err);
    if (typeof ib_toast==='function') ib_toast('Could not create group — ' + (err && err.message ? err.message : 'check Firestore rules'));
  });
}

// ── GROUP CHAT (per-group, dynamic) ──
window._groupChatUnsub = null;
window._groupChatSubscribedId = null;
function startGroupChat(groupId) {
  if (!window.db || !groupId) return;
  if (window._groupChatSubscribedId === groupId && window._groupChatUnsub) return;
  if (window._groupChatUnsub) { window._groupChatUnsub(); window._groupChatUnsub = null; }
  window._groupChatSubscribedId = groupId;
  window._groupChatUnsub = window.db.collection('groupChats').where('groupId', '==', groupId).orderBy('ts').limit(300).onSnapshot(function(snap){
    var msgs = [];
    snap.forEach(function(doc){ msgs.push(Object.assign({ _id: doc.id }, doc.data())); });
    renderGroupChat(msgs);
  }, function(err){
    console.error('Group chat error:', err);
    window._groupChatSubscribedId = null;
    var msg = 'Chat unavailable';
    if (err && err.code === 'failed-precondition') msg = 'Chat needs a Firestore index — check the browser console for a link to create it';
    else if (err && err.message) msg = 'Chat unavailable — ' + err.message;
    if (typeof ib_toast==='function') ib_toast(msg);
  });
}
