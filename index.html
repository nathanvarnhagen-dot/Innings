// Vercel Serverless Function — GET /api/espn?league=nfl|cfb|nba|wnba|mls|nwsl&mode=schedule&date=YYYYMMDD
//                               GET /api/espn?league=...&mode=boxscore&eventId=<id>
// One shared file for five leagues, since they all run on the exact same
// underlying source: ESPN's hidden scoreboard API. This is NOT an official,
// documented, or supported API — it's the same undocumented endpoint every
// hobby score-tracker uses because there's no free official alternative
// for these five leagues (MLB and NHL both have real ones; these don't).
// It can change shape or start rate-limiting with zero notice, and nobody
// guarantees it'll keep working. Cache aggressively, don't treat it as
// load-bearing infrastructure, and expect to revisit this file if ESPN
// ever changes it.
//
// Confidence note: built from public documentation and community examples
// of this endpoint's shape, not from a live reference the way api/mlb.js
// was — that one already existed and worked. This is a first pass and
// should be tested against a real live game before being trusted. The
// least certain part specifically: quarter/period scores come from
// competitor.linescores, and brief highlights from scoringPlays or
// leaders — these are the fields most likely to be named differently or
// missing entirely if a real response doesn't match what's assumed here.
// Both fail gracefully to an empty array rather than breaking the whole
// response if that happens.

var LEAGUE_PATHS = {
  nfl: 'football/nfl',
  cfb: 'football/college-football',
  nba: 'basketball/nba',
  wnba: 'basketball/wnba',
  mls: 'soccer/usa.1',
  nwsl: 'soccer/usa.nwsl',
  // Team list only (team picker / favorites). NHL games themselves come
  // from api/nhl.js + api/nhlgame.js, which use NHL game ids.
  nhl: 'hockey/nhl'
};

module.exports = async function handler(req, res) {
  const league = req.query.league;
  const mode = req.query.mode;
  const path = LEAGUE_PATHS[league];
  if (!path) { res.status(400).json({ error: 'Unknown league — use nfl, cfb, nba, wnba, mls, nwsl (or nhl for teams)' }); return; }
  try {
    if (mode === 'schedule') {
      const date = req.query.date;
      if (!date) { res.status(400).json({ error: 'Missing date (YYYYMMDD)' }); return; }
      const url = 'https://site.api.espn.com/apis/site/v2/sports/' + path + '/scoreboard?dates=' + encodeURIComponent(date);
      const r = await fetch(url);
      const data = await r.json();
      const games = (data.events || []).map(summarizeEvent).filter(Boolean);
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      res.status(200).json({ games: games });
      return;
    }
    if (mode === 'boxscore') {
      const eventId = req.query.eventId;
      if (!eventId) { res.status(400).json({ error: 'Missing eventId' }); return; }
      const url = 'https://site.api.espn.com/apis/site/v2/sports/' + path + '/summary?event=' + encodeURIComponent(eventId);
      const r = await fetch(url);
      const data = await r.json();
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      res.status(200).json(summarizeSummary(data, eventId, league));
      return;
    }
    if (mode === 'gamecast') {
      const eventId = req.query.eventId;
      if (!eventId) { res.status(400).json({ error: 'Missing eventId' }); return; }
      if (league === 'nhl') { res.status(400).json({ error: 'NHL gamecast lives in /api/nhlgame' }); return; }
      const url = 'https://site.api.espn.com/apis/site/v2/sports/' + path + '/summary?event=' + encodeURIComponent(eventId);
      const r = await fetch(url);
      const data = await r.json();
      const model = summarizeGamecast(data, league, eventId, req.query.plays === 'all');
      if (model.phase === 'pre' && (model.form.away.length || model.form.home.length)) {
        model.teamColors = await _gcTeamColors(path, league);
      }
      if (req.query.debug) model.debug = { topLevelKeys: Object.keys(data || {}), playsCount: (data.plays || []).length, keyEvents: (data.keyEvents || []).length };
      // A live football score can change on one snap, so the edge holds it
      // for five seconds rather than ten. stale-while-revalidate still
      // serves instantly while the refresh happens behind it.
      res.setHeader('Cache-Control', model.phase === 'live' ? 's-maxage=5, stale-while-revalidate' : 's-maxage=120, stale-while-revalidate');
      res.status(200).json(model);
      return;
    }
    if (mode === 'pregame') {
      const eventId = req.query.eventId;
      if (!eventId) { res.status(400).json({ error: 'Missing eventId' }); return; }
      const url = 'https://site.api.espn.com/apis/site/v2/sports/' + path + '/summary?event=' + encodeURIComponent(eventId);
      const r = await fetch(url);
      const data = await r.json();
      const result = await summarizePregame(data, path);
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      res.status(200).json(result);
      return;
    }
    if (mode === 'standings') {
      if (league !== 'nfl') { res.status(400).json({ error: 'Standings-based playoff seeding is only built for nfl right now — cfb seeding comes from the CFP committee, not computable win-loss standings' }); return; }
      const season = req.query.season || new Date().getFullYear();
      const url = 'https://site.web.api.espn.com/apis/v2/sports/' + path + '/standings?season=' + encodeURIComponent(season);
      const r = await fetch(url);
      const data = await r.json();
      // Diagnostic wrapper: if this comes back empty or throws, surface
      // what ESPN actually sent back instead of a generic failure — two
      // guesses at this endpoint's shape have already been wrong once
      // (the domain itself), so the fastest way to get the next one
      // right is seeing the real response instead of guessing a third
      // time. Hit this URL directly (add &debug=1) to see it.
      let result, parseError = null;
      try { result = summarizeNflStandings(data); }
      catch (e) { parseError = e.message; result = null; }
      const ok = result && result.afc && result.nfc;
      if (!ok || req.query.debug) {
        res.status(200).json({
          error: ok ? null : (parseError || 'Computed empty result — afc/nfc missing after parsing'),
          debug: {
            topLevelKeys: Object.keys(data || {}),
            hasChildren: Array.isArray(data.children),
            childrenCount: (data.children || []).length,
            firstChildKeys: data.children && data.children[0] ? Object.keys(data.children[0]) : null,
            firstChildSample: data.children && data.children[0] ? JSON.stringify(data.children[0]).slice(0, 1500) : null
          },
          result: result
        });
        return;
      }
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      res.status(200).json(result);
      return;
    }
    if (mode === 'teams') {
      // Same site.api.espn.com host already confirmed working for
      // schedule/boxscore/pregame (unlike the standings endpoint's
      // wrong-domain issue) — moderate-high confidence in this shape,
      // but still not tested against a live response.
      //
      // CFB is on its second fix: college football has 762 teams across
      // every division (FBS, FCS, DII/DIII). The first attempt added
      // groups=80 on site.api.espn.com, which turned out not to be
      // enough on its own — Oregon (a real FBS/Big Ten school) was
      // still missing after that. This version switches to
      // site.web.api.espn.com with groups=80&groupType=conference&
      // enable=groups, a combination confirmed working by someone who
      // hit this exact problem (not a guess this time) — but since one
      // "confirmed" fix already turned out incomplete, a debug block is
      // included below so if Oregon is STILL missing, the actual count
      // and whether it's present are visible immediately by hitting
      // this URL directly, instead of a third blind attempt.
      const cfbParams = '&groups=80&groupType=conference&enable=groups';
      const host = (league === 'cfb') ? 'site.web.api.espn.com' : 'site.api.espn.com';
      const params = (league === 'cfb') ? cfbParams : '';
      const url = 'https://' + host + '/apis/site/v2/sports/' + path + '/teams?limit=300' + params;
      const r = await fetch(url);
      const data = await r.json();
      const list = (((data.sports || [])[0] || {}).leagues || [])[0] || {};
      const teams = (list.teams || []).map(function (t) {
        return { id: t.team && t.team.id, name: t.team && (t.team.displayName || t.team.name) };
      }).filter(function (t) { return t.name; }).sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
      if (league === 'cfb') {
        res.status(200).json({
          teams: teams,
          debug: {
            totalCount: teams.length,
            hasOregon: teams.some(function (t) { return /oregon/i.test(t.name); }),
            topLevelKeys: Object.keys(data || {}),
            hasSports: Array.isArray(data.sports)
          }
        });
        return;
      }
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
      res.status(200).json({ teams: teams });
      return;
    }
    res.status(400).json({ error: 'Unknown mode — use schedule, boxscore, gamecast, pregame, standings, or teams' });
  } catch (err) {
    res.status(500).json({ error: league.toUpperCase() + ' lookup failed' });
  }
};

