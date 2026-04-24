import clsx from 'clsx';
import type { ToolType, DrawSettings, Point } from '../types';
import { TextInputOverlay } from './TextInputOverlay';
import type { SelectionRect } from '../hooks/useDrawingCanvas';

interface DrawingCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  overlayRef: React.RefObject<HTMLCanvasElement>;
  tool: ToolType;
  settings: DrawSettings;
  isPlacingText: boolean;
  textPos: Point | null;
  onPlaceText: (text: string, pos: Point) => void;
  onCancelText: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  selection: SelectionRect | null;
  onExportSelection: () => void;
  onDeleteSelection: () => void;
  onClearSelection: () => void;
}

const CURSOR_MAP: Record<ToolType, string> = {
  pen: 'cursor-crosshair',
  pencil: 'cursor-crosshair',
  highlighter: 'cursor-crosshair',
  eraser: 'cursor-cell',
  text: 'cursor-text',
  line: 'cursor-crosshair',
  rect: 'cursor-crosshair',
  ellipse: 'cursor-crosshair',
  triangle: 'cursor-crosshair',
  arrow: 'cursor-crosshair',
  select: 'cursor-crosshair',
};

export function DrawingCanvas({
  canvasRef,
  overlayRef,
  tool,
  settings,
  isPlacingText,
  textPos,
  onPlaceText,
  onCancelText,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  selection,
  onExportSelection,
  onDeleteSelection,
  onClearSelection,
}: DrawingCanvasProps) {
  // Where to place the selection action bar (below the selection rect)
  const barY = selection ? selection.y + selection.h + 8 : 0;
  const barX = selection ? selection.x : 0;

  return (
    <div
      className="flex-1 relative overflow-hidden bg-[#FAFAF8] dark:bg-[#111111]"
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      {/* Main drawing canvas */}
      <canvas
        ref={canvasRef}
        className={clsx('absolute inset-0 touch-none', CURSOR_MAP[tool])}
        style={{ width: '100%', height: '100%' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        // Don't fire pointerUp on leave — it cancels strokes mid-draw when
        // the cursor briefly exits; pointer capture handles release instead.
      />

      {/* Overlay canvas — selection marquee drawn here, never baked into drawing */}
      <canvas
        ref={overlayRef}
        className={clsx(
          'absolute inset-0 touch-none pointer-events-none',
          // When select tool is active pass pointer events through to main canvas
        )}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Selection action bar */}
      {selection && (
        <div
          className="absolute z-30 flex items-center gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg px-2 py-1 animate-pop"
          style={{ left: barX, top: barY }}
        >
          <span className="text-[11px] text-zinc-400 mr-1 select-none">
            {Math.round(selection.w)} × {Math.round(selection.h)}
          </span>
          <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
          <button
            onClick={onExportSelection}
            className="flex items-center gap-1 text-[12px] px-2 py-1 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors select-none"
            title="Export selection as PNG"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export
          </button>
          <button
            onClick={onDeleteSelection}
            className="flex items-center gap-1 text-[12px] px-2 py-1 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors select-none"
            title="Delete selection (Del)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            Delete
          </button>
          <button
            onClick={onClearSelection}
            className="flex items-center justify-center w-6 h-6 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors select-none"
            title="Dismiss selection (Esc)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Text input overlay — rendered on top, pointer-events enabled */}
      {isPlacingText && textPos && (
        <TextInputOverlay
          pos={textPos}
          color={settings.color}
          fontSize={Math.max(14, settings.size * 3 + 10)}
          onConfirm={onPlaceText}
          onCancel={onCancelText}
        />
      )}
    </div>
  );
}
