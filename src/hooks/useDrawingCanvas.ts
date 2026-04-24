import { useRef, useEffect, useCallback, useState } from 'react';
import type { DrawSettings, Point } from '../types';
import {
  applyCtxSettings,
  drawSmoothPath,
  drawShapeOnCanvas,
  recognizeShape,
  drawRecognizedShape,
  getEventPoint,
  exportCanvasAsPNG,
  exportSelectionAsPNG,
  clearSelectionOnCanvas,
} from '../utils/canvas';

const SHAPE_TOOLS = new Set(['line', 'rect', 'ellipse', 'triangle', 'arrow']);
const MAX_UNDO = 50;

export interface SelectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useDrawingCanvas(settings: DrawSettings) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const isDrawing = useRef(false);
  const points = useRef<Point[]>([]);
  const shapeStart = useRef<Point | null>(null);
  const snapshotBeforeShape = useRef<ImageData | null>(null);
  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);
  const settingsRef = useRef(settings);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isPlacingText, setIsPlacingText] = useState(false);
  const [textPos, setTextPos] = useState<Point | null>(null);
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const selectionRef = useRef<SelectionRect | null>(null);

  const getCtx = useCallback((): CanvasRenderingContext2D | null => {
    return canvasRef.current?.getContext('2d') ?? null;
  }, []);

  const clearOverlay = useCallback(() => {
    const oc = overlayRef.current;
    if (!oc) return;
    const ctx = oc.getContext('2d');
    ctx?.clearRect(0, 0, oc.width, oc.height);
  }, []);

  const drawSelectionMarquee = useCallback((rect: SelectionRect) => {
    const oc = overlayRef.current;
    if (!oc) return;
    const ctx = oc.getContext('2d')!;
    ctx.clearRect(0, 0, oc.width, oc.height);

    const x = rect.w < 0 ? rect.x + rect.w : rect.x;
    const y = rect.h < 0 ? rect.y + rect.h : rect.y;
    const w = Math.abs(rect.w);
    const h = Math.abs(rect.h);

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, oc.width, oc.height);
    ctx.clearRect(x, y, w, h);

    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
    ctx.restore();

    const handles = [
      [x, y], [x + w, y], [x, y + h], [x + w, y + h],
      [x + w / 2, y], [x + w / 2, y + h],
      [x, y + h / 2], [x + w, y + h / 2],
    ];
    ctx.setLineDash([]);
    handles.forEach(([hx, hy]) => {
      ctx.beginPath();
      ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, []);

  const saveSnapshot = useCallback((): ImageData | null => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return null;
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }, [getCtx]);

  const pushUndo = useCallback(() => {
    const snap = saveSnapshot();
    if (!snap) return;
    undoStack.current.push(snap);
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [saveSnapshot]);

  const undo = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas || !undoStack.current.length) return;
    const current = saveSnapshot();
    if (current) redoStack.current.push(current);
    const prev = undoStack.current.pop()!;
    ctx.putImageData(prev, 0, 0);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, [getCtx, saveSnapshot]);

  const redo = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas || !redoStack.current.length) return;
    const current = saveSnapshot();
    if (current) undoStack.current.push(current);
    const next = redoStack.current.pop()!;
    ctx.putImageData(next, 0, 0);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }, [getCtx, saveSnapshot]);

  const clear = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    pushUndo();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    clearOverlay();
    setSelection(null);
    selectionRef.current = null;
  }, [getCtx, pushUndo, clearOverlay]);

  const exportPNG = useCallback(() => {
    if (canvasRef.current) exportCanvasAsPNG(canvasRef.current);
  }, []);

  const exportSelection = useCallback(() => {
    const sel = selectionRef.current;
    if (!sel || !canvasRef.current) return;
    exportSelectionAsPNG(canvasRef.current, sel.x, sel.y, sel.w, sel.h);
  }, []);

  const deleteSelection = useCallback(() => {
    const sel = selectionRef.current;
    const ctx = getCtx();
    if (!sel || !ctx) return;
    pushUndo();
    clearSelectionOnCanvas(ctx, sel.x, sel.y, sel.w, sel.h);
    clearOverlay();
    setSelection(null);
    selectionRef.current = null;
  }, [getCtx, pushUndo, clearOverlay]);

  const clearSelection = useCallback(() => {
    clearOverlay();
    setSelection(null);
    selectionRef.current = null;
  }, [clearOverlay]);

  // Clear selection when switching away from select tool
  useEffect(() => {
    if (settings.tool !== 'select') {
      clearOverlay();
      setSelection(null);
      selectionRef.current = null;
    }
    settingsRef.current = settings;
  }, [settings, clearOverlay]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(() => {
      const ctx = canvas.getContext('2d')!;
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      overlay.width = parent.clientWidth;
      overlay.height = parent.clientHeight;
      ctx.putImageData(snapshot, 0, 0);
    });
    ro.observe(parent);
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    overlay.width = parent.clientWidth;
    overlay.height = parent.clientHeight;
    return () => ro.disconnect();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (isPlacingText) return;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectionRef.current) {
        e.preventDefault();
        deleteSelection();
      }
      if (e.key === 'Escape' && selectionRef.current) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, deleteSelection, clearSelection, isPlacingText]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;

    const s = settingsRef.current;
    const pos = getEventPoint(e.nativeEvent, canvas);

    // Text tool — show text overlay, do NOT capture pointer
    if (s.tool === 'text') {
      setTextPos({ ...pos });
      setIsPlacingText(true);
      return;
    }

    canvas.setPointerCapture(e.pointerId);

    // Select tool — start marquee
    if (s.tool === 'select') {
      clearOverlay();
      setSelection(null);
      selectionRef.current = null;
      isDrawing.current = true;
      shapeStart.current = { ...pos };
      points.current = [pos];
      return;
    }

    isDrawing.current = true;
    points.current = [pos];

    if (SHAPE_TOOLS.has(s.tool)) {
      shapeStart.current = { ...pos };
      snapshotBeforeShape.current = saveSnapshot();
      return;
    }

    pushUndo();
    applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + 0.1, pos.y);
    ctx.stroke();
  }, [getCtx, saveSnapshot, pushUndo, clearOverlay]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;

    const s = settingsRef.current;
    const pos = getEventPoint(e.nativeEvent, canvas);
    points.current.push(pos);

    if (s.tool === 'select' && shapeStart.current) {
      drawSelectionMarquee({
        x: shapeStart.current.x, y: shapeStart.current.y,
        w: pos.x - shapeStart.current.x, h: pos.y - shapeStart.current.y,
      });
      return;
    }

    if (SHAPE_TOOLS.has(s.tool) && shapeStart.current) {
      if (snapshotBeforeShape.current) ctx.putImageData(snapshotBeforeShape.current, 0, 0);
      applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);
      ctx.fillStyle = s.fillShape ? s.color + '33' : 'transparent';
      drawShapeOnCanvas(ctx, s.tool, shapeStart.current, pos, s.fillShape);
      return;
    }

    applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);

    if (s.mode === 'smooth') {
      const recent = points.current.slice(-4);
      if (recent.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(recent[0].x, recent[0].y);
        drawSmoothPath(ctx, recent);
      }
    } else {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  }, [getCtx, drawSelectionMarquee]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;

    const s = settingsRef.current;
    const pos = getEventPoint(e.nativeEvent, canvas);

    // Finalize selection marquee
    if (s.tool === 'select' && shapeStart.current) {
      const raw: SelectionRect = {
        x: shapeStart.current.x,
        y: shapeStart.current.y,
        w: pos.x - shapeStart.current.x,
        h: pos.y - shapeStart.current.y,
      };
      if (Math.abs(raw.w) > 4 && Math.abs(raw.h) > 4) {
        const normalized: SelectionRect = {
          x: raw.w < 0 ? raw.x + raw.w : raw.x,
          y: raw.h < 0 ? raw.y + raw.h : raw.y,
          w: Math.abs(raw.w),
          h: Math.abs(raw.h),
        };
        setSelection(normalized);
        selectionRef.current = normalized;
        drawSelectionMarquee(normalized);
      } else {
        clearOverlay();
        setSelection(null);
        selectionRef.current = null;
      }
      shapeStart.current = null;
      points.current = [];
      return;
    }

    if (SHAPE_TOOLS.has(s.tool) && shapeStart.current) {
      pushUndo();
      if (snapshotBeforeShape.current) ctx.putImageData(snapshotBeforeShape.current, 0, 0);
      applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);
      ctx.fillStyle = s.fillShape ? s.color + '33' : 'transparent';
      const endPos = points.current[points.current.length - 1] ?? shapeStart.current;
      drawShapeOnCanvas(ctx, s.tool, shapeStart.current, endPos, s.fillShape);
      shapeStart.current = null;
      snapshotBeforeShape.current = null;
      points.current = [];
      return;
    }

    // Smooth mode finalization
    if (s.mode === 'smooth' && s.tool !== 'eraser' && s.tool !== 'highlighter' && points.current.length > 6) {
      const undoSnap = undoStack.current[undoStack.current.length - 1];
      if (undoSnap) {
        ctx.putImageData(undoSnap, 0, 0);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);
      const recognized = recognizeShape(points.current);
      if (recognized) {
        drawRecognizedShape(ctx, recognized);
      } else {
        drawSmoothPath(ctx, points.current);
      }
    } else if (s.mode === 'smooth' && points.current.length >= 2) {
      const undoSnap = undoStack.current[undoStack.current.length - 1];
      if (undoSnap) ctx.putImageData(undoSnap, 0, 0);
      applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);
      drawSmoothPath(ctx, points.current);
    }

    points.current = [];
  }, [getCtx, pushUndo, drawSelectionMarquee, clearOverlay]);

  const placeText = useCallback((text: string, pos: Point) => {
    const ctx = getCtx();
    if (!ctx || !text.trim()) {
      setIsPlacingText(false);
      setTextPos(null);
      return;
    }
    const s = settingsRef.current;
    pushUndo();
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = s.opacity;
    ctx.fillStyle = s.color;
    const fontSize = Math.max(14, s.size * 3 + 10);
    ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    const lineHeight = fontSize * 1.35;
    text.split('\n').forEach((line, i) => {
      ctx.fillText(line, pos.x, pos.y + i * lineHeight);
    });
    ctx.restore();
    setIsPlacingText(false);
    setTextPos(null);
  }, [getCtx, pushUndo]);

  const cancelText = useCallback(() => {
    setIsPlacingText(false);
    setTextPos(null);
  }, []);

  return {
    canvasRef,
    overlayRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    undo,
    redo,
    clear,
    exportPNG,
    canUndo,
    canRedo,
    isPlacingText,
    textPos,
    placeText,
    cancelText,
    selection,
    exportSelection,
    deleteSelection,
    clearSelection,
  };
}
