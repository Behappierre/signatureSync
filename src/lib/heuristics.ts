import { CONTACT_FIELDS, EMPTY_CONTACT } from '../types/index.ts';
import type { ContactField, ContactInfo, FieldConfidence } from '../types/index.ts';

/**
 * Deterministic email-signature parsing.
 *
 * This runs in the browser with no network call. It reliably recovers the
 * machine-shaped fields (email, phone, URLs, LinkedIn) and makes a decent
 * attempt at the human-shaped ones (name, title, company). The AI pass in the
 * Netlify Function then improves the human-shaped fields; if that pass is
 * unavailable the app still works from this alone.
 */

export interface HeuristicResult {
  contact: ContactInfo;
  confidence: FieldConfidence;
  /** The cleaned, noise-stripped lines, reused as the AI prompt input. */
  lines: string[];
}

const FREEMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk',
  'live.com', 'live.co.uk', 'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com',
  'aol.com', 'protonmail.com', 'proton.me', 'gmx.com', 'mail.com', 'msn.com',
  'btinternet.com', 'sky.com', 'virginmedia.com', 'talktalk.net',
]);

const NOISE_PATTERNS: RegExp[] = [
  /^sent from my /i,
  /^get outlook for /i,
  /this e-?mail (and any|message)/i,
  /^(the )?(information|contents?) (in|of) this/i,
  /confidential(ity)? (notice|statement)/i,
  /intended (solely |only )?for the (use of|addressee|recipient)/i,
  /if you (have )?received this (e-?mail|message) in error/i,
  /please (consider the environment|do not print|think before you print)/i,
  /registered (in england|office|number|company)/i,
  /vat (registration|reg|number|no)/i,
  /unsubscribe/i,
  /^\[?cid:/i,
  /^\[(image|logo|cid)[^\]]*\]$/i,
  /^<https?:\/\/[^>]*>$/i,
  /follow us on/i,
  /view our privacy (policy|notice)/i,
  /^-{2,}$|^_{2,}$|^={2,}$|^\*{2,}$/,
];

const SIGNOFF_PATTERN =
  /^(kind(est)? regards|best regards|warm regards|regards|best wishes|best|many thanks|thanks( again)?|thank you|yours (sincerely|faithfully|truly)|cheers|sincerely|speak soon)[,.!]?$/i;

const TITLE_KEYWORDS = [
  'director', 'manager', 'head of', 'chief', 'officer', 'ceo', 'cto', 'cfo', 'coo', 'cio', 'cdo',
  'president', 'vice president', 'vp ', 'partner', 'principal', 'consultant', 'engineer',
  'architect', 'analyst', 'specialist', 'lead', 'coordinator', 'administrator', 'advisor',
  'adviser', 'executive', 'associate', 'supervisor', 'founder', 'owner', 'proprietor',
  'secretary', 'treasurer', 'chairman', 'chair', 'trustee', 'surveyor', 'solicitor',
  'accountant', 'developer', 'designer', 'researcher', 'scientist', 'technician',
  'representative', 'account manager', 'business development', 'programme', 'project',
];

const COMPANY_SUFFIXES = [
  'ltd', 'ltd.', 'limited', 'llp', 'llc', 'plc', 'inc', 'inc.', 'incorporated', 'corp',
  'corp.', 'corporation', 'gmbh', 'ag', 'a/s', 'as', 'ab', 'bv', 'b.v.', 'nv', 'n.v.',
  'sa', 's.a.', 'srl', 'spa', 's.p.a.', 'oy', 'aps', 'pty', 'co.', 'company',
];

const COMPANY_HINTS = [
  'group', 'consulting', 'consultancy', 'technologies', 'technology', 'solutions',
  'partners', 'associates', 'services', 'systems', 'holdings', 'ventures', 'capital',
  'industries', 'international', 'global', 'labs', 'studio', 'agency', 'university',
  'college', 'council', 'trust', 'foundation', 'institute', 'railway', 'rail',
];

const ADDRESS_HINTS = [
  'street', 'st.', 'road', 'rd.', 'avenue', 'ave', 'lane', 'drive', 'close', 'court',
  'square', 'place', 'way', 'park', 'house', 'building', 'floor', 'suite', 'unit',
  'business park', 'industrial estate', 'po box', 'boulevard', 'plaza',
];

