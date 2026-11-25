# olena-tudos-site

Personal landing page of **Olena Tudos**, AI Automation Specialist (n8n, PostgreSQL, LLM APIs).
Business process automation for small and medium-sized businesses.

The page explains what Olena does, shows her case studies and lets visitors send an inquiry.

## Features

- Three languages: Ukrainian, Polish, English, with a language switcher
- Single page, mobile-first, accessible (contrast, alt text, keyboard navigation)
- SEO and link previews (title, description, Open Graph) set directly in HTML

## Tech stack

- Plain HTML, CSS and JavaScript with no frameworks
- Hosting: Vercel (Hobby plan)
- Inquiry form (planned): Vercel serverless function

## Project rules

See [CLAUDE.md](CLAUDE.md). All site content comes from [content/facts.md](content/facts.md).
Secrets are stored only in Vercel environment variables, never in this repository.

## Run locally

Open `index.html` in a browser. No build step or server is needed.

Check that all translation files have the same, non-empty keys:

```bash
node scripts/check-i18n.js
```
