// ══ COMPARE TWO HITTERS (v7.76.0) ═══════════════════════════════════════
// From any MLB hitter's player sheet: "Compare with another hitter" opens a
// picker (same position in this game, both lineups, recent, search any
// hitter), then a full-screen head to head:
//   · Basics — BA, OBP, SLG, OPS, HR, RBI, OPS+, WAR for 2026 / last 15
//     games / career. 2026 bars are each player's percentile among qualified
//     MLB hitters; last 15 and career are head to head (no league to rank
//     against for those windows).
//   · Statcast — Savant percentiles with his raw numbers (2026).
// In a game, "Share in chat" quotes the comparison above the chat composer;
// in the chat, the quote opens the comparison again.
// Data: /api/mlb?mode=compare (one hitter per call) and the player sheet's
// own Savant call (smode=player). Depends on: _savGet, _savSeasonData,
// _savPctColor (statcast.js), openPlayerLinkSheet / closePlayerLinkSheet
// (games-list.js), _plsLinesFill (player-lines.js), _sqInGame (stat-reply.js),
// _setReplyTarget (chat-tools.js), _gcStatQuoteHtml (memory-ticket.js),
// _gcBox, _ghAbbrFallback, _ghLastName, _escapeHtml.

window._sav = window._sav || { pending: {} };
window._sav.cmp = window._sav.cmp || {};
window._sav.player = window._sav.player || {};
window._cmp = window._cmp || null;

var CMP_COL = { a: '#A89FE8', b: '#F2C869' };
var CMP_RECENT_KEY = 'innings_cmp_recent';
var CMP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4v16M16 4v16M4 9h8M12 15h8"/></svg>';

