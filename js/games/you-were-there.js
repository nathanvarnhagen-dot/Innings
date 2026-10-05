// ═══ YOU WERE THERE (v7.10.0) ══════════════════════════════════════════
// Two things for games you attend:
//
//  1. THE FAN ANGLE — a line from your favorite team's side, on the game
//     memory and again the moment the game ends if you have Innings open.
//     A rival loses: the gods were kind. A rival wins a good one: at least it
//     was a good game. Worked out at view time from the viewer's own team
//     preferences (users/{uid}/teamPrefs/{sport}: favorite + rivals), so a
//     memory you share reads differently to a friend who roots for someone
//     else. Nothing is stored on the memory.
//
//     Rivals: mark any team RIVAL on the team list (any sport). MLB also has
//     the built-in pairs below (Giants and Padres both get the Dodgers, etc.),
//     which count alongside the ones you mark. A favorite with no rival gets
//     lines only when their own team plays.
//
//  2. THE LIVE MOMENT — while you're marked Attending and the game screen is
//     open (MLB), a big play (walk-off, go-ahead or tying run late, grand
//     slam, a postseason homer…) slides in a "You were at this one" banner
//     with one tap to save it, and the final out brings the fan angle with a
//     one-tap save. Real lock-screen push needs the native wrap (Capacitor +
//     FCM), so for now this is an in-app banner (plus a system notification
//     if the tab is hidden and notifications were already allowed).
//
// Test it without a live game: open the app with ?ywdemo=1 in the address.

// ── RIVALS (MLB defaults, by team abbreviation) ───────────────────────
var YW_RIVALS = {
  SF: ['LAD'], LAD: ['SF'], SD: ['LAD'], ATH: ['SF'], LAA: ['LAD'],
  NYY: ['BOS', 'NYM'], BOS: ['NYY'], NYM: ['NYY', 'ATL', 'PHI'], PHI: ['NYM', 'ATL'], ATL: ['NYM', 'PHI'],
  CHC: ['STL', 'MIL'], STL: ['CHC'], MIL: ['CHC'], HOU: ['TEX'], TEX: ['HOU'], BAL: ['NYY'], KC: ['STL']
};
// How close is close, per sport: margin that counts as a close game, as a
// great one, and as a blowout, plus the unit the game is counted in.
var YW_MARGIN = {
  mlb: { close: 2, great: 1, blow: 5, unit: 'run', gods: 'baseball' },
  nfl: { close: 8, great: 3, blow: 21, unit: 'point', gods: 'football' },
  cfb: { close: 8, great: 3, blow: 24, unit: 'point', gods: 'football' },
  nba: { close: 5, great: 3, blow: 20, unit: 'point', gods: 'basketball' },
  wnba: { close: 5, great: 3, blow: 20, unit: 'point', gods: 'basketball' },
  nhl: { close: 1, great: 1, blow: 4, unit: 'goal', gods: 'hockey' },
  mls: { close: 1, great: 1, blow: 3, unit: 'goal', gods: 'soccer' },
  nwsl: { close: 1, great: 1, blow: 3, unit: 'goal', gods: 'soccer' }
};
window._yw = window._yw || { pk: null, lastAb: null, lastPromptAt: 0, pending: null, timer: null, prefs: {}, phase: null, finalDone: {}, phases: {}, watchedEnd: {}, heroV: {}, heroBusy: {} };

function _ywAbbr(name) {
  var n = String(name || '');
  var hit = null;
  if (typeof _MD_MLB_ABBR === 'object') Object.keys(_MD_MLB_ABBR).forEach(function (nick) { if (!hit && n.indexOf(nick) !== -1) hit = _MD_MLB_ABBR[nick]; });
  return hit;
}
function _ywShort(name) {
  var s = (typeof _teamShortName === 'function') ? _teamShortName(name) : '';
  return s || String(name || '');
}
function _ywPick(arr, seed) { return arr[Math.abs(parseInt(seed, 10) || 0) % arr.length]; }
function _ywIsFinal(box) { return !!box && (box.gameState === 'Final' || /^(final|game over|completed)/i.test(String(box.status || ''))); }
// Same team? Full names match; for MLB the abbreviation does too.
function _ywSame(sport, nameA, nameB) {
  if (!nameA || !nameB) return false;
  if (String(nameA).toLowerCase() === String(nameB).toLowerCase()) return true;
  if (sport === 'mlb') { var a = _ywAbbr(nameA), b = _ywAbbr(nameB); return !!(a && b && a === b); }
  return false;
}

