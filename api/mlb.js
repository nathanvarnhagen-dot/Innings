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
        text: p.result.description,
        // atBatIndex is a standard, stable field on every MLB play object
        // (not an endpoint-specific guess) — used as the reaction key so
        // a specific play can be reacted to across refreshes without its
        // identity shifting as new plays are added to the feed.
        atBatIndex: (p.about && p.about.atBatIndex != null) ? p.about.atBatIndex : null
      };
    });
  }

  // ── Pitch-by-pitch strike zone for the current at-bat — same Live
  // gating as situation/matchup. Batter handedness and the batter's own
  // strike-zone top/bottom come straight off the pitch event data
  // itself (recorded fresh per at-bat by MLB, not looked up separately)
  // — this is the same coordinate data Statcast/Gameday charts use,
  // well-documented and not the kind of endpoint guesswork that's
  // burned other parts of this app. Falls back to the most recently
  // completed at-bat if there's no play currently in progress (between
  // batters), so the diagram doesn't just go blank in the gap.
  // Note: pitchSequence is built as soon as we know who's batting, even
  // with zero pitches recorded yet (the very start of a fresh at-bat,
  // 0-0 count) — the zone and a generic batter silhouette on the
  // correct side are still worth showing at that moment, using a
  // default zone size (3.5/1.5, an average MLB zone) since there's no
  // pitch yet to read this batter's actual recorded zone from.
  var pitchSequence = null;
  if (abstractState === 'Live') {
    var currentPlay = (liveData.plays && liveData.plays.currentPlay) || allPlays[allPlays.length - 1];
    if (currentPlay && currentPlay.matchup && currentPlay.matchup.batter) {
      var pitchEvents = (currentPlay.playEvents || []).filter(function (e) { return e.isPitch && e.pitchData && e.pitchData.coordinates; });
      var pitches = pitchEvents.map(function (e, i) {
        var coords = e.pitchData.coordinates || {};
        return {
          num: e.pitchNumber || (i + 1),
          px: coords.pX != null ? coords.pX : null,
          pz: coords.pZ != null ? coords.pZ : null,
          call: (e.details && e.details.call && e.details.call.description) || null,
          type: (e.details && e.details.type && e.details.type.description) || null,
          speed: e.pitchData.startSpeed != null ? Math.round(e.pitchData.startSpeed) : null
        };
      }).filter(function (p) { return p.px != null && p.pz != null; });
      var lastEvent = pitchEvents.length ? pitchEvents[pitchEvents.length - 1] : null;
      pitchSequence = {
        batter: currentPlay.matchup.batter.fullName || null,
        batterId: currentPlay.matchup.batter.id || null,
        batSide: (currentPlay.matchup.batSide && currentPlay.matchup.batSide.code) || null,
        zoneTop: (lastEvent && lastEvent.pitchData.strikeZoneTop != null) ? lastEvent.pitchData.strikeZoneTop : 3.5,
        zoneBottom: (lastEvent && lastEvent.pitchData.strikeZoneBottom != null) ? lastEvent.pitchData.strikeZoneBottom : 1.5,
        pitches: pitches
      };
    }
  }

  // ── Full traditional box score — every batter's and pitcher's actual
  // game line (not season stats, which is what the matchup section
  // above already shows). Same liveData.boxscore.teams structure this
  // file already reads for season stats, just pulling .stats (this
  // game) instead of .seasonStats. `batters`/`pitchers` arrays on each
  // team give the display order (batting order, pitching appearance
  // order); entries with no at-bat yet (bench, hasn't come in) are
  // filtered out rather than shown as a blank line.
  var boxScoreDetail = null;
  if (abstractState === 'Live' || abstractState === 'Final') {
    boxScoreDetail = {
      away: _extractTeamBoxScore(liveData.boxscore && liveData.boxscore.teams && liveData.boxscore.teams.away),
      home: _extractTeamBoxScore(liveData.boxscore && liveData.boxscore.teams && liveData.boxscore.teams.home)
    };
  }

  // ── GAME-STATE HERO (v5.40.0) — every scoring play so far, oldest
  // first, with the score AFTER the play (result.awayScore/homeScore are
  // standard fields on every allPlays entry). about.isScoringPlay is the
  // primary signal; liveData.plays.scoringPlays (an index list into
  // allPlays) is the fallback if that flag ever comes back missing.
  // Capped at the last 20 so a slugfest doesn't bloat a memory doc.
  var scoringSource = allPlays.filter(function (p) { return p.about && p.about.isScoringPlay && p.result; });
  if (!scoringSource.length) {
    scoringSource = ((liveData.plays && liveData.plays.scoringPlays) || []).map(function (i) { return allPlays[i]; })
      .filter(function (p) { return p && p.result; });
  }
  var scoringPlays = [];
  if (abstractState === 'Live' || abstractState === 'Final') {
    scoringPlays = scoringSource.slice(-20).map(function (p) {
      var evs = p.playEvents || [];
      var hit = null;
      for (var j = evs.length - 1; j >= 0; j--) { if (evs[j] && evs[j].hitData) { hit = evs[j].hitData; break; } }
      return {
        atBatIndex: (p.about && p.about.atBatIndex != null) ? p.about.atBatIndex : null,
        inning: (p.about && p.about.inning) || null,
        half: (p.about && p.about.isTopInning) ? 'top' : 'bottom',
        event: p.result.event || null,
        eventType: p.result.eventType || null,
        rbi: p.result.rbi != null ? p.result.rbi : 0,
        batter: (p.matchup && p.matchup.batter && p.matchup.batter.fullName) || null,
        text: p.result.description || null,
        awayScore: p.result.awayScore != null ? p.result.awayScore : null,
        homeScore: p.result.homeScore != null ? p.result.homeScore : null,
        distance: (hit && hit.totalDistance != null) ? Math.round(hit.totalDistance) : null
      };
    });
  }

  var decisionsDetail = null;
  var starOfGame = null;
  if (abstractState === 'Final') {
    decisionsDetail = {
      winner: _decisionPerson(decisions.winner, boxTeams, 'win'),
      loser: _decisionPerson(decisions.loser, boxTeams, 'loss'),
      save: _decisionPerson(decisions.save, boxTeams, 'save')
    };
    starOfGame = _starOfGame(liveData.boxscore, boxScoreDetail);
  }

  var lsTeams = linescore.teams || {};
  return {
    gamePk: (gameData.game && gameData.game.pk) || (gamePk ? Number(gamePk) : null),
    awayAbbr: (teams.away && teams.away.abbreviation) || null,
    homeAbbr: (teams.home && teams.home.abbreviation) || null,
    awayRecord: _teamRecord(teams.away),
    homeRecord: _teamRecord(teams.home),
    awayHits: (lsTeams.away && lsTeams.away.hits != null) ? lsTeams.away.hits : null,
    homeHits: (lsTeams.home && lsTeams.home.hits != null) ? lsTeams.home.hits : null,
    awayErrors: (lsTeams.away && lsTeams.away.errors != null) ? lsTeams.away.errors : null,
    homeErrors: (lsTeams.home && lsTeams.home.errors != null) ? lsTeams.home.errors : null,
    startTime: (gameData.datetime && gameData.datetime.dateTime) || null,
    gameState: abstractState,
    scoringPlays: scoringPlays,
    decisionsDetail: decisionsDetail,
    starOfGame: starOfGame,
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
    recentPlays: recentPlays,
    pitchSequence: pitchSequence,
    boxScoreDetail: boxScoreDetail
  };
}

