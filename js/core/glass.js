// ══ GLASS (v7.16.0) — the new main interface ══════════════════════════
// Home (a glass bento), Friends, a floating glass tab bar, and the bell +
// profile button up top. Purely additive: every classic screen stays in
// the page and its own code keeps rendering into the same elements. A few
// sections are MOVED (not copied) into Friends — the same trick
// desktop-layout.js uses for the Feed rail — so their loaders, buttons and
// sheets all keep working untouched. Game cards and game pages aren't
// touched at all.
//
// Turning it off: Profile › Layout › Classic (saved on this device), or open
// the app with ?ui=classic. ?ui=glass turns it back on.

var GLASS_KEY = 'innings_ui';
function _glassWanted() {
  var mode = null;
  try {
    var q = new URLSearchParams(location.search).get('ui');
    if (q === 'classic' || q === 'glass') { mode = q; localStorage.setItem(GLASS_KEY, q); }
    else mode = localStorage.getItem(GLASS_KEY);
  } catch (e) {}
  return mode !== 'classic';
}
window.INNINGS_GLASS = _glassWanted();

function glassSetLayout(mode) {
  if ((mode === 'glass') === !!window.INNINGS_GLASS) return;
  try { localStorage.setItem(GLASS_KEY, mode); } catch (e) {}
  try { var u = new URL(location.href); u.searchParams.set('ui', mode); location.replace(u.toString()); }
  catch (e) { location.reload(); }
}

