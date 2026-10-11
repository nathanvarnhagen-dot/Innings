// ═══ FOOTBALL AT A GLANCE (v7.34.0) ═══════════════════════════════════
// The bottom of the live football cheat sheet, in place of the old Leaders
// card (which still shows if this data isn't there):
//   · Quarterbacks — both passers side by side: yards, completions, how
//     much of the bar is completion rate, TD and INT
//   · three small tiles — longest play, takeaways, 3rd down
//   · one card with a switch: Offense (rushing, receiving, kicking leaders),
//     Defense (each side's top three tacklers) and Team (total, passing and
//     rushing yards, sacks, time of possession)
// Every name opens that player's card. Data: m.glance (/api/espn gamecast,
// read off ESPN's full box score), m.leaders, m.teamStats, m.possession.
// Depends on: _escapeHtml, _ghHexAlpha, _ghLastName, openPlayerLinkSheet.
window._fbgTab = window._fbgTab || 'offense';

function _fbgTap(p, league) {
  if (!p || !p.name) return '';
  return ' role="button" tabindex="0" data-name="' + _escapeHtml(p.name) + '" data-id="' + _escapeHtml(String(p.id || '')) + '" data-league="' + _escapeHtml(league || '') + '"' +
    ' onclick="event.stopPropagation();openPlayerLinkSheet(this.dataset.name,this.dataset.id||null,this.dataset.league)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();this.click();}"';
}
function _fbgChip(t) {
  var c = (t.colors && t.colors.accent) || '#A89FE8';
  return '<span class="fbg-chip" style="background:' + _ghHexAlpha(c, .18) + ';color:' + c + '">' + _escapeHtml(t.abbr || '') + '</span>';
}
function _fbgAcc(t) { return (t.colors && t.colors.accent) || '#A89FE8'; }
function _fbgShow(v) { return v == null || v === '' ? '—' : String(v); }
// which side is ahead: 'a', 'h', 'both' (level) or '' (can't say)
function _fbgLead(a, h) {
  if (a == null || h == null || !isFinite(a) || !isFinite(h)) return a != null && isFinite(a) ? 'a' : (h != null && isFinite(h) ? 'h' : '');
  return a > h ? 'a' : (h > a ? 'h' : 'both');
}
function _fbgIs(lead, side) { return lead === side || lead === 'both'; }
// bar lengths out of 90%, the bigger one full
function _fbgW(a, h) {
  var x = Math.max(0, Number(a) || 0), y = Math.max(0, Number(h) || 0), mx = Math.max(x, y);
  if (!mx) return [0, 0];
  var w = function (v) { return v ? Math.max(6, Math.round(v / mx * 90)) : 0; };
  return [w(x), w(y)];
}
// "5 CAR, 33 YDS, 1 TD" → "5 carries · 1 TD" (the yards are the big number)
function _fbgLine(line) {
  return String(line || '').split(/,\s*/).filter(function (x) { return x && !/\bYDS$/i.test(x); }).map(function (x) {
    var m = x.match(/^(\d+)\s+(CAR|REC)$/i);
    if (!m) return x;
    var n = Number(m[1]);
    return n + (m[2].toUpperCase() === 'CAR' ? (n === 1 ? ' carry' : ' carries') : (n === 1 ? ' catch' : ' catches'));
  }).join(' · ');
}