function _extractTeamBoxScore(teamData) {
  if (!teamData) return { batters: [], pitchers: [] };
  var players = teamData.players || {};
  var batters = (teamData.batters || []).map(function (pid) {
    var p = players['ID' + pid];
    var b = p && p.stats && p.stats.batting;
    if (!p || !b || (b.atBats == null && b.plateAppearances == null)) return null; // hasn't actually batted yet
    // battingOrder is MLB's lineup code: "300" = 3rd spot starter,
    // "301"/"302" = the 1st/2nd player to take over that spot (pinch
    // hitter/runner or defensive change). slot = spot, sub = sequence.
    var bo = p.battingOrder != null ? Number(p.battingOrder) : NaN;
    return {
      slot: isNaN(bo) ? null : Math.floor(bo / 100),
      sub: isNaN(bo) ? null : bo % 100,
      name: p.person.fullName,
      id: p.person.id,
      pos: (p.position && p.position.abbreviation) || null,
      ab: b.atBats != null ? b.atBats : 0,
      r: b.runs != null ? b.runs : 0,
      h: b.hits != null ? b.hits : 0,
      rbi: b.rbi != null ? b.rbi : 0,
      hr: b.homeRuns != null ? b.homeRuns : 0,
      bb: b.baseOnBalls != null ? b.baseOnBalls : 0,
      so: b.strikeOuts != null ? b.strikeOuts : 0
    };
  }).filter(Boolean);
  // Lineup order with each sub directly under the spot they took over
  batters.sort(function (a, b) {
    var oa = a.slot ? a.slot * 100 + (a.sub || 0) : 99999, ob = b.slot ? b.slot * 100 + (b.sub || 0) : 99999;
    return oa - ob;
  });
  var pitchers = (teamData.pitchers || []).map(function (pid) {
    var p = players['ID' + pid];
    var s = p && p.stats && p.stats.pitching;
    if (!p || !s) return null;
    return {
      name: p.person.fullName,
      id: p.person.id,
      ip: s.inningsPitched != null ? s.inningsPitched : '0.0',
      h: s.hits != null ? s.hits : 0,
      r: s.runs != null ? s.runs : 0,
      er: s.earnedRuns != null ? s.earnedRuns : 0,
      bb: s.baseOnBalls != null ? s.baseOnBalls : 0,
      so: s.strikeOuts != null ? s.strikeOuts : 0
    };
  }).filter(Boolean);
  return { batters: batters, pitchers: pitchers };
}

