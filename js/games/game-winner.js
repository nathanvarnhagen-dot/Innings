// ═══ GAME WINNER / WALK-OFF (v6.7.0) ═══════════════════════════════════
// The last play of a finished game closes the highlights reel: the last
// at-bat (pitches, then the field if the ball was in play), then the win —
// the winner's panel with the final score, who closed it out and their
// record — or, for a walk-off, its own version with light from home plate,
// one fall of confetti and a button to save the moment.
function _gwEndInfo(box) {
  if (!box || box.gameState !== 'Final') return null;
  var lp = box.lastPlay;
  if (!lp || lp.awayScore == null || lp.homeScore == null || lp.awayScore === lp.homeScore) return null;
  var winner = lp.homeScore > lp.awayScore ? 'home' : 'away';
  var runs = (lp.runners || []).filter(function (r) { return r.end === 'score'; }).length;
  var walkoff = lp.half === 'bottom' && (lp.inning || 0) >= 9 && winner === 'home' && (lp.homeScore - runs) <= lp.awayScore;
  return { lp: lp, winner: winner, walkoff: walkoff };
}
function _gwTeam(box, side) {
  var abbr = side === 'away' ? (box.awayAbbr || _ghAbbrFallback(box.away || '')) : (box.homeAbbr || _ghAbbrFallback(box.home || ''));
  var name = String(_teamShortName((side === 'away' ? box.away : box.home) || '') || abbr);
  return { abbr: abbr, name: name, c: _ghTeamColors(abbr), rec: side === 'away' ? box.awayRecord : box.homeRecord };
}
function _gwWalkoffWhat(lp) {
  var t = lp.eventType || '', rbi = lp.rbi || 0, h = lp.hit || {};
  var word = t === 'home_run' ? (rbi >= 4 ? 'Grand slam' : rbi === 1 ? 'Solo homer' : rbi + '-run homer')
    : ({ single: 'Single', double: 'Double', triple: 'Triple', walk: 'Walk', intent_walk: 'Walk', hit_by_pitch: 'Hit by pitch', sac_fly: 'Sac fly', sac_bunt: 'Sac bunt', field_error: 'Error', fielders_choice: 'Fielder\u2019s choice', force_out: 'Force out', grounded_into_double_play: 'Ground ball' }[t] || String(lp.event || 'Walk-off'));
  var bits = [word];
  if (t === 'home_run') { if (h.distance) bits.push(h.distance + ' ft'); if (h.speed) bits.push(h.speed + ' mph'); }
  else if (rbi) bits.push(rbi + ' RBI');
  return bits.join(' \u00b7 ');
}
function _gwGraphicHtml(end, box, startSec, E) {
  if (!box) return '';
  var lp = end.lp, W = _gwTeam(box, end.winner), L = _gwTeam(box, end.winner === 'home' ? 'away' : 'home');
  var ws = end.winner === 'home' ? lp.homeScore : lp.awayScore, ls = end.winner === 'home' ? lp.awayScore : lp.homeScore;
  var t0 = (startSec - E).toFixed(2) + 's';
  var d = function (ms) { return 'style="animation-delay:calc(var(--t0) + ' + ms + 'ms)"'; };
  var logo = function (T) { return '<i style="background:' + T.c.bg + ';color:' + T.c.fg + '">' + _escapeHtml(T.abbr) + '</i>'; };
  var score = '<div class="sc" ' + d(end.walkoff ? 720 : 240) + '><span class="s">' + logo(W) + '<b>' + ws + '</b></span><span class="dash"></span><span class="s lo"><b>' + ls + '</b>' + logo(L) + '</span></div>';
  var acc = (W.c.accent && W.c.accent !== W.c.bg) ? W.c.accent : W.c.bg;
  if (end.walkoff) {
    var rays = '', N = 18;
    for (var i = 0; i < N; i++) {
      var a = (-80 + i * (160 / (N - 1))) * Math.PI / 180, b = a + .045;
      rays += '<polygon points="200,300 ' + (200 + Math.sin(a) * 520).toFixed(0) + ',' + (300 - Math.cos(a) * 520).toFixed(0) + ' ' + (200 + Math.sin(b) * 520).toFixed(0) + ',' + (300 - Math.cos(b) * 520).toFixed(0) + '" fill="' + (i % 2 ? W.c.bg : '#F2C869') + '" opacity="' + (i % 2 ? .2 : .1) + '"/>';
    }
    var conf = '', cols = [W.c.bg, '#F2C869', '#FFFFFF', acc];
    for (var k = 0; k < 40; k++) {
      var r1 = ((k * 37) % 100), o = 300 + ((k * 53) % 700), dur = 1.8 + ((k * 29) % 12) / 10, dx = ((k * 17) % 60) - 30, rot = ((k * 71) % 720) - 360;
      conf += '<i style="left:' + r1 + '%;background:' + cols[k % 4] + ';--o:' + o + 'ms;--d:' + dur.toFixed(1) + 's;--dx:' + dx + 'px;--r:' + rot + 'deg"></i>';
    }
    var who = String(_ghLastName(lp.batter || '') || '').toUpperCase();
    return '<div class="gw gw-wo" style="--t0:' + t0 + ';--wd:' + _fbxDark(W.c.bg, .55) + '">' +
      '<svg class="rays" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' + rays + '</svg>' +
      '<div class="gw-conf" aria-hidden="true">' + conf + '</div>' +
      '<div class="ct"><span class="big" ' + d(180) + '>WALK-OFF</span>' +
      (who ? '<span class="who" ' + d(400) + '>' + _escapeHtml(who) + ' WALKS IT OFF</span>' : '') +
      '<span class="what" ' + d(560) + '>' + _escapeHtml(_gwWalkoffWhat(lp)) + '</span>' + score + '</div></div>';
  }
  if (typeof _psClinchHtml === 'function') { var ps = _psClinchHtml(end, box, W, L, ws, ls, t0); if (ps) return ps; }
  var dd = box.decisionsDetail || {};
  var line = dd.save && dd.save.name ? _ghLastName(dd.save.name) + ' closed it out' + (dd.save.rec ? ' \u00b7 save #' + dd.save.rec : '')
    : dd.winner && dd.winner.name ? 'W: ' + dd.winner.name + (dd.winner.rec ? ' (' + dd.winner.rec + ')' : '') : '';
  var rec = W.rec && W.rec.w != null ? W.name + ' ' + W.rec.w + '\u2013' + W.rec.l : '';
  return '<div class="gw gw-win" style="--t0:' + t0 + ';--wc:' + _ghHexAlpha(W.c.bg, .55) + ';--wd:' + _fbxDark(W.c.bg, .6) + ';--wa:' + acc + '">' +
    '<div class="bg"></div><div class="sw"></div>' +
    '<div class="ct"><span class="fin" ' + d(0) + '>FINAL</span><span class="team" ' + d(110) + '>' + _escapeHtml(W.name.toUpperCase()) + ' WIN</span>' + score +
    (line ? '<span class="ln" ' + d(420) + '>' + _escapeHtml(line) + '</span>' : '') +
    (rec ? '<span class="rec" ' + d(520) + '>' + _escapeHtml(rec) + '</span>' : '') + '</div></div>';
}
// "Save this walk-off": pick Watching if you haven't picked anything, then
// open the memory sheet with a note started for you.
function gwSaveWalkoff() {
  var s = window._gatt;
  if (!s) return;
  var open = function () {
    if (typeof gattOpenSheet !== 'function') return;
    gattOpenSheet();
    var r = window._reel, it = r && r.items && r.items[r.idx];
    if (s.draft && !s.draft.note && it && it.end) { s.draft.note = 'Walk-off! ' + _gwWalkoffWhat(it.end.lp); if (typeof _gattRenderSheet === 'function') _gattRenderSheet(); }
  };
  if (!s.mode) { gattChoose('watch'); setTimeout(open, 60); } else open();
}
