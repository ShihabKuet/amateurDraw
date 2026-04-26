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

export interface DrawSettings {
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  mode: StrokeMode;
  fillShape: boolean;
}

// ── Object model ─────────────────────────────────────────────────────────────
// Every mark on the canvas is stored as a DrawObject so it can be
// selected, moved, and re-rendered at any time.

export type DrawObjectType = 'stroke' | 'shape' | 'text';

export interface StrokeObject {
  id: string;
  kind: 'stroke';
  tool: 'pen' | 'pencil' | 'highlighter' | 'eraser';
  points: Point[];
  color: string;
  size: number;
  opacity: number;
  // bounding box (computed once, used for hit-testing)
  bbox: BBox;
}

export interface ShapeObject {
  id: string;
  kind: 'shape';
  shape: 'line' | 'rect' | 'ellipse' | 'triangle' | 'arrow';
  x1: number; y1: number; // start
  x2: number; y2: number; // end
  color: string;
  size: number;
  opacity: number;
  fill: boolean;
  bbox: BBox;
}

export interface TextObject {
  id: string;
  kind: 'text';
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  opacity: number;
  bbox: BBox;
}

export type DrawObject = StrokeObject | ShapeObject | TextObject;

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}