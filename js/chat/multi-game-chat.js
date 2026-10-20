// ══ ONE CHAT, EVERY GAME (v7.61.0) ═══════════════════════════════════════
// A private game chat (js/chat/game-chat-rooms.js) can hold more than one
// game, from any sport. At the top of the Chat tab, as soon as you're in a
// chat (one you just started included):
//   · a rail of the games in it — live score and status on each chip
//   · + Add game: today's games in every league; Add puts one in the chat
//   · ALL (the default once there's more than one game): everything said
//     and every play reacted to, in every game, in one thread, each tagged
//     with its game. Tap this game's chip to see only this game; tap another
//     game's chip to go to that game, on its Chat tab, in the same chat.
// Stored on the room doc: gamePks [pk] (the game it started on first) and
// games.<pk> { gamePk, sport, away, home, aa, ha, date, by, at }. The room's
// own messages already carry gamePk, so nothing moves — opening any game in
// gamePks finds the room (the gamePks listener in game-chat-rooms.js) and
// shows the same messages. A reaction on any of its games posts into it.
// The game a chat started on stays in it.
window._mgc = window._mgc || { filter: {}, sport: 'all', q: '', open: false, busy: {}, loadAt: 0, tick: null };
var MGC_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
var MGC_SEARCH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';

function _mgcEsc(s) { return typeof _escapeHtml === 'function' ? _escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s); }
function _mgcToday() { return typeof _todayLocal === 'function' ? _todayLocal() : new Date().toISOString().slice(0, 10); }
function _mgcGk(pk) { return String(pk).replace(/[^A-Za-z0-9_-]/g, '_'); }
// you're in a private chat on the game on screen
function _mgcS() { var S = typeof _gcrState === 'function' ? _gcrState() : null; return S && S.mine && S.mine.kind === 'new' && S.v && S.v.mode === 'rooms' ? S : null; }
// the games in a chat, the one it started on first
function _mgcPks(R) {
  var a = (R.gamePks && R.gamePks.length ? R.gamePks : []).map(String), home = String(R.pk);
  return [home].concat(a.filter(function (p) { return p !== home; }));
}
function _mgcMulti(R) { return !!R && _mgcPks(R).length > 1; }
function _mgcLive(pk) {
  var hit = null;
  (typeof _mvAll === 'function' ? _mvAll() : []).forEach(function (x) { if (!hit && String(x.g.gamePk) === String(pk)) hit = x; });
  return hit;
}
// what to show for one game: today's feed when it's in it, else what the chat stored
function _mgcInfo(R, pk) {
  pk = String(pk);
  var s = ((R && R.games) || {})[_mgcGk(pk)] || {}, L = _mgcLive(pk), a = window._activeBrowseGame, st = window._gcr && window._gcr[pk];
  var on = a && String(a.gamePk) === pk ? a : (st && st.game) || null;
  var g = L ? L.g : null;
  var sport = (L && L.sport) || s.sport || (on && on.sport) || 'mlb';
  var away = (g && g.away) || s.away || (on && on.away) || '', home = (g && g.home) || s.home || (on && on.home) || '';
  var look = typeof _mvLook === 'function' ? _mvLook : function (sp, n, ab) { return { abbr: ab || String(n || '').slice(0, 3).toUpperCase(), accent: '#A89FE8', bg: '#3D3580' }; };
  var ca = look(sport, away, (g && g.awayAbbr) || s.aa, g && g.awayColor, g && g.awayAlt), ch = look(sport, home, (g && g.homeAbbr) || s.ha, g && g.homeColor, g && g.homeAlt);
  var phase = g && typeof _mvPhase === 'function' ? _mvPhase(sport, g) : null;
  var status = g && typeof _mvStatus === 'function' ? _mvStatus(sport, g, phase) : (s.date && s.date !== _mgcToday() ? s.date.slice(5).replace('-', '/') : '');
  var league = typeof _mvLeague === 'function' ? _mvLeague(sport) : String(sport).toUpperCase();
  return { pk: pk, gamePk: g ? g.gamePk : (s.gamePk != null ? s.gamePk : (on ? on.gamePk : pk)), sport: sport, away: away, home: home, ca: ca, ch: ch, g: g, phase: phase, status: status, league: league,
    label: (ca.abbr || '?') + ' @ ' + (ch.abbr || '?'), date: s.date || (on && on.date) || _mgcToday() };
}
// what the chat stores about a game
function _mgcStoreOf(pk, x) {
  var g = (x && x.g) || {}, a = window._activeBrowseGame, on = !x && a && String(a.gamePk) === String(pk) ? a : null;
  return { gamePk: x ? g.gamePk : (on ? on.gamePk : pk), sport: x ? x.sport : ((on && on.sport) || 'mlb'), away: x ? g.away || null : (on && on.away) || null, home: x ? g.home || null : (on && on.home) || null,
    aa: g.awayAbbr || null, ha: g.homeAbbr || null, date: x ? _mgcToday() : ((on && on.date) || _mgcToday()), by: _gcrMe(), at: Date.now() };
}
// "only this game" is remembered per chat and game; ALL is the default
function _mgcFk(R) { return R.id + '|' + ((typeof _gcrKey === 'function' && _gcrKey()) || ''); }
function _mgcFilter(R) { return (R && _mgcMulti(R) && window._mgc.filter[_mgcFk(R)]) || 'all'; }