// ── 1. THE FAN ANGLE ──────────────────────────────────────────────────
// prefs: { favorite, rivals: [team names] }. series (optional, MLB October):
// { wins: {away, home}, need, name } with this game counted.
// Returns null when neither the favorite nor a rival played.
function _ywBuildVerdict(box, sport, prefs, series) {
  sport = sport || 'mlb';
  var fav = prefs && prefs.favorite;
  if (!box || !box.home || !box.away || !fav || !_ywIsFinal(box)) return null;
  var aS = box.awayScore, hS = box.homeScore;
  if (aS == null || hS == null || aS === hS) return null;
  var cfg = YW_MARGIN[sport] || { close: 2, great: 1, blow: 8, unit: 'point', gods: 'sports' };
  var rivals = (prefs.rivals || []).filter(Boolean);
  var mode = null, side = null;
  if (_ywSame(sport, box.away, fav)) { mode = 'mine'; side = 'away'; }
  else if (_ywSame(sport, box.home, fav)) { mode = 'mine'; side = 'home'; }
  else {
    // Your marked rivals, plus (MLB only) the built-in pairs.
    var isRival = function (name) {
      if (rivals.some(function (r) { return _ywSame(sport, name, r); })) return true;
      if (sport !== 'mlb') return false;
      var fa = _ywAbbr(fav), ta = _ywAbbr(name);
      return !!(fa && ta && (YW_RIVALS[fa] || []).indexOf(ta) !== -1);
    };
    if (isRival(box.away)) { mode = 'rival'; side = 'away'; }
    else if (isRival(box.home)) { mode = 'rival'; side = 'home'; }
  }
  if (!mode) return null;

  var other = side === 'away' ? 'home' : 'away';
  var winner = hS > aS ? 'home' : 'away';
  var sideWon = winner === side;
  var margin = Math.abs(hS - aS);
  var extras = sport === 'mlb' && (box.innings || []).length > 9;
  var end = (sport === 'mlb' && typeof _gwEndInfo === 'function') ? _gwEndInfo(box) : null;
  var walkoff = !!(end && end.walkoff);
  var close = margin <= cfg.close || extras;
  var great = margin <= cfg.great || extras || walkoff;
  var blowout = margin >= cfg.blow;
  var seed = box.gamePk || (aS * 31 + hS);

  var sn = _ywShort(box[side]), on = _ywShort(box[other]), fn = _ywShort(fav);
  var seriesOver = !!(series && series.wins && series.wins[winner] >= series.need);
  var seriesText = '';
  if (series && series.wins) {
    var wa = series.wins.away, wh = series.wins.home;
    if (wa === wh) seriesText = series.name + ' tied ' + wa + '–' + wh;
    else {
      var lead = wa > wh ? 'away' : 'home', hi = Math.max(wa, wh), lo = Math.min(wa, wh);
      seriesText = _ywShort(box[lead]) + (hi >= series.need ? ' win the ' : ' lead the ') + series.name + ' ' + hi + '–' + lo;
    }
  }

  var tone, line;
  if (mode === 'rival') {
    if (!sideWon) {
      tone = 'good';
      if (seriesOver) line = _ywPick(['{R} are done. The {g} gods weren’t just kind, they were generous.', 'Season over for {r}. Raise a drink.', 'And just like that, {r} are out. The {g} gods have spoken.'], seed);
      else if (blowout) line = _ywPick(['Not even close. The {g} gods were extra kind today.', '{R} got run out of their own building. Beautiful.', 'Absolute demolition. Buy yourself a drink.'], seed);
      else if (extras || walkoff) line = 'Lost in extras, even. The {g} gods saved something special for you.';
      else line = _ywPick(['The {g} gods were kind to you today.', 'A loss for {r}. Next round is on karma.', 'Karma showed up right on time.', '{R} lost. Somewhere, a drink just tasted better.'], seed);
    } else if (seriesOver) {
      tone = 'bad';
      line = _ywPick(['{R} advance. Nobody has to like it.', 'They move on. We’ll just call that a clerical error.'], seed);
    } else if (great) {
      tone = 'mixed';
      line = _ywPick(['Well, at least it was a good game.', 'Hard to be mad at a game that good. Okay, a little mad.', 'Painful, but you can’t say it wasn’t a great one. Order another round.'], seed);
    } else if (blowout) {
      tone = 'bad';
      line = _ywPick(['That one got away early. At least the drinks held up.', 'Never close. The drinks are doing all the work today.', 'Over before you got your second drink. Rough.'], seed);
    } else {
      tone = 'bad';
      line = _ywPick(['{R} got it done. Nothing a cold drink can’t dull.', 'They took it. Order a drink and look away.'], seed);
    }
  } else if (sideWon) {
    tone = 'good';
    if (walkoff) line = 'A walk-off for {f}. Frame the ticket. Then buy a round.';
    else if (seriesOver) line = '{F} advance. Savor it.';
    else if (blowout) line = 'Easy day for {f}. Drinks taste better when you’re up big.';
    else if (close) line = 'That’s how {f} win one.';
    else line = 'A win for {f}. Take it.';
  } else {
    tone = 'bad';
    if (seriesOver) line = 'That’s the season. It was a good run.';
    else if (walkoff || close) line = 'That one is going to sting for a minute. Drinks help.';
    else if (blowout) line = 'Short memory. Tomorrow’s a new day.';
    else line = 'Not this time. On to the next one.';
  }
  line = line.replace(/\{R\}/g, 'The ' + sn).replace(/\{r\}/g, 'the ' + sn).replace(/\{F\}/g, 'The ' + fn).replace(/\{f\}/g, 'the ' + fn).replace(/\{o\}/g, 'the ' + on).replace(/\{g\}/g, cfg.gods);

  var meta = [];
  meta.push(walkoff ? 'Walk-off' : (margin === 1 ? 'One-' + cfg.unit + ' game' : margin + '-' + cfg.unit + ' game'));
  if (extras) meta.push(box.innings.length + ' innings');
  if (seriesText) meta.push(seriesText);
  return { tone: tone, mode: mode, line: line, meta: meta.join(' · '), fav: fn };
}
function _ywVerdictHtml(v, attended) {
  if (!v) return '';
  return '<div class="ywv ywv-' + v.tone + '">' +
    '<div class="ywv-top"><span class="ywv-eye">THE FAN ANGLE</span><span class="ywv-as">as a ' + _escapeHtml(v.fav) + ' fan</span></div>' +
    '<div class="ywv-line">' + _escapeHtml(v.line) + '</div>' +
    (v.meta ? '<div class="ywv-meta">' + _escapeHtml(v.meta) + (attended ? ' · you were there' : '') + '</div>' : '') +
    '</div>';
}
// The viewer's favorite + rivals for one sport, cached for a minute.
function _ywPrefs(sport, cb) {
  var yw = window._yw, user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) { cb(null); return; }
  var c = yw.prefs[sport];
  if (c && c.uid === user.uid && Date.now() - c.at < 60000) { cb(c.data); return; }
  window.db.collection('users').doc(user.uid).collection('teamPrefs').doc(sport).get().then(function (doc) {
    var d = doc.exists ? (doc.data() || {}) : {};
    var data = { favorite: d.favorite || null, rivals: d.rivals || [] };
    yw.prefs[sport] = { uid: user.uid, at: Date.now(), data: data };
    cb(data);
  }).catch(function (err) { console.error('[yw] prefs load failed:', err); cb(null); });
}
// Postseason context for a finished MLB game, or null (regular season, not
// found, or the season data hasn't caught up with this result yet).
function _ywSeriesInfo(box, cb) {
  if (typeof _psLoad !== 'function' || box.gamePk == null) { cb(null); return; }
  var season = parseInt(String(box.date || '').slice(0, 4), 10) || new Date().getFullYear();
  _psLoad(season, function (d) {
    try {
      var g = d && d.games && d.games.filter(function (x) { return String(x.gamePk) === String(box.gamePk); })[0];
      if (!g || !_psRound(g) || g.state !== 'Final') { cb(null); return; }
      cb({ wins: _psWins(g, true), need: _psNeed(g), name: _psName(g) });
    } catch (e) { cb(null); }
  });
}
// Everything above in one call: prefs, then (MLB October) the series.
function _ywVerdictFor(box, sport, cb) {
  if (!box || !_ywIsFinal(box)) { cb(null); return; }
  _ywPrefs(sport, function (prefs) {
    if (!prefs || !prefs.favorite) { cb(null); return; }
    var go = function (series) {
      var v = null;
      try { v = _ywBuildVerdict(box, sport, prefs, series); } catch (e) { console.error('[yw] verdict failed:', e); }
      cb(v);
    };
    // No verdict means no reason to fetch the series.
    var probe = null;
    try { probe = _ywBuildVerdict(box, sport, prefs, null); } catch (e) { probe = null; }
    if (!probe) { cb(null); return; }
    if (sport === 'mlb') _ywSeriesInfo(box, go); else go(null);
  });
}
// Placeholder the memory screen drops in under the ticket; filled in when
// the preferences (and, in October, the series) have loaded.
function _ywVerdictSlotHtml(m) {
  try {
    var box = m && m.boxScore;
    if (!box || !_ywIsFinal(box)) return '';
    var sport = box.sport || 'mlb';
    var id = 'yw-v-' + String(box.gamePk != null ? box.gamePk : 'x');
    setTimeout(function () {
      _ywVerdictFor(box, sport, function (v) {
        var el = document.getElementById(id);
        if (el && v) el.innerHTML = _ywVerdictHtml(v, m.attendance === 'attend' || !!m.seat);
      });
    }, 0);
    return '<div id="' + id + '"></div>';
  } catch (e) { return ''; }
}

