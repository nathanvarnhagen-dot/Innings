// Vercel Serverless Function — GET /api/mlb?mode=schedule&date=YYYY-MM-DD
//                               GET /api/mlb?mode=boxscore&gamePk=<id>[&plays=all]
//                               GET /api/mlb?mode=search&q=<name>
// Proxies the public MLB Stats API (statsapi.mlb.com, no key required) so
// the browser doesn't have to fetch it directly, and trims the response
// down to what a memory card actually needs.

module.exports = async function handler(req, res) {
  const mode = req.query.mode;
  // v5.91.0: Baseball Savant runs inside this function (see api/_savant.js)
  if (mode === 'savant') return savantHandler(req, res);

  try {
    if (mode === 'schedule') {
      const date = req.query.date;
      if (!date) { res.status(400).json({ error: 'Missing date' }); return; }
      // v6.8.0: team + seriesStatus hydrated for postseason games
      const url = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=team,seriesStatus&date=' + encodeURIComponent(date);
      const r = await fetch(url);
      const data = await r.json();
      const games = [];
      (data.dates || []).forEach(function (d) {
        (d.games || []).forEach(function (g) {
          games.push(Object.assign({
            gamePk: g.gamePk,
            status: g.status && g.status.detailedState,
            away: g.teams && g.teams.away && g.teams.away.team && g.teams.away.team.name,
            home: g.teams && g.teams.home && g.teams.home.team && g.teams.home.team.name,
            awayScore: g.teams && g.teams.away ? g.teams.away.score : null,
            homeScore: g.teams && g.teams.home ? g.teams.home.score : null,
            venue: g.venue && g.venue.name,
            startTime: g.gameDate || null
          }, _postseasonFields(g)));
        });
      });
      // v5.85.0: scores on the schedule list refresh within ~15s (was 5 min).
      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=15');
      res.status(200).json({ games: games });
      return;
    }

    // GET /api/mlb?mode=postseason&season=YYYY  (v6.8.0)
    // Every postseason game of the season (Wild Card → World Series), for
    // the bracket and each series' game-by-game strip.
    if (mode === 'postseason') {
      const season = parseInt(req.query.season, 10) || new Date().getFullYear();
      const url = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=' + season + '&gameType=F,D,L,W&hydrate=team,seriesStatus';
      const r = await fetch(url);
      const data = await r.json();
      const games = [];
      (data.dates || []).forEach(function (d) {
        (d.games || []).forEach(function (g) {
          games.push(Object.assign({
            gamePk: g.gamePk, date: d.date || null,
            status: g.status && g.status.detailedState,
            state: g.status && g.status.abstractGameState,
            away: g.teams && g.teams.away && g.teams.away.team && g.teams.away.team.name,
            home: g.teams && g.teams.home && g.teams.home.team && g.teams.home.team.name,
            awayScore: g.teams && g.teams.away ? g.teams.away.score : null,
            homeScore: g.teams && g.teams.home ? g.teams.home.score : null,
            awaySeed: g.teams && g.teams.away && g.teams.away.seriesNumber != null ? g.teams.away.seriesNumber : null,
            homeSeed: g.teams && g.teams.home && g.teams.home.seriesNumber != null ? g.teams.home.seriesNumber : null,
            startTime: g.gameDate || null, venue: g.venue && g.venue.name
          }, _postseasonFields(g)));
        });
      });
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
      res.status(200).json({ season: season, games: games });
      return;
    }

    // GET /api/mlb?mode=bvp&batter=<id>&pitcher=<id>  (v5.89.0)
    // A hitter's career line against one pitcher (MLB Stats API vsPlayer).
    if (mode === 'bvp') {
      const b = req.query.batter, p = req.query.pitcher;
      if (!b || !p) { res.status(400).json({ error: 'Missing batter or pitcher' }); return; }
      const url = 'https://statsapi.mlb.com/api/v1/people/' + encodeURIComponent(b) + '/stats?stats=vsPlayer&opposingPlayerId=' + encodeURIComponent(p) + '&group=hitting&sportId=1';
      const r = await fetch(url);
      const data = await r.json();
      const blocks = data.stats || [];
      const total = blocks.find(x => x.type && /total/i.test(x.type.displayName || '')) || null;
      let st = total && total.splits && total.splits[0] && total.splits[0].stat;
      if (!st) {
        // no total block: add up the per-season rows
        const rows = [].concat.apply([], blocks.map(x => x.splits || [])).map(x => x.stat || {});
        if (rows.length) {
          st = {};
          ['plateAppearances', 'atBats', 'hits', 'doubles', 'triples', 'homeRuns', 'baseOnBalls', 'strikeOuts', 'rbi', 'hitByPitch'].forEach(k => { st[k] = rows.reduce((a, x) => a + (Number(x[k]) || 0), 0); });
        }
      }
      const n = v => v == null ? 0 : Number(v) || 0;
      const out = st ? {
        pa: n(st.plateAppearances), ab: n(st.atBats), h: n(st.hits), d: n(st.doubles), t: n(st.triples), hr: n(st.homeRuns),
        bb: n(st.baseOnBalls), so: n(st.strikeOuts), rbi: n(st.rbi),
        avg: st.avg || null, obp: st.obp || null, slg: st.slg || null, ops: st.ops || null
      } : { pa: 0 };
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate');
      res.status(200).json(out);
      return;
    }

    if (mode === 'boxscore') {
      const gamePk = req.query.gamePk;
      if (!gamePk) { res.status(400).json({ error: 'Missing gamePk' }); return; }
      const url = 'https://statsapi.mlb.com/api/v1.1/game/' + encodeURIComponent(gamePk) + '/feed/live';
      const r = await fetch(url);
      const data = await r.json();
      // v5.85.0: a live game is only cached for a few seconds at the edge
      // (it was a full minute, so polling faster never showed anything
      // newer); finished games can sit much longer.
      const st = (data && data.gameData && data.gameData.status && data.gameData.status.abstractGameState) || '';
      res.setHeader('Cache-Control', st === 'Live' ? 's-maxage=3, stale-while-revalidate=5' : st === 'Final' ? 's-maxage=300, stale-while-revalidate' : 's-maxage=30, stale-while-revalidate');
      res.status(200).json(summarize(data, gamePk, req.query.plays === 'all'));
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

    // Team page (v5.65.0): header info, active roster and the whole
    // season's schedule (regular season + postseason) for one team.
    if (mode === 'team') {
      const teamId = Number(req.query.teamId);
      if (!teamId) { res.status(400).json({ error: 'Missing teamId' }); return; }
      const season = req.query.season || new Date().getFullYear();
      const parts = await Promise.all([
        _tpGetJson('https://statsapi.mlb.com/api/v1/teams/' + teamId),
        _tpGetJson('https://statsapi.mlb.com/api/v1/teams/' + teamId + '/roster?rosterType=active&season=' + encodeURIComponent(season)),
        _tpGetJson('https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=team&teamId=' + teamId + '&season=' + encodeURIComponent(season)),
        _standingsByTeam(season)
      ]);
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
      res.status(200).json(summarizeTeamPage(parts, teamId));
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

    // Player search by name (v5.67.0) — the Stats API's own people
    // search, active MLB players only, with their current team hydrated.
    // GET /api/mlb?mode=search&q=<name>
    if (mode === 'search') {
      const q = String(req.query.q || '').trim();
      if (q.length < 2) { res.status(200).json({ players: [] }); return; }
      const data = await _tpGetJson('https://statsapi.mlb.com/api/v1/people/search?names=' + encodeURIComponent(q) + '&sportIds=1&active=true&hydrate=currentTeam');
      if (!data) { res.status(502).json({ error: 'MLB search failed', players: [] }); return; }
      const players = (data.people || []).filter(function (p) { return p && p.fullName && p.active !== false; }).slice(0, 20).map(function (p) {
        const t = p.currentTeam || {};
        return {
          id: p.id,
          name: p.fullName,
          pos: (p.primaryPosition && p.primaryPosition.abbreviation) || null,
          team: t.name || null,
          teamId: t.id || null,
          league: 'mlb'
        };
      });
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
      res.status(200).json({ players: players });
      return;
    }

    res.status(400).json({ error: 'Unknown mode — use schedule, boxscore, pregame, standings, teams, team, or search' });
  } catch (err) {
    res.status(500).json({ error: 'MLB lookup failed' });
  }
};

function summarize(data, gamePk, wantAllPlays) {
  var gameData = data.gameData || {};
  var liveData = data.liveData || {};
  var linescore = liveData.linescore || {};
  var teams = gameData.teams || {};
  _absTeamIds = { away: teams.away && teams.away.id, home: teams.home && teams.home.id }; // v6.3.0
  _gameType = (gameData.game && gameData.game.type) || null; // v6.7.1: R regular, S spring, F/D/L/W postseason
  var decisions = liveData.decisions || {};
  var boxTeams = (liveData.boxscore && liveData.boxscore.teams) || {};
  var abstractState = (gameData.status && gameData.status.abstractGameState) || null;

  var innings = (linescore.innings || []).map(function (inn) {
    return {
      num: inn.num != null ? inn.num : null,
      away: (inn.away && inn.away.runs != null) ? inn.away.runs : null,
      home: (inn.home && inn.home.runs != null) ? inn.home.runs : null,
      // v5.91.0: per half-inning hits / left on base for the inning-break card
      awayH: (inn.away && inn.away.hits != null) ? inn.away.hits : null,
      homeH: (inn.home && inn.home.hits != null) ? inn.home.hits : null,
      awayLob: (inn.away && inn.away.leftOnBase != null) ? inn.away.leftOnBase : null,
      homeLob: (inn.home && inn.home.leftOnBase != null) ? inn.home.leftOnBase : null
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
      bases: { first: !!offense.first, second: !!offense.second, third: !!offense.third },
      // v5.91.0: "Middle"/"End" between halves, plus who's due up next
      inningState: linescore.inningState || null,
      dueUp: [offense.batter, offense.onDeck, offense.inHole].filter(Boolean).map(function (p) { return p.fullName; })
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

  // ── Every play, for the game screen's inning-by-inning list. Opt-in
  // via &plays=all rather than always-on: this same boxscore payload gets
  // sanitized and written to Firestore every time someone attaches a game
  // to a memory, and ~75 plays of description has no business riding
  // along in that document. Only the game screen asks for it.
  //
  // Left oldest-first, the way the game was played (recentPlays is
  // reversed for its own newest-first list, so the two aren't the same
  // order). result.awayScore/homeScore are standard fields on every
  // completed play — the same ones the scoringPlays block below reads —
  // so the running score after each play comes along for free.
  var fullPlays = null;
  if (wantAllPlays && (abstractState === 'Live' || abstractState === 'Final')) {
    var _fp = allPlays.filter(function (p) { return p.result && p.result.description; });
    fullPlays = _fp.map(function (p, fpIdx) {
      var about = p.about || {}, result = p.result || {};
      return {
        inning: about.inning != null ? about.inning : null,
        half: about.isTopInning ? 'top' : 'bottom',
        text: result.description,
        atBatIndex: about.atBatIndex != null ? about.atBatIndex : null,
        awayScore: result.awayScore != null ? result.awayScore : null,
        homeScore: result.homeScore != null ? result.homeScore : null,
        // Play context in game chat (v5.68.0): outs and runners after the
        // play, and the pitches in the at-bat. count.outs and matchup.
        // postOnFirst/Second/Third are standard fields on every completed
        // play; pitches are the same playEvents pitchSequence reads.
        outs: (p.count && p.count.outs != null) ? p.count.outs : null,
        bases: {
          first: !!(p.matchup && p.matchup.postOnFirst),
          second: !!(p.matchup && p.matchup.postOnSecond),
          third: !!(p.matchup && p.matchup.postOnThird)
        },
        anim: (p.about && p.about.isComplete) ? _playAnimSummary(p, _fp[fpIdx - 1]) : null,
        pitches: (p.playEvents || []).filter(function (e) { return e && e.isPitch; }).map(function (e) {
          var d = e.details || {};
          return {
            call: _callText(e, p, _droppedK(p)),
            type: (d.type && d.type.description) || null,
            speed: (e.pitchData && e.pitchData.startSpeed != null) ? Math.round(e.pitchData.startSpeed) : null
          };
        })
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
      var _dkCur = _droppedK(currentPlay);
      var pitches = pitchEvents.map(function (e, i) {
        var coords = e.pitchData.coordinates || {};
        return {
          num: e.pitchNumber || (i + 1),
          px: coords.pX != null ? coords.pX : null,
          pz: coords.pZ != null ? coords.pZ : null,
          call: _callText(e, currentPlay, _dkCur),
          type: (e.details && e.details.type && e.details.type.description) || null,
          code: (e.details && e.details.type && e.details.type.code) || null,   // v5.87.0: FF, SL… for "vs his normal"
          mph: e.pitchData.startSpeed != null ? Math.round(e.pitchData.startSpeed * 10) / 10 : null,
          speed: e.pitchData.startSpeed != null ? Math.round(e.pitchData.startSpeed) : null,
          abs: _absOf(e)   // v6.3.0: ABS challenge on this pitch
        };
      }).filter(function (p) { return p.px != null && p.pz != null; });
      var lastEvent = pitchEvents.length ? pitchEvents[pitchEvents.length - 1] : null;
      // v5.97.0: things that happen between pitches — steals, caught
      // stealing, wild pitches, passed balls, pickoffs (and attempts), balks,
      // throwing errors — each with the runners it moved and who touched it.
      var ACT = /stolen_base|caught_stealing|wild_pitch|passed_ball|pickoff|balk|defensive_indiff|other_advance|error/;
      var actions = (currentPlay.playEvents || []).filter(function (e) { return e && !e.isPitch && (e.type === 'action' || e.type === 'pickoff'); }).map(function (e) {
        var d = e.details || {};
        var et = d.eventType || (e.type === 'pickoff' ? 'pickoff_attempt' : '');
        var mv = (currentPlay.runners || []).filter(function (r) { return r.details && r.details.playIndex === e.index; });
        var codes = [];
        mv.forEach(function (r) { (r.credits || []).forEach(function (c) { var k = c.position && c.position.code; if (k && codes.indexOf(k) === -1) codes.push(k); }); });
        var baseM = String(d.description || '').match(/\b(1B|2B|3B)\b/);
        return {
          index: e.index, eventType: et, description: d.description || '', isOut: !!d.isOut,
          base: baseM ? baseM[1] : null,
          runners: mv.map(function (r) { var m = r.movement || {}; return { start: m.start || null, end: m.end || null, out: !!m.isOut, outBase: m.outBase || null, name: (r.details && r.details.runner && r.details.runner.fullName) || null }; }),
          fielders: codes
        };
      }).filter(function (a) { return ACT.test(a.eventType); });
      pitchSequence = {
        batter: currentPlay.matchup.batter.fullName || null,
        batterId: currentPlay.matchup.batter.id || null,
        pitcherId: (currentPlay.matchup.pitcher && currentPlay.matchup.pitcher.id) || null,
        pitchHand: (currentPlay.matchup.pitchHand && currentPlay.matchup.pitchHand.code) || null,
        atBatIndex: (currentPlay.about && currentPlay.about.atBatIndex != null) ? currentPlay.about.atBatIndex : null,
        batSide: (currentPlay.matchup.batSide && currentPlay.matchup.batSide.code) || null,
        zoneTop: (lastEvent && lastEvent.pitchData.strikeZoneTop != null) ? lastEvent.pitchData.strikeZoneTop : 3.5,
        zoneBottom: (lastEvent && lastEvent.pitchData.strikeZoneBottom != null) ? lastEvent.pitchData.strikeZoneBottom : 1.5,
        pitches: pitches,
        actions: actions,
        bases: { '1B': !!(linescore.offense && linescore.offense.first), '2B': !!(linescore.offense && linescore.offense.second), '3B': !!(linescore.offense && linescore.offense.third) }
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
    allPlays: fullPlays,
    lastPlay: (abstractState === 'Live' || abstractState === 'Final') ? _lastPlaySummary(allPlays) : null,
    pitchSequence: pitchSequence,
    boxScoreDetail: boxScoreDetail,
    // v6.3.0: ABS challenges left/used per team (feed/live gameData.absChallenges)
    absChallenges: gameData.absChallenges || null
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
      ? (stat.era != null ? stat.era + ' ERA' : '') + (stat.strikeOuts != null ? ' · ' + stat.strikeOuts + ' K' : '') + (stat.inningsPitched != null ? ' · ' + stat.inningsPitched + ' IP' : '')
      : (stat.avg || '.000') + ' / ' + (stat.obp || '.000') + ' / ' + (stat.slg || '.000');
  }
  // v5.83.0: the pitcher's line in THIS game — innings, total pitches,
  // strikes, balls (boxscore players[ID].stats.pitching, standard fields).
  var today = null;
  var gp = group === 'pitching' && obj && obj.stats && obj.stats.pitching;
  if (gp) {
    var tp = gp.numberOfPitches != null ? gp.numberOfPitches : (gp.pitchesThrown != null ? gp.pitchesThrown : null);
    var st = gp.strikes != null ? gp.strikes : null;
    var bl = gp.balls != null ? gp.balls : (tp != null && st != null ? tp - st : null);
    today = { ip: gp.inningsPitched != null ? gp.inningsPitched : '0.0', tp: tp, s: st, b: bl };
  }
  return { name: person.fullName, id: person.id, line: line || null, today: today };
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

  var officialDate = (gameData.datetime && gameData.datetime.officialDate) || null;
  var thisPk = gameData.game && gameData.game.pk;
  var results = await Promise.all([
    _pregameSide(teams.away, boxTeams.away, probable.away, season, gameData.players),
    _pregameSide(teams.home, boxTeams.home, probable.home, season, gameData.players),
    _standingsByTeam(season),
    _lastTenGames(teams.away && teams.away.id, officialDate, thisPk),
    _lastTenGames(teams.home && teams.home.id, officialDate, thisPk)
  ]);
  var away = results[0], home = results[1], standings = results[2];
  if (away) away.last10 = results[3];
  if (home) home.last10 = results[4];

  if (!away || !home) return { error: 'No pregame data available' };
  [[away, teams.away], [home, teams.home]].forEach(function (pair) {
    var side = pair[0], team = pair[1] || {};
    side.abbr = team.abbreviation || null;
    side.id = team.id != null ? team.id : null; // lets the hero open this team's page (v5.65.0)
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

// Last 10 completed regular-season games for a team, oldest first, from
// the schedule endpoint (45-day window ending on this game's date, this
// game itself excluded). hydrate=team supplies abbreviations; the static
// id map covers them if that hydration ever comes back without one.
// Postponed/cancelled games are skipped. Returns [] on any failure so the
// hero falls back to the standings last-10 bar.
var _MLB_ABBR_BY_ID = { 108: 'LAA', 109: 'AZ', 110: 'BAL', 111: 'BOS', 112: 'CHC', 113: 'CIN', 114: 'CLE', 115: 'COL', 116: 'DET', 117: 'HOU',
  118: 'KC', 119: 'LAD', 120: 'WSH', 121: 'NYM', 133: 'ATH', 134: 'PIT', 135: 'SD', 136: 'SEA', 137: 'SF', 138: 'STL', 139: 'TB',
  140: 'TEX', 141: 'TOR', 142: 'MIN', 143: 'PHI', 144: 'ATL', 145: 'CWS', 146: 'MIA', 147: 'NYY', 158: 'MIL' };
function _isoDay(d) { return d.toISOString().slice(0, 10); }
async function _lastTenGames(teamId, endDate, excludePk) {
  if (!teamId) return [];
  try {
    var end = endDate ? new Date(endDate + 'T12:00:00Z') : new Date();
    var start = new Date(end.getTime() - 45 * 86400000);
    var url = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameType=R&hydrate=team&teamId=' + encodeURIComponent(teamId) +
      '&startDate=' + _isoDay(start) + '&endDate=' + _isoDay(end);
    var r = await fetch(url);
    var data = await r.json();
    var games = [];
    (data.dates || []).forEach(function (d) {
      (d.games || []).forEach(function (g) {
        var st = g.status || {};
        if (st.abstractGameState !== 'Final') return;
        if (/postponed|cancel/i.test(st.detailedState || '')) return;
        if (excludePk && g.gamePk === excludePk) return;
        var home = g.teams && g.teams.home, away = g.teams && g.teams.away;
        if (!home || !away || home.score == null || away.score == null) return;
        var isHome = home.team && home.team.id === teamId;
        var me = isHome ? home : away, opp = isHome ? away : home;
        if (me.score === opp.score) return;
        var oppTeam = opp.team || {};
        games.push({
          // The schedule row this came from already knows the game's id —
          // carrying it means tapping one of these circles can open that
          // game straight away, and doubleheaders can't be confused.
          gamePk: g.gamePk != null ? g.gamePk : null,
          opp: oppTeam.abbreviation || _MLB_ABBR_BY_ID[oppTeam.id] || null,
          oppName: oppTeam.teamName || oppTeam.name || null,
          res: me.score > opp.score ? 'W' : 'L',
          us: me.score,
          them: opp.score,
          home: !!isHome,
          date: d.date || g.officialDate || null,
          t: g.gameDate || '',
          n: g.gameNumber || 1
        });
      });
    });
    games.sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : a.n - b.n; });
    return games.slice(-10).map(function (g) { delete g.t; delete g.n; return g; });
  } catch (e) {
    return [];
  }
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

    // division is carried through so the bracket can say which one a top
    // seed actually won — it was computed just above and then dropped.
    var seeds = divWinners.map(function (t, i) { return { seed: i + 1, team: _teamShortName(t.name), rec: t.w + '-' + t.l, bye: i < 2, division: t.division || null }; })
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

// ── TEAM PAGE (v5.65.0) ──────────────────────────────────────────────
async function _tpGetJson(url) {
  try { var r = await fetch(url); if (!r.ok) return null; return await r.json(); }
  catch (e) { return null; }
}
function _tpOrdinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
var _TP_POSTSEASON = { F: 'Wild Card', D: 'Division Series', L: 'LCS', W: 'World Series' };
var _TP_GROUPS = [['Pitcher', 'Pitchers'], ['Two-Way Player', 'Two-way'], ['Catcher', 'Catchers'], ['Infielder', 'Infielders'], ['Outfielder', 'Outfielders'], ['Hitter', 'Designated hitters']];
function summarizeTeamPage(parts, teamId) {
  var t = ((parts[0] && parts[0].teams) || [])[0] || {};
  var st = (parts[3] || {})[teamId] || null;
  var team = {
    id: teamId,
    name: t.name || null,
    short: t.teamName || t.clubName || null,
    abbr: t.abbreviation || _MLB_ABBR_BY_ID[teamId] || null,
    location: t.locationName || null,
    record: st ? st.w + '-' + st.l : null,
    standing: st && st.divRank && st.divName ? _tpOrdinal(st.divRank) + ' in ' + st.divName : null,
    l10: st && st.l10 ? st.l10.w + '-' + st.l10.l : null,
    streak: st ? st.streak : null
  };

  var byType = {};
  ((parts[1] && parts[1].roster) || []).forEach(function (r) {
    var p = r.person || {}, pos = r.position || {};
    if (!p.fullName) return;
    var type = pos.type || 'Hitter';
    (byType[type] = byType[type] || []).push({ id: p.id || null, name: p.fullName, jersey: r.jerseyNumber || null, pos: pos.abbreviation || null, posName: pos.name || null, exp: null });
  });
  var groups = [];
  _TP_GROUPS.forEach(function (g) { if (byType[g[0]]) { groups.push({ label: g[1], players: byType[g[0]] }); delete byType[g[0]]; } });
  Object.keys(byType).forEach(function (k) { groups.push({ label: k, players: byType[k] }); });
  groups.forEach(function (g) { g.players.sort(function (a, b) { return (Number(a.jersey) || 999) - (Number(b.jersey) || 999); }); });

  // Spring training and exhibitions are dropped; a postponed game shows up
  // again on its make-up date, so the postponed row itself is skipped.
  var games = [];
  ((parts[2] && parts[2].dates) || []).forEach(function (d) {
    (d.games || []).forEach(function (g) {
      var type = g.gameType || 'R';
      if (type !== 'R' && !_TP_POSTSEASON[type]) return;
      var s = g.status || {};
      if (/postponed|cancel|suspended/i.test(s.detailedState || '')) return;
      var home = g.teams && g.teams.home, away = g.teams && g.teams.away;
      if (!home || !away) return;
      var isHome = home.team && home.team.id === teamId;
      var me = isHome ? home : away, opp = isHome ? away : home;
      var ot = opp.team || {};
      var state = s.abstractGameState === 'Final' ? 'post' : (s.abstractGameState === 'Live' ? 'in' : 'pre');
      var res = null;
      if (state === 'post' && me.score != null && opp.score != null && me.score !== opp.score) res = me.score > opp.score ? 'W' : 'L';
      games.push({
        id: g.gamePk,
        date: g.gameDate || null,
        day: d.date || g.officialDate || null,
        timeTbd: !!(s.startTimeTBD),
        label: _TP_POSTSEASON[type] || (g.doubleHeader && g.doubleHeader !== 'N' ? 'Game ' + (g.gameNumber || 1) : null),
        post: type !== 'R',
        home: !!isHome,
        opp: ot.abbreviation || _MLB_ABBR_BY_ID[ot.id] || '?',
        oppName: ot.name || null,
        oppShort: ot.teamName || null,
        state: state,
        status: s.detailedState || null,
        us: res ? me.score : null,
        them: res ? opp.score : null,
        res: res,
        n: g.gameNumber || 1
      });
    });
  });
  games.sort(function (a, b) { return String(a.date) < String(b.date) ? -1 : String(a.date) > String(b.date) ? 1 : a.n - b.n; });
  return { league: 'mlb', team: team, groups: groups, games: games };
}


// ── LAST COMPLETED PLAY (v5.70.0) — drives the play animation inside the
// at-bat square on the game screen: the pitches of that at-bat, where the
// ball went (Gameday hit coordinates), who fielded it (for "6-4-3"), and
// every runner's start/end/out. All standard fields on liveData.plays.
function _lastPlaySummary(allPlays) {
  var done = (allPlays || []).filter(function (p) { return p && p.about && p.about.isComplete && p.result && p.result.description; });
  if (!done.length) return null;
  return _playAnimSummary(done[done.length - 1], done[done.length - 2]);
}
// Everything the at-bat square needs to animate one play (v5.71.0: also
// attached to every play in the full list so tapping any play replays it).
function _playAnimSummary(p, prev) {
  if (!p || !p.result) return null;
  var evs = p.playEvents || [];
  var pitchEvs = evs.filter(function (e) { return e && e.isPitch; });
  var pitches = pitchEvs.filter(function (e) { return e.pitchData && e.pitchData.coordinates && e.pitchData.coordinates.pX != null && e.pitchData.coordinates.pZ != null; }).map(function (e, i) {
    var d = e.details || {};
    return { num: e.pitchNumber || (i + 1), px: e.pitchData.coordinates.pX, pz: e.pitchData.coordinates.pZ,
      call: _callText(e, p, _droppedK(p)), type: (d.type && d.type.description) || null, code: (d.type && d.type.code) || null,
      speed: e.pitchData.startSpeed != null ? Math.round(e.pitchData.startSpeed) : null, abs: _absOf(e) };
  });
  var lastPd = null;
  for (var i = pitchEvs.length - 1; i >= 0; i--) { if (pitchEvs[i].pitchData) { lastPd = pitchEvs[i].pitchData; break; } }
  var hit = null;
  for (var j = evs.length - 1; j >= 0; j--) { if (evs[j] && evs[j].hitData) { hit = evs[j].hitData; break; } }
  // v6.1.0: things that happened between pitches of this at-bat (a caught
  // stealing, a wild pitch…) are their own scenes, not part of the final
  // play. Their runners and fielders are kept out of the play below, and
  // listed in `actions` with how many pitches came before each one.
  var lastPitchIdx = -1;
  evs.forEach(function (e) { if (e && e.isPitch && e.index != null && e.index > lastPitchIdx) lastPitchIdx = e.index; });
  var ACT = /stolen_base|caught_stealing|wild_pitch|passed_ball|pickoff|balk|defensive_indiff|other_advance|error/;
  var evByIdx = {};
  evs.forEach(function (e) { if (e && e.index != null) evByIdx[e.index] = e; });
  var isActRunner = function (r) {
    var pi = r && r.details && r.details.playIndex;
    if (pi == null || pi >= lastPitchIdx) return false;
    var e = evByIdx[pi];
    return !!(e && !e.isPitch);
  };
  var actions = [];
  evs.forEach(function (e) {
    if (!e || e.isPitch || e.index == null || e.index >= lastPitchIdx) return;
    if (e.type !== 'action' && e.type !== 'pickoff') return;
    var d = e.details || {};
    var et = d.eventType || (e.type === 'pickoff' ? 'pickoff_attempt' : '');
    if (!ACT.test(et)) return;
    var mv = (p.runners || []).filter(function (r) { return r.details && r.details.playIndex === e.index; });
    var codes = [];
    mv.forEach(function (r) { (r.credits || []).forEach(function (c) { var k = c.position && c.position.code; if (k && codes.indexOf(k) === -1) codes.push(k); }); });
    var baseM = String(d.description || '').match(/\b(1B|2B|3B)\b/);
    var before = evs.filter(function (x) { return x && x.isPitch && x.index != null && x.index < e.index; }).length;
    actions.push({
      kind: 'action', index: e.index, eventType: et, description: d.description || '', isOut: !!d.isOut, base: baseM ? baseM[1] : null,
      afterPitch: before,
      runners: mv.map(function (r) { var m = r.movement || {}; return { start: m.start || null, end: m.end || null, out: !!m.isOut, outBase: m.outBase || null, name: (r.details && r.details.runner && r.details.runner.fullName) || null }; }),
      fielders: codes
    });
  });
  var byRunner = {}, order = [];
  var fielders = [], deflected = [];
  (p.runners || []).forEach(function (r) {
    if (isActRunner(r)) return; // v6.1.0: belongs to a between-pitch scene
    var id = r.details && r.details.runner && r.details.runner.id;
    var mv = r.movement || {};
    if (id == null) return;
    if (!byRunner[id]) { byRunner[id] = { start: mv.start || null, end: mv.end || null, out: !!mv.isOut, outBase: mv.outBase || null, batter: !!(p.matchup && p.matchup.batter && p.matchup.batter.id === id) }; order.push(id); }
    else { byRunner[id].end = mv.end || null; if (mv.isOut) { byRunner[id].out = true; byRunner[id].outBase = mv.outBase || byRunner[id].outBase; } }
    (r.credits || []).forEach(function (c) {
      var code = c.position && c.position.code;
      if (!code) return;
      // v6.1.1: a deflection isn't part of the scoring ("6-4-3"), and it
      // made the app think an infielder fielded a ball that went through
      if (/deflect/.test(c.credit || '')) { if (deflected.indexOf(code) === -1) deflected.push(code); return; }
      if (fielders.indexOf(code) === -1) fielders.push(code); // first touch order: 6, 4, 3
    });
  });
  // Who was on base when the play started: the previous play's end state
  // in the same half-inning (runners who didn't move aren't in p.runners).
  var sameHalf = prev && prev.about && prev.about.inning === p.about.inning && prev.about.isTopInning === p.about.isTopInning;
  var pm = (sameHalf && prev.matchup) || {};
  var pre = { '1B': !!pm.postOnFirst, '2B': !!pm.postOnSecond, '3B': !!pm.postOnThird };
  // v6.7.1: extra innings in the regular season start with a runner on
  // second. He isn't in the previous play (there isn't one this half), and
  // he only shows up in this play if he moved — so put him on second for
  // the first at-bat of every extra half-inning.
  if (!sameHalf && (p.about.inning || 0) >= 10 && _ghostRunnerRule()) pre['2B'] = true;
  // v6.1.0: bases as they stood when the final pitch was thrown — after any
  // between-pitch scenes (a runner caught stealing is gone, a steal moved up)
  actions.forEach(function (a) {
    a.runners.forEach(function (r) { if (r.start && pre[r.start] !== undefined) pre[r.start] = false; });
    a.runners.forEach(function (r) { if (!r.out && r.end && pre[r.end] !== undefined) pre[r.end] = true; });
  });
  var errorPos = null;
  (p.runners || []).forEach(function (r) { if (isActRunner(r)) return; (r.credits || []).forEach(function (c) { if (/error/.test(c.credit || '') && c.position) errorPos = c.position.code; }); });
  return {
    atBatIndex: p.about.atBatIndex != null ? p.about.atBatIndex : null,
    inning: p.about.inning || null, half: p.about.isTopInning ? 'top' : 'bottom',
    event: p.result.event || null, eventType: p.result.eventType || null, description: p.result.description,
    rbi: p.result.rbi || 0, awayScore: p.result.awayScore != null ? p.result.awayScore : null, homeScore: p.result.homeScore != null ? p.result.homeScore : null,
    outs: (p.count && p.count.outs != null) ? p.count.outs : null,
    batter: (p.matchup && p.matchup.batter && p.matchup.batter.fullName) || null,
    batterId: (p.matchup && p.matchup.batter && p.matchup.batter.id) || null,
    pitcherId: (p.matchup && p.matchup.pitcher && p.matchup.pitcher.id) || null,
    pitchHand: (p.matchup && p.matchup.pitchHand && p.matchup.pitchHand.code) || null,
    batSide: (p.matchup && p.matchup.batSide && p.matchup.batSide.code) || null,
    zoneTop: (lastPd && lastPd.strikeZoneTop != null) ? lastPd.strikeZoneTop : 3.5,
    zoneBottom: (lastPd && lastPd.strikeZoneBottom != null) ? lastPd.strikeZoneBottom : 1.5,
    pitches: pitches,
    hit: hit ? { x: hit.coordinates && hit.coordinates.coordX != null ? hit.coordinates.coordX : null, y: hit.coordinates && hit.coordinates.coordY != null ? hit.coordinates.coordY : null,
      trajectory: hit.trajectory || null, distance: hit.totalDistance != null ? Math.round(hit.totalDistance) : null, speed: hit.launchSpeed != null ? Math.round(hit.launchSpeed * 10) / 10 : null,
      angle: hit.launchAngle != null ? Math.round(hit.launchAngle) : null } : null,
    runners: order.map(function (id) { return byRunner[id]; }),
    pre: pre,
    fielders: fielders,
    errorPos: errorPos,
    deflected: deflected,
    droppedK: _droppedK(p),   // v6.4.0: 'out' (thrown out at first) | 'safe' | null
    actions: actions
  };
}


// ══ BASEBALL SAVANT (v5.92.0) — inlined into this function ══════════════
// Was a separate file loaded with require(); on Vercel that file wasn't
// found at runtime (HTTP 500), so it now lives right here. Wrapped in its
// own scope so none of its helper names collide with the ones above.
const savantHandler = (function () {
// Baseball Savant (Statcast) for Innings — v5.91.0
// Lives in api/_savant.js (the leading underscore means Vercel does NOT
// deploy it as its own function — it runs inside /api/mlb, so it doesn't
// count toward the plan's function limit). Called as:
//   /api/mlb?mode=savant&smode=<game|arsenal|batter|player|ping>&…
//
//   GET /api/savant?mode=game&gamePk=<id>[&live=1]
//       Every batted ball / pitch in one game: exit velo, launch angle,
//       distance, xBA, "HR in N of 30 parks", catch probability (when
//       Savant has it), bat speed per swing — keyed by at-bat — plus the
//       game's hardest-hit ball, fastest pitch and longest homer.
//   GET /api/savant?mode=arsenal&id=<pitcherId>[&year=YYYY]
//       A pitcher's pitch mix: usage, average velocity, whiff rate.
//   GET /api/savant?mode=batter&id=<batterId>[&year=YYYY]
//       A hitter's season: spray chart points, batting average by zone
//       (hot/cold zones), average bat speed, sprint speed.
//   GET /api/savant?mode=player&id=<id>[&year=YYYY]
//       Everything for the player sheet: percentile ranks (+ arsenal for
//       pitchers, + spray/zones for hitters).
//
// Baseball Savant has no official API. This reads the same public CSV/JSON
// pages its site uses (game feed, Statcast search CSV, leaderboard CSVs).
// Those can change without notice, so every field is read defensively and
// anything missing is simply left out. Where Savant has nothing for a game
// yet, the MLB Stats API live feed fills in the basics (exit velo, angle,
// distance, pitch speed) so those features still work.
//
// Caching: leaderboards are kept in memory for a few hours per warm
// instance and at the edge; finished games are immutable so they cache for
// a day; live games for 15 seconds.

const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15', 'Accept': 'text/csv,application/json,text/plain,*/*', 'Accept-Language': 'en-US,en;q=0.9', 'Referer': 'https://baseballsavant.mlb.com/' };
const MEM = global.__inningsSavantCache || (global.__inningsSavantCache = new Map());

function memGet(k) { const e = MEM.get(k); if (!e) return null; if (Date.now() > e.exp) { MEM.delete(k); return null; } return e.v; }
function memSet(k, v, ms) { MEM.set(k, { v: v, exp: Date.now() + ms }); if (MEM.size > 400) MEM.delete(MEM.keys().next().value); return v; }

async function fetchText(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || 8000);
  try {
    const r = await fetch(url, { headers: UA, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
    return await r.text();
  } finally { clearTimeout(t); }
}
async function fetchJson(url, ms) { return JSON.parse(await fetchText(url, ms)); }

// Small RFC-4180 CSV parser (quoted fields, escaped quotes, BOM).
function parseCsv(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const head = rows[0].map(h => h.trim().replace(/^"|"$/g, ''));
  return rows.slice(1).map(r => { const o = {}; head.forEach((h, i) => { o[h] = r[i] != null ? r[i] : ''; }); return o; });
}
async function csv(url, ttlMs, ms) {
  const hit = memGet(url);
  if (hit) return hit;
  return memSet(url, parseCsv(await fetchText(url, ms || 7000)), ttlMs || 3 * 3600 * 1000);
}

const num = v => { if (v == null || v === '' || v === 'null') return null; const n = Number(v); return isFinite(n) ? n : null; };
const first = (o, keys) => { for (const k of keys) { if (o && o[k] != null && o[k] !== '') return o[k]; } return null; };
const round1 = v => v == null ? null : Math.round(v * 10) / 10;
function findKey(o, re) { if (!o || typeof o !== 'object') return null; for (const k of Object.keys(o)) if (re.test(k) && o[k] != null && o[k] !== '') return o[k]; return null; }
function yearOf(q) { const y = parseInt(q, 10); return y > 2000 ? y : new Date().getFullYear(); }

// ── One pitch row (from any of the three sources) → the fields we use.
function normPitch(r, src) {
  const ctx = r.contextMetrics || r.context_metrics || {};
  const ab = num(first(r, ['ab_number', 'at_bat_number', 'atBatNumber']));
  return {
    ab: ab,
    n: num(first(r, ['pitch_number', 'pitchNumber'])),
    mph: round1(num(first(r, ['start_speed', 'release_speed', 'pitch_speed']))),
    code: first(r, ['pitch_type']) || null,
    ev: round1(num(first(r, ['launch_speed', 'exit_velocity', 'hit_speed']))),
    la: num(first(r, ['launch_angle', 'hit_angle'])),
    dist: num(first(r, ['hit_distance', 'hit_distance_sc', 'total_distance'])),
    xba: num(first(r, ['xba', 'estimated_ba_using_speedangle'])),
    batSpeed: round1(num(first(r, ['bat_speed', 'batSpeed']))),
    parks: num(first(ctx, ['homeRunBallparks', 'home_run_ballparks'])) != null ? num(first(ctx, ['homeRunBallparks', 'home_run_ballparks'])) : num(first(r, ['hr_ballparks', 'homeRunBallparks'])),
    catchProb: (function () { const v = num(findKey(r, /catch_?prob/i) != null ? findKey(r, /catch_?prob/i) : findKey(ctx, /catch_?prob/i)); return v == null ? null : (v > 1 ? v / 100 : v); })(),
    event: String(first(r, ['events', 'result', 'event']) || '').toLowerCase().replace(/\s+/g, '_'),
    batter: first(r, ['batter_name', 'batterName']) || (src === 'csv' ? null : null),
    batterId: num(first(r, ['batter', 'batter_id', 'batterId'])),
    pitcher: first(r, ['pitcher_name', 'pitcherName', 'player_name']) || null,
    pitcherId: num(first(r, ['pitcher', 'pitcher_id', 'pitcherId']))
  };
}

// MLB Stats API fallback: the same basics straight from the live feed.
async function mlbFeedPitches(gamePk) {
  const d = await fetchJson('https://statsapi.mlb.com/api/v1.1/game/' + encodeURIComponent(gamePk) + '/feed/live', 8000);
  const out = [];
  const plays = (d.liveData && d.liveData.plays && d.liveData.plays.allPlays) || [];
  plays.forEach(p => {
    const ab = p.about && p.about.atBatIndex != null ? p.about.atBatIndex + 1 : null;
    const ev = (p.result && p.result.eventType) || '';
    const bat = p.matchup && p.matchup.batter, pit = p.matchup && p.matchup.pitcher;
    (p.playEvents || []).forEach(e => {
      if (!e.isPitch) return;
      const hd = e.hitData || {};
      out.push({
        ab: ab, n: e.pitchNumber || null,
        mph: e.pitchData && e.pitchData.startSpeed != null ? round1(e.pitchData.startSpeed) : null,
        code: (e.details && e.details.type && e.details.type.code) || null,
        ev: hd.launchSpeed != null ? round1(hd.launchSpeed) : null, la: hd.launchAngle != null ? Math.round(hd.launchAngle) : null,
        dist: hd.totalDistance != null ? Math.round(hd.totalDistance) : null,
        xba: null, batSpeed: null, parks: null, catchProb: null,
        event: hd.launchSpeed != null ? ev : '',
        batter: bat && bat.fullName || null, batterId: bat && bat.id || null,
        pitcher: pit && pit.fullName || null, pitcherId: pit && pit.id || null
      });
    });
  });
  return out;
}

function summarizeGame(pitches, source) {
  const plays = {};
  let hardest = null, fastest = null, longestHr = null;
  const hrs = [];
  pitches.forEach(p => {
    if (p.ab == null) return;
    const k = String(p.ab - 1); // atBatIndex (MLB's at-bat number is 1-based)
    const pl = plays[k] || (plays[k] = { atBatIndex: p.ab - 1, swings: [] });
    ['batter', 'batterId', 'pitcher', 'pitcherId'].forEach(f => { if (p[f] != null && pl[f] == null) pl[f] = p[f]; });
    if (p.batSpeed != null) pl.swings.push({ n: p.n, batSpeed: p.batSpeed });
    if (p.ev != null) {
      pl.ev = p.ev; pl.la = p.la; pl.dist = p.dist;
      if (p.xba != null) pl.xba = p.xba;
      if (p.parks != null) pl.parks = p.parks;
      if (p.catchProb != null) pl.catchProb = p.catchProb;
      if (p.event) pl.event = p.event;
      if (!hardest || p.ev > hardest.ev) hardest = { ev: p.ev, name: p.batter, atBatIndex: p.ab - 1 };
    }
    if (p.mph != null && (!fastest || p.mph > fastest.mph)) fastest = { mph: p.mph, name: p.pitcher, atBatIndex: p.ab - 1 };
    if (/home_run/.test(p.event || '') && p.dist != null) {
      hrs.push({ dist: p.dist, ev: p.ev, name: p.batter, atBatIndex: p.ab - 1 });
      if (!longestHr || p.dist > longestHr.dist) longestHr = { dist: p.dist, ev: p.ev, name: p.batter, atBatIndex: p.ab - 1 };
    }
  });
  Object.keys(plays).forEach(k => { if (!plays[k].swings.length) delete plays[k].swings; });
  return { source: source, plays: plays, summary: { hardest: hardest, fastest: fastest, longestHr: longestHr, homeRuns: hrs } };
}

// Player names by id, for sources that only carry ids (the Statcast CSV
// names the pitcher only).
async function gameNames(gamePk) {
  try {
    const b = await fetchJson('https://statsapi.mlb.com/api/v1/game/' + encodeURIComponent(gamePk) + '/boxscore', 6000);
    const map = {};
    ['away', 'home'].forEach(side => {
      const pl = (b.teams && b.teams[side] && b.teams[side].players) || {};
      Object.keys(pl).forEach(k => { const p = pl[k].person; if (p && p.id) map[p.id] = p.fullName; });
    });
    return map;
  } catch (e) { return {}; }
}
function fillNames(ps, names) {
  ps.forEach(p => {
    if (!p.batter && p.batterId && names[p.batterId]) p.batter = names[p.batterId];
    if (!p.pitcher && p.pitcherId && names[p.pitcherId]) p.pitcher = names[p.pitcherId];
  });
  return ps;
}

async function gameMode(gamePk) {
  // 1) Savant's game feed (updates during the game)
  try {
    const gf = await fetchJson('https://baseballsavant.mlb.com/gf?game_pk=' + encodeURIComponent(gamePk), 8000);
    const rows = [].concat(gf.team_home || [], gf.team_away || []);
    if (rows.length) {
      let ps = rows.map(r => normPitch(r, 'gf'));
      if (ps.some(p => !p.batter)) ps = fillNames(ps, await gameNames(gamePk));
      return summarizeGame(ps, 'savant-gf');
    }
  } catch (e) { /* fall through */ }
  // 2) Statcast search CSV (complete after the game)
  try {
    const rows = parseCsv(await fetchText('https://baseballsavant.mlb.com/statcast_search/csv?all=true&type=details&game_pk=' + encodeURIComponent(gamePk), 9000));
    if (rows.length && rows[0].game_pk != null) {
      const ps = rows.map(r => {
        const p = normPitch(r, 'csv');
        // CSV player_name is the PITCHER in pitcher view, "Last, First"
        if (r.player_name) p.pitcher = r.player_name.split(', ').reverse().join(' ');
        return p;
      });
      return summarizeGame(fillNames(ps, await gameNames(gamePk)), 'savant-csv');
    }
  } catch (e) { /* fall through */ }
  // 3) MLB live feed basics
  return summarizeGame(await mlbFeedPitches(gamePk), 'mlb-feed');
}

// ── Leaderboards
async function percentileRow(type, id, year) {
  const rows = await csv('https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=' + type + '&year=' + year + '&position=&team=&csv=true');
  return rows.find(r => String(r.player_id) === String(id)) || null;
}
const BATTER_PCT = [['xwoba', 'xwOBA'], ['xba', 'xBA'], ['exit_velocity', 'Avg exit velo'], ['brl_percent', 'Barrel %'], ['hard_hit_percent', 'Hard-hit %'], ['bat_speed', 'Bat speed'], ['squared_up_rate', 'Squared-up %'], ['chase_percent', 'Chase rate'], ['whiff_percent', 'Whiff %'], ['k_percent', 'K %'], ['bb_percent', 'BB %'], ['sprint_speed', 'Sprint speed'], ['oaa', 'Outs above avg'], ['arm_strength', 'Arm strength']];
const PITCHER_PCT = [['xera', 'xERA'], ['xba', 'xBA'], ['fb_velocity', 'Fastball velo'], ['fb_spin', 'Fastball spin'], ['curve_spin', 'Curve spin'], ['exit_velocity', 'Avg exit velo'], ['chase_percent', 'Chase rate'], ['whiff_percent', 'Whiff %'], ['k_percent', 'K %'], ['bb_percent', 'BB %'], ['brl_percent', 'Barrel %'], ['hard_hit_percent', 'Hard-hit %'], ['extension', 'Extension']];
function pctList(row, spec) {
  if (!row) return [];
  return spec.map(([k, label]) => ({ key: k, label: label, pct: num(row[k]) })).filter(x => x.pct != null);
}

const SPEED_COLS = { FF: 'ff', SI: 'si', FC: 'fc', SL: 'sl', CH: 'ch', CU: 'cu', FS: 'fs', KN: 'kn', ST: 'st', SV: 'sv', KC: 'cu' };
async function arsenal(id, year) {
  const [stats, speeds] = await Promise.all([
    csv('https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=' + year + '&team=&min=1&csv=true').catch(() => []),
    csv('https://baseballsavant.mlb.com/leaderboard/pitch-arsenals?year=' + year + '&min=1&type=avg_speed&hand=&csv=true').catch(() => [])
  ]);
  const sp = speeds.find(r => String(r.pitcher || r.player_id) === String(id)) || {};
  const avg = {};
  Object.keys(SPEED_COLS).forEach(code => { const v = num(sp[SPEED_COLS[code] + '_avg_speed']); if (v != null) avg[code] = v; });
  const mix = stats.filter(r => String(r.player_id) === String(id)).map(r => ({
    code: r.pitch_type, name: r.pitch_name || r.pitch_type,
    usage: num(r.pitch_usage), whiff: num(r.whiff_percent), rv100: num(r.run_value_per_100),
    mph: avg[r.pitch_type] != null ? avg[r.pitch_type] : null
  })).sort((a, b) => (b.usage || 0) - (a.usage || 0));
  return { avgSpeed: avg, mix: mix };
}

const HIT_EV = /^(single|double|triple|home_run)$/;
const AB_EV = /^(single|double|triple|home_run|field_out|strikeout|grounded_into_double_play|double_play|force_out|fielders_choice|fielders_choice_out|field_error|strikeout_double_play|triple_play)$/;
async function batterSeason(id, year) {
  const url = 'https://baseballsavant.mlb.com/statcast_search/csv?all=true&hfGT=R%7C&hfSea=' + year + '%7C&player_type=batter&batters_lookup%5B%5D=' + encodeURIComponent(id) + '&type=details';
  const rows = await csv(url, 6 * 3600 * 1000, 7200);
  const spray = [], zones = {};
  let bsSum = 0, bsN = 0;
  rows.forEach(r => {
    const ev = String(r.events || '');
    const bs = num(r.bat_speed); if (bs != null && bs > 40) { bsSum += bs; bsN++; }
    if (ev && num(r.hc_x) != null && num(r.hc_y) != null && spray.length < 500) spray.push({ x: num(r.hc_x), y: num(r.hc_y), ev: ev });
    const z = num(r.zone);
    if (ev && AB_EV.test(ev) && z >= 1 && z <= 9) {
      const b = zones[z] || (zones[z] = { ab: 0, h: 0 });
      b.ab++; if (HIT_EV.test(ev)) b.h++;
    }
  });
  const zoneAvg = {};
  Object.keys(zones).forEach(z => { if (zones[z].ab >= 3) zoneAvg[z] = { avg: Math.round(zones[z].h / zones[z].ab * 1000) / 1000, ab: zones[z].ab }; });
  return { spray: spray, zones: zoneAvg, avgBatSpeed: bsN ? round1(bsSum / bsN) : null };
}
async function sprint(id, year) {
  const rows = await csv('https://baseballsavant.mlb.com/leaderboard/sprint_speed?year=' + year + '&position=&team=&min=0&csv=true').catch(() => []);
  const r = rows.find(x => String(x.player_id) === String(id));
  return r ? num(r.sprint_speed) : null;
}

return async function handler(req, res) {
  const mode = req.query.smode || req.query.mode;
  const year = yearOf(req.query.year);
  const id = req.query.id;
  try {
    // GET /api/savant?mode=ping — quick check that this server can reach
    // Baseball Savant at all (status + first bytes of each source).
    if (mode === 'ping') {
      const probe = async (name, url) => {
        const t0 = Date.now();
        try {
          const r = await fetch(url, { headers: UA });
          const txt = await r.text();
          return { name: name, status: r.status, ms: Date.now() - t0, bytes: txt.length, starts: txt.slice(0, 80) };
        } catch (e) { return { name: name, error: String(e && e.message || e), ms: Date.now() - t0 }; }
      };
      const y = new Date().getFullYear();
      const out = await Promise.all([
        probe('percentiles', 'https://baseballsavant.mlb.com/leaderboard/percentile-rankings?type=batter&year=' + y + '&position=&team=&csv=true'),
        probe('sprint', 'https://baseballsavant.mlb.com/leaderboard/sprint_speed?year=' + y + '&position=&team=&min=0&csv=true'),
        probe('mlb', 'https://statsapi.mlb.com/api/v1/sports/1')
      ]);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ node: process.version, results: out });
      return;
    }
    if (mode === 'game') {
      const pk = req.query.gamePk;
      if (!pk) { res.status(400).json({ error: 'Missing gamePk' }); return; }
      const out = await gameMode(pk);
      res.setHeader('Cache-Control', req.query.live ? 's-maxage=15, stale-while-revalidate=15' : 's-maxage=86400, stale-while-revalidate');
      res.status(200).json(out);
      return;
    }
    if (!id) { res.status(400).json({ error: 'Missing id' }); return; }
    if (mode === 'arsenal') {
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate');
      res.status(200).json(await arsenal(id, year));
      return;
    }
    if (mode === 'batter') {
      const budget = new Promise(r => setTimeout(() => r(null), 7500));
      const [season, sp] = await Promise.all([Promise.race([batterSeason(id, year).catch(() => null), budget]), Promise.race([sprint(id, year).catch(() => null), budget])]);
      res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate');
      res.status(200).json(Object.assign({ sprintSpeed: sp }, season || {}));
      return;
    }
    if (mode === 'player') {
      // v5.89.0: everything starts at once and the answer goes out within a
      // time budget (Vercel stops functions at ~10s) — whatever arrived is
      // sent, and a partial answer is only cached briefly so it fills in.
      const dbg = {};
      const track = (name, p) => p.then(v => { dbg[name] = 'ok'; return v; }, e => { dbg[name] = 'error: ' + (e && e.message || e); return null; });
      const got = {};
      const jobs = {
        bRow: track('percentiles-batter', percentileRow('batter', id, year)),
        pRow: track('percentiles-pitcher', percentileRow('pitcher', id, year)),
        ars: track('arsenal', arsenal(id, year)),
        season: track('batter-season', batterSeason(id, year)),
        sprint: track('sprint', sprint(id, year))
      };
      Object.keys(jobs).forEach(k => jobs[k].then(v => { got[k] = v; }));
      const all = Promise.all(Object.values(jobs));
      const done = await Promise.race([all.then(() => true), new Promise(r => setTimeout(() => r(false), 7500))]);
      const out = { year: year, partial: !done, batter: null, pitcher: null, sprintSpeed: got.sprint != null ? got.sprint : null };
      if (got.pRow || (got.ars && got.ars.mix && got.ars.mix.length)) out.pitcher = { percentiles: pctList(got.pRow, PITCHER_PCT), arsenal: got.ars ? got.ars.mix : [] };
      if (got.bRow || (got.season && got.season.spray && got.season.spray.length)) out.batter = Object.assign({ percentiles: pctList(got.bRow, BATTER_PCT) }, got.season || {});
      if (req.query.debug) out.debug = dbg;
      res.setHeader('Cache-Control', done ? 's-maxage=21600, stale-while-revalidate' : 's-maxage=60, stale-while-revalidate');
      res.status(200).json(out);
      return;
    }
    res.status(400).json({ error: 'Unknown mode — use game, arsenal, batter or player' });
  } catch (err) {
    console.error('[savant]', mode, err && err.message);
    res.status(502).json({ error: 'Baseball Savant unavailable', detail: String(err && err.message || err) });
  }
};

})();


// ── ABS CHALLENGES (v6.3.0) ───────────────────────────────────────────────
// A challenged pitch carries reviewDetails with reviewType "MJ" (player ABS
// challenge; "NJ" also seen for ABS) and details.hasReview. The call on the
// pitch is the final one; isOverturned says whether the umpire's call changed.
var _absTeamIds = {};
function _absOf(e) {
  var rv = e && e.reviewDetails;
  if (!rv || !/^[MN]J$/.test(String(rv.reviewType || ''))) return null;
  var id = rv.challengeTeamId != null ? rv.challengeTeamId : null;
  var side = id == null ? null : (id === _absTeamIds.away ? 'away' : (id === _absTeamIds.home ? 'home' : null));
  return { overturned: !!rv.isOverturned, inProgress: !!rv.inProgress, teamId: id, side: side };
}


// ── DROPPED THIRD STRIKE (v6.4.0) ─────────────────────────────────────────
// MLB labels a strike in the dirt "(Blocked)" — a pitch location, not what
// the catcher did — so on its own it reads wrong. When strike three gets
// by the catcher, the batter's own runner record shows it: thrown out at
// first by the catcher (a putout/assist by someone other than the catcher
// alone) or safe at first.
function _droppedK(play) {
  if (!play) return null;
  var bat = play.matchup && play.matchup.batter && play.matchup.batter.id;
  var et = (play.result && play.result.eventType) || '';
  var last = null;
  (play.playEvents || []).forEach(function (e) { if (e && e.isPitch) last = e; });
  if (!last) return null;
  var lastCall = String((last.details && last.details.call && last.details.call.description) || '');
  var third = /^strikeout/.test(et) || (last.count && last.count.strikes === 3 && /strike/i.test(lastCall));
  if (!third) return null;
  var res = null;
  (play.runners || []).forEach(function (r) {
    var id = r.details && r.details.runner && r.details.runner.id;
    if (bat == null || id !== bat) return;
    var mv = r.movement || {};
    if (mv.isOut) {
      var others = (r.credits || []).some(function (c) { return c.position && c.position.code && c.position.code !== '2' && !/deflect/.test(c.credit || ''); });
      if (others) res = 'out';
    } else if (mv.end === '1B' || mv.end === '2B') res = 'safe';
  });
  return res;
}
function _callText(e, play, dk) {
  var d = (e && e.details) || {};
  var c = (d.call && d.call.description) || d.description || null;
  if (!c) return c;
  var last = null;
  ((play && play.playEvents) || []).forEach(function (x) { if (x && x.isPitch) last = x; });
  if (dk && e === last) return c.replace(/\s*\(Blocked\)/, '') + ' (Dropped)';
  return c.replace(/\(Blocked\)/, '(In Dirt)');
}


// ── EXTRA-INNING RUNNER (v6.7.1) ──────────────────────────────────────────
// The automatic runner on second is a regular-season (and spring) rule; the
// postseason plays extra innings without it. Unknown game type: assume the
// regular season, the only case you'll see day to day.
var _gameType = null;
function _ghostRunnerRule() { return !_gameType || _gameType === 'R' || _gameType === 'S' || _gameType === 'E'; }


// ── POSTSEASON (v6.8.0) ───────────────────────────────────────────────────
// gameType F = Wild Card, D = Division Series, L = League Championship
// Series, W = World Series. League from the teams (103 AL, 104 NL).
function _postseasonFields(g) {
  var t = g && g.gameType;
  var aT = g.teams && g.teams.away && g.teams.away.team || {}, hT = g.teams && g.teams.home && g.teams.home.team || {};
  var out = { awayAbbr: aT.abbreviation || null, homeAbbr: hT.abbreviation || null, awayId: aT.id || null, homeId: hT.id || null };
  if (!/^[FDLW]$/.test(t || '')) return out;
  var lgId = (aT.league && aT.league.id) || (hT.league && hT.league.id) || null;
  out.gameType = t;
  out.league = t === 'W' ? null : (lgId === 103 ? 'AL' : lgId === 104 ? 'NL' : null);
  out.seriesGameNumber = g.seriesGameNumber != null ? g.seriesGameNumber : null;
  out.gamesInSeries = g.gamesInSeries != null ? g.gamesInSeries : null;
  out.seriesDescription = g.seriesDescription || null;
  var ss = g.seriesStatus;
  if (ss) {
    var winId = ss.winningTeam && ss.winningTeam.id;
    out.series = { wins: ss.wins != null ? ss.wins : null, losses: ss.losses != null ? ss.losses : null, tied: !!ss.isTied, over: !!ss.isOver,
      leader: winId == null ? null : (winId === aT.id ? 'away' : winId === hT.id ? 'home' : null), text: ss.description || ss.shortDescription || null };
  }
  return out;
}
