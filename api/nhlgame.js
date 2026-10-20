// Vercel Serverless Function — GET /api/nhlgame?mode=gamecast|pregame&gameId=<id>
// v7.59.0: the game page asks /api/nhlgame for its hero data while the
// handler lives in api/nhl.js (which also serves mode=schedule). Same code.
module.exports = require('./nhl.js');
