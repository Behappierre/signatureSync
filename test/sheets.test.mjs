import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HEADERS,
  mapContactToRow,
  headersAreUnrecognised,
  __testing,
} from '../src/lib/sheets.ts';

const contact = {
  firstName: 'Olivier',
  lastName: 'André',
  title: 'Partner',
  company: 'Netcompany UK Ltd',
  email: 'olivier.andre@netcompany.com',
  phone: '+44 7700 900123',
  website: 'https://www.netcompany.com',
  linkedin: 'https://linkedin.com/in/olivierandre',
  address: '1 Finsbury Avenue, London',
};

test('a row lines up with the app default headers', () => {
  const row = mapContactToRow(contact, DEFAULT_HEADERS);
  assert.equal(row.length, DEFAULT_HEADERS.length);
  assert.equal(row[0], 'Olivier');
  assert.equal(row[4], 'olivier.andre@netcompany.com');
  assert.ok(row[DEFAULT_HEADERS.length - 1].length > 0, 'date added should be filled');
});

test('a row adapts to the column order of an existing sheet', () => {
  const headers = ['Email', 'Surname', 'Forename', 'Organisation'];
  assert.deepEqual(mapContactToRow(contact, headers), [
    'olivier.andre@netcompany.com',
    'André',
    'Olivier',
    'Netcompany UK Ltd',
  ]);
});

test('unknown columns are left empty rather than guessed at', () => {
  const headers = ['Email', 'Deal stage', 'Owner'];
  assert.deepEqual(mapContactToRow(contact, headers), [
    'olivier.andre@netcompany.com',
    '',
    '',
  ]);
});

test('header matching ignores case, spacing and underscores', () => {
  const headers = ['  E-MAIL  ', 'first_name', 'Job Title'];
  assert.deepEqual(mapContactToRow(contact, headers), [
    'olivier.andre@netcompany.com',
    'Olivier',
    'Partner',
  ]);
});

test('a source column receives the raw signature', () => {
  const row = mapContactToRow(contact, ['Email', 'Raw signature'], 'the original text');
  assert.equal(row[1], 'the original text');
});

test('a sheet with no matching headings is detected before writing to it', () => {
  assert.equal(headersAreUnrecognised(['Deal stage', 'Owner', 'Value']), true);
  assert.equal(headersAreUnrecognised(['Email', 'Deal stage']), false);
  assert.equal(headersAreUnrecognised(DEFAULT_HEADERS), false);
});

test('column letters are correct past the 26th column', () => {
  const { columnLetter } = __testing;
  assert.equal(columnLetter(1), 'A');
  assert.equal(columnLetter(26), 'Z');
  assert.equal(columnLetter(27), 'AA');
  assert.equal(columnLetter(52), 'AZ');
});

test('tab names containing an apostrophe are escaped for A1 notation', () => {
  assert.equal(__testing.quoteTab("Olivier's contacts"), "'Olivier''s contacts'");
});

test('a leading plus is escaped so a phone number is not evaluated as a formula', () => {
  const { guardFormula } = __testing;
  assert.equal(guardFormula('+44 7700 900123'), "'+44 7700 900123");
  assert.equal(guardFormula('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(guardFormula('-5'), "'-5");
  assert.equal(guardFormula('@handle'), "'@handle");
});

test('ordinary values are written through untouched', () => {
  const { guardFormula } = __testing;
  assert.equal(guardFormula('Olivier'), 'Olivier');
  assert.equal(guardFormula('https://www.netcompany.com'), 'https://www.netcompany.com');
  assert.equal(guardFormula('020 7946 0000'), '020 7946 0000');
  assert.equal(guardFormula(''), '');
});
