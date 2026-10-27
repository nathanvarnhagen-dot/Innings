// ═══ TEAM PAGE · TEAM COLORS + HISTORY (v7.80.0) ═══════════════════════
// Layered on js/teams/team-page.js (load after it), nothing there removed:
//   · Every sport: the page wears the team's own colors (mock A). A full-
//     bleed hero in the team's primary, its abbreviation as a watermark, the
//     name in a condensed face, record + chips, three tiles (run/point/goal
//     differential, home, away), the next game and the season calendar as
//     before, then a stripe in the team colors. Tabs, jersey numbers,
//     filters and eyebrows take the team's readable accent.
//   · MLB: a History tab. "Every season" lists every season from this year
//     back to the franchise's first, with decade jumps, era dividers when the
//     team moved or renamed, W-L with a win% bar, finish and a result chip.
//     "Playoffs" lists every postseason; titles in gold, every series behind
//     a tap. Data: /api/mlb?mode=history (Lahman through 2021, MLB after).
// Depends on: _tm state + _tmRender/_tmHeroHtml/_tmTabStyles/_tmSelfColors/
// _tmRec/_tmStreak/_tmNextIndex/_tmBadge/_tmColors/_tmDayLabel/_tmTime/
// _tmLocalDay (team-page.js), _gxLum, _escapeHtml, _todayLocal.

var TP_DARK = '#0E0B12';
window._tpHist = window._tpHist || {};

