// ── STRIKE ZONE — pitch-by-pitch for the current at-bat. Coordinates
// (px, pz) are the same Statcast/Gameday plate-crossing data, viewed
// from the catcher's/umpire's perspective — verified (not assumed)
// against two independent sources: positive px is the first-base side,
// and a right-handed batter stands on the third-base side (confirmed
// separately by "negative px = inside pitch to a righty"). So on this
// diagram, drawn with px increasing left-to-right same as that
// convention: a RIGHT-handed batter's silhouette goes on the LEFT, a
// LEFT-handed batter's on the RIGHT — the opposite of what might seem
// intuitive, which is exactly why this was checked rather than guessed.
function _pitchCallColor(call) {
  // v5.84.0: three colors only — green for any ball, red for any strike
  // (called, swinging, foul, foul tip, missed bunt), blue for in play.
  if (!call) return 'rgba(255,255,255,.35)';
  var c = call.toLowerCase();
  if (c.indexOf('in play') !== -1) return '#4C9DFF';
  if (c.indexOf('hit by pitch') !== -1) return '#A89FE8';
  if (/strike|foul|missed bunt/.test(c)) return '#F04848';
  if (/ball|pitchout/.test(c)) return '#3DBE6E';
  return 'rgba(255,255,255,.35)';
}
// New wider, consistent-scale coordinate system (350x260, ~50px per
// foot in both dimensions) — the previous one used different pixel-
// per-foot scales for X and Y, which distorted the zone into a
// squashed rectangle instead of the roughly-square shape a real strike
// zone actually is.
// SCALE is bigger now (70px/ft, was 50) per the "make the strike zone
// bigger" request. _szX centers on the canvas's true midpoint (250 of
// 500 — the canvas had to widen from 350 to fit a properly-scaled
// batter beside a bigger zone with margin on both sides, computed
// below, not guessed). _szY keeps the same "feet at Y_GROUND" logic,
// with Y_GROUND now derived from the anatomical calibration (see
// _strikeZoneSectionHtml) rather than picked freely.
var _SZ_SCALE = 70, _SZ_CENTER_X = 250, _SZ_Y_GROUND = 373.5217;
function _szX(px) { return _SZ_CENTER_X + px * _SZ_SCALE; }
function _szY(pz) { return _SZ_Y_GROUND - pz * _SZ_SCALE; }

