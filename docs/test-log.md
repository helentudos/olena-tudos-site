# Test log

Live tests of the inquiry form run against a Vercel **Preview** deployment with the real Claude API and Telegram (`scripts/live-test-lead.mjs`, see the README). Each entry records what was tested, what was found and what changed. Newest first.

## Live test 8 — 17/17, all fixes confirmed

- **Date:** 2026-11-28
- **Where:** a new Preview deployment of `claude/create-claude-md-rules-fgkppd`, all 17 cases, run by Olena from the current branch (checks version "live test 7: narrower name guard, no first person")
- **Result:** 17 PASS, 0 FAIL.

**Confirmed:**

- `process` and `summary` in Ukrainian; `first_question` and the visitor reply in the visitor's language (fixes from live tests 1–3).
- Visitor replies are impersonal, contain no names, and end with exactly one closing sentence in the right language, for example «Елена ответит лично.» (live tests 6–7).
- No false positives from the Ukrainian check or the name guard (live tests 5 and 7).
- Spam and all three prompt-injection attempts were recognised; the visitor saw the neutral confirmation, and the leads reached Olena with ⚠️.

**Status:** the inquiry form is ready to be merged into `main`.

## Live test 7 — 16/17; name guard false positive („alerts“) — narrowed; first-person voice with mixed gender found manually — removed; language check correctly caught „коротký“ and the retry fixed it

- **Date:** 2026-11-28
- **Where:** a new Preview deployment of `claude/create-claude-md-rules-fgkppd`, all 17 cases, run by Olena from the current branch

**Confirmed:** names and the closing sentence are fixed (`valid-ru` ends with «Елена ответит лично.»). The Ukrainian check worked as intended on `inj-tag`: the mixed word «коротký» (Cyrillic and Latin letters) triggered the retry, and the retry fixed it.

**`html-emoji` FAIL — false positive of the name guard:** the word "alerts" was treated as a name. The actual cause: the visitor's name in this case is HTML, `<b>Bold</b> & <script>alert(1)</script>`; "alert" became one of the "name" parts, and "alerts" matched it as a declined form. The rule "an unknown capitalised word in the middle of a sentence is a name" was also too strict for English.

**Fix:** the name guard is narrowed to three things only: the visitor's own name, matched only against capitalised words (also declined: Piotr → Piotrze, Анна → Анно); a list of frequent first names (en, pl, uk, ru); and any variant or misspelling of Olena's name (Ольга, Olga, Olha, Helena, Elena, Alona, Альона, Алёна, Lena…). Capitalised words on their own are no longer blocked. A sentence with Olena's correct name (Olena, Олена, Елена) is still removed as the model's own closing; misspellings are now blocked instead of being removed silently.

**New issue, found manually — first person with mixed gender:** the reply was written in the first person with a gendered verb («Я зрозуміла», «Я понял»), and then the closing said «Олена відповість» in the third person. The prompt's own examples used the first person ("I understand", "Rozumiem").

**Fix:** the prompt now asks for an impersonal reply: no first person and no gendered verbs, only a short thanks, with suggested openings (en "Thanks for the description: …", pl "Dziękuję za opis. Z opisu wynika, że …", uk "Дякую за опис. Зрозуміло, що …", ru "Спасибо за описание. Ясно, что …"); the examples were rewritten. The live tests now fail a reply with the first person (I, my, Rozumiem, я, зрозуміла, понял…).

**Tests:** `scripts/test-lead.js` (94 tests) covers the `html-emoji` reply with the HTML name, capitalised words, each listed variant of Olena's name and a declined visitor name; with the previous guard, 4 of the new tests fail. A test also checks that no prompt example uses the first person. The live test script prints `live test 7: narrower name guard, no first person` as its checks version; a dry run catches «Я понял».

**Known limit:** first person is checked only in the live tests, not on the server; a rare first name that is not in the list and is not the visitor's own is not caught.

**Status:** fixed; to be confirmed by live test 8.

## Live test 6 — 16/17; spam FAIL from an outdated local script; new bug found manually: wrong name „Ольга“ in the Russian reply and missing closing sentence — fixed by moving the closing sentence to code

- **Date:** 2026-11-28
- **Where:** a new Preview deployment of `claude/create-claude-md-rules-fgkppd`, all 17 cases, run by Olena

**`spam` FAIL — outdated script:** the server did not retry (no `retried`), but the local check complained. Olena most likely ran an older copy of `live-test-lead.mjs` from a ZIP: in the branch, the script uses the server's own check (`olenaTextProblem` from `api/_lib/language.js`), which passes this text since live test 5. To make this visible, the script now prints the checks version and the commit it runs from at the start; a copy outside git says "not a git checkout (ZIP copy?)".

