var _rsvp = 'going';

// Stage data for detail view — official 2026 set times, compiled July 31,
// 2026 from Outside Lands' released schedule (sfoutsidelands.com/schedule),
// cross-checked and corrected Aug 6, 2026 against the live schedule.
// Covers all 8 stages: the five main stages plus Dolores', Duboce
// Triangle, and Cocktail Magic.
var stageData = {
  fri: {
    'lands-end': {
      name: 'Lands End', emoji: '🎪', day: 'Friday Aug 7',
      acts: [
        {name:'Faouzia', time:'12:05–12:50 PM', headliner:false},
        {name:'Grace Ives', time:'1:20–2:05 PM', headliner:false},
        {name:'Durand Bernarr', time:'2:35–3:25 PM', headliner:false},
        {name:'Wet Leg', time:'3:55–4:45 PM', headliner:false},
        {name:'GloRilla', time:'5:15–6:00 PM', headliner:false},
        {name:'Labrinth', time:'6:30–7:40 PM', headliner:false},
        {name:'Charli XCX', time:'8:40–10:00 PM', headliner:true},
      ]
    },
    'soma': {
      name: 'SOMA', emoji: '🎧', day: 'Friday Aug 7',
      acts: [
        {name:'Vertigo', time:'12:00–12:55 PM', headliner:false},
        {name:'Luke Alessi', time:'12:55–2:25 PM', headliner:false},
        {name:'tobiahs', time:'2:25–3:55 PM', headliner:false},
        {name:'MPH', time:'3:55–5:25 PM', headliner:false},
        {name:'KI/KI', time:'5:25–6:55 PM', headliner:false},
        {name:'Yousuke Yukimatsu', time:'6:55–8:25 PM', headliner:false},
        {name:'Odd Mob & Omnom Present Hyperbeam', time:'8:25–9:55 PM', headliner:true},
      ]
    },
    'twin-peaks': {
      name: 'Twin Peaks', emoji: '🏔️', day: 'Friday Aug 7',
      acts: [
        {name:'NEZZA', time:'12:35–1:20 PM', headliner:false},
        {name:'Kerala Dust', time:'2:05–2:50 PM', headliner:false},
        {name:'ALLEYCVT', time:'3:35–4:25 PM', headliner:false},
        {name:'Tinashe', time:'5:10–6:00 PM', headliner:false},
        {name:'Clipse', time:'6:45–7:35 PM', headliner:false},
        {name:'GRiZTRONICS', time:'8:25–9:55 PM', headliner:true},
      ]
    },
    'sutro': {
      name: 'Sutro', emoji: '🌲', day: 'Friday Aug 7',
      acts: [
        {name:'Bad Nerves', time:'12:25–1:10 PM', headliner:false},
        {name:'Die Spitz', time:'1:40–2:25 PM', headliner:false},
        {name:'The Story So Far', time:'2:55–3:40 PM', headliner:false},
        {name:'Sierra Ferrell', time:'4:10–5:10 PM', headliner:false},
        {name:'Geese', time:'5:50–6:50 PM', headliner:false},
        {name:'Turnstile', time:'7:20–8:20 PM', headliner:false},
        {name:'Modest Mouse', time:'8:50–9:50 PM', headliner:true},
      ]
    },
    'panhandle': {
      name: 'Panhandle', emoji: '🎵', day: 'Friday Aug 7',
      acts: [
        {name:'Dani Satin & Always Hallways', time:'12:00–12:30 PM', headliner:false},
        {name:'Chezile', time:'1:20–2:00 PM', headliner:false},
        {name:'Sawyer Hill', time:'2:50–3:30 PM', headliner:false},
        {name:'Billie Marten', time:'4:25–5:05 PM', headliner:false},
        {name:'Goldie Boutilier', time:'6:00–6:40 PM', headliner:false},
        {name:'Dylan Brady', time:'7:35–8:20 PM', headliner:true},
      ]
    },
    'dolores': {
      name: "Dolores' x Hot Goth GF", emoji: '🌈', day: 'Friday Aug 7',
      acts: [
        {name:'DJ Erinyes', time:'12:30–1:15 PM', headliner:false},
        {name:'DJ Dolomedes', time:'1:15–2:00 PM', headliner:false},
        {name:'Pink Stiletto', time:'2:00–2:30 PM', headliner:false},
        {name:'DJ Starr Noir', time:'2:30–3:20 PM', headliner:false},
        {name:'Hot Goth Freak Show', time:'3:20–3:50 PM', headliner:false},
        {name:'Soltera', time:'3:50–4:35 PM', headliner:false},
        {name:'DJ Hopeless & Hot Goth Pole Show', time:'4:35–5:20 PM', headliner:false},
        {name:'Ms. Boan', time:'5:20–6:05 PM', headliner:false},
        {name:'Hot Goth Freak Show', time:'6:05–6:35 PM', headliner:false},
        {name:'Light Asylum', time:'6:45–7:30 PM', headliner:false},
        {name:'Romy (DJ Set)', time:'7:30–8:30 PM', headliner:true},
      ]
    },
    'duboce-triangle': {
      name: 'Duboce Triangle', emoji: '🎤', day: 'Friday Aug 7',
      acts: [
        {name:'NEZZA', time:'2:05–2:35 PM', headliner:false},
        {name:'Chezile', time:'3:25–3:55 PM', headliner:false},
        {name:'Luke Alessi', time:'4:45–5:15 PM', headliner:false},
        {name:'ALLEYCVT', time:'6:15–6:45 PM', headliner:false},
        {name:'tobiahs', time:'7:55–8:40 PM', headliner:true},
      ]
    },
    'cocktail-magic': {
      name: 'Cocktail Magic', emoji: '🍸', day: 'Friday Aug 7',
      acts: [
        {name:'BINGO LOCO', time:'12:30–1:15 PM', headliner:false},
        {name:'BINGO LOCO', time:'1:40–2:25 PM', headliner:false},
        {name:'BINGO LOCO', time:'2:50–3:35 PM', headliner:false},
        {name:'Open Mic hosted by Rainbow Girls', time:'4:05–4:50 PM', headliner:false},
        {name:'Bootie Mashup: Diva Pop w/ DJ Tyme', time:'5:05–6:05 PM', headliner:false},
        {name:'The Emo Night Tour', time:'6:20–7:20 PM', headliner:true},
      ]
    },
  },
  sat: {
    'lands-end': {
      name: 'Lands End', emoji: '🎪', day: 'Saturday Aug 8',
      acts: [
        {name:'Bandalos Chinos', time:'12:10–12:55 PM', headliner:false},
        {name:'Haute & Freddy', time:'1:25–2:10 PM', headliner:false},
        {name:'Audrey Hobert', time:'2:40–3:30 PM', headliner:false},
        {name:'Lucy Dacus', time:'4:00–4:50 PM', headliner:false},
        {name:'Ethel Cain', time:'5:20–6:20 PM', headliner:false},
        {name:'Djo', time:'6:50–7:50 PM', headliner:false},
        {name:'The Strokes', time:'8:35–9:55 PM', headliner:true},
      ]
    },
    'soma': {
      name: 'SOMA', emoji: '🎧', day: 'Saturday Aug 8',
      acts: [
        {name:'bad juuju', time:'12:35–1:55 PM', headliner:false},
        {name:'1-800 Girls', time:'1:55–3:25 PM', headliner:false},
        {name:'Camoufly', time:'3:25–4:55 PM', headliner:false},
        {name:'Sultan + Shepard', time:'4:55–6:25 PM', headliner:false},
        {name:'Ben Böhmer', time:'6:40–8:10 PM', headliner:false},
        {name:'Lane 8', time:'8:25–9:55 PM', headliner:true},
      ]
    },
    'twin-peaks': {
      name: 'Twin Peaks', emoji: '🏔️', day: 'Saturday Aug 8',
      acts: [
        {name:'Red Leather', time:'12:30–1:10 PM', headliner:false},
        {name:'After', time:'1:55–2:35 PM', headliner:false},
        {name:'Łaszewo', time:'3:10–4:00 PM', headliner:false},
        {name:'Malcolm Todd', time:'4:45–5:45 PM', headliner:false},
        {name:'Dijon', time:'6:30–7:20 PM', headliner:false},
        {name:'The xx', time:'8:10–9:25 PM', headliner:true},
      ]
    },
    'sutro': {
      name: 'Sutro', emoji: '🌲', day: 'Saturday Aug 8',
      acts: [
        {name:'Rio Kosta', time:'12:35–1:20 PM', headliner:false},
        {name:'Wunderhorse', time:'1:50–2:35 PM', headliner:false},
        {name:'Sienna Spiro', time:'3:05–3:50 PM', headliner:false},
        {name:'Yard Act', time:'4:20–5:05 PM', headliner:false},
        {name:'Snow Strippers', time:'5:35–6:20 PM', headliner:false},
        {name:'it\'s murph', time:'6:50–8:00 PM', headliner:false},
        {name:'PinkPantheress', time:'8:45–9:45 PM', headliner:true},
      ]
    },
    'panhandle': {
      name: 'Panhandle', emoji: '🎵', day: 'Saturday Aug 8',
      acts: [
        {name:'Ryman', time:'12:00–12:30 PM', headliner:false},
        {name:'Racing Mount Pleasant', time:'1:10–1:50 PM', headliner:false},
        {name:'Ally Evenson', time:'2:35–3:05 PM', headliner:false},
        {name:'Automatic', time:'4:00–4:40 PM', headliner:false},
        {name:'Silvana Estrada', time:'5:45–6:25 PM', headliner:false},
        {name:'DJ Trixie Mattel', time:'7:20–8:05 PM', headliner:true},
      ]
    },
    'dolores': {
      name: "Dolores' x OASIS", emoji: '🌈', day: 'Saturday Aug 8',
      acts: [
        {name:"OUT TONIGHT: A Musical Singalong feat. D'Arcy Drollinger", time:'12:30–1:30 PM', headliner:false},
        {name:'OASIS DJ Set: Beverly Chills', time:'1:30–2:15 PM', headliner:false},
        {name:'REPARATIONS w/ DJ Newoncé', time:'2:15–3:15 PM', headliner:false},
        {name:'REPARATIONS w/ Nicki Jizz feat. Kori King', time:'3:15–4:45 PM', headliner:false},
        {name:'OASIS DJ Set: DJ Ion The Prize', time:'4:45–5:45 PM', headliner:false},
        {name:'PRINCESS w/ Tito Soto feat. Lydia B Kollins', time:'5:45–7:15 PM', headliner:true},
      ]
    },
    'duboce-triangle': {
      name: 'Duboce Triangle', emoji: '🎤', day: 'Saturday Aug 8',
      acts: [
        {name:'TYCHO DJ SET', time:'12:15–1:45 PM', headliner:false},
        {name:'Bandalos Chinos', time:'2:10–2:40 PM', headliner:false},
        {name:'Racing Mount Pleasant', time:'3:30–4:00 PM', headliner:false},
        {name:'RIO KOSTA (DJ Set)', time:'4:50–5:20 PM', headliner:false},
        {name:'Łaszewo', time:'6:20–6:50 PM', headliner:false},
        {name:'bad juuju', time:'7:50–8:35 PM', headliner:true},
      ]
    },
    'cocktail-magic': {
      name: 'Cocktail Magic', emoji: '🍸', day: 'Saturday Aug 8',
      acts: [
        {name:'BINGO LOCO', time:'12:30–1:15 PM', headliner:false},
        {name:'BINGO LOCO', time:'1:40–2:25 PM', headliner:false},
        {name:'BINGO LOCO', time:'2:50–3:35 PM', headliner:false},
        {name:'Open Mic hosted by Rainbow Girls', time:'4:05–4:50 PM', headliner:false},
        {name:'Bootie Mashup: Hip Hop Fuego w/ DJ Airsun', time:'5:05–6:05 PM', headliner:false},
        {name:'Electric Feels', time:'6:20–7:20 PM', headliner:true},
      ]
    },
  },
  sun: {
    'lands-end': {
      name: 'Lands End', emoji: '🎪', day: 'Sunday Aug 9',
      acts: [
        {name:'SF Gay Men\'s Chorus', time:'12:00–12:40 PM', headliner:false},
        {name:'Sports', time:'1:10–1:55 PM', headliner:false},
        {name:'Balu Brigada', time:'2:25–3:15 PM', headliner:false},
        {name:'JADE', time:'3:45–4:45 PM', headliner:false},
        {name:'Disco Lines', time:'5:15–6:15 PM', headliner:false},
        {name:'Empire of the Sun', time:'6:45–7:45 PM', headliner:false},
        {name:'Rüfüs Du Sol', time:'8:25–9:55 PM', headliner:true},
      ]
    },
    'soma': {
      name: 'SOMA', emoji: '🎧', day: 'Sunday Aug 9',
      acts: [
        {name:'Etari', time:'12:05–1:35 PM', headliner:false},
        {name:'X Club.', time:'1:35–3:10 PM', headliner:false},
        {name:'Carlita', time:'3:10–4:45 PM', headliner:false},
        {name:'Boys Noize', time:'4:45–6:20 PM', headliner:false},
        {name:'Miss Monique', time:'6:20–7:55 PM', headliner:false},
        {name:'Boris Brejcha', time:'7:55–9:55 PM', headliner:true},
      ]
    },
    'twin-peaks': {
      name: 'Twin Peaks', emoji: '🏔️', day: 'Sunday Aug 9',
      acts: [
        {name:'Magnus Ferrell', time:'12:45–1:25 PM', headliner:false},
        {name:'sosocamo', time:'2:10–2:55 PM', headliner:false},
        {name:'DESTIN CONRAD', time:'3:40–4:30 PM', headliner:false},
        {name:'kwn', time:'5:15–6:05 PM', headliner:false},
        {name:'Mariah the Scientist', time:'6:50–7:50 PM', headliner:false},
        {name:'Baby Keem', time:'8:40–9:55 PM', headliner:true},
      ]
    },
    'sutro': {
      name: 'Sutro', emoji: '🌲', day: 'Sunday Aug 9',
      acts: [
        {name:'Death Cab for Cutie (early set)', time:'12:40–1:30 PM', headliner:false},
        {name:'Marlon Funaki', time:'1:50–2:30 PM', headliner:false},
        {name:'Momma', time:'3:00–3:45 PM', headliner:false},
        {name:'Kingfishr', time:'4:15–5:05 PM', headliner:false},
        {name:'The Temper Trap', time:'5:35–6:25 PM', headliner:false},
        {name:'Not for Radio', time:'7:05–7:55 PM', headliner:false},
        {name:'Death Cab for Cutie', time:'8:25–9:40 PM', headliner:true},
      ]
    },
    'panhandle': {
      name: 'Panhandle', emoji: '🎵', day: 'Sunday Aug 9',
      acts: [
        {name:'Cruz Beckham', time:'12:00–12:40 PM', headliner:false},
        {name:'Day We Ran', time:'1:25–2:05 PM', headliner:false},
        {name:'Amble', time:'2:55–3:35 PM', headliner:false},
        {name:'Night Tapes', time:'4:30–5:10 PM', headliner:false},
        {name:'Infinity Song', time:'6:05–6:45 PM', headliner:false},
        {name:'Frost Children', time:'7:50–8:35 PM', headliner:true},
      ]
    },
    'dolores': {
      name: "Dolores' x Polyglamorous", emoji: '🌈', day: 'Sunday Aug 9',
      acts: [
        {name:'Charles Hawthorne', time:'12:45–2:25 PM', headliner:false},
        {name:"Mark O'Brien", time:'2:25–3:45 PM', headliner:false},
        {name:'Grace Towers & Friends', time:'3:45–4:05 PM', headliner:false},
        {name:'Stanley Frank Sensation', time:'4:05–5:05 PM', headliner:false},
        {name:'BEYA', time:'5:05–6:05 PM', headliner:false},
        {name:'Grace Towers & Friends', time:'6:05–6:25 PM', headliner:false},
        {name:'Elaine & Robin', time:'6:25–7:25 PM', headliner:false},
        {name:'DJ Minx', time:'7:25–8:25 PM', headliner:true},
      ]
    },
    'duboce-triangle': {
      name: 'Duboce Triangle', emoji: '🎤', day: 'Sunday Aug 9',
      acts: [
        {name:'Britton', time:'2:05–2:35 PM', headliner:false},
        {name:'Day We Ran', time:'3:25–3:55 PM', headliner:false},
        {name:'Frost Children (DJ Set)', time:'4:45–5:30 PM', headliner:false},
        {name:'Marlon Funaki', time:'6:15–6:45 PM', headliner:false},
        {name:'Surprise Guest', time:'7:45–8:45 PM', headliner:true},
      ]
    },
    'cocktail-magic': {
      name: 'Cocktail Magic', emoji: '🍸', day: 'Sunday Aug 9',
      acts: [
        {name:'BINGO LOCO', time:'12:30–1:15 PM', headliner:false},
        {name:'BINGO LOCO', time:'1:40–2:25 PM', headliner:false},
        {name:'BINGO LOCO', time:'2:50–3:35 PM', headliner:false},
        {name:'Open Mic hosted by Rainbow Girls', time:'4:05–4:50 PM', headliner:false},
        {name:'Aidan Corcoran', time:'5:15–5:45 PM', headliner:false},
        {name:'Help Me Lose My Mind: UK Garage & House w/ MPHD', time:'6:00–7:00 PM', headliner:true},
      ]
    },
  },
};

