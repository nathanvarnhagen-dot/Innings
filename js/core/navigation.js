// ── NAVIGATION HISTORY ──
// _navStack holds the trail of screens the user actually passed through via nav(),
// so navBack() can return to wherever they came from instead of a hardcoded screen.
// _navApplyScreen does the actual switching + per-screen side effects, with no
// history bookkeeping — used by nav()/navBack(), and by the few flows (view-profile,
// memory-detail) that already track their own bespoke "return to" destination and
// should not also push/pop the general stack.
window._navStack = window._navStack || [];
// One entry per 'game' on _navStack (v5.65.0): the game screen is a single
// instance, so going game → team → another game → back would otherwise land
// on the wrong game. navBack() reloads the one that was showing.
window._gameBackStack = window._gameBackStack || [];

// Keeps the iPad landscape sidebar's active pill in sync with whatever
// screen just became current. The sidebar is a single persistent element
// (unlike the phone bottom-nav, which is duplicated per screen with a
// hardcoded active item baked in) so this has to run on every navigation.
// Sub-screens with no direct sidebar tab (games, notifications, a memory
// detail, etc.) just clear the active state rather than force a guess.
var IPAD_SIDENAV_TABS=['feed','calendar','memories','profile'];
function _syncIpadNav(id){
  var nav=document.getElementById('ipad-sidenav');
  if(!nav) return;
  nav.querySelectorAll('.ipad-nav-item').forEach(function(btn){btn.classList.remove('active')});
  if(IPAD_SIDENAV_TABS.indexOf(id)!==-1){
    var active=document.getElementById('ipad-nav-'+id);
    if(active) active.classList.add('active');
  }
}
function _navApplyScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));var el=document.getElementById('screen-'+id);if(el)el.classList.add('active');_syncIpadNav(id);if(id==='memories'&&typeof loadMoments==='function')loadMoments();if(id==='profile'&&typeof loadMoments==='function')loadMoments();if(id==='profile'&&typeof loadMyGroups==='function')loadMyGroups();if(id==='profile'&&typeof loadMyFriendsList==='function')loadMyFriendsList();if(id==='calendar'&&typeof loadMoments==='function')loadMoments();if(id==='feed'&&typeof loadFeedMoments==='function')loadFeedMoments();if(id==='feed'&&typeof _applyOslBannerVisibility==='function')_applyOslBannerVisibility();if(id==='feed'&&typeof startWatchingList==='function')startWatchingList();if(id==='games'){if((window._gamesSport==='nfl'||window._gamesSport==='cfb')&&typeof loadFootballWeek==='function'){loadFootballWeek(window._gamesSport);}else if(typeof loadGamesList==='function'){loadGamesList();}}if(id==='games-picker'&&typeof renderGamesSportGrid==='function')renderGamesSportGrid();if(id==='games-soon'&&typeof renderGamesSoon==='function')renderGamesSoon();if(id==='feedback-group'&&typeof startFeedbackChat==='function')startFeedbackChat();if(id==='notifications'&&typeof loadNotifications==='function')loadNotifications();if(id==='osl-group'&&typeof oslCheckRsvp==='function')oslCheckRsvp();if(id==='osl-group'&&typeof startOslChat==='function')startOslChat();if(id==='osl-group'&&typeof _oslLandOnLineup==='function')_oslLandOnLineup();if(id==='birthday-group'&&typeof loadBirthdayEventData==='function'){loadBirthdayEventData(function(){if(typeof bdayCheckRsvp==='function')bdayCheckRsvp();if(typeof startBirthdayChat==='function')startBirthdayChat();if(typeof _bdayLandOnStops==='function')_bdayLandOnStops();if(typeof _bdayApplyEditVisibility==='function')_bdayApplyEditVisibility();if(typeof renderBdayMessage==='function')renderBdayMessage();});}if(id==='group-detail'&&window._activeGroup&&(window._activeGroup.features||[]).indexOf('chat')!==-1&&typeof startGroupChat==='function')startGroupChat(window._activeGroupId);if(id==='create-group'){var d=document.getElementById('moment-date');if(d&&!d.value)d.value=_todayLocal();if(typeof backToStep0==='function')backToStep0();if(typeof renderVibePills==='function')renderVibePills();}_nudgeScrollers(el);}