// ── small helpers ──
function _gl$(id) { return document.getElementById(id); }
function _glEsc(s) { return typeof _escapeHtml === 'function' ? _escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var GL_TWO_WORD = ['Red Sox', 'White Sox', 'Blue Jays', 'Golden Knights', 'Maple Leafs', 'Red Wings', 'Blue Jackets', 'Trail Blazers', 'Sky Blue', 'Red Bulls', 'Golden State'];
function _glShort(name) {
  name = String(name || '').trim();
  if (!name) return '';
  for (var i = 0; i < GL_TWO_WORD.length; i++) { if (name.slice(-GL_TWO_WORD[i].length) === GL_TWO_WORD[i]) return GL_TWO_WORD[i]; }
  name = name.replace(/^(FC|CF|SC) /, '').replace(/ (FC|SC|CF)$/, '');
  for (var j = 0; j < GL_TWO_WORD.length; j++) { if (name.slice(-GL_TWO_WORD[j].length) === GL_TWO_WORD[j]) return GL_TWO_WORD[j]; }
  var parts = name.split(' ');
  return parts[parts.length - 1];
}
function _glLeagueName(sport) {
  var s = (typeof GAMES_SPORTS !== 'undefined' ? GAMES_SPORTS : []).filter(function (x) { return x.key === sport; })[0];
  return s ? (s.key === 'cfb' ? 'CFB' : s.name) : String(sport || '').toUpperCase();
}
function _glColors(sport, abbr, color, alt) {
  try {
    if (sport === 'mlb' && typeof _ghTeamColors === 'function') return _ghTeamColors(abbr);
    if (typeof _gxColors === 'function') return _gxColors(sport, abbr, color, alt);
  } catch (e) {}
  return { bg: '#3D3580', fg: '#FFFFFF', accent: '#A89FE8' };
}
function _glIsLive(sport, g) {
  if (!g) return false;
  if (g.state) return g.state === 'in';
  return typeof _isGameStatusLive === 'function' && !(typeof _isGameConcluded === 'function' && _isGameConcluded(g.status)) && _isGameStatusLive(g.status);
}
function _glActive(id) { var el = _gl$('screen-' + id); return !!(el && el.classList.contains('active')); }
function _glInitials(name) { return typeof _initials === 'function' ? _initials(name) : String(name || '?').charAt(0).toUpperCase(); }
function _glBasesSvg(b) {
  b = b || {};
  var on = '#F4F2FF', off = 'none', st = 'rgba(244,242,255,.45)';
  return '<svg width="26" height="19" viewBox="0 0 46 34" aria-hidden="true">' +
    '<rect x="18" y="3" width="10" height="10" transform="rotate(45 23 8)" fill="' + (b.second ? on : off) + '" stroke="' + (b.second ? on : st) + '" stroke-width="2"/>' +
    '<rect x="31" y="15" width="10" height="10" transform="rotate(45 36 20)" fill="' + (b.first ? on : off) + '" stroke="' + (b.first ? on : st) + '" stroke-width="2"/>' +
    '<rect x="5" y="15" width="10" height="10" transform="rotate(45 10 20)" fill="' + (b.third ? on : off) + '" stroke="' + (b.third ? on : st) + '" stroke-width="2"/></svg>';
}
var GL_ICON = {
  bell: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="7" height="9" rx="2"/><rect x="13" y="4" width="7" height="5" rx="2"/><rect x="13" y="11" width="7" height="9" rx="2"/><rect x="4" y="15" width="7" height="5" rx="2"/></svg>',
  games: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="6.5" y1="10" x2="8.5" y2="10"/><line x1="15.5" y1="10" x2="17.5" y2="10"/></svg>',
  friends: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3.5 5.5"/></svg>',
  arch: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.7z"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  addUser: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>',
  chev: '<svg class="gl-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>',
  down: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>',
  chat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z"/></svg>',
  layout: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
};

// ── Profile › Layout (shows in both layouts so you can always flip back) ──
function _glLayoutRowHtml() {
  var g = !!window.INNINGS_GLASS;
  return '<div class="gl-prow" style="cursor:default"><span class="ic">' + GL_ICON.layout + '</span>' +
    '<span class="tx"><b>Layout</b><small>' + (g ? 'The new look. Classic is one tap away.' : 'Classic. The new look is one tap away.') + '</small></span>' +
    '<span class="gl-seg2" role="group" aria-label="Layout"><button class="' + (g ? 'on' : '') + '" aria-pressed="' + g + '" onclick="glassSetLayout(\'glass\')">New</button>' +
    '<button class="' + (g ? '' : 'on') + '" aria-pressed="' + !g + '" onclick="glassSetLayout(\'classic\')">Classic</button></span></div>';
}
function _glProfileRows() {
  var stamp = _gl$('profile-build-stamp');
  if (!stamp || _gl$('gl-prows')) return;
  var box = document.createElement('div');
  box.id = 'gl-prows'; box.className = 'gl-prows';
  box.innerHTML = (window.INNINGS_GLASS
    ? '<button class="gl-prow" onclick="nav(\'friends\')"><span class="ic">' + GL_ICON.friends + '</span><span class="tx"><b>Friends and groups</b><small>Your people, plans and group chats</small></span>' + GL_ICON.chev + '</button>' +
      '<button class="gl-prow" onclick="nav(\'feedback-group\')"><span class="ic">' + GL_ICON.chat + '</span><span class="tx"><b>Feedback for Nate</b><small>Pros, cons, bugs, suggestions</small></span>' + GL_ICON.chev + '</button>'
    : '') + _glLayoutRowHtml();
  var privacy = stamp.previousElementSibling;
  stamp.parentNode.insertBefore(box, privacy || stamp);
}

// ══ setup ══════════════════════════════════════════════════════════════
(function () {
  _glProfileRows();
  if (!window.INNINGS_GLASS) return;
  var root = document.documentElement;
  var app = document.querySelector('.app');
  if (!app) return;
  root.classList.add('glass');

  // The Feed's desktop rail would pull "Watching" back out of Friends —
  // undo it if it already ran, and keep it from running again.
  try {
    if (typeof _deskFeedLayout === 'function' && _gl$('feed-desk-main')) _deskFeedLayout(false);
    window._deskFeedLayout = function () {};
  } catch (e) { console.error('[glass] desk feed', e); }

  // ── Home ──
  var home = document.createElement('div');
  home.className = 'screen'; home.id = 'screen-home';
  home.innerHTML = '<div class="gl-amb"><i class="b1" id="gl-amb1"></i><i class="b2" id="gl-amb2"></i><i class="b3"></i></div>' +
    '<div class="gl-top"><div class="gl-hd"><small id="gl-date"></small><b id="gl-hey">Hey there</b></div>' +
    '<button class="gl-ib" id="glass-bell" onclick="nav(\'notifications\')" aria-label="Notifications">' + GL_ICON.bell + '<span class="gl-dot"></span></button>' +
    '<button class="gl-me" id="glass-me" onclick="nav(\'profile\')" aria-label="Your profile">?</button></div>' +
    '<div class="gl-scroll scroll-bare" id="gl-home-body"><div class="gl-bento">' +
    '<div class="gl-c2" id="gl-hero" style="display:none"></div>' +
    '<div class="gl-c2" id="gl-live" style="display:none"></div>' +
    '<div class="gl-c2" id="gl-gamescta" style="display:none"></div>' +
    '<div id="gl-tonight" style="display:none"></div>' +
    '<div id="gl-recaps" style="display:none"></div>' +
    '<div class="gl-c2" id="gl-coming"></div>' +
    '<div class="gl-c2" id="gl-otd" style="display:none"></div>' +
    '<div class="gl-c2 gl-desk" id="gl-recent"><div class="gl-g" style="cursor:default"><div id="feed-rail-recent"></div></div></div>' +
    '</div></div>';
  app.appendChild(home);

  // ── Friends ──
  var fr = document.createElement('div');
  fr.className = 'screen'; fr.id = 'screen-friends';
  fr.innerHTML = '<div class="gl-amb"><i class="b1"></i><i class="b2"></i></div>' +
    '<div class="gl-top"><div class="gl-hd"><small>Your people</small><b>Friends</b></div>' +
    '<button class="gl-ib" onclick="showAddFriendsSheet()" aria-label="Add friends">' + GL_ICON.addUser + '</button></div>' +
    '<div class="gl-scroll scroll-bare" id="gl-friends-body">' +
    '<div class="gl-sec" id="glf-friends"></div><div class="gl-sec" id="glf-watch"></div>' +
    '<div class="gl-sec" id="glf-coming"></div><div class="gl-sec" id="glf-groups"></div></div>';
  app.appendChild(fr);
  var move = function (el, host) { if (el && host) host.appendChild(el); };
  var headerBefore = function (el, text) { var p = el && el.previousElementSibling; return p && p.textContent.indexOf(text) !== -1 ? p : null; };
  try {
    var fl = _gl$('my-friends-list');
    move(headerBefore(fl, 'Friends'), _gl$('glf-friends')); move(fl, _gl$('glf-friends')); move(_gl$('my-friends-empty'), _gl$('glf-friends'));
    move(_gl$('feed-live-feed-section'), _gl$('glf-watch'));
    var ul = _gl$('feed-upcoming-list');
    move(headerBefore(ul, 'Coming up'), _gl$('glf-coming')); move(ul, _gl$('glf-coming')); move(_gl$('feed-upcoming-empty'), _gl$('glf-coming'));
    var gl = _gl$('my-groups-list');
    move(headerBefore(gl, 'groups'), _gl$('glf-groups')); move(gl, _gl$('glf-groups')); move(_gl$('my-groups-empty'), _gl$('glf-groups'));
    _gl$('glf-groups').insertAdjacentHTML('beforeend', '<button class="gl-row" onclick="nav(\'feedback-group\')"><span class="ic">' + GL_ICON.chat + '</span><span class="tx"><b>Feedback for Nate</b><small>Pros, cons, bugs, suggestions</small></span>' + GL_ICON.chev + '</button>');
    // Sheets that lived inside Profile have to sit above every screen now
    ['all-friends-overlay', 'add-friends-sheet', 'new-group-modal'].forEach(function (id) { move(_gl$(id), app); });
  } catch (e) { console.error('[glass] friends move', e); }

  // ── Archive: Memories | Calendar ──
  try {
    [['memories', document.querySelector('#screen-memories .imm-body')], ['calendar', _gl$('cal-content')]].forEach(function (x) {
      if (!x[1]) return;
      var seg = document.createElement('div');
      seg.className = 'gl-arch'; seg.setAttribute('role', 'tablist');
      seg.innerHTML = '<button role="tab" class="' + (x[0] === 'memories' ? 'on' : '') + '" aria-selected="' + (x[0] === 'memories') + '" onclick="glassArchive(\'memories\')">Memories</button>' +
        '<button role="tab" class="' + (x[0] === 'calendar' ? 'on' : '') + '" aria-selected="' + (x[0] === 'calendar') + '" onclick="glassArchive(\'calendar\')">Calendar</button>';
      x[1].parentNode.insertBefore(seg, x[1]);
    });
  } catch (e) { console.error('[glass] archive', e); }

  // ── Games: the back arrow and a league pill both open the league picker ──
  try {
    var gHdr = _gl$('screen-games') && _gl$('screen-games').firstElementChild;
    var gBack = gHdr && gHdr.querySelector('button');
    if (gBack) { gBack.setAttribute('onclick', 'closeCalendar();glassLeagues()'); gBack.setAttribute('aria-label', 'All leagues'); }
    var gTitle = gBack && gBack.nextElementSibling;
    if (gTitle) gTitle.insertAdjacentHTML('afterend', '<button class="gl-league" onclick="closeCalendar();glassLeagues()" aria-label="Change league"><span id="gl-league-name">MLB</span>' + GL_ICON.down + '</button>');
    var pHdr = _gl$('screen-games-picker') && _gl$('screen-games-picker').firstElementChild;
    var pBack = pHdr && pHdr.querySelector('button');
    if (pBack) pBack.style.display = 'none';
    var nBack = _gl$('screen-notifications') && _gl$('screen-notifications').querySelector('button');
    if (nBack && nBack.lastChild && nBack.lastChild.nodeType === 3) nBack.lastChild.nodeValue = ' Back';
  } catch (e) { console.error('[glass] games header', e); }

  // ── the glass tab bar ──
  var dock = document.createElement('nav');
  dock.id = 'glass-dock'; dock.setAttribute('aria-label', 'Main');
  dock.innerHTML =
    '<button class="gd-b" id="gld-home" onclick="nav(\'home\')">' + GL_ICON.home + 'Home</button>' +
    '<button class="gd-b" id="gld-games" onclick="glassGames()">' + GL_ICON.games + 'Games</button>' +
    '<button class="gd-b" id="gld-friends" onclick="nav(\'friends\')">' + GL_ICON.friends + 'Friends</button>' +
    '<button class="gd-b" id="gld-arch" onclick="glassArchive()">' + GL_ICON.arch + 'Archive</button>' +
    '<button class="gd-fab" onclick="nav(\'create-group\')" aria-label="Save a moment">' + GL_ICON.plus + '</button>';
  app.appendChild(dock);

  // ── iPad / desktop sidebar: Home, Games (now on iPad too), Friends ──
  try {
    var fb = _gl$('ipad-nav-feed');
    if (fb) {
      fb.id = 'ipad-nav-home'; fb.setAttribute('onclick', "nav('home')"); fb.setAttribute('aria-label', 'Home');
      fb.innerHTML = GL_ICON.home.replace('width="22" height="22"', 'width="20" height="20"') + '<span>Home</span>';
    }
    var gb = _gl$('ipad-nav-games');
    if (gb) {
      gb.classList.remove('desk-only'); gb.setAttribute('onclick', 'glassGames()');
      gb.insertAdjacentHTML('afterend', '<button class="ipad-nav-item" id="ipad-nav-friends" onclick="nav(\'friends\')" aria-label="Friends">' + GL_ICON.friends.replace('width="22" height="22"', 'width="20" height="20"') + '<span>Friends</span></button>');
    }
    if (typeof IPAD_SIDENAV_TABS !== 'undefined') IPAD_SIDENAV_TABS.push('home', 'friends');
  } catch (e) { console.error('[glass] sidebar', e); }

  // ── routing: the Feed becomes Home; tabs light up; screens load ──
  var prevApply = _navApplyScreen;
  window._navApplyScreen = function (id) {
    if (id === 'feed') id = 'home';
    var out = prevApply.call(this, id);
    try { _glAfterNav(id); } catch (e) { console.error('[glass] after nav', e); }
    return out;
  };

  // ── feeds into Home ──
  try {
    var prevBadge = _renderNotifBadge;
    window._renderNotifBadge = function (count) { var o = prevBadge.apply(this, arguments); window._glUnread = count; _glBell(); return o; };
  } catch (e) {}
  try {
    var prevOtd = _otdRenderBanner;
    window._otdRenderBanner = function () { var o = prevOtd.apply(this, arguments); _glRenderOtd(); return o; };
  } catch (e) {}
  try {
    var prevRings = _rcRenderRings;
    window._rcRenderRings = function () { var o = prevRings.apply(this, arguments); _glRenderRecaps(); return o; };
  } catch (e) {}
  try {
    var prevProf = ib_setProfileDisplay;
    window.ib_setProfileDisplay = function () { var o = prevProf.apply(this, arguments); _glHeader(); return o; };
    var prevPhotos = renderProfilePhotos;
    window.renderProfilePhotos = function () { var o = prevPhotos.apply(this, arguments); _glHeader(); return o; };
  } catch (e) {}
  // The Watching list and the Coming-up list re-render on their own timers;
  // Home follows them rather than fetching the same things twice.
  var schedule = function (fn) { var t = null; return function () { if (t) return; t = requestAnimationFrame(function () { t = null; try { fn(); } catch (e) { console.error('[glass] render', e); } }); }; };
  var heroRender = schedule(function () { _glRenderHero(); _glRenderLive(); });
  var comingRender = schedule(_glRenderComing);
  try {
    var wl = _gl$('feed-live-feed-list'), ws = _gl$('feed-live-feed-section');
    if (wl) new MutationObserver(heroRender).observe(wl, { childList: true });
    if (ws) new MutationObserver(heroRender).observe(ws, { attributes: true, attributeFilter: ['style'] });
    var cl = _gl$('feed-upcoming-list');
    if (cl) new MutationObserver(comingRender).observe(cl, { childList: true });
  } catch (e) { console.error('[glass] observers', e); }
  setInterval(function () { if (!document.hidden && _glActive('home')) _glLoadLive(true); }, 30000);
  _glHeader();
  _glRenderComing();
})();

// ── navigation hooks ──
var GL_TAB_OF = { home: 'home', 'games-picker': 'games', games: 'games', 'games-soon': 'games', friends: 'friends', memories: 'arch', calendar: 'arch', profile: '' };
function _glAfterNav(id) {
  var docked = Object.prototype.hasOwnProperty.call(GL_TAB_OF, id);
  document.documentElement.classList.toggle('gd-on', docked);
  ['home', 'games', 'friends', 'arch'].forEach(function (t) { var b = _gl$('gld-' + t); if (b) { var on = GL_TAB_OF[id] === t; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); } });
  if (id === 'memories' || id === 'calendar') window._glArchLast = id;
  if (id === 'home') _glHomeOpen();
  if (id === 'friends') _glFriendsOpen();
  if (id === 'games') { var n = _gl$('gl-league-name'); if (n) n.textContent = _glLeagueName(window._gamesSport || 'mlb'); }
}
function glassGames() {
  if (!window._glGamesOnce && typeof playSportsHub === 'function') { window._glGamesOnce = true; playSportsHub(); return; }
  window._glGamesOnce = true;
  nav(window._gamesSport ? 'games' : 'games-picker');
}
function glassLeagues() { nav('games-picker'); }
function glassArchive(which) { nav(which || window._glArchLast || 'memories'); }

