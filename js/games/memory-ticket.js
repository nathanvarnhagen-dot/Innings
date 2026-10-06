// ══ GAME MEMORY TICKET (v5.68.0) ═════════════════════════════════════
// A memory with a game attached now opens as a ticket stub (score, and
// the seat if you were there) over a compact game card in the game
// screen's style, with a way into the full game screen. The full box
// score and play-by-play live on the game screen now, one tap away.
var _MD_MLB_ABBR = { 'Diamondbacks': 'AZ', 'Braves': 'ATL', 'Orioles': 'BAL', 'Red Sox': 'BOS', 'Cubs': 'CHC', 'White Sox': 'CWS', 'Reds': 'CIN', 'Guardians': 'CLE', 'Rockies': 'COL', 'Tigers': 'DET', 'Astros': 'HOU', 'Royals': 'KC', 'Angels': 'LAA', 'Dodgers': 'LAD', 'Marlins': 'MIA', 'Brewers': 'MIL', 'Twins': 'MIN', 'Mets': 'NYM', 'Yankees': 'NYY', 'Athletics': 'ATH', 'Phillies': 'PHI', 'Pirates': 'PIT', 'Padres': 'SD', 'Giants': 'SF', 'Mariners': 'SEA', 'Cardinals': 'STL', 'Rays': 'TB', 'Rangers': 'TEX', 'Blue Jays': 'TOR', 'Nationals': 'WSH' };
function _mdIsTicket(m) { return !!(m && !m.isOslMemory && m.boxScore && m.boxScore.home && m.boxScore.away); }
function _mdSport(m) { return (m.boxScore && m.boxScore.sport) || 'mlb'; }
function _mdSide(box, key, sport) {
  var name = box[key] || '';
  var abbr = box[key + 'Abbr'] || null;
  if (!abbr && sport === 'mlb') {
    Object.keys(_MD_MLB_ABBR).forEach(function (nick) { if (!abbr && name.indexOf(nick) !== -1) abbr = _MD_MLB_ABBR[nick]; });
  }
  if (!abbr) abbr = _ghAbbrFallback(name);
  var colors = sport === 'mlb' ? _ghTeamColors(abbr) : _gxColors(sport, abbr, box[key + 'Color'], box[key + 'AltColor']);
  return { name: name, short: _teamShortName(name) || name, abbr: abbr, colors: colors, score: box[key + 'Score'] };
}
function _mdStatus(box) {
  var st = String(box.status || '');
  if (box.gameState === 'Final' || (typeof _isGameConcluded === 'function' && _isGameConcluded(st)) || /final|game over|completed/i.test(st)) return { key: 'final', label: 'FINAL' };
  if (box.gameState === 'Live' || (typeof _isGameStatusLive === 'function' && _isGameStatusLive(st))) return { key: 'live', label: 'LIVE' };
  return { key: 'pre', label: st ? st.toUpperCase() : 'SCHEDULED' };
}
function _mdTicketHtml(m) {
  var box = m.boxScore, sport = _mdSport(m);
  var a = _mdSide(box, 'away', sport), h = _mdSide(box, 'home', sport), st = _mdStatus(box);
  var done = st.key === 'final' && a.score != null && h.score != null;
  var aWin = done && a.score > h.score, hWin = done && h.score > a.score;
  var att = m.attendance === 'watch' ? 'watch' : (m.attendance === 'attend' || m.seat ? 'attend' : null);
  var eyebrow = att === 'attend' ? 'Admit one · you were there' : (att === 'watch' ? 'Watched it' : 'The game');
  var seat = m.seat || {};
  var seatCells = [['Section', seat.section], ['Row', seat.row], ['Seat', seat.seat]].filter(function (x) { return x[1]; });
  var bottom = '';
  if (att === 'attend' && seatCells.length) {
    bottom = '<div class="mdt-stub" style="grid-template-columns:repeat(' + seatCells.length + ',minmax(0,1fr))">' + seatCells.map(function (x) {
      return '<div><span class="mdt-lbl">' + x[0] + '</span><span class="gh-num mdt-seat">' + _escapeHtml(String(x[1])) + '</span></div>';
    }).join('') + '</div>';
  } else if (att === 'watch' && m.watchedAt) {
    bottom = '<div class="mdt-stub" style="grid-template-columns:1fr"><div><span class="mdt-lbl">Watched at</span><span class="mdt-where">' + _escapeHtml(m.watchedAt) + '</span></div></div>';
  }
  var score = function (s, win, right) {
    return '<div class="mdt-side' + (right ? ' r' : '') + '"><span class="mdt-team">' + _escapeHtml(s.short) + '</span>' +
      '<span class="gh-num mdt-score" style="color:' + (win ? '#9be8ac' : '#fff') + '">' + (s.score != null ? s.score : '–') + '</span></div>';
  };
  return '<div class="mdt">' +
    '<div class="mdt-top" style="background:linear-gradient(135deg,' + a.colors.bg + ' 0%,#2A2160 55%,' + h.colors.bg + ' 140%)">' +
      '<div class="mdt-row"><span class="gh-eyebrow" style="color:#F4F1FF">' + eyebrow + '</span><span class="mdt-date">' + _escapeHtml(m.date ? _formatMomentDate(m.date) : '') + '</span></div>' +
      '<div class="mdt-row" style="align-items:center">' + score(a, aWin, false) +
        '<div class="mdt-mid"><span class="mdt-match">' + _escapeHtml(a.abbr + ' @ ' + h.abbr) + '</span><span class="mdt-st' + (st.key === 'live' ? ' live' : '') + '">' + _escapeHtml(st.label) + '</span></div>' +
        score(h, hWin, true) + '</div>' +
    '</div>' +
    (bottom ? '<div class="mdt-perf"></div>' + bottom : '') +
  '</div>';
}
function _mdLineScoreHtml(box, a, h) {
  var inn = box.innings || [];
  if (!inn.length) return '';
  var n = inn.length;
  var cols = 'grid-template-columns:34px repeat(' + n + ',minmax(0,1fr)) 26px';
  var fs = n > 10 ? 12 : 14;
  var head = '<span></span>' + inn.map(function (x, i) { return '<span>' + _escapeHtml(String(x.label != null ? x.label : (x.num != null ? x.num : i + 1))) + '</span>'; }).join('') + '<span style="color:#D9D4FA;border-left:1px solid rgba(168,159,232,.22)">R</span>';
  var row = function (s, key) {
    return '<span style="text-align:left;font-weight:800;color:' + s.colors.accent + '">' + _escapeHtml(s.abbr) + '</span>' +
      inn.map(function (x) { var v = x[key]; return '<span style="' + (v > 0 ? 'color:#fff;font-weight:800' : 'color:#9C95D0') + '">' + (v != null ? v : '') + '</span>'; }).join('') +
      '<span style="color:#fff;font-weight:800;border-left:1px solid rgba(168,159,232,.22)">' + (s.score != null ? s.score : '') + '</span>';
  };
  return '<div class="gh-panel" style="padding:8px 12px;display:flex;flex-direction:column;gap:2px;overflow-x:auto">' +
    '<div class="gh-num mdt-ls" style="' + cols + ';height:18px;font-size:11px;color:#9C95D0">' + head + '</div>' +
    '<div class="gh-num mdt-ls" style="' + cols + ';height:24px;font-size:' + fs + 'px">' + row(a, 'away') + '</div>' +
    '<div class="gh-num mdt-ls" style="' + cols + ';height:24px;font-size:' + fs + 'px">' + row(h, 'home') + '</div></div>';
}
function _mdGameCardHtml(m) {
  var box = m.boxScore, sport = _mdSport(m);
  var a = _mdSide(box, 'away', sport), h = _mdSide(box, 'home', sport);
  var html = '<div class="gh-row"><span class="gh-eyebrow">The game</span>' + (box.venue ? '<span class="gh-meta">' + _escapeHtml(box.venue) + '</span>' : '') + '</div>';
  html += _mdLineScoreHtml(box, a, h);
  var moments = '';
  if (sport === 'mlb') {
    var model = null;
    try { model = _ghModelFromMlbBox(Object.assign({}, box, { awayAbbr: a.abbr, homeAbbr: h.abbr })); } catch (e) { model = null; } // older boxes have no abbreviations
    if (model && model.plays && model.plays.length) {
      var recap = '';
      try { recap = _ghRecap(model); } catch (e) {}
      if (recap) html += '<p style="margin:0;font-size:13.5px;line-height:1.5;color:#D9D4FA">' + _escapeHtml(recap) + '</p>';
      moments = _ghKeyMoments(model).map(function (p) {
        return '<div style="display:flex;align-items:center;gap:10px">' + _ghInningTag(p.half, p.inning, model) +
          '<span style="font-size:13.5px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(_ghPlayHeadline(p)) + '</span>' +
          '<span class="gh-num" style="font-size:13.5px;white-space:nowrap">' + _escapeHtml(_ghScoreChip(p, model.away.abbr, model.home.abbr)) + '</span></div>';
      }).join('');
    } else if ((box.homeRuns || []).length) {
      moments = box.homeRuns.slice(0, 3).map(function (hr) {
        return '<div style="display:flex;align-items:center;gap:10px"><span class="gh-tag" style="background:rgba(168,159,232,.18);color:#D9D4FA">HR</span><span style="font-size:13.5px;font-weight:600;flex:1;min-width:0">' + _escapeHtml(hr.description || (hr.batter ? hr.batter + ' homers' : 'Home run')) + '</span></div>';
      }).join('');
    }
  } else if ((box.highlights || []).length) {
    moments = box.highlights.slice(-3).map(function (x) {
      return '<div style="font-size:13.5px;font-weight:600;line-height:1.4">' + _escapeHtml(x.text || '') + '</div>';
    }).join('');
  }
  if (moments) html += '<div style="display:flex;flex-direction:column;gap:8px"><span class="gh-eyebrow">Moments that decided it</span>' + moments + '</div>';
  var d = box.decisionsDetail || {};
  var dec = [['W', '#9be8ac', d.winner && d.winner.name, box.winningPitcher], ['L', '#9C95D0', d.loser && d.loser.name, box.losingPitcher], ['S', '#A89FE8', d.save && d.save.name, box.savePitcher]]
    .map(function (x) { var nm = x[2] || x[3]; return nm ? '<span style="white-space:nowrap"><b style="color:' + x[1] + '">' + x[0] + '</b> ' + _escapeHtml(_ghLastName(nm)) + '</span>' : ''; })
    .filter(Boolean).join('');
  if (dec) html += '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px">' + dec + '</div>';
  if (sport === 'mlb' && box.gamePk != null && typeof _savMemoryFill === 'function') { var _pk = box.gamePk; html += '<div id="md-sav-' + _escapeHtml(String(_pk)) + '"></div>'; setTimeout(function () { _savMemoryFill(_pk); }, 0); }
  if (box.gamePk != null) html += '<button class="mdt-open" onclick="mdOpenGame()">Open the game <span aria-hidden="true">›</span></button>';
  return '<div class="gh" style="margin:12px 0 0"><div class="gh-orb" style="right:-80px;top:-90px"></div><div class="gh-body">' + html + '</div></div>';
}
function _mdGameBlockHtml(m) {
  try { return _mdTicketHtml(m) + (typeof _ywVerdictSlotHtml === 'function' ? _ywVerdictSlotHtml(m) : '') + _mdGameCardHtml(m); }
  catch (e) { console.error('[memory ticket] render failed, falling back:', e); return _boxScoreCardHtml(m.boxScore, true); }
}
function mdOpenGame() {
  var m = window._mdTicketMoment;
  var bs = m && m.boxScore;
  if (!bs || bs.gamePk == null) return;
  openGameScreen(bs.gamePk, bs.away || null, bs.home || null, bs.sport || 'mlb', m.date || bs.date || null);
}

