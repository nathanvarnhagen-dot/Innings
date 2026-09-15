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
            venue: g.venue && g.venue.name,
            startTime: g.gameDate || null
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
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      res.status(200).json(summarize(data, gamePk));
      return;
    }

    if (mode === 'pregame') {
      const gamePk = req.query.gamePk;
      if (!gamePk) { res.status(400).json({ error: 'Missing gamePk' }); return; }
      const url = 'https://statsapi.mlb.com/api/v1.1/game/' + encodeURIComponent(gamePk) + '/feed/live';
      const r = await fetch(url);
      const data = await r.json();
      const result = await summarizePregame(data);
      res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate');
      res.status(200).json(result);
      return;
    }

    if (mode === 'standings') {
      const season = req.query.season || new Date().getFullYear();
      const url = 'https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=' + encodeURIComponent(season) + '&standingsTypes=regularSeason';
      const r = await fetch(url);
      const data = await r.json();
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      res.status(200).json(summarizeStandings(data));
      return;
    }

    if (mode === 'teams') {
      const url = 'https://statsapi.mlb.com/api/v1/teams?sportId=1';
      const r = await fetch(url);
      const data = await r.json();
      const teams = (data.teams || []).map(function (t) {
        return { id: t.id, name: t.name };
      }).filter(function (t) { return t.name; }).sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
      res.status(200).json({ teams: teams });
      return;
    }

    res.status(400).json({ error: 'Unknown mode — use schedule, boxscore, pregame, standings, or teams' });
  } catch (err) {
    res.status(500).json({ error: 'MLB lookup failed' });
  }
};

function summarize(data, gamePk) {
  var gameData = data.gameData || {};
  var liveData = data.liveData || {};
  var linescore = liveData.linescore || {};
  var teams = gameData.teams || {};
  var decisions = liveData.decisions || {};
  var boxTeams = (liveData.boxscore && liveData.boxscore.teams) || {};
  var abstractState = (gameData.status && gameData.status.abstractGameState) || null;

  var innings = (linescore.innings || []).map(function (inn) {
    return {
      num: inn.num != null ? inn.num : null,
      away: (inn.away && inn.away.runs != null) ? inn.away.runs : null,
      home: (inn.home && inn.home.runs != null) ? inn.home.runs : null
    };
  });

  var homeRuns = [];
  var allPlays = (liveData.plays && liveData.plays.allPlays) || [];
  allPlays.forEach(function (play) {
    if (play.result && play.result.eventType === 'home_run') {
      homeRuns.push({
        description: play.result.description || null,
        batter: (play.matchup && play.matchup.batter && play.matchup.batter.fullName) || null
      });
    }
  });

  // ── Live situation + current matchup — only meaningful mid-game, so
  // both stay null outside abstractGameState 'Live' (a Preview game has
  // no real count/baserunners yet; a Final game's linescore.offense is
  // whatever it was on the last out, not worth presenting as "current").
  // Pitcher/batter season lines are pulled from the same
  // boxscore.teams.<side>.players dict the pregame endpoint already
  // reads — same confidence caveat as noted there: reliable for
  // established players, occasionally sparse for very recent call-ups.
  var situation = null;
  var matchup = null;
  if (abstractState === 'Live') {
    var offense = linescore.offense || {};
    var defense = linescore.defense || {};
    situation = {
      balls: linescore.balls != null ? linescore.balls : null,
      strikes: linescore.strikes != null ? linescore.strikes : null,
      outs: linescore.outs != null ? linescore.outs : null,
      inning: linescore.currentInning || null,
      half: linescore.isTopInning ? 'top' : 'bottom',
      bases: { first: !!offense.first, second: !!offense.second, third: !!offense.third }
    };
    matchup = {
      pitcher: defense.pitcher ? _liveParticipant(defense.pitcher, boxTeams, 'pitching') : null,
      batter: offense.batter ? _liveParticipant(offense.batter, boxTeams, 'batting') : null
    };
  }

  // ── Recent plays — last 5 plays with a completed description, most
  // recent first. Shown for Final too (a short recap), not just Live.
  var recentPlays = [];
  if (abstractState === 'Live' || abstractState === 'Final') {
    var completed = allPlays.filter(function (p) { return p.result && p.result.description; });
    recentPlays = completed.slice(-5).reverse().map(function (p) {
      return {
        inning: (p.about && p.about.inning) || null,
        half: (p.about && p.about.isTopInning) ? 'top' : 'bottom',
        text: p.result.description
      };
    });
  }

  return {
    gamePk: (gameData.game && gameData.game.pk) || (gamePk ? Number(gamePk) : null),
    away: (teams.away && teams.away.name) || null,
    home: (teams.home && teams.home.name) || null,
    awayScore: (linescore.teams && linescore.teams.away && linescore.teams.away.runs != null) ? linescore.teams.away.runs : null,
    homeScore: (linescore.teams && linescore.teams.home && linescore.teams.home.runs != null) ? linescore.teams.home.runs : null,
    innings: innings,
    venue: (gameData.venue && gameData.venue.name) || null,
    date: (gameData.datetime && gameData.datetime.officialDate) || null,
    status: (gameData.status && gameData.status.detailedState) || null,
    winningPitcher: (decisions.winner && decisions.winner.fullName) || null,
    losingPitcher: (decisions.loser && decisions.loser.fullName) || null,
    savePitcher: (decisions.save && decisions.save.fullName) || null,
    homeRuns: homeRuns.slice(0, 10),
    situation: situation,
    matchup: matchup,
    recentPlays: recentPlays
  };
}