const UK_POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;
const US_ZIP = /\b\d{5}(-\d{4})?\b/;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'()[\]]+/gi;
const LINKEDIN_RE =
  /(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/(?:in|pub|company|school)\/[A-Z0-9_%\-.]+\/?/i;

const SOCIAL_HOSTS = [
  'linkedin.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'youtube.com',
  'tiktok.com', 'threads.net', 'bsky.app', 'mastodon.social', 'goo.gl', 'bit.ly',
  'calendly.com', 'teams.microsoft.com', 'zoom.us',
];

const PHONE_LABEL_RE =
  /\b(mobile|mob|cell|tel|telephone|phone|direct|dial|office|work|ddi|dd|t|m|p|o|d)\b\s*[:.]?\s*$/i;
const PHONE_CANDIDATE_RE = /\+?[\d][\d\s().\-/]{6,}\d/g;

const CREDENTIAL_TOKENS = new Set([
  'msc', 'ma', 'ba', 'bsc', 'beng', 'meng', 'mba', 'phd', 'dphil', 'mphil', 'llb', 'llm',
  'ceng', 'ieng', 'miet', 'imeche', 'mice', 'rics', 'mrics', 'frics', 'aca', 'acca',
  'cima', 'cpa', 'pmp', 'prince2', 'fcca', 'cfa', 'jr', 'jr.', 'sr', 'sr.', 'ii', 'iii',
  'esq', 'esq.', 'dipl', 'ing', 'ir', 'mrs', 'mr', 'ms', 'miss', 'dr', 'prof',
]);

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'sir', 'dame', 'rev']);

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

function looksLikeHtml(text: string): boolean {
  return /<\/?(div|p|br|span|table|tr|td|a|font|body|html)\b/i.test(text);
}

function stripHtml(text: string): string {
  return text
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-',
    mdash: '-', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: '...',
  };
  return text
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => named[name.toLowerCase()] ?? m);
}

/** Normalise whitespace and encoding oddities, then split into clean lines. */
export function normalise(raw: string): string[] {
  let text = raw ?? '';
  if (looksLikeHtml(text)) text = stripHtml(text);
  text = decodeEntities(text);

  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[   ]/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0);
}

function isNoise(line: string): boolean {
  if (SIGNOFF_PATTERN.test(line)) return true;
  if (line.length > 180) return true;
  return NOISE_PATTERNS.some((re) => re.test(line));
}

/* ------------------------------------------------------------------ */
/* Field extractors                                                    */
/* ------------------------------------------------------------------ */

function pickEmail(lines: string[]): string {
  const found: string[] = [];
  for (const line of lines) {
    const matches = line.match(EMAIL_RE);
    if (matches) found.push(...matches);
  }
  const cleaned = found
    .map((e) => e.replace(/[.,;:]+$/, '').toLowerCase())
    .filter((e) => !/^(no-?reply|do-?not-?reply|postmaster|mailer-daemon)@/.test(e))
    .filter((e) => !/\.(png|jpg|jpeg|gif|webp)$/i.test(e));
  return cleaned[0] ?? '';
}

function pickLinkedIn(lines: string[]): string {
  for (const line of lines) {
    const match = line.match(LINKEDIN_RE);
    if (match) {
      let url = match[0].replace(/[.,;:)]+$/, '');
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      return url.replace(/\/$/, '');
    }
  }
  return '';
}

function pickWebsite(lines: string[], email: string): { value: string; confidence: number } {
  const candidates: string[] = [];
  for (const line of lines) {
    const matches = line.match(URL_RE);
    if (matches) candidates.push(...matches);
  }

  for (const raw of candidates) {
    let url = raw.replace(/[.,;:)\]]+$/, '');
    const host = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
    if (SOCIAL_HOSTS.some((social) => host === social || host.endsWith(`.${social}`))) continue;
    if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(url)) continue;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    return { value: url, confidence: 0.9 };
  }

  // Fall back to the email domain, which is right far more often than not for
  // business signatures, but is a guess, so it is scored as one.
  if (email.includes('@')) {
    const domain = email.split('@')[1];
    if (domain && !FREEMAIL_DOMAINS.has(domain)) {
      return { value: `https://${domain}`, confidence: 0.45 };
    }
  }
  return { value: '', confidence: 0 };
}

