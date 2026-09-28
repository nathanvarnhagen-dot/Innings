// ── WATCHING + LIVE FEED — a per-user, per-game flag stored at
// users/{uid}/watching/{gamePk}, same owned-subcollection shape as the
// existing users/{uid}/moments and users/{uid}/private/friends, so it
// should already fall under whatever rule covers those. Feed polls the
// box score for anything on the list while the Feed screen is open.

function _refreshGameWatchButton(gamePk) {
  _gattLoad(gamePk);
}


// Tells any of my friends who are already watching this exact game that
// I just joined them — the other direction of the same friend/watching
// cross-reference _friendsWatchingGame already does for the "Jason is
// watching too" line on the Live Feed card and game detail header.
function _notifyFriendsAlreadyWatching(g) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  _friendsWatchingGame(g.gamePk).then(function (uids) {
    if (!uids.length) return;
    var myName = (window.userData && window.userData.name) || 'Someone';
    var batch = window.db.batch();
    uids.forEach(function (uid) {
      batch.set(window.db.collection('notifications').doc(), {
        toUid: uid,
        type: 'game_watch_joined',
        fromUid: user.uid,
        fromName: myName,
        gamePk: g.gamePk,
        away: g.away || null,
        home: g.home || null,
        sport: g.sport || 'mlb',
        ts: Date.now(),
        read: false
      });
    });
    batch.commit().catch(function (err) { console.error('Notify watch-joined error:', err); });
  }).catch(function (err) { console.error('Notify watch-joined lookup error:', err); });
}

window._watchingStarted = false;
window._watchingList = [];
window._liveFeedCache = [];
// uid -> first name, so a 30-second render tick doesn't re-read the same
// handful of user docs over and over just to label the avatars.
window._friendNameCache = {};
// Friends' watching lists, refreshed on a timer rather than with a live
// listener per friend: one listener per friend would mean N open sockets
// for something that only needs to feel fresh within half a minute.
window._friendsWatchingCache = { at: 0, byGame: {} };

function startWatchingList() {
  if (window._watchingStarted) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  window._watchingStarted = true;
  window.db.collection('users').doc(user.uid).collection('watching').onSnapshot(function (snap) {
    var arr = [];
    snap.forEach(function (doc) { arr.push(Object.assign({ _id: doc.id }, doc.data())); });
    var sig = arr.map(function (w) { return w._id + ':' + (w.mode || ''); }).sort().join(',');
    var changed = window._watchingSig !== sig;
    window._watchingList = arr; window._watchingSig = sig;
    try { localStorage.setItem('innings_watching_ids', JSON.stringify(arr.map(function (w) { return String(w.gamePk != null ? w.gamePk : w._id); }))); } catch (e) {}
    renderLiveFeed();
    var gs = document.getElementById('screen-games');
    if (changed && gs && gs.classList.contains('active') && typeof loadGamesList === 'function') loadGamesList(window._gamesDate, { silent: true });
  }, function (err) {
    console.error('Watching list error:', err);
    window._watchingStarted = false;
  });
  renderLiveFeed(); // friends' games shouldn't wait on my own list arriving
  if (!window._liveFeedInterval) window._liveFeedInterval = setInterval(renderLiveFeed, 30000);
}

// My accepted friends, both directions of the friendRequests edge.
// Deliberately re-queried rather than read off window._myFriendUids: that
// shared cache has no invalidation, so once set it never picks up a
// friendship accepted later in the same session.
function _loadFriendUids() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return Promise.resolve([]);
  return Promise.all([
    window.db.collection('friendRequests').where('fromUid', '==', user.uid).where('status', '==', 'accepted').get(),
    window.db.collection('friendRequests').where('toUid', '==', user.uid).where('status', '==', 'accepted').get()
  ]).then(function (results) {
    var uids = [];
    results[0].forEach(function (d) { uids.push(d.data().toUid); });
    results[1].forEach(function (d) { uids.push(d.data().fromUid); });
    uids = uids.filter(function (v, i) { return v && uids.indexOf(v) === i; });
    window._myFriendUids = uids; // still populated for other consumers (loadMyFriendsList, etc.)
    return uids;
  }).catch(function (err) { console.error('Load friends list error:', err); return []; });
}

