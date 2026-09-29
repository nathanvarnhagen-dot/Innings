// ── NATIVE BRIDGE ──
// Only does anything inside the iOS app (innings-ios, Capacitor). In Safari
// window.Capacitor is undefined and every function here is a no-op, so the
// web app behaves exactly as before.
//
// Push: asks permission once after sign-in, then saves the APNs device token
// to users/{uid}/private/push (falls back to a field on the user doc if the
// rules refuse the subcollection). Sending comes later from a server function.
// Contacts: innings_nativeContactsAvailable() is checked by the Add Friends
// sheet (friends-and-profiles.js), which then uses the native picker.

function innings_isNative() {
  var C = window.Capacitor;
  return !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
}

function innings_plugin(name) {
  var C = window.Capacitor;
  return (innings_isNative() && C.Plugins && C.Plugins[name]) || null;
}

function innings_nativeContactsAvailable() {
  return !!innings_plugin('Contacts');
}

if (innings_isNative()) {
  document.documentElement.classList.add('is-native-app');
}

window._nativePushStarted = false;
function innings_initNativePush(user) {
  var Push = innings_plugin('PushNotifications');
  if (!Push || !user || window._nativePushStarted) return;
  window._nativePushStarted = true;
  var stage = 'listeners';

  Push.addListener('registration', function(t) {
    var token = t && t.value;
    if (!token || !window.db) return;
    stage = 'save-token';
    var rec = { tokens: firebase.firestore.FieldValue.arrayUnion(token), platform: 'ios', updatedAt: Date.now() };
    window.db.collection('users').doc(user.uid).collection('private').doc('push').set(rec, { merge: true })
      .catch(function(err) {
        console.warn('Push token → private/push refused, saving on user doc instead', err);
        return window.db.collection('users').doc(user.uid).set({ apnsTokens: firebase.firestore.FieldValue.arrayUnion(token) }, { merge: true });
      })
      .catch(function(err) { console.error('Push token save error [' + stage + ']:', err); });
  });

  Push.addListener('registrationError', function(err) {
    console.error('Push registration error:', err);
  });

  // Tapping a notification: open the notifications screen for now. Once the
  // sender includes a route (memory id, thread, game) this can deep-link.
  Push.addListener('pushNotificationActionPerformed', function(action) {
    var data = (action && action.notification && action.notification.data) || {};
    if (data.momentOwnerUid && data.momentId && typeof openSharedMemory === 'function') {
      openSharedMemory(data.momentOwnerUid, data.momentId, 'notifications');
    } else if (typeof nav === 'function') {
      nav('notifications');
    }
  });

  stage = 'permission';
  Push.checkPermissions().then(function(p) {
    if (p.receive === 'granted') return p;
    if (p.receive === 'denied') return null;
    return Push.requestPermissions();
  }).then(function(p) {
    if (!p || p.receive !== 'granted') return;
    stage = 'register';
    return Push.register();
  }).catch(function(err) {
    console.error('Push setup error [' + stage + ']:', err);
  });
}

// Native contacts → the same { name: [..], tel: [..] } shape the web Contact
// Picker returns, so _matchContactsAgainstUsers can stay as it is. On iOS 18+
// the system prompt lets the person share only some contacts ("limited").
function innings_getNativeContacts() {
  var Contacts = innings_plugin('Contacts');
  if (!Contacts) return Promise.reject(new Error('no-native-contacts'));
  return Contacts.requestPermissions().then(function(p) {
    var state = p && p.contacts;
    if (state !== 'granted' && state !== 'limited') {
      var e = new Error('contacts-denied'); e.code = 'denied'; throw e;
    }
    return Contacts.getContacts({ projection: { name: true, phones: true } });
  }).then(function(res) {
    return ((res && res.contacts) || []).map(function(c) {
      return {
        name: [(c.name && (c.name.display || [c.name.given, c.name.family].filter(Boolean).join(' '))) || 'Contact'],
        tel: (c.phones || []).map(function(ph) { return ph.number; }).filter(Boolean)
      };
    }).filter(function(c) { return c.tel.length; });
  });
}
