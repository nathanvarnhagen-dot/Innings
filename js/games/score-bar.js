// ═══ SCORE BAR (v6.5.0, broadcast scorebug v7.13.0) ═══════════════════
// On the cheat sheet the game header stays pinned (title row + tabs). As
// the series ribbon and scoreboard scroll up under it they fade and drift
// away, and once they're gone the title row turns into a TV-style scorebug
// (team color blocks, inning, bases, outs, count). Tapping the bug pulls
// the full scoreboard back down from under the header, along with the
// Watching / Attending choice; tapping the shade or the handle puts it back.
// Not on the desktop two-column layout.
function _gshDesk() { return typeof _isDesk === 'function' && _isDesk(); }
function _gshModel() {
  var gp = window._gdPregame;
  if (!gp) return null;
  if (gp.gx) return { kind: 'gx', m: gp.gx };
  if (gp.heroBox && typeof _ghModelFromMlbBox === 'function') { var m = _ghModelFromMlbBox(gp.heroBox); if (m) return { kind: 'mlb', m: m, box: gp.heroBox }; }
  return null;
}
var _GSH_CHEV = '<svg class="gsb-chev" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="2 4.5 6 8.5 10 4.5"/></svg>';
function _gshBarHtml() {
  var o = _gshModel();
  if (!o) return '';
  var m = o.m, a = m.away, h = m.home;
  var block = function (t) {
    var c = t.colors || {};
    return '<span class="gsb-tb" style="background:' + (c.bg || '#3D3580') + ';color:' + (c.fg || '#fff') + ';--gsb-ac:' + (c.accent || c.fg || '#A89FE8') + '">' +
      '<span class="a">' + _escapeHtml(t.abbr || '') + '</span><b>' + (t.score != null ? t.score : '–') + '</b></span>';
  };
  var mid = '';
  if (m.phase === 'final') mid = '<span class="gsb-word">Final</span>';
  else if (m.phase === 'pre') mid = '<span class="gsb-word">Pregame</span>';
  else if (o.kind === 'mlb') {
    var s = (o.box && o.box.situation) || {};
    var b = s.bases || {};
    var on = function (k) { return !!(b[k] || b[{ first: '1B', second: '2B', third: '3B' }[k]]); };
    var dia = function (x, y, f) { return '<rect x="' + x + '" y="' + y + '" width="7" height="7" transform="rotate(45 ' + (x + 3.5) + ' ' + (y + 3.5) + ')" fill="' + (f ? '#E8C766' : 'none') + '" stroke="' + (f ? '#E8C766' : 'rgba(255,255,255,.55)') + '" stroke-width="1.4"/>'; };
    var brk = s.inningState === 'Middle' ? 'MID' : s.inningState === 'End' ? 'END' : '';
    var od = ''; for (var i = 0; i < 3; i++) od += '<i class="' + (!brk && i < (s.outs || 0) ? 'on' : '') + '"></i>';
    mid = '<span class="gsb-inn"><small>' + (brk || (s.half === 'top' ? '&#9650;' : '&#9660;')) + '</small>' + (s.inning || '') + '</span>' +
      (brk ? '' : '<svg width="24" height="17" viewBox="0 0 26 18" aria-hidden="true">' + dia(9.5, 1, on('second')) + dia(2, 8.5, on('third')) + dia(17, 8.5, on('first')) + '</svg>' +
      '<span class="gsb-od" aria-label="' + (s.outs || 0) + ' out">' + od + '</span>' +
      '<span class="gsb-ct">' + (s.balls != null ? s.balls : 0) + '–' + (s.strikes != null ? s.strikes : 0) + '</span>');
  } else {
    var pt = typeof _gxPeriodText === 'function' ? _gxPeriodText(m) : { big: '', small: '' };
    mid = '<span class="gsb-word">' + _escapeHtml(pt.big || '') + (pt.small ? ' <span class="sub">' + _escapeHtml(pt.small) + '</span>' : '') + '</span>';
  }
  return '<div class="gsb-in"><button class="gsb-back" onclick="navBack()" aria-label="Back"><svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 1 1 6.5 7 12"/></svg></button>' +
    '<button class="gsb-bug" onclick="gshToggleDrop()" aria-label="Show the scoreboard" aria-expanded="' + (window._gshDropOn ? 'true' : 'false') + '">' +
    block(a) + block(h) + '<span class="gsb-sit">' + mid + _GSH_CHEV + '</span></button></div>';
}
function _gshSetup() {
  var scr = document.getElementById('screen-game'), hd = document.getElementById('game-hd'), panel = document.getElementById('game-sheet-panel');
  if (!scr || !hd || !panel) return;
  if (!document.getElementById('game-sb')) {
    var bar = document.createElement('div'); bar.id = 'game-sb'; bar.className = 'gsb'; bar.setAttribute('role', 'status');
    hd.appendChild(bar);
    var scrim = document.createElement('button'); scrim.id = 'game-sb-scrim'; scrim.className = 'gsbd-scrim'; scrim.setAttribute('aria-label', 'Hide the scoreboard'); scrim.onclick = function () { gshCloseDrop(); };
    var drop = document.createElement('div'); drop.id = 'game-sb-drop'; drop.className = 'gsbd'; drop.setAttribute('aria-hidden', 'true');
    drop.innerHTML = '<div class="gsbd-att"><span>You’re</span><span id="gsbd-att-slot" class="gsbd-att-slot"></span></div><div id="gsbd-hero" class="gsbd-hero"></div>' +
      '<button class="gsbd-grab" onclick="gshCloseDrop()" aria-label="Push the scoreboard back up"></button>';
    scr.appendChild(scrim); scr.appendChild(drop);
    panel.style.position = 'relative';
    panel.addEventListener('scroll', _gshUpdate, { passive: true });
    // the cheat sheet re-renders on every live tick, which drops the fade
    // styles and the dropped-down copy — put both back
    if (window.MutationObserver) new MutationObserver(function () { _gshUpdate(); if (window._gshDropOn) _gshFillDrop(); }).observe(panel, { childList: true });
    if (window.ResizeObserver) new ResizeObserver(function () { _gshMeasure(); _gshUpdate(); }).observe(hd);
    window.addEventListener('resize', function () { _gshApply(); });
  }
  _gshApply();
}
function _gshMeasure() {
  var scr = document.getElementById('screen-game'), hd = document.getElementById('game-hd');
  if (scr && hd && (scr.classList.contains('gsh-on') || scr.classList.contains('gsh-tab'))) scr.style.setProperty('--gsh-h', (hd.offsetTop + hd.offsetHeight) + 'px');
  var panel = document.getElementById('game-sheet-panel');
  if (panel) panel._ptrOffset = (scr && scr.classList.contains('gsh-on') && hd) ? hd.offsetHeight : 0;
  // the bug sits exactly over the header's title row
  var bar = document.getElementById('game-sb'), row = hd && hd.firstElementChild;
  if (bar && row && row !== bar) {
    var inner = row.offsetHeight - (parseFloat(getComputedStyle(row).paddingBottom) || 0);
    bar.style.top = (row.offsetTop + inner / 2 - 22) + 'px';
  }
}
// The cheat sheet (phone and iPad) pins the header and folds the scoreboard
// into the bug as you scroll. v7.17.1: every other tab (Plays, Box, Chat,
// Watch & listen) shows the bug in the title row for the whole live game.
// Off on desktop.
function _gshApply() {
  var scr = document.getElementById('screen-game'), hd = document.getElementById('game-hd'), panel = document.getElementById('game-sheet-panel');
  if (!scr || !hd || !panel) return;
  var desk = _gshDesk(), sheet = panel.style.display !== 'none';
  var want = !desk && sheet;
  scr.classList.toggle('gsh-on', want);
  scr.classList.toggle('gsh-tab', !desk && !sheet);
  if (!want) {
    hd.style.transform = '';
    hd.classList.remove('gsh-c');
    var b = document.getElementById('game-sb'); if (b) b.classList.remove('on');
    gshCloseDrop();
    _gshFade(panel, 0);
  }
  _gshMeasure();
  _gshUpdate();
}
// The top of the cheat sheet: the postseason ribbon (when there is one)
// down to the bottom of the scoreboard
function _gshHeroEls(panel) {
  var hero = panel.querySelector(':scope > .gh');
  if (!hero) return [];
  var els = [], n = panel.firstElementChild;
  while (n) { els.push(n); if (n === hero) break; n = n.nextElementSibling; }
  return els;
}
function _gshFade(panel, p) {
  _gshHeroEls(panel).forEach(function (el) {
    if (window._gshGone && !el._gshHiding) { el.style.display = 'none'; return; }
    if (el._gshHiding) return;
    if (p <= 0) { el.style.opacity = ''; el.style.transform = ''; el.style.filter = ''; return; }
    el.style.opacity = (1 - p * 0.9).toFixed(3);
    el.style.transform = 'translateY(' + Math.round(p * 70) + 'px) scale(' + (1 - p * 0.06).toFixed(4) + ')';
    el.style.transformOrigin = '50% 0';
    el.style.filter = p > 0.02 ? 'blur(' + (p * 5).toFixed(1) + 'px)' : '';
  });
}
// As the scoreboard slides up under the header it fades away; once it's
// under, the title row swaps for the bug
function _gshUpdate() {
  var scr = document.getElementById('screen-game'), hd = document.getElementById('game-hd'), panel = document.getElementById('game-sheet-panel'), bar = document.getElementById('game-sb');
  if (!scr || !hd || !panel || !bar) return;
  if (scr.classList.contains('gsh-tab') && !scr.classList.contains('gsh-on')) {
    var lv = _gshLive();
    if (lv && !bar.innerHTML) bar.innerHTML = _gshBarHtml();
    if (lv && !bar.innerHTML) lv = false;
    bar.classList.toggle('on', lv);
    hd.classList.toggle('gsh-c', lv);
    if (!lv && window._gshDropOn) gshCloseDrop();
    return;
  }
  if (!scr.classList.contains('gsh-on')) return;
  hd.style.transform = '';
  var y = panel.scrollTop, els = _gshHeroEls(panel), p = 0;
  // v7.15.1: all of this is for live games only. Before the first pitch and
  // after the final the scoreboard just scrolls with the page, and if a game
  // ends while it's tucked away it comes back.
  var live = _gshLive();
  if (!live) _gshUntuck(panel);
  // v7.13.1: a few seconds after the game opens the scoreboard tucks away
  // for good (until the next open); only the bug's arrow brings it back
  if (live && els.length && !window._gshGone && !window._gshTimer) window._gshTimer = setTimeout(_gshAutoHide, 2000); // v7.17.3: was 4s
  if (live && els.length && !window._gshGone) {
    var top0 = els[0].offsetTop, hero = els[els.length - 1];
    var span = Math.max(1, hero.offsetTop + hero.offsetHeight - top0);
    p = Math.max(0, Math.min(1, y / span));
  }
  _gshFade(panel, reduceMotion() ? 0 : p);
  var collapsed = live && (!!window._gshGone || p >= 0.85);
  if (collapsed && !bar.innerHTML) bar.innerHTML = _gshBarHtml();
  if (collapsed && !bar.innerHTML) collapsed = false; // never swap the title row for an empty bug
  bar.classList.toggle('on', collapsed);
  hd.classList.toggle('gsh-c', collapsed);
  if (!collapsed && window._gshDropOn) gshCloseDrop();
  function reduceMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
}
function _gshLive() { var o = _gshModel(); return !!(o && o.m && o.m.phase === 'live'); }
// Brings a tucked-away scoreboard back (the game is no longer live)
function _gshUntuck(panel) {
  if (window._gshTimer) { clearTimeout(window._gshTimer); window._gshTimer = null; }
  if (!window._gshGone) return;
  window._gshGone = false;
  if (panel) _gshHeroEls(panel).forEach(function (el) { el._gshHiding = false; ['display', 'opacity', 'transform', 'filter', 'transition', 'maxHeight', 'overflow', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'].forEach(function (k) { el.style[k] = ''; }); });
}
// Fades, blurs and folds the ribbon + scoreboard up, then takes them out of
// the page, keeping whatever the reader is looking at in place
function _gshAutoHide() {
  window._gshTimer = null;
  if (window._gshGone || !_gshLive()) return;
  window._gshGone = true;
  var scr = document.getElementById('screen-game'), panel = document.getElementById('game-sheet-panel');
  if (!panel) return;
  var els = _gshHeroEls(panel);
  if (!els.length) return;
  var on = scr && scr.classList.contains('gsh-on') && panel.style.display !== 'none';
  var top0 = els[0].offsetTop, last = els[els.length - 1];
  var span = last.offsetTop + last.offsetHeight + (parseFloat(getComputedStyle(last).marginBottom) || 0) - top0;
  var instant = !on || panel.scrollTop > span * 0.5 || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (instant) {
    els.forEach(function (el) { el.style.display = 'none'; });
    if (panel.scrollTop > 0) panel.scrollTop = Math.max(0, panel.scrollTop - span);
    _gshUpdate();
    return;
  }
  els.forEach(function (el) {
    el._gshHiding = true;
    var h = el.offsetHeight;
    el.style.overflow = 'hidden';
    el.style.maxHeight = h + 'px';
    el.style.transformOrigin = '50% 0';
    void el.offsetHeight;
    el.style.transition = 'max-height .55s cubic-bezier(.4,0,.2,1),margin .55s cubic-bezier(.4,0,.2,1),padding .55s cubic-bezier(.4,0,.2,1),opacity .4s ease,transform .55s cubic-bezier(.4,0,.2,1),filter .45s ease';
    el.style.maxHeight = '0px'; el.style.marginTop = '0px'; el.style.marginBottom = '0px'; el.style.paddingTop = '0px'; el.style.paddingBottom = '0px';
    el.style.opacity = '0'; el.style.transform = 'translateY(-28px) scale(.96)'; el.style.filter = 'blur(6px)';
  });
  _gshUpdate();
  setTimeout(function () {
    els.forEach(function (el) {
      el._gshHiding = false;
      ['transition', 'maxHeight', 'overflow', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'].forEach(function (k) { el.style[k] = ''; });
      if (window._gshGone) el.style.display = 'none';
    });
    _gshUpdate();
  }, 600);
}
// Every open of a game shows the scoreboard again for a few seconds
(function () {
  if (typeof _showGameScreen !== 'function') return;
  var orig = _showGameScreen;
  _showGameScreen = function () {
    clearTimeout(window._gshTimer); window._gshTimer = null; window._gshGone = false;
    var panel = document.getElementById('game-sheet-panel');
    if (panel) _gshHeroEls(panel).forEach(function (el) { el._gshHiding = false; ['display', 'opacity', 'transform', 'filter', 'transition', 'maxHeight', 'overflow', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'].forEach(function (k) { el.style[k] = ''; }); });
    var bar = document.getElementById('game-sb'); if (bar) bar.innerHTML = '';
    return orig.apply(this, arguments);
  };
})();
function _gshRefresh() {
  var bar = document.getElementById('game-sb');
  if (bar) bar.innerHTML = _gshBarHtml();
  _gshMeasure();
  _gshUpdate();
  if (window._gshDropOn) _gshFillDrop();
}
// ── pull-down scoreboard ──
// A copy of the live ribbon + scoreboard (ids stripped so nothing is
// duplicated), refreshed whenever the cheat sheet re-renders
function _gshFillDrop() {
  var panel = document.getElementById('game-sheet-panel'), slot = document.getElementById('gsbd-hero');
  if (!panel || !slot) return;
  slot.innerHTML = '';
  _gshHeroEls(panel).forEach(function (el) {
    var c = el.cloneNode(true);
    c.removeAttribute('id');
    c.querySelectorAll('[id]').forEach(function (x) { x.removeAttribute('id'); });
    c.classList.remove('gh-anim');
    ['display', 'opacity', 'transform', 'filter', 'transition', 'maxHeight', 'overflow', 'marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'].forEach(function (k) { c.style[k] = ''; });
    slot.appendChild(c);
  });
}
function gshToggleDrop() { if (window._gshDropOn) gshCloseDrop(); else gshOpenDrop(); }
function gshOpenDrop() {
  var scr = document.getElementById('screen-game'), drop = document.getElementById('game-sb-drop'), att = document.getElementById('game-att-opts'), slot = document.getElementById('gsbd-att-slot');
  if (!scr || !drop) return;
  window._gshDropOn = true;
  _gshFillDrop();
  if (att && slot) slot.appendChild(att); // the real control, so it keeps working
  drop.setAttribute('aria-hidden', 'false');
  scr.classList.add('gsbd-on');
  var bug = document.querySelector('#game-sb .gsb-bug'); if (bug) bug.setAttribute('aria-expanded', 'true');
}
function gshCloseDrop() {
  var scr = document.getElementById('screen-game'), drop = document.getElementById('game-sb-drop'), att = document.getElementById('game-att-opts'), hd = document.getElementById('game-hd');
  window._gshDropOn = false;
  if (att && hd && hd.firstElementChild && att.parentNode !== hd.firstElementChild) hd.firstElementChild.appendChild(att);
  if (drop) drop.setAttribute('aria-hidden', 'true');
  if (scr) scr.classList.remove('gsbd-on');
  var bug = document.querySelector('#game-sb .gsb-bug'); if (bug) bug.setAttribute('aria-expanded', 'false');
}
// ── tab bar ──
// Every tab switch rewrites the buttons' inline styles; the broadcast tab
// bar reads which one is lit from that and marks it with a class instead
function _gdTabsSync() {
  var row = document.getElementById('game-tabs');
  if (!row) return;
  Array.prototype.forEach.call(row.children, function (b) {
    // v7.13.1: Safari reports the off state as rgba(0, 0, 0, 0), not
    // "transparent" — read the alpha instead of the word
    var bg = (b.style.backgroundColor || '').replace(/\s/g, '');
    var m = bg.match(/^rgba?\(([^)]*)\)$/), on = false;
    if (m) { var parts = m[1].split(','); on = parts.length < 4 || parseFloat(parts[3]) > 0; }
    else on = !!bg && bg !== 'transparent' && bg !== 'initial' && bg !== 'none';
    if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
  });
}
(function () {
  var row = document.getElementById('game-tabs');
  if (!row) return;
  _gdTabsSync();
  if (window.MutationObserver) new MutationObserver(_gdTabsSync).observe(row, { attributes: true, attributeFilter: ['style'], subtree: true });
})();
