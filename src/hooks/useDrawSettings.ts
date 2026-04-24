import { useState, useCallback } from 'react';
import type { DrawSettings, ToolType, StrokeMode } from '../types';

const DEFAULT_SETTINGS: DrawSettings = {
  tool: 'pen',
  color: '#1a1a1a',
  size: 4,
  opacity: 1,
  mode: 'simple',
  fillShape: false,
};

export function useDrawSettings() {
  const [settings, setSettings] = useState<DrawSettings>(DEFAULT_SETTINGS);

  const setTool = useCallback((tool: ToolType) => {
    setSettings((s) => ({ ...s, tool }));
  }, []);

  const setColor = useCallback((color: string) => {
    setSettings((s) => ({ ...s, color }));
  }, []);

  const setSize = useCallback((size: number) => {
    setSettings((s) => ({ ...s, size }));
  }, []);

  const setOpacity = useCallback((opacity: number) => {
    setSettings((s) => ({ ...s, opacity }));
  }, []);

  const setMode = useCallback((mode: StrokeMode) => {
    setSettings((s) => ({ ...s, mode }));
  }, []);

  const setFillShape = useCallback((fillShape: boolean) => {
    setSettings((s) => ({ ...s, fillShape }));
  }, []);

  return { settings, setTool, setColor, setSize, setOpacity, setMode, setFillShape };
}
