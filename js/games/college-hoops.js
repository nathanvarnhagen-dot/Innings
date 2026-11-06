// ══ COLLEGE BASKETBALL (v7.91.0) ═══════════════════════════════════════
// Men's Division I, on the same live court, panel, arena board and player
// cards as the NBA and WNBA (js/games/basketball-court.js). What's different
// about the college game lives here, so every basketball screen asks the
// same table:
//   · two 20-minute halves (ESPN's period 1 and 2; 3 is OT, 4 is 2OT)
//   · a 30-second shot clock, reset to 20 on an offensive rebound
//   · team fouls counted for the whole half (overtime carries on the second
//     half's count): the 7th puts the other team in the one-and-one bonus,
//     the 10th in the double bonus (two shots)
//   · five fouls and a player is out
// Plus the parts only college has:
//   · poll ranks beside team names (Games list, the game's scoreboard)
//   · the Top 25 screen (AP and coaches polls), from the trophy on the
//     college basketball Games page
//   · a busy day has 150-plus games, so the Games list leads with your teams,
//     then Top 25 games, with every other game one tap away — and Home and
//     Multi view only pull in a college game that's ranked, your team's, or
//     one a friend (or you) is in
// The NCAA tournament bracket is a later build.

// ── each league's rules (the server's BB_RULES in api/espn.js matches) ──
var BK_RULES = {
  nba: { reg: 4, per: 720, ot: 300, shot: 24, out: 6, half: false },
  wnba: { reg: 4, per: 600, ot: 300, shot: 24, out: 6, half: false },
  cbb: { reg: 2, per: 1200, ot: 300, shot: 30, out: 5, half: true, bonus: 7, dbl: 10 }
};
// x: a game model (m.league), a glance, or a league key
function _bkR(x, lg) {
  var key = lg || (typeof x === 'string' ? x : (x && (x.league || x.sport)) || 'nba');
  var R = BK_RULES[key] || BK_RULES.nba;
  // the game's own feed says how many periods make regulation (it wins over the table)
  var reg = x && typeof x === 'object' ? (x.reg || (x.court && x.court.reg)) : null;
  var sh = x && typeof x === 'object' ? (x.shotSecs || (x.court && x.court.shotSecs)) : null;
  if ((reg && reg !== R.reg) || (sh && sh !== R.shot)) {
    R = Object.assign({}, R);
    if (reg && reg !== R.reg) { R.reg = reg; R.half = reg === 2; R.per = reg === 2 ? 1200 : (key === 'nba' ? 720 : 600); }
    if (sh) R.shot = sh;
  }
  return R;
}
function _bkIsCbb(x) { return (typeof x === 'string' ? x : x && (x.league || x.sport)) === 'cbb'; }
// "Q3", "1H", "2H", "OT", "2OT"
function _bkPerTag(x, n, lg) {
  if (!n) return '';
  var R = _bkR(x, lg);
  if (n <= R.reg) return R.half ? (n === 1 ? '1H' : '2H') : 'Q' + n;
  return n - R.reg === 1 ? 'OT' : (n - R.reg) + 'OT';
}
// a line score's column: "1", "2", "OT"
function _bkPerCol(x, n, lg) {
  var R = _bkR(x, lg);
  if (n <= R.reg) return String(n);
  return n - R.reg === 1 ? 'OT' : (n - R.reg) + 'OT';
}
function _bkOrd(n) { return n === 1 ? '1ST' : n === 2 ? '2ND' : n === 3 ? '3RD' : n + 'TH'; }
// "3RD QTR", "2ND HALF", "OT", "2OT"
function _bkPerLong(x, n, lg) {
  if (!n) return '';
  var R = _bkR(x, lg);
  if (n <= R.reg) return _bkOrd(n) + (R.half ? ' HALF' : ' QTR');
  return n - R.reg === 1 ? 'OT' : (n - R.reg) + 'OT';
}
// Is the game stopped between periods? A college game's live status reads
// "8:42 - 2nd Half", so a bare /half/ can't be the test.
function _bkAtBreak(sd) { return /halftime|end of|intermission|^half$/i.test(String(sd || '').trim()); }
// the period halftime follows (2 in quarters, 1 in halves)
function _bkHalfAt(x, lg) { var R = _bkR(x, lg); return R.reg / 2; }

