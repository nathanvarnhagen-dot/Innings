// ══ STATCAST (v5.87.0) — Baseball Savant via /api/savant ══════════════
// Data layer: small in-browser caches with de-duplicated requests. When
// something new arrives for the game on screen, the cheat sheet re-renders
// (the play-animation hook defers that while a play is animating).
window._sav = window._sav || { game: {}, arsenal: {}, batter: {}, player: {}, bvp: {}, pending: {} };
function _savGet(kind, key, url, ttlMs, onArrive) {
  var S = window._sav, bucket = S[kind], e = bucket[key];
  var fresh = e && (ttlMs == null || Date.now() - e.at < ttlMs);
  if (!fresh && !S.pending[kind + key]) {
    S.pending[kind + key] = fetch(url).then(function (r) { S.lastStatus = r.ok ? '' : 'HTTP ' + r.status; return r.json().catch(function () { return null; }).then(function (j) { return r.ok ? j : (j && j.error ? j : null); }); }).then(function (d) {
      delete S.pending[kind + key];
      if (d && !d.error) { var same = !!(e && e.data && JSON.stringify(e.data) === JSON.stringify(d)); bucket[key] = { at: Date.now(), data: d }; if (onArrive && !same) onArrive(d); }
      // v7.8.3: a failed refresh used to leave the old entry's timestamp
      // alone, so the redraw it triggered asked again at once — a
      // fetch/redraw loop for as long as Savant kept failing. Now a failure
      // counts as "checked just now" (the old data stays on screen) and
      // doesn't force a redraw when nothing changed.
      else { if (!e) { bucket[key] = { at: Date.now(), data: null, failed: true, why: (d && (d.detail || d.error)) || S.lastStatus || '' }; if (onArrive) onArrive(null); } else e.at = Date.now(); }
    }).catch(function (err) { delete S.pending[kind + key]; if (!e) { bucket[key] = { at: Date.now(), data: null, failed: true, why: String(err && err.message || err) }; if (onArrive) onArrive(null); } else e.at = Date.now(); });
  }
  return e ? e.data : null;
}
function _savRerender() {
  clearTimeout(window._savRerenderT);
  window._savRerenderT = setTimeout(function () {
    var scr = document.getElementById('screen-game');
    if (scr && scr.classList.contains('active') && typeof renderGameCheatSheet === 'function') renderGameCheatSheet();
  }, 250);
}
function _savGame(pk, live) {
  if (pk == null) return null;
  return _savGet('game', String(pk), '/api/mlb?mode=savant&smode=game&gamePk=' + encodeURIComponent(pk) + (live ? '&live=1' : ''), live ? 20000 : null, _savRerender);
}
function _savPlay(pk, atBatIndex) {
  var g = pk != null ? (window._sav.game[String(pk)] || {}).data : null;
  return g && g.plays ? g.plays[String(atBatIndex)] || null : null;
}
function _savArsenal(id) { return id ? _savGet('arsenal', String(id), '/api/mlb?mode=savant&smode=arsenal&id=' + encodeURIComponent(id), 6 * 3600e3, _savRerender) : null; }
function _savBatter(id) { return id ? _savGet('batter', String(id), '/api/mlb?mode=savant&smode=batter&id=' + encodeURIComponent(id), 6 * 3600e3, _savRerender) : null; }


// ── Batter vs pitcher (v5.89.0) — career line from the MLB Stats API
function _bvp(bId, pId) {
  if (!bId || !pId) return null;
  return _savGet('bvp', bId + ':' + pId, '/api/mlb?mode=bvp&batter=' + encodeURIComponent(bId) + '&pitcher=' + encodeURIComponent(pId), 6 * 3600e3, function () { _savRerender(); if (window._savSheetId) _savPlayerSheetFill(window._savSheetId); });
}
function _bvpText(v) {
  if (!v) return '';
  if (!v.pa) return 'First career meeting';
  var bits = [v.h + '-for-' + v.ab];
  if (v.hr) bits.push(v.hr + ' HR');
  if (v.d) bits.push(v.d + ' 2B');
  if (v.t) bits.push(v.t + ' 3B');
  if (v.bb) bits.push(v.bb + ' BB');
  if (v.so) bits.push(v.so + ' K');
  return bits.join(' · ');
}

