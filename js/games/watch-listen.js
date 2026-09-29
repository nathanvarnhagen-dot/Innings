// ═══ WATCH & LISTEN + BOX TABS (v7.5.0) ═══════════════════════════════════
// Two more tabs on every game page:
//   Watch & Listen — only the places this game can be watched or heard where
//     you are, with the best one on top and a one-tap button for each.
//   Box — the full box score, moved off the cheat sheet onto its own tab.
//
// Channels come from /api/recap?watch=<sport>&id=<game> (see api/recap.js),
// which reads the broadcast lists MLB, ESPN and the NHL publish per game.
// "Where you are" is a metro area: picked on the tab, or worked out from your
// favorite teams. Regional channels for other areas are left off.
//
// Depends on: gameDetailTab, renderGameCheatSheet, _boxScoreDetailSectionHtml,
// _gxBoxHtml, _loadFavTeams, _escapeHtml.

// ── metro areas ──────────────────────────────────────────────────────────
var WL_METROS = [
  ['Bay Area', /San Francisco|Oakland|San Jose|Golden State|Bay FC|Earthquakes|Valkyries|Stanford|California Golden/],
  ['Los Angeles', /Los Angeles|^LA |LAFC|Angel City|Anaheim|UCLA|USC Trojans|Galaxy/],
  ['San Diego', /San Diego/], ['Sacramento', /Sacramento|Athletics/],
  ['Seattle', /Seattle|Kraken|Storm|Reign|Washington Huskies/], ['Portland', /Portland/],
  ['Las Vegas', /Las Vegas|Vegas|Aces/], ['Phoenix', /Phoenix|Arizona|Mercury/], ['Salt Lake City', /Utah|Real Salt Lake/],
  ['Denver', /Denver|Colorado/], ['Dallas', /Dallas|Texas Rangers|Texas Stars|Wings|FC Dallas/], ['Houston', /Houston/],
  ['San Antonio', /San Antonio/], ['Austin', /Austin|Texas Longhorns/], ['Oklahoma City', /Oklahoma City/],
  ['Minneapolis', /Minnesota|Lynx/], ['Kansas City', /Kansas City|Sporting/], ['St. Louis', /St\.? Louis/],
  ['Chicago', /Chicago|Sky\b|Fire\b/], ['Milwaukee', /Milwaukee/], ['Green Bay', /Green Bay/], ['Detroit', /Detroit/],
  ['Indianapolis', /Indiana|Indianapolis/], ['Cleveland', /Cleveland/], ['Cincinnati', /Cincinnati/], ['Columbus', /Columbus|Ohio State/],
  ['Pittsburgh', /Pittsburgh/], ['Buffalo', /Buffalo/], ['Toronto', /Toronto/], ['Montreal', /Montr[eé]al/], ['Ottawa', /Ottawa/],
  ['Boston', /Boston|New England/], ['New York', /New York|Brooklyn|New Jersey|NY |NJ |Liberty|Gotham/], ['Philadelphia', /Philadelphia|Union\b/],
  ['Baltimore', /Baltimore/], ['Washington', /Washington|D\.C\.|Capitals|Spirit|Mystics|Commanders/],
  ['Charlotte', /Charlotte|Carolina Panthers/], ['Raleigh', /Carolina Hurricanes|Courage|North Carolina/], ['Atlanta', /Atlanta|Dream/],
  ['Nashville', /Nashville|Tennessee/], ['Memphis', /Memphis/], ['New Orleans', /New Orleans/], ['Jacksonville', /Jacksonville/],
  ['Orlando', /Orlando/], ['Tampa Bay', /Tampa/], ['Miami', /Miami|Florida Panthers/],
  ['Winnipeg', /Winnipeg/], ['Calgary', /Calgary/], ['Edmonton', /Edmonton/], ['Vancouver', /Vancouver/]
];
function _wlMetroOf(teamName) {
  var n = String(teamName || '');
  for (var i = 0; i < WL_METROS.length; i++) if (WL_METROS[i][1].test(n)) return WL_METROS[i][0];
  return null;
}
function _wlUserMetro() {
  try { var m = localStorage.getItem('innings_metro'); if (m) return m; } catch (e) {}
  // Otherwise the home of your favorite team, baseball first
  var c = window._favTeamsCache || {};
  var order = ['mlb', 'nfl', 'nba', 'nhl', 'wnba', 'mls', 'nwsl', 'cfb'];
  for (var i = 0; i < order.length; i++) { var f = c[order[i]] && c[order[i]].favorite; var m2 = f && _wlMetroOf(f); if (m2) return m2; }
  return null;
}
function wlSetMetro(v) {
  try { if (v) localStorage.setItem('innings_metro', v); else localStorage.removeItem('innings_metro'); } catch (e) {}
  _wlRender();
}