// ── quarterbacks
function _fbgQbCol(m, t, q) {
  if (!q || !q.name) return '<div class="fbg-qbc"><div class="fbg-qbn">' + _fbgChip(t) + '<span class="nm none">No passes yet</span></div></div>';
  var pct = q.att ? Math.max(0, Math.min(100, Math.round((q.cmp || 0) / q.att * 100))) : 0;
  var td = q.td || 0, it = q.int || 0;
  return '<div class="fbg-qbc tap"' + _fbgTap(q, m.league) + '>' +
    '<div class="fbg-qbn">' + _fbgChip(t) + '<span class="nm">' + _escapeHtml(q.name) + '</span></div>' +
    '<div class="fbg-big">' + _escapeHtml(_fbgShow(q.yds)) + '<small>YDS</small></div>' +
    '<div class="fbg-sub">' + (q.att != null ? _escapeHtml((q.cmp != null ? q.cmp : '—') + ' of ' + q.att) : '') + (q.avg ? ' · ' + _escapeHtml(String(q.avg)) + ' a throw' : '') + '</div>' +
    '<div class="fbg-track" role="img" aria-label="' + pct + ' percent completed"><i style="width:' + pct + '%;background:' + _fbgAcc(t) + '"></i></div>' +
    '<div class="fbg-pills"><span class="' + (td > 0 ? 'td' : '') + '">' + td + ' TD</span><span class="' + (it > 0 ? 'int' : '') + '">' + it + ' INT</span></div></div>';
}

// ── the three small tiles
function _fbgStatRow(m, label) { return (m.teamStats || []).filter(function (r) { return r[0] === label; })[0] || null; }
function _fbgDuoTile(m, title, aTxt, hTxt, lead) {
  var line = function (t, txt, on) { return '<span class="r"><b style="color:' + _fbgAcc(t) + '">' + _escapeHtml(t.abbr || '') + '</b><em class="' + (on ? 'lead' : '') + '">' + _escapeHtml(_fbgShow(txt)) + '</em></span>'; };
  return '<div class="fbg-mt"><span class="k">' + title + '</span>' + line(m.away, aTxt, _fbgIs(lead, 'a')) + line(m.home, hTxt, _fbgIs(lead, 'h')) + '</div>';
}
function _fbgMiniHtml(m, g) {
  var h = '';
  var la = g.a && g.a.long, lh = g.h && g.h.long;
  var lg = la && lh ? (lh.yds > la.yds ? lh : la) : (la || lh), lt = lg === lh && lh ? m.home : m.away;
  if (lg && lg.yds > 0) {
    h += '<div class="fbg-mt tap"' + _fbgTap(lg, m.league) + ' aria-label="Longest play: ' + _escapeHtml(lg.name) + ', ' + lg.yds + ' yard ' + lg.kind + '">' +
      '<span class="k">LONGEST PLAY</span><span class="v">' + lg.yds + '<small>YDS</small></span>' +
      '<span class="w" style="color:' + _fbgAcc(lt) + '">' + _escapeHtml(_ghLastName(lg.name) || lg.name) + '</span></div>';
  }
  var to = _fbgStatRow(m, 'Turnovers');
  // your takeaways are the other side's turnovers
  if (to && to[3] != null && to[4] != null) h += _fbgDuoTile(m, 'TAKEAWAYS', to[4], to[3], _fbgLead(to[4], to[3]));
  var td = _fbgStatRow(m, '3rd down');
  if (td) h += _fbgDuoTile(m, '3RD DOWN', String(td[1]).replace('-', '/'), String(td[2]).replace('-', '/'), _fbgLead(td[3], td[4]));
  return h ? '<div class="fbg-mini">' + h + '</div>' : '';
}