// Everything my friends are watching, keyed by gamePk. This LISTS each
// friend's users/{uid}/watching subcollection rather than reading one doc
// out of it, so the Firestore rule covering that path has to allow list,
// not just get — if this logs permission-denied, that's the first thing
// to check.
function _loadFriendsWatching(force) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return Promise.resolve({});
  var now = Date.now();
  var cached = window._friendsWatchingCache;
  if (!force && cached.at && (now - cached.at) < 25000) return Promise.resolve(cached.byGame);
  return _loadFriendUids().then(function (uids) {
    if (!uids.length) { window._friendsWatchingCache = { at: now, byGame: {} }; return {}; }
    return Promise.all(uids.map(function (uid) {
      return window.db.collection('users').doc(uid).collection('watching').get()
        .then(function (snap) { return { uid: uid, snap: snap }; })
        .catch(function (err) { console.error('Read friend watching list error for', uid, err); return null; });
    })).then(function (results) {
      var byGame = {};
      results.filter(Boolean).forEach(function (r) {
        r.snap.forEach(function (doc) {
          var d = doc.data() || {};
          var pk = d.gamePk != null ? d.gamePk : doc.id;
          var key = String(pk);
          if (!byGame[key]) {
            byGame[key] = { g: { gamePk: pk, sport: d.sport || 'mlb', away: d.away || null, home: d.home || null, date: d.date || null }, uids: [] };
          }
          if (byGame[key].uids.indexOf(r.uid) === -1) byGame[key].uids.push(r.uid);
        });
      });
      window._friendsWatchingCache = { at: Date.now(), byGame: byGame };
      return byGame;
    });
  }).catch(function (err) { console.error('Friends watching lookup error:', err); return {}; });
}

// First names for the avatar stack, fetched once per uid per session.
function _friendDisplayNames(uids) {
  var missing = uids.filter(function (u) { return !window._friendNameCache[u]; });
  if (!missing.length || !window.db) return Promise.resolve();
  return Promise.all(missing.map(function (u) {
    return window.db.collection('users').doc(u).get()
      .then(function (d) { window._friendNameCache[u] = (((d.data() || {}).name) || 'A friend').split(' ')[0]; })
      .catch(function (err) { console.error('Load friend name error for', u, err); window._friendNameCache[u] = 'A friend'; });
  })).then(function () {});
}

// 'live' | 'soon' | null. A finished game drops off the feed, and an
// upcoming one only earns a slot once it's close enough to be worth
// planning around — otherwise a friend marking next Sunday's game would
// sit at the top of the feed all week.
var LIVE_FEED_SOON_MINUTES = 12 * 60;
function _liveFeedState(box) {
  if (!box || box.error) return null;
  var status = box.status || '';
  if (_isGameStatusLive(status)) return 'live';
  if (_isGameConcluded(status)) return null;
  var s = String(status).toLowerCase();
  if (s.indexOf('postponed') !== -1 || s.indexOf('cancel') !== -1 || s.indexOf('suspended') !== -1) return null;
  var t = box.startTime ? Date.parse(box.startTime) : NaN;
  if (isNaN(t)) return null;
  var mins = (t - Date.now()) / 60000;
  return (mins <= LIVE_FEED_SOON_MINUTES && mins >= -60) ? 'soon' : null;
}

