// ══════════════════════════════════════════════════════════════════════
var GX_SPORT = { nfl: 'football', cfb: 'football', nba: 'basketball', wnba: 'basketball', nhl: 'hockey', mls: 'soccer', nwsl: 'soccer' };
window._gxBox = { side: 'away', open: true };
window._gxFeedAll = false;

// NHL colors by abbreviation (NHL's API doesn't send team colors): [bg, fg, accent]
var GX_NHL_COLORS = {
  ANA: ['#F47A38', '#000000', '#F47A38'], BOS: ['#FFB81C', '#000000', '#FFB81C'], BUF: ['#003087', '#FFB81C', '#5B8BE8'],
  CGY: ['#C8102E', '#F1BE48', '#F0566A'], CAR: ['#CC0000', '#FFFFFF', '#F05A5A'], CHI: ['#CF0A2C', '#FFFFFF', '#F0566A'],
  COL: ['#6F263D', '#FFFFFF', '#C5708C'], CBJ: ['#002654', '#FFFFFF', '#6E9BE8'], DAL: ['#006847', '#FFFFFF', '#3FBF8C'],
  DET: ['#CE1126', '#FFFFFF', '#F0566A'], EDM: ['#041E42', '#FF4C00', '#FF6A2B'], FLA: ['#041E42', '#C8102E', '#F0566A'],
  LAK: ['#111111', '#A2AAAD', '#B8BFC2'], MIN: ['#154734', '#FFFFFF', '#4FBF86'], MTL: ['#AF1E2D', '#FFFFFF', '#E8566A'],
  NSH: ['#FFB81C', '#041E42', '#FFB81C'], NJD: ['#CE1126', '#000000', '#F0566A'], NYI: ['#00539B', '#F47D30', '#F47D30'],
  NYR: ['#0038A8', '#FFFFFF', '#5B8BE8'], OTT: ['#C52032', '#FFFFFF', '#F0566A'], PHI: ['#F74902', '#000000', '#F97A40'],
  PIT: ['#000000', '#FCB514', '#FCB514'], SJS: ['#006D75', '#FFFFFF', '#3FB8C0'], SEA: ['#001628', '#99D9D9', '#99D9D9'],
  STL: ['#002F87', '#FCB514', '#FCB514'], TBL: ['#002868', '#FFFFFF', '#5B8BE8'], TOR: ['#00205B', '#FFFFFF', '#5B8FE0'],
  UTA: ['#010101', '#6CACE4', '#6CACE4'], VAN: ['#00205B', '#FFFFFF', '#3FAF6E'], VGK: ['#333F42', '#B4975A', '#C9AE78'],
  WSH: ['#041E42', '#FFFFFF', '#F0566A'], WPG: ['#041E42', '#FFFFFF', '#6E9BE8']
};
function _gxLum(hex) {
  var h = String(hex || '').replace('#', '');
  if (h.length !== 6) return 0.2;
  var c = [0, 2, 4].map(function (i) { var v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function _gxMix(hex, t) {
  var h = String(hex || '').replace('#', '');
  if (h.length !== 6) return '#A89FE8';
  var out = [0, 2, 4].map(function (i) { var v = parseInt(h.slice(i, i + 2), 16); return Math.round(v + (255 - v) * t).toString(16).padStart(2, '0'); });
  return '#' + out.join('');
}
// {bg, fg, accent} — accent is the version that reads on the dark card
function _gxColors(league, abbr, color, alt) {
  var norm = function (c) { var h = String(c || '').replace('#', ''); return /^[0-9a-fA-F]{6}$/.test(h) ? '#' + h : null; };
  color = norm(color); alt = norm(alt);
  if (league === 'nhl') {
    var n = GX_NHL_COLORS[String(abbr || '').toUpperCase()];
    if (n) return { bg: n[0], fg: n[1], accent: n[2] };
  }
  if (!color) return { bg: '#3D3580', fg: '#FFFFFF', accent: '#A89FE8' };
  var lum = _gxLum(color);
  var fg = lum > 0.45 ? '#1A1640' : '#FFFFFF';
  var accent = color;
  if (lum < 0.1) {
    var aLum = alt ? _gxLum(alt) : 0;
    accent = (alt && aLum > 0.12 && aLum < 0.9) ? alt : _gxMix(color, 0.45);
  }
  return { bg: color, fg: fg, accent: accent };
}

function _gxModel(raw) {
  var m = raw;
  var mk = function (s) {
    var abbr = s.abbr || _ghAbbrFallback(s.name);
    return Object.assign({}, s, { abbr: abbr, short: s.short || _teamShortName(s.name || ''), colors: _gxColors(raw.league, abbr, s.color, s.alt) });
  };
  m.away = mk(raw.away);
  m.home = mk(raw.home);
  // Both accents too alike (e.g. two red teams) → lighten the away team's primary instead
  var rgb = function (hx) { var h = String(hx).replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16) || 0; }); };
  var dst = function (x, y) { return Math.sqrt(Math.pow(x[0] - y[0], 2) + Math.pow(x[1] - y[1], 2) + Math.pow(x[2] - y[2], 2)); };
  var ch = rgb(m.home.colors.accent);
  var dist = dst(rgb(m.away.colors.accent), ch);
  if (dist < 90 && raw.league !== 'nhl') {
    var alt = _gxMix(m.away.colors.bg, _gxLum(m.away.colors.bg) < 0.1 ? 0.5 : 0.25);
    if (dst(rgb(alt), ch) > dist) m.away.colors.accent = alt;
  }
  return m;
}

function _gxChip(p, m) {
  if (p.as == null || p.hs == null) return '';
  if (p.as === p.hs) return 'Tied ' + p.as + '–' + p.hs;
  return p.as > p.hs ? m.away.abbr + ' ' + p.as + '–' + p.hs : m.home.abbr + ' ' + p.hs + '–' + p.as;
}
function _gxTag(p, m) {
  var t = p.side === 'h' ? m.home : m.away;
  return '<span class="gh-tag" style="background:' + _ghHexAlpha(t.colors.accent, .2) + ';color:' + t.colors.accent + '">' + _escapeHtml(p.tag || '') + '</span>';
}
function _gxPlayerLink(name, id, league, extraStyle) {
  if (!name) return '';
  return '<span data-name="' + _escapeHtml(name) + '" data-id="' + _escapeHtml(String(id || '')) + '" data-league="' + league + '" onclick="event.stopPropagation();openPlayerLinkSheet(this.dataset.name,this.dataset.id||null,this.dataset.league)" style="cursor:pointer;text-decoration:underline;text-decoration-color:rgba(255,255,255,.28);text-underline-offset:3px;' + (extraStyle || '') + '">' + _escapeHtml(name) + '</span>';
}
function _gxOrdinal(n) { return _ordinalSuffix(n); }

// ── Highlights list (newest first) ─────────────────────────────────────
function _gxHighlightsListHtml(m, st, opts) {
  opts = opts || {};
  var plays = m.highlights.slice().reverse();
  if (!plays.length) return '';
  var shown = opts.cap ? plays.slice(0, opts.cap) : plays;
  var noun = m.sport === 'basketball' ? 'big moments' : (m.sport === 'football' ? 'scores' : 'goals');
  var h = '<div class="gh-hl" style="max-height:' + (60 + shown.length * 90) + 'px"><div class="gh-hlrow gh-hlhead gh-r0"><span class="gh-eyebrow">' + _escapeHtml(opts.title) + '</span>' +
    '<span style="font-size:11.5px;color:#9C95D0">' + plays.length + ' ' + (plays.length === 1 ? noun.replace(/s$/, '') : noun) + '</span></div>';
  shown.forEach(function (p, i) {
    var key = [p.tag, p.time, p.head, p.as, p.hs].join('|');
    var t = opts.withNew ? st.newAt[key] : null;
    var isNew = !!t && Date.now() - t < 120000;
    var isTop = i === 0, last = i === shown.length - 1;
    var chip = _gxChip(p, m);
    var sub = [p.time, p.sub].filter(Boolean).join(' · ');
    h += '<div class="gh-hlrow gh-r' + Math.min(i + 1, 9) + (isTop ? ' gh-first' : '') + '">' +
      '<div style="width:34px;display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0">' + _gxTag(p, m) +
        (!isTop && !last ? '<span style="flex:1;width:2px;background:rgba(168,159,232,.18);border-radius:1px"></span>' : '') + '</div>' +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding-bottom:6px">' +
        '<div class="gh-row" style="gap:8px;align-items:flex-start"><span style="font-size:13.5px;font-weight:700;min-width:0">' + _escapeHtml(p.head || '') + '</span>' +
          (isNew ? '<span class="gh-new">NEW</span>' : '<span class="gh-num" style="font-size:14.5px;white-space:nowrap;color:' + (isTop ? '#fff' : '#D9D4FA') + '">' + _escapeHtml(chip) + '</span>') + '</div>' +
        (isNew && chip ? '<span class="gh-num" style="font-size:14.5px;color:#fff">' + _escapeHtml(chip) + '</span>' : '') +
        (sub ? '<span class="gh-sub gh-clamp" style="line-height:1.4">' + _escapeHtml(sub) + '</span>' : '') +
      '</div></div>';
  });
  if (plays.length > shown.length) h += '<div class="gh-hlrow gh-r9 gh-sub" style="padding-left:58px">+' + (plays.length - shown.length) + ' earlier</div>';
  return h + '</div>';
}

// ── Comparison rows with names (season / game leaders) ─────────────────
function _gxLeaderCompareHtml(m, leaders, baseDelay) {
  return leaders.map(function (l, i) {
    var a = l.a || {}, b = l.h || {};
    var av = a.value, bv = b.value;
    var bar = '';
    if (av != null && bv != null) {
      var mx = Math.max(av, bv, 0.01);
      var clamp = function (v) { return Math.max(14, Math.min(92, Math.round(v / mx * 90))); };
      var d = _ghDelay(baseDelay + i * 0.1);
      bar = '<div style="display:flex;align-items:center;gap:8px;height:18px">' +
        '<div class="gh-bar-track" style="justify-content:flex-end"><div class="gh-bar gh-grow-l" style="width:' + clamp(av) + '%;background:' + m.away.colors.accent + ';opacity:' + (av >= bv ? 1 : .45) + ';' + d + '"></div></div>' +
        '<span style="width:58px;flex-shrink:0;text-align:center;font-size:9.5px;font-weight:800;letter-spacing:.06em;color:#9C95D0;white-space:nowrap">' + _escapeHtml(l.label) + '</span>' +
        '<div class="gh-bar-track"><div class="gh-bar gh-grow-r" style="width:' + clamp(bv) + '%;background:' + m.home.colors.accent + ';opacity:' + (bv >= av ? 1 : .45) + ';' + d + '"></div></div></div>';
    } else {
      bar = '<div style="text-align:center;font-size:10px;font-weight:800;letter-spacing:.08em;color:#9C95D0">' + _escapeHtml(l.label) + '</div>';
    }
    return '<div style="display:flex;flex-direction:column;gap:3px;padding:6px 0;' + (i ? 'border-top:.5px solid rgba(255,255,255,.07)' : '') + '">' +
      '<div class="gh-row" style="align-items:flex-start">' +
        '<div style="display:flex;flex-direction:column;min-width:0;flex:1"><span style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (a.name ? _gxPlayerLink(a.name, a.id, m.league) : '—') + '</span><span class="gh-sub">' + _escapeHtml(a.line || '') + '</span></div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;text-align:right;min-width:0;flex:1"><span style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">' + (b.name ? _gxPlayerLink(b.name, b.id, m.league) : '—') + '</span><span class="gh-sub">' + _escapeHtml(b.line || '') + '</span></div>' +
      '</div>' + bar + '</div>';
  }).join('');
}
function _gxStatBarsHtml(m, rows, baseDelay) {
  if (!rows || !rows.length) return '';
  return '<div style="display:flex;flex-direction:column;gap:3px">' + rows.map(function (r, i) {
    return _ghCompareRow.call(m, r[0], r[1], r[2], !!r[5], baseDelay + i * 0.08, r[3], r[4]);
  }).join('') + '</div>';
}

