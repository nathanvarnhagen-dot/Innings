// ═══ BASEBALL LIVE REDESIGN (v6.0.0) ════════════════════════════════
// Count panel (balls / strikes / outs), a purple glow on the strike zone,
// a park drawn under the play animation (infield to scale on the square's
// own geometry: 90 ft = 113 units, mound at 60.5 ft), the Statcast strip
// under the square, and a home run takeover in the batting team's colors.
window._bbLastCount = window._bbLastCount || {};
function _bbCountHtml(s) {
  var b = s.balls != null ? s.balls : 0, k = s.strikes != null ? s.strikes : 0, o = s.outs != null ? Math.min(3, s.outs) : 0;
  var g = window._activeBrowseGame, pk = g ? String(g.gamePk) : '';
  var last = window._bbLastCount[pk] || null;
  window._bbLastCount[pk] = { b: b, k: k, o: o };
  var tile = function (cls, n, slots, label, changed) {
    var caps = '';
    for (var i = 0; i < slots; i++) caps += '<i class="' + (i < n ? 'on' : '') + '"></i>';
    return '<div class="bbc-t ' + cls + '"><span class="bbc-n' + (changed ? ' hit' : '') + '">' + n + '</span><span class="bbc-caps">' + caps + '</span><span class="bbc-l">' + label + '</span></div>';
  };
  return '<div class="bbc" role="group" aria-label="Count: ' + b + ' balls, ' + k + ' strikes, ' + o + (o === 1 ? ' out' : ' outs') + '">' +
    tile('bbc-b', b, 3, 'BALLS', last && last.b !== b) + tile('bbc-s', k, 2, 'STRIKES', last && last.k !== k) + tile('bbc-o', o, 2, 'OUTS', last && last.o !== o) + '</div>';
}
function _bbZoneGlow(svg, seq) {
  if (!svg || !seq || svg.indexOf('<svg') !== 0) return svg;
  var x1 = _szX(-0.83), x2 = _szX(0.83), y1 = _szY(seq.zoneTop), y2 = _szY(seq.zoneBottom);
  var id = 'bbzg' + (window._bbZgN = (window._bbZgN || 0) + 1);
  var halo = '<defs><filter id="' + id + 'f" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
    '<radialGradient id="' + id + 'h" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#A89FE8" stop-opacity=".22"/><stop offset="1" stop-color="#A89FE8" stop-opacity="0"/></radialGradient></defs>' +
    '<rect x="' + (x1 - 40).toFixed(1) + '" y="' + (y1 - 40).toFixed(1) + '" width="' + (x2 - x1 + 80).toFixed(1) + '" height="' + (y2 - y1 + 80).toFixed(1) + '" rx="18" fill="url(#' + id + 'h)"/>';
  var stroke = '<rect x="' + x1.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + (x2 - x1).toFixed(1) + '" height="' + (y2 - y1).toFixed(1) + '" rx="3" fill="none" stroke="#A89FE8" stroke-width="2.4" filter="url(#' + id + 'f)"/>';
  // halo under the zone; the purple edge over the colored cells, under the pitch dots
  var zi = svg.indexOf('<rect x="' + x1.toFixed(1) + '" y="' + y1.toFixed(1));
  svg = zi > -1 ? svg.slice(0, zi) + halo + svg.slice(zi) : svg.replace(/<\/svg>$/, halo + '</svg>');
  var di = svg.indexOf('r="10.5"');
  di = di > -1 ? svg.lastIndexOf('<circle', di) : svg.lastIndexOf('</svg>');
  return svg.slice(0, di) + stroke + svg.slice(di);
}
// The park, on the at-bat square's 500×386 drawing: home (250,366), bases
// 80 units apart on the diagonals, wall M 58 174 Q 250 20 442 174.
function _bbParkSvg(box) {
  var H = [250, 366], M = [250, 290], U = 1.257, R = 95 * U;
  var P = function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); };
  var hA = box && (box.homeAbbr || _ghAbbrFallback(box.home || ''));
  var cap = (hA && typeof _ghTeamColors === 'function') ? _ghTeamColors(hA).bg : '#FD5A1E';
  var id = 'bbpk' + (window._bbPkN = (window._bbPkN || 0) + 1);
  var fair = 'M 58 174 Q 250 20 442 174 L 250 366 Z', wall = 'M 58 174 Q 250 20 442 174';
  var s = '<defs><clipPath id="' + id + 'c"><path d="' + fair + '"/></clipPath>' +
    '<linearGradient id="' + id + 'st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A2260"/><stop offset="1" stop-color="#15103A"/></linearGradient>' +
    '<radialGradient id="' + id + 'd" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#D19560"/><stop offset="1" stop-color="#A96C3D"/></radialGradient>' +
    '<radialGradient id="' + id + 'l" cx=".5" cy=".6" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset=".65" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient></defs>';
  // stands behind the wall, seat rows in the app's purple
  s += '<path d="M -10 200 Q 250 -60 510 200 L 510 0 L -10 0 Z" fill="url(#' + id + 'st)"/>';
  for (var r = 0; r < 5; r++) { var o = r * 9; s += '<path d="M ' + (20 + o) + ' ' + (160 - o * .4) + ' Q 250 ' + (-10 - o * 1.6) + ' ' + (480 - o) + ' ' + (160 - o * .4) + '" fill="none" stroke="rgba(168,159,232,' + (.16 - r * .02).toFixed(2) + ')" stroke-width="1.2"/>'; }
  // foul ground, then striped fair grass (straight bands, pole to pole)
  s += '<path d="M -10 386 L -10 200 Q 250 60 510 200 L 510 386 Z" fill="#183A28"/>';
  s += '<g clip-path="url(#' + id + 'c)">';
  for (var y = 10, k = 0; y < 386; y += 18, k++) s += '<rect x="0" y="' + y + '" width="500" height="18" fill="' + (k % 2 ? '#2F7A4B' : '#378A57') + '"/>';
  s += '<path d="' + wall + '" fill="none" stroke="#A5703F" stroke-width="16"/></g>';            // warning track
  s += '<path d="' + wall + '" fill="none" stroke="#1B1A1A" stroke-width="8"/>' +
    '<path d="M 58 169 Q 250 15 442 169" fill="none" stroke="' + cap + '" stroke-width="2.4"/>';  // wall + home-team cap
  [[82, 178, '330'], [150, 110, '375'], [250, 88, '400'], [350, 110, '375'], [418, 178, '330']].forEach(function (d) {
    s += '<text x="' + d[0] + '" y="' + d[1] + '" text-anchor="middle" font-size="11" font-weight="800" fill="rgba(255,255,255,.75)" font-family="-apple-system,Helvetica,sans-serif">' + d[2] + '</text>';
  });
  s += '<line x1="58" y1="174" x2="55" y2="138" stroke="#F2C869" stroke-width="2.4"/><line x1="442" y1="174" x2="445" y2="138" stroke="#F2C869" stroke-width="2.4"/>';
  // infield dirt: a 95 ft arc around the mound, closed along both foul lines
  var dx = M[0] - H[0], dy = M[1] - H[1];
  var meet = function (sign) {
    var ux = sign / Math.SQRT2, uy = -1 / Math.SQRT2, b = -2 * (dx * ux + dy * uy), c = dx * dx + dy * dy - R * R;
    var t = (-b + Math.sqrt(b * b - 4 * c)) / 2; return [H[0] + ux * t, H[1] + uy * t];
  };
  s += '<path d="M ' + P(H) + ' L ' + P(meet(1)) + ' A ' + R.toFixed(1) + ' ' + R.toFixed(1) + ' 0 0 0 ' + P(meet(-1)) + ' Z" fill="url(#' + id + 'd)"/>';
  // infield grass inside the base paths
  var ins = function (p) { return [p[0] + (M[0] - p[0]) * .13, p[1] + (M[1] - p[1]) * .13]; };
  var g1 = ins([330, 286]), g2 = ins([250, 206]), g3 = ins([170, 286]), g0 = ins(H);
  s += '<path d="M ' + P(g0) + ' L ' + P(g1) + ' L ' + P(g2) + ' L ' + P(g3) + ' Z" fill="#378A57"/>';
  s += '<circle cx="250" cy="290" r="' + (9 * U).toFixed(1) + '" fill="url(#' + id + 'd)"/><rect x="244" y="289" width="12" height="2.4" fill="#fff" opacity=".9"/>' +
    '<circle cx="250" cy="366" r="' + (13 * U).toFixed(1) + '" fill="url(#' + id + 'd)"/>' +
    '<rect x="233" y="357" width="8" height="14" fill="none" stroke="#fff" stroke-width="1" opacity=".75"/><rect x="259" y="357" width="8" height="14" fill="none" stroke="#fff" stroke-width="1" opacity=".75"/>';
  s += '<rect x="0" y="0" width="500" height="386" fill="url(#' + id + 'l)"/>';
  // stadium lights
  s += '<rect x="40" y="6" width="44" height="5" rx="2.5" fill="#F4F1FF" opacity=".9"/><rect x="416" y="6" width="44" height="5" rx="2.5" fill="#F4F1FF" opacity=".9"/>' +
    '<polygon points="40,11 84,11 170,120 110,120" fill="#E9E5FF" opacity=".06"/><polygon points="416,11 460,11 390,120 330,120" fill="#E9E5FF" opacity=".06"/>';
  return s;
}
// Exit velo, launch angle and distance under the square: the strip slides
// in at contact and the numbers count up until the ball comes down.
function _bbStatsHtml(lp, s, OFF) {
  var h = lp.hit || {};
  var g = window._activeBrowseGame, sp = (typeof _savPlay === 'function' && g) ? (_savPlay(g.gamePk, lp.atBatIndex) || {}) : {};
  var ev = h.speed != null ? h.speed : sp.ev, la = h.angle != null ? h.angle : sp.la, dist = h.distance != null ? h.distance : sp.dist;
  var tr = h.trajectory || '';
  if (ev == null && la == null && dist == null) return '';
  var trWord = { ground_ball: 'GROUND BALL', line_drive: 'LINE DRIVE', fly_ball: 'FLY BALL', popup: 'POP UP', bunt_grounder: 'BUNT', bunt_popup: 'BUNT' }[tr] || '';
  if ((lp.eventType || '') === 'home_run') trWord = trWord ? trWord + ' \u00b7 HOME RUN' : 'HOME RUN';
  var t0 = OFF + PA.T0, t1 = OFF + (s._t1 != null ? s._t1 : PA.T0 + 1.2);
  var E = (Date.now() - s.startAt) / 1000;
  var m = function (key, v, dec, unit, label) {
    return '<div class="ps-m"><b><span data-bbv="' + (v == null ? '' : v) + '" data-dec="' + dec + '">' + (v == null ? '\u2014' : (0).toFixed(dec)) + '</span><small>' + (v == null ? '' : unit) + '</small></b><span>' + label + '</span></div>';
  };
  return '<div class="ps-in" data-t0="' + t0.toFixed(2) + '" data-t1="' + t1.toFixed(2) + '" data-start="' + s.startAt + '" style="--t0:' + (t0 - E).toFixed(2) + 's">' +
    (trWord ? '<span class="ps-tr">' + trWord + '</span>' : '') +
    '<div class="ps-g">' + m('ev', ev, 1, 'MPH', 'EXIT VELO') + m('la', la, 0, '\u00b0', 'LAUNCH') + m('d', (tr === 'ground_ball' ? null : dist), 0, 'FT', 'DISTANCE') + '</div>' +
    '</div>'; // v7.8.4: no xBA on the live play — Statcast is too slow; it's in the play-by-play and replays
}
// v7.6.0: xBA on every ball in play, in its own row under the three stats.
// Statcast posts it 20-60 s after the play, so until then the row shows
// "Waiting on Statcast" and fills in on the next refresh. After 3 minutes
// with nothing it says so rather than waiting forever. A fly ball or
// liner that would have left at least one park says how many.
function _bbXbaRowHtml(lp, sp, since) {
  sp = sp || {};
  var et = lp.eventType || '', tr = (lp.hit && lp.hit.trajectory) || '';
  var isHit = /^(single|double|triple|home_run)$/.test(et);
  var x = sp.xba, h;
  if (x != null) {
    var tag = isHit && x < .25 ? 'LUCKY' : (!isHit && x >= .6 ? 'ROBBED' : '');
    h = '<div class="ps-x"><div class="ps-xv"><b>' + x.toFixed(3).replace(/^0/, '') + '</b><span>xBA</span></div>' +
      '<span class="ps-xw">Lands for a hit ' + Math.round(x * 100) + '% of the time</span>' +
      (tag ? '<span class="ps-xt ' + (isHit ? 'good' : 'bad') + '">' + tag + '</span>' : '') + '</div>';
  } else {
    var stale = since && Date.now() - since > 180000;
    h = '<div class="ps-x"><div class="ps-xv">' + (stale ? '<b>\u2014</b>' : '<b class="ps-dots" role="img" aria-label="xBA loading"><i></i><i></i><i></i></b>') + '<span>xBA</span></div>' +
      '<span class="ps-xw">' + (stale ? 'Statcast hasn\u2019t posted xBA for this ball' : 'Waiting on Statcast') + '</span></div>';
  }
  if (sp.parks != null && sp.parks >= 1 && (et === 'home_run' || /fly_ball|line_drive|popup/.test(tr))) {
    h += '<div class="ps-hr' + (et === 'home_run' ? '' : ' out') + '">' +
      (et === 'home_run' ? 'Gone in ' + sp.parks + ' of 30 parks' : 'Home run in ' + sp.parks + ' of 30 parks') + '</div>';
  }
  return h;
}
// The same strip with final numbers and no entrance motion — shown after
// the play animation ends and kept until the next batter's first pitch,
// so xBA has time to arrive. Re-rendered on every refresh.
function _bbStatsStaticHtml(lp, since) {
  var h = lp.hit || {};
  var g = window._activeBrowseGame, sp = (typeof _savPlay === 'function' && g) ? (_savPlay(g.gamePk, lp.atBatIndex) || {}) : {};
  var ev = h.speed != null ? h.speed : sp.ev, la = h.angle != null ? h.angle : sp.la, dist = h.distance != null ? h.distance : sp.dist;
  var tr = h.trajectory || '';
  if (ev == null && la == null && dist == null) return '';
  var trWord = { ground_ball: 'GROUND BALL', line_drive: 'LINE DRIVE', fly_ball: 'FLY BALL', popup: 'POP UP', bunt_grounder: 'BUNT', bunt_popup: 'BUNT' }[tr] || '';
  if ((lp.eventType || '') === 'home_run') trWord = trWord ? trWord + ' \u00b7 HOME RUN' : 'HOME RUN';
  var m = function (v, dec, unit, label) {
    return '<div class="ps-m"><b><span>' + (v == null ? '\u2014' : Number(v).toFixed(dec)) + '</span><small>' + (v == null ? '' : unit) + '</small></b><span>' + label + '</span></div>';
  };
  return '<div class="ps-in ps-static">' + (trWord ? '<span class="ps-tr">' + trWord + '</span>' : '') +
    '<div class="ps-g">' + m(ev, 1, 'MPH', 'EXIT VELO') + m(la, 0, '\u00b0', 'LAUNCH') + m(tr === 'ground_ball' ? null : dist, 0, 'FT', 'DISTANCE') + '</div>' +
    '</div>'; // v7.8.4: no xBA on the live play
}
function _bbKeptStripHtml() {
  var k = window._bbKeep;
  if (!k || !k.lp) return '';
  var g = window._activeBrowseGame;
  if (!g || String(g.gamePk) !== k.pk) { window._bbKeep = null; return ''; }
  var box = typeof _gcBox === 'function' ? _gcBox() : null;
  var seq = box && box.pitchSequence, st = (box && box.situation) || {};
  if (st.inningState === 'Middle' || st.inningState === 'End') return '';
  // next batter has seen a pitch: this ball's moment is over
  if (seq && seq.atBatIndex != null && seq.atBatIndex !== k.lp.atBatIndex && seq.pitches && seq.pitches.length) { window._bbKeep = null; return ''; }
  return _bbStatsStaticHtml(k.lp, k.since);
}
function _bbStatsTick() {
  if (window._bbStatsRaf) return;
  var step = function () {
    window._bbStatsRaf = null;
    var box = document.querySelector('#gh-pa-stats .ps-in');
    if (!box) return;
    var t0 = +box.getAttribute('data-t0'), t1 = +box.getAttribute('data-t1'), st = +box.getAttribute('data-start');
    var E = (Date.now() - st) / 1000;
    var reduce = typeof _ghReducedMotion === 'function' && _ghReducedMotion();
    var p = reduce ? 1 : Math.max(0, Math.min(1, (E - t0) / Math.max(.3, t1 - t0)));
    var ease = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
    box.querySelectorAll('[data-bbv]').forEach(function (n) {
      var v = n.getAttribute('data-bbv');
      if (v === '') return;
      n.textContent = (Number(v) * ease).toFixed(+n.getAttribute('data-dec'));
    });
    if (p < 1) window._bbStatsRaf = requestAnimationFrame(step);
  };
  window._bbStatsRaf = requestAnimationFrame(step);
}
// Home run: the batting team's takeover inside the square, with the
// Statcast numbers. Starts as the ball clears the wall.
function _bbHrTakeoverHtml(lp, box, s, Es) {
  var top = lp.half === 'top';
  var name = top ? box.away : box.home, abbr = top ? (box.awayAbbr || _ghAbbrFallback(box.away || '')) : (box.homeAbbr || _ghAbbrFallback(box.home || ''));
  var c = _ghTeamColors(abbr);
  // second color: the team's accent when it stands out from the base color, else white
  var t2 = (c.accent && Math.abs(_gxLum(c.accent) - _gxLum(c.bg)) > .25) ? c.accent : '#FFFFFF';
  var nm = String(_teamShortName(name || '') || abbr || '').toUpperCase();
  var rbi = lp.rbi || 1;
  var shot = rbi >= 4 ? 'Grand slam' : rbi === 1 ? 'Solo shot' : rbi + '-run shot';
  var h = lp.hit || {};
  var stats = [h.speed != null ? h.speed + '<small>MPH</small>' : null, h.angle != null ? h.angle + '<small>\u00b0</small>' : null, h.distance != null ? h.distance + '<small>FT</small>' : null].filter(Boolean);
  var at = (s._t1 != null ? s._t1 : PA.T0 + 1.8) + .2;
  return '<div class="fbx-to pa-to" style="--t0:' + _paSec(at, Es) + ';--t1:' + c.bg + ';--t2:' + t2 + ';--tdark:' + _fbxDark(c.bg, .5) + '">' +
    '<div class="bg"></div><div class="st b"></div><div class="st"></div><div class="sk"></div>' +
    '<div class="ct"><span class="lg">' + _escapeHtml(abbr || '') + '</span><div class="wd"><span class="sm">HOME RUN</span>' +
    '<span class="bg2' + (nm.length > 10 ? ' long' : '') + '">' + _escapeHtml(nm) + '</span>' +
    '<span class="who">' + _escapeHtml((_ghLastName(lp.batter || '') || '') + ' \u00b7 ' + shot) + '</span>' +
    (stats.length ? '<span class="stx">' + stats.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</span>' : '') +
    '<span class="ln"></span></div></div></div>';
}
