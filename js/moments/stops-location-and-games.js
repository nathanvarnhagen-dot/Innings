// ── MULTI-STOP EVENTS ──
// An optional "stops" array on any future plan — pregame, the main event,
// afters, or anything custom — each with its own place, photo, and ambient
// animation. One shared editor operates on _stopsEditorList regardless of
// whether it's mounted in the create flow or the edit flow; the caller
// just points _stopsEditorContainerId at whichever container is on screen
// before calling renderStopsEditor(). The live (read-only) detail view is
// separate — see _renderFutureStopsHtml and selectFutureViewStop below,
// which read straight from the saved moment instead of this editor state.
var STOP_TYPE_PRESETS = [
  { type: 'pregame', emoji: '🍻', label: 'Pregame' },
  { type: 'game', emoji: '⚾', label: 'Game' },
  { type: 'afters', emoji: '🎉', label: 'Afters' },
  { type: 'custom', emoji: '🏷️', label: 'Custom' }
];
var STOP_ANIM_OPTIONS = ['twinkle', 'glow', 'confetti', 'gradient', 'none'];
var STOP_ANIM_LABELS = { twinkle: 'Twinkle', glow: 'Glow', confetti: 'Confetti', gradient: 'Gradient', none: 'None' };

window._stopsEditorList = window._stopsEditorList || [];
window._stopsEditorContainerId = window._stopsEditorContainerId || 'stops-editor-create';

function _newStopId() {
  return 'stop_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function _defaultStop(type) {
  var preset = STOP_TYPE_PRESETS.filter(function(p){ return p.type === type; })[0] || STOP_TYPE_PRESETS[3];
  return { id: _newStopId(), type: preset.type, emoji: preset.emoji, name: preset.type === 'custom' ? '' : preset.label, time: '', location: '', coverPhoto: '', anim: 'twinkle' };
}

function addStopToEditor(type) {
  window._stopsEditorList = window._stopsEditorList || [];
  window._stopsEditorList.push(_defaultStop(type));
  renderStopsEditor();
}

function removeStopFromEditor(id) {
  window._stopsEditorList = (window._stopsEditorList || []).filter(function(s){ return s.id !== id; });
  renderStopsEditor();
}

function moveStopInEditor(id, dir) {
  var list = window._stopsEditorList || [];
  var idx = -1;
  for (var i = 0; i < list.length; i++) { if (list[i].id === id) { idx = i; break; } }
  if (idx === -1) return;
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= list.length) return;
  var tmp = list[idx]; list[idx] = list[newIdx]; list[newIdx] = tmp;
  renderStopsEditor();
}

// Only re-fills name/emoji when the name still matches a preset's default
// (or is blank) — so switching a chip never clobbers something the person
// already typed themselves.
function selectStopType(id, type) {
  var list = window._stopsEditorList || [];
  var s = null;
  for (var i = 0; i < list.length; i++) { if (list[i].id === id) { s = list[i]; break; } }
  if (!s) return;
  var preset = STOP_TYPE_PRESETS.filter(function(p){ return p.type === type; })[0] || STOP_TYPE_PRESETS[3];
  var wasDefaultName = !s.name || STOP_TYPE_PRESETS.some(function(p){ return p.label === s.name; });
  s.type = preset.type;
  s.emoji = preset.emoji;
  if (wasDefaultName) s.name = preset.type === 'custom' ? '' : preset.label;
  renderStopsEditor();
}

// Text fields update the array in place without re-rendering — a full
// re-render on every keystroke would drop focus/cursor position mid-type.
function updateStopField(id, field, value) {
  var list = window._stopsEditorList || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) { list[i][field] = value; return; }
  }
}

function selectStopAnim(id, anim) {
  var list = window._stopsEditorList || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) { list[i].anim = anim; break; }
  }
  renderStopsEditor();
}

