// ── COLLABORATIVE MEMORY PHOTOS ──
// A memory converted from a plan exists as a separate, independent copy in
// each tagged person's own moments subcollection — there's no single shared
// document to write into. Rather than needing new write access into someone
// else's private data (which security rules don't and shouldn't grant),
// contributions live in their own top-level collection, keyed by the
// source plan's id — the one thing every person's copy already has in
// common. Same pattern already proven out by oslPhotos/actPhotos.
window._momentPhotosCache = {};
function _momentPhotoGroupId(m) { return m.sourcePlanId || m._id; }

function loadMomentPhotos(groupId, cb) {
  if (!groupId || !window.db) { cb([]); return; }
  if (window._momentPhotosCache[groupId]) { cb(window._momentPhotosCache[groupId]); return; }
  // Sorted client-side rather than orderBy('ts'): where + orderBy on
  // different fields needs a composite index, and a missing index fails
  // the whole read (failed-precondition) the same silent way a rules
  // denial does.
  window.db.collection('momentPhotos').where('groupId', '==', groupId).get().then(function(snap){
    var arr = [];
    snap.forEach(function(doc){ arr.push(Object.assign({ _id: doc.id }, doc.data())); });
    arr.sort(function(a, b){ return (a.ts || 0) - (b.ts || 0); });
    window._momentPhotosCache[groupId] = arr;
    cb(arr);
  }).catch(function(err){
    console.error('[momentPhotos:load] ' + (err && err.code), err);
    cb([]);
    var note = document.getElementById('collab-photo-note');
    if (note) note.textContent = "Couldn't load photos (" + ((err && err.code) || 'error') + ').';
  });
}

