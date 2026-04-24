import { useEffect, useRef, useState } from 'react';
import type { Point } from '../types';

interface TextInputOverlayProps {
  pos: Point;
  color: string;
  fontSize: number;
  onConfirm: (text: string, pos: Point) => void;
  onCancel: () => void;
}

export function TextInputOverlay({ pos, color, fontSize, onConfirm, onCancel }: TextInputOverlayProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  // Capture pos at mount time so blur/confirm always uses the right position
  const posRef = useRef<Point>(pos);

  useEffect(() => {
    // Delay focus slightly so the canvas pointerdown doesn't immediately steal it back
    const t = setTimeout(() => ref.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const confirm = () => {
    if (text.trim()) {
      onConfirm(text, posRef.current);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter (without Shift) confirms; Shift+Enter = newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      confirm();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  // Prevent pointer events from reaching the canvas below while typing
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="absolute z-40"
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={handlePointerDown}
    >
      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={confirm}
        rows={2}
        style={{
          color,
          fontSize: `${fontSize}px`,
          lineHeight: 1.4,
          minWidth: 140,
          minHeight: fontSize * 1.6,
          background: 'rgba(255,255,255,0.92)',
          border: '1.5px dashed #94a3b8',
          borderRadius: 5,
          padding: '4px 8px',
          outline: 'none',
          resize: 'both',
          fontFamily: 'Inter, system-ui, sans-serif',
          boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
          display: 'block',
        }}
        placeholder="Type here… Enter to place"
      />
      <div className="text-[10px] text-zinc-400 mt-0.5 select-none">
        Enter to place · Shift+Enter for new line · Esc to cancel
      </div>
    </div>
  );
}