function _cmpE(s) { return typeof _escapeHtml === 'function' ? _escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
function _cmpLast(n) { return typeof _ghLastName === 'function' ? _ghLastName(n || '') : String(n || '').split(' ').slice(1).join(' ') || n || ''; }
function _cmpIni(n) { var p = String(n || '').trim().split(/\s+/); return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase(); }
// MLB team ids → abbreviations (stable ids; the Stats API's currentTeam only carries the name)
var CMP_TEAM = { 108: 'LAA', 109: 'AZ', 110: 'BAL', 111: 'BOS', 112: 'CHC', 113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU', 118: 'KC', 119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'ATH', 134: 'PIT', 135: 'SD', 136: 'SEA', 137: 'SF', 138: 'STL', 139: 'TB', 140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI', 144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY', 158: 'MIL' };
function _cmpTeam(teamId, team) { return CMP_TEAM[teamId] || _cmpAbbr(team); }
function _cmpAbbr(team) { return team ? (typeof _ghAbbrFallback === 'function' ? _ghAbbrFallback(team) : String(team).slice(0, 3).toUpperCase()) : ''; }
function _cmpLsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function _cmpLsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

// ── Data ──────────────────────────────────────────────────────────────────
function _cmpData(id) {
  if (!id || typeof _savGet !== 'function') return null;
  var d = _savGet('cmp', String(id), '/api/mlb?mode=compare&id=' + encodeURIComponent(id), 30 * 60e3, _cmpRefresh);
  // career WAR can come back incomplete when MLB is slow: one more try
  var e = window._sav.cmp[String(id)];
  if (d && d.partial && e && !e.retried) {
    e.retried = true;
    setTimeout(function () { e.at = 0; _savGet('cmp', String(id), '/api/mlb?mode=compare&id=' + encodeURIComponent(id) + '&r=1', 30 * 60e3, _cmpRefresh); }, 8000);
  }
  return d;
}
function _cmpSav(id) {
  if (!id || typeof _savGet !== 'function') return null;
  var url = '/api/mlb?mode=savant&smode=player&id=' + encodeURIComponent(id);
  var d = _savGet('player', String(id), url, 6 * 3600e3, _cmpRefresh);
  // a partial answer (Savant was slow) fills in with one more try, like the player sheet's
  var e = window._sav.player[String(id)];
  if (d && d.partial && e && !e.retried) { e.retried = true; setTimeout(function () { e.at = 0; _savGet('player', String(id), url, 6 * 3600e3, _cmpRefresh); }, 6000); }
  return d;
}
function _cmpFailed(bucket, id) { var e = window._sav[bucket] && window._sav[bucket][String(id)]; return !!(e && e.failed); }
function _cmpRefresh() {
  clearTimeout(window._cmpRT);
  window._cmpRT = setTimeout(function () { if (window._cmp && document.getElementById('cmp-screen')) _cmpRender(); }, 120);
}

// ── 1 · The button on the player sheet (MLB hitters) ─────────────────────
function _cmpSheetFill(id) {
  var host = document.getElementById('player-cmp');
  if (!host) {
    var lines = document.getElementById('player-lines');
    if (!lines || !lines.parentNode) return;
    host = document.createElement('div');
    host.id = 'player-cmp';
    lines.parentNode.insertBefore(host, lines.nextSibling);
  }
  if (!id || window._savSheetId !== String(id)) { host.innerHTML = ''; return; }
  var d = typeof _savSeasonData === 'function' ? _savSeasonData(id, function () { if (window._savSheetId === String(id)) _cmpSheetFill(id); }) : null;
  var hitter = !!(d && !d.error && d.hitting && d.pos !== 'P');
  host.innerHTML = hitter ? '<button type="button" class="cmp-open" onclick="cmpPick()">' + CMP_ICON + 'Compare with another hitter</button>' : '';
}
(function () {
  if (typeof openPlayerLinkSheet === 'function') {
    var prevOpen = openPlayerLinkSheet;
    openPlayerLinkSheet = function (name, id, league) {
      var r = prevOpen.apply(this, arguments);
      window._cmpSheet = league === 'mlb' && id ? { id: String(id), name: String(name || '').trim() } : null;
      _cmpSheetFill(league === 'mlb' ? id : null);
      return r;
    };
  }
  // the season line usually lands after the sheet opens; re-check then
  if (typeof _plsLinesFill === 'function') {
    var prevLines = _plsLinesFill;
    _plsLinesFill = function (id) { var r = prevLines.apply(this, arguments); if (window._cmpSheet && window._cmpSheet.id === String(id)) _cmpSheetFill(id); return r; };
  }
})();

// ── 2 · Picker ────────────────────────────────────────────────────────────
function _cmpGameGroups(base) {
  var box = typeof _gcBox === 'function' ? _gcBox() : null;
  var det = box && box.boxScoreDetail;
  if (!det) return [];
  var abbr = function (s) { return s === 'away' ? (box.awayAbbr || _cmpAbbr(box.away)) : (box.homeAbbr || _cmpAbbr(box.home)); };
  var side = null, pos = base.pos || null;
  ['away', 'home'].forEach(function (s) {
    ((det[s] && det[s].batters) || []).forEach(function (b) { if (String(b.id) === base.id) { side = s; if (!pos) pos = b.pos; } });
  });
  var seen = {}; seen[base.id] = 1;
  var list = function (s, filter) {
    return ((det[s] && det[s].batters) || []).filter(function (b) {
      if (!b.id || seen[String(b.id)] || b.pos === 'P' || (filter && !filter(b))) return false;
      seen[String(b.id)] = 1;
      return true;
    }).map(function (b) { return { id: String(b.id), name: b.name, pos: b.pos, team: abbr(s) }; });
  };
  var groups = [];
  if (pos && !/^(PH|PR)$/.test(pos)) {
    var same = list('away', function (b) { return b.pos === pos; }).concat(list('home', function (b) { return b.pos === pos; }));
    if (same.length) groups.push({ h: 'Same position · this game', ps: same });
  }
  var other = side === 'away' ? 'home' : 'away', own = side || 'home';
  var o = list(other); if (o.length) groups.push({ h: abbr(other) + ' lineup', ps: o });
  var w = list(own); if (w.length) groups.push({ h: abbr(own) + ' lineup', ps: w });
  return groups;
}
function _cmpRowHtml(p) {
  return '<button type="button" class="cmp-pr" data-id="' + _cmpE(p.id) + '" data-name="' + _cmpE(p.name) + '" data-pos="' + _cmpE(p.pos || '') + '" data-team="' + _cmpE(p.team || '') + '" onclick="cmpChoose(this)">' +
    '<span class="cmp-av">' + _cmpE(_cmpIni(p.name)) + '</span><span class="cmp-pn"><b>' + _cmpE(p.name) + '</b><small>' + _cmpE([p.team, p.pos].filter(Boolean).join(' · ')) + '</small></span>' +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 5 16 12 9 19"/></svg></button>';
}
function _cmpGroupsHtml(groups) {
  if (!groups.length) return '<div class="cmp-pk-empty">Search any MLB hitter above.</div>';
  return groups.map(function (g) { return '<div class="cmp-pg"><div class="cmp-eb">' + _cmpE(g.h) + '</div>' + g.ps.map(_cmpRowHtml).join('') + '</div>'; }).join('');
}
function cmpPick() {
  var s = window._cmpSheet;
  if (!s) return;
  var d = typeof _savSeasonData === 'function' ? _savSeasonData(s.id) : null;
  var base = { id: s.id, name: s.name, pos: d && d.pos ? d.pos : null };
  window._cmpBase = base;
  var groups = _cmpGameGroups(base);
  var recent = (_cmpLsGet(CMP_RECENT_KEY) || []).filter(function (p) { return p && p.id && String(p.id) !== base.id && !groups.some(function (g) { return g.ps.some(function (x) { return x.id === String(p.id); }); }); }).slice(0, 5);
  if (recent.length) groups.push({ h: 'You compared recently', ps: recent });
  window._cmpPickGroups = groups;
  var el = document.getElementById('cmp-pick');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cmp-pick';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'cmp-pick-t');
    el.addEventListener('click', function (e) { if (e.target === el) cmpPickClose(); });
    document.body.appendChild(el);
  }
  el.innerHTML = '<div class="cmp-pk"><div class="cmp-grab" aria-hidden="true"></div>' +
    '<div class="cmp-pk-hd"><h2 id="cmp-pick-t">Compare ' + _cmpE(_cmpLast(base.name)) + ' with…</h2><button type="button" class="cmp-x" aria-label="Close" onclick="cmpPickClose()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<label class="cmp-q"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span class="cmp-sr">Search MLB hitters</span>' +
    '<input id="cmp-q" type="search" autocomplete="off" placeholder="Any MLB hitter" oninput="_cmpSearch(this.value)"></label>' +
    '<div id="cmp-pick-res">' + _cmpGroupsHtml(groups) + '</div></div>';
  el.style.display = 'flex';
  requestAnimationFrame(function () { el.classList.add('on'); });
}
function cmpPickClose() {
  var el = document.getElementById('cmp-pick');
  if (!el) return;
  el.classList.remove('on');
  clearTimeout(window._cmpPickT);
  window._cmpPickT = setTimeout(function () { el.style.display = 'none'; el.innerHTML = ''; }, 220);
}
function _cmpSearch(q) {
  clearTimeout(window._cmpQT);
  var res = document.getElementById('cmp-pick-res');
  if (!res) return;
  q = String(q || '').trim();
  if (q.length < 2) { res.innerHTML = _cmpGroupsHtml(window._cmpPickGroups || []); return; }
  window._cmpQT = setTimeout(function () {
    var want = q;
    res.innerHTML = '<div class="cmp-pk-empty">Searching…</div>';
    fetch('/api/mlb?mode=search&q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (d) {
      var inp = document.getElementById('cmp-q');
      if (!inp || inp.value.trim() !== want) return;
      var base = window._cmpBase || {};
      var ps = ((d && d.players) || []).filter(function (p) { return p.pos !== 'P' && String(p.id) !== base.id; }).map(function (p) { return { id: String(p.id), name: p.name, pos: p.pos, team: _cmpTeam(p.teamId, p.team) }; });
      res.innerHTML = ps.length ? '<div class="cmp-pg">' + ps.map(_cmpRowHtml).join('') + '</div>' : '<div class="cmp-pk-empty">No MLB hitter by that name.</div>';
    }).catch(function () { res.innerHTML = '<div class="cmp-pk-empty">Couldn’t search right now. Try again in a moment.</div>'; });
  }, 250);
}
function cmpChoose(btn) {
  var base = window._cmpBase;
  if (!base || !btn) return;
  var p = { id: btn.getAttribute('data-id'), name: btn.getAttribute('data-name'), pos: btn.getAttribute('data-pos') || null, team: btn.getAttribute('data-team') || null };
  var rec = (_cmpLsGet(CMP_RECENT_KEY) || []).filter(function (x) { return x && String(x.id) !== p.id; });
  rec.unshift(p);
  _cmpLsSet(CMP_RECENT_KEY, rec.slice(0, 8));
  cmpPickClose();
  cmpOpen({ id: base.id, name: base.name }, { id: p.id, name: p.name });
}

