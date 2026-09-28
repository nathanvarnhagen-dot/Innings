// Downscale an image data URL to fit comfortably inside Firestore's 1MB doc limit
function _downscaleImage(dataUrl, maxDim, cb) {
  var img = new Image();
  img.onload = function() {
    var w = img.width, h = img.height;
    if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
    else if (h >= w && h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    try { cb(canvas.toDataURL('image/jpeg', 0.82)); }
    catch (e) { cb(dataUrl); }
  };
  img.onerror = function() { cb(dataUrl); };
  img.src = dataUrl;
}

function previewMainPhoto(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    _downscaleImage(e.target.result, 1000, function(small) {
      window._momentPhoto = small;
      var preview = document.getElementById('main-photo-preview');
      if (!preview) return;
      preview.style.backgroundImage = 'url(' + small + ')';
      preview.style.backgroundSize = 'cover';
      preview.style.backgroundPosition = 'center';
      preview.style.border = 'none';
      preview.querySelectorAll('svg, div').forEach(function(el) { el.style.display = 'none'; });
      var removeBtn = document.getElementById('main-photo-remove');
      if (removeBtn) removeBtn.style.display = 'flex';
    });
  };
  reader.readAsDataURL(input.files[0]);
}

// Clears the picked main photo and puts the "Add a photo" placeholder back
// exactly as it started — shared by the explicit remove button and by
// resetMomentForm() after a save, since both need to undo the same
// hide-everything-but-the-photo state previewMainPhoto() sets up.
function _resetMainPhotoPreviewUI() {
  var preview = document.getElementById('main-photo-preview');
  if (preview) {
    preview.style.backgroundImage = '';
    preview.style.border = '1.5px dashed var(--rule)';
    preview.querySelectorAll('svg, div').forEach(function(el) { el.style.display = ''; });
  }
  var removeBtn = document.getElementById('main-photo-remove');
  if (removeBtn) removeBtn.style.display = 'none';
  var input = document.getElementById('main-photo-input');
  if (input) input.value = '';
}

function removeMainPhoto() {
  window._momentPhoto = '';
  _resetMainPhotoPreviewUI();
}

window._profilePhotos = [];
var PROFILE_PHOTO_MAX = 5;

// Accepts an array of dataURLs, or (legacy) a single dataURL string
function applyProfilePhoto(photos) {
  if (typeof photos === 'string') photos = photos ? [photos] : [];
  window._profilePhotos = (photos || []).slice(0, PROFILE_PHOTO_MAX);
  renderProfilePhotos();
}

function renderProfilePhotos() {
  var slidesBox = document.getElementById('photo-slides');
  var dotsBox = document.getElementById('photo-dots');
  if (!slidesBox) return;
  var photos = window._profilePhotos || [];
  if (!photos.length) {
    slidesBox.innerHTML = '<div class="photo-slide slide-1 active"></div>';
    if (dotsBox) dotsBox.innerHTML = '';
  } else {
    slidesBox.innerHTML = photos.map(function(url, i){
      return '<div class="photo-slide has-photo' + (i === 0 ? ' active' : '') + '" style="background-image:url(' + url + ')"></div>';
    }).join('');
    if (dotsBox) dotsBox.innerHTML = photos.length > 1
      ? photos.map(function(_, i){ return '<div class="pdot' + (i === 0 ? ' active' : '') + '"></div>'; }).join('')
      : '';
  }
  if (typeof _startPhotoRotation === 'function') _startPhotoRotation();
}