function competitorsOf(event) {
  var comp = (event.competitions && event.competitions[0]) || {};
  var competitors = comp.competitors || [];
  var away = competitors.filter(function (c) { return c.homeAway === 'away'; })[0] || {};
  var home = competitors.filter(function (c) { return c.homeAway === 'home'; })[0] || {};
  return { comp: comp, away: away, home: home };
}

function summarizeEvent(event) {
  if (!event) return null;
  var parts = competitorsOf(event);
  var status = event.status && event.status.type;
  return {
    gamePk: event.id,
    status: (status && status.description) || (status && status.detail) || null,
    away: (parts.away.team && parts.away.team.displayName) || null,
    home: (parts.home.team && parts.home.team.displayName) || null,
    awayScore: parts.away.score != null ? Number(parts.away.score) : null,
    homeScore: parts.home.score != null ? Number(parts.home.score) : null,
    venue: (parts.comp.venue && parts.comp.venue.fullName) || null,
    startTime: event.date || null
  };
}

var SOCCER_LEAGUES = { mls: true, nwsl: true };

// Quarter/half labels differ by sport family — football and basketball both
// use quarters, soccer uses halves. Extra periods beyond the normal count
// are overtime, labeled generically rather than guessing a sport-specific
// OT naming convention.
function periodLabel(league, index, total) {
  var isSoccer = SOCCER_LEAGUES[league];
  var regulation = isSoccer ? 2 : 4;
  if (index < regulation) return isSoccer ? (index === 0 ? '1st' : '2nd') : 'Q' + (index + 1);
  return total - regulation > 1 ? 'OT' + (index - regulation + 1) : 'OT';
}

// Best-effort period-by-period extraction from competitor.linescores, which
// is where ESPN's summary endpoint has historically put this — not
// confirmed against a live game, so if quarters don't show up for a
// particular sport, this is the first place to check.
function extractPeriods(league, awayComp, homeComp) {
  var awayLines = (awayComp && awayComp.linescores) || [];
  var homeLines = (homeComp && homeComp.linescores) || [];
  var count = Math.max(awayLines.length, homeLines.length);
  if (!count) return [];
  var periods = [];
  for (var i = 0; i < count; i++) {
    periods.push({
      label: periodLabel(league, i, count),
      away: awayLines[i] ? Number(awayLines[i].value != null ? awayLines[i].value : awayLines[i].displayValue) : null,
      home: homeLines[i] ? Number(homeLines[i].value != null ? homeLines[i].value : homeLines[i].displayValue) : null
    });
  }
  return periods;
}

// Brief descriptor line, sport-appropriate emoji — scoring plays for
// football/soccer, a leading scorer for basketball. Best-effort: if the
// expected field isn't where this looks, it just comes back empty rather
// than breaking anything, since the score card already renders fine
// without it.
function extractHighlights(league, data) {
  var emoji = { nfl: '🏈', cfb: '🏈', mls: '⚽', nwsl: '⚽', nba: '🏀', wnba: '🏀' }[league] || '🏆';
  var highlights = [];
  try {
    if (league === 'nfl' || league === 'cfb' || SOCCER_LEAGUES[league]) {
      (data.scoringPlays || []).slice(-4).forEach(function (p) {
        if (p && p.text) highlights.push({ emoji: emoji, text: p.text });
      });
    } else if (league === 'nba' || league === 'wnba') {
      (data.leaders || []).forEach(function (teamLeaders) {
        var cat = (teamLeaders.leaders || [])[0];
        var top = cat && cat.leaders && cat.leaders[0];
        if (top && top.athlete) {
          highlights.push({ emoji: emoji, text: top.athlete.displayName + ' — ' + top.displayValue + ' pts' });
        }
      });
    }
  } catch (e) {
    // Swallow and return whatever was already collected — a malformed
    // highlight isn't worth failing the whole box score over.
  }
  return highlights.slice(0, 4);
}

var FOOTBALL_LEAGUES = { nfl: true, cfb: true };

function summarizeSummary(data, eventId, league) {
  var header = data.header || {};
  var comp = (header.competitions && header.competitions[0]) || {};
  var competitors = comp.competitors || [];
  var awayComp = competitors.filter(function (c) { return c.homeAway === 'away'; })[0] || {};
  var homeComp = competitors.filter(function (c) { return c.homeAway === 'home'; })[0] || {};
  var event = { id: header.id || eventId, competitions: header.competitions, status: comp.status };
  var basic = summarizeEvent(event) || {};
  return {
    gamePk: basic.gamePk || eventId,
    away: basic.away,
    home: basic.home,
    awayScore: basic.awayScore,
    homeScore: basic.homeScore,
    innings: extractPeriods(league, awayComp, homeComp),
    venue: basic.venue,
    date: comp.date || null,
    status: basic.status,
    winningPitcher: null,
    losingPitcher: null,
    savePitcher: null,
    homeRuns: [],
    highlights: extractHighlights(league, data),
    situation: FOOTBALL_LEAGUES[league] ? extractFootballSituation(data, awayComp, homeComp) : extractLiveSituation(league, comp),
    recentPlays: FOOTBALL_LEAGUES[league] ? extractFootballPlays(data) : []
  };
}

// ── BASKETBALL/SOCCER LIVE SITUATION (NBA, WNBA, MLS, NWSL) — much
// simpler than football's: just the game clock and which period it's
// in, since basketball and soccer don't have an equivalent to down/
// distance or ball/strike counts. Pulled from comp.status, the same
// object summarizeEvent already reads its status text from — moderate
// confidence in displayClock/period specifically (common, documented
// fields on this status object across ESPN's site API, but not tested
// against a live in-progress response in this session, unlike the
// status.type fields already proven by the existing status text).
var BASKETBALL_LEAGUES = { nba: true, wnba: true };
function extractLiveSituation(league, comp) {
  if (!BASKETBALL_LEAGUES[league] && !SOCCER_LEAGUES[league]) return null;
  var status = comp.status || {};
  var period = status.period || null;
  var clock = status.displayClock || null;
  if (!period && !clock) return null;
  var periodText;
  if (BASKETBALL_LEAGUES[league]) {
    periodText = period ? periodLabel(league, period - 1, period) : null;
  } else {
    periodText = period === 1 ? '1st Half' : period === 2 ? '2nd Half' : (period ? 'Period ' + period : null);
  }
  return { sportType: BASKETBALL_LEAGUES[league] ? 'basketball' : 'soccer', clock: clock, periodLabel: periodText };
}

// ── FOOTBALL FIELD POSITION + PLAY-BY-PLAY (NFL + CFB) — mirrors what
// mlb.js does with balls/strikes/bases/recentPlays for baseball, using
// whatever field-position data ESPN's summary endpoint carries for a
// live or recently-finished game.
// live or recently-finished game.
//
// Confidence note: this endpoint's `scoringPlays` (used by
// extractHighlights above) is confirmed working. The `drives` shape
// used here (current/previous drives, each with a team and a plays
// array; each play's start having down/distance/possessionText) is the
// standard, widely-documented shape for this API but has NOT been
// confirmed against a live response in this session. Two specific things
// to check first if this comes back empty: (1) whether `data.situation`
// or `data.drives.current` is actually where down/distance/yardLine
// live for an in-progress game, and (2) whether `yardLine` is already a
// plain 0–100 number (assumed here) or needs different normalization.
// Everything here degrades to null/empty rather than guessing wrong.
// ESPN reports down as 0 or -1 on anything that isn't a scrimmage down —
// kickoffs, extra points, the gap between drives. Those aren't downs, and
// formatting them produced "-1th & 0" on the game cards.
var _FB_DOWNS = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };
function _fbDown(down) {
  var n = Number(down);
  return (Number.isFinite(n) && n >= 1 && n <= 4) ? n : null;
}
function _fbDownText(down, dist) {
  var d = _fbDown(down);
  if (d == null) return null;
  return _FB_DOWNS[d] + ' & ' + (dist === 0 ? 'Goal' : (dist != null ? dist : '?'));
}

