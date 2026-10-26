// ══ HOW IT WORKS · SCENES (v7.79.0) ══════════════════════════════════════
// Every walkthrough, step by step. Each step draws the real page: the app's
// own render functions where they return markup (_mvTileHtml, _gshBarHtml,
// _bbPaTakeoverHtml, _gdlStripHtml, _mgcChip, _calRenderMonth, …) fed demo
// data, and otherwise the same classes and inline styles the page uses, so
// a walkthrough always looks like the page it explains. Timing attributes
// (data-at, data-add, hiw-tap, …) are described in how-it-works.js.
(function () {
  if (typeof hiwRegister !== 'function') return;

  // ── helpers ───────────────────────────────────────────────────────────
  function R(fn, fb) { try { var v = fn(); return v == null ? (fb || '') : v; } catch (e) { console.warn('[how it works] piece', e); return fb || ''; } }
  function X(s) { return typeof _escapeHtml === 'function' ? _escapeHtml(s) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function at(ms) { return ' data-at="' + ms + '"'; }
  function tap(sel, ms, o) {
    o = o || {};
    return '<i class="hiw-tap" data-at="' + ms + '" data-on="' + sel + '"' + (o.kind ? ' data-kind="' + o.kind + '"' : '') + (o.dx ? ' data-dx="' + o.dx + '"' : '') +
      (o.fx != null ? ' data-fx="' + o.fx + '"' : '') + (o.fy != null ? ' data-fy="' + o.fy + '"' : '') + (o.press === false ? ' data-press="no"' : '') + '></i>';
  }
  function look(sport, name, abbr, color, alt) {
    return R(function () { return _teamLook(sport, name, abbr, color, alt); }, { abbr: abbr || '', bg: color || '#3D3580', fg: '#FFFFFF', accent: alt || '#A89FE8', ring: null });
  }
  function badge(t) { return R(function () { return _glBadgeStyle(t); }, 'background:' + t.bg + ';color:' + t.fg); }
  function ini(n) { return R(function () { return _initials(n); }, String(n || '?').charAt(0)); }
  // run a renderer that reads globals, with those globals swapped in just for the call
  function withGlobals(g, fn) {
    var old = {}, k;
    for (k in g) { old[k] = window[k]; window[k] = g[k]; }
    try { return fn(); } finally { for (k in g) window[k] = old[k]; }
  }
  // glass surface (Home / Friends)
  function glPage(inner, opts) {
    opts = opts || {};
    return '<div class="hiw-pg gl" style="min-height:100%;overflow:hidden">' +
      '<div class="gl-amb"><i class="b1"' + (opts.c1 ? ' style="background:' + opts.c1 + '"' : '') + '></i><i class="b2"' + (opts.c2 ? ' style="background:' + opts.c2 + '"' : '') + '></i><i class="b3"></i></div>' +
      '<div style="position:relative;z-index:1">' + inner + '</div></div>';
  }
  function glTop(title, sub, right) {
    return '<div class="gl-top" style="padding-top:8px">' +
      '<div class="gl-hd">' + (sub ? '<small>' + X(sub) + '</small>' : '') + '<b>' + X(title) + '</b></div>' + (right || '') + '</div>';
  }
  function icon(k) { return (window.GL_ICON && GL_ICON[k]) || ''; }
  function bellBtn(n, id) {
    return '<button class="gl-ib' + (n ? ' has' : '') + '"' + (id ? ' id="' + id + '"' : '') + '>' + icon('bell') + '<span class="gl-dot">' + (n || '') + '</span></button>';
  }
  function meBtn() { return '<button class="gl-me">' + X(ini(myName())) + '</button>'; }
  function myName() { return (window.userData && window.userData.name) || 'You'; }
  function first(n) { return String(n || '').split(' ')[0]; }
  function dock(on, id) {
    var b = function (k, l) { return '<button class="gd-b' + (on === k ? ' on' : '') + '" data-k="' + k + '">' + icon(k) + l + '</button>'; };
    return '<nav class="hiw-dock"' + (id ? ' id="' + id + '"' : '') + '>' + b('home', 'Home') + b('games', 'Games') + b('friends', 'Friends') + b('arch', 'Archive') +
      '<button class="gd-fab" data-k="plus">' + icon('plus') + '</button></nav>';
  }
  // classic sub-screen header (Games, Notifications …)
  function subHd(title, right, back) {
    return '<div style="background:var(--card);padding:12px 16px;border-bottom:.5px solid var(--rule);display:flex;align-items:center;gap:12px">' +
      (back ? '<button style="width:34px;height:34px;border-radius:50%;background:var(--bg);border:.5px solid var(--rule);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true"><path d="M7 1L1 6.5L7 12" stroke="#C7C0E8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' : '') +
      '<div style="flex:1;font-size:16px;font-weight:700;color:#fff">' + title + '</div>' + (right || '') + '</div>';
  }

  // ── demo data ─────────────────────────────────────────────────────────
  var F = ['Jordan', 'Priya', 'Sam', 'Alex']; // the same demo friends the What's new screen uses
  var AWAY = 'Los Angeles Dodgers', HOME = 'San Francisco Giants';
  function LAD() { return look('mlb', AWAY, 'LAD'); }
  function SF() { return look('mlb', HOME, 'SF'); }
  function demoBox(extra) {
    var b = {
      gamePk: 'hiw-demo', sport: 'mlb', away: AWAY, home: HOME, awayAbbr: 'LAD', homeAbbr: 'SF',
      awayScore: 3, homeScore: 3, gameState: 'Live', status: 'In Progress',
      situation: { inning: 9, half: 'bottom', inningState: 'Bottom', outs: 1, balls: 2, strikes: 1, bases: { first: false, second: true, third: false } },
      innings: [{ num: 1, away: 0, home: 0 }, { num: 2, away: 1, home: 0 }, { num: 3, away: 0, home: 2 }, { num: 4, away: 0, home: 0 }, { num: 5, away: 2, home: 0 }, { num: 6, away: 0, home: 0 }, { num: 7, away: 0, home: 1 }, { num: 8, away: 0, home: 0 }, { num: 9, away: 0, home: null }],
      awayHits: 7, homeHits: 8, awayErrors: 0, homeErrors: 1, allPlays: []
    };
    for (var k in (extra || {})) b[k] = extra[k];
    return b;
  }
  // the at-bat in the demo: Bailey, bottom 9, runner on second
  var PITCHES = [
    { num: 1, px: -0.95, pz: 1.55, call: 'Ball', type: 'Slider', code: 'SL', speed: 87, mph: 87.4, spin: 2712 },
    { num: 2, px: 0.12, pz: 2.9, call: 'Called Strike', type: 'Four-Seam Fastball', code: 'FF', speed: 97, mph: 97.1, spin: 2410, ivb: 17.2 },
    { num: 3, px: 1.12, pz: 2.2, call: 'Ball', type: 'Changeup', code: 'CH', speed: 88, mph: 88.2, spin: 1690 },
    { num: 4, px: -0.42, pz: 3.62, call: 'Ball', type: 'Four-Seam Fastball', code: 'FF', speed: 98, mph: 98.3, spin: 2455, ivb: 18.1 }
  ];
  function demoLp(extra) {
    var lp = {
      atBatIndex: 70, inning: 9, half: 'bottom', batter: 'Patrick Bailey', batterId: 672275, pitcher: 'Tanner Scott', pitcherId: 656945,
      batSide: 'R', pitchHand: 'L', zoneTop: 3.4, zoneBottom: 1.6, pitches: PITCHES.slice(), awayScore: 3, homeScore: 4, rbi: 1,
      eventType: 'single', event: 'Single', hit: { speed: 101.8, angle: 9, distance: 212, trajectory: 'line_drive', x: 170, y: 115 },
      runners: [{ end: 'score' }], text: 'Patrick Bailey singles on a line drive to right fielder Teoscar Hernández. Jung Hoo Lee scores.'
    };
    for (var k in (extra || {})) lp[k] = extra[k];
    return lp;
  }

  // ── shared pieces built from the app's own renderers ──────────────────
  // the friends' game hero tile on Home (_glRenderHero's markup)
  function heroTile(o) {
    o = o || {};
    var ca = LAD(), ch = SF();
    var names = o.names || [F[0], F[1]];
    var avs = names.slice(0, 2).map(function (n) { return '<span class="gl-av">' + X(ini(n)) + '</span>'; }).join('');
    var label = R(function () { return _friendsOnlyWatchingLabel(names); }, names.join(' and ') + ' are watching');
    var bases = R(function () { return _glBasesSvg({ first: false, second: true, third: false }); }, '');
    return '<button class="gl-g gl-hero"' + (o.id ? ' id="' + o.id + '"' : '') + ' style="width:100%;text-align:left;color:inherit;font-family:inherit">' +
      '<div class="gl-lh"><span class="gl-lab"><span class="gl-ldot"></span>Live</span><span class="gl-lab">MLB</span></div>' +
      '<div class="gl-board">' +
        '<div class="gl-team"><span class="gl-d" style="' + badge(ca) + '">' + X(ca.abbr || 'LAD') + '</span><span>Dodgers</span></div>' +
        '<div class="gl-score"><div class="gl-sc gl-num"><span>3</span><i></i><span>3</span></div><div class="gl-inn">Bot 9 · 1 out' + bases + '</div></div>' +
        '<div class="gl-team"><span class="gl-d" style="' + badge(ch) + '">' + X(ch.abbr || 'SF') + '</span><span>Giants</span></div>' +
      '</div>' +
      '<div class="gl-lf"><div class="gl-avs">' + avs + '</div><p>' + X(label) + '</p><span class="gl-join"' + (o.joinId ? ' id="' + o.joinId + '"' : '') + '>Join</span></div></button>';
  }
  // a row of Home's "Live now · every sport" tile (_glRenderLive's markup)
  function liveRow(lg, a, as, h, hs, st, fr, id) {
    var la = a.lo ? ' lo' : '', lh = h.lo ? ' lo' : '';
    return '<button class="gl-lrow"' + (id ? ' id="' + id + '"' : '') + '><span class="lg">' + lg + '</span><span class="tms">' +
      '<span class="gl-tl' + la + '"><span class="sw" style="background:' + a.c + '"></span><span class="ab">' + X(a.n) + '</span><span class="sc gl-num">' + as + '</span></span>' +
      '<span class="gl-tl' + lh + '"><span class="sw" style="background:' + h.c + '"></span><span class="ab">' + X(h.n) + '</span><span class="sc gl-num">' + hs + '</span></span>' +
      '</span><span class="st">' + X(st) + (fr ? '<small class="fr">' + X(fr) + '</small>' : '') + '</span></button>';
  }
  function liveTile(id) {
    var lad = LAD(), sf = SF();
    return '<div class="gl-g gl-live"' + (id ? ' id="' + id + '"' : '') + '>' +
      '<div class="gl-lh"><span class="gl-lab"><span class="gl-ldot"></span>Live now · every sport</span><span class="gl-lab">3 games</span></div>' +
      '<div class="gl-lchips"><button class="gl-lchip on">All<i>3</i></button><button class="gl-lchip">MLB<i>1</i></button><button class="gl-lchip">NFL<i>1</i></button><button class="gl-lchip">NBA<i>1</i></button></div>' +
      '<div>' +
        liveRow('MLB', { n: 'Dodgers', c: lad.accent || '#4A8FD9' }, 3, { n: 'Giants', c: sf.accent || '#FD5A1E' }, 3, 'Bot 9', F[0] + ' + 1 here', 'hiw-lr1') +
        liveRow('NFL', { n: '49ers', c: '#B3995D' }, 14, { n: 'Rams', c: '#FFA300', lo: true }, 10, 'Q2 · 4:12', '', '') +
        liveRow('NBA', { n: 'Lakers', c: '#FDB927', lo: true }, 84, { n: 'Warriors', c: '#FFC72C' }, 88, 'Q4 · 6:40', F[2] + ' here', '') +
      '</div></div>';
  }
  // a notifications row (notifications.js inline markup)
  function notifRow(who, text, sub, when, unread) {
    return '<div style="display:flex;gap:12px;align-items:center;padding:12px;border-radius:14px;' +
      (unread !== false ? 'background:linear-gradient(135deg,rgba(124,108,240,.30),rgba(168,159,232,.12));border:1px solid rgba(168,159,232,.5);box-shadow:0 6px 20px rgba(91,76,214,.18)' : 'background:var(--card);border:.5px solid var(--rule)') + '">' +
      '<div class="av av-a" style="width:36px;height:36px;font-size:12px;flex-shrink:0">' + X(ini(who)) + '</div>' +
      '<div style="flex:1;min-width:0"><div style="font-size:13.5px;color:var(--black);line-height:1.4"><b>' + X(who) + '</b> ' + text + '</div>' +
      (sub ? '<div style="font-size:12px;color:rgba(244,242,255,.72);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + X(sub) + '</div>' : '') + '</div>' +
      '<div style="font-size:11px;color:#CFC7FF;font-weight:700;flex-shrink:0;align-self:flex-start;display:flex;align-items:center;gap:6px">' +
      (unread !== false ? '<span style="width:7px;height:7px;border-radius:50%;background:#A89FE8;box-shadow:0 0 8px #A89FE8"></span>' : '') + X(when) + '</div></div>';
  }
  // the real takeover for a play, frozen at its start so it plays in the stage
  function takeover(lp, box) {
    return R(function () { return _bbPaTakeoverHtml(lp, box, { _t1: null }, 0, !!lp.hit, 0).replace(/--t0:-?[\d.]+s/, '--t0:0s'); }, '');
  }
  function walkoffGraphic(lp, box) {
    return R(function () { return _gwGraphicHtml({ lp: lp, winner: 'home', walkoff: true }, box, 0, 0); }, '');
  }
  // a chat bubble (memory-ticket.js renderGameChat markup)
  function bubble(o) {
    var mine = !!o.mine;
    var col = '<div style="display:flex;flex-direction:column;align-items:' + (mine ? 'flex-end' : 'flex-start') + ';max-width:76%;min-width:0;gap:4px">' +
      '<div class="bubble ' + (mine ? 'me' : 'them') + '"' + (o.id ? ' id="' + o.id + '"' : '') + ' style="max-width:100%">' +
        (o.quote || '') + (mine ? '' : '<div class="b-who">' + X(o.who) + '</div>') +
        '<div class="b-txt"' + (o.typeAt != null ? ' data-type="' + o.typeAt + '"' : '') + '>' + (o.html || X(o.text)) + '</div>' +
        (o.time ? '<div class="b-t">' + X(o.time) + '</div>' : '') +
      '</div>' + (o.rx || '') + '</div>';
    return '<div class="msg"' + (mine ? ' style="justify-content:flex-end"' : '') + (o.at != null ? at(o.at) : '') + '>' +
      (mine ? '' : '<div class="m-av av-b">' + X(ini(o.who)) + '</div>') + col + '</div>';
  }
  function rxBadge(map, id, ms) {
    var h = R(function () { return _reactionBadgesHtml(map, true); }, '');
    if (!h) return '';
    return '<div' + (id ? ' id="' + id + '"' : '') + (ms != null ? at(ms) + ' class="pop"' : '') + '>' + h + '</div>';
  }
  function playQuote(tag, text, mine) {
    return R(function () { return _gcPlayQuoteHtml({ author: tag, text: text, play: { tag: tag, text: text, playId: 'hiw', score: 'SF 4–3' } }, mine); }, '');
  }

  // ════ LAUNCH A · first launch for a brand-new person ═══════════════════
  function ticker() {
    var rows = [['⚾', '🏟️', '🎪', '🎸', '🐕', '🚗', '🎵', '🍺', '✈️', '🏆', '❤️', '🌅', '🎉', '⭐'], ['🎉', '🏀', '🎶', '🍕', '🌊', '🎭', '🏔️', '🎨', '🚀', '🌙', '🎤', '🦋', '🎯', '🌺'], ['📸', '⚽', '🎸', '🍺', '🏄', '🎪', '🌍', '🎵', '🏆', '🐕', '❤️', '✈️', '🎯', '⚾'], ['🌅', '🎭', '🚗', '⭐', '🎤', '🏟️', '🍕', '🌊', '🏔️', '🎨', '🚀', '🌙', '🦋', '🎉']];
    return '<div style="position:absolute;inset:0;overflow:hidden;opacity:.15;display:flex;flex-direction:column;justify-content:space-around;pointer-events:none">' +
      rows.map(function (r, i) { var s = r.map(function (e) { return '<span>' + e + '</span>'; }).join(''); return '<div class="ticker-row ' + (i % 2 ? 'right' : 'left') + '">' + s + s + '</div>'; }).join('') + '</div>';
  }
  hiwRegister('launch', {
    eyebrow: 'Welcome to Innings', done: 'Get started',
    steps: [
      {
        n: '1 OF 4', h: 'Every moment deserves a home.', p: 'A private place for the games, shows and nights you share with the people you’d actually text.',
        html: function () {
          return '<div class="ob-top" style="min-height:100%;padding:40px 32px">' + ticker() +
            '<div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center">' +
              '<div class="ob-logo pop"' + at(200) + '>Inn<em>ings</em></div>' +
              '<div class="ob-tagline"' + at(700) + '>Every moment deserves a home</div>' +
              '<div class="ob-mission"' + at(1200) + '>For the people and the moments<br>we share.</div>' +
            '</div></div>';
        }
      },
      {
        n: '2 OF 4', h: 'Watch it together.', p: 'See which friends are on the same game, at the park or on the couch, and jump into their chat.',
        html: function () {
          return glPage(
            '<div style="padding:8px 16px 0">' +
              '<div' + at(150) + '>' + heroTile({ id: 'hiw-hero', joinId: 'hiw-join' }) + '</div>' +
              '<div style="display:flex;flex-direction:column;gap:10px;margin-top:16px">' +
                bubble({ who: F[0] + ' Reyes', text: 'Bailey up. This feels like a moment.', at: 1700 }) +
                bubble({ who: F[1] + ' Shah', text: 'Runner on second, one out. Come on.', at: 2300 }) +
                bubble({ mine: true, text: 'Sitting right behind the dugout', at: 2900 }) +
              '</div>' +
            '</div>' + tap('#hiw-join', 1150), { c1: LAD().bg, c2: SF().bg });
        }
      },
      {
        n: '3 OF 4', h: 'Every play is a conversation.', p: 'Double-tap a play to react the second it happens. Reply right on it.',
        html: function () {
          var box = demoBox({ gameState: 'Final', homeScore: 4, lastPlay: demoLp() });
          return '<div class="hiw-pg" style="padding:8px 16px 0">' +
            '<div style="position:relative;height:200px;border-radius:16px;overflow:hidden;background:rgba(13,8,32,.45);border:1px solid rgba(168,159,232,.12)">' + walkoffGraphic(demoLp(), box) + '</div>' +
            '<div id="hiw-play" class="gh-plays-row" style="margin-top:12px;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)">' +
              '<div style="display:flex;gap:10px;align-items:flex-start"><span style="flex:1;font-size:13px;line-height:1.45;color:#F5F3FF">Patrick Bailey singles on a line drive to right. Jung Hoo Lee scores.</span><span class="gh-num" style="font-size:12px;color:#D9D4FA">SF 4–3</span></div>' +
              rxBadge({ a: '❤️', b: '❤️', c: '‼️', d: '❤️' }, null, 2300) +
            '</div>' +
            '<div style="margin-top:14px">' + bubble({ who: F[1] + ' Shah', quote: playQuote('B9 · 2-1', 'Patrick Bailey singles on a line drive to right. Jung Hoo Lee scores.', false), text: 'WE WERE THERE.', at: 2900 }) + '</div>' +
            tap('#hiw-play', 1500, { kind: 'dtap' }) +
          '</div>';
        }
      },
      {
        n: '4 OF 4', h: 'Then it’s yours, forever.', p: 'Save it as a memory and tag who was there. It belongs to everyone in it.',
        html: function () {
          var m = { name: 'Dodgers @ Giants', date: '2026-10-03', boxScore: demoBox({ gameState: 'Final', homeScore: 4, status: 'Final' }), attendance: 'attend', seat: { section: '118', row: '12', seat: '7' } };
          var ticket = R(function () { return _mdTicketHtml(m); }, '');
          return '<div class="hiw-pg" style="padding:8px 16px 0">' +
            '<div' + at(150) + '>' + ticket + '</div>' +
            '<div class="dn"' + at(1500) + ' style="margin-top:14px">' + notifRow(myName() === 'You' ? 'Nathan' : first(myName()), 'marked a memory with you', 'Dodgers @ Giants · Bailey walks it off', 'now', true) + '</div>' +
            '<div' + at(2300) + ' style="margin-top:10px;font-size:12px;font-weight:600;color:#C9C2F5;text-align:center">What ' + X(F[1]) + ' sees on her phone</div>' +
          '</div>';
        }
      }
    ]
  });

  // ════ HOME ═════════════════════════════════════════════════════════════
  function homeTop(n) { return glTop('Hey, ' + first(myName()), R(function () { return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }); }, ''), bellBtn(n, 'hiw-bell') + meBtn()); }
  hiwRegister('home', {
    eyebrow: 'How it works · Home',
    steps: [
      {
        h: 'Every live game, one tile.', p: 'Every sport, live right now. Tap a row to drop into that game.',
        html: function () {
          return glPage(homeTop(0) + '<div style="padding:6px 16px 0">' + liveTile('hiw-live') + '</div>' + tap('#hiw-lr1', 1500));
        }
      },
      {
        h: 'Your friends’ game, up top.', p: 'When friends are on a game it leads Home. Join drops you into their chat.',
        html: function () {
          return glPage(homeTop(0) + '<div style="padding:6px 16px 0"><div' + at(200) + '>' + heroTile({ joinId: 'hiw-join' }) + '</div></div>' + tap('#hiw-join', 1700), { c1: LAD().bg, c2: SF().bg });
        }
      },
      {
        h: 'Red only when it matters.', p: 'The number is how many are waiting: chats your friends start, memories they mark with you.',
        html: function () {
          return glPage(homeTop(2) + '<div style="padding:6px 16px 0;opacity:.6">' + liveTile() + '</div>') + tap('#hiw-bell', 900) +
            '<div class="hiw-a fade" data-at="1400" style="position:absolute;inset:0;background:var(--bg)">' + subHd('Notifications', '', true) +
              '<div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px">' +
                notifRow(F[0], 'started a chat on Dodgers @ Giants', 'Tap to ask in', '2m') +
                notifRow(F[1], 'marked a memory with you', 'Outside Lands, Day 2', '1h') +
                notifRow(F[2], 'started watching Dodgers @ Giants with you', '', '3h', false) +
            '</div></div>';
        }
      },
      {
        h: 'Everything else is one tap away.', p: 'Games for every league, Friends, your Archive, and + to save a moment.',
        html: function () {
          return glPage(homeTop(0) + '<div style="padding:6px 16px 0;opacity:.55">' + liveTile() + '</div>') +
            '<div style="position:absolute;left:0;right:0;bottom:24px">' + dock('home', 'hiw-dock') + '</div>' +
            tap('[data-k=games]', 700) + tap('[data-k=friends]', 1500) + tap('[data-k=arch]', 2300) + tap('[data-k=plus]', 3100);
        },
        dur: 4400
      }
    ]
  });

  // ════ GAMES (league picker) ═══════════════════════════════════════════
  function leagueTiles(opts) {
    opts = opts || {};
    var mv = R(function () { return multiPickTileHtml(); }, '<button class="mv-pick"><span class="nm">Multi view</span><span class="pill">Up to 4 at once</span></button>');
    mv = mv.replace('<button class="mv-pick"', '<button class="mv-pick" id="hiw-mvpick"').replace(/<span class="gsp-lv"[^>]*>[\s\S]*?<\/span>/, '<span class="gsp-lv" style="display:flex"><i></i>4 live</span>');
    var t = function (key, em, nm, ph, phc, lv) {
      return '<button class="gsp" id="hiw-gsp-' + key + '"><span class="em">' + em + '</span><span class="nm">' + nm + '</span>' +
        '<span class="ph ' + (phc || '') + '">' + ph + '</span>' + (lv ? '<span class="gsp-lv" style="display:flex"><i></i>' + lv + ' live</span>' : '') + '</button>';
    };
    return '<div id="hiw-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">' + mv +
      t('mlb', '⚾', 'MLB', 'World Series', 'post', 1) + t('nfl', '🏈', 'NFL', 'Week 8', '', 2) + t('cfb', '🏈', 'College football', 'Week 9') +
      (opts.short ? '' : t('nba', '🏀', 'NBA', 'Regular season', '', 1) + t('wnba', '🏀', 'WNBA', 'Offseason')) + '</div>';
  }
  function gamesPage(inner) {
    return '<div class="hiw-pg">' + subHd('Games') + '<div style="padding:14px 16px 0">' +
      '<div style="font-size:13.5px;color:var(--mid);margin:0 0 14px">Which league are we watching tonight?</div>' + inner + '</div></div>';
  }
  function scoreCard(o) {
    var watching = o.watching;
    return '<div' + (o.id ? ' id="' + o.id + '"' : '') + ' style="background:' + (watching ? 'rgba(124,242,156,.06)' : 'rgba(255,255,255,.055)') + ';border:' + (watching ? '1.5px solid #7CF29C;box-shadow:0 0 0 3px rgba(124,242,156,.12)' : '1px solid rgba(255,255,255,.09)') + ';border-radius:16px;padding:13px 14px;display:flex;flex-direction:column;margin-bottom:10px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px"><div style="min-width:0">' +
        '<div style="font-size:14px;font-weight:700;color:#fff">' + (o.star ? '<span style="color:#F2C869;font-size:13px;margin-right:5px">★</span>' : '') + X(o.title) + '</div>' +
        (o.watchPill ? '<div' + (o.watchAt != null ? at(o.watchAt) : '') + ' style="display:inline-flex;margin-top:5px;padding:2px 8px;border-radius:999px;background:rgba(124,242,156,.16);color:#9BE8AC;font-size:10.5px;font-weight:800;letter-spacing:.06em">WATCHING</div>' : '') +
        '<div style="font-size:11.5px;color:rgba(255,255,255,.42);margin-top:3px">' + X(o.venue) + '</div></div>' +
        (o.live ? '<div style="font-size:10px;padding:4px 10px;border-radius:20px;background:rgba(232,98,44,.2);color:#F2916A;font-weight:700;display:flex;align-items:center;gap:5px;flex-shrink:0;white-space:nowrap"><span style="width:6px;height:6px;border-radius:50%;background:#F2916A"></span>LIVE · ' + X(o.live) + '</div>'
          : '<div style="font-size:10px;padding:4px 10px;border-radius:20px;background:rgba(255,255,255,.08);color:#C7C0E8;font-weight:700;flex-shrink:0">' + X(o.time || '7:15 PM') + '</div>') +
      '</div>' + (o.detail || '') + '</div>';
  }
  hiwRegister('games', {
    eyebrow: 'How it works · Games',
    steps: [
      {
        h: 'Each tile tells you the season.', p: 'Where every league stands right now, and how many of its games are live.',
        html: function () {
          return gamesPage('<div' + at(100) + '>' + leagueTiles({ short: true }) + '</div>') +
            '<div class="hiw-a" data-at="1400" style="position:absolute;left:16px;right:16px;top:330px;padding:12px 14px;border-radius:14px;background:#2A2366;border:1px solid rgba(168,159,232,.35);font-size:12.5px;font-weight:600;color:#E9E5FF;line-height:1.45">' +
              '<b style="color:#9be8ac">1 live</b> means a game is on right now. <b style="color:#F2C869">World Series</b>, <b>Week 8</b>: where that league’s season is.</div>';
        }
      },
      {
        h: 'Tap a league for every game.', p: 'Your teams come first with a gold star. Live games show the score as it happens.',
        html: function () {
          var det = R(function () { return _glanceBaseballDetailHtml(demoBox()); }, '');
          if (det) det = '<div class="glance-detail" style="margin-top:10px;padding-top:10px;border-top:.5px solid rgba(255,255,255,.09)">' + det + '</div>';
          return gamesPage(leagueTiles()) + tap('#hiw-gsp-mlb', 500) +
            '<div class="hiw-a fade" data-at="1000" style="position:absolute;inset:0;background:var(--bg)">' +
              subHd('MLB <button class="gl-league" style="margin-left:6px">MLB' + icon('down') + '</button>', '', true) +
              '<div style="padding:14px 16px 0"><div style="font-size:11px;font-weight:800;color:#A89FE8;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">Your teams</div>' +
              '<div' + at(1300) + '>' + scoreCard({ star: true, title: 'Los Angeles Dodgers @ San Francisco Giants', venue: 'Oracle Park', live: '3–3', detail: det }) + '</div>' +
              '<div' + at(1700) + '>' + scoreCard({ title: 'New York Yankees @ Toronto Blue Jays', venue: 'Rogers Centre', time: 'Tomorrow · 5:08 PM' }) + '</div></div></div>';
        }
      },
      {
        h: 'Say how you’re watching.', p: 'Pick Watching or Attending on the game. Friends on it see you, and it can become a memory.',
        html: function () {
          var opts = '<div class="gatt-opts" role="group" style="display:inline-flex"><button class="gatt-opt" id="hiw-watch">' +
            '<span data-add="1500:on" style="display:contents"></span>Watching</button><button class="gatt-opt">Attending</button></div>';
          return '<div class="hiw-pg">' +
            '<div style="background:#08051A;border-bottom:1px solid rgba(255,255,255,.08);padding:12px 16px;display:flex;align-items:center;gap:12px">' +
              '<button style="width:34px;height:34px;border-radius:50%;background:var(--bg);border:.5px solid var(--rule);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true"><path d="M7 1L1 6.5L7 12" stroke="#C7C0E8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
              '<div style="flex:1;font-size:14.5px;font-weight:700;color:#fff">Dodgers @ Giants</div>' +
              '<button type="button" class="gtut-btn">?</button>' + opts + '</div>' +
            '<div style="padding:14px 16px 0">' +
              '<div class="gatt-strip on hiw-a" data-at="1900" style="position:relative;max-height:none;opacity:1">' +
                '<span style="flex:1;min-width:0">You’re watching · save it as a memory with who you’re with</span><button class="gatt-add">Add memory</button></div>' +
              '<div' + at(2400) + ' style="margin-top:14px">' + scoreCard({ star: true, title: 'Los Angeles Dodgers @ San Francisco Giants', venue: 'Oracle Park', live: '3–3', watching: true, watchPill: true }) + '</div>' +
            '</div></div>' + tap('#hiw-watch', 1350);
        },
        run: function (stage) { setTimeout(function () { var b = stage.querySelector('#hiw-watch'); if (b) b.classList.add('on'); }, 1550); }
      },
      {
        h: 'Four games at once.', p: 'Multi view sits first. It fills itself with what’s live, your friends’ games first.',
        html: function () {
          return gamesPage(leagueTiles()) + tap('#hiw-mvpick', 900) +
            '<div class="hiw-a fade" data-at="1400" style="position:absolute;inset:0;background:var(--bg)">' + mvPage(false) + '</div>';
        }
      }
    ]
  });

  // ════ MULTI VIEW ═══════════════════════════════════════════════════════
  function mvEntries() {
    return [
      { sport: 'mlb', gamePk: 'hiw1', away: AWAY, home: HOME, phase: 'live', g: { awayScore: 3, homeScore: 3, inningState: 'Bottom', inningHalf: 'bottom', inning: 9, balls: 2, strikes: 1, outs: 1, bases: { first: false, second: true, third: false }, batter: 'Patrick Bailey', pitcher: 'Tanner Scott', awayAbbr: 'LAD', homeAbbr: 'SF' } },
      { sport: 'nfl', gamePk: 'hiw2', away: 'San Francisco 49ers', home: 'Los Angeles Rams', phase: 'live', g: { awayScore: 14, homeScore: 10, awayAbbr: 'SF', homeAbbr: 'LAR', awayColor: '#AA0000', awayAlt: '#B3995D', homeColor: '#003594', homeAlt: '#FFA300', statusDetail: 'Q2 · 4:12', sit: { dd: '2nd & 6', spot: 'LAR 34', poss: 'SF' } } },
      { sport: 'nba', gamePk: 'hiw3', away: 'Los Angeles Lakers', home: 'Golden State Warriors', phase: 'live', g: { awayScore: 84, homeScore: 88, awayAbbr: 'LAL', homeAbbr: 'GSW', awayColor: '#552583', awayAlt: '#FDB927', homeColor: '#1D428A', homeAlt: '#FFC72C', statusDetail: 'Q4 · 6:40' } },
      { sport: 'nhl', gamePk: 'hiw4', away: 'Vegas Golden Knights', home: 'San Jose Sharks', phase: 'live', g: { awayScore: 1, homeScore: 2, awayAbbr: 'VGK', homeAbbr: 'SJ', awayColor: '#333F42', awayAlt: '#B4975A', homeColor: '#006D75', homeAlt: '#EA7200', statusDetail: '2nd · 11:02' } }
    ];
  }
  function mvTiles(edit) {
    var list = mvEntries();
    var tiles = list.map(function (e, i) {
      return R(function () {
        return withGlobals({ _mv: { flags: {}, glance: {}, pa: {} }, _friendsWatchingCache: { byGame: i === 0 ? { hiw1: { uids: ['f1', 'f2'] } } : {} }, _friendNameCache: { f1: F[0], f2: F[1] }, _watchingList: [] },
          function () { return _mvTileHtml(e, i); });
      }, '<div class="mv-tile"><button class="mv-open"><span class="mv-top"><span class="lg">' + e.sport.toUpperCase() + '</span></span></button></div>');
    }).join('');
    return '<div class="mv-grid' + (edit ? '' : '') + '" id="hiw-mvgrid">' + tiles + '</div>';
  }
  function mvPage(edit, extra) {
    return '<div class="hiw-pg" style="background:var(--bg)"><div class="mv-hd" style="padding-top:10px">' +
      '<button class="mv-back" aria-label="Back"><svg width="9" height="15" viewBox="0 0 8 13" fill="none" aria-hidden="true"><path d="M7 1L1 6.5L7 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<div class="mv-title">Multi view<span class="mv-live"><i></i>4 LIVE</span></div><button class="mv-edit" id="hiw-mvedit">' + (edit ? 'Done' : 'Edit board') + '</button></div>' +
      '<div class="mv-body' + (edit ? ' mv-editing' : '') + '" id="hiw-mvbody" style="padding:0 12px">' + mvTiles(edit) + (extra || '') + '</div></div>';
  }
  hiwRegister('multi', {
    eyebrow: 'How it works · Multi view',
    steps: [
      {
        h: 'Four games, one screen.', p: 'The strike zone, the field position, the shot, the shots on goal. Each tile speaks its sport.',
        html: function () { return '<div' + at(100) + '>' + mvPage(false) + '</div>'; }
      },
      {
        h: 'Tap a tile to open it.', p: 'You go straight into that game. Back brings you to the board, still running.',
        html: function () {
          var bar = R(function () { return withGlobals({ _gdPregame: { heroBox: demoBox() } }, function () { return _gshBarHtml(); }); }, '');
          return mvPage(false) + tap('#hiw-mvgrid .mv-tile:first-child', 900) +
            '<div class="hiw-a pop" data-at="1400" style="position:absolute;inset:0;background:#08051A">' +
              '<div class="gsb on" style="position:relative;left:auto;right:auto;margin:10px 16px 0;opacity:1">' + bar + '</div>' +
              stageSquare({ upTo: 3 }) + '</div>';
        }
      },
      {
        h: 'Edit to change the board.', p: 'Tap Edit board, take a game off with ×, then add one from Also live. Up to four.',
        html: function () {
          var also = '<div class="hiw-a" data-at="1500" style="margin:14px 0 0"><div class="mv-sec" style="font-size:11px;font-weight:800;letter-spacing:.14em;color:#9C95D0;margin:0 4px 8px">ALSO LIVE</div>' +
            '<div class="mv-also" id="hiw-also"><span class="sc"><span>BUF 17</span><span>MIA 10</span><small>Q3</small></span><button>Add to board</button></div></div>';
          return '<div class="hiw-scroll" data-add="1700:on" style="--y:-300px">' + mvPage(false, also) + '</div>' + tap('#hiw-mvedit', 500) + tap('#hiw-also button', 2800);
        },
        run: function (stage) {
          setTimeout(function () { var b = stage.querySelector('#hiw-mvbody'), e = stage.querySelector('#hiw-mvedit'); if (b) b.classList.add('mv-editing'); if (e) e.textContent = 'Done'; }, 750);
          setTimeout(function () { var x = stage.querySelector('#hiw-mvgrid .mv-tile:last-child'); if (x) x.classList.add('hiw-gone'); }, 1300);
        }
      },
      {
        h: 'It stays put.', p: 'Close Innings mid-game and your board is waiting at the top of Home, right where you left it.',
        html: function () {
          var board = mvEntries();
          var tiles = board.map(function (e, i) {
            return R(function () {
              return withGlobals({ _mv: { flags: {}, glance: {}, pa: {} } }, function () {
                var t = _mvTeams(e, 'mvh'), atBat = e.sport === 'mlb' && e.g.bases;
                return '<button class="mvh-t"><span class="mvh-top"><span>' + X(_mvLeague(e.sport)) + '</span><span class="st live">' + X(_mvStatus(e.sport, e.g, e.phase)) + '</span></span>' +
                  '<span class="mvh-tm">' + t.html + '</span><span class="mvh-sit">' + (atBat ? _mvBases(e.g.bases, 24, 18) : '') + '<span>' + X(_mvSitLine(e, t.ca, t.ch, null)) + '</span></span></button>';
              });
            }, '');
          }).join('');
          return glPage(glTop('Hey, ' + first(myName()), '', bellBtn(0) + meBtn()) +
            '<div style="padding:6px 16px 0"><div class="gl-g mvh hiw-a" data-at="300">' +
              '<div class="gl-lh"><span class="gl-lab"><span class="gl-ldot"></span>Your multi view · 4 live</span><button class="mvh-x" aria-label="Close multi view">' + R(function () { return MV_X; }, '×') + '</button></div>' +
              '<div class="mvh-grid">' + tiles + '</div>' +
              '<div class="gl-lf"><p>Right where you left it</p><button class="gl-join mvh-open">Open multi view</button></div></div></div>');
        }
      }
    ]
  });

  // ════ FLOATING BELL ═══════════════════════════════════════════════════
  function bellDock(n, cls) {
    return '<div class="gbell-dock ' + (cls == null ? 'in' : cls) + '" style="position:absolute">' +
      '<button type="button" class="gbell has" id="hiw-gbell" style="--gbell-ring:#FD5A1E"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>' +
      '<span class="gbell-n">' + n + '</span></button><span class="gbell-peek unread"></span></div>';
  }
  function gameBg() {
    var bar = R(function () { return withGlobals({ _gdPregame: { heroBox: demoBox() } }, function () { return _gshBarHtml(); }); }, '');
    return '<div class="hiw-pg" style="background:#08051A;min-height:100%;opacity:.55">' +
      '<div class="gsb on" style="position:relative;left:auto;right:auto;margin:10px 16px 0;opacity:1">' + bar + '</div>' + stageSquare({ upTo: 3 }) + '</div>';
  }
  hiwRegister('bell', {
    eyebrow: 'How it works · The bell',
    steps: [
      {
        h: 'The bell comes to you.', p: 'On sports pages it only shows up when something’s new, and rings once so you notice.',
        html: function () { return gameBg() + bellDock(1, ''); },
        run: function (stage) {
          setTimeout(function () { var d = stage.querySelector('.gbell-dock'), b = stage.querySelector('.gbell'); if (d) d.classList.add('in'); if (b) setTimeout(function () { b.classList.add('new'); }, 480); }, 700);
        }
      },
      {
        h: 'Tap to read.', p: 'It opens your notifications, then slides away.',
        html: function () {
          return gameBg() + bellDock(1) + tap('#hiw-gbell', 700) +
            '<div class="hiw-a fade" data-at="1200" style="position:absolute;inset:0;background:var(--bg)">' + subHd('Notifications', '', true) +
            '<div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px">' + notifRow(F[0], 'invited you to the Dodgers @ Giants chat', 'Tap to join', 'now') + notifRow(F[1], 'marked a memory with you', 'Outside Lands, Day 2', '1h', false) + '</div></div>';
        }
      },
      {
        h: 'Not now? Flick it away.', p: 'Swipe the bell to the right to tuck it away. It stays unread.',
        html: function () { return gameBg() + bellDock(2) + tap('#hiw-gbell', 600, { dx: 90, press: false }); },
        run: function (stage) { setTimeout(function () { var d = stage.querySelector('.gbell-dock'); if (d) d.classList.remove('in'); }, 1100); }
      },
      {
        h: 'Want it back?', p: 'Swipe left along the bottom edge of the screen, anytime. The red strip means something’s waiting.',
        html: function () {
          return gameBg() + '<div class="gbell-dock" style="position:absolute" id="hiw-gbd">' +
            '<button type="button" class="gbell has" id="hiw-gbell" style="--gbell-ring:#FD5A1E"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg><span class="gbell-n">2</span></button>' +
            '<span class="gbell-peek unread" id="hiw-peek"></span></div>' + tap('#hiw-peek', 500, { dx: -160, press: false });
        },
        run: function (stage) { setTimeout(function () { var d = stage.querySelector('#hiw-gbd'), b = stage.querySelector('.gbell'); if (d) d.classList.add('in'); if (b) setTimeout(function () { b.classList.add('new'); }, 480); }, 1400); }
      }
    ]
  });

  // the live at-bat square (used by several walkthroughs) — the app's own
  // rail, zone and pitch strip for the demo at-bat
  function demoSeq(upTo) {
    var ps = PITCHES.slice(0, upTo || PITCHES.length);
    return { zoneTop: 3.4, zoneBottom: 1.6, batSide: 'R', atBatIndex: 70, pitches: ps };
  }
  function zoneSvg(seq) {
    return R(function () {
      var svg = _strikeZoneSectionHtml(seq, null, null, null, true).svg;
      if (typeof _bbZoneGlow === 'function') svg = _bbZoneGlow(svg, seq);
      return svg;
    }, '');
  }
  function stageSquare(o) {
    o = o || {};
    var seq = demoSeq(o.upTo), box = demoBox({ pitchSequence: seq, matchup: { batter: { name: 'Patrick Bailey' }, pitcher: { name: 'Tanner Scott' } } });
    var lastP = seq.pitches[seq.pitches.length - 1];
    var rail = R(function () { return withGlobals({ _activeBrowseGame: { gamePk: 'hiw-demo', sport: 'mlb' } }, function () { return _gstRailHtml(box.situation, seq, box); }); }, '');
    var l3 = R(function () { return _gstL3Html({ name: 'Tanner Scott' }, { name: 'Patrick Bailey' }, box); }, '');
    return '<div class="gst" style="margin:12px 16px 0"><div class="gst-sq">' + rail +
      '<div class="gst-pf" style="position:relative">' + zoneSvg(seq) + (o.over || '') + '</div>' + l3 + '</div></div>';
  }
  window._hiwParts = { R: R, X: X, at: at, tap: tap, look: look, badge: badge, ini: ini, withGlobals: withGlobals, glPage: glPage, glTop: glTop, icon: icon, bellBtn: bellBtn, meBtn: meBtn, myName: myName, first: first, dock: dock, subHd: subHd,
    F: F, AWAY: AWAY, HOME: HOME, LAD: LAD, SF: SF, demoBox: demoBox, demoLp: demoLp, PITCHES: PITCHES, demoSeq: demoSeq, zoneSvg: zoneSvg, stageSquare: stageSquare,
    heroTile: heroTile, liveTile: liveTile, notifRow: notifRow, takeover: takeover, bubble: bubble, rxBadge: rxBadge, playQuote: playQuote, gameBg: gameBg, scoreCard: scoreCard };
})();

