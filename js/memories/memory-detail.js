// ── PERSONAL INSIGHT ──
// Deliberately the opposite of a Strava-style comparison metric: this is
// never shown to anyone but you, never ranks you against another person,
// and the quiet-month case is written to reassure, not nudge — a stat that
// only celebrates busy months and goes cold or guilt-trippy on slow ones
// would just be the same social-comparison anxiety in a private wrapper.
function renderPersonalInsight(moments) {
  var card = document.getElementById('personal-insight-card');
  var iconEl = document.getElementById('personal-insight-icon');
  var titleEl = document.getElementById('personal-insight-title');
  var subEl = document.getElementById('personal-insight-sub');
  if (!card) return;

  var today = _todayLocal();
  var currentMonth = today.slice(0, 7);
  var byMonth = {};
  (moments || []).forEach(function(m){
    if (!m.date) return;
    var mo = m.date.slice(0, 7);
    byMonth[mo] = (byMonth[mo] || 0) + 1;
  });

  var currentCount = byMonth[currentMonth] || 0;
  var priorMonths = Object.keys(byMonth).filter(function(mo){ return mo !== currentMonth; });
  // Needs real history to say anything honest — otherwise stay silent
  // rather than compare this month to a near-empty baseline.
  if (priorMonths.length < 2) { card.style.display = 'none'; return; }

  var priorTotal = priorMonths.reduce(function(sum, mo){ return sum + byMonth[mo]; }, 0);
  var avg = priorTotal / priorMonths.length;
  if (avg <= 0) { card.style.display = 'none'; return; }

  var icon, title, sub;
  if (currentCount >= avg * 1.3 && currentCount >= 2) {
    var maxPrior = Math.max.apply(null, priorMonths.map(function(mo){ return byMonth[mo]; }));
    icon = '📈';
    title = currentCount > maxPrior ? 'Your busiest month yet' : 'A busier month than usual';
    sub = currentCount + (currentCount === 1 ? ' memory' : ' memories') + ' this month — more than your average of ' + Math.round(avg) + '.';
  } else if (currentCount <= avg * 0.6) {
    icon = '🌙';
    title = 'A quieter month';
    sub = "Fewer memories than usual — no pressure, they'll be here when you're ready.";
  } else {
    icon = '〰️';
    title = 'Right on pace';
    sub = 'About as many memories as your average month.';
  }
  iconEl.textContent = icon;
  titleEl.textContent = title;
  subEl.textContent = sub;
  card.style.display = 'flex';
}

