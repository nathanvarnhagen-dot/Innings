// ═══ BASKETBALL LIVE COURT (v7.46.0) ═══════════════════════════════════
// The NBA/WNBA twin of the football field and baseball's plate-appearance
// takeover: a full 94-foot hardwood floor inside a dark arena apron, each
// key painted for the team defending that end, a spotlight on the end with
// the ball, every shot of the game as a dot on the floor, the newest shot
// arcing to the rim, a team-color takeover over the floor (full for a
// three, a dunk, a block or a steal; lite for any other make), a fixed-
// height tracking panel under it, and a shot clock counted down from the
// last reset (ESPN sends none) as the main clock in the score bar.
// Like the field, nothing animates on first open — only changes seen while
// watching; every animation carries a negative delay so the 6-second
// re-render resumes it mid-flight instead of replaying it.
window._bkx = null;
var BKX_W = 940, BKX_H = 500; // 10 px per foot

function _bkxTeam(m, side) { return side === 'h' ? m.home : (side === 'a' ? m.away : null); }
function _bkxOther(side) { return side === 'h' ? 'a' : (side === 'a' ? 'h' : null); }
function _bkxSecs(clock) {
  var s = String(clock || '');
  var mm = s.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (mm) return Number(mm[1]) * 60 + Number(mm[2]);
  var n = Number(s);
  return isNaN(n) ? null : n;
}
// ESPN's spot (x across the floor 0–50 ft, y feet out from the basket) →
// court pixels. The away team shoots at the left basket, home at the right.
function _bkxPt(x, y, side) {
  var cx = Math.max(0, Math.min(50, x)) * 10, cy = Math.max(-2, Math.min(47, y)) * 10;
  if (side === 'h') return { x: BKX_W - 52.5 - cy, y: BKX_H - cx };
  return { x: 52.5 + cy, y: cx };
}
function _bkxRim(side) { return side === 'h' ? { x: BKX_W - 52.5, y: 250 } : { x: 52.5, y: 250 }; }

// What kind of moment the newest play is (null → the court only)
function _bkxMoment(lp, m) {
  if (!lp) return null;
  var t = String(lp.type + ' ' + lp.text);
  if (lp.kind === 'shot' && lp.blocker) return { tier: 'full', side: _bkxOther(lp.side), title: 'BLOCK', who: lp.blocker + (lp.shooter ? ' on ' + lp.shooter : ''), stx: lp.ft != null ? [[lp.ft, 'FT']] : [] };
  if (lp.kind === 'to' && lp.stealer) return { tier: 'full', side: _bkxOther(lp.side), title: 'STEAL', who: lp.stealer + (lp.who ? ' off ' + lp.who : ''), stx: [] };
  if (lp.kind !== 'shot' || !lp.made) return null;
  var dunk = /dunk|alley/i.test(t), three = lp.pts === 3 || /three/i.test(t);
  var title = three ? 'THREE' : dunk ? 'DUNK' : /hook/i.test(t) ? 'HOOK' : /floater|floating/i.test(t) ? 'FLOATER' : /layup|lay-up/i.test(t) ? 'LAYUP' : /tip/i.test(t) ? 'TIP-IN' : /fadeaway|fade away/i.test(t) ? 'FADEAWAY' : /step back/i.test(t) ? 'STEP-BACK' : /pull-?up/i.test(t) ? 'PULL-UP' : 'JUMPER';
  var stx = [];
  if (lp.ft != null) stx.push([lp.ft, 'FT']);
  if (lp.sc != null) stx.push([lp.sc < 5 ? lp.sc.toFixed(1) : Math.ceil(lp.sc), 'ON THE 24']);
  return { tier: three || dunk ? 'full' : 'lite', side: lp.side, title: title, who: (lp.who || '') + (lp.ft != null ? ' · ' + lp.ft + ' ft' : '') + (lp.assist ? ' · ' + lp.assist + ' assist' : ''), stx: stx };
}