function _strikeZoneSectionHtml(seq, ruleColor, subColor, color, partsOnly) {
  if (!seq) return '';
  var zoneX1 = _szX(-0.83), zoneX2 = _szX(0.83);
  var zoneY1 = _szY(seq.zoneTop), zoneY2 = _szY(seq.zoneBottom);
  // Shadow zone: the Statcast term for the band straddling the actual
  // rule-book edge where borderline calls happen — roughly a ball's
  // width (0.3ft) extended outward on every side of the heart zone.
  var shadowMargin = 0.3 * _SZ_SCALE;
  var shadowX1 = zoneX1 - shadowMargin, shadowX2 = zoneX2 + shadowMargin;
  var shadowY1 = zoneY1 - shadowMargin, shadowY2 = zoneY2 + shadowMargin;

  // Right-handed -> left side of the diagram, left-handed -> right side
  // (see the note above _pitchCallColor). `flip` mirrors the whole pose
  // horizontally so the arms/bat reach toward the plate on whichever
  // side the batter actually stands, rather than always reaching the
  // same direction regardless of handedness.
  //
  // This silhouette started from a reference render (head/helmet/torso/
  // legs built as smooth bezier curves, not primitive shapes), then
  // corrected in stages: the bat was mirrored point-for-point around
  // the body's center so the barrel points away from the pitcher
  // instead of toward it; the arms were rebuilt to actually reach the
  // hands/grip point after that move left them behind; the bat's
  // barrel was brought down to shoulder height; the legs were scaled
  // narrower around the hip pivot; the bat was lengthened and
  // thickened.
  //
  // The scale here is no longer a chosen constant — it's SOLVED so two
  // corrected anatomical landmarks land exactly on the zone's edges:
  // mid-torso (the rule's own "midpoint between the shoulders and the
  // top of the uniform pants" — shoulder at local y=72, pants-top at
  // local y=140, the torso path's actual max-y, not the y=94 mid-curve
  // point mistakenly used in an earlier pass) lands on the zone's top
  // edge, and the knee (the leg span's midpoint, local y=175) lands on
  // the zone's bottom edge. The batter's feet position — and the plate,
  // which sits at the same ground line — fall out of that calibration;
  // they were never independently assumed.
  var flip = (seq.batSide === 'L');
  var MID_TORSO_LOCAL = 106.0, KNEE_LOCAL = 175.0;
  var batterScale = (zoneY2 - zoneY1) / (KNEE_LOCAL - MID_TORSO_LOCAL);
  var batterTy = zoneY1 - MID_TORSO_LOCAL * batterScale;
  var mirrorAxis = 53;
  var figureOffsetX = flip ? 372 : 20;
  // v5.72.0: redrawn body — neck, tapered torso, hips, bent knees, shoes
  // toward the plate — drawn as ONE shape and shown as its outline (a
  // morphology filter traces the edge of the whole silhouette, so there
  // are no seams where the pieces overlap). Head, helmet, arms and bat
  // are unchanged. Same local landmarks as before: mid-torso y=106,
  // knee y=175, feet y=216, so the zone calibration below still holds.
  var BATTER_HEAD = '<path d="M 45,55 C 45,46 52,40 60,40 C 67,40 72,46 72,53 C 72,56 68,59 65,59 C 68,61 70,66 67,70 C 64,74 58,74 54,71 L 45,55 Z"/><path d="M 68,48 L 84,52 L 82,56 L 68,52 Z"/>';
  var BATTER_NECK = '<path d="M 52,64 L 64,64 L 64,74 L 52,76 Z"/>';
  var BATTER_TORSO = '<path d="M 47,71 C 40,73 35,80 35,89 C 35,101 39,112 41,121 C 38,127 36,134 38,140 C 44,146 64,146 70,140 C 71,132 69,126 67,120 C 70,108 72,95 70,84 C 68,76 62,71 56,70 Z"/>';
  var BATTER_ARMS = '<path d="M 60.3,79.5 L 83.9,68.6 L 80.1,59.4 L 55.7,68.5 Z"/><path d="M 68.0,75.6 L 83.6,67.7 L 80.4,60.3 L 64.0,66.4 Z"/>';
  var BATTER_BAT = '<circle cx="82" cy="64" r="6"/><path d="M 84.1,60.6 L 28.5,19.2 L 18.0,36.3 L 79.9,67.4 Z"/>';
  var BATTER_BACK_LEG = '<path d="M 39,122 C 33,140 33,156 36,168 C 36,180 31,194 29,205 L 27,210 L 29,216 L 49,216 C 49,212 45,209 41,206 C 43,195 48,183 49,172 C 51,158 55,144 58,124 Z"/>';
  var BATTER_FRONT_LEG = '<path d="M 50,126 C 58,144 66,158 70,170 C 70,183 69,195 71,205 L 70,210 L 71,216 L 97,216 C 97,212 91,209 85,206 C 84,194 85,182 84,168 C 81,154 75,138 69,122 Z"/>';
  var batterInner = BATTER_HEAD + BATTER_NECK + BATTER_TORSO + BATTER_ARMS + BATTER_BAT + BATTER_BACK_LEG + BATTER_FRONT_LEG;
  var batterScaled = '<g transform="translate(' + (53 * (1 - batterScale)).toFixed(2) + ',' + batterTy.toFixed(2) + ') scale(' + batterScale.toFixed(4) + ',' + batterScale.toFixed(4) + ')">' + batterInner + '</g>';
  var batterMirrored = flip ? '<g transform="translate(' + (2 * mirrorAxis) + ',0) scale(-1,1)">' + batterScaled + '</g>' : batterScaled;
  var olId = 'szOutline' + (window._szOutlineN = (window._szOutlineN || 0) + 1);
  var batterSvg = '<defs><filter id="' + olId + '" x="-10%" y="-10%" width="120%" height="120%">' +
    '<feMorphology in="SourceAlpha" operator="dilate" radius="1.3" result="d"/>' +
    '<feComposite in="d" in2="SourceAlpha" operator="out" result="o"/>' +
    '<feFlood flood-color="#D9D4FA"/><feComposite in2="o" operator="in"/></filter></defs>' +
    '<g filter="url(#' + olId + ')" opacity="0.85" transform="translate(' + figureOffsetX + ',0)"><g fill="#A89FE8">' + batterMirrored + '</g></g>';
  // Feet position derived from the same calibration, not assumed — the
  // plate sits exactly at the batter's own ground line.
  var groundY = batterTy + 216 * batterScale;

  // 3x3 zone grid, matching the classic broadcast strike-zone look.
  var gridSvg = '';
  for (var i = 1; i < 3; i++) {
    var gx = zoneX1 + (zoneX2 - zoneX1) * i / 3;
    var gy = zoneY1 + (zoneY2 - zoneY1) * i / 3;
    gridSvg += '<line x1="' + gx.toFixed(1) + '" y1="' + zoneY1.toFixed(1) + '" x2="' + gx.toFixed(1) + '" y2="' + zoneY2.toFixed(1) + '" stroke="rgba(255,255,255,.22)" stroke-width="1"/>';
    gridSvg += '<line x1="' + zoneX1.toFixed(1) + '" y1="' + gy.toFixed(1) + '" x2="' + zoneX2.toFixed(1) + '" y2="' + gy.toFixed(1) + '" stroke="rgba(255,255,255,.22)" stroke-width="1"/>';
  }

  var shadowSvg = '<rect x="' + shadowX1.toFixed(1) + '" y="' + shadowY1.toFixed(1) + '" width="' + (shadowX2 - shadowX1).toFixed(1) + '" height="' + (shadowY2 - shadowY1).toFixed(1) + '" fill="rgba(168,159,232,.08)" stroke="rgba(168,159,232,.35)" stroke-width="1.5"/>';

  // Home plate, on the ground — same ground line the batter's feet are
  // calibrated to, not a fixed offset below the zone with no relation
  // to the batter.
  var plateCx = (zoneX1 + zoneX2) / 2, plateW = (zoneX2 - zoneX1) * 1.15, plateDepth = 35;
  var plateSvg = '<path d="M ' + (plateCx - plateW / 2).toFixed(1) + ' ' + groundY.toFixed(1) +
    ' L ' + (plateCx + plateW / 2).toFixed(1) + ' ' + groundY.toFixed(1) +
    ' L ' + (plateCx + plateW / 2).toFixed(1) + ' ' + (groundY + plateDepth * 0.5).toFixed(1) +
    ' L ' + plateCx.toFixed(1) + ' ' + (groundY + plateDepth).toFixed(1) +
    ' L ' + (plateCx - plateW / 2).toFixed(1) + ' ' + (groundY + plateDepth * 0.5).toFixed(1) + ' Z" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.3)" stroke-width="1"/>';

  var svg = '<svg viewBox="0 0 500 386" width="100%" height="220" style="display:block">' +
    batterSvg +
    '<rect x="0" y="0" width="500" height="386" fill="rgba(255,255,255,.03)" rx="10"/>' +
    shadowSvg +
    '<rect x="' + zoneX1.toFixed(1) + '" y="' + zoneY1.toFixed(1) + '" width="' + (zoneX2 - zoneX1).toFixed(1) + '" height="' + (zoneY2 - zoneY1).toFixed(1) + '" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.5)" stroke-width="2"/>' +
    (typeof _savZonesSvg === 'function' ? _savZonesSvg(seq, zoneX1, zoneY1, zoneX2, zoneY2) : '') + gridSvg + plateSvg;
  seq.pitches.forEach(function (p) {
    var x = _szX(p.px), y = _szY(p.pz), pColor = _pitchCallColor(p.call);
    // v5.96.0: drawn close to a real baseball's size so edge calls read right
    svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="10.5" fill="' + pColor + '" stroke="#0D0820" stroke-width="1.2"/>' +
      '<text x="' + x.toFixed(1) + '" y="' + (y + 4.2).toFixed(1) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#0D0820" font-family="-apple-system,sans-serif">' + p.num + '</text>';
  });
  svg += '</svg>';

  var list = seq.pitches.length ? seq.pitches.map(function (p) {
    var descBits = [];
    if (p.speed) descBits.push(p.speed + 'mph');
    if (p.type) descBits.push(p.type);
    if (p.call) descBits.push(p.call);
    return '<div style="display:flex;align-items:center;gap:7px;padding:4px 0"><div style="font-size:9px;color:' + subColor + ';width:12px;flex-shrink:0">' + p.num + '</div>' +
      '<div style="width:9px;height:9px;border-radius:50%;background:' + _pitchCallColor(p.call) + ';flex-shrink:0"></div>' +
      '<div style="font-size:11px;color:' + color + ';line-height:1.3">' + _escapeHtml(descBits.join(' · ')) + '</div></div>';
  }).join('') : '<div style="font-size:11px;color:' + subColor + ';padding:4px 0">No pitches yet this at-bat</div>';

  var legend = ['Ball', 'Strike', 'In play'].map(function (label) {
    return '<div style="display:flex;align-items:center;gap:4px;font-size:9px;color:' + subColor + '">' +
      '<div style="width:7px;height:7px;border-radius:50%;background:' + _pitchCallColor(label) + '"></div>' + label + '</div>';
  }).join('');

  if (partsOnly) return { svg: svg, list: list, legend: legend }; // live game screen lays these out itself
  // Diagram full-width on top (the zone is the star, same as a
  // broadcast graphic), pitch list stacked below it — not side by side,
  // which is what was squeezing the zone into a small corner before.
  return '<div style="margin-top:10px;padding-top:10px;border-top:0.5px solid ' + ruleColor + '">' +
    (seq.batter ? '<div style="font-size:9px;color:' + subColor + ';text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Pitches to ' + _clickablePlayerNameHtml({ name: seq.batter, id: seq.batterId }, 'mlb') + '</div>' : '') +
    '<div style="border-radius:10px;overflow:hidden;margin-bottom:10px">' + svg + '</div>' +
    '<div>' + list + '</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">' + legend + '</div>' +
    '</div>';
}

