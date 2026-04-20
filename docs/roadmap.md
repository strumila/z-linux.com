# Outstanding work

Grouped by category. Scope tags: **S** ~hours, **M** ~1 day, **L** multi-day.

## GitHub Actions

- [ ] **Deploy workflow** (M). Build on push to `main`, deploy `dist/` to GitHub Pages. Missing today — nothing actually ships.
- [ ] **Pin Node 22 across workflows** (S). `@astrojs/react@5` wants Node ≥22.12; current crons pin Node 20. Builds succeed but the warning is a latent upgrade bomb.
- [ ] **`CNAME` file + custom-domain config** (S). Drop `z-linux.com` into `public/CNAME` so Pages serves the custom domain; separate DNS work is on you.
- [ ] **Branch-protection compatibility** (S). If `main` is protected, cron pushes break. Either use a PAT or switch cron output to a `data` branch.
- [ ] **`actions/cache` for pip** (S). `cron-stability.yml` reinstalls semopy every run (~1–2 min). Pip cache keyed on `hashFiles('scripts/fit-stability.py')` cuts this.
- [ ] **Concurrency groups** (S). Two cron runs overlapping on a slow day can race pushes. Add `concurrency: { group: 'data-${{ github.workflow }}', cancel-in-progress: false }`.
- [ ] **fetch-lkml.mjs + cron-lkml.yml** (M). Scrape `lore.kernel.org` Atom feeds for a handful of lists (linux-kernel, netdev, io-uring, linux-mm, bpf, rust-for-linux). Produce the existing `lkml.json` schema.
- [ ] **fetch-cves.mjs + cron-cves.yml** (M). Pull from the `linux-cve-announce` mailing list archive (Atom/mbox) and/or https://linuxkernelcves.com. Schema already in `data/cves.json`.
- [ ] **`daysAgo` staleness fix** (S). Current `fetch-kernel-releases.mjs` doesn't re-emit if no release dropped, so `daysAgo` lags. Fix: recompute at build time in `KernelStatus` and `StabilityCard` via `fetchedAt`, OR have the cron always commit.
- [ ] **Manual workflow index/status page** (S). A page that summarises each cron's last successful run, fetched-at timestamp, and dummy flag — helpful for ops.

## Real data from linux kernel git

- [ ] **End-to-end verify fetch-git-stats.mjs against torvalds/linux** (S once done locally; the cron will prove this on first real run). Script hasn't been executed against a real clone.
- [ ] **Swap `--depth=5000` for `--shallow-since`** (S). Cleaner semantics; size the window by calendar days instead of commits.
- [ ] **Historical bootstrap** (L). Walk kernel git 2+ years with weekly buckets; seed `data/stability-history.json`-equivalent so the SEM fit threshold (N≥30) is met on day one. Biggest unlock for the stability index.
- [ ] **`stable_line_age_days`** (M). Currently a placeholder constant (180). Needs real `.0`-tag dates per release line — extend `fetch-kernel-releases.mjs` or add a separate tag-history fetch.
- [ ] **Subsystem co-occurrence edges** (M). `SubsystemGraph.jsx` is a bubble force-layout because `data/subsystems.json` has no edges. Add co-touch edges in `fetch-git-stats.mjs` (pair of top-level dirs touched by same commit → edge weight).
- [ ] **Per-author emails + aliases** (M). Git has multiple emails per person (work/personal). Resolve aliases via `.mailmap` (the kernel ships one).
- [ ] **`Signed-off-by` chain length** (S). Depth of review per commit; proxy for review rigor.
- [ ] **`Fixes:` target sha** (S). Today we just count `Fixes:` trailers; keeping the target sha enables "this fix was for a bug introduced N days ago" analyses.
- [ ] **First-time-contributor flag** (M). Maintain a cumulative author set; label commits where the author appears for the first time.
- [ ] **Merge-window detection** (S). Tag each commit window with `merge-window` / `rc1–rcN` / `stable` from surrounding tags; commit-variance is very different across these phases and the stability model should probably control for it.

## Alternative views of kernel git data

Framed as page or component concepts, each backed by data we'd derive from a richer `fetch-git-stats.mjs`.

