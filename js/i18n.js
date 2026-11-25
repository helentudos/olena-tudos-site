/*
 * Translations loader and language switcher.
 * Each language lives in i18n/<lang>.js and registers itself as window.I18N[<lang>].
 * Script files (not JSON) are used so the page also works when opened from disk (file://).
 */
(function () {
  'use strict';

  var SUPPORTED = ['uk', 'pl', 'en'];
  var DEFAULT_LANG = 'en';
  var STORAGE_KEY = 'lang';

  window.I18N = window.I18N || {};

  function savedLang() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return SUPPORTED.indexOf(value) !== -1 ? value : null;
    } catch (e) {
      return null;
    }
  }

  function saveLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* storage unavailable */ }
  }

  function browserLang() {
    var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var code = String(list[i]).toLowerCase().slice(0, 2);
      if (SUPPORTED.indexOf(code) !== -1) return code;
    }
    return null;
  }

  function loadDictionary(lang) {
    return new Promise(function (resolve, reject) {
      if (window.I18N[lang]) return resolve(window.I18N[lang]);
      var script = document.createElement('script');
      script.src = 'i18n/' + lang + '.js';
      script.onload = function () {
        window.I18N[lang] ? resolve(window.I18N[lang]) : reject(new Error('Empty dictionary: ' + lang));
      };
      script.onerror = function () { reject(new Error('Cannot load i18n/' + lang + '.js')); };
      document.head.appendChild(script);
    });
  }

  function translate(dict, key) {
    if (Object.prototype.hasOwnProperty.call(dict, key) && dict[key] !== '') return dict[key];
    console.warn('[i18n] Missing key:', key);
    return '';
  }

  function applyDictionary(lang, dict) {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = translate(dict, el.getAttribute('data-i18n'));
    });

    // data-i18n-attr="aria-label:key|title:otherKey"
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split('|').forEach(function (pair) {
        var parts = pair.split(':');
        if (parts.length === 2) el.setAttribute(parts[0].trim(), translate(dict, parts[1].trim()));
      });
    });

    document.documentElement.lang = lang;
    document.title = translate(dict, 'meta.title');

    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang') === lang));
    });
    document.dispatchEvent(new CustomEvent('i18n:applied', { detail: { lang: lang } }));
  }

  function reveal() {
    document.documentElement.classList.remove('js-loading');
  }

  function setLanguage(lang) {
    if (SUPPORTED.indexOf(lang) === -1) lang = DEFAULT_LANG;
    return loadDictionary(lang)
      .then(function (dict) {
        applyDictionary(lang, dict);
        saveLang(lang);
      })
      .catch(function (err) {
        console.error('[i18n]', err);
        if (lang !== DEFAULT_LANG) return setLanguage(DEFAULT_LANG);
      })
      .then(reveal);
  }

  document.querySelectorAll('[data-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setLanguage(btn.getAttribute('data-lang'));
    });
  });

  // Never leave the page hidden if something goes wrong.
  setTimeout(reveal, 3000);

  setLanguage(savedLang() || browserLang() || DEFAULT_LANG);

  window.setLanguage = setLanguage;
})();
