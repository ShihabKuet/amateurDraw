import { useState, useRef, useEffect } from 'react';
import type { TextObject } from '../types';
import clsx from 'clsx';

const PRESET_COLORS = [
  '#1a1a1a', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b',
];

interface TextPropertiesPanelProps {
  obj: TextObject;
  onUpdate: (patch: Partial<Pick<TextObject, 'text' | 'color' | 'fontSize' | 'opacity'>>) => void;
  onDelete: () => void;
  onDismiss: () => void;
}

export function TextPropertiesPanel({ obj, onUpdate, onDelete, onDismiss }: TextPropertiesPanelProps) {
  const [editingText, setEditingText] = useState(false);
  const [draftText, setDraftText] = useState(obj.text);
  const colorRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft when selection changes to a different text object
  useEffect(() => {
    setDraftText(obj.text);
    setEditingText(false);
  }, [obj.id]);

  useEffect(() => {
    if (editingText) textareaRef.current?.focus();
  }, [editingText]);

  const commitText = () => {
    if (draftText.trim()) onUpdate({ text: draftText });
    setEditingText(false);
  };

  return (
    <div className="absolute z-40 top-3 left-1/2 -translate-x-1/2 animate-pop">
      <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl px-3 py-2">

        {/* Label */}
        <span className="text-[11px] font-medium text-zinc-400 select-none whitespace-nowrap">Text</span>
        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />

        {/* Edit text button */}
        {!editingText ? (
          <button
            onClick={() => setEditingText(true)}
            className="flex items-center gap-1.5 text-[12px] px-2 py-1 rounded-md text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors select-none"
            title="Edit text"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit text
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <textarea
              ref={textareaRef}
              value={draftText}
              onChange={e => setDraftText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText(); } if (e.key === 'Escape') { setDraftText(obj.text); setEditingText(false); } }}
              className="text-[12px] border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white resize-none outline-none focus:ring-1 focus:ring-blue-400"
              rows={2}
              style={{ minWidth: 140, fontFamily: 'Inter, system-ui, sans-serif', fontSize: obj.fontSize }}
            />
            <button onClick={commitText} className="text-[11px] px-2 py-1 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-md hover:opacity-80 select-none">✓</button>
            <button onClick={() => { setDraftText(obj.text); setEditingText(false); }} className="text-[11px] px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md hover:opacity-80 select-none">✕</button>
          </div>
        )}

        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />

        {/* Font size */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-400 select-none">Size</span>
          <input
            type="range" min={10} max={120} value={obj.fontSize}
            onChange={e => onUpdate({ fontSize: +e.target.value })}
            className="w-20 h-1.5 accent-zinc-700 dark:accent-zinc-300"
          />
          <span className="text-[11px] text-zinc-500 w-6 select-none">{obj.fontSize}</span>
        </div>

        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />

        {/* Color */}
        <div className="flex items-center gap-1">
          <button
            className="w-6 h-6 rounded-full border-2 border-zinc-300 dark:border-zinc-600 flex-shrink-0 hover:scale-110 transition-transform"
            style={{ background: obj.color }}
            title="Pick color"
            onClick={() => colorRef.current?.click()}
          />
          <input ref={colorRef} type="color" value={obj.color} onChange={e => onUpdate({ color: e.target.value })} className="sr-only" />
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => onUpdate({ color: c })}
              style={{ background: c }}
              className={clsx(
                'w-4 h-4 rounded-full border transition-transform hover:scale-125',
                obj.color === c ? 'border-zinc-500 scale-125' : 'border-zinc-300 dark:border-zinc-600'
              )}
            />
          ))}
        </div>

        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />

        {/* Opacity */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-400 select-none">Opacity</span>
          <input
            type="range" min={10} max={100} value={Math.round(obj.opacity * 100)}
            onChange={e => onUpdate({ opacity: +e.target.value / 100 })}
            className="w-14 h-1.5 accent-zinc-700 dark:accent-zinc-300"
          />
          <span className="text-[11px] text-zinc-500 w-7 select-none">{Math.round(obj.opacity * 100)}%</span>
        </div>

        <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-700" />

        {/* Delete */}
        <button
          onClick={onDelete}
          className="flex items-center gap-1 text-[12px] px-2 py-1 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors select-none"
          title="Delete (Del)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Delete
        </button>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="flex items-center justify-center w-6 h-6 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Deselect (Esc)"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>
  );
}