// ── Stages (pre-game field drawings) ───────────────────────────────────
function _gxStageSvg(m) {
  var beams = '<polygon class="gh-beam" points="8,0 34,0 146,150 114,150" fill="#A89FE8"/>' +
    '<polygon class="gh-beam" points="280,0 306,0 200,150 168,150" fill="#A89FE8" style="animation-delay:-1.7s"/>' +
    '<rect class="gh-bulb" x="6" y="0" width="30" height="5" rx="2" fill="#E9E5FF"/>' +
    '<rect class="gh-bulb" x="278" y="0" width="30" height="5" rx="2" fill="#E9E5FF" style="animation-delay:-1.7s"/>';
  var f = '';
  if (m.sport === 'football') {
    f = '<rect x="37" y="48" width="22" height="94" fill="' + m.home.colors.bg + '" opacity=".3"/><rect x="255" y="48" width="22" height="94" fill="' + m.away.colors.bg + '" opacity=".3"/>' +
      '<rect class="gh-draw" x="37" y="48" width="240" height="94" rx="6" fill="none" stroke="#A89FE8" stroke-width="1.5" opacity=".65"/>' +
      '<path class="gh-draw" d="M59 48V142 M78.6 48V142 M98.2 48V142 M117.8 48V142 M137.4 48V142 M157 48V142 M176.6 48V142 M196.2 48V142 M215.8 48V142 M235.4 48V142 M255 48V142" fill="none" stroke="#A89FE8" stroke-width="1" opacity=".35" style="animation-delay:.3s"/>' +
      '<path class="gh-draw" d="M29 80V110 M285 80V110" fill="none" stroke="#E9E5FF" stroke-width="2" opacity=".7" style="animation-delay:.5s"/>';
  } else if (m.sport === 'basketball') {
    f = '<rect class="gh-draw" x="37" y="44" width="240" height="100" rx="4" fill="none" stroke="#A89FE8" stroke-width="1.5" opacity=".65"/>' +
      '<path class="gh-draw" d="M157 44V144 M37 74H77V114H37 M277 74H237V114H277" fill="none" stroke="#A89FE8" stroke-width="1.2" opacity=".5" style="animation-delay:.3s"/>' +
      '<path class="gh-draw" d="M37 54H49A48 48 0 0 1 49 134H37 M277 54H265A48 48 0 0 0 265 134H277" fill="none" stroke="#A89FE8" stroke-width="1.2" opacity=".45" style="animation-delay:.45s"/>' +
      '<circle class="gh-draw" cx="157" cy="94" r="14" fill="none" stroke="#A89FE8" stroke-width="1.2" opacity=".5" style="animation-delay:.5s"/>' +
      '<circle cx="46" cy="94" r="3" fill="none" stroke="#FF9A6B" stroke-width="1.5"/><circle cx="268" cy="94" r="3" fill="none" stroke="#FF9A6B" stroke-width="1.5"/>';
  } else if (m.sport === 'hockey') {
    f = '<rect class="gh-draw" x="37" y="44" width="240" height="100" rx="40" fill="rgba(255,255,255,.03)" stroke="#A89FE8" stroke-width="1.5" opacity=".7"/>' +
      '<path class="gh-draw" d="M157 44V144" fill="none" stroke="#FF6B6B" stroke-width="2.5" opacity=".6" style="animation-delay:.3s"/>' +
      '<path class="gh-draw" d="M122 44V144 M192 44V144" fill="none" stroke="#6FA0E0" stroke-width="2.5" opacity=".6" style="animation-delay:.35s"/>' +
      '<path class="gh-draw" d="M55 50V138 M259 50V138" fill="none" stroke="#FF6B6B" stroke-width="1" opacity=".5" style="animation-delay:.4s"/>' +
      '<circle class="gh-draw" cx="157" cy="94" r="14" fill="none" stroke="#6FA0E0" stroke-width="1.2" opacity=".6" style="animation-delay:.5s"/>' +
      [[80, 70], [80, 118], [234, 70], [234, 118]].map(function (c) { return '<circle cx="' + c[0] + '" cy="' + c[1] + '" r="9" fill="none" stroke="#FF6B6B" stroke-width="1" opacity=".45"/>'; }).join('');
  } else {
    f = [37, 97, 157, 217].map(function (x) { return '<rect x="' + x + '" y="44" width="30" height="100" fill="rgba(124,242,156,.05)"/>'; }).join('') +
      '<rect class="gh-draw" x="37" y="44" width="240" height="100" fill="none" stroke="#A89FE8" stroke-width="1.5" opacity=".65"/>' +
      '<path class="gh-draw" d="M157 44V144 M37 66H70V122H37 M277 66H244V122H277 M37 82H49V106H37 M277 82H265V106H277" fill="none" stroke="#A89FE8" stroke-width="1.2" opacity=".5" style="animation-delay:.3s"/>' +
      '<circle class="gh-draw" cx="157" cy="94" r="15" fill="none" stroke="#A89FE8" stroke-width="1.2" opacity=".5" style="animation-delay:.5s"/>' +
      '<path d="M31 88H37V100H31 M283 88H277V100H283" fill="none" stroke="#E9E5FF" stroke-width="1.5" opacity=".7"/>';
  }
  return '<svg viewBox="0 0 314 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">' + beams + f + '</svg>';
}
function _gxBallIcon(sport) {
  if (sport === 'football') return '<div class="gh-spin" style="width:38px;height:38px"><svg width="38" height="38" viewBox="0 0 38 38" style="display:block"><ellipse cx="19" cy="19" rx="17" ry="10" fill="#8B4A2B" transform="rotate(-30 19 19)"/><path d="M13 20L25 13 M16 19.5L15 17.5 M19 18L18 16 M22 16.2L21 14.2" fill="none" stroke="#F4F1FF" stroke-width="1.3" stroke-linecap="round"/></svg></div>';
  if (sport === 'basketball') return '<div class="gh-spin" style="width:36px;height:36px"><svg width="36" height="36" viewBox="0 0 36 36" style="display:block"><circle cx="18" cy="18" r="16" fill="#E8762C"/><path d="M2 18H34 M18 2V34 M6.5 6.5C12 12 12 24 6.5 29.5 M29.5 6.5C24 12 24 24 29.5 29.5" fill="none" stroke="#3A1A08" stroke-width="1.3"/></svg></div>';
  if (sport === 'hockey') return '<div class="gh-slide" style="width:40px;height:30px"><svg width="40" height="30" viewBox="0 0 40 30" style="display:block"><ellipse cx="20" cy="18" rx="16" ry="7" fill="#0B0B0F" stroke="#6E68A6"/><rect x="4" y="12" width="32" height="6" fill="#0B0B0F"/><ellipse cx="20" cy="12" rx="16" ry="7" fill="#1E1E26" stroke="#6E68A6"/></svg></div>';
  return '<div class="gh-spin" style="width:36px;height:36px"><svg width="36" height="36" viewBox="0 0 36 36" style="display:block"><circle cx="18" cy="18" r="16" fill="#F4F1FF"/><polygon points="18,11 24.7,15.9 22.1,23.8 13.9,23.8 11.3,15.9" fill="#1A1640"/><path d="M18 11V3 M24.7 15.9L32 13.5 M22.1 23.8L27 30 M13.9 23.8L9 30 M11.3 15.9L4 13.5" fill="none" stroke="#1A1640" stroke-width="1.2"/></svg></div>';
}

// ── PRE-GAME ───────────────────────────────────────────────────────────
// How many games a team has already played this season, read straight off
// the record it carries into this game ("1-1", "1-1-1", "5-2-1" — every
// number in a record is a game played, so ties and OT losses count too).
// Only the leading run of numbers is used, since some leagues append a
// conference record ("2-0, 1-0 Big Ten") that would otherwise be counted.
function _gxGamesPlayed(record) {
  var head = String(record || '').trim().match(/^\d+(?:[-\u2013]\d+)*/);
  if (!head) return null;
  return head[0].split(/[-\u2013]/).reduce(function (t, p) { return t + Number(p); }, 0);
}

function _gxFormHtml(m, st) {
  var form = m.form || {};
  if (!(form.away && form.away.length) && !(form.home && form.home.length)) return '';
  var colors = m.teamColors || {};
  var ring = { W: '#7CF29C', L: '#FF7A6B', OT: '#F2C869', D: '#9C95D0' };
  var letter = { W: '#7CF29C', L: '#FF9A8E', OT: '#F2C869', D: '#B9B3E6' };
  var word = { W: 'Beat', L: 'Lost to', OT: 'Lost in overtime to', D: 'Drew with' };
  var n = Math.max((form.away || []).length, (form.home || []).length);
  var sides = [['away', m.away], ['home', m.home]];
  // In week 2 of a season the last five games run back across the
  // offseason, and a record counted over that break describes nothing a
  // fan cares about. The record entering the game says how many of these
  // belong to this season; everything older sits left of a season line
  // and is left out of the count.
  var priorOf = function (side, games) {
    var played = _gxGamesPlayed(side && side.record);
    if (played == null || played >= games.length) return 0;
    return games.length - played;
  };
  var split = sides.some(function (pair) {
    var games = form[pair[0]] || [];
    return games.length > 0 && priorOf(pair[1], games) > 0;
  });
  var title = m.sport === 'soccer' ? 'Form · last ' + n : 'Last ' + n;
  var sel = st && st.formSel;
  var h = '<div class="gh-up" style="' + _ghDelay(1.3) + 'display:flex;flex-direction:column;gap:12px">' +
    '<div class="gh-row" style="align-items:baseline"><span class="gh-eyebrow">' + title + '</span><span style="font-size:11px;color:#9C95D0">oldest → latest · tap a game</span></div>';
  if (split) {
    h += '<div class="gh-sub" style="margin-top:-6px;line-height:1.45">Records count this season only. Games left of the line are from last season.</div>';
  }
  sides.forEach(function (pair, ti) {
    var games = form[pair[0]] || [];
    if (!games.length) return;
    var s = pair[1];
    var prior = priorOf(s, games);
    var counted = games.slice(prior);
    var cnt = function (r) { return counted.filter(function (g) { return g.res === r; }).length; };
    var rec = m.sport === 'soccer' ? cnt('W') + '–' + cnt('D') + '–' + cnt('L') : cnt('W') + '–' + cnt('L') + (m.sport === 'hockey' ? '–' + cnt('OT') : '');
    // A streak that reaches back past the season line isn't this season's
    // streak, so it's counted over the same games as the record.
    var streak = '', streakStyle = '';
    if (counted.length) {
      var last = counted[counted.length - 1].res, k = 0;
      for (var i = counted.length - 1; i >= 0 && counted[i].res === last; i--) k++;
      streak = (last === 'OT' ? 'OTL' : last) + k;
      streakStyle = last === 'W' ? 'background:rgba(124,242,156,.16);color:#9be8ac' : last === 'D' ? 'background:rgba(255,255,255,.08);color:#D9D4FA' : last === 'OT' ? 'background:rgba(242,200,105,.16);color:#F2C869' : 'background:rgba(255,122,107,.16);color:#FFC2BA';
    }
    var size = games.length > 5 ? 28 : 38;
    var base = 1.45 + ti * 0.08;
    var seasonLine = '<span aria-hidden="true" style="width:1px;align-self:stretch;background:rgba(168,159,232,.45);flex-shrink:0"></span>';
    h += '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:13px;font-weight:800;color:' + s.colors.accent + ';flex:1">' + _escapeHtml(s.abbr) + '</span>' +
      '<span class="gh-num" style="font-size:17px">' + rec + '</span>' +
      (streak ? '<span class="gh-tag gh-l10-pop" style="' + _ghDelay(base + games.length * 0.11) + streakStyle + '">' + streak + '</span>' : '') + '</div>' +
      '<div style="display:flex;justify-content:space-between;gap:2px">';
    games.forEach(function (g, i) {
      if (prior > 0 && i === prior) h += seasonLine;
      var oc = m.league === 'nhl' ? _gxColors('nhl', g.opp) : _gxColors(m.league, g.opp, colors[g.opp] && colors[g.opp].color, colors[g.opp] && colors[g.opp].alt);
      var fs = (games.length > 5 ? 8.5 : 10.5) - (String(g.opp).length > 3 ? 1.5 : 0);
      var older = i < prior;
      var isSel = sel && sel.side === pair[0] && sel.i === i;
      h += '<button class="gh-l10-dot gh-l10-pop' + (g.res === 'W' ? '' : ' loss') + (isSel ? ' sel' : '') + '" data-side="' + pair[0] + '" data-i="' + i + '" onclick="gxFormPick(this)" aria-pressed="' + (isSel ? 'true' : 'false') + '" aria-label="' + _escapeHtml(word[g.res] + ' ' + (g.oppName || g.opp) + (g.score ? ' ' + g.score : '') + (older ? ' (last season)' : '')) + '" style="' + _ghDelay(base + i * 0.11) +
        'width:' + size + 'px;height:' + size + 'px;font-size:' + fs + 'px;' + (older ? 'opacity:.45;' : '') + 'background:' + oc.bg + ';color:' + oc.fg + ';box-shadow:0 0 0 2px ' + ring[g.res] + '">' + _escapeHtml(g.opp) + '</button>';
    });
    h += '</div><div style="display:flex;justify-content:space-between;gap:2px;margin-top:-4px" aria-hidden="true">';
    games.forEach(function (g, i) {
      if (prior > 0 && i === prior) h += '<span style="width:1px;flex-shrink:0"></span>';
      h += '<span class="gh-l10-wl gh-l10-pop" style="' + _ghDelay(base + i * 0.11 + 0.05) + 'width:' + size + 'px;' + (i < prior ? 'opacity:.45;' : '') + 'color:' + letter[g.res] + '">' + g.res + '</span>';
    });
    var selGame = sel && sel.side === pair[0] ? games[sel.i] : null;
    h += '</div><div id="gx-form-detail-' + pair[0] + '" class="gh-l10-detail' + (selGame ? ' on' : '') + '">' + (selGame ? _gxFormDetailInner(m, pair[0], sel.i) : '') + '</div></div>';
  });
  return h + '</div>';
}

