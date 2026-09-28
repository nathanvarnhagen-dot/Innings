// ═══ PLAN BUILDER (v7.0.0) ═══════════════════════════════════════════════
// "It's coming up" as a builder: pick a start (or a blank page), keep only
// the blocks the plan needs, add any other block at any point, rename any
// block ("Guest list" → "The crew"), style it, send it. Saves a normal
// futureMoments doc (title/date/time/location/theme/stops/taggedUids/rsvps —
// so the existing plan screen, RSVPs, chat and edit keep working) plus a
// `pb` object with everything new. Casual hang is its own short version.
var PB_BLOCKS = {
  when:    { e: '\ud83d\udcc5', n: 'Date & time', d: 'Set it, or let people vote' },
  where:   { e: '\ud83d\udccd', n: 'Place', d: 'An address, \u201cmy place,\u201d or TBD' },
  stops:   { e: '\ud83d\uddfa\ufe0f', n: 'Stops', d: 'More than one place, in order' },
  games:   { e: '\ud83c\udfdf\ufe0f', n: 'Games', d: 'Any sport \u2014 at the game, a bar, someone\u2019s place' },
  crew:    { e: '\ud83d\udc65', n: 'Guest list', d: 'Who\u2019s invited, plus-ones, a cap' },
  potluck: { e: '\ud83e\udd58', n: 'Potluck sign-up', d: 'Dishes people claim' },
  bring:   { e: '\ud83e\uddfa', n: 'Bring list', d: 'Anything else to cover' },
  poll:    { e: '\ud83d\uddf3\ufe0f', n: 'Poll', d: 'Ask the group anything' },
  run:     { e: '\u23f1\ufe0f', n: 'Run of show', d: 'Times for the night' },
  cost:    { e: '\ud83d\udcb8', n: 'Split the cost', d: 'Who owes what' },
  rides:   { e: '\ud83d\ude97', n: 'Rides', d: 'Who\u2019s driving, open seats' },
  dress:   { e: '\ud83d\udc54', n: 'Dress code & vibe', d: 'Cozy, costume, team colors\u2026' },
  music:   { e: '\ud83c\udfb5', n: 'Playlist', d: 'A shared playlist link' },
  tickets: { e: '\ud83c\udf9f\ufe0f', n: 'Tickets', d: 'A link to buy or where they are' },
  note:    { e: '\ud83d\udcdd', n: 'Note to guests', d: 'Parking, buzzer, allergies' },
  memory:  { e: '\ud83d\udcf8', n: 'Shared album after', d: 'Becomes a memory when it\u2019s over' }
};
var PB_TPL = {
  hang:   { e: '\ud83d\udecb\ufe0f', n: 'Casual hang', d: 'Three taps, add more if you want', bg: 'linear-gradient(150deg,#2E2366,#1A1640)' },
  game:   { e: '\ud83c\udfdf\ufe0f', n: 'Going to a game', d: 'Any sport \u00b7 seats, meet-up, rides', bg: 'linear-gradient(160deg,#FD5A1E,#27251F)', kick: 'GAME DAY', blocks: ['games', 'when', 'stops', 'crew', 'tickets', 'rides', 'cost', 'memory'], look: { cover: 0, font: 'classic', acc: '#FD8A4E', fx: 'glow', emo: '\ud83c\udfdf\ufe0f' }, gameWhere: 'going' },
  watch:  { e: '\ud83d\udcfa', n: 'Watch party', d: 'Games on, snacks assigned', bg: 'linear-gradient(160deg,#3A2A7A,#1A1238)', kick: 'WATCH PARTY', blocks: ['games', 'when', 'where', 'crew', 'bring', 'poll', 'memory'], look: { cover: 4, font: 'classic', acc: '#F2C869', fx: 'glow', emo: '\ud83d\udcfa' }, gameWhere: 'house' },
  night:  { e: '\ud83c\udf78', n: 'Night out', d: 'Several stops, a game at the bar', bg: 'linear-gradient(160deg,#3D3580,#12091F)', kick: 'NIGHT OUT', blocks: ['when', 'stops', 'games', 'crew', 'dress', 'cost', 'memory'], look: { cover: 4, font: 'classic', acc: '#A89FE8', fx: 'stars', emo: '\ud83c\udf19' }, gameWhere: 'bar' },
  dinner: { e: '\ud83c\udf7d\ufe0f', n: 'Dinner party', d: 'Potluck, seats, a vibe', bg: 'linear-gradient(160deg,#5A2A1A,#2A1410 60%,#140A08)', kick: 'DINNER PARTY', blocks: ['when', 'where', 'crew', 'potluck', 'dress', 'note', 'memory'], look: { cover: 1, font: 'serif', acc: '#F2C869', fx: 'candles', emo: '\ud83d\udd6f\ufe0f' } },
  bday:   { e: '\ud83c\udf82', n: 'Birthday', d: 'Plans, gifts, a surprise?', bg: 'linear-gradient(160deg,#B8488A,#4A1E5A)', kick: 'BIRTHDAY', blocks: ['when', 'where', 'crew', 'poll', 'cost', 'dress', 'memory'], look: { cover: 3, font: 'script', acc: '#FFB8E0', fx: 'confetti', emo: '\ud83e\udd73' } },
  trip:   { e: '\ud83c\udfd5\ufe0f', n: 'Trip', d: 'Dates, stops, rides, costs', bg: 'linear-gradient(160deg,#1E6F6A,#0E2E3A)', kick: 'TRIP', blocks: ['when', 'stops', 'crew', 'run', 'rides', 'cost', 'bring', 'memory'], look: { cover: 2, font: 'mono', acc: '#7CF2E8', fx: 'stars', emo: '\ud83c\udfd4\ufe0f' } },
  blank:  { e: '\u2728', n: 'Start from scratch', d: 'A title \u2014 then add anything', bg: 'linear-gradient(160deg,#241C4E,#15103A)', kick: 'PLAN', blocks: ['when', 'where', 'crew'], look: { cover: 4, font: 'classic', acc: '#A89FE8', fx: 'none', emo: '\u2728' }, gameWhere: 'house' }
};
var PB_COVERS = ['linear-gradient(160deg,#FD5A1E,#27251F)', 'linear-gradient(160deg,#6B3218,#2A1410 55%,#120806)', 'linear-gradient(160deg,#1E6F6A,#0E2E3A 70%)', 'linear-gradient(160deg,#C4589C,#4A1E5A 70%)', 'linear-gradient(160deg,#3D3580,#12091F 70%)', 'linear-gradient(160deg,#F2C869,#8A5A12 70%)', 'linear-gradient(160deg,#5AB0FF,#12284B 70%)', 'linear-gradient(160deg,#2F7A4B,#0E2A1A 70%)'];
var PB_ACCS = ['#F2C869', '#A89FE8', '#FD8A4E', '#7CF2E8', '#FFB8E0', '#7CF29C', '#5AB0FF', '#FFFFFF'];
var PB_EMOS = ['\u2728', '\ud83c\udfdf\ufe0f', '\u26be', '\ud83c\udfc8', '\ud83c\udfc0', '\ud83c\udfd2', '\u26bd', '\ud83d\udcfa', '\ud83c\udf7b', '\ud83c\udf78', '\ud83c\udf7d\ufe0f', '\ud83d\udd6f\ufe0f', '\ud83c\udf55', '\ud83e\udd73', '\ud83c\udf19', '\ud83c\udfd4\ufe0f', '\ud83c\udfb6', '\ud83c\udf83'];
var PB_WHERE = { going: '\ud83c\udfdf\ufe0f At the game', bar: '\ud83c\udf7a At a bar', house: '\ud83c\udfe0 At someone\u2019s place' };
var PB_STOPKIND = [['bar', '\ud83c\udf7a', 'Bar'], ['food', '\ud83c\udf7d\ufe0f', 'Food'], ['house', '\ud83c\udfe0', 'Someone\u2019s place'], ['stadium', '\ud83c\udfdf\ufe0f', 'The game'], ['other', '\ud83d\udccd', 'Other']];
window.PB = null;

