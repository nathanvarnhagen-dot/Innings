function sendInviteText() {
  // Friend invite — carries the sender's uid so whoever signs up (or logs in)
  // from this link becomes their friend automatically. See the link parser in
  // firebase-and-auth.js and consumePendingInviteLinks in groups.js.
  var me = window.currentUser || (window.auth && window.auth.currentUser);
  var myName = (window.userData && window.userData.name) || '';
  var inviteUrl = 'https://innings-zeta.vercel.app/' + (me
    ? '?friendInvite=' + encodeURIComponent(me.uid) + '&inviter=' + encodeURIComponent(myName || 'A friend')
    : '');
  var message = "Hey! I want you to join me on Innings — a private space for memories with the people that matter: " + inviteUrl;
  
  // Try native SMS share
  if (navigator.share) {
    // Only pass `text` (which already has the link in it) — also passing a
    // separate `url` made some share targets (iMessage) append the link a
    // second time, showing two link-preview cards for the same message
    navigator.share({
      title: 'Join me on Innings',
      text: message
    }).catch(function() {});
  } else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    window.open('sms:?&body=' + encodeURIComponent(message));
  } else if (/Android/i.test(navigator.userAgent)) {
    window.open('sms:?body=' + encodeURIComponent(message));
  } else {
    // Desktop fallback — copy to clipboard
    navigator.clipboard.writeText(message).then(function() {
      alert('Invite link copied to clipboard!\n\n' + message);
    }).catch(function() {
      prompt('Copy this invite link:', inviteUrl);
    });
  }
}

// Functions moved to standalone block above
