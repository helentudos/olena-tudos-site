'use strict';
/*
 * Validation for the inquiry form. The browser runs the same rules (js/form.js),
 * but this file is the authority: anything that does not pass is rejected.
 */

const LIMITS = {
  name: { min: 2, max: 80 },
  contact: { min: 3, max: 100 },
  description: { min: 20, max: 2000 },
};
const MIN_FILL_MS = 3000; // faster than this is treated as a bot
const MAX_BODY_CHARS = 10000;
const CONSENT_VERSIONS = ['v1'];
const UI_LANGUAGES = ['en', 'pl', 'uk', 'ru'];

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
const TELEGRAM_RE = /^@?[A-Za-z0-9_]{5,32}$/;
const TELEGRAM_LINK_RE = /^(?:https?:\/\/)?t\.me\/([A-Za-z0-9_]{5,32})\/?$/i;

/** Remove control characters (keep newlines and tabs), normalise line breaks, trim. */
function clean(value, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  let s = value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '');
  if (!multiline) s = s.replace(/\s+/g, ' ');
  else s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** Returns { type: 'email' | 'telegram', value } or null. */
function parseContact(raw) {
  const value = clean(raw);
  if (!value || value.length > LIMITS.contact.max) return null;
  if (EMAIL_RE.test(value)) return { type: 'email', value };
  const link = TELEGRAM_LINK_RE.exec(value);
  if (link) return { type: 'telegram', value: '@' + link[1] };
  if (TELEGRAM_RE.test(value) && !/^\d+$/.test(value.replace('@', ''))) {
    return { type: 'telegram', value: value.startsWith('@') ? value : '@' + value };
  }
  return null;
}

/**
 * Validate the parsed JSON body.
 * Returns { ok: true, lead } or { ok: false, fields: { field: errorCode } }.
 * Error codes match translation keys in the browser (form.error.*).
 */
function validateLead(body) {
  const fields = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, fields: { form: 'invalid' } };
  }

  const name = clean(body.name);
  if (name.length < LIMITS.name.min) fields.name = 'nameShort';
  else if (name.length > LIMITS.name.max) fields.name = 'nameLong';

  const contact = parseContact(body.contact);
  if (!contact) fields.contact = 'contactInvalid';

  const description = clean(body.description, { multiline: true });
  if (description.length < LIMITS.description.min) fields.description = 'descriptionShort';
  else if (description.length > LIMITS.description.max) fields.description = 'descriptionLong';

  // Consent must be the boolean true, not a truthy string
  if (body.consent !== true || !CONSENT_VERSIONS.includes(body.consent_version)) {
    fields.consent = 'consentRequired';
  }

  if (Object.keys(fields).length) return { ok: false, fields };

  return {
    ok: true,
    lead: {
      name,
      contact,
      description,
      uiLanguage: UI_LANGUAGES.includes(body.ui_language) ? body.ui_language : 'en',
      consentVersion: body.consent_version,
    },
  };
}

/** Honeypot filled or the form was sent too fast: a bot. */
function looksLikeBot(body) {
  const honeypot = body && typeof body.website === 'string' && body.website.trim() !== '';
  const elapsed = Number(body && body.elapsed_ms);
  const tooFast = !Number.isFinite(elapsed) || elapsed < MIN_FILL_MS;
  return honeypot || tooFast;
}

/**
 * Allowed origins: the production domain, this deployment's own URLs (Vercel
 * system variables, so every Preview deployment accepts requests from itself),
 * and anything listed in ALLOWED_ORIGINS.
 */
function allowedOrigins(env) {
  const list = new Set(['https://olena-tudos-site.vercel.app']);
  for (const key of ['VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) {
    if (env[key]) list.add('https://' + env[key].replace(/^https?:\/\//, '').replace(/\/$/, ''));
  }
  for (const origin of String(env.ALLOWED_ORIGINS || '').split(',')) {
    const o = origin.trim().replace(/\/$/, '');
    if (o) list.add(o);
  }
  return list;
}

function isAllowedOrigin(origin, env) {
  return typeof origin === 'string' && allowedOrigins(env).has(origin.replace(/\/$/, ''));
}

module.exports = {
  LIMITS,
  MIN_FILL_MS,
  MAX_BODY_CHARS,
  CONSENT_VERSIONS,
  clean,
  parseContact,
  validateLead,
  looksLikeBot,
  isAllowedOrigin,
};
