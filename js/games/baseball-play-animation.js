// ══ PLAY ANIMATION IN THE AT-BAT SQUARE (v5.70.0, slowed + fielders in v5.71.0) ═════════════════════
// When a new play finishes in a live MLB game, the at-bat square shows
// the last pitch coming in, then swaps to an overhead field: where the
// ball went, who fielded it, the throws, runners moving, outs, and the
// play at the top ("DOUBLE PLAY" / "6-4-3 · Inning over"). Plays with
// no ball in play (strikeout, walk) stay on the pitch view.
// Everything is timed from when the play started, so the cheat sheet
// re-rendering every 15 seconds picks the animation up where it was.
var PA = { SW: 2.4, T0: 3.4, END: 14, THROW: .6, LEG: .7 };
window._pa = { gamePk: null, seen: null, startAt: 0, play: null, box: null };
var PA_H = [250, 366], PA_B = { '1B': [330, 286], '2B': [250, 206], '3B': [170, 286], 'score': [250, 366], 'HM': [250, 366], '4B': [250, 366] };
// v7.8.7: base code → words for play text. MLB reports home as '4B' (or 'HM'/'score'); base 4 reads as "home".
function _paBaseLabel(b) {
  var k = String(b == null ? '' : b);
  if (k === 'score' || k === 'HM' || k === 'H' || /^(4B|[4-9])$/.test(k)) return 'home';
  return { '1B': '1st', '2B': '2nd', '3B': '3rd', '1': '1st', '2': '2nd', '3': '3rd' }[k] || k;
}
var PA_F = { '1': [250, 290], '2': [250, 378], '3': [312, 262], '4': [288, 222], '5': [188, 262], '6': [212, 222], '7': [128, 160], '8': [250, 128], '9': [372, 160] };
var PA_POS = { '1': 'P', '2': 'C', '3': '1B', '4': '2B', '5': '3B', '6': 'SS', '7': 'LF', '8': 'CF', '9': 'RF' };

