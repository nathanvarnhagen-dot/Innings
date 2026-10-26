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
// 3. What's new — a one-time load-in screen per bigger build. Edit
//    WHATS_NEW below for the next build; bump its id and it shows again.

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
  // Edit this block for the next bigger build. Bump id → it shows again once.
  var WHATS_NEW = {
    id: 'v7.75.0',
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
  };
  var ICONS = {
    friends: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.4 0 4 1.6 4.5 4.5"/></svg>',
    lock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
  };

  function seenWhatsNew() {
    if (lsGet('innings_whatsnew_seen') === WHATS_NEW.id) return true;
    var ud = window.userData;
    return !!(ud && ud.whatsNewSeen === WHATS_NEW.id);
  }
  function whatsNewWhenReady() {
    if (seenWhatsNew()) return;
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      var act = document.querySelector('.screen.active');
      var landed = act && /screen-(feed|home|friends|games|games-picker|profile)$/.test(act.id);
      if (!landed || !window.userData) { if (tries > 120) clearInterval(t); return; }
      clearInterval(t);
      setTimeout(showWhatsNew, 900);
    }, 500);
  }

  function showWhatsNew() {
    if (seenWhatsNew() || document.getElementById('ip-wn')) return;
    var admin = isAdmin();
    var demo = [
      { n: 'Jordan', b: 'now' }, { n: 'Priya', b: 'today' }, { n: 'Sam', b: 'week' }
    ];
    var preview = WHATS_NEW.preview ? '<div class="ip-wn-prev" aria-label="Example: three friends with activity dots">' + demo.map(function (f) {
      return '<div class="ip-row"><span class="ip-av">' + f.n.charAt(0) + '<span class="ip-dot ip-' + f.b + '" style="width:12px;height:12px" aria-hidden="true"></span></span>' +
        '<span class="ip-nm">' + f.n + '</span><span class="ip-when ip-w-' + f.b + '">' + LABEL[f.b] + '</span></div>';
    }).join('') + '</div>' : '';
    var items = WHATS_NEW.items(admin).map(function (it) {
      return '<div class="ip-wn-it"><span class="ip-wn-ic">' + (ICONS[it.icon] || '') + '</span><span><b>' + esc(it.title) + '</b><small>' + esc(it.body) + '</small></span></div>';
    }).join('');
    var el = document.createElement('div');
    el.id = 'ip-wn';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'ip-wn-title');
    el.innerHTML = '<div class="ip-wn-in">' +
      '<span class="ip-wn-tag">WHAT’S NEW · ' + esc(WHATS_NEW.id) + '</span>' +
      '<h2 id="ip-wn-title">' + esc(WHATS_NEW.title) + '</h2><p>' + esc(WHATS_NEW.sub) + '</p>' +
      preview + '<div class="ip-wn-items">' + items + '</div>' +
      '<button type="button" class="ip-wn-ok" id="ip-wn-ok">Got it</button></div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('on'); });
    var ok = document.getElementById('ip-wn-ok');
    if (ok) { ok.onclick = closeWhatsNew; try { ok.focus(); } catch (e) {} }
  }
  function closeWhatsNew() {
    lsSet('innings_whatsnew_seen', WHATS_NEW.id);
    var u = me();
    if (u && window.db) window.db.collection('users').doc(u.uid).set({ whatsNewSeen: WHATS_NEW.id }, { merge: true }).catch(function (err) { console.error('[whats new] save', err); });
    if (window.userData) window.userData.whatsNewSeen = WHATS_NEW.id;
    var el = document.getElementById('ip-wn');
    if (!el) return;
    el.classList.remove('on');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
  }
  window.ipShowWhatsNew = showWhatsNew;
})();
