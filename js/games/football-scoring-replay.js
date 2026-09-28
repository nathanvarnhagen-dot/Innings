// ═══ FOOTBALL FINAL — SCORING REPLAY (v5.99.0) ══════════════════════
// After a game, the scoring plays replay one at a time on the live field:
// the ball runs or flies the real distance into the right end zone (both
// read from the play's own label, e.g. "Allgeier 57-yd TD run"), the
// team's touchdown takeover plays for touchdowns, and the card underneath
// says what happened and the score after it. Auto-plays once; prev/next,
// pause and the dots step through by hand. Only the replay card repaints.
window._fbr = null;
function _fbrPlay(p) {
  var t = String((p.head || '') + ' ' + (p.sub || ''));
  var yd = t.match(/(\d{1,3})\s*-?\s*(?:yd|yard)/i);
  var yards = yd ? Math.min(99, Number(yd[1])) : null;
  var kind = 'rush', kindText = 'RUSH · TOUCHDOWN', badge = 'TD', td = true;
  if (/\bFG\b|field goal/i.test(t)) { kind = 'kick'; kindText = 'FIELD GOAL'; badge = 'FG'; td = false; }
  else if (/safety/i.test(t)) { kind = 'none'; kindText = 'SAFETY'; badge = 'SAFETY'; td = false; }
  else if (/pick-six|interception return/i.test(t)) { kindText = 'INTERCEPTION RETURN · TOUCHDOWN'; }
  else if (/fumble/i.test(t)) { kindText = 'FUMBLE RETURN · TOUCHDOWN'; }
  else if (/catch|pass|reception/i.test(t)) { kind = 'pass'; kindText = 'PASS · TOUCHDOWN'; }
  else if (!/\bTD\b|touchdown/i.test(t)) { kind = 'none'; kindText = 'SCORE'; badge = ''; td = false; }
  var side = p.side === 'h' ? 'h' : 'a';
  var goal = side === 'a' ? 100 : 0, dir = side === 'a' ? 1 : -1;
  // A field goal is kicked from 17 yards behind its listed distance
  var dist = yards != null ? (kind === 'kick' ? Math.max(1, yards - 17) : yards) : 20;
  var start = kind === 'none' ? goal : Math.max(0, Math.min(100, goal - dir * dist));
  return { kind: kind, kindText: kindText, badge: badge, td: td, side: side, yards: yards, start: start, end: goal };
}
function _fbrDur(pl) { return pl.td ? 5200 : 3600; }
function _fbrState(m) {
  var g = window._activeBrowseGame, pk = g ? String(g.gamePk) : '';
  var r = window._fbr;
  if (!r || r.pk !== pk || r.n !== m.highlights.length) {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Autoplay starts once the final hero has finished animating in
    r = window._fbr = { pk: pk, n: m.highlights.length, i: 0, playing: !reduce, at: Date.now() + 1400 };
  }
  return r;
}
function _fbrHtml(m, first) {
  var r = _fbrState(m);
  var plays = m.highlights;
  var p = plays[r.i] || plays[0];
  var pl = _fbrPlay(p);
  var team = pl.side === 'h' ? m.home : m.away;
  var mm = Object.assign({}, m, { situation: { downText: '', possSide: pl.side, lastPlay: null } });
  var v = { pct: pl.end, firstPct: null, lastPlay: pl.kind === 'none' ? null : { kind: pl.kind === 'kick' ? 'kick' : pl.kind, startPct: pl.start, endPct: pl.end }, aria: p.head || 'Scoring play' };
  var fx = { playAt: r.at, fromPct: pl.kind === 'none' ? null : pl.start, fromFirst: null, td: pl.td ? { side: pl.side, at: r.at + 950 } : null, burn: null, brkAt: 0 };
  var field = _fbxFieldHtml(mm, v, fx, null);
  var chip = _gxChip(p, m);
  var big = pl.yards != null && pl.kind !== 'none' ? pl.yards + '<small>YDS</small>' : '&mdash;';
  var res = '<div class="fbx-res' + (pl.td ? ' td' : '') + '" style="--acc:' + (pl.td ? '#F2C869' : team.colors.bg) + ';--t0:' + (-(Date.now() - r.at)) + 'ms">' +
    '<span class="y">' + big + '</span><div class="w"><span class="k">' + _escapeHtml(team.abbr + ' · ' + pl.kindText) + '</span>' +
    '<span class="x">' + _escapeHtml((p.head || '') + (p.sub ? ' · ' + p.sub : '')) + '</span>' +
    '<span class="k" style="letter-spacing:.04em;color:#D9D4FA">' + _escapeHtml([p.tag, p.time].filter(Boolean).join(' ') + (chip ? '  ·  ' + chip : '')) + '</span></div>' +
    (pl.badge ? '<span class="bd">' + pl.badge + '</span>' : '') + '</div>';
  var dots = plays.map(function (q, k) {
    return '<button class="fbr-dot' + (k === r.i ? ' on' : (k < r.i ? ' done' : '')) + '" onclick="fbrGo(' + k + ')" aria-label="Scoring play ' + (k + 1) + ' of ' + plays.length + '"' + (k === r.i ? ' aria-current="true"' : '') + '><i></i></button>';
  }).join('');
  var icon = function (d) { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + d + '</svg>'; };
  var ctl = '<div class="fbr-ctl">' +
    '<button class="fbr-btn" onclick="fbrStep(-1)" aria-label="Previous scoring play"' + (r.i === 0 ? ' disabled' : '') + '>' + icon('<path d="M15 5l-8 7 8 7z"/>') + '</button>' +
    '<button class="fbr-btn pri" onclick="fbrToggle()" aria-label="' + (r.playing ? 'Pause replay' : 'Play replay') + '">' + (r.playing ? icon('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>') : icon('<path d="M8 5l11 7-11 7z"/>')) + '</button>' +
    '<button class="fbr-btn" onclick="fbrStep(1)" aria-label="Next scoring play"' + (r.i >= plays.length - 1 ? ' disabled' : '') + '>' + icon('<path d="M9 5l8 7-8 7z"/>') + '</button>' +
    '<div class="fbr-dots">' + dots + '</div></div>';
  if (r.playing) _fbrRun();
  return '<div class="gh-panel fbr' + (first ? ' gh-up' : '') + '" id="fbr-card" style="' + (first ? _ghDelay(.5) : '') + '">' +
    '<div class="gh-row"><span class="gh-eyebrow">Replay the scoring</span><span class="gh-sub" style="white-space:nowrap">' + (r.i + 1) + ' of ' + plays.length + '</span></div>' +
    field + res + ctl + '</div>';
}
function _fbrPaint() {
  var el = document.getElementById('fbr-card');
  var gp = window._gdPregame;
  if (!el || !gp || !gp.gx) return false;
  var tmp = document.createElement('div');
  tmp.innerHTML = _fbrHtml(gp.gx, false);
  el.parentNode.replaceChild(tmp.firstChild, el);
  return true;
}
function _fbrRun() {
  if (window._fbrTimer) return;
  window._fbrTimer = setInterval(function () {
    var r = window._fbr, gp = window._gdPregame;
    if (!r || !document.getElementById('fbr-card') || !gp || !gp.gx) { clearInterval(window._fbrTimer); window._fbrTimer = null; return; }
    if (!r.playing) return;
    var p = gp.gx.highlights[r.i];
    if (!p || Date.now() - r.at < _fbrDur(_fbrPlay(p))) return;
    if (r.i < gp.gx.highlights.length - 1) { r.i++; r.at = Date.now(); }
    else r.playing = false;
    _fbrPaint();
  }, 250);
}
function fbrGo(k) { var r = window._fbr; if (!r) return; r.i = Math.max(0, Math.min(r.n - 1, k)); r.at = Date.now(); _fbrPaint(); }
function fbrStep(d) { var r = window._fbr; if (r) fbrGo(r.i + d); }
function fbrToggle() {
  var r = window._fbr; if (!r) return;
  if (!r.playing && r.i >= r.n - 1) { r.i = 0; r.at = Date.now(); }   // replay from the top
  r.playing = !r.playing;
  if (r.playing) r.at = Date.now();
  _fbrPaint();
}
