// ── BETWEEN PERIODS ──────────────────────────────────────────────────
// Football stops for a while four times a game, and ESPN empties
// `situation` while it does — no down, no possession, no ball spot. That
// used to leave a hole where the field was. Now the field stays and
// carries what there is to say: the score, which break it is, and who has
// been the best player on each side so far.

// ESPN writes these as "Halftime", "End of 1st Quarter", "End of
// Regulation". Read from the same string _gxPeriodText uses for the
// clock, so the field and the clock can't contradict each other.
function _fbBreakLabelFrom(detail, tied) {
  var d = String(detail || '');
  if (/halftime|half time/i.test(d)) return 'HALFTIME';
  if (/end of regulation/i.test(d)) return tied ? 'END OF REGULATION' : 'FINAL';
  var m = d.match(/end of (?:the )?(\d)(?:st|nd|rd|th)/i);
  if (m) {
    var q = Number(m[1]);
    if (q === 2) return 'HALFTIME';
    // The fourth ending is only a break if it's still level; otherwise
    // the game is over and "End of 4th" is the wrong thing to say.
    if (q >= 4) return tied ? 'END OF REGULATION' : 'FINAL';
    return 'END OF ' + q + (q === 1 ? 'ST' : q === 3 ? 'RD' : 'TH');
  }
  if (/intermission/i.test(d)) return 'INTERMISSION';
  return null;
}

// A full game's worth of each category, used to judge one player's line
// against another's. Comparing raw numbers instead would pick the
// quarterback every single time, because passing yards dwarf everything
// else — a back with 80 on the ground has had a bigger day than a passer
// with 140, and this is what says so.
var FB_CATEGORY_BENCHMARK = { PASS: 250, RUSH: 80, REC: 80 };

function _fbShortName(name) {
  var parts = String(name || '').trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || '';
  return parts[0].charAt(0) + '. ' + parts.slice(1).join(' ');
}

function _fbTopPlayer(leaders, side) {
  var best = null;
  (leaders || []).forEach(function (row) {
    var p = row && row[side];
    if (!p || p.value == null || !isFinite(Number(p.value))) return;
    var bench = FB_CATEGORY_BENCHMARK[row.label] || 100;
    var rating = Number(p.value) / bench;
    if (!best || rating > best.rating) best = { rating: rating, name: p.name, line: p.line || '' };
  });
  if (!best) return null;
  return _fbShortName(best.name) + (best.line ? ' · ' + String(best.line).toLowerCase() : '');
}

// The ball already sits where the last play ended, so a signed yardage is
// enough to find where that play began. That sidesteps having to assume a
// play's own yard line shares a frame with the situation's.
function _fbPlayGeom(lp, endPct, dir) {
  if (!lp) return null;
  var g = { kind: lp.kind, label: lp.label, endPct: endPct, startPct: null };
  if (lp.yards != null && Number(lp.yards) !== 0) g.startPct = endPct - dir * Number(lp.yards);
  return g;
}

function _fbViewFromBox(fs, awayAbbr, homeAbbr) {
  if (!fs) return null;
  var isHome = fs.homeAway === 'home';
  var toPct = function (yl) { return isHome ? (100 - yl) : yl; };
  var pct = fs.yardLine != null ? toPct(fs.yardLine) : null;
  return {
    pct: pct,
    firstPct: (pct != null && fs.distance != null) ? toPct(fs.yardLine + fs.distance) : null,
    lastPlay: pct != null ? _fbPlayGeom(fs.lastPlay, pct, isHome ? -1 : 1) : null,
    awayColor: fs.awayColor, homeColor: fs.homeColor,
    awayAbbr: awayAbbr, homeAbbr: homeAbbr,
    logo: isHome ? fs.homeLogo : fs.awayLogo,
    possColor: (fs.team && fs.team.color) || '#A89FE8',
    possAbbr: (fs.team && fs.team.abbreviation) || '',
    aria: (fs.downText || _fbDownText(fs.down, fs.distance) || 'Field position') + (fs.possessionText ? ' at ' + fs.possessionText : '')
  };
}

function _fbViewFromGx(m) {
  var s = m && m.situation;
  if (!s) return null;
  var isHome = s.possSide === 'h';
  var toPct = function (spot) { return 100 - spot; }; // spot counts from the home goal
  var pct = s.spot != null ? toPct(s.spot) : null;
  var poss = isHome ? m.home : (s.possSide === 'a' ? m.away : null);
  return {
    pct: pct,
    firstPct: (pct != null && s.firstDown != null) ? toPct(s.firstDown) : null,
    lastPlay: pct != null ? _fbPlayGeom(s.lastPlay, pct, isHome ? -1 : 1) : null,
    awayColor: m.away.colors.bg, homeColor: m.home.colors.bg,
    awayAbbr: m.away.abbr, homeAbbr: m.home.abbr,
    logo: poss ? poss.logo : null,
    possColor: poss ? poss.colors.bg : '#A89FE8',
    possAbbr: poss ? poss.abbr : '',
    aria: (s.downText || 'Field position') + (s.posText ? ' at ' + s.posText : '')
  };
}

function _fbBreakLabel(m) {
  if (!m || m.sport !== 'football') return null;
  var tied = m.away && m.home && m.away.score != null && m.away.score === m.home.score;
  if (m.phase === 'final') return 'FINAL';
  if (m.phase !== 'live') return null;
  return _fbBreakLabelFrom(m.statusDetail || m.status, tied);
}


