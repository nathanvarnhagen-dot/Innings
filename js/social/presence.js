// ══ ACTIVITY DOTS + INNINGS PULSE + WHAT'S NEW (v7.75.0) ══════════════════
// Three pieces that ship together:
//
// 1. Presence. While the app is open it stamps the signed-in user's own
//    users/{uid} doc with a COARSE presence object — never an exact time:
//      presence.nowUntil  end of the current 5-minute window + 5 min (ms)
//      presence.day       last active local day, 'YYYY-MM-DD'
//    Friends' chips read it and show a dot: green = now, lavender = today,
//    hollow ring = this week, nothing = longer ago.
//
// 2. Innings Pulse — admin only (Nate, matched by phone like the feedback
//    code). Each device adds its uid once a day to usage/{YYYY-MM-DD}.uids.
//    Only Nate can READ usage/* (Firestore rule checks the auth token's
//    phone_number), so nobody else can see weekly usage even from devtools.
//    The card sits at the top of the Friends tab.
//
// 3. What's new — a load-in screen per bigger build; anyone who missed
//    several sees each one (v7.77.0). Add new builds at the top of WHATS_NEW.

(function () {
  var ADMIN_PHONE10 = '4152979471';
  var FIVE = 5 * 60000;
  var lastPing = 0;

  function me() { return window.currentUser || (window.auth && window.auth.currentUser); }
  function isAdmin(u) { u = u || me(); return !!(u && String(u.phoneNumber || '').replace(/\D/g, '').slice(-10) === ADMIN_PHONE10); }
  window.ipIsAdmin = isAdmin;

  function dayKey(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, dd = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
  }
  function daysAgoKey(n) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return dayKey(d); }
  function esc(s) { return typeof _escapeHtml === 'function' ? _escapeHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // ── 1. presence ─────────────────────────────────────────────────────────
  function ping(force) {
    var u = me();
    if (!u || !window.db || document.hidden) return;
    var now = Date.now();
    if (!force && now - lastPing < 4 * 60000) return;
    lastPing = now;
    var today = dayKey();
    window.db.collection('users').doc(u.uid)
      .set({ presence: { nowUntil: Math.ceil(now / FIVE) * FIVE + FIVE, day: today } }, { merge: true })
      .catch(function (err) { console.error('[presence] ping', err && err.code, err); });
    var seenKey = 'innings_usage_day_' + u.uid;
    if (lsGet(seenKey) !== today) {
      window.db.collection('usage').doc(today)
        .set({ uids: firebase.firestore.FieldValue.arrayUnion(u.uid) }, { merge: true })
        .then(function () { lsSet(seenKey, today); })
        .catch(function (err) { console.error('[presence] usage', err && err.code, err); });
    }
  }
  window.ipPing = ping;

  // 'now' | 'today' | 'week' | null — from a users/{uid} doc's data
  function bucket(d) {
    var p = d && d.presence;
    if (!p) return null;
    if (p.nowUntil && p.nowUntil > Date.now()) return 'now';
    if (p.day === dayKey()) return 'today';
    if (p.day && p.day >= daysAgoKey(6)) return 'week';
    return null;
  }
  window.ipBucket = bucket;
  var LABEL = { now: 'Now', today: 'Today', week: 'This week' };

  window.ipDotHtml = function (d, size) {
    var b = bucket(d);
    if (!b) return '';
    return '<span class="ip-dot ip-' + b + '" style="width:' + (size || 14) + 'px;height:' + (size || 14) + 'px" role="img" aria-label="Active ' + LABEL[b].toLowerCase() + '"></span>';
  };

  var started = false;
  var boot = setInterval(function () {
    if (!me() || !window.db) return;
    clearInterval(boot);
    if (started) return;
    started = true;
    ping(true);
    setInterval(function () { ping(false); }, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) ping(true); });
    whatsNewWhenReady();
  }, 500);

  // ── 2. Innings Pulse (admin only) ───────────────────────────────────────
  function pulseHost() {
    var host = document.getElementById('ip-pulse');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'ip-pulse';
    host.className = 'gl-sec';
    var body = document.getElementById('gl-friends-body');
    if (body) { body.insertBefore(host, body.firstChild); return host; }
    var fl = document.getElementById('my-friends-list');
    var hdr = fl && fl.previousElementSibling;
    if (hdr && hdr.parentNode) { hdr.parentNode.insertBefore(host, hdr); return host; }
    return null;
  }

  var LOCK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

  window.ipRenderPulse = function (friendUids) {
    var u = me();
    if (!isAdmin(u) || !window.db) { var h0 = document.getElementById('ip-pulse'); if (h0) h0.style.display = 'none'; return; }
    var host = pulseHost();
    if (!host) return;
    host.style.display = '';
    if (!host.innerHTML) host.innerHTML = '<div class="ip-card"><div class="ip-sub">Loading Pulse…</div></div>';
    var keys = [];
    for (var i = 6; i >= 0; i--) keys.push(daysAgoKey(i));
    var uids = (friendUids || window._myFriendUids || []).slice();
    Promise.all([
      Promise.all(keys.map(function (k) { return window.db.collection('usage').doc(k).get(); })),
      Promise.all(uids.map(function (id) { return window.db.collection('users').doc(id).get(); }))
    ]).then(function (res) {
      var perDay = res[0].map(function (s) { return (s.exists && s.data().uids) || []; });
      var week = {};
      perDay.forEach(function (a) { a.forEach(function (id) { week[id] = 1; }); });
      var weekN = Object.keys(week).length;
      var todayN = perDay[6].length;
      var people = res[1].map(function (doc) {
        var d = doc.data() || {};
        return { name: (d.name || 'Innings User').split(' ')[0], b: bucket(d), d: d };
      });
      var rank = { now: 0, today: 1, week: 2 };
      people.sort(function (a, b) { return (a.b ? rank[a.b] : 3) - (b.b ? rank[b.b] : 3) || a.name.localeCompare(b.name); });
      var nowN = people.filter(function (p) { return p.b === 'now'; }).length + 1; // + you, you're here
      var avg = Math.round(perDay.reduce(function (s, a) { return s + a.length; }, 0) / 7 * 10) / 10;
      var max = Math.max.apply(null, perDay.map(function (a) { return a.length; }).concat([1]));
      var DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      var bars = keys.map(function (k, i) {
        var n = perDay[i].length, dt = new Date(k + 'T12:00:00');
        return '<div class="ip-bar"><i style="height:' + Math.max(3, Math.round(n / max * 46)) + 'px" title="' + n + '"></i><span>' + DOW[dt.getDay()] + '</span></div>';
      }).join('');
      var tile = function (v, l) { return '<div class="ip-tile"><b class="gl-num">' + v + '</b><span>' + l + '</span></div>'; };
      var rows = people.map(function (p) {
        return '<div class="ip-row"><span class="ip-av">' + esc((p.name || '?').charAt(0).toUpperCase()) + window.ipDotHtml(p.d, 12) + '</span>' +
          '<span class="ip-nm">' + esc(p.name) + '</span><span class="ip-when ip-w-' + (p.b || 'old') + '">' + (p.b ? LABEL[p.b] : 'Over a week') + '</span></div>';
      }).join('');
      host.innerHTML = '<div class="ip-card">' +
        '<div class="ip-hd"><div><b>Innings Pulse</b><small>' + LOCK + 'Only you see this</small></div><span class="ip-pill">Admin</span></div>' +
        '<div class="ip-tiles">' + tile(nowN, 'In the app now') + tile(todayN, 'Opened today') + tile(weekN, 'Active this week') + tile(avg, 'Avg daily actives') + '</div>' +
        '<div class="ip-sub">Daily actives · last 7 days</div><div class="ip-bars">' + bars + '</div>' +
        (rows ? '<div class="ip-sub" style="margin-top:14px">Last active</div><div class="ip-list">' + rows + '</div>' : '') +
        '</div>';
    }).catch(function (err) {
      console.error('[pulse] load', err && err.code, err);
      host.innerHTML = '<div class="ip-card"><div class="ip-hd"><div><b>Innings Pulse</b><small>' + LOCK + 'Only you see this</small></div></div>' +
        '<div class="ip-sub">Pulse couldn’t load (' + esc((err && err.code) || 'error') + '). If it says permission-denied, the Firestore rules for <code>usage</code> aren’t published yet.</div></div>';
    });
  };

  // ── 3. What's new ───────────────────────────────────────────────────────
  // v7.77.0: every bigger build keeps its entry here, newest first, with the
  // time it shipped. Innings remembers the last build each person saw
  // (localStorage + users/{uid}.whatsNewSeen). Open it after missing several
  // and they all show: the newest in full, the earlier ones stacked under
  // "Earlier" (tap to open). Missed just one → the single screen, as before.
  // Never saw one → the builds since the account was made (at least the
  // newest). More than 5 missed → the 5 newest, then "and N earlier builds".
  // Next bigger build: add an entry at the TOP of WHATS_NEW.
  var WHATS_NEW = [
    {
      id: 'v7.89.0', at: '2026-10-29T21:50:00-07:00',
      title: 'Change a player in Compare',
      sub: 'Swap either side without starting over.',
      items: function () {
        return [
          { icon: 'compare', title: 'Tap a name', body: 'Tap either player (or Change under his name) to search for someone else. The other player stays put.' },
          { icon: 'bars', title: 'Your view stays', body: 'The tab, the stat on the graph and how the careers line up all stay the same, so you can run through comparisons fast.' }
        ];
      }
    },
    {
      id: 'v7.88.0', at: '2026-10-29T21:40:00-07:00',
      title: 'Chart any stat in Compare',
      sub: 'Every category in a player comparison now goes on the graph, one on one.',
      items: function () {
        return [
          { icon: 'compare', title: 'Every category, charted', body: 'In By age, pick BA, OBP, SLG, OPS, OPS+, HR, RBI, games, Gold Gloves, or for pitchers ERA, WHIP, K/9, ERA+, wins, saves and more from the chips under the graph.' },
          { icon: 'bars', title: 'Tap a row', body: 'Tap any stat in the comparison, in By age or Basics, and the graph switches to it, career to date at every age.' }
        ];
      }
    },
    {
      id: 'v7.87.0', at: '2026-10-29T11:40:00-07:00',
      title: 'Basketball player cards',
      sub: 'Tap any NBA or WNBA player for his numbers, not just his bio.',
      items: function () {
        return [
          { icon: 'bars', title: 'Season, last season, career', body: 'Points, rebounds, assists, FG% and 3P% per game, right under age and height.' },
          { icon: 'history', title: 'Every game this season', body: 'His line from each game, newest first, playoffs included.' },
          { icon: 'help', title: 'Full names', body: 'Tapping a shortened name like G. Williams now opens the card under her full name.' }
        ];
      }
    },
    {
      id: 'v7.86.0', at: '2026-10-29T11:30:00-07:00',
      title: 'Baseball’s offseason',
      sub: 'The season’s over. Open MLB in Games for everything happening until spring.',
      items: function () {
        return [
          { icon: 'compare', title: 'Look up and compare anyone', body: 'Search any player, active or retired. Tap Compare on two of them, or use the quick compares for the best free agents still out there.' },
          { icon: 'history', title: 'The Hot Stove', body: 'Every signing, trade and free agent as it happens, filtered to your teams if you like. The biggest move gets its team’s colors and a compare against the player he’s replacing.' },
          { icon: 'friends', title: 'Where does he sign?', body: 'Pick a team for the top free agents. Your friends’ picks show up too, and when he signs, his card says who called it.' }
        ];
      }
    },
    {
      id: 'v7.83.0', at: '2026-10-27T18:50:00-07:00',
      title: 'Replay reviews, live',
      sub: 'When a call goes to New York, the at-bat square tells you.',
      items: function () {
        return [
          { icon: 'help', title: 'Under review', body: 'A manager challenge or crew chief review shows across the top of the square while it’s being looked at: who challenged, what for, and how many challenges they have left.' },
          { icon: 'history', title: 'The ruling', body: 'Call overturned or call stands, right when it comes back.' }
        ];
      }
    },
    {
      id: 'v7.81.0', at: '2026-10-26T17:40:00-07:00',
      title: 'Legends get a real card',
      sub: 'Tap any retired player and his whole career is there.',
      items: function () {
        return [
          { icon: 'trophy', title: 'Career up top', body: 'His career line, World Series rings and honors, and when he’s eligible for the Hall of Fame.' },
          { icon: 'history', title: 'Every season below', body: 'Year by year, newest first or oldest first, with championship years marked.' }
        ];
      }
    },
    {
      id: 'v7.80.0', at: '2026-10-26T17:20:00-07:00',
      title: 'Team pages in team colors',
      sub: 'Every team page now wears its own colors, and baseball teams get their whole history.',
      items: function () {
        return [
          { icon: 'palette', title: 'Their colors, every sport', body: 'The header, tabs, jersey numbers and buttons take each team’s colors, with run (or point, or goal) differential and home and away records up top.' },
          { icon: 'history', title: 'History, back to year one', body: 'MLB teams have a History tab: every season, newest first, back to the franchise’s first, with decade jumps.' },
          { icon: 'trophy', title: 'Every postseason', body: 'Titles in gold, pennants marked, and every series one tap away.' }
        ];
      }
    },
    {
      id: 'v7.79.0', at: '2026-10-26T16:56:00-07:00',
      title: 'How it works, page by page',
      sub: 'Tap ? on any page and a short walkthrough shows what you can tap.',
      items: function () {
        return [
          { icon: 'help', title: 'Every page has one', body: 'Home, Games, a game, Plays, a player’s card, Chat, crews, your Archive and more.' },
          { icon: 'help', title: 'Watch whenever you want', body: 'Tap ? on the page, or Profile › How Innings works for the whole list.' },
          { icon: 'friends', title: 'New friends get a welcome tour', body: 'Anyone joining from your invite sees how Innings works before they start.' }
        ];
      }
    },
    {
      id: 'v7.78.0', at: '2026-10-26T16:55:00-07:00',
      title: 'Compare anyone, at any age',
      sub: 'Pitchers too, and players who retired long ago. See where two careers stood at the same age.',
      items: function () {
        return [
          { icon: 'compare', title: 'Pitchers and hitters', body: 'Tap any player, then Compare. Pitchers line up on W-L, ERA, WHIP, strikeouts and ERA+.' },
          { icon: 'age', title: 'By age', body: 'Chapman at 33 next to Beltré at 33: a career chart, totals through that age, and what came next.' },
          { icon: 'trophy', title: 'Legends included', body: 'Search anyone who played in the majors. Hall of Famers at his position are a tap away.' }
        ];
      }
    },
    {
      id: 'v7.76.0', at: '2026-10-26T15:44:03-07:00',
      title: 'Compare any two hitters',
      sub: 'Put two hitters side by side: the basics, OPS+ and WAR, or their Statcast.',
      items: function () {
        return [
          { icon: 'compare', title: 'Tap a hitter, then Compare', body: 'Pick someone at his position in this game, either lineup, or search any MLB hitter.' },
          { icon: 'bars', title: 'Basics or Statcast', body: 'This season, his last 15 games or his career. Bars show where each one ranks in MLB.' },
          { icon: 'chat', title: 'Settle it in the chat', body: 'Share a comparison in the game chat. Friends tap it to see the whole thing.' }
        ];
      }
    },
    {
      id: 'v7.75.0', at: '2026-10-26T11:37:44-07:00',
      title: 'See who’s around',
      sub: 'A dot next to a friend’s name now shows when they were last on Innings.',
      preview: true,
      items: function (admin) {
        return [
          { icon: 'friends', title: 'Friends see your dot', body: 'Active now, today, or this week. Never exact times.' },
          admin
            ? { icon: 'lock', title: 'Only you see weekly usage', body: 'Innings Pulse is at the top of your Friends tab. Messages are never tracked.' }
            : { icon: 'lock', title: 'Only Nathan sees weekly usage', body: 'He uses it to see what’s working in the app. Your messages are never tracked.' }
        ];
      }
    }
  ];
  var WN_MAX = 5;
  var ICONS = {
    palette: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.6 0-.9-.6-1.3-.6-2.1 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4c0-4.7-4-8.7-9-8.7z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/></svg>',
    history: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
    age: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20h18M5 16l4-5 4 3 6-8"/></svg>',
    trophy: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/></svg>',
    compare: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4v16M16 4v16M4 9h8M12 15h8"/></svg>',
    bars: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M4 12h16M4 18h7"/></svg>',
    chat: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
    friends: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.4 0 4 1.6 4.5 4.5"/></svg>',
    help: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17.2v.01"/></svg>',
    lock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
  };
  var CHEV = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

  // 'v7.76.0' → comparable number; anything unreadable sorts as oldest
  function verNum(v) {
    var m = /^v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(String(v || ''));
    return m ? (+m[1]) * 1e6 + (+m[2]) * 1e3 + (+(m[3] || 0)) : -1;
  }
  function lastSeenId() {
    var a = lsGet('innings_whatsnew_seen'), ud = window.userData, b = ud && ud.whatsNewSeen;
    if (!a) return b || null;
    if (!b) return a;
    return verNum(a) >= verNum(b) ? a : b;
  }
  // the builds this person hasn't seen, newest first
  function missedBuilds() {
    var last = lastSeenId();
    if (last) return WHATS_NEW.filter(function (w) { return verNum(w.id) > verNum(last); });
    var u = me(), made = u && u.metadata && u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : NaN;
    var since = isFinite(made) ? WHATS_NEW.filter(function (w) { return Date.parse(w.at) > made; }) : [];
    return since.length ? since : WHATS_NEW.slice(0, 1);
  }
  // ?whatsnew in the URL replays every entry (for checking the screen)
  function forceAll() { return /[?&]whatsnew\b/.test(location.search || ''); }
  function seenWhatsNew() { return !forceAll() && !missedBuilds().length; }
  function whatsNewWhenReady() {
    if (seenWhatsNew()) return;
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var act = document.querySelector('.screen.active');
      var landed = act && /screen-(feed|home|friends|games|games-picker|profile)$/.test(act.id);
      // v7.79.0: never on top of a How it works walkthrough, or a new person's welcome tour
      if (window._hiwOpen || window._hiwLaunchPending) { if (tries > 600) clearInterval(t); return; }
      if (!landed || !window.userData) { if (tries > 120) clearInterval(t); return; }
      clearInterval(t);
      setTimeout(showWhatsNew, 900);
    }, 500);
  }

  function previewHtml() {
    var demo = [{ n: 'Jordan', b: 'now' }, { n: 'Priya', b: 'today' }, { n: 'Sam', b: 'week' }];
    return '<div class="ip-wn-prev" aria-label="Example: three friends with activity dots">' + demo.map(function (f) {
      return '<div class="ip-row"><span class="ip-av">' + f.n.charAt(0) + '<span class="ip-dot ip-' + f.b + '" style="width:12px;height:12px" aria-hidden="true"></span></span>' +
        '<span class="ip-nm">' + f.n + '</span><span class="ip-when ip-w-' + f.b + '">' + LABEL[f.b] + '</span></div>';
    }).join('') + '</div>';
  }
  function itemsHtml(w, admin) {
    return w.items(admin).map(function (it) {
      return '<div class="ip-wn-it"><span class="ip-wn-ic">' + (ICONS[it.icon] || '') + '</span><span><b>' + esc(it.title) + '</b><small>' + esc(it.body) + '</small></span></div>';
    }).join('');
  }
  function showWhatsNew() {
    var list = forceAll() ? WHATS_NEW.slice() : missedBuilds();
    if (!list.length || document.getElementById('ip-wn')) return;
    var admin = isAdmin(), body;
    if (list.length === 1) {
      // one build: the same single screen as before
      var w = list[0];
      body = '<span class="ip-wn-tag">WHAT’S NEW · ' + esc(w.id) + '</span>' +
        '<h2 id="ip-wn-title">' + esc(w.title) + '</h2><p>' + esc(w.sub) + '</p>' +
        (w.preview ? previewHtml() : '') + '<div class="ip-wn-items">' + itemsHtml(w, admin) + '</div>';
    } else {
      var shown = list.slice(0, WN_MAX), more = list.length - shown.length, top = shown[0];
      body = '<span class="ip-wn-tag">WHAT’S NEW · ' + list.length + ' BUILDS</span>' +
        '<h2 id="ip-wn-title">Since you were last here</h2>' +
        '<div class="ip-wn-card"><div class="ip-wn-ver"><span class="ip-wn-new">NEWEST</span>' + esc(top.id) + '</div>' +
        '<h3>' + esc(top.title) + '</h3><p>' + esc(top.sub) + '</p>' + (top.preview ? previewHtml() : '') +
        '<div class="ip-wn-items">' + itemsHtml(top, admin) + '</div></div>' +
        '<div class="ip-wn-eb">EARLIER</div><div class="ip-wn-older">' + shown.slice(1).map(function (o, i) {
          var pid = 'ip-wn-o' + i;
          return '<div class="ip-wn-old"><button type="button" class="ip-wn-tog" aria-expanded="false" aria-controls="' + pid + '">' +
            '<span class="ip-wn-tx"><small>' + esc(o.id) + '</small><b>' + esc(o.title) + '</b><span>' + esc(o.sub) + '</span></span>' + CHEV + '</button>' +
            '<div class="ip-wn-body" id="' + pid + '" hidden>' + (o.preview ? previewHtml() : '') + '<div class="ip-wn-items">' + itemsHtml(o, admin) + '</div></div></div>';
        }).join('') + '</div>' +
        (more > 0 ? '<div class="ip-wn-more">and ' + more + ' earlier build' + (more === 1 ? '' : 's') + '</div>' : '');
    }
    var el = document.createElement('div');
    el.id = 'ip-wn';
    if (list.length > 1) el.className = 'ip-wn-multi';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'ip-wn-title');
    el.innerHTML = '<div class="ip-wn-in">' + body + '<button type="button" class="ip-wn-ok" id="ip-wn-ok">Got it</button></div>';
    document.body.appendChild(el);
    el.querySelectorAll('.ip-wn-tog').forEach(function (b) {
      b.addEventListener('click', function () {
        var open = b.getAttribute('aria-expanded') === 'true', panel = document.getElementById(b.getAttribute('aria-controls'));
        b.setAttribute('aria-expanded', open ? 'false' : 'true');
        if (panel) panel.hidden = open;
      });
    });
    requestAnimationFrame(function () { el.classList.add('on'); });
    var ok = document.getElementById('ip-wn-ok');
    if (ok) { ok.onclick = closeWhatsNew; try { ok.focus({ preventScroll: true }); } catch (e) {} }
  }
  function closeWhatsNew() {
    var id = WHATS_NEW[0].id; // the newest: everything up to it has been seen
    lsSet('innings_whatsnew_seen', id);
    var u = me();
    if (u && window.db) window.db.collection('users').doc(u.uid).set({ whatsNewSeen: id }, { merge: true }).catch(function (err) { console.error('[whats new] save', err); });
    if (window.userData) window.userData.whatsNewSeen = id;
    var el = document.getElementById('ip-wn');
    if (!el) return;
    el.classList.remove('on');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
  }
  window.ipShowWhatsNew = showWhatsNew;
  // v7.79.0: How it works (js/core/how-it-works.js) waits while What's new is
  // still to come, and a new person's welcome tour counts as having seen it
  window.ipWhatsNewPending = function () { return !!window.userData && !seenWhatsNew() && !forceAll(); };
  window.ipMarkWhatsNewSeen = function () {
    var id = WHATS_NEW[0].id;
    lsSet('innings_whatsnew_seen', id);
    var u = me();
    if (u && window.db) window.db.collection('users').doc(u.uid).set({ whatsNewSeen: id }, { merge: true }).catch(function (err) { console.error('[whats new] save', err); });
    if (window.userData) window.userData.whatsNewSeen = id;
  };
})();