// ── 3 · The compare screen ────────────────────────────────────────────────
function cmpOpen(a, b) {
  if (!a || !b || !a.id || !b.id) return;
  var prev = window._cmp;
  window._cmp = { a: { id: String(a.id), name: a.name || '' }, b: { id: String(b.id), name: b.name || '' }, view: prev ? prev.view : 'basic', range: 'season' };
  var el = document.getElementById('cmp-screen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cmp-screen';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Compare hitters');
    document.body.appendChild(el);
  }
  _cmpRender();
  el.style.display = 'block';
  el.scrollTop = 0;
  requestAnimationFrame(function () { el.classList.add('on'); });
}
function cmpOpenPair(aId, aName, bId, bName) { cmpOpen({ id: aId, name: aName }, { id: bId, name: bName }); }
function cmpClose() {
  var el = document.getElementById('cmp-screen');
  window._cmp = null;
  if (!el) return;
  el.classList.remove('on');
  clearTimeout(window._cmpCloseT);
  window._cmpCloseT = setTimeout(function () { if (!window._cmp) { el.style.display = 'none'; el.innerHTML = ''; } }, 220);
}
function cmpSwap() { var S = window._cmp; if (!S) return; var t = S.a; S.a = S.b; S.b = t; _cmpRender(); }
function cmpSet(k, v) { var S = window._cmp; if (!S) return; S[k] = v; if (k === 'view' && v === 'sc') S.range = 'season'; _cmpRender(); }