function _gxPreHtml(m, st) {
  var meta = [_formatGameTime(m.startTime), m.venue].filter(Boolean).join(' · ');
  var h = _ghHeader('pre', '<span class="gh-dot pre"></span>PRE-GAME', meta);
  var tile = function (s, cls, delay) {
    var tap = _tmTapAttrs(m.league, s.id, s.name);
    return '<div class="gh-team ' + cls + (tap ? ' tm-tap' : '') + '"' + tap + ' style="' + _ghDelay(delay) + '">' + _ghBadge(s, 50) +
      '<div style="font-size:12.5px;font-weight:700;margin-top:4px;max-width:104px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(s.short || '') + '</div>' +
      '<div class="gh-num" style="font-size:26px;line-height:1">' + _escapeHtml(s.record || '—') + '</div>' +
      (s.standing ? '<div style="font-size:10.5px;color:#B9B3E6">' + _escapeHtml(s.standing) + '</div>' : '') + (tap ? '<div class="tm-hint">Team page ›</div>' : '') + '</div>';
  };
  h += '<div class="gh-stage">' + _gxStageSvg(m) + '<div class="gh-teams">' + tile(m.away, 'gh-from-l', .25) +
    '<div style="display:flex;flex-direction:column;align-items:center;gap:6px">' + _gxBallIcon(m.sport) +
    '<div style="font-size:12px;letter-spacing:.2em;color:#B9B3E6;font-weight:800">VS</div></div>' + tile(m.home, 'gh-from-r', .35) + '</div></div>';

  var cd = _ghCountdownText(m.startTime);
  if (cd) {
    var label = { football: 'Kickoff', basketball: 'Tip-off', hockey: 'Puck drop', soccer: 'Kickoff' }[m.sport] || 'Start';
    h += '<div class="gh-panel gh-up gh-row" style="' + _ghDelay(.55) + '"><span class="gh-eyebrow">' + label + '</span>' +
      '<span id="gh-countdown" class="gh-num" style="font-size:24px;line-height:1.15">' + _escapeHtml(cd) + '</span></div>';
  }

  if (m.keyPlayers && (m.keyPlayers.a || m.keyPlayers.h)) {
    var kp = m.keyPlayers;
    var cell = function (p, side, right, cls, delay) {
      var attrs = p && p.name ? ' role="button" tabindex="0" data-name="' + _escapeHtml(p.name) + '" data-id="' + _escapeHtml(String(p.id || '')) + '" data-league="' + m.league + '" onclick="openPlayerLinkSheet(this.dataset.name,this.dataset.id||null,this.dataset.league)"' : '';
      return '<div class="' + cls + '"' + attrs + ' style="' + _ghDelay(delay) + 'display:flex;align-items:center;gap:10px;min-width:0;min-height:44px;cursor:pointer;' + (right ? 'flex-direction:row-reverse;text-align:right' : '') + '">' +
        '<div style="width:38px;height:38px;border-radius:50%;background:#2A2560;border:2px solid ' + side.colors.accent + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;box-sizing:border-box;font-size:13px;font-weight:800">' + (p ? _escapeHtml(_ghInitials(p.name)) : '?') + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:1px;min-width:0"><span style="font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:underline;text-decoration-color:rgba(255,255,255,.3);text-underline-offset:3px">' + (p ? _escapeHtml(_ghShortInitialName(p.name)) : 'TBD') + '</span>' +
        '<span class="gh-sub">' + _escapeHtml((p && p.sub) || 'Not announced') + '</span></div></div>';
    };
    h += '<div style="display:flex;flex-direction:column;gap:10px"><div class="gh-eyebrow gh-up" style="' + _ghDelay(.7) + '">' + _escapeHtml(kp.title) + '</div>' +
      '<div class="gh-row">' + cell(kp.a, m.away, false, 'gh-from-l', .8) + cell(kp.h, m.home, true, 'gh-from-r', .85) + '</div>' +
      (kp.compare && kp.compare.length ? _gxStatBarsHtml(m, kp.compare, 1.0) : '') + '</div>';
  } else if (m.leaders && m.leaders.length) {
    h += '<div class="gh-up" style="' + _ghDelay(.7) + 'display:flex;flex-direction:column;gap:4px"><div class="gh-eyebrow">' + (m.sport === 'basketball' ? 'Players to watch' : 'Season leaders') + '</div>' +
      _gxLeaderCompareHtml(m, m.leaders, 1.0) + '</div>';
  }
  h += _gxFormHtml(m, st);
  return h;
}

// ── LIVE ───────────────────────────────────────────────────────────────
function _gxPeriodText(m) {
  if (m.sport === 'soccer') return { big: m.clock || '', small: (m.statusDetail && /half/i.test(m.statusDetail)) ? m.statusDetail : (m.period === 1 ? '1st half' : m.period === 2 ? '2nd half' : (m.period ? 'Extra time' : '')) };
  var tag = m.sport === 'hockey' ? (m.periodTag || (m.period ? 'P' + m.period : '')) : (m.period ? (m.period <= 4 ? 'Q' + m.period : (m.period === 5 ? 'OT' : (m.period - 4) + 'OT')) : '');
  var small = m.clock || '';
  if (m.intermission) small = 'Intermission';
  else if (m.statusDetail && /half|end of|intermission/i.test(m.statusDetail)) small = m.statusDetail;
  return { big: tag, small: small };
}
function _gxMiniText(m) {
  var s = m.situation || {};
  if (m.sport === 'basketball') return m.leadChanges != null ? m.leadChanges + ' lead changes' : '';
  if (m.sport === 'hockey') return s.ppSide ? (s.ppSide === 'h' ? m.home.abbr : m.away.abbr) + ' PP' + (s.ppTime ? ' ' + s.ppTime : '') : (m.away.sog != null ? 'SOG ' + m.away.sog + '–' + m.home.sog : '');
  if (m.sport === 'soccer') return s.possA != null ? 'Poss ' + s.possA + '–' + s.possH : '';
  return '';
}
function _gxStripHtml(m) {
  var s = m.situation;
  if (m.sport === 'football') {
    // v5.98.0: the premium animated field. Between periods there's no
    // down, possession or drive, so only the field and the break overlay.
    var fx = _fbxTrack(m);
    var brk = _fbBreakLabel(m);
    if (brk) {
      return '<div class="gh-panel gh-strip fbx" style="display:flex;flex-direction:column;gap:8px">' + _fbxFieldHtml(m, null, fx, brk) + '</div>';
    }
    if (!s) return '';
    var possT = s.possSide === 'h' ? m.home : (s.possSide === 'a' ? m.away : null);
    var burnFor = function (side) { return fx.burn && fx.burn.side === side && Date.now() - fx.burn.at < 3000 ? fx.burn : null; };
    var dots = function (n, side) {
      if (n == null) return '';
      var b = burnFor(side), o = '';
      for (var i = 0; i < 3; i++) {
        var burning = b && i === n;
        o += '<span class="' + (burning ? 'fbx-dot-burn' : '') + '" style="width:6px;height:6px;border-radius:50%;display:inline-block;margin-left:3px;' +
          (burning ? '--t0:' + (-(Date.now() - b.at)) + 'ms;border:1px solid #6E68A6' : (i < n ? 'background:#F2C869' : 'border:1px solid #6E68A6')) + '"></span>';
      }
      return o;
    };
    var field = _fbxFieldHtml(m, _fbViewFromGx(m), fx, null);
    // v7.2.0: latest play, then the field; the down row and timeouts live in
    // the scoreboard now, the drive's numbers head the Current drive card
    return '<div class="gh-panel gh-strip fbx" style="display:flex;flex-direction:column;gap:10px">' + _fbxResultHtml(m, fx) + field + '</div>';
  }
  if (m.sport === 'basketball') {
    if (!s || (!s.momA && !s.momH)) return '';
    var leadT = s.momA > s.momH ? m.away : m.home;
    var hi = Math.max(s.momA, s.momH), lo = Math.min(s.momA, s.momH);
    var mx = Math.max(s.momA, s.momH, 1);
    return '<div class="gh-panel gh-strip" style="display:flex;flex-direction:column;gap:8px">' +
      '<div class="gh-row"><span style="font-size:13.5px;font-weight:700">' + (hi - lo >= 6 ? _escapeHtml(leadT.short) + ' on a ' + hi + '–' + lo + ' run' : 'Back and forth · ' + s.momA + '–' + s.momH) + '</span>' +
      '<span class="gh-tag" style="background:' + _ghHexAlpha(leadT.colors.accent, .2) + ';color:' + leadT.colors.accent + '">LAST 8 SCORES</span></div>' +
      '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:11px;font-weight:800;width:34px;color:' + m.away.colors.accent + '">' + _escapeHtml(m.away.abbr) + '</span>' +
      '<div class="gh-bar-track" style="justify-content:flex-end"><div class="gh-bar gh-grow-l" style="width:' + Math.max(8, Math.round(s.momA / mx * 90)) + '%;background:' + m.away.colors.accent + ';opacity:' + (s.momA >= s.momH ? 1 : .45) + '"></div></div>' +
      '<div class="gh-bar-track"><div class="gh-bar gh-grow-r" style="width:' + Math.max(8, Math.round(s.momH / mx * 90)) + '%;background:' + m.home.colors.accent + ';opacity:' + (s.momH >= s.momA ? 1 : .45) + '"></div></div>' +
      '<span style="font-size:11px;font-weight:800;width:34px;text-align:right;color:' + m.home.colors.accent + '">' + _escapeHtml(m.home.abbr) + '</span></div>' +
      (m.leadChanges != null ? '<div class="gh-sub" style="font-size:11px">' + m.leadChanges + ' lead changes</div>' : '') + '</div>';
  }
  if (m.sport === 'hockey') {
    s = s || {};
    var ppT = s.ppSide === 'h' ? m.home : (s.ppSide === 'a' ? m.away : null);
    var secs = 0;
    var mm = String(s.ppTime || '').match(/^(\d+):(\d{2})$/);
    if (mm) secs = Number(mm[1]) * 60 + Number(mm[2]);
    var top = ppT
      ? '<div class="gh-row"><span style="display:flex;align-items:center;gap:8px"><span class="gh-tag" style="background:' + _ghHexAlpha(ppT.colors.accent, .2) + ';color:' + ppT.colors.accent + '">PP</span><span style="font-size:13.5px;font-weight:700">' + _escapeHtml(ppT.short) + ' power play</span></span><span class="gh-num" style="font-size:18px">' + _escapeHtml(s.ppTime || '') + '</span></div>' +
        '<div class="gh-bar-track"><div class="gh-bar gh-pp-drain" style="width:' + Math.min(100, Math.round(secs / 120 * 100)) + '%;background:' + ppT.colors.accent + ';animation-duration:' + Math.max(1, secs) + 's"></div></div>'
      : '<div class="gh-row"><span style="font-size:13.5px;font-weight:700">Even strength</span></div>';
    return '<div class="gh-panel gh-strip" style="display:flex;flex-direction:column;gap:8px">' + top +
      (m.away.sog != null ? '<div class="gh-row" style="font-size:11px;color:#B9B3E6"><span>Shots on goal</span><span class="gh-num" style="font-size:13px;color:#fff">' + m.away.sog + ' – ' + m.home.sog + '</span></div>' : '') + '</div>';
  }
  // soccer
  s = s || {};
  var minute = parseInt(m.clock, 10) || 0;
  var pct = Math.min(100, minute / 90 * 100);
  var marks = m.highlights.map(function (p, i) {
    var mn = parseInt(p.tag, 10) || 0;
    var t = p.side === 'h' ? m.home : m.away;
    return '<span class="gh-l10-pop" style="position:absolute;left:' + Math.min(100, mn / 90 * 100).toFixed(1) + '%;top:' + (p.side === 'a' ? 0 : 16) + 'px;width:9px;height:9px;margin-left:-4.5px;border-radius:' + (p.red ? '2px' : '50%') + ';border:1.5px solid #1C1845;background:' + (p.red ? '#FF5A5A' : t.colors.accent) + ';' + _ghDelay(.6 + i * .15) + '"></span>';
  }).join('');
  return '<div class="gh-panel gh-strip" style="display:flex;flex-direction:column;gap:9px">' +
    (s.possA != null ? '<div class="gh-row" style="font-size:11px;color:#B9B3E6"><span><b class="gh-num" style="color:#fff;font-size:14px">' + s.possA + '%</b> possession</span><span><b class="gh-num" style="color:#fff;font-size:14px">' + s.possH + '%</b></span></div>' +
      '<div style="display:flex;height:6px;gap:2px"><div style="flex:' + s.possA + ' 0 0;background:' + m.away.colors.accent + ';border-radius:3px"></div><div style="flex:' + s.possH + ' 0 0;background:' + m.home.colors.accent + ';border-radius:3px"></div></div>' : '') +
    '<div style="position:relative;height:26px"><div style="position:absolute;left:0;right:0;top:12px;height:2px;background:rgba(255,255,255,.14);border-radius:1px"></div>' +
      '<div style="position:absolute;left:0;top:12px;height:2px;width:' + pct.toFixed(1) + '%;background:#A89FE8;border-radius:1px"></div>' +
      '<div style="position:absolute;left:50%;top:8px;width:1px;height:10px;background:rgba(255,255,255,.3)"></div>' + marks +
      '<span class="gh-runner" style="position:absolute;left:' + pct.toFixed(1) + '%;top:9px;width:8px;height:8px;margin-left:-4px;border-radius:50%;background:#FF7A6B"></span></div>' +
    '<div class="gh-row" style="font-size:10px;color:#9C95D0;margin-top:-6px"><span>0\'</span><span>HT</span><span>90\'</span></div></div>';
}

