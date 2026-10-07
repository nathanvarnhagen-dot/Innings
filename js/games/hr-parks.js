// ══ HOME RUN: HOW MANY PARKS IT'S OUT OF (v7.21.2) ═════════════════════
// Savant's "HR in N of 30 parks" can take a while to post (or never come),
// so a home run always gets a number: Savant's when it's there, else our
// own estimate (shown with ≈) from the ball's distance, direction and
// launch angle against every park's fences and wall heights.
//
// Fences: left-field line, left-center, center, right-center, right-field
// line (ft); walls: left, center, right (ft). Approximate, 2026 parks.
var HR_PARKS = {
  AZ: [330, 374, 407, 374, 334, 7.5, 25, 7.5], ATL: [335, 385, 400, 375, 325, 11, 8, 16], BAL: [333, 376, 400, 373, 318, 13, 7, 25],
  BOS: [310, 379, 390, 380, 302, 37, 17, 5], CHC: [355, 368, 400, 368, 353, 11.5, 11.5, 11.5], CWS: [330, 377, 400, 372, 335, 8, 8, 8],
  CIN: [328, 379, 404, 370, 325, 12, 8, 8], CLE: [325, 370, 400, 375, 325, 19, 9, 9], COL: [347, 390, 415, 375, 350, 8, 8, 14],
  DET: [345, 370, 412, 365, 330, 7, 8.5, 8.5], HOU: [315, 362, 409, 373, 326, 21, 10, 7], KC: [330, 379, 410, 379, 330, 8.5, 8.5, 8.5],
  LAA: [347, 390, 396, 370, 350, 8, 8, 18], LAD: [330, 375, 395, 375, 330, 4, 8, 4], MIA: [344, 386, 400, 387, 335, 8, 8, 8],
  MIL: [344, 371, 400, 374, 345, 8, 8, 8], MIN: [339, 377, 404, 367, 328, 8, 8, 23], NYM: [335, 370, 408, 375, 330, 8, 8, 8],
  NYY: [318, 399, 408, 385, 314, 8, 8, 8], ATH: [330, 380, 403, 380, 325, 8, 8, 8], PHI: [329, 374, 401, 369, 330, 11, 6, 13],
  PIT: [325, 389, 399, 375, 320, 6, 10, 21], SD: [334, 390, 396, 391, 322, 7.5, 8, 8], SF: [339, 364, 391, 415, 309, 8, 8, 24],
  SEA: [331, 378, 401, 381, 326, 8, 8, 8], STL: [336, 375, 400, 375, 335, 8, 8, 8], TB: [315, 370, 404, 370, 322, 9, 9.5, 9],
  TEX: [329, 372, 407, 374, 326, 8, 8, 8], TOR: [328, 368, 400, 359, 328, 12, 12, 12], WSH: [336, 377, 402, 370, 335, 8, 8, 12]
};
var HR_PARK_ALIAS = { ARI: 'AZ', OAK: 'ATH', WSN: 'WSH', WAS: 'WSH', CHW: 'CWS', KCR: 'KC', SDP: 'SD', SFG: 'SF', TBR: 'TB', TBD: 'TB' };

// Fence distance and wall height at a spray angle (-45 = left-field line, 0 = center, 45 = right-field line)
function _hrFenceAt(p, ang) {
  var a = Math.max(-45, Math.min(45, ang)), t = (a + 45) / 22.5, i = Math.min(3, Math.floor(t)), f = t - i;
  var dist = p[i] + (p[i + 1] - p[i]) * f;
  var wt = (a + 45) / 45, j = Math.min(1, Math.floor(wt)), g = wt - j;
  var wall = p[5 + j] + (p[6 + j] - p[5 + j]) * g;
  return { dist: dist, wall: wall };
}
// Our estimate, 0–30, or null when the ball's numbers aren't there
function _hrParksEst(lp, box) {
  var h = lp && lp.hit;
  if (!h || h.distance == null || h.x == null || h.y == null) return null;
  var ang = Math.atan2(h.x - 125.42, 198.27 - h.y) * 180 / Math.PI;
  if (ang < -50 || ang > 50) return null;
  var la = h.angle != null ? h.angle : 30;
  var desc = Math.max(25, Math.min(55, la * 1.15 + 5)) * Math.PI / 180; // how steeply it comes down
  var home = String((box && box.homeAbbr) || '').toUpperCase(); home = HR_PARK_ALIAS[home] || home;
  var n = 0;
  Object.keys(HR_PARKS).forEach(function (k) {
    var fw = _hrFenceAt(HR_PARKS[k], ang);
    var out = h.distance >= fw.dist + fw.wall / Math.tan(desc);
    if (k === home && lp.eventType === "home_run" && !/inside-the-park/i.test(lp.description || "")) out = true; // it went out here
    if (out) n++;
  });
  return n;
}
// What to show: Savant's count when it's in, else our estimate
function _hrParks(lp, box, sp) {
  if (sp && sp.parks != null) return { n: sp.parks, est: false };
  var e = _hrParksEst(lp, box);
  return e == null ? null : { n: e, est: true };
}
function _hrParksText(pk) { return pk ? (pk.est ? '≈' : '') + pk.n : null; }