function tidyPhone(raw: string): string {
  const trimmed = raw.trim().replace(/[.\-\s]+$/, '');
  return trimmed.replace(/\s{2,}/g, ' ');
}

function countDigits(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

function pickPhone(lines: string[]): { value: string; confidence: number } {
  interface Candidate { value: string; score: number }
  const candidates: Candidate[] = [];

  for (const line of lines) {
    if (UK_POSTCODE.test(line) && !/\b(tel|phone|mob|mobile|cell|t|m)\b\s*[:.]/i.test(line)) {
      // Address lines carry numbers that are not phone numbers.
      if (countDigits(line) < 9) continue;
    }

    const matches = line.match(PHONE_CANDIDATE_RE);
    if (!matches) continue;

    for (const match of matches) {
      const digits = countDigits(match);
      if (digits < 7 || digits > 15) continue;

      const value = tidyPhone(match);
      let score = 0.55;

      const before = line.slice(0, line.indexOf(match));
      if (PHONE_LABEL_RE.test(before.trim())) score += 0.25;
      if (/\b(mobile|mob|cell|m)\b\s*[:.]/i.test(before)) score += 0.05;
      if (value.startsWith('+')) score += 0.15;
      if (digits >= 10) score += 0.05;
      // A bare run of digits inside prose is usually not a phone number.
      if (!value.startsWith('+') && !/[\s().-]/.test(value) && digits < 10) score -= 0.25;

      candidates.push({ value, score: Math.min(score, 0.95) });
    }
  }

  if (candidates.length === 0) return { value: '', confidence: 0 };
  candidates.sort((a, b) => b.score - a.score);
  return { value: candidates[0].value, confidence: candidates[0].score };
}

function stripCredentials(line: string): string {
  const withoutBrackets = line.replace(/\([^)]*\)/g, ' ');
  const tokens = withoutBrackets.split(/[\s,]+/).filter(Boolean);
  const kept: string[] = [];
  for (const token of tokens) {
    const bare = token.replace(/[.,]/g, '').toLowerCase();
    if (CREDENTIAL_TOKENS.has(bare) || CREDENTIAL_TOKENS.has(`${bare}.`)) continue;
    kept.push(token);
  }
  return kept.join(' ').trim();
}