// Smaller downscale target than the main event cover photo (800 vs 1200)
// since a plan can carry several of these on one doc, well under
// Firestore's 1MB cap.
function previewStopPhoto(id, input) {
  if (!input.files || !input.files[0]) return;
  var list = window._stopsEditorList || [];
  var s = null;
  for (var i = 0; i < list.length; i++) { if (list[i].id === id) { s = list[i]; break; } }
  if (!s) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    _downscaleImage(e.target.result, 800, function(small) {
      s.coverPhoto = small;
      renderStopsEditor();
    });
  };
  reader.readAsDataURL(input.files[0]);
}

function removeStopPhoto(id) {
  var list = window._stopsEditorList || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) { list[i].coverPhoto = ''; break; }
  }
  renderStopsEditor();
}

// Decorative inner markup for one animation preset — shared by the small
// editor swatches and (at larger, inline-overridden sizes) the live stage
// backdrop in _renderFutureStopsHtml.
function _stopAnimSwatchInnerHtml(anim) {
  if (anim === 'twinkle') {
    return '<span class="stop-twinkle-dot" style="width:2.5px;height:2.5px;left:18%;top:28%"></span>' +
      '<span class="stop-twinkle-dot" style="width:2.5px;height:2.5px;left:58%;top:55%;animation-delay:.6s"></span>' +
      '<span class="stop-twinkle-dot" style="width:2.5px;height:2.5px;left:75%;top:18%;animation-delay:1.2s"></span>' +
      '<span class="stop-twinkle-dot" style="width:2.5px;height:2.5px;left:35%;top:65%;animation-delay:1.9s"></span>';
  }
  if (anim === 'glow') {
    return '<span class="stop-glow-orb" style="width:40px;height:40px;left:6%;top:6%"></span>';
  }
  if (anim === 'confetti') {
    return '<span class="stop-confetti-piece" style="left:12%;width:5px;height:8px;background:#F87171"></span>' +
      '<span class="stop-confetti-piece" style="left:42%;width:5px;height:8px;background:#FBBF24;animation-delay:.9s"></span>' +
      '<span class="stop-confetti-piece" style="left:70%;width:5px;height:8px;background:#4ADE80;animation-delay:1.8s"></span>';
  }
  if (anim === 'gradient') {
    return '<div class="stop-anim-gradient-fill"></div>';
  }
  return '';
}

