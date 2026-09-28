// ── HERO ZOOM TRANSITION ──
// Grows the tapped card's photo (or theme gradient) to fill the screen,
// then swaps in the future-plan detail screen underneath and fades the
// overlay away — a quick "it's growing to meet you" flourish instead of
// the flat screen-swap every other nav() does. Falls back to a plain
// openFutureDetail() if anything about the source element or app shell
// isn't available (e.g. called without a real element, or on a browser
// without requestAnimationFrame).
function _heroZoomToFuture(cardEl, momentId) {
  var m = _findFutureMoment(momentId);
  if (!m || !cardEl) { openFutureDetail(momentId); return; }
  var appEl = document.querySelector('.app');
  if (!appEl || !window.requestAnimationFrame) { openFutureDetail(momentId); return; }

  var srcRect = cardEl.getBoundingClientRect();
  var appRect = appEl.getBoundingClientRect();
  var bgStyle = m.coverPhoto
    ? 'background-image:linear-gradient(180deg,rgba(0,0,0,0.15),rgba(0,0,0,0.6)),url(' + m.coverPhoto + ');background-size:cover;background-position:center'
    : 'background:' + (m.theme || 'linear-gradient(135deg,#FF6B6B 0%,#FFA94D 45%,#845EF7 100%)');

  var clone = document.createElement('div');
  clone.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;overflow:hidden;' +
    'top:' + srcRect.top + 'px;left:' + srcRect.left + 'px;width:' + srcRect.width + 'px;height:' + srcRect.height + 'px;' +
    'border-radius:20px;box-shadow:0 16px 44px rgba(0,0,0,0.35);' +
    'transition:top 0.28s cubic-bezier(.3,0,.2,1),left 0.28s cubic-bezier(.3,0,.2,1),width 0.28s cubic-bezier(.3,0,.2,1),height 0.28s cubic-bezier(.3,0,.2,1),border-radius 0.28s ease;' +
    bgStyle;
  document.body.appendChild(clone);
  void clone.offsetHeight; // force reflow so the transition below actually animates

  requestAnimationFrame(function(){
    clone.style.top = appRect.top + 'px';
    clone.style.left = appRect.left + 'px';
    clone.style.width = appRect.width + 'px';
    clone.style.height = appRect.height + 'px';
    clone.style.borderRadius = '0px';
  });

  setTimeout(function(){
    openFutureDetail(momentId);
    clone.style.transition = 'opacity 0.2s ease';
    clone.style.opacity = '0';
    setTimeout(function(){ clone.remove(); }, 220);
  }, 280);
}

// A plan belongs to whoever posted it. Everyone else on it can RSVP and
// chat, but the edit form (and the Delete inside it) is the owner's.
function _futureIsMine(m) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  return !!(user && m && m.ownerUid === user.uid);
}
function _futureOwnerFirstName(m) {
  return String((m && m.ownerName) || 'the person who posted this').split(' ')[0];
}

function openFutureDetail(momentId) {
  var m = _findFutureMoment(momentId);
  if (!m) return;
  window._openFutureId = momentId;
  window._futureDetailMode = 'view';
  _showFutureHeader('view');
  renderFutureView(m);
  nav('future-detail');
}

function _showFutureHeader(mode) {
  var v = document.getElementById('fd-header-view');
  var e = document.getElementById('fd-header-edit');
  var c = document.getElementById('fd-composer');
  if (v) v.style.display = mode === 'view' ? 'flex' : 'none';
  if (e) e.style.display = mode === 'edit' ? 'flex' : 'none';
  if (c) c.style.display = mode === 'view' ? 'flex' : 'none';
  // Edit used to show on every plan, including ones posted by someone
  // else — which is how a guest reached an edit form whose Save and
  // Delete the Firestore rules were always going to refuse.
  var editBtn = document.getElementById('fd-edit-btn');
  if (editBtn) editBtn.style.display = _futureIsMine((window._futureMomentsCache || {})[window._openFutureId]) ? 'block' : 'none';
}

function enterFutureEdit() {
  var m = (window._futureMomentsCache || {})[window._openFutureId];
  if (!m) return;
  if (!_futureIsMine(m)) {
    if (typeof ib_toast === 'function') ib_toast('Only ' + _futureOwnerFirstName(m) + ' can change this plan');
    return;
  }
  window._futureDetailMode = 'edit';
  _showFutureHeader('edit');
  renderFutureEdit(m);
}

function exitFutureEdit() {
  var m = (window._futureMomentsCache || {})[window._openFutureId];
  if (!m) return;
  window._futureDetailMode = 'view';
  _showFutureHeader('view');
  renderFutureView(m);
}

