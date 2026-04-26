import type { Point, ToolType, DrawObject, StrokeObject, ShapeObject, TextObject, BBox } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

export function getEventPoint(e: MouseEvent | TouchEvent | PointerEvent, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  const src = 'touches' in e ? (e as TouchEvent).touches[0] : e as PointerEvent;
  return { x: src.clientX - rect.left, y: src.clientY - rect.top };
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── BBox ─────────────────────────────────────────────────────────────────────

export function bboxFromPoints(pts: Point[], pad = 0): BBox {
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) - x + pad * 2 - pad, h: Math.max(...ys) - y + pad * 2 - pad };
}

export function bboxFromShape(x1: number, y1: number, x2: number, y2: number): BBox {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  return { x, y, w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

export function bboxContains(bbox: BBox, pt: Point): boolean {
  return pt.x >= bbox.x && pt.x <= bbox.x + bbox.w &&
         pt.y >= bbox.y && pt.y <= bbox.y + bbox.h;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function applyBaseCtx(ctx: CanvasRenderingContext2D, obj: DrawObject) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'source-over';

  if (obj.kind === 'stroke') {
    if (obj.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = obj.size * 2.5;
      ctx.globalAlpha = 1;
    } else if (obj.tool === 'highlighter') {
      ctx.strokeStyle = hexToRgba(obj.color, 0.28);
      ctx.lineWidth = obj.size * 5;
      ctx.globalAlpha = obj.opacity;
    } else if (obj.tool === 'pencil') {
      ctx.strokeStyle = hexToRgba(obj.color, 0.65 * obj.opacity);
      ctx.lineWidth = Math.max(1, obj.size * 0.75);
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = hexToRgba(obj.color, obj.opacity);
      ctx.lineWidth = obj.size;
      ctx.globalAlpha = 1;
    }
  } else if (obj.kind === 'shape') {
    ctx.strokeStyle = hexToRgba(obj.color, obj.opacity);
    ctx.lineWidth = obj.size;
    ctx.globalAlpha = 1;
    if (obj.fill) ctx.fillStyle = hexToRgba(obj.color, obj.opacity * 0.2);
  } else if (obj.kind === 'text') {
    ctx.fillStyle = hexToRgba(obj.color, obj.opacity);
    ctx.globalAlpha = 1;
  }
}

export function renderObject(ctx: CanvasRenderingContext2D, obj: DrawObject) {
  applyBaseCtx(ctx, obj);

  if (obj.kind === 'stroke') {
    renderStroke(ctx, obj);
  } else if (obj.kind === 'shape') {
    renderShape(ctx, obj);
  } else if (obj.kind === 'text') {
    renderText(ctx, obj);
  }

  ctx.restore();
}

function renderStroke(ctx: CanvasRenderingContext2D, obj: StrokeObject) {
  const pts = obj.points;
  if (pts.length < 2) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
}

function renderShape(ctx: CanvasRenderingContext2D, obj: ShapeObject) {
  const { x1, y1, x2, y2 } = obj;
  const dx = x2 - x1, dy = y2 - y1;
  ctx.beginPath();
  switch (obj.shape) {
    case 'line':
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      break;
    case 'rect':
      ctx.rect(x1, y1, dx, dy);
      break;
    case 'ellipse':
      ctx.ellipse(x1 + dx / 2, y1 + dy / 2, Math.abs(dx / 2), Math.abs(dy / 2), 0, 0, Math.PI * 2);
      break;
    case 'triangle':
      ctx.moveTo(x1 + dx / 2, y1);
      ctx.lineTo(x1, y2);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      break;
    case 'arrow': {
      const angle = Math.atan2(dy, dx);
      const len = distance({ x: x1, y: y1 }, { x: x2, y: y2 });
      const hw = Math.min(len * 0.35, 22);
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.lineTo(x2 - hw * Math.cos(angle - 0.45), y2 - hw * Math.sin(angle - 0.45));
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - hw * Math.cos(angle + 0.45), y2 - hw * Math.sin(angle + 0.45));
      break;
    }
  }
  ctx.stroke();
  if (obj.fill && obj.shape !== 'line' && obj.shape !== 'arrow') ctx.fill();
}

function renderText(ctx: CanvasRenderingContext2D, obj: TextObject) {
  ctx.font = `${obj.fontSize}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  const lineHeight = obj.fontSize * 1.35;
  obj.text.split('\n').forEach((line, i) => {
    ctx.fillText(line, obj.x, obj.y + i * lineHeight);
  });
}

// Re-render everything from object list
export function renderAll(ctx: CanvasRenderingContext2D, objects: DrawObject[]) {
  const canvas = ctx.canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const obj of objects) {
    renderObject(ctx, obj);
  }
}

// ── Smooth / shape recognition ────────────────────────────────────────────────

export function drawSmoothPath(ctx: CanvasRenderingContext2D, pts: Point[]): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
}

export type RecognizedShape =
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'rect'; x: number; y: number; w: number; h: number }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'triangle'; pts: [Point, Point, Point] };

export function recognizeShape(pts: Point[]): RecognizedShape | null {
  if (pts.length < 6) return null;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  if (w < 12 && h < 12) return null;

  const first = pts[0], last = pts[pts.length - 1];
  const isClosed = distance(first, last) < Math.max(w, h) * 0.18;

  if (!isClosed) return { type: 'line', x1: first.x, y1: first.y, x2: last.x, y2: last.y };

  const cornerCount = countCorners(pts);
  if (cornerCount >= 2 && cornerCount <= 4) {
    const verts = findVertices(pts);
    if (verts) return { type: 'triangle', pts: verts };
  }
  if (cornersPresent(pts, minX, minY, maxX, maxY) || cornerCount >= 3) {
    return { type: 'rect', x: minX, y: minY, w, h };
  }
  return { type: 'ellipse', cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: w / 2, ry: h / 2 };
}

function countCorners(pts: Point[]): number {
  const step = Math.max(1, Math.floor(pts.length / 40));
  let corners = 0;
  for (let i = step; i < pts.length - step; i += step) {
    const a1 = Math.atan2(pts[i].y - pts[i - step].y, pts[i].x - pts[i - step].x);
    const a2 = Math.atan2(pts[i + step].y - pts[i].y, pts[i + step].x - pts[i].x);
    let diff = Math.abs(a2 - a1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > 0.55) corners++;
  }
  return corners;
}

function findVertices(pts: Point[]): [Point, Point, Point] | null {
  const step = Math.max(1, Math.floor(pts.length / 60));
  const scored: { idx: number; score: number }[] = [];
  for (let i = step * 2; i < pts.length - step * 2; i += step) {
    const a1 = Math.atan2(pts[i].y - pts[i - step * 2].y, pts[i].x - pts[i - step * 2].x);
    const a2 = Math.atan2(pts[i + step * 2].y - pts[i].y, pts[i + step * 2].x - pts[i].x);
    let diff = Math.abs(a2 - a1);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff > 0.5) scored.push({ idx: i, score: diff });
  }
  if (scored.length < 2) return null;
  scored.sort((a, b) => b.score - a.score);
  const minGap = Math.floor(pts.length / 4);
  const picked: number[] = [];
  for (const s of scored) {
    if (picked.every(p => Math.abs(p - s.idx) > minGap)) {
      picked.push(s.idx);
      if (picked.length === 2) break;
    }
  }
  if (picked.length < 2) return null;
  return [pts[0], pts[picked[0]], pts[picked[1]]];
}

function cornersPresent(pts: Point[], minX: number, minY: number, maxX: number, maxY: number): boolean {
  const threshold = Math.max(maxX - minX, maxY - minY) * 0.22;
  const corners = [{ x: minX, y: minY }, { x: maxX, y: minY }, { x: minX, y: maxY }, { x: maxX, y: maxY }];
  return corners.filter(c => pts.some(p => distance(p, c) < threshold)).length >= 4;
}

export function drawRecognizedShape(ctx: CanvasRenderingContext2D, shape: RecognizedShape): void {
  ctx.beginPath();
  switch (shape.type) {
    case 'line': ctx.moveTo(shape.x1, shape.y1); ctx.lineTo(shape.x2, shape.y2); break;
    case 'rect': ctx.rect(shape.x, shape.y, shape.w, shape.h); break;
    case 'ellipse': ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2); break;
    case 'triangle':
      ctx.moveTo(shape.pts[0].x, shape.pts[0].y);
      ctx.lineTo(shape.pts[1].x, shape.pts[1].y);
      ctx.lineTo(shape.pts[2].x, shape.pts[2].y);
      ctx.closePath();
      break;
  }
  ctx.stroke();
}

// ── Export ────────────────────────────────────────────────────────────────────

export function exportCanvasAsPNG(canvas: HTMLCanvasElement, filename = 'amateurDraw.png'): void {
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  const tc = tmp.getContext('2d')!;
  tc.fillStyle = '#ffffff';
  tc.fillRect(0, 0, tmp.width, tmp.height);
  tc.drawImage(canvas, 0, 0);
  const a = document.createElement('a');
  a.download = filename; a.href = tmp.toDataURL('image/png'); a.click();
}

export function exportSelectionAsPNG(canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number, filename = 'amateurDraw-selection.png'): void {
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tc = tmp.getContext('2d')!;
  tc.fillStyle = '#ffffff';
  tc.fillRect(0, 0, w, h);
  tc.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  const a = document.createElement('a');
  a.download = filename; a.href = tmp.toDataURL('image/png'); a.click();
}

// ── applyCtxSettings (used for live preview drawing) ─────────────────────────

export function applyCtxSettings(ctx: CanvasRenderingContext2D, tool: ToolType, color: string, size: number, opacity: number): void {
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

export function drawShapeOnCanvas(ctx: CanvasRenderingContext2D, tool: ToolType, start: Point, end: Point, fill: boolean): void {
  const dx = end.x - start.x, dy = end.y - start.y;
  ctx.beginPath();
  switch (tool) {
    case 'line': ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); break;
    case 'rect': ctx.rect(start.x, start.y, dx, dy); break;
    case 'ellipse': ctx.ellipse(start.x + dx / 2, start.y + dy / 2, Math.abs(dx / 2), Math.abs(dy / 2), 0, 0, Math.PI * 2); break;
    case 'triangle': ctx.moveTo(start.x + dx / 2, start.y); ctx.lineTo(start.x, end.y); ctx.lineTo(end.x, end.y); ctx.closePath(); break;
    case 'arrow': {
      const angle = Math.atan2(dy, dx);
      const len = distance(start, end);
      const hw = Math.min(len * 0.35, 22);
      ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y);
      ctx.lineTo(end.x - hw * Math.cos(angle - 0.45), end.y - hw * Math.sin(angle - 0.45));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - hw * Math.cos(angle + 0.45), end.y - hw * Math.sin(angle + 0.45));
      break;
    }
  }
  ctx.stroke();
  if (fill && tool !== 'line' && tool !== 'arrow') ctx.fill();
}