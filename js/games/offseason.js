// ══ BASEBALL OFFSEASON PAGE (v7.86.0) ═════════════════════════════════════
// Once MLB's season is over (mode=phase says "off"), the top of the MLB
// Games screen becomes the offseason page:
//   · how far away spring training is
//   · a search for any player, active or retired — tap one for his card,
//     or "Compare" two of them; quick compares (the best free agents still
//     out there, the biggest signing against the player he's taking over
//     from, your recent pairs)
//   · the Hot Stove: All / My teams / Signings / Trades / Free agents.
//     The biggest move up top in its team's colors with his season line;
//     every other move is a row with Compare
//   · "Where does he sign?": the best free agents still unsigned, one at a
//     time. Pick a team; your friends' picks show as team tiles, and once he
//     signs his card says which of them called it. Picks live on your own
//     user doc (users/{uid}.hotStovePicks), read back for friends.
// It only shows on today's schedule; browsing to another date shows that
// day's games as before, and the schedule stays below it.
// Data: /api/mlb?mode=hotstove, mode=replaces, mode=search&all=1,
// mode=phase. Depends on: cmpOpen (compare.js), openPlayerLinkSheet
// (games-list.js), _loadFavTeams, _teamLook (team-colors.js), _gsPhaseState
// (breaks-weeks-and-flourishes.js), _escapeHtml, _todayLocal, _ghLastName.
// v7.102.0: games-deck.js calls hsDeck() to put this page on the MLB Games
// page whenever baseball is off and the day has no games.

window._hs = window._hs || { view: 'board', pos: 'all', team: null, boardMore: false, data: null, at: 0, loading: false, filter: 'all', more: false, pick: 0, base: null, rep: {}, picks: null, picksAt: 0, fav: null, q: '' };
var HS_TTL = 5 * 60e3, HS_RECENT = 'innings_hs_recent';
var HS_KIND = { sign: 'SIGNED', trade: 'TRADE', fa: 'FREE AGENT', claim: 'CLAIMED', release: 'RELEASED', retire: 'RETIRED', dfa: 'DFA' };

function _hsE(s) { return typeof _escapeHtml === 'function' ? _escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
function _hsA(s) { return _hsE(JSON.stringify(String(s == null ? '' : s))); } // a quoted JS string, safe inside an attribute
function _hsLast(n) { return typeof _ghLastName === 'function' ? _ghLastName(n || '') : String(n || '').split(' ').slice(-1)[0]; }
function _hsToday() { return typeof _todayLocal === 'function' ? _todayLocal() : new Date().toISOString().slice(0, 10); }
function _hsLook(t) {
  var L = null;
  try { if (t && typeof _teamLook === 'function') L = _teamLook('mlb', t.name || '', (typeof CMP_TEAM !== 'undefined' && CMP_TEAM[t.id]) || null); } catch (e) {}
  return L || { abbr: t && t.name ? String(t.name).slice(0, 3).toUpperCase() : '', bg: '#3D3580', fg: '#FFFFFF' };
}
function _hsP(id) { var D = window._hs.data; return (D && D.people && D.people[id]) || null; }
function _hsKindOf(p) { return p && (p.pos === 'P' || (p.pos === 'TWP' && p.pit && !p.bat)) ? 'pit' : 'bat'; }
function _hsWhen(d) {
  if (!d) return '';
  var t = Date.parse(d + 'T12:00:00'), n = Math.round((Date.parse(_hsToday() + 'T12:00:00') - t) / 864e5);
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 7) return n + ' days ago';
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function _hsLsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function _hsLsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function _hsMe() { return window.currentUser || (window.auth && window.auth.currentUser) || null; }

// ── When it shows ─────────────────────────────────────────────────────────
function _hsHost() {
  var el = document.getElementById('games-offseason');
  if (el) return el;
  var lbl = document.getElementById('games-date-label'), nav = lbl && lbl.parentNode && lbl.parentNode.parentNode;
  if (!nav || !nav.parentNode) return null;
  el = document.createElement('div');
  el.id = 'games-offseason';
  el.style.display = 'none';
  nav.parentNode.insertBefore(el, nav);
  return el;
}
function _hsPhase() {
  var P = typeof _gsPhaseState === 'function' ? _gsPhaseState() : null;
  return (P && P.by && P.by.mlb && P.by.mlb.phase) || null;
}
// v7.86.1: while the offseason page is up there's nothing on the schedule
// until spring, so the date bar and the day's (empty) list are hidden
function _hsSchedule(show) {
  var el = document.getElementById('games-offseason'), nav = el && el.nextElementSibling, list = document.getElementById('games-list');
  if (nav && nav !== list && nav.querySelector('#games-date-label')) nav.style.display = show ? 'flex' : 'none';
  if (list) list.style.display = show ? 'flex' : 'none';
}
function hsSync() {
  var el = _hsHost();
  if (!el) return;
  var shown = _hsSyncInner(el);
  _hsSchedule(!shown);
}
function _hsSyncInner(el) {
  var onToday = !window._gamesDate || window._gamesDate === _hsToday();
  var ph = _hsPhase();
  if (window._gamesSport !== 'mlb' || !onToday) { el.style.display = 'none'; return false; }
  if (!ph) {
    // the Games page normally has the season line already; if not, ask once
    if (!window._hsPhaseAsk) {
      window._hsPhaseAsk = true;
      fetch('/api/mlb?mode=phase&v=2&date=' + encodeURIComponent(_hsToday())).then(function (r) { return r.ok ? r.json() : null; }).then(function (x) {
        if (x && x.phase && typeof _gsPhaseState === 'function') { var P = _gsPhaseState(); P.by.mlb = { phase: x.phase, label: String(x.label || '') }; }
        hsSync();
      }).catch(function () {}).then(function () { window._hsPhaseAsk = false; });
    }
    el.style.display = 'none';
    return false;
  }
  if (ph !== 'off') { el.style.display = 'none'; return false; }
  el.style.display = '';
  if (!el.firstChild) _hsRender();
  _hsLoad();
  _hsPicksLoad();
  // your teams can change in the gear sheet, so they're read again each time (cached by _loadFavTeams)
  if (typeof _loadFavTeams === 'function') {
    _loadFavTeams('mlb').then(function (f) {
      var was = JSON.stringify(window._hs.fav || null);
      window._hs.fav = f || { favorite: null, following: [] };
      if (window._hs.filter === 'mine' && was !== JSON.stringify(window._hs.fav)) _hsRender();
    });
  }
  return true;
}
function _hsLoad(force) {
  var H = window._hs;
  if (H.loading || (!force && H.data && Date.now() - H.at < HS_TTL)) return;
  H.loading = true;
  fetch('/api/mlb?mode=hotstove&date=' + encodeURIComponent(_hsToday())).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    H.loading = false;
    if (d && !d.error && Array.isArray(d.moves)) { H.data = d; H.at = Date.now(); H.failed = false; }
    else if (!H.data) H.failed = true;
    _hsRender();
  }).catch(function (err) {
    console.error('[hot stove] load:', err);
    H.loading = false;
    if (!H.data) H.failed = true;
    _hsRender();
  });
}