// Default landing view for a plan: hero + RSVP (or guest summary if you're
// the owner) + a group chat scoped to this plan, so tapping into a plan
// coordinates with people instead of dropping straight into an edit form.
function renderFutureView(m) {
  var box = document.getElementById('fd-scroll');
  if (!box) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var isOwner = !!(user && m.ownerUid === user.uid);
  var myRsvp = user ? ((m.rsvps || {})[user.uid] || '') : '';
  // Stops replace the plain single-location card entirely, and pull the
  // whole rest of the screen into the same OSL-dark look their tabs and
  // stage already use — the alternative (a dark stops block sitting in an
  // otherwise light screen) read as broken rather than intentional.
  var hasStops = !!(m.stops && m.stops.length);
  box.style.background = hasStops ? '#0D0820' : '';

  var rsvpSection = isOwner
    ? '<div id="fd-guest-summary"></div>'
    : '<div style="display:flex;gap:8px">' +
        '<button onclick="futureDetailRsvp(\'' + m._id + '\',\'going\')" style="flex:1;padding:11px 4px;border-radius:12px;background:' + (myRsvp==='going'?'var(--indigo)':(hasStops?'rgba(255,255,255,0.07)':'var(--bg)')) + ';color:' + (myRsvp==='going'?'#fff':(hasStops?'rgba(255,255,255,0.6)':'var(--mid)')) + ';border:0.5px solid ' + (hasStops?'rgba(255,255,255,0.12)':'var(--rule)') + ';font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Going</button>' +
        '<button onclick="futureDetailRsvp(\'' + m._id + '\',\'maybe\')" style="flex:1;padding:11px 4px;border-radius:12px;background:' + (myRsvp==='maybe'?'var(--indigo)':(hasStops?'rgba(255,255,255,0.07)':'var(--bg)')) + ';color:' + (myRsvp==='maybe'?'#fff':(hasStops?'rgba(255,255,255,0.6)':'var(--mid)')) + ';border:0.5px solid ' + (hasStops?'rgba(255,255,255,0.12)':'var(--rule)') + ';font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Maybe</button>' +
        '<button onclick="futureDetailRsvp(\'' + m._id + '\',\'no\')" style="flex:1;padding:11px 4px;border-radius:12px;background:' + (myRsvp==='no'?'var(--indigo)':(hasStops?'rgba(255,255,255,0.07)':'var(--bg)')) + ';color:' + (myRsvp==='no'?'#fff':(hasStops?'rgba(255,255,255,0.6)':'var(--mid)')) + ';border:0.5px solid ' + (hasStops?'rgba(255,255,255,0.12)':'var(--rule)') + ';font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Can\'t go</button>' +
      '</div>';

  var ticketSection = m.ticketLink
    ? '<div style="background:' + (hasStops?'transparent':'var(--card)') + ';padding:14px 20px;border-bottom:0.5px solid ' + (hasStops?'rgba(255,255,255,0.1)':'var(--rule)') + '">' +
        '<a href="' + _escapeHtml(m.ticketLink) + '" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;background:var(--indigo);color:white;border-radius:14px;padding:13px;font-size:14px;font-weight:700;text-decoration:none;font-family:inherit">🎟️ Get Tickets</a>' +
      '</div>'
    : '';

  // No fake map here — past experience is it never actually renders a real
  // map with a pin, just a static placeholder, so it's just the address
  // and three deep links straight to Google Maps, Apple Maps, and Waze.
  var locationSection = (!hasStops && m.location)
    ? '<div style="background:var(--card);padding:14px 20px;border-bottom:0.5px solid var(--rule)">' +
        '<div id="fv-location-preview" style="border-radius:14px;border:0.5px solid var(--rule);padding:12px 14px;background:var(--bg)">' +
          '<div id="fv-location-preview-text" style="font-size:13px;font-weight:600;color:var(--black);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:10px"></div>' +
          '<div style="display:flex;gap:8px">' +
            '<a id="fv-location-google" target="_blank" rel="noopener" style="flex:1;text-align:center;background:var(--card);border:0.5px solid var(--rule);border-radius:10px;padding:8px 4px;font-size:11.5px;font-weight:700;color:var(--indigo);text-decoration:none">Google Maps</a>' +
            '<a id="fv-location-apple" target="_blank" rel="noopener" style="flex:1;text-align:center;background:var(--card);border:0.5px solid var(--rule);border-radius:10px;padding:8px 4px;font-size:11.5px;font-weight:700;color:var(--indigo);text-decoration:none">Apple Maps</a>' +
            '<a id="fv-location-waze" target="_blank" rel="noopener" style="flex:1;text-align:center;background:var(--card);border:0.5px solid var(--rule);border-radius:10px;padding:8px 4px;font-size:11.5px;font-weight:700;color:var(--indigo);text-decoration:none">Waze</a>' +
          '</div>' +
        '</div>' +
      '</div>'
    : '';

  var stopsSection = hasStops ? _renderFutureStopsHtml(m) : '';
  var emptyChatTextColor = hasStops ? 'rgba(255,255,255,0.9)' : 'var(--black)';
  var emptyChatSubColor = hasStops ? 'rgba(255,255,255,0.4)' : 'var(--subtle)';

  box.innerHTML =
    '<div style="' + _futureBgStyle(m) + ';padding:26px 20px">' +
      '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.8);text-transform:uppercase;letter-spacing:0.08em">' + _escapeHtml(m.vibe || '') + (m.public ? '  ·  🌎 Public' : '') + '</div>' +
      '<div style="font-size:24px;font-weight:800;color:white;letter-spacing:-0.5px;margin-top:4px">' + _escapeHtml(m.title || 'Untitled plan') + '</div>' +
      '<div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:6px">' + _escapeHtml(m.date ? _formatMomentDate(m.date) : '') + (m.time ? ' · ' + m.time : '') + (hasStops ? (' · ' + m.stops.length + ' stop' + (m.stops.length === 1 ? '' : 's')) : (m.location ? ' · ' + _escapeHtml(m.location) : '')) + '</div>' +
    '</div>' +
    stopsSection +
    locationSection +
    ticketSection +
    '<div style="background:' + (hasStops?'transparent':'var(--card)') + ';padding:16px 20px;border-bottom:0.5px solid ' + (hasStops?'rgba(255,255,255,0.1)':'var(--rule)') + '">' + rsvpSection + '</div>' +
    '<div id="future-polls-list" style="padding:14px 16px 0;display:flex;flex-direction:column;gap:10px"></div>' +
    '<div id="future-chat-msgs" style="padding:14px 16px;display:flex;flex-direction:column;gap:10px"></div>' +
    '<div id="future-chat-empty" style="display:none;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding:32px 24px">' +
      '<div style="font-size:30px">💬</div>' +
      '<div style="font-size:14px;font-weight:700;color:' + emptyChatTextColor + '">No messages yet</div>' +
      '<div style="font-size:12px;color:' + emptyChatSubColor + ';max-width:220px;line-height:1.5">Coordinate with everyone here.</div>' +
    '</div>';

  if (hasStops) selectFutureViewStop(m._id, 0);
  if (!hasStops && m.location) _updateLocationLinks('fv', m.location);
  if (isOwner) _renderFutureGuestSummary(m, hasStops);
  startFuturePolls(m._id);
  startFutureMomentChat(m._id);
}

