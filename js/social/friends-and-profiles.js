// ── FRIENDS ──
function _initialsFallback(nm){ return typeof _initials==='function' ? _initials(nm) : (nm||'?').charAt(0).toUpperCase(); }

function openUserProfile(uid) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!window.db || !uid) return;
  if (user && uid === user.uid) { nav('profile'); return; }
  window._profileReturnTo = document.querySelector('.screen.active') ? document.querySelector('.screen.active').id.replace('screen-','') : 'osl-group';
  _navApplyScreen('view-profile');
  var avEl = document.getElementById('vp-av');
  var nameEl = document.getElementById('vp-name');
  var locEl = document.getElementById('vp-location');
  var badgeEl = document.getElementById('vp-friend-badge');
  var friendsSectionEl = document.getElementById('vp-friends-section');
  var eventsSectionEl = document.getElementById('vp-events-section');
  var interestsSectionEl = document.getElementById('vp-interests-section');
  if (nameEl) nameEl.textContent = 'Loading…';
  if (badgeEl) { badgeEl.style.display = 'none'; badgeEl.onclick = null; }
  if (friendsSectionEl) friendsSectionEl.style.display = 'none';
  if (eventsSectionEl) eventsSectionEl.style.display = 'none';
  if (interestsSectionEl) interestsSectionEl.style.display = 'none';
  var vpBioEl = document.getElementById('vp-bio');
  if (vpBioEl) { vpBioEl.style.display = 'none'; vpBioEl.textContent = ''; }
  _renderVpPhotos([]);
  _renderVpSharedMemoriesLoading();
  ['vp-stat-streak','vp-stat-events','vp-stat-memories'].forEach(function(id){ var el = document.getElementById(id); if (el) el.textContent = '—'; });
  window.db.collection('users').doc(uid).get().then(function(doc){
    var d = doc.exists ? doc.data() : {};
    var nm = d.name || 'Innings User';
    if (nameEl) nameEl.textContent = nm;
    if (locEl) locEl.textContent = d.location || '';
    var bioEl = document.getElementById('vp-bio');
    if (bioEl) {
      if (d.bio) { bioEl.textContent = d.bio; bioEl.style.display = 'block'; }
      else { bioEl.style.display = 'none'; bioEl.textContent = ''; }
    }
    if (avEl) {
      if (d.profilePhotos && d.profilePhotos.length) {
        avEl.style.backgroundImage = 'url(' + d.profilePhotos[0] + ')';
        avEl.style.backgroundSize = 'cover';
        avEl.style.backgroundPosition = 'center';
        avEl.textContent = '';
      } else {
        avEl.style.backgroundImage = '';
        avEl.textContent = _initialsFallback(nm);
      }
    }
    _renderVpPhotos(d.profilePhotos || []);
    _renderVpInterests(nm, d.interests || []);
    _renderVpFriendBadge(uid);
    _renderVpEvents(uid, nm, d);
    _computeAndRenderUserStats(uid);
  }).catch(function(err){
    console.error('View profile error:', err);
    if (nameEl) nameEl.textContent = 'Could not load profile';
  });
}

// Read-only display of someone else's interests — no add/remove controls,
// those only make sense on your own profile. "About [Name]" rather than
// "Who I Am" since that first-person framing only reads right when it's
// your own card; hidden entirely if they haven't added any.
function _renderVpInterests(name, interests) {
  var sectionEl = document.getElementById('vp-interests-section');
  var titleEl = document.getElementById('vp-interests-title');
  var listEl = document.getElementById('vp-interests-list');
  if (!sectionEl || !listEl) return;
  if (!interests.length) { sectionEl.style.display = 'none'; return; }
  if (titleEl) titleEl.textContent = 'About ' + ((name || '').split(' ')[0] || name);
  sectionEl.style.display = 'block';
  listEl.innerHTML = interests.map(function(it){
    return '<div style="display:inline-flex;align-items:center;gap:6px;background:var(--indigo-light);border-radius:20px;padding:7px 13px">' +
      '<span style="font-size:15px">' + _escapeHtml(it.emoji || '🏷️') + '</span><span style="font-size:13px;font-weight:600;color:var(--indigo)">' + _escapeHtml(it.label || '') + '</span></div>';
  }).join('');
}

// ── VIEWED PROFILE: photo rotator (mirrors _startPhotoRotation, kept separate
// so it never collides with the signed-in user's own profile rotation state) ──
window._vpPhotoTimer = null;
window._vpPhotoCur = 0;
function _renderVpPhotos(photos) {
  var slidesBox = document.getElementById('vp-photo-slides');
  var dotsBox = document.getElementById('vp-photo-dots');
  if (!slidesBox) return;
  if (window._vpPhotoTimer) { clearInterval(window._vpPhotoTimer); window._vpPhotoTimer = null; }
  if (!photos.length) {
    slidesBox.innerHTML = '<div class="photo-slide slide-1 active"></div>';
    if (dotsBox) dotsBox.innerHTML = '';
    return;
  }
  slidesBox.innerHTML = photos.map(function(url, i){
    return '<div class="photo-slide has-photo' + (i === 0 ? ' active' : '') + '" style="background-image:url(' + url + ')"></div>';
  }).join('');
  if (dotsBox) dotsBox.innerHTML = photos.length > 1
    ? photos.map(function(_, i){ return '<div class="pdot' + (i === 0 ? ' active' : '') + '"></div>'; }).join('')
    : '';
  if (photos.length > 1) {
    window._vpPhotoCur = 0;
    window._vpPhotoTimer = setInterval(function(){
      var sl = document.querySelectorAll('#vp-photo-slides .photo-slide');
      var dt = document.querySelectorAll('#vp-photo-dots .pdot');
      if (sl.length < 2) return;
      sl[window._vpPhotoCur].classList.remove('active'); if (dt[window._vpPhotoCur]) dt[window._vpPhotoCur].classList.remove('active');
      window._vpPhotoCur = (window._vpPhotoCur + 1) % sl.length;
      sl[window._vpPhotoCur].classList.add('active'); if (dt[window._vpPhotoCur]) dt[window._vpPhotoCur].classList.add('active');
    }, 3000);
  }
}