function _bkxTrack(m) {
  var g = window._activeBrowseGame, pk = g ? String(g.gamePk) : '';
  var c = m.court || {};
  var now = Date.now();
  var st = window._bkx;
  if (st && st.pk === pk && st.m === m) return st; // already tracked this poll
  if (!st || st.pk !== pk) {
    st = window._bkx = { pk: pk, seeded: false, lastId: null, playAt: 0, shotId: null, shotAt: 0, poss: null, prevPoss: null, possAt: 0, to: null, clockSecs: null, clockAt: 0, running: false, period: null, ft: null, ftAt: 0, ftN: 0, ftDoneAt: 0 };
  }
  var lp = c.last || null, ls = c.lastShot || null;
  var secs = _bkxSecs(m.clock), per = m.period;
  var ft = c.ft || null, firstLook = !st.seeded;
  if (!st.seeded) {
    st.seeded = true; st.lastId = lp ? lp.id : null; st.shotId = ls ? ls.id : null; st.poss = c.poss || null; st.playAt = 0; st.shotAt = 0;
  } else {
    if (lp && lp.id !== st.lastId) {
      st.lastId = lp.id; st.playAt = now;
      var mo = _bkxMoment(lp, m);
      if (mo) st.to = Object.assign({ at: now }, mo);
    }
    if (ls && ls.id !== st.shotId) { st.shotId = ls.id; st.shotAt = now; }
    if ((c.poss || null) !== st.poss) { st.prevPoss = st.poss; st.poss = c.poss || null; st.possAt = now; }
  }
  // v7.50.0: the free-throw trip — kept after the log moves on, so the
  // card stays up through the last shot and a beat after it
  if (ft) {
    if (!st.ft || st.ft.id !== ft.id) { st.ft = ft; st.ftAt = now; st.ftN = ft.results.length; st.ftDoneAt = ft.done ? (firstLook ? now - 9e5 : now) : 0; if (firstLook) st.ftAt = now - 9e5; }
    else if (ft.results.length !== st.ftN) { st.ft = ft; st.ftAt = now; st.ftN = ft.results.length; if (ft.done && !st.ftDoneAt) st.ftDoneAt = now; }
    else st.ft = ft;
    if (ft.done && !st.ftDoneAt) st.ftDoneAt = now;
  } else if (st.ft && !st.ft.done) { st.ft.done = true; st.ftDoneAt = now; } // the log moved on past the trip
  // the game clock moved since the last poll → it's running (tick between polls)
  if (secs != null) {
    if (st.srvSecs != null && per === st.period) st.running = secs !== st.srvSecs;
    else {
      // first look: the clock is running unless the log says play is stopped
      var lk = lp ? lp.kind : '';
      st.running = secs > 0 && !/half|end of|intermission/i.test(m.statusDetail || '') && lk !== 'timeout' && lk !== 'period' && !(ft && !ft.done);
    }
    if (ft && !ft.done) st.running = false; // the clock stops for free throws
    // v7.50.1: the feed's clock trails the floor by a few seconds and arrives
    // in 4-second steps; the one on screen keeps ticking through a poll and
    // only snaps when the feed disagrees by more than a few seconds (or play
    // stopped, or the period changed)
    var local = st.clockSecs != null && per === st.period ? st.clockSecs - (st.wasRunning ? (now - st.clockAt) / 1000 : 0) : null;
    if (local == null || !st.running || !st.wasRunning || Math.abs(local - secs) > 4) { st.clockSecs = secs; st.clockAt = now; }
    else { st.clockSecs = Math.max(0, local); st.clockAt = now; }
    st.srvSecs = secs; st.wasRunning = st.running;
    st.period = per;
  } else { st.running = false; st.wasRunning = false; }
  st.m = m;
  return st;
}

// The shot clock right now, from the last reset the play-by-play implies
function _bkxShotClock(m, st) {
  var c = m.court, sc = c && c.sc;
  if (!sc || sc.at == null || st.clockSecs == null) return null;
  var live = st.clockSecs - (st.running ? (Date.now() - st.clockAt) / 1000 : 0);
  if (live < 0) live = 0;
  var reset = sc.reset || 24, at = sc.at;
  if (sc.period !== m.period) { reset = 24; at = m.period > 4 ? 300 : (c.periodSecs || 720); }
  var v = reset - (at - live);
  if (v > reset) v = reset;
  if (v > live) v = live;
  if (v < 0) v = 0;
  return { v: v, reset: reset, running: st.running && live > 0 };
}
function _bkxClockText(v) { return v < 5 ? v.toFixed(1) : String(Math.ceil(v)); }
// v7.50.0: the game clock right now — counted down from the last poll
// while play is running, the way the arena clock does
function _bkxGameClock(m, st) {
  if (!st || st.clockSecs == null) return m.clock || '';
  var v = st.clockSecs - (st.running ? (Date.now() - st.clockAt) / 1000 : 0);
  if (v < 0) v = 0;
  if (v < 60) return v.toFixed(1);
  var mm = Math.floor(v / 60), ss = Math.floor(v - mm * 60);
  return mm + ':' + (ss < 10 ? '0' : '') + ss;
}
function _bkxClockState(v) { return v <= 5 ? 'crit' : (v <= 10 ? 'warn' : ''); }

// The score bar's center: the 24 as a draining ring, the game clock as its caption
function _bkxCenterHtml(m, pt) {
  var st = _bkxTrack(m);
  var sc = _bkxBreak(m) ? null : _bkxShotClock(m, st);
  var poss = _bkxTeam(m, st.poss);
  var col = poss ? poss.colors.accent : '#A89FE8';
  var ring = sc ? '<div class="bkx-sc ' + _bkxClockState(sc.v) + '" id="bkx-sc" style="--c:' + col + '"><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="4"/><circle id="bkx-sc-ring" cx="24" cy="24" r="20" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="125.7" stroke-dashoffset="' + (125.7 * (1 - sc.v / sc.reset)).toFixed(1) + '"/></svg><b id="bkx-sc-num">' + _bkxClockText(sc.v) + '</b></div>' : '';
  return '<div class="bkx-ctr" style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">' +
    '<div style="display:flex;align-items:center;gap:8px">' + ring + '<div style="display:flex;flex-direction:column;align-items:center">' +
      '<span class="gh-num' + (ring ? ' bkx-gc' : '') + '" style="font-size:' + (ring ? '15px' : '22px') + ';line-height:1">' + _escapeHtml(ring ? (_bkxGameClockOr(m, st, pt.small)) : pt.big) + '</span>' +
      '<span class="' + (ring ? '' : 'bkx-gc') + '" style="font-size:10.5px;font-weight:700;letter-spacing:.06em;color:#9C95D0;white-space:nowrap">' + _escapeHtml(ring ? pt.big : (pt.small || '')) + '</span></div></div></div>';
}

