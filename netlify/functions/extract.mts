import type { Config, Context } from '@netlify/functions';

/**
 * The only server-side code in this project.
 *
 * It exists for one reason: a model API key cannot be shipped to a browser.
 * It holds that key, calls the model, and returns structured fields. It stores
 * nothing and has no database.
 *
 * Callers must present a Google access token issued to this app's own client
 * ID, so the endpoint cannot be used anonymously to spend the owner's API
 * credit. ALLOWED_EMAILS narrows that further to named accounts.
 */

const MAX_INPUT_CHARS = 4000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;

const FIELDS = [
  'firstName',
  'lastName',
  'title',
  'company',
  'email',
  'phone',
  'website',
  'linkedin',
  'address',
] as const;

type Field = (typeof FIELDS)[number];

const SYSTEM_PROMPT = `You extract contact details from email signatures.

Return a single JSON object with these keys, all optional: firstName, lastName, title, company, email, phone, website, linkedin, address, confidence.

Rules:
- Only return a value you can see in the signature. Never invent, complete or correct a value. An absent field must be omitted or returned as an empty string, never guessed.
- firstName and lastName are the person's name with honorifics (Mr, Dr) and post-nominal letters (MSc, CEng, MBA) removed.
- title is the job title exactly as written, including any department after a comma.
- company is the employer's name, not a department, tagline or address line.
- phone keeps the format as written, including the country code when present. If several numbers appear, prefer the mobile.
- website is the organisation's own site, never a social network, booking or meeting link.
- address is the postal address on one line, comma separated.
- confidence is your overall confidence in the extraction, from 0 to 1.

Respond with JSON only.`;

interface ExtractedPayload {
  fields: Partial<Record<Field, string>>;
  confidence: number;
  model: string;
}

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

/**
 * Per-instance and therefore approximate: serverless instances do not share
 * memory. It blunts a burst from one caller, which is all it is meant to do.
 * The real control is that a valid Google token is required at all.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    if (buckets.size > 500) {
      for (const [id, entry] of buckets) if (now > entry.resetAt) buckets.delete(id);
    }
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

interface TokenInfo {
  aud?: string;
  email?: string;
  expires_in?: string;
  error?: string;
}

async function verifyGoogleToken(
  token: string,
): Promise<{ ok: true; email: string } | { ok: false; reason: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID ?? '';
  if (!clientId) {
    return { ok: false, reason: 'GOOGLE_CLIENT_ID is not set on the server.' };
  }

  let info: TokenInfo;
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
    );
    if (!response.ok) return { ok: false, reason: 'Google rejected that access token.' };
    info = (await response.json()) as TokenInfo;
  } catch {
    return { ok: false, reason: 'Could not reach Google to verify the token.' };
  }

  if (info.error || !info.aud) return { ok: false, reason: 'That access token is not valid.' };
  if (info.aud !== clientId) {
    return { ok: false, reason: 'That access token was issued to a different application.' };
  }

  const allowList = (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const email = (info.email ?? '').toLowerCase();
  if (allowList.length > 0 && !allowList.includes(email)) {
    return { ok: false, reason: 'This deployment is restricted to approved accounts.' };
  }

  return { ok: true, email };
}

/* ------------------------------------------------------------------ */
/* Model providers                                                     */
/* ------------------------------------------------------------------ */

function coerceFields(parsed: unknown): { fields: Partial<Record<Field, string>>; confidence: number } {
  const fields: Partial<Record<Field, string>> = {};
  let confidence = 0.75;

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    for (const field of FIELDS) {
      const value = record[field];
      if (typeof value === 'string' && value.trim().length > 0 && value.trim() !== 'null') {
        fields[field] = value.trim();
      }
    }
    const raw = record.confidence;
    if (typeof raw === 'number' && raw >= 0 && raw <= 1) confidence = raw;
  }

  return { fields, confidence };
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('The model did not return JSON.');
    return JSON.parse(match[0]);
  }
}

/**
 * Strict JSON schema for providers that support structured outputs. Every
 * field is required because strict mode demands it; absent values come back as
 * empty strings, which coerceFields drops.
 */
