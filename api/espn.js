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
  nwsl: 'soccer/usa.nwsl'
};

module.exports = async function handler(req, res) {
  const league = req.query.league;
  const mode = req.query.mode;
  const path = LEAGUE_PATHS[league];
  if (!path) { res.status(400).json({ error: 'Unknown league — use nfl, cfb, nba, wnba, mls, or nwsl' }); return; }
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
    res.status(400).json({ error: 'Unknown mode — use schedule, boxscore, or pregame' });
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
    venue: (parts.comp.venue && parts.comp.venue.fullName) || null
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
    highlights: extractHighlights(league, data)
  };
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
