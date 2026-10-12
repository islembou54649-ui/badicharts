/**
 * GhostCandle.js — A custom-drawn candle that doesn't exist in the data.
 *
 * The user draws it on the chart to visualize a hypothetical / forecast /
 * imaginary candle (e.g. "if price closes here..."). Two anchors:
 *   - Anchor 0: top of the candle (high)
 *   - Anchor 1: bottom of the candle (low)
 * Open / close are inferred from the anchor order (drag down = bearish,
 * drag up = bullish), but can be toggled via the 'direction' option.
 *
 * The candle is drawn semi-transparently with a dashed outline so it's
 * clearly a "ghost" / forecast candle, not a real one.
 */
import { DrawingBase } from './DrawingBase.js';

export class GhostCandle extends DrawingBase {
    constructor(opts = {}) {
        super(opts);
        this.type = 'ghostcandle';
        this.color = opts.color || '#12C4F0';
        this.fillColor = opts.fillColor || null;
        this.direction = opts.direction || 'auto'; // 'auto' | 'up' | 'down'
        // When the user drags upward (anchor 0 below anchor 1), treat as up candle.
    }

    onPointerDown(x, y, vp) {
        if (this.anchors.length === 0) {
            this.anchors.push(this._screenToAnchor(x, y, vp));
            this.anchors.push(this._screenToAnchor(x, y, vp));
            this.isComplete = false;
        }
    }
    onPointerMove(x, y, vp) {
        if (!this.isComplete && this.anchors.length === 2) {
            this.anchors[1] = this._screenToAnchor(x, y, vp);
        }
    }
    onPointerUp(x, y, vp) {
        if (!this.isComplete) {
            this.anchors[1] = this._screenToAnchor(x, y, vp);
            // If the drag was too small, give the candle a default height.
            const p0 = this._anchorToScreen(this.anchors[0], vp);
            const p1 = this._anchorToScreen(this.anchors[1], vp);
            if (Math.abs(p1.y - p0.y) < 8) {
                this.anchors[1] = this._screenToAnchor(x, y - 30, vp);
            }
            this.isComplete = true;
        }
    }

    /**
     * Compute OHLC from the two anchors.
     *  - high = max(anchor0.price, anchor1.price)
     *  - low  = min(...)
     *  - open = the anchor that was placed first (anchor 0)
     *  - close = the anchor that was placed second (anchor 1)
     *  - direction 'up'/'down' overrides the open/close assignment.
     */
    _getOHLC() {
        const a0 = this.anchors[0].price;
        const a1 = this.anchors[1].price;
        const high = Math.max(a0, a1);
        const low = Math.min(a0, a1);
        let open, close;
        if (this.direction === 'up') {
            open = low; close = high;
        } else if (this.direction === 'down') {
            open = high; close = low;
        } else {
            // auto: open = first anchor, close = second
            open = a0; close = a1;
        }
        return { open, high, low, close };
    }

    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 2) return;
        const p1 = this._anchorToScreen(this.anchors[0], vp);
        const p2 = this._anchorToScreen(this.anchors[1], vp);
        const xCenter = (p1.x + p2.x) / 2;
        const highY = Math.min(p1.y, p2.y);
        const lowY = Math.max(p1.y, p2.y);
        const bodyTop = vp.priceToY(Math.max(this._getOHLC().open, this._getOHLC().close));
        const bodyBot = vp.priceToY(Math.min(this._getOHLC().open, this._getOHLC().close));
        const isUp = this._getOHLC().close >= this._getOHLC().open;
        const color = isUp ? (this.color || '#16C784') : (this.color2 || this.color || '#EA3943');
        const bodyW = Math.max(8, vp.barSpacing * 0.7);

        ctx.save();
        ctx.globalAlpha = this.opacity * 0.85;

        // Wick (top to bottom)
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xCenter + 0.5, highY);
        ctx.lineTo(xCenter + 0.5, lowY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Body — dashed outline + translucent fill
        const bx = xCenter - bodyW / 2;
        const by = Math.min(bodyTop, bodyBot);
        const bh = Math.max(2, Math.abs(bodyBot - bodyTop));
        if (this.fillColor !== null) {
            ctx.fillStyle = this._withAlpha(color, 0.25);
            ctx.fillRect(bx, by, bodyW, bh);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(bx + 0.5, by + 0.5, bodyW, bh);
        ctx.setLineDash([]);

        // Label
        if (this.showText && this.text) {
            ctx.fillStyle = color;
            ctx.font = `${this.fontSize}px 'Inter', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(this.text, xCenter, highY - 4);
        }

        // Handles
        if (this.isSelected || this.isHovered || !this.isComplete) {
            this._drawHandle(ctx, p1.x, p1.y, theme);
            this._drawHandle(ctx, p2.x, p2.y, theme);
        }
        ctx.restore();
    }

    hitTest(x, y, vp) {
        if (!this.visible || this.anchors.length < 2) return false;
        const p1 = this._anchorToScreen(this.anchors[0], vp);
        const p2 = this._anchorToScreen(this.anchors[1], vp);
        const xCenter = (p1.x + p2.x) / 2;
        const bodyW = Math.max(8, vp.barSpacing * 0.7);
        const highY = Math.min(p1.y, p2.y);
        const lowY = Math.max(p1.y, p2.y);
        // Hit on the wick
        if (Math.abs(x - xCenter) <= this._hitTolerance && y >= highY - 2 && y <= lowY + 2) return true;
        // Hit on the body
        if (Math.abs(x - xCenter) <= bodyW / 2 + 2 && y >= highY - 2 && y <= lowY + 2) return true;
        return false;
    }
}