function _bvpColsHtml(mb, mp) {
  if (!mb || !mp || !mb.id || !mp.id) return '';
  var v = _bvp(mb.id, mp.id);
  if (!v) return '';
  var key = mb.id + ':' + mp.id, P = window._bvpPlaced || (window._bvpPlaced = {});
  var fresh = !P[key]; P[key] = 1; // slides in once, the first time it moves over
  var label = '<span style="font-size:9.5px;font-weight:700;letter-spacing:.12em;color:#9C95D0;margin-top:5px">VS ' + _escapeHtml(_ghLastName(mp.name).toUpperCase()) + '</span>';
  if (!v.pa) return '<span class="' + (fresh ? 'bvp-in' : '') + '" style="display:flex;flex-direction:column;align-items:flex-end">' + label + '<span style="font-size:12px;color:#CECBF6">First meeting</span></span>';
  var cols = [['H-AB', v.h + '-' + v.ab], ['HR', v.hr], ['RBI', v.rbi]];
  return '<span class="' + (fresh ? 'bvp-in' : '') + '" style="display:flex;flex-direction:column;align-items:flex-end">' + label +
    '<span style="display:grid;grid-template-columns:repeat(3,auto);column-gap:12px;justify-content:end;text-align:right">' +
    cols.map(function (c) { return '<span class="gh-num" style="font-size:12.5px;color:#fff">' + _escapeHtml(String(c[1])) + '</span>'; }).join('') +
    cols.map(function (c) { return '<span style="font-size:9px;font-weight:700;letter-spacing:.06em;color:#9C95D0">' + c[0] + '</span>'; }).join('') + '</span></span>';
}
function _bvpLineHtml(mb, mp) {
  if (!mb || !mp || !mb.id || !mp.id) return '';
  var v = _bvp(mb.id, mp.id);
  if (!v) return '<div aria-hidden="true" style="height:18px;margin:-4px 0 14px"></div>'; // v7.8.0: same height as the line, so its arrival doesn't shift the page
  var slash = v.pa && v.avg ? '<span style="color:#9C95D0"> · ' + _escapeHtml(v.avg + '/' + v.obp + '/' + v.slg) + '</span>' : '';
  return '<div style="display:flex;justify-content:center;align-items:baseline;gap:6px;flex-wrap:wrap;margin:-4px 0 14px;font-size:12.5px;color:#D9D4FA;text-align:center">' +
    '<span class="gh-eyebrow" style="font-size:9.5px">Career</span><b style="color:#fff">' + _escapeHtml(_ghLastName(mb.name)) + ' vs ' + _escapeHtml(_ghLastName(mp.name)) + '</b><span>' + _escapeHtml(_bvpText(v)) + '</span>' + slash + '</div>';
}
// In the player sheet: if this player is in the current live matchup,
// show his career line against the other one.
function _savMatchupHtml(id) {
  var box = typeof _gcBox === 'function' ? _gcBox() : null, m = box && box.matchup;
  if (!m || !m.batter || !m.pitcher) return '';
  var isB = String(m.batter.id) === String(id), isP = String(m.pitcher.id) === String(id);
  if (!isB && !isP) return '';
  var v = _bvp(m.batter.id, m.pitcher.id);
  if (!v) return '<div class="sav-sec"><span class="gh-eyebrow">This matchup</span><span class="gh-sub">Loading…</span></div>';
  var other = isB ? m.pitcher.name : m.batter.name;
  var who = isB ? 'vs ' + other : other + ' against him';
  var stats = v.pa ? [['PA', v.pa], ['H', v.h], ['HR', v.hr], ['BB', v.bb], ['K', v.so], ['AVG', v.avg || '—'], ['OPS', v.ops || '—']] : null;
  return '<div class="sav-sec"><span class="gh-eyebrow" style="color:#9C95D0">This matchup · career</span><span style="font-size:14px;font-weight:700;color:#FFFFFF">' + _escapeHtml(who) + (v.pa ? '' : ' — first career meeting') + '</span>' +
    (stats ? '<div class="sav-bvp" data-who="' + _escapeHtml(who) + '" style="display:grid;grid-template-columns:repeat(' + stats.length + ',auto);column-gap:14px;row-gap:2px;justify-content:start;padding:10px 12px;border-radius:14px;background:rgba(168,159,232,.12);border:1px solid rgba(168,159,232,.2)">' + stats.map(function (x) { return '<span class="gh-num" style="font-size:15px;color:#FFFFFF">' + _escapeHtml(String(x[1])) + '</span>'; }).join('') + stats.map(function (x) { return '<span style="font-size:9.5px;font-weight:700;letter-spacing:.06em;color:#B9B3E6">' + x[0] + '</span>'; }).join('') + '</div>' : '') + '</div>';
}

// ── 1, 2, 3, 5 · Stat pills in the play animation (corners of the square)
function _savPlayPillsHtml(lp, t, E) {
  var g = window._activeBrowseGame, pk = g && g.gamePk;
  var sp = _savPlay(pk, lp.atBatIndex) || {};
  var h = lp.hit || {};
  var ev = h.speed != null ? h.speed : sp.ev, la = h.angle != null ? h.angle : sp.la, dist = h.distance != null ? h.distance : sp.dist;
  var et = lp.eventType || '', tr = h.trajectory || '';
  var isHit = /^(single|double|triple|home_run)$/.test(et);
  var pill = function (txt, bg, col) { return '<span style="padding:3px 8px;border-radius:999px;background:' + (bg || 'rgba(11,8,32,.78)') + ';border:1px solid rgba(168,159,232,.3);color:' + (col || '#F5F3FF') + ';font-size:10.5px;font-weight:800;white-space:nowrap">' + txt + '</span>'; };
  var left = [], right = [];
  var inStrip = !!(window._pa && window._pa.labelOut); // v6.0.0: shown in the Statcast strip instead
  if (inStrip) { ev = null; la = null; dist = null; }
  if (ev != null) left.push(pill(_escapeHtml(String(ev)) + ' mph'));
  if (la != null) left.push(pill(_escapeHtml(String(la)) + '&deg;'));
  if (dist != null && tr !== 'ground_ball') left.push(pill(_escapeHtml(String(dist)) + ' ft'));
  if (sp.xba != null && !inStrip) {
    var x = sp.xba, tag = isHit && x < .25 ? ' · Lucky' : (!isHit && x >= .6 ? ' · Robbed' : '');
    var good = isHit ? '#9BE8AC' : '#FFB3A8';
    right.push(pill('xBA ' + x.toFixed(3).replace(/^0/, '') + tag, tag ? 'rgba(11,8,32,.85)' : null, tag ? good : null));
  }
  if (sp.parks != null && !inStrip && (et === 'home_run' || /fly_ball|line_drive/.test(tr))) right.push(pill('HR in ' + sp.parks + '/30 parks', null, sp.parks >= 15 ? '#9BE8AC' : null));
  var caught = et === 'field_out' && /fly_ball|line_drive|popup/.test(tr);
  if (caught && sp.catchProb != null && sp.catchProb <= .75) {
    var cp = sp.catchProb, stars = cp <= .25 ? 5 : cp <= .5 ? 4 : 3;
    right.push(pill('<span style="color:#F2C869">' + '&#9733;'.repeat(stars) + '</span> ' + Math.round(cp * 100) + '% catch'));
  }
  var closeAt1 = tr === 'ground_ball' && (et === 'single' || (et === 'field_out' && (lp.runners || []).some(function (r) { return r.batter && r.out && r.outBase === '1B'; })));
  if (closeAt1 && lp.batterId) {
    var bd = _savBatter(lp.batterId);
    if (bd && bd.sprintSpeed != null) right.push(pill(bd.sprintSpeed.toFixed(1) + ' ft/s sprint'));
  }
  if (!left.length && !right.length) return '';
  var a = 'animation:paIn .5s linear ' + _paSec(t, E) + ' both;';
  return (left.length ? '<div style="position:absolute;left:8px;bottom:8px;display:flex;flex-direction:column;align-items:flex-start;gap:4px;z-index:4;' + a + '">' + left.join('') + '</div>' : '') +
    (right.length ? '<div style="position:absolute;right:8px;bottom:8px;display:flex;flex-direction:column;align-items:flex-end;gap:4px;z-index:4;' + a + '">' + right.join('') + '</div>' : '');
}

