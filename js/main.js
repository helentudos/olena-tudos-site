/* Mobile navigation toggle */
(function () {
  'use strict';

  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  var desktop = window.matchMedia('(min-width: 960px)');

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  }

  toggle.addEventListener('click', function () {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  // Close after choosing a section
  nav.addEventListener('click', function (event) {
    if (event.target.closest('a') && !desktop.matches) setOpen(false);
  });

  // Close with Escape and return focus to the button
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  desktop.addEventListener('change', function () { setOpen(false); });
})();

/* Light / dark theme toggle. The initial theme is set by the inline script in <head>. */
(function () {
  'use strict';

  var STORAGE_KEY = 'theme';
  var root = document.documentElement;
  var button = document.querySelector('.theme-toggle');
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function saved() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch (e) {
      return null;
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    if (button) button.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  apply(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  if (button) {
    button.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* storage unavailable */ }
    });
  }

  // Follow the system setting until the visitor makes a choice
  systemDark.addEventListener('change', function (event) {
    if (!saved()) apply(event.matches ? 'dark' : 'light');
  });
})();