// ══ GAME CHAT: photos, link previews, play replies & play reactions ══
function sendGameChatPhoto(input) {
  if (!input.files || !input.files.length) return;
  var g = window._activeBrowseGame;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!g || !user || !window.db) { if (typeof ib_toast === 'function') ib_toast('Sign in to chat'); input.value = ''; return; }
  var file = input.files[0];
  input.value = '';
  var author = (window.userData && window.userData.name) || 'You';
  if (typeof ib_toast === 'function') ib_toast('Sending photo…');
  var reader = new FileReader();
  reader.onload = function (e) {
    _downscaleImage(e.target.result, 1200, function (small) {
      // Stay well under Firestore's 1MB document limit.
      var go = function (photo) {
        window.db.collection('gameChats').add({ gamePk: g.gamePk, uid: user.uid, author: author, text: '', photo: photo, ts: Date.now() })
          .then(function () { if (typeof _notifyFriendsWatchingOfChatMessage === 'function') _notifyFriendsWatchingOfChatMessage(g, 'sent a photo'); })
          .catch(function (err) { console.error('[gameChats:photo] ' + (err && err.code), err); if (typeof ib_toast === 'function') ib_toast('Could not send photo — ' + ((err && err.code) || 'try again')); });
      };
      if (small.length > 850000) _downscaleImage(small, 800, go); else go(small);
    });
  };
  reader.readAsDataURL(file);
}

