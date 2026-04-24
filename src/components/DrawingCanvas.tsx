import clsx from 'clsx';
import type { ToolType, DrawSettings, Point } from '../types';
import { TextInputOverlay } from './TextInputOverlay';

interface DrawingCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  tool: ToolType;
  settings: DrawSettings;
  isPlacingText: boolean;
  textPos: Point | null;
  onPlaceText: (text: string, pos: Point) => void;
  onCancelText: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
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
  select: 'cursor-default',
};

export function DrawingCanvas({
  canvasRef,
  tool,
  settings,
  isPlacingText,
  textPos,
  onPlaceText,
  onCancelText,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: DrawingCanvasProps) {
  return (
    <div
      className="flex-1 relative overflow-hidden bg-[#FAFAF8] dark:bg-[#111111]"
      style={{
        backgroundImage: `
          radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)
        `,
        backgroundSize: '24px 24px',
      }}
    >
      <canvas
        ref={canvasRef}
        className={clsx('absolute inset-0 touch-none', CURSOR_MAP[tool])}
        style={{ width: '100%', height: '100%' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      {isPlacingText && textPos && (
        <TextInputOverlay
          pos={textPos}
          color={settings.color}
          fontSize={settings.size * 3 + 10}
          onConfirm={onPlaceText}
          onCancel={onCancelText}
        />
      )}
    </div>
  );
}
