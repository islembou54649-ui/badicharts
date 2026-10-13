/**
 * AdvancedChartTypes.js
 *
 * Six powerful chart types that go beyond standard candlesticks:
 *
 * 1. Renko           — bricks based on price movement only (no time axis)
 * 2. Point & Figure  — X/O columns based on reversal boxes
 * 3. ThreeLineBreak  — reversal only when price breaks 3 prior lines
 * 4. Kagi            — line thickness changes at reversal points
 * 5. HeikinAshiSmoothed — HA with extra EMA smoothing for cleaner trends
 * 6. PatternDetection — overlays pattern markers (Doji, Hammer, Engulfing,
 *                       Shooting Star, Marubozu) on regular candles
 *
 * Each method receives (ctx, vp, dm, theme) and draws directly on the canvas.
 */

// ============================================================
// 1. RENKO
// ============================================================
/**
 * Renko chart: bricks are drawn only when price moves by a fixed amount.
 * - Brick size = (visible high - low) / 20, OR ATR-based if available.
 * - Up bricks (green) start at the top of the previous brick.
 * - Down bricks (red) start at the bottom of the previous brick.
 * - The time axis is NOT used — bricks are evenly spaced.
 */
export function drawRenko(ctx, vp, dm, theme) {
    const { highs, lows, closes } = dm.raw();
    const leftIdx = Math.max(0, Math.floor(vp.leftEdge));
    const rightIdx = Math.min(dm.size - 1, Math.ceil(vp.rightEdge));
    if (rightIdx <= leftIdx) return;

    // Determine brick size from visible range.
    let pMin = Infinity, pMax = -Infinity;
    for (let i = leftIdx; i <= rightIdx; i++) {
        if (lows[i] < pMin) pMin = lows[i];
        if (highs[i] > pMax) pMax = highs[i];
    }
    if (!isFinite(pMin) || !isFinite(pMax) || pMax <= pMin) return;
    const brickSize = (pMax - pMin) / 20;
    if (brickSize <= 0) return;

    // Build Renko bricks from close prices.
    const bricks = [];
    let lastClose = closes[leftIdx];
    let direction = 0; // 0 = none, 1 = up, -1 = down
    for (let i = leftIdx; i <= rightIdx; i++) {
        const diff = closes[i] - lastClose;
        if (Math.abs(diff) >= brickSize) {
            const numBricks = Math.floor(Math.abs(diff) / brickSize);
            for (let b = 0; b < numBricks; b++) {
                if (diff > 0) {
                    bricks.push({ price: lastClose + brickSize, dir: 1 });
                    lastClose += brickSize;
                    direction = 1;
                } else {
                    bricks.push({ price: lastClose - brickSize, dir: -1 });
                    lastClose -= brickSize;
                    direction = -1;
                }
            }
        }
    }

    // Draw bricks — evenly spaced, NOT time-based.
    const total = bricks.length;
    if (total === 0) return;
    const brickW = Math.max(2, (vp.width - 80) / total * 0.8);
    const gap = Math.max(1, (vp.width - 80) / total * 0.2);
    ctx.save();
    for (let i = 0; i < total; i++) {
        const brick = bricks[i];
        const x = 10 + i * (brickW + gap);
        const yTop = vp.priceToY(brick.price);
        const yBot = vp.priceToY(brick.price - brickSize);
        const h = Math.max(2, Math.abs(yBot - yTop));
        const color = brick.dir > 0 ? theme.upColor : theme.downColor;
        // Hollow up, filled down (classic Renko style)
        if (brick.dir > 0) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 0.5, yTop + 0.5, brickW, h);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(x, yTop, brickW, h);
        }
    }
    ctx.restore();
}

// ============================================================
// 2. POINT & FIGURE
// ============================================================
/**
 * Point & Figure chart: X = rising column, O = falling column.
 * - Box size = (visible high - low) / 20.
 * - Reversal threshold = 3 boxes (classic 3-box reversal).
 * - Columns are evenly spaced (NOT time-based).
 */
