// ═══ PLAYS TAB (v7.12.0) ═══════════════════════════════════════════════
// The whole game's play by play moved off the cheat sheet into its own tab
// (MLB). The cheat sheet keeps the half-inning being played, with an
// "All plays" button that lands here.
//
// Only one copy of the play rows is ever on the page: while this tab is up
// the cheat sheet leaves its half-inning out, and when it's down this panel
// is emptied. Play rows carry ids (reactions, the inline replay finds its
// row by them), so two copies would send reactions to the hidden one.
window._gdPlaysOn = false;

function _gdPlaysMlb() {
  var g = window._activeBrowseGame;
  return !!(g && (g.sport || 'mlb') === 'mlb');
}

// A one-line score strip at the top of the tab (the slim score bar only
// runs on the cheat sheet)
function _gdPlaysStripHtml(m, box) {
  var s = (box && box.situation) || {};
  var mid;
  if (m.phase === 'final') mid = 'FINAL';
  else if (!s.inning) mid = 'LIVE';
  else if (s.outs === 3) mid = (s.half === 'top' ? 'MID ' : 'END ') + _ordinalSuffix(s.inning).toUpperCase();
  else mid = '<span class="tri" aria-hidden="true">' + (s.half === 'top' ? '▲' : '▼') + '</span>' + (s.half === 'top' ? 'TOP ' : 'BOT ') + s.inning +
    ' · ' + (s.outs || 0) + ' OUT · ' + (s.balls != null ? s.balls : 0) + '–' + (s.strikes != null ? s.strikes : 0);
  var team = function (t) { return '<span class="apl-ab" style="color:' + t.colors.accent + '">' + _escapeHtml(t.abbr) + '</span><b>' + (t.score != null ? t.score : '–') + '</b>'; };
  return '<div class="apl-pstrip" role="status">' + team(m.away) + '<span class="mid">' + mid + '</span>' +
    '<b>' + (m.home.score != null ? m.home.score : '–') + '</b><span class="apl-ab" style="color:' + m.home.colors.accent + '">' + _escapeHtml(m.home.abbr) + '</span></div>';
}

function _gdPlaysRender() {
  var el = document.getElementById('game-plays-panel');
  if (!el) return;
  if (!window._gdPlaysOn) { if (el.firstChild) el.innerHTML = ''; return; }
  var gp = window._gdPregame, box = gp && gp.heroBox;
  var m = box && typeof _ghModelFromMlbBox === 'function' ? _ghModelFromMlbBox(box) : null;
  var html;
  if (m) {
    var list = _ghPlaysByInningHtml(box);
    html = _gdPlaysStripHtml(m, box) + (list || '<div class="gh-card"><div class="gh-sub">No plays yet.</div></div>');
  } else {
    html = '<div class="wl-empty">The play by play shows up here once the game starts.</div>';
  }
  var y = el.scrollTop;
  el.innerHTML = html;
  el.scrollTop = y;
  try { if (typeof _paiRemount === 'function') _paiRemount(); } catch (e) { console.error('[inline replay]', e); }
}

// The Plays button only shows for baseball
function _gdPlaysBtnSync() {
  var b = document.getElementById('game-tab-plays');
  if (b) b.style.display = _gdPlaysMlb() ? '' : 'none';
}

// Rebuild the cheat sheet's cached box section so it drops (or brings back)
// its half-inning, then redraw
function _gdPlaysResync() {
  if (typeof _rerenderBoxScoreFromCache === 'function' && window._lastLiveBox) _rerenderBoxScoreFromCache();
  else if (typeof renderGameCheatSheet === 'function') renderGameCheatSheet();
  _gdPlaysRender();
}

(function () {
  if (typeof gameDetailTab !== 'function') return;
  var prev = gameDetailTab;
  var ON = 'background:rgba(255,255,255,.14);color:#fff;border:none;border-radius:20px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;white-space:nowrap';
  var OFF = 'background:transparent;color:rgba(255,255,255,.5);border:none;border-radius:20px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;white-space:nowrap';
  gameDetailTab = function (key) {
    var desk = typeof _isDesk === 'function' && _isDesk();
    var was = window._gdPlaysOn;
    // on desktop chat has its own column, so asking for it leaves Plays up
    var plays = _gdPlaysMlb() && (key === 'plays' || (key === 'chat' && desk && was));
    var r = prev.call(this, key === 'plays' ? 'sheet' : key);
    window._gdPlaysOn = plays;
    if (plays) window._gdLeftTab = 'plays';
    var sheet = document.getElementById('game-sheet-panel'), pp = document.getElementById('game-plays-panel');
    var pb = document.getElementById('game-tab-plays'), sb = document.getElementById('game-tab-sheet');
    if (plays) {
      if (sheet) sheet.style.display = 'none';
      if (sb) sb.style.cssText = OFF;
    }
    if (pp) pp.style.display = plays ? 'block' : 'none';
    if (pb) pb.style.cssText = plays ? ON : OFF;
    _gdPlaysBtnSync();
    if (typeof _gshApply === 'function') setTimeout(_gshApply, 0);
    if (plays !== was) _gdPlaysResync();
    else if (plays) _gdPlaysRender();
    if (plays && pp && key === 'plays') pp.scrollTop = 0;
    return r;
  };
})();

// Follow live updates while the tab is up
(function () {
  if (typeof renderGameCheatSheet !== 'function') return;
  var prev = renderGameCheatSheet;
  renderGameCheatSheet = function () {
    var r = prev.apply(this, arguments);
    _gdPlaysBtnSync();
    if (window._gdPlaysOn) { try { _gdPlaysRender(); } catch (e) { console.error('[plays tab]', e); } }
    return r;
  };
})();

// A new game opens on the cheat sheet
(function () {
  if (typeof _showGameScreen !== 'function') return;
  var prev = _showGameScreen;
  _showGameScreen = function () {
    window._gdPlaysOn = false;
    var pp = document.getElementById('game-plays-panel');
    if (pp) { pp.style.display = 'none'; pp.innerHTML = ''; }
    var r = prev.apply(this, arguments);
    _gdPlaysBtnSync();
    return r;
  };
})();
