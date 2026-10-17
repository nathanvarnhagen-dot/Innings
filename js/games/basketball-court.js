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

// The score bar's center (v7.52.0, the "Dial"): the 24 is a ring in the
// color of the team with the ball, eroding clockwise from 12 with the
// seconds riding its leading edge; inside it a dark ball with that team's
// seams carries the game clock on a band. Under five seconds the game
// clock steps aside, the ball flushes red and the seconds take the middle.
var BKX_L = 219.9; // circumference of the r=35 ring
function _bkxDialArc(v, reset) {
  var rem = BKX_L * Math.max(0, Math.min(1, v / reset));
  var ang = -Math.PI / 2 + Math.PI * 2 * (1 - v / reset);
  return { da: rem.toFixed(1) + ' ' + (BKX_L * 2).toFixed(1), off: (-(BKX_L - rem)).toFixed(1), tx: (Math.cos(ang) * 35).toFixed(1), ty: (Math.sin(ang) * 35).toFixed(1) };
}
function _bkxCenterHtml(m, pt) {
  var st = _bkxTrack(m);
  var sc = _bkxBreak(m) ? null : _bkxShotClock(m, st);
  var poss = _bkxTeam(m, st.poss);
  var col = poss ? poss.colors.accent : '#A89FE8';
  if (!sc) {
    return '<div class="bkx-ctr" style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">' +
      '<span class="gh-num" style="font-size:22px;line-height:1">' + _escapeHtml(pt.big) + '</span>' +
      '<span class="bkx-gc" style="font-size:10.5px;font-weight:700;letter-spacing:.06em;color:#9C95D0;white-space:nowrap">' + _escapeHtml(pt.small || '') + '</span></div>';
  }
  var a = _bkxDialArc(sc.v, sc.reset), txt = _bkxClockText(sc.v);
  var ball = '<svg class="ball" viewBox="0 0 58 58" aria-hidden="true"><defs><radialGradient id="bkxDialSh" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs><circle class="body" cx="29" cy="29" r="28"/><g class="seam" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="M29 1v56M1 29h56"/><path d="M9 9c9 8 9 32 0 40M49 9c-9 8-9 32 0 40"/></g><circle cx="29" cy="29" r="28" fill="url(#bkxDialSh)"/></svg>';
  return '<div class="bkx-ctr" style="display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0">' +
    '<div class="bkx-dial ' + _bkxClockState(sc.v) + '" id="bkx-sc" style="--c:' + col + ';--b1:' + col + '" role="timer" aria-label="Shot clock ' + _escapeHtml(txt) + ', game clock ' + _escapeHtml(_bkxGameClockOr(m, st, pt.small)) + '">' +
      '<svg class="ring" viewBox="0 0 80 80" aria-hidden="true"><circle class="trk" cx="40" cy="40" r="35"/><circle id="bkx-sc-ring" class="arc" cx="40" cy="40" r="35" stroke-dasharray="' + a.da + '" stroke-dashoffset="' + a.off + '"/></svg>' +
      ball + '<span class="band"></span>' +
      '<div class="in"><span class="gc bkx-gc">' + _escapeHtml(_bkxGameClockOr(m, st, pt.small)) + '</span></div>' +
      '<span class="tip" id="bkx-sc-num" style="transform:translate(' + a.tx + 'px,' + a.ty + 'px)">' + _escapeHtml(txt) + '</span>' +
      '<span class="big" id="bkx-sc-big">' + _escapeHtml(txt) + '</span>' +
      '<span class="gc-top bkx-gc" aria-hidden="true">' + _escapeHtml(_bkxGameClockOr(m, st, pt.small)) + '</span></div>' +
    '<span style="font-size:10.5px;font-weight:800;letter-spacing:.12em;color:#9C95D0;white-space:nowrap">' + _escapeHtml(pt.big) + '</span></div>';
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
    var txt = _bkxClockText(sc.v), a = _bkxDialArc(sc.v, sc.reset);
    if (num.textContent !== txt) num.textContent = txt;
    num.style.transform = 'translate(' + a.tx + 'px,' + a.ty + 'px)';
    var big = document.getElementById('bkx-sc-big');
    if (big && big.textContent !== txt) big.textContent = txt;
    var ring = document.getElementById('bkx-sc-ring');
    if (ring) { ring.setAttribute('stroke-dasharray', a.da); ring.setAttribute('stroke-dashoffset', a.off); }
    var wrap = document.getElementById('bkx-sc');
    if (wrap) { var cls = 'bkx-dial ' + _bkxClockState(sc.v); if (wrap.className !== cls) wrap.className = cls; }
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
    return cached.replace('<!--bkx-brk-->', _bkxBreakHtml(m, st) || _bkxTimeoutHtml(m, st));
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
  return out.replace('<!--bkx-brk-->', _bkxBreakHtml(m, st) || _bkxTimeoutHtml(m, st));
}

