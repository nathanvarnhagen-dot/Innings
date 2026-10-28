// ── REPLAY REVIEW (v7.83.0) ────────────────────────────────────────────
// Manager challenges and crew-chief reviews of a play (box.review from
// api/mlb.js; ABS pitch challenges keep their own notice). While the play
// is being looked at, a banner sits across the top of the at-bat square
// with a scanning sweep; once it's ruled on, the result (overturned / call
// stands) stays for ten seconds. A review that was already finished when
// you opened the game doesn't flash. Rides on _absNoticeHtml, so it shows
// wherever the ABS notice does, and takes its place while it's up.
window._rvwSeen = window._rvwSeen || { game: null, at: {} };

function _rvwAbbr(box, side) {
  if (!box || !side) return '';
  return side === 'away' ? (box.awayAbbr || _ghAbbrFallback(box.away || '')) : (box.homeAbbr || _ghAbbrFallback(box.home || ''));
}
function _rvwCap(t) { t = String(t || ''); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }
function _rvwLeft(box, side) {
  var c = box && box.challenges, t = c && side ? c[side] : null;
  return (t && t.remaining != null) ? t.remaining : null;
}

function _rvwNoticeHtml(box) {
  var rv = box && box.review;
  if (!rv || (!rv.live && !rv.last)) return '';
  var g = window._activeBrowseGame, pk = g ? String(g.gamePk) : String((box && box.gamePk) || ''), S = window._rvwSeen;
  var first = S.game !== pk;
  if (first) { S.game = pk; S.at = {}; }
  var now = Date.now(), show = null, showAt = now;
  if (rv.live) {
    var lk = 'r:' + (rv.live.atBatIndex != null ? rv.live.atBatIndex : '?') + ':' + (rv.live.code || '');
    if (S.at[lk] == null) S.at[lk] = now;
    show = rv.live; showAt = S.at[lk];
  } else {
    var d = rv.last, dk = 'd:' + d.atBatIndex + ':' + (d.code || '') + ':' + (d.overturned ? 'o' : 's');
    if (S.at[dk] == null) S.at[dk] = first ? 0 : now;
    var t = S.at[dk];
    if (t && now - t < 10000) { show = d; showAt = t; }
  }
  if (!show) return '';
  var who = _rvwAbbr(box, show.side);
  var head = show.kind === 'challenge' ? (who ? who + ' challenge' : 'Manager challenge') : 'Crew chief review';
  // the challenging team's colors: its main color fills the icon, its
  // lighter one runs down the edge (navy alone disappears on the dark card)
  var acc = '#5AB0FF', tbg = '#2B4E86';
  if (show.kind === 'challenge' && who && typeof _ghTeamColors === 'function') {
    var tc = _ghTeamColors(who), L = typeof _gxLum === 'function' ? _gxLum : null;
    tbg = tc.bg;
    acc = (L && tc.accent && L(tc.accent) > .2) ? tc.accent : (L && L(tc.bg) > .2 ? tc.bg : '#A89FE8');
  }
  var reason = _rvwCap(show.reason);
  var left = show.kind === 'challenge' ? _rvwLeft(box, show.side) : null;
  var cls, big, sub;
  if (show.inProgress) {
    cls = 'live'; big = 'UNDER REVIEW'; sub = head + (reason ? ' · ' + reason : '');
  } else {
    var txt = String(show.text || '');
    var stands = !show.overturned;
    cls = stands ? 'st' : 'ov';
    big = stands ? (/confirmed/i.test(txt) ? 'CALL CONFIRMED' : 'CALL STANDS') : 'CALL OVERTURNED';
    sub = head + (reason ? ' · ' + reason : '');
  }
  var ic = show.inProgress
    ? '<span class="rvw-ic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg></span>'
    : '<span class="rvw-ic" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">' + (show.overturned ? '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>' : '<path d="M5 12l5 5 9-10"/>') + '</svg></span>';
  var leftHtml = left != null ? '<span class="rvw-left"><b>' + left + '</b>left</span>' : '';
  return '<div class="rvw-nt ' + cls + '" role="status" aria-live="polite" style="--t0:' + (showAt - now) + 'ms;--acc:' + acc + ';--tbg:' + tbg + '">' + ic +
    '<span class="rvw-tx"><span class="t">' + _escapeHtml(big) + '</span><span class="s">' + _escapeHtml(sub) + '</span></span>' + leftHtml + '</div>';
}

// The square's notice slot: a review takes the ABS notice's place while up
(function () {
  if (typeof _absNoticeHtml !== 'function') return;
  var prev = _absNoticeHtml;
  _absNoticeHtml = function (seq, box) {
    var r = _rvwNoticeHtml(box);
    return r || prev.apply(this, arguments);
  };
})();
