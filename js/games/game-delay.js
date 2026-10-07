// ══ DELAY (v7.25.0) ═══════════════════════════════════════════════════
// Under Watching / Attending in the scoreboard dropdown: Off · 5s · 15s ·
// 30s · Custom.
// · Every refresh still comes in on time; the screen shows the one from N
//   seconds ago, so the app runs a little behind your TV instead of
//   spoiling it.
// · Pull down on the game (or Catch up in the dropdown) to jump to live:
//   the play you just saw on TV runs in the square. Then it falls back
//   behind again for the next one.
// · Custom: a dial (0–120s), or Match my TV — tap on two pitches as your TV
//   shows them. The gap between your taps lines up with the gap between
//   those two pitches reaching the app, which says how far behind your TV
//   runs. (Two taps, not one: one tap can't tell which pitch you saw
//   without showing you pitches you haven't seen yet.)
// · Hold chat and alerts too: friends' messages wait the same N seconds
//   (yours never do), and alert previews for this game's chat stay hidden.
// MLB games. The setting is per device and sticks from game to game.
var GDL_KEY = 'innings_delay';
var GDL_CLOCK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
var GDL_TV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M12 18v3"/></svg>';
window._gdl = window._gdl || { pk: null, buf: [], shownAt: 0, caughtAt: 0, arr: {}, cal: null, catchReq: false, t: null, ct: {} };

function _gdlLoad() {
  try {
    var v = JSON.parse(localStorage.getItem(GDL_KEY) || 'null');
    if (v && typeof v === 'object') return { pick: v.pick === 'custom' ? 'custom' : (Number(v.pick) || 0), custom: Math.max(0, Math.min(120, Math.round(Number(v.custom)) || 0)), hold: v.hold !== false, matched: !!v.matched };
  } catch (e) {}
  return { pick: 0, custom: 45, hold: true, matched: false };
}
window._gdlSet = _gdlLoad();
function _gdlSave() { try { localStorage.setItem(GDL_KEY, JSON.stringify(window._gdlSet)); } catch (e) {} }
function _gdlMlb() { var g = window._activeBrowseGame; return !!g && (g.sport || 'mlb') === 'mlb'; }
function _gdlSec() { var s = window._gdlSet; return s.pick === 'custom' ? s.custom : (s.pick || 0); }
function _gdlOn() { return _gdlMlb() && _gdlSec() > 0; }
function _gdlPk() { var g = window._activeBrowseGame; return g && g.gamePk != null ? String(g.gamePk) : ''; }
function _gdlLive() { var b = window._lastLiveBox; return !!(b && b.gameState === 'Live'); }
function _gdlMe() { var u = window.currentUser || (window.auth && window.auth.currentUser); return u ? u.uid : null; }
function _gdlDesk() { return typeof _isDesk === 'function' && _isDesk(); }
function _gdlRecent() { return Date.now() - window._gdl.caughtAt < 5000; }
// refresh every 3s instead of 6 while a delay's on, you're matching your TV, or the dropdown is open
function _gdlFast() { return _gdlMlb() && (_gdlOn() || !!window._gdl.cal || !!window._gshDropOn); }
function _gdlRepoll() {
  var g = window._activeBrowseGame;
  if (g && window._gameLiveRefreshTimer && typeof _startGameLiveRefresh === 'function') _startGameLiveRefresh(g.gamePk);
}