// ── v7.53.0: the run chip under the score of a team on a run (8+ unanswered,
// or 10+ with one answer). Appears with a pop, warms as the run grows, and is
// gone the moment the other side scores.
function _bkxRunChipHtml(m, side) {
  var r = m.situation && m.situation.run;
  if (!r || r.side !== side || m.phase !== 'live') return '';
  var st = window._bkx;
  var key = r.side + ':' + r.pts + '-' + r.opp;
  var now = Date.now();
  if (st) { if (st.runKey !== key) { st.runAt = st.runKey && st.runKey.split(':')[0] === r.side ? st.runAt : now; st.runGrewAt = now; st.runKey = key; } }
  var fresh = st && st.runAt && now - st.runAt < 600 ? ' in' : '';
  var grew = st && st.runGrewAt && now - st.runGrewAt < 600 && !fresh ? ' grew' : '';
  var hot = r.pts >= 12 ? ' hot' : '';
  var since = r.since && r.sincePeriod && r.sincePeriod !== r.period ? ' \u00b7 since Q' + r.sincePeriod : '';
  return '<span class="bkx-runchip' + fresh + grew + hot + '" role="status">' +
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 1-3s0 3 2 3c0-4 2-6 2-10z"/></svg>' +
    '<b>' + r.pts + '\u2013' + r.opp + ' RUN</b>' + (since ? '<small>' + _escapeHtml(since) + '</small>' : '') + '</span>';
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
  // v7.52.1: the clock at zero is the end of the period, whatever the feed's
  // status or last play say yet
  if (clockZero && !/half|end of/i.test(sd) && !(lp && lp.kind === 'period')) lp = { kind: 'period', text: 'End of period', period: per };
  var endOf = sd.match(/end of (?:the )?(\d)(?:st|nd|rd|th)|end of (?:the )?(\d*)\s*OT/i);
  var lpEnd = lp && lp.kind === 'period' && /end of/i.test(lp.text || '') && clockZero && lp.period === per;
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
  return '<div class="gh-panel gh-strip bkx" style="display:flex;flex-direction:column;gap:10px">' + _bkxCourtHtml(m, st) + _bkxPanelHtml(m, st) + (runHtml || '') + _bkxBoardHtml(m) + '</div>';
}

