import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const INDICATOR_LABELS = {
  cve_intensity:          'CVE intensity',
  cve_high_count:         'CVE high',
  cve_dispersion:         'CVE disp.',
  revert_rate:            'revert rate',
  fixes_density:          'Fixes: dens.',
  commit_variance:        'commit var.',
  churn_concentration:    'churn conc.',
  point_release_age_days: 'release age',
  lts_eol_distance_days:  'LTS EOL',
  stable_line_age_days:   'line age',
};

const SUBFACTOR_ORDER = ['security', 'regression', 'cadence'];

function formatValue(v) {
  if (typeof v !== 'number') return String(v);
  if (Math.abs(v) < 1 && v !== 0) return v.toFixed(4);
  return v.toLocaleString();
}

function formatLoading(l) {
  if (l === 0) return '0';
  const s = Math.abs(l).toFixed(2);
  return l > 0 ? `+${s}` : `−${s}`;
}

export default function Semplot({ data }) {
  const svgRef = useRef(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const W = 820, H = 480;
    svg.attr('viewBox', `0 0 ${W} ${H}`);

    const { current, loadings, hierarchy } = data;

    const nodes = [];
    nodes.push({
      id: 'stability',
      kind: 'higher',
      label: 'stability',
      x: W / 2,
      y: 70,
      value: current.composite,
    });
    const subX = [200, W / 2, W - 200];
    SUBFACTOR_ORDER.forEach((sf, i) => {
      nodes.push({
        id: sf,
        kind: 'latent',
        label: sf,
        x: subX[i],
        y: 240,
        value: current.subfactors[sf].score,
      });
    });
    SUBFACTOR_ORDER.forEach((sf, sIdx) => {
      const inds = Object.keys(current.subfactors[sf].indicators);
      const count = inds.length;
      const spacing = count <= 3 ? 90 : 60;
      const rectWidth = count <= 3 ? 84 : 64;
      inds.forEach((ind, iIdx) => {
        const offset = (iIdx - (count - 1) / 2) * spacing;
        nodes.push({
          id: `${sf}__${ind}`,
          kind: 'indicator',
          label: INDICATOR_LABELS[ind] ?? ind,
          rawKey: ind,
          x: subX[sIdx] + offset,
          y: 420,
          value: current.subfactors[sf].indicators[ind],
          loading: loadings[sf][ind],
          parent: sf,
          rectWidth,
        });
      });
    });

    const edges = [];
    SUBFACTOR_ORDER.forEach(sf => {
      edges.push({ source: 'stability', target: sf, loading: hierarchy[sf], id: `stability->${sf}` });
    });
    SUBFACTOR_ORDER.forEach(sf => {
      Object.keys(current.subfactors[sf].indicators).forEach(ind => {
        edges.push({
          source: sf,
          target: `${sf}__${ind}`,
          loading: loadings[sf][ind],
          id: `${sf}->${sf}__${ind}`,
        });
      });
    });

    const nodeById = new Map(nodes.map(n => [n.id, n]));

    const nodeBottom = (n) => n.kind === 'indicator' ? n.y : n.y + (n.kind === 'higher' ? 24 : 22);
    const nodeTop    = (n) => n.kind === 'indicator' ? n.y - 14 : n.y - (n.kind === 'higher' ? 24 : 22);

    const edgeG = svg.append('g').attr('class', 'edges').attr('fill', 'none');
    edges.forEach(e => {
      const s = nodeById.get(e.source);
      const t = nodeById.get(e.target);
      const absL = Math.abs(e.loading);
      const color =
        e.loading > 0 ? '#4a9d5f'
        : e.loading < 0 ? '#e85b4a'
        : 'rgba(0,0,0,0.3)';

      const sx = s.x, sy = nodeBottom(s);
      const tx = t.x, ty = nodeTop(t);
      const midY = (sy + ty) / 2;
      const d = `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;

      edgeG.append('path')
        .attr('class', 'sem-edge')
        .attr('data-id', e.id)
        .attr('d', d)
        .attr('stroke', color)
        .attr('stroke-width', Math.max(0.8, Math.sqrt(absL) * 1.6))
        .attr('opacity', 0.45);

      edgeG.append('text')
        .attr('class', 'sem-edge-label')
        .attr('data-id', e.id)
        .attr('x', (sx + tx) / 2)
        .attr('y', midY - 4)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .attr('font-size', 10)
        .attr('fill', 'rgba(0,0,0,0.62)')
        .attr('pointer-events', 'none')
        .text(formatLoading(e.loading));
    });

    const edgesBySource = d3.group(edges, e => e.source);
    const edgesByTarget = d3.group(edges, e => e.target);

    const nodeG = svg.append('g').attr('class', 'nodes');
    nodes.forEach(n => {
      const g = nodeG.append('g')
        .attr('class', `sem-node sem-${n.kind}`)
        .attr('data-id', n.id)
        .attr('transform', `translate(${n.x}, ${n.y})`)
        .style('cursor', 'pointer');

      const handleEnter = () => {
        svg.selectAll('.sem-edge').attr('opacity', 0.08);
        svg.selectAll('.sem-edge-label').attr('opacity', 0.15);
        svg.selectAll('.sem-node').style('opacity', 0.35);
        g.style('opacity', 1);
        const related = new Set([n.id]);
        (edgesBySource.get(n.id) ?? []).forEach(e => related.add(e.target));
        (edgesByTarget.get(n.id) ?? []).forEach(e => related.add(e.source));
        related.forEach(id => {
          svg.selectAll(`.sem-node[data-id="${id}"]`).style('opacity', 1);
        });
        [...(edgesBySource.get(n.id) ?? []), ...(edgesByTarget.get(n.id) ?? [])].forEach(e => {
          svg.selectAll(`.sem-edge[data-id="${e.id}"]`).attr('opacity', 0.9);
          svg.selectAll(`.sem-edge-label[data-id="${e.id}"]`).attr('opacity', 1);
        });
      };
      const handleLeave = () => {
        svg.selectAll('.sem-edge').attr('opacity', 0.45);
        svg.selectAll('.sem-edge-label').attr('opacity', 1);
        svg.selectAll('.sem-node').style('opacity', 1);
      };

      g.on('click', () => setSelected(n))
       .on('mouseenter', handleEnter)
       .on('mouseleave', handleLeave);

      if (n.kind === 'higher' || n.kind === 'latent') {
        const rx = n.kind === 'higher' ? 72 : 62;
        const ry = n.kind === 'higher' ? 26 : 22;
        const fill = n.kind === 'higher' ? '#2b5c8a' : '#4f94d4';
        g.append('ellipse')
          .attr('rx', rx).attr('ry', ry)
          .attr('fill', fill)
          .attr('opacity', 0.92)
          .attr('stroke', '#1f4666')
          .attr('stroke-width', 1);
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '-0.15em')
          .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
          .attr('font-size', n.kind === 'higher' ? 13 : 11.5)
          .attr('font-weight', 600)
          .attr('fill', 'white')
          .attr('pointer-events', 'none')
          .text(n.label);
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '1.1em')
          .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
          .attr('font-size', 10)
          .attr('fill', 'rgba(255,255,255,0.82)')
          .attr('pointer-events', 'none')
          .text(n.value.toFixed(3));
      } else {
        const half = n.rectWidth / 2;
        g.append('rect')
          .attr('x', -half).attr('y', -15)
          .attr('width', n.rectWidth).attr('height', 30)
          .attr('fill', '#fff')
          .attr('stroke', 'rgba(0,0,0,0.35)')
          .attr('stroke-width', 0.9)
          .attr('rx', 3);
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '-0.15em')
          .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
          .attr('font-size', 10)
          .attr('fill', '#222')
          .attr('pointer-events', 'none')
          .text(n.label);
        g.append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '1em')
          .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
          .attr('font-size', 9)
          .attr('fill', 'rgba(0,0,0,0.55)')
          .attr('pointer-events', 'none')
          .text(formatValue(n.value));
      }
    });

    svg.append('g').attr('class', 'legend')
      .attr('transform', `translate(12, ${H - 60})`)
      .call(g => {
        const items = [
          { label: 'positive loading', color: '#4a9d5f' },
          { label: 'negative loading', color: '#e85b4a' },
          { label: 'neutral (0)',       color: 'rgba(0,0,0,0.3)' },
        ];
        items.forEach((it, i) => {
          const row = g.append('g').attr('transform', `translate(0, ${i * 14})`);
          row.append('line')
            .attr('x1', 0).attr('y1', 0).attr('x2', 20).attr('y2', 0)
            .attr('stroke', it.color).attr('stroke-width', 2);
          row.append('text')
            .attr('x', 26).attr('y', 0).attr('dy', '0.35em')
            .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
            .attr('font-size', 9)
            .attr('fill', 'rgba(0,0,0,0.55)')
            .text(it.label);
        });
      });
  }, [data]);

  return (
    <div style={{ width: '100%', maxWidth: '820px', margin: '0 auto' }}>
      <svg ref={svgRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
      <div style={{
        marginTop: '0.5rem',
        padding: '0.65rem 0.85rem',
        minHeight: '3.5rem',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        fontSize: '0.78rem',
        background: selected ? 'rgba(79,148,212,0.08)' : 'rgba(0,0,0,0.02)',
        border: '1px solid rgba(0,0,0,0.09)',
        borderRadius: '4px',
      }}>
        {selected ? (
          <>
            <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>
              {selected.label}
              {selected.kind === 'higher' && ' · higher-order latent'}
              {selected.kind === 'latent'  && ' · first-order latent'}
              {selected.kind === 'indicator' && ' · observed indicator'}
            </div>
            <div style={{ opacity: 0.72, fontSize: '0.72rem' }}>
              {selected.kind !== 'indicator' &&
                `score ${selected.value.toFixed(3)}`}
              {selected.kind === 'indicator' &&
                `current ${formatValue(selected.value)} · theoretical loading on ${selected.parent}: ${formatLoading(selected.loading)}`}
            </div>
          </>
        ) : (
          <div style={{ opacity: 0.5 }}>Hover a node to trace paths. Click for details.</div>
        )}
      </div>
    </div>
  );
}
