// ══ POP-UPS THAT OPEN FROM ANYWHERE (v7.18.1) ═══════════════════════════
// A few full-screen pop-ups were written inside the screen that first used
// them. Opened from another screen they sat inside a hidden one — invisible,
// and (since v7.17.1) untappable. Tapping a photo in a game chat did nothing
// because the photo viewer lives in the memory screen; Add friends from the
// Outside Lands screen had the same problem in the classic layout. They now
// live at the top of the page, so they show over whatever screen you're on.
(function () {
  ['photo-lightbox', 'add-friends-sheet'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && el.closest('.screen')) document.body.appendChild(el);
  });
})();