function renderStopsEditor() {
  var container = document.getElementById(window._stopsEditorContainerId);
  if (!container) return;
  var list = window._stopsEditorList || [];
  var cardsHtml = list.map(function(s, i){
    var chipsHtml = STOP_TYPE_PRESETS.map(function(p){
      var active = s.type === p.type;
      return '<div onclick="selectStopType(\'' + s.id + '\',\'' + p.type + '\')" style="padding:7px 12px;border-radius:20px;background:' + (active ? 'var(--indigo-light)' : 'var(--bg)') + ';border:0.5px solid ' + (active ? 'transparent' : 'var(--rule)') + ';font-size:11.5px;font-weight:600;color:' + (active ? 'var(--indigo)' : 'var(--subtle)') + ';cursor:pointer">' + p.emoji + ' ' + p.label + '</div>';
    }).join('');
    var animSwatches = STOP_ANIM_OPTIONS.map(function(a){
      var sel = s.anim === a;
      return '<div onclick="selectStopAnim(\'' + s.id + '\',\'' + a + '\')" class="stop-anim-swatch" style="border-color:' + (sel ? 'var(--indigo)' : 'transparent') + '">' + _stopAnimSwatchInnerHtml(a) + '</div>';
    }).join('');
    var animLabelsHtml = STOP_ANIM_OPTIONS.map(function(a){ return '<span style="width:48px;text-align:center;font-size:8.5px;color:var(--subtle);font-weight:600">' + STOP_ANIM_LABELS[a] + '</span>'; }).join('');
    var photoHtml = s.coverPhoto
      ? '<div style="position:relative"><div style="width:100%;height:90px;border-radius:14px;background-size:cover;background-position:center;background-image:url(' + s.coverPhoto + ')"></div><button onclick="removeStopPhoto(\'' + s.id + '\')" style="position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;background:rgba(10,10,15,0.6);border:none;color:white;font-size:12px;cursor:pointer;font-family:inherit">✕</button></div>'
      : '<div onclick="document.getElementById(\'stop-photo-input-' + s.id + '\').click()" style="background:var(--bg);border:1.5px dashed var(--rule);border-radius:14px;padding:16px;text-align:center;font-size:12px;color:var(--subtle);font-weight:500;cursor:pointer">+ Add a photo</div>';
    var moveUp = i > 0 ? '<div onclick="moveStopInEditor(\'' + s.id + '\',-1)" style="width:26px;height:26px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;color:var(--subtle)">↑</div>' : '';
    var moveDown = i < list.length - 1 ? '<div onclick="moveStopInEditor(\'' + s.id + '\',1)" style="width:26px;height:26px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;color:var(--subtle)">↓</div>' : '';
    return '<div style="background:var(--card);border-radius:18px;padding:16px;margin-bottom:12px;border:1px solid var(--rule)">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' + chipsHtml + '</div>' +
        '<div style="display:flex;gap:2px;flex-shrink:0">' + moveUp + moveDown + '</div>' +
      '</div>' +
      '<div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.07em;margin:13px 0 6px">Name</div>' +
      '<input value="' + _escapeHtml(s.name) + '" oninput="updateStopField(\'' + s.id + '\',\'name\',this.value)" placeholder="Name this stop" style="width:100%;background:var(--bg);border:0.5px solid var(--rule);border-radius:12px;padding:11px 14px;font-size:13.5px;color:var(--black);outline:none;font-family:inherit">' +
      '<div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.07em;margin:13px 0 6px">Time</div>' +
      '<input type="time" value="' + _escapeHtml(s.time) + '" oninput="updateStopField(\'' + s.id + '\',\'time\',this.value)" style="width:100%;background:var(--bg);border:0.5px solid var(--rule);border-radius:12px;padding:11px 14px;font-size:13.5px;color:var(--black);outline:none;font-family:inherit">' +
      '<div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.07em;margin:13px 0 6px">Where</div>' +
      '<input value="' + _escapeHtml(s.location) + '" oninput="updateStopField(\'' + s.id + '\',\'location\',this.value)" placeholder="Add a location" style="width:100%;background:var(--bg);border:0.5px solid var(--rule);border-radius:12px;padding:11px 14px;font-size:13.5px;color:var(--black);outline:none;font-family:inherit">' +
      '<div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.07em;margin:13px 0 6px">Cover photo</div>' +
      '<input type="file" id="stop-photo-input-' + s.id + '" accept="image/*" style="display:none" onchange="previewStopPhoto(\'' + s.id + '\',this)">' +
      photoHtml +
      '<div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.07em;margin:13px 0 6px">Animation</div>' +
      '<div style="display:flex;gap:9px;margin:2px 0 4px">' + animSwatches + '</div>' +
      '<div style="display:flex;gap:9px;margin-bottom:2px">' + animLabelsHtml + '</div>' +
      '<div onclick="removeStopFromEditor(\'' + s.id + '\')" style="margin-top:12px;font-size:11.5px;color:var(--subtle);font-weight:600;cursor:pointer">Remove this stop</div>' +
    '</div>';
  }).join('');

  var addRowHtml = '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
    STOP_TYPE_PRESETS.map(function(p){
      return '<div onclick="addStopToEditor(\'' + p.type + '\')" style="flex:1;min-width:72px;text-align:center;background:var(--indigo-light);color:var(--indigo);font-size:12px;font-weight:700;padding:11px 4px;border-radius:14px;cursor:pointer">+ ' + p.emoji + ' ' + p.label + '</div>';
    }).join('') +
  '</div>';

  container.innerHTML =
    '<div style="font-size:12px;color:var(--subtle);line-height:1.5;margin-bottom:12px">Add stops if your day needs more than one place — pregame, the main event, afters. Optional — skip this and your plan works exactly like it does today.</div>' +
    cardsHtml + addRowHtml;
}