// ── networks → how to open them ──────────────────────────────────────────
// [match, tile text, tile color, link, app name]
var WL_NETS = [
  [/ESPN\+/i, 'E+', '#B51F2E', 'https://www.espn.com/watch/', 'ESPN app'],
  [/ESPN|ABC|SEC Network|ACC Network|SECN|ACCN/i, 'ESPN', '#B51F2E', 'https://www.espn.com/watch/', 'ESPN app'],
  [/NBC Sports (Bay|Cal|Boston|Chicago|Phil|Wash)|NBCS/i, 'NBCS', '#1D5FA8', 'https://www.nbcsports.com/watch', 'NBC Sports app'],
  [/Peacock|NBC|USA Net/i, 'NBC', '#2B2B2B', 'https://www.peacocktv.com/sports', 'Peacock'],
  [/FOX|FS1|FS2|Big Ten|BTN/i, 'FOX', '#003F7D', 'https://www.foxsports.com/live', 'FOX Sports app'],
  [/CBS|Paramount/i, 'CBS', '#0B4FD9', 'https://www.paramountplus.com/', 'Paramount+'],
  [/Prime|Amazon/i, 'prime', '#0F79AF', 'https://www.amazon.com/gp/video/storefront', 'Prime Video'],
  [/Apple|Season Pass/i, 'tv', '#111111', 'https://tv.apple.com/', 'Apple TV'],
  [/Netflix/i, 'N', '#B20710', 'https://www.netflix.com/', 'Netflix'],
  [/TNT|TBS|truTV|HBO|\bMax\b/i, 'TNT', '#3B2F7A', 'https://www.hbomax.com/', 'HBO Max'],
  [/NFL Net|NFLN|NFL\+/i, 'NFL', '#013369', 'https://www.nfl.com/plus/', 'NFL+'],
  [/NBA TV|League Pass/i, 'NBA', '#1D428A', 'https://www.nba.com/watch/league-pass-stream', 'NBA app'],
  [/MLB Net|MLBN/i, 'MLBN', '#0C2C56', 'https://www.mlb.com/network', 'MLB app'],
  [/YouTube/i, 'YT', '#C4302B', 'https://tv.youtube.com/', 'YouTube TV'],
  [/Roku/i, 'ROKU', '#5B2A86', 'https://therokuchannel.roku.com/', 'The Roku Channel'],
  [/FanDuel|Bally|FDSN/i, 'FDSN', '#1B5FAA', 'https://www.fanduelsportsnetwork.com/', 'FanDuel Sports app'],
  [/Spectrum|SportsNet LA|SNLA/i, 'SNLA', '#1C3A6E', 'https://www.spectrumsportsnet.com/', 'Spectrum SportsNet'],
  [/MASN/i, 'MASN', '#1F3A6B', 'https://www.masnsports.com/', 'MASN app'],
  [/\bSNY\b/i, 'SNY', '#0B2A5B', 'https://sny.tv/', 'SNY app'],
  [/\bYES\b/i, 'YES', '#0C2340', 'https://www.yesnetwork.com/', 'YES app'],
  [/NESN/i, 'NESN', '#0C2C56', 'https://nesn.com/', 'NESN 360'],
  [/Marquee/i, 'MRQ', '#0E3386', 'https://www.marqueesportsnetwork.com/', 'Marquee app'],
  [/ROOT|Root Sports/i, 'ROOT', '#0C2C56', 'https://www.rootsports.com/', 'ROOT SPORTS'],
  [/Victory\+/i, 'V+', '#2F1E6B', 'https://www.victoryplus.com/', 'Victory+'],
  [/\bMSG\b/i, 'MSG', '#1A2A55', 'https://www.msgnetworks.com/', 'MSG+'],
  [/Monumental/i, 'MNMT', '#0E3B6E', 'https://www.monumentalsportsnetwork.com/', 'Monumental+']
];
// Short network codes some feeds use (the NHL's especially), spelled out
var WL_NAMES = { NBCSCA: 'NBC Sports California', NBCSBA: 'NBC Sports Bay Area', 'NBCS-BA': 'NBC Sports Bay Area', NBCSB: 'NBC Sports Boston', NBCSCH: 'NBC Sports Chicago', NBCSP: 'NBC Sports Philadelphia', MSGSN: 'MSG Sportsnet', 'MSG-B': 'MSG Sportsnet', 'SNLA': 'SportsNet LA', 'SN-PIT': 'SportsNet Pittsburgh', 'NESN+': 'NESN+' };
function _wlPretty(name) { var k = String(name || '').trim(); return WL_NAMES[k] || WL_NAMES[k.toUpperCase()] || k; }
// Links that open an app directly (the web link is always offered next to it)
var WL_SCHEMES = { 'ESPN app': 'sportscenter://', 'Netflix': 'nflx://', 'Prime Video': 'aiv://', 'Apple TV': 'videos://', 'YouTube TV': 'youtubetv://' };
function _wlNet(name) {
  for (var i = 0; i < WL_NETS.length; i++) if (WL_NETS[i][0].test(name)) return { tile: WL_NETS[i][1], color: WL_NETS[i][2], url: WL_NETS[i][3], app: WL_NETS[i][4], scheme: WL_SCHEMES[WL_NETS[i][4]] || '' };
  var words = String(name).replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  var tile = words.length > 1 ? words.slice(0, 4).map(function (w) { return w.charAt(0); }).join('').toUpperCase() : String(name).slice(0, 4).toUpperCase();
  return { tile: tile, color: '#3D3580', url: 'https://www.google.com/search?q=' + encodeURIComponent('watch ' + name + ' live'), app: null };
}
function _wlRadioTile(b) {
  var m = String(b.name).match(/\b(\d{2,4}(\.\d)?)\b/) || String(b.call || '').match(/\b(\d{2,4}(\.\d)?)\b/);
  if (b.lang === 'es') return 'ES';
  return m ? m[1] : String(b.call || b.name).replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'FM';
}

