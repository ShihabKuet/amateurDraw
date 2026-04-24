import { useState, useRef, useEffect } from 'react';
import {
  Pen, PenLine, Highlighter, Eraser, Type,
  Minus, Square, Circle, Triangle, ArrowRight,
  Undo2, Redo2, Trash2, Download, ChevronDown,
  Sparkles, Settings2,
} from 'lucide-react';
import clsx from 'clsx';
import type { ToolType, StrokeMode } from '../types';

const PRESET_COLORS = [
  '#1a1a1a', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b',
];

interface ToolbarProps {
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  mode: StrokeMode;
  fillShape: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onSetTool: (t: ToolType) => void;
  onSetColor: (c: string) => void;
  onSetSize: (s: number) => void;
  onSetOpacity: (o: number) => void;
  onSetMode: (m: StrokeMode) => void;
  onSetFillShape: (f: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExport: () => void;
}

type ToolGroup = {
  id: ToolType;
  label: string;
  icon: React.ReactNode;
};

const DRAW_TOOLS: ToolGroup[] = [
  { id: 'pen', label: 'Pen', icon: <Pen size={16} /> },
  { id: 'pencil', label: 'Pencil', icon: <PenLine size={16} /> },
  { id: 'highlighter', label: 'Highlighter', icon: <Highlighter size={16} /> },
  { id: 'eraser', label: 'Eraser', icon: <Eraser size={16} /> },
  { id: 'text', label: 'Text', icon: <Type size={16} /> },
];

const SHAPE_TOOLS: ToolGroup[] = [
  { id: 'line', label: 'Line', icon: <Minus size={16} /> },
  { id: 'rect', label: 'Rectangle', icon: <Square size={16} /> },
  { id: 'ellipse', label: 'Ellipse', icon: <Circle size={16} /> },
  { id: 'triangle', label: 'Triangle', icon: <Triangle size={16} /> },
  { id: 'arrow', label: 'Arrow', icon: <ArrowRight size={16} /> },
];

const SHAPE_IDS = new Set(SHAPE_TOOLS.map((t) => t.id));

function ToolBtn({
  active, onClick, title, children, disabled = false,
}: {
  active?: boolean; onClick: () => void; title: string;
  children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-100 text-sm',
        'border border-transparent select-none',
        active
          ? 'bg-zinc-900 text-white border-zinc-800 dark:bg-white dark:text-zinc-900'
          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white',
        disabled && 'opacity-30 cursor-not-allowed pointer-events-none'
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-1" />;
}

export function Toolbar({
  tool, color, size, opacity, mode, fillShape,
  canUndo, canRedo,
  onSetTool, onSetColor, onSetSize, onSetOpacity,
  onSetMode, onSetFillShape,
  onUndo, onRedo, onClear, onExport,
}: ToolbarProps) {
  const [shapesOpen, setShapesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const shapesRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);

  const isShapeTool = SHAPE_IDS.has(tool);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (shapesRef.current && !shapesRef.current.contains(e.target as Node)) {
        setShapesOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeShapeTool = SHAPE_TOOLS.find((t) => t.id === tool) ?? SHAPE_TOOLS[0];

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex-wrap">
      {/* Brand */}
      <span className="text-sm font-semibold text-zinc-900 dark:text-white tracking-tight mr-2 select-none">
        amateur<span className="text-zinc-400 font-normal">draw</span>
      </span>

      <Divider />

      {/* Draw tools */}
      {DRAW_TOOLS.map((t) => (
        <ToolBtn key={t.id} active={tool === t.id} onClick={() => onSetTool(t.id)} title={t.label}>
          {t.icon}
        </ToolBtn>
      ))}

      {/* Shapes dropdown */}
      <div ref={shapesRef} className="relative">
        <button
          title="Shapes"
          onClick={() => setShapesOpen((v) => !v)}
          className={clsx(
            'flex items-center gap-1 h-8 px-2 rounded-lg border transition-all duration-100 text-sm select-none',
            isShapeTool
              ? 'bg-zinc-900 text-white border-zinc-800 dark:bg-white dark:text-zinc-900'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
          )}
        >
          {activeShapeTool.icon}
          <ChevronDown size={11} className={clsx('transition-transform', shapesOpen && 'rotate-180')} />
        </button>
        {shapesOpen && (
          <div className="absolute top-10 left-0 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-1.5 flex flex-col gap-0.5 animate-pop min-w-[140px]">
            {SHAPE_TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => { onSetTool(t.id); setShapesOpen(false); }}
                className={clsx(
                  'flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors',
                  tool === t.id
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
            <div className="border-t border-zinc-100 dark:border-zinc-700 my-1 pt-1">
              <label className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={fillShape}
                  onChange={(e) => onSetFillShape(e.target.checked)}
                  className="rounded"
                />
                Fill shape
              </label>
            </div>
          </div>
        )}
      </div>

      <Divider />

      {/* Color swatch + presets */}
      <div className="flex items-center gap-1">
        <button
          className="w-7 h-7 rounded-full border-2 border-zinc-300 dark:border-zinc-600 cursor-pointer overflow-hidden relative flex-shrink-0 hover:scale-110 transition-transform"
          style={{ background: color }}
          title="Pick color"
          onClick={() => colorRef.current?.click()}
        />
        <input
          ref={colorRef}
          type="color"
          value={color}
          onChange={(e) => onSetColor(e.target.value)}
          className="sr-only"
        />
        <div className="flex gap-0.5 ml-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onSetColor(c)}
              title={c}
              style={{ background: c }}
              className={clsx(
                'w-4 h-4 rounded-full border transition-transform hover:scale-125',
                color === c
                  ? 'border-zinc-500 dark:border-zinc-300 scale-125'
                  : 'border-zinc-300 dark:border-zinc-600'
              )}
            />
          ))}
        </div>
      </div>

      <Divider />

      {/* Brush size */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-zinc-400 select-none">Size</span>
        <input
          type="range"
          min={1} max={50} value={size}
          onChange={(e) => onSetSize(+e.target.value)}
          className="w-16 h-1.5 accent-zinc-700 dark:accent-zinc-300"
        />
        <span className="text-[11px] text-zinc-500 w-5 text-right select-none">{size}</span>
      </div>

      {/* Opacity */}
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-zinc-400 select-none">Opacity</span>
        <input
          type="range"
          min={10} max={100} value={Math.round(opacity * 100)}
          onChange={(e) => onSetOpacity(+e.target.value / 100)}
          className="w-14 h-1.5 accent-zinc-700 dark:accent-zinc-300"
        />
        <span className="text-[11px] text-zinc-500 w-6 text-right select-none">{Math.round(opacity * 100)}%</span>
      </div>

      <Divider />

      {/* Mode toggle */}
      <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
        <button
          onClick={() => onSetMode('simple')}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-all',
            mode === 'simple'
              ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          )}
        >
          Simple
        </button>
        <button
          onClick={() => onSetMode('smooth')}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-all',
            mode === 'smooth'
              ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
          )}
        >
          <Sparkles size={11} />
          Smooth
        </button>
      </div>

      <Divider />

      {/* History */}
      <ToolBtn active={false} onClick={onUndo} title="Undo (Ctrl+Z)" disabled={!canUndo}>
        <Undo2 size={15} />
      </ToolBtn>
      <ToolBtn active={false} onClick={onRedo} title="Redo (Ctrl+Y)" disabled={!canRedo}>
        <Redo2 size={15} />
      </ToolBtn>
      <ToolBtn active={false} onClick={onClear} title="Clear canvas">
        <Trash2 size={15} />
      </ToolBtn>

      <Divider />

      {/* Settings */}
      <div ref={settingsRef} className="relative">
        <ToolBtn active={settingsOpen} onClick={() => setSettingsOpen((v) => !v)} title="Settings">
          <Settings2 size={15} />
        </ToolBtn>
        {settingsOpen && (
          <div className="absolute top-10 right-0 z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg p-4 animate-pop min-w-[220px]">
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
              Canvas settings
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm text-zinc-700 dark:text-zinc-300">
                <span>Smooth mode</span>
                <span className="text-xs text-zinc-400">{mode === 'smooth' ? 'On' : 'Off'}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-zinc-700 dark:text-zinc-300">
                <span>Fill shapes</span>
                <input
                  type="checkbox"
                  checked={fillShape}
                  onChange={(e) => onSetFillShape(e.target.checked)}
                />
              </div>
              <div className="text-xs text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                <p className="font-medium text-zinc-500 dark:text-zinc-400 mb-1">Keyboard shortcuts</p>
                <p><kbd className="font-mono">Ctrl+Z</kbd> — Undo</p>
                <p><kbd className="font-mono">Ctrl+Y</kbd> — Redo</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export */}
      <button
        onClick={onExport}
        title="Export as PNG"
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[12px] font-medium hover:bg-zinc-700 dark:hover:bg-zinc-100 transition-colors ml-1 select-none"
      >
        <Download size={13} />
        Export
      </button>
    </div>
  );
}