// ── FULL BOX SCORE — every batter's and pitcher's actual game line,
// collapsed by default (this can get long — a 9-inning game easily has
// 15+ players between both teams) with an away/home toggle when open.
// State lives outside this pure render function (window._bsDetailState)
// since the box score card gets rebuilt from scratch on every live
// refresh tick — without external state, expanding it would silently
// re-collapse on the next 15-second poll.
window._bsDetailState = { expanded: false, side: 'away' };
function _boxScoreDetailSectionHtml(detail, awayName, homeName, ruleColor, subColor, color, bare) {
  if (!detail || (!detail.away.batters.length && !detail.home.batters.length)) return '';
  var state = window._bsDetailState;
  var teamData = detail[state.side] || { batters: [], pitchers: [] };
  var colHead = function (cols, withLead) {
    return '<div style="display:flex;gap:6px;padding:2px 0;font-size:9px;color:' + subColor + ';font-weight:700">' +
      (withLead ? '<div style="width:14px;flex-shrink:0"></div>' : '') +
      '<div style="flex:1">Player</div>' + cols.map(function (c) { return '<div style="width:' + c.w + 'px;text-align:right">' + c.label + '</div>'; }).join('') + '</div>';
  };
  // lead: undefined → no order column (pitchers / older saved games);
  // otherwise { slot, sub } — starters show their 1-9 spot, subs (pinch
  // hitters/runners, defensive changes) sit indented under that spot.
  var statRow = function (name, id, pos, cells, lead) {
    var leadHtml = '';
    var indent = '';
    if (lead) {
      var isSub = lead.sub > 0;
      leadHtml = '<div style="width:14px;flex-shrink:0;text-align:right;color:' + subColor + ';font-weight:700">' + (isSub || !lead.slot ? '' : lead.slot) + '</div>';
      if (isSub) indent = 'padding-left:10px;border-left:1.5px solid rgba(168,159,232,.35);margin-left:2px;';
    }
    return '<div style="display:flex;gap:6px;padding:5px 0;border-top:0.5px solid ' + ruleColor + ';font-size:11px;color:' + color + '">' + leadHtml +
      '<div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + indent + '">' + _clickablePlayerNameHtml({ name: name, id: id }, 'mlb') + (pos ? ' <span style="color:' + subColor + ';font-size:9px">' + _escapeHtml(pos) + '</span>' : '') + '</div>' +
      cells.map(function (v) { return '<div style="width:22px;text-align:right">' + v + '</div>'; }).join('') + '</div>';
  };

  var header = '<div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer" onclick="toggleBoxScoreDetail()">' +
    '<div style="font-size:12px;font-weight:700;color:' + color + '">Box Score</div>' +
    '<div style="font-size:11px;color:' + subColor + '">' + (state.expanded ? '▲ Hide' : '▼ Show') + '</div></div>';

  var body = '';
  if (state.expanded) {
    body += '<div style="display:flex;gap:8px;margin:10px 0">' + ['away', 'home'].map(function (side) {
      var active = side === state.side;
      var label = side === 'away' ? (awayName || 'Away') : (homeName || 'Home');
      return '<button onclick="event.stopPropagation();setBoxScoreDetailSide(\'' + side + '\')" style="flex:1;padding:7px 8px;border-radius:8px;border:none;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
        (active ? 'background:var(--indigo);color:#fff' : 'background:rgba(255,255,255,.08);color:' + subColor) + '">' + _escapeHtml(label) + '</button>';
    }).join('') + '</div>';

    if (teamData.batters.length) {
      body += '<div style="font-size:9px;color:' + subColor + ';text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">Batting</div>';
      var hasOrder = teamData.batters.some(function (b) { return b.slot; });
      var batters = teamData.batters.slice();
      if (hasOrder) {
        batters.sort(function (x, y) {
          var ox = x.slot ? x.slot * 100 + (x.sub || 0) : 99999, oy = y.slot ? y.slot * 100 + (y.sub || 0) : 99999;
          return ox - oy;
        });
      }
      body += colHead([{ label: 'AB', w: 22 }, { label: 'R', w: 22 }, { label: 'H', w: 22 }, { label: 'RBI', w: 26 }, { label: 'BB', w: 22 }, { label: 'SO', w: 22 }], hasOrder);
      body += batters.map(function (b) { return statRow(b.name, b.id, b.pos, [b.ab, b.r, b.h, b.rbi, b.bb, b.so], hasOrder ? { slot: b.slot || null, sub: b.sub || 0 } : undefined); }).join('');
    }
    if (teamData.pitchers.length) {
      body += '<div style="font-size:9px;color:' + subColor + ';text-transform:uppercase;letter-spacing:.04em;margin:12px 0 2px">Pitching</div>';
      body += colHead([{ label: 'IP', w: 26 }, { label: 'H', w: 22 }, { label: 'R', w: 22 }, { label: 'ER', w: 22 }, { label: 'BB', w: 22 }, { label: 'SO', w: 22 }]);
      body += teamData.pitchers.map(function (p) { return statRow(p.name, p.id, null, [p.ip, p.h, p.r, p.er, p.bb, p.so]); }).join('');
    }
  }
  if (bare) { // caller supplies its own card — header restyled to match it
    header = '<div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;min-height:32px" onclick="toggleBoxScoreDetail()">' +
      '<span class="gh-eyebrow">Box score</span>' +
      '<span style="height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(168,159,232,.22);color:#D9D4FA;font-size:11.5px;font-weight:700;display:flex;align-items:center">' + (state.expanded ? 'Hide' : 'Show') + '</span></div>';
    return header + body;
  }
  return '<div style="margin-top:10px;padding-top:10px;border-top:0.5px solid ' + ruleColor + '">' + header + body + '</div>';
}