function looksLikeName(line: string): boolean {
  if (/[@\d]/.test(line)) return false;
  if (line.length > 60) return false;
  if (line.includes('://')) return false;
  const lower = line.toLowerCase();
  if (TITLE_KEYWORDS.some((k) => lower.includes(k))) return false;
  if (COMPANY_SUFFIXES.some((s) => lower.endsWith(` ${s}`))) return false;

  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 4) return false;

  return tokens.every((token) => {
    const clean = token.replace(/[^A-Za-z'À-ɏ-]/g, '');
    if (clean.length === 0) return false;
    const first = clean[0];
    return first === first.toUpperCase();
  });
}

function splitName(line: string): { firstName: string; lastName: string } {
  // The surname-first form has to be detected before credentials are stripped,
  // because stripping also removes the comma that marks it.
  let working = line;
  const commaMatch = line.match(/^([^,]+),\s*(.+)$/);
  if (commaMatch) {
    const surnamePart = stripCredentials(commaMatch[1]);
    const givenPart = stripCredentials(commaMatch[2]);
    const surnameTokens = surnamePart.split(/\s+/).filter(Boolean);
    const givenTokens = givenPart.split(/\s+/).filter(Boolean);
    // "Smith, John" is surname-first. "John Smith, Consultant" is not.
    if (surnameTokens.length === 1 && givenTokens.length >= 1 && givenTokens.length <= 2) {
      working = `${givenPart} ${surnamePart}`;
    }
  }
  working = stripCredentials(working);

  let tokens = working.split(/\s+/).filter(Boolean);
  if (tokens.length > 0 && HONORIFICS.has(tokens[0].replace(/\./g, '').toLowerCase())) {
    tokens = tokens.slice(1);
  }
  if (tokens.length === 0) return { firstName: '', lastName: '' };
  if (tokens.length === 1) return { firstName: titleCase(tokens[0]), lastName: '' };

  const firstName = titleCase(tokens[0]);
  const lastName = tokens.slice(1).map(titleCase).join(' ');
  return { firstName, lastName };
}

function titleCase(token: string): string {
  if (token.length === 0) return token;
  // Leave mixed-case names such as McDonald or O'Brien alone.
  if (/[a-z]/.test(token) && /[A-Z]/.test(token.slice(1))) return token;
  return token
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('-');
}

const ROLE_LOCAL_PARTS = new Set([
  'info', 'sales', 'contact', 'hello', 'admin', 'support', 'enquiries', 'enquiry',
  'office', 'team', 'accounts', 'finance', 'hr', 'careers', 'jobs', 'press', 'media',
  'marketing', 'bookings', 'reception', 'help', 'service', 'services', 'mail', 'post',
]);

function nameFromEmail(email: string): { firstName: string; lastName: string } {
  const local = (email.split('@')[0] ?? '').toLowerCase();
  if (ROLE_LOCAL_PARTS.has(local.replace(/[._-]/g, ''))) return { firstName: '', lastName: '' };

  const parts = local.split(/[._-]+/).filter((p) => p.length >= 1 && /^[a-z]+$/i.test(p));
  if (parts.length < 2) return { firstName: '', lastName: '' };
  if (parts.some((p) => ROLE_LOCAL_PARTS.has(p))) return { firstName: '', lastName: '' };
  // The last part is the surname; anything before it collapses into the first
  // name, so "j.r.hartley" gives "J" and "Hartley".
  return { firstName: titleCase(parts[0]), lastName: titleCase(parts[parts.length - 1]) };
}

function pickTitle(lines: string[], nameLineIndex: number): { value: string; confidence: number } {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (i === nameLineIndex) continue;
    if (/[@]/.test(line) || line.includes('://')) continue;
    const lower = line.toLowerCase();
    if (!TITLE_KEYWORDS.some((k) => lower.includes(k))) continue;
    if (line.length > 80) continue;

    // "Director | Netcompany" -> "Director". A comma is only a separator when
    // what follows it reads like a company name, so "Partner, Transportation &
    // Infrastructure" survives intact.
    let value = line.split(/\s[|·•]\s/)[0].trim();
    const commaSplit = value.split(/,\s+/);
    if (commaSplit.length > 1) {
      const tail = commaSplit.slice(1).join(', ').toLowerCase();
      const tailIsCompany =
        COMPANY_SUFFIXES.some((suffix) => tail.endsWith(` ${suffix}`) || tail === suffix) ||
        COMPANY_HINTS.some((hint) => tail.includes(hint));
      if (tailIsCompany) value = commaSplit[0].trim();
    }
    const confidence = i === nameLineIndex + 1 ? 0.85 : 0.7;
    return { value, confidence };
  }

  // A short line straight after the name is often the job title, but only if
  // it does not read as a company name, which sits in the same position just
  // as often.
  if (nameLineIndex >= 0 && nameLineIndex + 1 < lines.length) {
    const next = lines[nameLineIndex + 1];
    const lower = next.toLowerCase();
    const looksLikeCompany =
      COMPANY_SUFFIXES.some((suffix) => lower.endsWith(` ${suffix}`)) ||
      COMPANY_HINTS.some((hint) => lower.includes(hint));

    if (next.length <= 60 && !/[@\d]/.test(next) && !next.includes('://') && !looksLikeCompany) {
      return { value: next, confidence: 0.4 };
    }
  }
  return { value: '', confidence: 0 };
}

