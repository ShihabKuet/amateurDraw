import { useRef, useEffect, useCallback, useState } from 'react';
import type { DrawSettings, Point, DrawObject, StrokeObject, ShapeObject, TextObject } from '../types';
import {
  applyCtxSettings,
  drawSmoothPath,
  drawShapeOnCanvas,
  recognizeShape,
  drawRecognizedShape,
  getEventPoint,
  exportCanvasAsPNG,
  exportSelectionAsPNG,
  renderAll,
  renderObject,
  bboxFromPoints,
  bboxFromShape,
  bboxContains,
  uid,
  hexToRgba,
} from '../utils/canvas';

const SHAPE_TOOLS = new Set(['line', 'rect', 'ellipse', 'triangle', 'arrow']);
const MAX_UNDO = 50;

export interface SelectionRect { x: number; y: number; w: number; h: number; }

interface SelectState {
  id: string;
  dragOffsetX: number;
  dragOffsetY: number;
}

interface MarqueeMoveState {
  ids: string[];             // objects captured inside marquee
  startPos: Point;           // pointer position when drag started
  startMarquee: SelectionRect;
}

export function useDrawingCanvas(settings: DrawSettings) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const objects = useRef<DrawObject[]>([]);
  const undoStack = useRef<DrawObject[][]>([]);
  const redoStack = useRef<DrawObject[][]>([]);

  const isDrawing = useRef(false);
  const points = useRef<Point[]>([]);
  const shapeStart = useRef<Point | null>(null);
  const snapshotBeforeStroke = useRef<ImageData | null>(null);

  // Single-object select + drag
  const selectState = useRef<SelectState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  // Marquee
  const [marquee, setMarquee] = useState<SelectionRect | null>(null);
  const marqueeRef = useRef<SelectionRect | null>(null);
  const marqueeStart = useRef<Point | null>(null);
  const isMarquee = useRef(false);

  // Marquee group move
  const marqueeMoveState = useRef<MarqueeMoveState | null>(null);
  const isMarqueeMove = useRef(false);

  const settingsRef = useRef(settings);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isPlacingText, setIsPlacingText] = useState(false);
  const [textPos, setTextPos] = useState<Point | null>(null);

  // Text editing state — selected text object for the properties panel
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const editingTextIdRef = useRef<string | null>(null);

  const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

  // ── Render ─────────────────────────────────────────────────────────────────
  const repaint = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    renderAll(ctx, objects.current);
  }, []);

  const clearOverlay = useCallback(() => {
    const oc = overlayRef.current;
    if (!oc) return;
    oc.getContext('2d')!.clearRect(0, 0, oc.width, oc.height);
  }, []);

  const drawObjectHighlight = useCallback((id: string) => {
    const obj = objects.current.find(o => o.id === id);
    if (!obj) return;
    const oc = overlayRef.current;
    if (!oc) return;
    const ctx = oc.getContext('2d')!;
    ctx.clearRect(0, 0, oc.width, oc.height);
    const bb = obj.bbox;
    const pad = 6;
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(bb.x - pad, bb.y - pad, bb.w + pad * 2, bb.h + pad * 2);
    ctx.restore();
    const hx = bb.x - pad, hy = bb.y - pad, hw = bb.w + pad * 2, hh = bb.h + pad * 2;
    [[hx, hy], [hx + hw, hy], [hx, hy + hh], [hx + hw, hy + hh]].forEach(([cx, cy]) => {
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.stroke();
    });
  }, []);

  const drawMarqueeOverlay = useCallback((rect: SelectionRect, capturedIds?: string[]) => {
    const oc = overlayRef.current;
    if (!oc) return;
    const ctx = oc.getContext('2d')!;
    ctx.clearRect(0, 0, oc.width, oc.height);
    ctx.fillStyle = 'rgba(59,130,246,0.08)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(rect.x + 0.75, rect.y + 0.75, rect.w - 1.5, rect.h - 1.5);
    ctx.restore();
    // Highlight captured objects inside marquee
    if (capturedIds && capturedIds.length) {
      ctx.save();
      ctx.strokeStyle = 'rgba(59,130,246,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      capturedIds.forEach(id => {
        const obj = objects.current.find(o => o.id === id);
        if (!obj) return;
        const bb = obj.bbox;
        ctx.strokeRect(bb.x - 3, bb.y - 3, bb.w + 6, bb.h + 6);
      });
      ctx.restore();
    }
  }, []);

  // ── Undo/Redo ──────────────────────────────────────────────────────────────
  const pushUndo = useCallback(() => {
    undoStack.current.push(objects.current.map(o => ({ ...o })));
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const deselect = useCallback(() => {
    setSelectedId(null); selectedIdRef.current = null;
    setEditingTextId(null); editingTextIdRef.current = null;
    clearOverlay();
  }, [clearOverlay]);

  const undo = useCallback(() => {
    if (!undoStack.current.length) return;
    redoStack.current.push(objects.current.map(o => ({ ...o })));
    objects.current = undoStack.current.pop()!;
    repaint(); deselect();
    setMarquee(null); marqueeRef.current = null;
    setCanUndo(undoStack.current.length > 0); setCanRedo(true);
  }, [repaint, deselect]);

  const redo = useCallback(() => {
    if (!redoStack.current.length) return;
    undoStack.current.push(objects.current.map(o => ({ ...o })));
    objects.current = redoStack.current.pop()!;
    repaint(); deselect();
    setMarquee(null); marqueeRef.current = null;
    setCanUndo(true); setCanRedo(redoStack.current.length > 0);
  }, [repaint, deselect]);

  const clear = useCallback(() => {
    pushUndo();
    objects.current = [];
    repaint(); deselect();
    setMarquee(null); marqueeRef.current = null;
  }, [pushUndo, repaint, deselect]);

  const exportPNG = useCallback(() => {
    if (canvasRef.current) exportCanvasAsPNG(canvasRef.current);
  }, []);

  // ── Marquee actions ────────────────────────────────────────────────────────
  const getMarqueeObjects = useCallback((rect: SelectionRect): string[] => {
    return objects.current
      .filter(obj => {
        const cx = obj.bbox.x + obj.bbox.w / 2;
        const cy = obj.bbox.y + obj.bbox.h / 2;
        return cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h;
      })
      .map(o => o.id);
  }, []);

  const exportSelection = useCallback(() => {
    const sel = marqueeRef.current;
    if (!sel || !canvasRef.current) return;
    exportSelectionAsPNG(canvasRef.current, sel.x, sel.y, sel.w, sel.h);
  }, []);

  const deleteSelection = useCallback(() => {
    const sel = marqueeRef.current;
    if (!sel) return;
    const ids = new Set(getMarqueeObjects(sel));
    pushUndo();
    objects.current = objects.current.filter(o => !ids.has(o.id));
    repaint(); clearOverlay();
    setMarquee(null); marqueeRef.current = null;
  }, [pushUndo, repaint, clearOverlay, getMarqueeObjects]);

  const clearMarquee = useCallback(() => {
    clearOverlay();
    setMarquee(null); marqueeRef.current = null;
  }, [clearOverlay]);

  // ── Hit test ───────────────────────────────────────────────────────────────
  const hitTest = useCallback((pt: Point): string | null => {
    for (let i = objects.current.length - 1; i >= 0; i--) {
      const obj = objects.current[i];
      const pad = 8;
      const bb = { x: obj.bbox.x - pad, y: obj.bbox.y - pad, w: obj.bbox.w + pad * 2, h: obj.bbox.h + pad * 2 };
      if (bboxContains(bb, pt)) return obj.id;
    }
    return null;
  }, []);

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      canvas.width = parent.clientWidth; canvas.height = parent.clientHeight;
      overlay.width = parent.clientWidth; overlay.height = parent.clientHeight;
      repaint();
    });
    ro.observe(parent);
    canvas.width = parent.clientWidth; canvas.height = parent.clientHeight;
    overlay.width = parent.clientWidth; overlay.height = parent.clientHeight;
    repaint();
    return () => ro.disconnect();
  }, [repaint]);

  // ── Settings sync ──────────────────────────────────────────────────────────
  useEffect(() => {
    settingsRef.current = settings;
    if (settings.tool !== 'select') {
      deselect();
      setMarquee(null); marqueeRef.current = null;
    }
  }, [settings, deselect]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isPlacingText) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === 'Escape') {
        deselect();
        setMarquee(null); marqueeRef.current = null;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIdRef.current) {
          e.preventDefault();
          pushUndo();
          objects.current = objects.current.filter(o => o.id !== selectedIdRef.current);
          repaint(); deselect();
        } else if (marqueeRef.current) {
          e.preventDefault();
          deleteSelection();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, pushUndo, repaint, deselect, deleteSelection, isPlacingText]);

  // ── Pointer events ─────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const s = settingsRef.current;
    const pos = getEventPoint(e.nativeEvent, canvas);

    if (s.tool === 'text') {
      setTextPos({ ...pos });
      setIsPlacingText(true);
      return;
    }

    canvas.setPointerCapture(e.pointerId);

    if (s.tool === 'select') {
      // 1. If marquee is active and click is inside it → start group move
      const m = marqueeRef.current;
      if (m && pos.x >= m.x && pos.x <= m.x + m.w && pos.y >= m.y && pos.y <= m.y + m.h) {
        const ids = getMarqueeObjects(m);
        if (ids.length > 0) {
          pushUndo();
          isMarqueeMove.current = true;
          isDrawing.current = true;
          marqueeMoveState.current = { ids, startPos: { ...pos }, startMarquee: { ...m } };
          return;
        }
      }

      // 2. Click on already-selected single object → start move
      if (selectedIdRef.current) {
        const obj = objects.current.find(o => o.id === selectedIdRef.current);
        if (obj && bboxContains({ x: obj.bbox.x - 8, y: obj.bbox.y - 8, w: obj.bbox.w + 16, h: obj.bbox.h + 16 }, pos)) {
          pushUndo();
          selectState.current = { id: obj.id, dragOffsetX: pos.x - obj.bbox.x, dragOffsetY: pos.y - obj.bbox.y };
          isDrawing.current = true;
          return;
        }
      }

      // 3. Hit test for single object
      const hitId = hitTest(pos);
      if (hitId) {
        const obj = objects.current.find(o => o.id === hitId)!;
        setSelectedId(hitId); selectedIdRef.current = hitId;
        // If it's a text object, enter text edit mode
        if (obj.kind === 'text') {
          setEditingTextId(hitId); editingTextIdRef.current = hitId;
        } else {
          setEditingTextId(null); editingTextIdRef.current = null;
        }
        drawObjectHighlight(hitId);
        setMarquee(null); marqueeRef.current = null;
        pushUndo();
        selectState.current = { id: hitId, dragOffsetX: pos.x - obj.bbox.x, dragOffsetY: pos.y - obj.bbox.y };
        isDrawing.current = true;
        return;
      }

      // 4. Empty space → start marquee
      deselect();
      setMarquee(null); marqueeRef.current = null;
      selectState.current = null;
      isMarquee.current = true;
      isDrawing.current = true;
      marqueeStart.current = { ...pos };
      return;
    }

    // ── Drawing tools ────────────────────────────────────────────────────────
    isDrawing.current = true;
    points.current = [pos];

    if (SHAPE_TOOLS.has(s.tool)) {
      shapeStart.current = { ...pos };
      snapshotBeforeStroke.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return;
    }

    pushUndo();
    applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y); ctx.lineTo(pos.x + 0.1, pos.y); ctx.stroke();
  }, [hitTest, drawObjectHighlight, deselect, pushUndo, getMarqueeObjects]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const s = settingsRef.current;
    const pos = getEventPoint(e.nativeEvent, canvas);

    // ── Marquee group move ───────────────────────────────────────────────────
    if (s.tool === 'select' && isMarqueeMove.current && marqueeMoveState.current) {
      const { ids, startPos, startMarquee } = marqueeMoveState.current;
      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;
      // Reset objects to their pre-drag positions (from undo stack top)
      const preMove = undoStack.current[undoStack.current.length - 1];
      if (preMove) {
        // Apply delta to the captured ids only
        objects.current = objects.current.map(obj => {
          if (!ids.includes(obj.id)) return obj;
          const orig = preMove.find(o => o.id === obj.id);
          if (!orig) return obj;
          return moveObject(orig, dx, dy);
        });
      }
      repaint();
      // Move marquee rect too
      const newMarquee = { x: startMarquee.x + dx, y: startMarquee.y + dy, w: startMarquee.w, h: startMarquee.h };
      drawMarqueeOverlay(newMarquee, ids);
      return;
    }

    // ── Single object move ───────────────────────────────────────────────────
    if (s.tool === 'select' && selectState.current) {
      const { id, dragOffsetX, dragOffsetY } = selectState.current;
      const objIdx = objects.current.findIndex(o => o.id === id);
      if (objIdx === -1) return;
      const obj = objects.current[objIdx];
      const odx = (pos.x - dragOffsetX) - obj.bbox.x;
      const ody = (pos.y - dragOffsetY) - obj.bbox.y;
      // Reset to pre-drag, apply fresh delta each frame
      const preMove = undoStack.current[undoStack.current.length - 1];
      if (preMove) {
        const orig = preMove.find(o => o.id === id);
        if (orig) objects.current[objIdx] = moveObject(orig, (pos.x - dragOffsetX) - orig.bbox.x, (pos.y - dragOffsetY) - orig.bbox.y);
      } else {
        objects.current[objIdx] = moveObject(obj, odx, ody);
      }
      repaint();
      drawObjectHighlight(id);
      return;
    }

    // ── Marquee draw ─────────────────────────────────────────────────────────
    if (s.tool === 'select' && isMarquee.current && marqueeStart.current) {
      const rect: SelectionRect = {
        x: Math.min(marqueeStart.current.x, pos.x), y: Math.min(marqueeStart.current.y, pos.y),
        w: Math.abs(pos.x - marqueeStart.current.x), h: Math.abs(pos.y - marqueeStart.current.y),
      };
      const captured = getMarqueeObjects(rect);
      drawMarqueeOverlay(rect, captured);
      return;
    }

    points.current.push(pos);

    // ── Shape preview ────────────────────────────────────────────────────────
    if (SHAPE_TOOLS.has(s.tool) && shapeStart.current) {
      if (snapshotBeforeStroke.current) ctx.putImageData(snapshotBeforeStroke.current, 0, 0);
      applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);
      ctx.fillStyle = s.fillShape ? hexToRgba(s.color, 0.2) : 'transparent';
      drawShapeOnCanvas(ctx, s.tool, shapeStart.current, pos, s.fillShape);
      return;
    }

    // ── Freehand ─────────────────────────────────────────────────────────────
    applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);
    if (s.mode === 'smooth') {
      const recent = points.current.slice(-4);
      if (recent.length >= 2) {
        ctx.beginPath(); ctx.moveTo(recent[0].x, recent[0].y); drawSmoothPath(ctx, recent);
      }
    } else {
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
    }
  }, [repaint, drawObjectHighlight, drawMarqueeOverlay, getMarqueeObjects]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const s = settingsRef.current;
    const pos = getEventPoint(e.nativeEvent, canvas);

    // ── Finish marquee group move ────────────────────────────────────────────
    if (s.tool === 'select' && isMarqueeMove.current && marqueeMoveState.current) {
      isMarqueeMove.current = false;
      const { startPos, startMarquee, ids } = marqueeMoveState.current;
      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;
      const newMarquee = { x: startMarquee.x + dx, y: startMarquee.y + dy, w: startMarquee.w, h: startMarquee.h };
      setMarquee(newMarquee); marqueeRef.current = newMarquee;
      drawMarqueeOverlay(newMarquee, ids);
      marqueeMoveState.current = null;
      return;
    }

    // ── Finish single move ───────────────────────────────────────────────────
    if (s.tool === 'select' && selectState.current) {
      selectState.current = null;
      if (selectedIdRef.current) drawObjectHighlight(selectedIdRef.current);
      return;
    }

    // ── Finish marquee draw ──────────────────────────────────────────────────
    if (s.tool === 'select' && isMarquee.current) {
      isMarquee.current = false;
      if (marqueeStart.current) {
        const rect: SelectionRect = {
          x: Math.min(marqueeStart.current.x, pos.x), y: Math.min(marqueeStart.current.y, pos.y),
          w: Math.abs(pos.x - marqueeStart.current.x), h: Math.abs(pos.y - marqueeStart.current.y),
        };
        if (rect.w > 4 && rect.h > 4) {
          const captured = getMarqueeObjects(rect);
          setMarquee(rect); marqueeRef.current = rect;
          drawMarqueeOverlay(rect, captured);
        } else {
          clearOverlay();
        }
      }
      marqueeStart.current = null;
      return;
    }

    // ── Commit shape ─────────────────────────────────────────────────────────
    if (SHAPE_TOOLS.has(s.tool) && shapeStart.current) {
      const endPos = points.current[points.current.length - 1] ?? shapeStart.current;
      pushUndo();
      if (snapshotBeforeStroke.current) ctx.putImageData(snapshotBeforeStroke.current, 0, 0);
      const obj: ShapeObject = {
        id: uid(), kind: 'shape',
        shape: s.tool as ShapeObject['shape'],
        x1: shapeStart.current.x, y1: shapeStart.current.y,
        x2: endPos.x, y2: endPos.y,
        color: s.color, size: s.size, opacity: s.opacity, fill: s.fillShape,
        bbox: bboxFromShape(shapeStart.current.x, shapeStart.current.y, endPos.x, endPos.y),
      };
      objects.current.push(obj);
      renderObject(ctx, obj);
      shapeStart.current = null; snapshotBeforeStroke.current = null; points.current = [];
      return;
    }

    // ── Commit freehand ──────────────────────────────────────────────────────
    const pts = points.current;
    if (pts.length < 1) return;

    if (s.mode === 'smooth' && s.tool !== 'eraser' && s.tool !== 'highlighter' && pts.length > 6) {
      renderAll(ctx, objects.current);
      applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);
      const recognized = recognizeShape(pts);
      if (recognized) drawRecognizedShape(ctx, recognized);
      else drawSmoothPath(ctx, pts);
    }

    if (s.mode === 'smooth' && pts.length > 6) {
      const recognized = recognizeShape(pts);
      if (recognized) {
        let shapeObj: ShapeObject | null = null;
        if (recognized.type === 'line') shapeObj = { id: uid(), kind: 'shape', shape: 'line', x1: recognized.x1, y1: recognized.y1, x2: recognized.x2, y2: recognized.y2, color: s.color, size: s.size, opacity: s.opacity, fill: false, bbox: bboxFromShape(recognized.x1, recognized.y1, recognized.x2, recognized.y2) };
        else if (recognized.type === 'rect') shapeObj = { id: uid(), kind: 'shape', shape: 'rect', x1: recognized.x, y1: recognized.y, x2: recognized.x + recognized.w, y2: recognized.y + recognized.h, color: s.color, size: s.size, opacity: s.opacity, fill: false, bbox: bboxFromShape(recognized.x, recognized.y, recognized.x + recognized.w, recognized.y + recognized.h) };
        else if (recognized.type === 'ellipse') shapeObj = { id: uid(), kind: 'shape', shape: 'ellipse', x1: recognized.cx - recognized.rx, y1: recognized.cy - recognized.ry, x2: recognized.cx + recognized.rx, y2: recognized.cy + recognized.ry, color: s.color, size: s.size, opacity: s.opacity, fill: false, bbox: bboxFromShape(recognized.cx - recognized.rx, recognized.cy - recognized.ry, recognized.cx + recognized.rx, recognized.cy + recognized.ry) };
        else if (recognized.type === 'triangle') { const xs = recognized.pts.map(p => p.x), ys = recognized.pts.map(p => p.y); shapeObj = { id: uid(), kind: 'shape', shape: 'triangle', x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys), color: s.color, size: s.size, opacity: s.opacity, fill: false, bbox: bboxFromShape(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)) }; }
        if (shapeObj) { objects.current.push(shapeObj); renderAll(ctx, objects.current); points.current = []; return; }
      }
    }

    const strokeObj: StrokeObject = {
      id: uid(), kind: 'stroke',
      tool: s.tool as StrokeObject['tool'],
      points: pts,
      color: s.color, size: s.size, opacity: s.opacity,
      bbox: bboxFromPoints(pts, s.tool === 'highlighter' ? s.size * 5 : s.size),
    };
    objects.current.push(strokeObj);
    points.current = [];
  }, [pushUndo, drawObjectHighlight, drawMarqueeOverlay, clearOverlay, getMarqueeObjects]);

  // ── Text placement ─────────────────────────────────────────────────────────
  const placeText = useCallback((text: string, pos: Point) => {
    const ctx = getCtx();
    if (!ctx || !text.trim()) { setIsPlacingText(false); setTextPos(null); return; }
    const s = settingsRef.current;
    pushUndo();
    const fontSize = Math.max(14, s.size * 3 + 10);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = s.opacity;
    ctx.fillStyle = s.color;
    ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    const lineHeight = fontSize * 1.35;
    let maxW = 0;
    text.split('\n').forEach((line, i) => {
      const m = ctx.measureText(line);
      if (m.width > maxW) maxW = m.width;
      ctx.fillText(line, pos.x, pos.y + i * lineHeight);
    });
    ctx.restore();
    const lines = text.split('\n');
    const textObj: TextObject = {
      id: uid(), kind: 'text',
      x: pos.x, y: pos.y, text,
      color: s.color, fontSize, opacity: s.opacity,
      bbox: { x: pos.x, y: pos.y, w: Math.max(maxW, 20), h: lines.length * lineHeight },
    };
    objects.current.push(textObj);
    setIsPlacingText(false); setTextPos(null);
  }, [pushUndo]);

  const cancelText = useCallback(() => {
    setIsPlacingText(false); setTextPos(null);
  }, []);

  // ── Text editing (update after placement) ─────────────────────────────────
  const updateTextObject = useCallback((id: string, patch: Partial<Pick<TextObject, 'text' | 'color' | 'fontSize' | 'opacity'>>) => {
    const ctx = getCtx();
    if (!ctx) return;
    const idx = objects.current.findIndex(o => o.id === id);
    if (idx === -1) return;
    const obj = objects.current[idx] as TextObject;
    const updated: TextObject = { ...obj, ...patch };
    // Recompute bbox with new font size / text
    const fontSize = updated.fontSize;
    const lineHeight = fontSize * 1.35;
    ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
    let maxW = 0;
    updated.text.split('\n').forEach(line => {
      const w = ctx.measureText(line).width;
      if (w > maxW) maxW = w;
    });
    updated.bbox = { x: updated.x, y: updated.y, w: Math.max(maxW, 20), h: updated.text.split('\n').length * lineHeight };
    objects.current[idx] = updated;
    repaint();
    drawObjectHighlight(id);
  }, [repaint, drawObjectHighlight]);

  // ── Delete selected object ─────────────────────────────────────────────────
  const deleteSelectedObject = useCallback(() => {
    if (!selectedIdRef.current) return;
    pushUndo();
    objects.current = objects.current.filter(o => o.id !== selectedIdRef.current);
    repaint(); deselect();
  }, [pushUndo, repaint, deselect]);

  // Expose selected text object data for the properties panel
  const selectedObject = selectedId ? objects.current.find(o => o.id === selectedId) ?? null : null;

  return {
    canvasRef, overlayRef,
    onPointerDown, onPointerMove, onPointerUp,
    undo, redo, clear, exportPNG,
    canUndo, canRedo,
    isPlacingText, textPos, placeText, cancelText,
    selectedId, selectedObject,
    editingTextId,
    updateTextObject,
    deleteSelectedObject,
    deselect,
    marquee, exportSelection, deleteSelection, clearMarquee,
  };
}

// ── Move object by delta ──────────────────────────────────────────────────────
function moveObject(obj: DrawObject, dx: number, dy: number): DrawObject {
  if (obj.kind === 'stroke') return { ...obj, points: obj.points.map(p => ({ x: p.x + dx, y: p.y + dy })), bbox: { ...obj.bbox, x: obj.bbox.x + dx, y: obj.bbox.y + dy } };
  if (obj.kind === 'shape') return { ...obj, x1: obj.x1 + dx, y1: obj.y1 + dy, x2: obj.x2 + dx, y2: obj.y2 + dy, bbox: { ...obj.bbox, x: obj.bbox.x + dx, y: obj.bbox.y + dy } };
  if (obj.kind === 'text') return { ...obj, x: obj.x + dx, y: obj.y + dy, bbox: { ...obj.bbox, x: obj.bbox.x + dx, y: obj.bbox.y + dy } };
  return obj;
}