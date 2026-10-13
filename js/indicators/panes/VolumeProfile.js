/**
 * VolumeProfile.js — Horizontal volume histogram (last N bars only).
 *
 * CHANGED per user request:
 * - Only computes volume profile for the LAST 20 bars (not the entire
 *   visible range). This gives a "recent volume profile" that follows
 *   the latest price action.
 * - Draws the profile as STRIPS (thin horizontal bars) instead of
 *   filled rectangles — each price bucket gets a thin strip whose
 *   width is proportional to the volume at that level.
 * - Renders as an OVERLAY on top of the candles (not a separate pane).
 * - Also draws 3 prominent horizontal reference lines:
 *   - POC (Point of Control) — the price level with the highest volume.
 *   - VAH (Value Area High) — the upper price containing 70% of volume.
 *   - VAL (Value Area Low) — the lower price containing 70% of volume.
 */
import { IndicatorBase } from '../IndicatorBase.js';

export class VolumeProfile extends IndicatorBase {
    constructor(opts = {}) {
        super(opts);
        this.name = 'Volume Profile';
        this.type = 'overlay';
        this.color  = opts.color  || '#16C784'; // up volume
        this.color2 = opts.color2 || '#EA3943'; // down volume
        this.color3 = opts.color3 || '#FFC107'; // POC line
    }
    defaultOptions() { return { buckets: 24, recentBars: 20, barWidthRatio: 0.35, showValueArea: true }; }

    visibleRange(viewport, dm) { return null; }