// ── colors ────────────────────────────────────────────────────────────────
function _tpHex(h) { h = String(h || '').replace('#', ''); return /^[0-9a-fA-F]{6}$/.test(h) ? '#' + h.toUpperCase() : null; }
function _tpLum(hex) {
  if (typeof _gxLum === 'function') return _gxLum(hex);
  var h = String(hex).replace('#', ''), c = [0, 2, 4].map(function (i) { var v = parseInt(h.substr(i, 2), 16) / 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
function _tpMix(hex, to, t) {
  var a = String(hex).replace('#', ''), b = String(to).replace('#', '');
  var out = [0, 2, 4].map(function (i) { var x = parseInt(a.substr(i, 2), 16), y = parseInt(b.substr(i, 2), 16); return ('0' + Math.round(x + (y - x) * t).toString(16)).slice(-2); }).join('');
  return '#' + out.toUpperCase();
}
// primary (hero), hi (readable accent on the dark page), on (text on hi), ink (text on the hero)
function _tpPalette(d) {
  var c = typeof _tmSelfColors === 'function' ? _tmSelfColors(d) : { bg: '#3D3580', fg: '#FFFFFF', accent: '#A89FE8' };
  var p = _tpHex(c.bg) || '#3D3580', cands = [c.accent, c.bg, c.fg, d.team && d.team.alt].map(_tpHex).filter(Boolean);
  var hi = cands.filter(function (x) { var l = _tpLum(x); return l >= .2 && l <= .9; })[0];
  if (!hi) { hi = p; for (var i = 0; i < 8 && _tpLum(hi) < .2; i++) hi = _tpMix(hi, '#FFFFFF', .2); }
  var second = cands.filter(function (x) { return x !== hi && _tpLum(x) >= .2; })[0] || '#F1EEF8';
  var lp = _tpLum(p);
  return { p: p, deep: _tpMix(p, '#000000', .55), hi: hi, on: _tpLum(hi) > .4 ? '#14101C' : '#FFFFFF', second: second,
    ink: lp > .55 ? '#14101C' : '#FFFFFF', inkSoft: lp > .55 ? 'rgba(20,16,28,.72)' : 'rgba(255,255,255,.82)' };
}
function _tpApply(d) {
  var scr = document.getElementById('screen-team');
  if (!scr) return;
  if (!d) { scr.classList.remove('tp'); return; }
  var c = _tpPalette(d);
  scr.classList.add('tp');
  scr.style.setProperty('--tp-p', c.p); scr.style.setProperty('--tp-deep', c.deep); scr.style.setProperty('--tp-hi', c.hi);
  scr.style.setProperty('--tp-on', c.on); scr.style.setProperty('--tp-2', c.second); scr.style.setProperty('--tp-ink', c.ink); scr.style.setProperty('--tp-ink2', c.inkSoft);
}

// ── the History tab button (MLB only) ─────────────────────────────────────
function _tpEnsureTab() {
  var sched = document.getElementById('tm-tab-schedule');
  if (!sched || document.getElementById('tm-tab-history')) return;
  var b = document.createElement('button');
  b.id = 'tm-tab-history'; b.className = 'tm-tab'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', 'false');
  b.textContent = 'History';
  b.onclick = function () { tmTab('history'); };
  sched.parentNode.appendChild(b);
}
function _tpTabVisible() {
  var b = document.getElementById('tm-tab-history'), s = window._tm;
  if (b) b.style.display = s && s.league === 'mlb' ? '' : 'none';
}

// ── hero (every sport) ────────────────────────────────────────────────────
function _tpDiffLabel(league) { return league === 'mlb' ? 'RUNS +/−' : /^(nhl|mls|nwsl)$/.test(league) ? 'GOALS +/−' : 'POINTS +/−'; }
function _tpHeroHtml(d) {
  var t = d.team;
  var finals = d.games.filter(function (g) { return g.res; });
  var regular = finals.filter(function (g) { return !g.post; });
  var rec = (regular.length >= 10 || !t.record) ? _tmRec(regular) : t.record;
  var chips = [];
  if (t.standing) chips.push(t.standing);
  var sk = _tmStreak(finals); if (sk) chips.push(sk);
  if (!_tmIsWeekly(d.league) && finals.length >= 10) chips.push('Last 10: ' + _tmRec(finals.slice(-10)));
  var postF = finals.filter(function (g) { return g.post; });
  if (postF.length) chips.push('Playoffs ' + _tmRec(postF));
  var tiles = '';
  if (regular.length) {
    var diff = 0; regular.forEach(function (g) { diff += (Number(g.us) || 0) - (Number(g.them) || 0); });
    var cell = function (k, v) { return '<div class="tp-tile"><small>' + k + '</small><b>' + _escapeHtml(v) + '</b></div>'; };
    tiles = '<div class="tp-tiles">' + cell(_tpDiffLabel(d.league), (diff > 0 ? '+' : diff < 0 ? '−' : '') + Math.abs(diff)) +
      cell('HOME', _tmRec(regular.filter(function (g) { return g.home; }))) + cell('AWAY', _tmRec(regular.filter(function (g) { return !g.home; }))) + '</div>';
  }
  var ni = _tmNextIndex(d), next = '';
  if (ni >= 0) {
    var g = d.games[ni];
    var when = g.state === 'in' ? 'Live now' : ((g.day || _tmLocalDay(g.date)) === _todayLocal() ? 'Today' : _tmDayLabel(g)) + ', ' + _tmTime(g);
    next = '<button class="tm-next" onclick="tmOpenGame(' + ni + ')">' + _tmBadge(_tmColors(d, g.opp), g.opp, 36) +
      '<span class="tm-next-txt"><small>' + (g.state === 'in' ? 'Playing now' : 'Next game') + '</small><b>' + (g.home ? 'vs ' : '@ ') + _escapeHtml(g.oppShort || g.oppName || g.opp) + '</b><small>' + _escapeHtml(when) + '</small></span>' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 5 16 12 9 19"/></svg></button>';
  }
  var cal = '<button class="tm-calbtn" onclick="tmShowCalendar()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>Full season calendar</button>';
  return '<div class="tp-hero">' +
    '<span class="tp-wm" aria-hidden="true">' + _escapeHtml(t.abbr || '') + '</span>' +
    '<div class="tp-hero-in">' +
      (t.location ? '<div class="tp-loc">' + _escapeHtml(t.location) + '</div>' : '') +
      '<div class="tp-name">' + _escapeHtml(t.short || t.name || '') + '</div>' +
      '<div class="tp-recrow"><span class="tp-rec">' + _escapeHtml(String(rec).replace(/-/g, '–')) + '</span>' +
        (chips.length ? '<span class="tp-chips">' + chips.map(function (x) { return '<span>' + _escapeHtml(x) + '</span>'; }).join('') + '</span>' : '') + '</div>' +
    '</div></div><div class="tp-stripe" aria-hidden="true"></div>' +
    tiles + '<div class="tp-side">' + next + cal + '</div>';
}
function _tpMiniHeroHtml(d) {
  var t = d.team;
  return '<div class="tp-hero tp-mini"><span class="tp-wm" aria-hidden="true">' + _escapeHtml(t.abbr || '') + '</span><div class="tp-hero-in">' +
    (t.location ? '<div class="tp-loc">' + _escapeHtml(t.location) + '</div>' : '') + '<div class="tp-name">' + _escapeHtml(t.short || t.name || '') + '</div></div></div><div class="tp-stripe" aria-hidden="true"></div>';
}

// ── History (MLB) ─────────────────────────────────────────────────────────
var TP_ROUND = { WS: ['World Series', 'WS', 4], ALCS: ['AL Championship Series', 'ALCS', 3], NLCS: ['NL Championship Series', 'NLCS', 3], CS: ['Championship Series', 'CS', 3],
  ALDS: ['AL Division Series', 'ALDS', 2], NLDS: ['NL Division Series', 'NLDS', 2], DIV: ['Division Series', 'Div. series', 2], ALWC: ['AL Wild Card Series', 'AL WC', 1], NLWC: ['NL Wild Card Series', 'NL WC', 1] };
function _tpRound(code) {
  code = String(code || '');
  var k = /^WS/.test(code) ? 'WS' : /^(AL|NL)CS/.test(code) ? code.slice(0, 4) : code === 'CS' ? 'CS' : /^(AL|NL)DS/.test(code) ? code.slice(0, 4) : /^(AL|NL)WC/.test(code) ? code.slice(0, 4) : /DIV$/.test(code) ? 'DIV' : null;
  var r = k && TP_ROUND[k];
  return r ? { long: r[0], short: r[1], order: r[2] } : { long: code, short: code, order: 0 };
}
function _tpOrd(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function _tpHistData(id) {
  var e = window._tpHist[id];
  if (e && (e.data || e.err) && Date.now() - e.at < 30 * 60e3) return e;
  if (e && e.pending) return e;
  var n = window._tpHist[id] = { at: Date.now(), pending: true, data: e && e.data, err: null };
  fetch('/api/mlb?mode=history&teamId=' + encodeURIComponent(id)).then(function (r) { return r.json(); }).then(function (j) {
    n.pending = false; n.at = Date.now();
    if (!j || j.error || !j.seasons) n.err = (j && j.error) || 'No history came back.'; else { n.data = j; n.err = null; }
    if (window._tm && window._tm.tab === 'history' && String(window._tm.id) === String(id)) _tmRender();
  }).catch(function (err) { n.pending = false; n.at = Date.now(); n.err = String(err && err.message || err); if (window._tm && window._tm.tab === 'history') _tmRender(); });
  return n;
}
// Every postseason year: its series (in round order) and what it came to
function _tpPostYears(h) {
  var by = {};
  h.post.forEach(function (p) { (by[p[0]] = by[p[0]] || []).push(p); });
  var flags = {}; h.seasons.forEach(function (s) { flags[s[0]] = s[6] || ''; });
  return Object.keys(by).map(Number).sort(function (a, b) { return b - a; }).map(function (y) {
    var list = by[y].slice().sort(function (a, b) { return _tpRound(a[1]).order - _tpRound(b[1]).order; });
    var last = list[list.length - 1], lr = _tpRound(last[1]), f = flags[y] || '';
    var title = f.indexOf('C') !== -1, pennant = f.indexOf('P') !== -1;
    var res = last[3] === -1 ? 'In the ' + lr.long : last[3] === 1 ? 'Won the ' + lr.long : 'Lost the ' + lr.long;
    return { y: y, list: list, title: title, pennant: pennant, early: y < 1903, res: res, last: last, ongoing: last[3] === -1 };
  });
}
function _tpChip(y, flags, py) {
  if (py) {
    if (py.ongoing) return ['In playoffs', 'live'];
    if (py.title) return [py.early ? 'Won ' + y + ' WS' : 'Won WS', 'gold'];
    var lr = _tpRound(py.last[1]);
    return ['Lost ' + lr.short, 'lost'];
  }
  if (flags.indexOf('P') !== -1) return ['Pennant', 'lost'];
  if (flags.indexOf('D') !== -1) return ['Div. title', 'lost'];
  return null;
}
function tpHistRetry() { var s = window._tm; if (s) { delete window._tpHist[String(s.id)]; _tmRender(); } }
function tpHist(k, v) {
  var s = window._tm; if (!s) return;
  var H = s.hist = s.hist || { view: 'seasons', filter: 'all', open: null };
  H[k] = k === 'open' ? (H.open === +v ? null : +v) : v;
  _tmRender();
}
function tpHistJump(dec) {
  var el = document.getElementById('tp-dec-' + dec), body = document.getElementById('tm-body');
  if (!el || !body) return;
  var top = body.scrollTop + el.getBoundingClientRect().top - body.getBoundingClientRect().top - 10;
  body.scrollTo({ top: Math.max(0, top), behavior: typeof _ghReducedMotion === 'function' && _ghReducedMotion() ? 'auto' : 'smooth' });
}
function tpHistOpenYear(y) { var s = window._tm; if (!s) return; s.hist = s.hist || {}; s.hist.view = 'post'; s.hist.filter = 'all'; s.hist.open = +y; _tmRender(); setTimeout(function () { var el = document.getElementById('tp-py-' + y); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' }); }, 30); }
function _tpHistoryHtml(d, s) {
  var tid = String(s.id || d.team.id || '');
  var e = _tpHistData(tid);
  if (!e.data) {
    if (e.err) return '<div class="tm-card"><div class="tm-empty" style="padding:24px 10px"><b>History didn’t load</b><div>' + _escapeHtml(e.err) + '</div><button class="tm-btn" onclick="tpHistRetry()">Try again</button></div></div>';
    return '<div class="tm-card"><div class="tm-skel" style="width:50%;margin-bottom:14px"></div>' + new Array(9).join('<div class="tm-skel" style="margin-bottom:12px"></div>') + '</div>';
  }
  var h = e.data, H = s.hist = s.hist || { view: 'seasons', filter: 'all', open: null };
  H._flags = {}; h.seasons.forEach(function (x) { H._flags[x[0]] = x[6] || ''; });
  var pys = _tpPostYears(h), pyBy = {}; pys.forEach(function (p) { pyBy[p.y] = p; });
  var titles = pys.filter(function (p) { return p.title && !p.early; }).length, early = pys.filter(function (p) { return p.title && p.early; }).length;
  var pennants = h.seasons.filter(function (x) { return (x[6] || '').indexOf('P') !== -1; }).length;
  var seg = '<div class="tp-seg" role="tablist" aria-label="History view">' + [['seasons', 'Every season'], ['post', 'Playoffs']].map(function (x) {
    var on = H.view === x[0];
    return '<button type="button" role="tab" aria-selected="' + on + '" class="' + (on ? 'on' : '') + '" onclick="tpHist(\'view\',\'' + x[0] + '\')">' + x[1] + '</button>';
  }).join('') + '</div>';
  var tile = function (n, k, gold) { return '<div class="tp-stat' + (gold ? ' gold' : '') + '"><b>' + n + '</b><small>' + k + '</small></div>'; };
  var out = seg + '<div class="tp-stats">' + tile(h.seasons.length, 'SEASONS') + tile(titles, 'TITLES', 1) + tile(pennants, 'PENNANTS') + tile(pys.length, 'POSTSEASONS') + '</div>';
  if (H.view === 'post') return out + _tpPlayoffsHtml(pys, H, titles, early);
  // Every season, newest first
  var decs = [];
  h.seasons.forEach(function (x) { var dd = Math.floor(x[0] / 10) * 10; if (decs.indexOf(dd) === -1) decs.push(dd); });
  out += '<div class="tp-decs" aria-label="Jump to a decade">' + decs.map(function (dd) { return '<button type="button" onclick="tpHistJump(' + dd + ')">' + dd + 's</button>'; }).join('') + '</div>';
  out += '<div class="tm-card tp-list"><div class="tp-lh"><span>YEAR</span><span>W–L</span><span>FINISH</span><span></span></div>';
  var lastName = null, lastDec = null;
  h.seasons.forEach(function (x, i) {
    var y = x[0], w = x[1], l = x[2], rank = x[3], div = x[4], name = x[5], fl = x[6] || '';
    if (name !== lastName) {
      var j = i; while (j + 1 < h.seasons.length && h.seasons[j + 1][5] === name) j++;
      out += '<div class="tp-era">' + _escapeHtml(name) + ' · ' + h.seasons[j][0] + (i === 0 ? '–now' : '–' + y) + '</div>';
      lastName = name;
    }
    var dd = Math.floor(y / 10) * 10, anchor = dd !== lastDec ? ' id="tp-dec-' + dd + '"' : '';
    lastDec = dd;
    var pct = w + l ? w / (w + l) : 0, py = pyBy[y], chip = _tpChip(y, fl, py);
    var finish = (rank ? _tpOrd(rank) + ' ' : '') + div;
    var tag = py ? 'button type="button" onclick="tpHistOpenYear(' + y + ')"' : 'div';
    out += '<' + tag + ' class="tp-row' + (py ? ' tap' : '') + '"' + anchor + '><b class="tp-y">' + y + '</b>' +
      '<span class="tp-wl"><span>' + w + '–' + l + '</span><i class="tp-bar"><i style="width:' + Math.round(Math.min(1, pct / .7) * 100) + '%' + (pct < .5 ? ';opacity:.45' : '') + '"></i></i></span>' +
      '<span class="tp-fin">' + _escapeHtml(finish) + '</span>' +
      (chip ? '<span class="tp-chip ' + chip[1] + '">' + _escapeHtml(chip[0]) + '</span>' : '<span></span>') + '</' + (py ? 'button' : 'div') + '>';
  });
  return out + '<div class="tm-legend"><span>Tap a postseason year for every series</span><span>Records through ' + h.through + ': Lahman Baseball Database (CC BY-SA); since: MLB</span></div></div>';
}
function _tpPlayoffsHtml(pys, H, titles, early) {
  // a pennant with no postseason that year (1904: no World Series) still counts as a pennant
  var flags = H._flags || {};
  var extra = Object.keys(flags).map(Number).filter(function (y) { return flags[y].indexOf('P') !== -1 && !pys.some(function (p) { return p.y === y; }); })
    .map(function (y) { return { y: y, list: [], pennant: true, title: false, early: y < 1903, res: 'Won the pennant', noSeries: true, last: null }; });
  var pennantN = pys.filter(function (p) { return p.pennant; }).length + extra.length;
  var f = H.filter || 'all';
  var filt = '<div class="tp-filt">' + [['all', 'All ' + pys.length], ['titles', 'Titles ' + titles], ['pennants', 'Pennants ' + pennantN]].map(function (x) {
    return '<button type="button" class="' + (f === x[0] ? 'on' + (x[0] === 'titles' ? ' gold' : '') : '') + '" aria-pressed="' + (f === x[0]) + '" onclick="tpHist(\'filter\',\'' + x[0] + '\')">' + x[1] + '</button>';
  }).join('') + '</div>';
  var list = f === 'pennants' ? pys.filter(function (p) { return p.pennant; }).concat(extra).sort(function (a, b) { return b.y - a.y; }) : pys.filter(function (p) { return f === 'all' || (p.title && !p.early); });
  if (!list.length) return filt + '<div class="tm-card"><div class="tm-empty" style="padding:24px 10px">None yet.</div></div>';
  return filt + '<div class="tp-posts">' + list.map(function (p) {
    if (p.noSeries) return '<div class="tp-py" id="tp-py-' + p.y + '"><div class="tp-pyrow"><b class="tp-y">' + p.y + '</b><span class="tp-pr"><b>' + _escapeHtml(p.res) + '</b><small>No postseason that year</small></span><span class="tp-chip lost">PENNANT</span></div></div>';
    var open = H.open === p.y, opp = p.last[2], sc = p.last[4] + '–' + p.last[5];
    var chip = p.title ? '<span class="tp-chip gold">' + (p.early ? '1800s WS' : 'CHAMPS') + '</span>' : p.pennant ? '<span class="tp-chip lost">PENNANT</span>' : p.ongoing ? '<span class="tp-chip live">LIVE</span>' : '';
    return '<div class="tp-py' + (p.title ? ' gold' : '') + '" id="tp-py-' + p.y + '"><button type="button" aria-expanded="' + open + '" onclick="tpHist(\'open\',' + p.y + ')">' +
      '<b class="tp-y">' + p.y + '</b><span class="tp-pr"><b>' + _escapeHtml(p.res) + '</b><small>' + _escapeHtml(opp + ', ' + sc) + '</small></span>' + chip + '</button>' +
      (open ? '<div class="tp-series">' + p.list.map(function (x) {
        var r = _tpRound(x[1]), won = x[3] === 1, live = x[3] === -1;
        return '<div><span class="tp-rd">' + _escapeHtml(r.short) + '</span><span>' + _escapeHtml(x[2]) + '</span><b class="' + (live ? '' : won ? 'w' : 'l') + '">' + (live ? '' : won ? 'W ' : 'L ') + x[4] + '–' + x[5] + '</b></div>';
      }).join('') + '</div>' : '') + '</div>';
  }).join('') + '</div>';
}

// ── hooks into team-page.js ───────────────────────────────────────────────
(function () {
  if (typeof _tmHeroHtml === 'function') _tmHeroHtml = _tpHeroHtml;
  if (typeof _tmTabStyles === 'function') {
    var prevStyles = _tmTabStyles;
    _tmTabStyles = function () {
      _tpEnsureTab(); _tpTabVisible();
      var s = window._tm;
      if (s && s.tab === 'history' && s.league !== 'mlb') s.tab = 'roster';
      prevStyles.apply(this, arguments);
      var b = document.getElementById('tm-tab-history'), on = !!(s && s.tab === 'history');
      if (b) { b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); }
    };
  }
  if (typeof _tmRender === 'function') {
    var prevRender = _tmRender;
    _tmRender = function () {
      var s = window._tm;
      _tpApply(s && s.data);
      if (s && s.data && s.tab === 'history' && s.league === 'mlb') {
        var el = document.getElementById('tm-body');
        if (el) el.innerHTML = '<div class="tm-wrap">' + _tpMiniHeroHtml(s.data) + _tpHistoryHtml(s.data, s) + '</div>';
        return;
      }
      return prevRender.apply(this, arguments);
    };
  }
})();
