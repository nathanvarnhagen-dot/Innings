// Vercel Serverless Function — GET /api/mlb?mode=schedule&date=YYYY-MM-DD
//                               GET /api/mlb?mode=boxscore&gamePk=<id>[&plays=all]
//                               GET /api/mlb?mode=search&q=<name>
// Proxies the public MLB Stats API (statsapi.mlb.com, no key required) so
// the browser doesn't have to fetch it directly, and trims the response
// down to what a memory card actually needs.

// v7.45.0: per game, the timestamps-list entry and feed stamp from the last full fetch (warm instances only)
const _FEED_SEEN = global.__inningsFeedSeen || (global.__inningsFeedSeen = new Map());

module.exports = async function handler(req, res) {
  const mode = req.query.mode;
  // v5.91.0: Baseball Savant runs inside this function (see api/_savant.js)
  if (mode === 'savant') return savantHandler(req, res);

  try {
    if (mode === 'schedule') {
      const date = req.query.date;
      if (!date) { res.status(400).json({ error: 'Missing date' }); return; }
      // v6.8.0: team + seriesStatus hydrated for postseason games
      const url = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&hydrate=team,seriesStatus,probablePitcher,linescore&date=' + encodeURIComponent(date);
      const r = await fetch(url);
      const data = await r.json();
      const games = [];
      // v6.9.0: probable starters' season lines (one people request for the whole day)
      const spIds = [];
      (data.dates || []).forEach(function (d) { (d.games || []).forEach(function (g) {
        ['away', 'home'].forEach(function (k) { var pp = g.teams && g.teams[k] && g.teams[k].probablePitcher; if (pp && pp.id && spIds.indexOf(pp.id) === -1) spIds.push(pp.id); });
      }); });
      const spLines = await _probableLines(spIds, String(date).slice(0, 4));
      (data.dates || []).forEach(function (d) {
        (d.games || []).forEach(function (g) {
          _mlbEndEarly(g.status, g.linescore); // v7.71.0
          var sp = {};
          ['away', 'home'].forEach(function (k) { var pp = g.teams && g.teams[k] && g.teams[k].probablePitcher; if (pp && pp.id) sp[k + 'Probable'] = Object.assign({ id: pp.id, name: pp.fullName || null }, spLines[pp.id] || {}); });
          games.push(Object.assign(sp, {
            gamePk: g.gamePk,
            status: g.status && g.status.detailedState,
            away: g.teams && g.teams.away && g.teams.away.team && g.teams.away.team.name,
            home: g.teams && g.teams.home && g.teams.home.team && g.teams.home.team.name,
            awayScore: g.teams && g.teams.away ? g.teams.away.score : null,
            homeScore: g.teams && g.teams.home ? g.teams.home.score : null,
            venue: g.venue && g.venue.name,
            startTime: g.gameDate || null,
            // v7.16.0: where a live game stands, for the Home "Live now" list
            inning: (g.linescore && g.linescore.currentInning) || null,
            inningHalf: (g.linescore && g.linescore.inningHalf) || null,
            inningState: (g.linescore && g.linescore.inningState) || null,
            outs: g.linescore && g.linescore.outs != null ? g.linescore.outs : null,
            // v7.38.0: the count, who's on base and who's up, for Multi view's live tiles
            balls: g.linescore && g.linescore.balls != null ? g.linescore.balls : null,
            strikes: g.linescore && g.linescore.strikes != null ? g.linescore.strikes : null,
            bases: _schedBases(g.linescore),
            batter: _schedPerson(g.linescore && g.linescore.offense && g.linescore.offense.batter),
            pitcher: _schedPerson(g.linescore && g.linescore.defense && g.linescore.defense.pitcher),
            // v7.16.1: playoff games often go up before their time is set
            startTimeTBD: !!(g.status && g.status.startTimeTBD)
          }, _postponementFields(g, d), _postseasonFields(g)));
        });
      });
      // v5.85.0: scores on the schedule list refresh within ~15s (was 5 min).
      res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=15');
      res.status(200).json({ games: games });
      return;
    }

    // GET /api/mlb?mode=glance&pks=a,b,c  (v7.59.0)
    // Multi view's baseball tiles: the pitches of the at-bat in progress
    // (for the little zone), the count and runners, and the last finished
    // play with its hit data — enough to take the tile over on a hit. Reads
    // the play-by-play + linescore (a third of the live feed) for up to four
    // games at once; a bad game comes back null, never a failed request.
    if (mode === 'glance') {
      const pks = String(req.query.pks || '').split(',').map(function (s) { return s.trim(); }).filter(function (s) { return /^\d+$/.test(s); }).slice(0, 4);
      const games = {};
      await Promise.all(pks.map(async function (pk) {
        try {
          const parts = await Promise.all([
            fetch('https://statsapi.mlb.com/api/v1/game/' + pk + '/playByPlay').then(function (r) { return r.ok ? r.json() : null; }),
            fetch('https://statsapi.mlb.com/api/v1/game/' + pk + '/linescore').then(function (r) { return r.ok ? r.json() : null; })
          ]);
          games[pk] = _glanceOf(parts[0], parts[1]);
        } catch (e) { games[pk] = null; }
      }));
      res.setHeader('Cache-Control', 's-maxage=8, stale-while-revalidate=8');
      res.status(200).json({ games: games });
      return;
    }

    // GET /api/mlb?mode=phase[&date=YYYY-MM-DD]  (v7.40.0)
    // Where the season stands, in a few words, for the Games page's MLB tile:
    // "Spring training", "Regular season", the round(s) being played in
    // October ("Wild Card", "NLDS & ALDS", "NLCS & ALCS", "World Series"),
    // or "Offseason". The dates come from MLB's season record; the round is
    // the earliest one that still has a series going (or yet to start).
    if (mode === 'phase') {
      const today = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
      const out = await _mlbPhase(today);
      // an answer keeps for ten minutes; a failed lookup is asked again soon
      // (v7.41.0: with series scores in the answer it keeps for two minutes)
      res.setHeader('Cache-Control', out.series ? 's-maxage=120, stale-while-revalidate=120' : out.label ? 's-maxage=600, stale-while-revalidate=3600' : 's-maxage=30');
      res.status(200).json(out);
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
      const games = [], seen = {};
      (data.dates || []).forEach(function (d) {
        (d.games || []).forEach(function (g) {
          var row = Object.assign({
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
          }, _postponementFields(g, d), _postseasonFields(g));
          // v7.49.0: a postponed game is listed twice — on the day it was
          // rained out (status Postponed) and again on its makeup day. Keep
          // one row per gamePk: the makeup listing, carrying the original day.
          var k = String(g.gamePk);
          if (seen[k] != null) {
            var old = games[seen[k]];
            if (row.postponed && !old.postponed) { old.rescheduledFrom = old.rescheduledFrom || row.date; old.reason = old.reason || row.reason; }
            else { row.rescheduledFrom = row.rescheduledFrom || old.date; row.reason = row.reason || old.reason; games[seen[k]] = row; }
          } else { seen[k] = games.length; games.push(row); }
        });
      });
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
      res.status(200).json({ season: season, games: games });
      return;
    }

    // GET /api/mlb?mode=season&id=<id>[&season=YYYY]  (v7.7.0)
    // A player's regular-season line (pitching and/or hitting), hand,
    // position and team — the top of the player sheet.
    if (mode === 'season') {
      const id = req.query.id;
      if (!id) { res.status(400).json({ error: 'Missing id' }); return; }
      const yr = parseInt(req.query.season, 10) || new Date().getFullYear();
      const map = await _regSeason([id], yr);
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
      res.status(200).json(map[String(id)] ? Object.assign({ season: yr }, map[String(id)]) : { error: 'No season line' });
      return;
    }

    // GET /api/mlb?mode=splits&id=<id>[&season=YYYY]  (v7.14.0)
    // The top of the player sheet: postseason line (once he has one), and
    // the last 7 / 14 / 30 days — regular season and postseason added
    // together, since a window in October spans both.
    if (mode === 'splits') {
      const id = req.query.id;
      if (!id) { res.status(400).json({ error: 'Missing id' }); return; }
      const yr = parseInt(req.query.season, 10) || new Date().getFullYear();
      const day = d => d.toISOString().slice(0, 10);
      const now = new Date(), end = day(now);
      const back = n => day(new Date(now.getTime() - (n - 1) * 86400000));
      const base = 'https://statsapi.mlb.com/api/v1/people/' + encodeURIComponent(id) + '/stats?group=hitting,pitching&sportId=1';
      const get = async (q) => { try { const r = await fetch(base + q); const j = await r.json(); return j.stats || []; } catch (e) { return []; } };
      const pick = (blocks, g) => { const b = blocks.find(x => x.group && x.group.displayName === g); return b && b.splits && b.splits[0] ? b.splits[0].stat : null; };
      const N = v => v == null ? 0 : Number(v) || 0;
      const outsOf = st => st.outs != null ? N(st.outs) : (function (ip) { const p = String(ip || '0').split('.'); return N(p[0]) * 3 + N(p[1]); })(st.inningsPitched);
      const sumH = list => { const t = { g: 0, pa: 0, ab: 0, h: 0, tb: 0, hr: 0, rbi: 0, bb: 0, hbp: 0, sf: 0, k: 0 }; let any = false;
        list.forEach(st => { if (!st) return; any = true; t.g += N(st.gamesPlayed); t.pa += N(st.plateAppearances); t.ab += N(st.atBats); t.h += N(st.hits); t.tb += N(st.totalBases); t.hr += N(st.homeRuns); t.rbi += N(st.rbi); t.bb += N(st.baseOnBalls); t.hbp += N(st.hitByPitch); t.sf += N(st.sacFlies); t.k += N(st.strikeOuts); });
        if (!any || !t.pa) return null;
        const r3 = x => x == null || !isFinite(x) ? null : (x >= 1 ? x.toFixed(3) : x.toFixed(3).replace(/^0/, ''));
        const obpD = t.ab + t.bb + t.hbp + t.sf;
        return { g: t.g, pa: t.pa, avg: t.ab ? r3(t.h / t.ab) : null, obp: obpD ? r3((t.h + t.bb + t.hbp) / obpD) : null, slg: t.ab ? r3(t.tb / t.ab) : null, hr: t.hr, rbi: t.rbi, bb: t.bb, k: t.k, h: t.h, ab: t.ab }; };
      const sumP = list => { const t = { g: 0, outs: 0, er: 0, k: 0, bb: 0, h: 0 }; let any = false;
        list.forEach(st => { if (!st) return; any = true; t.g += N(st.gamesPlayed); t.outs += outsOf(st); t.er += N(st.earnedRuns); t.k += N(st.strikeOuts); t.bb += N(st.baseOnBalls); t.h += N(st.hits); });
        if (!any || !t.outs) return null;
        return { g: t.g, ip: Math.floor(t.outs / 3) + '.' + (t.outs % 3), era: (t.er * 27 / t.outs).toFixed(2), whip: ((t.bb + t.h) * 3 / t.outs).toFixed(2), k: t.k, bb: t.bb }; };
      const win = n => '&stats=byDateRange&startDate=' + back(n) + '&endDate=' + end + '&season=' + yr;
      const qs = [ '&stats=season&season=' + yr + '&gameType=P' ];
      [7, 14, 30].forEach(n => { qs.push(win(n) + '&gameType=R'); qs.push(win(n) + '&gameType=P'); });
      const res2 = await Promise.all(qs.map(get));
      const line = (blocks) => ({ hitting: sumH(blocks.map(b => pick(b, 'hitting'))), pitching: sumP(blocks.map(b => pick(b, 'pitching'))) });
      const post = line([res2[0]]);
      const out = { season: yr, post: (post.hitting || post.pitching) ? post : null, last7: line([res2[1], res2[2]]), last14: line([res2[3], res2[4]]), last30: line([res2[5], res2[6]]) };
      res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate');
      res.status(200).json(out);
      return;
    }

    // GET /api/mlb?mode=compare&id=<id>[&group=hitting|pitching][&season=YYYY]  (v7.76.0, v7.78.0)
    // One player's side of a compare, active or retired: this season, his
    // recent games (15 for hitters, 5 for pitchers) and his career, where
    // this season ranks among qualified MLB players (percentiles), and his
    // career so far at every age (the By age tab).
    if (mode === 'compare') {
      const id = req.query.id;
      if (!id) { res.status(400).json({ error: 'Missing id' }); return; }
      const yr = parseInt(req.query.season, 10) || new Date().getFullYear();
      const out = await _cmpPlayer(String(id), yr, req.query.group);
      if (!out) { res.status(502).json({ error: 'No compare data' }); return; }
      res.setHeader('Cache-Control', out.partial ? 's-maxage=60' : 's-maxage=1800, stale-while-revalidate');
      res.status(200).json(out);
      return;
    }

    // GET /api/mlb?mode=history&teamId=<id>  (v7.80.0)
    // A franchise's every season and every postseason series. 1871–2021 come
    // from data/mlb-history.json (Lahman / Baseball Databank, CC BY-SA),
    // served as a static file; later seasons from MLB's standings and
    // postseason schedule, one call each per season, cached.
    if (mode === 'history') {
      const tid = String(req.query.teamId || '');
      if (!tid) { res.status(400).json({ error: 'Missing teamId' }); return; }
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const base = await _histBase(host).catch(() => null);
      const t = base && base.teams && base.teams[tid];
      if (!t) { res.status(404).json({ error: 'No history for this team' }); return; }
      const now = new Date().getFullYear(), years = [];
      for (let y = base.through + 1; y <= now; y++) years.push(y);
      const live = await Promise.all(years.map(y => _histLiveSeason(y, tid).catch(() => null)));
      const seasons = t.seasons.slice(), post = t.post.slice();
      let partial = false;
      live.forEach((L, i) => {
        if (!L) { partial = true; return; }
        if (L.season) seasons.unshift(L.season);
        L.post.forEach(p => post.unshift(p));
        if (L.ongoing) partial = true;
      });
      seasons.sort((a, b) => b[0] - a[0]);
      post.sort((a, b) => b[0] - a[0]);
      res.setHeader('Cache-Control', partial ? 's-maxage=600, stale-while-revalidate' : 's-maxage=43200, stale-while-revalidate');
      res.status(200).json({ teamId: +tid, seasons: seasons, post: post, through: base.through });
      return;
    }

    // GET /api/mlb?mode=career&id=<id>  (v7.80.0)
    // A retired player's card: career line, honors, every season (teams
    // added together, gaps marked), whether his team won it all that year,
    // and when he's first eligible for the Hall of Fame.
    if (mode === 'career') {
      const id = String(req.query.id || '');
      if (!id) { res.status(400).json({ error: 'Missing id' }); return; }
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const out = await _careerCard(id, host);
      if (!out) { res.status(404).json({ error: 'No career found' }); return; }
      res.setHeader('Cache-Control', out.active ? 's-maxage=1800, stale-while-revalidate' : 's-maxage=86400, stale-while-revalidate');
      res.status(200).json(out);
      return;
    }

    // GET /api/mlb?mode=hof  (v7.78.0)
    // Hall of Fame players (not managers or executives) with their primary
    // position and years — the compare picker's "Hall of Famers at 3B".
    if (mode === 'hof') {
      const now = Date.now(), c = global.__inningsHof;
      if (c && now - c.at < 7 * 86400e3) { res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate'); res.status(200).json(c.v); return; }
      const rec = await _tpGetJson(_CMP_API + '/awards/MLBHOF/recipients?sportId=1');
      const ids = Array.from(new Set(((rec && rec.awards) || []).map(a => a && a.player && a.player.id).filter(Boolean)));
      const batches = [];
      for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100));
      const got = await Promise.all(batches.map(b => _tpGetJson(_CMP_API + '/people?personIds=' + b.join(','))));
      const players = [];
      got.forEach(j => ((j && j.people) || []).forEach(p => {
        if (!p.mlbDebutDate) return;
        players.push({ id: p.id, name: p.fullName, pos: (p.primaryPosition && p.primaryPosition.abbreviation) || null,
          first: +String(p.mlbDebutDate).slice(0, 4), last: p.lastPlayedDate ? +String(p.lastPlayedDate).slice(0, 4) : null });
      }));
      const v = { players: players };
      if (players.length) global.__inningsHof = { at: now, v: v };
      res.setHeader('Cache-Control', players.length ? 's-maxage=604800, stale-while-revalidate' : 's-maxage=300');
      res.status(200).json(v);
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
      // v7.45.0: the game screen polls every 3–6s but the feed only changes
      // every pitch or so. The client sends the feed's last timeStamp it saw
      // (&since=…); MLB's tiny timestamps list says whether anything is newer,
      // and if not this returns at once — no 1–3MB download, no re-summarize.
      // (That's what was eating Vercel's function CPU.)
      // The list's last entry can run a step past the feed's own timeStamp, so
      // the pair seen on the last full fetch is remembered per game: same last
      // entry + same feed stamp the client holds → nothing new.
      let latest = null;
      if (req.query.since) {
        try {
          const tr = await fetch(url + '/timestamps');
          const stamps = await tr.json();
          latest = Array.isArray(stamps) && stamps.length ? String(stamps[stamps.length - 1]) : null;
          const seen = _FEED_SEEN.get(String(gamePk));
          if (latest && (latest === String(req.query.since) || (seen && seen.latest === latest && seen.feedTs === String(req.query.since)))) {
            res.setHeader('Cache-Control', 'no-store');
            res.status(200).json({ gamePk: gamePk, unchanged: true, feedTs: req.query.since });
            return;
          }
        } catch (e) { /* fall through to the full feed */ }
      }
      const r = await fetch(url);
      const data = await r.json();
      const feedTs = (data && data.metaData && data.metaData.timeStamp) || null;
      if (feedTs) _FEED_SEEN.set(String(gamePk), { latest: latest || feedTs, feedTs: String(feedTs), at: Date.now() });
      // v5.85.0: a live game is only cached for a few seconds at the edge
      // (it was a full minute, so polling faster never showed anything
      // newer); finished games can sit much longer.
      const st = (data && data.gameData && data.gameData.status && data.gameData.status.abstractGameState) || '';
      res.setHeader('Cache-Control', st === 'Live' ? 's-maxage=3, stale-while-revalidate=5' : st === 'Final' ? 's-maxage=300, stale-while-revalidate' : 's-maxage=30, stale-while-revalidate');
      const out = summarize(data, gamePk, req.query.plays === 'all');
      // v7.36.0: the game screen (plays=all) also gets who is still available
      // on each side during a live game — bench, bullpen, spare starters
      const jobs = [_seasonLinesForMatchup(out, data).catch(function () { /* keep the box score even if this lookup fails */ })];
      if (req.query.plays === 'all' && st === 'Live') jobs.push(_reserves(out, data).catch(function (e) { console.error('[reserves]', e); }));
      await Promise.all(jobs);
      out.feedTs = feedTs; // v7.45.0: for &since=
      // &only=reserves: just that list, for checking it without the whole play-by-play
      if (req.query.only === 'reserves') { res.status(200).json({ gamePk: out.gamePk, gameState: out.gameState, reserves: out.reserves || null }); return; }
      res.status(200).json(out);
      return;
    }

    if (mode === 'pregame') {
      const gamePk = req.query.gamePk;
      if (!gamePk) { res.status(400).json({ error: 'Missing gamePk' }); return; }
      const url = 'https://statsapi.mlb.com/api/v1.1/game/' + encodeURIComponent(gamePk) + '/feed/live';
      const r = await fetch(url);
      const data = await r.json();
      const result = await summarizePregame(data);
      // v7.45.1: lineups land any time in the hours before first pitch — a
      // projected lineup is only cached briefly, and never served stale for
      // long, so the real one shows within a minute of being posted
      const posted = result && result.away && result.home && !result.away.projected && !result.home.projected;
      res.setHeader('Cache-Control', posted ? 's-maxage=300, stale-while-revalidate=120' : 's-maxage=45, stale-while-revalidate=30');
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
    // GET /api/mlb?mode=goldgloves&ids=1,2,3  (v7.30.0)
    // How many Gold Gloves each player has won ({ "605141": 2, ... }; players
    // with none are left out). Awards rarely change, so this is cached a day.
    if (mode === 'goldgloves') {
      const ids = String(req.query.ids || '').split(',').map(function (x) { return x.trim(); }).filter(function (x) { return /^\d+$/.test(x); }).slice(0, 12);
      const out = {};
      await Promise.all(ids.map(async function (id) {
        try {
          const r = await fetch('https://statsapi.mlb.com/api/v1/people/' + id + '/awards');
          const d = await r.json();
          const seen = {};
          (d.awards || []).forEach(function (a) {
            const nm = String((a && a.name) || ''), aid = String((a && a.id) || '');
            if ((/gold\s*glove/i.test(nm) && !/platinum/i.test(nm)) || /^(AL|NL)GG$/.test(aid)) seen[(a.season || '') + ':' + aid + nm] = 1;
          });
          const n = Object.keys(seen).length;
          if (n) out[id] = n;
        } catch (e) { /* leave this player out */ }
      }));
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
      res.status(200).json({ gold: out });
      return;
    }

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
      const all = req.query.all === '1'; // v7.78.0: retired players too (compare picker)
      // v7.78.1: MLB's name search only covers recent players, so for the
      // compare picker every MLB player ever is searched in data/mlb-players.json
      // (static, read once per instance), then MLB fills in position / Hall of Fame.
      if (all) {
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const [reg, live] = await Promise.all([
          _cmpRegisterSearch(q, host).catch(() => []),
          _tpGetJson('https://statsapi.mlb.com/api/v1/people/search?names=' + encodeURIComponent(q) + '&sportIds=1&hydrate=currentTeam')
        ]);
        const ids = [], seen = {};
        const add = id => { id = String(id); if (!seen[id] && ids.length < 20) { seen[id] = 1; ids.push(id); } };
        reg.forEach(r => add(r[0]));
        ((live && live.people) || []).forEach(p => { if (p && p.mlbDebutDate) add(p.id); });
        if (!ids.length) { res.setHeader('Cache-Control', 's-maxage=600'); res.status(200).json({ players: [] }); return; }
        const pj = await _tpGetJson(_CMP_API + '/people?personIds=' + ids.join(',') + '&hydrate=currentTeam,awards');
        const byId = {};
        ((pj && pj.people) || []).forEach(p => { byId[String(p.id)] = p; });
        const regById = {}; reg.forEach(r => { regById[String(r[0])] = r; });
        const players = ids.map(id => {
          const p = byId[id], r = regById[id];
          if (!p && !r) return null;
          const active = p ? p.active !== false : false, t = (p && p.currentTeam) || {};
          return {
            id: +id, name: (p && p.fullName) || r[1], pos: _cmpPos(p),
            team: active ? (t.name || null) : null, teamId: active ? (t.id || null) : null, league: 'mlb', active: active,
            first: p && p.mlbDebutDate ? +String(p.mlbDebutDate).slice(0, 4) : (r ? r[2] : null),
            last: active ? null : (p && p.lastPlayedDate ? +String(p.lastPlayedDate).slice(0, 4) : (r ? r[3] : null)),
            hof: !!(p && _cmpIsHof(p.awards))
          };
        }).filter(Boolean);
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        res.status(200).json({ players: players });
        return;
      }
      const data = await _tpGetJson('https://statsapi.mlb.com/api/v1/people/search?names=' + encodeURIComponent(q) + '&sportIds=1' + (all ? '&hydrate=currentTeam,awards' : '&active=true&hydrate=currentTeam'));
      if (!data) { res.status(502).json({ error: 'MLB search failed', players: [] }); return; }
      const players = (data.people || []).filter(function (p) { return p && p.fullName && (all ? !!p.mlbDebutDate : p.active !== false); }).slice(0, 20).map(function (p) {
        const t = p.currentTeam || {};
        const out = {
          id: p.id,
          name: p.fullName,
          pos: (p.primaryPosition && p.primaryPosition.abbreviation) || null,
          team: t.name || null,
          teamId: t.id || null,
          league: 'mlb'
        };
        if (all) {
          out.active = p.active !== false;
          if (!out.active) { out.team = null; out.teamId = null; }
          out.first = p.mlbDebutDate ? +String(p.mlbDebutDate).slice(0, 4) : null;
          out.last = !out.active && p.lastPlayedDate ? +String(p.lastPlayedDate).slice(0, 4) : null;
          out.hof = _cmpIsHof(p.awards);
        }
        return out;
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
  _mlbEndEarly(gameData.status, linescore); // v7.71.0
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
    // v7.6.0: one source of truth for who's batting. The at-bat in progress
    // (currentPlay, not yet complete) knows about a pinch hitter the moment
    // he's announced; linescore.offense.batter can lag behind and kept
    // showing the replaced hitter. Between at-bats (current play already
    // complete) linescore.offense is the next man up, as before.
    var cpNow = liveData.plays && liveData.plays.currentPlay;
    var cpOpen = !!(cpNow && cpNow.about && !cpNow.about.isComplete && cpNow.matchup && cpNow.matchup.batter && cpNow.matchup.batter.id);
    var batPerson = cpOpen ? cpNow.matchup.batter : offense.batter;
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
      batter: batPerson ? _liveParticipant(batPerson, boxTeams, 'batting') : null
    };
    // v7.14.0: who's at every position for the team in the field (the
    // game page's Defense view)
    var _dPos = { pitcher: 'P', catcher: 'C', first: '1B', second: '2B', third: '3B', shortstop: 'SS', left: 'LF', center: 'CF', right: 'RF' };
    var _dOut = {};
    Object.keys(_dPos).forEach(function (k) { var dp = defense[k]; if (dp && dp.id) _dOut[_dPos[k]] = { id: dp.id, name: dp.fullName || null }; });
    matchup.defense = Object.keys(_dOut).length ? _dOut : null;
    // v7.7.0: pitcher's hand, team, batters faced today, and who he
    // replaced (the previous name in his team's pitchers list) — the
    // "Now pitching" card shows for a reliever's first batter.
    if (matchup.pitcher && matchup.pitcher.id) {
      var pId = matchup.pitcher.id, pInfo = (gameData.players || {})['ID' + pId] || {};
      matchup.pitcher.hand = (pInfo.pitchHand && pInfo.pitchHand.code) || null;
      ['away', 'home'].forEach(function (side) {
        var bt = boxTeams[side] || {}, list = bt.pitchers || [];
        var ix = list.indexOf(pId);
        if (ix === -1) return;
        matchup.pitcher.teamAbbr = (gameData.teams && gameData.teams[side] && gameData.teams[side].abbreviation) || null;
        matchup.pitcher.relief = ix > 0;
        if (ix > 0) {
          var prev = (bt.players || {})['ID' + list[ix - 1]];
          matchup.pitcher.replaced = prev && prev.person ? _lastNameOf(prev.person.fullName) : null;
          matchup.pitcher.replacedId = list[ix - 1] != null ? list[ix - 1] : null; // v7.24.0: the pitching-change card
          matchup.pitcher.nth = ix + 1;
        }
        var me = (bt.players || {})['ID' + pId];
        var gp = me && me.stats && me.stats.pitching;
        matchup.pitcher.bf = gp && gp.battersFaced != null ? gp.battersFaced : 0;
      });
    }
    if (matchup.batter) {
      var phOut = _pinchHitFor(batPerson.id, cpOpen ? cpNow : null, boxTeams, gameData.players || {});
      if (phOut) matchup.batter.pinchFor = phOut;
    }
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
        subs: _subsIn(p, gameData.players || {}),   // v7.6.0: pinch hitters/runners, kept with the play
        runs: _runnerEventsIn(p),                   // v7.56.0: steals, pickoffs, wild pitches during the at-bat
        pitches: (p.playEvents || []).filter(function (e) { return e && e.isPitch; }).map(function (e) {
          var d = e.details || {};
          return {
            call: _callText(e, p, _droppedK(p)),
            type: (d.type && d.type.description) || null,
            code: (d.type && d.type.code) || null,   // v7.7.0: pitch mix today vs season
            speed: (e.pitchData && e.pitchData.startSpeed != null) ? Math.round(e.pitchData.startSpeed) : null
          };
        })
      };
    });
  }
  // v7.56.0: a steal (or pickoff, wild pitch…) during the at-bat still in
  // progress belongs to no finished play yet, so it rides separately and
  // the half-inning list shows it as its own trailing row.
  var pendingRuns = null;
  if (wantAllPlays && abstractState === 'Live') {
    var openP = allPlays[allPlays.length - 1];
    if (openP && !(openP.result && openP.result.description)) {
      var pr = _runnerEventsIn(openP);
      if (pr) pendingRuns = { inning: openP.about && openP.about.inning, half: (openP.about && openP.about.isTopInning) ? 'top' : 'bottom', atBatIndex: openP.about ? openP.about.atBatIndex : null, runs: pr };
    }
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
          // v7.11.2: spin and ride for the panel that builds through the at-bat
          spin: (e.pitchData.breaks && e.pitchData.breaks.spinRate != null) ? Math.round(e.pitchData.breaks.spinRate) : null,
          ivb: (e.pitchData.breaks && e.pitchData.breaks.breakVerticalInduced != null) ? Math.round(e.pitchData.breaks.breakVerticalInduced * 10) / 10 : null,
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
        bases: { '1B': !!(linescore.offense && linescore.offense.first), '2B': !!(linescore.offense && linescore.offense.second), '3B': !!(linescore.offense && linescore.offense.third) },
        // v7.57.0: who's on each base, for the pickoff / balk takeover
        runners: { '1B': (linescore.offense && linescore.offense.first && linescore.offense.first.fullName) || null, '2B': (linescore.offense && linescore.offense.second && linescore.offense.second.fullName) || null, '3B': (linescore.offense && linescore.offense.third && linescore.offense.third.fullName) || null }
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
    reason: (gameData.status && gameData.status.reason) || null, // v7.49.0
    rescheduledFrom: _movedFrom(gameData),
    winningPitcher: (decisions.winner && decisions.winner.fullName) || null,
    losingPitcher: (decisions.loser && decisions.loser.fullName) || null,
    savePitcher: (decisions.save && decisions.save.fullName) || null,
    homeRuns: homeRuns.slice(0, 10),
    situation: situation,
    matchup: matchup,
    recentPlays: recentPlays,
    allPlays: fullPlays,
    pendingRuns: pendingRuns,   // v7.56.0: baserunning in the at-bat still going
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
      so: s.strikeOuts != null ? s.strikeOuts : 0,
      np: s.numberOfPitches != null ? s.numberOfPitches : (s.pitchesThrown != null ? s.pitchesThrown : null), // v7.14.1
      strikes: s.strikes != null ? s.strikes : null, // v7.24.0
      hr: s.homeRuns != null ? s.homeRuns : 0
    };
  }).filter(Boolean);
  return { batters: batters, pitchers: pitchers };
}

