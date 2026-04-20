import { writeFileSync } from 'node:fs';

const res = await fetch('https://www.kernel.org/releases.json');
const raw = await res.json();
const now = new Date();

const kernels = raw.releases.map(r => ({
  version:  r.version,
  moniker:  r.moniker,          // mainline | stable | longterm | linux-next
  released: r.released.isodate,
  daysAgo:  Math.floor((now - new Date(r.released.isodate)) / 86_400_000),
  iseol:    r.iseol,
}));

writeFileSync('data/kernels.json', JSON.stringify({
  fetchedAt: now.toISOString(),
  latest_stable: raw.latest_stable.version,
  kernels,
}, null, 2) + '\n');