// Rebuilds the box score card from the last-fetched data with current
// _bsDetailState — needed because the card is a rendered HTML string
// cached in window._gdPregame.boxScoreHtml, not re-derived on demand,
// so toggling expand/side has to explicitly regenerate and re-render it.
function _rerenderBoxScoreFromCache() {
  if (!window._lastLiveBox || !window._gdPregame) return;
  var html = _boxScoreCardHtml(window._lastLiveBox, true, true, _gameScreenBoxOpts(window._lastLiveBox));
  if (!html) return;
  window._gdPregame.boxScoreHtml = html + '<div style="height:14px"></div>';
  renderGameCheatSheet();
}
function toggleBoxScoreDetail() {
  window._bsDetailState.expanded = !window._bsDetailState.expanded;
  _rerenderBoxScoreFromCache();
}
function setBoxScoreDetailSide(side) {
  window._bsDetailState.side = side;
  _rerenderBoxScoreFromCache();
}

function _boxScoreCardHtml(box, dark, allowPlayReply, opts) {
  if (!box || !box.home) return '';
  // opts.hero ('live' | 'final') — set only on the game screen when the
  // game-state hero card above already shows the score, situation, and
  // (for final) linescore + decisions, so this card skips those pieces.
  opts = opts || {};
  var heroLive = opts.hero === 'live', heroFinal = opts.hero === 'final';
  // Live MLB on the game screen: the restyled detail cards (v5.41.0)
  if (heroLive && typeof _ghLiveDetailHtml === 'function') {
    var liveDetail = _ghLiveDetailHtml(box);
    if (liveDetail) return liveDetail;
  }
  var color = dark ? '#fff' : 'var(--black)';
  var subColor = dark ? 'rgba(255,255,255,0.65)' : 'var(--subtle)';
  var bg = dark ? 'rgba(255,255,255,0.14)' : 'var(--bg)';
  var border = dark ? 'none' : '0.5px solid var(--rule)';
  var ruleColor = dark ? 'rgba(255,255,255,.1)' : 'var(--rule)';
  var innings = box.innings || [];
  // `label` covers quarters/periods ("Q1", "1st") where the old MLB-only
  // `num` (a plain inning number) doesn't fit — falls back to num so
  // existing MLB data renders exactly as it always has.
  var periodHeader = innings.map(function(i){ return '<div style="flex:1;text-align:center;font-size:9.5px;color:' + subColor + '">' + _escapeHtml(String(i.label != null ? i.label : i.num)) + '</div>'; }).join('');
  var awayRow = innings.map(function(i){ return '<div style="flex:1;text-align:center;font-size:11px;font-weight:600;color:' + color + '">' + (i.away != null ? i.away : '-') + '</div>'; }).join('');
  var homeRow = innings.map(function(i){ return '<div style="flex:1;text-align:center;font-size:11px;font-weight:600;color:' + color + '">' + (i.home != null ? i.home : '-') + '</div>'; }).join('');
  var hrLines = (box.homeRuns || []).slice(0, 4).map(function(hr){
    return '<div style="font-size:11px;color:' + subColor + ';margin-top:3px;line-height:1.4">⚾ ' + _escapeHtml(hr.description || (hr.batter ? hr.batter + ' home run' : 'Home run')) + '</div>';
  }).join('');
  var decisionLine = box.winningPitcher ? '<div style="font-size:11px;color:' + subColor + ';margin-top:4px">W: ' + _escapeHtml(box.winningPitcher) + (box.losingPitcher ? ' · L: ' + _escapeHtml(box.losingPitcher) : '') + (box.savePitcher ? ' · SV: ' + _escapeHtml(box.savePitcher) : '') + '</div>' : '';
  // Generic brief-descriptor line for the non-MLB sports — scoring plays,
  // goal scorers, a leading performer, whatever that sport's backend
  // populated. MLB keeps using its own homeRuns/pitcher fields above rather
  // than being migrated to this, since that path is proven and there's no
  // reason to touch it.
  var highlightLines = (box.highlights || []).slice(0, 4).map(function(h){
    return '<div style="font-size:11px;color:' + subColor + ';margin-top:3px;line-height:1.4">' + _escapeHtml((h.emoji || '') + ' ' + (h.text || '')) + '</div>';
  }).join('');

  // Baseball's situation has balls/strikes/outs/bases; football's has
  // down/distance/possession — no overlapping field names between the
  // two shapes, so this branches on which one is actually present
  // rather than needing a second top-level field.
  var situationHtml = '';
  if (box.situation && (box.situation.balls != null || box.situation.outs != null || box.situation.bases)) {
    var s = box.situation;
    var baseFill = function (on) { return on ? '#7CF29C' : 'rgba(255,255,255,.18)'; };
    var basesSvg = '<svg width="40" height="40" viewBox="0 0 60 60" style="flex-shrink:0">' +
      '<polygon points="30,10 50,30 30,50 10,30" fill="none" stroke="' + subColor + '" stroke-width="1.5"/>' +
      '<circle cx="30" cy="10" r="4.5" fill="' + baseFill(s.bases.second) + '"/>' +
      '<circle cx="10" cy="30" r="4.5" fill="' + baseFill(s.bases.third) + '"/>' +
      '<circle cx="50" cy="30" r="4.5" fill="' + baseFill(s.bases.first) + '"/>' +
      '</svg>';
    var outsDots = [0, 1, 2].map(function (i) {
      return '<span style="width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:5px;background:' + (s.outs != null && i < s.outs ? '#E8622C' : 'rgba(255,255,255,.15)') + '"></span>';
    }).join('');
    situationHtml = '<div style="display:flex;align-items:center;gap:12px;margin-top:10px;padding-top:10px;border-top:0.5px solid ' + ruleColor + '">' +
      basesSvg +
      '<div style="flex:1"><div style="font-size:14px;font-weight:800;color:' + color + '">' + (s.balls != null ? s.balls : '-') + '–' + (s.strikes != null ? s.strikes : '-') + '</div>' +
      '<div style="font-size:9px;color:' + subColor + ';text-transform:uppercase;letter-spacing:.04em">Balls–Strikes</div>' +
      '<div style="margin-top:5px">' + outsDots + '</div></div>' +
      '<div style="text-align:right;font-size:12px;font-weight:700;color:#A89FE8">' + (s.half === 'top' ? '▲' : '▼') + ' ' + _escapeHtml(_ordinalSuffix(s.inning)) +
      '<div style="font-size:9px;color:' + subColor + ';font-weight:600;text-transform:uppercase;margin-top:2px">' + (s.half === 'top' ? 'Top' : 'Bottom') + '</div></div>' +
      '</div>';
  } else if (box.situation && (box.situation.down != null || box.situation.possessionText)) {
    var fs = box.situation;
    var downText = fs.downText || _fbDownText(fs.down, fs.distance);
    var teamAbbr = (fs.team && fs.team.abbreviation) || '';
    var teamColor = (fs.team && fs.team.color) || '#E31837';
    // yardLine is assumed 0–100 from the possessing team's own goal line;
    // flip it when the home team has the ball so it still maps correctly
    // left-to-right on a field where home's own goal sits on the right.
    var yardLine = fs.yardLine != null ? fs.yardLine : 50;
    var pct = fs.homeAway === 'home' ? (100 - yardLine) : yardLine;
    var fieldX = 24 + (pct / 100) * (390 - 48);
    var fieldSvg = '<svg width="100%" height="90" viewBox="0 0 390 90" style="display:block">' +
      '<rect width="390" height="90" fill="#1E4230"/>' +
      '<rect x="0" y="0" width="24" height="90" fill="rgba(255,255,255,.12)"/>' +
      '<rect x="366" y="0" width="24" height="90" fill="rgba(255,255,255,.12)"/>' +
      '<g stroke="rgba(255,255,255,.25)" stroke-width="1">' +
      [59.5, 95, 130.5, 166, 201.5, 237, 272.5, 308, 343.5].map(function (x) { return '<line x1="' + x + '" y1="0" x2="' + x + '" y2="90"/>'; }).join('') +
      '</g>' +
      '<g transform="translate(' + fieldX.toFixed(1) + ',45)">' +
      '<circle r="12" fill="' + teamColor + '" stroke="#0D0820" stroke-width="2"/>' +
      '<text x="0" y="3.5" text-anchor="middle" font-size="8" font-weight="800" fill="#fff" font-family="-apple-system,Helvetica,sans-serif">' + _escapeHtml(teamAbbr) + '</text>' +
      '</g></svg>';
    situationHtml = '<div style="margin-top:10px;padding-top:10px;border-top:0.5px solid ' + ruleColor + '">' +
      '<div style="font-size:12.5px;font-weight:700;color:' + color + ';margin-bottom:8px">' + _escapeHtml(downText) +
      (fs.possessionText ? ' at ' + _escapeHtml(fs.possessionText) : '') +
      (teamAbbr ? ' — <span style="color:' + teamColor + '">' + _escapeHtml(teamAbbr) + ' ball</span>' : '') + '</div>' +
      '<div style="border-radius:8px;overflow:hidden">' + fieldSvg + '</div>' +
      '</div>';
  } else if (box.situation && box.situation.sportType) {
    var ls = box.situation;
    situationHtml = '<div style="margin-top:10px;padding-top:10px;border-top:0.5px solid ' + ruleColor + '">' +
      '<div style="font-size:16px;font-weight:800;color:' + color + '">' + _escapeHtml(ls.clock || '') + '</div>' +
      '<div style="font-size:9px;color:' + subColor + ';text-transform:uppercase;letter-spacing:.04em;margin-top:2px">' + _escapeHtml(ls.periodLabel || '') + '</div>' +
      '</div>';
  }

  var matchupHtml = '';
  if (box.matchup && (box.matchup.pitcher || box.matchup.batter)) {
    var mp = box.matchup.pitcher, mb = box.matchup.batter;
    matchupHtml = '<div style="display:flex;align-items:center;gap:10px;margin-top:10px;padding-top:10px;border-top:0.5px solid ' + ruleColor + '">' +
      '<div style="flex:1;min-width:0"><div style="font-size:9px;color:' + subColor + ';text-transform:uppercase;letter-spacing:.04em">Pitching</div>' +
      '<div style="font-size:13px;font-weight:700;color:' + color + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _clickablePlayerNameHtml(mp, 'mlb') + '</div>' +
      (mp && mp.line ? '<div style="font-size:10.5px;color:#CECBF6;margin-top:1px">' + _escapeHtml(mp.line) + '</div>' : '') + '</div>' +
      '<div style="font-size:10px;color:' + subColor + ';font-weight:700;flex-shrink:0">VS</div>' +
      '<div style="flex:1;min-width:0;text-align:right"><div style="font-size:9px;color:' + subColor + ';text-transform:uppercase;letter-spacing:.04em">At bat</div>' +
      '<div style="font-size:13px;font-weight:700;color:' + color + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _clickablePlayerNameHtml(mb, 'mlb') + '</div>' +
      (mb && mb.line ? '<div style="font-size:10.5px;color:#CECBF6;margin-top:1px">' + _escapeHtml(mb.line) + '</div>' : '') + '</div>' +
      '</div>';
  }

  if (heroLive) situationHtml = '';
  if (heroFinal) { decisionLine = ''; hrLines = ''; }
  var strikeZoneHtml = _strikeZoneSectionHtml(box.pitchSequence, ruleColor, subColor, color);
  // On the game screen (opts.hero) the full box score has its own Box tab (v7.5.0); memories still show it here
  var boxScoreDetailHtml = opts.hero ? '' : _boxScoreDetailSectionHtml(box.boxScoreDetail, box.away, box.home, ruleColor, subColor, color);

  var playsHtml = '';
  var playIdsForReactions = [];
  if (box.recentPlays && box.recentPlays.length) {
    playsHtml = '<div style="margin-top:10px;padding-top:10px;border-top:0.5px solid ' + ruleColor + '">' +
      box.recentPlays.map(function (p, idx) {
        var tag = p.tag != null ? p.tag : ((p.half === 'top' ? 'T' : 'B') + (p.inning || ''));
        var tagWidth = p.tag != null ? '48px' : '24px';
        var replyBtn = allowPlayReply
          ? '<span data-tag="' + _escapeHtml(tag) + '" data-text="' + _escapeHtml(p.text) + '" onclick="event.stopPropagation();_replyToPlay(this.dataset.tag,this.dataset.text)" title="Reply to this play" style="flex-shrink:0;color:' + subColor + ';font-size:13px;cursor:pointer;padding:0 2px">↩</span>'
          : '';
        // Stable per-play key for reactions: atBatIndex (baseball) or
        // playId (football, from ESPN's own play id) when present —
        // both are real fields on the source data, not invented here —
        // falling back to the array position so reactions still work
        // (just less precisely stable across refreshes) on any sport
        // that has neither.
        var idPart = p.atBatIndex != null ? p.atBatIndex : (p.playId != null ? p.playId : ('idx' + idx));
        var playId = (allowPlayReply && box.gamePk != null) ? (box.gamePk + '_' + idPart) : null;
        if (playId) playIdsForReactions.push(playId);
        var reactBadges = playId ? '<div id="play-react-' + _escapeHtml(playId) + '" style="margin-left:57px"></div>' : '';
        var rowAttrs = playId ? ' onclick="_playDoubleTap(this,\'' + playId + '\',this.dataset.rtag,this.dataset.rtext)" data-rtag="' + _escapeHtml(tag) + '" data-rtext="' + _escapeHtml(p.text) + '" style="cursor:pointer"' : '';
        return '<div' + rowAttrs + '>' +
          '<div style="display:flex;gap:9px;align-items:flex-start;margin-bottom:2px"><div style="flex-shrink:0;width:' + tagWidth + ';font-size:9px;font-weight:800;color:' + subColor + '">' + _escapeHtml(tag) + '</div>' +
          '<div style="flex:1;font-size:11.5px;color:' + color + ';line-height:1.5">' + _escapeHtml(p.text) + '</div>' + replyBtn + '</div>' +
          (allowPlayReply && typeof _ruleChipHtml === 'function' ? (function (c) { return c ? '<div style="margin-left:' + (parseInt(tagWidth, 10) + 9) + 'px">' + c + '</div>' : ''; })(_ruleChipHtml(box.sport || (window._activeBrowseGame && window._activeBrowseGame.sport) || 'mlb', p.text)) : '') +
          reactBadges + '<div style="margin-bottom:5px"></div>' +
          '</div>';
      }).join('') + '</div>';
  }
  // Final MLB on the game screen: same inning-grouped list the live card
  // uses, so the play-by-play reads the same way before and after the
  // last out. Its rows carry their own reaction ids, so the flat list's
  // are dropped rather than fetched for elements that no longer exist.
  if (heroFinal && typeof _ghPlaysByInningHtml === 'function') {
    var groupedPlays = _ghPlaysByInningHtml(box, true);
    if (groupedPlays) { playsHtml = groupedPlays; playIdsForReactions = []; }
  }

  // Reaction badges need an async Firestore read, but this function
  // returns a plain HTML string the caller injects synchronously right
  // after — deferring one tick lets that injection happen first, so the
  // #play-react-<id> containers this fetch targets actually exist in
  // the DOM by the time it resolves.
  if (playIdsForReactions.length) {
    setTimeout(function () { _loadPlayReactions(playIdsForReactions); }, 0);
  }

  // v5.74.0: on the game screen this card uses the same card style as the
  // live cards (no lighter panel once the game goes final).
  return (opts.hero ? '<div class="gh-card">' : '<div style="background:' + bg + ';border:' + border + ';border-radius:14px;padding:12px 14px">') +
    (opts.hero ? '<div style="font-size:12px;font-weight:700;color:' + color + ';margin-bottom:8px">' + (heroFinal ? 'Plays & box score' : 'Pitch by pitch') + '</div>' :
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px">' +
      '<div style="font-size:13px;font-weight:700;color:' + color + '">' + _escapeHtml(box.away || '') + ' ' + (box.awayScore != null ? box.awayScore : '') + ' – ' + (box.homeScore != null ? box.homeScore : '') + ' ' + _escapeHtml(box.home || '') + '</div>' +
      '<div style="font-size:10px;color:' + subColor + ';text-transform:uppercase;letter-spacing:0.05em;flex-shrink:0">' + _escapeHtml(box.status || 'Final') + '</div>' +
    '</div>') +
    (innings.length && !heroFinal ? '<div style="display:flex;margin-bottom:2px">' + periodHeader + '</div><div style="display:flex;margin-bottom:2px">' + awayRow + '</div><div style="display:flex;margin-bottom:6px">' + homeRow + '</div>' : '') +
    strikeZoneHtml +
    situationHtml +
    matchupHtml +
    playsHtml +
    boxScoreDetailHtml +
    (box.venue ? '<div style="font-size:11px;color:' + subColor + ';margin-top:10px">' + _escapeHtml(box.venue) + '</div>' : '') +
    decisionLine +
    hrLines +
    highlightLines +
  '</div>';
}

