// ══ TALK ABOUT EVERY PITCH, AND EVERY AT-BAT (v7.23.0) ══════════════════
// · Tap a pitch — a dot in the zone, or one in the pitch row under the
//   square — and a sheet comes up: that pitch, five reactions, what
//   everyone's said about it, and a box to add yours. Comments go to the
//   game chat with the pitch attached; a pitch people talked about carries
//   a small count.
// · When an at-bat ends, double-tap the result card (v7.24.0): it lifts,
//   iPhone style, with the reactions above it and Comment / Replay below.
//   What people did shows as a small pill next to the team on the card.
//   On any other tab a quick bar slides up with reactions and Comment.
// · Reactions use the same store as reacting to a play in the Plays tab
//   (gamePlayReactions, one per person), so the two always agree. An
//   at-bat is <gamePk>_<atBatIndex>; a pitch is that plus _p<num>.
var PT_PITCH_RX = ['🔥', '😬', '😤', '👀', '🙌']; // 🔥 😬 😤 👀 🙌
var PT_AB_RX = ['🔥', '🙌', '😱', '😤'];                    // 🔥 🙌 😱 😤
var PT_RX_LABEL = { '🔥': 'Fire', '😬': 'Yikes', '😤': 'Ugh', '👀': 'Eyes', '🙌': 'Yes', '😱': 'No way' };
window._ptReacts = window._ptReacts || {};
window._ptSubs = window._ptSubs || {};

function _ptUser() { return window.currentUser || (window.auth && window.auth.currentUser) || null; }
function _ptPk() { var g = window._activeBrowseGame; return g && g.gamePk != null ? String(g.gamePk) : ''; }
function _ptBox() { return (typeof _gcBox === 'function' && _gcBox()) || window._lastLiveBox || (window._pa && window._pa.box) || null; }
function _ptMsgs() { return ((window._gameChatMsgs || {})[_ptPk()]) || []; }
function _ptLastName(n) { return typeof _patLast === 'function' ? _patLast(n || '') : String(n || '').split(' ').pop(); }
function _ptTag(half, inning) { return (half === 'top' ? '▲' : half === 'bottom' ? '▼' : '') + (inning || ''); }

// ── an at-bat's pitches and who was in it, wherever the game has them
function _ptAtBat(box, abi) {
  if (!box || abi == null) return null;
  var A = String(abi), lp = box.lastPlay, sq = box.pitchSequence, s = box.situation || {};
  if (lp && String(lp.atBatIndex) === A) return { abi: A, pitches: lp.pitches || [], batter: lp.batter, pitcher: lp.pitcher, tag: _ptTag(lp.half, lp.inning), ctx: lp, play: lp };
  if (sq && String(sq.atBatIndex) === A) {
    var mp = box.matchup && box.matchup.pitcher;
    return { abi: A, pitches: sq.pitches || [], batter: sq.batter || (box.matchup && box.matchup.batter && box.matchup.batter.name), pitcher: mp && mp.name, tag: _ptTag(s.half, s.inning), ctx: sq, play: null };
  }
  var hit = null;
  (box.allPlays || []).forEach(function (p) { var a = p && p.anim; if (a && String(a.atBatIndex) === A) hit = a; });
  return hit ? { abi: A, pitches: hit.pitches || [], batter: hit.batter, pitcher: hit.pitcher, tag: _ptTag(hit.half, hit.inning), ctx: hit, play: hit } : null;
}
function _ptPitchInfo(ab, num) {
  if (!ab) return null;
  var p = null, i0 = 0;
  ab.pitches.forEach(function (x, i) { var n = x && x.num != null ? x.num : i + 1; if (String(n) === String(num)) { p = x; i0 = i; } });
  if (!p) return null;
  var mph = p.mph != null ? p.mph : p.speed, where = typeof _patLoc === 'function' ? _patLoc(ab.ctx || {}, p) : '';
  var last = _ptLastName(ab.batter) || 'the batter';
  return {
    key: _ptPk() + '_' + ab.abi + '_p' + num, abi: ab.abi, num: String(num), of: ab.pitches.length, tag: ab.tag || '', batter: ab.batter || '', pitcher: ab.pitcher || '',
    mph: mph != null ? Number(mph).toFixed(1) : '', type: p.type || '', call: p.call || '', where: where || '',
    px: p.px != null ? p.px : null, pz: p.pz != null ? p.pz : null, zt: (ab.ctx && ab.ctx.zoneTop) || 3.4, zb: (ab.ctx && ab.ctx.zoneBottom) || 1.6,
    title: 'Pitch ' + num + ' of ' + ab.pitches.length + ' · ' + last,
    line: [mph != null ? Number(mph).toFixed(1) + ' mph ' + (p.type || '') : (p.type || ''), p.call || '', where].filter(Boolean).join(' · ')
  };
}
// the at-bat as the result card shows it
function _ptAbInfo(box, lp) {
  if (!box || !lp || lp.atBatIndex == null) return null;
  var o = typeof _patHoldInfo === 'function' ? _patHoldInfo(lp, box) : null;
  var tag = _ptTag(lp.half, lp.inning);
  return {
    key: _ptPk() + '_' + lp.atBatIndex, abi: String(lp.atBatIndex), tag: tag, text: lp.description || (o ? o.title + ' · ' + o.who : ''),
    card: o ? { team: o.top || '', title: o.big || o.title || '', who: o.who || '', sub: o.sub || '', t1: o.bg, t2: o.t2 } : null,
    batter: lp.batter || ''
  };
}