// ── the rail at the top of the chat
function _mgcHost() {
  var panel = document.getElementById('game-chat-panel');
  if (!panel) return null;
  var host = document.getElementById('mgc');
  if (!host) {
    host = document.createElement('div'); host.id = 'mgc'; host.className = 'mgc';
    var gct = document.getElementById('gct'), req = document.getElementById('gcr-req');
    if (gct) panel.insertBefore(host, gct);
    else if (req) req.insertAdjacentElement('afterend', host);
    else panel.insertBefore(host, panel.firstChild);
  }
  return host;
}
function _mgcTeamRow(c, sc, scored, lo) {
  return '<span class="mgc-tr' + (lo ? ' lo' : '') + '"><i style="background:' + _mgcEsc(c.accent || '#A89FE8') + '"></i><span>' + _mgcEsc(c.abbr) + '</span>' + (scored ? '<b>' + _mgcEsc(sc) + '</b>' : '') + '</span>';
}
function _mgcChip(R, I, key, filter, multi) {
  var g = I.g || {}, here = I.pk === key, on = multi ? (filter === 'this' && here) : here;
  var scored = !!I.phase && I.phase !== 'pre' && g.awayScore != null && g.homeScore != null;
  var as = Number(g.awayScore), hs = Number(g.homeScore);
  var live = I.phase === 'live';
  var aria = I.label + (I.status ? ', ' + I.status : '') + (here ? (multi ? (on ? ', showing only this game' : ', this game · tap to show only it') : ', this game') : ', go to this game');
  return '<button type="button" class="mgc-c' + (on ? ' on' : '') + (here ? ' here' : '') + '" onclick="mgcTap(\'' + _mgcEsc(I.pk) + '\')" aria-label="' + _mgcEsc(aria) + '"' + (here && multi ? ' aria-pressed="' + (on ? 'true' : 'false') + '"' : '') + '>' +
    '<span class="mgc-lg"><i class="' + (live ? 'live' : '') + '"></i>' + _mgcEsc(I.league) + (here ? '<em>' + (multi ? (on ? 'Only this' : 'Here') : 'Here') + '</em>' : '') + '</span>' +
    '<span class="mgc-tm">' + _mgcTeamRow(I.ca, g.awayScore, scored, scored && as < hs) + _mgcTeamRow(I.ch, g.homeScore, scored, scored && hs < as) + '</span>' +
    '<span class="mgc-st">' + _mgcEsc(I.status || ' ') + '</span></button>';
}
function _mgcPaint() {
  var host = _mgcHost();
  if (!host) return;
  var S = _mgcS();
  if (!S) { host.innerHTML = ''; host.style.display = 'none'; return; }
  var R = S.mine, key = S.key, pks = _mgcPks(R), multi = pks.length > 1, filter = _mgcFilter(R);
  host.style.display = '';
  var chips = '';
  if (multi) {
    var nLive = pks.filter(function (p) { var I = _mgcInfo(R, p); return I.phase === 'live'; }).length;
    chips += '<button type="button" class="mgc-c all' + (filter === 'all' ? ' on' : '') + '" onclick="mgcAll()" aria-pressed="' + (filter === 'all' ? 'true' : 'false') + '" aria-label="All games in this chat">' +
      '<span class="mgc-all">ALL</span><span class="mgc-st">' + (nLive ? nLive + ' live' : pks.length + ' games') + '</span></button>';
  }
  // this game right after ALL, then the rest
  var order = [key].concat(pks.filter(function (p) { return p !== key; }));
  chips += order.map(function (p) { return _mgcChip(R, _mgcInfo(R, p), key, filter, multi); }).join('');
  chips += '<button type="button" class="mgc-c add" onclick="mgcOpenAdd()">' + MGC_PLUS + '<span>Add game</span></button>';
  host.innerHTML = '<div class="mgc-hd"><span class="gcr-hd">' + (multi ? 'Games in this chat' : 'This chat') + '</span><span class="mgc-ct">' +
    (multi ? (filter === 'this' ? 'Only ' + _mgcEsc(_mgcInfo(R, key).label) : 'Every game · one thread') : 'Add any game, any sport') + '</span></div>' +
    '<div class="mgc-rail">' + chips + '</div>' +
    (multi ? '' : '<div class="mgc-hint">Bring in another game and everyone in this chat can react to all of them right here.</div>');
  _mgcKeepFresh();
}
// today's scores for the chips (the same lists Multi view and Home read)
function _mgcKeepFresh() {
  var M = window._mgc;
  if (typeof _mvLoad !== 'function') return;
  if (!M.tick) M.tick = setInterval(function () {
    if (!_mgcS() || document.hidden || !(typeof _gcrChatShowing === 'function' && _gcrChatShowing())) return;
    _mvLoad(false).then(function () { _mgcPaint(); if (M.open) _mgcSheetPaint(); }, function () {});
  }, 30000);
  if (Date.now() - M.loadAt < 60000) return;
  M.loadAt = Date.now();
  _mvLoad(false).then(function () { _mgcPaint(); if (M.open) _mgcSheetPaint(); }, function () {});
}
function _mgcRefresh() { var key = typeof _gcrKey === 'function' ? _gcrKey() : ''; if (key && typeof _gcrPublish === 'function') _gcrPublish(key); else _mgcPaint(); }
function mgcAll() {
  var S = _mgcS(); if (!S) return;
  window._mgc.filter[_mgcFk(S.mine)] = 'all';
  _mgcRefresh();
}
function mgcTap(pk) {
  var S = _mgcS(); if (!S) return;
  pk = String(pk);
  if (pk === S.key) {
    if (!_mgcMulti(S.mine)) return;
    window._mgc.filter[_mgcFk(S.mine)] = _mgcFilter(S.mine) === 'this' ? 'all' : 'this';
    _mgcRefresh();
    return;
  }
  mgcGo(pk);
}
// over to another game in the chat, on its Chat tab, in this same chat
function mgcGo(pk) {
  var S = _mgcS(), R = S ? S.mine : null;
  if (!R || typeof openGameScreen !== 'function') return;
  var I = _mgcInfo(R, pk);
  if (typeof _gcrS === 'function') _gcrS(String(pk)).pickRoom = R.id;
  openGameScreen(I.gamePk, I.away || null, I.home || null, I.sport, I.date || _mgcToday());
  setTimeout(function () { if (typeof gameDetailTab === 'function') gameDetailTab('chat'); }, 0);
}

