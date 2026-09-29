// Vercel Serverless Function — GET /api/recap?sport=<key>&start=YYYY-MM-DD&end=YYYY-MM-DD
//
// Recaps (v7.4.0): the biggest games and moments of a finished day or week,
// for the story rings at the top of the Games tab.
//
//   sport = mlb        one day of baseball (start = end)
//           mlbw       a Monday–Sunday week of baseball (built from the daily recaps)
//           nfl, cfb   a football week
//           nba, wnba  one day of basketball
//           nhl        one day of hockey
//           mls, nwsl  a soccer week
//
// Sources: the MLB Stats API (its per-game winProbability feed carries every
// play with win probability and batted-ball data), ESPN's scoreboard and
// summary feeds (football, basketball, soccer), and the NHL's own API.
// A recap only covers games that are over, so it's cached at the edge for
// hours: every visitor after the first gets it instantly and the sources
// are asked once.
//
// Every moment carries an `anim` object — the facts the client needs to
// draw it (where the ball went, who ran where, which yard line, how far
// out the shot was). The drawing itself happens in js/games/recaps.js.

const MLB = 'https://statsapi.mlb.com/api/v1';
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/';
const NHL = 'https://api-web.nhle.com/v1';
const ESPN_PATH = { nfl: 'football/nfl', cfb: 'football/college-football', nba: 'basketball/nba', wnba: 'basketball/wnba', mls: 'soccer/usa.1', nwsl: 'soccer/usa.nwsl' };

module.exports = async function handler(req, res) {
  // v7.5.0: the Watch & Listen tab asks this same function where one game is on
  // (GET /api/recap?watch=<sport>&id=<gameId>&date=YYYY-MM-DD), so it doesn't
  // need a serverless function of its own.
  if (req.query.watch) {
    let out = null;
    try { out = await watchInfo(String(req.query.watch), String(req.query.id || ''), String(req.query.date || '')); } catch (e) { out = null; }
    res.setHeader('Cache-Control', out ? 's-maxage=300, stale-while-revalidate=1800' : 's-maxage=120');
    res.status(200).json(out || { empty: true });
    return;
  }
  const sport = String(req.query.sport || '');
  const start = String(req.query.start || '');
  const end = String(req.query.end || start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) { res.status(400).json({ error: 'start/end must be YYYY-MM-DD' }); return; }
  try {
    let recap = null;
    if (sport === 'mlb') recap = await mlbDay(start);
    else if (sport === 'mlbw') recap = await mlbWeek(req, start, end);
    else if (sport === 'nhl') recap = await nhlDay(start);
    else if (ESPN_PATH[sport]) recap = await espnRecap(sport, start, end);
    else { res.status(400).json({ error: 'Unknown sport' }); return; }
    // A window that includes today can still change; everything else is final.
    const today = new Date().toISOString().slice(0, 10);
    const done = end < today && !(recap && recap.pending);
    res.setHeader('Cache-Control', done ? 's-maxage=21600, stale-while-revalidate=86400' : 's-maxage=600, stale-while-revalidate=1800');
    res.status(200).json(recap || { sport: sport, start: start, end: end, empty: true });
  } catch (e) {
    res.setHeader('Cache-Control', 's-maxage=60');
    res.status(200).json({ sport: sport, start: start, end: end, empty: true, error: String(e && e.message || e) });
  }
};