function _fbFieldSvg(v, big) {
  if (!v) return '';
  var hasBall = v.pct != null;
  var FT = big ? 32 : 23, FH = big ? 88 : 58, TOT = big ? 142 : 99;
  var mid = FT + FH / 2;
  var pinR = big ? 10 : 6.8, pinDrop = FH * 0.345;
  var chipH = big ? 22 : 17, chipFont = big ? 12 : 10, nameFont = big ? 12 : 10;
  var X = function (pct) { return 26 + Math.max(0, Math.min(100, pct)) * 2.68; };
  var n1 = function (x) { return x.toFixed(1); };
  window._fbPinSeq = (window._fbPinSeq || 0) + 1; // ids must stay unique across every field on screen
  var pin = 'fbpin' + window._fbPinSeq;
  var arrow = 'fbarrow' + window._fbPinSeq;
  var ballX = hasBall ? X(v.pct) : 0;

  var bands = '';
  [79.4, 133, 186.6, 240.2].forEach(function (x) { bands += '<rect x="' + x + '" y="' + FT + '" width="26.8" height="' + FH + '" fill="#1E4230"/>'; });
  var lines = '';
  for (var k = 1; k <= 9; k++) lines += 'M' + n1(26 + k * 26.8) + ' ' + FT + 'V' + (FT + FH);
  var hash = '';
  [40, 93, 146, 200, 253].forEach(function (x) {
    hash += 'M' + x + ' ' + n1(FT + FH * 0.24) + 'h6M' + x + ' ' + n1(FT + FH * 0.76) + 'h6';
  });

  var h = '<svg viewBox="0 0 320 ' + TOT + '" width="100%" height="' + TOT + '" style="display:block;flex-shrink:0" role="img" aria-label="' +
    _escapeHtml(v.aria || 'Field position') + '">' +
    '<defs><clipPath id="' + pin + '"><circle cx="' + n1(ballX) + '" cy="' + n1(mid - pinDrop) + '" r="' + pinR + '"/></clipPath>' +
    '<marker id="' + arrow + '" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="' + (big ? 7 : 5.5) + '" markerHeight="' + (big ? 7 : 5.5) + '" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#fff"/></marker></defs>' +
    '<rect x="0" y="' + FT + '" width="320" height="' + FH + '" rx="7" fill="#24523A"/>' + bands +
    '<path d="M0 ' + (FT + 7) + 'a7 7 0 0 1 7-7h19v' + FH + 'H7a7 7 0 0 1-7-7z" fill="' + (v.awayColor || '#2A2460') + '"/>' +
    '<path d="M294 ' + FT + 'h19a7 7 0 0 1 7 7v' + (FH - 14) + 'a7 7 0 0 1-7 7h-19z" fill="' + (v.homeColor || '#2A2460') + '"/>' +
    '<g stroke="rgba(255,255,255,.26)" stroke-width="1"><path d="' + lines + '"/></g>' +
    '<g stroke="rgba(255,255,255,.28)" stroke-width="1"><path d="' + hash + '"/></g>';

  if (hasBall && v.firstPct != null) h += '<rect x="' + n1(X(v.firstPct) - 1.3) + '" y="' + FT + '" width="2.6" height="' + FH + '" fill="#F2C869"/>';

  // A throw or a kick arcs through the air; a run travels along the
  // ground. Nothing is drawn when the ball didn't move.
  var lp = hasBall ? v.lastPlay : null;
  if (lp && lp.kind !== 'other' && lp.startPct != null) {
    var sx = X(lp.startPct), ex = X(lp.endPct);
    if (Math.abs(sx - ex) > 3) {
      var groundY = n1(FT + FH * 0.69);
      if (lp.kind === 'rush') {
        h += '<path d="M' + n1(sx) + ' ' + groundY + ' H' + n1(ex) + '" stroke="#fff" stroke-width="' + (big ? 2.8 : 2.2) + '" fill="none" stroke-linecap="round" marker-end="url(#' + arrow + ')"/>';
      } else {
        h += '<path d="M' + n1(sx) + ' ' + groundY + ' Q' + n1((sx + ex) / 2) + ' ' + n1(FT + FH * 0.17) + ' ' + n1(ex) + ' ' + n1(FT + FH * 0.59) + '" stroke="#fff" stroke-width="' + (big ? 2.4 : 2) + '" stroke-dasharray="3 4" fill="none" stroke-linecap="round" marker-end="url(#' + arrow + ')"/>';
      }
      h += '<circle cx="' + n1(sx) + '" cy="' + groundY + '" r="' + (big ? 4 : 3) + '" fill="#fff"/>';
    }
  }

  if (lp && lp.label) {
    var w = Math.max(big ? 58 : 48, lp.label.length * (big ? 7.4 : 6.2) + 16);
    var anchor = lp.startPct != null ? (X(lp.startPct) + X(lp.endPct)) / 2 : ballX;
    var cx = Math.max(6 + w / 2, Math.min(314 - w / 2, anchor));
    var chipY = Math.max(1, (FT - chipH) / 2); // the band above the turf, where nothing else is drawn
    h += '<rect x="' + n1(cx - w / 2) + '" y="' + n1(chipY) + '" width="' + n1(w) + '" height="' + chipH + '" rx="' + (chipH / 2) + '" fill="rgba(13,8,32,.92)" stroke="rgba(168,159,232,.28)" stroke-width="1"/>' +
      '<text x="' + n1(cx) + '" y="' + n1(chipY + chipH * 0.72) + '" text-anchor="middle" font-size="' + chipFont + '" font-weight="700" fill="#fff" font-family="-apple-system,Helvetica,sans-serif">' + _escapeHtml(lp.label) + '</text>';
  }

  // Between periods the turf is a backdrop: dimmed, with the score, the
  // break, and each side's best player stacked on it. Nothing else is
  // drawn, so none of it can be covered.
  if (v.breakLabel) {
    var sc = v.score || {};
    var long = v.breakLabel.length > 12;
    var labelSize = big ? (long ? 17 : 22) : (long ? 13 : 18);
    var scoreY = FT + FH * 0.23, labelY = FT + FH * 0.55;
    h += '<rect x="0" y="' + FT + '" width="320" height="' + FH + '" rx="7" fill="#0D0820" opacity=".66"/>';
    if (sc.away != null && sc.home != null) {
      var dim = function (mine, theirs) { return (mine < theirs) ? '#7A73A8' : '#fff'; };
      h += '<text x="160" y="' + n1(scoreY) + '" text-anchor="middle" font-size="' + (big ? 15 : 12) + '" font-weight="800" letter-spacing="1" font-family="-apple-system,Helvetica,sans-serif">' +
        '<tspan fill="#B9B3E6">' + _escapeHtml(sc.awayAbbr || '') + ' </tspan><tspan fill="' + dim(sc.away, sc.home) + '">' + sc.away + '</tspan>' +
        '<tspan fill="#7A73A8">  ·  </tspan>' +
        '<tspan fill="#B9B3E6">' + _escapeHtml(sc.homeAbbr || '') + ' </tspan><tspan fill="' + dim(sc.home, sc.away) + '">' + sc.home + '</tspan></text>';
    }
    h += '<text x="160" y="' + n1(labelY) + '" text-anchor="middle" font-size="' + labelSize + '" font-weight="800" fill="#fff" letter-spacing="' + (long ? 2 : 3) + '" font-family="-apple-system,Helvetica,sans-serif">' + _escapeHtml(v.breakLabel) + '</text>';
    (v.players || []).slice(0, 2).forEach(function (line, i) {
      h += '<text x="160" y="' + n1(FT + FH * (i === 0 ? 0.76 : 0.92)) + '" text-anchor="middle" font-size="' + (big ? 11 : 10) + '" font-weight="600" fill="#B9B3E6" font-family="-apple-system,Helvetica,sans-serif">' + _escapeHtml(line) + '</text>';
    });
  }

  // The logo paints over the abbreviation, so a logo that 404s or hasn't
  // loaded leaves the letter showing rather than a hole in the pin.
  var tipY = mid, cy = mid - pinDrop;
  if (hasBall) h += '<path d="M' + n1(ballX) + ' ' + n1(tipY) + ' l' + n1(-pinR * 0.8) + ' ' + n1(-(pinDrop - pinR * 0.55)) + ' a' + pinR + ' ' + pinR + ' 0 1 1 ' + n1(pinR * 1.6) + ' 0 z" fill="' + v.possColor + '" stroke="#fff" stroke-width="1.6"/>' +
    '<circle cx="' + n1(ballX) + '" cy="' + n1(cy) + '" r="' + pinR + '" fill="#fff"/>' +
    '<text x="' + n1(ballX) + '" y="' + n1(cy + pinR * 0.38) + '" text-anchor="middle" font-size="' + (big ? 12 : 10) + '" font-weight="800" fill="' + v.possColor + '" font-family="-apple-system,Helvetica,sans-serif">' + _escapeHtml(String(v.possAbbr || '').slice(0, 1)) + '</text>' +
    (v.logo ? '<image href="' + _escapeHtml(v.logo) + '" x="' + n1(ballX - pinR) + '" y="' + n1(cy - pinR) + '" width="' + n1(pinR * 2) + '" height="' + n1(pinR * 2) + '" clip-path="url(#' + pin + ')" preserveAspectRatio="xMidYMid meet"/>' : '');

  h += '<text x="13" y="' + n1(mid + 4) + '" text-anchor="middle" font-size="' + nameFont + '" font-weight="800" fill="#fff" font-family="-apple-system,Helvetica,sans-serif" transform="rotate(-90 13 ' + n1(mid) + ')">' + _escapeHtml(v.awayAbbr || '') + '</text>' +
    '<text x="307" y="' + n1(mid + 4) + '" text-anchor="middle" font-size="' + nameFont + '" font-weight="800" fill="#fff" font-family="-apple-system,Helvetica,sans-serif" transform="rotate(90 307 ' + n1(mid) + ')">' + _escapeHtml(v.homeAbbr || '') + '</text>' +
    '<g font-size="' + nameFont + '" fill="#7A73A8" text-anchor="middle" font-family="-apple-system,Helvetica,sans-serif">' +
    '<text x="79.4" y="' + (TOT - 4) + '">20</text><text x="159.8" y="' + (TOT - 4) + '">50</text><text x="240.2" y="' + (TOT - 4) + '">20</text></g>';
  return h + '</svg>';
}

