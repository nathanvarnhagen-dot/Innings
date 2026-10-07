// ═══ GAME TUTORIAL (v7.30.0) ═════════════════════════════════════════
// A "?" button just left of Watching / Attending in the game header. Opens a
// short how-to sheet: Delay first (it is the point of the app), then what
// you can tap, then the tabs. Self-contained: no data, no storage.
function _gtutHtml() {
  var row = function (t, d) { return '<div class="gtut-row"><b>' + t + '</b><span>' + d + '</span></div>'; };
  return '<div class="gtut-grab" aria-hidden="true"></div>' +
    '<div class="gtut-hd"><h3 id="gtut-title">How Innings works</h3><button type="button" class="gtut-x" onclick="gtutClose()" aria-label="Close">✕</button></div>' +
    '<div class="gtut-body">' +
      '<div class="gtut-delay"><div class="gtut-k">START HERE</div><h4>Set your delay</h4>' +
        '<p>Watching on TV or a stream that runs behind the live feed? Pick how far behind you are so nothing gets spoiled.</p>' +
        '<ul><li>Pick <b>Off · 5s · 15s · 28s</b>, or drag the slider to any number.</li>' +
        '<li><b>Match my TV</b> lines the app up with what you see on screen.</li>' +
        '<li>The <b>“28s behind”</b> chip up top shows your delay at a glance.</li>' +
        '<li>Plays, scores, pitches and chat all wait for you.</li></ul></div>' +
      '<h4 class="gtut-h">What you can tap</h4>' +
      row('A pitch', 'Speed, spin, break and where it ranks in the league. React with an emoji or comment and it posts to the game chat; tap it in the chat to reopen it.') +
      row('A player', 'Season stats, Savant percentiles and today’s line.') +
      row('Defense', 'Switch the field to the defense to see who is playing where. A gold glove marks past Gold Glove winners, with a number if more than one.') +
      '<h4 class="gtut-h">Up top</h4>' +
      row('Watching / Attending', 'Say how you are catching the game and save it as a memory with who you were with.') +
      '<h4 class="gtut-h">The tabs</h4>' +
      row('Cheat Sheet', 'The live moment: zone, count, pitch list and your delay.') +
      row('Plays', 'Every play so far, in order.') +
      row('Box', 'The full box score.') +
      row('Chat', 'Talk with your friends about anything in the game.') +
      row('Watch & Listen', 'Where to watch or listen to this game.') +
    '</div>';
}
function gtutOpen() {
  var el = document.getElementById('gtut-sheet');
  if (!el) {
    el = document.createElement('div');
    el.id = 'gtut-sheet'; el.className = 'gtut-sh';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'gtut-title');
    el.innerHTML = '<div class="gtut-scrim" onclick="gtutClose()"></div><div class="gtut-card">' + _gtutHtml() + '</div>';
    document.body.appendChild(el);
  }
  el.style.display = 'block';
  requestAnimationFrame(function () { el.classList.add('on'); });
}
function gtutClose() {
  var el = document.getElementById('gtut-sheet');
  if (!el) return;
  el.classList.remove('on');
  setTimeout(function () { if (!el.classList.contains('on')) el.style.display = 'none'; }, 260);
}
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') gtutClose(); });