// ── small helpers ────────────────────────────────────────────────────────
async function getJson(url, ms) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 8000) : null;
  try {
    const r = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; } finally { if (t) clearTimeout(t); }
}
function addDays(ymd, n) { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function daysBetween(a, b) { const out = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out; }
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MO = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function wday(ymd) { return WD[new Date(ymd + 'T12:00:00Z').getUTCDay()]; }
function mday(ymd) { const d = new Date(ymd + 'T12:00:00Z'); return MO[d.getUTCMonth()] + ' ' + d.getUTCDate(); }
function range(a, b) { const da = new Date(a + 'T12:00:00Z'), db = new Date(b + 'T12:00:00Z'); return da.getUTCMonth() === db.getUTCMonth() ? mday(a) + '–' + db.getUTCDate() : mday(a) + ' – ' + mday(b); }
function lastName(full) {
  const p = String(full || '').trim().split(/\s+/);
  if (p.length < 2) return p[0] || '';
  const l = p[p.length - 1];
  return /^(Jr\.?|Sr\.?|II|III|IV)$/i.test(l) && p.length > 2 ? p[p.length - 2] : l;
}
function nameOnly(s) { return String(s || '').replace(/^[A-Z]\.\s?/, '').replace(/^[A-Z][a-z]?\./, ''); }
function ord(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function hash(s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function trim(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function joinList(a) { a = a.filter(Boolean); if (a.length < 2) return a[0] || ''; return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
function sample(series, n) { if (series.length <= n) return series; const out = []; for (let i = 0; i < n; i++) out.push(series[Math.round(i * (series.length - 1) / (n - 1))]); return out; }
// Highest-scoring moments first, at most `perGame` from any one game
function pickMoments(all, n, perGame) {
  const count = {};
  return all.slice().sort(function (a, b) { return b._score - a._score; }).filter(function (m) {
    count[m.gameId] = (count[m.gameId] || 0) + 1;
    return count[m.gameId] <= perGame;
  }).slice(0, n).map(function (m) { const c = Object.assign({}, m); delete c._score; return c; });
}
function heroOf(games, moments) {
  const g = games.slice().sort(function (a, b) { return (b.ex || 0) - (a.ex || 0); })[0];
  if (!g) return null;
  const top = moments.filter(function (m) { return m.gameId === g.id; })[0];
  const w = g.home.score > g.away.score ? g.home : g.away, l = w === g.home ? g.away : g.home;
  // The score sits right above this line in the app, so tell the story instead
  const parts = [];
  if (g.comeback >= 3) parts.push('The ' + w.short + ' came back from ' + g.comeback + ' down.');
  if (top) parts.push(top.title + (top.when && !/\d(st|nd|rd|th)\b|overtime|buzzer|shootout|\u2032/i.test(top.title) ? ' (' + top.when + ')' : '') + '.');
  else parts.push('The ' + w.short + ' beat the ' + l.short + (g.extra ? ' in ' + g.extra : '') + '.');
  const line = parts.join(' ');
  return { gameId: g.id, line: line, wp: g.wp || null };
}
function kickDay(d) { return (wday(d) + ', ' + mday(d)).toUpperCase(); }

// ═══ MLB — one day ══════════════════════════════════════════════════════
async function mlbDay(date) {
  const sched = await getJson(MLB + '/schedule?sportId=1&hydrate=team,linescore&date=' + date);
  const all = ((sched && sched.dates && sched.dates[0] && sched.dates[0].games) || []).filter(function (g) { return g.gameType !== 'E' && !/postponed|cancel|suspend/i.test((g.status && g.status.detailedState) || ''); });
  const list = all.filter(function (g) { return g.status && g.status.abstractGameState === 'Final'; });
  const pending = list.length < all.length;
  if (!list.length) return pending ? { empty: true, pending: true } : null;
  const wps = await Promise.all(list.map(function (g) { return getJson(MLB + '/game/' + g.gamePk + '/winProbability', 9000); }));
  const games = [], cands = [];
  const facts = { walkoffs: 0, hr: 0, extras: 0, longest: null, comeback: null, shutouts: 0, slams: 0 };
  list.forEach(function (g, gi) {
    const tm = function (side) { const t = g.teams[side]; return { name: t.team.name, abbr: t.team.abbreviation || '', short: t.team.teamName || lastName(t.team.name), score: t.score != null ? t.score : 0 }; };
    const G = { id: g.gamePk, date: date, away: tm('away'), home: tm('home'), note: 'Final', ex: 0, comeback: 0, extra: null, wp: null };
    const inn = (g.linescore && g.linescore.currentInning) || 9;
    if (inn > 9) { G.note = 'F/' + inn; G.extra = inn + ' innings'; facts.extras++; }
    if (!G.away.score || !G.home.score) facts.shutouts++;
    const plays = Array.isArray(wps[gi]) ? wps[gi] : [];
    let a = 0, h = 0, minHome = 0, maxHome = 0;
    const series = [50];
    plays.forEach(function (p, pi) {
      const r = p.result || {}, ab = p.about || {};
      const beforeA = a, beforeH = h;
      if (r.awayScore != null) a = r.awayScore; if (r.homeScore != null) h = r.homeScore;
      minHome = Math.min(minHome, h - a); maxHome = Math.max(maxHome, h - a);
      if (p.homeTeamWinProbability != null) series.push(Math.round(p.homeTeamWinProbability));
      const top = !!ab.isTopInning, bat = top ? G.away : G.home;
      const diffB = top ? beforeA - beforeH : beforeH - beforeA, diffA = top ? a - h : h - a;
      const wpa = Number(p.homeTeamWinProbabilityAdded || 0) * (top ? -1 : 1); // for the batting team
      const et = r.eventType || '';
      const last = pi === plays.length - 1;
      const walkoff = last && !top && (ab.inning || 0) >= 9 && diffB <= 0 && diffA > 0;
      const hd = hitDataOf(p);
      if (et === 'home_run') { facts.hr++; if (r.rbi === 4) facts.slams++; if (hd && hd.totalDistance && (!facts.longest || hd.totalDistance > facts.longest.ft)) facts.longest = { ft: Math.round(hd.totalDistance), who: lastName(p.matchup && p.matchup.batter && p.matchup.batter.fullName) }; }
      if (walkoff) facts.walkoffs++;
      let score = Math.abs(wpa) + (walkoff ? 25 : 0) + (et === 'home_run' && r.rbi === 4 ? 15 : 0) + (hd && hd.totalDistance >= 460 ? 12 : 0);
      if (score < 8) return;
      const m = mlbMoment(G, p, bat, top, diffB, diffA, wpa, walkoff, hd);
      m._score = score;
      cands.push(m);
      G.ex += Math.abs(wpa);
    });
    G.ex += (G.extra ? 10 : 0);
    const winnerHome = G.home.score > G.away.score;
    G.comeback = winnerHome ? -minHome : maxHome;
    if (!facts.comeback || G.comeback > facts.comeback.n) facts.comeback = { n: G.comeback, team: winnerHome ? G.home.short : G.away.short };
    G.ex += G.comeback * 4;
    G.wp = series.length > 3 ? sample(series, 40) : null;
    games.push(G);
  });
  const moments = pickMoments(cands, 4, 2);
  const nums = [];
  if (facts.walkoffs) nums.push([String(facts.walkoffs), facts.walkoffs === 1 ? 'walk-off' : 'walk-offs']);
  if (facts.longest) nums.push([String(facts.longest.ft), 'feet, the longest homer (' + facts.longest.who + ')']);
  if (facts.comeback && facts.comeback.n >= 3) nums.push([String(facts.comeback.n), 'run comeback by the ' + facts.comeback.team]);
  nums.push([String(facts.hr), 'home runs']);
  if (facts.extras) nums.push([String(facts.extras), facts.extras === 1 ? 'extra-inning game' : 'extra-inning games']);
  if (facts.slams) nums.push([String(facts.slams), facts.slams === 1 ? 'grand slam' : 'grand slams']);
  const dek = cap(joinList([
    facts.walkoffs ? (facts.walkoffs === 1 ? 'a walk-off' : facts.walkoffs + ' walk-offs') : '',
    facts.longest && facts.longest.ft >= 440 ? 'a ' + facts.longest.ft + '-foot homer' : '',
    facts.comeback && facts.comeback.n >= 4 ? 'a comeback from ' + facts.comeback.n + ' down' : '',
    facts.extras ? (facts.extras === 1 ? 'a game in extras' : facts.extras + ' games in extras') : ''
  ].filter(Boolean).slice(0, 3))) || games.length + ' games.';
  return {
    sport: 'mlb', league: 'mlb', kind: 'day', start: date, end: date, id: 'mlb-' + date, pending: pending,
    kick: kickDay(date), title: wday(date) + ' in baseball', dek: /\.$/.test(dek) ? dek : dek + '.',
    ring: { label: 'MLB', sub: wday(date).slice(0, 3).toUpperCase() },
    games: games, hero: heroOf(games, moments), moments: moments, nums: nums.slice(0, 4), facts: facts
  };
}
function hitDataOf(p) {
  const ev = p.playEvents || [];
  for (let i = ev.length - 1; i >= 0; i--) if (ev[i] && ev[i].hitData) return ev[i].hitData;
  return null;
}
const MLB_WORD = { single: 'single', double: 'double', triple: 'triple', home_run: 'homer', sac_fly: 'sac fly', walk: 'walk', hit_by_pitch: 'hit-by-pitch', field_error: 'error', fielders_choice: 'fielder’s choice', force_out: 'grounder', grounded_into_double_play: 'double play', field_out: 'out', strikeout: 'strikeout', sac_bunt: 'bunt', intent_walk: 'walk' };
function mlbMoment(G, p, bat, top, diffB, diffA, wpa, walkoff, hd) {
  const r = p.result || {}, ab = p.about || {}, mu = p.matchup || {};
  const who = lastName(mu.batter && mu.batter.fullName), pit = lastName(mu.pitcher && mu.pitcher.fullName);
  const et = r.eventType || '', word = MLB_WORD[et] || String(r.event || 'play').toLowerCase();
  const inn = (top ? 'Top ' : 'Bot ') + ord(ab.inning || 1);
  const hrWord = r.rbi === 4 ? 'grand slam' : r.rbi > 1 ? r.rbi + '-run homer' : 'solo homer';
  let title;
  if (walkoff) title = et === 'home_run' ? who + '’s walk-off ' + (r.rbi === 4 ? 'grand slam' : 'homer') : who + ' walks it off with a ' + word;
  else if (wpa < 0) title = pit + ' gets ' + who + ' to escape the ' + ord(ab.inning || 1);
  else if (diffB <= 0 && diffA > 0) title = who + '’s go-ahead ' + (et === 'home_run' ? hrWord : word) + ' in the ' + ord(ab.inning || 1);
  else if (diffB < 0 && diffA === 0) title = who + ' ties it in the ' + ord(ab.inning || 1);
  else if (et === 'home_run') title = who + '’s ' + hrWord;
  else title = who + '’s ' + word;
  let sub = trim(r.description, 150);
  if (et === 'home_run' && hd && hd.totalDistance) sub = Math.round(hd.totalDistance) + ' feet' + (hd.launchSpeed ? ', ' + hd.launchSpeed + ' mph off the bat' : '') + '. ' + sub;
  const team = wpa < 0 ? (top ? G.home : G.away) : bat;
  return {
    gameId: G.id, date: G.date, team: { name: team.name, abbr: team.abbr }, when: inn, title: title, sub: sub,
    swing: Math.round(Math.abs(wpa)), anim: mlbAnim(p, hd, walkoff)
  };
}
function mlbAnim(p, hd, walkoff) {
  const r = p.result || {}, mu = p.matchup || {};
  const batterId = mu.batter && mu.batter.id;
  const byRunner = {};
  let fielder = null;
  (p.runners || []).forEach(function (rn) {
    const id = rn.details && rn.details.runner && rn.details.runner.id, mv = rn.movement || {};
    if (id == null) return;
    const cur = byRunner[id] || (byRunner[id] = { start: mv.originBase || mv.start || null, end: null, out: false, batter: id === batterId });
    if (cur.start == null && mv.start) cur.start = mv.start;
    cur.end = mv.isOut ? (mv.outBase || cur.end) : (mv.end || cur.end);
    if (mv.isOut) cur.out = true;
    (rn.credits || []).forEach(function (c) { if (!fielder && c.position && /putout|fielded/.test(c.credit || '')) fielder = c.position.code; });
  });
  const runners = Object.keys(byRunner).map(function (k) { const x = byRunner[k]; return [x.start || (x.batter ? 'B' : null), x.end, x.out ? 1 : 0, x.batter ? 1 : 0]; });
  const c = hd && hd.coordinates;
  return {
    k: 'mlb', ev: r.eventType || '', rbi: r.rbi || 0, walkoff: !!walkoff, out: !!r.isOut,
    coord: c && c.coordX != null ? [Math.round(c.coordX * 10) / 10, Math.round(c.coordY * 10) / 10] : null,
    traj: hd ? hd.trajectory || null : null, ft: hd && hd.totalDistance ? Math.round(hd.totalDistance) : null,
    fielder: fielder, runners: runners
  };
}

// ═══ MLB — a week, built from the (edge-cached) daily recaps ═══════════
async function mlbWeek(req, start, end) {
  const proto = req.headers['x-forwarded-proto'] || 'https', host = req.headers['x-forwarded-host'] || req.headers.host;
  const days = daysBetween(start, end);
  const raw = await Promise.all(days.map(function (d) { return getJson(proto + '://' + host + '/api/recap?sport=mlb&start=' + d + '&end=' + d, 25000); }));
  const pending = raw.some(function (x) { return !x || x.pending || x.error; });
  const dailies = raw.filter(function (x) { return x && !x.empty; });
  if (!dailies.length) return pending ? { empty: true, pending: true } : null;
  let games = [], moments = [];
  const tally = { walkoffs: 0, hr: 0, extras: 0, slams: 0, longest: null };
  const teamWeek = {};
  dailies.forEach(function (d) {
    games = games.concat(d.games || []);
    (d.moments || []).forEach(function (m, i) { moments.push(Object.assign({ _score: (m.swing || 0) + (m.anim && m.anim.walkoff ? 25 : 0) - i }, m)); });
    const f = d.facts || {};
    tally.walkoffs += f.walkoffs || 0; tally.hr += f.hr || 0; tally.extras += f.extras || 0; tally.slams += f.slams || 0;
    if (f.longest && (!tally.longest || f.longest.ft > tally.longest.ft)) tally.longest = f.longest;
  });
  games.forEach(function (g) {
    const aw = g.away.score > g.home.score;
    [[g.away, g.home, aw, 0], [g.home, g.away, !aw, 1]].forEach(function (x) {
      const t = teamWeek[x[0].name] || (teamWeek[x[0].name] = { w: 0, l: 0, abbr: x[0].abbr, g: [] });
      if (x[2]) t.w++; else t.l++;
      t.g.push([g.date, x[1].abbr, x[0].score, x[1].score, x[3], g.id]); // date, opponent, us, them, home?, game
    });
  });
  const top = pickMoments(moments, 5, 1);
  const topGames = games.slice().sort(function (a, b) { return (b.ex || 0) - (a.ex || 0); }).slice(0, 8);
  // The race: contenders at the end of the week and how their week went
  const st = await getJson(MLB + '/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team&date=' + end);
  const race = [];
  ((st && st.records) || []).forEach(function (rec) {
    (rec.teamRecords || []).forEach(function (tr) {
      const wc = tr.wildCardRank != null ? Number(tr.wildCardRank) : 99;
      const div1 = String(tr.divisionRank) === '1';
      const wcgb = tr.wildCardGamesBack;
      const close = div1 || wc <= 3 || (wcgb != null && wcgb !== '-' && parseFloat(wcgb) <= 4);
      if (!close) return;
      const name = tr.team && tr.team.name, tw = teamWeek[name] || { w: 0, l: 0 }, wk = [tw.w, tw.l];
      race.push({ name: name, abbr: (tr.team && tr.team.abbreviation) || '', rec: tr.wins + '–' + tr.losses, week: wk[0] + '–' + wk[1], net: wk[0] - wk[1],
        status: tr.clinched ? (div1 ? 'Clinched division' : 'Clinched') : div1 ? 'Leads division' : wc <= 3 ? 'Wild Card ' + wc : (wcgb && wcgb !== '-' ? wcgb + ' back' : '') });
    });
  });
  race.sort(function (a, b) { return Math.abs(b.net) - Math.abs(a.net); });
  const nums = [];
  if (tally.walkoffs) nums.push([String(tally.walkoffs), 'walk-offs this week']);
  if (tally.longest) nums.push([String(tally.longest.ft), 'feet, longest homer (' + tally.longest.who + ')']);
  nums.push([String(tally.hr), 'home runs']);
  if (tally.extras) nums.push([String(tally.extras), 'extra-inning games']);
  if (tally.slams) nums.push([String(tally.slams), tally.slams === 1 ? 'grand slam' : 'grand slams']);
  return {
    sport: 'mlbw', league: 'mlb', kind: 'week', start: start, end: end, id: 'mlbw-' + start, pending: pending,
    kick: 'WEEK OF ' + range(start, end), title: 'The week in baseball',
    dek: games.length + ' games, ' + joinList([tally.walkoffs ? tally.walkoffs + ' walk-offs' : '', tally.hr + ' home runs', tally.extras ? tally.extras + ' in extras' : '']) + '.',
    ring: { label: 'MLB week', sub: 'WEEK' },
    games: topGames, hero: heroOf(topGames, top), moments: top, nums: nums.slice(0, 4),
    race: race.slice(0, 6), teamWeek: teamWeek
  };
}

// ═══ NHL — one day ══════════════════════════════════════════════════════
async function nhlDay(date) {
  const sc = await getJson(NHL + '/score/' + date);
  const all = ((sc && sc.games) || []).filter(function (g) { return String(g.gameDate || date) === date && !/PPD|CANC|SUSP/.test(g.gameScheduleState || ''); });
  const list = all.filter(function (g) { return /OFF|FINAL/.test(g.gameState || ''); });
  const pending = list.length < all.length;
  if (!list.length) return pending ? { empty: true, pending: true } : null;
  const pbps = await Promise.all(list.map(function (g) { return getJson(NHL + '/gamecenter/' + g.id + '/play-by-play', 9000); }));
  const games = [], cands = [];
  const facts = { ot: 0, so: 0, goals: 0, hats: 0, comeback: null };
  list.forEach(function (g, gi) {
    const tm = function (t) { const place = (t.placeName && t.placeName.default) || '', nm = (t.commonName && t.commonName.default) || (t.name && t.name.default) || ''; return { name: /\s/.test(nm) && !place ? nm : (place && nm && nm.indexOf(place) !== 0 ? place + ' ' + nm : nm || place), abbr: t.abbrev || '', short: nm.replace(place, '').trim() || nm, score: t.score || 0, id: t.id }; };
    const G = { id: g.id, date: date, away: tm(g.awayTeam), home: tm(g.homeTeam), note: 'Final', ex: 0, comeback: 0, extra: null };
    const lastType = (g.gameOutcome && g.gameOutcome.lastPeriodType) || (g.periodDescriptor && g.periodDescriptor.periodType) || 'REG';
    if (lastType === 'OT') { G.note = 'F/OT'; G.extra = 'overtime'; facts.ot++; G.ex += 20; }
    if (lastType === 'SO') { G.note = 'F/SO'; G.extra = 'a shootout'; facts.so++; G.ex += 25; }
    const pbp = pbps[gi] || {};
    const roster = {};
    (pbp.rosterSpots || []).forEach(function (r) { roster[r.playerId] = { name: ((r.firstName && r.firstName.default) || '') + ' ' + ((r.lastName && r.lastName.default) || ''), pos: r.positionCode }; });
    const goalsBy = {};
    let a = 0, h = 0, minHome = 0, maxHome = 0;
    const plays = (pbp.plays || []).filter(function (p) { return p.typeDescKey === 'goal'; });
    const soGoals = plays.filter(function (p) { return p.periodDescriptor && p.periodDescriptor.periodType === 'SO'; });
    plays.forEach(function (p) {
      const d = p.details || {}, pd = p.periodDescriptor || {};
      const so = pd.periodType === 'SO';
      const home = d.eventOwnerTeamId === G.home.id;
      const scorer = roster[d.scoringPlayerId] || { name: '', pos: '' };
      const who = lastName(scorer.name);
      const team = home ? G.home : G.away;
      if (so) {
        if (p === soGoals[soGoals.length - 1] && team.score > (home ? G.away.score : G.home.score)) cands.push(Object.assign(nhlMoment(G, p, team, who + ' wins the shootout', 'The deciding shot, round ' + (soGoals.length) + '.', 'SO', d), { _score: 55 }));
        return;
      }
      facts.goals++;
      const bA = a, bH = h;
      if (d.awayScore != null) a = d.awayScore; if (d.homeScore != null) h = d.homeScore;
      minHome = Math.min(minHome, h - a); maxHome = Math.max(maxHome, h - a);
      goalsBy[d.scoringPlayerId] = (goalsBy[d.scoringPlayerId] || 0) + 1;
      const diffB = home ? bH - bA : bA - bH, diffA = home ? h - a : a - h;
      const clock = String(p.timeInPeriod || '00:00'), mm = clock.split(':'), el = Number(mm[0]) * 60 + Number(mm[1] || 0), left = 1200 - el;
      const per = pd.number || 1, ot = pd.periodType === 'OT';
      let score = 8, title = who + ' scores', sub = '';
      if (ot) { score = 60; title = who + ' wins it in overtime'; }
      else if (per === 3 && diffB <= 0 && diffA > 0 && left <= 300) { score = 48; title = who + '’s go-ahead goal with ' + fmtLeft(left) + ' left'; }
      else if (per === 3 && diffB < 0 && diffA === 0 && left <= 180) { score = 46; title = who + ' ties it with ' + fmtLeft(left) + ' left'; }
      else if (per === 3 && diffB <= 0 && diffA > 0) { score = 30; title = who + '’s go-ahead goal in the 3rd'; }
      if (goalsBy[d.scoringPlayerId] === 3) { score = Math.max(score, 36) + 4; title = who + '’s hat trick'; facts.hats++; }
      if (scorer.pos === 'G') { score = 58; title = who + ' scores a goalie goal'; }
      sub = (d.shotType ? cap(d.shotType) + ' · ' : '') + (ot ? 'Overtime' : ord(per) + ' period, ' + clock) + (d.goalieInNetId ? '' : ' · empty net');
      if (score >= 20) { const m = nhlMoment(G, p, team, title, sub, ot ? 'OT' : ord(per) + ' ' + clock, d); m._score = score; cands.push(m); G.ex += score / 2; }
    });
    const winnerHome = G.home.score > G.away.score;
    G.comeback = winnerHome ? -minHome : maxHome;
    if (G.comeback >= 2 && (!facts.comeback || G.comeback > facts.comeback.n)) facts.comeback = { n: G.comeback, team: winnerHome ? G.home.short : G.away.short };
    G.ex += G.comeback * 8 + (Math.abs(G.home.score - G.away.score) <= 1 ? 10 : 0);
    games.push(G);
  });
  const moments = pickMoments(cands, 4, 2);
  const nums = [];
  if (facts.ot + facts.so) nums.push([String(facts.ot + facts.so), facts.ot + facts.so === 1 ? 'game past regulation' : 'games past regulation']);
  if (facts.hats) nums.push([String(facts.hats), facts.hats === 1 ? 'hat trick' : 'hat tricks']);
  if (facts.comeback) nums.push([String(facts.comeback.n), 'goal comeback by the ' + facts.comeback.team]);
  nums.push([String(facts.goals), 'goals']);
  return {
    sport: 'nhl', league: 'nhl', kind: 'day', start: date, end: date, id: 'nhl-' + date, pending: pending,
    kick: kickDay(date), title: wday(date) + ' in the NHL',
    dek: cap(joinList([facts.so ? (facts.so === 1 ? 'a shootout' : facts.so + ' shootouts') : '', facts.ot ? (facts.ot === 1 ? 'an overtime winner' : facts.ot + ' overtime winners') : '', facts.hats ? (facts.hats === 1 ? 'a hat trick' : facts.hats + ' hat tricks') : '', facts.comeback ? 'a ' + facts.comeback.n + '-goal comeback' : ''].filter(Boolean).slice(0, 3))) + '.' || games.length + ' games.',
    ring: { label: 'NHL', sub: wday(date).slice(0, 3).toUpperCase() },
    games: games, hero: heroOf(games, moments), moments: moments, nums: nums.slice(0, 4)
  };
}
function fmtLeft(s) { s = Math.max(0, s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function nhlMoment(G, p, team, title, sub, when, d) {
  // |x| from center ice; the goal line is 89 ft out. y is side to side (±42.5).
  const x = d.xCoord, y = d.yCoord;
  return { gameId: G.id, date: G.date, team: { name: team.name, abbr: team.abbr }, when: when, title: title, sub: sub, swing: null,
    anim: { k: 'hk', depth: x != null ? Math.max(0, 89 - Math.abs(x)) : null, lat: y != null ? (x < 0 ? -y : y) : null, so: (p.periodDescriptor || {}).periodType === 'SO', en: !d.goalieInNetId } };
}

// ═══ ESPN leagues — football, basketball, soccer ════════════════════════
async function espnRecap(sport, start, end) {
  const path = ESPN_PATH[sport];
  // ESPN rejects date ranges for some leagues (football returns 400), so ask one day at a time
  const boards = await Promise.all(daysBetween(start, end).map(function (d) { return getJson(ESPN + path + '/scoreboard?dates=' + d.replace(/-/g, '')); }));
  const seen = {}, merged = [];
  let sb = null;
  boards.forEach(function (b) {
    if (!b) return;
    if (!sb || (!sb.week && b.week)) sb = b;
    (b.events || []).forEach(function (e) { if (!seen[e.id]) { seen[e.id] = 1; merged.push(e); } });
  });
  const allEv = merged.filter(function (e) { return !/postpon|cancel|suspend/i.test((e.status && e.status.type && e.status.type.name) || ''); });
  const events = allEv.filter(function (e) { return e.status && e.status.type && e.status.type.completed; });
  const pending = events.length < allEv.length;
  if (!events.length) return pending ? { empty: true, pending: true } : null;
  const sums = await Promise.all(events.map(function (e) { return getJson(ESPN + path + '/summary?event=' + e.id, 9000); }));
  const games = [], cands = [];
  const fam = /football/.test(path) ? 'fb' : /basketball/.test(path) ? 'bk' : 'sc';
  const facts = { close: 0, ot: 0, comeback: null, longest: null, buzzer: 0, lateWinners: 0, goals: 0, hats: 0, top: null, defTd: 0 };
  events.forEach(function (e, gi) {
    const comp = (e.competitions && e.competitions[0]) || {};
    const cs = comp.competitors || [];
    const tm = function (side) {
      const c = cs.filter(function (x) { return x.homeAway === side; })[0] || {}, t = c.team || {};
      return { name: t.displayName || t.name || '', abbr: t.abbreviation || '', short: t.shortDisplayName || t.name || '', score: Number(c.score || 0), id: String(t.id || ''), color: t.color || null, alt: t.alternateColor || null };
    };
    const G = { id: e.id, date: (e.date || '').slice(0, 10), away: tm('away'), home: tm('home'), note: 'Final', ex: 0, comeback: 0, extra: null, wp: null };
    const per = (e.status && e.status.period) || 0;
    const reg = fam === 'sc' ? 2 : 4;
    if (per > reg) { G.note = fam === 'sc' ? 'AET' : (per - reg > 1 ? (per - reg) + 'OT' : 'OT'); G.extra = 'overtime'; facts.ot++; G.ex += 20; }
    if (Math.abs(G.home.score - G.away.score) <= (fam === 'fb' ? 3 : fam === 'bk' ? 3 : 0)) { facts.close++; G.ex += 12; }
    const data = sums[gi] || {};
    // Win probability by play id, when ESPN has it (football and basketball)
    const wpMap = {}, series = [];
    (data.winprobability || []).forEach(function (w) { if (w && w.playId != null && w.homeWinPercentage != null) { wpMap[String(w.playId)] = w.homeWinPercentage * 100; series.push(Math.round(w.homeWinPercentage * 100)); } });
    if (series.length > 3) G.wp = sample(series, 40);
    const ctx = { G: G, wpMap: wpMap, facts: facts, cands: cands, sport: sport };
    if (fam === 'fb') fbGame(data, ctx);
    else if (fam === 'bk') bkGame(data, ctx);
    else scGame(data, ctx);
    games.push(G);
  });
  if (fam === 'bk') bkStar(sums, events, games, cands, facts, sport);
  const moments = pickMoments(cands, 4, 2);
  const week = sb && sb.week && sb.week.number;
  const lg = { nfl: 'the NFL', cfb: 'college football', nba: 'the NBA', wnba: 'the WNBA', mls: 'MLS', nwsl: 'the NWSL' }[sport];
  const isDay = fam === 'bk';
  const nums = [], dekBits = [];
  if (fam === 'fb') {
    if (facts.close) { nums.push([String(facts.close), facts.close === 1 ? 'game decided by 3 or fewer' : 'games decided by 3 or fewer']); dekBits.push(facts.close === 1 ? 'a one-score finish' : facts.close + ' one-score finishes'); }
    if (facts.longest) { nums.push([String(facts.longest.yds), 'yards, longest play (' + facts.longest.who + ')']); dekBits.push('a ' + facts.longest.yds + '-yard ' + facts.longest.kind); }
    if (facts.defTd) { nums.push([String(facts.defTd), facts.defTd === 1 ? 'defensive touchdown' : 'defensive touchdowns']); }
    if (facts.ot) { nums.push([String(facts.ot), facts.ot === 1 ? 'game in overtime' : 'games in overtime']); dekBits.push(facts.ot === 1 ? 'an overtime game' : facts.ot + ' overtime games'); }
  } else if (fam === 'bk') {
    if (facts.top) { nums.push([String(facts.top.pts), 'points for ' + facts.top.who]); dekBits.push('a ' + facts.top.pts + '-point night'); }
    if (facts.buzzer) { nums.push([String(facts.buzzer), facts.buzzer === 1 ? 'buzzer-beater' : 'buzzer-beaters']); dekBits.push(facts.buzzer === 1 ? 'a buzzer-beater' : facts.buzzer + ' buzzer-beaters'); }
    if (facts.comeback && facts.comeback.n >= 12) { nums.push([String(facts.comeback.n), 'point comeback by the ' + facts.comeback.team]); dekBits.push('a ' + facts.comeback.n + '-point comeback'); }
    if (facts.close) nums.push([String(facts.close), facts.close === 1 ? 'game decided by 3 or fewer' : 'games decided by 3 or fewer']);
    if (facts.ot) nums.push([String(facts.ot), facts.ot === 1 ? 'overtime game' : 'overtime games']);
  } else {
    nums.push([String(facts.goals), 'goals']);
    if (facts.lateWinners) { nums.push([String(facts.lateWinners), 'late winners (80′ or later)']); dekBits.push(facts.lateWinners === 1 ? 'a late winner' : facts.lateWinners + ' late winners'); }
    if (facts.hats) { nums.push([String(facts.hats), facts.hats === 1 ? 'hat trick' : 'hat tricks']); dekBits.push(facts.hats === 1 ? 'a hat trick' : facts.hats + ' hat tricks'); }
    if (facts.comeback && facts.comeback.n >= 2) { nums.push([String(facts.comeback.n), 'goal comeback by ' + facts.comeback.team]); dekBits.push('a ' + facts.comeback.n + '-goal comeback'); }
  }
  const dek = dekBits.length ? cap(joinList(dekBits.slice(0, 3))) + '.' : games.length + ' games.';
  let kick, title, ring;
  if (isDay) { kick = kickDay(start); title = wday(start) + ' in ' + lg; ring = { label: sport.toUpperCase(), sub: wday(start).slice(0, 3).toUpperCase() }; }
  else if (fam === 'fb' && week) { kick = 'WEEK ' + week + ' · ' + range(start, end); title = 'Week ' + week + ' in ' + lg; ring = { label: sport === 'cfb' ? 'College' : 'NFL', sub: 'WK ' + week }; }
  else { kick = 'WEEK OF ' + range(start, end); title = 'The week in ' + lg; ring = { label: sport.toUpperCase(), sub: 'WEEK' }; }
  return { sport: sport, league: sport, kind: isDay ? 'day' : 'week', start: start, end: end, id: sport + '-' + start, pending: pending, kick: kick, title: title, dek: dek, ring: ring,
    games: isDay || games.length <= 16 ? games : games.slice().sort(function (a, b) { return (b.ex || 0) - (a.ex || 0); }).slice(0, 16),
    hero: heroOf(games, moments), moments: moments, nums: nums.slice(0, 4) };
}
function wpDelta(ctx, play, prevWp) {
  const w = ctx.wpMap[String(play.id)];
  if (w == null) return { now: prevWp, d: null };
  return { now: w, d: prevWp == null ? null : w - prevWp };
}
function forTeam(G, homeSide, d) { return d == null ? null : homeSide ? d : -d; }

// ── football ──
function fbGame(data, ctx) {
  const G = ctx.G;
  const drives = ((data.drives && data.drives.previous) || []).concat(data.drives && data.drives.current ? [data.drives.current] : []);
  let prevWp = 50, a = 0, h = 0, minHome = 0, maxHome = 0;
  drives.forEach(function (dr) {
    const offId = dr.team && String(dr.team.id);
    (dr.plays || []).forEach(function (p) {
      const t = String(p.text || ''), type = String((p.type && p.type.text) || '');
      const wd = wpDelta(ctx, p, prevWp); if (wd.now != null) prevWp = wd.now;
      const bA = a, bH = h;
      if (p.awayScore != null) a = Number(p.awayScore); if (p.homeScore != null) h = Number(p.homeScore);
      minHome = Math.min(minHome, h - a); maxHome = Math.max(maxHome, h - a);
      if (/timeout|end of|kickoff$|coin toss|two-minute/i.test(type) && !/touchdown/i.test(type)) return;
      const defTd = /interception return touchdown|fumble return touchdown|blocked.*touchdown/i.test(type);
      const retTd = /(punt|kickoff) return touchdown/i.test(type);
      // the team that benefited: the defense on turnovers/defensive scores, else the offense
      let benefitHome = offId === G.home.id;
      if (defTd || /interception|fumble recovery \(opponent\)|safety/i.test(type)) benefitHome = !benefitHome;
      const yds = p.statYardage != null ? Number(p.statYardage) : null;
      const per = (p.period && p.period.number) || 1, clock = (p.clock && p.clock.displayValue) || '';
      const secs = clockSecs(clock), late = per >= 4 && secs != null && secs <= 120, ot = per > 4;
      const diffB = benefitHome ? bH - bA : bA - bH, diffA = benefitHome ? h - a : a - h;
      const goAhead = diffB <= 0 && diffA > 0;
      let score = wd.d != null ? Math.abs(wd.d) : 0;
      if (wd.d == null) { // no win probability: judge it ourselves
        if (p.scoringPlay && (late || ot) && goAhead) score = 60 + (secs != null && secs <= 5 ? 25 : 0);
        else if (p.scoringPlay && goAhead && per >= 4) score = 35;
        else if (defTd || retTd) score = 35;
        else if (yds != null && Math.abs(yds) >= 50) score = 20 + yds / 4;
      } else if (p.scoringPlay && (late || ot) && goAhead && secs != null && secs <= 5) score += 20;
      if (defTd) ctx.facts.defTd++;
      if (yds != null && yds >= 40 && /pass|rush|run|touchdown/i.test(type + t) && !/penalty/i.test(type) && (!ctx.facts.longest || yds > ctx.facts.longest.yds)) ctx.facts.longest = { yds: yds, who: fbCatcher(t) || fbWho(t), kind: /pass/i.test(type + t) ? 'catch' : 'run' };
      if (score < 15) return;
      const team = benefitHome ? G.home : G.away;
      const m = { gameId: G.id, date: G.date, team: { name: team.name, abbr: team.abbr }, when: (ot ? 'OT' : 'Q' + per) + (clock ? ' ' + clock : ''),
        title: fbTitle(t, type, yds, goAhead && (late || ot) && secs != null && secs <= 5), sub: trim(t.replace(/^\((?:Shotgun|No Huddle[^)]*)\)\s*/i, ''), 150),
        swing: wd.d != null ? Math.round(Math.max(0, forTeam(G, benefitHome, wd.d))) : null, anim: fbAnim(p, t, type, yds, clock, secs) };
      m._score = score;
      ctx.cands.push(m);
      G.ex += score / 3;
    });
  });
  const winnerHome = G.home.score > G.away.score;
  G.comeback = winnerHome ? -minHome : maxHome;
  if (G.comeback >= 10 && (!ctx.facts.comeback || G.comeback > ctx.facts.comeback.n)) ctx.facts.comeback = { n: G.comeback, team: winnerHome ? G.home.short : G.away.short };
  G.ex += G.comeback * 2;
}
function clockSecs(c) { const m = String(c || '').match(/^(\d+):(\d+(?:\.\d+)?)$/); if (m) return Number(m[1]) * 60 + Number(m[2]); const n = Number(c); return isNaN(n) ? null : n; }
function fbWho(t) { const m = String(t).replace(/^\([^)]*\)\s*/, '').match(/^([A-Z][A-Za-z.'\-]+(?: [A-Z][A-Za-z.'\-]+)?)/); return m ? nameOnly(m[1]) : ''; }
function fbCatcher(t) { const m = String(t).match(/pass .*?(?:to|for) ([A-Z][\w.'\-]+)/); return m && !/INTERCEPT/i.test(t) ? nameOnly(m[1]) : ''; }
function fbTitle(t, type, yds, walkoff) {
  t = String(t).replace(/^\((?:Shotgun|No Huddle[^)]*)\)\s*/i, '');
  let m;
  if ((m = t.match(/([A-Z][\w.'\-]+) (\d+) (?:yard|yd) field goal is GOOD/i))) return nameOnly(m[1]) + '’s ' + m[2] + '-yard field goal' + (walkoff ? ' wins it' : '');
  if ((m = t.match(/INTERCEPTED by ([A-Z][\w.'\-]+)/i))) return nameOnly(m[1]) + (/touchdown/i.test(type) ? '’s pick-six' : ' picks it off');
  if ((m = t.match(/^([A-Z][\w.'\-]+) pass .*?(?:to|for) ([A-Z][\w.'\-]+).*?for (\d+) (?:yard|yd)/i))) return nameOnly(m[1]) + ' to ' + nameOnly(m[2]) + ', ' + m[3] + ' yards' + (/touchdown/i.test(t) ? ' for the TD' : '') + (walkoff ? ' to win it' : '');
  if (/(punt|kickoff) return touchdown/i.test(type)) return fbWho(t) + '’s return touchdown';
  if ((m = t.match(/^([A-Z][\w.'\-]+) .*?for (\d+) (?:yard|yd)/i)) && /touchdown/i.test(t)) return nameOnly(m[1]) + '’s ' + m[2] + '-yard touchdown run' + (walkoff ? ' wins it' : '');
  if ((m = t.match(/^([A-Z][\w.'\-]+) .*?for (\d+) (?:yard|yd)/i))) return nameOnly(m[1]) + ' breaks off ' + m[2] + ' yards';
  if (/sacked/i.test(t)) return 'A sack at the worst time';
  return trim(t, 60);
}
function fbAnim(p, t, type, yds, clock, secs) {
  const s = p.start || {}, e = p.end || {};
  const from = s.yardsToEndzone != null ? 100 - Number(s.yardsToEndzone) : 50;
  let to = e.yardsToEndzone != null ? 100 - Number(e.yardsToEndzone) : (yds != null ? from + yds : from);
  let kind = 'run';
  if (/field goal/i.test(type) || /field goal/i.test(t)) kind = 'fg';
  else if (/interception/i.test(type)) kind = 'int';
  else if (/(punt|kickoff) return/i.test(type)) kind = 'ret';
  else if (/pass|sack/i.test(type)) kind = /incompletion|incomplete/i.test(type + t) ? 'inc' : /sack/i.test(type) ? 'sack' : 'pass';
  else if (/fumble/i.test(type)) kind = 'fum';
  let ret = null;
  if (kind === 'int') { const m = t.match(/INTERCEPTED.*?for (-?\d+) (?:yard|yd)/i); ret = m ? Number(m[1]) : null; to = from + 12; }
  if (kind === 'fg') { const m = t.match(/(\d+) (?:yard|yd) field goal/i); to = m ? Number(m[1]) : null; }
  const lane = /\bleft\b/i.test(t) ? 'l' : /\bright\b/i.test(t) ? 'r' : 'm';
  return { k: 'fb', kind: kind, from: Math.round(from), to: to != null ? Math.round(to) : null, yds: yds, td: /touchdown/i.test(type + ' ' + t), good: /is GOOD/i.test(t), ret: ret, lane: lane, clock: secs != null && secs <= 60 ? clock : null };
}

// ── basketball ──
function bkGame(data, ctx) {
  const G = ctx.G;
  let prevWp = 50, minHome = 0, maxHome = 0, a = 0, h = 0;
  (data.plays || []).forEach(function (p) {
    const wd = wpDelta(ctx, p, prevWp); if (wd.now != null) prevWp = wd.now;
    const bA = a, bH = h;
    if (p.awayScore != null) a = Number(p.awayScore); if (p.homeScore != null) h = Number(p.homeScore);
    minHome = Math.min(minHome, h - a); maxHome = Math.max(maxHome, h - a);
    if (!p.scoringPlay) return;
    const home = p.team && String(p.team.id) === G.home.id;
    const per = (p.period && p.period.number) || 1, clock = (p.clock && p.clock.displayValue) || '', secs = clockSecs(clock);
    const diffB = home ? bH - bA : bA - bH, diffA = home ? h - a : a - h;
    const lastDecided = per >= 4 && secs != null;
    const buzzer = lastDecided && secs <= 1.0 && diffB <= 0 && diffA >= 0 && (diffA > 0 || diffB < 0);
    let score = wd.d != null ? Math.abs(wd.d) : 0;
    if (wd.d == null) {
      if (buzzer) score = 80;
      else if (lastDecided && secs <= 30 && diffB <= 0 && diffA > 0) score = 45;
      else if (lastDecided && secs <= 120 && diffB <= 0 && diffA > 0) score = 25;
    } else if (buzzer) score += 30;
    if (buzzer) ctx.facts.buzzer++;
    if (score < 15) return;
    const team = home ? G.home : G.away;
    const m = { gameId: G.id, date: G.date, team: { name: team.name, abbr: team.abbr }, when: (per > 4 ? 'OT' : 'Q' + per) + ' ' + clock,
      title: bkTitle(p.text, buzzer, diffB <= 0 && diffA > 0 && lastDecided && secs <= 60), sub: trim(p.text, 140),
      swing: wd.d != null ? Math.round(Math.max(0, forTeam(G, home, wd.d))) : null, anim: bkAnim(p, buzzer, clock) };
    m._score = score;
    ctx.cands.push(m);
    G.ex += score / 3;
  });
  const winnerHome = G.home.score > G.away.score;
  G.comeback = winnerHome ? -minHome : maxHome;
  if (G.comeback >= 10 && (!ctx.facts.comeback || G.comeback > ctx.facts.comeback.n)) ctx.facts.comeback = { n: G.comeback, team: winnerHome ? G.home.short : G.away.short };
  G.ex += G.comeback;
}
function bkShot(t) { t = String(t || ''); const dist = (t.match(/(\d+)-foot/) || [])[1]; return { dist: dist ? Number(dist) : /dunk|layup|tip|alley/i.test(t) ? 2 : /three/i.test(t) ? 25 : 12, three: /three point/i.test(t), kind: /dunk/i.test(t) ? 'dunk' : /layup/i.test(t) ? 'layup' : /three point/i.test(t) ? 'three' : /free throw/i.test(t) ? 'ft' : 'jumper' }; }
function bkTitle(t, buzzer, goAheadLate) {
  const who = lastName((String(t).match(/^(.+?) (?:makes|made|dunks|lays|hits|tips)/i) || [])[1] || '');
  const s = bkShot(t);
  const shot = s.kind === 'three' ? (s.dist ? s.dist + '-foot three' : 'three') : s.kind === 'dunk' ? 'dunk' : s.kind === 'layup' ? 'layup' : s.kind === 'ft' ? 'free throws' : (s.dist ? s.dist + '-footer' : 'jumper');
  if (buzzer) return who + '’s ' + shot + ' at the buzzer';
  if (goAheadLate) return who + '’s go-ahead ' + shot;
  return who + '’s ' + shot;
}
function bkAnim(p, buzzer, clock) {
  const s = bkShot(p.text), c = p.coordinate || {};
  const side = c.x != null && c.x > -100 && c.x < 100 ? Math.max(-1, Math.min(1, (c.x - 25) / 25)) : ((hash(p.id) % 200) / 100 - 1);
  return { k: 'bk', dist: s.dist, three: s.three, kind: s.kind, side: Math.round(side * 100) / 100, clock: clock, buzzer: !!buzzer };
}
// The night's top scorer, drawn as a shot chart
function bkStar(sums, events, games, cands, facts, sport) {
  let best = null;
  sums.forEach(function (data, gi) {
    ((data && data.boxscore && data.boxscore.players) || []).forEach(function (tp) {
      const st = (tp.statistics || [])[0]; if (!st) return;
      const idx = (st.labels || st.names || []).indexOf('PTS');
      if (idx < 0) return;
      (st.athletes || []).forEach(function (a) {
        const pts = Number((a.stats || [])[idx]);
        if (!isNaN(pts) && (!best || pts > best.pts)) best = { pts: pts, id: String(a.athlete && a.athlete.id), name: (a.athlete && a.athlete.displayName) || '', team: tp.team, gi: gi };
      });
    });
  });
  if (!best) return;
  facts.top = { pts: best.pts, who: lastName(best.name) };
  if (best.pts < (sport === 'wnba' ? 32 : 42)) return;
  const data = sums[best.gi], G = games[best.gi];
  const shots = (data.plays || []).filter(function (p) { return p.scoringPlay && p.shootingPlay && !/free throw/i.test(p.text || '') && p.participants && p.participants[0] && String(p.participants[0].athlete && p.participants[0].athlete.id) === best.id; })
    .map(function (p) { const a = bkAnim(p, false, ''); return [a.side, a.dist, a.three ? 1 : 0]; });
  const teamName = best.team && (best.team.displayName || best.team.name) || '';
  const team = G.home.name === teamName ? G.home : G.away.name === teamName ? G.away : G.home;
  cands.push({ gameId: G.id, date: G.date, team: { name: team.name, abbr: team.abbr }, when: 'All game', title: lastName(best.name) + ' scores ' + best.pts, sub: 'Every make, on the court.', swing: null, anim: { k: 'bkchart', shots: shots }, _score: 40 + (best.pts - 40) });
}

// ── soccer ──
function scGame(data, ctx) {
  const G = ctx.G;
  let a = 0, h = 0, minHome = 0, maxHome = 0;
  const goalsBy = {};
  const evs = (data.keyEvents || []).filter(function (e) { const type = String((e.type && (e.type.text || e.type.type)) || ''); return e.scoringPlay || (/goal/i.test(type) && !/disallow|no goal|kick/i.test(type)); });
  evs.forEach(function (e, i) {
    const type = String((e.type && (e.type.text || e.type.type)) || '');
    const home = e.team && (String(e.team.id) === G.home.id || e.team.displayName === G.home.name);
    const bA = a, bH = h;
    if (home) h++; else a++;
    minHome = Math.min(minHome, h - a); maxHome = Math.max(maxHome, h - a);
    ctx.facts.goals++;
    const who = (e.participants && e.participants[0] && e.participants[0].athlete && e.participants[0].athlete.displayName) || '';
    const clock = (e.clock && e.clock.displayValue) || '';
    const mins = (clock.match(/(\d+)/g) || []).map(Number).reduce(function (s, x) { return s + x; }, 0);
    const diffB = home ? bH - bA : bA - bH, diffA = home ? h - a : a - h;
    const winnerStood = diffA > 0 && i === evs.length - 1 && (home ? G.home.score > G.away.score : G.away.score > G.home.score);
    goalsBy[who] = (goalsBy[who] || 0) + 1;
    let score = 10, title = lastName(who) + ' scores';
    if (mins >= 80 && diffB <= 0 && diffA > 0 && winnerStood) { score = 60 + (mins >= 90 ? 10 : 0); title = lastName(who) + ' wins it in the ' + mins + '′'; ctx.facts.lateWinners++; }
    else if (mins >= 80 && diffB < 0 && diffA === 0) { score = 45; title = lastName(who) + ' equalizes in the ' + mins + '′'; }
    else if (diffB <= 0 && diffA > 0) { score = 22; title = lastName(who) + '’s go-ahead goal'; }
    if (goalsBy[who] === 3) { score = Math.max(score, 40); title = lastName(who) + '’s hat trick'; ctx.facts.hats++; }
    if (/own goal/i.test(type)) title = 'An own goal in the ' + mins + '′';
    if (score < 20) return;
    const team = home ? G.home : G.away;
    const m = { gameId: G.id, date: G.date, team: { name: team.name, abbr: team.abbr }, when: clock, title: title, sub: trim(e.text || type, 140), swing: null,
      anim: { k: 'sc', t: /header/i.test(e.text || '') ? 'header' : /penalty/i.test(type + ' ' + (e.text || '')) ? 'pen' : /free kick/i.test(e.text || '') ? 'fk' : /own goal/i.test(type) ? 'og' : 'shot', side: hash(e.id || who + clock) % 2 ? 1 : -1, min: mins } };
    m._score = score;
    ctx.cands.push(m);
    G.ex += score / 2;
  });
  const winnerHome = G.home.score > G.away.score;
  G.comeback = G.home.score === G.away.score ? 0 : winnerHome ? -minHome : maxHome;
  if (G.comeback >= 2 && (!ctx.facts.comeback || G.comeback > ctx.facts.comeback.n)) ctx.facts.comeback = { n: G.comeback, team: winnerHome ? G.home.short : G.away.short };
  G.ex += G.comeback * 8 + G.home.score + G.away.score;
}


// ═══ WATCH & LISTEN (v7.5.0) ═══════════════════════════════════════════
// Where one game is on: TV, streaming and radio, each tagged national, home
// or away so the app can keep only what works where you are.
//   { sport, national: bool, home:{name,abbr}, away:{name,abbr},
//     list: [{ kind:'tv'|'radio'|'stream', name, call, side:'national'|'home'|'away', lang }] }
async function watchInfo(sport, id, date) {
  if (!id) return null;
  if (sport === 'mlb') return mlbWatch(id);
  if (sport === 'nhl') return nhlWatch(id);
  if (ESPN_PATH[sport]) return espnWatch(sport, id, date);
  return null;
}
async function mlbWatch(id) {
  const d = await getJson(MLB + '/schedule?sportId=1&gamePk=' + encodeURIComponent(id) + '&hydrate=broadcasts(all),team');
  const g = d && d.dates && d.dates[0] && (d.dates[0].games || []).filter(function (x) { return String(x.gamePk) === String(id); })[0];
  if (!g) return null;
  const list = [], seen = {};
  (g.broadcasts || []).forEach(function (b) {
    const name = String(b.name || b.callSign || '').trim();
    if (!name) return;
    const type = String(b.type || '').toUpperCase();
    // MLB.TV and MLB app audio entries are added by the app itself
    if (/^MLB\.?TV$|Gameday Audio|^MLB Audio/i.test(name)) return;
    const kind = type === 'TV' ? 'tv' : (type === 'AM' || type === 'FM' || type === 'RADIO') ? 'radio' : 'stream';
    const side = b.isNational ? 'national' : (b.homeAway === 'away' ? 'away' : 'home');
    const key = kind + '|' + name + '|' + side + '|' + (b.language || '');
    if (seen[key]) return; seen[key] = 1;
    list.push({ kind: kind, name: name, call: b.callSign || '', side: side, lang: b.language || 'en' });
  });
  const t = function (x) { return { name: x.team.name, abbr: x.team.abbreviation || '' }; };
  const st = String((g.status && g.status.abstractGameState) || '').toLowerCase();
  return { sport: 'mlb', id: String(id), state: st === 'live' ? 'live' : st === 'final' ? 'final' : 'pre', home: t(g.teams.home), away: t(g.teams.away), national: list.some(function (b) { return b.kind === 'tv' && b.side === 'national'; }) && !list.some(function (b) { return b.kind === 'tv' && b.side !== 'national'; }), list: list };
}
async function espnWatch(sport, id, date) {
  let comp = null, state = 'pre';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const sb = await getJson(ESPN + ESPN_PATH[sport] + '/scoreboard?dates=' + date.replace(/-/g, ''));
    const ev = sb && (sb.events || []).filter(function (e) { return String(e.id) === String(id); })[0];
    comp = ev && ev.competitions && ev.competitions[0];
    if (ev && ev.status && ev.status.type) state = ev.status.type.completed ? 'final' : ev.status.type.state === 'in' ? 'live' : 'pre';
  }
  if (!comp) {
    const sum = await getJson(ESPN + ESPN_PATH[sport] + '/summary?event=' + encodeURIComponent(id), 9000);
    comp = sum && sum.header && sum.header.competitions && sum.header.competitions[0];
    const t = comp && comp.status && comp.status.type;
    if (t) state = t.completed ? 'final' : t.state === 'in' ? 'live' : 'pre';
  }
  if (!comp) return null;
  const list = [], seen = {};
  const add = function (kind, name, side, lang) {
    name = String(name || '').trim(); if (!name) return;
    const key = kind + '|' + name + '|' + side; if (seen[key]) return; seen[key] = 1;
    list.push({ kind: kind, name: name, call: '', side: side, lang: lang || 'en' });
  };
  (comp.geoBroadcasts || []).forEach(function (b) {
    if (b.region && String(b.region).toLowerCase() !== 'us') return;
    const ty = String((b.type && b.type.shortName) || 'TV').toLowerCase();
    const mk = String((b.market && b.market.type) || 'National').toLowerCase();
    add(ty === 'radio' ? 'radio' : ty === 'streaming' ? 'stream' : 'tv', b.media && b.media.shortName, mk === 'home' ? 'home' : mk === 'away' ? 'away' : 'national', b.lang);
  });
  if (!list.length) (comp.broadcasts || []).forEach(function (b) {
    const mk = String(b.market || 'national').toLowerCase();
    (b.names || []).forEach(function (n) { add('tv', n, mk === 'home' ? 'home' : mk === 'away' ? 'away' : 'national'); });
  });
  const team = function (side) { const c = (comp.competitors || []).filter(function (x) { return x.homeAway === side; })[0] || {}; const tm = c.team || {}; return { name: tm.displayName || tm.name || '', abbr: tm.abbreviation || '' }; };
  return { sport: sport, id: String(id), state: state, home: team('home'), away: team('away'), national: list.some(function (b) { return b.kind === 'tv' && b.side === 'national'; }), list: list };
}
async function nhlWatch(id) {
  const d = await getJson(NHL + '/gamecenter/' + encodeURIComponent(id) + '/landing');
  if (!d) return null;
  const list = [], seen = {};
  (d.tvBroadcasts || []).forEach(function (b) {
    if (b.countryCode && b.countryCode !== 'US') return;
    const side = b.market === 'H' ? 'home' : b.market === 'A' ? 'away' : 'national';
    const name = String(b.network || '').trim(); if (!name || seen[name + side]) return; seen[name + side] = 1;
    list.push({ kind: /\+$|ESPN\+|MAX|HBO|Prime|Hulu/i.test(name) ? 'stream' : 'tv', name: name, call: '', side: side, lang: 'en' });
  });
  const t = function (x) { x = x || {}; const place = (x.placeName && x.placeName.default) || '', nm = (x.commonName && x.commonName.default) || ''; return { name: (place + ' ' + nm).trim(), abbr: x.abbrev || '' }; };
  const gs = String(d.gameState || '');
  return { sport: 'nhl', id: String(id), state: /LIVE|CRIT/.test(gs) ? 'live' : /OFF|FINAL/.test(gs) ? 'final' : 'pre', home: t(d.homeTeam), away: t(d.awayTeam), national: list.some(function (b) { return b.side === 'national' && b.kind === 'tv'; }), list: list };
}