export function drawPointAndFigure(ctx, vp, dm, theme) {
    const { highs, lows, closes } = dm.raw();
    const leftIdx = Math.max(0, Math.floor(vp.leftEdge));
    const rightIdx = Math.min(dm.size - 1, Math.ceil(vp.rightEdge));
    if (rightIdx <= leftIdx) return;

    let pMin = Infinity, pMax = -Infinity;
    for (let i = leftIdx; i <= rightIdx; i++) {
        if (lows[i] < pMin) pMin = lows[i];
        if (highs[i] > pMax) pMax = highs[i];
    }
    if (!isFinite(pMin) || !isFinite(pMax) || pMax <= pMin) return;
    const boxSize = (pMax - pMin) / 20;
    if (boxSize <= 0) return;
    const reversalBoxes = 3;
    const reversalAmount = boxSize * reversalBoxes;

    // Build P&F columns.
    const columns = [];
    let currentCol = { type: 'X', prices: [closes[leftIdx]], startPrice: closes[leftIdx] };
    let lastPrice = closes[leftIdx];
    let direction = 0;

    for (let i = leftIdx + 1; i <= rightIdx; i++) {
        const price = closes[i];
        if (direction >= 0) {
            // Currently rising (or neutral) — check if we continue up
            if (price - lastPrice >= boxSize) {
                currentCol.type = 'X';
                currentCol.prices.push(price);
                lastPrice = price;
                direction = 1;
            } else if (lastPrice - price >= reversalAmount) {
                // Reversal — start a new O column
                columns.push(currentCol);
                currentCol = { type: 'O', prices: [price], startPrice: lastPrice };
                lastPrice = price;
                direction = -1;
            }
        } else {
            // Currently falling — check if we continue down
            if (lastPrice - price >= boxSize) {
                currentCol.type = 'O';
                currentCol.prices.push(price);
                lastPrice = price;
            } else if (price - lastPrice >= reversalAmount) {
                // Reversal — start a new X column
                columns.push(currentCol);
                currentCol = { type: 'X', prices: [price], startPrice: lastPrice };
                lastPrice = price;
                direction = 1;
            }
        }
    }
    if (currentCol.prices.length > 0) columns.push(currentCol);

    // Draw columns.
    const colW = Math.max(3, (vp.width - 80) / Math.max(1, columns.length) * 0.6);
    const colGap = Math.max(2, (vp.width - 80) / Math.max(1, columns.length) * 0.4);
    const boxH = Math.max(2, vp.priceHeight / 25);

    ctx.save();
    ctx.font = `${Math.max(8, Math.min(boxH, colW) * 0.8)}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        const x = 10 + c * (colW + colGap) + colW / 2;
        const symbol = col.type;
        const color = symbol === 'X' ? theme.upColor : theme.downColor;
        ctx.fillStyle = color;
        for (let p = 0; p < col.prices.length; p++) {
            const y = vp.priceToY(col.prices[p]);
            ctx.fillText(symbol, x, y);
        }
    }
    ctx.restore();
}

// ============================================================
// 3. THREE-LINE BREAK
// ============================================================
/**
 * Three-Line Break: a new line is drawn only when price exceeds the
 * high or low of the previous 3 lines. Reversal requires breaking
 * all 3 prior lines.
 */
export function drawThreeLineBreak(ctx, vp, dm, theme) {
    const { closes } = dm.raw();
    const leftIdx = Math.max(0, Math.floor(vp.leftEdge));
    const rightIdx = Math.min(dm.size - 1, Math.ceil(vp.rightEdge));
    if (rightIdx <= leftIdx) return;

    // Build lines.
    const lines = [];
    let prevClose = closes[leftIdx];
    lines.push({ price: prevClose, dir: 0 });

    for (let i = leftIdx + 1; i <= rightIdx; i++) {
        const price = closes[i];
        const last3 = lines.slice(-3);
        const maxHigh = Math.max(...last3.map(l => l.price));
        const minLow = Math.min(...last3.map(l => l.price));
        const lastDir = lines[lines.length - 1].dir;

        if (price > maxHigh) {
            // Continue up or start new up line
            lines.push({ price, dir: 1 });
            prevClose = price;
        } else if (price < minLow) {
            // Continue down or start new down line
            lines.push({ price, dir: -1 });
            prevClose = price;
        }
        // Otherwise no new line
    }

    // Draw lines as thick bars.
    const total = lines.length;
    if (total < 2) return;
    const lineW = Math.max(3, (vp.width - 80) / total * 0.7);
    const gap = Math.max(1, (vp.width - 80) / total * 0.3);

    ctx.save();
    for (let i = 1; i < total; i++) {
        const line = lines[i];
        const prev = lines[i - 1];
        const x = 10 + i * (lineW + gap);
        const y1 = vp.priceToY(prev.price);
        const y2 = vp.priceToY(line.price);
        const yTop = Math.min(y1, y2);
        const h = Math.max(1, Math.abs(y2 - y1));
        const color = line.dir > 0 ? theme.upColor : (line.dir < 0 ? theme.downColor : theme.mutedText);
        // Hollow up, filled down (classic style)
        if (line.dir > 0) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 0.5, yTop + 0.5, lineW, h);
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(x, yTop, lineW, h);
        }
    }
    ctx.restore();
}

// ============================================================
// 4. KAGI
// ============================================================
/**
 * Kagi chart: a single continuous line whose thickness changes when
 * price breaks a prior high/low (yang → yin transition).
 * - Thick line = bullish (yang)
 * - Thin line = bearish (yin)
 */
export function drawKagi(ctx, vp, dm, theme) {
    const { highs, lows, closes } = dm.raw();
    const leftIdx = Math.max(0, Math.floor(vp.leftEdge));
    const rightIdx = Math.min(dm.size - 1, Math.ceil(vp.rightEdge));
    if (rightIdx <= leftIdx) return;

    // Determine reversal amount.
    let pMin = Infinity, pMax = -Infinity;
    for (let i = leftIdx; i <= rightIdx; i++) {
        if (lows[i] < pMin) pMin = lows[i];
        if (highs[i] > pMax) pMax = highs[i];
    }
    if (!isFinite(pMin) || !isFinite(pMax) || pMax <= pMin) return;
    const reversalAmount = (pMax - pMin) * 0.04; // 4% reversal

    // Build Kagi segments.
    const segments = [];
    let curPrice = closes[leftIdx];
    let curDir = 0; // 0=neutral, 1=up, -1=down
    let curThickness = 'thin'; // 'thin' = yin (bearish), 'thick' = yang (bullish)
    let extremePrice = curPrice; // tracks the high (if up) or low (if down)

    for (let i = leftIdx + 1; i <= rightIdx; i++) {
        const price = closes[i];
        if (curDir >= 0) {
            // Currently rising or neutral
            if (price > curPrice) {
                segments.push({ from: curPrice, to: price, thickness: curThickness });
                if (price > extremePrice) extremePrice = price;
                curPrice = price;
                curDir = 1;
            } else if (curPrice - price >= reversalAmount) {
                // Reversal — switch direction
                curDir = -1;
                curThickness = 'thin';
                segments.push({ from: curPrice, to: price, thickness: curThickness });
                extremePrice = price;
                curPrice = price;
            }
        } else {
            // Currently falling
            if (price < curPrice) {
                segments.push({ from: curPrice, to: price, thickness: curThickness });
                if (price < extremePrice) extremePrice = price;
                curPrice = price;
            } else if (price - curPrice >= reversalAmount) {
                // Reversal — switch direction
                curDir = 1;
                curThickness = 'thick';
                segments.push({ from: curPrice, to: price, thickness: curThickness });
                extremePrice = price;
                curPrice = price;
            }
        }
    }

    // Draw Kagi line — evenly spaced horizontally, but the line itself is
    // vertical (price-based). We draw it as a zigzag.
    ctx.save();
    const stepX = (vp.width - 80) / Math.max(1, segments.length);
    let x = 10;
    const thickColor = theme.upColor;
    const thinColor = theme.downColor;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const y1 = vp.priceToY(seg.from);
        const y2 = vp.priceToY(seg.to);
        const color = seg.thickness === 'thick' ? thickColor : thinColor;
        const width = seg.thickness === 'thick' ? 3 : 1.5;

        // Vertical line
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();

        // Horizontal connector to next segment
        if (i < segments.length - 1) {
            ctx.beginPath();
            ctx.moveTo(x, y2);
            ctx.lineTo(x + stepX, y2);
            ctx.stroke();
        }
        x += stepX;
    }
    ctx.restore();
}

// ============================================================
// 5. HEIKIN-ASHI SMOOTHED
// ============================================================
/**
 * Heikin-Ashi Smoothed: applies HA calculation, then smooths the
 * HA open/close with a 3-period EMA for cleaner trend visualization.
 */
export function drawHeikinAshiSmoothed(ctx, vp, dm, theme, manager) {
    // First compute regular Heikin-Ashi.
    const ha = manager._computeHeikinAshi(dm);
    if (!ha) return;

    // Apply EMA smoothing to HA open and close.
    const period = 3;
    const alpha = 2 / (period + 1);
    const n = dm.size;
    const smOpen = new Float64Array(n);
    const smClose = new Float64Array(n);
    const smHigh = new Float64Array(n);
    const smLow = new Float64Array(n);

    smOpen[0] = ha.opens[0];
    smClose[0] = ha.closes[0];
    smHigh[0] = ha.highs[0];
    smLow[0] = ha.lows[0];

    for (let i = 1; i < n; i++) {
        smOpen[i] = alpha * ha.opens[i] + (1 - alpha) * smOpen[i - 1];
        smClose[i] = alpha * ha.closes[i] + (1 - alpha) * smClose[i - 1];
        smHigh[i] = Math.max(ha.highs[i], smHigh[i - 1] * 0.5 + ha.highs[i] * 0.5);
        smLow[i] = Math.min(ha.lows[i], smLow[i - 1] * 0.5 + ha.lows[i] * 0.5);
    }

    // Draw as candles using the smoothed data.
    const leftIdx = Math.max(0, Math.floor(vp.leftEdge));
    const rightIdx = Math.min(n - 1, Math.ceil(vp.rightEdge));
    if (rightIdx < leftIdx) return;

    const barSpacing = vp.barSpacing;
    if (barSpacing < 1.5) {
        // Zoomed out — draw close line
        ctx.save();
        ctx.strokeStyle = theme.upColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let started = false;
        for (let i = leftIdx; i <= rightIdx; i++) {
            const x = vp.indexToX(i) + barSpacing / 2;
            const y = vp.priceToY(smClose[i]);
            if (!started) { ctx.moveTo(x, y); started = true; }
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
        return;
    }

    const bodyW = Math.max(1, barSpacing * 0.7);
    ctx.save();
    for (let i = leftIdx; i <= rightIdx; i++) {
        const o = smOpen[i], c = smClose[i], h = smHigh[i], l = smLow[i];
        const x = vp.indexToX(i) + barSpacing / 2;
        const isUp = c >= o;
        const color = isUp ? theme.upColor : theme.downColor;

        // Wick
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, vp.priceToY(h));
        ctx.lineTo(x + 0.5, vp.priceToY(l));
        ctx.stroke();

        // Body
        const yOpen = vp.priceToY(o);
        const yClose = vp.priceToY(c);
        const yTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(1, Math.abs(yClose - yOpen));
        ctx.fillStyle = color;
        ctx.fillRect(x - bodyW / 2, yTop, bodyW, bodyH);
    }
    ctx.restore();
}

// ============================================================
// 6. PATTERN DETECTION
// ============================================================
/**
 * Pattern Detection: draws regular candles, then overlays markers
 * for detected candlestick patterns:
 *   - Doji (open ≈ close)
 *   - Hammer (small body, long lower wick)
 *   - Shooting Star (small body, long upper wick)
 *   - Bullish Engulfing (large up body engulfs prior down)
 *   - Bearish Engulfing (large down body engulfs prior up)
 *   - Marubozu (no wicks)
 */
export function drawPatternDetection(ctx, vp, dm, theme, manager) {
    // First draw regular candles.
    manager._drawCandleVariant(ctx, vp, dm, theme, 'candles');

    const { opens, highs, lows, closes } = dm.raw();
    const leftIdx = Math.max(1, Math.floor(vp.leftEdge));
    const rightIdx = Math.min(dm.size - 1, Math.ceil(vp.rightEdge));
    if (rightIdx <= leftIdx) return;

    const barSpacing = vp.barSpacing;
    if (barSpacing < 3) return; // too zoomed out for markers

    ctx.save();
    ctx.font = "bold 9px 'Inter', sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = leftIdx; i <= rightIdx; i++) {
        const o = opens[i], h = highs[i], l = lows[i], c = closes[i];
        const prevO = opens[i - 1], prevC = closes[i - 1];
        const body = Math.abs(c - o);
        const range = h - l;
        const upperWick = h - Math.max(o, c);
        const lowerWick = Math.min(o, c) - l;
        const x = vp.indexToX(i) + barSpacing / 2;
        let label = null, color = null;
        const yHigh = vp.priceToY(h);

        // Doji: body < 10% of range
        if (range > 0 && body / range < 0.1) {
            label = 'D'; color = '#FFC107';
        }
        // Hammer: lower wick >= 2x body, upper wick small
        else if (body > 0 && lowerWick >= body * 2 && upperWick < body * 0.5) {
            label = 'H'; color = theme.upColor;
        }
        // Shooting Star: upper wick >= 2x body, lower wick small
        else if (body > 0 && upperWick >= body * 2 && lowerWick < body * 0.5) {
            label = 'SS'; color = theme.downColor;
        }
        // Bullish Engulfing: prev down, current up, current body engulfs prev body
        else if (prevC < prevO && c > o && c >= prevO && o <= prevC) {
            label = 'BE'; color = theme.upColor;
        }
        // Bearish Engulfing: prev up, current down, current body engulfs prev body
        else if (prevC > prevO && c < o && o >= prevC && c <= prevO) {
            label = 'BrE'; color = theme.downColor;
        }
        // Marubozu: no wicks (or very small)
        else if (range > 0 && body / range > 0.95) {
            label = 'M'; color = c >= o ? theme.upColor : theme.downColor;
        }

        if (label) {
            // Draw a small marker above the high.
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, yHigh - 8, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText(label, x, yHigh - 8);
        }
    }
    ctx.restore();
}

// Registry of advanced chart types and their draw functions.
// 'manager' is the ChartTypeManager instance (needed for HA-Smoothed
// and Pattern Detection which delegate to existing methods).
export const ADVANCED_CHART_TYPES = {
    renko:              (ctx, vp, dm, theme, mgr) => drawRenko(ctx, vp, dm, theme),
    pointAndFigure:     (ctx, vp, dm, theme, mgr) => drawPointAndFigure(ctx, vp, dm, theme),
    threeLineBreak:     (ctx, vp, dm, theme, mgr) => drawThreeLineBreak(ctx, vp, dm, theme),
    kagi:               (ctx, vp, dm, theme, mgr) => drawKagi(ctx, vp, dm, theme),
    heikinAshiSmoothed: (ctx, vp, dm, theme, mgr) => drawHeikinAshiSmoothed(ctx, vp, dm, theme, mgr),
    patternDetection:   (ctx, vp, dm, theme, mgr) => drawPatternDetection(ctx, vp, dm, theme, mgr)
};
