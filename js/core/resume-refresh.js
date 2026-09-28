// v5.85.0: coming back to the app catches up right away instead of
// waiting for the next tick (phones pause timers in the background).
document.addEventListener('visibilitychange', function () {
  if (document.hidden) return;
  var gameScr = document.getElementById('screen-game'), listScr = document.getElementById('screen-games');
  var g = window._activeBrowseGame;
  if (gameScr && gameScr.classList.contains('active') && g && typeof _refreshBoxScore === 'function') {
    _refreshBoxScore(g.gamePk).then(function (isLive) { if (isLive && !window._gameLiveRefreshTimer && typeof _startGameLiveRefresh === 'function') _startGameLiveRefresh(g.gamePk); }).catch(function () {});
  } else if (listScr && listScr.classList.contains('active') && typeof loadGamesList === 'function') {
    loadGamesList(window._gamesDate, { silent: true });
  }
});
