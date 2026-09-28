// The login callback can fire before every app script has loaded now that
// the app is split into files; hold it until the page has finished loading
// so it never calls into a file that isn't there yet (v7.3.0).
function _afterAppLoaded(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
  else fn();
}


firebase.initializeApp({
  apiKey: "AIzaSyAU2VzlnSOILn7CrzWIH-HMD3YmbMr0I6s",
  authDomain: "innings-558fc.firebaseapp.com",
  projectId: "innings-558fc",
  storageBucket: "innings-558fc.firebasestorage.app",
  messagingSenderId: "570364586597",
  appId: "1:570364586597:web:774cc634c7c143390ff48c"
});

var auth = firebase.auth();
var db = firebase.firestore();
window.db = db;
window.auth = auth;

// ── HELPERS ──
function ib_toast(msg) {
  var t = document.getElementById('ib-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ib-toast';
    t.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top, 0px) + 14px);left:50%;transform:translateX(-50%);background:#0A0A0F;color:white;padding:10px 20px;border-radius:22px;font-size:13px;font-weight:600;z-index:9999;max-width:calc(100vw - 32px);box-sizing:border-box;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,0.4);display:none';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._t);
  t._t = setTimeout(function(){ t.style.display = 'none'; }, 2800);
}

// If this page was opened from a group or future-plan text-invite link,
// remember which one it's for so we can show the person what they're
// joining before they even verify their number, and clear the URL after
// so a refresh doesn't repeat it. The actual join is still gated by their
// phone number matching a pending invite doc — this is UX only, not a
// security path.
(function() {
  try {
    var params = new URLSearchParams(window.location.search);
    var gid = params.get('groupInvite');
    var fid = params.get('futureInvite');
    if (!gid && !fid) return;
    var banner = document.getElementById('ob-group-invite-banner');
    if (gid) {
      window._pendingGroupInviteId = gid;
      window._pendingGroupInviteName = params.get('groupName') || 'a group';
      window._pendingGroupInviteInviter = params.get('inviter') || 'Someone';
      if (banner) {
        banner.textContent = '🎉 ' + window._pendingGroupInviteInviter + ' invited you to "' + window._pendingGroupInviteName + '" — verify your number below to join instantly.';
        banner.style.display = 'block';
      }
    } else if (fid) {
      window._pendingFutureInviteId = fid;
      window._pendingFutureInviteTitle = params.get('title') || 'a plan';
      window._pendingFutureInviteInviter = params.get('inviter') || 'Someone';
      if (banner) {
        banner.textContent = '🎉 ' + window._pendingFutureInviteInviter + ' invited you to "' + window._pendingFutureInviteTitle + '" — verify your number below to join instantly.';
        banner.style.display = 'block';
      }
    }
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  } catch (e) { console.error('Invite link parse error:', e); }
})();

function ib_showStep(stepId) {
  // Force hide all steps first
  var steps = ['ob-phone-step','ob-verify-step','ob-name-step'];
  steps.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.cssText = 'display:none!important';
    el.style.display = 'none';
  });
  // Show the target
  var target = document.getElementById(stepId);
  if (target) {
    target.style.cssText = '';
    target.style.display = 'flex';
    target.style.flexDirection = 'column';
    target.style.gap = '14px';
  }
}

function ib_setProfileDisplay(name, location, bio) {
  var nameDisplay = document.getElementById('profile-name-display');
  if (nameDisplay && name) nameDisplay.textContent = name;
  var av = document.getElementById('profile-av');
  if (av && name) {
    av.textContent = name.split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
  }
  var locEl = document.getElementById('profile-location');
  if (locEl && location) locEl.textContent = location + ' · joined 2026';
  var bioEl = document.getElementById('profile-bio');
  if (bioEl) {
    if (bio) { bioEl.textContent = bio; bioEl.style.display = 'block'; }
    else { bioEl.style.display = 'none'; bioEl.textContent = ''; }
  }
}

