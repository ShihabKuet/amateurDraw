import type { Point, ToolType } from '../types';

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getEventPoint(e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  const src = 'touches' in e ? e.touches[0] : e;
  return {
    x: src.clientX - rect.left,
    y: src.clientY - rect.top,
  };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Catmull-Rom smoothing
export function drawSmoothPath(ctx: CanvasRenderingContext2D, pts: Point[]): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
  } else {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }
  ctx.stroke();
}

export function drawRawPath(ctx: CanvasRenderingContext2D, pts: Point[]): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();
}

export type RecognizedShape =
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'rect'; x: number; y: number; w: number; h: number }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'triangle'; pts: [Point, Point, Point] };

export function recognizeShape(pts: Point[]): RecognizedShape | null {
  if (pts.length < 6) return null;

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;

  if (w < 12 && h < 12) return null;

  const first = pts[0];
  const last = pts[pts.length - 1];
  const closedDist = distance(first, last);
  const span = Math.max(w, h);

  // Stricter closure test: end point must be within 18% of the bounding span
  const isClosed = closedDist < span * 0.18;

  if (!isClosed) {
    // Open stroke → straight line (connect first to last)
    return { type: 'line', x1: first.x, y1: first.y, x2: last.x, y2: last.y };
  }

  // ── Closed shape: determine rect vs ellipse vs triangle ──────────────────

  // Count corners (sharp turns) in the stroke
  const cornerCount = countCorners(pts);

  // Triangle: exactly ~3 corners, and the stroke has 3 clear vertices
  if (cornerCount >= 2 && cornerCount <= 4) {
    const verts = findVertices(pts, 3);
    if (verts) {
      return { type: 'triangle', pts: verts };
    }
  }

  // Rect: 4 corners present near bounding-box corners
  const hasBoxCorners = cornersPresent(pts, minX, minY, maxX, maxY);
  if (hasBoxCorners || cornerCount >= 3) {
    return { type: 'rect', x: minX, y: minY, w, h };
  }

  // Default: ellipse
  return { type: 'ellipse', cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: w / 2, ry: h / 2 };
}

/** Count direction-change corners in a stroke (sharp angular changes). */
function countCorners(pts: Point[]): number {
  if (pts.length < 5) return 0;
  const step = Math.max(1, Math.floor(pts.length / 40));
  let corners = 0;
  for (let i = step; i < pts.length - step; i += step) {
    const prev = pts[i - step];
    const curr = pts[i];
    const next = pts[i + step];
    const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    let diff = Math.abs(a2 - a1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > 0.55) corners++; // ~31° threshold
  }
  return corners;
}

/** Find the N most extreme vertices of a stroke by curvature / direction change. */
function findVertices(pts: Point[], n: number): [Point, Point, Point] | null {
  if (pts.length < 10) return null;
  const step = Math.max(1, Math.floor(pts.length / 60));
  const scored: Array<{ idx: number; score: number }> = [];

  for (let i = step * 2; i < pts.length - step * 2; i += step) {
    const prev = pts[i - step * 2];
    const curr = pts[i];
    const next = pts[i + step * 2];
    const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    let diff = Math.abs(a2 - a1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > 0.5) scored.push({ idx: i, score: diff });
  }

  if (scored.length < n - 1) return null;

  // Deduplicate: keep highest score per cluster
  scored.sort((a, b) => b.score - a.score);
  const minGap = Math.floor(pts.length / (n * 1.5));
  const picked: number[] = [];
  for (const s of scored) {
    if (picked.every((p) => Math.abs(p - s.idx) > minGap)) {
      picked.push(s.idx);
      if (picked.length === n - 1) break; // we also include first point
    }
  }
  if (picked.length < n - 1) return null;

  const allVerts = [0, ...picked].map((i) => pts[i]);
  if (allVerts.length < 3) return null;
  return [allVerts[0], allVerts[1], allVerts[2]];
}

function cornersPresent(pts: Point[], minX: number, minY: number, maxX: number, maxY: number): boolean {
  // Threshold: a point is "at a corner" if within 22% of bounding box size
  const threshold = Math.max((maxX - minX), (maxY - minY)) * 0.22;
  const corners = [
    { x: minX, y: minY }, { x: maxX, y: minY },
    { x: minX, y: maxY }, { x: maxX, y: maxY },
  ];
  let found = 0;
  corners.forEach((c) => {
    if (pts.some((p) => distance(p, c) < threshold)) found++;
  });
  // Need all 4 corners for rect confidence
  return found >= 4;
}

