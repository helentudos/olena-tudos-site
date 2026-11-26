'use strict';
/*
 * The inquiry flow, independent of Vercel so it can be tested with mocks:
 * method → origin → content type → size → rate limit → bot check →
 * validation → Claude → Telegram → reply to the visitor.
 */

const { MAX_BODY_CHARS, validateLead, looksLikeBot, isAllowedOrigin } = require('./validate');
const { classifyLead } = require('./classify');
const { formatMessage, sendTelegram } = require('./telegram');

/** Best-effort, per-instance limit. Real rate limiting comes with the database. */
function createRateLimiter({ limit = 5, windowMs = 10 * 60 * 1000 } = {}) {
  const hits = new Map();
  return function allow(key, now) {
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear(); // keep memory bounded
    return true;
  };
}

const reply = (status, body, headers = {}) => ({ status, body, headers });

/**
 * @param {object} req   { method, headers (lower-case keys), body, rawLength, bodyError, ip }
 * @param {object} deps  { env, client, fetch, now, rateLimiter }
 */
async function handleLead(req, deps) {
  const { env } = deps;
  const debug = env.VERCEL_ENV === 'preview' && req.headers['x-lead-debug'] === '1';
  const withDebug = (body, info) => (debug ? { ...body, debug: info } : body);

  if (req.method !== 'POST') return reply(405, { ok: false, error: 'method' }, { Allow: 'POST' });
  if (!isAllowedOrigin(req.headers.origin, env)) return reply(403, { ok: false, error: 'origin' });
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return reply(415, { ok: false, error: 'contentType' });
  }
  if (req.rawLength > MAX_BODY_CHARS) return reply(413, { ok: false, error: 'tooLarge' });
  if (req.bodyError || !req.body || typeof req.body !== 'object') return reply(400, { ok: false, error: 'invalid' });
  if (JSON.stringify(req.body).length > MAX_BODY_CHARS) return reply(413, { ok: false, error: 'tooLarge' });

  const now = deps.now();
  if (env.VERCEL_ENV === 'production' && !deps.rateLimiter(req.ip || 'unknown', now)) {
    return reply(429, { ok: false, error: 'rateLimited' }, { 'Retry-After': '600' });
  }

  // Bots get a normal-looking success so they learn nothing; nothing is sent.
  if (looksLikeBot(req.body)) return reply(200, withDebug({ ok: true, reply: null }, { dropped: 'bot' }));

  const checked = validateLead(req.body);
  if (!checked.ok) return reply(400, { ok: false, error: 'invalid', fields: checked.fields });
  const lead = checked.lead;

  const classification = deps.client
    ? await classifyLead(lead, { client: deps.client })
    : { ok: false, reason: 'not_configured' };
  if (!classification.ok) console.error('[lead] classification failed:', classification.reason);

  const result = classification.ok ? classification.result : null;
  const flags = {
    spam: Boolean(result && result.spam_likelihood === 'high'),
    injection: Boolean(result && result.injection_suspected),
  };

  const consentAt = new Date(now).toISOString().slice(0, 16).replace('T', ' ');
  const sent = await sendTelegram(formatMessage(lead, classification, { consentAt, flags }), {
    fetch: deps.fetch,
    token: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
  });
  const debugInfo = { classification: classification.ok ? result : { failed: classification.reason }, flags, telegram: sent };
  if (!sent.ok) {
    console.error('[lead] telegram failed:', sent.reason);
    return reply(502, withDebug({ ok: false, error: 'delivery' }, debugInfo));
  }

  // The AI reply is shown only when classification worked and nothing was flagged.
  const showReply = result && !flags.spam && !flags.injection && result.reply_for_visitor;
  return reply(200, withDebug(
    showReply ? { ok: true, reply: result.reply_for_visitor, replyLanguage: result.visitor_language } : { ok: true, reply: null },
    debugInfo,
  ));
}

module.exports = { handleLead, createRateLimiter };
