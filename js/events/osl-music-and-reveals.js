// ── OUR FESTIVAL MUSIC — every song added on every artist's page, in one
// place, grouped by artist. Reuses the same actSongs collection and Apple
// Music lookup cache (window._actSongAppleLinks) the per-artist Songs tab
// already relies on — a song only ever needs its Apple Music link resolved
// once, regardless of which screen it's being shown on.
window._oslAllSongsStarted = false;
window._oslAllSongsCache = [];

function startOslAllSongs() {
  if (window._oslAllSongsStarted) return;
  if (!window.db) return;
  window._oslAllSongsStarted = true;
  window.db.collection('actSongs').onSnapshot(function(snap){
    var songs = [];
    snap.forEach(function(doc){ songs.push(Object.assign({ _id: doc.id }, doc.data())); });
    window._oslAllSongsCache = songs;
    renderOslAllSongs(songs);
  }, function(err){
    console.error('All songs error:', err);
    window._oslAllSongsStarted = false;
    if (typeof ib_toast==='function') ib_toast('Songs unavailable — check Firestore rules');
  });
}

function renderOslAllSongs(songs) {
  var list = document.getElementById('osl-allsongs-list');
  var empty = document.getElementById('osl-allsongs-empty');
  if (!list) return;
  if (!songs.length) {
    if (empty) empty.style.display = 'flex';
    list.style.display = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  list.style.display = 'block';

  var byArtist = {};
  songs.forEach(function(s){
    var key = s.actName || 'Unknown artist';
    (byArtist[key] = byArtist[key] || []).push(s);
  });

  // Look up which day (and set time) each act actually plays, so this reads
  // as a day-by-day prep playlist — Friday's acts in the order you'll see
  // them, then Saturday, then Sunday — rather than one alphabetical list
  // mixing every day together.
  var dayOrder = ['fri', 'sat', 'sun'];
  var actMeta = {};
  dayOrder.forEach(function(dayKey){
    var stages = stageData[dayKey] || {};
    Object.keys(stages).forEach(function(stageKey){
      stages[stageKey].acts.forEach(function(act){
        actMeta[act.name] = { dayKey: dayKey, dayLabel: stages[stageKey].day, time: act.time };
      });
    });
  });

  var byDay = {};
  var otherArtists = [];
  Object.keys(byArtist).forEach(function(artist){
    var meta = actMeta[artist];
    if (meta) { (byDay[meta.dayKey] = byDay[meta.dayKey] || []).push(artist); }
    else otherArtists.push(artist);
  });
  function byStartTime(a, b) {
    var ta = actMeta[a] ? _actStartMinutes(actMeta[a].time) : 0;
    var tb = actMeta[b] ? _actStartMinutes(actMeta[b].time) : 0;
    return ta - tb;
  }
  dayOrder.forEach(function(dayKey){ if (byDay[dayKey]) byDay[dayKey].sort(byStartTime); });
  otherArtists.sort(function(a, b){ return a.localeCompare(b); });

  function renderArtistBlock(artist) {
    var artistSongs = byArtist[artist].slice().sort(function(a, b){
      var ca = (a.recommenders || []).length, cb = (b.recommenders || []).length;
      if (cb !== ca) return cb - ca;
      return (a.ts || 0) - (b.ts || 0);
    });
    var songsHtml = artistSongs.map(function(s){
      var recs = s.recommenders || [];
      var names = recs.map(function(r){ return r.name; }).join(', ');
      var query = encodeURIComponent(artist + ' ' + s.title);
      var appleHref = window._actSongAppleLinks[s._id] || ('https://music.apple.com/us/search?term=' + query);
      return '<div style="background:rgba(255,255,255,0.08);border-radius:14px;padding:10px 12px;display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:13.5px;font-weight:700;color:white;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(s.title) + '</div>' +
          '<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (recs.length > 1 ? recs.length + ' friends · ' : '') + _escapeHtml(names) + '</div>' +
        '</div>' +
        '<a href="https://open.spotify.com/search/' + query + '" target="_blank" rel="noopener" style="width:30px;height:30px;border-radius:50%;background:rgba(29,185,84,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;text-decoration:none" aria-label="Search Spotify">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.48.12-1.021-.12-1.141-.6-.12-.48.12-1.02.6-1.14 4.322-1.32 9.682-.66 13.381 1.62.361.181.54.78.361 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/></svg>' +
        '</a>' +
        '<a id="allsong-apple-' + s._id + '" href="' + appleHref + '" target="_blank" rel="noopener" style="width:30px;height:30px;border-radius:50%;background:rgba(250,60,90,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;text-decoration:none" aria-label="Open in Apple Music">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="#FA3C5A"><path d="M23.997 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043C21.003.517 20.373.285 19.7.164c-.517-.093-1.038-.135-1.564-.15-.04-.001-.083-.007-.124-.01H5.988c-.152.01-.303.017-.455.028-.53.038-1.055.107-1.564.278a5.222 5.222 0 0 0-2.235 1.456A5.415 5.415 0 0 0 .606 3.71c-.24.653-.353 1.33-.394 2.02-.008.135-.012.27-.012.406v12.037c.005.19.012.38.024.57.036.53.1 1.058.264 1.567.396 1.24 1.14 2.24 2.235 2.94.65.416 1.373.65 2.13.75.42.056.842.087 1.267.09.02 0 .04.003.058.008h12.6c.11-.01.22-.017.33-.026.53-.04 1.055-.106 1.564-.278a5.147 5.147 0 0 0 2.29-1.516c.633-.72 1.017-1.55 1.19-2.49.1-.53.13-1.065.13-1.6V6.395c0-.09-.003-.18-.006-.27z"/></svg>' +
        '</a>' +
      '</div>';
    }).join('');
    var timeLabel = actMeta[artist] ? actMeta[artist].time : '';
    return '<div style="margin-bottom:18px">' +
      '<div onclick="_jumpToActFromAllSongs(\'' + artist.replace(/'/g, "\\'") + '\')" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;cursor:pointer;padding-top:6px">' +
        '<div style="min-width:0"><div style="font-size:13px;font-weight:700;color:rgba(168,159,232,1);text-transform:uppercase;letter-spacing:0.06em">' + _escapeHtml(artist) + '</div>' +
        (timeLabel ? '<div style="font-size:10.5px;color:rgba(255,255,255,0.35);margin-top:1px">' + _escapeHtml(timeLabel) + '</div>' : '') + '</div>' +
        '<svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="1 1 6 6 1 11"/></svg>' +
      '</div>' +
      songsHtml +
    '</div>';
  }

  var html = '';
  dayOrder.forEach(function(dayKey){
    var artists = byDay[dayKey];
    if (!artists || !artists.length) return;
    var firstStageKey = Object.keys(stageData[dayKey])[0];
    var dayLabel = stageData[dayKey][firstStageKey].day;
    html += '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin:18px 0 10px">' + _escapeHtml(dayLabel) + '</div>';
    artists.forEach(function(artist){ html += renderArtistBlock(artist); });
  });
  if (otherArtists.length) {
    html += '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin:18px 0 10px">Other</div>';
    otherArtists.forEach(function(artist){ html += renderArtistBlock(artist); });
  }
  list.innerHTML = html;

  Object.keys(byArtist).forEach(function(artist){
    byArtist[artist].forEach(function(s){ _resolveAllSongAppleLink(s._id, artist, s.title); });
  });
}

// Same iTunes Search lookup _resolveActSongAppleLink uses, targeting this
// screen's element ids instead — shares the cache, so a song already
// resolved on an artist's own Songs tab doesn't get looked up twice.
function _resolveAllSongAppleLink(songId, actName, title) {
  if (window._actSongAppleLinks[songId] !== undefined) {
    if (window._actSongAppleLinks[songId]) {
      var known = document.getElementById('allsong-apple-' + songId);
      if (known) known.href = window._actSongAppleLinks[songId];
    }
    return;
  }
  window._actSongAppleLinks[songId] = null;
  fetch('https://itunes.apple.com/search?entity=song&limit=1&term=' + encodeURIComponent(actName + ' ' + title))
    .then(function(r){ return r.json(); })
    .then(function(data){
      var result = data && data.results && data.results[0];
      if (result && result.trackViewUrl) {
        window._actSongAppleLinks[songId] = result.trackViewUrl;
        var el = document.getElementById('allsong-apple-' + songId);
        if (el) el.href = result.trackViewUrl;
      }
    })
    .catch(function(err){ console.error('All-songs Apple Music lookup error:', err); });
}

function _jumpToActFromAllSongs(actName) {
  var meta = _findActMeta(actName);
  openActDetail(actName, meta.time, meta.headliner);
}

function groupShowPanel(key) {
  ['gd-blank-panel', 'gd-chat-panel', 'gd-chat-input', 'gd-members-panel', 'gd-games-panel', 'gd-polls-panel'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (key === 'chat') {
    document.getElementById('gd-chat-panel').style.display = 'flex';
    document.getElementById('gd-chat-input').style.display = 'flex';
    if (window._activeGroupId && typeof startGroupChat === 'function') startGroupChat(window._activeGroupId);
  } else if (key === 'games') {
    document.getElementById('gd-games-panel').style.display = 'flex';
    if (typeof loadGroupGames === 'function') loadGroupGames(window._gdGamesDate || _todayLocal());
  } else if (key === 'polls') {
    document.getElementById('gd-polls-panel').style.display = 'flex';
    if (window._activeGroupId && typeof startGroupPolls === 'function') startGroupPolls(window._activeGroupId);
  } else if (key === 'members') {
    document.getElementById('gd-members-panel').style.display = 'flex';
    if (typeof renderGroupMembers === 'function') renderGroupMembers();
  } else {
    var blank = document.getElementById('gd-blank-panel');
    if (blank) blank.style.display = 'flex';
  }
}

function groupTab(key, evt) {
  evt = evt || window.event;
  document.querySelectorAll('#screen-group-detail .g-tabs .tab-l').forEach(function(t) { t.classList.remove('active'); });
  if (evt && evt.target) evt.target.classList.add('active');
  groupShowPanel(key);
}

// Builds the tab bar from the group's active features (chat, games),
// always includes Members, and a trailing + to add more features later.
function renderGroupTabs() {
  var g = window._activeGroup || {};
  var features = g.features || [];
  var tabsEl = document.getElementById('gd-tabs');
  if (!tabsEl) return;
  var tabs = [];
  if (features.indexOf('chat') !== -1) tabs.push({ key: 'chat', label: 'Feed' });
  if (features.indexOf('games') !== -1) tabs.push({ key: 'games', label: 'Games' });
  if (features.indexOf('polls') !== -1) tabs.push({ key: 'polls', label: 'Polls' });
  tabs.push({ key: 'members', label: 'Members' });
  var defaultKey = features.length ? tabs[0].key : null;
  tabsEl.innerHTML = tabs.map(function(t) {
    return '<div class="tab-l' + (t.key === defaultKey ? ' active' : '') + '" onclick="groupTab(\'' + t.key + '\', event)">' + t.label + '</div>';
  }).join('') + '<div class="tab-l" style="flex:0 0 44px;font-weight:700" onclick="showFeaturePicker()">+</div>';
  groupShowPanel(defaultKey || 'blank');
}

function oslDay2(day) {
  window._lineupLastDay = day;
  ['fri','sat','sun'].forEach(function(d) {
    var panel = document.getElementById('osl2-' + d);
    var btn = document.getElementById('day-btn-' + d);
    if (panel) panel.style.display = 'none';
    if (btn) {
      btn.style.background = 'transparent';
      btn.style.color = 'var(--subtle)';
    }
  });
  var active = document.getElementById('osl2-' + day);
  var activeBtn = document.getElementById('day-btn-' + day);
  if (active) active.style.display = 'flex';
  if (activeBtn) {
    activeBtn.style.background = 'rgba(168,159,232,0.9)';
    activeBtn.style.color = '#0D0820';
  }
}

// ── ARTIST SEARCH — every occurrence, across all 3 days, grouped by exact
// act name (matches how real duplicate bookings already share identical
// spelling in stageData, e.g. NEZZA appearing on both Twin Peaks and
// Duboce Triangle Friday). Built once and cached — stageData itself never
// changes at runtime, so there's no reason to rebuild this on every
// keystroke.
window._lineupSearchIndex = null;
function _buildLineupSearchIndex() {
  if (window._lineupSearchIndex) return window._lineupSearchIndex;
  var dayShort = { fri: 'FRI', sat: 'SAT', sun: 'SUN' };
  var dayDate = { fri: '8/7', sat: '8/8', sun: '8/9' };
  var byName = {};
  ['fri', 'sat', 'sun'].forEach(function(dayKey){
    var stages = stageData[dayKey] || {};
    Object.keys(stages).forEach(function(stageKey){
      var stage = stages[stageKey];
      stage.acts.forEach(function(act){
        if (!byName[act.name]) byName[act.name] = { name: act.name, occ: [] };
        byName[act.name].occ.push({
          dayKey: dayKey, day: dayShort[dayKey], date: dayDate[dayKey],
          stageKey: stageKey, stage: stage.name,
          time: act.time + (act.headliner ? ' (Headliner)' : '')
        });
      });
    });
  });
  window._lineupSearchIndex = Object.keys(byName).sort().map(function(k){ return byName[k]; });
  return window._lineupSearchIndex;
}

function onLineupSearch(query) {
  var q = (query || '').trim().toLowerCase();
  var clearBtn = document.getElementById('lineup-search-clear');
  var dayBtnRow = document.getElementById('lineup-day-btn-row');
  var resultsView = document.getElementById('lineup-search-results');
  if (clearBtn) clearBtn.style.display = q ? 'flex' : 'none';
  if (!resultsView) return;

  if (!q) {
    resultsView.style.display = 'none';
    if (dayBtnRow) dayBtnRow.style.display = 'flex';
    if (typeof oslDay2 === 'function') oslDay2(window._lineupLastDay || 'fri');
    return;
  }

  ['osl2-fri', 'osl2-sat', 'osl2-sun'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (dayBtnRow) dayBtnRow.style.display = 'none';
  resultsView.style.display = 'block';

  var matches = _buildLineupSearchIndex().filter(function(a){ return a.name.toLowerCase().indexOf(q) !== -1; });
  if (!matches.length) {
    resultsView.innerHTML = '<div style="text-align:center;padding:40px 20px;color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6">No artists match "' + _escapeHtml(query) + '"</div>';
    return;
  }
  resultsView.innerHTML = matches.map(function(a){
    var occHtml = a.occ.map(function(o){
      return '<div onclick="_lineupSearchJump(\'' + o.dayKey + '\',\'' + o.stageKey.replace(/'/g,"\\'") + '\')" style="display:flex;align-items:center;gap:10px;margin-top:10px;padding-top:10px;border-top:0.5px solid rgba(255,255,255,0.08);cursor:pointer">' +
        '<div style="width:38px;flex-shrink:0;text-align:center"><div style="font-size:9.5px;font-weight:700;color:rgba(168,159,232,0.8);text-transform:uppercase">' + o.day + '</div><div style="font-size:13px;font-weight:800;color:white;line-height:1.1">' + o.date + '</div></div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:white">' + _escapeHtml(o.stage) + '</div><div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:1px">' + _escapeHtml(o.time) + '</div></div>' +
        '<svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 1 6 6 1 11"/></svg>' +
      '</div>';
    }).join('');
    return '<div style="background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.1);border-radius:16px;padding:14px 16px;margin-bottom:10px">' +
      '<div style="font-size:15px;font-weight:800;color:white;letter-spacing:-0.2px;display:flex;align-items:center;gap:8px">' + _escapeHtml(a.name) + (a.occ.length > 1 ? '<span style="font-size:9px;font-weight:800;color:#0D0820;background:rgba(168,159,232,0.9);padding:2px 7px;border-radius:6px">' + a.occ.length + ' sets</span>' : '') + '</div>' +
      occHtml +
    '</div>';
  }).join('');
}

function _lineupSearchJump(dayKey, stageKey) {
  clearLineupSearch();
  if (typeof oslDay2 === 'function') oslDay2(dayKey);
  if (typeof openStage === 'function') openStage(dayKey, stageKey);
}

function clearLineupSearch() {
  var input = document.getElementById('lineup-search-input');
  if (input) input.value = '';
  onLineupSearch('');
}

// ── DAY REVEAL — see #osl-day-reveal in the markup for the rationale.
function _oslGoingActsForDay(dayKey) {
  var acts = [];
  var stages = stageData[dayKey] || {};
  Object.keys(stages).forEach(function(stageKey){
    stages[stageKey].acts.forEach(function(act){
      if (myRsvps[act.name] === 'going') {
        acts.push({ name: act.name, stage: stages[stageKey].name, time: act.time, startMinutes: _actStartMinutes(act.time) });
      }
    });
  });
  acts.sort(function(a, b){ return a.startMinutes - b.startMinutes; });
  return acts;
}

// "Also here today" — who else (going OR maybe to at least one act that
// day) is around, regardless of whether they're an accepted Innings
// friend. Matches the same reasoning loadOslAttendees already settled on
// for "Who's going": in a single invite-only OSL group, everyone in it is
// already trusted context, so there's no reason to narrow this to the
// formal friend graph for an MVP.
window._oslDayAttendeesCache = {};
function _oslActNamesForDay(dayKey) {
  var names = {};
  var stages = stageData[dayKey] || {};
  Object.keys(stages).forEach(function(stageKey){
    stages[stageKey].acts.forEach(function(act){ names[act.name] = true; });
  });
  return names;
}
function _loadOslDayAttendees(dayKey, cb) {
  if (window._oslDayAttendeesCache[dayKey]) { cb(window._oslDayAttendeesCache[dayKey]); return; }
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { cb([]); return; }
  window.db.collection('users').where('oslRsvp', 'in', ['going', 'maybe']).get().then(function(snap){
    var dayActNames = _oslActNamesForDay(dayKey);
    var people = [];
    snap.forEach(function(doc){
      if (doc.id === user.uid) return;
      var d = doc.data() || {};
      var rsvps = d.oslActRsvps || {};
      var actsToday = Object.keys(rsvps).filter(function(actName){
        var status = rsvps[actName];
        return dayActNames[actName] && (status === 'going' || status === 'maybe');
      });
      if (actsToday.length) people.push({ name: d.name || 'Friend', acts: actsToday });
    });
    people.sort(function(a, b){ return b.acts.length - a.acts.length || a.name.localeCompare(b.name); });
    window._oslDayAttendeesCache[dayKey] = people;
    cb(people);
  }).catch(function(err){
    console.error('Load day attendees error:', err);
    cb([]);
  });
}

// Real trigger: only fires when the day being viewed actually matches
// today's calendar date — this is a "start of day" recap, not a general
// day-browsing feature, so looking at Saturday's lineup while it's still
// Friday should never play anything.
function _maybeShowOslDayReveal(dayKey) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user) return;
  if (window._oslPreviewActive) return;
  if (OSL_DAY_DATES[dayKey] !== _todayLocal()) return;

  var goingActs = _oslGoingActsForDay(dayKey);
  if (!goingActs.length) return;

  // Shows at most once per day, period. This used to gate only the initial
  // "whole day" reveal, then fall through to a lighter "comingup" version
  // on every single reopen after that — which got old fast at a live
  // event people check constantly. Now the first qualifying visit each
  // day is the only one that plays anything at all.
  var shownMap = (window.userData && window.userData.oslRevealShown) || {};
  if (shownMap[dayKey] === _todayLocal()) return;

  shownMap[dayKey] = _todayLocal();
  window.userData = window.userData || {};
  window.userData.oslRevealShown = shownMap;
  if (window.db) {
    window.db.collection('users').doc(user.uid).set({ oslRevealShown: shownMap }, { merge: true }).catch(function(err){ console.error('Save reveal-shown state error:', err); });
  }

  _playOslDayReveal(dayKey, 'whole', goingActs);
}

window._oslRevealTimers = [];
function _clearOslRevealTimers() { window._oslRevealTimers.forEach(clearTimeout); window._oslRevealTimers = []; }
function _oslRevealAfter(ms, fn) { window._oslRevealTimers.push(setTimeout(fn, ms)); }

// Fits as many friend avatars as the card actually has room for, measured
// against its real rendered width, rather than a fixed cap.
function _oslRevealFitAvatarCount(containerWidth, totalFriends) {
  var avatarW = 24, step = 18, reserve = 36;
  var maxFit = Math.max(1, Math.floor((containerWidth - avatarW - reserve) / step) + 1);
  return Math.min(totalFriends, maxFit);
}
function _oslRevealAvatarsHtml(friends, maxFit) {
  var shown = friends.slice(0, maxFit);
  var extra = friends.length - shown.length;
  var avatars = shown.map(function(f, i){
    var colorClass = _OSL_CLUSTER_COLORS[i % _OSL_CLUSTER_COLORS.length];
    return '<div class="av ' + colorClass + '" style="width:24px;height:24px;font-size:9px;border:2px solid rgba(13,8,32,0.6);' + (i === 0 ? 'margin-left:0' : 'margin-left:-6px') + '">' + _escapeHtml(_initialsFallback(f.name)) + '</div>';
  }).join('');
  var extraHtml = extra > 0 ? '<span style="font-size:10.5px;color:rgba(255,255,255,0.45);margin-left:6px;font-weight:700">+' + extra + '</span>' : '';
  return avatars + extraHtml;
}

// mode: 'whole' (first open of the day — full recap, slower pacing so
// every card actually gets read) or 'comingup' (reopening later — only
// what's still ahead, quick). onDone (optional) fires once the overlay
// has fully faded back out — used to chain days together for the
// Calendar's manual Preview button.
function _playOslDayReveal(dayKey, mode, acts, onDone) {
  var overlay = document.getElementById('osl-day-reveal');
  var eyebrow = document.getElementById('osl-reveal-eyebrow');
  var title = document.getElementById('osl-reveal-title');
  var scrollEl = document.getElementById('osl-reveal-scroll');
  var wrap = document.getElementById('osl-reveal-wrap');
  var summary = document.getElementById('osl-reveal-summary');
  var alsoWrap = document.getElementById('osl-reveal-also-wrap');
  var alsoList = document.getElementById('osl-reveal-also-list');
  if (!overlay || !acts || !acts.length) { if (typeof onDone === 'function') onDone(); return; }

  _clearOslRevealTimers();
  wrap.innerHTML = '';
  summary.style.opacity = '0';
  summary.textContent = '';
  alsoWrap.style.opacity = '0';
  alsoList.innerHTML = '';
  scrollEl.scrollTop = 0;
  eyebrow.style.opacity = '0'; eyebrow.style.transform = 'translateY(8px)';
  title.style.opacity = '0'; title.style.transform = 'translateY(8px)';
  overlay.style.display = 'flex';
  overlay.style.opacity = '0';

  var whole = mode === 'whole';
  eyebrow.textContent = whole ? 'Your Plans' : 'Coming Up';
  title.textContent = whole ? (OSL_DAY_LABELS[dayKey] || '') : 'Later Today';
  var stagger = whole ? 380 : 150;
  var startDelay = whole ? 300 : 180;

  // Kicked off in parallel with the card animations — shown once both the
  // summary moment has arrived AND the data is actually back, whichever
  // comes later, so a slow connection delays this section rather than
  // skipping it.
  var alsoDataReady = false, alsoPeople = [], summaryMomentReached = false;
  _loadOslDayAttendees(dayKey, function(people){
    alsoPeople = people; alsoDataReady = true;
    if (summaryMomentReached) _showAlsoSection();
  });
  function _showAlsoSection() {
    if (!alsoDataReady || !alsoPeople.length) return;
    var shownPeople = alsoPeople.slice(0, 5);
    var extraPeople = alsoPeople.length - shownPeople.length;
    alsoList.innerHTML = shownPeople.map(function(p, i){
      var shownActs = p.acts.slice(0, 3);
      var extraActs = p.acts.length - shownActs.length;
      var actsText = shownActs.join(', ') + (extraActs > 0 ? ' & ' + extraActs + ' more' : '');
      var isLast = i === shownPeople.length - 1;
      return '<div style="display:flex;align-items:baseline;gap:8px;padding:9px 0;' + (isLast ? '' : 'border-bottom:0.5px solid rgba(111,207,192,0.12)') + '">' +
        '<div style="font-size:12.5px;font-weight:700;color:#6FCFC0;flex-shrink:0">' + _escapeHtml(p.name) + '</div>' +
        '<div style="font-size:11.5px;color:rgba(255,255,255,0.5);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(actsText) + '</div>' +
      '</div>';
    }).join('') + (extraPeople > 0 ? '<div style="text-align:center;font-size:11px;color:rgba(111,207,192,0.55);padding:10px 0 4px">+' + extraPeople + ' more people</div>' : '');
    alsoWrap.style.opacity = '1';
  }

  requestAnimationFrame(function(){
    overlay.style.opacity = '1';
    eyebrow.style.opacity = '1'; eyebrow.style.transform = 'translateY(0)';
    _oslRevealAfter(50, function(){ title.style.opacity = '1'; title.style.transform = 'translateY(0)'; });
  });

  acts.forEach(function(act, i) {
    _oslRevealAfter(startDelay + i * stagger, function(){
      var card = document.createElement('div');
      card.style.cssText = 'width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:16px;margin-bottom:10px;opacity:0;transform:translateY(16px);transition:opacity 0.32s cubic-bezier(.2,.8,.3,1),transform 0.32s cubic-bezier(.2,.8,.3,1)';
      var whoId = 'osl-reveal-who-' + i + '-' + Date.now();
      card.innerHTML = '<div style="font-size:18px;font-weight:800;color:white;letter-spacing:-0.3px">' + _escapeHtml(act.name) + '</div>' +
        '<div style="font-size:12.5px;color:rgba(255,255,255,0.45);margin-top:3px">' + _escapeHtml(act.stage + ' · ' + act.time) + '</div>' +
        '<div id="' + whoId + '" style="margin-top:9px;display:flex;align-items:center;min-height:24px"></div>';
      wrap.appendChild(card);

      var friends = (window._oslFriendRsvps || {})[act.name] || [];
      if (friends.length) {
        var whoEl = document.getElementById(whoId);
        var maxFit = _oslRevealFitAvatarCount(whoEl.clientWidth || 300, friends.length);
        whoEl.innerHTML = _oslRevealAvatarsHtml(friends, maxFit);
      }

      requestAnimationFrame(function(){
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
        scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
      });
    });
  });

  var lastAt = startDelay + (acts.length - 1) * stagger;
  _oslRevealAfter(lastAt + (whole ? 500 : 300), function(){
    summary.textContent = whole ? (acts.length + ' act' + (acts.length === 1 ? '' : 's') + ' today') : (acts.length + ' more today');
    summary.style.opacity = '1';
    summaryMomentReached = true;
    _showAlsoSection();
    scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
  });
  _oslRevealAfter(lastAt + (whole ? 1300 : 750), function(){
    overlay.style.opacity = '0';
    _oslRevealAfter(320, function(){
      overlay.style.display = 'none';
      if (typeof onDone === 'function') onDone();
    });
  });
}

// ── OSL MEMORY REVEAL — plays once, automatically, every time the OSL
// memory is opened. Groups the acts you saw by festival day (using the same
// stageData lineup table the live screens read from) and shows who else was
// at each specific act, pulled from loadOslFriendRsvps — the per-act RSVP
// data lives permanently on each friend's own account, so it's still there
// after the festival ends even though nothing about it was copied onto the
// memory itself. Paced quickly per act, with a beat held on each day change.
window._oslMemRevealTimers = [];
function _clearOslMemRevealTimers() { window._oslMemRevealTimers.forEach(clearTimeout); window._oslMemRevealTimers = []; }
function _oslMemRevealAfter(ms, fn) { window._oslMemRevealTimers.push(setTimeout(fn, ms)); }

function _skipOslMemoryReveal() {
  var overlay = document.getElementById('osl-memory-reveal');
  if (!overlay || overlay.style.display === 'none') return;
  _clearOslMemRevealTimers();
  overlay.style.opacity = '0';
  var done = window._oslMemRevealOnDone;
  window._oslMemRevealOnDone = null;
  setTimeout(function(){
    overlay.style.display = 'none';
    if (typeof done === 'function') done();
  }, 220);
}

// Reverse-lookup from the static lineup table: act name -> which day/stage/
// time it actually ran. Built once and cached — the lineup itself doesn't
// change per-user, so there's nothing to invalidate.
function _oslActLookup() {
  if (window._oslActLookupCache) return window._oslActLookupCache;
  var lookup = {};
  Object.keys(OSL_DAY_DATES).forEach(function(dayKey){
    var stages = stageData[dayKey] || {};
    Object.keys(stages).forEach(function(stageKey){
      stages[stageKey].acts.forEach(function(act){
        lookup[act.name] = { dayKey: dayKey, stage: stages[stageKey].name, time: act.time, startMinutes: _actStartMinutes(act.time) };
      });
    });
  });
  window._oslActLookupCache = lookup;
  return lookup;
}

function _playOslMemoryReveal(memory, onDone) {
  var overlay = document.getElementById('osl-memory-reveal');
  var eyebrow = document.getElementById('oslmem-reveal-eyebrow');
  var title = document.getElementById('oslmem-reveal-title');
  var scrollEl = document.getElementById('oslmem-reveal-scroll');
  var wrap = document.getElementById('oslmem-reveal-wrap');
  var summary = document.getElementById('oslmem-reveal-summary');
  var alsoWrap = document.getElementById('oslmem-reveal-also-wrap');
  var alsoList = document.getElementById('oslmem-reveal-also-list');
  if (!overlay) { if (typeof onDone === 'function') onDone(); return; }
  window._oslMemRevealOnDone = onDone;

  // Memories saved after this feature shipped carry the full act list. For
  // older ones, the truncated "A, B, C + N more" highlight string is a last
  // resort, not the real fix — the actual full list is still sitting on the
  // current user's own account (oslActRsvps never got cleared after the
  // festival), so reconstruct from there instead whenever it's available,
  // and write it back onto the memory so this doesn't need reconstructing
  // every time it's opened again.
  var actNames = (memory.oslActs && memory.oslActs.length) ? memory.oslActs : null;
  if (!actNames) {
    var ownRsvps = (window.userData && window.userData.oslActRsvps) || {};
    var reconstructed = Object.keys(ownRsvps).filter(function(k){ return ownRsvps[k] === 'going'; });
    if (reconstructed.length) {
      actNames = reconstructed;
      var user = window.currentUser || (window.auth && window.auth.currentUser);
      if (user && window.db && memory._id) {
        window.db.collection('users').doc(user.uid).collection('moments').doc(memory._id)
          .update({ oslActs: reconstructed }).catch(function(){});
      }
    } else {
      actNames = String(memory.highlight || '').replace(/\s*\+\s*\d+\s*more$/, '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
    }
  }
  if (!actNames.length) { if (typeof onDone === 'function') onDone(); return; }

  loadOslFriendRsvps(function(){
    var lookup = _oslActLookup();
    var byDay = {};
    var unplaced = [];
    actNames.forEach(function(name){
      var info = lookup[name];
      if (!info) { unplaced.push({ name: name, startMinutes: 0 }); return; }
      byDay[info.dayKey] = byDay[info.dayKey] || [];
      byDay[info.dayKey].push({ name: name, stage: info.stage, time: info.time, startMinutes: info.startMinutes });
    });
    Object.keys(byDay).forEach(function(k){ byDay[k].sort(function(a,b){ return a.startMinutes - b.startMinutes; }); });

    // Build a flat timeline of steps in day order: a day-header step, then
    // that day's acts, repeating per day — plus anything that couldn't be
    // matched to a day tacked on at the end rather than silently dropped.
    var steps = [];
    ['fri', 'sat', 'sun'].forEach(function(dayKey){
      if (!byDay[dayKey] || !byDay[dayKey].length) return;
      steps.push({ type: 'day', label: OSL_DAY_LABELS[dayKey] || dayKey });
      byDay[dayKey].forEach(function(act){ steps.push({ type: 'act', act: act }); });
    });
    if (unplaced.length) {
      if (steps.length) steps.push({ type: 'day', label: 'Also' });
      unplaced.forEach(function(act){ steps.push({ type: 'act', act: act }); });
    }

    _clearOslMemRevealTimers();
    wrap.innerHTML = '';
    summary.style.opacity = '0'; summary.textContent = '';
    alsoWrap.style.opacity = '0'; alsoList.innerHTML = '';
    scrollEl.scrollTop = 0;
    eyebrow.style.opacity = '0'; eyebrow.style.transform = 'translateY(8px)';
    title.style.opacity = '0'; title.style.transform = 'translateY(8px)';
    overlay.style.display = 'flex';
    overlay.style.opacity = '0';

    eyebrow.textContent = 'You Were There';
    title.textContent = memory.name || 'Outside Lands';

    requestAnimationFrame(function(){
      overlay.style.opacity = '1';
      eyebrow.style.opacity = '1'; eyebrow.style.transform = 'translateY(0)';
      _oslMemRevealAfter(50, function(){ title.style.opacity = '1'; title.style.transform = 'translateY(0)'; });
    });

    // Quick per-act pacing, with a held beat whenever a day header lands —
    // long enough to actually read "Friday, Aug 7" before acts start moving.
    var t = 300;
    var actGap = 240, dayGap = 480;
    steps.forEach(function(step){
      var at = t;
      _oslMemRevealAfter(at, function(){
        if (step.type === 'day') {
          var header = document.createElement('div');
          header.style.cssText = 'width:100%;text-align:center;padding:14px 0 6px;opacity:0;transform:translateY(10px);transition:opacity 0.3s ease,transform 0.3s ease';
          header.innerHTML = '<div style="font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:rgba(168,159,232,0.8)">' + _escapeHtml(step.label) + '</div>';
          wrap.appendChild(header);
          requestAnimationFrame(function(){ header.style.opacity = '1'; header.style.transform = 'translateY(0)'; });
        } else {
          var act = step.act;
          var card = document.createElement('div');
          card.style.cssText = 'width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:14px 16px;margin-bottom:8px;opacity:0;transform:translateY(14px);transition:opacity 0.26s cubic-bezier(.2,.8,.3,1),transform 0.26s cubic-bezier(.2,.8,.3,1)';
          var whoId = 'oslmem-who-' + Math.random().toString(36).slice(2);
          var subLine = act.stage ? (act.stage + (act.time ? ' · ' + act.time : '')) : '';
          card.innerHTML = '<div style="font-size:17px;font-weight:800;color:white;letter-spacing:-0.3px">' + _escapeHtml(act.name) + '</div>' +
            (subLine ? '<div style="font-size:11.5px;color:rgba(255,255,255,0.4);margin-top:2px">' + _escapeHtml(subLine) + '</div>' : '') +
            '<div id="' + whoId + '" style="margin-top:8px;display:flex;align-items:center;min-height:22px"></div>';
          wrap.appendChild(card);
          var friends = (window._oslFriendRsvps || {})[act.name] || [];
          if (friends.length) {
            var whoEl = document.getElementById(whoId);
            var maxFit = _oslRevealFitAvatarCount(whoEl.clientWidth || 300, friends.length);
            whoEl.innerHTML = _oslRevealAvatarsHtml(friends, maxFit);
          }
          requestAnimationFrame(function(){
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
            scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
          });
        }
      });
      t += step.type === 'day' ? dayGap : actGap;
    });

    var people = memory.people || [];
    _oslMemRevealAfter(t + 400, function(){
      summary.textContent = actNames.length + ' act' + (actNames.length === 1 ? '' : 's');
      summary.style.opacity = '1';
      if (people.length) {
        alsoList.innerHTML = people.map(function(name){
          return '<div style="padding:6px 0;font-size:13px;color:rgba(255,255,255,0.85)">' + _escapeHtml(name) + '</div>';
        }).join('');
        alsoWrap.style.opacity = '1';
      }
      scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
    });
    _oslMemRevealAfter(t + 1800, function(){
      overlay.style.opacity = '0';
      _oslMemRevealAfter(320, function(){
        overlay.style.display = 'none';
        var done = window._oslMemRevealOnDone;
        window._oslMemRevealOnDone = null;
        if (typeof done === 'function') done();
      });
    });
  });
}

// ── PREVIEW (Calendar screen) — plays the whole-day recap for Friday,
// Saturday, and Sunday back to back, regardless of what today's actual
// date is. This is a manual test tool, not the real trigger — it doesn't
// touch oslRevealShown, so it never interferes with the genuine
// first-open/reopen bookkeeping above.
function previewOslDayReveal(evt) {
  if (evt) evt.stopPropagation();
  window._oslPreviewActive = true;
  nav('osl-group');
  setTimeout(function(){
    if (typeof loadOslFriendRsvps === 'function') {
      loadOslFriendRsvps(function(){ _runOslPreviewSequence(); });
    } else {
      _runOslPreviewSequence();
    }
  }, 260);
}
function _runOslPreviewSequence() {
  var order = ['fri', 'sat', 'sun'];
  var idx = 0;
  function playNext() {
    if (idx >= order.length) { window._oslPreviewActive = false; return; }
    var dayKey = order[idx];
    idx++;
    var goingActs = _oslGoingActsForDay(dayKey);
    if (!goingActs.length) { playNext(); return; }
    oslDay2(dayKey);
    _playOslDayReveal(dayKey, 'whole', goingActs, playNext);
  }
  playNext();
}
