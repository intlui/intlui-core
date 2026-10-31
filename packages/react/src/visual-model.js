// Pure, bounded geometry shared by the renderer and regression tests.
export function chartModel(data, series, xAxis = {}, yAxis = {}) {
  if (!xAxis || typeof xAxis !== 'object' || !yAxis || typeof yAxis !== 'object' || !Array.isArray(data) || !Array.isArray(series) || data.length > 1000 || series.length > 20 || data.some(r => !r || typeof r !== 'object' || Array.isArray(r)) || series.some(s => !s || !['bar', 'line', 'scatter'].includes(s.type) || typeof s.dataKey !== 'string' || (s.label != null && typeof s.label !== 'string'))) return null;
  const number = v => v === null || v === undefined || v === '' || typeof v === 'boolean' ? NaN : Number(v);
  const ys = data.flatMap(row => series.map(s => number(row[s.dataKey]))).filter(Number.isFinite);
  const xs = data.map(row => number(row[xAxis.dataKey])).filter(Number.isFinite);
  const numericX = xAxis.scale === 'linear' || series.some(s => s.type === 'scatter');
  function domain(values, axis, zero) {
    let min = Number.isFinite(axis.min) ? axis.min : Math.min(...values, ...(zero || !values.length ? [0] : []));
    let max = Number.isFinite(axis.max) ? axis.max : Math.max(...values, ...(!values.length ? [1] : []));
    if (max <= min) max = min + 1;
    return [min, max];
  }
  const [min, max] = domain(ys, yAxis, true), [xmin, xmax] = domain(xs, xAxis, false);
  const y = value => 18 + 210 * (1 - (value - min) / (max - min));
  const step = 582 / Math.max(1, data.length);
  return { min, max, xmin, xmax, numericX, step, y, series: series.map(s => ({ ...s, points: data.map((row, i) => {
    const value = number(row[s.dataKey]), xv = number(row[xAxis.dataKey]);
    return { row, value, x: numericX ? 42 + 582 * (xv - xmin) / (xmax - xmin) : 42 + step * (i + .5), y: y(value), valid: Number.isFinite(value) && (!numericX || Number.isFinite(xv)) };
  }) })) };
}

export function safeLink(value) {
  if (typeof value !== 'string') return undefined;
  if (/[\\\u0000-\u0020]/.test(value)) return undefined;
  if (/^#[\w-]+$/.test(value) || /^\/(?!\/)/.test(value)) return value;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}

const svgAttributes = new Set('viewBox width height x y x1 x2 y1 y2 cx cy r rx ry d points fill stroke strokeWidth strokeLinecap strokeLinejoin strokeDasharray opacity fillOpacity strokeOpacity transform fontSize fontWeight textAnchor dominantBaseline offset stopColor stopOpacity gradientUnits gradientTransform markerWidth markerHeight refX refY orient markerUnits preserveAspectRatio'.split(' '));
export const svgTags = new Set('svg g path rect circle ellipse line polyline polygon text defs linearGradient radialGradient stop marker title desc'.split(' '));
export function svgProps(props, prefix) {
  const out = {};
  for (const [name, value] of Object.entries(props)) {
    if (name === 'id' && typeof value === 'string') { out.id = `${prefix}-${value}`; continue; }
    if (!svgAttributes.has(name) && !['markerStart', 'markerMid', 'markerEnd'].includes(name)) continue;
    if (!['string', 'number'].includes(typeof value)) continue;
    if (typeof value === 'string' && /url\s*\(/i.test(value)) {
      const match = value.match(/^url\(#([\w-]+)\)$/);
      if (!match) continue;
      out[name] = `url(#${prefix}-${match[1]})`;
    } else out[name] = value;
  }
  return out;
}