function _glanceFootballDetailHtml(box) {
  var fs = box.situation;
  // A game stopped between periods has no situation at all, which used to
  // leave the card with nothing under the score. The boxscore payload
  // carries no leaders, so this shows the score and the break only.
  if (!fs || (fs.down == null && !fs.possessionText)) {
    var tiedNow = box.awayScore != null && box.awayScore === box.homeScore;
    var brkLabel = _isGameConcluded(box.status) ? null : _fbBreakLabelFrom(box.statusDetail || box.status, tiedNow);
    if (!brkLabel) return '';
    var awayA = _ghAbbrFallback(box.away || ''), homeA = _ghAbbrFallback(box.home || '');
    return '<div class="glance-detail" style="margin-top:10px;padding-top:10px;border-top:0.5px solid rgba(255,255,255,.09)">' +
      _fbFieldSvg({
        pct: null, breakLabel: brkLabel,
        score: { awayAbbr: awayA, away: box.awayScore, homeAbbr: homeA, home: box.homeScore },
        players: [], awayColor: null, homeColor: null, awayAbbr: awayA, homeAbbr: homeA,
        aria: brkLabel.toLowerCase()
      }, false) + '</div>';
  }
  var downText = fs.downText || _fbDownText(fs.down, fs.distance);
  var teamColor = (fs.team && fs.team.color) || '#A89FE8';
  var possAbbr = (fs.team && fs.team.abbreviation) || '';
  var awayAbbr = fs.awayAbbr || _ghAbbrFallback(box.away || '');
  var homeAbbr = fs.homeAbbr || _ghAbbrFallback(box.home || '');
  var field = fs.yardLine != null ? _fbFieldSvg(_fbViewFromBox(fs, awayAbbr, homeAbbr), false) : '';

  // Top line: the down, where the ball is, and who has it. When there's
  // no down — a kickoff, an extra point — the spot alone still reads fine.
  var left = downText || (fs.possessionText ? 'Ball on' : '');
  if (fs.possessionText) left += (left ? ' at ' : '') + fs.possessionText;
  var clock = '';
  if (fs.period) clock = 'Q' + fs.period + (fs.clock ? ' · ' + fs.clock : '');

  var h = '<div class="glance-detail" style="margin-top:10px;padding-top:10px;border-top:0.5px solid rgba(255,255,255,.09)">';
  h += '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:7px">' +
    (left ? '<span style="font-size:12px;font-weight:700;color:#fff;flex:1;min-width:0">' + _escapeHtml(left) + '</span>' : '<span style="flex:1"></span>') +
    (possAbbr ? '<span style="font-size:11px;font-weight:700;color:' + teamColor + ';flex-shrink:0">' + _escapeHtml(possAbbr) + ' ball</span>' : '') +
    '</div>';
  h += field;
  var foot = [];
  if (fs.redZone) foot.push('<span style="color:#FFC2BA;font-weight:700">Red zone</span>');
  if (fs.driveText) foot.push(_escapeHtml(fs.driveText));
  if (foot.length || clock) {
    h += '<div style="display:flex;align-items:baseline;gap:8px;margin-top:6px;font-size:11px;color:#B9B3E6">' +
      '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + foot.join(' · ') + '</span>' +
      (clock ? '<span style="flex-shrink:0;font-weight:700;color:#D9D4FA">' + _escapeHtml(clock) + '</span>' : '') +
      '</div>';
  }
  return h + '</div>';
}

function _glanceDetailHtml(box, sport) {
  if (!box || box.error) return '';
  if (sport === 'mlb') return _glanceBaseballDetailHtml(box);
  if (sport === 'nfl' || sport === 'cfb') return _glanceFootballDetailHtml(box);
  return '';
}

// Only live games are worth the extra fetch — scheduled and concluded rows
// stay on the plain card the list already rendered. `stillValidFn` is
// checked again once each fetch resolves, since by then the person may
// have paged to a different day/week or switched sport entirely.
function _upgradeLiveGlanceCards(games, sport, stillValidFn) {
  games.forEach(function (g) {
    if (_isGameConcluded(g.status) || !_isGameStatusLive(g.status) || !g.gamePk) return;
    var idx = window._gamesListCache.indexOf(g);
    if (idx < 0) return;
    fetch(_bsModalBoxscoreUrl(sport, g.gamePk)).then(function (r) { return r.json(); }).then(function (box) {
      if (!stillValidFn() || window._gamesListCache[idx] !== g) return; // superseded
      var detail = _glanceDetailHtml(box, sport);
      if (!detail) return;
      (window._glanceCache = window._glanceCache || {})[sport + ':' + g.gamePk] = detail;
      var cardEl = document.getElementById('glist-card-' + idx);
      if (!cardEl) return;
      var old = cardEl.querySelector('.glance-detail');
      if (old) old.outerHTML = detail; else cardEl.insertAdjacentHTML('beforeend', detail);
    }).catch(function (err) { console.error('Glance detail fetch error:', err); });
  });
}

// Short weekday abbreviation ("Thu", "Sun") for contexts where a card
// sits outside its normal day-grouped section — the football week
// view's own day headers make this redundant on every other card, but
// the "Your teams" spotlight above them pulls games from any day in
// the week with no shared header, so those need the day on the card
// itself or the time alone is ambiguous.
function _shortDowName(iso) { return _dowName(iso).slice(0, 3); }

