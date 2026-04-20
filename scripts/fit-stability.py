#!/usr/bin/env python3
"""Hierarchical Kernel Stability Index (KSI) — computes daily observation,
appends to history, and attempts a hierarchical SEM fit once N >= threshold.

Model (lavaan-style):
    security   =~ cve_intensity + cve_high_count + cve_dispersion
    regression =~ revert_rate + fixes_density + commit_variance
    cadence    =~ point_release_age_days + lts_eol_distance_days + stable_line_age_days
    stability  =~ security + regression + cadence

Until fit identifies, loadings fall back to theoretical (equal within subfactor,
sign per theory). Fit status is surfaced in the output.
"""

import json
import math
from collections import Counter
from datetime import datetime, date, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'

N_FIT_THRESHOLD = 30
HISTORY_LIMIT_DAYS = 180

# Sign convention: positive loading = higher indicator value => more stable.
THEORETICAL_LOADINGS = {
    'security': {
        'cve_intensity':  -1.0,
        'cve_high_count': -1.0,
        'cve_dispersion':  0.0,
    },
    'regression': {
        'revert_rate':         -1.0,
        'fixes_density':       -1.0,
        'commit_variance':     -1.0,
        'churn_concentration': -1.0,
    },
    'cadence': {
        'point_release_age_days':  -1.0,
        'lts_eol_distance_days':    1.0,
        'stable_line_age_days':     1.0,
    },
}
HIERARCHY = {'security': 1/3, 'regression': 1/3, 'cadence': 1/3}


def load_json(name):
    p = DATA / name
    return json.loads(p.read_text()) if p.exists() else None


def compute_indicators():
    commits = load_json('commits.json') or {}
    cves    = load_json('cves.json')    or {}
    kernels = load_json('kernels.json') or {}
    lts_eol = (load_json('lts-eol.json') or {}).get('eol', {})

    window = commits.get('window', {})
    total_commits = max(window.get('totalCommits', 1), 1)
    total_reverts = window.get('totalReverts', 0)
    total_fixes   = window.get('totalFixes', 0)
    churn_concentration = window.get('churnConcentration', 0.0)

    counts = [d['commits'] for d in commits.get('daily', [])]
    mean = sum(counts) / len(counts) if counts else 1
    var  = sum((c - mean) ** 2 for c in counts) / len(counts) if counts else 0
    cv   = math.sqrt(var) / mean if mean else 0

    sev_w = {'high': 3, 'medium': 2, 'low': 1}
    cve_list = cves.get('cves', [])
    cve_intensity  = sum(sev_w.get(c.get('severity'), 1) for c in cve_list)
    cve_high_count = sum(1 for c in cve_list if c.get('severity') == 'high')
    subs = [c.get('subsystem', '?').split('/')[0] for c in cve_list]
    total = len(subs) or 1
    probs = [n / total for n in Counter(subs).values()]
    cve_dispersion = -sum(p * math.log(p) for p in probs if p > 0)

    stable = next((k for k in kernels.get('kernels', []) if k.get('moniker') == 'stable'), None)
    point_release_age = stable.get('daysAgo', 0) if stable else 0
    stable_line_age = 180  # placeholder; requires historical release ingest

    today = date.today()
    lts_distances = []
    for k in kernels.get('kernels', []):
        if k.get('moniker') != 'longterm':
            continue
        line = '.'.join(k.get('version', '').split('.')[:2])
        if line in lts_eol:
            eol = datetime.strptime(lts_eol[line], '%Y-%m-%d').date()
            lts_distances.append((eol - today).days)
    lts_eol_distance = max(lts_distances) if lts_distances else 0

    return {
        'security': {
            'cve_intensity':  cve_intensity,
            'cve_high_count': cve_high_count,
            'cve_dispersion': cve_dispersion,
        },
        'regression': {
            'revert_rate':         total_reverts / total_commits,
            'fixes_density':       total_fixes   / total_commits,
            'commit_variance':     cv,
            'churn_concentration': churn_concentration,
        },
        'cadence': {
            'point_release_age_days': point_release_age,
            'lts_eol_distance_days':  lts_eol_distance,
            'stable_line_age_days':   stable_line_age,
        },
    }


