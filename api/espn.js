// Vercel Serverless Function — GET /api/espn?league=nfl|cfb|nba|wnba|mls|nwsl&mode=schedule&date=YYYYMMDD
//                               GET /api/espn?league=...&mode=boxscore&eventId=<id>
//                               GET /api/espn?mode=search&q=<name>[&debug=1]
//                               GET /api/espn?league=nfl&mode=player&id=<athleteId>[&debug=1]
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
  // Cross-sport player search needs no league (v5.67.0).
  if (mode === 'search') { await _playerSearch(req, res); return; }
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
      // v7.2.1: ESPN's summary doesn't carry timeouts; the single-game
      // situation resource does. NFL only — ESPN reports a flat 3 for every
      // college game, which would be wrong. Fails soft (keeps nulls).
      if (model.phase === 'live' && league === 'nfl' && model.situation) {
        try {
          const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
          const tm = ctrl ? setTimeout(function () { ctrl.abort(); }, 2500) : null;
          const sr = await fetch('https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events/' + encodeURIComponent(eventId) + '/competitions/' + encodeURIComponent(eventId) + '/situation', ctrl ? { signal: ctrl.signal } : undefined);
          if (tm) clearTimeout(tm);
          if (sr.ok) {
            const sj = await sr.json();
            if (sj && sj.awayTimeouts != null) model.situation.timeoutsA = sj.awayTimeouts;
            if (sj && sj.homeTimeouts != null) model.situation.timeoutsH = sj.homeTimeouts;
          }
        } catch (e) {}
      }
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
    // Team page (v5.65.0): header info, roster and the whole season's
    // schedule for one team, in one call. Each ESPN piece is fetched on its
    // own and fails soft to null, so a missing roster never costs the
    // schedule and vice versa.
    if (mode === 'team') {
      const teamId = req.query.teamId;
      if (!teamId) { res.status(400).json({ error: 'Missing teamId' }); return; }
      const base = 'https://site.api.espn.com/apis/site/v2/sports/' + path + '/teams/' + encodeURIComponent(teamId);
      const season = req.query.season ? '&season=' + encodeURIComponent(req.query.season) : '';
      const parts = await Promise.all([
        _tpGetJson(base),
        _tpGetJson(base + '/roster'),
        _tpGetJson(base + '/schedule?seasontype=2' + season),
        _tpGetJson(base + '/schedule?seasontype=3' + season),
        _gcTeamColors(path, league)
      ]);
      const result = summarizeTeamPage(parts, teamId, league);
      if (!result.team.name && !result.games.length) { res.status(502).json({ error: 'No team data from ESPN' }); return; }
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      res.status(200).json(result);
      return;
    }
    if (mode === 'standings') {
      if (league !== 'nfl') { res.status(400).json({ error: 'Standings-based playoff seeding is only built for nfl right now — cfb seeding comes from the CFP committee, not computable win-loss standings' }); return; }
      const season = req.query.season || new Date().getFullYear();
      // level=3 is what makes ESPN nest conference -> division -> teams.
      // Without it each conference comes back as one flat 16-team table
      // with no division children, which parsed to nothing (v5.65.2 fix,
      // shape checked against a live response).
      const url = 'https://site.web.api.espn.com/apis/v2/sports/' + path + '/standings?level=3&season=' + encodeURIComponent(season);
      const r = await fetch(url);
      const data = await r.json();
      // ESPN's standings feed has been seen reporting 0-0 for every team
      // weeks into a season. When it does, records are rebuilt from that
      // season's weekly scoreboards instead.
      if (_nflStandingsAllZero(data)) {
        const recs = await _nflRecordsFromScoreboards(path, season);
        if (recs) _nflApplyRecords(data, recs);
      }
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
    // Player profile (v7.3.0) — NFL only for now.
    if (mode === 'player') {
      if (league !== 'nfl') { res.status(400).json({ error: 'Player profiles are only built for nfl right now' }); return; }
      await _playerProfile(req, res, path, league);
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
    res.status(400).json({ error: 'Unknown mode — use schedule, boxscore, gamecast, pregame, team, standings, teams, or player' });
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

function _nflEachEntry(data, fn) {
  (data.children || []).forEach(function (conf) {
    (conf.children || []).forEach(function (div) {
      ((div.standings && div.standings.entries) || []).forEach(fn);
    });
  });
}
function _nflStandingsAllZero(data) {
  var games = 0, teams = 0;
  _nflEachEntry(data, function (e) { teams++; games += _nflStatValue(e, 'wins') + _nflStatValue(e, 'losses') + _nflStatValue(e, 'ties'); });
  return teams > 0 && games === 0;
}
async function _nflRecordsFromScoreboards(path, season) {
  try {
    var weeks = [];
    for (var w = 1; w <= 18; w++) weeks.push(w);
    var boards = await Promise.all(weeks.map(function (w) {
      return _tpGetJson('https://site.api.espn.com/apis/site/v2/sports/' + path + '/scoreboard?seasontype=2&week=' + w + '&dates=' + encodeURIComponent(season));
    }));
    var recs = {}, any = false;
    boards.forEach(function (b) {
      ((b && b.events) || []).forEach(function (ev) {
        var comp = (ev.competitions && ev.competitions[0]) || {};
        var st = (comp.status && comp.status.type) || (ev.status && ev.status.type) || {};
        if (!st.completed) return;
        var cs = comp.competitors || [];
        if (cs.length !== 2) return;
        var a = _num(cs[0].score), h = _num(cs[1].score);
        if (a == null || h == null) return;
        cs.forEach(function (c, i) {
          var id = c.team && c.team.id != null ? String(c.team.id) : null;
          if (!id) return;
          var us = i === 0 ? a : h, them = i === 0 ? h : a;
          var r = recs[id] = recs[id] || { w: 0, l: 0, t: 0 };
          if (us > them) r.w++; else if (us < them) r.l++; else r.t++;
          any = true;
        });
      });
    });
    return any ? recs : null;
  } catch (e) { return null; }
}
function _nflApplyRecords(data, recs) {
  _nflEachEntry(data, function (e) {
    var id = e.team && e.team.id != null ? String(e.team.id) : null;
    var r = id && recs[id];
    if (!r) return;
    (e.stats || []).forEach(function (s) {
      if (s.name === 'wins') s.value = r.w;
      if (s.name === 'losses') s.value = r.l;
      if (s.name === 'ties') s.value = r.t;
    });
  });
}

function summarizeNflStandings(data) {
  var conferences = data.children || [];
  var divisions = [];
  conferences.forEach(function (conf) {
    var confName = conf.name || conf.abbreviation || '';
    var confKey = /national/i.test(confName) ? 'nfc' : 'afc';
    var divGroups = conf.children || [];
    divGroups.forEach(function (div) {
      // Live division names already carry the conference ("NFC West"); it's
      // stripped here because the division label adds it back.
      var divName = (div.name || div.abbreviation || '').replace(/^((American|National) Football Conference|AFC|NFC)\s+/i, '');
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
      return { id: e.id != null ? String(e.id) : null, opp: opp.abbreviation || '?', oppName: opp.displayName || null, res: res || '?', score: e.score || null, atVs: e.atVs || null, date: e.gameDate || null };
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
      model.possession = _fbPossession(data, away, home); // v7.2.1
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

// ── TEAM PAGE (v5.65.0) ──────────────────────────────────────────────
async function _tpGetJson(url) {
  try { var r = await fetch(url); if (!r.ok) return null; return await r.json(); }
  catch (e) { return null; }
}
function _tpScore(s) {
  if (s == null) return null;
  if (typeof s === 'object') return s.value != null ? Number(s.value) : _num(s.displayValue);
  return _num(s);
}
var _TP_GROUP_LABELS = { offense: 'Offense', defense: 'Defense', specialteam: 'Special teams', specialteams: 'Special teams' };
function summarizeTeamPage(parts, teamId, league) {
  var info = (parts[0] && parts[0].team) || {};
  var items = (info.record && info.record.items) || [];
  var total = items.filter(function (r) { return /total|overall/i.test(r.type || r.description || ''); })[0] || items[0];
  var team = {
    id: String(info.id || teamId),
    name: info.displayName || null,
    short: info.shortDisplayName || info.name || null,
    abbr: info.abbreviation || null,
    location: info.location || null,
    color: _hex(info.color),
    alt: _hex(info.alternateColor),
    logo: (info.logos && info.logos[0] && info.logos[0].href) || null,
    record: total ? (total.summary || null) : null,
    standing: info.standingSummary || null
  };

  // Football rosters come grouped (offense / defense / special teams);
  // every other league is one flat list.
  var mapP = function (a) {
    a = a || {};
    var exp = a.experience && a.experience.years;
    return {
      id: a.id != null ? String(a.id) : null,
      name: a.displayName || a.fullName || '',
      jersey: a.jersey != null ? String(a.jersey) : null,
      pos: (a.position && a.position.abbreviation) || null,
      posName: (a.position && (a.position.displayName || a.position.name)) || null,
      exp: exp != null ? Number(exp) : null
    };
  };
  var groups = [];
  var ath = (parts[1] && parts[1].athletes) || [];
  if (ath.length && ath[0] && Array.isArray(ath[0].items)) {
    ath.forEach(function (g) {
      var key = String(g.position || '').toLowerCase().replace(/[^a-z]/g, '');
      var players = (g.items || []).map(mapP).filter(function (p) { return p.name; });
      if (players.length) groups.push({ label: _TP_GROUP_LABELS[key] || (g.position ? String(g.position).charAt(0).toUpperCase() + String(g.position).slice(1) : 'Roster'), players: players });
    });
  } else if (ath.length) {
    var flat = ath.map(mapP).filter(function (p) { return p.name; });
    if (flat.length) groups.push({ label: 'Roster', players: flat });
  }

  var seen = {}, games = [];
  [parts[2], parts[3]].forEach(function (sched, si) {
    ((sched && sched.events) || []).forEach(function (ev) {
      if (!ev || ev.id == null || seen[ev.id]) return;
      seen[ev.id] = true;
      var comp = (ev.competitions && ev.competitions[0]) || {};
      var cs = comp.competitors || [];
      var me = cs.filter(function (c) { return String(c.id || (c.team && c.team.id)) === team.id; })[0];
      var opp = cs.filter(function (c) { return c !== me; })[0];
      if (!me || !opp) return;
      var ot = opp.team || {};
      var st = (comp.status && comp.status.type) || (ev.status && ev.status.type) || {};
      var state = st.state || (st.completed ? 'post' : 'pre');
      var us = _tpScore(me.score), them = _tpScore(opp.score);
      var res = null;
      if (state === 'post') {
        if (us != null && them != null && (us || them)) res = us > them ? 'W' : (us < them ? 'L' : 'T');
        else if (me.winner === true) res = 'W';
        else if (opp.winner === true) res = 'L';
      }
      var week = ev.week || {};
      games.push({
        id: String(ev.id),
        date: ev.date || comp.date || null,
        timeTbd: comp.timeValid === false || ev.timeValid === false,
        week: week.number != null ? Number(week.number) : null,
        label: week.text || (si === 1 ? 'Postseason' : null),
        post: si === 1,
        home: me.homeAway === 'home',
        neutral: !!comp.neutralSite,
        opp: ot.abbreviation || '?',
        oppName: ot.displayName || ot.name || null,
        oppShort: ot.shortDisplayName || null,
        state: state,
        status: st.shortDetail || st.detail || null,
        us: res ? us : null,
        them: res ? them : null,
        res: res,
        venue: (comp.venue && comp.venue.fullName) || null
      });
    });
  });
  games.sort(function (a, b) { return String(a.date || '') < String(b.date || '') ? -1 : 1; });
  return { league: league, team: team, groups: groups, games: games, teamColors: parts[4] || {} };
}

// ── PLAYER SEARCH (v5.67.0) — GET /api/espn?mode=search&q=<name>
// ESPN's site-wide search, which spans every league in one call. Same
// caveat as the rest of this file: undocumented, best-effort. Two known
// endpoint shapes are tried in order (common/v3 "items", then search/v2
// "results[].contents"), and each item is read defensively. If results
// ever come back empty for a name that should match, hit this with
// &debug=1 to see what ESPN actually returned instead of guessing.
var _SEARCH_LEAGUE = {
  'nfl': 'nfl', 'college-football': 'cfb', 'nba': 'nba', 'wnba': 'wnba', 'nhl': 'nhl', 'mlb': 'mlb',
  'usa.1': 'mls', 'mls': 'mls', 'usa.nwsl': 'nwsl', 'nwsl': 'nwsl'
};
// ESPN numeric league ids, for items that only carry a uid like
// "s:20~l:28~a:3139477".
var _SEARCH_LEAGUE_ID = { '28': 'nfl', '23': 'cfb', '46': 'nba', '59': 'wnba', '90': 'nhl', '10': 'mlb', '770': 'mls' };
function _searchItemToPlayer(it) {
  if (!it || typeof it !== 'object') return null;
  var type = String(it.type || '').toLowerCase();
  if (type && type !== 'player' && type !== 'athlete') return null;
  var name = it.displayName || it.name || it.fullName || null;
  if (!name) return null;
  var uid = String(it.uid || '');
  var idMatch = uid.match(/a:(\d+)/);
  var id = it.id || (idMatch ? idMatch[1] : null);
  var slug = String(it.league || it.defaultLeagueSlug || (it.leagues && it.leagues[0] && (it.leagues[0].slug || it.leagues[0].abbreviation)) || '').toLowerCase();
  var league = _SEARCH_LEAGUE[slug] || null;
  if (!league) { var lm = uid.match(/l:(\d+)/); if (lm) league = _SEARCH_LEAGUE_ID[lm[1]] || null; }
  if (!league) return null; // a sport Innings doesn't cover
  var rel = (it.teamRelationships && it.teamRelationships[0]) || null;
  var team = (rel && (rel.displayName || (rel.core && rel.core.displayName))) || (it.team && it.team.displayName) || it.subtitle || null;
  var pos = (it.position && (it.position.abbreviation || it.position.displayName)) || null;
  return { id: id != null ? String(id) : null, name: name, pos: pos, team: team, league: league };
}
async function _playerSearch(req, res) {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) { res.status(200).json({ players: [] }); return; }
  const enc = encodeURIComponent(q);
  const v3 = await _tpGetJson('https://site.web.api.espn.com/apis/common/v3/search?region=us&lang=en&query=' + enc + '&limit=25&mode=prefix&type=player');
  let items = (v3 && Array.isArray(v3.items)) ? v3.items : [];
  let players = items.map(_searchItemToPlayer).filter(Boolean);
  let v2 = null;
  if (!players.length) {
    v2 = await _tpGetJson('https://site.web.api.espn.com/apis/search/v2?region=us&lang=en&limit=25&query=' + enc);
    const groups = (v2 && Array.isArray(v2.results)) ? v2.results : [];
    items = [];
    groups.forEach(function (g) {
      if (!g || !/player|athlete/i.test(String(g.type || ''))) return;
      (g.contents || []).forEach(function (c) { items.push(Object.assign({ type: 'player' }, c)); });
    });
    players = items.map(_searchItemToPlayer).filter(Boolean);
  }
  if (req.query.debug) {
    res.status(200).json({
      players: players,
      debug: {
        v3Keys: v3 ? Object.keys(v3) : null,
        v3Sample: (v3 && v3.items || []).slice(0, 2),
        v2Keys: v2 ? Object.keys(v2) : null,
        v2Types: v2 && v2.results ? v2.results.map(function (g) { return g && g.type; }) : null,
        v2Sample: items.slice(0, 2)
      }
    });
    return;
  }
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).json({ players: players.slice(0, 20) });
}


// ── TIME OF POSSESSION FROM THE DRIVES (v7.2.1) ─────────────────────────
// Each finished drive (and the one in progress) says how long it took and
// whose it was; adding those up gives time of possession even when the box
// score's team stats don't include it yet.
function _fbPossession(data, away, home) {
  var d = data && data.drives;
  if (!d) return null;
  var list = (d.previous || []).slice();
  if (d.current && list.indexOf(d.current) === -1 && !list.some(function (x) { return x.id != null && x.id === d.current.id; })) list.push(d.current);
  var secs = function (v) { var m = String(v || '').match(/^(\d+):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
  var a = 0, h = 0;
  list.forEach(function (dr) {
    var t = secs(dr.timeElapsed && (dr.timeElapsed.displayValue || dr.timeElapsed.value));
    var id = dr.team && String(dr.team.id);
    if (id === String(home.id)) h += t; else if (id === String(away.id)) a += t;
  });
  return a + h > 0 ? { a: a, h: h } : null;
}

// ── PLAYER PROFILE (v7.3.0) ─────────────────────────────────────────────
// GET /api/espn?league=nfl&mode=player&id=<espn athlete id>[&debug=1]
// A "get to know the player" page, not a stats source of truth: who he
// is, where he stands this season, his career arc and a few derived
// notables. Five ESPN pieces are fetched side by side and each fails soft
// to null, so a missing depth chart never costs the bio, and so on.
// Untested against live responses — add &debug=1 to see which pieces came
// back and their top-level shape.
function _plNum(v) {
  if (v == null || v === '') return null;
  var n = Number(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : null;
}
function _plSeasonYear(now) {
  var d = now || new Date();
  // NFL seasons run Sep–Feb: January/February games belong to last year's season.
  return d.getMonth() < 2 ? d.getFullYear() - 1 : (d.getMonth() < 7 ? d.getFullYear() - 1 : d.getFullYear());
}
function _plGroup(pos) {
  var p = String(pos || '').toUpperCase();
  if (p === 'QB') return 'qb';
  if (p === 'RB' || p === 'FB' || p === 'HB') return 'rb';
  if (p === 'WR' || p === 'TE') return 'rec';
  if (p === 'PK' || p === 'K') return 'k';
  if (p === 'P') return 'p';
  if (/^(DE|DT|NT|DL|LB|ILB|OLB|MLB|CB|S|FS|SS|DB|EDGE)$/.test(p)) return 'def';
  if (/^(OT|OG|G|T|C|OL|LS)$/.test(p)) return 'ol';
  return 'other';
}
// What each position group shows. `cat` is the ESPN stat category, `names`
// the stat keys to try in order (the career and core feeds don't always
// agree on a name). `min` is the volume a season needs before it's the
// season worth showing (a backup's two mop-up snaps aren't "where he stands").
var _PL_DEFS = {
  qb: {
    tiles: [
      { label: 'Pass yds', cat: 'passing', names: ['passingYards'] },
      { label: 'Comp %', cat: 'passing', names: ['completionPct', 'completionPercentage'], pct: true },
      { label: 'TD–INT', pair: [{ cat: 'passing', names: ['passingTouchdowns'] }, { cat: 'passing', names: ['interceptions'] }] },
      { label: 'Rating', cat: 'passing', names: ['QBRating', 'quarterbackRating', 'passerRating'] }
    ],
    volume: { cat: 'passing', names: ['passingAttempts'], min: 40 },
    arc: { label: 'Passing yards by season', cat: 'passing', names: ['passingYards'], short: 'pass yds' },
    extra: { cat: 'passing', names: ['passingTouchdowns'], short: 'TD' },
    totals: [
      { label: 'Pass yds', cat: 'passing', names: ['passingYards'] },
      { label: 'TD–INT', pair: [{ cat: 'passing', names: ['passingTouchdowns'] }, { cat: 'passing', names: ['interceptions'] }] },
      { label: 'Comp %', cat: 'passing', names: ['completionPct', 'completionPercentage'], pct: true }
    ]
  },
  rb: {
    tiles: [
      { label: 'Rush yds', cat: 'rushing', names: ['rushingYards'] },
      { label: 'Yds / carry', cat: 'rushing', names: ['yardsPerRushAttempt', 'rushingYardsPerAttempt'] },
      { label: 'Rush TD', cat: 'rushing', names: ['rushingTouchdowns'] },
      { label: 'Rec yds', cat: 'receiving', names: ['receivingYards'] }
    ],
    volume: { cat: 'rushing', names: ['rushingAttempts'], min: 25 },
    arc: { label: 'Rushing yards by season', cat: 'rushing', names: ['rushingYards'], short: 'rush yds' },
    extra: { cat: 'rushing', names: ['rushingTouchdowns'], short: 'TD' },
    totals: [
      { label: 'Rush yds', cat: 'rushing', names: ['rushingYards'] },
      { label: 'Rush TD', cat: 'rushing', names: ['rushingTouchdowns'] },
      { label: 'Rec yds', cat: 'receiving', names: ['receivingYards'] }
    ]
  },
  rec: {
    tiles: [
      { label: 'Rec yds', cat: 'receiving', names: ['receivingYards'] },
      { label: 'Catches', cat: 'receiving', names: ['receptions'] },
      { label: 'Rec TD', cat: 'receiving', names: ['receivingTouchdowns'] },
      { label: 'Yds / catch', cat: 'receiving', names: ['yardsPerReception'] }
    ],
    volume: { cat: 'receiving', names: ['receptions'], min: 8 },
    arc: { label: 'Receiving yards by season', cat: 'receiving', names: ['receivingYards'], short: 'rec yds' },
    extra: { cat: 'receiving', names: ['receivingTouchdowns'], short: 'TD' },
    totals: [
      { label: 'Catches', cat: 'receiving', names: ['receptions'] },
      { label: 'Rec yds', cat: 'receiving', names: ['receivingYards'] },
      { label: 'Rec TD', cat: 'receiving', names: ['receivingTouchdowns'] }
    ]
  },
  def: {
    tiles: [
      { label: 'Tackles', cat: 'defensive', names: ['totalTackles'] },
      { label: 'Sacks', cat: 'defensive', names: ['sacks'] },
      { label: 'INT', cat: 'defensiveInterceptions', names: ['interceptions'] },
      { label: 'Passes def.', cat: 'defensive', names: ['passesDefended'] }
    ],
    volume: { cat: 'defensive', names: ['totalTackles'], min: 10 },
    arc: { label: 'Tackles by season', cat: 'defensive', names: ['totalTackles'], short: 'tackles' },
    extra: { cat: 'defensive', names: ['sacks'], short: 'sacks' },
    totals: [
      { label: 'Tackles', cat: 'defensive', names: ['totalTackles'] },
      { label: 'Sacks', cat: 'defensive', names: ['sacks'] },
      { label: 'INT', cat: 'defensiveInterceptions', names: ['interceptions'] }
    ]
  },
  k: {
    tiles: [
      { label: 'FG made', cat: 'kicking', names: ['fieldGoalsMade'] },
      { label: 'FG %', cat: 'kicking', names: ['fieldGoalPct'], pct: true },
      { label: 'Long', cat: 'kicking', names: ['longFieldGoalMade', 'longFieldGoal'] },
      { label: 'XP made', cat: 'kicking', names: ['extraPointsMade'] }
    ],
    volume: { cat: 'kicking', names: ['fieldGoalAttempts'], min: 5 },
    arc: { label: 'Field goals by season', cat: 'kicking', names: ['fieldGoalsMade'], short: 'FG' },
    totals: [
      { label: 'FG made', cat: 'kicking', names: ['fieldGoalsMade'] },
      { label: 'FG %', cat: 'kicking', names: ['fieldGoalPct'], pct: true },
      { label: 'XP made', cat: 'kicking', names: ['extraPointsMade'] }
    ]
  },
  p: {
    tiles: [
      { label: 'Punts', cat: 'punting', names: ['punts'] },
      { label: 'Avg', cat: 'punting', names: ['grossAvgPuntYards', 'puntAverage'] },
      { label: 'Net avg', cat: 'punting', names: ['netAvgPuntYards'] },
      { label: 'Inside 20', cat: 'punting', names: ['puntsInside20'] }
    ],
    volume: { cat: 'punting', names: ['punts'], min: 10 },
    arc: { label: 'Punts by season', cat: 'punting', names: ['punts'], short: 'punts' },
    totals: [
      { label: 'Punts', cat: 'punting', names: ['punts'] },
      { label: 'Avg', cat: 'punting', names: ['grossAvgPuntYards', 'puntAverage'] }
    ]
  }
};

// Career feed (common/v3 …/athletes/{id}/stats): categories with parallel
// names[] and per-season rows of stats[] strings. Flattened here to
// { byYear: { 2023: { teamId, passing: { passingYards: 4280, … } } }, totals }.
function _plCareer(data) {
  var out = { byYear: {}, totals: {}, teams: {} };
  if (!data) return out;
  if (data.teams && typeof data.teams === 'object') {
    Object.keys(data.teams).forEach(function (k) {
      var t = data.teams[k] || {};
      out.teams[String(t.id || k)] = { name: t.displayName || t.name || null, abbr: t.abbreviation || null };
    });
  }
  (data.categories || []).forEach(function (cat) {
    var names = cat.names || [];
    var cname = cat.name;
    if (!cname || !names.length) return;
    (cat.statistics || []).forEach(function (row) {
      var yr = row.season && (row.season.year || _plNum(row.season.displayName));
      if (!yr) return;
      var y = out.byYear[yr] || (out.byYear[yr] = { teamIds: [] });
      if (row.teamId != null && y.teamIds.indexOf(String(row.teamId)) === -1) y.teamIds.push(String(row.teamId));
      if (row.teamSlug && !y.teamSlug) y.teamSlug = row.teamSlug;
      var c = y[cname] || (y[cname] = {});
      names.forEach(function (n, i) {
        var v = _plNum((row.stats || [])[i]);
        if (v == null) return;
        // A season split across two teams comes as two rows — add counts up.
        c[n] = (c[n] != null && !/pct|avg|per|rating|long/i.test(n)) ? c[n] + v : v;
      });
    });
    var tot = (cat.totals || []);
    if (tot.length) {
      var tc = out.totals[cname] || (out.totals[cname] = {});
      names.forEach(function (n, i) { var v = _plNum(tot[i]); if (v != null) tc[n] = v; });
    }
  });
  return out;
}
function _plPick(bag, cat, names) {
  var c = bag && bag[cat];
  if (!c) return null;
  for (var i = 0; i < names.length; i++) if (c[names[i]] != null) return c[names[i]];
  return null;
}
function _plFmt(v, pct) {
  if (v == null) return '—';
  if (pct) return (Math.round(v * 10) / 10) + '%';
  if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString('en-US');
  return String(Math.round(v * 10) / 10);
}
// Core feed (sports.core.api …/seasons/{y}/types/2/athletes/{id}/statistics)
// carries league ranks next to each value; flattened to cat → name → entry.
function _plCore(data) {
  var out = {};
  var cats = data && data.splits && data.splits.categories;
  (cats || []).forEach(function (c) {
    var m = out[c.name] || (out[c.name] = {});
    (c.stats || []).forEach(function (s) {
      if (!s || !s.name) return;
      m[s.name] = { value: _plNum(s.value), display: s.displayValue || null, rank: _plNum(s.rank), rankDisplay: s.rankDisplayValue || null };
    });
  });
  return out;
}
function _plCorePick(core, cat, names) {
  var c = core && core[cat];
  if (!c) return null;
  for (var i = 0; i < names.length; i++) if (c[names[i]]) return c[names[i]];
  return null;
}
function _plRoleFromDepth(depth, athleteId) {
  var best = null;
  (depth && (depth.depthchart || depth.items) || []).forEach(function (form) {
    var pos = form && form.positions;
    if (!pos) return;
    Object.keys(pos).forEach(function (k) {
      var slot = pos[k] || {};
      var list = slot.athletes || [];
      for (var i = 0; i < list.length; i++) {
        var a = list[i] || {};
        var aid = a.id != null ? String(a.id) : String((a.athlete && a.athlete.id) || '');
        if (aid !== String(athleteId)) continue;
        if (!best || i < best.idx) {
          var top = list[0] || {};
          best = { idx: i, pos: (slot.position && (slot.position.abbreviation || slot.position.name)) || k.toUpperCase(), ahead: i > 0 ? (top.displayName || top.fullName || (top.athlete && top.athlete.displayName) || null) : null };
        }
        break;
      }
    });
  });
  return best;
}
function _plOrdinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

async function _playerProfile(req, res, path, league) {
  const id = String(req.query.id || '').replace(/[^0-9]/g, '');
  if (!id) { res.status(400).json({ error: 'Missing id' }); return; }
  const common = 'https://site.web.api.espn.com/apis/common/v3/sports/' + path + '/athletes/' + id;
  const nowYear = _plSeasonYear();
  const first = await Promise.all([
    _tpGetJson(common),
    _tpGetJson(common + '/stats'),
    _tpGetJson('https://site.api.espn.com/apis/site/v2/sports/' + path + '/teams?limit=400')
  ]);
  const bioRaw = first[0], careerRaw = first[1], teamsRaw = first[2];
  const a = (bioRaw && (bioRaw.athlete || bioRaw)) || {};
  if (!a.displayName && !a.fullName) { res.status(502).json({ error: 'No player data from ESPN' }); return; }

  // Team lookup by id, from the league team list (names + colors).
  const teamById = {};
  const tl = (((teamsRaw && teamsRaw.sports) || [])[0] || {}).leagues;
  (((tl || [])[0] || {}).teams || []).forEach(function (t) {
    const tm = t.team || {};
    if (tm.id != null) teamById[String(tm.id)] = { id: String(tm.id), name: tm.displayName || tm.name, short: tm.shortDisplayName || tm.name, abbr: tm.abbreviation, color: _hex(tm.color), alt: _hex(tm.alternateColor) };
  });
  const career = _plCareer(careerRaw);
  Object.keys(career.teams).forEach(function (k) { if (!teamById[k]) teamById[k] = { id: k, name: career.teams[k].name, short: career.teams[k].name, abbr: career.teams[k].abbr }; });

  const pos = (a.position && (a.position.abbreviation || a.position.name)) || null;
  const group = _plGroup(pos);
  const def = _PL_DEFS[group] || null;
  const tm = a.team || {};
  const teamId = tm.id != null ? String(tm.id) : null;
  const team = teamId ? Object.assign({}, teamById[teamId] || {}, { id: teamId, name: tm.displayName || (teamById[teamId] || {}).name || null, abbr: tm.abbreviation || (teamById[teamId] || {}).abbr || null, color: _hex(tm.color) || (teamById[teamId] || {}).color || null }) : null;

  // Which season is "where he stands": this one once he has real volume in
  // it, otherwise the latest season where he did.
  const years = Object.keys(career.byYear).map(Number).sort(function (x, y) { return x - y; });
  let standYear = null;
  if (def) {
    for (let i = years.length - 1; i >= 0; i--) {
      const v = _plPick(career.byYear[years[i]], def.volume.cat, def.volume.names);
      if (v != null && v >= def.volume.min) { standYear = years[i]; break; }
    }
  }
  const second = await Promise.all([
    standYear ? _tpGetJson('https://sports.core.api.espn.com/v2/sports/' + path.replace('football/', 'football/leagues/') + '/seasons/' + standYear + '/types/2/athletes/' + id + '/statistics') : null,
    teamId ? _tpGetJson('https://site.api.espn.com/apis/site/v2/sports/' + path + '/teams/' + teamId + '/depthcharts') : null
  ]);
  const core = _plCore(second[0]);
  const depth = _plRoleFromDepth(second[1], id);

  // Where he stands: four tiles, value + league rank when the core feed has it.
  let stand = null;
  if (def && standYear) {
    const row = career.byYear[standYear];
    const tile = function (t) {
      if (t.pair) {
        const a1 = _plCorePick(core, t.pair[0].cat, t.pair[0].names), b1 = _plCorePick(core, t.pair[1].cat, t.pair[1].names);
        const av = a1 && a1.value != null ? a1.value : _plPick(row, t.pair[0].cat, t.pair[0].names);
        const bv = b1 && b1.value != null ? b1.value : _plPick(row, t.pair[1].cat, t.pair[1].names);
        return { label: t.label, value: (av == null ? '—' : Math.round(av)) + '–' + (bv == null ? '—' : Math.round(bv)), rank: a1 && a1.rank ? a1.rank : null, rankDisplay: a1 && a1.rankDisplay ? a1.rankDisplay : null };
      }
      const c = _plCorePick(core, t.cat, t.names);
      const v = c && c.value != null ? c.value : _plPick(row, t.cat, t.names);
      return { label: t.label, value: _plFmt(v, t.pct), rank: c && c.rank ? c.rank : null, rankDisplay: c && c.rankDisplay ? c.rankDisplay : null };
    };
    stand = { year: standYear, current: standYear === nowYear, tiles: def.tiles.map(tile) };
  }

  // Career arc: one headline number per season, plus the team timeline.
  let arc = null;
  if (def) {
    const seasons = years.map(function (y) {
      const r = career.byYear[y];
      const tid = r.teamIds[r.teamIds.length - 1] || null;
      return { year: y, value: _plPick(r, def.arc.cat, def.arc.names), extra: def.extra ? _plPick(r, def.extra.cat, def.extra.names) : null, teamId: tid, teamAbbr: tid && teamById[tid] ? teamById[tid].abbr : null, partial: y === nowYear };
    }).filter(function (s) { return s.value != null; });
    const stints = [];
    years.forEach(function (y) {
      const r = career.byYear[y];
      r.teamIds.forEach(function (tid) {
        const last = stints[stints.length - 1];
        if (last && last.teamId === tid) { last.to = y; return; }
        const t = teamById[tid] || {};
        stints.push({ teamId: tid, name: t.name || null, short: t.short || t.name || null, abbr: t.abbr || null, from: y, to: y });
      });
    });
    const totals = def.totals.map(function (t) {
      if (t.pair) {
        const x = _plPick(career.totals, t.pair[0].cat, t.pair[0].names), z = _plPick(career.totals, t.pair[1].cat, t.pair[1].names);
        return { label: t.label, value: (x == null ? '—' : Math.round(x)) + '–' + (z == null ? '—' : Math.round(z)) };
      }
      return { label: t.label, value: _plFmt(_plPick(career.totals, t.cat, t.names), t.pct) };
    });
    arc = { label: def.arc.label, short: def.arc.short, extraShort: def.extra ? def.extra.short : null, seasons: seasons, stints: stints, totals: totals };
  }

  // Draft: the structured object when present, else ESPN's display string
  // ("2022: Rd 7, Pk 262 (SF)").
  let draft = null;
  if (a.draft && (a.draft.year || a.draft.round)) {
    draft = { year: _plNum(a.draft.year), round: _plNum(a.draft.round), pick: _plNum(a.draft.selection || a.draft.pick), team: a.draft.team ? (a.draft.team.displayName || a.draft.team.abbreviation || null) : null };
  } else if (a.displayDraft) {
    const m = String(a.displayDraft).match(/(\d{4}).*?Rd\s*(\d+).*?Pk\s*(\d+)(?:\s*\(([^)]+)\))?/i);
    if (m) draft = { year: _plNum(m[1]), round: _plNum(m[2]), pick: _plNum(m[3]), team: m[4] || null };
  }
  if (draft && draft.team && teamById) {
    const hit = Object.keys(teamById).map(function (k) { return teamById[k]; }).filter(function (t) { return t.abbr === draft.team; })[0];
    if (hit) draft.team = hit.name;
  }

  // Experience: ESPN's own label, else seasons since the draft, else seasons played.
  let season = null;
  const dx = a.displayExperience || (a.experience && a.experience.displayValue) || null;
  const dxm = dx ? String(dx).match(/(\d+)/) : null;
  if (dxm) season = _plOrdinal(Number(dxm[1]));
  else if (a.experience && a.experience.years != null) season = _plOrdinal(Number(a.experience.years) + 1);
  else if (draft && draft.year) season = _plOrdinal(nowYear - draft.year + 1);
  else if (years.length) season = _plOrdinal(years.length);

  // Notables, all derived from the data above — no invented facts.
  const notable = [];
  if (draft && draft.pick) {
    notable.push({ title: draft.round === 1 ? 'First-round pick' : 'Pick ' + draft.pick + ' of the ' + draft.year + ' draft', detail: (draft.round === 1 ? 'No. ' + draft.pick + ' overall in ' + draft.year : 'Round ' + draft.round) + (draft.team ? ' · ' + draft.team : '') });
  } else if (years.length) {
    notable.push({ title: 'Went undrafted', detail: 'Made it to the NFL without being drafted' });
  }
  if (arc && arc.seasons.length > 1) {
    const done = arc.seasons.filter(function (s) { return !s.partial; });
    const bestS = (done.length ? done : arc.seasons).slice().sort(function (x, y) { return y.value - x.value; })[0];
    if (bestS) notable.push({ title: 'Best season · ' + bestS.year, detail: _plFmt(bestS.value) + ' ' + arc.short + (bestS.extra != null ? ' · ' + _plFmt(bestS.extra) + ' ' + arc.extraShort : '') + (bestS.teamAbbr ? ' · ' + bestS.teamAbbr : '') });
  }
  if (arc && arc.stints.length) {
    const names = [];
    arc.stints.forEach(function (s) { if (s.short && names.indexOf(s.short) === -1) names.push(s.short); });
    if (names.length === 1) notable.push({ title: 'One-team career', detail: 'With ' + (arc.stints[0].name || names[0]) + ' since ' + arc.stints[0].from });
    else if (names.length > 1) notable.push({ title: names.length + ' teams', detail: names.join(' → ') });
  }

  const inj = (a.injuries || [])[0];
  const status = inj && (inj.status || (inj.type && inj.type.description)) ? String(inj.status || inj.type.description) : null;
  const college = a.college ? (a.college.shortName || a.college.name || null) : null;

  const result = {
    id: id,
    name: a.displayName || a.fullName,
    first: a.firstName || null,
    last: a.lastName || null,
    jersey: a.jersey || null,
    pos: pos,
    posName: (a.position && a.position.displayName) || null,
    group: group,
    team: team,
    headshot: (a.headshot && a.headshot.href) || null,
    age: a.age != null ? a.age : null,
    height: a.displayHeight || null,
    weight: a.displayWeight || null,
    college: college,
    draft: draft,
    season: season,
    status: status,
    role: depth ? { pos: depth.pos, depth: depth.idx + 1, ahead: depth.ahead } : null,
    stand: stand,
    arc: arc,
    notable: notable
  };
  if (req.query.debug) {
    result.debug = {
      bioKeys: bioRaw ? Object.keys(a) : null,
      careerCats: careerRaw ? (careerRaw.categories || []).map(function (c) { return { name: c.name, names: c.names, rows: (c.statistics || []).length }; }) : null,
      careerTopKeys: careerRaw ? Object.keys(careerRaw) : null,
      coreCats: second[0] && second[0].splits ? (second[0].splits.categories || []).map(function (c) { return c.name; }) : null,
      coreSample: second[0] && second[0].splits && second[0].splits.categories && second[0].splits.categories[0] ? JSON.stringify(second[0].splits.categories[0].stats && second[0].splits.categories[0].stats[0]) : null,
      depthKeys: second[1] ? Object.keys(second[1]) : null,
      standYear: standYear, nowYear: nowYear
    };
  }
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).json(result);
}
