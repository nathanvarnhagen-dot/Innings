// ── MEMORIES: load + render ──
// Firestore's SDK throws (synchronously, before any .catch can see it) if
// ANY field anywhere in a write — even nested — is undefined rather than
// null or simply absent. Data pulled from a third-party API (like the MLB
// box score) can easily have a missing field come through as undefined.
// Round-tripping through JSON strips those out safely, since JSON has no
// concept of undefined (object keys are dropped, array entries become null).
function _sanitizeForFirestore(obj) {
  if (obj === undefined || obj === null) return null;
  try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return null; }
}

// Every "today" comparison in this app is against plain YYYY-MM-DD strings
// from <input type="date">, which are always the browser's LOCAL calendar
// date — never a timezone. `new Date().toISOString()` returns UTC, which
// runs a full calendar day ahead of any US timezone for several hours every
// evening. Comparing a local date string against a UTC "today" can make an
// still-upcoming plan look like it's already in the past. This is the one
// correct way to get "today" as a local date string; every date-comparison
// call site below uses this instead.
function _todayLocal() {
  var d = new Date();
  var mm = String(d.getMonth() + 1);
  if (mm.length < 2) mm = '0' + mm;
  var dd = String(d.getDate());
  if (dd.length < 2) dd = '0' + dd;
  return d.getFullYear() + '-' + mm + '-' + dd;
}

function _escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _formatMomentDate(s) {
  if (!s) return '';
  var p = String(s).split('-');
  if (p.length !== 3) return s;
  var d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function _initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(function(w){ return w[0] || ''; }).join('').toUpperCase().slice(0, 2);
}

window._moments = [];
window._foreignMomentCache = {};
function _findMoment(id) {
  if (window._foreignMomentCache && window._foreignMomentCache[id]) return window._foreignMomentCache[id];
  for (var i = 0; i < window._moments.length; i++) { if (window._moments[i]._id === id) return window._moments[i]; }
  return null;
}

function loadMoments() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { window._moments = []; renderMoments([]); updateProfileStats([]); return; }
  // Show cached data immediately so the list is already stable by the time
  // this screen becomes interactive. The Firestore fetch below is async
  // with unpredictable timing — if it lands while someone's mid-scroll and
  // replaces every DOM node in the list at that moment, iOS can permanently
  // detach the scroll gesture from the new nodes. Rendering from cache
  // first, then only replacing the DOM if the data actually changed, avoids
  // that swap happening in the common case where nothing is different.
  if (window._moments && window._moments.length) {
    renderMoments(window._moments);
    updateProfileStats(window._moments);
  }
  window.db.collection('users').doc(user.uid).collection('moments').get()
    .then(function(snap) {
      var arr = [];
      snap.forEach(function(doc) { var d = doc.data(); d._id = doc.id; arr.push(d); });
      arr.sort(function(a, b) {
        var ta = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0;
        var tb = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0;
        if (tb !== ta) return tb - ta;
        return (b.date || '').localeCompare(a.date || '');
      });
      var prevIds = (window._moments || []).map(function(m){ return m._id; }).join(',');
      var newIds = arr.map(function(m){ return m._id; }).join(',');
      var listEl = document.getElementById('mem-list');
      var needsRender = prevIds !== newIds || !listEl || !listEl.children.length;
      window._moments = arr;
      if (needsRender) renderMoments(arr);
      updateProfileStats(arr);
      if (typeof renderCalendar === 'function') renderCalendar();
      if (typeof loadFutureMoments === 'function') loadFutureMoments();
      if (typeof loadWatchedGamesForCalendar === 'function') loadWatchedGamesForCalendar();
    })
    .catch(function(err) {
      console.error('Load moments error:', err);
      if (!window._moments || !window._moments.length) { renderMoments([]); updateProfileStats([]); }
    });
}