// ── reactions (gamePlayReactions/<key>: { reactions: { uid: emoji } })
function _ptWant(keys) {
  var want = {};
  keys.filter(Boolean).forEach(function (k) { want[k] = 1; _ptWatch(k); });
  Object.keys(window._ptSubs).forEach(function (k) { if (!want[k]) { try { window._ptSubs[k](); } catch (e) {} delete window._ptSubs[k]; } });
}
function _ptWatch(key) {
  if (!key || window._ptSubs[key] || !window.db) return;
  window._ptSubs[key] = window.db.collection('gamePlayReactions').doc(key).onSnapshot(function (d) {
    window._ptReacts[key] = (d.exists && d.data() && d.data().reactions) || {};
    _ptPaintReacts(key);
  }, function (err) { console.error('[pitch talk] reactions', err); delete window._ptSubs[key]; });
}
function _ptRailInner(key, set) {
  var map = window._ptReacts[key] || {}, me = _ptUser(), mine = me ? map[me.uid] : null, n = {};
  Object.keys(map).forEach(function (u) { n[map[u]] = (n[map[u]] || 0) + 1; });
  return set.map(function (e) {
    var on = mine === e;
    return '<button type="button" class="pt-rx' + (on ? ' on' : '') + '" data-e="' + e + '" aria-pressed="' + on + '" aria-label="' + (PT_RX_LABEL[e] || 'React') + (n[e] ? ', ' + n[e] : '') + '" onclick="event.stopPropagation();ptReact(this)">' + e + (n[e] ? '<b>' + n[e] + '</b>' : '') + '</button>';
  }).join('');
}
function _ptPaintReacts(key) {
  document.querySelectorAll('[data-ptkey]').forEach(function (el) {
    if (el.getAttribute('data-ptkey') !== key) return;
    var set = el.getAttribute('data-ptset') === 'pitch' ? PT_PITCH_RX : PT_AB_RX;
    el.innerHTML = _ptRailInner(key, set);
  });
  _ptPaintSums(key);
}
// set or take back a reaction: one per person; the same one again takes it back
function _ptSetReact(key, e, tag, text) {
  var me = _ptUser();
  if (!me || !window.db || typeof firebase === 'undefined') { if (typeof ib_toast === 'function') ib_toast('Sign in to react'); return null; }
  var cur = Object.assign({}, window._ptReacts[key] || {}), off = cur[me.uid] === e;
  if (off) delete cur[me.uid]; else cur[me.uid] = e;
  window._ptReacts[key] = cur;
  _ptPaintReacts(key);
  var upd = {}; upd[me.uid] = off ? firebase.firestore.FieldValue.delete() : e;
  window.db.collection('gamePlayReactions').doc(key).set({ reactions: upd }, { merge: true }).then(function () {
    if (off || typeof _gcPostPlayReaction !== 'function') return;
    _gcPostPlayReaction({ tag: tag || '', text: text || '', playId: key }, e);
  }).catch(function (err) { console.error('[pitch talk] react', err); if (typeof ib_toast === 'function') ib_toast('Could not react — try again'); });
  return !off;
}
function ptReact(btn) {
  var rail = btn && btn.closest('[data-ptkey]');
  if (!rail) return;
  var key = rail.getAttribute('data-ptkey'), e = btn.getAttribute('data-e');
  var added = _ptSetReact(key, e, rail.getAttribute('data-pttag') || '', rail.getAttribute('data-pttext') || '');
  if (added) { btn = rail.querySelector('[data-e="' + e + '"]'); if (btn) { btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit'); } }
}
function _ptRailHtml(key, kind, tag, text) {
  return '<span class="pt-rail" data-ptkey="' + _escapeHtml(key) + '" data-ptset="' + kind + '" data-pttag="' + _escapeHtml(tag || '') + '" data-pttext="' + _escapeHtml(text || '') + '">' + _ptRailInner(key, kind === 'pitch' ? PT_PITCH_RX : PT_AB_RX) + '</span>';
}

// ── what's been said
function _ptPitchComments(key) { return _ptMsgs().filter(function (m) { return m && m.replyTo && m.replyTo.pitch && m.replyTo.pitch.key === key; }); }
function _ptAbComments(key) { return _ptMsgs().filter(function (m) { return m && m.replyTo && !m.replyTo.pitch && m.replyTo.play && m.replyTo.play.playId === key; }); }

// ── the result card (pa-takeover.js calls _ptCardBits) — v7.24.0: no
// footer. Double-tap the card; the pill shows what's been said and done.
var PT_BUBBLE = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>';
function _ptSumData(key) {
  var map = window._ptReacts[key] || {}, n = {}, tot = 0;
  Object.keys(map).forEach(function (u) { n[map[u]] = (n[map[u]] || 0) + 1; tot++; });
  return { top: Object.keys(n).sort(function (a, b) { return n[b] - n[a]; }).slice(0, 3), tot: tot, c: _ptAbComments(key).length };
}
function _ptSumInner(key) {
  var d = _ptSumData(key), h = '';
  if (d.tot) h += '<span class="pt-se">' + d.top.join('') + '</span><b>' + d.tot + '</b>';
  if (d.c) h += (d.tot ? '<i class="pt-dv"></i>' : '') + PT_BUBBLE + '<b>' + d.c + '</b>';
  return h;
}
function _ptSumLabel(key) {
  var d = _ptSumData(key);
  return [d.tot ? d.tot + (d.tot === 1 ? ' reaction' : ' reactions') : '', d.c ? d.c + (d.c === 1 ? ' comment' : ' comments') : ''].filter(Boolean).join(', ') + ' — open';
}
function _ptPaintSums(key) {
  document.querySelectorAll('[data-ptsum]').forEach(function (el) {
    var k = el.getAttribute('data-ptsum');
    if (key && k !== key) return;
    var h = _ptSumInner(k);
    if (el.innerHTML === h) return;
    var grew = h.length > el.innerHTML.length;
    el.innerHTML = h;
    el.setAttribute('aria-label', _ptSumLabel(k));
    if (grew) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  });
}
function _ptHintOn() { try { return !localStorage.getItem('innings_pt_dt'); } catch (e) { return false; } }
function _ptCardBits(lp, box) {
  var ab = _ptAbInfo(box, lp);
  if (!ab) return null;
  var A = _escapeHtml(ab.abi);
  return {
    attrs: ' data-ptab="' + A + '" onclick="_ptCardTap(this,event)"',
    sum: '<button type="button" class="pt-sum" data-ptsum="' + _escapeHtml(ab.key) + '" aria-label="' + _escapeHtml(_ptSumLabel(ab.key)) + '" onclick="event.stopPropagation();ptOpenAb(\'' + A + '\')">' + _ptSumInner(ab.key) + '</button>' +
      (_ptHintOn() ? '<span class="pt-hint" aria-hidden="true">Double-tap to react</span>' : ''),
    kb: '<button type="button" class="pt-kb" onclick="event.stopPropagation();_ptSpotFrom(this)">React or comment</button>'
  };
}
// two taps within 400ms, like a message in the chat (a double-click on a laptop)
function _ptCardTap(card, ev) {
  if (ev && ev.target && ev.target.closest && ev.target.closest('button')) return;
  var k = card.getAttribute('data-ptab'), now = Date.now(), L = window._ptLastTap;
  if (L && L.k === k && now - L.t < 400) { window._ptLastTap = null; _ptSpot(card); }
  else window._ptLastTap = { k: k, t: now };
}
function _ptSpotFrom(btn) { var c = btn && btn.closest('.pah'); if (c) _ptSpot(c, true); }

// The card lifts out of a blur, the reactions spring out above it and a
// menu (Comment, Replay) opens below — the chat's double-tap, for an at-bat.
var PT_MI = {
  comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  replay: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>'
};
function _ptSpot(card, viaKey) {
  var abi = card.getAttribute('data-ptab'), box = _ptBox(), ab = _ptAtBat(box, abi);
  var info = ab && ab.play ? _ptAbInfo(box, ab.play) : null;
  if (!info) return;
  try { localStorage.setItem('innings_pt_dt', '1'); } catch (e) {}
  document.querySelectorAll('.pah .pt-hint').forEach(function (h) { h.remove(); });
  var r = card.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
  if (typeof window._msSnapshot !== 'function' || !r.width || r.bottom < 0 || r.top > vh) { ptOpenAb(abi); return; }
  _ptSpotKill();
  var ms = document.createElement('div');
  ms.id = 'pt-spot';
  ms.className = 'ms pt-ms';
  ms.setAttribute('role', 'dialog');
  ms.setAttribute('aria-modal', 'true');
  ms.setAttribute('aria-label', 'React or comment on ' + (_ptLastName(info.batter) ? _ptLastName(info.batter) + '’s at-bat' : 'this at-bat'));
  var veil = document.createElement('div');
  veil.className = 'ms-veil';
  ms.appendChild(veil);
  var lift = window._msSnapshot(card);
  lift.classList.add('ms-lift');
  var L = lift.style;
  L.position = 'absolute'; L.left = r.left + 'px'; L.top = r.top + 'px'; L.width = r.width + 'px'; L.height = r.height + 'px';
  L.margin = '0'; L.inset = 'auto'; L.right = 'auto'; L.bottom = 'auto'; L.left = r.left + 'px'; L.top = r.top + 'px';
  L.borderRadius = '16px'; L.overflow = 'hidden'; L.clipPath = 'none'; L.boxSizing = 'border-box'; L.pointerEvents = 'none'; L.visibility = 'visible';
  L.transition = 'transform .5s cubic-bezier(.32,1.35,.5,1)'; L.transformOrigin = '50% 50%';
  ms.appendChild(lift);
  var me = _ptUser(), mine = me ? (window._ptReacts[info.key] || {})[me.uid] : null;
  var tb = document.createElement('div');
  tb.className = 'ms-tb';
  tb.setAttribute('role', 'group');
  tb.setAttribute('aria-label', 'React');
  tb.innerHTML = PT_AB_RX.map(function (e, i) {
    return '<button type="button" data-e="' + e + '" class="' + (mine === e ? 'on' : '') + '" aria-pressed="' + (mine === e) + '" style="--d:' + (0.04 + i * 0.03).toFixed(2) + 's" aria-label="' + (PT_RX_LABEL[e] || e) + '">' + e + '</button>';
  }).join('');
  ms.appendChild(tb);
  var n = _ptAbComments(info.key).length;
  var menu = document.createElement('div');
  menu.className = 'ms-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = '<button type="button" role="menuitem" class="ms-mi" data-k="comment"><span>' + (n ? 'Comment · ' + n : 'Comment') + '</span>' + PT_MI.comment + '</button>' +
    '<button type="button" role="menuitem" class="ms-mi" data-k="replay"><span>Replay</span>' + PT_MI.replay + '</button>';
  ms.appendChild(menu);
  document.body.appendChild(ms);

  // tapback above, menu below, the card nudged so all three fit
  var GAP = 10, TOP = 54, BOTTOM = vh - 20, EDGE = 10;
  var tbH = tb.offsetHeight + 8, tbW = tb.offsetWidth, mH = menu.offsetHeight, mW = menu.offsetWidth, shift = 0;
  var tbTop = r.top - GAP - tbH;
  if (tbTop < TOP) shift = TOP - tbTop;
  var mTop = r.bottom + GAP + shift;
  if (mTop + mH > BOTTOM) shift -= Math.min(mTop + mH - BOTTOM, Math.max(0, r.top + shift - TOP - tbH - GAP));
  tbTop = r.top + shift - GAP - tbH;
  mTop = Math.min(r.bottom + shift + GAP, BOTTOM - mH);
  var tbLeft = Math.max(EDGE, Math.min(vw - EDGE - tbW, r.left + 14));
  var mLeft = Math.max(EDGE, Math.min(vw - EDGE - mW, r.right - mW - 6));
  tb.style.left = tbLeft + 'px'; tb.style.top = tbTop + 'px';
  menu.style.left = mLeft + 'px'; menu.style.top = mTop + 'px';
  var tailX = Math.max(18, Math.min(tbW - 18, r.left + 40 - tbLeft));
  tb.style.setProperty('--tail', tailX + 'px');
  tb.style.transformOrigin = tailX + 'px 100%';
  menu.style.transformOrigin = (r.right - mLeft - 20) + 'px 0';
  ms._src = card;
  card.style.visibility = 'hidden';
  void ms.offsetWidth;
  ms.classList.add('on');
  L.transform = 'translateY(' + shift + 'px) scale(1.025)';
  if (typeof window._msHaptic === 'function') window._msHaptic();
  _ptWatch(info.key);

  veil.addEventListener('click', _ptSpotClose);
  ms.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  tb.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-e]');
    if (!b || ms._closing) return;
    b.classList.add('hit');
    if (typeof window._msHaptic === 'function') window._msHaptic();
    setTimeout(function () { _ptSetReact(info.key, b.getAttribute('data-e'), info.tag, info.text); _ptSpotClose(); }, 150);
  });
  menu.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-k]');
    if (!b || ms._closing) return;
    var k = b.getAttribute('data-k');
    _ptSpotClose();
    if (k === 'comment') ptOpenAb(abi);
    else if (k === 'replay' && typeof patReplayLive === 'function') patReplayLive();
  });
  ms._key = function (e) { if (e.key === 'Escape') _ptSpotClose(); };
  document.addEventListener('keydown', ms._key);
  if (viaKey) { var f = tb.querySelector('button'); if (f) setTimeout(function () { try { f.focus(); } catch (e) {} }, 60); }
}
function _ptSpotClose() {
  var ms = document.getElementById('pt-spot');
  if (!ms || ms._closing) return;
  ms._closing = true;
  ms.classList.remove('on');
  ms.classList.add('off');
  var lift = ms.querySelector('.ms-lift');
  if (lift) { lift.style.transition = 'transform .3s cubic-bezier(.3,.7,.4,1)'; lift.style.transform = 'none'; }
  if (ms._key) document.removeEventListener('keydown', ms._key);
  setTimeout(function () { _ptSpotDone(ms); }, 300);
}
function _ptSpotDone(ms) {
  if (ms._src && ms._src.style) ms._src.style.visibility = '';
  if (ms.parentNode) ms.parentNode.removeChild(ms);
}
function _ptSpotKill() {
  var ms = document.getElementById('pt-spot');
  if (!ms) return;
  if (ms._key) document.removeEventListener('keydown', ms._key);
  _ptSpotDone(ms);
}

