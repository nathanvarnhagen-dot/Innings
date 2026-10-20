// ══ FLOATING NOTIFICATION BELL ON THE SPORTS SCREENS (v7.48.0) ═══════════
// Home has a bell in its header; the sports screens (league picker, games
// list, a game, multi view, team, playoff picture) didn't have one at all.
// Here it floats bottom-right as a glass button, the same spot on every
// sport and every tab, so it never needs header space and never tucks with
// the scorebug. The count badge shows only when something's unread (same
// rule as Home's bell), and a ring in the game's team color pulses twice
// when a new one lands. On a game's Chat tab it rides up above the message
// box. Tap → the Notifications screen.
//
// v7.60.0: the bell only shows when there's something new. It sits tucked
// off the right edge (a thin tab peeks out, red while anything's unread);
// a new notification slides it in and rings it. Tapping it opens
// Notifications and slides it back out. Swipe the bell right to tuck it
// away without reading; swipe left along the bottom of the screen to pull
// it back anytime, even with nothing unread.
var GBELL_SCREENS = ['screen-games-picker', 'screen-games', 'screen-games-soon', 'screen-game', 'screen-multi', 'screen-team', 'screen-playoff-picture'];
var GBELL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
var GBELL_ZONE = 150;   // px from the bottom of the screen where the pull-back swipe starts
var GBELL_SNAP = 36;    // px of drag that commits a tuck or a pull
window._gbellN = window._gbellN || 0;
// out: bell is showing. manual: pulled back by hand (stays even with nothing unread).
// tuck: the unread count when it was last put away, so only newer ones bring it back.
window._gbell = window._gbell || { out: false, manual: false, tuck: _gbellTuckGet() };

function _gbellTuckGet() { try { return parseInt(localStorage.getItem('gbellTuck') || '0', 10) || 0; } catch (e) { return 0; } }
function _gbellTuckSet(n) { window._gbell.tuck = n; try { localStorage.setItem('gbellTuck', String(n)); } catch (e) {} }

function _gbellMount() {
  GBELL_SCREENS.forEach(function (id) {
    var s = document.getElementById(id);
    if (!s || s.querySelector('.gbell-dock')) return;
    var d = document.createElement('div');
    d.className = 'gbell-dock';
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'gbell'; b.setAttribute('aria-label', 'Notifications');
    b.innerHTML = GBELL_SVG + '<span class="gbell-n" aria-hidden="true"></span>';
    b.onclick = function () {
      if (d._moved) { d._moved = false; return; }
      _gbellTuckSet(window._gbellN || 0);
      _gbellSetOut(false, false);
      if (typeof nav === 'function') nav('notifications');
    };
    var p = document.createElement('span');
    p.className = 'gbell-peek'; p.setAttribute('aria-hidden', 'true');
    d.appendChild(b); d.appendChild(p);
    s.appendChild(d);
  });
  _gbellSetOut(window._gbell.out, window._gbell.manual);
  _gbellPaint(window._gbellN);
}

// the ring takes the home team's color on a game screen; lavender elsewhere
function _gbellRing() {
  var g = window._activeBrowseGame;
  try {
    if (g && g.home && typeof _teamLook === 'function') {
      var c = _teamLook(g.sport || 'mlb', g.home, g.homeAbbr || null, g.homeColor || null, g.homeAlt || null);
      if (c && c.known) return c.ring || c.accent || c.bg;
    }
  } catch (e) {}
  return '#A89FE8';
}

function _gbellSetOut(out, manual) {
  window._gbell.out = !!out; window._gbell.manual = !!(out && manual);
  document.querySelectorAll('.gbell-dock').forEach(function (d) {
    var b = d.querySelector('.gbell');
    if (b) { b.style.transform = ''; b.classList.remove('drag'); if (!out) b.classList.remove('new'); }
    d.classList.remove('dragging');
    d.classList.toggle('in', !!out);
  });
}

// ring + shake once; when the bell is sliding in, wait until it lands
function _gbellRingOnce(delay) {
  document.querySelectorAll('.gbell').forEach(function (b) {
    clearTimeout(b._gbD); clearTimeout(b._gbT);
    b.classList.remove('new');
    b._gbD = setTimeout(function () {
      void b.offsetWidth; b.classList.add('new');
      b._gbT = setTimeout(function () { b.classList.remove('new'); }, 4200);
    }, delay || 0);
  });
}

