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
  // v7.11.2: wait for the whole play (throws, double plays, runners) to finish,
  // plus a beat to read the result title, before the takeover comes in
  var at = showField ? Math.max((s._t1 != null ? s._t1 : PA.T0 + 1.8) + .2, s._fieldEnd != null ? s._fieldEnd + .7 : 0) : ((tT != null ? tT : 1.4) + .3);
  s._patAt = at; // the panel's rows come in after the takeover
  // v7.19.0: on the live square the takeover holds as the result card
  if (s === window._pa && _patHoldOn(lp, box, s)) return _patHoldCardHtml(lp, box, _paSec(at, Es));
  var cls = 'fbx-to pa-to pat' + (tier.full ? '' : ' pat-lite') + (spray ? ' pat-f' : '');
  return '<div class="' + cls + '" style="--t0:' + _paSec(at, Es) + ';--t1:' + bg + ';--t2:' + t2 + ';--tdark:' + _fbxDark(bg, .5) + ';animation-duration:' + tier.dur + 's">' +
    '<div class="bg"></div>' + (tier.full ? '<div class="st b"></div><div class="st"></div>' : '') + '<div class="sk"></div>' +
    '<div class="ct">' + (tier.full && !spray ? '<span class="lg">' + _escapeHtml(team.abbr || '') + '</span>' : '') +
    '<div class="wd">' + (tier.full ? '<span class="sm">' + _escapeHtml(nm) + '</span><span class="bg2' + (title.length > 13 ? ' xl' : title.length > 10 ? ' long' : '') + '">' + _escapeHtml(title) + '</span>' : '<span class="sm">' + _escapeHtml(title) + '</span>') + // v7.20.0: team small on top, the play big
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
    var nm = _patTypeName(code);
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

// ── The panel (v7.11.1 layout, v7.11.2 builds pitch by pitch): the at-bat's
// pitches as a strip of dots, then the stat rows. While an at-bat is going
// the strip grows with each pitch and the rows describe the newest pitch;
// once it ends they describe the result. Tap any dot in the live panel to
// see that pitch (tap it again to go back).
// opt.hold shows everything at once (replays, sheets). opt.still turns every
// entrance motion off: the live panel is rebuilt on each refresh, and a
// fade-in each time read as a flicker. Otherwise rows come in after the
// takeover, timed from the play's start with negative delays so a refresh
// mid-animation resumes in place.

