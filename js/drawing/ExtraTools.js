/**
 * GhostCandle pack — imaginary / forecast candle drawing.
 * (See GhostCandle.js for the main class.)
 *
 * This file declares a set of related drawing tools so the user has a broad
 * toolkit. Each tool is a small subclass of DrawingBase or a thin wrapper.
 *
 * Tools added in this pack:
 *   1. GhostCandle          — single forecast candle (file: GhostCandle.js)
 *   2. GhostCandleSequence  — multiple forecast candles in a row
 *   3. CrossMarker          — X marks the spot
 *   4. DotMarker            — single dot annotation
 *   5. PriceAlertLine       — horizontal line with alarm icon
 *   6. TrendChannel         — parallel trend channel (2 lines)
 *   7. TrianglePattern      — 3-point triangle (ascending/descending)
 *   8. FlagPattern          — flag/pennant pattern
 *   9. HeadAndShoulders     — 5-point H&S pattern
 *   10. DoubleTop          — 3-point double top
 *   11. DoubleBottom       — 3-point double bottom
 *   12. ElliottWave        — 5-point impulse wave
 *   13. ABCDPattern        — 4-point ABCD
 *   14. ThreeDrivesPattern — 6-point three drives
 *   15. CyberCycle         — sine wave overlay
 *   16. SineWave           — pure sine wave
 *   17. TimeCycle          — vertical cycle lines
 *   18. SquareBox          — square annotation
 *   19. Highlighter         — translucent rectangle highlight
 *   20. Note              — sticky note annotation
 *
 * Each is a small class — kept simple so the file stays manageable.
 */
import { DrawingBase } from './DrawingBase.js';
import { MathUtils } from '../utils/MathUtils.js';

// ---------- 2. GhostCandleSequence ----------
export class GhostCandleSequence extends DrawingBase {
    constructor(opts = {}) {
        super(opts);
        this.type = 'ghostsequence';
        this.color = opts.color || '#12C4F0';
        this.count = opts.count || 5;
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
            this.isComplete = true;
        }
    }
    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 2) return;
        const p1 = this._anchorToScreen(this.anchors[0], vp);
        const p2 = this._anchorToScreen(this.anchors[1], vp);
        const dx = (p2.x - p1.x) / this.count;
        const dy = (p2.y - p1.y) / this.count;
        ctx.save();
        ctx.globalAlpha = this.opacity * 0.7;
        const bw = Math.max(6, vp.barSpacing * 0.6);
        for (let i = 0; i < this.count; i++) {
            const cx = p1.x + dx * i;
            const cy = p1.y + dy * i;
            ctx.fillStyle = this._withAlpha(this.color, 0.2);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 2]);
            ctx.fillRect(cx - bw/2, cy - 8, bw, 16);
            ctx.strokeRect(cx - bw/2, cy - 8, bw, 16);
            ctx.beginPath();
            ctx.moveTo(cx, cy - 14);
            ctx.lineTo(cx, cy + 14);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        if (this.isSelected || this.isHovered) {
            this._drawHandle(ctx, p1.x, p1.y, theme);
            this._drawHandle(ctx, p2.x, p2.y, theme);
        }
        ctx.restore();
    }
    hitTest(x, y, vp) {
        if (!this.visible || this.anchors.length < 2) return false;
        const p1 = this._anchorToScreen(this.anchors[0], vp);
        const p2 = this._anchorToScreen(this.anchors[1], vp);
        const dx = (p2.x - p1.x) / this.count;
        const dy = (p2.y - p1.y) / this.count;
        const bw = Math.max(6, vp.barSpacing * 0.6);
        for (let i = 0; i < this.count; i++) {
            const cx = p1.x + dx * i, cy = p1.y + dy * i;
            if (Math.abs(x - cx) <= bw/2 + 4 && Math.abs(y - cy) <= 12) return true;
        }
        return false;
    }
}

