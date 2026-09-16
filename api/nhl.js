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
  if (!gameId) { res.status(400).json({ error: 'Missing gameId' }); return; }
  try {
    if (mode === 'gamecast') {
      var parts = await Promise.all([
        _get(BASE + '/gamecenter/' + encodeURIComponent(gameId) + '/landing'),
        _get(BASE + '/gamecenter/' + encodeURIComponent(gameId) + '/boxscore'),
        _get(BASE + '/gamecenter/' + encodeURIComponent(gameId) + '/right-rail')
      ]);
      var model = summarize(parts[0] || {}, parts[1] || {}, parts[2] || {}, gameId);
      if (req.query.debug) {
        model.debug = {
          landingKeys: Object.keys(parts[0] || {}),
          boxscoreKeys: Object.keys(parts[1] || {}),
          rightRailKeys: Object.keys(parts[2] || {}),
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