function _glHomeOpen() {
  _glHeader();
  if (typeof loadFeedMoments === 'function') loadFeedMoments();
  if (typeof startWatchingList === 'function') {
    if (window._watchingStarted && typeof renderLiveFeed === 'function') renderLiveFeed(); else startWatchingList();
  }
  if (typeof loadOnThisDay === 'function') loadOnThisDay();
  if (typeof recapsRefresh === 'function') { try { recapsRefresh(); } catch (e) {} }
  _glLoadLive(false);
  _glRenderHero(); _glRenderLive(); _glRenderTonight(); _glRenderRecaps(); _glRenderComing(); _glRenderOtd(); _glBell();
  // Desktop keeps its "Recent memories" list (it used to sit in the Feed's side rail)
  if (typeof _isDesk === 'function' && _isDesk() && typeof _deskRenderRail === 'function') { try { _deskRenderRail(); } catch (e) {} }
}
function _glFriendsOpen() {
  if (typeof loadMyFriendsList === 'function') loadMyFriendsList();
  if (typeof loadMyGroups === 'function') loadMyGroups();
  if (typeof loadFeedMoments === 'function') loadFeedMoments();
  if (typeof startWatchingList === 'function') {
    if (window._watchingStarted && typeof renderLiveFeed === 'function') renderLiveFeed(); else startWatchingList();
  }
}