// ── the sheet: one pitch, or one at-bat
function _ptSheetEl() {
  var el = document.getElementById('pt-sheet');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'pt-sheet';
  el.className = 'pt-sh';
  el.innerHTML = '<button type="button" class="pt-scrim" aria-label="Close" onclick="ptClose()"></button><div class="pt-card" role="dialog" aria-modal="true" aria-labelledby="pt-title"><div class="pt-grab"></div><div id="pt-body"></div></div>';
  document.body.appendChild(el);
  return el;
}
function ptOpenPitch(abi, num, stored) {
  var info = _ptPitchInfo(_ptAtBat(_ptBox(), abi), num) || stored || null;
  if (!info) { if (typeof ib_toast === 'function') ib_toast('That pitch isn’t here anymore'); return; }
  window._ptOpen = { kind: 'pitch', info: info };
  _ptRenderSheet(true);
}
function ptOpenAb(abi, stored) {
  var box = _ptBox(), ab = _ptAtBat(box, abi), info = ab && ab.play ? _ptAbInfo(box, ab.play) : (stored || null);
  if (!info) return;
  window._ptOpen = { kind: 'ab', info: info };
  _ptRenderSheet(true);
}
function ptClose() {
  var el = document.getElementById('pt-sheet');
  if (el) { el.classList.remove('on'); setTimeout(function () { if (!el.classList.contains('on')) el.style.display = 'none'; }, 300); }
  window._ptOpen = null;
  _ptSyncWatch();
}
function _ptThreadHtml(list) {
  if (!list.length) return '<div class="pt-none">' + (window._ptOpen && window._ptOpen.kind === 'pitch' ? 'No one’s said anything about this pitch yet.' : 'No one’s said anything about this at-bat yet.') + '</div>';
  var me = _ptUser();
  return list.map(function (m) {
    var mine = me && m.uid === me.uid;
    return '<div class="pt-c' + (mine ? ' me' : '') + '"><span class="pt-av">' + _escapeHtml(String(mine ? ((window.userData && window.userData.name) || 'You') : (m.author || '?')).charAt(0).toUpperCase()) + '</span>' +
      '<div class="pt-b"><b>' + _escapeHtml(mine ? 'You' : (m.author || 'Someone')) + ' · ' + _escapeHtml(typeof _fmtTime === 'function' ? _fmtTime(m.ts) : '') + '</b>' + _escapeHtml(m.text || '') + '</div></div>';
  }).join('');
}
function _ptRenderSheet(opening) {
  var O = window._ptOpen;
  if (!O) return;
  var el = _ptSheetEl(), body = document.getElementById('pt-body'), I = O.info, draft = '';
  var f = document.getElementById('pt-field'); if (f && !opening) draft = f.value;
  var head, list;
  if (O.kind === 'pitch') {
    head = '<div class="pt-hd"><span class="pt-dot" style="background:' + (typeof _pitchCallColor === 'function' ? _pitchCallColor(I.call) : '#A89FE8') + '">' + _escapeHtml(I.num) + '</span>' +
      '<div class="pt-hw"><div class="pt-t" id="pt-title">' + _escapeHtml((I.tag ? I.tag + ' · ' : '') + I.title) + '</div><div class="pt-l">' + _escapeHtml(I.line) + '</div></div>';
    list = _ptPitchComments(I.key);
  } else {
    var c = I.card || {};
    head = '<div class="pt-hd pt-hd-ab" style="--t1:' + (c.t1 || '#3D3580') + ';--t2:' + (c.t2 || '#CFC7FF') + '"><div class="pt-hw"><div class="pt-sm">' + _escapeHtml([c.team, I.tag].filter(Boolean).join(' · ')) + '</div><div class="pt-big" id="pt-title">' + _escapeHtml(c.title || 'At-bat') + '</div><div class="pt-l">' + _escapeHtml([c.who, c.sub].filter(Boolean).join(' · ')) + '</div></div>';
    list = _ptAbComments(I.key);
  }
  head += '<button type="button" class="pt-x" aria-label="Close" onclick="ptClose()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
  var tagForLine = O.kind === 'pitch' ? ((I.tag ? I.tag + ' · ' : '') + 'Pitch ' + I.num) : I.tag;
  var textForLine = O.kind === 'pitch' ? (_ptLastName(I.batter) + ' · ' + I.line) : I.text;
  var ph = O.kind === 'pitch' ? 'Say something about pitch ' + I.num + '…' : 'Say something about ' + (_ptLastName(I.batter) ? _ptLastName(I.batter) + '’s at-bat' : 'this at-bat') + '…';
  body.innerHTML = head +
    '<div class="pt-rxrow">' + _ptRailHtml(I.key, O.kind === 'pitch' ? 'pitch' : 'ab', tagForLine, textForLine) + '</div>' +
    '<div class="pt-th" id="pt-thread">' + _ptThreadHtml(list) + '</div>' +
    '<div class="pt-in"><label class="pt-lab"><span class="pt-sr">' + _escapeHtml(ph) + '</span><input id="pt-field" placeholder="' + _escapeHtml(ph) + '" maxlength="500" onkeydown="if(event.key===\'Enter\'){event.preventDefault();ptSend();}"></label>' +
    '<button type="button" class="pt-go" aria-label="Send" onclick="ptSend()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>' +
    '<div class="pt-note">Goes to the game chat with the ' + (O.kind === 'pitch' ? 'pitch' : 'play') + ' attached</div>';
  var f2 = document.getElementById('pt-field'); if (f2 && draft) f2.value = draft;
  var th = document.getElementById('pt-thread'); if (th) th.scrollTop = th.scrollHeight;
  if (opening) {
    el.style.display = 'block';
    requestAnimationFrame(function () { el.classList.add('on'); });
    var desk = typeof _isDesk === 'function' && _isDesk();
    if (desk && f2) setTimeout(function () { try { f2.focus({ preventScroll: true }); } catch (e) {} }, 320);
  }
  _ptSyncWatch();
}
function ptSend() {
  var O = window._ptOpen, f = document.getElementById('pt-field');
  var text = f ? f.value.trim() : '';
  if (!O || !text) return;
  var me = _ptUser(), g = window._activeBrowseGame;
  if (!me || !window.db || !g) { if (typeof ib_toast === 'function') ib_toast('Sign in to chat'); return; }
  var I = O.info, replyTo;
  if (O.kind === 'pitch') {
    var pitch = {}; ['key', 'abi', 'num', 'of', 'tag', 'batter', 'pitcher', 'mph', 'type', 'call', 'where', 'px', 'pz', 'zt', 'zb', 'title', 'line'].forEach(function (k) { if (I[k] != null && I[k] !== '') pitch[k] = I[k]; });
    replyTo = { author: (I.tag ? I.tag + ' · ' : '') + I.title, text: I.line, pitch: pitch };
  } else {
    var play = { tag: I.tag || '', text: I.text || '', playId: I.key };
    if (I.card) play.card = I.card;
    replyTo = { author: I.tag || 'Play', text: I.text || '', play: play };
  }
  f.value = '';
  _gcAdd({ gamePk: g.gamePk, uid: me.uid, author: (window.userData && window.userData.name) || 'You', text: text, ts: Date.now(), replyTo: replyTo })
    .catch(function (err) { console.error('[pitch talk] send', err); if (typeof ib_toast === 'function') ib_toast('Couldn’t send — try again'); if (f && !f.value) f.value = text; });
}
// keep listening only to what's on screen: the card's at-bat and the open sheet
function _ptSyncWatch() {
  var keys = [];
  document.querySelectorAll('[data-ptkey],[data-ptsum]').forEach(function (el) { keys.push(el.getAttribute('data-ptkey') || el.getAttribute('data-ptsum')); });
  if (window._ptOpen) keys.push(window._ptOpen.info.key);
  _ptWant(keys);
}