// ── in the thread: ALL shows every game's messages, each tagged; "only this" filters
function _mgcTagHtml(I) {
  return '<span class="mgc-tag"><i style="background:' + _mgcEsc(I.ca.accent || '#A89FE8') + '"></i>' + _mgcEsc(I.league + ' · ' + I.label) + '</span>';
}
function _mgcAnnotate(msgs, S) {
  var box = document.getElementById('game-chat-msgs');
  if (!box || !msgs) return;
  var kids = Array.prototype.slice.call(box.children).filter(function (el) { return !el.classList.contains('gc-sep'); });
  var shown = msgs.filter(function (c) { return !(c.systemType === 'room' && !c._line); });
  if (kids.length !== shown.length) return; // someone changed the list; leave it be
  var info = {};
  shown.forEach(function (c, i) {
    if (c.systemType === 'room' || c.gamePk == null) return;
    var pk = String(c.gamePk), el = kids[i];
    var I = info[pk] || (info[pk] = _mgcInfo(S.mine, pk));
    if (el.querySelector('.mgc-tag')) return;
    if (el.classList.contains('gc-sys')) {
      var txt = el.querySelector('span:last-child');
      if (txt) txt.insertAdjacentHTML('afterbegin', _mgcTagHtml(I));
      // a reaction to a play in another game opens that game
      if (pk !== S.key) { el.removeAttribute('onclick'); el.setAttribute('data-mgc', pk); el.onclick = function () { mgcGo(this.getAttribute('data-mgc')); }; }
      return;
    }
    var col = el.lastElementChild;
    if (col) col.insertAdjacentHTML('afterbegin', _mgcTagHtml(I));
  });
}
(function () {
  if (typeof renderGameChat === 'function') {
    var prevRender = renderGameChat;
    renderGameChat = function (msgs) {
      var S = _mgcS(), args = Array.prototype.slice.call(arguments);
      var multi = !!(S && _mgcMulti(S.mine)), filter = multi ? _mgcFilter(S.mine) : 'all';
      if (multi && filter === 'this' && Array.isArray(msgs)) {
        msgs = msgs.filter(function (c) { return c.systemType === 'room' || c._ask || c.gamePk == null || String(c.gamePk) === S.key; });
        args[0] = msgs;
      }
      var r = prevRender.apply(this, args);
      if (multi && filter === 'all') { try { _mgcAnnotate(msgs, S); } catch (e) { console.error('[multi-game chat] tags', e); } }
      return r;
    };
  }
  // "Nathan added LAD @ NYM to the chat"
  if (typeof _gcrLineText === 'function') {
    var prevLine = _gcrLineText;
    _gcrLineText = function (act, byUid, byName, p, me) {
      if (act === 'addgame' || act === 'dropgame') {
        var by = byUid === me ? 'You' : _gcrFirst(byName), lbl = (p && p.label) || 'a game';
        return act === 'addgame' ? { t: by + ' added ' + lbl + ' to the chat', s: 'Reactions from it land here too.' } : { t: by + ' took ' + lbl + ' out of the chat', s: '' };
      }
      return prevLine.apply(this, arguments);
    };
  }
  if (typeof _gcrPaint === 'function') {
    var prevPaint = _gcrPaint;
    _gcrPaint = function () { var r = prevPaint.apply(this, arguments); try { _mgcPaint(); } catch (e) { console.error('[multi-game chat] paint', e); } return r; };
  }
})();