// ── team fouls: what this many means for the other team ──
// → { n, pips, pen: index of the pip that starts free throws, msg, bonus }
function _bkFoulState(x, n) {
  var R = _bkR(x);
  n = n || 0;
  if (R.half) {
    var msg = n >= R.dbl ? 'Double bonus' : n >= R.bonus ? 'One-and-one bonus' : n === R.bonus - 1 ? 'Next foul is the bonus' : (R.bonus - 1 - n) + ' to give';
    return { n: n, pips: R.dbl, pen: R.bonus - 1, dbl: R.dbl - 1, msg: msg, bonus: n >= R.bonus, double: n >= R.dbl, oppMsg: n >= R.dbl ? 'in the double bonus' : n >= R.bonus ? 'in the bonus' : '' };
  }
  return { n: n, pips: 5, pen: 4, dbl: -1, msg: n >= 5 ? 'Bonus' : n === 4 ? 'Next foul is FTs' : (4 - n) + ' to give', bonus: n >= 5, double: false, oppMsg: n >= 5 ? 'in the bonus' : '' };
}

// ── poll rank beside a name ──
function _cbbRk(rank) {
  var r = Number(rank);
  return r >= 1 && r <= 25 ? '<span class="cbb-rk">' + r + '</span>' : '';
}
function _cbbRanked(g) { return !!(g && (Number(g.awayRank) || Number(g.homeRank))); }

// ── which college games are worth pulling onto Home and Multi view ──
// Ranked, your favorite or followed team's, or a game you or a friend is in.
function _cbbWorthy(sport, g) {
  if (sport !== 'cbb') return true;
  if (!g) return false;
  if (_cbbRanked(g)) return true;
  var key = String(g.gamePk);
  if ((window._watchingList || []).some(function (w) { return w && String(w.gamePk != null ? w.gamePk : w._id) === key; })) return true;
  var by = (window._friendsWatchingCache && window._friendsWatchingCache.byGame) || {};
  if (by[key] && (by[key].uids || []).length) return true;
  var f = (window._favTeamsCache || {}).cbb;
  if (f && (f.favorite === g.away || f.favorite === g.home || (f.following || []).indexOf(g.away) !== -1 || (f.following || []).indexOf(g.home) !== -1)) return true;
  // the board already has it (picked by hand)
  var st = window._mv && window._mv.st;
  if (st && (st.ids || []).some(function (p) { return p.sport === 'cbb' && String(p.gamePk) === key; })) return true;
  return false;
}

// ── the Games list on a big college day ──
// Called from loadGamesList with what's left after "Your teams": Top 25 games
// (live and upcoming, then finished) stay in the list; every other game sits
// behind one button, live ones first. → html
window._cbbAllOpen = false;
function _cbbListHtml(restSplit, card) {
  var up = restSplit.upcoming, done = restSplit.concluded;
  var rUp = up.filter(_cbbRanked), rDone = done.filter(_cbbRanked);
  var oUp = up.filter(function (g) { return !_cbbRanked(g); }), oDone = done.filter(function (g) { return !_cbbRanked(g); });
  var head = function (t, dim) { return '<div style="font-size:11px;font-weight:' + (dim ? 700 : 800) + ';color:' + (dim ? 'rgba(255,255,255,.4)' : '#A89FE8') + ';text-transform:uppercase;letter-spacing:.05em;padding:' + (dim ? '16px 2px 8px' : '6px 2px 0') + '">' + t + '</div>'; };
  var h = '';
  if (rUp.length || rDone.length) {
    h += head('Top 25');
    h += rUp.map(card).join('');
    if (rDone.length) h += head('Top 25 · final', true) + rDone.map(card).join('');
  }
  var others = oUp.length + oDone.length;
  if (!others) return h;
  var liveN = oUp.filter(function (g) { return typeof _isGameStatusLive === 'function' && _isGameStatusLive(g.status); }).length;
  // with no ranked game on the day there's nothing to hide behind a button
  var open = window._cbbAllOpen || !(rUp.length || rDone.length);
  h += '<button class="cbb-all' + (open ? ' on' : '') + '" onclick="cbbToggleAll()" aria-expanded="' + open + '">' +
    '<span>' + (open ? 'Hide the other games' : 'Every other game') + '<small>' + others + (others === 1 ? ' game' : ' games') + (liveN ? ' · ' + liveN + ' live' : '') + '</small></span>' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg></button>';
  if (open) {
    h += oUp.map(card).join('');
    if (oDone.length) h += head('Concluded games', true) + oDone.map(card).join('');
  }
  return h;
}
function cbbToggleAll() {
  window._cbbAllOpen = !window._cbbAllOpen;
  if (typeof loadGamesList === 'function') loadGamesList(window._gamesDate, { silent: true });
}

