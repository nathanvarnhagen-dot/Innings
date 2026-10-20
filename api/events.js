// Vercel Serverless Function — tennis, golf and Formula 1 (v7.65.0)
//   GET /api/events?mode=phases                      → league picker lines + live counts
//   GET /api/events?mode=tennis&date=YYYYMMDD         → ATP + WTA singles matches that day
//   GET /api/events?mode=golf[&tour=pga]              → this week's leaderboard
//   GET /api/events?mode=f1sched[&year=YYYY]          → the season's weekends and sessions
//   GET /api/events?mode=f1&session=<key>             → one session: tower, tyres, pits, flags, cars
//   GET /api/events?mode=f1track&session=<key>        → the circuit outline (one clean lap)
//   GET /api/events?mode=f1standings                  → drivers' championship
//
// Sources: ESPN's unofficial scoreboard API (tennis, golf — same caveats as
// api/espn.js: undocumented, can change shape without notice), OpenF1
// (api.openf1.org — free for anything after a session; LIVE timing is on
// their paid tier, so set OPENF1_TOKEN in Vercel to unlock it) and Jolpica
// (the Ergast successor) for standings. Every piece fails soft.

var ESPN = 'https://site.api.espn.com/apis/site/v2/sports/';
var OF1 = 'https://api.openf1.org/v1/';

async function getJson(url, opts) {
  var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  var tm = ctrl ? setTimeout(function () { ctrl.abort(); }, (opts && opts.timeout) || 8000) : null;
  try {
    var r = await fetch(url, Object.assign({}, opts && opts.headers ? { headers: opts.headers } : {}, ctrl ? { signal: ctrl.signal } : {}));
    if (tm) clearTimeout(tm);
    if (!r.ok) return { _status: r.status };
    return await r.json();
  } catch (e) { if (tm) clearTimeout(tm); return { _status: 0 }; }
}
function bad(x) { return !x || x._status != null; }
function of1(path) {
  var h = process.env.OPENF1_TOKEN ? { Authorization: 'Bearer ' + process.env.OPENF1_TOKEN } : null;
  return getJson(OF1 + path, { headers: h, timeout: 9000 });
}
function arr(x) { return Array.isArray(x) ? x : []; }
function ymd(d) { return d.getUTCFullYear() + ('0' + (d.getUTCMonth() + 1)).slice(-2) + ('0' + d.getUTCDate()).slice(-2); }
// US Pacific "today", since that's where the app's people are
function todayPacific() {
  var s = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  var d = new Date(s);
  return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
}