// One card per game that either I or a friend has marked Watching. Mine
// and theirs are merged on gamePk first, so a game we're both watching is
// one card that says so rather than two.
function renderLiveFeed() {
  var section = document.getElementById('feed-live-feed-section');
  var list = document.getElementById('feed-live-feed-list');
  if (!section || !list) return;
  var hide = function () { section.style.display = 'none'; list.innerHTML = ''; window._liveFeedCache = []; };

  _loadFriendsWatching().then(function (byGame) {
    var merged = {};
    (window._watchingList || []).forEach(function (g) {
      merged[String(g.gamePk)] = { g: g, mine: true, uids: [] };
    });
    Object.keys(byGame).forEach(function (key) {
      if (merged[key]) merged[key].uids = byGame[key].uids.slice();
      else merged[key] = { g: byGame[key].g, mine: false, uids: byGame[key].uids.slice() };
    });
    var entries = Object.keys(merged).map(function (k) { return merged[k]; });
    if (!entries.length) { hide(); return; }

    return Promise.all(entries.map(function (e) {
      return fetch(_bsModalBoxscoreUrl(e.g.sport || 'mlb', e.g.gamePk))
        .then(function (r) { return r.json(); })
        .then(function (box) { return Object.assign({ box: box }, e); })
        .catch(function () { return Object.assign({ box: null }, e); });
    })).then(function (results) {
      var shown = [];
      results.forEach(function (r) {
        var state = _liveFeedState(r.box);
        if (state) { r.state = state; shown.push(r); }
      });
      // Live before upcoming, my own before a friend's, then by start time.
      shown.sort(function (a, b) {
        if (a.state !== b.state) return a.state === 'live' ? -1 : 1;
        if (a.mine !== b.mine) return a.mine ? -1 : 1;
        var at = (a.box && a.box.startTime) ? Date.parse(a.box.startTime) : 0;
        var bt = (b.box && b.box.startTime) ? Date.parse(b.box.startTime) : 0;
        return (at || 0) - (bt || 0);
      });
      window._liveFeedCache = shown;
      if (!shown.length) { hide(); return; }
      var allUids = [];
      shown.forEach(function (r) {
        r.uids.forEach(function (u) { if (allUids.indexOf(u) === -1) allUids.push(u); });
      });
      return _friendDisplayNames(allUids).then(function () {
        section.style.display = 'flex';
        list.innerHTML = shown.map(function (r, i) { return _liveFeedCardHtml(r, i); }).join('');
      });
    });
  }).catch(function (err) { console.error('Live feed render error:', err); });
}

// Substring/case-insensitive rather than an exact-match list// Substring/case-insensitive rather than an exact-match list — MLB and
// ESPN (NFL/CFB/etc.) don't use identical status strings (e.g. ESPN's
// "Final/OT" vs MLB's plain "Final", or "Canceled" vs "Cancelled"), so
// matching on the not-live SIGNAL WORDS covers both without needing a
// separate enumerated list per sport.
var GAME_NOT_LIVE_SIGNALS = ['scheduled', 'pre-game', 'pregame', 'warmup', 'delayed start', 'final', 'game over', 'completed', 'postponed', 'cancel', 'suspended'];
function _isGameStatusLive(status) {
  if (!status) return false;
  var s = String(status).toLowerCase();
  return !GAME_NOT_LIVE_SIGNALS.some(function (sig) { return s.indexOf(sig) !== -1; });
}

function _liveFeedCardHtml(r, i) {
  var box = r.box;
  var live = r.state === 'live';
  var away = (box && box.away) || r.g.away || '?';
  var home = (box && box.home) || r.g.home || '?';
  var accent = live ? '#7CF29C' : '#A89FE8';
  var border = live ? 'rgba(124,242,156,.28)' : 'rgba(168,159,232,.28)';
  var meta = live
    ? ((box && box.status) || 'In Progress')
    : (((box && box.startTime && _formatGameTime(box.startTime)) || 'Starting soon'));
  var scoreLabel = (live && box && box.awayScore != null && box.homeScore != null) ? (box.awayScore + '–' + box.homeScore) : '';
  var names = r.uids.map(function (u) { return window._friendNameCache[u] || 'A friend'; });
  var watchers = '';
  if (names.length) {
    watchers = '<div style="display:flex;align-items:center;gap:7px;margin-top:6px">' +
      '<div class="wa-stack" style="display:flex;align-items:center">' + _watchingAvatarsHtml(names, 2) + '</div>' +
      '<div style="font-size:11px;color:#A89FE8;font-weight:600">' +
      _escapeHtml(r.mine ? _friendsWatchingLabel(names) : _friendsOnlyWatchingLabel(names)) + '</div></div>';
  }
  return '<div onclick="openLiveFeedGame(' + i + ')" style="background:rgba(255,255,255,.055);border:1px solid ' + border + ';border-radius:16px;padding:12px 14px;display:flex;align-items:flex-start;gap:12px;cursor:pointer">' +
    '<span style="width:7px;height:7px;border-radius:50%;background:' + accent + ';flex-shrink:0;' + (live ? 'box-shadow:0 0 6px 1px rgba(124,242,156,.6);' : '') + 'margin-top:6px"></span>' +
    '<div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:700;color:#fff">' + _escapeHtml(away) + ' @ ' + _escapeHtml(home) + '</div>' +
    '<div style="font-size:11px;color:' + (live ? '#9be8ac' : '#B9B3E6') + ';margin-top:2px;font-weight:600">' + _escapeHtml(meta) + '</div>' +
    watchers + '</div>' +
    (scoreLabel ? '<div style="font-size:15px;font-weight:800;color:#fff;flex-shrink:0;margin-top:1px">' + _escapeHtml(scoreLabel) + '</div>' : '') +
    '</div>';
}

