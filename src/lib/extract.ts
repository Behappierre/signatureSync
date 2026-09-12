import { CONTACT_FIELDS, EMPTY_CONTACT } from '../types/index.ts';
import type {
  ContactField,
  ContactInfo,
  ExtractionResult,
  ExtractionSource,
  FieldConfidence,
} from '../types/index.ts';
import { EXTRACT_ENDPOINT } from './config.ts';
import { parseSignature } from './heuristics.ts';

interface AiResponse {
  fields?: Partial<Record<ContactField, string>>;
  confidence?: number;
  model?: string;
  error?: string;
}

/** Fields the deterministic parser owns when it is confident. */
const HEURISTIC_PREFERRED: ContactField[] = ['email', 'linkedin'];
/** Fields the model is reliably better at than regular expressions. */
const AI_PREFERRED: ContactField[] = ['firstName', 'lastName', 'title', 'company', 'address'];

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Guard against a model returning a plausible value that is not actually in
 * the signature. Machine-shaped fields must be traceable to the source text.
 */
function isGrounded(field: ContactField, value: string, sourceText: string): boolean {
  const haystack = sourceText.toLowerCase();
  const needle = value.toLowerCase();

  switch (field) {
    case 'email':
      return haystack.includes(needle);
    case 'website':
    case 'linkedin': {
      const host = needle.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      return host.length > 0 && haystack.includes(host);
    }
    case 'phone': {
      const digits = digitsOnly(value);
      if (digits.length < 6) return false;
      // Compare against the source with all separators removed, so "+44 20
      // 7946 0000" still matches "+442079460000".
      return digitsOnly(sourceText).includes(digits.slice(-9));
    }
    default:
      return true;
  }
}

async function callExtractApi(
  text: string,
  accessToken: string | null,
  signal?: AbortSignal,
): Promise<{ data: AiResponse | null; warning?: string }> {
  if (!accessToken) {
    return { data: null, warning: 'Connect Google to use AI extraction.' };
  }

  let response: Response;
  try {
    response = await fetch(EXTRACT_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text }),
      signal,
    });
  } catch {
    return { data: null, warning: 'Could not reach the extraction service. Used offline parsing.' };
  }

  if (response.status === 501) {
    return { data: null, warning: 'No AI model is configured, so fields were parsed offline.' };
  }
  if (response.status === 429) {
    return { data: null, warning: 'Rate limited by the extraction service. Used offline parsing.' };
  }
  if (!response.ok) {
    return { data: null, warning: 'AI extraction failed, so fields were parsed offline.' };
  }

  try {
    return { data: (await response.json()) as AiResponse };
  } catch {
    return { data: null, warning: 'The extraction service returned an unreadable response.' };
  }
}

export interface ExtractOptions {
  accessToken: string | null;
  /** Skip the network call entirely. */
  offlineOnly?: boolean;
  signal?: AbortSignal;
}

/**
 * Parse first, then improve with the model. The deterministic result is always
 * available, so a missing or failing AI service degrades quality rather than
 * breaking the app.
 */
export async function extractSignature(
  rawText: string,
  options: ExtractOptions,
): Promise<ExtractionResult> {
  const started = Date.now();
  const heuristic = parseSignature(rawText);
  const cleanedText = heuristic.lines.join('\n');

  const contact: ContactInfo = { ...heuristic.contact };
  const confidence: FieldConfidence = { ...heuristic.confidence };
  const origin: Partial<Record<ContactField, ExtractionSource>> = {};
  for (const field of CONTACT_FIELDS) {
    if (contact[field]) origin[field] = 'heuristic';
  }

  const warnings: string[] = [];

  if (options.offlineOnly || cleanedText.length === 0) {
    return {
      contact,
      confidence,
      origin,
      source: 'heuristic',
      warnings,
      elapsedMs: Date.now() - started,
    };
  }

  const { data, warning } = await callExtractApi(cleanedText, options.accessToken, options.signal);
  if (warning) warnings.push(warning);

  if (!data?.fields) {
    return {
      contact,
      confidence,
      origin,
      source: 'heuristic',
      warnings,
      elapsedMs: Date.now() - started,
    };
  }

  const aiConfidence = typeof data.confidence === 'number' ? data.confidence : 0.8;
  let usedAi = false;

  for (const field of CONTACT_FIELDS) {
    const aiValue = (data.fields[field] ?? '').trim();
    if (!aiValue) continue;
    if (!isGrounded(field, aiValue, rawText)) continue;

    const heuristicValue = contact[field];
    const heuristicScore = confidence[field] ?? 0;

    let takeAi: boolean;
    if (!heuristicValue) {
      takeAi = true;
    } else if (HEURISTIC_PREFERRED.includes(field)) {
      takeAi = false;
    } else if (field === 'website' || field === 'phone') {
      // The parser only beats the model here when it found an unambiguous match.
      takeAi = heuristicScore < 0.9;
    } else {
      takeAi = AI_PREFERRED.includes(field);
    }

    if (!takeAi) continue;

    contact[field] = aiValue;
    confidence[field] = Math.min(0.97, Math.max(0.5, aiConfidence));
    origin[field] = heuristicValue && heuristicValue !== aiValue ? 'hybrid' : 'ai';
    usedAi = true;
  }

  for (const field of CONTACT_FIELDS) {
    if (!contact[field]) delete confidence[field];
  }

  return {
    contact,
    confidence,
    origin,
    source: usedAi ? 'hybrid' : 'heuristic',
    warnings,
    elapsedMs: Date.now() - started,
  };
}

export const emptyResult = (): ExtractionResult => ({
  contact: { ...EMPTY_CONTACT },
  confidence: {},
  origin: {},
  source: 'heuristic',
  warnings: [],
  elapsedMs: 0,
});
