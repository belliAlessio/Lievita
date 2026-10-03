# Lievita

A browser-only pizza dough calculator and indicative fermentation-to-bake planner. Italian and English; no backend, accounts, runtime fetching, or recipe presets.

Choose Neapolitan, tray or Roman round pizza; enter flour protein percentage, fresh or dry yeast, method, portions and the two planning dates. The app calculates baker's percentages, ingredient masses and automatic room/fridge phases. Tray dough uses a fixed 0.5 g/cm² load; the planner assumes 22°C room temperature and indicative home-oven baking durations. Dough-ball weight is limited to 5000 g and tray dimensions to 200 cm. One pizza/tray is baked at a time: the last one's fermentation must fit the flour limit. The indicative yeast estimate uses the midpoint between first and last fermentation; a large difference triggers a warning. Daylight-saving ambiguities require an explicit choice. Until a schedule is valid, ingredient amounts remain indicative but the yeast dose is withheld.

**Important:** hydration, yeast/time interpolation, protein bands, phase allocation and oven timings are *app estimates* informed by Italian references in `src/domain/model.ts` (consulted 1 October 2026) and phase-order references in `src/domain/schedule.ts` (consulted 3 October 2026). They have **not** been kitchen validated. A matching timeline does not guarantee fermentation or baking results. The fresh-to-dry 3:1 conversion is an AVPN reference, not a universal law or AVPN certification.

## Development

Use Node.js 22 and npm:

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

The static build deploys to GitHub Pages. For a project subpath, use `BASE_PATH=/repo-name/ npm run build` and `BASE_PATH=/repo-name/ npm run preview`; open `http://localhost:4173/repo-name/`. Vite defaults to base `./`. See [AGENTS.md](AGENTS.md) for architecture and validation conventions.
