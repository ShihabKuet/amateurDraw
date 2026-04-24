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
  if (pts.length < 4) return null;

  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;

  if (w < 8 && h < 8) return null;

  const first = pts[0];
  const last = pts[pts.length - 1];
  const closedDist = distance(first, last);
  const span = Math.max(w, h);
  const isClosed = closedDist < span * 0.35;

  if (!isClosed) {
    return { type: 'line', x1: first.x, y1: first.y, x2: last.x, y2: last.y };
  }

  // Check if triangle-ish: find the point farthest from the midline
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  let apex: Point = pts[0];
  let maxDist = 0;
  pts.forEach((p) => {
    const d = distance(p, { x: cx, y: cy });
    if (d > maxDist) { maxDist = d; apex = p; }
  });

  // Heuristic: if aspect ratio allows and apex is near top or bottom
  const aspect = w / (h + 0.001);
  const apexNearTopOrBottom = apex.y < minY + h * 0.3 || apex.y > maxY - h * 0.3;

  if (apexNearTopOrBottom && aspect > 0.4 && aspect < 3.5) {
    // Triangle
    const bl: Point = { x: minX, y: maxY };
    const br: Point = { x: maxX, y: maxY };
    const top: Point = { x: (minX + maxX) / 2, y: minY };
    const apexPt = apex.y < cy ? top : { x: (minX + maxX) / 2, y: maxY };
    const base1 = apex.y < cy ? bl : { x: minX, y: minY };
    const base2 = apex.y < cy ? br : { x: maxX, y: minY };
    return { type: 'triangle', pts: [apexPt, base1, base2] };
  }

  // Ellipse vs Rect: if corners are present, rect wins
  const cornerTest = cornersPresent(pts, minX, minY, maxX, maxY);
  if (cornerTest) {
    return { type: 'rect', x: minX, y: minY, w, h };
  }

  return { type: 'ellipse', cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: w / 2, ry: h / 2 };
}

function cornersPresent(pts: Point[], minX: number, minY: number, maxX: number, maxY: number): boolean {
  const threshold = Math.max((maxX - minX), (maxY - minY)) * 0.25;
  const corners = [
    { x: minX, y: minY }, { x: maxX, y: minY },
    { x: minX, y: maxY }, { x: maxX, y: maxY },
  ];
  let found = 0;
  corners.forEach((c) => {
    if (pts.some((p) => distance(p, c) < threshold)) found++;
  });
  return found >= 3;
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

export function exportCanvasAsSVG(_canvas: HTMLCanvasElement): void {
  alert('SVG export coming soon! Use PNG for now.');
}