// ── state ────────────────────────────────────────────────────────────────
window._wl = { key: null, data: null, loading: false };
function _wlGame() { return window._activeBrowseGame || null; }
function _wlLoad() {
  var g = _wlGame(); if (!g) return;
  var key = (g.sport || 'mlb') + ':' + g.gamePk;
  if (window._wl.key === key && (window._wl.data || window._wl.loading)) { _wlRender(); return; }
  window._wl = { key: key, data: null, loading: true };
  _wlRender();
  // favorites feed the "where you are" guess
  var favs = typeof _loadFavTeams === 'function' ? Promise.all([_loadFavTeams('mlb'), _loadFavTeams(g.sport || 'mlb')]) : Promise.resolve();
  var url = '/api/recap?watch=' + encodeURIComponent(g.sport || 'mlb') + '&id=' + encodeURIComponent(g.gamePk) + (g.date ? '&date=' + encodeURIComponent(String(g.date).slice(0, 10)) : '');
  Promise.all([fetch(url).then(function (r) { return r.json(); }).catch(function () { return null; }), favs.catch(function () {})]).then(function (res) {
    if (window._wl.key !== key) return;
    var d = res[0];
    window._wl = { key: key, data: d && !d.empty ? d : { empty: true }, loading: false };
    _wlRender();
  });
}
// The game's state right now: the gamecast knows it better than a cached answer
function _wlPhase(d) {
  var gp = window._gdPregame;
  if (gp && gp.gx && gp.gx.phase) return gp.gx.phase === 'live' ? 'live' : gp.gx.phase === 'final' ? 'final' : 'pre';
  var box = window._lastLiveBox;
  if (box && box.gameState) return box.gameState === 'Live' ? 'live' : box.gameState === 'Final' ? 'final' : 'pre';
  return (d && d.state) || 'pre';
}