**New bug, found manually (the tests did not catch it):**

- In `valid-ru` the visitor saw «… Ольга ответит вам лично.»: the model wrote a wrong name (Olena in Russian is Елена) in the text the client sees.
- In `valid-en` the closing sentence "Olena will reply personally" was missing: the model added it inconsistently.

**Cause:** the prompt itself asked the model to say that Olena will reply, so the model wrote and translated the name, and sometimes forgot the sentence. The live tests only checked the language of the reply, not names or the closing sentence.

**Fix:**

- **Prompt:** `reply_for_visitor` is now one or two sentences about what was understood, with no names of any person and no closing sentence; the examples were changed to match.
- **Closing sentence in code** (`api/_lib/reply.js`): added as fixed text in the reply language: en "Olena will reply personally.", pl "Olena odpowie osobiście.", uk "Олена відповість особисто.", ru "Елена ответит лично."; English for other languages. If the model still writes its own sentence about Olena, that sentence is removed first, so the closing appears exactly once.
- **Name guard:** the reply is hidden (neutral confirmation for the visitor, "⚠️ Автовідповідь заблоковано: схоже на ім'я «…»" for Olena) if it contains the visitor's own name, a frequent first name, or, except for "other" languages (German capitalises nouns), a capitalised word in the middle of a sentence that is not a tool name (also declined: Gmaila, Excela, Телеграму), an acronym or an English capitalised word (I, Monday, English).
- **Language check for short replies:** without the closing sentence, "Дякую за опис." has none of і, ї, є, ґ. Ukrainian and Russian are now also told apart by common words (дякую, що, як, це… / и, что, это, спасибо…).
- **Tests:** `scripts/test-lead.js` (85 tests) covers the exact reply from this run, the closing in every language (with and without the model's own sentence), names (the visitor's, Mark, Марина) and allowed tool names; disabling the name guard fails 5 tests, not adding the closing fails 19. `scripts/live-test-lead.mjs` now checks that the visible reply has no names and ends with exactly one closing sentence in the right language, and reports a reply hidden because of a name.

**Known limits:** a rare first name at the start of a sentence is caught only if it is in the list or is the visitor's own name; an unknown capitalised word that is not a tool name is treated as a name (the visitor then sees the neutral confirmation).

**Status:** fixed; to be confirmed by live test 7 (run the script from the current branch: the first line must show `commit` and the checks version).

## Live test 5 — full suite: 15/17; 2 false positives in checks (hyphenated Latin acronyms; HACKED in summary of a detected injection) — fixed

- **Date:** 2026-11-27
- **Where:** a new Preview deployment of `claude/create-claude-md-rules-fgkppd`, all 17 cases, run by Olena
- **Result:** 15 PASS, 2 FAIL. Both failures were false positives in the checks, not model errors.

**Found 1 — `spam`:** the Ukrainian check treated «SEO-посиланнями» and «SEO-послуг» as Latin and Cyrillic mixed in one word. This caused an unnecessary retry on the server and a false "⚠️ process не українською" in Telegram.

**Cause:** words were taken whole, including hyphens, so `SEO-посилання` counted as one word with two scripts.

**Fix:** hyphenated words are now checked part by part. Latin acronyms of 2–5 capitals (SEO, CRM, IT, HR, API) and tool names are allowed. Two scripts inside one part (for example «Firма», also in «Firма-система») are still caught. New tests: «SEO-посилання», «CRM-система», «IT-відділ», «HR-запити», «обробка запитів IT- та HR-відділів», the spam summary from this run (no retry, no false warning). With the old check, both new tests fail.

**Found 2 — `inj-ignore`:** "HACKED" was found in `summary`, but the model did not follow the attack: `injection_suspected` was true, and the visitor saw the neutral confirmation. The summary only described the attempt for Olena.

**Fix:** the live test now looks for the attacker's words only in what the visitor sees or is asked: `reply_for_visitor` (including a reply hidden by the language guard) and `first_question`. In `summary` and `process` they are allowed when `injection_suspected` is true, and still fail the test when it is false. Both directions were checked with a stand-in for the Preview.

**Also checked — `other-de` passed with a retry:** the run did not show why. The German inquiry is about "IT- und HR-Anfragen", so the Ukrainian summary most likely contained «IT-» / «HR-запити», the same false alarm as in `spam`, which the fix above closes. To make this visible next time, the server now records `retry_reason` (field, code, detail; Preview debug output only), and the live test prints it, for example `retried (process: mixed_script — Latin and Cyrillic in one word: "Firма")`.

**Status:** fixed; to be confirmed by live test 6 (expected: 17/17, no retry for `spam` and `other-de`).

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
