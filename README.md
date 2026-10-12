# BadiCharts

> A professional-grade trading chart engine built from scratch in **vanilla JavaScript** — no charting libraries, no frameworks.

[![BadiCharts](https://img.shields.io/badge/BadiCharts-v1.0-12C4F0?style=for-the-badge&labelColor=0e1117)](#)

BadiCharts is a fork-independent charting engine focused on **performance**, **extensibility**, and a **trader-friendly look**. It ships with a built-in **BadiCharts watermark** rendered behind the candles on every chart, and a vivid mint/coral candle palette that traders actually love.

---

## What's new in BadiCharts (vs. upstream)

- **Brand watermark** — a subtle BadiCharts logo (icon + wordmark + "Charting Engine" tagline) is drawn on the shared canvas, in the **bottom-left corner** of the main price pane. It sits **behind** the candles so it never obscures the data.
- **Theme-aware watermark colors** — the tagline tints itself with the active theme's muted text color, so it blends with the chart background (dark gray on dark theme, soft gray on light theme) instead of being pure white.
- **New candle palette** — replaced the muted TradingView teal/red with a vivid **mint green `#16C784`** and **coral red `#EA3943`** that are loved by traders and pop on dark backgrounds. The accent color is now the brand cyan `#12C4F0`.
- **Crosshair time-label fix** — the cursor's time label now correctly shows the **current** bar's time (the upstream had an off-by-one bug that displayed the next minute).
- **Sub-second time precision** — the crosshair time label now includes seconds (`HH:MM:SS`) for sub-minute intervals and milliseconds for sub-second intervals.

---

## Quick start

```bash
cd badicharts
# Any static server works. Pick one:
python3 -m http.server 8000
#   → open http://localhost:8000

# Or:
npx serve .
```

No build step. No npm install. Just open `index.html` in a browser.

---

## Architecture

```
badicharts/
├── index.html               # Entry point
├── css/
│   ├── main.css             # Base reset + CSS variables (brand palette)
│   ├── chart.css            # Canvas overlay, tooltip, legend, status bar
│   ├── toolbar.css          # Toolbar buttons & responsive layout
│   └── themes.css           # Light theme overrides
└── js/
    ├── app.js               # Bootstrap
    ├── core/
    │   ├── ChartEngine.js   # Orchestrator — owns all subsystems (incl. watermark)
    │   ├── Canvas.js        # High-DPI canvas + ResizeObserver
    │   ├── Viewport.js      # Visible range, pan/zoom math
    │   ├── EventManager.js  # Pointer/touch/wheel/keyboard
    │   └── AnimationLoop.js # rAF + dirty-flag scheduling
    ├── data/
    │   ├── Candle.js
    │   ├── DataManager.js   # Flat Float64Array storage (cache-friendly)
    │   └── DataFeed.js      # Simulated market feed (replace with WS/REST)
    ├── scale/
    │   ├── PriceScale.js
    │   └── TimeScale.js
    ├── series/
    │   ├── CandleSeries.js  # Adaptive detail (bodies → high-low → close line)
    │   └── VolumeSeries.js
    ├── drawing/             # 20+ drawing tools (trend line, fib, position, ...)
    ├── indicators/
    │   ├── overlays/        # SMA, EMA, Bollinger, SuperTrend, Ichimoku, ...
    │   └── panes/           # RSI, MACD, Volume, Stochastic, ...
    ├── ui/
    │   ├── Toolbar.js
    │   ├── Crosshair.js     # Snapping crosshair + axis labels
    │   ├── Tooltip.js       # OHLCV floating tooltip
    │   ├── StatusBar.js
    │   ├── Theme.js         # Dark/Light theme manager (brand palette)
    │   └── Watermark.js     # BadiCharts logo watermark (NEW)
    └── utils/
        ├── MathUtils.js
        ├── ColorUtils.js
        ├── DomUtils.js
        └── Performance.js
```

### Watermark rendering

The watermark (`js/ui/Watermark.js`) is drawn on the shared canvas during each render frame, **after** the background fill but **before** the gridlines and candles. This means:

- It is part of the chart surface itself — no DOM overlay, no extra repaint cost.
- Candles, indicators, drawings, and the crosshair are always painted on top of it.
- The brand gradient (`#12C4F0 → #3B6CF5`) is reused for both the icon strokes and the wordmark text.
- The "Charting Engine" tagline uses `theme.mutedText`, so it adapts to the active theme.
- Opacity is `0.18` by default; you can tune it via `new Watermark({ opacity: 0.25 })`.

---

## Built-in tools

| Tool | Shortcut | Behavior |
|---|---|---|
| Cursor | `V` | Default — pan with click-drag, select drawings |
| Crosshair | `C` | Snap-to-bar crosshair |
| Trend Line | `T` | 2-click line with optional extension |
| Horizontal Line | `H` | Single-click price level |
| Rectangle | `R` | 2-click zone |
| Fibonacci | `F` | 2-click retracement |
| Long / Short Position | `L` / `S` | Entry/stop/target with R:R |
| Text | `X` | Click to place annotation |

**Other shortcuts:** `Delete`/`Backspace` removes the selected drawing. `Esc` cancels the in-progress drawing.

---

## API quick reference

```js
const engine = new ChartEngine(container, { symbol: 'BTCUSDT', theme: 'dark' });
engine.init();                                  // load history + fit view

engine.setActiveTool('trendline');              // activate a drawing tool
engine.fitAll();                                // fit all data in view
engine.toggleTheme();                           // dark ↔ light
engine.toggleLive();                            // start/stop simulated feed

// Customize the watermark (optional):
engine.watermark.opacity = 0.25;                // make it more visible
engine.watermark.scale = 1.0;                   // bigger logo
engine.requestRender();
```

---

## Brand identity

| Token | Color | Usage |
|---|---|---|
| Brand cyan | `#12C4F0` | Accent, watermark gradient start, toolbar active state |
| Brand blue | `#3B6CF5` | Watermark gradient end |
| Up candle | `#16C784` | Bullish candles, wicks, volume bars |
| Down candle | `#EA3943` | Bearish candles, wicks, volume bars |

The palette is intentionally distinct from TradingView's `#089981 / #f23645` — slightly more saturated and "fresher", which traders report as easier to scan at a glance.

---

## License

MIT
