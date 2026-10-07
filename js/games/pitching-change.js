// ══ PITCHING CHANGE (v7.24.0) ═══════════════════════════════════════════
// When a new pitcher comes in, the at-bat square shows who's going out
// (his line today, dimmed, OUT) and who's coming in (his season and what
// he throws, IN), with an arrow drawn between them. It stays up until the
// new pitcher's first pitch.
// · A play's run still goes first; after it, this replaces the held
//   result card.
// · Only a change that happens while you're watching animates. Opening a
//   game mid-change shows it already in place. Replay runs it again.
// · Timed from when it was first seen, so the 15-second refresh picks the
//   animation up where it was (same as the play animation).
window._pcx = window._pcx || { pk: null, firstBox: null, seen: {} };

function _pcxPk() { var g = window._activeBrowseGame; return g && g.gamePk != null ? String(g.gamePk) : ''; }

// Is a new pitcher waiting to throw his first pitch? Returns what the card needs.
function _pcxNow(box) {
  if (!box) return null;
  // which box was the first one for this game (a change already up then doesn't animate)
  var pk = _pcxPk(), st = window._pcx;
  if (st.pk !== pk) { st.pk = pk; st.firstBox = box; st.seen = {}; }
  if (!box.matchup || !box.situation) return null;
  var s = box.situation, mp = box.matchup.pitcher;
  if (!mp || !mp.id || !mp.relief) return null;
  if (s.inningState === 'Middle' || s.inningState === 'End' || s.outs === 3) return null;
  if (typeof _patLiveNow === 'function' && !_patLiveNow(box)) return null;
  var tp = mp.today && mp.today.tp;
  if (tp != null ? tp > 0 : mp.bf > 0) return null;
  var side = s.half === 'top' ? 'home' : 'away';
  var det = box.boxScoreDetail && box.boxScoreDetail[side], list = (det && det.pitchers) || [];
  var ix = -1, outP = null;
  list.forEach(function (p, i) { if (String(p.id) === String(mp.id)) ix = i; });
  if (mp.replacedId != null) list.forEach(function (p) { if (String(p.id) === String(mp.replacedId)) outP = p; });
  if (!outP && ix > 0) outP = list[ix - 1];
  if (!outP && mp.replaced) outP = { name: mp.replaced };
  if (!outP) return null;
  var key = pk + ':' + mp.id;
  return { key: key, mp: mp, outP: outP, side: side, nth: mp.nth || (ix >= 0 ? ix + 1 : list.length + 1), at: st.seen[key], first: box === st.firstBox };
}
// the first time it's shown: animate, unless it was already up when the game opened
function _pcxMark(pc) {
  var st = window._pcx;
  if (!(pc.key in st.seen)) st.seen[pc.key] = pc.first ? 0 : Date.now();
  pc.at = st.seen[pc.key];
  return pc;
}

function _pcxOrd(n) { var t = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (t[(v - 20) % 10] || t[v] || t[0]); }
function _pcxLast(n) { return typeof _patLast === 'function' ? _patLast(n || '') : String(n || '').split(' ').pop(); }

