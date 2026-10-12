/**
 * Watermark.js
 * Renders the BadiCharts logo as a static, non-interactive watermark in the
 * bottom-left corner of the main chart pane.
 *
 * Design notes:
 * - The watermark is drawn directly on the shared canvas (same canvas as the
 *   candles/gridlines). It is therefore BELOW the crosshair, drawings, and
 *   info strips — it never obscures the data the trader is interacting with.
 * - The brand colors (cyan → blue gradient) are taken from the official
 *   BadiCharts identity (#12C4F0 → #3B6CF5) and are reused for the icon.
 * - The wordmark "BadiCharts" and the tagline "Charting Engine" are tinted
 *   with the current theme's text color, so the watermark blends with the
 *   chart background instead of always being pure white.
 * - Opacity is ~0.18 so the watermark is subtle but visible.
 *
 * The watermark is drawn on top of the chart background but below the candles,
 * so it appears as a "ghosted" logo embedded into the chart surface itself.
 */
export class Watermark {
    constructor(options = {}) {
        this.opacity = options.opacity ?? 0.18;
        // Brand gradient — do NOT touch, this is the official BadiCharts identity.
        this.gradientFrom = '#12C4F0';
        this.gradientTo = '#3B6CF5';
        // Horizontal padding from the left edge of the chart, plus a small
        // bottom padding so the watermark sits comfortably above the time axis.
        this.paddingLeft = options.paddingLeft ?? 14;
        this.paddingBottom = options.paddingBottom ?? 6;
        // Pixel scale factor — larger = bigger logo.
        this.scale = options.scale ?? 0.85;
    }

    /**
     * Draw the watermark on the supplied 2D context. Should be called AFTER
     * the chart background fill but BEFORE candles are drawn, so candles
     * always render on top of the watermark.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {{x:number,y:number,w:number,h:number}} mainRegion - main pane rect
     * @param {object} theme - the active Theme object (Theme.js)
     */
    draw(ctx, mainRegion, theme) {
        const x0 = mainRegion.x + this.paddingLeft;
        // Anchor to the BOTTOM of the main pane (above the time axis strip).
        const baseH = 64 * this.scale;
        const y0 = mainRegion.y + mainRegion.h - baseH - this.paddingBottom;

        ctx.save();
        ctx.globalAlpha = this.opacity;

        // ---- Brand icon (left) ----
        // A stylized candlestick with arrows, mirroring the BadiCharts identity.
        // Built from primitives so it scales crisply on every DPI.
        const iconW = 70 * this.scale;
        const iconH = 64 * this.scale;
        const ix = x0;
        const iy = y0;

        // gradient stroke for the icon lines
        const grad = ctx.createLinearGradient(ix, 0, ix + iconW, 0);
        grad.addColorStop(0, this.gradientFrom);
        grad.addColorStop(1, this.gradientTo);
        ctx.strokeStyle = grad;
        ctx.fillStyle = this.gradientFrom;
        ctx.lineWidth = 4 * this.scale;
        ctx.lineCap = 'round';

        // Helper: stroke a path of points
        const strokePath = (pts) => {
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.stroke();
        };

        // First candle body + wicks (left)
        const c1x = ix + 18 * this.scale;
        const c1Top = iy + 6 * this.scale;
        const c1Bot = iy + 50 * this.scale;
        // wick top
        strokePath([[c1x, iy + 0], [c1x, c1Top]]);
        // wick bottom
        strokePath([[c1x, c1Bot], [c1x, iy + 60 * this.scale]]);
        // body (filled rect with rounded corners)
        this._roundRect(ctx, c1x - 8 * this.scale, c1Top, 16 * this.scale, c1Bot - c1Top, 3 * this.scale);
        ctx.fill();
        // left horizontal connector
        strokePath([[ix + 0, iy + 24 * this.scale], [c1x, iy + 24 * this.scale]]);
        // right horizontal connector
        strokePath([[c1x, iy + 44 * this.scale], [c1x + 14 * this.scale, iy + 44 * this.scale]]);

        // Second candle body + wicks (right, taller)
        const c2x = ix + 50 * this.scale;
        const c2Top = iy + 14 * this.scale;
        const c2Bot = iy + 48 * this.scale;
        // wick top
        strokePath([[c2x, iy + 2 * this.scale], [c2x, c2Top]]);
        // wick bottom
        strokePath([[c2x, c2Bot], [c2x, iy + 58 * this.scale]]);
        // body
        ctx.fillStyle = this.gradientTo;
        this._roundRect(ctx, c2x - 8 * this.scale, c2Top, 16 * this.scale, c2Bot - c2Top, 3 * this.scale);
        ctx.fill();
        // right horizontal connectors
        strokePath([[c2x, iy + 22 * this.scale], [c2x - 12 * this.scale, iy + 22 * this.scale]]);
        strokePath([[c2x, iy + 40 * this.scale], [c2x + 12 * this.scale, iy + 40 * this.scale]]);

        // ---- Wordmark "BadiCharts" ----
        const textX = ix + iconW + 8 * this.scale;
        const textY = y0 + 30 * this.scale;

        // Use the brand gradient for the wordmark text too.
        ctx.font = `700 ${Math.round(26 * this.scale)}px Inter, 'Segoe UI', Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const textGrad = ctx.createLinearGradient(textX, 0, textX + 200 * this.scale, 0);
        textGrad.addColorStop(0, this.gradientFrom);
        textGrad.addColorStop(1, this.gradientTo);
        ctx.fillStyle = textGrad;
        ctx.fillText('BadiCharts', textX, textY);

        // ---- Tagline "Charting Engine" ----
        const tagX = textX + 1 * this.scale;
        const tagY = textY + 18 * this.scale;
        ctx.font = `500 ${Math.round(11 * this.scale)}px Inter, 'Segoe UI', Arial, sans-serif`;
        // Tint with the theme's text color so it adapts to dark/light backgrounds.
        ctx.fillStyle = theme.mutedText || theme.textColor;
        ctx.fillText('Charting Engine', tagX, tagY);

        ctx.restore();
    }

    /**
     * Draw a rounded rectangle path on the supplied context (no fill/stroke).
     * @private
     */
    _roundRect(ctx, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
    }
}
