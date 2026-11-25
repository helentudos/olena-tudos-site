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

- The site has three languages: **English (en)**, **Polish (pl)**, **Ukrainian (uk)**.
- **English is the default language.** The page opens in English unless the visitor has chosen another language before; the browser language is not used.
- The language switcher lists **EN first**, then PL and UA. The chosen language is remembered between visits, and the `lang` attribute on `<html>` is updated.
- **All texts live in separate translation files** (one per language). HTML contains no text content, only keys (for example `data-i18n="hero.title"`).
- New keys are added to all three files at once. If a translation is not ready yet, the key is marked as such; text is never invented.

## Stack and layout

- Plain **HTML, CSS and JavaScript** with no frameworks, libraries or bundlers.
- **Single page**.
- **Mobile-first**: base styles target phones; larger screens are handled with `min-width` media queries.
- **Accessibility** (a11y):
  - sufficient text contrast (WCAG AA: 4.5:1 for normal text, 3:1 for large text);
  - meaningful `alt` for every image (empty `alt=""` only for decorative ones);
  - full keyboard support, visible focus, logical Tab order;
  - semantic elements (`header`, `nav`, `main`, `section`, `footer`) and a correct heading hierarchy;
  - `label` for form fields; `aria-*` only where HTML semantics are not enough;
  - every animation is disabled by `prefers-reduced-motion`.

## SEO and link previews

- `<title>`, `<meta name="description">` and Open Graph (`og:title`, `og:description`, `og:image`, `og:url`) are written **directly in the HTML**, not via JavaScript, because LinkedIn and Telegram read previews from static HTML only.
- These tags are in **English**.
- This is the only exception to the "no text in HTML" rule. Their content also comes from `content/facts.md`.

## Inquiry form

- A required **consent checkbox for personal data processing (RODO/GDPR)** with a short text in all three languages (texts in the translation files).
- **The form cannot be sent without consent.** This is checked both in the browser and in the serverless function.

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

## Git

- Small commits, each with one logical change.
- Commit messages in **English**, clear, in the imperative mood: `Add language switcher`, `Fix contrast in hero section`.

## Workflow

- **Before each change**, briefly describe the plan: what will change and in which files.
- **After the change**, briefly summarise what changed and **how to check it** (what to open, what to click, what should appear).
- Replies to Olena in chat stay in the language she writes in.