function _bkxGameClockOr(m, st, fallback) { return (m.phase === 'live' && m.clock && !/half|end of|intermission/i.test(m.statusDetail || '')) ? _bkxGameClock(m, st) : (fallback || ''); }
// Ticks the ring between polls (started by the strip render, stops itself
// when the basketball hero is gone)
window._bkxTimer = null;
function _bkxStartTick() {
  if (window._bkxTimer) return;
  window._bkxTimer = setInterval(function () {
    var gp = window._gdPregame, m = gp && gp.gx, st = window._bkx;
    var num = document.getElementById('bkx-sc-num');
    if (!m || m.sport !== 'basketball' || m.phase !== 'live' || !st || !num) {
      if (!num) { clearInterval(window._bkxTimer); window._bkxTimer = null; }
      return;
    }
    // the game clock, everywhere it shows (score bar, collapsed scorebug)
    if (m.clock && !/half|end of|intermission/i.test(m.statusDetail || '')) {
      var gc = _bkxGameClock(m, st);
      document.querySelectorAll('.bkx-gc').forEach(function (el) { if (el.textContent !== gc) el.textContent = gc; });
    }
    var ftEl = document.getElementById('bkx-ft');
    if (ftEl && st.ft && st.ft.done && st.ftDoneAt && Date.now() - st.ftDoneAt > 4500) ftEl.classList.add('out');
    var sc = _bkxShotClock(m, st);
    if (!sc) return;
    var txt = _bkxClockText(sc.v);
    if (num.textContent !== txt) num.textContent = txt;
    var ring = document.getElementById('bkx-sc-ring');
    if (ring) ring.style.strokeDashoffset = (125.7 * (1 - sc.v / sc.reset)).toFixed(1);
    var wrap = document.getElementById('bkx-sc');
    if (wrap) { var cls = 'bkx-sc ' + _bkxClockState(sc.v); if (wrap.className !== cls) wrap.className = cls; }
    var fc = document.getElementById('bkx-fc-num');
    if (fc && fc.textContent !== txt) fc.textContent = txt;
  }, 100);
}