def z_score(indicators, history):
    if len(history) < 5:
        return {sf: {k: 0.0 for k in inds} for sf, inds in indicators.items()}
    out = {}
    for sf, inds in indicators.items():
        out[sf] = {}
        for name, val in inds.items():
            hist_vals = [
                h.get('indicators', {}).get(sf, {}).get(name)
                for h in history
                if h.get('indicators', {}).get(sf, {}).get(name) is not None
            ]
            if len(hist_vals) < 5:
                out[sf][name] = 0.0
                continue
            mu = sum(hist_vals) / len(hist_vals)
            sd_sq = sum((v - mu) ** 2 for v in hist_vals) / len(hist_vals)
            sd = math.sqrt(sd_sq) if sd_sq > 0 else 1.0
            out[sf][name] = (val - mu) / sd
    return out


def score(z_inds, loadings):
    subfactor = {}
    for sf, inds in z_inds.items():
        weighted = 0.0
        denom = 0.0
        for name, zval in inds.items():
            w = loadings.get(sf, {}).get(name, 0.0)
            weighted += w * zval
            denom += abs(w)
        avg = weighted / denom if denom else 0.0
        subfactor[sf] = 1.0 / (1.0 + math.exp(-avg))
    composite = sum(HIERARCHY[sf] * subfactor[sf] for sf in subfactor)
    return composite, subfactor


def try_fit(history, indicator_names):
    try:
        import pandas as pd
        import semopy
    except ImportError:
        return None
    if len(history) < N_FIT_THRESHOLD:
        return None

    rows = []
    for h in history:
        row = {}
        for sf, inds in h.get('indicators', {}).items():
            for name, val in inds.items():
                row[f'{sf}__{name}'] = val
        rows.append(row)
    df = pd.DataFrame(rows).dropna()
    if len(df) < N_FIT_THRESHOLD:
        return None
    df = (df - df.mean()) / df.std().replace(0, 1)

    parts = []
    for sf, names in indicator_names.items():
        cols = [f'{sf}__{n}' for n in names if f'{sf}__{n}' in df.columns]
        if len(cols) < 2:
            return None
        parts.append(f'{sf} =~ ' + ' + '.join(cols))
    parts.append('stability =~ security + regression + cadence')
    model_desc = '\n'.join(parts)

    try:
        m = semopy.Model(model_desc)
        m.fit(df)
        insp = m.inspect()
    except Exception:
        return None
    if (insp['Estimate'].abs() > 10).any():
        return None

    fitted = {sf: {} for sf in indicator_names}
    for _, row in insp.iterrows():
        if row['op'] != '~':
            continue
        lhs = row['lval']
        rhs = row['rval']
        if lhs in indicator_names and '__' in rhs:
            fitted[lhs][rhs.split('__', 1)[1]] = float(row['Estimate'])

    try:
        stats = semopy.calc_stats(m)
        cfi = float(stats.loc[0, 'CFI']) if 'CFI' in stats.columns else None
        rmsea = float(stats.loc[0, 'RMSEA']) if 'RMSEA' in stats.columns else None
    except Exception:
        cfi, rmsea = None, None

    return fitted, {'cfi': cfi, 'rmsea': rmsea, 'loadings_source': 'fitted'}


def main():
    indicators = compute_indicators()
    existing = load_json('stability.json') or {}
    history = [h for h in existing.get('history', []) if h.get('date') != date.today().isoformat()]
    history.append({'date': date.today().isoformat(), 'indicators': indicators})
    history = history[-HISTORY_LIMIT_DAYS:]

    z_inds = z_score(indicators, history[:-1])
    indicator_names = {sf: list(inds.keys()) for sf, inds in indicators.items()}

    fit = try_fit(history, indicator_names)
    if fit:
        loadings, meta = fit
    else:
        loadings = THEORETICAL_LOADINGS
        meta = {'cfi': None, 'rmsea': None, 'loadings_source': 'theoretical'}

    composite, subfactors = score(z_inds, loadings)

    history[-1]['composite'] = composite
    for sf in subfactors:
        history[-1][f'{sf}_score'] = subfactors[sf]

    output = {
        'fetchedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'fit_status': meta['loadings_source'],
        'n_observations': len(history),
        'fit_threshold': N_FIT_THRESHOLD,
        'fit_metadata': meta,
        'current': {
            'window_end': history[-1]['date'],
            'composite': composite,
            'subfactors': {
                sf: {'score': subfactors[sf], 'indicators': indicators[sf]}
                for sf in subfactors
            },
        },
        'loadings': loadings,
        'hierarchy': HIERARCHY,
        'history': history,
    }
    (DATA / 'stability.json').write_text(json.dumps(output, indent=2) + '\n')


if __name__ == '__main__':
    main()