function _pcxHtml(pc, box) {
  var mp = pc.mp, o = pc.outP, s = box.situation || {}, E = _escapeHtml;
  var abbr = mp.teamAbbr || (pc.side === 'home' ? (box.homeAbbr || _ghAbbrFallback(box.home || '')) : (box.awayAbbr || _ghAbbrFallback(box.away || '')));
  var c = typeof _ghTeamColors === 'function' ? _ghTeamColors(abbr) : { bg: '#3D3580', accent: '#CFC7FF' };
  var bg = c.bg || '#3D3580';
  var t2 = (c.accent && typeof _gxLum === 'function' && Math.abs(_gxLum(c.accent) - _gxLum(bg)) > .25) ? c.accent : '#FFFFFF';
  var dark = typeof _fbxDark === 'function' ? _fbxDark(bg, .5) : '#0b0716';
  var A = function (a) { return typeof _ghHexAlpha === 'function' ? _ghHexAlpha(t2, a) : 'rgba(255,255,255,' + a + ')'; };
  var team = (typeof _teamShortName === 'function' && _teamShortName(pc.side === 'home' ? box.home : box.away)) || abbr || '';
  var sit = [team, (s.half === 'top' ? '▲' : '▼') + (s.inning || ''), s.outs != null ? s.outs + (s.outs === 1 ? ' out' : ' outs') : ''].filter(Boolean).join(' · ');

  // going out: his line today
  var oName = _pcxLast(o.name), l1 = '', l2 = '';
  if (o.ip != null) {
    l1 = o.ip + ' IP · ' + (o.h || 0) + ' H · ' + (o.r || 0) + ' R · ' + (o.so || 0) + ' K';
    l2 = [o.np != null ? o.np + ' pitches' : '', o.strikes != null ? o.strikes + ' strikes' : '', o.bb ? o.bb + ' BB' : ''].filter(Boolean).join(' · ');
  } else l1 = 'Done for the day';

  // coming in: his season and what he throws
  var se = mp.season || null, i1 = '', i2 = '';
  if (se && se.era != null) i1 = [se.era + ' ERA', se.k != null ? se.k + ' K' : '', se.ip != null ? se.ip + ' IP' : ''].filter(Boolean).join(' · ');
  else if (mp.line) i1 = mp.line;
  var d = typeof _savPlayerData === 'function' ? _savPlayerData(mp.id) : null;
  var ars = ((d && d.pitcher && d.pitcher.arsenal) || []).filter(function (a) { return a && a.mph != null; }).sort(function (a, b) { return (b.usage || 0) - (a.usage || 0); }).slice(0, 2);
  if (ars.length) i2 = ars.map(function (a, i) { return (typeof _savPitchShort === 'function' ? _savPitchShort(a.name || a.code) : (a.name || a.code)) + ' ' + Math.round(a.mph) + (i === 0 ? ' mph' : ''); }).join(' · ');
  else if (se) i2 = [se.whip != null ? se.whip + ' WHIP' : '', se.sv ? se.sv + ' SV' : '', se.hld ? se.hld + ' HLD' : '', !se.sv && !se.hld && se.g != null ? se.g + ' G' : ''].filter(Boolean).join(' · ');

  var chips = [];
  if (pc.nth >= 2) chips.push({ t: _pcxOrd(pc.nth) + ' pitcher tonight', hi: true });
  var mb = box.matchup.batter, v = mb && mb.id && typeof _bvp === 'function' ? _bvp(mb.id, mp.id) : null;
  if (v) chips.push({ t: v.pa ? _pcxLast(mb.name) + ' ' + v.h + '-for-' + v.ab + ' vs him' : 'First look for ' + _pcxLast(mb.name) });
  if (se && se.sv) chips.push({ t: se.sv + (se.sv === 1 ? ' save' : ' saves') });
  else if (se && se.hld) chips.push({ t: se.hld + (se.hld === 1 ? ' hold' : ' holds') });

  var el = pc.at ? (Date.now() - pc.at) / 1000 : 99;
  var t0 = el < 6 ? (-el).toFixed(2) + 's' : '-60s';
  var hand = mp.hand ? mp.hand + 'HP' : '';
  var rp = '<button type="button" class="pcx-rp" onclick="event.stopPropagation();pcxReplay()" aria-label="Replay the pitching change"><span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></span></button>';
  return '<div class="pcx" data-pcx="' + E(pc.key) + '" style="--t0:' + t0 + ';--t1:' + bg + ';--t2:' + t2 + ';--tdark:' + dark + ';--t2a:' + A(.55) + ';--t2g:' + A(.3) + ';--t2s:' + A(.18) + '" role="status" aria-label="' + E('Pitching change. ' + (mp.name || '') + ' in for ' + (o.name || '') + (l1 && o.ip != null ? ', who went ' + l1 : '') + '.') + '">' +
    '<div class="pcx-hd"><span class="pcx-ey">PITCHING CHANGE</span><span class="pcx-sit">' + E(sit) + '</span>' + rp + '</div>' +
    '<div class="pcx-row pcx-o" aria-hidden="true"><span class="pcx-av">' + E(oName.charAt(0).toUpperCase()) + '</span><div class="pcx-w"><div class="pcx-nm">' + E(oName.toUpperCase()) + '</div>' +
      '<div class="pcx-l1">' + E(l1) + '</div>' + (l2 ? '<div class="pcx-l2">' + E(l2) + '</div>' : '') + '</div><span class="pcx-tag">OUT</span></div>' +
    '<svg class="pcx-ar" width="22" height="20" viewBox="0 0 22 20" fill="none" aria-hidden="true"><path d="M11 0 V17" stroke="#F2D98A" stroke-width="2.5" stroke-linecap="round"/><path class="hd" d="M5 12 L11 18 L17 12" stroke="#F2D98A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '<div class="pcx-row pcx-i" aria-hidden="true"><span class="pcx-av">' + E(_pcxLast(mp.name).charAt(0).toUpperCase()) + '</span><div class="pcx-w"><div class="pcx-nm">' + E(_pcxLast(mp.name).toUpperCase()) + (hand ? '<small>' + hand + '</small>' : '') + '</div>' +
      (i1 ? '<div class="pcx-l1">' + E(i1) + '</div>' : '') + (i2 ? '<div class="pcx-l2">' + E(i2) + '</div>' : '') + '</div><span class="pcx-tag">IN</span></div>' +
    (chips.length ? '<div class="pcx-ch" aria-hidden="true">' + chips.map(function (x) { return '<span' + (x.hi ? ' class="hi"' : '') + '>' + E(x.t) + '</span>'; }).join('') + '</div>' : '') +
    '</div>';
}

