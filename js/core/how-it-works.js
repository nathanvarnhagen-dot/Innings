// ══ HOW IT WORKS (v7.79.0) ═══════════════════════════════════════════════
// A short animated walkthrough for every page, plus one for a brand-new
// person's first launch. Each walkthrough is 4 steps; each step draws the
// real page (the app's own classes and markup, demo data) and plays the taps
// on it: a finger ring lands on what to press, then what happens appears.
//
//   · First time you open a page → its walkthrough plays once.
//   · The ? on a page replays it anytime.
//   · Seen ones are remembered on this phone and on your account
//     (localStorage innings_hiw_seen + users/{uid}.hiwSeen).
//
// Scenes live in js/core/how-it-works-scenes.js (hiwRegister). Inside a
// scene's markup:
//   data-at="900"        hidden until 900ms into the step, then fades up
//   data-off="2400"      fades out at 2400ms
//   data-add="1600:on"   adds class "on" at 1600ms (state changes)
//   data-type="1200"     types its text in from 1200ms
//   <i class="hiw-tap" data-at="1400" data-on="#target"></i>
//                        a finger tap centered on #target (inside the stage)
//                        data-kind="dtap" double tap · "hold" press and hold
//                        data-dx="120" swipe that far (px, negative = left)
(function () {
  var REG = {};
  var SEEN_KEY = 'innings_hiw_seen';
  var STEP_MS = 4200;
  var cur = null; // { key, def, i, timers[], el }

  window.hiwRegister = function (key, def) { REG[key] = def; };
  window.hiwHas = function (key) { return !!REG[key]; };

  // ── seen bookkeeping ──────────────────────────────────────────────────
  function seenMap() {
    var m = {};
    try { m = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch (e) {}
    var ud = window.userData && window.userData.hiwSeen;
    if (ud) for (var k in ud) if (ud[k]) m[k] = 1;
    return m;
  }
  function hiwSeen(key) { return !!seenMap()[key]; }
  function markSeen(key) {
    var m = seenMap(); m[key] = 1;
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(m)); } catch (e) {}
    if (window.userData) { window.userData.hiwSeen = window.userData.hiwSeen || {}; window.userData.hiwSeen[key] = true; }
    var u = window.currentUser || (window.auth && window.auth.currentUser);
    if (u && window.db) {
      var patch = {}; patch[key] = true;
      window.db.collection('users').doc(u.uid).set({ hiwSeen: patch }, { merge: true })
        .catch(function (err) { console.error('[how it works] save', err); });
    }
  }
  window.hiwSeen = hiwSeen;
  window.hiwMarkSeen = markSeen;

  // ── the overlay ───────────────────────────────────────────────────────
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  function build(def) {
    var host = document.querySelector('.app') || document.body;
    var o = el('div', 'hiw' + (def.cls ? ' ' + def.cls : ''));
    o.id = 'hiw';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-labelledby', 'hiw-h');
    var bars = def.steps.map(function (s, i) {
      return '<button type="button" class="hiw-bar" data-i="' + i + '" aria-label="Step ' + (i + 1) + ' of ' + def.steps.length + '"><i></i></button>';
    }).join('');
    o.innerHTML =
      '<div class="hiw-bars">' + bars + '</div>' +
      '<div class="hiw-top"><span class="hiw-eb">' + esc(def.eyebrow || 'How it works') + '</span>' +
        '<button type="button" class="hiw-skip" id="hiw-skip">' + (def.skip || 'Skip') + '</button></div>' +
      '<div class="hiw-stage" id="hiw-stage" aria-hidden="true"></div>' +
      '<div class="hiw-sheet"><div class="hiw-cap" aria-live="polite"><div class="hiw-n" id="hiw-n"></div><h2 class="hiw-h" id="hiw-h"></h2><p class="hiw-p" id="hiw-p"></p></div>' +
        '<div class="hiw-cta"><button type="button" class="hiw-btn g" id="hiw-back">Replay</button><button type="button" class="hiw-btn" id="hiw-next">Next</button></div></div>';
    host.appendChild(o);
    o.querySelectorAll('.hiw-bar').forEach(function (b) { b.onclick = function () { go(+b.getAttribute('data-i')); }; });
    o.querySelector('#hiw-skip').onclick = function () { close(true); };
    o.querySelector('#hiw-next').onclick = function () {
      if (!cur) return;
      if (cur.i < cur.def.steps.length - 1) go(cur.i + 1); else close(true);
    };
    o.querySelector('#hiw-back').onclick = function () {
      if (!cur) return;
      if (cur.i >= cur.def.steps.length - 1 || cur.done) go(0); else go(cur.i); // replay this step
    };
    return o;
  }

  function clearTimers() { if (cur) { cur.timers.forEach(clearTimeout); cur.timers = []; } }
  function later(fn, ms) { cur.timers.push(setTimeout(fn, ms)); }

  function go(i) {
    if (!cur) return;
    clearTimers();
    var def = cur.def, n = def.steps.length, s = def.steps[i], o = cur.el;
    cur.i = i; cur.done = false;
    var stage = o.querySelector('#hiw-stage');
    var html = '';
    try { html = typeof s.html === 'function' ? s.html() : (s.html || ''); } catch (e) { console.error('[how it works] scene', cur.key, i, e); }
    stage.innerHTML = '<div class="hiw-scene">' + html + '</div>';
    stage.scrollTop = 0;
    // caption
    o.querySelector('#hiw-n').textContent = (s.n || ((i + 1) + ' OF ' + n));
    o.querySelector('#hiw-h').textContent = s.h || '';
    o.querySelector('#hiw-p').textContent = s.p || '';
    var cap = o.querySelector('.hiw-cap');
    cap.classList.remove('in'); void cap.offsetWidth; cap.classList.add('in');
    var last = i === n - 1;
    o.querySelector('#hiw-next').textContent = last ? (def.done || 'Got it') : 'Next';
    o.querySelector('#hiw-back').textContent = 'Replay';
    // progress bars
    var dur = s.dur || def.dur || STEP_MS;
    o.querySelectorAll('.hiw-bar').forEach(function (b, k) {
      var f = b.querySelector('i');
      f.style.transition = 'none';
      f.style.transform = 'scaleX(' + (k < i ? 1 : 0) + ')';
      if (k === i) {
        void f.offsetWidth;
        f.style.transition = 'transform ' + dur + 'ms linear';
        f.style.transform = 'scaleX(1)';
      }
    });
    if (typeof s.run === 'function') { try { s.run(stage); } catch (e) { console.error('[how it works] run', e); } }
    animate(stage, dur);
    // auto-advance; the last step holds on its final frame
    if (!last) later(function () { go(i + 1); }, dur + 400);
    else later(function () { if (cur) cur.done = true; }, dur);
  }

  // ── timed effects inside a scene ──────────────────────────────────────
  function animate(stage, dur) {
    var rm = reduced();
    var sceneEl = stage.firstChild;
    stage.querySelectorAll('[data-at]').forEach(function (e) {
      if (e.classList.contains('hiw-tap')) return;
      var at = +e.getAttribute('data-at') || 0;
      e.classList.add('hiw-a');
      if (rm) { e.classList.add('hiw-on'); return; }
      later(function () { e.classList.add('hiw-on'); }, at);
    });
    stage.querySelectorAll('[data-off]').forEach(function (e) {
      var at = +e.getAttribute('data-off') || 0;
      later(function () { e.classList.add('hiw-gone'); }, rm ? 0 : at);
    });
    stage.querySelectorAll('[data-add]').forEach(function (e) {
      String(e.getAttribute('data-add')).split(/\s+/).forEach(function (pair) {
        var p = pair.split(':'), at = +p[0] || 0, c = p[1];
        if (c) later(function () { c.split('.').forEach(function (cc) { if (cc) e.classList.add(cc); }); }, rm ? 0 : at);
      });
    });
    stage.querySelectorAll('[data-rm]').forEach(function (e) {
      String(e.getAttribute('data-rm')).split(/\s+/).forEach(function (pair) {
        var p = pair.split(':'), at = +p[0] || 0, c = p[1];
        if (c) later(function () { e.classList.remove(c); }, rm ? 0 : at);
      });
    });
    stage.querySelectorAll('[data-type]').forEach(function (e) {
      var full = e.textContent, at = +e.getAttribute('data-type') || 0;
      if (rm) return;
      e.textContent = '';
      var k = 0, step = Math.max(28, Math.min(70, 900 / Math.max(1, full.length)));
      later(function tick() {
        k++; e.textContent = full.slice(0, k);
        if (k < full.length) later(tick, step);
      }, at);
    });
    if (rm) return;
    stage.querySelectorAll('.hiw-tap').forEach(function (t) {
      var at = +t.getAttribute('data-at') || 0;
      later(function () {
        var sel = t.getAttribute('data-on');
        var target = null; try { target = sel ? sceneEl.querySelector(sel) : null; } catch (e) {}
        var sr = stage.getBoundingClientRect();
        var x, y;
        if (target) {
          var r = target.getBoundingClientRect();
          x = r.left - sr.left + r.width * (+t.getAttribute('data-fx') || 0.5);
          y = r.top - sr.top + stage.scrollTop + r.height * (+t.getAttribute('data-fy') || 0.5);
        } else {
          x = +t.getAttribute('data-x') || sr.width / 2;
          y = +t.getAttribute('data-y') || 0;
        }
        t.style.left = x + 'px'; t.style.top = y + 'px';
        var dx = t.getAttribute('data-dx');
        if (dx) t.style.setProperty('--dx', dx + 'px');
        t.classList.add('go', 'k-' + (t.getAttribute('data-kind') || (dx ? 'swipe' : 'tap')));
        if (target && t.getAttribute('data-press') !== 'no') {
          later(function () { target.classList.add('hiw-pressed'); }, 140);
          later(function () { target.classList.remove('hiw-pressed'); }, 420);
        }
      }, at);
    });
  }

  // ── open / close ──────────────────────────────────────────────────────
  function open(key, opts) {
    opts = opts || {};
    var def = REG[key];
    if (!def || !def.steps || !def.steps.length) return false;
    if (cur) close(false);
    var o = build(def);
    cur = { key: key, def: def, i: 0, timers: [], el: o, opts: opts };
    window._hiwOpen = true;
    requestAnimationFrame(function () { o.classList.add('on'); try { o.setAttribute('tabindex', '-1'); o.focus({ preventScroll: true }); } catch (e) {} });
    go(0);
    return true;
  }
  function close(mark) {
    if (!cur) return;
    var c = cur; clearTimers(); cur = null; window._hiwOpen = false;
    if (mark !== false) markSeen(c.key);
    var o = c.el;
    o.classList.remove('on');
    setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 280);
    var after = c.opts && c.opts.after;
    if (typeof after === 'function') setTimeout(after, 300);
    if (c.def && typeof c.def.after === 'function') setTimeout(c.def.after, 300);
  }
  window.hiwPlay = function (key, opts) { return open(key, opts); };
  window.hiwClose = function () { close(true); };
  window.hiwGo = function (i) { if (cur) go(i); };
  window.hiwFreeze = function () { clearTimers(); }; // for checking a frame
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur) close(true); });

  // ── first visit → play once ───────────────────────────────────────────
  // Waits until the person is signed in, nothing else is covering the
  // screen (What's new, a sheet), and the page is still the one showing.
  function blocked() {
    if (cur || window._hiwOpen) return true;
    if (document.getElementById('ip-wn')) return true; // What's new
    if (typeof window.ipWhatsNewPending === 'function' && window.ipWhatsNewPending()) return true; // What's new is about to show
    if (document.querySelector('.gtut-sh.on')) return true;
    if (window._hiwLaunchPending) return true;         // first launch goes first
    if (!(window.currentUser || (window.auth && window.auth.currentUser)) || !window.userData) return true;
    return false;
  }
  var queued = {};
  window.hiwAuto = function (key, stillHere, delay) {
    if (!REG[key] || hiwSeen(key) || queued[key]) return;
    if (/[?&]nohiw\b/.test(location.search || '')) return;
    queued[key] = 1;
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (hiwSeen(key)) { clearInterval(t); queued[key] = 0; return; }
      if (stillHere && !stillHere()) { clearInterval(t); queued[key] = 0; return; }
      if (blocked()) { if (tries > 120) { clearInterval(t); queued[key] = 0; } return; }
      clearInterval(t); queued[key] = 0;
      open(key);
    }, 500);
  };

  // ?hiw=key in the URL plays that walkthrough (for checking a scene)
  try {
    var m = /[?&]hiw=([a-z0-9-]+)/i.exec(location.search || '');
    if (m) window.addEventListener('load', function () { setTimeout(function () { open(m[1]); }, 600); });
  } catch (e) {}
})();

