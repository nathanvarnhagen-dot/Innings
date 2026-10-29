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

window._hs = window._hs || { data: null, at: 0, loading: false, filter: 'all', more: false, pick: 0, base: null, rep: {}, picks: null, picksAt: 0, fav: null, q: '' };
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
  var H = window._hs, D = H.data, chips = [];
  if (D) {
    var fa = (D.fas || []).map(_hsP).filter(Boolean);
    var bats = fa.filter(function (p) { return _hsKindOf(p) === 'bat'; }), arms = fa.filter(function (p) { return _hsKindOf(p) === 'pit'; });
    if (bats.length >= 2) chips.push('<button type="button" class="hs-chip gold" onclick="hsCmpPair(' + bats[0].id + ',' + _hsA(bats[0].name) + ',' + bats[1].id + ',' + _hsA(bats[1].name) + ',\'bat\')">Top 2 free agent bats</button>');
    if (arms.length >= 2) chips.push('<button type="button" class="hs-chip gold" onclick="hsCmpPair(' + arms[0].id + ',' + _hsA(arms[0].name) + ',' + arms[1].id + ',' + _hsA(arms[1].name) + ',\'pit\')">Top 2 free agent arms</button>');
  }
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
        var kind = p.pos === 'P' ? 'pit' : 'bat', team = p.active !== false ? (p.team || '') : (p.first ? p.first + '–' + (p.last || '') : 'Retired');
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
function _hsRender() {
  var el = _hsHost(), H = window._hs, D = H.data;
  if (!el || el.style.display === 'none') return;
  // the search box keeps its text and focus across redraws
  var keepFocus = document.activeElement && document.activeElement.id === 'hs-q';
  var res = document.getElementById('hs-res'), resHtml = res ? res.innerHTML : '', resShow = res ? res.style.display : 'none';
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
  out += '<label class="hs-q"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><span class="hs-sr">Search MLB players</span>' +
    '<input id="hs-q" type="search" autocomplete="off" placeholder="Any player, active or retired" value="' + _hsE(H.q) + '" oninput="hsSearch(this.value)"></label>';
  if (H.base) out += '<div class="hs-base" role="status"><span>Comparing ' + _hsE(_hsLast(H.base.name)) + ' with… tap Compare on another ' + (H.base.kind === 'pit' ? 'pitcher' : 'hitter') + '</span><button type="button" onclick="hsCmpCancel()">Cancel</button></div>';
  out += '<div id="hs-res" class="hs-res" style="display:' + resShow + '">' + resHtml + '</div>';
  out += _hsQuickHtml();
  out += '<div class="hs-hd"><h3 class="hs-h2">Hot Stove</h3><span class="hs-mut">' + (D ? (function () { var c = D.moves.filter(function (m) { return m.date === today; }).length; return c ? c + (c === 1 ? ' move today' : ' moves today') : ''; })() : '') + '</span></div>';
  var F = [['all', 'All'], ['mine', 'My teams'], ['sign', 'Signings'], ['trade', 'Trades'], ['fa', 'Free agents']];
  out += '<div class="hs-chips" role="group" aria-label="Show">' + F.map(function (f) { return '<button type="button" class="hs-chip' + (H.filter === f[0] ? ' on' : '') + '" aria-pressed="' + (H.filter === f[0]) + '" onclick="hsFilter(' + _hsA(f[0]) + ')">' + f[1] + '</button>'; }).join('') + '</div>';
  if (!D) {
    out += H.failed ? '<div class="hs-list"><div class="hs-empty">Couldn’t load the Hot Stove right now. <button type="button" class="hs-chip" onclick="window._hs.failed=false;_hsLoad(true);_hsRender()">Try again</button></div></div>' : '<div class="hs-skel" aria-label="Loading the Hot Stove"></div>';
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
  out += '</div>';
  el.innerHTML = out;
  if (keepFocus) { var q = document.getElementById('hs-q'); if (q) { q.focus(); try { q.setSelectionRange(q.value.length, q.value.length); } catch (e) {} } }
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