function loadGamesList(date, opts) {
  opts = opts || {};
  if (typeof startWatchingList === 'function') startWatchingList(); // so games you're watching can sit up top
  clearTimeout(window._gamesListTimer);
  window._gamesDate = date || window._gamesDate || _todayLocal();
  var requestedDate = window._gamesDate;
  var requestedSport = window._gamesSport;
  _refreshPlayoffBtnVisibility();
  var listEl = document.getElementById('games-list');
  var labelEl = document.getElementById('games-date-label');
  var todayLinkEl = document.getElementById('games-today-link');
  var today = _todayLocal();
  if (labelEl) labelEl.textContent = requestedDate === today ? 'Today' : _formatMomentDate(requestedDate);
  if (todayLinkEl) { todayLinkEl.textContent = 'Jump to today'; todayLinkEl.style.display = requestedDate === today ? 'none' : 'block'; }
  if (!listEl) return;
  // Two possible prefetches: MLB's own (unchanged from v5.46.0) or, for any
  // other single-day sport (nba/wnba/nhl/mls/nwsl), the generic one
  // playSportFlourish stashed. Only one can ever match a given request.
  var prefetch = null;
  if (requestedSport === 'mlb' && window._mlbFlourishPrefetch && window._mlbFlourishPrefetch.date === requestedDate) {
    prefetch = window._mlbFlourishPrefetch.promise;
    window._mlbFlourishPrefetch = null;
  } else if (window._dayFlourishPrefetch && window._dayFlourishPrefetch.sport === requestedSport && window._dayFlourishPrefetch.date === requestedDate) {
    prefetch = window._dayFlourishPrefetch.promise;
    window._dayFlourishPrefetch = null;
  }
  if (!prefetch && !opts.silent) listEl.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,.4);padding:8px 2px">Loading games…</div>';
  (prefetch || Promise.all([
    fetch(_bsModalScheduleUrl(requestedSport, requestedDate)).then(function (r) { return r.json(); }),
    _loadFavTeams(requestedSport)
  ])).then(function (results) {
    var data = results[0], favTeams = results[1];
    if (window._gamesDate !== requestedDate || window._gamesSport !== requestedSport) return; // superseded
    var games = data.games || [];
    window._gamesListCache = games;
    if (!games.length) {
      var sportMeta = GAMES_SPORTS.filter(function (s) { return s.key === requestedSport; })[0];
      var emptyEmoji = (sportMeta && sportMeta.emoji) || '🏆';
      var emptyName = (sportMeta && sportMeta.name) || 'league';
      listEl.innerHTML = '<div style="text-align:center;padding:32px 16px"><div style="font-size:28px;margin-bottom:8px">' + emptyEmoji + '</div><div style="font-size:13px;color:rgba(255,255,255,.4)">No ' + _escapeHtml(emptyName) + ' games on this day</div></div>';
      return;
    }
    var split = _splitSpotlight(games, favTeams);
    // v5.85.0: games you're watching or attending sit right under your
    // teams' games, marked, in the same top section.
    var watchedIds = {};
    (window._watchingList || []).forEach(function (w) { if (w && (w.sport || 'mlb') === requestedSport) watchedIds[String(w.gamePk != null ? w.gamePk : w._id)] = w.mode || 'watch'; });
    var watchedGames = split.rest.filter(function (g) { return watchedIds[String(g.gamePk)]; });
    if (watchedGames.length) split = { spotlight: split.spotlight.concat(watchedGames), rest: split.rest.filter(function (g) { return !watchedIds[String(g.gamePk)]; }) };
    window._gamesWatchedIds = watchedIds;
    // Followed-team games stay in "Your teams" no matter their status;
    // whatever's left sinks its concluded games to their own section below,
    // the same treatment the NFL/CFB week view already gives finished games.
    var restSplit = _splitConcluded(split.rest);
    var html = '';
    if (requestedSport === 'mlb' && typeof _psBannerHtml === 'function') html += _psBannerHtml(games); // v6.8.0
    if (split.spotlight.length) {
      html += '<div style="font-size:11px;font-weight:800;color:#A89FE8;text-transform:uppercase;letter-spacing:.05em;padding:0 2px">' + (split.spotlight.length === watchedGames.length ? 'Your games' : 'Your teams') + '</div>';
      html += split.spotlight.map(function (g) { return _gamesListCardHtml(g, games.indexOf(g)); }).join('');
    }
    html += restSplit.upcoming.map(function (g) { return _gamesListCardHtml(g, games.indexOf(g)); }).join('');
    if (restSplit.concluded.length) {
      html += '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.05em;padding:16px 2px 8px">Concluded games</div>';
      html += restSplit.concluded.map(function (g) { return _gamesListCardHtml(g, games.indexOf(g)); }).join('');
    }
    listEl.innerHTML = html;
    _upgradeLiveGlanceCards(games, requestedSport, function () { return window._gamesSport === requestedSport && window._gamesDate === requestedDate; });
    // v5.85.0: keep today's list current on its own (scores, live detail)
    // every 20s while it's on screen and anything is live or still to come.
    var anyActive = games.some(function (g) { return !_isGameConcluded(g.status); });
    if (requestedDate === _todayLocal() && anyActive) {
      window._gamesListTimer = setTimeout(function () {
        var scr = document.getElementById('screen-games');
        if (scr && scr.classList.contains('active') && !document.hidden && window._gamesDate === requestedDate && window._gamesSport === requestedSport) loadGamesList(requestedDate, { silent: true });
      }, 20000);
    }
  }).catch(function (err) {
    if (window._gamesDate !== requestedDate || window._gamesSport !== requestedSport) return;
    console.error('Load games list error:', err);
    listEl.innerHTML = '<div style="text-align:center;padding:24px 16px;font-size:13px;color:rgba(255,255,255,.4)">Couldn\'t load games — try again.</div>';
  });

  function _gamesListCardHtml(g, i) {
    var favTeams = window._favTeamsCache[requestedSport] || { favorite: null, following: [] };
    var wMode = (window._gamesWatchedIds || {})[String(g.gamePk)], gDone = _isGameConcluded(g.status);
    var watchingNow = !!wMode && !gDone;
    var psR = requestedSport === 'mlb' && typeof _psRound === 'function' ? _psRound(g) : null; // v6.8.0
    return '<div id="glist-card-' + i + '" onclick="openGameFromList(' + i + ')" style="background:' + (watchingNow ? 'rgba(124,242,156,.06)' : psR ? 'linear-gradient(160deg,' + _ghHexAlpha(psR.rc2, .55) + ',rgba(255,255,255,.04) 60%)' : 'rgba(255,255,255,.055)') + ';border:' + (watchingNow ? '1.5px solid #7CF29C;box-shadow:0 0 0 3px rgba(124,242,156,.12)' : psR ? '1px solid ' + _ghHexAlpha(psR.rc, .45) : '1px solid rgba(255,255,255,.09)') + ';border-radius:16px;padding:13px 14px;display:flex;flex-direction:column;cursor:pointer">' +
      (psR ? _psListLineHtml(g) : '') +
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
      '<div><div style="font-size:14px;font-weight:700;color:#fff">' + _spotlightBadgeHtml(g, favTeams) + _escapeHtml(g.away || '?') + ' @ ' + _escapeHtml(g.home || '?') + '</div>' +
      (wMode ? '<div style="display:inline-flex;align-items:center;gap:5px;margin-top:5px;padding:2px 8px;border-radius:999px;background:' + (watchingNow ? 'rgba(124,242,156,.16)' : 'rgba(168,159,232,.18)') + ';color:' + (watchingNow ? '#9BE8AC' : '#D9D4FA') + ';font-size:10.5px;font-weight:800;letter-spacing:.04em">' + (wMode === 'attend' ? (gDone ? 'ATTENDED' : 'ATTENDING') : (gDone ? 'WATCHED' : 'WATCHING')) + '</div>' : '') +
      '<div style="font-size:11.5px;color:rgba(255,255,255,.42);margin-top:3px">' + _escapeHtml(g.venue || '') + '</div></div>' +
      _gameBadgeHtml(g) + '</div>' + (requestedSport === 'mlb' && typeof _spCardHtml === 'function' ? _spCardHtml(g) : '') + (!_isGameConcluded(g.status) && (window._glanceCache || {})[requestedSport + ':' + g.gamePk] ? window._glanceCache[requestedSport + ':' + g.gamePk] : '') + '</div>';
  }
}