function renderMoments(moments) {
  var list = document.getElementById('mem-list');
  var empty = document.getElementById('mem-empty');
  var count = document.getElementById('mem-count');
  var pastTitle = document.getElementById('past-memories-title');
  if (count) count.textContent = moments.length;
  renderPeopleRow(moments);
  renderPersonalInsight(moments);

  var hasReal = moments.length > 0;
  if (empty) empty.style.display = hasReal ? 'none' : 'flex';
  if (pastTitle) pastTitle.style.display = hasReal ? 'block' : 'none';
  if (!list) return;

  var avColors = ['av-a', 'av-b', 'av-c', 'av-d', 'av-e'];
  list.innerHTML = moments.map(function(m) {
    var emoji = (m.vibe || '✨').trim().split(' ')[0];
    var img = m.photo
      ? '<div class="mem-snap-img" style="background-image:url(' + m.photo + ');background-size:cover;background-position:center"></div>'
      : '<div class="mem-snap-img" style="background:linear-gradient(135deg,#3D3580 0%,#2A2460 55%,#1A1640 100%);font-size:34px">' + _escapeHtml(emoji) + '</div>';
    var sub = _escapeHtml((m.vibe || '') + (m.date ? '  ·  ' + _formatMomentDate(m.date) : ''));
    var caption = m.highlight ? '<div class="mem-snap-caption">' + _escapeHtml(m.highlight) + '</div>' : '';
    var people = (m.people || []);
    var uids = (m.taggedUids || []);
    var who = people.length ? 'You + ' + (people.length === 1 ? _escapeHtml(people[0]) : people.length + ' others') : 'Just you';
    var nComments = (m.comments || []).length;
    var totalPhotos = (m.photos || []).length + (m.photo ? 1 : 0);
    var meta = [];
    if (totalPhotos > 1) meta.push(totalPhotos + ' photos');
    if (nComments) meta.push(nComments + (nComments === 1 ? ' comment' : ' comments'));
    var metaLine = meta.length ? '<div style="font-size:11px;color:rgba(255,255,255,0.42);margin-top:8px">' + meta.join('  ·  ') + '</div>' : '';
    var avStack = '<div class="mem-avstack"><div class="av av-a">' + _escapeHtml(_initials((window.userData && window.userData.name) || 'You')) + '</div>' +
      uids.map(function(uid, i){ return { uid: uid, name: people[i] || 'Friend' }; }).filter(function(p){ return !!p.uid; }).slice(0, 2).map(function(p, i){
        var safeNm = _escapeHtml(p.name).replace(/'/g, "\\'");
        return '<div class="av ' + avColors[(i + 1) % avColors.length] + '" onclick="event.stopPropagation();openFriendHub(\'' + p.uid + '\',\'' + safeNm + '\')" style="cursor:pointer">' + _escapeHtml(_initials(p.name)) + '</div>';
      }).join('') +
    '</div>';
    return '<div class="mem-snap" style="cursor:pointer" onclick="openMemory(\'' + m._id + '\')">' + img +
      '<div class="mem-snap-body">' +
        '<div class="mem-snap-who">' + avStack +
          '<div><div class="mem-snap-names">' + _escapeHtml(m.name || 'Untitled moment') + '</div>' +
          '<div class="mem-snap-date">' + who + '  ·  ' + sub + '</div></div>' +
        '</div>' + caption + metaLine +
      '</div></div>';
  }).join('');
}

function renderPeopleRow(moments) {
  var wrap = document.getElementById('people-row-section');
  var list = document.getElementById('people-row-list');
  if (!wrap || !list) return;
  var map = {};
  (moments || []).forEach(function(m){
    var uids = m.taggedUids || [];
    var names = m.people || [];
    uids.forEach(function(uid, i){
      if (!uid) return;
      if (!map[uid]) map[uid] = { name: names[i] || 'Friend', count: 0 };
      map[uid].count++;
    });
  });
  var people = Object.keys(map).map(function(uid){ return { uid: uid, name: map[uid].name, count: map[uid].count }; });
  people.sort(function(a, b){ return b.count - a.count; });
  wrap.style.display = people.length ? 'block' : 'none';
  if (!people.length) return;
  var colors = ['av-a', 'av-b', 'av-c', 'av-d', 'av-e'];
  list.innerHTML = people.map(function(p, i){
    var safeNm = _escapeHtml(p.name).replace(/'/g, "\\'");
    return '<div class="people-chip" onclick="openFriendHub(\'' + p.uid + '\',\'' + safeNm + '\')">' +
      '<div class="av ' + colors[i % colors.length] + '">' + _escapeHtml(_initials(p.name)) + '</div>' +
      '<div class="people-chip-name">' + _escapeHtml(p.name) + '</div>' +
      '<div class="people-chip-count">' + p.count + ' together</div>' +
    '</div>';
  }).join('');
}

function openFriendHub(uid, name) {
  window._openFriendUid = uid;
  var avEl = document.getElementById('fh-avatar');
  var nameEl = document.getElementById('fh-name');
  var countEl = document.getElementById('fh-count');
  var paneEl = document.getElementById('fh-pane-mem');
  if (avEl) avEl.textContent = _initials(name);
  if (nameEl) nameEl.textContent = name;

  var shared = (window._moments || []).filter(function(m){ return (m.taggedUids || []).indexOf(uid) !== -1; });
  if (countEl) countEl.textContent = shared.length;
  if (paneEl) {
    paneEl.innerHTML = shared.length ? shared.map(function(m){
      var emoji = (m.vibe || '✨').trim().split(' ')[0];
      var img = m.photo
        ? '<div class="mem-snap-img" style="background-image:url(' + m.photo + ');background-size:cover;background-position:center"></div>'
        : '<div class="mem-snap-img" style="background:linear-gradient(135deg,#3D3580 0%,#2A2460 55%,#1A1640 100%);font-size:34px">' + _escapeHtml(emoji) + '</div>';
      var sub = _escapeHtml((m.vibe || '') + (m.date ? '  ·  ' + _formatMomentDate(m.date) : ''));
      return '<div class="mem-snap" style="cursor:pointer" onclick="openMemory(\'' + m._id + '\')">' + img +
        '<div class="mem-snap-body"><div class="mem-snap-names">' + _escapeHtml(m.name || 'Untitled moment') + '</div>' +
        '<div class="mem-snap-date">' + sub + '</div></div></div>';
    }).join('') : '<div style="text-align:center;padding:30px 10px;color:rgba(255,255,255,0.4);font-size:13px">No shared memories yet</div>';
  }
  _fhShowTab('mem');
  nav('friend-hub');
}

function _fhShowTab(tab) {
  var memBtn = document.getElementById('fh-tab-mem');
  var biBtn = document.getElementById('fh-tab-bi');
  var memPane = document.getElementById('fh-pane-mem');
  var biPane = document.getElementById('fh-pane-bi');
  if (memBtn) memBtn.style.background = tab === 'mem' ? '#A89FE8' : 'rgba(255,255,255,.08)';
  if (memBtn) memBtn.style.color = tab === 'mem' ? '#1A1640' : 'rgba(255,255,255,.5)';
  if (biBtn) biBtn.style.background = tab === 'bi' ? '#A89FE8' : 'rgba(255,255,255,.08)';
  if (biBtn) biBtn.style.color = tab === 'bi' ? '#1A1640' : 'rgba(255,255,255,.5)';
  if (memPane) memPane.style.display = tab === 'mem' ? 'flex' : 'none';
  if (biPane) biPane.style.display = tab === 'bi' ? 'flex' : 'none';
}

// ── PROFILE STATS + SOCIAL STREAK ──
function _weekIndex(dateStr) {
  var p = String(dateStr || '').split('-');
  if (p.length !== 3) return null;
  var days = Date.UTC(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10)) / 86400000;
  return Math.floor((days + 3) / 7); // Monday-anchored week index
}

function computeWeeklyStreak(socialMoments) {
  if (!socialMoments.length) return 0;
  var weeks = {};
  socialMoments.forEach(function(m){ var w = _weekIndex(m.date); if (w !== null) weeks[w] = true; });
  var cur = _weekIndex(_todayLocal());
  if (cur === null) return 0;
  if (!weeks[cur] && !weeks[cur-1]) return 0; // streak broken if no social moment this week or last
  var start = weeks[cur] ? cur : cur - 1;
  var count = 0, w = start;
  while (weeks[w]) { count++; w--; }
  return count;
}

function updateProfileStats(moments) {
  var social = moments.filter(function(m){ return (m.people || []).length > 0; });
  var streak = computeWeeklyStreak(social);
  var memEl = document.getElementById('stat-memories');
  var evEl = document.getElementById('stat-events');
  var stEl = document.getElementById('stat-streak');
  var stCard = document.getElementById('stat-streak-card');
  if (memEl) memEl.textContent = moments.length;
  if (evEl) evEl.textContent = social.length;
  if (stEl) stEl.textContent = streak;
  if (stCard) stCard.className = 's-card' + (streak > 0 ? ' on' : '');
}

// ── MEMORY DETAIL / EDIT / COMMENT / DELETE ──
window._openMomentId = null;
window._openMomentOwnerUid = null;
window._memoryReturnTo = 'memories';
window._memoryDetailMode = 'view';
window._mdPhotoTimer = null;

function openMemory(id, returnTo) {
  var m = _findMoment(id);
  if (m) { _openMemoryWithData(m, returnTo); return; }
  // Not in any local cache — this can happen for a memory only ever seen
  // via someone's profile stats query. Rather than silently doing nothing
  // (the previous behavior — a tap that looked like it did nothing at
  // all), fetch it directly, same as the shared-memory path already does.
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast === 'function') ib_toast('Sign in first'); return; }
  window.db.collection('users').doc(user.uid).collection('moments').doc(id).get().then(function(doc){
    if (!doc.exists) { if (typeof ib_toast === 'function') ib_toast('That memory is no longer available'); return; }
    var d = Object.assign({ _id: doc.id }, doc.data());
    window._foreignMomentCache = window._foreignMomentCache || {};
    window._foreignMomentCache[id] = d;
    _openMemoryWithData(d, returnTo);
  }).catch(function(err){
    console.error('Open memory fallback fetch error:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not open that memory — try again');
  });
}

