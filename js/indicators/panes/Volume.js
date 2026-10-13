/**
 * Volume.js — Volume pane.
 *
 * Renders volume as STRIPS (thin vertical bars) for the last N bars.
 * Also draws 3 prominent horizontal reference lines at the volume levels:
 *   - High (max volume in visible range)
 *   - Average
 *   - Low (min positive volume in visible range)
 *
 * The "last N bars" feature highlights the most recent volume bars with
 * brighter colors and a subtle glow, so the user can focus on recent
 * volume activity.
 */
import { IndicatorBase } from '../IndicatorBase.js';

export class Volume extends IndicatorBase {
    constructor(opts = {}) {
        super(opts);
        this.name = 'Volume';
        this.type = 'pane';
        this.color  = opts.color  || '#16C784'; // up
        this.color2 = opts.color2 || '#EA3943'; // down
        this.color3 = opts.color3 || '#12C4F0'; // highlight (MA line)
    }
    defaultOptions() { return { recentBars: 20, showRefLines: true }; }

    calculate(dm) {
        const { volumes } = dm.raw();
        this.buffers.volume = volumes;
    }

    visibleRange(viewport, dm) {
        this.ensureCalculated(dm);
        const buf = this.buffers.volume;
        if (!buf) return { min: 0, max: 1 };
        const left = Math.max(0, Math.floor(viewport.leftEdge));
        const right = Math.min(buf.length - 1, Math.ceil(viewport.rightEdge));
        let max = 0;
        for (let i = left; i <= right; i++) {
            const v = buf[i];
            if (isFinite(v) && v > max) max = v;
        }
        if (max === 0) max = 1;
        return { min: 0, max: max * 1.15 };
    }

    draw(ctx, viewport, dm, pane, theme) {
        this.ensureCalculated(dm);
        const buf = this.buffers.volume;
        if (!buf) return;
        const { opens, closes } = dm.raw();
        const leftIdx = Math.max(0, Math.floor(viewport.leftEdge));
        const rightIdx = Math.min(buf.length - 1, Math.ceil(viewport.rightEdge));
        const y0 = this._priceToY(0, viewport, pane);
        const bw = Math.max(1, viewport.barSpacing * 0.7);
        const recentN = this.options.recentBars || 20;
        const recentStart = Math.max(leftIdx, buf.length - recentN);

        ctx.save();
        this._clipToPane(ctx, viewport, pane);

        // --- Draw ALL volume bars as STRIPS (thin rectangles) ---
        for (let i = leftIdx; i <= rightIdx; i++) {
            const v = buf[i];
            if (!isFinite(v) || v <= 0) continue;
            const yv = this._priceToY(v, viewport, pane);
            const x = viewport.indexToX(i) + viewport.barSpacing / 2;
            const up = closes[i] >= opens[i];
            const isRecent = i >= recentStart;
            // Recent bars: brighter + glow; older bars: dimmed.
            const alpha = isRecent ? 0.9 : 0.35;
            ctx.fillStyle = this._withAlpha(up ? this.color : this.color2, alpha);
            if (isRecent) {
                ctx.shadowColor = up ? this.color : this.color2;
                ctx.shadowBlur = 4;
            } else {
                ctx.shadowBlur = 0;
            }
            ctx.fillRect(x - bw / 2, yv, bw, Math.max(0, y0 - yv));
        }
        ctx.shadowBlur = 0;

        // --- 3 prominent horizontal reference lines ---
        if (this.options.showRefLines !== false && rightIdx >= leftIdx) {
            let volMax = 0, volMin = Infinity, volSum = 0, volCount = 0;
            for (let i = leftIdx; i <= rightIdx; i++) {
                const v = buf[i];
                if (isFinite(v) && v > 0) {
                    if (v > volMax) volMax = v;
                    if (v < volMin) volMin = v;
                    volSum += v;
                    volCount++;
                }
            }
            if (volCount > 0 && volMax > 0) {
                const volAvg = volSum / volCount;
                const lines = [
                    { value: volMax, color: this.color2, label: 'High' },
                    { value: volAvg, color: this.color3, label: 'Avg' },
                    { value: volMin === Infinity ? 0 : volMin, color: this.color, label: 'Low' }
                ];
                ctx.lineWidth = 1.2;
                ctx.setLineDash([5, 4]);
                ctx.font = "9px 'JetBrains Mono', monospace";
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                for (const ln of lines) {
                    const y = this._priceToY(ln.value, viewport, pane);
                    ctx.strokeStyle = ln.color;
                    ctx.beginPath();
                    ctx.moveTo(0, y + 0.5);
                    ctx.lineTo(viewport.width - 70, y + 0.5);
                    ctx.stroke();
                    // Label
                    ctx.fillStyle = ln.color;
                    ctx.fillText(ln.label + ': ' + this._fmtVol(ln.value), 4, y - 6);
                }
                ctx.setLineDash([]);
            }
        }
        ctx.restore();
    }

    _fmtVol(v) {
        if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
        if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
        if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
        return v.toFixed(0);
    }
}

