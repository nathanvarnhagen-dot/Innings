// ── GROUP GAMES — today's MLB schedule by default, browsable to any past
// or upcoming day, with a chat scoped to each individual game. Reuses the
// same /api/mlb serverless endpoint (and _boxScoreCardHtml renderer) the
// box-score-attach feature already relies on elsewhere in the app.
window._gdGamesDate = window._gdGamesDate || null;
window._gdGamesList = [];
window._gdActiveGame = null;

function loadGroupGames(date) {
  window._gdGamesDate = date || window._gdGamesDate || _todayLocal();
  var listEl = document.getElementById('gd-games-list');
  var labelEl = document.getElementById('gd-games-date-label');
  var todayLinkEl = document.getElementById('gd-games-today-link');
  var today = _todayLocal();
  if (labelEl) labelEl.textContent = window._gdGamesDate === today ? 'Today' : _formatMomentDate(window._gdGamesDate);
  if (todayLinkEl) todayLinkEl.style.display = window._gdGamesDate === today ? 'none' : 'block';
  if (!listEl) return;
  var requestedDate = window._gdGamesDate;
  listEl.innerHTML = '<div style="font-size:13px;color:var(--subtle);padding:8px 2px">Loading games…</div>';
  fetch('/api/mlb?mode=schedule&date=' + encodeURIComponent(requestedDate))
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (window._gdGamesDate !== requestedDate) return; // superseded by a newer date nav
      var games = data.games || [];
      window._gdGamesList = games;
      if (!games.length) {
        listEl.innerHTML = '<div style="text-align:center;padding:32px 16px"><div style="font-size:28px;margin-bottom:8px">⚾</div><div style="font-size:13px;color:var(--subtle)">No MLB games on this day</div></div>';
        return;
      }
      listEl.innerHTML = games.map(function(g, i){
        var scoreLabel = (g.awayScore != null && g.homeScore != null) ? (g.awayScore + '–' + g.homeScore) : '';
        return '<div onclick="openGroupGameDetail(' + i + ')" style="background:var(--card);border:0.5px solid var(--rule);border-radius:14px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.04)">' +
          '<div style="font-size:13px;font-weight:600;color:var(--black)">' + _escapeHtml(g.away || '?') + ' @ ' + _escapeHtml(g.home || '?') + '</div>' +
          '<div style="text-align:right;flex-shrink:0">' +
            (scoreLabel ? '<div style="font-size:13px;font-weight:700;color:var(--black)">' + _escapeHtml(scoreLabel) + '</div>' : '') +
            '<div style="font-size:11px;color:var(--subtle)">' + _escapeHtml(g.status || '') + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    })
    .catch(function(err){
      if (window._gdGamesDate !== requestedDate) return;
      console.error('Load group games error:', err);
      listEl.innerHTML = '<div style="text-align:center;padding:24px 16px;font-size:13px;color:var(--subtle)">Could not load games — try again</div>';
    });
}

