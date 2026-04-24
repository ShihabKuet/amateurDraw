# ✏️ AmateurDraw

A clean, instant whiteboard for quick explanations. No login, no signup — just open and draw.

**Live demo:** [Deploy to Vercel](#deploy)

---

## Features

- **Pen** — smooth solid strokes
- **Pencil** — textured semi-transparent strokes
- **Highlighter** — wide transparent overlay
- **Eraser** — drag to erase
- **Shapes** — Line, Rectangle, Ellipse, Triangle, Arrow (with optional fill)
- **Text** — click anywhere on canvas to add text
- **Color picker** + 10 preset colors
- **Brush size & opacity** sliders
- **Simple / Smooth mode toggle**
  - *Simple*: raw strokes as you draw
  - *Smooth*: automatically cleans up jiggery lines and recognizes shapes (rectangle, ellipse, triangle, line)
- **Undo / Redo** (50 steps) — also `Ctrl+Z` / `Ctrl+Y`
- **Clear canvas**
- **Export as PNG** (white background)
- Dot-grid canvas background
- Fully responsive

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS v3 |
| Icons | Lucide React |
| Utilities | clsx |
| Hosting | Vercel |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Deploy to Vercel

### Option 1 — Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option 2 — GitHub Integration
1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import your GitHub repo
4. Vercel auto-detects Vite — click **Deploy**

No environment variables needed.

---

## Project Structure

```
amateurDraw/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── DrawingCanvas.tsx   # Canvas wrapper + text overlay
│   │   ├── StatusBar.tsx       # Bottom status bar
│   │   ├── TextInputOverlay.tsx# Floating text input
│   │   └── Toolbar.tsx         # Top toolbar with all controls
│   ├── hooks/
│   │   ├── useDrawingCanvas.ts # Core drawing engine
│   │   └── useDrawSettings.ts  # Tool/settings state
│   ├── types/
│   │   └── index.ts            # TypeScript types
│   ├── utils/
│   │   └── canvas.ts           # Canvas helpers & shape recognition
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
├── vercel.json
└── vite.config.ts
```

---

## License

MIT
