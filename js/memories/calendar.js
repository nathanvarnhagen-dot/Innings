// ── CALENDAR ──
function _formatCalDate(s) {
  if (!s) return '';
  var p = String(s).split('-');
  if (p.length !== 3) return s;
  var d = new Date(parseInt(p[0],10), parseInt(p[1],10)-1, parseInt(p[2],10));
  var days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate();
}

function renderCalendar() {
  var moments = window._moments || [];
  var thisYear = moments.filter(function(m){ return (m.date || '').slice(0,4) === '2026'; });
  var social = moments.filter(function(m){ return (m.people || []).length > 0; });
  var mEl = document.getElementById('cal-moments'); if (mEl) mEl.textContent = moments.length;
  var yEl = document.getElementById('cal-year'); if (yEl) yEl.textContent = thisYear.length;
  var sEl = document.getElementById('cal-streak'); if (sEl) sEl.textContent = computeWeeklyStreak(social);

  var content = document.getElementById('cal-content');
  var empty = document.getElementById('cal-empty');
  if (!content) return;

  var html = '';
  var rsvp = (window.userData && window.userData.oslRsvp) || '';

  // Upcoming events (Outside Lands if RSVP'd going/maybe, and not already
  // over — once it's concluded this stops duplicating the "Upcoming" card;
  // it still shows up on its own dates via the per-day synthesis below)
  if ((rsvp === 'going' || rsvp === 'maybe') && !_oslHasConcluded()) {
    var badge = '<span onclick="previewOslDayReveal(event)" style="background:rgba(168,159,232,0.95);color:#0D0820;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;cursor:pointer">PREVIEW</span>';
    html += '<div class="sec-title">Upcoming</div>' +
      '<div onclick="nav(\'osl-group\')" style="background:linear-gradient(135deg,#1A0A2E,#3D1A6B);border-radius:18px;padding:16px;display:flex;align-items:center;gap:14px;cursor:pointer;margin-bottom:18px">' +
        '<div style="width:52px;flex-shrink:0;text-align:center">' +
          '<div style="font-size:10px;font-weight:700;color:rgba(168,159,232,0.9);text-transform:uppercase;letter-spacing:0.06em">Aug</div>' +
          '<div style="font-size:24px;font-weight:900;color:white;line-height:1.1">7–9</div>' +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:15px;font-weight:700;color:white">Outside Lands 2026</div>' +
          '<div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:2px">Fri–Sun · Golden Gate Park</div>' +
        '</div>' + badge +
      '</div>';
  }

  // Month calendar grid — replaces the old flat list with an actual calendar
  var momentsByDate = {};
  moments.forEach(function(m){
    if (!m.date) return;
    (momentsByDate[m.date] = momentsByDate[m.date] || []).push(m);
  });

  // Future/planned moments (RSVP'd plans) show up on their date too, tagged _future
  var futureCache = window._futureMomentsCache || {};
  Object.keys(futureCache).forEach(function(id){
    var m = futureCache[id];
    if (!m.date) return;
    (momentsByDate[m.date] = momentsByDate[m.date] || []).push(Object.assign({}, m, { _id: id, _future: true }));
  });

  // Outside Lands isn't a "moment" record — it's an RSVP flag — so synthesize
  // entries for its three dates when the user is going/maybe, tagged _osl
  if (rsvp === 'going' || rsvp === 'maybe') {
    ['2026-08-07','2026-08-08','2026-08-09'].forEach(function(d){
      (momentsByDate[d] = momentsByDate[d] || []).push({ _osl: true, date: d });
    });
  }

  // Games marked Watching, on whichever date they were actually played
  var watchedCache = window._watchedGamesCache || {};
  Object.keys(watchedCache).forEach(function(id){
    var g = watchedCache[id];
    if (!g.date) return;
    (momentsByDate[g.date] = momentsByDate[g.date] || []).push(Object.assign({}, g, { _id: id, _watchedGame: true }));
  });

  if (window._calYear == null) {
    var today0 = new Date();
    window._calYear = today0.getFullYear();
    window._calMonth = today0.getMonth();
  }

  html += _calRenderMonth(window._calYear, window._calMonth, momentsByDate);
  html += _calRenderDayDetail(momentsByDate);
  // Whatever vertical space is left over after the grid and day panel just
  // sat there as a flat, empty rectangle — on the old light background
  // that read as normal whitespace, but on the new dark one it reads as
  // broken. This absorbs the leftover space instead of leaving it bare.
  html += '<div style="flex:1;min-height:24px;position:relative;overflow:hidden">' +
    '<span class="osl-light" style="left:12%;top:20%;animation-delay:0.3s"></span>' +
    '<span class="osl-light" style="left:82%;top:35%;animation-delay:1.9s"></span>' +
    '<span class="osl-light" style="left:45%;top:65%;animation-delay:1.1s"></span>' +
    '<span class="osl-light" style="left:68%;top:15%;animation-delay:2.6s"></span>' +
  '</div>';

  var hasContent = true;
  content.innerHTML = html;
  content.style.display = 'flex';
  if (empty) empty.style.display = 'none';
}