// ── v7.55.0: TIMEOUT — a card over the floor in the colors of the team that
// called it (neutral for an official timeout): which kind, when, how many
// they've used, and the run that made them call it. Up until the clock runs.
function _bkxTimeoutHtml(m, st) {
  var c = m.court, t = c && c.timeout;
  if (!t || m.phase !== 'live' || st.running) return '';
  var now = Date.now(), a = m.away, h = m.home;
  var tm = _bkxTeam(m, t.side), official = t.kind === 'official' || !tm;
  var bg = official ? '#3D3580' : tm.colors.bg, acc = official ? '#A89FE8' : tm.colors.accent;
  if (st.tmoKey !== t.id) { st.tmoKey = t.id; st.tmoAt = st.seeded && st.m ? now : now - 60000; }
  var t0 = now - st.tmoAt > 2500 ? -60000 : -(now - st.tmoAt);
  var ord = function (n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); };
  var when = (t.period ? (t.period <= 4 ? 'Q' + t.period : (t.period === 5 ? 'OT' : (t.period - 4) + 'OT')) : '') + (t.clock ? ' ' + t.clock : '');
  var bits = [];
  if (!official) bits.push(t.kind === 'short' ? '20 second' : 'Full');
  if (when) bits.push(when);
  if (!official && t.n) bits.push(ord(t.n) + ' of the game');
  // the run they're trying to stop
  var run = m.situation && m.situation.run, runT = run && _bkxTeam(m, run.side);
  var why = (run && !official && run.side !== t.side && runT) ? 'After a ' + run.pts + '\u2013' + run.opp + ' ' + (runT.short || runT.abbr) + ' run' : '';
  var lo = function (x, y) { return x != null && y != null && x < y ? ' class="lo"' : ''; };
  return '<div class="fbx-brk bkx-brk bkx-tmo" style="--t0:' + t0 + 'ms;--acc:' + acc + ';--tbg:' + bg + '">' +
    '<div class="sc"><span style="color:' + a.colors.accent + '">' + _escapeHtml(a.abbr) + '</span> <b' + lo(a.score, h.score) + '>' + (a.score != null ? a.score : '\u2013') + '</b> &nbsp;\u00b7&nbsp; <span style="color:' + h.colors.accent + '">' + _escapeHtml(h.abbr) + '</span> <b' + lo(h.score, a.score) + '>' + (h.score != null ? h.score : '\u2013') + '</b></div>' +
    '<div class="bkx-tmo-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9l4 2"/><circle cx="12" cy="12" r="9"/></svg></div>' +
    '<div class="lb">' + (official ? 'OFFICIAL TIMEOUT' : 'TIMEOUT \u00b7 ' + _escapeHtml(String(tm.short || tm.name || tm.abbr).toUpperCase())) + '</div><div class="rl"></div>' +
    (bits.length ? '<div class="sb">' + _escapeHtml(bits.join(' \u00b7 ')) + '</div>' : '') +
    (why ? '<div class="bkx-tmo-why">' + _escapeHtml(why) + '</div>' : '') + '</div>';
}

