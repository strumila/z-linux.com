import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const TOP_N = 12;

export default function CommitFlame({ data }) {
  const svgRef = useRef(null);
  const [scrub, setScrub] = useState(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 720;
    const height = 320;
    const margin = { top: 12, right: 8, bottom: 24, left: 8 };
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const dates = [...new Set(data.heatmap.map(h => h.date))].sort();

    const totals = new Map();
    for (const h of data.heatmap) {
      totals.set(h.subsystem, (totals.get(h.subsystem) ?? 0) + h.count);
    }
    const topSubs = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([s]) => s);

    const grid = new Map();
    for (const d of dates) {
      const row = { date: d };
      for (const s of topSubs) row[s] = 0;
      grid.set(d, row);
    }
    for (const h of data.heatmap) {
      if (!topSubs.includes(h.subsystem)) continue;
      grid.get(h.date)[h.subsystem] = h.count;
    }
    const rows = dates.map(d => grid.get(d));

    const x = d3.scalePoint().domain(dates).range([margin.left, width - margin.right]);

    const series = d3.stack()
      .keys(topSubs)
      .offset(d3.stackOffsetWiggle)
      .order(d3.stackOrderInsideOut)(rows);

    const yMin = d3.min(series, s => d3.min(s, d => d[0]));
    const yMax = d3.max(series, s => d3.max(s, d => d[1]));
    const y = d3.scaleLinear().domain([yMin, yMax]).range([height - margin.bottom, margin.top]);

    const palette = [...d3.schemeTableau10, ...d3.schemeSet3];
    const color = d3.scaleOrdinal().domain(topSubs).range(palette);

    const area = d3.area()
      .x((_, i) => x(dates[i]))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveBasis);

    svg.append('g')
      .selectAll('path')
      .data(series)
      .join('path')
      .attr('d', area)
      .attr('fill', d => color(d.key))
      .attr('opacity', 0.88);

    svg.append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickFormat(d => d.slice(5)).tickSize(0))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('text').attr('font-size', 10).attr('opacity', 0.55));

    const scrubLine = svg.append('line')
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom)
      .attr('stroke', 'rgba(0,0,0,0.35)')
      .attr('stroke-width', 1)
      .style('pointer-events', 'none')
      .style('opacity', 0);

    svg.append('rect')
      .attr('x', 0).attr('y', 0)
      .attr('width', width).attr('height', height)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (evt) => {
        const [mx] = d3.pointer(evt);
        let nearest = dates[0];
        let minDist = Infinity;
        for (const d of dates) {
          const dist = Math.abs(x(d) - mx);
          if (dist < minDist) { minDist = dist; nearest = d; }
        }
        scrubLine.attr('x1', x(nearest)).attr('x2', x(nearest)).style('opacity', 1);
        const row = grid.get(nearest);
        const breakdown = topSubs
          .map(s => ({ subsystem: s, count: row[s], color: color(s) }))
          .filter(b => b.count > 0)
          .sort((a, b) => b.count - a.count);
        setScrub({ date: nearest, breakdown });
      })
      .on('mouseleave', () => {
        scrubLine.style('opacity', 0);
        setScrub(null);
      });
  }, [data]);

  return (
    <div style={{ width: '100%', maxWidth: '720px', margin: '0 auto' }}>
      <svg ref={svgRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
      <div style={{
        minHeight: '7rem',
        marginTop: '0.5rem',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        fontSize: '0.8rem',
      }}>
        {scrub ? (
          <>
            <div style={{ opacity: 0.7, marginBottom: '0.4rem' }}>{scrub.date}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.9rem' }}>
              {scrub.breakdown.map(b => (
                <span key={b.subsystem} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: '0.6rem', height: '0.6rem', background: b.color, display: 'inline-block', borderRadius: '1px' }} />
                  <span style={{ opacity: 0.75 }}>{b.subsystem}</span>
                  <span>{b.count}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <div style={{ opacity: 0.45 }}>Hover to scrub through dates.</div>
        )}
      </div>
    </div>
  );
}