// ── header: date, hello, bell, you ──
function _glHeader() {
  var d = _gl$('gl-date'), hey = _gl$('gl-hey'), me = _gl$('glass-me');
  if (d) d.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  var ud = window.userData || {};
  var first = String(ud.name || '').trim().split(/\s+/)[0];
  if (hey) hey.textContent = first ? 'Hey, ' + first : 'Hey there';
  if (me) {
    var photo = (window._profilePhotos || [])[0] || (ud.profilePhotos || [])[0] || ud.profilePhoto || null;
    if (photo) { me.style.backgroundImage = 'url("' + String(photo).replace(/"/g, '%22') + '")'; me.textContent = ''; }
    else { me.style.backgroundImage = ''; me.textContent = ud.name ? _glInitials(ud.name) : '?'; }
  }
  _glBell();
}
function _glBell() {
  var b = _gl$('glass-bell');
  if (!b) return;
  var n = window._glUnread || 0;
  b.classList.toggle('has', n > 0);
  b.setAttribute('aria-label', n > 0 ? 'Notifications, ' + n + ' new' : 'Notifications');
}

// ── the game your friends are in (top of the Watching list) ──
function _glSituation(sport, box) {
  if (!box) return '';
  var s = box.situation;
  if (sport === 'mlb' && s && s.inning) {
    var st = s.inningState === 'Middle' ? 'Mid' : s.inningState === 'End' ? 'End' : (s.half === 'top' ? 'Top' : 'Bot');
    var between = st === 'Mid' || st === 'End';
    return st + ' ' + s.inning + (!between && s.outs != null ? ' · ' + s.outs + ' out' + (s.outs === 1 ? '' : 's') : '');
  }
  return box.statusDetail || box.status || 'Live';
}
function _glRenderHero() {
  var el = _gl$('gl-hero');
  if (!el) return;
  var list = window._liveFeedCache || [];
  var r = list[0];
  if (!r) { el.style.display = 'none'; el.innerHTML = ''; _glAmbient(null); _glGamesCta(); return; }
  var box = r.box || {}, sport = (r.g && r.g.sport) || 'mlb';
  var away = box.away || (r.g && r.g.away) || 'Away', homeN = box.home || (r.g && r.g.home) || 'Home';
  var aAb = box.awayAbbr || (typeof _ghAbbrFallback === 'function' ? _ghAbbrFallback(away) : away.slice(0, 3).toUpperCase());
  var hAb = box.homeAbbr || (typeof _ghAbbrFallback === 'function' ? _ghAbbrFallback(homeN) : homeN.slice(0, 3).toUpperCase());
  var ca = _glColors(sport, aAb, box.awayColor, box.awayAlt), ch = _glColors(sport, hAb, box.homeColor, box.homeAlt);
  var live = r.state === 'live';
  var hasScore = live && box.awayScore != null && box.homeScore != null;
  var aLead = hasScore && Number(box.awayScore) > Number(box.homeScore), hLead = hasScore && Number(box.homeScore) > Number(box.awayScore);
  var mid = hasScore
    ? '<div class="gl-sc gl-num"><span class="' + (hLead ? 'dim' : '') + '">' + _glEsc(box.awayScore) + '</span><i></i><span class="' + (aLead ? 'dim' : '') + '">' + _glEsc(box.homeScore) + '</span></div>'
    : '<div class="gl-sc gl-num sm">VS</div>';
  var sit = live ? _glEsc(_glSituation(sport, box)) + (sport === 'mlb' && box.situation && box.situation.bases ? _glBasesSvg(box.situation.bases) : '')
    : _glEsc(box.startTime && typeof _formatGameTime === 'function' ? 'Starts ' + _formatGameTime(box.startTime) : 'Starting soon');
  var names = (r.uids || []).map(function (u) { return (window._friendNameCache || {})[u] || 'A friend'; });
  var label = names.length ? (r.mine ? _friendsWatchingLabel(names) : _friendsOnlyWatchingLabel(names)) : 'You’re watching';
  var avs = names.slice(0, 2).map(function (n) { return '<span class="gl-av">' + _glEsc(_glInitials(n)) + '</span>'; }).join('') + (names.length > 2 ? '<span class="gl-av">+' + (names.length - 2) + '</span>' : '');
  el.innerHTML = '<button class="gl-g gl-hero" onclick="openLiveFeedGame(0)" aria-label="' + _glEsc(away + ' at ' + homeN) + '">' +
    '<div class="gl-lh"><span class="gl-lab">' + (live ? '<span class="gl-ldot"></span>Live' : 'Up next') + '</span><span class="gl-lab">' + _glEsc(_glLeagueName(sport)) + '</span></div>' +
    '<div class="gl-board">' +
      '<div class="gl-team"><span class="gl-d" style="background:' + ca.bg + ';color:' + ca.fg + '">' + _glEsc(aAb) + '</span><span>' + _glEsc(_glShort(away)) + '</span></div>' +
      '<div class="gl-score">' + mid + '<div class="gl-inn">' + sit + '</div></div>' +
      '<div class="gl-team"><span class="gl-d" style="background:' + ch.bg + ';color:' + ch.fg + '">' + _glEsc(hAb) + '</span><span>' + _glEsc(_glShort(homeN)) + '</span></div>' +
    '</div>' +
    '<div class="gl-lf">' + (avs ? '<div class="gl-avs">' + avs + '</div>' : '') + '<p>' + _glEsc(label) + '</p><span class="gl-join">' + (live ? 'Join' : 'Open') + '</span></div>' +
    '</button>' +
    (list.length > 1 ? '<div style="text-align:right;padding:6px 6px 0"><button class="gl-more" onclick="nav(\'friends\')">+' + (list.length - 1) + ' more on your list ›</button></div>' : '');
  el.style.display = '';
  _glAmbient(live ? [ca.bg, ch.bg] : null);
  _glGamesCta();
}
function _glAmbient(cols) {
  var a = _gl$('gl-amb1'), b = _gl$('gl-amb2');
  if (!a || !b) return;
  a.style.background = cols ? cols[0] : '';
  b.style.background = cols ? cols[1] : '';
}

// ── Live now · every sport ──
function _glLoadLive(force) {
  if (typeof _bsModalScheduleUrl !== 'function' || typeof GAMES_SPORTS === 'undefined') return;
  if (!force && window._glLiveAt && Date.now() - window._glLiveAt < 25000) return;
  window._glLiveAt = Date.now();
  var today = _todayLocal();
  Promise.all(GAMES_SPORTS.map(function (s) {
    return fetch(_bsModalScheduleUrl(s.key, today))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return { sport: s.key, games: (d && d.games) || [] }; })
      .catch(function () { return { sport: s.key, games: [] }; });
  })).then(function (res) {
    window._glSched = res;
    var live = [];
    res.forEach(function (x) { x.games.forEach(function (g) { if (_glIsLive(x.sport, g)) live.push({ sport: x.sport, g: g }); }); });
    window._glLive = live;
    window._glLiveLoaded = true;
    _glRenderLive();
    _glComputeTonight();
  });
}
function _glFriendsOn(gamePk) {
  var key = String(gamePk);
  var by = (window._friendsWatchingCache && window._friendsWatchingCache.byGame) || {};
  var uids = (by[key] && by[key].uids) || [];
  var mine = (window._watchingList || []).some(function (w) { return String(w.gamePk != null ? w.gamePk : w._id) === key; });
  return { names: uids.map(function (u) { return (window._friendNameCache || {})[u] || 'A friend'; }), mine: mine };
}
function _glLiveStatus(sport, g) {
  if (sport === 'mlb') {
    var half = { Top: 'Top', Bottom: 'Bot', Middle: 'Mid', End: 'End' }[g.inningHalf] || '';
    if (half && g.inning) return half + ' ' + g.inning;
    return g.status || 'Live';
  }
  return g.statusDetail || g.status || 'Live';
}
function glassLiveFilter(f) { window._glLiveFilter = f; _glRenderLive(); }
function _glRenderLive() {
  var el = _gl$('gl-live');
  if (!el) return;
  var all = window._glLive || [];
  if (!all.length) { el.style.display = 'none'; el.innerHTML = ''; _glGamesCta(); return; }
  var counts = {};
  all.forEach(function (x) { counts[x.sport] = (counts[x.sport] || 0) + 1; });
  var f = window._glLiveFilter && counts[window._glLiveFilter] ? window._glLiveFilter : 'all';
  var order = GAMES_SPORTS.map(function (s) { return s.key; });
  var rows = all.filter(function (x) { return f === 'all' || x.sport === f; }).map(function (x) {
    var fw = _glFriendsOn(x.g.gamePk);
    return { x: x, fw: fw, rank: (fw.names.length || fw.mine ? 0 : 1) * 100 + order.indexOf(x.sport) };
  }).sort(function (a, b) { return a.rank - b.rank; });
  window._glLiveShown = rows.map(function (r) { return r.x; });
  var chips = '<button class="gl-lchip' + (f === 'all' ? ' on' : '') + '" aria-pressed="' + (f === 'all') + '" onclick="glassLiveFilter(\'all\')">All<i>' + all.length + '</i></button>' +
    order.filter(function (k) { return counts[k]; }).map(function (k) {
      return '<button class="gl-lchip' + (f === k ? ' on' : '') + '" aria-pressed="' + (f === k) + '" onclick="glassLiveFilter(\'' + k + '\')">' + _glEsc(_glLeagueName(k)) + '<i>' + counts[k] + '</i></button>';
    }).join('');
  var body = rows.map(function (r, i) {
    var g = r.x.g, sp = r.x.sport;
    var aAb = g.awayAbbr || (typeof _ghAbbrFallback === 'function' ? _ghAbbrFallback(g.away) : ''), hAb = g.homeAbbr || (typeof _ghAbbrFallback === 'function' ? _ghAbbrFallback(g.home) : '');
    var ca = _glColors(sp, aAb, g.awayColor, g.awayAlt), ch = _glColors(sp, hAb, g.homeColor, g.homeAlt);
    var as = g.awayScore, hs = g.homeScore, scored = as != null && hs != null;
    var aLo = scored && Number(as) < Number(hs), hLo = scored && Number(hs) < Number(as);
    var sub = r.fw.names.length ? r.fw.names[0] + (r.fw.names.length > 1 ? ' + ' + (r.fw.names.length - 1) : '') + ' here'
      : r.fw.mine ? 'You’re watching'
      : (sp === 'mlb' && g.gameType && typeof _psName === 'function' ? _psName(g) + (g.seriesGameNumber ? ' · G' + g.seriesGameNumber : '') : '');
    return '<button class="gl-lrow" onclick="glassOpenLive(' + i + ')" aria-label="' + _glEsc((g.away || '') + ' at ' + (g.home || '')) + '">' +
      '<span class="lg">' + _glEsc(_glLeagueName(sp)) + '</span>' +
      '<span class="tms"><span class="gl-tl' + (aLo ? ' lo' : '') + '"><span class="sw" style="background:' + ca.accent + '"></span><span class="ab">' + _glEsc(_glShort(g.away)) + '</span><span class="sc gl-num">' + (scored ? _glEsc(as) : '') + '</span></span>' +
      '<span class="gl-tl' + (hLo ? ' lo' : '') + '"><span class="sw" style="background:' + ch.accent + '"></span><span class="ab">' + _glEsc(_glShort(g.home)) + '</span><span class="sc gl-num">' + (scored ? _glEsc(hs) : '') + '</span></span></span>' +
      '<span class="st">' + _glEsc(_glLiveStatus(sp, g)) + (sub ? '<small class="' + (r.fw.names.length || r.fw.mine ? 'fr' : '') + '">' + _glEsc(sub) + '</small>' : '') + '</span></button>';
  }).join('');
  el.innerHTML = '<div class="gl-g gl-live"><div class="gl-lh"><span class="gl-lab"><span class="gl-ldot"></span>Live now · every sport</span><span class="gl-lab">' + all.length + (all.length === 1 ? ' game' : ' games') + '</span></div>' +
    (Object.keys(counts).length > 1 ? '<div class="gl-lchips">' + chips + '</div>' : '') + '<div>' + body + '</div></div>';
  el.style.display = '';
  _glGamesCta();
}
function glassOpenLive(i) {
  var x = (window._glLiveShown || [])[i];
  if (!x || typeof openGameScreen !== 'function') return;
  openGameScreen(x.g.gamePk, x.g.away, x.g.home, x.sport, _todayLocal());
}
// When nothing is live, Home still points you at today's games
function _glGamesCta() {
  var el = _gl$('gl-gamescta');
  if (!el) return;
  var hero = _gl$('gl-hero'), live = _gl$('gl-live');
  var empty = (!hero || hero.style.display === 'none') && (!live || live.style.display === 'none');
  if (!empty || !window._glLiveLoaded) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.innerHTML = '<button class="gl-g" onclick="glassGames()" style="flex-direction:row;align-items:center;gap:14px"><span style="flex:1;min-width:0"><span class="gl-lab">Nothing live right now</span><b style="display:block;font-size:19px;font-weight:700;letter-spacing:-.3px;margin-top:6px">Today’s games</b><small style="display:block;font-size:12.5px;color:rgba(244,242,255,.62);margin-top:3px">Every league, your teams, last night’s recaps</small></span>' + GL_ICON.chev + '</button>';
  el.style.display = '';
}