// Season W-L (or save count) for a decision pitcher, read from the same
// boxscore.teams.<side>.players seasonStats this file already trusts for
// pitchers. rec stays null rather than guessing if the stat is missing.
// v7.71.0: home team ahead once the top of the 9th (or any extra inning) is
// over — the game's over, there's no bottom half. MLB's feed can keep it
// Live for a minute or more; call it Final as soon as the half ends.
function _mlbEndEarly(st, ls) {
  if (!st || !ls || st.abstractGameState !== 'Live') return false;
  if (ls.inningState !== 'Middle') return false;
  var sched = ls.scheduledInnings || 9, inn = ls.currentInning || 0;
  var t = ls.teams || {}, h = t.home && t.home.runs, a = t.away && t.away.runs;
  if (inn < sched || h == null || a == null || !(h > a)) return false;
  st.abstractGameState = 'Final';
  st.detailedState = 'Final';
  st.codedGameState = 'F';
  st.endedEarly = true;
  return true;
}
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

// ── v7.56.0: baserunning that happens mid-at-bat ─────────────────────
// A stolen base, caught stealing, pickoff, wild pitch, passed ball or
// balk is an 'action' event inside the plate appearance it happened in,
// so the play-by-play never listed it. Kept as its own line with the play.
var _RUNNER_EVENTS = /^(stolen_base|caught_stealing|pickoff|wild_pitch|passed_ball|balk|defensive_indiff|other_advance|runner_double_play|runner_interference|error)/;
function _runnerEventsIn(play) {
  var out = [];
  (play && play.playEvents || []).forEach(function (e) {
    var d = (e && e.details) || {};
    if (!e || e.type !== 'action' || !_RUNNER_EVENTS.test(d.eventType || '') || !d.description) return;
    var t = d.eventType, kind = /^stolen_base/.test(t) ? 'SB' : /caught_stealing/.test(t) ? 'CS' : /^pickoff/.test(t) ? 'PO' : t === 'wild_pitch' ? 'WP' : t === 'passed_ball' ? 'PB' : t === 'balk' ? 'BK' : 'RUN';
    out.push({ kind: kind, eventType: t, text: String(d.description).replace(/\s+/g, ' ').trim(), scored: !!d.isScoringPlay || /scores\./i.test(d.description) });
  });
  return out.length ? out : undefined;
}

