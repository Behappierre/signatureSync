import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSignature, normalise } from '../src/lib/heuristics.ts';

const sample = (name, text, expected) =>
  test(name, () => {
    const { contact } = parseSignature(text);
    for (const [field, value] of Object.entries(expected)) {
      assert.equal(contact[field], value, `${field}: got "${contact[field]}", want "${value}"`);
    }
  });

sample(
  'standard UK corporate signature',
  `Kind regards,

Olivier André
Partner, Transportation & Infrastructure
Netcompany UK Ltd
M: +44 7700 900123 | T: +44 20 7946 0000
olivier.andre@netcompany.com
www.netcompany.com
linkedin.com/in/olivierandre
1 Finsbury Avenue, London EC2M 2PF

This e-mail and any attachments are confidential and intended solely for the addressee.`,
  {
    firstName: 'Olivier',
    lastName: 'André',
    title: 'Partner, Transportation & Infrastructure',
    company: 'Netcompany UK Ltd',
    email: 'olivier.andre@netcompany.com',
    phone: '+44 7700 900123',
    website: 'https://www.netcompany.com',
    linkedin: 'https://linkedin.com/in/olivierandre',
  },
);

sample(
  'US style with title before name and a zip code',
  `Sarah J. Whitfield
Senior Vice President, Operations
Harbor Logistics Inc.
Tel: (415) 555-0182
sarah.whitfield@harborlogistics.com
500 Market Street, Suite 1200, San Francisco, CA 94105`,
  {
    firstName: 'Sarah',
    lastName: 'J. Whitfield',
    company: 'Harbor Logistics Inc.',
    email: 'sarah.whitfield@harborlogistics.com',
  },
);

sample(
  'minimal signature, name recoverable only from the email',
  `Thanks
d.kowalski@bridgeworks.co.uk`,
  { firstName: 'D', lastName: 'Kowalski', email: 'd.kowalski@bridgeworks.co.uk' },
);

test('minimal signature derives the company from the domain, with low confidence', () => {
  const { contact, confidence } = parseSignature('Thanks\nd.kowalski@bridgeworks.co.uk');
  assert.equal(contact.company, 'Bridgeworks');
  assert.ok(confidence.company < 0.6, 'domain-derived company must be flagged as a guess');
});

sample(
  'credentials and honorifics are stripped from the name',
  `Dr. James O'Brien BEng CEng MIET
Principal Engineer
Ricardo Rail
james.obrien@ricardo.com`,
  { firstName: 'James', lastName: "O'Brien", title: 'Principal Engineer' },
);

sample(
  'surname-first with a comma',
  `SMITH, John
Head of Digital
john.smith@example.org`,
  { firstName: 'John', lastName: 'Smith', title: 'Head of Digital' },
);

sample(
  'HTML signature is stripped before parsing',
  `<div><p><b>Priya Raman</b><br/>Commercial Director<br/>
<a href="mailto:priya@transitworks.io">priya@transitworks.io</a><br/>
Mob:&nbsp;+44&nbsp;7911&nbsp;123456</p></div>`,
  { firstName: 'Priya', lastName: 'Raman', title: 'Commercial Director', email: 'priya@transitworks.io' },
);

test('freemail domains do not become a company or website', () => {
  const { contact } = parseSignature('Alan Turing\nalan.turing@gmail.com');
  assert.equal(contact.company, '');
  assert.equal(contact.website, '');
});

test('social links are not mistaken for the company website', () => {
  const { contact } = parseSignature(
    'Mia Chen\nmia@wavelength.co\nhttps://twitter.com/miachen\nhttps://wavelength.co',
  );
  assert.equal(contact.website, 'https://wavelength.co');
});

test('no-reply addresses are skipped in favour of a real one', () => {
  const { contact } = parseSignature('noreply@system.com\nreal.person@company.com');
  assert.equal(contact.email, 'real.person@company.com');
});

test('a postcode is not harvested as a phone number', () => {
  const { contact } = parseSignature('Tom Grant\nMistral Data\n12 High Street, Derby DE1 2AB');
  assert.equal(contact.phone, '');
});

test('normalise removes zero-width characters and blank lines', () => {
  const lines = normalise('One​\n\n\n  Two  \r\nThree Four');
  assert.deepEqual(lines, ['One', 'Two', 'Three Four']);
});

test('confidence is never reported for an empty field', () => {
  const { contact, confidence } = parseSignature('just some text with no signature in it');
  for (const [field, score] of Object.entries(confidence)) {
    assert.ok(contact[field], `confidence ${score} reported for empty field ${field}`);
  }
});

test('an empty input does not throw', () => {
  const { contact } = parseSignature('');
  assert.equal(contact.email, '');
});