// ── part 2: the baseball game page ─────────────────────────────────────
(function () {
  if (typeof hiwRegister !== 'function' || !window._hiwParts) return;
  var P = window._hiwParts, R = P.R, X = P.X, at = P.at, tap = P.tap, F = P.F;
  var BACK = '<button style="width:34px;height:34px;border-radius:50%;background:var(--bg);border:.5px solid var(--rule);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="8" height="13" viewBox="0 0 8 13" fill="none" aria-hidden="true"><path d="M7 1L1 6.5L7 12" stroke="#C7C0E8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
  var TV = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8"/></svg>';
  function attOpts(on, ids) {
    return '<div class="gatt-opts" role="group" style="flex-shrink:0"><button class="gatt-opt' + (on === 'watch' ? ' on' : '') + '"' + (ids ? ' id="hiw-att-w"' : '') + '>' + (on === 'watch' ? TV : '') + 'Watching</button>' +
      '<button class="gatt-opt' + (on === 'attend' ? ' on' : '') + '"' + (ids ? ' id="hiw-att-a"' : '') + '>Attending</button></div>';
  }
  function gameHd(title, on) {
    return '<div class="hiw-hd"><div style="padding:10px 16px 12px;display:flex;align-items:center;gap:12px">' + BACK +
      '<div style="flex:1;min-width:0;font-size:14.5px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + X(title || 'Dodgers @ Giants') + '</div>' +
      '<button type="button" class="gtut-btn" id="hiw-q">?</button>' + attOpts(on) + '</div></div>';
  }
  var TABS = [['sheet', 'Cheat sheet'], ['plays', 'Plays'], ['box', 'Box'], ['chat', 'Chat'], ['watch', 'Watch & Listen'], ['rules', 'Rules']];
  function tabs(on, scroll) {
    return '<div class="hiw-tabs"' + (scroll ? ' style="transform:translateX(' + scroll + 'px)"' : '') + '>' + TABS.map(function (t) { return '<button id="hiw-tab-' + t[0] + '"' + (t[0] === on ? ' class="on"' : '') + '>' + X(t[1]) + '</button>'; }).join('') + '</div>';
  }
  function scoreBug(box) {
    return R(function () { return P.withGlobals({ _gdPregame: { heroBox: box || P.demoBox() } }, function () { return _gshBarHtml(); }); }, '');
  }
  function bugBar(box, extra) {
    return '<div class="hiw-hd" style="padding:8px 16px 10px"><div class="gsb on" style="position:relative;left:auto;right:auto;top:auto">' + scoreBug(box) + (extra || '') + '</div></div>';
  }
  function lineScore(box) {
    return R(function () { var m = _ghModelFromMlbBox(box); return _ghLineScoreHero(m, box.situation, null); }, '');
  }
  // the Statcast panel under the square, for one pitch (what a single tap shows)
  function pitchPanel(n) {
    var p = P.PITCHES[n - 1], box = P.demoBox();
    return R(function () {
      var rows = _patPitchRows(p, { zoneTop: 3.4, zoneBottom: 1.6, batSide: 'R', pitcherId: null });
      return _bbPaPanelHtml({ pitches: P.PITCHES, atBatIndex: 70 }, box, { label: 'B9 · PITCH ' + n + ' OF 4', hold: true, still: true, rows: rows, seq: { pick: '70', sel: String(n) } });
    }, '');
  }
  function strip(sel) {
    var seq = P.demoSeq(), box = P.demoBox({ pitchSequence: seq });
    var h = R(function () { return P.withGlobals({ _patSel: sel ? { abi: '70', num: String(sel) } : null, _activeBrowseGame: { gamePk: 'hiw-demo', sport: 'mlb' } }, function () { return _gstStripHtml(seq, box, box.situation); }); }, '');
    return h;
  }
  hiwRegister('game', {
    eyebrow: 'How it works · Game page',
    steps: [
      {
        h: 'The scoreboard tucks away.', p: 'The line score shows for a moment, then folds into the score bar. Tap the bar to pull it down.',
        html: function () {
          var box = P.demoBox();
          return '<div class="hiw-pg" style="background:#08051A">' +
            '<div data-off="1900">' + P.R(function () { return gameHd(); }, '') + tabs('sheet') + '<div style="padding:12px 16px 0">' + lineScore(box) + '</div></div>' +
            '<div class="hiw-a fade" data-at="2000" style="position:absolute;left:0;right:0;top:0">' + bugBar(box) + tabs('sheet') + P.stageSquare({ upTo: 3 }) + '</div>' +
            tap('.gsb-bug', 3000) +
          '</div>';
        }
      },
      {
        h: 'Tap any pitch.', p: 'The panel under the square switches to it: velo and spin, ranked against the league.',
        html: function () {
          var box = P.demoBox();
          return '<div class="hiw-pg" style="background:#08051A">' + bugBar(box) +
            '<div class="hiw-scroll" data-add="400:on" style="--y:-250px">' + P.stageSquare() +
              '<div style="padding:0 16px"><div id="hiw-strip" style="margin-top:12px">' + strip(0) + '</div>' +
              '<div class="hiw-pan sq" style="position:relative;min-height:110px">' +
                '<div data-off="1700">' + pitchPanel(4) + '</div>' +
                '<div class="hiw-a fade" data-at="1800" style="position:absolute;inset:0">' + pitchPanel(2) + '</div>' +
              '</div></div></div>' + tap('#hiw-strip .gst-pc:nth-child(3)', 1250) + '</div>';
        }
      },
      {
        h: 'Double-tap to talk about it.', p: 'React to a pitch or say something. It goes to the game chat with the pitch attached.',
        html: function () {
          var I = { num: '2', of: 4, tag: 'B9', title: 'Pitch 2 of 4 · Bailey', line: '97.1 mph Four-Seam Fastball · Called Strike · middle', mph: '97.1', type: 'Four-Seam Fastball', call: 'Called Strike', where: 'Middle-middle', px: 0.12, pz: 2.9, zt: 3.4, zb: 1.6, key: 'hiw_70_p2' };
          var head = '<div class="pt-hd"><span class="pt-dot" style="background:' + R(function () { return _pitchCallColor(I.call); }, '#F04848') + '">2</span><div class="pt-hw"><div class="pt-t">B9 · ' + X(I.title) + '</div><div class="pt-l">' + X(I.line) + '</div></div>' +
            '<button type="button" class="pt-x" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>';
          var rail = R(function () { return P.withGlobals({ _ptReacts: {} }, function () { return _ptRailHtml(I.key, 'pitch', 'B9 · Pitch 2', 'Bailey · ' + I.line); }); }, '');
          var sheet = '<div class="pt-sh on" style="display:block;position:absolute;inset:0;z-index:5"><div class="pt-scrim" style="opacity:1"></div><div class="pt-card" style="transform:none;top:16px;bottom:auto">' +
            '<div class="pt-grab"></div>' + head + R(function () { return _ptSheetPitchHtml(I); }, '') + '<div class="pt-rxrow" id="hiw-rx">' + rail + '</div>' +
            '<div class="pt-th"><div class="pt-none">No one’s said anything about this pitch yet.</div></div>' +
            '<div class="pt-in"><label class="pt-lab"><input id="hiw-ptf" placeholder="Say something about pitch 2…" value=""></label><button type="button" class="pt-go"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>' +
            '<div class="pt-note">Goes to the game chat with the pitch attached</div></div></div>';
          return '<div class="hiw-pg" style="background:#08051A;min-height:100%">' + bugBar(P.demoBox()) + '<div style="padding:12px 16px 0" id="hiw-strip">' + strip(2) + '</div>' + P.stageSquare() +
            tap('#hiw-strip .gst-pc:nth-child(3)', 400, { kind: 'dtap' }) +
            '<div class="hiw-a up" data-at="1300" style="position:absolute;inset:0;z-index:10">' + sheet + '</div>' + tap('#hiw-rx .pt-rx', 2100) + '</div>';
        },
        run: function (stage) {
          setTimeout(function () { var b = stage.querySelector('#hiw-rx .pt-rx'); if (b) b.classList.add('on'); }, 2250);
          var t = 'Gift of a strike call', k = 0;
          setTimeout(function tick() { var f = stage.querySelector('#hiw-ptf'); if (!f || !f.isConnected) return; f.value = t.slice(0, ++k); if (k < t.length) setTimeout(tick, 45); }, 2700);
        }
      },
      {
        h: 'Every at-bat gets a moment.', p: 'A takeover in the team’s colors for every result, then the Statcast underneath.',
        html: function () {
          var lp = P.demoLp({ eventType: 'double', event: 'Double', hit: { speed: 104.6, angle: 18, distance: 352, trajectory: 'line_drive', x: 70, y: 70 }, batter: 'Heliot Ramos', rbi: 1 });
          var box = P.demoBox({ lastPlay: lp });
          var rows = [
            { l: 'xBA', v: '.640', u: '', p: null, sav: true },
            { l: 'Exit velo', v: '104.6', u: ' mph', p: 89 },
            { l: 'Distance', v: 352, u: ' ft', p: null },
            { l: 'Bat speed', v: '75.2', u: ' mph', p: 84, sav: true }
          ];
          var panel = R(function () { return _bbPaPanelHtml(lp, box, { label: 'LAST PLAY · B9', hold: true, still: true, rows: rows }); }, '');
          var held = R(function () { return _patHoldCardHtml(lp, box, null); }, '');
          return '<div class="hiw-pg" style="background:#08051A">' + bugBar(box) +
            '<div class="hiw-scroll" data-add="2600:on" style="--y:-170px">' +
            P.stageSquare({ over: '<div style="position:absolute;inset:0;border-radius:16px;overflow:hidden">' + P.takeover(lp, box) + '</div>' +
              (held ? '<div class="hiw-a fade" data-at="2500" style="position:absolute;inset:0">' + held + '</div>' : '') }) +
            '<div class="hiw-pan sq" style="padding:0 16px"><div' + at(2700) + '>' + panel + '</div></div></div></div>';
        }
      },
      {
        h: 'Everything else, one tab over.', p: 'Plays, the Box score, your Chat, Watch & Listen and the Rules. The ? replays this.',
        html: function () {
          return '<div class="hiw-pg" style="background:#08051A">' + gameHd() + '<div data-add="2300:on" class="hiw-tabslide">' + tabs('sheet') + '</div>' +
            P.stageSquare({ upTo: 3 }) +
            tap('#hiw-tab-plays', 500) + tap('#hiw-tab-box', 1100) + tap('#hiw-tab-chat', 1700) + tap('#hiw-q', 3200) + '</div>';
        },
        run: function (stage) {
          var seq = ['plays', 'box', 'chat'];
          seq.forEach(function (k, i) {
            setTimeout(function () { stage.querySelectorAll('.hiw-tabs button').forEach(function (b) { b.classList.toggle('on', b.id === 'hiw-tab-' + k); }); }, 650 + i * 600);
          });
        }
      }
    ]
  });

  // ════ DELAY ════════════════════════════════════════════════════════════
  function delayRow(pick, custom) {
    var opt = function (v, label) { var sel = pick === v; return '<button type="button" class="gatt-opt gdl-opt' + (sel ? ' on' : '') + '" id="hiw-dl-' + v + '">' + label + '</button>'; };
    var clock = R(function () { return GDL_CLOCK; }, '');
    return '<div class="gdl-r1"><span class="gdl-lab">' + clock + 'Delay</span><div class="gatt-opts gdl-opts" role="group">' +
      opt(0, 'Off') + opt(5, '5s') + opt(15, '15s') + opt(30, '30s') + opt('custom', pick === 'custom' ? '<span>' + custom + 's</span>' : 'Custom') + '</div></div>';
  }
  function dropDown(inner, on) {
    return '<div class="gsbd" style="position:relative;top:auto;transform:none;max-height:none;opacity:1;visibility:visible">' +
      '<div class="gsbd-att"><span>You’re</span><span class="gsbd-att-slot">' + attOpts(on || 'watch', true) + '</span></div>' +
      '<div class="gdl" style="display:block">' + inner + '</div>' + '<button class="gsbd-grab" aria-label="Push the scoreboard back up"></button></div>';
  }
  function dlTag(s) { return '<span class="gsb-dl" role="status">' + R(function () { return GDL_CLOCK; }, '') + s + 's behind</span>'; }
  function stripHtml(c, pre) {
    return R(function () { return P.withGlobals({ _gdlSet: { pick: 'custom', custom: 30 }, _gdl: { pre: pre || { b: 0, s: 0 } } }, function () { return _gdlStripHtml(c); }); }, '');
  }
  hiwRegister('delay', {
    eyebrow: 'How it works · TV delay',
    steps: [
      {
        h: 'Watching or Attending.', p: 'Pull the scoreboard down. On TV, Innings waits for your screen so nothing gets spoiled.',
        html: function () {
          return '<div class="hiw-pg" style="background:#08051A">' + bugBar() + tap('.gsb-bug', 400) +
            '<div class="hiw-a dn" data-at="900">' + dropDown(delayRow(0), 'attend') + '</div>' + tap('#hiw-att-w', 2000) + '</div>';
        },
        run: function (stage) { setTimeout(function () { var w = stage.querySelector('#hiw-att-w'), a = stage.querySelector('#hiw-att-a'); if (w) { w.classList.add('on'); w.innerHTML = TV + 'Watching'; } if (a) a.classList.remove('on'); }, 2200); }
      },
      {
        h: 'How far behind are you?', p: 'Off, 5, 15 or 30 seconds, or Custom. The chip on the score bar shows your delay at a glance.',
        html: function () {
          return '<div class="hiw-pg" style="background:#08051A">' +
            '<div class="hiw-hd" style="padding:8px 16px 10px"><div class="gsb on" style="position:relative;left:auto;right:auto;top:auto">' + scoreBug() + '<span class="hiw-a" data-at="1500" style="display:contents">' + dlTag(30) + '</span></div></div>' +
            dropDown(delayRow(0)) + tap('#hiw-dl-30', 900) + '</div>';
        },
        run: function (stage) { setTimeout(function () { stage.querySelectorAll('.gdl-opt').forEach(function (b) { b.classList.toggle('on', b.id === 'hiw-dl-30'); }); }, 1050); }
      },
      {
        h: 'Match my TV.', p: 'Tap the count you see on your TV, then That’s my count. Innings finds that moment in the game.',
        html: function () {
          return '<div class="hiw-pg" style="background:#08051A">' + bugBar() + dropDown(delayRow(30) + '<div id="hiw-sx">' + stripHtml(null, { b: 0, s: 0 }) + '</div>') +
            tap('#hiw-sx .gdl-sx-c.b:nth-of-type(2)', 600) + tap('#hiw-sx .gdl-sx-row:nth-child(3) .gdl-sx-c:nth-of-type(2)', 1300) + tap('#hiw-sx .gdl-sx-go', 2200) + '</div>';
        },
        run: function (stage) {
          var pick = function (row, n) { var r = stage.querySelectorAll('#hiw-sx .gdl-sx-row')[row]; if (!r) return; r.querySelectorAll('.gdl-sx-c').forEach(function (c, i) { c.classList.toggle('on', i === n); }); };
          setTimeout(function () { pick(0, 1); }, 750);
          setTimeout(function () { pick(1, 1); }, 1450);
        }
      },
      {
        h: 'Call the next pitch.', p: 'Tap Ball, Strike or Foul the moment you see it. Two calls and you’re in step with your TV.',
        html: function () {
          return '<div class="hiw-pg" style="background:#08051A">' +
            '<div class="hiw-hd" style="padding:8px 16px 10px"><div class="gsb on" style="position:relative;left:auto;right:auto;top:auto">' + scoreBug() + '<span class="hiw-a" data-at="2700" style="display:contents">' + dlTag(34) + '</span></div></div>' +
            dropDown('<div id="hiw-dlrow">' + delayRow(30) + '</div><div id="hiw-sx">' + stripHtml({ step: 'listen', taps: [], b: 1, s: 1 }) + '</div>') +
            tap('#hiw-sx .gdl-sx-bt.b', 700) + tap('#hiw-sx .gdl-sx-bt.s', 1700) + '</div>';
        },
        run: function (stage) {
          setTimeout(function () { var c = stage.querySelector('#hiw-sx .gdl-sx-cnt'); if (c) c.textContent = '2-1'; }, 900);
          setTimeout(function () {
            var x = stage.querySelector('#hiw-sx'), r = stage.querySelector('#hiw-dlrow');
            if (x) x.innerHTML = stripHtml({ step: 'done', sec: 34, b: 2, s: 2 });
            if (r) r.innerHTML = delayRow('custom', 34);
          }, 2300);
        }
      }
    ]
  });

  // ════ PLAYS ════════════════════════════════════════════════════════════
  function playRow(id, text, score, sc, opts) {
    opts = opts || {};
    return '<div class="gh-plays-row" id="' + id + '" style="border-top:' + (opts.first ? '0' : '.5px solid rgba(255,255,255,.07)') + ';padding:6px 0 6px 21px">' +
      '<div style="display:flex;gap:10px;align-items:flex-start"><span style="flex:1;font-size:13px;line-height:1.45;color:#F5F3FF">' + X(text) + '</span>' +
      '<span class="gh-num" style="font-size:12px;color:#D9D4FA">' + X(score) + '</span><button class="gh-reply" id="' + id + '-r" aria-label="Reply"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v5"/></svg></button></div>' +
      (sc ? '<div class="pbp-sc">' + sc.map(function (x) { return '<span>' + X(x) + '</span>'; }).join('') + '</div>' : '') + (opts.after || '') + '</div>';
  }
  function half(inner) {
    var sf = P.SF();
    return '<div style="border-top:.5px solid rgba(255,255,255,.07)"><button style="width:100%;display:flex;align-items:center;gap:8px;min-height:44px;background:transparent;border:0;color:#fff;padding:0;font-family:inherit">' +
      '<svg width="9" height="12" viewBox="0 0 8 13" fill="none" style="transform:rotate(90deg)" aria-hidden="true"><path d="M1 1l6 5.5L1 12" stroke="#C7C0E8" stroke-width="1.6" stroke-linecap="round"/></svg>' +
      '<span class="gh-tag" style="background:rgba(253,90,30,.2);color:' + (sf.accent || '#FD5A1E') + '">B9</span><span style="flex:1;text-align:left;font-size:13px;font-weight:700">Bottom 9th<span class="gh-sub" style="font-weight:400"> · Giants</span></span>' +
      '<span class="gh-tag" style="background:rgba(124,242,156,.16);color:#9be8ac">1 run</span></button>' +
      '<div style="display:flex;flex-direction:column;padding-bottom:6px">' + inner + '</div></div>';
  }
  var PLAYS = [
    ['hiw-p1', 'Patrick Bailey singles on a line drive to right fielder Teoscar Hernández. Jung Hoo Lee scores.', 'SF 4–3', ['101.8 mph', 'xBA .710']],
    ['hiw-p2', 'Jung Hoo Lee steals (1) 2nd base.', 'LAD 3–3', null],
    ['hiw-p3', 'Matt Chapman strikes out swinging.', 'LAD 3–3', ['Sweeper 84.1 mph']],
    ['hiw-p4', 'Jung Hoo Lee walks.', 'LAD 3–3', ['7 pitches']]
  ];
  function playsList(after) {
    return half(PLAYS.map(function (p, i) { return playRow(p[0], p[1], p[2], p[3], { first: i === 0, after: i === 0 ? (after || '') : '' }); }).join(''));
  }
  function playsPage(inner, extra) {
    return '<div class="hiw-pg" style="background:#08051A">' + P.R(function () { return bugBar(); }, '') + tabs('plays') + '<div style="padding:4px 16px 0">' + inner + '</div>' + (extra || '') + '</div>';
  }
  hiwRegister('plays', {
    eyebrow: 'How it works · Plays',
    steps: [
      {
        h: 'Every play, newest on top.', p: 'Hits, walks, steals and strikeouts, each with the numbers that matter.',
        html: function () { return playsPage('<div' + at(150) + '>' + playsList() + '</div>'); }
      },
      {
        h: 'Tap a play to relive it.', p: 'It replays right there, with its Statcast underneath.',
        html: function () {
          var lp = P.demoLp(), box = P.demoBox({ lastPlay: lp });
          var rows = [{ l: 'xBA', v: '.710', u: '', p: null, sav: true }, { l: 'Exit velo', v: '101.8', u: ' mph', p: 76 }, { l: 'Launch', v: '9°', u: '', p: null }, { l: 'Bat speed', v: '73.4', u: ' mph', p: 61, sav: true }];
          var panel = R(function () { return _bbPaPanelHtml(lp, box, { label: 'B9 · SINGLE', hold: true, still: true, rows: rows }); }, '');
          var held = R(function () { return _patHoldCardHtml(lp, box, null); }, '');
          var replay = '<div class="pai hiw-a" data-at="900" style="margin:8px 0 6px"><div class="pai-hd"><span>REPLAY</span><button class="pai-hide">Hide <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
            '<div class="pai-box">' + P.zoneSvg(P.demoSeq()) + '<div class="hiw-a fade" data-at="1000" style="position:absolute;inset:0">' + P.takeover(lp, box) + '</div>' +
            (held ? '<div class="hiw-a fade" data-at="3200" style="position:absolute;inset:0">' + held + '</div>' : '') + '</div></div><div class="pap-i hiw-a" data-at="1500">' + panel + '</div>';
          return playsPage(playsList(replay)) + tap('#hiw-p1', 400, { fx: .4 });
        }
      },
      {
        h: 'Double-tap to react.', p: 'Pick a reaction and your friends on the game see it. Reply and Copy are right there too.',
        html: function () {
          var rx = ['❤️', '👍', '👎', '😂', '‼️', '❓'].map(function (e, i) { return '<button' + (i === 4 ? ' id="hiw-ex"' : '') + ' style="--d:' + (i * 0.03) + 's">' + e + '</button>'; }).join('');
          var spot = '<div class="ms on hiw-a fade" data-at="900" style="position:absolute;inset:0;z-index:6">' +
            '<div class="ms-veil"></div>' +
            '<div class="ms-tb" style="left:16px;top:96px;--tail:40px">' + rx + '</div>' +
            '<div style="position:absolute;left:16px;right:16px;top:168px;padding:10px 12px;border-radius:14px;background:#141033;box-shadow:0 16px 34px rgba(0,0,0,.45)">' +
              '<div style="display:flex;gap:10px"><span style="flex:1;font-size:13px;line-height:1.45;color:#F5F3FF">' + X(PLAYS[0][1]) + '</span><span class="gh-num" style="font-size:12px;color:#D9D4FA">SF 4–3</span></div>' +
              '<div class="hiw-a pop" data-at="2300" style="margin-top:4px">' + R(function () { return _reactionBadgesHtml({ me: '‼️' }, true); }, '') + '</div></div>' +
            '<div class="ms-menu" style="left:16px;top:270px"><button class="ms-mi">Reply<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v5"/></svg></button><button class="ms-mi">Copy<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button></div></div>';
          return playsPage(playsList(), spot + tap('#hiw-p1', 300, { kind: 'dtap', fx: .4 }) + tap('#hiw-ex', 1800));
        },
        run: function (stage) { setTimeout(function () { var b = stage.querySelector('#hiw-ex'); if (b) b.classList.add('hit', 'on'); }, 1950); }
      },
      {
        h: 'Reply right on the play.', p: 'The arrow takes the play to the game chat. Your message carries it, so everyone knows what you mean.',
        html: function () {
          var preview = '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:12px;background:var(--bg);margin-bottom:8px"><div style="flex:1;min-width:0;border-left:2.5px solid var(--indigo);padding-left:8px">' +
            '<div style="font-size:11px;font-weight:700;color:#A89FE8">Replying to B9</div><div style="font-size:12px;color:var(--subtle);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + X(PLAYS[0][1]) + '</div></div><span style="font-size:18px;color:var(--subtle)">✕</span></div>';
          var chat = '<div class="hiw-a fade" id="hiw-pchat" data-at="900" style="position:absolute;left:0;right:0;top:0;height:100%;background:#08051A">' + bugBar() + tabs('chat') +
            '<div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px">' +
              P.bubble({ who: F[0] + ' Reyes', text: 'BAILEY', time: '9:41 PM' }) +
              P.bubble({ mine: true, quote: P.playQuote('B9', PLAYS[0][1], true), text: 'Called it. 2-1 fastball, he was sitting on it.', time: '9:42 PM', at: 2900 }) +
            '</div>' +
            '<div class="input-zone hiw-a" data-at="1300" style="position:absolute;left:0;right:0;bottom:0;flex-direction:column;align-items:stretch;gap:0;padding-bottom:30px"><div data-off="2700">' + preview + '</div>' +
              '<div style="display:flex;gap:8px;align-items:center"><div class="msg-input" style="flex:1;min-height:40px;display:flex;align-items:center"><span data-type="1700" data-off="2700">Called it. 2-1 fastball, he was sitting on it.</span></div><button class="send-btn" id="hiw-send"><i class="ti ti-send"></i></button></div></div></div>';
          return playsPage(playsList(), chat + tap('#hiw-p1-r', 450) + tap('#hiw-send', 2650));
        },
        // the chat sits over the plays list, sized to the stage so its composer lands at the bottom
        run: function (stage) { var c = stage.querySelector('#hiw-pchat'); if (c) c.style.height = stage.clientHeight + 'px'; }
      }
    ]
  });

  // ════ PLAYER CARD ══════════════════════════════════════════════════════
  function boxRows() {
    var r = function (n, nm, pos, ab, h, rbi, bb, so, id) {
      return '<div class="row" style="display:flex;gap:6px;padding:5px 0;border-top:.5px solid rgba(255,255,255,.08);font-size:11px;color:#fff">' +
        '<div style="width:14px;color:rgba(255,255,255,.65)">' + n + '</div><div style="flex:1;min-width:0"><span' + (id ? ' id="' + id + '"' : '') + ' style="text-decoration:underline;text-decoration-color:rgba(255,255,255,.35)">' + X(nm) + '</span> <span style="color:rgba(255,255,255,.65);font-size:9px">' + pos + '</span></div>' +
        [ab, h, rbi, bb, so].map(function (v) { return '<div style="width:22px;text-align:right">' + v + '</div>'; }).join('') + '</div>';
    };
    return '<div class="gbx"><div class="gh-card" style="padding:12px 14px"><div style="display:flex;gap:6px;font-size:10px;font-weight:700;letter-spacing:.06em;color:rgba(255,255,255,.65);padding-bottom:6px"><div style="width:14px"></div><div style="flex:1">GIANTS</div>' +
      ['AB', 'H', 'RBI', 'BB', 'K'].map(function (v) { return '<div style="width:22px;text-align:right">' + v + '</div>'; }).join('') + '</div>' +
      r(1, 'Jung Hoo Lee', 'CF', 3, 1, 0, 1, 0) + r(2, 'Heliot Ramos', 'LF', 4, 2, 1, 0, 1) + r(3, 'Rafael Devers', '1B', 4, 1, 2, 0, 1) + r(4, 'Matt Chapman', '3B', 4, 0, 0, 0, 2) + r(5, 'Patrick Bailey', 'C', 4, 2, 1, 0, 0, 'hiw-bailey') + '</div></div>';
  }
  function sheet(inner, top) {
    return '<div class="hiw-ps" style="position:absolute;left:0;right:0;top:' + (top || 40) + 'px;bottom:-40px;background:var(--card);border-radius:22px 22px 0 0;padding:10px 18px 18px;box-shadow:0 -20px 50px rgba(0,0,0,.5)">' +
      '<div style="width:36px;height:4px;background:rgba(255,255,255,.2);border-radius:4px;margin:6px auto 14px"></div>' +
      '<div style="font-size:15px;font-weight:700;color:#fff;text-align:center;margin-bottom:6px">Patrick Bailey</div>' + inner + '</div>';
  }
  function bio() {
    return '<div class="plb"><span><small>Age</small><b>27</b></span><span><small>Height</small><b>6\'2"</b></span><span><small>MLB season</small><b>4th</b></span></div>';
  }
  function lines(sel) {
    var row = function (lab, g, v, cls, id) {
      return '<div class="pll-r' + (cls ? ' ' + cls : '') + '"' + (id ? ' id="' + id + '"' : '') + ' style="position:relative"><span>' + lab + (g ? '<small>' + g + '</small>' : '') + '</span>' + v.map(function (x) { return '<b>' + x + '</b>'; }).join('') + '</div>';
    };
    return '<div class="pll"><div class="pll-meta">C · San Francisco Giants</div>' +
      row('2026', '', ['AVG', 'OBP', 'SLG', 'HR', 'RBI'], 'pll-h') +
      row('Regular season', '128 G', ['.241', '.302', '.371', '9', '58'], 'ssn', 'hiw-ssn') +
      row('Last 7 days', '6 G', ['.333', '.364', '.524', '1', '5'], '', 'hiw-l7') +
      row('Last 14 days', '12 G', ['.290', '.333', '.452', '1', '8']) +
      row('Last 30 days', '25 G', ['.268', '.315', '.402', '2', '13']) + '</div>';
  }
  function todayChips(on) {
    var c = function (t, i) { return '<button class="pat-chip' + (on === i ? ' on' : '') + '" id="hiw-chip' + i + '">' + t + '</button>'; };
    return '<div class="sav-sec pat-today"><div class="np-row"><span class="gh-eyebrow">Today</span><span class="np-mut">Every plate appearance</span></div>' +
      '<div class="pat-chips">' + c('B2 · 6-3', 0) + c('B5 · 1B', 1) + c('B7 · K', 2) + c('B9 · 1B', 3) + '</div></div>';
  }
  hiwRegister('player', {
    eyebrow: 'How it works · Player card',
    steps: [
      {
        h: 'Tap any player.', p: 'Tap a name in the Box score, the lineups or the at-bat. His card opens.',
        html: function () {
          return '<div class="hiw-pg" style="background:#08051A">' + bugBar() + tabs('box') + '<div style="padding:12px 16px 0">' + boxRows() + '</div>' + tap('#hiw-bailey', 500) +
            '<div class="hiw-a up" data-at="1000" style="position:absolute;inset:0">' + sheet('<div id="sq-hint" class="hiw-sqhint">Tap any stat to reply in chat</div>' + bio() + lines()) + '</div></div>';
        }
      },
      {
        h: 'Every trip to the plate.', p: 'Tap one to see it again: the takeover plays once, then holds, with its Statcast under it.',
        html: function () {
          var lp = P.demoLp(), box = P.demoBox({ lastPlay: lp });
          var to = R(function () { return _bbPaTakeoverHtml(lp, box, { _t1: null }, 0, !!lp.hit, 0).replace(/--t0:-?[\d.]+s/, '--t0:0s'); }, '');
          var rows = [{ l: 'xBA', v: '.710', u: '', p: null, sav: true }, { l: 'Exit velo', v: '101.8', u: ' mph', p: 76 }, { l: 'Launch', v: '9°', u: '', p: null }, { l: 'Bat speed', v: '73.4', u: ' mph', p: 61, sav: true }];
          var panel = R(function () { return _bbPaPanelHtml(lp, box, { label: 'B9 · SINGLE', hold: true, still: true, rows: rows }); }, '');
          return '<div class="hiw-pg" style="background:#08051A;min-height:100%">' +
            sheet('<div class="hiw-scroll" data-add="200:on" style="--y:-0px"><div id="player-sav">' + todayChips(-1) +
              '<div class="hiw-a" data-at="1100"><div class="pat-hold">' + to + '</div>' + panel + '</div></div></div>', 10) + tap('#hiw-chip3', 600) + '</div>';
        },
        run: function (stage) { setTimeout(function () { var c = stage.querySelector('#hiw-chip3'); if (c) c.classList.add('on'); }, 750); }
      },
      {
        h: 'Tap any stat to reply.', p: 'A line, a percentile, a matchup. Tap it, then Reply in chat.',
        html: function () {
          var pill = '<button class="sq-pill hiw-a pop" data-at="1000">↩ Reply in chat</button>';
          return '<div class="hiw-pg" style="background:#08051A;min-height:100%">' + bugBar() + tabs('box') +
            sheet('<div id="sq-hint" class="hiw-sqhint">Tap any stat to reply in chat</div>' + bio() + lines().replace('id="hiw-l7" style="position:relative">', 'id="hiw-l7" style="position:relative" data-add="800:sq-on">' + pill), 30) +
            tap('#hiw-l7', 600) + tap('#hiw-l7 .sq-pill', 2000) + '</div>';
        }
      },
      {
        h: 'It lands in the chat.', p: 'With the stat attached. Friends tap it to open his card right where you were.',
        html: function () {
          var q = R(function () { return _gcStatQuoteHtml({ author: 'Patrick Bailey · Last 7 days', text: '.333 AVG · .364 OBP · .524 SLG · 1 HR · 5 RBI · 6 games', stat: { player: 'Patrick Bailey', playerId: 672275, label: 'Last 7 days', text: '.333 AVG · .364 OBP · .524 SLG · 1 HR · 5 RBI · 6 games' } }, true); }, '');
          return '<div class="hiw-pg" style="background:#08051A">' + bugBar() + tabs('chat') +
            '<div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px">' +
              P.bubble({ who: F[2] + ' Okafor', text: 'Bailey has been raking lately', time: '9:38 PM' }) +
              P.bubble({ mine: true, quote: q, text: 'Hottest bat in the lineup this week', time: '9:39 PM', at: 500 }) +
              P.bubble({ who: F[2] + ' Okafor', text: 'ok that’s real', time: '9:39 PM', at: 1800 }) +
            '</div></div>';
        }
      }
    ]
  });
  window._hiwParts.tabs = tabs; window._hiwParts.bugBar = bugBar; window._hiwParts.gameHd = gameHd;
})();