// Everything that works where you are, sorted: [{kind:'watch'|'listen', name, sub, tile, color, url, cta, rank}]
function _wlOptions(d, metro) {
  var g = _wlGame(), sport = d.sport || (g && g.sport) || 'mlb';
  var homeMetro = _wlMetroOf(d.home && d.home.name), awayMetro = _wlMetroOf(d.away && d.away.name);
  var inHome = !!metro && metro === homeMetro, inAway = !!metro && metro === awayMetro, inMarket = inHome || inAway;
  var reachable = function (b) { return b.side === 'national' || !metro || (b.side === 'home' ? inHome : inAway); };
  var gameUrl = 'https://www.mlb.com/gameday/' + encodeURIComponent(d.id);
  var mlbApp = 'mlbatbat://gameday/' + encodeURIComponent(d.id); // opens the MLB app; the website is the fallback
  var watch = [], listen = [], seen = {};
  (d.list || []).forEach(function (b) {
    if (b.kind === 'radio') {
      // Baseball radio plays anywhere in the MLB app; other leagues' radio streams are usually local
      if (sport !== 'mlb' && !reachable(b)) return;
      var side = b.lang === 'es' ? 'Spanish call' : b.side === 'national' ? 'National radio' : b.side === 'home' ? (_wlShort(d.home) + ' radio') : (_wlShort(d.away) + ' radio');
      listen.push({ kind: 'listen', name: b.name, sub: side + (sport === 'mlb' ? ' · in the MLB app' : ''), tile: _wlRadioTile(b), color: b.lang === 'es' ? '#2A5E4A' : '#3A2C7A',
        url: sport === 'mlb' ? gameUrl : 'https://tunein.com/search/?query=' + encodeURIComponent(b.name), scheme: sport === 'mlb' ? mlbApp : '', tag: b.lang === 'es' ? 'ESP' : b.side === 'national' ? 'NATIONAL' : b.side.toUpperCase(), rank: b.side === 'national' ? 1 : (b.side === 'home' ? 2 : 3) + (b.lang === 'es' ? 2 : 0) });
      return;
    }
    if (!reachable(b)) return;
    b = Object.assign({}, b, { name: _wlPretty(b.name) });
    var n = _wlNet(b.name);
    if (seen[n.app || b.name]) return; // ESPN + ABC etc. open the same app — one row each is enough
    seen[n.app || b.name] = 1;
    var local = b.side !== 'national';
    watch.push({ kind: 'watch', name: b.name, sub: local ? 'Your local ' + _wlShort(b.side === 'home' ? d.home : d.away) + ' channel' : b.kind === 'stream' ? 'Streaming' : 'National broadcast', tile: n.tile, color: n.color, url: n.url, scheme: n.scheme, cta: n.app ? 'Watch in the ' + n.app.replace(/ app$/, '') + ' app' : 'Find ' + b.name,
      tag: local ? 'LOCAL' : '', rank: local ? 0 : b.kind === 'tv' ? 1 : 2 });
  });
  // Streams the league itself offers
  if (sport === 'mlb') {
    if (!d.national && !inMarket && metro) watch.push({ kind: 'watch', name: 'MLB.TV', sub: 'Out-of-market stream', tile: 'MLB', color: '#0C2C56', url: 'https://www.mlb.com/tv/g' + encodeURIComponent(d.id), scheme: mlbApp, cta: 'Watch on MLB.TV', rank: 3 });
    listen.unshift({ kind: 'listen', name: 'Listen live', sub: 'Home, away and Spanish calls in the MLB app', tile: 'MLB', color: '#0C2C56', url: gameUrl, scheme: mlbApp, cta: 'Listen in the MLB app', rank: 0, main: true });
  } else if (sport === 'nfl') {
    watch.push({ kind: 'watch', name: 'NFL+', sub: 'Live on phones and tablets', tile: 'NFL+', color: '#013369', url: 'https://www.nfl.com/plus/', cta: 'Watch on NFL+', rank: 4 });
  } else if ((sport === 'nba' || sport === 'wnba') && !d.national && !inMarket && metro) {
    watch.push({ kind: 'watch', name: sport === 'nba' ? 'NBA League Pass' : 'WNBA League Pass', sub: 'Out-of-market stream', tile: sport === 'nba' ? 'NBA' : 'WNBA', color: '#1D428A', url: 'https://www.nba.com/watch/league-pass-stream', cta: 'Watch on League Pass', rank: 3 });
  } else if (sport === 'mls' && !watch.some(function (w) { return /Apple/i.test(w.name); })) {
    watch.push({ kind: 'watch', name: 'Apple TV', sub: 'MLS Season Pass · every match', tile: 'tv', color: '#111111', url: 'https://tv.apple.com/', cta: 'Watch on Apple TV', rank: 1 });
  }
  // YouTube TV carries the national channels and the NBC Sports regionals
  var ytCarries = /ESPN(?!\+)|ABC|FOX|FS1|FS2|CBS|NBC|TNT|TBS|truTV|MLB Net|MLBN|NFL Net|NBA TV|Big Ten|BTN|SEC Net|ACC Net|USA Net/i;
  var carried = watch.filter(function (w) { return w.kind === 'watch' && ytCarries.test(w.name) && !/^(Peacock|NFL\+|MLB\.TV|.*League Pass)$/i.test(w.name); })[0]; // "NBC/Peacock" is NBC, which YouTube TV has
  if (carried && !watch.some(function (w) { return /YouTube/i.test(w.name); })) {
    watch.push({ kind: 'watch', name: 'YouTube TV', sub: 'Carries ' + carried.name, tile: 'YT', color: '#C4302B', url: 'https://tv.youtube.com/', scheme: 'youtubetv://', cta: 'Watch on YouTube TV', rank: carried.rank + 0.5 }); // app first, website if it isn't installed
  }
  watch.sort(function (a, b) { return a.rank - b.rank; });
  listen.sort(function (a, b) { return a.rank - b.rank; });
  return { watch: watch, listen: listen, inMarket: inMarket };
}
function _wlShort(t) { return t ? (typeof _teamShortName === 'function' ? _teamShortName(t.name) : (t.name || '').split(' ').pop()) : ''; }
function _wlListenPref() { try { return localStorage.getItem('innings_wl_listen') === '1'; } catch (e) { return false; } }
// Tap on an option that has an app link: try the app, and open the website only if the app didn't take over
function wlGo(ev, a) {
  var kind = a.getAttribute('data-kind'); wlOpen(kind);
  var scheme = a.getAttribute('data-scheme');
  if (!scheme) return true;
  ev.preventDefault();
  var web = a.getAttribute('href'), left = false;
  var gone = function () { left = true; };
  document.addEventListener('visibilitychange', gone, { once: true });
  window.addEventListener('pagehide', gone, { once: true });
  window.addEventListener('blur', gone, { once: true });
  window.location.href = scheme;
  setTimeout(function () { if (!left && !document.hidden) window.open(web, '_blank', 'noopener'); }, 1600);
  return false;
}
function wlOpen(kind) { try { if (kind === 'listen') localStorage.setItem('innings_wl_listen', '1'); else if (kind === 'watch') localStorage.removeItem('innings_wl_listen'); } catch (e) {} return true; }

