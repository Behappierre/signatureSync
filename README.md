# SignatureSync

Paste an email signature, check what comes out, and append it to a Google Sheet.

The whole thing is a static site plus one serverless function. There is no
database, no server to run and nothing to keep alive. It deploys to Netlify
from a single `git push`.

## How it works

```
Browser (React)                                  Netlify Function
  |                                                    |
  |-- parse the signature locally (regex) ------------ |
  |-- POST /api/extract  ---------------------------->  holds the model API key
  |     (with the user's Google access token)           calls the model
  |<-- structured fields ------------------------------ returns JSON, stores nothing
  |
  |-- Google Sheets API v4, direct from the browser --> your spreadsheet
        (user's own OAuth token, no server involved)
```

Three deliberate choices follow from wanting no backend:

**Google auth happens in the browser.** The Google Identity Services token
client issues an access token straight to the page. There is no client secret,
no refresh token, no JWT and no session store, so there is nothing for a server
to hold.

**The spreadsheet is the database.** Contacts are appended as rows and matched
to whatever column headings the sheet already uses. Nothing is duplicated
anywhere else. The only local state is a list of which sheets you have
connected, kept in your own browser.

**Extraction degrades rather than fails.** A regex parser runs first, in the
browser, and recovers email, phone, URLs and LinkedIn reliably on its own. The
model pass then improves name, title, company and address. If no API key is
configured, or the function is unreachable, the app keeps working on the parser
alone and says so.

## Why there is one function at all

A model API key cannot be shipped to a browser: anyone could read it out of the
bundle and spend it. The single `extract` function exists only to hold that key.

It is not open to the public. Every request must carry a Google access token
issued to this app's own OAuth client, which the function verifies with Google
before calling anything. `ALLOWED_EMAILS` narrows that to named accounts if you
want the deployment private to you.

It speaks to OpenRouter, Anthropic or OpenAI, whichever key is set, in that
order of precedence. OpenRouter is the most flexible of the three: one key
reaches most models, so changing model later is a change to `OPENROUTER_MODEL`
and nothing else. Requests to it set `require_parameters: true`, because a
model on OpenRouter is served by many providers and not all of them honour
`response_format`; without it a request can be routed to one that ignores the
schema.

A note on cost: extraction sends roughly 500 input and 100 output tokens per
signature, so even a mid-priced model costs a small fraction of a penny per
contact. Choose on the reliability of the JSON it returns rather than on price.

## Setup

### 1. Google Cloud

In the [Google Cloud Console](https://console.cloud.google.com/), create a
project and then:

1. **Enable APIs** (APIs and services, Library): Google Sheets API, Google
   Drive API, Google Picker API.
2. **Configure the OAuth consent screen**, under Google Auth Platform. Set the
   Audience to External, and while the app is in Testing add yourself under
   Test users. Under Data Access add the scopes `auth/drive.file`,
   `auth/userinfo.email` and `auth/userinfo.profile`. All three are
   non-restricted, so no Google security assessment is required.
3. **Create an OAuth 2.0 Client ID** of type *Web application*. Under
   *Authorised JavaScript origins* add `http://localhost:3000` and your
   deployed origin, for example `https://signaturesync.netlify.app`. No redirect
   URI is needed: the token client does not use one.
4. **Create an API key** and restrict it to the Picker API and to your site.
   This is only needed for choosing an existing sheet from Drive.

> **On scopes.** `drive.file` grants access only to files you create in this app
> or open through the Picker. That is why the app cannot simply take a pasted
> spreadsheet ID, and also why it needs no verification review. If you would
> rather paste IDs, set `VITE_GOOGLE_SCOPES` to use
> `https://www.googleapis.com/auth/spreadsheets` instead, and accept that
> Google will require verification before anyone outside your test users can
> sign in.

### 2. Local development

```bash
npm install
cp .env.example .env
# fill in VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY
npm run dev
```

`npm run dev` serves the frontend only, so the AI pass returns nothing and the
app falls back to local parsing. To run the function too:

```bash
npm install -g netlify-cli
netlify dev
```

### 3. Deploy

Connect the repository to Netlify. The build settings come from `netlify.toml`,
so there is nothing to configure by hand:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |

Then set the environment variables on the site (Site configuration,
Environment variables):

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | yes | OAuth client ID, public |
| `VITE_GOOGLE_API_KEY` | for the Picker | API key, public, restrict it |
| `VITE_GOOGLE_APP_ID` | no | Google project number |
| `OPENROUTER_API_KEY` | one of the three | secret, used by the function |
| `ANTHROPIC_API_KEY` | one of the three | secret, used by the function |
| `OPENAI_API_KEY` | one of the three | secret, used by the function |
| `OPENROUTER_MODEL` | no | defaults to `deepseek/deepseek-v4-flash-0731` |
| `GOOGLE_CLIENT_ID` | yes | same value as above, for token verification |
| `ALLOWED_EMAILS` | no | restrict who can use the AI pass |

`VITE_` variables are compiled into the browser bundle and are public by
design. Never put an API key in one.

Finally, add the deployed origin to the authorised JavaScript origins on the
OAuth client, or sign-in will be refused.

## Using an existing sheet

The app adapts to the columns you already have. It reads the header row and
matches each heading against a list of known spellings, so `Surname`,
`Last Name` and `last_name` all receive the same value. Headings it does not
recognise are left alone, and if none of them match it says so rather than
writing a misaligned row.

A sheet created from within the app gets these columns:

`First name`, `Last name`, `Job title`, `Company`, `Email`, `Phone`,
`Website`, `LinkedIn`, `Address`, `Date added`

Add a column called `Source` or `Raw signature` and the original pasted text is
written there too.

## Commands

```bash
npm run dev         # Vite dev server on :3000
npm run dev:netlify # Vite plus the function, via netlify dev
npm run build       # typecheck, then production build to dist/
npm run test        # parser, sheet-mapping and extraction tests
npm run typecheck   # tsc --noEmit
```

## Project layout

```
index.html
netlify.toml               Build, routing and security headers
netlify/functions/
  extract.mts              The only server-side code
src/
  App.tsx
  components/              Header, input, fields, sheet panel, recent saves
  lib/
    config.ts              Public build-time configuration
    google.ts              GIS token client and Picker
    sheets.ts              Sheets v4 client and column mapping
    heuristics.ts          Deterministic signature parsing
    extract.ts             Merges the parser with the AI pass
    storage.ts             Per-browser convenience state
  store/useAppStore.ts     Application state
  theme/                   MUI theme
test/                      Node test runner suites
```

## Privacy

Signature text goes to the model provider only when the AI pass runs, and to
Google when you save. This site stores nothing: it has no database and no
logging of contact data. Extracted contacts live in your spreadsheet, in your
Google account.

## Licence

MIT. See [LICENSE](./LICENSE).
