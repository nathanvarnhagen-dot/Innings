// ═══ FOOTBALL BROADCAST LAYOUT (v7.2.0) ══════════════════════════════
var FBB_BALL = '<svg class="fbb-ball" viewBox="0 0 24 14" role="img" aria-label="Has the ball"><ellipse cx="12" cy="7" rx="11" ry="6.2" fill="#8B4A22" stroke="#5A2C10" stroke-width="1"/><path d="M8 7h8M10 5.3v3.4M12 5.3v3.4M14 5.3v3.4" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/><path d="M2.6 5.2a11 6 0 0 0 0 3.6M21.4 5.2a11 6 0 0 1 0 3.6" fill="none" stroke="#fff" stroke-width=".9" opacity=".8"/></svg>';
// Timeouts left, as three bars under a team (the one just used burns out)
function _fbbTimeoutsHtml(m, side) {
  var s = m.situation; if (!s) return '';
  var n = side === 'a' ? s.timeoutsA : s.timeoutsH; if (n == null) return '';
  var fx = window._fbx, burn = fx && fx.burn && fx.burn.side === side && Date.now() - fx.burn.at < 3000 ? fx.burn : null;
  var h = '';
  for (var i = 0; i < 3; i++) h += '<i class="' + (i < n ? '' : 'u') + (burn && i === n ? ' burn' : '') + '"' + (burn && i === n ? ' style="--t0:' + (-(Date.now() - burn.at)) + 'ms"' : '') + '></i>';
  return '<div class="fbb-to" role="img" aria-label="' + n + (n === 1 ? ' timeout' : ' timeouts') + ' left">' + h + '</div>';
}
function _fbbSecs(v) { var mm = String(v || '').match(/^(\d+):(\d{2})$/); return mm ? Number(mm[1]) * 60 + Number(mm[2]) : null; }
// Time of possession as one bar in team colors, a percentage at each end
function _fbbPossHtml(m) {
  var row = (m.teamStats || []).filter(function (r) { return r[0] === 'Possession'; })[0];
  var a = row ? _fbbSecs(row[1]) : null, h = row ? _fbbSecs(row[2]) : null;
  if ((a == null || h == null || a + h <= 0) && m.possession) { a = m.possession.a; h = m.possession.h; }
  if (a == null || h == null || a + h <= 0) return '';
  var fmt = function (x) { return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
  if (!row) row = ['Possession', fmt(a), fmt(h)];
  var ap = Math.round(a / (a + h) * 100), hp = 100 - ap;
  var ac = m.away.colors.accent || m.away.colors.bg, hc = m.home.colors.accent || m.home.colors.bg;
  return '<div class="fbb-poss" role="img" aria-label="Time of possession: ' + _escapeHtml(m.away.abbr) + ' ' + _escapeHtml(row[1]) + ', ' + _escapeHtml(m.home.abbr) + ' ' + _escapeHtml(row[2]) + '">' +
    '<b style="color:' + ac + '">' + ap + '%</b><div class="bar"><i style="width:' + ap + '%;background:' + ac + '"></i><i style="width:' + hp + '%;background:' + hc + '"></i></div><b style="color:' + hc + '">' + hp + '%</b></div>';
}
// Down & distance in the middle, the football on the side with the ball,
// where the ball is on the other side
function _fbbDownHtml(m) {
  var s = m.situation; if (!s || !s.downText) return '';
  var parts = String(s.downText).split(/\s+at\s+/i);
  var dd = parts[0], spot = parts[1] || '';
  var left = s.possSide === 'a', right = s.possSide === 'h';
  var spotHtml = spot ? '<span class="yl">' + _escapeHtml(spot) + '</span>' : '';
  var mid = '<span class="dd">' + _escapeHtml(dd) + '</span>';
  return '<div class="fbb-down">' +
    '<span class="side">' + (left ? FBB_BALL : spotHtml) + (s.redZone && left ? '<span class="fbb-rz">RED ZONE</span>' : '') + '</span>' + mid +
    '<span class="side r">' + (s.redZone && right ? '<span class="fbb-rz">RED ZONE</span>' : '') + (right ? FBB_BALL : (left ? spotHtml : '')) + '</span></div>';
}
// Split a play-by-play sentence into who / what / yards / tacklers
function _fbbParts(text) {
  var t = String(text || '').replace(/^\((?:Shotgun|No Huddle|No Huddle, Shotgun|Shotgun, No Huddle)\)\s*/i, '').trim();
  var tk = '', mt = t.match(/\(([^()]+)\)\.?\s*$/);
  if (mt) { tk = mt[1]; t = t.slice(0, mt.index).trim(); }
  t = t.replace(/\.$/, '');
  var yds = null, my = t.match(/for (-?\d+) yards?/i) || t.match(/for a loss of (\d+) yards?/i);
  if (my) yds = /loss/i.test(my[0]) ? -Number(my[1]) : Number(my[1]);
  else if (/for no gain/i.test(t)) yds = 0;
  var kind = /touchdown/i.test(t) ? 'td' : /penalty/i.test(t) ? 'pen' : /\bpass\b|sacked/i.test(t) ? 'pass' : /punt|kicks|field goal|extra point/i.test(t) ? 'kick' : /timeout/i.test(t) ? 'to' : /\b(left|right|up the middle|middle|end|tackle|guard|scrambles|kneels|rush)/i.test(t) ? 'run' : null;
  var who = '', what = t;
  var pm = t.match(/^([A-Z][A-Za-z.'\-]+(?:\s[A-Z][A-Za-z'\-]+)?)\s+pass\s+(?:\w+\s+){0,2}?(?:(?:short|deep)\s+(?:left|right|middle)\s+)?(?:to|intended for)\s+([A-Z][A-Za-z.'\-]+)/);
  if (pm) {
    who = pm[1] + ' \u2192 ' + pm[2];
    what = t.slice(pm[1].length).replace(/^\s*pass\s*/i, '').replace(/\s*for (-?\d+) yards?.*$/i, '').replace(/\s*for no gain.*$/i, '');
    what = what.replace(new RegExp('\\s*(?:to|intended for)\\s+' + pm[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), ''); // the receiver is already in "who"
  }
  else {
    var nm = t.match(/^([A-Z][A-Za-z]{0,2}\.[A-Za-z'\-]+|[A-Z][A-Za-z'\-]+ [A-Z][A-Za-z'\-]+)\s/);
    if (nm && kind !== 'pen' && kind !== 'to') { who = nm[1]; what = t.slice(nm[0].length).replace(/\s*for (-?\d+) yards?.*$/i, '').replace(/\s*for a loss.*$/i, '').replace(/\s*for no gain.*$/i, ''); }
  }
  what = what.replace(/^pass\s+/i, '').trim();
  what = what.charAt(0).toUpperCase() + what.slice(1);
  return { who: who, what: what, yds: yds, kind: kind, tk: tk };
}
function _fbbChip(k) { var L = { run: 'RUN', pass: 'PASS', pen: 'PEN', kick: 'KICK', td: 'TD', to: 'TIMEOUT' }[k]; return L ? '<span class="fbb-chip ' + k + '">' + L + '</span>' : ''; }
function _fbbGain(y) { if (y == null) return ''; return '<span class="g ' + (y > 0 ? 'pos' : y < 0 ? 'neg' : 'zero') + '">' + (y > 0 ? '+' : '') + y + '</span>'; }
// "3 plays, 20 yards, 1:16" → the three numbers
function _fbbDriveNums(summary) {
  var t = String(summary || ''), p = t.match(/(\d+)\s*plays?/i), y = t.match(/(-?\d+)\s*yards?/i), c = t.match(/(\d+:\d{2})/);
  return { plays: p ? p[1] : null, yds: y ? y[1] : null, time: c ? c[1] : null };
}
function _fbbDriveCardHtml(m) {
  var d = m.drive; if (!d || !d.plays || !d.plays.length) return '';
  var ids = [];
  var rows = d.plays.map(function (p, i) { if (p.id != null && m.gameId != null) ids.push(m.gameId + '_' + p.id); return _fbbPlayRowHtml(m, p, i === 0); }).join('');
  if (ids.length) setTimeout(function () { _loadPlayReactions(ids); }, 0);
  var n = _fbbDriveNums(d.summary);
  var tm = d.team && (String(d.team) === String(m.away.abbr) ? m.away : String(d.team) === String(m.home.abbr) ? m.home : null);
  var nums = [[n.plays, 'PLAYS'], [n.yds, 'YDS'], [n.time && n.time !== '0:00' ? n.time : null, 'TIME']].filter(function (x) { return x[0] != null; });
  return '<div class="gh-card gh-up" style="' + _ghDelay(.4) + '"><div class="fbb-dh"><div class="tt"><span class="gh-eyebrow">Current drive</span><b>' + (tm ? '<span class="gh-badge" style="width:22px;height:22px;font-size:7.5px;background:' + tm.colors.bg + ';color:' + tm.colors.fg + '">' + _escapeHtml(tm.abbr) + '</span>' : '') + _escapeHtml(tm ? tm.short || tm.abbr : (d.team || '')) + '</b></div>' +
    (nums.length ? '<div class="nums">' + nums.map(function (x) { return '<div><b>' + _escapeHtml(x[0]) + '</b><span>' + x[1] + '</span></div>'; }).join('') + '</div>' : (d.summary ? '<span class="gh-sub">' + _escapeHtml(d.summary) + '</span>' : '')) + '</div>' + rows + '</div>';
}
// One drive play: down on the left, chip + who, a short line, the yards —
// same double-tap reactions, reply, rule chip and reactions row as before
function _fbbPlayRowHtml(m, p, first) {
  var playId = (p.id != null && m.gameId != null) ? (m.gameId + '_' + p.id) : null;
  var tag = p.tag || '';
  var P = _fbbParts(p.text);
  if (p.scoring && !P.kind) P.kind = 'td';
  var attrs = playId ? ' onclick="_playDoubleTap(this,\'' + playId + '\',this.dataset.rtag,this.dataset.rtext)" data-rtag="' + _escapeHtml(tag) + '" data-rtext="' + _escapeHtml(p.text) + '"' : '';
  return '<div class="gh-plays-row' + (first ? ' fbb-now' : '') + '"' + attrs + ' style="' + (first ? 'border-top:0;' : '') + 'padding:0">' +
    '<div class="fbb-pr"><span class="dn">' + _escapeHtml(tag) + '</span><div class="w"><div class="a">' + _fbbChip(P.kind) + '<span class="n">' + _escapeHtml(P.who || P.what) + '</span></div>' +
    (P.who ? '<div class="b">' + _escapeHtml(P.what) + '</div>' : '') + '</div>' + _fbbGain(P.yds) +
    '<button class="gh-reply" aria-label="Reply to this play" data-tag="' + _escapeHtml(tag) + '" data-text="' + _escapeHtml(p.text) + '" onclick="event.stopPropagation();_replyToPlay(this.dataset.tag,this.dataset.text)">' +
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14l-4-4 4-4"/><path d="M5 10h11a4 4 0 0 1 4 4v6"/></svg></button></div>' +
    (typeof _ruleChipHtml === 'function' ? _ruleChipHtml(m.league, p.text) : '') +
    (playId ? '<div id="play-react-' + _escapeHtml(playId) + '"></div>' : '') + '</div>';
}
