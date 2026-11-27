#!/usr/bin/env node
/*
 * Checks translations: every language has the same keys, no value is empty,
 * and every key used in index.html exists. Run: node scripts/check-i18n.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const langs = ['en', 'pl', 'uk', 'ru'];
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const lang of langs) {
  vm.runInContext(fs.readFileSync(path.join(root, 'i18n', `${lang}.js`), 'utf8'), sandbox);
}
const dicts = sandbox.window.I18N;

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const used = new Set();
for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) used.add(m[1]);
for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
  m[1].split('|').forEach((pair) => used.add(pair.split(':')[1].trim()));
}
used.add('meta.title');

// Keys used only from JavaScript (for example form errors): quoted strings in js/*.js
// that look like a key and start with a known key prefix.
const prefixes = new Set(langs.flatMap((l) => Object.keys(dicts[l] || {})).map((k) => k.split('.')[0]));
for (const file of fs.readdirSync(path.join(root, 'js')).filter((f) => f.endsWith('.js'))) {
  const code = fs.readFileSync(path.join(root, 'js', file), 'utf8');
  for (const m of code.matchAll(/['"]([a-z]+(?:\.[A-Za-z0-9]+)+)['"]/g)) {
    if (prefixes.has(m[1].split('.')[0])) used.add(m[1]);
  }
}

const allKeys = new Set(langs.flatMap((l) => Object.keys(dicts[l] || {})));
let errors = 0;
for (const lang of langs) {
  const dict = dicts[lang] || {};
  for (const key of allKeys) {
    if (!(key in dict)) { console.error(`[${lang}] missing key: ${key}`); errors++; }
    else if (String(dict[key]).trim() === '') { console.error(`[${lang}] empty value: ${key}`); errors++; }
  }
  for (const key of used) {
    if (!(key in dict)) { console.error(`[${lang}] key used in HTML or JS but not defined: ${key}`); errors++; }
  }
}
for (const key of allKeys) if (!used.has(key)) console.warn(`unused key: ${key}`);

console.log(`${allKeys.size} keys, ${used.size} used in HTML and JS, ${errors} error(s)`);
process.exit(errors ? 1 : 0);
