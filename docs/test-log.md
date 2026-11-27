# Test log

Live tests of the inquiry form run against a Vercel **Preview** deployment with the real Claude API and Telegram (`scripts/live-test-lead.mjs`, see the README). Each entry records what was tested, what was found and what changed. Newest first.

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