function selectRemember(el, name) {
  document.querySelectorAll('[id^="remember-"]').forEach(function(b) {
    b.style.background = 'rgba(61,53,128,0.08)';
  });
  el.style.background = '#3D3580';
}

var _savingMoment = false;
function saveNewMoment() {
  if (_savingMoment) return;
  var nameEl = document.getElementById('moment-name');
  var momentName = nameEl && nameEl.value.trim() ? nameEl.value.trim() : 'Untitled moment';
  var dateEl = document.getElementById('moment-date');
  var momentDate = dateEl && dateEl.value ? dateEl.value : _todayLocal();
  var today = _todayLocal();
  if (momentDate > today) {
    var proceed = window.confirm('That date is in the future. Memories are for things that already happened — did you mean to use "It\'s coming up" instead, so you can invite people and collect RSVPs?\n\nTap OK to save it as a memory anyway, or Cancel to go back.');
    if (!proceed) return;
  }
  var highlightEl = document.getElementById('highlight-text');
  var highlightText = highlightEl ? highlightEl.value.trim() : '';
  if (!highlightText && window._nowPinLabel) { highlightText = 'at ' + window._nowPinLabel; }
  var rememberEl = document.getElementById('remember-text');
  var dedication = rememberEl ? rememberEl.value.trim() : '';
  var vibe = window._momentVibe || '';
  _persistCustomVibeIfNew(vibe);
  var photo = window._momentPhoto || '';
  var peopleObjs = (window._momentPeople || []).slice();
  var people = peopleObjs.map(function(p){ return p.name; });
  // Keep this the same length and order as `people` — using '' rather than
  // filtering out null uids. A manually-typed person (no account, uid:
  // null) still needs a placeholder here so a real tagged friend later in
  // the list doesn't shift into their slot. Anything reading this elsewhere
  // (People row, avatar stack, friend hub) already skips falsy entries.
  var taggedUids = peopleObjs.map(function(p){ return p.uid || ''; });
  var photos = (window._momentExtraPhotos || []).slice();

  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) {
    if (typeof ib_toast === 'function') ib_toast('Sign in first to save moments');
    return;
  }

  _savingMoment = true;
  if (typeof ib_toast === 'function') ib_toast('Saving…');

  try {
    window.db.collection('users').doc(user.uid).collection('moments').add({
      name: momentName,
      date: momentDate,
      vibe: vibe,
      highlight: highlightText,
      dedication: dedication,
      photo: photo,
      photos: photos,
      people: people,
      taggedUids: taggedUids,
      boxScore: _sanitizeForFirestore(window._momentBoxScore),
      stub: window._stubMode ? _sanitizeForFirestore(Object.assign({ kind: window._stubMode }, window._stubData || {})) : null, // v7.1.0
      comments: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function(ref) {
      _savingMoment = false;
      if (taggedUids.length) {
        var ownerName = (window.userData && window.userData.name) || 'Someone';
        Promise.all(taggedUids.map(function(uid){
          return window.db.collection('notifications').add({
            toUid: uid,
            type: 'tagged',
            fromUid: user.uid,
            fromName: ownerName,
            momentOwnerUid: user.uid,
            momentId: ref.id,
            momentName: momentName,
            ts: Date.now(),
            read: false
          });
        })).catch(function(err){ console.error('Tag notification error:', err); });
      }
      resetMomentForm();
      if (typeof ib_toast === 'function') ib_toast('Moment saved');
      nav('memories');
    }).catch(function(err) {
      _savingMoment = false;
      console.error('Save moment error:', err);
      if (typeof ib_toast === 'function') ib_toast('Could not save — ' + (err && err.message ? err.message : 'try again'));
    });
  } catch (err) {
    _savingMoment = false;
    console.error('Save moment threw synchronously:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not save — ' + (err && err.message ? err.message : 'try again'));
  }
}