// Season W-L (or save count) for a decision pitcher, read from the same
// boxscore.teams.<side>.players seasonStats this file already trusts for
// pitchers. rec stays null rather than guessing if the stat is missing.
function _decisionPerson(person, boxTeams, kind) {
  if (!person || !person.id) return null;
  var pid = 'ID' + person.id;
  var obj = (boxTeams.away && boxTeams.away.players && boxTeams.away.players[pid])
    || (boxTeams.home && boxTeams.home.players && boxTeams.home.players[pid]);
  var s = obj && obj.seasonStats && obj.seasonStats.pitching;
  var rec = null;
  if (s) {
    if (kind === 'save') rec = s.saves != null ? String(s.saves) : null;
    else if (s.wins != null && s.losses != null) rec = s.wins + '-' + s.losses;
  }
  return { name: person.fullName || null, id: person.id, rec: rec };
}

// gameData.teams.<side>.record — wins/losses live either directly on
// record or under record.leagueRecord depending on the payload; both read.
function _teamRecord(team) {
  var r = team && team.record;
  if (!r) return null;
  var w = r.wins != null ? r.wins : (r.leagueRecord && r.leagueRecord.wins);
  var l = r.losses != null ? r.losses : (r.leagueRecord && r.leagueRecord.losses);
  if (w == null || l == null) return null;
  return { w: w, l: l };
}

// Star of the game — boxscore.topPerformers (MLB's own pick, ranked by
// game score) when present. That field isn't confirmed against a live
// response in this session, so if it's missing or shaped differently
// this falls back to the best batting line from boxScoreDetail
// (H + 2·HR + RBI + ½·R). Either way the result has the same shape.
function _starOfGame(boxscore, detail) {
  var tp = (boxscore && boxscore.topPerformers) || [];
  var teamsObj = (boxscore && boxscore.teams) || {};
  for (var i = 0; i < tp.length; i++) {
    var entry = tp[i];
    var pl = entry && entry.player;
    if (!pl || !pl.person || !pl.person.id) continue;
    var isHitter = entry.type === 'hitter';
    var st = pl.stats && (isHitter ? pl.stats.batting : pl.stats.pitching);
    var summary = (st && st.summary) || null;
    if (!summary && st && isHitter) summary = (st.hits || 0) + '-' + (st.atBats || 0) + (st.homeRuns ? ' · ' + st.homeRuns + ' HR' : '') + (st.rbi ? ' · ' + st.rbi + ' RBI' : '');
    if (!summary && st && !isHitter) summary = (st.inningsPitched || '0.0') + ' IP · ' + (st.strikeOuts || 0) + ' K · ' + (st.earnedRuns || 0) + ' ER';
    var pid = 'ID' + pl.person.id;
    var side = (teamsObj.away && teamsObj.away.players && teamsObj.away.players[pid]) ? 'away'
      : ((teamsObj.home && teamsObj.home.players && teamsObj.home.players[pid]) ? 'home' : null);
    return { name: pl.person.fullName || null, id: pl.person.id, side: side, summary: summary ? String(summary).replace(/\s*\|\s*/g, ' · ') : null };
  }
  if (!detail) return null;
  var best = null;
  ['away', 'home'].forEach(function (side) {
    ((detail[side] && detail[side].batters) || []).forEach(function (b) {
      var score = (b.h || 0) + 2 * (b.hr || 0) + (b.rbi || 0) + 0.5 * (b.r || 0);
      if (!best || score > best.score) best = { score: score, side: side, b: b };
    });
  });
  if (!best || best.score < 2) return null;
  var b = best.b;
  var bits = [b.h + '-' + b.ab];
  if (b.hr) bits.push((b.hr > 1 ? b.hr + ' ' : '') + 'HR');
  if (b.rbi) bits.push(b.rbi + ' RBI');
  if (b.r && !b.hr) bits.push(b.r + ' R');
  return { name: b.name, id: b.id, side: best.side, summary: bits.join(' · ') };
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
    _pregameSide(teams.away, boxTeams.away, probable.away, season, gameData.players),
    _pregameSide(teams.home, boxTeams.home, probable.home, season, gameData.players),
    _standingsByTeam(season)
  ]);
  var away = results[0], home = results[1], standings = results[2];

  if (!away || !home) return { error: 'No pregame data available' };
  [[away, teams.away], [home, teams.home]].forEach(function (pair) {
    var side = pair[0], team = pair[1] || {};
    side.abbr = team.abbreviation || null;
    var st = team.id != null ? standings[team.id] : null;
    side.record = st ? { w: st.w, l: st.l } : _teamRecord(team);
    side.standing = st ? { divRank: st.divRank, divName: st.divName, l10: st.l10, streak: st.streak } : null;
  });
  return {
    away: away,
    home: home,
    startTime: (gameData.datetime && gameData.datetime.dateTime) || null,
    venue: (gameData.venue && gameData.venue.name) || null
  };
}

