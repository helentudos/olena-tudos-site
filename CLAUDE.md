# CLAUDE.md — project rules

## About the project

Personal landing page of **Olena Tudos**, AI Automation Specialist (n8n, PostgreSQL, LLM APIs).

Goal of the page: clients and employers quickly understand how Olena can help, see her case studies and send an inquiry.

## Positioning

- Focus: **automation of internal business processes for small and medium-sized businesses**.
- Main message: **I turn the chaos of messages, emails, voice notes and spreadsheets into structured data and actions for the team.** Exact wording comes from `content/facts.md`.
- **Main case studies** are shown in full and in exactly this order:
  1. Field Report Voice Bot
  2. Candidate Intake & AI Scoring
  3. HouseBox — AI Ticket Routing + SLA
  4. PearlDent Clinic
- **Other projects** (StyleBox, AI Lead Processing & Marketing Automation, GrowthLab) are shown as a short list with a link to the Notion portfolio.
- Show each project's status (own, training, demo, test assignment) honestly, as in `facts.md`, and state that figures come from tests and estimates on test data.
- The "Не публікувати" (Do not publish) section of `facts.md` always applies. In particular, company names from test assignments are never shown.

## Languages

- The site has four languages: **English (en)**, **Polish (pl)**, **Ukrainian (uk)**, **Russian (ru)**.
- **English is the default language.** The page opens in English unless the visitor has chosen another language before; the browser language is not used.
- The language switcher lists **EN first**, then PL, UA and RU. The chosen language is remembered between visits, and the `lang` attribute on `<html>` is updated.
- **All texts live in separate translation files** (one per language), referenced from HTML by keys (for example `data-i18n="hero.title"`).
- The English text inside `index.html` is **generated** from `i18n/en.js` by `node scripts/prerender.js`, so the page works without JavaScript and search engines see the content. Never edit text in `index.html` by hand: change the translation file and run the script. `node scripts/prerender.js --check` fails if the HTML is out of date.
- Without JavaScript the page is shown in English; the language and theme switches and the mobile menu button are hidden, and the menu is shown as a plain list.
- New keys are added to all four files at once. If a translation is not ready yet, the key is marked as such; text is never invented.

## Stack and layout

- Plain **HTML, CSS and JavaScript** with no frameworks, libraries or bundlers in the browser.
- The only exception is the serverless function in `api/`: it may use the official Anthropic SDK (`@anthropic-ai/sdk`) and `zod` from `package.json`. Nothing from `node_modules` is ever sent to the browser.
- **Single page**.
- **Mobile-first**: base styles target phones; larger screens are handled with `min-width` media queries. The header (brand, theme toggle, four language buttons, menu) must fit from 320 px; below 360 px the language buttons move to a second header row.
- No animated element may carry a CSS `filter` on phones: it makes mobile browsers repaint every frame (the hero shadow is desktop-only in both themes).
- **Accessibility** (a11y):
  - sufficient text contrast (WCAG AA: 4.5:1 for normal text, 3:1 for large text);
  - meaningful `alt` for every image (empty `alt=""` only for decorative ones);
  - full keyboard support, visible focus, logical Tab order;
  - semantic elements (`header`, `nav`, `main`, `section`, `footer`) and a correct heading hierarchy;
  - `label` for form fields; `aria-*` only where HTML semantics are not enough;
  - every animation is disabled by `prefers-reduced-motion`.

## Themes

- The site has a **light and a dark theme** with a toggle in the header.
- On the first visit the theme follows the visitor's system setting; after that the visitor's choice is remembered.
- The theme is applied by a small inline script in `<head>` before the first paint, so there is no flash.
- All colours are CSS variables; every new colour needs a value for both themes, and text must meet WCAG AA contrast in both.

## SEO and link previews

- `<title>`, `<meta name="description">` and Open Graph (`og:title`, `og:description`, `og:image`, `og:url`) are written **directly in the HTML**, not via JavaScript, because LinkedIn and Telegram read previews from static HTML only.
- These tags are in **English**.
- These tags are written by hand (not generated); their content also comes from `content/facts.md`.

## Inquiry form

The form follows the site's own pattern: incoming text → AI structures it → the right person gets an action.

### Fields and limits

- Fields: **name** (2–80 characters), **contact** (an email address or a Telegram username, up to 100), **process description** (20–2000), a required **consent checkbox**, a hidden **honeypot** field and a hidden form-start time. The current UI language is sent along.
- The same limits are checked in the browser and in `api/lead.js`; the server is the authority and rejects anything else.
- All texts (labels, hints, errors, consent, success and failure messages) live in the translation files, in all four languages, and the English ones are prerendered like the rest of the page.

