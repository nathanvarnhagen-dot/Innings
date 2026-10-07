// ── NOTIFICATIONS ──

// Live badge on the bell icon — only shows when there's an actual unread
// notification, and updates in real time as new ones arrive or existing
// ones get marked read (no more static dot baked into the HTML). Also
// surfaces a one-time toast right after login summarizing what's waiting,
// since unread notifications (friend requests especially) were easy to
// never notice otherwise.
window._notifBadgeUnsub = null;
window._notifBadgeSubscribedUid = null;
window._notifLoginToastShown = false;

function startNotifBadge(user) {
  if (!window.db || !user) return;
  if (window._notifBadgeSubscribedUid === user.uid && window._notifBadgeUnsub) return;
  if (window._notifBadgeUnsub) { window._notifBadgeUnsub(); window._notifBadgeUnsub = null; }
  window._notifBadgeSubscribedUid = user.uid;
  window._notifBadgeUnsub = window.db.collection('notifications')
    .where('toUid', '==', user.uid)
    .where('read', '==', false)
    .onSnapshot(function(snap){
      _renderNotifBadge(snap.size);
      if (!window._notifLoginToastShown) {
        window._notifLoginToastShown = true;
        var total = snap.size;
        var msg;
        if (total === 0) {
          msg = 'No new notifications';
        } else {
          var friendReqCount = 0;
          snap.forEach(function(doc){ if ((doc.data() || {}).type === 'friend_request') friendReqCount++; });
          msg = (friendReqCount === total)
            ? (total === 1 ? '1 friend request waiting' : total + ' friend requests waiting')
            : (total === 1 ? '1 new notification' : total + ' new notifications');
        }
        // Delay past the login splash animation so this isn't hidden behind it
        setTimeout(function(){ _showNotifBubbleAnimation(msg); }, 1400);
      }
    }, function(err){
      console.error('Notif badge listener error:', err);
      window._notifBadgeSubscribedUid = null;
    });
}

// Shows the login notification count as a bubble that reads for a beat,
// then flies up and shrinks into the bell icon — makes it obvious where
// notifications live without a separate onboarding callout. Falls back to
// the plain shared toast if the bell isn't part of the currently active
// screen (e.g. a brand-new user still on Welcome Intro), since flying
// toward an invisible target would be confusing rather than helpful.
function _showNotifBubbleAnimation(msg) {
  var bell = document.getElementById('notif-bell-btn');
  var bellScreen = bell ? bell.closest('.screen') : null;
  var bellVisible = bellScreen && bellScreen.classList.contains('active');
  if (!bell || !bellVisible) { if (typeof ib_toast === 'function') ib_toast(msg); return; }

  var bubble = document.createElement('div');
  bubble.textContent = msg;
  bubble.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translate(-50%,0) scale(1);background:#0A0A0F;color:white;padding:10px 20px;border-radius:22px;font-size:13px;font-weight:600;z-index:9999;white-space:nowrap;opacity:1;transition:transform 0.55s cubic-bezier(.4,0,.2,1),opacity 0.45s ease 0.2s;pointer-events:none';
  document.body.appendChild(bubble);

  // Give it a beat to actually be read before it flies off
  setTimeout(function(){
    if (!document.body.contains(bell)) { bubble.remove(); return; }
    var bubbleRect = bubble.getBoundingClientRect();
    var bellRect = bell.getBoundingClientRect();
    var dx = (bellRect.left + bellRect.width / 2) - (bubbleRect.left + bubbleRect.width / 2);
    var dy = (bellRect.top + bellRect.height / 2) - (bubbleRect.top + bubbleRect.height / 2);
    bubble.style.transform = 'translate(calc(-50% + ' + dx + 'px), ' + dy + 'px) scale(0.15)';
    bubble.style.opacity = '0';

    setTimeout(function(){
      bubble.remove();
      // A quick landing pulse on the bell marks where it arrived
      bell.style.transition = 'transform 0.2s ease';
      bell.style.transform = 'scale(1.3)';
      setTimeout(function(){ bell.style.transform = 'scale(1)'; }, 220);
    }, 650);
  }, 1300);
}

// Updates every known bell location with the real unread count, not just
// a dot — each styled for its own header (Feed's is light, OSL's is dark,
// see isDark below) rather than sharing one hardcoded color.
function _updateBellBadge(bellId, count, isDark) {
  var bell = document.getElementById(bellId);
  if (!bell) return;
  var badge = bell.querySelector('.notif-count-badge');
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'notif-count-badge';
      badge.style.background = isDark ? 'rgba(168,159,232,0.95)' : 'var(--indigo)';
      badge.style.color = isDark ? '#0D0820' : 'white';
      badge.style.border = '1.5px solid ' + (isDark ? '#1A0A2E' : 'var(--card)');
      bell.appendChild(badge);
    }
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.style.display = 'flex';
  } else if (badge) {
    badge.style.display = 'none';
  }
}

