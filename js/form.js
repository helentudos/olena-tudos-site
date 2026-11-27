/*
 * Inquiry form: browser-side validation (same rules as api/_lib/validate.js),
 * sending to /api/lead and showing the result. Messages are translation keys,
 * set via data-i18n so they follow language switches.
 */
(function () {
  'use strict';

  var form = document.getElementById('lead-form');
  if (!form || !window.fetch) return;

  var CONSENT_VERSION = 'v1';
  var LIMITS = { name: [2, 80], contact: [3, 100], description: [20, 2000] };
  var EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
  var TELEGRAM_RE = /^@?[A-Za-z0-9_]{5,32}$/;
  var TELEGRAM_LINK_RE = /^(?:https?:\/\/)?t\.me\/[A-Za-z0-9_]{5,32}\/?$/i;

  // Every message key this file can show (also read by scripts/check-i18n.js)
  var FIELD_ERRORS = {
    nameShort: 'form.error.nameShort',
    nameLong: 'form.error.nameLong',
    contactInvalid: 'form.error.contactInvalid',
    descriptionShort: 'form.error.descriptionShort',
    descriptionLong: 'form.error.descriptionLong',
    consentRequired: 'form.error.consentRequired'
  };
  var STATUS = {
    sending: 'form.sending',
    fix: 'form.error.fix',
    network: 'form.error.network',
    delivery: 'form.error.delivery',
    rateLimited: 'form.error.rateLimited',
    generic: 'form.error.generic'
  };

  var fields = {
    name: document.getElementById('lead-name'),
    contact: document.getElementById('lead-contact'),
    description: document.getElementById('lead-description'),
    consent: document.getElementById('lead-consent'),
    website: document.getElementById('lead-website')
  };
  var submit = document.getElementById('lead-submit');
  var status = document.getElementById('lead-status');
  var result = document.getElementById('lead-result');
  var shownAt = Date.now();

  function t(key) {
    return (window.i18nT && window.i18nT(key)) || '';
  }

  function setMessage(el, key) {
    if (key) {
      el.setAttribute('data-i18n', key);
      el.textContent = t(key);
      el.hidden = false;
    } else {
      el.removeAttribute('data-i18n');
      el.textContent = '';
      if (el !== status) el.hidden = true;
    }
  }

  function setFieldError(name, code) {
    var input = fields[name];
    var error = document.getElementById('lead-' + name + '-error');
    if (!input || !error) return;
    setMessage(error, code ? FIELD_ERRORS[code] : null);
    if (code) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function validate() {
    var errors = {};
    var name = clean(fields.name.value);
    if (name.length < LIMITS.name[0]) errors.name = 'nameShort';
    else if (name.length > LIMITS.name[1]) errors.name = 'nameLong';

    var contact = clean(fields.contact.value);
    var contactOk = contact.length <= LIMITS.contact[1] &&
      (EMAIL_RE.test(contact) || TELEGRAM_LINK_RE.test(contact) ||
        (TELEGRAM_RE.test(contact) && !/^\d+$/.test(contact.replace('@', ''))));
    if (!contactOk) errors.contact = 'contactInvalid';

    var description = fields.description.value.trim();
    if (description.length < LIMITS.description[0]) errors.description = 'descriptionShort';
    else if (description.length > LIMITS.description[1]) errors.description = 'descriptionLong';

    if (!fields.consent.checked) errors.consent = 'consentRequired';
    return errors;
  }

  function showErrors(errors) {
    var first = null;
    ['name', 'contact', 'description', 'consent'].forEach(function (name) {
      setFieldError(name, errors[name] || null);
      if (errors[name] && !first) first = fields[name];
    });
    if (first) {
      setMessage(status, STATUS.fix);
      first.focus();
    }
    return Boolean(first);
  }

  function setBusy(busy) {
    submit.disabled = busy;
    form.setAttribute('aria-busy', String(busy));
    setMessage(status, busy ? STATUS.sending : null);
  }

  function showResult(data) {
    var replyBox = document.getElementById('lead-reply');
    var replyText = document.getElementById('lead-reply-text');
    var willReply = document.getElementById('lead-will-reply');
    if (data.reply) {
      replyText.textContent = data.reply; // plain text only, never HTML
      if (['en', 'pl', 'uk', 'ru'].indexOf(data.replyLanguage) !== -1) replyText.lang = data.replyLanguage;
      else replyText.removeAttribute('lang');
      replyBox.hidden = false;
      willReply.hidden = true;
    } else {
      replyBox.hidden = true;
      willReply.hidden = false;
    }
    form.hidden = true;
    result.hidden = false;
    result.focus();
  }

  // Clear a field's error as soon as the visitor edits it
  ['name', 'contact', 'description'].forEach(function (name) {
    fields[name].addEventListener('input', function () { setFieldError(name, null); });
  });
  fields.consent.addEventListener('change', function () { setFieldError('consent', null); });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (submit.disabled) return;
    if (showErrors(validate())) return;

    setBusy(true);
    var payload = {
      name: fields.name.value,
      contact: fields.contact.value,
      description: fields.description.value,
      consent: fields.consent.checked,
      consent_version: CONSENT_VERSION,
      ui_language: document.documentElement.lang,
      website: fields.website.value,
      elapsed_ms: Date.now() - shownAt
    };
    var options = {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    };
    if (window.AbortSignal && AbortSignal.timeout) options.signal = AbortSignal.timeout(35000);

    fetch('/api/lead', options)
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          return { status: response.status, data: data };
        });
      })
      .then(function (res) {
        setBusy(false);
        if (res.status === 200 && res.data.ok) return showResult(res.data);
        if (res.status === 400 && res.data.fields) {
          if (showErrors(res.data.fields)) return;
        }
        if (res.status === 429) return setMessage(status, STATUS.rateLimited);
        if (res.status === 502) return setMessage(status, STATUS.delivery);
        setMessage(status, STATUS.generic);
      })
      .catch(function () {
        setBusy(false);
        setMessage(status, STATUS.network);
      });
  });
})();