function _gxLiveHtml(m, st) {
  var plays = m.highlights;
  var seen = st.seenPlays;
  plays.forEach(function (p) {
    var key = [p.tag, p.time, p.head, p.as, p.hs].join('|');
    if (seen && !seen[key]) st.newAt[key] = Date.now();
  });
  var recentNew = plays.some(function (p) { var t = st.newAt[[p.tag, p.time, p.head, p.as, p.hs].join('|')]; return t && Date.now() - t < 120000 && (!st.newSeenAt || t > st.newSeenAt); });
  var mode = _ghLiveMode(st, plays.length);
  st.renderMode = mode;
  var expanded = mode === 'open';
  var h = '<div class="gh-row"><span class="gh-chip live"><span class="gh-dot live"></span>LIVE</span>' +
    (plays.length ? _ghHlButtonHtml(plays.length, expanded, recentNew) : '<span class="gh-meta">' + _escapeHtml(m.venue || '') + '</span>') + '</div>';
  var prev = st.lastScore;
  var pt = _gxPeriodText(m);
  var mini = _gxMiniText(m);
  var center = '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0">' +
    '<span class="gh-num" style="font-size:22px;line-height:1">' + _escapeHtml(pt.big) + '</span>' +
    '<span class="' + (m.sport === 'football' ? _fbxClockClass(m) : '') + '" style="font-size:10.5px;font-weight:700;letter-spacing:.06em;color:#9C95D0;white-space:nowrap">' + _escapeHtml(pt.small) + '</span>' +
    (mini ? '<div class="gh-mini" aria-hidden="true"><span class="gh-runner" style="width:6px;height:6px;border-radius:50%;background:#FF7A6B"></span><span style="font-size:11px;font-weight:700;color:#D9D4FA">' + _escapeHtml(mini) + '</span></div>' : '') + '</div>';
  var side = function (t, isRight, flash) {
    var other = t === m.away ? m.home : m.away;
    var trailing = t.score != null && other.score != null && other.score > t.score;
    return '<div style="display:flex;align-items:center;gap:10px;min-width:0;' + (isRight ? 'flex-direction:row-reverse' : '') + '">' +
      '<div class="gh-badge gh-sb-badge' + (String(t.abbr).length > 3 ? ' gh-ab4' : '') + (_tmTapAttrs(m.league, t.id, t.name) ? ' tm-tap' : '') + '"' + _tmTapAttrs(m.league, t.id, t.name) + ' style="background:' + t.colors.bg + ';color:' + t.colors.fg + '">' + _escapeHtml(t.abbr) + '</div>' +
      '<div style="display:flex;flex-direction:column;min-width:0;' + (isRight ? 'align-items:flex-end' : '') + '">' +
        '<span class="gh-sub gh-sb-name">' + _escapeHtml(t.short || '') + '</span>' +
        '<span class="gh-num gh-sb-score' + ((m.away.score >= 100 || m.home.score >= 100) ? ' gh-sb3' : '') + '" style="color:' + (trailing ? '#C4BFE8' : '#fff') + '"><span class="' + (flash ? 'gh-flash' : '') + '">' + (t.score != null ? t.score : '–') + '</span></span>' +
      (m.sport === 'football' ? _fbbTimeoutsHtml(m, t === m.away ? 'a' : 'h') : '') +
      '</div></div>';
  };
  if (m.sport === 'football' && typeof _fbxTrack === 'function') _fbxTrack(m); // timeouts read the burn state
  h += '<div class="gh-row gh-up' + (m.sport === 'football' ? ' fbb-sb' : '') + '" style="' + _ghDelay(.15) + '">' + side(m.away, false, !!(prev && prev.away !== m.away.score)) + center + side(m.home, true, !!(prev && prev.home !== m.home.score)) + '</div>';
  if (m.sport === 'football') h += _fbbPossHtml(m) + _fbbDownHtml(m); // v7.2.0
  h += _gxStripHtml(m);
  h += _gxHighlightsListHtml(m, st, { cap: 8, withNew: true, title: m.sport === 'basketball' ? 'Big moments' : (m.sport === 'football' ? 'Scoring plays' : 'Goals') });
  return h;
}

// ── FINAL ──────────────────────────────────────────────────────────────
function _gxWho(head) {
  var toks = String(head || '').split(/\s+/);
  var name = [];
  for (var i = 0; i < toks.length; i++) {
    if (/^\d/.test(toks[i]) || /^[a-z]/.test(toks[i])) break;
    name.push(toks[i]);
  }
  var rest = toks.slice(name.length).join(' ');
  if (!name.length || !rest) return 'a ' + String(head || 'score').toLowerCase();
  return name.join(' ') + '\u2019s ' + rest;
}
function _gxWhen(m, p) {
  if (m.sport === 'soccer') { var mn = parseInt(p.tag, 10); return mn ? 'the ' + _gxOrdinal(mn) + ' minute' : 'the second half'; }
  if (/OT/.test(p.tag)) return 'overtime';
  var n = parseInt(String(p.tag).replace(/\D/g, ''), 10);
  if (m.sport === 'hockey') return 'the ' + _gxOrdinal(n) + ' period';
  return 'the ' + _gxOrdinal(n);
}
function _gxDecisive(m) {
  var a = m.away.score, b = m.home.score;
  if (a == null || b == null || a === b) return -1;
  var winKey = a > b ? 'a' : 'h';
  var plays = m.highlights.filter(function (p) { return p.as != null && p.hs != null; });
  var lead = function (p) { return winKey === 'a' ? p.as - p.hs : p.hs - p.as; };
  var d = -1;
  for (var i = plays.length - 1; i >= 0; i--) { if (lead(plays[i]) > 0) d = i; else break; }
  return d;
}
function _gxThe(name) {
  var n = String(name || '');
  return (/^[A-Z0-9.]{2,}$/.test(n) || /^(Inter|Real|Atl[eé]tico|Sporting|Orlando City|Minnesota United|Austin FC|Charlotte FC|Nashville SC)\b/.test(n)) ? n : 'the ' + n;
}
function _gxRecap(m) {
  var a = m.away, b = m.home;
  if (a.score == null || b.score == null) return '';
  var cap = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
  if (a.score === b.score) return cap(_gxThe(a.short)) + ' and ' + _gxThe(b.short) + ' drew ' + a.score + '–' + b.score + '.';
  var W = a.score > b.score ? a : b, L = W === a ? b : a;
  var base = cap(_gxThe(W.short)) + ' beat ' + _gxThe(L.short) + ' ' + W.score + '–' + L.score + '.';
  if (m.sport === 'basketball') {
    return base + (m.leadChanges ? ' The lead changed hands ' + m.leadChanges + ' times.' : '') + (m.star ? ' ' + _ghLastName(m.star.name) + ' led the way with ' + m.star.line.replace(/ · /g, ', ') + '.' : '');
  }
  var plays = m.highlights.filter(function (p) { return p.as != null && p.hs != null; });
  var d = _gxDecisive(m);
  if (d < 0) return base;
  var winKey = W === a ? 'a' : 'h';
  var p = plays[d];
  var before = d > 0 ? plays[d - 1] : { as: 0, hs: 0 };
  var wB = winKey === 'a' ? before.as : before.hs, lB = winKey === 'a' ? before.hs : before.as;
  var who = _gxWho(p.head), when = _gxWhen(m, p);
  var s1;
  if (m.sport === 'hockey' && /OT/.test(p.tag)) s1 = 'Tied ' + wB + '–' + lB + ' after regulation, ' + who + ' sealed it for ' + _gxThe(W.short) + '.';
  else if (wB < lB) s1 = 'Down ' + lB + '–' + wB + ' in ' + when + ', ' + who + ' flipped it.';
  else if (wB === lB && wB > 0) s1 = 'Level at ' + wB + '–' + lB + ' in ' + when + ', ' + who + ' put ' + _gxThe(W.short) + ' ahead for good.';
  else s1 = cap(who) + ' in ' + when + ' put ' + _gxThe(W.short) + ' ahead for good.';
  var s2 = '';
  for (var j = plays.length - 1; j > d; j--) {
    if (plays[j].side === winKey) { s2 = ' ' + _gxWho(plays[j].head).replace(/^a /, 'A ') + ' in ' + _gxWhen(m, plays[j]) + ' added insurance.'; break; }
  }
  return s1 + s2;
}
function _gxMoments(m) {
  var plays = m.highlights;
  if (!plays.length) return [];
  if (m.sport === 'basketball') return plays.slice(-3);
  var d = _gxDecisive(m);
  var picks = {};
  if (d >= 0) picks[d] = true;
  var winKey = (m.away.score || 0) > (m.home.score || 0) ? 'a' : 'h';
  for (var i = plays.length - 1; i >= 0 && Object.keys(picks).length < 2; i--) { if (plays[i].side !== winKey) { picks[i] = true; break; } }
  for (var k = plays.length - 1; k >= 0 && Object.keys(picks).length < 3; k--) picks[k] = true;
  return Object.keys(picks).map(Number).sort(function (x, y) { return x - y; }).map(function (i) { return plays[i]; });
}

