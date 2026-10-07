// ══ DESKTOP LAYOUT (v5.69.0) ══════════════════════════════════════════
// A computer (mouse/trackpad, no touch) with a wide landscape window gets
// html.desk: the iPad sidebar plus desktop layouts — game chat beside the
// cheat sheet, a right-hand column on the Feed, a grid of memories, and
// two columns on a game memory. Phones and iPads never get the class.
function _isDesk() { return document.documentElement.classList.contains('desk'); }
function _deskCheck() {
  var fine = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var on = fine && (navigator.maxTouchPoints || 0) === 0 && window.innerWidth >= 1100 && window.innerWidth > window.innerHeight;
  var root = document.documentElement;
  var was = root.classList.contains('desk');
  root.classList.toggle('desk', on);
  if (on) root.classList.add('is-tablet'); // the iPad sidebar styles key off this
  _deskFeedLayout(on);
  _deskRescaleFlourishes();
  if (on !== was) {
    var g = window._activeBrowseGame;
    if (on && g && typeof startGameChat === 'function') startGameChat(g.gamePk);
    if (!on && typeof gameDetailTab === 'function' && document.getElementById('screen-game')) gameDetailTab(window._gdLeftTab || 'sheet');
    // v7.22.0: the score bar decides phone vs laptop on resize, before this
    // check has run; going full screen left it in phone mode over the chat
    if (typeof _gshApply === 'function') _gshApply();
    if (window._openMomentId && typeof _findMoment === 'function') { var mm = _findMoment(window._openMomentId); if (mm && typeof renderMemoryView === 'function') { try { renderMemoryView(mm); } catch (e) {} } }
  }
  return on;
}
// Fullscreen sport flourishes run on a fixed 390×844 stage. Re-fit any
// that's on screen when the window changes size, so they stay in
// proportion (letterboxed in landscape) instead of stretching or cropping.
function _deskRescaleFlourishes() {
  if (typeof _mlbfScale !== 'function') return;
  document.querySelectorAll('.mlbf-stage').forEach(function (stage) {
    var ov = stage.parentElement;
    if (!ov || ov.offsetParent === null) return;
    var w = ov.clientWidth || 390, h = ov.clientHeight || 844;
    stage.style.setProperty('--mlbf-s', _mlbfScale(w, h).toFixed(4));
  });
}
var _deskResizeT = null;
document.addEventListener('keydown', function (e) {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K') && typeof openInningsSearch === 'function') { e.preventDefault(); openInningsSearch(); }
  if (e.key === 'Escape') { ['otd-overlay', 'rule-overlay', 'isearch-overlay'].forEach(function (id) { var el = document.getElementById(id); if (el && el.style.display === 'flex') el.style.display = 'none'; }); }
});
window.addEventListener('resize', function () { clearTimeout(_deskResizeT); _deskResizeT = setTimeout(_deskCheck, 120); });

// Feed on desktop: the main column plus a right-hand column holding
// Watching and your recent memories. The same elements are moved (not
// copied), so everything that renders into them keeps working, and
// they go back exactly where they were when the window narrows.
function _deskFeedLayout(on) {
  var body = document.querySelector('#screen-feed .imm-body');
  if (!body) return;
  var main = document.getElementById('feed-desk-main');
  if (on && !main) {
    main = document.createElement('div'); main.id = 'feed-desk-main';
    var rail = document.createElement('aside'); rail.id = 'feed-desk-rail';
    rail.innerHTML = '<div id="feed-rail-recent"></div>';
    while (body.firstChild) main.appendChild(body.firstChild);
    body.appendChild(main); body.appendChild(rail);
    var watch = document.getElementById('feed-live-feed-section');
    if (watch) { watch.setAttribute('data-desk-moved', '1'); rail.insertBefore(watch, rail.firstChild); }
    body.classList.add('feed-desk');
    _deskRenderRail();
  } else if (!on && main) {
    var rail2 = document.getElementById('feed-desk-rail');
    var watch2 = document.getElementById('feed-live-feed-section');
    // Watching sat right after the Feedback banner — its original spot.
    if (watch2 && watch2.getAttribute('data-desk-moved')) {
      var anchor = document.getElementById('feed-upcoming-list');
      var sec = anchor && anchor.previousElementSibling; // the "Coming up" header
      main.insertBefore(watch2, sec || main.firstChild);
      watch2.removeAttribute('data-desk-moved');
    }
    while (main.firstChild) body.insertBefore(main.firstChild, main);
    main.remove(); if (rail2) rail2.remove();
    body.classList.remove('feed-desk');
  }
}
function _deskRenderRail() {
  var box = document.getElementById('feed-rail-recent');
  if (!box) return;
  var ms = (window._moments || []).slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); }).slice(0, 4);
  if (!ms.length) {
    if (!window._deskRailAsked && typeof loadMoments === 'function') { window._deskRailAsked = true; loadMoments(); }
    box.innerHTML = '';
    return;
  }
  box.innerHTML = '<div class="imm-eyebrow" style="margin:6px 2px 10px">Recent memories</div><div class="rail-list">' + ms.map(function (m) {
    return '<button class="rail-mem" data-id="' + _escapeHtml(m._id) + '" onclick="openMemory(this.dataset.id)">' +
      '<span class="rail-mem-img" style="' + _otdThumbStyle(m) + '"></span>' +
      '<span class="rail-mem-tx"><b>' + _escapeHtml(m.name || 'Memory') + '</b><span>' + _escapeHtml(m.date ? _formatMomentDate(m.date) : '') + '</span></span></button>';
  }).join('') + '</div><button class="imm-link" style="margin:10px 2px 0;background:none;border:0;font-family:inherit;cursor:pointer;padding:0" onclick="nav(\'memories\')">All memories ›</button>';
}

