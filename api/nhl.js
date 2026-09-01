// Vercel Serverless Function — GET /api/nhl?mode=schedule&date=YYYY-MM-DD
//                               GET /api/nhl?mode=boxscore&gamePk=<id>
// Same pattern as api/mlb.js: proxies a real, official, free public API
// (api-web.nhle.com, no key required — the same one NHL.com itself uses)
// and trims the response down to what a memory card needs.
//
// Confidence note: the endpoint itself is well-established and official,
// same tier as the MLB one. The exact field names below are built from
// documented/community knowledge of this API rather than a live-tested
// reference the way api/mlb.js was (that one already existed and worked;
// this one doesn't have that track record yet). Worth confirming against
// a real game day before fully trusting it.
module.exports = async function handler(req, res) {
  const mode = req.query.mode;
  try {
    if (mode === 'schedule') {
      const date = req.query.date;
      if (!date) { res.status(400).json({ error: 'Missing date' }); return; }
      const url = 'https://api-web.nhle.com/v1/schedule/' + encodeURIComponent(date);
      const r = await fetch(url);
      const data = await r.json();
      const games = [];
      (data.gameWeek || []).forEach(function (day) {
        if (day.date !== date) return;
        (day.games || []).forEach(function (g) {
          var away = g.awayTeam || {};
          var home = g.homeTeam || {};
          games.push({
            gamePk: g.id,
            status: (g.gameState === 'OFF' || g.gameState === 'FINAL') ? 'Final' : (g.gameState === 'LIVE' ? 'Live' : 'Scheduled'),
            away: teamName(away),
            home: teamName(home),
            awayScore: away.score != null ? away.score : null,
            homeScore: home.score != null ? home.score : null,
            venue: (g.venue && (g.venue.default || g.venue)) || null
          });
        });
      });
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      res.status(200).json({ games: games });
      return;
    }
    if (mode === 'boxscore') {
      const gamePk = req.query.gamePk;
      if (!gamePk) { res.status(400).json({ error: 'Missing gamePk' }); return; }
      const url = 'https://api-web.nhle.com/v1/gamecenter/' + encodeURIComponent(gamePk) + '/boxscore';
      const r = await fetch(url);
      const data = await r.json();
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      res.status(200).json(summarize(data, gamePk));
      return;
    }
    res.status(400).json({ error: 'Unknown mode — use schedule or boxscore' });
  } catch (err) {
    res.status(500).json({ error: 'NHL lookup failed' });
  }
};

function teamName(team) {
  if (!team) return null;
  if (team.name && team.name.default) return team.name.default;
  if (typeof team.name === 'string') return team.name;
  return team.abbrev || null;
}

// Lower confidence than anything else in this file — the NHL boxscore
// response nests things a few different ways depending on game state, and
// this tries the paths that seemed most likely from documentation rather
// than a confirmed live example. Returns an empty array rather than
// guessing wrong if none of these paths match.
function extractPeriods(data) {
  var byPeriod = (data.boxscore && data.boxscore.linescore && data.boxscore.linescore.byPeriod)
    || (data.linescore && data.linescore.byPeriod)
    || (data.summary && data.summary.linescore && data.summary.linescore.byPeriod)
    || [];
  if (!byPeriod.length) return [];
  return byPeriod.map(function (p, i) {
    var num = p.period != null ? p.period : (i + 1);
    return {
      label: num <= 3 ? String(num) : 'OT' + (num > 4 ? (num - 3) : ''),
      away: p.away != null ? p.away : (p.awayScore != null ? p.awayScore : null),
      home: p.home != null ? p.home : (p.homeScore != null ? p.homeScore : null)
    };
  });
}

// Same confidence caveat as above — tries the most likely path for a
// period-by-period goal list and gives up cleanly if it's not there.
function extractGoalHighlights(data) {
  var scoring = (data.summary && data.summary.scoring) || [];
  var goals = [];
  try {
    scoring.forEach(function (period) {
      (period.goals || []).forEach(function (g) {
        var scorer = (g.name && g.name.default) || g.playerName || null;
        if (scorer) goals.push({ emoji: '🏒', text: scorer + ' goal' + (g.strength && g.strength !== 'ev' ? ' (' + g.strength.toUpperCase() + ')' : '') });
      });
    });
  } catch (e) {
    // Malformed goal data shouldn't take down the whole box score.
  }
  return goals.slice(-4);
}

function summarize(data, gamePk) {
  var away = data.awayTeam || {};
  var home = data.homeTeam || {};
  return {
    gamePk: data.id || (gamePk ? Number(gamePk) : null),
    away: teamName(away),
    home: teamName(home),
    awayScore: away.score != null ? away.score : null,
    homeScore: home.score != null ? home.score : null,
    innings: extractPeriods(data),
    venue: (data.venue && (data.venue.default || data.venue)) || null,
    date: data.gameDate || null,
    status: (data.gameState === 'OFF' || data.gameState === 'FINAL') ? 'Final' : (data.gameState === 'LIVE' ? 'Live' : 'Scheduled'),
    winningPitcher: null,
    losingPitcher: null,
    savePitcher: null,
    homeRuns: [],
    highlights: extractGoalHighlights(data)
  };
}
