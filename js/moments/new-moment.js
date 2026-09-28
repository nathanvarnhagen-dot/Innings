// ═══ NEW MOMENT (v7.1.0) ════════════════════════════════════════════════
// "It already happened" asks what it was. Games, concerts and festivals get
// a ticket stub (festivals a wristband); anything else goes to the guided
// story (steps 1–4, unchanged). The stub writes into the same fields and
// state the story uses — #moment-name, #moment-date, #highlight-text,
// _momentPeople, _momentPhoto/_momentExtraPhotos, _momentBoxScore,
// _momentVibe — and saves with saveNewMoment(), which adds `stub`.
window._stubMode = null; window._stubData = {};
var MN_KINDS = {
  game:    { e: '\u26be', n: 'A game', d: 'Any sport \u2014 your seat, the final, the big moment', vibe: '\u26be Game', kick: 'ADMIT ONE \u00b7 GAME', cls: 'game', punch: 'Punch the ticket' },
  concert: { e: '\ud83c\udfa4', n: 'A concert', d: 'Your section, the opener, song of the night', vibe: '\ud83c\udfa4 Concert', kick: 'LIVE \u00b7 ADMIT ONE', cls: 'concert', punch: 'Punch the ticket' },
  fest:    { e: '\ud83c\udfaa', n: 'A festival', d: 'The days you went and the sets you saw', vibe: '\ud83c\udfaa Festival', kick: 'GENERAL ADMISSION', cls: 'fest', punch: 'Punch the wristband' },
  other:   { e: '\u2728', n: 'Something else', d: 'A dinner, a trip, a hang \u2014 tell it as a story' }
};
function _mnHideAll() {
  ['create-step-0', 'create-step-1', 'create-step-2', 'create-step-3', 'create-step-4', 'create-step-now', 'create-step-kind', 'create-step-stub'].forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; });
  var ind = document.getElementById('moment-step-indicator'); if (ind) ind.style.display = 'none';
}
function mnShowKind() {
  _mnHideAll();
  window._stubMode = null; window._stubData = {};
  var el = document.getElementById('create-step-kind');
  if (!el) { if (typeof goToStep === 'function') goToStep(1); return; }
  el.innerHTML = '<div style="padding:24px 20px;display:flex;flex-direction:column;gap:14px"><div style="font-size:24px;font-weight:800;color:var(--black);letter-spacing:-.4px">What was it?</div>' +
    '<div style="font-size:13.5px;color:var(--subtle);line-height:1.5">Games, concerts and festivals become a ticket stub you keep. Anything else gets told as a story.</div><div class="mn-kinds">' +
    [['game', 'linear-gradient(160deg,#FD5A1E,#27251F)'], ['concert', 'linear-gradient(160deg,#2B1655,#12091F)'], ['fest', 'linear-gradient(90deg,#1E6F6A,#2A5E9C 50%,#6E3A9C)'], ['other', 'linear-gradient(160deg,#241C4E,#15103A)']].map(function (x) {
      var k = MN_KINDS[x[0]];
      return '<button class="mn-kind' + (x[0] === 'other' ? ' wide' : '') + '" style="background:' + x[1] + '" onclick="mnPickKind(\'' + x[0] + '\')"><span class="e">' + k.e + '</span><span style="display:flex;flex-direction:column;gap:2px"><b>' + k.n + '</b><small>' + k.d + '</small></span></button>';
    }).join('') + '</div><button class="mn-link" onclick="backToStep0()">\u2190 Back</button></div>';
  el.style.display = 'flex';
  _mnScrollTop();
}
function _mnScrollTop() { var c = document.getElementById('screen-create-group'); if (!c) return; var s = c.querySelector('div[style*="overflow-y:auto"], div[style*="overflow-y: auto"]'); (s || c).scrollTop = 0; }
function mnPickKind(k) {
  var stubVibes = [MN_KINDS.game.vibe, MN_KINDS.concert.vibe, MN_KINDS.fest.vibe];
  if (window._momentVibe && stubVibes.indexOf(window._momentVibe) !== -1 && (k === 'other' || MN_KINDS[k].vibe !== window._momentVibe)) {
    window._momentVibe = ''; var ve = document.getElementById('vibe-emoji-input'), vn = document.getElementById('vibe-name-input'); if (ve) ve.value = ''; if (vn) vn.value = '';
  }
  if (k !== 'game' && window._momentBoxScore && typeof momentBoxScoreClear === 'function') momentBoxScoreClear();
  if (k === 'other') {
    window._stubMode = null;
    _mnHideAll();
    var ind = document.getElementById('moment-step-indicator'); if (ind) ind.style.display = 'flex';
    goToStep(1);
    return;
  }
  window._stubMode = k;
  window._stubData = k === 'fest' ? { days: [], sets: [] } : {};
  if (typeof quickVibe === 'function') quickVibe(MN_KINDS[k].vibe);
  var d = document.getElementById('moment-date'); if (d && !d.value) d.value = _todayLocal();
  mnShowStub();
}
function mnShowStub() {
  _mnHideAll();
  var el = document.getElementById('create-step-stub');
  if (!el) return;
  el.style.display = 'flex';
  mnRenderStub();
  _mnScrollTop();
}
function _mnBoxLine(b) {
  if (!b) return '';
  var a = b.away || (b.teams && b.teams.away) || '', h = b.home || (b.teams && b.teams.home) || '';
  var as = b.awayScore != null ? b.awayScore : (b.away_score != null ? b.away_score : null), hs = b.homeScore != null ? b.homeScore : (b.home_score != null ? b.home_score : null);
  var sn = function (x) { return (typeof _teamShortName === 'function' && _teamShortName(x)) || x; };
  if (!a && !h) return 'Game attached';
  return sn(a) + (as != null ? ' ' + as : '') + ' \u00b7 ' + sn(h) + (hs != null ? ' ' + hs : '');
}
function _mnStubBg() {
  var k = window._stubMode, b = window._momentBoxScore;
  if (k !== 'game') return '';
  var col = null;
  try { var ab = b && (b.homeAbbr || (typeof _ghAbbrFallback === 'function' ? _ghAbbrFallback(b.home || '') : '')); if (ab && typeof _ghTeamColors === 'function') col = _ghTeamColors(ab).bg; } catch (e) {}
  col = col || '#FD5A1E';
  return 'background:linear-gradient(160deg,' + col + ' 0%,' + (typeof _fbxDark === 'function' ? _fbxDark(col, .35) : col) + ' 60%,' + (typeof _fbxDark === 'function' ? _fbxDark(col, .65) : '#140A08') + ' 100%)';
}
function mnRenderStub() {
  var el = document.getElementById('create-step-stub');
  if (!el || !window._stubMode) return;
  var k = window._stubMode, K = MN_KINDS[k], D = window._stubData || {};
  var nameEl = document.getElementById('moment-name'), dateEl = document.getElementById('moment-date'), hlEl = document.getElementById('highlight-text');
  var title = nameEl ? nameEl.value : '', date = dateEl ? dateEl.value : '', back = hlEl ? hlEl.value : '';
  var esc = _escapeHtml;
  var fld = function (key, label, ph) { return '<div><span>' + label + '</span><input class="fi" value="' + esc(D[key] || '') + '" placeholder="' + ph + '" oninput="window._stubData.' + key + '=this.value" aria-label="' + label + '"></div>'; };
  var people = (window._momentPeople || []);
  var who = people.map(function (p) { return '<span class="av" title="' + esc(p.name) + '">' + esc(String(p.name || '?').slice(0, 1).toUpperCase()) + '</span>'; }).join('');
  var box = window._momentBoxScore;
  var h = '<div class="mn-stub ' + K.cls + '" id="mn-stub" style="' + _mnStubBg() + '">' + (k === 'concert' ? '<div class="holo"></div>' : '') + (k === 'fest' ? '<div class="weave"></div><div class="clasp"></div>' : '') +
    '<div class="main"><div class="kk">' + K.kick + '</div>' +
    '<input class="tt" value="' + esc(title) + '" placeholder="' + (k === 'game' ? 'Dodgers @ Giants' : k === 'concert' ? 'Who did you see?' : 'Which festival?') + '" oninput="var n=document.getElementById(\'moment-name\');if(n)n.value=this.value" aria-label="Title">' +
    '<div class="subrow"><input class="sub" value="' + esc(D.venue || '') + '" placeholder="' + (k === 'game' ? 'Ballpark / stadium' : 'Venue') + '" oninput="window._stubData.venue=this.value" aria-label="Venue"><input class="sub" type="date" value="' + esc(date) + '" onchange="var d=document.getElementById(\'moment-date\');if(d)d.value=this.value" aria-label="Date"></div>';
  if (k === 'game') {
    h += '<div class="meta">' + fld('section', 'SECTION', '118') + fld('row', 'ROW', '12') + fld('seat', 'SEAT', '4') + '</div>';
    h += box ? '<div class="final"><span>FINAL</span>' + esc(_mnBoxLine(box)) + '<button class="addw" style="margin-left:auto" onclick="mnAttachGame()">Change</button></div>'
      : '<button class="attach" onclick="mnAttachGame()">\ud83c\udfc6 Attach the game \u2014 pulls the final score</button>';
    h += '<div class="final" style="border-top:0;padding-top:4px"><span>BIG MOMENT</span><input class="fi" style="font-size:13px" value="' + esc(D.moment || '') + '" placeholder="Walk-off \u00b7 Bailey" oninput="window._stubData.moment=this.value" aria-label="Big moment"></div>';
  }
  if (k === 'concert') {
    h += '<div class="meta">' + fld('section', 'SECTION', 'GA Floor') + fld('opener', 'OPENER', 'Opener') + fld('tour', 'TOUR', 'Tour name') + '</div>' +
      '<div class="final"><span>SONG OF THE NIGHT</span><input class="fi" style="font-size:13px" value="' + esc(D.song || '') + '" placeholder="\u266a The one everyone sang" oninput="window._stubData.song=this.value" aria-label="Song of the night"></div>';
  }
  if (k === 'fest') {
    var days = ['FRI', 'SAT', 'SUN', 'MON'].slice(0, D.nDays || 3);
    h += '<div class="mn-days">' + days.map(function (d) { var on = (D.days || []).indexOf(d) !== -1; return '<button class="mn-day' + (on ? ' on' : '') + '" onclick="mnDay(\'' + d + '\')" aria-pressed="' + on + '">' + d + (on ? ' \u2713' : '') + '</button>'; }).join('') +
      '<button class="mn-day" onclick="window._stubData.nDays=((window._stubData.nDays||3)%4)+1;mnRenderStub()" aria-label="Change number of days">\u00b1 day</button></div>';
  }
  h += '<div class="punch">KEPT<br>FOREVER</div></div>';
  if (k !== 'fest') h += '<div class="perf"></div>';
  h += '<div class="bottom"><div><div style="font-size:9px;font-weight:800;letter-spacing:.16em;opacity:.7">WITH</div><div class="who">' + who + '<button class="addw" onclick="mnWho()">' + (people.length ? '+ / edit' : '+ Add who was there') + '</button></div></div>' + (k === 'fest' ? '' : '<div class="bars">' + Array.from({ length: 22 }, function (_, i) { return '<i style="width:' + (i % 3 ? 2 : 4) + 'px"></i>'; }).join('') + '</div>') + '</div></div>';
  if (k === 'fest') {
    h += '<div class="mn-card"><div class="q">SETS YOU SAW</div>' + (D.sets || []).map(function (s, i) { return '<div class="mn-set">\u2713 <b>' + esc(s) + '</b><button onclick="window._stubData.sets.splice(' + i + ',1);mnRenderStub()" aria-label="Remove">\u2715</button></div>'; }).join('') +
      '<div style="display:flex;gap:8px"><input id="mn-set-in" placeholder="Add an artist you saw" onkeydown="if(event.key===\'Enter\'){event.preventDefault();mnAddSet()}"><button class="addw" style="border-color:#A89FE8;color:#A89FE8" onclick="mnAddSet()">Add</button></div></div>';
  }
  var photos = [].concat(window._momentPhoto ? [window._momentPhoto] : [], window._momentExtraPhotos || []);
  h += '<div class="mn-card"><div class="q">ON THE BACK</div><textarea rows="3" placeholder="The part you\u2019ll want to remember\u2026" oninput="var t=document.getElementById(\'highlight-text\');if(t)t.value=this.value">' + esc(back) + '</textarea></div>' +
    '<div class="mn-photos">' + photos.map(function (u) { return '<img src="' + esc(typeof u === 'string' ? u : (u && (u.url || u.src)) || '') + '" alt="">'; }).join('') +
    '<button onclick="mnAddPhoto()" aria-label="Add photos">+</button></div>' +
    '<button class="mn-cta" id="mn-punch" onclick="mnPunch()">' + K.punch + '</button><button class="mn-link" onclick="mnShowKind()">\u2190 Not a ' + (k === 'fest' ? 'festival' : k) + '</button>';
  el.innerHTML = '<div style="padding:20px 20px 30px;display:flex;flex-direction:column;gap:14px"><div style="font-size:13px;color:var(--subtle)">Tap anything dashed to fill it in.</div>' + h + '</div>';
}
function mnDay(d) { var a = window._stubData.days = window._stubData.days || []; var i = a.indexOf(d); if (i === -1) a.push(d); else a.splice(i, 1); mnRenderStub(); }
function mnAddSet() { var i = document.getElementById('mn-set-in'); if (!i || !i.value.trim()) return; (window._stubData.sets = window._stubData.sets || []).push(i.value.trim()); mnRenderStub(); setTimeout(function () { var n = document.getElementById('mn-set-in'); if (n) n.focus(); }, 30); }
function mnAttachGame() { var d = document.getElementById('moment-date'); openBoxScoreModal({ type: 'moment-create' }, d ? d.value : ''); }
function mnWho() { _mnHideAll(); goToStep(2); }
function mnAddPhoto() {
  // the main photo first, then more — same inputs the story uses
  var inp = document.getElementById(window._momentPhoto ? 'moment-photos' : 'main-photo-input');
  if (!inp) return;
  var once = function () { inp.removeEventListener('change', once); [400, 1200, 2500].forEach(function (t) { setTimeout(function () { if (window._stubMode) mnRenderStub(); }, t); }); };
  inp.addEventListener('change', once);
  inp.click();
}
function mnPunch() {
  var n = document.getElementById('moment-name');
  if (!n || !n.value.trim()) { if (typeof ib_toast === 'function') ib_toast('Give it a title first'); var t = document.querySelector('#mn-stub .tt'); if (t) t.focus(); return; }
  var s = document.getElementById('mn-stub'), b = document.getElementById('mn-punch');
  if (b) b.disabled = true;
  if (s) s.classList.add('saved');
  setTimeout(function () { saveNewMoment(); if (b) b.disabled = false; }, 750);
}
function mnNowTyped() {
  var i = document.getElementById('now-typed');
  var v = i ? i.value.trim() : '';
  if (!v) { if (i) i.focus(); return; }
  window._nowPinLabel = v;
  _proceedToMemoryForm();
}
// the guided story's steps know about the stub: "Who was there" comes back to it
(function () {
  if (typeof goToStep === 'function') {
    var orig = goToStep;
    goToStep = function (n) {
      if (window._stubMode && (n === 1 || n === 3)) { var s2 = document.getElementById('create-step-2'); if (s2) s2.style.display = 'none'; mnShowStub(); return; }
      var r = orig.apply(this, arguments);
      var ind = document.getElementById('moment-step-indicator'); if (ind && window._stubMode) ind.style.display = 'none';
      return r;
    };
  }
  if (typeof _renderMomentBoxScoreSelected === 'function') {
    var origB = _renderMomentBoxScoreSelected;
    _renderMomentBoxScoreSelected = function (box) {
      var r = origB.apply(this, arguments);
      if (window._stubMode === 'game') {
        var n = document.getElementById('moment-name');
        if (n && !n.value.trim() && box) { var sn = function (x) { return (typeof _teamShortName === 'function' && _teamShortName(x)) || x; }; if (box.away && box.home) n.value = sn(box.away) + ' @ ' + sn(box.home); }
        if (box && box.venue && !window._stubData.venue) window._stubData.venue = box.venue;
        var st = document.getElementById('create-step-stub'); if (st && st.style.display !== 'none') mnRenderStub();
      }
      return r;
    };
  }
  if (typeof backToStep0 === 'function') {
    var origBk = backToStep0;
    backToStep0 = function () { window._stubMode = null; window._stubData = {}; ['create-step-kind', 'create-step-stub'].forEach(function (id) { var el = document.getElementById(id); if (el) el.style.display = 'none'; }); return origBk.apply(this, arguments); };
  }
})();


