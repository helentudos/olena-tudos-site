#!/usr/bin/env node
/*
 * Writes the English texts from i18n/en.js into index.html, so the page works
 * without JavaScript and search engines see the content. JavaScript still swaps
 * languages at runtime. Never edit text in index.html by hand: edit i18n/en.js
 * and run this script.
 *
 *   node scripts/prerender.js          update index.html
 *   node scripts/prerender.js --check  exit 1 if index.html is out of date
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'i18n', 'en.js'), 'utf8'), sandbox);
const dict = sandbox.window.I18N.en;

const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => escText(s).replace(/"/g, '&quot;');
function t(key) {
  if (!(key in dict) || dict[key] === '') throw new Error(`Missing English text for key: ${key}`);
  return dict[key];
}

const source = fs.readFileSync(htmlPath, 'utf8');
let html = source;

// 1. Text of elements with data-i18n (they are leaf elements: no child tags)
let textCount = 0;
html = html.replace(/<([a-z0-9]+)(\s(?:[^>]*?\s)?data-i18n="([^"]+)"[^>]*)>([^<]*)<\/\1>/gi, (m, tag, attrs, key) => {
  textCount++;
  return `<${tag}${attrs}>${escText(t(key))}</${tag}>`;
});

// 2. Attributes listed in data-i18n-attr="attr:key|attr:key"
let attrCount = 0;
html = html.replace(/<[a-z0-9]+\s[^>]*data-i18n-attr="([^"]+)"[^>]*>/gi, (tagText, spec) => {
  let out = tagText;
  spec.split('|').forEach((pair) => {
    const [attr, key] = pair.split(':').map((x) => x.trim());
    const value = escAttr(t(key));
    const re = new RegExp(`\\s${attr}="[^"]*"`);
    out = re.test(out) ? out.replace(re, ` ${attr}="${value}"`) : out.replace(' data-i18n-attr=', ` ${attr}="${value}" data-i18n-attr=`);
    attrCount++;
  });
  return out;
});

const expected = (source.match(/\sdata-i18n="/g) || []).length;
if (textCount !== expected) {
  console.error(`Only ${textCount} of ${expected} data-i18n elements were filled; is one of them not a leaf element?`);
  process.exit(1);
}

if (process.argv.includes('--check')) {
  if (html !== source) {
    console.error('index.html is out of date: run node scripts/prerender.js');
    process.exit(1);
  }
  console.log(`index.html is up to date (${textCount} texts, ${attrCount} attributes)`);
} else {
  fs.writeFileSync(htmlPath, html);
  console.log(`index.html updated (${textCount} texts, ${attrCount} attributes)`);
}
