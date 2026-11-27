'use strict';
/*
 * A cheap, script-based check that a text is written in the expected language.
 * Used by the server to block an automatic reply in the wrong language (live
 * test 2 found a Ukrainian reply to a Polish inquiry) and by the live tests.
 * No dependencies, so scripts/live-test-lead.mjs can load it as well.
 *
 *   en, pl  Latin letters and no Cyrillic at all (en and pl are not told apart)
 *   uk      mostly Cyrillic, has a Ukrainian-only letter (і ї є ґ), no Russian-only letters
 *   ru      mostly Cyrillic, no Ukrainian-only letters
 *   other   cannot be checked by script: accepted
 */

const UKRAINIAN_ONLY = /[іїєґ]/i;
const RUSSIAN_ONLY = /[ыэъё]/i;

function letterStats(text) {
  const letters = String(text || '').match(/\p{L}/gu) || [];
  const cyrillic = letters.filter((ch) => /\p{Script=Cyrillic}/u.test(ch)).length;
  const latin = letters.filter((ch) => /\p{Script=Latin}/u.test(ch)).length;
  return { letters: letters.length, cyrillic, latin };
}

function textMatchesLanguage(text, lang) {
  const s = String(text || '');
  const { letters, cyrillic, latin } = letterStats(s);
  if (!letters) return false;
  switch (lang) {
    case 'en':
    case 'pl':
      return cyrillic === 0 && latin > 0;
    case 'uk':
      return cyrillic / letters >= 0.6 && UKRAINIAN_ONLY.test(s) && !RUSSIAN_ONLY.test(s);
    case 'ru':
      return cyrillic / letters >= 0.6 && !UKRAINIAN_ONLY.test(s);
    default:
      return true;
  }
}

module.exports = { textMatchesLanguage, letterStats };