// ── Picks: yours and your friends' ────────────────────────────────────────
function _hsPicksLoad(force) {
  var H = window._hs, me = _hsMe();
  if (!me || !window.db || (!force && H.picks && Date.now() - H.picksAt < HS_TTL)) return;
  H.picksAt = Date.now();
  var uids = [me.uid].concat((window._myFriendUids || []).filter(function (u) { return u && u !== me.uid; }).slice(0, 60));
  Promise.all(uids.map(function (u) { return window.db.collection('users').doc(u).get().catch(function () { return null; }); })).then(function (docs) {
    var out = {};
    docs.forEach(function (doc) {
      if (!doc || !doc.exists) return;
      var d = doc.data() || {}, pk = d.hotStovePicks;
      if (!pk || typeof pk !== 'object') return;
      Object.keys(pk).forEach(function (pid) {
        var ab = String(pk[pid] || '').toUpperCase();
        if (!ab) return;
        (out[pid] = out[pid] || []).push({ uid: doc.id, name: doc.id === me.uid ? 'You' : (d.displayName || d.name || 'A friend'), abbr: ab });
      });
    });
    H.picks = out;
    _hsRender();
  }).catch(function (err) { console.error('[hot stove] picks:', err); });
}
function _hsPicksFor(pid) { return ((window._hs.picks || {})[String(pid)] || []); }
function _hsMyPick(pid) { var me = _hsMe(); if (!me) return null; var x = _hsPicksFor(pid).filter(function (p) { return p.uid === me.uid; })[0]; return x ? x.abbr : null; }
function hsPickSave(pid, abbr) {
  var me = _hsMe(), H = window._hs;
  hsTeamsClose();
  if (!me || !window.db) return;
  var upd = {}; upd[String(pid)] = abbr || null;
  // shown right away; the save follows
  H.picks = H.picks || {};
  var list = (H.picks[pid] || []).filter(function (p) { return p.uid !== me.uid; });
  if (abbr) list.push({ uid: me.uid, name: 'You', abbr: abbr });
  H.picks[pid] = list;
  _hsRender();
  var doc = window.db.collection('users').doc(me.uid);
  if (!abbr) upd[String(pid)] = firebase.firestore.FieldValue.delete();
  var p = doc.set({ hotStovePicks: upd }, { merge: true });
  p.catch(function (err) { console.error('[hot stove] save pick:', err); });
}
function hsTeams(pid) {
  var el = document.getElementById('hs-teams');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hs-teams';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'hs-teams-t');
    el.addEventListener('click', function (e) { if (e.target === el) hsTeamsClose(); });
    document.body.appendChild(el);
  }
  var p = _hsP(pid), mine = _hsMyPick(pid);
  var ids = Object.keys(typeof CMP_TEAM !== 'undefined' ? CMP_TEAM : {}).map(Number).sort(function (a, b) { return CMP_TEAM[a] < CMP_TEAM[b] ? -1 : 1; });
  el.innerHTML = '<div class="sh"><div class="sh-hd"><h2 id="hs-teams-t">Where does ' + _hsE(_hsLast(p ? p.name : '')) + ' sign?</h2>' +
    '<button type="button" class="x" aria-label="Close" onclick="hsTeamsClose()">✕</button></div><div class="gr">' +
    ids.map(function (id) {
      var ab = CMP_TEAM[id], L = _hsLook({ id: id, name: '' });
      return '<button type="button" class="hs-tm' + (mine === ab ? ' mine' : '') + '" style="background:' + L.bg + ';color:' + L.fg + '" onclick="hsPickSave(' + pid + ',' + _hsA(ab) + ')">' + _hsE(ab) + '</button>';
    }).join('') + '</div>' +
    (mine ? '<button type="button" class="hs-btn clr" onclick="hsPickSave(' + pid + ',null)">Clear my pick</button>' : '') + '</div>';
  el.style.display = 'flex';
}
function hsTeamsClose() { var el = document.getElementById('hs-teams'); if (el) { el.style.display = 'none'; el.innerHTML = ''; } }

// ── Compare ───────────────────────────────────────────────────────────────
function _hsRecentAdd(a, b, kind) {
  var r = (_hsLsGet(HS_RECENT) || []).filter(function (x) { return x && !((String(x.a.id) === String(a.id) && String(x.b.id) === String(b.id)) || (String(x.a.id) === String(b.id) && String(x.b.id) === String(a.id))); });
  r.unshift({ a: { id: String(a.id), name: a.name }, b: { id: String(b.id), name: b.name }, kind: kind });
  _hsLsSet(HS_RECENT, r.slice(0, 4));
}
function hsCmpPair(aId, aName, bId, bName, kind) {
  if (typeof cmpOpen !== 'function') return;
  var a = { id: String(aId), name: aName }, b = { id: String(bId), name: bName };
  _hsRecentAdd(a, b, kind);
  window._hs.base = null;
  cmpOpen(a, b, kind);
  setTimeout(_hsRender, 300);
}
// Compare on a row: the first tap holds that player, the second opens the two
function hsCmp(id, name, kind) {
  var H = window._hs;
  kind = kind === 'pit' ? 'pit' : 'bat';
  if (H.base && String(H.base.id) !== String(id)) {
    if (H.base.kind !== kind) { H.base = { id: String(id), name: name, kind: kind }; _hsRender(); return; }
    hsCmpPair(H.base.id, H.base.name, id, name, kind);
    return;
  }
  H.base = { id: String(id), name: name, kind: kind };
  _hsRender();
  if (H.q.trim().length >= 2) hsSearch(H.q); // the results' buttons now say "vs …"
  var q = document.getElementById('hs-q');
  if (q && !H.q) q.focus();
}
function hsCmpCancel() { var H = window._hs; H.base = null; _hsRender(); if (H.q.trim().length >= 2) hsSearch(H.q); }
function hsCard(id, name) { if (typeof openPlayerLinkSheet === 'function') openPlayerLinkSheet(name, id, 'mlb'); }
// Who a signing takes over from (asked once per player)
function _hsRepKey(m) { return m.player + ':' + (m.team && m.team.id); }
function _hsRepLoad(m) {
  var H = window._hs, k = _hsRepKey(m), p = _hsP(m.player);
  if (!p || !m.team || H.rep[k]) return;
  H.rep[k] = { loading: true };
  var pit = _hsKindOf(p) === 'pit', role = pit ? (p.pit && p.pit.g && p.pit.gs >= p.pit.g / 2 ? 'sp' : 'rp') : '';
  var url = '/api/mlb?mode=replaces&teamId=' + m.team.id + '&pos=' + encodeURIComponent(pit ? 'P' : (p.pos || '')) + '&role=' + role + '&exclude=' + p.id + '&season=' + ((window._hs.data && window._hs.data.season) || '');
  fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    H.rep[k] = { player: (d && d.player) || null, how: d && d.how };
    _hsRender();
  }).catch(function () { H.rep[k] = { player: null }; _hsRender(); });
}

