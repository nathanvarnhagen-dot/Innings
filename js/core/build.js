window.INNINGS_BUILD = 'v7.58.0-chat-rail-join';
console.log('%cInnings build ' + window.INNINGS_BUILD + ' loaded ' + new Date().toISOString(), 'color:#6B63B5;font-weight:700');
document.addEventListener('DOMContentLoaded', function(){
  var t = document.getElementById('build-stamp');
  if (t) t.textContent = 'build ' + window.INNINGS_BUILD;
  var p = document.getElementById('profile-build-stamp');
  if (p) p.textContent = 'build ' + window.INNINGS_BUILD;
});