function _openMemoryWithData(m, returnTo) {
  if (m.isOslMemory && typeof _playOslMemoryReveal === 'function') {
    // The generic memory template (a map screenshot and a "who was there"
    // row) doesn't earn its place for OSL — the real page for this memory
    // is the actual festival group, lineup and chat and photos included.
    // The reveal plays right over whatever screen is currently active, then
    // lands there directly instead of on an intermediate card first.
    window._memoryReturnTo = returnTo || 'memories';
    _playOslMemoryReveal(m, function(){ nav('osl-group'); });
    return;
  }
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  window._openMomentId = m._id;
  window._openMomentOwnerUid = user ? user.uid : null;
  window._memoryReturnTo = returnTo || 'memories';
  window._memoryDetailMode = 'view';
  _showMemoryHeader('view');
  renderMemoryView(m);
  _navApplyScreen('memory-detail');
  _autoRefreshStaleBoxScore(m);
  _startLiveBoxScorePolling(m);
  _playSportFlourish(_flourishKeyForMemory(m));
}

// While a memory's box score isn't final yet (game still going), poll for
// an updated score every so often so it stays current while you're looking
// at it — not just once when you first open it. Always paired with a clear
// exit point (see the four places _mdPhotoTimer gets cleared) so this can
// never keep running after you've left the memory.
window._mdBoxScoreTimer = null;
function _startLiveBoxScorePolling(m) {
  if (window._mdBoxScoreTimer) { clearInterval(window._mdBoxScoreTimer); window._mdBoxScoreTimer = null; }
  if (!m || !m.boxScore || m.boxScore.status === 'Final') return;
  window._mdBoxScoreTimer = setInterval(function(){
    if (window._openMomentId !== m._id) { clearInterval(window._mdBoxScoreTimer); window._mdBoxScoreTimer = null; return; }
    _autoRefreshStaleBoxScore(m);
  }, 45000);
}