// ── the buffer: every refresh, with when it arrived
function _gdlTake(pk, box) {
  var g = window._gdl, now = Date.now(), last = g.buf[g.buf.length - 1];
  // a different game, or back after time away (refreshes stop off screen): start fresh
  var fresh = g.pk !== pk || (last && now - last.t > 20000);
  if (g.pk !== pk) { g.arr = {}; g.cal = null; g.caughtAt = 0; }
  if (fresh) { g.pk = pk; g.buf = []; g.shownAt = 0; }
  g.buf.push({ t: now, box: box });
  if (g.buf.length > 90) g.buf = g.buf.slice(-90);
  // when each pitch first reached the app (Match my TV lines taps up with these);
  // ones already there on the first look have no real arrival time
  var note = function (abi, list) {
    if (abi == null) return;
    (list || []).forEach(function (p, i) { var k = abi + ':' + (p && p.num != null ? p.num : i + 1); if (!(k in g.arr)) g.arr[k] = fresh ? -1 : now; });
  };
  var ps = box && box.pitchSequence, lp = box && box.lastPlay;
  if (ps) note(ps.atBatIndex, ps.pitches);
  if (lp) note(lp.atBatIndex, lp.pitches);
}
// put the right one on screen: the newest that's at least N seconds old
function _gdlRelease(gamePk) {
  var g = window._gdl, now = Date.now(), D = _gdlSec() * 1000, pick = null, caught = false;
  if (!g.buf.length) return false;
  var empty = !(window._gdPregame && window._gdPregame.heroBox);
  if (g.catchReq || !_gdlOn()) {
    pick = g.buf[g.buf.length - 1];
    if (g.catchReq && _gdlOn()) { g.catchReq = false; g.caughtAt = now; caught = true; }
  } else {
    g.buf.forEach(function (e) { if (e.t > g.shownAt && e.t <= now - D) pick = e; });
    // the first look at a game can't wait; a re-render with nothing on screen shows what was there
    if (!pick && (!g.shownAt || empty)) pick = g.buf.filter(function (e) { return e.t === g.shownAt; })[0] || g.buf[g.buf.length - 1];
  }
  var r = null;
  if (pick && (pick.t !== g.shownAt || empty)) { g.shownAt = pick.t; r = _applyBoxScoreResult(gamePk, 'mlb', pick.box); }
  g.buf = g.buf.filter(function (e) { return e.t >= g.shownAt; });
  _gdlSchedule();
  if (caught) _gdlCaught();
  var pending = g.buf.some(function (e) { return e.t > g.shownAt; }), nb = g.buf[g.buf.length - 1];
  if (r === null) return pending || !!(nb && nb.box && nb.box.gameState === 'Live');
  return r || pending;
}
// the next one comes due between refreshes: put it up right on time
function _gdlSchedule() {
  var g = window._gdl;
  clearTimeout(g.t);
  if (!_gdlOn()) return;
  var next = null;
  g.buf.forEach(function (e) { if (!next && e.t > g.shownAt) next = e; });
  if (!next) return;
  var pk = g.pk, gamePk = window._activeBrowseGame && window._activeBrowseGame.gamePk;
  g.t = setTimeout(function () {
    var scr = document.getElementById('screen-game');
    if (_gdlPk() !== pk || !scr || !scr.classList.contains('active')) return;
    _gdlRelease(gamePk);
  }, Math.max(0, next.t + _gdlSec() * 1000 - Date.now()) + 40);
}

// ── catching up
function gdlCatchUp() {
  if (!_gdlOn() || typeof gameRefreshNow !== 'function') return Promise.resolve();
  return gameRefreshNow();
}
function _gdlCaught() {
  if (typeof ib_toast === 'function') ib_toast('Caught up to live');
  _gdlChatTick(_gdlPk());
  _gdlPaintAll();
  clearTimeout(window._gdlLiveT);
  window._gdlLiveT = setTimeout(_gdlPaintAll, 5100);
}