// What the last play was, so the field can draw it: a throw and a kick
// arc through the air, a run travels along the ground. ESPN gives the
// two yard lines but no air-yards or target point, so the height of an
// arc is presentation, not data — only its two ends are real.
function _fbPlayKind(typeText) {
  var t = String(typeText || '').toLowerCase();
  if (/timeout|end of|end period|penalty|coin toss|two-minute/.test(t)) return 'other';
  if (/punt|kickoff|field goal|extra point/.test(t)) return 'kick';
  if (/pass|sack|interception/.test(t)) return 'pass';
  if (/rush|run|scramble|fumble|kneel/.test(t)) return 'rush';
  return 'other';
}
function _fbPlayLabel(typeText, yards, kind) {
  var t = String(typeText || '');
  if (/incompletion/i.test(t)) return 'Incomplete';
  if (/interception/i.test(t)) return 'Intercepted';
  if (/touchdown/i.test(t)) return 'Touchdown';
  if (/sack/i.test(t)) return yards != null ? 'Sack ' + yards : 'Sack';
  if (kind === 'kick') return t || 'Kick';
  if (yards == null) return t || '';
  return (yards >= 0 ? '+' : '') + yards + ' ' + (kind === 'pass' ? 'pass' : kind === 'rush' ? 'run' : 'yds');
}
function _fbLastPlay(drive) {
  var plays = drive && drive.plays;
  if (!plays || !plays.length) return null;
  var p = plays[plays.length - 1];
  if (!p) return null;
  var typeText = (p.type && (p.type.text || p.type.type)) || '';
  var kind = _fbPlayKind(typeText || p.text);
  var yards = p.statYardage != null ? Number(p.statYardage) : null;
  if (!isFinite(yards)) yards = null;
  return { kind: kind, yards: yards, label: _fbPlayLabel(typeText, yards, kind), text: p.text || null };
}

// Every drive of the game, oldest first, each with all of its plays.
// Opt-in via &plays=all: a finished game is ~150 plays and the live
// gamecast is polled every ten seconds, so it isn't worth sending to a
// card that only shows the current drive.
function _fbAllDrives(data, homeId) {
  var list = [];
  try {
    if (data.drives) {
      if (Array.isArray(data.drives.previous)) list = data.drives.previous.slice();
      if (data.drives.current) list.push(data.drives.current);
    }
  } catch (e) { return []; }
  var out = [];
  list.forEach(function (d) {
    var plays = (d.plays || []).filter(function (p) { return p && p.text; }).map(function (p) {
      var st = p.start || {};
      var dt = _fbDownText(st.down, st.distance);
      return {
        id: p.id != null ? String(p.id) : null,
        tag: dt ? dt.replace(' & ', ' & ') : ((p.period && p.period.number) ? 'Q' + p.period.number : ''),
        text: p.text,
        scoring: !!p.scoringPlay
      };
    });
    if (!plays.length) return;
    var teamId = d.team && d.team.id != null ? String(d.team.id) : null;
    out.push({
      team: (d.team && (d.team.abbreviation || d.team.shortDisplayName)) || null,
      side: teamId ? (teamId === String(homeId) ? 'h' : 'a') : null,
      summary: d.description || null,
      result: d.displayResult || d.result || null,
      period: (d.start && d.start.period && d.start.period.number) || null,
      plays: plays
    });
  });
  return out;
}

function extractFootballSituation(data, awayComp, homeComp) {
  var comp = null;
  try {
    var header = data.header || {};
    comp = (header.competitions && header.competitions[0]) || null;
  } catch (e) { comp = null; }
  var sit = (comp && comp.situation) || data.situation || null;
  var currentDrive = data.drives && data.drives.current;

  var down = sit && sit.down;
  var distance = sit && sit.distance;
  var possessionText = sit && sit.possessionText;
  var yardLine = sit && sit.yardLine;
  var possessionTeamAbbr = null;

  if (currentDrive) {
    var lastPlay = (currentDrive.plays && currentDrive.plays.length) ? currentDrive.plays[currentDrive.plays.length - 1] : null;
    if (lastPlay && lastPlay.start) {
      if (down == null) down = lastPlay.start.down;
      if (distance == null) distance = lastPlay.start.distance;
      if (!possessionText) possessionText = lastPlay.start.possessionText;
      if (yardLine == null) yardLine = lastPlay.start.yardLine;
    }
    if (currentDrive.team) possessionTeamAbbr = currentDrive.team.abbreviation || null;
  }

  down = _fbDown(down);
  if (down == null) distance = null; // a distance without a down means nothing

  if (down == null && !possessionText) return null;

  var homeAbbr = (homeComp.team && homeComp.team.abbreviation) || null;
  var isHomeBall = possessionTeamAbbr && homeAbbr && possessionTeamAbbr === homeAbbr;
  var hex = function (c) { var h = String(c || '').replace('#', ''); return /^[0-9a-fA-F]{6}$/.test(h) ? '#' + h : null; };

  // Where this drive began, so a card can draw how far it has come.
  var driveStart = null;
  if (currentDrive && currentDrive.plays && currentDrive.plays.length) {
    var first = currentDrive.plays[0];
    if (first && first.start && first.start.yardLine != null) driveStart = first.start.yardLine;
  }

  var status = null;
  try {
    var hdr = data.header || {};
    var c0 = (hdr.competitions && hdr.competitions[0]) || {};
    status = c0.status || null;
  } catch (e) { status = null; }

  return {
    down: down,
    distance: distance != null ? distance : null,
    downText: _fbDownText(down, distance),
    possessionText: possessionText || null,
    yardLine: yardLine != null ? yardLine : null,
    driveStart: driveStart,
    driveText: (currentDrive && currentDrive.description) || null,
    redZone: !!(sit && sit.isRedZone),
    period: status && status.period != null ? status.period : null,
    clock: (status && status.displayClock) || null,
    homeAway: possessionTeamAbbr ? (isHomeBall ? 'home' : 'away') : null,
    awayAbbr: (awayComp.team && awayComp.team.abbreviation) || null,
    homeAbbr: homeAbbr,
    awayColor: hex(awayComp.team && awayComp.team.color),
    homeColor: hex(homeComp.team && homeComp.team.color),
    awayLogo: (awayComp.team && awayComp.team.logo) || null,
    homeLogo: (homeComp.team && homeComp.team.logo) || null,
    lastPlay: _fbLastPlay(currentDrive),
    team: possessionTeamAbbr ? {
      abbreviation: possessionTeamAbbr,
      color: hex(currentDrive && currentDrive.team && currentDrive.team.color)
    } : null
  };
}

function extractFootballPlays(data) {
  var drives = [];
  try {
    if (data.drives) {
      if (data.drives.current) drives.push(data.drives.current);
      if (Array.isArray(data.drives.previous)) drives = drives.concat(data.drives.previous.slice().reverse());
    }
  } catch (e) { return []; }
  var plays = [];
  drives.forEach(function (drive) {
    if (plays.length >= 5) return;
    (drive.plays || []).slice().reverse().forEach(function (p) {
      if (plays.length >= 5 || !p || !p.text) return;
      var tag = '';
      if (p.period && p.period.number) tag += 'Q' + p.period.number + ' ';
      var dt = p.start ? _fbDownText(p.start.down, p.start.distance) : null;
      if (dt) tag += dt.replace(' & ', '&');
      plays.push({ tag: tag.trim(), text: p.text, playId: p.id || null });
    });
  });
  return plays.slice(0, 5);
}