function _bkxCourtHtml(m, st) {
  var c = m.court || {}, now = Date.now();
  // v7.50.1: nothing on the floor changed and nothing is mid-animation →
  // the same markup as last time, so the poll leaves the floor's DOM alone
  var ftk = st.ft ? st.ft.id + ':' + st.ft.results.length + ':' + (st.ft.done ? 1 : 0) + ':' + (st.ft.done && st.ftDoneAt && now - st.ftDoneAt > 4500 ? 'x' : '') : '';
  var brk = _bkxBreak(m);
  // v7.51.2: the break card is spliced in at the end, so its numbers can
  // change without the floor being rebuilt
  var key = [c.lastShot && c.lastShot.id, c.last && c.last.id, st.poss, ftk, st.to ? st.to.at : 0, (c.shots || []).length, m.away.abbr, m.home.abbr, brk ? brk.key : ''].join('|');
  var quiet = (!st.shotAt || now - st.shotAt > 6500) && (!st.to || now - st.to.at > 3500) && (!st.possAt || now - st.possAt > 1500) && (!st.ftAt || now - st.ftAt > 6500);
  if (st.courtKey === key && st.courtHtml && quiet) {
    var scq = brk ? null : _bkxShotClock(m, st);
    var cached = scq ? st.courtHtml.replace(/(id="bkx-fc-num">)[^<]*/, '$1' + _bkxClockText(scq.v)) : st.courtHtml;
    return cached.replace('<!--bkx-brk-->', _bkxBreakHtml(m, st));
  }
  var id = 'bkx' + String(st.pk || '').replace(/\W/g, ''); // v7.51.2: stable per game — a fresh id every render changed every fill on the floor
  var A = m.away, H = m.home;
  var aC = A.colors.bg, hC = H.colors.bg, aA = A.colors.accent, hA = H.colors.accent;
  var F = 'font-family="-apple-system,Helvetica,sans-serif"';
  var h = '<svg viewBox="0 0 ' + BKX_W + ' ' + BKX_H + '" role="img" aria-label="Court">' +
    '<defs><pattern id="' + id + 'pl" width="' + BKX_W + '" height="26" patternUnits="userSpaceOnUse"><rect width="' + BKX_W + '" height="26" fill="#5C3F27"/><rect width="' + BKX_W + '" height="13" fill="#634429"/><rect y="12" width="' + BKX_W + '" height="1" fill="rgba(0,0,0,.28)"/><rect y="25" width="' + BKX_W + '" height="1" fill="rgba(0,0,0,.35)"/><rect x="180" width="1" height="13" fill="rgba(0,0,0,.25)"/><rect x="560" y="13" width="1" height="13" fill="rgba(0,0,0,.25)"/><rect x="760" width="1" height="13" fill="rgba(0,0,0,.25)"/></pattern>' +
    '<linearGradient id="' + id + 'sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>' +
    '<filter id="' + id + 'gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
    '<rect width="' + BKX_W + '" height="' + BKX_H + '" fill="url(#' + id + 'pl)"/><rect width="' + BKX_W + '" height="' + BKX_H + '" fill="url(#' + id + 'sh)"/>' +
    // keys painted for the team defending each end
    '<rect y="170" width="190" height="160" fill="' + aC + '" opacity=".85"/><rect x="750" y="170" width="190" height="160" fill="' + hC + '" opacity=".85"/>' +
    '<circle cx="470" cy="250" r="60" fill="rgba(0,0,0,.12)"/>' +
    '<g fill="none" stroke="#F3EBDD" stroke-width="3"><rect x="2" y="2" width="936" height="496"/><line x1="470" y1="0" x2="470" y2="500"/><circle cx="470" cy="250" r="60"/>' +
    '<rect y="170" width="190" height="160"/><path d="M0 30 H142 A237.5 237.5 0 0 1 142 470 H0" stroke="' + aA + '" stroke-width="4"/><circle cx="190" cy="250" r="60"/><path d="M52.5 210 A40 40 0 0 1 52.5 290"/>' +
    '<rect x="750" y="170" width="190" height="160"/><path d="M940 30 H798 A237.5 237.5 0 0 0 798 470 H940" stroke="' + hA + '" stroke-width="4"/><circle cx="750" cy="250" r="60"/><path d="M887.5 210 A40 40 0 0 0 887.5 290"/></g>' +
    '<line x1="40" y1="220" x2="40" y2="280" stroke="#F3EBDD" stroke-width="5"/><circle cx="52.5" cy="250" r="10" fill="none" stroke="#E8532A" stroke-width="4"/>' +
    '<line x1="900" y1="220" x2="900" y2="280" stroke="#F3EBDD" stroke-width="5"/><circle cx="887.5" cy="250" r="10" fill="none" stroke="#E8532A" stroke-width="4"/>' +
    '<text x="110" y="470" font-size="26" font-weight="900" fill="' + aA + '" opacity=".75" text-anchor="middle" letter-spacing="2" ' + F + '>' + _escapeHtml(A.abbr || '') + '</text>' +
    '<text x="830" y="470" font-size="26" font-weight="900" fill="' + hA + '" opacity=".75" text-anchor="middle" letter-spacing="2" ' + F + '>' + _escapeHtml(H.abbr || '') + '</text>';
  // every shot of the game so far (the newest one is drawn with its arc)
  var ls = c.lastShot;
  (c.shots || []).forEach(function (s) {
    if (ls && s.id === ls.id) return;
    var p = _bkxPt(s.x, s.y, s.s), t = _bkxTeam(m, s.s);
    var col = t ? t.colors.accent : '#A89FE8';
    if (s.m) h += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="7" fill="' + col + '" opacity=".85"/>';
    else h += '<path d="M' + (p.x - 5).toFixed(1) + ' ' + (p.y - 5).toFixed(1) + 'l10 10M' + (p.x + 5).toFixed(1) + ' ' + (p.y - 5).toFixed(1) + 'l-10 10" stroke="rgba(255,122,122,.75)" stroke-width="3" stroke-linecap="round"/>';
  });
  // the newest shot: its arc to the rim, the ball, the rim ringing (made) or a cross (missed)
  if (ls && ls.x != null) {
    var sp = _bkxPt(ls.x, ls.y, ls.side), rim = _bkxRim(ls.side), t2 = _bkxTeam(m, ls.side);
    var col2 = t2 ? t2.colors.accent : '#FFFFFF';
    var fresh = st.shotAt && now - st.shotAt < 6000;
    var dl = 'animation-delay:' + (-(now - st.shotAt)) + 'ms';
    var mx = (sp.x + rim.x) / 2, my = Math.min(sp.y, rim.y) - Math.max(40, Math.abs(sp.x - rim.x) * .35);
    var d = 'M' + sp.x.toFixed(1) + ' ' + sp.y.toFixed(1) + ' Q' + mx.toFixed(1) + ' ' + my.toFixed(1) + ' ' + rim.x + ' ' + rim.y;
    if (fresh) {
      h += '<path d="' + d + '" pathLength="1" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" filter="url(#' + id + 'gl)" class="fbx-trail-glow" style="' + dl + '"/>' +
        '<path d="' + d + '" pathLength="1" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-dasharray="1" class="fbx-trail" style="' + dl + '"/>' +
        '<g transform="translate(' + rim.x + ',' + rim.y + ')"><g class="bkx-fly" style="--dx:' + (sp.x - rim.x).toFixed(1) + ';--dy:' + (sp.y - rim.y).toFixed(1) + ';' + dl + '"><circle r="11" fill="#E8762C" stroke="#fff" stroke-width="2"/><path d="M-11 0H11M0 -11V0 11" fill="none" stroke="#3A1A08" stroke-width="1.4"/></g></g>';
      if (ls.made) h += '<circle class="bkx-ring" cx="' + rim.x + '" cy="' + rim.y + '" r="14" fill="none" stroke="' + col2 + '" stroke-width="7" style="animation-delay:' + (1000 - (now - st.shotAt)) + 'ms"/>';
      else h += '<g class="bkx-x" style="animation-delay:' + (1000 - (now - st.shotAt)) + 'ms"><path d="M' + (rim.x - 16) + ' ' + (rim.y - 16) + 'l32 32M' + (rim.x + 16) + ' ' + (rim.y - 16) + 'l-32 32" stroke="#FF7A7A" stroke-width="8" stroke-linecap="round"/></g>';
    }
    // where it was taken from stays marked
    if (ls.made) h += '<circle cx="' + sp.x.toFixed(1) + '" cy="' + sp.y.toFixed(1) + '" r="9" fill="' + col2 + '" stroke="#fff" stroke-width="3"/>';
    else h += '<path d="M' + (sp.x - 6).toFixed(1) + ' ' + (sp.y - 6).toFixed(1) + 'l12 12M' + (sp.x + 6).toFixed(1) + ' ' + (sp.y - 6).toFixed(1) + 'l-12 12" stroke="#FF7A7A" stroke-width="4" stroke-linecap="round"/>';
  }
  h += '</svg>';

  // the spotlight on the end with the ball; it slides across on a change of possession
  var tx = function (side) { return side === 'h' ? 16.67 : (side === 'a' ? -16.67 : 0); };
  var moved = st.prevPoss !== null && st.possAt && now - st.possAt < 1400;
  var spot = '<div class="bkx-spot' + (moved ? ' mv' : '') + '" style="--tx:' + tx(st.poss) + '%;--tx0:' + tx(moved ? st.prevPoss : st.poss) + '%;animation-delay:' + (-(now - st.possAt)) + 'ms"></div>';

  // takeover over the floor (the apron stays)
  var over = '';
  var to = st.to;
  if (to && now - to.at < 3400) {
    var tm = _bkxTeam(m, to.side) || m.home;
    var nm = _fbxTeamName(tm);
    over = '<div class="fbx-to bkx-to' + (to.tier === 'lite' ? ' pat-lite' : '') + '" style="--t0:' + (-(now - to.at)) + 'ms;--t1:' + tm.colors.bg + ';--t2:' + _fbxSecond(tm) + ';--tdark:' + _fbxDark(tm.colors.bg, .5) + '">' +
      '<div class="bg"></div><div class="st b"></div><div class="st"></div><div class="sk"></div>' +
      '<div class="ct">' + (to.tier === 'lite' ? '' : '<span class="lg">' + _escapeHtml(tm.abbr || '') + '</span>') +
      '<div class="wd"><span class="sm">' + _escapeHtml(to.title) + '</span>' +
      (to.tier === 'lite' ? '' : '<span class="bg2' + (nm.length > 10 ? ' long' : '') + '">' + _escapeHtml(nm) + '</span>') +
      '<span class="who">' + _escapeHtml(to.who) + '</span>' +
      (to.stx && to.stx.length ? '<span class="stx">' + to.stx.map(function (s) { return '<span>' + _escapeHtml(String(s[0])) + '<small>' + _escapeHtml(s[1]) + '</small></span>'; }).join('') + '</span>' : '') +
      '<span class="ln"></span></div></div></div>';
  }
  over += _bkxFtHtml(m, st);
  over += '<!--bkx-brk-->';
  // the shot clock hanging over the baseline at the lit end
  var sc = brk ? null : _bkxShotClock(m, st);
  var fc = sc ? '<div class="bkx-fc ' + (st.poss === 'h' ? 'r' : 'l') + '"><b id="bkx-fc-num">' + _bkxClockText(sc.v) + '</b></div>' : '';
  var out = '<div class="bkx-arena" style="--ra:' + aA + ';--rh:' + hA + '">' + fc + '<div class="bkx-floor">' + h + spot + over + '</div></div>';
  st.courtKey = key; st.courtHtml = out;
  return out.replace('<!--bkx-brk-->', _bkxBreakHtml(m, st));
}