// Small overlapping avatar circles with 2-letter initials — same visual
// language as the full-size friend avatars elsewhere (_initials()),
// just sized to sit inline. Caps at `max` shown, collapsing anyone past
// that into a "+N" bubble instead of letting the row grow unbounded.
function _watchingAvatarsHtml(names, max) {
  max = max || 2;
  var shown = names.slice(0, max);
  var extra = names.length - shown.length;
  var html = shown.map(function (nm) {
    return '<div class="wa" title="' + _escapeHtml(nm) + '">' + _escapeHtml(_initials(nm)) + '</div>';
  }).join('');
  if (extra > 0) html += '<div class="wa-more">+' + extra + '</div>';
  return html;
}

// Which of my accepted friends have this exact game marked Watching —
// a direct per-friend existence check, used by the game screen's header
// row and the watch-joined notification. The feed uses _loadFriendsWatching
// instead, which reads each friend's whole list in one go.
function _friendsWatchingGame(gamePk) {
  return _loadFriendUids().then(function (uids) {
    if (!uids.length) return [];
    return Promise.all(uids.map(function (uid) {
      return window.db.collection('users').doc(uid).collection('watching').doc(String(gamePk)).get()
        .then(function (doc) { return doc.exists ? uid : null; })
        .catch(function (err) { console.error('Check friend watching doc error for', uid, err); return null; });
    }));
  }).then(function (results) { return results.filter(Boolean); });
}

// "…is watching too" is for a game I'm in as well; this one is for a game
// only they are on, which is most of what the feed now shows.
function _friendsOnlyWatchingLabel(names) {
  if (names.length === 1) return names[0] + ' is watching';
  if (names.length === 2) return names[0] + ' and ' + names[1] + ' are watching';
  return names[0] + ' and ' + (names.length - 1) + ' others are watching';
}

function _friendsWatchingLabel(names) {
  if (names.length === 1) return names[0] + ' is watching too';
  if (names.length === 2) return names[0] + ' and ' + names[1] + ' are watching too';
  return names[0] + ' and ' + (names.length - 1) + ' others are watching too';
}

// Same idea as _friendsWatchingLabel above but phrased to match the game
// detail header's avatar stack specifically: that stack shows up to 2
// faces then a "+N" bubble, so past 2 names this names the first two and
// counts the rest — rather than "and N others", which wouldn't line up
// with what the avatars actually show.
function _watchingWithLabel(names) {
  if (names.length === 1) return names[0] + ' is also watching';
  if (names.length === 2) return names[0] + ' and ' + names[1] + ' are also watching';
  return names[0] + ', ' + names[1] + ' +' + (names.length - 2) + ' more also watching';
}

// Which friends are on this game, for every surface that says so: the row
// under the title, the count on the Chat tab, and the faces at the top of
// the chat. One lookup, three renderers — they were going to disagree
// otherwise, and it's the same two Firestore round trips either way.
// Works for any sport, since a watching doc is keyed by gamePk whatever
// league it came from.
window._gameWatchers = { gamePk: null, people: [] };