// ── PREGAME CHEAT SHEET (NFL/CFB) — no "starting lineup" concept exists
// pregame for football the way it does for a batting order, so rather
// than guess one, this returns the WHOLE roster for both teams, ranked
// by position (skill/impact positions first) so the players worth
// watching surface at the top instead of needing to scroll a 53-90 man
// roster to find them.
//
// Confidence note: the schedule/boxscore endpoints above are already
// proven (used elsewhere in the app successfully), but this roster
// endpoint and its exact response shape have NOT been confirmed against
// a live fetch in this session — no network path to espn.com from this
// sandbox. Two specific things to check first if this comes back empty:
// (1) whether `athletes` is a flat list or grouped as
// `[{items:[...]}]` (handled defensively either way below), and
// (2) whether individual athlete objects actually carry
// `experience.years` / `college.name` — those are best-effort extras,
// not load-bearing, so their absence degrades gracefully to a blank
// second line rather than breaking anything.
var POSITION_PRIORITY = {
  QB: 1, RB: 2, HB: 2, WR: 3, TE: 4, FB: 5,
  T: 6, OT: 6, G: 6, OG: 6, C: 6, OL: 6, LT: 6, RT: 6, LG: 6, RG: 6,
  DE: 7, DT: 7, NT: 7, DL: 7, EDGE: 7,
  OLB: 8, ILB: 8, MLB: 8, LB: 8,
  CB: 9, S: 9, FS: 9, SS: 9, DB: 9,
  K: 10, P: 11, LS: 12
};
function _positionPriority(pos) {
  return (pos && POSITION_PRIORITY[pos] != null) ? POSITION_PRIORITY[pos] : 13;
}
function _ordinal(n) {
  var suf = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (suf[(v - 20) % 10] || suf[v] || suf[0]);
}

async function summarizePregame(data, path) {
  var header = data.header || {};
  var comp = (header.competitions && header.competitions[0]) || {};
  var competitors = comp.competitors || [];
  var awayComp = competitors.filter(function (c) { return c.homeAway === 'away'; })[0] || {};
  var homeComp = competitors.filter(function (c) { return c.homeAway === 'home'; })[0] || {};
  var awayTeamId = awayComp.team && awayComp.team.id;
  var homeTeamId = homeComp.team && homeComp.team.id;

  var rosters = await Promise.all([_fetchRoster(path, awayTeamId), _fetchRoster(path, homeTeamId)]);
  var away = { name: (awayComp.team && awayComp.team.displayName) || null, rows: rosters[0] };
  var home = { name: (homeComp.team && homeComp.team.displayName) || null, rows: rosters[1] };

  if (!away.name && !home.name) return { error: 'No pregame data available' };
  return { away: away, home: home };
}

async function _fetchRoster(path, teamId) {
  if (!teamId) return [];
  try {
    var url = 'https://site.api.espn.com/apis/site/v2/sports/' + path + '/teams/' + encodeURIComponent(teamId) + '/roster';
    var r = await fetch(url);
    var data = await r.json();
    var athletes = [];
    if (Array.isArray(data.athletes) && data.athletes.length && data.athletes[0] && data.athletes[0].items) {
      data.athletes.forEach(function (group) { athletes = athletes.concat(group.items || []); });
    } else {
      athletes = data.athletes || [];
    }
    var rows = athletes.map(function (item) {
      var a = item.athlete || item; // some hydrations nest one level deeper
      var pos = (a.position && a.position.abbreviation) || null;
      return {
        name: a.fullName || a.displayName || 'Unknown',
        pos: pos,
        id: a.id || null,
        age: a.age || null,
        jersey: a.jersey || null,
        experience: (a.experience && a.experience.years != null) ? a.experience.years : null,
        college: (a.college && a.college.name) || null,
        _priority: _positionPriority(pos)
      };
    });
    rows.sort(function (x, y) {
      if (x._priority !== y._priority) return x._priority - y._priority;
      return (Number(x.jersey) || 999) - (Number(y.jersey) || 999);
    });
    return rows.map(function (r) {
      var expLabel = r.experience == null ? '' : (r.experience === 0 ? 'Rookie' : _ordinal(r.experience + 1) + ' season');
      var jerseyLabel = r.jersey ? '#' + r.jersey : '';
      return {
        name: r.name,
        pos: r.pos,
        id: r.id,
        age: r.age,
        line: jerseyLabel + (expLabel ? (jerseyLabel ? ' · ' : '') + expLabel : ''),
        extra: r.college || null
      };
    });
  } catch (e) {
    return [];
  }
}

// ── NFL PLAYOFF PICTURE — division standings, wild card race, and
// bracket seeding, computed from raw win/loss records rather than any
// rank field the standings response might carry, same reasoning as
// mlb.js's summarizeStandings: more confident in wins/losses being
// present and correctly named than in the exact semantics of a
// division/wildcard rank field near the cutline.
//
// Confidence note: the endpoint itself was wrong in the first version
// of this — site.api.espn.com instead of site.web.api.espn.com (note
// the extra "web." — a real, documented difference between two
// separate ESPN API hosts, not a guess), missing the required season
// param. That's fixed now and is a high-confidence correction, sourced
// from public documentation of this specific endpoint rather than
// general pattern-matching. What's still NOT verified against a live
// response: whether `children` actually nests conference -> division
// -> team entries the way assumed below, and whether the win/loss stat
// names are really 'wins'/'losses'. If this is still empty after the
// domain fix, those are the two things to check next — ideally by
// hitting the URL directly (https://site.web.api.espn.com/apis/v2/
// sports/football/nfl/standings?season=2026) and sharing back what
// the actual shape looks like, the same way a Firestore console check
// resolved the watching-together bug earlier.
function _nflStatValue(entry, name) {
  var stat = ((entry.stats || []).filter(function (s) { return s.name === name; })[0]) || null;
  return stat && stat.value != null ? Number(stat.value) : 0;
}

function summarizeNflStandings(data) {
  var conferences = data.children || [];
  var divisions = [];
  conferences.forEach(function (conf) {
    var confName = conf.name || conf.abbreviation || '';
    var confKey = /national/i.test(confName) ? 'nfc' : 'afc';
    var divGroups = conf.children || [];
    divGroups.forEach(function (div) {
      var divName = (div.name || div.abbreviation || '').replace(/^(American|National) Football Conference /i, '');
      var entries = (div.standings && div.standings.entries) || [];
      var teams = entries.map(function (e) {
        return { name: (e.team && (e.team.displayName || e.team.name)) || '', w: _nflStatValue(e, 'wins'), l: _nflStatValue(e, 'losses') };
      });
      teams.sort(function (a, b) { return _winPctNfl(b) - _winPctNfl(a); });
      divisions.push({ conf: confKey, name: divName, teams: teams });
    });
  });

  var result = {};
  ['afc', 'nfc'].forEach(function (confKey) {
    var confDivisions = divisions.filter(function (d) { return d.conf === confKey; });
    if (!confDivisions.length) return;

    var divWinners = confDivisions.map(function (d) { return Object.assign({}, d.teams[0], { division: d.name }); });
    divWinners.sort(function (a, b) { return _winPctNfl(b) - _winPctNfl(a); });

    var nonWinners = [];
    confDivisions.forEach(function (d) {
      d.teams.slice(1).forEach(function (t) { nonWinners.push(Object.assign({}, t, { division: d.name })); });
    });
    nonWinners.sort(function (a, b) { return _winPctNfl(b) - _winPctNfl(a); });
    var wildCards = nonWinners.slice(0, 3);
    var chasers = nonWinners.slice(3, 5);
    var wcNames = {}; wildCards.forEach(function (t) { wcNames[t.name] = true; });

    var seeds = divWinners.map(function (t, i) { return { seed: i + 1, team: _nflTeamShortName(t.name), rec: t.w + '-' + t.l, bye: i === 0 }; })
      .concat(wildCards.map(function (t, i) { return { seed: i + 5, team: _nflTeamShortName(t.name), rec: t.w + '-' + t.l }; }));

    result[confKey] = {
      seeds: seeds,
      wildcardRace: wildCards.map(function (t) { return { team: _nflTeamShortName(t.name), w: t.w, l: t.l, status: 'in' }; })
        .concat(chasers.map(function (t) { return { team: _nflTeamShortName(t.name), w: t.w, l: t.l, status: 'out' }; })),
      divisions: confDivisions.map(function (d) {
        return {
          name: (confKey === 'afc' ? 'AFC ' : 'NFC ') + d.name,
          teams: d.teams.map(function (t) {
            return { name: _nflTeamShortName(t.name), w: t.w, l: t.l, tag: (t.name === d.teams[0].name) ? 'div' : (wcNames[t.name] ? 'wc' : null) };
          })
        };
      })
    };
  });
  return result;
}