// ── NFL WEEK BROWSER — NFL is the one sport here where "a week" is the
// natural browsing unit instead of a day (teams play roughly once a
// week), so NFL gets its own nav: ‹ Week N › instead of ‹ day/date ›,
// stepping 7 days at a time. Weeks run Tuesday–Monday. "Week 1" is
// anchored to whichever Tue–Mon window contains the day this was built —
// this is a self-contained relative counter, not the league's own
// internal week numbering, so it won't necessarily match ESPN's own
// "week" field if that's ever surfaced elsewhere.
function _isoDate(d) {
  var mm = String(d.getMonth() + 1); if (mm.length < 2) mm = '0' + mm;
  var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
  return d.getFullYear() + '-' + mm + '-' + dd;
}
// Two genuinely different concepts were previously conflated into one
// variable, which is exactly what broke the week numbering: which
// Tuesday starts the REAL season's Week 1 (a fixed calendar date that
// never changes once the season starts) vs. which Tuesday starts
// whatever week today happens to fall in (recomputed fresh every time,
// since "today" keeps moving). The old code used the dynamic value for
// both, so the label always read "Week 1" for the current week and
// drifted everywhere else as time passed, no matter what the real
// season week actually was.
//
// NFL_SEASON_WEEK1_TUESDAY is the real anchor: the 2026 season opened
// Wednesday, September 9 (Patriots @ Seahawks), so the Tuesday
// immediately before that — 2026-09-08 — is Week 1's start under this
// app's Tuesday–Monday week convention. This is a hardcoded real date
// and MUST be updated by hand for next season's actual Week 1.
var NFL_SEASON_WEEK1_TUESDAY = '2026-09-08';

// CFB's real Week 1 starts Thursday, September 3 (Week 0 — a smaller
// slate a few days earlier — falls in the preceding Tue–Mon window and
// numbers itself "Week 0" automatically via the same arithmetic below).
// The Tuesday immediately before that Thursday is 2026-09-01. Also a
// hardcoded real date that MUST be updated by hand each season.
var CFB_SEASON_WEEK1_TUESDAY = '2026-09-01';

function _footballSeasonAnchor(sport) { return sport === 'cfb' ? CFB_SEASON_WEEK1_TUESDAY : NFL_SEASON_WEEK1_TUESDAY; }

// The dynamic one: whichever Tuesday starts the week "today" falls in,
// computed once when the page loads. Same for both sports — it's just
// "what week is it right now," not tied to either season's anchor. Only
// ever used to pick a sensible default week and as the "Jump to current
// week" target — never for the week-number math.
var FOOTBALL_CURRENT_WEEK_TUESDAY = (function () {
  var today = new Date(_todayLocal() + 'T12:00:00');
  var daysSinceTuesday = (today.getDay() - 2 + 7) % 7; // getDay(): 0=Sun..6=Sat, Tuesday=2
  today.setDate(today.getDate() - daysSinceTuesday);
  return _isoDate(today);
})();
function _footballWeekNumber(sport, tuesdayIso) {
  var a = new Date(_footballSeasonAnchor(sport) + 'T12:00:00');
  var b = new Date(tuesdayIso + 'T12:00:00');
  return 1 + Math.round((b - a) / (7 * 86400000));
}
function _footballWeekDates(tuesdayIso) {
  var dates = [];
  var d = new Date(tuesdayIso + 'T12:00:00');
  for (var i = 0; i < 7; i++) { dates.push(_isoDate(d)); d.setDate(d.getDate() + 1); }
  return dates;
}
var NFL_DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function _dowName(iso) {
  return NFL_DOW_NAMES[new Date(iso + 'T12:00:00').getDay()];
}
function _isGameConcluded(status) {
  if (!status) return false;
  var s = String(status).toLowerCase();
  // 'game over' is MLB's detailedState between the last out and the game
  // going official ("Final") — it can sit there a while, so it counts too.
  return s.indexOf('final') !== -1 || s.indexOf('game over') !== -1 || s.indexOf('completed early') !== -1 ||
    s.indexOf('postponed') !== -1 || s.indexOf('cancel') !== -1;
}

// Per-sport week state, so switching between NFL and CFB (and back)
// doesn't lose whichever week you'd browsed to in the other one.
window._footballWeekTuesday = { nfl: null, cfb: null };
function loadFootballWeek(sport, tuesdayIso) {
  window._footballWeekTuesday[sport] = tuesdayIso || window._footballWeekTuesday[sport] || FOOTBALL_CURRENT_WEEK_TUESDAY;
  var requestedWeek = window._footballWeekTuesday[sport];
  var requestedSport = window._gamesSport;
  _refreshPlayoffBtnVisibility();
  var listEl = document.getElementById('games-list');
  var labelEl = document.getElementById('games-date-label');
  var jumpEl = document.getElementById('games-today-link');
  if (labelEl) labelEl.textContent = 'Week ' + _footballWeekNumber(sport, requestedWeek);
  if (jumpEl) {
    jumpEl.textContent = 'Jump to current week';
    jumpEl.style.display = (requestedWeek === FOOTBALL_CURRENT_WEEK_TUESDAY) ? 'none' : 'block';
  }
  if (!listEl) return;
  var dates = _footballWeekDates(requestedWeek);
  var prefetch = (window._footballFlourishPrefetch && window._footballFlourishPrefetch.sport === sport && window._footballFlourishPrefetch.week === requestedWeek)
    ? window._footballFlourishPrefetch.promise : null;
  window._footballFlourishPrefetch = null;
  if (!prefetch) listEl.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,.4);padding:8px 2px">Loading games…</div>';
  (prefetch || Promise.all([
    Promise.all(dates.map(function (iso) {
      return fetch(_bsModalScheduleUrl(sport, iso))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var games = data.games || [];
          games.forEach(function (g) { g._dateIso = iso; });
          return games;
        })
        .catch(function () { return []; });
    })),
    _loadFavTeams(sport)
  ])).then(function (outer) {
    var results = outer[0], favTeams = outer[1];
    if (window._gamesSport !== requestedSport || window._footballWeekTuesday[sport] !== requestedWeek) return; // superseded
    var allGames = [].concat.apply([], results);
    window._gamesListCache = allGames;
    if (!allGames.length) {
      var emoji = sport === 'cfb' ? '🏈' : '🏈';
      var label = sport === 'cfb' ? 'No college football games this week' : 'No NFL games this week';
      listEl.innerHTML = '<div style="text-align:center;padding:32px 16px"><div style="font-size:28px;margin-bottom:8px">' + emoji + '</div><div style="font-size:13px;color:rgba(255,255,255,.4)">' + label + '</div></div>';
      return;
    }
    var split = _splitSpotlight(allGames, favTeams);
    var html = '';
    if (split.spotlight.length) {
      html += '<div style="font-size:11px;font-weight:800;color:#A89FE8;text-transform:uppercase;letter-spacing:.05em;padding:0 2px 8px">Your teams</div>';
      html += split.spotlight.map(function (g) { return _footballGameCardHtml(g, favTeams, true, true); }).join('');
      html += '<div style="height:6px"></div>';
    }
    html += _renderFootballWeekHtml(split.rest, favTeams);
    listEl.innerHTML = html;
    _upgradeLiveGlanceCards(allGames, sport, function () { return window._gamesSport === requestedSport && window._footballWeekTuesday[sport] === requestedWeek; });
  });
}

