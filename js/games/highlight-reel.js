// ══ HIGHLIGHT REEL (v5.76.0) — the final score card ═══════════════════
// After the game, "Highlights" plays the scoring at-bats one after
// another right in the score card — each one on the field (where it
// went, runners scoring), with a story-style progress bar — then rests
// on one field with every one of them numbered. Tap to skip ahead;
// tap the last frame to watch again.
window._reel = { key: null, items: [], idx: 0, startAt: 0, open: true, timer: null };
function _reelItems(m) {
  var box = typeof _gcBox === 'function' ? _gcBox() : null;
  if (!box || !box.allPlays) return [];
  var byIdx = {};
  box.allPlays.forEach(function (p) { if (p && p.anim && p.atBatIndex != null) { byIdx[p.atBatIndex] = p.anim; if (!p.anim.desc && p.text) p.anim.desc = p.text; } });
  var items = (m.plays || []).filter(function (p) { return p.atBatIndex != null && byIdx[p.atBatIndex]; }).map(function (p) {
    return { lp: byIdx[p.atBatIndex], tag: (p.half === 'top' ? 'T' : 'B') + (p.inning || ''), half: p.half,
      headline: _ghPlayHeadline(p), chip: _ghScoreChip(p, m.away.abbr, m.home.abbr), text: p.text || '', inning: p.inning, away: m.away, home: m.home, after: [p.awayScore, p.homeScore],
      col: (p.half === 'top' ? m.away : m.home).colors.accent };
  });
  // v6.7.0: end on the last out (or the walk-off) and the win graphic
  var end = typeof _gwEndInfo === 'function' ? _gwEndInfo(box) : null;
  if (end) {
    var last = items[items.length - 1];
    if (last && last.lp && last.lp.atBatIndex === end.lp.atBatIndex) last.end = end;
    else {
      var lp = end.lp;
      items.push({ lp: lp, tag: (lp.half === 'top' ? 'T' : 'B') + (lp.inning || ''), half: lp.half,
        headline: end.walkoff ? 'Walk-off' : 'Final out · ' + _paTitle(lp).charAt(0) + _paTitle(lp).slice(1).toLowerCase(),
        chip: '', text: lp.description || lp.desc || '', inning: lp.inning, away: m.away, home: m.home, after: [lp.awayScore, lp.homeScore],
        col: (lp.half === 'top' ? m.away : m.home).colors.accent, end: end });
    }
  }
  return items;
}
function _reelHtml(m) {
  var items = _reelItems(m);
  if (!items.length) return '';
  var g = window._activeBrowseGame, key = g ? String(g.gamePk) : 'x', r = window._reel;
  if (r.key !== key) {
    r.key = key; r.idx = 0; r.startAt = Date.now(); r.open = !_ghIsWatchingThis(); // plays once on first view; after that only the Highlights button opens it
    // v6.7.0: if you were watching when it ended, it opens right on the last out and the win
    if (!r.open && items.length && items[items.length - 1].end) { r.open = true; r.idx = items.length - 1; }
  }
  r.items = items; r.box = typeof _gcBox === 'function' ? _gcBox() : null;
  return '<div class="gh-reel" id="gh-reel" style="display:' + (r.open ? 'flex' : 'none') + '">' +
    '<div class="gh-reel-bars" id="gh-reel-bars"></div>' +
    '<div class="gh-reel-sb" id="gh-reel-sb"></div>' +
    '<button class="gh-reel-box" onclick="ghReelTap()" aria-label="Skip to the next highlight"><div id="gh-reel-slot"></div></button>' +
    '<div class="gh-reel-list" id="gh-reel-list"></div>' +
    '<div class="gh-reel-cap" id="gh-reel-cap"></div></div>';
}

