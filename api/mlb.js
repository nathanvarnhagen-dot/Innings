// Vercel Serverless Function — GET /api/mlb?mode=schedule&date=YYYY-MM-DD
//                               GET /api/mlb?mode=boxscore&gamePk=<id>
// Proxies the public MLB Stats API (statsapi.mlb.com, no key required) so
// the browser doesn't have to fetch it directly, and trims the response
// down to what a memory card actually needs.

module.exports = async function handler(req, res) {
  const mode = req.query.mode;

  try {
    if (mode === 'schedule') {
      const date = req.query.date;
      if (!date) { res.status(400).json({ error: 'Missing date' }); return; }
      const url = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=' + encodeURIComponent(date);
      const r = await fetch(url);
      const data = await r.json();
      const games = [];
      (data.dates || []).forEach(function (d) {
        (d.games || []).forEach(function (g) {
          games.push({
            gamePk: g.gamePk,
            status: g.status && g.status.detailedState,
            away: g.teams && g.teams.away && g.teams.away.team && g.teams.away.team.name,
            home: g.teams && g.teams.home && g.teams.home.team && g.teams.home.team.name,
            awayScore: g.teams && g.teams.away ? g.teams.away.score : null,
            homeScore: g.teams && g.teams.home ? g.teams.home.score : null,
            venue: g.venue && g.venue.name
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
      const url = 'https://statsapi.mlb.com/api/v1.1/game/' + encodeURIComponent(gamePk) + '/feed/live';
      const r = await fetch(url);
      const data = await r.json();
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      res.status(200).json(summarize(data));
      return;
    }

    res.status(400).json({ error: 'Unknown mode — use schedule or boxscore' });
  } catch (err) {
    res.status(500).json({ error: 'MLB lookup failed' });
  }
};

function summarize(data) {
  var gameData = data.gameData || {};
  var liveData = data.liveData || {};
  var linescore = liveData.linescore || {};
  var teams = gameData.teams || {};
  var decisions = liveData.decisions || {};

  var innings = (linescore.innings || []).map(function (inn) {
    return {
      num: inn.num,
      away: inn.away ? inn.away.runs : null,
      home: inn.home ? inn.home.runs : null
    };
  });

  var homeRuns = [];
  var allPlays = (liveData.plays && liveData.plays.allPlays) || [];
  allPlays.forEach(function (play) {
    if (play.result && play.result.eventType === 'home_run') {
      homeRuns.push({
        description: play.result.description,
        batter: play.matchup && play.matchup.batter && play.matchup.batter.fullName
      });
    }
  });

  return {
    away: teams.away && teams.away.name,
    home: teams.home && teams.home.name,
    awayScore: linescore.teams && linescore.teams.away ? linescore.teams.away.runs : null,
    homeScore: linescore.teams && linescore.teams.home ? linescore.teams.home.runs : null,
    innings: innings,
    venue: gameData.venue && gameData.venue.name,
    date: gameData.datetime && gameData.datetime.officialDate,
    status: gameData.status && gameData.status.detailedState,
    winningPitcher: decisions.winner && decisions.winner.fullName,
    losingPitcher: decisions.loser && decisions.loser.fullName,
    savePitcher: decisions.save && decisions.save.fullName,
    homeRuns: homeRuns.slice(0, 10)
  };
}
