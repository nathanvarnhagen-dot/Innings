// ══ NO ZOOM (v7.64.0) ══════════════════════════════════════════════════
// Pinch-zooming Innings on an iPhone crashed the page (zoomed in, the
// blurred glass panels and live animations are redrawn at several times the
// size and Safari runs out of memory and reloads the tab). The viewport tag
// already says user-scalable=no, but Safari ignores it — so the pinch itself
// is stopped here, and double-tap zoom is off in css/chat-jump.css (which
// also keeps text boxes at 16px so Safari doesn't zoom when you tap one).
(function () {
  var stop = function (e) { if (e.cancelable) e.preventDefault(); };
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (t) { document.addEventListener(t, stop, { passive: false }); });
  // two fingers moving = a pinch
  document.addEventListener('touchmove', function (e) { if (e.touches && e.touches.length > 1) stop(e); }, { passive: false });
  // if Safari zoomed anyway (an older build, a text box), put it back
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
      if (window.visualViewport.scale > 1.01) {
        var vp = document.querySelector('meta[name="viewport"]');
        if (!vp) return;
        var c = vp.getAttribute('content');
        vp.setAttribute('content', c + ' ');
        setTimeout(function () { vp.setAttribute('content', c); }, 50);
      }
    });
  }
})();

// ══ NO SIDEWAYS DRIFT (v7.104.4) ═══════════════════════════════════════════
// The MLB offseason page could slide sideways on an iPhone and stay there —
// everything cut off on the left, a dark strip down the right. Safari will
// pan a page (or an up-and-down scroller) sideways if anything in it runs a
// few points wide, even with overflow hidden, and a row of chips scrolled to
// its end hands the leftover swipe to the page. The Games page is locked in
// css/offseason.css; this puts the page back if it ever moves anyway.
(function () {
  var busy = false;
  function fix() {
    busy = false;
    var d = document.documentElement, b = document.body;
    if (window.scrollX || (d && d.scrollLeft) || (b && b.scrollLeft)) {
      try { window.scrollTo(0, window.scrollY || 0); } catch (e) {}
      if (d) d.scrollLeft = 0;
      if (b) b.scrollLeft = 0;
    }
    var s = document.querySelectorAll('.screen.active');
    for (var i = 0; i < s.length; i++) {
      if (s[i].scrollLeft) s[i].scrollLeft = 0;
      var sb = s[i].id === 'screen-games-picker' ? s[i].querySelector('.scroll-bare') : null;
      if (sb && sb.scrollLeft) sb.scrollLeft = 0;
    }
  }
  function soon() { if (busy) return; busy = true; (window.requestAnimationFrame || setTimeout)(fix); }
  // scroll doesn't bubble, so it's caught on the way down
  document.addEventListener('scroll', soon, { capture: true, passive: true });
  window.addEventListener('scroll', soon, { passive: true });
  document.addEventListener('focusout', function () { setTimeout(fix, 60); }); // Safari shifts the page to show a text box
  window.addEventListener('pageshow', fix);
  window.addEventListener('orientationchange', function () { setTimeout(fix, 300); });
  window._noDrift = fix;
})();