// ── Offense: two players head to head
function _fbgDuel(m, label, A, H) {
  if (!A && !H) return '';
  var av = A && A.value != null ? Number(A.value) : null, hv = H && H.value != null ? Number(H.value) : null;
  var lead = _fbgLead(av, hv), w = _fbgW(av, hv);
  var who = function (p, right) {
    if (!p || !p.name) return '<div class="p' + (right ? ' r' : '') + '"><b>—</b><span>&nbsp;</span></div>';
    return '<div class="p tap' + (right ? ' r' : '') + '"' + _fbgTap(p, m.league) + '><b>' + _escapeHtml(p.name) + '</b><span>' + (p.sub ? _escapeHtml(p.sub) : '&nbsp;') + '</span></div>';
  };
  return '<div class="fbg-duel"><div class="who">' + who(A, false) + who(H, true) + '</div>' +
    '<div class="fbg-bar"><em class="' + (_fbgIs(lead, 'a') ? 'lead' : '') + '">' + _fbgShow(av) + '</em>' +
    '<div class="trk l"><i class="' + (_fbgIs(lead, 'a') ? 'lead' : '') + '" style="width:' + w[0] + '%;background:' + _fbgAcc(m.away) + '"></i></div>' +
    '<span class="lb">' + label + '</span>' +
    '<div class="trk"><i class="' + (_fbgIs(lead, 'h') ? 'lead' : '') + '" style="width:' + w[1] + '%;background:' + _fbgAcc(m.home) + '"></i></div>' +
    '<em class="' + (_fbgIs(lead, 'h') ? 'lead' : '') + '">' + _fbgShow(hv) + '</em></div></div>';
}
function _fbgOffenseHtml(m, g) {
  var ld = function (label) {
    var r = (m.leaders || []).filter(function (x) { return x.label === label; })[0];
    var p = function (x) { return x && x.name ? { name: x.name, id: x.id, value: x.value, sub: _fbgLine(x.line) } : null; };
    return r ? [p(r.a), p(r.h)] : [null, null];
  };
  var kick = function (k) {
    if (!k || !k.name) return null;
    var tried = k.fg && !/^0\s*\/\s*0$/.test(String(k.fg));
    var sub = tried ? k.fg + ' FG' + (k.long ? ' · long ' + k.long : '') : (k.xp ? k.xp + ' extra points' : '');
    return { name: k.name, id: k.id, value: k.pts != null ? k.pts : 0, sub: sub };
  };
  var ru = ld('RUSH'), re = ld('REC');
  return _fbgDuel(m, 'RUSH YDS', ru[0], ru[1]) + _fbgDuel(m, 'REC YDS', re[0], re[1]) + _fbgDuel(m, 'KICK PTS', kick(g.a && g.a.kick), kick(g.h && g.h.kick));
}

// ── Defense: each side's top three tacklers
function _fbgDefenseHtml(m, g) {
  var table = function (t, list) {
    if (!list || !list.length) return '';
    var c = function (v) { return '<span class="' + (v ? '' : 'z') + '">' + (v == null ? '–' : v) + '</span>'; };
    return '<div class="fbg-dt"><div class="fbg-dr h"><span>' + _fbgChip(t) + '</span><span>TKL</span><span>SACK</span><span>TFL</span><span>PD</span></div>' +
      list.map(function (d) {
        return '<div class="fbg-dr tap"' + _fbgTap(d, m.league) + '><span>' + _escapeHtml(d.name) + '</span>' + c(d.tkl) + c(d.sack) + c(d.tfl) + c(d.pd) + '</div>';
      }).join('') + '</div>';
  };
  return table(m.away, g.a && g.a.def) + table(m.home, g.h && g.h.def);
}