function _winPctNfl(t) { return (t.w + t.l) > 0 ? t.w / (t.w + t.l) : 0; }

// Same last-word heuristic as mlb.js's _teamShortName, with the same
// kind of real collision to special-case: "New York Giants" and "New
// York Jets" don't collide (different last words), but two-word cities
// paired with common nicknames are worth a second look each season —
// none confirmed as of this writing, unlike MLB's Red Sox/White Sox.
function _nflTeamShortName(name) {
  if (!name) return '';
  var parts = name.trim().split(' ');
  return parts[parts.length - 1];
}

// ══════════════════════════════════════════════════════════════════════
// GAMECAST (v5.44.0) — one normalized model per game for the game-screen
// hero (pre / live / final) + detail cards + box score, for football,
// basketball and soccer. Same summary endpoint the boxscore mode already
// uses. Shape notes: header/competitors/linescores, boxscore.players and
// scoringPlays are the long-standing fields of this endpoint; plays
// (basketball), keyEvents + rosters (soccer), lastFiveGames, leaders and
// situation are standard but NOT confirmed against a live response in
// this session. Every section degrades to empty instead of throwing —
// hit this mode with &debug=1 to see the summary's top-level keys.
// ══════════════════════════════════════════════════════════════════════
function _num(v) {
  if (v == null || v === '') return null;
  var n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}
