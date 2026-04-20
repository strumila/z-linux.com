import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export default function SubsystemGraph({ data }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 720;
    const height = 480;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const maxCommits = d3.max(data.subsystems, d => d.commits) ?? 1;
    const radius = d3.scaleSqrt().domain([0, maxCommits]).range([10, 80]);
    const color = d3.scaleSequential(d3.interpolateViridis).domain([maxCommits, 0]);

    const nodes = data.subsystems.map(s => ({ ...s, r: radius(s.commits) }));
    const links = (data.edges ?? []).map(e => ({ ...e }));

    const maxEdgeWeight = d3.max(links, l => l.weight) ?? 1;
    const edgeOpacity = d3.scaleLinear().domain([0, maxEdgeWeight]).range([0.08, 0.45]);
    const edgeWidth   = d3.scaleSqrt().domain([0, maxEdgeWeight]).range([0.4, 2.5]);

    const simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-60))
      .force('link', d3.forceLink(links)
        .id(d => d.name)
        .distance(l => 180 - Math.min(130, Math.sqrt(l.weight) * 5))
        .strength(l => Math.min(0.7, l.weight / maxEdgeWeight * 0.9)))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(d => d.r + 2).iterations(3));

    const linkSel = svg.append('g')
      .attr('class', 'links')
      .attr('stroke', '#1f3d55')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-opacity', d => edgeOpacity(d.weight))
      .attr('stroke-width', d => edgeWidth(d.weight));

    const node = svg.append('g')
      .selectAll('g.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .on('mouseenter', (_, d) => setHover(d))
      .on('mouseleave', () => setHover(null))
      .on('click', (_, d) => {
        setSelected(prev => (prev && prev.name === d.name) ? null : d);
      });

    node.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => color(d.commits))
      .attr('stroke', 'rgba(255,255,255,0.7)')
      .attr('stroke-width', 1);

    node.append('text')
      .text(d => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-family', 'ui-sans-serif, system-ui, sans-serif')
      .attr('font-size', d => Math.max(9, Math.min(d.r / 2.2, 16)))
      .attr('fill', d => d.commits > maxCommits * 0.5 ? '#fff' : '#111')
      .attr('pointer-events', 'none');

    simulation.on('tick', () => {
      linkSel
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [data]);

  const drill = selected
    ? {
        name: selected.name,
        commits: selected.commits,
        authors: selected.authors,
        churn: selected.churn,
        dailyHeat: (data.heatmap ?? [])
          .filter(h => h.subsystem === selected.name)
          .sort((a, b) => a.date.localeCompare(b.date)),
        edges: (data.edges ?? [])
          .filter(e => e.source === selected.name || e.target === selected.name)
          .map(e => ({
            peer: e.source === selected.name ? e.target : e.source,
            weight: e.weight,
          }))
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 6),
      }
    : null;

  return (
    <div style={{ width: '100%', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ position: 'relative' }}>
        <svg ref={svgRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
        <div
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            padding: '0.5rem 0.75rem',
            background: 'rgba(0,0,0,0.78)',
            color: '#fff',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: '0.78rem',
            borderRadius: '4px',
            pointerEvents: 'none',
            minWidth: '12rem',
            opacity: hover ? 1 : 0,
            transition: 'opacity 120ms',
          }}
        >
          {hover ? (
            <>
              <div style={{ fontWeight: 600 }}>{hover.name}</div>
              <div>{hover.commits.toLocaleString()} commits</div>
              <div>{hover.authors} authors</div>
              <div>{hover.churn.toLocaleString()} file touches</div>
              <div style={{ opacity: 0.6, marginTop: '0.3rem', fontSize: '0.72rem' }}>click to pin</div>
            </>
          ) : null}
        </div>
      </div>

      {drill && (
        <div
          style={{
            marginTop: '0.8rem',
            padding: '0.9rem 1rem',
            border: '1px solid rgba(0,0,0,0.1)',
            background: 'rgba(79,148,212,0.05)',
            borderRadius: '6px',
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: '0.78rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{drill.name}/</div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'rgba(0,0,0,0.5)',
                fontSize: '1.1rem',
                lineHeight: 1,
                padding: 0,
              }}
              aria-label="Close"
            >×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.8rem' }}>
            <div><span style={{ opacity: 0.55, fontSize: '0.7rem' }}>commits</span><div>{drill.commits.toLocaleString()}</div></div>
            <div><span style={{ opacity: 0.55, fontSize: '0.7rem' }}>authors</span><div>{drill.authors}</div></div>
            <div><span style={{ opacity: 0.55, fontSize: '0.7rem' }}>file touches</span><div>{drill.churn.toLocaleString()}</div></div>
          </div>

          {drill.dailyHeat.length > 0 && (
            <div style={{ marginBottom: '0.8rem' }}>
              <div style={{ opacity: 0.55, fontSize: '0.7rem', marginBottom: '0.3rem' }}>daily commits</div>
              <div style={{ display: 'flex', gap: '1px', height: '28px', alignItems: 'flex-end' }}>
                {(() => {
                  const max = Math.max(...drill.dailyHeat.map(d => d.count), 1);
                  return drill.dailyHeat.map(d => (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.count}`}
                      style={{
                        flex: 1,
                        height: `${(d.count / max) * 100}%`,
                        background: '#4f94d4',
                        opacity: 0.75,
                      }}
                    />
                  ));
                })()}
              </div>
            </div>
          )}

          {drill.edges.length > 0 && (
            <div>
              <div style={{ opacity: 0.55, fontSize: '0.7rem', marginBottom: '0.3rem' }}>top co-touched</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.6rem' }}>
                {drill.edges.map(e => (
                  <a
                    key={e.peer}
                    href={`/subsystem/${e.peer}/`}
                    style={{ opacity: 0.85, color: 'inherit', textDecoration: 'none', borderBottom: '1px dotted currentColor' }}
                  >
                    {e.peer} <span style={{ opacity: 0.5 }}>{e.weight}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: '0.8rem', paddingTop: '0.6rem', borderTop: '1px dashed rgba(0,0,0,0.08)', textAlign: 'right' }}>
            <a
              href={`/subsystem/${drill.name}/`}
              style={{ color: '#2b5c8a', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 500 }}
            >View full {drill.name}/ →</a>
          </div>
        </div>
      )}
    </div>
  );
}