// ── LOCATION PREVIEW + MAP LINKS ──
// No API key gets you a live embedded map anymore — Google retired the
// old keyless embed trick, and the free alternative (OpenStreetMap) needs
// the address geocoded first, which its usage policy explicitly forbids
// wiring up automatically like this. So instead: a clean stylized location
// card plus three deep links that all work with zero setup, using each
// service's own documented, key-free URL scheme.

function _updateLocationLinks(prefix, address) {
  var previewEl = document.getElementById(prefix + '-location-preview');
  var textEl = document.getElementById(prefix + '-location-preview-text');
  var googleEl = document.getElementById(prefix + '-location-google');
  var appleEl = document.getElementById(prefix + '-location-apple');
  var wazeEl = document.getElementById(prefix + '-location-waze');
  if (!previewEl) return;
  var trimmed = (address || '').trim();
  if (!trimmed) { previewEl.style.display = 'none'; return; }
  previewEl.style.display = 'block';
  if (textEl) textEl.textContent = trimmed;
  var encoded = encodeURIComponent(trimmed);
  if (googleEl) googleEl.href = 'https://www.google.com/maps/search/?api=1&query=' + encoded;
  if (appleEl) appleEl.href = 'https://maps.apple.com/?q=' + encoded;
  if (wazeEl) wazeEl.href = 'https://waze.com/ul?q=' + encoded + '&navigate=yes';
}






function headerSaveMoment() {
  if (!window._momentType) return;
  // coming-up plans save from the plan builder now (v7.1.0)
  if (window._stubMode && typeof mnPunch === 'function') { mnPunch(); return; }
  saveNewMoment();
}

function goToStep(n) {
  for (var i = 1; i <= 4; i++) {
    var step = document.getElementById('create-step-' + i);
    var ind = document.getElementById('step-ind-' + i);
    if (step) step.style.display = 'none';
    if (ind) ind.style.background = i <= n ? '#3D3580' : 'var(--rule)';
  }
  var active = document.getElementById('create-step-' + n);
  if (active) {
    active.style.cssText = 'display:flex;flex-direction:column';
  }
  // Scroll to top
  var container = document.getElementById('screen-create-group');
  if (container) {
    var scrollable = container.querySelector('div[style*="overflow-y:auto"], div[style*="overflow-y: auto"]');
    if (scrollable) scrollable.scrollTop = 0;
    else container.scrollTop = 0;
  }
}

var VIBE_EXAMPLES = ['⚾ Game','🎪 Festival','🍽️ Meal','🍺 Hangout','✈️ Trip'];