// ══ TOP 25 ══════════════════════════════════════════════════════════════
// The trophy at the top of the college basketball Games page. The AP poll
// and the coaches poll, 1–25: the badge, the school, its record, how far it
// moved since last week, and first-place votes; then everyone else receiving
// votes. Tap a school for its page. /api/espn?league=cbb&mode=rankings,
// kept for fifteen minutes.
window._cbr = window._cbr || { tab: 0, data: null, at: 0, loading: false };
var CBR_TTL = 15 * 60e3;
function openCbbRankings() {
  nav('cbb-rankings');
  _cbrTabs();
  _cbrRender();
  _cbrLoad();
}
function _cbrLoad() {
  var C = window._cbr;
  if (C.loading || (C.data && Date.now() - C.at < CBR_TTL)) return;
  C.loading = true;
  fetch('/api/espn?league=cbb&mode=rankings')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      C.loading = false;
      if (!d || !Array.isArray(d.polls) || !d.polls.length) throw new Error((d && d.error) || 'no polls');
      // the AP poll first, then the coaches poll, then anything else ESPN sends
      var rank = function (p) { var n = String(p.name || '') + ' ' + String(p.short || ''); return /\bap\b/i.test(n) ? 0 : /coach|usa today/i.test(n) ? 1 : 2; };
      C.data = d.polls.slice().sort(function (a, b) { return rank(a) - rank(b); }).slice(0, 3);
      C.at = Date.now();
      if (C.tab >= C.data.length) C.tab = 0;
      _cbrTabs();
      _cbrRender();
    })
    .catch(function (err) {
      C.loading = false;
      console.error('[cbb rankings]', err);
      if (!C.data) _cbrMsg('The polls aren’t available right now.');
    });
}
function _cbrMsg(text) {
  var el = document.getElementById('cbr-content');
  if (el) el.innerHTML = '<div class="ns-msg">' + _escapeHtml(text) + '</div>';
}
function _cbrPollName(p) {
  var n = String(p.short || p.name || 'Poll');
  if (/\bap\b/i.test(n + ' ' + (p.name || ''))) return 'AP Top 25';
  if (/coach|usa today/i.test(n + ' ' + (p.name || ''))) return 'Coaches';
  return n.length > 14 ? n.slice(0, 14) : n;
}
function cbrShowTab(i) { window._cbr.tab = i; _cbrTabs(); _cbrRender(); }
function _cbrTabs() {
  var el = document.getElementById('cbr-tabs'), C = window._cbr;
  if (!el) return;
  var polls = C.data || [{ short: 'AP Top 25' }, { short: 'Coaches' }];
  el.innerHTML = polls.map(function (p, i) {
    var on = C.tab === i;
    return '<button onclick="cbrShowTab(' + i + ')" aria-pressed="' + on + '" style="flex:1;text-align:center;padding:9px 4px;border-radius:12px;font-size:12.5px;font-weight:800;cursor:pointer;font-family:inherit;background:' +
      (on ? 'rgba(168,159,232,.2)' : 'rgba(255,255,255,.05)') + ';color:' + (on ? '#fff' : 'rgba(255,255,255,.45)') + ';border:1px solid ' + (on ? 'rgba(168,159,232,.4)' : 'transparent') + '">' + _escapeHtml(C.data ? _cbrPollName(p) : p.short) + '</button>';
  }).join('');
}
// "+3" / "-2" / "NEW" / "–" → the arrow chip
function _cbrTrend(r) {
  var prev = Number(r.prev), cur = Number(r.rank);
  var t = String(r.trend || '').trim();
  var d = /^[+-]?\d+$/.test(t) ? Number(t) : (prev > 0 && cur > 0 ? prev - cur : null);
  if (!(prev > 0) && (!t || /^-+$|^0$/.test(t) || d == null)) return '<span class="cbr-tr nw">NEW</span>';
  if (!d) return '<span class="cbr-tr">–</span>';
  return '<span class="cbr-tr ' + (d > 0 ? 'up' : 'dn') + '">' + (d > 0 ? '▲' : '▼') + Math.abs(d) + '</span>';
}
function _cbrBadge(r) {
  var L = typeof _teamLook === 'function' ? _teamLook('cbb', r.name || '', r.abbr || null, r.color || null, r.alt || null) : null;
  if (!L) L = { abbr: r.abbr || String(r.name || '').slice(0, 3).toUpperCase(), bg: r.color || '#3D3580', fg: '#FFFFFF', ring: null };
  var ab = String(L.abbr || r.abbr || '').toUpperCase().slice(0, 4);
  return '<span class="ns-bdg" style="background:' + _escapeHtml(L.bg) + ';color:' + _escapeHtml(L.fg) + (L.ring ? ';box-shadow:inset 0 0 0 1.5px ' + L.ring : '') + (ab.length > 3 ? ';font-size:7.5px' : '') + '">' + _escapeHtml(ab) + '</span>';
}
function _cbrRowHtml(r) {
  return '<button class="ns-row cbr-row" data-id="' + _escapeHtml(r.id || '') + '" data-name="' + _escapeHtml(r.name || '') + '" onclick="openTeamPage(\'cbb\',this.dataset.id,this.dataset.name)">' +
    '<span class="ns-rk cbr-rk">' + r.rank + '</span>' + _cbrBadge(r) +
    '<span class="ns-nm">' + _escapeHtml(r.short || r.name) + (r.fpv ? '<small class="cbr-fpv">(' + r.fpv + ')</small>' : '') + '</span>' +
    '<span class="ns-wl">' + _escapeHtml(r.rec || '–') + '</span>' +
    '<span class="ns-v">' + (r.pts != null ? r.pts : '') + '</span>' + _cbrTrend(r) + '</button>';
}
function _cbrRender() {
  var el = document.getElementById('cbr-content'), C = window._cbr;
  if (!el) return;
  if (!C.data) { _cbrMsg('Loading the polls…'); return; }
  var p = C.data[C.tab] || C.data[0];
  var when = [p.week, p.date ? (function () { var d = new Date(p.date); return isNaN(d) ? '' : 'Released ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); })() : ''].filter(Boolean).join(' · ');
  var html = '<div class="ns-sub">' + _escapeHtml(p.name || '') + (when ? ' · ' + _escapeHtml(when) : '') + '</div>' +
    '<div class="ns-hdr cbr-hdr"><i></i><i></i><i></i><span>W-L</span><span>PTS</span><span>WK</span></div>' +
    p.ranks.map(_cbrRowHtml).join('');
  var others = (p.others || []).filter(function (o) { return o.name; });
  if (others.length) {
    html += '<div class="pp-section-title" style="margin-top:18px">Also receiving votes</div><div class="cbr-oth">' + others.slice(0, 30).map(function (o) {
      return '<button data-id="' + _escapeHtml(o.id || '') + '" data-name="' + _escapeHtml(o.name || '') + '" onclick="openTeamPage(\'cbb\',this.dataset.id,this.dataset.name)">' + _escapeHtml(o.short || o.name) + (o.pts != null ? ' <b>' + o.pts + '</b>' : '') + '</button>';
    }).join('') + '</div>';
  }
  el.innerHTML = html;
}