var myRsvps = {}; // actName -> 'going'|'maybe'|'no'

// Background photo for each physical stage (same 5 stages recur Fri/Sat/Sun).
// Paste your own chosen image for each one — a URL to a hosted image (e.g. a file
// you commit to the GitHub repo and reference like 'images/stages/sutro.jpg', or
// any public image URL). Leave '' to keep the default gradient + emoji look.
var stageImages = {
  'lands-end': '',
  'soma': '',
  'twin-peaks': '',
  'sutro': '',
  'panhandle': ''
};

// Tints the stage-overview rows (the list you see before opening a stage) with a
// preview of that stage's background photo, if one has been set above.
function applyStageRowBackgrounds() {
  document.querySelectorAll('[onclick^="openStage("]').forEach(function(el){
    var match = el.getAttribute('onclick').match(/openStage\('([^']+)','([^']+)'\)/);
    if (!match) return;
    var img = stageImages[match[2]];
    if (!img) return;
    el.style.backgroundImage = 'linear-gradient(100deg,rgba(13,8,32,0.82),rgba(13,8,32,0.5)),url(' + img + ')';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
  });
}
applyStageRowBackgrounds();

// Same "who's going" pattern as the main OSL screen, scoped to one act.
// Reuses _attendeeRowHtml/_oslAttendeesEmptyHtml rather than duplicating them.
function openActAttendees() {
  if (!window._actDetailCurrent) return;
  var box = document.getElementById('osl-act-attendees-detail');
  if (box) box.style.display = 'flex';
  var titleEl = document.getElementById('act-attendees-title');
  if (titleEl) titleEl.textContent = "Who's going — " + window._actDetailCurrent.name;
  loadActAttendees();
}

function closeActAttendees() {
  var box = document.getElementById('osl-act-attendees-detail');
  if (box) box.style.display = 'none';
}

function actAttendeesTab(tab, evt) {
  evt = evt || window.event;
  document.querySelectorAll('.osl-act-att-tab').forEach(function(t){
    t.style.color = 'rgba(255,255,255,0.55)';
    t.style.fontWeight = '600';
    t.style.borderBottom = '2px solid transparent';
  });
  if (evt && evt.target) {
    evt.target.style.color = 'rgba(168,159,232,1)';
    evt.target.style.fontWeight = '700';
    evt.target.style.borderBottom = '2px solid rgba(168,159,232,0.9)';
  }
  var goingBox = document.getElementById('act-attendees-going');
  var pendingBox = document.getElementById('act-attendees-pending');
  if (goingBox) goingBox.style.display = tab === 'going' ? 'block' : 'none';
  if (pendingBox) pendingBox.style.display = tab === 'pending' ? 'block' : 'none';
}

function loadActAttendees() {
  var actName = window._actDetailCurrent && window._actDetailCurrent.name;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var goingBox = document.getElementById('act-attendees-going');
  var pendingBox = document.getElementById('act-attendees-pending');
  if (!actName || !user || !window.db) return;
  if (goingBox) goingBox.innerHTML = _oslAttendeesEmptyHtml('Loading…');
  if (pendingBox) pendingBox.innerHTML = '';
  window.db.collection('users').get().then(function(snap){
    if (!window._actDetailCurrent || window._actDetailCurrent.name !== actName) return; // a different act is open now
    var going = [], maybe = [], pending = [];
    snap.forEach(function(doc){
      var d = doc.data() || {};
      var isMe = doc.id === user.uid;
      var status = (d.oslActRsvps || {})[actName];
      var entry = { uid: doc.id, name: isMe ? 'You' : (d.name || 'Friend'), isMe: isMe };
      if (status === 'going') going.push(entry);
      else if (status === 'maybe') maybe.push(entry);
      else if (status !== 'no') pending.push(entry);
    });
    if (goingBox) {
      goingBox.innerHTML = (!going.length && !maybe.length)
        ? _oslAttendeesEmptyHtml("No one's confirmed yet — be the first.")
        : going.map(function(e){ return _attendeeRowHtml(e, 'Going', 'rgba(168,159,232,0.9)'); }).join('') +
          maybe.map(function(e){ return _attendeeRowHtml(e, 'Maybe', '#FEDF9A'); }).join('');
    }
    if (pendingBox) {
      pendingBox.innerHTML = pending.length
        ? pending.map(function(e){ return _attendeeRowHtml(e, '', ''); }).join('')
        : _oslAttendeesEmptyHtml('Everyone has responded.');
    }
  }).catch(function(err){
    console.error('Load act attendees error:', err);
    if (goingBox) goingBox.innerHTML = _oslAttendeesEmptyHtml('Could not load — check Firestore rules');
  });
}

