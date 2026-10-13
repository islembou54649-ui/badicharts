/**
 * BackgroundManager.js
 * Manages chart background — can be a solid color, an image, a video,
 * or an animated SVG logo.
 *
 * The background is a DOM layer (img/video/svg) positioned BEHIND the
 * canvas. A contrast/opacity slider controls how prominent it is.
 *
 * Usage from the engine:
 *   this.background = new BackgroundManager(this.chartArea);
 *   this.background.set({ type: 'image', src: 'logo.png', opacity: 0.15 });
 *   this.background.set({ type: 'video', src: 'bg.mp4', opacity: 0.1 });
 *   this.background.set({ type: 'svg', src: '<svg>...</svg>', opacity: 0.2 });
 *   this.background.clear();
 */
export class BackgroundManager {
    constructor(chartArea) {
        this.chartArea = chartArea;
        this._layer = null;
        this._currentType = null;
        this._opacity = 0.15;
    }

    /**
     * Set the background.
     * @param {object} opts
     *   - type: 'image' | 'video' | 'svg' | 'animated-svg' | null
     *   - src: URL (for image/video) or SVG markup (for svg/animated-svg)
     *   - opacity: 0..1 (how prominent the background is)
     *   - contrast: 0..2 (CSS filter contrast, default 1)
     */
    set(opts) {
        this.clear();
        if (!opts || !opts.type) return;
        this._opacity = opts.opacity ?? 0.15;
        const contrast = opts.contrast ?? 1;

        const layer = document.createElement('div');
        layer.className = 'ac-bg-layer';
        layer.style.cssText = `
            position: absolute;
            inset: 0;
            z-index: -1;
            pointer-events: none;
            overflow: hidden;
            opacity: ${this._opacity};
            filter: contrast(${contrast});
        `;

        if (opts.type === 'image' && opts.src) {
            const img = document.createElement('img');
            img.src = opts.src;
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            layer.appendChild(img);
        } else if (opts.type === 'video' && opts.src) {
            const vid = document.createElement('video');
            vid.src = opts.src;
            vid.autoplay = true;
            vid.loop = true;
            vid.muted = true;
            vid.playsInline = true;
            vid.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            layer.appendChild(vid);
        } else if (opts.type === 'svg' && opts.src) {
            // Static SVG markup
            layer.innerHTML = `
                <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                    ${opts.src}
                </div>
            `;
        } else if (opts.type === 'animated-svg' && opts.src) {
            // Animated SVG — the markup can include CSS animations
            layer.innerHTML = `
                <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                    ${opts.src}
                </div>
            `;
        }

        this.chartArea.appendChild(layer);
        this._layer = layer;
        this._currentType = opts.type;
    }

    /**
     * Update opacity without reloading the background.
     */
    setOpacity(opacity) {
        this._opacity = opacity;
        if (this._layer) this._layer.style.opacity = String(opacity);
    }

    /**
     * Update contrast filter.
     */
    setContrast(contrast) {
        if (this._layer) this._layer.style.filter = `contrast(${contrast})`;
    }

    /**
     * Remove the background layer.
     */
    clear() {
        if (this._layer) {
            this._layer.remove();
            this._layer = null;
            this._currentType = null;
        }
    }

    get type() { return this._currentType; }
}
