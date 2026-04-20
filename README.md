# z-linux.com

Kernel activity, visualised. A static dashboard showing Linux kernel release cadence, commit activity, open CVEs, trending LKML threads, and a hierarchical-SEM **Kernel Stability Index**.

## How it works

GitHub Actions cron jobs pull data from kernel.org, the torvalds/linux git repo, the LKML archive, and the linux-cve feed. Each job writes a JSON snapshot back into `data/` on `main`. That commit triggers an Astro rebuild; the site reads the committed JSON at build time and renders static HTML with a few d3 islands hydrated on demand.

Every datapoint is git-archived and inspectable via `git log data/`.

```
kernel.org    ┐
torvalds/linux├──► GH Actions cron ──► data/*.json ──► Astro SSR ──► dist/
LKML archive  │                         (committed)      + d3 islands
linux-cve     ┘
```

## Develop

```bash
npm install
npm run dev               # http://localhost:4321
npm run build             # static site in dist/
npm run fetch:kernels     # try the kernel.org fetch locally
```

For the stability-index fit you also need Python:

```bash
pip install numpy pandas semopy
python scripts/fit-stability.py
```

## Repo layout

```
.github/workflows/   # cron workflows, one per data source
scripts/             # fetch-*.mjs + fit-stability.py
data/                # cron output, committed to git
src/
  layouts/           # Astro shell
  pages/             # one .astro per route
  components/        # .astro (static) + .jsx (d3/three.js islands)
docs/                # architecture + model specs
CLAUDE.md            # guidance for AI agents working on this repo
```

## Documentation

- [CLAUDE.md](CLAUDE.md) — conventions, commands, known gaps
- [docs/stability-model.md](docs/stability-model.md) — the SEM specification

## Current status

Scaffold + hybrid dashboard + stability card are in place. Real fetch scripts exist for kernel.org releases and git stats; LKML and CVE fetches are **not yet written** and their data files are dummy. LTS EOL dates need verification. No deploy workflow yet.

## License

TBD.
