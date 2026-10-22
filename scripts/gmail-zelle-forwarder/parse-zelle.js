/**
 * Pure Chase Zelle alert parser. Google Apps Script pastes this file at the
 * top of Code.gs. Node tests import it. Keep the two copies identical.
 */
function parseZelleAlert(input) {
  var source = input || {};
  var plain = source.plain || source.text || '';
  var fromPlain = parseZelleNormalized(normalizeZelleText(plain));
  if (fromPlain.ok) return fromPlain;
  if (source.html) {
    var fromHtml = parseZelleNormalized(normalizeZelleText(htmlToZelleText(source.html)));
    if (fromHtml.ok) return fromHtml;
  }
  return fromPlain.ok ? fromPlain : { ok: false, error: fromPlain.error || 'This alert could not be read.' };
}

function htmlToZelleText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function normalizeZelleText(value) {
  return String(value || '')
    .replace(/\u00ae/g, '')
    .replace(/&#174;|&reg;/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r\n?/g, '\n');
}

function parseZelleNormalized(text) {
  var amountMatch = /Amount\s*:\s*\$?\s*([0-9][0-9,]*\.\d{2})/i.exec(text);
  var sentMatch = /Sent on\s*:\s*([A-Za-z]{3,9}\.?\s+[0-9]{1,2},\s+[0-9]{4})/i.exec(text);
  var txnMatch = /Transaction number\s*:\s*([0-9]{6,22})/i.exec(text);
  var memoMatch = /Memo\s*:\s*([^\n]*)/i.exec(text);
  var sender = zelleSenderName(text);
  if (!amountMatch || !sentMatch || !txnMatch || !sender) {
    return { ok: false, error: 'The Chase alert is missing the sender, amount, date, or transaction number.' };
  }
  var amountCents = zelleDollarsToCents(amountMatch[1]);
  var sentOn = zelleSentOnToIso(sentMatch[1]);
  if (amountCents == null || !sentOn) {
    return { ok: false, error: 'The amount or sent-on date could not be read.' };
  }
  var memo = memoMatch ? cleanZelleMemo(memoMatch[1]) : '';
  return {
    ok: true,
    senderName: sender,
    amount: centsToZelleDollars(amountCents),
    amountCents: amountCents,
    sentOn: sentOn,
    transactionNumber: txnMatch[1],
    memo: memo,
  };
}

function zelleSenderName(text) {
  var match = /sent you money/i.exec(text);
  if (!match) return '';
  var before = text.slice(0, match.index).replace(/[\[\]]/g, ' ');
  var words = before.split(/\s+/);
  var stop = { CHASE: 1, ZELLE: 1, PAYMENT: 1, BADGE: 1 };
  var name = [];
  var i;
  for (i = words.length - 1; i >= 0 && name.length < 6; i -= 1) {
    var word = String(words[i] || '').replace(/^[^A-Za-z]+|[^A-Za-z.'’-]+$/g, '');
    if (!word) continue;
    if (stop[word.toUpperCase()]) {
      if (name.length) break;
      continue;
    }
    if (!/^[A-Za-z][A-Za-z.'’-]*$/.test(word)) break;
    name.unshift(word);
  }
  return name.join(' ');
}

function cleanZelleMemo(value) {
  var memo = String(value || '').replace(/\s+/g, ' ').trim();
  memo = memo.replace(/\s+is registered\b[\s\S]*$/i, '').trim();
  memo = memo.replace(/\s+questions\?[\s\S]*$/i, '').trim();
  return memo;
}

function zelleDollarsToCents(raw) {
  var cleaned = String(raw || '').replace(/[$,\s]/g, '');
  var match = /^(\d+)\.(\d{2})$/.exec(cleaned);
  if (!match) return null;
  var cents = Number(match[1]) * 100 + Number(match[2]);
  if (!isFinite(cents)) return null;
  return cents;
}

function centsToZelleDollars(cents) {
  var whole = Math.floor(cents / 100);
  var rest = String(cents % 100);
  if (rest.length < 2) rest = '0' + rest;
  return whole + '.' + rest;
}

function zelleSentOnToIso(label) {
  var match = /^([A-Za-z]{3,9})\.?\s+([0-9]{1,2}),\s+([0-9]{4})$/.exec(String(label || '').trim());
  if (!match) return '';
  var months = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  var month = months[match[1].slice(0, 3).toLowerCase()];
  var day = Number(match[2]);
  var year = Number(match[3]);
  if (!month || day < 1 || day > 31 || year < 2000) return '';
  var utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return '';
  var monthText = month < 10 ? '0' + month : String(month);
  var dayText = day < 10 ? '0' + day : String(day);
  return year + '-' + monthText + '-' + dayText;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseZelleAlert: parseZelleAlert };
}
