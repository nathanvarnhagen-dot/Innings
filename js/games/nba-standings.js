// ══ NBA STANDINGS (v7.90.0) ═══════════════════════════════════════════════
// The trophy at the top of the NBA Games page opens this screen: East, West
// and the six divisions. Each conference runs 1–15 with lines under the top
// six (in the playoffs) and tenth (the play-in). Tap a team for its page.
// Data: /api/espn?league=nba&mode=standings, kept for five minutes.
// Depends on: nav, openTeamPage (team-page.js), _teamLook (team-colors.js),
// _ppGb (playoffs-and-favorite-teams.js), _escapeHtml.
window._ns = window._ns || { tab: 'east', data: null, at: 0, loading: false };
var NS_TTL = 5 * 60e3;

function openNbaStandings() {
  nav('nba-standings');
  nsShowTab(window._ns.tab);
  _nsLoad();
}
function _nsLoad() {
  var N = window._ns;
  if (N.loading || (N.data && Date.now() - N.at < NS_TTL)) return;
  N.loading = true;
  fetch('/api/espn?league=nba&mode=standings')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      N.loading = false;
      if (!d || d.error || !d.east || !d.west) throw new Error((d && d.error) || 'empty standings');
      N.data = d; N.at = Date.now();
      _nsRender();
    })
    .catch(function (err) {
      N.loading = false;
      console.error('[nba standings]', err);
      if (!N.data) _nsMsg('Standings aren\'t available right now.');
    });
}
function _nsMsg(text) {
  var el = document.getElementById('ns-content');
  if (el) el.innerHTML = '<div class="ns-msg">' + _escapeHtml(text) + '</div>';
}
function nsShowTab(key) {
  window._ns.tab = key;
  var tabs = document.getElementById('ns-tabs');
  if (tabs) tabs.innerHTML = [['east', 'East'], ['west', 'West'], ['div', 'Divisions']].map(function (t) {
    var on = key === t[0];
    return '<button onclick="nsShowTab(\'' + t[0] + '\')" style="flex:1;text-align:center;padding:9px 4px;border-radius:12px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit;background:' +
      (on ? 'rgba(168,159,232,.2)' : 'rgba(255,255,255,.05)') + ';color:' + (on ? '#fff' : 'rgba(255,255,255,.45)') + ';border:1px solid ' + (on ? 'rgba(168,159,232,.4)' : 'transparent') + '">' + t[1] + '</button>';
  }).join('');
  _nsRender();
}
function _nsHeadHtml() {
  return '<div class="ns-hdr"><i></i><i></i><i></i><span>W-L</span><span>GB</span><span>L10</span><span>STK</span></div>';
}
function _nsRowHtml(t, rank, leader) {
  var C = ((window._ns.data && window._ns.data.teamColors) || {})[t.abbr] || {};
  var L = _teamLook('nba', t.name, t.abbr, C.color, C.alt);
  var strk = t.strk || '–';
  var ring = L.ring ? ';box-shadow:inset 0 0 0 1.5px ' + L.ring : '';
  return '<button class="ns-row" data-id="' + _escapeHtml(t.id || '') + '" data-name="' + _escapeHtml(t.name) + '" onclick="openTeamPage(\'nba\',this.dataset.id,this.dataset.name)">' +
    '<span class="ns-rk">' + rank + '</span>' +
    '<span class="ns-bdg" style="background:' + _escapeHtml(L.bg) + ';color:' + _escapeHtml(L.fg) + ring + '">' + _escapeHtml(L.abbr || '') + '</span>' +
    '<span class="ns-nm">' + _escapeHtml(t.short || t.name) + '</span>' +
    '<span class="ns-wl">' + t.w + '-' + t.l + '</span>' +
    '<span class="ns-v">' + _ppGb(leader.w, leader.l, t.w, t.l) + '</span>' +
    '<span class="ns-v">' + _escapeHtml(t.l10 || '–') + '</span>' +
    '<span class="ns-v' + (/^W/.test(strk) ? ' w' : /^L/.test(strk) ? ' l' : '') + '">' + _escapeHtml(strk) + '</span>' +
    '</button>';
}
function _nsCutHtml(label) {
  return '<div class="pp-wc-cutline ns-cut"><span>' + label + '</span></div>';
}
function _nsConfHtml(list) {
  var html = _nsHeadHtml();
  list.forEach(function (t, i) {
    html += _nsRowHtml(t, i + 1, list[0]);
    if (i === 5 && list.length > 6) html += _nsCutHtml('Play-in');
    if (i === 9 && list.length > 10) html += _nsCutHtml('Out');
  });
  return html;
}
function _nsDivHtml(divs) {
  return ['east', 'west'].map(function (conf) {
    var mine = divs.filter(function (d) { return d.conf === conf; });
    if (!mine.length) return '';
    return '<div class="pp-section-title">' + (conf === 'east' ? 'Eastern' : 'Western') + ' Conference</div>' + mine.map(function (d) {
      return '<div class="ns-div"><div class="pp-div-name">' + _escapeHtml(d.name) + '</div>' + _nsHeadHtml() +
        d.teams.map(function (t, i) { return _nsRowHtml(t, i + 1, d.teams[0]); }).join('') + '</div>';
    }).join('');
  }).join('');
}
function _nsRender() {
  var el = document.getElementById('ns-content'), N = window._ns;
  if (!el) return;
  if (!N.data) { _nsMsg('Loading standings…'); return; }
  var sub = '<div class="ns-sub">' + (N.data.season ? _escapeHtml(N.data.season) + ' · ' : '') +
    (N.tab === 'div' ? 'Games back from the division leader' : 'Top 6 make the playoffs · 7–10 play in') + '</div>';
  el.innerHTML = sub + (N.tab === 'div' ? _nsDivHtml(N.data.divisions || []) : _nsConfHtml(N.data[N.tab] || []));
}
