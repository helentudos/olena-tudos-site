/*
 * Motion: hero scene control and the facts counter.
 * Everything here respects prefers-reduced-motion.
 */
(function () {
  'use strict';

  var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var STILL_FRAME = 4.7; // seconds into the hero cycle: card and notification are visible

  /* ---------- Hero scene (SVG SMIL animation) ---------- */
  var scene = document.querySelector('.hero-scene');
  var sceneVisible = true;

  function updateScene() {
    if (!scene || typeof scene.pauseAnimations !== 'function') return;
    if (reduceQuery.matches) {
      scene.pauseAnimations();
      scene.setCurrentTime(STILL_FRAME);
    } else if (sceneVisible && !document.hidden) {
      scene.unpauseAnimations();
    } else {
      scene.pauseAnimations();
    }
  }

  if (scene) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        sceneVisible = entries[0].isIntersecting;
        updateScene();
      }).observe(scene);
    }
    document.addEventListener('visibilitychange', updateScene);
    reduceQuery.addEventListener('change', updateScene);
    updateScene();
  }

  /* ---------- CSS animations: pause while off-screen ---------- */
  if ('IntersectionObserver' in window) {
    var cssObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle('is-offscreen', !entry.isIntersecting);
      });
    });
    document.querySelectorAll('[data-motion]').forEach(function (el) { cssObserver.observe(el); });
  }

  /* ---------- Counter for the facts (runs once, after translations) ---------- */
  var counted = false;
  var counterFrame = null;

  function runCounter() {
    var items = [];
    document.querySelectorAll('.fact-num').forEach(function (el) {
      var match = /^(\d+)(.*)$/.exec(el.textContent.trim());
      if (match) items.push({ el: el, target: +match[1], suffix: match[2] });
    });
    if (!items.length) return;

    var duration = 1200;
    var start = null;
    function tick(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      items.forEach(function (item) {
        item.el.textContent = Math.round(item.target * eased) + item.suffix;
      });
      counterFrame = t < 1 ? requestAnimationFrame(tick) : null;
    }
    counterFrame = requestAnimationFrame(tick);
  }

  document.addEventListener('i18n:applied', function () {
    if (counted) {
      // Language changed: translations already set final values, stop any running count.
      if (counterFrame) { cancelAnimationFrame(counterFrame); counterFrame = null; }
      return;
    }
    counted = true;
    if (!reduceQuery.matches) runCounter();
  });
})();