function _gxFinalHtml(m, st) {
  var a = m.away, b = m.home;
  var fMode = _ghPhaseMode(st, 'finalMode', m.highlights.length);
  st.finalRenderMode = fMode;
  var winner = (a.score || 0) > (b.score || 0) ? a : ((b.score || 0) > (a.score || 0) ? b : null);
  var h = '';
  if (winner) {
    var sc = [winner.colors.accent, '#A89FE8', '#E9E5FF'];
    var right = winner === b;
    [[.9, 0, 70], [1.4, 8, 84], [1.1, 16, 66], [1.8, 24, 90], [2.3, 12, 100], [2.7, 28, 60], [3.1, 4, 96], [3.5, 20, 78]].forEach(function (sp, i) {
      h += '<span class="gh-spark" style="' + (right ? 'right:' : 'left:') + (6 + sp[1]) + '%;top:' + sp[2] + 'px;background:' + sc[i % 3] + ';' + _ghDelay(sp[0]) + '"></span>';
    });
  }
  var soccer = m.sport === 'soccer';
  var chip = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D9D4FA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>' + (soccer ? 'FULL TIME' : 'GAME OVER');
  h += _ghHeader('final', chip, m.venue || '', m.highlights.length ? _ghHlButtonHtml(m.highlights.length, fMode === 'open', false) : '');
  var labels = _gxPeriodLabels(m);
  var extra = '';
  if (m.sport === 'hockey' && labels.length > 3) extra = labels[labels.length - 1] === 'SO' ? 'SO' : 'OT';
  else if ((m.sport === 'football' || m.sport === 'basketball') && labels.length > 4) extra = labels.length > 5 ? (labels.length - 4) + 'OT' : 'OT';
  else if (soccer && labels.length > 2) extra = 'AET';
  var center = '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0"><span class="gh-stamp gh-stamp-in">' + (soccer ? 'FT' : 'FINAL') + '</span>' +
    (extra ? '<span class="gh-sub" style="font-weight:700">' + extra + '</span>' : '') + '</div>';
  h += _ghScoreboard(m, center, { away: false, home: false }, true);
  if (m.sport === 'football' && m.highlights.length) h += _fbrHtml(m, true);
  h += _gxHighlightsListHtml(m, st, { title: m.sport === 'basketball' ? 'Every big moment' : (m.sport === 'football' ? 'Every scoring play' : 'Every goal') });

  var recap = _gxRecap(m);
  if (recap) h += '<p class="gh-up" style="' + _ghDelay(.8) + 'margin:0;font-size:13.5px;line-height:1.5;color:#D9D4FA">' + _escapeHtml(recap) + '</p>';

  // Line score
  if (labels.length && (a.linescores || []).length) {
    var n = labels.length;
    var cols = 'grid-template-columns:40px repeat(' + n + ',minmax(0,1fr)) 38px';
    var fs = n > 5 ? 13 : 15;
    var cell = function (v, i, t, total, won) {
      var d = _ghDelay(total ? 0.95 + n * 0.08 : 0.9 + i * 0.08);
      if (total) return '<span class="gh-pop" style="' + d + 'border-left:1px solid rgba(168,159,232,.22);font-weight:800;color:' + (won ? '#fff' : '#B9B3E6') + '">' + (v != null ? v : '') + '</span>';
      var bright = v != null && v > 0;
      return '<span class="gh-pop" style="' + d + (bright ? 'font-weight:800;color:' + ((m.sport === 'hockey' || m.sport === 'soccer') && v > 1 ? t.colors.accent : '#fff') : 'color:#9C95D0') + '">' + (v != null ? v : '') + '</span>';
    };
    var row = function (t) {
      var r = '<span style="text-align:left;font-weight:800;color:' + t.colors.accent + '">' + _escapeHtml(t.abbr) + '</span>';
      for (var i = 0; i < n; i++) r += cell((t.linescores || [])[i], i, t, false);
      r += cell(t.score, 0, t, true, t === winner);
      return '<div class="gh-ls gh-num" style="' + cols + ';height:26px;font-size:' + fs + 'px">' + r + '</div>';
    };
    h += '<div class="gh-panel gh-up" style="' + _ghDelay(.9) + 'padding:8px 12px;display:flex;flex-direction:column;gap:2px">' +
      '<div class="gh-ls gh-num" style="' + cols + ';height:18px;font-size:11.5px;color:#9C95D0"><span></span>' + labels.map(function (l) { return '<span>' + _escapeHtml(l) + '</span>'; }).join('') +
      '<span style="border-left:1px solid rgba(168,159,232,.22);color:#D9D4FA">T</span></div>' + row(a) + row(b) + '</div>';
  }
  if (m.teamStats && m.teamStats.length) {
    h += '<div class="gh-up" style="' + _ghDelay(1.05) + 'display:flex;flex-direction:column;gap:3px"><span class="gh-eyebrow" style="margin-bottom:4px">' + (soccer ? 'Match stats' : 'Team stats') + '</span>' +
      _gxStatBarsHtml(m, m.teamStats.slice(0, 4), 1.1) + '</div>';
  }
  if (m.stars && m.stars.length) {
    h += '<div class="gh-up gh-shimmer" style="' + _ghDelay(1.25) + 'display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:16px;background:rgba(242,200,105,.08);border:1px solid rgba(242,200,105,.28)">' +
      '<span class="gh-eyebrow" style="font-size:9.5px;color:#F2C869">Three stars</span>' +
      m.stars.map(function (s) {
        var t = s.side === 'h' ? b : a;
        return '<div style="display:flex;align-items:center;gap:10px"><span style="width:26px;font-size:11px;font-weight:800;color:#F2C869">' + _escapeHtml(s.rank) + '</span>' +
          '<div class="gh-badge" style="width:30px;height:30px;font-size:11px;background:' + t.colors.bg + ';color:' + t.colors.fg + '">' + _escapeHtml(_ghInitials(s.name)) + '</div>' +
          '<span style="font-size:13.5px;font-weight:700;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _gxPlayerLink(s.name, s.id, m.league) + '</span>' +
          '<span style="font-size:12px;color:#D9D4FA;white-space:nowrap">' + _escapeHtml(s.line || '') + '</span></div>';
      }).join('') + '</div>';
  } else if (m.star && m.star.name) {
    var t = m.star.side === 'a' ? a : b;
    h += '<div class="gh-up gh-shimmer" style="' + _ghDelay(1.25) + 'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:' + _ghHexAlpha(t.colors.accent, .1) + ';border:1px solid ' + _ghHexAlpha(t.colors.accent, .3) + '">' +
      '<div class="gh-badge" style="width:42px;height:42px;font-size:15px;background:' + t.colors.bg + ';color:' + t.colors.fg + '">' + _escapeHtml(_ghInitials(m.star.name)) + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:1px;flex:1;min-width:0"><span class="gh-eyebrow" style="font-size:9.5px;color:' + t.colors.accent + '">' + _escapeHtml(m.star.title) + '</span>' +
      '<span style="font-size:14.5px;font-weight:700">' + _gxPlayerLink(m.star.name, m.star.id, m.league) + '</span>' +
      '<span style="font-size:12px;color:#D9D4FA">' + _escapeHtml(m.star.line || '') + '</span></div>' +
      '<i class="ti ti-star" style="font-size:20px;color:' + t.colors.accent + '"></i></div>';
  }
  var moments = _gxMoments(m);
  if (moments.length) {
    h += '<div style="display:flex;flex-direction:column;gap:8px"><span class="gh-eyebrow gh-up" style="' + _ghDelay(1.4) + '">Moments that decided it</span>' +
      moments.map(function (p, i) {
        return '<div class="gh-up" style="' + _ghDelay(1.5 + i * .1) + 'display:flex;align-items:center;gap:10px">' + _gxTag(p, m) +
          '<span style="font-size:13.5px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(p.head) + '</span>' +
          '<span class="gh-num" style="font-size:14.5px;white-space:nowrap">' + _escapeHtml(_gxChip(p, m)) + '</span></div>';
      }).join('') + '</div>';
  }
  return h;
}
function _gxPeriodLabels(m) {
  if (m.periodLabels && m.periodLabels.length) return m.periodLabels;
  var n = Math.max((m.away.linescores || []).length, (m.home.linescores || []).length);
  var out = [];
  for (var i = 1; i <= n; i++) {
    if (m.sport === 'soccer') out.push(i === 1 ? '1H' : i === 2 ? '2H' : 'ET');
    else out.push(i <= 4 ? String(i) : (i === 5 ? 'OT' : (i - 4) + 'OT'));
  }
  return out;
}

// ── Detail cards + box score (below the hero) ──────────────────────────
function _gxCard(title, right, body, delay) {
  return '<div class="gh-card gh-up" style="' + _ghDelay(delay || .4) + '"><div class="gh-card-head"><span class="gh-eyebrow">' + _escapeHtml(title) + '</span>' +
    (right ? '<span class="gh-sub">' + _escapeHtml(right) + '</span>' : '') + '</div>' + body + '</div>';
}
function _gxFeedHtml(m) {
  var feed = m.feed || [];
  if (!feed.length) return '';
  var all = window._gxFeedAll;
  var shown = all ? feed : feed.slice(0, 25);
  var rows = shown.map(function (p) {
    var chip = p.kind === 'block' ? '<span class="gh-tag" style="background:rgba(168,159,232,.16);color:#D9D4FA">BLK</span>' : '<span class="gh-num" style="font-size:13px;white-space:nowrap">' + _escapeHtml(_gxChip(p, m)) + '</span>';
    var t = p.side === 'h' ? m.home : (p.side === 'a' ? m.away : null);
    return '<div class="gh-feedrow"><div style="width:46px;flex-shrink:0;display:flex;flex-direction:column;gap:2px">' +
      '<span class="gh-tag" style="' + (t ? 'background:' + _ghHexAlpha(t.colors.accent, .2) + ';color:' + t.colors.accent : 'background:rgba(255,255,255,.08);color:#D9D4FA') + ';align-self:flex-start">' + _escapeHtml(p.tag) + '</span>' +
      '<span style="font-size:10.5px;color:#9C95D0">' + _escapeHtml(p.time || '') + '</span></div>' +
      '<span style="flex:1;min-width:0;font-size:12.5px;line-height:1.45;color:' + (p.kind === 'block' ? '#D9D4FA' : '#F5F3FF') + '">' + (p.kind === 'score' && p.pts === 3 ? '<b style="color:#F2C869">3 · </b>' : '') + _escapeHtml(p.text) + '</span>' + chip + '</div>';
  }).join('');
  var more = feed.length > 25 ? '<button onclick="gxFeedMore()" style="width:100%;margin-top:8px;height:40px;border-radius:12px;border:1px solid rgba(168,159,232,.22);background:transparent;color:#C9C2F5;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer">' + (all ? 'Show fewer' : 'Show all ' + feed.length + ' plays') + '</button>' : '';
  return _gxCard('Every basket & block', feed.length + ' plays · newest first', rows + more, .55);
}
function _gxColWidth(section) {
  return section.cols.map(function (c, i) {
    var mx = String(c).length;
    section.rows.forEach(function (r) { mx = Math.max(mx, String(r.cells[i] == null ? '' : r.cells[i]).length); });
    return Math.max(24, Math.min(50, mx * 7 + 6));
  });
}
function _gxBoxHtml(m) {
  var st = window._gxBox;
  var sideKey = st.side === 'home' ? 'home' : 'away';
  var box = (m.box && m.box[sideKey]) || { sections: [] };
  var hasAny = ((m.box && m.box.away && m.box.away.sections) || []).length || ((m.box && m.box.home && m.box.home.sections) || []).length;
  if (!hasAny) return '';
  var head = '<div class="gh-row" style="cursor:pointer;min-height:32px" onclick="gxBoxToggle()"><span class="gh-eyebrow">Box score</span>' +
    '<span style="height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(168,159,232,.22);color:#D9D4FA;font-size:11.5px;font-weight:700;display:flex;align-items:center">' + (st.open ? 'Hide' : 'Show') + '</span></div>';
  if (!st.open) return '<div class="gh-card gh-up" style="' + _ghDelay(.6) + '">' + head + '</div>';
  var seg = function (k, t) {
    var on = sideKey === k;
    return '<button onclick="gxBoxSide(\'' + k + '\')" aria-pressed="' + on + '" style="flex:1;height:38px;border-radius:10px;border:0;font-size:12.5px;font-weight:700;font-family:inherit;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
      (on ? 'background:' + t.colors.bg + ';color:' + t.colors.fg : 'background:rgba(255,255,255,.07);color:#B9B3E6') + '">' + _escapeHtml(t.short || t.abbr) + '</button>';
  };
  var body = '<div style="display:flex;gap:8px;margin:12px 0 4px">' + seg('away', m.away) + seg('home', m.home) + '</div>';
  if (!box.sections.length) body += '<div class="gh-sub" style="padding:10px 2px">No stats for this team yet.</div>';
  box.sections.forEach(function (sec) {
    var widths = _gxColWidth(sec);
    var grid = 'grid-template-columns:minmax(0,1fr) ' + widths.map(function (w) { return w + 'px'; }).join(' ');
    body += '<div style="margin-top:12px"><div class="gh-eyebrow" style="font-size:9.5px;color:#9C95D0;margin-bottom:4px">' + _escapeHtml(sec.title) + '</div>' +
      '<div class="gh-boxrow gh-boxhead" style="' + grid + '"><span>Player</span>' + sec.cols.map(function (c) { return '<span style="text-align:right">' + _escapeHtml(c) + '</span>'; }).join('') + '</div>' +
      sec.rows.map(function (r) {
        var indent = r.sub ? 'padding-left:10px;border-left:1.5px solid rgba(168,159,232,.35);margin-left:2px;' : '';
        return '<div class="gh-boxrow gh-num" style="' + grid + '"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;letter-spacing:0;' + indent + '">' +
          _gxPlayerLink(r.name, r.id, m.league) + (r.pos ? ' <span style="font-size:10px;color:#9C95D0;font-weight:500">' + _escapeHtml(r.pos) + '</span>' : '') + '</span>' +
          r.cells.map(function (v) { return '<span style="text-align:right;' + (r.dnp ? 'color:#9C95D0;font-weight:500' : '') + '">' + _escapeHtml(v == null ? '' : String(v)) + '</span>'; }).join('') + '</div>';
      }).join('') +
      (sec.note ? '<div style="font-size:10.5px;color:#9C95D0;margin-top:6px">' + _escapeHtml(sec.note) + '</div>' : '') + '</div>';
  });
  return '<div class="gh-card gh-up" style="' + _ghDelay(.6) + '">' + head + body + '</div>';
}
// A football play row, same affordances as a baseball one: tap the arrow
// to quote it into the chat, double-tap the row to react. playId keys the
// reaction doc, so it has to be stable — ESPN's own play id, namespaced by
// the game.
function _gxPlayRowHtml(m, p, first, indent) {
  var playId = (p.id != null && m.gameId != null) ? (m.gameId + '_' + p.id) : null;
  var tag = p.tag || '';
  var attrs = playId
    ? ' onclick="_playDoubleTap(this,\'' + playId + '\',this.dataset.rtag,this.dataset.rtext)" data-rtag="' + _escapeHtml(tag) + '" data-rtext="' + _escapeHtml(p.text) + '"'
    : '';
  return '<div class="gh-plays-row"' + attrs + ' style="' + (first ? 'border-top:0;' : '') + 'padding:7px 0 7px ' + (indent || 0) + 'px">' +
    '<div style="display:flex;gap:10px;align-items:flex-start">' +
      (tag ? '<span class="gh-tag" style="background:rgba(168,159,232,.16);color:#D9D4FA;min-width:58px;text-align:center;margin-top:1px;flex-shrink:0">' + _escapeHtml(tag) + '</span>' : '') +
      '<span style="flex:1;font-size:13px;line-height:1.45;color:#F5F3FF">' + _escapeHtml(p.text) + (p.scoring ? ' <span class="gh-tag" style="background:rgba(124,242,156,.16);color:#9be8ac">Score</span>' : '') + '</span>' +
      '<button class="gh-reply" aria-label="Reply to this play" data-tag="' + _escapeHtml(tag) + '" data-text="' + _escapeHtml(p.text) + '" onclick="event.stopPropagation();_replyToPlay(this.dataset.tag,this.dataset.text)">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14l-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 0 8h-1"/></svg></button>' +
    '</div>' +
    (typeof _ruleChipHtml === 'function' ? _ruleChipHtml(m.league, p.text) : '') +
    (playId ? '<div id="play-react-' + _escapeHtml(playId) + '"></div>' : '') +
    '</div>';
}

