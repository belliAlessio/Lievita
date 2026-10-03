# Guide for AI coding agents

Practical project conventions and guardrails for coding agents. Read this before changing the application.

## Project overview

Lievita is a static, browser-only pizza dough calculator and fermentation/bake planner built with Vite, React, strict TypeScript, Vitest, and `react-i18next`. It is deployed to GitHub Pages. There is no backend, no account system, and no runtime recipe fetching.

## Setup and checks

Use Node.js 22 and npm:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
BASE_PATH=/repo-name/ npm run build
BASE_PATH=/repo-name/ npm run preview
```

For a project-subpath preview, open `http://localhost:4173/repo-name/`.

Before considering work done, `npm run typecheck`, `npm test`, and `npm run build` must all pass.

## Architecture

- `src/domain/`: pure calculation, validation, protein-driven indicative recipe model, tray area, and automatic schedule logic. No React or localized user-facing text; return stable codes and parameters for the UI to translate.
- `src/state/`: form parsing/derivation and schema-versioned persistence.
- `src/components/` and `src/App.tsx`: UI components and application composition.
- `src/i18n/`: i18next setup, formatting, and `locales/it.json` / `locales/en.json`.
- Domain tests are in `src/domain/domain.test.ts`; i18n catalog tests are in `src/domain/i18n.test.ts`; state tests live beside modules in `src/state/*.test.ts`; UI interaction tests are in `src/App.test.tsx`.

## Localization and input

- Italian (`it-IT`) is the default; English uses `en-GB`. Route every user-visible string through `t()`.
- Keep `it.json` and `en.json` in identical nested-key shape. Do not use flat dotted keys or empty values. The i18n test statically checks literal `t()` keys.
- Parse numbers according to the active locale: Italian accepts comma decimals and `1.000,5` (grouping plus decimal comma), but rejects ambiguous `1.000`; English rejects `2,500` as ambiguous. Never guess thousands separators.
- A language change must preserve inputs and must not make valid input invalid.

### Adding a translation

1. Add the same nested, non-empty key to both locale files.
2. Run `npm test`; `src/domain/i18n.test.ts` checks key parity and statically verifies literal `t()` keys.

## Testing conventions

- Use Vitest. `vitest.config.ts` sets `TZ=Europe/Rome` for deterministic local-time and DST tests.
- UI tests use `@testing-library/react` and jsdom (`src/App.test.tsx` opts into jsdom).
- Add tests for each behavior change. Domain tests should assert stable error/message codes, not localized sentences.

## Domain rules and guardrails

### Dough and ingredients

- Baker's percentages are based on flour: `flour = M / (1 + (H+S+O+Y)/100)`. `M` is raw dough mass only; no hidden allowances. When the plan is invalid, use a clamped yeast fraction internally to preserve mass while withholding the provisional yeast dose from display.
- Tray mass is `sum(area × 0.5 g/cm²)`. Rectangle area is `L×W`; circle area is `π(d/2)²`. The fixed load is an app choice, not sourced tray guidance.
- Keep full internal precision; round for display to 1 g for ingredients and 0.1 g for yeast. Never display a positive dose as zero; use `< 0.1 g`.
- Fresh and instant dry yeast only; fresh-to-dry `3:1` is an AVPN reference, applied once and disclosed. No malt/sugar or chemical leavening.
- The entered flour protein percentage (6–20%) drives an indicative app estimate, not a flour W inference or a source's own recipe.

### Fermentation and schedule

- The declared `src/domain/model.ts` yeast/time curve is a deterministic **indicative app estimate**, not a validated universal fermentation model. Protein bands, hydration, yeast anchors, and time limits are app choices informed by cited Italian references; never claim kitchen validation or AVPN certification.
- Automatically allocate room or fridge phases from the user's fixed start and first-serving instant; first bake ends at service. Include kneading, rest, dividing, shaping/topping per batch, cooking, recovery, and overlapping 45-minute preheating. Cold hours do not equal room hours. Check the last item's fermentation against the limit, accounting for the entire serial baking window (one item per batch).
- Phase order is an app choice (references consulted 2026-10-03 in `src/domain/schedule.ts`): round fridge dough rests in bulk before cold dividing and a 3h ball rest; tray fridge dough stays in bulk until after refrigeration and 1h bulk acclimation, then is spread into trays and rests 1h before topping. Room-only tray dough has bulk rest, dividing, ball rest, tray spreading and 1h tray rest. Never refrigerate dough already stretched into trays.
- For room-only trays, allocate about 2/3 of the rest time **before** the fixed 1h tray rest to bulk and the remainder to the ball rest; both must be at least 30 minutes. Unlike round styles, tray bulk has no 4h cap, including on long valid ferments.
- Fermentation hours count rests between the end of kneading and an item's shaping/topping, excluding that dough's dividing/spreading work. Fixed cold-room steps are app choices: 1h initial bulk rest, at least 6h fridge rest; first service includes first topping and baking. All manual work is serial.
- When a valid serial baking window makes the last item's fermentation more than 1.5× the first's, warn without blocking. Use the midpoint of first/last fermentation hours for the indicative yeast curve (app choice); retain the full timeline in the domain and group repeated batches only in the UI.
- Do not silently compress or stretch beyond declared limits. Too little time proposes earliest service; too much time proposes later start. Differences under 60 seconds are tolerated for `datetime-local` resolution.
- Handle midnight, multiple days, local timezone and nonexistent/ambiguous DST wall times. Manual work must not overlap; phases cannot be negative.

### Sources and honesty

- No recipe or flour presets remain. Do not copy recipe text or attribute the app's percentages, yeast curve, or oven timing to a single source. Keep source URLs and consultation date in model comments. Cooking durations are app choices; actual ovens differ.

### Validation and saved state

- Empty, negative, non-finite, fractional-count, and out-of-range count inputs (valid counts are 1–200) must produce field errors, never plausible numeric results. Dough-ball weight is limited to 5000 g, tray dimensions to 200 cm. Keep dough results visible when only the planner has errors, but withhold the yeast dose until its schedule is valid.
- Validate `localStorage` data against schema version 3. Persist only forms with valid fields, retaining the last valid record when editing an invalid field. Incompatible versions are ignored with a notice; corrupt or invalid records are silently ignored. UI language is stored separately under `ricetta-pi-language`.
- A language switch must never make source-locale-invalid text valid: retain its field error until the user edits that field. Sanitize invalid hidden-only fields to defaults when saving, without replacing invalid visible fields.

## Accessibility and UI

- Build mobile-first; keep the UI usable at 360 px.
- Provide explicit labels with units, and use `fieldset`/`legend` for grouped choices.
- Associate errors using `aria-invalid` and `aria-describedby`; provide an error summary with links to fields and a single polite `aria-live` region.

## Deployment

- `.github/workflows/deploy.yml` uses `configure-pages`' `base_path` as `BASE_PATH`, then `upload-pages-artifact` and `deploy-pages`.
- Vite's base defaults to `./`; `public/.nojekyll` is required for Pages. The app has no client-side routing.

## Boundaries

- Do not run or commit Git commands unless explicitly asked.
- Do not add a backend, runtime recipe fetching, heavy UI libraries, or an undisclosed predictive yeast model.
- Known npm audit advisories are dev-only (`vite`/`vitest`/`esbuild`); upgrade them only in a dedicated change with the full test run.
- Out of scope for v1: biga, poolish, sourdough, gluten-free dough, and flour blends with dedicated models.