function openStage(day, stageId) {
  var data = stageData[day] && stageData[day][stageId];
  if (!data) return;
  document.getElementById('stage-detail-name').textContent = data.emoji + '  ' + data.name;
  document.getElementById('stage-detail-day').textContent = data.day;

  var bgEl = document.getElementById('stage-detail-bg');
  if (bgEl) {
    var stageImg = stageImages[stageId];
    bgEl.innerHTML = stageImg
      ? '<div style="position:absolute;inset:0;background-image:url(' + stageImg + ');background-size:cover;background-position:center"></div>'
      : '<div style="position:absolute;inset:0;background:linear-gradient(135deg,#3D3580,#1A1640);display:flex;align-items:center;justify-content:center;font-size:130px;opacity:0.18">' + (data.emoji || '🎪') + '</div>';
  }

  var actsEl = document.getElementById('stage-detail-acts');
  actsEl.innerHTML = '';

  if (data.predicted || data.timesTBD) {
    var banner = document.createElement('div');
    banner.style.cssText = 'background:rgba(255,193,133,0.12);border:0.5px solid rgba(255,193,133,0.25);border-radius:10px;padding:9px 12px;margin-bottom:12px;font-size:11px;color:rgba(255,193,133,0.9);line-height:1.4';
    banner.textContent = data.predicted
      ? '⚠ Predicted lineup — Outside Lands hasn\'t released official stage assignments yet. This is a fan-sourced guess.'
      : '✓ Stage is official — exact set times haven\'t been released yet.';
    actsEl.appendChild(banner);
  }

  loadOslFriendRsvps(function(){
  data.acts.forEach(function(act) {
    var rsvp = myRsvps[act.name] || '';
    var hasImg = !!act.image;
    var safeName = act.name.replace(/'/g, "\\'");
    var safeTime = (act.time || '').replace(/'/g, "\\'");
    var div = document.createElement('div');
    div.style.cssText = hasImg
      ? 'margin-bottom:10px;border-radius:14px;overflow:hidden;background-image:linear-gradient(180deg,rgba(13,8,32,0.15),rgba(13,8,32,0.88)),url(' + act.image + ');background-size:cover;background-position:center'
      : 'margin-bottom:10px;border-radius:14px;background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.1)';
    div.innerHTML = '<div onclick="openActDetail(\'' + safeName + '\',\'' + safeTime + '\',' + (act.headliner ? 'true' : 'false') + ')" style="display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;' + (hasImg ? 'padding:18px 16px 10px' : 'padding:14px 16px 10px') + '">' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:' + (act.headliner ? '16' : '15') + 'px;font-weight:' + (act.headliner ? '700' : '600') + ';color:white">' + act.name + '</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:2px">' + act.time + (act.headliner ? ' · Headliner' : '') + ' · tap for chat & who\'s going</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">' +
        (act.headliner ? '<div style="background:rgba(168,159,232,0.9);color:#0D0820;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px">HEADLINER</div>' : '') +
        _friendClusterHtml(act.name) +
        '<svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 1 6 6 1 11"/></svg>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:6px;padding:0 14px 14px" data-act="' + act.name + '">' +
      '<button onclick="actRsvp2(this,\'' + act.name + '\',\'going\')" style="flex:1;padding:7px 4px;border-radius:10px;background:' + (rsvp==='going' ? 'rgba(74,222,128,0.92)' : 'rgba(74,222,128,0.14)') + ';color:' + (rsvp==='going' ? '#052E10' : 'rgba(74,222,128,0.9)') + ';border:1px solid rgba(74,222,128,' + (rsvp==='going' ? '1' : '0.45') + ');font-size:12px;font-weight:' + (rsvp==='going' ? '700' : '600') + ';cursor:pointer;font-family:inherit">✓ Going</button>' +
      '<button onclick="actRsvp2(this,\'' + act.name + '\',\'maybe\')" style="flex:1;padding:7px 4px;border-radius:10px;background:' + (rsvp==='maybe' ? 'rgba(252,211,77,0.92)' : 'rgba(252,211,77,0.14)') + ';color:' + (rsvp==='maybe' ? '#332404' : 'rgba(252,211,77,0.9)') + ';border:1px solid rgba(252,211,77,' + (rsvp==='maybe' ? '1' : '0.45') + ');font-size:12px;font-weight:' + (rsvp==='maybe' ? '700' : '600') + ';cursor:pointer;font-family:inherit">? Maybe</button>' +
      '<button onclick="actRsvp2(this,\'' + act.name + '\',\'no\')" style="flex:1;padding:7px 4px;border-radius:10px;background:' + (rsvp==='no' ? 'rgba(248,113,113,0.92)' : 'rgba(248,113,113,0.14)') + ';color:' + (rsvp==='no' ? '#330A0A' : 'rgba(248,113,113,0.9)') + ';border:1px solid rgba(248,113,113,' + (rsvp==='no' ? '1' : '0.45') + ');font-size:12px;font-weight:' + (rsvp==='no' ? '700' : '600') + ';cursor:pointer;font-family:inherit">✕ Skip</button>' +
    '</div>';
    actsEl.appendChild(div);
  });
  });

  document.getElementById('osl2-stage-detail').style.display = 'flex';
  document.getElementById('osl2-stage-detail').style.flexDirection = 'column';
}

function closeStage() {
  document.getElementById('osl2-stage-detail').style.display = 'none';
}

function actRsvp2(btn, actName, val) {
  var _prevRsvp = myRsvps[actName];
  myRsvps[actName] = val;
  var row = btn.parentNode;
  var btns = row.querySelectorAll('button');
  // Same palette as the card template in openStage() — going/maybe/no in
  // that fixed order, since that's the DOM order the three buttons render in
  var palette = [
    { unselBg: 'rgba(74,222,128,0.14)',   unselColor: 'rgba(74,222,128,0.9)',   unselBorder: 'rgba(74,222,128,0.45)',   selBg: 'rgba(74,222,128,0.92)',   selColor: '#052E10', selBorder: 'rgba(74,222,128,1)' },
    { unselBg: 'rgba(252,211,77,0.14)',   unselColor: 'rgba(252,211,77,0.9)',   unselBorder: 'rgba(252,211,77,0.45)',   selBg: 'rgba(252,211,77,0.92)',   selColor: '#332404', selBorder: 'rgba(252,211,77,1)' },
    { unselBg: 'rgba(248,113,113,0.14)',  unselColor: 'rgba(248,113,113,0.9)',  unselBorder: 'rgba(248,113,113,0.45)',  selBg: 'rgba(248,113,113,0.92)',  selColor: '#330A0A', selBorder: 'rgba(248,113,113,1)' }
  ];
  var valOrder = ['going', 'maybe', 'no'];
  btns.forEach(function(b, i) {
    var p = palette[i];
    var isSelected = valOrder[i] === val;
    b.style.background = isSelected ? p.selBg : p.unselBg;
    b.style.color = isSelected ? p.selColor : p.unselColor;
    b.style.borderColor = isSelected ? p.selBorder : p.unselBorder;
    b.style.fontWeight = isSelected ? '700' : '600';
  });
  updateMyFest();
  window.userData = window.userData || {};
  window.userData.oslActRsvps = myRsvps;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (user && window.db) {
    window.db.collection('users').doc(user.uid).set({ oslActRsvps: myRsvps }, { merge: true })
      .then(function(){ if (_prevRsvp !== val) _postActRsvpSystemMessage(actName, val); })
      .catch(function(err){ console.error('Act RSVP save error:', err); if (typeof ib_toast==='function') ib_toast('Could not save — try again'); });
  }
}

// Drops a small activity line into the act's own activity feed ("Jason is
// going ✓") whenever someone marks Going or Maybe, so the Activity tab
// doubles as a log of who's committed to an act — not just a message
// thread. Also mirrors into the main OSL Feed (same pattern chat messages
// already use) so it surfaces there too. Skipped for "no"/skip to keep
// both feeds from filling with negative RSVPs, and only fires on an actual
// change (guarded by the caller).
function _postActRsvpSystemMessage(actName, val) {
  if (val !== 'going' && val !== 'maybe') return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  var author = (window.userData && window.userData.name) || 'Someone';
  var actId = _slugifyAct(actName);
  var verb = val === 'going' ? 'is going ✓' : 'might go';
  window.db.collection('actChat').add({ actId: actId, actName: actName, uid: user.uid, author: author, text: author + ' ' + verb, ts: Date.now(), system: true, systemType: 'rsvp' })
    .catch(function(err){ console.error('Post act RSVP activity message error:', err); });
  _postOslFeedNotice({ uid: user.uid, author: author, systemType: 'rsvp', text: val === 'going' ? 'is going' : 'might go', actName: actName });
}

// ── FRIEND OSL ATTENDANCE — fetched once per session (not once per act),
// then cross-referenced client-side against every act. Showing "which
// friends are going" across dozens of acts at once would mean dozens of
// Firestore queries otherwise; this way it's one query per friend, done
// once, cached, and reused everywhere the capped avatar cluster shows up.
window._oslFriendRsvps = null; // actName -> [{uid, name, status}]
window._oslFriendRsvpsLoading = false;

function loadOslFriendRsvps(cb) {
  if (window._oslFriendRsvps) { if (cb) cb(); return; }
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { window._oslFriendRsvps = {}; if (cb) cb(); return; }
  if (window._oslFriendRsvpsLoading) {
    var check = setInterval(function(){
      if (window._oslFriendRsvps) { clearInterval(check); if (cb) cb(); }
    }, 150);
    return;
  }
  window._oslFriendRsvpsLoading = true;
  Promise.all([
    window.db.collection('friendRequests').where('fromUid','==',user.uid).where('status','==','accepted').get(),
    window.db.collection('friendRequests').where('toUid','==',user.uid).where('status','==','accepted').get()
  ]).then(function(results){
    var uids = [];
    results[0].forEach(function(d){ uids.push(d.data().toUid); });
    results[1].forEach(function(d){ uids.push(d.data().fromUid); });
    uids = uids.filter(function(v,i){ return uids.indexOf(v) === i; });
    if (!uids.length) { window._oslFriendRsvps = {}; window._oslFriendRsvpsLoading = false; if (cb) cb(); return; }
    return Promise.all(uids.map(function(uid){ return window.db.collection('users').doc(uid).get(); })).then(function(docs){
      var index = {};
      docs.forEach(function(doc){
        var d = doc.data() || {};
        var rsvps = d.oslActRsvps || {};
        var nm = d.name || 'Friend';
        Object.keys(rsvps).forEach(function(actName){
          var status = rsvps[actName];
          if (status !== 'going' && status !== 'maybe') return;
          index[actName] = index[actName] || [];
          index[actName].push({ uid: doc.id, name: nm, status: status });
        });
      });
      window._oslFriendRsvps = index;
      window._oslFriendRsvpsLoading = false;
      if (cb) cb();
    });
  }).catch(function(err){
    console.error('Load friend OSL RSVPs error:', err);
    window._oslFriendRsvps = {};
    window._oslFriendRsvpsLoading = false;
    if (cb) cb();
  });
}

// Capped avatar cluster (max 3 + "+N"), or '' if no friends are on this
// act at all — deliberately renders nothing rather than an empty slot, so
// a list of acts doesn't turn into a checklist of blanks.
var _OSL_CLUSTER_COLORS = ['av-a', 'av-b', 'av-c'];
function _friendClusterHtml(actName) {
  var friends = (window._oslFriendRsvps || {})[actName];
  if (!friends || !friends.length) return '';
  var shown = friends.slice(0, 3);
  var extra = friends.length - shown.length;
  var avatars = shown.map(function(f, i){
    var colorClass = _OSL_CLUSTER_COLORS[i % _OSL_CLUSTER_COLORS.length];
    return '<div class="av ' + colorClass + '" style="width:20px;height:20px;font-size:8px;border:2px solid rgba(13,8,32,0.5);' + (i === 0 ? 'margin-left:0' : 'margin-left:-6px') + '">' + _escapeHtml(_initialsFallback(f.name)) + '</div>';
  }).join('');
  var extraHtml = extra > 0 ? '<span style="font-size:9.5px;color:rgba(255,255,255,0.5);margin-left:4px;font-weight:700">+' + extra + '</span>' : '';
  return '<div style="display:flex;align-items:center;flex-shrink:0;padding:2px 3px 2px 2px">' + avatars + extraHtml + '</div>';
}

// Your Festival renders all three days in one continuous scroll (Fri,
// then Sat, then Sun) rather than day tabs like Lineup — which meant it
// always opened at the top (Friday) regardless of what day it actually
// was. This jumps the scroll position to today's section right after
// updateMyFest renders it, using getBoundingClientRect deltas rather than
// offsetTop so it's correct regardless of any intermediate positioned
// ancestors. Leaves scroll position untouched if today isn't a festival
// day, or if today's section has no picks (and so was never rendered).
function _scrollMyFestToToday() {
  var todayKey = null;
  Object.keys(OSL_DAY_DATES).forEach(function(k){ if (OSL_DAY_DATES[k] === _todayLocal()) todayKey = k; });
  if (!todayKey) return;
  var container = document.getElementById('osl2-myfest');
  var hdr = document.querySelector('#myfest-list [data-day-key="' + todayKey + '"]');
  if (!container || !hdr) return;
  requestAnimationFrame(function(){
    var containerRect = container.getBoundingClientRect();
    var hdrRect = hdr.getBoundingClientRect();
    var delta = hdrRect.top - containerRect.top;
    container.scrollTop = container.scrollTop + delta - 12;
  });
}

function updateMyFest() {
  var listEl = document.getElementById('myfest-list');
  var emptyEl = document.getElementById('myfest-empty');
  var ctaEl = document.getElementById('myfest-compare-cta');
  var barEl = document.getElementById('myfest-compare-bar');

  // Find time/stage/headliner/day for each act — shared by both modes
  var allActs = {};
  Object.keys(stageData).forEach(function(day) {
    Object.keys(stageData[day]).forEach(function(stage) {
      stageData[day][stage].acts.forEach(function(act) {
        allActs[act.name] = {time: act.time, stage: stageData[day][stage].name, day: stageData[day][stage].day, dayKey: day, headliner: !!act.headliner};
      });
    });
  });

  // Sorts by end time (not start) so a headliner whose set runs later ends
  // up last even if another act started earlier — _actEndMinutes is global.
  function _sortRowsByTime(rowsToSort){
    rowsToSort.sort(function(a, b){
      return _actEndMinutes((allActs[a.name]||{}).time) - _actEndMinutes((allActs[b.name]||{}).time);
    });
  }
  // Groups rows into Friday/Saturday/Sunday sections rather than one mixed
  // list — acts with no day info on file (shouldn't normally happen) fall
  // into their own trailing section instead of being silently dropped.
  // Shared by both normal and compare mode so day-grouping/sorting only
  // exists in one place.
  function _renderDayGroups(rows, rowRenderer, dayExtraRenderer, betweenRenderer) {
    var dayOrder = ['fri', 'sat', 'sun'];
    var groups = {};
    var otherRows = [];
    rows.forEach(function(row){
      var info = allActs[row.name] || {};
      if (info.dayKey) {
        groups[info.dayKey] = groups[info.dayKey] || [];
        groups[info.dayKey].push(row);
      } else {
        otherRows.push(row);
      }
    });
    Object.keys(groups).forEach(function(dayKey){ _sortRowsByTime(groups[dayKey]); });
    _sortRowsByTime(otherRows);
    dayOrder.forEach(function(dayKey){
      var dayRows = groups[dayKey];
      if (!dayRows || !dayRows.length) return;
      var firstStageKey = Object.keys(stageData[dayKey])[0];
      var label = stageData[dayKey][firstStageKey].day;
      var hdr = document.createElement('div');
      hdr.setAttribute('data-day-key', dayKey);
      hdr.style.cssText = 'font-size:11px;font-weight:700;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.08em;margin:16px 0 8px';
      hdr.textContent = label;
      listEl.appendChild(hdr);
      if (dayExtraRenderer) {
        var extraHtml = dayExtraRenderer(dayKey, dayRows);
        if (extraHtml) {
          var extraWrap = document.createElement('div');
          extraWrap.innerHTML = extraHtml;
          while (extraWrap.firstChild) listEl.appendChild(extraWrap.firstChild);
        }
      }
      dayRows.forEach(function(row, i){
        if (i > 0 && betweenRenderer) {
          var betweenHtml = betweenRenderer(dayRows[i - 1], row);
          if (betweenHtml) {
            var bWrap = document.createElement('div');
            bWrap.innerHTML = betweenHtml;
            while (bWrap.firstChild) listEl.appendChild(bWrap.firstChild);
          }
        }
        listEl.appendChild(rowRenderer(row));
      });
    });
    otherRows.forEach(function(row){ listEl.appendChild(rowRenderer(row)); });
  }

  var friend = window._compareFriendId ? (window._compareFriendsCache || []).filter(function(f){ return f.uid === window._compareFriendId; })[0] : null;
  if (ctaEl) ctaEl.style.display = friend ? 'none' : 'flex';
  if (barEl) barEl.style.display = friend ? 'block' : 'none';

  if (friend) {
    // ── COMPARE MODE — union of your going/maybe acts and theirs ──
    var allNames = {};
    Object.keys(myRsvps).forEach(function(n){ if (myRsvps[n] === 'going' || myRsvps[n] === 'maybe') allNames[n] = true; });
    Object.keys(friend.actRsvps).forEach(function(n){ if (friend.actRsvps[n] === 'going' || friend.actRsvps[n] === 'maybe') allNames[n] = true; });
    var allRows = Object.keys(allNames).map(function(n){ return { name: n, you: myRsvps[n] || null, them: friend.actRsvps[n] || null }; });

    var sharedCount = 0, onlyYouCount = 0, onlyThemCount = 0;
    allRows.forEach(function(r){
      if (r.you && r.them) sharedCount++;
      else if (r.you && !r.them) onlyYouCount++;
      else if (!r.you && r.them) onlyThemCount++;
    });
    var sEl = document.getElementById('cmp-stat-shared-n');
    var yEl = document.getElementById('cmp-stat-you-n');
    var tEl = document.getElementById('cmp-stat-them-n');
    if (sEl) sEl.textContent = sharedCount;
    if (yEl) yEl.textContent = onlyYouCount;
    if (tEl) tEl.textContent = onlyThemCount;

    var filter = window._compareFilter || 'all';
    var filteredRows = allRows.filter(function(r){
      var bucket = (r.you && r.them) ? 'shared' : (r.you && !r.them) ? 'you' : (!r.you && r.them) ? 'them' : 'neither';
      return filter === 'all' || bucket === filter;
    });

    if (!filteredRows.length) {
      emptyEl.style.display = 'none';
      listEl.style.display = 'flex';
      listEl.innerHTML = '<div style="text-align:center;padding:40px 24px;color:rgba(255,255,255,0.35);font-size:13px;line-height:1.6">Nothing in this category — tap the filter again to see everything.</div>';
      return;
    }
    emptyEl.style.display = 'none';
    listEl.style.display = 'flex';
    listEl.innerHTML = '';

    function _cmpColor(status) {
      if (status === 'going') return 'rgba(168,159,232,0.95)';
      if (status === 'maybe') return '#FEDF9A';
      return 'rgba(255,255,255,0.15)';
    }
    function renderCompareRow(row) {
      var info = allActs[row.name] || {};
      var div = document.createElement('div');
      div.style.cssText = 'background:rgba(255,255,255,0.06);border-radius:14px;padding:13px 14px;border:0.5px solid rgba(255,255,255,0.1);display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:8px';
      div.onclick = function(){ openActDetail(row.name, info.time, info.headliner); };
      var friendInitial = (friend.name || '?').charAt(0).toUpperCase();
      div.innerHTML = '<div style="flex:1;min-width:0">' +
          '<div style="font-size:14px;font-weight:700;color:white">' + _escapeHtml(row.name) + '</div>' +
          '<div style="font-size:11.5px;color:rgba(255,255,255,0.4);margin-top:2px">' + _escapeHtml((info.stage || '') + ' · ' + (info.time || 'TBD')) + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">' +
          '<div style="display:flex;flex-direction:column;align-items:center">' +
            '<div style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.1);border:2px solid ' + _cmpColor(row.you) + ';display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;color:white">' + (row.you ? 'Y' : '–') + '</div>' +
            '<div style="font-size:8px;font-weight:700;color:rgba(255,255,255,0.3);margin-top:3px;text-transform:uppercase;letter-spacing:0.02em">You</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;align-items:center">' +
            '<div style="width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,0.1);border:2px solid ' + _cmpColor(row.them) + ';display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:700;color:white">' + (row.them ? _escapeHtml(friendInitial) : '–') + '</div>' +
            '<div style="font-size:8px;font-weight:700;color:rgba(255,255,255,0.3);margin-top:3px;text-transform:uppercase;letter-spacing:0.02em;max-width:44px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml((friend.name || '').split(' ')[0]) + '</div>' +
          '</div>' +
        '</div>';
      return div;
    }
    _renderDayGroups(filteredRows, renderCompareRow);
    return;
  }

  // ── NORMAL MODE — your own going/maybe picks ──
  var going = Object.keys(myRsvps).filter(function(k){ return myRsvps[k] === 'going'; });
  var maybe = Object.keys(myRsvps).filter(function(k){ return myRsvps[k] === 'maybe'; });
  if (going.length === 0 && maybe.length === 0) {
    listEl.style.display = 'none';
    emptyEl.style.display = 'flex';
    return;
  }
  emptyEl.style.display = 'none';
  listEl.style.display = 'flex';
  listEl.innerHTML = '';
  var rows = going.map(function(n){ return {name: n, status: 'going'}; }).concat(maybe.map(function(n){ return {name: n, status: 'maybe'}; }));

  // ── TIME CONFLICTS — any two Going/Maybe acts whose sets overlap.
  // Checked per day (acts on different days can never conflict) once,
  // up front, so both the VS cards and the row warning badges below can
  // share the same pass instead of recomputing it twice.
  function _fmtMinutesLabel(m) {
    var h = Math.floor(m / 60), min = m % 60;
    var suf = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + (min ? ':' + (min < 10 ? '0' : '') + min : '') + ' ' + suf;
  }
  function findFestivalConflicts(dayRows) {
    var found = [];
    for (var i = 0; i < dayRows.length; i++) {
      for (var j = i + 1; j < dayRows.length; j++) {
        var a = dayRows[i], b = dayRows[j];
        var ia = allActs[a.name] || {}, ib = allActs[b.name] || {};
        if (!ia.time || !ib.time) continue;
        var aStart = _actStartMinutes(ia.time), aEnd = _actEndMinutes(ia.time);
        var bStart = _actStartMinutes(ib.time), bEnd = _actEndMinutes(ib.time);
        if (aStart < bEnd && bStart < aEnd) {
          found.push({
            a: a, b: b,
            severity: (a.status === 'going' && b.status === 'going') ? 'hard' : 'soft',
            overlapStart: Math.max(aStart, bStart),
            overlapEnd: Math.min(aEnd, bEnd)
          });
        }
      }
    }
    return found;
  }
  var conflictsByDay = {};
  var conflictSeverityByName = {};
  (function precomputeConflicts(){
    var byDay = {};
    rows.forEach(function(row){
      var info = allActs[row.name] || {};
      if (info.dayKey) { (byDay[info.dayKey] = byDay[info.dayKey] || []).push(row); }
    });
    Object.keys(byDay).forEach(function(dayKey){
      var found = findFestivalConflicts(byDay[dayKey]);
      if (found.length) conflictsByDay[dayKey] = found;
      found.forEach(function(c){
        if (!conflictSeverityByName[c.a.name] || c.severity === 'hard') conflictSeverityByName[c.a.name] = c.severity;
        if (!conflictSeverityByName[c.b.name] || c.severity === 'hard') conflictSeverityByName[c.b.name] = c.severity;
      });
    });
  })();

  function renderConflictCards(dayKey) {
    var conflicts = conflictsByDay[dayKey];
    if (!conflicts || !conflicts.length) return '';
    function sideHtml(act, other) {
      var info = allActs[act.name] || {};
      var isGoing = act.status === 'going';
      var clusterHtml = _friendClusterHtml(act.name);
      return '<div onclick="chooseFestivalAct(\'' + dayKey + '\',\'' + act.name.replace(/'/g,"\\'") + '\',\'' + other.name.replace(/'/g,"\\'") + '\')" style="flex:1;min-width:0;cursor:pointer;border-radius:12px;padding:10px;background:rgba(255,255,255,0.05)">' +
        '<div style="font-size:14px;font-weight:800;color:white;letter-spacing:-0.2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(act.name) + '</div>' +
        '<div style="font-size:10.5px;color:rgba(255,255,255,0.4);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml((info.stage || '') + ' · ' + (info.time || '')) + '</div>' +
        '<div style="display:inline-block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;padding:2px 7px;border-radius:6px;margin-top:6px;' + (isGoing ? 'background:rgba(168,159,232,0.2);color:rgba(168,159,232,0.95)' : 'background:rgba(254,223,154,0.18);color:#FEDF9A') + '">' + (isGoing ? 'Going' : 'Maybe') + '</div>' +
        (clusterHtml ? '<div style="margin-top:7px">' + clusterHtml + '</div>' : '') +
      '</div>';
    }
    return conflicts.map(function(c){
      var sev = c.severity;
      var flagText = sev === 'hard' ? "⚠ You're marked Going to both" : '💡 Overlaps if this Maybe happens';
      return '<div style="border-radius:16px;padding:14px;margin-bottom:10px;' + (sev === 'hard' ? 'background:rgba(255,107,107,0.1);border:1px solid rgba(255,107,107,0.35)' : 'background:rgba(254,223,154,0.08);border:1px solid rgba(254,223,154,0.28)') + '">' +
        '<div style="display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;margin-bottom:2px;color:' + (sev === 'hard' ? '#FF6B6B' : '#FEDF9A') + '">' + flagText + '</div>' +
        '<div style="font-size:10.5px;color:rgba(255,255,255,0.35);margin-bottom:10px">Tap the one you\'re going with</div>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          sideHtml(c.a, c.b) +
          '<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:900;flex-shrink:0;' + (sev === 'hard' ? 'background:#FF6B6B;color:white' : 'background:#FEDF9A;color:#0D0820') + '">VS</div>' +
          sideHtml(c.b, c.a) +
        '</div>' +
        '<div style="text-align:center;font-size:11px;color:rgba(255,255,255,0.4);margin-top:10px">Overlapping <b style="color:rgba(255,255,255,0.7);font-weight:700">' + _fmtMinutesLabel(c.overlapStart) + '–' + _fmtMinutesLabel(c.overlapEnd) + '</b></div>' +
      '</div>';
    }).join('');
  }

  function renderFestRow(row) {
    var actName = row.name;
    var info = allActs[actName] || {};
    var isGoing = row.status === 'going';
    var sev = conflictSeverityByName[actName];
    var div = document.createElement('div');
    div.style.cssText = 'background:rgba(255,255,255,0.06);border-radius:14px;padding:14px 16px;border:0.5px solid ' + (sev === 'hard' ? 'rgba(255,107,107,0.4)' : sev === 'soft' ? 'rgba(254,223,154,0.35)' : 'rgba(255,255,255,0.1)') + ';display:flex;align-items:center;gap:12px;cursor:pointer;margin-bottom:8px';
    div.onclick = function(){ openActDetail(actName, info.time, info.headliner); };
    var icon = isGoing
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(168,159,232,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<span style="font-size:15px;font-weight:800;color:rgba(254,213,133,0.9)">?</span>';
    var clusterHtml = _friendClusterHtml(actName);
    var rightHtml = clusterHtml || ('<div style="font-size:10px;font-weight:700;color:' + (isGoing ? 'rgba(168,159,232,0.9)' : 'rgba(254,213,133,0.9)') + ';text-transform:uppercase;letter-spacing:0.06em;flex-shrink:0">' + (isGoing ? 'Going' : 'Maybe') + '</div>');
    var flagHtml = sev ? '<div style="position:absolute;top:-5px;right:-5px;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;border:2px solid #0D0820;' + (sev === 'hard' ? 'background:#FF6B6B' : 'background:#FEDF9A;color:#0D0820') + '">' + (sev === 'hard' ? '!' : '?') + '</div>' : '';
    div.innerHTML = '<div style="width:40px;height:40px;border-radius:10px;background:' + (isGoing ? 'rgba(168,159,232,0.2)' : 'rgba(254,213,133,0.15)') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;position:relative">' + icon + flagHtml + '</div>' +
      '<div style="flex:1"><div style="font-size:14px;font-weight:700;color:white">' + actName + '</div>' +
      '<div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:2px">' + (info.stage || '') + ' · ' + (info.time || 'TBD') + '</div></div>' +
      rightHtml;
    return div;
  }

  // A thin connector between consecutive Going acts on different stages —
  // Maybe acts are skipped entirely, since this is about the sets you've
  // actually committed to, not ones you might attend. Silently renders
  // nothing if either act is missing lineup data, or the stage pair isn't
  // in OSL_WALK_MINUTES, rather than guessing at a number.
  function renderWalkConnector(prevRow, nextRow) {
    if (prevRow.status !== 'going' || nextRow.status !== 'going') return '';
    var prevInfo = allActs[prevRow.name] || {};
    var nextInfo = allActs[nextRow.name] || {};
    if (!prevInfo.time || !nextInfo.time || !prevInfo.stage || !nextInfo.stage) return '';

    if (prevInfo.stage === nextInfo.stage) {
      return '<div style="position:relative;display:flex;align-items:center;height:30px;margin-left:34px">' +
        '<div style="position:absolute;left:0;top:-6px;bottom:-6px;width:2px;background:rgba(255,255,255,0.1)"></div>' +
        '<div style="margin-left:18px;font-size:11px;color:rgba(255,255,255,0.3)">No walk needed — same stage</div>' +
      '</div>';
    }

    var walk = _oslWalkMinutes(prevInfo.stage, nextInfo.stage);
    if (walk === null) return '';

    var gapMinutes = _actStartMinutes(nextInfo.time) - _actEndMinutes(prevInfo.time);
    var buffer = gapMinutes - walk;
    var color = buffer >= 15 ? 'rgba(126,217,168,0.95)' : buffer >= 0 ? '#FEDF9A' : '#FF6B6B';
    var verdict = buffer >= 0 ? (_fmtWalkDuration(buffer) + ' to spare') : (_fmtWalkDuration(buffer) + ' short');

    return '<div style="position:relative;display:flex;align-items:center;height:34px;margin-left:34px">' +
      '<div style="position:absolute;left:0;top:-8px;bottom:-8px;width:2px;background:rgba(255,255,255,0.12)"></div>' +
      '<div style="margin-left:18px;display:flex;align-items:center;gap:7px;font-size:12px">' +
        '<span style="color:rgba(255,255,255,0.45);font-weight:600">🚶 ~' + _fmtWalkDuration(walk) + '</span>' +
        '<span style="color:rgba(255,255,255,0.25)">·</span>' +
        '<span style="color:' + color + ';font-weight:700">' + verdict + '</span>' +
      '</div>' +
    '</div>';
  }

  _renderDayGroups(rows, renderFestRow, function(dayKey){ return renderConflictCards(dayKey); }, renderWalkConnector);
}

// Tapping a side of a conflict card resolves it: that act becomes Going,
// the other becomes Skip — the same outcome regardless of whether it was
// a hard conflict (both already Going) or a soft one (one was only a
// Maybe), so the behavior stays simple and predictable either way.
window._festivalLastAction = null;

function chooseFestivalAct(dayKey, chosenName, otherName) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  window._festivalLastAction = { chosenName: chosenName, prevChosen: myRsvps[chosenName], otherName: otherName, prevOther: myRsvps[otherName] };
  myRsvps[chosenName] = 'going';
  myRsvps[otherName] = 'no';
  window.userData = window.userData || {};
  window.userData.oslActRsvps = myRsvps;
  window.db.collection('users').doc(user.uid).set({ oslActRsvps: myRsvps }, { merge: true }).catch(function(err){ console.error('Choose festival act error:', err); });
  if (window._festivalLastAction.prevChosen !== 'going' && typeof _postActRsvpSystemMessage === 'function') {
    _postActRsvpSystemMessage(chosenName, 'going');
  }
  updateMyFest();
  _showFestivalUndoToast('Going to ' + chosenName + ' · Skipped ' + otherName);
}

function undoFestivalChoice() {
  var act = window._festivalLastAction;
  if (!act) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  myRsvps[act.chosenName] = act.prevChosen;
  myRsvps[act.otherName] = act.prevOther;
  window.userData = window.userData || {};
  window.userData.oslActRsvps = myRsvps;
  if (user && window.db) {
    window.db.collection('users').doc(user.uid).set({ oslActRsvps: myRsvps }, { merge: true }).catch(function(err){ console.error('Undo festival choice error:', err); });
  }
  window._festivalLastAction = null;
  _hideFestivalUndoToast();
  updateMyFest();
}

// A small dedicated toast with an inline Undo action — kept separate from
// the shared ib_toast (used all over the app with plain text only) rather
// than teaching that one to render HTML for just this one feature.
function _showFestivalUndoToast(msg) {
  var t = document.getElementById('festival-undo-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'festival-undo-toast';
    t.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top, 0px) + 14px);left:50%;transform:translateX(-50%);background:#0A0A0F;color:white;padding:11px 16px;border-radius:22px;font-size:13px;font-weight:600;z-index:9999;max-width:calc(100vw - 32px);box-sizing:border-box;display:none;align-items:center;gap:12px;box-shadow:0 8px 24px rgba(0,0,0,0.4)';
    document.body.appendChild(t);
  }
  t.innerHTML = '<span>' + _escapeHtml(msg) + '</span><b onclick="undoFestivalChoice()" style="cursor:pointer;color:rgba(168,159,232,1);font-weight:800">Undo</b>';
  t.style.display = 'flex';
  clearTimeout(t._t);
  t._t = setTimeout(function(){ t.style.display = 'none'; window._festivalLastAction = null; }, 5000);
}
function _hideFestivalUndoToast() {
  var t = document.getElementById('festival-undo-toast');
  if (t) t.style.display = 'none';
}

// ── COMPARE YOUR FESTIVAL — pick an accepted Innings friend who's also
// going/maybe to OSL and see your picks side by side. Friend pool is
// cached once per session, same lazy-load-once pattern as
// loadOslFriendRsvps just below.
window._compareFriendsCache = null;
window._compareFriendId = null;
window._compareFilter = 'all';

function loadCompareFriends(cb) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { window._compareFriendsCache = []; if (cb) cb(); return; }
  if (window._compareFriendsCache) { if (cb) cb(); return; }
  Promise.all([
    window.db.collection('friendRequests').where('fromUid','==',user.uid).where('status','==','accepted').get(),
    window.db.collection('friendRequests').where('toUid','==',user.uid).where('status','==','accepted').get()
  ]).then(function(results){
    var uids = [];
    results[0].forEach(function(d){ uids.push(d.data().toUid); });
    results[1].forEach(function(d){ uids.push(d.data().fromUid); });
    uids = uids.filter(function(v,i){ return uids.indexOf(v) === i; });
    if (!uids.length) { window._compareFriendsCache = []; if (cb) cb(); return; }
    return Promise.all(uids.map(function(uid){ return window.db.collection('users').doc(uid).get(); })).then(function(docs){
      var friends = [];
      docs.forEach(function(doc){
        var d = doc.data() || {};
        if (d.oslRsvp === 'going' || d.oslRsvp === 'maybe') {
          friends.push({ uid: doc.id, name: d.name || 'Friend', oslRsvp: d.oslRsvp, actRsvps: d.oslActRsvps || {} });
        }
      });
      window._compareFriendsCache = friends;
      if (cb) cb();
    });
  }).catch(function(err){
    console.error('Load compare friends error:', err);
    window._compareFriendsCache = [];
    if (cb) cb();
  });
}