### Consent and privacy (RODO/GDPR)

- A required **consent checkbox**. **The form cannot be sent without consent**: the browser blocks it and the server rejects any request without `consent: true`.
- The consent text (version `v1`) says, in plain words: the data goes to Olena to reply to the inquiry; it is sorted by an AI service (Claude by Anthropic) and delivered to her via Telegram; Anthropic and Telegram process it as service providers, including outside the EU; it is not stored on the website; Olena keeps it until the conversation ends, for no longer than 12 months; and deletion can be requested by email. Any change to the wording gets a new version (`v2`, …) in `js/form.js` and `api/_lib/validate.js`.
- The Telegram message records when consent was given and which version of the consent text was shown.
- The browser talks only to the site's own `/api/lead`; no cookies and no third-party requests are added.

### Serverless function `api/lead.js`

Order: validate → spam checks → Claude → Telegram → reply to the visitor. Helpers live in `api/_lib/` (files starting with `_` are not routes).

- **Bots:** if the honeypot is filled or the form was sent in under 3 seconds, answer as if it succeeded and send nothing.
- **Origin:** requests must come from the production domain or from the deployment's own URL (Vercel system variables `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL`), so every Preview deployment accepts requests from itself. Extra origins only via `ALLOWED_ORIGINS`.
- **Rate limit:** a best-effort per-IP limit (5 per 10 minutes) in production only; real rate limiting comes with the database.
- **Spam or injection flagged by the AI** (`spam_likelihood: "high"` or `injection_suspected: true`): never dropped silently. The lead is sent to Olena with a ⚠️ mark, and the visitor sees the neutral confirmation.
- **Claude:** model `claude-haiku-5-5` through the official SDK, `effort: "low"`, structured outputs with a strict JSON schema (enums wherever possible), a short timeout, and the result validated again in code. Fields: `service`, `process`, `department`, `urgency`, `team_size`, `summary`, `first_question`, `reply_for_visitor`, `visitor_language`, `spam_likelihood`, `injection_suspected`. `service` is one of the four services in `facts.md` or `other`; unknown facts are `unknown`, never guessed.
- **Fallback:** on any Claude failure (timeout, API error, refusal, output that fails validation) the lead still reaches Olena as raw text, marked as unclassified, and the visitor sees a neutral confirmation.
- **Telegram:** Bot API `sendMessage` with `parse_mode: "HTML"`; every dynamic value is HTML-escaped (also inside link attributes); the message stays under Telegram's 4096-character limit by cutting the original text with a "… [обрізано]" mark. Layout, in Ukrainian:
  - ⚠️ warnings first (no classification, possible injection, possible spam, blocked automatic reply, summary not Ukrainian, name in the reply, reply language mismatch);
  - "🆕 Нова заявка" in bold, then the service in bold;
  - contact block: name in bold, a clickable contact (`mailto:` for email, `https://t.me/` for a Telegram username), site language and inquiry language on one line;
  - "📋 Розбір" list (process, department, team, urgency), "💡 Суть" in Ukrainian, "❓ Перше питання" in italics in the client's language;
  - the original text in `<blockquote expandable>`;
  - a small italic footer: consent version, time in Europe/Warsaw, spam likelihood.
