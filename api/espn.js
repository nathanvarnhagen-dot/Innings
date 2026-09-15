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
    res.status(400).json({ error: 'Unknown mode — use schedule, boxscore, pregame, standings, or teams' });
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
    situation: FOOTBALL_LEAGUES[league] ? extractFootballSituation(data, awayComp, homeComp) : null,
    recentPlays: FOOTBALL_LEAGUES[league] ? extractFootballPlays(data) : []
  };
}

// ── FOOTBALL FIELD POSITION + PLAY-BY-PLAY (NFL + CFB) — mirrors what
// mlb.js does with balls/strikes/bases/recentPlays for baseball, using
// whatever field-position data ESPN's summary endpoint carries for a
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

  if (down == null && !possessionText) return null;

  var homeAbbr = (homeComp.team && homeComp.team.abbreviation) || null;
  var isHomeBall = possessionTeamAbbr && homeAbbr && possessionTeamAbbr === homeAbbr;

  return {
    down: down != null ? down : null,
    distance: distance != null ? distance : null,
    possessionText: possessionText || null,
    yardLine: yardLine != null ? yardLine : null,
    homeAway: possessionTeamAbbr ? (isHomeBall ? 'home' : 'away') : null,
    team: possessionTeamAbbr ? {
      abbreviation: possessionTeamAbbr,
      color: (currentDrive && currentDrive.team && currentDrive.team.color) ? ('#' + currentDrive.team.color) : null
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
  var downLabels = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };
  var plays = [];
  drives.forEach(function (drive) {
    if (plays.length >= 5) return;
    (drive.plays || []).slice().reverse().forEach(function (p) {
      if (plays.length >= 5 || !p || !p.text) return;
      var tag = '';
      if (p.period && p.period.number) tag += 'Q' + p.period.number + ' ';
      if (p.start && p.start.down != null && p.start.distance != null) {
        tag += (downLabels[p.start.down] || (p.start.down + 'th')) + '&' + p.start.distance;
      }
      plays.push({ tag: tag.trim(), text: p.text });
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
