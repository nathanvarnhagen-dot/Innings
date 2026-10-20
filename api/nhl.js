// Vercel Serverless Function — GET /api/nhlgame?mode=gamecast&gameId=<NHL game id>
//                               GET /api/nhlgame?mode=pregame&gameId=<NHL game id>
// Game-screen hero data for hockey (v5.44.0), from the official NHL web
// API (api-web.nhle.com) — the same NHL game ids api/nhl.js already hands
// the app, so no id translation is needed. Returns the same normalized
// model shape as /api/espn?mode=gamecast so one renderer handles every
// sport.
//
// Confidence note: gamecenter/{id}/landing, /boxscore and /right-rail are
// the standard public endpoints behind nhl.com's game pages, but their
// exact field names were NOT confirmed against a live response in this
// session. The least certain parts: matchup.last10Record.pastGameResults
// (Last 10 circles), matchup.goalieComparison (pre-game goalies),
// right-rail.teamGameStats / shotsByPeriod, and landing.situation (power
// play). Every section degrades to empty rather than throwing — add
// &debug=1 to see each payload's top-level keys.

var BASE = 'https://api-web.nhle.com/v1';

module.exports = async function handler(req, res) {
  var mode = req.query.mode;
  var gameId = req.query.gameId;
  // GET /api/nhl?mode=schedule&date=YYYY-MM-DD  (v7.59.0)
  // The day's games in the same shape /api/espn?mode=schedule hands the app
  // (state, statusDetail, abbreviations, scores), from the league's own
  // score page, plus `sit` for a live game: shots on goal, the power play
  // in progress and the last goal — for Multi view's hockey tiles.
  if (mode === 'schedule') {
    var date = String(req.query.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { res.status(400).json({ error: 'Missing date (YYYY-MM-DD)' }); return; }
    try {
      var sc = await _get(BASE + '/score/' + date);
      var rows = ((sc && sc.games) || []).filter(function (g) { return g && g.id != null && String(g.gameDate || date) === date; });
      var games = rows.map(_schedRow);
      // a live game's power play comes from its landing page (one call per live game)
      var liveIdx = [];
      games.forEach(function (g, i) { if (g.state === 'in') liveIdx.push(i); });
      await Promise.all(liveIdx.slice(0, 6).map(async function (i) {
        var land = await _get(BASE + '/gamecenter/' + encodeURIComponent(games[i].gamePk) + '/landing');
        if (land) _schedLanding(games[i], land, rows[i]);
      }));
      var anyLive = games.some(function (g) { return g.state === 'in'; });
      res.setHeader('Cache-Control', anyLive ? 's-maxage=15, stale-while-revalidate=15' : 's-maxage=300, stale-while-revalidate');
      res.status(200).json({ games: games });
    } catch (e) { res.status(200).json({ games: [] }); }
    return;
  }
  if (!gameId) { res.status(400).json({ error: 'Missing gameId' }); return; }
  try {
    if (mode === 'gamecast') {
      var parts = await Promise.all([
        _get(BASE + '/gamecenter/' + encodeURIComponent(gameId) + '/landing'),
        _get(BASE + '/gamecenter/' + encodeURIComponent(gameId) + '/boxscore'),
        _get(BASE + '/gamecenter/' + encodeURIComponent(gameId) + '/right-rail'),
        _get(BASE + '/gamecenter/' + encodeURIComponent(gameId) + '/play-by-play') // v7.62.0
      ]);
      var model = summarize(parts[0] || {}, parts[1] || {}, parts[2] || {}, gameId);
      try { model.pbp = _pbp(parts[3] || {}, model); } catch (e) { model.pbp = []; }
      if (req.query.debug) {
        model.debug = {
          landingKeys: Object.keys(parts[0] || {}),
          boxscoreKeys: Object.keys(parts[1] || {}),
          rightRailKeys: Object.keys(parts[2] || {}),
          pbpKeys: Object.keys(parts[3] || {}),
          matchupKeys: parts[0] && parts[0].matchup ? Object.keys(parts[0].matchup) : null
        };
      }
      res.setHeader('Cache-Control', model.phase === 'live' ? 's-maxage=10, stale-while-revalidate' : 's-maxage=120, stale-while-revalidate');
      res.status(200).json(model);
      return;
    }
    if (mode === 'pregame') {
      var landing = await _get(BASE + '/gamecenter/' + encodeURIComponent(gameId) + '/landing');
      if (!landing || !landing.awayTeam || !landing.homeTeam) { res.status(200).json({ error: 'No pregame data available' }); return; }
      var rosters = await Promise.all([_roster(landing.awayTeam.abbrev), _roster(landing.homeTeam.abbrev)]);
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
      res.status(200).json({
        league: 'nhl',
        away: { name: _teamName(landing.awayTeam), rows: rosters[0], roster: true },
        home: { name: _teamName(landing.homeTeam), rows: rosters[1], roster: true }
      });
      return;
    }
    res.status(400).json({ error: 'Unknown mode — use gamecast or pregame' });
  } catch (err) {
    res.status(500).json({ error: 'NHL lookup failed' });
  }
};

async function _get(url) {
  try {
    var r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

function _d(v) { return v && typeof v === 'object' ? (v.default || '') : (v || ''); }
function _teamName(t) {
  if (!t) return null;
  var place = _d(t.placeName), common = _d(t.commonName);
  return (place && common) ? (place + ' ' + common) : (_d(t.name) || t.abbrev || null);
}
function _lastName(full) {
  var p = String(full || '').trim().split(/\s+/);
  return p.length > 1 ? p.slice(1).join(' ') : p[0];
}
function _num(v) {
  if (v == null || v === '') return null;
  var n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}
function _periodTag(pd) {
  if (!pd) return '';
  if (pd.periodType === 'SO') return 'SO';
  if (pd.periodType === 'OT' || pd.number > 3) return pd.number > 4 ? (pd.number - 3) + 'OT' : 'OT';
  return 'P' + pd.number;
}
function _clock(t) { return String(t || '').replace(/^0(\d:)/, '$1'); }
function _pct(v) {
  var n = _num(v);
  if (n == null) return null;
  return n <= 1 ? Math.round(n * 1000) / 10 : n;
}

async function _roster(abbrev) {
  if (!abbrev) return [];
  var data = await _get(BASE + '/roster/' + encodeURIComponent(abbrev) + '/current');
  if (!data) return [];
  var order = [['forwards', 1], ['defensemen', 2], ['goalies', 3]];
  var rows = [];
  order.forEach(function (g) {
    (data[g[0]] || []).forEach(function (p) {
      rows.push({
        name: (_d(p.firstName) + ' ' + _d(p.lastName)).trim(),
        pos: p.positionCode || null,
        id: p.id || null,
        age: null,
        line: p.sweaterNumber != null ? '#' + p.sweaterNumber : '',
        extra: null,
        _o: g[1]
      });
    });
  });
  return rows.map(function (r) { delete r._o; return r; });
}

function summarize(landing, box, rail, gameId) {
  var aT = landing.awayTeam || box.awayTeam || {};
  var hT = landing.homeTeam || box.homeTeam || {};
  var state = landing.gameState || box.gameState || '';
  var phase = /LIVE|CRIT/.test(state) ? 'live' : (/FINAL|OFF/.test(state) ? 'final' : 'pre');
  if (/PPD|CNCL|SUSP/.test(landing.gameScheduleState || '')) phase = 'off';
  var side = function (t) {
    return {
      id: t.id || null,
      name: _teamName(t),
      short: _d(t.commonName) || _d(t.name) || t.abbrev || null,
      abbr: t.abbrev || null,
      color: null, alt: null,
      score: t.score != null ? t.score : null,
      sog: t.sog != null ? t.sog : null,
      record: t.record || null,
      standing: null,
      linescores: []
    };
  };
  var away = side(aT), home = side(hT);
  var pd = landing.periodDescriptor || box.periodDescriptor || {};
  var clk = landing.clock || box.clock || {};
  var model = {
    sport: 'hockey', league: 'nhl', gameId: String(landing.id || gameId), phase: phase,
    status: state, statusDetail: clk.inIntermission ? 'Intermission' : null,
    startTime: landing.startTimeUTC || null,
    venue: _d(landing.venue) || null,
    period: pd.number || null, periodTag: _periodTag(pd),
    clock: clk.timeRemaining ? _clock(clk.timeRemaining) : null,
    intermission: !!clk.inIntermission,
    away: away, home: home,
    highlights: [], feed: [], leaders: [], teamStats: [], form: { away: [], home: [] },
    situation: null, drive: null, box: { away: { sections: [] }, home: { sections: [] } },
    star: null, stars: null, periodLabels: [], shotsByPeriod: null, goalies: []
  };

  try {
    // Goals (landing.summary.scoring)
    var scoring = (landing.summary && landing.summary.scoring) || [];
    scoring.forEach(function (per) {
      var tag = _periodTag(per.periodDescriptor);
      if (tag === 'SO') return;
      (per.goals || []).forEach(function (g) {
        var abbr = _d(g.teamAbbrev);
        var isHome = g.isHome != null ? !!g.isHome : abbr === home.abbr;
        var name = _d(g.name) || (_d(g.firstName) + ' ' + _d(g.lastName));
        var last = _d(g.lastName) || _lastName(name);
        var strength = String(g.strength || '').toLowerCase();
        var mod = String(g.goalModifier || '').toLowerCase();
        var kind = tag.indexOf('OT') !== -1 ? 'overtime winner' : strength === 'pp' ? 'power-play goal' : strength === 'sh' ? 'shorthanded goal' : mod === 'empty-net' ? 'empty-net goal' : mod === 'penalty-shot' ? 'penalty-shot goal' : 'goal';
        var assists = (g.assists || []).map(function (x) { return _d(x.lastName) || _lastName(_d(x.name)); }).filter(Boolean);
        model.highlights.push({
          id: g.eventId != null ? String(g.eventId) : '', // v7.62.0: same id as the goal's play-by-play row, so reactions match
          tag: tag, side: isHome ? 'h' : 'a', time: _clock(g.timeInPeriod),
          head: last + ' ' + kind, sub: assists.length ? 'Assists: ' + assists.join(', ') : 'Unassisted',
          as: g.awayScore != null ? g.awayScore : null, hs: g.homeScore != null ? g.homeScore : null
        });
      });
    });

    // Linescore (right-rail), else counted from goals
    var ls = rail.linescore && rail.linescore.byPeriod;
    if (Array.isArray(ls) && ls.length) {
      model.periodLabels = ls.map(function (p) { var t = _periodTag(p.periodDescriptor); return t.charAt(0) === 'P' ? t.slice(1) : t; });
      away.linescores = ls.map(function (p) { return p.away != null ? p.away : null; });
      home.linescores = ls.map(function (p) { return p.home != null ? p.home : null; });
    } else if (phase !== 'pre') {
      var n = Math.max(3, model.period || 0);
      model.periodLabels = [];
      for (var i = 1; i <= n; i++) model.periodLabels.push(i <= 3 ? String(i) : (i === 4 ? 'OT' : (i - 3) + 'OT'));
      away.linescores = model.periodLabels.map(function () { return 0; });
      home.linescores = model.periodLabels.map(function () { return 0; });
      model.highlights.forEach(function (g) {
        var idx = g.tag.charAt(0) === 'P' ? Number(g.tag.slice(1)) - 1 : 3;
        if (g.side === 'h') home.linescores[idx] = (home.linescores[idx] || 0) + 1;
        else away.linescores[idx] = (away.linescores[idx] || 0) + 1;
      });
    }

    // Shots by period
    var sbp = rail.shotsByPeriod;
    if (Array.isArray(sbp) && sbp.length) {
      model.shotsByPeriod = {
        head: sbp.map(function (p) { return _periodTag(p.periodDescriptor); }),
        away: sbp.map(function (p) { return p.away; }),
        home: sbp.map(function (p) { return p.home; })
      };
    }

    // Team stats
    var tgs = rail.teamGameStats || [];
    var stat = function (cat) { return tgs.filter(function (x) { return x.category === cat; })[0]; };
    var rows = [];
    var sog = stat('sog');
    if (sog) rows.push(['Shots', String(sog.awayValue), String(sog.homeValue), _num(sog.awayValue), _num(sog.homeValue), 0]);
    else if (away.sog != null && home.sog != null) rows.push(['Shots', String(away.sog), String(home.sog), away.sog, home.sog, 0]);
    var pp = stat('powerPlay');
    if (pp) {
      var ppPct = function (v) { var m = String(v).match(/(\d+)\/(\d+)/); return m && Number(m[2]) ? Math.round(Number(m[1]) / Number(m[2]) * 100) : 0; };
      rows.push(['Power play', String(pp.awayValue), String(pp.homeValue), ppPct(pp.awayValue), ppPct(pp.homeValue), 0]);
    }
    var fo = stat('faceoffWinningPctg');
    if (fo) rows.push(['Faceoff %', String(_pct(fo.awayValue)), String(_pct(fo.homeValue)), _pct(fo.awayValue), _pct(fo.homeValue), 0]);
    var hits = stat('hits');
    if (hits) rows.push(['Hits', String(hits.awayValue), String(hits.homeValue), _num(hits.awayValue), _num(hits.homeValue), 0]);
    var blk = stat('blockedShots');
    if (blk) rows.push(['Blocks', String(blk.awayValue), String(blk.homeValue), _num(blk.awayValue), _num(blk.homeValue), 0]);
    model.teamStats = rows;

    // Box score
    var pbg = box.playerByGameStats || {};
    var goalieRows = { away: [], home: [] };
    ['away', 'home'].forEach(function (k) {
      var t = pbg[k + 'Team'] || {};
      var skater = function (p) {
        return {
          name: _d(p.name), id: p.playerId || null, pos: p.position || null, sub: false,
          cells: [p.goals != null ? p.goals : 0, p.assists != null ? p.assists : 0, p.points != null ? p.points : 0, p.plusMinus != null ? (p.plusMinus > 0 ? '+' + p.plusMinus : String(p.plusMinus)) : '0', p.sog != null ? p.sog : (p.shots != null ? p.shots : 0), p.hits != null ? p.hits : 0, p.toi || '']
        };
      };
      var skaters = (t.forwards || []).concat(t.defense || []).map(skater);
      skaters.sort(function (x, y) { return (y.cells[2] - x.cells[2]) || (y.cells[0] - x.cells[0]); });
      var goalies = (t.goalies || []).filter(function (g) { return g.toi && g.toi !== '00:00'; }).map(function (g) {
        var sa = g.saveShotsAgainst || ((g.saves != null && g.shotsAgainst != null) ? g.saves + '/' + g.shotsAgainst : '');
        goalieRows[k].push({ name: _d(g.name), id: g.playerId || null, line: sa ? sa.replace('/', ' of ') + ' saves' : '' });
        return { name: _d(g.name), id: g.playerId || null, pos: 'G', sub: false, cells: [sa, g.savePctg != null ? Number(g.savePctg).toFixed(3).replace(/^0/, '') : '', g.goalsAgainst != null ? g.goalsAgainst : '', g.toi || ''] };
      });
      var sections = [];
      if (skaters.length) sections.push({ title: 'Skaters', cols: ['G', 'A', 'P', '+/-', 'SOG', 'HIT', 'TOI'], rows: skaters });
      if (goalies.length) sections.push({ title: 'Goalies', cols: ['SV/SA', 'SV%', 'GA', 'TOI'], rows: goalies });
      model.box[k] = { sections: sections };
    });
    if (goalieRows.away.length || goalieRows.home.length) {
      var ga = goalieRows.away[goalieRows.away.length - 1], gh = goalieRows.home[goalieRows.home.length - 1];
      model.leaders = [{ label: 'SAVES', a: ga ? { name: ga.name, id: ga.id, line: ga.line } : null, h: gh ? { name: gh.name, id: gh.id, line: gh.line } : null }];
    }

    // Live power play
    var sit = landing.situation;
    if (phase === 'live' && sit) {
      var ppSide = null;
      if (sit.homeTeam && (sit.homeTeam.situationDescriptions || []).indexOf('PP') !== -1) ppSide = 'h';
      if (sit.awayTeam && (sit.awayTeam.situationDescriptions || []).indexOf('PP') !== -1) ppSide = 'a';
      model.situation = { ppSide: ppSide, ppTime: sit.timeRemaining ? _clock(sit.timeRemaining) : null, strength: sit.situationCode || null };
    } else if (phase === 'live') {
      model.situation = { ppSide: null, ppTime: null };
    }

    // Three stars
    var stars = (landing.summary && landing.summary.threeStars) || [];
    if (stars.length) {
      model.stars = stars.slice(0, 3).map(function (s) {
        var isG = s.position === 'G';
        var line = isG ? (s.savePctg != null ? 'SV% ' + Number(s.savePctg).toFixed(3).replace(/^0/, '') : 'Goalie')
          : [s.goals ? s.goals + ' G' : '', s.assists ? s.assists + ' A' : ''].filter(Boolean).join(' · ') || (s.points != null ? s.points + ' P' : '');
        var abbr = _d(s.teamAbbrev);
        return { rank: ['1st', '2nd', '3rd'][s.star - 1] || '', name: _d(s.name), id: s.playerId || null, line: line, side: abbr === home.abbr ? 'h' : 'a' };
      });
    }

    // Pre-game: goalies + last 10
    var mu = landing.matchup || {};
    if (phase === 'pre') {
      var gc = mu.goalieComparison || {};
      var gl = function (t) { var l = (t && t.leaders) || []; return l[0] || null; };
      var gaL = gl(gc.awayTeam), ghL = gl(gc.homeTeam);
      if (gaL || ghL) {
        var gName = function (g) { return g ? (_d(g.name) || (_d(g.firstName) + ' ' + _d(g.lastName))).trim() : null; };
        var sub = function (g) { return g ? ('G · ' + (g.record || '')).replace(/ · $/, '') : ''; };
        model.keyPlayers = {
          title: 'Goalies',
          a: gaL ? { name: gName(gaL), id: gaL.playerId || null, sub: sub(gaL) } : null,
          h: ghL ? { name: gName(ghL), id: ghL.playerId || null, sub: sub(ghL) } : null,
          compare: gaL && ghL ? [
            ['SV%', Number(gaL.savePctg || 0).toFixed(3).replace(/^0/, ''), Number(ghL.savePctg || 0).toFixed(3).replace(/^0/, ''), Number(gaL.savePctg || 0), Number(ghL.savePctg || 0), 0],
            ['GAA', Number(gaL.gaa || 0).toFixed(2), Number(ghL.gaa || 0).toFixed(2), Number(gaL.gaa || 0), Number(ghL.gaa || 0), 1],
            ['SO', String(gaL.shutouts || 0), String(ghL.shutouts || 0), Number(gaL.shutouts || 0), Number(ghL.shutouts || 0), 0]
          ] : []
        };
      }
      var l10 = mu.last10Record || {};
      var toForm = function (t) {
        var list = ((t && t.pastGameResults) || []).map(function (g) {
          var r = String(g.gameResult || '').toUpperCase();
          return { opp: g.opponentAbbrev || '?', res: r === 'O' || r === 'OTL' || r === 'SOL' ? 'OT' : r, oppName: null };
        }).filter(function (g) { return g.res === 'W' || g.res === 'L' || g.res === 'OT'; });
        return list.reverse(); // NHL lists most recent first
      };
      model.form = { away: toForm(l10.awayTeam), home: toForm(l10.homeTeam) };
    }
  } catch (e) {
    model.parseError = String(e && e.message || e);
  }
  return model;
}

// ── v7.59.0: the schedule row ──
// the score page names teams by nickname only ("Ducks"); the app keys
// venues and colors by the full name, so the city comes from here
var _NHL_PLACE = { ANA: 'Anaheim', BOS: 'Boston', BUF: 'Buffalo', CGY: 'Calgary', CAR: 'Carolina', CHI: 'Chicago', COL: 'Colorado', CBJ: 'Columbus', DAL: 'Dallas', DET: 'Detroit', EDM: 'Edmonton', FLA: 'Florida', LAK: 'Los Angeles', MIN: 'Minnesota', MTL: 'Montréal', NSH: 'Nashville', NJD: 'New Jersey', NYI: 'New York', NYR: 'New York', OTT: 'Ottawa', PHI: 'Philadelphia', PIT: 'Pittsburgh', SJS: 'San Jose', SEA: 'Seattle', STL: 'St. Louis', TBL: 'Tampa Bay', TOR: 'Toronto', UTA: 'Utah', VAN: 'Vancouver', VGK: 'Vegas', WSH: 'Washington', WPG: 'Winnipeg' };
function _schedName(t) {
  if (!t) return null;
  var place = _d(t.placeName) || _NHL_PLACE[t.abbrev] || '', nm = _d(t.commonName) || _d(t.name);
  if (!nm) return t.abbrev || null;
  return place && nm.indexOf(place) !== 0 ? (place + ' ' + nm) : nm;
}
function _schedState(g) {
  var st = String(g.gameState || '').toUpperCase();
  if (st === 'LIVE' || st === 'CRIT') return 'in';
  if (st === 'OFF' || st === 'FINAL') return 'post';
  return 'pre';
}
function _schedDetail(g, state) {
  var pd = g.periodDescriptor || {}, ck = g.clock || {};
  if (state === 'post') return pd.periodType === 'SO' ? 'FINAL/SO' : (pd.periodType === 'OT' || (pd.number || 0) > 3) ? 'FINAL/OT' : 'FINAL';
  if (state !== 'in') return null;
  var tag = _periodTag(pd);
  if (ck.inIntermission) return 'END ' + tag;
  return tag + ' ' + _clock(ck.timeRemaining);
}
function _schedRow(g) {
  var state = _schedState(g), a = g.awayTeam || {}, h = g.homeTeam || {};
  var off = /PPD|POSTPONED|CNCL|CANCEL|SUSP/i.test(String(g.gameScheduleState || ''));
  var status = state === 'post' ? 'Final' : state === 'in' ? 'In Progress' : off ? 'Postponed' : 'Scheduled';
  var goals = (g.goals || []);
  var last = goals.length ? goals[goals.length - 1] : null;
  var row = {
    gamePk: g.id, status: status, state: off && state !== 'in' ? 'pre' : state, statusDetail: _schedDetail(g, state),
    away: _schedName(a), home: _schedName(h), awayAbbr: a.abbrev || null, homeAbbr: h.abbrev || null,
    awayScore: state === 'pre' ? null : (a.score != null ? a.score : null), homeScore: state === 'pre' ? null : (h.score != null ? h.score : null),
    venue: _d(g.venue) || null, startTime: g.startTimeUTC || null, postponed: off || undefined,
    sit: state === 'in' ? { sogA: a.sog != null ? a.sog : null, sogH: h.sog != null ? h.sog : null, pp: null,
      last: last ? ((_d(last.name) || _lastName((_d(last.firstName) + ' ' + _d(last.lastName)).trim())) + ' · ' + (last.teamAbbrev && (last.teamAbbrev.default || last.teamAbbrev) || '') + ' · ' + _periodTag({ number: last.period, periodType: last.periodDescriptor && last.periodDescriptor.periodType }) + ' ' + _clock(last.timeInPeriod) + (last.strength && last.strength !== 'ev' ? ' · ' + String(last.strength).toUpperCase() : '')).replace(/ · $/, '') : null } : null
  };
  return row;
}
function _schedLanding(row, land, raw) {
  var s = land.situation;
  if (!s || !row.sit) return;
  var side = null, abbr = null;
  ['homeTeam', 'awayTeam'].forEach(function (k) {
    var t = s[k], descs = (t && t.situationDescriptions) || [];
    if (descs.some(function (d) { return /PP/i.test(d); })) { side = k === 'homeTeam' ? 'h' : 'a'; abbr = (t && t.abbrev) || null; }
  });
  if (side) row.sit.pp = { side: side, abbr: abbr, clock: _clock(s.timeRemaining || '') || null };
  ['homeTeam', 'awayTeam'].forEach(function (k) {
    var t = s[k], descs = (t && t.situationDescriptions) || [];
    if (descs.some(function (d) { return /EN/i.test(d); })) row.sit.en = k === 'homeTeam' ? 'h' : 'a';
  });
  if (land.clock && land.clock.timeRemaining && row.state === 'in' && !land.clock.inIntermission) row.statusDetail = _periodTag(land.periodDescriptor || (raw && raw.periodDescriptor)) + ' ' + _clock(land.clock.timeRemaining);
}

// ── Play by play (v7.62.0) ─────────────────────────────────────────────
// gamecenter/{id}/play-by-play: plays[] { eventId, periodDescriptor,
// timeInPeriod, typeDescKey, sortOrder, details { eventOwnerTeamId, …PlayerId,
// descKey, duration, reason, shotType, awayScore, homeScore } } and
// rosterSpots[] { playerId, teamId, firstName, lastName, sweaterNumber }.
// Newest first. Faceoffs are left out (there are sixty a game).
// kind: goal | shot | miss | block | hit | pen | give | take | stop | period
function _pbp(raw, model) {
  var plays = Array.isArray(raw.plays) ? raw.plays : [];
  if (!plays.length) return [];
  var who = {};
  (raw.rosterSpots || []).forEach(function (r) { if (r && r.playerId != null) who[r.playerId] = { last: _d(r.lastName) || _lastName(_d(r.firstName)), team: r.teamId }; });
  var nm = function (id) { return id != null && who[id] ? who[id].last : null; };
  var aId = model.away.id, hId = model.home.id;
  var sideOf = function (teamId) { return teamId == null ? null : (String(teamId) === String(hId) ? 'h' : (String(teamId) === String(aId) ? 'a' : null)); };
  var words = function (k) { return String(k || '').replace(/-/g, ' ').replace(/\bpp\b/g, 'power play'); };
  var shotW = function (t) { return t ? ' (' + words(t) + ')' : ''; };
  var ord = function (n) { return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th'; };
  var out = [];
  plays.slice().sort(function (x, y) { return (x.sortOrder || 0) - (y.sortOrder || 0); }).forEach(function (p) {
    var k = p.typeDescKey || '', d = p.details || {}, pd = p.periodDescriptor || {};
    var tag = _periodTag(pd), time = _clock(p.timeInPeriod), side = sideOf(d.eventOwnerTeamId), text = null, kind = null;
    var pName = pd.periodType === 'OT' ? 'overtime' : pd.periodType === 'SO' ? 'the shootout' : 'the ' + ord(pd.number || 1) + ' period';
    if (k === 'goal') {
      var a = [nm(d.assist1PlayerId), nm(d.assist2PlayerId)].filter(Boolean);
      kind = 'goal';
      text = 'GOAL — ' + (nm(d.scoringPlayerId) || 'Unknown') + (d.scoringPlayerTotal ? ' (' + d.scoringPlayerTotal + ')' : '') + (d.shotType ? ', ' + words(d.shotType) + ' shot' : '') + (a.length ? ', assists: ' + a.join(', ') : ', unassisted');
    } else if (k === 'shot-on-goal') {
      kind = 'shot'; text = 'Shot on goal by ' + (nm(d.shootingPlayerId) || 'unknown') + shotW(d.shotType) + (nm(d.goalieInNetId) ? ', saved by ' + nm(d.goalieInNetId) : '');
    } else if (k === 'missed-shot') {
      kind = 'miss'; text = 'Missed shot by ' + (nm(d.shootingPlayerId) || 'unknown') + (d.reason ? ' — ' + words(d.reason) : '');
    } else if (k === 'blocked-shot') {
      // the event belongs to the blocking team
      kind = 'block'; text = (nm(d.shootingPlayerId) ? nm(d.shootingPlayerId) + '’s shot' : 'Shot') + ' blocked' + (nm(d.blockingPlayerId) ? ' by ' + nm(d.blockingPlayerId) : '');
    } else if (k === 'hit') {
      kind = 'hit'; text = (nm(d.hittingPlayerId) || 'Unknown') + ' hit ' + (nm(d.hitteePlayerId) || 'an opponent');
    } else if (k === 'penalty') {
      kind = 'pen';
      text = 'Penalty on ' + (nm(d.committedByPlayerId) || nm(d.servedByPlayerId) || 'the bench') + ' — ' + words(d.descKey || 'minor') + (d.duration ? ' (' + d.duration + ' min)' : '') + (nm(d.drawnByPlayerId) ? ', drawn by ' + nm(d.drawnByPlayerId) : '');
    } else if (k === 'giveaway') {
      kind = 'give'; text = 'Giveaway by ' + (nm(d.playerId) || 'unknown');
    } else if (k === 'takeaway') {
      kind = 'take'; text = 'Takeaway by ' + (nm(d.playerId) || 'unknown');
    } else if (k === 'stoppage') {
      if (/tv-timeout|period|game-end/.test(d.reason || '')) return;
      kind = 'stop'; side = null; text = 'Stoppage' + (d.reason ? ' — ' + words(d.reason) : '');
    } else if (k === 'delayed-penalty') {
      kind = 'pen'; text = 'Delayed penalty';
    } else if (k === 'period-start') {
      kind = 'period'; side = null; text = 'Start of ' + pName;
    } else if (k === 'period-end') {
      kind = 'period'; side = null; text = 'End of ' + pName;
    } else if (k === 'game-end') {
      kind = 'period'; side = null; text = 'End of game';
    } else return;
    out.push({
      id: p.eventId != null ? String(p.eventId) : '', tag: tag, time: time, side: side, kind: kind, text: text,
      as: k === 'goal' && d.awayScore != null ? d.awayScore : null, hs: k === 'goal' && d.homeScore != null ? d.homeScore : null
    });
  });
  return out.reverse().slice(0, 400);
}