// Noon avoids any DST/timezone edge cases when shifting a plain YYYY-MM-DD
// string by a day — same care _todayLocal() already takes elsewhere.
function gdGamesNav(delta) {
  var d = new Date(window._gdGamesDate + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  var mm = String(d.getMonth() + 1); if (mm.length < 2) mm = '0' + mm;
  var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
  loadGroupGames(d.getFullYear() + '-' + mm + '-' + dd);
}

function gdGamesToday() {
  loadGroupGames(_todayLocal());
}

function openGroupGameDetail(i) {
  var g = (window._gdGamesList || [])[i];
  if (!g) return;
  _openGroupGameDetailData(g);
}

// Jump straight into a specific game's detail/chat from anywhere that only
// has the gamePk on hand (namely, a game-activity notice in the main group
// Chat) — doesn't depend on the Games tab's currently-loaded date list at
// all, so it works regardless of what day is showing there.
function jumpToGroupGame(gamePk) {
  _openGroupGameDetailData({ gamePk: gamePk });
}

// Shared by both entry points above — just needs a gamePk (away/home are
// optional, used only as a fallback label if the box score fetch fails).
function _openGroupGameDetailData(g) {
  if (!g || !window._activeGroupId) return;
  window._gdActiveGame = { gamePk: g.gamePk, groupId: window._activeGroupId, label: (g.away && g.home) ? (g.away + ' @ ' + g.home) : null };
  var boxEl = document.getElementById('gd-game-detail-boxscore');
  if (boxEl) boxEl.innerHTML = '<div style="text-align:center;padding:16px 0;font-size:13px;color:var(--subtle)">Loading box score…</div>';
  var overlay = document.getElementById('gd-game-detail');
  if (overlay) overlay.style.display = 'flex';
  startGroupGameChat(window._activeGroupId, g.gamePk);
  fetch('/api/mlb?mode=boxscore&gamePk=' + encodeURIComponent(g.gamePk))
    .then(function(r){ return r.json(); })
    .then(function(box){
      if (!window._gdActiveGame || window._gdActiveGame.gamePk !== g.gamePk) return;
      if (!boxEl) return;
      // A game that hasn't started yet may come back with no score/innings
      // data at all — fall back to the plain schedule-list summary rather
      // than showing a blank box.
      if (box && box.away && box.home) window._gdActiveGame.label = box.away + ' @ ' + box.home;
      boxEl.innerHTML = _boxScoreCardHtml(box, false) ||
        ('<div style="text-align:center;padding:12px 0;font-size:13px;color:var(--subtle)">' + _escapeHtml(g.away || (box && box.away) || '?') + ' @ ' + _escapeHtml(g.home || (box && box.home) || '?') + ' · ' + _escapeHtml(g.status || 'Scheduled') + '</div>');
    })
    .catch(function(err){
      console.error('Load game box score error:', err);
      if (boxEl) boxEl.innerHTML = '<div style="text-align:center;padding:12px 0;font-size:13px;color:var(--subtle)">' + _escapeHtml(g.away || '?') + ' @ ' + _escapeHtml(g.home || '?') + '</div>';
    });
}

function closeGroupGameDetail() {
  var overlay = document.getElementById('gd-game-detail');
  if (overlay) overlay.style.display = 'none';
  window._gdActiveGame = null;
}

// ── PREGAME CHEAT SHEET HELPERS — shared by the Games screen (see
// GAMES BROWSER below) to build a probable-starter + lineup summary from
// /api/mlb?mode=pregame. Purely data-in/string-out, no DOM coupling, so
// they live here once rather than duplicated per screen that uses them.
window._gdPregame = { side: 'away', expand: false, data: null, loadedForGamePk: null };

// Small curated set of players whose Baseball-Reference ID we already
// know, so their chip can jump straight to the page instead of running a
// name search. Anyone not in here still gets a (labeled) search-page link.
var PREGAME_BR_SEED = {
  'Colt Keith':'k/keithco01','Kevin McGonigle':'m/mcgonke01','Gleyber Torres':'t/torregl01',
  'Riley Greene':'g/greenri03','Dillon Dingler':'d/dingldi01','Zach McKinstry':'m/mckinza01',
  'Spencer Torkelson':'t/torkesp01','Max Clark':'c/clarkma04','John Peck':'p/peckjo01',
  'Troy Melton':'m/meltotr01','Luke Keaschall':'k/keasclu01','Brooks Lee':'l/leebr02',
  'Kody Clemens':'c/clemeko01','Ryan Jeffers':'j/jeffery01','Josh Bell':'b/belljo02',
  'Royce Lewis':'l/lewisro02','Trevor Larnach':'l/larnatr01','Kaelen Culpepper':'c/culpeka01',
  'Walker Jenkins':'j/jenkiwa01','Joe Ryan':'r/ryanjo04'
};

function _pregameSlug(n) {
  return String(n).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function _pregameLinks(name, mlbamId) {
  var seed = PREGAME_BR_SEED[name];
  var out = [{
    label: 'BR', exact: !!seed,
    url: seed
      ? 'https://www.baseball-reference.com/players/' + seed + '.shtml'
      : 'https://www.baseball-reference.com/search/search.fcgi?search=' + encodeURIComponent(name)
  }];
  if (mlbamId) {
    out.push({ label: 'Savant', exact: true,
      url: 'https://baseballsavant.mlb.com/savant-player/' + _pregameSlug(name) + '-' + mlbamId });
  }
  return out;
}

// Same two-chip idea as baseball's BR+Savant: a named reference-site
// chip (what was actually asked for) plus a guaranteed-exact chip using
// an ID we actually control. Pro-Football-Reference and Sports-Reference's
// college-football site don't share an ID system with ESPN, so there's
// no way to construct a direct player-page URL the way Savant's MLBAM ID
// allows — every reference-site chip here is a search link. The ESPN
// chip is exact since it's ESPN's own athlete ID from the same roster
// call that produced this row.
function _footballRefLinks(name, espnId, sport) {
  var isCfb = sport === 'cfb';
  var refLabel = isCfb ? 'CFB Ref' : 'PFR';
  var refUrl = isCfb
    ? 'https://www.sports-reference.com/cfb/search/search.fcgi?search=' + encodeURIComponent(name)
    : 'https://www.pro-football-reference.com/search/search.fcgi?search=' + encodeURIComponent(name);
  var out = [{ label: refLabel, exact: false, url: refUrl }];
  if (espnId) {
    var espnPath = isCfb ? 'college-football' : 'nfl';
    out.push({ label: 'ESPN', exact: true,
      url: 'https://www.espn.com/' + espnPath + '/player/_/id/' + espnId + '/' + _pregameSlug(name) });
  }
  return out;
}

// Basketball-Reference is the same Sports-Reference family as PFR/CFB
// Ref above and shares the identical search.fcgi pattern already
// confirmed working for those — high confidence. It covers both NBA
// and WNBA under one site, so this is shared by both leagues. The ESPN
// site-path segment (nba/wnba) is a lower-confidence guess, not tested
// against a live page.
function _basketballRefLinks(name, espnId, league) {
  var out = [{ label: 'BBRef', exact: false, url: 'https://www.basketball-reference.com/search/search.fcgi?search=' + encodeURIComponent(name) }];
  if (espnId) {
    out.push({ label: 'ESPN', exact: true, url: 'https://www.espn.com/' + league + '/player/_/id/' + espnId + '/' + _pregameSlug(name) });
  }
  return out;
}

// FBref is also part of the Sports-Reference family and covers both MLS
// and NWSL (and most other soccer leagues) under one search — same
// confidence reasoning as Basketball-Reference above. ESPN's public
// site groups all soccer under one 'soccer' path rather than separate
// per-league paths, unlike the other sports here — also unverified.
function _hockeyRefLinks(name, nhlId) {
  var out = [{ label: 'HockeyRef', exact: false, url: 'https://www.hockey-reference.com/search/search.fcgi?search=' + encodeURIComponent(name) }];
  if (nhlId) out.push({ label: 'NHL', exact: true, url: 'https://www.nhl.com/player/' + encodeURIComponent(nhlId) });
  return out;
}
function _soccerRefLinks(name, espnId) {
  var out = [{ label: 'FBref', exact: false, url: 'https://fbref.com/en/search/search.fcgi?search=' + encodeURIComponent(name) }];
  if (espnId) {
    out.push({ label: 'ESPN', exact: true, url: 'https://www.espn.com/soccer/player/_/id/' + espnId + '/' + _pregameSlug(name) });
  }
  return out;
}

// Single dispatch point for every sport's reference-link pair, used by
// both the cheat sheet's inline chips and the player-link bottom sheet
// — previously each had its own copy of this branch, which is exactly
// the kind of duplication that lets two call sites quietly drift out of
// sync (as happened here: neither one had a basketball/soccer branch,
// so those sports were silently falling through to baseball links).
function _refLinksForLeague(name, id, league) {
  if (league === 'nfl' || league === 'cfb') return _footballRefLinks(name, id, league);
  if (league === 'nba' || league === 'wnba') return _basketballRefLinks(name, id, league);
  if (league === 'mls' || league === 'nwsl') return _soccerRefLinks(name, id);
  if (league === 'nhl') return _hockeyRefLinks(name, id);
  return _pregameLinks(name, id);
}

function _refChipsHtml(links) {
  return links.map(function (l) {
    return '<a href="' + _escapeHtml(l.url) + '" target="_blank" rel="noopener" style="font-size:10px;font-weight:700;padding:6px 9px;border-radius:8px;flex-shrink:0;text-decoration:none;' +
      (l.exact ? 'background:rgba(168,159,232,.2);color:#CECBF6' : 'background:rgba(255,255,255,.09);color:rgba(255,255,255,.62)') +
      '">' + l.label + '</a>';
  }).join('');
}


// Dispatches to the right reference-site pair for whichever sport's
// cheat sheet is currently open.
function _cheatSheetLinkChips(name, id, league) { return _refChipsHtml(_refLinksForLeague(name, id, league)); }

// Full-name labels here (vs the compact "BR"/"Savant"/"PFR" used on the
// small inline chips) since this sheet has room for it and the person
// tapped a name specifically to find out where it goes.
var PLAYER_LINK_LABELS = { BR: 'Baseball Reference', Savant: 'Baseball Savant', PFR: 'Pro Football Reference', 'CFB Ref': 'College Football Reference', BBRef: 'Basketball Reference', FBref: 'FBref', ESPN: 'ESPN Player Page', HockeyRef: 'Hockey Reference', NHL: 'NHL.com Player Page' };
function openPlayerLinkSheet(name, id, league) {
  var links = _refLinksForLeague(name, id, league);
  var nameEl = document.getElementById('player-link-name');
  var rowsEl = document.getElementById('player-link-rows');
  if (nameEl) nameEl.textContent = name;
  if (rowsEl) {
    rowsEl.innerHTML = links.map(function (l) {
      return '<a href="' + _escapeHtml(l.url) + '" target="_blank" rel="noopener" onclick="closePlayerLinkSheet()" style="display:flex;align-items:center;justify-content:space-between;padding:14px 4px;border-top:0.5px solid rgba(255,255,255,.08);text-decoration:none;color:#fff;font-size:14px;font-weight:600">' +
        '<span>' + _escapeHtml(PLAYER_LINK_LABELS[l.label] || l.label) + '</span>' +
        '<span style="color:rgba(255,255,255,.35);font-size:16px">›</span></a>';
    }).join('');
  }
  var sv = document.getElementById('player-sav');
  if (sv) { if (league === 'mlb' && id && typeof _savPlayerSheetFill === 'function') { window._savSheetId = String(id); _savPlayerSheetFill(id); } else { window._savSheetId = null; sv.innerHTML = ''; } }
  var backdrop = document.getElementById('player-link-backdrop');
  if (backdrop) {
    clearTimeout(window._plsCloseT);
    backdrop.classList.remove('pls-out');
    backdrop.style.display = 'flex';
    backdrop.classList.remove('pls-in'); void backdrop.offsetWidth; backdrop.classList.add('pls-in');
    var sheet = backdrop.firstElementChild; if (sheet) sheet.scrollTop = 0;
  }
}
function closePlayerLinkSheet() {
  var backdrop = document.getElementById('player-link-backdrop');
  if (!backdrop) return;
  window._savSheetId = null;
  if (_ghReducedMotion && _ghReducedMotion()) { backdrop.style.display = 'none'; return; }
  backdrop.classList.remove('pls-in'); backdrop.classList.add('pls-out');
  window._plsCloseT = setTimeout(function () { backdrop.style.display = 'none'; backdrop.classList.remove('pls-out'); }, 200);
}

// data-* attributes rather than embedding the name in the onclick string
// directly — a name with an apostrophe (O'Neill, etc.) would otherwise
// break out of a single-quoted onclick argument.
function _clickablePlayerNameHtml(p, league) {
  if (!p || !p.id) return _escapeHtml((p && p.name) || '—');
  return '<span data-name="' + _escapeHtml(p.name) + '" data-id="' + _escapeHtml(String(p.id)) + '" data-league="' + _escapeHtml(league) + '" onclick="openPlayerLinkSheet(this.dataset.name,this.dataset.id,this.dataset.league)" style="cursor:pointer;text-decoration:underline;text-decoration-color:rgba(255,255,255,.25);text-underline-offset:3px">' + _escapeHtml(p.name) + '</span>';
}

// The one hitter worth watching: the best OPS among anyone with a real
// sample this season, with a callout instead for a young player already
// hitting well, since that's usually the more interesting watch.
function _pregameWatchLine(side) {
  var rows = (side.rows || []).filter(function (r) { return r.pa > 40; });
  if (!rows.length) {
    return (side.rows && side.rows[0]) ? (side.rows[0].name + ' is the one to keep an eye on here.') : '';
  }
  var best = rows.slice().sort(function (a, b) { return b.ops - a.ops; })[0];
  var young = rows.filter(function (r) { return r.age && r.age <= 23; })
    .sort(function (a, b) { return b.ops - a.ops; })[0];
  if (young && young.ops > 0.7 && young.name !== best.name) {
    return young.name + ' is ' + young.age + ' and already hitting ' + young.line.split(' / ')[0] +
      '. Watch what the pitcher does to him the second time through.';
  }
  return best.name + ' is the most dangerous bat in this lineup at ' + best.line +
    '. If the game turns, it probably turns on him.';
}

function _pregameMarkedIdx(side) {
  var rows = (side.rows || []).filter(function (r) { return r.pa > 40; });
  if (!rows.length) return -1;
  var best = rows.slice().sort(function (a, b) { return b.ops - a.ops; })[0];
  return (side.rows || []).indexOf(best);
}

// ── GAMES BROWSER — today's games for whichever league is active
// (window._gamesSport), browsable by day or by calendar, tap through to
// a cheat sheet + open chat for one specific game. MLB has full cheat
// sheets; NFL/CFB have real schedules + scores via /api/espn.js but the
// cheat sheet itself isn't built for football yet (see loadGameCheatSheet).
window._gamesListCache = [];
window._gamesDate = null;
window._gamesSport = 'mlb';
// Also toggles the teams (gear) button — that one shows for every sport,
// not just the ones with a playoff picture, since following a favorite
// team isn't gated by whether full game browsing exists for that sport
// yet.
function _refreshPlayoffBtnVisibility() {
  var btn = document.getElementById('games-playoff-btn');
  if (btn) btn.style.display = (window._gamesSport === 'mlb' || window._gamesSport === 'nfl') ? 'flex' : 'none';
  var teamsBtn = document.getElementById('games-teams-btn');
  if (teamsBtn) teamsBtn.style.display = 'flex';
}
// ── FAVORITE/FOLLOWED TEAM SPOTLIGHT — the actual point of Team
// Preferences: a favorite or followed team's game should surface at
// the top of whichever list it appears in, not just sit stored and
// unused. Cached per sport per session (teamPrefs rarely changes
// mid-browse); _invalidateFavTeamsCache is called from Team
// Preferences on every save so a change shows up on the very next
// games-list render, not after a reload.
window._favTeamsCache = {};
function _loadFavTeams(sport) {
  if (window._favTeamsCache[sport]) return Promise.resolve(window._favTeamsCache[sport]);
  var user = window.currentUser || (window.auth && window.auth.currentUser);
  if (!user || !window.db) return Promise.resolve({ favorite: null, following: [] });
  return window.db.collection('users').doc(user.uid).collection('teamPrefs').doc(sport).get()
    .then(function (doc) {
      var d = doc.exists ? doc.data() : {};
      var prefs = { favorite: d.favorite || null, following: d.following || [] };
      window._favTeamsCache[sport] = prefs;
      return prefs;
    })
    .catch(function (err) { console.error('Load favorite teams error:', err); return { favorite: null, following: [] }; });
}
function _invalidateFavTeamsCache(sport) { delete window._favTeamsCache[sport]; }

function _gameInvolvesTeam(g, teamName) { return !!teamName && (g.away === teamName || g.home === teamName); }
function _spotlightBadgeHtml(g, favTeams) {
  if (_gameInvolvesTeam(g, favTeams.favorite)) return '<span style="color:#F2C869;font-size:13px;margin-right:5px">★</span>';
  if ((favTeams.following || []).some(function (t) { return _gameInvolvesTeam(g, t); })) return '<span style="color:#9be8ac;font-size:11px;margin-right:5px">●</span>';
  return '';
}
// Pulls favorite/followed games out to their own group (favorite-
// involving games first within it) and returns whatever's left
// separately, rather than just marking them in place — "at the top"
// means actually moved there, not just badged where they already sat.
function _splitSpotlight(games, favTeams) {
  if (!favTeams.favorite && !(favTeams.following || []).length) return { spotlight: [], rest: games };
  var spotlight = [], rest = [];
  games.forEach(function (g) {
    var isFav = _gameInvolvesTeam(g, favTeams.favorite);
    var isFollowing = (favTeams.following || []).some(function (t) { return _gameInvolvesTeam(g, t); });
    if (isFav || isFollowing) spotlight.push(g); else rest.push(g);
  });
  spotlight.sort(function (a, b) {
    return (_gameInvolvesTeam(b, favTeams.favorite) ? 1 : 0) - (_gameInvolvesTeam(a, favTeams.favorite) ? 1 : 0);
  });
  return { spotlight: spotlight, rest: rest };
}

// Same idea as the football week view's own upcoming/concluded split
// (_renderFootballWeekHtml below), pulled out so the single-day MLB list
// can use it too: games already pulled into "Your teams" by
// _splitSpotlight are exempt, since a followed team's game stays visible
// up top win or lose — this only ever sorts what's left.
function _splitConcluded(games) {
  var upcoming = [], concluded = [];
  games.forEach(function (g) { (_isGameConcluded(g.status) ? concluded : upcoming).push(g); });
  return { upcoming: upcoming, concluded: concluded };
}

function _formatGameTime(iso) {
  if (!iso) return null;
  var d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  var h = d.getHours(), m = d.getMinutes();
  var ampm = h >= 12 ? 'PM' : 'AM';
  var h12 = h % 12; if (h12 === 0) h12 = 12;
  var mStr = m < 10 ? '0' + m : String(m);
  return h12 + ':' + mStr + ' ' + ampm;
}

// Three states a game card's badge can be in: concluded (final score),
// live (pulsing dot + LIVE + current score if available), or scheduled
// (start time, converted to the viewer's local timezone by new Date()
// — the ISO string from both backends is UTC). Shared by MLB's day
// list and NFL/CFB's week list so the three states look identical
// everywhere.
function _gameBadgeHtml(g, dayPrefix) {
  var concluded = _isGameConcluded(g.status);
  var live = !concluded && _isGameStatusLive(g.status);
  var scoreLabel = (g.awayScore != null && g.homeScore != null) ? (g.awayScore + '–' + g.homeScore) : null;
  var prefix = dayPrefix ? dayPrefix + ' ' : '';
  if (concluded) {
    // v5.85.0: a finished game says so plainly — FINAL plus the score.
    return '<div style="font-size:10.5px;padding:4px 10px;border-radius:20px;background:rgba(168,159,232,.26);border:1px solid rgba(168,159,232,.45);color:#fff;flex-shrink:0;font-weight:800;letter-spacing:.04em;display:flex;align-items:center;gap:6px">' + (prefix ? _escapeHtml(prefix) : '') + '<span style="color:#CECBF6">FINAL</span>' + (scoreLabel ? '<span>' + _escapeHtml(scoreLabel) + '</span>' : '') + '</div>';
  }
  if (live) {
    return '<div style="font-size:10px;padding:4px 10px;border-radius:20px;background:rgba(232,98,44,.2);color:#F2916A;flex-shrink:0;font-weight:700;display:flex;align-items:center;gap:5px"><span style="width:6px;height:6px;border-radius:50%;background:#F2916A;display:inline-block;flex-shrink:0"></span>' + _escapeHtml(prefix) + 'LIVE' + (scoreLabel ? ' · ' + _escapeHtml(scoreLabel) : '') + '</div>';
  }
  var timeLabel = _formatGameTime(g.startTime) || g.status || 'Scheduled';
  return '<div style="font-size:10px;padding:4px 10px;border-radius:20px;background:rgba(255,255,255,.08);color:rgba(255,255,255,.6);flex-shrink:0">' + _escapeHtml(prefix + timeLabel) + '</div>';
}

// ── LIVE GLANCE DETAIL (v5.46.0) — a schedule-list card only gets this
// extra section once it's actually live AND its box score has come back;
// scheduled and concluded games keep the plain row above untouched. Reuses
// the same box.situation/box.matchup shapes _boxScoreCardHtml already
// renders elsewhere (bases/outs green-and-orange fill, matchup row), just
// laid out compactly for a list card instead of the full game screen.
function _glanceBaseballDetailHtml(box) {
  var s = box.situation;
  if (!s || (s.outs == null && !s.bases)) return '';
  var baseFill = function (on) { return on ? '#7CF29C' : 'rgba(255,255,255,.18)'; };
  var basesSvg = '<svg width="28" height="28" viewBox="0 0 60 60" style="flex-shrink:0">' +
    '<polygon points="30,10 50,30 30,50 10,30" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2"/>' +
    '<circle cx="30" cy="10" r="5" fill="' + baseFill(s.bases && s.bases.second) + '"/>' +
    '<circle cx="10" cy="30" r="5" fill="' + baseFill(s.bases && s.bases.third) + '"/>' +
    '<circle cx="50" cy="30" r="5" fill="' + baseFill(s.bases && s.bases.first) + '"/>' +
    '</svg>';
  var outsDots = [0, 1, 2].map(function (i) {
    return '<span style="width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:4px;background:' + (s.outs != null && i < s.outs ? '#E8622C' : 'rgba(255,255,255,.18)') + '"></span>';
  }).join('');
  var inningLabel = s.inning != null ? ((s.half === 'top' ? '▲ Top ' : '▼ Bottom ') + _ordinalSuffix(s.inning)) : '';
  var row1 = '<div style="display:flex;align-items:center;justify-content:space-between">' +
    (inningLabel ? '<span style="font-size:12px;font-weight:700;color:#A89FE8">' + _escapeHtml(inningLabel) + '</span>' : '<span></span>') +
    '<div style="display:flex;align-items:center;gap:8px">' + basesSvg + '<div style="display:flex;align-items:center">' + outsDots + '</div></div>' +
    '</div>';
  var matchup = '';
  if (box.matchup && (box.matchup.pitcher || box.matchup.batter)) {
    var mp = box.matchup.pitcher, mb = box.matchup.batter;
    matchup = '<div style="display:flex;align-items:center;gap:8px;margin-top:8px">' +
      '<span style="font-size:9.5px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;flex-shrink:0">P</span>' +
      '<span onclick="event.stopPropagation()" style="font-size:12.5px;font-weight:600;color:#fff;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _clickablePlayerNameHtml(mp, 'mlb') + '</span>' +
      '<span onclick="event.stopPropagation()" style="font-size:12.5px;font-weight:600;color:#fff;flex:1;min-width:0;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _clickablePlayerNameHtml(mb, 'mlb') + '</span>' +
      '<span style="font-size:9.5px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;flex-shrink:0">AB</span>' +
      '</div>';
  }
  return '<div class="glance-detail" style="margin-top:10px;padding-top:10px;border-top:0.5px solid rgba(255,255,255,.09)">' + row1 + matchup + '</div>';
}

// ESPN reports down 0 or -1 on kickoffs, extra points and between drives.
// The API now nulls those out, but responses cached before that fix can
// still carry one, which is what rendered "-1th & 0" on a live card.
function _fbDownText(down, distance) {
  var labels = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };
  var n = Number(down);
  if (!isFinite(n) || n < 1 || n > 4) return '';
  return labels[n] + ' & ' + (distance === 0 ? 'Goal' : (distance != null ? distance : '?'));
}

// ── ONE FOOTBALL FIELD, drawn the same on the game card and the game
// screen, just bigger on the screen. Everything upstream normalizes into
// the same view object so there is a single place that draws turf.
//
// Both sources put the AWAY end zone on the left and the HOME end zone on
// the right, which means the offense advances left-to-right when the away
// team has the ball. The two sources disagree about their own units — the
// game card counts from the possessing team's own goal, the game screen
// counts absolutely from the home goal — so each adapter converts to a
// single left-to-right percentage before anything is drawn.