function openComparePicker() {
  loadCompareFriends(function(){
    var listEl = document.getElementById('compare-friend-list');
    var friends = window._compareFriendsCache || [];
    if (!listEl) return;
    if (!friends.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:24px 16px;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.6">None of your Innings friends are marked going or maybe to Outside Lands yet.</div>';
    } else {
      listEl.innerHTML = friends.map(function(f){
        var goingCount = Object.keys(f.actRsvps || {}).filter(function(n){ return f.actRsvps[n] === 'going'; }).length;
        return '<div onclick="selectCompareFriend(\'' + f.uid + '\')" style="display:flex;align-items:center;gap:12px;padding:11px 8px;border-radius:14px;cursor:pointer">' +
          '<div class="av av-a" style="width:38px;height:38px;font-size:13px;flex-shrink:0">' + _escapeHtml(_initialsFallback(f.name)) + '</div>' +
          '<div style="flex:1;font-size:14px;font-weight:600;color:white">' + _escapeHtml(f.name) + '</div>' +
          '<div style="font-size:11px;color:rgba(255,255,255,0.35);flex-shrink:0">' + goingCount + ' going</div>' +
        '</div>';
      }).join('');
    }
    var m = document.getElementById('compare-picker-modal');
    if (m) m.style.display = 'flex';
  });
}

function hideComparePicker() {
  var m = document.getElementById('compare-picker-modal');
  if (m) m.style.display = 'none';
}

function selectCompareFriend(uid) {
  window._compareFriendId = uid;
  window._compareFilter = 'all';
  hideComparePicker();
  var friend = (window._compareFriendsCache || []).filter(function(f){ return f.uid === uid; })[0];
  if (friend) {
    var avEl = document.getElementById('cmp-friend-av');
    var namesEl = document.getElementById('cmp-friend-names');
    var themLabelEl = document.getElementById('cmp-stat-them-label');
    if (avEl) avEl.textContent = (friend.name || '?').charAt(0).toUpperCase();
    if (namesEl) namesEl.textContent = 'You & ' + friend.name;
    if (themLabelEl) themLabelEl.textContent = 'Only ' + (friend.name || '').split(' ')[0];
  }
  document.querySelectorAll('.cmp-stat-chip').forEach(function(el){
    el.style.background = 'transparent';
    el.style.borderColor = 'transparent';
  });
  updateMyFest();
}

function exitCompare() {
  window._compareFriendId = null;
  window._compareFilter = 'all';
  updateMyFest();
}

function setCompareFilter(f) {
  window._compareFilter = (window._compareFilter === f) ? 'all' : f;
  document.querySelectorAll('.cmp-stat-chip').forEach(function(el){
    var active = el.getAttribute('data-filter') === window._compareFilter;
    el.style.background = active ? 'rgba(168,159,232,0.14)' : 'transparent';
    el.style.borderColor = active ? 'rgba(168,159,232,0.4)' : 'transparent';
  });
  updateMyFest();
}

// ── ARTIST DETAIL: who's going, Spotify/Apple Music search links, per-artist chat ──
function _slugifyAct(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'act';
}

window._actDetailCurrent = null;
window._actChatStarted = {};
window._actPhotosStarted = {};
window._actPhotosData = {};
window._actPrimaryStarted = {};
window._actPrimaryPhotoId = {};
window._actSongsStarted = {};
window._actSongsCache = {};
window._actSongAppleLinks = {};

// Artist photos — anyone signed in can add one, and anyone can pick which one
// is the backdrop behind the header/going/chat (the "primary" photo, tracked
// per-artist in actPrimaryPhoto). Falls back to the newest photo if nobody's
// picked one yet, and to the gradient if there are no photos at all.
function setActDetailBg(url) {
  var bg = document.getElementById('act-detail-bg');
  if (!bg) return;
  bg.style.backgroundImage = url ? 'url(' + url + ')' : '';
  bg.style.backgroundSize = 'cover';
  bg.style.backgroundPosition = 'center';
  // A flat gradient background is uniformly dark already, so the default
  // overlay is enough. A real photo can have a bright spot anywhere (a
  // face, a sky, stage lighting) sitting right behind the tabs, RSVP
  // buttons, or who's-going row — so once a photo's in place, the overlay
  // needs to be strong and even across the whole height, not just heavy at
  // the very bottom.
  var overlay = document.getElementById('act-detail-overlay');
  if (overlay) {
    overlay.style.background = url
      ? 'linear-gradient(180deg,rgba(10,6,20,0.72) 0%,rgba(10,6,20,0.6) 35%,rgba(10,6,20,0.68) 65%,rgba(10,6,20,0.96) 100%)'
      : 'linear-gradient(180deg,rgba(13,8,32,0.5) 0%,rgba(13,8,32,0.35) 35%,rgba(13,8,32,0.55) 65%,rgba(13,8,32,0.95) 100%)';
  }
}