// Every drive of the game, oldest first, each one collapsible. The drive
// in progress starts open; whatever the reader opens after that survives
// the live refresh. Only present when the gamecast was asked for the full
// play list (&plays=all), so an old cached payload simply omits it.
function _gxAllDrivesHtml(m) {
  var drives = m.allDrives || [];
  if (!drives.length) return '';
  var open = window._gxDriveOpen = window._gxDriveOpen || {};
  var playIds = [];
  var rows = '';
  // Live games list the current drive first, same as baseball's current
  // half-inning (v5.98.0); finals keep reading drive 1 down to the last.
  var order = drives.map(function (d, i) { return { d: d, i: i }; });
  if (m.phase === 'live') order.reverse();
  order.forEach(function (o) {
    var d = o.d, i = o.i;
    var key = 'd' + i;
    var isOpen = open[key] != null ? !!open[key] : (i === drives.length - 1);
    var side = d.side === 'h' ? m.home : (d.side === 'a' ? m.away : null);
    var accent = side ? side.colors.accent : '#A89FE8';
    rows += '<div style="border-top:.5px solid rgba(255,255,255,.07)">' +
      '<button onclick="gxDriveToggle(\'' + key + '\',this)" aria-expanded="' + (isOpen ? 'true' : 'false') + '" aria-controls="gx-drive-' + key + '" ' +
        'style="width:100%;display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 0;background:none;border:0;color:#fff;font-family:inherit;text-align:left;cursor:pointer">' +
        '<svg data-chev width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#B9B3E6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;transition:transform .18s ease' + (isOpen ? ';transform:rotate(90deg)' : '') + '"><polyline points="9 5 16 12 9 19"/></svg>' +
        '<span class="gh-tag" style="background:' + _ghHexAlpha(accent, .2) + ';color:' + accent + ';flex-shrink:0">' + _escapeHtml(d.team || '—') + '</span>' +
        '<span style="flex:1;min-width:0;font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _escapeHtml(d.result || d.summary || 'Drive') +
          (d.summary && d.result ? '<span class="gh-sub" style="font-weight:400"> · ' + _escapeHtml(d.summary) + '</span>' : '') + '</span>' +
        (d.period ? '<span class="gh-sub" style="flex-shrink:0">Q' + d.period + '</span>' : '') +
      '</button>' +
      '<div id="gx-drive-' + key + '" style="display:' + (isOpen ? 'flex' : 'none') + ';flex-direction:column;padding-bottom:6px">';
    d.plays.forEach(function (pl, j) {
      if (isOpen && pl.id != null && m.gameId != null) playIds.push(m.gameId + '_' + pl.id);
      rows += _gxPlayRowHtml(m, pl, j === 0, 21);
    });
    rows += '</div></div>';
  });
  if (playIds.length) setTimeout(function () { _loadPlayReactions(playIds); }, 0);
  return _gxCard('Every play', drives.length + ' drives', rows, .55);
}

// Opened in the DOM rather than through a re-render, so a live tick can't
// collapse what someone is reading.
function gxDriveToggle(key, btn) {
  var body = document.getElementById('gx-drive-' + key);
  if (!body || !btn) return;
  var wasOpen = body.style.display !== 'none';
  body.style.display = wasOpen ? 'none' : 'flex';
  btn.setAttribute('aria-expanded', wasOpen ? 'false' : 'true');
  var chev = btn.querySelector('[data-chev]');
  if (chev) chev.style.transform = wasOpen ? '' : 'rotate(90deg)';
  (window._gxDriveOpen = window._gxDriveOpen || {})[key] = !wasOpen;
  if (!wasOpen) {
    var ids = [];
    body.querySelectorAll('[id^="play-react-"]').forEach(function (el) {
      if (!el.innerHTML) ids.push(el.id.slice('play-react-'.length));
    });
    if (ids.length) _loadPlayReactions(ids);
  }
}

function _gxDetailHtml(m) {
  var out = '';
  if (m.phase === 'live') {
    if (m.sport === 'football') {
      if (typeof _fbbDriveCardHtml === 'function' && m.drive && m.drive.plays && m.drive.plays.length) {
        out += _fbbDriveCardHtml(m); // v7.2.0
      } else if (m.drive && m.drive.plays && m.drive.plays.length) {
        var drivePlayIds = [];
        var driveRows = m.drive.plays.map(function (p, i) {
          if (p.id != null && m.gameId != null) drivePlayIds.push(m.gameId + '_' + p.id);
          return _gxPlayRowHtml(m, p, i === 0, 0);
        }).join('');
        if (drivePlayIds.length) setTimeout(function () { _loadPlayReactions(drivePlayIds); }, 0);
        out += _gxCard('Current drive', [m.drive.team, m.drive.summary].filter(Boolean).join(' · '), driveRows, .4);
      }
      out += _gxAllDrivesHtml(m);
      if (m.leaders && m.leaders.length) out += _gxCard('Leaders', '', _gxLeaderCompareHtml(m, m.leaders.map(function (l) { return { label: l.label, a: l.a && Object.assign({}, l.a, { value: null }), h: l.h && Object.assign({}, l.h, { value: null }) }; }), .5), .5);
    } else if (m.sport === 'basketball') {
      if (m.leaders && m.leaders.length) out += _gxCard('Leaders', '', _gxLeaderCompareHtml(m, m.leaders, .5) + (m.teamStats.length ? '<div style="margin-top:10px">' + _gxStatBarsHtml(m, m.teamStats, .6) + '</div>' : ''), .4);
      out += _gxFeedHtml(m);
    } else if (m.sport === 'hockey') {
      var body = '';
      if (m.shotsByPeriod) {
        var sp = m.shotsByPeriod;
        var n = sp.head.length;
        var cols = 'grid-template-columns:44px repeat(' + (n + 1) + ',minmax(0,1fr))';
        var tot = function (arr) { return arr.reduce(function (s, v) { return s + (Number(v) || 0); }, 0); };
        var row = function (t, arr) {
          return '<div class="gh-ls gh-num" style="' + cols + ';height:24px;font-size:14px"><span style="text-align:left;color:' + t.colors.accent + '">' + _escapeHtml(t.abbr) + '</span>' +
            arr.map(function (v) { return '<span style="color:#D9D4FA">' + (v != null ? v : '–') + '</span>'; }).join('') + '<span style="border-left:1px solid rgba(168,159,232,.22);color:#fff">' + tot(arr) + '</span></div>';
        };
        body += '<div class="gh-panel" style="display:flex;flex-direction:column;gap:3px;margin-bottom:10px"><div class="gh-ls gh-num" style="' + cols + ';height:18px;font-size:11px;color:#9C95D0"><span></span>' +
          sp.head.map(function (x) { return '<span>' + _escapeHtml(x) + '</span>'; }).join('') + '<span>T</span></div>' + row(m.away, sp.away) + row(m.home, sp.home) + '</div>';
      }
      if (m.leaders && m.leaders.length) body += _gxLeaderCompareHtml(m, m.leaders, .5);
      if (m.teamStats && m.teamStats.length) body += '<div style="margin-top:10px">' + _gxStatBarsHtml(m, m.teamStats.filter(function (r) { return r[0] !== 'Shots'; }), .6) + '</div>';
      if (body) out += _gxCard('Shots & goalies', m.away.sog != null ? 'SOG ' + m.away.sog + '–' + m.home.sog : '', body, .4);
    } else if (m.sport === 'soccer') {
      if (m.teamStats && m.teamStats.length) out += _gxCard('Match stats', '', _gxStatBarsHtml(m, m.teamStats.filter(function (r) { return r[0] !== 'Possession'; }), .5), .4);
    }
  } else if (m.phase === 'final' && m.sport === 'basketball') {
    out += _gxFeedHtml(m);
  }
  // The box score has its own Box tab on the game page (v7.5.0, js/games/watch-listen.js)
  return out ? '<div class="gh-detail">' + out + '</div>' : '';
}

// ── Entry points ───────────────────────────────────────────────────────
function _gxHtmlForState(state) {
  var game = window._activeBrowseGame;
  if (!state || !game || !state.gx) return '';
  var st = window._ghState;
  if (!st || st.gamePk != game.gamePk) { _ghResetForGame(game.gamePk); st = window._ghState; }
  var m = state.gx;
  _gattNoteModel(m);
  var body;
  try {
    if (m.phase === 'pre') body = _gxPreHtml(m, st);
    else if (m.phase === 'live') body = _gxLiveHtml(m, st);
    else if (m.phase === 'final') body = _gxFinalHtml(m, st);
    else return '';
  } catch (err) {
    console.error('[gx] hero render failed:', err);
    return '';
  }
  var animate = !st.animated[m.phase];
  st.animated[m.phase] = true;
  if (animate) st.heroAt = Date.now();
  if (m.phase !== 'pre' && window._ghCountdownTimer) { clearInterval(window._ghCountdownTimer); window._ghCountdownTimer = null; }
  if (m.phase === 'pre' && m.startTime && !window._ghCountdownTimer) setTimeout(function () { _ghStartCountdown(m.startTime); }, 0);
  if (m.phase !== 'pre') {
    var seen = {};
    m.highlights.forEach(function (p) { seen[[p.tag, p.time, p.head, p.as, p.hs].join('|')] = true; });
    st.seenPlays = seen;
    st.lastScore = { away: m.away.score, home: m.home.score };
  }
  var modeCls = m.phase === 'live' ? ' gh-m-' + (st.renderMode || 'compact') : (m.phase === 'final' ? ' gh-m-' + (st.finalRenderMode || 'compact') : '');
  var keep = m.sport === 'football' ? ' gh-keep-strip' : '';
  return '<div class="gh' + (animate ? ' gh-anim' : '') + modeCls + keep + '" data-phase="' + m.phase + '" data-sport="' + m.sport + '">' +
    '<div class="gh-orb" style="' + (m.phase === 'live' ? 'right:-90px;top:-40px' : 'left:-80px;top:-30px') + '"></div>' +
    '<div class="gh-body">' + body + '</div></div>';
}

function _gxUrl(sport, gamePk) {
  if (sport === 'nhl') return '/api/nhlgame?mode=gamecast&gameId=' + encodeURIComponent(gamePk);
  // Football carries every drive's plays for the "Every play" card; the
  // other sports have no equivalent, so they don't pay for it.
  var all = (sport === 'nfl' || sport === 'cfb') ? '&plays=all' : '';
  return '/api/espn?league=' + encodeURIComponent(sport) + '&mode=gamecast&eventId=' + encodeURIComponent(gamePk) + all;
}
// Returns a promise → whether the game is live (keeps the 15s poll going).
// Any failure falls back to the old box score card for that game.
function _gxRefresh(gamePk, sport) {
  return fetch(_gxUrl(sport, gamePk))
    .then(function (r) { return r.json(); })
    .then(function (raw) {
      if (!window._activeBrowseGame || window._activeBrowseGame.gamePk != gamePk) return false;
      if (!raw || raw.error || !raw.phase || !raw.away || !raw.home || !raw.away.name) throw new Error((raw && raw.error) || 'empty gamecast');
      if (raw.phase === 'off') { window._gdPregame.gx = null; return _refreshBoxScoreLegacy(gamePk); }
      var m = _gxModel(raw);
      window._gdPregame.gx = m;
      if (m.phase === 'live' || m.phase === 'final') {
        window._gdPregame.boxScoreHtml = _gxDetailHtml(m) + '<div style="height:14px"></div>';
      }
      renderGameCheatSheet();
      return m.phase === 'live';
    })
    .catch(function (err) {
      console.error('[gx] gamecast unavailable, using the classic box score:', err);
      if (window._gdPregame) window._gdPregame.gx = null;
      return _refreshBoxScoreLegacy(gamePk);
    });
}
function _gxRerenderDetail() {
  var gp = window._gdPregame;
  if (!gp || !gp.gx) return;
  if (gp.gx.phase === 'live' || gp.gx.phase === 'final') {
    gp.boxScoreHtml = _gxDetailHtml(gp.gx) + '<div style="height:14px"></div>';
    renderGameCheatSheet();
  }
}
// A re-render replaces the hero's DOM, which would cut its entry animation
// short — so renders triggered by slower side loads (pre-game rosters)
// wait until the hero has finished animating in.
function _gxDeferredRender() {
  var st = window._ghState;
  var wait = st && st.heroAt ? Math.max(0, 2600 - (Date.now() - st.heroAt)) : 0;
  clearTimeout(window._gxRenderTimer);
  if (!wait) { renderGameCheatSheet(); return; }
  window._gxRenderTimer = setTimeout(renderGameCheatSheet, wait);
}
function gxBoxSide(side) { window._gxBox.side = side; _gxRerenderDetail(); }
function gxBoxToggle() { window._gxBox.open = !window._gxBox.open; _gxRerenderDetail(); }
function gxFeedMore() { window._gxFeedAll = !window._gxFeedAll; _gxRerenderDetail(); }