// ── v7.51.0: the break between quarters, halftime, the end of regulation
// and the final — a card over the floor with the score, who's carrying each
// team and the numbers that explain the gap so far.
function _bkxBreak(m) {
  var a = m.away, h = m.home, sd = String(m.statusDetail || ''), lp = m.court && m.court.last;
  var per = m.period || 0;
  var ord = function (n) { return n === 1 ? '1ST' : n === 2 ? '2ND' : n === 3 ? '3RD' : n + 'TH'; };
  var otTag = function (n) { return n <= 4 ? '' : (n === 5 ? 'OT' : (n - 4) + 'OT'); };
  if (m.phase === 'final') {
    var ot = per > 4 ? ' \u00b7 ' + otTag(per) : (/\/\s*(\d*)OT/i.test(sd) ? ' \u00b7 ' + sd.replace(/^.*\/\s*/, '').toUpperCase() : '');
    var w = (a.score || 0) > (h.score || 0) ? a : ((h.score || 0) > (a.score || 0) ? h : null);
    return { key: 'final', lb: 'FINAL' + ot, sub: w ? (w.short || w.name) + ' win' : 'Tied', acc: w ? w.colors.bg : '#A89FE8', win: w };
  }
  if (m.phase !== 'live') return null;
  // v7.51.1: the card lives only while the clock sits at zero (or the feed
  // still says the break); the moment the next period's clock runs, it's gone
  var clockZero = /^0?\.0$|^0:00$/.test(String(m.clock || ''));
  if (!clockZero && !/half|end of/i.test(sd)) return null;
  var endOf = sd.match(/end of (?:the )?(\d)(?:st|nd|rd|th)|end of (?:the )?(\d*)\s*OT/i);
  var lpEnd = lp && lp.kind === 'period' && /end of/i.test(lp.text || '') && String(m.clock || '') === '0.0' && lp.period === per;
  if ((/half/i.test(sd) && (per <= 2 || clockZero)) || (lpEnd && per === 2)) return { key: 'half', lb: 'HALFTIME', sub: _bkxLeadText(m), acc: '#A89FE8' };
  if (endOf || lpEnd || (/^0?\.0$|^0:00$/.test(String(m.clock || '')) && lp && lp.kind === 'period')) {
    var n = endOf && endOf[1] ? Number(endOf[1]) : per;
    var isOt = (endOf && endOf[2] != null) || n > 4;
    if (per > n && !clockZero) return null; // the feed's status is behind the clock
    if (!isOt && n === 4 && a.score === h.score) return { key: 'reg', lb: 'END OF REGULATION', sub: 'Overtime is next', acc: '#5AB0FF' };
    if (isOt && a.score === h.score) return { key: 'ot' + n, lb: 'END OF ' + (otTag(n) || 'OT'), sub: 'More overtime', acc: '#5AB0FF' };
    return { key: 'q' + n, lb: 'END OF ' + (isOt ? (otTag(n) || 'OT') : ord(n)), sub: _bkxLeadText(m), acc: '#A89FE8' };
  }
  return null;
}
function _bkxLeadText(m) {
  var a = m.away, h = m.home;
  if (a.score == null || h.score == null) return '';
  if (a.score === h.score) return 'All tied';
  var L = a.score > h.score ? a : h;
  return (L.short || L.name) + ' by ' + Math.abs(a.score - h.score);
}
function _bkxBreakHtml(m, st) {
  var br = _bkxBreak(m);
  if (!br) return '';
  var now = Date.now(), a = m.away, h = m.home;
  var lo = function (x, y) { return x != null && y != null && x < y ? ' class="lo"' : ''; };
  // who's carrying each team, then the team numbers behind the score
  var rows = [], pts = (m.leaders || []).filter(function (l) { return l.label === 'PTS'; })[0];
  if (pts && (pts.a || pts.h)) rows.push({ l: 'Leading scorer', a: pts.a ? _patLastOr(pts.a.name) + ' ' + (pts.a.value != null ? pts.a.value : '') : '\u2014', h: pts.h ? _patLastOr(pts.h.name) + ' ' + (pts.h.value != null ? pts.h.value : '') : '\u2014', an: pts.a ? pts.a.value : null, hn: pts.h ? pts.h.value : null });
  var reb = (m.leaders || []).filter(function (l) { return l.label === 'REB'; })[0];
  (m.teamStats || []).forEach(function (r) {
    if (rows.length >= 5) return;
    var lower = !!r[5];
    rows.push({ l: r[0], a: String(r[1]), h: String(r[2]), an: lower ? -r[3] : r[3], hn: lower ? -r[4] : r[4] });
  });
  var s2 = m.situation || {};
  if (s2.momA != null && s2.momH != null && rows.length < 5 && (s2.momA || s2.momH)) rows.push({ l: 'Last 8 scores', a: String(s2.momA), h: String(s2.momH), an: s2.momA, hn: s2.momH });
  var grid = rows.map(function (r, i) {
    var aw = r.an != null && r.hn != null && r.an > r.hn, hw = r.an != null && r.hn != null && r.hn > r.an;
    return '<div class="bkx-brs" style="animation-delay:calc(var(--t0) + ' + (420 + i * 70) + 'ms)"><span class="v' + (aw ? ' w' : '') + '" style="--c:' + a.colors.accent + '">' + _escapeHtml(r.a) + '</span><span class="k">' + _escapeHtml(r.l) + '</span><span class="v r' + (hw ? ' w' : '') + '" style="--c:' + h.colors.accent + '">' + _escapeHtml(r.h) + '</span></div>';
  }).join('');
  if (st.brkKey !== br.key) { st.brkKey = br.key; st.brkAt = st.seeded && st.m ? now : now - 60000; }
  var t0 = now - st.brkAt > 2500 ? -60000 : -(now - st.brkAt); // frozen once played: a later poll only changes the numbers
  return '<div class="fbx-brk bkx-brk" style="--t0:' + t0 + 'ms;--acc:' + br.acc + '">' +
    '<div class="sc"><span style="color:' + a.colors.accent + '">' + _escapeHtml(a.abbr) + '</span> <b' + lo(a.score, h.score) + '>' + (a.score != null ? a.score : '\u2013') + '</b> &nbsp;\u00b7&nbsp; <span style="color:' + h.colors.accent + '">' + _escapeHtml(h.abbr) + '</span> <b' + lo(h.score, a.score) + '>' + (h.score != null ? h.score : '\u2013') + '</b></div>' +
    '<div class="lb">' + _escapeHtml(br.lb) + '</div><div class="rl"></div>' + (br.sub ? '<div class="sb">' + _escapeHtml(br.sub) + '</div>' : '') +
    (grid ? '<div class="bkx-brg">' + grid + '</div>' : '') + '</div>';
}
function _patLastOr(name) { return typeof _ghLastName === 'function' ? _ghLastName(name || '') : String(name || '').split(' ').pop(); }