// Not-yet-concluded games (scheduled or in progress) sort to the top,
// grouped by the day they fall on, in chronological order; concluded
// games move to their own section at the bottom, grouped the same way.
// `games` here has already had any favorite/followed games pulled out
// by _splitSpotlight, so this only ever renders the remainder.
function _renderFootballWeekHtml(games, favTeams) {
  var sortByDate = function (arr) {
    return arr.slice().sort(function (a, b) { return a._dateIso < b._dateIso ? -1 : a._dateIso > b._dateIso ? 1 : 0; });
  };
  var upcoming = sortByDate(games.filter(function (g) { return !_isGameConcluded(g.status); }));
  var concluded = sortByDate(games.filter(function (g) { return _isGameConcluded(g.status); }));

  var html = _footballDayGroupedHtml(upcoming, favTeams);
  if (concluded.length) {
    html += '<div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.05em;padding:16px 2px 8px">Concluded games</div>';
    html += _footballDayGroupedHtml(concluded, favTeams);
  }
  return html;
}

function _footballGameCardHtml(g, favTeams, withMargin, showDay) {
  var idx = window._gamesListCache.indexOf(g);
  var badge = favTeams ? _spotlightBadgeHtml(g, favTeams) : '';
  var dayPrefix = (showDay && g._dateIso) ? _shortDowName(g._dateIso) : null;
  return '<div id="glist-card-' + idx + '" onclick="openGameFromList(' + idx + ')" style="background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:13px 14px;display:flex;flex-direction:column;cursor:pointer' + (withMargin ? ';margin-bottom:8px' : '') + '">' +
    '<div style="display:flex;align-items:center;justify-content:space-between">' +
    '<div><div style="font-size:14px;font-weight:700;color:#fff">' + badge + _escapeHtml(g.away || '?') + ' @ ' + _escapeHtml(g.home || '?') + '</div>' +
    '<div style="font-size:11.5px;color:rgba(255,255,255,.42);margin-top:3px">' + _escapeHtml(g.venue || '') + '</div></div>' +
    _gameBadgeHtml(g, dayPrefix) + '</div></div>';
}

function _footballDayGroupedHtml(games, favTeams) {
  var html = '';
  var lastDate = null;
  games.forEach(function (g) {
    if (g._dateIso !== lastDate) {
      lastDate = g._dateIso;
      html += '<div style="font-size:12px;font-weight:700;color:#A89FE8;padding:' + (html ? '10px' : '0') + ' 2px 6px">' + _dowName(g._dateIso) + '</div>';
    }
    html += _footballGameCardHtml(g, favTeams, true);
  });
  return html;
}

