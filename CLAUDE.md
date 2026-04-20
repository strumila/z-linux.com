# z-linux.com — agent guidance

Kernel activity dashboard. Static Astro site fed by GitHub Actions cron jobs that commit JSON to `data/` on `main`; the site rebuilds from that committed state. d3/three.js components hydrate as islands. Signature feature is the Kernel Stability Index (KSI), a hierarchical SEM latent computed nightly in Python.

Read this whole file before making changes.

## Architecture at a glance

```
┌─────────────────────┐     ┌──────────────┐     ┌──────────────────┐
│ GH Actions cron     │ ──► │ data/*.json  │ ──► │ Astro static SSR │
│ fetch-*.mjs         │     │ (committed   │     │ + .astro panels  │
│ fit-stability.py    │     │  to main)    │     │ + d3/three .jsx  │
└─────────────────────┘     └──────────────┘     └──────────────────┘
```

Every datapoint on the site is traceable via `git log` on `data/`. Expect ~100+ bot commits/month; that's intentional.

## Commands

| Command | What |
|---|---|
| `npm run dev` | Astro dev at http://localhost:4321 |
| `npm run build` | Static build → `dist/` |
| `npm run preview` | Serve built `dist/` |
| `npm run fetch:kernels` | Run kernel-release fetch against kernel.org |
| `python scripts/fit-stability.py` | Fit stability index locally (needs pandas + semopy) |

## Data sources

| Source | Cron | Script | Output | Status |
|---|---|---|---|---|
| kernel.org releases | `:17` hourly | `fetch-kernel-releases.mjs` | `kernels.json` | live |
| torvalds/linux git | `03:30 UTC` | `fetch-git-stats.mjs` | `commits.json` + `subsystems.json` | live script, dummy data |
| Stability fit | `04:45 UTC` | `fit-stability.py` | `stability.json` | live script, dummy data |
| LKML threads | planned 6h | `fetch-lkml.mjs` | `lkml.json` | **not written** — dummy only |
| linux-cve feed | planned 2h | `fetch-cves.mjs` | `cves.json` | **not written** — dummy only |
| LTS EOL dates | manual | — | `lts-eol.json` | static, `_review: true` |

Every data file with fabricated data is tagged `"_dummy": true` at the top. Grep for it before shipping.

## Conventions

### Fetch scripts
- **Fail loud.** No try/catch. Upstream down → cron fails → workflow doesn't commit → GH notifies.
- **Top-level fields:** `fetchedAt` (ISO-8601 UTC), `_dummy` if fabricated.
- **Workflow pattern:** checkout, setup-node 20 (or setup-python 3.12 for fit-stability), run script, `git diff --staged --quiet ||` commit-if-changed.
- **Permissions:** workflows need `contents: write` to push back to main.

### Components
- `src/components/*.astro` — static, SSR at build, no JS shipped.
- `src/components/*.jsx` — React islands, d3/three.js viz, hydrated `client:visible`.
- `src/layouts/Base.astro` — minimal HTML shell.
- Styles live inside component `<style>` blocks (scoped). `<style is:global>` only in `index.astro` for body/html resets and CSS variables.

### Typography
- Monospace (`ui-monospace, SFMono-Regular, monospace`) for: numbers, IDs, KPI values, version strings, card section titles, labels.
- Sans (`ui-sans-serif, system-ui, sans-serif`) for: prose only.

### Palette (tied to the ring-0 / ring-3 concept)
- Coral `#ff7a5c` — ring 0, mainline, warmth
- Blue `#4f94d4` — ring 3, stable, user-space
- Amber `#c58b2e` — medium severity, dummy tags
- Red `#e85b4a` — high severity, critical stability band
- Green `#4a9d5f` — steady stability band only

### Stability bands (composite → label)
- ≥0.75 **steady** (green)
- 0.60–0.75 **watchful** (blue)
- 0.45–0.60 **elevated** (amber)
- <0.45 **critical** (red)

## Kernel Stability Index (KSI)

Hierarchical reflective SEM, higher-order latent `stability` → 3 subfactors (`security`, `regression`, `cadence`) → 3 indicators each. Python + semopy nightly refit. Falls back to theoretical loadings when N<30 or fit fails. **Never crashes the cron on fit failure** — always emits a composite.

See [docs/stability-model.md](docs/stability-model.md) for the full spec.

Changes to the indicator set must update three places in lockstep:
1. `THEORETICAL_LOADINGS` in `scripts/fit-stability.py`
2. Dummy `data/stability.json` (keep schema parity so UI doesn't break)
3. Any indicator display in `src/components/StabilityCard.astro`

## Deployment

Assumed GitHub Pages at `https://z-linux.com` custom domain. `astro.config.mjs` `site` reflects this. A deploy workflow is **not yet written**; when adding one, use Node 22 (not 20 — `@astrojs/react@5` warns on 20, though builds currently succeed).

## Known gaps

- `fetch-lkml.mjs` and `fetch-cves.mjs` are not implemented.
- `data/lts-eol.json` dates need verification against kernel.org.
- `stable_line_age_days` is a placeholder constant (180) in the KSI until historical release tags are ingested.
- No deploy workflow, no CNAME guidance.
- KSI fit needs N ≥ 30 daily observations → theoretical loadings for ~30 days after real operation starts.
- `data/kernels.json`'s `daysAgo` is baked in at fetch time; goes stale if no new release resets the cron commit. Fix would be either daily re-emit regardless of changes, or recompute at build time.

## Working style

- **Terse, operational communication.** User is experienced (Astro, GH Actions, d3, three.js, SEM). Skip intros.
- **Trust provided architecture.** When user pastes code in response to a design question, treat that as the accepted answer for the scope it covers. Surface non-obvious tradeoffs once; don't re-litigate.
- **Ask when blocked on something non-derivable** (hostnames, model shape, indicator sets). One ask; if no answer, proceed with the most defensible default and mark the assumption inline.
- **Use `TodoWrite`** for work with ≥3 steps.
- **Verify builds** (`npm run build`) before claiming complete. Flag explicitly that UI verification requires a browser you may not have.
- **Don't add comments explaining WHAT.** Identifiers do that. Only WHY when non-obvious.
- **Don't create planning/decision/summary docs** unless asked.

## Memory

Agent-scoped notes (user profile, locked decisions, feedback) live in your Claude Code memory for this project. Read them at session start; they carry context that's not in this file.