// ── v7.50.0: free throws. A card over the lit end while someone's at the
// line: the shooter, one ball per shot he gets (1, 2 or 3), each one
// filling in as it's made or missed, and the card holds until the last
// one is shot and a beat after.
function _bkxFtHtml(m, st) {
  var ft = st.ft;
  if (!ft) return '';
  var now = Date.now();
  if (ft.done && st.ftDoneAt && now - st.ftDoneAt > 4500) return '';
  var tm = _bkxTeam(m, ft.side) || m.home, acc = tm.colors.accent, bg = tm.colors.bg;
  var fresh = st.ftAt && now - st.ftAt < 2500 ? -(now - st.ftAt) : -99000;
  var balls = '';
  for (var i = 0; i < ft.n; i++) {
    var r = ft.results[i], cur = r == null && i === ft.results.length;
    var cls = r === true ? 'in' : r === false ? 'miss' : cur ? 'up' : '';
    var newest = r != null && i === ft.results.length - 1;
    balls += '<span class="bkx-ftb ' + cls + '"' + (newest ? ' style="animation-delay:' + fresh + 'ms"' : '') + '>' +
      '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/><path d="M3 20H37M20 3V37M8 8c6 6 6 18 0 24M32 8c-6 6-6 18 0 24"/></svg>' +
      (r === true ? '<i class="ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></i>' : r === false ? '<i class="no"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M7 7l10 10M17 7L7 17"/></svg></i>' : '') + '</span>';
  }
  var made = ft.results.filter(function (x) { return x; }).length;
  var sm = (ft.kind ? ft.kind.toUpperCase() + ' · ' : '') + (ft.n === 1 ? 'FREE THROW' : ft.n + ' FREE THROWS');
  var line = ft.done ? (made === ft.n ? (ft.n === 1 ? 'Good' : 'Both good' + (ft.n === 3 ? ' — all three' : '')).replace('Both good — all three', 'All three') : made === 0 ? (ft.n === 1 ? 'Missed' : 'Missed ' + (ft.n === 2 ? 'both' : 'all ' + ft.n)) : made + ' of ' + ft.n) : ('Shot ' + (ft.results.length + 1) + ' of ' + ft.n);
  return '<div id="bkx-ft" class="bkx-ft ' + (ft.side === 'h' ? 'r' : 'l') + (ft.done ? ' done' : '') + '" style="--t1:' + bg + ';--t2:' + acc + '">' +
    '<span class="sm">' + _escapeHtml(sm) + '</span><span class="who">' + _escapeHtml(ft.who || '') + '</span>' +
    '<span class="balls">' + balls + '</span><span class="ln">' + _escapeHtml(line) + '</span></div>';
}

