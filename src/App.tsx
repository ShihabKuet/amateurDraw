import { useDrawSettings } from './hooks/useDrawSettings';
import { useDrawingCanvas } from './hooks/useDrawingCanvas';
import { Toolbar } from './components/Toolbar';
import { DrawingCanvas } from './components/DrawingCanvas';
import { StatusBar } from './components/StatusBar';

export default function App() {
  const {
    settings,
    setTool, setColor, setSize, setOpacity, setMode, setFillShape,
  } = useDrawSettings();

  const {
    canvasRef,
    onPointerDown, onPointerMove, onPointerUp,
    undo, redo, clear, exportPNG,
    canUndo, canRedo,
    isPlacingText, textPos, placeText, cancelText,
  } = useDrawingCanvas(settings);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#FAFAF8] dark:bg-[#111] text-zinc-900 dark:text-white">
      <Toolbar
        tool={settings.tool}
        color={settings.color}
        size={settings.size}
        opacity={settings.opacity}
        mode={settings.mode}
        fillShape={settings.fillShape}
        canUndo={canUndo}
        canRedo={canRedo}
        onSetTool={setTool}
        onSetColor={setColor}
        onSetSize={setSize}
        onSetOpacity={setOpacity}
        onSetMode={setMode}
        onSetFillShape={setFillShape}
        onUndo={undo}
        onRedo={redo}
        onClear={clear}
        onExport={exportPNG}
      />
      <DrawingCanvas
        canvasRef={canvasRef}
        tool={settings.tool}
        settings={settings}
        isPlacingText={isPlacingText}
        textPos={textPos}
        onPlaceText={placeText}
        onCancelText={cancelText}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <StatusBar tool={settings.tool} mode={settings.mode} />
    </div>
  );
}