var CMP_BASIC = [['BA', 'avg'], ['OBP', 'obp'], ['SLG', 'slg'], ['OPS', 'ops'], ['HR', 'hr'], ['RBI', 'rbi'], ['OPS+', 'opsPlus'], ['WAR', 'war']];
// head-to-head bar scales for the windows with no league to rank against
var CMP_SCALE = { avg: [.15, .35], obp: [.23, .45], slg: [.25, .65], ops: [.5, 1.1], opsPlus: [40, 200] };
var CMP_SC = [['xwOBA', 'xwoba', 'xwoba'], ['Exit velo', 'exit_velocity', 'ev'], ['Hard-hit %', 'hard_hit_percent', 'hardHit'], ['Barrel %', 'brl_percent', 'barrel'],
  ['Bat speed', 'bat_speed', 'batSpeed'], ['Chase %', 'chase_percent', 'chase'], ['Whiff %', 'whiff_percent', 'whiff'], ['K %', 'k_percent', 'k'], ['BB %', 'bb_percent', 'bb']];

function _cmpFmtBasic(k, v) {
  if (v == null || v === '') return null;
  if (k === 'war') { var n = parseFloat(v); return isFinite(n) ? n.toFixed(1) : null; }
  return String(v);
}
function _cmpFmtSc(k, v) {
  if (v == null) return null;
  if (k === 'xwoba') return v.toFixed(3).replace(/^0/, '');
  return v.toFixed(1);
}
// rows: [{ l, a, b, ap, bp, mode: 'pct'|'h2h', aw, bw, af, bf }]
function _cmpBasicRows(A, B, range) {
  var la = A && A.lines && A.lines[range], lb = B && B.lines && B.lines[range];
  if (!la && !lb) return [];
  return CMP_BASIC.filter(function (d) { return !(range === 'l15' && d[1] === 'war'); }).map(function (d) {
    var k = d[1], va = la ? la[k] : null, vb = lb ? lb[k] : null;
    var na = parseFloat(va), nb = parseFloat(vb);
    var ap = range === 'season' && A.pct ? A.pct[k] : null, bp = range === 'season' && B.pct ? B.pct[k] : null;
    var r = { l: d[0], k: k, a: _cmpFmtBasic(k, va), b: _cmpFmtBasic(k, vb) };
    if (ap != null && bp != null) { r.mode = 'pct'; r.ap = ap; r.bp = bp; r.aw = ap > bp; r.bw = bp > ap; }
    else {
      r.mode = 'h2h';
      var sc = CMP_SCALE[k], f = function (n) {
        if (!isFinite(n)) return 0;
        if (sc) return Math.max(4, Math.min(100, (n - sc[0]) / (sc[1] - sc[0]) * 100));
        var m = Math.max(isFinite(na) ? Math.abs(na) : 0, isFinite(nb) ? Math.abs(nb) : 0, k === 'war' ? 1 : 1);
        return Math.max(4, Math.min(100, Math.max(0, n) / m * 100));
      };
      r.af = f(na); r.bf = f(nb);
      r.aw = isFinite(na) && isFinite(nb) && na > nb; r.bw = isFinite(na) && isFinite(nb) && nb > na;
    }
    return r;
  });
}
function _cmpScRows(SA, SB) {
  var pa = {}, pb = {};
  ((SA && SA.batter && SA.batter.percentiles) || []).forEach(function (x) { pa[x.key] = x.pct; });
  ((SB && SB.batter && SB.batter.percentiles) || []).forEach(function (x) { pb[x.key] = x.pct; });
  var raw = function (S, k) { var b = S && S.batter; if (!b) return null; if (k === 'batSpeed') return b.avgBatSpeed != null ? b.avgBatSpeed : null; return b.raw ? b.raw[k] : null; };
  return CMP_SC.map(function (d) {
    var ap = pa[d[1]] != null ? Math.max(1, Math.min(99, Math.round(pa[d[1]]))) : null, bp = pb[d[1]] != null ? Math.max(1, Math.min(99, Math.round(pb[d[1]]))) : null;
    var r = { l: d[0], k: d[2], a: _cmpFmtSc(d[2], raw(SA, d[2])), b: _cmpFmtSc(d[2], raw(SB, d[2])), mode: 'pct', ap: ap, bp: bp };
    if (r.a == null && ap != null) r.a = ap + 'th';
    if (r.b == null && bp != null) r.b = bp + 'th';
    if (ap != null && bp != null) { r.aw = ap > bp; r.bw = bp > ap; }
    else {
      // no percentile for one of them (e.g. bat speed): the raw number decides; chase, whiff and K: lower is better
      var xa = raw(SA, d[2]), xb = raw(SB, d[2]), lo = /^(chase|whiff|k)$/.test(d[2]);
      if (xa != null && xb != null && xa !== xb) { r.aw = lo ? xa < xb : xa > xb; r.bw = !r.aw; }
    }
    return r;
  }).filter(function (r) { return r.a != null || r.b != null; });
}
function _cmpSideHtml(r, side) {
  var v = side === 'a' ? r.a : r.b, w = side === 'a' ? r.aw : r.bw;
  var val = '<span class="cmp-v' + (w ? ' w' : '') + '">' + (v == null ? '—' : _cmpE(v)) + '</span>';
  var trk;
  if (r.mode === 'pct') {
    var p = side === 'a' ? r.ap : r.bp;
    if (p == null) trk = '<span class="cmp-t ' + side + '"></span>';
    else {
      var c = _savPctColor(p), pos = 'calc((100% - 22px) * ' + (p / 100).toFixed(2) + ')';
      trk = '<span class="cmp-t ' + side + '"><i style="width:' + p + '%;background:' + c + (w ? '' : ';opacity:.55') + '"></i>' +
        '<b class="' + (w ? 'w' : '') + '" style="' + (side === 'a' ? 'right' : 'left') + ':' + pos + ';background:' + c + '">' + p + '</b></span>';
    }
  } else {
    var f = side === 'a' ? r.af : r.bf;
    trk = '<span class="cmp-t ' + side + '"><i style="width:' + (f || 0).toFixed(0) + '%;background:' + CMP_COL[side] + (w ? '' : ';opacity:.4') + '"></i></span>';
  }
  return '<div class="cmp-s ' + side + '">' + (side === 'a' ? val + trk : trk + val) + '</div>';
}
function _cmpHeadHtml(P, D, side, range) {
  var meta = D ? [_cmpTeam(D.teamId, D.team), D.pos, D.age != null ? D.age : null].filter(function (x) { return x != null && x !== ''; }).join(' · ') : '';
  var ln = D && D.lines && D.lines[range === 'sc' ? 'season' : range];
  var slash = ln && ln.avg ? [ln.avg, ln.obp, ln.slg].join('/') : '';
  return '<div class="cmp-hd ' + side + '"><span class="cmp-av ' + side + '">' + _cmpE(_cmpIni(P.name || (D && D.name))) + '</span>' +
    '<span class="cmp-nm">' + _cmpE(_cmpLast(P.name || (D && D.name) || '')) + '</span>' +
    '<span class="cmp-meta">' + (meta ? _cmpE(meta) : '&nbsp;') + '</span><span class="cmp-sl">' + (slash ? _cmpE(slash) : '&nbsp;') + '</span></div>';
}
function _cmpSeg(label, items, cur, key) {
  return '<div class="cmp-seg" role="tablist" aria-label="' + _cmpE(label) + '" style="grid-template-columns:repeat(' + items.length + ',minmax(0,1fr))">' + items.map(function (it) {
    var on = it[0] === cur, dis = !!it[2];
    return '<button type="button" role="tab" aria-selected="' + on + '"' + (dis ? ' aria-disabled="true" disabled' : '') + ' class="' + (on ? 'on' : '') + '" onclick="cmpSet(\'' + key + '\',\'' + it[0] + '\')">' + _cmpE(it[1]) + '</button>';
  }).join('') + '</div>';
}
function _cmpRender() {
  var S = window._cmp, el = document.getElementById('cmp-screen');
  if (!S || !el) return;
  var A = _cmpData(S.a.id), B = _cmpData(S.b.id);
  var sc = S.view === 'sc', range = sc ? 'season' : S.range;
  var SA = sc ? _cmpSav(S.a.id) : null, SB = sc ? _cmpSav(S.b.id) : null;
  var yr = (A && A.season) || (B && B.season) || new Date().getFullYear();
  var rows = [], status = '';
  if (sc) {
    if (SA && SB) rows = _cmpScRows(SA, SB);
    else if (_cmpFailed('player', S.a.id) || _cmpFailed('player', S.b.id)) status = 'Couldn’t reach Baseball Savant right now. Try again in a minute.';
    if ((SA && SA.partial) || (SB && SB.partial)) status = status || 'Still loading some of it…';
  } else {
    if (A && B) rows = _cmpBasicRows(A, B, range);
    else if (_cmpFailed('cmp', S.a.id) || _cmpFailed('cmp', S.b.id)) status = 'Couldn’t reach MLB stats right now. Try again in a minute.';
  }
  var loading = !rows.length && !status;
  var anyPct = rows.some(function (r) { return r.mode === 'pct'; });
  var hdL = sc ? 'PCTL VS MLB · ' + yr : anyPct ? 'PCTL VS QUALIFIED HITTERS' : 'HEAD TO HEAD';
  var body;
  if (loading) body = new Array(sc ? 10 : 9).join('<div class="cmp-r cmp-sk" aria-hidden="true"><div class="cmp-s a"><span class="cmp-t a"></span></div><div class="cmp-l"></div><div class="cmp-s b"><span class="cmp-t b"></span></div></div>');
  else if (!rows.length) body = '<div class="cmp-msg">' + _cmpE(status || 'No ' + (range === 'l15' ? 'games in this window' : 'numbers') + ' for these two yet.') + '</div>';
  else body = rows.map(function (r) { return '<div class="cmp-r">' + _cmpSideHtml(r, 'a') + '<div class="cmp-l">' + _cmpE(r.l) + '</div>' + _cmpSideHtml(r, 'b') + '</div>'; }).join('');
  var aw = 0, bw = 0;
  rows.forEach(function (r) { if (r.aw) aw++; if (r.bw) bw++; });
  var nmA = _cmpLast(S.a.name || (A && A.name) || ''), nmB = _cmpLast(S.b.name || (B && B.name) || '');
  var edge = loading ? 'Loading…' : !rows.length ? '—' : aw > bw ? nmA + ' wins ' + aw + ' of ' + rows.length : bw > aw ? nmB + ' wins ' + bw + ' of ' + rows.length : 'Dead even, ' + aw + '–' + bw;
  var pips = rows.map(function (r) { return '<i style="background:' + (r.aw ? CMP_COL.a : r.bw ? CMP_COL.b : 'rgba(168,159,232,.25)') + '"></i>'; }).join('');
  var rangeLabel = { season: yr + ' basics', l15: 'Last 15 games', career: 'Career' }[range];
  var label = sc ? yr + ' Statcast' : rangeLabel;
  var pick = (sc ? ['xwOBA', 'Exit velo', 'Barrel %', 'Chase %'] : ['OPS', 'HR', 'OPS+', 'WAR']);
  var bits = rows.filter(function (r) { return pick.indexOf(r.l) !== -1 && r.a != null && r.b != null; }).map(function (r) { return r.l + ' ' + r.a + '–' + r.b; });
  window._cmpShare = rows.length ? { label: label, text: [edge].concat(bits).join(' · ') } : null;
  var notes = [];
  if (!sc && range === 'career' && A && B) {
    var ca = A.lines && A.lines.career, cb = B.lines && B.lines.career;
    if (ca && cb) notes.push(nmA + ': ' + ca.g + ' G' + (ca.seasons ? ', ' + ca.seasons + ' seasons' : '') + ' · ' + nmB + ': ' + cb.g + ' G' + (cb.seasons ? ', ' + cb.seasons + ' seasons' : ''));
  }
  if (!sc && range === 'l15' && A && B) {
    var xa = A.lines && A.lines.l15, xb = B.lines && B.lines.l15;
    if (xa && xb) notes.push(nmA + ': ' + xa.pa + ' PA · ' + nmB + ': ' + xb.pa + ' PA');
  }
  if (!sc && rows.length) notes.push('OPS+ is league-adjusted, not park-adjusted. WAR is MLB’s.');
  if (sc && rows.length) notes.push('Raw numbers from every pitch he’s seen this season; percentiles are Baseball Savant’s.');
  if (status && rows.length) notes.push(status);
  var inGame = typeof _sqInGame === 'function' && _sqInGame();
  el.innerHTML = '<div class="cmp-in">' +
    '<div class="cmp-top"><button type="button" class="cmp-ib" aria-label="Back" onclick="cmpClose()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>' +
    '<span class="cmp-ttl">COMPARE HITTERS</span><button type="button" class="cmp-ib" aria-label="Swap sides" onclick="cmpSwap()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg></button></div>' +
    '<div class="cmp-heads">' + _cmpHeadHtml(S.a, A, 'a', range) + '<span class="cmp-vs">VS</span>' + _cmpHeadHtml(S.b, B, 'b', range) + '</div>' +
    '<div class="cmp-tabs">' + _cmpSeg('Stat set', [['basic', 'Basics'], ['sc', 'Statcast']], S.view, 'view') +
    _cmpSeg('Range', [['season', String(yr)], ['l15', 'L15', sc], ['career', 'Career', sc]], range, 'range') + '</div>' +
    '<div class="cmp-panel"><div class="cmp-ph"><span>' + _cmpE(hdL) + '</span>' + (sc || anyPct ? '<span class="cmp-lg">BETTER →<i></i></span>' : '<span class="cmp-lg cmp-key"><i class="a"></i>' + _cmpE(nmA) + '<i class="b"></i>' + _cmpE(nmB) + '</span>') + '</div>' + body + '</div>' +
    '<div class="cmp-edge"><div><span class="cmp-eb">EDGE</span><b>' + _cmpE(edge) + '</b></div><span class="cmp-pips" aria-hidden="true">' + pips + '</span></div>' +
    (inGame && rows.length ? '<button type="button" class="cmp-share" onclick="cmpShare()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>Share in chat</button>' : '') +
    (notes.length ? '<div class="cmp-notes">' + notes.map(function (n) { return '<p>' + _cmpE(n) + '</p>'; }).join('') + '</div>' : '') +
    '</div>';
  // the player sheet may have started a Savant call this screen didn't, so
  // its arrival won't ping us: look again shortly while anything is missing
  clearTimeout(window._cmpPoll);
  var waiting = function (bucket, id, d) { return !d && !_cmpFailed(bucket, id); };
  if (loading || waiting('cmp', S.a.id, A) || waiting('cmp', S.b.id, B)) window._cmpPoll = setTimeout(_cmpRefresh, 1500);
}