// ── VIEWED PROFILE: social streak / social events / memories, computed the
// same way updateProfileStats() does for your own profile, but read from
// their moments subcollection instead of the local window._moments cache ──
function _computeAndRenderUserStats(uid) {
  if (!window.db) return;
  var viewer = window.currentUser || (window.auth && window.auth.currentUser);
  Promise.all([
    window.db.collection('users').doc(uid).collection('moments').get(),
    viewer
      ? window.db.collection('users').doc(viewer.uid).collection('moments').where('taggedUids', 'array-contains', uid).get()
      : Promise.resolve(null)
  ]).then(function(results){
    var theirSnap = results[0];
    var mySnap = results[1];
    var moments = [];
    theirSnap.forEach(function(doc){ var d = doc.data(); d._id = doc.id; moments.push(d); });
    var social = moments.filter(function(m){ return (m.people || []).length > 0; });
    var streak = computeWeeklyStreak(social);
    var memEl = document.getElementById('vp-stat-memories');
    var evEl = document.getElementById('vp-stat-events');
    var stEl = document.getElementById('vp-stat-streak');
    var stCard = document.getElementById('vp-stat-streak-card');
    if (memEl) memEl.textContent = moments.length;
    if (evEl) evEl.textContent = social.length;
    if (stEl) stEl.textContent = streak;
    if (stCard) stCard.className = 's-card' + (streak > 0 ? ' on' : '');

    // Memories together: their moments that tag the viewer (from the fetch
    // above), plus the viewer's own moments that tag them (queried
    // directly rather than read from the window._moments cache, since that
    // cache is only populated once the viewer has opened their own
    // Memories/Calendar tab this session — querying fresh here means this
    // is correct the first time, regardless of where someone navigated
    // from).
    var theirsWithMe = viewer
      ? moments.filter(function(m){ return (m.taggedUids || []).indexOf(viewer.uid) !== -1; }).map(function(m){ return Object.assign({}, m, { _ownerUid: uid }); })
      : [];
    var mineWithThem = [];
    if (mySnap) {
      window._foreignMomentCache = window._foreignMomentCache || {};
      mySnap.forEach(function(doc){
        var d = doc.data(); d._id = doc.id; d._ownerUid = viewer.uid;
        window._foreignMomentCache[d._id] = d; // so openMemory's _findMoment() can look it up even if window._moments hasn't loaded yet
        mineWithThem.push(d);
      });
    }
    var shared = theirsWithMe.concat(mineWithThem);
    shared.sort(function(a,b){ return (b.date || '').localeCompare(a.date || ''); });
    _renderVpSharedMemories(shared);
  }).catch(function(err){
    console.error('Load user stats error:', err);
    ['vp-stat-streak','vp-stat-events','vp-stat-memories'].forEach(function(id){ var el = document.getElementById(id); if (el) el.textContent = '0'; });
    _renderVpSharedMemories([]);
  });
}

function _renderVpSharedMemoriesLoading() {
  var loadingEl = document.getElementById('vp-memories-loading');
  var listEl = document.getElementById('vp-memories-list');
  var emptyEl = document.getElementById('vp-memories-empty');
  if (loadingEl) loadingEl.style.display = 'block';
  if (listEl) listEl.style.display = 'none';
  if (emptyEl) emptyEl.style.display = 'none';
}