// Date-nav arrows and the "jump back" link both need to know whether
// they're stepping a day (MLB) or a week (NFL, CFB) — same with the
// label tap, which opens the day calendar for MLB only, since a
// day-picker doesn't map onto week-based browsing.
function gamesNav(delta) {
  if (window._gamesSport === 'nfl' || window._gamesSport === 'cfb') {
    var sport = window._gamesSport;
    var wd = new Date(window._footballWeekTuesday[sport] + 'T12:00:00');
    wd.setDate(wd.getDate() + delta * 7);
    loadFootballWeek(sport, _isoDate(wd));
    return;
  }
  var d = new Date(window._gamesDate + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  var mm = String(d.getMonth() + 1); if (mm.length < 2) mm = '0' + mm;
  var dd = String(d.getDate()); if (dd.length < 2) dd = '0' + dd;
  loadGamesList(d.getFullYear() + '-' + mm + '-' + dd);
}

function gamesToday() {
  if (window._gamesSport === 'nfl' || window._gamesSport === 'cfb') { loadFootballWeek(window._gamesSport, FOOTBALL_CURRENT_WEEK_TUESDAY); return; }
  loadGamesList(_todayLocal());
}

function _gamesLabelTap() {
  if (window._gamesSport === 'nfl' || window._gamesSport === 'cfb') return;
  openCalendar();
}

function openGameFromList(i) {
  var g = (window._gamesListCache || [])[i];
  if (!g) return;
  // NFL/CFB's week view tags each game with its own date (_dateIso,
  // since a week spans several days); MLB's flat day list uses whichever
  // single date is currently being browsed.
  var date = g._dateIso || window._gamesDate || null;
  openGameScreen(g.gamePk, g.away, g.home, window._gamesSport, date);
}

// ── GAMES SPORT PICKER — lets you choose a league instead of always
// defaulting into MLB. MLB and now NFL/college football have real
// schedule data; the rest still route to the "still on the bench"
// placeholder, with a themed banner where one's been designed and a
// plain state otherwise.
var GAMES_SPORTS = [
  { key:'mlb', name:'MLB', emoji:'⚾', live:true },
  { key:'nfl', name:'NFL', emoji:'🏈', live:true, banner:'fb' },
  { key:'cfb', name:'College football', emoji:'🏈', live:true, banner:'fb' },
  { key:'nba', name:'NBA', emoji:'🏀', live:true, banner:'bk' },
  { key:'wnba', name:'WNBA', emoji:'🏀', live:true, banner:'bk' },
  { key:'nhl', name:'NHL', emoji:'🏒', live:true, banner:'hk' },
  { key:'mls', name:'MLS', emoji:'⚽', live:true, banner:'sc' },
  { key:'nwsl', name:'NWSL', emoji:'⚽', live:true, banner:'sc' }
];

function renderGamesSportGrid() {
  var grid = document.getElementById('games-sport-grid');
  if (!grid) return;
  grid.innerHTML = GAMES_SPORTS.map(function (s) {
    return '<div onclick="pickGamesSport(\'' + s.key + '\')" style="background:' +
      (s.live ? 'rgba(168,159,232,.13);border-color:rgba(168,159,232,.35)' : 'rgba(255,255,255,.045);border-color:rgba(255,255,255,.09)') +
      ';border-width:1px;border-style:solid;border-radius:18px;padding:16px 14px;cursor:pointer;display:flex;flex-direction:column;gap:8px">' +
      '<div style="font-size:30px">' + s.emoji + '</div>' +
      '<div style="font-size:14.5px;font-weight:700;color:#fff">' + _escapeHtml(s.name) + '</div>' +
      '<div style="font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:20px;align-self:flex-start;' +
      (s.live ? 'background:rgba(124,242,156,.18);color:#9be8ac' : 'background:rgba(255,255,255,.08);color:rgba(255,255,255,.42)') +
      '">' + (s.live ? 'Live' : 'Coming soon') + '</div>' +
    '</div>';
  }).join('');
}

function pickGamesSport(key) {
  var s = GAMES_SPORTS.filter(function (x) { return x.key === key; })[0];
  if (!s) return;
  if (!s.live) { window._gamesSoonSport = s; nav('games-soon'); return; }
  window._gamesSport = key;
  _refreshPlayoffBtnVisibility();
  if (key === 'nfl' || key === 'cfb') { window._footballWeekTuesday[key] = null; } // reset to current week
  else { window._gamesDate = null; } // reset so the new sport defaults to today, not carrying over the last sport's date
  if (key === 'mlb') { playMlbFlourish(); return; }
  playSportFlourish(key);
}

// The ball flight + "Touchdown!" caption are single-play (animation-
// fill-mode:forwards), so once they've finished, just toggling the
// banner back to display:block would show them already frozen in their
// end state instead of replaying — this forces a fresh run each time
// NFL/CFB is picked. Clearing then re-reading offsetWidth forces the
// browser to recompute layout in between, which is what actually
// restarts a CSS animation rather than a no-op reassignment. It also
// collapses the whole banner out of the schedule screen a beat after
// "Touchdown!" lands, instead of leaving the frozen scene sitting at
// the top of the page permanently.
window._gamesFbBannerTimer = null;

// ── MLB FULL-SCREEN FLOURISH ("Lights on", v5.44.0) — plays once over the
// sport picker, then hands off to nav('games'). The 390×844 stage is scaled
// to cover whatever the overlay measures, so the SVG scene and the
// offset-path ball stay in the same coordinate space. Dismisses at 7s — the
// caption has been fully in for ~1s by then. Reduced motion shows the lit
// end state briefly instead. Tap anywhere to skip straight to the schedule.
window._mlbFlourishTimer = null;
// Warmed while the flourish plays so the schedule underneath is already
// populated the instant the lights come up — otherwise loadGamesList's own
// fetch only starts once nav('games') actually runs, and the first thing
// anyone sees after the animation is a bare "Loading games…" line. One-shot:
// loadGamesList consumes and clears it, so it's never reused for a later
// date change.
window._mlbFlourishPrefetch = null;
// Shared cover-vs-contain scale for the phone-shaped 390×844 flourish
// stage (used by playMlbFlourish, playSportFlourish, and playSportsHub).
// "Cover" (scale by whichever axis needs more) is the right call when the
// container is itself portrait-ish, like every phone — the sliver it
// crops off one edge is unnoticeable. On a landscape container (the iPad
// sidebar layout's full-bleed .app, w > h) that same cover math forces a
// scale big enough to cover the width alone, and because the design is
// roughly twice as tall as it is wide, that blows the height way past
// the container and crops most of the scene — the light rig and title
// stay put but the ball's flight and the wall it clears end up above or
// below the visible area. Switch to "contain" whenever the container
// itself is landscape, so the whole scene stays visible and correctly
// proportioned (small letterboxing left/right) instead of chopped off.
function _mlbfScale(w, h) {
  return w > h ? Math.min(w / 390, h / 844) : Math.max(w / 390, h / 844);
}
function playMlbFlourish() {
  var overlay = document.getElementById('mlb-flourish');
  if (!overlay) { nav('games'); return; }
  clearTimeout(window._mlbFlourishTimer);
  overlay.style.display = 'block';
  var stage = overlay.querySelector('.mlbf-stage');
  if (stage) {
    var w = overlay.clientWidth || 390, h = overlay.clientHeight || 844;
    stage.style.setProperty('--mlbf-s', _mlbfScale(w, h).toFixed(4));
  }
  requestAnimationFrame(function () { overlay.style.opacity = '1'; });
  var prefetchDate = window._gamesDate || _todayLocal();
  window._mlbFlourishPrefetch = {
    date: prefetchDate,
    promise: Promise.all([
      fetch(_bsModalScheduleUrl('mlb', prefetchDate)).then(function (r) { return r.json(); }),
      _loadFavTeams('mlb')
    ])
  };
  window._mlbFlourishTimer = setTimeout(finishMlbFlourish, _ghReducedMotion() ? 2200 : 7000);
}
function finishMlbFlourish() {
  var overlay = document.getElementById('mlb-flourish');
  if (!overlay) { nav('games'); return; }
  // nav('games') fires right away so the schedule screen's own 0.22s fade-in
  // (screen.active's CSS transition) runs underneath the flourish's 0.3s
  // fade-out at the same time, instead of only starting once the flourish
  // had already fully disappeared — which used to leave the previous
  // sport-picker screen visible for a beat in between the two.
  nav('games');
  overlay.style.opacity = '0';
  setTimeout(function () {
    overlay.style.display = 'none';
  }, 300);
}
function skipMlbFlourish() {
  clearTimeout(window._mlbFlourishTimer);
  finishMlbFlourish();
}

// ── ALL-SPORTS FLOURISH (v5.47.0) — the same "lights on" vibe for NFL, CFB,
// NBA, WNBA, NHL, MLS and NWSL, each its own overlay (#<key>-flourish) built
// from the shared .mlbf-* rig (see the CSS comment near those keyframes).
// Deliberately a parallel system rather than folding MLB into it — MLB's
// own playMlbFlourish/finishMlbFlourish above are untouched and still own
// #mlb-flourish exactly as before.
//
// Prefetching splits in two, matching the two ways the schedule screen
// itself browses: NFL/CFB browse by week (loadFootballWeek), so their
// prefetch fetches the whole week and is stashed on
// window._footballFlourishPrefetch; every other sport browses by single day
// (loadGamesList, the same path MLB uses) and is stashed on
// window._dayFlourishPrefetch, tagged with which sport it's for since it's
// no longer MLB-only. Both are one-shot — consumed and cleared by whichever
// loader picks them up.
window._sportFlourishTimer = null;
window._sportFlourishActiveKey = null;
window._dayFlourishPrefetch = null; // {sport, date, promise}
window._footballFlourishPrefetch = null; // {sport, week, promise}
function playSportFlourish(key) {
  var overlay = document.getElementById(key + '-flourish');
  if (!overlay) { nav('games'); return; }
  window._sportFlourishActiveKey = key;
  clearTimeout(window._sportFlourishTimer);
  overlay.style.display = 'block';
  var stage = overlay.querySelector('.mlbf-stage');
  if (stage) {
    var w = overlay.clientWidth || 390, h = overlay.clientHeight || 844;
    stage.style.setProperty('--mlbf-s', _mlbfScale(w, h).toFixed(4));
  }
  requestAnimationFrame(function () { overlay.style.opacity = '1'; });
  if (key === 'nfl' || key === 'cfb') {
    window._footballWeekTuesday[key] = window._footballWeekTuesday[key] || FOOTBALL_CURRENT_WEEK_TUESDAY;
    var week = window._footballWeekTuesday[key];
    window._footballFlourishPrefetch = {
      sport: key, week: week,
      promise: Promise.all([
        Promise.all(_footballWeekDates(week).map(function (iso) {
          return fetch(_bsModalScheduleUrl(key, iso)).then(function (r) { return r.json(); }).then(function (data) {
            var games = data.games || [];
            games.forEach(function (g) { g._dateIso = iso; });
            return games;
          }).catch(function () { return []; });
        })),
        _loadFavTeams(key)
      ])
    };
  } else {
    var d = window._gamesDate || _todayLocal();
    window._dayFlourishPrefetch = {
      sport: key, date: d,
      promise: Promise.all([
        fetch(_bsModalScheduleUrl(key, d)).then(function (r) { return r.json(); }),
        _loadFavTeams(key)
      ])
    };
  }
  window._sportFlourishTimer = setTimeout(finishSportFlourish, _ghReducedMotion() ? 2200 : 7000);
}
function finishSportFlourish() {
  var key = window._sportFlourishActiveKey;
  var overlay = key && document.getElementById(key + '-flourish');
  if (!overlay) { nav('games'); return; }
  // Same overlap fix as finishMlbFlourish: nav('games') fires as the
  // flourish starts fading, not after, so the schedule crossfades in
  // underneath instead of the sport-picker screen flashing in between.
  nav('games');
  overlay.style.opacity = '0';
  setTimeout(function () {
    overlay.style.display = 'none';
  }, 300);
}
function skipSportFlourish() {
  clearTimeout(window._sportFlourishTimer);
  finishSportFlourish();
}

// ── SPORTS HUB SCREEN (v5.48.0) — the "lights on" moment that plays once
// when Games is opened from the feed banner, before the sport picker grid
// itself: same rig as every other flourish, with one outline ball per
// sport falling in from the upper-left and settling into a ring around
// "SPORTS" that keeps slowly circling until the screen dismisses. Built
// entirely with native SVG animateMotion (no JS-driven transforms), so
// there's nothing here to keep in sync — the browser just plays the path.
window._sportsHubTimer = null;
function playSportsHub() {
  var overlay = document.getElementById('sports-hub-flourish');
  if (!overlay) { nav('games-picker'); return; }
  clearTimeout(window._sportsHubTimer);
  overlay.style.display = 'block';
  var stage = overlay.querySelector('.mlbf-stage');
  if (stage) {
    var w = overlay.clientWidth || 390, h = overlay.clientHeight || 844;
    stage.style.setProperty('--mlbf-s', _mlbfScale(w, h).toFixed(4));
  }
  requestAnimationFrame(function () { overlay.style.opacity = '1'; });
  window._sportsHubTimer = setTimeout(finishSportsHub, _ghReducedMotion() ? 1500 : 6500);
}
function finishSportsHub() {
  var overlay = document.getElementById('sports-hub-flourish');
  if (!overlay) { nav('games-picker'); return; }
  nav('games-picker');
  overlay.style.opacity = '0';
  setTimeout(function () {
    overlay.style.display = 'none';
  }, 300);
}
function skipSportsHub() {
  clearTimeout(window._sportsHubTimer);
  finishSportsHub();
}
// Same little icon-pop as bannerNavWithPop, just handing off to the hub
// flourish instead of navigating straight to the picker.
function openGamesFromBanner(bannerEl) {
  var icon = bannerEl.querySelector('.banner-pop-icon');
  var glow = bannerEl.querySelector('.banner-pop-glow');
  if (!icon) { playSportsHub(); return; }
  bannerEl.classList.add('popping');
  icon.classList.add('popping');
  if (glow) glow.classList.add('popping');
  setTimeout(function () {
    playSportsHub();
    setTimeout(function () {
      bannerEl.classList.remove('popping');
      icon.classList.remove('popping');
      if (glow) glow.classList.remove('popping');
    }, 300);
  }, 260);
}

function renderGamesSoon() {
  var s = window._gamesSoonSport;
  if (!s) return;
  var emojiEl = document.getElementById('games-soon-emoji');
  var titleEl = document.getElementById('games-soon-title');
  if (emojiEl) emojiEl.textContent = s.emoji;
  if (titleEl) titleEl.textContent = s.name + ' is still on the bench';
  ['bk', 'hk', 'sc'].forEach(function (key) {
    var el = document.getElementById('games-soon-' + key + '-banner');
    if (el) el.style.display = (s.banner === key) ? 'block' : 'none';
  });
}

// ── GAMES — CALENDAR DATE PICKER — a bottom sheet for jumping across
// months/years, opened by tapping the date label on the schedule screen.
// The single-day ‹ › step buttons (gamesNav) are untouched by this.
var GAMES_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
window._gamesCalYear = null;
window._gamesCalMonth = null;
function openCalendar() {
  var d = new Date((window._gamesDate || _todayLocal()) + 'T12:00:00');
  window._gamesCalYear = d.getFullYear();
  window._gamesCalMonth = d.getMonth();
  renderGamesCalendar();
  document.getElementById('games-cal-backdrop').style.opacity = '1';
  document.getElementById('games-cal-backdrop').style.pointerEvents = 'auto';
  document.getElementById('games-cal-sheet').style.transform = 'translateY(0)';
}
function closeCalendar() {
  document.getElementById('games-cal-backdrop').style.opacity = '0';
  document.getElementById('games-cal-backdrop').style.pointerEvents = 'none';
  document.getElementById('games-cal-sheet').style.transform = 'translateY(100%)';
}
function calMonthNav(delta) {
  window._gamesCalMonth += delta;
  if (window._gamesCalMonth < 0) { window._gamesCalMonth = 11; window._gamesCalYear--; }
  if (window._gamesCalMonth > 11) { window._gamesCalMonth = 0; window._gamesCalYear++; }
  renderGamesCalendar();
}
function renderGamesCalendar() {
  var y = window._gamesCalYear, m = window._gamesCalMonth;
  var labelEl = document.getElementById('games-cal-month-label');
  if (labelEl) labelEl.textContent = GAMES_MONTH_NAMES[m] + ' ' + y;
  var first = new Date(y, m, 1);
  var startDow = first.getDay();
  var daysInMonth = new Date(y, m + 1, 0).getDate();
  var today = _todayLocal();
  var selected = window._gamesDate || today;
  var cells = [];
  for (var i = 0; i < startDow; i++) cells.push(null);
  for (var day = 1; day <= daysInMonth; day++) cells.push(day);
  var grid = document.getElementById('games-cal-grid');
  if (!grid) return;
  grid.innerHTML = cells.map(function (day) {
    if (!day) return '<div style="aspect-ratio:1"></div>';
    var mm = String(m + 1); if (mm.length < 2) mm = '0' + mm;
    var dd = String(day); if (dd.length < 2) dd = '0' + dd;
    var iso = y + '-' + mm + '-' + dd;
    var style = 'aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:13px;border-radius:10px;cursor:pointer;';
    if (iso === selected) style += 'background:var(--indigo);color:#fff;font-weight:800';
    else if (iso === today) style += 'color:#A89FE8;font-weight:800';
    else style += 'color:rgba(255,255,255,0.75)';
    return '<div style="' + style + '" onclick="pickCalendarDate(\'' + iso + '\')">' + day + '</div>';
  }).join('');
}
function pickCalendarDate(iso) {
  loadGamesList(iso);
  closeCalendar();
}

// ── GAME DETAIL — cheat sheet + open chat for one specific game.
window._activeBrowseGame = null;