function _liveParticipant(person, boxTeams, group) {
  var pid = 'ID' + person.id;
  var obj = (boxTeams.away && boxTeams.away.players && boxTeams.away.players[pid])
    || (boxTeams.home && boxTeams.home.players && boxTeams.home.players[pid]);
  var stat = obj && obj.seasonStats && obj.seasonStats[group];
  var line = null;
  if (stat) {
    line = group === 'pitching'
      ? (stat.era != null ? stat.era + ' ERA' : '') + (stat.strikeOuts != null ? ' · ' + stat.strikeOuts + ' K' : '')
      : (stat.avg || '.000') + ' / ' + (stat.obp || '.000') + ' / ' + (stat.slg || '.000');
  }
  return { name: person.fullName, id: person.id, line: line || null };
}

// ── PREGAME CHEAT SHEET — probable pitcher + season stats for the "feat"
// block come from the feed/live payload (same fetch as boxscore mode), and
// the confirmed batting order once MLB posts it (usually 1-3hrs before
// game time) reads from there too. But pregame — before the lineup is
// set — feed/live's boxscore.teams.<side>.players list turned out to be
// too sparse to trust for hitting lines: real regulars were coming back
// with seasonStats.batting all zeroed out, not just bench/September
// call-ups. So the "lineup not posted yet" fallback instead makes one
// extra call per side to the team roster endpoint with hydrated season
// hitting stats, which is reliable regardless of game/lineup timing.
//
// Confidence note: the feed/live shape itself (gameData.probablePitchers,
// boxscore.teams.<side>.battingOrder, seasonStats.pitching) is
// well-established and matches what this file's existing boxscore mode
// already relies on for the same endpoint. The roster+hydrate endpoint
// used for the fallback (teams/{id}/roster/active?hydrate=person(stats(...)))
// is a standard, widely-documented pattern but hasn't been confirmed
// against a live response in this session — if projected lineups come
// back empty, that's the first thing to check.
async function summarizePregame(data) {
  var gameData = data.gameData || {};
  var liveData = data.liveData || {};
  var boxTeams = (liveData.boxscore && liveData.boxscore.teams) || {};
  var teams = gameData.teams || {};
  var probable = gameData.probablePitchers || {};
  var season = (gameData.game && gameData.game.season) || null;

  var results = await Promise.all([
    _pregameSide(teams.away, boxTeams.away, probable.away, season),
    _pregameSide(teams.home, boxTeams.home, probable.home, season)
  ]);
  var away = results[0], home = results[1];

  if (!away || !home) return { error: 'No pregame data available' };
  return { away: away, home: home };
}