// the memory screen shows its stub, punched, at the top (v7.1.0)
function _mnStubViewHtml(m) {
  var st = m && m.stub; if (!st || !MN_KINDS[st.kind]) return '';
  var K = MN_KINDS[st.kind], esc = _escapeHtml, b = m.boxScore;
  var bg = '';
  if (st.kind === 'game') { var col = null; try { var ab = b && (b.homeAbbr || _ghAbbrFallback(b.home || '')); if (ab) col = _ghTeamColors(ab).bg; } catch (e) {} col = col || '#FD5A1E'; bg = 'background:linear-gradient(160deg,' + col + ' 0%,' + _fbxDark(col, .35) + ' 60%,' + _fbxDark(col, .65) + ' 100%)'; }
  var cell = function (l, v) { return v ? '<div><span>' + l + '</span><b style="font-size:15px">' + esc(v) + '</b></div>' : ''; };
  var d = m.date ? new Date(m.date + 'T12:00').toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '';
  var h = '<div class="mn-stub ' + K.cls + ' saved" style="' + bg + ';margin:0 0 14px">' + (st.kind === 'concert' ? '<div class="holo"></div>' : '') + (st.kind === 'fest' ? '<div class="weave"></div><div class="clasp"></div>' : '') +
    '<div class="main"><div class="kk">' + K.kick + '</div><div style="font-size:26px;font-weight:900;font-style:italic;line-height:1.1;margin-top:6px">' + esc(m.name || '') + '</div>' +
    '<div style="font-size:13px;font-weight:700;opacity:.9;margin-top:4px">' + esc([st.venue, d].filter(Boolean).join(' \u00b7 ')) + '</div>';
  if (st.kind === 'game') h += '<div class="meta">' + cell('SECTION', st.section) + cell('ROW', st.row) + cell('SEAT', st.seat) + '</div>' + (b ? '<div class="final"><span>FINAL</span>' + esc(_mnBoxLine(b)) + (st.moment ? '<span style="margin-left:auto;font-size:12px;letter-spacing:0;opacity:.9">' + esc(st.moment) + '</span>' : '') + '</div>' : '');
  if (st.kind === 'concert') h += '<div class="meta">' + cell('SECTION', st.section) + cell('OPENER', st.opener) + cell('TOUR', st.tour) + '</div>' + (st.song ? '<div class="final"><span>SONG OF THE NIGHT</span>\u266a ' + esc(st.song) + '</div>' : '');
  if (st.kind === 'fest') h += (st.days && st.days.length ? '<div class="mn-days">' + st.days.map(function (x) { return '<span class="mn-day on">' + esc(x) + ' \u2713</span>'; }).join('') + '</div>' : '') + (st.sets && st.sets.length ? '<div style="margin-top:10px;font-size:12.5px;font-weight:700;opacity:.9">' + st.sets.map(esc).join(' \u00b7 ') + '</div>' : '');
  h += '<div class="punch">KEPT<br>FOREVER</div></div></div>';
  return h;
}
(function () {
  if (typeof renderMemoryView !== 'function') return;
  var orig = renderMemoryView;
  renderMemoryView = function (m) {
    var r = orig.apply(this, arguments);
    try {
      var scroll = document.getElementById('md-scroll'), html = _mnStubViewHtml(m);
      var old = document.getElementById('md-stub'); if (old) old.remove();
      if (scroll && html) { var w = document.createElement('div'); w.id = 'md-stub'; w.style.cssText = 'padding:0 16px'; w.innerHTML = html; scroll.insertBefore(w, scroll.firstChild); }
    } catch (e) { console.error('[stub view]', e); }
    return r;
  };
})();
