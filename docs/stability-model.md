# Kernel Stability Index — model specification

The Kernel Stability Index (KSI) is a hierarchical reflective structural equation model (SEM) that produces a daily composite score in `[0, 1]` describing the current operational stability of the mainline Linux kernel. It is the site's differentiator: other kernel dashboards surface observables; KSI surfaces a measurement-model latent grounded in theory.

## Model structure

```
                 ┌───────────┐
                 │ stability │   (higher-order latent)
                 └─────┬─────┘
           ┌───────────┼───────────┐
           ▼           ▼           ▼
       security   regression    cadence       (first-order latents)
       ┌─┬─┬─┐    ┌─┬─┬─┐    ┌─┬─┬─┐
       └─┴─┴─┘    └─┴─┴─┘    └─┴─┴─┘          (3 indicators each)
```

Reflective at both levels: the latent construct causes its indicators. The hierarchy is identified via the three subfactors loading on the higher-order `stability` latent.

### lavaan syntax

```
security   =~ cve_intensity + cve_high_count + cve_dispersion
regression =~ revert_rate + fixes_density + commit_variance
cadence    =~ point_release_age_days + lts_eol_distance_days + stable_line_age_days
stability  =~ security + regression + cadence
```

## Indicators

| Subfactor | Indicator | Operationalisation | Source | Theoretical sign |
|---|---|---|---|---|
| security | `cve_intensity` | Σ severity_weight(cve); weights high=3, med=2, low=1 | `data/cves.json` | − |
| security | `cve_high_count` | count of `severity == "high"` in window | `data/cves.json` | − |
| security | `cve_dispersion` | Shannon entropy over top-level subsystems of affected CVEs | `data/cves.json` | 0 (neutral) |
| regression | `revert_rate` | `totalReverts / totalCommits` over window | `data/commits.json` | − |
| regression | `fixes_density` | `totalFixes / totalCommits` (commits with `Fixes:` trailer) | `data/commits.json` | − |
| regression | `commit_variance` | σ(daily commit counts) / μ | `data/commits.json` | − |
| cadence | `point_release_age_days` | days since latest stable point release | `data/kernels.json` | − |
| cadence | `lts_eol_distance_days` | max(days until EOL) across active longterm lines | `data/lts-eol.json` | + |
| cadence | `stable_line_age_days` | days since .0 release of current stable line | **placeholder (=180)** | + |

"Theoretical sign" is the direction of the loading when the indicator is oriented so that higher values of the latent = more stable.

### Indicator gaps

- **`stable_line_age_days`** is a constant 180 until historical release tags are ingested. Fix by extending `scripts/fetch-kernel-releases.mjs` (or a new script) to pull tag history and record the date of `X.Y.0` for each `X.Y` line.
- **`cve_dispersion`** is theoretically interesting but its sign is ambiguous — highly dispersed CVEs could mean either "broad audit coverage" (+) or "systemic weakness" (−). Keep loading at 0 in the theoretical prior; let the fit decide once N is sufficient.

## Fitting strategy

### Bootstrap (current state)

The KSI bootstraps from **theoretical loadings**: equal magnitude within each subfactor, signs per the table above. Subfactor scores are computed as

```
subfactor = σ( Σ w_i · z(indicator_i) / Σ |w_i| )
```

where `z(·)` is the z-score against historical observations (or 0 when N<5) and `σ` is the logistic. The composite is the equally-weighted mean of the three subfactor scores.

This is deliberately not-yet-SEM. It gives the site a credible, explainable number from day one, uses the same schema the fit will later emit, and exposes `fit_status: "theoretical"` in the JSON so the dashboard footer can honestly label the state.

### Refit threshold

Once the history file holds `N ≥ 30` daily observations (≈1 month of cron runs), `fit-stability.py` attempts a semopy fit each night. If the fit:

1. converges, and
2. produces no estimates with `|loading| > 10` (Heywood / identification pathology), and
3. imports succeed (semopy is installed),