// Finds the play row on the cheat sheet for a given play text, and the
// reaction id its row already carries — so a reply knows exactly which
// play it's about.
function _gcPlayRow(text) {
  var root = document.getElementById('game-sheet-panel');
  if (!root || !text) return null;
  var rows = root.querySelectorAll('[data-rtext]');
  for (var i = 0; i < rows.length; i++) { if (rows[i].getAttribute('data-rtext') === text) return rows[i]; }
  return null;
}
function _gcPlayIdFromRow(row) {
  if (!row) return null;
  var m = String(row.getAttribute('onclick') || '').match(/_playDoubleTap\(this,'([^']+)'/);
  return m ? m[1] : null;
}
function _gcBox() {
  return window._lastLiveBox || (window._gdPregame && window._gdPregame.heroBox) || null;
}
function _gcFindPlay(text, playId) {
  var box = _gcBox();
  if (!box) return { box: null, list: [], idx: -1 };
  var list = (box.allPlays && box.allPlays.length) ? box.allPlays : (box.recentPlays || []).slice().reverse();
  var idx = -1;
  var abi = playId ? String(playId).split('_').pop() : null;
  if (abi && /^\d+$/.test(abi)) list.forEach(function (p, i) { if (idx === -1 && String(p.atBatIndex) === abi) idx = i; });
  if (idx === -1) list.forEach(function (p, i) { if (idx === -1 && p.text === text) idx = i; });
  return { box: box, list: list, idx: idx };
}
function _gcPlayQuoteHtml(rt, mine) {
  var play = rt.play || { tag: rt.author, text: rt.text, playId: null };
  var score = play.score ? ' · ' + play.score : '';
  var bd = mine ? 'rgba(255,255,255,0.45)' : 'rgba(168,159,232,.6)';
  return '<button class="gc-pq' + (mine ? ' me' : '') + '" data-tag="' + _escapeHtml(play.tag || '') + '" data-text="' + _escapeHtml(play.text || '') + '" data-pid="' + _escapeHtml(play.playId || '') + '" onclick="event.stopPropagation();openPlayContext(this.dataset.tag,this.dataset.text,this.dataset.pid||null)" style="border-left-color:' + bd + '">' +
    '<span class="gc-pq-hd"><span>' + _escapeHtml((play.tag || 'Play') + score) + '</span><span class="gc-pq-go">View play ›</span></span>' +
    '<span class="gc-pq-tx">' + _escapeHtml(play.text || '') + '</span></button>';
}
// Replies to a play are the only replies with no message id (plays
// aren't messages) — older ones predate the saved play details but
// still carry its tag (as author) and text.
function _gcIsPlayReply(rt) { return !!(rt && (rt.play || rt.msgId == null)); }