- [ ] **Commit velocity** (S once co-occurrence edges exist). Weekly commit count per top-level subsystem over 2+ years, with YoY overlay. Chartwise: stacked bar or small-multiples line chart.
- [ ] **Co-occurrence graph (real)** (M). d3 force-directed where nodes = subsystems, edges = co-touches per window. Makes `SubsystemGraph.jsx` live up to its name.
- [ ] **File churn heatmap** (M). Most-edited files in the window, treemap-style. Collapses to subsystem on zoom-out.
- [ ] **Maintainer turnover** (M). New-contributor rate (first-commit this window) vs veteran rate (≥5 years of activity). Two-line sparkline; or a flow diagram of active→dormant→returned.
- [ ] **Review depth distribution** (S). Histogram of Signed-off-by chain lengths; outliers flagged.
- [ ] **Fixes vs reverts over time** (S). Dual-line time series. Leading indicator of regression pressure.
- [ ] **Release velocity** (M). Days between each tag, -rc count per release, commits per -rc. Good editorial content.
- [ ] **Collaboration network** (L). Co-author / reviewer graph (node-link or adjacency matrix). Communities per subsystem.
- [ ] **Merge-window pulse** (S). Ridgeline plot of daily commit counts with merge-window / -rc phases annotated. Makes the kernel's rhythm visible.
- [ ] **Language / file-type shift** (S). C vs Rust vs asm vs docs file counts over time. Small-multiples.
- [ ] **Geographic clustering** (S). Commit timestamps mod 24h — you get a pretty clear Europe/US/Asia triangulation.
- [ ] **Per-subsystem mini-KSI** (M after historical bootstrap). Each subsystem gets its own reduced stability score; ranking view.

## Stability model

- [ ] **Verify `data/lts-eol.json`** (S). Dates are best-effort from training data; check against kernel.org.
- [ ] **`/stability` page with fit diagnostics** (M). CFI / RMSEA / loadings-over-time once N≥30; a stats-literate audience expects this.
- [ ] **Per-LTS panel (Q3 v2)** (L). Second unit of analysis. Between-line comparisons are where SEM earns its keep.
- [ ] **`cve_dispersion` sign** (S). Currently 0 in theoretical prior; let the fit decide and report the posterior.
- [ ] **Bayesian variant** (L). `blavaan`/Stan for proper uncertainty propagation on the composite. Small-N friendly with informative priors.

## UI / presentation

- [ ] **Browser verification** (S). Start `npm run dev`, visually confirm the d3 bubble layout, streamgraph wiggle, stability card sparkline, and CSS ring animation render correctly. None of this has been seen in a browser yet.
- [ ] **Drill-down pages** (M). `/releases`, `/cves`, `/lkml`, `/stability`. Currently only `/` and `/commits` exist.
- [ ] **Dark mode** (M). CSS-variable swap. Important for an audience that lives in terminals.
- [ ] **Accessibility audit** (M). Contrast (the muted text is borderline), keyboard nav, d3 SVG ARIA, streamgraph hover-only scrub is mouse-only.
- [ ] **SEO basics** (S). Meta description, og:image, sitemap.xml, robots.txt.
- [ ] **Decide fate of stranded components** (S). `src/components/KernelStatus.astro` and `src/components/RingHero.jsx` are unused. Delete or wire in.

## Tooling / DX

- [ ] **TypeScript** (M). Everything is JS. For an Astro project with typed data, `strict: true` is free discipline.
- [ ] **ESLint + Prettier** (S). Cheap insurance; zero now.
- [ ] **One e2e test** (S). Playwright hit on `/` asserting the stability composite renders. Catches the "I broke the JSON schema" class of regression.
- [ ] **Data-schema validation** (S). Zod or JSON Schema over every `data/*.json`, run in CI. Prevents cron writing malformed JSON that only breaks at build time.

## Housekeeping

- [ ] **Remove `data/stability.json` `_dummy` flag** when fit-stability.py runs for real the first time.
- [ ] **Remove every `_dummy: true`** before first public deploy.
- [ ] **Delete `Untitled-1`** in the project root (empty stray file from before scaffolding).

## Recommended next slice

If the next session is a short one, I'd pick in order:

1. Deploy workflow + CNAME + Node 22 bump — **shippable infrastructure**.
2. Real `fetch-git-stats.mjs` verification against linux.git locally — **confirms the pipeline actually works**.
3. `fetch-cves.mjs` against `linux-cve-announce` — **kills the most visible dummy data**.
4. Historical bootstrap for stability — **unlocks the differentiator**.

Everything else can queue behind those.