// ── part 3: chat, crews, multi-game chat ───────────────────────────────
(function () {
  if (typeof hiwRegister !== 'function' || !window._hiwParts) return;
  var P = window._hiwParts, R = P.R, X = P.X, at = P.at, tap = P.tap, F = P.F;
  var SEND = '<button class="send-btn" id="hiw-send"><i class="ti ti-send"></i></button>';
  var ADD = '<button class="gc-add" aria-label="Add a photo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3.5"/></svg></button>';
  function composer(text, typeAt, extra, id) {
    return '<div class="input-zone" style="position:absolute;left:0;right:0;bottom:0;flex-direction:column;align-items:stretch;gap:0;padding-bottom:30px"' + (id ? ' id="' + id + '"' : '') + '>' + (extra || '') +
      '<div style="display:flex;gap:10px;align-items:center">' + ADD + '<div class="msg-input" style="flex:1;min-height:40px;display:flex;align-items:center;color:' + (text ? '#fff' : 'var(--subtle)') + '">' +
      (text ? '<span id="hiw-field"' + (typeAt != null ? ' data-type="' + typeAt + '"' : '') + '>' + text + '</span>' : 'Message...') + '</div>' + SEND + '</div></div>';
  }
  function chatPage(inner, bottom) {
    return '<div class="hiw-pg" style="background:var(--bg);min-height:100%">' + P.bugBar() + P.tabs('chat') +
      '<div style="padding:14px 16px 120px;display:flex;flex-direction:column;gap:10px">' + inner + '</div>' + (bottom || '') + '</div>';
  }
  function sysReact(who, tag, text, emoji, ms) {
    return '<button class="gc-sys"' + (ms != null ? at(ms) : '') + '><span class="gc-sys-e">' + emoji + '</span><span><b>' + X(who) + '</b> reacted to <b>' + X(tag) + '</b> · ' + X(text) + '</span></button>';
  }
  function replyBar(who, text) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:12px;background:var(--bg);margin-bottom:8px"><div style="flex:1;min-width:0;border-left:2.5px solid var(--indigo);padding-left:8px">' +
      '<div style="font-size:11px;font-weight:700;color:#A89FE8">Replying to ' + X(who) + '</div><div style="font-size:12px;color:var(--subtle);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + X(text) + '</div></div><span style="font-size:18px;color:var(--subtle)">✕</span></div>';
  }
  var M1 = { who: F[1] + ' Shah', text: 'Their closer’s on fumes. Three straight balls.' };

  hiwRegister('chat', {
    eyebrow: 'How it works · Game chat',
    steps: [
      {
        h: 'Everyone on this game.', p: 'Your friends’ messages and their reactions to plays, in one thread, in step with your delay.',
        html: function () {
          var typing = R(function () { return _gtyHtml([{ name: F[2] + ' Okafor' }]); }, '');
          return chatPage(
            P.bubble({ who: F[0] + ' Reyes', text: 'Down to our last three outs. Again.', time: '9:31 PM', at: 200 }) +
            sysReact(F[0], 'B9', 'Jung Hoo Lee walks', '🔥', 800) +
            P.bubble({ who: M1.who, text: M1.text, time: '9:33 PM', at: 1400 }) +
            P.bubble({ mine: true, text: 'Tying run on second', time: '9:34 PM', at: 2100 }) +
            '<div' + at(2700) + '>' + typing + '</div>', composer(''));
        }
      },
      {
        h: 'Double-tap to react.', p: 'Double-tap any message. Pick a reaction, or Reply and Copy from the menu.',
        html: function () {
          var rx = ['❤️', '👍', '👎', '😂', '‼️', '❓'].map(function (e, i) { return '<button' + (i === 0 ? ' id="hiw-heart"' : '') + '>' + e + '</button>'; }).join('');
          var lifted = '<div style="position:absolute;left:16px;top:150px;display:flex;gap:8px;max-width:80%"><div class="m-av av-b">' + X(P.ini(M1.who)) + '</div><div style="display:flex;flex-direction:column;gap:4px">' +
            '<div class="bubble them ms-lift" style="background:#241C4A"><div class="b-who">' + X(M1.who) + '</div><div class="b-txt">' + X(M1.text) + '</div></div>' +
            '<div class="hiw-a pop" data-at="2200">' + P.rxBadge({ me: '❤️' }) + '</div></div></div>';
          var spot = '<div class="ms on hiw-a fade" data-at="900" style="position:absolute;inset:0;z-index:6"><div class="ms-veil"></div>' +
            '<div class="ms-tb" style="left:40px;top:84px;--tail:30px">' + rx + '</div>' + lifted +
            '<div class="ms-menu" style="left:52px;top:236px"><button class="ms-mi">Reply</button><button class="ms-mi">Copy</button></div></div>';
          return chatPage(
            P.bubble({ who: F[0] + ' Reyes', text: 'Down to our last three outs. Again.', time: '9:31 PM' }) +
            P.bubble({ who: M1.who, text: M1.text, time: '9:33 PM', id: 'hiw-m1' }), composer('')) +
            spot + tap('#hiw-m1', 300, { kind: 'dtap' }) + tap('#hiw-heart', 1800);
        },
        run: function (stage) { setTimeout(function () { var b = stage.querySelector('#hiw-heart'); if (b) b.classList.add('hit', 'on'); }, 1950); }
      },
      {
        h: 'Reply to anything.', p: 'Reply from that menu and your message quotes theirs, even when the chat is flying.',
        html: function () {
          var q = R(function () { return _replyQuoteHtml({ author: M1.who, text: M1.text }, true); }, '');
          return chatPage(
            P.bubble({ who: M1.who, text: M1.text, time: '9:33 PM', rx: P.rxBadge({ me: '❤️' }) }) +
            P.bubble({ mine: true, quote: q, text: 'Velo’s down two ticks since the 8th too', time: '9:34 PM', at: 2700 }),
            '<div class="hiw-a" data-at="300">' + composer('Velo’s down two ticks since the 8th too', 700, '<div data-off="2500">' + replyBar(M1.who, M1.text) + '</div>') + '</div>') +
            tap('#hiw-send', 2300);
        },
        run: function (stage) { setTimeout(function () { var f = stage.querySelector('#hiw-field'); if (f) f.parentNode.innerHTML = 'Message...'; }, 2550); }
      },
      {
        h: '@ a friend to bring them in.', p: 'They get a ping, and land right in this chat when they tap it.',
        html: function () {
          var drop = '<div class="hiw-a" data-at="900" style="position:absolute;left:60px;bottom:74px;background:var(--card);border:.5px solid var(--rule);border-radius:14px;box-shadow:0 8px 24px rgba(0,0,0,.3);min-width:180px;overflow:hidden;z-index:4">' +
            '<div id="hiw-men" style="padding:10px 14px;font-size:14px;color:var(--black);border-bottom:.5px solid var(--rule)">' + F[3] + ' Kim</div>' +
            '<div style="padding:10px 14px;font-size:14px;color:var(--black)">Andrew</div></div>';
          var txt = R(function () { return _renderMessageTextWithMentions('@[' + F[3] + ' Kim](f4) get in here, bottom 9', true); }, '@' + F[3] + ' get in here, bottom 9');
          return chatPage(
            P.bubble({ who: M1.who, text: M1.text, time: '9:33 PM' }) +
            P.bubble({ mine: true, html: txt, time: '9:35 PM', at: 2200 }) +
            '<div class="gc-room join hiw-a" data-at="2900"><b>' + F[3] + ' joined the chat</b><span>You invited ' + F[3] + ' with an @ · ' + F[3] + ' sees the chat from that @ on.</span></div>',
            '<div data-off="2100">' + composer('@Al', 200) + '</div>' + drop.replace('class="hiw-a"', 'class="hiw-a" data-off="2100"')) + tap('#hiw-men', 1500);
        }
      }
    ]
  });

  // ════ CREWS ════════════════════════════════════════════════════════════
  var CREW = { name: 'Baseball Nerds', members: ['me', 'f1', 'f2', 'f3'], names: { me: 'You', f1: F[0], f2: F[1], f3: F[2] }, owner: 'me' };
  function faces(c, n) {
    var me = 'me';
    return (c.members || []).filter(function (u) { return u !== me; }).slice(0, n).map(function (u, i) {
      return '<span class="crw-av" style="background:' + R(function () { return _gcrColor(u); }, '#A89FE8') + (i ? ';margin-left:-9px' : '') + '">' + X(String(c.names[u]).charAt(0)) + '</span>';
    }).join('');
  }
  function crewRail(btnId) {
    var other = { name: 'Oracle Regulars', members: ['me', 'f5', 'f6'], names: { f5: 'Sam', f6: 'Andrew' } };
    return '<div class="crw-tiles"><div class="crw-hd"><div class="gcr-hd">Your crews</div></div><div class="crw-rail">' +
      '<div class="crw-tile"><div class="crw-faces">' + faces(CREW, 3) + '</div><div class="n">' + X(CREW.name) + '</div><div class="s">2 of 3 on this game</div><button type="button" class="crw-go"' + (btnId ? ' id="' + btnId + '"' : '') + '>Start</button></div>' +
      '<div class="crw-tile"><div class="crw-faces">' + faces(other, 3) + '</div><div class="n">Oracle Regulars</div><div class="s">2 friends</div><button type="button" class="crw-go">Start</button></div>' +
      '<button type="button" class="crw-tile crw-new" id="hiw-crwnew"><span class="plus">+</span><div class="n">New crew</div><div class="s">Pick friends, start it here</div></button>' +
      '</div><div class="crw-ws">Start a crew and everyone in it gets a notification. They see the chat from the moment they join.</div></div>';
  }
  function crewSheet() {
    var fr = function (u, nm, i) {
      return '<button type="button" class="crw-fr" id="hiw-cf' + i + '"><span class="crw-av md" style="background:' + R(function () { return _gcrColor(u); }, '#A89FE8') + '">' + nm.charAt(0) + '</span><span class="nm">' + nm + '</span><span class="crw-chk"></span></button>';
    };
    return '<div class="crw-box" style="position:absolute;left:0;right:0;top:24px;max-height:none">' +
      '<div class="crw-grab"></div><div class="crw-top"><button type="button" class="crw-x">Cancel</button><b>New crew</b><button type="button" class="crw-save" id="hiw-crsave">Create &amp; start</button></div>' +
      '<div class="crw-body"><div class="crw-lab">Name</div><div class="crw-in" style="display:flex;align-items:center"><span data-type="300">Baseball Nerds</span></div>' +
      '<div class="crw-lab">Who’s in · <span id="hiw-crn">0</span></div><div class="crw-list">' + fr('f1', F[0], 1) + fr('f2', F[1], 2) + fr('f3', F[2], 3) + fr('f5', 'Andrew', 4) + '</div>' +
      '<div class="crw-note">Create &amp; start opens this crew’s chat on this game: everyone in it gets a notification, and they see the chat from the moment they join.</div></div></div>';
  }
  hiwRegister('crews', {
    eyebrow: 'How it works · Crews',
    steps: [
      {
        h: 'Your crews, on every game.', p: 'A crew is the friends you always watch with. They sit at the top of every game’s Chat tab.',
        html: function () { return chatPage('<div' + at(200) + '>' + crewRail() + '</div>'); }
      },
      {
        h: 'Make one once.', p: 'Tap New crew, name it, pick who’s in. Create & start opens its chat right here.',
        html: function () {
          return chatPage(crewRail()) + tap('#hiw-crwnew', 400) +
            '<div class="hiw-a up" data-at="900" style="position:absolute;inset:0;background:rgba(0,0,0,.55)">' + crewSheet() + '</div>' +
            tap('#hiw-cf1', 1700) + tap('#hiw-cf2', 2200) + tap('#hiw-cf3', 2700);
        },
        run: function (stage) {
          [1, 2, 3].forEach(function (i) {
            setTimeout(function () { var b = stage.querySelector('#hiw-cf' + i); if (b) { b.classList.add('on'); b.querySelector('.crw-chk').textContent = '✓'; } var n = stage.querySelector('#hiw-crn'); if (n) n.textContent = i; }, 1850 + (i - 1) * 500);
          });
        }
      },
      {
        h: 'Everyone gets the call.', p: 'Start it and each member gets a ping with a way straight in.',
        html: function () {
          var me = P.first(P.myName()) === 'You' ? 'Nathan' : P.first(P.myName());
          return '<div class="hiw-pg" style="background:var(--bg);min-height:100%"><div style="padding:14px 16px">' +
            '<div class="hiw-a" data-at="100" style="text-align:center;margin-bottom:12px"><span style="display:inline-block;background:#0A0A0F;color:#fff;padding:10px 20px;border-radius:22px;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.4)">Baseball Nerds started · 3 notified</span></div>' +
            '<div class="eb hiw-a" data-at="900" style="font-size:10.5px;font-weight:800;letter-spacing:.16em;color:#A89FE8;margin:18px 0 10px">ON THEIR PHONES</div>' +
            '<div style="display:flex;flex-direction:column;gap:8px">' +
              ['1100', '1400', '1700'].map(function (t, i) { return '<div class="hiw-a dn" data-at="' + t + '">' + P.notifRow(me, 'started Baseball Nerds for Dodgers @ Giants · tap to join', i === 2 ? 'Jordan, Priya and Sam' : '', 'now') + '</div>'; }).join('') +
            '</div></div></div>';
        }
      },
      {
        h: 'Show up whenever.', p: 'Anyone in the crew can walk in mid-game. They see the chat from the moment they join.',
        html: function () {
          return chatPage(
            '<div class="gcr-line" style="font-size:12.5px;color:#A9A2D6">🔒 Baseball Nerds · you, ' + F[0] + ' and ' + F[1] + '</div>' +
            P.bubble({ who: F[0] + ' Reyes', text: 'Bailey on deck. Big spot.', time: '9:31 PM' }) +
            '<div class="gc-room join hiw-a" data-at="800"><b>' + F[2] + ' joined Baseball Nerds</b><span>' + F[2] + ' sees the chat from here on.</span></div>' +
            P.bubble({ who: F[2] + ' Okafor', text: 'Made it. What’s the count?', time: '9:36 PM', at: 1600 }) +
            P.bubble({ mine: true, text: '2-1, runner on second', time: '9:36 PM', at: 2300 }), composer(''));
        }
      }
    ]
  });

  // ════ MULTI-GAME CHAT ═════════════════════════════════════════════════
  function info(pk, sport, ca, ch, as, hs, status, phase) {
    return { pk: pk, g: { awayScore: as, homeScore: hs }, league: sport, label: ca.abbr + ' @ ' + ch.abbr, status: status, phase: phase || 'live', ca: ca, ch: ch };
  }
  function games() {
    return [
      info('hiw1', 'MLB', P.LAD(), P.SF(), 3, 3, 'Bot 9'),
      info('hiw2', 'NFL', P.look('nfl', 'San Francisco 49ers', 'SF', '#AA0000', '#B3995D'), P.look('nfl', 'Los Angeles Rams', 'LAR', '#003594', '#FFA300'), 14, 10, 'Q2 4:12'),
      info('hiw3', 'WNBA', P.look('wnba', 'Golden State Valkyries', 'GSV', '#4F2D7F', '#C9A9E9'), P.look('wnba', 'New York Liberty', 'NY', '#6ECEB2', '#000000'), 71, 70, 'Q3 2:14')
    ];
  }
  function chips(list, key, filter, add) {
    var multi = list.length > 1;
    var h = '';
    if (multi) h += '<button type="button" class="mgc-c all' + (filter === 'all' ? ' on' : '') + '" id="hiw-mgc-all"><span class="mgc-all">ALL</span><span class="mgc-st">' + list.length + ' live</span></button>';
    h += list.map(function (I) { return R(function () { return _mgcChip({}, I, key, filter, multi); }, '').replace('<button type="button" class="mgc-c', '<button type="button" id="hiw-mgc-' + I.pk + '" class="mgc-c'); }).join('');
    if (add !== false) h += '<button type="button" class="mgc-c add" id="hiw-mgc-add">' + R(function () { return MGC_PLUS; }, '+') + '<span>Add game</span></button>';
    return '<div class="mgc"><div class="mgc-hd"><span class="gcr-hd">' + (multi ? 'Games in this chat' : 'This chat') + '</span><span class="mgc-ct">' + (multi ? 'Every game · one thread' : 'Add any game, any sport') + '</span></div>' +
      '<div class="mgc-rail">' + h + '</div>' + (multi ? '' : '<div class="mgc-hint">Bring in another game and everyone in this chat can react to all of them right here.</div>') + '</div>';
  }
  function tag(I) { return '<span class="mgc-tag"><i style="background:' + (I.ca.accent || I.ca.bg) + '"></i>' + X(I.league + ' · ' + I.label) + '</span>'; }
  hiwRegister('multigame', {
    eyebrow: 'How it works · Multi-game chat',
    steps: [
      {
        h: 'One chat, any games.', p: 'At the top of a chat, + Add game brings in another game from any sport.',
        html: function () {
          var G = games();
          var row = function (I, btn, id) {
            return '<div class="mgc-row"><span class="mgc-bd"><span style="background:' + I.ca.bg + ';color:' + I.ca.fg + '">' + X(I.ca.abbr) + '</span><span style="background:' + I.ch.bg + ';color:' + I.ch.fg + '">' + X(I.ch.abbr) + '</span></span>' +
              '<span class="mgc-rt"><span class="mgc-rn">' + X(I.label) + '</span><span class="mgc-rs"><i class="live"></i>' + X(I.league + ' · ' + I.status) + '</span></span>' + btn + '</div>';
          };
          var sheet = '<div class="hiw-a up" data-at="900" style="position:absolute;left:0;right:0;bottom:0;top:60px"><div class="mgc-pn" style="position:absolute;left:0;right:0;bottom:0;top:0">' +
            '<div class="mgc-grab"></div><div class="mgc-sh-hd"><div><div class="mgc-sh-t">Add a game</div><div class="mgc-sh-s">Everyone in your chat can react to it here</div></div><button type="button" class="mgc-done">Done</button></div>' +
            '<div class="mgc-list">' + row(G[0], '<span class="mgc-b fixed">Started here</span>') +
              row(G[1], '<button type="button" class="mgc-b" id="hiw-add2" data-add="2000:in">Add</button>') + row(G[2], '<button type="button" class="mgc-b" id="hiw-add3">Add</button>') + '</div></div></div>';
          return chatPage(chips([G[0]], 'hiw1', 'this'), '') + tap('#hiw-mgc-add', 400) + sheet + tap('#hiw-add2', 1900) + tap('#hiw-add3', 2600);
        },
        run: function (stage) {
          setTimeout(function () { var b = stage.querySelector('#hiw-add2'); if (b) { b.classList.add('in'); b.textContent = 'Added'; } }, 2050);
          setTimeout(function () { var b = stage.querySelector('#hiw-add3'); if (b) { b.classList.add('in'); b.textContent = 'Added'; } }, 2750);
        }
      },
      {
        h: 'Talk about all of them.', p: 'In All, every message and reaction carries the game it’s about.',
        html: function () {
          var G = games();
          var b = function (I, who, text, ms) { return '<div' + at(ms) + '>' + tag(I) + P.bubble({ who: who, text: text }) + '</div>'; };
          return chatPage(chips(G, 'hiw1', 'all') +
            b(G[0], F[0] + ' Reyes', 'Bailey 2-1, sitting fastball', 300) +
            '<div' + at(1000) + '>' + sysReact(F[3], 'Q2', '49ers · Purdy to Kittle, 18 yds', '🔥') + '</div>' +
            b(G[2], F[1] + ' Shah', 'Valks on a 9-0 run', 1700), '');
        }
      },
      {
        h: 'Tap a game to switch.', p: 'Its chip takes you to that game, same chat. Your game’s chip shows only its messages.',
        html: function () {
          var G = games();
          return chatPage(chips(G, 'hiw1', 'all')) + tap('#hiw-mgc-hiw2', 700) +
            '<div class="hiw-a fade" data-at="1300" style="position:absolute;inset:0;background:var(--bg)">' + P.gameHd('49ers @ Rams') + P.tabs('chat') +
              '<div style="padding:14px 16px">' + chips(G, 'hiw2', 'all') +
              '<div' + at(1900) + '>' + sysReact(F[3], 'Q2', '49ers · Purdy to Kittle, 18 yds', '🔥') + '</div>' +
              '<div' + at(2400) + '>' + P.bubble({ who: F[2] + ' Okafor', text: 'Same chat, different game. Love it' }) + '</div></div></div>';
        }
      },
      {
        h: 'Get around fast.', p: 'Top of chat, Latest, and a games button that jumps between them. Tap a reaction from another game to go there.',
        html: function () {
          var G = games();
          var dots = G.map(function (I, i) { return '<i style="background:' + (I.ca.accent || I.ca.bg) + (i ? ';margin-left:-4px' : '') + '"></i>'; }).join('');
          var up = R(function () { return GCJ_UP; }, '↑'), down = R(function () { return GCJ_DOWN; }, '↓'), chev = R(function () { return GCJ_CHEV; }, '');
          var list = '<div class="gcj-list hiw-a" data-at="1200" style="position:relative;margin-top:8px">' + G.map(function (I, i) {
            return '<button type="button" class="gcj-row' + (i === 0 ? ' here' : '') + '"><span class="gcj-bd"><span style="background:' + I.ca.bg + ';color:' + I.ca.fg + '">' + X(I.ca.abbr) + '</span><span style="background:' + I.ch.bg + ';color:' + I.ch.fg + '">' + X(I.ch.abbr) + '</span></span>' +
              '<span class="gcj-rt"><span class="gcj-sc">' + I.g.awayScore + ' – ' + I.g.homeScore + '</span><span class="gcj-st"><i></i>' + X(I.league + ' · ' + I.status) + '</span></span><span class="gcj-go">' + (i === 0 ? 'HERE' : 'GO') + '</span></button>';
          }).join('') + '</div>';
          return chatPage(
            P.bubble({ who: F[0] + ' Reyes', text: 'Bailey 2-1, sitting fastball' }) + P.bubble({ mine: true, text: 'He’s 4 for his last 9' }) + P.bubble({ who: F[1] + ' Shah', text: 'Valks on a 9-0 run' }), '') +
            '<div style="position:absolute;left:16px;right:16px;top:150px;z-index:5"><div class="gcj-row1" style="display:flex;gap:8px;justify-content:center"><button type="button" class="gcj-pill">' + up + 'Top of chat</button>' +
              '<button type="button" class="gcj-pill gcj-g" id="hiw-gcjg"><span class="gcj-dots">' + dots + '</span>3 games' + chev + '</button></div>' + list + '</div>' +
            '<div style="position:absolute;right:16px;bottom:24px;z-index:5"><button type="button" class="gcj-pill gcj-latest new">' + down + 'Latest · 2 new</button></div>' +
            tap('#hiw-gcjg', 700);
        }
      }
    ]
  });
})();

