'use strict';
/*
 * Builds and sends the Telegram message about a new inquiry.
 * parse_mode is HTML, so every dynamic value goes through escapeHtml.
 * Labels are in Ukrainian: the message is for Olena.
 */

const TELEGRAM_LIMIT = 4096;
const SEND_TIMEOUT_MS = 5000;

const SERVICE_LABELS = {
  incoming_requests: 'Вхідні заявки → маршрутизація',
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
const LANGUAGE_LABELS = { en: 'EN', pl: 'PL', uk: 'UA', ru: 'RU', other: 'інша' };
const TRUNCATED = '… [обрізано]';
const OLENA_PROBLEM_LABELS = {
  empty: 'порожньо',
  polish_letters: 'польські літери',
  mixed_script: 'латиниця й кирилиця в одному слові',
  no_cyrillic: 'немає українського тексту',
  low_cyrillic: 'замало кирилиці',
  russian_letters: 'російські літери',
  no_ukrainian_letters: 'немає українських літер',
};

/** Escapes text for Telegram HTML (also safe inside attribute values). */
function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Clickable contact: mailto: for email, https://t.me/ for a Telegram username. */
function contactLine(contact) {
  if (contact.type === 'email') {
    return `✉️ <a href="mailto:${escapeHtml(contact.value)}">${escapeHtml(contact.value)}</a>`;
  }
  const username = contact.value.replace(/^@/, '');
  return `💬 <a href="https://t.me/${escapeHtml(username)}">@${escapeHtml(username)}</a>`;
}

/** "27.11 22:26" in Europe/Warsaw (CET/CEST), independent of the server time zone. */
function warsawTime(ms) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return `${parts.day}.${parts.month} ${parts.hour}:${parts.minute}`;
}

const teamLabel = (size) => (size === 'unknown' ? 'не вказано' : size.replace('-', '–'));

/**
 * @param {object} lead            validated lead
 * @param {object} classification  { ok, result } or { ok: false, reason }
 * @param {object} meta            { consentTime: ms timestamp, flags: { spam, injection } }
 */
function formatMessage(lead, classification, meta) {
  const r = classification.ok ? classification.result : null;

  // Warnings always come first
  const warnings = [];
  if (!r) warnings.push(`⚠️ <b>Без класифікації</b> (AI: ${escapeHtml(classification.reason)})`);
  if (meta.flags.injection) warnings.push('⚠️ <b>Можлива спроба prompt injection</b>');
  if (meta.flags.spam) warnings.push('⚠️ <b>Можливий спам</b>');
  if (r && r.reply_blocked) warnings.push('⚠️ Автовідповідь відвідувачу заблоковано: в ній були посилання або контакти');
  if (r && r.olena_language_problem) {
    const why = OLENA_PROBLEM_LABELS[r.olena_language_problem.code] || 'не українською';
    const retry = r.retry_skipped ? 'повтор пропущено: не вистачило часу' : r.retry_failed ? 'повторний запит не вдався' : 'і після повторного запиту';
    warnings.push(`⚠️ <b>summary не українською</b>: ${escapeHtml(r.olena_language_problem.field)} — ${why} (${retry})`);
  }
  if (r && r.reply_language_mismatch) warnings.push('⚠️ Мова автовідповіді не збіглася з мовою заявки: відвідувач побачив нейтральне підтвердження');

  const head = [
    ...warnings,
    '🆕 <b>Нова заявка</b>',
    `📥 <b>${escapeHtml(r ? SERVICE_LABELS[r.service] || r.service : 'Послуга не визначена')}</b>`,
    '',
    `👤 <b>${escapeHtml(lead.name)}</b>`,
    contactLine(lead.contact),
    `🌐 Сайт: ${LANGUAGE_LABELS[lead.uiLanguage] || escapeHtml(lead.uiLanguage)}` +
      (r ? ` · Заявка: ${LANGUAGE_LABELS[r.visitor_language] || escapeHtml(r.visitor_language)}` : ''),
  ];

  const analysis = r ? [
    '',
    '<b>📋 Розбір</b>',
    `• Процес: ${escapeHtml(r.process || '—')}`,
    `• Відділ: ${DEPARTMENT_LABELS[r.department] || escapeHtml(r.department)}`,
    `• Команда: ${escapeHtml(teamLabel(r.team_size))}`,
    `• Терміновість: ${URGENCY_LABELS[r.urgency] || escapeHtml(r.urgency)}`,
    '',
    '<b>💡 Суть</b>',
    escapeHtml(r.summary || '—'),
    '',
    '<b>❓ Перше питання</b> (мовою клієнта)',
    `<i>${escapeHtml(r.first_question || '—')}</i>`,
  ] : [];

  const footer = [
    '',
    `<i>Згода ${escapeHtml(lead.consentVersion)} · ${warsawTime(meta.consentTime)} (Варшава) · спам: ${r ? escapeHtml(r.spam_likelihood) : '—'}</i>`,
  ];

  const build = (description) => [
    ...head,
    ...analysis,
    '',
    `<blockquote expandable>📝 Оригінал заявки\n${escapeHtml(description)}</blockquote>`,
    ...footer,
  ].join('\n');

  // Keep under Telegram's limit by shortening the original text if needed.
  let message = build(lead.description);
  let keep = lead.description.length;
  while (message.length > TELEGRAM_LIMIT && keep > 0) {
    keep = Math.max(0, keep - Math.max(20, message.length - TELEGRAM_LIMIT));
    message = build(lead.description.slice(0, keep).trimEnd() + TRUNCATED);
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

module.exports = { TELEGRAM_LIMIT, escapeHtml, formatMessage, sendTelegram, warsawTime };
