'use strict';
/*
 * Builds and sends the Telegram message about a new inquiry.
 * parse_mode is HTML, so every dynamic value goes through escapeHtml.
 * Labels are in Ukrainian: the message is for Olena.
 */

const TELEGRAM_LIMIT = 4096;
const SEND_TIMEOUT_MS = 5000;

const SERVICE_LABELS = {
  incoming_requests: 'Вхідні заявки → структура і маршрутизація',
  voice_documents: 'Голос і документи → дані',
  internal_requests: 'Внутрішні запити команди',
  manager_reports: 'Звіти для керівника',
  other: 'Інше',
};
const DEPARTMENT_LABELS = {
  sales: 'продажі', marketing: 'маркетинг', customer_support: 'підтримка клієнтів', operations: 'операції',
  hr: 'HR', it: 'IT', procurement: 'закупівлі', finance: 'фінанси', management: 'керівництво',
  other: 'інше', unknown: 'не вказано',
};
const URGENCY_LABELS = { low: 'низька', medium: 'середня', high: 'висока', unknown: 'не вказано' };
const LANGUAGE_LABELS = { en: 'en', pl: 'pl', uk: 'uk', other: 'інша' };

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function line(label, value) {
  return `<b>${escapeHtml(label)}:</b> ${escapeHtml(value)}`;
}

/**
 * @param {object} lead            validated lead
 * @param {object} classification  { ok, result } or { ok: false, reason }
 * @param {object} meta            { consentAt: ISO string, flags: { spam, injection } }
 */
function formatMessage(lead, classification, meta) {
  const header = [];
  const body = [];
  const r = classification.ok ? classification.result : null;

  if (!r) {
    header.push(`⚠️ <b>Заявка без класифікації</b> (AI: ${escapeHtml(classification.reason)})`);
  } else {
    if (meta.flags.injection) header.push('⚠️ <b>Можлива спроба prompt injection</b>');
    if (meta.flags.spam) header.push('⚠️ <b>Можливий спам</b>');
    header.push(`🆕 <b>Нова заявка</b> · ${escapeHtml(SERVICE_LABELS[r.service] || r.service)}`);
  }

  body.push(line('Ім\'я', lead.name));
  body.push(line('Контакт', lead.contact.value) + (lead.contact.type === 'telegram' ? ' (Telegram)' : ''));
  body.push(line('Мова сайту', lead.uiLanguage));

  if (r) {
    body.push('');
    body.push(line('Процес', r.process || '—'));
    body.push(line('Відділ', DEPARTMENT_LABELS[r.department]) + ' · ' + line('Терміновість', URGENCY_LABELS[r.urgency]) + ' · ' + line('Команда', r.team_size === 'unknown' ? 'не вказано' : r.team_size));
    body.push(line('Мова заявки', LANGUAGE_LABELS[r.visitor_language]) + ' · ' + line('Спам', r.spam_likelihood));
    body.push(line('Суть', r.summary || '—'));
    body.push(line('Перше питання', r.first_question || '—'));
    if (r.reply_blocked) body.push('<i>Автовідповідь відвідувачу заблоковано: в ній були посилання або контакти.</i>');
  }

  const footer = [
    '',
    line('Згода', `${meta.consentAt} UTC, версія тексту ${lead.consentVersion}`),
  ];

  const build = (description) => [
    ...header,
    '',
    ...body,
    '',
    '<b>Оригінал:</b>',
    `<blockquote expandable>${escapeHtml(description)}</blockquote>`,
    ...footer,
  ].join('\n');

  let message = build(lead.description);
  // Keep under Telegram's limit by shortening the original text if needed.
  let keep = lead.description.length;
  while (message.length > TELEGRAM_LIMIT && keep > 0) {
    keep = Math.max(0, keep - Math.max(50, message.length - TELEGRAM_LIMIT));
    message = build(lead.description.slice(0, keep) + '… [обрізано]');
  }
  return message;
}

/** Sends the message. Returns { ok: true } or { ok: false, reason }. */
async function sendTelegram(text, { fetch, token, chatId }) {
  if (!token || !chatId) return { ok: false, reason: 'not_configured' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return { ok: false, reason: `telegram_${res.status}` };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: `telegram_${(error && error.name) || 'error'}` };
  }
}

module.exports = { TELEGRAM_LIMIT, escapeHtml, formatMessage, sendTelegram };
