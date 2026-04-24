import { useRef, useEffect, useCallback, useState } from 'react';
import type { DrawSettings, Point } from '../types';
import {
  applyCtxSettings,
  drawSmoothPath,
  drawRawPath,
  drawShapeOnCanvas,
  recognizeShape,
  drawRecognizedShape,
  getEventPoint,
  exportCanvasAsPNG,
} from '../utils/canvas';

const SHAPE_TOOLS = new Set(['line', 'rect', 'ellipse', 'triangle', 'arrow']);
const MAX_UNDO = 50;

export function useDrawingCanvas(settings: DrawSettings) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const getCtx = useCallback((): CanvasRenderingContext2D | null => {
    return canvasRef.current?.getContext('2d') ?? null;
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
  }, [getCtx, pushUndo]);

  const exportPNG = useCallback(() => {
    if (canvasRef.current) exportCanvasAsPNG(canvasRef.current);
  }, []);

  // Resize canvas on window resize while preserving content
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(() => {
      const ctx = canvas.getContext('2d')!;
      const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      ctx.putImageData(snapshot, 0, 0);
    });
    ro.observe(parent);
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    return () => ro.disconnect();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);

    const s = settingsRef.current;
    const pos = getEventPoint(e.nativeEvent, canvas);

    if (s.tool === 'text') {
      setIsPlacingText(true);
      setTextPos(pos);
      return;
    }

    isDrawing.current = true;
    points.current = [pos];

    if (SHAPE_TOOLS.has(s.tool)) {
      shapeStart.current = pos;
      snapshotBeforeShape.current = saveSnapshot();
      return;
    }

    pushUndo();
    applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + 0.1, pos.y);
    ctx.stroke();
  }, [getCtx, saveSnapshot, pushUndo]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;

    const s = settingsRef.current;
    const pos = getEventPoint(e.nativeEvent, canvas);
    points.current.push(pos);

    if (SHAPE_TOOLS.has(s.tool)) {
      // Restore snapshot and draw preview
      if (snapshotBeforeShape.current) {
        ctx.putImageData(snapshotBeforeShape.current, 0, 0);
      }
      applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);
      ctx.fillStyle = s.fillShape ? s.color + '33' : 'transparent';
      drawShapeOnCanvas(ctx, s.tool, shapeStart.current!, pos, s.fillShape);
      return;
    }

    applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);

    if (s.mode === 'smooth') {
      // Redraw last few points smoothly
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
  }, [getCtx]);

  const onPointerUp = useCallback((_e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;

    const s = settingsRef.current;

    if (SHAPE_TOOLS.has(s.tool)) {
      pushUndo();
      if (snapshotBeforeShape.current) {
        ctx.putImageData(snapshotBeforeShape.current, 0, 0);
      }
      applyCtxSettings(ctx, s.tool, s.color, s.size, s.opacity);
      ctx.fillStyle = s.fillShape ? s.color + '33' : 'transparent';
      const endPos = points.current[points.current.length - 1] ?? shapeStart.current!;
      drawShapeOnCanvas(ctx, s.tool, shapeStart.current!, endPos, s.fillShape);
      shapeStart.current = null;
      snapshotBeforeShape.current = null;
      points.current = [];
      return;
    }

    // Smooth mode: finalize stroke
    if (s.mode === 'smooth' && s.tool !== 'eraser' && s.tool !== 'highlighter' && points.current.length > 4) {
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
  }, [getCtx, pushUndo]);

  const placeText = useCallback((text: string, pos: Point) => {
    const ctx = getCtx();
    if (!ctx || !text.trim()) { setIsPlacingText(false); setTextPos(null); return; }
    const s = settingsRef.current;
    pushUndo();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = s.opacity;
    ctx.fillStyle = s.color;
    ctx.font = `${s.size * 3 + 10}px Inter, system-ui, sans-serif`;
    ctx.textBaseline = 'top';
    text.split('\n').forEach((line, i) => {
      ctx.fillText(line, pos.x, pos.y + i * (s.size * 3 + 14));
    });
    ctx.globalAlpha = 1;
    setIsPlacingText(false);
    setTextPos(null);
  }, [getCtx, pushUndo]);

  const cancelText = useCallback(() => {
    setIsPlacingText(false);
    setTextPos(null);
  }, []);

  return {
    canvasRef,
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
  };
}