// ── Pieces ────────────────────────────────────────────────────────────────
function _hsStatCells(p) {
  var c = [];
  if (!p) return c;
  if (_hsKindOf(p) === 'pit' && p.pit) c = [[p.pit.era || '—', 'ERA'], [p.pit.so, 'K'], [p.pit.ip, 'IP']];
  else if (p.bat) c = [[p.bat.ops || '—', 'OPS'], [p.bat.hr, 'HR'], [p.bat.avg || '—', 'AVG']];
  c.push([p.age || '—', 'Age']);
  return c;
}
function _hsLine(p) {
  if (!p) return '';
  var k = _hsKindOf(p);
  if (k === 'pit' && p.pit) return (p.pit.era ? p.pit.era + ' ERA · ' : '') + p.pit.ip + ' IP';
  if (p.bat) return (p.bat.ops ? p.bat.ops + ' OPS · ' : '') + p.bat.hr + ' HR';
  return '';
}
function _hsMoveText(m) {
  var p = _hsP(m.player) || { name: '' }, nm = p.name, t = m.team ? m.team.name : '';
  if (m.kind === 'trade') {
    var sides = m.teams || [];
    var gets = function (s) { return s.gets.map(function (id) { var x = _hsP(id); return x ? x.name : ''; }).filter(Boolean).join(', ') || 'Player to be named later'; };
    var a = sides[0], b = sides[1];
    return { t: (a ? a.team.name : '') + ' get ' + (a ? gets(a) : ''), s: b ? b.team.name + ' get ' + gets(b) : 'Trade' };
  }
  var pos = p.pos ? p.pos + ' · ' : '', line = _hsLine(p);
  if (m.kind === 'sign') return { t: nm + ' signs with ' + t, s: pos + (line || 'Signed') };
  if (m.kind === 'fa') return { t: nm + ' is a free agent', s: 'Leaves ' + t + (line ? ' · ' + line : '') };
  if (m.kind === 'claim') return { t: t + ' claim ' + nm, s: m.from ? 'Off waivers from ' + m.from.name : 'Off waivers' };
  if (m.kind === 'release') return { t: t + ' release ' + nm, s: pos + (line || 'Released') };
  if (m.kind === 'retire') return { t: nm + ' retires', s: pos + (line || 'Retired') };
  if (m.kind === 'dfa') return { t: t + ' designate ' + nm + ' for assignment', s: pos + (line || 'DFA') };
  return { t: nm, s: '' };
}
// the two players a trade is really about: the most-used one on each side
function _hsTradeHeads(m) {
  return (m.teams || []).map(function (s) {
    return s.gets.map(_hsP).filter(Boolean).sort(function (a, b) { return b.score - a.score; })[0] || null;
  }).filter(Boolean);
}
function _hsMoveScore(m) {
  if (m.kind === 'trade') return _hsTradeHeads(m).reduce(function (a, p) { return Math.max(a, p.score); }, 0);
  var p = _hsP(m.player);
  return p ? p.score : 0;
}
function _hsFiltered() {
  var H = window._hs, D = H.data;
  if (!D) return [];
  var fav = H.fav || {}, mine = [fav.favorite].concat(fav.following || []).filter(Boolean);
  return D.moves.filter(function (m) {
    if (H.filter === 'sign') return m.kind === 'sign';
    if (H.filter === 'trade') return m.kind === 'trade';
    if (H.filter === 'fa') return m.kind === 'fa';
    if (H.filter === 'mine') {
      var names = m.kind === 'trade' ? (m.teams || []).map(function (s) { return s.team.name; }) : [m.team && m.team.name, m.from && m.from.name];
      return names.some(function (n) { return n && mine.indexOf(n) >= 0; });
    }
    return true;
  });
}
// The move at the top: the biggest signing or trade of the last week, else the latest one that mattered
function _hsHero(list) {
  var big = list.filter(function (m) { return (m.kind === 'sign' || m.kind === 'trade') && _hsMoveScore(m) >= 150; });
  if (!big.length) return null;
  var wk = big.filter(function (m) { return Date.parse(_hsToday()) - Date.parse(m.date) <= 7 * 864e5; });
  var pool = wk.length ? wk : big.slice(0, 1);
  return pool.slice().sort(function (a, b) { return _hsMoveScore(b) - _hsMoveScore(a); })[0];
}
function _hsHeroHtml(m) {
  var H = window._hs;
  if (m.kind === 'trade') {
    var heads = _hsTradeHeads(m), sides = m.teams || [], tx = _hsMoveText(m);
    var L = _hsLook(sides[0] && sides[0].team);
    var top = heads[0];
    var pair = heads.length === 2 && _hsKindOf(heads[0]) === _hsKindOf(heads[1]);
    return '<div class="hs-card"><div class="hs-band" style="background:' + L.bg + ';color:' + L.fg + '" role="button" tabindex="0" onclick="' + (top ? 'hsCard(' + top.id + ',' + _hsA(top.name) + ')' : '') + '">' +
      '<div><div class="hs-kd">TRADE · ' + _hsE(_hsWhen(m.date).toUpperCase()) + '</div><div class="hs-nm">' + _hsE(tx.t) + '</div><div class="hs-tl">' + _hsE(tx.s) + '</div></div>' +
      '<span class="hs-ab">' + _hsE(L.abbr) + '</span></div>' +
      (top ? '<div class="hs-st">' + _hsStatCells(top).map(function (c) { return '<div><b>' + _hsE(c[0]) + '</b><span>' + _hsE(c[1]) + '</span></div>'; }).join('') + '</div>' : '') +
      '<div class="hs-acts">' + (pair ? '<button type="button" class="hs-btn pri" onclick="hsCmpPair(' + heads[0].id + ',' + _hsA(heads[0].name) + ',' + heads[1].id + ',' + _hsA(heads[1].name) + ',' + _hsA(_hsKindOf(heads[0])) + ')">' + _hsE(_hsLast(heads[0].name)) + ' vs ' + _hsE(_hsLast(heads[1].name)) + '</button>' :
        (top ? '<button type="button" class="hs-btn pri" onclick="hsCmp(' + top.id + ',' + _hsA(top.name) + ',' + _hsA(_hsKindOf(top)) + ')">Compare ' + _hsE(_hsLast(top.name)) + '</button>' : '<span></span>')) +
      (top ? '<button type="button" class="hs-btn" onclick="hsCard(' + top.id + ',' + _hsA(top.name) + ')">Player card</button>' : '') + '</div></div>';
  }
  var p = _hsP(m.player), Lk = _hsLook(m.team), k = _hsKindOf(p);
  // re-signing with his own team: nobody to take over from
  var stays = p && m.team && p.lastTeam === m.team.id;
  var rk = _hsRepKey(m), rep = H.rep[rk];
  if (!stays && !rep) _hsRepLoad(m);
  var repBtn;
  if (stays) repBtn = '<button type="button" class="hs-btn pri" onclick="hsCmp(' + p.id + ',' + _hsA(p.name) + ',' + _hsA(k) + ')">Compare ' + _hsE(_hsLast(p.name)) + '</button>';
  else if (!rep || rep.loading) repBtn = '<button type="button" class="hs-btn pri" disabled>vs who he replaces…</button>';
  else if (rep.player) repBtn = '<button type="button" class="hs-btn pri" onclick="hsCmpPair(' + p.id + ',' + _hsA(p.name) + ',' + rep.player.id + ',' + _hsA(rep.player.name) + ',' + _hsA(k) + ')">vs ' + _hsE(_hsLast(rep.player.name)) + '</button>';
  else repBtn = '<button type="button" class="hs-btn pri" onclick="hsCmp(' + p.id + ',' + _hsA(p.name) + ',' + _hsA(k) + ')">Compare ' + _hsE(_hsLast(p.name)) + '</button>';
  var role = !stays && rep && rep.player ? (rep.how === 'starter' ? 'top starter' : rep.how === 'reliever' ? 'busiest reliever' : 'everyday ' + rep.how) : '';
  var repLine = !stays && rep && rep.player ? '<div class="hs-rep">Takes over from ' + _hsE(rep.player.name) + ', their ' + _hsE(role) + ' in ' + _hsE((window._hs.data && window._hs.data.season) || '') + '</div>' : '';
  // friends who called it
  var called = _hsPicksFor(m.player).filter(function (x) { return x.abbr === Lk.abbr; }).map(function (x) { return x.name; });
  return '<div class="hs-card"><div class="hs-band" style="background:' + Lk.bg + ';color:' + Lk.fg + '" role="button" tabindex="0" onclick="hsCard(' + p.id + ',' + _hsA(p.name) + ')">' +
    '<div><div class="hs-kd">SIGNED · ' + _hsE(_hsWhen(m.date).toUpperCase()) + '</div><div class="hs-nm">' + _hsE(p.name) + '</div><div class="hs-tl">to ' + _hsE(m.team.name) + (p.pos ? ' · ' + _hsE(p.pos) : '') + '</div></div>' +
    '<span class="hs-ab">' + _hsE(Lk.abbr) + '</span></div>' +
    '<div class="hs-st">' + _hsStatCells(p).map(function (c) { return '<div><b>' + _hsE(c[0]) + '</b><span>' + _hsE(c[1]) + '</span></div>'; }).join('') + '</div>' +
    (called.length ? '<div class="hs-called">Called it: ' + _hsE(called.join(', ')) + '</div>' : '') + repLine +
    '<div class="hs-acts">' + repBtn + '<button type="button" class="hs-btn" onclick="hsCard(' + p.id + ',' + _hsA(p.name) + ')">Player card</button></div></div>';
}
function _hsPickHtml() {
  var H = window._hs, D = H.data, fas = (D && D.fas) || [];
  if (!fas.length) return '';
  var i = Math.max(0, Math.min(H.pick || 0, Math.min(fas.length, 10) - 1)), pid = fas[i], p = _hsP(pid);
  if (!p) return '';
  var all = _hsPicksFor(pid), mine = _hsMyPick(pid), tally = {};
  all.forEach(function (x) { tally[x.abbr] = (tally[x.abbr] || 0) + 1; });
  var tops = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a] || (a === mine ? -1 : b === mine ? 1 : 0); }).slice(0, 3);
  var abbrId = {};
  Object.keys(typeof CMP_TEAM !== 'undefined' ? CMP_TEAM : {}).forEach(function (id) { abbrId[CMP_TEAM[id]] = +id; });
  var tiles = tops.map(function (ab) {
    var L = _hsLook({ id: abbrId[ab], name: '' });
    return '<button type="button" class="hs-tm' + (ab === mine ? ' mine' : '') + '" style="background:' + L.bg + ';color:' + L.fg + '" aria-label="' + _hsE(ab + ', ' + tally[ab] + (tally[ab] === 1 ? ' pick' : ' picks') + (ab === mine ? ', your pick' : '')) + '" onclick="hsPickSave(' + pid + ',' + _hsA(ab) + ')">' + _hsE(ab) + ' · ' + tally[ab] + '</button>';
  });
  // nobody's picked yet: one wide button instead of empty tiles
  if (!tiles.length) tiles = ['<button type="button" class="hs-tm add wide" onclick="hsTeams(' + pid + ')">Pick a team</button>'];
  else {
    while (tiles.length < 3) tiles.push('<span></span>');
    tiles.push('<button type="button" class="hs-tm add" onclick="hsTeams(' + pid + ')">' + (mine ? 'Change' : 'Pick') + '</button>');
  }
  var friends = all.filter(function (x) { return x.name !== 'You'; }).length;
  var n = Math.min(fas.length, 10);
  return '<div class="hs-pick"><div class="hs-pk-hd"><span class="hs-pk-eb">WHERE DOES HE SIGN? · #' + (i + 1) + ' FA</span>' +
    '<span class="hs-pk-nv"><button type="button" aria-label="Previous free agent" onclick="hsPickNav(-1)"' + (i ? '' : ' disabled') + '>‹</button><button type="button" aria-label="Next free agent" onclick="hsPickNav(1)"' + (i < n - 1 ? '' : ' disabled') + '>›</button></span></div>' +
    '<div class="hs-pk-who" role="button" tabindex="0" onclick="hsCard(' + p.id + ',' + _hsA(p.name) + ')"><b>' + _hsE(p.name) + '</b><span>' + _hsE([p.pos, p.age ? 'age ' + p.age : '', _hsLine(p)].filter(Boolean).join(' · ')) + '</span></div>' +
    '<div class="hs-pk-tms">' + tiles.join('') + '</div>' +
    '<div class="hs-pk-ft">' + (mine ? 'Your pick is outlined. ' : '') + (friends ? friends + (friends === 1 ? ' friend has' : ' friends have') + ' picked' : 'None of your friends has picked yet') + ' · his card says who called it when he signs</div></div>';
}
function hsPickNav(d) { var H = window._hs; H.pick = Math.max(0, (H.pick || 0) + d); _hsRender(); }
function _hsRowHtml(m) {
  var tx = _hsMoveText(m), team = m.kind === 'trade' ? (m.teams && m.teams[0] && m.teams[0].team) : m.team, L = _hsLook(team);
  var who = m.kind === 'trade' ? _hsTradeHeads(m)[0] : _hsP(m.player);
  var open = who ? 'hsCard(' + who.id + ',' + _hsA(who.name) + ')' : '';
  var btn = '';
  if (m.kind === 'trade') {
    var hd = _hsTradeHeads(m);
    if (hd.length === 2 && _hsKindOf(hd[0]) === _hsKindOf(hd[1])) btn = '<button type="button" class="hs-cmp" onclick="event.stopPropagation();hsCmpPair(' + hd[0].id + ',' + _hsA(hd[0].name) + ',' + hd[1].id + ',' + _hsA(hd[1].name) + ',' + _hsA(_hsKindOf(hd[0])) + ')">Compare</button>';
    else if (who) btn = '<button type="button" class="hs-cmp" onclick="event.stopPropagation();hsCmp(' + who.id + ',' + _hsA(who.name) + ',' + _hsA(_hsKindOf(who)) + ')">Compare</button>';
  } else if (who) {
    var held = window._hs.base && String(window._hs.base.id) === String(who.id);
    btn = '<button type="button" class="hs-cmp"' + (held ? ' aria-pressed="true" style="background:#A89FE8;color:#1A1640;border-color:#A89FE8"' : '') + ' onclick="event.stopPropagation();hsCmp(' + who.id + ',' + _hsA(who.name) + ',' + _hsA(_hsKindOf(who)) + ')">' + (held ? 'Picked' : 'Compare') + '</button>';
  }
  return '<div class="hs-row" role="button" tabindex="0" onclick="' + open + '"><div class="bar" style="background:' + L.bg + '"></div>' +
    '<div class="tx"><b>' + _hsE(tx.t) + '</b><span>' + _hsE((HS_KIND[m.kind] || '') + ' · ' + _hsWhen(m.date) + (tx.s ? ' · ' + tx.s : '')) + '</span></div>' + (btn || '<span></span>') + '</div>';
}
function _hsQuickHtml() {
  var chips = [];
  // v7.104.4: the "Top 2 free agent bats / arms" chips are gone — they were guesses at who's best, and wrong ones
  (_hsLsGet(HS_RECENT) || []).slice(0, 3).forEach(function (r) {
    if (!r || !r.a || !r.b) return;
    chips.push('<button type="button" class="hs-chip" onclick="hsCmpPair(' + _hsA(r.a.id) + ',' + _hsA(r.a.name) + ',' + _hsA(r.b.id) + ',' + _hsA(r.b.name) + ',' + _hsA(r.kind) + ')">' + _hsE(_hsLast(r.a.name) + ' vs ' + _hsLast(r.b.name)) + '</button>');
  });
  return chips.length ? '<div class="hs-chips" aria-label="Quick compares">' + chips.join('') + '</div>' : '';
}

