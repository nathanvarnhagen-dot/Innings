// ── ABS CHALLENGES (v6.3.0) ────────────────────────────────────────────
// From the Stats API: a challenged pitch carries `abs` {overturned,
// inProgress, side} (reviewType "MJ"); the box carries each team's
// remaining challenges. Shown on the pitch list line, as a ring on the
// pitch in the zone, as a notice over the at-bat square when it happens,
// and as "ABS challenges left" under the count.
function _absAbbr(box, side) {
  if (!box) return side === 'away' ? 'Away' : 'Home';
  return side === 'away' ? (box.awayAbbr || _ghAbbrFallback(box.away || '')) : (box.homeAbbr || _ghAbbrFallback(box.home || ''));
}
function _absResult(p) {
  var a = p.abs, call = String(p.call || '');
  var strike = /strike/i.test(call), ball = !strike && /\bball\b/i.test(call);
  if (a.inProgress) return { cls: 'rev', text: 'Under review' };
  if (a.overturned) return { cls: 'ov', text: 'Overturned' + (strike ? ' \u00b7 was a ball' : ball ? ' \u00b7 was a strike' : '') };
  return { cls: 'st', text: 'Call stands' };
}
function _absLineHtml(p, box, half, style) {
  var a = p && p.abs;
  if (!a) return '';
  var who = a.side ? _absAbbr(box, a.side) : 'Team';
  var bat = half === 'top' ? 'away' : half === 'bottom' ? 'home' : null;
  var role = a.side && bat ? (a.side === bat ? ' batter' : ' defense') : '';
  var r = _absResult(p);
  return '<div class="abs-line ' + r.cls + '"' + (style ? ' style="' + style + '"' : '') + '><span class="abs-tag">ABS</span><span>' + _escapeHtml(who + role) + '</span><b>' + _escapeHtml(r.text) + '</b></div>';
}
function _absLeftHtml(box) {
  var c = box && box.absChallenges;
  if (!c || !c.away || !c.home || c.away.remaining == null || c.home.remaining == null) return '';
  return '<div class="abs-left">ABS challenges left <b>' + _escapeHtml(_absAbbr(box, 'away')) + ' ' + c.away.remaining + '</b>\u00b7<b>' + _escapeHtml(_absAbbr(box, 'home')) + ' ' + c.home.remaining + '</b></div>';
}
function _absZoneMarks(svg, pitches) {
  var marks = '';
  (pitches || []).forEach(function (p) {
    if (!p.abs || p.px == null || p.pz == null) return;
    var x = _szX(p.px), y = _szY(p.pz), col = p.abs.overturned ? '#F2C869' : (p.abs.inProgress ? '#A89FE8' : '#9C95D0');
    marks += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="17" fill="none" stroke="' + col + '" stroke-width="2.2" stroke-dasharray="4 3"/>' +
      '<text x="' + (x + 19).toFixed(1) + '" y="' + (y - 13).toFixed(1) + '" font-size="12" font-weight="900" fill="' + col + '" font-family="-apple-system,Helvetica,sans-serif">ABS</text>';
  });
  return marks ? svg.replace(/<\/svg>$/, marks + '</svg>') : svg;
}
// Notice over the square: while the challenge is being reviewed, and for
// eight seconds after its result first shows up. Not for challenges that
// were already there when you opened the game.
window._absSeen = window._absSeen || { game: null, at: {} };
function _absNoticeHtml(seq, box, sit) {
  var g = window._activeBrowseGame, pk = g ? String(g.gamePk) : '', S = window._absSeen;
  var ps = (seq && seq.pitches) || [];
  var first = S.game !== pk;
  if (first) { S.game = pk; S.at = {}; }
  var show = null, showAt = 0, now = Date.now();
  ps.forEach(function (p) {
    if (!p.abs) return;
    var key = (seq.atBatIndex != null ? seq.atBatIndex : seq.batter) + ':' + p.num + ':' + (p.abs.inProgress ? 'r' : (p.abs.overturned ? 'o' : 's'));
    if (S.at[key] == null) S.at[key] = first ? 0 : now;
    var t = S.at[key];
    if (p.abs.inProgress || (t && now - t < 8000)) { show = p; showAt = t || now; }
  });
  if (!show) return '';
  var a = show.abs, who = a.side ? _absAbbr(box, a.side) : '';
  var r = _absResult(show);
  var col = a.side && typeof _ghTeamColors === 'function' ? _ghTeamColors(who).bg : '#A89FE8';
  return '<div class="fbx-nt abs-nt' + (a.inProgress ? ' rev' : '') + '" style="--t0:' + (showAt - now) + 'ms;--acc:' + col + '"><span class="t">ABS CHALLENGE' + (who ? ' \u00b7 ' + _escapeHtml(who) : '') + '</span><span class="s">' + _escapeHtml('Pitch ' + show.num + ' \u00b7 ' + r.text.split(' \u00b7 ')[0]) + '</span></div>';
}

