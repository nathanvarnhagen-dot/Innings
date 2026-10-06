// ══ MESSAGE SPOTLIGHT (v7.17.0) — double-tap a message, iPhone style ══
// Double-tapping a message (or a play) used to slide up a plain sheet.
// Now, like iMessage: everything else blurs, the message lifts in place,
// a tapback bubble springs out above it and an iOS context menu opens
// below it. Same choices as before — the six reactions, Reply, and Edit /
// Delete on your own messages — plus Copy. Tap anywhere to close.
//
// Built on top of the existing sheet, not instead of it: the actions call
// the same _pickReaction / _reactionSheetReply / _reactionSheetEdit /
// _reactionSheetDelete as before, and if the tapped element can't be found
// (or isn't on screen) the old sheet opens like it always did.

(function () {
  if (typeof openReactionSheet !== 'function') return;

  var MS_LABELS = { '❤️': 'Love', '👍': 'Like', '👎': 'Dislike', '😂': 'Haha', '‼️': 'Emphasize', '❓': 'Question' };
  var MS_ICON = {
    reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>'
  };

  // Remember which element was double-tapped — the tap helpers get it as
  // their first argument, openReactionSheet doesn't.
  window._msgSpotAnchor = null;
  ['_msgDoubleTap', '_playDoubleTap', '_linkCardTap'].forEach(function (name) {
    var f = window[name];
    if (typeof f !== 'function') return;
    window[name] = function (el) {
      window._msgSpotAnchor = { el: el, ts: Date.now() };
      return f.apply(this, arguments);
    };
  });

  var _origOpen = window.openReactionSheet;
  var _origClose = window.closeReactionSheet;

  window.openReactionSheet = function (collection, msgId, canDelete, onDone, playContext) {
    var a = window._msgSpotAnchor;
    window._msgSpotAnchor = null;
    var el = a && Date.now() - a.ts < 1500 ? a.el : null;
    if (!el || !el.isConnected || !_msSpotOk(el)) return _origOpen.apply(this, arguments);
    window._reactionSheetTarget = { collection: collection, msgId: msgId, onDone: onDone, playContext: playContext };
    _msOpen(el, { collection: collection, msgId: msgId, canDelete: !!canDelete, playContext: playContext || null });
  };
  window.closeReactionSheet = function () {
    _origClose.apply(this, arguments);
    _msClose();
  };

  function _msSpotOk(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  }

  // A copy of the bubble that looks exactly like it, wherever it's placed:
  // chat styles hang off their screen (#game-chat-msgs .bubble.them …), so
  // the clone carries its computed styles inline.
  function _msSnapshot(src) {
    var clone = src.cloneNode(true);
    var from = [src].concat([].slice.call(src.querySelectorAll('*')));
    var to = [clone].concat([].slice.call(clone.querySelectorAll('*')));
    for (var i = 0; i < from.length && i < to.length; i++) {
      var d = to[i];
      if (!d.style) continue;
      var cs = getComputedStyle(from[i]), css = '';
      for (var j = 0; j < cs.length; j++) css += cs[j] + ':' + cs.getPropertyValue(cs[j]) + ';';
      d.style.cssText = css + 'animation:none;transition:none;';
      d.removeAttribute('id');
      d.removeAttribute('onclick');
    }
    clone.setAttribute('aria-hidden', 'true');
    return clone;
  }

  function _msHaptic() {
    try {
      var H = typeof innings_plugin === 'function' ? innings_plugin('Haptics') : null;
      if (H && H.impact) { var p = H.impact({ style: 'LIGHT' }); if (p && p.catch) p.catch(function () {}); }
    } catch (e) {}
  }

  function _msText(el, o) {
    if (o.playContext) return o.playContext.text || '';
    var t = el.querySelector('.b-txt');
    return t ? (t.innerText || t.textContent || '').trim() : '';
  }

  function _msOpen(el, o) {
    _msKill();
    var r = el.getBoundingClientRect();
    var vw = window.innerWidth, vh = window.innerHeight;
    var right = el.classList.contains('me') || (!o.playContext && r.left + r.width / 2 > vw / 2 + 24);
    var text = _msText(el, o);

    var ms = document.createElement('div');
    ms.id = 'msg-spot';
    ms.className = 'ms' + (right ? ' r' : '');
    ms.setAttribute('role', 'dialog');
    ms.setAttribute('aria-modal', 'true');
    ms.setAttribute('aria-label', 'Message actions');

    var veil = document.createElement('div');
    veil.className = 'ms-veil';
    ms.appendChild(veil);

    var lift = _msSnapshot(el);
    lift.classList.add('ms-lift');
    lift.style.position = 'absolute';
    lift.style.left = r.left + 'px';
    lift.style.top = r.top + 'px';
    lift.style.width = r.width + 'px';
    lift.style.height = r.height + 'px';
    lift.style.margin = '0';
    lift.style.maxWidth = 'none';
    lift.style.boxSizing = 'border-box';
    lift.style.pointerEvents = 'none';
    lift.style.transition = 'transform .5s cubic-bezier(.32,1.35,.5,1)';
    lift.style.transformOrigin = (right ? '100%' : '0%') + ' 50%';
    ms.appendChild(lift);

    var tb = document.createElement('div');
    tb.className = 'ms-tb';
    tb.setAttribute('role', 'group');
    tb.setAttribute('aria-label', 'React');
    tb.innerHTML = (typeof REACTION_EMOJIS !== 'undefined' ? REACTION_EMOJIS : ['❤️', '👍', '👎', '😂', '‼️', '❓']).map(function (e, i) {
      return '<button type="button" data-e="' + e + '" style="--d:' + (0.04 + i * 0.03).toFixed(2) + 's" aria-label="' + (MS_LABELS[e] || e) + '">' + e + '</button>';
    }).join('');
    ms.appendChild(tb);

    var items = [{ k: 'reply', label: 'Reply' }];
    if (text) items.push({ k: 'copy', label: 'Copy' });
    if (o.canDelete) { items.push({ k: 'edit', label: 'Edit' }); items.push({ k: 'del', label: 'Delete', cls: ' del gap' }); }
    var menu = document.createElement('div');
    menu.className = 'ms-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = items.map(function (it) {
      return '<button type="button" role="menuitem" class="ms-mi' + (it.cls || '') + '" data-k="' + it.k + '"><span>' + it.label + '</span>' + MS_ICON[it.k] + '</button>';
    }).join('');
    ms.appendChild(menu);

    document.body.appendChild(ms);

    // Where everything goes: tapback above, menu below, and the message
    // nudged up or down so all three fit on screen.
    var GAP = 10, TOP = 54, BOTTOM = vh - 20, EDGE = 10;
    var tbH = tb.offsetHeight + 8, tbW = tb.offsetWidth, mH = menu.offsetHeight, mW = menu.offsetWidth;
    var shift = 0;
    var tbTop = r.top - GAP - tbH;
    if (tbTop < TOP) shift = TOP - tbTop;
    var mTop = r.bottom + GAP + shift;
    if (mTop + mH > BOTTOM) shift -= Math.min(mTop + mH - BOTTOM, Math.max(0, r.top + shift - TOP - tbH - GAP));
    tbTop = r.top + shift - GAP - tbH;
    mTop = Math.min(r.bottom + shift + GAP, BOTTOM - mH);
    var tbLeft = right ? r.right - tbW + 6 : r.left - 6;
    var mLeft = right ? r.right - mW : r.left;
    tbLeft = Math.max(EDGE, Math.min(vw - EDGE - tbW, tbLeft));
    mLeft = Math.max(EDGE, Math.min(vw - EDGE - mW, mLeft));
    tb.style.left = tbLeft + 'px'; tb.style.top = tbTop + 'px';
    menu.style.left = mLeft + 'px'; menu.style.top = mTop + 'px';
    var tailX = right ? Math.max(18, Math.min(tbW - 18, r.right - tbLeft - 26)) : Math.max(18, Math.min(tbW - 18, r.left - tbLeft + 26));
    tb.style.setProperty('--tail', tailX + 'px');
    tb.style.transformOrigin = tailX + 'px 100%';
    menu.style.transformOrigin = (right ? (r.right - mLeft) : (r.left - mLeft + 20)) + 'px 0';

    ms._src = el;
    ms._shift = shift;
    el.style.visibility = 'hidden';

    // Go: blur in, lift, spring the tapback and menu open
    void ms.offsetWidth;
    ms.classList.add('on');
    lift.style.transform = 'translateY(' + shift + 'px) scale(1.035)';
    _msHaptic();

    veil.addEventListener('click', function () { closeReactionSheet(); });
    ms.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    tb.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-e]');
      if (!b || ms._closing) return;
      b.classList.add('hit');
      _msHaptic();
      setTimeout(function () { _pickReaction(b.getAttribute('data-e')); }, 140);
    });
    menu.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-k]');
      if (!b || ms._closing) return;
      var k = b.getAttribute('data-k');
      if (k === 'reply') _reactionSheetReply();
      else if (k === 'edit') _reactionSheetEdit();
      else if (k === 'del') _reactionSheetDelete();
      else if (k === 'copy') {
        closeReactionSheet();
        var done = function () { if (typeof ib_toast === 'function') ib_toast('Copied'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
      }
    });
    ms._key = function (e) { if (e.key === 'Escape') closeReactionSheet(); };
    document.addEventListener('keydown', ms._key);

    // Your current reaction gets the blue circle, like iMessage
    var user = window.currentUser || (window.auth && window.auth.currentUser);
    if (window.db && user && o.collection && o.msgId) {
      window.db.collection(o.collection).doc(o.msgId).get().then(function (d) {
        var mine = d && d.exists && ((d.data() || {}).reactions || {})[user.uid];
        if (!mine || ms._closing) return;
        var b = tb.querySelector('button[data-e="' + mine + '"]');
        if (b) b.classList.add('on');
      }).catch(function () {});
    }
  }

  function _msClose() {
    var ms = document.getElementById('msg-spot');
    if (!ms || ms._closing) return;
    ms._closing = true;
    ms.classList.remove('on');
    ms.classList.add('off');
    var lift = ms.querySelector('.ms-lift');
    if (lift) { lift.style.transition = 'transform .3s cubic-bezier(.3,.7,.4,1)'; lift.style.transform = 'none'; }
    if (ms._key) document.removeEventListener('keydown', ms._key);
    setTimeout(function () { _msFinish(ms); }, 300);
  }
  function _msFinish(ms) {
    if (ms._src && ms._src.style) ms._src.style.visibility = '';
    if (ms.parentNode) ms.parentNode.removeChild(ms);
  }
  function _msKill() {
    var ms = document.getElementById('msg-spot');
    if (!ms) return;
    if (ms._key) document.removeEventListener('keydown', ms._key);
    _msFinish(ms);
  }
})();
