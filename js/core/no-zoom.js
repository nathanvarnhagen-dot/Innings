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