// ── v7.6.0: pinch hitters and pinch runners ──────────────────────────
// MLB records a substitution as an 'action' event inside the play it
// belongs to ("Offensive Substitution: Pinch-hitter X replaces Y.") with
// the incoming player on e.player and the outgoing one on e.replacedPlayer.
// Names come from gameData.players by id, falling back to the text.
function _lastNameOf(n) { var p = String(n || '').trim().split(/\s+/); return p.length > 1 ? p.slice(1).join(' ') : (p[0] || ''); }
function _subsIn(play, players) {
  var out = [];
  (play && play.playEvents || []).forEach(function (e) {
    var d = (e && e.details) || {};
    if (!e || e.type !== 'action' || d.eventType !== 'offensive_substitution') return;
    var m = /Pinch-(hitter|runner)\s+(.+?)\s+replaces\s+(.+?)\.?\s*$/i.exec(d.description || '');
    if (!m) return;
    var kind = m[1].toLowerCase() === 'hitter' ? 'PH' : 'PR';
    var byId = function (pp) { return pp && pp.id != null && players['ID' + pp.id] && players['ID' + pp.id].fullName; };
    var inName = byId(e.player) || m[2], outName = byId(e.replacedPlayer) || m[3];
    out.push({
      kind: kind, inId: (e.player && e.player.id) || null, outId: (e.replacedPlayer && e.replacedPlayer.id) || null,
      inName: inName, outName: outName,
      text: _lastNameOf(inName) + (kind === 'PH' ? ' pinch-hits for ' : ' pinch-runs for ') + _lastNameOf(outName)
    });
  });
  return out.length ? out : undefined;
}
// Who a pinch hitter replaced: first the substitution event in the at-bat
// in progress, then the box score (his position is 'PH' and his batting
// order is a later entry in the same lineup slot, e.g. 301 after 300).
function _pinchHitFor(batterId, openPlay, boxTeams, players) {
  if (!batterId) return null;
  var subs = openPlay ? (_subsIn(openPlay, players) || []) : [];
  for (var i = subs.length - 1; i >= 0; i--) {
    if (subs[i].kind === 'PH' && subs[i].inId === batterId) return _lastNameOf(subs[i].outName);
  }
  var sides = ['away', 'home'];
  for (var k = 0; k < sides.length; k++) {
    var pl = (boxTeams[sides[k]] && boxTeams[sides[k]].players) || {};
    var me = pl['ID' + batterId];
    if (!me) continue;
    var pos = me.position && me.position.abbreviation;
    var bo = parseInt(me.battingOrder, 10);
    if (pos !== 'PH' || !bo || bo % 100 === 0) return null;
    var slot = Math.floor(bo / 100), best = null, bestBo = -1;
    Object.keys(pl).forEach(function (key) {
      var o = parseInt(pl[key].battingOrder, 10);
      if (o && Math.floor(o / 100) === slot && o < bo && o > bestBo) { bestBo = o; best = pl[key]; }
    });
    return best && best.person ? _lastNameOf(best.person.fullName) : null;
  }
  return null;
}