// ── chat: friends' newest messages wait until you've seen the play
function _gdlHolding(key) { return _gdlOn() && window._gdlSet.hold && key === _gdlPk(); }
function _gdlChatFilter(key, msgs) {
  var g = window._gdl;
  clearTimeout(g.ct[key]);
  if (!_gdlHolding(key)) return msgs;
  var me = _gdlMe(), D = _gdlSec() * 1000, now = Date.now(), next = 0;
  var out = (msgs || []).filter(function (m) {
    var ts = m.ts || 0;
    if ((me && m.uid === me) || ts <= now - D || ts <= g.caughtAt) return true;
    if (!next || ts + D < next) next = ts + D;
    return false;
  });
  if (next) g.ct[key] = setTimeout(function () { _gdlChatTick(key); }, Math.max(0, next - now) + 60);
  return out;
}
function _gdlChatTick(key) {
  var raw = key && (window._gameChatRaw || {})[key];
  if (!raw) return;
  var vis = _gdlChatFilter(key, raw), cur = (window._gameChatMsgs || {})[key] || [];
  if (vis.length === cur.length && vis.every(function (m, i) { return cur[i] === m; })) return;
  window._gameChatMsgs[key] = vis;
  if (_gdlPk() === key && typeof renderGameChat === 'function') renderGameChat(vis);
}
// alert previews for this game's chat (the notifications list)
function _gdlHideNotif(n) {
  if (!n || n.type !== 'game_chat_message' || n.gamePk == null) return false;
  var key = String(n.gamePk), ts = n.ts || 0;
  return _gdlHolding(key) && ts > Date.now() - _gdlSec() * 1000 && ts > window._gdl.caughtAt;
}

// ── showing it: the LIVE tag, the tag under the score bug
function _gdlPaintChips() {
  var on = _gdlOn() && !_gdlRecent(), txt = _gdlSec() + 's behind';
  document.querySelectorAll('#game-sheet-panel .gh-chip.live, #gsbd-hero .gh-chip.live').forEach(function (el) {
    if (on) {
      if (!el.classList.contains('gdl') || el.textContent !== txt) { el.classList.add('gdl'); el.innerHTML = '<span class="gh-dot gdl-dot"></span>' + txt; }
    } else if (el.classList.contains('gdl')) { el.classList.remove('gdl'); el.innerHTML = '<span class="gh-dot live"></span>LIVE'; }
  });
}
function _gdlTagHtml() {
  if (!_gdlOn()) return '';
  var b = window._gdPregame && window._gdPregame.heroBox;
  if (!b || b.gameState !== 'Live') return '';
  var lv = _gdlRecent();
  return '<span class="gsb-dl' + (lv ? ' lv' : '') + '" role="status" aria-label="' + (lv ? 'Caught up to live' : _gdlSec() + ' seconds behind live') + '">' + (lv ? '<i></i>Live' : GDL_CLOCK + _gdlSec() + 's behind') + '</span>';
}
function _gdlPaintAll() {
  _gdlPaintChips();
  if (typeof _gshRefresh === 'function') { try { _gshRefresh(); } catch (e) {} }
  if (window._gshDropOn) _gdlRow();
}

// ── the live count, in the dropdown (v7.27.1)
function _gdlLiveInner() {
  var b = window._lastLiveBox, s = (b && b.situation) || {}, seq = b && b.pitchSequence, ps = (seq && seq.pitches) || [], p = ps.length ? ps[ps.length - 1] : null;
  var n = function (k, v, c) { return '<span class="gdl-ct"><i>' + k + '</i><b style="color:' + c + '">' + (v != null ? v : 0) + '</b></span>'; };
  var brk = s.inningState === 'Middle' || s.inningState === 'End';
  var mph = p ? (p.mph != null ? p.mph : p.speed) : null;
  var call = p && p.call ? (typeof _gstShortCall === 'function' ? _gstShortCall(p.call) : p.call) : '';
  var what = brk ? 'Between innings' : p
    ? 'Pitch ' + (p.num != null ? p.num : ps.length) + ' · ' + (mph != null ? Math.round(Number(mph)) + ' ' : '') + _escapeHtml(typeof _gstPitchName === 'function' ? _gstPitchName(p) : (p.type || '')) + (call ? ' · <em style="color:' + (typeof _pitchCallColor === 'function' ? _pitchCallColor(p.call) : '#CFC7FF') + '">' + _escapeHtml(call) + '</em>' : '')
    : 'Waiting on the first pitch';
  return '<span class="gdl-lvl"><i></i>' + (_gdlOn() ? _gdlSec() + 's behind' : 'Live') + '</span>' +
    '<span class="gdl-cts" aria-label="' + (s.balls || 0) + ' balls, ' + (s.strikes || 0) + ' strikes, ' + (s.outs || 0) + ' outs">' + n('B', s.balls, '#7BE3A6') + n('S', s.strikes, '#FFFFFF') + n('O', s.outs, '#F2D98A') + '</span>' +
    '<span class="gdl-lp">' + what + '</span>';
}
function _gdlPaintLive() {
  var el = document.getElementById('gdl-live');
  if (!el) return;
  var h = _gdlLiveInner();
  if (el.innerHTML === h) return;
  el.innerHTML = h;
  el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); // a beat when the count moves, to line up with the TV
}

