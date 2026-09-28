// v5.93.0: drag the player sheet down to close it (from its top, or
// anywhere once it's scrolled to the top).
(function () {
  var bd = document.getElementById('player-link-backdrop');
  var sheet = bd && bd.firstElementChild;
  if (!sheet) return;
  var y0 = null, dy = 0, t0 = 0;
  sheet.addEventListener('touchstart', function (e) {
    if (sheet.scrollTop > 0) { y0 = null; return; }
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now();
    sheet.style.transition = 'none';
  }, { passive: true });
  sheet.addEventListener('touchmove', function (e) {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0) { sheet.style.transform = ''; return; }
    if (e.cancelable) e.preventDefault();
    sheet.style.transform = 'translateY(' + dy + 'px)';
    bd.style.background = 'rgba(0,0,0,' + Math.max(0, .5 - dy / 800).toFixed(3) + ')';
  }, { passive: false });
  sheet.addEventListener('touchend', function () {
    if (y0 == null) return;
    var fast = dy > 40 && (dy / Math.max(1, Date.now() - t0)) > .5;
    y0 = null;
    sheet.style.transition = 'transform .2s ease-out';
    if (dy > 110 || fast) {
      sheet.style.transform = 'translateY(100%)';
      setTimeout(function () { bd.style.display = 'none'; sheet.style.transform = ''; sheet.style.transition = ''; bd.style.background = ''; window._savSheetId = null; }, 200);
    } else {
      sheet.style.transform = ''; bd.style.background = '';
      setTimeout(function () { sheet.style.transition = ''; }, 220);
    }
    dy = 0;
  });
})();
