// ── OUTSIDE LANDS SHARED PHOTOS ── merges the general oslPhotos album with
// every artist's actPhotos, so a photo added on Charli XCX's page (or any
// other act) also shows up here, not just photos added directly to this tab.
window._oslPhotosStarted = false;
window._oslPhotosRaw = [];
window._actPhotosRaw = [];
function startOslPhotos() {
  if (window._oslPhotosStarted) return;
  if (!window.db) return;
  window._oslPhotosStarted = true;
  window.db.collection('oslPhotos').orderBy('ts', 'desc').limit(120).onSnapshot(function(snap){
    var arr = [];
    snap.forEach(function(doc){ arr.push(Object.assign({ _id: doc.id, _source: 'osl' }, doc.data())); });
    window._oslPhotosRaw = arr;
    _mergeAndRenderOslPhotos();
  }, function(err){
    console.error('OSL photos error:', err);
    window._oslPhotosStarted = false;
    if (typeof ib_toast==='function') ib_toast('Photos unavailable — check Firestore rules');
  });
  window.db.collection('actPhotos').orderBy('ts', 'desc').limit(200).onSnapshot(function(snap){
    var arr = [];
    snap.forEach(function(doc){ arr.push(Object.assign({ _id: doc.id, _source: 'act' }, doc.data())); });
    window._actPhotosRaw = arr;
    _mergeAndRenderOslPhotos();
  }, function(err){
    console.error('Act photos (merged into OSL Photos) error:', err);
  });
}

function _mergeAndRenderOslPhotos() {
  var merged = (window._oslPhotosRaw || []).concat(window._actPhotosRaw || []);
  merged.sort(function(a, b){ return (b.ts || 0) - (a.ts || 0); });
  window._oslPhotosData = merged;
  renderOslPhotos(merged);
}

function renderOslPhotos(photos) {
  var grid = document.getElementById('osl-photos-grid');
  var empty = document.getElementById('osl-photos-empty');
  if (!grid) return;
  if (empty) empty.style.display = photos.length ? 'none' : 'flex';
  grid.style.display = photos.length ? 'grid' : 'none';
  grid.innerHTML = photos.map(function(p, i){
    var selMode = window._oslSelectMode;
    var selected = selMode && !!window._oslSelected[p._id];
    var tapHandler = selMode ? 'oslPhotosToggleOne(\'' + p._id + '\')' : 'openOslPhoto(' + i + ')';
    var check = selMode
      ? '<div style="position:absolute;top:5px;right:5px;width:20px;height:20px;border-radius:50%;background:' + (selected ? 'var(--indigo)' : 'rgba(0,0,0,0.4)') + ';border:1.5px solid rgba(255,255,255,0.85);display:flex;align-items:center;justify-content:center;font-size:11px;color:white;font-weight:700">' + (selected ? '✓' : '') + '</div>'
      : '';
    return '<div onclick="' + tapHandler + '" style="position:relative;width:100%;aspect-ratio:1/1;border-radius:10px;background-image:url(' + p.photo + ');background-size:cover;background-position:center;cursor:pointer;' + (selected ? 'outline:3px solid var(--indigo);outline-offset:-3px' : '') + '">' + check + '</div>';
  }).join('');
}

window._oslSelectMode = false;
window._oslSelected = {};

function oslPhotosEnterSelect() {
  window._oslSelectMode = true;
  window._oslSelected = {};
  var btn = document.getElementById('osl-select-btn');
  var bar = document.getElementById('osl-select-bar');
  if (btn) btn.style.display = 'none';
  if (bar) bar.style.display = 'flex';
  _oslUpdateSelectCount();
  renderOslPhotos(window._oslPhotosData || []);
}

function oslPhotosExitSelect() {
  window._oslSelectMode = false;
  window._oslSelected = {};
  var btn = document.getElementById('osl-select-btn');
  var bar = document.getElementById('osl-select-bar');
  if (btn) btn.style.display = 'inline-block';
  if (bar) bar.style.display = 'none';
  renderOslPhotos(window._oslPhotosData || []);
}

function oslPhotosToggleOne(id) {
  if (window._oslSelected[id]) delete window._oslSelected[id];
  else window._oslSelected[id] = true;
  _oslUpdateSelectCount();
  renderOslPhotos(window._oslPhotosData || []);
}

function oslPhotosSelectAll() {
  var photos = window._oslPhotosData || [];
  var allSelected = photos.length > 0 && photos.every(function(p){ return window._oslSelected[p._id]; });
  window._oslSelected = {};
  if (!allSelected) photos.forEach(function(p){ window._oslSelected[p._id] = true; });
  _oslUpdateSelectCount();
  renderOslPhotos(photos);
}

function _oslUpdateSelectCount() {
  var n = Object.keys(window._oslSelected).length;
  var btn = document.getElementById('osl-download-selected-btn');
  if (btn) btn.textContent = '⬇ Download (' + n + ')';
}

function oslPhotosDownloadSelected() {
  var photos = window._oslPhotosData || [];
  var chosen = photos.filter(function(p){ return window._oslSelected[p._id]; });
  if (!chosen.length) { if (typeof ib_toast==='function') ib_toast('Select at least one photo'); return; }
  _saveAllToCameraRoll(chosen.map(function(p, i){ return { src: p.photo, name: 'innings-osl-' + (i + 1) + '.jpg' }; }));
  oslPhotosExitSelect();
}

