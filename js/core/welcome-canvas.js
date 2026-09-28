(function(){
  var c = document.getElementById('ob-canvas');
  if(!c) return;
  var ctx = c.getContext('2d');
  var emojis = ['⚾','🏟️','🎪','🎸','🐕','🚗','🎵','🍺','✈️','🏆','❤️','🌅','🎉','⭐','🎓','🏀','⚽','🎤','🐾','🎬'];

  var cols = 5;
  var rows = 10;
  var cellW, cellH;
  var offset = 0;
  var speed = 0.4;
  var grid = [];

  function initGrid() {
    cellW = c.width / cols;
    cellH = 70;
    grid = [];
    // Build enough rows to fill screen + buffer for looping
    for (var r = 0; r < rows + 4; r++) {
      for (var col = 0; col < cols; col++) {
        grid.push({
          emoji: emojis[Math.floor(Math.random() * emojis.length)],
          x: col * cellW + cellW / 2 + (Math.random() - 0.5) * 18,
          row: r,
          size: 16 + Math.floor(Math.random() * 12),
          opacity: 0.08 + Math.random() * 0.1
        });
      }
    }
  }

  function resize() {
    c.width = c.offsetWidth || 390;
    c.height = c.offsetHeight || 400;
    initGrid();
  }

  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    var totalH = rows * cellH;
    offset = (offset + speed) % cellH;

    grid.forEach(function(cell) {
      var y = cell.row * cellH - offset;
      // Wrap rows that scroll off top back to bottom
      if (y < -cellH) y += totalH + cellH;
      ctx.globalAlpha = cell.opacity;
      ctx.font = cell.size + 'px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cell.emoji, cell.x, y);
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  draw();
})();