// Renders the "Memories together" gallery — a shared memory can belong to
// either person (m._ownerUid tags which), so each card routes to whichever
// opener actually owns it: openMemory() for the viewer's own, or
// openSharedMemory() (read-mostly) for one the profile owner made.
function _renderVpSharedMemories(memories) {
  var loadingEl = document.getElementById('vp-memories-loading');
  var listEl = document.getElementById('vp-memories-list');
  var emptyEl = document.getElementById('vp-memories-empty');
  if (!listEl) return;
  if (loadingEl) loadingEl.style.display = 'none';
  if (!memories.length) {
    listEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  listEl.style.display = 'grid';
  window._vpSharedMemoriesData = memories;
  listEl.innerHTML = memories.map(function(m, i){
    var emoji = (m.vibe || '✨').trim().split(' ')[0];
    var imgStyle = m.photo
      ? 'background-image:url(' + m.photo + ');background-size:cover;background-position:center'
      : 'background:linear-gradient(135deg,#3D3580 0%,#2A2460 55%,#1A1640 100%)';
    return '<div onclick="_openVpSharedMemory(' + i + ')" style="cursor:pointer;background:var(--card);border-radius:16px;overflow:hidden;border:1px solid var(--rule);box-shadow:0 1px 3px rgba(0,0,0,0.04)">' +
      '<div style="height:88px;' + imgStyle + ';display:flex;align-items:center;justify-content:center;font-size:26px">' + (m.photo ? '' : _escapeHtml(emoji)) + '</div>' +
      '<div style="padding:10px 12px">' +
        '<div style="font-size:13px;font-weight:700;color:var(--black);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(m.name || 'Untitled moment') + '</div>' +
        '<div style="font-size:11px;color:var(--subtle);margin-top:2px">' + _escapeHtml(m.date ? _formatMomentDate(m.date) : '') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// Looked up by index rather than passing IDs through the onclick string —
// a memory's _id/_ownerUid should always be attribute-safe, but this
// removes that class of doubt entirely and gives one place to fix if the
// mine-vs-theirs routing itself is ever wrong.
function _openVpSharedMemory(i) {
  var m = (window._vpSharedMemoriesData || [])[i];
  if (!m) { if (typeof ib_toast === 'function') ib_toast('Could not open that memory'); return; }
  var myUid = (window.currentUser && window.currentUser.uid) || (window.auth && window.auth.currentUser && window.auth.currentUser.uid);
  if (m._ownerUid === myUid) {
    openMemory(m._id, 'view-profile');
  } else {
    openSharedMemory(m._ownerUid, m._id, 'view-profile');
  }
}

function closeViewProfile() {
  if (window._vpPhotoTimer) { clearInterval(window._vpPhotoTimer); window._vpPhotoTimer = null; }
  _navApplyScreen(window._profileReturnTo || 'feed');
}

// ── EVENTS ON A PROFILE — shows Outside Lands under Friends if this person
// has RSVP'd going/maybe, and lets you tap in to see their picks read-only.
// Stashes the data in a plain object keyed by uid rather than embedding it
// in the onclick attribute, so nothing has to be JSON-escaped into HTML.
window._vpEventsData = window._vpEventsData || {};

function _renderVpEvents(uid, name, d) {
  var sectionEl = document.getElementById('vp-events-section');
  var listEl = document.getElementById('vp-events-list');
  if (!sectionEl || !listEl) return;
  var rsvp = d.oslRsvp;
  if (rsvp !== 'going' && rsvp !== 'maybe') { sectionEl.style.display = 'none'; return; }
  window._vpEventsData[uid] = { name: name, actRsvps: d.oslActRsvps || {} };
  sectionEl.style.display = 'block';
  var badge = rsvp === 'going'
    ? '<span style="background:var(--win-bg);color:var(--win);font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;flex-shrink:0">GOING</span>'
    : '<span style="background:#FEF3E2;color:#7A4F10;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;flex-shrink:0">MAYBE</span>';
  listEl.innerHTML = '<div onclick="openTheirFestivalFor(\'' + uid + '\')" style="background:linear-gradient(135deg,#1A0A2E,#3D1A6B);border-radius:16px;padding:14px;display:flex;align-items:center;gap:12px;cursor:pointer">' +
    '<div style="font-size:26px">🎪</div>' +
    '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:white">Outside Lands 2026</div>' +
    '<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:2px">Tap to see their picks →</div></div>' + badge +
  '</div>';
}

function openTheirFestivalFor(uid) {
  var data = window._vpEventsData[uid];
  if (!data) return;
  openTheirFestival(uid, data.name, data.actRsvps);
}

function openTheirFestival(uid, name, actRsvps) {
  window._theirFestivalReturnTo = 'view-profile';
  var titleEl = document.getElementById('their-festival-title');
  if (titleEl) titleEl.textContent = (name || 'Their') + "'s Festival";
  var listEl = document.getElementById('their-festival-list');
  var emptyEl = document.getElementById('their-festival-empty');
  var rsvps = actRsvps || {};
  var going = Object.keys(rsvps).filter(function(k){ return rsvps[k] === 'going'; });
  var maybe = Object.keys(rsvps).filter(function(k){ return rsvps[k] === 'maybe'; });

  if (!going.length && !maybe.length) {
    if (listEl) listEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'flex';
    _navApplyScreen('their-festival');
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (listEl) listEl.style.display = 'flex';

  // Same lookup updateMyFest() builds for your own picks, reused here for theirs.
  var allActs = {};
  Object.keys(stageData).forEach(function(day) {
    Object.keys(stageData[day]).forEach(function(stage) {
      stageData[day][stage].acts.forEach(function(act) {
        allActs[act.name] = { time: act.time, stage: stageData[day][stage].name, day: stageData[day][stage].day, headliner: !!act.headliner };
      });
    });
  });

  var rows = going.map(function(n){ return { name: n, status: 'going' }; }).concat(maybe.map(function(n){ return { name: n, status: 'maybe' }; }));
  loadOslFriendRsvps(function(){
  listEl.innerHTML = rows.map(function(row){
    var info = allActs[row.name] || {};
    var isGoing = row.status === 'going';
    // Box color reflects MY OWN rsvp for this act (same palette as the
    // stage-card buttons), not theirs — a quick "does this overlap with my
    // picks" signal. Falls back to the neutral purple/cream tint when I
    // haven't responded to this particular act myself.
    var myStatus = myRsvps[row.name];
    var boxBg, iconColor, rowBg, rowBorder;
    if (myStatus === 'going') { boxBg = 'rgba(74,222,128,0.92)'; iconColor = '#052E10'; rowBg = 'rgba(74,222,128,0.16)'; rowBorder = 'rgba(74,222,128,0.5)'; }
    else if (myStatus === 'maybe') { boxBg = 'rgba(252,211,77,0.92)'; iconColor = '#332404'; rowBg = 'rgba(252,211,77,0.16)'; rowBorder = 'rgba(252,211,77,0.5)'; }
    else if (myStatus === 'no') { boxBg = 'rgba(248,113,113,0.92)'; iconColor = '#330A0A'; rowBg = 'rgba(248,113,113,0.16)'; rowBorder = 'rgba(248,113,113,0.5)'; }
    else { boxBg = isGoing ? 'rgba(168,159,232,0.2)' : 'rgba(254,213,133,0.15)'; iconColor = isGoing ? 'rgba(168,159,232,0.9)' : 'rgba(254,213,133,0.9)'; rowBg = 'rgba(255,255,255,0.06)'; rowBorder = 'rgba(255,255,255,0.1)'; }
    var icon = isGoing
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + iconColor + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<span style="font-size:15px;font-weight:800;color:' + iconColor + '">?</span>';
    var safeName = row.name.replace(/'/g, "\\'");
    var safeTime = (info.time || '').replace(/'/g, "\\'");
    var clusterHtml = _friendClusterHtml(row.name);
    var rightHtml = clusterHtml || ('<div style="font-size:10px;font-weight:700;color:' + (isGoing ? 'rgba(168,159,232,0.9)' : 'rgba(254,213,133,0.9)') + ';text-transform:uppercase;letter-spacing:0.06em;flex-shrink:0">' + (isGoing ? 'Going' : 'Maybe') + '</div>');
    return '<div onclick="_jumpToActFromTheirFestival(\'' + safeName + '\',\'' + safeTime + '\',' + (info.headliner ? 'true' : 'false') + ')" style="background:' + rowBg + ';border-radius:14px;padding:14px 16px;border:1px solid ' + rowBorder + ';display:flex;align-items:center;gap:12px;cursor:pointer">' +
      '<div style="width:40px;height:40px;border-radius:10px;background:' + boxBg + ';display:flex;align-items:center;justify-content:center;flex-shrink:0">' + icon + '</div>' +
      '<div style="flex:1"><div style="font-size:14px;font-weight:700;color:white">' + _escapeHtml(row.name) + '</div>' +
      '<div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:2px">' + _escapeHtml(info.stage || '') + ' · ' + _escapeHtml(info.time || 'TBD') + '</div></div>' +
      rightHtml +
    '</div>';
  }).join('');
  });

  _navApplyScreen('their-festival');
}

// Same "jump to act" pattern as _jumpToActFromFeed — the difference is
// their-festival is reached from a profile, not from inside the OSL screen,
// so we have to nav there first before the act-detail overlay has anywhere to show
function _jumpToActFromTheirFestival(actName, actTime, isHeadliner) {
  nav('osl-group');
  openActDetail(actName, actTime, isHeadliner);
}

function closeTheirFestival() {
  _navApplyScreen(window._theirFestivalReturnTo || 'view-profile');
}

// Compact badge sitting right next to their name, rather than a whole
// section below the header — green check if you're already friends,
// indigo plus if you're not (one tap sends the request right there), a
// muted "···" if you've already sent one, and a gold check if THEY sent
// you one (tap to accept).
function _renderVpFriendBadge(theirUid) {
  var badgeEl = document.getElementById('vp-friend-badge');
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!badgeEl || !user || !window.db) return;
  badgeEl.style.display = 'none';
  // Reset to the default small circle before applying any state-specific
  // shape override — otherwise an "Accept friend request" pill from a
  // previous render could stick around on a later, different state.
  badgeEl.style.width = '24px';
  badgeEl.style.height = '24px';
  badgeEl.style.borderRadius = '50%';
  badgeEl.style.padding = '0';
  badgeEl.style.fontSize = '12px';
  badgeEl.style.whiteSpace = 'normal';
  Promise.all([
    window.db.collection('friendRequests').where('fromUid','==',user.uid).where('toUid','==',theirUid).get(),
    window.db.collection('friendRequests').where('fromUid','==',theirUid).where('toUid','==',user.uid).get()
  ]).then(function(results){
    var sent = results[0].empty ? null : { id: results[0].docs[0].id, data: results[0].docs[0].data() };
    var received = results[1].empty ? null : { id: results[1].docs[0].id, data: results[1].docs[0].data() };
    badgeEl.style.display = 'flex';
    if ((sent && sent.data.status === 'accepted') || (received && received.data.status === 'accepted')) {
      badgeEl.style.background = 'var(--win)';
      badgeEl.style.cursor = 'default';
      badgeEl.textContent = '✓';
      badgeEl.onclick = null;
      _ensureFriendListed(theirUid);
      _renderMutualFriendsList(theirUid);
    } else if (received && received.data.status === 'pending') {
      // This is the case that used to be an unlabeled yellow checkmark —
      // easy to miss and unclear what tapping it would even do.
      badgeEl.style.background = '#D4A24C';
      badgeEl.style.cursor = 'pointer';
      badgeEl.style.width = 'auto';
      badgeEl.style.height = '28px';
      badgeEl.style.borderRadius = '14px';
      badgeEl.style.padding = '0 12px';
      badgeEl.style.fontSize = '11px';
      badgeEl.style.whiteSpace = 'nowrap';
      badgeEl.textContent = 'Accept friend request';
      badgeEl.onclick = function(){ acceptFriendRequest(received.id); };
    } else if (sent && sent.data.status === 'pending') {
      badgeEl.style.background = 'rgba(255,255,255,0.25)';
      badgeEl.style.cursor = 'pointer';
      badgeEl.textContent = '···';
      badgeEl.onclick = function(){ if (typeof ib_toast==='function') ib_toast('Friend request already sent'); };
    } else {
      badgeEl.style.background = 'var(--indigo)';
      badgeEl.style.cursor = 'pointer';
      badgeEl.textContent = '+';
      badgeEl.onclick = function(){ sendFriendRequest(theirUid); };
    }
  }).catch(function(err){
    console.error('Friend status error:', err);
    badgeEl.style.display = 'none';
  });
}

function sendFriendRequest(theirUid) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  var myName = (window.userData && window.userData.name) || 'Someone';
  window.db.collection('friendRequests').add({ fromUid: user.uid, toUid: theirUid, status: 'pending', ts: Date.now() })
    .then(function(docRef){
      if (typeof ib_toast==='function') ib_toast('Friend request sent');
      _renderVpFriendBadge(theirUid);
      window.db.collection('notifications').add({
        toUid: theirUid,
        type: 'friend_request',
        fromUid: user.uid,
        fromName: myName,
        ts: Date.now(),
        read: false,
        requestId: docRef.id
      }).catch(function(err){ console.error('Friend request notification error:', err); });
    })
    .catch(function(err){ console.error('Send friend request error:', err); if (typeof ib_toast==='function') ib_toast('Could not send request — ' + (err && err.message ? err.message : 'try again')); });
}

function acceptFriendRequest(reqId) {
  if (!window.db) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var myName = (window.userData && window.userData.name) || 'Someone';
  var theirUid = null;
  window.db.collection('friendRequests').doc(reqId).get().then(function(doc){
    theirUid = doc.exists ? doc.data().fromUid : null;
    return window.db.collection('friendRequests').doc(reqId).update({ status: 'accepted' });
  }).then(function(){
    if (typeof ib_toast==='function') ib_toast("You're friends now 🎉");
    if (theirUid) _renderVpFriendBadge(theirUid);
    if (typeof loadMyFriendsList === 'function') loadMyFriendsList();
    if (theirUid && user) {
      window.db.collection('notifications').add({
        toUid: theirUid,
        type: 'friend_accepted',
        fromUid: user.uid,
        fromName: myName,
        ts: Date.now(),
        read: false
      }).catch(function(err){ console.error('Friend accepted notification error:', err); });
    }
  }).catch(function(err){ console.error('Accept friend request error:', err); if (typeof ib_toast==='function') ib_toast('Could not accept — ' + (err && err.message ? err.message : 'try again')); });
}


// ── FRIENDS LIST (visible on a profile only to that person's mutual friends) ──
// Each user keeps their own private/friends doc — this keeps the security rule
// simple (only the owner can write it) at the cost of the list syncing lazily:
// it fills in as each side happens to view the other's profile, not instantly
// on both sides the moment a request is accepted.
function _ensureFriendListed(theirUid) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db || !theirUid) return;
  window.db.collection('users').doc(user.uid).collection('private').doc('friends')
    .set({ uids: firebase.firestore.FieldValue.arrayUnion(theirUid) }, { merge: true })
    .catch(function(err){ console.error('Sync friends list error:', err); });
}

function _renderFriendChips(containerEl, uids, dark) {
  if (!containerEl) return;
  if (!uids.length) { containerEl.innerHTML = ''; return; }
  var loadingColor = dark ? 'rgba(255,255,255,0.4)' : 'var(--subtle)';
  var avBg = dark ? 'rgba(168,159,232,0.16)' : 'var(--indigo-light)';
  var avColor = dark ? '#A89FE8' : 'var(--indigo)';
  var nameColor = dark ? '#ffffff' : 'var(--black)';
  containerEl.innerHTML = '<div style="font-size:12px;color:' + loadingColor + '">Loading…</div>';
  Promise.all(uids.map(function(uid){ return window.db.collection('users').doc(uid).get(); })).then(function(docs){
    containerEl.innerHTML = docs.map(function(doc){
      var d = doc.data() || {};
      var nm = d.name || 'Innings User';
      return '<div onclick="openUserProfile(\'' + doc.id + '\')" style="display:flex;flex-direction:column;align-items:center;gap:6px;width:64px;cursor:pointer">' +
        '<div style="width:48px;height:48px;border-radius:50%;background:' + avBg + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:' + avColor + '">' + _escapeHtml(_initialsFallback(nm)) + '</div>' +
        '<div style="font-size:11px;font-weight:600;color:' + nameColor + ';text-align:center;line-height:1.3">' + _escapeHtml(nm.split(' ')[0]) + '</div>' +
      '</div>';
    }).join('');
  }).catch(function(err){
    console.error('Render friend chips error:', err);
    containerEl.innerHTML = '<div style="font-size:12px;color:' + loadingColor + '">Could not load friends</div>';
  });
}

// Own profile — always visible to yourself.
window._myFriendsStarted = false;
// Your own Friends list — reads friendRequests directly (same source every
// "Add friends" picker in the app already uses), not the private/friends
// cache below. That cache only exists to work around a permission limit for
// *someone else's* mutual-friends display (see _renderMutualFriendsList) —
// for your own list there's no such limit, so there's no reason to risk the
// two ever disagreeing.
function loadMyFriendsList() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var listEl = document.getElementById('my-friends-list');
  var emptyEl = document.getElementById('my-friends-empty');
  if (!user || !window.db || !listEl) return;
  Promise.all([
    window.db.collection('friendRequests').where('fromUid','==',user.uid).where('status','==','accepted').get(),
    window.db.collection('friendRequests').where('toUid','==',user.uid).where('status','==','accepted').get()
  ]).then(function(results){
    var uids = [];
    results[0].forEach(function(d){ uids.push(d.data().toUid); });
    results[1].forEach(function(d){ uids.push(d.data().fromUid); });
    uids = uids.filter(function(v,i){ return uids.indexOf(v) === i; });
    if (emptyEl) emptyEl.style.display = uids.length ? 'none' : 'block';
    window._myFriendUids = uids;
    _renderFriendChips(listEl, uids, true);
  }).catch(function(err){
    console.error('Load my friends error:', err);
  });
}

// Lightweight version of the same friendRequests lookup, but for @mention
// autocomplete rather than the profile screen's friend-chip list: no DOM
// requirement (works from any chat, whether or not the person has ever
// opened their own profile in this session), and caches {uid: name} pairs
// since autocomplete needs to filter and display names, not just render
// chips someone taps individually. Safe to call repeatedly — resolves
// immediately from cache after the first successful load.
window._myFriendProfiles = null;
function _ensureMyFriendsLoaded(callback) {
  if (window._myFriendProfiles) { callback(window._myFriendProfiles); return; }
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { callback({}); return; }
  Promise.all([
    window.db.collection('friendRequests').where('fromUid','==',user.uid).where('status','==','accepted').get(),
    window.db.collection('friendRequests').where('toUid','==',user.uid).where('status','==','accepted').get()
  ]).then(function(results){
    var uids = [];
    results[0].forEach(function(d){ uids.push(d.data().toUid); });
    results[1].forEach(function(d){ uids.push(d.data().fromUid); });
    uids = uids.filter(function(v,i){ return uids.indexOf(v) === i; });
    if (!uids.length) { window._myFriendProfiles = {}; callback({}); return; }
    return Promise.all(uids.map(function(uid){ return window.db.collection('users').doc(uid).get(); })).then(function(docs){
      var profiles = {};
      docs.forEach(function(doc){ if (doc.exists) profiles[doc.id] = (doc.data() && doc.data().name) || 'Innings User'; });
      window._myFriendProfiles = profiles;
      callback(profiles);
    });
  }).catch(function(err){
    console.error('Load friend profiles for mentions error:', err);
    callback({});
  });
}

function openAllFriends() {
  var box = document.getElementById('all-friends-overlay');
  if (box) box.style.display = 'flex';
  _renderFriendChips(document.getElementById('all-friends-grid'), window._myFriendUids || [], true);
}

function closeAllFriends() {
  var box = document.getElementById('all-friends-overlay');
  if (box) box.style.display = 'none';
}

// ── ADD FRIENDS SHEET — invite by link (reuses the existing native-share
// pattern), or find friends already on Innings from the phone's contacts.
// The contacts path uses the Contact Picker API (navigator.contacts.select),
// which lets the person choose specific contacts to share without ever
// exposing their whole address book — but browser support is narrow and
// inconsistent (notably unreliable on iOS Safari), so there's an explicit
// fallback to the invite-link path when it isn't available, rather than a
// silent failure.
window._addFriendsMatches = [];
window._addFriendsSelected = {};
window._addFriendsTotalContacts = 0;

function showAddFriendsSheet() {
  var m = document.getElementById('add-friends-sheet');
  if (m) m.style.display = 'flex';
  showAddFriendsMenuStep();
}
function hideAddFriendsSheet() {
  var m = document.getElementById('add-friends-sheet');
  if (m) m.style.display = 'none';
}

function showAddFriendsMenuStep() {
  var body = document.getElementById('add-friends-sheet-body');
  var footer = document.getElementById('add-friends-sheet-footer');
  if (footer) footer.style.display = 'none';
  if (!body) return;
  body.innerHTML =
    '<div style="font-size:16px;font-weight:700;color:var(--black);margin-bottom:4px">Add friends</div>' +
    '<div style="font-size:13px;color:var(--subtle);margin-bottom:18px;line-height:1.5">Bring people into Innings, or find ones already here.</div>' +
    '<div onclick="addFriendsShareInviteLink()" style="display:flex;align-items:center;gap:14px;padding:16px;border-radius:16px;background:var(--bg);border:1px solid var(--rule);cursor:pointer;margin-bottom:10px">' +
      '<div style="width:44px;height:44px;border-radius:12px;background:var(--indigo-light);display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0">🔗</div>' +
      '<div style="flex:1"><div style="font-size:14.5px;font-weight:700;color:var(--black)">Invite by link</div><div style="font-size:12.5px;color:var(--subtle);margin-top:2px;line-height:1.4">Share a link — they show up here once they join</div></div>' +
    '</div>' +
    '<div onclick="showAddFriendsPrimingStep()" style="display:flex;align-items:center;gap:14px;padding:16px;border-radius:16px;background:var(--bg);border:1px solid var(--rule);cursor:pointer">' +
      '<div style="width:44px;height:44px;border-radius:12px;background:var(--indigo-light);display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0">📇</div>' +
      '<div style="flex:1"><div style="font-size:14.5px;font-weight:700;color:var(--black)">Find from contacts</div><div style="font-size:12.5px;color:var(--subtle);margin-top:2px;line-height:1.4">See which of your contacts already use Innings</div></div>' +
    '</div>';
}

function addFriendsShareInviteLink() {
  hideAddFriendsSheet();
  if (typeof sendInviteText === 'function') sendInviteText();
}

// A short explanation before the OS permission prompt — better opt-in than
// surprising someone with a system dialog cold, and sets the expectation
// that they choose which contacts to share, not their whole address book.
function showAddFriendsPrimingStep() {
  var body = document.getElementById('add-friends-sheet-body');
  var footer = document.getElementById('add-friends-sheet-footer');
  if (!body) return;
  body.innerHTML =
    '<div style="width:64px;height:64px;border-radius:20px;background:var(--indigo-light);display:flex;align-items:center;justify-content:center;font-size:28px;margin:4px auto 16px">📇</div>' +
    '<div style="font-size:17px;font-weight:800;color:var(--black);text-align:center;letter-spacing:-0.3px">Find friends from your contacts</div>' +
    '<div style="font-size:13.5px;color:var(--mid);text-align:center;line-height:1.6;margin-top:10px;padding:0 8px">Your phone will ask which contacts to share. Innings only checks their phone numbers against people already using the app — nothing else is read, sent, or stored.</div>' +
    '<div style="display:flex;align-items:flex-start;gap:8px;background:var(--bg);border-radius:14px;padding:12px 14px;margin-top:16px">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8E8EA8" stroke-width="1.8" style="flex-shrink:0;margin-top:1px"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' +
      '<div style="font-size:12px;color:var(--subtle);line-height:1.5">You pick which contacts to share — Innings never sees your full address book.</div>' +
    '</div>';
  if (footer) {
    footer.style.display = 'block';
    footer.innerHTML = '<button onclick="addFriendsRequestContacts()" style="width:100%;background:var(--indigo);color:white;border:none;border-radius:16px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">Allow Access</button>' +
      '<div onclick="showAddFriendsMenuStep()" style="text-align:center;font-size:13px;font-weight:600;color:var(--subtle);margin-top:12px;cursor:pointer">Not now</div>';
  }
}

function showAddFriendsLoadingStep() {
  var body = document.getElementById('add-friends-sheet-body');
  var footer = document.getElementById('add-friends-sheet-footer');
  if (footer) footer.style.display = 'none';
  if (body) body.innerHTML =
    '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px">' +
      '<div style="width:36px;height:36px;border-radius:50%;border:3px solid var(--indigo-light);border-top-color:var(--indigo);animation:add-friends-spin 0.8s linear infinite;margin-bottom:16px"></div>' +
      '<div style="font-size:14px;font-weight:600;color:var(--mid)">Checking your contacts…</div>' +
    '</div>';
}

function addFriendsRequestContacts() {
  if (!navigator.contacts || typeof navigator.contacts.select !== 'function') {
    var body = document.getElementById('add-friends-sheet-body');
    var footer = document.getElementById('add-friends-sheet-footer');
    if (footer) footer.style.display = 'none';
    if (body) body.innerHTML =
      '<div style="text-align:center;padding:20px 8px">' +
        '<div style="font-size:32px;margin-bottom:10px">🚫</div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--black)">Not available on this browser</div>' +
        '<div style="font-size:13px;color:var(--subtle);margin-top:6px;line-height:1.5">This device can\'t share contacts directly. Invite people by link instead — they\'ll show up here once they join.</div>' +
      '</div>' +
      '<button onclick="addFriendsShareInviteLink()" style="width:100%;background:var(--indigo);color:white;border:none;border-radius:16px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:16px">Invite by link</button>';
    return;
  }
  showAddFriendsLoadingStep();
  navigator.contacts.select(['name', 'tel'], { multiple: true }).then(function(contacts){
    if (!contacts || !contacts.length) { showAddFriendsMenuStep(); return; }
    _matchContactsAgainstUsers(contacts);
  }).catch(function(err){
    console.error('Contact picker error:', err);
    showAddFriendsMenuStep();
  });
}

// Normalizes any raw contact phone string to the +1XXXXXXXXXX (E.164, US)
// format phone auth stores in Firestore — matches the same "prepend +1,
// use the last 10 digits" assumption the onboarding flow already makes.
function _normalizePhoneToE164(raw) {
  var digits = (raw || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return '+1' + digits.slice(-10);
}

function _matchContactsAgainstUsers(contacts) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { showAddFriendsResultsStep([], contacts.length); return; }

  var candidateMap = {}; // e164 -> contact display name, first one wins on duplicates
  contacts.forEach(function(c){
    (c.tel || []).forEach(function(t){
      var e164 = _normalizePhoneToE164(t);
      if (e164 && !candidateMap[e164]) candidateMap[e164] = (c.name && c.name[0]) || 'Contact';
    });
  });
  var candidates = Object.keys(candidateMap);
  if (!candidates.length) { showAddFriendsResultsStep([], contacts.length); return; }

  // Firestore's 'in' operator caps at 10 values per query — chunk and merge
  var chunks = [];
  for (var i = 0; i < candidates.length; i += 10) chunks.push(candidates.slice(i, i + 10));

  Promise.all(chunks.map(function(chunk){
    return window.db.collection('users').where('phone', 'in', chunk).get();
  })).then(function(snaps){
    var matchedUsers = [];
    snaps.forEach(function(snap){
      snap.forEach(function(doc){
        if (doc.id === user.uid) return; // never match yourself
        var d = doc.data() || {};
        matchedUsers.push({ uid: doc.id, name: d.name || candidateMap[d.phone] || 'Innings user' });
      });
    });
    if (!matchedUsers.length) { showAddFriendsResultsStep([], contacts.length); return; }

    // Cross-reference existing relationships so already-friends or
    // already-pending contacts show their real status instead of a
    // duplicate "add" checkbox that would just create a second request.
    Promise.all([
      window.db.collection('friendRequests').where('fromUid','==',user.uid).get(),
      window.db.collection('friendRequests').where('toUid','==',user.uid).get()
    ]).then(function(relResults){
      var relMap = {};
      relResults[0].forEach(function(d){ var data = d.data(); relMap[data.toUid] = data.status === 'accepted' ? 'already' : 'pending'; });
      relResults[1].forEach(function(d){ var data = d.data(); relMap[data.fromUid] = data.status === 'accepted' ? 'already' : 'pending'; });
      matchedUsers.forEach(function(m){ m.status = relMap[m.uid] || 'new'; });
      showAddFriendsResultsStep(matchedUsers, contacts.length);
    }).catch(function(err){
      console.error('Load friend relationships error:', err);
      matchedUsers.forEach(function(m){ m.status = 'new'; });
      showAddFriendsResultsStep(matchedUsers, contacts.length);
    });
  }).catch(function(err){
    console.error('Match contacts error:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not check contacts — try again');
    showAddFriendsMenuStep();
  });
}

function showAddFriendsResultsStep(matches, totalContacts) {
  window._addFriendsMatches = matches;
  window._addFriendsTotalContacts = totalContacts;
  window._addFriendsSelected = {};
  matches.forEach(function(m, i){ if (m.status === 'new') window._addFriendsSelected[i] = true; });
  renderAddFriendsResults();
}

function renderAddFriendsResults() {
  var matches = window._addFriendsMatches || [];
  var totalContacts = window._addFriendsTotalContacts || 0;
  var body = document.getElementById('add-friends-sheet-body');
  var footer = document.getElementById('add-friends-sheet-footer');
  if (!body) return;

  if (!matches.length) {
    if (footer) footer.style.display = 'none';
    body.innerHTML = '<div style="font-size:16px;font-weight:700;color:var(--black);margin-bottom:8px">Add from contacts</div>' +
      '<div style="text-align:center;padding:20px 8px">' +
        '<div style="font-size:32px;margin-bottom:10px">📭</div>' +
        '<div style="font-size:14px;font-weight:700;color:var(--black)">No matches yet</div>' +
        '<div style="font-size:13px;color:var(--subtle);margin-top:6px;line-height:1.5">None of the contacts you shared are on Innings yet.</div>' +
      '</div>' +
      '<button onclick="addFriendsShareInviteLink()" style="width:100%;background:var(--indigo);color:white;border:none;border-radius:16px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:6px">Invite by link instead</button>';
    return;
  }

  function statusLabel(s) { return s === 'already' ? 'Already friends' : s === 'pending' ? 'Request pending' : 'On Innings'; }

  var newCount = matches.filter(function(m){ return m.status === 'new'; }).length;
  var unmatchedCount = Math.max(0, totalContacts - matches.length);
  var allSel = matches.every(function(m, i){ return m.status !== 'new' || window._addFriendsSelected[i]; });

  var rowsHtml = matches.map(function(m, i){
    var locked = m.status !== 'new';
    var checked = !!window._addFriendsSelected[i];
    return '<div style="display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid var(--rule);' + (locked ? 'opacity:0.55' : '') + '">' +
      '<div style="width:42px;height:42px;border-radius:50%;background:var(--indigo-light);color:var(--indigo);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0">' + _escapeHtml(_initialsFallback(m.name)) + '</div>' +
      '<div style="flex:1"><div style="font-size:14.5px;font-weight:600;color:var(--black)">' + _escapeHtml(m.name) + '</div><div style="font-size:11.5px;color:var(--subtle);margin-top:1px">' + statusLabel(m.status) + '</div></div>' +
      (locked
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8E8EA8" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>'
        : '<div onclick="toggleAddFriendMatch(' + i + ')" style="width:24px;height:24px;border-radius:50%;border:2px solid ' + (checked ? 'var(--indigo)' : 'var(--rule)') + ';background:' + (checked ? 'var(--indigo)' : 'transparent') + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer">' + (checked ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '') + '</div>') +
    '</div>';
  }).join('');

  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<div><div style="font-size:16px;font-weight:700;color:var(--black)">Add from contacts</div>' +
      '<div style="font-size:13px;color:var(--mid);margin-top:2px">' + newCount + ' of ' + totalContacts + ' contacts already use Innings</div></div>' +
      (matches.some(function(m){ return m.status === 'new'; }) ? '<div onclick="toggleAddFriendsSelectAll()" style="font-size:12px;font-weight:700;color:var(--indigo);cursor:pointer;flex-shrink:0">' + (allSel ? 'Deselect all' : 'Select all') + '</div>' : '') +
    '</div>' +
    rowsHtml +
    (unmatchedCount > 0 ? '<div style="background:var(--bg);border-radius:14px;padding:12px 14px;margin-top:14px;font-size:12.5px;color:var(--subtle);line-height:1.6">' + unmatchedCount + ' other contact' + (unmatchedCount === 1 ? '' : 's') + " aren't on Innings yet — <b onclick=\"addFriendsShareInviteLink()\" style=\"color:var(--indigo);cursor:pointer;font-weight:700\">invite them by link instead</b>.</div>" : '');

  var selCount = Object.keys(window._addFriendsSelected).filter(function(k){ return window._addFriendsSelected[k]; }).length;
  if (footer) {
    footer.style.display = 'block';
    footer.innerHTML = '<button onclick="sendAddFriendsRequests()" style="width:100%;background:var(--indigo);color:white;border:none;border-radius:16px;padding:15px;font-size:15px;font-weight:700;font-family:inherit' + (selCount === 0 ? ';opacity:0.5" disabled' : ';cursor:pointer"') + '>Send friend requests (' + selCount + ')</button>';
  }
}

function toggleAddFriendMatch(i) {
  window._addFriendsSelected[i] = !window._addFriendsSelected[i];
  renderAddFriendsResults();
}
function toggleAddFriendsSelectAll() {
  var matches = window._addFriendsMatches || [];
  var allSel = matches.every(function(m, i){ return m.status !== 'new' || window._addFriendsSelected[i]; });
  matches.forEach(function(m, i){ if (m.status === 'new') window._addFriendsSelected[i] = !allSel; });
  renderAddFriendsResults();
}

// Sends requests in bulk with one summary toast at the end, rather than
// looping sendFriendRequest() (built for a single profile's + button) and
// firing a separate "Friend request sent" toast per contact.
function sendAddFriendsRequests() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  var matches = window._addFriendsMatches || [];
  var toSend = matches.filter(function(m, i){ return m.status === 'new' && window._addFriendsSelected[i]; });
  if (!toSend.length) return;
  var myName = (window.userData && window.userData.name) || 'Someone';
  Promise.all(toSend.map(function(m){
    return window.db.collection('friendRequests').add({ fromUid: user.uid, toUid: m.uid, status: 'pending', ts: Date.now() })
      .then(function(docRef){
        return window.db.collection('notifications').add({
          toUid: m.uid, type: 'friend_request', fromUid: user.uid, fromName: myName, ts: Date.now(), read: false, requestId: docRef.id
        });
      });
  })).then(function(){
    hideAddFriendsSheet();
    if (typeof ib_toast === 'function') ib_toast('Sent ' + toSend.length + ' friend request' + (toSend.length === 1 ? '' : 's'));
  }).catch(function(err){
    console.error('Send bulk friend requests error:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not send all requests — try again');
  });
}

// Someone else's profile — only renders if the read succeeds, which the
// Firestore rules only allow when the viewer is already listed as a friend.
function _renderMutualFriendsList(theirUid) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var sectionEl = document.getElementById('vp-friends-section');
  var listEl = document.getElementById('vp-friends-list');
  if (!user || !window.db || !sectionEl || !listEl) return;
  window.db.collection('users').doc(theirUid).collection('private').doc('friends').get().then(function(doc){
    var uids = ((doc.exists && doc.data().uids) || []).filter(function(u){ return u !== user.uid; });
    if (!uids.length) { sectionEl.style.display = 'none'; return; }
    sectionEl.style.display = 'block';
    _renderFriendChips(listEl, uids);
  }).catch(function(err){
    // Permission denied here just means we're not (yet) mutual — keep it hidden, no error shown.
    sectionEl.style.display = 'none';
  });
}
