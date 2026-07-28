type Point = { x: number; y: number };

function transformPoint(point: Point, transform = ''): Point {
  let output = { ...point };
  for (const match of transform.matchAll(/(translate|scale|rotate)\s*\(([^)]+)\)/g)) {
    const values = match[2].split(/[ ,]+/).filter(Boolean).map(Number);
    if (match[1] === 'translate') output = { x: output.x + (values[0] || 0), y: output.y + (values[1] || 0) };
    if (match[1] === 'scale') output = { x: output.x * (values[0] || 1), y: output.y * (values[1] ?? values[0] ?? 1) };
    if (match[1] === 'rotate') { const angle = (values[0] || 0) * Math.PI / 180; const cx = values[1] || 0; const cy = values[2] || 0; const x = output.x - cx; const y = output.y - cy; output = { x: cx + x * Math.cos(angle) - y * Math.sin(angle), y: cy + x * Math.sin(angle) + y * Math.cos(angle) }; }
  }
  return output;
}

/** Supports architectural SVG straight path commands; curves remain a future conversion task. */
export function importSvgPaths(source: string, idPrefix = `svg-${Date.now()}`): Array<{ id: string; points: number[]; source: 'svg' }> {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml'); const paths: Array<{ id: string; points: number[]; source: 'svg' }> = [];
  doc.querySelectorAll('path').forEach((element, index) => {
    const tokens = (element.getAttribute('d') || '').match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || []; const points: Point[] = []; let cursor = { x: 0, y: 0 }; let command = '';
    for (let i = 0; i < tokens.length;) { if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++]; const relative = command === command.toLowerCase(); const read = () => Number(tokens[i++]);
      if (command.toUpperCase() === 'M' || command.toUpperCase() === 'L') { const x = read(); const y = read(); cursor = { x: relative ? cursor.x + x : x, y: relative ? cursor.y + y : y }; points.push(cursor); if (command.toUpperCase() === 'M') command = relative ? 'l' : 'L'; }
      else if (command.toUpperCase() === 'H') { const x = read(); cursor = { ...cursor, x: relative ? cursor.x + x : x }; points.push(cursor); }
      else if (command.toUpperCase() === 'V') { const y = read(); cursor = { ...cursor, y: relative ? cursor.y + y : y }; points.push(cursor); }
      else if (command.toUpperCase() === 'Z') { if (points.length) points.push(points[0]); command = ''; }
      else { break; }
    }
    if (points.length > 1) { const transform = [element.getAttribute('transform') || '', element.parentElement?.getAttribute('transform') || ''].join(' '); paths.push({ id: `${idPrefix}-${index}`, source: 'svg', points: points.map((point) => transformPoint(point, transform)).flatMap((point) => [point.x, point.y]) }); }
  });
  return paths;
}