function renderActPhotos(photos) {
  var actId = window._actDetailCurrent && window._actDetailCurrent.actId;
  var primaryId = actId ? window._actPrimaryPhotoId[actId] : null;
  var grid = document.getElementById('act-detail-photos');
  if (grid) {
    grid.innerHTML = photos.length
      ? photos.map(function(p, i){
          var isPrimary = !!(primaryId && p._id === primaryId);
          var star = isPrimary ? '<div style="position:absolute;bottom:4px;right:4px;width:18px;height:18px;border-radius:50%;background:rgba(168,159,232,0.95);display:flex;align-items:center;justify-content:center;font-size:10px;color:#0D0820">★</div>' : '';
          return '<div onclick="openActPhoto(' + i + ')" style="position:relative;width:100%;aspect-ratio:1/1;border-radius:10px;background-image:url(' + p.photo + ');background-size:cover;background-position:center;cursor:pointer' + (isPrimary ? ';outline:2px solid rgba(168,159,232,0.95);outline-offset:2px' : '') + '">' + star + '</div>';
        }).join('')
      : '<div style="grid-column:1/-1;text-align:center;font-size:13px;color:rgba(255,255,255,0.4);padding:40px 0">No photos yet — be the first to add one</div>';
  }
  var primaryMatch = primaryId ? photos.filter(function(p){ return p._id === primaryId; })[0] : null;
  var bgPhoto = primaryMatch ? primaryMatch.photo : (photos.length ? photos[0].photo : null);
  setActDetailBg(bgPhoto);
}

function startActPhotos(actId) {
  if (window._actPhotosStarted[actId]) return;
  if (!window.db) return;
  window._actPhotosStarted[actId] = true;
  window.db.collection('actPhotos').where('actId','==',actId).limit(80).onSnapshot(function(snap){
    var arr = [];
    snap.forEach(function(doc){ arr.push(Object.assign({ _id: doc.id }, doc.data())); });
    arr.sort(function(a,b){ return (b.ts || 0) - (a.ts || 0); }); // newest first
    window._actPhotosData[actId] = arr;
    if (window._actDetailCurrent && window._actDetailCurrent.actId === actId) renderActPhotos(arr);
  }, function(err){
    console.error('Act photos error:', err);
    window._actPhotosStarted[actId] = false;
    if (typeof ib_toast==='function') ib_toast('Photos unavailable — check Firestore rules');
  });
}

function startActPrimaryPhoto(actId) {
  if (window._actPrimaryStarted[actId]) return;
  if (!window.db) return;
  window._actPrimaryStarted[actId] = true;
  window.db.collection('actPrimaryPhoto').doc(actId).onSnapshot(function(doc){
    window._actPrimaryPhotoId[actId] = doc.exists ? doc.data().photoId : null;
    if (window._actDetailCurrent && window._actDetailCurrent.actId === actId) renderActPhotos(window._actPhotosData[actId] || []);
  }, function(err){
    console.error('Act primary photo error:', err);
    window._actPrimaryStarted[actId] = false;
  });
}

// Anyone can call this — not just whoever added the photo.
function setActPrimaryPhoto(photoId) {
  if (!window._actDetailCurrent) return;
  var actId = window._actDetailCurrent.actId;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in to do that'); return; }
  window.db.collection('actPrimaryPhoto').doc(actId).set({ photoId: photoId, setByUid: user.uid, ts: Date.now() })
    .then(function(){ if (typeof ib_toast==='function') ib_toast('Set as background'); })
    .catch(function(err){ console.error('Set primary photo error:', err); if (typeof ib_toast==='function') ib_toast('Could not set — check Firestore rules'); });
}

function setActPrimaryPhotoFromViewer() {
  if (!window._actDetailCurrent) return;
  var photos = window._actPhotosData[window._actDetailCurrent.actId] || [];
  var p = photos[window._actPhotoViewerIndex];
  if (!p || !p._id) return;
  setActPrimaryPhoto(p._id);
}