export function drawRecognizedShape(ctx: CanvasRenderingContext2D, shape: RecognizedShape): void {
  ctx.beginPath();
  switch (shape.type) {
    case 'line':
      ctx.moveTo(shape.x1, shape.y1);
      ctx.lineTo(shape.x2, shape.y2);
      break;
    case 'rect':
      ctx.rect(shape.x, shape.y, shape.w, shape.h);
      break;
    case 'ellipse':
      ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(shape.pts[0].x, shape.pts[0].y);
      ctx.lineTo(shape.pts[1].x, shape.pts[1].y);
      ctx.lineTo(shape.pts[2].x, shape.pts[2].y);
      ctx.closePath();
      break;
  }
  ctx.stroke();
}

export function drawShapeOnCanvas(
  ctx: CanvasRenderingContext2D,
  tool: ToolType,
  start: Point,
  end: Point,
  fill: boolean
): void {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  ctx.beginPath();
  switch (tool) {
    case 'line':
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      break;
    case 'rect':
      ctx.rect(start.x, start.y, dx, dy);
      break;
    case 'ellipse': {
      ctx.ellipse(
        start.x + dx / 2,
        start.y + dy / 2,
        Math.abs(dx / 2),
        Math.abs(dy / 2),
        0, 0, Math.PI * 2
      );
      break;
    }
    case 'triangle':
      ctx.moveTo(start.x + dx / 2, start.y);
      ctx.lineTo(start.x, end.y);
      ctx.lineTo(end.x, end.y);
      ctx.closePath();
      break;
    case 'arrow': {
      const angle = Math.atan2(dy, dx);
      const len = distance(start, end);
      const headLen = Math.min(len * 0.35, 22);
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle - 0.45), end.y - headLen * Math.sin(angle - 0.45));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle + 0.45), end.y - headLen * Math.sin(angle + 0.45));
      break;
    }
  }
  ctx.stroke();
  if (fill && tool !== 'line' && tool !== 'arrow') ctx.fill();
}

export function applyCtxSettings(
  ctx: CanvasRenderingContext2D,
  tool: ToolType,
  color: string,
  size: number,
  opacity: number
): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = size * 2.5;
    ctx.globalAlpha = 1;
  } else if (tool === 'highlighter') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = hexToRgba(color, 0.28);
    ctx.lineWidth = size * 5;
    ctx.globalAlpha = opacity;
  } else if (tool === 'pencil') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = hexToRgba(color, 0.65 * opacity);
    ctx.lineWidth = Math.max(1, size * 0.75);
    ctx.globalAlpha = 1;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = hexToRgba(color, opacity);
    ctx.lineWidth = size;
    ctx.globalAlpha = 1;
  }
}

export function exportCanvasAsPNG(canvas: HTMLCanvasElement, filename = 'amateurDraw.png'): void {
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  const tc = tmp.getContext('2d')!;
  tc.fillStyle = '#ffffff';
  tc.fillRect(0, 0, tmp.width, tmp.height);
  tc.drawImage(canvas, 0, 0);
  const a = document.createElement('a');
  a.download = filename;
  a.href = tmp.toDataURL('image/png');
  a.click();
}

export function exportSelectionAsPNG(
  canvas: HTMLCanvasElement,
  x: number, y: number, w: number, h: number,
  filename = 'amateurDraw-selection.png'
): void {
  const tmp = document.createElement('canvas');
  tmp.width = Math.abs(w);
  tmp.height = Math.abs(h);
  const tc = tmp.getContext('2d')!;
  tc.fillStyle = '#ffffff';
  tc.fillRect(0, 0, tmp.width, tmp.height);
  const sx = w < 0 ? x + w : x;
  const sy = h < 0 ? y + h : y;
  tc.drawImage(canvas, sx, sy, Math.abs(w), Math.abs(h), 0, 0, Math.abs(w), Math.abs(h));
  const a = document.createElement('a');
  a.download = filename;
  a.href = tmp.toDataURL('image/png');
  a.click();
}

export function clearSelectionOnCanvas(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number
): void {
  const sx = w < 0 ? x + w : x;
  const sy = h < 0 ? y + h : y;
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(sx, sy, Math.abs(w), Math.abs(h));
  ctx.globalCompositeOperation = prevOp;
}