// ── counts on the pitches themselves
function _ptCountFor(abi, num) { return _ptPitchComments(_ptPk() + '_' + abi + '_p' + num).length; }
function _ptDecorateRow() {
  document.querySelectorAll('.pap-pt[data-abi][data-num]').forEach(function (b) {
    var n = _ptCountFor(b.getAttribute('data-abi'), b.getAttribute('data-num')), i = b.querySelector('.pt-n');
    if (!n) { if (i) i.remove(); return; }
    if (!i) { i = document.createElement('i'); i.className = 'pt-n'; b.appendChild(i); }
    i.textContent = n;
  });
}
// tappable dots over the zone in the live at-bat square
function _ptZone() {
  var pf = document.querySelector('#gh-stage .gst-pf'), svg = pf && pf.querySelector(':scope > svg'), box = _ptBox();
  var old = pf && pf.querySelector('.pt-zone');
  var sq = box && box.pitchSequence;
  if (!pf || !svg || !sq || !(sq.pitches || []).length || typeof _szX !== 'function') { if (old) old.remove(); return; }
  var r = svg.getBoundingClientRect(), pr = pf.getBoundingClientRect();
  if (!r.width || !r.height) return;
  var sc = Math.min(r.width / 500, r.height / 386), ox = r.left - pr.left + (r.width - 500 * sc) / 2, oy = r.top - pr.top + (r.height - 386 * sc) / 2;
  var html = sq.pitches.map(function (p, i) {
    if (p.px == null || p.pz == null) return '';
    var num = p.num != null ? p.num : i + 1, x = ox + _szX(p.px) * sc, y = oy + _szY(p.pz) * sc, n = _ptCountFor(sq.atBatIndex, num);
    var mph = p.mph != null ? p.mph : p.speed;
    return '<button type="button" class="pt-zd" style="left:' + x.toFixed(1) + 'px;top:' + y.toFixed(1) + 'px" aria-label="Pitch ' + num + (mph != null ? ', ' + mph + ' mph' : '') + (p.type ? ' ' + _escapeHtml(p.type) : '') + ', ' + _escapeHtml(p.call || '') + '. React or comment" onclick="event.stopPropagation();ptOpenPitch(\'' + _escapeHtml(String(sq.atBatIndex)) + '\',\'' + _escapeHtml(String(num)) + '\')">' + (n ? '<i class="pt-n">' + n + '</i>' : '') + '</button>';
  }).join('');
  if (!old) { old = document.createElement('div'); old.className = 'pt-zone'; pf.appendChild(old); }
  if (old.innerHTML !== html) old.innerHTML = html;
}
function _ptDecorate() { try { _ptDecorateRow(); _ptZone(); _ptSyncWatch(); } catch (e) { console.error('[pitch talk]', e); } }