function _gbellPaint(n) {
  n = n || 0;
  var was = window._gbellN || 0, st = window._gbell;
  window._gbellN = n;
  var ring = _gbellRing();
  document.querySelectorAll('.gbell').forEach(function (b) {
    b.classList.toggle('has', n > 0);
    b.style.setProperty('--gbell-ring', ring);
    var c = b.querySelector('.gbell-n');
    if (c) c.textContent = n > 99 ? '99+' : n > 0 ? String(n) : '';
    b.setAttribute('aria-label', n > 0 ? 'Notifications, ' + n + ' new' : 'Notifications');
  });
  document.querySelectorAll('.gbell-peek').forEach(function (p) { p.classList.toggle('unread', n > 0); });
  if (n === 0) {
    if (st.tuck) _gbellTuckSet(0);
    if (st.out && !st.manual) _gbellSetOut(false, false);
    return;
  }
  if (n < st.tuck) _gbellTuckSet(n); // some were read elsewhere
  if (n > was && n > st.tuck) { // something new: slide in (if tucked), then ring
    var wasOut = st.out;
    if (!wasOut) _gbellSetOut(true, false);
    _gbellRingOnce(wasOut ? 0 : 480);
  }
}

// ── Swipes: the bell drags right to tuck; the bottom of the screen drags left to pull it back
(function () {
  var g = null;
  function scrollsX(el, stop) {
    for (; el && el !== stop; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 2) { var ox = getComputedStyle(el).overflowX; if (ox === 'auto' || ox === 'scroll') return true; }
    }
    return false;
  }
  function offOf(b) { return b.offsetWidth + (parseFloat(getComputedStyle(b).right) || 14) + 24; }
  function start(x, y, target) {
    if (!target || !target.closest) return;
    var scr = target.closest('.screen.active'), d = scr && scr.querySelector('.gbell-dock');
    if (!d) return;
    var b = d.querySelector('.gbell'), onBell = b.contains(target), isIn = d.classList.contains('in');
    if (isIn && !onBell) return;
    if (!isIn) {
      if (scr.getBoundingClientRect().bottom - y > GBELL_ZONE) return;
      if (scrollsX(target, scr)) return;
    }
    var off = offOf(b);
    g = { x: x, y: y, d: d, b: b, off: off, from: isIn ? 0 : off, lock: null, moved: false };
  }
  function move(x, y, ev) {
    if (!g) return;
    var dx = x - g.x, dy = y - g.y;
    if (g.lock === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      g.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      // pulling back only means a leftward swipe; a rightward one is left alone
      if (g.lock === 'x' && g.from && dx > 0) g.lock = 'y';
      if (g.lock === 'y') { g = null; return; }
    }
    if (ev && ev.cancelable) ev.preventDefault();
    g.moved = true;
    g.b.classList.add('drag'); g.d.classList.add('dragging');
    g.b.style.transform = 'translateX(' + Math.max(0, Math.min(g.off, g.from + dx)) + 'px)';
  }
  function end(x) {
    if (!g) return;
    var s = g; g = null;
    if (!s.moved) return;
    s.d._moved = true; setTimeout(function () { s.d._moved = false; }, 350);
    var dx = x == null ? 0 : x - s.x;
    if (!s.from && dx > GBELL_SNAP) { _gbellTuckSet(window._gbellN || 0); _gbellSetOut(false, false); }
    else if (s.from && dx < -GBELL_SNAP) { _gbellSetOut(true, true); }
    else { _gbellSetOut(window._gbell.out, window._gbell.manual); }
  }
  document.addEventListener('touchstart', function (e) { if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY, e.target); else g = null; }, { passive: true });
  document.addEventListener('touchmove', function (e) { if (g) move(e.touches[0].clientX, e.touches[0].clientY, e); }, { passive: false });
  document.addEventListener('touchend', function (e) { if (g) end(e.changedTouches[0] ? e.changedTouches[0].clientX : null); });
  document.addEventListener('touchcancel', function () { if (g) end(null); });
  // mouse (desktop): same gestures with a click-drag
  document.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && e.button === 0) start(e.clientX, e.clientY, e.target); });
  document.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' && g) move(e.clientX, e.clientY, e); });
  document.addEventListener('pointerup', function (e) { if (e.pointerType === 'mouse' && g) end(e.clientX); });
})();

(function () {
  // the badge count comes from the one unread listener in notifications.js
  var prev = window._renderNotifBadge;
  window._renderNotifBadge = function (count) { var o = typeof prev === 'function' ? prev.apply(this, arguments) : undefined; try { _gbellPaint(count); } catch (e) {} return o; };
  // on a game's Chat tab the bell sits above the message box
  var prevTab = window.gameDetailTab;
  if (typeof prevTab === 'function') {
    window.gameDetailTab = function (key) { var r = prevTab.apply(this, arguments); var s = document.getElementById('screen-game'); if (s) s.classList.toggle('gbell-up', key === 'chat'); return r; };
  }
  // the ring color follows the game that's open
  var prevShow = window._showGameScreen;
  if (typeof prevShow === 'function') {
    window._showGameScreen = function () { var r = prevShow.apply(this, arguments); try { _gbellPaint(window._gbellN); } catch (e) {} return r; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _gbellMount); else _gbellMount();
})();