function pcxReplay() {
  var box = window._pa && window._pa.box, pc = box && _pcxNow(box);
  if (!pc) return;
  window._pcx.seen[pc.key] = Date.now();
  if (typeof _paFill === 'function') _paFill();
}

// a play's run just ended and a change is waiting: show it now, not at the next refresh
function _pcxAfterRun() {
  var s = window._pa, slot = document.getElementById('gh-pa-slot');
  if (!s || !s.box || !slot || slot.querySelector('.pcx')) return;
  if (typeof _paActive === 'function' && _paActive()) return;
  if (_pcxNow(s.box) && typeof _paFill === 'function') _paFill();
}

(function () {
  if (typeof _paOverlayHtml === 'function') {
    var prevOv = _paOverlayHtml;
    _paOverlayHtml = function () {
      var s = window._pa, box = s && s.box;
      try {
        if (box && s.labelOut && !s.quick && !s.keep && !s.seq && !(typeof _paActive === 'function' && _paActive())) {
          var pc = _pcxNow(box);
          if (pc) { s._labelHtml = ''; s._statsHtml = ''; return _pcxHtml(_pcxMark(pc), box); }
        }
      } catch (e) { console.error('[pitching change]', e); }
      return prevOv.apply(this, arguments);
    };
  }
  if (typeof _paFill === 'function') {
    var prevFill = _paFill;
    _paFill = function () {
      var r = prevFill.apply(this, arguments);
      try {
        var slot = document.getElementById('gh-pa-slot'), pf = slot && slot.parentNode;
        if (pf && pf.classList && slot.querySelector('.pcx')) pf.classList.add('pah-on'); // the play label and ABS note step aside, like for the result card
        clearTimeout(window._pcxT);
        var s = window._pa;
        if (s && s.box && s.startAt && typeof _paActive === 'function' && _paActive() && _pcxNow(s.box)) {
          window._pcxT = setTimeout(_pcxAfterRun, Math.max(0, ((s.total || (typeof PA !== 'undefined' ? PA.END : 14)) + .6) * 1000 - (Date.now() - s.startAt)) + 120);
        }
      } catch (e) { console.error('[pitching change]', e); }
      return r;
    };
  }
})();