function addProfilePhoto(input) {
  if (!input.files || !input.files.length) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var files = Array.from(input.files);
  var current = (window._profilePhotos || []).length;
  var room = PROFILE_PHOTO_MAX - current;
  if (room <= 0) { if (typeof ib_toast==='function') ib_toast('You can save up to ' + PROFILE_PHOTO_MAX + ' photos'); input.value=''; return; }
  files = files.slice(0, room);
  var processed = [], done = 0;
  files.forEach(function(file){
    var reader = new FileReader();
    reader.onload = function(e){
      _downscaleImage(e.target.result, 900, function(small){
        processed.push(small);
        done++;
        if (done === files.length) {
          window._profilePhotos = (window._profilePhotos || []).concat(processed).slice(0, PROFILE_PHOTO_MAX);
          renderProfilePhotos();
          _renderEpPhotosGrid();
          window.userData = window.userData || {};
          window.userData.profilePhotos = window._profilePhotos;
          if (user && window.db) {
            window.db.collection('users').doc(user.uid).set({ profilePhotos: window._profilePhotos }, { merge: true })
              .then(function(){ if (typeof ib_toast==='function') ib_toast(window._profilePhotos.length + ' of ' + PROFILE_PHOTO_MAX + ' photos saved'); })
              .catch(function(err){ console.error('Profile photo error:', err); if (typeof ib_toast==='function') ib_toast('Could not save photo — try again'); });
          }
        }
      });
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}
function showEditProfile() {
  var m=document.getElementById('edit-profile-modal');
  if(m) m.style.display='flex';
  var nameEl = document.getElementById('edit-name');
  var locEl = document.getElementById('edit-location');
  var bioEl = document.getElementById('edit-bio');
  if (nameEl) nameEl.value = (window.userData && window.userData.name) || '';
  if (locEl) locEl.value = (window.userData && window.userData.location) || '';
  if (bioEl) bioEl.value = (window.userData && window.userData.bio) || '';
  _renderEpPhotosGrid();
}
function hideEditProfile() { var m=document.getElementById('edit-profile-modal'); if(m) m.style.display='none'; }
function saveEditProfile() {
  var name=document.getElementById('edit-name').value.trim();
  var loc=document.getElementById('edit-location').value.trim();
  var bio=document.getElementById('edit-bio').value.trim();
  ib_setProfileDisplay(name, loc, bio);
  window.userData = window.userData || {};
  window.userData.name = name;
  window.userData.location = loc;
  window.userData.bio = bio;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (user && window.db) {
    window.db.collection('users').doc(user.uid).set({ name: name, location: loc, bio: bio }, { merge: true })
      .then(function(){ if (typeof ib_toast==='function') ib_toast('Profile updated'); })
      .catch(function(err){ console.error('Save profile error:', err); if (typeof ib_toast==='function') ib_toast('Could not save — try again'); });
  }
  hideEditProfile();
}

// Thumbnail grid inside the edit sheet — each photo removable, plus an
// "add" tile up to the same PROFILE_PHOTO_MAX the header rotation uses.
function _renderEpPhotosGrid() {
  var grid = document.getElementById('ep-photos-grid');
  if (!grid) return;
  var photos = window._profilePhotos || [];
  var tiles = photos.map(function(url, i){
    return '<div style="position:relative;aspect-ratio:1/1;border-radius:10px;overflow:hidden;background-image:url(' + url + ');background-size:cover;background-position:center">' +
      '<button onclick="removeProfilePhoto(' + i + ')" style="position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.55);border:none;color:white;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit">✕</button>' +
    '</div>';
  }).join('');
  var addTile = photos.length < PROFILE_PHOTO_MAX
    ? '<div onclick="document.getElementById(\'ep-photo-input\').click()" style="aspect-ratio:1/1;border-radius:10px;border:1.5px dashed var(--rule);background:var(--bg);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:22px;color:var(--subtle)">+</div>'
    : '';
  grid.innerHTML = tiles + addTile || '<div style="grid-column:1/-1;font-size:12px;color:var(--subtle);padding:8px 0">No photos yet</div>';
}

function removeProfilePhoto(i) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  window._profilePhotos = (window._profilePhotos || []).filter(function(_, idx){ return idx !== i; });
  renderProfilePhotos();
  _renderEpPhotosGrid();
  window.userData = window.userData || {};
  window.userData.profilePhotos = window._profilePhotos;
  if (user && window.db) {
    window.db.collection('users').doc(user.uid).set({ profilePhotos: window._profilePhotos }, { merge: true })
      .catch(function(err){ console.error('Remove profile photo error:', err); if (typeof ib_toast==='function') ib_toast('Could not remove — try again'); });
  }
}
function renderInterests(list) {
  window.userData = window.userData || {};
  window.userData.interests = list || [];
  var c = document.getElementById('interests-container');
  if (!c) return;
  if (!list || !list.length) {
    c.innerHTML = '<div id="interests-empty" style="width:100%;text-align:center;padding:8px 0">' +
      '<div style="font-size:13px;color:rgba(255,255,255,0.45);margin-bottom:8px">Tell people who you are</div>' +
      '<button onclick="showAddInterest()" style="background:rgba(168,159,232,0.16);color:#A89FE8;border:none;border-radius:20px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ Add your first interest</button>' +
    '</div>';
    return;
  }
  c.innerHTML = list.map(function(it, i){
    var emoji = it.emoji || _fallbackInterestEmoji(it.label || '');
    return '<div onclick="removeInterest(' + i + ')" style="display:inline-flex;align-items:center;gap:6px;background:rgba(168,159,232,0.16);border-radius:20px;padding:7px 13px;cursor:pointer">' +
      '<span style="font-size:15px">' + _escapeHtml(emoji) + '</span><span style="font-size:13px;font-weight:600;color:#A89FE8">' + _escapeHtml(it.label || '') + '</span></div>';
  }).join('') +
  '<div id="add-interest-btn" onclick="showAddInterest()" style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.12);border-radius:20px;padding:7px 13px;cursor:pointer"><span style="font-size:13px;color:#A89FE8;font-weight:600">+ Add</span></div>';
}

function showAddInterest() { var m=document.getElementById('add-interest-modal'); if(m) m.style.display='flex'; }
function hideAddInterest() { var m=document.getElementById('add-interest-modal'); if(m) m.style.display='none'; }
function quickInterest(e,l) { document.getElementById('interest-emoji').value=e; document.getElementById('interest-label').value=l; }

function saveInterest() {
  var emojiInput = document.getElementById('interest-emoji').value.trim();
  var label = document.getElementById('interest-label').value.trim();
  if (!label) { hideAddInterest(); return; }
  var emoji = emojiInput || _fallbackInterestEmoji(label);
  window.userData = window.userData || {};
  var list = (window.userData.interests || []).slice();
  list.push({ emoji: emoji, label: label });
  renderInterests(list);
  document.getElementById('interest-emoji').value = '';
  document.getElementById('interest-label').value = '';
  hideAddInterest();
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (user && window.db) {
    window.db.collection('users').doc(user.uid).set({ interests: list }, { merge: true })
      .catch(function(err){ console.error('Save interest error:', err); if (typeof ib_toast==='function') ib_toast('Could not save — try again'); });
  }
}

// Interests added without picking an emoji used to all fall back to the
// same sparkle ✨ — fine once, repetitive and lifeless across a whole list.
// This picks from a small varied set, keyed off the label text itself, so
// the same interest always gets the same fallback but different interests
// don't all look identical.
var _INTEREST_FALLBACK_EMOJIS = ['🏷️','⭐','🎯','🔖','💡','🌟','📌','🧩'];
function _fallbackInterestEmoji(label) {
  var hash = 0;
  for (var i = 0; i < label.length; i++) { hash = (hash * 31 + label.charCodeAt(i)) >>> 0; }
  return _INTEREST_FALLBACK_EMOJIS[hash % _INTEREST_FALLBACK_EMOJIS.length];
}

function removeInterest(i) {
  var list = ((window.userData && window.userData.interests) || []).slice();
  var removed = list[i];
  if (!removed || !confirm('Remove "' + removed.label + '"?')) return;
  list.splice(i, 1);
  renderInterests(list);
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (user && window.db) {
    window.db.collection('users').doc(user.uid).set({ interests: list }, { merge: true })
      .catch(function(err){ console.error('Remove interest error:', err); if (typeof ib_toast==='function') ib_toast('Could not save — try again'); });
  }
}
function addMomentPhotos(input) {
  if(!input.files) return;
  if(!window._momentExtraPhotos) window._momentExtraPhotos=[];
  var files = Array.from(input.files);
  files.forEach(function(file){
    var r=new FileReader(); r.onload=function(e){
      _downscaleImage(e.target.result, 900, function(small){
        window._momentExtraPhotos.push(small);
        renderMomentExtraPhotos();
      });
    }; r.readAsDataURL(file);
  });
  input.value = '';
}

function renderMomentExtraPhotos() {
  var p = document.getElementById('moment-photo-preview');
  if (!p) return;
  var photos = window._momentExtraPhotos || [];
  p.innerHTML = photos.map(function(src, i){
    return '<div style="position:relative;width:68px;height:68px;flex-shrink:0">' +
      '<div style="width:68px;height:68px;border-radius:12px;background-size:cover;background-position:center;background-image:url(' + src + ')"></div>' +
      '<div onclick="removeMomentExtraPhoto(' + i + ')" style="position:absolute;top:-5px;right:-5px;width:19px;height:19px;border-radius:50%;background:var(--loss);color:white;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.25)">×</div>' +
    '</div>';
  }).join('');
}

function removeMomentExtraPhoto(i) {
  if (!window._momentExtraPhotos) return;
  window._momentExtraPhotos.splice(i, 1);
  renderMomentExtraPhotos();
}
