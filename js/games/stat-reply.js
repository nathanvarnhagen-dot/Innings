// ══ REPLY TO A STAT (v7.18.0) ═══════════════════════════════════════════
// In a game, tap anything on a player card — a stat line (Postseason,
// Regular season, Last 7/14/30), a Savant percentile, his career line in
// this matchup, a pitch in his arsenal, sprint or bat speed — and a
// "Reply in chat" callout pops up over it. Tap it: the card closes, the
// game's Chat opens with the stat quoted above the composer, the same way
// replying to a play works. In the chat the quote opens his card again.
// Only in a game (that's where the chat is); elsewhere the card is as it was.

var SQ_SEL = '.pll-r:not(.pll-h), .sav-pct, .sav-bvp, .sav-ars:not(.sav-ars-h), .sav-x';
window._sqSel = null;

function _sqInGame() {
  var s = document.getElementById('screen-game');
  return !!(s && s.classList.contains('active') && window._activeBrowseGame);
}
function _sqName() {
  var el = document.getElementById('player-link-name');
  return el ? (el.textContent || '').trim() : '';
}
function _sqT(el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
function _sqOrd(n) { n = Number(n); return typeof _ordinalSuffix === 'function' ? _ordinalSuffix(n) : n + 'th'; }

// What a tapped element says, as { label, text } — label is what it is
// ("2026 postseason", "Hitting percentiles · 2026"), text the numbers
function _sqQuoteOf(el) {
  if (el.classList.contains('pll-r')) {
    var tbl = el.parentNode, hd = tbl && tbl.querySelector('.pll-h');
    if (!hd) return null;
    var cols = [].map.call(hd.querySelectorAll('b'), _sqT);
    var year = _sqT(hd.querySelector('span'));
    var span = el.querySelector('span'), small = span && span.querySelector('small');
    var label = span && span.firstChild ? _sqT(span.firstChild) : '';
    var parts = [];
    [].forEach.call(el.querySelectorAll(':scope > b'), function (b, i) {
      var v = _sqT(b);
      if (v && v !== '—' && cols[i]) parts.push(v + '\u00a0' + cols[i]); // kept together when the quote wraps
    });
    if (!parts.length) return null;
    var g = small ? _sqT(small).replace(/^(\d+) G$/, function (m, n) { return n + (n === '1' ? '\u00a0game' : '\u00a0games'); }) : '';
    if (g && !/^No games/.test(g)) parts.push(g);
    if (/^(Postseason|Regular season)$/.test(label) && year) label = year + ' ' + label.toLowerCase();
    return { label: label, text: parts.join(' · ') };
  }
  if (el.classList.contains('sav-pct')) {
    var sec = el.closest('.sav-sec'), eb = sec && sec.querySelector('.gh-eyebrow');
    var n = _sqT(el.querySelector('.sav-pct-bar b'));
    if (!n) return null;
    return { label: _sqT(eb) || 'Statcast', text: _sqT(el.querySelector('.sav-pct-l')) + ': ' + _sqOrd(n) + ' percentile' };
  }
  if (el.classList.contains('sav-bvp')) {
    var nums = [].map.call(el.querySelectorAll('.gh-num'), _sqT);
    var labs = [].map.call(el.children, _sqT).slice(nums.length);
    var bits = nums.map(function (v, i) { return v + '\u00a0' + (labs[i] || ''); });
    return { label: (el.getAttribute('data-who') || 'This matchup') + ' (career)', text: bits.join(' · ') };
  }
  if (el.classList.contains('sav-ars')) {
    var c = [].map.call(el.children, _sqT);
    var a = [c[0]];
    if (c[1] && c[1] !== '—') a.push(c[1] + '\u00a0use');
    if (c[2] && c[2] !== '—') a.push(c[2] + '\u00a0mph');
    if (c[3] && c[3] !== '—') a.push(c[3] + '\u00a0whiff');
    if (c[4] && c[4] !== '—') a.push(c[4] + '\u00a0RV/100');
    return { label: 'Pitch arsenal', text: a.join(' · ') };
  }
  if (el.classList.contains('sav-x')) return { label: 'Statcast', text: _sqT(el) };
  return null;
}

function _sqClear() {
  document.querySelectorAll('#player-link-backdrop .sq-on').forEach(function (x) { x.classList.remove('sq-on'); });
  document.querySelectorAll('#player-link-backdrop .sq-pill').forEach(function (x) { if (x.parentNode) x.parentNode.removeChild(x); });
  window._sqSel = null;
}
function _sqSelect(el) {
  _sqClear();
  var q = _sqQuoteOf(el), name = _sqName();
  if (!q || !q.text || !name) return;
  window._sqSel = { player: name, playerId: window._savSheetId || null, label: q.label, text: q.text };
  el.classList.add('sq-on');
  var pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'sq-pill';
  pill.setAttribute('aria-label', 'Reply in chat: ' + q.label + ', ' + q.text);
  pill.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>Reply in chat';
  pill.addEventListener('click', function (e) { e.stopPropagation(); sqReply(); });
  el.appendChild(pill);
  // keep the callout on screen when the row is at the top of the sheet
  var sheet = el.closest('#player-link-backdrop > div'), pr = pill.getBoundingClientRect(), sr = sheet && sheet.getBoundingClientRect();
  if (sr && pr.top < sr.top + 4) pill.classList.add('below');
}
function sqReply() {
  var q = window._sqSel;
  if (!q) return;
  _sqClear();
  if (typeof closePlayerLinkSheet === 'function') closePlayerLinkSheet();
  if (typeof gameDetailTab === 'function') gameDetailTab('chat');
  if (typeof _setReplyTarget !== 'function') return;
  _setReplyTarget('gameChats', null, q.player + ' · ' + q.label, q.text);
  if (window._replyingTo) window._replyingTo.stat = { player: q.player, playerId: q.playerId, label: q.label, text: q.text };
}
// The quote in chat opens his card again
function sqOpenCard(name, id) {
  if (typeof openPlayerLinkSheet === 'function' && name) openPlayerLinkSheet(name, id || null, 'mlb');
}

(function () {
  var bd = document.getElementById('player-link-backdrop');
  if (!bd) return;
  bd.addEventListener('click', function (e) {
    if (!bd.classList.contains('sq-live')) return;
    if (e.target.closest('.sq-pill')) return;
    var el = e.target.closest(SQ_SEL);
    if (!el || e.target.closest('a, button, input, label')) { _sqClear(); return; }
    if (el.classList.contains('sq-on')) { _sqClear(); return; }
    _sqSelect(el);
  });
  // on in a game, off anywhere else; a fresh card starts with nothing picked
  if (typeof openPlayerLinkSheet === 'function') {
    var orig = openPlayerLinkSheet;
    openPlayerLinkSheet = function (name, id, league) {
      var r = orig.apply(this, arguments);
      _sqClear();
      var on = _sqInGame() && league === 'mlb';
      bd.classList.toggle('sq-live', on);
      var hint = document.getElementById('sq-hint');
      if (!hint) {
        var nm = document.getElementById('player-link-name');
        if (nm) { hint = document.createElement('div'); hint.id = 'sq-hint'; hint.textContent = 'Tap any stat to reply in chat'; nm.parentNode.insertBefore(hint, nm.nextSibling); }
      }
      if (hint) hint.style.display = on ? '' : 'none';
      return r;
    };
  }
})();