// ── the row in the dropdown
function _gdlTip() {
  var s = window._gatt && window._gatt.mode;
  if (s === 'attend') return 'At the park the app is usually behind the field already, so you won’t need much.';
  if (_gdlOn()) return 'Set it just behind your TV. When you see the play, ' + (_gdlDesk() ? 'hit Catch up' : 'pull down on the game') + ' to see it here.';
  return 'Watching on TV? Put the app a few seconds behind it so it never spoils a play.';
}
function _gdlRow() {
  var el = document.getElementById('gsbd-delay');
  if (!el) return;
  var b = window._lastLiveBox;
  if (!_gdlMlb() || (b && b.gameState === 'Final')) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = '';
  var S = window._gdlSet, c = window._gdl.cal, on = _gdlOn(), live = _gdlLive(), E = _escapeHtml;
  var opt = function (v, label) {
    var sel = S.pick === v;
    return '<button type="button" class="gatt-opt gdl-opt' + (sel ? ' on' : '') + '" aria-pressed="' + sel + '" onclick="gdlPick(' + (v === 'custom' ? '\'custom\'' : v) + ')">' + label + '</button>';
  };
  var h = '<div class="gdl-r1"><span class="gdl-lab">' + GDL_CLOCK + 'Delay</span><div class="gatt-opts gdl-opts" role="group" aria-label="Delay">' +
    opt(0, 'Off') + opt(5, '5s') + opt(15, '15s') + opt(30, '30s') + opt('custom', S.pick === 'custom' ? '<span id="gdl-chip">' + S.custom + 's</span>' : 'Custom') + '</div></div>';
  // v7.27.1: the count as the app shows it, right here — the dropdown covers the square,
  // and this is what you line up against your TV
  if (live) h += '<div class="gdl-live" id="gdl-live">' + _gdlLiveInner() + '</div>';
  if (c) h += _gdlCalHtml(c);
  else if (S.pick === 'custom') {
    h += '<div class="gdl-box">' +
      '<div class="gdl-dial"><button type="button" class="gdl-stp" aria-label="One second less" onclick="gdlStep(-1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>' +
        '<div class="gdl-mid"><span class="gdl-val"><b id="gdl-val">' + S.custom + '</b><small>sec</small></span>' +
        '<label class="gdl-rl"><span class="gdl-sr">Delay in seconds</span><input class="gdl-rng" type="range" min="0" max="120" step="1" value="' + S.custom + '" oninput="gdlSlide(this,false)" onchange="gdlSlide(this,true)"></label></div>' +
        '<button type="button" class="gdl-stp" aria-label="One second more" onclick="gdlStep(1)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>' +
      '<button type="button" class="gdl-mt" onclick="gdlMatchStart()"' + (live ? '' : ' disabled') + '>' + GDL_TV + 'Match my TV</button>' +
      '<div class="gdl-note">' + (live ? (S.matched ? 'Matched to your TV. Run it again if you switch channels or apps.' : 'Streaming apps run 20–60 seconds behind. Let Innings measure yours.') : 'Match my TV works once the game’s on.') + '</div></div>';
  }
  if (!c) {
    h += '<div class="gdl-tip">' + GDL_TV + '<span>' + E(_gdlTip()) + '</span></div>';
    if (on) h += '<div class="gdl-hold"><div class="gdl-hw"><div class="gdl-ht" id="gdl-hold-l">Hold chat and alerts too</div><div class="gdl-hs">So a friend who’s ahead can’t spoil it</div></div>' +
      '<button type="button" class="gdl-sw' + (S.hold ? ' on' : '') + '" role="switch" aria-checked="' + !!S.hold + '" aria-labelledby="gdl-hold-l" onclick="gdlHold()"><i></i></button></div>';
    if (on && live) h += '<button type="button" class="gdl-cu" onclick="gdlCatchUpBtn()">' + GDL_CLOCK.replace('width="12" height="12"', 'width="15" height="15"') + 'Catch up to live</button>';
  }
  el.innerHTML = h;
}
function _gdlCalHtml(c) {
  if (c.step === 'listen') {
    var n = c.taps.length;
    return '<div class="gdl-cal">' +
      '<div class="gdl-ct">Watch your TV</div>' +
      '<div class="gdl-cs">' + (n ? 'Again, on the very next pitch.' : 'Tap the moment a pitch hits the catcher’s mitt, then again on the next pitch.') + '</div>' +
      '<button type="button" class="gdl-now" onclick="gdlMatchTap()">NOW</button>' +
      '<div class="gdl-of" aria-live="polite">' + (n + 1) + ' of 2</div>' +
      '<button type="button" class="gdl-x" onclick="gdlMatchCancel()">Cancel</button></div>';
  }
  if (c.step === 'measure') return '<div class="gdl-cal" role="status"><span class="gdl-spin" aria-hidden="true"></span><div class="gdl-cs">Lining your taps up with those pitches…</div></div>';
  if (c.step === 'done') {
    var ahead = c.sec <= 0;
    return '<div class="gdl-cal gdl-ok" role="status">' +
      (ahead ? '<div class="gdl-ct">Your TV is even with the app</div><div class="gdl-cs">It isn’t behind, so you don’t need a delay. It’s off.</div>'
        : '<div class="gdl-cs">Your TV is</div><div class="gdl-big">' + c.lag + ' sec</div><div class="gdl-cs">behind the app</div>' +
          '<div class="gdl-cn">Delay set to <b>' + c.sec + 's</b>, a hair behind your TV. ' + (_gdlDesk() ? 'Hit Catch up' : 'Pull down on the game') + ' whenever you want the play.</div>') +
      '<button type="button" class="gdl-done" onclick="gdlMatchCancel()">Done</button></div>';
  }
  return '<div class="gdl-cal gdl-bad" role="status"><div class="gdl-ct">Couldn’t line those up</div><div class="gdl-cs">' + _escapeHtml(c.msg || 'Try again on the next two pitches.') + '</div>' +
    '<button type="button" class="gdl-done" onclick="gdlMatchStart()">Try again</button><button type="button" class="gdl-x" onclick="gdlMatchCancel()">Cancel</button></div>';
}