function _pbUid() { var u = window.currentUser || (window.auth && window.auth.currentUser); return u ? u.uid : null; }
function _pbId(p) { return (p || 'x') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function _pbToday(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function _pbNice(date, time) {
  if (!date) return 'Pick a date';
  var d = new Date(date + 'T' + (time || '12:00'));
  var s = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  if (time) s += ' \u00b7 ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return s;
}
function _pbT(k) { return (PB.blockTitles && PB.blockTitles[k]) || PB_BLOCKS[k].n; }
function _pbAv(name, i) { var cols = ['#E86A9A', '#5AB0FF', '#F2A65A', '#48C98A', '#B892FF', '#8C82E0', '#FF8A7A']; return '<span class="pb-av" style="background:' + cols[(i || 0) % cols.length] + '">' + _escapeHtml(String(name || '?').slice(0, 1).toUpperCase()) + '</span>'; }

function _pbBlank(tplKey) {
  var t = PB_TPL[tplKey] || PB_TPL.blank;
  return {
    mode: 'new', id: null, tpl: tplKey, screen: 'build', sheet: null,
    title: '', kick: t.kick || 'PLAN', date: '', time: '', whenMode: 'set', whenOptions: [],
    blocks: (t.blocks || []).slice(), blockTitles: {},
    look: Object.assign({ cover: 4, font: 'classic', acc: '#A89FE8', fx: 'none', emo: '\u2728' }, t.look || {}),
    location: '', stops: [], games: [], potluck: [], allergies: true, bring: [], polls: [], run: [],
    cost: { total: '', mode: 'even', note: '' }, rides: [], dress: [], dressNote: '', playlist: '', note: '', ticketLink: '',
    crew: [], plusOnes: true, cap: '', showGuests: true, isPublic: false, memoryAfter: true,
    hang: false, hangWhen: 'Tonight', pickSport: 'mlb', pickDate: '', pickFor: null
  };
}
function _pbSeed(k) {
  // starting content for each template, all editable
  if (k === 'dinner') {
    PB.potluck = [['\ud83e\udd57', 'Salad', 2], ['\ud83c\udf5e', 'Bread', 1], ['\ud83e\udd67', 'Dessert', 2], ['\ud83c\udf77', 'Wine', 3]].map(function (x) { return { id: _pbId('p'), e: x[0], n: x[1], need: x[2], by: [] }; });
    PB.dress = ['Cozy'];
  }
  if (k === 'watch') { PB.bring = ['Ice', 'Chips & salsa', 'Something to drink'].map(function (n) { return { id: _pbId('b'), n: n, by: null }; }); PB.polls = [{ id: _pbId('q'), q: 'Food: what\u2019s the move?', opts: ['Wings', 'Tacos', 'Pizza'], votes: {} }]; }
  if (k === 'bday') { PB.polls = [{ id: _pbId('q'), q: 'Where should we go?', opts: ['', '', ''], votes: {} }]; PB.dress = ['Dress up']; }
  if (k === 'night') { PB.stops = [_pbStop('food'), _pbStop('bar'), _pbStop('bar')]; PB.dress = ['Dress up']; }
  if (k === 'game') { PB.stops = [_pbStop('bar'), _pbStop('stadium')]; PB.stops[0].name = 'Pregame'; PB.stops[1].name = 'The game'; }
  if (k === 'trip') { PB.stops = [_pbStop('other'), _pbStop('house')]; }
}
function _pbStop(kind) {
  var k = PB_STOPKIND.filter(function (x) { return x[0] === kind; })[0] || PB_STOPKIND[4];
  // same shape the existing stops editor and plan screen use
  return { id: _newStopId ? _newStopId() : _pbId('stop'), type: kind === 'stadium' ? 'game' : 'custom', kind: kind, emoji: k[1], name: '', time: '', location: '', coverPhoto: '', anim: 'twinkle', game: null };
}

// ── open / close ──
function pbOpen(existingId) {
  var root = document.getElementById('pb-root');
  if (!root) { root = document.createElement('div'); root.id = 'pb-root'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Plan something'); document.body.appendChild(root); }
  if (existingId) {
    var m = typeof _findFutureMoment === 'function' ? _findFutureMoment(existingId) : null;
    if (!m) return;
    PB = _pbFromDoc(m);
  } else {
    PB = _pbBlank('blank'); PB.screen = 'tpl';
  }
  root.classList.add('on');
  _pbRender();
  if (typeof _ensureMyFriendsLoaded === 'function') _ensureMyFriendsLoaded(function () { if (PB && (PB.sheet === 'crew' || PB.screen === 'hang')) _pbRender(); });
}
function pbClose() { var r = document.getElementById('pb-root'); if (r) r.classList.remove('on'); PB = null; }
function pbUseTpl(k) {
  var keepTitle = PB && PB.title;
  PB = _pbBlank(k);
  if (k === 'hang') { PB.hang = true; PB.screen = 'hang'; PB.blocks = []; PB.kick = 'HANGING OUT'; }
  else _pbSeed(k);
  if (keepTitle) PB.title = keepTitle;
  _pbRender();
}

// ── the invite card preview ──
function _pbFx(fx) {
  var i, h = '';
  if (fx === 'candles') { [8, 38, 70].forEach(function (x, j) { h += '<i style="left:' + x + '%;animation-delay:' + (-j * .7) + 's"></i>'; }); return '<div class="pb-fx candles">' + h + '</div>'; }
  if (fx === 'stars') { for (i = 0; i < 26; i++) h += '<i style="left:' + ((i * 37) % 100) + '%;top:' + ((i * 53) % 70) + '%;animation-delay:' + (-(i % 7) * .4) + 's"></i>'; return '<div class="pb-fx stars">' + h + '</div>'; }
  if (fx === 'confetti') { for (i = 0; i < 18; i++) h += '<i style="left:' + ((i * 37) % 100) + '%;background:' + ['#FFB8E0', '#F2C869', '#A89FE8', '#7CF2E8'][i % 4] + ';animation-delay:' + (-(i * .4)) + 's"></i>'; return '<div class="pb-fx confetti">' + h + '</div>'; }
  if (fx === 'glow') return '<div class="pb-fx glow"></div>';
  return '';
}
function _pbBg() {
  var L = PB.look, g = PB.games[0];
  if (PB.tpl === 'game' && g && L.cover === 0 && g.hc) return 'linear-gradient(150deg,' + g.hc + ' 0%,' + g.hc + ' 35%,#141218 70%,' + (g.ac || '#27251F') + ' 130%)';
  return PB_COVERS[L.cover] || PB_COVERS[4];
}
function _pbWhereLine() {
  if (PB.blocks.indexOf('stops') !== -1 && PB.stops.length > 1) return PB.stops.length + ' stops \u00b7 ' + (PB.stops[0].name || 'Stop 1') + ' \u2192 ' + (PB.stops[PB.stops.length - 1].name || 'Stop ' + PB.stops.length);
  if (PB.blocks.indexOf('stops') !== -1 && PB.stops.length === 1) return PB.stops[0].name || PB.stops[0].location || '';
  return PB.location || '';
}
function _pbPreview(editable) {
  var L = PB.look;
  var whenLine = PB.whenMode === 'vote' ? 'Vote on the day' : PB.whenMode === 'flex' ? 'Flexible \u2014 sometime soon' : _pbNice(PB.date, PB.time);
  var gm = PB.blocks.indexOf('games') !== -1 && PB.games.length ? PB.games : [];
  return '<div class="pb-pv pbf-' + L.font + '" style="background:' + _pbBg() + ';--pbacc:' + L.acc + '">' + _pbFx(L.fx) + '<span class="emo">' + L.emo + '</span>' +
    (editable ? '<button class="sty" onclick="pbGo(\'look\')">\u270e Style</button>' : '') +
    '<div class="kick">' + _escapeHtml(PB.kick || '') + '</div><div class="title">' + _escapeHtml(PB.title || 'Untitled plan') + '</div>' +
    '<div class="meta">' + _escapeHtml(whenLine) + '</div>' + (_pbWhereLine() ? '<div class="meta" style="opacity:.75">' + _escapeHtml(_pbWhereLine()) + '</div>' : '') +
    (gm.length ? '<div class="pvg">' + _escapeHtml(gm.length > 1 ? gm.length + ' games' : gm[0].a + ' @ ' + gm[0].h) + ' \u00b7 ' + _escapeHtml((PB_WHERE[gm[0].where] || '').replace(/^\S+\s/, '')) + '</div>' : '') + '</div>';
}

// ── block editors ──
function _pbHead(k, i) {
  var b = PB_BLOCKS[k];
  return '<div class="pb-bh"><span class="ic">' + b.e + '</span><span class="tt"><input value="' + _escapeHtml(_pbT(k)) + '" aria-label="Block title" oninput="PB.blockTitles[\'' + k + '\']=this.value"><small>' + b.d + ' \u00b7 tap the name to rename</small></span>' +
    '<span class="ctl"><button onclick="pbMove(' + i + ',-1)" aria-label="Move up">\u2191</button><button onclick="pbMove(' + i + ',1)" aria-label="Move down">\u2193</button><button onclick="pbRm(\'' + k + '\')" aria-label="Remove ' + _escapeHtml(_pbT(k)) + '">\u2715</button></span></div>';
}
function _pbGameCard(g) {
  var lc = function (ab, col) { return '<span class="l" style="background:' + (col || '#3D3580') + '">' + _escapeHtml(ab || '?') + '</span>'; };
  return '<span class="pb-gm">' + lc(g.a, g.ac) + '<span class="at">@</span>' + lc(g.h, g.hc) + '<span class="t"><b>' + _escapeHtml((g.emoji || '') + ' ' + g.away + ' @ ' + g.home) + '</b><small>' + _escapeHtml([g.timeLabel, g.lgName].filter(Boolean).join(' \u00b7 ')) + '</small></span></span>';
}
function _pbStopOpts(sel) {
  return '<option value="">Not tied to a stop</option>' + PB.stops.map(function (s, i) { return '<option value="' + s.id + '"' + (sel === s.id ? ' selected' : '') + '>Stop ' + (i + 1) + (s.name ? ' \u00b7 ' + _escapeHtml(s.name) : '') + '</option>'; }).join('');
}
function _pbBody(k) {
  var P = PB, h = '';
  if (k === 'when') {
    h += '<div class="pb-seg" style="grid-template-columns:repeat(3,1fr)">' + [['set', 'Set a time'], ['vote', 'Let them vote'], ['flex', 'Flexible']].map(function (x) { return '<button class="' + (P.whenMode === x[0] ? 'on' : '') + '" onclick="PB.whenMode=\'' + x[0] + '\';_pbRender()">' + x[1] + '</button>'; }).join('') + '</div>';
    if (P.whenMode === 'set') h += '<div class="pb-row"><label class="pb-in"><span class="lab">DATE</span><input type="date" value="' + P.date + '" onchange="PB.date=this.value;_pbRender()"></label><label class="pb-in" style="max-width:150px"><span class="lab">TIME</span><input type="time" value="' + P.time + '" onchange="PB.time=this.value;_pbRender()"></label></div>';
    if (P.whenMode === 'vote') { h += P.whenOptions.map(function (o, i) { return '<div class="pb-row"><label class="pb-in"><input type="date" value="' + o.date + '" onchange="PB.whenOptions[' + i + '].date=this.value"></label><label class="pb-in" style="max-width:130px"><input type="time" value="' + o.time + '" onchange="PB.whenOptions[' + i + '].time=this.value"></label><button class="pb-x" onclick="PB.whenOptions.splice(' + i + ',1);_pbRender()" aria-label="Remove option">\u2715</button></div>'; }).join('') + (P.whenOptions.length < 5 ? '<button class="pb-dash" onclick="PB.whenOptions.push({date:\'\',time:\'\'});_pbRender()">\uff0b Add a day to vote on</button>' : ''); }
    if (P.whenMode === 'flex') h += '<div class="pb-chips">' + ['This week', 'This weekend', 'Next week', 'Sometime soon'].map(function (x) { return '<button class="pb-chip' + (P.flexWhen === x ? ' on' : '') + '" onclick="PB.flexWhen=\'' + x + '\';_pbRender()">' + x + '</button>'; }).join('') + '</div>';
  }
  if (k === 'where') h += '<label class="pb-in">\ud83d\udccd<input value="' + _escapeHtml(P.location) + '" placeholder="An address, a place, or \u201cmy place\u201d" oninput="PB.location=this.value"></label><div class="pb-chips"><button class="pb-chip" onclick="PB.location=\'My place\';_pbRender()">\ud83c\udfe0 My place</button><button class="pb-chip" onclick="PB.location=\'TBD\';_pbRender()">\u2753 Decide later</button></div>';
  if (k === 'stops') {
    h += _pbRoute(P.stops.length);
    h += P.stops.map(function (s, i) {
      return '<div class="pb-stop"><div class="pb-row"><span class="n">' + (i + 1) + '</span><input style="flex:1;min-width:0;background:transparent;border:0;outline:none;font-size:14.5px;font-weight:800;color:#fff" value="' + _escapeHtml(s.name) + '" placeholder="Name this stop" oninput="PB.stops[' + i + '].name=this.value" aria-label="Stop name">' +
        '<button class="pb-x" onclick="pbStopMove(' + i + ',-1)" aria-label="Move up">\u2191</button><button class="pb-x" onclick="pbStopMove(' + i + ',1)" aria-label="Move down">\u2193</button><button class="pb-x" onclick="PB.stops.splice(' + i + ',1);_pbRender()" aria-label="Remove stop">\u2715</button></div>' +
        '<div class="pb-chips">' + PB_STOPKIND.map(function (x) { return '<button class="pb-chip' + (s.kind === x[0] ? ' on' : '') + '" onclick="pbStopKind(' + i + ',\'' + x[0] + '\')">' + x[1] + ' ' + x[2] + '</button>'; }).join('') + '</div>' +
        '<div class="pb-row"><label class="pb-in"><span class="lab">WHERE</span><input value="' + _escapeHtml(s.location) + '" placeholder="Place name or address" oninput="PB.stops[' + i + '].location=this.value"></label><label class="pb-in" style="max-width:130px"><input type="time" value="' + _escapeHtml(s.time) + '" onchange="PB.stops[' + i + '].time=this.value"></label></div>' +
        (s.game ? '<div class="pb-game">' + _pbGameCard(s.game) + '<div class="pb-row" style="justify-content:space-between"><span style="font-size:12px;color:#9C95D0">' + (s.kind === 'stadium' ? 'We\u2019re at this game' : 'On the TVs here') + '</span><button class="pb-mini ghost" onclick="PB.stops[' + i + '].game=null;_pbRender()">Remove game</button></div></div>'
          : '<button class="pb-dash" onclick="pbPickGame(\'stop:' + i + '\')">' + (s.kind === 'stadium' ? '\ud83c\udfdf\ufe0f Pick the game' : '\ud83d\udcfa A game on here') + '</button>') + '</div>';
    }).join('');
    h += '<button class="pb-dash" onclick="PB.stops.push(_pbStop(\'bar\'));_pbRender()">\uff0b Add a stop</button>';
  }
  if (k === 'games') {
    h += P.games.map(function (g, i) {
      return '<div class="pb-game"><div class="pb-row">' + _pbGameCard(g) + '<button class="pb-x" style="margin-left:auto" onclick="PB.games.splice(' + i + ',1);_pbRender()" aria-label="Remove game">\u2715</button></div>' +
        '<div class="pb-chips">' + Object.keys(PB_WHERE).map(function (w) { return '<button class="pb-chip' + (g.where === w ? ' on' : '') + '" onclick="PB.games[' + i + '].where=\'' + w + '\';_pbRender()">' + PB_WHERE[w] + '</button>'; }).join('') + '</div>' +
        (g.where !== 'going' ? '<label class="pb-in"><span class="lab">WHERE</span><input value="' + _escapeHtml(g.place || '') + '" placeholder="' + (g.where === 'bar' ? 'Which bar?' : 'Whose place?') + '" oninput="PB.games[' + i + '].place=this.value"></label>' : '') +
        (P.stops.length ? '<label class="pb-in"><span class="lab">STOP</span><select onchange="PB.games[' + i + '].stopId=this.value">' + _pbStopOpts(g.stopId) + '</select></label>' : '') + '</div>';
    }).join('');
    h += '<button class="pb-dash" onclick="pbPickGame(\'games\')">\uff0b Add a game \u2014 any sport</button>';
  }
  if (k === 'crew') {
    var fr = window._myFriendProfiles || {};
    h += '<div class="pb-row">' + (P.crew.length ? '<div class="pb-avs">' + P.crew.slice(0, 6).map(function (u, i) { return _pbAv(fr[u], i); }).join('') + '</div><span style="font-size:13px;color:#9C95D0">' + P.crew.length + (P.crew.length === 1 ? ' person' : ' people') + '</span>' : '<span style="font-size:13px;color:#9C95D0">No one yet</span>') + '<button class="pb-mini" style="margin-left:auto" onclick="PB.sheet=\'crew\';_pbRender()">Choose</button></div>' +
      '<div class="pb-chips">' + ['Guest list', 'The crew', 'The A-team', 'The squad'].map(function (x) { return '<button class="pb-chip' + (_pbT('crew') === x ? ' on' : '') + '" onclick="PB.blockTitles.crew=\'' + x + '\';_pbRender()">' + x + '</button>'; }).join('') + '</div>' +
      _pbToggle('Plus-ones allowed', 'plusOnes') + _pbToggle('Guests can see who\u2019s coming', 'showGuests') + _pbToggle('Friends of guests can find it', 'isPublic') +
      '<label class="pb-in"><span class="lab">CAP</span><input type="number" min="1" inputmode="numeric" value="' + _escapeHtml(P.cap) + '" placeholder="No limit" oninput="PB.cap=this.value"></label>';
  }
  if (k === 'potluck') {
    h += P.potluck.map(function (it, i) {
      return '<div class="pb-item"><input style="width:34px;text-align:center;font-size:18px" value="' + _escapeHtml(it.e) + '" aria-label="Emoji" oninput="PB.potluck[' + i + '].e=this.value"><input value="' + _escapeHtml(it.n) + '" placeholder="Dish or category" oninput="PB.potluck[' + i + '].n=this.value">' +
        '<span class="pb-row" style="gap:6px"><button class="pb-x" onclick="PB.potluck[' + i + '].need=Math.max(1,PB.potluck[' + i + '].need-1);_pbRender()" aria-label="Fewer">\u2212</button><b style="min-width:16px;text-align:center">' + it.need + '</b><button class="pb-x" onclick="PB.potluck[' + i + '].need++;_pbRender()" aria-label="More">+</button><button class="pb-x" onclick="PB.potluck.splice(' + i + ',1);_pbRender()" aria-label="Remove dish">\u2715</button></span></div>';
    }).join('') + '<button class="pb-dash" onclick="PB.potluck.push({id:_pbId(\'p\'),e:\'\ud83c\udf7d\ufe0f\',n:\'\',need:1,by:[]});_pbRender()">\uff0b Add a dish</button>' + _pbToggle('Ask about allergies when people RSVP', 'allergies');
  }
  if (k === 'bring') h += P.bring.map(function (it, i) { return '<div class="pb-item" style="grid-template-columns:minmax(0,1fr) auto"><input value="' + _escapeHtml(it.n) + '" placeholder="Something to bring" oninput="PB.bring[' + i + '].n=this.value"><button class="pb-x" onclick="PB.bring.splice(' + i + ',1);_pbRender()" aria-label="Remove">\u2715</button></div>'; }).join('') + '<button class="pb-dash" onclick="PB.bring.push({id:_pbId(\'b\'),n:\'\',by:null});_pbRender()">\uff0b Add an item</button>';
  if (k === 'poll') {
    if (!P.polls.length) P.polls.push({ id: _pbId('q'), q: '', opts: ['', ''], votes: {} });
    h += P.polls.map(function (q, qi) {
      return '<div class="pb-stop"><label class="pb-in"><span class="lab">ASK</span><input value="' + _escapeHtml(q.q) + '" placeholder="Ask the group\u2026" oninput="PB.polls[' + qi + '].q=this.value"></label>' +
        q.opts.map(function (o, oi) { return '<div class="pb-row"><label class="pb-in"><input value="' + _escapeHtml(o) + '" placeholder="Option ' + (oi + 1) + '" oninput="PB.polls[' + qi + '].opts[' + oi + ']=this.value"></label><button class="pb-x" onclick="PB.polls[' + qi + '].opts.splice(' + oi + ',1);_pbRender()" aria-label="Remove option">\u2715</button></div>'; }).join('') +
        '<div class="pb-row"><button class="pb-mini ghost" onclick="PB.polls[' + qi + '].opts.push(\'\');_pbRender()">\uff0b Option</button><button class="pb-mini ghost" onclick="PB.polls.splice(' + qi + ',1);_pbRender()">Remove poll</button></div></div>';
    }).join('') + '<button class="pb-dash" onclick="PB.polls.push({id:_pbId(\'q\'),q:\'\',opts:[\'\',\'\'],votes:{}});_pbRender()">\uff0b Another poll</button>';
  }
  if (k === 'run') h += P.run.map(function (r, i) { return '<div class="pb-row"><label class="pb-in" style="max-width:120px"><input value="' + _escapeHtml(r.t) + '" placeholder="Time" oninput="PB.run[' + i + '].t=this.value"></label><label class="pb-in"><input value="' + _escapeHtml(r.x) + '" placeholder="What\u2019s happening" oninput="PB.run[' + i + '].x=this.value"></label><button class="pb-x" onclick="PB.run.splice(' + i + ',1);_pbRender()" aria-label="Remove">\u2715</button></div>'; }).join('') + '<button class="pb-dash" onclick="PB.run.push({t:\'\',x:\'\'});_pbRender()">\uff0b Add a time</button>';
  if (k === 'cost') h += '<label class="pb-in"><span class="lab">TOTAL $</span><input type="number" inputmode="decimal" value="' + _escapeHtml(P.cost.total) + '" placeholder="0" oninput="PB.cost.total=this.value"></label><div class="pb-seg" style="grid-template-columns:repeat(3,1fr)">' + [['even', 'Split evenly'], ['item', 'By item'], ['host', 'I\u2019ve got it']].map(function (x) { return '<button class="' + (P.cost.mode === x[0] ? 'on' : '') + '" onclick="PB.cost.mode=\'' + x[0] + '\';_pbRender()">' + x[1] + '</button>'; }).join('') + '</div><label class="pb-in"><input value="' + _escapeHtml(P.cost.note) + '" placeholder="Note (what it covers, how to pay)" oninput="PB.cost.note=this.value"></label>';
  if (k === 'rides') h += '<div class="pb-p" style="font-size:12.5px">Drivers add themselves on the plan \u2014 you can add yours now.</div>' + P.rides.map(function (r, i) { return '<div class="pb-item"><span class="e">\ud83d\ude97</span><span><b>' + _escapeHtml(r.name) + '</b><br><small>' + r.seats + ' seats' + (r.from ? ' \u00b7 from ' + _escapeHtml(r.from) : '') + '</small></span><button class="pb-x" onclick="PB.rides.splice(' + i + ',1);_pbRender()" aria-label="Remove">\u2715</button></div>'; }).join('') +
    '<button class="pb-dash" onclick="pbAddMyRide()">\uff0b I\u2019m driving</button>';
  if (k === 'dress') h += '<div class="pb-chips">' + ['Cozy', 'Casual', 'Dress up', 'Costume', 'All white', 'Team colors', 'Comfy shoes', 'Bring layers'].map(function (x) { var on = P.dress.indexOf(x) !== -1; return '<button class="pb-chip' + (on ? ' on' : '') + '" onclick="pbDress(\'' + x + '\')">' + x + '</button>'; }).join('') + '</div><label class="pb-in"><input value="' + _escapeHtml(P.dressNote) + '" placeholder="Or say it your way" oninput="PB.dressNote=this.value"></label>';
  if (k === 'music') h += '<label class="pb-in">\ud83c\udfb5<input value="' + _escapeHtml(P.playlist) + '" placeholder="Paste a Spotify or Apple Music link" oninput="PB.playlist=this.value"></label>';
  if (k === 'tickets') h += '<label class="pb-in">\ud83c\udf9f\ufe0f<input value="' + _escapeHtml(P.ticketLink) + '" placeholder="Link to buy, or where the tickets are" oninput="PB.ticketLink=this.value"></label>';
  if (k === 'note') h += '<label class="pb-in" style="align-items:flex-start"><textarea rows="3" placeholder="Buzzer code, parking, allergies\u2026" oninput="PB.note=this.value" style="resize:none;line-height:1.45">' + _escapeHtml(P.note) + '</textarea></label>';
  if (k === 'memory') h += _pbToggle('When it\u2019s over, turn it into a memory with everyone who came', 'memoryAfter');
  return h;
}
function _pbToggle(label, key) { return '<div class="pb-row" style="justify-content:space-between;font-size:13.5px"><span>' + label + '</span><button class="pb-tog' + (PB[key] ? ' on' : '') + '" role="switch" aria-checked="' + !!PB[key] + '" aria-label="' + _escapeHtml(label) + '" onclick="PB.' + key + '=!PB.' + key + ';_pbRender()"></button></div>'; }
function _pbRoute(n) {
  var pts = [[40, 70], [150, 30], [270, 62], [340, 24], [230, 16], [110, 60]].slice(0, Math.max(2, Math.min(6, n)));
  return '<svg viewBox="0 0 380 90" class="pb-route" aria-hidden="true"><path d="M' + pts.map(function (p) { return p.join(' '); }).join(' L') + '" fill="none" stroke="' + (PB ? PB.look.acc : '#A89FE8') + '" stroke-width="3" stroke-dasharray="1 8" stroke-linecap="round"/>' +
    pts.map(function (p, i) { return '<g transform="translate(' + p[0] + ',' + p[1] + ')"><circle r="12" fill="' + (PB ? PB.look.acc : '#A89FE8') + '"/><text y="4.5" text-anchor="middle" font-size="12" font-weight="900" fill="#1A1640" font-family="-apple-system,sans-serif">' + (i + 1) + '</text></g>'; }).join('') + '</svg>';
}
function pbMove(i, d) { var j = i + d; if (j < 0 || j >= PB.blocks.length) return; var t = PB.blocks[i]; PB.blocks[i] = PB.blocks[j]; PB.blocks[j] = t; _pbRender(); }
function pbRm(k) { PB.blocks = PB.blocks.filter(function (x) { return x !== k; }); _pbRender(); }
function pbAdd(k) {
  if (PB.blocks.indexOf(k) === -1) {
    var at = PB.blocks.indexOf('memory'); if (at === -1) at = PB.blocks.length;
    PB.blocks.splice(at, 0, k);
    if (k === 'stops' && !PB.stops.length) PB.stops = [_pbStop('bar'), _pbStop('bar')];
    if (k === 'potluck' && !PB.potluck.length) PB.potluck = [{ id: _pbId('p'), e: '\ud83c\udf7d\ufe0f', n: '', need: 1, by: [] }];
  }
  PB.sheet = null;
  if (PB.screen === 'look') PB.screen = 'build';
  _pbRender();
  setTimeout(function () { var el = document.getElementById('pb-blk-' + k); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60);
}
function pbStopMove(i, d) { var j = i + d; if (j < 0 || j >= PB.stops.length) return; var t = PB.stops[i]; PB.stops[i] = PB.stops[j]; PB.stops[j] = t; _pbRender(); }
function pbStopKind(i, kind) { var s = PB.stops[i], k = PB_STOPKIND.filter(function (x) { return x[0] === kind; })[0]; s.kind = kind; s.emoji = k[1]; s.type = kind === 'stadium' ? 'game' : 'custom'; if (s.game) s.game.where = kind === 'stadium' ? 'going' : kind === 'house' ? 'house' : 'bar'; _pbRender(); }
function pbDress(x) { var i = PB.dress.indexOf(x); if (i === -1) PB.dress.push(x); else PB.dress.splice(i, 1); _pbRender(); }
function pbAddMyRide() {
  var n = (window.userData && window.userData.name) || 'Me';
  PB.rides.push({ id: _pbId('r'), uid: _pbUid(), name: n, seats: 3, from: '', riders: [] }); _pbRender();
}
function pbGo(s) { PB.screen = s; PB.sheet = null; _pbRender(); }

// ── game picker: every sport the app follows, for the plan's date ──
function pbPickGame(target) { PB.pickFor = target; PB.sheet = 'games'; PB.pickDate = PB.pickDate || PB.date || _pbToday(0); _pbRender(); _pbLoadGames(); }
window._pbGameCache = window._pbGameCache || {};
function _pbLoadGames() {
  var sp = PB.pickSport, d = PB.pickDate, key = sp + ':' + d;
  if (window._pbGameCache[key]) return;
  window._pbGameCache[key] = 'loading';
  fetch(_bsModalScheduleUrl(sp, d)).then(function (r) { return r.json(); }).then(function (j) { window._pbGameCache[key] = (j && j.games) || []; })
    .catch(function () { window._pbGameCache[key] = []; }).then(function () { if (PB && PB.sheet === 'games') _pbRender(); });
}
function _pbGameFrom(g, sp) {
  var meta = (typeof GAMES_SPORTS !== 'undefined' ? GAMES_SPORTS : []).filter(function (s) { return s.key === sp; })[0] || { emoji: '\ud83c\udfdf\ufe0f', name: sp.toUpperCase() };
  var a = g.awayAbbr || (typeof _ghAbbrFallback === 'function' ? _ghAbbrFallback(g.away || '') : ''), h = g.homeAbbr || (typeof _ghAbbrFallback === 'function' ? _ghAbbrFallback(g.home || '') : '');
  var col = function (ab) { try { return _ghTeamColors(ab).bg; } catch (e) { return '#3D3580'; } };
  var t = g.startTime ? new Date(g.startTime) : null;
  return { sport: sp, gamePk: g.gamePk, away: _teamShortName ? _teamShortName(g.away || '') || g.away : g.away, home: _teamShortName ? _teamShortName(g.home || '') || g.home : g.home, awayFull: g.away, homeFull: g.home,
    a: a, h: h, ac: col(a), hc: col(h), emoji: meta.emoji, lgName: meta.name, date: PB.pickDate, startTime: g.startTime || null,
    timeLabel: t ? t.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ' \u00b7 ' + t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '', venue: g.venue || '' };
}
function pbChooseGame(idx) {
  var list = window._pbGameCache[PB.pickSport + ':' + PB.pickDate];
  if (!list || !list[idx]) return;
  var g = _pbGameFrom(list[idx], PB.pickSport);
  var t = PB.pickFor || 'games';
  if (t.indexOf('stop:') === 0) {
    var s = PB.stops[+t.slice(5)];
    g.where = s.kind === 'stadium' ? 'going' : s.kind === 'house' ? 'house' : 'bar';
    s.game = g;
    if (s.kind === 'stadium' && !s.name) s.name = g.venue || 'The game';
  } else {
    g.where = (PB_TPL[PB.tpl] || {}).gameWhere || 'house';
    g.place = ''; g.stopId = '';
    PB.games.push(g);
    if (PB.blocks.indexOf('games') === -1) PB.blocks.unshift('games');
    if (PB.tpl === 'game' && !PB.title) { PB.title = g.away + ' @ ' + g.home; if (!PB.date) PB.date = PB.pickDate; if (!PB.time && g.startTime) { var d = new Date(g.startTime); PB.time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } }
  }
  PB.sheet = null; _pbRender();
}
function _pbGamesSheet() {
  var sports = typeof GAMES_SPORTS !== 'undefined' ? GAMES_SPORTS : [{ key: 'mlb', name: 'MLB', emoji: '\u26be' }];
  var list = window._pbGameCache[PB.pickSport + ':' + PB.pickDate];
  var rows = list === 'loading' || list == null ? '<div class="pb-p">Loading games\u2026</div>' : !list.length ? '<div class="pb-p">No ' + _escapeHtml((sports.filter(function (s) { return s.key === PB.pickSport; })[0] || {}).name || '') + ' games that day.</div>'
    : list.map(function (g, i) { var x = _pbGameFrom(g, PB.pickSport); return '<button class="pb-item" style="grid-template-columns:minmax(0,1fr) auto;text-align:left;width:100%" onclick="pbChooseGame(' + i + ')">' + _pbGameCard(x) + '<span class="pb-mini">Add</span></button>'; }).join('');
  return '<div class="pb-shade" onclick="PB.sheet=null;_pbRender()"></div><div class="pb-sheet"><div class="grab"></div><div style="padding:4px 16px 8px"><div class="pb-h2">' + (String(PB.pickFor || '').indexOf('stop:') === 0 ? 'Game at this stop' : 'Add a game') + '</div><div class="pb-p">Any sport the app follows.</div></div>' +
    '<div class="pb-chips" style="padding:0 16px 8px;flex-wrap:nowrap;overflow-x:auto">' + sports.map(function (s) { return '<button class="pb-chip' + (PB.pickSport === s.key ? ' on' : '') + '" onclick="PB.pickSport=\'' + s.key + '\';_pbRender();_pbLoadGames()">' + s.emoji + ' ' + _escapeHtml(s.name) + '</button>'; }).join('') + '</div>' +
    '<div style="padding:0 16px 8px"><label class="pb-in"><span class="lab">DAY</span><input type="date" value="' + PB.pickDate + '" onchange="PB.pickDate=this.value;_pbRender();_pbLoadGames()"></label></div>' +
    '<div style="overflow-y:auto;padding:0 16px 22px;display:flex;flex-direction:column;gap:8px">' + rows + '</div></div>';
}
function _pbAddSheet() {
  return '<div class="pb-shade" onclick="PB.sheet=null;_pbRender()"></div><div class="pb-sheet"><div class="grab"></div><div style="padding:4px 16px 8px"><div class="pb-h2">Add a block</div><div class="pb-p">Any of these, on any plan.</div></div><div class="pb-bgrid">' +
    Object.keys(PB_BLOCKS).map(function (k) { var b = PB_BLOCKS[k], used = PB.blocks.indexOf(k) !== -1; return '<button class="pb-bopt" onclick="pbAdd(\'' + k + '\')"' + (used ? ' disabled' : '') + '><span class="e">' + b.e + '</span><b>' + _escapeHtml(_pbT(k)) + (used ? ' \u2713' : '') + '</b><small>' + b.d + '</small></button>'; }).join('') + '</div></div>';
}
function _pbCrewSheet() {
  var fr = window._myFriendProfiles, uids = fr ? Object.keys(fr) : [];
  var rows = !fr ? '<div class="pb-p">Loading friends\u2026</div>' : !uids.length ? '<div class="pb-p">Add friends first, then invite them here.</div>' :
    uids.sort(function (a, b) { return String(fr[a]).localeCompare(String(fr[b])); }).map(function (u, i) { var on = PB.crew.indexOf(u) !== -1; return '<button class="pb-friend" onclick="pbCrew(\'' + u + '\')">' + _pbAv(fr[u], i) + '<b>' + _escapeHtml(fr[u]) + '</b><span class="pb-ck' + (on ? ' on' : '') + '">' + (on ? '\u2713' : '') + '</span></button>'; }).join('');
  return '<div class="pb-shade" onclick="PB.sheet=null;_pbRender()"></div><div class="pb-sheet"><div class="grab"></div><div style="padding:4px 16px 8px;display:flex;align-items:center;justify-content:space-between"><div class="pb-h2">' + _escapeHtml(_pbT('crew')) + '</div>' +
    (uids.length ? '<button class="pb-mini ghost" onclick="PB.crew=' + (PB.crew.length === uids.length ? '[]' : 'Object.keys(window._myFriendProfiles||{})') + ';_pbRender()">' + (PB.crew.length === uids.length ? 'Clear' : 'Everyone') + '</button>' : '') + '</div>' +
    '<div style="overflow-y:auto;padding:0 16px 10px">' + rows + '</div><div class="pb-foot"><button class="pb-cta" onclick="PB.sheet=null;_pbRender()">Done \u00b7 ' + PB.crew.length + '</button></div></div>';
}
function pbCrew(u) { var i = PB.crew.indexOf(u); if (i === -1) PB.crew.push(u); else PB.crew.splice(i, 1); _pbRender(); }

// ── screens ──
function _pbTplScreen() {
  var order = ['hang', 'game', 'watch', 'night', 'dinner', 'bday', 'trip', 'blank'];
  return '<div class="pb-top"><button class="x" onclick="pbClose()">Cancel</button><span class="t">It\u2019s coming up</span><span class="sv"></span></div><div class="pb-body"><div class="pb-h1">What are you planning?</div><div class="pb-p">Pick a start \u2014 every piece can be changed, renamed or removed after.</div><div class="pb-tpls">' +
    order.map(function (k) { var t = PB_TPL[k], w = k === 'hang' || k === 'blank'; return '<button class="pb-tpl' + (w ? ' wide' : '') + '" style="background:' + t.bg + '" onclick="pbUseTpl(\'' + k + '\')"><span class="e">' + t.e + '</span><span style="display:flex;flex-direction:column;gap:2px"><b>' + t.n + '</b><small>' + t.d + '</small></span></button>'; }).join('') +
    '</div></div>';
}
function _pbBuildScreen() {
  var blocks = PB.blocks.map(function (k, i) { return '<div class="pb-blk" id="pb-blk-' + k + '">' + _pbHead(k, i) + '<div class="pb-bb">' + _pbBody(k) + '</div></div>'; }).join('');
  return '<div class="pb-top"><button class="x" onclick="' + (PB.mode === 'edit' ? 'pbClose()' : 'pbGo(\'tpl\')') + '">' + (PB.mode === 'edit' ? 'Cancel' : '\u2039 Back') + '</button><span class="t">' + _escapeHtml(PB.mode === 'edit' ? 'Edit plan' : (PB_TPL[PB.tpl] || {}).n || 'Plan') + '</span><button class="sv" onclick="pbGo(\'look\')">Style</button></div>' +
    '<div class="pb-body">' + _pbPreview(true) +
    '<label class="pb-in"><span class="lab">TITLE</span><input value="' + _escapeHtml(PB.title) + '" placeholder="Name your plan" oninput="PB.title=this.value;var e=document.querySelector(\'#pb-root .pb-pv .title\');if(e)e.textContent=this.value||\'Untitled plan\'"></label>' +
    '<label class="pb-in"><span class="lab">LABEL</span><input value="' + _escapeHtml(PB.kick) + '" placeholder="DINNER PARTY, GAME DAY\u2026" oninput="PB.kick=this.value.toUpperCase();var e=document.querySelector(\'#pb-root .pb-pv .kick\');if(e)e.textContent=PB.kick"></label>' +
    blocks + '<button class="pb-add" onclick="PB.sheet=\'add\';_pbRender()">\uff0b Add a block</button></div>' +
    '<div class="pb-foot"><button class="pb-cta ghost" onclick="pbGo(\'look\')">\ud83c\udfa8 Style</button><button class="pb-cta" id="pb-save" onclick="pbSave()">' + (PB.mode === 'edit' ? 'Save changes' : 'Send invites') + '</button></div>';
}
function _pbLookScreen() {
  var L = PB.look;
  var fonts = [['classic', 'Bold italic', 'font-weight:900;font-style:italic'], ['serif', 'Elegant serif', 'font-family:Georgia,serif;font-weight:700'], ['script', 'Handwritten', 'font-family:\'Snell Roundhand\',\'Brush Script MT\',cursive;font-size:21px'], ['mono', 'Typewriter', 'font-family:ui-monospace,Menlo,monospace;font-weight:800;text-transform:uppercase;font-size:14px']];
  return '<div class="pb-top"><button class="x" onclick="pbGo(\'' + (PB.hang ? 'hang' : 'build') + '\')">\u2039 Back</button><span class="t">Style it</span><button class="sv" onclick="pbGo(\'' + (PB.hang ? 'hang' : 'build') + '\')">Done</button></div><div class="pb-body">' + _pbPreview(false) +
    '<div class="pb-k">COVER</div><div class="pb-sw">' + PB_COVERS.map(function (c, i) { return '<button class="' + (L.cover === i ? 'on' : '') + '" style="background:' + c + '" onclick="PB.look.cover=' + i + ';_pbRender()" aria-label="Cover ' + (i + 1) + '"></button>'; }).join('') + '</div>' +
    '<div class="pb-k">TITLE FONT</div><div class="pb-fonts">' + fonts.map(function (f) { return '<button class="' + (L.font === f[0] ? 'on' : '') + '" style="' + f[2] + '" onclick="PB.look.font=\'' + f[0] + '\';_pbRender()">' + f[1] + '</button>'; }).join('') + '</div>' +
    '<div class="pb-k">ACCENT</div><div class="pb-dots">' + PB_ACCS.map(function (c) { return '<button class="' + (L.acc === c ? 'on' : '') + '" style="background:' + c + '" onclick="PB.look.acc=\'' + c + '\';_pbRender()" aria-label="Accent ' + c + '"></button>'; }).join('') + '</div>' +
    '<div class="pb-k">EMOJI</div><div class="pb-sw">' + PB_EMOS.map(function (e) { return '<button class="' + (L.emo === e ? 'on' : '') + '" style="background:rgba(255,255,255,.05)" onclick="PB.look.emo=\'' + e + '\';_pbRender()">' + e + '</button>'; }).join('') + '</div>' +
    '<div class="pb-k">AMBIENCE</div><div class="pb-chips">' + [['none', 'None'], ['candles', 'Candlelight'], ['stars', 'Starlight'], ['confetti', 'Confetti'], ['glow', 'Soft glow']].map(function (f) { return '<button class="pb-chip' + (L.fx === f[0] ? ' on' : '') + '" onclick="PB.look.fx=\'' + f[0] + '\';_pbRender()">' + f[1] + '</button>'; }).join('') + '</div>' +
    '<button class="pb-add" onclick="PB.sheet=\'add\';_pbRender()">\uff0b Add a block</button></div>';
}
function _pbHangScreen() {
  var fr = window._myFriendProfiles || {}, all = Object.keys(fr);
  var extras = PB.blocks.map(function (k, i) { return '<div class="pb-blk" id="pb-blk-' + k + '">' + _pbHead(k, i) + '<div class="pb-bb">' + _pbBody(k) + '</div></div>'; }).join('');
  var quick = [['games', '\ud83c\udfdf\ufe0f Game on'], ['stops', '\ud83d\uddfa\ufe0f More places'], ['poll', '\ud83d\uddf3\ufe0f Quick poll'], ['bring', '\ud83e\uddfa Bring something'], ['rides', '\ud83d\ude97 Rides']];
  return '<div class="pb-top"><button class="x" onclick="pbGo(\'tpl\')">\u2039 Back</button><span class="t">Casual hang</span><button class="sv" onclick="pbGo(\'look\')">Style</button></div><div class="pb-body">' +
    '<div class="pb-k">WHAT\u2019S UP?</div><textarea class="pb-big" rows="3" placeholder="Anyone want to grab a beer in North Beach?" oninput="PB.title=this.value" aria-label="What\u2019s the plan">' + _escapeHtml(PB.title) + '</textarea>' +
    '<div class="pb-k">WHEN</div><div class="pb-chips">' + ['Now', 'Tonight', 'Tomorrow', 'This weekend', 'Pick a day'].map(function (w) { return '<button class="pb-chip' + (PB.hangWhen === w ? ' on' : '') + '" onclick="PB.hangWhen=\'' + w + '\';_pbRender()">' + w + '</button>'; }).join('') + '</div>' +
    (PB.hangWhen === 'Pick a day' ? '<div class="pb-row"><label class="pb-in"><input type="date" value="' + PB.date + '" onchange="PB.date=this.value"></label><label class="pb-in" style="max-width:140px"><input type="time" value="' + PB.time + '" onchange="PB.time=this.value"></label></div>' : '') +
    '<div class="pb-k">WHERE <span style="letter-spacing:0;font-weight:500">\u00b7 optional</span></div><label class="pb-in">\ud83d\udccd<input value="' + _escapeHtml(PB.location) + '" placeholder="A place or address" oninput="PB.location=this.value"></label>' +
    '<div class="pb-k">WHO</div><div class="pb-chips"><button class="pb-chip' + (all.length && PB.crew.length === all.length ? ' on' : '') + '" onclick="PB.crew=Object.keys(window._myFriendProfiles||{});_pbRender()">\ud83d\udc9c All my friends' + (all.length ? ' (' + all.length + ')' : '') + '</button><button class="pb-chip' + (PB.crew.length && PB.crew.length !== all.length ? ' on' : '') + '" onclick="PB.sheet=\'crew\';_pbRender()">' + (PB.crew.length && PB.crew.length !== all.length ? PB.crew.length + ' picked' : 'Pick people') + '</button></div>' +
    extras +
    '<div class="pb-k">ADD <span style="letter-spacing:0;font-weight:500">\u00b7 optional</span></div><div class="pb-chips">' + quick.map(function (x) { var on = PB.blocks.indexOf(x[0]) !== -1; return '<button class="pb-chip' + (on ? ' on' : '') + '" onclick="' + (on ? 'pbRm' : 'pbAdd') + '(\'' + x[0] + '\')">' + (on ? '\u2713 ' : '') + x[1] + '</button>'; }).join('') + '<button class="pb-chip" onclick="PB.sheet=\'add\';_pbRender()">\uff0b More blocks</button></div>' +
    '</div><div class="pb-foot"><button class="pb-cta" id="pb-save" onclick="pbSave()">Send it</button></div>';
}
function _pbRender() {
  var root = document.getElementById('pb-root');
  if (!root || !PB) return;
  var sc = root.querySelector('.pb-body'), keep = sc ? sc.scrollTop : 0, same = root._pbScreen === PB.screen;
  var h = PB.screen === 'tpl' ? _pbTplScreen() : PB.screen === 'look' ? _pbLookScreen() : PB.screen === 'hang' ? _pbHangScreen() : _pbBuildScreen();
  if (PB.sheet === 'add') h += _pbAddSheet();
  else if (PB.sheet === 'games') h += _pbGamesSheet();
  else if (PB.sheet === 'crew') h += _pbCrewSheet();
  root.innerHTML = h;
  root.style.setProperty('--pbacc', PB.look.acc);
  root._pbScreen = PB.screen;
  var nb = root.querySelector('.pb-body'); if (nb && same) nb.scrollTop = keep;
}

// ── save: a normal futureMoments doc + the pb extras ──
function _pbHangDate() {
  var w = PB.hangWhen, d = new Date();
  if (w === 'Tomorrow') d.setDate(d.getDate() + 1);
  if (w === 'This weekend') { var add = (6 - d.getDay() + 7) % 7; d.setDate(d.getDate() + add); }
  if (w === 'Pick a day') return [PB.date, PB.time];
  var t = w === 'Now' ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : w === 'Tonight' ? '19:00' : '';
  return [d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), t];
}
function pbSave() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast === 'function') ib_toast('Sign in first'); return; }
  if (!PB.title.trim()) { if (typeof ib_toast === 'function') ib_toast(PB.hang ? 'Say what\u2019s up first' : 'Give it a title first'); return; }
  var btn = document.getElementById('pb-save'); if (btn) btn.disabled = true;
  var dt = PB.hang ? _pbHangDate() : [PB.whenMode === 'vote' && PB.whenOptions[0] ? PB.whenOptions[0].date : PB.date, PB.whenMode === 'vote' && PB.whenOptions[0] ? PB.whenOptions[0].time : PB.time];
  var usesStops = PB.blocks.indexOf('stops') !== -1;
  var stops = usesStops ? PB.stops : [];
  var loc = PB.location || (usesStops && stops[0] ? (stops[0].location || stops[0].name) : '');
  var gameLocs = PB.games.map(function (g) { return g; });
  var pb = {
    v: 1, template: PB.tpl, kick: PB.kick, blocks: PB.blocks, blockTitles: PB.blockTitles, look: PB.look,
    whenMode: PB.whenMode, whenOptions: PB.whenOptions, flexWhen: PB.flexWhen || '', hang: !!PB.hang, hangWhen: PB.hang ? PB.hangWhen : '',
    games: gameLocs, potluck: PB.potluck, allergies: !!PB.allergies, bring: PB.bring, polls: PB.polls, run: PB.run,
    cost: PB.cost, rides: PB.rides, dress: PB.dress, dressNote: PB.dressNote, playlist: PB.playlist, note: PB.note,
    plusOnes: !!PB.plusOnes, cap: PB.cap, showGuests: !!PB.showGuests, memoryAfter: !!PB.memoryAfter, meetAt: PB.meetAt || {}
  };
  var doc = {
    title: PB.title.trim(), date: dt[0] || '', time: dt[1] || '', location: loc,
    theme: _pbBg(), ticketLink: PB.ticketLink || '', taggedUids: PB.crew.slice(), public: !!PB.isPublic,
    stops: typeof _sanitizeForFirestore === 'function' ? (_sanitizeForFirestore(stops) || []) : stops,
    pb: typeof _sanitizeForFirestore === 'function' ? _sanitizeForFirestore(pb) : pb
  };
  var done = function () {
    if (typeof ib_toast === 'function') ib_toast(PB.mode === 'edit' ? 'Saved' : (PB.hang ? 'Sent \ud83d\udc4b' : 'Invite sent \ud83c\udf89'));
    var id = PB.id; pbClose();
    if (typeof loadFutureMoments === 'function') loadFutureMoments();
    if (id && typeof openFutureDetail === 'function') setTimeout(function () { openFutureDetail(id); }, 300); else nav('feed');
  };
  var fail = function (err) { console.error('[plan builder] save', err); if (btn) btn.disabled = false; if (typeof ib_toast === 'function') ib_toast('Could not save \u2014 try again'); };
  if (PB.mode === 'edit' && PB.id) {
    window.db.collection('futureMoments').doc(PB.id).update(doc).then(function () {
      var c = (window._futureMomentsCache || {})[PB.id]; if (c) Object.assign(c, doc);
      done();
    }).catch(fail);
  } else {
    doc.ownerUid = user.uid; doc.ownerName = (window.userData && window.userData.name) || 'You';
    doc.vibe = ''; doc.coverPhoto = ''; doc.rsvps = {}; doc.ts = Date.now();
    window.db.collection('futureMoments').add(doc).then(done).catch(fail);
  }
}
// open an existing plan in the builder (host only)
function _pbFromDoc(m) {
  var p = m.pb || {};
  var B = _pbBlank(p.template || 'blank');
  B.mode = 'edit'; B.id = m._id; B.screen = p.hang ? 'hang' : 'build';
  B.title = m.title || ''; B.date = m.date || ''; B.time = m.time || ''; B.location = m.location || '';
  B.crew = (m.taggedUids || []).slice(); B.isPublic = !!m.public; B.ticketLink = m.ticketLink || '';
  B.stops = (m.stops || []).map(function (s) { return Object.assign({ kind: s.type === 'game' ? 'stadium' : 'other', game: null }, s); });
  if (p.v) {
    ['kick', 'whenMode', 'whenOptions', 'flexWhen', 'games', 'potluck', 'bring', 'polls', 'run', 'cost', 'rides', 'dress', 'dressNote', 'playlist', 'note', 'cap', 'hangWhen', 'meetAt'].forEach(function (k) { if (p[k] !== undefined) B[k] = JSON.parse(JSON.stringify(p[k])); });
    ['allergies', 'plusOnes', 'showGuests', 'memoryAfter'].forEach(function (k) { if (p[k] !== undefined) B[k] = !!p[k]; });
    B.blocks = (p.blocks || []).slice(); B.blockTitles = Object.assign({}, p.blockTitles || {}); B.look = Object.assign(B.look, p.look || {}); B.hang = !!p.hang;
  } else {
    // a plan from the classic form: start with the pieces it already has
    B.blocks = ['when', B.stops.length ? 'stops' : 'where', 'crew'].concat(m.ticketLink ? ['tickets'] : []);
  }
  return B;
}