// ══ ON THIS DAY — resurfacing ═════════════════════════════════════════
function _otdYearsAgo(m) { return Number(_todayLocal().slice(0, 4)) - Number(String(m.date).slice(0, 4)); }
function _otdThumbStyle(m) {
  if (m.photo) return 'background-image:url(' + m.photo + ');background-size:cover;background-position:center';
  if (typeof _mdIsTicket === 'function' && _mdIsTicket(m)) {
    try {
      var sp = _mdSport(m), a = _mdSide(m.boxScore, 'away', sp), h = _mdSide(m.boxScore, 'home', sp);
      return 'background:linear-gradient(135deg,' + a.colors.bg + ' 0%,#2A2160 55%,' + h.colors.bg + ' 140%)';
    } catch (e) {}
  }
  return 'background:linear-gradient(135deg,#3D3580 0%,#1A1640 100%)';
}
function _otdWho(m) {
  var p = (m.people || []).filter(Boolean).map(function (n) { return String(n).split(' ')[0]; });
  if (!p.length) return '';
  return 'with ' + (p.length === 1 ? p[0] : p.length === 2 ? p[0] + ' and ' + p[1] : p[0] + ' +' + (p.length - 1));
}
function _otdAgo(n) { return n === 1 ? '1 year ago' : n + ' years ago'; }
window._otd = { key: null, items: [] };
// Only the memories dated today's month/day in past years — one small
// query (up to 10 years back — the 'in' limit), not the whole archive.
function loadOnThisDay() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  var today = _todayLocal(), key = today.slice(5), year = Number(today.slice(0, 4));
  if (window._otd.key === today) { _otdRenderBanner(); return; }
  var dates = [];
  for (var y = year - 1; y >= year - 10; y--) dates.push(y + '-' + key);
  window.db.collection('users').doc(user.uid).collection('moments').where('date', 'in', dates).get().then(function (snap) {
    var arr = [];
    snap.forEach(function (d) { arr.push(Object.assign({ _id: d.id }, d.data())); });
    arr.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    window._otd = { key: today, items: arr };
    _otdRenderBanner();
    _otdMaybeNotify(user, arr);
  }).catch(function (err) { console.error('[on this day] ' + (err && err.code), err); });
}
function _otdRenderBanner() {
  var el = document.getElementById('otd-feed-banner');
  if (!el) return;
  var items = window._otd.items || [];
  if (!items.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  var m = items[0];
  var sub = [_otdWho(m), m.highlight ? '“' + (m.highlight.length > 60 ? m.highlight.slice(0, 60) + '…' : m.highlight) + '”' : ''].filter(Boolean).join(' · ');
  el.style.display = 'block';
  el.innerHTML = '<button class="otd-card" onclick="openOnThisDay()" style="' + _otdThumbStyle(m) + '">' +
    '<span class="otd-shade"></span>' +
    '<span class="otd-eb"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 3h6"/></svg>On this day · ' + _otdAgo(_otdYearsAgo(m)) + (items.length > 1 ? ' · +' + (items.length - 1) + ' more' : '') + '</span>' +
    '<span class="otd-title">' + _escapeHtml(m.name || 'A memory') + '</span>' +
    (sub ? '<span class="otd-sub">' + _escapeHtml(sub) + '</span>' : '') +
    '<span class="otd-go">Look back ›</span></button>';
}
function openOnThisDay() {
  var ov = document.getElementById('otd-overlay'), body = document.getElementById('otd-body');
  if (!ov || !body) return;
  var items = window._otd.items || [];
  var d = new Date(_todayLocal() + 'T12:00:00');
  var dayLabel = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  body.innerHTML = '<div style="display:flex;flex-direction:column;gap:4px"><span class="rb-h1">' + _escapeHtml(dayLabel) + '</span><span class="gh-sub" style="font-size:14px">Every year you&#39;ve marked something on this date</span></div>' +
    (items.length ? items.map(function (m, i) {
      var sub = [m.date ? _formatMomentDate(m.date) : '', _otdWho(m)].filter(Boolean).join(' · ');
      return '<button class="otd-row' + (i === 0 ? ' big' : '') + '" data-id="' + _escapeHtml(m._id) + '" onclick="closeOnThisDay();openMemory(this.dataset.id)">' +
        '<span class="otd-row-img" style="' + _otdThumbStyle(m) + '"></span>' +
        '<span class="otd-row-tx"><span class="gh-eyebrow">' + _otdAgo(_otdYearsAgo(m)) + '</span><b>' + _escapeHtml(m.name || 'A memory') + '</b><span>' + _escapeHtml(sub) + '</span>' +
        (m.highlight ? '<span class="otd-row-note">' + _escapeHtml(m.highlight) + '</span>' : '') + '</span></button>';
    }).join('') : '<div class="rb-empty">Nothing on this date yet — this is where it&#39;ll show up next year.</div>');
  ov.style.display = 'flex';
}
function closeOnThisDay() { var ov = document.getElementById('otd-overlay'); if (ov) ov.style.display = 'none'; }
// One in-app notification per day when there's something to look back on.
// The doc id is fixed per person per day, so it can only ever be created
// once (a second try is an update, which the rules refuse — harmless).
function _otdMaybeNotify(user, items) {
  if (!items.length || !window.db) return;
  var today = _todayLocal(), flag = 'innings-otd-' + user.uid + '-' + today;
  try { if (localStorage.getItem(flag)) return; localStorage.setItem(flag, '1'); } catch (e) {}
  var m = items[0];
  window.db.collection('notifications').doc('otd_' + user.uid + '_' + today).set({
    toUid: user.uid, fromUid: user.uid, fromName: 'Innings', type: 'on_this_day',
    momentId: m._id, momentName: (m.name || 'A memory') + (_otdWho(m) ? ' · ' + _otdWho(m) : ''),
    yearsAgo: _otdYearsAgo(m), ts: Date.now(), read: false
  }).catch(function () { /* already sent today */ });
}

// ══ ARCHIVE SEARCH — your own memories ════════════════════════════════
window._ms = { q: '', filter: 'all' };
function _msFields(m) {
  var bs = m.boxScore || {};
  return {
    people: (m.people || []).filter(Boolean),
    teams: [bs.away, bs.home].filter(Boolean),
    notes: [m.name, m.vibe, m.highlight, m.dedication, m.watchedAt, bs.venue].concat((m.comments || []).map(function (c) { return c && c.text; })).concat((m.players || []).map(function (p) { return p && p.name; })).filter(Boolean),
    date: m.date ? _formatMomentDate(m.date) : ''
  };
}
function _msMatch(m, q, filter) {
  var f = _msFields(m), hit = null;
  var test = function (arr, kind) { for (var i = 0; i < arr.length; i++) { if (String(arr[i]).toLowerCase().indexOf(q) !== -1) { hit = { kind: kind, text: String(arr[i]) }; return true; } } return false; };
  if (filter === 'people') return test(f.people, 'people') ? hit : null;
  if (filter === 'teams') return test(f.teams, 'teams') ? hit : null;
  if (filter === 'notes') return test(f.notes, 'notes') ? hit : null;
  if (test(f.people, 'people') || test(f.teams, 'teams') || test(f.notes, 'notes') || test([f.date], 'date')) return hit;
  return null;
}
function _msMark(text, q) {
  var s = String(text), i = s.toLowerCase().indexOf(q);
  if (i === -1) return _escapeHtml(s);
  var start = Math.max(0, i - 40), end = Math.min(s.length, i + q.length + 60);
  return (start > 0 ? '…' : '') + _escapeHtml(s.slice(start, i)) + '<mark>' + _escapeHtml(s.slice(i, i + q.length)) + '</mark>' + _escapeHtml(s.slice(i + q.length, end)) + (end < s.length ? '…' : '');
}
function _msSearch(q, filter) {
  q = String(q || '').trim().toLowerCase();
  if (q.length < 2) return { people: [], memories: [] };
  var mems = [], people = {};
  (window._moments || []).forEach(function (m) {
    var hit = _msMatch(m, q, filter || 'all');
    if (hit) mems.push({ m: m, hit: hit });
    (m.people || []).forEach(function (n, i) {
      if (!n || String(n).toLowerCase().indexOf(q) === -1) return;
      var k = (m.taggedUids && m.taggedUids[i]) || n;
      var p = people[k] = people[k] || { name: n, uid: (m.taggedUids && m.taggedUids[i]) || null, count: 0, last: '' };
      p.count++;
      if (String(m.date || '') > p.last) p.last = m.date || '';
    });
  });
  mems.sort(function (a, b) { return String(b.m.date || '').localeCompare(String(a.m.date || '')); });
  var plist = Object.keys(people).map(function (k) { return people[k]; }).sort(function (a, b) { return b.count - a.count; });
  return { people: (filter === 'all' || filter === 'people') ? plist : [], memories: mems };
}
function _msRowHtml(x, q) {
  var m = x.m;
  var sub = [m.date ? _formatMomentDate(m.date) : '', _otdWho(m)].filter(Boolean).join(' · ');
  var line = x.hit.kind === 'notes' && x.hit.text !== m.name ? '<span class="ms-snip">' + _msMark(x.hit.text, q) + '</span>' : '';
  return '<button class="ms-row" data-id="' + _escapeHtml(m._id) + '" onclick="openMemory(this.dataset.id)">' +
    '<span class="ms-img" style="' + _otdThumbStyle(m) + '"></span>' +
    '<span class="ms-tx"><b>' + _msMark(m.name || 'Untitled moment', q) + '</b><span>' + _msMark(sub, q) + '</span>' + line + '</span></button>';
}
function msInput(v) { window._ms.q = v; _msRender(); }
function msFilter(k) { window._ms.filter = k; _msRender(); }
function _msRender() {
  var s = window._ms, q = (s.q || '').trim().toLowerCase();
  var body = document.querySelector('#screen-memories .imm-body');
  var box = document.getElementById('ms-results');
  var tabs = document.getElementById('ms-tabs');
  if (!box || !body) return;
  var on = q.length >= 2;
  body.classList.toggle('ms-on', on);
  if (tabs) {
    tabs.style.display = on ? 'flex' : 'none';
    tabs.innerHTML = [['all', 'All'], ['people', 'People'], ['teams', 'Teams'], ['notes', 'Notes']].map(function (t) {
      return '<button class="rb-pill' + (s.filter === t[0] ? ' on' : '') + '" aria-pressed="' + (s.filter === t[0]) + '" onclick="msFilter(\'' + t[0] + '\')">' + t[1] + '</button>';
    }).join('');
  }
  if (!on) { box.innerHTML = ''; return; }
  var r = _msSearch(q, s.filter), html = '';
  if (r.people.length) {
    html += '<div class="rb-eyebrow">People</div><div class="rb-list">' + r.people.slice(0, 4).map(function (p) {
      return '<button class="is-row" data-uid="' + _escapeHtml(p.uid || '') + '" data-n="' + _escapeHtml(p.name) + '" onclick="msOpenPerson(this.dataset.uid,this.dataset.n)">' +
        '<span class="is-av">' + _escapeHtml(_initials(p.name)) + '</span><span class="is-txt"><b>' + _escapeHtml(p.name) + '</b><span>' + p.count + (p.count === 1 ? ' memory' : ' memories') + ' together' + (p.last ? ' · last ' + _escapeHtml(_formatMomentDate(p.last)) : '') + '</span></span></button>';
    }).join('') + '</div>';
  }
  html += '<div class="rb-eyebrow">' + r.memories.length + (r.memories.length === 1 ? ' memory' : ' memories') + '</div>';
  html += r.memories.length ? '<div class="ms-list">' + r.memories.slice(0, 60).map(function (x) { return _msRowHtml(x, q); }).join('') + '</div>'
    : '<div class="rb-empty">Nothing in your memories matches that.</div>';
  box.innerHTML = html;
}
function msOpenPerson(uid, name) {
  if (uid && typeof openFriendHub === 'function') { openFriendHub(uid, name); return; }
  window._ms.filter = 'people';
  var inp = document.getElementById('ms-q'); if (inp) inp.value = name;
  msInput(name);
}

// ── hooks into existing screens ──
(function () {
  var prevNav = _navApplyScreen;
  _navApplyScreen = function (id) {
    prevNav(id);
    if (id === 'feed') { loadOnThisDay(); if (_isDesk()) _deskRenderRail(); }
    var gamesIds = ['games', 'games-picker', 'games-soon', 'game', 'team', 'playoff-picture', 'team-prefs'];
    var gb = document.getElementById('ipad-nav-games');
    if (gb) gb.classList.toggle('active', gamesIds.indexOf(id) !== -1);
  };
  var prevRender = renderMoments;
  renderMoments = function (moments) {
    prevRender(moments);
    if (window._is) window._is.mem = null;
    if (_isDesk()) _deskRenderRail();
    if (window._ms && (window._ms.q || '').trim().length >= 2) _msRender();
  };
  _deskCheck();
  if (document.getElementById('screen-feed') && document.getElementById('screen-feed').classList.contains('active')) loadOnThisDay();
})();