// ── Tonight: the next game for your favorite or followed teams ──
function _glComputeTonight() {
  var sched = window._glSched || [];
  if (!sched.length || typeof _loadFavTeams !== 'function') return;
  Promise.all(sched.map(function (x) {
    return _loadFavTeams(x.sport).then(function (f) { return { sport: x.sport, games: x.games, fav: f || { favorite: null, following: [] } }; })
      .catch(function () { return { sport: x.sport, games: x.games, fav: { favorite: null, following: [] } }; });
  })).then(function (arr) {
    var pick = null;
    arr.forEach(function (x) {
      x.games.forEach(function (g) {
        var involves = function (t) { return !!t && (g.away === t || g.home === t); };
        var isFav = involves(x.fav.favorite), team = isFav ? x.fav.favorite : (x.fav.following || []).filter(involves)[0];
        if (!team || (typeof _isGameConcluded === 'function' && _isGameConcluded(g.status))) return;
        var live = _glIsLive(x.sport, g), t = Date.parse(g.startTime || '') || 0;
        var score = (live ? 0 : 1) * 1e13 + (isFav ? 0 : 5e12) + t;
        if (!pick || score < pick.score) pick = { sport: x.sport, g: g, fav: isFav, live: live, team: team, score: score };
      });
    });
    window._glTonight = pick;
    _glRenderTonight();
  });
}
function glassOpenTonight() {
  var p = window._glTonight;
  if (p && typeof openGameScreen === 'function') openGameScreen(p.g.gamePk, p.g.away, p.g.home, p.sport, _todayLocal());
}
function _glRenderTonight() {
  var el = _gl$('gl-tonight');
  if (!el) return;
  var p = window._glTonight;
  if (!p) { el.style.display = 'none'; el.innerHTML = ''; _glPairTiles(); return; }
  var g = p.g, home = g.home === p.team, opp = home ? g.away : g.home;
  var abbr = home ? g.homeAbbr : g.awayAbbr;
  var col = _glColors(p.sport, abbr || (typeof _ghAbbrFallback === 'function' ? _ghAbbrFallback(p.team) : ''), home ? g.homeColor : g.awayColor, home ? g.homeAlt : g.awayAlt);
  var when;
  if (p.live) when = '<span class="gl-ldot"></span>Live now';
  else {
    var d = new Date(g.startTime || '');
    var tm = typeof _formatGameTime === 'function' ? _formatGameTime(g.startTime) : '';
    when = (!isNaN(d.getTime()) && d.getHours() >= 17 ? 'Tonight' : 'Today') + (tm ? ' · ' + _glEsc(tm) : '');
  }
  var sub = p.live && g.awayScore != null && g.homeScore != null
    ? _glEsc(_glShort(g.away) + ' ' + g.awayScore + ', ' + _glShort(g.home) + ' ' + g.homeScore)
    : (home ? 'vs ' : 'at ') + _glEsc(_glShort(opp));
  el.innerHTML = '<button class="gl-g gl-sm" onclick="glassOpenTonight()"><span class="gl-lab">' + when + '</span>' +
    '<div><span class="gl-bar" style="background:' + col.accent + '"></span><b>' + _glEsc(_glShort(p.team)) + '</b><small>' + sub + '</small></div>' +
    '<span class="gl-lab">' + (p.fav ? '★ Your team' : 'Following') + ' · ' + _glEsc(_glLeagueName(p.sport)) + '</span></button>';
  el.style.display = '';
  _glPairTiles();
}