async function _pregameSide(team, boxTeam, probablePitcher, season) {
  if (!team || !boxTeam) return null;
  var playersObj = boxTeam.players || {};
  var battingOrder = boxTeam.battingOrder || [];

  var feat = null;
  if (probablePitcher && probablePitcher.id) {
    var pObj = playersObj['ID' + probablePitcher.id];
    var seasonP = pObj && pObj.seasonStats && pObj.seasonStats.pitching;
    feat = {
      name: probablePitcher.fullName || (pObj && pObj.person && pObj.person.fullName) || 'TBD',
      role: 'Probable SP',
      age: (pObj && pObj.person && pObj.person.currentAge) || null,
      id: probablePitcher.id,
      line: seasonP && seasonP.era != null
        ? (seasonP.era + ' ERA · ' + (seasonP.wins || 0) + '-' + (seasonP.losses || 0) + ' · ' + (seasonP.strikeOuts || 0) + ' K')
        : 'No stats yet this season'
    };
  }

  // Hydrated season hitting stats straight from the team roster — used for
  // BOTH branches below, since feed/live's own pregame batting numbers
  // turned out unreliable even for players already in a confirmed lineup,
  // not just the projected-roster fallback.
  var roster = await _teamHittingRoster(team.id, season);
  var statsById = {};
  roster.forEach(function (h) { statsById[h.person.id] = h; });

  var projected = !battingOrder.length;
  var rows;
  if (!projected) {
    rows = battingOrder.map(function (id) {
      var hydrated = statsById[id];
      if (hydrated) return _rowFrom(hydrated.person, hydrated.position, hydrated.stat);
      return _pregameRowFromFeed(playersObj['ID' + id]); // e.g. same-day activation, not yet on the roster snapshot
    }).filter(Boolean);
  } else if (roster.length) {
    var hitters = roster.slice().sort(function (a, b) {
      return Number(b.stat.plateAppearances || 0) - Number(a.stat.plateAppearances || 0);
    });
    rows = hitters.slice(0, 9).map(function (h) { return _rowFrom(h.person, h.position, h.stat); });
  } else {
    rows = _fallbackRowsFromFeed(playersObj); // roster call itself failed outright — last resort
  }

  return { name: team.name, projected: projected, feat: feat, rows: rows };
}

// Real, hydrated season hitting stats straight from the team roster —
// works regardless of whether MLB has populated feed/live's pregame
// player list yet. Excludes pitchers.
async function _teamHittingRoster(teamId, season) {
  if (!teamId) return [];
  try {
    var hydrate = 'person(stats(type=season,group=hitting' + (season ? ',season=' + season : '') + '))';
    var url = 'https://statsapi.mlb.com/api/v1/teams/' + encodeURIComponent(teamId) + '/roster/active?hydrate=' + encodeURIComponent(hydrate);
    var r = await fetch(url);
    var data = await r.json();
    var roster = data.roster || [];
    return roster.filter(function (p) { return p.position && p.position.abbreviation !== 'P'; }).map(function (p) {
      var splits = p.person && p.person.stats && p.person.stats[0] && p.person.stats[0].splits;
      var stat = (splits && splits[0] && splits[0].stat) || {};
      return { person: p.person, position: p.position, stat: stat };
    });
  } catch (e) {
    return [];
  }
}

function _rowFrom(person, position, stat) {
  var pa = stat.plateAppearances != null ? Number(stat.plateAppearances) : 0;
  return {
    name: person.fullName,
    pos: (position && position.abbreviation) || null,
    age: person.currentAge || null,
    id: person.id,
    line: (stat.avg || '.000') + ' / ' + (stat.obp || '.000') + ' / ' + (stat.slg || '.000'),
    extra: pa ? (pa + ' PA') : null,
    pa: pa,
    ops: stat.ops != null ? Number(stat.ops) : 0
  };
}

// Original in-feed heuristic, kept only as a last-resort fallback if the
// roster+hydrate call above fails outright (network hiccup, endpoint
// shape change) — better a possibly-sparse lineup than no lineup at all.
function _fallbackRowsFromFeed(playersObj) {
  var hitters = Object.keys(playersObj).map(function (k) { return playersObj[k]; }).filter(function (p) {
    return p.position && p.position.abbreviation !== 'P' && p.seasonStats && p.seasonStats.batting;
  });
  hitters.sort(function (a, b) {
    var paA = Number((a.seasonStats.batting || {}).plateAppearances || 0);
    var paB = Number((b.seasonStats.batting || {}).plateAppearances || 0);
    return paB - paA;
  });
  return hitters.slice(0, 9).map(function (p) { return _pregameRowFromFeed(p); }).filter(Boolean);
}