// ── v7.7.0: regular-season lines ─────────────────────────────────────
// In a playoff game MLB's box score "season" stats are postseason-only, so
// a reliever in his first October outing showed -.-- ERA and hitters
// .000/.000/.000. This pulls the regular-season line from the people
// endpoint (gameType=R), cached per warm instance for 10 minutes since the
// live box score is polled every few seconds.
const _RS_CACHE = global.__inningsRegSeason || (global.__inningsRegSeason = new Map());
async function _regSeason(ids, season) {
  ids = ids.filter(Boolean).map(String);
  const out = {}, need = [];
  ids.forEach(id => { const e = _RS_CACHE.get(id + ':' + season); if (e && Date.now() < e.exp) out[id] = e.v; else need.push(id); });
  if (need.length) {
    const url = 'https://statsapi.mlb.com/api/v1/people?personIds=' + need.join(',') + '&hydrate=currentTeam,stats(group=[pitching,hitting],type=[season],season=' + season + ',gameType=R)';
    const r = await fetch(url);
    const d = await r.json();
    (d.people || []).forEach(p => {
      const v = { id: p.id, name: p.fullName || null, hand: (p.pitchHand && p.pitchHand.code) || null, bats: (p.batSide && p.batSide.code) || null,
        pos: (p.primaryPosition && p.primaryPosition.abbreviation) || null, team: (p.currentTeam && p.currentTeam.name) || null, pitching: null, hitting: null };
      (p.stats || []).forEach(b => {
        const g = b.group && b.group.displayName, st = b.splits && b.splits[0] && b.splits[0].stat;
        if (!st) return;
        if (g === 'pitching') v.pitching = { era: st.era, ip: st.inningsPitched, k: st.strikeOuts, bb: st.baseOnBalls, whip: st.whip, avg: st.avg, g: st.gamesPlayed, gs: st.gamesStarted, w: st.wins, l: st.losses, sv: st.saves, hld: st.holds };
        if (g === 'hitting') v.hitting = { avg: st.avg, obp: st.obp, slg: st.slg, ops: st.ops, hr: st.homeRuns, rbi: st.rbi, g: st.gamesPlayed, pa: st.plateAppearances };
      });
      out[String(p.id)] = v;
      _RS_CACHE.set(String(p.id) + ':' + season, { v: v, exp: Date.now() + 600000 });
    });
    if (_RS_CACHE.size > 800) _RS_CACHE.delete(_RS_CACHE.keys().next().value);
  }
  return out;
}
// v7.78.3: only the National Baseball Hall of Fame counts — not a team's
// own hall or wall of fame (Buster Posey isn't in Cooperstown yet).
function _cmpIsHof(awards) {
  return (awards || []).some(a => a && (a.id === 'MLBHOF' || /^(the )?(national )?(baseball )?hall of fame( inductee)?$/i.test(String(a.name || '').trim())));
}
// MLB files some Negro Leagues players under position "X" (unknown)
function _cmpPos(p) { const v = p && p.primaryPosition && p.primaryPosition.abbreviation; return v && v !== 'X' ? v : null; }
// ── v7.80.0: team history ─────────────────────────────────────────────
// Seasons are [year, W, L, rank, "NL West", team name, flags] — flags D
// division title, W wild card, P pennant, C World Series. Post rows are
// [year, round, opponent, won 1/0, wins, losses].
let _HIST = null;
async function _histBase(host) {
  if (_HIST && _HIST.v) return _HIST.v;
  if (_HIST && _HIST.p) return _HIST.p;
  const p = (async () => {
    const r = await fetch('https://' + host + '/data/mlb-history.json');
    if (!r.ok) throw new Error('history HTTP ' + r.status);
    const v = await r.json();
    _HIST = { v: v };
    return v;
  })();
  _HIST = { p: p };
  try { return await p; } catch (e) { _HIST = null; throw e; }
}
const _HIST_LIVE = global.__inningsHistLive || (global.__inningsHistLive = new Map());
const _HIST_DIV = { 200: 'AL West', 201: 'AL East', 202: 'AL Central', 203: 'NL West', 204: 'NL East', 205: 'NL Central' };
const _HIST_ROUND = { F: 'WC', D: 'DS', L: 'CS', W: 'WS' }, _HIST_NEED = { F: 2, D: 3, L: 4, W: 4 };
// One season of MLB's own numbers, all 30 teams at once (cached; past
// seasons for the life of the instance, the current one for 10 minutes).
async function _histLiveAll(y) {
  const e = _HIST_LIVE.get(y), cur = y >= new Date().getFullYear();
  if (e && (!cur || Date.now() - e.at < 600e3)) return e.v;
  const [st, sc] = await Promise.all([
    _tpGetJson('https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&standingsTypes=regularSeason&season=' + y + '&hydrate=team'),
    _tpGetJson('https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=' + y + '&gameType=F,D,L,W&hydrate=team')
  ]);
  if (!st) throw new Error('no standings ' + y);
  const teams = {};
  (st.records || []).forEach(rec => {
    const div = _HIST_DIV[rec.division && rec.division.id] || '';
    (rec.teamRecords || []).forEach(tr => {
      const t = tr.team || {};
      teams[t.id] = { w: +tr.wins || 0, l: +tr.losses || 0, rank: +tr.divisionRank || 0, div: div, name: t.name || '', divChamp: !!tr.divisionChamp, lg: div.slice(0, 2) };
    });
  });
  const series = {};
  ((sc && sc.dates) || []).forEach(d => (d.games || []).forEach(g => {
    const a = g.teams && g.teams.away, h = g.teams && g.teams.home;
    if (!a || !h || !a.team || !h.team) return;
    const key = g.gameType + ':' + [a.team.id, h.team.id].sort().join('-');
    const s = series[key] || (series[key] = { type: g.gameType, ids: [a.team.id, h.team.id].sort(), names: {}, wins: {}, gamePks: {} });
    s.names[a.team.id] = a.team.name; s.names[h.team.id] = h.team.name;
    if (s.gamePks[g.gamePk]) return; // a postponed game is listed twice
    s.gamePks[g.gamePk] = 1;
    const fin = g.status && g.status.abstractGameState === 'Final' && a.score != null && h.score != null && a.score !== h.score;
    if (fin) { const win = a.score > h.score ? a.team.id : h.team.id; s.wins[win] = (s.wins[win] || 0) + 1; }
  }));
  const v = { teams: teams, series: Object.keys(series).map(k => series[k]) };
  _HIST_LIVE.set(y, { at: Date.now(), v: v });
  return v;
}
async function _histLiveSeason(y, tid) {
  const all = await _histLiveAll(y);
  const me = all.teams[tid];
  const post = [];
  let ongoing = false, flags = '';
  all.series.forEach(s => {
    if (s.ids.map(String).indexOf(String(tid)) === -1) return;
    const opp = s.ids.filter(x => String(x) !== String(tid))[0];
    const mine = s.wins[tid] || 0, theirs = s.wins[opp] || 0, need = _HIST_NEED[s.type] || 4;
    const done = mine >= need || theirs >= need;
    if (!done) ongoing = true;
    const lg = me ? me.lg : '';
    const round = s.type === 'W' ? 'WS' : lg + _HIST_ROUND[s.type];
    post.push([y, round, s.names[opp] || '', done ? (mine > theirs ? 1 : 0) : -1, mine, theirs]);
    if (done && mine > theirs && s.type === 'L') flags += 'P';
    if (done && mine > theirs && s.type === 'W') flags += 'C';
  });
  if (!me) return { season: null, post: post, ongoing: ongoing };
  if (me.divChamp) flags = 'D' + flags;
  else if (post.length) flags = 'W' + flags;
  return { season: [y, me.w, me.l, me.rank, me.div, me.name, flags], post: post, ongoing: ongoing };
}

// ── v7.80.0: a retired player's card ──────────────────────────────────
const _CAREER_KEEP = /MVP|Rookie of the Year|Cy Young|All-Star|Gold Glove|Silver Slugger|Batting (Champion|Title)|World Series|Hank Aaron|Comeback Player|Reliever of the Year|Platinum Glove|Roberto Clemente|Edgar Mart[ií]nez|Hall of Fame/i;
const _CAREER_DROP = /of the (Week|Month)|Minor League|Futures|Fall League|Prospect|Triple-A|Double-A|Single-A|Rookie Ball|Winter League|Organization|Spring Training|Wall of Fame|Team Hall/i;
async function _careerCard(id, host) {
  const P = _CMP_API + '/people/' + encodeURIComponent(id);
  const [ppl, hy, py, hc, pc, base] = await Promise.all([
    _tpGetJson(P + '?hydrate=currentTeam,awards'),
    _tpGetJson(P + '/stats?stats=yearByYear&group=hitting&gameType=R&sportId=1'),
    _tpGetJson(P + '/stats?stats=yearByYear&group=pitching&gameType=R&sportId=1'),
    _tpGetJson(P + '/stats?stats=career&group=hitting&gameType=R&sportId=1'),
    _tpGetJson(P + '/stats?stats=career&group=pitching&gameType=R&sportId=1'),
    _histBase(host).catch(() => null)
  ]);
  const p = ppl && ppl.people && ppl.people[0];
  if (!p) return null;
  const pos = _cmpPos(p);
  const pit = pos === 'P';
  const yby = pit ? py : hy;
  // champions by team id and year, from the history file
  const champ = {};
  if (base && base.teams) Object.keys(base.teams).forEach(tid => base.teams[tid].seasons.forEach(x => { if ((x[6] || '').indexOf('C') !== -1) champ[tid + ':' + x[0]] = 1; }));
  const by = {}, teamSeasons = {};
  _cmpSplits(yby).forEach(sp => {
    if (sp.sport && sp.sport.id && sp.sport.id !== 1) return;
    const y = +sp.season, st = sp.stat || {}, t = sp.team || {};
    if (!y) return;
    const b = by[y] || (by[y] = { y: y, teams: [], champ: false, g: 0, gs: 0, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, hbp: 0, sf: 0, tb: 0, w: 0, l: 0, sv: 0, outs: 0, er: 0, k: 0, pbb: 0, ph: 0 });
    if (t.id) { b.teams.push(t.id); teamSeasons[t.id] = (teamSeasons[t.id] || 0) + 1; if (champ[t.id + ':' + y]) b.champ = true; }
    b.g += +st.gamesPlayed || 0; b.gs += +st.gamesStarted || 0;
    if (pit) { b.w += +st.wins || 0; b.l += +st.losses || 0; b.sv += +st.saves || 0; b.outs += _cmpOuts(st); b.er += +st.earnedRuns || 0; b.k += +st.strikeOuts || 0; }
    else { b.ab += +st.atBats || 0; b.h += +st.hits || 0; b.hr += +st.homeRuns || 0; b.rbi += +st.rbi || 0; }
  });
  const r3 = x => x >= 1 ? x.toFixed(3) : x.toFixed(3).replace(/^0/, '');
  const ys = Object.keys(by).map(Number).sort((a, b) => b - a);
  const seasons = [];
  ys.forEach((y, i) => {
    const b = by[y];
    seasons.push(pit
      ? { y: y, teams: Array.from(new Set(b.teams)), champ: b.champ, g: b.g, gs: b.gs, wl: b.w + '-' + b.l, era: b.outs ? (b.er * 27 / b.outs).toFixed(2) : null, ip: _cmpIp(b.outs), k: b.k, sv: b.sv }
      : { y: y, teams: Array.from(new Set(b.teams)), champ: b.champ, g: b.g, h: b.h, hr: b.hr, rbi: b.rbi, ba: b.ab ? r3(b.h / b.ab) : null });
    const next = ys[i + 1];
    if (next != null) for (let gap = y - 1; gap > next; gap--) seasons.push({ y: gap, dnp: true });
  });
  const mk = pit ? _cmpPLine : _cmpLine;
  const career = mk(_cmpStat(pit ? pc : hc), null);
  // honors: kept awards, counted by name ("7× NL All-Star"), newest year noted
  const hon = {};
  (p.awards || []).forEach(a => {
    const n = String(a.name || '').trim();
    if (!n || !_CAREER_KEEP.test(n) || _CAREER_DROP.test(n) || /hall of fame/i.test(n)) return;
    const h = hon[n] || (hon[n] = { name: n, years: [] });
    if (a.season && h.years.indexOf(+a.season) === -1) h.years.push(+a.season);
  });
  const honors = Object.keys(hon).map(k => hon[k]).map(h => ({ name: h.name, n: Math.max(1, h.years.length), years: h.years.sort((a, b) => a - b) }))
    .sort((a, b) => (/MVP|Cy Young|World Series/i.test(b.name) ? 1 : 0) - (/MVP|Cy Young|World Series/i.test(a.name) ? 1 : 0) || b.n - a.n);
  const rings = seasons.filter(x => x.champ).length;
  const mainTeam = Object.keys(teamSeasons).sort((a, b) => teamSeasons[b] - teamSeasons[a])[0] || null;
  const first = ys.length ? ys[ys.length - 1] : null, last = ys.length ? ys[0] : null;
  const active = p.active !== false, hof = _cmpIsHof(p.awards);
  const played = ys.length;
  const eligible = !active && !hof && last && played >= 10 ? last + 6 : null;
  return { id: p.id, name: p.fullName, pos: pos, bats: (p.batSide && p.batSide.code) || null, throws: (p.pitchHand && p.pitchHand.code) || null,
    active: active, hof: hof, first: first, last: last, seasonsPlayed: played, mainTeamId: mainTeam ? +mainTeam : null, rings: rings,
    hofEligible: eligible && eligible > new Date().getFullYear() ? eligible : null,
    group: pit ? 'pitching' : 'hitting', career: career, honors: honors, seasons: seasons };
}

