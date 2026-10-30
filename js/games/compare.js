// ══ COMPARE TWO PLAYERS (v7.76.0 hitters · v7.78.0 pitchers, retired, by age) ══
// From any MLB player's sheet: "Compare with another hitter/pitcher" opens a
// picker (this game, Hall of Famers at his position, recent, search anyone —
// active or retired), then a full-screen head to head with three tabs:
//   · Basics — hitters BA/OBP/SLG/OPS/HR/RBI/OPS+, pitchers W-L/ERA/WHIP/K/
//     IP/K9/ERA+, for this season, recent games (15 / last 5 for pitchers) or
//     career. Season bars are percentiles among qualified MLB players; the
//     other windows are head to head.
//   · Statcast — Savant percentiles with raw numbers (this season).
//   · By age — each career so far at the same age: a chart by age (dashed =
//     what came next), totals through the chosen age, and a pace line.
//     v7.88.0: every category charts one on one — pick it from the chips
//     under the chart or tap its row (here or in Basics).
// A retired player has no season: Basics is Career only, Statcast is off,
// and the compare opens on By age.
// In a game, "Share in chat" quotes it above the composer; in the chat the
// quote opens the comparison again.
// Data: /api/mlb?mode=compare (one player per call), mode=search&all=1,
// mode=hof, and the player sheet's Savant call (smode=player). Depends on:
// _savGet, _savSeasonData, _savPctColor (statcast.js), openPlayerLinkSheet /
// closePlayerLinkSheet (games-list.js), _plsLinesFill (player-lines.js),
// _sqInGame (stat-reply.js), _setReplyTarget (chat-tools.js),
// _gcStatQuoteHtml (memory-ticket.js), _gcBox, _ghAbbrFallback, _ghLastName,
// _escapeHtml.

window._sav = window._sav || { pending: {} };
window._sav.cmp = window._sav.cmp || {};
window._sav.player = window._sav.player || {};
window._sav.hof = window._sav.hof || {};
window._sav.cmpkind = window._sav.cmpkind || {};
window._cmp = window._cmp || null;