the script swaps in the fitted loadings and emits `fit_status: "fitted"` with CFI/RMSEA in `fit_metadata`. Any failure falls back to theoretical. The cron never crashes on fit failure.

### Why N=30

Thirty is not a principled sample size for SEM; a rigorous fit of nine indicators with three first-order factors plus one higher-order plus variances wants N ≈ 100–200. Thirty is the threshold at which semopy will at least produce point estimates without numeric catastrophe. Treat fits in the 30–100 range as diagnostic; communicate that via CFI/RMSEA on the dashboard.

**Better answer:** bootstrap with historical data. An offline job could compute weekly indicators back to ~2019 using the kernel git log, `linux-cve-announce` archive, and tag dates, giving N ≈ 300 on day one. This is future work.

## Output schema

`data/stability.json`:

```json
{
  "fetchedAt": "ISO-8601 UTC",
  "fit_status": "theoretical | fitted",
  "n_observations": 12,
  "fit_threshold": 30,
  "fit_metadata": {
    "cfi": 0.95 | null,
    "rmsea": 0.04 | null,
    "loadings_source": "theoretical | fitted"
  },
  "current": {
    "window_end": "YYYY-MM-DD",
    "composite": 0.745,
    "subfactors": {
      "security":   { "score": 0.68, "indicators": { ... } },
      "regression": { "score": 0.74, "indicators": { ... } },
      "cadence":    { "score": 0.82, "indicators": { ... } }
    }
  },
  "loadings": { "<subfactor>": { "<indicator>": number, ... }, ... },
  "hierarchy": { "security": 0.333, "regression": 0.333, "cadence": 0.333 },
  "history": [ { "date": "YYYY-MM-DD", "composite": 0.745, "security_score": ..., ... }, ... ]
}
```

`history` is capped at 180 entries (read-modify-write by the cron). UI reads `current` + `history[*].composite` for the sparkline; future richer widgets can read subfactor trajectories from the per-entry scores.

## Qualitative bands

The composite is mapped to a qualitative label for the dashboard:

| Composite | Band | Colour |
|---|---|---|
| ≥0.75 | steady | green |
| 0.60–0.75 | watchful | blue |
| 0.45–0.60 | elevated | amber |
| <0.45 | critical | red |

Thresholds are editorial, not statistical. Revisit once ≥6 months of live history allow a sensible percentile-based cut.

## Identification & validity concerns

- **Reflective assumption.** Each indicator is modelled as an effect of the latent. This is plausible for revert rate and CVE counts (stability causes fewer of both), borderline for cadence indicators (EOL distance is more a policy variable than a consequence of stability), and defensible-only-just for `cve_dispersion`. If cadence turns out to behave formatively, the higher-order model is misspecified and `cadence` should move to a composite score outside the SEM.
- **Stationarity.** Reverting to theoretical loadings each time N drops (e.g., post-truncation) is fine; switching loading source is a structural change users will see. Surface this in the UI narrative.
- **Panel alternative.** Q3 (unit of analysis) defaulted to rolling mainline; a richer v2 would fit a panel over LTS lines × time, letting cadence be modelled within-line and between-line variance be decomposed.

## Future work

1. **History bootstrap.** Ingest 2+ years of weekly kernel stats (git + CVE archives) so day-one N is ≈ 100 and SEM fits meaningfully from go.
2. **Per-LTS panel.** Each longterm line gets its own stability trajectory; dashboard can show a between-line comparison.
3. **`stable_line_age_days` real computation.** Extend release-fetch to store `.0` tag dates.
4. **`cve_dispersion` sign.** Let the fit decide; report posterior-style on the dashboard.
5. **Bayesian variant.** Replace semopy with `blavaan` (R) or a hand-rolled Stan model; carry informative priors on loadings from the theoretical structure, so the model is identified with smaller N and uncertainty is propagated into the composite.
6. **Fit telemetry.** A `/stability` page showing historical CFI/RMSEA, loading estimates over time, and indicator contributions — this is what a stats-literate audience will want.
