import type { ToolType, StrokeMode } from '../types';

const TOOL_HINTS: Record<ToolType, string> = {
  pen: 'Draw with pen — smooth, solid strokes',
  pencil: 'Pencil — textured, semi-transparent strokes',
  highlighter: 'Highlighter — wide transparent overlay',
  eraser: 'Eraser — drag to erase',
  text: 'Text — click anywhere on the canvas to add text',
  line: 'Line — drag to draw a straight line',
  rect: 'Rectangle — drag to draw a rectangle',
  ellipse: 'Ellipse — drag to draw an ellipse',
  triangle: 'Triangle — drag to draw a triangle',
  arrow: 'Arrow — drag to draw an arrow',
  select: 'Select — click to select objects',
};

interface StatusBarProps {
  tool: ToolType;
  mode: StrokeMode;
}

export function StatusBar({ tool, mode }: StatusBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 select-none">
      <p className="text-[11px] text-zinc-400">
        {TOOL_HINTS[tool]}
      </p>
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-zinc-400">
          Mode:{' '}
          <span className="text-zinc-600 dark:text-zinc-300 font-medium">
            {mode === 'smooth' ? '✦ Smooth' : 'Simple'}
          </span>
        </span>
        <span className="text-[11px] text-zinc-300 dark:text-zinc-600">
          amateurDraw v1.0
        </span>
      </div>
    </div>
  );
}
