# Contributing

Thanks for your interest in TokenCost FinOps Analyzer! Bug reports, ideas and pull requests are all welcome.

## Reporting a bug

Open an [issue](https://github.com/BurakYildizGameDev/tokencost-web/issues/new/choose) and include:

- what you did (pasted text, file type, which button),
- what you expected and what you saw,
- browser and OS.

If the problem is with parsing, a few sample rows help a lot. **Remove anything sensitive first** — the app
runs locally, but issues are public.

## Development setup

```bash
git clone https://github.com/BurakYildizGameDev/tokencost-web.git
cd tokencost-web
npm ci
npm start            # http://localhost:5173
npm run test:watch   # tests in watch mode
```

Requires Node 18+. There is no build step: the browser loads `src/` directly as ES modules.

## Guidelines

- **No runtime dependencies.** The app ships as plain HTML, CSS and ES modules. Dev dependencies (Vitest, jsdom)
  are fine.
- **Keep the layers clean.** Code in `src/core` and `src/ocr` must stay pure: no DOM, `window`, `localStorage`
  or `fetch`. Pass browser objects in through the `environment`/`options` parameters instead.
- **Test first.** Add or update a test in `tests/` for every behaviour change. `npm test` must pass — CI blocks
  the deploy otherwise.
- **Translations.** Every key in `src/core/i18n.js` must exist in all five languages; `tests/i18n.test.js`
  enforces this.
- Match the style of the surrounding code (2-space indent, single quotes, JSDoc on exported functions).

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your change with tests.
3. Run `npm test`.
4. Open a PR describing what changed and why. Screenshots are appreciated for UI changes.
