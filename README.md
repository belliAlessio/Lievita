<div align="center">
  <img src="public/favicon.svg" alt="Lievita logo" width="88" />
  <h1>Lievita 🍕</h1>
  <p><strong>Pizza won't make itself. At least the math can.</strong></p>
  <p>Calculate your dough, plan the rise, and know when to fire up the oven.</p>
  <p><em>Pizza dough calculator &amp; indicative fermentation planner · Italiano / English</em></p>
</div>

---

## What's cooking? 🔥

Pick your pizza, tell Lievita **how many you're making**, **when you're starting**, and **when the first one should hit the table**. It takes care of the ingredient math and the game plan:

| 🍞 Dough | ⏱️ Schedule | 🧊 Fridge or room temperature |
| --- | --- | --- |
| Flour, water, salt, oil, and yeast quantities based on your choices. | A step-by-step timeline from kneading to the first pizza served, including serial baking. | Room and fridge phases allocated automatically for your chosen method. |

- **Three styles:** Neapolitan, tray pizza, and Roman round pizza.
- **Your ingredients:** enter your flour's protein percentage and choose fresh or instant dry yeast.
- **Your trays:** rectangular or round; dough weight depends on their surface area.
- **No clock gymnastics:** the plan accounts for shaping, preheating, and baking one pizza at a time. If the timing doesn't work, you'll know.
- **IT / EN:** switch languages in the app. No account or saved data: refreshing starts a fresh plan with empty dates.

> 💡 These are **indicative estimates**, not a foolproof recipe. Your flour, actual room temperature, and oven get the final say.

## Get your hands floury 🧑‍🍳

You'll need **Node.js 22** and **npm**:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Before serving, run the checks:

```sh
npm run typecheck
npm test
npm run build
```

This is a **static app** built with React, TypeScript, and Vite. It runs in your browser: no backend, logins, or recipes fetched at runtime. Tests use Vitest. See [AGENTS.md](AGENTS.md) for the architecture and development conventions.

## Shipping it 📦

The workflow in `.github/workflows/deploy.yml` checks and builds on `main`, then deploys to **GitHub Pages** (once Pages is configured to use GitHub Actions). To preview a build served from a subpath like `/Lievita/`:

```sh
BASE_PATH=/Lievita/ npm run build
BASE_PATH=/Lievita/ npm run preview
```

Open `http://localhost:4173/Lievita/`. Without `BASE_PATH`, Vite defaults to `./`.

## A quick reality check ⚖️

Hydration, protein bands, yeast dosage, fermentation phases, and baking times are **indicative app choices** informed by Italian references cited in `src/domain/model.ts` (consulted October 1, 2026) and `src/domain/schedule.ts` (consulted October 3, 2026). They **haven't been kitchen-validated** and cannot guarantee results. The 3:1 fresh-to-dry yeast conversion is an AVPN reference, not an AVPN certification of this app.

For trays, Lievita uses a fixed dough load of **0.5 g/cm²**. Baking times are estimates for a home oven; the planner assumes **22 °C** room temperature and bakes one pizza or tray at a time. If the schedule isn't valid, dough quantities stay visible, but the yeast dose is withheld until you fix the timing.

**In short:** use the numbers to get started, then listen to the dough. 👀