// ── 2. THE LIVE MOMENT ────────────────────────────────────────────────
// Called on every render of the live baseball hero (baseball-hero.js) with
// the latest box score. Quiet unless you're Attending this game.
function _ywScorePlay(lp, box) {
  if (!lp || lp.awayScore == null || lp.homeScore == null) return { score: 0 };
  var bat = lp.half === 'top' ? 'away' : 'home', def = bat === 'away' ? 'home' : 'away';
  var runs = (lp.runners || []).filter(function (r) { return r.end === 'score'; }).length;
  var after = bat === 'away' ? lp.awayScore : lp.homeScore, other = def === 'away' ? lp.awayScore : lp.homeScore;
  var before = after - runs, inn = lp.inning || 0;
  var hr = lp.eventType === 'home_run';
  var s = 0, tag = '';
  if (hr) { s = 40; tag = 'homer'; if ((lp.rbi || 0) >= 4) { s = 85; tag = 'grand slam'; } }
  if (runs > 0 && before < other && after > other) { s = Math.max(s, inn >= 7 ? 80 : 55) + (hr ? 10 : 0); tag = 'go-ahead'; }
  else if (runs > 0 && before < other && after === other) { s = Math.max(s, inn >= 7 ? 70 : 45); tag = 'tying'; }
  if (runs > 0 && inn >= 10) s = Math.max(s, 70);
  var ps = false;
  try { ps = !!(typeof _psGame === 'function' && _psGame()); } catch (e) { ps = false; }
  if (ps && s > 0) s += 15;
  return { score: s, tag: tag, runs: runs };
}
function _ywObserve(box, model) {
  if (!box || !model) return;
  var yw = window._yw, pk = box.gamePk, isFinal = _ywIsFinal(box);
  // Remember whether this screen watched the game end (live, then final), so
  // the fan angle can arrive a beat after the score instead of with it.
  var prev = yw.phases[pk];
  yw.phases[pk] = isFinal ? 'final' : 'live';
  if (isFinal && prev === 'live') yw.watchedEnd[pk] = true;
  if (isFinal) return; // the final-out fan angle lives in the game hero (_ywHeroSlotHtml)

  var s = window._gatt;
  if (!box.lastPlay || !s || s.mode !== 'attend' || String(s.gamePk) !== String(box.gamePk)) return;
  var lp = box.lastPlay, ab = lp.atBatIndex;
  var first = yw.pk !== box.gamePk;
  if (first) { yw.pk = box.gamePk; yw.lastAb = ab; yw.lastPromptAt = 0; }
  yw.phase = 'live';

  if (first) return; // first look mid-game: remember where it stands, don't prompt for old plays
  if (ab == null || ab === yw.lastAb) return;
  yw.lastAb = ab;
  var r = _ywScorePlay(lp, box);
  if (r.score < 60) return;
  if (Date.now() - yw.lastPromptAt < 150000) return;
  yw.lastPromptAt = Date.now();
  var who = (typeof _ghLastName === 'function' ? _ghLastName(lp.batter || '') : (lp.batter || '')) || 'Big play';
  var what = (typeof _gwWalkoffWhat === 'function') ? _gwWalkoffWhat(lp) : String(lp.event || 'Big play');
  var chip = _ywScoreChip(box, model, lp);
  _ywShowBanner({
    title: (r.tag === 'go-ahead' || r.tag === 'tying') ? 'You were there for this.' : 'You were at this one.',
    line: who + ' · ' + what, chip: chip, note: who + ' – ' + what + ' (' + chip + ')'
  });
}
// ── The fan angle inside the game hero ───────────────────────────────
// Sits right under the final score on a finished MLB game. Same card the
// memory shows. Watching the final out: it fades up a beat after FINAL
// lands. Opening the game later: it plays the same entrance as the page
// settles. Anyone with a favorite team set gets it, attending or not.
function _ywWords(line) {
  return String(line).split(' ').map(function (w, i) {
    return '<span class="ywh-w" style="animation-delay:' + (0.55 + i * 0.07).toFixed(2) + 's">' + _escapeHtml(w) + '</span>';
  }).join(' ');
}
function _ywHeroCardHtml(v, pk, animate) {
  var s = window._gatt, att = !!(s && s.mode === 'attend' && String(s.gamePk) === String(pk));
  var html = _ywVerdictHtml(v, att);
  if (animate) html = html.replace(/<div class="ywv-line">[\s\S]*?<\/div>/, '<div class="ywv-line">' + _ywWords(v.line) + '</div>');
  return html;
}
function _ywHeroSlotHtml() {
  var box = window._ywCurBox, yw = window._yw;
  if (!box || !_ywIsFinal(box)) return '';
  var pk = box.gamePk, done = yw.heroV[pk];
  if (done && done.v) return '<div class="ywh on" data-pk="' + pk + '">' + _ywHeroCardHtml(done.v, pk, false) + '</div>';
  if (!done && !yw.heroBusy[pk]) {
    yw.heroBusy[pk] = true;
    _ywVerdictFor(box, 'mlb', function (v) {
      var wait = yw.watchedEnd[pk] ? 1500 : 450;
      setTimeout(function () {
        yw.heroV[pk] = { v: v || null };
        if (!v) return;
        var el = document.querySelector('.ywh[data-pk="' + pk + '"]');
        if (!el) return; // hero re-renders pick the cached card up
        el.innerHTML = _ywHeroCardHtml(v, pk, true);
        void el.offsetWidth;
        el.classList.add('on', 'ywh-play');
        yw.heroV[pk].shown = true;
        try { if (yw.watchedEnd[pk] && navigator.vibrate) navigator.vibrate([40, 30, 40]); } catch (e) {}
      }, wait);
    });
  }
  return '<div class="ywh" data-pk="' + pk + '"></div>';
}
function _ywScoreChip(box, model, lp) {
  var aA = box.awayAbbr || (model.away && model.away.abbr) || '', hA = box.homeAbbr || (model.home && model.home.abbr) || '';
  return aA + ' ' + lp.awayScore + ', ' + hA + ' ' + lp.homeScore + ' · ' + (lp.half === 'top' ? 'T' : 'B') + (lp.inning || '');
}
function _ywFinalBanner(box, model) {
  var s = window._gatt, lp = box.lastPlay;
  var end = (typeof _gwEndInfo === 'function') ? _gwEndInfo(box) : null;
  var walkoff = !!(end && end.walkoff);
  var aN = _ywShort(box.away), hN = _ywShort(box.home);
  var aS = box.awayScore, hS = box.homeScore;
  var scoreText = (aS > hS) ? aN + ' ' + aS + ', ' + hN + ' ' + hS : hN + ' ' + hS + ', ' + aN + ' ' + aS;
  var has = !!(s && s.moment);
  _ywVerdictFor(box, 'mlb', function (v) {
    if (!s || s.mode !== 'attend' || String(s.gamePk) !== String(box.gamePk)) return;
    var who = lp && lp.batter && typeof _ghLastName === 'function' ? _ghLastName(lp.batter) : '';
    _ywShowBanner({
      title: walkoff ? 'Walk-off. You were there.' : 'Final: ' + scoreText,
      line: v ? v.line : (walkoff && who ? who + ' walks it off.' : 'That’s a wrap. Save this one?'),
      voice: !!v, chip: v ? (walkoff ? 'Final: ' + scoreText + ' · ' : '') + v.meta : (walkoff ? 'Final: ' + scoreText : ''),
      note: walkoff && lp ? 'Walk-off! ' + (who ? who + ' – ' : '') + (typeof _gwWalkoffWhat === 'function' ? _gwWalkoffWhat(lp) : '') : '',
      walkoff: walkoff, tone: v ? v.tone : null, view: has
    });
  });
}
function _ywShowBanner(p) {
  var yw = window._yw;
  yw.pending = p;
  var el = document.getElementById('yw-banner');
  if (!el) { el = document.createElement('div'); el.id = 'yw-banner'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  var had = !!(window._gatt && window._gatt.moment);
  el.className = (p.walkoff ? 'wo ' : '') + (p.tone ? 't-' + p.tone : '');
  el.innerHTML = '<div class="yw-card"><div class="yw-hd"><span class="yw-dot" aria-hidden="true"></span><span class="yw-k">INNINGS</span><span class="yw-now">now</span></div>' +
    '<div class="yw-t">' + _escapeHtml(p.title) + '</div>' +
    '<div class="' + (p.voice ? 'yw-v' : 'yw-l') + '">' + _escapeHtml(p.line) + '</div>' +
    (p.chip ? '<div class="yw-c">' + _escapeHtml(p.chip) + '</div>' : '') +
    '<div class="yw-b"><button class="yw-save" onclick="ywSave()">' + (p.view ? 'See your memory' : (had ? 'Add to your memory' : 'Save the moment')) + '</button><button class="yw-no" onclick="ywDismiss()">Not now</button></div></div>';
  void el.offsetWidth;
  el.classList.add('on');
  clearTimeout(yw.timer);
  yw.timer = setTimeout(ywDismiss, 30000);
  try { if (navigator.vibrate) navigator.vibrate([50, 40, 50]); } catch (e) {}
  try {
    if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(p.title, { body: p.line + (p.chip ? ' · ' + p.chip : '') });
  } catch (e) {}
}
function ywDismiss() {
  var el = document.getElementById('yw-banner');
  clearTimeout(window._yw.timer);
  if (el) el.classList.remove('on');
}
function ywSave() {
  var p = window._yw.pending, s = window._gatt;
  ywDismiss();
  if (!p) return;
  if (p.demo) { if (typeof ib_toast === 'function') ib_toast('Demo – this opens your memory sheet'); return; }
  if (!s || s.mode !== 'attend') return;
  if (p.view && typeof gattOpenMemory === 'function') { gattOpenMemory(); return; }
  if (typeof gattOpenSheet !== 'function') return;
  gattOpenSheet();
  if (s.draft && p.note) {
    var cur = s.draft.note || '';
    if (cur.indexOf(p.note) === -1) s.draft.note = cur ? cur + ' · ' + p.note : p.note;
    if (typeof _gattRenderSheet === 'function') _gattRenderSheet();
  }
}

// ── TEST PAGE — open the app with ?ywdemo=1 ───────────────────────────
function ywDemoReveal(i) {
  var D = 'Los Angeles Dodgers', B = 'Atlanta Braves';
  var c = i ? [_ywDemoBox(B, D, 3, 4, 9, false, 9002), { wins: { away: 0, home: 1 }, need: 3, name: 'NLDS' }]
            : [_ywDemoBox(B, D, 4, 3, 9, false, 9001), { wins: { away: 1, home: 0 }, need: 3, name: 'NLDS' }];
  var v = _ywBuildVerdict(c[0], 'mlb', { favorite: 'San Francisco Giants', rivals: [] }, c[1]);
  var el = document.getElementById('ywd-stage');
  if (!el || !v) return;
  el.className = 'ywh'; el.innerHTML = '';
  void el.offsetWidth;
  el.innerHTML = _ywHeroCardHtml(v, 0, true);
  el.classList.add('on', 'ywh-play');
}
function _ywDemoBox(away, home, aS, hS, innings, walk, pk) {
  var inn = []; for (var i = 1; i <= innings; i++) inn.push({ num: i, away: 0, home: 0 });
  var b = { gamePk: pk, away: away, home: home, awayScore: aS, homeScore: hS, gameState: 'Final', status: 'Final', innings: inn, date: '2026-10-03', sport: 'mlb' };
  if (walk) b.lastPlay = { half: 'bottom', inning: innings, awayScore: aS, homeScore: hS, runners: [{ end: 'score' }], eventType: 'home_run', rbi: 1 };
  return b;
}
function ywDemo() {
  var D = 'Los Angeles Dodgers', B = 'Atlanta Braves', G = 'San Francisco Giants';
  var giants = { favorite: G, rivals: [] };
  var cases = [
    ['Close: Dodgers win 4–3', _ywDemoBox(B, D, 3, 4, 9, false, 9002), { wins: { away: 0, home: 1 }, need: 3, name: 'NLDS' }],
    ['Close: Dodgers lose 3–4', _ywDemoBox(B, D, 4, 3, 9, false, 9001), { wins: { away: 1, home: 0 }, need: 3, name: 'NLDS' }],
    ['Normal: Dodgers win 5–2', _ywDemoBox(B, D, 2, 5, 9, false, 9006), { wins: { away: 0, home: 1 }, need: 3, name: 'NLDS' }],
    ['Normal: Dodgers lose 2–5', _ywDemoBox(B, D, 5, 2, 9, false, 9007), { wins: { away: 1, home: 0 }, need: 3, name: 'NLDS' }],
    ['Blowout: Dodgers win 9–1', _ywDemoBox(B, D, 1, 9, 9, false, 9004), { wins: { away: 0, home: 1 }, need: 3, name: 'NLDS' }],
    ['Blowout: Dodgers lose 1–9', _ywDemoBox(B, D, 9, 1, 9, false, 9008), { wins: { away: 1, home: 0 }, need: 3, name: 'NLDS' }],
    ['Dodgers eliminated', _ywDemoBox(B, D, 5, 1, 9, false, 9005), { wins: { away: 3, home: 0 }, need: 3, name: 'NLDS' }],
    ['Giants win a walk-off', _ywDemoBox('San Diego Padres', G, 2, 3, 9, true, 9009), null]
  ];
  var el = document.getElementById('yw-demo');
  if (!el) { el = document.createElement('div'); el.id = 'yw-demo'; document.body.appendChild(el); }
  el.innerHTML = '<div class="ywd-hd"><b>You Were There – preview</b><button onclick="document.getElementById(\'yw-demo\').remove()" aria-label="Close">Close</button></div>' +
    '<p class="ywd-p">Pretend you’re a Giants fan. Each card is what the memory would say for that result.</p>' +
    cases.map(function (c) {
      var v = _ywBuildVerdict(c[1], 'mlb', giants, c[2]);
      return '<div class="ywd-case"><div class="ywd-lbl">' + _escapeHtml(c[0]) + '</div>' + _ywVerdictHtml(v, true) + '</div>';
    }).join('') +
    '<div class="ywd-case"><div class="ywd-lbl">The final-out reveal (replays the hero animation)</div>' +
    '<button class="yw-save" style="width:100%" onclick="ywDemoReveal(0)">Dodgers lose</button>' +
    '<button class="yw-save" style="width:100%;margin-top:8px" onclick="ywDemoReveal(1)">Dodgers win, close</button>' +
    '<div id="ywd-stage" class="ywh"></div></div>' +
    '<div class="ywd-case"><div class="ywd-lbl">A big play in the middle of the game</div>' +
    '<button class="yw-save" style="width:100%" onclick="_ywShowBanner({title:\'You were at this one.\',line:\'Freeman · 2-run homer · 412 ft\',chip:\'ATL 3, LAD 4 · B7\',note:\'x\',demo:true})">Show the banner</button></div>';
}
(function () {
  try {
    if (/[?&]ywdemo=1/.test(location.search)) setTimeout(function () { if (typeof ywDemo === 'function') ywDemo(); }, 1500);
  } catch (e) {}
})();