// ── 4 & 6 · Pitch rows: vs his average, and bat speed on swings
function _savPitchExtrasHtml(p, seq, pk) {
  var out = '';
  var ars = _savArsenal(seq && seq.pitcherId);
  var avg = ars && ars.avgSpeed && p.code ? ars.avgSpeed[p.code] : null;
  var mph = p.mph != null ? p.mph : p.speed;
  if (avg != null && mph != null) {
    var d = Math.round((mph - avg) * 10) / 10;
    if (Math.abs(d) >= 1) out += '<span title="vs his ' + avg.toFixed(1) + ' mph average" style="font-size:10.5px;font-weight:800;flex-shrink:0;color:' + (d < 0 ? '#FFB3A8' : '#9BE8AC') + '">' + (d < 0 ? '&#9660;' : '&#9650;') + Math.abs(d).toFixed(1) + '</span>';
  }
  var sp = seq && seq.atBatIndex != null ? _savPlay(pk, seq.atBatIndex) : null;
  var sw = sp && sp.swings ? sp.swings.filter(function (s) { return s.n === p.num; })[0] : null;
  if (sw) {
    var bd = _savBatter(seq.batterId), bavg = bd && bd.avgBatSpeed;
    out += '<span title="' + (bavg ? 'His average: ' + bavg + ' mph' : '') + '" style="font-size:10.5px;font-weight:800;padding:2px 6px;border-radius:6px;background:rgba(168,159,232,.16);color:#D9D4FA;flex-shrink:0">Swing ' + sw.batSpeed.toFixed(0) + (bavg ? '<span style="color:' + (sw.batSpeed >= bavg ? '#9BE8AC' : '#9C95D0') + '"> ' + (sw.batSpeed >= bavg ? '&#9650;' : '&#9660;') + '</span>' : '') + '</span>';
  }
  return out;
}
function _savVeloNoteHtml(seq) {
  var ars = _savArsenal(seq && seq.pitcherId);
  if (!ars || !ars.avgSpeed || !seq || !seq.pitches) return '';
  var diffs = [];
  seq.pitches.forEach(function (p) { if (/^(FF|SI|FC)$/.test(p.code || '') && ars.avgSpeed[p.code] != null && (p.mph != null || p.speed != null)) diffs.push((p.mph != null ? p.mph : p.speed) - ars.avgSpeed[p.code]); });
  if (diffs.length < 2) return '';
  var m = diffs.reduce(function (a, b) { return a + b; }, 0) / diffs.length;
  if (Math.abs(m) < 1.5) return '';
  return '<div style="margin-top:10px;padding:9px 12px;border-radius:12px;font-size:12.5px;line-height:1.45;' + (m < 0 ? 'background:rgba(255,122,107,.10);border:1px solid rgba(255,122,107,.3);color:#FFD2CC' : 'background:rgba(124,242,156,.08);border:1px solid rgba(124,242,156,.3);color:#C8F5D4') + '">' +
    'His fastball is ' + Math.abs(m).toFixed(1) + ' mph ' + (m < 0 ? 'slower' : 'faster') + ' than his season average this at-bat.</div>';
}

// ── 7 · Hot/cold zones behind the strike-zone grid
function _savZonesSvg(seq, x1, y1, x2, y2) {
  var bd = _savBatter(seq && seq.batterId);
  if (!bd || !bd.zones) return '';
  var cw = (x2 - x1) / 3, ch = (y2 - y1) / 3, out = '';
  for (var z = 1; z <= 9; z++) {
    var cell = bd.zones[z];
    if (!cell) continue;
    var r = Math.floor((z - 1) / 3), c = (z - 1) % 3, a = cell.avg;
    var col = a >= .3 ? 'rgba(240,72,72,' + Math.min(.55, .2 + (a - .3) * 2).toFixed(2) + ')' : a <= .2 ? 'rgba(76,157,255,' + Math.min(.55, .2 + (.2 - a) * 2).toFixed(2) + ')' : 'rgba(255,255,255,.04)';
    out += '<rect x="' + (x1 + c * cw).toFixed(1) + '" y="' + (y1 + r * ch).toFixed(1) + '" width="' + cw.toFixed(1) + '" height="' + ch.toFixed(1) + '" fill="' + col + '"><title>' + cell.avg.toFixed(3).replace(/^0/, '') + ' in ' + cell.ab + ' AB</title></rect>';
  }
  return out;
}