// ── Last night: the recap rings ──
function _glRenderRecaps() {
  var el = _gl$('gl-recaps');
  if (!el) return;
  var list = (window._rcOrders && window._rcOrders.p) || [];
  if (!list.length || typeof recapsOpen !== 'function') { el.style.display = 'none'; el.innerHTML = ''; _glPairTiles(); return; }
  var seen = typeof _rcSeen === 'function' ? _rcSeen() : {};
  var esc = typeof _rcEsc === 'function' ? _rcEsc : _glEsc;
  var wide = !_gl$('gl-tonight') || _gl$('gl-tonight').style.display === 'none';
  var rings = list.slice(0, wide ? 5 : 2).map(function (r, i) {
    var hg = r.hero && r._games && r._games[String(r.hero.gameId)];
    var w = hg && typeof _rcWinner === 'function' ? _rcWinner(hg) : null;
    var col = w && w.colors ? w.colors.bg : '#3D3580';
    return '<button class="rc-ring' + (seen[r.id] ? ' rc-seen' : '') + '" onclick="recapsOpen(' + i + ',\'p\')" aria-label="' + esc(r.title || '') + ' recap">' +
      '<span class="rc-r"><span class="rc-in" style="background:radial-gradient(circle at 30% 30%,' + col + ',#140E34)">' + (r._emoji || '') + '<b>' + esc((r.ring && r.ring.sub) || '') + '</b></span></span>' +
      '<span class="rc-l">' + esc((r.ring && r.ring.label) || String(r.sport || '').toUpperCase()) + '</span></button>';
  }).join('');
  el.innerHTML = '<div class="gl-g gl-sm gl-rc" style="cursor:default"><span class="gl-lab">Last night</span><div class="rc-rings">' + rings + '</div><small style="margin:0">Quick recaps</small></div>';
  el.style.display = '';
  _glPairTiles();
}
// Tonight and Last night share a row; either one alone takes the full width
function _glPairTiles() {
  var t = _gl$('gl-tonight'), r = _gl$('gl-recaps');
  if (!t || !r) return;
  var tOn = t.style.display !== 'none', rOn = r.style.display !== 'none';
  t.classList.toggle('gl-c2', tOn && !rOn);
  var rWas = r.classList.contains('gl-c2');
  r.classList.toggle('gl-c2', rOn && !tOn);
  if (rOn && rWas !== r.classList.contains('gl-c2')) _glRenderRecaps();
}