// ═══ ON THE PLAN SCREEN — the pieces guests use (and the host's "Add a block") ═══
function _pbDetailHtml(m) {
  var p = m.pb || {}, me = _pbUid(), isOwner = typeof _futureIsMine === 'function' && _futureIsMine(m);
  var T = function (k) { return (p.blockTitles && p.blockTitles[k]) || PB_BLOCKS[k].n; };
  var head = function (k, sub) { return '<div class="pb-bh"><span class="ic">' + PB_BLOCKS[k].e + '</span><span class="tt"><b>' + _escapeHtml(T(k)) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span></div>'; };
  var names = window._myFriendProfiles || {};
  var who = function (uid) { return uid === me ? 'You' : (names[uid] || (uid === m.ownerUid ? String(m.ownerName || 'Host').split(' ')[0] : 'Friend')); };
  var out = '', blocks = p.blocks || [];
  var id = m._id;
  blocks.forEach(function (k) {
    if (k === 'games' && (p.games || []).length) out += '<div class="pb-blk">' + head(k, 'Tap a game for the live score') + '<div class="pb-bb">' + p.games.map(function (g) {
      var st = g.stopId ? (m.stops || []).filter(function (s) { return s.id === g.stopId; })[0] : null;
      return '<button class="pb-game" style="width:100%;text-align:left" onclick="openGameScreen(\'' + g.gamePk + '\',' + JSON.stringify(g.awayFull || g.away).replace(/"/g, '&quot;') + ',' + JSON.stringify(g.homeFull || g.home).replace(/"/g, '&quot;') + ',\'' + g.sport + '\',\'' + (g.date || '') + '\')">' + _pbGameCard(g) +
        '<span style="font-size:12px;color:#D9D4FA">' + _escapeHtml(PB_WHERE[g.where] || '') + (g.place ? ' \u00b7 ' + _escapeHtml(g.place) : '') + (st ? ' \u00b7 stop: ' + _escapeHtml(st.name || '') : '') + '</span></button>';
    }).join('') + '</div></div>';
    if (k === 'stops' && (m.stops || []).length) {
      var mine = (p.meetAt || {})[me];
      out += '<div class="pb-blk">' + head(k, isOwner ? 'Where everyone\u2019s meeting you' : 'Tap where you\u2019ll meet up') + '<div class="pb-bb">' + _pbRoute(m.stops.length) + m.stops.map(function (s, i) {
        var at = Object.keys(p.meetAt || {}).filter(function (u) { return p.meetAt[u] === i; });
        return '<div class="pb-stop"><div class="pb-row"><span class="n">' + (i + 1) + '</span><span style="flex:1;min-width:0"><b style="font-size:14px">' + _escapeHtml(s.name || 'Stop ' + (i + 1)) + '</b><br><small style="color:#9C95D0">' + _escapeHtml([s.time, s.location].filter(Boolean).join(' \u00b7 ')) + '</small></span>' +
          (isOwner ? (at.length ? '<small style="color:#9C95D0">' + at.length + ' meeting here</small>' : '') : '<button class="pb-mini' + (mine === i ? ' done' : '') + '" onclick="pbMeet(\'' + id + '\',' + i + ')">' + (mine === i ? '\u2713 Meeting here' : 'Meet here') + '</button>') + '</div>' +
          (s.game ? '<div class="pb-game">' + _pbGameCard(s.game) + '<span style="font-size:12px;color:#D9D4FA">' + (s.kind === 'stadium' ? '\ud83c\udfdf\ufe0f We\u2019re at the game' : '\ud83d\udcfa On the TVs here') + '</span></div>' : '') + '</div>';
      }).join('') + '</div></div>';
    }
    if (k === 'potluck' && (p.potluck || []).length) out += '<div class="pb-blk">' + head(k, isOwner ? 'Who\u2019s bringing what' : 'Tap to claim a dish') + '<div class="pb-bb">' + p.potluck.map(function (it, i) {
      var by = it.by || [], mineP = by.indexOf(me) !== -1, full = by.length >= (it.need || 1);
      return '<div class="pb-item"><span class="e">' + _escapeHtml(it.e || '\ud83c\udf7d\ufe0f') + '</span><span><b>' + _escapeHtml(it.n || 'Something') + '</b><br><small>' + (by.length ? by.map(who).join(', ') : 'No one yet') + ' \u00b7 ' + by.length + '/' + (it.need || 1) + '</small></span>' +
        (mineP ? '<button class="pb-mini done" onclick="pbClaim(\'' + id + '\',' + i + ')">\u2713 You</button>' : full ? '<small style="color:#7CF29C">Covered</small>' : '<button class="pb-mini" onclick="pbClaim(\'' + id + '\',' + i + ')">I\u2019ll bring it</button>') + '</div>';
    }).join('') + '</div></div>';
    if (k === 'bring' && (p.bring || []).length) out += '<div class="pb-blk">' + head(k, 'Grab something open') + '<div class="pb-bb">' + p.bring.map(function (it, i) {
      return '<div class="pb-item" style="grid-template-columns:minmax(0,1fr) auto"><b>' + _escapeHtml(it.n || 'Something') + '</b>' + (it.by ? (it.by === me ? '<button class="pb-mini done" onclick="pbBring(\'' + id + '\',' + i + ')">\u2713 You</button>' : '<small style="color:#7CF29C">' + _escapeHtml(who(it.by)) + '</small>') : '<button class="pb-mini" onclick="pbBring(\'' + id + '\',' + i + ')">I\u2019ve got it</button>') + '</div>';
    }).join('') + '</div></div>';
    if (k === 'poll') (p.polls || []).forEach(function (q, qi) {
      var opts = (q.opts || []).filter(function (o) { return String(o).trim(); }); if (!opts.length) return;
      var votes = q.votes || {}, total = Object.keys(votes).length, my = votes[me];
      out += '<div class="pb-blk">' + head(k, _escapeHtml(q.q || 'Vote') + ' \u00b7 ' + total + (total === 1 ? ' vote' : ' votes')) + '<div class="pb-bb">' + opts.map(function (o, oi) {
        var n = Object.keys(votes).filter(function (u) { return votes[u] === oi; }).length;
        return '<button class="pbd-poll' + (my === oi ? ' on' : '') + '" onclick="pbVote(\'' + id + '\',' + qi + ',' + oi + ')"><span class="fill" style="width:' + (total ? Math.round(n / total * 100) : 0) + '%"></span><span>' + _escapeHtml(o) + '</span><em>' + n + '</em></button>';
      }).join('') + '</div></div>';
    });
    if (k === 'rides') out += '<div class="pb-blk">' + head(k, 'Grab a seat, or offer one') + '<div class="pb-bb">' + (p.rides || []).map(function (r, i) {
      var riders = r.riders || [], inIt = riders.indexOf(me) !== -1, left = (r.seats || 0) - riders.length;
      return '<div class="pb-item"><span class="e">\ud83d\ude97</span><span><b>' + _escapeHtml(r.name || 'Driver') + '</b><br><small>' + (riders.length ? riders.map(who).join(', ') + ' \u00b7 ' : '') + left + ' seat' + (left === 1 ? '' : 's') + ' left' + (r.from ? ' \u00b7 from ' + _escapeHtml(r.from) : '') + '</small></span>' +
        (r.uid === me ? '<small style="color:#9C95D0">Your car</small>' : inIt ? '<button class="pb-mini done" onclick="pbRide(\'' + id + '\',' + i + ')">\u2713 Riding</button>' : left > 0 ? '<button class="pb-mini" onclick="pbRide(\'' + id + '\',' + i + ')">Grab a seat</button>' : '<small style="color:#9C95D0">Full</small>') + '</div>';
    }).join('') + '<button class="pb-dash" onclick="pbOfferRide(\'' + id + '\')">\ud83d\ude97 I can drive</button></div></div>';
    if (k === 'cost' && p.cost && (p.cost.total || p.cost.note)) {
      var going = Object.keys(m.rsvps || {}).filter(function (u) { return m.rsvps[u] === 'going'; }).length + 1;
      var tot = parseFloat(p.cost.total) || 0;
      out += '<div class="pb-blk">' + head(k) + '<div class="pb-bb"><div style="font-size:14px">' + (p.cost.mode === 'host' ? 'On ' + _escapeHtml(String(m.ownerName || 'the host').split(' ')[0]) + ' \ud83d\ude4c' : tot ? '$' + tot.toFixed(0) + ' total' + (p.cost.mode === 'even' ? ' \u00b7 about $' + (tot / Math.max(1, going)).toFixed(0) + ' each (' + going + ' going)' : ' \u00b7 by item') : '') + '</div>' + (p.cost.note ? '<div class="pb-p" style="font-size:12.5px">' + _escapeHtml(p.cost.note) + '</div>' : '') + '</div></div>';
    }
    if (k === 'run' && (p.run || []).length) out += '<div class="pb-blk">' + head(k) + '<div class="pb-bb">' + p.run.map(function (r) { return '<div class="pb-item" style="grid-template-columns:auto minmax(0,1fr)"><b style="color:var(--pbacc,#A89FE8);min-width:64px">' + _escapeHtml(r.t || '') + '</b><span style="font-size:13.5px">' + _escapeHtml(r.x || '') + '</span></div>'; }).join('') + '</div></div>';
    if (k === 'dress' && ((p.dress || []).length || p.dressNote)) out += '<div class="pb-blk">' + head(k, _escapeHtml([].concat(p.dress || [], p.dressNote ? [p.dressNote] : []).join(' \u00b7 '))) + '</div>';
    if (k === 'music' && p.playlist) out += '<div class="pb-blk">' + head(k, '<a href="' + _escapeHtml(p.playlist) + '" target="_blank" rel="noopener" style="color:#A89FE8">Open the playlist \u2197</a>') + '</div>';
    if (k === 'note' && p.note) out += '<div class="pb-blk">' + head(k, _escapeHtml(p.note)) + '</div>';
  });
  if (isOwner) out += '<button class="pb-add" onclick="pbOpen(\'' + id + '\');setTimeout(function(){if(PB){PB.sheet=\'add\';_pbRender()}},50)">\uff0b Add a block</button><button class="pb-dash" style="justify-content:center" onclick="pbOpen(\'' + id + '\')">\u270e Edit in the builder</button>';
  if (!out) return '';
  return '<div class="pbd" id="pbd" style="--pbacc:' + ((p.look && p.look.acc) || '#A89FE8') + '">' + (p.hang ? '<div class="pb-k" style="color:#7CF29C">\u25cf ' + _escapeHtml(String(p.hangWhen || 'HANGING OUT').toUpperCase()) + '</div>' : '') + out + '</div>';
}
function _pbDecorateDetail(m) {
  var box = document.getElementById('fd-scroll');
  if (!box || !m) return;
  if (!window._myFriendProfiles && typeof _ensureMyFriendsLoaded === 'function' && !window._pbFrLoading) { window._pbFrLoading = true; _ensureMyFriendsLoaded(function () { window._pbFrLoading = false; if (window._openFutureId === m._id) _pbDecorateDetail(m); }); }
  var old = document.getElementById('pbd'); if (old) old.remove();
  var html = _pbDetailHtml(m);
  if (!html) return;
  var wrap = document.createElement('div'); wrap.innerHTML = html;
  var el = wrap.firstChild;
  // right under the plan's hero card (its first block)
  var first = box.firstElementChild;
  if (first && first.nextSibling) box.insertBefore(el, first.nextSibling); else box.appendChild(el);
  // the chosen title font and emoji carry onto the plan's own hero
  var p = m.pb || {};
  if (p.look && p.look.font && p.look.font !== 'classic' && first) {
    var fam = { serif: '"Iowan Old Style","Palatino Linotype",Georgia,serif', script: '"Snell Roundhand","Brush Script MT",cursive', mono: 'ui-monospace,Menlo,monospace' }[p.look.font];
    first.querySelectorAll('*').forEach(function (n) { if (n.children.length === 0 && String(n.textContent).trim() === String(m.title).trim()) n.style.fontFamily = fam; });
  }
}
// guest actions — each rewrites just its own piece of the plan
function _pbUpdate(id, path, val, then) {
  var up = {}; up[path] = val;
  window.db.collection('futureMoments').doc(id).update(up).then(function () {
    var m = (window._futureMomentsCache || {})[id];
    if (m) { var parts = path.split('.'), o = m; for (var i = 0; i < parts.length - 1; i++) { o[parts[i]] = o[parts[i]] || {}; o = o[parts[i]]; } o[parts[parts.length - 1]] = val; _pbDecorateDetail(m); }
    then && then();
  }).catch(function (e) { console.error('[plan] update', e); if (typeof ib_toast === 'function') ib_toast('Couldn\u2019t save that \u2014 try again'); });
}
function _pbM(id) { return typeof _findFutureMoment === 'function' ? _findFutureMoment(id) : null; }
function pbClaim(id, i) {
  var m = _pbM(id), me = _pbUid(); if (!m || !me) return;
  var list = JSON.parse(JSON.stringify((m.pb || {}).potluck || []));
  var it = list[i]; if (!it) return;
  it.by = it.by || [];
  var k = it.by.indexOf(me);
  if (k !== -1) it.by.splice(k, 1); else if (it.by.length < (it.need || 1)) it.by.push(me);
  _pbUpdate(id, 'pb.potluck', list);
}
function pbBring(id, i) { var m = _pbM(id), me = _pbUid(); if (!m) return; var list = JSON.parse(JSON.stringify((m.pb || {}).bring || [])); if (!list[i]) return; list[i].by = list[i].by === me ? null : (list[i].by || me); _pbUpdate(id, 'pb.bring', list); }
function pbVote(id, qi, oi) { var m = _pbM(id), me = _pbUid(); if (!m) return; var polls = JSON.parse(JSON.stringify((m.pb || {}).polls || [])); if (!polls[qi]) return; polls[qi].votes = polls[qi].votes || {}; if (polls[qi].votes[me] === oi) delete polls[qi].votes[me]; else polls[qi].votes[me] = oi; _pbUpdate(id, 'pb.polls', polls); }
function pbMeet(id, i) { var me = _pbUid(), m = _pbM(id); if (!m) return; var cur = ((m.pb || {}).meetAt || {})[me]; _pbUpdate(id, 'pb.meetAt.' + me, cur === i ? null : i); }
function pbRide(id, i) { var m = _pbM(id), me = _pbUid(); if (!m) return; var rides = JSON.parse(JSON.stringify((m.pb || {}).rides || [])); rides.forEach(function (r, j) { r.riders = (r.riders || []).filter(function (u) { return u !== me || j === i; }); }); var r = rides[i]; if (!r) return; var k = r.riders.indexOf(me); if (k !== -1) r.riders.splice(k, 1); else if (r.riders.length < (r.seats || 0)) r.riders.push(me); _pbUpdate(id, 'pb.rides', rides); }
function pbOfferRide(id) {
  var m = _pbM(id), me = _pbUid(); if (!m) return;
  var seats = parseInt(window.prompt('How many open seats?', '3'), 10); if (!seats || seats < 1) return;
  var from = window.prompt('Leaving from? (optional)', '') || '';
  var rides = JSON.parse(JSON.stringify((m.pb || {}).rides || []));
  rides = rides.filter(function (r) { return r.uid !== me; });
  rides.push({ id: _pbId('r'), uid: me, name: (window.userData && window.userData.name) || 'Me', seats: seats, from: from, riders: [] });
  _pbUpdate(id, 'pb.rides', rides);
}

// the plan screen gets the pieces above, right under its hero
(function () {
  if (typeof renderFutureView !== 'function') return;
  var orig = renderFutureView;
  renderFutureView = function (m) { var r = orig.apply(this, arguments); try { _pbDecorateDetail(m); } catch (e) { console.error('[plan builder] detail', e); } return r; };
})();

// ═══ PROBABLE STARTERS (v6.9.0) ═════════════════════════════════════════
// Upcoming MLB games (not live, not final): both announced starters head to
// head — W-L, ERA and IP side by side, the better number in each row green.
// One starter known: a row for him and "to be announced" for the other.
function _spUpcoming(g) { return !_isGameConcluded(g.status) && /scheduled|pre-game|warmup|delayed start/i.test(g.status || ''); }
function _spName(p, noHand) {
  var inner = '<span onclick="event.stopPropagation()">' + (typeof _clickablePlayerNameHtml === 'function' ? _clickablePlayerNameHtml({ id: p.id, name: p.name }, 'mlb') : _escapeHtml(p.name || '')) + '</span>';
  return inner + (p.hand && !noHand ? '<small>' + _escapeHtml(p.hand) + '</small>' : '');
}
function _spLine(p) {
  var b = [];
  if (p.w != null && p.l != null) b.push(p.w + '-' + p.l);
  if (p.era) b.push(p.era + ' ERA');
  if (p.ip) b.push(p.ip + ' IP');
  return b.join(' \u00b7 ');
}
function _spCardHtml(g) {
  var a = g.awayProbable, h = g.homeProbable;
  if (!_spUpcoming(g) || (!a && !h)) return '';
  if (a && h) {
    var num = function (x) { var n = parseFloat(x); return isNaN(n) ? null : n; };
    var cmp = function (x, y, lowWins) { x = num(x); y = num(y); if (x == null || y == null || x === y) return 0; return (lowWins ? x < y : x > y) ? 1 : -1; };
    var wl = function (p) { return p.w != null && p.l != null ? p.w - p.l : null; };
    var rows = [
      ['W-L', a.w != null ? a.w + '-' + a.l : '\u2014', h.w != null ? h.w + '-' + h.l : '\u2014', cmp(wl(a), wl(h), false)],
      ['ERA', a.era || '\u2014', h.era || '\u2014', cmp(a.era, h.era, true)],
      ['IP', a.ip || '\u2014', h.ip || '\u2014', cmp(a.ip, h.ip, false)]
    ];
    return '<div class="sp-h2h"><div class="hd">PROBABLE STARTERS</div><div class="g">' +
      '<span class="nm">' + _spName(a, true) + '</span><span></span><span class="nm r">' + _spName(h, true) + '</span>' +
      rows.map(function (r) { return '<span class="v' + (r[3] > 0 ? ' best' : '') + '">' + _escapeHtml(r[1]) + '</span><span class="k">' + r[0] + '</span><span class="v r' + (r[3] < 0 ? ' best' : '') + '">' + _escapeHtml(r[2]) + '</span>'; }).join('') + '</div></div>';
  }
  // only one announced
  var row = function (p, side) {
    var ab = side === 'away' ? (g.awayAbbr || _ghAbbrFallback(g.away || '')) : (g.homeAbbr || _ghAbbrFallback(g.home || ''));
    var c = typeof _ghTeamColors === 'function' ? _ghTeamColors(ab) : { bg: '#3D3580', fg: '#fff' };
    return '<div class="sp-row"><span class="lo" style="background:' + c.bg + ';color:' + c.fg + '">' + _escapeHtml(ab) + '</span>' +
      (p ? '<span class="t"><b>' + _spName(p) + '</b><span>' + _escapeHtml(_spLine(p)) + '</span></span>' : '<span class="tbd">Starter to be announced</span>') + '</div>';
  };
  return '<div class="sp-h2h"><div class="hd">PROBABLE STARTERS</div>' + row(a, 'away') + row(h, 'home') + '</div>';
}
