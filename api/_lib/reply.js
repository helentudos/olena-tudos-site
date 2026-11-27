'use strict';
/*
 * The automatic reply shown to the visitor (live test 6).
 *
 * The model writes one or two sentences about what it understood, without names
 * and without a closing sentence. This module:
 *   - removes a closing sentence the model may still write about Olena, so the
 *     closing appears exactly once;
 *   - finds anything that looks like a person's name (the model once wrote
 *     "Ольга ответит вам лично" instead of Елена), so the reply can be hidden;
 *   - adds the fixed closing sentence in the reply language (English for "other").
 * No dependencies, so scripts/live-test-lead.mjs can load it as well.
 */

const CLOSINGS = {
  en: 'Olena will reply personally.',
  pl: 'Olena odpowie osobiście.',
  uk: 'Олена відповість особисто.',
  ru: 'Елена ответит лично.',
};
const closingFor = (lang) => CLOSINGS[lang] || CLOSINGS.en;

// Olena's own name in the forms the model uses (any case ending)
const OWN_NAME = /(^|[^\p{L}])(Olen[ay]|Helen[ay]|Elen[ay]|Олен[аиіоу]|Елен[аыеуо])(?![\p{L}])/iu;

// Capitalised words that are not names: tools, services and their Cyrillic spellings
const TOOL_NAMES = new Set([
  'Excel', 'WhatsApp', 'Telegram', 'Viber', 'Signal', 'Messenger', 'Gmail', 'Outlook', 'Google', 'Sheets', 'Docs',
  'Drive', 'Calendar', 'Maps', 'Slack', 'Teams', 'Microsoft', 'Office', 'Zoom', 'Skype', 'Notion', 'Jira', 'Trello',
  'Asana', 'Zoho', 'Klaviyo', 'Wix', 'Typeform', 'Odoo', 'Make', 'Zapier', 'PostgreSQL', 'Facebook', 'Instagram',
  'LinkedIn', 'Shopify', 'Allegro', 'Dropbox', 'Bitrix24', 'HubSpot', 'Salesforce', 'Pipedrive', 'SAP', 'Comarch',
]);
const CYRILLIC_TOOL_STEMS = /^(Телеграм|Вайбер|Вотсап|Ватсап|Ексел|Эксел|Гугл|Слак|Інстаграм|Инстаграм|Фейсбук|Скайп|Зум|Джир|Трелл|Ноушн|Бітрікс|Битрикс)/;
// English capitalises these in the middle of a sentence
const ENGLISH_CAPITALISED = new Set([
  'I', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
  'English', 'Polish', 'Ukrainian', 'Russian', 'German', 'European', 'EU',
]);
// Frequent first names, to catch a name at the start of a sentence
const FIRST_NAMES = new Set([
  'Ольга', 'Olga', 'Olha', 'Анна', 'Anna', 'Марія', 'Мария', 'Maria', 'Ірина', 'Ирина', 'Irina', 'Iryna', 'Наталія',
  'Наталья', 'Natalia', 'Тетяна', 'Татьяна', 'Tatiana', 'Юлія', 'Юлия', 'Julia', 'Оксана', 'Oksana', 'Світлана',
  'Светлана', 'Катерина', 'Екатерина', 'Katarzyna', 'Agnieszka', 'Małgorzata', 'Joanna', 'Magdalena', 'Ewa', 'Monika',
  'Karolina', 'Aleksandra', 'Іван', 'Иван', 'Ivan', 'Jan', 'Piotr', 'Paweł', 'Tomasz', 'Michał', 'Krzysztof', 'Marek',
  'Олександр', 'Александр', 'Alexander', 'Сергій', 'Сергей', 'Андрій', 'Андрей', 'Дмитро', 'Дмитрий', 'Микола',
  'Николай', 'John', 'Michael', 'David', 'James', 'Mary', 'Sarah', 'Emma', 'Max', 'Jonas',
]);

// Tool names are declined in Polish and Ukrainian (Gmaila, Excela, Telegramie): a tool
// name with an ending of up to 3 letters is still a tool name.
const isToolName = (word) => TOOL_NAMES.has(word) || CYRILLIC_TOOL_STEMS.test(word) ||
  [...TOOL_NAMES].some((tool) => tool.length >= 4 && word.startsWith(tool) && word.length - tool.length <= 3);

const sentencesOf = (text) => String(text || '').trim().split(/(?<=[.!?…])\s+/u).filter(Boolean);
const wordsOf = (sentence) => sentence.match(/[\p{L}][\p{L}'’]*/gu) || [];

/** Removes sentences that mention Olena (the model's own closing sentence). */
function stripOwnClosing(text) {
  const kept = sentencesOf(text).filter((s) => !OWN_NAME.test(s));
  return kept.join(' ').trim();
}

/**
 * Returns the first word that looks like a person's name, or null.
 * @param {string} text  reply without the fixed closing sentence
 * @param {object} opts  { lang, visitorName }
 */
function findNameLike(text, { lang = 'en', visitorName = '' } = {}) {
  const visitorParts = wordsOf(visitorName).filter((w) => w.length >= 3).map((w) => w.toLowerCase());
  for (const sentence of sentencesOf(text)) {
    const words = wordsOf(sentence);
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const lower = word.toLowerCase();
      if (OWN_NAME.test(word)) return word;
      if (visitorParts.some((p) => lower === p || (p.length >= 4 && lower.startsWith(p)))) return word;
      if (FIRST_NAMES.has(word)) return word;
      // A capital letter in the middle of a sentence: a name unless it is a known
      // tool, an acronym or an English capitalised word. German capitalises every
      // noun, so for "other" languages only the lists above are used.
      if (i === 0 || lang === 'other' || !/^\p{Lu}/u.test(word)) continue;
      if (isToolName(word)) continue;
      if (/^\p{Lu}{2,5}$/u.test(word)) continue;
      if (lang === 'en' && ENGLISH_CAPITALISED.has(word)) continue;
      return word;
    }
  }
  return null;
}

/** Model text plus the fixed closing sentence in the reply language. */
function withClosing(text, lang) {
  return `${String(text).trim()} ${closingFor(lang)}`;
}

module.exports = { CLOSINGS, closingFor, stripOwnClosing, findNameLike, withClosing };
