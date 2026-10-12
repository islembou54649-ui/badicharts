/**
 * DrawingSettingsCard.js
 * Compact horizontal popup card that appears when a drawing is selected.
 *
 * Layout (TradingView-inspired):
 *   [✕] | [● color palette with "no fill" option] | Width: ━━●━━ |
 *   Style: [Solid▾] | Text: [____] [👁] | [⧉ Clone] [🗑 Delete]
 *
 * Features:
 * - Color palette: 10 colors in a card layout (like TradingView).
 *   The FIRST swatch is a "no fill" toggle (⊘) — clicking it removes the
 *   interior fill and makes the drawing use ONLY the line color.
 * - "Extend line" toggle (⟶) is kept.
 * - Lock icon was REMOVED per user request.
 * - Clone button duplicates the drawing at a small offset, same size/position.
 * - Delete icon is a clean trash can (canvas-drawn SVG icon, not emoji).
 */
import { DomUtils } from '../utils/DomUtils.js';

// TradingView-style palette: a curated set of 9 colors.
const PALETTE = [
    '#12C4F0', // brand cyan
    '#3B6CF5', // brand blue
    '#16C784', // up green
    '#EA3943', // down red
    '#FF9800', // orange
    '#9C27B0', // purple
    '#FFC107', // amber
    '#00BCD4', // teal
    '#FFFFFF'  // white
];

const LINE_STYLES = [
    { value: 'solid', label: '——' },
    { value: 'dashed', label: '– –' },
    { value: 'dotted', label: '···' },
    { value: 'long-dash', label: '— –' }
];

export class DrawingSettingsCard {
    constructor(container, engine) {
        this.container = container;
        this.engine = engine;
        this.drawing = null;
        this.element = DomUtils.el('div', { class: 'ac-settings-card-h', style: 'display:none' });
        container.appendChild(this.element);
        this._build();
        engine.drawingManager.onSelectionChange = (d) => {
            if (d) this.show(d);
            else this.hide();
        };
        // Hide when clicking outside the card
        document.addEventListener('pointerdown', (e) => {
            if (!this.drawing) return;
            if (e.target.closest('.ac-settings-card-h')) return;
        });
    }