// ── The tracking panel under the floor: the last shot, until the next one
function _bkxBoxRow(m, side, pid, name) {
  var box = m.box && m.box[side === 'h' ? 'home' : 'away'];
  if (!box) return null;
  var out = null;
  (box.sections || []).forEach(function (sec) {
    (sec.rows || []).forEach(function (r) {
      if (out) return;
      if ((pid && String(r.id) === String(pid)) || (name && _ghLastName(r.name) === name)) out = { cols: sec.cols, cells: r.cells, name: r.name };
    });
  });
  return out;
}
function _bkxPanelHtml(m, st) {
  var c = m.court || {}, ls = c.lastShot;
  var lab = '<span class="pap-hl">LAST SHOT' + (ls && ls.clock ? ' · ' + _escapeHtml((ls.period <= 4 ? 'Q' + ls.period : 'OT') + ' ' + ls.clock) : '') + '</span>';
  if (!ls) return '<div class="pap pap-e"><div class="pap-hd">' + lab + '</div><div class="pap-empty">Every shot shows here as it happens</div></div>';
  var t = _bkxTeam(m, ls.side), acc = t ? t.colors.accent : '#A89FE8';
  var rows = [], badge = '';
  var tt = String(ls.type + ' ' + ls.text);
  var typ = /dunk|alley/i.test(tt) ? 'DUNK' : /layup|lay-up/i.test(tt) ? 'LAYUP' : /hook/i.test(tt) ? 'HOOK' : /floater|floating/i.test(tt) ? 'FLOATER' : /tip/i.test(tt) ? 'TIP' : /fade/i.test(tt) ? 'FADEAWAY' : /step back/i.test(tt) ? 'STEP-BACK' : /pull-?up/i.test(tt) ? 'PULL-UP' : /bank/i.test(tt) ? 'BANK' : (ls.pts === 3 || /three/i.test(tt)) ? 'THREE' : 'JUMPER';
  rows.push({ l: ls.made ? 'Made' : (ls.blocker ? 'Blocked' : 'Missed'), v: ls.ft != null ? ls.ft : '\u2014', u: ls.ft != null ? 'ft' : '', em: typ });
  var br = _bkxBoxRow(m, ls.side, ls.whoId, ls.who);
  if (br) {
    var pi = br.cols.indexOf('PTS'), fi = br.cols.indexOf('FG');
    var fg = fi >= 0 ? String(br.cells[fi] || '') : '', fgm = fg.match(/^(\d+)-(\d+)$/);
    rows.push({ l: ls.who || 'Shooter', v: pi >= 0 ? br.cells[pi] : '—', u: 'pts', em: fg ? fg + ' FG' : 'TONIGHT', p: fgm && Number(fgm[2]) ? Math.round(Number(fgm[1]) / Number(fgm[2]) * 100) : null, pc: acc });
  }
  if (ls.made) rows.push({ l: 'Assist', txt: ls.assist || 'Unassisted' });
  else if (ls.blocker) rows.push({ l: 'Blocked by', txt: ls.blocker });
  if (ls.sc != null) rows.push({ l: 'Released', v: ls.sc < 5 ? ls.sc.toFixed(1) : Math.ceil(ls.sc), u: 'on the 24' });
  if (ls.as != null && ls.hs != null) rows.push({ l: 'Score', txt: ls.as === ls.hs ? 'Tied ' + ls.as + '–' + ls.hs : (ls.as > ls.hs ? m.away.abbr + ' by ' + (ls.as - ls.hs) : m.home.abbr + ' by ' + (ls.hs - ls.as)) });
  var s = m.situation || {};
  if (s.momA != null && Math.abs(s.momA - s.momH) >= 6) rows.push({ l: 'Last 8', txt: (s.momA > s.momH ? m.away.abbr + ' ' + s.momA + '–' + s.momH : m.home.abbr + ' ' + s.momH + '–' + s.momA) });
  rows = rows.slice(0, 6);
  // badge: the longest make so far, or the reason the play-by-play flagged it
  if (ls.made && ls.ft != null) {
    var longest = (c.shots || []).filter(function (x) { return x.m; }).length > 1;
    var maxFt = 0;
    (m.highlights || []).forEach(function (p) { var mm = String(p.head || '').match(/(\d+)-foot/); if (mm) maxFt = Math.max(maxFt, Number(mm[1])); });
    var flag = (m.highlights || []).filter(function (p) { return p.id === ls.id; })[0];
    if (flag && flag.sub) badge = flag.sub;
    else if (longest && ls.ft >= 28) badge = ls.ft + '-footer';
  }
  var E = st.shotAt ? (Date.now() - st.shotAt) / 1000 : 99;
  var still = E > 8;
  var html = '<div class="pap-g' + (rows.length % 2 ? ' odd' : '') + '">' + rows.map(function (r, i) {
    var delay = (1.2 + i * .11 - E);
    var val = r.txt ? '<span class="pap-tx">' + _escapeHtml(r.txt) + '</span>' : '<span class="pap-v">' + _escapeHtml(String(r.v)) + (r.u ? '<small>' + _escapeHtml(r.u) + '</small>' : '') + '</span>';
    var bar = r.p != null ? '<span class="pap-bar"><i style="width:' + r.p + '%;background:' + r.pc + '"></i><b style="left:calc((100% - 24px) * ' + (r.p / 100).toFixed(2) + ');background:' + r.pc + '">' + r.p + '</b></span>' : '';
    return '<div class="pap-r"' + (still ? '' : ' style="animation-delay:' + delay.toFixed(2) + 's"') + '><span class="pap-l">' + _escapeHtml(r.l) + (r.em ? '<em>' + _escapeHtml(r.em) + '</em>' : '') + '</span>' + val + bar + '</div>';
  }).join('') + '</div>';
  var bd = badge ? '<span class="pap-bd"' + (still ? '' : ' style="animation-delay:' + (1.3 + rows.length * .11 - E).toFixed(2) + 's"') + '><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.8L20 10l-5 3.6L16.8 20 12 16.6 7.2 20 9 13.6 4 10l6.1-1.2z"/></svg><span>' + _escapeHtml(badge) + '</span></span>' : '';
  return '<div class="pap bkx-pap' + (still ? ' pap-still' : '') + '"><div class="pap-hd">' + lab + (bd || '<span class="pap-lg" style="color:' + acc + '">' + _escapeHtml(t ? t.abbr : '') + ' BALL</span>') + '</div>' + html + '</div>';
}

// The strip: arena + panel (the run bar stays underneath, from the hero)
function _bkxStripHtml(m, runHtml) {
  var st = _bkxTrack(m);
  setTimeout(_bkxStartTick, 0);
  return '<div class="gh-panel gh-strip bkx" style="display:flex;flex-direction:column;gap:10px">' + _bkxCourtHtml(m, st) + _bkxPanelHtml(m, st) + (runHtml || '') + '</div>';
}