// ── render ───────────────────────────────────────────────────────────────
function _wlRender() {
  var el = document.getElementById('game-watch-panel');
  if (!el || el.style.display === 'none') return;
  var st = window._wl, esc = _escapeHtml;
  if (st.loading || !st.data) { el.innerHTML = '<div class="wl-empty">Finding where this game is on…</div>'; return; }
  var d = st.data;
  var metro = _wlUserMetro();
  var pickArea = '<label class="wl-area"><span aria-hidden="true">◉</span><select id="wl-metro" onchange="wlSetMetro(this.value)" aria-label="Your area">' +
    '<option value="">' + (metro ? 'Anywhere' : 'Set your area') + '</option>' +
    WL_METROS.map(function (m) { return '<option' + (m[0] === metro ? ' selected' : '') + '>' + esc(m[0]) + '</option>'; }).join('') + '</select></label>';
  if (d.empty) { el.innerHTML = '<div class="wl-body">' + '<div class="wl-k">WATCH &amp; LISTEN' + pickArea + '</div><div class="wl-empty">No TV or radio listed for this game yet. Check back closer to game time.</div></div>'; return; }
  var o = _wlOptions(d, metro), phase = _wlPhase(d);
  var best = null;
  var listenMain = o.listen[0];
  if (phase === 'live' && _wlListenPref() && listenMain) best = listenMain;
  else if (o.watch.length) best = o.watch[0];
  else if (listenMain) best = listenMain;
  // Every option opens either way: in the app, or on the website. On a computer the website comes first.
  var desk = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
  var appLink = function (x, cls, label) { return '<a class="' + cls + '" href="' + esc(x.url) + '" target="_blank" rel="noopener" data-kind="' + x.kind + '" data-scheme="' + esc(x.scheme || '') + '" onclick="return wlGo(event,this)" aria-label="Open ' + esc(x.name) + ' in the app">' + label + '</a>'; };
  var webLink = function (x, cls, label) { return '<a class="' + cls + '" href="' + esc(x.url) + '" target="_blank" rel="noopener" onclick="wlOpen(\'' + x.kind + '\')" aria-label="Open ' + esc(x.name) + ' website">' + label + '</a>'; };
  var row = function (x) {
    var app = appLink(x, 'wl-go' + (desk ? '' : ' wl-go-main'), 'App'), web = webLink(x, 'wl-go' + (desk ? ' wl-go-main' : ''), 'Web');
    return '<div class="wl-row"><span class="wl-ap wl-ap-s" style="background:' + x.color + '">' + esc(x.tile) + '</span><div class="wl-t"><b>' + esc(x.name) + (x.tag ? '<span class="wl-tag">' + esc(x.tag) + '</span>' : '') + '</b><small>' + esc(x.sub) + '</small></div>' +
      '<div class="wl-btns">' + (desk ? web + app : app + web) + '</div></div>';
  };
  var restWatch = o.watch.filter(function (x) { return x !== best; });
  var restListen = o.listen.filter(function (x) { return x !== best && !(x.main && best && best.main); });
  var h = '<div class="wl-body">';
  if (phase === 'final') h += '<div class="wl-note">This game is over. Replays and condensed games are usually on the streaming apps below.</div>';
  if (best) {
    h += '<div class="wl-k">' + (best.kind === 'listen' ? 'BEST WAY TO FOLLOW' : 'BEST WAY TO WATCH') + pickArea + '</div>' +
      '<div class="wl-best"><div class="wl-top"><span class="wl-ap" style="background:' + best.color + '">' + esc(best.tile) + '</span><div class="wl-nm"><b>' + esc(best.name) + '</b><small>' + esc(best.sub) + '</small></div></div>' +
      '<div class="wl-ctas">' + (desk
        ? webLink(best, 'wl-cta wl-' + best.kind, (best.kind === 'listen' ? '🎧 ' : '▶ ') + esc((best.name === 'Listen live' ? 'MLB.com' : best.name) + ' website')) + appLink(best, 'wl-cta2', 'App')
        : appLink(best, 'wl-cta wl-' + best.kind, (best.kind === 'listen' ? '🎧 ' : '▶ ') + esc(best.cta || best.name)) + webLink(best, 'wl-cta2', 'Website')) + '</div></div>';
  } else h += '<div class="wl-k">WATCH &amp; LISTEN' + pickArea + '</div>';
  if (restWatch.length) h += '<div class="wl-k">' + (best && best.kind === 'watch' ? 'ALSO ON' : 'WATCH') + '</div><div class="wl-list">' + restWatch.map(row).join('') + '</div>';
  if (restListen.length) h += '<div class="wl-k">LISTEN<em>' + restListen.length + (restListen.length === 1 ? ' call' : ' calls') + '</em></div><div class="wl-list">' + restListen.map(row).join('') + '</div>';
  if (!best && !restWatch.length && !restListen.length) h += '<div class="wl-empty">Nothing available ' + (metro ? 'in ' + esc(metro) : 'here') + ' for this game.</div>';
  h += '<div class="wl-foot">' + (metro ? 'Only showing what’s available in ' + esc(metro) : 'Set your area to hide channels you can’t get') + '</div></div>';
  el.innerHTML = h;
}