var _PAT_NM = { FF: '4-seam', FA: '4-seam', SI: 'Sinker', FT: '2-seam', FC: 'Cutter', SL: 'Slider', ST: 'Sweeper', SV: 'Slurve', CU: 'Curve', KC: 'Knuckle curve', CS: 'Curve', CH: 'Changeup', FS: 'Splitter', FO: 'Forkball', KN: 'Knuckler', EP: 'Eephus', SC: 'Screwball' };
function _patTypeName(code, type) { return _PAT_NM[code] || (type ? String(type) : 'Pitch'); }

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
// The strip: one dot per pitch in the app's ball / strike / in-play colors.
// The deciding pitch of a finished at-bat is ringed in gold, the pitch the
// rows describe in white. pick: { abi } makes each dot a button (live only);
// long at-bats scroll sideways instead of hiding early pitches.
function _patSeqHtml(lp, delay, still, opt) {
  opt = opt || {};
  var ps = ((lp && lp.pitches) || []).filter(function (p) { return p; });
  if (!ps.length) return '';
  var motion = still ? '' : ' style="animation-delay:' + delay.toFixed(2) + 's"';
  return '<div class="pap-sq' + (ps.length > 7 ? ' pap-sq-x' : '') + '"' + motion + '><div class="pap-sw">' +
    ps.map(function (p, i) {
      var num = p.num != null ? p.num : i + 1, w = _patCallWord(p.call);
      var cls = 'pap-pt' + (opt.fin && i === ps.length - 1 ? ' fin' : '') + (opt.sel != null && String(opt.sel) === String(num) ? ' sel' : '') + (opt.fresh && i === ps.length - 1 ? ' pap-new' : '');
      var inner = '<span class="pap-pd" style="background:' + _pitchCallColor(p.call) + '">' + _escapeHtml(String(num)) + '</span><span class="pap-pl">' + _escapeHtml(w) + '</span>';
      if (opt.pick == null) return '<span class="' + cls + '">' + inner + '</span>';
      var mph = p.mph != null ? p.mph : p.speed;
      var aria = 'Pitch ' + num + ', ' + w + (mph != null ? ', ' + mph + ' mph' : '') + (p.type ? ' ' + p.type : '');
      return '<button type="button" class="' + cls + '" data-num="' + _escapeHtml(String(num)) + '" aria-pressed="' + (cls.indexOf(' sel') !== -1) + '" aria-label="' + _escapeHtml(aria) + '" onclick="_patPick(' + JSON.stringify(String(opt.pick)).replace(/"/g, '&quot;') + ',' + JSON.stringify(String(num)).replace(/"/g, '&quot;') + ')">' + inner + '</button>';
    }).join('') + '</div></div>';
}
// rows for one pitch: velo against every pitch of its type this season,
// against his own average, spin, and where it went / what was called.
// Always the same four rows so the panel holds still as pitches come in.
function _patPitchRows(p, ctx) {
  var code = p.code, mph = p.mph != null ? p.mph : p.speed, rows = [];
  var R = function (l, v, u, pct, txt) { rows.push({ l: l, v: v, u: u || '', p: pct, sav: false, txt: txt || '' }); };
  R(_patTypeName(code, p.type) + ' velo', mph != null ? Number(mph).toFixed(1) : null, ' mph', _patPct(mph, _PAT_LG.velo[code]));
  var ars = (typeof _savArsenal === 'function' && ctx.pitcherId) ? _savArsenal(ctx.pitcherId) : null;
  var avg = ars && ars.avgSpeed && code ? ars.avgSpeed[code] : null;
  R('vs his avg', (avg != null && mph != null) ? ((mph - avg >= 0 ? '+' : '') + (mph - avg).toFixed(1)) : null, ' mph');
  R('Spin', p.spin != null ? Number(p.spin).toLocaleString() : null, ' rpm', _patPct(p.spin, _PAT_LG.spin[code]));
  var loc = _patLoc(ctx, p);
  R('Where', null, '', null, (loc ? loc.charAt(0).toUpperCase() + loc.slice(1) + ' · ' : '') + (p.call || '—'));
  return rows;
}
function _patHash(str) { var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + str.length.toString(36); }
function _bbPaPanelHtml(lp, box, opt) {
  opt = opt || {};
  var lab = '<span class="pap-hl">' + _escapeHtml(opt.label || 'LAST PLAY') + '</span>';
  var legend = '<span class="pap-lg">PCTL VS MLB<i></i></span>';
  if (!lp || (!opt.rows && !_patTier(lp))) return '<div class="pap pap-e"><div class="pap-hd">' + lab + legend + '</div><div class="pap-empty">' + _escapeHtml(opt.empty || 'Statcast for each plate appearance shows here') + '</div></div>';
  var R = opt.rows ? { rows: opt.rows, badge: '' } : _patRows(lp, box), since = opt.since || 0;
  var stale = since && Date.now() - since > 180000;
  var still = !!opt.still;
  var E = opt.hold ? 99 : opt.E || 99, at = opt.at != null ? opt.at : 0;
  var seqN = ((lp.pitches || []).length ? 1 : 0);
  // v7.12.0: the rows are tiles, two to a line (the lone last one spans both)
  var rows = '<div class="pap-g' + (R.rows.length % 2 ? ' odd' : '') + '">' + R.rows.map(function (r, i) {
    var delay = opt.hold ? 0 : (at + .4 + (i + seqN) * .11 - E);
    var pend = r.sav && (r.v == null || r.v === '');
    var val = r.txt ? '<span class="pap-tx">' + _escapeHtml(r.txt) + '</span>' :
      '<span class="pap-v">' + (pend ? (stale ? '—' : '<span class="pap-dots" role="img" aria-label="Waiting on Statcast"><i></i><i></i><i></i></span>') : (r.v == null || r.v === '' ? '—' : _escapeHtml(String(r.v)) + '<small>' + _escapeHtml(String(r.u || '').trim()) + '</small>')) + '</span>';
    var bar = (!r.txt && r.p != null && !pend) ? '<span class="pap-bar"><i style="width:' + r.p + '%;background:' + _savPctColor(r.p) + '"></i><b style="left:calc((100% - 24px) * ' + (r.p / 100).toFixed(2) + ');background:' + _savPctColor(r.p) + '">' + r.p + '</b></span>' : '';
    return '<div class="pap-r"' + (still ? '' : ' style="animation-delay:' + delay.toFixed(2) + 's"') + '><span class="pap-l">' + _escapeHtml(r.l) + (r.sav ? '<em>Savant</em>' : '') + '</span>' + val + bar + '</div>';
  }).join('') + '</div>';
  // the highlight badge takes the legend's place in the header, so it never
  // changes the panel's height when Savant's numbers arrive
  var bd = R.badge ? '<span class="pap-bd"' + (still ? '' : ' style="animation-delay:' + (opt.hold ? 0 : (at + .5 + (R.rows.length + seqN) * .11 - E)).toFixed(2) + 's"') + '><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8L20 10l-5 3.6L16.8 20 12 16.6 7.2 20 9 13.6 4 10l6.1-1.2z"/></svg><span>' + _escapeHtml(R.badge) + '</span></span>' : '';
  var inner = '<div class="pap-hd">' + lab + (bd || legend) + '</div>' + _patSeqHtml(lp, opt.hold ? 0 : (at + .3 - E), still, opt.seq) + rows;
  var cls = 'pap' + (still ? ' pap-still' : '');
  return '<div class="' + cls + '" data-sig="' + _patHash(cls + inner.replace(/ pap-new/g, '')) + '">' + inner + '</div>';
}