- **Field order and languages:** the schema generates `process` and `summary` first (always Ukrainian, for Olena), then `visitor_language`, then `first_question` and `reply_for_visitor` (in the `visitor_language`, for the visitor), then the rest. The prompt states this in numbered steps with a Polish and an English example, and the live tests check every field's language (see `docs/test-log.md`, live tests 1–3).
- **Ukrainian check and one retry:** `olenaTextProblem` in `api/_lib/language.js` rejects `process` or `summary` with Polish letters, Latin and Cyrillic mixed in one part of a word (hyphenated words such as «SEO-посилання» or «IT-відділ» are checked part by part), under 80% Cyrillic (Latin acronyms of 2–5 capitals and tool names such as Excel, WhatsApp, CRM do not count) or Russian-only letters. The reason for a retry is kept as `retry_reason` and returned only in the Preview debug output. Claude is then asked once more with a correction built only from fixed codes (never model or visitor text), within the time budget (retry timeout 8 s, skipped after 14 s). If it is still not Ukrainian, the lead is sent as it is with "⚠️ summary не українською" first.
- **Reply language guard:** `api/_lib/language.js` checks the reply against `visitor_language` by script (pl/en: Latin without Cyrillic; uk: Ukrainian letters; ru: Cyrillic without Ukrainian letters). On a mismatch the visitor sees the neutral confirmation and the Telegram message starts with "⚠️ Мова автовідповіді не збіглася з мовою заявки".
- **If Telegram fails**, the visitor is told honestly that the message was not delivered and is shown the email and Telegram contacts (with no database yet, the lead would otherwise be lost).
- **Visitor reply:** the model writes `reply_for_visitor` as one or two impersonal sentences about what the inquiry is about (the visitor's language, no first person and no gendered verbs, only a short thanks; no names, no closing sentence, no promises about price or timing). The code (`api/_lib/reply.js`) removes any sentence about Olena the model still wrote and adds the fixed closing in the reply language: en "Olena will reply personally.", pl "Olena odpowie osobiście.", uk "Олена відповість особисто.", ru "Елена ответит лично.", English for other languages. A reply with a person's name is hidden and the Telegram message warns "⚠️ Автовідповідь заблоковано: схоже на ім'я «…»". Only three things count as a name: the visitor's own name (matched against capitalised words, also declined), a list of frequent first names, and any variant or misspelling of Olena's name (Ольга, Helena, Alona…); capitalised words on their own are not names. The reply is shown as plain text (`textContent`, length-capped), with no label; the use of AI is disclosed in the consent text. A reply containing a link, contact or markup, or written in another language than the inquiry, is never shown. If the AI failed or flagged spam or an injection attempt, a neutral confirmation is shown instead.
- **Debug output:** classification details are returned only when `VERCEL_ENV` is `preview` and the request has `x-lead-debug: 1` (used by the live test script); production never returns them.

### Prompt-injection defence

- The visitor's text is **data, not instructions**: it is sent JSON-escaped inside clearly marked tags in the user message, and the system prompt says never to follow instructions found there.
- The model has no tools and no access to anything; its output is limited by the schema, free-text fields are length-capped in code, and model text is never inserted as HTML anywhere.

### Configuration

- Environment variables, set only in Vercel: `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`. `.env.example` lists the names without values.
- The function runs in an EU region (`fra1`, set in `vercel.json`).

### Tests

- `node scripts/test-lead.js` runs the handler with mocked Claude and Telegram responses and must pass before every commit that touches the form: valid leads in all languages, empty and too-long fields, a bad contact, missing consent, honeypot, too-fast submit, wrong origin, wrong method, Claude timeout, API error, refusal and invalid output, Telegram failure, and HTML in every field.
- `scripts/live-test-lead.mjs` runs 17 cases against a Preview deployment with the real Claude API and Telegram (spam, prompt injection, other languages, HTML, bots, validation; `--ai-down` checks the fallback). It prints the checks version and commit first (so an outdated copy is easy to spot) and the reason for any retry; it checks that the visible reply has no names, is not in the first person and ends with exactly one closing sentence in the right language. Attack words must never appear in `reply_for_visitor` or `first_question`; in `summary` and `process` they are allowed only when `injection_suspected` is true. It refuses to run against production, costs a fraction of a cent and runs only with Olena's approval; instructions are in the README.

### Later (separate stage)

- Storing leads in PostgreSQL (Neon) and a weekly report.

## Hosting

- **Vercel**, free plan (Hobby).
- The inquiry form will come later and will be handled by a **Vercel serverless function** (`api/` folder).

## Security

- **No keys, tokens, passwords or webhook URLs with secrets in the repository.**
- Secrets are stored only in **Vercel Environment Variables**.
- `.env*` files are listed in `.gitignore`. Only `.env.example` with variable names and no values may be committed.
- Before every commit, check that no secrets ended up in the diff.

## Content

- **Never invent** facts, figures, testimonials, clients, case studies, job titles or results.
- The single source of truth about Olena is **`content/facts.md`** (provided by Olena).
- If a section lacks facts, leave an explicit placeholder (for example `TODO: data needed from facts.md`) and say so, instead of filling it with sample text.

## Documentation

- **All documentation in the repository is in English**: `README.md`, `CLAUDE.md`, code comments and commit messages.
- Exception: `content/facts.md` is Olena's source content and stays as she provides it.

## Privacy

- No cookies, no analytics, no third-party requests from the browser (fonts are served from the site). The only browser storage is `localStorage` for the visitor's own language and theme choice, so no consent banner is needed. Adding any tracking or third-party embed requires revisiting this.
- Inquiry form data leaves the site only from the serverless function, to Anthropic (classification) and Telegram (delivery), as stated in the consent text. Nothing is logged or stored by the function; logs contain no form content.

## Git

- Small commits, each with one logical change.
- Commit messages in **English**, clear, in the imperative mood: `Add language switcher`, `Fix contrast in hero section`.

## Workflow

- **Before each change**, briefly describe the plan: what will change and in which files.
- **After the change**, briefly summarise what changed and **how to check it** (what to open, what to click, what should appear).
- Replies to Olena in chat stay in the language she writes in.