function renderVibePills() {
  var container = document.getElementById('vibe-pills');
  if (!container) return;
  var custom = (window.userData && window.userData.customVibes) || [];
  var all = VIBE_EXAMPLES.concat(custom.map(function(v){ return (v.emoji || '🏷️') + ' ' + v.label; }));
  container.innerHTML = all.map(function(v){
    return '<div onclick="quickVibe(\'' + v.replace(/'/g, "\\'") + '\')" style="padding:8px 14px;border-radius:20px;background:var(--bg);border:0.5px solid var(--rule);font-size:13px;font-weight:500;color:var(--subtle);cursor:pointer">' + _escapeHtml(v) + '</div>';
  }).join('');
}

function quickVibe(v) {
  var parts = v.split(' ');
  var emoji = parts[0];
  var name = parts.slice(1).join(' ');
  var emojiEl = document.getElementById('vibe-emoji-input');
  var nameEl = document.getElementById('vibe-name-input');
  if (emojiEl) emojiEl.value = emoji;
  if (nameEl) nameEl.value = name;
  window._momentVibe = v;
}

function _syncVibeInput() {
  var emojiEl = document.getElementById('vibe-emoji-input');
  var nameEl = document.getElementById('vibe-name-input');
  var emoji = emojiEl ? emojiEl.value.trim() : '';
  var name = nameEl ? nameEl.value.trim() : '';
  window._momentVibe = name ? (emoji || '🏷️') + ' ' + name : '';
}

function _persistCustomVibeIfNew(vibeStr) {
  if (!vibeStr) return;
  if (VIBE_EXAMPLES.indexOf(vibeStr) !== -1) return;
  window.userData = window.userData || {};
  var list = (window.userData.customVibes || []).slice();
  var already = list.some(function(v){ return (v.emoji || '🏷️') + ' ' + v.label === vibeStr; });
  if (already) return;
  var parts = vibeStr.split(' ');
  var emoji = parts[0];
  var label = parts.slice(1).join(' ').trim();
  if (!label) { label = emoji; emoji = '🏷️'; }
  list.push({ emoji: emoji, label: label });
  window.userData.customVibes = list;
  renderVibePills();
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (user && window.db) {
    window.db.collection('users').doc(user.uid).set({ customVibes: list }, { merge: true })
      .catch(function(err){ console.error('Save custom vibe error:', err); });
  }
}



// ── BOX SCORE (optional attachment on baseball-game moments) ──
// Looks up games via a small Vercel serverless function that proxies the
// public MLB Stats API — a straight browser fetch to statsapi.mlb.com would
// likely hit the same cross-origin issue link previews did.
window._momentBoxScore = null;

function _renderMomentBoxScoreSelected(box) {
  var idleEl = document.getElementById('moment-boxscore-idle');
  var selectedEl = document.getElementById('moment-boxscore-selected');
  if (idleEl) idleEl.style.display = 'none';
  if (selectedEl) {
    selectedEl.style.display = 'block';
    selectedEl.innerHTML = _boxScoreCardHtml(box, false) +
      '<div onclick="momentBoxScoreClear()" style="font-size:12px;color:var(--subtle);font-weight:600;cursor:pointer;margin-top:8px;text-align:center">Remove game</div>';
  }
}

function momentBoxScoreClear() {
  window._momentBoxScore = null;
  var idleEl = document.getElementById('moment-boxscore-idle');
  var selectedEl = document.getElementById('moment-boxscore-selected');
  if (idleEl) idleEl.style.display = 'block';
  if (selectedEl) { selectedEl.style.display = 'none'; selectedEl.innerHTML = ''; }
}

// ── ATTACH BOX SCORE TO AN EXISTING MOMENT (past memory or future plan) ──
// The create-flow above has its own inline widget; this modal covers
// attaching (or replacing) a game after the fact, from the edit view
// of an already-saved moment. context is one of:
//   { type: 'moment', ownerUid, momentId }  — a saved past memory
//   { type: 'future', id }                  — an upcoming plan
window._bsModalContext = null;
window._bsModalSport = 'mlb';
var BS_MODAL_SPORTS = [
  { key: 'mlb', label: '⚾ Baseball' },
  { key: 'nfl', label: '🏈 Football' },
  { key: 'nba', label: '🏀 Basketball' },
  { key: 'wnba', label: '🏀 WNBA' },
  { key: 'nhl', label: '🏒 Hockey' },
  { key: 'mls', label: '⚽ Soccer (MLS)' },
  { key: 'nwsl', label: '⚽ Soccer (NWSL)' }
];
function _renderBsModalSportPills() {
  var wrap = document.getElementById('bs-modal-sport-pills');
  if (!wrap) return;
  wrap.innerHTML = BS_MODAL_SPORTS.map(function(s){
    var on = window._bsModalSport === s.key;
    return '<div onclick="_setBsModalSport(\'' + s.key + '\')" style="flex-shrink:0;padding:8px 14px;border-radius:20px;font-size:12.5px;font-weight:700;cursor:pointer;background:' + (on ? 'var(--indigo)' : 'var(--bg)') + ';color:' + (on ? 'white' : 'var(--subtle)') + ';border:0.5px solid ' + (on ? 'var(--indigo)' : 'var(--rule)') + '">' + s.label + '</div>';
  }).join('');
}
function _setBsModalSport(key) {
  window._bsModalSport = key;
  _renderBsModalSportPills();
  var resultsEl = document.getElementById('bs-modal-results');
  if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }
}
function _bsModalScheduleUrl(sport, date) {
  if (sport === 'mlb') return '/api/mlb?mode=schedule&date=' + encodeURIComponent(date);
  if (sport === 'nhl') return '/api/nhl?mode=schedule&date=' + encodeURIComponent(date);
  return '/api/espn?league=' + encodeURIComponent(sport) + '&mode=schedule&date=' + encodeURIComponent(_toEspnDate(date));
}
function _bsModalBoxscoreUrl(sport, gamePk) {
  if (sport === 'mlb') return '/api/mlb?mode=boxscore&gamePk=' + encodeURIComponent(gamePk);
  if (sport === 'nhl') return '/api/nhl?mode=boxscore&gamePk=' + encodeURIComponent(gamePk);
  return '/api/espn?league=' + encodeURIComponent(sport) + '&mode=boxscore&eventId=' + encodeURIComponent(gamePk);
}
function openBoxScoreModal(context, defaultDate) {
  window._bsModalContext = context;
  window._bsModalSport = 'mlb';
  _renderBsModalSportPills();
  var dateEl = document.getElementById('bs-modal-date');
  if (dateEl) dateEl.value = defaultDate || _todayLocal();
  var resultsEl = document.getElementById('bs-modal-results');
  if (resultsEl) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; }
  var m = document.getElementById('boxscore-modal');
  if (m) m.style.display = 'flex';
}
function closeBoxScoreModal() {
  var m = document.getElementById('boxscore-modal');
  if (m) m.style.display = 'none';
  window._bsModalContext = null;
}
function bsModalSearch() {
  var dateEl = document.getElementById('bs-modal-date');
  var date = dateEl && dateEl.value ? dateEl.value : _todayLocal();
  var resultsEl = document.getElementById('bs-modal-results');
  if (!resultsEl) return;
  var sport = window._bsModalSport || 'mlb';
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = '<div style="font-size:12px;color:var(--subtle);padding:8px 2px">Looking up games on ' + _escapeHtml(date) + '…</div>';
  fetch(_bsModalScheduleUrl(sport, date))
    .then(function(r){ return r.json(); })
    .then(function(data){
      var games = data.games || [];
      if (!games.length) { resultsEl.innerHTML = '<div style="font-size:12px;color:var(--subtle);padding:8px 2px">No games found on that date.</div>'; return; }
      resultsEl.innerHTML = games.map(function(g){
        var scoreLabel = (g.awayScore != null && g.homeScore != null) ? (g.awayScore + '–' + g.homeScore) : (g.status || '');
        return '<div onclick="bsModalSelectGame(' + g.gamePk + ')" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-radius:12px;background:var(--bg);border:0.5px solid var(--rule);margin-bottom:6px;cursor:pointer">' +
          '<div style="font-size:13px;font-weight:600;color:var(--black)">' + _escapeHtml(g.away || '?') + ' @ ' + _escapeHtml(g.home || '?') + '</div>' +
          '<div style="font-size:12px;color:var(--subtle);flex-shrink:0">' + _escapeHtml(String(scoreLabel)) + '</div>' +
        '</div>';
      }).join('');
    })
    .catch(function(err){
      console.error('Schedule lookup error:', err);
      resultsEl.innerHTML = '<div style="font-size:12px;color:var(--subtle);padding:8px 2px">Could not look up games — try again</div>';
    });
}
function bsModalSelectGame(gamePk) {
  var resultsEl = document.getElementById('bs-modal-results');
  if (resultsEl) resultsEl.innerHTML = '<div style="font-size:12px;color:var(--subtle);padding:8px 2px">Loading game…</div>';
  var sport = window._bsModalSport || 'mlb';
  fetch(_bsModalBoxscoreUrl(sport, gamePk))
    .then(function(r){ return r.json(); })
    .then(function(box){ _applyBoxScoreToContext(box); })
    .catch(function(err){
      console.error('Boxscore lookup error:', err);
      if (resultsEl) resultsEl.innerHTML = '<div style="font-size:12px;color:var(--subtle);padding:8px 2px">Could not load — try again</div>';
    });
}
function _applyBoxScoreToContext(box) {
  var ctx = window._bsModalContext;
  closeBoxScoreModal();
  if (!ctx) return;
  box = _sanitizeForFirestore(box);
  // The precise league key (not just a broad bucket) — needed so a later
  // refresh can hit the exact right endpoint. "basketball" alone can't
  // tell a refresh whether to ask ESPN for nba or wnba; the modal already
  // knows exactly which one was searched, so just keep that.
  if (box) box.sport = window._bsModalSport || 'mlb';
  if (ctx.type === 'moment') {
    var m = _findMoment(window._openMomentId);
    if (!m) return;
    m.boxScore = box;
    renderMemoryEdit(m);
    _persistMoment(m, { boxScore: box }, 'Game attached');
  } else if (ctx.type === 'future') {
    if (!window.db) return;
    try {
      window.db.collection('futureMoments').doc(ctx.id).update({ boxScore: box }).then(function(){
        var fm = (window._futureMomentsCache || {})[ctx.id];
        if (fm) { fm.boxScore = box; renderFutureEdit(fm); }
        if (typeof ib_toast === 'function') ib_toast('Game attached');
      }).catch(function(err){
        console.error('Attach game error:', err);
        if (typeof ib_toast === 'function') ib_toast('Could not attach — ' + (err && err.message ? err.message : 'try again'));
      });
    } catch (err) {
      console.error('Attach game threw synchronously:', err);
      if (typeof ib_toast === 'function') ib_toast('Could not attach — ' + (err && err.message ? err.message : 'try again'));
    }
  } else if (ctx.type === 'moment-create') {
    window._momentBoxScore = box;
    var bsSport = window._bsModalSport || 'mlb';
    var bsEmoji = { mlb: '⚾', nfl: '🏈', nba: '🏀', wnba: '🏀', nhl: '🏒', mls: '⚽', nwsl: '⚽' }[bsSport] || '🏆';
    _playSportFlourish(_flourishKeyForBsModalSport(bsSport), function(){
      quickVibe(bsEmoji + ' Game');
      if (typeof _renderMomentBoxScoreSelected === 'function') _renderMomentBoxScoreSelected(box);
    });
  } else if (ctx.type === 'bdayGame') {
    var gs = _bdayStopById('game');
    if (!gs || !window._bdayEventData) return;
    gs.boxScore = box;
    if (window.db) {
      window.db.collection('birthdayEvent').doc('main').set({ stops: _sanitizeForFirestore(window._bdayEventData.stops) }, { merge: true })
        .then(function(){ if (typeof ib_toast === 'function') ib_toast('Game attached'); })
        .catch(function(err){ console.error('Attach birthday game error:', err); if (typeof ib_toast === 'function') ib_toast('Could not attach — try again'); });
    }
    if (window._bdayCurrentStop === 'game') selectBdayStop('game');
  }
}
function futureRemoveBoxScore(id) {
  if (!window.db) return;
  window.db.collection('futureMoments').doc(id).update({ boxScore: null }).then(function(){
    var fm = (window._futureMomentsCache || {})[id];
    if (fm) { fm.boxScore = null; renderFutureEdit(fm); }
    if (typeof ib_toast === 'function') ib_toast('Game removed');
  }).catch(function(err){
    console.error('Remove game error:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not remove — try again');
  });
}

// Shared renderer — used both in the create-moment preview (light card) and
// the memory detail view (frosted dark card over the photo backdrop).
function _ordinalSuffix(n) {
  if (n == null) return '';
  var suf = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (suf[(v - 20) % 10] || suf[v] || suf[0]);
}
