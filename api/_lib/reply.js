'use strict';
/*
 * The automatic reply shown to the visitor (live tests 6 and 7).
 *
 * The model writes one or two sentences about what it understood, without names
 * and without a closing sentence. This module:
 *   - removes a closing sentence the model may still write with Olena's correct
 *     name (Olena / Олена / Елена), so the closing appears exactly once;
 *   - finds a person's name in what is left, so the reply can be hidden. Only three
 *     things count as a name: the visitor's own name, a frequent first name, and any
 *     variant or misspelling of Olena's name (the model once wrote "Ольга").
 *     Capitalised words on their own are not names (live test 7);
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

// Olena's name as used in the closings, in any case ending: a sentence with it is the
// model's own closing sentence and is removed
const OWN_NAME = /(^|[^\p{L}])(Olen(a|y|ie|ę|ą|o)|Олен(а|и|і|у|ою|о)|Елен(а|ы|е|у|ой|о))(?![\p{L}])/u;

// Variants and misspellings of Olena's name: never in a reply (live test 6: "Ольга")
const OLENA_VARIANT = /^(Helen|Hélène|Elen|Ольг|Olg|Olh|Olya|Оля|Alyon|Alion|Alon|Alen|Алён|Ален|Альон|Олєн|Хелен|Гелен|Lena|Лена|Лєна)\p{L}{0,3}$/u;

// Frequent first names (en, pl, uk, ru)
const FIRST_NAMES = new Set([
  // en
  'John', 'Michael', 'David', 'James', 'Robert', 'William', 'Mark', 'Paul', 'Peter', 'Thomas', 'Daniel', 'Mary',
  'Sarah', 'Emma', 'Emily', 'Kate', 'Laura', 'Linda', 'Susan', 'Jessica', 'Max', 'Jonas', 'Alex',
  // pl
  'Anna', 'Maria', 'Katarzyna', 'Kasia', 'Agnieszka', 'Małgorzata', 'Joanna', 'Magdalena', 'Ewa', 'Monika',
  'Karolina', 'Aleksandra', 'Ola', 'Marta', 'Zofia', 'Agata', 'Natalia', 'Julia', 'Jan', 'Piotr', 'Paweł', 'Tomasz',
  'Michał', 'Krzysztof', 'Marek', 'Łukasz', 'Marcin', 'Jakub', 'Kamil', 'Grzegorz', 'Andrzej',
  // uk
  'Анна', 'Марія', 'Ірина', 'Наталія', 'Наталя', 'Тетяна', 'Юлія', 'Оксана', 'Світлана', 'Катерина', 'Марина',
  'Галина', 'Людмила', 'Вікторія', 'Іван', 'Олександр', 'Сергій', 'Андрій', 'Дмитро', 'Микола', 'Олег', 'Віктор', 'Петро',
  // ru
  'Мария', 'Ирина', 'Наталья', 'Татьяна', 'Юлия', 'Светлана', 'Екатерина', 'Виктория', 'Иван', 'Александр',
  'Сергей', 'Андрей', 'Дмитрий', 'Николай', 'Виктор', 'Пётр', 'Петр',
  // Latin spellings of Slavic names
  'Iryna', 'Irina', 'Oksana', 'Tatiana', 'Ivan',
]);

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
 * @param {object} opts  { visitorName }
 */
function findNameLike(text, { visitorName = '' } = {}) {
  // The visitor's name is matched only against capitalised words, so words from a
  // name field full of HTML ("<script>alert(1)</script>") do not block "alerts"
  const visitorParts = wordsOf(visitorName).filter((w) => w.length >= 3 && /^\p{Lu}/u.test(w));
  for (const word of wordsOf(text)) {
    if (!/^\p{Lu}/u.test(word)) continue;
    if (OLENA_VARIANT.test(word) || FIRST_NAMES.has(word)) return word;
    // The visitor's name, also declined (Piotr → Piotrze, Анна → Анно)
    for (const part of visitorParts) {
      if (word === part) return word;
      if (part.length >= 4 && word.startsWith(part.slice(0, -1)) && word.length - part.length <= 3) return word;
    }
  }
  return null;
}

/** Model text plus the fixed closing sentence in the reply language. */
function withClosing(text, lang) {
  return `${String(text).trim()} ${closingFor(lang)}`;
}

module.exports = { CLOSINGS, closingFor, stripOwnClosing, findNameLike, withClosing };