function openOslPhoto(i) {
  var photos = window._oslPhotosData || [];
  var p = photos[i];
  if (!p) return;
  window._oslPhotoViewerIndex = i;
  var img = document.getElementById('osl-photo-viewer-img');
  var del = document.getElementById('osl-photo-viewer-delete');
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (img) img.src = p.photo;
  window._oslPhotoViewerSrc = p.photo;
  if (del) del.style.display = (user && p.uid === user.uid) ? 'block' : 'none';
  var viewer = document.getElementById('osl-photo-viewer');
  if (viewer) viewer.style.display = 'flex';
}

function oslPhotoDownload() {
  var src = window._oslPhotoViewerSrc;
  if (!src) return;
  fetch(src).then(function(res){ return res.blob(); }).then(function(blob){
    var file = new File([blob], 'innings-photo.jpg', { type: blob.type || 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(function(){});
    } else {
      var a = document.createElement('a');
      a.href = src;
      a.download = 'innings-photo.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (typeof ib_toast === 'function') ib_toast('Downloaded — check your Files or Downloads');
    }
  }).catch(function(err){
    console.error('Photo download error:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not download — try pressing and holding the photo instead');
  });
}

// Shared helper: takes an array of {src, name} and saves them all to the camera roll
// in one go via the native share sheet (iOS/Android), or falls back to staggered
// browser downloads on desktop where the multi-file share sheet isn't available.
function _saveAllToCameraRoll(items) {
  if (!items || !items.length) { if (typeof ib_toast === 'function') ib_toast('No photos to save'); return; }
  if (typeof ib_toast === 'function') ib_toast('Preparing ' + items.length + ' photo' + (items.length === 1 ? '' : 's') + '…');
  Promise.all(items.map(function(item){
    return fetch(item.src).then(function(res){ return res.blob(); }).then(function(blob){
      return new File([blob], item.name, { type: blob.type || 'image/jpeg' });
    });
  })).then(function(files){
    if (navigator.canShare && navigator.canShare({ files: files })) {
      navigator.share({ files: files }).catch(function(){});
    } else {
      files.forEach(function(file, i){
        setTimeout(function(){
          var url = URL.createObjectURL(file);
          var a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
        }, i * 350);
      });
      if (typeof ib_toast === 'function') ib_toast('Downloading ' + files.length + ' photos…');
    }
  }).catch(function(err){
    console.error('Save all photos error:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not save all — try saving one at a time');
  });
}

function oslPhotosSaveAll() {
  var photos = window._oslPhotosData || [];
  _saveAllToCameraRoll(photos.map(function(p, i){ return { src: p.photo, name: 'innings-osl-' + (i + 1) + '.jpg' }; }));
}

function mdPhotosSaveAll() {
  var m = _findMoment(window._openMomentId); if (!m) return;
  var allPhotos = (m.photo ? [m.photo] : []).concat(m.photos || []);
  _saveAllToCameraRoll(allPhotos.map(function(p, i){ return { src: p, name: 'innings-memory-' + (i + 1) + '.jpg' }; }));
}

function oslPhotoNav(delta) {
  var photos = window._oslPhotosData || [];
  var newIndex = (window._oslPhotoViewerIndex || 0) + delta;
  if (newIndex < 0 || newIndex >= photos.length) return;
  openOslPhoto(newIndex);
}

var _oslSwipeStartX = null;
function oslPhotoSwipeStart(e) {
  if (e.touches && e.touches.length === 1) _oslSwipeStartX = e.touches[0].clientX;
}
function oslPhotoSwipeEnd(e) {
  if (_oslSwipeStartX === null) return;
  var endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : _oslSwipeStartX;
  var delta = endX - _oslSwipeStartX;
  _oslSwipeStartX = null;
  if (Math.abs(delta) < 40) return;
  oslPhotoNav(delta < 0 ? 1 : -1);
}

function closeOslPhoto() {
  var viewer = document.getElementById('osl-photo-viewer');
  if (viewer) viewer.style.display = 'none';
}

function deleteOslPhoto() {
  var photos = window._oslPhotosData || [];
  var p = photos[window._oslPhotoViewerIndex];
  if (!p || !p._id || !window.db) return;
  var collection = p._source === 'act' ? 'actPhotos' : 'oslPhotos';
  window.db.collection(collection).doc(p._id).delete()
    .then(function(){ closeOslPhoto(); if (typeof ib_toast==='function') ib_toast('Photo deleted'); })
    .catch(function(err){ console.error('Delete photo error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}

function addOslPhoto(input) {
  if (!input.files || !input.files.length) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in to add photos'); return; }
  var author = (window.userData && window.userData.name) || 'You';
  var files = Array.from(input.files);
  if (typeof ib_toast==='function') ib_toast('Uploading…');
  _postOslFeedNotice({ uid: user.uid, author: author, systemType: 'photo', photoCount: files.length });
  files.forEach(function(file){
    var reader = new FileReader();
    reader.onload = function(e){
      _downscaleImage(e.target.result, 1000, function(small){
        window.db.collection('oslPhotos').add({ uid: user.uid, author: author, photo: small, ts: Date.now() })
          .catch(function(err){ console.error('Add photo error:', err); if (typeof ib_toast==='function') ib_toast('Photos unavailable — check Firestore rules'); });
      });
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}