    draw(ctx, viewport, dm, pane, theme) {
        this.ensureCalculated(dm);
        const { highs, lows, opens, closes, volumes } = dm.raw();
        const n = dm.size;
        if (n < 2) return;

        // Only use the LAST N bars (default 20) for the volume profile.
        const recentN = Math.min(this.options.recentBars || 20, n);
        const startIdx = n - recentN;
        const endIdx = n - 1;

        // Compute the price range for the last N bars.
        let pMin = Infinity, pMax = -Infinity;
        for (let i = startIdx; i <= endIdx; i++) {
            if (highs[i] > pMax) pMax = highs[i];
            if (lows[i]  < pMin) pMin = lows[i];
        }
        if (!isFinite(pMin) || !isFinite(pMax) || pMax <= pMin) {
            pMin = viewport.priceRange.min;
            pMax = viewport.priceRange.max;
            if (pMax <= pMin) return;
        }

        const NB = Math.max(2, this.options.buckets | 0);
        const bucketSize = (pMax - pMin) / NB;
        const upVol = new Float64Array(NB);
        const dnVol = new Float64Array(NB);
        for (let i = startIdx; i <= endIdx; i++) {
            const tp = (highs[i] + lows[i] + closes[i]) / 3;
            let b = Math.floor((tp - pMin) / bucketSize);
            if (b < 0) b = 0;
            if (b >= NB) b = NB - 1;
            const isUp = closes[i] >= opens[i];
            if (isUp) upVol[b] += volumes[i];
            else      dnVol[b] += volumes[i];
        }
        let maxVol = 0;
        let pocBucket = 0, pocVol = 0;
        for (let i = 0; i < NB; i++) {
            const total = upVol[i] + dnVol[i];
            if (total > maxVol) maxVol = total;
            if (total > pocVol) { pocVol = total; pocBucket = i; }
        }
        if (maxVol <= 0) return;

        // Compute Value Area (70% of total volume around POC).
        let totalVol = 0;
        for (let i = 0; i < NB; i++) totalVol += upVol[i] + dnVol[i];
        let vaLow = 0, vaHigh = NB - 1;
        if (this.options.showValueArea !== false && totalVol > 0) {
            let cumVol = upVol[pocBucket] + dnVol[pocBucket];
            let lo = pocBucket, hi = pocBucket;
            while (cumVol < totalVol * 0.70 && (lo > 0 || hi < NB - 1)) {
                const volLo = lo > 0 ? (upVol[lo - 1] + dnVol[lo - 1]) : -1;
                const volHi = hi < NB - 1 ? (upVol[hi + 1] + dnVol[hi + 1]) : -1;
                if (volHi >= volLo && volHi > 0) { hi++; cumVol += volHi; }
                else if (volLo > 0) { lo--; cumVol += volLo; }
                else break;
            }
            vaLow = lo; vaHigh = hi;
        }

        const chartW = viewport.width - 70; // chart area width (excludes price scale)
        const maxBarW = chartW * (this.options.barWidthRatio || 0.35);
        const stripH = Math.max(1, viewport.priceHeight / NB * 0.6);
        // Anchor the strips to the LEFT edge of the candle area (x=0),
        // growing RIGHTWARD — so they overlay ON TOP of the candles,
        // not stuck to the right-side price axis.
        const stripAnchorX = 0;

        ctx.save();
        // Draw strips — each bucket is a thin horizontal strip.
        for (let i = 0; i < NB; i++) {
            const priceLo = pMin + i * bucketSize;
            const priceHi = priceLo + bucketSize;
            const yMid = viewport.priceToY((priceLo + priceHi) / 2);
            // Up volume strip (from the left edge, growing right).
            const wUp = (upVol[i] / maxVol) * maxBarW;
            if (wUp > 0) {
                ctx.fillStyle = this._withAlpha(this.color, 0.45);
                ctx.fillRect(stripAnchorX, yMid - stripH / 2, wUp, stripH);
            }
            // Down volume strip (overlaid, slightly offset).
            const wDn = (dnVol[i] / maxVol) * maxBarW;
            if (wDn > 0) {
                ctx.fillStyle = this._withAlpha(this.color2, 0.45);
                ctx.fillRect(stripAnchorX, yMid + stripH / 2 - stripH, wDn, stripH);
            }
            // Outline the dominant side.
            const domW = Math.max(wUp, wDn);
            if (domW > 0) {
                ctx.strokeStyle = (upVol[i] >= dnVol[i]) ? this.color : this.color2;
                ctx.lineWidth = 0.5;
                ctx.strokeRect(stripAnchorX + 0.5, yMid - stripH / 2 + 0.5, domW, stripH);
            }
        }

        // --- 3 prominent reference lines ---
        // POC (Point of Control)
        const pocPrice = pMin + (pocBucket + 0.5) * bucketSize;
        const yPOC = viewport.priceToY(pocPrice);
        ctx.strokeStyle = this.color3;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, yPOC + 0.5);
        ctx.lineTo(chartW, yPOC + 0.5);
        ctx.stroke();
        // VAH (Value Area High)
        const vahPrice = pMin + (vaHigh + 1) * bucketSize;
        const yVAH = viewport.priceToY(vahPrice);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, yVAH + 0.5);
        ctx.lineTo(chartW, yVAH + 0.5);
        ctx.stroke();
        // VAL (Value Area Low)
        const valPrice = pMin + vaLow * bucketSize;
        const yVAL = viewport.priceToY(valPrice);
        ctx.strokeStyle = this.color2;
        ctx.beginPath();
        ctx.moveTo(0, yVAL + 0.5);
        ctx.lineTo(chartW, yVAL + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);

        // Labels on the right side (just inside the chart area).
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.color3;
        ctx.fillText('POC ' + this._fmtPrice(pocPrice), chartW - 4, yPOC - 6);
        ctx.fillStyle = this.color;
        ctx.fillText('VAH ' + this._fmtPrice(vahPrice), chartW - 4, yVAH - 6);
        ctx.fillStyle = this.color2;
        ctx.fillText('VAL ' + this._fmtPrice(valPrice), chartW - 4, yVAL + 6);

        ctx.restore();
    }

    _fmtPrice(p) {
        if (p >= 1000) return p.toFixed(0);
        if (p >= 1) return p.toFixed(2);
        return p.toFixed(4);
    }
}