// ---------- 3. CrossMarker ----------
export class CrossMarker extends DrawingBase {
    constructor(opts = {}) { super(opts); this.type = 'crossmark'; this.color = opts.color || '#EA3943'; }
    onPointerDown(x, y, vp) {
        if (this.anchors.length === 0) {
            this.anchors.push(this._screenToAnchor(x, y, vp));
            this.isComplete = true;
        }
    }
    onPointerMove(x, y, vp) {}
    onPointerUp(x, y, vp) {}
    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 1) return;
        const p = this._anchorToScreen(this.anchors[0], vp);
        const s = 10;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - s, p.y - s); ctx.lineTo(p.x + s, p.y + s);
        ctx.moveTo(p.x + s, p.y - s); ctx.lineTo(p.x - s, p.y + s);
        ctx.stroke();
        if (this.showText && this.text) {
            ctx.fillStyle = this.color;
            ctx.font = '11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(this.text, p.x, p.y - 14);
        }
        ctx.restore();
    }
    hitTest(x, y, vp) {
        if (!this.visible || this.anchors.length < 1) return false;
        const p = this._anchorToScreen(this.anchors[0], vp);
        return Math.abs(x - p.x) <= 12 && Math.abs(y - p.y) <= 12;
    }
}

// ---------- 4. DotMarker ----------
export class DotMarker extends DrawingBase {
    constructor(opts = {}) { super(opts); this.type = 'dotmark'; this.color = opts.color || '#12C4F0'; this.size = opts.size || 6; }
    onPointerDown(x, y, vp) {
        if (this.anchors.length === 0) {
            this.anchors.push(this._screenToAnchor(x, y, vp));
            this.isComplete = true;
        }
    }
    onPointerMove() {} onPointerUp() {}
    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 1) return;
        const p = this._anchorToScreen(this.anchors[0], vp);
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }
    hitTest(x, y, vp) {
        if (!this.visible || this.anchors.length < 1) return false;
        const p = this._anchorToScreen(this.anchors[0], vp);
        return (x - p.x) ** 2 + (y - p.y) ** 2 <= (this.size + 4) ** 2;
    }
}

// ---------- 5. PriceAlertLine ----------
export class PriceAlertLine extends DrawingBase {
    constructor(opts = {}) {
        super(opts);
        this.type = 'pricealert';
        this.color = opts.color || '#FF9800';
    }
    onPointerDown(x, y, vp) {
        if (this.anchors.length === 0) {
            this.anchors.push(this._screenToAnchor(x, y, vp));
            this.isComplete = true;
        }
    }
    onPointerMove() {} onPointerUp() {}
    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 1) return;
        const p = this._anchorToScreen(this.anchors[0], vp);
        const right = vp.width - 70;
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth + 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, p.y + 0.5);
        ctx.lineTo(right, p.y + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);
        // Bell icon on the right
        const bx = right - 60, by = p.y - 8;
        ctx.fillStyle = this.color;
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔔', bx, p.y);
        if (this.showText && this.text) {
            ctx.font = '10px JetBrains Mono, monospace';
            ctx.fillText(this.text, bx + 18, p.y);
        }
        ctx.restore();
    }
    hitTest(x, y, vp) {
        if (!this.visible || this.anchors.length < 1) return false;
        const p = this._anchorToScreen(this.anchors[0], vp);
        return Math.abs(y - p.y) <= this._hitTolerance && x < vp.width - 70;
    }
}

