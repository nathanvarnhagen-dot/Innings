// ── FAVORITE SONGS (per artist, crowdsourced by everyone in the OSL group) ──
// Adding a title someone else already added just adds your name to it
// instead of creating a duplicate row, so the list naturally surfaces the
// songs the most friends are excited about at the top.
function startActSongs(actId) {
  if (window._actSongsStarted[actId]) return;
  if (!window.db) return;
  window._actSongsStarted[actId] = true;
  window.db.collection('actSongs').where('actId', '==', actId).onSnapshot(function(snap){
    var songs = [];
    snap.forEach(function(doc){ songs.push(Object.assign({ _id: doc.id }, doc.data())); });
    songs.sort(function(a, b){
      var ca = (a.recommenders || []).length, cb = (b.recommenders || []).length;
      if (cb !== ca) return cb - ca;
      return (a.ts || 0) - (b.ts || 0);
    });
    window._actSongsCache[actId] = songs;
    if (window._actDetailCurrent && window._actDetailCurrent.actId === actId) renderActSongs(songs);
  }, function(err){
    console.error('Act songs error:', err);
    window._actSongsStarted[actId] = false;
  });
}

function renderActSongs(songs) {
  var box = document.getElementById('act-detail-songs');
  if (!box) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var actName = (window._actDetailCurrent && window._actDetailCurrent.name) || '';
  if (!songs.length) {
    box.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.4);padding:2px">No songs added yet — add the one you\'re most hyped to hear live.</div>';
    return;
  }
  box.innerHTML = songs.map(function(s){
    var recs = s.recommenders || [];
    var mine = !!(user && recs.filter(function(r){ return r.uid === user.uid; }).length);
    var names = recs.map(function(r){ return r.name; }).join(', ');
    var query = encodeURIComponent(actName + ' ' + s.title);
    var appleHref = window._actSongAppleLinks[s._id] || ('https://music.apple.com/us/search?term=' + query);
    return '<div style="background:rgba(255,255,255,0.08);border-radius:14px;padding:10px 12px;display:flex;align-items:center;gap:8px">' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:13.5px;font-weight:700;color:white;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(s.title) + '</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (recs.length > 1 ? recs.length + ' friends · ' : '') + _escapeHtml(names) + '</div>' +
      '</div>' +
      '<a href="https://open.spotify.com/search/' + query + '" target="_blank" rel="noopener" style="width:30px;height:30px;border-radius:50%;background:rgba(29,185,84,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;text-decoration:none" aria-label="Search Spotify">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.48.12-1.021-.12-1.141-.6-.12-.48.12-1.02.6-1.14 4.322-1.32 9.682-.66 13.381 1.62.361.181.54.78.361 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/></svg>' +
      '</a>' +
      '<a id="act-song-apple-' + s._id + '" href="' + appleHref + '" target="_blank" rel="noopener" style="width:30px;height:30px;border-radius:50%;background:rgba(250,60,90,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;text-decoration:none" aria-label="Open in Apple Music">' +
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="#FA3C5A"><path d="M23.997 6.124a9.23 9.23 0 0 0-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043C21.003.517 20.373.285 19.7.164c-.517-.093-1.038-.135-1.564-.15-.04-.001-.083-.007-.124-.01H5.988c-.152.01-.303.017-.455.028-.53.038-1.055.107-1.564.278a5.222 5.222 0 0 0-2.235 1.456A5.415 5.415 0 0 0 .606 3.71c-.24.653-.353 1.33-.394 2.02-.008.135-.012.27-.012.406v12.037c.005.19.012.38.024.57.036.53.1 1.058.264 1.567.396 1.24 1.14 2.24 2.235 2.94.65.416 1.373.65 2.13.75.42.056.842.087 1.267.09.02 0 .04.003.058.008h12.6c.11-.01.22-.017.33-.026.53-.04 1.055-.106 1.564-.278a5.147 5.147 0 0 0 2.29-1.516c.633-.72 1.017-1.55 1.19-2.49.1-.53.13-1.065.13-1.6V6.395c0-.09-.003-.18-.006-.27z"/></svg>' +
      '</a>' +
      (mine ? '<div onclick="removeActSongVote(\'' + s._id + '\')" style="width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:11px;color:rgba(255,255,255,0.5);cursor:pointer;flex-shrink:0">×</div>' : '') +
    '</div>';
  }).join('');
  songs.forEach(function(s){ _resolveActSongAppleLink(s._id, actName, s.title); });
}

// Same free iTunes Search API used for the artist-level Apple Music link
// above — resolves the exact track instead of leaving a search page.
function _resolveActSongAppleLink(songId, actName, title) {
  if (window._actSongAppleLinks[songId] !== undefined) return;
  window._actSongAppleLinks[songId] = null;
  fetch('https://itunes.apple.com/search?entity=song&limit=1&term=' + encodeURIComponent(actName + ' ' + title))
    .then(function(r){ return r.json(); })
    .then(function(data){
      var result = data && data.results && data.results[0];
      if (result && result.trackViewUrl) {
        window._actSongAppleLinks[songId] = result.trackViewUrl;
        var el = document.getElementById('act-song-apple-' + songId);
        if (el) el.href = result.trackViewUrl;
      }
    })
    .catch(function(err){ console.error('Song Apple Music lookup error:', err); });
}

function addActSong() {
  var inp = document.getElementById('act-song-input');
  var title = inp ? inp.value.trim() : '';
  if (!title) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db || !window._actDetailCurrent) { if (typeof ib_toast==='function') ib_toast('Sign in to add a song'); return; }
  var name = (window.userData && window.userData.name) || 'Someone';
  var actId = window._actDetailCurrent.actId;
  var actName = window._actDetailCurrent.name || '';
  var titleKey = title.toLowerCase();
  var cache = window._actSongsCache[actId] || [];
  var existing = cache.filter(function(s){ return (s.titleKey || (s.title || '').toLowerCase()) === titleKey; })[0];
  if (inp) inp.value = '';
  if (existing) {
    var already = (existing.recommenders || []).filter(function(r){ return r.uid === user.uid; }).length;
    if (already) { if (typeof ib_toast==='function') ib_toast('You already added this one'); return; }
    window.db.collection('actSongs').doc(existing._id).update({
      recommenders: firebase.firestore.FieldValue.arrayUnion({ uid: user.uid, name: name })
    }).then(function(){
      if (typeof ib_toast==='function') ib_toast('Added your vote 🎵');
      _postActSongSystemMessage(actId, actName, name, title);
    })
      .catch(function(err){ console.error('Vote song error:', err); if (typeof ib_toast==='function') ib_toast('Could not add — try again'); });
    return;
  }
  window.db.collection('actSongs').add({
    actId: actId,
    actName: actName,
    title: title,
    titleKey: titleKey,
    recommenders: [{ uid: user.uid, name: name }],
    ts: Date.now()
  }).then(function(){
    if (typeof ib_toast==='function') ib_toast('Song added 🎵');
    _postActSongSystemMessage(actId, actName, name, title);
    _postOslFeedNotice({ uid: user.uid, author: name, systemType: 'song', text: title, actName: actName });
  }).catch(function(err){ console.error('Add song error:', err); if (typeof ib_toast==='function') ib_toast('Could not add — check Firestore rules'); });
}