function _renderNotifBadge(count) {
  _updateBellBadge('notif-bell-btn', count, false);
  _updateBellBadge('osl-notif-bell-btn', count, true);
}

function _fmtRelativeTime(ts) {
  if (!ts) return '';
  var diff = Date.now() - ts;
  var mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + 'm ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  var days = Math.floor(hrs / 24);
  if (days < 7) return days + 'd ago';
  return new Date(ts).toLocaleDateString();
}

// Marks every currently-unread notification as read once the person has
// actually viewed the list — visiting the screen clears the badge, not
// just tapping each item individually (the live listener above then
// clears the dot automatically once these writes land).
function _markAllNotificationsRead(user, items) {
  if (!window.db || !user) return;
  var unread = items.filter(function(n){ return !n.read; });
  if (!unread.length) return;
  var batch = window.db.batch();
  unread.forEach(function(n){ batch.update(window.db.collection('notifications').doc(n._id), { read: true }); });
  batch.commit().catch(function(err){ console.error('Mark all notifications read error:', err); });
}

function loadNotifications() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var emptyEl = document.getElementById('notif-empty');
  var itemsEl = document.getElementById('notif-items');
  if (!user || !window.db || !itemsEl) return;
  window.db.collection('notifications').where('toUid','==',user.uid).limit(100).get().then(function(snap){
    var items = [];
    snap.forEach(function(doc){ items.push(Object.assign({ _id: doc.id }, doc.data())); });
    items.sort(function(a,b){ return (b.ts || 0) - (a.ts || 0); });
    window._notificationsCache = {};
    items.forEach(function(n){ window._notificationsCache[n._id] = n; });
    if (emptyEl) emptyEl.style.display = items.length ? 'none' : 'flex';
    itemsEl.style.display = items.length ? 'flex' : 'none';
    itemsEl.innerHTML = items.map(function(n){
      var label;
      if (n.type === 'tagged') label = '<b>' + _escapeHtml(n.fromName || 'Someone') + '</b> marked a memory with you';
      else if (n.type === 'friend_request') label = '<b>' + _escapeHtml(n.fromName || 'Someone') + '</b> sent you a friend request';
      else if (n.type === 'friend_accepted') label = '<b>' + _escapeHtml(n.fromName || 'Someone') + '</b> accepted your friend request';
      else if (n.type === 'friend_joined') label = '<b>' + _escapeHtml(n.fromName || 'Someone') + '</b> joined from your invite — you’re friends now';
      else if (n.type === 'added_to_group') label = '<b>' + _escapeHtml(n.fromName || 'Someone') + '</b> added you to a group';
      else if (n.type === 'feedback_post') label = '<b>' + _escapeHtml(n.fromName || 'Someone') + '</b> posted feedback';
      else if (n.type === 'game_watch_joined') label = '<b>' + _escapeHtml(n.fromName || 'Someone') + '</b> started watching ' + _escapeHtml((n.away && n.home) ? (n.away + ' @ ' + n.home) : 'a game') + ' with you';
      else if (n.type === 'game_chat_request') label = '<b>' + _escapeHtml(n.fromName || 'Someone') + '</b> asked to join your ' + _escapeHtml((n.away && n.home) ? (n.away + ' @ ' + n.home) : 'game') + ' chat';
      else if (n.type === 'game_chat_approved') label = '<b>' + _escapeHtml(n.fromName || 'Someone') + '</b> let you into the ' + _escapeHtml((n.away && n.home) ? (n.away + ' @ ' + n.home) : 'game') + ' chat';
      else if (n.type === 'game_chat_message') label = '<b>' + _escapeHtml(n.fromName || 'Someone') + '</b> posted in the ' + _escapeHtml((n.away && n.home) ? (n.away + ' @ ' + n.home) : 'game') + ' chat';
      else if (n.type === 'on_this_day') label = '<b>' + (n.yearsAgo > 1 ? n.yearsAgo + ' years' : 'One year') + ' ago today</b> — look back at it';
      else label = '<b>' + _escapeHtml(n.fromName || 'Someone') + '</b> sent you a notification';
      var subLabel = (typeof _gdlHideNotif === 'function' && _gdlHideNotif(n)) ? 'Held by your delay' : n.momentName || n.groupName || n.messagePreview || (n.type === 'feedback_post' && n.category ? (n.category.charAt(0).toUpperCase() + n.category.slice(1)) : '');
      var acceptBtn = n.type === 'friend_request'
        ? '<div onclick="notifAcceptFriend(event,\'' + n._id + '\')" style="display:inline-block;margin-top:8px;font-size:11px;font-weight:800;color:#0D0820;background:#D4A24C;padding:6px 14px;border-radius:10px;cursor:pointer">Accept friend request</div>'
        : '';
      // v7.16.3: unread was var(--indigo-light) — a near-white card under
      // the dark theme's light text. Now a lit lilac card with a dot.
      return '<div onclick="notifTap(\'' + n._id + '\')" style="display:flex;gap:12px;align-items:center;padding:12px;border-radius:14px;' + (n.read ? 'background:var(--card);border:0.5px solid var(--rule)' : 'background:linear-gradient(135deg,rgba(124,108,240,.30),rgba(168,159,232,.12));border:1px solid rgba(168,159,232,.5);box-shadow:0 6px 20px rgba(91,76,214,.18)') + ';cursor:pointer">' +
        '<div class="av av-a" style="width:36px;height:36px;font-size:12px;flex-shrink:0">' + _escapeHtml(_initialsFallback(n.fromName || '?')) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13.5px;color:var(--black);line-height:1.4">' + label + '</div>' +
          (subLabel ? '<div style="font-size:12px;color:' + (n.read ? 'var(--subtle)' : 'rgba(244,242,255,.72)') + ';margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(subLabel) + '</div>' : '') +
          acceptBtn +
        '</div>' +
        '<div style="font-size:11px;color:' + (n.read ? 'var(--subtle)' : '#CFC7FF;font-weight:700') + ';flex-shrink:0;align-self:flex-start;display:flex;align-items:center;gap:6px">' + (n.read ? '' : '<span style="width:7px;height:7px;border-radius:50%;background:#A89FE8;box-shadow:0 0 8px #A89FE8"></span>') + _fmtRelativeTime(n.ts) + '</div>' +
      '</div>';
    }).join('');
    _markAllNotificationsRead(user, items);
  }).catch(function(err){
    console.error('Load notifications error:', err);
    if (itemsEl) itemsEl.innerHTML = '<div style="font-size:13px;color:var(--subtle);padding:12px 2px">Could not load notifications — ' + (err && err.message ? err.message : 'try again') + '</div>';
    if (itemsEl) itemsEl.style.display = 'flex';
    if (emptyEl) emptyEl.style.display = 'none';
  });
}