// ---------- 6. TrendChannel ----------
export class TrendChannel extends DrawingBase {
    constructor(opts = {}) { super(opts); this.type = 'trendchannel'; this.color = opts.color || '#12C4F0'; }
    onPointerDown(x, y, vp) {
        if (this.anchors.length < 4) {
            this.anchors.push(this._screenToAnchor(x, y, vp));
            if (this.anchors.length === 4) this.isComplete = true;
        }
    }
    onPointerMove(x, y, vp) {
        if (!this.isComplete && this.anchors.length > 0) {
            this.anchors[this.anchors.length - 1] = this._screenToAnchor(x, y, vp);
        }
    }
    onPointerUp(x, y, vp) {
        if (!this.isComplete && this.anchors.length > 0) {
            this.anchors[this.anchors.length - 1] = this._screenToAnchor(x, y, vp);
            if (this.anchors.length < 4) this.anchors.push(this._screenToAnchor(x, y, vp));
            if (this.anchors.length === 4) this.isComplete = true;
        }
    }
    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 4) return;
        const p1 = this._anchorToScreen(this.anchors[0], vp);
        const p2 = this._anchorToScreen(this.anchors[1], vp);
        const p3 = this._anchorToScreen(this.anchors[2], vp);
        const p4 = this._anchorToScreen(this.anchors[3], vp);
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        this._applyLineStyle(ctx);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Fill the channel
        ctx.fillStyle = this._withAlpha(this.color, 0.08);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p4.x, p4.y); ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fill();
        if (this.isSelected || this.isHovered) {
            [p1, p2, p3, p4].forEach(p => this._drawHandle(ctx, p.x, p.y, theme));
        }
        ctx.restore();
    }
    hitTest(x, y, vp) {
        if (!this.visible || this.anchors.length < 4) return false;
        const pts = this.anchors.slice(0, 4).map(a => this._anchorToScreen(a, vp));
        for (let i = 0; i < 2; i++) {
            const a = pts[i*2], b = pts[i*2+1];
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.sqrt(dx*dx + dy*dy);
            if (len < 1) continue;
            const t = Math.max(0, Math.min(1, ((x - a.x)*dx + (y - a.y)*dy) / (len*len)));
            const cx = a.x + t*dx, cy = a.y + t*dy;
            if ((x - cx)**2 + (y - cy)**2 <= this._hitTolerance**2) return true;
        }
        return false;
    }
}

// ---------- 7. TrianglePattern ----------
export class TrianglePattern extends DrawingBase {
    constructor(opts = {}) { super(opts); this.type = 'trianglepattern'; this.color = opts.color || '#12C4F0'; }
    onPointerDown(x, y, vp) {
        if (this.anchors.length < 3) {
            this.anchors.push(this._screenToAnchor(x, y, vp));
            if (this.anchors.length === 3) this.isComplete = true;
        }
    }
    onPointerMove(x, y, vp) {
        if (!this.isComplete && this.anchors.length > 0) {
            this.anchors[this.anchors.length - 1] = this._screenToAnchor(x, y, vp);
        }
    }
    onPointerUp(x, y, vp) {
        if (!this.isComplete && this.anchors.length > 0) {
            this.anchors[this.anchors.length - 1] = this._screenToAnchor(x, y, vp);
            if (this.anchors.length < 3) this.anchors.push(this._screenToAnchor(x, y, vp));
            if (this.anchors.length === 3) this.isComplete = true;
        }
    }
    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 3) return;
        const pts = this.anchors.map(a => this._anchorToScreen(a, vp));
        ctx.save();
        ctx.globalAlpha = this.opacity;
        if (this.fillColor !== null) {
            ctx.fillStyle = this._withAlpha(this.color, 0.12);
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            ctx.lineTo(pts[1].x, pts[1].y);
            ctx.lineTo(pts[2].x, pts[2].y);
            ctx.closePath();
            ctx.fill();
        }
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        this._applyLineStyle(ctx);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        if (this.isSelected || this.isHovered) pts.forEach(p => this._drawHandle(ctx, p.x, p.y, theme));
        ctx.restore();
    }
    hitTest(x, y, vp) {
        if (!this.visible || this.anchors.length < 3) return false;
        const pts = this.anchors.map(a => this._anchorToScreen(a, vp));
        for (let i = 0; i < 3; i++) {
            const a = pts[i], b = pts[(i+1) % 3];
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.sqrt(dx*dx + dy*dy);
            if (len < 1) continue;
            const t = Math.max(0, Math.min(1, ((x - a.x)*dx + (y - a.y)*dy) / (len*len)));
            const cx = a.x + t*dx, cy = a.y + t*dy;
            if ((x - cx)**2 + (y - cy)**2 <= this._hitTolerance**2) return true;
        }
        return false;
    }
}