// Tab bar + animated stage + (fixed, no-fake-map) location card for a
// plan's stops. Builds every stop's stage/layer markup up front, all but
// the active one hidden, so switching tabs is a plain display toggle in
// selectFutureViewStop rather than a re-render — keeps it snappy and
// means the animations don't restart on every tap.
function _renderFutureStopsHtml(m) {
  var stops = m.stops || [];
  if (!stops.length) return '';
  var tabsHtml = stops.map(function(s, i){
    return '<div class="future-stop-tab" onclick="selectFutureViewStop(\'' + m._id + '\',' + i + ')" style="flex:1;text-align:center;font-size:12px;font-weight:600;padding:12px 4px;color:rgba(255,255,255,0.5);border-bottom:2px solid transparent;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml((s.emoji ? s.emoji + ' ' : '') + (s.name || 'Stop ' + (i + 1))) + '</div>';
  }).join('');
  return '<div style="background:#0D0820">' +
    '<div style="display:flex;padding:0 8px;border-bottom:0.5px solid rgba(255,255,255,0.08)">' + tabsHtml + '</div>' +
    '<div style="padding:16px">' +
      '<div id="future-stage" style="position:relative;height:168px;border-radius:20px;overflow:hidden;background:linear-gradient(160deg,#1A0A2E 0%,#0D0820 60%,#150A30 100%);margin-bottom:14px">' +
        '<div id="future-stage-layer-twinkle" style="display:none;position:absolute;inset:0">' +
          '<span class="stop-twinkle-dot" style="width:4px;height:4px;left:12%;top:20%"></span>' +
          '<span class="stop-twinkle-dot" style="width:4px;height:4px;left:78%;top:14%;animation-delay:.9s"></span>' +
          '<span class="stop-twinkle-dot" style="width:4px;height:4px;left:32%;top:10%;animation-delay:1.6s"></span>' +
          '<span class="stop-twinkle-dot" style="width:4px;height:4px;left:60%;top:28%;animation-delay:.4s"></span>' +
          '<span class="stop-twinkle-dot" style="width:4px;height:4px;left:88%;top:32%;animation-delay:2.1s"></span>' +
          '<span class="stop-twinkle-dot" style="width:4px;height:4px;left:6%;top:34%;animation-delay:1.2s"></span>' +
        '</div>' +
        '<div id="future-stage-layer-confetti" style="display:none;position:absolute;inset:0;overflow:hidden">' +
          '<span class="stop-confetti-piece" style="left:8%;width:7px;height:11px;background:#F87171"></span>' +
          '<span class="stop-confetti-piece" style="left:24%;width:7px;height:11px;background:#FBBF24;animation-delay:.6s"></span>' +
          '<span class="stop-confetti-piece" style="left:40%;width:7px;height:11px;background:#4ADE80;animation-delay:1.2s"></span>' +
          '<span class="stop-confetti-piece" style="left:56%;width:7px;height:11px;background:#60A5FA;animation-delay:1.8s"></span>' +
          '<span class="stop-confetti-piece" style="left:72%;width:7px;height:11px;background:#F472B6;animation-delay:.3s"></span>' +
          '<span class="stop-confetti-piece" style="left:88%;width:7px;height:11px;background:#A78BFA;animation-delay:2.4s"></span>' +
        '</div>' +
        '<div id="future-stage-layer-glow" style="display:none;position:absolute;inset:0">' +
          '<span class="stop-glow-orb" style="width:140px;height:140px;left:15%;top:5%"></span>' +
          '<span class="stop-glow-orb" style="width:90px;height:90px;left:60%;top:25%;animation-delay:1.2s"></span>' +
        '</div>' +
        '<div id="future-stage-layer-gradient" style="display:none;position:absolute;inset:0">' +
          '<div class="stop-anim-gradient-fill"></div>' +
        '</div>' +
        '<div style="position:absolute;left:16px;bottom:14px;right:16px">' +
          '<div id="future-stage-name" style="font-size:17px;font-weight:800;color:#fff"></div>' +
          '<div id="future-stage-time" style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:2px"></div>' +
        '</div>' +
      '</div>' +
      '<div id="future-stop-loc" style="display:none;border-radius:14px;border:0.5px solid rgba(255,255,255,0.12);padding:12px 14px;background:rgba(255,255,255,0.04)">' +
        '<div id="future-stop-loc-text" style="font-size:12.5px;font-weight:600;color:#fff;margin-bottom:10px"></div>' +
        '<div style="display:flex;gap:8px">' +
          '<a id="future-stop-loc-google" target="_blank" rel="noopener" style="flex:1;text-align:center;background:rgba(255,255,255,0.08);border:0.5px solid rgba(255,255,255,0.14);border-radius:10px;padding:7px 4px;font-size:10.5px;font-weight:700;color:rgba(168,159,232,0.95);text-decoration:none">Google Maps</a>' +
          '<a id="future-stop-loc-apple" target="_blank" rel="noopener" style="flex:1;text-align:center;background:rgba(255,255,255,0.08);border:0.5px solid rgba(255,255,255,0.14);border-radius:10px;padding:7px 4px;font-size:10.5px;font-weight:700;color:rgba(168,159,232,0.95);text-decoration:none">Apple Maps</a>' +
          '<a id="future-stop-loc-waze" target="_blank" rel="noopener" style="flex:1;text-align:center;background:rgba(255,255,255,0.08);border:0.5px solid rgba(255,255,255,0.14);border-radius:10px;padding:7px 4px;font-size:10.5px;font-weight:700;color:rgba(168,159,232,0.95);text-decoration:none">Waze</a>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function selectFutureViewStop(momentId, idx) {
  var m = (window._futureMomentsCache || {})[momentId];
  if (!m || !m.stops || !m.stops[idx]) return;
  var s = m.stops[idx];
  document.querySelectorAll('.future-stop-tab').forEach(function(t, i){
    var active = i === idx;
    t.style.color = active ? 'rgba(168,159,232,1)' : 'rgba(255,255,255,0.5)';
    t.style.fontWeight = active ? '700' : '600';
    t.style.borderBottomColor = active ? 'rgba(168,159,232,0.9)' : 'transparent';
  });
  var stageEl = document.getElementById('future-stage');
  if (stageEl) {
    if (s.coverPhoto) {
      stageEl.style.backgroundImage = 'linear-gradient(180deg,rgba(10,8,20,0.2),rgba(10,8,20,0.7)),url(' + s.coverPhoto + ')';
      stageEl.style.backgroundSize = 'cover';
      stageEl.style.backgroundPosition = 'center';
    } else {
      stageEl.style.backgroundImage = '';
    }
  }
  ['twinkle','confetti','glow','gradient'].forEach(function(a){
    var el = document.getElementById('future-stage-layer-' + a);
    if (el) el.style.display = (a === s.anim) ? 'block' : 'none';
  });
  var nameEl = document.getElementById('future-stage-name');
  var timeEl = document.getElementById('future-stage-time');
  if (nameEl) nameEl.textContent = (s.emoji ? s.emoji + ' ' : '') + (s.name || 'Untitled stop');
  if (timeEl) timeEl.textContent = s.time || '';
  var locWrap = document.getElementById('future-stop-loc');
  if (locWrap) {
    if (s.location) {
      locWrap.style.display = 'block';
      var textEl = document.getElementById('future-stop-loc-text');
      var gEl = document.getElementById('future-stop-loc-google');
      var aEl = document.getElementById('future-stop-loc-apple');
      var wEl = document.getElementById('future-stop-loc-waze');
      if (textEl) textEl.textContent = s.location;
      var encoded = encodeURIComponent(s.location);
      if (gEl) gEl.href = 'https://www.google.com/maps/search/?api=1&query=' + encoded;
      if (aEl) aEl.href = 'https://maps.apple.com/?q=' + encoded;
      if (wEl) wEl.href = 'https://waze.com/ul?q=' + encoded + '&navigate=yes';
    } else {
      locWrap.style.display = 'none';
    }
  }
}

