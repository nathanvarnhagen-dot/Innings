// ═══ AT-BAT STAGE (v7.14.0) ═══════════════════════════════════════════
// The live at-bat square as one stage: the zone / play animation fills it,
// the play result sits top-left on glass, a glass rail on the right holds
// the count, the last pitch (with its league velo percentile) and ABS
// challenges left, and a pitcher-vs-batter bar runs along the bottom.
// Under it: the pitches as one strip (velo percentile bubbles) and a
// fixed-height Savant percentiles card. The PLAY / DEFENSE switch swaps
// the square for the fielding team's positions.
// The rail slides off to the right while a ball hit to deep right field
// is on screen, so it never covers the play.
// Depends on: _escapeHtml, _clickablePlayerNameHtml, _ghLastName,
// _pitchCallColor, _patPct/_PAT_LG (pa-takeover.js), _savPlayerData,
// _savPctColor (statcast.js), _bvp (statcast.js), _absAbbr.

window._gstLastCount = window._gstLastCount || {};
window._gstDef = false;

function _gstPct(p) {
  if (!p || typeof _patPct !== 'function' || typeof _PAT_LG === 'undefined') return null;
  var mph = p.mph != null ? p.mph : p.speed;
  return _patPct(mph != null ? Number(mph) : null, _PAT_LG.velo[p.code]);
}
function _gstBubble(p, cls) {
  if (p == null) return '';
  var col = typeof _savPctColor === 'function' ? _savPctColor(p) : '#A89FE8';
  return '<span class="' + cls + '" style="background:' + col + '">' + p + '</span>';
}
function _gstPitchName(p) { return (typeof _PAT_NM !== 'undefined' && p && p.code && _PAT_NM[p.code]) || (p && p.type) || ''; }
function _gstShortCall(c) { return String(c || '').replace(/^Called Strike$/i, 'Called strike').replace(/^Swinging Strike.*$/i, 'Whiff').replace(/^In play.*$/i, 'In play').replace(/^Foul Tip$/i, 'Foul tip'); }
function _gstOrd(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

// ── v7.15.0: the mini rail across the top of the square. B / S / O each
// get a stack of bulbs and a rolling number wheel; the last pitch's speed
// rolls on amber wheels at the right end with its call and velo percentile.
// Every render draws the wheels at the PREVIOUS value and the bulbs as they
// were, then _gstRailRoll() moves them to the new one, so a change rolls
// and lights up instead of snapping.
window._gstLastVelo = window._gstLastVelo || {};
var _GST_WH = 28; // wheel window height
function _gstWheel(cls, from, to, max) {
  var d = ''; for (var i = 0; i <= max; i++) d += '<i>' + i + '</i>';
  return '<span class="gst-mw' + (cls ? ' ' + cls : '') + '"><span class="gst-ms" style="transform:translateY(' + (-from * _GST_WH) + 'px)"' + (from !== to ? ' data-to="' + (-to * _GST_WH) + '"' : '') + '>' + d + '</span></span>';
}
function _gstPips(n, was, slots) {
  var h = '';
  for (var i = 0; i < slots; i++) { var on = i < n, w = was == null ? on : i < was; h += '<i class="gst-pip' + (w ? ' on' : '') + '"' + (w !== on ? ' data-on="' + (on ? 1 : 0) + '"' : '') + '></i>'; }
  return '<span class="gst-pips">' + h + '</span>';
}
function _gstRailHtml(s, seq, box) {
  var b = s.balls != null ? Math.min(3, s.balls) : 0, k = s.strikes != null ? Math.min(2, s.strikes) : 0, o = s.outs != null ? Math.min(3, s.outs) : 0;
  var g = window._activeBrowseGame, pk = g ? String(g.gamePk) : '';
  var last = window._gstLastCount[pk] || null;
  window._gstLastCount[pk] = { b: b, k: k, o: o };
  var grp = function (cls, lab, n, was, slots, max) {
    return '<span class="gst-mg ' + cls + '"><span class="gst-ml">' + lab + '</span>' + _gstPips(n, was, slots) + _gstWheel('', was == null ? n : was, n, max) + '</span>';
  };
  var h = '<div class="gst-mr" role="group" aria-label="Count: ' + b + ' balls, ' + k + ' strikes, ' + o + (o === 1 ? ' out' : ' outs') + '">' +
    grp('b', 'B', b, last && last.b, 3, 3) + grp('s', 'S', k, last && last.k, 2, 2) + grp('o', 'O', o, last && last.o, 2, 3);
  var ps = (seq && seq.pitches) || [], lp = ps.length ? ps[ps.length - 1] : null;
  var mph = lp ? (lp.mph != null ? lp.mph : lp.speed) : null;
  if (mph != null && !isNaN(Number(mph))) {
    var v = String(Math.round(Number(mph))), pv = window._gstLastVelo[pk];
    window._gstLastVelo[pk] = v;
    if (!pv || pv.length !== v.length) pv = v;
    var wheels = '';
    for (var i = 0; i < v.length; i++) wheels += _gstWheel('v', Number(pv.charAt(i)), Number(v.charAt(i)), 9);
    var pc = _gstPct(lp), col = pc != null && typeof _savPctColor === 'function' ? _savPctColor(pc) : null;
    h += '<span class="gst-mv" aria-label="Last pitch ' + _escapeHtml(v) + ' miles an hour"><span class="gst-dv"></span><span class="gst-mws">' + wheels + '</span>' +
      '<span class="gst-mm"><span>' + _escapeHtml(_gstPitchName(lp)) + '</span>' + (lp.call ? '<span style="color:' + _pitchCallColor(lp.call) + ';filter:brightness(1.25);font-weight:700">' + _escapeHtml(_gstShortCall(lp.call)) + '</span>' : '') + '</span>' +
      (col ? '<span class="gst-lamp" style="background:' + col + ';box-shadow:0 0 10px ' + col + '" title="Velo percentile for that pitch type">' + pc + '</span>' : '') + '</span>';
  } else {
    h += '<span class="gst-mv gst-mv0"><span class="gst-dv"></span>First pitch coming</span>';
  }
  clearTimeout(window._gstRollT);
  window._gstRollT = setTimeout(_gstRailRoll, 30);
  return h + '</div>';
}
function _gstRailRoll() {
  var st = document.getElementById('gh-stage');
  if (!st) return;
  var wheels = st.querySelectorAll('.gst-ms[data-to]'), pips = st.querySelectorAll('.gst-pip[data-on]');
  if (!wheels.length && !pips.length) return;
  void st.offsetHeight; // the starting position has to be laid out before it moves
  requestAnimationFrame(function () {
    wheels.forEach(function (w) { w.style.transform = 'translateY(' + w.getAttribute('data-to') + 'px)'; w.removeAttribute('data-to'); });
    pips.forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-on') === '1'); p.removeAttribute('data-on'); });
  });
}
function _gstAbsHtml(box) {
  var c = box && box.absChallenges;
  if (!(c && c.away && c.home && c.away.remaining != null && c.home.remaining != null)) return '';
  return '<div class="gst-absc">ABS left <b>' + _escapeHtml(_absAbbr(box, 'away')) + ' ' + c.away.remaining + ' · ' + _escapeHtml(_absAbbr(box, 'home')) + ' ' + c.home.remaining + '</b></div>';
}

// ── bottom bar: pitcher | batter, season line + today / vs him
function _gstL3Html(mp, mb, box) {
  var side = function (label, p, right, bar) {
    if (!p) return '<div class="gst-l3s' + (right ? ' r' : '') + '"></div>';
    var nm = _clickablePlayerNameHtml(p, 'mlb').replace('>' + _escapeHtml(p.name) + '<', '>' + _escapeHtml(_ghLastName(p.name)) + '<');
    return '<div class="gst-l3s' + (right ? ' r' : '') + '"><span class="gst-bar" style="background:' + bar + '"></span><span class="gst-k">' + label + '</span>' +
      '<span class="gst-nm">' + nm + '</span>' + (p.line ? '<span class="gst-sl">' + _escapeHtml(p.line) + '</span>' : '') +
      (right && p.pinchFor ? '<span class="gh-ph">PH for ' + _escapeHtml(p.pinchFor) + '</span>' : '') + '</div>';
  };
  var colorOf = function (half) { // the team's light color (the bug's stripe)
    var key = half === 'away' ? 'awayAbbr' : 'homeAbbr';
    var c = typeof _ghTeamColors === 'function' ? _ghTeamColors(box && box[key]) : null;
    return (c && c.accent) || '#A89FE8';
  };
  var s = (box && box.situation) || {};
  var pitSide = s.half === 'top' ? 'home' : 'away', batSide = s.half === 'top' ? 'away' : 'home';
  // second line: today's pitching, and the hitter's career line vs him
  var today = '', vs = '';
  var t = mp && mp.today;
  if (t) today = [t.ip != null ? t.ip + ' IP' : null, t.tp != null ? t.tp + ' P' : null].filter(Boolean).join(' · ');
  var v = (mb && mp && mb.id && mp.id && typeof _bvp === 'function') ? _bvp(mb.id, mp.id) : null;
  if (v) vs = v.pa ? (v.h + '-' + v.ab + ' vs him · ' + v.hr + ' HR · ' + v.rbi + ' RBI') : 'First meeting';
  return '<div class="gst-l3">' + side('Pitching', mp, false, colorOf(pitSide)) + side('At bat', mb, true, colorOf(batSide)) +
    '<div class="gst-l3t">' + _escapeHtml(today ? 'Today ' + today : '') + '</div><div class="gst-l3t r">' + _escapeHtml(vs) + '</div></div>';
}

// ── the at-bat's pitches, newest first, with velo percentile bubbles
function _gstStripHtml(seq, box, s) {
  var ps = (seq && seq.pitches) || [];
  if (!ps.length) return '<div class="gst-strip gst-none">No pitches yet this at-bat</div>';
  return '<div class="gst-strip" role="list" aria-label="Pitches this at-bat">' + ps.slice().reverse().map(function (p, i) {
    var c = _pitchCallColor(p.call), pc = _gstPct(p), mph = p.mph != null ? p.mph : p.speed;
    var call = String(p.call || '').replace(/^Called Strike$/i, 'Called').replace(/^Swinging Strike.*$/i, 'Whiff').replace(/^In play.*$/i, 'In play');
    var sel = window._patSel && String(window._patSel.abi) === String(seq.atBatIndex) && String(window._patSel.num) === String(p.num);
    return '<button type="button" class="gst-pc' + (i === 0 ? ' now' : '') + (sel ? ' sel' : '') + '" role="listitem" data-k="p' + seq.atBatIndex + '_' + p.num + '" onclick="if(typeof _patPick===\'function\')_patPick(' + JSON.stringify(String(seq.atBatIndex)).replace(/"/g, '&quot;') + ',' + JSON.stringify(String(p.num)).replace(/"/g, '&quot;') + ')" aria-label="Pitch ' + _escapeHtml(String(p.num)) + ': ' + _escapeHtml([mph != null ? Math.round(Number(mph)) + ' mph' : '', p.type, p.call].filter(Boolean).join(', ')) + '"><i style="background:' + c + '"></i>' +
      '<b>' + (mph != null ? _escapeHtml(String(Math.round(Number(mph)))) : '—') + '</b><span>' + _escapeHtml(_gstPitchName(p)) + '</span>' +
      '<em style="color:' + c + '">' + _escapeHtml(call) + '</em>' + (p.abs ? '<em class="gst-absb">ABS</em>' : '') + (pc != null ? _gstBubble(pc, 'gst-pb') : '<span class="gst-pb gst-pb0"></span>') + '</button>';
  }).join('') + '</div>' + '<div class="gst-cap">Bubbles: velo percentile for that pitch type, league-wide</div>';
}

// ── Savant percentiles: pitcher + batter, four each, fixed height so a
// late arrival never moves the page
var _GST_P = [/^k ?%/i, /^whiff/i, /^chase/i, /^xera/i];
var _GST_B = [/^xwoba/i, /^barrel/i, /^hard.?hit/i, /^chase/i];
function _gstPicks(list, res) {
  list = list || [];
  var out = [], used = {};
  res.forEach(function (re) { var x = list.filter(function (y) { return re.test(y.label || '') && !used[y.label]; })[0]; if (x) { out.push(x); used[x.label] = 1; } });
  list.filter(function (y) { return !used[y.label] && y.pct != null; }).sort(function (a, b) { return b.pct - a.pct; }).forEach(function (y) { if (out.length < 4) out.push(y); });
  return out.slice(0, 4);
}
function _gstSavantHtml(mp, mb, box) {
  if (!mp && !mb) return '';
  var col = function (p, role, res) {
    var nm = p ? _clickablePlayerNameHtml(p, 'mlb').replace('>' + _escapeHtml(p.name) + '<', '>' + _escapeHtml(_ghLastName(p.name)) + '<') : '';
    var d = p && p.id && typeof _savPlayerData === 'function' ? _savPlayerData(p.id) : null;
    var list = d && d[role] ? _gstPicks(d[role].percentiles, res) : [];
    var rows = '';
    for (var i = 0; i < 4; i++) {
      var x = list[i];
      if (x) {
        var v = Math.max(1, Math.min(100, Math.round(x.pct))), c = _savPctColor(v);
        rows += '<div class="gst-sr"><span>' + _escapeHtml(typeof _savShortLabel === 'function' ? _savShortLabel(x.label) : x.label) + '</span><span class="gst-trk"><i style="left:calc((100% - 20px) * ' + (v / 100).toFixed(2) + ' + 10px);background:' + c + '">' + v + '</i></span></div>';
      } else rows += '<div class="gst-sr gst-sr0"><span></span><span class="gst-trk"></span></div>';
    }
    return '<div class="gst-svc"><div class="gst-svh">' + nm + '</div>' + rows + '</div>';
  };
  return '<div class="gst-sv"><div class="gst-svt"><span>SAVANT PERCENTILES</span><span>TAP A NAME FOR ALL</span></div><div class="gst-svg">' +
    col(mp, 'pitcher', _GST_P) + col(mb, 'batter', _GST_B) + '</div></div>';
}

// ── Defense: who's where for the team in the field. Positions are the
// standard spots; the feed doesn't carry where they're actually standing.
// Same 500×386 field as the play animation.
var _GST_DPOS = { P: [250, 290], C: [250, 372], '1B': [312, 262], '2B': [288, 222], SS: [212, 222], '3B': [188, 262], LF: [128, 160], CF: [250, 128], RF: [372, 160] };
var _GST_VB = [24, 66, 452, 344]; // the cropped field, same aspect as the square
// v7.14.2: each name sits right behind its fielder — straight out from
// home plate (the pitcher's toward second, the catcher's toward the backstop)
var _GST_BEHIND = 27;
function _gstDefenseHtml(box) {
  var d = box && box.matchup && box.matchup.defense;
  if (!d) return '';
  var s = box.situation || {}, side = s.half === 'top' ? 'home' : 'away';
  var abbr = side === 'home' ? (box.homeAbbr || '') : (box.awayAbbr || '');
  var c = typeof _ghTeamColors === 'function' ? _ghTeamColors(abbr) : { bg: '#3D3580', accent: '#A89FE8' };
  var dots = '', labels = '';
  Object.keys(_GST_DPOS).forEach(function (pos) {
    var pl = d[pos]; if (!pl) return;
    var xy = _GST_DPOS[pos];
    dots += '<ellipse cx="' + xy[0] + '" cy="' + xy[1] + '" rx="8" ry="8" fill="' + c.bg + '" stroke="' + (c.accent || '#fff') + '" stroke-width="2.4"/>';
    var vx = xy[0] - 250, vy = xy[1] - 366, len = Math.sqrt(vx * vx + vy * vy) || 1;
    if (pos === 'C') { vx = 0; vy = 1; len = 1; }
    var bx = xy[0] + vx / len * _GST_BEHIND, by = xy[1] + vy / len * (pos === 'C' ? 22 : _GST_BEHIND);
    if (pos === 'SS') bx -= 16; if (pos === '2B') bx += 16; // middle infielders' names lean apart
    var lx = (bx - _GST_VB[0]) / _GST_VB[2] * 100, ly = (by - _GST_VB[1]) / _GST_VB[3] * 100;
    labels += '<button type="button" class="gst-fl" style="left:' + lx.toFixed(1) + '%;top:' + ly.toFixed(1) + '%" data-name="' + _escapeHtml(pl.name || '') + '" data-id="' + _escapeHtml(String(pl.id)) + '" data-league="mlb" onclick="openPlayerLinkSheet(this.dataset.name,this.dataset.id,this.dataset.league)"><small>' + pos + '</small>' + _escapeHtml(_ghLastName(pl.name || '').replace(/\s+(Jr\.?|Sr\.?|II|III|IV)$/i, '')) + '</button>';
  });
  return '<div class="gst-def" id="gh-def" aria-label="' + _escapeHtml(abbr) + ' defense"><svg viewBox="' + _GST_VB.join(' ') + '" preserveAspectRatio="none" aria-hidden="true">' + _gstFieldSvgInner() + dots + '</svg>' + labels + '</div>';
}
function _gstFieldSvgInner() {
  return '<rect x="-200" y="-200" width="900" height="800" fill="#0F0B26"/>' +
    '<path d="M250 366 L58 174 Q250 20 442 174 Z" fill="#2C6542"/>' +
    '<path d="M58 174 Q250 20 442 174" fill="none" stroke="#F1EDE4" stroke-opacity=".55" stroke-width="2"/>' +
    '<path d="M250 362 L150 262 Q250 150 350 262 Z" fill="#A06C48"/>' +
    '<path d="M250 366 L170 286 L250 206 L330 286 Z" fill="#367A4C" stroke="#F1EDE4" stroke-opacity=".85" stroke-width="1.8"/>' +
    '<path d="M250 366 L58 174 M250 366 L442 174" stroke="#F1EDE4" stroke-opacity=".7" stroke-width="1.8"/>' +
    '<circle cx="250" cy="290" r="11" fill="#A06C48"/>' +
    '<rect x="244" y="200" width="12" height="12" transform="rotate(45 250 206)" fill="#fff"/><rect x="324" y="280" width="12" height="12" transform="rotate(45 330 286)" fill="#fff"/><rect x="164" y="280" width="12" height="12" transform="rotate(45 170 286)" fill="#fff"/>';
}
function _gstFieldAbbr(box) { var s = (box && box.situation) || {}; return (s.half === 'top' ? box.homeAbbr : box.awayAbbr) || ''; }
function _gstToggleHtml(box) {
  if (!(box && box.matchup && box.matchup.defense)) return '';
  return '<div class="gst-tg" role="group" aria-label="Field view"><button type="button" class="' + (window._gstDef ? '' : 'on') + '" onclick="gstSetDefense(false)" aria-pressed="' + (!window._gstDef) + '">PLAY</button>' +
    '<button type="button" class="' + (window._gstDef ? 'on' : '') + '" onclick="gstSetDefense(true)" aria-pressed="' + (!!window._gstDef) + '">' + _escapeHtml(_gstFieldAbbr(box)) + ' DEFENSE</button></div>';
}
function gstSetDefense(on) {
  window._gstDef = !!on;
  var st = document.getElementById('gh-stage');
  if (st) {
    st.classList.toggle('def', window._gstDef);
    document.querySelectorAll('.gst-tg button').forEach(function (b, i) { var lit = i === 1 ? window._gstDef : !window._gstDef; b.classList.toggle('on', lit); b.setAttribute('aria-pressed', String(lit)); });
  }
}

// ── the rail steps aside for balls hit to deep right field
function _gstDeepRight(lp) {
  if (!lp || typeof _paLanding !== 'function') return false;
  var land = _paLanding(lp);
  if (!land) return false;
  return land.ang >= 14 && land.y <= 215; // right-center to the line, outfield depth
}
function _gstRailSync() {
  var st = document.getElementById('gh-stage');
  clearTimeout(window._gstRailT1); clearTimeout(window._gstRailT2);
  if (!st) return;
  var s = window._pa;
  var on = !!(s && s.play && s.startAt && typeof _paActive === 'function' && _paActive() && _gstDeepRight(s.play));
  if (!on) { st.classList.remove('rail-out'); return; }
  var E = (Date.now() - s.startAt) / 1000;
  var OFF = s.seq ? Math.max(0, ((s.play.pitches || []).length - 1)) * .85 : 0;
  var tIn = (typeof PA !== 'undefined' ? PA.SW : 2.4) + OFF - .2, tOut = (s.total || (typeof PA !== 'undefined' ? PA.END : 14)) + OFF * 0;
  var now = function () { var el = document.getElementById('gh-stage'); if (el) el.classList.add('rail-out'); };
  var back = function () { var el = document.getElementById('gh-stage'); if (el) el.classList.remove('rail-out'); };
  if (E >= tIn) now(); else { st.classList.remove('rail-out'); window._gstRailT1 = setTimeout(now, (tIn - E) * 1000); }
  window._gstRailT2 = setTimeout(back, Math.max(0, tOut - E) * 1000);
}
(function () {
  if (typeof _paFill !== 'function') return;
  var orig = _paFill;
  _paFill = function () { var r = orig.apply(this, arguments); try { _gstRailSync(); } catch (e) { console.error('[stage rail]', e); } return r; };
})();
// a tapped chip lights up with the Statcast panel's pick
(function () {
  if (typeof _patPick !== 'function') return;
  var orig = _patPick;
  _patPick = function (abi, num) {
    var r = orig.apply(this, arguments);
    var sel = window._patSel;
    document.querySelectorAll('.gst-strip .gst-pc').forEach(function (b) {
      var k = b.getAttribute('data-k') || '';
      b.classList.toggle('sel', !!(sel && k === 'p' + sel.abi + '_' + sel.num));
    });
    return r;
  };
})();