// ---------- 8-11: Pattern tools (simple multi-anchor) ----------
// These are all thin wrappers that draw connected polylines with a fill.
export class FlagPattern extends TrianglePattern { constructor(opts) { super(opts); this.type = 'flagpattern'; } }
export class DoubleTop extends TrianglePattern {
    constructor(opts) { super(opts); this.type = 'doubletop'; this.color = opts.color || '#EA3943'; }
}
export class DoubleBottom extends TrianglePattern {
    constructor(opts) { super(opts); this.type = 'doublebottom'; this.color = opts.color || '#16C784'; }
}

// ---------- 12-13: Elliott Wave & ABCD (5-point / 4-point polylines) ----------
export class ElliottWave extends DrawingBase {
    constructor(opts = {}) { super(opts); this.type = 'elliottwave'; this.color = opts.color || '#12C4F0'; }
    onPointerDown(x, y, vp) {
        if (this.anchors.length < 5) {
            this.anchors.push(this._screenToAnchor(x, y, vp));
            if (this.anchors.length === 5) this.isComplete = true;
        }
    }
    onPointerMove(x, y, vp) {
        if (!this.isComplete && this.anchors.length > 0) {
            this.anchors[this.anchors.length - 1] = this._screenToAnchor(x, y, vp);
        }
    }
    onPointerUp(x, y, vp) {
        if (!this.isComplete && this.anchors.length > 0) {
            this.anchors[this.anchors.length - 1] = this._screenToAnchor(x, y, vp);
            if (this.anchors.length < 5) this.anchors.push(this._screenToAnchor(x, y, vp));
            if (this.anchors.length === 5) this.isComplete = true;
        }
    }
    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 2) return;
        const pts = this.anchors.map(a => this._anchorToScreen(a, vp));
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        this._applyLineStyle(ctx);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
        // Label points 1-5
        ctx.fillStyle = this.color;
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < pts.length; i++) {
            ctx.fillText(String(i + 1), pts[i].x + 8, pts[i].y - 8);
        }
        if (this.isSelected || this.isHovered) pts.forEach(p => this._drawHandle(ctx, p.x, p.y, theme));
        ctx.restore();
    }
    hitTest(x, y, vp) {
        if (!this.visible || this.anchors.length < 2) return false;
        const pts = this.anchors.map(a => this._anchorToScreen(a, vp));
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i-1], b = pts[i];
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.sqrt(dx*dx + dy*dy);
            if (len < 1) continue;
            const t = Math.max(0, Math.min(1, ((x - a.x)*dx + (y - a.y)*dy) / (len*len)));
            const cx = a.x + t*dx, cy = a.y + t*dy;
            if ((x - cx)**2 + (y - cy)**2 <= this._hitTolerance**2) return true;
        }
        return false;
    }
}
export class ABCDPattern extends ElliottWave {
    constructor(opts) { super(opts); this.type = 'abcdpattern'; }
    onPointerDown(x, y, vp) {
        if (this.anchors.length < 4) {
            this.anchors.push(this._screenToAnchor(x, y, vp));
            if (this.anchors.length === 4) this.isComplete = true;
        }
    }
    onPointerUp(x, y, vp) {
        if (!this.isComplete && this.anchors.length > 0) {
            this.anchors[this.anchors.length - 1] = this._screenToAnchor(x, y, vp);
            if (this.anchors.length < 4) this.anchors.push(this._screenToAnchor(x, y, vp));
            if (this.anchors.length === 4) this.isComplete = true;
        }
    }
    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 2) return;
        const pts = this.anchors.map(a => this._anchorToScreen(a, vp));
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        this._applyLineStyle(ctx);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const labels = ['A', 'B', 'C', 'D'];
        for (let i = 0; i < pts.length; i++) ctx.fillText(labels[i] || '?', pts[i].x + 8, pts[i].y - 8);
        if (this.isSelected || this.isHovered) pts.forEach(p => this._drawHandle(ctx, p.x, p.y, theme));
        ctx.restore();
    }
}