// ── CALENDAR GRID ──
window._calYear = null;
window._calMonth = null;
window._calSelectedDate = null;
var CAL_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var CAL_WEEKDAY_LABELS = ['S','M','T','W','T','F','S'];

function _calGoToMonth(delta) {
  var d = new Date(window._calYear, window._calMonth + delta, 1);
  window._calYear = d.getFullYear();
  window._calMonth = d.getMonth();
  window._calSelectedDate = null;
  renderCalendar();
}

function _calSelectDay(dateStr) {
  window._calSelectedDate = (window._calSelectedDate === dateStr) ? null : dateStr;
  renderCalendar();
}

function _calCreateForDate(dateStr) {
  var d = document.getElementById('moment-date');
  if (d) d.value = dateStr;
  nav('create-group');
}

function _calRenderMonth(year, month, momentsByDate) {
  var pad = function(n){ return n < 10 ? '0' + n : '' + n; };
  var daysInMonth = new Date(year, month + 1, 0).getDate();
  var firstWeekday = new Date(year, month, 1).getDay();
  var todayStr = _todayLocal();

  var cells = '';
  for (var i = 0; i < firstWeekday; i++) cells += '<div></div>';
  for (var day = 1; day <= daysInMonth; day++) {
    var dateStr = year + '-' + pad(month + 1) + '-' + pad(day);
    var dayMoments = momentsByDate[dateStr] || [];
    var isToday = dateStr === todayStr;
    var isSelected = dateStr === window._calSelectedDate;
    var bg = isSelected ? '#A89FE8' : 'transparent';
    var textColor = isSelected ? '#0D0820' : 'rgba(255,255,255,0.85)';
    var ring = (isToday && !isSelected) ? 'box-shadow:inset 0 0 0 1.5px #A89FE8;' : '';
    var hasPast = dayMoments.some(function(m){ return !m._future && !m._osl; });
    var hasUpcoming = dayMoments.some(function(m){ return m._future || m._osl; });
    var dotColor = isSelected ? '#0D0820' : '#A89FE8';
    var dot;
    if (hasPast) {
      dot = '<div style="width:5px;height:5px;border-radius:50%;background:' + dotColor + ';margin-top:2px"></div>';
    } else if (hasUpcoming) {
      dot = '<div style="width:5px;height:5px;border-radius:50%;border:1px solid ' + dotColor + ';margin-top:2px"></div>';
    } else {
      dot = '<div style="height:5px;margin-top:2px"></div>';
    }
    cells += '<div onclick="_calSelectDay(\'' + dateStr + '\')" style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;cursor:pointer;background:' + bg + ';' + ring + '">' +
      '<div style="font-size:13px;font-weight:' + (isToday ? '800' : '600') + ';color:' + textColor + '">' + day + '</div>' + dot +
    '</div>';
  }
  var totalCells = firstWeekday + daysInMonth;
  var trailing = (7 - (totalCells % 7)) % 7;
  for (var j = 0; j < trailing; j++) cells += '<div></div>';

  return '<div style="margin-bottom:16px">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<button onclick="_calGoToMonth(-1)" style="background:rgba(255,255,255,0.08);border:0.5px solid rgba(255,255,255,0.12);width:32px;height:32px;border-radius:10px;cursor:pointer;font-size:14px;color:rgba(255,255,255,0.6);font-family:inherit">‹</button>' +
      '<div style="font-size:15px;font-weight:700;color:#fff">' + CAL_MONTH_NAMES[month] + ' ' + year + '</div>' +
      '<button onclick="_calGoToMonth(1)" style="background:rgba(255,255,255,0.08);border:0.5px solid rgba(255,255,255,0.12);width:32px;height:32px;border-radius:10px;cursor:pointer;font-size:14px;color:rgba(255,255,255,0.6);font-family:inherit">›</button>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">' +
      CAL_WEEKDAY_LABELS.map(function(l){ return '<div style="text-align:center;font-size:10px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.04em">' + l + '</div>'; }).join('') +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">' + cells + '</div>' +
  '</div>';
}