// ── v7.55.0: THE ARENA BOARD under the floor — what the big board at the
// arena shows: the five on the floor for each team (PTS REB AST PF), each
// team's numbers, the Four Factors, timeouts used and team fouls this period.
function _bkxOnFloor(m, side) {
  var box = m.box && m.box[side === 'h' ? 'home' : 'away'], rows = [];
  if (!box) return { rows: rows, live: false };
  var all = [];
  (box.sections || []).forEach(function (sec) { (sec.rows || []).forEach(function (r) { if (!r.dnp) all.push({ r: r, pi: sec.cols.indexOf('PTS'), ri: sec.cols.indexOf('REB'), ai: sec.cols.indexOf('AST') }); }); });
  var live = all.some(function (x) { return x.r.on != null; });
  var pick = live ? all.filter(function (x) { return x.r.on === 1; }) : all.slice(0, 5);
  if (live && !pick.length) { live = false; pick = all.slice(0, 5); }
  return { live: live, rows: pick.slice(0, 5).map(function (x) {
    var r = x.r, cell = function (i) { return i >= 0 && r.cells[i] != null && r.cells[i] !== '' ? String(r.cells[i]) : '0'; };
    return { name: r.name, id: r.id, pts: cell(x.pi), reb: cell(x.ri), ast: cell(x.ai), pf: r.pf != null ? String(r.pf) : '0' };
  }) };
}
function _bkxShortName(full) {
  var p = String(full || '').trim().split(/\s+/);
  if (p.length < 2) return full || '';
  return p[0].charAt(0) + '. ' + _ghLastName(full);
}
function _bkxBoardHtml(m) {
  var B = m.board;
  if (!B || (m.phase !== 'live' && m.phase !== 'final')) return '';
  var A = m.away, H = m.home, c = m.court || {};
  var v = function (x, pct) { return x == null ? '\u2013' : (pct ? (x === 100 ? '100' : x.toFixed(1)) : String(x)); };
  var teamBox = function (t, side, o) {
    var of = _bkxOnFloor(m, side), bg = t.colors.bg, acc = t.colors.accent;
    // v7.55.1: the two teams stack in one full-width table so names never truncate
    var rows = of.rows.map(function (r) {
      return '<div class="bkb-r"><span class="n">' + _gxPlayerLink(_bkxShortName(r.name), r.id, m.league, 'text-decoration:none') + '</span><b>' + _escapeHtml(r.pts) + '</b><span>' + _escapeHtml(r.reb) + '</span><span>' + _escapeHtml(r.ast) + '</span><span class="pf' + (Number(r.pf) >= 5 ? ' hot' : '') + '">' + _escapeHtml(r.pf) + '</span></div>';
    }).join('');
    var head = '<div class="bkb-tn">' + _escapeHtml(String(t.short || t.name || t.abbr).toUpperCase()) + '</div>';
    var stat = function (k, x, pct) { return '<div class="bkb-s"><span>' + k + '</span><b>' + v(x, pct) + '</b></div>'; };
    var stats = '<div class="bkb-stats">' + stat('AST', o.ast) + stat('BLK', o.blk) + stat('OREB', o.oreb) + stat('TO', o.to) + stat('DREB', o.dreb) + stat('POT', o.pot) + stat('STL', o.stl) + stat('PITP', o.pitp) +
      stat('2P%', o.twoPct, 1) + stat('FG%', o.fgPct, 1) + stat('3P%', o.tpPct, 1) + stat('FT%', o.ftPct, 1) + '</div>';
    return { floor: '<div class="bkb-blk" style="--tb:' + bg + ';--ta:' + acc + '">' + head + (rows || '<div class="bkb-none">Lineup not in yet</div>') + '</div>', stats: '<div class="bkb-box bkb-tm" style="--tb:' + bg + ';--ta:' + acc + '">' + stats + '</div>', live: of.live };
  };
  var ta = teamBox(A, 'a', B.a), th = teamBox(H, 'h', B.h);
  var live = ta.live || th.live;
  var pt = m.period ? (m.period <= 4 ? ['1ST', '2ND', '3RD', '4TH'][m.period - 1] + ' QTR' : (m.period === 5 ? 'OT' : (m.period - 4) + 'OT')) : '';
  var hdr = function (l, r) { return '<div class="bkb-eye"><span>' + l + '</span><span>' + (r || '') + '</span></div>'; };
  // four factors: a tug-of-war bar each, leader's number lit
  var ff = [['EFG%', B.a.efg, B.h.efg, 0], ['TO%', B.a.toPct, B.h.toPct, 1], ['OREB%', B.a.orebPct, B.h.orebPct, 0], ['FT RATE', B.a.ftRate, B.h.ftRate, 0]].map(function (f) {
    var x = f[1], y = f[2], lower = f[3], tot = (x || 0) + (y || 0);
    var aw = x != null && y != null && (lower ? x < y : x > y), hw = x != null && y != null && (lower ? y < x : y > x);
    var pa = tot ? Math.round((x || 0) / tot * 100) : 50;
    return '<div class="bkb-ff"><b class="' + (aw ? 'w' : '') + '" style="color:' + A.colors.accent + '">' + v(x, 1) + '</b><div class="m"><span>' + f[0] + '</span><div class="bar"><i style="width:' + pa + '%;background:' + A.colors.accent + '"></i><i style="flex:1;background:' + H.colors.accent + '"></i></div></div><b class="r ' + (hw ? 'w' : '') + '" style="color:' + H.colors.accent + '">' + v(y, 1) + '</b></div>';
  }).join('');
  var foot = function (t, side) {
    var tu = c.timeouts ? c.timeouts[side] : null, fl = c.fouls && c.foulsPeriod === m.period ? c.fouls[side] : null;
    return '<div class="bkb-ft" style="--tb:' + t.colors.bg + ';--ta:' + t.colors.accent + '"><span>TO USED <b>' + (tu != null ? tu : '\u2013') + '</b></span><span>FLS <b>' + (fl != null ? fl : '\u2013') + '</b>' + (fl != null && fl >= 4 ? '<em>BONUS</em>' : '') + '</span></div>';
  };
  return '<div class="bkb">' +
    hdr(live ? 'ON THE FLOOR' : 'STARTERS', pt + (m.clock && m.phase === 'live' ? ' \u00b7 <span class="bkx-gc">' + _escapeHtml(m.clock) + '</span>' : '')) +
    '<div class="bkb-fl"><div class="bkb-hd"><span></span><span>PTS</span><span>REB</span><span>AST</span><span>PF</span></div>' + ta.floor + th.floor + '</div>' +
    hdr('TEAM STATS') + '<div class="bkb-2">' + ta.stats + th.stats + '</div>' +
    hdr('FOUR FACTORS', 'PCT \u00b7 LEADER LIT') + '<div class="bkb-ffs">' + ff + '</div>' +
    (m.phase === 'live' ? '<div class="bkb-2">' + foot(A, 'a') + foot(H, 'h') + '</div>' : '') + '</div>';
}
