import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

// Deferred choices (flip here if wrong):
//   - file split: commits.json = daily series + top authors; subsystems.json = per-subsystem + heatmap
//   - revert detection: subject prefix "Revert " only (Fixes: trailers are a different metric)
//   - window: whatever --depth=5000 gives us (~10 days); labelled as such
const REPO = '.cache/linux';
const RS = '\x1e', US = '\x1f';
const FMT = `${RS}%H${US}%an${US}%ae${US}%aI${US}%s`;

const raw = execSync(
  `git -C ${REPO} log --no-merges --pretty=format:${FMT} --name-only`,
  { encoding: 'utf8', maxBuffer: 500_000_000 }
);

const byDay = new Map();
const byAuthor = new Map();
const bySubsystem = new Map();
const heatmap = new Map();
const edgeWeights = new Map();
const fileTouches = new Map();
let totalCommits = 0;
let sinceDate = null, untilDate = null;

for (const block of raw.split(RS).slice(1)) {
  const nl = block.indexOf('\n');
  const header = nl === -1 ? block : block.slice(0, nl);
  const files = nl === -1 ? [] : block.slice(nl + 1).split('\n').filter(Boolean);
  const [, name, email, iso, subject] = header.split(US);
  const day = iso.slice(0, 10);

  totalCommits++;
  if (!untilDate || day > untilDate) untilDate = day;
  if (!sinceDate || day < sinceDate) sinceDate = day;

  const isRevert = subject.startsWith('Revert ');
  const ds = byDay.get(day) ?? { commits: 0, reverts: 0 };
  ds.commits++;
  if (isRevert) ds.reverts++;
  byDay.set(day, ds);

  const authorKey = `${name}|${email}`;
  const a = byAuthor.get(authorKey) ?? { name, email, commits: 0 };
  a.commits++;
  byAuthor.set(authorKey, a);

  const touched = new Set();
  for (const f of files) {
    const top = f.split('/')[0];
    if (top) touched.add(top);
  }
  for (const sub of touched) {
    const s = bySubsystem.get(sub) ?? { name: sub, commits: 0, authors: new Set(), churn: 0 };
    s.commits++;
    s.authors.add(authorKey);
    bySubsystem.set(sub, s);
    const hkey = `${sub}|${day}`;
    heatmap.set(hkey, (heatmap.get(hkey) ?? 0) + 1);
  }
  const touchedArr = [...touched];
  for (let i = 0; i < touchedArr.length; i++) {
    for (let j = i + 1; j < touchedArr.length; j++) {
      const [a, b] = [touchedArr[i], touchedArr[j]].sort();
      const key = `${a}|${b}`;
      edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
    }
  }
  for (const f of files) {
    const top = f.split('/')[0];
    if (!top) continue;
    const s = bySubsystem.get(top);
    if (s) s.churn++;
    fileTouches.set(f, (fileTouches.get(f) ?? 0) + 1);
  }
}

function giniCoefficient(counts) {
  if (counts.length === 0) return 0;
  const sorted = counts.slice().sort((a, b) => a - b);
  const n = sorted.length;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * sorted[i];
    denominator += sorted[i];
  }
  return denominator === 0 ? 0 : numerator / (n * denominator);
}

const churnConcentration = giniCoefficient([...fileTouches.values()]);

const daily = [...byDay.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([date, s]) => ({ date, commits: s.commits, reverts: s.reverts }));

const topAuthors = [...byAuthor.values()]
  .sort((a, b) => b.commits - a.commits)
  .slice(0, 20);

const subsystems = [...bySubsystem.values()]
  .map(s => ({ name: s.name, commits: s.commits, authors: s.authors.size, churn: s.churn }))
  .sort((a, b) => b.commits - a.commits);

const heatmapArr = [...heatmap.entries()].map(([k, count]) => {
  const [subsystem, date] = k.split('|');
  return { subsystem, date, count };
});

const totalReverts = daily.reduce((acc, d) => acc + d.reverts, 0);

// `Fixes:` trailer density — approximation: count commits whose message
// body contains a line starting with "Fixes:". Used as a regression indicator.
const fixesRaw = execSync(
  `git -C ${REPO} log --no-merges --grep='^Fixes:' --extended-regexp --format=%H`,
  { encoding: 'utf8', maxBuffer: 100_000_000 },
);
const totalFixes = fixesRaw.split('\n').filter(Boolean).length;

const window = {
  since: sinceDate,
  until: untilDate,
  totalCommits,
  totalAuthors: byAuthor.size,
  totalReverts,
  totalFixes,
  totalFiles: fileTouches.size,
  churnConcentration,
  note: 'Window is shallow clone depth (~10 days), not a calendar period.',
};

const fetchedAt = new Date().toISOString();

writeFileSync(
  'data/commits.json',
  JSON.stringify({ fetchedAt, window, daily, topAuthors }, null, 2) + '\n',
);

const edges = [...edgeWeights.entries()]
  .map(([k, weight]) => {
    const [source, target] = k.split('|');
    return { source, target, weight };
  })
  .sort((a, b) => b.weight - a.weight);

writeFileSync(
  'data/subsystems.json',
  JSON.stringify({ fetchedAt, window, subsystems, edges, heatmap: heatmapArr }, null, 2) + '\n',
);
