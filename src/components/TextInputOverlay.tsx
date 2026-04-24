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

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) onConfirm(text, pos);
      else onCancel();
    }
    if (e.key === 'Escape') onCancel();
  };

  const handleBlur = () => {
    if (text.trim()) onConfirm(text, pos);
    else onCancel();
  };

  return (
    <textarea
      ref={ref}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        color,
        fontSize: `${fontSize}px`,
        lineHeight: '1.4',
        minWidth: 120,
        minHeight: 36,
        background: 'rgba(255,255,255,0.05)',
        border: '1.5px dashed rgba(100,100,100,0.5)',
        borderRadius: 4,
        padding: '3px 6px',
        outline: 'none',
        resize: 'both',
        fontFamily: 'Inter, system-ui, sans-serif',
        backdropFilter: 'blur(2px)',
        zIndex: 20,
      }}
      placeholder="Type here…  Enter to confirm"
      rows={1}
    />
  );
}