function renderGameChat(msgs) {
  var box = document.getElementById('game-chat-msgs');
  var empty = document.getElementById('game-chat-empty');
  if (!box) return;
  if (empty) empty.style.display = msgs.length ? 'none' : 'flex';
  var myUid = (window.currentUser && window.currentUser.uid) || (window.auth && window.auth.currentUser && window.auth.currentUser.uid);
  box.innerHTML = msgs.map(function (c) {
    var mine = c.uid && c.uid === myUid;
    if (c.systemType === 'play_reaction' && c.play) {
      return '<button class="gc-sys" data-tag="' + _escapeHtml(c.play.tag || '') + '" data-text="' + _escapeHtml(c.play.text || '') + '" data-pid="' + _escapeHtml(c.play.playId || '') + '" onclick="openPlayContext(this.dataset.tag,this.dataset.text,this.dataset.pid||null)">' +
        '<span class="gc-sys-e">' + _escapeHtml(c.emoji || '') + '</span><span><b>' + _escapeHtml(mine ? 'You' : (c.author || 'Someone')) + '</b> reacted to <b>' + _escapeHtml(c.play.tag || 'a play') + '</b> · ' + _escapeHtml(c.play.text || '') + '</span></button>';
    }
    var badges = _reactionBadgesHtml(c.reactions, true);
    var quote = c.replyTo ? (_gcIsPlayReply(c.replyTo) ? _gcPlayQuoteHtml(c.replyTo, mine) : _replyQuoteHtml(c.replyTo, mine)) : '';
    var photo = c.photo ? '<img class="gc-photo" src="' + c.photo + '" alt="Photo from ' + _escapeHtml(c.author || 'a friend') + '" data-src="' + (mine ? 'me' : 'them') + '" onclick="event.stopPropagation();openPhotoLightbox(this.src)">' : '';
    var lp = c.linkPreview && typeof _linkPreviewCardHtml === 'function' ? _linkPreviewCardHtml(c.linkPreview) : '';
    var linkOnly = !!(c.linkPreview && c.text && c.text.trim() === c.linkPreview.url);
    var textHtml = (c.text && !linkOnly) ? '<div class="b-txt">' + _renderMessageTextWithMentions(c.text, !!mine) + '</div>' : '';
    var time = '<div class="b-t">' + _fmtTime(c.ts) + (c.edited ? ' · Edited' : '') + '</div>';
    var bubbleInner = quote + (mine ? '' : '<div class="b-who">' + _escapeHtml(c.author) + '</div>') + photo + textHtml + time;
    var bubble = '<div class="bubble ' + (mine ? 'me' : 'them') + (photo ? ' gc-has-photo' : '') + '" onclick="_msgDoubleTap(this,\'gameChats\',\'' + c._id + '\',' + (mine ? 'true' : 'false') + ')" style="max-width:100%;cursor:pointer">' + bubbleInner + '</div>';
    if (mine) {
      return '<div class="msg" style="justify-content:flex-end"><div style="display:flex;flex-direction:column;align-items:flex-end;max-width:76%;min-width:0;gap:4px">' + lp + bubble + badges + '</div></div>';
    }
    return '<div class="msg"><div class="m-av av-b">' + _escapeHtml(_initials(c.author)) + '</div>' +
      '<div style="display:flex;flex-direction:column;align-items:flex-start;max-width:76%;min-width:0;gap:4px">' + lp + bubble + badges + '</div></div>';
  }).join('');
  var panel = document.getElementById('game-chat-panel');
  if (panel) panel.scrollTop = panel.scrollHeight;
}

