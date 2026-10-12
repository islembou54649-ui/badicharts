/**
 * VolumeProfile.js — Horizontal volume histogram (visible range only).
 *
 * CHANGED per user request: now an OVERLAY (renders on top of candles in the
 * main price pane) instead of a separate pane below. The bars still extend
 * from the left edge, but they're drawn with translucency so the candles
 * remain visible underneath.
 *
 * Bins the visible candle range into ~30 price buckets; for each bucket we
 * accumulate up volume (close >= open) and down volume (close < open)
 * separately. Draws horizontal bars from the left edge.
 */
import { IndicatorBase } from '../IndicatorBase.js';

export class VolumeProfile extends IndicatorBase {
    constructor(opts = {}) {
        super(opts);
        this.name = 'Volume Profile';
        this.type = 'overlay';  // CHANGED: was 'pane', now 'overlay'
        this.color  = opts.color  || '#16C784'; // up
        this.color2 = opts.color2 || '#EA3943'; // down
    }
    defaultOptions() { return { buckets: 30, barWidthRatio: 0.4 }; }

    /**
     * No autoscale: as an overlay we use the SAME price range as the candles.
     */
    visibleRange(viewport, dm) {
        return null;
    }

    draw(ctx, viewport, dm, pane, theme) {
        this.ensureCalculated(dm);
        const { highs, lows, opens, closes, volumes } = dm.raw();
        const leftIdx = Math.max(0, Math.floor(viewport.leftEdge));
        const rightIdx = Math.min(highs.length - 1, Math.ceil(viewport.rightEdge));
        if (rightIdx < leftIdx) return;

        // Visible price range (use the viewport's current range — same as candles).
        let pMin = Infinity, pMax = -Infinity;
        for (let i = leftIdx; i <= rightIdx; i++) {
            if (highs[i] > pMax) pMax = highs[i];
            if (lows[i]  < pMin) pMin = lows[i];
        }
        if (!isFinite(pMin) || !isFinite(pMax) || pMax <= pMin) {
            // Fallback to the viewport's range.
            pMin = viewport.priceRange.min;
            pMax = viewport.priceRange.max;
            if (pMax <= pMin) return;
        }

        const NB = Math.max(2, this.options.buckets | 0);
        const bucketSize = (pMax - pMin) / NB;
        const upVol = new Float64Array(NB);
        const dnVol = new Float64Array(NB);
        for (let i = leftIdx; i <= rightIdx; i++) {
            const tp = (highs[i] + lows[i] + closes[i]) / 3;
            let b = Math.floor((tp - pMin) / bucketSize);
            if (b < 0) b = 0;
            if (b >= NB) b = NB - 1;
            const isUp = closes[i] >= opens[i];
            if (isUp) upVol[b] += volumes[i];
            else      dnVol[b] += volumes[i];
        }
        let maxVol = 0;
        for (let i = 0; i < NB; i++) {
            if (upVol[i] > maxVol) maxVol = upVol[i];
            if (dnVol[i] > maxVol) maxVol = dnVol[i];
        }
        if (maxVol <= 0) return;

        const right = viewport.width - 70;
        const maxBarW = right * this.options.barWidthRatio;
        ctx.save();
        for (let i = 0; i < NB; i++) {
            const priceLo = pMin + i * bucketSize;
            const priceHi = priceLo + bucketSize;
            const yLo = viewport.priceToY(priceLo);
            const yHi = viewport.priceToY(priceHi);
            const yTop = Math.min(yLo, yHi);
            const h = Math.max(1, Math.abs(yLo - yHi) - 0.5);
            const wUp = (upVol[i] / maxVol) * maxBarW;
            if (wUp > 0) {
                ctx.fillStyle = this._withAlpha(this.color, 0.40);
                ctx.fillRect(0, yTop, wUp, h);
            }
            const wDn = (dnVol[i] / maxVol) * maxBarW;
            if (wDn > 0) {
                ctx.fillStyle = this._withAlpha(this.color2, 0.40);
                ctx.fillRect(0, yTop, wDn, h);
            }
            const domW = Math.max(wUp, wDn);
            if (domW > 0) {
                ctx.strokeStyle = (upVol[i] >= dnVol[i]) ? this.color : this.color2;
                ctx.lineWidth = 1;
                ctx.strokeRect(0.5, yTop + 0.5, domW - 1, h - 1);
            }
        }
        ctx.restore();
    }
}