// ── v7.78.1: every MLB player ever, for the compare picker's search ──
// data/mlb-players.json is a static file (Chadwick Bureau register, see
// data/README.md), fetched from this deployment once per instance — not
// require()'d, since files loaded that way weren't found on Vercel before.
let _CMP_REG = null;
function _cmpFold(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
async function _cmpRegister(host) {
  if (_CMP_REG && _CMP_REG.list) return _CMP_REG.list;
  if (_CMP_REG && _CMP_REG.p) return _CMP_REG.p;
  const p = (async () => {
    const r = await fetch('https://' + host + '/data/mlb-players.json');
    if (!r.ok) throw new Error('register HTTP ' + r.status);
    const rows = await r.json();
    const list = rows.map(x => ({ r: x, f: _cmpFold(x[1]) }));
    _CMP_REG = { list: list };
    return list;
  })();
  _CMP_REG = { p: p };
  try { return await p; } catch (e) { _CMP_REG = null; throw e; }
}
// Every word typed must start a word of the name ("jeff k" → Jeff Kent).
// Exact words beat prefixes, a last-name hit beats a first-name hit, and
// longer careers rank first among equals (so Jeff Kent tops the Kents).
async function _cmpRegisterSearch(q, host) {
  const qt = _cmpFold(q).split(' ').filter(Boolean);
  if (!qt.length || !host) return [];
  const list = await _cmpRegister(host);
  const hits = [];
  list.forEach(e => {
    const nt = e.f.split(' ');
    let score = 0;
    for (let i = 0; i < qt.length; i++) {
      let best = 0;
      nt.forEach((w, j) => {
        if (w === qt[i]) best = Math.max(best, j === nt.length - 1 || (j === nt.length - 2 && /^(jr|sr|ii|iii|iv)$/.test(nt[nt.length - 1])) ? 4 : 3);
        else if (w.indexOf(qt[i]) === 0) best = Math.max(best, 1);
      });
      if (!best) return;
      score += best;
    }
    if (e.f === qt.join(' ')) score += 10;
    hits.push({ e: e, s: score * 1000 + Math.min(e.r[3] - e.r[2], 30) * 10 + (e.r[3] >= 2020 ? 5 : 0) });
  });
  hits.sort((a, b) => b.s - a.s);
  return hits.slice(0, 20).map(h => h.e.r);
}

// ── v7.76.0 / v7.78.0: compare two players ───────────────────────────
// Hitters or pitchers, active or retired. League numbers per season feed
// OPS+ = 100 × (OBP/lgOBP + SLG/lgSLG − 1) and ERA+ = 100 × lgERA/ERA
// (league-adjusted, not park-adjusted); for the current season, the
// qualified pools the percentiles rank against. Past seasons never change,
// so they stay cached for the life of the instance.
const _CMP_LG = global.__inningsCmpLg || (global.__inningsCmpLg = new Map());
const _CMP_API = 'https://statsapi.mlb.com/api/v1';
function _cmpSplits(j) { return (j && j.stats && j.stats[0] && j.stats[0].splits) || []; }
function _cmpStat(j) { const s = _cmpSplits(j)[0]; return s ? s.stat : null; }
function _cmpN(v) { const n = parseFloat(v); return isFinite(n) ? n : null; }
function _cmpOuts(st) { if (!st) return 0; if (st.outs != null) return +st.outs || 0; const p = String(st.inningsPitched || '0').split('.'); return (+p[0] || 0) * 3 + (+p[1] || 0); }
function _cmpIp(outs) { return Math.floor(outs / 3) + '.' + (outs % 3); }
async function _cmpLeague(yr, withPools, group) {
  group = group === 'pitching' ? 'pitching' : 'hitting';
  const key = yr + ':' + group + (withPools ? ':p' : ''), e = _CMP_LG.get(key);
  const past = yr < new Date().getFullYear();
  if (e && (past || Date.now() - e.at < 6 * 3600e3)) return e.v;
  const jobs = [_tpGetJson(_CMP_API + '/teams/stats?season=' + yr + '&group=' + group + '&stats=season&sportIds=1&gameType=R')];
  if (withPools) jobs.push(_tpGetJson(_CMP_API + '/stats?stats=season&group=' + group + '&season=' + yr + '&sportId=1&playerPool=Qualified&limit=500&gameType=R'));
  const [teams, pool] = await Promise.all(jobs);
  const t = { h: 0, bb: 0, hbp: 0, ab: 0, sf: 0, tb: 0, er: 0, outs: 0 };
  _cmpSplits(teams).forEach(s => { const st = s.stat || {}; t.h += +st.hits || 0; t.bb += +st.baseOnBalls || 0; t.hbp += +st.hitByPitch || 0; t.ab += +st.atBats || 0; t.sf += +st.sacFlies || 0; t.tb += +st.totalBases || 0; t.er += +st.earnedRuns || 0; t.outs += _cmpOuts(st); });
  const v = group === 'pitching'
    ? { era: t.outs ? t.er * 27 / t.outs : null }
    : { obp: t.ab ? (t.h + t.bb + t.hbp) / (t.ab + t.bb + t.hbp + t.sf) : null, slg: t.ab ? t.tb / t.ab : null };
  if (withPools) {
    const col = (k, f) => _cmpSplits(pool).map(s => f ? f(s.stat || {}) : _cmpN(s.stat && s.stat[k])).filter(x => x != null);
    v.pool = group === 'pitching'
      ? { era: col('era'), whip: col('whip'), k: col('strikeOuts'), ip: col(null, st => _cmpOuts(st) / 3), w: col('wins'), k9: col('strikeoutsPer9Inn') }
      : { avg: col('avg'), obp: col('obp'), slg: col('slg'), ops: col('ops'), hr: col('homeRuns'), rbi: col('rbi') };
  }
  if ((group === 'pitching' ? v.era : v.obp) == null) return v; // don't cache a failed lookup
  _CMP_LG.set(key, { at: Date.now(), v: v });
  return v;
}
// percentile of x in list; lower=true when a smaller number is better (ERA, WHIP)
function _cmpPct(list, x, lower) {
  if (x == null || !list || list.length < 20) return null;
  let below = 0, same = 0;
  list.forEach(y => { if (lower ? y > x : y < x) below++; else if (y === x) same++; });
  return Math.max(1, Math.min(99, Math.round((below + same / 2) / list.length * 100)));
}
function _cmpLine(st, lg) {
  if (!st || !(+st.plateAppearances)) return null;
  const obp = _cmpN(st.obp), slg = _cmpN(st.slg);
  return { g: +st.gamesPlayed || 0, pa: +st.plateAppearances || 0, avg: st.avg || null, obp: st.obp || null, slg: st.slg || null, ops: st.ops || null,
    hr: +st.homeRuns || 0, rbi: +st.rbi || 0, h: +st.hits || 0,
    opsPlus: lg && lg.obp && lg.slg && obp != null && slg != null ? Math.round(100 * (obp / lg.obp + slg / lg.slg - 1)) : null };
}
function _cmpPLine(st, lg) {
  const outs = _cmpOuts(st);
  if (!st || !outs) return null;
  const era = outs ? (+st.earnedRuns || 0) * 27 / outs : null;
  return { g: +st.gamesPlayed || 0, gs: +st.gamesStarted || 0, w: +st.wins || 0, l: +st.losses || 0, sv: +st.saves || 0, outs: outs, ip: _cmpIp(outs),
    era: era != null ? era.toFixed(2) : null, whip: (((+st.baseOnBalls || 0) + (+st.hits || 0)) * 3 / outs).toFixed(2), k: +st.strikeOuts || 0,
    k9: ((+st.strikeOuts || 0) * 27 / outs).toFixed(1),
    eraPlus: lg && lg.era && era ? Math.round(100 * lg.era / era) : null };
}
// Age on June 30 of a season (baseball's convention)
function _cmpAgeIn(birth, season) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birth || ''));
  if (!m) return null;
  return season - +m[1] - ((+m[2] > 6 || (+m[2] === 6 && +m[3] > 30)) ? 1 : 0);
}
// Season-by-season lines (teams added together) and the career so far at
// every age; OPS+/ERA+ through an age weight each season by PA/innings.
async function _cmpByAge(yby, group, birth, awards) {
  const by = {};
  _cmpSplits(yby).forEach(s => {
    if (s.sport && s.sport.id && s.sport.id !== 1) return;
    const st = s.stat || {}, y = +s.season;
    if (!y) return;
    const b = by[y] || (by[y] = { g: 0, gs: 0, pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, hbp: 0, sf: 0, tb: 0, w: 0, l: 0, sv: 0, outs: 0, er: 0, k: 0, ph: 0 });
    b.g += +st.gamesPlayed || 0; b.gs += +st.gamesStarted || 0;
    if (group === 'pitching') { b.w += +st.wins || 0; b.l += +st.losses || 0; b.sv += +st.saves || 0; b.outs += _cmpOuts(st); b.er += +st.earnedRuns || 0; b.k += +st.strikeOuts || 0; b.bb += +st.baseOnBalls || 0; b.ph += +st.hits || 0; }
    else { b.pa += +st.plateAppearances || 0; b.ab += +st.atBats || 0; b.h += +st.hits || 0; b.hr += +st.homeRuns || 0; b.rbi += +st.rbi || 0; b.bb += +st.baseOnBalls || 0; b.hbp += +st.hitByPitch || 0; b.sf += +st.sacFlies || 0; b.tb += +st.totalBases || 0; }
  });
  const years = Object.keys(by).map(Number).filter(y => group === 'pitching' ? by[y].outs > 0 : by[y].pa > 0).sort((a, b) => a - b);
  if (!years.length) return { seasons: 0, ages: {}, complete: true };
  const lgs = await Promise.all(years.map(y => _cmpLeague(y, false, group).catch(() => null)));
  const gg = {};
  (awards || []).forEach(a => { if (/gold glove/i.test(a.name || '') || /GG$/.test(a.id || '')) { const y = +a.season; if (y) gg[y] = (gg[y] || 0) + 1; } });
  const c = { g: 0, gs: 0, pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, hbp: 0, sf: 0, tb: 0, w: 0, l: 0, sv: 0, outs: 0, er: 0, k: 0, ph: 0, gg: 0, wSum: 0, wN: 0 };
  const ages = {};
  let complete = true;
  years.forEach((y, i) => {
    const b = by[y], lg = lgs[i];
    Object.keys(b).forEach(k => { c[k] += b[k]; });
    c.gg += gg[y] || 0;
    if (group === 'pitching') {
      const era = b.outs ? b.er * 27 / b.outs : null;
      if (lg && lg.era && era) { c.wSum += b.outs * 100 * lg.era / era; c.wN += b.outs; } else if (era) complete = false;
    } else if (lg && lg.obp && lg.slg && b.ab) {
      const obp = (b.h + b.bb + b.hbp) / (b.ab + b.bb + b.hbp + b.sf), slg = b.tb / b.ab;
      c.wSum += b.pa * 100 * (obp / lg.obp + slg / lg.slg - 1); c.wN += b.pa;
    } else if (b.ab) complete = false;
    const age = _cmpAgeIn(birth, y);
    if (age == null) return;
    const r3 = x => x >= 1 ? x.toFixed(3) : x.toFixed(3).replace(/^0/, '');
    ages[age] = group === 'pitching'
      ? { season: y, g: c.g, gs: c.gs, w: c.w, l: c.l, sv: c.sv, ip: _cmpIp(c.outs), outs: c.outs, k: c.k, era: c.outs ? (c.er * 27 / c.outs).toFixed(2) : null, whip: c.outs ? ((c.bb + c.ph) * 3 / c.outs).toFixed(2) : null, eraPlus: c.wN ? Math.round(c.wSum / c.wN) : null, gg: c.gg }
      : { season: y, g: c.g, pa: c.pa, h: c.h, hr: c.hr, rbi: c.rbi, avg: c.ab ? r3(c.h / c.ab) : null, obp: (c.ab + c.bb + c.hbp + c.sf) ? r3((c.h + c.bb + c.hbp) / (c.ab + c.bb + c.hbp + c.sf)) : null, slg: c.ab ? r3(c.tb / c.ab) : null, opsPlus: c.wN ? Math.round(c.wSum / c.wN) : null, gg: c.gg };
  });
  const last = ages[Math.max.apply(null, Object.keys(ages).map(Number))] || null;
  return { seasons: years.length, ages: ages, careerPlus: last ? (group === 'pitching' ? last.eraPlus : last.opsPlus) : null, complete: complete };
}
async function _cmpPlayer(id, yr, group) {
  group = group === 'pitching' ? 'pitching' : 'hitting';
  const P = _CMP_API + '/people/' + encodeURIComponent(id), G = '&group=' + group;
  const [ppl, season, recent, career, yby, lg] = await Promise.all([
    _tpGetJson(P + '?hydrate=currentTeam,awards'),
    _tpGetJson(P + '/stats?stats=season' + G + '&season=' + yr + '&gameType=R'),
    _tpGetJson(P + '/stats?stats=lastXGames' + G + '&limit=' + (group === 'pitching' ? 5 : 15) + '&season=' + yr + '&gameType=R'),
    _tpGetJson(P + '/stats?stats=career' + G + '&gameType=R&sportId=1'),
    _tpGetJson(P + '/stats?stats=yearByYear' + G + '&gameType=R&sportId=1'),
    _cmpLeague(yr, true, group).catch(() => null)
  ]);
  const p = ppl && ppl.people && ppl.people[0];
  if (!p) return null;
  const awards = p.awards || [];
  // the by-age lines get what's left of Vercel's ~10s; past that they come back empty and fill in on a retry
  const ages = await Promise.race([_cmpByAge(yby, group, p.birthDate, awards).catch(() => null), new Promise(r => setTimeout(() => r(null), 6000))]);
  const t = p.currentTeam || {}, active = p.active !== false;
  const mk = group === 'pitching' ? _cmpPLine : _cmpLine;
  const lines = { season: active ? mk(_cmpStat(season), lg) : null, recent: active ? mk(_cmpStat(recent), lg) : null, career: mk(_cmpStat(career), null) };
  if (lines.career) { lines.career.seasons = ages ? ages.seasons : null; if (ages) lines.career[group === 'pitching' ? 'eraPlus' : 'opsPlus'] = ages.careerPlus; }
  const pct = {};
  const s = lines.season;
  if (s && lg && lg.pool) {
    const L = lg.pool;
    if (group === 'pitching') {
      pct.era = _cmpPct(L.era, _cmpN(s.era), true); pct.eraPlus = pct.era; pct.whip = _cmpPct(L.whip, _cmpN(s.whip), true);
      pct.k = _cmpPct(L.k, s.k); pct.ip = _cmpPct(L.ip, s.outs / 3); pct.wl = _cmpPct(L.w, s.w); pct.k9 = _cmpPct(L.k9, _cmpN(s.k9));
    } else {
      pct.avg = _cmpPct(L.avg, _cmpN(s.avg)); pct.obp = _cmpPct(L.obp, _cmpN(s.obp)); pct.slg = _cmpPct(L.slg, _cmpN(s.slg));
      pct.ops = _cmpPct(L.ops, _cmpN(s.ops)); pct.opsPlus = pct.ops; pct.hr = _cmpPct(L.hr, s.hr); pct.rbi = _cmpPct(L.rbi, s.rbi);
    }
  }
  const years = [p.mlbDebutDate, p.lastPlayedDate].map(d => d ? +String(d).slice(0, 4) : null);
  return { id: p.id, name: p.fullName || null, group: group, age: p.currentAge != null ? p.currentAge : null, birthDate: p.birthDate || null,
    pos: (p.primaryPosition && p.primaryPosition.abbreviation) || null, bats: (p.batSide && p.batSide.code) || null, throws: (p.pitchHand && p.pitchHand.code) || null,
    team: active ? (t.name || null) : null, teamId: active ? (t.id || null) : null, active: active, hof: _cmpIsHof(awards),
    first: years[0], last: active ? null : years[1], season: yr, lines: lines, pct: pct, ages: ages ? ages.ages : null,
    partial: !ages || ages.complete === false };
}