function resetMomentForm() {
  var nameEl = document.getElementById('moment-name'); if (nameEl) nameEl.value = '';
  var hlEl = document.getElementById('highlight-text'); if (hlEl) hlEl.value = '';
  var remEl = document.getElementById('remember-text'); if (remEl) remEl.value = '';
  var dateEl = document.getElementById('moment-date'); if (dateEl) dateEl.value = _todayLocal();
  _resetMainPhotoPreviewUI();
  var extraPrev = document.getElementById('moment-photo-preview');
  if (extraPrev) extraPrev.innerHTML = '';
  window._momentPhoto = '';
  window._momentVibe = '';
  var vibeEmojiEl = document.getElementById('vibe-emoji-input'); if (vibeEmojiEl) vibeEmojiEl.value = '';
  var vibeNameEl = document.getElementById('vibe-name-input'); if (vibeNameEl) vibeNameEl.value = '';
  window._momentPeople = [];
  window._momentExtraPhotos = [];
  window._nowPinLabel = '';
  window._nowGamePk = null;
  window._nowGame = null;
  window._nowCoords = null;
  if (typeof momentBoxScoreClear === 'function') momentBoxScoreClear();
  if (typeof renderVibePills === 'function') renderVibePills();
  if (typeof renderMomentPeople === 'function') renderMomentPeople();
  if (typeof backToStep0 === 'function') backToStep0();
}