function _loadWatchingWithRow(gamePk) {
  _friendsWatchingGame(gamePk).then(function (uids) {
    if (!window._activeBrowseGame || window._activeBrowseGame.gamePk != gamePk) return; // superseded
    if (!uids.length) {
      window._gameWatchers = { gamePk: gamePk, people: [] };
      _renderGameWatchers(gamePk);
      return;
    }
    Promise.all(uids.map(function (uid) { return window.db.collection('users').doc(uid).get(); }))
      .then(function (docs) {
        if (!window._activeBrowseGame || window._activeBrowseGame.gamePk != gamePk) return;
        window._gameWatchers = {
          gamePk: gamePk,
          people: docs.map(function (d) {
            var data = d.data() || {};
            return { uid: d.id, name: data.name || 'A friend', first: String(data.name || 'A friend').split(' ')[0] };
          })
        };
        _renderGameWatchers(gamePk);
      }).catch(function (err) { console.error('Load watching-with names error:', err); });
  }).catch(function (err) { console.error('Watching-with lookup error:', err); });
}

function _renderGameWatchers(gamePk) {
  if (!window._activeBrowseGame || window._activeBrowseGame.gamePk != gamePk) return;
  var people = (window._gameWatchers && window._gameWatchers.gamePk == gamePk) ? window._gameWatchers.people : [];
  var names = people.map(function (p) { return p.first; });

  var rowEl = document.getElementById('game-watching-with-row');
  if (rowEl) {
    if (!people.length) rowEl.style.display = 'none';
    else {
      var avatarsEl = document.getElementById('game-watching-with-avatars');
      var textEl = document.getElementById('game-watching-with-text');
      if (avatarsEl) avatarsEl.innerHTML = _watchingAvatarsHtml(names, 2);
      if (textEl) textEl.textContent = _watchingWithLabel(names);
      rowEl.style.display = 'flex';
    }
  }
  _renderChatTabCount(people.length);

  var strip = document.getElementById('game-chat-watchers');
  var label = document.getElementById('game-chat-watchers-label');
  var faces = document.getElementById('game-chat-watchers-row');
  if (!strip || !label || !faces) return;
  if (!people.length) { strip.style.display = 'none'; faces.innerHTML = ''; return; }
  label.textContent = people.length === 1 ? '1 friend watching' : people.length + ' friends watching';
  faces.innerHTML = people.map(function (p) {
    return '<div onclick="openUserProfile(\'' + String(p.uid).replace(/'/g, "\\'") + '\')" style="display:flex;flex-direction:column;align-items:center;gap:5px;width:56px;flex-shrink:0;cursor:pointer">' +
      '<div style="width:40px;height:40px;border-radius:50%;background:rgba(168,159,232,.22);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#CECBF6">' + _escapeHtml(_initials(p.name)) + '</div>' +
      '<div style="font-size:11px;font-weight:600;color:var(--mid);text-align:center;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:56px">' + _escapeHtml(p.first) + '</div>' +
      '</div>';
  }).join('');
  strip.style.display = 'flex';
}

// The Chat tab carries the count so you can see friends are in there
// without opening it. cssText gets reassigned on every tab switch, so the
// count lives in the button's content rather than in a style.
function _renderChatTabCount(n) {
  var btn = document.getElementById('game-tab-chat');
  if (!btn) return;
  btn.innerHTML = 'Chat' + (n > 0
    ? '<span style="display:inline-flex;align-items:center;justify-content:center;min-width:17px;height:17px;padding:0 5px;margin-left:6px;border-radius:9px;background:rgba(124,242,156,.2);color:#9be8ac;font-size:10.5px;font-weight:800;vertical-align:1px">' + n + '</span>'
    : '');
}

function openLiveFeedGame(i) {
  var r = (window._liveFeedCache || [])[i];
  if (!r) return;
  var away = (r.box && r.box.away) || r.g.away;
  var home = (r.box && r.box.home) || r.g.home;
  openGameScreen(r.g.gamePk, away, home, r.g.sport || 'mlb', r.g.date || null);
}