// ── A PLAN BECOMES A MEMORY ──
// Future moments and past memories are two different collections with
// different shapes. There's no server-side cron in this stack, so "the
// moment it happens" really means "the next time your own device checks" —
// on sign-in, and every time the Feed loads its "Coming up" list. Runs for
// plans you own AND plans you're tagged in — each person converts their own
// copy into their own memories on their own device (matches who's allowed
// to write there). The shared plan doc is marked converted per-uid rather
// than deleted, so whichever person's device gets to it first doesn't erase
// it before everyone else tagged in it has had a chance to convert too.
function _convertPastFuturePlans(user) {
  if (!user || !window.db) return;
  if (window._convertingPlans) return;
  window._convertingPlans = true;
  var today = _todayLocal();
  Promise.all([
    window.db.collection('futureMoments').where('ownerUid', '==', user.uid).get(),
    window.db.collection('futureMoments').where('taggedUids', 'array-contains', user.uid).get()
  ]).then(function(results){
    var map = {};
    results[0].forEach(function(doc){ map[doc.id] = Object.assign({ _id: doc.id }, doc.data()); });
    results[1].forEach(function(doc){ map[doc.id] = Object.assign({ _id: doc.id }, doc.data()); });
    var toConvert = Object.keys(map).map(function(k){ return map[k]; }).filter(function(m){
      if (!(m.date && m.date < today)) return false;
      return (m.convertedUids || []).indexOf(user.uid) === -1;
    });
    window._convertingPlans = false;
    if (!toConvert.length) return;
    Promise.all(toConvert.map(function(m){ return _convertFutureMomentToMemory(m, user); })).then(function(){
      if (typeof loadMoments === 'function') loadMoments();
      if (typeof loadFutureMoments === 'function') loadFutureMoments();
      if (typeof ib_toast === 'function') ib_toast(toConvert.length === 1 ? '"' + (toConvert[0].title || 'Your plan') + '" is now a memory 📖' : toConvert.length + ' plans became memories 📖');
    }).catch(function(err){ console.error('Convert past plans error:', err); });
  }).catch(function(err){ window._convertingPlans = false; console.error('Check past plans error:', err); });
}