// ══ v7.7.0 · NEW PITCHER — his real numbers everywhere on the at-bat card ══
// Savant's percentile colors: blue (poor) → grey (average) → red (great).
function _savPctColor(p) {
  var st = [[0, [50, 102, 204]], [50, [160, 160, 175]], [100, [214, 41, 50]]];
  for (var i = 0; i < st.length - 1; i++) {
    var a = st[i], b = st[i + 1];
    if (p <= b[0]) {
      var t = (p - a[0]) / (b[0] - a[0]);
      return 'rgb(' + a[1].map(function (c, k) { return Math.round(c + (b[1][k] - c) * t); }).join(',') + ')';
    }
  }
  return 'rgb(214,41,50)';
}
var _SAV_PITCH_COL = { FF: '#E8584C', FA: '#E8584C', SI: '#F2A33A', FT: '#F2A33A', FC: '#B07A4F', SL: '#4FB3E8', ST: '#37D0C8', SV: '#4FB3E8', CU: '#6C7BF2', KC: '#8A7BF2', CS: '#6C7BF2', CH: '#5CCB7A', FS: '#3FBF9A', FO: '#3FBF9A', SC: '#9BE8AC', KN: '#C9C2F5', EP: '#C9C2F5' };
function _savPitchColor(code) { return _SAV_PITCH_COL[code] || '#A89FE8'; }
function _savPlayerData(id) {
  if (!id) return null;
  return _savGet('player', String(id), '/api/mlb?mode=savant&smode=player&id=' + encodeURIComponent(id), 6 * 3600e3, _savRerender);
}
function _savSeasonData(id, onArrive) {
  if (!id) return null;
  return _savGet('season', String(id), '/api/mlb?mode=season&id=' + encodeURIComponent(id), 30 * 60e3, onArrive || _savRerender);
}
window._sav.season = window._sav.season || {};
// K%, whiff, chase — plus his standout (highest other percentile, if 80+)
function _savKeyPcts(d) {
  var list = (d && d.pitcher && d.pitcher.percentiles) || [];
  if (!list.length) return [];
  var pick = [], used = {};
  [/^k ?%/i, /^whiff/i, /^chase/i].forEach(function (re) {
    var x = list.filter(function (y) { return re.test(y.label || ''); })[0];
    if (x) { pick.push(x); used[x.label] = 1; }
  });
  var rest = list.filter(function (y) { return !used[y.label] && y.pct != null; }).sort(function (a, b) { return b.pct - a.pct; });
  if (rest[0] && rest[0].pct >= 80) pick.push(rest[0]);
  else { var xe = list.filter(function (y) { return /^xera/i.test(y.label || ''); })[0]; if (xe) pick.push(xe); }
  return pick;
}
function _savShortLabel(l) { return String(l || '').replace(/\s*%$/, ' %').replace(/^Whiff %$/, 'Whiff').replace(/^Chase rate$/, 'Chase'); }
function _savOpenAttrs(p) {
  return 'data-name="' + _escapeHtml(p.name || '') + '" data-id="' + _escapeHtml(String(p.id)) + '" data-league="mlb" onclick="openPlayerLinkSheet(this.dataset.name,this.dataset.id,this.dataset.league)"';
}
// The first batter a reliever faces: who he is, his season, his Savant profile.
function _ghNowPitchingHtml(mp) {
  if (!mp || !mp.id) return '';
  var d = _savPlayerData(mp.id);
  var se = mp.season;
  var h = '<div class="np-card"><div class="np-top"><span class="np-chip">NOW PITCHING</span>' +
    (mp.replaced ? '<span class="np-rep">replaces ' + _escapeHtml(mp.replaced) + '</span>' : '') + '</div>' +
    '<div class="np-name"><button type="button" class="np-nm" ' + _savOpenAttrs(mp) + '>' + _escapeHtml(mp.name || '') + '</button>' +
    '<span class="np-hand">' + _escapeHtml([mp.hand ? mp.hand + 'HP' : '', mp.teamAbbr || ''].filter(Boolean).join(' · ')) + '</span></div>';
  if (se) {
    var cells = [['ERA', se.era], ['IP', se.ip], ['K', se.k], ['WHIP', se.whip], ['AVG', se.avg]].filter(function (c) { return c[1] != null && c[1] !== ''; });
    h += '<div class="np-eb">' + (window._activeBrowseGame && window._activeBrowseGame.season ? window._activeBrowseGame.season + ' ' : '') + 'REGULAR SEASON</div>' +
      '<div class="np-grid" style="grid-template-columns:repeat(' + cells.length + ',minmax(0,1fr))">' + cells.map(function (c) { return '<div><b>' + _escapeHtml(String(c[1])) + '</b><span>' + c[0] + '</span></div>'; }).join('') + '</div>';
    var bits = [];
    if (se.g != null) bits.push(se.g + (se.g === 1 ? ' game' : ' games'));
    if (se.w != null && se.l != null) bits.push(se.w + '–' + se.l);
    if (se.gs) bits.push(se.gs + ' starts');
    if (se.sv) bits.push(se.sv + (se.sv === 1 ? ' save' : ' saves'));
    if (se.hld) bits.push(se.hld + (se.hld === 1 ? ' hold' : ' holds'));
    if (bits.length) h += '<div class="np-sub">' + _escapeHtml(bits.join(' · ')) + '</div>';
  }
  var pcts = _savKeyPcts(d);
  if (pcts.length) {
    h += '<div class="np-sec"><div class="np-row"><span class="np-eb" style="margin:0">SAVANT PERCENTILES</span><span class="np-mut">vs all MLB pitchers</span></div>' +
      pcts.map(function (x) {
        var p = Math.max(1, Math.min(100, Math.round(x.pct))), c = _savPctColor(p);
        return '<div class="np-pct"><span>' + _escapeHtml(x.label) + '</span><div class="np-trk"><i style="width:' + p + '%;background:' + c + '"></i><b style="left:calc((100% - 22px) * ' + (p / 100).toFixed(2) + ');background:' + c + '">' + p + '</b></div></div>';
      }).join('') + '</div>';
  }
  var ars = (d && d.pitcher && d.pitcher.arsenal) || [];
  if (ars.length) {
    h += '<div class="np-sec"><span class="np-eb" style="margin:0">WHAT HE THROWS</span>' + ars.slice(0, 3).map(function (a) {
      var c = _savPitchColor(a.code), u = a.usage != null ? a.usage : 0;
      return '<div class="np-ars"><i style="background:' + c + '"></i><span class="np-an">' + _escapeHtml(_savPitchShort(a.name || a.code)) + '</span><div class="np-ab"><i style="width:' + Math.min(100, u) + '%;background:' + c + '"></i></div><b>' + Math.round(u) + '%</b><span class="np-mph">' + (a.mph != null ? a.mph.toFixed(1) + ' mph' : '') + '</span></div>';
    }).join('') + (ars.length > 3 ? '<span class="np-mut">+ ' + _escapeHtml(ars.slice(3).map(function (a) { return _savPitchShort(a.name || a.code).toLowerCase(); }).join(', ')) + '</span>' : '') + '</div>';
  } else if (!d && !(window._sav.player[String(mp.id)] || {}).failed) {
    h += '<div class="np-mut" style="margin-top:10px">Loading Statcast…</div>';
  }
  h += '<button type="button" class="np-btn" ' + _savOpenAttrs(mp) + '>His Baseball Savant page<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 5 16 12 9 19"/></svg></button></div>';
  return h;
}
function _savPitchShort(n) { return String(n || '').replace(/^4-Seam Fastball$/i, '4-Seam').replace(/^Four-Seam Fastball$/i, '4-Seam').replace(/^Knuckle Curve$/i, 'Knuckle curve'); }
// v7.7.1: MLB's pitch codes in words, for pitches Savant's season arsenal doesn't list
var _PITCH_NAMES = { FF: '4-Seam', FA: 'Fastball', SI: 'Sinker', FT: '2-Seam', FC: 'Cutter', SL: 'Slider', ST: 'Sweeper', SV: 'Slurve', CU: 'Curveball', KC: 'Knuckle curve', CS: 'Slow curve', CH: 'Changeup', FS: 'Splitter', FO: 'Forkball', SC: 'Screwball', KN: 'Knuckleball', EP: 'Eephus', PO: 'Pitchout' };
function _savPitchName(code, arsenalRow) { return arsenalRow && arsenalRow.name ? _savPitchShort(arsenalRow.name) : (_PITCH_NAMES[code] || code); }
// The rest of his outing: percentile chips + a way to his page.
function _ghPitcherChipsHtml(mp) {
  if (!mp || !mp.id) return '';
  var pcts = _savKeyPcts(_savPlayerData(mp.id));
  if (!pcts.length) {
    // v7.8.0: hold the row's space while Savant loads so nothing below jumps
    var e = window._sav.player[String(mp.id)];
    return (!e || (!e.data && !e.failed)) ? '<div class="np-chips np-skel" aria-hidden="true"><span class="np-mini"><b></b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span class="np-mini"><b></b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span><span class="np-mini"><b></b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span></div>' : '';
  }
  return '<div class="np-chips">' + pcts.map(function (x) {
    var p = Math.max(1, Math.min(100, Math.round(x.pct)));
    return '<span class="np-mini"><b style="background:' + _savPctColor(p) + '">' + p + '</b>' + _escapeHtml(_savShortLabel(x.label)) + '</span>';
  }).join('') + '<button type="button" class="np-sv" ' + _savOpenAttrs(mp) + '>Savant ›</button></div>';
}
// Pitch mix today (every pitch he's thrown in this game) vs his season.
function _ghMixTodayHtml(box, mp) {
  if (!mp || !mp.id || !box) return '';
  var d = _savPlayerData(mp.id), ars = (d && d.pitcher && d.pitcher.arsenal) || [];
  if (!ars.length) return '';
  var counts = {}, total = 0, add = function (code) { if (!code) return; counts[code] = (counts[code] || 0) + 1; total++; };
  (box.allPlays || []).forEach(function (pl) {
    if (!pl.anim || String(pl.anim.pitcherId) !== String(mp.id)) return;
    (pl.pitches || []).forEach(function (x) { add(x.code); });
  });
  var seq = box.pitchSequence;
  if (seq && String(seq.pitcherId) === String(mp.id) && !(box.allPlays || []).some(function (pl) { return pl.atBatIndex === seq.atBatIndex; })) (seq.pitches || []).forEach(function (x) { add(x.code); });
  if (total < 8) return '';
  var avg = {}; ars.forEach(function (a) { avg[a.code] = a; });
  var rows = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 3);
  var missing = rows.some(function (code) { return !(avg[code] && avg[code].usage != null); });
  return '<div class="np-mix"><div class="np-row"><span class="np-eb" style="margin:0">MIX TODAY VS SEASON</span><span class="np-mut">' + total + ' pitches</span></div><div class="np-mixg">' +
    rows.map(function (code) {
      var pct = Math.round(counts[code] / total * 100), a = avg[code], c = _savPitchColor(code);
      return '<span class="np-mn"><i style="background:' + c + '"></i>' + _escapeHtml(_savPitchName(code, a)) + '</span><div class="np-ab"><i style="width:' + pct + '%;background:' + c + '"></i></div><b>' + pct + '%</b><span class="np-mut">' + (a && a.usage != null ? Math.round(a.usage) + '% avg' : '\u2014') + '</span>';
    }).join('') + '</div>' + (missing ? '<div class="np-mut" style="margin-top:8px">\u2014 not in his season mix on Baseball Savant</div>' : '') + '</div>';
}
// Top of the player sheet: the regular-season line (hand, position, team).
function _savSeasonHtml(id) {
  var want = String(id);
  var d = _savSeasonData(id, function () { if (window._savSheetId === want) _savPlayerSheetFill(id); });
  if (!d || d.error) return '';
  var head = [d.hand && d.pos === 'P' ? d.hand + 'HP' : d.pos, d.team].filter(Boolean).join(' · ');
  var blk = function (title, cells, sub) {
    cells = cells.filter(function (c) { return c[1] != null && c[1] !== ''; });
    if (!cells.length) return '';
    return '<div class="sav-sec sav-season"><div class="np-row"><span class="gh-eyebrow">' + title + '</span>' + (head ? '<span class="np-mut">' + _escapeHtml(head) + '</span>' : '') + '</div>' +
      '<div class="np-grid" style="grid-template-columns:repeat(' + cells.length + ',minmax(0,1fr))">' + cells.map(function (c) { return '<div><b>' + _escapeHtml(String(c[1])) + '</b><span>' + c[0] + '</span></div>'; }).join('') + '</div>' +
      (sub ? '<div class="np-sub">' + _escapeHtml(sub) + '</div>' : '') + '</div>';
  };
  var out = '';
  var p = d.pitching, b = d.hitting;
  if (p && (d.pos === 'P' || !b)) {
    var bits = [];
    if (p.g != null) bits.push(p.g + ' games'); if (p.w != null) bits.push(p.w + '–' + p.l);
    if (p.gs) bits.push(p.gs + ' starts'); if (p.sv) bits.push(p.sv + ' saves'); if (p.hld) bits.push(p.hld + ' holds');
    out += blk(d.season + ' regular season', [['ERA', p.era], ['IP', p.ip], ['K', p.k], ['BB', p.bb], ['WHIP', p.whip]], bits.join(' · '));
  } else if (b) {
    out += blk(d.season + ' regular season', [['AVG', b.avg], ['OBP', b.obp], ['SLG', b.slg], ['HR', b.hr], ['RBI', b.rbi]], b.g != null ? b.g + ' games' + (b.pa != null ? ' · ' + b.pa + ' PA' : '') : '');
  }
  return out;
}