function notifTap(notifId) {
  var n = (window._notificationsCache || {})[notifId];
  if (!n) return;
  if (window.db && !n.read) {
    window.db.collection('notifications').doc(notifId).update({ read: true }).catch(function(){});
  }
  if (n.type === 'tagged' && n.momentOwnerUid && n.momentId) {
    openSharedMemory(n.momentOwnerUid, n.momentId, 'notifications');
  } else if (n.type === 'added_to_group' && n.groupId) {
    if (typeof openGroupById === 'function') openGroupById(n.groupId);
    if (typeof loadMyGroups === 'function') loadMyGroups();
  } else if ((n.type === 'friend_request' || n.type === 'friend_accepted' || n.type === 'friend_joined') && n.fromUid) {
    if (typeof openUserProfile === 'function') openUserProfile(n.fromUid);
  } else if (n.type === 'feedback_post') {
    nav('feedback-group');
    if (n.category) { setTimeout(function(){ if (typeof feedbackTab === 'function') feedbackTab(n.category); }, 0); }
  } else if (n.type === 'on_this_day' && n.momentId) {
    openMemory(n.momentId, 'notifications');
  } else if ((n.type === 'game_watch_joined' || n.type === 'game_chat_message' || n.type === 'game_chat_request' || n.type === 'game_chat_approved') && n.gamePk) {
    if (typeof openGameScreen === 'function') openGameScreen(n.gamePk, n.away, n.home, n.sport || 'mlb');
    if (n.type === 'game_chat_message' || n.type === 'game_chat_request' || n.type === 'game_chat_approved') { setTimeout(function(){ if (typeof gameDetailTab === 'function') gameDetailTab('chat'); }, 0); }
  }
}

// Accepts right from the notification row, no need to open their profile
// first. Newer notifications carry requestId directly; older ones (sent
// before that field existed) fall back to a live lookup by uid pair.
function notifAcceptFriend(evt, notifId) {
  if (evt) evt.stopPropagation();
  var n = (window._notificationsCache || {})[notifId];
  if (!n) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var btn = evt && evt.currentTarget;
  function finish(reqId) {
    if (!reqId) { if (typeof ib_toast === 'function') ib_toast('Could not find that request — try their profile instead'); return; }
    acceptFriendRequest(reqId);
    if (btn) btn.outerHTML = '<div style="display:inline-block;margin-top:8px;font-size:11px;font-weight:700;color:rgba(126,217,168,0.9)">Friends now 🎉</div>';
  }
  if (n.requestId) {
    finish(n.requestId);
  } else if (user && window.db && n.fromUid) {
    window.db.collection('friendRequests').where('fromUid','==',n.fromUid).where('toUid','==',user.uid).where('status','==','pending').limit(1).get()
      .then(function(snap){ finish(snap.empty ? null : snap.docs[0].id); })
      .catch(function(err){ console.error('Find friend request error:', err); if (typeof ib_toast==='function') ib_toast('Could not accept — try again'); });
  }
}