function companyFromDomain(email: string): string {
  const domain = email.split('@')[1];
  if (!domain || FREEMAIL_DOMAINS.has(domain)) return '';
  const root = domain.split('.')[0];
  if (!root) return '';
  return root
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function pickCompany(
  lines: string[],
  email: string,
  usedIndices: Set<number>,
): { value: string; confidence: number } {
  for (let i = 0; i < lines.length; i += 1) {
    if (usedIndices.has(i)) continue;
    const line = lines[i];
    if (/[@]/.test(line) || line.includes('://')) continue;
    if (line.length > 70) continue;
    const lower = line.toLowerCase();
    const hasSuffix = COMPANY_SUFFIXES.some(
      (s) => lower.endsWith(` ${s}`) || lower.endsWith(`${s}`) && lower.split(/\s+/).length > 1,
    );
    if (hasSuffix) return { value: line.replace(/[|·•,]\s*$/, '').trim(), confidence: 0.85 };
  }

  for (let i = 0; i < lines.length; i += 1) {
    if (usedIndices.has(i)) continue;
    const line = lines[i];
    if (/[@]/.test(line) || line.includes('://')) continue;
    if (line.length > 70) continue;
    const lower = line.toLowerCase();
    if (COMPANY_HINTS.some((h) => lower.includes(h))) {
      return { value: line.replace(/[|·•,]\s*$/, '').trim(), confidence: 0.6 };
    }
  }

  const fromDomain = companyFromDomain(email);
  if (fromDomain) return { value: fromDomain, confidence: 0.45 };
  return { value: '', confidence: 0 };
}

function pickAddress(lines: string[], usedIndices: Set<number>): { value: string; confidence: number } {
  const parts: string[] = [];
  let confidence = 0;

  for (let i = 0; i < lines.length; i += 1) {
    if (usedIndices.has(i)) continue;
    const line = lines[i];
    if (line.includes('@') || line.includes('://')) continue;

    const lower = line.toLowerCase();
    const hasPostcode = UK_POSTCODE.test(line) || US_ZIP.test(line);
    const hasHint = ADDRESS_HINTS.some((h) => lower.includes(h));
    const startsWithNumber = /^\d+[a-z]?[\s,]/i.test(line);

    if (hasPostcode || hasHint || startsWithNumber) {
      parts.push(line.replace(/[|·•]\s*$/, '').trim());
      confidence = Math.max(confidence, hasPostcode ? 0.8 : 0.55);
    }
  }

  if (parts.length === 0) return { value: '', confidence: 0 };
  return { value: parts.join(', ').replace(/,\s*,/g, ','), confidence };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function parseSignature(raw: string): HeuristicResult {
  const allLines = normalise(raw);
  const lines = allLines.filter((line) => !isNoise(line));

  const contact: ContactInfo = { ...EMPTY_CONTACT };
  const confidence: FieldConfidence = {};

  const email = pickEmail(lines);
  if (email) {
    contact.email = email;
    confidence.email = 0.97;
  }

  const linkedin = pickLinkedIn(lines);
  if (linkedin) {
    contact.linkedin = linkedin;
    confidence.linkedin = 0.95;
  }

  const website = pickWebsite(lines, email);
  if (website.value) {
    contact.website = website.value;
    confidence.website = website.confidence;
  }

  const phone = pickPhone(lines);
  if (phone.value) {
    contact.phone = phone.value;
    confidence.phone = phone.confidence;
  }

  // Name: the first line that reads like one wins; otherwise fall back to the
  // email local part.
  let nameLineIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (looksLikeName(stripCredentials(lines[i]).split(/\s[|·•]\s/)[0])) {
      nameLineIndex = i;
      break;
    }
  }

  if (nameLineIndex >= 0) {
    const namePart = lines[nameLineIndex].split(/\s[|·•]\s/)[0];
    const { firstName, lastName } = splitName(namePart);
    contact.firstName = firstName;
    contact.lastName = lastName;
    if (firstName) confidence.firstName = 0.7;
    if (lastName) confidence.lastName = 0.7;
  } else if (email) {
    const { firstName, lastName } = nameFromEmail(email);
    contact.firstName = firstName;
    contact.lastName = lastName;
    if (firstName) confidence.firstName = 0.5;
    if (lastName) confidence.lastName = 0.5;
  }

  const used = new Set<number>();
  if (nameLineIndex >= 0) used.add(nameLineIndex);

  const title = pickTitle(lines, nameLineIndex);
  if (title.value) {
    contact.title = title.value;
    confidence.title = title.confidence;
    const titleIndex = lines.findIndex((line) => line.startsWith(title.value));
    if (titleIndex >= 0) used.add(titleIndex);
  }

  const company = pickCompany(lines, email, used);
  if (company.value) {
    contact.company = company.value;
    confidence.company = company.confidence;
    const companyIndex = lines.findIndex((line) => line.startsWith(company.value));
    if (companyIndex >= 0) used.add(companyIndex);
  }

  const address = pickAddress(lines, used);
  if (address.value) {
    contact.address = address.value;
    confidence.address = address.confidence;
  }

  // Never report confidence for a field we did not fill.
  for (const field of CONTACT_FIELDS) {
    if (!contact[field]) delete confidence[field as ContactField];
  }

  return { contact, confidence, lines };
}
