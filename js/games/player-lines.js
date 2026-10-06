// ═══ PLAYER SHEET: STAT LINES + OPEN ANIMATION (v7.14.0) ══════════════
// The top of the player sheet is a small table: his postseason line (once
// he has one), the regular season, then the last 7, 14 and 30 days
// (/api/mlb?mode=splits — those windows add postseason games in).
// Opening the sheet: the name you tapped lifts off the page and flies into
// the sheet's title while the sheet springs up; the rows fall in under it.
// Depends on: openPlayerLinkSheet (games-list.js), _savGet,
// _savSeasonData (statcast.js), _escapeHtml.

window._sav = window._sav || { pending: {} };
window._sav.splits = window._sav.splits || {};

function _plsSplits(id, onArrive) {
  if (!id || typeof _savGet !== 'function') return null;
  return _savGet('splits', String(id), '/api/mlb?mode=splits&id=' + encodeURIComponent(id), 15 * 60e3, onArrive);
}
function _plsLinesHtml(id) {
  var want = String(id);
  var again = function () { if (window._savSheetId === want) _plsLinesFill(id); };
  var d = typeof _savSeasonData === 'function' ? _savSeasonData(id, again) : null;
  var sp = _plsSplits(id, again);
  var e = window._sav.season && window._sav.season[want];
  if (!d && !(e && e.failed)) return '<div class="pll pll-wait"><div class="pll-meta">&nbsp;</div>' + new Array(5).join('<div class="pll-r"><span></span></div>') + '</div>';
  if (!d || d.error) return '';
  var pitcher = !!(d.pitching && (d.pos === 'P' || !d.hitting));
  var role = pitcher ? 'pitching' : 'hitting';
  var cols = pitcher ? [['ERA', 'era'], ['IP', 'ip'], ['K', 'k'], ['BB', 'bb'], ['WHIP', 'whip']] : [['AVG', 'avg'], ['OBP', 'obp'], ['SLG', 'slg'], ['HR', 'hr'], ['RBI', 'rbi']];
  var rows = [];
  if (sp && sp.post && sp.post[role]) rows.push({ label: 'Postseason', v: sp.post[role], post: true });
  rows.push({ label: 'Regular season', v: d[role], season: true });
  [['last7', 'Last 7 days'], ['last14', 'Last 14 days'], ['last30', 'Last 30 days']].forEach(function (w) {
    rows.push({ label: w[1], v: sp ? (sp[w[0]] && sp[w[0]][role]) : undefined, wait: !sp });
  });
  var meta = [d.hand && d.pos === 'P' ? d.hand + 'HP' : d.pos, d.team].filter(Boolean).join(' · ');
  var h = '<div class="pll"><div class="pll-meta">' + _escapeHtml(meta) + '</div>';
  h += '<div class="pll-r pll-h"><span>' + _escapeHtml(String(d.season || '')) + '</span>' + cols.map(function (c) { return '<b>' + c[0] + '</b>'; }).join('') + '</div>';
  rows.forEach(function (r, i) {
    var cells = cols.map(function (c) {
      var x = r.v && r.v[c[1]];
      return '<b>' + (r.wait ? '<i class="pll-dot"></i>' : (x == null || x === '' ? '—' : _escapeHtml(String(x)))) + '</b>';
    }).join('');
    var g = r.v && r.v.g != null ? '<small>' + r.v.g + ' G</small>' : (!r.wait && !r.v ? '<small>No games</small>' : '');
    h += '<div class="pll-r' + (r.post ? ' post' : '') + (r.season ? ' ssn' : '') + '" style="animation-delay:' + (0.12 + i * 0.04).toFixed(2) + 's"><span>' + _escapeHtml(r.label) + g + '</span>' + cells + '</div>';
  });
  return h + '</div>';
}
function _plsLinesFill(id) {
  var el = document.getElementById('player-lines');
  if (!el) return;
  el.innerHTML = _plsLinesHtml(id);
}