// ── 4 · Share in the game chat ───────────────────────────────────────────
function cmpShare() {
  var S = window._cmp, q = window._cmpShare;
  if (!S || !q) return;
  var who = _cmpLast(S.a.name) + ' vs ' + _cmpLast(S.b.name);
  var pair = { a: { id: S.a.id, name: S.a.name }, b: { id: S.b.id, name: S.b.name } };
  cmpClose();
  cmpPickClose();
  if (typeof closePlayerLinkSheet === 'function') closePlayerLinkSheet();
  if (typeof gameDetailTab === 'function') gameDetailTab('chat');
  if (typeof _setReplyTarget !== 'function') return;
  _setReplyTarget('gameChats', null, who + ' · ' + q.label, q.text);
  if (window._replyingTo) window._replyingTo.stat = { player: who, playerId: null, label: q.label, text: q.text, cmp: pair };
}
// In the chat, a shared comparison opens the comparison (not a player card)
(function () {
  if (typeof _gcStatQuoteHtml !== 'function') return;
  var prev = _gcStatQuoteHtml;
  _gcStatQuoteHtml = function (rt, mine) {
    var st = rt && rt.stat, c = st && st.cmp;
    if (!c || !c.a || !c.b || !c.a.id || !c.b.id) return prev.apply(this, arguments);
    var bd = mine ? 'rgba(255,255,255,0.45)' : 'rgba(232,199,102,.65)';
    return '<button class="gc-pq gc-sq' + (mine ? ' me' : '') + '" data-a="' + _cmpE(c.a.id) + '" data-an="' + _cmpE(c.a.name || '') + '" data-b="' + _cmpE(c.b.id) + '" data-bn="' + _cmpE(c.b.name || '') + '" onclick="event.stopPropagation();cmpOpenPair(this.dataset.a,this.dataset.an,this.dataset.b,this.dataset.bn)" style="border-left-color:' + bd + '">' +
      '<span class="gc-pq-hd"><span>' + _cmpE([st.player, st.label].filter(Boolean).join(' · ')) + '</span><span class="gc-pq-go">Compare ›</span></span>' +
      '<span class="gc-pq-tx">' + _cmpE(st.text || rt.text || '') + '</span></button>';
  };
})();