// ── Coming up (your plans and friends' public plans) ──
function _glRenderComing() {
  var el = _gl$('gl-coming');
  if (!el) return;
  var cache = window._feedMomentsCache;
  var head = function (right) { return '<div class="gl-lh"><span class="gl-lab">Coming up</span>' + (right || '') + '</div>'; };
  if (!cache) { el.innerHTML = '<div class="gl-g gl-coming" style="cursor:default">' + head() + '<div class="gl-empty-note">Loading plans…</div></div>'; return; }
  var me = window.currentUser || (window.auth && window.auth.currentUser);
  var arr = Object.keys(cache).map(function (k) { return cache[k]; }).sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); });
  if (!arr.length) {
    el.innerHTML = '<div class="gl-g gl-coming" style="cursor:default">' + head() +
      '<div><b style="display:block;font-size:17px;font-weight:700">Nothing coming up yet</b><small style="display:block;font-size:12.5px;color:rgba(244,242,255,.62);margin-top:3px">Post something you’re going to — your circle can come along.</small></div>' +
      '<button class="gl-cta" onclick="startFuturePlan()">Post what’s coming up</button></div>';
    return;
  }
  var cols = arr.slice(0, 2).map(function (m) {
    var day = m.date ? String(Number(String(m.date).slice(8, 10))) : '·';
    var wd = '';
    if (m.date) { var d = new Date(m.date + 'T12:00:00'); if (!isNaN(d.getTime())) wd = d.toLocaleDateString(undefined, { weekday: 'short' }); }
    var by = me && m.ownerUid === me.uid ? 'Your plan' : (String(m.ownerName || 'A friend').split(' ')[0] + ' is going');
    return '<button class="gl-pc" data-id="' + _glEsc(m._id) + '" onclick="openFutureDetail(this.dataset.id)"><span class="gl-num">' + _glEsc(day) + '</span><p>' + _glEsc(m.title || 'Untitled plan') + '<small>' + _glEsc([wd, by].filter(Boolean).join(' · ')) + '</small></p></button>';
  }).join('');
  el.innerHTML = '<div class="gl-g gl-coming" style="cursor:default">' +
    head('<span style="display:flex;gap:6px">' + (arr.length > 2 ? '<button class="gl-more" onclick="nav(\'friends\')">All ' + arr.length + '</button>' : '') + '<button class="gl-plus" onclick="startFuturePlan()" aria-label="It’s coming up">＋ Plan</button></span>') +
    '<div class="gl-pcols">' + cols + '</div></div>';
}

// ── On this day ──
function _glRenderOtd() {
  var el = _gl$('gl-otd');
  if (!el) return;
  var items = (window._otd && window._otd.items) || [];
  if (!items.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  var m = items[0];
  var yy = '’' + String(m.date || '').slice(2, 4);
  var ago = typeof _otdAgo === 'function' && typeof _otdYearsAgo === 'function' ? _otdAgo(_otdYearsAgo(m)) : '';
  var who = typeof _otdWho === 'function' ? _otdWho(m) : '';
  var sub = [who, items.length > 1 ? '+' + (items.length - 1) + ' more' : ''].filter(Boolean).join(' · ');
  el.innerHTML = '<button class="gl-g gl-otd" onclick="openOnThisDay()"><span class="gl-num">' + _glEsc(yy) + '</span>' +
    '<span class="t"><span class="gl-lab">On this day' + (ago ? ' · ' + _glEsc(ago) : '') + '</span><b>' + _glEsc(m.name || 'A memory') + '</b>' + (sub ? '<small>' + _glEsc(sub) + '</small>' : '') + '</span>' + GL_ICON.chev + '</button>';
  el.style.display = '';
}