function _pregameRowFromFeed(obj) {
  if (!obj || !obj.person) return null;
  var batting = (obj.seasonStats && obj.seasonStats.batting) || {};
  var avg = batting.avg || '.000';
  var obp = batting.obp || '.000';
  var slg = batting.slg || '.000';
  var pa = batting.plateAppearances != null ? Number(batting.plateAppearances) : 0;
  return {
    name: obj.person.fullName,
    pos: (obj.position && obj.position.abbreviation) || null,
    age: obj.person.currentAge || null,
    id: obj.person.id,
    line: avg + ' / ' + obp + ' / ' + slg,
    extra: pa ? (pa + ' PA') : null,
    pa: pa,
    ops: batting.ops != null ? Number(batting.ops) : 0
  };
}

// ── PLAYOFF PICTURE — division standings, wild card race, and bracket
// seeding, all computed from raw win/loss records rather than trusting
// the Stats API's own divisionRank/wildCardRank fields. Those fields
// exist on the real response but their exact semantics near the wild
// card cutline weren't verified against a live response in this
// session, so seeding is derived independently here from wins/losses,
// which every standings response reliably includes. If team names or
// division names come back oddly formatted, that's the one part of
// this endpoint's shape that's assumed rather than confirmed.
function _winPct(t) { return (t.w + t.l) > 0 ? t.w / (t.w + t.l) : 0; }

function summarizeStandings(data) {
  var divisions = [];
  (data.records || []).forEach(function (rec) {
    var leagueId = rec.league && rec.league.id;
    var league = leagueId === 103 ? 'al' : (leagueId === 104 ? 'nl' : null);
    if (!league) return;
    var divName = ((rec.division && rec.division.name) || '').replace('American League', 'AL').replace('National League', 'NL');
    var teams = (rec.teamRecords || []).map(function (tr) {
      return { name: (tr.team && tr.team.name) || '', w: tr.wins != null ? tr.wins : 0, l: tr.losses != null ? tr.losses : 0 };
    });
    teams.sort(function (a, b) { return _winPct(b) - _winPct(a); });
    divisions.push({ league: league, name: divName, teams: teams });
  });

  var result = {};
  ['al', 'nl'].forEach(function (leagueKey) {
    var leagueDivisions = divisions.filter(function (d) { return d.league === leagueKey; });
    if (!leagueDivisions.length) return;

    var divWinners = leagueDivisions.map(function (d) { return Object.assign({}, d.teams[0], { division: d.name }); });
    divWinners.sort(function (a, b) { return _winPct(b) - _winPct(a); });

    var nonWinners = [];
    leagueDivisions.forEach(function (d) {
      d.teams.slice(1).forEach(function (t) { nonWinners.push(Object.assign({}, t, { division: d.name })); });
    });
    nonWinners.sort(function (a, b) { return _winPct(b) - _winPct(a); });
    var wildCards = nonWinners.slice(0, 3);
    var chasers = nonWinners.slice(3, 5);
    var wcNames = {}; wildCards.forEach(function (t) { wcNames[t.name] = true; });

    var seeds = divWinners.map(function (t, i) { return { seed: i + 1, team: _teamShortName(t.name), rec: t.w + '-' + t.l, bye: i < 2 }; })
      .concat(wildCards.map(function (t, i) { return { seed: i + 4, team: _teamShortName(t.name), rec: t.w + '-' + t.l }; }));

    result[leagueKey] = {
      seeds: seeds,
      wildcardRace: wildCards.map(function (t) { return { team: _teamShortName(t.name), w: t.w, l: t.l, status: 'in' }; })
        .concat(chasers.map(function (t) { return { team: _teamShortName(t.name), w: t.w, l: t.l, status: 'out' }; })),
      divisions: leagueDivisions.map(function (d) {
        return {
          name: d.name,
          teams: d.teams.map(function (t) {
            return { name: _teamShortName(t.name), w: t.w, l: t.l, tag: (t.name === d.teams[0].name) ? 'div' : (wcNames[t.name] ? 'wc' : null) };
          })
        };
      })
    };
  });
  return result;
}

// Same short-nickname heuristic the game recap already uses — last word
// of the full team name ("Tampa Bay Rays" -> "Rays") — since there's no
// abbreviation field being carried through this endpoint either. One
// real collision confirmed by testing against actual MLB team names:
// "Boston Red Sox" and "Chicago White Sox" both end in "Sox", so those
// two are special-cased to keep both words.
function _teamShortName(name) {
  if (!name) return '';
  if (/Red Sox$/.test(name)) return 'Red Sox';
  if (/White Sox$/.test(name)) return 'White Sox';
  var parts = name.trim().split(' ');
  return parts[parts.length - 1];
}