// The inning/score strip above the reel (same look as the live card):
// the score, inning, runners, outs and count as the at-bat began, then
// the score and outs change the moment the play resolves.
function _reelScoreboardHtml(it, E, resolveAt) {
  var lp = it.lp, top = it.half === 'top';
  var runs = (lp.runners || []).filter(function (r) { return r.end === 'score'; }).length;
  var after = it.after, before = [after[0], after[1]];
  if (top) before[0] = Math.max(0, after[0] - runs); else before[1] = Math.max(0, after[1] - runs);
  var outsOn = (lp.runners || []).filter(function (r) { return r.out; }).length;
  var outsAfter = lp.outs != null ? lp.outs : outsOn, outsBefore = Math.max(0, outsAfter - outsOn);
  // v5.79.0: the count ticks along as each pitch lands (0–0 → … → the
  // final count), in step with the pitches coming into the zone.
  var b = 0, k = 0, counts = ['0&ndash;0'], countTimes = [];
  (lp.pitches || []).forEach(function (p, i) {
    var c = String(p.call || '').toLowerCase();
    if (/in play/.test(c) || /hit by pitch/.test(c)) return;
    if (/ball/.test(c)) b = Math.min(4, b + 1);
    else if (/foul/.test(c) && !/tip/.test(c)) { if (k < 2) k++; }
    else if (/strike|foul tip/.test(c)) k = Math.min(3, k + 1);
    counts.push(b + '&ndash;' + k); countTimes.push(.35 + i * .85 + _paActExtra(lp, i) + .55);
  });
  var stack = function (vals, times) {
    if (vals.length === 1) return vals[0];
    return '<span style="position:relative;display:inline-block">' + vals.map(function (v, i) {
      var show = i === 0 ? null : times[i - 1], hide = i < vals.length - 1 ? times[i] : null;
      var a = [];
      if (show != null) a.push('paIn .15s linear ' + _paSec(show, E) + ' both');
      if (hide != null) a.push('paOut .15s linear ' + _paSec(hide, E) + ' forwards');
      return '<span style="' + (i ? 'position:absolute;left:0;top:0;' : '') + (a.length ? 'animation:' + a.join(',') : '') + '">' + v + '</span>';
    }).join('') + '</span>';
  };
  var pre = lp.pre || {};
  var dia = function (on, x, y) { return '<rect x="' + x + '" y="' + y + '" width="7" height="7" transform="rotate(45 ' + (x + 3.5) + ' ' + (y + 3.5) + ')" fill="' + (on ? '#A89FE8' : 'none') + '" stroke="#A89FE8" stroke-width="1.4"/>'; };
  var swap = function (a, bv, cls) {
    return '<span class="' + (cls || '') + '" style="position:relative;display:inline-block">' +
      '<span style="animation:paOut .25s linear ' + _paSec(resolveAt, E) + ' forwards">' + a + '</span>' +
      '<span style="position:absolute;left:0;top:0;opacity:0;animation:paIn .3s linear ' + _paSec(resolveAt, E) + ' forwards">' + bv + '</span></span>';
  };
  var dots = function (n) { var h = ''; for (var i = 0; i < 3; i++) h += '<span style="width:7px;height:7px;border-radius:50%;display:inline-block;' + (i < n ? 'background:#F08A7E' : 'border:1.5px solid #9C95D0;box-sizing:border-box') + '"></span>'; return h; };
  var badge = function (t) { return '<span style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;background:' + t.colors.bg + ';color:' + t.colors.fg + ';box-shadow:0 0 0 3px rgba(255,255,255,.08);flex-shrink:0">' + _escapeHtml(t.abbr) + '</span>'; };
  var score = function (i) { return before[i] === after[i] ? String(after[i]) : swap(before[i], '<span style="color:#9be8ac">' + after[i] + '</span>'); };
  return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 2px 0">' +
    '<div style="display:flex;align-items:center;gap:10px">' + badge(it.away) + '<span class="gh-num" style="font-size:26px">' + score(0) + '</span></div>' +
    '<div style="display:flex;flex-direction:column;align-items:center;gap:3px">' +
      '<div style="display:flex;align-items:baseline;gap:6px"><span style="color:#A89FE8;font-size:11px">' + (top ? '&#9650;' : '&#9660;') + '</span><span class="gh-num" style="font-size:20px">' + (it.inning || '') + '</span><span class="gh-eyebrow" style="font-size:9.5px">' + (top ? 'TOP' : 'BOT') + '</span></div>' +
      '<div style="display:flex;align-items:center;gap:8px"><svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true">' + dia(pre['2B'], 9.5, 1) + dia(pre['3B'], 2, 8.5) + dia(pre['1B'], 17, 8.5) + '</svg>' +
        '<span style="display:flex;gap:4px">' + (outsBefore === outsAfter ? dots(outsAfter) : swap('<span style="display:flex;gap:4px">' + dots(outsBefore) + '</span>', '<span style="display:flex;gap:4px">' + dots(Math.min(3, outsAfter)) + '</span>')) + '</span>' +
        '<span class="gh-num" style="font-size:13px">' + stack(counts, countTimes) + '</span></div></div>' +
    '<div style="display:flex;align-items:center;gap:10px"><span class="gh-num" style="font-size:26px">' + score(1) + '</span>' + badge(it.home) + '</div></div>';
}