// ── 8, 9, 10 · Player sheet: percentiles, arsenal, spray chart
function _savPlayerSheetFill(id) {
  var box = document.getElementById('player-sav');
  if (!box) return;
  box.innerHTML = '<div class="sav-loading">Loading Statcast…</div>';
  var want = String(id);
  _savGet('player', want, '/api/mlb?mode=savant&smode=player&id=' + encodeURIComponent(id), 6 * 3600e3, function () { if (window._savSheetId === want) _savPlayerSheetFill(id); });
  var e = window._sav.player[want];
  if (!e) { box.innerHTML = _savMatchupHtml(id) + box.innerHTML; return; }
  var d = e.data;
  if (!d) { box.innerHTML = _savMatchupHtml(id) + '<div style="font-size:12.5px;color:#9C95D0;padding:6px 2px 12px">' + (e.failed ? 'Couldn\u2019t reach Baseball Savant right now \u2014 try again in a minute.' + (e.why ? '<span style="display:block;margin-top:4px;font-size:11px;color:#6F6A98">(' + _escapeHtml(String(e.why).slice(0, 140)) + ')</span>' : '') : 'No Statcast data for this player yet.') + '</div>'; if (e.failed) delete window._sav.player[want]; return; }
  // a partial answer (Savant was slow) fills in with one more try
  if (d.partial && !e.retried) { e.retried = true; setTimeout(function () { if (window._savSheetId !== want) return; e.at = 0; _savGet('player', want, '/api/mlb?mode=savant&smode=player&id=' + encodeURIComponent(id), 6 * 3600e3, function () { if (window._savSheetId === want) _savPlayerSheetFill(id); }); }, 6000); }
  var html = _savMatchupHtml(id); // v7.14.0: the season line moved to the top of the sheet (js/games/player-lines.js)
  var pctBlock = function (title, list) {
    if (!list || !list.length) return '';
    return '<div class="sav-sec"><span class="gh-eyebrow">' + title + '</span>' + list.map(function (x) {
      var p = Math.max(1, Math.min(100, Math.round(x.pct)));
      var col = _savPctColor(p);
      // v7.7.0: Savant's own scale (blue poor → grey → red great); the circle stays inside the track
      return '<div class="sav-pct"><span class="sav-pct-l">' + _escapeHtml(x.label) + '</span><span class="sav-pct-bar"><i style="width:' + p + '%;background:' + col + '"></i><b style="left:calc((100% - 22px) * ' + (p / 100).toFixed(2) + ');background:' + col + '">' + p + '</b></span></div>';
    }).join('') + '<div class="sav-legend"><span>Poor</span><span>Average</span><span>Great</span></div></div>';
  };
  if (d.pitcher) html += pctBlock('Pitching percentiles · ' + d.year, d.pitcher.percentiles);
  if (d.batter) html += pctBlock('Hitting percentiles · ' + d.year, d.batter.percentiles);
  if (d.pitcher && d.pitcher.arsenal && d.pitcher.arsenal.length) {
    html += '<div class="sav-sec"><span class="gh-eyebrow">Pitch arsenal</span><div class="sav-ars sav-ars-h"><span>Pitch</span><span>Use</span><span>MPH</span><span>Whiff</span><span>RV/100</span></div>' +
      d.pitcher.arsenal.map(function (a) {
        var rv = a.rv100;
        return '<div class="sav-ars"><span style="font-weight:700;display:flex;align-items:center;gap:7px;min-width:0"><i class="sav-dot" style="background:' + _savPitchColor(a.code) + '"></i>' + _escapeHtml(a.name || a.code) + '</span><span>' + (a.usage != null ? a.usage.toFixed(0) + '%' : '—') + '</span><span>' + (a.mph != null ? a.mph.toFixed(1) : '—') + '</span><span>' + (a.whiff != null ? a.whiff.toFixed(0) + '%' : '—') + '</span>' +
          '<span style="color:' + (rv == null ? '#D9D4FA' : rv > 0 ? '#9BE8AC' : rv < 0 ? '#FFB3A8' : '#D9D4FA') + '">' + (rv == null ? '—' : (rv > 0 ? '+' : '') + rv.toFixed(1)) + '</span></div>';
      }).join('') + '</div>';
  }
  if (d.batter && d.batter.spray && d.batter.spray.length) html += '<div class="sav-sec"><span class="gh-eyebrow">Spray chart · ' + d.year + '</span>' + _savSprayHtml(d.batter.spray) + '</div>';
  var extra = [];
  if (d.sprintSpeed != null) extra.push('<span class="sav-x">Sprint speed <b>' + d.sprintSpeed.toFixed(1) + ' ft/s</b></span>');
  if (d.batter && d.batter.avgBatSpeed != null) extra.push('<span class="sav-x">Avg bat speed <b>' + d.batter.avgBatSpeed.toFixed(1) + ' mph</b></span>');
  if (extra.length) html += '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#D9D4FA;padding:0 2px 10px">' + extra.join('') + '</div>';
  if (d.partial) html += '<div style="font-size:12px;color:#9C95D0;padding:0 2px 10px">Still loading some of it…</div>';
  box.innerHTML = html || '<div style="font-size:12.5px;color:#9C95D0;padding:6px 2px 12px">No Statcast data for this player yet.</div>';
}
// v6.6.0: tappable filters. Hits only by default (outs one tap away); tap
// one type to see only that, tap more to add them, tap again to drop one.
var _SP_CATS = [['hr', 'HR', '#F04848'], ['3b', '3B', '#FF9F43'], ['2b', '2B', '#F2C869'], ['1b', '1B', '#4C9DFF'], ['out', 'Out', 'rgba(255,255,255,.35)']];
window._spSel = window._spSel || { set: null, outs: false }; // set null = every kind of hit
function _spCat(ev) { return ev === 'home_run' ? 'hr' : ev === 'triple' ? '3b' : ev === 'double' ? '2b' : ev === 'single' ? '1b' : 'out'; }
function _spVisible(c) { var S = window._spSel; return c === 'out' ? S.outs : (S.set == null || S.set.indexOf(c) !== -1); }
function _savSprayHtml(pts) {
  var counts = { hr: 0, '3b': 0, '2b': 0, '1b': 0, out: 0 };
  var col = {}; _SP_CATS.forEach(function (c) { col[c[0]] = c[2]; });
  var withCat = pts.map(function (p) { var c = _spCat(p.ev); counts[c]++; return { p: p, c: c }; });
  // outs underneath, hits on top
  withCat.sort(function (a, b) { return (a.c === 'out' ? 0 : 1) - (b.c === 'out' ? 0 : 1); });
  var dots = withCat.map(function (o) {
    var p = o.p;
    var dx = p.x - 125.42, dy = 198.27 - p.y, a = Math.atan2(dx, dy), r = Math.min(Math.hypot(dx, dy) * 2.5, 450) / 400 * 270;
    var x = 250 + r * Math.sin(a), y = 366 - r * Math.cos(a);
    return '<circle data-c="' + o.c + '" cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="4.5" fill="' + col[o.c] + '"' + (_spVisible(o.c) ? '' : ' style="display:none"') + '/>';
  }).join('');
  var chips = _SP_CATS.map(function (c) {
    if (!counts[c[0]]) return '';
    var on = _spVisible(c[0]);
    return '<button class="sp-chip' + (on ? ' on' : '') + '" data-c="' + c[0] + '" onclick="spToggle(this)" aria-pressed="' + on + '"><i style="background:' + c[2] + '"></i>' + c[1] + '<span>' + counts[c[0]] + '</span></button>';
  }).join('');
  var S = window._spSel, filtered = S.set != null || S.outs;
  return '<div class="sp-wrap"><div style="border-radius:14px;overflow:hidden;background:#120E2B;border:1px solid rgba(168,159,232,.12)"><svg viewBox="0 0 500 386" width="100%" height="200" style="display:block">' +
    '<path d="M 58 174 Q 250 20 442 174 L 250 366 Z" fill="#12402A" fill-opacity=".45"/><path d="M 250 366 L 330 286 L 250 206 L 170 286 Z" fill="#6B4A2A" fill-opacity=".35"/>' +
    '<g fill="none" stroke="#D9D4FA" stroke-opacity=".5" stroke-width="2"><path d="M 250 366 L 58 174"/><path d="M 250 366 L 442 174"/><path d="M 58 174 Q 250 20 442 174"/></g>' + dots + '</svg></div>' +
    '<div class="sp-chips">' + chips + '<button class="sp-chip sp-reset" onclick="spReset()"' + (filtered ? '' : ' style="display:none"') + '>All hits</button></div></div>';
}
function spToggle(btn) {
  var S = window._spSel, c = btn.getAttribute('data-c');
  if (c === 'out') S.outs = !S.outs;
  else if (S.set == null) S.set = [c];                         // first tap: only this kind
  else { var i = S.set.indexOf(c); if (i === -1) S.set.push(c); else S.set.splice(i, 1); if (!S.set.length) S.set = null; }
  _spApply();
}
function spReset() { window._spSel = { set: null, outs: false }; _spApply(); }
function _spApply() {
  var S = window._spSel;
  document.querySelectorAll('.sp-wrap').forEach(function (w) {
    w.querySelectorAll('circle[data-c]').forEach(function (d) { d.style.display = _spVisible(d.getAttribute('data-c')) ? '' : 'none'; });
    w.querySelectorAll('.sp-chip[data-c]').forEach(function (b) { var on = _spVisible(b.getAttribute('data-c')); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var r = w.querySelector('.sp-reset'); if (r) r.style.display = (S.set != null || S.outs) ? '' : 'none';
  });
}

// ── 11 · Memory ticket: the game by the numbers
function _savMemoryFill(pk) {
  var el = document.getElementById('md-sav-' + pk);
  if (!el) return;
  var cached = _savGameSummary(pk, function () { _savMemoryFill(pk); });
  if (!cached) { el.innerHTML = ''; return; }
  var s = cached, rows = [];
  if (s.hardest) rows.push(['Hardest-hit ball', s.hardest.ev.toFixed(1) + ' mph', s.hardest.name]);
  if (s.fastest) rows.push(['Fastest pitch', s.fastest.mph.toFixed(1) + ' mph', s.fastest.name]);
  if (s.longestHr) rows.push(['Longest homer', s.longestHr.dist + ' ft', s.longestHr.name]);
  if (!rows.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px"><span class="gh-eyebrow">By the numbers</span>' + rows.map(function (r) {
    return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px"><span style="font-size:13px;color:#D9D4FA">' + r[0] + '</span><span style="font-size:13.5px;font-weight:800;text-align:right">' + _escapeHtml(r[1]) + (r[2] ? '<span style="font-weight:600;color:#B9B3E6"> · ' + _escapeHtml(_ghLastName(r[2])) + '</span>' : '') + '</span></div>';
  }).join('') + '</div>';
}
// Finished games never change: keep their summary in localStorage too.
function _savGameSummary(pk, onArrive) {
  var key = 'innings_sav_sum_' + pk;
  try { var ls = localStorage.getItem(key); if (ls) return JSON.parse(ls); } catch (e) {}
  var d = _savGet('game', String(pk), '/api/mlb?mode=savant&smode=game&gamePk=' + encodeURIComponent(pk), null, function (data) {
    if (data && data.summary) { try { localStorage.setItem(key, JSON.stringify(data.summary)); } catch (e) {} }
    if (onArrive) onArrive();
  });
  return d && d.summary ? d.summary : null;
}

// ── 12 · Your ballpark record (Memories), 13 · season recap
function _bpAttendedMlb(moments) {
  return (moments || []).filter(function (m) {
    var pk = m.boxScore && m.boxScore.gamePk;
    var sport = typeof _mdSport === 'function' ? _mdSport(m) : ((m.boxScore && m.boxScore.sport) || 'mlb');
    return pk != null && m.attendance === 'attend' && sport === 'mlb';
  });
}
function _bpCompute(moments) {
  var games = _bpAttendedMlb(moments), missing = 0;
  var rec = { games: games.length, hrs: 0, longest: null, fastest: null, hardest: null, byYear: {} };
  games.forEach(function (m) {
    var pk = m.boxScore.gamePk;
    var s = _savGameSummary(pk, function () { clearTimeout(window._bpT); window._bpT = setTimeout(function () { _bpRender(window._moments); }, 300); });
    if (!s) { missing++; return; }
    var yr = String(m.date || '').slice(0, 4) || 'all';
    var Y = rec.byYear[yr] || (rec.byYear[yr] = { games: 0, hrs: 0, longest: null, fastest: null, hardest: null, withCount: {} });
    Y.games++;
    var who = typeof _gattLiveNames === 'function' ? _gattLiveNames(m) : [];
    who.forEach(function (n) { Y.withCount[n] = (Y.withCount[n] || 0) + 1; });
    var ctx = { date: m.date, venue: m.boxScore.venue || '', who: who, memoryId: m._id };
    [rec, Y].forEach(function (R) {
      R.hrs += (s.homeRuns || []).length;
      if (s.longestHr && (!R.longest || s.longestHr.dist > R.longest.dist)) R.longest = Object.assign({}, s.longestHr, ctx);
      if (s.fastest && (!R.fastest || s.fastest.mph > R.fastest.mph)) R.fastest = Object.assign({}, s.fastest, ctx);
      if (s.hardest && (!R.hardest || s.hardest.ev > R.hardest.ev)) R.hardest = Object.assign({}, s.hardest, ctx);
    });
  });
  rec.loading = missing > 0;
  return rec;
}
function _bpRender(moments) {
  var el = document.getElementById('ballpark-record');
  if (!el) return;
  var rec = _bpCompute(moments);
  if (!rec.games) { el.innerHTML = ''; return; }
  var tile = function (v, l) { return '<div class="bp-tile"><span class="bp-v">' + v + '</span><span class="bp-l">' + l + '</span></div>'; };
  var withTxt = function (x) { return x && x.who && x.who.length ? ' (with ' + _escapeHtml(x.who.slice(0, 2).join(' & ')) + ')' : ''; };
  var year = String(new Date().getFullYear());
  el.innerHTML = '<div class="bp-card"><div class="gh-row"><span class="gh-eyebrow">Your ballpark record</span>' + (rec.loading ? '<span class="gh-sub">Counting…</span>' : '') + '</div>' +
    '<div class="bp-grid">' + tile(rec.hrs, 'home runs seen') + tile(rec.longest ? rec.longest.dist + ' ft' : '—', 'longest homer' + withTxt(rec.longest)) +
      tile(rec.fastest ? rec.fastest.mph.toFixed(1) : '—', 'fastest pitch (mph)') + tile(rec.games, rec.games === 1 ? 'game attended' : 'games attended') + '</div>' +
    (rec.longest ? '<div style="font-size:12.5px;color:#D9D4FA;line-height:1.45">Longest homer you&rsquo;ve seen: ' + _escapeHtml(rec.longest.name || '') + ', ' + _escapeHtml(rec.longest.date ? _formatMomentDate(rec.longest.date) : '') + (rec.longest.venue ? ', at ' + _escapeHtml(rec.longest.venue) : '') + '.</div>' : '') +
    (rec.byYear[year] ? '<button class="bp-recap-btn" onclick="openSeasonRecap(\'' + year + '\')">Your ' + year + ' in baseball <span aria-hidden="true">&rsaquo;</span></button>' : '') + '</div>';
}
function openSeasonRecap(year) {
  var rec = _bpCompute(window._moments);
  var Y = rec.byYear[year];
  if (!Y) return;
  var topFriend = Object.keys(Y.withCount).sort(function (a, b) { return Y.withCount[b] - Y.withCount[a]; })[0];
  var slides = [];
  slides.push({ k: 'Your ' + year + ' in baseball', big: 'You went to ' + Y.games + (Y.games === 1 ? ' game.' : ' games.'), sub: topFriend ? 'Most often with ' + topFriend + ' (' + Y.withCount[topFriend] + ').' : '' });
  if (Y.hrs) slides.push({ k: 'Home runs', big: 'You saw ' + Y.hrs + (Y.hrs === 1 ? ' home run.' : ' home runs.'), sub: Y.longest ? 'The longest went ' + Y.longest.dist + ' ft — ' + (Y.longest.name || '') + (Y.longest.who && Y.longest.who.length ? '. You were with ' + Y.longest.who.join(' & ') + '.' : '.') : '' });
  if (Y.fastest) slides.push({ k: 'Heat', big: 'Fastest pitch: ' + Y.fastest.mph.toFixed(1) + ' mph.', sub: (Y.fastest.name || '') + (Y.fastest.date ? ', ' + _formatMomentDate(Y.fastest.date) : '') });
  if (Y.hardest) slides.push({ k: 'Loudest contact', big: 'Hardest-hit ball: ' + Y.hardest.ev.toFixed(1) + ' mph.', sub: (Y.hardest.name || '') + (Y.hardest.venue ? ' at ' + Y.hardest.venue : '') });
  slides.push({ k: 'See you next season', big: year + ', kept.', sub: 'Every one of these lives in your Memories.' });
  window._recap = { slides: slides, i: 0 };
  var ov = document.getElementById('recap-overlay');
  if (!ov) { ov = document.createElement('div'); ov.id = 'recap-overlay'; document.body.appendChild(ov); }
  ov.className = 'on';
  _recapShow();
}
function _recapShow() {
  var R = window._recap, ov = document.getElementById('recap-overlay');
  if (!R || !ov) return;
  var s = R.slides[R.i];
  ov.innerHTML = '<div class="rc-bars">' + R.slides.map(function (_, i) { return '<span><i style="' + (i < R.i ? 'transform:scaleX(1)' : i === R.i ? 'animation:reelBar 6s linear both' : '') + '"></i></span>'; }).join('') + '</div>' +
    '<button class="rc-close" onclick="closeSeasonRecap()" aria-label="Close">&times;</button>' +
    '<button class="rc-tap" onclick="recapNext()" aria-label="Next">' +
    '<span class="gh-eyebrow">' + _escapeHtml(s.k) + '</span><span class="rc-big">' + _escapeHtml(s.big) + '</span>' + (s.sub ? '<span class="rc-sub">' + _escapeHtml(s.sub) + '</span>' : '') + '</button>' +
    (R.i === R.slides.length - 1 && navigator.share ? '<button class="rc-share" onclick="recapShare()">Share</button>' : '');
  clearTimeout(R.t);
  R.t = setTimeout(recapNext, 6000);
}
function recapNext() { var R = window._recap; if (!R) return; if (R.i < R.slides.length - 1) { R.i++; _recapShow(); } else closeSeasonRecap(); }
function closeSeasonRecap() { var R = window._recap; if (R) clearTimeout(R.t); var ov = document.getElementById('recap-overlay'); if (ov) { ov.className = ''; ov.innerHTML = ''; } }
function recapShare() {
  var R = window._recap; if (!R) return;
  var txt = R.slides.map(function (s) { return s.big + (s.sub ? ' ' + s.sub : ''); }).join('\n');
  try { navigator.share({ title: R.slides[0].k, text: txt }); } catch (e) {}
}

(function () {
  if (typeof renderMoments !== 'function') return;
  var prev = renderMoments;
  renderMoments = function (arr) { var r = prev.apply(this, arguments); try { _bpRender(arr || window._moments); } catch (e) { console.error('[ballpark record]', e); } return r; };
})();