// ── Search ────────────────────────────────────────────────────────────────
function hsSearch(q) {
  var H = window._hs;
  H.q = String(q || '');
  clearTimeout(window._hsQT);
  var box = document.getElementById('hs-res');
  if (!box) return;
  q = H.q.trim();
  if (q.length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
  window._hsQT = setTimeout(function () {
    var want = q;
    box.style.display = '';
    box.innerHTML = '<div class="hs-empty">Searching…</div>';
    fetch('/api/mlb?mode=search&all=1&q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (d) {
      var inp = document.getElementById('hs-q');
      if (!inp || inp.value.trim() !== want) return;
      var ps = ((d && d.players) || []).slice(0, 8);
      box.innerHTML = ps.length ? ps.map(function (p) {
        var kind = p.pos === 'P' ? 'pit' : 'bat', team = p.active !== false ? (p.fa ? 'Free agent' : (p.team || '')) : (p.first ? p.first + '–' + (p.last || '') : 'Retired');
        var held = H.base && String(H.base.id) === String(p.id);
        return '<div class="hs-row" role="button" tabindex="0" onclick="hsCard(' + p.id + ',' + _hsA(p.name) + ')"><div class="bar" style="background:rgba(168,159,232,.35)"></div>' +
          '<div class="tx"><b>' + _hsE(p.name) + '</b><span>' + _hsE([p.pos, team, p.hof ? 'Hall of Fame' : ''].filter(Boolean).join(' · ')) + '</span></div>' +
          '<button type="button" class="hs-cmp"' + (held ? ' style="background:#A89FE8;color:#1A1640;border-color:#A89FE8"' : '') + ' onclick="event.stopPropagation();hsCmp(' + p.id + ',' + _hsA(p.name) + ',' + _hsA(kind) + ')">' + (held ? 'Picked' : (H.base ? 'vs ' + _hsE(_hsLast(H.base.name)) : 'Compare')) + '</button></div>';
      }).join('') : '<div class="hs-empty">No MLB player by that name.</div>';
    }).catch(function () { box.innerHTML = '<div class="hs-empty">Couldn’t search right now. Try again in a moment.</div>'; });
  }, 250);
}