// ── Team: the two sides head to head
function _fbgTeamRow(m, label, aTxt, hTxt, aNum, hNum) {
  if (aTxt == null || hTxt == null) return '';
  var lead = _fbgLead(aNum, hNum), w = _fbgW(aNum, hNum);
  return '<div class="fbg-tr"><div class="n"><em class="' + (_fbgIs(lead, 'a') ? 'lead' : '') + '">' + _escapeHtml(String(aTxt)) + '</em><span>' + label + '</span><em class="' + (_fbgIs(lead, 'h') ? 'lead' : '') + '">' + _escapeHtml(String(hTxt)) + '</em></div>' +
    '<div class="b"><div><i class="' + (_fbgIs(lead, 'a') ? 'lead' : '') + '" style="width:' + w[0] + '%;background:' + _fbgAcc(m.away) + '"></i></div><div><i class="' + (_fbgIs(lead, 'h') ? 'lead' : '') + '" style="width:' + w[1] + '%;background:' + _fbgAcc(m.home) + '"></i></div></div></div>';
}
function _fbgTeamHtml(m, g) {
  var h = '';
  var ty = _fbgStatRow(m, 'Total yds');
  if (ty) h += _fbgTeamRow(m, 'TOTAL YARDS', ty[1], ty[2], ty[3], ty[4]);
  var ra = g.a ? g.a.rush : null, rh = g.h ? g.h.rush : null;
  // passing is what's left of the total once rushing is taken out (sack yards already off it)
  if (ty && ra != null && rh != null && ty[3] != null && ty[4] != null) h += _fbgTeamRow(m, 'PASSING', Math.round(ty[3] - ra), Math.round(ty[4] - rh), ty[3] - ra, ty[4] - rh);
  if (ra != null && rh != null) h += _fbgTeamRow(m, 'RUSHING', ra, rh, ra, rh);
  var sa = g.a ? g.a.sacks : null, sh = g.h ? g.h.sacks : null;
  if (sa != null && sh != null) h += _fbgTeamRow(m, 'SACKS', sa, sh, sa, sh);
  var po = _fbgStatRow(m, 'Possession');
  if (po) h += _fbgTeamRow(m, 'TIME OF POSSESSION', po[1], po[2], po[3], po[4]);
  else if (m.possession && m.possession.a != null && m.possession.h != null) {
    var f = function (x) { return Math.floor(x / 60) + ':' + String(Math.round(x) % 60).padStart(2, '0'); };
    h += _fbgTeamRow(m, 'TIME OF POSSESSION', f(m.possession.a), f(m.possession.h), m.possession.a, m.possession.h);
  }
  return h ? '<div class="fbg-th">' + _fbgChip(m.away) + _fbgChip(m.home) + '</div>' + h : '';
}

function _fbgHtml(m) {
  var g = m && m.glance;
  if (!g || (!g.a && !g.h) || !m.away || !m.home) return '';
  var out = '';
  if ((g.a && g.a.qb) || (g.h && g.h.qb)) {
    out += '<div class="gh-card fbg-qb"><div class="gh-card-head"><span class="gh-eyebrow">Quarterbacks</span></div>' +
      '<div class="fbg-qbg">' + _fbgQbCol(m, m.away, g.a && g.a.qb) + _fbgQbCol(m, m.home, g.h && g.h.qb) + '</div></div>';
  }
  out += _fbgMiniHtml(m, g);
  var panels = [['offense', 'Offense', _fbgOffenseHtml(m, g)], ['defense', 'Defense', _fbgDefenseHtml(m, g)], ['team', 'Team', _fbgTeamHtml(m, g)]].filter(function (p) { return p[2]; });
  if (panels.length) {
    var tab = window._fbgTab;
    if (!panels.some(function (p) { return p[0] === tab; })) tab = panels[0][0];
    out += '<div class="gh-card fbg-card" data-tab="' + tab + '">' +
      (panels.length > 1 ? '<div class="fbg-seg" role="group" aria-label="Which stats to show">' + panels.map(function (p) {
        return '<button type="button" data-k="' + p[0] + '" aria-pressed="' + (p[0] === tab) + '" onclick="fbgTab(\'' + p[0] + '\')">' + p[1] + '</button>';
      }).join('') + '</div>' : '') +
      panels.map(function (p) { return '<div class="fbg-p" data-p="' + p[0] + '">' + p[2] + '</div>'; }).join('') + '</div>';
  }
  return out ? '<div class="fbg">' + out + '</div>' : '';
}

// Switching views changes what's on screen right away; the saved copy of the
// page (what the next redraw puts back) is rebuilt so it opens on the same view.
function fbgTab(k) {
  window._fbgTab = k;
  document.querySelectorAll('.fbg-card').forEach(function (card) {
    card.setAttribute('data-tab', k);
    card.querySelectorAll('.fbg-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-k') === k)); });
  });
  var gp = window._gdPregame;
  if (gp && gp.gx && gp.boxScoreHtml && typeof _gxDetailHtml === 'function') {
    try { gp.boxScoreHtml = _gxDetailHtml(gp.gx) + '<div style="height:14px"></div>'; } catch (e) { console.error('[football glance]', e); }
  }
}