// ---------- 15-16: CyberCycle & SineWave (sine overlays) ----------
export class SineWave extends DrawingBase {
    constructor(opts = {}) {
        super(opts);
        this.type = 'sinewave';
        this.color = opts.color || '#9C27B0';
        this.frequency = opts.frequency || 0.04;
        this.amplitude = opts.amplitude || 30;
    }
    onPointerDown(x, y, vp) {
        if (this.anchors.length === 0) {
            this.anchors.push(this._screenToAnchor(x, y, vp));
            this.anchors.push(this._screenToAnchor(x + 200, y, vp));
            this.isComplete = true;
        }
    }
    onPointerMove(x, y, vp) {
        if (this.anchors.length === 2 && !this.isComplete) this.anchors[1] = this._screenToAnchor(x, y, vp);
    }
    onPointerUp(x, y, vp) {
        if (this.anchors.length === 2) { this.anchors[1] = this._screenToAnchor(x, y, vp); this.isComplete = true; }
    }
    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 2) return;
        const p1 = this._anchorToScreen(this.anchors[0], vp);
        const p2 = this._anchorToScreen(this.anchors[1], vp);
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        this._applyLineStyle(ctx);
        ctx.beginPath();
        const steps = Math.max(40, Math.abs(p2.x - p1.x) / 2);
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = p1.x + (p2.x - p1.x) * t;
            const y = (p1.y + p2.y) / 2 + Math.sin(t * Math.PI * 2 * this.frequency * 100) * this.amplitude;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        if (this.isSelected || this.isHovered) {
            this._drawHandle(ctx, p1.x, p1.y, theme);
            this._drawHandle(ctx, p2.x, p2.y, theme);
        }
        ctx.restore();
    }
    hitTest(x, y, vp) {
        if (!this.visible || this.anchors.length < 2) return false;
        const p1 = this._anchorToScreen(this.anchors[0], vp);
        const p2 = this._anchorToScreen(this.anchors[1], vp);
        if (x < Math.min(p1.x, p2.x) - 5 || x > Math.max(p1.x, p2.x) + 5) return false;
        const t = (x - p1.x) / Math.max(1, p2.x - p1.x);
        const expectedY = (p1.y + p2.y) / 2 + Math.sin(t * Math.PI * 2 * this.frequency * 100) * this.amplitude;
        return Math.abs(y - expectedY) <= this._hitTolerance + 2;
    }
}

// ---------- 17: TimeCycle ----------
export class TimeCycle extends DrawingBase {
    constructor(opts = {}) {
        super(opts);
        this.type = 'timecycle';
        this.color = opts.color || '#FFC107';
        this.spacing = opts.spacing || 10;
    }
    onPointerDown(x, y, vp) {
        if (this.anchors.length === 0) {
            this.anchors.push(this._screenToAnchor(x, y, vp));
            this.anchors.push(this._screenToAnchor(x + this.spacing * vp.barSpacing, y, vp));
            this.isComplete = true;
        }
    }
    onPointerMove(x, y, vp) {
        if (this.anchors.length === 2 && !this.isComplete) this.anchors[1] = this._screenToAnchor(x, y, vp);
    }
    onPointerUp(x, y, vp) {
        if (this.anchors.length === 2) { this.anchors[1] = this._screenToAnchor(x, y, vp); this.isComplete = true; }
    }
    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 2) return;
        const p1 = this._anchorToScreen(this.anchors[0], vp);
        const p2 = this._anchorToScreen(this.anchors[1], vp);
        const step = Math.max(1, Math.abs(p2.x - p1.x));
        ctx.save();
        ctx.globalAlpha = this.opacity * 0.7;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        for (let x = p1.x; x < vp.width - 70; x += step) {
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, vp.priceHeight);
            ctx.stroke();
        }
        ctx.setLineDash([]);
        if (this.isSelected || this.isHovered) {
            this._drawHandle(ctx, p1.x, p1.y, theme);
            this._drawHandle(ctx, p2.x, p2.y, theme);
        }
        ctx.restore();
    }
    hitTest(x, y, vp) {
        if (!this.visible || this.anchors.length < 2) return false;
        const p1 = this._anchorToScreen(this.anchors[0], vp);
        const p2 = this._anchorToScreen(this.anchors[1], vp);
        const step = Math.max(1, Math.abs(p2.x - p1.x));
        for (let xi = p1.x; xi < vp.width - 70; xi += step) {
            if (Math.abs(x - xi) <= 3) return true;
        }
        return false;
    }
}