// Mirrors a song add/vote into the act's own activity feed, same pattern
// as _postActRsvpSystemMessage and _postActPhotoSystemMessage.
function _postActSongSystemMessage(actId, actName, author, title) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  window.db.collection('actChat').add({ actId: actId, actName: actName, uid: user.uid, author: author, text: author + ' added "' + title + '" 🎵', ts: Date.now(), system: true, systemType: 'song' })
    .catch(function(err){ console.error('Post act song activity message error:', err); });
}

function removeActSongVote(songId) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db || !window._actDetailCurrent) return;
  var actId = window._actDetailCurrent.actId;
  var cache = window._actSongsCache[actId] || [];
  var song = cache.filter(function(s){ return s._id === songId; })[0];
  if (!song) return;
  var remaining = (song.recommenders || []).filter(function(r){ return r.uid !== user.uid; });
  if (!remaining.length) {
    window.db.collection('actSongs').doc(songId).delete()
      .catch(function(err){ console.error('Delete song error:', err); if (typeof ib_toast==='function') ib_toast('Could not remove — try again'); });
  } else {
    window.db.collection('actSongs').doc(songId).update({ recommenders: remaining })
      .catch(function(err){ console.error('Remove song vote error:', err); if (typeof ib_toast==='function') ib_toast('Could not remove — try again'); });
  }
}

function renderActRsvpButtons(actName) {
  var box = document.getElementById('act-detail-rsvp');
  if (!box) return;
  var rsvp = myRsvps[actName] || '';
  box.innerHTML =
    '<button onclick="actDetailRsvp(\'going\')" style="flex:1;padding:10px 4px;border-radius:10px;background:' + (rsvp==='going' ? 'rgba(168,159,232,0.9)' : 'rgba(255,255,255,0.07)') + ';color:' + (rsvp==='going' ? '#0D0820' : 'rgba(255,255,255,0.4)') + ';border:0.5px solid rgba(255,255,255,0.1);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">✓ Going</button>' +
    '<button onclick="actDetailRsvp(\'maybe\')" style="flex:1;padding:10px 4px;border-radius:10px;background:' + (rsvp==='maybe' ? 'rgba(254,243,226,0.15)' : 'rgba(255,255,255,0.07)') + ';color:' + (rsvp==='maybe' ? '#FEF3E2' : 'rgba(255,255,255,0.4)') + ';border:0.5px solid rgba(255,255,255,0.1);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">? Maybe</button>' +
    '<button onclick="actDetailRsvp(\'no\')" style="flex:1;padding:10px 4px;border-radius:10px;background:' + (rsvp==='no' ? 'rgba(220,90,90,0.22)' : 'rgba(255,255,255,0.07)') + ';color:' + (rsvp==='no' ? 'rgba(255,190,190,0.95)' : 'rgba(255,255,255,0.4)') + ';border:0.5px solid rgba(255,255,255,0.1);font-size:12px;font-weight:' + (rsvp==='no' ? '700' : '600') + ';cursor:pointer;font-family:inherit">✕ Skip</button>';
}

function actDetailRsvp(val) {
  if (!window._actDetailCurrent) return;
  var actName = window._actDetailCurrent.name;
  var _prevRsvp = myRsvps[actName];
  myRsvps[actName] = val;
  window.userData = window.userData || {};
  window.userData.oslActRsvps = myRsvps;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (user && window.db) {
    window.db.collection('users').doc(user.uid).set({ oslActRsvps: myRsvps }, { merge: true })
      .then(function(){ loadActGoing(actName); if (_prevRsvp !== val) _postActRsvpSystemMessage(actName, val); })
      .catch(function(err){ console.error('Act RSVP save error:', err); if (typeof ib_toast === 'function') ib_toast('Could not save — try again'); });
  }
  renderActRsvpButtons(actName);
  updateMyFest();
}

function loadActGoing(actName) {
  var box = document.getElementById('act-detail-going');
  if (!box || !window.db) return;
  box.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.35)">Loading who\'s going…</div>';
  window.db.collection('users').where(new firebase.firestore.FieldPath('oslActRsvps', actName), 'in', ['going', 'maybe', 'no']).limit(80).get().then(function(snap){
    if (!window._actDetailCurrent || window._actDetailCurrent.name !== actName) return;
    if (snap.empty) {
      box.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.35)">Nobody\'s marked anything yet — be the first.</div>';
      return;
    }
    var going = [];
    var maybe = [];
    var skip = [];
    snap.forEach(function(doc){
      var d = doc.data() || {};
      var status = (d.oslActRsvps || {})[actName];
      var entry = { uid: doc.id, name: d.name || 'Innings User' };
      if (status === 'going') going.push(entry);
      else if (status === 'maybe') maybe.push(entry);
      else if (status === 'no') skip.push(entry);
    });
    _drawActGoingPanel(box, going, maybe, skip);
  }).catch(function(err){
    console.error('Load act going error:', err);
    box.innerHTML = '<div style="font-size:12px;color:rgba(255,255,255,0.35)">Could not load — check Firestore rules</div>';
  });
}