// ── the controls
function _gdlChanged() {
  var g = window._activeBrowseGame;
  _gdlSave();
  _gdlRepoll();
  if (g && window._gdl.pk === _gdlPk() && window._gdl.buf.length) _gdlRelease(g.gamePk); // shorter or off: whatever's due goes up now
  else _gdlSchedule();
  _gdlChatTick(_gdlPk());
  _gdlPaintAll();
}
function gdlPick(v) {
  var S = window._gdlSet;
  S.pick = v === 'custom' ? 'custom' : (Number(v) || 0);
  if (S.pick === 'custom' && !S.custom) S.custom = 45;
  window._gdl.cal = null;
  _gdlChanged();
}
function gdlStep(d) { var S = window._gdlSet; S.custom = Math.max(0, Math.min(120, S.custom + d)); S.matched = false; _gdlChanged(); }
function gdlSlide(inp, commit) {
  var v = Math.max(0, Math.min(120, parseInt(inp.value, 10) || 0));
  var a = document.getElementById('gdl-val'), b = document.getElementById('gdl-chip');
  if (a) a.textContent = v;
  if (b) b.textContent = v + 's';
  if (!commit) return;
  window._gdlSet.custom = v; window._gdlSet.matched = false;
  _gdlChanged();
}
function gdlHold() { window._gdlSet.hold = !window._gdlSet.hold; _gdlChanged(); }
function gdlCatchUpBtn() {
  if (typeof gshCloseDrop === 'function') gshCloseDrop();
  gdlCatchUp();
}