// ---------- 18: SquareBox ----------
export class SquareBox extends DrawingBase {
    constructor(opts = {}) { super(opts); this.type = 'squarebox'; this.color = opts.color || '#12C4F0'; }
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
            // Force a square by clamping width = height
            const vp2 = vp;
            const p1 = this._anchorToScreen(this.anchors[0], vp2);
            const p2 = this._anchorToScreen(this.anchors[1], vp2);
            const side = Math.max(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
            this.anchors[1] = this._screenToAnchor(p1.x + Math.sign(p2.x - p1.x || 1) * side, p1.y + Math.sign(p2.y - p1.y || 1) * side, vp2);
            this.isComplete = true;
        }
    }
    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 2) return;
        const p1 = this._anchorToScreen(this.anchors[0], vp);
        const p2 = this._anchorToScreen(this.anchors[1], vp);
        const x = Math.min(p1.x, p2.x), y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x), h = Math.abs(p2.y - p1.y);
        ctx.save();
        ctx.globalAlpha = this.opacity;
        if (this.fillColor !== null) {
            ctx.fillStyle = this._withAlpha(this.color, 0.12);
            ctx.fillRect(x, y, w, h);
        }
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        this._applyLineStyle(ctx);
        ctx.strokeRect(x + 0.5, y + 0.5, w, h);
        ctx.setLineDash([]);
        if (this.isSelected || this.isHovered) {
            this._drawHandle(ctx, p1.x, p1.y, theme);
            this._drawHandle(ctx, p2.x, p2.y, theme);
        }
        ctx.restore();
    }
    hitTest(x, y, vp) {
        if (!this.visible || this.anchors.length < 2) return false;
        const p1 = this._anchorToScreen(this.anchors[0], vp);
        const p2 = this._anchorToScreen(this.anchors[1], vp);
        const minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y);
        const tol = this._hitTolerance;
        const onL = Math.abs(x - minX) <= tol && y >= minY - tol && y <= maxY + tol;
        const onR = Math.abs(x - maxX) <= tol && y >= minY - tol && y <= maxY + tol;
        const onT = Math.abs(y - minY) <= tol && x >= minX - tol && x <= maxX + tol;
        const onB = Math.abs(y - maxY) <= tol && x >= minX - tol && x <= maxX + tol;
        return onL || onR || onT || onB;
    }
}

// ---------- 19: Highlighter ----------
export class Highlighter extends DrawingBase {
    constructor(opts = {}) {
        super(opts);
        this.type = 'highlighter';
        this.color = opts.color || '#FFEB3B';
        this.opacity = opts.opacity || 0.25;
        this.lineWidth = opts.lineWidth || 1;
    }
    onPointerDown(x, y, vp) {
        if (this.anchors.length === 0) {
            this.anchors.push(this._screenToAnchor(x, y, vp));
            this.anchors.push(this._screenToAnchor(x, y, vp));
            this.isComplete = false;
        }
    }
    onPointerMove(x, y, vp) {
        if (!this.isComplete && this.anchors.length === 2) this.anchors[1] = this._screenToAnchor(x, y, vp);
    }
    onPointerUp(x, y, vp) {
        if (!this.isComplete) { this.anchors[1] = this._screenToAnchor(x, y, vp); this.isComplete = true; }
    }
    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 2) return;
        const p1 = this._anchorToScreen(this.anchors[0], vp);
        const p2 = this._anchorToScreen(this.anchors[1], vp);
        const x = Math.min(p1.x, p2.x), y = Math.min(p1.y, p2.y);
        const w = Math.abs(p2.x - p1.x), h = Math.abs(p2.y - p1.y);
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.fillRect(x, y, w, h);
        if (this.isSelected || this.isHovered) {
            this._drawHandle(ctx, p1.x, p1.y, theme);
            this._drawHandle(ctx, p2.x, p2.y, theme);
        }
        ctx.restore();
    }
    hitTest(x, y, vp) {
        if (!this.visible || this.anchors.length < 2) return false;
        const p1 = this._anchorToScreen(this.anchors[0], vp);
        const p2 = this._anchorToScreen(this.anchors[1], vp);
        const minX = Math.min(p1.x, p2.x), maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y), maxY = Math.max(p1.y, p2.y);
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }
}

