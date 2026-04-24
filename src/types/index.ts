export type ToolType =
  | 'pen'
  | 'pencil'
  | 'highlighter'
  | 'eraser'
  | 'text'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'arrow'
  | 'select';

export type StrokeMode = 'simple' | 'smooth';

export interface Point {
  x: number;
  y: number;
}

export interface TextItem {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  fontWeight: string;
}

export interface CanvasState {
  dataURL: string;
}

export interface DrawSettings {
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  mode: StrokeMode;
  fillShape: boolean;
}

export interface ShapePreview {
  start: Point;
  current: Point;
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  fill: boolean;
}
