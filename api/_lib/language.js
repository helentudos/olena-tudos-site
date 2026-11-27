'use strict';
/*
 * A cheap, script-based check that a text is written in the expected language.
 * Used by the server to block an automatic reply in the wrong language (live
 * test 2 found a Ukrainian reply to a Polish inquiry) and by the live tests.
 * No dependencies, so scripts/live-test-lead.mjs can load it as well.
 *
 *   en, pl  Latin letters and no Cyrillic at all (en and pl are not told apart)
 *   uk      mostly Cyrillic, a Ukrainian-only letter (і ї є ґ) or word (дякую, що, як…),
 *           no Russian-only letters or words (и, что, это, спасибо…)
 *   ru      mostly Cyrillic, no Ukrainian-only letters or words
 * Short replies need the words: "Дякую за опис." has none of і ї є ґ (live test 6).
 *   other   cannot be checked by script: accepted
 *
 * olenaTextProblem() is stricter: process and summary are written for Olena and
 * must be Ukrainian (live tests 1 and 3 found Polish and mixed Latin/Cyrillic text).
 */

const UKRAINIAN_ONLY = /[іїєґ]/i;
const RUSSIAN_ONLY = /[ыэъё]/i;
const POLISH_LETTERS = /[ąćęłńóśźż]/i;
const word = (list) => new RegExp(`(^|[^\\p{L}])(${list})(?![\\p{L}])`, 'iu');
const UKRAINIAN_WORDS = word('дякую|що|як|це|ви|розумію|також|дуже|коли|опис');
const RUSSIAN_WORDS = word('и|что|это|спасибо|понимаю|вы|если|как|его|её|ее|который|которые|когда|где|только|очень|описание');
// Latin words allowed in Ukrainian text for Olena, besides acronyms of 2–5 capitals
// (SEO, CRM, IT, HR, API), capitalised tool names (Excel, WhatsApp) and words with
// digits (n8n, GPT-4o). Checked per hyphen-separated part (live test 5).
const ALLOWED_LATIN_WORDS = new Set(['email', 'e', 'mail', 'online', 'offline', 'chatbot', 'chat', 'bot', 'workflow', 'webhook', 'api', 'crm', 'erp', 'sla', 'pdf', 'excel']);
const LATIN_ACRONYM = /^[A-Z]{2,5}$/;
const MIN_CYRILLIC_SHARE = 0.8;

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
      return cyrillic / letters >= 0.6 && (UKRAINIAN_ONLY.test(s) || UKRAINIAN_WORDS.test(s)) &&
        !RUSSIAN_ONLY.test(s) && !RUSSIAN_WORDS.test(s);
    case 'ru':
      return cyrillic / letters >= 0.6 && !UKRAINIAN_ONLY.test(s) && !UKRAINIAN_WORDS.test(s);
    default:
      return true;
  }
}

/**
 * Returns null when the text is acceptable Ukrainian for Olena, otherwise
 * { code, detail }. The code is a fixed value, safe to use in a follow-up prompt;
 * the detail may quote the text and is only for Olena and the tests.
 */
function olenaTextProblem(text, { requireUkrainianLetter = false } = {}) {
  const s = String(text || '').trim();
  if (!s) return { code: 'empty', detail: 'empty' };
  if (POLISH_LETTERS.test(s)) return { code: 'polish_letters', detail: 'Polish letters' };

  let cyrillic = 0;
  let latin = 0;
  // Hyphenated words are checked part by part: "SEO-посилання", "CRM-система" and
  // "IT-відділ" are normal Ukrainian; "Firма" (one part, two scripts) is not.
  for (const word of s.match(/[\p{L}\p{N}'’]+/gu) || []) {
    const c = (word.match(/\p{Script=Cyrillic}/gu) || []).length;
    const l = (word.match(/\p{Script=Latin}/gu) || []).length;
    if (c && l) return { code: 'mixed_script', detail: `Latin and Cyrillic in one word: "${word}"` };
    if (l) {
      const isName = LATIN_ACRONYM.test(word) || /^[A-Z]/.test(word) || /\d/.test(word) || ALLOWED_LATIN_WORDS.has(word.toLowerCase());
      if (!isName) latin += l;
    } else {
      cyrillic += c;
    }
  }
  if (!cyrillic) return { code: 'no_cyrillic', detail: 'no Ukrainian text' };
  const share = cyrillic / (cyrillic + latin);
  if (share < MIN_CYRILLIC_SHARE) return { code: 'low_cyrillic', detail: `only ${Math.round(share * 100)}% Cyrillic` };
  if (RUSSIAN_ONLY.test(s)) return { code: 'russian_letters', detail: 'Russian-only letters' };
  if (RUSSIAN_WORDS.test(s)) return { code: 'russian_letters', detail: 'Russian words' };
  if (requireUkrainianLetter && cyrillic >= 25 && !UKRAINIAN_ONLY.test(s)) {
    return { code: 'no_ukrainian_letters', detail: 'no Ukrainian letters (і, ї, є, ґ)' };
  }
  return null;
}

/** Checks process and summary together; returns null or { field, code, detail }. */
function olenaFieldsProblem(result) {
  const process = olenaTextProblem(result.process);
  if (process) return { field: 'process', ...process };
  const summary = olenaTextProblem(result.summary, { requireUkrainianLetter: true });
  if (summary) return { field: 'summary', ...summary };
  return null;
}

module.exports = { textMatchesLanguage, letterStats, olenaTextProblem, olenaFieldsProblem };