// ── v7.36.0: who is still available ─────────────────────────────────
// MLB's box score lists, per team, the position players who have not come
// into the game (bench) and the pitchers who have not pitched (bullpen —
// which also holds the rotation's other starters). Each gets his regular-
// season line; pitchers also get their last outing (date + pitch count,
// postseason included) so you can tell who threw yesterday. A pitcher is
// filed under "starters" when most of his recent outings were starts.
// → out.reserves = { away: { bench, bullpen, starters }, home: {...} }
const _PL_CACHE = global.__inningsPitchLog || (global.__inningsPitchLog = new Map());
async function _pitchLog(ids, season) {
  ids = ids.filter(Boolean).map(String);
  const out = {}, need = [];
  ids.forEach(id => { const e = _PL_CACHE.get(id + ':' + season); if (e && Date.now() < e.exp) out[id] = e.v; else need.push(id); });
  if (need.length) {
    const url = 'https://statsapi.mlb.com/api/v1/people?personIds=' + need.join(',') +
      '&hydrate=stats(group=[pitching],type=[gameLog],season=' + season + ',gameType=[R,F,D,L,W])' +
      '&fields=people,id,stats,splits,date,stat,numberOfPitches,gamesStarted';
    const r = await fetch(url);
    const d = await r.json();
    const seen = {};
    (d.people || []).forEach(p => {
      var apps = [];
      (p.stats || []).forEach(b => (b.splits || []).forEach(sp => {
        if (!sp || !sp.date) return;
        var stt = sp.stat || {};
        apps.push({ d: sp.date, np: stt.numberOfPitches != null ? stt.numberOfPitches : null, gs: stt.gamesStarted ? 1 : 0 });
      }));
      apps.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
      seen[String(p.id)] = apps.slice(-4);
    });
    // a pitcher with no outings yet this year still counts as looked up
    need.forEach(id => { const v = seen[id] || []; out[id] = v; _PL_CACHE.set(id + ':' + season, { v: v, exp: Date.now() + 600000 }); });
    while (_PL_CACHE.size > 800) _PL_CACHE.delete(_PL_CACHE.keys().next().value);
  }
  return out;
}
function _reserveIds(teamData) {
  var players = (teamData && teamData.players) || {};
  var pitched = {};
  ((teamData && teamData.pitchers) || []).forEach(function (id) { pitched[id] = 1; });
  var base = function (id) {
    var p = players['ID' + id];
    if (!p || !p.person || pitched[id]) return null;
    return { p: p, row: { id: id, name: p.person.fullName, num: p.jerseyNumber || null } };
  };
  var bench = ((teamData && teamData.bench) || []).map(base).filter(function (x) { return x && x.p.battingOrder == null; });
  var pen = ((teamData && teamData.bullpen) || []).map(base).filter(Boolean);
  return { bench: bench, pen: pen };
}
function _daysBetween(a, b) { // whole days from date a to date b (YYYY-MM-DD)
  var x = Date.parse(a + 'T12:00:00Z'), y = Date.parse(b + 'T12:00:00Z');
  return isNaN(x) || isNaN(y) ? null : Math.round((y - x) / 864e5);
}
async function _reserves(out, data) {
  var teams = data.liveData && data.liveData.boxscore && data.liveData.boxscore.teams;
  if (!teams) return;
  var game = (data.gameData && data.gameData.game) || {};
  var season = parseInt(game.season, 10) || new Date().getFullYear();
  var today = (data.gameData && data.gameData.datetime && data.gameData.datetime.officialDate) || null;
  var sides = { away: _reserveIds(teams.away), home: _reserveIds(teams.home) };
  var all = [], arms = [];
  ['away', 'home'].forEach(function (k) {
    sides[k].bench.forEach(function (x) { all.push(x.row.id); });
    sides[k].pen.forEach(function (x) { all.push(x.row.id); arms.push(x.row.id); });
  });
  if (!all.length) return;
  // Season lines and last outings are cached for ten minutes. A slow first
  // lookup must not hold up a live box score: it gets 3 seconds, and if it
  // still isn't back this answer goes out without the list (the next poll,
  // seconds later, has it) rather than with starters guessed into the
  // bullpen. A lookup that fails outright still sends the names.
  var reg = {}, log = {}, back = false;
  var looked = Promise.all([
    _regSeason(all, season).then(function (m) { reg = m; }).catch(function () {}),
    _pitchLog(arms, season).then(function (m) { log = m; }).catch(function () {})
  ]).then(function () { back = true; });
  await Promise.race([looked, new Promise(function (ok) { setTimeout(ok, 3000); })]);
  if (!back) return;
  var res = {};
  ['away', 'home'].forEach(function (k) {
    var bench = sides[k].bench.map(function (x) {
      var r = x.row, s = reg[String(r.id)], h = s && s.hitting;
      r.pos = (x.p.position && x.p.position.abbreviation) || (s && s.pos) || null;
      r.bats = (s && s.bats) || null;
      if (h) { r.avg = h.avg; r.hr = h.hr; r.ops = h.ops; r.pa = h.pa; }
      return r;
    });
    var bullpen = [], starters = [];
    sides[k].pen.forEach(function (x) {
      var r = x.row, s = reg[String(r.id)], pt = s && s.pitching, apps = log[String(r.id)] || [];
      r.hand = (s && s.hand) || null;
      if (pt) { r.era = pt.era; r.ip = pt.ip; r.g = pt.g; r.gs = pt.gs; r.sv = pt.sv; }
      var last = apps[apps.length - 1];
      if (last) {
        var days = today ? _daysBetween(last.d, today) : null;
        // an outing dated today is this very game's doubleheader partner; anything "later" is bad data
        if (days == null || days >= 0) r.last = { date: last.d, np: last.np, days: days };
      }
      // starter or reliever: his recent outings decide; then the season; then the box score's own totals
      var sp = null;
      if (apps.length) {
        var st = apps.reduce(function (a, o) { return a + o.gs; }, 0);
        sp = st * 2 > apps.length ? true : st * 2 < apps.length ? false : !!last.gs;
      } else if (pt && pt.g) {
        sp = (pt.gs || 0) >= 3 && pt.gs * 2 >= pt.g;
      } else {
        var bs = x.p.seasonStats && x.p.seasonStats.pitching;
        sp = !!(bs && bs.gamesPlayed && (bs.gamesStarted || 0) * 2 > bs.gamesPlayed);
      }
      (sp ? starters : bullpen).push(r);
    });
    res[k] = { bench: bench, bullpen: bullpen, starters: starters };
  });
  out.reserves = res;
}
async function _seasonLinesForMatchup(out, data) {
  var m = out && out.matchup;
  if (!m || (!m.pitcher && !m.batter)) return;
  var game = (data.gameData && data.gameData.game) || {};
  var season = parseInt(game.season, 10) || new Date().getFullYear();
  var post = /^[FDLW]$/.test(game.type || '');
  var ids = [m.pitcher && m.pitcher.id, post && m.batter && m.batter.id];
  var map = await _regSeason(ids, season);
  var pl = m.pitcher && map[String(m.pitcher.id)], bl = m.batter && map[String(m.batter.id)];
  if (pl && pl.pitching) {
    m.pitcher.season = pl.pitching;
    if (post) m.pitcher.line = pl.pitching.era + ' ERA · ' + pl.pitching.k + ' K · ' + pl.pitching.ip + ' IP';
  }
  if (post && bl && bl.hitting) m.batter.line = bl.hitting.avg + ' / ' + bl.hitting.obp + ' / ' + bl.hitting.slg;
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
  // Postseason game (F = Wild Card, D = Division Series, L = LCS, W = World
  // Series): the form row shows only this postseason's games, each tagged
  // with its round, instead of the regular-season last 10.
  var post = /^[FDLW]$/.test((gameData.game && gameData.game.type) || '');
  var results = await Promise.all([
    _pregameSide(teams.away, boxTeams.away, probable.away, season, gameData.players),
    _pregameSide(teams.home, boxTeams.home, probable.home, season, gameData.players),
    _standingsByTeam(season),
    _lastTenGames(teams.away && teams.away.id, officialDate, thisPk, post),
    _lastTenGames(teams.home && teams.home.id, officialDate, thisPk, post)
  ]);
  var away = results[0], home = results[1], standings = results[2];
  if (away) { away.last10 = results[3]; away.postseason = post; }
  if (home) { home.last10 = results[4]; home.postseason = post; }

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
    venue: (gameData.venue && gameData.venue.name) || null,
    // v7.49.0: a makeup game says what day it was moved from, and why
    status: (gameData.status && gameData.status.detailedState) || null,
    reason: (gameData.status && gameData.status.reason) || null,
    rescheduledFrom: _movedFrom(gameData)
  };
}
// The live feed's datetime block keeps the original day of a rescheduled
// game (originalDate) beside the day it's now played (officialDate).
function _movedFrom(gameData) {
  var dt = (gameData && gameData.datetime) || {};
  return (dt.originalDate && dt.officialDate && dt.originalDate !== dt.officialDate) ? dt.originalDate : null;
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
var _MLB_AL_IDS = { 108: 1, 110: 1, 111: 1, 114: 1, 116: 1, 117: 1, 118: 1, 133: 1, 136: 1, 139: 1, 140: 1, 141: 1, 142: 1, 145: 1, 147: 1 };
// Short round label for a postseason game: WC, ALDS/NLDS, ALCS/NLCS, WS.
// League comes from the hydrated team (103 AL, 104 NL), then the series
// description ("NL Division Series"), then the static AL id list.
function _postRound(g, me) {
  var t = g.gameType;
  if (t === 'F') return 'WC';
  if (t === 'W') return 'WS';
  var lgId = me && me.team && me.team.league && me.team.league.id;
  var lg = lgId === 103 ? 'AL' : lgId === 104 ? 'NL' : null;
  if (!lg) { var m = /^(AL|NL)\b/.exec(g.seriesDescription || ''); lg = m ? m[1] : null; }
  if (!lg && me && me.team) lg = _MLB_AL_IDS[me.team.id] ? 'AL' : 'NL';
  return (lg || '') + (t === 'D' ? 'DS' : 'CS');
}
async function _lastTenGames(teamId, endDate, excludePk, postseason) {
  if (!teamId) return [];
  try {
    var end = endDate ? new Date(endDate + 'T12:00:00Z') : new Date();
    var start = new Date(end.getTime() - 45 * 86400000);
    var url = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameType=' + (postseason ? 'F,D,L,W' : 'R') + '&hydrate=team&teamId=' + encodeURIComponent(teamId) +
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
          round: postseason ? _postRound(g, me) : undefined,
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
      speed: e.pitchData.startSpeed != null ? Math.round(e.pitchData.startSpeed) : null, abs: _absOf(e),
      // v7.9.0: exact velo, spin and induced vertical break for the result panel
      mph: e.pitchData.startSpeed != null ? Math.round(e.pitchData.startSpeed * 10) / 10 : null,
      spin: (e.pitchData.breaks && e.pitchData.breaks.spinRate != null) ? Math.round(e.pitchData.breaks.spinRate) : null,
      ivb: (e.pitchData.breaks && e.pitchData.breaks.breakVerticalInduced != null) ? Math.round(e.pitchData.breaks.breakVerticalInduced * 10) / 10 : null };
  });
  var lastPd = null;
  for (var i = pitchEvs.length - 1; i >= 0; i--) { if (pitchEvs[i].pitchData) { lastPd = pitchEvs[i].pitchData; break; } }
  // v7.43.0: hit data only from the pitch that was put in play (the last
  // one). Statcast tracks foul balls too, and when the in-play pitch's data
  // hadn't landed yet a foul's coordinates were drawn as the play. A ball
  // in play whose data hasn't arrived is flagged so the square can wait.
  var hit = null, inPlayEv = pitchEvs.length ? pitchEvs[pitchEvs.length - 1] : null;
  if (inPlayEv && inPlayEv.hitData) hit = inPlayEv.hitData;
  var hitPending = !hit && !!(inPlayEv && inPlayEv.details && inPlayEv.details.isInPlay);
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
    if (!byRunner[id]) { byRunner[id] = { start: mv.start || null, end: mv.end || null, out: !!mv.isOut, outBase: mv.outBase || null, batter: !!(p.matchup && p.matchup.batter && p.matchup.batter.id === id), name: (r.details.runner.fullName) || null }; order.push(id); }
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
    pitcher: (p.matchup && p.matchup.pitcher && p.matchup.pitcher.fullName) || null, // v7.9.0
    pitchHand: (p.matchup && p.matchup.pitchHand && p.matchup.pitchHand.code) || null,
    batSide: (p.matchup && p.matchup.batSide && p.matchup.batSide.code) || null,
    zoneTop: (lastPd && lastPd.strikeZoneTop != null) ? lastPd.strikeZoneTop : 3.5,
    zoneBottom: (lastPd && lastPd.strikeZoneBottom != null) ? lastPd.strikeZoneBottom : 1.5,
    pitches: pitches,
    hit: hit ? { x: hit.coordinates && hit.coordinates.coordX != null ? hit.coordinates.coordX : null, y: hit.coordinates && hit.coordinates.coordY != null ? hit.coordinates.coordY : null,
      trajectory: hit.trajectory || null, distance: hit.totalDistance != null ? Math.round(hit.totalDistance) : null, speed: hit.launchSpeed != null ? Math.round(hit.launchSpeed * 10) / 10 : null,
      angle: hit.launchAngle != null ? Math.round(hit.launchAngle) : null } : null,
    hitPending: hitPending, // v7.43.0
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
  // v7.76.0: his season's raw Statcast numbers for the compare screen
  const R = { bbe: 0, evSum: 0, hard: 0, brl: 0, out: 0, chase: 0, sw: 0, whiff: 0, pa: 0, k: 0, bb: 0, xw: 0, xwN: 0 };
  const SWING = /swinging_strike|foul|hit_into_play|missed_bunt/, WHIFF = /swinging_strike|missed_bunt/;
  rows.forEach(r => {
    const ev = String(r.events || '');
    const ls = num(r.launch_speed), desc = String(r.description || ''), zn = num(r.zone);
    if (desc === 'hit_into_play' && ls != null) { R.bbe++; R.evSum += ls; if (ls >= 95) R.hard++; if (num(r.launch_speed_angle) === 6) R.brl++; }
    if (SWING.test(desc)) { R.sw++; if (WHIFF.test(desc)) R.whiff++; }
    if (zn >= 11 && zn <= 14) { R.out++; if (SWING.test(desc)) R.chase++; }
    if (ev && num(r.woba_denom) === 1) {
      R.pa++; if (/^strikeout/.test(ev)) R.k++; if (/^(walk|intent_walk)$/.test(ev)) R.bb++;
      const xe = num(r.estimated_woba_using_speedangle), wv = num(r.woba_value);
      if (xe != null && desc === 'hit_into_play') { R.xw += xe; R.xwN++; } else if (wv != null) { R.xw += wv; R.xwN++; }
    }
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
  const pc = (a, b) => b ? round1(a / b * 100) : null;
  const raw = { ev: R.bbe ? round1(R.evSum / R.bbe) : null, hardHit: pc(R.hard, R.bbe), barrel: pc(R.brl, R.bbe), chase: pc(R.chase, R.out),
    whiff: pc(R.whiff, R.sw), k: pc(R.k, R.pa), bb: pc(R.bb, R.pa), xwoba: R.xwN ? Math.round(R.xw / R.xwN * 1000) / 1000 : null, pa: R.pa };
  return { spray: spray, zones: zoneAvg, avgBatSpeed: bsN ? round1(bsSum / bsN) : null, raw: raw };
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
// ── SEASON PHASE (v7.40.0) ────────────────────────────────────────────────
function _mlbRoundLabel(type, leagues) {
  if (type === 'W') return 'World Series';
  if (type === 'F') return 'Wild Card';
  var tail = type === 'D' ? 'DS' : 'CS';
  var nl = leagues.indexOf('NL') !== -1, al = leagues.indexOf('AL') !== -1;
  if (nl && !al) return 'NL' + tail;
  if (al && !nl) return 'AL' + tail;
  return 'NL' + tail + ' & AL' + tail;
}
// The round still being played, from every postseason game of the season:
// the earliest round with a series that isn't over. null once the World
// Series is done (or if there are no postseason games listed at all).
function _mlbCurrentRound(data) {
  var series = {}, order = ['F', 'D', 'L', 'W'];
  (data && data.dates || []).forEach(function (d) {
    (d.games || []).forEach(function (g) {
      var t = g.gameType;
      if (order.indexOf(t) === -1) return;
      var aT = (g.teams && g.teams.away && g.teams.away.team) || {}, hT = (g.teams && g.teams.home && g.teams.home.team) || {};
      var ids = [aT.id || 0, hT.id || 0].sort(function (a, b) { return a - b; });
      var key = t + ':' + ids.join('-');
      var s = series[key] || (series[key] = { type: t, league: null, over: false });
      var lgId = (aT.league && aT.league.id) || (hT.league && hT.league.id) || null;
      if (!s.league && t !== 'W') s.league = lgId === 103 ? 'AL' : lgId === 104 ? 'NL' : null;
      if (g.seriesStatus && g.seriesStatus.isOver) s.over = true;
    });
  });
  var all = Object.keys(series).map(function (k) { return series[k]; });
  if (!all.length) return null;
  for (var i = 0; i < order.length; i++) {
    var open = all.filter(function (s) { return s.type === order[i] && !s.over; });
    if (!open.length) continue;
    var known = open.every(function (s) { return !!s.league; });
    return { type: order[i], leagues: known ? open.map(function (s) { return s.league; }) : ['NL', 'AL'] };
  }
  return null;
}
async function _mlbPhase(today) {
  var year = today.slice(0, 4);
  var get = async function (url) { try { var r = await fetch(url); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  var sj = await get('https://statsapi.mlb.com/api/v1/seasons/' + year + '?sportId=1');
  var s = (sj && sj.seasons && sj.seasons[0]) || null;
  if (!s) return { error: 'No season record' };
  var spring = s.springStartDate || s.preSeasonStartDate, regStart = s.regularSeasonStartDate, regEnd = s.regularSeasonEndDate, postEnd = s.postSeasonEndDate;
  if (spring && today < spring) return { phase: 'off', label: 'Offseason' };
  if (regStart && today < regStart) return { phase: 'pre', label: 'Spring training' };
  if (regEnd && today <= regEnd) return { phase: 'reg', label: 'Regular season' };
  // October: which round
  var pj = await get('https://statsapi.mlb.com/api/v1/schedule?sportId=1&season=' + year + '&gameType=F,D,L,W&hydrate=team,seriesStatus');
  var cur = _mlbCurrentRound(pj);
  if (cur) {
    var out = { phase: 'post', label: _mlbRoundLabel(cur.type, cur.leagues), round: cur.type };
    // v7.41.0: the round's series, for the Games page's playoff card
    try { var list = _mlbSeriesList(pj, cur.type); if (list.length) out.series = list; } catch (e) {}
    return out;
  }
  // nothing left to play (or the bracket isn't posted yet, right after the regular season)
  if (pj && (pj.dates || []).length) return { phase: 'off', label: 'Offseason' };
  return postEnd && today <= postEnd ? { phase: 'post', label: 'Postseason' } : { phase: 'off', label: 'Offseason' };
}

// ── THE ROUND'S SERIES (v7.41.0) ──────────────────────────────────────────
// Every series of the round being played, for the Games page's playoff card:
// who's in it, how many each has won (counted from the finished games), and
// the game to open — the one in progress or next up, else the last one
// played. `pair` + `to` say which two series meet next (the two NLDS → the
// NLCS; the two LCS → the World Series); `final` marks the World Series.
// A series whose teams aren't set yet is left out.
function _mlbSeriesList(data, type) {
  var by = {}, seen = {};
  (data && data.dates || []).forEach(function (d) {
    (d.games || []).forEach(function (g) {
      if (g.gameType !== type || g.gamePk == null) return;
      var aT = (g.teams && g.teams.away && g.teams.away.team) || {}, hT = (g.teams && g.teams.home && g.teams.home.team) || {};
      if (!aT.id || !hT.id || !aT.abbreviation || !hT.abbreviation) return;
      var ids = [aT.id, hT.id].sort(function (a, b) { return a - b; });
      var key = ids.join('-');
      var s = by[key] || (by[key] = { teams: {}, games: [], league: null, over: false, best: null });
      [aT, hT].forEach(function (t) { if (!s.teams[t.id]) s.teams[t.id] = { id: t.id, abbr: t.abbreviation, name: t.name || null, short: t.teamName || t.clubName || null, wins: 0 }; });
      var lgId = (aT.league && aT.league.id) || (hT.league && hT.league.id) || null;
      if (!s.league && type !== 'W') s.league = lgId === 103 ? 'AL' : lgId === 104 ? 'NL' : null;
      if (g.gamesInSeries) s.best = g.gamesInSeries;
      if (g.seriesStatus && g.seriesStatus.isOver) s.over = true;
      var st = g.status || {};
      var row = {
        id: g.gamePk, n: g.seriesGameNumber != null ? g.seriesGameNumber : null, t: g.gameDate || null, day: g.officialDate || d.date || null,
        abs: st.abstractGameState || '', off: /postponed|cancel|suspended/i.test(st.detailedState || ''),
        away: aT.name || null, home: hT.name || null, awayId: aT.id, homeId: hT.id,
        as: g.teams.away.score != null ? g.teams.away.score : null, hs: g.teams.home.score != null ? g.teams.home.score : null
      };
      // a game moved to another day is listed twice: keep the later listing
      var k2 = key + ':' + g.gamePk;
      if (seen[k2] != null) s.games[seen[k2]] = row; else { seen[k2] = s.games.length; s.games.push(row); }
    });
  });
  var bestBy = { F: 3, D: 5, L: 7, W: 7 };
  var tail = type === 'D' ? 'DS' : 'CS';
  var list = Object.keys(by).map(function (key) {
    var s = by[key];
    // v7.49.0: games are numbered by the order they're played, not by
    // MLB's seriesGameNumber — after a rainout that number stays glued to
    // the makeup game even once it's been pushed past the next one
    s.games = s.games.filter(function (x) { return !x.off; });
    s.games.sort(function (a, b) { return (Date.parse(a.t) || 0) - (Date.parse(b.t) || 0); });
    s.games.forEach(function (x, i) { x.n = i + 1; });
    var played = s.games.filter(function (x) { return x.abs === 'Final' && !x.off && x.as != null && x.hs != null && x.as !== x.hs; });
    played.forEach(function (x) { var w = x.as > x.hs ? x.awayId : x.homeId; if (s.teams[w]) s.teams[w].wins++; });
    var best = s.best || bestBy[type] || 7, need = Math.ceil(best / 2);
    var teams = Object.keys(s.teams).map(function (k) { return s.teams[k]; }).sort(function (a, b) { return (b.wins - a.wins) || (a.id - b.id); });
    var over = s.over || teams[0].wins >= need;
    var next = over ? null : (s.games.filter(function (x) { return x.abs === 'Live' && !x.off; })[0] || s.games.filter(function (x) { return x.abs !== 'Final' && !x.off; })[0] || null);
    var last = played[played.length - 1] || null;
    var g = next || last || s.games[0];
    var name = type === 'W' ? 'World Series' : type === 'F' ? ((s.league ? s.league + ' ' : '') + 'WC') : ((s.league || '') + tail);
    var out = {
      name: name, best: best, over: over, league: s.league,
      a: teams[0], b: teams[1],
      g: g ? { id: g.id, n: g.n, t: g.t, day: g.day, state: g.abs === 'Live' ? 'in' : g.abs === 'Final' ? 'post' : 'pre', away: g.away, home: g.home } : null
    };
    if (type === 'W') out.final = true;
    else if (type === 'L') { out.pair = 'ws'; out.to = 'World Series'; out.toFinal = true; }
    else if (type === 'D' && s.league) { out.pair = s.league; out.to = s.league + 'CS'; }
    return out;
  }).filter(function (s) { return s.a && s.b; });
  // National League first, the way the round is named ("NLCS & ALCS")
  list.sort(function (x, y) { return (x.league === 'NL' ? 0 : 1) - (y.league === 'NL' ? 0 : 1); });
  return list;
}

// v7.38.0: a schedule row's runners and names, from the hydrated linescore.
// A game that isn't live has no offense to speak of, so these come back
// empty rather than wrong.
function _schedBases(ls) {
  var o = ls && ls.offense;
  if (!o) return null;
  return { first: !!o.first, second: !!o.second, third: !!o.third };
}
function _schedPerson(p) { return (p && (p.fullName || p.name)) || null; }

// v7.59.0: one game's glance for Multi view (see mode=glance). `ab` is the
// at-bat in progress — its pitches with the plot and call of each; `last` is
// the newest finished play, trimmed to what a tile shows (the result, who,
// the hit's exit velo / angle / distance, the pitch it came on).
function _glanceOf(pbp, ls) {
  if (!pbp && !ls) return null;
  var out = { ab: null, last: null, balls: null, strikes: null, outs: null, bases: null, inning: null, inningState: null };
  if (ls) {
    out.balls = ls.balls != null ? ls.balls : null; out.strikes = ls.strikes != null ? ls.strikes : null; out.outs = ls.outs != null ? ls.outs : null;
    out.bases = _schedBases(ls); out.inning = ls.currentInning || null; out.inningState = ls.inningState || null;
    out.batter = _schedPerson(ls.offense && ls.offense.batter); out.pitcher = _schedPerson(ls.defense && ls.defense.pitcher);
  }
  var cp = pbp && pbp.currentPlay;
  if (cp && cp.matchup && cp.matchup.batter && !(cp.about && cp.about.isComplete)) {
    var dk = _droppedK(cp), lastPd = null;
    var pitches = (cp.playEvents || []).filter(function (e) { return e && e.isPitch && e.pitchData && e.pitchData.coordinates && e.pitchData.coordinates.pX != null && e.pitchData.coordinates.pZ != null; }).map(function (e) {
      lastPd = e.pitchData;
      var d = e.details || {};
      return { px: Math.round(e.pitchData.coordinates.pX * 100) / 100, pz: Math.round(e.pitchData.coordinates.pZ * 100) / 100, call: _callText(e, cp, dk),
        code: (d.type && d.type.code) || null, type: (d.type && d.type.description) || null, mph: e.pitchData.startSpeed != null ? Math.round(e.pitchData.startSpeed * 10) / 10 : null };
    });
    out.ab = { atBatIndex: cp.about && cp.about.atBatIndex != null ? cp.about.atBatIndex : null, batter: cp.matchup.batter.fullName || null,
      pitcher: (cp.matchup.pitcher && cp.matchup.pitcher.fullName) || null, batSide: (cp.matchup.batSide && cp.matchup.batSide.code) || null,
      zoneTop: lastPd && lastPd.strikeZoneTop != null ? lastPd.strikeZoneTop : 3.5, zoneBottom: lastPd && lastPd.strikeZoneBottom != null ? lastPd.strikeZoneBottom : 1.5, pitches: pitches };
  }
  var lp = pbp ? _lastPlaySummary(pbp.allPlays || []) : null;
  if (lp) {
    var pp = lp.pitches && lp.pitches.length ? lp.pitches[lp.pitches.length - 1] : null;
    out.last = { atBatIndex: lp.atBatIndex, inning: lp.inning, half: lp.half, event: lp.event, eventType: lp.eventType, description: lp.description, rbi: lp.rbi,
      batter: lp.batter, pitcher: lp.pitcher, hit: lp.hit, hitPending: lp.hitPending, pitchCount: (lp.pitches || []).length,
      lastPitch: pp ? { mph: pp.mph, type: pp.type, code: pp.code, call: pp.call } : null, fielders: lp.fielders || null };
  }
  return out;
}

// v7.49.0: a game knocked off its day. `postponed` is the rained-out row
// itself; `rescheduleDate` is when that game is now played (if MLB has set
// it); `rescheduledFrom` is the original day on the makeup listing; `reason`
// is MLB's one word ("Rain", "Weather").
function _postponementFields(g, d) {
  var st = (g && g.status) || {};
  var off = /postponed|cancel|suspended/i.test(st.detailedState || '');
  var out = {};
  if (off) { out.postponed = true; out.offStatus = st.detailedState || null; }
  if (st.reason) out.reason = st.reason;
  if (g.rescheduleDate || g.rescheduleGameDate) out.rescheduleDate = g.rescheduleDate || (g.rescheduleGameDate + 'T00:00:00Z');
  if (g.rescheduledFromDate || g.rescheduledFrom) out.rescheduledFrom = g.rescheduledFromDate || String(g.rescheduledFrom).slice(0, 10);
  return out;
}
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


// ── PROBABLE STARTERS (v6.9.0) ────────────────────────────────────────────
// Season pitching lines for the day's probable starters in one request:
// W-L, ERA, innings, and throwing hand. Missing or failed: no lines, and the
// card just shows names.
async function _probableLines(ids, season) {
  var out = {};
  if (!ids || !ids.length) return out;
  try {
    var url = 'https://statsapi.mlb.com/api/v1/people?personIds=' + ids.join(',') + '&hydrate=' + encodeURIComponent('stats(group=[pitching],type=[season],season=' + (parseInt(season, 10) || new Date().getFullYear()) + ')');
    var r = await fetch(url);
    var j = await r.json();
    (j.people || []).forEach(function (p) {
      var st = null;
      (p.stats || []).forEach(function (b) { (b.splits || []).forEach(function (sp) { if (sp.stat && (!sp.sport || sp.sport.id === 1)) st = sp.stat; }); });
      out[p.id] = {
        hand: p.pitchHand && p.pitchHand.code ? p.pitchHand.code + 'HP' : null,
        w: st && st.wins != null ? st.wins : null, l: st && st.losses != null ? st.losses : null,
        era: st && st.era ? st.era : null, ip: st && st.inningsPitched ? st.inningsPitched : null
      };
    });
  } catch (e) {}
  return out;
}