// Remember each new play as the box score refreshes; only plays that
// finish while you're watching animate (opening a game doesn't replay
// whatever happened last).
function _paNote(box) {
  var lp = box && box.lastPlay, g = window._activeBrowseGame, s = window._pa;
  var pk = g ? String(g.gamePk) : null;
  s.box = box;
  // v5.97.0: a steal / wild pitch / pickoff… logged since the last refresh
  var ps = box && box.pitchSequence, firstLoad = s.gamePk !== pk;
  // v7.20.3: a different game — forget the last one's play, so a game that
  // hasn't had a play yet doesn't show the previous game's result card
  if (firstLoad) { s.play = null; s.startAt = 0; s.seq = false; s.keep = false; s._labelHtml = ''; s._statsHtml = ''; }
  var A = s.actSeen || (s.actSeen = {}), newest = null;
  ((ps && ps.actions) || []).forEach(function (a) {
    var k = pk + ':' + ps.atBatIndex + ':' + a.index;
    if (A[k]) return;
    A[k] = 1;
    if (!firstLoad) newest = a;
  });
  if (newest) { s.play = Object.assign({ kind: 'action' }, newest, { atBatIndex: ps.atBatIndex + ':a' + newest.index }); s.startAt = Date.now(); s.seq = false; s.keep = false; }
  if (!lp || lp.atBatIndex == null) { if (firstLoad) { s.gamePk = pk; s.seen = null; } return; }
  if (s.gamePk !== pk) { s.gamePk = pk; s.seen = lp.atBatIndex; s.play = lp; s.startAt = 0; return; }
  if (lp.atBatIndex !== s.seen) { var wasNull = s.seen == null; s.seen = lp.atBatIndex; if (!wasNull || !firstLoad) { s.play = lp; s.startAt = Date.now(); s.seq = false; s.keep = false; } }
}
function _paActive() {
  var s = window._pa;
  return !!(s.play && s.startAt && (Date.now() - s.startAt) / 1000 < (s.total || PA.END) + .6);
}
// Replay a play from the play-by-play (tap the row once). Scrolls the
// at-bat square into view and runs that play's animation.
function ghPaReplayPlay(playId, rowEl) {
  var box = (typeof _gcBox === 'function' && _gcBox()) || window._pa.box; // freshest box (final games don't refresh _pa.box)
  if (!box) return;
  var abi = String(playId || '').split('_').pop();
  var list = box.allPlays || [];
  var hit = null;
  list.forEach(function (p) { if (String(p.atBatIndex) === abi && p.anim) { hit = p.anim; if (!hit.desc && p.text) hit.desc = p.text; } });
  if (!hit && box.lastPlay && String(box.lastPlay.atBatIndex) === abi) hit = box.lastPlay;
  if (!hit) { if (typeof ib_toast === 'function') ib_toast('No replay for that play'); return; }
  // v6.2.0: a tapped play always replays right under its row — live or
  // final — and the live at-bat square is left alone. Its count ticks and
  // its pitches list below the box, and it stays up after the animation
  // until Hide (or tapping the same play again).
  if (window._pai && window._pai.playId === String(playId)) { _paiClose(); return; }
  window._pai = { playId: String(playId), play: hit, box: box, startAt: Date.now() };
  _paiMount(rowEl, true);
}
function _paFill() {
  var slot = document.getElementById('gh-pa-slot');
  if (!slot) return;
  var labSlot = document.getElementById('gh-pa-label'), stSlot = document.getElementById('gh-pa-stats');
  window._pa.labelOut = !!(labSlot && !slot.getAttribute('data-inline'));
  slot.innerHTML = _paOverlayHtml();
  if (labSlot) { var labNew = slot.innerHTML ? (window._pa._labelHtml || '') : ''; if (labNew) { _paSoftCancel(labSlot); labSlot.innerHTML = labNew; } else _paSoftClear(labSlot); }
  if (stSlot) {
    if (slot.innerHTML && window._pa._statsHtml) { _paSoftCancel(stSlot); stSlot.innerHTML = window._pa._statsHtml; _bbStatsTick(); }
    else { var keptH = (window._pa.labelOut && typeof _bbKeptStripHtml === 'function') ? _bbKeptStripHtml() : ''; // v7.6.0
      if (keptH) { _paSoftCancel(stSlot); if (stSlot.innerHTML !== keptH) stSlot.innerHTML = keptH; } else _paSoftClear(stSlot); } // v7.8.1: fold away, don't snap
  }
  var s0 = window._pa;
  slot.setAttribute('data-pa', s0.play && s0.startAt ? s0.play.atBatIndex + ':' + s0.startAt : '');
  // v7.19.1: when the result card sweeps in, the play label (top left) and
  // the ABS note (bottom right) fade so nothing sits on top of it
  var pf = slot.parentNode, card = slot.querySelector('.pak') || slot.querySelector('.pah'); // v7.21.0: a strikeout's K comes first
  clearTimeout(window._pahOnT);
  if (pf && pf.classList) {
    pf.classList.remove('pah-on');
    if (card) {
      var t0 = parseFloat((card.style.getPropertyValue('--t0') || '0').replace('s', '')) || 0;
      if (t0 <= 0) pf.classList.add('pah-on');
      else window._pahOnT = setTimeout(function () { if (pf.isConnected && pf.querySelector('#gh-pa-slot .pah, #gh-pa-slot .pak')) pf.classList.add('pah-on'); }, t0 * 1000); // v7.19.2: mid-run the card sits inside .pa, a level deeper than when held
    }
  }
  // v7.21.0: aim the strikeout's K at the card's "K today" tile
  // (the tile, not the K in its corner: that one is still scaled to nothing)
  var kb = slot.querySelector('.pak-k .kbig'), kt = slot.querySelector('.pah .tile.tk');
  if (kb && kt) {
    var ra = kb.getBoundingClientRect(), rb = kt.getBoundingClientRect();
    if (ra.width && rb.width) { kb.style.setProperty('--kdx', Math.round(rb.right - 17 - ra.left - ra.width / 2) + 'px'); kb.style.setProperty('--kdy', Math.round(rb.top + 17 - 8 - ra.top - ra.height / 2) + 'px'); }
  }
  clearTimeout(window._paEndT);
  if (_paActive()) {
    // One full run, then hand the square back and catch up on any
    // refresh that waited (see the render hook below).
    window._paEndT = setTimeout(function () {
      var sl = document.getElementById('gh-pa-slot'); if (sl && !window._pa.keep) { var s9 = window._pa; sl.innerHTML = (typeof _patHoldOn === 'function' && _patHoldOn(s9.play, s9.box, s9)) ? _patHeldHtml(s9.play, s9.box) : ''; /* v7.19.0: the result card holds */ var lb = document.getElementById('gh-pa-label'); if (lb) _paSoftClear(lb); var st2 = document.getElementById('gh-pa-stats'); if (st2) { var s1 = window._pa; if (s1 && s1.labelOut && s1._statsHtml && s1.play) { var g1 = window._activeBrowseGame; window._bbKeep = { lp: s1.play, since: s1.startAt, pk: g1 ? String(g1.gamePk) : '' }; } var k2 = (typeof _bbKeptStripHtml === 'function') ? _bbKeptStripHtml() : ''; if (k2) st2.innerHTML = k2; else _paSoftClear(st2); } }
      if (window._paDeferred) { window._paDeferred = false; renderGameCheatSheet(); }
    }, Math.max(0, ((window._pa.total || PA.END) + .6) * 1000 - (Date.now() - window._pa.startAt)));
  }
}
// v7.8.1: the label above the square and the stats strip under it fold
// shut when their moment ends instead of vanishing (which snapped
// everything below them upward).
function _paSoftClear(node) {
  if (!node) return;
  if (!node.firstChild || node._softT) { if (!node._softT) node.innerHTML = ''; return; }
  if (typeof _ghReducedMotion === 'function' && _ghReducedMotion()) { node.innerHTML = ''; return; }
  node.style.overflow = 'hidden'; node.style.height = node.offsetHeight + 'px';
  void node.offsetHeight;
  node.style.transition = 'height .36s cubic-bezier(.22,1,.36,1), opacity .22s ease';
  node.style.height = '0px'; node.style.opacity = '0';
  node._softT = setTimeout(function () { node._softT = null; node.innerHTML = ''; node.style.height = ''; node.style.overflow = ''; node.style.opacity = ''; node.style.transition = ''; }, 380);
}
function _paSoftCancel(node) {
  if (!node || !node._softT) return;
  clearTimeout(node._softT); node._softT = null;
  node.style.height = ''; node.style.overflow = ''; node.style.opacity = ''; node.style.transition = '';
}
function _paSec(t, E) { return (t - E).toFixed(2) + 's'; }
function _paPath(pts) { return 'M ' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L '); }
function _paOff(o, pts) { return 'M ' + pts.map(function (p) { return (p[0] - o[0]).toFixed(1) + ' ' + (p[1] - o[1]).toFixed(1); }).join(' L '); }
function _paRel(pts) { var o = pts[0]; return 'M 0 0 L ' + pts.slice(1).map(function (p) { return (p[0] - o[0]).toFixed(1) + ' ' + (p[1] - o[1]).toFixed(1); }).join(' L '); }
function _paBasesBetween(start, end) {
  var order = ['H', '1B', '2B', '3B', 'HM'];
  var a = order.indexOf(start || 'H'), b = order.indexOf(end === 'score' || end === '4B' ? 'HM' : end);
  if (a < 0) a = 0;
  if (b < 0 || b < a) return [];
  var out = [];
  for (var i = a; i <= b; i++) out.push(order[i] === 'H' || order[i] === 'HM' ? PA_H : PA_B[order[i]]);
  return out;
}
// Gameday hit coordinates → a spot on the drawing. Home is ~(125.4,198.3)
// in Gameday units (~2.5 ft each); the drawing's wall sits ~270 units out.
// v5.80.0: where the ball ends up on the drawing.
//  · Direction from Gameday's hit coordinates; hits are always drawn fair
//    (a ball can land a hair outside the drawn line from rounding).
//  · Distance scaled against a real fence (330 ft down the lines, 400 to
//    center) so the drawn wall means the real wall: home runs always land
//    beyond it, everything else stays inside it.
//  · Distance comes from where the ball was fielded (coordinates), not
//    Statcast's "hit distance" — for a grounder that's only where it
//    first bounced, which is why singles through the hole looked like
//    infield hits. A hit the play text sends to an outfielder is never
//    left on the infield.
function _paWallR(deg) {
  var best = 270, bd = 1e9;
  for (var i = 0; i <= 80; i++) {
    var t = i / 80, x = (1 - t) * (1 - t) * 58 + 2 * (1 - t) * t * 250 + t * t * 442, y = (1 - t) * (1 - t) * 174 + 2 * (1 - t) * t * 20 + t * t * 174;
    var a = Math.atan2(x - PA_H[0], PA_H[1] - y) * 180 / Math.PI;
    if (Math.abs(a - deg) < bd) { bd = Math.abs(a - deg); best = Math.hypot(x - PA_H[0], y - PA_H[1]); }
  }
  return best;
}
function _paLanding(lp) {
  var h = lp.hit;
  if (!h || h.x == null || h.y == null) return null;
  var t = lp.eventType || '';
  var dx = h.x - 125.42, dy = 198.27 - h.y;
  var deg = Math.atan2(dx, dy) * 180 / Math.PI;
  var fairForSure = /^(single|double|triple|home_run|field_error)$/.test(t);
  if (fairForSure) deg = Math.max(-43, Math.min(43, deg));
  var coordFt = Math.sqrt(dx * dx + dy * dy) * 2.5;
  var feet = t === 'home_run' ? (h.distance || coordFt) : coordFt;
  var fence = 330 + 70 * Math.cos(2 * deg * Math.PI / 180);
  var wallR = _paWallR(deg);
  var r = feet / fence * wallR;
  if (t === 'home_run') r = Math.max(r, wallR + 22);
  else r = Math.min(r, wallR - 10);
  var desc = String(lp.description || lp.desc || '');
  if (/^(single|double|triple|field_error)$/.test(t) && /(left|center|right) fielder/i.test(desc) && r < 190) r = 190;
  var rad = deg * Math.PI / 180;
  return { x: PA_H[0] + r * Math.sin(rad), y: PA_H[1] - r * Math.cos(rad), ang: deg, feet: Math.round(feet) };
}
function _paDir(deg) {
  if (deg < -30) return 'left'; if (deg < -12) return 'left-center'; if (deg <= 12) return 'center'; if (deg <= 30) return 'right-center'; return 'right';
}
function _paTitle(lp) {
  var t = lp.eventType || '', tr = (lp.hit && lp.hit.trajectory) || '';
  var map = { single: 'SINGLE', double: 'DOUBLE', triple: 'TRIPLE', home_run: 'HOME RUN', strikeout: 'STRIKEOUT', strikeout_double_play: 'STRIKEOUT DOUBLE PLAY', walk: 'WALK', intent_walk: 'INTENTIONAL WALK', hit_by_pitch: 'HIT BY PITCH',
    grounded_into_double_play: 'DOUBLE PLAY', double_play: 'DOUBLE PLAY', triple_play: 'TRIPLE PLAY', force_out: 'FORCE OUT', fielders_choice: 'FIELDER\u2019S CHOICE', fielders_choice_out: 'FIELDER\u2019S CHOICE',
    sac_fly: 'SAC FLY', sac_bunt: 'SAC BUNT', field_error: 'ERROR', catcher_interf: 'CATCHER\u2019S INTERFERENCE' };
  if (t === 'field_out') return tr === 'fly_ball' ? 'FLY OUT' : tr === 'line_drive' ? 'LINE OUT' : tr === 'popup' ? 'POP OUT' : 'GROUND OUT';
  return map[t] || String(lp.event || 'PLAY').toUpperCase();
}
// v7.14.1: "7th K today" on a strikeout; a reliever's also carries his
// team's total. Counted from the game's plays up to this one when they're
// all here (so a replay shows the count at the time), else the box score.
function _paKCountText(lp, box) {
  var c = _paKCount(lp, box);
  if (!c) return '';
  var ord = function (n) { var t = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (t[(v - 20) % 10] || t[v] || t[0]); };
  var txt = ord(c.mine) + ' K today';
  if (c.reliever && c.team) txt += ' \u00b7 ' + c.abbr + ' ' + c.team + ' K';
  return txt;
}
// v7.20.2: the numbers behind it — the pitcher's strikeouts today (this one
// included) and, for a reliever, his team's
function _paKCount(lp, box) {
  if (!lp || !box || !lp.pitcherId) return null;
  var side = lp.half === 'top' ? 'home' : lp.half === 'bottom' ? 'away' : null;
  var isK = function (t) { return /^strikeout/.test(t || ''); };
  var mine = null, team = null, starter = null;
  var plays = (box.allPlays || []).map(function (p) { return p.anim || p; }).filter(function (a) { return a && a.atBatIndex != null && a.pitcherId; });
  if (plays.length && lp.atBatIndex != null && side) {
    var upTo = plays.filter(function (a) { return a.half === lp.half && a.atBatIndex <= lp.atBatIndex; });
    if (upTo.length) {
      starter = upTo.slice().sort(function (a, b) { return a.atBatIndex - b.atBatIndex; })[0].pitcherId;
      mine = upTo.filter(function (a) { return isK(a.eventType) && String(a.pitcherId) === String(lp.pitcherId); }).length;
      team = upTo.filter(function (a) { return isK(a.eventType); }).length;
      if (!upTo.some(function (a) { return a.atBatIndex === lp.atBatIndex; })) { mine++; team++; }
    }
  }
  if (mine == null) {
    var d = side && box.boxScoreDetail && box.boxScoreDetail[side], list = (d && d.pitchers) || [];
    var ix = -1; list.forEach(function (x, i) { if (String(x.id) === String(lp.pitcherId)) ix = i; });
    if (ix < 0) return null;
    mine = Number(list[ix].so) || 0; starter = list[0].id;
    team = list.reduce(function (a, x) { return a + (Number(x.so) || 0); }, 0);
  }
  if (!mine) return null;
  var ab = side === 'home' ? (box.homeAbbr || _ghAbbrFallback(box.home)) : (box.awayAbbr || _ghAbbrFallback(box.away));
  return { mine: mine, team: team, reliever: String(starter) !== String(lp.pitcherId), abbr: ab };
}
function _paNote2(lp, box, land) {
  var t = lp.eventType || '', tr = (lp.hit && lp.hit.trajectory) || '';
  var f = lp.fielders || [];
  var bits = [];
  var outsNote = lp.outs === 3 ? 'Inning over' : null;
  var aA = box.awayAbbr || _ghAbbrFallback(box.away), hA = box.homeAbbr || _ghAbbrFallback(box.home);
  var scoreNote = (lp.rbi || 0) > 0 && lp.awayScore != null ? (lp.rbi + ' RBI · ' + (lp.awayScore >= lp.homeScore ? aA + ' ' + lp.awayScore + '–' + lp.homeScore : hA + ' ' + lp.homeScore + '–' + lp.awayScore)) : null;
  var trWord = { ground_ball: 'Ground ball', line_drive: 'Line drive', fly_ball: 'Fly ball', popup: 'Pop up', bunt_grounder: 'Bunt', bunt_popup: 'Bunt' }[tr];
  if (t === 'strikeout' || t === 'strikeout_double_play') {
    var last = (lp.pitches || [])[lp.pitches.length - 1];
    bits.push(last && /called/i.test(last.call || '') ? '\u24C0K looking' : 'K swinging'); // marker → mirrored K when drawn
    if (lp.droppedK === 'out') bits.push('Dropped third strike' + (f.length > 1 ? ' \u00b7 ' + f.join('-') : ''));
    else if (lp.droppedK === 'safe') bits.push('Reached on dropped third strike');
    var kn = _paKCountText(lp, box); // v7.14.1
    if (kn) bits.push(kn);
  } else if (t === 'walk' || t === 'intent_walk') bits.push(t === 'intent_walk' ? 'IBB' : 'BB');
  else if (t === 'home_run') { if (land) bits.push('To ' + _paDir(land.ang)); if (lp.hit && lp.hit.distance) bits.push(lp.hit.distance + ' ft'); }
  else if (t === 'single' && _paInfieldHitPos(lp)) { bits.push('Infield single to ' + ({ '1': 'the pitcher', '2': 'the catcher', '3': 'first', '4': 'second', '5': 'third', '6': 'short' })[_paInfieldHitPos(lp)] + ' · beat the throw'); }
  else if (t === 'single' || t === 'double' || t === 'triple') { if (land) bits.push((trWord || 'To') + (trWord ? ' to ' : ' ') + _paDir(land.ang)); }
  if (/^(single|double|triple)$/.test(t)) {
    (lp.runners || []).forEach(function (r) {
      if (r.out && r.outBase) bits.push((r.batter ? 'Batter' : 'Runner') + ' out at ' + _paBaseLabel(r.outBase) + (f.length > 1 ? ' (' + f.join('-') + ')' : ''));
    });
  }
  else if (t === 'field_out') {
    var pre = tr === 'fly_ball' ? 'F' : tr === 'line_drive' ? 'L' : tr === 'popup' ? 'P' : '';
    if (f.length) bits.push(pre && f.length === 1 ? pre + f[0] : f.join('-'));
  } else if (t === 'field_error') { if (lp.errorPos) bits.push('E' + lp.errorPos); }
  else if (f.length > 1) bits.push(f.join('-'));
  if (scoreNote) bits.push(scoreNote);
  if (outsNote) bits.push(outsNote);
  return bits.join(' · ');
}
function _paWallSeg(deg) {
  // Wall: M 58 174 Q 250 20 442 174 — pick the stretch nearest the ball's angle.
  var best = 0, bd = 1e9;
  var pt = function (t) { return [(1 - t) * (1 - t) * 58 + 2 * (1 - t) * t * 250 + t * t * 442, (1 - t) * (1 - t) * 174 + 2 * (1 - t) * t * 20 + t * t * 174]; };
  for (var i = 0; i <= 40; i++) {
    var p = pt(i / 40), a = Math.atan2(p[0] - PA_H[0], PA_H[1] - p[1]) * 180 / Math.PI;
    if (Math.abs(a - deg) < bd) { bd = Math.abs(a - deg); best = i / 40; }
  }
  var pts = [];
  for (var k = -6; k <= 6; k++) pts.push(pt(Math.max(0, Math.min(1, best + k * 0.012))));
  return _paPath(pts);
}

// ══ PITCH FLIGHT (v5.88.0) ════════════════════════════════════════════
// A pitch leaves a release point far off in the background (where the
// pitcher would be — his arm side, from the pitcher's hand), grows as it
// comes in along a path shaped by the pitch type (fastballs ride, sinkers
// and changeups fade, sliders sweep, curves drop), then lands as the
// numbered dot where it crossed the zone, with a quick ring.
function _pitchFlightSvg(p, t, E, hand, style) {
  var X = _szX(p.px), Y = _szY(p.pz), c = _pitchCallColor(p.call);
  var glove = hand === 'L' ? -1 : 1;                 // glove side, in screen x
  var R = [250 - glove * 16, 92];                    // release: arm side, up and far away
  var M = [(R[0] + X) / 2, (R[1] + Y) / 2];
  var code = String(p.code || '').toUpperCase(), off = [0, -12];
  if (/^(FF|FA)$/.test(code)) off = [0, -8];
  else if (/^(SI|FT)$/.test(code)) off = [glove * 20, -14];
  else if (/^(CH|FS|FO|SC)$/.test(code)) off = [glove * 14, -22];
  else if (/^(ST|SV)$/.test(code)) off = [-glove * 34, -10];
  else if (/^(SL|FC)$/.test(code)) off = [-glove * 22, -10];
  else if (/^(CU|KC|CS)$/.test(code)) off = [-glove * 10, -46];
  var C = [M[0] + off[0], M[1] + off[1]];
  var f = function (n) { return n.toFixed(1); };
  var d = 'M ' + f(R[0]) + ' ' + f(R[1]) + ' Q ' + f(C[0]) + ' ' + f(C[1]) + ' ' + f(X) + ' ' + f(Y);
  var rel = 'M 0 0 Q ' + f(C[0] - R[0]) + ' ' + f(C[1] - R[1]) + ' ' + f(X - R[0]) + ' ' + f(Y - R[1]);
  var TRAVEL = .6, sec = function (x) { return _paSec(x, E); };
  var live = style === 'live', big = style === 'last';
  var r = live ? 10.5 : (big ? 11 : 10.5);
  var dot = live
    ? '<circle cx="' + f(X) + '" cy="' + f(Y) + '" r="10.5" fill="' + c + '" stroke="#0D0820" stroke-width="1.2"/><text x="' + f(X) + '" y="' + f(Y + 4.2) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#0D0820" font-family="-apple-system,sans-serif">' + p.num + '</text>'
    : '<circle cx="' + f(X) + '" cy="' + f(Y) + '" r="' + r + '" fill="' + c + '" stroke="' + (big ? 'rgba(255,255,255,.35)' : '#0D0820') + '" stroke-width="' + (big ? 2.5 : 1.2) + '"/><text x="' + f(X) + '" y="' + f(Y + 4.2) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#0D0820">' + p.num + '</text>';
  return '<path d="' + d + '" pathLength="100" stroke-dasharray="100" fill="none" stroke="#FFFFFF" stroke-opacity=".35" stroke-width="2" stroke-linecap="round" style="animation:paDraw ' + TRAVEL + 's linear ' + sec(t) + ' both,paOut .5s linear ' + sec(t + TRAVEL + .35) + ' forwards"/>' +
    '<circle cx="' + f(R[0]) + '" cy="' + f(R[1]) + '" r="2.5" fill="#FFFFFF" style="filter:drop-shadow(0 0 4px #fff);animation:paIn .08s linear ' + sec(t) + ' both,paOut .12s linear ' + sec(t + TRAVEL) + ' forwards">' +
      '<animateMotion dur="' + TRAVEL + 's" begin="' + sec(t) + '" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".45 0 .9 .6" path="' + rel + '"/>' +
      '<animate attributeName="r" values="2.5;' + (r - 2) + '" dur="' + TRAVEL + 's" begin="' + sec(t) + '" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".6 0 1 1"/></circle>' +
    '<g style="transform-box:fill-box;transform-origin:center;animation:paPop .35s ease-out ' + sec(t + TRAVEL - .04) + ' both">' + dot + '</g>' +
    '<circle cx="' + f(X) + '" cy="' + f(Y) + '" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="3" style="opacity:0;transform-box:fill-box;transform-origin:center;animation:paRing .6s ease-out ' + sec(t + TRAVEL) + ' forwards"/>';
}
// Live: animate a pitch only when it's new since the last refresh (not on
// first load), and carry on from the same point if the card re-renders.
window._lpa = window._lpa || { seen: null, startAt: 0, game: null };
function _livePitchAnimE(seq) {
  var g = window._activeBrowseGame, A = window._lpa;
  var last = seq && seq.pitches && seq.pitches[seq.pitches.length - 1];
  if (!last || (typeof _ghReducedMotion === 'function' && _ghReducedMotion())) return null;
  var key = (seq.atBatIndex != null ? seq.atBatIndex : seq.batter) + ':' + last.num;
  var gk = g ? String(g.gamePk) : '';
  if (A.game !== gk) { A.game = gk; A.seen = key; A.startAt = 0; return null; }
  if (A.seen !== key) { A.seen = key; A.startAt = Date.now(); }
  if (!A.startAt) return null;
  var E = (Date.now() - A.startAt) / 1000;
  return E < 1.6 ? E : null;
}

// ══ BETWEEN-PITCH PLAYS (v5.97.0) ══════════════════════════════════════
// Steals, caught stealing, wild pitches, passed balls, pickoffs (and
// attempts), balks, defensive indifference and throwing errors on those
// throws. MLB logs each one inside the at-bat as it happens; each gets a
// short (~5s) scene in the at-bat square, then the zone comes back.
var PA_ACT_RE = /^(stolen_base|caught_stealing|pickoff|wild_pitch|passed_ball|balk|defensive_indiff|other_advance)/;
function _paIsAction(lp) { return lp && (lp.kind === 'action' || (!lp.hit && PA_ACT_RE.test(lp.eventType || ''))); }
function _paActionTitle(et) {
  if (/^stolen_base/.test(et)) return 'STOLEN BASE';
  if (/caught_stealing/.test(et)) return /^pickoff/.test(et) ? 'PICKED OFF' : 'CAUGHT STEALING';
  if (/^pickoff_error/.test(et)) return 'PICKOFF ERROR';
  if (/^pickoff_attempt/.test(et)) return 'PICKOFF ATTEMPT';
  if (/^pickoff/.test(et)) return 'PICKED OFF';
  if (et === 'wild_pitch') return 'WILD PITCH';
  if (et === 'passed_ball') return 'PASSED BALL';
  if (et === 'balk') return 'BALK';
  if (et === 'defensive_indiff') return 'DEFENSIVE INDIFFERENCE';
  if (/error/.test(et)) return 'THROWING ERROR';
  return 'RUNNER ADVANCES';
}
function _paActionHtml(a, s, box) {
  var reduce = typeof _ghReducedMotion === 'function' && _ghReducedMotion();
  var E = (Date.now() - s.startAt) / 1000;
  if (reduce) E = 30;
  var END = 5.4;
  s.total = END;
  if (s.keep) E = Math.min(E, END - .01);
  else if (E > END + .6) return '';
  var et = a.eventType || '', desc = String(a.description || '');
  var err = /error/.test(et) || /throwing error|fielding error/i.test(desc);
  var isSB = /^stolen_base/.test(et), isCS = /caught_stealing/.test(et), isPOA = /^pickoff_attempt/.test(et);
  var isPO = /^pickoff/.test(et) && !isPOA, isWP = et === 'wild_pitch' || et === 'passed_ball', isBK = et === 'balk', isDI = et === 'defensive_indiff';
  var runners = (a.runners || []).filter(function (r) { return r.start || r.end; });
  if (!runners.length && /^pickoff/.test(et) && a.base) runners = [{ start: a.base, end: a.base }]; // attempt: the runner dives back
  var lead = runners.slice().sort(function (x, y) { var o = { '3B': 3, '2B': 2, '1B': 1 }; return (o[y.start] || 0) - (o[x.start] || 0); })[0] || null;
  var T = .35, sec = function (x) { return _paSec(x, E); };
  // bases before it happened: movers' starts + anyone who stayed put
  var occ = {}, now = (box && box.pitchSequence && box.pitchSequence.bases) || {};
  runners.forEach(function (r) { if (r.start) occ[r.start] = 1; });
  var endsNow = {}; runners.forEach(function (r) { if (r.end && r.end !== 'score') endsNow[r.end] = 1; });
  ['1B', '2B', '3B'].forEach(function (b) { if (now[b] && !endsNow[b]) occ[b] = 1; });
  var P = [250, 290], C = [250, 378];
  var g = '<svg viewBox="0 0 500 386" width="100%" height="220" style="display:block">' +
    '<rect x="0" y="0" width="500" height="386" fill="#120E2B"/>' +
    (typeof _bbParkSvg === 'function' ? _bbParkSvg(box) : '<path d="M 58 174 Q 250 20 442 174 L 250 366 Z" fill="#12402A" fill-opacity=".45"/><path d="M 250 366 L 330 286 L 250 206 L 170 286 Z" fill="#6B4A2A" fill-opacity=".35"/>') +
    '<g fill="none" stroke="#FFFFFF" stroke-opacity=".8" stroke-width="2" stroke-linejoin="round"><path d="M 250 366 L 58 174"/><path d="M 250 366 L 442 174"/><path d="M 58 174 Q 250 20 442 174" stroke-opacity=".5"/><path d="M 250 366 L 330 286 L 250 206 L 170 286 Z"/></g>' +
    '<ellipse cx="250" cy="290" rx="10" ry="5" fill="none" stroke="#D9D4FA" stroke-opacity=".5"/>' +
    ['1B', '2B', '3B'].map(function (b) { var p = PA_B[b]; return '<rect x="' + (p[0] - 8) + '" y="' + (p[1] - 8) + '" width="16" height="16" transform="rotate(45 ' + p[0] + ' ' + p[1] + ')" fill="' + (occ[b] ? '#FD7A48' : '#F5F3FF') + '"/>'; }).join('') +
    '<path d="M 240 361 L 260 361 L 260 368 L 250 374 L 240 368 Z" fill="#F5F3FF"/>';
  var fl = a.fielders || [];
  // the throw: catcher on steals, pitcher on pickoffs; wild pitch/passed ball: the ball gets by
  var from = null, to = null, tStart = 0, tArrive = 0, targetBase = null, ballPath = null;
  if (lead) targetBase = (isCS || isPO) ? (lead.outBase || lead.end) : (isPOA || /^pickoff_error/.test(et) ? lead.start : lead.end);
  if (!targetBase && a.base) targetBase = a.base;
  var runT0 = T + .1, runDur = .95;
  if ((isSB || isCS) && targetBase && PA_B[targetBase === 'score' ? '3B' : targetBase]) {
    from = C; to = PA_B[targetBase] || PA_H; tStart = T + .45; tArrive = isCS ? T + .1 + runDur * .82 - .05 : T + .1 + runDur + .12;
  } else if ((isPO || isPOA || /^pickoff_error/.test(et)) && (targetBase || a.base)) {
    var pb = PA_B[targetBase] || PA_B[a.base] || PA_B['1B'];
    from = P; to = pb; tStart = T; tArrive = T + .38;
  }
  var tag = function (pos, text, ok, t) {
    return '<g style="animation:paIn .2s linear ' + sec(t) + ' both"><rect x="' + (pos[0] - 28) + '" y="' + (pos[1] - 44) + '" width="56" height="22" rx="7" fill="' + (ok ? 'rgba(124,242,156,.18)' : 'rgba(255,122,107,.2)') + '" stroke="' + (ok ? 'rgba(124,242,156,.7)' : 'rgba(255,122,107,.7)') + '"/><text x="' + pos[0] + '" y="' + (pos[1] - 28) + '" text-anchor="middle" font-size="14" font-weight="800" fill="' + (ok ? '#9BE8AC' : '#FFB3A8') + '" letter-spacing="1">' + text + '</text></g>';
  };
  // fielders (thrower + whoever took it light up)
  Object.keys(PA_F).forEach(function (code) {
    var p = PA_F[code], hot = fl.indexOf(code) !== -1 || (from === C && code === '2') || (from === P && code === '1');
    var when = code === '2' && from === C ? tStart : code === '1' && from === P ? tStart : (hot ? tArrive : null);
    g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="8" fill="#5A9BE8" stroke="#CFE3FF" stroke-width="2"' + (when != null ? ' style="transform-box:fill-box;transform-origin:center;animation:paPulse .6s ease-out ' + sec(when) + ' both"' : '') + '/>';
  });
  // throw line + ball
  if (from && to) {
    var end = to;
    if (err) { var dx = to[0] - from[0], dy = to[1] - from[1], l = Math.hypot(dx, dy) || 1; end = [to[0] + dx / l * 40, to[1] + dy / l * 40]; } // sails past the bag
    g += '<path d="M ' + from[0] + ' ' + from[1] + ' L ' + end[0].toFixed(1) + ' ' + end[1].toFixed(1) + '" stroke="#F5F3FF" stroke-opacity=".55" stroke-width="2" stroke-dasharray="4 3" fill="none" style="animation:paIn .15s linear ' + sec(tStart) + ' both"/>' +
      '<circle cx="' + from[0] + '" cy="' + from[1] + '" r="6" fill="#FFFFFF" style="filter:drop-shadow(0 0 5px #fff);animation:paIn .1s linear ' + sec(tStart) + ' both' + (err ? ',paOut .3s linear ' + sec(tArrive + .35) + ' forwards' : '') + '">' +
      '<animateMotion dur="' + Math.max(.25, (err ? tArrive + .25 : tArrive) - tStart).toFixed(2) + 's" begin="' + sec(tStart) + '" fill="freeze" path="M 0 0 L ' + (end[0] - from[0]).toFixed(1) + ' ' + (end[1] - from[1]).toFixed(1) + '"/></circle>';
  }
  if (isWP) {
    // the pitch gets by the catcher and skips toward the backstop
    ballPath = 'M 0 0 L 0 70 Q -10 86 -40 100';
    g += '<circle cx="250" cy="290" r="6" fill="#FFFFFF" style="filter:drop-shadow(0 0 5px #fff);animation:paIn .1s linear ' + sec(T) + ' both,paOut .3s linear ' + sec(T + .75) + ' forwards">' +
      '<animateMotion dur=".7s" begin="' + sec(T) + '" fill="freeze" path="' + ballPath + '"/></circle>';
    runT0 = T + .45;
  }
  if (isBK) runT0 = T + .3;
  // runners
  runners.forEach(function (r) {
    if (!r.start) return;
    var p0 = PA_B[r.start];
    if (!p0) return;
    var pts, st = runT0, dur;
    if (isPOA || (isPO && !r.out) || (/^pickoff_error/.test(et) && false)) {
      // leading off, dives back
      var nx = r.start === '3B' ? PA_H : PA_B[{ '1B': '2B', '2B': '3B' }[r.start]];
      var off = [p0[0] + (nx[0] - p0[0]) * .14, p0[1] + (nx[1] - p0[1]) * .14];
      pts = [off, p0]; st = tStart + .05; dur = .35;
      g += '<circle cx="' + off[0].toFixed(1) + '" cy="' + off[1].toFixed(1) + '" r="9" fill="#FD7A48" stroke="#FFFFFF" stroke-width="2.5"><animateMotion dur="' + dur + 's" begin="' + sec(st) + '" fill="freeze" path="M 0 0 L ' + (p0[0] - off[0]).toFixed(1) + ' ' + (p0[1] - off[1]).toFixed(1) + '"/></circle>';
      if (r === lead || isPOA) g += tag(p0, 'SAFE', true, tArrive + .05);
      return;
    }
    var goal = r.out ? (r.outBase || r.end) : r.end;
    pts = goal ? _paBasesBetween(r.start, goal) : [p0];
    if (r.out && pts.length >= 2) { var aa = pts[pts.length - 2], bb = pts[pts.length - 1]; pts[pts.length - 1] = [aa[0] + (bb[0] - aa[0]) * .82, aa[1] + (bb[1] - aa[1]) * .82]; }
    if (isPO && r.out) { // picked off: caught leaning the wrong way
      var nx2 = r.start === '3B' ? PA_H : PA_B[{ '1B': '2B', '2B': '3B' }[r.start]];
      var off2 = [p0[0] + (nx2[0] - p0[0]) * .18, p0[1] + (nx2[1] - p0[1]) * .18];
      g += '<circle cx="' + off2[0].toFixed(1) + '" cy="' + off2[1].toFixed(1) + '" r="9" fill="#FD7A48" stroke="#FFFFFF" stroke-width="2.5" style="animation:paOut .3s linear ' + sec(tArrive + .2) + ' forwards"><animateMotion dur=".3s" begin="' + sec(tStart + .05) + '" fill="freeze" path="M 0 0 L ' + ((p0[0] - off2[0]) * .6).toFixed(1) + ' ' + ((p0[1] - off2[1]) * .6).toFixed(1) + '"/></circle>';
      g += tag(p0, 'OUT', false, tArrive);
      return;
    }
    var legs = Math.max(1, pts.length - 1);
    dur = r === lead && (isSB || isCS) ? runDur * (r.out ? .82 : 1) : .8 * legs;
    var done = st + dur;
    g += '<circle cx="' + p0[0] + '" cy="' + p0[1] + '" r="9" fill="#FD7A48" stroke="#FFFFFF" stroke-width="2.5"' + ((r.out || goal === 'score') ? ' style="animation:paOut .3s linear ' + sec(done + .25) + ' forwards"' : '') + '>' +
      (pts.length > 1 ? '<animateMotion dur="' + dur.toFixed(2) + 's" begin="' + sec(st) + '" fill="freeze" path="' + _paRel(pts) + '"/>' : '') + '</circle>';
    if (r === lead && (isSB || isCS) && goal && goal !== 'score') g += tag(PA_B[goal] || PA_H, r.out ? 'OUT' : 'SAFE', !r.out, r.out ? tArrive : Math.max(done, tArrive) + .02);
    if (r.out && !isCS && !isPO) g += tag(PA_B[r.outBase] || PA_H, 'OUT', false, done);
  });
  g += '</svg>';
  // words: the play name, plus MLB's line for it (without the season count)
  var title = _paActionTitle(et);
  var note = desc.replace(/\s*\(\d+\)/g, '').replace(/\s+/g, ' ').trim();
  if ((isCS || isPO) && fl.length) note = (isCS ? 'CS ' : 'PO ') + fl.join('-') + (note ? ' · ' + note : '');
  if (note.length > 90) note = note.slice(0, 88) + '…';
  var tT = Math.max(tArrive, runT0 + .9) + .1;
  return '<div class="pa" style="position:absolute;inset:0;background:#120E2B;z-index:3;' + (s.keep ? '' : 'animation:paOut .5s ease ' + sec(END) + ' both;') + '">' +
    '<div style="position:absolute;inset:0;animation:paIn .35s linear ' + sec(0) + ' both">' + g + '</div>' +
    '<div style="position:absolute;left:0;right:0;top:8px;text-align:center;z-index:4;pointer-events:none;animation:paIn .4s linear ' + sec(Math.min(tT, 1.4)) + ' both">' +
      '<div style="font-size:17px;font-weight:800;letter-spacing:.06em;color:#F5F3FF;text-shadow:0 1px 10px rgba(11,8,32,.95)">' + _escapeHtml(title) + '</div>' +
      (note ? '<div style="margin:2px 12px 0;font-size:12px;font-weight:700;color:#B9B3E6;text-shadow:0 1px 8px rgba(11,8,32,.95)">' + _escapeHtml(note) + '</div>' : '') + '</div></div>';
}

// ── v6.1.0: between-pitch scenes inside a replayed at-bat ───────────────
// A steal / caught stealing / wild pitch… that happened during the at-bat
// plays in order: the pitches before it, its own scene (the same one shown
// live), back to the zone for the rest of the pitches, then the final play.
var PA_ACT_LEN = 5.6;
function _paActExtra(lp, i) {
  var n = 0;
  ((lp && lp.actions) || []).forEach(function (a) { if (a.afterPitch != null && a.afterPitch <= i) n += PA_ACT_LEN; });
  return n;
}
function _paActScenesHtml(lp, s, box, GAP) {
  var out = '';
  ((lp && lp.actions) || []).forEach(function (a) {
    if (a.afterPitch == null) return;
    // starts once the pitch before it has landed
    var tA = a.afterPitch > 0 ? .35 + (a.afterPitch - 1) * GAP + _paActExtra(lp, a.afterPitch - 1) + .9 : .1;
    var sub = { startAt: s.startAt + tA * 1000, keep: false, box: box };
    // a scene that hasn't started yet still renders: everything in it waits for its own delay
    var h = _paActionHtml(a, sub, box);
    if (h) out += '<div style="position:absolute;inset:0;z-index:3;opacity:0;animation:paIn .3s linear ' + _paSec(tA, (Date.now() - s.startAt) / 1000) + ' both">' + h + '</div>';
  });
  return out;
}

function _paOverlayHtml() {
  var s = window._pa, lp = s.play, box = s.box;
  if (!lp || !box) return '';
  // v7.19.0: between batters the last play's result card holds (pa-takeover.js)
  var hold = typeof _patHoldOn === 'function' && _patHoldOn(lp, box, s);
  if (!s.startAt) { if (hold) { s._labelHtml = ''; s._statsHtml = ''; } return hold ? _patHeldHtml(lp, box) : ''; }
  if (typeof _paIsAction === 'function' && _paIsAction(lp)) return _paActionHtml(lp, s, box);
  var reduce = typeof _ghReducedMotion === 'function' && _ghReducedMotion();
  var E = (Date.now() - s.startAt) / 1000;
  if (reduce) E = Math.max(E, 30);
  var inPlay = !!(lp.hit || /single|double|triple|home_run|field_out|double_play|triple_play|force_out|fielders_choice|sac_|field_error/.test(lp.eventType || ''));
  // v5.91.0: walks and hit-by-pitches also go to the field — no ball, just
  // the batter taking first and anyone forced moving up.
  var walkish = !lp.hit && /^(walk|intent_walk|hit_by_pitch|catcher_interf)$/.test(lp.eventType || '');
  var showField = inPlay || walkish || !!lp.droppedK; // v6.4.0: strike three got by the catcher
  var allP = (lp.pitches || []).slice();
  // v5.75.0: a replay you tapped shows every pitch coming in one at a
  // time first; everything after the pitches shifts later by that much.
  var GAP = .85; // v5.78.0: a touch slower between pitches
  var OFF = s.seq ? Math.max(0, allP.length - 1) * GAP + _paActExtra(lp, allP.length) : 0;
  var END = (showField ? PA.END : 9) + OFF;
  s.total = END;
  if (s.keep) E = Math.min(E, END - .01);
  else if (E > END + 0.6) { if (hold) { s._labelHtml = ''; s._statsHtml = ''; } return hold ? _patHeldHtml(lp, box) : ''; }
  if (s.quick) { OFF = 0; E = E + PA.SW + .6; } // reel: straight to the field
  var Es = E - OFF; // clock for everything after the pitches
  var land = _paLanding(lp);
  var title = _paTitle(lp), note = _paNote2(lp, box, land);
  var anim = function (name, dur, t, extra, clock) { return 'animation:' + name + ' ' + dur + 's ' + (extra || 'linear') + ' ' + _paSec(t, clock == null ? E : clock) + ' both;'; };
  var incoming = function (p, t, big) { return _pitchFlightSvg(p, t, E, lp.pitchHand, big ? 'last' : 'replay'); };
  var ps, groups = '', callout = '';
  if (s.seq) {
    ps = [];
    allP.forEach(function (p, i) { groups += incoming(p, .35 + i * GAP + _paActExtra(lp, i), i === allP.length - 1); });
    // a small running line under the zone: pitch n · speed · type · call
    if (!s.noCallout) allP.forEach(function (p, i) {
      var t0 = .35 + i * GAP + _paActExtra(lp, i), t1 = i < allP.length - 1 ? .35 + (i + 1) * GAP + _paActExtra(lp, i + 1) : null;
      if (t1 != null && _paActExtra(lp, i + 1) > _paActExtra(lp, i)) t1 = t0 + .9; // a between-pitch scene starts: this line steps aside
      callout += '<div style="position:absolute;left:0;right:0;bottom:8px;text-align:center;font-size:11.5px;font-weight:700;color:#D9D4FA;text-shadow:0 1px 6px rgba(11,8,32,.9);opacity:0;' + anim('paIn', .15, t0) + (t1 != null ? 'animation:paIn .15s linear ' + _paSec(t0, E) + ' both,paOut .15s linear ' + _paSec(t1, E) + ' forwards;' : '') + '">' +
        _escapeHtml([p.num + '.', p.speed ? p.speed + ' mph' : null, p.type, p.call].filter(Boolean).join(' ')) + '</div>';
    });
  } else {
    ps = allP.slice();
    var lastP = ps.pop();
    if (lastP) groups = incoming(lastP, .35, true);
  }
  var seq = { batter: lp.batter, batterId: lp.batterId, batSide: lp.batSide, zoneTop: lp.zoneTop, zoneBottom: lp.zoneBottom, pitches: ps };
  var pv = _strikeZoneSectionHtml(seq, 'rgba(255,255,255,.1)', 'rgba(255,255,255,.65)', '#fff', true).svg;
  if (typeof _bbZoneGlow === 'function') pv = _bbZoneGlow(pv, seq);
  pv = pv.replace(/<\/svg>$/, groups + '</svg>');
  var out = '<div class="pa" style="position:absolute;inset:0;background:#120E2B;z-index:3;' + (s.keep || hold ? '' : anim('paOut', .5, END, 'ease')) + '">';
  out += '<div style="position:absolute;inset:0;' + (showField ? anim('paOut', .5, PA.SW, null, Es) : '') + '">' + pv + callout +
    (showField ? '<div style="position:absolute;left:50%;top:10px;transform:translateX(-50%);padding:3px 10px;border-radius:999px;background:rgba(168,159,232,.16);border:1px solid rgba(168,159,232,.4);color:#D9D4FA;font-size:11px;font-weight:700;' + anim('paIn', .3, 1.2, null, Es) + '">' + (walkish ? ({ hit_by_pitch: 'Hit by pitch', intent_walk: 'Intentional walk', catcher_interf: 'Interference' }[lp.eventType] || 'Ball four') : 'In play') + '</div>' : '') + '</div>';
  if (s.seq && typeof _paActScenesHtml === 'function') out += _paActScenesHtml(lp, s, box, GAP);
  if (showField) out += '<div style="position:absolute;inset:0;' + anim('paIn', .5, PA.SW, null, Es) + '">' + _paFieldSvg(lp, land, Es) + '</div>';
  // title at the top
  var tT = showField ? (s._titleAt || PA.T0 + 2) : 1.4;
  // v6.0.0: on the live at-bat square the title sits in its own row above
  // the square (s.labelOut); replays in the reel and under a tapped play
  // keep it on top of the drawing as before.
  s._labelHtml = '';
  if (s.labelOut) {
    s._labelHtml = '<div class="pl-in" style="--t0:' + _paSec(tT, Es) + '"><span class="pl-t">' + _escapeHtml(title) + '</span>' +
      (note ? '<span class="pl-n">' + _escapeHtml(note).replace('\u24C0K', '<span class="kback" aria-label="strikeout looking">K</span>') + '</span>' : '') + '</div>';
  } else {
    out += '<div style="position:absolute;left:0;right:0;top:8px;text-align:center;z-index:4;pointer-events:none;' + anim('paIn', .5, tT, null, Es) + '">' +
      '<div style="font-size:17px;font-weight:800;letter-spacing:.06em;color:#F5F3FF;text-shadow:0 1px 10px rgba(11,8,32,.95)">' + _escapeHtml(title) + '</div>' +
      (note ? '<div style="margin-top:2px;font-size:12px;font-weight:700;color:#B9B3E6;text-shadow:0 1px 8px rgba(11,8,32,.95)">' + _escapeHtml(note).replace('\u24C0K', '<span class="kback" aria-label="strikeout looking">K</span>') + '</div>' : '') + '</div>';
  }
  if (inPlay && typeof _savPlayPillsHtml === 'function') out += _savPlayPillsHtml(lp, tT + .3, Es);
  // v6.0.0: Statcast strip (counts up while the ball is in the air) and the
  // home run takeover in the batting team's colors, inside the square.
  s._statsHtml = (s.labelOut && showField && typeof _bbStatsHtml === 'function') ? _bbStatsHtml(lp, s, OFF) : '';
  // v7.9.0: every plate appearance gets a takeover, tiered by the moment (js/games/pa-takeover.js);
  // the home-run-only takeover stays as the fallback
  if (typeof _bbPaTakeoverHtml === 'function') out += _bbPaTakeoverHtml(lp, box, s, Es, showField, tT);
  else if (showField && (lp.eventType || '') === 'home_run' && typeof _bbHrTakeoverHtml === 'function') out += _bbHrTakeoverHtml(lp, box, s, Es);
  out += '</div>';
  return out;
}

// v5.95.0: an infield single — a grounder an infielder got to but the
// batter beat the throw (no error). The play text names the fielder
// ("singles on a ground ball to second baseman …"); credits may too.
var _PA_POS_WORDS = { pitcher: '1', catcher: '2', 'first baseman': '3', 'second baseman': '4', 'third baseman': '5', shortstop: '6' };
function _paInfieldHitPos(lp) {
  if ((lp.eventType || '') !== 'single') return null;
  var tr = (lp.hit && lp.hit.trajectory) || '';
  if (tr && !/ground|bunt/.test(tr)) return null;
  var desc = String(lp.description || lp.desc || '').toLowerCase();
  // v6.1.1: a ball that reaches an outfielder, or was fielded out past the
  // infield dirt, is a regular single even if an infielder got a glove on it
  // (e.g. "singles on a ground ball to center fielder …, deflected by
  // second baseman …") — no throw to first, nobody covers the bag.
  if (/\bto (left|center|right) fielder\b/.test(desc)) return null;
  var hh = lp.hit || {};
  if (hh.x != null && hh.y != null && Math.hypot(hh.x - 125.42, 198.27 - hh.y) * 2.5 > 170) return null;
  var m = desc.match(/(?:ground ball|grounder|bunt|chopper|roller)[^.]*?\bto (pitcher|catcher|first baseman|second baseman|third baseman|shortstop)\b/) || desc.match(/\bto (pitcher|catcher|first baseman|second baseman|third baseman|shortstop)\b/);
  if (m) return _PA_POS_WORDS[m[1]];
  if (/deflect/.test(desc)) return null; // a deflection alone isn't who fielded it
  var f0 = (lp.fielders || [])[0];
  return f0 && /^[1-6]$/.test(f0) && tr ? f0 : null;
}

function _paFieldSvg(lp, land, E) {
  var s = window._pa;
  var T0 = PA.T0;
  var t = lp.eventType || '', tr = (lp.hit && lp.hit.trajectory) || '';
  var fl = (lp.fielders || []).slice();
  var ihPos = _paInfieldHitPos(lp);
  if (ihPos && fl[0] !== ihPos) fl = [ihPos];
  var runners = lp.runners || [];
  var batter = runners.filter(function (r) { return r.batter; })[0] || null;
  var others = runners.filter(function (r) { return !r.batter; });
  var occupied = {}, moving = {};
  others.forEach(function (r) { if (r.start) { occupied[r.start] = true; moving[r.start] = true; } });
  var pre = lp.pre || {};
  ['1B', '2B', '3B'].forEach(function (b) { if (pre[b]) occupied[b] = true; });
  var air = /fly_ball|popup|line_drive/.test(tr);
  var caught = t === 'field_out' && air || t === 'sac_fly';
  var hr = t === 'home_run';
  // where the ball goes first: the landing spot, or the first fielder
  var first = land ? [land.x, land.y] : (fl[0] && PA_F[fl[0]] ? PA_F[fl[0]] : [250, 150]);
  if (!hr && land) { var rr = Math.hypot(first[0] - PA_H[0], first[1] - PA_H[1]); if (rr > 262) { var k = 262 / rr; first = [PA_H[0] + (first[0] - PA_H[0]) * k, PA_H[1] + (first[1] - PA_H[1]) * k]; } }
  // v6.4.0: dropped third strike — the ball gets by the catcher toward the
  // backstop; he chases it and throws to first (or the batter makes it).
  var droppedK = !!lp.droppedK;
  if (droppedK) first = [212, 381];
  var groundOut = /ground|bunt_grounder/.test(tr) && land && Math.hypot(land.x - PA_H[0], land.y - PA_H[1]) > 150;
  // v5.94.0: a grounder an infielder fields. The hit coordinates are often
  // where the ball first hit the dirt, not where he got it — so the ball
  // bounces there, keeps going along the same line, and the fielder meets
  // it at his depth (moving over to the line), then throws from there.
  var bounceAt = null;
  var fieldedGrounder = (!!ihPos && !!PA_F[ihPos]) || /ground|bunt_grounder/.test(tr) && fl.length && PA_F[fl[0]] && !/^(single|double|triple|field_error)$/.test(t) && fl[0] !== '7' && fl[0] !== '8' && fl[0] !== '9';
  if (fieldedGrounder) {
    var fpos = PA_F[fl[0]], dF = Math.hypot(fpos[0] - PA_H[0], fpos[1] - PA_H[1]);
    var gAng = land ? Math.atan2(land.x - PA_H[0], PA_H[1] - land.y) : Math.atan2(fpos[0] - PA_H[0], PA_H[1] - fpos[1]);
    var bR = land ? Math.hypot(land.x - PA_H[0], land.y - PA_H[1]) : dF * .5;
    var reach = Math.max(dF, bR + 25);
    first = [PA_H[0] + reach * Math.sin(gAng), PA_H[1] - reach * Math.cos(gAng)];
    bounceAt = Math.max(.25, Math.min(.8, bR / reach));
  }
  var flight = droppedK ? .55 : hr ? 1.8 : caught ? (tr === 'line_drive' ? .9 : 1.6) : groundOut ? 1.4 : tr === 'ground_ball' ? .9 : 1.1;
  var t1 = T0 + flight;
  var noBall = !lp.hit && /^(walk|intent_walk|hit_by_pitch|catcher_interf)$/.test(t);
  if (noBall) t1 = T0;
  // v5.73.0: fielders only move when the play has an out in it. A hit
  // that drops stays where it landed — unless someone is thrown out on
  // it, in which case the ball lands, the fielder gets to it, and then
  // throws (e.g. single to right, runner thrown out at 3rd).
  var dropped = /^(single|double|triple|field_error)$/.test(t);
  var anyOut = caught || runners.some(function (r) { return r.out; });
  var retrieve = dropped && anyOut ? .9 : 0;
  var tThrow = t1 + retrieve;
  // throws: lead runner first, to each base where someone was put out
  var outs = runners.filter(function (r) { return r.out && r.outBase && !(caught && r.batter); });
  outs.sort(function (a, b) { var o = { '3B': 3, '2B': 2, '1B': 1 }; return (o[b.start] || 0) - (o[a.start] || 0); });
  var throwPts = [first], tt = tThrow, outTimes = {};
  outs.forEach(function (r) {
    var base = PA_B[r.outBase] || PA_H;
    if (base[0] === throwPts[throwPts.length - 1][0] && base[1] === throwPts[throwPts.length - 1][1]) { outTimes[r.outBase] = tt; return; }
    throwPts.push(base); tt += PA.THROW; outTimes[r.outBase] = tt;
  });
  // infield single: the throw to first still happens — it just gets there
  // a step after the batter does
  if (ihPos) { throwPts.push(PA_B['1B']); tt += PA.THROW; outTimes['1B-safe'] = tt; }
  var ballEnd = tt;
  var g = '<svg viewBox="0 0 500 386" width="100%" height="220" style="display:block">' +
    '<rect x="0" y="0" width="500" height="386" fill="#120E2B"/>' +
    (typeof _bbParkSvg === 'function' ? _bbParkSvg(s.box) : '<path d="M 58 174 Q 250 20 442 174 L 250 366 Z" fill="#12402A" fill-opacity=".45"/><path d="M 250 366 L 330 286 L 250 206 L 170 286 Z" fill="#6B4A2A" fill-opacity=".35"/>') +
    '<g fill="none" stroke="#FFFFFF" stroke-opacity=".8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    ['M 250 366 L 58 174', 'M 250 366 L 442 174', 'M 58 174 Q 250 20 442 174', 'M 250 366 L 330 286 L 250 206 L 170 286 Z'].map(function (d) {
      return '<path d="' + d + '" pathLength="100" stroke-dasharray="100" style="' + 'animation:paDraw .8s cubic-bezier(.5,0,.2,1) ' + _paSec(PA.SW, E) + ' both"/>';
    }).join('') + '</g>' +
    '<ellipse cx="250" cy="290" rx="10" ry="5" fill="none" stroke="#D9D4FA" stroke-opacity=".5"/>' +
    ['1B', '2B', '3B'].map(function (b) { var p = PA_B[b]; return '<rect x="' + (p[0] - 8) + '" y="' + (p[1] - 8) + '" width="16" height="16" transform="rotate(45 ' + p[0] + ' ' + p[1] + ')" fill="' + (occupied[b] ? '#FD7A48' : '#F5F3FF') + '"/>'; }).join('') +
    '<path d="M 240 361 L 260 361 L 260 368 L 250 374 L 240 368 Z" fill="#F5F3FF"/>';
  // HR: light the stretch of wall it cleared
  if (hr && land) g += '<path d="' + _paWallSeg(land.ang) + '" fill="none" stroke="#F5F3FF" stroke-width="5" stroke-linecap="round" style="animation:paIn .15s linear ' + _paSec(t1 - .1, E) + ' both"/>';
  // fielders: only on plays with an out. Whoever fields it runs to the
  // ball (arriving after it drops on a hit), whoever takes a throw runs
  // to that bag. Nobody moves on a clean hit.
  var moves = {};
  if (anyOut || ihPos) fl.forEach(function (code, i) {
    if (!PA_F[code]) return;
    if (i === 0) moves[code] = { to: first, at: tThrow };
    else if (throwPts[i]) moves[code] = { to: throwPts[i], at: tThrow + PA.THROW * i - .1 };
  });
  if (ihPos) { var cov = ihPos === '3' ? '1' : '3'; if (!moves[cov]) moves[cov] = { to: PA_B['1B'], at: tThrow + PA.THROW - .1 }; }
  Object.keys(PA_F).forEach(function (code) {
    var p = PA_F[code], mv = moves[code];
    var idx = fl.indexOf(code);
    var when = !anyOut ? null : idx === 0 ? tThrow : (idx > 0 ? tThrow + idx * PA.THROW : null);
    var motion = '';
    if (mv) {
      // v6.1.0: the fielder steps over just before the ball arrives instead of
      // running alongside it the whole flight (which read as a second ball)
      var st = Math.max(T0 + .15, mv.at - .45), dur = Math.max(.3, mv.at - st);
      motion = '<animateMotion dur="' + dur.toFixed(2) + 's" begin="' + _paSec(st, E) + '" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".3 0 .4 1" path="M 0 0 L ' + (mv.to[0] - p[0]).toFixed(1) + ' ' + (mv.to[1] - p[1]).toFixed(1) + '"/>';
    }
    // a moving fielder pulses by radius (a CSS scale on a moving circle can
    // draw it back at its starting spot in Safari)
    g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="8" fill="#5A9BE8" stroke="#CFE3FF" stroke-width="2"' + (when != null && !motion ? ' style="transform-box:fill-box;transform-origin:center;animation:paPulse .6s ease-out ' + _paSec(when, E) + ' both"' : '') + '>' + motion +
      (when != null && motion ? '<animate attributeName="r" values="8;12;8" dur=".6s" begin="' + _paSec(when, E) + '" fill="freeze"/>' : '') + '</circle>';
  });
  // ball: trail + dot along the flight, then the throws
  var fly = [PA_H, first];
  var ctrl = null;
  if (air || hr) {
    var mx = (PA_H[0] + first[0]) / 2, my = (PA_H[1] + first[1]) / 2;
    var dx = first[0] - PA_H[0], dy = first[1] - PA_H[1], len = Math.hypot(dx, dy) || 1;
    var bow = Math.min(28, len * .12);
    ctrl = [mx + (-dy / len) * bow, my + (dx / len) * bow];
  }
  // grounders into the outfield: three hops, each smaller, along the line
  var hopD = null, hopRel = null;
  if ((groundOut || bounceAt != null) && !ctrl) {
    var hx = first[0] - PA_H[0], hy = first[1] - PA_H[1], hl = Math.hypot(hx, hy) || 1, nx = -hy / hl, ny = hx / hl;
    var cuts = [0, .34, .64, .86, 1], sizes = [22, 14, 8, 4];
    if (bounceAt != null) { cuts = [0, bounceAt, bounceAt + (1 - bounceAt) * .6, 1]; sizes = [16, 8, 3]; } // first bounce where it hit the dirt, then into his glove
    var segs = '', rel = '';
    for (var hi = 0; hi < cuts.length - 1; hi++) {
      var a0 = cuts[hi], a1 = cuts[hi + 1], am = (a0 + a1) / 2;
      var ex = hx * a1, ey = hy * a1, cx = hx * am + nx * sizes[hi], cy = hy * am + ny * sizes[hi];
      segs += ' Q ' + (PA_H[0] + cx).toFixed(1) + ' ' + (PA_H[1] + cy).toFixed(1) + ' ' + (PA_H[0] + ex).toFixed(1) + ' ' + (PA_H[1] + ey).toFixed(1);
      rel += ' Q ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + ex.toFixed(1) + ' ' + ey.toFixed(1);
    }
    hopD = 'M ' + PA_H[0] + ' ' + PA_H[1] + segs; hopRel = 'M 0 0' + rel;
  }
  var flightD = hopD ? hopD : ctrl ? 'M ' + PA_H[0] + ' ' + PA_H[1] + ' Q ' + ctrl[0].toFixed(1) + ' ' + ctrl[1].toFixed(1) + ' ' + first[0].toFixed(1) + ' ' + first[1].toFixed(1) : _paPath(fly);
  var flightRel = hopRel ? hopRel : ctrl ? 'M 0 0 Q ' + (ctrl[0] - PA_H[0]).toFixed(1) + ' ' + (ctrl[1] - PA_H[1]).toFixed(1) + ' ' + (first[0] - PA_H[0]).toFixed(1) + ' ' + (first[1] - PA_H[1]).toFixed(1) : _paRel(fly);
  if (!noBall) g += '<path d="' + flightD + '" pathLength="100" stroke-dasharray="100" fill="none" stroke="#F5F3FF" stroke-opacity=".6" stroke-width="2" style="animation:paDraw ' + flight + 's linear ' + _paSec(T0, E) + ' both"/>';
  if (!noBall && throwPts.length > 1) g += '<path d="' + _paPath(throwPts) + '" pathLength="100" stroke-dasharray="4 3" fill="none" stroke="#F5F3FF" stroke-opacity=".55" stroke-width="2" style="animation:paIn .2s linear ' + _paSec(tThrow, E) + ' both"/>';
  if (!noBall) g += '<circle cx="' + PA_H[0] + '" cy="' + PA_H[1] + '" r="6" fill="#FFFFFF" style="filter:drop-shadow(0 0 6px #fff);animation:paIn .1s linear ' + _paSec(T0, E) + ' both' + (hr ? ',paOut .3s linear ' + _paSec(t1, E) + ' forwards' : '') + '">' +
    '<animateMotion dur="' + flight + 's" begin="' + _paSec(T0, E) + '" fill="freeze" path="' + flightRel + '"/>' +
    (hopD ? '<animate attributeName="r" values="6;9;6;8;6;7;6;6.5;6" dur="' + flight + 's" begin="' + _paSec(T0, E) + '" fill="freeze"/>' : '') +
    ((air || hr) ? '<animate attributeName="r" values="6;11;6" dur="' + flight + 's" begin="' + _paSec(T0, E) + '" fill="freeze"/>' : '') +
    (throwPts.length > 1 ? '<animateMotion dur="' + (ballEnd - tThrow).toFixed(2) + 's" begin="' + _paSec(tThrow, E) + '" fill="freeze" path="' + _paOff(PA_H, throwPts) + '"/>' : '') +
    '</circle>';
  if (ihPos && outTimes['1B-safe']) {
    var sb = PA_B['1B'];
    g += '<g style="animation:paIn .2s linear ' + _paSec(outTimes['1B-safe'], E) + ' both"><rect x="' + (sb[0] - 28) + '" y="' + (sb[1] - 44) + '" width="56" height="22" rx="7" fill="rgba(124,242,156,.18)" stroke="rgba(124,242,156,.7)"/><text x="' + sb[0] + '" y="' + (sb[1] - 28) + '" text-anchor="middle" font-size="14" font-weight="800" fill="#9BE8AC" letter-spacing="1">SAFE</text></g>';
  }
  // runners who stayed put
  ['1B', '2B', '3B'].forEach(function (b) {
    if (!pre[b] || moving[b]) return;
    var p = PA_B[b];
    g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="#FD7A48" stroke="#FFFFFF" stroke-width="2.5" style="animation:paIn .2s linear ' + _paSec(PA.SW + .3, E) + ' both"/>';
  });
  // runners: pre-play runners visible from the swap; everyone moves after contact (after the catch on a fly)
  var runStart = caught ? t1 : T0 + .25;
  var lastScore = 0, allDone = 0; // v7.11.2: allDone = last runner to finish
  runners.forEach(function (r) {
    var from = r.batter ? 'H' : r.start;
    if (!from) return;
    var to = r.out ? r.outBase : r.end;
    var pts = to ? _paBasesBetween(from, to) : [];
    if (r.out && pts.length >= 2) { var a = pts[pts.length - 2], b = pts[pts.length - 1]; pts[pts.length - 1] = [a[0] + (b[0] - a[0]) * .82, a[1] + (b[1] - a[1]) * .82]; }
    if (r.batter && caught) pts = [PA_H, [PA_H[0] + 36, PA_H[1] - 36]];
    if (r.batter && !pts.length) return;
    var p0 = r.batter ? PA_H : (PA_B[from] || PA_H);
    var legs = Math.max(1, pts.length - 1);
    var st = r.batter ? T0 + .1 : runStart;
    var dur = r.out && outTimes[r.outBase] ? Math.max(.45, outTimes[r.outBase] - st) : PA.LEG * legs;
    if (r.batter && ihPos && to === '1B' && outTimes['1B-safe']) dur = Math.max(.6, outTimes['1B-safe'] - .15 - st); // beats the throw by a step
    var done = st + dur;
    allDone = Math.max(allDone, done);
    var fade = r.out || (to === 'score');
    if (to === 'score') lastScore = Math.max(lastScore, done);
    var col = r.batter ? '#FFFFFF' : '#FD7A48';
    g += '<circle cx="' + p0[0] + '" cy="' + p0[1] + '" r="9" fill="' + col + '" stroke="' + (r.batter ? '#A89FE8' : '#FFFFFF') + '" stroke-width="2.5" style="animation:paIn .2s linear ' + _paSec(r.batter ? T0 : PA.SW + .3, E) + ' both' + (fade ? ',paOut .3s linear ' + _paSec(done + .15, E) + ' forwards' : '') + '">' +
      (pts.length > 1 ? '<animateMotion dur="' + dur.toFixed(2) + 's" begin="' + _paSec(st, E) + '" fill="freeze" path="' + _paRel(pts) + '"/>' : '') + '</circle>';
    if (r.out) {
      var ob = PA_B[r.outBase] || (r.batter && caught && land ? [land.x, land.y] : PA_H);
      if (r.batter && caught) ob = first;
      var ot = r.batter && caught ? t1 : (outTimes[r.outBase] || done);
      g += '<g style="animation:paIn .2s linear ' + _paSec(ot, E) + ' both"><rect x="' + (ob[0] - 26) + '" y="' + (ob[1] - 44) + '" width="52" height="22" rx="7" fill="rgba(255,122,107,.2)" stroke="rgba(255,122,107,.7)"/><text x="' + ob[0] + '" y="' + (ob[1] - 28) + '" text-anchor="middle" font-size="14" font-weight="800" fill="#FFB3A8" letter-spacing="1">OUT</text></g>';
    }
  });
  s._titleAt = Math.max(ballEnd, lastScore, t1) + .35;
  s._t1 = t1; // v6.0.0: when the ball finishes its flight
  // v7.11.2: when everything on the field is done (last throw, last runner),
  // so the result takeover never covers a play that's still going
  s._fieldEnd = Math.max(ballEnd, lastScore, t1, allDone);
  return g + '</svg>';
}
