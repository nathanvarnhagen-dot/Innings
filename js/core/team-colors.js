// ═══ TEAM COLORS FOR EVERY TEAM (v7.35.0) ═════════════════════════════
// One place to ask "what does this team look like?" — abbreviation, primary
// color and second color — for any team in any sport the app covers:
//   · MLB: the built-in table (GH_MLB_COLORS), by abbreviation; a team name
//     with no abbreviation is matched to one here
//   · NHL: the built-in table (GX_NHL_COLORS) by abbreviation, else the list
//   · NFL, college football, NBA, WNBA, NHL, MLS, NWSL: each league's own
//     team list (/api/espn?mode=teams — every team with its abbreviation
//     and colors), fetched once and kept on the phone for two weeks
// A game's own feed usually carries its teams' colors already; this fills in
// whenever it doesn't, so a team is never a plain purple circle with a
// made-up abbreviation.
var TC_KEY = 'innings_team_colors_v1', TC_TTL = 14 * 864e5, TC_RETRY = 5 * 60e3;
var TC_LEAGUES = { nfl: 1, cfb: 1, nba: 1, wnba: 1, nhl: 1, mls: 1, nwsl: 1 };
var TC_MLB_ABBR = {
  'arizona diamondbacks': 'AZ', 'atlanta braves': 'ATL', 'baltimore orioles': 'BAL', 'boston red sox': 'BOS', 'chicago cubs': 'CHC',
  'chicago white sox': 'CWS', 'cincinnati reds': 'CIN', 'cleveland guardians': 'CLE', 'colorado rockies': 'COL', 'detroit tigers': 'DET',
  'houston astros': 'HOU', 'kansas city royals': 'KC', 'los angeles angels': 'LAA', 'los angeles dodgers': 'LAD', 'miami marlins': 'MIA',
  'milwaukee brewers': 'MIL', 'minnesota twins': 'MIN', 'new york mets': 'NYM', 'new york yankees': 'NYY', 'athletics': 'ATH',
  'oakland athletics': 'OAK', 'philadelphia phillies': 'PHI', 'pittsburgh pirates': 'PIT', 'san diego padres': 'SD', 'san francisco giants': 'SF',
  'seattle mariners': 'SEA', 'st louis cardinals': 'STL', 'tampa bay rays': 'TB', 'texas rangers': 'TEX', 'toronto blue jays': 'TOR',
  'washington nationals': 'WSH'
};
window._tc = window._tc || { leagues: null, pending: {}, tried: {} };

function _tcNorm(name) {
  var s = String(name || '');
  try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}
function _tcHex(c) { var h = String(c || '').replace('#', ''); return /^[0-9a-fA-F]{6}$/.test(h) ? '#' + h.toUpperCase() : null; }
function _tcStore() {
  var T = window._tc;
  if (T.leagues) return T.leagues;
  try { var v = JSON.parse(localStorage.getItem(TC_KEY) || 'null'); T.leagues = v && typeof v === 'object' ? v : {}; } catch (e) { T.leagues = {}; }
  return T.leagues;
}
// A league's team list, once. When it lands, whatever is on screen redraws.
function _tcLoad(sport) {
  var T = window._tc;
  if (!TC_LEAGUES[sport] || T.pending[sport] || !window.fetch) return;
  if (T.tried[sport] && Date.now() - T.tried[sport] < TC_RETRY) return;
  T.tried[sport] = Date.now();
  T.pending[sport] = fetch('/api/espn?league=' + encodeURIComponent(sport) + '&mode=teams').then(function (r) { return r.json(); }).then(function (d) {
    var teams = {}, n = 0;
    ((d && d.teams) || []).forEach(function (t) {
      var key = _tcNorm(t && t.name), color = _tcHex(t && t.color);
      if (!key || (!color && !(t && t.abbr))) return;
      teams[key] = [t.abbr || '', color ? color.slice(1) : '', (_tcHex(t.alt) || '').slice(1)];
      n++;
    });
    if (!n) return;
    var L = _tcStore();
    L[sport] = { at: Date.now(), t: teams };
    try { localStorage.setItem(TC_KEY, JSON.stringify(L)); } catch (e) {}
    _tcArrived();
  }).catch(function (err) { console.error('[team colors] ' + sport + ' list failed:', err); }).then(function () { delete T.pending[sport]; });
}
function _tcArrived() {
  clearTimeout(window._tcArrT);
  window._tcArrT = setTimeout(function () {
    ['_glRenderHero', '_glRenderLive', '_glRenderTonight'].forEach(function (fn) {
      if (typeof window[fn] === 'function') { try { window[fn](); } catch (e) {} }
    });
  }, 60);
}
// The league list's entry for a team, by its full name: { abbr, color, alt } or null
function _tcFind(sport, name) {
  if (!TC_LEAGUES[sport]) return null;
  var L = _tcStore()[sport], key = _tcNorm(name);
  if (!L || !L.t || Date.now() - (L.at || 0) > TC_TTL) _tcLoad(sport);
  var hit = L && L.t && key ? L.t[key] : null;
  return hit ? { abbr: hit[0] || null, color: hit[1] ? '#' + hit[1] : null, alt: hit[2] ? '#' + hit[2] : null } : null;
}

// Everything a badge needs for one team. Pass what the game's feed gave
// (any of abbr / color / alt may be missing); the rest is filled in.
// → { abbr, bg, fg, accent, ring, known }
function _teamLook(sport, name, abbr, color, alt) {
  sport = sport || 'mlb';
  var known = true, c = null;
  if (sport === 'mlb') {
    if (!abbr) abbr = TC_MLB_ABBR[_tcNorm(name)] || null;
    var m = abbr && typeof GH_MLB_COLORS !== 'undefined' ? GH_MLB_COLORS[String(abbr).toUpperCase()] : null;
    if (m) c = { bg: m[0], fg: m[1], accent: m[2] };
    else known = false;
  } else {
    color = _tcHex(color); alt = _tcHex(alt);
    if (!color || !abbr) {
      var hit = _tcFind(sport, name);
      if (hit) { abbr = abbr || hit.abbr; if (!color) { color = hit.color; alt = alt || hit.alt; } }
    }
    var nhl = sport === 'nhl' && abbr && typeof GX_NHL_COLORS !== 'undefined' ? GX_NHL_COLORS[String(abbr).toUpperCase()] : null;
    if (!nhl && !color) known = false;
    if (typeof _gxColors === 'function') c = _gxColors(sport, abbr, color, alt);
  }
  if (!c) c = { bg: '#3D3580', fg: '#FFFFFF', accent: '#A89FE8' };
  if (!abbr) abbr = typeof _ghAbbrFallback === 'function' ? _ghAbbrFallback(name) : String(name || '').slice(0, 3).toUpperCase();
  // the ring around a badge: the team's second color when it stands apart from the first
  var ring = null;
  if (known && typeof _gxLum === 'function') {
    var cands = [sport === 'mlb' ? null : _tcHex(alt), c.accent, c.fg];
    for (var i = 0; i < cands.length && !ring; i++) {
      var x = _tcHex(cands[i]);
      if (x && x !== _tcHex(c.bg) && Math.abs(_gxLum(x) - _gxLum(c.bg)) > 0.12) ring = x;
    }
  }
  return { abbr: abbr, bg: c.bg, fg: c.fg, accent: c.accent, ring: ring, known: known };
}
