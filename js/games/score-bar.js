// ═══ SLIM SCORE BAR (v6.5.0) ══════════════════════════════════════════
function _gshDesk() { return typeof _isDesk === 'function' && _isDesk(); }
function _gshModel() {
  var gp = window._gdPregame;
  if (!gp) return null;
  if (gp.gx) return { kind: 'gx', m: gp.gx };
  if (gp.heroBox && typeof _ghModelFromMlbBox === 'function') { var m = _ghModelFromMlbBox(gp.heroBox); if (m) return { kind: 'mlb', m: m, box: gp.heroBox }; }
  return null;
}
function _gshBarHtml() {
  var o = _gshModel();
  if (!o) return '';
  var m = o.m, a = m.away, h = m.home;
  var lg = function (t) { var c = t.colors || {}; return '<span class="gsb-lg" style="background:' + (c.bg || '#3D3580') + ';color:' + (c.fg || '#fff') + '">' + _escapeHtml(t.abbr || '') + '</span>'; };
  var sc = function (t) { return t.score != null ? t.score : '\u2013'; };
  var mid = '';
  if (m.phase === 'final') mid = 'FINAL';
  else if (m.phase === 'pre') mid = '<span class="sub">VS</span>';
  else if (o.kind === 'mlb') {
    var s = (o.box && o.box.situation) || {};
    var b = s.bases || {};
    var on = function (k) { return !!(b[k] || b[{ first: '1B', second: '2B', third: '3B' }[k]]); };
    var dia = function (x, y, f) { return '<rect x="' + x + '" y="' + y + '" width="7" height="7" transform="rotate(45 ' + (x + 3.5) + ' ' + (y + 3.5) + ')" fill="' + (f ? '#A89FE8' : 'none') + '" stroke="#A89FE8" stroke-width="1.5"/>'; };
    var od = ''; for (var i = 0; i < 3; i++) od += '<i class="' + (i < (s.outs || 0) ? 'on' : '') + '"></i>';
    mid = '<span class="tri">' + (s.half === 'top' ? '&#9650;' : '&#9660;') + '</span>' + (s.inning || '') +
      '<svg width="22" height="15" viewBox="0 0 26 18" aria-hidden="true">' + dia(9.5, 1, on('second')) + dia(2, 8.5, on('third')) + dia(17, 8.5, on('first')) + '</svg>' +
      '<span class="gsb-od">' + od + '</span>' + (s.balls != null ? s.balls : 0) + '\u2013' + (s.strikes != null ? s.strikes : 0);
  } else {
    var pt = typeof _gxPeriodText === 'function' ? _gxPeriodText(m) : { big: '', small: '' };
    mid = _escapeHtml(pt.big || '') + (pt.small ? ' <span class="sub">' + _escapeHtml(pt.small) + '</span>' : '');
  }
  var psL = typeof _psShortTag === 'function' ? _psShortTag() : '';
  if (psL) mid = '<span class="gsb-ps">' + _escapeHtml(psL) + '</span><span class="gsb-row">' + mid + '</span>';
  return '<div class="gsb-in"><div class="gsb-t"><button class="gsb-back" onclick="navBack()" aria-label="Back"><svg width="7" height="12" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 1 1 6.5 7 12"/></svg></button>' + lg(a) + '<b>' + sc(a) + '</b></div>' +
    '<div class="gsb-mid' + (psL ? ' ps' : '') + '">' + mid + '</div><div class="gsb-t r"><b>' + sc(h) + '</b>' + lg(h) + '</div></div>';
}
function _gshSetup() {
  var scr = document.getElementById('screen-game'), hd = document.getElementById('game-hd'), panel = document.getElementById('game-sheet-panel');
  if (!scr || !hd || !panel) return;
  if (!document.getElementById('game-sb')) {
    var bar = document.createElement('div'); bar.id = 'game-sb'; bar.className = 'gsb'; bar.setAttribute('role', 'status');
    scr.appendChild(bar);
    panel.style.position = 'relative';
    panel.addEventListener('scroll', _gshUpdate, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(function () { _gshMeasure(); _gshUpdate(); }).observe(hd);
    window.addEventListener('resize', function () { _gshApply(); });
  }
  _gshApply();
}
function _gshMeasure() {
  var scr = document.getElementById('screen-game'), hd = document.getElementById('game-hd');
  if (scr && hd && scr.classList.contains('gsh-on')) scr.style.setProperty('--gsh-h', hd.offsetHeight + 'px');
  var panel = document.getElementById('game-sheet-panel');
  if (panel) panel._ptrOffset = (scr && scr.classList.contains('gsh-on') && hd) ? hd.offsetHeight : 0;
}
// On for the cheat sheet (phone and iPad), off for chat/rules and desktop
function _gshApply() {
  var scr = document.getElementById('screen-game'), hd = document.getElementById('game-hd'), panel = document.getElementById('game-sheet-panel');
  if (!scr || !hd || !panel) return;
  var want = !_gshDesk() && panel.style.display !== 'none';
  scr.classList.toggle('gsh-on', want);
  if (!want) { hd.style.transform = ''; var b = document.getElementById('game-sb'); if (b) { b.style.transform = ''; b.style.opacity = ''; b.classList.remove('on'); } }
  _gshMeasure();
  _gshUpdate();
}
// The header moves with the content; the bar slides in over the 60px as the
// scoreboard leaves the top, and back out the same way.
function _gshUpdate() {
  var scr = document.getElementById('screen-game'), hd = document.getElementById('game-hd'), panel = document.getElementById('game-sheet-panel'), bar = document.getElementById('game-sb');
  if (!scr || !hd || !panel || !bar || !scr.classList.contains('gsh-on')) return;
  var y = panel.scrollTop, H = hd.offsetHeight;
  hd.style.transform = 'translateY(' + (-Math.min(y, H)) + 'px)';
  var hero = panel.querySelector('.gh');
  var p = 0;
  if (hero) {
    var bottom = hero.offsetTop + hero.offsetHeight;
    var barH = bar.offsetHeight || 60;
    p = Math.max(0, Math.min(1, (y - (bottom - barH - 60)) / 60));
  }
  if (p > 0 && !bar.innerHTML) bar.innerHTML = _gshBarHtml();
  bar.style.transform = 'translateY(' + (-(1 - p) * 100) + '%)';
  bar.style.opacity = p;
  bar.classList.toggle('on', p > .5);
}
function _gshRefresh() {
  var bar = document.getElementById('game-sb');
  if (bar) bar.innerHTML = _gshBarHtml();
  _gshMeasure();
  _gshUpdate();
}