// Box score card options on the game screen when the hero is showing —
// hides the pieces the hero already covers so nothing is shown twice.
function _gameScreenBoxOpts(box) {
  var game = window._activeBrowseGame;
  if (!game || (game.sport || 'mlb') !== 'mlb') return null;
  var model = _ghModelFromMlbBox(box);
  return model ? { hero: model.phase } : null;
}

// Returns a promise resolving to whether the game is currently live
// (worth continuing to poll) — false for scheduled or concluded, which
// the caller uses to decide whether to keep refreshing at all.
function _refreshBoxScore(gamePk) {
  // Non-MLB games use the multi-sport gamecast (hero + detail + box score);
  // _gxRefresh falls back to the classic card below if that fails.
  var gxSport = (window._activeBrowseGame && window._activeBrowseGame.sport) || 'mlb';
  if (gxSport !== 'mlb' && GX_SPORT[gxSport]) return _gxRefresh(gamePk, gxSport);
  return _refreshBoxScoreLegacy(gamePk);
}
function _refreshBoxScoreLegacy(gamePk) {
  var sport = (window._activeBrowseGame && window._activeBrowseGame.sport) || 'mlb';
  // Only the game screen asks MLB for the whole play list (&plays=all).
  // Every other caller of this endpoint ends up sanitizing the response
  // into a Firestore doc when a game gets attached to a memory, and a
  // full game's plays have no business being stored there.
  var url = _bsModalBoxscoreUrl(sport, gamePk) + (sport === 'mlb' ? '&plays=all' : '');
  return fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (box) {
      if (!window._activeBrowseGame || window._activeBrowseGame.gamePk != gamePk) return false;
      return _applyBoxScoreResult(gamePk, sport, box);
    })
    .catch(function (err) { console.error('Load box score error:', err); return false; });
}
// v7.25.0: split out so a delayed box (js/games/game-delay.js) is put on screen the same way
function _applyBoxScoreResult(gamePk, sport, box) {
  // MLB boxes also carry abstractGameState (gameState) — trusted over the
  // detailed status text, which has in-between values like "Game Over".
  var gs = box && box.gameState;
  var concluded = !!box && !box.error && (gs === 'Final' || _isGameConcluded(box.status));
  var live = !!box && !box.error && !concluded && (gs === 'Live' || (gs !== 'Preview' && _isGameStatusLive(box.status)));
  if (!live && !concluded) return false; // not started yet — cheat sheet alone is correct, nothing to prepend
  window._lastLiveBox = box; // cached so toggling the box score detail section can rebuild without a re-fetch
  if (sport === 'mlb' && window._gdPregame) window._gdPregame.heroBox = box; // game-state hero reads this on the next render
  var html = _boxScoreCardHtml(box, true, true, _gameScreenBoxOpts(box));
  if (html) {
    window._gdPregame.boxScoreHtml = html + '<div style="height:14px"></div>';
    renderGameCheatSheet(); // no-op if the cheat sheet itself hasn't loaded yet — it'll pick this up when it does
  }
  // MLB's final summary now lives in the hero card, so the full-screen
  // recap overlay only plays for the other sports.
  if (concluded && sport !== 'mlb') maybePlayGameRecap(box, sport, gamePk);
  return live;
}

// Polls only while a game is actually live AND its screen is the one
// currently on-screen — checked fresh on every tick, so navigating
// away or the game going final both stop it within one interval rather
// than needing an explicit teardown at every possible exit point.
window._gameLiveRefreshTimer = null;
// Football scores move in single snaps and people watch with the game on,
// so the screen trailing the broadcast by half a minute is obvious there
// in a way it isn't for baseball, where the box score barely moves
// between pitches.
function _gameLiveRefreshMs() {
  var sport = (window._activeBrowseGame && window._activeBrowseGame.sport) || 'mlb';
  if (sport === 'mlb' && typeof _gdlFast === 'function' && _gdlFast()) return 3000; // v7.25.0: a delay (or matching your TV) wants finer steps
  return (sport === 'nfl' || sport === 'cfb') ? 8000 : 6000; // v5.85.0: MLB every 6s (was 15s)
}
function _startGameLiveRefresh(gamePk) {
  _stopGameLiveRefresh();
  window._gameLiveRefreshTimer = setInterval(function () {
    var screenEl = document.getElementById('screen-game');
    var stillOnThisGame = window._activeBrowseGame && window._activeBrowseGame.gamePk == gamePk;
    var stillVisible = screenEl && screenEl.classList.contains('active');
    if (!stillOnThisGame || !stillVisible) { _stopGameLiveRefresh(); return; }
    _refreshBoxScore(gamePk).then(function (isLive) { if (!isLive) _stopGameLiveRefresh(); });
  }, _gameLiveRefreshMs());
}
function _stopGameLiveRefresh() {
  if (window._gameLiveRefreshTimer) { clearInterval(window._gameLiveRefreshTimer); window._gameLiveRefreshTimer = null; }
}

function loadGameCheatSheet(gamePk) {
  var el = document.getElementById('game-sheet-panel');
  if (!el) return;
  var sport = (window._activeBrowseGame && window._activeBrowseGame.sport) || 'mlb';
  window._gdPregame = { side: 'away', expand: false, data: null, loadedForGamePk: gamePk, boxScoreHtml: '', heroBox: null, gx: null };
  window._gxBox = { side: 'away', open: true };
  window._gxFeedAll = false;
  _ghResetForGame(gamePk); // fresh hero animations per game open
  window._bsDetailState = { expanded: false, side: 'away' }; // fresh collapsed state each new game — don't carry an expanded table over from the last one
  window._lastLiveBox = null;
  el.innerHTML = '<div style="text-align:center;padding:24px 0;font-size:13px;color:rgba(255,255,255,.4)">Loading…</div>';
  _stopGameLiveRefresh();
  _refreshBoxScore(gamePk).then(function (isLive) {
    if (!window._activeBrowseGame || window._activeBrowseGame.gamePk != gamePk) return;
    // _refreshBoxScore only ever sets boxScoreHtml once the game is live
    // or concluded — its presence is the same signal loadGameCheatSheet
    // needs here: has the game actually started. If so, the box score
    // is all that's needed and the pregame lineup/roster cheat sheet
    // never gets fetched at all, not just hidden underneath it.
    if (window._gdPregame.boxScoreHtml) {
      if (isLive) _startGameLiveRefresh(gamePk);
      return;
    }
    _loadPregameSheet(gamePk, sport);
  });
}

function _loadPregameSheet(gamePk, sport) {
  var el = document.getElementById('game-sheet-panel');
  if (!el) return;

  if (sport !== 'mlb') {
    var _note = function (txt) {
      window._gdPregame.pendingNote = '<div style="text-align:center;padding:24px 16px;font-size:13px;color:rgba(255,255,255,.4);line-height:1.5">' + txt + '</div>';
      if (window._gdPregame.gx) _gxDeferredRender();
      else el.innerHTML = window._gdPregame.pendingNote;
    };
    _note('Loading rosters…');
    var rosterUrl = sport === 'nhl'
      ? '/api/nhlgame?mode=pregame&gameId=' + encodeURIComponent(gamePk)
      : '/api/espn?league=' + encodeURIComponent(sport) + '&mode=pregame&eventId=' + encodeURIComponent(gamePk);
    fetch(rosterUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!window._activeBrowseGame || window._activeBrowseGame.gamePk != gamePk) return;
        if (!data || data.error || !data.away || !data.home) {
          _note('No roster info available for this game yet.');
          return;
        }
        data.league = sport;
        data.away.roster = true;
        data.home.roster = true;
        window._gdPregame.data = data;
        if (window._gdPregame.gx) _gxDeferredRender(); else renderGameCheatSheet();
      })
      .catch(function (err) {
        console.error('Load roster cheat sheet error:', err);
        _note('Couldn\'t load rosters — try again.');
      });
    return;
  }

  el.innerHTML = '<div style="text-align:center;padding:24px 0;font-size:13px;color:rgba(255,255,255,.4)">Loading lineups…</div>';
  fetch('/api/mlb?mode=pregame&gamePk=' + encodeURIComponent(gamePk))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!window._activeBrowseGame || window._activeBrowseGame.gamePk != gamePk) return;
      if (!data || data.error || !data.away || !data.home) {
        el.innerHTML = '<div style="text-align:center;padding:24px 16px;font-size:13px;color:rgba(255,255,255,.4);line-height:1.5">No lineup info available for this game yet.</div>';
        return;
      }
      window._gdPregame.data = data;
      renderGameCheatSheet();
    })
    .catch(function (err) {
      console.error('Load cheat sheet error:', err);
      el.innerHTML = '<div style="text-align:center;padding:24px 16px;font-size:13px;color:rgba(255,255,255,.4);line-height:1.5">Couldn\'t load lineups — try again.</div>';
    });
}

function gameSheetSide(key) {
  window._gdPregame.side = key;
  window._gdPregame.expand = false;
  renderGameCheatSheet();
}

function gameSheetExpand() {
  window._gdPregame.expand = !window._gdPregame.expand;
  renderGameCheatSheet();
}