const RESPONSE_SCHEMA = {
  name: 'contact_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      ...Object.fromEntries(FIELDS.map((field) => [field, { type: 'string' }])),
      confidence: { type: 'number' },
    },
    required: [...FIELDS, 'confidence'],
    additionalProperties: false,
  },
};

/**
 * OpenRouter exposes many models behind one key and an OpenAI-shaped API.
 *
 * require_parameters matters here: a model is served by many providers and not
 * all of them honour response_format, so without it a request can be routed to
 * one that silently ignores the schema.
 */
async function callOpenRouter(signature: string, apiKey: string): Promise<ExtractedPayload> {
  const model = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash-0731';

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
  };
  // Optional attribution, shown on OpenRouter's dashboard and rankings.
  if (process.env.OPENROUTER_SITE_URL) headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;
  if (process.env.OPENROUTER_APP_NAME) headers['X-Title'] = process.env.OPENROUTER_APP_NAME;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 700,
      response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
      provider: { require_parameters: true },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Email signature:\n\n${signature}` },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error ${response.status}: ${await response.text()}`);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (body.error?.message) throw new Error(`OpenRouter error: ${body.error.message}`);

  const text = body.choices?.[0]?.message?.content ?? '';
  const { fields, confidence } = coerceFields(extractJson(text));
  return { fields, confidence, model };
}

async function callAnthropic(signature: string, apiKey: string): Promise<ExtractedPayload> {
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 700,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Email signature:\n\n${signature}` },
        { role: 'assistant', content: '{' },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
  }

  const body = (await response.json()) as { content?: Array<{ text?: string }> };
  const text = `{${body.content?.[0]?.text ?? ''}`;
  const { fields, confidence } = coerceFields(extractJson(text));
  return { fields, confidence, model };
}

async function callOpenAI(signature: string, apiKey: string): Promise<ExtractedPayload> {
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Email signature:\n\n${signature}` },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = body.choices?.[0]?.message?.content ?? '';
  const { fields, confidence } = coerceFields(extractJson(text));
  return { fields, confidence, model };
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export default async (request: Request, context: Context): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openrouterKey && !anthropicKey && !openaiKey) {
    // 501 is the signal the client uses to fall back to heuristics silently.
    return json(
      {
        error: 'No model API key is configured on this deployment.',
        hint: 'Set OPENROUTER_API_KEY, ANTHROPIC_API_KEY or OPENAI_API_KEY in the Netlify site environment.',
      },
      501,
    );
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Sign in with Google before extracting.' }, 401);

  const verified = await verifyGoogleToken(token);
  if (!verified.ok) return json({ error: verified.reason }, 401);

  const limitKey = verified.email || context.ip || 'anonymous';
  if (rateLimited(limitKey)) {
    return json({ error: 'Too many extractions in the last minute. Wait a moment.' }, 429);
  }

  let signature: string;
  try {
    const body = (await request.json()) as { text?: unknown };
    if (typeof body.text !== 'string' || body.text.trim().length === 0) {
      return json({ error: 'Provide the signature text in a "text" field.' }, 400);
    }
    signature = body.text.slice(0, MAX_INPUT_CHARS);
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }

  const started = Date.now();
  try {
    // First key present wins, so switching provider is a matter of which
    // variable is set rather than a code change.
    let result: ExtractedPayload;
    if (openrouterKey) {
      result = await callOpenRouter(signature, openrouterKey);
    } else if (anthropicKey) {
      result = await callAnthropic(signature, anthropicKey);
    } else {
      result = await callOpenAI(signature, openaiKey as string);
    }

    return json({
      fields: result.fields,
      confidence: result.confidence,
      model: result.model,
      elapsedMs: Date.now() - started,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown extraction error.';
    console.error('extract failed:', message);
    // The client falls back to its own parsing, so this is a soft failure.
    return json({ error: 'The extraction service is unavailable right now.' }, 502);
  }
};

export const config: Config = {
  path: '/api/extract',
};