// Posts a small "reacted to" line into the game's chat when someone
// reacts to a play (not when they take a reaction back).
function _gcPostPlayReaction(play, emoji) {
  var g = window._activeBrowseGame;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!g || !user || !window.db || !play) return;
  window.db.collection('gameChats').add({
    gamePk: g.gamePk, uid: user.uid, author: (window.userData && window.userData.name) || 'Someone',
    text: '', ts: Date.now(), system: true, systemType: 'play_reaction', emoji: emoji,
    play: { tag: play.tag || '', text: play.text || '', playId: play.playId || null }
  }).catch(function (err) { console.error('[gameChats:play_reaction] ' + (err && err.code), err); });
}

// ── Play context sheet ──
window._pctx = null;
function openPlayContext(tag, text, playId) {
  var ov = document.getElementById('pctx-overlay');
  var body = document.getElementById('pctx-body');
  if (!ov || !body) return;
  if (!playId) playId = _gcPlayIdFromRow(_gcPlayRow(text));
  window._pctx = { tag: tag, text: text, playId: playId };
  var found = _gcFindPlay(text, playId);
  var p = found.idx >= 0 ? found.list[found.idx] : null;
  var box = found.box;
  var chip = '';
  if (p && box && p.awayScore != null && p.homeScore != null) {
    var aA = box.awayAbbr || _ghAbbrFallback(box.away), hA = box.homeAbbr || _ghAbbrFallback(box.home);
    chip = _ghScoreChip(p, aA, hA);
  }
  var html = '<div class="pctx-hd"><span class="gh-tag" style="background:rgba(168,159,232,.18);color:#D9D4FA">' + _escapeHtml(tag || 'Play') + '</span>' +
    '<span class="gh-sub" style="flex:1">' + _escapeHtml(_pctxHalfLabel(tag, p, box)) + '</span>' + (chip ? '<span class="gh-num" style="font-size:14px">' + _escapeHtml(chip) + '</span>' : '') + '</div>' +
    '<div class="pctx-play">' + _escapeHtml(text || '') + '</div>';
  if (p && (p.outs != null || p.bases)) {
    var b = p.bases || {};
    var dia = function (on, x, y) { return '<rect x="' + x + '" y="' + y + '" width="10" height="10" transform="rotate(45 ' + (x + 5) + ' ' + (y + 5) + ')" fill="' + (on ? '#A89FE8' : 'none') + '" stroke="' + (on ? '#A89FE8' : '#9C95D0') + '" stroke-width="1.5"/>'; };
    var runners = [b.first ? '1st' : null, b.second ? '2nd' : null, b.third ? '3rd' : null].filter(Boolean);
    html += '<div class="gh-panel pctx-sit"><svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">' + dia(b.second, 17, 3) + dia(b.third, 4, 16) + dia(b.first, 30, 16) + '</svg>' +
      '<div style="display:flex;flex-direction:column;gap:2px"><span class="gh-eyebrow" style="font-size:9.5px">After the play</span><span style="font-size:13px;font-weight:700">' +
      _escapeHtml([p.outs != null ? p.outs + (p.outs === 1 ? ' out' : ' outs') : null, runners.length ? 'runner' + (runners.length > 1 ? 's' : '') + ' on ' + runners.join(' & ') : 'bases empty'].filter(Boolean).join(' · ')) + '</span></div></div>';
  }
  if (p && p.pitches && p.pitches.length) {
    html += '<div style="display:flex;flex-direction:column;gap:6px"><span class="gh-eyebrow">Pitch by pitch</span><div class="pctx-pitches">' + p.pitches.map(function (x) {
      var call = x.call || '';
      var tone = /ball/i.test(call) && !/foul/i.test(call) ? 'b' : (/foul/i.test(call) ? 'f' : (/in play/i.test(call) ? 'p' : 's'));
      return '<span class="pctx-pitch ' + tone + '">' + _escapeHtml([x.speed ? x.speed + ' mph' : null, x.type, call].filter(Boolean).join(' · ')) + '</span>';
    }).join('') + '</div></div>';
  }
  // Around this play: the game's own play list when it's loaded,
  // otherwise whatever the cheat sheet has on screen.
  var prev = null, next = null;
  if (p) { prev = found.list[found.idx - 1] ? found.list[found.idx - 1].text : null; next = found.list[found.idx + 1] ? found.list[found.idx + 1].text : null; }
  else {
    var row = _gcPlayRow(text);
    if (row) {
      var rows = Array.prototype.slice.call(document.querySelectorAll('#game-sheet-panel [data-rtext]'));
      var i = rows.indexOf(row);
      prev = rows[i - 1] ? rows[i - 1].getAttribute('data-rtext') : null;
      next = rows[i + 1] ? rows[i + 1].getAttribute('data-rtext') : null;
    }
  }
  if (prev || next) {
    html += '<div style="display:flex;flex-direction:column;gap:6px"><span class="gh-eyebrow">Around this play</span>' +
      (prev ? '<div class="pctx-near">' + _escapeHtml(prev) + '</div>' : '') +
      '<div class="pctx-near on">' + _escapeHtml(text || '') + '</div>' +
      (next ? '<div class="pctx-near">' + _escapeHtml(next) + '</div>' : '') + '</div>';
  }
  html += '<div id="pctx-reacts"></div>' +
    '<div class="pctx-actions"><button class="rb-btn" onclick="pctxOpenSheet()">' + (_pctxTarget(window._pctx) === 'plays' ? 'Open in plays' : 'Open in cheat sheet') + '</button><button class="rb-btn rb-btn-pri" onclick="pctxReply()">Reply</button></div>';
  body.innerHTML = html;
  ov.style.display = 'flex';
  if (playId && window.db) {
    window.db.collection('gamePlayReactions').doc(playId).get().then(function (doc) {
      var r = doc.exists ? ((doc.data() || {}).reactions || {}) : {};
      var el = document.getElementById('pctx-reacts');
      if (el && Object.keys(r).length && window._pctx && window._pctx.playId === playId) el.innerHTML = _reactionBadgesHtml(r, true);
    }).catch(function (err) { console.error('[pctx] reactions', err); });
  }
}
function _pctxHalfLabel(tag, p, box) {
  var m = String(tag || '').match(/^([TB])(\d+)$/);
  if (!m) return '';
  var top = m[1] === 'T';
  var team = box ? _teamShortName(top ? box.away : box.home) : '';
  return (top ? 'Top ' : 'Bottom ') + _ordinalSuffix(Number(m[2])) + (team ? ' · ' + team + ' batting' : '');
}
function closePlayContext() {
  var ov = document.getElementById('pctx-overlay');
  if (ov) ov.style.display = 'none';
}
function pctxReply() {
  var c = window._pctx;
  closePlayContext();
  if (c) _replyToPlay(c.tag, c.text);
}
// v7.17.2: the cheat sheet only carries the half-inning being played, so
// a play from an earlier half (or any play once the game's over) opens on
// the Plays tab instead — its half-inning opened, scrolled to and lit up.
function _pctxTarget(c) {
  if (!c || !(typeof _gdPlaysMlb === 'function' && _gdPlaysMlb())) return 'sheet';
  var box = _gcBox(), s = (box && box.situation) || {};
  var m = String(c.tag || '').match(/^([TB])(\d+)$/);
  var mdl = box && typeof _ghModelFromMlbBox === 'function' ? _ghModelFromMlbBox(box) : null;
  if (mdl && mdl.phase === 'live' && m && s.inning && Number(m[2]) === Number(s.inning) && (m[1] === 'T') === (s.half === 'top')) return 'sheet';
  return 'plays';
}
function _pctxRowIn(rootId, c) {
  var root = document.getElementById(rootId);
  if (!root || !c) return null;
  var rows = root.querySelectorAll('[data-rtext]'), byId = null;
  for (var i = 0; i < rows.length; i++) {
    if (c.text && rows[i].getAttribute('data-rtext') === c.text) return rows[i];
    if (!byId && c.playId && _gcPlayIdFromRow(rows[i]) === c.playId) byId = rows[i];
  }
  return byId;
}
function _pctxGo(where, c) {
  if (typeof gameDetailTab !== 'function') return null;
  gameDetailTab(where);
  return _pctxRowIn(where === 'plays' ? 'game-plays-panel' : 'game-sheet-panel', c);
}
function pctxOpenSheet() {
  var c = window._pctx;
  closePlayContext();
  if (!c) return;
  var first = _pctxTarget(c), other = first === 'plays' ? 'sheet' : (typeof _gdPlaysMlb === 'function' && _gdPlaysMlb() ? 'plays' : null);
  var where = first, row = _pctxGo(first, c);
  if (!row && other) { where = other; row = _pctxGo(other, c); }
  if (!row) { if (typeof ib_toast === 'function') ib_toast('Couldn\u2019t find that play in this game'); return; }
  // Open the collapsed inning / drive it lives in first.
  var wrap = row.closest('[id^="gh-inn-"],[id^="gx-drive-"]');
  if (wrap && wrap.style.display === 'none') {
    var key = wrap.id.replace(/^gh-inn-|^gx-drive-/, '');
    var btn = document.querySelector('[aria-controls="' + wrap.id + '"]');
    if (/^gh-inn-/.test(wrap.id) && btn && typeof ghInningToggle === 'function') ghInningToggle(key, btn);
    else {
      wrap.style.display = 'flex';
      if (/^gh-inn-/.test(wrap.id)) { window._ghInningOpen = window._ghInningOpen || {}; window._ghInningOpen[key] = true; }
      else { window._gxDriveOpen = window._gxDriveOpen || {}; window._gxDriveOpen[key] = true; }
    }
  }
  setTimeout(function () { _pctxFlash(where === 'plays' ? 'game-plays-panel' : 'game-sheet-panel', c); }, 80);
}
// Scrolls to the play and lights it up. The list can redraw underneath
// (a live tick, Savant numbers arriving), so the highlight follows the row
// onto its redrawn copy for as long as it lasts.
function _pctxFlash(panelId, c) {
  var panel = document.getElementById(panelId);
  var row = _pctxRowIn(panelId, c);
  if (!panel || !row) return;
  // scroll just this panel — scrollIntoView also scrolls the screen itself
  var pr = panel.getBoundingClientRect(), rr = row.getBoundingClientRect();
  var to = Math.max(0, panel.scrollTop + (rr.top - pr.top) - Math.max(0, (panel.clientHeight - rr.height) / 2));
  try { panel.scrollTo({ top: to, behavior: 'smooth' }); } catch (e) { panel.scrollTop = to; }
  row.classList.add('gc-flash');
  var until = Date.now() + 1800, mo = null;
  if (window.MutationObserver) {
    mo = new MutationObserver(function () {
      if (Date.now() > until) return;
      var r = _pctxRowIn(panelId, c);
      if (r && !r.classList.contains('gc-flash')) r.classList.add('gc-flash');
    });
    mo.observe(panel, { childList: true, subtree: true });
  }
  setTimeout(function () {
    if (mo) mo.disconnect();
    var r = _pctxRowIn(panelId, c);
    if (r) r.classList.remove('gc-flash');
  }, 1850);
}