// ── PHONE AUTH ──
window.sendSMSCode = function() {
  var input = document.getElementById('phone-input');
  var phone = input ? input.value.replace(/\D/g,'') : '';
  if (phone.length !== 10) { ib_toast('Enter a valid 10-digit US number'); return; }

  var btn = document.querySelector('#ob-phone-step .ob-btn');
  if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }

  // Destroy old recaptcha
  if (window._ib_recaptcha) {
    try { window._ib_recaptcha.clear(); } catch(e) {}
    window._ib_recaptcha = null;
  }
  var old = document.getElementById('ib-recaptcha');
  if (old) old.remove();
  var div = document.createElement('div');
  div.id = 'ib-recaptcha';
  div.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px';
  document.body.appendChild(div);

  window._ib_recaptcha = new firebase.auth.RecaptchaVerifier('ib-recaptcha', {
    size: 'invisible', callback: function(){}
  });

  auth.signInWithPhoneNumber('+1' + phone, window._ib_recaptcha)
    .then(function(result) {
      window._ib_confirm = result;
      ib_showStep('ob-verify-step');
      ib_toast('Code sent! Check your texts.');
      if (btn) { btn.textContent = 'Send code'; btn.disabled = false; }
    })
    .catch(function(err) {
      console.error('SMS error:', err);
      var msg = err.code === 'auth/too-many-requests' ? 'Too many attempts. Try later.' :
                err.code === 'auth/invalid-phone-number' ? 'Invalid phone number.' :
                'Could not send code. Check the number and try again.';
      ib_toast(msg);
      if (btn) { btn.textContent = 'Send code'; btn.disabled = false; }
      if (window._ib_recaptcha) { try { window._ib_recaptcha.clear(); } catch(e){} window._ib_recaptcha = null; }
    });
};

window.verifyCode = function() {
  if (!window._ib_confirm) { ib_toast('Please request a code first'); ib_showStep('ob-phone-step'); return; }
  var codeEl = document.getElementById('verify-input');
  var code = codeEl ? codeEl.value.trim() : '';
  if (code.length < 6) { ib_toast('Enter the 6-digit code from your text'); return; }
  var btn = document.querySelector('#ob-verify-step .ob-btn');
  if (btn) { btn.textContent = 'Verifying…'; btn.disabled = true; }
  window._ib_confirm.confirm(code)
    .then(function() {
      if (window._ib_recaptcha) { try { window._ib_recaptcha.clear(); } catch(e){} window._ib_recaptcha = null; }
      var el = document.getElementById('ib-recaptcha');
      if (el) el.remove();
      ib_toast('Verified!');
      // The actual screen transition (name step for new users, straight to
      // feed for returning ones) happens via the global onAuthStateChanged
      // listener elsewhere, not here. If that hasn't visibly kicked in after
      // a few seconds, don't leave this button stuck on "Verifying…" with
      // zero feedback — that's what makes a successful login look broken
      // and invites someone to resend the code, which is how you end up
      // rate-limited over something that actually worked the first time.
      setTimeout(function(){
        if (btn && btn.disabled) { btn.textContent = 'Verify'; btn.disabled = false; }
      }, 4000);
    })
    .catch(function(err) {
      console.error('Verify error:', err);
      ib_toast('Wrong code — try again');
      if (btn) { btn.textContent = 'Verify'; btn.disabled = false; }
    });
};