// ── Match my TV
function _gdlHaptic() { if (typeof window._msHaptic === 'function') window._msHaptic(); }
function gdlMatchStart() {
  if (!_gdlLive()) { if (typeof ib_toast === 'function') ib_toast('Match my TV works once the game’s on'); return; }
  clearInterval(window._gdlCalI);
  window._gdl.cal = { step: 'listen', taps: [], at: Date.now() };
  _gdlRepoll();
  _gdlRow();
  var b = document.querySelector('#gsbd-delay .gdl-now'); if (b) try { b.focus({ preventScroll: true }); } catch (e) {}
}
function gdlMatchCancel() {
  clearInterval(window._gdlCalI);
  window._gdl.cal = null;
  _gdlRepoll();
  _gdlRow();
}
function gdlMatchTap() {
  var c = window._gdl.cal;
  if (!c || c.step !== 'listen') return;
  var now = Date.now();
  // a second tap more than 90s after the first: start over from this one
  if (c.taps.length && now - c.taps[0] > 90000) c.taps = [];
  c.taps.push(now);
  _gdlHaptic();
  if (c.taps.length >= 2) {
    c.step = 'measure';
    c.until = now + 15000; // if your TV is ahead of the app, those pitches haven't come in yet
    clearInterval(window._gdlCalI);
    window._gdlCalI = setInterval(_gdlCalTry, 1000);
    _gdlCalTry();
  }
  _gdlRow();
  var b = document.querySelector('#gsbd-delay .gdl-now'); if (b) try { b.focus({ preventScroll: true }); } catch (e) {}
}
// The two taps are two pitches in a row on your TV. Find the two pitches in
// a row whose arrival here is spaced the same way; the offset is your TV.
function _gdlCalSolve(t1, t2, arr) {
  var list = Object.keys(arr).map(function (k) { return { k: k, a: arr[k] }; })
    .filter(function (x) { return x.a > 0 && x.a >= t1 - 150000 && x.a <= t2 + 20000; })
    .sort(function (x, y) { return x.a - y.a; });
  var want = t2 - t1, best = null, second = null;
  for (var i = 0; i + 1 < list.length; i++) {
    var A = list[i], B = list[i + 1];
    if (B.a === A.a) continue;
    var lag = ((t1 - A.a) + (t2 - B.a)) / 2;
    if (lag < -20000 || lag > 150000) continue;
    var c = { err: Math.abs((B.a - A.a) - want), lag: lag };
    if (!best || c.err < best.err) { second = best; best = c; } else if (!second || c.err < second.err) second = c;
  }
  return { best: best, second: second };
}
function _gdlCalTry() {
  var c = window._gdl.cal;
  if (!c || c.step !== 'measure') { clearInterval(window._gdlCalI); return; }
  var r = _gdlCalSolve(c.taps[0], c.taps[1], window._gdl.arr), b = r.best, s = r.second;
  var ok = b && b.err <= 4500 && (!s || s.err - b.err > 1500 || Math.abs(s.lag - b.lag) < 3000);
  if (ok) {
    clearInterval(window._gdlCalI);
    var lag = Math.max(0, Math.round(b.lag / 1000)), sec = lag >= 1 ? Math.min(120, lag + 2) : 0;
    var S = window._gdlSet;
    if (sec > 0) { S.pick = 'custom'; S.custom = sec; S.matched = true; } else { S.pick = 0; S.matched = false; }
    c.step = 'done'; c.lag = lag; c.sec = sec;
    _gdlHaptic();
    _gdlChanged();
    if (!window._gshDropOn && typeof ib_toast === 'function') ib_toast(sec ? 'Delay set to ' + sec + 's — matched to your TV' : 'Your TV is even with the app — no delay needed');
    return;
  }
  if (Date.now() > c.until) {
    clearInterval(window._gdlCalI);
    c.step = 'fail';
    c.msg = b && b.err <= 9000 ? 'Close, but not sure. Try again on the next two pitches, tapping right as the ball pops the mitt.' : 'Try again on the next two pitches in a row (not a pickoff or a mound visit).';
    _gdlRow();
  }
}