// Division place, last-10 and streak per team id for the pregame hero —
// one standings call for both leagues. Division place is derived from
// win pct within each division (same approach the Playoff Picture uses)
// instead of trusting divisionRank. Division names fall back to a
// static id map since the standings payload doesn't always carry them.
var _DIVISION_NAMES = { 200: 'AL West', 201: 'AL East', 202: 'AL Central', 203: 'NL West', 204: 'NL East', 205: 'NL Central' };
async function _standingsByTeam(season) {
  var out = {};
  try {
    var url = 'https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&standingsTypes=regularSeason' + (season ? '&season=' + encodeURIComponent(season) : '');
    var r = await fetch(url);
    var data = await r.json();
    (data.records || []).forEach(function (rec) {
      var divId = rec.division && rec.division.id;
      var divName = ((rec.division && rec.division.name) || _DIVISION_NAMES[divId] || '').replace('American League', 'AL').replace('National League', 'NL');
      var rows = (rec.teamRecords || []).map(function (tr) {
        var l10 = null;
        ((tr.records && tr.records.splitRecords) || []).forEach(function (sr) {
          if (sr.type === 'lastTen') l10 = { w: sr.wins, l: sr.losses };
        });
        return {
          id: tr.team && tr.team.id,
          w: tr.wins != null ? tr.wins : 0,
          l: tr.losses != null ? tr.losses : 0,
          l10: l10,
          streak: (tr.streak && tr.streak.streakCode) || null
        };
      });
      rows.sort(function (a, b) { return _winPct(b) - _winPct(a); });
      rows.forEach(function (t, i) {
        if (t.id == null) return;
        out[t.id] = { w: t.w, l: t.l, divRank: i + 1, divName: divName || null, l10: t.l10, streak: t.streak };
      });
    });
  } catch (e) { /* hero just shows the record without standings */ }
  return out;
}

async function _pregameSide(team, boxTeam, probablePitcher, season, gamePlayers) {
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
        : 'No stats yet this season',
      // Structured copy of the same season line for the hero's compare bars
      hand: (gamePlayers && gamePlayers['ID' + probablePitcher.id] && gamePlayers['ID' + probablePitcher.id].pitchHand && gamePlayers['ID' + probablePitcher.id].pitchHand.code) || null,
      stats: seasonP ? {
        w: seasonP.wins != null ? seasonP.wins : null,
        l: seasonP.losses != null ? seasonP.losses : null,
        era: seasonP.era != null ? seasonP.era : null,
        whip: seasonP.whip != null ? seasonP.whip : null,
        so: seasonP.strikeOuts != null ? seasonP.strikeOuts : null,
        ip: seasonP.inningsPitched != null ? seasonP.inningsPitched : null
      } : null
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

  return { name: team.name, id: team.id || null, projected: projected, feat: feat, rows: rows };
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
