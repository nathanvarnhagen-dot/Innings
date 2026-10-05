// ══ PLATE APPEARANCE TAKEOVER + STATCAST PANEL (v7.9.0) ══════════════════
// Every plate appearance gets the home run takeover's motion, scaled by how
// big the moment is:
//   · home run, triple, double, single → full takeover, batting team colors
//   · strikeout                        → full takeover, PITCHING team colors
//   · walk, hit by pitch               → lite takeover (no logo, no stripes)
//   · outs in play, errors, sacrifices → lite takeover in neutral purple
// Balls in play carry a still spray chart on the right of the takeover.
// Under the square, a fixed-height panel (#gh-pa-panel) holds the nerdy
// part for the last play — league percentiles, parks, xBA, bat speed — so
// the page never grows or jumps. Savant numbers arrive 20-60 s late and
// fill in on the next refresh. The same panel shows under a play replayed
// from the play-by-play, and on a player's sheet under "Today".

// ── League table (approximate MLB distributions, mean / sd). Percentiles
// compare one pitch or one batted ball to every one of its kind this
// season. v1 is a built-in table; next step is a weekly Savant pull.
var _PAT_LG = {
  ev: [88.6, 14.5],          // exit velo, all batted balls
  bat: [71.6, 4.3],          // bat speed, competitive swings
  velo: { FF: [94.2, 2.3], FA: [94.2, 2.3], SI: [93.4, 2.4], FT: [93.4, 2.4], FC: [89.4, 2.9], SL: [85.6, 3.0], ST: [82.3, 2.8], SV: [81.0, 3.0], CU: [79.6, 3.4], KC: [82.5, 3.0], CS: [76.0, 3.5], CH: [86.2, 3.2], FS: [86.6, 2.8], FO: [84.0, 3.0] },
  spin: { FF: [2290, 140], FA: [2290, 140], SI: [2150, 150], FT: [2150, 150], FC: [2400, 170], SL: [2430, 240], ST: [2600, 260], SV: [2600, 250], CU: [2550, 280], KC: [2450, 250], CS: [2400, 300], CH: [1780, 250], FS: [1300, 300], FO: [1200, 300] },
  ivb: { FF: [15.8, 2.6], FA: [15.8, 2.6] }  // ride only means something on four-seamers
};
function _patCdf(z) { // standard normal CDF (Abramowitz-Stegun)
  var t = 1 / (1 + .2316419 * Math.abs(z)), d = .3989423 * Math.exp(-z * z / 2);
  var p = d * t * (.3193815 + t * (-.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
function _patPct(v, ms) {
  if (v == null || !ms) return null;
  return Math.max(1, Math.min(99, Math.round(_patCdf((v - ms[0]) / ms[1]) * 100)));
}

// ── Which takeover a play gets
function _patTier(lp) {
  var t = (lp && lp.eventType) || '';
  if (!t || (typeof _paIsAction === 'function' && _paIsAction(lp))) return null;
  if (t === 'home_run') return { kind: 'hr', full: 1, team: 'bat', dur: 3.3 };
  if (t === 'triple' || t === 'double') return { kind: 'hit', full: 1, team: 'bat', dur: 2.8 };
  if (t === 'single') return { kind: 'hit', full: 1, team: 'bat', dur: 2.6 };
  if (/^strikeout/.test(t)) return { kind: 'k', full: 1, team: 'pit', dur: 2.6 };
  if (/^(walk|intent_walk)$/.test(t)) return { kind: 'walk', full: 0, team: 'bat', dur: 2.2 };
  if (/^(hit_by_pitch|catcher_interf)$/.test(t)) return { kind: 'hbp', full: 0, team: 'bat', dur: 2.2 };
  if (lp.hit || /field_out|double_play|triple_play|force_out|fielders_choice|sac_|field_error/.test(t)) return { kind: 'out', full: 0, team: 'neutral', dur: 2.2 };
  return null;
}
function _patTeam(lp, box, which) {
  var batAway = lp.half === 'top';
  var away = which === 'pit' ? !batAway : batAway;
  var name = away ? box.away : box.home;
  var abbr = away ? (box.awayAbbr || _ghAbbrFallback(box.away || '')) : (box.homeAbbr || _ghAbbrFallback(box.home || ''));
  return { name: name, abbr: abbr, c: _ghTeamColors(abbr) };
}
function _patLast(full) { return typeof _ghLastName === 'function' ? _ghLastName(full || '') : (full || ''); }
function _patLastPitch(lp) { var ps = (lp && lp.pitches) || []; return ps.length ? ps[ps.length - 1] : null; }

// "up and in", "down and away", "middle-middle" from the batter's view
function _patLoc(lp, p) {
  if (!p || p.px == null || p.pz == null) return '';
  var top = lp.zoneTop || 3.5, bot = lp.zoneBottom || 1.5, third = (top - bot) / 3;
  var v = p.pz > top - third ? 'up' : p.pz < bot + third ? 'down' : '';
  var inside = lp.batSide === 'L' ? p.px > .28 : p.px < -.28, away = lp.batSide === 'L' ? p.px < -.28 : p.px > .28;
  var h = inside ? 'in' : away ? 'away' : '';
  if (!v && !h) return 'middle-middle';
  return v && h ? v + ' and ' + h : (v || h);
}
function _patPitchWord(p) {
  var t = String((p && p.type) || '').toLowerCase();
  return { 'four-seam fastball': 'four-seamer', 'sinker': 'sinker', 'cutter': 'cutter', 'two-seam fastball': 'two-seamer' }[t] || t;
}

// ── Still spray chart for the right side of the takeover (the square's
// own 500×386 drawing, so the landing spot matches the play animation)
function _patSpraySvg(lp, t2) {
  var land = typeof _paLanding === 'function' ? _paLanding(lp) : null;
  if (!land) return '';
  var x = land.x.toFixed(1), y = land.y.toFixed(1);
  return '<svg class="pat-fld" viewBox="30 0 440 386" aria-hidden="true">' +
    '<path d="M 250 366 L 58 174 Q 250 20 442 174 Z" fill="rgba(0,0,0,.16)" stroke="rgba(255,255,255,.55)" stroke-width="5" stroke-linejoin="round"/>' +
    '<path d="M 186 302 Q 250 230 314 302" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="3"/>' +
    '<path d="M 250 366 L 330 286 L 250 206 L 170 286 Z" fill="rgba(255,255,255,.08)" stroke="rgba(255,255,255,.6)" stroke-width="4"/>' +
    '<line x1="250" y1="366" x2="' + x + '" y2="' + y + '" stroke="#fff" stroke-width="5" stroke-dasharray="11 11" opacity=".75"/>' +
    '<circle cx="' + x + '" cy="' + y + '" r="30" fill="none" stroke="' + t2 + '" stroke-width="6" opacity=".7"/>' +
    '<circle cx="' + x + '" cy="' + y + '" r="15" fill="#fff"/><circle cx="250" cy="366" r="8" fill="#fff"/></svg>';
}

// ── The takeover. Called from _paOverlayHtml for every finished plate
// appearance; replaces the home-run-only takeover (_bbHrTakeoverHtml is
// kept as the fallback if this file doesn't load).
function _bbPaTakeoverHtml(lp, box, s, Es, showField, tT) {
  var tier = _patTier(lp);
  if (!tier || !box) return '';
  var team = _patTeam(lp, box, tier.team === 'pit' ? 'pit' : 'bat');
  var neutral = tier.team === 'neutral';
  var bg = neutral ? '#3D3580' : team.c.bg;
  var t2 = neutral ? '#A89FE8' : ((team.c.accent && Math.abs(_gxLum(team.c.accent) - _gxLum(team.c.bg)) > .25) ? team.c.accent : '#FFFFFF');
  var nm = String(_teamShortName(team.name || '') || team.abbr || '').toUpperCase();
  var title = typeof _paTitle === 'function' ? _paTitle(lp) : String(lp.event || '').toUpperCase();
  var bat = _patLast(lp.batter), who = bat;
  var t = lp.eventType || '';
  if (tier.kind === 'hr') { var rbi = lp.rbi || 1; who += ' · ' + (rbi >= 4 ? 'Grand slam' : rbi === 1 ? 'Solo shot' : rbi + '-run shot'); }
  else if (tier.kind === 'hit') { var ld = typeof _paLanding === 'function' ? _paLanding(lp) : null; who += (lp.rbi ? ' · ' + lp.rbi + ' RBI' : '') + (ld && typeof _paDir === 'function' ? ' · to ' + _paDir(ld.ang) : ''); }
  else if (tier.kind === 'k') { var lpk = _patLastPitch(lp), looking = lpk && /called/i.test(lpk.call || ''); who = (lp.pitcher ? _patLast(lp.pitcher) + ' gets ' : '') + bat + (looking ? ' looking' : ' swinging'); }
  else if (tier.kind === 'walk') { var n = (lp.pitches || []).length; who += n ? ' · ' + n + '-pitch walk' : ''; }
  else if (tier.kind === 'out') { var f = (lp.fielders || []).join('-'); who += f ? ' · ' + f : ''; }
  var spray = (showField && lp.hit) ? _patSpraySvg(lp, t2) : '';
  var at = showField ? ((s._t1 != null ? s._t1 : PA.T0 + 1.8) + .2) : ((tT != null ? tT : 1.4) + .3);
  s._patAt = at; // the panel's rows come in after the takeover
  var cls = 'fbx-to pa-to pat' + (tier.full ? '' : ' pat-lite') + (spray ? ' pat-f' : '');
  return '<div class="' + cls + '" style="--t0:' + _paSec(at, Es) + ';--t1:' + bg + ';--t2:' + t2 + ';--tdark:' + _fbxDark(bg, .5) + ';animation-duration:' + tier.dur + 's">' +
    '<div class="bg"></div>' + (tier.full ? '<div class="st b"></div><div class="st"></div>' : '') + '<div class="sk"></div>' +
    '<div class="ct">' + (tier.full && !spray ? '<span class="lg">' + _escapeHtml(team.abbr || '') + '</span>' : '') +
    '<div class="wd"><span class="sm">' + _escapeHtml(title) + '</span>' +
    (tier.full ? '<span class="bg2' + (nm.length > 10 ? ' long' : '') + '">' + _escapeHtml(nm) + '</span>' : '') +
    '<span class="who">' + _escapeHtml(who) + '</span>' + (s.quick && tier.kind === 'hr' ? _patStx(lp) : '') + '<span class="ln"></span></div></div>' + spray + '</div>';
}

function _patStx(lp) {
  var h = lp.hit || {}, st = [h.speed != null ? h.speed + '<small>MPH</small>' : null, h.angle != null ? h.angle + '<small>\u00b0</small>' : null, h.distance != null ? h.distance + '<small>FT</small>' : null].filter(Boolean);
  return st.length ? '<span class="stx">' + st.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</span>' : '';
}

// ── The panel's rows for one play
function _patRows(lp, box) {
  var g = window._activeBrowseGame, pk = (box && box.gamePk != null) ? box.gamePk : (g ? g.gamePk : null);
  var sp = (typeof _savPlay === 'function' && pk != null) ? (_savPlay(pk, lp.atBatIndex) || {}) : {};
  var t = lp.eventType || '', h = lp.hit || {}, tier = _patTier(lp);
  var ev = h.speed != null ? h.speed : sp.ev, la = h.angle != null ? h.angle : sp.la, dist = h.distance != null ? h.distance : sp.dist;
  var tr = h.trajectory || '';
  var bs = (sp.swings && sp.swings.length) ? sp.swings[sp.swings.length - 1].batSpeed : null;
  var p = _patLastPitch(lp), code = p && p.code, mph = p ? (p.mph != null ? p.mph : p.speed) : null;
  var rows = [], badge = '';
  var R = function (l, v, u, pct, sav, txt) { rows.push({ l: l, v: v, u: u || '', p: pct, sav: !!sav, txt: txt || '' }); };
  var xbaTxt = sp.xba != null ? sp.xba.toFixed(3).replace(/^0/, '') : null;
  var isHit = /^(single|double|triple|home_run)$/.test(t);
  // hardest-hit ball of the game so far, from the plays we already have
  var hardest = function () {
    if (ev == null) return false;
    var max = -1, n = 0;
    ((box && box.allPlays) || []).forEach(function (pl) { var s2 = pl.anim && pl.anim.hit && pl.anim.hit.speed; if (s2 != null) { n++; if (s2 > max) max = s2; } });
    return n >= 3 && ev >= max;
  };
  if (!tier) return { rows: rows, badge: '' };
  if (tier.kind === 'hr') {
    R('Gone in', sp.parks, ' /30 parks', null, 1);
    R('Exit velo', ev != null ? ev.toFixed(1) : null, ' mph', _patPct(ev, _PAT_LG.ev));
    R('Bat speed', bs != null ? bs.toFixed(1) : null, ' mph', _patPct(bs, _PAT_LG.bat), 1);
    R('Launch', la != null ? la + '°' : null);
    if (mph != null) R('Pitch he hit', null, '', null, 0, mph.toFixed(1) + ' ' + _patPitchWord(p) + (_patLoc(lp, p) ? ', ' + _patLoc(lp, p) : ''));
    if (hardest()) badge = 'Hardest-hit ball of the game';
  } else if (tier.kind === 'hit' || tier.kind === 'out') {
    R('xBA', xbaTxt, '', null, 1);
    R('Exit velo', ev != null ? ev.toFixed(1) : null, ' mph', _patPct(ev, _PAT_LG.ev));
    if (tr === 'ground_ball' || dist == null) R('Launch', la != null ? la + '°' : null);
    else R('Distance', dist, ' ft');
    if (tier.kind === 'out' && sp.catchProb != null && /fly_ball|line_drive|popup/.test(tr)) R('Catch prob', Math.round(sp.catchProb * 100), '%');
    R('Bat speed', bs != null ? bs.toFixed(1) : null, ' mph', _patPct(bs, _PAT_LG.bat), 1);
    if (!isHit && sp.xba != null && sp.xba >= .6) badge = 'Hard-luck out: hit like a ' + (sp.xba >= .8 ? 'sure hit' : 'single');
    else if (isHit && sp.xba != null && sp.xba < .25) badge = 'Found a hole: lands ' + Math.round(sp.xba * 100) + '% of the time';
    else if (t !== 'home_run' && sp.parks != null && sp.parks >= 1) badge = 'Would’ve been a HR in ' + sp.parks + '/30 parks';
    else if (hardest()) badge = 'Hardest-hit ball of the game';
  } else if (tier.kind === 'k') {
    var nm = { FF: '4-seam', FA: '4-seam', SI: 'Sinker', FT: '2-seam', FC: 'Cutter', SL: 'Slider', ST: 'Sweeper', SV: 'Slurve', CU: 'Curve', KC: 'Knuckle curve', CS: 'Curve', CH: 'Changeup', FS: 'Splitter', FO: 'Forkball' }[code] || 'Pitch';
    R(nm + ' velo', mph != null ? mph.toFixed(1) : null, ' mph', _patPct(mph, _PAT_LG.velo[code]));
    var ars = (typeof _savArsenal === 'function' && lp.pitcherId) ? _savArsenal(lp.pitcherId) : null;
    var avg = ars && ars.avgSpeed && code ? ars.avgSpeed[code] : null;
    if (avg != null && mph != null) { var d = mph - avg; R('vs his avg', (d >= 0 ? '+' : '') + d.toFixed(1), ' mph'); }
    if (p && p.spin != null) R('Spin', p.spin.toLocaleString(), ' rpm', _patPct(p.spin, _PAT_LG.spin[code]));
    if (p && p.ivb != null && _PAT_LG.ivb[code]) R('Ride (IVB)', p.ivb.toFixed(1), ' in', _patPct(p.ivb, _PAT_LG.ivb[code]));
    // fastest pitch of his outing
    if (mph != null && lp.pitcherId) {
      var top = 0, nP = 0;
      ((box && box.allPlays) || []).forEach(function (pl) { var a = pl.anim; if (!a || String(a.pitcherId) !== String(lp.pitcherId)) return; (a.pitches || []).forEach(function (x) { var v = x.mph != null ? x.mph : x.speed; if (v != null) { nP++; if (v > top) top = v; } }); });
      if (nP >= 10 && mph >= top) badge = 'Fastest pitch of his outing';
    }
  } else if (tier.kind === 'walk' || tier.kind === 'hbp') {
    var ps2 = lp.pitches || [];
    if (tier.kind === 'walk') {
      var top2 = lp.zoneTop || 3.5, bot2 = lp.zoneBottom || 1.5, out = 0, ch = 0;
      ps2.forEach(function (x) {
        if (x.px == null || x.pz == null) return;
        if (Math.abs(x.px) > .95 || x.pz > top2 + .12 || x.pz < bot2 - .12) { out++; if (/swing|foul|in play/i.test(x.call || '')) ch++; }
      });
      R('Pitches seen', ps2.length);
      R('Chased', ch, ' of ' + out);
      var pd = (typeof _savGet === 'function' && lp.batterId) ? _savGet('player', String(lp.batterId), '/api/mlb?mode=savant&smode=player&id=' + encodeURIComponent(lp.batterId), 6 * 3600e3, _savRerender) : null;
      var pl2 = (pd && pd.batter && pd.batter.percentiles) || [];
      var find = function (k) { for (var i = 0; i < pl2.length; i++) if (pl2[i].key === k) return Math.round(pl2[i].pct); return null; };
      var bb = find('bb_percent'), cr = find('chase_percent');
      R('Walk rate', bb != null ? bb + 'th' : null, ' pctl', bb, 1);
      R('Chase rate', cr != null ? cr + 'th' : null, ' pctl', cr, 1);
      if (ps2.length >= 7) badge = ps2.length + '-pitch battle';
    } else {
      R('Pitch', mph != null ? mph.toFixed(1) : null, ' mph', _patPct(mph, _PAT_LG.velo[code]));
      if (p && p.type) R('Type', null, '', null, 0, p.type);
    }
  }
  return { rows: rows.slice(0, 5), badge: badge };
}

// ── The panel (v7.11.1 layout): the plate appearance's pitches as a strip
// of dots, then the stat rows. opt.hold shows everything at once (replays,
// sheets). opt.still turns every entrance motion off: the live panel is
// rebuilt on each refresh, and a fade-in each time read as a flicker.
// Otherwise rows come in after the takeover, timed from the play's start
// with negative delays so a refresh mid-animation resumes in place.

// a pitch's call as one short word that fits under its dot
function _patCallWord(call) {
  var c = String(call || '').toLowerCase();
  if (/in play/.test(c)) return 'In play';
  if (/hit by/.test(c)) return 'HBP';
  if (/swinging|foul tip|missed bunt/.test(c)) return 'Swing';
  if (/foul/.test(c)) return 'Foul';
  if (/called/.test(c)) return 'Called';
  if (/strike/.test(c)) return 'Strike';
  if (/ball|pitchout/.test(c)) return 'Ball';
  return c ? c.charAt(0).toUpperCase() + c.slice(1, 6) : '';
}
// the at-bat as a strip: one dot per pitch in the app's ball / strike /
// in-play colors, the deciding pitch ringed in gold. Long at-bats show
// the last seven with a "+N" in front.
function _patSeqHtml(lp, delay, still) {
  var ps = ((lp && lp.pitches) || []).filter(function (p) { return p; });
  if (!ps.length) return '';
  var vis = ps.slice(-7), more = ps.length - vis.length;
  var words = vis.map(function (p) { return _patCallWord(p.call); });
  var motion = still ? '' : ' style="animation-delay:' + delay.toFixed(2) + 's"';
  return '<div class="pap-sq" role="img" aria-label="Pitches: ' + _escapeHtml(words.join(', ')) + '"' + motion + '>' +
    (more ? '<span class="pap-mr">+' + more + '</span>' : '') +
    vis.map(function (p, i) {
      var fin = i === vis.length - 1;
      return '<div class="pap-pt' + (fin ? ' fin' : '') + '"><span class="pap-pd" style="background:' + _pitchCallColor(p.call) + '">' + _escapeHtml(String(p.num != null ? p.num : more + i + 1)) + '</span><span class="pap-pl">' + _escapeHtml(words[i]) + '</span></div>';
    }).join('') + '</div>';
}
function _bbPaPanelHtml(lp, box, opt) {
  opt = opt || {};
  var lab = '<span class="pap-hl">' + _escapeHtml(opt.label || 'LAST PLAY') + '</span>';
  var legend = '<span class="pap-lg">PCTL VS MLB<i></i></span>';
  if (!lp || !_patTier(lp)) return '<div class="pap pap-e"><div class="pap-hd">' + lab + legend + '</div><div class="pap-empty">' + _escapeHtml(opt.empty || 'Statcast for each plate appearance shows here') + '</div></div>';
  var R = _patRows(lp, box), since = opt.since || 0;
  var stale = since && Date.now() - since > 180000;
  var still = !!opt.still;
  var E = opt.hold ? 99 : opt.E || 99, at = opt.at != null ? opt.at : 0;
  var seqN = ((lp.pitches || []).length ? 1 : 0);
  var rows = R.rows.map(function (r, i) {
    var delay = opt.hold ? 0 : (at + .4 + (i + seqN) * .11 - E);
    var pend = r.sav && (r.v == null || r.v === '');
    var val = r.txt ? '' : '<span class="pap-v">' + (pend ? (stale ? '—' : '<span class="pap-dots" role="img" aria-label="Waiting on Statcast"><i></i><i></i><i></i></span>') : (r.v == null || r.v === '' ? '—' : _escapeHtml(String(r.v)) + '<small>' + _escapeHtml(r.u) + '</small>')) + '</span>';
    var mid = r.txt ? '<span class="pap-tx">' + _escapeHtml(r.txt) + '</span>' :
      (r.p != null && !pend ? '<span class="pap-bar"><i style="width:' + r.p + '%;background:' + _savPctColor(r.p) + '"></i><b style="left:calc((100% - 22px) * ' + (r.p / 100).toFixed(2) + ');background:' + _savPctColor(r.p) + '">' + r.p + '</b></span>' : '<span></span>');
    return '<div class="pap-r"' + (still ? '' : ' style="animation-delay:' + delay.toFixed(2) + 's"') + '><span class="pap-l">' + _escapeHtml(r.l) + (r.sav ? '<em>Savant</em>' : '') + '</span>' + mid + val + '</div>';
  }).join('');
  // the highlight badge takes the legend's place in the header, so it never
  // changes the panel's height when Savant's numbers arrive
  var bd = R.badge ? '<span class="pap-bd"' + (still ? '' : ' style="animation-delay:' + (opt.hold ? 0 : (at + .5 + (R.rows.length + seqN) * .11 - E)).toFixed(2) + 's"') + '><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8L20 10l-5 3.6L16.8 20 12 16.6 7.2 20 9 13.6 4 10l6.1-1.2z"/></svg><span>' + _escapeHtml(R.badge) + '</span></span>' : '';
  return '<div class="pap' + (still ? ' pap-still' : '') + '"><div class="pap-hd">' + lab + (bd || legend) + '</div>' + _patSeqHtml(lp, opt.hold ? 0 : (at + .3 - E), still) + rows + '</div>';
}

// ── Live: the panel under the square shows the last plate appearance, and
// only until the next at-bat gets going. During its animation the rows wait
// for the takeover.
function _patNextAbStarted(box, lp) {
  var sq = box && box.pitchSequence;
  return !!(sq && sq.pitches && sq.pitches.length && String(sq.atBatIndex) !== String(lp.atBatIndex));
}
function _patLivePanelHtml(box) {
  var s = window._pa, lp = box && box.lastPlay;
  if (!lp || (typeof _paIsAction === 'function' && _paIsAction(lp)) || !_patTier(lp)) return '';
  // a pitch has been thrown in the next at-bat: this panel's moment is over
  if (_patNextAbStarted(box, lp)) return '';
  var animating = !!(s && s.play && s.startAt && String(s.play.atBatIndex) === String(lp.atBatIndex) && _paActive());
  window._patSince = window._patSince || {};
  if (!window._patSince[lp.atBatIndex]) window._patSince[lp.atBatIndex] = animating ? s.startAt : Date.now();
  return _bbPaPanelHtml(lp, box, { label: 'LAST PLAY · ' + _patLabel(lp), hold: !animating, still: !animating, E: animating ? (Date.now() - s.startAt) / 1000 : 99,
    at: (s && s._patAt != null ? s._patAt : PA.T0 + 2), since: window._patSince[lp.atBatIndex] });
}
// the latest play may still be waiting on Savant; anything older isn't coming
function _patSinceFor(a, box) {
  var last = box && box.lastPlay;
  if (last && String(last.atBatIndex) === String(a.atBatIndex)) return (window._patSince && window._patSince[a.atBatIndex]) || Date.now();
  return 1;
}
function _patTag(lp) { return (lp.half === 'top' ? 'T' : 'B') + (lp.inning || ''); }
// "B2 · 6-PITCH K" for strikeouts and walks, plain "B2" otherwise
function _patLabel(lp) {
  var n = (lp.pitches || []).length, t = lp.eventType || '';
  if (n && /^strikeout/.test(t)) return _patTag(lp) + ' · ' + n + '-PITCH K';
  if (n && t === 'walk') return _patTag(lp) + ' · ' + n + '-PITCH BB';
  return _patTag(lp);
}
// Fold a panel shut instead of letting it vanish, so the pitch list below
// slides up rather than snapping (same idea as _paSoftClear, plus the margin).
function _patFold(el, html) {
  el.innerHTML = html;
  var pap = el.firstChild;
  if (pap && pap.classList) pap.classList.add('pap-still');
  if (typeof _ghReducedMotion === 'function' && _ghReducedMotion()) { el.innerHTML = ''; return; }
  el.style.overflow = 'hidden'; el.style.marginTop = '12px'; el.style.height = el.offsetHeight + 'px';
  void el.offsetHeight;
  el.style.transition = 'height .36s cubic-bezier(.22,1,.36,1), margin-top .36s cubic-bezier(.22,1,.36,1), opacity .22s ease';
  el.style.height = '0px'; el.style.marginTop = '0px'; el.style.opacity = '0';
  setTimeout(function () { if (el.firstChild && el.getAttribute('data-fold')) { el.innerHTML = ''; el.removeAttribute('style'); el.removeAttribute('data-fold'); } }, 400);
  el.setAttribute('data-fold', '1');
}
function _patFillLive() {
  var el = document.getElementById('gh-pa-panel');
  if (!el) return;
  var box = (typeof _gcBox === 'function' && _gcBox()) || window._pa.box;
  var html = _patLivePanelHtml(box);
  var pk = window._activeBrowseGame ? window._activeBrowseGame.gamePk : null;
  if (html) {
    window._patShown = { pk: pk, html: html, t: Date.now() };
    if (el.innerHTML !== html) el.innerHTML = html;
    return;
  }
  // nothing to show now: if the panel was up a moment ago (same game), fold it away
  var was = window._patShown; window._patShown = null;
  if (was && was.pk === pk && Date.now() - was.t < 20000 && !el.firstChild) _patFold(el, was.html);
}

// The old Statcast strip under the square (counts up while the ball flies)
// is replaced by the panel, which holds the same numbers and more.
if (typeof _bbStatsHtml === 'function') { window._bbStatsHtmlV6 = _bbStatsHtml; _bbStatsHtml = function () { return document.getElementById('gh-pa-panel') ? '' : window._bbStatsHtmlV6.apply(this, arguments); }; }

// Fill the panel every time the square fills (new play, refresh, end of animation)
(function () {
  if (typeof _paFill !== 'function') return;
  var prev = _paFill;
  _paFill = function () { prev.apply(this, arguments); _patFillLive(); };
  if (typeof _paiMount === 'function') {
    var prevMount = _paiMount;
    // a play replayed from the play-by-play: its panel sits under the replay
    _paiMount = function (rowEl, scroll) {
      prevMount.apply(this, arguments);
      var r = window._pai, wrap = document.getElementById('pa-inline');
      if (!r || !wrap) return;
      var bx = wrap.querySelector('.pai-box');
      if (bx) bx.insertAdjacentHTML('afterend', '<div class="pap-i">' + _bbPaPanelHtml(r.play, r.box, { hold: true, since: _patSinceFor(r.play, r.box), label: _patTag(r.play) + ' · ' + (typeof _paTitle === 'function' ? _paTitle(r.play) : '') }) + '</div>');
    };
  }
})();

// ── Player sheet (tap a player in the box score): "Today" lists his plate
// appearances in this game — or a pitcher's strikeouts — and tapping one
// shows its card and panel right there.
function _patTodayPlays(id) {
  var box = typeof _gcBox === 'function' ? _gcBox() : null;
  if (!box || !id) return [];
  return (box.allPlays || []).map(function (pl) { return pl.anim; }).filter(function (a) {
    if (!a || !_patTier(a)) return false;
    if (String(a.batterId) === String(id)) return true;
    return String(a.pitcherId) === String(id) && /^(strikeout|home_run)/.test(a.eventType || '');
  });
}
function _patShort(a) {
  var t = a.eventType || '';
  return { single: '1B', double: '2B', triple: '3B', home_run: 'HR', walk: 'BB', intent_walk: 'IBB', hit_by_pitch: 'HBP', strikeout: 'K', strikeout_double_play: 'K' }[t] ||
    ((a.fielders || []).length ? a.fielders.join('-') : (typeof _paTitle === 'function' ? _paTitle(a) : t));
}
function _patTodayHtml(id) {
  var plays = _patTodayPlays(id);
  if (!plays.length) return '';
  var pitcherOnly = plays.every(function (a) { return String(a.batterId) !== String(id); });
  return '<div class="sav-sec pat-today"><div class="np-row"><span class="gh-eyebrow">Today</span><span class="np-mut">' + (pitcherOnly ? 'Strikeouts and homers' : 'Every plate appearance') + '</span></div>' +
    '<div class="pat-chips">' + plays.map(function (a) {
      return '<button type="button" class="pat-chip" data-abi="' + a.atBatIndex + '" onclick="_patSheetShow(' + JSON.stringify(String(id)).replace(/"/g, '&quot;') + ',' + a.atBatIndex + ',this)">' + _escapeHtml(_patTag(a) + ' · ' + _patShort(a)) + '</button>';
    }).join('') + '</div><div id="pat-today-card"></div></div>';
}
function _patSheetShow(id, abi, btn) {
  var a = null;
  _patTodayPlays(id).forEach(function (x) { if (x.atBatIndex === abi) a = x; });
  var card = document.getElementById('pat-today-card'), box = typeof _gcBox === 'function' ? _gcBox() : null;
  if (!card || !a || !box) return;
  var open = btn && btn.classList.contains('on');
  document.querySelectorAll('.pat-chip').forEach(function (b) { b.classList.remove('on'); });
  if (open) { card.innerHTML = ''; return; }
  if (btn) btn.classList.add('on');
  // the takeover, played once and held on its last frame, then the panel
  var to = _bbPaTakeoverHtml(a, box, { _t1: null }, 0, !!a.hit, 0).replace(/--t0:-?[\d.]+s/, '--t0:0s');
  card.innerHTML = '<div class="pat-hold">' + to + '</div>' + _bbPaPanelHtml(a, box, { hold: true, since: _patSinceFor(a, box), label: _patTag(a) + ' · ' + (typeof _paTitle === 'function' ? _paTitle(a) : '') });
}
(function () {
  if (typeof _savPlayerSheetFill !== 'function') return;
  var prev = _savPlayerSheetFill;
  _savPlayerSheetFill = function (id) {
    prev.apply(this, arguments);
    var box = document.getElementById('player-sav');
    if (!box || box.querySelector('.pat-today')) return;
    var t = _patTodayHtml(id);
    if (t) box.insertAdjacentHTML('afterbegin', t);
  };
})();
