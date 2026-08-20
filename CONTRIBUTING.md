# Contributing

Thanks for taking a look. This is a small, focused project — the bar for a change is "does it make a better poster, or make posters easier to make".

## Getting set up

```bash
npm install
npm run dev
```

No configuration is needed: the keyless MusicBrainz provider works out of the box. Add Spotify credentials to `.env` if you want to work on that path (see `.env.example`).

## Before opening a pull request

```bash
npm run verify
```

That runs formatting, linting, typechecking, the test suite and a production build — the same set CI runs. Everything must pass.

## Conventions

- **TypeScript, strict.** `any` needs a reason; prefer narrowing or a proper type.
- **No new runtime dependencies** without a strong case. The app ships React, React DOM and React Router, and nothing else — that is deliberate.
- **Comments explain why**, not what. If a line needs a "what" comment, the line usually needs rewriting instead.
- **Styling** uses plain CSS with the design tokens in `src/styles/tokens.css`. Don't hard-code colours, spacing or radii.
- **Accessibility is not optional.** New controls need roles, labels, keyboard operation and a 44 px touch target, and must respect `prefers-reduced-motion`.

## Adding a template

1. Create `src/lib/poster/templates/<name>.ts` exporting `render<Name>(rc, locale)`.
2. Build it from the helpers in `blocks.ts` — they already handle text fitting, contrast and the option toggles.
3. Register it in `templates/index.ts`, in `TEMPLATE_META` (`src/lib/poster/defaults.ts`) and in the `TemplateId` union (`src/lib/types.ts`).

The renderer smoke test picks up new templates automatically and checks them against every format, including the empty-album and 40-track cases.

Templates must honour every option that applies to them: element toggles, palette style, margin, grain, vignette, text scale and the title/artist overrides.

## Adding a language

1. Copy `src/i18n/locales/en.ts` and translate the values (keep the keys).
2. Register the locale in `SUPPORTED_LOCALES` and `LOCALE_NAMES` (`src/i18n/detect.ts`).
3. Add it to `DICTIONARIES` (`src/i18n/index.tsx`).
4. Optionally add its time zones to `TIMEZONE_LOCALES` so it can be auto-detected.

`src/i18n/i18n.test.ts` fails if a locale is missing a key, has an empty string, or drops an interpolation placeholder.

## Tests

- Pure logic (colour, layout, formatting, providers) gets unit tests.
- Components get behaviour tests with Testing Library — assert what a user sees and does, not implementation details.
- The renderer is tested through a recording canvas stub; it needs no real canvas.

## Reporting bugs

Please include the browser, the template and format in use, and — if the poster looks wrong — a screenshot. A poster that renders badly for a particular album is a useful bug report; mention the album so it can be reproduced.
