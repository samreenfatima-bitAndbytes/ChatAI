(function () {
  var KEY = 'bnb-theme';

  function preferred() {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  function apply(theme) {
    var next = theme === 'light' ? 'light' : 'dark';
    var root = document.documentElement;
    root.setAttribute('data-theme', next);
    root.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {}
    syncToggles(next);
  }

  function syncToggles(theme) {
    var isLight = theme === 'light';
    document.querySelectorAll('.bnb-theme-toggle').forEach(function (btn) {
      btn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
      btn.setAttribute('title', isLight ? 'Dark mode' : 'Light mode');
      btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      btn.dataset.theme = theme;
    });
  }

  function toggle() {
    var current = document.documentElement.getAttribute('data-theme') || preferred();
    apply(current === 'light' ? 'dark' : 'light');
  }

  function bindToggles() {
    document.querySelectorAll('.bnb-theme-toggle').forEach(function (btn) {
      if (btn.dataset.themeBound) return;
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', toggle);
    });
    syncToggles(document.documentElement.getAttribute('data-theme') || preferred());
  }

  window.__bnbTheme = { apply: apply, toggle: toggle, preferred: preferred, bind: bindToggles };

  apply(preferred());

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindToggles);
  } else {
    bindToggles();
  }
})();