// ── the quick bar: an at-bat ended while you're on another tab
function _ptSheetShowing() {
  var scr = document.getElementById('screen-game'), panel = document.getElementById('game-sheet-panel');
  return !!(scr && scr.classList.contains('active') && panel && panel.style.display !== 'none' && panel.offsetParent !== null);
}
function _ptQuickBar(lp, box) {
  var scr = document.getElementById('screen-game');
  var ab = _ptAbInfo(box, lp);
  if (!scr || !ab || document.hidden) return;
  var old = document.getElementById('pt-qb'); if (old) old.remove();
  var c = ab.card || {};
  var bar = document.createElement('div');
  bar.id = 'pt-qb';
  bar.className = 'pt-qb';
  bar.setAttribute('role', 'status');
  bar.style.setProperty('--t1', c.t1 || '#3D3580'); bar.style.setProperty('--t2', c.t2 || '#CFC7FF');
  var inZone = document.getElementById('game-chat-input-zone');
  var lift = inZone && inZone.offsetParent !== null ? inZone.offsetHeight + 12 : 24;
  bar.style.bottom = 'calc(' + lift + 'px + env(safe-area-inset-bottom, 0px))';
  bar.innerHTML = '<div class="pt-qb-in"><div class="pt-qb-top"><div class="pt-hw"><div class="pt-sm">' + _escapeHtml([c.team, ab.tag].filter(Boolean).join(' · ')) + '</div><div class="pt-big">' + _escapeHtml(c.title || '') + '</div><div class="pt-l">' + _escapeHtml([c.who, c.sub].filter(Boolean).join(' · ')) + '</div></div>' +
    '<button type="button" class="pt-x" aria-label="Dismiss" onclick="_ptQbClose()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<div class="pt-qb-act">' + _ptRailHtml(ab.key, 'ab', ab.tag, ab.text) + '<button type="button" class="pt-cm" onclick="_ptQbClose();ptOpenAb(\'' + _escapeHtml(ab.abi) + '\')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>Comment</button></div></div><i class="pt-qb-tm"></i>';
  scr.appendChild(bar);
  requestAnimationFrame(function () { bar.classList.add('on'); });
  _ptSyncWatch();
  clearTimeout(window._ptQbT);
  window._ptQbT = setTimeout(_ptQbClose, 10000);
  // touching it buys time
  bar.addEventListener('pointerdown', function () { bar.classList.add('held'); clearTimeout(window._ptQbT); window._ptQbT = setTimeout(_ptQbClose, 6000); });
}
function _ptQbClose() {
  clearTimeout(window._ptQbT);
  var bar = document.getElementById('pt-qb');
  if (!bar) return;
  bar.classList.remove('on');
  setTimeout(function () { if (bar.parentNode) bar.remove(); _ptSyncWatch(); }, 350);
}