// ── + Add game: today's games, every league
function _mgcSheet() {
  var el = document.getElementById('mgc-sheet');
  if (el) return el;
  el = document.createElement('div'); el.id = 'mgc-sheet'; el.className = 'mgc-ov'; el.style.display = 'none';
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'mgc-sh-t');
  el.innerHTML = '<button type="button" class="mgc-scrim" aria-label="Close" onclick="mgcCloseAdd()"></button>' +
    '<div class="mgc-pn"><div class="mgc-grab"></div>' +
      '<div class="mgc-sh-hd"><div><div class="mgc-sh-t" id="mgc-sh-t">Add a game</div><div class="mgc-sh-s" id="mgc-sh-s"></div></div>' +
        '<button type="button" class="mgc-done" onclick="mgcCloseAdd()">Done</button></div>' +
      '<label class="mgc-q">' + MGC_SEARCH + '<span class="mgc-sr">Search games</span><input id="mgc-q" type="search" placeholder="Search teams" autocomplete="off" oninput="mgcSearch(this.value)"></label>' +
      '<div class="mgc-sp" id="mgc-sp"></div>' +
      '<div class="mgc-list" id="mgc-list"></div></div>';
  document.body.appendChild(el);
  return el;
}
function mgcOpenAdd() {
  var S = _mgcS(); if (!S) return;
  var M = window._mgc, el = _mgcSheet();
  M.open = true; M.q = ''; M.sport = 'all';
  var q = document.getElementById('mgc-q'); if (q) q.value = '';
  el.style.display = 'flex';
  _mgcSheetPaint();
  if (typeof _mvLoad === 'function') _mvLoad(true).then(function () { if (M.open) _mgcSheetPaint(); _mgcPaint(); }, function () {});
}
function mgcCloseAdd() { window._mgc.open = false; var el = document.getElementById('mgc-sheet'); if (el) el.style.display = 'none'; }
function mgcSearch(v) { window._mgc.q = String(v || ''); _mgcSheetPaint(); }
function mgcSport(k) { window._mgc.sport = k; _mgcSheetPaint(); }
function _mgcSheetPaint() {
  var M = window._mgc, S = _mgcS(), list = document.getElementById('mgc-list'), sp = document.getElementById('mgc-sp'), sub = document.getElementById('mgc-sh-s');
  if (!list) return;
  if (!S) { mgcCloseAdd(); return; }
  var R = S.mine, inChat = {}, home = String(R.pk);
  _mgcPks(R).forEach(function (p) { inChat[p] = 1; });
  if (sub) sub.textContent = 'Everyone in ' + (R.crewName || _gcrRoomTitle(R, S.me).replace(/^Your chat$/, 'your chat')) + ' can react to it here';
  var all = typeof _mvAll === 'function' ? _mvAll() : [], sports = {};
  all.forEach(function (x) { sports[x.sport] = (sports[x.sport] || 0) + 1; });
  var keys = (typeof GAMES_SPORTS !== 'undefined' ? GAMES_SPORTS : []).map(function (s) { return s.key; }).filter(function (k) { return sports[k]; });
  if (M.sport !== 'all' && !sports[M.sport]) M.sport = 'all';
  if (sp) sp.innerHTML = ['all'].concat(keys).map(function (k) {
    var nm = k === 'all' ? 'All' : (typeof _mvLeague === 'function' ? _mvLeague(k) : k.toUpperCase());
    return '<button type="button" class="mgc-pill' + (M.sport === k ? ' on' : '') + '" aria-pressed="' + (M.sport === k ? 'true' : 'false') + '" onclick="mgcSport(\'' + k + '\')">' + _mgcEsc(nm) + '</button>';
  }).join('');
  var q = M.q.trim().toLowerCase();
  var rank = { live: 0, pre: 1, post: 2 };
  var rows = all.filter(function (x) {
    if (M.sport !== 'all' && x.sport !== M.sport) return false;
    if (!q) return true;
    return [x.g.away, x.g.home, x.g.awayAbbr, x.g.homeAbbr, typeof _mvLeague === 'function' ? _mvLeague(x.sport) : x.sport].join(' ').toLowerCase().indexOf(q) >= 0;
  }).map(function (x) { var ph = typeof _mvPhase === 'function' ? _mvPhase(x.sport, x.g) : 'pre'; return { x: x, ph: ph }; })
    .sort(function (a, b) { return (rank[a.ph] - rank[b.ph]) || ((Date.parse(a.x.g.startTime || '') || 0) - (Date.parse(b.x.g.startTime || '') || 0)); });
  if (!all.length) { list.innerHTML = '<div class="mgc-empty">Loading today’s games…</div>'; return; }
  if (!rows.length) { list.innerHTML = '<div class="mgc-empty">No games match.</div>'; return; }
  list.innerHTML = rows.map(function (r) {
    var x = r.x, pk = String(x.g.gamePk), I = _mgcInfo(R, pk), is = !!inChat[pk], busy = !!M.busy[pk];
    var btn;
    if (pk === home) btn = '<span class="mgc-b fixed">Started here</span>';
    else if (pk === S.key) btn = '<span class="mgc-b fixed">This game</span>';
    else if (is) btn = '<button type="button" class="mgc-b in" onclick="mgcRemove(\'' + _mgcEsc(pk) + '\')"' + (busy ? ' disabled' : '') + ' aria-label="Take ' + _mgcEsc(I.label) + ' out of the chat">Added</button>';
    else btn = '<button type="button" class="mgc-b" onclick="mgcAdd(\'' + _mgcEsc(pk) + '\')"' + (busy ? ' disabled' : '') + ' aria-label="Add ' + _mgcEsc(I.label) + ' to the chat">' + (busy ? 'Adding…' : 'Add') + '</button>';
    return '<div class="mgc-row"><span class="mgc-bd"><span style="background:' + _mgcEsc(I.ca.bg || '#3D3580') + ';color:' + _mgcEsc(I.ca.fg || '#fff') + '">' + _mgcEsc(I.ca.abbr) + '</span><span style="background:' + _mgcEsc(I.ch.bg || '#3D3580') + ';color:' + _mgcEsc(I.ch.fg || '#fff') + '">' + _mgcEsc(I.ch.abbr) + '</span></span>' +
      '<span class="mgc-rt"><span class="mgc-rn">' + _mgcEsc((x.g.away || I.ca.abbr) + ' @ ' + (x.g.home || I.ch.abbr)) + '</span>' +
      '<span class="mgc-rs"><i class="' + (r.ph === 'live' ? 'live' : '') + '"></i>' + _mgcEsc(I.league + ' · ' + (I.status || '')) +
      (r.ph !== 'pre' && x.g.awayScore != null && x.g.homeScore != null ? ' · ' + _mgcEsc(x.g.awayScore + '–' + x.g.homeScore) : '') + '</span></span>' + btn + '</div>';
  }).join('');
}
function _mgcFail(pk, err) {
  delete window._mgc.busy[pk];
  console.error('[multi-game chat]', err);
  if (typeof _gcrSay === 'function') _gcrSay('Couldn’t change the games in this chat — ' + ((err && err.code) || err) + ' · ' + String((err && err.message) || '').slice(0, 100));
  _mgcSheetPaint();
}
function mgcAdd(pk) {
  var S = _mgcS(), FV = typeof _gcrFV === 'function' ? _gcrFV() : null, M = window._mgc;
  pk = String(pk);
  if (!S || !FV || !window.db || M.busy[pk]) return;
  var R = S.mine, x = _mgcLive(pk), home = String(R.pk);
  if (!x) return;
  M.busy[pk] = 1; _mgcSheetPaint();
  var upd = { gamePks: FV.arrayUnion(home, pk) };
  upd['games.' + _mgcGk(pk)] = _mgcStoreOf(pk, x);
  if (!(R.games || {})[_mgcGk(home)]) upd['games.' + _mgcGk(home)] = _mgcStoreOf(home, _mgcLive(home));
  var label = _mgcInfo(R, pk).label;
  _gcrRoomRef(R.id).update(upd).then(function () {
    delete M.busy[pk];
    // the chat shows ALL once there's more than one game
    M.filter[_mgcFk(R)] = 'all';
    _gcrPostLine(R.id, { act: 'addgame', pk: pk, label: label }).catch(function (err) { console.error('[multi-game chat] added line', err); });
    if (typeof ib_toast === 'function') ib_toast(label + ' is in the chat');
    _mgcSheetPaint();
  }, function (err) { _mgcFail(pk, err); });
}
function mgcRemove(pk) {
  var S = _mgcS(), FV = typeof _gcrFV === 'function' ? _gcrFV() : null, M = window._mgc;
  pk = String(pk);
  if (!S || !FV || !window.db || M.busy[pk] || pk === String(S.mine.pk) || pk === S.key) return;
  var R = S.mine, label = _mgcInfo(R, pk).label;
  M.busy[pk] = 1; _mgcSheetPaint();
  var upd = { gamePks: FV.arrayRemove(pk) };
  upd['games.' + _mgcGk(pk)] = FV.delete();
  _gcrRoomRef(R.id).update(upd).then(function () {
    delete M.busy[pk];
    _gcrPostLine(R.id, { act: 'dropgame', pk: pk, label: label }).catch(function (err) { console.error('[multi-game chat] removed line', err); });
    _mgcSheetPaint();
  }, function (err) { _mgcFail(pk, err); });
}
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && window._mgc.open) mgcCloseAdd(); });