module.exports = async function handler(req, res) {
  var mode = req.query.mode;
  try {
    if (mode === 'phases') { var p = await phases(); res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate'); res.status(200).json(p); return; }
    if (mode === 'tennis') {
      var t = await tennisDay(String(req.query.date || todayPacific()).replace(/-/g, ''));
      res.setHeader('Cache-Control', t.anyLive ? 's-maxage=10, stale-while-revalidate=10' : 's-maxage=120, stale-while-revalidate');
      res.status(200).json(t); return;
    }
    if (mode === 'golf') {
      var g = await golfBoard(req.query.tour === 'lpga' ? 'lpga' : 'pga');
      res.setHeader('Cache-Control', g.state === 'in' ? 's-maxage=20, stale-while-revalidate=20' : 's-maxage=300, stale-while-revalidate');
      res.status(200).json(g); return;
    }
    if (mode === 'f1sched') {
      var y = /^\d{4}$/.test(req.query.year || '') ? req.query.year : String(new Date().getUTCFullYear());
      var sc = await f1Schedule(y);
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
      res.status(200).json(sc); return;
    }
    if (mode === 'f1') {
      var key = String(req.query.session || '');
      if (!/^\d+$/.test(key)) { res.status(400).json({ error: 'Missing session' }); return; }
      var s = await f1Session(key);
      res.setHeader('Cache-Control', s.live ? 's-maxage=4, stale-while-revalidate=4' : 's-maxage=300, stale-while-revalidate');
      res.status(200).json(s); return;
    }
    if (mode === 'f1track') {
      var k2 = String(req.query.session || '');
      if (!/^\d+$/.test(k2)) { res.status(400).json({ error: 'Missing session' }); return; }
      var tr = await f1Track(k2);
      res.setHeader('Cache-Control', tr && tr.pts ? 's-maxage=86400, stale-while-revalidate' : 's-maxage=60');
      res.status(200).json(tr || { pts: null }); return;
    }
    if (mode === 'f1standings') {
      var st = await f1Standings();
      res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
      res.status(200).json(st); return;
    }
    res.status(400).json({ error: 'Unknown mode' });
  } catch (e) {
    res.status(200).json({ error: 'Lookup failed', detail: String(e && e.message || e) });
  }
};

// ══ TENNIS ══════════════════════════════════════════════════════════════
async function tennisDay(date) {
  var tours = ['atp', 'wta'];
  var out = [], events = {};
  var res = await Promise.all(tours.map(function (t) { return getJson(ESPN + 'tennis/' + t + '/scoreboard?dates=' + encodeURIComponent(date)); }));
  res.forEach(function (data, i) {
    if (bad(data)) return;
    arr(data.events).forEach(function (ev) {
      arr(ev.groupings).forEach(function (gp) {
        var gname = (gp.grouping && (gp.grouping.displayName || gp.grouping.slug)) || '';
        // singles only — doubles have pairs of names that this page doesn't draw yet
        if (!/single/i.test(gname)) return;
        arr(gp.competitions).forEach(function (c) {
          var m = tennisMatch(c, ev, tours[i], gname);
          if (!m) return;
          // the scoreboard carries the whole fortnight; keep this day's matches
          var day = m.start ? ymdPacific(m.start) : null;
          if (day && day !== date && m.state !== 'in') return;
          out.push(m);
          events[ev.id] = { id: ev.id, name: ev.name || ev.shortName || '', tour: tours[i].toUpperCase() };
        });
      });
    });
  });
  var rank = function (m) { return m.state === 'in' ? 0 : m.state === 'pre' ? 1 : 2; };
  out.sort(function (a, b) { return (rank(a) - rank(b)) || (Date.parse(a.start || 0) - Date.parse(b.start || 0)); });
  return { date: date, matches: out, events: Object.keys(events).map(function (k) { return events[k]; }), anyLive: out.some(function (m) { return m.state === 'in'; }) };
}
function ymdPacific(iso) {
  var d = new Date(iso);
  if (!isFinite(d.getTime())) return null;
  var s = new Date(d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  return s.getFullYear() + ('0' + (s.getMonth() + 1)).slice(-2) + ('0' + s.getDate()).slice(-2);
}
function tennisMatch(c, ev, tour, gname) {
  var cs = arr(c.competitors).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  if (cs.length < 2) return null;
  var st = (c.status && c.status.type) || {};
  var p = cs.map(function (x) {
    var a = x.athlete || {};
    return {
      id: x.id || null,
      name: a.displayName || a.fullName || '',
      short: a.shortName || a.displayName || '',
      flag: (a.flag && (a.flag.alt || '')) || '',
      seed: (x.curatedRank && x.curatedRank.current && x.curatedRank.current < 99) ? x.curatedRank.current : null,
      winner: !!x.winner,
      sets: arr(x.linescores).map(function (l) { return { g: l.value != null ? Number(l.value) : null, tb: l.tiebreak != null ? Number(l.tiebreak) : null, won: !!l.winner }; }),
      stats: arr(x.statistics).slice(0, 14).map(function (s) { return { n: s.name || s.abbreviation || '', l: s.displayName || s.shortDisplayName || s.name || '', v: s.displayValue != null ? s.displayValue : s.value }; })
    };
  });
  return {
    id: String(c.id), eventId: String(ev.id), event: ev.name || ev.shortName || '', tour: tour.toUpperCase(), draw: gname,
    round: (c.round && c.round.displayName) || '', court: (c.venue && c.venue.court) || '', venue: (c.venue && c.venue.fullName) || '',
    start: c.startDate || c.date || null, state: st.state || 'pre', detail: st.shortDetail || st.detail || st.description || '',
    bestOf: (c.format && c.format.regulation && c.format.regulation.periods) || null,
    p: p
  };
}

// ══ GOLF ════════════════════════════════════════════════════════════════
async function golfBoard(tour) {
  var data = await getJson(ESPN + 'golf/' + tour + '/scoreboard');
  if (bad(data)) return { error: 'No golf data', tour: tour, players: [] };
  var ev = arr(data.events)[0];
  if (!ev) return { tour: tour, players: [] };
  var comp = arr(ev.competitions)[0] || {};
  var st = (ev.status && ev.status.type) || (comp.status && comp.status.type) || {};
  var cs = arr(comp.competitors);
  // which round is being played: the latest one anyone has a hole in
  var round = 0;
  cs.forEach(function (x) { arr(x.linescores).forEach(function (r) { if (arr(r.linescores).length && (r.period || 0) > round) round = r.period || 0; }); });
  var par = {};
  var players = cs.map(function (x, i) {
    var a = x.athlete || {};
    var rounds = arr(x.linescores).map(function (r) {
      var holes = arr(r.linescores).map(function (h) {
        var rel = h.scoreType && h.scoreType.displayValue;
        var rv = rel === 'E' ? 0 : (rel != null && /^[+-]?\d+$/.test(rel) ? Number(rel) : null);
        var v = h.value != null ? Number(h.value) : null;
        if (v != null && rv != null && h.period) par[h.period] = v - rv;
        return { h: h.period || null, v: v, rel: rv };
      }).filter(function (h) { return h.h != null; });
      return { r: r.period || null, total: r.value != null ? Number(r.value) : null, toPar: r.displayValue || null, holes: holes };
    });
    var cur = rounds.filter(function (r) { return r.r === round; })[0] || null;
    var score = typeof x.score === 'object' && x.score ? (x.score.displayValue || x.score.value) : x.score;
    var thru = cur ? cur.holes.length : 0;
    var status = x.status || {};
    return {
      id: String(x.id || (a.id || i)), name: a.displayName || a.fullName || '', short: a.shortName || a.displayName || '',
      flag: (a.flag && a.flag.alt) || '', order: x.order || (i + 1),
      tot: score != null ? String(score) : '', totN: toParNum(score),
      today: cur && cur.holes.length ? (cur.toPar || relSum(cur.holes)) : null,
      thru: thru >= 18 ? 'F' : thru ? String(thru) : (status.displayValue || (status.teeTime ? status.teeTime : '')),
      pos: (status.position && status.position.displayName) || null,
      cut: /cut|wd|dq/i.test(String((status.type && status.type.name) || '')),
      rounds: rounds
    };
  });
  // positions with ties, when ESPN didn't send them
  players.sort(function (a, b) { return a.order - b.order; });
  if (!players.some(function (p) { return p.pos; })) {
    var seen = {};
    players.forEach(function (p) { if (p.totN != null) seen[p.totN] = (seen[p.totN] || 0) + 1; });
    var place = 1;
    players.forEach(function (p, i) {
      if (i && players[i - 1].totN === p.totN) { p.pos = players[i - 1].pos; }
      else { place = i + 1; p.pos = p.totN == null ? '' : (seen[p.totN] > 1 ? 'T' : '') + place; }
    });
  }
  return {
    tour: tour, id: String(ev.id), name: ev.name || '', short: ev.shortName || '', state: st.state || 'pre', detail: st.shortDetail || st.detail || st.description || '',
    start: ev.date || null, end: ev.endDate || null, round: round, par: par, players: players
  };
}
function toParNum(s) {
  if (s == null) return null;
  s = String(s).trim();
  if (s === 'E') return 0;
  return /^[+-]?\d+$/.test(s) ? Number(s) : null;
}
function relSum(holes) {
  var t = 0; holes.forEach(function (h) { t += h.rel || 0; });
  return t === 0 ? 'E' : (t > 0 ? '+' + t : String(t));
}

// ══ FORMULA 1 ═══════════════════════════════════════════════════════════
async function f1Schedule(year) {
  var parts = await Promise.all([of1('sessions?year=' + year), of1('meetings?year=' + year)]);
  var ss = arr(parts[0]), ms = arr(parts[1]);
  var mName = {};
  ms.forEach(function (m) { mName[m.meeting_key] = { name: m.meeting_name || m.meeting_official_name || '', circuit: m.circuit_short_name || '', country: m.country_name || '' }; });
  var meetings = {};
  ss.forEach(function (s) {
    if (s.is_cancelled) return;
    var k = s.meeting_key;
    if (!meetings[k]) meetings[k] = { key: k, name: (mName[k] && mName[k].name) || ((s.location || s.circuit_short_name || '') + ' Grand Prix'), circuit: s.circuit_short_name || '', country: s.country_name || '', location: s.location || '', sessions: [] };
    meetings[k].sessions.push({ key: s.session_key, name: s.session_name || '', type: s.session_type || '', start: s.date_start, end: s.date_end });
  });
  var list = Object.keys(meetings).map(function (k) { return meetings[k]; });
  list.forEach(function (m) { m.sessions.sort(function (a, b) { return Date.parse(a.start) - Date.parse(b.start); }); m.start = m.sessions[0] && m.sessions[0].start; m.end = m.sessions.length ? m.sessions[m.sessions.length - 1].end : null; });
  list.sort(function (a, b) { return Date.parse(a.start) - Date.parse(b.start); });
  return { year: year, meetings: list, error: bad(parts[0]) ? 'Schedule unavailable' : null };
}

function lastBy(rows, keyF) { var o = {}; rows.forEach(function (r) { o[keyF(r)] = r; }); return o; }
function firstBy(rows, keyF) { var o = {}; rows.forEach(function (r) { var k = keyF(r); if (!(k in o)) o[k] = r; }); return o; }

async function f1Session(key) {
  var sess = arr(await of1('sessions?session_key=' + key))[0];
  if (!sess) return { error: 'Session not found', live: false };
  var now = Date.now(), t0 = Date.parse(sess.date_start), t1 = Date.parse(sess.date_end);
  // a session counts as live from its start until 30 minutes after its scheduled end
  var live = now >= t0 && now <= t1 + 30 * 60e3;
  var isRace = /race|sprint$/i.test(sess.session_type || '') || /^sprint$/i.test(sess.session_name || '');
  var since = new Date(now - 40e3).toISOString();
  var calls = [
    of1('drivers?session_key=' + key),
    of1('position?session_key=' + key),
    of1('stints?session_key=' + key),
    of1('pit?session_key=' + key),
    of1('race_control?session_key=' + key),
    of1('laps?session_key=' + key),
    live ? of1('intervals?session_key=' + key + '&date>=' + encodeURIComponent(since)) : of1('session_result?session_key=' + key),
    live ? of1('location?session_key=' + key + '&date>=' + encodeURIComponent(new Date(now - 6e3).toISOString())) : Promise.resolve([])
  ];
  var r = await Promise.all(calls);
  var drivers = arr(r[0]), pos = arr(r[1]), stints = arr(r[2]), pits = arr(r[3]), rc = arr(r[4]), laps = arr(r[5]), gaps = arr(r[6]), locs = arr(r[7]);
  // live data on OpenF1's free tier comes back 401/403 while the session is on
  var blocked = live && (r[1] && (r[1]._status === 401 || r[1]._status === 403));
  var dById = {};
  drivers.forEach(function (d) { dById[d.driver_number] = d; });
  var curPos = lastBy(pos, function (x) { return x.driver_number; });
  var startPos = firstBy(pos, function (x) { return x.driver_number; });
  var lapBy = {}, best = null;
  laps.forEach(function (l) {
    var n = l.driver_number;
    if (!lapBy[n] || (l.lap_number || 0) > lapBy[n]) lapBy[n] = l.lap_number || 0;
    if (l.lap_duration && !l.is_pit_out_lap && (!best || l.lap_duration < best.t)) best = { n: n, t: l.lap_duration, lap: l.lap_number };
  });
  var lead = 0; Object.keys(lapBy).forEach(function (k) { if (lapBy[k] > lead) lead = lapBy[k]; });
  var stintOf = {};
  stints.forEach(function (s) { var n = s.driver_number; if (!stintOf[n] || (s.stint_number || 0) >= (stintOf[n].stint_number || 0)) stintOf[n] = s; });
  var allStints = {};
  stints.forEach(function (s) { (allStints[s.driver_number] = allStints[s.driver_number] || []).push({ c: s.compound || '', a: s.lap_start || 1, b: s.lap_end || null, age0: s.tyre_age_at_start || 0 }); });
  var lastPit = {};
  pits.forEach(function (p) { lastPit[p.driver_number] = p; });
  var gapBy = lastBy(gaps, function (x) { return x.driver_number; });
  var rows = Object.keys(dById).map(function (n) {
    var d = dById[n], cp = curPos[n], res = gapBy[n] || {};
    var st = stintOf[n], lp = lapBy[n] || 0;
    var p = live ? (cp && cp.position) : (res.position || (cp && cp.position));
    var gap = live ? (res.interval != null ? res.interval : null) : (res.gap_to_leader != null ? res.gap_to_leader : null);
    var lead2 = live ? (res.gap_to_leader != null ? res.gap_to_leader : null) : (res.gap_to_leader != null ? res.gap_to_leader : null);
    var pit = lastPit[n];
    return {
      n: Number(n), code: d.name_acronym || '', name: d.full_name || d.broadcast_name || '', team: d.team_name || '', color: d.team_colour ? '#' + d.team_colour : '#A89FE8',
      pos: p || null, start: startPos[n] ? startPos[n].position : null,
      gap: gap, lead: lead2, laps: lp,
      dnf: !!res.dnf, dns: !!res.dns, dsq: !!res.dsq,
      tyre: st ? (st.compound || '') : '', age: st ? ((st.tyre_age_at_start || 0) + Math.max(0, lp - (st.lap_start || lp))) : null,
      stints: allStints[n] || [],
      pitLap: pit ? pit.lap_number : null, pitDur: pit ? pit.pit_duration : null,
      inPit: !!(live && pit && pit.lap_number && pit.lap_number >= lp - 0),
      best: best && Number(n) === best.n
    };
  }).filter(function (x) { return x.code; });
  rows.sort(function (a, b) { return (a.pos || 99) - (b.pos || 99); });
  // flags: the latest track-wide state from race control
  var flag = 'GREEN', drs = null, msgs = [];
  rc.forEach(function (m) {
    var cat = m.category || '', f = m.flag || '', msg = m.message || '';
    if (cat === 'Drs') drs = /enabled/i.test(msg) ? true : /disabled/i.test(msg) ? false : drs;
    if (cat === 'SafetyCar') { if (/virtual/i.test(msg)) flag = /ending|end/i.test(msg) ? 'GREEN' : 'VSC'; else flag = /in this lap|ending/i.test(msg) ? flag : 'SC'; }
    if (cat === 'Flag' && (m.scope === 'Track' || !m.scope)) {
      if (f === 'RED') flag = 'RED';
      else if (f === 'GREEN' || f === 'CLEAR') flag = 'GREEN';
      else if (f === 'CHEQUERED') flag = 'CHEQUERED';
    }
    if (msg) msgs.push({ t: m.date, m: msg });
  });
  // the newest pit stop, for the takeover
  var lastStop = null;
  pits.forEach(function (p) { if (p.pit_duration && (!lastStop || Date.parse(p.date) > Date.parse(lastStop.date))) lastStop = p; });
  var stop = null;
  if (lastStop && dById[lastStop.driver_number]) {
    var dn = lastStop.driver_number, s2 = stintOf[dn];
    var after = (allStints[dn] || []).filter(function (s) { return s.a > (lastStop.lap_number || 0); })[0] || s2;
    stop = { n: dn, code: dById[dn].name_acronym, color: '#' + (dById[dn].team_colour || 'A89FE8'), dur: lastStop.pit_duration, lap: lastStop.lap_number, tyre: after ? (after.c || after.compound || '') : '', at: lastStop.date };
  }
  var cars = [];
  if (locs.length) {
    var lastLoc = lastBy(locs, function (x) { return x.driver_number; });
    Object.keys(lastLoc).forEach(function (n) { var l = lastLoc[n]; if (l.x || l.y) cars.push({ n: Number(n), x: l.x, y: l.y, color: dById[n] ? '#' + (dById[n].team_colour || 'A89FE8') : '#fff' }); });
  }
  return {
    key: Number(key), name: sess.session_name || '', type: sess.session_type || '', race: isRace,
    meeting: sess.meeting_key, circuit: sess.circuit_short_name || '', location: sess.location || '', country: sess.country_name || '',
    start: sess.date_start, end: sess.date_end, live: live && !blocked, liveBlocked: !!blocked, over: now > t1 + 30 * 60e3,
    lap: lead || null, flag: flag, drs: drs, rows: rows, stop: stop, cars: cars,
    best: best ? { n: best.n, code: dById[best.n] ? dById[best.n].name_acronym : '', t: best.t, lap: best.lap } : null,
    msgs: msgs.slice(-6)
  };
}

// One clean lap of the leader (or anyone) traced from the car's position
// data, scaled into a 1000-wide box. Cached for a day — circuits don't move.
async function f1Track(key) {
  var laps = arr(await of1('laps?session_key=' + key + '&lap_number=3'));
  var lap = laps.filter(function (l) { return l.date_start && l.lap_duration && l.lap_duration < 200; }).sort(function (a, b) { return a.lap_duration - b.lap_duration; })[0];
  if (!lap) {
    // a session with no third lap yet: borrow any timed lap
    laps = arr(await of1('laps?session_key=' + key + '&lap_number=2'));
    lap = laps.filter(function (l) { return l.date_start && l.lap_duration && l.lap_duration < 200; })[0];
  }
  if (!lap) return null;
  var a = new Date(Date.parse(lap.date_start)).toISOString(), b = new Date(Date.parse(lap.date_start) + lap.lap_duration * 1000).toISOString();
  var loc = arr(await of1('location?session_key=' + key + '&driver_number=' + lap.driver_number + '&date>=' + encodeURIComponent(a) + '&date<=' + encodeURIComponent(b)));
  loc = loc.filter(function (l) { return l.x || l.y; });
  if (loc.length < 40) return null;
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  loc.forEach(function (l) { if (l.x < minX) minX = l.x; if (l.x > maxX) maxX = l.x; if (l.y < minY) minY = l.y; if (l.y > maxY) maxY = l.y; });
  var w = maxX - minX, h = maxY - minY, s = 1000 / Math.max(w, h);
  var step = Math.max(1, Math.floor(loc.length / 260));
  var pts = [];
  for (var i = 0; i < loc.length; i += step) pts.push([Math.round((loc[i].x - minX) * s), Math.round((maxY - loc[i].y) * s)]);
  return { pts: pts, box: { minX: minX, maxY: maxY, s: s, w: Math.round(w * s), h: Math.round(h * s) } };
}

async function f1Standings() {
  var d = await getJson('https://api.jolpi.ca/ergast/f1/current/driverStandings.json');
  var c = await getJson('https://api.jolpi.ca/ergast/f1/current/constructorStandings.json');
  var dl = (!bad(d) && d.MRData && d.MRData.StandingsTable && arr(d.MRData.StandingsTable.StandingsLists)[0]) || null;
  var cl = (!bad(c) && c.MRData && c.MRData.StandingsTable && arr(c.MRData.StandingsTable.StandingsLists)[0]) || null;
  return {
    round: dl ? dl.round : null,
    drivers: dl ? arr(dl.DriverStandings).map(function (x) { var dr = x.Driver || {}; return { pos: x.position, pts: x.points, wins: x.wins, code: dr.code || '', name: ((dr.givenName || '') + ' ' + (dr.familyName || '')).trim(), team: (arr(x.Constructors)[0] || {}).name || '' }; }) : [],
    teams: cl ? arr(cl.ConstructorStandings).map(function (x) { return { pos: x.position, pts: x.points, wins: x.wins, name: (x.Constructor || {}).name || '' }; }) : []
  };
}

// ══ PICKER LINES ════════════════════════════════════════════════════════
async function phases() {
  var out = {};
  var r = await Promise.all([
    tennisDay(todayPacific()).catch(function () { return null; }),
    golfBoard('pga').catch(function () { return null; }),
    f1Schedule(String(new Date().getUTCFullYear())).catch(function () { return null; })
  ]);
  var t = r[0];
  if (t) {
    var names = t.events.map(function (e) { return e.name.replace(/\s*(presented by|powered by).*$/i, ''); });
    var live = t.matches.filter(function (m) { return m.state === 'in'; }).length;
    out.tennis = names.length ? { phase: 'reg', label: names.slice(0, 2).join(' · '), live: live } : { phase: 'off', label: 'No matches today', live: 0 };
  }
  var g = r[1];
  if (g && g.name) {
    var rd = g.state === 'post' ? 'Final' : g.round ? 'R' + g.round : (g.state === 'pre' ? 'This week' : '');
    out.golf = { phase: 'reg', label: (g.short || g.name).replace(/\s*(presented by|powered by).*$/i, '') + (rd ? ' · ' + rd : ''), live: g.state === 'in' ? 1 : 0 };
  } else if (g) out.golf = { phase: 'off', label: 'Off week', live: 0 };
  var f = r[2];
  if (f && f.meetings && f.meetings.length) {
    var now = Date.now(), cur = null, live2 = 0;
    f.meetings.forEach(function (m) {
      m.sessions.forEach(function (s) { if (now >= Date.parse(s.start) && now <= Date.parse(s.end)) live2 = 1; });
      if (!cur && Date.parse(m.end) + 6 * 3600e3 >= now) cur = m;
    });
    if (cur) {
      var nxt = cur.sessions.filter(function (s) { return Date.parse(s.end) >= now; })[0];
      var shortName = cur.name.replace(/Grand Prix/i, 'GP').replace(/^FORMULA 1\s*/i, '');
      var when = nxt ? nxt.name + ' ' + ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(new Date(nxt.start).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })).getDay()] : '';
      out.f1 = { phase: 'reg', label: shortName + (when ? ' · ' + when : ''), live: live2 };
    } else out.f1 = { phase: 'off', label: 'Season over', live: 0 };
  }
  return { leagues: out };
}