var CMP_COL = { a: '#A89FE8', b: '#F2C869' };
var CMP_RECENT_KEY = { bat: 'innings_cmp_recent', pit: 'innings_cmp_recent_p' };
var CMP_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4v16M16 4v16M4 9h8M12 15h8"/></svg>';
// MLB team ids → abbreviations (stable ids; the Stats API's currentTeam only carries the name)
var CMP_TEAM = { 108: 'LAA', 109: 'AZ', 110: 'BAL', 111: 'BOS', 112: 'CHC', 113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU', 118: 'KC', 119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'ATH', 134: 'PIT', 135: 'SD', 136: 'SEA', 137: 'SF', 138: 'STL', 139: 'TB', 140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI', 144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY', 158: 'MIL' };

function _cmpE(s) { return typeof _escapeHtml === 'function' ? _escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
function _cmpLast(n) { return typeof _ghLastName === 'function' ? _ghLastName(n || '') : String(n || '').split(' ').slice(1).join(' ') || n || ''; }
function _cmpIni(n) { var p = String(n || '').trim().split(/\s+/); return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase(); }
function _cmpAbbr(team) { return team ? (typeof _ghAbbrFallback === 'function' ? _ghAbbrFallback(team) : String(team).slice(0, 3).toUpperCase()) : ''; }
function _cmpTeam(teamId, team) { return CMP_TEAM[teamId] || _cmpAbbr(team); }
function _cmpLsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function _cmpLsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function _cmpGroup(kind) { return kind === 'pit' ? 'pitching' : 'hitting'; }
function _cmpYears(first, last) { return first ? first + '–' + (last || '') : ''; }
function _cmpNum(n) { return typeof n === 'number' && Math.abs(n) >= 1000 ? n.toLocaleString('en-US') : String(n); }

// ── Data ──────────────────────────────────────────────────────────────────
function _cmpKey(id, kind) { return String(id) + ':' + _cmpGroup(kind); }
function _cmpData(id, kind) {
  if (!id || typeof _savGet !== 'function') return null;
  var key = _cmpKey(id, kind), url = '/api/mlb?mode=compare&id=' + encodeURIComponent(id) + '&group=' + _cmpGroup(kind);
  var d = _savGet('cmp', key, url, 30 * 60e3, _cmpRefresh);
  // the career-by-age lines can come back incomplete when MLB is slow: one more try
  var e = window._sav.cmp[key];
  if (d && d.partial && e && !e.retried) { e.retried = true; setTimeout(function () { e.at = 0; _savGet('cmp', key, url + '&r=1', 30 * 60e3, _cmpRefresh); }, 8000); }
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
function _cmpFailed(bucket, key) { var e = window._sav[bucket] && window._sav[bucket][String(key)]; return !!(e && e.failed); }
function _cmpRefresh() {
  clearTimeout(window._cmpRT);
  window._cmpRT = setTimeout(function () { if (window._cmp && document.getElementById('cmp-screen')) _cmpRender(); }, 120);
}

// ── 1 · The button on the player sheet (any MLB player) ──────────────────
function _cmpKindOf(d) {
  if (!d || d.error) return null;
  if (d.pitching && (d.pos === 'P' || !d.hitting)) return 'pit';
  return d.hitting ? 'bat' : null;
}
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
  var kind = _cmpKindOf(d), pos = d && d.pos || null;
  // v7.78.2: a retired player has no season line — his career data says what he was
  var se = window._sav.season && window._sav.season[String(id)];
  if (!kind && se && (se.failed || (se.data && (se.data.error || (!se.data.hitting && !se.data.pitching))))) {
    var c = _savGet('cmpkind', String(id), '/api/mlb?mode=compare&group=hitting&id=' + encodeURIComponent(id), 24 * 3600e3, function () { if (window._savSheetId === String(id)) _cmpSheetFill(id); });
    if (c && c.pos) { pos = c.pos; kind = c.pos === 'P' ? 'pit' : 'bat'; }
  }
  if (window._cmpSheet && window._cmpSheet.id === String(id)) { window._cmpSheet.kind = kind; window._cmpSheet.pos = pos; }
  host.innerHTML = kind ? '<button type="button" class="cmp-open" onclick="cmpPick()">' + CMP_ICON + 'Compare with another ' + (kind === 'pit' ? 'pitcher' : 'hitter') + '</button>' : '';
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
var CMP_OF = /^(LF|CF|RF|OF)$/;
function _cmpPosMatch(a, b) { return !!a && !!b && (a === b || (CMP_OF.test(a) && CMP_OF.test(b))); }
function _cmpGameGroups(base) {
  var box = typeof _gcBox === 'function' ? _gcBox() : null;
  var det = box && box.boxScoreDetail;
  if (!det) return [];
  var abbr = function (s) { return s === 'away' ? (box.awayAbbr || _cmpAbbr(box.away)) : (box.homeAbbr || _cmpAbbr(box.home)); };
  var seen = {}; seen[base.id] = 1;
  var listKey = base.kind === 'pit' ? 'pitchers' : 'batters';
  var side = null, pos = base.pos || null;
  ['away', 'home'].forEach(function (s) {
    ((det[s] && det[s][listKey]) || []).forEach(function (b) { if (String(b.id) === base.id) { side = s; if (!pos && b.pos) pos = b.pos; } });
  });
  var list = function (s, filter) {
    return ((det[s] && det[s][listKey]) || []).filter(function (b) {
      if (!b.id || seen[String(b.id)] || (base.kind !== 'pit' && b.pos === 'P') || (filter && !filter(b))) return false;
      seen[String(b.id)] = 1;
      return true;
    }).map(function (b) { return { id: String(b.id), name: b.name, pos: base.kind === 'pit' ? 'P' : b.pos, team: abbr(s), active: true }; });
  };
  var groups = [];
  if (base.kind !== 'pit' && pos && !/^(PH|PR|DH)$/.test(pos)) {
    var same = list('away', function (b) { return _cmpPosMatch(b.pos, pos); }).concat(list('home', function (b) { return _cmpPosMatch(b.pos, pos); }));
    if (same.length) groups.push({ h: 'Same position · this game', ps: same });
  }
  var other = side === 'away' ? 'home' : 'away', own = side || 'home', word = base.kind === 'pit' ? ' pitchers today' : ' lineup';
  var o = list(other); if (o.length) groups.push({ h: abbr(other) + word, ps: o });
  var w = list(own); if (w.length) groups.push({ h: abbr(own) + word, ps: w });
  return groups;
}
function _cmpHofGroup(base) {
  var d = typeof _savGet === 'function' ? _savGet('hof', 'all', '/api/mlb?mode=hof', 7 * 86400e3, function () { if (document.getElementById('cmp-pick') && window._cmpBase) _cmpPickRender(); }) : null;
  var ps = (d && d.players) || [];
  var pos = base.pos;
  var fit = ps.filter(function (p) {
    if (String(p.id) === base.id) return false;
    if (base.kind === 'pit') return p.pos === 'P';
    return pos && pos !== 'P' && !/^(PH|PR|DH|TWP)$/.test(pos) ? _cmpPosMatch(p.pos, pos) : false;
  }).sort(function (a, b) { return (b.last || 0) - (a.last || 0); }).slice(0, 5)
    .map(function (p) { return { id: String(p.id), name: p.name, pos: p.pos, active: false, hof: true, first: p.first, last: p.last }; });
  if (!fit.length) return null;
  return { h: base.kind === 'pit' ? 'Hall of Fame pitchers' : 'Hall of Famers at ' + (CMP_OF.test(pos) ? 'OF' : pos), ps: fit };
}
function _cmpRowHtml(p) {
  var retired = p.active === false;
  var meta = retired ? [p.pos, _cmpYears(p.first, p.last)] : [p.team, p.pos];
  var chip = p.hof ? '<span class="cmp-chip hof">HOF</span>' : retired ? '<span class="cmp-chip ret">Retired</span>' : '';
  return '<button type="button" class="cmp-pr" data-id="' + _cmpE(p.id) + '" data-name="' + _cmpE(p.name) + '" data-pos="' + _cmpE(p.pos || '') + '" data-team="' + _cmpE(p.team || '') + '" data-ret="' + (retired ? '1' : '') + '" onclick="cmpChoose(this)">' +
    '<span class="cmp-av' + (retired ? ' old' : '') + '">' + _cmpE(_cmpIni(p.name)) + '</span><span class="cmp-pn"><b>' + _cmpE(p.name) + '</b><small>' + _cmpE(meta.filter(Boolean).join(' · ')) + '</small></span>' + chip +
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 5 16 12 9 19"/></svg></button>';
}
function _cmpGroupsHtml(groups) {
  if (!groups.length) return '<div class="cmp-pk-empty">Search any MLB ' + ((window._cmpBase || {}).kind === 'pit' ? 'pitcher' : 'hitter') + ', active or retired.</div>';
  return groups.map(function (g) { return '<div class="cmp-pg"><div class="cmp-eb">' + _cmpE(g.h) + '</div>' + g.ps.map(_cmpRowHtml).join('') + '</div>'; }).join('');
}
function _cmpPickGroups(base) {
  var groups = _cmpGameGroups(base);
  var hof = _cmpHofGroup(base);
  if (hof) groups.push(hof);
  var shown = {}; groups.forEach(function (g) { g.ps.forEach(function (x) { shown[x.id] = 1; }); });
  var recent = (_cmpLsGet(CMP_RECENT_KEY[base.kind]) || []).filter(function (p) { return p && p.id && String(p.id) !== base.id && !shown[String(p.id)]; }).slice(0, 5);
  if (recent.length) groups.push({ h: 'You compared recently', ps: recent });
  return groups;
}
function _cmpPickRender() {
  var res = document.getElementById('cmp-pick-res'), inp = document.getElementById('cmp-q');
  if (!res || (inp && inp.value.trim().length >= 2)) return;
  window._cmpPickList = _cmpPickGroups(window._cmpBase);
  res.innerHTML = _cmpGroupsHtml(window._cmpPickList);
}
function cmpPick() {
  var s = window._cmpSheet;
  if (!s) return;
  var d = typeof _savSeasonData === 'function' ? _savSeasonData(s.id) : null;
  var kind = s.kind || _cmpKindOf(d) || 'bat';
  var base = { id: s.id, name: s.name, pos: (d && !d.error && d.pos) || s.pos || null, kind: kind };
  window._cmpBase = base;
  window._cmpPickList = _cmpPickGroups(base);
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
  var what = kind === 'pit' ? 'pitcher' : 'hitter';
  el.innerHTML = '<div class="cmp-pk"><div class="cmp-grab" aria-hidden="true"></div>' +
    '<div class="cmp-pk-hd"><h2 id="cmp-pick-t">Compare ' + _cmpE(_cmpLast(base.name)) + ' with…</h2><button type="button" class="cmp-x" aria-label="Close" onclick="cmpPickClose()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<label class="cmp-q"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span class="cmp-sr">Search MLB ' + what + 's</span>' +
    '<input id="cmp-q" type="search" autocomplete="off" placeholder="Any ' + what + ', active or retired" oninput="_cmpSearch(this.value)"></label>' +
    '<div id="cmp-pick-res">' + _cmpGroupsHtml(window._cmpPickList) + '</div></div>';
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
  if (q.length < 2) { res.innerHTML = _cmpGroupsHtml(window._cmpPickList || []); return; }
  window._cmpQT = setTimeout(function () {
    var want = q;
    res.innerHTML = '<div class="cmp-pk-empty">Searching…</div>';
    fetch('/api/mlb?mode=search&all=1&q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (d) {
      var inp = document.getElementById('cmp-q');
      if (!inp || inp.value.trim() !== want) return;
      var base = window._cmpBase || {}, pit = base.kind === 'pit';
      var ps = ((d && d.players) || []).filter(function (p) {
        if (String(p.id) === base.id) return false;
        return pit ? (p.pos === 'P' || p.pos === 'TWP') : p.pos !== 'P';
      }).map(function (p) { return { id: String(p.id), name: p.name, pos: p.pos, team: _cmpTeam(p.teamId, p.team), active: p.active !== false, hof: !!p.hof, first: p.first, last: p.last }; });
      res.innerHTML = (ps.length ? '<div class="cmp-pg">' + ps.map(_cmpRowHtml).join('') + '</div>' : '<div class="cmp-pk-empty">No MLB ' + (pit ? 'pitcher' : 'hitter') + ' by that name.</div>') +
        '<div class="cmp-credit">Every MLB player ever, from the Chadwick Baseball Bureau register.</div>';
    }).catch(function () { res.innerHTML = '<div class="cmp-pk-empty">Couldn’t search right now. Try again in a moment.</div>'; });
  }, 250);
}
function cmpChoose(btn) {
  var base = window._cmpBase;
  if (!base || !btn) return;
  var retired = btn.getAttribute('data-ret') === '1';
  var p = { id: btn.getAttribute('data-id'), name: btn.getAttribute('data-name'), pos: btn.getAttribute('data-pos') || null, team: btn.getAttribute('data-team') || null, active: !retired };
  var hof = !!btn.querySelector('.cmp-chip.hof');
  if (hof) p.hof = true;
  var key = CMP_RECENT_KEY[base.kind] || CMP_RECENT_KEY.bat;
  var rec = (_cmpLsGet(key) || []).filter(function (x) { return x && String(x.id) !== p.id; });
  rec.unshift(p);
  _cmpLsSet(key, rec.slice(0, 8));
  cmpPickClose();
  cmpOpen({ id: base.id, name: base.name }, { id: p.id, name: p.name }, base.kind, retired ? 'age' : null);
}

// ── 3 · The compare screen ────────────────────────────────────────────────
function cmpOpen(a, b, kind, view) {
  if (!a || !b || !a.id || !b.id) return;
  var prev = window._cmp;
  kind = kind === 'pit' ? 'pit' : 'bat';
  window._cmp = { kind: kind, a: { id: String(a.id), name: a.name || '' }, b: { id: String(b.id), name: b.name || '' },
    view: view || (prev && prev.kind === kind && prev.view !== 'age' ? prev.view : 'basic'), range: 'season', age: null, metric: null };
  var el = document.getElementById('cmp-screen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cmp-screen';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    document.body.appendChild(el);
  }
  el.setAttribute('aria-label', kind === 'pit' ? 'Compare pitchers' : 'Compare hitters');
  _cmpRender();
  el.style.display = 'block';
  el.scrollTop = 0;
  requestAnimationFrame(function () { el.classList.add('on'); });
}
function cmpOpenPair(aId, aName, bId, bName, kind, view) { cmpOpen({ id: aId, name: aName }, { id: bId, name: bName }, kind, view || null); }
function cmpClose() {
  var el = document.getElementById('cmp-screen');
  window._cmp = null;
  if (!el) return;
  el.classList.remove('on');
  clearTimeout(window._cmpCloseT);
  window._cmpCloseT = setTimeout(function () { if (!window._cmp) { el.style.display = 'none'; el.innerHTML = ''; } }, 220);
}
// v7.88.0: any stat row → that stat on the By age chart
function cmpChart(k) {
  var S = window._cmp;
  if (!S || !CMP_CHART[k]) return;
  S.metric = k; S.focusChart = true;
  if (S.view !== 'age') { S.view = 'age'; S.age = null; }
  _cmpRender();
}
function cmpSwap() { var S = window._cmp; if (!S) return; var t = S.a; S.a = S.b; S.b = t; _cmpRender(); }
function cmpSet(k, v) {
  var S = window._cmp;
  if (!S) return;
  if (k === 'age') v = +v;
  S[k] = v;
  if (k === 'view' && v === 'sc') S.range = 'season';
  if (k === 'align') S.age = null;
  _cmpRender();
}

// Basics rows: [label, key, lower-is-better]
var CMP_BASIC = {
  bat: [['BA', 'avg'], ['OBP', 'obp'], ['SLG', 'slg'], ['OPS', 'ops'], ['HR', 'hr'], ['RBI', 'rbi'], ['OPS+', 'opsPlus']],
  pit: [['W-L', 'wl'], ['ERA', 'era', 1], ['WHIP', 'whip', 1], ['K', 'k'], ['IP', 'ip'], ['K/9', 'k9'], ['ERA+', 'eraPlus']]
};
// head-to-head bar scales (low end, high end) for windows with no league to rank against
var CMP_SCALE = { avg: [.15, .35], obp: [.23, .45], slg: [.25, .65], ops: [.5, 1.1], opsPlus: [40, 200], era: [6.5, 1.5], whip: [1.8, .8], eraPlus: [50, 220], k9: [4, 13], wl: [.3, .75] };
var CMP_SC = {
  bat: [['xwOBA', 'xwoba', 'xwoba'], ['Exit velo', 'exit_velocity', 'ev'], ['Hard-hit %', 'hard_hit_percent', 'hardHit'], ['Barrel %', 'brl_percent', 'barrel'],
    ['Bat speed', 'bat_speed', 'batSpeed'], ['Chase %', 'chase_percent', 'chase'], ['Whiff %', 'whiff_percent', 'whiff'], ['K %', 'k_percent', 'k'], ['BB %', 'bb_percent', 'bb']],
  pit: [['xERA', 'xera'], ['Fastball velo', 'fb_velocity', 'fbVelo'], ['Fastball spin', 'fb_spin'], ['Whiff %', 'whiff_percent'], ['Chase %', 'chase_percent'],
    ['K %', 'k_percent'], ['BB %', 'bb_percent'], ['Barrel % allowed', 'brl_percent'], ['Hard-hit % allowed', 'hard_hit_percent'], ['Extension', 'extension']]
};
// By age rows: [label, key, lower-is-better]
var CMP_AGE = {
  bat: [['G', 'g', 0, 1], ['H', 'h'], ['HR', 'hr'], ['RBI', 'rbi'], ['BA', 'avg'], ['OBP', 'obp'], ['SLG', 'slg'], ['OPS', 'ops'], ['OPS+', 'opsPlus'], ['Gold Gloves', 'gg']],
  pit: [['G', 'g', 0, 1], ['GS', 'gs', 0, 1], ['W-L', 'wl'], ['ERA', 'era', 1], ['WHIP', 'whip', 1], ['IP', 'ip'], ['K', 'k'], ['K/9', 'k9'], ['ERA+', 'eraPlus'], ['SV', 'sv'], ['Gold Gloves', 'gg']]
};
// v7.88.0: every By age category can go on the chart, one on one.
// [chip label, word for the pace line, decimals, rate (career-to-date average, not a running total)]
var CMP_CHART = {
  g: ['G', 'games', 0], gs: ['GS', 'starts', 0], h: ['H', 'hits', 0], hr: ['HR', 'homers', 0], rbi: ['RBI', 'RBI', 0], gg: ['Gold Gloves', 'Gold Gloves', 0],
  wl: ['W-L', 'wins', 0], ip: ['IP', 'innings', 0], k: ['K', 'strikeouts', 0], sv: ['SV', 'saves', 0],
  avg: ['BA', 'BA', 3, 1], obp: ['OBP', 'OBP', 3, 1], slg: ['SLG', 'SLG', 3, 1], ops: ['OPS', 'OPS', 3, 1], opsPlus: ['OPS+', 'OPS+', 0, 1],
  era: ['ERA', 'ERA', 2, 1], whip: ['WHIP', 'WHIP', 2, 1], k9: ['K/9', 'K/9', 1, 1], eraPlus: ['ERA+', 'ERA+', 0, 1]
};
var CMP_CHART_DEF = { bat: 'h', pit: 'k' };

function _cmpVal(line, k) {
  if (!line) return null;
  if (k === 'wl') return line.w != null && line.l != null ? line.w + '-' + line.l : null;
  var v = line[k];
  // the by-age lines carry OBP/SLG and K/IP; OPS and K/9 are worked out from them
  if (v == null && k === 'ops' && line.obp != null && line.slg != null) { var o = parseFloat(line.obp) + parseFloat(line.slg); return o >= 1 ? o.toFixed(3) : o.toFixed(3).replace(/^0/, ''); }
  if (v == null && k === 'k9' && line.ip != null && line.k != null) { var ip = _cmpNumOf('ip', line.ip); return ip ? (line.k * 9 / ip).toFixed(1) : null; }
  return v == null || v === '' ? null : v;
}
function _cmpNumOf(k, v) {
  if (v == null) return NaN;
  if (k === 'wl') { var p = String(v).split('-'), w = +p[0], l = +p[1]; return w + l ? w / (w + l) : NaN; }
  if (k === 'ip') { var q = String(v).split('.'); return (+q[0] || 0) + (+q[1] || 0) / 3; }
  return parseFloat(v);
}
function _cmpFmt(k, v) {
  if (v == null) return null;
  if (k === 'ip') return String(v).replace(/^(\d+)(\d{3})(?=\.|$)/, '$1,$2');
  return typeof v === 'number' ? _cmpNum(v) : String(v);
}
// one head-to-head row from two values
function _cmpH2HRow(label, k, va, vb, lower, noWin) {
  var na = _cmpNumOf(k, va), nb = _cmpNumOf(k, vb), sc = CMP_SCALE[k];
  var f = function (n) {
    if (!isFinite(n)) return 0;
    if (sc) return Math.max(4, Math.min(100, (n - sc[0]) / (sc[1] - sc[0]) * 100));
    var m = Math.max(isFinite(na) ? Math.abs(na) : 0, isFinite(nb) ? Math.abs(nb) : 0, 1);
    return Math.max(4, Math.min(100, Math.max(0, n) / m * 100));
  };
  var both = isFinite(na) && isFinite(nb) && !noWin;
  return { l: label, k: k, a: _cmpFmt(k, va), b: _cmpFmt(k, vb), mode: 'h2h', af: f(na), bf: f(nb),
    aw: both && (lower ? na < nb : na > nb), bw: both && (lower ? nb < na : nb > na) };
}
function _cmpBasicRows(A, B, range, kind) {
  var la = A && A.lines && A.lines[range], lb = B && B.lines && B.lines[range];
  if (!la && !lb) return [];
  return CMP_BASIC[kind].map(function (d) {
    var k = d[1], va = _cmpVal(la, k), vb = _cmpVal(lb, k);
    var ap = range === 'season' && A.pct ? A.pct[k] : null, bp = range === 'season' && B.pct ? B.pct[k] : null;
    if (ap != null && bp != null) return { l: d[0], k: k, a: _cmpFmt(k, va), b: _cmpFmt(k, vb), mode: 'pct', ap: ap, bp: bp, aw: ap > bp, bw: bp > ap };
    return _cmpH2HRow(d[0], k, va, vb, !!d[2]);
  });
}
function _cmpFbVelo(S) {
  var ars = (S && S.pitcher && S.pitcher.arsenal) || [], best = null;
  ars.forEach(function (a) { if (/^(FF|SI|FC|FA|FT)$/.test(a.code || '') && a.mph != null && (!best || (a.usage || 0) > (best.usage || 0))) best = a; });
  return best ? best.mph : null;
}
function _cmpScRows(SA, SB, kind) {
  var side = kind === 'pit' ? 'pitcher' : 'batter';
  var pa = {}, pb = {};
  ((SA && SA[side] && SA[side].percentiles) || []).forEach(function (x) { pa[x.key] = x.pct; });
  ((SB && SB[side] && SB[side].percentiles) || []).forEach(function (x) { pb[x.key] = x.pct; });
  var raw = function (S, k) {
    if (!k || !S) return null;
    if (kind === 'pit') return k === 'fbVelo' ? _cmpFbVelo(S) : null;
    var b = S.batter; if (!b) return null;
    if (k === 'batSpeed') return b.avgBatSpeed != null ? b.avgBatSpeed : null;
    return b.raw ? b.raw[k] : null;
  };
  var fmt = function (k, v) { return v == null ? null : k === 'xwoba' ? v.toFixed(3).replace(/^0/, '') : v.toFixed(1); };
  var ord = function (p) { return typeof _ordinalSuffix === 'function' ? _ordinalSuffix(p) : p + 'th'; };
  return CMP_SC[kind].map(function (d) {
    var ap = pa[d[1]] != null ? Math.max(1, Math.min(99, Math.round(pa[d[1]]))) : null, bp = pb[d[1]] != null ? Math.max(1, Math.min(99, Math.round(pb[d[1]]))) : null;
    var xa = raw(SA, d[2]), xb = raw(SB, d[2]);
    var r = { l: d[0], k: d[2] || d[1], a: fmt(d[2], xa), b: fmt(d[2], xb), mode: 'pct', ap: ap, bp: bp };
    if (r.a == null && ap != null) r.a = ord(ap);
    if (r.b == null && bp != null) r.b = ord(bp);
    if (ap != null && bp != null) { r.aw = ap > bp; r.bw = bp > ap; }
    else if (xa != null && xb != null && xa !== xb) {
      // no percentile for one of them (e.g. bat speed): the raw number decides; chase, whiff and K: lower is better
      var lo = /^(chase|whiff|k)$/.test(d[2]); r.aw = lo ? xa < xb : xa > xb; r.bw = !r.aw;
    }
    return r;
  }).filter(function (r) { return r.a != null || r.b != null; });
}
// By age / by career year. A player's series maps x (an age, or which
// season of his career) to his career so far. Before he debuted he has
// nothing yet (zeros, "—" for rates); a skipped season carries the last one.
var CMP_ZERO = { g: 0, gs: 0, pa: 0, h: 0, hr: 0, rbi: 0, w: 0, l: 0, sv: 0, ip: '0.0', k: 0, avg: null, obp: null, slg: null, opsPlus: null, era: null, whip: null, eraPlus: null, gg: 0, pre: true };
function _cmpSeries(D, align) {
  var ages = D && D.ages ? Object.keys(D.ages).map(Number).sort(function (x, y) { return x - y; }) : [];
  if (!ages.length) return null;
  var map = {};
  if (align === 'year') ages.forEach(function (a, i) { map[i + 1] = D.ages[a]; });
  else ages.forEach(function (a) { map[a] = D.ages[a]; });
  var xs = Object.keys(map).map(Number).sort(function (x, y) { return x - y; });
  return { xs: xs, first: xs[0], last: xs[xs.length - 1], debutAge: ages[0],
    at: function (x) { if (x < xs[0]) return CMP_ZERO; var best = null; xs.forEach(function (k) { if (k <= x) best = map[k]; }); return best; } };
}
function _cmpAgeRows(sa, sb, x, kind) {
  var la = sa.at(x), lb = sb.at(x);
  return CMP_AGE[kind].filter(function (d) {
    if (d[1] === 'gg') return (la.gg || 0) + (lb.gg || 0) > 0;
    if (d[1] === 'sv') return (la.sv || 0) + (lb.sv || 0) >= 20;
    return true;
  }).map(function (d) { return _cmpH2HRow(d[0], d[1], _cmpVal(la, d[1]), _cmpVal(lb, d[1]), !!d[2], !!d[3]); });
}
function _cmpMetricVal(line, m) {
  if (!line) return null;
  if (m === 'wl') return line.w != null ? line.w : null;
  var v = _cmpVal(line, m), n = _cmpNumOf(m, v);
  return isFinite(n) ? n : null;
}
function _cmpChartFmt(m, v) {
  var c = CMP_CHART[m] || [];
  if (v == null || !isFinite(v)) return '—';
  if (c[2] === 3) return v >= 1 ? v.toFixed(3) : v.toFixed(3).replace(/^0/, '');
  if (c[2]) return v.toFixed(c[2]);
  return _cmpNum(Math.round(v));
}
function _cmpChartHtml(sa, sb, x, metric, nmA, nmB, align) {
  var lo = Math.min(sa.first, sb.first), hi = Math.max(sa.last, sb.last), rate = !!(CMP_CHART[metric] || [])[3];
  var vals = [];
  [sa, sb].forEach(function (s) { s.xs.forEach(function (k) { var v = _cmpMetricVal(s.at(k), metric); if (v != null) vals.push(v); }); });
  var vmin, top;
  if (rate && vals.length) {
    // averages: the axis hugs where the two careers actually are
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), span = Math.max(mx - mn, Math.abs(mx) * .08, 1e-3);
    var st = Math.pow(10, Math.floor(Math.log10(span / 2)));
    vmin = Math.max(0, Math.floor((mn - span * .12) / st) * st); top = Math.ceil((mx + span * .12) / st) * st;
    if (top <= vmin) top = vmin + st;
  } else {
    var max = Math.max.apply(null, vals.concat([1])), step = Math.pow(10, Math.floor(Math.log10(max)));
    vmin = 0; top = Math.ceil(max / step) * step;
  }
  var W = 334, H = 132, L = 34, R = 326, T = 6, Bt = 114;
  var X = function (v) { return L + (hi === lo ? 0 : (v - lo) / (hi - lo)) * (R - L); }, Y = function (v) { return Bt - ((v || 0) - vmin) / (top - vmin) * (Bt - T); };
  var path = function (s, from, to) {
    // a gap (no average yet, before he debuted) lifts the pen
    var d = '', pen = false;
    s.xs.forEach(function (k) {
      if (k < from || k > to) return;
      var v = _cmpMetricVal(s.at(k), metric);
      if (v == null) { pen = false; return; }
      d += (pen ? ' L ' : 'M ') + X(k).toFixed(1) + ' ' + Y(v).toFixed(1); pen = true;
    });
    return d;
  };
  var grid = [0, .5, 1].map(function (f) {
    var v = vmin + (top - vmin) * f, y = Y(v).toFixed(1);
    return '<line x1="' + L + '" y1="' + y + '" x2="' + R + '" y2="' + y + '" stroke="rgba(255,255,255,' + (f ? '.07' : '.18') + ')" stroke-width="1"/>' +
      '<text x="' + (L - 6) + '" y="' + (+y + 3) + '" fill="#8A82D6" font-size="9" font-weight="700" text-anchor="end">' + _cmpE(_cmpChartFmt(metric, v)) + '</text>';
  }).join('');
  var ticks = [], tstep = hi - lo > 12 ? 5 : hi - lo > 6 ? 2 : 1;
  for (var t = Math.ceil(lo / tstep) * tstep; t <= hi; t += tstep) ticks.push('<text x="' + X(t).toFixed(1) + '" y="129" fill="#8A82D6" font-size="9" font-weight="700" text-anchor="middle">' + (align === 'year' ? 'Yr ' : '') + t + '</text>');
  var sx = X(x).toFixed(1), va = _cmpMetricVal(sa.at(x), metric), vb = _cmpMetricVal(sb.at(x), metric);
  var word = (CMP_CHART[metric] || [])[1] || metric;
  var label = 'Career ' + word + ' by ' + (align === 'year' ? 'season of career' : 'age') + '. Through ' + (align === 'year' ? 'year ' : 'age ') + x + ': ' + nmA + ' ' + _cmpChartFmt(metric, va) + ', ' + nmB + ' ' + _cmpChartFmt(metric, vb) + '.';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + _cmpE(label) + '" style="display:block">' + grid + ticks.join('') +
    '<line x1="' + sx + '" y1="4" x2="' + sx + '" y2="' + Bt + '" stroke="rgba(255,255,255,.35)" stroke-width="1" stroke-dasharray="3 3"/>' +
    '<path d="' + path(sb, x, 999) + '" fill="none" stroke="' + CMP_COL.b + '" stroke-width="2" stroke-dasharray="4 4" opacity=".55"/>' +
    '<path d="' + path(sa, x, 999) + '" fill="none" stroke="' + CMP_COL.a + '" stroke-width="2" stroke-dasharray="4 4" opacity=".55"/>' +
    '<path d="' + path(sb, 0, x) + '" fill="none" stroke="' + CMP_COL.b + '" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<path d="' + path(sa, 0, x) + '" fill="none" stroke="' + CMP_COL.a + '" stroke-width="2.5" stroke-linejoin="round"/>' +
    (vb != null ? '<rect x="' + (+sx - 4.5).toFixed(1) + '" y="' + (Y(vb) - 4.5).toFixed(1) + '" width="9" height="9" rx="2" fill="' + CMP_COL.b + '" stroke="#140F33" stroke-width="2" transform="rotate(45 ' + sx + ' ' + Y(vb).toFixed(1) + ')"/>' : '') +
    (va != null ? '<circle cx="' + sx + '" cy="' + Y(va).toFixed(1) + '" r="5" fill="' + CMP_COL.a + '" stroke="#140F33" stroke-width="2"/>' : '') + '</svg>';
}
// "Through 22, Chourio already has 412 hits. Kent hadn't reached the majors
// yet: he debuted at 24 and finished with 2,461."
function _cmpPace(sa, sb, A, B, x, metric, nmA, nmB, word, align) {
  var fmt = function (n) { return metric === 'ip' ? _cmpNum(Math.round(n)) : _cmpNum(n); };
  var la = sa.at(x), lb = sb.at(x), va = _cmpMetricVal(la, metric) || 0, vb = _cmpMetricVal(lb, metric) || 0;
  var when = align === 'year' ? 'Through ' + x + (x === 1 ? ' season, ' : ' seasons, ') : 'Through age ' + x + ', ';
  if ((CMP_CHART[metric] || [])[3]) {
    // averages: who's better so far, and where each one ended up
    var ra = _cmpMetricVal(la, metric), rb = _cmpMetricVal(lb, metric), lower = metric === 'era' || metric === 'whip';
    var F = function (v) { return _cmpChartFmt(metric, v); };
    var endR = function (s) { return _cmpMetricVal(s.at(s.last), metric); };
    if (ra == null || rb == null) {
      var hv = ra == null ? { nm: nmB, v: rb } : { nm: nmA, v: ra }, nv = ra == null ? { nm: nmA, s: sa, D: A } : { nm: nmB, s: sb, D: B };
      if (hv.v == null) return when + 'neither has a career ' + word + ' yet.';
      return when + hv.nm + '’s career ' + word + ' is ' + F(hv.v) + '. ' + nv.nm + ' hadn’t reached the majors yet: he debuted at ' + nv.s.debutAge + (nv.D.active === false ? ' and finished at ' : ' and is at ') + F(endR(nv.s)) + (nv.D.active === false ? '.' : ' so far.');
    }
    var even = F(ra) === F(rb), aBetter = lower ? ra < rb : ra > rb;
    var an = function (v) { return /^(8|11(\.|$)|18(\.|$))/.test(F(v)) ? 'an ' : 'a '; };
    var out = when + (even ? nmA + ' and ' + nmB + ' are even at ' + an(ra) + F(ra) + ' career ' + word + '.' : (aBetter ? nmA : nmB) + ' is ahead, ' + an(aBetter ? ra : rb) + F(aBetter ? ra : rb) + ' career ' + word + ' to ' + F(aBetter ? rb : ra) + '.');
    var ended = function (D, s, nm) { return s.last <= x ? '' : ' ' + nm + (D.active === false ? ' finished at ' : ' is at ') + F(endR(s)) + (D.active === false ? '.' : ' now.'); };
    return out + ended(B, sb, nmB) + ended(A, sa, nmA);
  }
  var after = align === 'year' ? ' after season ' + x : ' after ' + x;
  var endOf = function (D, s) { return _cmpMetricVal(s.at(s.last), metric) || 0; };
  var finish = function (D, s, nm) { return D.active === false ? ' and finished with ' + fmt(endOf(D, s)) : ' and has ' + fmt(endOf(D, s)) + ' so far'; };
  if (la.pre || lb.pre) {
    var ahead = la.pre ? { nm: nmB, v: vb } : { nm: nmA, v: va }, behind = la.pre ? { nm: nmA, s: sa, D: A } : { nm: nmB, s: sb, D: B };
    return when + ahead.nm + ' already has ' + fmt(ahead.v) + ' ' + word + '. ' + behind.nm + ' hadn’t reached the majors yet: he debuted at ' + behind.s.debutAge + finish(behind.D, behind.s, behind.nm) + '.';
  }
  var diff = va - vb, s = when + (Math.abs(diff) < 1 ? nmA + ' and ' + nmB + ' are even in ' + word + '.' : nmA + (diff > 0 ? ' leads ' : ' trails ') + nmB + ' by ' + fmt(Math.abs(diff)) + ' ' + word + '.');
  var more = function (D, sr, nm) {
    if (sr.last <= x) return '';
    return ' ' + nm + ' added ' + fmt(Math.max(0, endOf(D, sr) - (_cmpMetricVal(sr.at(x), metric) || 0))) + ' more' + after + (D.active === false ? '.' : ' so far.');
  };
  return s + more(B, sb, nmB) + more(A, sa, nmA);
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
function _cmpHeadHtml(P, D, side, S, range) {
  var meta;
  if (D && D.active === false) meta = [D.hof ? 'HOF' : 'Retired', D.pos, _cmpYears(D.first, D.last)].filter(Boolean).join(' · ');
  else meta = D ? [_cmpTeam(D.teamId, D.team), D.pos, D.age != null ? D.age : null].filter(function (x) { return x != null && x !== ''; }).join(' · ') : '';
  var sub = '';
  if (D && D.lines) {
    var ln = D.lines[S.view === 'basic' ? range : D.active === false ? 'career' : 'season'] || D.lines.career;
    if (ln) sub = S.kind === 'pit' ? (ln.w != null ? ln.w + '-' + ln.l + ' · ' + ln.era + ' ERA' : '') : (ln.avg ? [ln.avg, ln.obp, ln.slg].join('/') : '');
  }
  return '<div class="cmp-hd ' + side + '"><span class="cmp-av ' + side + '">' + _cmpE(_cmpIni(P.name || (D && D.name))) + '</span>' +
    '<span class="cmp-nm">' + _cmpE(_cmpLast(P.name || (D && D.name) || '')) + '</span>' +
    '<span class="cmp-meta">' + (meta ? _cmpE(meta) : '&nbsp;') + '</span><span class="cmp-sl">' + (sub ? _cmpE(sub) : '&nbsp;') + '</span></div>';
}
function _cmpSeg(label, items, cur, key, extra) {
  return '<div class="cmp-seg' + (extra ? ' ' + extra : '') + '" role="tablist" aria-label="' + _cmpE(label) + '" style="grid-template-columns:repeat(' + items.length + ',minmax(0,1fr))">' + items.map(function (it) {
    var on = String(it[0]) === String(cur), dis = !!it[2];
    return '<button type="button" role="tab" aria-selected="' + on + '"' + (dis ? ' aria-disabled="true" disabled' : '') + ' class="' + (on ? 'on' : '') + '" onclick="cmpSet(\'' + key + '\',\'' + it[0] + '\')">' + _cmpE(it[1]) + '</button>';
  }).join('') + '</div>';
}
function _cmpRender() {
  var S = window._cmp, el = document.getElementById('cmp-screen');
  if (!S || !el) return;
  var kind = S.kind, A = _cmpData(S.a.id, kind), B = _cmpData(S.b.id, kind);
  var retired = (A && A.active === false) || (B && B.active === false);
  if (retired && S.view === 'sc') S.view = 'age';
  if (retired && S.view === 'basic') S.range = 'career';
  var view = S.view, range = view === 'basic' ? S.range : 'season';
  var SA = view === 'sc' ? _cmpSav(S.a.id) : null, SB = view === 'sc' ? _cmpSav(S.b.id) : null;
  var yr = (A && A.season) || (B && B.season) || new Date().getFullYear();
  var nmA = _cmpLast(S.a.name || (A && A.name) || ''), nmB = _cmpLast(S.b.name || (B && B.name) || '');
  var rows = [], status = '', ageHtml = '', hdL = '', key = '', label = '', ageNotes = [];
  var keyHtml = '<span class="cmp-lg cmp-key"><i class="a"></i>' + _cmpE(nmA) + '<i class="b"></i>' + _cmpE(nmB) + '</span>';
  var pctKey = '<span class="cmp-lg">BETTER →<i></i></span>';
  var loadFail = (!A && _cmpFailed('cmp', _cmpKey(S.a.id, kind))) || (!B && _cmpFailed('cmp', _cmpKey(S.b.id, kind)));
  if (view === 'sc') {
    if (SA && SB) rows = _cmpScRows(SA, SB, kind);
    else if (_cmpFailed('player', S.a.id) || _cmpFailed('player', S.b.id)) status = 'Couldn’t reach Baseball Savant right now. Try again in a minute.';
    hdL = 'PCTL VS MLB · ' + yr; key = pctKey; label = yr + ' Statcast';
  } else if (view === 'age') {
    if (A && B) {
      var align = S.align === 'year' ? 'year' : 'age';
      var sa = _cmpSeries(A, align), sb = _cmpSeries(B, align);
      if (!A.ages || !B.ages) status = 'Still adding up their careers. One moment…';
      else if (!sa || !sb) status = 'No major-league seasons to line up yet.';
      else {
        // from the earlier debut up to where the shorter career stops
        var lo = Math.min(sa.first, sb.first), hi = Math.min(sa.last, sb.last), dom = [];
        for (var v = lo; v <= hi; v++) dom.push(v);
        var x = S.age && dom.indexOf(S.age) !== -1 ? S.age : hi;
        S.age = x;
        // every category both careers have can go on the chart (Gold Gloves and saves only once someone has them)
        var endA = sa.at(sa.last), endB = sb.at(sb.last);
        var metrics = CMP_AGE[kind].filter(function (d) {
          if (d[1] === 'gg') return (endA.gg || 0) + (endB.gg || 0) > 0;
          if (d[1] === 'sv') return (endA.sv || 0) + (endB.sv || 0) >= 20;
          return true;
        }).map(function (d) { return [d[1], CMP_CHART[d[1]][0]]; });
        var metric = S.metric && metrics.some(function (m) { return m[0] === S.metric; }) ? S.metric : CMP_CHART_DEF[kind];
        S.metric = metric;
        var mWord = CMP_CHART[metric][1];
        rows = _cmpAgeRows(sa, sb, x, kind);
        var chips = dom.slice(-8), unit = align === 'year' ? 'SEASON' : 'AGE';
        ageHtml = '<div class="cmp-panel cmp-chart"><div class="cmp-ph"><span>CAREER ' + _cmpE(mWord.toUpperCase()) + ' BY ' + unit + '</span><span class="cmp-dash">DASHED · WHAT CAME NEXT</span></div>' +
          _cmpChartHtml(sa, sb, x, metric, nmA, nmB, align) +
          '<div class="cmp-chartopts">' + _cmpSeg('Line up by', [['age', 'Same age'], ['year', 'Same season #']], align, 'align', 'cmp-mini') + '</div>' +
          '<div class="cmp-mchips" role="tablist" aria-label="Chart">' + metrics.map(function (m) {
            var on = m[0] === metric;
            return '<button type="button" role="tab" aria-selected="' + on + '" class="' + (on ? 'on' : '') + '" onclick="cmpSet(\'metric\',\'' + m[0] + '\')">' + _cmpE(m[1]) + '</button>';
          }).join('') + '</div></div>' +
          '<div class="cmp-ages"><span class="cmp-eb">THROUGH ' + unit + '</span>' + _cmpSeg(align === 'year' ? 'Season' : 'Age', chips.map(function (c) { return [c, String(c)]; }), x, 'age', 'cmp-agechips') + '</div>';
        ageNotes.push(_cmpPace(sa, sb, A, B, x, metric, nmA, nmB, mWord, align));
        hdL = 'THROUGH ' + unit + ' ' + x; key = keyHtml; label = align === 'year' ? 'Through ' + x + ' seasons' : 'Through age ' + x;
      }
    }
  } else {
    if (A && B) rows = _cmpBasicRows(A, B, range, kind);
    var anyPctB = rows.some(function (r) { return r.mode === 'pct'; });
    hdL = anyPctB ? 'PCTL VS QUALIFIED ' + (kind === 'pit' ? 'PITCHERS' : 'HITTERS') : 'HEAD TO HEAD'; key = anyPctB ? pctKey : keyHtml;
    label = { season: yr + ' basics', recent: kind === 'pit' ? 'Last 5 games' : 'Last 15 games', career: 'Career' }[range];
  }
  if (loadFail) status = 'Couldn’t reach MLB stats right now. Try again in a minute.';
  var loading = !rows.length && !status;
  var body;
  if (loading) body = new Array(9).join('<div class="cmp-r cmp-sk" aria-hidden="true"><div class="cmp-s a"><span class="cmp-t a"></span></div><div class="cmp-l"></div><div class="cmp-s b"><span class="cmp-t b"></span></div></div>');
  else if (!rows.length) body = '<div class="cmp-msg">' + _cmpE(status || 'No ' + (range === 'recent' ? 'games in this window' : 'numbers') + ' for these two yet.') + '</div>';
  else body = rows.map(function (r) {
    // v7.88.0: tap a row to put that stat on the chart (Basics jumps to By age)
    var go = view !== 'sc' && CMP_CHART[r.k], on = go && view === 'age' && r.k === S.metric;
    var attrs = go ? ' role="button" tabindex="0" aria-label="' + _cmpE('Chart ' + r.l + ' by age') + '"' + (on ? ' aria-current="true"' : '') + ' onclick="cmpChart(\'' + r.k + '\')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();cmpChart(\'' + r.k + '\')}"' : '';
    return '<div class="cmp-r' + (go ? ' cmp-go' : '') + (on ? ' on' : '') + '"' + attrs + '>' + _cmpSideHtml(r, 'a') + '<div class="cmp-l">' + _cmpE(r.l) + (go ? '<svg class="cmp-gi" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/></svg>' : '') + '</div>' + _cmpSideHtml(r, 'b') + '</div>';
  }).join('');
  var aw = 0, bw = 0;
  rows.forEach(function (r) { if (r.aw) aw++; if (r.bw) bw++; });
  var scored = rows.filter(function (r) { return r.l !== 'G' && r.l !== 'GS'; }).length;
  var edge = loading ? 'Loading…' : !rows.length ? '—' : aw > bw ? nmA + ' wins ' + aw + ' of ' + scored : bw > aw ? nmB + ' wins ' + bw + ' of ' + scored : 'Dead even, ' + aw + '–' + bw;
  var pips = rows.filter(function (r) { return r.l !== 'G' && r.l !== 'GS'; }).map(function (r) { return '<i style="background:' + (r.aw ? CMP_COL.a : r.bw ? CMP_COL.b : 'rgba(168,159,232,.25)') + '"></i>'; }).join('');
  var pick = view === 'sc' ? (kind === 'pit' ? ['xERA', 'Fastball velo', 'Whiff %', 'K %'] : ['xwOBA', 'Exit velo', 'Barrel %', 'Chase %'])
    : view === 'age' ? (kind === 'pit' ? ['W-L', 'ERA', 'K', 'ERA+'] : ['H', 'HR', 'OPS+'])
    : (kind === 'pit' ? ['W-L', 'ERA', 'K', 'ERA+'] : ['OPS', 'HR', 'OPS+']);
  var bits = rows.filter(function (r) { return pick.indexOf(r.l) !== -1 && r.a != null && r.b != null; }).map(function (r) { return r.l + ' ' + r.a + '–' + r.b; });
  window._cmpShare = rows.length ? { label: label, text: [edge].concat(bits).join(' · ') } : null;
  var notes = [];
  if (view === 'basic' && range === 'career' && A && B) {
    var ca = A.lines && A.lines.career, cb = B.lines && B.lines.career;
    if (ca && cb) notes.push(nmA + ': ' + _cmpNum(ca.g) + ' G' + (ca.seasons ? ', ' + ca.seasons + ' seasons' : '') + ' · ' + nmB + ': ' + _cmpNum(cb.g) + ' G' + (cb.seasons ? ', ' + cb.seasons + ' seasons' : ''));
  }
  if (view === 'basic' && range === 'recent' && A && B) {
    var xa = A.lines && A.lines.recent, xb = B.lines && B.lines.recent;
    if (xa && xb) notes.push(kind === 'pit' ? nmA + ': ' + xa.ip + ' IP · ' + nmB + ': ' + xb.ip + ' IP' : nmA + ': ' + xa.pa + ' PA · ' + nmB + ': ' + xb.pa + ' PA');
  }
  if (view !== 'sc' && rows.length) notes.push((kind === 'pit' ? 'ERA+' : 'OPS+') + ' is league-adjusted, not park-adjusted.' + (view === 'age' ? (S.align === 'year' ? ' Season 1 is each player’s first in the majors.' : ' Ages are as of June 30 each season.') : ''));
  if (view === 'sc' && rows.length) notes.push(kind === 'pit' ? 'Percentiles are Baseball Savant’s; fastball velo is his most-used fastball.' : 'Raw numbers from every pitch he’s seen this season; percentiles are Baseball Savant’s.');
  if (view !== 'sc' && rows.length) notes.unshift(view === 'age' ? 'Tap any row to chart it.' : 'Tap any stat to chart it by age.');
  if (status && rows.length) notes.push(status);
  var inGame = typeof _sqInGame === 'function' && _sqInGame();
  var tabs = _cmpSeg('View', [['basic', retired ? 'Career' : 'Basics'], ['sc', 'Statcast', retired], ['age', 'By age']], view, 'view');
  var ranges = view === 'basic' && !retired ? _cmpSeg('Range', [['season', String(yr)], ['recent', kind === 'pit' ? 'L5' : 'L15'], ['career', 'Career']], range, 'range') : '';
  el.innerHTML = '<div class="cmp-in">' +
    '<div class="cmp-top"><button type="button" class="cmp-ib" aria-label="Back" onclick="cmpClose()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>' +
    '<span class="cmp-ttl">' + (kind === 'pit' ? 'COMPARE PITCHERS' : 'COMPARE HITTERS') + '</span><button type="button" class="cmp-ib" aria-label="Swap sides" onclick="cmpSwap()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg></button></div>' +
    '<div class="cmp-heads">' + _cmpHeadHtml(S.a, A, 'a', S, range) + '<span class="cmp-vs">VS</span>' + _cmpHeadHtml(S.b, B, 'b', S, range) + '</div>' +
    '<div class="cmp-tabs">' + tabs + ranges + '</div>' + ageHtml +
    '<div class="cmp-panel"><div class="cmp-ph"><span>' + _cmpE(hdL || (view === 'age' ? 'BY AGE' : '')) + '</span>' + (rows.length ? key : '') + '</div>' + body + '</div>' +
    (ageNotes.length ? '<div class="cmp-pace"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg><span>' + _cmpE(ageNotes[0]) + '</span></div>' : '') +
    '<div class="cmp-edge"><div><span class="cmp-eb">EDGE</span><b>' + _cmpE(edge) + '</b></div><span class="cmp-pips" aria-hidden="true">' + pips + '</span></div>' +
    (inGame && rows.length ? '<button type="button" class="cmp-share" onclick="cmpShare()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>Share in chat</button>' : '') +
    (notes.length ? '<div class="cmp-notes">' + notes.map(function (n) { return '<p>' + _cmpE(n) + '</p>'; }).join('') + '</div>' : '') +
    '</div>';
  var mc = el.querySelector('.cmp-mchips'), mo = mc && mc.querySelector('.on');
  if (mo) mc.scrollLeft = Math.max(0, mo.offsetLeft - (mc.clientWidth - mo.offsetWidth) / 2);
  if (S.focusChart) {
    S.focusChart = false;
    var ch = el.querySelector('.cmp-chart');
    if (ch && ch.scrollIntoView) { var rb = ch.getBoundingClientRect(); if (rb.top < 0 || rb.bottom > window.innerHeight) ch.scrollIntoView({ block: 'start', behavior: window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }
  }
  // the player sheet may have started a Savant call this screen didn't, so
  // its arrival won't ping us: look again shortly while anything is missing
  clearTimeout(window._cmpPoll);
  var waiting = function (d, key) { return !d && !_cmpFailed('cmp', key); };
  if (loading || waiting(A, _cmpKey(S.a.id, kind)) || waiting(B, _cmpKey(S.b.id, kind))) window._cmpPoll = setTimeout(_cmpRefresh, 1500);
}

// ── 4 · Share in the game chat ───────────────────────────────────────────
function cmpShare() {
  var S = window._cmp, q = window._cmpShare;
  if (!S || !q) return;
  var who = _cmpLast(S.a.name) + ' vs ' + _cmpLast(S.b.name);
  var pair = { a: { id: S.a.id, name: S.a.name }, b: { id: S.b.id, name: S.b.name }, kind: S.kind, view: S.view };
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
    return '<button class="gc-pq gc-sq' + (mine ? ' me' : '') + '" data-a="' + _cmpE(c.a.id) + '" data-an="' + _cmpE(c.a.name || '') + '" data-b="' + _cmpE(c.b.id) + '" data-bn="' + _cmpE(c.b.name || '') + '" data-k="' + _cmpE(c.kind || 'bat') + '" data-v="' + _cmpE(c.view || '') + '" onclick="event.stopPropagation();cmpOpenPair(this.dataset.a,this.dataset.an,this.dataset.b,this.dataset.bn,this.dataset.k,this.dataset.v)" style="border-left-color:' + bd + '">' +
      '<span class="gc-pq-hd"><span>' + _cmpE([st.player, st.label].filter(Boolean).join(' · ')) + '</span><span class="gc-pq-go">Compare ›</span></span>' +
      '<span class="gc-pq-tx">' + _cmpE(st.text || rt.text || '') + '</span></button>';
  };
})();