// A box score attached before a game finished (or before this feature could
// track which exact game it was) can be stuck showing pre-game info forever
// otherwise. Whenever the owner opens a memory, quietly check for that and
// pull the real result — no button, same as the plan-to-memory conversion.
// Routes by the tagged sport rather than assuming MLB — that assumption
// meant a still-live NFL/NBA/NHL/soccer score was never actually being
// refreshed at all, silently hitting an endpoint that had no idea what
// gamePk it was even being asked about.
function _autoRefreshStaleBoxScore(m) {
  if (!m || !m.boxScore || m.boxScore.status === 'Final') return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || window._openMomentOwnerUid !== user.uid) return;
  var sport = m.boxScore.sport || 'mlb';

  if (m.boxScore.gamePk) {
    var url = (typeof _bsModalBoxscoreUrl === 'function') ? _bsModalBoxscoreUrl(sport, m.boxScore.gamePk) : null;
    if (!url) return;
    fetch(url)
      .then(function(r){ return r.json(); })
      .then(function(box){ _applyRefreshedBoxScore(m, box); })
      .catch(function(err){ console.error('Auto-refresh box score error:', err); });
    return;
  }

  // Older attachments made before gamePk was tracked — re-find the same
  // game by date + team names so this heals itself without manual action.
  // This legacy path only ever applies to pre-multi-sport data, so it
  // staying MLB-only here is intentional, not an oversight.
  if (sport !== 'mlb') return;
  if (!m.date || !m.boxScore.away || !m.boxScore.home) return;
  fetch('/api/mlb?mode=schedule&date=' + encodeURIComponent(m.date))
    .then(function(r){ return r.json(); })
    .then(function(data){
      var games = data.games || [];
      var match = games.filter(function(g){ return g.away === m.boxScore.away && g.home === m.boxScore.home; })[0];
      if (!match) return null;
      return fetch('/api/mlb?mode=boxscore&gamePk=' + encodeURIComponent(match.gamePk)).then(function(r){ return r.json(); });
    })
    .then(function(box){ if (box) _applyRefreshedBoxScore(m, box); })
    .catch(function(err){ console.error('Auto-refresh legacy box score error:', err); });
}

function _applyRefreshedBoxScore(m, box) {
  if (!box || !box.home) return;
  var safe = _sanitizeForFirestore(box);
  // A fresh fetch never carries the sport tag — it's not part of any
  // backend's actual response, only ever added client-side at attach time
  // — so it has to be carried forward by hand or every refresh quietly
  // reverts the memory back to guessing from its vibe.
  if (m.boxScore && m.boxScore.sport) safe.sport = m.boxScore.sport;
  m.boxScore = safe;
  // Patch just the box score card in place rather than re-rendering the
  // whole scrolling container (md-scroll) — replacing an entire scroll
  // container's content while someone may be mid-scroll is what caused the
  // freeze this was written to avoid. A single small, non-scrolling <div>
  // getting new innerHTML doesn't carry that same risk.
  if (window._openMomentId === m._id) {
    var slot = document.getElementById('md-boxscore-slot');
    if (slot) slot.innerHTML = (typeof _mdIsTicket === 'function' && _mdIsTicket(m)) ? _mdGameBlockHtml(m) : _boxScoreCardHtml(safe, true);
  }
  if (safe.status === 'Final' && window._mdBoxScoreTimer) {
    clearInterval(window._mdBoxScoreTimer);
    window._mdBoxScoreTimer = null;
  }
  _persistMoment(m, { boxScore: safe });
}