function renderGameCheatSheet() {
  var el = document.getElementById('game-sheet-panel');
  var state = window._gdPregame;
  if (!el || !state) return;
  // v5.99.0: any re-render while the hero is still animating in (the field
  // outline drawing itself, teams sliding in) replaced its DOM mid-animation
  // and it jumped straight to finished. Every caller now waits for the intro
  // to end; several calls in that window collapse into one render.
  var ist = window._ghState;
  var introLeft = (ist && ist.heroAt) ? 2600 - (Date.now() - ist.heroAt) : 0;
  if (introLeft > 0 && el.querySelector('.gh.gh-anim')) {
    clearTimeout(window._gxRenderTimer);
    window._gxRenderTimer = setTimeout(renderGameCheatSheet, introLeft + 20);
    return;
  }
  var scrollPos = el.scrollTop; // preserved across the innerHTML replace below — otherwise every live-refresh tick would jump the reader back to the top mid-read
  if (!state.data) {
    // No pregame data was ever fetched — either it hasn't loaded yet, or
    // (once the game has started) it was deliberately never requested,
    // since the box score is all that's needed at that point. Either
    // way, show whatever box score HTML exists and stop — there's
    // nothing else to render without state.data.
    if (state.boxScoreHtml) { if (!_ghPatch(el, _ghHtmlForState(state) + state.boxScoreHtml)) el.scrollTop = scrollPos; }
    else if (state.gx) { if (!_ghPatch(el, _ghHtmlForState(state) + (state.pendingNote || ''))) el.scrollTop = scrollPos; }
    return;
  }
  var data = state.data;
  var side = data[state.side];
  if (!side) return;
  var league = data.league || 'mlb';

  var h = _ghHtmlForState(state) + (state.boxScoreHtml || '');
  h += '<div style="display:flex;gap:8px;margin-bottom:12px">';
  ['away', 'home'].forEach(function (k) {
    var s = data[k];
    if (!s) return;
    var active = k === state.side;
    h += '<button onclick="gameSheetSide(\'' + k + '\')" style="flex:1;padding:8px 10px;border-radius:12px;border:none;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;' +
      (active ? 'background:var(--indigo);color:#fff' : 'background:rgba(255,255,255,.08);color:rgba(255,255,255,.6)') +
      '">' + _escapeHtml(s.name) + '</button>';
  });
  h += '</div>';

  if (side.projected) {
    h += '<div style="background:rgba(255,255,255,.06);border-radius:10px;padding:9px 11px;font-size:11.5px;color:rgba(255,255,255,.6);margin-bottom:12px">Lineup not posted yet — showing the active roster instead.</div>';
  }

  var watch = _pregameWatchLine(side);
  if (watch) {
    h += '<div style="background:rgba(168,159,232,.13);border-radius:14px;padding:12px;margin-bottom:12px">' +
      '<div style="font-size:11.5px;color:#CECBF6;display:flex;align-items:center;gap:6px"><i class="ti ti-bulb"></i> If you watch one thing</div>' +
      '<div style="color:#fff;font-size:13.5px;line-height:1.55;margin-top:5px">' + _escapeHtml(watch) + '</div></div>';
  }

  if (side.feat) {
    h += '<div style="background:rgba(255,255,255,.06);border-left:3px solid #A89FE8;border-radius:0 12px 12px 0;padding:12px;margin-bottom:12px">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<span style="flex:1;font-size:13.5px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
      _escapeHtml(side.feat.name) + ' <span style="font-size:11px;color:rgba(255,255,255,.45);font-weight:400">' +
      _escapeHtml(side.feat.role) + (side.feat.age ? ' · ' + side.feat.age : '') + '</span></span>' +
      _cheatSheetLinkChips(side.feat.name, side.feat.id, league) + '</div>' +
      '<div style="color:#CECBF6;font-size:11.5px;margin-top:5px">' + _escapeHtml(side.feat.line) + '</div></div>';
  }

  var rows = side.rows || [];
  var vis = state.expand ? rows : rows.slice(0, 4);
  var marked = _pregameMarkedIdx(side);
  var showOrder = !side.projected && !side.roster;
  h += '<div style="background:rgba(255,255,255,.06);border-radius:14px;overflow:hidden">';
  vis.forEach(function (r, i) {
    var lead = showOrder
      ? '<span style="width:16px;flex:0 0 16px;color:rgba(255,255,255,.45);font-size:12px">' + (i + 1) + '</span>'
      : '<span style="width:28px;flex:0 0 28px;color:rgba(255,255,255,.45);font-size:11px">' + _escapeHtml(r.pos) + '</span>';
    h += '<div style="padding:11px 12px;' + (i === 0 ? '' : 'border-top:.5px solid rgba(255,255,255,.08);') +
      (i === marked ? 'background:rgba(168,159,232,.08)' : '') + '">' +
      '<div style="display:flex;align-items:center;gap:8px">' + lead +
      '<span style="flex:1;min-width:0;font-size:13.5px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
      _escapeHtml(r.name) +
      (showOrder && r.pos ? ' <span style="color:rgba(255,255,255,.45);font-size:11px;font-weight:400">' + _escapeHtml(r.pos) + '</span>' : '') +
      (r.age ? ' <span style="color:rgba(255,255,255,.45);font-size:11px;font-weight:400">' + r.age + '</span>' : '') +
      '</span>' + _cheatSheetLinkChips(r.name, r.id, league) + '</div>' +
      '<div style="color:#CECBF6;font-size:11.5px;margin:5px 0 0">' + _escapeHtml(r.line) + (r.extra ? ' · ' + _escapeHtml(r.extra) : '') + '</div></div>';
  });
  if (rows.length > 4) {
    h += '<button onclick="gameSheetExpand()" style="width:100%;padding:11px;text-align:center;color:#A89FE8;font-size:12.5px;background:none;border:none;border-top:.5px solid rgba(255,255,255,.08);cursor:pointer;font-family:inherit">' +
      (state.expand ? 'Show less' : 'Show ' + (rows.length - 4) + ' more') + '</button>';
  }
  if (!rows.length) {
    h += '<div style="padding:14px 12px;font-size:13px;color:rgba(255,255,255,.5)">No player data available for this game yet.</div>';
  }
  h += '</div>';

  h += '<div style="color:rgba(255,255,255,.45);font-size:11.5px;line-height:1.6;padding:12px 2px">Lavender chips go straight to the player page. Faded chips run a name search instead.</div>';

  if (!_ghPatch(el, h)) el.scrollTop = scrollPos;
}

// ── v7.8.0 · CALMER LIVE REFRESH ─────────────────────────────────────
// Every tick used to throw the whole screen away (innerHTML) and build it
// again: entrance animations replayed, anything mid-animation restarted,
// and when a block above the reader grew or shrank the page jumped under
// them. _ghPatch updates the existing page in place instead: nodes that
// didn't change are left alone (so their animations keep running and the
// browser's scroll anchoring keeps the reader's spot), changed text and
// attributes are edited, and only genuinely new pieces are inserted.
// An element whose animation timing changed, or that carries SVG SMIL
// animation, is swapped whole so time-based animations restart correctly.
// Returns false (caller falls back to its old scroll restore) only if
// patching isn't possible.
function _ghPatch(el, html) {
  // v7.8.2: in-place patching turned OFF — it made the page jump badly on
  // desktop. Back to the full re-render with the old scroll restore
  // (returning false tells the caller to put scrollTop back).
  if (!window.INNINGS_PATCH_ON) { el.innerHTML = html; return false; }
  try {
    if (!el.firstChild) { el.innerHTML = html; return true; }
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    var reduce = typeof _ghReducedMotion === 'function' && _ghReducedMotion();
    var er = el.getBoundingClientRect();
    var viewTop = Math.max(er.top, 0), viewBot = Math.min(er.bottom, window.innerHeight || er.bottom);
    // 1. What the reader is looking at: the element just below the top of
    //    the view. It must end up exactly where it was.
    var anchor = null, before = 0;
    if (document.elementFromPoint) {
      var hit = document.elementFromPoint(er.left + er.width / 2, viewTop + 60);
      if (hit && el.contains(hit) && hit !== el) { anchor = hit; before = hit.getBoundingClientRect().top; }
    }
    // 2. Where every block sits now (for gliding moved ones afterwards)
    var blocks = reduce ? [] : Array.prototype.slice.call(el.querySelectorAll(_GH_BLOCKS));
    var was = new Map();
    blocks.forEach(function (b) { var r = b.getBoundingClientRect(); if (r.bottom > viewTop - 200 && r.top < viewBot + 200) was.set(b, r.top); });
    // 3. Patch in place; new nodes are collected
    _ghAdded = [];
    _ghMorphChildren(el, tpl.content);
    var added = _ghAdded; _ghAdded = null;
    // 4. New pieces at or below the view start folded shut and open up;
    //    ones above the view go in at full size (the anchor fix hides them)
    var grow = [];
    if (!reduce) added.forEach(function (n) {
      if (n.nodeType !== 1 || !n.isConnected) return;
      for (var p = n.parentNode; p && p !== el; p = p.parentNode) { if (added.indexOf(p) !== -1) return; } // parent already growing
      var r = n.getBoundingClientRect();
      if (r.height < 2 || r.bottom <= viewTop + 1) return;
      n.style.overflow = 'hidden'; n.style.height = '0px'; n.style.opacity = '0';
      grow.push({ n: n, h: r.height });
    });
    // 5. Keep the anchor still
    if (anchor && anchor.isConnected) {
      var moved = anchor.getBoundingClientRect().top - before;
      if (Math.abs(moved) > 1) el.scrollTop += moved;
    }
    // 6. Anything else that shifted glides from its old spot to its new one
    //    (only the outermost block of a group that moved together)
    var moves = [];
    was.forEach(function (top, b) {
      if (!b.isConnected) return;
      var dy = top - b.getBoundingClientRect().top;
      if (Math.abs(dy) < 2 || Math.abs(dy) > 600) return;
      moves.push({ b: b, dy: dy });
    });
    moves = moves.filter(function (m) {
      for (var p = m.b.parentNode; p && p !== el; p = p.parentNode) {
        for (var j = 0; j < moves.length; j++) if (moves[j].b === p && Math.abs(moves[j].dy - m.dy) < 2) return false;
      }
      return true;
    });
    moves.forEach(function (m) { m.b.style.transition = 'none'; m.b.style.transform = 'translateY(' + m.dy.toFixed(1) + 'px)'; });
    if (moves.length || grow.length) {
      void el.offsetHeight; // commit the starting positions
      requestAnimationFrame(function () {
        moves.forEach(function (m) {
          m.b.style.transition = 'transform .38s cubic-bezier(.22,1,.36,1)'; m.b.style.transform = '';
          setTimeout(function () { m.b.style.transition = ''; }, 420);
        });
        grow.forEach(function (g) {
          g.n.style.transition = 'height .38s cubic-bezier(.22,1,.36,1), opacity .3s ease .08s';
          g.n.style.height = g.h + 'px'; g.n.style.opacity = '1';
          setTimeout(function () { g.n.style.height = ''; g.n.style.overflow = ''; g.n.style.opacity = ''; g.n.style.transition = ''; }, 440);
        });
      });
    }
    return true;
  } catch (e) {
    console.error('[patch] falling back to full render', e);
    _ghAdded = null;
    el.innerHTML = html;
    return false;
  }
}
// Blocks that glide when they move (cards, rows, the count, the strip…)
var _GH_BLOCKS = '.gh-card,.gh-detail>*,[data-k],.np-card,.np-chips,.np-mix,.bbc,.pa-sc,.pa-lab,.gh-plays-row';
var _ghAdded = null;
var _GH_SMIL = /^(animate|animateMotion|animateTransform|set)$/i;
function _ghHasSmil(n) { return n.nodeType === 1 && (_GH_SMIL.test(n.nodeName) || !!(n.querySelector && n.querySelector('animate,animateMotion,animateTransform,set'))); }
function _ghKeyOf(n) { return n && n.nodeType === 1 ? n.getAttribute('data-k') : null; }
// Children are matched by data-k when they have one (a new pitch goes in at
// the top instead of rewriting every row), otherwise by position.
function _ghMorphChildren(from, to) {
  var b = Array.prototype.slice.call(to.childNodes);
  var keyed = {};
  Array.prototype.forEach.call(from.childNodes, function (c) { var k = _ghKeyOf(c); if (k) keyed[k] = c; });
  for (var i = 0; i < b.length; i++) {
    var nn = b[i], cur = from.childNodes[i] || null, k = _ghKeyOf(nn);
    if (k) {
      var match = keyed[k];
      if (match) {
        delete keyed[k];
        if (match !== cur) { from.insertBefore(match, cur); cur = match; }
        _ghMorphNode(from, cur, nn);
      } else {
        var fresh = nn.cloneNode(true);
        from.insertBefore(fresh, cur);
        if (_ghAdded) _ghAdded.push(fresh);
      }
      continue;
    }
    if (!cur) { var c2 = nn.cloneNode(true); from.appendChild(c2); if (_ghAdded) _ghAdded.push(c2); continue; }
    if (_ghKeyOf(cur)) { var c3 = nn.cloneNode(true); from.insertBefore(c3, cur); if (_ghAdded) _ghAdded.push(c3); continue; }
    _ghMorphNode(from, cur, nn);
  }
  while (from.childNodes.length > b.length) from.removeChild(from.lastChild);
}
function _ghMorphNode(parent, on, nn) {
  if (on.isEqualNode(nn)) return;
  if (on.nodeType !== nn.nodeType || on.nodeName !== nn.nodeName) { parent.replaceChild(nn.cloneNode(true), on); return; }
  if (on.nodeType === 3 || on.nodeType === 8) { if (on.nodeValue !== nn.nodeValue) on.nodeValue = nn.nodeValue; return; }
  if (on.nodeType !== 1) { parent.replaceChild(nn.cloneNode(true), on); return; }
  var os = on.getAttribute('style') || '', ns = nn.getAttribute('style') || '';
  var animChanged = os !== ns && /animation/.test(os + ns);
  if (animChanged || _ghHasSmil(on) || _ghHasSmil(nn)) { parent.replaceChild(nn.cloneNode(true), on); return; }
  // attributes (a glide/grow in progress owns transform/height inline — the
  // renderer never sets those, so leave style alone when only they differ)
  var oa = on.attributes, na = nn.attributes, k;
  for (k = oa.length - 1; k >= 0; k--) { if (!nn.hasAttribute(oa[k].name) && !(oa[k].name === 'style' && _ghOnlyMotionStyle(on))) on.removeAttribute(oa[k].name); }
  for (k = 0; k < na.length; k++) { if (on.getAttribute(na[k].name) !== na[k].value) on.setAttribute(na[k].name, na[k].value); }
  // Slots other code fills after each render (play reactions, the play
  // animation, its label/strip): keep what's there instead of blanking it
  // for a moment — the filler overwrites it right after.
  if (!nn.firstChild && on.firstChild && /^(play-react-|gh-pa-|reel)/.test(on.id || '')) return;
  _ghMorphChildren(on, nn);
}
function _ghOnlyMotionStyle(n) { return /^(\s*(transform|transition|height|overflow|opacity)\s*:[^;]*;?)*\s*$/.test(n.getAttribute('style') || ''); }