window.saveProfile = function() {
  var nameEl = document.getElementById('name-input');
  var name = nameEl ? nameEl.value.trim() : '';
  if (!name) { ib_toast('Enter your name to continue'); return; }
  var user = auth.currentUser;
  if (!user) { ib_toast('Session expired — please start over'); ib_showStep('ob-phone-step'); return; }
  var btn = document.querySelector('#ob-name-step .ob-btn');
  if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
  db.collection('users').doc(user.uid).set({
    name: name,
    phone: user.phoneNumber,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function() {
    window.currentUser = user;
    window.userData = { name: name, phone: user.phoneNumber };
    ib_setProfileDisplay(name);
    if (typeof consumePendingInviteLinks === 'function') consumePendingInviteLinks(user, name);
    playLoginSplash(function(){ nav('welcome-intro'); wiRender(); });
  }).catch(function(err) {
    console.error('Save error:', err);
    ib_toast('Error saving — try again');
    if (btn) { btn.textContent = 'Start your innings'; btn.disabled = false; }
  });
};

// ── WELCOME INTRO (founder message) ──
var wiIdx = 0;
var wiTotal = 5;

function wiRender(){
  wiIdx = 0;
  wiUpdate();
}

function wiUpdate(){
  var track = document.getElementById('wi-track');
  if (!track) return;
  track.style.transform = 'translateX(-' + (wiIdx * (100/wiTotal)) + '%)';
  var dots = document.querySelectorAll('#wi-dots > div');
  dots.forEach(function(d,i){
    if (i === wiIdx) { d.style.background = '#A89FE8'; d.style.width = '18px'; d.style.borderRadius = '3px'; }
    else { d.style.background = 'rgba(255,255,255,0.2)'; d.style.width = '6px'; d.style.borderRadius = '50%'; }
  });
  var last = wiIdx === wiTotal - 1;
  var cta = document.getElementById('wi-cta');
  var hint = document.getElementById('wi-hint');
  if (cta) {
    cta.style.opacity = last ? '1' : '0';
    cta.style.pointerEvents = last ? 'auto' : 'none';
    cta.style.transform = last ? 'translateY(0)' : 'translateY(8px)';
  }
  if (hint) hint.style.opacity = last ? '0' : '1';
  var leadIcons = document.querySelectorAll('.wi-lead-icon');
  leadIcons.forEach(function(el){ el.classList.remove('in'); });
  var activeIcon = document.getElementById('wi-lead-icon-' + wiIdx);
  if (activeIcon) { setTimeout(function(){ activeIcon.classList.add('in'); }, 520); }
}

function wiNext(){ if (wiIdx < wiTotal - 1) { wiIdx++; wiUpdate(); } }
function wiPrev(){ if (wiIdx > 0) { wiIdx--; wiUpdate(); } }

function wiComplete(){
  var cta = document.getElementById('wi-cta');
  if (cta) { cta.textContent = 'Loading…'; cta.style.opacity = '0.6'; }
  var user = auth.currentUser;
  if (user) {
    db.collection('users').doc(user.uid).set({ welcomeIntroDone: true }, { merge: true })
      .catch(function(e){ console.error('welcomeIntroDone save error:', e); });
  }
  playWelcomeHomeSplash(function(){ nav('feed'); });
}

(function(){
  var startX = null;
  var screenEl = document.getElementById('screen-welcome-intro');
  if (!screenEl) return;
  screenEl.addEventListener('touchstart', function(e){ startX = e.touches[0].clientX; });
  screenEl.addEventListener('touchend', function(e){
    if (startX === null) return;
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) { if (dx < 0) wiNext(); else wiPrev(); }
    startX = null;
  });
})();

// ── AUTH STATE ──
auth.onAuthStateChanged(function(user) { var _self = this, _args = arguments; _afterAppLoaded(function () { (function(user) {
  if (!user) return;
  window.currentUser = user;
  db.collection('users').doc(user.uid).get()
    .then(function(snap) {
      if (snap.exists) {
        window.userData = snap.data();
        ib_setProfileDisplay(snap.data().name || '', snap.data().location || '', snap.data().bio || '');
        var pdata = snap.data();
        var photos = pdata.profilePhotos || (pdata.profilePhoto ? [pdata.profilePhoto] : []);
        if (photos.length && typeof applyProfilePhoto === 'function') applyProfilePhoto(photos);
        if (typeof renderInterests === 'function') renderInterests(pdata.interests || []);
        window.userData.customVibes = pdata.customVibes || [];
        if (typeof renderVibePills === 'function') renderVibePills();
        if (typeof consumePendingInviteLinks === 'function') consumePendingInviteLinks(user, pdata.name || '');
        if (typeof _convertPastFuturePlans === 'function') _convertPastFuturePlans(user);
        if (typeof _convertOslToMemoryIfNeeded === 'function') _convertOslToMemoryIfNeeded(user, pdata);
        if (typeof _archiveFeedbackIfNeeded === 'function') _archiveFeedbackIfNeeded(user, pdata);
        if (typeof startNotifBadge === 'function') startNotifBadge(user);
        if (pdata.welcomeIntroDone) {
          playLoginSplash(function(){ nav('feed'); });
        } else {
          playLoginSplash(function(){ nav('welcome-intro'); wiRender(); });
        }
      } else {
        ib_showStep('ob-name-step');
      }
    })
    .catch(function(err) {
      console.error('Auth state error:', err);
      ib_showStep('ob-name-step');
    });
}).apply(_self, _args); }); });