function _hex(c) { return c ? ('#' + String(c).replace('#', '')) : null; }
function _lastName(full) {
  if (!full) return '';
  var p = String(full).trim().split(/\s+/);
  if (p.length < 2) return p[0];
  var last = p[p.length - 1];
  if (/^(Jr\.?|Sr\.?|II|III|IV)$/i.test(last) && p.length > 2) return p[p.length - 2] + ' ' + last;
  return last;
}
// "5-12" → 41.7 · "28:14" → 1694 · "51.2" → 51.2 · "44%" → 44
function _statNum(txt) {
  if (txt == null) return null;
  var s = String(txt);
  var frac = s.match(/^(\d+)\s*[-\/]\s*(\d+)$/);
  if (frac) return Number(frac[2]) ? Math.round((Number(frac[1]) / Number(frac[2])) * 1000) / 10 : 0;
  var clock = s.match(/^(\d+):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  return _num(s);
}
function _gcSport(league) {
  if (FOOTBALL_LEAGUES[league]) return 'football';
  if (BASKETBALL_LEAGUES[league]) return 'basketball';
  if (SOCCER_LEAGUES[league]) return 'soccer';
  return 'other';
}
function _gcRecord(c) {
  var recs = c.record || c.records || [];
  if (!Array.isArray(recs)) return null;
  var total = recs.filter(function (r) { return r && /total|overall|ytd/i.test(r.type || r.name || ''); })[0] || recs[0];
  return total ? (total.summary || total.displayValue || null) : null;
}
function _gcSide(c) {
  var t = c.team || {};
  var rank = c.curatedRank && c.curatedRank.current;
  return {
    id: t.id || null,
    name: t.displayName || t.name || null,
    short: t.shortDisplayName || t.name || null,
    abbr: t.abbreviation || null,
    logo: t.logo || null,
    color: _hex(t.color),
    alt: _hex(t.alternateColor),
    score: _num(c.score),
    record: _gcRecord(c),
    standing: (rank && rank <= 25) ? 'No. ' + rank : null,
    linescores: (c.linescores || []).map(function (l) { return _num(l.displayValue != null ? l.displayValue : l.value); })
  };
}
function _gcPeriodTag(sport, n) {
  if (!n) return '';
  if (sport === 'soccer') return n === 1 ? '1H' : n === 2 ? '2H' : 'ET';
  if (n <= 4) return 'Q' + n;
  return n === 5 ? 'OT' : (n - 4) + 'OT';
}
function _gcTeamStat(teamsArr, teamId, names) {
  var t = (teamsArr || []).filter(function (x) { return x.team && String(x.team.id) === String(teamId); })[0];
  if (!t) return null;
  var stats = t.statistics || [];
  for (var i = 0; i < names.length; i++) {
    var s = stats.filter(function (x) { return x.name === names[i] || x.abbreviation === names[i] || x.label === names[i]; })[0];
    if (s) {
      var txt = s.displayValue != null ? String(s.displayValue) : (s.value != null ? String(s.value) : null);
      if (txt != null) return txt;
    }
  }
  return null;
}
function _gcStatRows(data, away, home, defs) {
  var teams = (data.boxscore && data.boxscore.teams) || [];
  var rows = [];
  defs.forEach(function (d) {
    var a = _gcTeamStat(teams, away.id, d.names), h = _gcTeamStat(teams, home.id, d.names);
    if (a == null || h == null) return;
    var aTxt = d.fmt ? d.fmt(a) : a, hTxt = d.fmt ? d.fmt(h) : h;
    rows.push([d.label, aTxt, hTxt, _statNum(a), _statNum(h), d.lower ? 1 : 0]);
  });
  return rows;
}
function _gcLeaders(data, away, home, cats) {
  var out = [];
  var byTeam = {};
  (data.leaders || []).forEach(function (tl) {
    if (tl && tl.team) byTeam[String(tl.team.id)] = tl.leaders || [];
  });
  cats.forEach(function (c) {
    var pick = function (teamId) {
      var cat = (byTeam[String(teamId)] || []).filter(function (x) { return x.name === c.name; })[0];
      var top = cat && cat.leaders && cat.leaders[0];
      if (!top || !top.athlete) return null;
      return { name: top.athlete.displayName || top.athlete.shortName, id: top.athlete.id || null, line: top.displayValue || '', value: top.value != null ? Number(top.value) : _num(top.displayValue) };
    };
    var a = pick(away.id), h = pick(home.id);
    if (a || h) out.push({ label: c.label, a: a, h: h });
  });
  return out;
}
function _gcForm(data, away, home) {
  var out = { away: [], home: [] };
  (data.lastFiveGames || []).forEach(function (tf) {
    var key = tf.team && String(tf.team.id) === String(away.id) ? 'away' : (tf.team && String(tf.team.id) === String(home.id) ? 'home' : null);
    if (!key) return;
    var evs = (tf.events || []).slice();
    if (evs.length && evs[0].gameDate) evs.sort(function (x, y) { return x.gameDate < y.gameDate ? -1 : 1; });
    out[key] = evs.map(function (e) {
      var res = String(e.gameResult || '').toUpperCase();
      res = res === 'T' ? 'D' : res;
      var opp = e.opponent || {};
      return { opp: opp.abbreviation || '?', oppName: opp.displayName || null, res: res || '?', score: e.score || null, atVs: e.atVs || null, date: e.gameDate || null };
    }).filter(function (g) { return /^[WLD]$/.test(g.res); });
  });
  return out;
}
function _gcPlayer(a) {
  a = a || {};
  return { name: a.displayName || a.shortName || '', id: a.id || null, pos: (a.position && a.position.abbreviation) || null };
}

// ── Football
function _fbHead(p) {
  var t = String(p.text || '');
  var m;
  if ((m = t.match(/^(.+?) (\d+) Ya?r?ds? Field Goal/i))) return _lastName(m[1]) + ' ' + m[2] + '-yd FG';
  if ((m = t.match(/^(.+?) (\d+) Ya?r?ds? pass from (.+?)(?:\s*\(|,|$)/i))) return _lastName(m[1]) + ' ' + m[2] + '-yd TD catch';
  if ((m = t.match(/^(.+?) (\d+) Ya?r?ds? (?:Run|Rush)/i))) return _lastName(m[1]) + ' ' + m[2] + '-yd TD run';
  if ((m = t.match(/^(.+?) (\d+) Ya?r?ds? Interception Return/i))) return _lastName(m[1]) + ' pick-six';
  if ((m = t.match(/^(.+?) (\d+) Ya?r?ds? Fumble Return/i))) return _lastName(m[1]) + ' fumble-return TD';
  if (/safety/i.test(t)) return 'Safety';
  return (p.type && p.type.text) || 'Score';
}
function _fbSituation(data, comp, away, home) {
  var sit = (comp && comp.situation) || data.situation || null;
  var drive = data.drives && data.drives.current;
  var last = drive && drive.plays && drive.plays.length ? drive.plays[drive.plays.length - 1] : null;
  var start = (last && (last.end || last.start)) || {};
  var down = sit && sit.down != null ? sit.down : start.down;
  var dist = sit && sit.distance != null ? sit.distance : start.distance;
  var posText = (sit && sit.possessionText) || start.possessionText || null;
  var ddText = (sit && (sit.downDistanceText || sit.shortDownDistanceText)) || start.downDistanceText || null;
  var possId = sit && sit.possession ? String(sit.possession) : (drive && drive.team ? String(drive.team.id) : null);
  var possSide = possId ? (possId === String(home.id) ? 'h' : (possId === String(away.id) ? 'a' : null)) : null;
  if (!possSide && drive && drive.team && drive.team.abbreviation) possSide = drive.team.abbreviation === home.abbr ? 'h' : 'a';
  if (down == null && !posText) return null;
  // Absolute ball spot, 0 = home goal line (left), 100 = away goal line (right)
  var spot = null;
  var pm = posText && String(posText).match(/^([A-Z]{1,4})\s+(\d{1,2})$/);
  if (pm && possSide) {
    var possAbbr = possSide === 'h' ? home.abbr : away.abbr;
    var fromOwn = pm[1] === possAbbr ? Number(pm[2]) : 100 - Number(pm[2]);
    spot = possSide === 'h' ? fromOwn : 100 - fromOwn;
  } else if (/^50$|midfield/i.test(String(posText || ''))) {
    spot = 50;
  }
  var driveStart = null;
  var fp = drive && drive.plays && drive.plays[0] && drive.plays[0].start;
  var dm = fp && fp.possessionText && String(fp.possessionText).match(/^([A-Z]{1,4})\s+(\d{1,2})$/);
  if (dm && possSide) {
    var pa = possSide === 'h' ? home.abbr : away.abbr;
    var own = dm[1] === pa ? Number(dm[2]) : 100 - Number(dm[2]);
    driveStart = possSide === 'h' ? own : 100 - own;
  }
  var dir = possSide === 'h' ? 1 : -1;
  return {
    downText: ddText || _fbDownText(down, dist) || '',
    posText: posText,
    possSide: possSide,
    spot: spot,
    firstDown: (spot != null && dist != null && !/goal/i.test(ddText || '')) ? Math.max(0, Math.min(100, spot + dir * Number(dist))) : null,
    driveStart: driveStart,
    driveText: drive ? (drive.description || null) : null,
    lastPlay: _fbLastPlay(drive),
    timeoutsA: sit && sit.awayTimeouts != null ? sit.awayTimeouts : null,
    timeoutsH: sit && sit.homeTimeouts != null ? sit.homeTimeouts : null,
    redZone: !!(sit && sit.isRedZone)
  };
}
function _fbDrive(data, sport) {
  var drive = data.drives && data.drives.current;
  if (!drive) return null;
  var plays = (drive.plays || []).slice(-4).reverse().map(function (p) {
    var st = p.start || {};
    return { id: p.id != null ? String(p.id) : null, tag: st.shortDownDistanceText || st.downDistanceText || _gcPeriodTag(sport, p.period && p.period.number), text: p.text || '', scoring: !!p.scoringPlay };
  }).filter(function (p) { return p.text; });
  return { team: drive.team ? (drive.team.abbreviation || drive.team.shortDisplayName) : null, summary: drive.description || null, plays: plays };
}
function _fbBox(data) {
  var groups = [['passing', 'Passing'], ['rushing', 'Rushing'], ['receiving', 'Receiving'], ['defensive', 'Defense'], ['kicking', 'Kicking']];
  var out = {};
  ((data.boxscore && data.boxscore.players) || []).forEach(function (tp) {
    var tid = tp.team && String(tp.team.id);
    var sections = [];
    groups.forEach(function (g) {
      var st = (tp.statistics || []).filter(function (s) { return s.name === g[0]; })[0];
      if (!st || !(st.athletes || []).length) return;
      var n = Math.min((st.labels || []).length, 5);
      sections.push({
        title: g[1],
        cols: (st.labels || []).slice(0, n),
        rows: st.athletes.slice(0, 8).map(function (a) {
          var p = _gcPlayer(a.athlete);
          return { name: p.name, id: p.id, pos: null, cells: (a.stats || []).slice(0, n), sub: false };
        })
      });
    });
    out[tid] = { sections: sections };
  });
  return out;
}

// ── Basketball
function _bbSecs(clock) {
  var s = String(clock || '');
  var m = s.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  var n = Number(s);
  return isNaN(n) ? null : n;
}
function _bbShot(text) {
  var t = String(text || '');
  if (/three point|3-pt|three-point/i.test(t)) return '3-pointer';
  if (/dunk/i.test(t)) return 'dunk';
  if (/layup/i.test(t)) return 'layup';
  if (/free throw/i.test(t)) return 'free throw';
  if (/hook/i.test(t)) return 'hook shot';
  if (/alley/i.test(t)) return 'alley-oop';
  return 'bucket';
}
function _bbShooter(text) {
  var m = String(text || '').match(/^(.+?) (makes|made|dunks|lays|hits)/i);
  return m ? _lastName(m[1]) : '';
}
function _bbAnalyze(data, away, home) {
  var raw = (data.plays || []).filter(function (p) { return p && p.text; });
  var scoring = raw.filter(function (p) { return p.scoringPlay && p.awayScore != null && p.homeScore != null; });
  var sideOf = function (p) { var id = p.team && String(p.team.id); return id === String(home.id) ? 'h' : (id === String(away.id) ? 'a' : null); };
  var moments = {};
  var add = function (p, reason, prio) {
    var key = p.id || p.sequenceNumber || (p.period && p.period.number) + '-' + (p.clock && p.clock.displayValue) + '-' + p.text;
    if (moments[key] && moments[key].prio >= prio) return;
    moments[key] = { p: p, reason: reason, prio: prio };
  };
  var prevA = 0, prevH = 0, leadChanges = 0, prevLeader = 0;
  var runSide = null, runPts = 0, runLast = null;
  var closeRun = function () {
    if (runLast && runPts >= 8) add(runLast, 'Caps a ' + runPts + '–0 run', 2);
  };
  scoring.forEach(function (p) {
    var a = Number(p.awayScore), h = Number(p.homeScore);
    var side = sideOf(p) || (a > prevA ? 'a' : 'h');
    var pts = side === 'a' ? a - prevA : h - prevH;
    var leader = a > h ? -1 : (h > a ? 1 : 0);
    var per = (p.period && p.period.number) || 0;
    var secs = _bbSecs(p.clock && p.clock.displayValue);
    if (leader !== 0 && prevLeader !== 0 && leader !== prevLeader) leadChanges++;
    var late = per >= 4 && secs != null && secs <= 300;
    if (late && leader !== prevLeader) add(p, leader === 0 ? 'Ties it with ' + p.clock.displayValue + ' left' : 'Go-ahead with ' + p.clock.displayValue + ' left', 3);
    if (secs != null && secs <= 1.5 && pts > 0) add(p, 'Beats the buzzer', 4);
    if (pts === 3 && per >= 4 && secs != null && secs <= 120 && Math.abs(a - h) <= 5) add(p, 'Clutch three with ' + p.clock.displayValue + ' left', 2);
    if (side === runSide) { runPts += pts; runLast = p; }
    else { closeRun(); runSide = side; runPts = pts; runLast = p; }
    if (leader !== 0) prevLeader = leader;
    prevA = a; prevH = h;
  });
  closeRun();
  var momentList = Object.keys(moments).map(function (k) { return moments[k]; })
    .sort(function (x, y) { return scoring.indexOf(x.p) - scoring.indexOf(y.p); })
    .slice(-10)
    .map(function (m) {
      var p = m.p;
      var shooter = _bbShooter(p.text);
      return {
        tag: _gcPeriodTag('basketball', p.period && p.period.number), side: sideOf(p),
        time: (p.clock && p.clock.displayValue) || '', head: (shooter ? shooter + ' ' : '') + _bbShot(p.text),
        sub: m.reason, as: Number(p.awayScore), hs: Number(p.homeScore), id: String(p.id || '')
      };
    });
  // Every scoring play + block, newest first
  var feed = raw.filter(function (p) { return p.scoringPlay || /\bblocks?\b/i.test(p.text); }).slice(-150).reverse().map(function (p) {
    var isBlock = !p.scoringPlay;
    return {
      tag: _gcPeriodTag('basketball', p.period && p.period.number), time: (p.clock && p.clock.displayValue) || '',
      side: sideOf(p), text: p.text, kind: isBlock ? 'block' : 'score',
      pts: p.scoreValue != null ? Number(p.scoreValue) : null,
      as: isBlock ? null : Number(p.awayScore), hs: isBlock ? null : Number(p.homeScore)
    };
  });
  // Momentum — points over the last 8 scoring plays
  var tail = scoring.slice(-9);
  var momA = 0, momH = 0;
  for (var i = 1; i < tail.length; i++) {
    momA += Number(tail[i].awayScore) - Number(tail[i - 1].awayScore);
    momH += Number(tail[i].homeScore) - Number(tail[i - 1].homeScore);
  }
  return { moments: momentList, feed: feed, leadChanges: leadChanges, momA: momA, momH: momH, hasPlays: raw.length > 0 };
}
function _bbBox(data) {
  var want = ['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG'];
  var out = {};
  ((data.boxscore && data.boxscore.players) || []).forEach(function (tp) {
    var tid = tp.team && String(tp.team.id);
    var st = (tp.statistics || [])[0];
    if (!st) return;
    var labels = st.labels || [];
    var idx = want.map(function (w) { return labels.indexOf(w); });
    var cols = want.filter(function (w, i) { return idx[i] !== -1; });
    var toRow = function (a) {
      var p = _gcPlayer(a.athlete);
      var dnp = a.didNotPlay || !(a.stats || []).length;
      return { name: p.name, id: p.id, pos: p.pos, cells: dnp ? cols.map(function (c, i) { return i === 0 ? 'DNP' : ''; }) : idx.filter(function (x) { return x !== -1; }).map(function (x) { return a.stats[x]; }), sub: false, dnp: dnp };
    };
    var athletes = st.athletes || [];
    var starters = athletes.filter(function (a) { return a.starter; }).map(toRow);
    var bench = athletes.filter(function (a) { return !a.starter; }).map(toRow).filter(function (r) { return !r.dnp; });
    var sections = [];
    if (starters.length) sections.push({ title: 'Starters', cols: cols, rows: starters });
    if (bench.length) sections.push({ title: 'Bench', cols: cols, rows: bench });
    if (!sections.length && athletes.length) sections.push({ title: 'Players', cols: cols, rows: athletes.map(toRow) });
    out[tid] = { sections: sections };
  });
  return out;
}

// ── Soccer
function _scStat(stats, names) {
  for (var i = 0; i < names.length; i++) {
    var s = (stats || []).filter(function (x) { return x.name === names[i] || x.abbreviation === names[i]; })[0];
    if (s) return s.displayValue != null ? String(s.displayValue) : (s.value != null ? String(s.value) : '');
  }
  return '0';
}
function _scEvents(data, away, home) {
  var goals = [], cards = [];
  var a = 0, h = 0;
  (data.keyEvents || []).forEach(function (e) {
    var type = String((e.type && (e.type.text || e.type.type)) || '');
    var side = e.team && (String(e.team.id) === String(home.id) || e.team.displayName === home.name) ? 'h' : 'a';
    var who = (e.participants && e.participants[0] && e.participants[0].athlete && e.participants[0].athlete.displayName) || '';
    var clock = (e.clock && e.clock.displayValue) || '';
    var isGoal = e.scoringPlay || (/goal/i.test(type) && !/disallow|no goal|kick/i.test(type));
    if (isGoal) {
      if (side === 'h') h++; else a++;
      var own = /own goal/i.test(type);
      var pen = /penalty/i.test(type);
      var assist = e.participants && e.participants[1] && e.participants[1].athlete ? 'Assist: ' + _lastName(e.participants[1].athlete.displayName) : '';
      goals.push({ tag: clock, side: side, time: '', head: (who ? _lastName(who) + ' ' : '') + (own ? 'own goal' : pen ? 'penalty' : 'goal'), sub: assist || e.text || '', as: a, hs: h, scorer: who, own: own });
    } else if (/red card/i.test(type)) {
      cards.push({ tag: clock, side: side, time: '', head: (who ? _lastName(who) + ' ' : '') + 'sent off', sub: 'Red card', as: a, hs: h, red: true });
    }
  });
  var all = goals.concat(cards).sort(function (x, y) { return (parseInt(x.tag, 10) || 0) - (parseInt(y.tag, 10) || 0); });
  return { goals: goals, highlights: all };
}
function _scBox(data) {
  var out = {};
  var cols = ['G', 'A', 'SH', 'ST', 'FC', 'YC'];
  (data.rosters || []).forEach(function (tr) {
    var tid = tr.team && String(tr.team.id);
    var toRow = function (r, isSub) {
      var p = _gcPlayer(r.athlete);
      var pos = (r.position && (r.position.abbreviation || r.position.displayName)) || p.pos;
      var s = r.stats || [];
      var gk = /^G(K)?$/.test(String(pos || ''));
      return {
        name: p.name, id: p.id, pos: pos, sub: isSub, gk: gk,
        cells: gk
          ? [_scStat(s, ['saves', 'SV']), _scStat(s, ['goalsConceded', 'GA']), '', '', _scStat(s, ['foulsCommitted', 'FC']), _scStat(s, ['yellowCards', 'YC'])]
          : [_scStat(s, ['totalGoals', 'G']), _scStat(s, ['goalAssists', 'A']), _scStat(s, ['totalShots', 'SH']), _scStat(s, ['shotsOnTarget', 'ST']), _scStat(s, ['foulsCommitted', 'FC']), _scStat(s, ['yellowCards', 'YC'])]
      };
    };
    var roster = tr.roster || [];
    var starters = roster.filter(function (r) { return r.starter; }).map(function (r) { return toRow(r, false); });
    var subs = roster.filter(function (r) { return !r.starter && r.subbedIn; }).map(function (r) { return toRow(r, true); });
    var sections = [];
    if (starters.length) sections.push({ title: 'Starters', cols: cols, rows: starters, note: 'Keepers: G = saves · A = goals allowed' });
    if (subs.length) sections.push({ title: 'Substitutes', cols: cols, rows: subs });
    out[tid] = { sections: sections };
  });
  return out;
}

function summarizeGamecast(data, league, eventId, wantAllPlays) {
  var sport = _gcSport(league);
  var header = data.header || {};
  var comp = (header.competitions && header.competitions[0]) || {};
  var competitors = comp.competitors || [];
  var awayC = competitors.filter(function (c) { return c.homeAway === 'away'; })[0] || {};
  var homeC = competitors.filter(function (c) { return c.homeAway === 'home'; })[0] || {};
  var away = _gcSide(awayC), home = _gcSide(homeC);
  var status = comp.status || {};
  var stype = status.type || {};
  var phase = stype.state === 'in' ? 'live' : (stype.state === 'post' ? 'final' : 'pre');
  if (/postpon|cancel|suspend|delay/i.test(stype.description || '') && phase !== 'live') phase = 'off';
  var model = {
    sport: sport, league: league, gameId: String(header.id || eventId), phase: phase,
    status: stype.description || null, statusDetail: stype.shortDetail || stype.detail || null,
    startTime: comp.date || null,
    venue: (data.gameInfo && data.gameInfo.venue && data.gameInfo.venue.fullName) || (comp.venue && comp.venue.fullName) || null,
    period: status.period || null, clock: status.displayClock || null,
    away: away, home: home,
    highlights: [], feed: [], leaders: [], teamStats: [], form: { away: [], home: [] },
    situation: null, drive: null, box: { away: { sections: [] }, home: { sections: [] } }, star: null, stars: null
  };
  var boxById = {};
  try {
    if (sport === 'football') {
      model.highlights = (data.scoringPlays || []).map(function (p) {
        var id = p.team && String(p.team.id);
        return {
          tag: _gcPeriodTag(sport, p.period && p.period.number), side: id === String(home.id) ? 'h' : 'a',
          time: (p.clock && p.clock.displayValue) || '', head: _fbHead(p), sub: p.text || '',
          as: _num(p.awayScore), hs: _num(p.homeScore)
        };
      });
      model.leaders = _gcLeaders(data, away, home, [{ name: 'passingYards', label: 'PASS' }, { name: 'rushingYards', label: 'RUSH' }, { name: 'receivingYards', label: 'REC' }]);
      model.teamStats = _gcStatRows(data, away, home, [
        { label: 'Total yds', names: ['totalYards', 'Total Yards'] },
        { label: 'Turnovers', names: ['turnovers', 'Turnovers'], lower: true },
        { label: 'Possession', names: ['possessionTime', 'Possession'] },
        { label: '3rd down', names: ['thirdDownEff', '3rd down efficiency'] }
      ]);
      if (phase === 'live') { model.situation = _fbSituation(data, comp, away, home); model.drive = _fbDrive(data, sport); }
      if (wantAllPlays) model.allDrives = _fbAllDrives(data, home.id);
      boxById = _fbBox(data);
    } else if (sport === 'basketball') {
      var bb = _bbAnalyze(data, away, home);
      model.highlights = bb.moments;
      model.feed = bb.feed;
      model.leadChanges = bb.leadChanges;
      model.leaders = _gcLeaders(data, away, home, [{ name: 'points', label: 'PTS' }, { name: 'rebounds', label: 'REB' }, { name: 'assists', label: 'AST' }]);
      model.teamStats = _gcStatRows(data, away, home, [
        { label: 'FG%', names: ['fieldGoalPct', 'FG%'] },
        { label: '3PT%', names: ['threePointFieldGoalPct', '3P%', 'threePointPct'] },
        { label: 'Rebounds', names: ['totalRebounds', 'REB', 'rebounds'] },
        { label: 'Turnovers', names: ['turnovers', 'totalTurnovers', 'TO'], lower: true }
      ]);
      if (phase === 'live') model.situation = { momA: bb.momA, momH: bb.momH };
      boxById = _bbBox(data);
    } else if (sport === 'soccer') {
      var sc = _scEvents(data, away, home);
      model.highlights = sc.highlights;
      model.teamStats = _gcStatRows(data, away, home, [
        { label: 'Possession', names: ['possessionPct', 'Possession'], fmt: function (v) { return /%$/.test(v) ? v : v + '%'; } },
        { label: 'Shots', names: ['totalShots', 'SHOTS'] },
        { label: 'On target', names: ['shotsOnTarget', 'ON GOAL'] },
        { label: 'Corners', names: ['wonCorners', 'Corner Kicks'] },
        { label: 'Fouls', names: ['foulsCommitted', 'Fouls'], lower: true },
        { label: 'Saves', names: ['saves', 'Saves'] }
      ]);
      if (phase === 'live') {
        var poss = model.teamStats.filter(function (r) { return r[0] === 'Possession'; })[0];
        model.situation = { possA: poss ? poss[3] : null, possH: poss ? poss[4] : null };
      }
      var goalsBy = {};
      sc.goals.forEach(function (g) {
        if (!g.scorer || g.own) return;
        if (!goalsBy[g.scorer]) goalsBy[g.scorer] = { n: 0, side: g.side };
        goalsBy[g.scorer].n++;
      });
      var topName = Object.keys(goalsBy).sort(function (x, y) { return goalsBy[y].n - goalsBy[x].n; })[0];
      if (topName && phase === 'final') {
        model.star = { title: 'Player of the match', name: topName, line: goalsBy[topName].n + (goalsBy[topName].n > 1 ? ' goals' : ' goal'), side: goalsBy[topName].side };
      }
      boxById = _scBox(data);
    }
    if (phase === 'pre') model.form = _gcForm(data, away, home);
  } catch (e) {
    model.parseError = String(e && e.message || e);
  }
  model.box = { away: boxById[String(away.id)] || { sections: [] }, home: boxById[String(home.id)] || { sections: [] } };

  // Star of the game (football: winning side's passing leader; basketball: top scorer)
  if (phase === 'final' && !model.star) {
    try {
      var winSide = (away.score || 0) > (home.score || 0) ? 'a' : 'h';
      if (sport === 'football') {
        var pass = model.leaders.filter(function (l) { return l.label === 'PASS'; })[0];
        var pick = pass && (winSide === 'a' ? pass.a : pass.h);
        if (pick) model.star = { title: 'Player of the game', name: pick.name, id: pick.id, line: pick.line, side: winSide };
      } else if (sport === 'basketball') {
        var best = null;
        ['away', 'home'].forEach(function (k) {
          (model.box[k].sections || []).forEach(function (sec) {
            var pi = sec.cols.indexOf('PTS'), ri = sec.cols.indexOf('REB'), ai = sec.cols.indexOf('AST');
            sec.rows.forEach(function (r) {
              var pts = _num(r.cells[pi]);
              if (pts != null && (!best || pts > best.pts)) best = { pts: pts, r: r, side: k === 'away' ? 'a' : 'h', reb: r.cells[ri], ast: r.cells[ai] };
            });
          });
        });
        if (best) model.star = { title: 'Top performer', name: best.r.name, id: best.r.id, line: best.pts + ' PTS · ' + (best.reb || 0) + ' REB · ' + (best.ast || 0) + ' AST', side: best.side };
      }
    } catch (e) { /* star is optional */ }
  }
  return model;
}

// Team colors by abbreviation for the pre-game form circles (opponents
// only come with an abbreviation). Same teams endpoint the team picker
// uses; failure just leaves the circles in the neutral fill.
async function _gcTeamColors(path, league) {
  try {
    var cfb = league === 'cfb';
    var url = 'https://' + (cfb ? 'site.web.api.espn.com' : 'site.api.espn.com') + '/apis/site/v2/sports/' + path + '/teams?limit=400' + (cfb ? '&groups=80&groupType=conference&enable=groups' : '');
    var r = await fetch(url);
    var data = await r.json();
    var list = (((data.sports || [])[0] || {}).leagues || [])[0] || {};
    var map = {};
    (list.teams || []).forEach(function (t) {
      var tm = t.team || {};
      if (tm.abbreviation) map[tm.abbreviation] = { color: _hex(tm.color), alt: _hex(tm.alternateColor) };
    });
    return map;
  } catch (e) {
    return {};
  }
}