// ── The page ──────────────────────────────────────────────────────────────
function hsFilter(f) { var H = window._hs; H.filter = f; H.more = false; _hsRender(); }
function hsMore() { window._hs.more = true; _hsRender(); }
// v7.102.0: the Games page shows this page itself while baseball is off —
// it hands over a #gdk-hs box and everything here draws into that one
function _hsEl() {
  var d = document.getElementById('gdk-hs');
  return d && d.isConnected ? d : _hsHost();
}
function hsDeck() {
  var el = document.getElementById('gdk-hs');
  if (!el) return;
  var old = document.getElementById('games-offseason');
  if (old && old !== el && old.firstChild) old.innerHTML = '';   // one search box on the page, not two
  if (!el.firstChild) _hsRender();
  _hsLoad();
  _hsPicksLoad();
  if (typeof _loadFavTeams === 'function') {
    _loadFavTeams('mlb').then(function (f) {
      var was = JSON.stringify(window._hs.fav || null);
      window._hs.fav = f || { favorite: null, following: [] };
      if (window._hs.filter === 'mine' && was !== JSON.stringify(window._hs.fav)) _hsRender();
    }).catch(function () {});
  }
}
function _hsRender() {
  var el = _hsEl(), H = window._hs, D = H.data;
  if (!el || el.style.display === 'none') return;
  // the search box keeps its text and focus across redraws
  var keepFocus = document.activeElement && document.activeElement.id === 'hs-q';
  var res = document.getElementById('hs-res'), resHtml = res ? res.innerHTML : '', resShow = res ? res.style.display : 'none';
  // v7.104.4: so do the chip rows — a redraw (picks, a late stat line) used to snap them back to the start
  var chipAt = [].map.call(el.querySelectorAll('.hs-chips'), function (c) { return [c.getAttribute('aria-label'), c.scrollLeft]; });
  var today = _hsToday();
  var cd = '';
  if (D && D.spring) {
    var n = Math.ceil((Date.parse(D.spring + 'T12:00:00') - Date.parse(today + 'T12:00:00')) / 864e5);
    if (n > 0) cd = '<div class="hs-cd"><b>' + n + '<small>' + (n === 1 ? 'day' : 'days') + '</small></b><span>to spring training</span></div>';
  }
  var faDay = '';
  if (D) {
    var first = D.moves.filter(function (m) { return m.kind === 'fa'; }).map(function (m) { return m.date; }).sort()[0];
    if (first) { var dn = Math.round((Date.parse(today + 'T12:00:00') - Date.parse(first + 'T12:00:00')) / 864e5) + 1; if (dn >= 1 && dn <= 120) faDay = 'FREE AGENCY · DAY ' + dn; }
  }
  var out = '<div class="hs"><div class="hs-top"><div><div class="hs-eb">' + _hsE(faDay || 'MLB · OFFSEASON') + '</div><h2 class="hs-h1">Offseason</h2></div>' + cd + '</div>';
  // v7.105.0: one job per view — the Board (unsigned free agents), Players (search), Compare, and the Hot Stove.
  // The rail's options (hsView) switch between them; Teams opens the team sheet over the Board.
  var view = H.view || 'board';
  var baseHtml = H.base ? '<div class="hs-base" role="status"><span>Comparing ' + _hsE(_hsLast(H.base.name)) + ' with… tap vs or Compare on another ' + (H.base.kind === 'pit' ? 'pitcher' : 'hitter') + '</span><button type="button" onclick="hsCmpCancel()">Cancel</button></div>' : '';
  if (view === 'board') {
    out += _hsBoardHtml(baseHtml);
  } else if (view === 'players' || view === 'compare') {
    if (view === 'compare') {
      out += '<div class="hb-slots"><div class="hb-slot' + (H.base ? ' on' : '') + '"><div><small>' + (H.base ? (H.base.kind === 'pit' ? 'PITCHER' : 'HITTER') : 'FIRST') + '</small><b>' + _hsE(H.base ? H.base.name : 'Pick a player') + '</b></div>' + (H.base ? '<button type="button" class="hb-x" aria-label="Clear ' + _hsE(H.base.name) + '" onclick="hsCmpCancel()">✕</button>' : '') + '</div>' +
        '<div class="hb-slot"><div><small>SECOND</small><b>' + (H.base ? 'Pick another' : 'Then one more') + '</b></div></div></div>';
    }
    out += '<label class="hs-q"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span class="hs-sr">Search MLB players</span>' +
      '<input id="hs-q" type="search" autocomplete="off" placeholder="Any player, active or retired" value="' + _hsE(H.q) + '" oninput="hsSearch(this.value)"></label>';
    if (view !== 'compare') out += baseHtml;
    out += '<div id="hs-res" class="hs-res" style="display:' + resShow + '">' + resHtml + '</div>';
    out += _hsQuickHtml();
    if (H.q.trim().length < 2) out += '<div class="hs-hint">' + (view === 'compare' ? 'Search two players and tap Compare on each. Hitters go with hitters, pitchers with pitchers — retired players too.' : 'Search any MLB player, past or present. Tap one for his card, or Compare to line two up.') + '</div>';
  } else {
    out += '<div class="hs-hd"><h3 class="hs-h2">Hot Stove</h3><span class="hs-mut">' + (D ? (function () { var c = D.moves.filter(function (m) { return m.date === today; }).length; return c ? c + (c === 1 ? ' move today' : ' moves today') : ''; })() : '') + '</span></div>';
    var F = [['all', 'All'], ['mine', 'My teams'], ['sign', 'Signings'], ['trade', 'Trades'], ['fa', 'Free agents']];
    out += '<div class="hs-chips" role="group" aria-label="Show">' + F.map(function (f) { return '<button type="button" class="hs-chip' + (H.filter === f[0] ? ' on' : '') + '" aria-pressed="' + (H.filter === f[0]) + '" onclick="hsFilter(' + _hsA(f[0]) + ')">' + f[1] + '</button>'; }).join('') + '</div>';
    out += baseHtml;
    if (!D) {
      out += _hsWaitHtml();
    } else {
      var list = _hsFiltered(), hero = H.filter === 'fa' ? null : _hsHero(list);
      if (hero) out += _hsHeroHtml(hero);
      if (H.filter === 'all' || H.filter === 'fa') out += _hsPickHtml();
      var rows = list.filter(function (m) { return m !== hero; });
      var show = H.more ? rows.slice(0, 120) : rows.slice(0, 12);
      if (H.filter === 'mine' && !((H.fav || {}).favorite || ((H.fav || {}).following || []).length)) out += '<div class="hs-list"><div class="hs-empty">Pick your teams with the gear up top and their moves show here.</div></div>';
      else out += '<div class="hs-list">' + (show.length ? show.map(_hsRowHtml).join('') : '<div class="hs-empty">Nothing here yet.</div>') +
        (rows.length > show.length ? '<button type="button" class="hs-more" onclick="hsMore()">Show ' + (Math.min(rows.length, 120) - show.length) + ' more</button>' : '') + '</div>';
    }
  }
  out += '</div>';
  el.innerHTML = out;
  chipAt.forEach(function (c) { if (!c[1]) return; var n = el.querySelector('.hs-chips[aria-label="' + c[0] + '"]'); if (n) n.scrollLeft = c[1]; });
  if (typeof window._noDrift === 'function') window._noDrift();
  _hsRailMark();
  if (keepFocus) { var q = document.getElementById('hs-q'); if (q) { try { q.focus({ preventScroll: true }); } catch (e) { q.focus(); } try { q.setSelectionRange(q.value.length, q.value.length); } catch (e) {} } }
}