// Every pitch of the at-bat, first at the top to the last at the bottom,
// each row appearing as its pitch lands in the zone.
function _reelPitchListHtml(it, E) {
  var ps = it.lp.pitches || [];
  if (!ps.length) return '';
  return ps.map(function (p, i) {
    var c = _pitchCallColor(p.call), last = i === ps.length - 1;
    return '<div style="display:flex;align-items:center;gap:10px;min-height:26px;animation:paIn .25s linear ' + _paSec(.35 + i * .85 + _paActExtra(it.lp, i) + .45, E) + ' both">' +
      '<span style="width:20px;height:20px;border-radius:50%;background:' + c + ';color:#0D0820;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0' + (last ? ';box-shadow:0 0 0 2px rgba(255,255,255,.35)' : '') + '">' + p.num + '</span>' +
      (p.speed ? '<span class="gh-num" style="font-size:13.5px;flex-shrink:0;width:58px">' + p.speed + ' mph</span>' : '') +
      '<span style="font-size:13px;color:#D9D4FA;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(p.type || '') + '</span>' +
      (p.call ? '<span style="font-size:11.5px;font-weight:700;color:' + c + ';flex-shrink:0;filter:brightness(1.25)">' + _escapeHtml(p.call) + '</span>' : '') + '</div>' + (typeof _absLineHtml === 'function' ? _absLineHtml(p, window._reel && window._reel.box || (window._pa && window._pa.box) || {}, it.lp.half, 'animation:paIn .25s linear ' + _paSec(.35 + i * .85 + _paActExtra(it.lp, i) + .45, E) + ' both') : '');
  }).join('');
}
function _reelBtnHtml(n) {
  return '<button class="gh-hl-btn" onclick="ghReelToggle()" aria-expanded="' + (window._reel.open ? 'true' : 'false') + '">Highlights<span class="gh-hl-count">' + n + '</span>' +
    '<svg class="gh-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(' + (window._reel.open ? 180 : 0) + 'deg)"><path d="M6 9l6 6 6-6"/></svg></button>';
}
function ghReelToggle() {
  var r = window._reel, el = document.getElementById('gh-reel');
  r.open = !r.open;
  if (el) el.style.display = r.open ? 'flex' : 'none';
  var btn = document.querySelector('#game-sheet-panel .gh .gh-hl-btn');
  if (btn) { btn.setAttribute('aria-expanded', r.open ? 'true' : 'false'); var ch = btn.querySelector('.gh-chev'); if (ch) ch.style.transform = 'rotate(' + (r.open ? 180 : 0) + 'deg)'; }
  if (r.open) { r.idx = 0; r.startAt = Date.now(); _reelFill(); } else clearTimeout(r.timer);
}
function ghReelTap() {
  var r = window._reel;
  r.idx++;
  r.startAt = Date.now();
  if (r.idx >= r.items.length) { _reelClose(); return; }
  _reelFill();
}
// v5.77.0: when the last highlight finishes, the reel closes itself;
// the Highlights button opens it again from the first one.
function _reelClose() {
  var r = window._reel, el = document.getElementById('gh-reel');
  clearTimeout(r.timer);
  r.open = false; r.idx = 0;
  if (el) el.style.display = 'none';
  var btn = document.querySelector('#game-sheet-panel .gh .gh-hl-btn');
  if (btn) { btn.setAttribute('aria-expanded', 'false'); var ch = btn.querySelector('.gh-chev'); if (ch) ch.style.transform = 'rotate(0deg)'; }
  var slot = document.getElementById('gh-reel-slot'); if (slot) slot.innerHTML = '';
}
function _reelFill() {
  var r = window._reel, slot = document.getElementById('gh-reel-slot');
  clearTimeout(r.timer);
  if (!slot || !r.open || !r.items.length) return;
  if (r.idx >= r.items.length) { _reelClose(); return; }
  var cap = document.getElementById('gh-reel-cap'), bars = document.getElementById('gh-reel-bars');
  var it = r.items[r.idx];
  // v5.77.0: each at-bat plays in full — every pitch comes in one by
  // one, then (if the ball was put in play) the field and what happened.
  var saved = window._pa;
  var tmp = { play: it.lp, box: r.box || saved.box, startAt: r.startAt, seq: true, keep: true, noCallout: true };
  window._pa = tmp;
  var html = '';
  try { html = _paOverlayHtml(); } finally { window._pa = saved; }
  var inPlay = !!(it.lp.hit || it.lp.droppedK || /single|double|triple|home_run|field_out|double_play|triple_play|force_out|fielders_choice|sac_|field_error|walk|hit_by_pitch|catcher_interf/.test(it.lp.eventType || ''));
  var off = Math.max(0, (it.lp.pitches || []).length - 1) * .85 + _paActExtra(it.lp, (it.lp.pitches || []).length);
  var resolveAt = off + (inPlay ? (tmp._titleAt || PA.T0 + 2) : 1.4);
  var dur = resolveAt + 3.4; // hold on the result a little longer
  // v6.7.0: the last item plays the win (or walk-off) graphic and stays on it
  if (it.end && typeof _gwGraphicHtml === 'function') { html += _gwGraphicHtml(it.end, r.box || saved.box, resolveAt + .7, (Date.now() - r.startAt) / 1000); dur = resolveAt + 6; }
  slot.innerHTML = html;
  var list = document.getElementById('gh-reel-list');
  if (list) list.innerHTML = _reelPitchListHtml(it, (Date.now() - r.startAt) / 1000);
  if (cap) cap.innerHTML = '<div style="display:flex;flex-direction:column;gap:3px;min-width:0">' +
    '<span style="font-size:14px;font-weight:800">' + _escapeHtml(it.headline) + '</span>' +
    (it.text ? '<span style="font-size:13px;line-height:1.45;color:#D9D4FA">' + _escapeHtml(it.text) + '</span>' : '') + '</div>';
  var sb = document.getElementById('gh-reel-sb');
  if (sb) sb.innerHTML = _reelScoreboardHtml(it, (Date.now() - r.startAt) / 1000, resolveAt);
  var el = (Date.now() - r.startAt) / 1000;
  if (bars) {
    bars.innerHTML = r.items.map(function (_, i) {
      var fill = i < r.idx ? '<i style="transform:scaleX(1)"></i>'
        : i === r.idx ? '<i style="animation:reelBar ' + dur.toFixed(2) + 's linear ' + (-el).toFixed(2) + 's both"></i>' : '<i></i>';
      return '<span>' + fill + '</span>';
    }).join('');
  }
  if (it.end) { if (cap && it.end.walkoff) cap.innerHTML += '<button class="gw-save" onclick="event.stopPropagation();gwSaveWalkoff()">Were you watching? <b>Save this walk-off</b></button>'; return; } // holds until tapped
  r.timer = setTimeout(function () {
    if (!document.getElementById('gh-reel-slot')) return;
    r.idx++; r.startAt = Date.now();
    if (r.idx >= r.items.length) _reelClose(); else _reelFill();
  }, Math.max(200, dur * 1000 - (Date.now() - r.startAt)));
}
