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
window._gcj = window._gcj || { open: false, base: null, bound: null, moving: false, t: 0, top: '', bot: '' };
// v7.64.1: no flicker. The pills live in their own layer (fixed, over the
// chat — not inside the scrolling list, where iPhone redraws them mid-scroll),
// fade out the moment the chat starts moving, and fade back in once it has
// been still for a beat. Their contents are only rewritten when something
// actually changed, so nothing re-animates on its own.
var GCJ_STILL_MS = 260;
var GCJ_UP = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
var GCJ_DOWN = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
var GCJ_CHEV = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function _gcjEsc(s) { return typeof _escapeHtml === 'function' ? _escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s); }
function _gcjPanel() { return document.getElementById('game-chat-panel'); }
function _gcjShowing(p) {
  var scr = document.getElementById('screen-game');
  return !!(p && scr && scr.classList.contains('active') && p.style.display !== 'none' && p.offsetParent !== null && !document.hidden);
}
function _gcjEls() {
  var p = _gcjPanel();
  if (!p) return null;
  var top = document.getElementById('gcj-top'), bot = document.getElementById('gcj-bot');
  if (!top) { top = document.createElement('div'); top.id = 'gcj-top'; top.className = 'gcj-top'; document.body.appendChild(top); }
  if (!bot) { bot = document.createElement('div'); bot.id = 'gcj-bot'; bot.className = 'gcj-bot'; document.body.appendChild(bot); }
  if (window._gcj.bound !== p) {
    window._gcj.bound = p;
    p.addEventListener('scroll', _gcjOnScroll, { passive: true });
    p.addEventListener('touchmove', _gcjOnScroll, { passive: true });
  }
  return { p: p, top: top, bot: bot };
}
function _gcjMsgCount() {
  var box = document.getElementById('game-chat-msgs');
  if (!box) return 0;
  var n = 0;
  Array.prototype.forEach.call(box.children, function (el) { if (!el.classList.contains('gc-sep')) n++; });
  return n;
}
// moving: fade out now; still for a beat: fade back in, then update
function _gcjOnScroll() {
  var J = window._gcj;
  if (!J.moving) {
    J.moving = true;
    if (J.open) J.open = false;
    document.documentElement.classList.add('gcj-moving');
  }
  clearTimeout(J.t);
  J.t = setTimeout(function () {
    J.moving = false;
    _gcjPaint();
    document.documentElement.classList.remove('gcj-moving');
  }, GCJ_STILL_MS);
}
function _gcjSet(el, key, html) {
  var J = window._gcj;
  if (J[key] === html) return;
  J[key] = html;
  el.innerHTML = html;
}
// lay the two layers over the chat as it sits on screen right now
function _gcjPlace(E) {
  var r = E.p.getBoundingClientRect();
  E.top.style.cssText = 'left:' + Math.round(r.left) + 'px;width:' + Math.round(r.width) + 'px;top:' + Math.round(r.top + 8) + 'px';
  E.bot.style.cssText = 'left:' + Math.round(r.left) + 'px;width:' + Math.round(r.width) + 'px;top:' + Math.round(r.bottom - 12) + 'px';
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
  var p = E.p;
  if (!_gcjShowing(p)) { _gcjSet(E.top, 'top', ''); _gcjSet(E.bot, 'bot', ''); J.open = false; return; }
  if (J.moving) return; // it's hidden while moving; paint again once it's still
  _gcjPlace(E);
  var fromBottom = p.scrollHeight - p.scrollTop - p.clientHeight;
  var rail = document.getElementById('mgc'), pr = p.getBoundingClientRect();
  var railGone = !rail || rail.style.display === 'none' || !rail.offsetParent || rail.getBoundingClientRect().bottom < pr.top + 8;
  var long = p.scrollHeight > p.clientHeight * 1.6;
  var showTop = long && p.scrollTop > 320 && railGone;
  var G = _gcjGames();
  var topHtml = '';
  if (showTop || (J.open && G)) {
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
    topHtml = '<div class="gcj-row1">' + (showTop ? '<button type="button" class="gcj-pill" onclick="gcjTop()">' + GCJ_UP + 'Top of chat</button>' : '') + games + '</div>' + list;
  }
  _gcjSet(E.top, 'top', topHtml);
  // Latest
  var count = _gcjMsgCount();
  if (fromBottom < 180) J.base = null;
  else if (J.base == null) J.base = count;
  var fresh = J.base != null ? Math.max(0, count - J.base) : 0;
  _gcjSet(E.bot, 'bot', fromBottom > 300 ? '<button type="button" class="gcj-pill gcj-latest' + (fresh ? ' new' : '') + '" onclick="gcjLatest()">' + GCJ_DOWN + 'Latest' + (fresh ? ' · ' + fresh + ' new' : '') + '</button>' : '');
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
  window.addEventListener('resize', function () { try { _gcjPaint(); } catch (e) {} });
  ['gameDetailTab', 'nav'].forEach(function (name) {
    var f = window[name];
    if (typeof f !== 'function') return;
    window[name] = function () { var r = f.apply(this, arguments); setTimeout(function () { try { _gcjPaint(); } catch (e) {} }, 0); return r; };
  });
  // a new game on screen starts fresh
  if (typeof _showGameScreen === 'function') {
    var prevShow = _showGameScreen;
    _showGameScreen = function () { window._gcj.open = false; window._gcj.base = null; return prevShow.apply(this, arguments); };
  }
})();