// ── part 4: memories, archive, friends ─────────────────────────────────
(function () {
  if (typeof hiwRegister !== 'function' || !window._hiwParts) return;
  var P = window._hiwParts, R = P.R, X = P.X, at = P.at, tap = P.tap, F = P.F;
  function me() { var n = P.first(P.myName()); return n === 'You' ? 'Nathan' : n; }
  function createHd() {
    return '<div style="background:var(--card);padding:12px 24px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:.5px solid var(--rule)">' +
      '<button style="background:none;border:none;font-size:14px;font-weight:600;color:var(--subtle);font-family:inherit">Cancel</button>' +
      '<div style="font-size:16px;font-weight:700;color:var(--black);letter-spacing:-.3px">New moment</div>' +
      '<button style="background:none;border:none;font-size:14px;font-weight:700;color:var(--indigo);font-family:inherit">Save</button></div>';
  }
  function whenStep() {
    return '<div style="display:flex;flex-direction:column;padding:24px 20px;gap:14px">' +
      '<div style="font-size:28px;font-weight:800;color:var(--black);letter-spacing:-.6px;line-height:1.1">When is this?</div>' +
      '<div style="font-size:14px;color:var(--subtle);margin-bottom:4px;line-height:1.5">Every moment deserves a home — whether it happened, is happening, or is coming up.</div>' +
      '<button class="mn-when mn-past" id="hiw-past"><span class="ic">⏳</span><span><b>It already happened</b><span class="s">A ticket stub for games and shows, a story for everything else</span></span><span class="go">›</span></button>' +
      '<button class="mn-when mn-now"><span class="ic">📍</span><span><b><span class="mn-livedot"><i></i>NOW</span>It’s happening now</b><span class="s">We’ll find where you are, or type it in</span></span><span class="go">›</span></button>' +
      '<button class="mn-when mn-next"><span class="ic">🎟️</span><span><b>It’s coming up</b><span class="s">Invite friends, pick a night, collect RSVPs</span></span><span class="go">›</span></button></div>';
  }
  function kindStep() {
    var K = [['game', 'linear-gradient(160deg,#FD5A1E,#27251F)', '⚾', 'A game', 'Any sport — your seat, the final, the big moment'], ['concert', 'linear-gradient(160deg,#2B1655,#12091F)', '🎤', 'A concert', 'Your section, the opener, song of the night'],
      ['fest', 'linear-gradient(90deg,#1E6F6A,#2A5E9C 50%,#6E3A9C)', '🎪', 'A festival', 'The days you went and the sets you saw'], ['other', 'linear-gradient(160deg,#241C4E,#15103A)', '✨', 'Something else', 'A dinner, a trip, a hang — tell it as a story']];
    return '<div style="padding:24px 20px;display:flex;flex-direction:column;gap:14px"><div style="font-size:24px;font-weight:800;color:var(--black);letter-spacing:-.4px">What was it?</div>' +
      '<div style="font-size:13.5px;color:var(--subtle);line-height:1.5">Games, concerts and festivals become a ticket stub you keep. Anything else gets told as a story.</div><div class="mn-kinds">' +
      K.map(function (k) { return '<button class="mn-kind' + (k[0] === 'other' ? ' wide' : '') + '" id="hiw-k-' + k[0] + '" style="background:' + k[1] + '"><span class="e">' + k[2] + '</span><span style="display:flex;flex-direction:column;gap:2px"><b>' + k[3] + '</b><small>' + k[4] + '</small></span></button>'; }).join('') + '</div></div>';
  }
  function stub(o) {
    o = o || {};
    var col = '#FD5A1E', dk = function (a) { return R(function () { return _fbxDark(col, a); }, '#140A08'); };
    var who = (o.who || []).map(function (n) { return '<span class="av">' + n.charAt(0) + '</span>'; }).join('');
    var fld = function (l, v) { return '<div><span>' + l + '</span><input class="fi" value="' + v + '" aria-label="' + l + '"></div>'; };
    return '<div class="mn-stub game' + (o.saved ? ' saved' : '') + '" id="hiw-stub" style="background:linear-gradient(160deg,' + col + ' 0%,' + dk(.35) + ' 60%,' + dk(.65) + ' 100%)">' +
      '<div class="main"><div class="kk">ADMIT ONE · GAME</div>' +
      '<div class="tt" style="border-bottom:1.5px dashed rgba(255,255,255,.45)"><span' + (o.typeAt != null ? ' data-type="' + o.typeAt + '"' : '') + '>Bailey walks it off</span></div>' +
      '<div class="subrow"><input class="sub" value="Oracle Park"><input class="sub" value="Oct 3, 2026"></div>' +
      '<div class="meta">' + fld('SECTION', '118') + fld('ROW', '12') + fld('SEAT', '7') + '</div>' +
      (o.final ? '<div class="final' + (o.finalAt != null ? ' hiw-a" data-at="' + o.finalAt : '') + '"><span>FINAL</span>Dodgers 3 · Giants 4<button class="addw" style="margin-left:auto">Change</button></div>'
        : '<button class="attach" id="hiw-attach">🏆 Attach the game — pulls the final score</button>') +
      '<div class="final" style="border-top:0;padding-top:4px"><span>BIG MOMENT</span><input class="fi" style="font-size:13px" value="Walk-off · Bailey"></div>' +
      '<div class="punch">KEPT<br>FOREVER</div></div><div class="perf"></div>' +
      '<div class="bottom"><div><div style="font-size:9px;font-weight:800;letter-spacing:.16em;opacity:.7">WITH</div><div class="who">' + who + '<button class="addw" id="hiw-who">' + (who ? '+ / edit' : '+ Add who was there') + '</button></div></div>' +
      '<div class="bars">' + Array.from({ length: 22 }, function (_, i) { return '<i style="width:' + (i % 3 ? 2 : 4) + 'px"></i>'; }).join('') + '</div></div></div>';
  }
  hiwRegister('memory', {
    eyebrow: 'How it works · Save a moment',
    steps: [
      {
        h: 'Save a moment.', p: 'Tap + anytime. On a game, Add memory after Watching or Attending does the same.',
        html: function () {
          return P.glPage(P.glTop('Hey, ' + P.first(P.myName()), '', P.bellBtn(0) + P.meBtn()) + '<div style="padding:6px 16px 0;opacity:.6">' + P.heroTile() + '</div>') +
            '<div style="position:absolute;left:0;right:0;bottom:24px">' + P.dock('home') + '</div>' + tap('[data-k=plus]', 500) +
            '<div class="hiw-a up" data-at="1000" style="position:absolute;inset:0;background:var(--bg)">' + createHd() + whenStep() + '</div>' + tap('#hiw-past', 2500);
        }
      },
      {
        h: 'Games become a ticket stub.', p: 'Pick what it was. A game, a concert or a festival gets a stub you keep. Anything else is a story.',
        html: function () {
          return '<div class="hiw-pg" style="background:var(--bg)">' + createHd() + '<div' + at(100) + '>' + kindStep() + '</div></div>' + tap('#hiw-k-game', 1500) +
            '<div class="hiw-a up" data-at="2100" style="position:absolute;inset:0;background:var(--bg)">' + createHd() + '<div style="padding:20px 20px 0;display:flex;flex-direction:column;gap:14px"><div style="font-size:13px;color:var(--subtle)">Tap anything dashed to fill it in.</div>' + stub({ typeAt: 2500 }) + '</div></div>';
        }
      },
      {
        h: 'Attach the game, tag your people.', p: 'The final score comes with it. Tag who was there and add a line on the back.',
        html: function () {
          return '<div class="hiw-pg" style="background:var(--bg)">' + createHd() + '<div style="padding:20px 20px 0;display:flex;flex-direction:column;gap:14px"><div style="font-size:13px;color:var(--subtle)">Tap anything dashed to fill it in.</div>' +
            '<div id="hiw-stubwrap">' + stub() + '</div></div></div>' + tap('#hiw-attach', 500) + tap('#hiw-who', 2000);
        },
        run: function (stage) {
          setTimeout(function () { var w = stage.querySelector('#hiw-stubwrap'); if (w) w.innerHTML = stub({ final: true }); }, 1050);
          setTimeout(function () { var w = stage.querySelector('#hiw-stubwrap'); if (w) w.innerHTML = stub({ final: true, who: [F[1], F[0]] }); }, 2550);
        }
      },
      {
        h: 'It belongs to all of you.', p: 'Punch the ticket. Everyone you tagged gets it in their Archive, with a note that you marked it.',
        html: function () {
          return '<div class="hiw-pg" style="background:var(--bg)">' + createHd() + '<div style="padding:20px 20px 0;display:flex;flex-direction:column;gap:14px">' +
            '<div id="hiw-stubwrap" data-add="900:hiw-saved">' + stub({ final: true, who: [F[1], F[0]] }) + '</div>' +
            '<button class="mn-cta" id="hiw-punch">Punch the ticket</button></div>' + tap('#hiw-punch', 400) +
            '<div class="hiw-a dn" data-at="2000" style="position:absolute;inset:0;padding:14px 16px;background:linear-gradient(180deg,#09061A 0,#09061A 118px,rgba(9,6,26,.72) 170px,rgba(9,6,26,.72))">' + P.notifRow(me(), 'marked a memory with you', 'Bailey walks it off', 'now') +
            '<div style="text-align:center;margin-top:8px;font-size:12px;font-weight:600;color:#C9C2F5">What ' + F[1] + ' sees on her phone</div></div></div>';
        },
        run: function (stage) { setTimeout(function () { var s = stage.querySelector('#hiw-stub'); if (s) s.classList.add('saved'); }, 800); }
      }
    ]
  });

  // ════ ARCHIVE ══════════════════════════════════════════════════════════
  function memCard(o) {
    return '<div class="mem-snap"' + (o.id ? ' id="' + o.id + '"' : '') + '><div class="mem-snap-img" style="background:' + o.bg + ';font-size:34px">' + o.e + '</div>' +
      '<div class="mem-snap-body"><div class="mem-snap-who"><div class="mem-avstack"><div class="av av-a">' + X(P.ini(P.myName())) + '</div><div class="av av-b">' + o.w.charAt(0) + '</div></div>' +
      '<div><div class="mem-snap-names">' + X(o.t) + '</div><div class="mem-snap-date">You + ' + X(o.w) + '  ·  ' + o.k + '  ·  ' + X(o.d) + '</div></div></div>' +
      (o.c ? '<div class="mem-snap-caption">' + X(o.c) + '</div>' : '') + '</div></div>';
  }
  function memHero(n) {
    return '<div class="imm-hero" style="padding:14px 20px 26px;text-align:center"><div class="imm-hero-glow"></div><div class="imm-hero-stat"><div class="imm-hero-stat-num">' + n + '</div><div class="imm-hero-stat-lbl">Memories this season</div></div></div>';
  }
  function archSeg(on) {
    return '<div class="gl-arch"><button class="' + (on === 'm' ? 'on' : '') + '" id="hiw-seg-m">Memories</button><button class="' + (on === 'c' ? 'on' : '') + '" id="hiw-seg-c">Calendar</button></div>';
  }
  var MEMS = [
    { id: 'hiw-mem1', t: 'Bailey walks it off', w: F[1], k: '⚾ Game', d: 'Oct 3, 2026', c: 'Her last game before the move. She called it from the 2-1 pitch.', bg: 'linear-gradient(135deg,#FD5A1E 0%,#3B1660 70%,#1A1640 100%)', e: '⚾' },
    { t: 'Outside Lands, Day 2', w: F[0], k: '🎪 Festival', d: 'Aug 9, 2026', c: 'Lost everyone during the headliner. Worth it.', bg: 'linear-gradient(135deg,#1E6F6A,#2A5E9C 50%,#6E3A9C)', e: '🎪' }
  ];
  hiwRegister('archive', {
    eyebrow: 'How it works · Archive',
    steps: [
      {
        h: 'Every memory you’re in.', p: 'Yours, and every one a friend tagged you in. Search by friend, team or note.',
        html: function () {
          return '<div class="hiw-pg" style="background:#0D0820">' + memHero(14) + archSeg('m') + '<div class="imm-body" style="overflow:visible">' +
            '<div class="ms-bar"><label class="rb-search" style="margin:0"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input placeholder="Search your memories — friends, teams, notes"></label></div>' +
            MEMS.map(function (m, i) { return '<div' + at(300 + i * 500) + '>' + memCard(m) + '</div>'; }).join('') + '</div></div>';
        }
      },
      {
        h: 'Or by day.', p: 'Calendar marks every day you saved something. Tap one to see it.',
        html: function () {
          var map = { '2026-10-03': [{ _id: 'a', name: 'Bailey walks it off', vibe: '⚾ Game', date: '2026-10-03' }], '2026-10-11': [{ _id: 'b', name: 'Tacos after the game', vibe: '🌮 Dinner', date: '2026-10-11' }], '2026-10-18': [{ _id: 'c', name: 'Niners at the bar', vibe: '🏈 Game', date: '2026-10-18' }] };
          var month = R(function () { return P.withGlobals({ _calSelectedDate: null }, function () { return _calRenderMonth(2026, 9, map); }); }, '');
          var monthSel = R(function () { return P.withGlobals({ _calSelectedDate: '2026-10-03' }, function () { return _calRenderMonth(2026, 9, map); }); }, '');
          var det = R(function () { return P.withGlobals({ _calSelectedDate: '2026-10-03', _moments: [] }, function () { return _calRenderDayDetail(map); }); }, '');
          return '<div class="hiw-pg" style="background:#0D0820">' + archSeg('c') + '<div style="padding:12px 16px 0">' +
            '<div id="hiw-cal" style="position:relative"><div data-off="1300">' + month.replace('onclick="_calSelectDay(\'2026-10-03\')"', 'id="hiw-d3" onclick="_calSelectDay(\'2026-10-03\')"') + '</div><div class="hiw-a fade" data-at="1300" style="position:absolute;inset:0">' + monthSel + '</div></div>' +
            '<div class="hiw-a" data-at="1600" style="margin-top:14px">' + det + '</div></div></div>' +
            tap('#hiw-d3', 800);
        }
      },
      {
        h: 'Open one up.', p: 'The ticket from your seat, who was there, and the whole game one tap away.',
        html: function () {
          var m = { name: 'Dodgers @ Giants', date: '2026-10-03', boxScore: P.demoBox({ gameState: 'Final', homeScore: 4, status: 'Final' }), attendance: 'attend', seat: { section: '118', row: '12', seat: '7' } };
          var ticket = R(function () { return _mdTicketHtml(m); }, '');
          return '<div class="hiw-pg" style="background:linear-gradient(160deg,#3D3580,#1A1640 60%)"><div style="padding:14px 16px 0">' +
            '<div' + at(100) + ' style="padding:2px 4px 12px"><div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-.5px">Bailey walks it off</div><div style="font-size:13px;color:rgba(255,255,255,.75);margin-top:4px">Oct 3, 2026 · Oracle Park</div></div>' +
            '<div' + at(500) + '>' + ticket + '</div>' +
            '<div' + at(1300) + ' style="margin-top:14px;background:rgba(255,255,255,.14);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:16px">' +
              '<div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:rgba(255,255,255,.7);text-transform:uppercase">Who was there</div>' +
              '<div style="display:flex;align-items:center;gap:8px;margin-top:10px"><div class="av av-a" style="width:32px;height:32px;font-size:12px">' + X(P.ini(P.myName())) + '</div><div class="av av-b" style="width:32px;height:32px;font-size:12px;margin-left:-14px">' + F[1].charAt(0) + '</div><span style="font-size:13px;font-weight:600;color:#fff">You and ' + F[1] + '</span></div></div>' +
            '<button class="mdt-open hiw-a" data-at="2000" style="margin-top:12px;width:100%">Open the game ›</button>' +
          '</div></div>';
        }
      },
      {
        h: 'It comes back around.', p: 'A year later, Innings brings it back to you and everyone who was there.',
        html: function () {
          return P.glPage(P.glTop('Hey, ' + P.first(P.myName()), '', P.bellBtn(0) + P.meBtn()) +
            '<div style="padding:6px 16px 0;display:flex;flex-direction:column;gap:12px">' +
              '<div class="gl-g gl-otd hiw-a" id="hiw-otd" data-at="300"><span class="gl-num">’25</span><span class="t"><span class="gl-lab">On this day · 1 year ago</span><b>Outside Lands, Day 2</b><small>with ' + F[0] + ' and ' + F[2] + '</small></span>' + P.icon('chev') + '</div>' +
              '<div class="hiw-a" data-at="1500" style="padding:0 4px">' + memCard(MEMS[1]) + '</div>' +
            '</div>') + tap('#hiw-otd', 1000);
        }
      }
    ]
  });

  // ════ FRIENDS ══════════════════════════════════════════════════════════
  function chip(n, b, id) {
    return '<div' + (id ? ' id="' + id + '"' : '') + ' style="display:flex;flex-direction:column;align-items:center;gap:6px;width:64px">' +
      '<div class="ip-chip-av" style="position:relative;width:48px;height:48px;border-radius:50%;background:rgba(168,159,232,.16);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#A89FE8">' + n.charAt(0) +
      (b ? '<span class="ip-dot ip-' + b + '" style="width:14px;height:14px"></span>' : '') + '</div>' +
      '<div style="font-size:11px;font-weight:600;color:#fff;text-align:center;line-height:1.3">' + n + '</div></div>';
  }
  function friendsTop() {
    return P.glTop('Friends', 'Your people', '<button class="gl-ib" aria-label="Add friends">' + P.icon('addUser') + '</button>');
  }
  function chipsRow() {
    return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><div class="sec-title" style="margin-bottom:0">Friends <span style="opacity:.4;font-size:10px">›</span></div><div style="font-size:12px;font-weight:600;color:#A89FE8">+ Add</div></div>' +
      '<div style="display:flex;gap:10px;margin-bottom:14px">' + chip(F[0], 'now', 'hiw-fr0') + chip(F[1], 'today', 'hiw-fr1') + chip(F[2], 'week') + chip(F[3]) + '</div>';
  }
  function watchCard() {
    var r = { state: 'live', uids: ['f1', 'f2'], mine: false, g: { away: 'Los Angeles Dodgers', home: 'San Francisco Giants' }, box: { away: 'Los Angeles Dodgers', home: 'San Francisco Giants', status: 'Bottom 9th', awayScore: 3, homeScore: 3 } };
    return R(function () { return P.withGlobals({ _friendNameCache: { f1: F[0], f2: F[1] } }, function () { return _liveFeedCardHtml(r, 0); }); }, '');
  }
  function planCard() {
    var m = { title: 'Dodgers @ Giants', vibe: '⚾ Game', date: '2027-04-02', time: '7:15 PM', location: 'Oracle Park' };
    var bg = R(function () { return _futureBgStyle(m); }, 'background:linear-gradient(135deg,#3D3580,#1A1640)');
    var btn = function (l, on, id) { return '<button' + (id ? ' id="' + id + '"' : '') + ' style="flex:1;padding:8px 4px;border-radius:10px;background:' + (on ? '#A89FE8' : 'rgba(255,255,255,0.2)') + ';color:' + (on ? '#1A1640' : 'white') + ';border:none;font-size:12px;font-weight:700;font-family:inherit">' + l + '</button>'; };
    return '<div style="' + bg + ';border-radius:20px;padding:18px;box-shadow:0 6px 16px rgba(0,0,0,.15)">' +
      '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.75);text-transform:uppercase;letter-spacing:.08em">⚾ Game</div>' +
      '<div style="font-size:19px;font-weight:800;color:white;letter-spacing:-.4px;margin-top:4px">Opening Day, Dodgers @ Giants</div>' +
      '<div style="font-size:12px;color:rgba(255,255,255,.7);margin-top:2px">' + F[1] + ' is going</div>' +
      '<div style="font-size:13px;color:rgba(255,255,255,.85);margin-top:6px">Thu, Apr 2 · 7:15 PM · Oracle Park</div>' +
      '<div style="display:flex;gap:6px;margin-top:12px">' + btn('Going', false, 'hiw-going') + btn('Maybe') + btn('Can\'t go') + '</div></div>';
  }
  hiwRegister('friends', {
    eyebrow: 'How it works · Friends',
    steps: [
      {
        h: 'Your people.', p: 'The dot shows who’s been on Innings: green now, then today, then this week. Never exact times.',
        html: function () { return P.glPage(friendsTop() + '<div style="padding:6px 16px 0"' + at(150) + '>' + chipsRow() + '</div>'); }
      },
      {
        h: 'See what they’re watching.', p: 'Games your friends are on, live ones first. Tap one to jump into it.',
        html: function () {
          return P.glPage(friendsTop() + '<div style="padding:6px 16px 0">' + chipsRow() +
            '<div class="imm-section" style="padding:8px 2px 0"><div class="imm-eyebrow">Watching</div></div><div id="hiw-wc" style="margin-top:8px"' + at(400) + '>' + watchCard() + '</div></div>') + tap('#hiw-wc > div', 1800);
        }
      },
      {
        h: 'Everything you’ve shared.', p: 'In your Archive, tap a friend under People for every memory with both of you.',
        html: function () {
          var pc = function (n, c, cls, id) { return '<div class="people-chip"' + (id ? ' id="' + id + '"' : '') + '><div class="av ' + cls + '">' + n.charAt(0) + '</div><div class="people-chip-name">' + n + '</div><div class="people-chip-count">' + c + ' together</div></div>'; };
          var hub = '<div style="background:#1A0A2E;position:relative;overflow:hidden"><div style="position:absolute;inset:0;background:radial-gradient(ellipse at top right,rgba(168,159,232,.2) 0%,transparent 60%)"></div>' +
            '<div style="padding:18px 20px 22px;position:relative;text-align:center"><div class="av av-a" style="width:64px;height:64px;font-size:22px;margin:0 auto 12px">' + F[1].charAt(0) + '</div>' +
            '<div style="font-size:21px;font-weight:800;color:white;letter-spacing:-.4px">' + F[1] + ' Shah</div>' +
            '<div class="imm-hero-stat" style="margin-top:14px"><div class="imm-hero-stat-num" style="font-size:34px">6</div><div class="imm-hero-stat-lbl">Memories together</div></div></div></div>' +
            '<div class="imm-body" style="overflow:visible"><div style="display:flex;flex-direction:column;gap:12px">' + memCard(MEMS[0]) + '</div></div>';
          return '<div class="hiw-pg" style="background:#0D0820">' + memHero(14) + archSeg('m') + '<div class="imm-body" style="overflow:visible">' +
              '<div class="imm-eyebrow" style="margin-bottom:10px">People</div><div style="display:flex;gap:16px">' + pc(F[1], 6, 'av-a', 'hiw-pc1') + pc(F[0], 4, 'av-b') + pc(F[2], 2, 'av-c') + '</div>' +
              memCard(MEMS[0]) + '</div></div>' + tap('#hiw-pc1 .av', 600) +
            '<div class="hiw-a fade" data-at="1100" style="position:absolute;inset:0;background:#0D0820">' + hub + '</div>';
        }
      },
      {
        h: 'See what’s coming up.', p: 'Games and shows your friends are going to. Tap Going and you’re in.',
        html: function () {
          return P.glPage(friendsTop() + '<div style="padding:6px 16px 0"><div class="imm-section" style="padding:8px 2px 10px"><div class="imm-eyebrow">Coming up</div><div class="imm-link">＋ It\'s coming up</div></div>' +
            '<div' + at(200) + '>' + planCard() + '</div></div>') + tap('#hiw-going', 1500);
        },
        run: function (stage) { setTimeout(function () { var b = stage.querySelector('#hiw-going'); if (b) { b.style.background = '#A89FE8'; b.style.color = '#1A1640'; } }, 1650); }
      }
    ]
  });
})();