// ── box tab ──────────────────────────────────────────────────────────────
function _wlBoxRender() {
  var el = document.getElementById('game-box-panel');
  if (!el || el.style.display === 'none') return;
  var g = _wlGame(), gp = window._gdPregame, html = '';
  if (g && (g.sport || 'mlb') !== 'mlb' && gp && gp.gx && typeof _gxBoxHtml === 'function') {
    var keep = window._gxBox.open; window._gxBox.open = true;
    html = _gxBoxHtml(gp.gx);
    window._gxBox.open = keep;
    if (html) html = '<div class="gbx-nohead">' + html + '</div>';
  } else if (window._lastLiveBox && window._lastLiveBox.boxScoreDetail && typeof _boxScoreDetailSectionHtml === 'function') {
    var b = window._lastLiveBox, keep2 = window._bsDetailState.expanded;
    window._bsDetailState.expanded = true;
    html = _boxScoreDetailSectionHtml(b.boxScoreDetail, b.away, b.home, 'rgba(255,255,255,.08)', 'rgba(255,255,255,0.65)', '#fff', true);
    window._bsDetailState.expanded = keep2;
    if (html) html = '<div class="gbx-nohead"><div class="gh-card">' + html + '</div></div>';
  } else if (window._lastLiveBox && typeof _boxScoreCardHtml === 'function') {
    html = _boxScoreCardHtml(window._lastLiveBox, true, false); // other sports when the gamecast isn't available
  }
  var scroll = el.scrollTop;
  el.innerHTML = html ? '<div class="gbx">' + html + '</div>' : '<div class="wl-empty">The box score shows up here once the game starts.</div>';
  el.scrollTop = scroll;
}