function futureDetailRsvp(momentId, val) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  var m = (window._futureMomentsCache || {})[momentId];
  if (m) { m.rsvps = m.rsvps || {}; m.rsvps[user.uid] = val; renderFutureView(m); }
  var update = {};
  update['rsvps.' + user.uid] = val;
  window.db.collection('futureMoments').doc(momentId).update(update)
    .then(function(){
      if (typeof loadFutureMoments === 'function') loadFutureMoments();
      if (typeof loadFeedMoments === 'function') loadFeedMoments();
    })
    .catch(function(err){ console.error('Future RSVP error:', err); if (typeof ib_toast === 'function') ib_toast('Could not RSVP — try again'); });
}

function _renderFutureGuestSummary(m, dark) {
  var box = document.getElementById('fd-guest-summary');
  if (!box || !window.db) return;
  var uids = m.taggedUids || [];
  var goingCount = Object.keys(m.rsvps || {}).filter(function(k){ return m.rsvps[k] === 'going'; }).length;
  var headerColor = dark ? 'rgba(255,255,255,0.5)' : 'var(--subtle)';
  var nameColor = dark ? '#fff' : 'var(--black)';
  if (!uids.length) {
    box.innerHTML = '<div style="font-size:13px;color:' + headerColor + '">' + goingCount + ' going · no one tagged yet</div>';
    return;
  }
  box.innerHTML = '<div style="font-size:13px;color:' + headerColor + ';margin-bottom:10px">' + goingCount + ' going</div>';
  Promise.all(uids.map(function(uid){ return window.db.collection('users').doc(uid).get(); })).then(function(docs){
    var rsvps = m.rsvps || {};
    box.innerHTML = '<div style="font-size:13px;color:' + headerColor + ';margin-bottom:10px">' + goingCount + ' going</div>' +
      docs.map(function(doc){
        var d = doc.data() || {};
        var nm = d.name || 'Friend';
        var status = rsvps[doc.id] || 'pending';
        var label = status === 'going' ? 'Going' : status === 'maybe' ? 'Maybe' : status === 'no' ? "Can't go" : 'Pending';
        var color = status === 'going' ? 'var(--win)' : status === 'no' ? 'var(--loss)' : headerColor;
        return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0">' +
          '<div style="width:28px;height:28px;border-radius:50%;background:var(--indigo-light);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--indigo)">' + _escapeHtml(_initialsFallback(nm)) + '</div>' +
          '<div style="flex:1;font-size:13px;font-weight:600;color:' + nameColor + '">' + _escapeHtml(nm) + '</div>' +
          '<div style="font-size:11px;font-weight:700;color:' + color + '">' + label + '</div>' +
        '</div>';
      }).join('');
  }).catch(function(err){ console.error('Load guest summary error:', err); });
}
