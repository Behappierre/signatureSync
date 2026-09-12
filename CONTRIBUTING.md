# Contributing

## Getting set up

```bash
npm install
cp .env.example .env   # add your Google client ID
npm run dev
```

See the [README](./README.md#setup) for the Google Cloud steps. You can work on
the parser and most of the UI without any Google credentials at all.

## Before opening a pull request

```bash
npm run typecheck
npm run test
npm run build
```

All three should pass. The build runs the typecheck itself, so a green
`npm run build` covers two of them.

## How the code is organised

Anything that can run in the browser does. The only server-side file is
`netlify/functions/extract.mts`, and it exists solely because a model API key
cannot be shipped to a browser. If you find yourself wanting to add a second
function, it is worth asking first whether the work can be done client-side
against a Google API instead.

`src/lib/heuristics.ts` must stay free of network calls and framework imports.
It is pure, synchronous and tested directly.

## Improving extraction

This is where contributions help most. Signatures vary enormously by country,
industry and mail client.

If a signature is parsed badly:

1. Add it to `test/heuristics.test.mjs` as a failing case, with any real names,
   addresses, phone numbers and email addresses replaced by invented ones.
2. Fix the parser.
3. Check the existing cases still pass.

Please do not commit a real person's contact details, even your own colleagues'.

## Style

- TypeScript strict mode, no `any` unless there is a comment saying why.
- British English in user-facing copy and comments.
- Comments explain why, not what. Skip the ones that restate the code.