function addMomentPhoto(input) {
  if (!input.files || !input.files.length) return;
  var groupId = window._openMomentPhotoGroupId;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!groupId || !user || !window.db) { if (typeof ib_toast === 'function') ib_toast('Sign in to add photos'); return; }
  var author = (window.userData && window.userData.name) || 'You';
  var files = Array.from(input.files);
  if (typeof ib_toast === 'function') ib_toast('Uploading…');
  files.forEach(function(file){
    var reader = new FileReader();
    reader.onload = function(e){
      _downscaleImage(e.target.result, 1000, function(small){
        window.db.collection('momentPhotos').add({ groupId: groupId, uid: user.uid, author: author, photo: small, ts: Date.now() })
          .then(function(){
            delete window._momentPhotosCache[groupId];
            if (window._openMomentId) { loadMomentPhotos(groupId, function(photos){ _renderCollabPhotoGrid(photos); }); }
          })
          .catch(function(err){ console.error('[momentPhotos:add] ' + (err && err.code), err); if (typeof ib_toast === 'function') ib_toast('Could not add photo — ' + ((err && err.code) || 'try again')); });
      });
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

var _momentAvColors = ['av-a', 'av-b', 'av-c', 'av-d', 'av-e'];
function _renderCollabPhotoGrid(photos) {
  var grid = document.getElementById('collab-photo-grid');
  var note = document.getElementById('collab-photo-note');
  if (!grid) return;
  var contributors = {};
  var colorIdx = 0;
  var tiles = photos.map(function(p){
    if (!(p.uid in contributors)) { contributors[p.uid] = _momentAvColors[colorIdx % _momentAvColors.length]; colorIdx++; }
    var initials = _escapeHtml(_initials(p.author || 'Friend'));
    return '<div class="collab-ph-tile" onclick="openPhotoLightbox(\'' + p.photo.replace(/'/g, "\\'") + '\')" style="position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;cursor:pointer;background-image:url(' + p.photo + ');background-size:cover;background-position:center">' +
      '<div class="av ' + contributors[p.uid] + '" style="position:absolute;bottom:4px;left:4px;width:20px;height:20px;font-size:9px;border:1.5px solid var(--indigo-deep)">' + initials + '</div>' +
    '</div>';
  }).join('');
  tiles += '<div class="collab-ph-tile" onclick="document.getElementById(\'moment-photo-input\').click()" style="aspect-ratio:1;border-radius:10px;border:1.5px dashed rgba(168,159,232,.4);background:rgba(168,159,232,.06);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#A89FE8;cursor:pointer">' +
    '<div style="font-size:22px;font-weight:300;line-height:1">+</div><div style="font-size:9.5px;font-weight:700">Add yours</div></div>';
  grid.innerHTML = tiles;
  if (note) note.textContent = photos.length
    ? 'Photos from everyone who was there — tap + to add yours.'
    : "No one's added photos here yet. Be the first.";
}


function renderMemoryView(m) {
  window._openMomentPhotoGroupId = _momentPhotoGroupId(m);
  var scroll = document.getElementById('md-scroll');
  var bgBox = document.getElementById('md-bg-rotator');
  var progBox = document.getElementById('md-bg-progress');
  if (!scroll || !bgBox) return;
  var allPhotos = (m.photo ? [m.photo] : []).concat(m.photos || []);
  var curUser = window.currentUser || (window.auth && window.auth.currentUser);
  var isForeign = !!(window._openMomentOwnerUid && curUser && window._openMomentOwnerUid !== curUser.uid);

  var editBtn = document.getElementById('md-edit-btn');
  if (editBtn) editBtn.style.display = isForeign ? 'none' : 'inline';
  var backLbl = document.getElementById('md-back-label');
  if (backLbl) backLbl.textContent = isForeign ? 'Back' : 'Memories';

  // Full-bleed rotating photo backdrop
  if (allPhotos.length) {
    bgBox.innerHTML = allPhotos.map(function(p, i){
      return '<div class="md-bg-slide" onclick="openPhotoLightbox(\'' + p.replace(/'/g, "\\'") + '\')" style="position:absolute;inset:0;background-image:url(' + p + ');background-size:cover;background-position:center;opacity:' + (i === 0 ? '1' : '0') + ';transition:opacity 1.6s ease;cursor:pointer"></div>';
    }).join('');
  } else {
    bgBox.innerHTML = '<div style="position:absolute;inset:0;background:linear-gradient(135deg,#3D3580,#1A1640);display:flex;align-items:center;justify-content:center;font-size:130px;opacity:0.22">' + _escapeHtml((m.vibe || '✨').split(' ')[0]) + '</div>';
  }
  if (progBox) {
    progBox.innerHTML = allPhotos.length > 1
      ? allPhotos.map(function(_, i){ return '<div class="md-bg-seg" style="flex:1;height:3px;border-radius:2px;background:' + (i === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)') + '"></div>'; }).join('')
      : '';
  }

  var youName = (window.userData && window.userData.name) || 'You';
  var people = (m.people || []);
  var ownerInitials = isForeign ? _initials(m._ownerName || 'Them') : _initials(youName);
  var peopleChips = '<div class="av av-a" style="width:32px;height:32px;font-size:11px;border:2px solid rgba(255,255,255,0.55)">' + _escapeHtml(ownerInitials) + '</div>' +
    people.map(function(nm){
      return '<div class="av av-b" style="width:32px;height:32px;font-size:11px;margin-left:-8px;border:2px solid rgba(255,255,255,0.55)">' + _escapeHtml(_initials(nm)) + '</div>';
    }).join('');

  // Conversation thread: your highlight + dedication + comments, iMessage-style bubbles
  var thread = '';
  if (m.highlight) {
    thread += '<div style="display:flex;justify-content:flex-end;margin-bottom:10px">' +
      '<div style="max-width:78%;background:var(--indigo);color:#fff;border-radius:18px 18px 4px 18px;padding:11px 15px;font-size:15px;line-height:1.5;box-shadow:0 4px 14px rgba(0,0,0,0.2)">' + _escapeHtml(m.highlight) + '</div></div>';
  }
  if (m.dedication) {
    thread += '<div style="display:flex;justify-content:center;margin:2px 0 14px">' +
      '<div style="max-width:82%;background:rgba(255,255,255,0.18);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#fff;border-radius:14px;padding:9px 14px;font-size:12.5px;line-height:1.5;font-style:italic;text-align:center">💜 ' + _escapeHtml(m.dedication) + '</div></div>';
  }
  var comments = (m.comments || []);
  if (comments.length) {
    thread += comments.map(function(c){
      var mine = c.author === youName;
      if (mine) {
        return '<div style="display:flex;justify-content:flex-end;margin-bottom:10px">' +
          '<div style="max-width:78%;background:var(--indigo);color:#fff;border-radius:18px 18px 4px 18px;padding:11px 15px;font-size:15px;line-height:1.5;box-shadow:0 4px 14px rgba(0,0,0,0.2)">' + _escapeHtml(c.text) + '</div></div>';
      }
      return '<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:10px">' +
        '<div class="av av-c" style="width:26px;height:26px;font-size:10px;flex-shrink:0">' + _escapeHtml(_initials(c.author)) + '</div>' +
        '<div style="max-width:74%">' +
          '<div style="font-size:11px;color:rgba(255,255,255,0.6);margin:0 0 3px 4px">' + _escapeHtml(c.author) + '</div>' +
          '<div style="background:rgba(255,255,255,0.94);color:#1A1640;border-radius:18px 18px 18px 4px;padding:11px 15px;font-size:15px;line-height:1.5;box-shadow:0 4px 14px rgba(0,0,0,0.14)">' + _escapeHtml(c.text) + '</div>' +
        '</div></div>';
    }).join('');
  }
  if (!thread) {
    thread = '<div style="text-align:center;padding:26px 10px;color:rgba(255,255,255,0.6);font-size:13px;font-style:italic">No highlight or messages yet — say something below.</div>';
  }

  var sharedByLine = isForeign ? '<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:14px">Shared by ' + _escapeHtml(m._ownerName || 'a friend') + '</div>' : '';
  var isTicket = typeof _mdIsTicket === 'function' && _mdIsTicket(m);
  window._mdTicketMoment = isTicket ? m : null;
  var boxScoreHtml = m.boxScore ? '<div id="md-boxscore-slot" style="margin-bottom:14px">' + (isTicket ? _mdGameBlockHtml(m) : _boxScoreCardHtml(m.boxScore, true)) + '</div>' : '<div id="md-boxscore-slot"></div>';
  // The OSL Feed banner disappears once the festival's over — everything
  // it led to (chat, photos, full lineup) is still there, just reached
  // from here instead now that the live event itself has become this memory.
  var oslReopenHtml = (m.isOslMemory && !isForeign)
    ? '<div onclick="nav(\'osl-group\')" style="display:flex;align-items:center;justify-content:center;gap:6px;background:rgba(255,255,255,0.14);border:0.5px solid rgba(255,255,255,0.22);border-radius:12px;padding:10px;font-size:12.5px;font-weight:700;color:#fff;cursor:pointer;margin-bottom:14px">↩ Reopen Outside Lands — chat &amp; photos</div>'
    : '';

  var collabPhotosHtml = m.isOslMemory ? '' :
    '<div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:18px;padding:16px;margin-top:10px">' +
      '<div style="font-size:10.5px;font-weight:700;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Everyone\'s Photos</div>' +
      '<div id="collab-photo-note" style="font-size:11.5px;color:rgba(255,255,255,0.45);margin-bottom:10px">Loading…</div>' +
      '<div id="collab-photo-grid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px"></div>' +
    '</div>';

  // Game memories (v5.68.0): title, then the ticket stub + game card,
  // then who was there — the seat lives on the ticket now.
  if (isTicket) {
    scroll.innerHTML =
      '<div class="md-grid"><div class="md-col-a">' +
      '<div style="padding:2px 4px 12px;text-shadow:0 1px 12px rgba(0,0,0,.45)">' +
        '<div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-.02em;line-height:1.15">' + _escapeHtml(m.name || 'Untitled moment') + '</div>' +
        '<div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:4px">' + _escapeHtml([m.date ? _formatMomentDate(m.date) : '', m.boxScore.venue || ''].filter(Boolean).join(' · ')) + '</div>' +
        (sharedByLine ? '<div style="margin-top:6px">' + sharedByLine + '</div>' : '') +
      '</div>' +
      boxScoreHtml +
      '</div><div class="md-col-b">' +
      '<div style="background:rgba(255,255,255,0.14);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:18px;padding:16px">' +
        '<div style="font-size:10.5px;font-weight:700;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Who was there</div>' +
        '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;margin-bottom:4px">' + peopleChips + '</div>' +
        (typeof _mdPlayersHtml === 'function' ? _mdPlayersHtml(m) : '') +
      '</div>' +
      collabPhotosHtml +
      '<div style="padding-top:6px">' + thread + '</div>' +
      '</div></div>';
  } else
  scroll.innerHTML =
    '<div style="background:rgba(255,255,255,0.14);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:18px;padding:16px">' +
      '<div style="font-size:19px;font-weight:700;color:#fff;letter-spacing:-0.4px;margin-bottom:3px">' + _escapeHtml(m.name || 'Untitled moment') + '</div>' +
      '<div style="font-size:12px;color:rgba(255,255,255,0.65);margin-bottom:' + (isForeign ? '2' : '14') + 'px">' + _escapeHtml((m.vibe || '') + (m.date ? '  ·  ' + _formatMomentDate(m.date) : '')) + '</div>' +
      _gattMemoryLineHtml(m, isForeign) +
      sharedByLine +
      oslReopenHtml +
      boxScoreHtml +

      '<div style="font-size:10.5px;font-weight:700;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Who was there</div>' +
      '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px;margin-bottom:4px">' + peopleChips + '</div>' +
      (typeof _mdPlayersHtml === 'function' ? _mdPlayersHtml(m) : '') +
    '</div>' +
    collabPhotosHtml +
    '<div style="padding-top:6px">' + thread + '</div>';

  var saveAllBtn = document.getElementById('md-save-all-btn');
  if (saveAllBtn) saveAllBtn.style.display = allPhotos.length ? 'inline' : 'none';

  if (!m.isOslMemory) {
    loadMomentPhotos(window._openMomentPhotoGroupId, function(photos){ _renderCollabPhotoGrid(photos); });
  }

  _startMemoryPhotoRotation(allPhotos.length);
}

function renderMemoryEdit(m) {
  var box = document.getElementById('md-scroll');
  if (!box) return;
  var allPhotos = (m.photo ? [m.photo] : []).concat(m.photos || []);
  var photoCount = allPhotos.length;
  var boxScoreEditHtml = m.boxScore ?
    '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Game</div>' +
    _boxScoreCardHtml(m.boxScore, false) +
    '<div style="display:flex;gap:16px;justify-content:center;margin:8px 0 20px">' +
      (m.boxScore.gamePk ? '<div onclick="momentRefreshBoxScore()" style="font-size:12px;color:var(--indigo);font-weight:600;cursor:pointer">Refresh score</div>' : '') +
      '<div onclick="momentRemoveBoxScore()" style="font-size:12px;color:var(--subtle);font-weight:600;cursor:pointer">Remove box score</div>' +
    '</div>' :
    '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Game</div>' +
    '<div onclick="openBoxScoreModal({type:\'moment\'},\'' + _escapeHtml(m.date || '') + '\')" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:var(--bg);border:1.5px dashed var(--rule);cursor:pointer;margin-bottom:20px">' +
      '<div style="font-size:20px">⚾</div>' +
      '<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--black)">Attach a game</div><div style="font-size:11px;color:var(--subtle)">Pulls the final score — any sport</div></div>' +
    '</div>';

  box.innerHTML =
    '<div style="background:var(--card);border-radius:18px;padding:16px;box-shadow:0 8px 28px rgba(0,0,0,0.3)">' +
      '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Moment name</div>' +
      '<input id="md-name" value="' + _escapeHtml(m.name || '') + '" style="width:100%;font-size:18px;font-weight:700;color:var(--black);border:0.5px solid var(--rule);border-radius:12px;padding:12px 14px;outline:none;background:var(--bg);letter-spacing:-0.4px;font-family:inherit;margin-bottom:10px">' +
      '<div onclick="momentConvertToFuturePlan()" style="font-size:12px;color:var(--indigo);font-weight:600;cursor:pointer;margin-bottom:16px">This hasn\'t happened yet — move it back to Coming Up</div>' +

      '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Your highlight</div>' +
      '<textarea id="md-highlight" placeholder="What do you want to remember?" style="width:100%;font-size:15px;color:var(--black);border:0.5px solid var(--rule);border-radius:14px;padding:12px;outline:none;background:var(--bg);resize:none;height:100px;font-family:inherit;line-height:1.6;margin-bottom:20px">' + _escapeHtml(m.highlight || '') + '</textarea>' +

      '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Who was there</div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px" id="md-people-list">' +
        (m.people || []).map(function(nm, i){
          return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;position:relative">' +
            '<div class="av av-b" style="width:44px;height:44px;font-size:14px">' + _escapeHtml(_initials(nm)) + '</div>' +
            '<div style="font-size:10px;color:var(--subtle);max-width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml((nm || '').split(' ')[0]) + '</div>' +
            '<div onclick="momentRemovePerson(' + i + ')" style="position:absolute;top:-4px;right:-2px;width:18px;height:18px;border-radius:50%;background:var(--loss);color:white;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer">×</div>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:10px">' +
        '<input id="md-person" placeholder="Tag someone by name" onkeydown="if(event.key===\'Enter\'){event.preventDefault();momentTagPerson();}" style="flex:1;font-size:14px;border:0.5px solid var(--rule);border-radius:12px;padding:11px 14px;outline:none;font-family:inherit;color:var(--black);background:var(--bg)">' +
        '<button onclick="momentTagPerson()" style="background:var(--indigo-light);color:var(--indigo);border:none;border-radius:12px;padding:0 18px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit">Tag</button>' +
      '</div>' +
      '<div onclick="momentEditToggleAddFriends()" style="font-size:12px;color:var(--indigo);font-weight:600;cursor:pointer;margin-bottom:20px">＋ Add from your friends</div>' +
      '<div id="md-add-friends" style="display:none;margin:-10px 0 20px"></div>' +

      boxScoreEditHtml +

      '<div style="font-size:11px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px">Photos</div>' +
      (allPhotos.length
        ? '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">' +
            allPhotos.map(function(src, i){
              var isMain = (i === 0 && !!m.photo);
              var extraIdx = m.photo ? (i - 1) : i;
              return '<div style="position:relative;width:100%;aspect-ratio:1/1">' +
                '<div style="width:100%;height:100%;border-radius:10px;background-size:cover;background-position:center;background-image:url(' + src + ')"></div>' +
                '<div onclick="momentRemovePhoto(\'' + (isMain ? 'main' : 'extra') + '\',' + extraIdx + ')" style="position:absolute;top:-5px;right:-5px;width:20px;height:20px;border-radius:50%;background:var(--loss);color:white;font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.25)">×</div>' +
              '</div>';
            }).join('') +
          '</div>'
        : '<div style="font-size:13px;color:var(--subtle);margin-bottom:12px">No photos yet</div>') +

      '<div style="display:flex;gap:8px">' +
        '<input type="file" id="md-photo-input" accept="image/*" multiple style="display:none" onchange="momentAddPhoto(this)">' +
        '<button onclick="document.getElementById(\'md-photo-input\').click()" style="flex:1;background:var(--bg);border:0.5px solid var(--rule);border-radius:14px;padding:12px;font-size:13px;font-weight:600;color:var(--indigo);cursor:pointer;font-family:inherit">＋ Add photos</button>' +
        '<button onclick="momentSaveEdits()" style="flex:1;background:var(--indigo);color:white;border:none;border-radius:14px;padding:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">Save changes</button>' +
      '</div>' +
    '</div>';
}

// Manual escape hatch for a memory that shouldn't have been one — moves it
// back into futureMoments (with RSVPs and the public toggle available
// again) and removes it from Memories. Doesn't try to guess why it ended
// up here; it just gives a way out.
function momentConvertToFuturePlan() {
  var m = _findMoment(window._openMomentId); if (!m) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast === 'function') ib_toast('Sign in first'); return; }
  if (!window.confirm('Move "' + (m.name || 'this') + '" back to Coming Up as a future plan? It\'ll no longer appear in Memories.')) return;
  var ownerUid = window._openMomentOwnerUid || user.uid;
  window.db.collection('futureMoments').add({
    ownerUid: user.uid,
    ownerName: (window.userData && window.userData.name) || 'You',
    title: m.name || 'Untitled plan',
    date: m.date || _todayLocal(),
    time: '',
    location: (m.highlight || '').replace(/^at\s+/i, ''),
    theme: 'linear-gradient(135deg,#FF6B6B 0%,#FFA94D 45%,#845EF7 100%)',
    vibe: m.vibe || '',
    taggedUids: m.taggedUids || [],
    public: false,
    rsvps: {},
    boxScore: _sanitizeForFirestore(m.boxScore || null),
    ts: Date.now()
  }).then(function(){
    return window.db.collection('users').doc(ownerUid).collection('moments').doc(m._id).delete();
  }).then(function(){
    if (window._mdPhotoTimer) { clearInterval(window._mdPhotoTimer); window._mdPhotoTimer = null; }
    if (window._mdBoxScoreTimer) { clearInterval(window._mdBoxScoreTimer); window._mdBoxScoreTimer = null; }
    if (typeof ib_toast === 'function') ib_toast('Moved back to Coming Up 🎉');
    nav('feed');
  }).catch(function(err){
    console.error('Move to future plan error:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not move — ' + (err && err.message ? err.message : 'try again'));
  });
}

function momentRemoveBoxScore() {
  var m = _findMoment(window._openMomentId); if (!m) return;
  m.boxScore = null;
  renderMemoryEdit(m);
  _persistMoment(m, { boxScore: null }, 'Game removed');
}

function momentRefreshBoxScore() {
  var m = _findMoment(window._openMomentId); if (!m || !m.boxScore || !m.boxScore.gamePk) return;
  if (typeof ib_toast === 'function') ib_toast('Refreshing…');
  fetch('/api/mlb?mode=boxscore&gamePk=' + encodeURIComponent(m.boxScore.gamePk))
    .then(function(r){ return r.json(); })
    .then(function(box){
      m.boxScore = _sanitizeForFirestore(box);
      renderMemoryEdit(m);
      _persistMoment(m, { boxScore: m.boxScore }, 'Box score updated');
    })
    .catch(function(err){
      console.error('Refresh box score error:', err);
      if (typeof ib_toast === 'function') ib_toast('Could not refresh — try again');
    });
}

function _persistMoment(m, fields, okMsg) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in first'); return; }
  var ownerUid = window._openMomentOwnerUid || user.uid;
  var isForeign = ownerUid !== user.uid;
  var safeFields = {};
  Object.keys(fields).forEach(function(k){ safeFields[k] = _sanitizeForFirestore(fields[k]); });
  try {
    window.db.collection('users').doc(ownerUid).collection('moments').doc(m._id).update(safeFields)
      .then(function(){
        if (okMsg && typeof ib_toast==='function') ib_toast(okMsg);
        if (!isForeign) {
          renderMoments(window._moments);
          updateProfileStats(window._moments);
        }
      })
      .catch(function(err){ console.error('Update error:', err); if (typeof ib_toast==='function') ib_toast('Could not save — ' + (err && err.message ? err.message : 'try again')); });
  } catch (err) {
    console.error('Update threw synchronously:', err);
    if (typeof ib_toast==='function') ib_toast('Could not save — ' + (err && err.message ? err.message : 'try again'));
  }
}

function momentSaveEdits() {
  var m = _findMoment(window._openMomentId); if (!m) return;
  var nm = document.getElementById('md-name');
  var hl = document.getElementById('md-highlight');
  m.name = nm ? (nm.value.trim() || 'Untitled moment') : m.name;
  m.highlight = hl ? hl.value.trim() : m.highlight;
  _persistMoment(m, { name: m.name, highlight: m.highlight }, 'Saved');
  exitMemoryEdit();
}

function momentTagPerson() {
  var m = _findMoment(window._openMomentId); if (!m) return;
  var inp = document.getElementById('md-person');
  var name = inp ? inp.value.trim() : '';
  if (!name) return;
  m.people = (m.people || []).concat([name]);
  if (inp) inp.value = '';
  renderMemoryEdit(m);
  _persistMoment(m, { people: m.people }, 'Tagged ' + name);
  _notifyIfFriendTagged(name, m);
}

// If the tagged name matches one of your accepted friends, let them know —
// this is the "X marked a memory with you" notification from the product
// vision. Does nothing if no match (tags stay simple free text otherwise).
function _notifyIfFriendTagged(name, m) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  Promise.all([
    window.db.collection('friendRequests').where('fromUid','==',user.uid).where('status','==','accepted').get(),
    window.db.collection('friendRequests').where('toUid','==',user.uid).where('status','==','accepted').get()
  ]).then(function(results){
    var uids = [];
    results[0].forEach(function(d){ uids.push(d.data().toUid); });
    results[1].forEach(function(d){ uids.push(d.data().fromUid); });
    uids = uids.filter(function(v,i){ return uids.indexOf(v) === i; });
    if (!uids.length) return null;
    return Promise.all(uids.map(function(uid){ return window.db.collection('users').doc(uid).get(); })).then(function(docs){
      var match = null;
      for (var i = 0; i < docs.length; i++) {
        var d = docs[i].data() || {};
        if ((d.name || '').trim().toLowerCase() === name.trim().toLowerCase()) { match = docs[i]; break; }
      }
      if (!match) return null;
      var ownerName = (window.userData && window.userData.name) || 'Someone';
      m.taggedUids = (m.taggedUids || []).concat([match.id]).filter(function(v,i,arr){ return arr.indexOf(v) === i; });
      return Promise.all([
        window.db.collection('users').doc(user.uid).collection('moments').doc(m._id).update({
          taggedUids: firebase.firestore.FieldValue.arrayUnion(match.id)
        }),
        window.db.collection('notifications').add({
          toUid: match.id,
          type: 'tagged',
          fromUid: user.uid,
          fromName: ownerName,
          momentOwnerUid: user.uid,
          momentId: m._id,
          momentName: m.name || 'a memory',
          ts: Date.now(),
          read: false
        })
      ]);
    });
  }).catch(function(err){ console.error('Notify tagged friend error:', err); });
}

function momentRemovePerson(i) {
  var m = _findMoment(window._openMomentId); if (!m || !m.people) return;
  m.people.splice(i, 1);
  renderMemoryEdit(m);
  _persistMoment(m, { people: m.people });
}

function momentEditToggleAddFriends() {
  var el = document.getElementById('md-add-friends');
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    momentEditLoadAddableFriends();
  } else {
    el.style.display = 'none';
  }
}

function momentEditLoadAddableFriends() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var el = document.getElementById('md-add-friends');
  var m = _findMoment(window._openMomentId);
  if (!user || !window.db || !el || !m) return;
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
    var already = m.taggedUids || [];
    Promise.all(uids.map(function(uid){ return window.db.collection('users').doc(uid).get(); })).then(function(docs){
      el.innerHTML = docs.map(function(doc){
        var d = doc.data() || {};
        var nm = d.name || 'Friend';
        var isTagged = already.indexOf(doc.id) !== -1;
        if (isTagged) {
          return '<div onclick="momentEditUntagFriend(\'' + doc.id + '\',\'' + _escapeHtml(nm).replace(/'/g, "\\'") + '\')" style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;opacity:0.6">' +
            '<div style="width:32px;height:32px;border-radius:50%;background:var(--indigo-light);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--indigo)">' + _escapeHtml(_initialsFallback(nm)) + '</div>' +
            '<div style="flex:1;font-size:13px;font-weight:600;color:var(--black)">' + _escapeHtml(nm) + '</div>' +
            '<div style="font-size:11px;color:var(--subtle)">Tagged — tap to remove</div>' +
          '</div>';
        }
        return '<div onclick="momentEditAddFriend(\'' + doc.id + '\',\'' + _escapeHtml(nm).replace(/'/g, "\\'") + '\')" style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer">' +
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

function momentEditAddFriend(uid, name) {
  var m = _findMoment(window._openMomentId); if (!m) return;
  m.people = (m.people || []).concat([name]);
  m.taggedUids = (m.taggedUids || []).concat([uid]).filter(function(v,i,arr){ return arr.indexOf(v) === i; });
  renderMemoryEdit(m);
  _persistMoment(m, { people: m.people, taggedUids: m.taggedUids }, 'Tagged ' + name);
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (user && window.db) {
    window.db.collection('notifications').add({
      toUid: uid,
      type: 'tagged',
      fromUid: user.uid,
      fromName: (window.userData && window.userData.name) || 'Someone',
      momentOwnerUid: user.uid,
      momentId: m._id,
      momentName: m.name || 'a memory',
      ts: Date.now(),
      read: false
    }).catch(function(err){ console.error('Tag notification error:', err); });
  }
}

// Untags directly from the picker — this is how a stray/incorrect tag gets
// fixed even if it never had a matching chip in "Who was there" (e.g. a
// leftover taggedUids entry from before someone was actually there).
function momentEditUntagFriend(uid, name) {
  var m = _findMoment(window._openMomentId); if (!m) return;
  m.taggedUids = (m.taggedUids || []).filter(function(v){ return v !== uid; });
  var idx = (m.people || []).indexOf(name);
  if (idx !== -1) { m.people = m.people.slice(); m.people.splice(idx, 1); }
  renderMemoryEdit(m);
  _persistMoment(m, { taggedUids: m.taggedUids, people: m.people }, 'Removed ' + name);
}

function momentAddPhoto(input) {
  var m = _findMoment(window._openMomentId); if (!m || !input.files) return;
  if (!m.photos) m.photos = [];
  var files = Array.from(input.files), done = 0;
  files.forEach(function(file){
    var r = new FileReader();
    r.onload = function(e){
      _downscaleImage(e.target.result, 900, function(small){
        if (!m.photo) m.photo = small; else m.photos.push(small);
        done++;
        if (done === files.length) {
          renderMemoryEdit(m);
          _persistMoment(m, { photo: m.photo || '', photos: m.photos }, 'Photo added');
        }
      });
    };
    r.readAsDataURL(file);
  });
  input.value = '';
}

// Matches the "main photo" / "extra photos" split used throughout this
// screen (m.photo is the single primary photo, m.photos is everything
// else) — same split the thumbnail grid above hands back via its onclick.
function momentRemovePhoto(kind, idx) {
  var m = _findMoment(window._openMomentId); if (!m) return;
  if (kind === 'main') {
    m.photo = '';
  } else {
    m.photos = m.photos || [];
    m.photos.splice(idx, 1);
  }
  renderMemoryEdit(m);
  _persistMoment(m, { photo: m.photo || '', photos: m.photos || [] }, 'Photo removed');
}

function momentAddComment() {
  var m = _findMoment(window._openMomentId); if (!m) return;
  var inp = document.getElementById('md-comment');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;
  var author = (window.userData && window.userData.name) || 'You';
  m.comments = (m.comments || []).concat([{ author: author, text: text, ts: Date.now() }]);
  if (inp) inp.value = '';
  renderMemoryView(m);
  _persistMoment(m, { comments: m.comments });
}

function momentDelete() {
  var m = _findMoment(window._openMomentId); if (!m) return;
  if (!confirm('Delete "' + (m.name || 'this moment') + '"? This can\'t be undone.')) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  window.db.collection('users').doc(user.uid).collection('moments').doc(m._id).delete()
    .then(function(){
      window._moments = window._moments.filter(function(x){ return x._id !== m._id; });
      if (window._mdPhotoTimer) { clearInterval(window._mdPhotoTimer); window._mdPhotoTimer = null; }
      if (window._mdBoxScoreTimer) { clearInterval(window._mdBoxScoreTimer); window._mdBoxScoreTimer = null; }
      if (typeof ib_toast==='function') ib_toast('Moment deleted');
      renderMoments(window._moments);
      updateProfileStats(window._moments);
      nav('memories');
    })
    .catch(function(err){ console.error('Delete error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}

// ── CREATE FLOW: tag people by name ──
window._momentPeople = [];
function addMomentPerson() {
  var inp = document.getElementById('new-person-name');
  var name = inp ? inp.value.trim() : '';
  if (!name) return;
  if (!window._momentPeople) window._momentPeople = [];
  window._momentPeople.push({ name: name, uid: null });
  if (inp) inp.value = '';
  renderMomentPeople();
}
function momentToggleAddFriends() {
  var el = document.getElementById('moment-add-friends');
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    momentLoadAddableFriends();
  } else {
    el.style.display = 'none';
  }
}
function momentLoadAddableFriends() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var el = document.getElementById('moment-add-friends');
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
    var already = (window._momentPeople || []).map(function(p){ return p.uid; });
    Promise.all(uids.map(function(uid){ return window.db.collection('users').doc(uid).get(); })).then(function(docs){
      el.innerHTML = docs.map(function(doc){
        var d = doc.data() || {};
        var nm = d.name || 'Friend';
        var isTagged = already.indexOf(doc.id) !== -1;
        if (isTagged) {
          return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;opacity:0.5">' +
            '<div style="width:32px;height:32px;border-radius:50%;background:var(--indigo-light);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--indigo)">' + _escapeHtml(_initialsFallback(nm)) + '</div>' +
            '<div style="flex:1;font-size:13px;font-weight:600;color:var(--black)">' + _escapeHtml(nm) + '</div>' +
            '<div style="font-size:11px;color:var(--subtle)">Already tagged</div>' +
          '</div>';
        }
        return '<div onclick="addMomentFriend(\'' + doc.id + '\',\'' + _escapeHtml(nm).replace(/'/g, "\\'") + '\')" style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer">' +
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
function addMomentFriend(uid, name) {
  if (!window._momentPeople) window._momentPeople = [];
  if (window._momentPeople.some(function(p){ return p.uid === uid; })) return;
  window._momentPeople.push({ name: name, uid: uid });
  renderMomentPeople();
  momentLoadAddableFriends();
}
function removeMomentPerson(i) {
  if (!window._momentPeople) return;
  window._momentPeople.splice(i, 1);
  renderMomentPeople();
}
function renderMomentPeople() {
  var list = document.getElementById('people-list');
  if (!list) return;
  var you = '<div style="display:flex;flex-direction:column;align-items:center;gap:4px">' +
    '<div style="width:48px;height:48px;border-radius:50%;background:var(--indigo-light);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:var(--indigo)">' + _escapeHtml(_initials((window.userData && window.userData.name) || 'You')) + '</div>' +
    '<div style="font-size:10px;color:var(--subtle)">You</div></div>';
  var others = (window._momentPeople || []).map(function(p, i){
    var nm = p.name || '';
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;position:relative">' +
      '<div class="av av-b" style="width:48px;height:48px;font-size:15px">' + _escapeHtml(_initials(nm)) + '</div>' +
      (p.uid ? '<div style="position:absolute;top:-2px;left:-2px;width:16px;height:16px;border-radius:50%;background:var(--indigo);border:2px solid var(--card);display:flex;align-items:center;justify-content:center;font-size:8px;color:white">✓</div>' : '') +
      '<div style="font-size:10px;color:var(--subtle);max-width:52px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(nm.split(' ')[0]) + '</div>' +
      '<div onclick="removeMomentPerson(' + i + ')" style="position:absolute;top:-4px;right:2px;width:18px;height:18px;border-radius:50%;background:var(--loss);color:white;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer">×</div></div>';
  }).join('');
  list.innerHTML = you + others;
}

// ── OUTSIDE LANDS RSVP ──
function oslCheckRsvp() {
  var rsvp = window.userData && window.userData.oslRsvp;
  var overlay = document.getElementById('osl-rsvp-overlay');
  if (window.userData && window.userData.oslActRsvps) {
    myRsvps = window.userData.oslActRsvps;
    if (typeof updateMyFest === 'function') updateMyFest();
  }
  if (!rsvp) {
    if (overlay) { _oslRenderRsvpOverlayCopy(); overlay.style.display = 'flex'; }
  } else {
    if (overlay) overlay.style.display = 'none';
    renderOslState();
  }
}

// The overlay defaults to future-tense "are you going" copy for while the
// festival is still upcoming. If someone opens OSL for the first time
// after it's already happened — never RSVP'd during the live window, so
// never got the memory-conversion path triggered either — this swaps in
// past-tense copy instead so "are you going?" doesn't read as broken.
function _oslRenderRsvpOverlayCopy() {
  var q = document.getElementById('osl-rsvp-question');
  var bGoing = document.getElementById('osl-rsvp-going-btn');
  var bMaybe = document.getElementById('osl-rsvp-maybe-btn');
  var bNo = document.getElementById('osl-rsvp-no-btn');
  var past = _oslHasConcluded();
  if (q) q.textContent = past ? 'Did you go?' : 'Are you going?';
  if (bGoing) bGoing.textContent = past ? "I was there ✓" : "I'm going ✓";
  if (bMaybe) bMaybe.textContent = past ? 'Sort of / part of it' : 'Maybe';
  if (bNo) bNo.textContent = past ? "Wasn't there" : "Can't make it this year";
}

function oslSetRsvp(val) {
  var overlay = document.getElementById('osl-rsvp-overlay');
  if (overlay) overlay.style.display = 'none';
  var prevRsvp = (window.userData && window.userData.oslRsvp) || '';
  window.userData = window.userData || {};
  window.userData.oslRsvp = val;
  renderOslState();
  if (typeof renderCalendar === 'function') renderCalendar();
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (user && window.db) {
    window.db.collection('users').doc(user.uid).set({ oslRsvp: val }, { merge: true }).catch(function(err){ console.error('OSL rsvp error:', err); });
    if (!prevRsvp && val) {
      _postOslFeedNotice({ uid: user.uid, author: (window.userData && window.userData.name) || 'Someone', systemType: 'join' });
    }
    // Setting this retroactively (festival already over) is exactly the
    // case the next-reload-only trigger in auth.onAuthStateChanged misses —
    // fire the conversion check right now too, so it doesn't wait on a
    // reload that may not come for a while.
    if (_oslHasConcluded() && (val === 'going' || val === 'maybe') && typeof _convertOslToMemoryIfNeeded === 'function') {
      _convertOslToMemoryIfNeeded(user, window.userData);
    }
  }
  if (typeof ib_toast === 'function') ib_toast(val === 'going' ? "You're going 🎉" : val === 'maybe' ? 'Marked as maybe' : 'Marked as not going');
  // Dismissing this overlay reveals the Lineup tab underneath, but that
  // reveal happens outside the normal nav() screen transition — the only
  // place scroll containers otherwise get nudged back into working order
  // on iOS. Without this, whoever just RSVP'd (going, maybe, or not going
  // alike) could end up with a Lineup that renders fine but never actually
  // scrolls until a full reload.
  if (typeof _nudgeScrollers === 'function') {
    _nudgeScrollers(document.getElementById('screen-osl-group'));
  }
}

// ── WHO'S GOING / PENDING — reuses the same friend-fetch pattern as
// loadOslFriendRsvps, but classifies everyone (not just per-act) by their
// top-level oslRsvp status so "who hasn't responded yet" has somewhere to live
function openOslAttendees() {
  var box = document.getElementById('osl-attendees-detail');
  if (box) box.style.display = 'flex';
  loadOslAttendees();
}

function closeOslAttendees() {
  var box = document.getElementById('osl-attendees-detail');
  if (box) box.style.display = 'none';
}

function _oslAttendeesEmptyHtml(msg) {
  return '<div style="padding:40px 24px;text-align:center;color:rgba(255,255,255,0.35);font-size:13px">' + _escapeHtml(msg) + '</div>';
}

// Tapping "+" here sends a real friend request without leaving the list —
// entry.friendStatus (computed once in loadOslAttendees) decides whether
// this shows a "+" (not connected yet), a muted "Pending" label (request
// already out, either direction), or nothing at all (already friends).
function _oslAttendeeAddFriend(evt, uid) {
  if (evt) evt.stopPropagation();
  if (typeof sendFriendRequest === 'function') sendFriendRequest(uid);
  var btn = evt && evt.currentTarget;
  if (btn) {
    btn.outerHTML = '<div style="font-size:9.5px;font-weight:700;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.04em;flex-shrink:0;margin-left:10px">Pending</div>';
  }
}

// Accepts right from this list — no need to open their profile first.
function _oslAttendeeAcceptFriend(evt, reqId) {
  if (evt) evt.stopPropagation();
  if (typeof acceptFriendRequest === 'function') acceptFriendRequest(reqId);
  var btn = evt && evt.currentTarget;
  if (btn) {
    btn.outerHTML = '<div style="font-size:9.5px;font-weight:700;color:rgba(126,217,168,0.9);text-transform:uppercase;letter-spacing:0.04em;flex-shrink:0;margin-left:10px">Friends</div>';
  }
}

function _attendeeRowHtml(entry, label, color) {
  var rightExtra = '';
  if (!entry.isMe) {
    if (entry.friendStatus === 'none') {
      rightExtra = '<div onclick="_oslAttendeeAddFriend(event,\'' + entry.uid + '\')" style="width:26px;height:26px;border-radius:50%;background:rgba(168,159,232,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin-left:10px" aria-label="Add friend"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(168,159,232,0.9)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>';
    } else if (entry.friendStatus === 'received') {
      rightExtra = '<div onclick="_oslAttendeeAcceptFriend(event,\'' + entry.friendReqId + '\')" style="font-size:10px;font-weight:800;color:#0D0820;background:#D4A24C;padding:6px 12px;border-radius:10px;cursor:pointer;flex-shrink:0;margin-left:10px;white-space:nowrap">Accept</div>';
    } else if (entry.friendStatus === 'sent') {
      rightExtra = '<div style="font-size:9.5px;font-weight:700;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:0.04em;flex-shrink:0;margin-left:10px">Pending</div>';
    }
  }
  return '<div' + (entry.isMe ? '' : ' onclick="openUserProfile(\'' + entry.uid + '\')"') + ' style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:0.5px solid rgba(255,255,255,0.06)' + (entry.isMe ? '' : ';cursor:pointer') + '">' +
    '<div class="av av-a" style="width:38px;height:38px;font-size:13px;flex-shrink:0">' + _escapeHtml(_initials(entry.name)) + '</div>' +
    '<div style="flex:1;font-size:14px;font-weight:600;color:white">' + _escapeHtml(entry.name) + '</div>' +
    (label ? '<div style="font-size:10px;font-weight:700;color:' + color + ';text-transform:uppercase;letter-spacing:0.05em;flex-shrink:0">' + label + '</div>' : '') +
    rightExtra +
  '</div>';
}

function loadOslAttendees() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var goingBox = document.getElementById('osl-attendees-going');
  if (!user || !window.db) return;
  if (goingBox) goingBox.innerHTML = '<div style="padding:40px 24px;text-align:center;color:rgba(255,255,255,0.35);font-size:13px">Loading…</div>';
  // Everyone in the group, not just the viewer's personal friends — the
  // friend-graph version only showed people who happened to be friends
  // with whoever opened the screen, hiding confirmed attendees who weren't.
  // Also pulls the viewer's existing friendRequests once, so each row can
  // show the right friend-status affordance without a query per person —
  // 'sent' (waiting on them), 'received' (waiting on you — show Accept),
  // 'already', or 'none'.
  Promise.all([
    window.db.collection('users').get(),
    window.db.collection('friendRequests').where('fromUid', '==', user.uid).get(),
    window.db.collection('friendRequests').where('toUid', '==', user.uid).get()
  ]).then(function(results){
    var usersSnap = results[0];
    var relMap = {};
    results[1].forEach(function(d){ var data = d.data(); relMap[data.toUid] = { status: data.status === 'accepted' ? 'already' : 'sent', reqId: d.id }; });
    results[2].forEach(function(d){ var data = d.data(); relMap[data.fromUid] = { status: data.status === 'accepted' ? 'already' : 'received', reqId: d.id }; });

    var going = [], maybe = [];
    usersSnap.forEach(function(doc){
      var d = doc.data() || {};
      var isMe = doc.id === user.uid;
      var rel = relMap[doc.id] || { status: 'none', reqId: null };
      var entry = { uid: doc.id, name: isMe ? 'You' : (d.name || 'Friend'), isMe: isMe, friendStatus: rel.status, friendReqId: rel.reqId };
      if (d.oslRsvp === 'going') going.push(entry);
      else if (d.oslRsvp === 'maybe') maybe.push(entry);
    });
    if (goingBox) {
      if (!going.length && !maybe.length) {
        goingBox.innerHTML = _oslAttendeesEmptyHtml("No one's confirmed yet — be the first.");
      } else {
        goingBox.innerHTML = going.map(function(e){ return _attendeeRowHtml(e, 'Going', 'rgba(168,159,232,0.9)'); }).join('') +
          maybe.map(function(e){ return _attendeeRowHtml(e, 'Maybe', '#FEDF9A'); }).join('');
      }
    }
  }).catch(function(err){
    console.error('Load OSL attendees error:', err);
    if (goingBox) goingBox.innerHTML = _oslAttendeesEmptyHtml('Could not load — check Firestore rules');
  });
}

function renderOslState() {
  var rsvp = (window.userData && window.userData.oslRsvp) || '';
  var name = (window.userData && window.userData.name) || 'You';
  var status = document.getElementById('osl-going-status');
  if (status) {
    if (rsvp === 'going') status.textContent = "You're going · Aug 7–9";
    else if (rsvp === 'maybe') status.textContent = 'Maybe · Aug 7–9 · Golden Gate Park';
    else status.textContent = 'Aug 7–9 · Golden Gate Park';
  }
  var membersEl = document.getElementById('osl-members');
  if (membersEl && window.db) {
    window.db.collection('users').where('oslRsvp', 'in', ['going', 'maybe']).get().then(function(snap){
      var user = window.currentUser || (window.auth && window.auth.currentUser);
      var chips = [];
      snap.forEach(function(doc){
        var d = doc.data();
        var nm = d.name || 'Friend';
        var isMe = user && doc.id === user.uid;
        chips.push('<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0' + (isMe ? '' : ';cursor:pointer') + '"' + (isMe ? '' : ' onclick="openUserProfile(\'' + doc.id + '\')"') + '>' +
          '<div class="m-av-sm av-a">' + _escapeHtml(_initials(nm)) + '</div>' +
          '<div class="m-nm-sm" style="color:rgba(255,255,255,0.5)">' + _escapeHtml(isMe ? 'You' : nm.split(' ')[0]) + '</div></div>');
      });
      membersEl.innerHTML = chips.join('');
    }).catch(function(err){
      console.error('OSL members error:', err);
    });
  }
}