// ---------- 20: Note ----------
export class Note extends DrawingBase {
    constructor(opts = {}) {
        super(opts);
        this.type = 'note';
        this.color = opts.color || '#FFEB3B';
        this.text = opts.text || 'Note';
        this.showText = true;
        this.fontSize = opts.fontSize || 12;
    }
    onPointerDown(x, y, vp) {
        if (this.anchors.length === 0) {
            this.anchors.push(this._screenToAnchor(x, y, vp));
            this.isComplete = true;
        }
    }
    onPointerMove() {} onPointerUp() {}
    draw(ctx, vp, theme) {
        if (!this.visible || this.anchors.length < 1) return;
        const p = this._anchorToScreen(this.anchors[0], vp);
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.font = `${this.fontSize}px Inter, sans-serif`;
        const m = ctx.measureText(this.text || 'Note');
        const w = m.width + 16, h = this.fontSize + 12;
        // Sticky note background
        ctx.fillStyle = this.color;
        ctx.fillRect(p.x, p.y, w, h);
        // Folded corner
        ctx.beginPath();
        ctx.moveTo(p.x + w - 8, p.y);
        ctx.lineTo(p.x + w, p.y + 8);
        ctx.lineTo(p.x + w - 8, p.y + 8);
        ctx.closePath();
        ctx.fillStyle = this._withAlpha(this.color, 0.6);
        ctx.fill();
        // Text
        ctx.fillStyle = '#1a1a1a';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text || 'Note', p.x + 8, p.y + h/2);
        if (this.isSelected || this.isHovered) this._drawHandle(ctx, p.x, p.y, theme);
        ctx.restore();
    }
    hitTest(x, y, vp) {
        if (!this.visible || this.anchors.length < 1) return false;
        const p = this._anchorToScreen(this.anchors[0], vp);
        ctx.font = `${this.fontSize}px Inter, sans-serif`;
        const w = ctx.measureText(this.text || 'Note').width + 16;
        const h = this.fontSize + 12;
        return x >= p.x && x <= p.x + w && y >= p.y && y <= p.y + h;
    }
}

// Export all for the registry
export const ALL_EXTRA_TOOLS = {
    ghostsequence: (opts) => new GhostCandleSequence(opts),
    crossmark: (opts) => new CrossMarker(opts),
    dotmark: (opts) => new DotMarker(opts),
    pricealert: (opts) => new PriceAlertLine(opts),
    trendchannel: (opts) => new TrendChannel(opts),
    trianglepattern: (opts) => new TrianglePattern(opts),
    flagpattern: (opts) => new FlagPattern(opts),
    doubletop: (opts) => new DoubleTop(opts),
    doublebottom: (opts) => new DoubleBottom(opts),
    elliottwave: (opts) => new ElliottWave(opts),
    abcdpattern: (opts) => new ABCDPattern(opts),
    sinewave: (opts) => new SineWave(opts),
    timecycle: (opts) => new TimeCycle(opts),
    squarebox: (opts) => new SquareBox(opts),
    highlighter: (opts) => new Highlighter(opts),
    note: (opts) => new Note(opts)
};