// ── tabs ─────────────────────────────────────────────────────────────────
window._gdExtraTab = null;
(function () {
  if (typeof gameDetailTab !== 'function') return;
  var orig = gameDetailTab;
  var ON = 'background:rgba(255,255,255,.14);color:#fff;border:none;border-radius:20px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;white-space:nowrap';
  var OFF = 'background:transparent;color:rgba(255,255,255,.5);border:none;border-radius:20px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;white-space:nowrap';
  gameDetailTab = function (key) {
    var extra = key === 'watch' || key === 'box' ? key : null;
    var r = orig.call(this, extra ? 'sheet' : key);
    var desk = typeof _isDesk === 'function' && _isDesk();
    // on desktop chat keeps its own column, so asking for it leaves the left side alone
    if (!extra && key === 'chat' && desk) extra = window._gdExtraTab;
    window._gdExtraTab = extra;
    if (extra) window._gdLeftTab = extra;
    var sheet = document.getElementById('game-sheet-panel');
    var wp = document.getElementById('game-watch-panel'), bp = document.getElementById('game-box-panel');
    var wb = document.getElementById('game-tab-watch'), bb = document.getElementById('game-tab-box');
    if (extra) {
      if (sheet) sheet.style.display = 'none';
      var sb = document.getElementById('game-tab-sheet'); if (sb) sb.style.cssText = OFF + ';flex-shrink:0';
    }
    if (wp) wp.style.display = extra === 'watch' ? 'block' : 'none';
    if (bp) bp.style.display = extra === 'box' ? 'block' : 'none';
    if (wb) wb.style.cssText = extra === 'watch' ? ON : OFF;
    if (bb) bb.style.cssText = extra === 'box' ? ON : OFF;
    ['game-tab-sheet', 'game-tab-chat', 'game-tab-rules'].forEach(function (id) { var b = document.getElementById(id); if (b) { b.style.flexShrink = '0'; b.style.whiteSpace = 'nowrap'; } });
    if (typeof _gshApply === 'function') setTimeout(_gshApply, 0);
    if (extra === 'watch') _wlLoad();
    if (extra === 'box') _wlBoxRender();
    return r;
  };
})();
// The box tab follows live updates; the cheat sheet re-renders on every tick
(function () {
  if (typeof renderGameCheatSheet !== 'function') return;
  var orig = renderGameCheatSheet;
  renderGameCheatSheet = function () {
    var r = orig.apply(this, arguments);
    if (window._gdExtraTab === 'box') _wlBoxRender();
    return r;
  };
})();
// Switching teams in the baseball box score
(function () {
  if (typeof setBoxScoreDetailSide !== 'function') return;
  var orig = setBoxScoreDetailSide;
  setBoxScoreDetailSide = function () { var r = orig.apply(this, arguments); if (window._gdExtraTab === 'box') _wlBoxRender(); return r; };
})();
// A new game opens on the cheat sheet, with fresh watch info
(function () {
  if (typeof _showGameScreen !== 'function') return;
  var orig = _showGameScreen;
  _showGameScreen = function () {
    window._gdExtraTab = null;
    var wp = document.getElementById('game-watch-panel'), bp = document.getElementById('game-box-panel');
    if (wp) wp.style.display = 'none';
    if (bp) bp.style.display = 'none';
    return orig.apply(this, arguments);
  };
})();
