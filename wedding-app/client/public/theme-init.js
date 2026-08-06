// Theme pre-paint init.
//
// MUST stay an external same-origin script: the server's Content-Security-
// Policy (script-src 'self') blocks inline scripts, and reading the theme
// preference before first paint prevents a light->dark flash for dark-mode
// users (a previous inline version was silently blocked by the CSP).
(function () {
  try {
    var pref = localStorage.getItem('wedding.theme');
    var dark = pref === 'dark' || (!pref && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (_) { /* private mode */ }
})();