// ══ v7.105.0: THE BOARD, THE TEAM LENS AND THE RAIL'S OPTIONS ══════════════
// The Board: every free agent still unsigned, ranked, on a glass card lit
// from the corner in his last team's color — where you and your friends say
// he signs, Pick, and vs (compare). All / SP / RP / C / IF / OF narrows it;
// the team lens narrows it to one club and adds what that club has done.
function _hsWaitHtml() {
  var H = window._hs;
  return H.failed ? '<div class="hs-list"><div class="hs-empty">Couldn’t load the Hot Stove right now. <button type="button" class="hs-chip" onclick="window._hs.failed=false;_hsLoad(true);_hsRender()">Try again</button></div></div>' : '<div class="hs-skel" aria-label="Loading"></div>';
}
function _hsRgba(hex, a) {
  var h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-f]{6}$/i.test(h)) return 'rgba(61,53,128,' + a + ')';
  return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16) + ',' + a + ')';
}
function _hsLum(hex) {
  var h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-f]{6}$/i.test(h)) return 0.2;
  return (0.2126 * parseInt(h.slice(0, 2), 16) + 0.7152 * parseInt(h.slice(2, 4), 16) + 0.0722 * parseInt(h.slice(4, 6), 16)) / 255;
}
function _hsAbbr(id) { return (typeof CMP_TEAM !== 'undefined' && CMP_TEAM[id]) || ''; }
function _hsRole(p) {
  if (_hsKindOf(p) === 'pit') return p.pit && p.pit.g && p.pit.gs >= p.pit.g / 2 ? 'SP' : 'RP';
  return p.pos || '';
}
function _hsPosOk(p, f) {
  if (!f || f === 'all') return true;
  var r = _hsRole(p);
  if (f === 'sp' || f === 'rp') return r === f.toUpperCase();
  if (_hsKindOf(p) === 'pit') return false;
  if (f === 'c') return r === 'C';
  if (f === 'if') return ['1B', '2B', '3B', 'SS', 'IF'].indexOf(r) >= 0;
  if (f === 'of') return ['LF', 'CF', 'RF', 'OF'].indexOf(r) >= 0;
  return true;
}
// what one club has done: who came in, who left, and who of theirs is still out there
function _hsTeamTally(tid) {
  var D = window._hs.data, inn = {}, out = {}, mv = [];
  if (!D) return { inn: 0, out: 0, moves: [] };
  D.moves.forEach(function (m) {
    var hit = false;
    if (m.kind === 'trade') {
      (m.teams || []).forEach(function (sd) {
        var mine = sd.team && sd.team.id === tid;
        if (mine) { hit = true; sd.gets.forEach(function (id) { inn[id] = 1; }); }
      });
      if (hit) (m.teams || []).forEach(function (sd) { if (sd.team && sd.team.id !== tid) sd.gets.forEach(function (id) { out[id] = 1; }); });
    } else if (m.team && m.team.id === tid) {
      hit = true;
      var p = _hsP(m.player);
      if (m.kind === 'sign' || m.kind === 'claim') { if (!(m.kind === 'sign' && p && p.lastTeam === tid)) inn[m.player] = 1; }
      else out[m.player] = 1;
    } else if (m.from && m.from.id === tid) { hit = true; out[m.player] = 1; }
    if (hit) mv.push(m);
  });
  // re-signed with the same club: not out after all
  D.moves.forEach(function (m) { if (m.kind === 'sign' && m.team && m.team.id === tid) delete out[m.player]; });
  return { inn: Object.keys(inn).length, out: Object.keys(out).length, moves: mv };
}
function _hsBoardCard(p, rank) {
  var H = window._hs, tid = p.lastTeam, L = _hsLook({ id: tid, name: '' }), kind = _hsKindOf(p);
  // the team's color floods the corner; its lighter accent keeps dark navies from disappearing into the glass
  var glow = _hsRgba(L.bg, 0.96), glow2 = _hsRgba(L.accent || L.bg, _hsLum(L.bg) < 0.12 ? 0.5 : 0.28);
  var all = _hsPicksFor(p.id), mine = _hsMyPick(p.id), friends = all.filter(function (x) { return x.name !== 'You'; }).length;
  var pk = mine ? 'You: ' + mine + (friends ? ' · ' + friends + (friends === 1 ? ' friend in' : ' friends in') : '') : friends ? friends + (friends === 1 ? ' friend picked' : ' friends picked') : 'No picks yet';
  var held = H.base && String(H.base.id) === String(p.id);
  var ab = _hsAbbr(tid) || L.abbr || '';
  return '<div class="hb-card" role="button" tabindex="0" style="background:radial-gradient(150px 84px at 0 0,' + glow2 + ',rgba(20,16,48,0) 70%),radial-gradient(270px 150px at 0 0,' + glow + ',rgba(20,16,48,0) 74%),rgba(20,16,48,.9)" onclick="hsCard(' + p.id + ',' + _hsA(p.name) + ')">' +
    '<div class="hb-r1"><span class="hb-l">' + (ab ? '<span class="hb-chip" style="background:' + L.bg + ';color:' + L.fg + '">' + _hsE(ab) + '</span>' : '') + '<span class="hb-eb">' + _hsE([_hsRole(p), p.age ? 'AGE ' + p.age : ''].filter(Boolean).join(' · ')) + '</span></span><span class="hb-tag">UNSIGNED</span></div>' +
    '<div class="hb-r2"><span class="hb-rk">' + rank + '</span><div class="hb-who"><b>' + _hsE(p.name) + '</b><span>' + _hsE(_hsLine(p) || 'No line last season') + '</span></div></div>' +
    '<div class="hb-r3"><span class="hb-pk">' + _hsE(pk) + '</span><span class="hb-bt"><button type="button" class="hb-pick" aria-label="' + _hsE('Where does ' + p.name + ' sign?') + '" onclick="event.stopPropagation();hsTeams(' + p.id + ')">' + (mine ? 'Change' : 'Pick') + '</button>' +
    '<button type="button" class="hb-vs' + (held ? ' on' : '') + '" aria-pressed="' + !!held + '" aria-label="' + _hsE('Compare ' + p.name) + '" onclick="event.stopPropagation();hsCmp(' + p.id + ',' + _hsA(p.name) + ',' + _hsA(kind) + ')">vs</button></span></div></div>';
}
function _hsBoardHtml(baseHtml) {
  var H = window._hs, D = H.data, tid = H.team || null;
  var L = tid ? _hsLook({ id: tid, name: '' }) : null, ab = tid ? (_hsAbbr(tid) || (L && L.abbr) || '') : '';
  var out = '<div class="hb-hd"><h3 class="hs-h2">The Board</h3><span class="hb-acts">' +
    '<button type="button" class="hb-lens' + (tid ? ' on' : '') + '"' + (tid ? ' style="background:' + L.bg + ';color:' + L.fg + '"' : '') + ' aria-label="' + (tid ? _hsE('Showing ' + ab + ', change team') : 'Look at one team') + '" onclick="hsLens()">' + (tid ? _hsE(ab) : 'All teams') + '</button>' +
    '<button type="button" class="hb-ic" aria-label="Search any player" onclick="hsView(\'players\',true)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></button></span></div>';
  var P = [['all', 'All'], ['sp', 'SP'], ['rp', 'RP'], ['c', 'C'], ['if', 'IF'], ['of', 'OF']];
  out += '<div class="hb-seg" role="group" aria-label="Position">' + P.map(function (x) { var on = (H.pos || 'all') === x[0]; return '<button type="button" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" onclick="hsPos(' + _hsA(x[0]) + ')">' + x[1] + '</button>'; }).join('') + '</div>';
  out += baseHtml || '';
  if (!D) return out + _hsWaitHtml();
  var ranked = (D.fas || []).map(_hsP).filter(Boolean).map(function (p, i) { return { p: p, rank: i + 1 }; });
  var mineFa = tid ? ranked.filter(function (x) { return x.p.lastTeam === tid; }) : ranked;
  var tally = tid ? _hsTeamTally(tid) : null;
  if (tid) {
    out += '<div class="hb-team"><div><small>' + _hsE(ab) + ' · THIS OFFSEASON</small><b>' + tally.inn + ' in · ' + tally.out + ' out · ' + mineFa.length + ' unsigned</b></div><button type="button" class="hb-ghost" onclick="hsLensPick(0)">All teams</button></div>';
  }
  var list = mineFa.filter(function (x) { return _hsPosOk(x.p, H.pos); });
  var show = H.boardMore ? list : list.slice(0, 12);
  if (show.length) out += show.map(function (x) { return _hsBoardCard(x.p, x.rank); }).join('');
  else out += '<div class="hs-list"><div class="hs-empty">' + (tid ? 'None of their free agents ' + ((H.pos || 'all') === 'all' ? 'is' : 'at that spot is') + ' still unsigned.' : 'Nobody at that spot is still unsigned.') + '</div></div>';
  if (list.length > show.length) out += '<button type="button" class="hb-ghost wide" onclick="hsBoardMore()">Show ' + (list.length - show.length) + ' more</button>';
  if (tid && tally.moves.length) out += '<div class="hs-hd"><h3 class="hs-h2">Their moves</h3><span class="hs-mut">' + tally.moves.length + '</span></div><div class="hs-list">' + tally.moves.slice(0, 20).map(_hsRowHtml).join('') + '</div>';
  return out;
}
function hsPos(f) { var H = window._hs; H.pos = f; H.boardMore = false; _hsRender(); }
function hsBoardMore() { window._hs.boardMore = true; _hsRender(); }
function hsView(v, focus) {
  var H = window._hs;
  if (v === 'teams') { H.view = 'board'; _hsRender(); hsLens(); return; }
  H.view = v;
  _hsRender();
  if ((v === 'players' || v === 'compare') && H.q.trim().length >= 2) hsSearch(H.q);
  if (focus) { var q = document.getElementById('hs-q'); if (q) { try { q.focus({ preventScroll: true }); } catch (e) { q.focus(); } } }
}
// your teams' ids, favorite first
function _hsFavIds() {
  var f = window._hs.fav || {}, names = [f.favorite].concat(f.following || []).filter(Boolean), rev = {}, out = [];
  Object.keys(typeof CMP_TEAM !== 'undefined' ? CMP_TEAM : {}).forEach(function (id) { rev[String(CMP_TEAM[id]).toUpperCase()] = +id; });
  names.forEach(function (n) {
    var L = null;
    try { L = typeof _teamLook === 'function' ? _teamLook('mlb', n) : null; } catch (e) {}
    var id = L && L.abbr ? rev[String(L.abbr).toUpperCase()] : null;
    if (id && out.indexOf(id) < 0) out.push(id);
  });
  return out;
}
// the team lens: all 30 in a sheet, yours first and ringed in gold
function hsLens() {
  var el = document.getElementById('hs-teams');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hs-teams';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'hs-teams-t');
    el.addEventListener('click', function (e) { if (e.target === el) hsTeamsClose(); });
    document.body.appendChild(el);
  }
  var H = window._hs, fav = _hsFavIds();
  var ids = Object.keys(typeof CMP_TEAM !== 'undefined' ? CMP_TEAM : {}).map(Number).sort(function (a, b) {
    var fa = fav.indexOf(a), fb = fav.indexOf(b);
    if (fa >= 0 || fb >= 0) return (fa < 0 ? 99 : fa) - (fb < 0 ? 99 : fb);
    return CMP_TEAM[a] < CMP_TEAM[b] ? -1 : 1;
  });
  el.innerHTML = '<div class="sh"><div class="sh-hd"><h2 id="hs-teams-t">Look at one team</h2>' +
    '<button type="button" class="x" aria-label="Close" onclick="hsTeamsClose()">✕</button></div>' +
    (fav.length ? '<div class="hb-shl">YOUR TEAMS FIRST</div>' : '') + '<div class="gr">' +
    ids.map(function (id) {
      var ab = CMP_TEAM[id], L = _hsLook({ id: id, name: '' });
      return '<button type="button" class="hs-tm' + (H.team === id ? ' mine' : fav.indexOf(id) >= 0 ? ' fav' : '') + '" style="background:' + L.bg + ';color:' + L.fg + '" aria-pressed="' + (H.team === id) + '" onclick="hsLensPick(' + id + ')">' + _hsE(ab) + '</button>';
    }).join('') + '</div>' +
    (H.team ? '<button type="button" class="hs-btn clr" onclick="hsLensPick(0)">All teams</button>' : '') + '</div>';
  el.style.display = 'flex';
}
function hsLensPick(id) {
  var H = window._hs;
  hsTeamsClose();
  H.team = id || null; H.boardMore = false; H.view = 'board';
  _hsRender();
}

