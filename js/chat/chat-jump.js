// ══ TOP / LATEST PILLS + GAMES BUTTON (v7.64.0, mock "A + F") ══════════════
// Floating over the game chat while you scroll:
//   · "Top of chat" — once you're down the chat, under the tabs; taps up to the
//     very first message
//   · "N games" — beside it, when the chat holds more than one game
//     (js/chat/multi-game-chat.js): team-color dots; opens a small list of the
//     games with score and status — HERE on the one you're on, GO on the rest
//     (same chat, that game's Chat tab)
//   · "Latest" — bottom right, when you've scrolled up; "Latest · 2 new" when
//     messages came in since you left the bottom; taps down to the newest
// The rail at the top of the chat already does all this when you're at the
// top, so the floating row only shows once that's scrolled away.
window._gcj = window._gcj || { open: false, base: null, raf: 0, bound: null };
var GCJ_UP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
var GCJ_DOWN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
var GCJ_CHEV = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function _gcjEsc(s) { return typeof _escapeHtml === 'function' ? _escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s); }
function _gcjPanel() { return document.getElementById('game-chat-panel'); }
function _gcjEls() {
  var p = _gcjPanel();
  if (!p) return null;
  var top = document.getElementById('gcj-top'), bot = document.getElementById('gcj-bot');
  if (!top) { top = document.createElement('div'); top.id = 'gcj-top'; top.className = 'gcj-top'; p.insertBefore(top, p.firstChild); }
  else if (top.parentNode !== p) p.insertBefore(top, p.firstChild);
  if (!bot) { bot = document.createElement('div'); bot.id = 'gcj-bot'; bot.className = 'gcj-bot'; }
  if (bot.parentNode !== p || bot !== p.lastElementChild) p.appendChild(bot); // always last, so it rides the bottom
  if (window._gcj.bound !== p) { window._gcj.bound = p; p.addEventListener('scroll', _gcjOnScroll, { passive: true }); }
  return { p: p, top: top, bot: bot };
}
function _gcjMsgCount() {
  var box = document.getElementById('game-chat-msgs');
  if (!box) return 0;
  var n = 0;
  Array.prototype.forEach.call(box.children, function (el) { if (!el.classList.contains('gc-sep')) n++; });
  return n;
}
function _gcjOnScroll() {
  var J = window._gcj;
  if (J.raf) return;
  J.raf = (window.requestAnimationFrame || setTimeout)(function () { J.raf = 0; _gcjPaint(); });
}
// the games in this chat, for the button and its list
function _gcjGames() {
  var S = typeof _mgcS === 'function' ? _mgcS() : null;
  if (!S || typeof _mgcMulti !== 'function' || !_mgcMulti(S.mine)) return null;
  var key = S.key, pks = _mgcPks(S.mine);
  var order = [key].concat(pks.filter(function (p) { return p !== key; }));
  return { S: S, list: order.map(function (pk) { return _mgcInfo(S.mine, pk); }) };
}
function _gcjPaint() {
  var E = _gcjEls(), J = window._gcj;
  if (!E) return;
  var p = E.p, fromBottom = p.scrollHeight - p.scrollTop - p.clientHeight;
  var rail = document.getElementById('mgc'), railGone = !rail || rail.style.display === 'none' || rail.getBoundingClientRect().bottom < p.getBoundingClientRect().top + 8;
  var long = p.scrollHeight > p.clientHeight * 1.6;
  var showTop = long && p.scrollTop > 320 && railGone;
  var G = _gcjGames();
  if (!showTop && !(J.open && G)) { E.top.innerHTML = ''; J.open = false; }
  else {
    var games = '';
    if (G) {
      var dots = G.list.slice(0, 4).map(function (I, i) { return '<i style="background:' + _gcjEsc(I.ca.accent || I.ca.bg || '#A89FE8') + (i ? ';margin-left:-4px' : '') + '"></i>'; }).join('');
      games = '<button type="button" class="gcj-pill gcj-g' + (J.open ? ' on' : '') + '" aria-expanded="' + (J.open ? 'true' : 'false') + '" aria-controls="gcj-list" onclick="gcjToggle()">' +
        '<span class="gcj-dots">' + dots + '</span>' + G.list.length + ' games' + GCJ_CHEV + '</button>';
    }
    var list = '';
    if (J.open && G) {
      list = '<div class="gcj-list" id="gcj-list" role="menu">' + G.list.map(function (I) {
        var here = I.pk === G.S.key, g = I.g || {}, scored = !!I.phase && I.phase !== 'pre' && g.awayScore != null && g.homeScore != null;
        return '<button type="button" role="menuitem" class="gcj-row' + (here ? ' here' : '') + '" onclick="gcjGo(\'' + _gcjEsc(I.pk) + '\')" aria-label="' + _gcjEsc(I.label + (here ? ', you’re here' : ', go to this game')) + '">' +
          '<span class="gcj-bd"><span style="background:' + _gcjEsc(I.ca.bg || '#3D3580') + ';color:' + _gcjEsc(I.ca.fg || '#fff') + '">' + _gcjEsc(I.ca.abbr) + '</span><span style="background:' + _gcjEsc(I.ch.bg || '#3D3580') + ';color:' + _gcjEsc(I.ch.fg || '#fff') + '">' + _gcjEsc(I.ch.abbr) + '</span></span>' +
          '<span class="gcj-rt"><span class="gcj-sc">' + (scored ? _gcjEsc(g.awayScore + ' – ' + g.homeScore) : _gcjEsc(I.label)) + '</span><span class="gcj-st">' + (I.phase === 'live' ? '<i></i>' : '') + _gcjEsc(I.league + (I.status ? ' · ' + I.status : '')) + '</span></span>' +
          '<span class="gcj-go">' + (here ? 'HERE' : 'GO') + '</span></button>';
      }).join('') + '</div>';
    }
    E.top.innerHTML = '<div class="gcj-row1">' + (showTop ? '<button type="button" class="gcj-pill" onclick="gcjTop()">' + GCJ_UP + 'Top of chat</button>' : '') + games + '</div>' + list;
  }
  // Latest
  var count = _gcjMsgCount();
  if (fromBottom < 180) J.base = null;
  else if (J.base == null) J.base = count;
  var fresh = J.base != null ? Math.max(0, count - J.base) : 0;
  E.bot.innerHTML = fromBottom > 300 ? '<button type="button" class="gcj-pill gcj-latest' + (fresh ? ' new' : '') + '" onclick="gcjLatest()">' + GCJ_DOWN + 'Latest' + (fresh ? ' · ' + fresh + ' new' : '') + '</button>' : '';
}
function _gcjSmooth(p, to) { try { p.scrollTo({ top: to, behavior: 'smooth' }); } catch (e) { p.scrollTop = to; } }
function gcjTop() { var p = _gcjPanel(); window._gcj.open = false; if (p) _gcjSmooth(p, 0); }
function gcjLatest() {
  var p = _gcjPanel(); if (!p) return;
  window._gcj.base = null;
  _gcjSmooth(p, p.scrollHeight);
}
function gcjToggle() { window._gcj.open = !window._gcj.open; _gcjPaint(); }
function gcjGo(pk) {
  window._gcj.open = false;
  var S = typeof _mgcS === 'function' ? _mgcS() : null;
  if (S && String(pk) === S.key) { _gcjPaint(); return; }
  if (typeof mgcGo === 'function') mgcGo(pk);
}
// tap anywhere else, or Escape, closes the list
document.addEventListener('click', function (e) {
  if (!window._gcj.open) return;
  if (e.target.closest && e.target.closest('#gcj-top')) return;
  window._gcj.open = false; _gcjPaint();
}, true);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && window._gcj.open) { window._gcj.open = false; _gcjPaint(); } });
(function () {
  ['renderGameChat', '_gcrPaint'].forEach(function (name) {
    var f = window[name];
    if (typeof f !== 'function') return;
    window[name] = function () { var r = f.apply(this, arguments); try { _gcjPaint(); setTimeout(_gcjPaint, 700); } catch (e) { console.error('[chat jump]', e); } return r; };
  });
  // a new game on screen starts fresh
  if (typeof _showGameScreen === 'function') {
    var prevShow = _showGameScreen;
    _showGameScreen = function () { window._gcj.open = false; window._gcj.base = null; return prevShow.apply(this, arguments); };
  }
})();
