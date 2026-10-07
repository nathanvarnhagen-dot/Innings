// ═══ WATCHING / ATTENDING (v5.66.0) ══════════════════════════════════
// Two options in the game header's top-right corner, worded by the game's
// state (Going to watch / Attending → Watching / Attending → Watched /
// Attended). Stored on the same users/{uid}/watching/{gamePk} doc the old
// Watch button used — its existence still means "on my watch list" for the
// Live Feed and the friends-watching features — plus a `mode` field and,
// once saved, the `momentId` of the memory made from it.
window._gatt = { gamePk: null, mode: null, momentId: null, moment: null, phase: null, busy: false, token: 0, draft: null, friends: null, q: '' };
var _GATT_WORDS = {
  pre: { watch: 'Going to watch', attend: 'Attending' },
  live: { watch: 'Watching', attend: 'Attending' },
  final: { watch: 'Watched', attend: 'Attended' }
};
var _GATT_HINT = {
  pre: 'The final score fills in after the game.',
  live: 'The score keeps updating until the final.',
  final: 'Your memory gets the final score and top plays.'
};
var _GATT_ICON = {
  watch: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M12 18v3"/></svg>',
  attend: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10l9-6 9 6"/><path d="M5 10v9h14v-9"/><path d="M9 19v-5h6v5"/></svg>'
};
var _GATT_COLORS = ['#A89FE8', '#F2C869', '#7CF29C', '#FF9A8E', '#7FC8F8', '#E8A1F0', '#FFB86B', '#9BE8D8'];
function _gattUser() { return window.currentUser || (window.auth && window.auth.currentUser) || null; }
function _gattRef(user, gamePk) { return window.db.collection('users').doc(user.uid).collection('watching').doc(String(gamePk)); }
function _gattGameKey(g) { return (g.sport || 'mlb') + ':' + String(g.gamePk); }
function _gattColor(key) { var h = 0; String(key || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return _GATT_COLORS[h % _GATT_COLORS.length]; }
function _gattInitial(name) { return String(name || '?').trim().charAt(0).toUpperCase() || '?'; }
function _gattPhase() {
  var s = window._gatt;
  if (s.phase) return s.phase;
  var g = window._activeBrowseGame;
  var d = g && g.date;
  return (d && d < _todayLocal()) ? 'final' : 'pre';
}
function _gattSeatText(seat) {
  if (!seat) return '';
  var p = [];
  if (seat.section) p.push('Sec ' + seat.section);
  if (seat.row) p.push('Row ' + seat.row);
  if (seat.seat) p.push('Seat ' + seat.seat);
  return p.join(' · ');
}
// Names stored on the memory are a snapshot from when it was saved; a
// friend who has since renamed (Alex → Alexa) would show stale there
// while chat shows the live name. Prefer the live profile per uid.
function _gattLiveNames(m) {
  var live = window._myFriendProfiles || {};
  var uids = m.taggedUids || [];
  return (m.people || []).map(function (n, i) { return (uids[i] && live[uids[i]]) || n; });
}
function _gattWithText(names) {
  names = (names || []).filter(Boolean).map(function (n) { return String(n).split(' ')[0]; });
  if (!names.length) return '';
  if (names.length === 1) return 'with ' + names[0];
  if (names.length === 2) return 'with ' + names[0] + ' and ' + names[1];
  return 'with ' + names[0] + ' and ' + (names.length - 1) + ' others';
}

// Both hero renderers call this with their model, which carries the real
// phase and the team abbreviations for the short phone title.
function _gattNoteModel(m) {
  if (!m) return;
  var s = window._gatt, g = window._activeBrowseGame;
  if (!g || String(s.gamePk) !== String(g.gamePk)) return;
  var ph = (m.phase === 'pre' || m.phase === 'live' || m.phase === 'final') ? m.phase : null;
  if (ph && ph !== s.phase) { s.phase = ph; setTimeout(_gattRender, 0); }
  if (m.away && m.home && m.away.abbr && m.home.abbr) {
    var el = document.getElementById('game-detail-title-short');
    var txt = m.away.abbr + ' @ ' + m.home.abbr;
    if (el && el.textContent !== txt) el.textContent = txt;
  }
}

function _gattLoad(gamePk) {
  var s = window._gatt;
  s.gamePk = gamePk; s.mode = null; s.momentId = null; s.moment = null; s.phase = null; s.busy = false;
  s.showStrip = false; clearTimeout(s.stripTimer); s.stripTimer = null; s.stripUntil = 0;
  s.token = Date.now();
  var tok = s.token;
  _gattRender();
  var user = _gattUser();
  if (!user || !window.db) return;
  var g = window._activeBrowseGame;
  _gattRef(user, gamePk).get().then(function (doc) {
    if (s.token !== tok) return;
    if (doc.exists) {
      var d = doc.data() || {};
      s.mode = d.mode === 'attend' ? 'attend' : 'watch'; // docs from the old Watch button have no mode
      s.momentId = d.momentId || null;
      _gattRender();
    }
    return _gattFindMoment(user, g, s.momentId).then(function (m) {
      if (s.token !== tok) return;
      s.moment = m;
      s.momentId = m ? m._id : null;
      _gattRender();
      if (m && (m.taggedUids || []).length && typeof _ensureMyFriendsLoaded === 'function') {
        _ensureMyFriendsLoaded(function () { if (s.token === tok) _gattRender(); });
      }
    });
  }).catch(function (err) { console.error('[attend] load failed:', err); });
}
// The saved id first; otherwise any memory already made for this game
// (on another device, or before the choice was cleared), so re-picking
// never makes a duplicate.
function _gattFindMoment(user, g, id) {
  var col = window.db.collection('users').doc(user.uid).collection('moments');
  var byKey = function () {
    if (!g) return Promise.resolve(null);
    return col.where('gameKey', '==', _gattGameKey(g)).limit(1).get().then(function (snap) {
      var hit = null;
      snap.forEach(function (d) { hit = Object.assign({ _id: d.id }, d.data()); });
      return hit;
    });
  };
  if (!id) return byKey();
  return col.doc(id).get().then(function (d) { return d.exists ? Object.assign({ _id: d.id }, d.data()) : byKey(); });
}

function _gattRender() {
  var s = window._gatt;
  var words = _GATT_WORDS[_gattPhase()];
  var opts = document.getElementById('game-att-opts');
  if (opts) {
    opts.innerHTML = ['watch', 'attend'].map(function (k) {
      var on = s.mode === k;
      return '<button class="gatt-opt' + (on ? ' on' : '') + '" aria-pressed="' + on + '"' + (s.busy ? ' disabled' : '') + ' onclick="gattChoose(\'' + k + '\')">' + _GATT_ICON[k] + words[k] + '</button>';
    }).join('');
  }
  var strip = document.getElementById('game-att-strip');
  if (!strip) return;
  if (!s.mode || !s.showStrip) { strip.className = 'gatt-strip'; strip.innerHTML = ''; return; }
  strip.className = 'gatt-strip on';
  // v5.82.0: the strip stays 5 seconds, then folds away; tapping Watching
  // or Attending again brings it back for another 5.
  if (!s.stripUntil) s.stripUntil = Date.now() + 5000;
  clearTimeout(s.stripTimer);
  s.stripTimer = setTimeout(_gattStripFold, Math.max(0, s.stripUntil - Date.now()));
  if (s.moment) {
    var m = s.moment;
    var uids = (m.taggedUids || []);
    var people = _gattLiveNames(m);
    var bits = [m.attendance === 'watch' ? (m.watchedAt ? 'at ' + m.watchedAt : '') : _gattSeatText(m.seat), _gattWithText(people)].filter(Boolean).join(' · ');
    // It's your memory, so your own face leads the stack; tagged friends follow.
    var me = _gattUser();
    var myName = (window.userData && window.userData.name) || 'You';
    var faces = [{ key: me ? me.uid : 'me', name: myName }].concat(people.map(function (n, i) { return { key: uids[i] || n, name: n }; }));
    var stack = faces.filter(function (f) { return f.name; }).slice(0, 3).map(function (f) { return '<span class="gatt-av" style="background:' + _gattColor(f.key) + '">' + _escapeHtml(_initials(f.name)) + '</span>'; }).join('');
    strip.innerHTML = (stack ? '<span class="gatt-stack" aria-hidden="true">' + stack + '</span>' : '') +
      '<button class="gatt-txt" onclick="gattOpenMemory()">Memory saved<small>' + _escapeHtml(bits || 'Tap to open') + '</small></button>' +
      '<button class="gatt-add edit" onclick="gattOpenSheet()">Edit</button>';
  } else {
    strip.innerHTML = '<div class="gatt-txt">' + _escapeHtml(words[s.mode]) + '<small>' + (s.mode === 'attend' ? 'Save your seat and who you went with' : 'Save who you watched with') + '</small></div>' +
      '<button class="gatt-add" onclick="gattOpenSheet()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Add memory</button>';
  }
}


function _gattStripFold() {
  var s = window._gatt, strip = document.getElementById('game-att-strip');
  if (!strip || !s.showStrip) return;
  if (document.querySelector('.gatt-backdrop.on')) { s.stripUntil = Date.now() + 5000; _gattRender(); return; } // not while the memory sheet is open
  var done = function () { strip.removeEventListener('animationend', done); s.showStrip = false; s.stripUntil = 0; _gattRender(); };
  if (_ghReducedMotion && _ghReducedMotion()) { done(); return; }
  strip.style.maxHeight = strip.offsetHeight + 'px';
  strip.classList.add('leaving');
  strip.addEventListener('animationend', done);
  setTimeout(function () { if (strip.classList.contains('leaving')) done(); }, 700);
}

function gattChoose(mode) {
  var s = window._gatt, g = window._activeBrowseGame;
  if (!g || s.busy) return;
  var user = _gattUser();
  if (!user || !window.db) { if (typeof ib_toast === 'function') ib_toast('Sign in to track games'); return; }
  var ref = _gattRef(user, g.gamePk);
  var prev = s.mode;
  var op;
  // v5.81.0: tapping your current choice again brings back the memory
  // strip (it's hidden on a fresh load); tapping it while the strip is
  // open clears the choice, as before.
  if (prev === mode && !s.showStrip) { s.showStrip = true; s.stripUntil = 0; _gattRender(); return; }
  s.busy = true;
  if (prev === mode) {
    // Clearing the choice takes the game off your watch list. A memory
    // already made stays in Memories and shows up again if you re-pick.
    s.mode = null;
    _gattRender();
    op = ref.delete();
  } else {
    s.mode = mode;
    s.showStrip = true; s.stripUntil = 0;
    _gattRender();
    var data = { gamePk: g.gamePk, sport: g.sport || 'mlb', away: g.away || null, home: g.home || null, date: g.date || null, mode: mode };
    if (!prev) data.addedAt = Date.now();
    if (s.momentId) data.momentId = s.momentId;
    op = ref.set(data, { merge: true }).then(function () {
      if (!prev) {
        if (window._friendsWatchingCache) window._friendsWatchingCache.at = 0;
        if (typeof _notifyFriendsAlreadyWatching === 'function') _notifyFriendsAlreadyWatching(g);
      }
      if (s.moment && s.moment.attendance !== mode) {
        s.moment.attendance = mode;
        return window.db.collection('users').doc(user.uid).collection('moments').doc(s.momentId).update({ attendance: mode });
      }
    });
  }
  op.then(function () { s.busy = false; _gattRender(); }).catch(function (err) {
    console.error('[attend] save choice failed:', err);
    s.busy = false; s.mode = prev; _gattRender();
    if (typeof ib_toast === 'function') ib_toast('Couldn\'t save that — try again');
  });
}

function gattOpenMemory() {
  var s = window._gatt;
  if (s.momentId && typeof openMemory === 'function') openMemory(s.momentId, 'game');
}

function gattOpenSheet() {
  var s = window._gatt, g = window._activeBrowseGame;
  if (!g || !s.mode) return;
  var m = s.moment;
  var seat = (m && m.seat) || {};
  s.draft = {
    section: seat.section || '', row: seat.row || '', seat: seat.seat || '',
    where: (m && m.watchedAt) || '',
    friends: m ? (m.taggedUids || []).filter(Boolean) : [],
    players: m ? (m.players || []).map(function (p) { return Object.assign({}, p); }) : [],
    note: (m && m.highlight) || ''
  };
  s.q = '';
  _gattRenderSheet();
  document.getElementById('gatt-backdrop').classList.add('on');
  if (!s.friends) {
    _ensureMyFriendsLoaded(function (profiles) {
      s.friends = Object.keys(profiles || {}).map(function (uid) { return { uid: uid, name: profiles[uid] }; })
        .sort(function (a, b) { return a.name.localeCompare(b.name); });
      _gattRenderFriends();
    });
  }
}
function gattCloseSheet() {
  var b = document.getElementById('gatt-backdrop');
  if (b) b.classList.remove('on');
}
function _gattRenderSheet() {
  var s = window._gatt, g = window._activeBrowseGame, d = s.draft;
  var ph = _gattPhase(), att = s.mode === 'attend';
  var title = (g.away && g.home) ? _teamShortName(g.away) + ' @ ' + _teamShortName(g.home) : 'This game';
  var when = g.date ? _formatMomentDate(g.date) : '';
  var fld = function (k, label, ph2, mode) {
    return '<label class="gatt-fld">' + label + '<input class="gatt-in" data-f="' + k + '" inputmode="' + mode + '" maxlength="8" autocomplete="off" placeholder="' + ph2 + '" value="' + _escapeHtml(d[k]) + '"></label>';
  };
  var el = document.getElementById('gatt-sheet');
  el.innerHTML = '<div class="gatt-grab" aria-hidden="true"></div>' +
    '<div class="gatt-hd"><h3 id="gatt-title">' + (s.moment ? 'Edit memory' : 'Add memory') + '</h3><button class="gatt-x" onclick="gattCloseSheet()" aria-label="Close"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
    '<div class="gatt-body">' +
      '<div class="gatt-game"><div><b>' + _escapeHtml(title) + '</b><span>' + _escapeHtml(when) + '</span></div><span class="gatt-tag">' + _escapeHtml(_GATT_WORDS[ph][s.mode]) + '</span></div>' +
      (att
        ? '<div><div class="gatt-lbl">Where you sat<span>Optional</span></div><div class="gatt-seats">' + fld('section', 'Section', '118', 'text') + fld('row', 'Row', '12', 'text') + fld('seat', 'Seat', '4', 'numeric') + '</div></div>'
        : '<label class="gatt-fld"><span class="gatt-lbl" style="margin-bottom:4px;color:#F5F3FF">Where you watched<span>Optional</span></span><input class="gatt-in" data-f="where" maxlength="60" autocomplete="off" placeholder="Harriet\'s place" value="' + _escapeHtml(d.where) + '"></label>') +
      '<div><div class="gatt-lbl">Who you\'re with<span id="gatt-cnt"></span></div>' +
        '<div class="gatt-fld gatt-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
          '<input class="gatt-in" data-q="1" autocomplete="off" placeholder="Search friends" aria-label="Search friends"></div>' +
        '<div class="gatt-friends" id="gatt-friends"></div><div class="gatt-sel" id="gatt-sel"></div></div>' +
      '<div><div class="gatt-lbl">Players you saw<span id="gatt-pcnt"></span></div><div class="gatt-players" id="gatt-players"></div></div>' +
      '<label class="gatt-fld"><span class="gatt-lbl" style="margin-bottom:4px;color:#F5F3FF">A note<span>Optional</span></span><textarea class="gatt-in" data-f="note" maxlength="500" placeholder="' + (att ? 'First game with the crew…' : 'Yelling at the TV together…') + '">' + _escapeHtml(d.note) + '</textarea></label>' +
      '<div class="gatt-note">' + _GATT_HINT[ph] + ' Everyone you tag gets this memory too.</div>' +
    '</div>' +
    '<div class="gatt-ft"><button class="gatt-save" id="gatt-save" onclick="gattSave()">' + (s.moment ? 'Save changes' : 'Save memory') + '</button></div>';
  el.oninput = function (e) {
    var t = e.target;
    if (t.getAttribute('data-q')) { s.q = t.value; _gattRenderFriends(); return; }
    var k = t.getAttribute('data-f');
    if (k) s.draft[k] = t.value;
  };
  _gattRenderFriends();
  if (typeof _gattRenderPlayers === 'function') _gattRenderPlayers();
}
function _gattRenderFriends() {
  var s = window._gatt, d = s.draft;
  var box = document.getElementById('gatt-friends');
  if (!box || !d) return;
  var all = s.friends;
  var cnt = document.getElementById('gatt-cnt');
  if (cnt) cnt.textContent = d.friends.length ? d.friends.length + ' tagged' : 'Optional';
  var sel = document.getElementById('gatt-sel');
  if (!all) { box.innerHTML = '<span class="gatt-sel">Loading friends…</span>'; if (sel) sel.textContent = ''; return; }
  if (!all.length) { box.innerHTML = '<span class="gatt-sel">Add friends from your profile to tag them here.</span>'; if (sel) sel.textContent = ''; return; }
  var q = (s.q || '').trim().toLowerCase();
  var list = all.filter(function (f) { return !q || f.name.toLowerCase().indexOf(q) !== -1; });
  box.innerHTML = list.length ? list.map(function (f) {
    var on = d.friends.indexOf(f.uid) !== -1;
    return '<button class="gatt-fr' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-uid="' + _escapeHtml(f.uid) + '" onclick="gattToggleFriend(this.dataset.uid)">' +
      '<span class="gatt-av" style="background:' + _gattColor(f.uid) + '">' + _escapeHtml(_gattInitial(f.name)) +
      '<span class="gatt-tick"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg></span></span>' +
      '<span class="nm">' + _escapeHtml(String(f.name).split(' ')[0]) + '</span></button>';
  }).join('') : '<span class="gatt-sel">No friends match "' + _escapeHtml(s.q) + '".</span>';
  if (sel) {
    var names = d.friends.map(function (u) { var f = all.filter(function (x) { return x.uid === u; })[0]; return f ? f.name.split(' ')[0] : null; }).filter(Boolean);
    sel.textContent = names.length ? 'Tagging ' + names.join(', ') : '';
  }
}
function gattToggleFriend(uid) {
  var a = window._gatt.draft.friends, i = a.indexOf(uid);
  if (i === -1) a.push(uid); else a.splice(i, 1);
  _gattRenderFriends();
}

function gattSave() {
  var s = window._gatt, g = window._activeBrowseGame, d = s.draft;
  var user = _gattUser();
  if (!g || !d || !s.mode) return;
  if (!user || !window.db) { if (typeof ib_toast === 'function') ib_toast('Sign in first to save memories'); return; }
  var btn = document.getElementById('gatt-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  var nameOf = {};
  (s.friends || []).forEach(function (f) { nameOf[f.uid] = f.name; });
  (s.moment ? (s.moment.taggedUids || []) : []).forEach(function (u, i) { if (u && !nameOf[u]) nameOf[u] = s.moment.people[i]; });
  var uids = d.friends.slice();
  var people = uids.map(function (u) { return nameOf[u] || 'Friend'; });
  var trim = function (v) { return String(v || '').trim(); };
  var seat = null;
  if (s.mode === 'attend') {
    seat = { section: trim(d.section), row: trim(d.row), seat: trim(d.seat) };
    if (!seat.section && !seat.row && !seat.seat) seat = null;
  }
  var fields = {
    people: people,
    taggedUids: uids,
    highlight: trim(d.note),
    attendance: s.mode,
    seat: seat,
    watchedAt: s.mode === 'watch' ? (trim(d.where) || null) : null,
    // Tagged players — every field present (null, never undefined) so
    // Firestore takes it as-is.
    players: (d.players || []).map(function (p) {
      return { id: p.id != null && p.id !== '' ? String(p.id) : null, name: p.name || '', pos: p.pos || null, team: p.team || null, league: p.league || null };
    }).filter(function (p) { return p.name; })
  };
  var col = window.db.collection('users').doc(user.uid).collection('moments');
  var prevUids = s.moment ? (s.moment.taggedUids || []) : [];
  var tok = s.token;
  var p;
  if (s.moment) {
    var id = s.moment._id;
    p = col.doc(id).update(fields).then(function () { return Object.assign({}, s.moment, fields, { _id: id }); });
  } else {
    var sport = g.sport || 'mlb';
    var emoji = { mlb: '⚾', nfl: '🏈', cfb: '🏈', nba: '🏀', wnba: '🏀', nhl: '🏒', mls: '⚽', nwsl: '⚽' }[sport] || '🏆';
    var name = (g.away && g.home) ? _teamShortName(g.away) + ' @ ' + _teamShortName(g.home) : 'Game';
    // The box score is attached now even before first pitch or kickoff —
    // opening the memory later refreshes it until it's Final.
    p = fetch(_bsModalBoxscoreUrl(sport, g.gamePk)).then(function (r) { return r.json(); }).catch(function () { return null; }).then(function (box) {
      var bs = (box && !box.error && box.home) ? _sanitizeForFirestore(box) : { gamePk: g.gamePk, away: g.away || null, home: g.home || null, status: 'Scheduled' };
      if (bs.gamePk == null) bs.gamePk = g.gamePk;
      bs.sport = sport;
      var doc = Object.assign({
        name: name,
        date: g.date || _todayLocal(),
        vibe: emoji + ' Game',
        dedication: '',
        photo: '',
        photos: [],
        boxScore: bs,
        comments: [],
        gameKey: _gattGameKey(g),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, fields);
      return col.add(doc).then(function (ref) {
        _gattRef(user, g.gamePk).set({ momentId: ref.id }, { merge: true }).catch(function (err) { console.error('[attend] link memory failed:', err); });
        return Object.assign({ _id: ref.id }, doc);
      });
    });
  }
  p.then(function (m) {
    var newUids = uids.filter(function (u) { return u && prevUids.indexOf(u) === -1; });
    if (newUids.length) {
      var ownerName = (window.userData && window.userData.name) || 'Someone';
      Promise.all(newUids.map(function (u) {
        return window.db.collection('notifications').add({
          toUid: u, type: 'tagged', fromUid: user.uid, fromName: ownerName,
          momentOwnerUid: user.uid, momentId: m._id, momentName: m.name, ts: Date.now(), read: false
        });
      })).catch(function (err) { console.error('[attend] tag notification failed:', err); });
    }
    if (s.token === tok) { s.moment = m; s.momentId = m._id; _gattRender(); }
    gattCloseSheet();
    if (typeof ib_toast === 'function') ib_toast(newUids.length ? 'Memory saved · ' + newUids.length + ' tagged' : 'Memory saved');
  }).catch(function (err) {
    console.error('[attend] save memory failed:', err);
    if (btn) { btn.disabled = false; btn.textContent = s.moment ? 'Save changes' : 'Save memory'; }
    if (typeof ib_toast === 'function') ib_toast('Couldn\'t save — ' + (err && err.message ? err.message : 'try again'));
  });
}

// Seat or where-watched line on the memory itself
function _gattMemoryLineHtml(m, isForeign) {
  var txt = m.attendance === 'watch' ? (m.watchedAt ? 'Watched at ' + m.watchedAt : '') : _gattSeatText(m.seat);
  if (!txt) return '';
  return '<div style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#fff;margin:' + (isForeign ? '6px 0 8px' : '-6px 0 14px') + '">' +
    (m.attendance === 'watch' ? _GATT_ICON.watch : _GATT_ICON.attend).replace('width="12" height="12"', 'width="14" height="14"') + _escapeHtml(txt) + '</div>';
}

// ── PULL TO REFRESH (v5.65.1) — drag down from the top of the game's
// cheat sheet (or a team page) to re-fetch just that, instead of
// reloading the whole app. Listeners are passive and live only on the
// two panels that use it, never on the whole document.
function _ptrAttach(panel, onRefresh) {
  if (!panel || panel._ptr) return;
  panel._ptr = true;
  var screen = panel.closest('.screen') || panel.parentNode;
  var ind = document.createElement('div');
  ind.className = 'ptr-ind';
  ind.setAttribute('role', 'status');
  ind.innerHTML = '<span class="ptr-spin"></span><span class="ptr-txt">Pull to refresh</span>';
  screen.appendChild(ind);
  var txt = ind.querySelector('.ptr-txt'), spin = ind.querySelector('.ptr-spin');
  var startY = null, pull = 0, busy = false, TRIGGER = 64;
  // v7.25.0: a panel can word it differently (a delayed game: "Pull to catch up")
  var W = function (k) { var w = typeof panel._ptrWords === 'function' ? panel._ptrWords() : null; return (w && w[k]) || { pull: 'Pull to refresh', release: 'Release to refresh', busy: 'Refreshing…' }[k]; };
  var show = function (y, label) {
    ind.style.top = (panel.offsetTop + 6 + (panel._ptrOffset || 0)) + 'px';
    ind.style.opacity = String(Math.min(1, y / 30));
    ind.style.transform = 'translate(-50%,' + (y - 24) + 'px)';
    if (label) txt.textContent = label;
  };
  var hide = function () {
    ind.classList.remove('pulling', 'busy');
    ind.style.opacity = '0';
    ind.style.transform = 'translate(-50%,-24px)';
    spin.style.transform = '';
  };
  panel.addEventListener('touchstart', function (e) {
    startY = (!busy && panel.scrollTop <= 0 && e.touches.length === 1) ? e.touches[0].clientY : null;
    pull = 0;
  }, { passive: true });
  panel.addEventListener('touchmove', function (e) {
    if (startY == null) return;
    var dy = e.touches[0].clientY - startY;
    if (dy <= 0 || panel.scrollTop > 0) { startY = null; pull = 0; hide(); return; }
    pull = Math.min(dy * 0.5, 96);
    ind.classList.add('pulling');
    spin.style.transform = 'rotate(' + Math.round(pull * 4) + 'deg)';
    show(Math.min(pull, 64), pull >= TRIGGER ? W('release') : W('pull'));
  }, { passive: true });
  var end = function () {
    if (startY == null) return;
    startY = null;
    if (pull < TRIGGER) { hide(); return; }
    busy = true;
    ind.classList.remove('pulling');
    ind.classList.add('busy');
    spin.style.transform = '';
    show(40, W('busy'));
    var t0 = Date.now();
    var done = function () {
      setTimeout(function () { busy = false; hide(); }, Math.max(0, 450 - (Date.now() - t0)));
    };
    try { Promise.resolve(onRefresh()).then(done, function (err) { console.error('[refresh] failed:', err); done(); }); }
    catch (err) { console.error('[refresh] failed:', err); done(); }
  };
  panel.addEventListener('touchend', end, { passive: true });
  panel.addEventListener('touchcancel', function () { startY = null; if (!busy) hide(); }, { passive: true });
}
// Runs fn with a cache-buster on any /api/ request it starts right away,
// so a manual refresh isn't answered from Vercel's edge cache.
function _withFreshApi(fn) {
  var orig = window.fetch;
  window.fetch = function (u, o) {
    if (typeof u === 'string' && u.indexOf('/api/') === 0) u += (u.indexOf('?') === -1 ? '?' : '&') + '_fresh=' + Date.now();
    return orig.call(this, u, o);
  };
  try { return Promise.resolve(fn()); }
  finally { window.fetch = orig; }
}
// Re-fetch only the open game: score/box score first, and the pregame
// sheet too if it hasn't started. Keeps the current tab and state.
function gameRefreshNow() {
  var g = window._activeBrowseGame;
  if (!g) return Promise.resolve();
  var pk = g.gamePk, sport = g.sport || 'mlb';
  return _withFreshApi(function () { return _refreshBoxScore(pk); }).then(function (isLive) {
    if (!window._activeBrowseGame || window._activeBrowseGame.gamePk != pk) return;
    if (window._gdPregame && window._gdPregame.boxScoreHtml) {
      if (isLive && !window._gameLiveRefreshTimer) _startGameLiveRefresh(pk);
      return;
    }
    return _withFreshApi(function () { return _loadPregameSheet(pk, sport); });
  });
}
