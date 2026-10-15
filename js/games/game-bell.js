// ══ FLOATING NOTIFICATION BELL ON THE SPORTS SCREENS (v7.48.0) ═══════════
// Home has a bell in its header; the sports screens (league picker, games
// list, a game, multi view, team, playoff picture) didn't have one at all.
// Here it floats bottom-right as a glass button, the same spot on every
// sport and every tab, so it never needs header space and never tucks with
// the scorebug. The count badge shows only when something's unread (same
// rule as Home's bell), and a ring in the game's team color pulses twice
// when a new one lands. On a game's Chat tab it rides up above the message
// box. Tap → the Notifications screen.
var GBELL_SCREENS = ['screen-games-picker', 'screen-games', 'screen-games-soon', 'screen-game', 'screen-multi', 'screen-team', 'screen-playoff-picture'];
var GBELL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>';
window._gbellN = window._gbellN || 0;

function _gbellMount() {
  GBELL_SCREENS.forEach(function (id) {
    var s = document.getElementById(id);
    if (!s || s.querySelector('.gbell')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'gbell'; b.setAttribute('aria-label', 'Notifications');
    b.innerHTML = GBELL_SVG + '<span class="gbell-n" aria-hidden="true"></span>';
    b.onclick = function () { if (typeof nav === 'function') nav('notifications'); };
    s.appendChild(b);
  });
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

function _gbellPaint(n) {
  n = n || 0;
  var was = window._gbellN || 0;
  window._gbellN = n;
  var ring = _gbellRing();
  document.querySelectorAll('.gbell').forEach(function (b) {
    b.classList.toggle('has', n > 0);
    b.style.setProperty('--gbell-ring', ring);
    var c = b.querySelector('.gbell-n');
    if (c) c.textContent = n > 99 ? '99+' : n > 0 ? String(n) : '';
    b.setAttribute('aria-label', n > 0 ? 'Notifications, ' + n + ' new' : 'Notifications');
    if (n > was) { // something new: the ring and a shake, once
      b.classList.remove('new'); void b.offsetWidth; b.classList.add('new');
      clearTimeout(b._gbT); b._gbT = setTimeout(function () { b.classList.remove('new'); }, 4200);
    }
  });
}

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
