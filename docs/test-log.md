# Test log

Live tests of the inquiry form run against a Vercel **Preview** deployment with the real Claude API and Telegram (`scripts/live-test-lead.mjs`, see the README). Each entry records what was tested, what was found and what changed. Newest first.

## Live test 3 — reply and first_question language fixed; process/summary in Polish or mixed — found and fixed with field order and validation + retry

- **Date:** 2026-11-27
- **Where:** a new Preview deployment of `claude/create-claude-md-rules-fgkppd`, run by Olena
- **Case:** an inquiry in Polish sent from the English version of the page

**Confirmed:** `reply_for_visitor` and `first_question` now arrive in Polish. The fix from live test 2 works.

**Found:** `process` was in Polish again, and `summary` mixed scripts, even inside words: «Firма montażowa, ок. 15 людей: заявки клієнтів…».

**Likely cause:** after live test 2, `visitor_language` was generated first and the Polish fields for the visitor came right after it; `process` and `summary` were generated later, mid-way between Polish texts, and drifted into Polish or a mix.

**Fix:**

- **Field order:** `process` and `summary` (Ukrainian, for Olena) are now generated first, then `visitor_language`, then `first_question` and `reply_for_visitor` (the visitor's language), then the rest. The prompt's numbered steps and both examples follow the same order, and the prompt now forbids mixing Latin and Cyrillic letters in a word.
- **Validation** (`olenaTextProblem` in `api/_lib/language.js`): `process` and `summary` fail on Polish letters (ąćęłńóśźż), on a word that mixes Latin and Cyrillic letters, on less than 80% Cyrillic among the letters (capitalised or all-caps names such as Excel, WhatsApp, CRM, words with digits and a few common words such as email do not count), on Russian-only letters, and, for a longer `summary`, on missing Ukrainian letters.
- **One retry:** on a failure, Claude is asked once more with a short correction in the system prompt. The correction is built only from fixed codes, never from model or visitor text, so the visitor cannot inject instructions through it. The retry has its own 8-second timeout and is skipped if the first answer took more than 14 seconds, so the function stays within its 30-second limit.
- **If the retry does not help** (or fails, or is skipped), the lead goes to Olena as it is, with "⚠️ summary не українською" and the reason as the first line in Telegram. The visitor is not affected.
- **Tests:** `scripts/test-lead.js` (65 tests) covers the exact text from this live test, a successful retry, a failed second answer, a failed retry request and the time budget; disabling the check fails 5 tests. `scripts/live-test-lead.mjs` now uses the same check as the server and shows when a retry happened.

**Also changed:** the "Automatic reply · Olena will reply personally" label under the reply was removed at Olena's request; the AI processing is disclosed in the consent text.

**Known limit:** short Russian text without ы, э, ъ or ё is not told apart from Ukrainian.

**Status:** fixed in code; to be confirmed by live test 4.

## Live test 2 — summary language fixed; regression: first_question and reply_for_visitor in Ukrainian — found and fixed

- **Date:** 2026-11-27
- **Where:** a new Preview deployment of `claude/create-claude-md-rules-fgkppd`, run by Olena
- **Case:** an inquiry in Polish sent from the English version of the page

**Confirmed:** `summary` and `process` now arrive in Ukrainian. The fix from live test 1 works.

**Found (regression, critical):** `first_question` and `reply_for_visitor` also came in Ukrainian, though they must be in the visitor's language (Polish). The visitor saw this on the page:

> Дякую за опис. Розумію, що заявки з пошти та WhatsApp переносяться вручну і частина з них губиться. Олена відповість вам особисто.

**Likely causes:**

- The new, strongly worded "always Ukrainian" rule and the Ukrainian examples pulled the visitor-facing fields into Ukrainian too.
- In the output schema `visitor_language` came *after* `reply_for_visitor`. Structured output is generated field by field, so the reply was written before the model had decided the visitor's language.

**Fix:**

- **Schema:** `visitor_language` is now the first field, so the language is decided before any text for the visitor.
- **Prompt:** the languages block now has three numbered steps: decide `visitor_language` from the description (the page language never decides it); `process` and `summary` in Ukrainian *for Olena*; `first_question` and `reply_for_visitor` in the `visitor_language` *for the visitor*, never Ukrainian unless it is `uk`. A second example was added: an English inquiry with Ukrainian `process` and `summary` and English `first_question` and `reply_for_visitor`.
- **Guard in code** (`api/_lib/language.js`): if the reply does not match `visitor_language` (pl and en: Latin letters and no Cyrillic; uk: Ukrainian letters, no Russian-only letters; ru: Cyrillic without Ukrainian-only letters; other: not checked), the visitor sees the neutral confirmation in the page language, and the Telegram message starts with "⚠️ Мова автовідповіді не збіглася з мовою заявки". The rejected reply is not forwarded; on Preview it is returned in the debug output.
- **Tests:** `scripts/test-lead.js` (58 tests) covers the exact reply from this live test and the guard for every language; disabling the guard fails 5 tests. `scripts/live-test-lead.mjs` now checks the language of `first_question` and of the reply with the same code as the server, and `valid-pl` is sent from the English page, as in this test. A dry run with a stand-in that answers in Ukrainian fails both checks as expected.

**Known limit:** the guard cannot tell Polish from English (both Latin), and does not check "other" languages.

**Status:** fixed in code; to be confirmed by live test 3.

## Live test 1 — language of summary: found and fixed

- **Date:** 2026-11-27
- **Where:** Preview deployment of `claude/create-claude-md-rules-fgkppd`, run by Olena from her Mac
- **Result:** the form, Claude classification, Telegram delivery and the automatic reply to the visitor all worked.

**Found:** for an inquiry written in Polish, `summary` and `process` arrived in Telegram in Polish. They are meant for Olena and must always be in Ukrainian.

**Cause:** the system prompt gave no language at all for `process`, and the rule "summary in Ukrainian" was one line among many field rules, so the model followed the inquiry's language instead.

**Fix:**

- The prompt now has a separate block, *Languages of the fields*: `process` and `summary` are **always Ukrainian**, whatever the inquiry language (translate, keep tool names such as Excel or WhatsApp); `first_question` and `reply_for_visitor` are in the visitor's language. It ends with a short example: a Polish inquiry with Ukrainian `process` and `summary` and Polish `first_question` and `reply_for_visitor`.
- `scripts/test-lead.js` checks that the prompt sent to Claude contains both language rules.
- `scripts/live-test-lead.mjs` now checks every classified case: `summary` and `process` must be mostly Cyrillic (tool names in Latin letters are allowed), contain no Polish letters and no Russian-only letters, and `summary` must contain a Ukrainian letter (і, ї, є, ґ). A dry run with a stand-in that answers in Polish fails these checks as expected.

**Status:** fixed in code; to be confirmed by live test 2 on a new Preview deployment.

**Also changed after this test:** the Telegram message was redesigned (sections, clickable contact, time in Europe/Warsaw); see `api/_lib/telegram.js`.