// ── the tapped name flies into the sheet's title
function _plsFlip(src, name) {
  var nameEl = document.getElementById('player-link-name');
  if (!nameEl) return;
  nameEl.innerHTML = '<span class="pls-nm">' + _escapeHtml(name || '') + '</span>';
  var tgt = nameEl.firstChild;
  var reduce = typeof _ghReducedMotion === 'function' && _ghReducedMotion();
  if (!src || reduce || !src.getBoundingClientRect || !tgt.animate) return;
  var sr = src.getBoundingClientRect();
  if (!sr.width || !sr.height || sr.bottom < 0 || sr.top > (window.innerHeight || 2000)) return;
  var sheet = document.querySelector('#player-link-backdrop > div');
  var dy0 = 0;
  try { var tf = sheet ? getComputedStyle(sheet).transform : 'none'; if (tf && tf !== 'none' && window.DOMMatrixReadOnly) dy0 = new DOMMatrixReadOnly(tf).m42; } catch (e) { dy0 = 0; }
  var tr = tgt.getBoundingClientRect();
  var tcs = getComputedStyle(tgt);
  var ghost = document.createElement('div');
  ghost.className = 'pls-ghost';
  ghost.textContent = name || '';
  ghost.style.fontSize = tcs.fontSize; ghost.style.fontWeight = tcs.fontWeight; ghost.style.fontFamily = tcs.fontFamily; ghost.style.letterSpacing = tcs.letterSpacing;
  document.body.appendChild(ghost);
  var W = ghost.offsetWidth || tr.width, H = ghost.offsetHeight || tr.height;
  var sx = sr.left + sr.width / 2 - W / 2, sy = sr.top + sr.height / 2 - H / 2;
  var ex = tr.left + tr.width / 2 - W / 2, ey = tr.top - dy0 + tr.height / 2 - H / 2;
  var k0 = Math.max(.35, Math.min(1.4, sr.height / H));
  tgt.style.opacity = '0';
  src.classList.add('pls-src');
  var a = ghost.animate([
    { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(' + k0 + ')', opacity: .95, offset: 0 },
    { transform: 'translate(' + (sx + (ex - sx) * .55) + 'px,' + (sy + (ey - sy) * .5 - 26) + 'px) scale(' + (k0 + (1 - k0) * .7) + ')', opacity: 1, offset: .55 },
    { transform: 'translate(' + ex + 'px,' + ey + 'px) scale(1)', opacity: 1, offset: 1 }
  ], { duration: 520, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'forwards' });
  var done = function () { tgt.style.opacity = ''; if (ghost.parentNode) ghost.parentNode.removeChild(ghost); src.classList.remove('pls-src'); };
  a.onfinish = done;
  setTimeout(done, 900);
}

(function () {
  if (typeof openPlayerLinkSheet !== 'function') return;
  var orig = openPlayerLinkSheet;
  openPlayerLinkSheet = function (name, id, league) {
    var ev = window.event, src = null;
    if (ev) {
      src = ev.currentTarget && ev.currentTarget.getBoundingClientRect ? ev.currentTarget : null;
      if (!src && ev.target && ev.target.closest) src = ev.target.closest('[data-name]');
    }
    if (src && src.closest && src.closest('#player-link-backdrop')) src = null; // tapped from inside the sheet
    var r = orig.apply(this, arguments);
    var lines = document.getElementById('player-lines');
    if (lines) { if (league === 'mlb' && id) _plsLinesFill(id); else lines.innerHTML = ''; }
    window._plsSrc = src; window._plsSrcId = id != null ? String(id) : null;
    try { _plsFlip(src, name); } catch (e) { console.error('[player sheet]', e); }
    return r;
  };
})();

// ── v7.14.2: closing is the open in reverse — the sheet slides away and
// the name flies back to where it was tapped (or the same player's name if
// the page re-rendered meanwhile). Drag the sheet down to close it too.
function _plsBackTarget() {
  var src = window._plsSrc;
  if (src && document.body.contains(src)) return src;
  var id = window._plsSrcId;
  if (!id) return null;
  var list = document.querySelectorAll('.screen.active [data-id="' + id.replace(/"/g, '') + '"]');
  for (var i = 0; i < list.length; i++) { var r = list[i].getBoundingClientRect(); if (r.width && r.bottom > 0 && r.top < (window.innerHeight || 2000)) return list[i]; }
  return null;
}
function _plsFlyBack() {
  var nm = document.querySelector('#player-link-name .pls-nm'), dst = _plsBackTarget();
  if (!nm || !dst || !nm.animate) return;
  var a = nm.getBoundingClientRect(), b = dst.getBoundingClientRect();
  if (!a.width || !b.width) return;
  var cs = getComputedStyle(nm);
  var ghost = document.createElement('div');
  ghost.className = 'pls-ghost';
  ghost.textContent = nm.textContent;
  ghost.style.fontSize = cs.fontSize; ghost.style.fontWeight = cs.fontWeight; ghost.style.fontFamily = cs.fontFamily; ghost.style.letterSpacing = cs.letterSpacing;
  document.body.appendChild(ghost);
  var W = ghost.offsetWidth || a.width, H = ghost.offsetHeight || a.height;
  var sx = a.left + a.width / 2 - W / 2, sy = a.top + a.height / 2 - H / 2;
  var ex = b.left + b.width / 2 - W / 2, ey = b.top + b.height / 2 - H / 2;
  var k1 = Math.max(.35, Math.min(1.4, b.height / H));
  nm.style.opacity = '0';
  dst.classList.add('pls-src');
  var an = ghost.animate([
    { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(1)', opacity: 1 },
    { transform: 'translate(' + (sx + (ex - sx) * .45) + 'px,' + (sy + (ey - sy) * .5 - 22) + 'px) scale(' + (1 + (k1 - 1) * .4) + ')', opacity: 1, offset: .45 },
    { transform: 'translate(' + ex + 'px,' + ey + 'px) scale(' + k1 + ')', opacity: .9 }
  ], { duration: 400, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
  var done = function () {
    if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    dst.classList.remove('pls-src');
  };
  an.onfinish = function () {
    // the real name fades back in under the ghost
    dst.style.transition = 'opacity .18s'; dst.classList.remove('pls-src');
    ghost.animate([{ opacity: .9 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).onfinish = done;
  };
  setTimeout(done, 900);
}
(function () {
  if (typeof closePlayerLinkSheet !== 'function') return;
  closePlayerLinkSheet = function () {
    var backdrop = document.getElementById('player-link-backdrop');
    if (!backdrop || backdrop.style.display === 'none' || backdrop.classList.contains('pls-out')) return;
    window._savSheetId = null;
    var sheet = backdrop.firstElementChild;
    var reduce = typeof _ghReducedMotion === 'function' && _ghReducedMotion();
    if (reduce) { backdrop.style.display = 'none'; if (sheet) sheet.style.transform = ''; return; }
    try { _plsFlyBack(); } catch (e) { console.error('[player sheet]', e); }
    // a drag may have left the sheet part-way down: slide on from there
    var from = sheet && sheet.style.transform ? sheet.style.transform : 'translateY(0px)';
    if (sheet && sheet.animate) {
      sheet.style.transition = '';
      sheet.animate([{ transform: from }, { transform: 'translateY(105%)' }], { duration: 360, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
    }
    clearTimeout(window._plsCloseT);
    backdrop.classList.remove('pls-in'); backdrop.classList.add('pls-out');
    window._plsCloseT = setTimeout(function () {
      backdrop.style.display = 'none'; backdrop.classList.remove('pls-out');
      if (sheet) { sheet.style.transform = ''; if (sheet.getAnimations) sheet.getAnimations().forEach(function (x) { x.cancel(); }); }
      var nm = document.querySelector('#player-link-name .pls-nm'); if (nm) nm.style.opacity = '';
    }, 380);
  };
})();
// drag down from the top of the sheet to close it
(function () {
  var backdrop = document.getElementById('player-link-backdrop');
  var sheet = backdrop && backdrop.firstElementChild;
  if (!sheet) return;
  var y0 = null, dy = 0, t0 = 0;
  sheet.addEventListener('touchstart', function (e) {
    if (sheet.scrollTop > 0 || !e.touches || e.touches.length !== 1) { y0 = null; return; }
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); sheet.style.transition = 'none';
  }, { passive: true });
  sheet.addEventListener('touchmove', function (e) {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    if (dy > 0 && sheet.scrollTop <= 0) sheet.style.transform = 'translateY(' + dy + 'px)';
    else if (dy === 0) sheet.style.transform = '';
  }, { passive: true });
  sheet.addEventListener('touchend', function () {
    if (y0 == null) return;
    var fast = dy > 40 && Date.now() - t0 < 250;
    y0 = null;
    if (dy > 110 || fast) { closePlayerLinkSheet(); return; }
    sheet.style.transition = 'transform .3s cubic-bezier(.2,.8,.2,1)';
    sheet.style.transform = '';
    setTimeout(function () { sheet.style.transition = ''; }, 320);
  });
})();
