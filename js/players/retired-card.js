// ═══ RETIRED PLAYER'S CARD (v7.80.0) ═════════════════════════════════════
// A player with no current season (retired, any era) gets his career where
// the season lines would be: who he was (position, main team, years, Hall of
// Fame or first-ballot year), the career line, honors, then every season,
// newest first (toggle), World Series years dotted, skipped years marked.
// Data: /api/mlb?mode=career. Hooks _plsLinesFill (player-lines.js) — that
// fills #player-lines whenever the sheet opens or the season line lands; an
// active player's card is left exactly as it was.
// Depends on: _savGet, _escapeHtml, _ghTeamColors, CMP_TEAM (compare.js).

window._sav = window._sav || { pending: {} };
window._sav.career = window._sav.career || {};
window._rcOrder = window._rcOrder || {};

function _rcIsRetired(id) {
  var se = window._sav.season && window._sav.season[String(id)];
  // v7.81.1: MLB answers a retired player's season with his profile and no
  // line at all, so "no hitting and no pitching this season" counts too
  return !!(se && (se.failed || (se.data && (se.data.error || (!se.data.hitting && !se.data.pitching)))));
}
window._rcOrig = window._rcOrig || {};
function _rcAbbr(tid) { return typeof CMP_TEAM !== 'undefined' && CMP_TEAM[tid] ? CMP_TEAM[tid] : ''; }
function _rcN(n) { return typeof n === 'number' && n >= 1000 ? n.toLocaleString('en-US') : String(n); }
function rcFlip(id) { window._rcOrder[id] = !window._rcOrder[id]; _rcFill(id); }
function _rcFill(id) {
  var el = document.getElementById('player-lines');
  if (!el || window._savSheetId !== String(id)) return;
  var d = _savGet('career', String(id), '/api/mlb?mode=career&id=' + encodeURIComponent(id), 24 * 3600e3, function () { if (window._savSheetId === String(id)) _rcFill(id); });
  var bd = document.getElementById('player-link-backdrop');
  if (!d) {
    var e = window._sav.career[String(id)];
    el.innerHTML = e && e.failed ? '' : '<div class="rc"><div class="rc-sk"></div><div class="rc-sk"></div><div class="rc-sk short"></div></div>';
    return;
  }
  // never played in the majors (a prospect): keep the regular season table
  if (!d.seasons || !d.seasons.length) { if (window._rcOrig[String(id)] != null) el.innerHTML = window._rcOrig[String(id)]; return; }
  if (bd) bd.classList.toggle('rc-pre', !!(d.last && d.last < 2015)); // no Statcast before 2015
  var abbr = _rcAbbr(d.mainTeamId), c = abbr && typeof _ghTeamColors === 'function' ? _ghTeamColors(abbr) : null;
  var tint = c ? c.bg : '#3D3580', hi = '#C9C2F5';
  if (c && typeof _gxLum === 'function') [c.accent, c.bg, c.fg].some(function (x) { if (x && _gxLum(x) >= .2 && _gxLum(x) <= .9) { hi = x; return true; } return false; });
  var pit = d.group === 'pitching', k = d.career || {};
  var who = [d.pos, abbr, d.first ? d.first + '–' + (d.active ? '' : d.last) : '', d.hof ? 'Hall of Fame' : d.active ? '' : 'Retired'].filter(Boolean).join(' · ');
  var sub = [d.seasonsPlayed ? d.seasonsPlayed + (d.seasonsPlayed === 1 ? ' season' : ' seasons') : '', d.bats ? 'Bats ' + d.bats : '', d.throws ? 'Throws ' + d.throws : ''].filter(Boolean).join(' · ');
  var cell = function (v, l, span) { return '<div' + (span ? ' class="span2"' : '') + '><b>' + _escapeHtml(v == null || v === '' ? '—' : String(v)) + '</b><small>' + l + '</small></div>'; };
  var grid = pit
    ? cell(k.w != null ? k.w + '–' + k.l : null, 'W–L') + cell(k.era, 'ERA') + cell(k.whip, 'WHIP') + cell(k.k != null ? _rcN(k.k) : null, 'K') + cell(k.ip ? String(k.ip).replace(/^(\d+)(\d{3})/, '$1,$2') : null, 'IP', 1) + cell(k.g != null ? _rcN(k.g) + (k.gs ? ' / ' + _rcN(k.gs) : '') : null, 'G / GS', 1)
    : cell(k.avg, 'BA') + cell(k.obp, 'OBP') + cell(k.slg, 'SLG') + cell(k.ops, 'OPS') + cell(k.h != null ? _rcN(k.h) : null, 'H') + cell(k.hr, 'HR') + cell(k.rbi != null ? _rcN(k.rbi) : null, 'RBI') + cell(k.g != null ? _rcN(k.g) : null, 'G');
  var chips = [];
  if (d.rings) chips.push('<span class="rc-chip gold">' + (d.rings > 1 ? d.rings + '× ' : '') + 'World Series' + '</span>');
  (d.honors || []).filter(function (h) { return !/world series/i.test(h.name); }).slice(0, 8).forEach(function (h) {
    var big = /MVP|Cy Young|Rookie of the Year/i.test(h.name);
    chips.push('<span class="rc-chip' + (big ? ' big' : '') + '">' + _escapeHtml(h.n > 1 ? h.n + '× ' + h.name : (h.years[0] ? h.years[0] + ' ' : '') + h.name) + '</span>');
  });
  var oldest = !!window._rcOrder[id];
  var rows = (d.seasons || []).slice();
  if (oldest) rows.reverse();
  var head = pit ? ['W–L', 'ERA', 'IP', 'K'] : ['G', 'H', 'HR', 'RBI', 'BA'];
  var cols = 'grid-template-columns:58px repeat(' + head.length + ',minmax(0,1fr))';
  var table = '<div class="rc-yh" style="' + cols + '"><span>YEAR</span>' + head.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' + rows.map(function (r) {
    var yr = '<span class="rc-yr"><b>' + r.y + '</b>' + (r.champ ? '<i class="rc-dot" title="Won the World Series"></i>' : '') + (r.teams && r.teams.length && (r.teams.length > 1 || r.teams[0] !== d.mainTeamId) ? '<small>' + _escapeHtml(r.teams.map(_rcAbbr).filter(Boolean).join('/')) + '</small>' : '') + '</span>';
    if (r.dnp) return '<div class="rc-row dnp" style="' + cols + '">' + yr + '<span class="rc-dnp">Didn’t play</span></div>';
    var v = pit ? [r.wl.replace('-', '–'), r.era, String(r.ip).replace(/^(\d+)(\d{3})/, '$1,$2'), r.k] : [r.g, r.h, r.hr, r.rbi, r.ba];
    return '<div class="rc-row" style="' + cols + '">' + yr + v.map(function (x) { return '<span>' + _escapeHtml(x == null ? '—' : String(x)) + '</span>'; }).join('') + '</div>';
  }).join('');
  el.innerHTML = '<div class="rc" style="--rc-tint:' + tint + ';--rc-hi:' + hi + '">' +
    '<div class="rc-top"><div class="rc-who">' + _escapeHtml(who) + '</div>' + (sub ? '<div class="rc-sub">' + _escapeHtml(sub) + '</div>' : '') +
    (d.hofEligible ? '<div class="rc-elig"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM12 13v4M8 20h8"/></svg>Eligible for the Hall of Fame in ' + d.hofEligible + '</div>' : '') + '</div>' +
    '<div class="rc-box"><div class="rc-eb"><span>CAREER</span>' + (k.g != null && !pit ? '<span>' + _rcN(k.g) + ' GAMES</span>' : '') + '</div><div class="rc-grid">' + grid + '</div></div>' +
    (chips.length ? '<div class="rc-chips">' + chips.join('') + '</div>' : '') +
    '<div class="rc-box rc-years"><div class="rc-eb"><span>YEAR BY YEAR</span><button type="button" class="rc-order" onclick="rcFlip(' + JSON.stringify(String(id)).replace(/"/g, '&quot;') + ')">' + (oldest ? 'Oldest first' : 'Newest first') + '</button></div>' + table +
    (rows.some(function (r) { return r.champ; }) ? '<div class="rc-key"><i class="rc-dot"></i>Won the World Series</div>' : '') + '</div></div>';
}
(function () {
  if (typeof _plsLinesFill !== 'function') return;
  var prev = _plsLinesFill;
  _plsLinesFill = function (id) {
    var r = prev.apply(this, arguments);
    var bd = document.getElementById('player-link-backdrop');
    if (bd) bd.classList.remove('rc-pre');
    var el = document.getElementById('player-lines');
    if (el) window._rcOrig[String(id)] = el.innerHTML;
    if (_rcIsRetired(id)) _rcFill(id);
    return r;
  };
})();