// ── hooks
(function () {
  // pitch rows carry their at-bat so a tap knows which pitch it is
  if (typeof _patSeqHtml === 'function') {
    var prevSeq = _patSeqHtml;
    _patSeqHtml = function (lp, delay, still, opt) {
      var h = prevSeq.apply(this, arguments);
      var abi = opt && opt.pick != null ? opt.pick : (lp && lp.atBatIndex);
      return abi != null ? h.replace(/<button type="button" class="pap-pt/g, '<button type="button" data-abi="' + _escapeHtml(String(abi)) + '" class="pap-pt') : h;
    };
  }
  // tapping a pitch in the row still shows its numbers, and now opens its sheet
  if (typeof _patPick === 'function') {
    var prevPick = _patPick;
    _patPick = function (abi, num) {
      var r = prevPick.apply(this, arguments);
      ptOpenPitch(abi, num);
      return r;
    };
  }
  if (typeof _patFillLive === 'function') {
    var prevFill = _patFillLive;
    _patFillLive = function () { var r = prevFill.apply(this, arguments); _ptDecorate(); return r; };
  }
  if (typeof _paFill === 'function') {
    var prevPa = _paFill;
    _paFill = function () { var r = prevPa.apply(this, arguments); _ptDecorate(); return r; };
  }
  // a new at-bat result: on another tab, the quick bar
  if (typeof _paNote === 'function') {
    var prevNote = _paNote;
    _paNote = function (box) {
      var s = window._pa, before = s && s.play ? String(s.play.atBatIndex) + ':' + s.startAt : '';
      var r = prevNote.apply(this, arguments);
      try {
        var lp = s && s.play, after = lp ? String(lp.atBatIndex) + ':' + s.startAt : '';
        if (lp && s.startAt && after !== before && Date.now() - s.startAt < 8000 && !(typeof _paIsAction === 'function' && _paIsAction(lp)) &&
            typeof _patTier === 'function' && _patTier(lp) && box && box.lastPlay && String(box.lastPlay.atBatIndex) === String(lp.atBatIndex) && !_ptSheetShowing()) {
          setTimeout(function () { _ptQuickBar(lp, box); }, 400);
        }
      } catch (e) { console.error('[pitch talk] bar', e); }
      return r;
    };
  }
  // chat updates: counts, the open thread, the card's Comment count
  if (typeof renderGameChat === 'function') {
    var prevChat = renderGameChat;
    renderGameChat = function () {
      var r = prevChat.apply(this, arguments);
      try {
        _ptDecorate();
        if (window._ptOpen) { var th = document.getElementById('pt-thread'); if (th) { var O = window._ptOpen; th.innerHTML = _ptThreadHtml(O.kind === 'pitch' ? _ptPitchComments(O.info.key) : _ptAbComments(O.info.key)); th.scrollTop = th.scrollHeight; } }
        _ptPaintSums(); // the card's pill: comment counts
      } catch (e) { console.error('[pitch talk]', e); }
      return r;
    };
  }
  // a reaction line in the chat about a pitch opens that pitch
  if (typeof openPlayContext === 'function') {
    var prevCtx = openPlayContext;
    openPlayContext = function (tag, text, playId) {
      var m = String(playId || '').match(/_(\d+)_p(\d+)$/);
      if (m) { ptOpenPitch(m[1], m[2]); return; }
      return prevCtx.apply(this, arguments);
    };
  }
  window.addEventListener('resize', function () { clearTimeout(window._ptRz); window._ptRz = setTimeout(_ptZone, 150); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && window._ptOpen) ptClose(); });
})();