// One naturally-scrollable row — Going first, then Maybe, then Skip, ring
// color carrying status instead of a text label per person. No cap: if
// there are 20 people, you swipe through 20 people, rather than hiding
// most of them behind a "+N" that has to be tapped first.
function _drawActGoingPanel(box, going, maybe, skip) {
  function personChip(entry, ringColor) {
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;cursor:pointer" onclick="openUserProfile(\'' + entry.uid + '\')">' +
      '<div class="av av-a" style="width:32px;height:32px;font-size:11px;outline:2px solid ' + ringColor + ';outline-offset:2px">' + _escapeHtml(_initialsFallback(entry.name)) + '</div>' +
      '<div class="m-nm-sm" style="color:rgba(255,255,255,0.5)">' + _escapeHtml(entry.name.split(' ')[0]) + '</div>' +
    '</div>';
  }

  var countParts = [];
  if (going.length) countParts.push(going.length + ' going');
  if (maybe.length) countParts.push(maybe.length + ' maybe');
  if (skip.length) countParts.push(skip.length + ' skipped');

  var html = '<div style="display:flex;flex-direction:column;gap:8px;width:100%">';
  html += '<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.06em">' + countParts.join(' · ') + '</div>';
  html += '<div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:2px">';
  going.forEach(function(entry){ html += personChip(entry, 'rgba(168,159,232,0.95)'); });
  maybe.forEach(function(entry){ html += personChip(entry, '#FEDF9A'); });
  skip.forEach(function(entry){ html += personChip(entry, 'rgba(220,90,90,0.85)'); });
  html += '</div></div>';
  box.innerHTML = html;
}

function startActChat(actId) {
  if (window._actChatStarted[actId]) return;
  if (!window.db) return;
  window._actChatStarted[actId] = true;
  window.db.collection('actChat').where('actId','==',actId).limit(200).onSnapshot(function(snap){
    if (!window._actDetailCurrent || window._actDetailCurrent.actId !== actId) return;
    var msgs = [];
    snap.forEach(function(doc){ msgs.push(Object.assign({ _id: doc.id }, doc.data())); });
    msgs.sort(function(a,b){ return (a.ts || 0) - (b.ts || 0); });
    renderActChat(msgs);
  }, function(err){
    console.error('Act chat error:', err);
    window._actChatStarted[actId] = false;
    if (typeof ib_toast==='function') ib_toast('Chat unavailable — check Firestore rules');
  });
}

function renderActChat(msgs) {
  var box = document.getElementById('act-detail-chat-msgs');
  var empty = document.getElementById('act-detail-chat-empty');
  if (!box) return;
  if (empty) empty.style.display = msgs.length ? 'none' : 'flex';
  var myUid = (window.currentUser && window.currentUser.uid) || (window.auth && window.auth.currentUser && window.auth.currentUser.uid);
  box.innerHTML = _chatHtmlWithDayDividers(msgs, function(c){
    if (c.system) {
      return '<div style="text-align:center;padding:2px 0 4px"><span style="font-size:11.5px;color:rgba(255,255,255,0.5);background:rgba(255,255,255,0.07);padding:5px 12px;border-radius:12px;display:inline-block">' + _escapeHtml(c.text) + '</span></div>';
    }
    var mine = c.uid && c.uid === myUid;
    var badges = _reactionBadgesHtml(c.reactions, false);
    var lpHtml = c.linkPreview ? _linkPreviewCardHtml(c.linkPreview) : '';
    var linkOnly = !!(c.linkPreview && c.text && c.text.trim() === c.linkPreview.url);
    if (mine) {
      if (linkOnly) {
        return '<div class="msg mine"><div class="m-av av-a">' + _escapeHtml(_initials(c.author)) + '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:flex-end;max-width:76%;min-width:0">' +
            lpHtml +
            '<div style="font-size:10px;color:var(--subtle);padding:0 2px">' + _fmtTime(c.ts) + '</div>' +
            badges +
          '</div></div>';
      }
      return '<div class="msg mine"><div class="m-av av-a">' + _escapeHtml(_initials(c.author)) + '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;max-width:76%;min-width:0">' +
          lpHtml +
          '<div class="bubble me" onclick="_msgDoubleTap(this,\'actChat\',\'' + c._id + '\',true)" style="max-width:100%;cursor:pointer">' + _replyQuoteHtml(c.replyTo, true) + '<div class="b-txt">' + _renderMessageTextWithMentions(c.text, true) + '</div><div class="b-t">' + _fmtTime(c.ts) + (c.edited ? ' · Edited' : '') + '</div></div>' +
          badges +
        '</div></div>';
    }
    if (linkOnly) {
      return '<div class="msg"><div class="m-av av-b">' + _escapeHtml(_initials(c.author)) + '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-start;max-width:76%;min-width:0">' +
          '<div class="b-who" style="margin-bottom:2px">' + _escapeHtml(c.author) + '</div>' +
          lpHtml +
          '<div style="font-size:10px;color:var(--subtle);padding:0 2px">' + _fmtTime(c.ts) + '</div>' +
          badges +
        '</div></div>';
    }
    return '<div class="msg"><div class="m-av av-b">' + _escapeHtml(_initials(c.author)) + '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-start;max-width:76%;min-width:0">' +
        lpHtml +
        '<div class="bubble them" onclick="_msgDoubleTap(this,\'actChat\',\'' + c._id + '\',false)" style="max-width:100%;cursor:pointer">' + _replyQuoteHtml(c.replyTo, false) + '<div class="b-who">' + _escapeHtml(c.author) + '</div><div class="b-txt">' + _renderMessageTextWithMentions(c.text, false) + '</div><div class="b-t">' + _fmtTime(c.ts) + (c.edited ? ' · Edited' : '') + '</div></div>' +
        badges +
      '</div></div>';
  }, true);
  var panel = document.getElementById('act-detail-chat');
  if (panel) panel.scrollTop = panel.scrollHeight;
}

function deleteActMessage(msgId) {
  if (!window.db || !msgId) return;
  window.db.collection('actChat').doc(msgId).delete()
    .catch(function(err){ console.error('Delete act message error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}

function sendActMessage() {
  if (!window._actDetailCurrent) return;
  var inp = document.getElementById('act-detail-chat-field');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in to chat'); return; }
  var author = (window.userData && window.userData.name) || 'You';
  var actId = window._actDetailCurrent.actId;
  var actName = window._actDetailCurrent.name;
  if (inp) inp.value = '';
  var msgData = { actId: actId, actName: actName, uid: user.uid, author: author, text: text, ts: Date.now() };
  var replyTo = _consumeReplyForSend('actChat');
  if (replyTo) msgData.replyTo = replyTo;
  var url = _extractFirstUrl(text);
  var sendPromise = url
    ? _fetchLinkPreview(url).then(function(lp){
        if (lp && lp.url) msgData.linkPreview = lp;
        return window.db.collection('actChat').add(msgData);
      })
    : window.db.collection('actChat').add(msgData);
  sendPromise.then(function(){
    _postOslFeedNotice({ uid: user.uid, author: author, systemType: 'actmsg', text: text, actName: actName });
  }).catch(function(err){ console.error('Act chat send error:', err); if (typeof ib_toast==='function') ib_toast('Could not send — ' + (err && err.message ? err.message : 'check Firestore rules')); });
}

function actTab(tab, evt) {
  evt = evt || window.event;
  document.querySelectorAll('#act-tabs .act-tab').forEach(function(t) {
    t.style.color = 'rgba(255,255,255,0.85)';
    t.style.fontWeight = '700';
    t.style.borderBottom = '2px solid transparent';
  });
  if (evt && evt.target) {
    evt.target.style.color = 'rgba(168,159,232,1)';
    evt.target.style.fontWeight = '700';
    evt.target.style.borderBottom = '2px solid rgba(168,159,232,0.9)';
  }
  ['act-tab-activity','act-tab-photos','act-tab-songs'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  var composer = document.getElementById('act-detail-composer');
  if (tab === 'activity') {
    document.getElementById('act-tab-activity').style.display = 'flex';
    if (composer) composer.style.display = 'flex';
  } else if (tab === 'photos') {
    document.getElementById('act-tab-photos').style.display = 'flex';
    if (composer) composer.style.display = 'none';
  } else if (tab === 'songs') {
    document.getElementById('act-tab-songs').style.display = 'flex';
    if (composer) composer.style.display = 'none';
  }
}

// Every time a different act is opened, land back on Activity rather than
// whatever tab was showing for the last act — mirrors how the OSL group tabs
// (osl2-lineup etc.) always default fresh, and avoids opening Charli XCX's
// Songs tab because that's where you happened to leave Turnstile's.
function _actResetTabsToActivity() {
  document.querySelectorAll('#act-tabs .act-tab').forEach(function(t, i) {
    if (i === 0) {
      t.style.color = 'rgba(168,159,232,1)';
      t.style.fontWeight = '700';
      t.style.borderBottom = '2px solid rgba(168,159,232,0.9)';
    } else {
      t.style.color = 'rgba(255,255,255,0.85)';
      t.style.fontWeight = '700';
      t.style.borderBottom = '2px solid transparent';
    }
  });
  var activity = document.getElementById('act-tab-activity');
  var photos = document.getElementById('act-tab-photos');
  var songs = document.getElementById('act-tab-songs');
  var composer = document.getElementById('act-detail-composer');
  if (activity) activity.style.display = 'flex';
  if (photos) photos.style.display = 'none';
  if (songs) songs.style.display = 'none';
  if (composer) composer.style.display = 'flex';
}

// Every time the OSL group screen opens, land on Lineup — Feed stays first
// in the tab bar, but Lineup is what actually shows first (Jason's call:
// it "prompts exploration" better than Feed does as a first impression).
// Maps the synthetic day keys used throughout Lineup/Your Festival/Export
// to the real calendar dates they correspond to — the single source of
// truth for "is today actually one of the festival days."
var OSL_DAY_DATES = { fri: '2026-08-07', sat: '2026-08-08', sun: '2026-08-09' };
var OSL_DAY_LABELS = { fri: 'Friday, Aug 7', sat: 'Saturday, Aug 8', sun: 'Sunday, Aug 9' };

function _oslLandOnLineup(){
  var tabs = document.querySelectorAll('.osl-main-tab');
  var lineupTab = null;
  tabs.forEach(function(t){ if (t.textContent.trim() === 'Lineup') lineupTab = t; });
  oslTab('lineup', lineupTab ? { target: lineupTab } : null);

  // If today is actually one of the festival days, default to that day's
  // lineup instead of always Friday, and check whether the day-reveal
  // should play — first open today gets the full recap, a later reopen
  // gets a quick "what's still ahead" version, and if there's nothing
  // Going that day (or nothing left today) nothing plays at all.
  var todayKey = null;
  Object.keys(OSL_DAY_DATES).forEach(function(k){ if (OSL_DAY_DATES[k] === _todayLocal()) todayKey = k; });
  if (todayKey) oslDay2(todayKey);

  // The add-friends prompt (shown once ever, see below) takes priority on
  // someone's very first visit — day-reveal is deferred until it's been
  // resolved so the two overlays never show at the same time.
  if (typeof _maybeShowAddFriendsPrompt === 'function' && _maybeShowAddFriendsPrompt(todayKey)) return;

  if (todayKey && typeof loadOslFriendRsvps === 'function') {
    loadOslFriendRsvps(function(){ if (typeof _maybeShowOslDayReveal === 'function') _maybeShowOslDayReveal(todayKey); });
  }
}

// Shown exactly once per person, ever — persisted on their own user doc so
// it stays suppressed across sessions and devices once dismissed, however
// they dismiss it (Add Friends, the X, or "I'll do this later" all count).
// Returns true if it showed (so the caller knows to defer day-reveal).
function _maybeShowAddFriendsPrompt(todayKey) {
  if (window.userData && window.userData.oslAddFriendsPromptSeen) return false;
  var overlay = document.getElementById('osl-add-friends-prompt');
  if (!overlay) return false;
  window._addFriendsPromptTodayKey = todayKey || null;
  overlay.style.display = 'flex';
  return true;
}

function _dismissAddFriendsPrompt(alsoOpenSheet) {
  var overlay = document.getElementById('osl-add-friends-prompt');
  if (overlay) overlay.style.display = 'none';

  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (window.userData) window.userData.oslAddFriendsPromptSeen = true;
  if (user && window.db) {
    window.db.collection('users').doc(user.uid).set({ oslAddFriendsPromptSeen: true }, { merge: true })
      .catch(function(err){ console.error('Save add-friends-prompt-seen error:', err); });
  }

  if (alsoOpenSheet && typeof showAddFriendsSheet === 'function') showAddFriendsSheet();

  // Now that the prompt is resolved, run the day-reveal check that was
  // deferred in _oslLandOnLineup.
  var todayKey = window._addFriendsPromptTodayKey;
  if (todayKey && typeof loadOslFriendRsvps === 'function') {
    loadOslFriendRsvps(function(){ if (typeof _maybeShowOslDayReveal === 'function') _maybeShowOslDayReveal(todayKey); });
  }
}

function oslTab(tab, evt) {
  evt = evt || window.event;
  document.querySelectorAll('.osl-main-tab').forEach(function(t) {
    t.style.color = 'rgba(255,255,255,0.55)';
    t.style.fontWeight = '600';
    t.style.borderBottom = '2px solid transparent';
  });
  if (evt && evt.target) {
    evt.target.style.color = 'rgba(168,159,232,1)';
    evt.target.style.fontWeight = '700';
    evt.target.style.borderBottom = '2px solid rgba(168,159,232,0.9)';
  }

  ['osl2-lineup','osl2-chat','osl2-chat-input','osl2-photos','osl2-myfest','osl2-more','osl2-allsongs','osl2-export'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  if (tab === 'lineup') {
    document.getElementById('osl2-lineup').style.display = 'flex';
    document.getElementById('osl2-lineup').style.flexDirection = 'column';
  } else if (tab === 'myfest') {
    document.getElementById('osl2-myfest').style.display = 'flex';
    document.getElementById('osl2-myfest').style.flexDirection = 'column';
    if (typeof loadOslFriendRsvps === 'function') loadOslFriendRsvps(function(){
      if (typeof updateMyFest === 'function') updateMyFest();
      if (typeof _scrollMyFestToToday === 'function') _scrollMyFestToToday();
    });
  } else if (tab === 'chat') {
    var chatPanel = document.getElementById('osl2-chat');
    chatPanel.style.display = 'flex';
    document.getElementById('osl2-chat-input').style.display = 'flex';
    if (typeof startOslChat === 'function') startOslChat();
    // scrollHeight reads as 0 while display:none, so the scroll-to-bottom in
    // renderOslChat has nothing to work with until the panel is actually
    // shown — redo it now that it has real layout
    setTimeout(function(){ chatPanel.scrollTop = chatPanel.scrollHeight; }, 0);
  } else if (tab === 'more') {
    document.getElementById('osl2-more').style.display = 'flex';
    document.getElementById('osl2-more').style.flexDirection = 'column';
  }
}

// The More tab holds Photos and Our Festival Music behind a small menu
// rather than crowding the tab bar with a fifth item. Each sub-view gets
// its own back button (see oslMoreBack) rather than relying on re-tapping
// the More tab, since that's not always where someone's attention is.
function oslMoreOpenPhotos() {
  var menu = document.getElementById('osl2-more');
  var photos = document.getElementById('osl2-photos');
  if (menu) menu.style.display = 'none';
  if (photos) { photos.style.display = 'flex'; photos.style.flexDirection = 'column'; }
  if (typeof startOslPhotos === 'function') startOslPhotos();
}

function oslMoreOpenMusic() {
  var menu = document.getElementById('osl2-more');
  var music = document.getElementById('osl2-allsongs');
  if (menu) menu.style.display = 'none';
  if (music) { music.style.display = 'flex'; music.style.flexDirection = 'column'; }
  if (typeof startOslAllSongs === 'function') startOslAllSongs();
}

function oslMoreOpenExport() {
  var menu = document.getElementById('osl2-more');
  var exportPanel = document.getElementById('osl2-export');
  if (menu) menu.style.display = 'none';
  if (exportPanel) { exportPanel.style.display = 'flex'; exportPanel.style.flexDirection = 'column'; }
  if (typeof loadCompareFriends === 'function') {
    loadCompareFriends(function(){
      window._exportDay = window._exportDay || 'fri';
      renderExportFriendsLine();
      renderExportPoster(window._exportDay);
    });
  }
}

function oslMoreBack() {
  var photos = document.getElementById('osl2-photos');
  var music = document.getElementById('osl2-allsongs');
  var exportPanel = document.getElementById('osl2-export');
  var friendsFestList = document.getElementById('osl2-friends-fest-list');
  var menu = document.getElementById('osl2-more');
  if (photos) photos.style.display = 'none';
  if (music) music.style.display = 'none';
  if (exportPanel) exportPanel.style.display = 'none';
  if (friendsFestList) friendsFestList.style.display = 'none';
  if (menu) { menu.style.display = 'flex'; menu.style.flexDirection = 'column'; }
}

// ── FRIENDS' FESTIVALS — temporary MVP surface so seeing a friend's picks
// doesn't require finding their profile first. Scoped to accepted friends
// only (matching Compare/Export/the avatar clusters), not everyone going —
// an earlier version was open to anyone going, but that undercut the case
// for adding friends at all, so it's friends-only now.
function oslMoreOpenFriendsFest() {
  var menu = document.getElementById('osl2-more');
  var picker = document.getElementById('osl2-friends-fest-list');
  if (menu) menu.style.display = 'none';
  if (picker) { picker.style.display = 'flex'; picker.style.flexDirection = 'column'; }
  loadFriendsFestivalPickerList();
}

function loadFriendsFestivalPickerList() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var listEl = document.getElementById('friends-fest-picker-list');
  if (!user || !window.db || !listEl) return;
  listEl.innerHTML = '<div style="padding:40px 24px;text-align:center;color:rgba(255,255,255,0.35);font-size:13px">Loading…</div>';
  Promise.all([
    window.db.collection('friendRequests').where('fromUid', '==', user.uid).where('status', '==', 'accepted').get(),
    window.db.collection('friendRequests').where('toUid', '==', user.uid).where('status', '==', 'accepted').get()
  ]).then(function(results){
    var uids = [];
    results[0].forEach(function(d){ uids.push(d.data().toUid); });
    results[1].forEach(function(d){ uids.push(d.data().fromUid); });
    uids = uids.filter(function(v, i){ return uids.indexOf(v) === i; });
    if (!uids.length) {
      listEl.innerHTML = '<div style="padding:40px 24px;text-align:center;color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6">None of your friends are marked going or maybe yet.</div>';
      return;
    }
    return Promise.all(uids.map(function(uid){ return window.db.collection('users').doc(uid).get(); })).then(function(docs){
      var people = [];
      docs.forEach(function(doc){
        var d = doc.data() || {};
        if (d.oslRsvp === 'going' || d.oslRsvp === 'maybe') {
          people.push({ uid: doc.id, name: d.name || 'Friend', status: d.oslRsvp });
        }
      });
      people.sort(function(a, b){ return a.name.localeCompare(b.name); });
      if (!people.length) {
        listEl.innerHTML = '<div style="padding:40px 24px;text-align:center;color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6">None of your friends are marked going or maybe yet.</div>';
        return;
      }
      listEl.innerHTML = people.map(function(p){
        var ring = p.status === 'going' ? 'rgba(168,159,232,0.95)' : '#FEDF9A';
        var label = p.status === 'going' ? 'Going' : 'Maybe';
        var labelColor = p.status === 'going' ? 'rgba(168,159,232,0.9)' : '#FEDF9A';
        return '<div onclick="openFriendFestival(\'' + p.uid + '\',\'' + p.name.replace(/'/g,"\\'") + '\')" style="display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:0.5px solid rgba(255,255,255,0.06);cursor:pointer">' +
          '<div class="av av-a" style="width:38px;height:38px;font-size:13px;flex-shrink:0;border:2px solid ' + ring + '">' + _escapeHtml(_initials(p.name)) + '</div>' +
          '<div style="flex:1;font-size:14px;font-weight:600;color:white">' + _escapeHtml(p.name) + '</div>' +
          '<div style="font-size:10px;font-weight:700;color:' + labelColor + ';text-transform:uppercase;letter-spacing:0.05em;flex-shrink:0">' + label + '</div>' +
          '<svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 1 6 6 1 11"/></svg>' +
        '</div>';
      }).join('');
    });
  }).catch(function(err){
    console.error('Load friends festival picker error:', err);
    listEl.innerHTML = '<div style="padding:40px 24px;text-align:center;color:rgba(255,255,255,0.35);font-size:13px">Could not load — check Firestore rules</div>';
  });
}

function openFriendFestival(uid, name) {
  window._viewingFriendUid = uid;
  window._viewingFriendName = name;
  var picker = document.getElementById('osl2-friends-fest-list');
  var detail = document.getElementById('osl2-friend-fest-detail');
  if (picker) picker.style.display = 'none';
  if (detail) { detail.style.display = 'flex'; detail.style.flexDirection = 'column'; }
  var nameEl = document.getElementById('friend-fest-name');
  if (nameEl) nameEl.textContent = name + "'s Festival";
  document.querySelectorAll('.friend-fest-day-tab').forEach(function(t){
    var isDay = t.getAttribute('data-day') === 'fri';
    t.style.background = isDay ? 'rgba(168,159,232,0.9)' : 'rgba(255,255,255,0.06)';
    t.style.color = isDay ? '#0D0820' : 'rgba(255,255,255,0.5)';
  });
  renderFriendFestivalDay('fri');
}

function closeFriendFestivalDetail() {
  var picker = document.getElementById('osl2-friends-fest-list');
  var detail = document.getElementById('osl2-friend-fest-detail');
  if (detail) detail.style.display = 'none';
  if (picker) { picker.style.display = 'flex'; picker.style.flexDirection = 'column'; }
}

function setFriendFestDay(day, el) {
  document.querySelectorAll('.friend-fest-day-tab').forEach(function(t){
    t.style.background = 'rgba(255,255,255,0.06)';
    t.style.color = 'rgba(255,255,255,0.5)';
  });
  if (el) {
    el.style.background = 'rgba(168,159,232,0.9)';
    el.style.color = '#0D0820';
  }
  renderFriendFestivalDay(day);
}

// Read-only mirror of Your Festival, sourced from someone else's actRsvps
// field on their own user doc (same field Compare/Export already read for
// friends) rather than the viewer's own myRsvps. No conflict cards, no
// walking connectors, no editing — MVP scope is just "see their picks."
function renderFriendFestivalDay(dayKey) {
  var listEl = document.getElementById('friend-fest-list');
  var uid = window._viewingFriendUid;
  if (!listEl || !uid || !window.db) return;
  listEl.innerHTML = '<div style="padding:40px 24px;text-align:center;color:rgba(255,255,255,0.35);font-size:13px">Loading…</div>';
  window.db.collection('users').doc(uid).get().then(function(doc){
    var d = doc.exists ? (doc.data() || {}) : {};
    var actRsvps = d.oslActRsvps || {};
    var actsInDay = stageData[dayKey] || {};
    var rows = [];
    Object.keys(actsInDay).forEach(function(stageKey){
      var stage = actsInDay[stageKey];
      stage.acts.forEach(function(act){
        var st = actRsvps[act.name];
        if (st === 'going' || st === 'maybe') rows.push({ name: act.name, time: act.time, stage: stage.name, status: st });
      });
    });
    rows.sort(function(a, b){ return _actStartMinutes(a.time) - _actStartMinutes(b.time); });
    if (!rows.length) {
      listEl.innerHTML = '<div style="padding:40px 24px;text-align:center;color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6">No picks marked for this day yet.</div>';
      return;
    }
    listEl.innerHTML = rows.map(function(r){
      var ring = r.status === 'going' ? 'rgba(168,159,232,0.95)' : '#FEDF9A';
      var label = r.status === 'going' ? 'Going' : 'Maybe';
      return '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:0.5px solid rgba(255,255,255,0.06)">' +
        '<div style="width:64px;flex-shrink:0;font-size:12px;font-weight:700;color:rgba(168,159,232,0.85)">' + _escapeHtml(r.time) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:14.5px;font-weight:700;color:white">' + _escapeHtml(r.name) + '</div>' +
          '<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:1px">' + _escapeHtml(r.stage) + '</div>' +
        '</div>' +
        '<div style="width:8px;height:8px;border-radius:50%;background:' + ring + ';flex-shrink:0" title="' + label + '"></div>' +
      '</div>';
    }).join('');
  }).catch(function(err){
    console.error('Load friend festival error:', err);
    listEl.innerHTML = '<div style="padding:40px 24px;text-align:center;color:rgba(255,255,255,0.35);font-size:13px">Could not load their picks.</div>';
  });
}

// ── EXPORT YOUR FESTIVAL — a downloadable image summarizing everyone's
// Going/Maybe picks in chronological order, for when service is spotty at
// the festival itself. Pulls from the same friend pool Compare Your
// Festival already established (accepted Innings friends who are also
// going/maybe), so "everyone" here means people you actually know, not
// every stranger who RSVP'd.
window._exportDay = 'fri';

// Parses "6:55–8:25 PM" into minutes-since-midnight for the START time —
// unlike Your Festival's own list (sorted by end time, so a late-ending
// headliner sorts last), a schedule export reads naturally by start time:
// "what's happening at 5pm" is how people actually scan a lineup.
function _actStartMinutes(timeStr) {
  if (!timeStr) return 0;
  var parts = timeStr.split('–');
  var startPart = parts[0].trim();
  var suffixMatch = timeStr.match(/(AM|PM)/i);
  var suffix = suffixMatch ? suffixMatch[1].toUpperCase() : '';
  var startSuffixMatch = startPart.match(/(AM|PM)/i);
  if (startSuffixMatch) suffix = startSuffixMatch[1].toUpperCase();
  var timeOnly = startPart.replace(/(AM|PM)/i, '').trim();
  var bits = timeOnly.split(':');
  var hour = parseInt(bits[0], 10) || 0;
  var min = parseInt(bits[1], 10) || 0;
  if (suffix === 'PM' && hour !== 12) hour += 12;
  if (suffix === 'AM' && hour === 12) hour = 0;
  return hour * 60 + min;
}

// Same idea as _actStartMinutes but for the END of the range — used both
// for end-time sorting (Your Festival) and for computing the gap between
// two acts (walking-time connectors, here and in Export).
function _actEndMinutes(timeStr) {
  if (!timeStr) return 0;
  var parts = timeStr.split('–');
  var endPart = (parts[1] || parts[0]).trim();
  var suffixMatch = timeStr.match(/(AM|PM)/i);
  var suffix = suffixMatch ? suffixMatch[1].toUpperCase() : '';
  var endSuffixMatch = endPart.match(/(AM|PM)/i);
  if (endSuffixMatch) suffix = endSuffixMatch[1].toUpperCase();
  var timeOnly = endPart.replace(/(AM|PM)/i, '').trim();
  var bits = timeOnly.split(':');
  var hour = parseInt(bits[0], 10) || 0;
  var min = parseInt(bits[1], 10) || 0;
  if (suffix === 'PM' && hour !== 12) hour += 12;
  if (suffix === 'AM' && hour === 12) hour = 0;
  return hour * 60 + min;
}

// ── WALKING-TIME CONNECTOR (Your Festival only, not Compare) ──
// PLACEHOLDER estimates, NOT measured distances — these came from general
// knowledge of Golden Gate Park, not a verified walk of the actual 2026
// stage layout. Update with real timings (walk it yourself day one, or a
// scaled site map) before trusting this for real logistics. Keying this
// off the exact stage names in stageData ('Lands End', 'SOMA', 'Twin
// Peaks', 'Sutro', 'Panhandle') so a lookup miss fails safely (renders
// nothing) rather than guessing.
var OSL_WALK_MINUTES = {
  'Lands End|SOMA': 12, 'Lands End|Twin Peaks': 15, 'Lands End|Sutro': 18, 'Lands End|Panhandle': 22,
  'SOMA|Twin Peaks': 8, 'SOMA|Sutro': 14, 'SOMA|Panhandle': 16,
  'Twin Peaks|Sutro': 10, 'Twin Peaks|Panhandle': 12,
  'Sutro|Panhandle': 9
};
function _oslWalkMinutes(a, b) {
  if (a === b) return 0;
  var key1 = a + '|' + b, key2 = b + '|' + a;
  if (OSL_WALK_MINUTES[key1] !== undefined) return OSL_WALK_MINUTES[key1];
  if (OSL_WALK_MINUTES[key2] !== undefined) return OSL_WALK_MINUTES[key2];
  return null;
}
// Plain minutes under an hour, H:MM once it crosses 60 — "1:15 to spare"
// reads faster than "75 minutes to spare".
function _fmtWalkDuration(mins) {
  var abs = Math.abs(mins);
  if (abs < 60) return abs + ' min';
  var h = Math.floor(abs / 60), m = abs % 60;
  return h + ':' + (m < 10 ? '0' : '') + m;
}

function renderExportFriendsLine() {
  var el = document.getElementById('export-friends-line');
  if (!el) return;
  var friends = (window._compareFriendsCache || []).filter(function(f){ return f.oslRsvp === 'going' || f.oslRsvp === 'maybe'; });
  if (!friends.length) {
    el.innerHTML = 'Just your own picks for now — friends who RSVP show up here too.';
    return;
  }
  var shown = friends.slice(0, 4);
  var extra = friends.length - shown.length;
  var avsHtml = shown.map(function(f, i){
    var colors = ['#5B3E8A','#2C4E7A','#2D5A3F','#7A4F10'];
    return '<div style="width:22px;height:22px;border-radius:50%;background:' + colors[i % colors.length] + ';border:2px solid #0D0820;display:flex;align-items:center;justify-content:center;font-size:8.5px;font-weight:700;color:white;margin-left:' + (i === 0 ? '0' : '-6px') + '">' + _escapeHtml(_initialsFallback(f.name)) + '</div>';
  }).join('');
  el.innerHTML = '<div style="display:flex">' + avsHtml + '</div>' +
    '<div>' + friends.length + ' friend' + (friends.length === 1 ? '' : 's') + ' going or maybe' + (extra > 0 ? ' · +' + extra + ' more' : '') + '</div>';
}

function setExportDay(day, el) {
  window._exportDay = day;
  document.querySelectorAll('.export-day-tab').forEach(function(t){
    var active = t === el;
    t.style.background = active ? 'rgba(168,159,232,0.9)' : 'rgba(255,255,255,0.06)';
    t.style.color = active ? '#0D0820' : 'rgba(255,255,255,0.5)';
    t.style.borderColor = active ? 'transparent' : 'rgba(255,255,255,0.1)';
  });
  renderExportPoster(day);
}

// Same visual language as Your Festival's connector (thin line implied by
// spacing, walk time + net buffer, no stage names spelled out) — but every
// consecutive pair gets one here, not just consecutive Going acts, since
// Export is a whole-group cheat sheet rather than one person's own plan.
function _exportWalkConnectorHtml(prevRow, nextRow) {
  if (prevRow.stage === nextRow.stage) {
    return '<div style="display:flex;align-items:center;gap:7px;padding:6px 0 6px 2px;font-size:10.5px;color:rgba(255,255,255,0.3)">📍 No walk needed — same stage</div>';
  }
  var walk = _oslWalkMinutes(prevRow.stage, nextRow.stage);
  if (walk === null) return '';
  var gapMinutes = _actStartMinutes(nextRow.time) - _actEndMinutes(prevRow.time);
  var buffer = gapMinutes - walk;
  var color = buffer >= 15 ? 'rgba(126,217,168,0.95)' : buffer >= 0 ? '#FEDF9A' : '#FF6B6B';
  var verdict = buffer >= 0 ? (_fmtWalkDuration(buffer) + ' to spare') : (_fmtWalkDuration(buffer) + ' short');
  return '<div style="display:flex;align-items:center;gap:7px;padding:6px 0 6px 2px;font-size:11px">' +
    '<span style="color:rgba(255,255,255,0.45);font-weight:600">🚶 ~' + _fmtWalkDuration(walk) + '</span>' +
    '<span style="color:rgba(255,255,255,0.25)">·</span>' +
    '<span style="color:' + color + ';font-weight:700">' + verdict + '</span>' +
  '</div>';
}

// Fixed acts-per-page rather than shrinking the font to cram a busy day
// onto one image — a 10-act day becomes two comfortably-sized, equally
// readable images instead of one cramped one.
var EXPORT_MAX_ACTS_PER_PAGE = 6;

function renderExportPoster(dayKey) {
  var dayLabels = { fri: 'Friday, August 7', sat: 'Saturday, August 8', sun: 'Sunday, August 9' };
  var container = document.getElementById('export-posters-container');
  var hint = document.getElementById('export-save-hint');
  if (!container) return;

  var friends = (window._compareFriendsCache || []).filter(function(f){ return f.oslRsvp === 'going' || f.oslRsvp === 'maybe'; });
  var friendColors = ['#5B3E8A','#2C4E7A','#2D5A3F','#7A4F10','#7A2E4F','#2E5A7A','#3D3580'];

  // Union of every act where you or any included friend marked going/maybe —
  // this is what makes the export a whole-group cheat sheet, not just yours.
  var actsInDay = stageData[dayKey] || {};
  var rows = [];
  Object.keys(actsInDay).forEach(function(stageKey){
    var stage = actsInDay[stageKey];
    stage.acts.forEach(function(act){
      var people = [];
      var myStatus = myRsvps[act.name];
      if (myStatus === 'going' || myStatus === 'maybe') people.push({ initial: 'You', color: '#3D3580', status: myStatus });
      friends.forEach(function(f, i){
        var st = (f.actRsvps || {})[act.name];
        if (st === 'going' || st === 'maybe') people.push({ initial: _initialsFallback(f.name), color: friendColors[i % friendColors.length], status: st });
      });
      if (people.length) rows.push({ name: act.name, time: act.time, stage: stage.name, people: people });
    });
  });
  rows.sort(function(a, b){ return _actStartMinutes(a.time) - _actStartMinutes(b.time); });

  if (!rows.length) {
    container.innerHTML = '<div style="border-radius:20px;padding:30px 20px;text-align:center;color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6;background:linear-gradient(160deg,#1A0A2E 0%,#0D0820 55%,#150A30 100%)">No picks marked for this day yet — mark some acts Going or Maybe in Lineup first.</div>';
    if (hint) hint.textContent = 'Saves as an image — no signal needed to look at it later.';
    return;
  }

  var pages = [];
  for (var i = 0; i < rows.length; i += EXPORT_MAX_ACTS_PER_PAGE) {
    pages.push(rows.slice(i, i + EXPORT_MAX_ACTS_PER_PAGE));
  }

  container.innerHTML = pages.map(function(pageRows, pageIndex){
    var rowsHtml = pageRows.map(function(r, i){
      var connectorHtml = i > 0 ? _exportWalkConnectorHtml(pageRows[i - 1], r) : '';
      var shown = r.people.slice(0, 4);
      var extra = r.people.length - shown.length;
      var avsHtml = shown.map(function(p, pi){
        var ring = p.status === 'going' ? 'rgba(168,159,232,0.95)' : '#FEDF9A';
        return '<div style="width:22px;height:22px;border-radius:50%;background:' + p.color + ';border:2px solid ' + ring + ';display:flex;align-items:center;justify-content:center;font-size:8.5px;font-weight:700;color:white;margin-left:' + (pi === 0 ? '0' : '-6px') + '">' + _escapeHtml(p.initial.charAt(0).toUpperCase()) + '</div>';
      }).join('');
      return connectorHtml + '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:0.5px solid rgba(255,255,255,0.08)">' +
        '<div style="width:64px;flex-shrink:0;font-size:12px;font-weight:700;color:rgba(168,159,232,0.85)">' + _escapeHtml(r.time) + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:14.5px;font-weight:700;color:white">' + _escapeHtml(r.name) + '</div>' +
          '<div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:1px">' + _escapeHtml(r.stage) + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;flex-shrink:0">' +
          '<div style="display:flex">' + avsHtml + '</div>' +
          (extra > 0 ? '<div style="font-size:10px;color:rgba(255,255,255,0.4);margin-left:6px">+' + extra + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    var partBadge = pages.length > 1
      ? '<div style="display:inline-block;margin-top:9px;font-size:13px;font-weight:800;color:#0D0820;background:rgba(168,159,232,0.95);padding:5px 13px;border-radius:10px;letter-spacing:0.02em">PART ' + (pageIndex + 1) + ' OF ' + pages.length + '</div>'
      : '';

    return '<div class="export-poster-page" style="border-radius:20px;overflow:hidden;background:linear-gradient(160deg,#1A0A2E 0%,#0D0820 55%,#150A30 100%);margin-bottom:' + (pageIndex < pages.length - 1 ? '16px' : '0') + '">' +
      '<div style="padding:24px 20px 16px">' +
        '<div style="font-size:10px;font-weight:700;color:rgba(168,159,232,0.7);text-transform:uppercase;letter-spacing:0.18em">Outside Lands 2026</div>' +
        '<div style="font-size:22px;font-weight:900;color:white;letter-spacing:-0.5px;margin-top:4px">' + (dayLabels[dayKey] || '') + '</div>' +
        partBadge +
        '<div style="font-size:13px;color:rgba(255,255,255,0.45);margin-top:' + (pages.length > 1 ? '10px' : '2px') + '">Your group\'s picks, in order</div>' +
        '<div style="display:flex;gap:16px;margin-top:14px">' +
          '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:rgba(255,255,255,0.5)"><div style="width:9px;height:9px;border-radius:50%;background:rgba(168,159,232,0.95)"></div>Going</div>' +
          '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:rgba(255,255,255,0.5)"><div style="width:9px;height:9px;border-radius:50%;background:#FEDF9A"></div>Maybe</div>' +
        '</div>' +
      '</div>' +
      '<div style="padding:4px 20px 22px">' + rowsHtml + '</div>' +
      '<div style="padding:14px 20px 18px;border-top:0.5px solid rgba(255,255,255,0.08);text-align:center">' +
        '<div style="font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.02em">Made with <b style="color:rgba(168,159,232,0.9)">Innings</b> · every moment deserves a home</div>' +
      '</div>' +
    '</div>';
  }).join('');

  if (hint) {
    hint.textContent = pages.length > 1
      ? 'Saves as ' + pages.length + ' images — no signal needed to look at them later.'
      : 'Saves as an image — no signal needed to look at it later.';
  }
}

function exportFestivalToPhotos() {
  if (typeof html2canvas !== 'function') { if (typeof ib_toast === 'function') ib_toast('Could not generate image — try reloading'); return; }
  var pageEls = document.querySelectorAll('#export-posters-container .export-poster-page');
  if (!pageEls.length) return;
  if (typeof ib_toast === 'function') ib_toast(pageEls.length > 1 ? 'Preparing images…' : 'Preparing image…');

  var dayKey = window._exportDay || 'fri';
  var captures = Array.prototype.map.call(pageEls, function(el){
    return html2canvas(el, { backgroundColor: '#0D0820', scale: 2, useCORS: true });
  });

  Promise.all(captures).then(function(canvases){
    return Promise.all(canvases.map(function(canvas){
      return new Promise(function(resolve){ canvas.toBlob(function(blob){ resolve(blob); }, 'image/png'); });
    }));
  }).then(function(blobs){
    if (blobs.some(function(b){ return !b; })) { if (typeof ib_toast === 'function') ib_toast('Could not generate image — try again'); return; }
    var files = blobs.map(function(blob, i){
      var suffix = blobs.length > 1 ? '-part' + (i + 1) : '';
      return new File([blob], 'innings-outside-lands-' + dayKey + suffix + '.png', { type: 'image/png' });
    });
    if (navigator.canShare && navigator.canShare({ files: files })) {
      navigator.share({ files: files }).catch(function(){});
    } else {
      files.forEach(function(file, i){
        setTimeout(function(){
          var url = URL.createObjectURL(file);
          var a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
        }, i * 300);
      });
      if (typeof ib_toast === 'function') ib_toast('Downloaded — check your Files or Downloads');
    }
  }).catch(function(err){
    console.error('Export festival image error:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not generate image — try again');
  });
}