    _build() {
        this.element.innerHTML = `
            <button class="ac-sch-close" title="Close">×</button>
            <div class="ac-sch-group ac-sch-color-group">
                <span class="ac-sch-label">Color</span>
                <div class="ac-sch-palette" data-field="color"></div>
            </div>
            <div class="ac-sch-sep"></div>
            <div class="ac-sch-group">
                <span class="ac-sch-label">Width</span>
                <input type="range" min="1" max="6" step="0.5" class="ac-sch-range" data-field="lineWidth" title="Line width">
            </div>
            <div class="ac-sch-sep"></div>
            <div class="ac-sch-group">
                <span class="ac-sch-label">Style</span>
                <select class="ac-sch-select" data-field="lineStyle">
                    ${LINE_STYLES.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
                </select>
            </div>
            <div class="ac-sch-sep"></div>
            <div class="ac-sch-group">
                <span class="ac-sch-label">Text</span>
                <input type="text" class="ac-sch-text" data-field="text" placeholder="Label..." maxlength="40">
                <label class="ac-sch-checkbox" title="Show text"><input type="checkbox" data-field="showText"></label>
            </div>
            <div class="ac-sch-sep"></div>
            <div class="ac-sch-group ac-sch-toggles">
                <label class="ac-sch-checkbox" title="Extend line"><input type="checkbox" data-field="extend"> ⟶</label>
            </div>
            <div class="ac-sch-sep"></div>
            <div class="ac-sch-actions">
                <button class="ac-sch-btn ac-sch-btn-clone" title="Clone (duplicate)" data-action="clone">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="5" y="5" width="9" height="9" rx="1.5"/>
                        <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2H3.5A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/>
                    </svg>
                </button>
                <button class="ac-sch-btn ac-sch-btn-danger" title="Delete" data-action="delete">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5l.5 8a1 1 0 0 0 1 .9h4a1 1 0 0 0 1-.9l.5-8M7 7v4M9 7v4"/>
                    </svg>
                </button>
            </div>
        `;
        // Build color palette — first swatch is "no fill"
        const pal = this.element.querySelector('[data-field="color"]');
        // "No fill" toggle (only relevant for shape drawings that have fillColor)
        const noFillSw = DomUtils.el('button', {
            class: 'ac-sch-swatch ac-sch-swatch-nofill',
            title: 'No fill (use line color only)',
            dataset: { color: '__NO_FILL__' }
        });
        noFillSw.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="6" cy="6" r="4.5"/><path d="M3 3l6 6"/></svg>`;
        noFillSw.addEventListener('click', () => this._setFillMode('none'));
        pal.appendChild(noFillSw);
        // Regular color swatches
        for (const c of PALETTE) {
            const sw = DomUtils.el('button', {
                class: 'ac-sch-swatch',
                style: `background:${c}`,
                dataset: { color: c }
            });
            sw.addEventListener('click', () => this._setColor(c));
            pal.appendChild(sw);
        }
        // Wire other inputs
        this.element.querySelectorAll('[data-field]').forEach(el => {
            if (el.classList.contains('ac-sch-swatch')) return;
            if (el.classList.contains('ac-sch-palette')) return;
            const field = el.dataset.field;
            const evt = (el.tagName === 'SELECT') ? 'change' : 'input';
            el.addEventListener(evt, () => {
                const v = el.type === 'checkbox' ? el.checked : el.value;
                this._setField(field, v);
            });
        });
        // Action buttons
        this.element.querySelector('.ac-sch-close').addEventListener('click', () => this.hide());
        this.element.querySelector('[data-action="delete"]').addEventListener('click', () => this._delete());
        this.element.querySelector('[data-action="clone"]').addEventListener('click', () => this._clone());
    }

    /**
     * Set the LINE color. Also updates the fill color to match (with alpha)
     * unless the user has explicitly chosen "no fill".
     */
    _setColor(c) {
        if (!this.drawing) return;
        this.drawing.color = c;
        // If the drawing supports a fill color, sync it too — UNLESS the user
        // has explicitly disabled fill (fillColor === null).
        if ('fillColor' in this.drawing) {
            if (this.drawing.fillColor !== null) {
                this.drawing.fillColor = c;
            }
            // else: keep fill disabled (null) — line color only.
        }
        this._syncDisplay();
        this.engine.requestRender();
    }

    /**
     * Toggle between "no fill" (line color only) and "fill = line color".
     * Clicking the ⊘ swatch sets fillColor = null.
     * Clicking it AGAIN (or any color swatch) restores the fill.
     */
    _setFillMode(mode) {
        if (!this.drawing) return;
        if (!('fillColor' in this.drawing)) return; // not a fillable drawing
        if (mode === 'none') {
            // Toggle: if already no-fill, restore fill = line color.
            if (this.drawing.fillColor === null) {
                this.drawing.fillColor = this.drawing.color;
            } else {
                this.drawing.fillColor = null;
            }
        }
        this._syncDisplay();
        this.engine.requestRender();
    }

    _setField(field, value) {
        if (!this.drawing) return;
        if (field === 'lineWidth') this.drawing.lineWidth = parseFloat(value);
        else if (field === 'opacity') this.drawing.opacity = parseFloat(value);
        else this.drawing[field] = value;
        this.engine.requestRender();
    }

    _syncDisplay() {
        if (!this.drawing) return;
        const d = this.drawing;
        // Sync inputs
        this.element.querySelectorAll('[data-field]').forEach(el => {
            if (el.classList.contains('ac-sch-swatch')) return;
            if (el.classList.contains('ac-sch-palette')) return;
            const f = el.dataset.field;
            if (el.type === 'checkbox') el.checked = !!d[f];
            else if (el.tagName === 'SELECT') el.value = d[f] || 'solid';
            else if (f === 'lineWidth') el.value = d.lineWidth;
            else if (f === 'text') el.value = d.text || '';
        });
        // Highlight active color swatch
        const isNoFill = ('fillColor' in d) && d.fillColor === null;
        this.element.querySelectorAll('.ac-sch-swatch').forEach(sw => {
            const c = sw.dataset.color;
            if (c === '__NO_FILL__') {
                sw.classList.toggle('active', isNoFill);
            } else {
                sw.classList.toggle('active', c === d.color && !isNoFill);
            }
        });
    }

    show(drawing) {
        if (!drawing) { this.hide(); return; }
        this.drawing = drawing;
        this.element.style.display = 'flex';
        this._syncDisplay();
        this._position();
    }

    hide() {
        this.element.style.display = 'none';
        this.drawing = null;
    }

    _position() {
        if (!this.drawing || !this.drawing.anchors.length) return;
        const vp = this.engine.viewport;
        const p = this.drawing._anchorToScreen(this.drawing.anchors[0], vp);
        const rect = this.element.getBoundingClientRect();
        const cardW = rect.width || 600;
        const cardH = rect.height || 40;
        let x = p.x - cardW / 2;
        let y = p.y - cardH - 10;
        if (y < 8) y = p.y + 14;
        if (x < 8) x = 8;
        if (x + cardW > vp.width - 80) x = vp.width - 80 - cardW;
        this.element.style.left = x + 'px';
        this.element.style.top = y + 'px';
    }

    _delete() {
        if (!this.drawing) return;
        this.engine.drawingManager.remove(this.drawing.id);
        this.hide();
        this.engine.requestRender();
    }

    /**
     * Clone (duplicate) the selected drawing.
     * The clone appears at a small offset from the original (same size, same
     * shape, same colors) so the user can see that the copy succeeded.
     */
    _clone() {
        if (!this.drawing) return;
        const json = this.drawing.toJSON();
        delete json.id;
        const factory = this.engine.drawingManager._toolFactories[json.type];
        if (factory) {
            const clone = factory(json);
            // Offset the clone by a small amount in chart coordinates.
            // ~3 bars to the right, and a small price shift.
            const vp = this.engine.viewport;
            const offsetBars = 3;
            const offsetPrice = (vp.priceRange.max - vp.priceRange.min) * 0.02;
            clone.anchors.forEach(a => {
                a.index += offsetBars;
                a.price -= offsetPrice; // shift down slightly so it's visible
            });
            this.engine.drawingManager.add(clone);
            // Select the clone so the user can keep working on it.
            this.engine.drawingManager.selectedId = clone.id;
            this.engine.requestRender();
            // Show the settings card on the new clone.
            this.show(clone);
        }
    }
}
