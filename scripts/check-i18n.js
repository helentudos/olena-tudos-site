#!/usr/bin/env node
/*
 * Checks translations: every language has the same keys, no value is empty,
 * and every key used in index.html exists. Run: node scripts/check-i18n.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const langs = ['uk', 'pl', 'en'];
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

const allKeys = new Set(langs.flatMap((l) => Object.keys(dicts[l] || {})));
let errors = 0;
for (const lang of langs) {
  const dict = dicts[lang] || {};
  for (const key of allKeys) {
    if (!(key in dict)) { console.error(`[${lang}] missing key: ${key}`); errors++; }
    else if (String(dict[key]).trim() === '') { console.error(`[${lang}] empty value: ${key}`); errors++; }
  }
  for (const key of used) {
    if (!(key in dict)) { console.error(`[${lang}] key used in HTML but not defined: ${key}`); errors++; }
  }
}
for (const key of allKeys) if (!used.has(key)) console.warn(`unused key: ${key}`);

console.log(`${allKeys.size} keys, ${used.size} used in HTML, ${errors} error(s)`);
process.exit(errors ? 1 : 0);