function addActPhoto(input) {
  if (!input.files || !input.files.length) return;
  if (!window._actDetailCurrent) return;
  var actId = window._actDetailCurrent.actId;
  var actName = window._actDetailCurrent.name;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in to add photos'); return; }
  var author = (window.userData && window.userData.name) || 'You';
  var files = Array.from(input.files);
  if (typeof ib_toast==='function') ib_toast('Uploading…');
  files.forEach(function(file){
    var reader = new FileReader();
    reader.onload = function(e){
      _downscaleImage(e.target.result, 1000, function(small){
        window.db.collection('actPhotos').add({ actId: actId, actName: actName, uid: user.uid, author: author, photo: small, ts: Date.now() })
          .then(function(){ _postActPhotoSystemMessage(actId, actName, author); })
          .catch(function(err){ console.error('Add act photo error:', err); if (typeof ib_toast==='function') ib_toast('Photos unavailable — check Firestore rules'); });
      });
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

// Mirrors _postActRsvpSystemMessage — drops "X added a photo 📷" into the
// same act's chat/notification feed so the Activity tab shows it inline
// with everything else, right as it happens.
function _postActPhotoSystemMessage(actId, actName, author) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  window.db.collection('actChat').add({ actId: actId, actName: actName, uid: user.uid, author: author || 'Someone', text: (author || 'Someone') + ' added a photo 📷', ts: Date.now(), system: true, systemType: 'photo' })
    .catch(function(err){ console.error('Post photo activity message error:', err); });
}

window._actPhotoViewerIndex = 0;
window._actPhotoViewerSrc = null;

function openActPhoto(i) {
  if (!window._actDetailCurrent) return;
  var photos = window._actPhotosData[window._actDetailCurrent.actId] || [];
  var p = photos[i];
  if (!p) return;
  window._actPhotoViewerIndex = i;
  window._actPhotoViewerSrc = p.photo;
  var img = document.getElementById('act-photo-viewer-img');
  var del = document.getElementById('act-photo-viewer-delete');
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (img) img.src = p.photo;
  if (del) del.style.display = (user && p.uid === user.uid) ? 'block' : 'none';
  var viewer = document.getElementById('act-photo-viewer');
  if (viewer) viewer.style.display = 'flex';
}

function closeActPhoto() {
  var viewer = document.getElementById('act-photo-viewer');
  if (viewer) viewer.style.display = 'none';
}

function actPhotoNav(delta) {
  if (!window._actDetailCurrent) return;
  var photos = window._actPhotosData[window._actDetailCurrent.actId] || [];
  var newIndex = (window._actPhotoViewerIndex || 0) + delta;
  if (newIndex < 0 || newIndex >= photos.length) return;
  openActPhoto(newIndex);
}

var _actPhotoSwipeStartX = null;
function actPhotoSwipeStart(e) { if (e.touches && e.touches.length === 1) _actPhotoSwipeStartX = e.touches[0].clientX; }
function actPhotoSwipeEnd(e) {
  if (_actPhotoSwipeStartX === null) return;
  var endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : _actPhotoSwipeStartX;
  var delta = endX - _actPhotoSwipeStartX;
  _actPhotoSwipeStartX = null;
  if (Math.abs(delta) < 40) return;
  actPhotoNav(delta < 0 ? 1 : -1);
}

function actPhotoDownload() {
  var src = window._actPhotoViewerSrc;
  if (!src) return;
  fetch(src).then(function(res){ return res.blob(); }).then(function(blob){
    var file = new File([blob], 'innings-artist-photo.jpg', { type: blob.type || 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(function(){});
    } else {
      var a = document.createElement('a');
      a.href = src;
      a.download = 'innings-artist-photo.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (typeof ib_toast === 'function') ib_toast('Downloaded — check your Files or Downloads');
    }
  }).catch(function(err){
    console.error('Photo download error:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not download — try pressing and holding the photo instead');
  });
}

function deleteActPhoto() {
  if (!window._actDetailCurrent) return;
  var photos = window._actPhotosData[window._actDetailCurrent.actId] || [];
  var p = photos[window._actPhotoViewerIndex];
  if (!p || !p._id || !window.db) return;
  window.db.collection('actPhotos').doc(p._id).delete()
    .then(function(){ closeActPhoto(); if (typeof ib_toast==='function') ib_toast('Photo deleted'); })
    .catch(function(err){ console.error('Delete act photo error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}


function closeActAlbum() {
  var box = document.getElementById('act-photo-album');
  if (box) box.style.display = 'none';
}


function openActDetail(actName, actTime, isHeadliner) {
  var actId = _slugifyAct(actName);
  window._actDetailCurrent = { name: actName, actId: actId };
  _actResetTabsToActivity();
  renderActPhotos(window._actPhotosData[actId] || []);
  startActPhotos(actId);
  startActPrimaryPhoto(actId);

  var nameEl = document.getElementById('act-detail-name');
  var metaEl = document.getElementById('act-detail-meta');
  if (nameEl) nameEl.textContent = actName;
  if (metaEl) metaEl.textContent = (actTime || '') + (isHeadliner ? ' · Headliner' : '');

  var spotifyEl = document.getElementById('act-detail-spotify');
  var appleEl = document.getElementById('act-detail-apple');
  if (spotifyEl) spotifyEl.href = 'https://open.spotify.com/search/' + encodeURIComponent(actName);
  if (appleEl) appleEl.href = 'https://music.apple.com/us/search?term=' + encodeURIComponent(actName);
  _lookupAppleMusicArtist(actName);

  renderActRsvpButtons(actName);
  loadActGoing(actName);
  startActChat(actId);
  startActSongs(actId);

  var box = document.getElementById('osl2-act-detail');
  if (box) box.style.display = 'flex';
}

// Apple's iTunes Search API is free and needs no login/API key, so we can
// resolve the exact artist page live instead of just linking to a search.
// Spotify has no equivalent open endpoint — every Spotify Web API call,
// even a plain search, requires an OAuth token from a registered developer
// app, so that one stays a search link unless a Client ID/Secret is wired in.
function _lookupAppleMusicArtist(actName) {
  var appleEl = document.getElementById('act-detail-apple');
  if (!appleEl) return;
  fetch('https://itunes.apple.com/search?entity=musicArtist&limit=1&term=' + encodeURIComponent(actName))
    .then(function(res){ return res.json(); })
    .then(function(data){
      if (!window._actDetailCurrent || window._actDetailCurrent.name !== actName) return; // a different act is open now
      var result = data && data.results && data.results[0];
      if (result && result.artistLinkUrl && appleEl) appleEl.href = result.artistLinkUrl;
    })
    .catch(function(err){ console.error('Apple Music lookup error:', err); });
}

function closeActDetail() {
  var box = document.getElementById('osl2-act-detail');
  if (box) box.style.display = 'none';
  window._actDetailCurrent = null;
}

// ══════════════════════════════════════════════════════════════════════
// NATE'S BIRTHDAY — premade, hardcoded like OSL's own stageData. Every
// function below mirrors its OSL act-detail counterpart one for one
// (openActDetail → selectBdayStop, actChat → birthdayStopChat, etc.) —
// duplicated rather than generalized on purpose, so nothing here risks
// touching OSL's own already-live, already-relied-on functions.
// ══════════════════════════════════════════════════════════════════════

// PLACEHOLDER CONTENT — seeds birthdayEvent/main the first time anyone
// opens the screen. After that, Firestore is the source of truth and
// these defaults are only a fallback (e.g. if the doc read fails).
// Editing happens in-app now (the ✎ buttons, owner-gated) rather than by
// touching this array directly — see loadBirthdayEventData below.
var BIRTHDAY_STOPS_DEFAULT = [
  { id: 'pregame', emoji: '🍻', name: 'Pregame — add your spot', time: 'TBD', location: '', anim: 'glow' },
  { id: 'game', emoji: '⚾', name: 'Giants Game — Oracle Park', time: 'TBD', location: '24 Willie Mays Plaza, San Francisco, CA 94107', anim: 'twinkle' },
  { id: 'afters', emoji: '🎉', name: 'Afters — add your spot', time: 'Late', location: '', anim: 'confetti' }
];
window._bdayEventData = null;
window._bdayEventDataLoading = false;

// Loads (or seeds, on the very first visit ever) the one shared birthdayEvent/
// main doc. cb fires once window._bdayEventData is populated — every other
// birthday function reads from that live object, never from the DEFAULT
// array directly, so edits saved by one person show up for everyone.
function loadBirthdayEventData(cb) {
  if (window._bdayEventData) { if (cb) cb(); return; }
  if (!window.db) { window._bdayEventData = { title: "Nate's Birthday", date: '', stops: BIRTHDAY_STOPS_DEFAULT.slice() }; if (cb) cb(); return; }
  if (window._bdayEventDataLoading) {
    var check = setInterval(function(){
      if (window._bdayEventData) { clearInterval(check); if (cb) cb(); }
    }, 150);
    return;
  }
  window._bdayEventDataLoading = true;
  window.db.collection('birthdayEvent').doc('main').get().then(function(doc){
    if (doc.exists) {
      var d = doc.data() || {};
      window._bdayEventData = {
        title: d.title || "Nate's Birthday",
        date: d.date || '',
        stops: (d.stops && d.stops.length) ? d.stops : BIRTHDAY_STOPS_DEFAULT.slice()
      };
      window._bdayEventDataLoading = false;
      if (cb) cb();
    } else {
      var seed = { title: "Nate's Birthday", date: '', stops: BIRTHDAY_STOPS_DEFAULT.slice() };
      window.db.collection('birthdayEvent').doc('main').set(seed).then(function(){
        window._bdayEventData = seed;
        window._bdayEventDataLoading = false;
        if (cb) cb();
      }).catch(function(err){
        console.error('Seed birthday event data error:', err);
        window._bdayEventData = seed; // still usable locally even if the write failed
        window._bdayEventDataLoading = false;
        if (cb) cb();
      });
    }
  }).catch(function(err){
    console.error('Load birthday event data error:', err);
    window._bdayEventData = { title: "Nate's Birthday", date: '', stops: BIRTHDAY_STOPS_DEFAULT.slice() };
    window._bdayEventDataLoading = false;
    if (cb) cb();
  });
}

function _bdayStopById(id) {
  var stops = (window._bdayEventData && window._bdayEventData.stops) || BIRTHDAY_STOPS_DEFAULT;
  for (var i = 0; i < stops.length; i++) { if (stops[i].id === id) return stops[i]; }
  return null;
}

// Owner check by phone (same pattern as the feedback-archive gate later in
// this file) — this is premade content with one real owner, not a
// generic per-user editor, so the edit buttons only show for Nate.
function _bdayIsOwner() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var myPhone = ((user && user.phoneNumber) || '').replace(/\D/g, '');
  return myPhone.slice(-10) === '4152979471';
}

function _bdayApplyEditVisibility() {
  var isOwner = _bdayIsOwner();
  var heroBtn = document.getElementById('bday-edit-hero-btn');
  var stopBtn = document.getElementById('bday-edit-stop-btn');
  if (heroBtn) heroBtn.style.display = isOwner ? 'flex' : 'none';
  if (stopBtn) stopBtn.style.display = isOwner ? 'flex' : 'none';
}

window._bdayCurrentStop = null;
window._bdayStopChatStarted = {};
window._bdayStopPhotosStarted = {};
window._bdayStopPhotosData = {};
window._bdayStopPrimaryStarted = {};
window._bdayStopPrimaryPhotoId = {};
window._bdayStopPhotoViewerIndex = 0;
window._bdayStopPhotoViewerSrc = null;

// ── TOP-LEVEL RSVP ("are you coming at all") — the only RSVP now; a
// per-stop version used to sit alongside this but added a whole second
// system for what's really one decision, so it's gone. Mirrors
// oslCheckRsvp/oslSetRsvp. ──
function bdayCheckRsvp() {
  var rsvp = window.userData && window.userData.birthdayRsvp;
  var overlay = document.getElementById('bday-rsvp-overlay');
  if (!rsvp) {
    if (overlay) overlay.style.display = 'flex';
  } else {
    if (overlay) overlay.style.display = 'none';
    renderBdayState();
    if (typeof _bdayMaybeShowReveal === 'function') _bdayMaybeShowReveal();
  }
}

function bdaySetRsvp(val) {
  var overlay = document.getElementById('bday-rsvp-overlay');
  if (overlay) overlay.style.display = 'none';
  window.userData = window.userData || {};
  window.userData.birthdayRsvp = val;
  renderBdayState();
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (user && window.db) {
    window.db.collection('users').doc(user.uid).set({ birthdayRsvp: val }, { merge: true }).catch(function(err){ console.error('Birthday rsvp error:', err); });
  }
  if (typeof ib_toast === 'function') ib_toast(val === 'going' ? "You're in 🎉" : val === 'maybe' ? 'Marked as maybe' : "Marked as not coming");
  // Same iOS scroll-freeze workaround OSL's own RSVP dismiss uses — the
  // overlay hiding reveals scroll containers that otherwise never
  // re-engage the drag gesture until a full reload.
  if (typeof _nudgeScrollers === 'function') _nudgeScrollers(document.getElementById('screen-birthday-group'));
  if (typeof _bdayMaybeShowReveal === 'function') _bdayMaybeShowReveal();
}

function renderBdayState() {
  var rsvp = (window.userData && window.userData.birthdayRsvp) || '';
  var data = window._bdayEventData || {};
  var titleEl = document.getElementById('bday-title-text');
  if (titleEl) titleEl.textContent = data.title || "Nate's Birthday";
  var status = document.getElementById('bday-going-status');
  if (status) {
    var prefix = rsvp === 'going' ? "You're in · " : rsvp === 'maybe' ? 'Maybe · ' : '';
    var dateLabel = data.date ? _formatMomentDate(data.date) : 'Add your date';
    var stopCount = (data.stops || BIRTHDAY_STOPS_DEFAULT).length;
    status.textContent = prefix + dateLabel + ' · ' + stopCount + ' stop' + (stopCount === 1 ? '' : 's');
  }
  var membersEl = document.getElementById('bday-members');
  if (membersEl && window.db) {
    window.db.collection('users').where('birthdayRsvp', 'in', ['going', 'maybe']).get().then(function(snap){
      var user = window.currentUser || (window.auth && window.auth.currentUser);
      var chips = [];
      snap.forEach(function(doc){
        var d = doc.data();
        var nm = d.name || 'Friend';
        var isMe = user && doc.id === user.uid;
        chips.push('<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0' + (isMe ? '' : ';cursor:pointer') + '"' + (isMe ? '' : ' onclick="openUserProfile(\'' + doc.id + '\')"') + '>' +
          '<div class="m-av-sm av-a">' + _escapeHtml(_initials(nm)) + '</div>' +
          '<div class="m-nm-sm" style="color:rgba(255,255,255,0.5)">' + _escapeHtml(isMe ? 'You' : nm.split(' ')[0]) + '</div></div>');
      });
      membersEl.innerHTML = chips.join('');
    }).catch(function(err){ console.error('Birthday members error:', err); });
  }
}

// ── FEED / STOPS TAB SWITCH — mirrors oslTab ──
function bdayTab(tab, evt) {
  evt = evt || window.event;
  document.querySelectorAll('.bday-main-tab').forEach(function(t) {
    t.style.color = 'rgba(255,255,255,0.55)';
    t.style.fontWeight = '600';
    t.style.borderBottom = '2px solid transparent';
  });
  if (evt && evt.target) {
    evt.target.style.color = 'rgba(168,159,232,1)';
    evt.target.style.fontWeight = '700';
    evt.target.style.borderBottom = '2px solid rgba(168,159,232,0.9)';
  }
  ['bday2-chat', 'bday2-chat-input', 'bday2-stops'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (tab === 'chat') {
    var chatPanel = document.getElementById('bday2-chat');
    chatPanel.style.display = 'flex';
    document.getElementById('bday2-chat-input').style.display = 'flex';
    if (typeof startBirthdayChat === 'function') startBirthdayChat();
    setTimeout(function(){ chatPanel.scrollTop = chatPanel.scrollHeight; }, 0);
  } else if (tab === 'stops') {
    var stopsPanel = document.getElementById('bday2-stops');
    stopsPanel.style.display = 'flex';
    stopsPanel.style.flexDirection = 'column';
  }
}

// Lands on Stops by default (matches _oslLandOnLineup's own reasoning —
// the immersive content is the better first impression, Feed stays one
// tap away), and re-selects whatever stop was last open, or Pregame first.
function _bdayLandOnStops() {
  var tabs = document.querySelectorAll('.bday-main-tab');
  var stopsTab = null;
  tabs.forEach(function(t){ if (t.textContent.trim() === 'Stops') stopsTab = t; });
  bdayTab('stops', stopsTab ? { target: stopsTab } : null);
  selectBdayStop(window._bdayCurrentStop || 'pregame');
}

// ── FEED CHAT (whole event) — mirrors startOslChat/renderOslChat/sendOslMessage ──
window._birthdayChatStarted = false;
function startBirthdayChat() {
  if (window._birthdayChatStarted) return;
  if (!window.db) return;
  window._birthdayChatStarted = true;
  window.db.collection('birthdayChat').orderBy('ts').limit(300).onSnapshot(function(snap){
    var msgs = [];
    snap.forEach(function(doc){ msgs.push(Object.assign({ _id: doc.id }, doc.data())); });
    renderBirthdayChat(msgs);
  }, function(err){
    console.error('Birthday chat error:', err);
    window._birthdayChatStarted = false;
    if (typeof ib_toast==='function') ib_toast('Chat unavailable — check Firestore rules');
  });
}

function renderBirthdayChat(msgs) {
  var box = document.getElementById('bday-chat-msgs');
  var empty = document.getElementById('bday-chat-empty');
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
          '<div class="bubble me" onclick="_msgDoubleTap(this,\'birthdayChat\',\'' + c._id + '\',true)" style="max-width:100%;cursor:pointer">' + _replyQuoteHtml(c.replyTo, true) + '<div class="b-txt">' + _renderMessageTextWithMentions(c.text, true) + '</div><div class="b-t">' + _fmtTime(c.ts) + (c.edited ? ' · Edited' : '') + '</div></div>' +
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
        '<div class="bubble them" onclick="_msgDoubleTap(this,\'birthdayChat\',\'' + c._id + '\',false)" style="max-width:100%;cursor:pointer">' + _replyQuoteHtml(c.replyTo, false) + '<div class="b-who">' + _escapeHtml(c.author) + '</div><div class="b-txt">' + _renderMessageTextWithMentions(c.text, false) + '</div><div class="b-t">' + _fmtTime(c.ts) + (c.edited ? ' · Edited' : '') + '</div></div>' +
        badges +
      '</div></div>';
  });
  var panel = document.getElementById('bday2-chat');
  if (panel) panel.scrollTop = panel.scrollHeight;
}

function deleteBirthdayMessage(msgId) {
  if (!window.db || !msgId) return;
  window.db.collection('birthdayChat').doc(msgId).delete()
    .catch(function(err){ console.error('Delete birthday message error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}

function sendBirthdayMessage() {
  var inp = document.getElementById('bday-chat-field');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in to chat'); return; }
  var author = (window.userData && window.userData.name) || 'You';
  if (inp) inp.value = '';
  var msgData = { uid: user.uid, author: author, text: text, ts: Date.now() };
  var replyTo = _consumeReplyForSend('birthdayChat');
  if (replyTo) msgData.replyTo = replyTo;
  var url = _extractFirstUrl(text);
  var sendPromise = url
    ? _fetchLinkPreview(url).then(function(lp){
        if (lp && lp.url) msgData.linkPreview = lp;
        return window.db.collection('birthdayChat').add(msgData);
      })
    : window.db.collection('birthdayChat').add(msgData);
  sendPromise.catch(function(err){ console.error('Birthday chat send error:', err); if (typeof ib_toast==='function') ib_toast('Could not send — ' + (err && err.message ? err.message : 'check Firestore rules')); });
}

// Drops a plain system line into the whole-event Feed whenever a stop
// gets RSVP/photo activity — same idea as OSL's _postOslFeedNotice, kept
// to a plain text bubble instead of OSL's routed, icon-per-type cards
// since 3 stops don't need that much navigation scaffolding. Needs uid
// set (same as every other chat write in this file) — the rules require
// request.resource.data.uid == request.auth.uid on create; this was
// silently missing it and would have failed even with correct rules.
function _postBirthdayFeedNotice(text) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return;
  window.db.collection('birthdayChat').add({ uid: user.uid, text: text, ts: Date.now(), system: true })
    .catch(function(err){ console.error('Post birthday feed notice error:', err); });
}

// ── STOP BACKDROP — mirrors setActDetailBg ──
function setBdayStopDetailBg(url) {
  var bg = document.getElementById('bday-stop-bg');
  if (!bg) return;
  // A CSS gradient IS a background-image value, not a background-color —
  // clearing backgroundImage to '' when there's no photo doesn't fall back
  // to any color, it just leaves the element fully transparent, exposing
  // whatever's behind it. OSL's own act-detail has this same code, but it
  // reads fine there because everything behind it is already dark; the
  // birthday screen sits on the app's light background, so the same bug
  // showed up as a plain white panel. Explicitly restoring the gradient
  // (instead of clearing to nothing) fixes it either way.
  bg.style.backgroundImage = url ? 'url(' + url + ')' : 'linear-gradient(135deg,#3D3580,#1A1640)';
  bg.style.backgroundSize = 'cover';
  bg.style.backgroundPosition = 'center';
  var overlay = document.getElementById('bday-stop-overlay');
  if (overlay) {
    overlay.style.background = url
      ? 'linear-gradient(180deg,rgba(10,6,20,0.72) 0%,rgba(10,6,20,0.6) 35%,rgba(10,6,20,0.68) 65%,rgba(10,6,20,0.96) 100%)'
      : 'linear-gradient(180deg,rgba(13,8,32,0.5) 0%,rgba(13,8,32,0.35) 35%,rgba(13,8,32,0.55) 65%,rgba(13,8,32,0.95) 100%)';
  }
}

// ── SELECT A STOP — mirrors openActDetail, minus the Spotify/Apple Music
// links and Songs tab (not applicable here) ──
function selectBdayStop(stopId) {
  var s = _bdayStopById(stopId);
  if (!s) return;
  window._bdayCurrentStop = stopId;

  document.querySelectorAll('.bday-stop-tab').forEach(function(t){
    var active = t.getAttribute('data-stop') === stopId;
    t.style.color = active ? 'rgba(168,159,232,1)' : 'rgba(255,255,255,0.5)';
    t.style.fontWeight = active ? '700' : '600';
    t.style.borderBottomColor = active ? 'rgba(168,159,232,0.9)' : 'transparent';
  });

  var nameEl = document.getElementById('bday-stop-name');
  var timeEl = document.getElementById('bday-stop-time');
  if (nameEl) nameEl.textContent = (s.emoji ? s.emoji + ' ' : '') + s.name;
  if (timeEl) timeEl.textContent = s.time || '';

  ['twinkle', 'confetti', 'glow', 'gradient'].forEach(function(a){
    var el = document.getElementById('bday-stop-anim-' + a);
    if (el) el.style.display = (a === s.anim) ? 'block' : 'none';
  });

  // One tap opens a small Google/Apple/Waze picker (openBdayLocationSheet)
  // instead of a permanent 3-button card — the sheet reads location fresh
  // from _bdayStopById itself, so there's nothing to prewire here.
  var locWrap = document.getElementById('bday-stop-loc');
  if (locWrap) {
    locWrap.style.display = s.location ? 'flex' : 'none';
    var textEl = document.getElementById('bday-stop-loc-text');
    if (textEl) textEl.textContent = s.location || '';
  }

  // Game preview / box score — only the Game stop shows this section.
  var isGame = stopId === 'game';
  var bsSection = document.getElementById('bday-stop-boxscore-section');
  if (bsSection) bsSection.style.display = isGame ? 'block' : 'none';
  if (isGame) {
    renderBdayStopBoxScore(stopId);
    var attachEl = document.getElementById('bday-stop-attach-game');
    if (attachEl) attachEl.style.display = (_bdayIsOwner() && !s.boxScore) ? 'flex' : 'none';
    if (s.boxScore && s.boxScore.gamePk) _refreshBdayGameBoxScore(stopId);
  }

  _bdayStopResetSubTabsToActivity();
  renderBdayStopPhotos(window._bdayStopPhotosData[stopId] || []); // syncs the backdrop to THIS stop right away — mirrors openActDetail's own explicit renderActPhotos(...) call, which selectBdayStop was missing
  startBdayStopChat(stopId);
  startBdayStopPhotos(stopId);
  startBdayStopPrimaryPhoto(stopId);
}

// ── PER-STOP RSVP — mirrors renderActRsvpButtons/actDetailRsvp ──
// ── LOCATION SHEET (per stop) — one tap on the address opens this instead
// of a permanent 3-button card. Reads location fresh from the current stop
// each time it opens, so there's nothing to keep in sync elsewhere.
function openBdayLocationSheet() {
  var s = _bdayStopById(window._bdayCurrentStop);
  if (!s || !s.location) return;
  var titleEl = document.getElementById('bday-loc-sheet-title');
  if (titleEl) titleEl.textContent = s.location;
  var encoded = encodeURIComponent(s.location);
  var gEl = document.getElementById('bday-loc-sheet-google');
  var aEl = document.getElementById('bday-loc-sheet-apple');
  var wEl = document.getElementById('bday-loc-sheet-waze');
  if (gEl) gEl.href = 'https://www.google.com/maps/search/?api=1&query=' + encoded;
  if (aEl) aEl.href = 'https://maps.apple.com/?q=' + encoded;
  if (wEl) wEl.href = 'https://waze.com/ul?q=' + encoded + '&navigate=yes';
  var sheet = document.getElementById('bday-location-sheet');
  if (sheet) sheet.style.display = 'flex';
}

function closeBdayLocationSheet() {
  var sheet = document.getElementById('bday-location-sheet');
  if (sheet) sheet.style.display = 'none';
}

// ── GAME PREVIEW / BOX SCORE — reuses the existing MLB box score system
// wholesale (openBoxScoreModal / bsModalSearch / bsModalSelectGame already
// live earlier in this file); only _applyBoxScoreToContext needed a new
// branch (search "ctx.type === 'bdayGame'") to know where to save it. ──
function renderBdayStopBoxScore(stopId) {
  var box = document.getElementById('bday-stop-boxscore');
  if (!box) return;
  var s = _bdayStopById(stopId);
  if (s && s.boxScore) {
    var removeLink = _bdayIsOwner() ? '<div onclick="removeBdayGameBoxScore()" style="text-align:center;font-size:11px;color:rgba(255,255,255,0.4);font-weight:600;margin-top:8px;cursor:pointer">Remove game</div>' : '';
    box.style.display = 'block';
    box.innerHTML = _boxScoreCardHtml(s.boxScore, true) + removeLink;
  } else {
    box.style.display = 'none';
    box.innerHTML = '';
  }
}

// Re-fetches from the same MLB endpoint the attach flow used, keyed off
// the saved gamePk — mirrors how _convertFutureMomentToMemory refreshes a
// future plan's score. Called every time the Game stop is opened, so the
// card naturally moves from preview → live → final as the day plays out.
// The Firestore write-back only happens for the owner (birthdayEvent
// updates are rules-restricted to Nate) — everyone else still gets a
// freshly-fetched score locally, it just isn't persisted by them.
function _refreshBdayGameBoxScore(stopId) {
  var s = _bdayStopById(stopId);
  if (!s || !s.boxScore || !s.boxScore.gamePk) return;
  fetch('/api/mlb?mode=boxscore&gamePk=' + encodeURIComponent(s.boxScore.gamePk))
    .then(function(r){ return r.json(); })
    .then(function(box){
      if (window._bdayCurrentStop !== stopId) return; // navigated away already
      s.boxScore = _sanitizeForFirestore(box);
      renderBdayStopBoxScore(stopId);
      if (window.db && window._bdayEventData && _bdayIsOwner()) {
        window.db.collection('birthdayEvent').doc('main').set({ stops: _sanitizeForFirestore(window._bdayEventData.stops) }, { merge: true }).catch(function(err){ console.error('Refresh birthday game score save error:', err); });
      }
    })
    .catch(function(err){ console.error('Refresh birthday game score error:', err); });
}

function removeBdayGameBoxScore() {
  var s = _bdayStopById('game');
  if (!s || !window._bdayEventData) return;
  s.boxScore = null;
  if (window.db) {
    window.db.collection('birthdayEvent').doc('main').set({ stops: _sanitizeForFirestore(window._bdayEventData.stops) }, { merge: true })
      .then(function(){ if (typeof ib_toast === 'function') ib_toast('Game removed'); })
      .catch(function(err){ console.error('Remove birthday game error:', err); if (typeof ib_toast === 'function') ib_toast('Could not remove — try again'); });
  }
  if (window._bdayCurrentStop === 'game') selectBdayStop('game');
}

// ── ACTIVITY / PHOTOS SUB-TABS — mirrors actTab/_actResetTabsToActivity ──
function bdayStopSubTab(tab, evt) {
  evt = evt || window.event;
  document.querySelectorAll('.bday-stop-subtab').forEach(function(t) {
    t.style.color = 'rgba(255,255,255,0.85)';
    t.style.fontWeight = '700';
    t.style.borderBottom = '2px solid transparent';
  });
  if (evt && evt.target) {
    evt.target.style.color = 'rgba(168,159,232,1)';
    evt.target.style.fontWeight = '700';
    evt.target.style.borderBottom = '2px solid rgba(168,159,232,0.9)';
  }
  ['bday-stop-tab-activity', 'bday-stop-tab-photos'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  var composer = document.getElementById('bday-stop-composer');
  if (tab === 'activity') {
    document.getElementById('bday-stop-tab-activity').style.display = 'flex';
    if (composer) composer.style.display = 'flex';
  } else if (tab === 'photos') {
    document.getElementById('bday-stop-tab-photos').style.display = 'flex';
    if (composer) composer.style.display = 'none';
  }
}

function _bdayStopResetSubTabsToActivity() {
  document.querySelectorAll('.bday-stop-subtab').forEach(function(t, i) {
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
  var activity = document.getElementById('bday-stop-tab-activity');
  var photos = document.getElementById('bday-stop-tab-photos');
  var composer = document.getElementById('bday-stop-composer');
  if (activity) activity.style.display = 'flex';
  if (photos) photos.style.display = 'none';
  if (composer) composer.style.display = 'flex';
}

// ── PER-STOP CHAT — mirrors startActChat/renderActChat/sendActMessage ──
function startBdayStopChat(stopId) {
  if (window._bdayStopChatStarted[stopId]) return;
  if (!window.db) return;
  window._bdayStopChatStarted[stopId] = true;
  window.db.collection('birthdayStopChat').where('stopId','==',stopId).limit(200).onSnapshot(function(snap){
    if (window._bdayCurrentStop !== stopId) return;
    var msgs = [];
    snap.forEach(function(doc){ msgs.push(Object.assign({ _id: doc.id }, doc.data())); });
    msgs.sort(function(a,b){ return (a.ts || 0) - (b.ts || 0); });
    renderBdayStopChat(msgs);
  }, function(err){
    console.error('Birthday stop chat error:', err);
    window._bdayStopChatStarted[stopId] = false;
    if (typeof ib_toast==='function') ib_toast('Chat unavailable — check Firestore rules');
  });
}

function renderBdayStopChat(msgs) {
  var box = document.getElementById('bday-stop-chat-msgs');
  var empty = document.getElementById('bday-stop-chat-empty');
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
          '<div class="bubble me" onclick="_msgDoubleTap(this,\'birthdayStopChat\',\'' + c._id + '\',true)" style="max-width:100%;cursor:pointer">' + _replyQuoteHtml(c.replyTo, true) + '<div class="b-txt">' + _renderMessageTextWithMentions(c.text, true) + '</div><div class="b-t">' + _fmtTime(c.ts) + (c.edited ? ' · Edited' : '') + '</div></div>' +
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
        '<div class="bubble them" onclick="_msgDoubleTap(this,\'birthdayStopChat\',\'' + c._id + '\',false)" style="max-width:100%;cursor:pointer">' + _replyQuoteHtml(c.replyTo, false) + '<div class="b-who">' + _escapeHtml(c.author) + '</div><div class="b-txt">' + _renderMessageTextWithMentions(c.text, false) + '</div><div class="b-t">' + _fmtTime(c.ts) + (c.edited ? ' · Edited' : '') + '</div></div>' +
        badges +
      '</div></div>';
  }, true);
  var panel = document.getElementById('bday-stop-chat');
  if (panel) panel.scrollTop = panel.scrollHeight;
}

function deleteBdayStopMessage(msgId) {
  if (!window.db || !msgId) return;
  window.db.collection('birthdayStopChat').doc(msgId).delete()
    .catch(function(err){ console.error('Delete birthday stop message error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}

function sendBdayStopMessage() {
  var stopId = window._bdayCurrentStop;
  if (!stopId) return;
  var inp = document.getElementById('bday-stop-chat-field');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in to chat'); return; }
  var author = (window.userData && window.userData.name) || 'You';
  if (inp) inp.value = '';
  var msgData = { stopId: stopId, uid: user.uid, author: author, text: text, ts: Date.now() };
  var replyTo = _consumeReplyForSend('birthdayStopChat');
  if (replyTo) msgData.replyTo = replyTo;
  var url = _extractFirstUrl(text);
  var sendPromise = url
    ? _fetchLinkPreview(url).then(function(lp){
        if (lp && lp.url) msgData.linkPreview = lp;
        return window.db.collection('birthdayStopChat').add(msgData);
      })
    : window.db.collection('birthdayStopChat').add(msgData);
  sendPromise.catch(function(err){ console.error('Birthday stop chat send error:', err); if (typeof ib_toast==='function') ib_toast('Could not send — ' + (err && err.message ? err.message : 'check Firestore rules')); });
}

// ── PER-STOP PHOTOS — mirrors startActPhotos/renderActPhotos/addActPhoto/
// setActPrimaryPhoto/openActPhoto etc. ──
function renderBdayStopPhotos(photos) {
  var stopId = window._bdayCurrentStop;
  var primaryId = stopId ? window._bdayStopPrimaryPhotoId[stopId] : null;
  var grid = document.getElementById('bday-stop-photos-grid');
  if (grid) {
    grid.innerHTML = photos.length
      ? photos.map(function(p, i){
          var isPrimary = !!(primaryId && p._id === primaryId);
          var star = isPrimary ? '<div style="position:absolute;bottom:4px;right:4px;width:18px;height:18px;border-radius:50%;background:rgba(168,159,232,0.95);display:flex;align-items:center;justify-content:center;font-size:10px;color:#0D0820">★</div>' : '';
          return '<div onclick="openBdayStopPhoto(' + i + ')" style="position:relative;width:100%;aspect-ratio:1/1;border-radius:10px;background-image:url(' + p.photo + ');background-size:cover;background-position:center;cursor:pointer' + (isPrimary ? ';outline:2px solid rgba(168,159,232,0.95);outline-offset:2px' : '') + '">' + star + '</div>';
        }).join('')
      : '<div style="grid-column:1/-1;text-align:center;font-size:13px;color:rgba(255,255,255,0.4);padding:40px 0">No photos yet — be the first to add one</div>';
  }
  var primaryMatch = primaryId ? photos.filter(function(p){ return p._id === primaryId; })[0] : null;
  var bgPhoto = primaryMatch ? primaryMatch.photo : (photos.length ? photos[0].photo : null);
  setBdayStopDetailBg(bgPhoto);
}

function startBdayStopPhotos(stopId) {
  if (window._bdayStopPhotosStarted[stopId]) return;
  if (!window.db) return;
  window._bdayStopPhotosStarted[stopId] = true;
  window.db.collection('birthdayStopPhotos').where('stopId','==',stopId).limit(80).onSnapshot(function(snap){
    var arr = [];
    snap.forEach(function(doc){ arr.push(Object.assign({ _id: doc.id }, doc.data())); });
    arr.sort(function(a,b){ return (b.ts || 0) - (a.ts || 0); });
    window._bdayStopPhotosData[stopId] = arr;
    if (window._bdayCurrentStop === stopId) renderBdayStopPhotos(arr);
  }, function(err){
    console.error('Birthday stop photos error:', err);
    window._bdayStopPhotosStarted[stopId] = false;
    if (typeof ib_toast==='function') ib_toast('Photos unavailable — check Firestore rules');
  });
}

function startBdayStopPrimaryPhoto(stopId) {
  if (window._bdayStopPrimaryStarted[stopId]) return;
  if (!window.db) return;
  window._bdayStopPrimaryStarted[stopId] = true;
  window.db.collection('birthdayStopPrimaryPhoto').doc(stopId).onSnapshot(function(doc){
    window._bdayStopPrimaryPhotoId[stopId] = doc.exists ? doc.data().photoId : null;
    if (window._bdayCurrentStop === stopId) renderBdayStopPhotos(window._bdayStopPhotosData[stopId] || []);
  }, function(err){
    console.error('Birthday stop primary photo error:', err);
    window._bdayStopPrimaryStarted[stopId] = false;
  });
}

function setBdayStopPrimaryPhoto(photoId) {
  var stopId = window._bdayCurrentStop;
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!stopId || !user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in to do that'); return; }
  window.db.collection('birthdayStopPrimaryPhoto').doc(stopId).set({ photoId: photoId, setByUid: user.uid, ts: Date.now() })
    .then(function(){ if (typeof ib_toast==='function') ib_toast('Set as background'); })
    .catch(function(err){ console.error('Set birthday stop primary photo error:', err); if (typeof ib_toast==='function') ib_toast('Could not set — check Firestore rules'); });
}

function setBdayStopPrimaryPhotoFromViewer() {
  var stopId = window._bdayCurrentStop;
  if (!stopId) return;
  var photos = window._bdayStopPhotosData[stopId] || [];
  var p = photos[window._bdayStopPhotoViewerIndex];
  if (!p || !p._id) return;
  setBdayStopPrimaryPhoto(p._id);
}

function addBdayStopPhoto(input) {
  if (!input.files || !input.files.length) return;
  var stopId = window._bdayCurrentStop;
  var s = _bdayStopById(stopId);
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!stopId || !s || !user || !window.db) { if (typeof ib_toast==='function') ib_toast('Sign in to add photos'); return; }
  var author = (window.userData && window.userData.name) || 'You';
  var files = Array.from(input.files);
  if (typeof ib_toast==='function') ib_toast('Uploading…');
  files.forEach(function(file){
    var reader = new FileReader();
    reader.onload = function(e){
      _downscaleImage(e.target.result, 1000, function(small){
        window.db.collection('birthdayStopPhotos').add({ stopId: stopId, uid: user.uid, author: author, photo: small, ts: Date.now() })
          .then(function(){ _postBdayStopPhotoSystemMessage(stopId, author); })
          .catch(function(err){ console.error('Add birthday stop photo error:', err); if (typeof ib_toast==='function') ib_toast('Photos unavailable — check Firestore rules'); });
      });
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function _postBdayStopPhotoSystemMessage(stopId, author) {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  var s = _bdayStopById(stopId);
  if (!user || !window.db || !s) return;
  var text = (author || 'Someone') + ' added a photo 📷 to ' + s.emoji + ' ' + s.name;
  window.db.collection('birthdayStopChat').add({ stopId: stopId, uid: user.uid, author: author || 'Someone', text: text, ts: Date.now(), system: true })
    .catch(function(err){ console.error('Post birthday stop photo message error:', err); });
  _postBirthdayFeedNotice(text);
}

function openBdayStopPhoto(i) {
  var stopId = window._bdayCurrentStop;
  if (!stopId) return;
  var photos = window._bdayStopPhotosData[stopId] || [];
  var p = photos[i];
  if (!p) return;
  window._bdayStopPhotoViewerIndex = i;
  window._bdayStopPhotoViewerSrc = p.photo;
  var img = document.getElementById('bday-stop-photo-viewer-img');
  var del = document.getElementById('bday-stop-photo-viewer-delete');
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (img) img.src = p.photo;
  if (del) del.style.display = (user && p.uid === user.uid) ? 'block' : 'none';
  var viewer = document.getElementById('bday-stop-photo-viewer');
  if (viewer) viewer.style.display = 'flex';
}

function closeBdayStopPhoto() {
  var viewer = document.getElementById('bday-stop-photo-viewer');
  if (viewer) viewer.style.display = 'none';
}

function bdayStopPhotoNav(delta) {
  var stopId = window._bdayCurrentStop;
  if (!stopId) return;
  var photos = window._bdayStopPhotosData[stopId] || [];
  var newIndex = (window._bdayStopPhotoViewerIndex || 0) + delta;
  if (newIndex < 0 || newIndex >= photos.length) return;
  openBdayStopPhoto(newIndex);
}

var _bdayStopPhotoSwipeStartX = null;
function bdayStopPhotoSwipeStart(e) { if (e.touches && e.touches.length === 1) _bdayStopPhotoSwipeStartX = e.touches[0].clientX; }
function bdayStopPhotoSwipeEnd(e) {
  if (_bdayStopPhotoSwipeStartX === null) return;
  var endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : _bdayStopPhotoSwipeStartX;
  var delta = endX - _bdayStopPhotoSwipeStartX;
  _bdayStopPhotoSwipeStartX = null;
  if (Math.abs(delta) < 40) return;
  bdayStopPhotoNav(delta < 0 ? 1 : -1);
}

function bdayStopPhotoDownload() {
  var src = window._bdayStopPhotoViewerSrc;
  if (!src) return;
  fetch(src).then(function(res){ return res.blob(); }).then(function(blob){
    var file = new File([blob], 'innings-birthday-photo.jpg', { type: blob.type || 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(function(){});
    } else {
      var a = document.createElement('a');
      a.href = src;
      a.download = 'innings-birthday-photo.jpg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (typeof ib_toast === 'function') ib_toast('Downloaded — check your Files or Downloads');
    }
  }).catch(function(err){
    console.error('Birthday photo download error:', err);
    if (typeof ib_toast === 'function') ib_toast('Could not download — try pressing and holding the photo instead');
  });
}

function deleteBdayStopPhoto() {
  var stopId = window._bdayCurrentStop;
  if (!stopId) return;
  var photos = window._bdayStopPhotosData[stopId] || [];
  var p = photos[window._bdayStopPhotoViewerIndex];
  if (!p || !p._id || !window.db) return;
  window.db.collection('birthdayStopPhotos').doc(p._id).delete()
    .then(function(){ closeBdayStopPhoto(); if (typeof ib_toast==='function') ib_toast('Photo deleted'); })
    .catch(function(err){ console.error('Delete birthday stop photo error:', err); if (typeof ib_toast==='function') ib_toast('Could not delete — try again'); });
}

// ── OWNER-ONLY EDITING — one shared modal, populated per context. Writes
// the whole birthdayEvent/main doc back each time (simpler and safer than
// trying to update one array element in place), so every field always
// reflects exactly what's in window._bdayEventData. ──
window._bdayEditContext = null;
window._bdayEditAnim = null;

function openBdayHeroEdit() {
  if (!_bdayIsOwner()) return;
  window._bdayEditContext = 'hero';
  var data = window._bdayEventData || {};
  var titleEl = document.getElementById('bday-edit-title');
  if (titleEl) titleEl.textContent = 'Edit event';
  var body = document.getElementById('bday-edit-body');
  if (body) {
    body.innerHTML =
      '<div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Title</div>' +
      '<input id="bday-edit-title-input" value="' + _escapeHtml(data.title || "Nate's Birthday") + '" style="width:100%;background:var(--bg);border:0.5px solid var(--rule);border-radius:12px;padding:11px 14px;font-size:14px;color:var(--black);outline:none;font-family:inherit;margin-bottom:16px">' +
      '<div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Date</div>' +
      '<input type="date" id="bday-edit-date-input" value="' + _escapeHtml(data.date || '') + '" style="width:100%;background:var(--bg);border:0.5px solid var(--rule);border-radius:12px;padding:11px 14px;font-size:14px;color:var(--black);outline:none;font-family:inherit;margin-bottom:16px">';
  }
  var saveBtn = document.getElementById('bday-edit-save-btn');
  if (saveBtn) saveBtn.onclick = saveBdayHeroEdit;
  var modal = document.getElementById('bday-edit-modal');
  if (modal) modal.style.display = 'flex';
}

function saveBdayHeroEdit() {
  var titleInput = document.getElementById('bday-edit-title-input');
  var dateInput = document.getElementById('bday-edit-date-input');
  var title = titleInput && titleInput.value.trim() ? titleInput.value.trim() : "Nate's Birthday";
  var date = dateInput ? dateInput.value : '';
  window._bdayEventData = window._bdayEventData || {};
  window._bdayEventData.title = title;
  window._bdayEventData.date = date;
  if (window.db) {
    window.db.collection('birthdayEvent').doc('main').set({ title: title, date: date }, { merge: true })
      .then(function(){ if (typeof ib_toast === 'function') ib_toast('Updated'); })
      .catch(function(err){ console.error('Save birthday hero edit error:', err); if (typeof ib_toast === 'function') ib_toast('Could not save — try again'); });
  }
  renderBdayState();
  closeBdayEditModal();
}

function openBdayStopEdit(stopId) {
  if (!_bdayIsOwner() || !stopId) return;
  var s = _bdayStopById(stopId);
  if (!s) return;
  window._bdayEditContext = { type: 'stop', stopId: stopId };
  window._bdayEditAnim = s.anim;
  var titleEl = document.getElementById('bday-edit-title');
  if (titleEl) titleEl.textContent = 'Edit ' + (s.emoji || '') + ' ' + (s.name || 'stop');
  var body = document.getElementById('bday-edit-body');
  if (body) {
    var animSwatches = STOP_ANIM_OPTIONS.map(function(a){
      var sel = s.anim === a;
      return '<div onclick="_bdaySelectEditAnim(\'' + a + '\')" data-anim="' + a + '" class="stop-anim-swatch bday-edit-anim-swatch" style="border-color:' + (sel ? 'var(--indigo)' : 'transparent') + '">' +
        _stopAnimSwatchInnerHtml(a) +
        '<div class="bday-edit-anim-check" style="display:' + (sel ? 'flex' : 'none') + ';position:absolute;inset:0;align-items:center;justify-content:center;background:rgba(10,8,20,0.4)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>' +
      '</div>';
    }).join('');
    var animLabelsHtml = STOP_ANIM_OPTIONS.map(function(a){ return '<span style="width:48px;text-align:center;font-size:8.5px;color:var(--subtle);font-weight:600">' + STOP_ANIM_LABELS[a] + '</span>'; }).join('');
    body.innerHTML =
      '<div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Name</div>' +
      '<input id="bday-edit-stop-name" value="' + _escapeHtml(s.name) + '" style="width:100%;background:var(--bg);border:0.5px solid var(--rule);border-radius:12px;padding:11px 14px;font-size:14px;color:var(--black);outline:none;font-family:inherit;margin-bottom:16px">' +
      '<div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Time</div>' +
      '<input id="bday-edit-stop-time" value="' + _escapeHtml(s.time) + '" placeholder="e.g. 4:00 PM" style="width:100%;background:var(--bg);border:0.5px solid var(--rule);border-radius:12px;padding:11px 14px;font-size:14px;color:var(--black);outline:none;font-family:inherit;margin-bottom:16px">' +
      '<div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Where</div>' +
      '<input id="bday-edit-stop-location" value="' + _escapeHtml(s.location) + '" placeholder="Add a location" style="width:100%;background:var(--bg);border:0.5px solid var(--rule);border-radius:12px;padding:11px 14px;font-size:14px;color:var(--black);outline:none;font-family:inherit;margin-bottom:16px">' +
      '<div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">Animation</div>' +
      '<div style="display:flex;gap:9px;margin:2px 0 4px">' + animSwatches + '</div>' +
      '<div style="display:flex;gap:9px;margin-bottom:16px">' + animLabelsHtml + '</div>';
  }
  var saveBtn = document.getElementById('bday-edit-save-btn');
  if (saveBtn) saveBtn.onclick = saveBdayStopEdit;
  var modal = document.getElementById('bday-edit-modal');
  if (modal) modal.style.display = 'flex';
}

function _bdaySelectEditAnim(anim) {
  window._bdayEditAnim = anim;
  document.querySelectorAll('.bday-edit-anim-swatch').forEach(function(el){
    var isSel = el.getAttribute('data-anim') === anim;
    el.style.borderColor = isSel ? 'var(--indigo)' : 'transparent';
    var check = el.querySelector('.bday-edit-anim-check');
    if (check) check.style.display = isSel ? 'flex' : 'none';
  });
}

function saveBdayStopEdit() {
  var ctx = window._bdayEditContext;
  if (!ctx || ctx.type !== 'stop') return;
  var s = _bdayStopById(ctx.stopId);
  if (!s) return;
  var nameInput = document.getElementById('bday-edit-stop-name');
  var timeInput = document.getElementById('bday-edit-stop-time');
  var locInput = document.getElementById('bday-edit-stop-location');
  s.name = nameInput && nameInput.value.trim() ? nameInput.value.trim() : s.name;
  s.time = timeInput ? timeInput.value.trim() : s.time;
  s.location = locInput ? locInput.value.trim() : s.location;
  s.anim = window._bdayEditAnim || s.anim;
  if (window.db) {
    window.db.collection('birthdayEvent').doc('main').set({ stops: _sanitizeForFirestore((window._bdayEventData && window._bdayEventData.stops) || []) }, { merge: true })
      .then(function(){ if (typeof ib_toast === 'function') ib_toast('Stop updated'); })
      .catch(function(err){ console.error('Save birthday stop edit error:', err); if (typeof ib_toast === 'function') ib_toast('Could not save — try again'); });
  }
  selectBdayStop(ctx.stopId); // re-render this stop's backdrop/name/time/location with the new data
  closeBdayEditModal();
}

function closeBdayEditModal() {
  var modal = document.getElementById('bday-edit-modal');
  if (modal) modal.style.display = 'none';
  window._bdayEditContext = null;
}

// ── MESSAGE TO EVERYONE — a short note from Nate, shown as soon as the
// screen opens (regardless of tab). Same edit modal, a third context. ──
function renderBdayMessage() {
  var data = window._bdayEventData || {};
  var wrap = document.getElementById('bday-message-wrap');
  var textEl = document.getElementById('bday-message-text');
  var editBtn = document.getElementById('bday-edit-message-btn');
  var isOwner = _bdayIsOwner();
  if (editBtn) editBtn.style.display = isOwner ? 'flex' : 'none';
  if (!wrap || !textEl) return;
  if (data.message) {
    textEl.textContent = '💜 ' + data.message;
    textEl.style.opacity = '1';
    wrap.style.display = 'block';
  } else if (isOwner) {
    textEl.textContent = '+ Add a message to everyone';
    textEl.style.opacity = '0.55';
    wrap.style.display = 'block';
  } else {
    wrap.style.display = 'none';
  }
}

function openBdayMessageEdit() {
  if (!_bdayIsOwner()) return;
  window._bdayEditContext = 'message';
  var data = window._bdayEventData || {};
  var titleEl = document.getElementById('bday-edit-title');
  if (titleEl) titleEl.textContent = 'Message to everyone';
  var body = document.getElementById('bday-edit-body');
  if (body) {
    body.innerHTML =
      '<div style="font-size:10px;font-weight:700;color:var(--subtle);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px">Message</div>' +
      '<textarea id="bday-edit-message-input" placeholder="Say something to everyone coming..." style="width:100%;min-height:110px;background:var(--bg);border:0.5px solid var(--rule);border-radius:12px;padding:11px 14px;font-size:14px;color:var(--black);outline:none;font-family:inherit;resize:none;margin-bottom:16px">' + _escapeHtml(data.message || '') + '</textarea>';
  }
  var saveBtn = document.getElementById('bday-edit-save-btn');
  if (saveBtn) saveBtn.onclick = saveBdayMessageEdit;
  var modal = document.getElementById('bday-edit-modal');
  if (modal) modal.style.display = 'flex';
}

function saveBdayMessageEdit() {
  var input = document.getElementById('bday-edit-message-input');
  var message = input ? input.value.trim() : '';
  window._bdayEventData = window._bdayEventData || {};
  window._bdayEventData.message = message;
  if (window.db) {
    window.db.collection('birthdayEvent').doc('main').set({ message: message }, { merge: true })
      .then(function(){ if (typeof ib_toast === 'function') ib_toast('Updated'); })
      .catch(function(err){ console.error('Save birthday message error:', err); if (typeof ib_toast === 'function') ib_toast('Could not save — try again'); });
  }
  renderBdayMessage();
  closeBdayEditModal();
}

// ── ENTRY REVEAL — mirrors _playOslDayReveal, simplified: no per-stop
// who's-going clusters (a 3-stop birthday doesn't need that density), just
// the stops themselves staggering in one at a time. ──
window._bdayRevealTimers = [];
function _clearBdayRevealTimers() { window._bdayRevealTimers.forEach(clearTimeout); window._bdayRevealTimers = []; }
function _bdayRevealAfter(ms, fn) { window._bdayRevealTimers.push(setTimeout(fn, ms)); }

function _playBirthdayReveal(onDone) {
  var overlay = document.getElementById('bday-reveal');
  var eyebrow = document.getElementById('bday-reveal-eyebrow');
  var title = document.getElementById('bday-reveal-title');
  var scrollEl = document.getElementById('bday-reveal-scroll');
  var wrap = document.getElementById('bday-reveal-wrap');
  var summary = document.getElementById('bday-reveal-summary');
  var stops = (window._bdayEventData && window._bdayEventData.stops) || BIRTHDAY_STOPS_DEFAULT;
  if (!overlay || !stops.length) { if (typeof onDone === 'function') onDone(); return; }

  _clearBdayRevealTimers();
  wrap.innerHTML = '';
  summary.style.opacity = '0';
  summary.textContent = '';
  scrollEl.scrollTop = 0;
  eyebrow.style.opacity = '0'; eyebrow.style.transform = 'translateY(8px)';
  title.style.opacity = '0'; title.style.transform = 'translateY(8px)';
  overlay.style.display = 'flex';
  overlay.style.opacity = '0';

  eyebrow.textContent = 'The Plan';
  title.textContent = (window._bdayEventData && window._bdayEventData.title) || "Nate's Birthday";
  var stagger = 420;
  var startDelay = 300;

  requestAnimationFrame(function(){
    overlay.style.opacity = '1';
    eyebrow.style.opacity = '1'; eyebrow.style.transform = 'translateY(0)';
    _bdayRevealAfter(50, function(){ title.style.opacity = '1'; title.style.transform = 'translateY(0)'; });
  });

  stops.forEach(function(s, i) {
    _bdayRevealAfter(startDelay + i * stagger, function(){
      var card = document.createElement('div');
      card.style.cssText = 'width:100%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:16px;margin-bottom:10px;opacity:0;transform:translateY(16px);transition:opacity 0.32s cubic-bezier(.2,.8,.3,1),transform 0.32s cubic-bezier(.2,.8,.3,1)';
      // The Game stop gets a matchup-style card once a real game is
      // attached (box score system, same one used on memories and future
      // plans) — away @ home, a status pill, venue/time below. Falls back
      // to the plain name/time/location treatment everywhere else,
      // including Game itself before a game's been picked.
      var box = s.boxScore;
      if (s.id === 'game' && box && box.home) {
        card.innerHTML =
          '<div style="font-size:11px;font-weight:700;color:rgba(168,159,232,0.85);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;text-align:center">Stop ' + (i + 1) + '</div>' +
          '<div style="display:flex;align-items:baseline;justify-content:center;gap:10px">' +
            '<div style="flex:1;text-align:right;font-size:16px;font-weight:800;color:#fff">' + _escapeHtml(box.away || '') + '</div>' +
            '<div style="flex-shrink:0;font-size:12px;font-weight:700;color:rgba(255,255,255,0.4)">@</div>' +
            '<div style="flex:1;text-align:left;font-size:16px;font-weight:800;color:#fff">' + _escapeHtml(box.home || '') + '</div>' +
          '</div>' +
          '<div style="text-align:center;margin-top:10px">' +
            '<span style="font-size:10px;font-weight:700;color:rgba(168,159,232,0.9);background:rgba(168,159,232,0.16);padding:4px 11px;border-radius:10px;text-transform:uppercase;letter-spacing:0.05em">' + _escapeHtml(box.status || 'Scheduled') + '</span>' +
          '</div>' +
          ([box.venue, s.time].filter(Boolean).length ? '<div style="text-align:center;font-size:12px;color:rgba(255,255,255,0.45);margin-top:9px">' + _escapeHtml([box.venue, s.time].filter(Boolean).join(' · ')) + '</div>' : '');
      } else {
        var metaText = [s.time, s.location].filter(Boolean).join(' · ');
        card.innerHTML = '<div style="font-size:11px;font-weight:700;color:rgba(168,159,232,0.85);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Stop ' + (i + 1) + '</div>' +
          '<div style="font-size:19px;font-weight:800;color:white;letter-spacing:-0.3px">' + _escapeHtml((s.emoji ? s.emoji + ' ' : '') + s.name) + '</div>' +
          (metaText ? '<div style="font-size:12.5px;color:rgba(255,255,255,0.45);margin-top:5px">' + _escapeHtml(metaText) + '</div>' : '');
      }
      wrap.appendChild(card);
      requestAnimationFrame(function(){
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
        scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
      });
    });
  });

  var lastAt = startDelay + (stops.length - 1) * stagger;
  _bdayRevealAfter(lastAt + 600, function(){
    summary.textContent = stops.length + ' stop' + (stops.length === 1 ? '' : 's') + ' — see you there 🎉';
    summary.style.opacity = '1';
    scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
  });
  _bdayRevealAfter(lastAt + 2200, function(){
    overlay.style.opacity = '0';
    _bdayRevealAfter(320, function(){
      overlay.style.display = 'none';
      if (typeof onDone === 'function') onDone();
    });
  });
}

// Plays once per person, ever — tracked the same way as OSL's own
// oslRevealShown flag, just a flat boolean since there's only one day.
function _bdayMaybeShowReveal() {
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user) return;
  if (window.userData && window.userData.birthdayRevealSeen) return;
  window.userData = window.userData || {};
  window.userData.birthdayRevealSeen = true;
  if (window.db) {
    window.db.collection('users').doc(user.uid).set({ birthdayRevealSeen: true }, { merge: true }).catch(function(err){ console.error('Save birthday reveal-seen error:', err); });
  }
  _playBirthdayReveal();
}

// Manual replay from the header link — not owner-gated, since watching
// something you've already seen again is harmless either way.
function previewBirthdayReveal(evt) {
  if (evt) evt.stopPropagation();
  _playBirthdayReveal();
}