// Opens a memory that belongs to someone else — reached via a notification
// like "X marked a memory with you". Fetches it once (not a live listener),
// renders it read-mostly (no edit/tag, but comments still work), and remembers
// where to return to when the person taps Back.
function openSharedMemory(ownerUid, momentId, returnTo) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!window.db || !ownerUid || !momentId) return;
  if (user && ownerUid === user.uid) { openMemory(momentId); return; }
  window._memoryReturnTo = returnTo || 'notifications';
  window.db.collection('users').doc(ownerUid).get().then(function(ownerDoc){
    var ownerName = (ownerDoc.exists && ownerDoc.data().name) || 'a friend';
    return window.db.collection('users').doc(ownerUid).collection('moments').doc(momentId).get().then(function(doc){
      if (!doc.exists) { if (typeof ib_toast==='function') ib_toast('That memory is no longer available'); return; }
      var m = Object.assign({ _id: doc.id, _ownerName: ownerName }, doc.data());
      window._foreignMomentCache[momentId] = m;
      window._openMomentId = momentId;
      window._openMomentOwnerUid = ownerUid;
      window._memoryDetailMode = 'view';
      _showMemoryHeader('view');
      renderMemoryView(m);
      _navApplyScreen('memory-detail');
    });
  }).catch(function(err){
    console.error('Open shared memory error:', err);
    if (typeof ib_toast==='function') ib_toast('Could not open that memory');
  });
}

function closeMemoryDetail() {
  if (window._mdPhotoTimer) { clearInterval(window._mdPhotoTimer); window._mdPhotoTimer = null; }
  if (window._mdBoxScoreTimer) { clearInterval(window._mdBoxScoreTimer); window._mdBoxScoreTimer = null; }
  _navApplyScreen(window._memoryReturnTo || 'memories');
}

function _showMemoryHeader(mode) {
  var v = document.getElementById('md-header-view');
  var e = document.getElementById('md-header-edit');
  var c = document.getElementById('md-composer');
  var p = document.getElementById('md-bg-progress');
  if (v) v.style.display = mode === 'view' ? 'flex' : 'none';
  if (e) e.style.display = mode === 'edit' ? 'flex' : 'none';
  if (c) c.style.display = mode === 'view' ? 'flex' : 'none';
  if (p) p.style.display = mode === 'view' ? 'flex' : 'none';
}

function enterMemoryEdit() {
  var m = _findMoment(window._openMomentId); if (!m) return;
  window._memoryDetailMode = 'edit';
  if (window._mdPhotoTimer) { clearInterval(window._mdPhotoTimer); window._mdPhotoTimer = null; }
  if (window._mdBoxScoreTimer) { clearInterval(window._mdBoxScoreTimer); window._mdBoxScoreTimer = null; }
  _showMemoryHeader('edit');
  renderMemoryEdit(m);
}

function exitMemoryEdit() {
  var m = _findMoment(window._openMomentId); if (!m) return;
  window._memoryDetailMode = 'view';
  _showMemoryHeader('view');
  renderMemoryView(m);
  _startLiveBoxScorePolling(m);
}

function openPhotoLightbox(url) {
  var img = document.getElementById('lightbox-img');
  var dl = document.getElementById('lightbox-download');
  var box = document.getElementById('photo-lightbox');
  if (img) img.src = url;
  if (dl) dl.href = url;
  if (box) box.style.display = 'flex';
}

function closePhotoLightbox() {
  var box = document.getElementById('photo-lightbox');
  if (box) box.style.display = 'none';
}

function _startMemoryPhotoRotation(count) {
  if (window._mdPhotoTimer) { clearInterval(window._mdPhotoTimer); window._mdPhotoTimer = null; }
  if (count < 2) return;
  var i = 0;
  window._mdPhotoTimer = setInterval(function(){
    var slides = document.querySelectorAll('#md-bg-rotator .md-bg-slide');
    var segs = document.querySelectorAll('#md-bg-progress .md-bg-seg');
    if (slides.length < 2) return;
    slides[i].style.opacity = 0;
    if (segs[i]) segs[i].style.background = 'rgba(255,255,255,0.3)';
    i = (i + 1) % slides.length;
    slides[i].style.opacity = 1;
    if (segs[i]) segs[i].style.background = 'rgba(255,255,255,0.9)';
  }, 5000);
}