function _calRenderDayDetail(momentsByDate) {
  var selected = window._calSelectedDate;

  if (!selected) {
    return '<div style="text-align:center;padding:20px 0;font-size:13px;color:rgba(255,255,255,0.4)">Tap a day to see what happened</div>';
  }

  var dayMoments = momentsByDate[selected] || [];
  var header = '<div class="sec-title">' + _formatCalDate(selected) + '</div>';

  if (!dayMoments.length) {
    return header + '<div style="text-align:center;padding:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px">' +
      '<div style="font-size:13px;color:rgba(255,255,255,0.42);margin-bottom:10px">Nothing saved for this day yet</div>' +
      '<button onclick="_calCreateForDate(\'' + selected + '\')" style="background:rgba(168,159,232,0.16);color:#A89FE8;border:none;border-radius:20px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ Add a moment</button>' +
    '</div>';
  }

  return header + '<div style="display:flex;flex-direction:column;gap:8px">' +
    dayMoments.map(function(m){
      if (m._osl) {
        return '<div onclick="nav(\'osl-group\')" style="background:linear-gradient(135deg,#1A0A2E,#3D1A6B);border-radius:16px;padding:14px;display:flex;align-items:center;gap:12px;cursor:pointer">' +
          '<div style="width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🎪</div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:white">Outside Lands 2026</div>' +
          '<div style="font-size:12px;color:rgba(255,255,255,0.55);margin-top:1px">Golden Gate Park</div></div>' +
        '</div>';
      }
      if (m._future) {
        var futureEmoji = (m.vibe || '📅').trim().split(' ')[0];
        return '<div onclick="openFutureDetail(\'' + m._id + '\')" style="background:rgba(255,255,255,0.055);border:1px solid rgba(255,255,255,0.09);border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:12px;cursor:pointer">' +
          '<div style="width:40px;height:40px;border-radius:12px;background:rgba(168,159,232,0.15);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">' + _escapeHtml(futureEmoji) + '</div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#fff">' + _escapeHtml(m.title || 'Untitled plan') + '</div>' +
          '<div style="font-size:11px;font-weight:700;color:#A89FE8;margin-top:1px;text-transform:uppercase;letter-spacing:0.04em">Upcoming</div></div>' +
        '</div>';
      }
      if (m._watchedGame) {
        var sportEmoji = { mlb: '⚾', nfl: '🏈', cfb: '🏈', nba: '🏀', wnba: '🏀', nhl: '🏒', mls: '⚽', nwsl: '⚽' }[m.sport] || '🏆';
        return '<div data-gamepk="' + _escapeHtml(String(m.gamePk)) + '" data-away="' + _escapeHtml(m.away || '') + '" data-home="' + _escapeHtml(m.home || '') + '" data-sport="' + _escapeHtml(m.sport || 'mlb') + '" data-date="' + _escapeHtml(m.date || '') + '" onclick="openGameScreen(this.dataset.gamepk,this.dataset.away,this.dataset.home,this.dataset.sport,this.dataset.date)" style="background:rgba(255,255,255,0.055);border:1px solid rgba(255,255,255,0.09);border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:12px;cursor:pointer">' +
          '<div style="width:40px;height:40px;border-radius:12px;background:rgba(168,159,232,0.15);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">' + sportEmoji + '</div>' +
          '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml((m.away || '?') + ' @ ' + (m.home || '?')) + '</div>' +
          '<div style="font-size:11px;font-weight:700;color:#A89FE8;margin-top:1px;text-transform:uppercase;letter-spacing:0.04em">Watched · tap for chat</div></div>' +
        '</div>';
      }
      var emoji = (m.vibe || '✨').trim().split(' ')[0];
      return '<div onclick="openMemory(\'' + m._id + '\')" style="background:rgba(255,255,255,0.055);border:1px solid rgba(255,255,255,0.09);border-radius:16px;padding:12px 14px;display:flex;align-items:center;gap:12px;cursor:pointer">' +
        '<div style="width:40px;height:40px;border-radius:12px;background:rgba(168,159,232,0.15);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">' + _escapeHtml(emoji) + '</div>' +
        '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:#fff">' + _escapeHtml(m.name || 'Untitled moment') + '</div></div>' +
      '</div>';
    }).join('') +
  '</div>';
}

// ── OUTSIDE LANDS GROUP CHAT (shared across everyone) ──
window._oslChatStarted = false;
function startOslChat() {
  if (window._oslChatStarted) return;
  if (!window.db) return;
  window._oslChatStarted = true;
  window.db.collection('oslChat').orderBy('ts').limit(300).onSnapshot(function(snap){
    var msgs = [];
    snap.forEach(function(doc){ msgs.push(Object.assign({ _id: doc.id }, doc.data())); });
    renderOslChat(msgs);
  }, function(err){
    console.error('OSL chat error:', err);
    window._oslChatStarted = false;
    if (typeof ib_toast==='function') ib_toast('Chat unavailable — check Firestore rules');
  });
}