// ── INLINE PLAY REPLAYS (v6.2.0) ────────────────────────────────────────
// Separate from the live square's state (window._pa), so the live game keeps
// going untouched while a past play replays under its row.
window._pai = window._pai || null;
function _paiRow(playId) {
  var rows = document.querySelectorAll('[onclick*="_playDoubleTap"]');
  for (var i = 0; i < rows.length; i++) { if ((rows[i].getAttribute('onclick') || '').indexOf("'" + playId + "'") !== -1) return rows[i]; }
  return null;
}
function _paiClose() {
  window._pai = null;
  clearInterval(window._paiTick); window._paiTick = null;
  var el = document.getElementById('pa-inline'); if (el) el.remove();
}
// Runs the shared play renderer against this replay's own state
function _paiOverlay() {
  var r = window._pai, saved = window._pa;
  var tmp = { play: r.play, box: r.box, startAt: r.startAt, seq: true, keep: true };
  window._pa = tmp;
  var html = '';
  try { html = _paOverlayHtml(); } finally { window._pa = saved; }
  r._titleAt = tmp._titleAt; r._total = tmp.total;
  return html;
}
function _paiTimes(lp) {
  var GAP = .85, ps = lp.pitches || [], n = ps.length;
  var land = ps.map(function (p, i) { return .35 + i * GAP + _paActExtra(lp, i) + .6; });
  var OFF = Math.max(0, n - 1) * GAP + _paActExtra(lp, n);
  var inPlay = !!(lp.hit || lp.droppedK || /single|double|triple|home_run|field_out|double_play|triple_play|force_out|fielders_choice|sac_|field_error|walk|hit_by_pitch|catcher_interf/.test(lp.eventType || ''));
  var r = window._pai;
  var resolve = OFF + (inPlay ? ((r && r._titleAt) || PA.T0 + 2) : 1.4);
  return { land: land, resolve: resolve };
}
// Count as of E seconds into the replay: balls/strikes tick as each pitch
// lands, outs go up when a between-pitch out happens and when the play ends.
function _paiCountAt(lp, E) {
  var T = _paiTimes(lp), b = 0, k = 0;
  (lp.pitches || []).forEach(function (p, i) {
    if (E < T.land[i]) return;
    var c = String(p.call || '').toLowerCase();
    if (/in play/.test(c) || /hit by pitch/.test(c)) return;
    if (/ball/.test(c)) b = Math.min(4, b + 1);
    else if (/foul/.test(c) && !/tip/.test(c)) { if (k < 2) k++; }
    else if (/strike|foul tip/.test(c)) k = Math.min(3, k + 1);
  });
  var playOuts = (lp.runners || []).filter(function (x) { return x.out; }).length;
  var acts = lp.actions || [], actOuts = 0;
  acts.forEach(function (a) { actOuts += (a.runners || []).filter(function (x) { return x.out; }).length; });
  var after = lp.outs != null ? lp.outs : playOuts + actOuts;
  var o = Math.max(0, after - playOuts - actOuts);
  acts.forEach(function (a) {
    var tA = a.afterPitch > 0 ? .35 + (a.afterPitch - 1) * .85 + _paActExtra(lp, a.afterPitch - 1) + .9 : .1;
    if (E >= tA + 1.6) o += (a.runners || []).filter(function (x) { return x.out; }).length;
  });
  if (E >= T.resolve) o = after;
  return { b: b, k: k, o: Math.min(3, o) };
}
function _paiCountHtml(c) {
  var tile = function (cls, n, slots, label, key) {
    var caps = '';
    for (var i = 0; i < slots; i++) caps += '<i class="' + (i < n ? 'on' : '') + '"></i>';
    return '<div class="bbc-t ' + cls + '"><span class="bbc-n" data-k="' + key + '">' + n + '</span><span class="bbc-caps" data-c="' + key + '">' + caps + '</span><span class="bbc-l">' + label + '</span></div>';
  };
  return '<div class="bbc" role="group" aria-label="Count">' + tile('bbc-b', c.b, 3, 'BALLS', 'b') + tile('bbc-s', c.k, 2, 'STRIKES', 'k') + tile('bbc-o', c.o, 2, 'OUTS', 'o') + '</div>';
}
function _paiListHtml(lp, E) {
  var T = _paiTimes(lp), ps = lp.pitches || [];
  if (!ps.length) return '';
  return ps.map(function (p, i) {
    var c = _pitchCallColor(p.call);
    return '<div class="pai-row" style="animation-delay:' + (T.land[i] - .15 - E).toFixed(2) + 's">' +
      '<span style="width:20px;height:20px;border-radius:50%;background:' + c + ';color:#0D0820;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + p.num + '</span>' +
      (p.speed ? '<span class="gh-num" style="font-size:14px;flex-shrink:0">' + p.speed + ' mph</span>' : '') +
      '<span style="font-size:13px;color:#D9D4FA;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(p.type || '') + '</span>' +
      (p.call ? '<span style="font-size:11.5px;font-weight:700;color:' + c + ';flex-shrink:0;filter:brightness(1.25)">' + _escapeHtml(p.call) + '</span>' : '') + '</div>' + (typeof _absLineHtml === 'function' ? _absLineHtml(p, (window._pai && window._pai.box) || {}, lp.half, 'opacity:0;animation:paIn .25s linear ' + (T.land[i] - .15 - E).toFixed(2) + 's both') : '');
  }).join('');
}
function _paiMount(rowEl, scroll) {
  var r = window._pai;
  if (!r) return;
  var row = rowEl || _paiRow(r.playId);
  var old = document.getElementById('pa-inline'); if (old) old.remove();
  if (!row || !row.parentNode) return; // row not on screen (collapsed inning) — kept, shown again when it is
  var wrap = document.createElement('div');
  wrap.id = 'pa-inline';
  wrap.className = 'pai';
  if (!scroll) wrap.style.animation = 'none'; // re-mounted after a refresh: no entrance
  var E = (Date.now() - r.startAt) / 1000;
  var html = _paiOverlay();
  wrap.innerHTML = '<div class="pai-hd"><span>REPLAY</span><button class="pai-hide" onclick="_paiClose()" aria-label="Hide this replay">Hide <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<div class="pai-box"><div id="gh-pa-islot">' + html + '</div></div>' +
    '<div id="pa-i-count">' + _paiCountHtml(_paiCountAt(r.play, E)) + '</div>' +
    '<div class="pai-list">' + _paiListHtml(r.play, E) + '</div>';
  row.parentNode.insertBefore(wrap, row.nextSibling);
  clearInterval(window._paiTick);
  window._paiTick = setInterval(function () {
    var R = window._pai, box = document.getElementById('pa-i-count');
    if (!R || !box) { clearInterval(window._paiTick); window._paiTick = null; return; }
    var e = (Date.now() - R.startAt) / 1000, c = _paiCountAt(R.play, e);
    ['b', 'k', 'o'].forEach(function (key) {
      var n = box.querySelector('[data-k="' + key + '"]'), v = key === 'b' ? c.b : key === 'k' ? c.k : c.o;
      if (n && n.textContent !== String(v)) {
        n.textContent = v; n.classList.remove('hit'); void n.offsetWidth; n.classList.add('hit');
        var caps = box.querySelectorAll('[data-c="' + key + '"] i');
        for (var i = 0; i < caps.length; i++) caps[i].className = i < v ? 'on' : '';
      }
    });
    if (e > (R._total || 20) + 1) { clearInterval(window._paiTick); window._paiTick = null; }
  }, 120);
  if (scroll && wrap.scrollIntoView) wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function _paiRemount() { if (window._pai) _paiMount(null, false); }

// Hooks: a live refresh that lands mid-animation waits for it to finish
// (so the play only ever runs once, start to end), and a single tap on a
// play in the play-by-play replays it — a double tap still reacts.
(function () {
  var prevRender = renderGameCheatSheet;
  renderGameCheatSheet = function () {
    var slot = document.getElementById('gh-pa-slot'), s = window._pa;
    var key = s.play && s.startAt ? s.play.atBatIndex + ':' + s.startAt : '';
    if (_paActive() && slot && slot.firstChild && slot.getAttribute('data-pa') === key) { window._paDeferred = true; return; }
    var r = prevRender.apply(this, arguments);
    try { _paFill(); } catch (e) { console.error('[play anim]', e); }
    try { if (typeof _reelFill === 'function') _reelFill(); } catch (e) { console.error('[reel]', e); }
    try { if (typeof _paiRemount === 'function') _paiRemount(); } catch (e) { console.error('[inline replay]', e); }
    try { if (typeof _psDecorate === 'function') _psDecorate(); } catch (e) { console.error('[postseason]', e); }
    try { if (typeof _gshRefresh === 'function') _gshRefresh(); } catch (e) { console.error('[score bar]', e); }
    return r;
  };
  var prevTap = _playDoubleTap;
  _playDoubleTap = function (el, playId) {
    var second = !!(el._lastTapTs && (Date.now() - el._lastTapTs) < 400);
    prevTap.apply(this, arguments);
    clearTimeout(el._paTapT);
    if (second) return;
    var g = window._activeBrowseGame;
    if (!g || (g.sport || 'mlb') !== 'mlb') return;
    el._paTapT = setTimeout(function () { if (el._lastTapTs) ghPaReplayPlay(playId, el); }, 420);
  };
})();