// ── The rail's options (v7.105.0; every league since v7.106.0) ────────────
// On the Games page the league rail shows for a moment, then tucks: the
// league you're on travels to the left edge (tap it for every sport again),
// the other leagues drop away and that league's options take their place.
// Each sport gets there its own way — the baseball rolls, the football is
// thrown, the basketball drops through a hoop, the puck and the soccer ball
// go into a net — and rolls (or is thrown) back when you tap Sports.
// Options only ever name things that exist: the offseason page's views for
// baseball in the winter, and elsewhere Games, the league's standings /
// playoff picture / Top 25 where there is one, Teams, Players, TV and Multi.
// js/games/games-deck.js calls hsRail(sport, offseasonPage) on every draw
// and hsRailPick(key) when a league is tapped.
window._hsRailS = window._hsRailS || { key: null, sport: null, off: false, tucked: false, t: 0, u: 0, fast: false };
var HS_IC = {
  board: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  players: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-4 5-5 8-5s6.5 1 8 5',
  compare: 'M4 8h14l-3-3M20 16H6l3 3',
  stove: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  teams: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z',
  games: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
  stand: 'M5 20V10M12 20V4M19 20v-7',
  cup: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  tv: 'M4 6h16v11H4zM9 20h6M12 17v3',
  multi: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'
};
var HS_FX = { mlb: 'roll', nfl: 'pass', cfb: 'pass', nba: 'hoop', wnba: 'hoop', cbb: 'hoop', nhl: 'puck', mls: 'kick', nwsl: 'kick' };
var HS_HOOP = '<svg width="48" height="34" viewBox="0 0 48 34" fill="none" aria-hidden="true"><rect x="2" y="0" width="3" height="22" rx="1" fill="#F3F1FF"/><path d="M5 12h5" stroke="#FF7A2F" stroke-width="2.5"/><path d="M10 13L14 29M16 15L18 29M22 15.5V29M28 15L26 29M34 13L30 29M14 29H30M12 20H32" stroke="#F3F1FF" stroke-opacity=".75" stroke-width="1"/><ellipse cx="22" cy="12" rx="13" ry="3.5" stroke="#FF7A2F" stroke-width="2.5"/></svg>';
function _hsGoalSvg(c, w) { return '<svg width="32" height="30" viewBox="0 0 32 30" fill="none" aria-hidden="true"><path d="M27 4V27H5c0-9 6-21 22-23z" fill="rgba(255,255,255,.10)"/><path d="M10 27C11 19 16 10 22 6M16 27c1-7 4-14 8-19M21 27V9M8 21h19M12 14h15" stroke="#F3F1FF" stroke-opacity=".7" stroke-width="1"/><path d="M27 4V27H5c0-9 6-21 22-23z" stroke="' + c + '" stroke-width="' + w + '" stroke-linejoin="round"/></svg>'; }
// the options a league really has right now: [key, label, icon, what it does]
function _hsRailOpts(sport, off) {
  if (sport === 'mlb' && off) {
    return ['board', 'players', 'compare', 'stove', 'teams'].map(function (v) {
      return [v, v.charAt(0).toUpperCase() + v.slice(1), HS_IC[v], function () { hsView(v); }];
    });
  }
  var o = [['games', 'Games', HS_IC.games, function () { var sc = document.querySelector('#screen-games-picker .scroll-bare'); if (sc) { try { sc.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { sc.scrollTop = 0; } } }]];
  var third = { mlb: ['Standings', HS_IC.stand], nfl: ['Playoffs', HS_IC.cup], nba: ['Standings', HS_IC.stand], cbb: ['Top 25', HS_IC.list] }[sport];
  if (third && typeof openPlayoffPicture === 'function') o.push(['table', third[0], third[1], function () { openPlayoffPicture(sport); }]);
  if (typeof openTeamPrefs === 'function') o.push(['teams', 'Teams', HS_IC.teams, function () { openTeamPrefs(sport); }]);
  if (typeof openInningsSearch === 'function') o.push(['players', 'Players', HS_IC.players, function () { openInningsSearch(); }]);
  if (typeof window.gdkGuide === 'function') o.push(['tv', 'TV', HS_IC.tv, function () { window.gdkGuide(sport); }]);
  if (o.length < 5 && typeof multiOpen === 'function') o.push(['multi', 'Multi', HS_IC.multi, function () { multiOpen(); }]);
  return o.slice(0, 5);
}
function _hsRailEls() {
  var band = document.getElementById('gdk-band'), rail = document.getElementById('gdk-rail');
  return band && rail ? { band: band, rail: rail, menu: document.getElementById('hsm') } : null;
}
function _hsRailBuild(E) {
  var R = window._hsRailS, m = E.menu;
  if (!m) { m = document.createElement('div'); m.id = 'hsm'; E.band.appendChild(m); E.band.classList.add('hsm'); E.menu = m; }
  var fx = HS_FX[R.sport] || 'roll', on = E.rail.querySelector('.gdk-lg.on .em'), lab = E.rail.querySelector('.gdk-lg.on .nm');
  var T = { roll: 1100, pass: 1250, hoop: 1600, puck: 1400, kick: 1600 }[fx];
  R.dur = T;
  m.style.setProperty('--d', Math.round(T * (fx === 'roll' ? 0.5 : fx === 'pass' ? 0.6 : 0.8)) + 'ms'); // the options wait for the ball to land
  R.opts = _hsRailOpts(R.sport, R.off);
  m.setAttribute('data-fx', fx);
  m.innerHTML = (fx === 'hoop' ? '<i class="hsm-fx" aria-hidden="true">' + HS_HOOP + '</i>' : fx === 'puck' ? '<i class="hsm-fx" aria-hidden="true">' + _hsGoalSvg('#E5484D', '2.5') + '</i>' : fx === 'kick' ? '<i class="hsm-fx" aria-hidden="true">' + _hsGoalSvg('#F3F1FF', '2.2') + '</i>' : '') +
    '<button type="button" class="hsm-back" aria-label="Back to all sports" onclick="hsRailBack()"><span class="em" aria-hidden="true"><b>' + (on ? on.innerHTML : '') + '</b></span><span class="nm"><span class="a">' + _hsE(lab ? lab.textContent : '') + '</span><span class="z">Sports</span></span></button><i class="hsm-div" aria-hidden="true"></i>' +
    R.opts.map(function (o, i) {
      return '<button type="button" class="hsm-o" data-v="' + o[0] + '" style="--i:' + i + '" onclick="hsRailGo(' + i + ')"><span class="em"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + o[2] + '"/></svg></span><span class="nm">' + o[1] + '</span></button>';
    }).join('');
  _hsRailMark();
  return m;
}
function hsRailGo(i) {
  var o = (window._hsRailS.opts || [])[i];
  if (!o) return;
  try { o[3](); } catch (e) { console.error('[rail options]', o[0], e); }
}
function _hsRailMark() {
  var m = document.getElementById('hsm'), R = window._hsRailS;
  if (!m) return;
  var v = R.sport === 'mlb' && R.off ? (window._hs.view || 'board') : 'games';
  [].forEach.call(m.querySelectorAll('.hsm-o'), function (b) { var on = b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
function _hsRailDx(E) {
  var sel = E.rail.querySelector('.gdk-lg.on'), back = E.menu.querySelector('.hsm-back');
  if (!sel || !back) return 0;
  // from layout, not from where an animation has it right now
  var bandL = E.band.getBoundingClientRect().left;
  return Math.round(sel.getBoundingClientRect().left - (bandL + E.band.clientLeft + back.offsetLeft));
}
function _hsRailTuck() {
  var R = window._hsRailS, E = _hsRailEls();
  clearTimeout(R.t);
  if (!E || !R.key || R.tucked) return;
  if (!E.rail.querySelector('.gdk-lg.on')) { R.t = setTimeout(_hsRailTuck, 400); return; } // the rail isn't drawn yet
  var m = _hsRailBuild(E), back = m.querySelector('.hsm-back');
  clearTimeout(R.u);
  E.band.classList.remove('untucking');
  // it starts where the league sits in the rail (--dx), then travels to the left edge;
  // the travel and the flight are keyframes on one clock (css/offseason.css)
  back.style.setProperty('--dx', _hsRailDx(E) + 'px');
  void back.offsetWidth;
  // the basketball's arc clears the top of the rail for a moment
  clearTimeout(R.f);
  if (m.getAttribute('data-fx') === 'hoop') { E.band.classList.add('fxfly'); R.f = setTimeout(function () { E.band.classList.remove('fxfly'); }, (R.dur || 1600) + 60); }
  E.band.classList.add('tuck');
  R.tucked = true;
}
function hsRailBack() {
  var R = window._hsRailS, E = _hsRailEls();
  clearTimeout(R.t);
  if (!E || !E.menu || !R.tucked) return;
  var back = E.menu.querySelector('.hsm-back');
  R.tucked = false;
  clearTimeout(R.f);
  E.band.classList.remove('fxfly');
  back.style.setProperty('--dx', _hsRailDx(E) + 'px');
  E.band.classList.add('untucking');
  E.band.classList.remove('tuck');
  clearTimeout(R.u);
  // the ball is home: the rail's own button takes over in the same frame
  R.u = setTimeout(function () { E.band.classList.remove('untucking'); }, 710);
}
// sport: the league showing on the Games page (null when the page isn't a league's); off: baseball's offseason page is up
function hsRail(sport, off) {
  if (sport === true) { sport = 'mlb'; off = true; } else if (sport === false) sport = null; // v7.105.0 callers
  var R = window._hsRailS, E = _hsRailEls();
  if (!E) return;
  var key = sport ? sport + (off ? '|off' : '') : null;
  if (key === R.key) return;
  var sameSport = sport && sport === R.sport, wasTucked = R.tucked;
  clearTimeout(R.t);
  R.key = key; R.sport = sport || null; R.off = !!off;
  if (!key) {
    clearTimeout(R.u);
    R.tucked = false;
    E.band.classList.remove('tuck', 'untucking', 'hsm', 'fxfly');
    if (E.menu && E.menu.parentNode) E.menu.parentNode.removeChild(E.menu);
    return;
  }
  // same league, different page (baseball's season line just landed): swap the options where they stand
  if (sameSport && wasTucked) { _hsRailBuild(E); return; }
  clearTimeout(R.u);
  R.tucked = false;
  E.band.classList.remove('tuck', 'untucking');
  _hsRailBuild(E);
  R.t = setTimeout(_hsRailTuck, R.fast ? 700 : 1800);
  R.fast = false;
}
// a league tapped in the rail: the one you're on tucks straight away, a new one after a beat
function hsRailPick(key) {
  var R = window._hsRailS;
  if (key === R.sport && R.key && !R.tucked) { clearTimeout(R.t); R.t = setTimeout(_hsRailTuck, 160); return; }
  R.fast = true;
}

// Show or hide the page whenever the schedule loads (any league, any date)
(function () {
  if (typeof loadGamesList === 'function') {
    var prev = loadGamesList;
    loadGamesList = function () { var r = prev.apply(this, arguments); try { hsSync(); } catch (e) { console.error('[offseason] sync:', e); } return r; };
  }
  if (typeof loadFootballWeek === 'function') {
    var prevF = loadFootballWeek;
    loadFootballWeek = function () { var r = prevF.apply(this, arguments); try { hsSync(); } catch (e) {} return r; };
  }
  // the season line can land after the schedule does
  if (typeof _gsPhasePaint === 'function') {
    var prevP = _gsPhasePaint;
    _gsPhasePaint = function () { var r = prevP.apply(this, arguments); try { var s = document.getElementById('screen-games'); if (s && s.classList.contains('active')) hsSync(); } catch (e) {} return r; };
  }
})();