// ── hooks
(function () {
  // every MLB refresh goes through the buffer (with no delay it shows straight away, as before)
  if (typeof _refreshBoxScoreLegacy === 'function' && typeof _applyBoxScoreResult === 'function') {
    var prevRef = _refreshBoxScoreLegacy;
    _refreshBoxScoreLegacy = function (gamePk) {
      if (!_gdlMlb()) return prevRef.apply(this, arguments);
      var url = _bsModalBoxscoreUrl('mlb', gamePk) + '&plays=all';
      return fetch(url).then(function (r) { return r.json(); }).then(function (box) {
        if (!window._activeBrowseGame || window._activeBrowseGame.gamePk != gamePk) return false;
        _gdlTake(String(gamePk), box);
        var live = _gdlRelease(gamePk);
        if (window._gdl.cal && window._gdl.cal.step === 'measure') _gdlCalTry();
        return live;
      }).catch(function (err) { console.error('Load box score error:', err); return false; });
    };
  }
  // pull down on a delayed game: catch up to live
  if (typeof gameRefreshNow === 'function') {
    var prevNow = gameRefreshNow;
    gameRefreshNow = function () {
      if (_gdlOn() && _gdlLive()) window._gdl.catchReq = true;
      return Promise.resolve(prevNow.apply(this, arguments)).then(function (v) { window._gdl.catchReq = false; return v; }, function (e) { window._gdl.catchReq = false; throw e; });
    };
  }
  var panel = document.getElementById('game-sheet-panel');
  if (panel) panel._ptrWords = function () { return _gdlOn() && _gdlLive() ? { pull: 'Pull to catch up', release: 'Let go to see it now', busy: 'Catching up…' } : null; };
  // the tag under the score bug
  if (typeof _gshBarHtml === 'function') {
    var prevBar = _gshBarHtml;
    _gshBarHtml = function () {
      var h = prevBar.apply(this, arguments), tag = h ? _gdlTagHtml() : '';
      return tag ? h.replace(/<\/div>$/, tag + '</div>') : h;
    };
  }
  // the row, right under Watching / Attending
  if (typeof _gshSetup === 'function') {
    var prevSetup = _gshSetup;
    _gshSetup = function () {
      var r = prevSetup.apply(this, arguments);
      var drop = document.getElementById('game-sb-drop'), att = drop && drop.querySelector('.gsbd-att');
      if (att && !document.getElementById('gsbd-delay')) { var d = document.createElement('div'); d.id = 'gsbd-delay'; d.className = 'gdl'; att.parentNode.insertBefore(d, att.nextSibling); }
      return r;
    };
  }
  if (typeof gshOpenDrop === 'function') {
    var prevOpen = gshOpenDrop;
    gshOpenDrop = function () { var r = prevOpen.apply(this, arguments); _gdlRow(); _gdlRepoll(); return r; };
  }
  if (typeof gshCloseDrop === 'function') {
    var prevClose = gshCloseDrop;
    gshCloseDrop = function () {
      var r = prevClose.apply(this, arguments);
      var c = window._gdl.cal;
      if (c && c.step === 'listen') { window._gdl.cal = null; }
      else if (c && (c.step === 'done' || c.step === 'fail')) window._gdl.cal = null;
      _gdlRepoll();
      return r;
    };
  }
  // the LIVE tag on the scoreboard (and its copy in the dropdown)
  if (typeof renderGameCheatSheet === 'function') {
    var prevRender = renderGameCheatSheet;
    renderGameCheatSheet = function () { var r = prevRender.apply(this, arguments); try { _gdlPaintChips(); _gdlPaintLive(); } catch (e) {} return r; };
  }
  if (typeof _gshFillDrop === 'function') {
    var prevFill = _gshFillDrop;
    _gshFillDrop = function () { var r = prevFill.apply(this, arguments); try { _gdlPaintChips(); } catch (e) {} return r; };
  }
})();