// ── Live: the panel under the square follows the at-bat. Before the first
// pitch it shows how the last plate appearance ended; from the first pitch
// of the next one it builds that at-bat instead. The selected pitch
// (window._patSel) lasts until a new pitch arrives or the at-bat changes.
function _patSelFor(abi, n) {
  var sel = window._patSel;
  if (sel && (String(sel.abi) !== String(abi) || sel.n !== n)) sel = window._patSel = null;
  return sel;
}
function _patFindPitch(ps, num) {
  for (var i = 0; i < ps.length; i++) if (String(ps[i].num != null ? ps[i].num : i + 1) === String(num)) return ps[i];
  return null;
}
function _patBuildHtml(sq, box) {
  var st = box.situation || {}, ps = sq.pitches, abi = sq.atBatIndex;
  var sel = _patSelFor(abi, ps.length);
  var p = (sel && _patFindPitch(ps, sel.num)) || ps[ps.length - 1];
  var num = p.num != null ? p.num : ps.length;
  // the newest dot pops in once, the first time this pitch is drawn
  window._patSeenN = window._patSeenN || {};
  var fresh = (window._patSeenN[abi] || 0) < ps.length;
  window._patSeenN[abi] = ps.length;
  var tag = (st.half === 'top' ? 'T' : st.half === 'bottom' ? 'B' : '') + (st.inning || '');
  return _bbPaPanelHtml({ pitches: ps }, box, {
    label: (tag ? tag + ' · ' : '') + 'PITCH ' + num + ' OF ' + ps.length, hold: true, still: true, // v7.12.0
    rows: _patPitchRows(p, { zoneTop: sq.zoneTop, zoneBottom: sq.zoneBottom, batSide: sq.batSide, pitcherId: sq.pitcherId }),
    seq: { pick: abi, sel: num, fresh: fresh }
  });
}
function _patLivePanelHtml(box) {
  var s = window._pa, lp = box && box.lastPlay, sq = box && box.pitchSequence;
  // the next at-bat has started: build it pitch by pitch
  if (sq && sq.pitches && sq.pitches.length && (!lp || String(sq.atBatIndex) !== String(lp.atBatIndex))) return _patBuildHtml(sq, box);
  if (!lp || (typeof _paIsAction === 'function' && _paIsAction(lp)) || !_patTier(lp)) return '';
  var animating = !!(s && s.play && s.startAt && String(s.play.atBatIndex) === String(lp.atBatIndex) && _paActive());
  window._patSince = window._patSince || {};
  if (!window._patSince[lp.atBatIndex]) window._patSince[lp.atBatIndex] = animating ? s.startAt : Date.now();
  var ps = lp.pitches || [];
  var sel = _patSelFor(lp.atBatIndex, ps.length), sp = sel ? _patFindPitch(ps, sel.num) : null;
  var opt = { label: 'LAST PLAY · ' + _patLabel(lp), hold: !animating, still: !animating, E: animating ? (Date.now() - s.startAt) / 1000 : 99,
    at: (s && s._patAt != null ? s._patAt : PA.T0 + 2), since: window._patSince[lp.atBatIndex],
    seq: { pick: lp.atBatIndex, sel: sp ? sel.num : null, fin: true } };
  if (sp) {
    // a tapped pitch: its own rows, held still
    opt.rows = _patPitchRows(sp, lp); opt.hold = true; opt.still = true;
    opt.label = 'LAST PLAY · ' + _patTag(lp) + ' · PITCH ' + sel.num;
  }
  return _bbPaPanelHtml(lp, box, opt);
}
// tap a dot: show that pitch; tap it again: back to the newest pitch / the result
function _patPick(abi, num) {
  var box = (typeof _gcBox === 'function' && _gcBox()) || (window._pa && window._pa.box);
  if (!box) return;
  var lp = box.lastPlay, sq = box.pitchSequence;
  var ps = (sq && String(sq.atBatIndex) === String(abi)) ? sq.pitches : (lp && String(lp.atBatIndex) === String(abi) ? lp.pitches : null);
  if (!ps) return;
  var cur = window._patSel;
  var building = sq && String(sq.atBatIndex) === String(abi) && (!lp || String(lp.atBatIndex) !== String(abi));
  var newest = ps.length ? String(ps[ps.length - 1].num != null ? ps[ps.length - 1].num : ps.length) : null;
  if ((cur && String(cur.abi) === String(abi) && String(cur.num) === String(num)) || (building && !cur && String(num) === newest)) window._patSel = null;
  else window._patSel = { abi: abi, num: num, n: ps.length };
  _patFillLive();
  var el = document.getElementById('gh-pa-panel');
  var btn = el && el.querySelector('.pap-pt[data-num="' + String(num).replace(/"/g, '') + '"]');
  if (btn && btn.focus) { try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); } }
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
// keep the described pitch in view when a long at-bat's strip scrolls
function _patScrollStrip(el) {
  var sq = el && el.querySelector('.pap-sq-x');
  if (!sq) return;
  var on = sq.querySelector('.pap-pt.sel') || sq.querySelector('.pap-pt:last-child');
  if (on) sq.scrollLeft = Math.max(0, on.offsetLeft + on.offsetWidth / 2 - sq.clientWidth / 2);
}
function _patFillLive() {
  var el = document.getElementById('gh-pa-panel');
  if (!el) return;
  var box = (typeof _gcBox === 'function' && _gcBox()) || window._pa.box;
  var html = _patLivePanelHtml(box);
  var pk = window._activeBrowseGame ? window._activeBrowseGame.gamePk : null;
  if (html) {
    window._patShown = { pk: pk, html: html, t: Date.now() };
    // the render that just ran already drew this panel: leave it (and the
    // newest dot's pop-in) alone unless something actually changed
    var m = html.match(/data-sig="([^"]+)"/), cur = el.firstElementChild && el.firstElementChild.getAttribute('data-sig');
    if (!m || cur !== m[1]) el.innerHTML = html;
    _patScrollStrip(el);
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

// ══ THE RESULT CARD HOLDS (v7.19.0) ═════════════════════════════════════
// On the live at-bat square the takeover no longer passes through: it
// sweeps in after the play and stays — result, team, batter, the score,
// a small copy of the field (or the at-bat's pitches for a strikeout or
// walk) and the numbers that were on the field (exit velo, launch,
// distance, xBA, parks, bat speed / the strikeout pitch) — until the next
// at-bat's first pitch. Savant numbers fill in as they arrive (20-60 s).
// Opening a live game between batters shows the last play's card too.
// The replay under a tapped play, the reel and the player sheet's "Today"
// card keep the old pass-through takeover.

function _patNextStarted(lp, box) {
  var ps = box && box.pitchSequence;
  if (!ps || ps.atBatIndex == null || lp.atBatIndex == null) return false;
  if (Number(ps.atBatIndex) <= Number(lp.atBatIndex)) return false;
  return !!((ps.pitches && ps.pitches.length) || (ps.actions && ps.actions.length));
}
function _patLiveNow(box) {
  var m = typeof _ghModelFromMlbBox === 'function' ? _ghModelFromMlbBox(box) : null;
  return !!(m && m.phase === 'live');
}
// Only the live square (not replays, the reel or a sheet), only a finished
// plate appearance, and only until the next one starts
function _patHoldOn(lp, box, s) {
  if (!lp || !box || !s || !s.labelOut || s.quick || s.keep || s.seq) return false;
  if (typeof _paIsAction === 'function' && _paIsAction(lp)) return false;
  if (lp.atBatIndex == null || !_patTier(lp)) return false;
  // v7.20.3: only this game's own last play
  if (!box.lastPlay || String(box.lastPlay.atBatIndex) !== String(lp.atBatIndex)) return false;
  if (!s.startAt && !_patLiveNow(box)) return false;
  // between halves the square is the inning-break card (score, due up)
  var sit = box.situation || {};
  if (sit.inningState === 'Middle' || sit.inningState === 'End') return false;
  return !_patNextStarted(lp, box);
}
function _patHoldInfo(lp, box) {
  var tier = _patTier(lp);
  if (!tier) return null;
  var team = _patTeam(lp, box, tier.team === 'pit' ? 'pit' : 'bat');
  var neutral = tier.team === 'neutral';
  var bg = neutral ? '#3D3580' : team.c.bg;
  var t2 = neutral ? '#CFC7FF' : ((team.c.accent && Math.abs(_gxLum(team.c.accent) - _gxLum(team.c.bg)) > .25) ? team.c.accent : '#FFFFFF');
  var title = typeof _paTitle === 'function' ? _paTitle(lp) : String(lp.event || '').toUpperCase();
  var bat = _patLast(lp.batter), who = bat, t = lp.eventType || '';
  if (tier.kind === 'hr') { var rbi = lp.rbi || 1; who += ' · ' + (rbi >= 4 ? 'Grand slam' : rbi === 1 ? 'Solo shot' : rbi + '-run shot'); }
  else if (tier.kind === 'hit') who += lp.rbi ? ' · ' + lp.rbi + ' RBI' : '';
  else if (tier.kind === 'k') { var lpk = _patLastPitch(lp), looking = lpk && /called/i.test(lpk.call || ''); who = (lp.pitcher ? _patLast(lp.pitcher) + ' gets ' : '') + bat + (looking ? ' looking' : ' swinging'); }
  else if (tier.kind === 'walk') { var n = (lp.pitches || []).length; who += n ? ' · ' + n + '-pitch walk' : ''; }
  else if (tier.kind === 'out') { var f = (lp.fielders || []).join('-'); who += f ? ' · ' + f : ''; }
  // v7.20.0: the team on top in small type, the play under it in big type
  // (outs go to the fielding team, like strikeouts go to the pitcher's;
  // a sac fly or bunt is the batting team's)
  var tm = (tier.kind === 'out' && !/^sac_/.test(t)) ? _patTeam(lp, box, 'pit') : team;
  var top = String(_teamShortName(tm.name || '') || tm.abbr || '').toUpperCase();
  var big = title;
  // under the batter: where it went and the score after it
  var sub = [];
  var land = typeof _paLanding === 'function' ? _paLanding(lp) : null;
  if (land && lp.hit && typeof _paDir === 'function') sub.push('To ' + _paDir(land.ang));
  else if ((tier.kind === 'k' || tier.kind === 'walk') && (lp.pitches || []).length && tier.kind !== 'walk') sub.push((lp.pitches || []).length + '-pitch at-bat');
  var aA = box.awayAbbr || _ghAbbrFallback(box.away || ''), hA = box.homeAbbr || _ghAbbrFallback(box.home || '');
  var sc = typeof _ghScoreChip === 'function' ? _ghScoreChip(lp, aA, hA) : '';
  if (sc) sub.push(sc);
  return { tier: tier, bg: bg, t2: t2, title: title, top: top, big: big, who: who, sub: sub.join(' · ') };
}
// The numbers: for a ball in play, what was on the field; otherwise the
// panel's rows for the pitch that ended it
function _patHoldTiles(lp, box, tier) {
  var g = window._activeBrowseGame, pk = (box && box.gamePk != null) ? box.gamePk : (g ? g.gamePk : null);
  var sp = (typeof _savPlay === 'function' && pk != null) ? (_savPlay(pk, lp.atBatIndex) || {}) : {};
  var out = [];
  var T = function (l, v, u, p, wait, tx) { out.push({ l: l, v: v, u: u || '', p: p, wait: !!wait, tx: !!tx }); };
  var h = lp.hit || {};
  if (lp.hit && (tier.kind === 'hr' || tier.kind === 'hit' || tier.kind === 'out')) {
    var ev = h.speed != null ? h.speed : sp.ev, la = h.angle != null ? h.angle : sp.la, dist = h.distance != null ? h.distance : sp.dist;
    var bs = (sp.swings && sp.swings.length) ? sp.swings[sp.swings.length - 1].batSpeed : null;
    if (ev != null) T('Exit velo', Number(ev).toFixed(1), 'mph', _patPct(ev, _PAT_LG.ev));
    if (la != null) T('Launch', la + '°');
    if (dist != null) T('Distance', dist, 'ft');
    T('xBA', sp.xba != null ? sp.xba.toFixed(3).replace(/^0/, '') : null, '', null, sp.xba == null);
    if (tier.kind === 'hr') T('Gone in', sp.parks != null ? sp.parks : null, '/30 parks', null, sp.parks == null);
    else if (sp.parks != null && sp.parks >= 1) T('HR in', sp.parks, '/30 parks');
    if (out.length < 6) T('Bat speed', bs != null ? bs.toFixed(1) : null, 'mph', _patPct(bs, _PAT_LG.bat), bs == null);
    var p = _patLastPitch(lp), mph = p ? (p.mph != null ? p.mph : p.speed) : null;
    if (out.length < 6 && tier.kind === 'hr' && mph != null) T('Pitch he hit', Number(mph).toFixed(0) + ' ' + _patPitchWord(p), '', null, false, true);
  } else {
    // v7.20.2: a strikeout leads with the pitcher's K count today
    if (tier.kind === 'k' && typeof _paKCount === 'function') {
      var kc = _paKCount(lp, box);
      if (kc) T('K today', kc.mine);
    }
    (_patRows(lp, box).rows || []).forEach(function (r) {
      if (r.v == null && !r.txt) { if (r.sav) T(r.l, null, r.u, null, true); return; }
      if (r.txt) T(r.l, r.txt, '', null, false, true);
      else T(r.l, r.v, r.u, r.p);
    });
    if (tier.kind === 'k') {
      var lpk = _patLastPitch(lp), loc = _patLoc(lp, lpk);
      if (loc && out.length < 6) T('Where', loc.charAt(0).toUpperCase() + loc.slice(1), '', null, false, true);
      if ((lp.pitches || []).length && out.length < 6) T('Pitches', lp.pitches.length);
    }
  }
  return out.slice(0, 6);
}
// The at-bat's pitches in a small zone, the last one ringed in gold
function _patMiniZoneSvg(lp) {
  var ps = (lp.pitches || []).filter(function (p) { return p && p.px != null && p.pz != null; });
  if (!ps.length) return '';
  var top = lp.zoneTop || 3.5, bot = lp.zoneBottom || 1.5;
  var X = function (px) { return 50 + px / 1.7 * 42; }, Y = function (pz) { return 104 - (pz - .6) / 4 * 92; };
  var h = '<svg viewBox="0 0 100 110" aria-hidden="true"><rect x="' + X(-.83).toFixed(1) + '" y="' + Y(top).toFixed(1) + '" width="' + (X(.83) - X(-.83)).toFixed(1) + '" height="' + (Y(bot) - Y(top)).toFixed(1) + '" rx="2" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.75)" stroke-width="1.4"/>';
  ps.forEach(function (p, i) {
    var x = X(Math.max(-1.6, Math.min(1.6, p.px))).toFixed(1), y = Y(Math.max(.7, Math.min(4.4, p.pz))).toFixed(1), last = i === ps.length - 1;
    if (last) h += '<circle cx="' + x + '" cy="' + y + '" r="8.6" fill="none" stroke="#F2D98A" stroke-width="2"/>';
    h += '<circle cx="' + x + '" cy="' + y + '" r="6" fill="' + (typeof _pitchCallColor === 'function' ? _pitchCallColor(p.call) : '#A89FE8') + '" stroke="rgba(5,3,14,.6)" stroke-width="1"/>' +
      '<text x="' + x + '" y="' + (Number(y) + 2.4).toFixed(1) + '" text-anchor="middle" font-size="6.8" font-weight="800" fill="#fff" font-family="-apple-system,sans-serif">' + (p.num != null ? p.num : i + 1) + '</text>';
  });
  return h + '</svg>';
}
function _patNextUp(lp, box) {
  var s = box.situation || {};
  if (s.inningState === 'Middle' || s.inningState === 'End' || s.outs === 3) {
    var due = (s.dueUp || []).map(function (x) { return _patLast(x); }).filter(Boolean);
    if (due.length) return 'Due up: ' + due.join(', ');
  }
  var mb = box.matchup && box.matchup.batter;
  if (mb && mb.name && _patLast(mb.name) !== _patLast(lp.batter || '')) return 'Up next: ' + mb.name;
  return 'Here until the next at-bat';
}
function _patHoldCardHtml(lp, box, t0) {
  var o = _patHoldInfo(lp, box);
  if (!o) return '';
  var tier = o.tier, info = _patRows(lp, box);
  var tiles = _patHoldTiles(lp, box, tier);
  var spray = lp.hit && typeof _paLanding === 'function' && _paLanding(lp);
  var mini = spray ? _patSpraySvg(lp, o.t2) : _patMiniZoneSvg(lp);
  var tileHtml = tiles.map(function (x) {
    var v = x.wait ? '<span class="wt">—</span>' : _escapeHtml(String(x.v)) + (x.u ? '<small>' + _escapeHtml(x.u) + '</small>' : '');
    var bar = (!x.wait && x.p != null) ? '<span class="tp"><i style="width:' + x.p + '%;background:' + (typeof _savPctColor === 'function' ? _savPctColor(x.p) : '#A89FE8') + '"></i></span>' : '';
    return '<div class="tile"><span class="tl">' + _escapeHtml(x.l) + '</span><span class="tv' + (x.tx ? ' tx' : '') + '">' + v + '</span>' + bar + '</div>';
  }).join('');
  return '<div class="pah' + (tier.full ? '' : ' pah-lite') + (t0 === null ? ' held' : '') + '" style="--t0:' + (t0 === null ? '-60s' : t0) + ';--t1:' + o.bg + ';--t2:' + o.t2 + ';--tdark:' + _fbxDark(o.bg, .5) + '" role="status" aria-label="' + _escapeHtml(o.title + '. ' + o.who + (o.sub ? '. ' + o.sub : '')) + '">' +
    '<div class="bg"></div>' + (tier.full ? '<div class="st b"></div><div class="st"></div>' : '') + '<div class="sk"></div>' +
    '<div class="ct"><div class="top"><div class="wd">' + (o.top ? '<span class="sm">' + _escapeHtml(o.top) + '</span>' : '') +
      '<span class="big' + (o.big.length > 13 ? ' xl' : o.big.length > 9 ? ' long' : '') + '">' + _escapeHtml(o.big) + '</span>' +
      (o.who ? '<span class="who">' + _escapeHtml(o.who) + '</span>' : '') + (o.sub ? '<span class="sub">' + _escapeHtml(o.sub) + '</span>' : '') +
      (info.badge ? '<span class="bdg">' + _escapeHtml(info.badge) + '</span>' : '') + '</div>' +
      (mini ? '<div class="mini' + (spray ? '' : ' zn') + '">' + mini + '</div>' : '') + '</div>' +
    (tileHtml ? '<div class="tiles">' + tileHtml + '</div>' : '') +
    '<div class="ft"><span class="nx"><i></i>' + _escapeHtml(_patNextUp(lp, box)) + '</span>' +
      '<button type="button" class="rp" onclick="patReplayLive()" aria-label="Replay the play"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>Replay</button></div>' +
    '</div></div>';
}
// After the play's run: the same card, already in place (no entrance)
function _patHeldHtml(lp, box) { return _patHoldCardHtml(lp, box, null); }
// Replay button: run the play again in the square, then the card holds again
function patReplayLive() {
  var s = window._pa;
  if (!s || !s.play) return;
  s.startAt = Date.now(); s.seq = false; s.keep = false;
  if (typeof _paFill === 'function') _paFill();
}