// A scrollable element that's hidden (opacity:0) and shown again can, on
// iOS Safari, get permanently stuck — no error, no console warning, taps
// still work, but the drag-to-scroll gesture never engages again until a
// full reload. Nudging scrollTop by a pixel and back forces WebKit to
// re-engage its momentum-scroll engine for that element. Runs on every
// screen transition, on whatever scrollable containers exist in the screen
// that just became active, as a blanket safeguard rather than chasing one
// specific trigger.
function _nudgeScrollers(screenEl){
  if (!screenEl) return;
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      // .scroll/.scroll-bare cover most screens, but several panels (all of
      // OSL's tab content among them) set overflow-y:auto directly as an
      // inline style instead of via those classes, so they were silently
      // never covered by this nudge at all — this catches those too.
      var scrollers = screenEl.querySelectorAll('.scroll, .scroll-bare, [style*="overflow-y:auto"], [style*="overflow-y: auto"], [style*="overflow-y:scroll"]');
      scrollers.forEach(function(s){
        var st = s.scrollTop;
        s.scrollTop = st + 1;
        s.scrollTop = st;
      });
    });
  });
}

// Tapped feed banner (OSL / Feedback): whole card presses down, icon pops
// with a quick spin, a soft glow pulses behind it — then we navigate in
function bannerNavWithPop(bannerEl, screenId){
  var icon = bannerEl.querySelector('.banner-pop-icon');
  var glow = bannerEl.querySelector('.banner-pop-glow');
  if (!icon) { nav(screenId); return; }
  bannerEl.classList.add('popping');
  icon.classList.add('popping');
  if (glow) glow.classList.add('popping');
  setTimeout(function(){
    nav(screenId);
    setTimeout(function(){
      bannerEl.classList.remove('popping');
      icon.classList.remove('popping');
      if (glow) glow.classList.remove('popping');
    }, 300);
  }, 260);
}

function nav(id){
  var current=document.querySelector('.screen.active');
  var currentId=current?current.id.replace('screen-',''):null;
  if(currentId&&currentId!==id){window._navStack.push(currentId);if(currentId==='game')window._gameBackStack.push(window._activeBrowseGame?Object.assign({},window._activeBrowseGame):null);}
  _navApplyScreen(id);
}

function navBack(fallback){
  var prev=window._navStack.pop();
  var g=prev==='game'?(window._gameBackStack.pop()||null):null;
  _navApplyScreen(prev||fallback||'feed');
  if(g&&(!window._activeBrowseGame||String(window._activeBrowseGame.gamePk)!==String(g.gamePk))&&typeof _showGameScreen==='function')_showGameScreen(g,false);
}

// The swipe-from-edge back gesture that used to live here has been removed
// while we track down a scroll-freeze bug — it was the newest thing
// listening on every touch across the whole app, and the most likely
// suspect. All the back buttons are untouched and still work normally.

// Plays the IN-badge splash, then calls cb (used right before landing on the feed post-login)
function playLoginSplash(cb){
  var el = document.getElementById('login-splash');
  if(!el){ if(cb) cb(); return; }
  el.classList.add('show');
  setTimeout(function(){
    el.classList.remove('show');
    if(cb) cb();
  }, 1100);
}
// Plays the home-plate splash that grows and opens up, then calls cb
// (used after finishing or dismissing the welcome-intro screen)
function playWelcomeHomeSplash(cb){
  var el = document.getElementById('welcome-home-splash');
  if(!el){ if(cb) cb(); return; }
  el.classList.add('show');
  setTimeout(function(){
    el.classList.add('grow');
    setTimeout(function(){
      el.classList.remove('show','grow');
      if(cb) cb();
    }, 750);
  }, 650);
}
let _photoCur=0, _photoTimer=null;
function _startPhotoRotation(){
  if(_photoTimer) clearInterval(_photoTimer);
  _photoCur=0;
  _photoTimer=setInterval(function(){
    var sl=document.querySelectorAll('#photo-slides .photo-slide');
    var dt=document.querySelectorAll('#photo-dots .pdot');
    if(sl.length<2) return;
    sl[_photoCur].classList.remove('active'); if(dt[_photoCur]) dt[_photoCur].classList.remove('active');
    _photoCur=(_photoCur+1)%sl.length;
    sl[_photoCur].classList.add('active'); if(dt[_photoCur]) dt[_photoCur].classList.add('active');
  },3000);
}
_startPhotoRotation();
