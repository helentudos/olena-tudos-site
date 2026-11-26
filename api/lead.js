'use strict';
/*
 * POST /api/lead — Vercel serverless function for the inquiry form.
 * The flow lives in api/_lib/handle.js; this file only adapts Vercel's
 * request/response and creates the Claude client from environment variables.
 */

const Anthropic = require('@anthropic-ai/sdk').default;
const { handleLead, createRateLimiter } = require('./_lib/handle');

const rateLimiter = createRateLimiter();
let client = null;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 10000, // ms; the function itself may run up to 30 s
      maxRetries: 1,
    });
  }
  return client;
}

module.exports = async function handler(req, res) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers || {})) headers[key.toLowerCase()] = value;

  // Vercel parses JSON lazily; invalid JSON throws when req.body is read.
  let body = null;
  let bodyError = false;
  const rawLength = Number(headers['content-length'] || 0);
  if (req.method === 'POST' && rawLength <= 10000) {
    try {
      body = req.body;
    } catch (error) {
      bodyError = true;
    }
  }

  const ip = String(headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const result = await handleLead(
    { method: req.method, headers, body, rawLength, bodyError, ip },
    { env: process.env, client: getClient(), fetch: globalThis.fetch, now: Date.now, rateLimiter },
  );

  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value);
  res.status(result.status).json(result.body);
};