// ── in the chat: a pitch comment carries the pitch
function _gcPitchQuoteHtml(rt, mine) {
  var p = rt.pitch || {};
  var top = Number(p.zt) || 3.4, bot = Number(p.zb) || 1.6;
  var X = function (px) { return 20 + px / 1.6 * 17; }, Y = function (pz) { return 44 - (pz - 1) / 3.4 * 40; };
  var zone = '<svg width="40" height="46" viewBox="0 0 40 46" aria-hidden="true"><rect x="' + X(-.83).toFixed(1) + '" y="' + Y(top).toFixed(1) + '" width="' + (X(.83) - X(-.83)).toFixed(1) + '" height="' + (Y(bot) - Y(top)).toFixed(1) + '" rx="1.5" fill="rgba(255,255,255,.06)" stroke="rgba(207,199,255,.8)" stroke-width="1.3"/>' +
    (p.px != null && p.pz != null ? '<circle cx="' + X(Math.max(-1.6, Math.min(1.6, p.px))).toFixed(1) + '" cy="' + Y(Math.max(1, Math.min(4.4, p.pz))).toFixed(1) + '" r="5.4" fill="' + (typeof _pitchCallColor === 'function' ? _pitchCallColor(p.call) : '#A89FE8') + '" stroke="#F2D98A" stroke-width="1.6"/>' : '') + '</svg>';
  var data = ' data-abi="' + _escapeHtml(p.abi || '') + '" data-num="' + _escapeHtml(p.num || '') + '"';
  return '<button class="gc-pq gc-ptq' + (mine ? ' me' : '') + '"' + data + ' onclick="event.stopPropagation();ptOpenFromQuote(this)">' +
    '<span class="gc-ptz">' + zone + '</span><span class="gc-ptw"><span class="gc-pq-hd"><span>' + _escapeHtml(rt.author || 'Pitch') + '</span><span class="gc-pq-go">Open ›</span></span>' +
    '<span class="gc-pq-tx">' + _escapeHtml(p.line || rt.text || '') + '</span></span></button>';
}
function ptOpenFromQuote(btn) {
  var abi = btn.getAttribute('data-abi'), num = btn.getAttribute('data-num');
  var msgs = _ptMsgs(), stored = null;
  msgs.forEach(function (m) { var p = m.replyTo && m.replyTo.pitch; if (p && String(p.abi) === String(abi) && String(p.num) === String(num)) stored = p; });
  ptOpenPitch(abi, num, stored);
}
