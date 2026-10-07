// ══ DESKTOP GAME CHAT (v7.22.0) ══════════════════════════════════════════
// On a laptop the game's chat is its own full-height column on the right:
//   · a header — "Game chat", LIVE while the game is on, who else is
//     watching and their faces (the "also watching" row moves up here)
//   · messages in readable bubbles, a run of messages from the same person
//     grouped (name on the first, time on the last, avatar once), and a
//     time line between gaps of 15 minutes or more
//   · the game header (score bug + tabs) stays in the game's column, so it
//     can never slide over the chat again
// Phones and iPads are untouched: everything here is keyed to html.desk.
(function () {
  function desk() { return typeof _isDesk === 'function' && _isDesk(); }

  // ── the column's header
  function ensureHd() {
    var scr = document.getElementById('screen-game');
    if (!scr) return null;
    var hd = document.getElementById('gdc-hd');
    if (!hd) {
      hd = document.createElement('div');
      hd.id = 'gdc-hd';
      hd.innerHTML = '<div class="gdc-l"><div class="gdc-t">Game chat<span class="gdc-live" id="gdc-live" hidden><i></i>LIVE</span></div><div class="gdc-sub" id="gdc-sub"></div></div><div class="gdc-faces" id="gdc-faces" aria-hidden="true"></div>';
      scr.appendChild(hd);
    }
    return hd;
  }
  function initials(n) { return String(n || '?').trim().charAt(0).toUpperCase() || '?'; } // one letter fits the small faces
  function fillHd() {
    if (!ensureHd()) return;
    var g = window._activeBrowseGame, W = window._gameWatchers;
    var people = (W && g && String(W.gamePk) === String(g.gamePk)) ? (W.people || []) : [];
    var names = people.map(function (p) { return p.first; });
    var sub = document.getElementById('gdc-sub'), faces = document.getElementById('gdc-faces'), live = document.getElementById('gdc-live');
    if (sub) sub.textContent = names.length ? (typeof _watchingWithLabel === 'function' ? _watchingWithLabel(names) : names.join(', ') + ' also watching') : 'Anyone with the link can join';
    if (faces) {
      var me = (window.userData && window.userData.name) || 'You';
      faces.innerHTML = people.slice(0, 3).map(function (p) { return '<span class="gdc-f">' + _escapeHtml(initials(p.name)) + '</span>'; }).join('') + '<span class="gdc-f me">' + _escapeHtml(initials(me)) + '</span>';
    }
    if (live) live.hidden = !(typeof _gshLive === 'function' && _gshLive());
  }
  window._gdcFillHd = fillHd;

  // ── grouping: runs from the same person, and time lines between gaps
  var GROUP = 5 * 60e3, GAP = 15 * 60e3;
  function sepLabel(ts) {
    if (!ts) return '';
    var d = new Date(ts), now = new Date(), t = typeof _fmtTime === 'function' ? _fmtTime(ts) : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return 'Today ' + t;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' + t;
  }
  function same(a, b) { return !!(a && b && !a.systemType && !b.systemType && a.uid && a.uid === b.uid && Math.abs((b.ts || 0) - (a.ts || 0)) < GROUP); }
  function group(msgs) {
    var box = document.getElementById('game-chat-msgs');
    if (!box || !msgs) return;
    var kids = Array.prototype.slice.call(box.children);
    if (kids.length !== msgs.length) return; // someone else changed the list; leave it be
    msgs.forEach(function (m, i) {
      var el = kids[i], p = msgs[i - 1], n = msgs[i + 1];
      var wp = same(p, m), wn = same(m, n);
      el.classList.add(wp ? (wn ? 'gc-mid' : 'gc-last') : (wn ? 'gc-first' : 'gc-solo'));
      if (!p || (m.ts || 0) - (p.ts || 0) >= GAP) {
        var s = document.createElement('div');
        s.className = 'gc-sep';
        s.textContent = sepLabel(m.ts);
        box.insertBefore(s, el);
      }
    });
  }

  if (typeof renderGameChat === 'function') {
    var prevRender = renderGameChat;
    renderGameChat = function (msgs) {
      var r = prevRender.apply(this, arguments);
      try { group(msgs); } catch (e) { console.error('[desk chat]', e); }
      return r;
    };
  }
  if (typeof _renderGameWatchers === 'function') {
    var prevW = _renderGameWatchers;
    _renderGameWatchers = function () { var r = prevW.apply(this, arguments); try { fillHd(); } catch (e) {} return r; };
  }
  if (typeof _showGameScreen === 'function') {
    var prevShow = _showGameScreen;
    _showGameScreen = function () { var r = prevShow.apply(this, arguments); try { fillHd(); } catch (e) {} return r; };
  }
  if (typeof _gshRefresh === 'function') {
    var prevRef = _gshRefresh;
    _gshRefresh = function () { var r = prevRef.apply(this, arguments); try { fillHd(); } catch (e) {} return r; };
  }
  fillHd();
})();