function _convertFutureMomentToMemory(m, user) {
  var otherUids = [m.ownerUid].concat(m.taggedUids || []).filter(function(uid, i, arr){
    return uid && uid !== user.uid && arr.indexOf(uid) === i;
  });
  var freshBoxScore = Promise.resolve(m.boxScore || null);
  if (m.boxScore && m.boxScore.gamePk) {
    freshBoxScore = fetch('/api/mlb?mode=boxscore&gamePk=' + encodeURIComponent(m.boxScore.gamePk))
      .then(function(r){ return r.json(); })
      .catch(function(){ return m.boxScore; });
  }
  return Promise.all([
    Promise.all(otherUids.map(function(uid){
      return window.db.collection('users').doc(uid).get().then(function(doc){
        return (doc.exists && doc.data().name) ? doc.data().name : 'A friend';
      }).catch(function(){ return 'A friend'; });
    })),
    freshBoxScore
  ]).then(function(results){
    var names = results[0];
    var boxScore = results[1];
    return window.db.collection('users').doc(user.uid).collection('moments').add({
      name: m.title || 'Untitled memory',
      date: m.date,
      vibe: m.vibe || '',
      highlight: m.location ? 'at ' + m.location : '',
      dedication: '',
      photo: '',
      photos: [],
      people: names,
      taggedUids: otherUids,
      sourcePlanId: m._id,
      boxScore: _sanitizeForFirestore(boxScore),
      stops: _sanitizeForFirestore(m.stops || []),
      comments: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }).then(function(){
    return window.db.collection('futureMoments').doc(m._id).update({
      convertedUids: firebase.firestore.FieldValue.arrayUnion(user.uid)
    });
  }).catch(function(err){
    console.error('Convert future plan to memory error:', m._id, err);
  });
}

// ── OUTSIDE LANDS → MEMORY ──
// OSL isn't a futureMoments doc — it's tracked entirely via oslRsvp /
// oslActRsvps on each user's own doc, plus a handful of global chat/photo
// collections. Once the festival's actual last day has passed, this turns
// each Going/Maybe attendee's own weekend into a real memory in their own
// Memories — pulling in the acts they picked, any photos they personally
// contributed (from oslPhotos and every artist's actPhotos), and which of
// their accepted friends also went. Runs once per person, the next time
// they open the app. The live OSL screens, chat, and photos stay exactly
// as they are — nothing here hides or replaces them, it just also makes
// the weekend show up in Memories.
var OSL_LAST_DAY = '2026-08-09';
function _oslHasConcluded() {
  return _todayLocal() > OSL_LAST_DAY;
}

// Once the festival's actually over, its own auto-created memory (see
// _convertOslToMemoryIfNeeded below) is where it lives now — the live
// group, chat, and photos are all still fully intact and reachable from
// that memory's "Reopen Outside Lands" link, this just stops the Feed
// banner from reading as if it's still upcoming.
function _applyOslBannerVisibility() {
  var el = document.getElementById('osl-feed-banner');
  if (el) el.style.display = _oslHasConcluded() ? 'none' : 'flex';
}

window._oslMemoryConversionRunning = false;
function _oslStage(promise, label) {
  return promise.catch(function(err){
    if (err && !err._oslStage) err._oslStage = label;
    throw err;
  });
}

function _convertOslToMemoryIfNeeded(user, pdata) {
  if (!user || !window.db) return;
  if (!_oslHasConcluded()) return;
  var rsvp = pdata && pdata.oslRsvp;
  if (rsvp !== 'going' && rsvp !== 'maybe') return;
  if (window._oslMemoryConversionRunning) return;
  window._oslMemoryConversionRunning = true;

  var userRef = window.db.collection('users').doc(user.uid);
  var momentsRef = userRef.collection('moments');

  // Check whether the memory actually exists rather than trusting the
  // oslConvertedToMemory flag alone. The old version set that flag first
  // and only created the memory afterward — if any of the reads below
  // ever failed (a bad photo doc, a dropped connection, anything), the
  // flag was already permanently true with no memory to show for it, and
  // every future app open would see the flag and skip retrying forever.
  // This makes the whole thing self-healing: if the flag is wrongly set
  // from a past failed attempt, this notices there's no memory yet and
  // just creates it now.
  //
  // oslMemoryToastSeen is separate from oslConvertedToMemory on purpose:
  // this function runs on every single app load once OSL has concluded,
  // so without a dedicated "already notified" flag, EVERY load that
  // finds the memory already existing re-fires the toast — that's the
  // "seen it dozens of times" bug. oslConvertedToMemory tracks whether
  // the memory exists; oslMemoryToastSeen tracks whether the person has
  // already been told about it.
  var alreadyToasted = !!(pdata && pdata.oslMemoryToastSeen);
  _oslStage(momentsRef.where('isOslMemory', '==', true).limit(1).get(), 'exists-check').then(function(existing){
    if (!existing.empty) {
      window._oslMemoryConversionRunning = false;
      var updates = {};
      if (!(pdata && pdata.oslConvertedToMemory)) updates.oslConvertedToMemory = true;
      if (!alreadyToasted) updates.oslMemoryToastSeen = true;
      if (Object.keys(updates).length) userRef.set(updates, { merge: true }).catch(function(){});
      // A memory doc already exists here. If it's not showing up on the
      // Memories screen despite that, this isn't a "never converted" bug —
      // it's a render/data issue with the existing doc. Force a refresh,
      // and say so plainly the first time — but only the first time.
      if (typeof loadMoments === 'function') loadMoments();
      if (!alreadyToasted && typeof ib_toast === 'function') ib_toast('Found your existing Outside Lands memory — check Memories now');
      return;
    }
    return _oslStage(Promise.all([
      window.db.collection('oslPhotos').where('uid', '==', user.uid).get(),
      window.db.collection('actPhotos').where('uid', '==', user.uid).get(),
      window.db.collection('friendRequests').where('fromUid', '==', user.uid).where('status', '==', 'accepted').get(),
      window.db.collection('friendRequests').where('toUid', '==', user.uid).where('status', '==', 'accepted').get()
    ]), 'reads').then(function(results){
      var photos = [];
      results[0].forEach(function(doc){ var p = doc.data().photo; if (p) photos.push(p); });
      results[1].forEach(function(doc){ var p = doc.data().photo; if (p) photos.push(p); });
      // Capped at 1, not 5. These are stored as inline base64, not
      // Storage URLs, and Firestore caps a single document at 1MB — a
      // handful of full images landing in the same doc is an easy way to
      // quietly cross that line at write time. The rest of the photos
      // aren't lost; they're still reachable from this memory's own
      // "Reopen Outside Lands" link, same live oslPhotos/actPhotos data.
      photos = photos.slice(0, 1);

      var friendUids = [];
      results[2].forEach(function(d){ friendUids.push(d.data().toUid); });
      results[3].forEach(function(d){ friendUids.push(d.data().fromUid); });
      friendUids = friendUids.filter(function(v, i){ return !!v && friendUids.indexOf(v) === i; });

      var friendLookup = friendUids.length
        ? Promise.all(friendUids.map(function(uid){ return window.db.collection('users').doc(uid).get(); }))
        : Promise.resolve([]);

      return _oslStage(friendLookup, 'friend-lookup').then(function(docs){
        var peopleNames = [], taggedUids = [];
        docs.forEach(function(doc){
          var d = doc.data() || {};
          if (d.oslRsvp === 'going' || d.oslRsvp === 'maybe') {
            peopleNames.push(d.name || 'A friend');
            taggedUids.push(doc.id);
          }
        });
        return { photos: photos, peopleNames: peopleNames, taggedUids: taggedUids };
      });
    }).then(function(bundle){
      var goingActs = Object.keys((pdata && pdata.oslActRsvps) || {}).filter(function(k){ return pdata.oslActRsvps[k] === 'going'; });
      var highlight = goingActs.length
        ? goingActs.slice(0, 3).join(', ') + (goingActs.length > 3 ? ' + ' + (goingActs.length - 3) + ' more' : '')
        : 'Three days at Golden Gate Park';
      // Written together in one batch so the memory and the "done" flags
      // can never land in a mismatched state again — either both succeed
      // or neither does.
      var batch = window.db.batch();
      batch.set(momentsRef.doc(), {
        name: 'Outside Lands 2026',
        date: '2026-08-07',
        vibe: '🎪 Festival',
        isOslMemory: true,
        highlight: highlight,
        oslActs: goingActs,
        dedication: '',
        photo: bundle.photos[0] || '',
        photos: bundle.photos.slice(1),
        people: bundle.peopleNames,
        taggedUids: bundle.taggedUids,
        boxScore: null,
        comments: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      batch.set(userRef, { oslConvertedToMemory: true, oslMemoryToastSeen: true }, { merge: true });
      return _oslStage(batch.commit(), 'write');
    });
  }).then(function(){
    window._oslMemoryConversionRunning = false;
    if (typeof loadMoments === 'function') loadMoments();
    if (!alreadyToasted && typeof ib_toast === 'function') ib_toast('Outside Lands is now saved to your Memories 🎪');
  }).catch(function(err){
    window._oslMemoryConversionRunning = false;
    console.error('Convert OSL to memory error:', err);
    // This used to only log to a console nobody was looking at, and even
    // once surfaced, a bare error code alone wasn't enough to pin down
    // where in a five-stage chain it happened. Now it names the stage too.
    var stage = err && err._oslStage ? ' [' + err._oslStage + ']' : '';
    var detail = (err && (err.code || err.message)) || 'unknown error';
    if (typeof ib_toast === 'function') ib_toast('OSL memory failed' + stage + ': ' + detail);
  });
}

// Compact "🎟️ Tickets" pill shown on plan cards in the Feed and Calendar/
// Memories lists — stopPropagation keeps it from also triggering the
// card's openFutureDetail() navigation.
function _ticketButtonHtml(m) {
  if (!m.ticketLink) return '';
  return '<a href="' + _escapeHtml(m.ticketLink) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:5px;margin-top:10px;background:rgba(255,255,255,0.22);color:white;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:700;text-decoration:none;font-family:inherit">🎟️ Tickets</a>';
}

// Shared background for a future plan's hero and card everywhere it shows
// up (Feed, Calendar/Memories, the detail screen) — a cover photo with a
// dark scrim so the white text stays legible, or the plain theme gradient
// when no photo's been set. Returns a CSS declaration with no trailing
// semicolon, meant to be dropped straight into a style attribute.
function _futureBgStyle(m) {
  var theme = m.theme || 'linear-gradient(135deg,#FF6B6B 0%,#FFA94D 45%,#845EF7 100%)';
  if (m.coverPhoto) {
    return 'background-image:linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.6)),url(' + m.coverPhoto + ');background-size:cover;background-position:center';
  }
  return 'background:' + theme;
}

// ── WATCHED GAMES ON THE CALENDAR — same synthesis pattern renderCalendar()
// already uses for Outside Lands and future plans: load once, cache by id,
// and let renderCalendar() fold them into momentsByDate on its own date.
// Only watching docs with a date attached can be placed — that field was
// added alongside this feature, so anything marked Watching before this
// shipped won't have one and just won't show up here (it's still fully
// intact under Watching/the game screen itself, just not calendar-dated).
window._watchedGamesCache = {};
function loadWatchedGamesForCalendar() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { window._watchedGamesCache = {}; return; }
  window.db.collection('users').doc(user.uid).collection('watching').get().then(function (snap) {
    var cache = {};
    snap.forEach(function (doc) {
      var d = doc.data() || {};
      if (!d.date) return;
      cache[doc.id] = Object.assign({ _id: doc.id }, d);
    });
    window._watchedGamesCache = cache;
    if (typeof renderCalendar === 'function') renderCalendar();
  }).catch(function (err) { console.error('Load watched games for calendar error:', err); });
}

function loadFutureMoments() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (user && typeof _convertPastFuturePlans === 'function') _convertPastFuturePlans(user);
  var listEl = document.getElementById('upcoming-list');
  var wrapEl = document.getElementById('upcoming-section');
  if (!user || !window.db || !listEl) return;
  Promise.all([
    window.db.collection('futureMoments').where('ownerUid','==',user.uid).get(),
    window.db.collection('futureMoments').where('taggedUids','array-contains',user.uid).get()
  ]).then(function(results){
    var map = {};
    results[0].forEach(function(doc){ map[doc.id] = Object.assign({ _id: doc.id }, doc.data()); });
    results[1].forEach(function(doc){ map[doc.id] = Object.assign({ _id: doc.id }, doc.data()); });
    var arr = Object.keys(map).map(function(k){ return map[k]; });
    var today = _todayLocal();
    arr = arr.filter(function(m){ return !m.date || m.date >= today; });
    arr.sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
    if (wrapEl) wrapEl.style.display = arr.length ? 'block' : 'none';
    window._futureMomentsCache = {};
    arr.forEach(function(m){ window._futureMomentsCache[m._id] = m; });
    listEl.innerHTML = arr.map(function(m){
      var isOwner = m.ownerUid === user.uid;
      var myRsvp = (m.rsvps || {})[user.uid] || '';
      var goingCount = Object.keys(m.rsvps || {}).filter(function(k){ return m.rsvps[k] === 'going'; }).length;
      var rsvpUi = isOwner
        ? '<div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:10px">' + goingCount + ' going · tap to edit</div>'
        : '<div style="display:flex;gap:6px;margin-top:12px">' +
          '<button onclick="event.stopPropagation();futureRsvp(\'' + m._id + '\',\'going\')" style="flex:1;padding:8px 4px;border-radius:10px;background:' + (myRsvp==='going'?'#A89FE8':'rgba(255,255,255,0.2)') + ';color:' + (myRsvp==='going'?'#1A1640':'white') + ';border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Going</button>' +
          '<button onclick="event.stopPropagation();futureRsvp(\'' + m._id + '\',\'maybe\')" style="flex:1;padding:8px 4px;border-radius:10px;background:' + (myRsvp==='maybe'?'#A89FE8':'rgba(255,255,255,0.2)') + ';color:' + (myRsvp==='maybe'?'#1A1640':'white') + ';border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Maybe</button>' +
          '<button onclick="event.stopPropagation();futureRsvp(\'' + m._id + '\',\'no\')" style="flex:1;padding:8px 4px;border-radius:10px;background:' + (myRsvp==='no'?'#A89FE8':'rgba(255,255,255,0.2)') + ';color:' + (myRsvp==='no'?'#1A1640':'white') + ';border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Can\'t go</button>' +
        '</div>';
      return '<div onclick="_heroZoomToFuture(this,\'' + m._id + '\')" style="cursor:pointer;' + _futureBgStyle(m) + ';border-radius:20px;padding:18px;margin-bottom:12px;box-shadow:0 6px 16px rgba(0,0,0,0.15)">' +
        '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.08em">' + _escapeHtml(m.vibe || '') + '</div>' +
        '<div style="font-size:19px;font-weight:800;color:white;letter-spacing:-0.4px;margin-top:4px">' + _escapeHtml(m.title || 'Untitled plan') + '</div>' +
        '<div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px">' + _escapeHtml(m.date ? _formatMomentDate(m.date) : '') + (m.time ? ' · ' + m.time : '') + (m.location ? ' · ' + _escapeHtml(m.location) : '') + '</div>' +
        _ticketButtonHtml(m) +
        rsvpUi +
      '</div>';
    }).join('');
    if (typeof renderCalendar === 'function') renderCalendar();
  }).catch(function(err){ console.error('Load future moments error:', err); });
}

// ── FEED: public "coming up" stream — your own plans, plans you're tagged
// in, and any public plan posted by an accepted friend ──
function loadFeedMoments() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var listEl = document.getElementById('feed-upcoming-list');
  var emptyEl = document.getElementById('feed-upcoming-empty');
  if (!user || !window.db || !listEl) return;
  listEl.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,0.4);padding:12px 2px">Loading…</div>';
  listEl.style.display = 'flex';
  if (emptyEl) emptyEl.style.display = 'none';

  Promise.all([
    window.db.collection('friendRequests').where('fromUid','==',user.uid).where('status','==','accepted').get(),
    window.db.collection('friendRequests').where('toUid','==',user.uid).where('status','==','accepted').get()
  ]).then(function(results){
    var friendUids = [];
    results[0].forEach(function(d){ friendUids.push(d.data().toUid); });
    results[1].forEach(function(d){ friendUids.push(d.data().fromUid); });
    friendUids = friendUids.filter(function(v,i){ return !!v && friendUids.indexOf(v) === i; }).slice(0, 10);

    var queries = [
      window.db.collection('futureMoments').where('ownerUid','==',user.uid).get(),
      window.db.collection('futureMoments').where('taggedUids','array-contains',user.uid).get()
    ];
    if (friendUids.length) {
      queries.push(window.db.collection('futureMoments').where('public','==',true).where('ownerUid','in',friendUids).get());
    }
    return Promise.all(queries);
  }).then(function(results){
    var map = {};
    results.forEach(function(snap){ snap.forEach(function(doc){ map[doc.id] = Object.assign({ _id: doc.id }, doc.data()); }); });
    var arr = Object.keys(map).map(function(k){ return map[k]; });
    var today = _todayLocal();
    arr = arr.filter(function(m){ return !m.date || m.date >= today; });
    arr.sort(function(a,b){ return (a.date||'').localeCompare(b.date||''); });
    window._feedMomentsCache = {};
    arr.forEach(function(m){ window._feedMomentsCache[m._id] = m; });

    if (emptyEl) emptyEl.style.display = arr.length ? 'none' : 'flex';
    listEl.style.display = arr.length ? 'flex' : 'none';

    listEl.innerHTML = arr.map(function(m){
      var isOwner = m.ownerUid === user.uid;
      var myRsvp = (m.rsvps || {})[user.uid] || '';
      var goingCount = Object.keys(m.rsvps || {}).filter(function(k){ return m.rsvps[k] === 'going'; }).length;
      var byline = isOwner ? 'Your plan' : _escapeHtml((m.ownerName || 'A friend').split(' ')[0]) + ' is going';
      var rsvpUi = isOwner
        ? '<div style="font-size:12px;color:rgba(255,255,255,0.85);margin-top:10px">' + goingCount + ' going · tap to edit</div>'
        : '<div style="display:flex;gap:6px;margin-top:12px">' +
          '<button onclick="event.stopPropagation();futureRsvp(\'' + m._id + '\',\'going\')" style="flex:1;padding:8px 4px;border-radius:10px;background:' + (myRsvp==='going'?'#A89FE8':'rgba(255,255,255,0.2)') + ';color:' + (myRsvp==='going'?'#1A1640':'white') + ';border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Going</button>' +
          '<button onclick="event.stopPropagation();futureRsvp(\'' + m._id + '\',\'maybe\')" style="flex:1;padding:8px 4px;border-radius:10px;background:' + (myRsvp==='maybe'?'#A89FE8':'rgba(255,255,255,0.2)') + ';color:' + (myRsvp==='maybe'?'#1A1640':'white') + ';border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Maybe</button>' +
          '<button onclick="event.stopPropagation();futureRsvp(\'' + m._id + '\',\'no\')" style="flex:1;padding:8px 4px;border-radius:10px;background:rgba(255,255,255,0.2);color:white;border:none;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">Can\'t go</button>' +
        '</div>';
      return '<div onclick="_heroZoomToFuture(this,\'' + m._id + '\')" style="cursor:pointer;' + _futureBgStyle(m) + ';border-radius:20px;padding:18px;margin-bottom:12px;box-shadow:0 6px 16px rgba(0,0,0,0.15)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:0.08em">' + _escapeHtml(m.vibe || '') + '</div>' +
          (m.public ? '<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.9);background:rgba(255,255,255,0.2);padding:2px 8px;border-radius:10px">🌎 Public</div>' : '') +
        '</div>' +
        '<div style="font-size:19px;font-weight:800;color:white;letter-spacing:-0.4px;margin-top:4px">' + _escapeHtml(m.title || 'Untitled plan') + '</div>' +
        '<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px">' + byline + '</div>' +
        '<div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:6px">' + _escapeHtml(m.date ? _formatMomentDate(m.date) : '') + (m.time ? ' · ' + m.time : '') + (m.location ? ' · ' + _escapeHtml(m.location) : '') + '</div>' +
        _ticketButtonHtml(m) +
        rsvpUi +
      '</div>';
    }).join('');
  }).catch(function(err){
    console.error('Load feed moments error:', err);
    listEl.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,0.4);padding:12px 2px">Could not load feed — try again</div>';
  });
}

function startFuturePlan() {
  pbOpen();
}

function futureRsvp(momentId, val) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  var update = {};
  update['rsvps.' + user.uid] = val;
  window.db.collection('futureMoments').doc(momentId).update(update)
    .then(function(){ if (typeof loadFutureMoments === 'function') loadFutureMoments(); })
    .catch(function(err){ console.error('Future RSVP error:', err); if (typeof ib_toast === 'function') ib_toast('Could not RSVP — try again'); });
}

// The Calendar/Memories "Upcoming" list and the Feed's "Coming up" list load
// independently and keep separate caches (_futureMomentsCache vs
// _feedMomentsCache) — a plan seen only in one (e.g. a friend's public plan
// that only ever loaded into the Feed) wasn't found when tapped, so the
// card just sat there doing nothing. This checks both, and stashes whatever
// it finds into _futureMomentsCache too, since every other function here
// (edit, RSVP, delete, chat) reads only from that one cache by design.
function _findFutureMoment(id) {
  var m = (window._futureMomentsCache || {})[id];
  if (m) return m;
  m = (window._feedMomentsCache || {})[id];
  if (m) {
    window._futureMomentsCache = window._futureMomentsCache || {};
    window._futureMomentsCache[id] = m;
    return m;
  }
  return null;
}