// ── when each walkthrough plays, and the ? buttons ─────────────────────
(function () {
  if (typeof hiwPlay !== 'function') return;
  var LIST = [
    ['launch', 'Welcome to Innings', 'The quick tour'],
    ['home', 'Home', 'Live games, your friends’ game, the bell'],
    ['games', 'Games', 'Every league, scores, Watching or Attending'],
    ['multi', 'Multi view', 'Four games at once'],
    ['bell', 'The bell', 'Notifications on sports pages'],
    ['game', 'A baseball game', 'Pitches, Statcast, the takeovers, the tabs'],
    ['delay', 'TV delay', 'Watch on TV without spoilers'],
    ['plays', 'Plays', 'Relive, react, reply'],
    ['player', 'Player card', 'His card, today’s at-bats, reply to a stat'],
    ['chat', 'Game chat', 'React, reply, bring someone in'],
    ['crews', 'Crews', 'Your watch group, on any game'],
    ['multigame', 'Multi-game chat', 'One chat, several games'],
    ['memory', 'Save a moment', 'Ticket stubs, tags, memories'],
    ['archive', 'Archive', 'Memories, calendar, on this day'],
    ['friends', 'Friends', 'Who’s around, what they’re watching, plans']
  ];
  function act() { var a = document.querySelector('.screen.active'); return a ? a.id.replace('screen-', '') : ''; }
  function sport() { var g = window._activeBrowseGame; return (g && g.sport) || 'mlb'; }
  function onGame(mlbOnly) { return act() === 'game' && (!mlbOnly || sport() === 'mlb'); }
  function snoozed(k) { return !!(window._hiwSnooze && window._hiwSnooze[k]); }
  function auto(k, still) { if (!snoozed(k)) hiwAuto(k, still); }

  // pages
  var SCREEN = { home: 'home', feed: 'home', 'games-picker': 'games', multi: 'multi', memories: 'archive', calendar: 'archive', friends: 'friends', 'create-group': 'memory' };
  if (typeof _navApplyScreen === 'function') {
    var prevNav = _navApplyScreen;
    window._navApplyScreen = function (id) {
      var out = prevNav.apply(this, arguments);
      try {
        var k = SCREEN[id];
        if (k) setTimeout(function () { auto(k, function () { return SCREEN[act()] === k; }); }, 700);
        if (id === 'game') setTimeout(function () { if (onGame(true)) auto('game', function () { return onGame(true); }); }, 1200);
      } catch (e) { console.error('[how it works] nav', e); }
      return out;
    };
  }
  // game tabs
  if (typeof gameDetailTab === 'function') {
    var prevTab = gameDetailTab;
    window.gameDetailTab = function (key) {
      var out = prevTab.apply(this, arguments);
      try {
        if (key === 'plays') setTimeout(function () { auto('plays', function () { return onGame(true); }); }, 500);
        if (key === 'chat') setTimeout(function () { auto('chat', function () { return onGame(false); }); }, 600);
      } catch (e) {}
      return out;
    };
  }
  // the scoreboard pulled down on a baseball game: the delay
  if (typeof gshOpenDrop === 'function') {
    var prevDrop = gshOpenDrop;
    window.gshOpenDrop = function () {
      var out = prevDrop.apply(this, arguments);
      try { setTimeout(function () { auto('delay', function () { return onGame(true) && window._gshDropOn; }); }, 700); } catch (e) {}
      return out;
    };
  }
  // a player's card opened during a baseball game
  if (typeof openPlayerLinkSheet === 'function') {
    var prevPl = openPlayerLinkSheet;
    window.openPlayerLinkSheet = function () {
      var out = prevPl.apply(this, arguments);
      try {
        if (onGame(true)) setTimeout(function () {
          var b = document.getElementById('player-link-backdrop');
          auto('player', function () { return onGame(true) && b && b.style.display !== 'none'; });
        }, 900);
      } catch (e) {}
      return out;
    };
  }
  // crews and multi-game chat, once the chat walkthrough has been seen
  function wrapPaint(name, key, sel) {
    if (typeof window[name] !== 'function') return;
    var prev = window[name];
    window[name] = function () {
      var out = prev.apply(this, arguments);
      try {
        var el = document.querySelector(sel);
        if (el && el.style.display !== 'none' && el.innerHTML && hiwSeen('chat')) setTimeout(function () { auto(key, function () { var e = document.querySelector(sel); return onGame(false) && e && e.offsetParent !== null; }); }, 900);
      } catch (e) {}
      return out;
    };
  }
  wrapPaint('_crwPaintChat', 'crews', '#crw-tiles');
  wrapPaint('_mgcPaint', 'multigame', '#mgc');
  // the floating bell sliding in
  if (typeof _gbellSetOut === 'function') {
    var prevBell = _gbellSetOut;
    window._gbellSetOut = function (out) {
      var r = prevBell.apply(this, arguments);
      try { if (out) setTimeout(function () { auto('bell', function () { return !!document.querySelector('.screen.active .gbell-dock.in'); }); }, 1600); } catch (e) {}
      return r;
    };
  }

  // ── brand-new person: the welcome tour, instead of What's new ─────────
  if (typeof _firstLandingToFeed === 'function') {
    var prevFirst = _firstLandingToFeed;
    window._firstLandingToFeed = function (user) {
      if (!hiwSeen('launch')) window._hiwLaunchPending = true;
      var out = prevFirst.apply(this, arguments);
      if (window._hiwLaunchPending) {
        var tries = 0;
        var t = setInterval(function () {
          tries++;
          var landed = /^(home|feed)$/.test(act());
          if (!landed && tries < 40) return;
          clearInterval(t);
          setTimeout(function () {
            window._hiwLaunchPending = false;
            if (!hiwPlay('launch', { after: function () { if (typeof ipMarkWhatsNewSeen === 'function') ipMarkWhatsNewSeen(); } })) return;
            // the Home walkthrough waits for their next visit
            window._hiwSnooze = window._hiwSnooze || {}; window._hiwSnooze.home = 1;
          }, 600);
        }, 250);
      }
      return out;
    };
  }

  // ── the ? buttons ─────────────────────────────────────────────────────
  // Game page: the ? that was there opens the walkthrough for the tab you're on
  window.hiwGameHelp = function () {
    if (sport() !== 'mlb') { if (typeof gtutOpen === 'function') gtutOpen(); return; }
    var vis = function (id) { var e = document.getElementById(id); return !!(e && e.style.display !== 'none' && e.offsetParent !== null); };
    var k = vis('game-chat-panel') ? 'chat' : vis('game-plays-panel') ? 'plays' : vis('game-box-panel') ? 'player' : 'game';
    hiwPlay(k);
  };
  var Q = '<span aria-hidden="true">?</span>';
  function qBtn(cls, key, label, style) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.setAttribute('aria-label', label);
    if (style) b.setAttribute('style', style);
    b.innerHTML = Q;
    b.onclick = function (e) { e.stopPropagation(); hiwPlay(key); };
    return b;
  }
  var CLASSIC_Q = 'width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#E9E5FF;font:800 16px/1 -apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;margin-left:auto;padding:0';
  function addButtons() {
    try {
      var gq = document.querySelector('#game-hd .gtut-btn');
      if (gq && !gq._hiw) { gq._hiw = 1; gq.removeAttribute('onclick'); gq.onclick = function () { hiwGameHelp(); }; }
      var bell = document.getElementById('glass-bell');
      if (bell && !document.getElementById('hiw-q-home')) { var h = qBtn('gl-ib hiw-qb', 'home', 'How Home works'); h.id = 'hiw-q-home'; bell.parentNode.insertBefore(h, bell); }
      var ft = document.querySelector('#screen-friends .gl-top');
      if (ft && !document.getElementById('hiw-q-friends')) { var f = qBtn('gl-ib hiw-qb', 'friends', 'How Friends works'); f.id = 'hiw-q-friends'; ft.insertBefore(f, ft.querySelector('.gl-ib')); }
      var gp = document.querySelector('#screen-games-picker > div');
      if (gp && !document.getElementById('hiw-q-games')) { var g = qBtn('hiw-qc', 'games', 'How Games works', CLASSIC_Q); g.id = 'hiw-q-games'; gp.appendChild(g); }
      var mv = document.getElementById('mv-edit');
      if (mv && !document.getElementById('hiw-q-multi')) { var m = qBtn('hiw-qc', 'multi', 'How Multi view works', CLASSIC_Q.replace('margin-left:auto', 'margin-left:8px')); m.id = 'hiw-q-multi'; mv.parentNode.insertBefore(m, mv); }
      ['memories', 'calendar'].forEach(function (s) {
        var hero = document.querySelector('#screen-' + s + ' .imm-hero');
        if (hero && !hero.querySelector('.hiw-qa')) hero.appendChild(qBtn('gl-ib hiw-qb hiw-qa', 'archive', 'How the Archive works'));
      });
      var stamp = document.getElementById('gl-prows');
      if (stamp && !document.getElementById('hiw-prow')) {
        var r = document.createElement('button');
        r.className = 'gl-prow'; r.id = 'hiw-prow';
        r.innerHTML = '<span class="ic"><span style="font:800 17px/1 -apple-system,sans-serif">?</span></span><span class="tx"><b>How Innings works</b><small>Replay any walkthrough</small></span>' + ((window.GL_ICON && GL_ICON.chev) || '');
        r.onclick = function () { hiwOpenList(); };
        stamp.insertBefore(r, stamp.firstChild);
      }
    } catch (e) { console.error('[how it works] buttons', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButtons); else addButtons();
  setTimeout(addButtons, 1500); setTimeout(addButtons, 5000);

  // Profile › How Innings works: every walkthrough in one list
  window.hiwOpenList = function () {
    var el = document.getElementById('hiw-list');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hiw-list'; el.className = 'gtut-sh';
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'hiw-list-t');
      el.innerHTML = '<div class="gtut-scrim" onclick="hiwCloseList()"></div><div class="gtut-card"><div class="gtut-grab" aria-hidden="true"></div>' +
        '<div class="gtut-hd"><h3 id="hiw-list-t">How Innings works</h3><button type="button" class="gtut-x" onclick="hiwCloseList()" aria-label="Close">✕</button></div>' +
        '<div class="gtut-body"><div class="gl-prows" style="margin:0">' + LIST.filter(function (x) { return hiwHas(x[0]); }).map(function (x) {
          return '<button class="gl-prow" onclick="hiwCloseList();setTimeout(function(){hiwPlay(\'' + x[0] + '\')},260)"><span class="tx"><b>' + x[1] + '</b><small>' + x[2] + '</small></span>' + ((window.GL_ICON && GL_ICON.chev) || '') + '</button>';
        }).join('') + '</div></div></div>';
      (document.querySelector('.app') || document.body).appendChild(el);
    }
    el.style.display = 'block';
    requestAnimationFrame(function () { el.classList.add('on'); });
  };
  window.hiwCloseList = function () {
    var el = document.getElementById('hiw-list');
    if (!el) return;
    el.classList.remove('on');
    setTimeout(function () { if (!el.classList.contains('on')) el.style.display = 'none'; }, 260);
  };
})();
