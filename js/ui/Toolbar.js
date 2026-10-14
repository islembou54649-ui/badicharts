/**
 * Toolbar.js
 * Top toolbar with:
 *  - Brand + symbol selector
 *  - Drawing tools (categorized dropdown menu)
 *  - Indicators (categorized dropdown menu)
 *  - Intervals
 *  - Zoom/fit/clear/theme/live actions
 *
 * For 100+ tools/indicators, we use dropdown menus organized by category.
 */
import { DomUtils } from '../utils/DomUtils.js';
import { INDICATOR_REGISTRY } from '../indicators/IndicatorManager.js';
import { CHART_TYPES } from '../series/ChartTypeManager.js';
import { drawingToolRegistry } from '../drawing/DrawingToolRegistry.js';

// NOTE: Drawing tools are NO LONGER hard-coded in this file.
// They live in the DrawingToolRegistry singleton. To add tools, register
// them at runtime:
//
//   import { drawingToolRegistry } from './js/drawing/DrawingToolRegistry.js';
//   drawingToolRegistry.register('mytool', {
//     label: 'My Tool', icon: '★', category: 'Custom',
//     factory: (opts) => new MyTool(opts)
//   });
//
// See js/drawing/DrawingToolRegistry.js for full docs.
//
// When the registry changes, the toolbar auto-refreshes its drawing menu.

export class Toolbar {
    constructor(container, engine) {
        this.container = container;
        this.engine = engine;
        this.element = DomUtils.el('div', { class: 'ac-toolbar' });
        container.appendChild(this.element);
        this._buttons = new Map();
        this._openMenu = null;
        this._build();
        // Close menus on outside click
        document.addEventListener('pointerdown', (e) => {
            if (!e.target.closest('.ac-toolbar-menu-trigger') && !e.target.closest('.ac-toolbar-menu')) {
                this._closeMenus();
            }
        });
        // Auto-refresh the drawing menu when the registry changes (so newly
        // registered tools appear immediately if the menu is open).
        this._unsubRegistry = drawingToolRegistry.subscribe(() => {
            if (this._openMenu === 'draw') {
                // Rebuild the open draw menu in place.
                const menu = this._currentMenu;
                if (menu) {
                    menu.innerHTML = '';
                    this._buildDrawMenu(menu);
                }
            }
        });
    }

    /**
     * Rebuild the drawing menu (called when the registry changes externally).
     */
    _rebuildDrawingMenu() {
        if (this._currentMenu && this._openMenu === 'draw') {
            this._currentMenu.innerHTML = '';
            this._buildDrawMenu(this._currentMenu);
        }
    }

    _build() {
        // Brand
        const brand = DomUtils.el('div', { class: 'ac-toolbar-brand' }, [
            DomUtils.el('span', { class: 'ac-brand-mark' }, 'BC'),
            DomUtils.el('span', { class: 'ac-brand-name' }, 'BadiCharts')
        ]);

        // Symbol select
        const symbolSel = DomUtils.el('select', { class: 'ac-symbol-select' });
        for (const [val, txt] of [['BTCUSDT', 'BTC / USDT'], ['ETHUSDT', 'ETH / USDT'], ['BNBUSDT', 'BNB / USDT'], ['SOLUSDT', 'SOL / USDT']]) {
            symbolSel.appendChild(DomUtils.el('option', { value: val }, txt));
        }

        // Cursor button (default)
        const cursorBtn = DomUtils.el('button', { class: 'ac-toolbar-btn active', title: 'Cursor (V)', dataset: { tool: 'cursor' } }, '↖');
        cursorBtn.addEventListener('click', () => this._selectTool('cursor'));
        this._buttons.set('cursor', cursorBtn);

        // Drawings dropdown trigger
        const drawTrigger = DomUtils.el('button', { class: 'ac-toolbar-btn ac-toolbar-menu-trigger', title: 'Drawing Tools' }, [
            DomUtils.el('span', {}, 'Tools'),
            DomUtils.el('span', { class: 'ac-caret' }, '▾')
        ]);
        drawTrigger.addEventListener('click', (e) => this._toggleMenu('draw', drawTrigger));

        // Indicators dropdown trigger
        const indTrigger = DomUtils.el('button', { class: 'ac-toolbar-btn ac-toolbar-menu-trigger', title: 'Indicators' }, [
            DomUtils.el('span', {}, 'Indicators'),
            DomUtils.el('span', { class: 'ac-caret' }, '▾')
        ]);
        indTrigger.addEventListener('click', (e) => this._toggleMenu('ind', indTrigger));

        // Chart type dropdown trigger
        const chartTypeTrigger = DomUtils.el('button', { class: 'ac-toolbar-btn ac-toolbar-menu-trigger', title: 'Chart Type' }, [
            DomUtils.el('span', {}, 'Chart Type'),
            DomUtils.el('span', { class: 'ac-caret' }, '▾')
        ]);
        chartTypeTrigger.addEventListener('click', (e) => this._toggleMenu('charttype', chartTypeTrigger));

        // Interval group
        const intervalGroup = DomUtils.el('div', { class: 'ac-toolbar-group' });
        for (const iv of ['1m', '5m', '15m', '1h', '4h', '1D', '1W']) {
            const btn = DomUtils.el('button', {
                class: 'ac-toolbar-btn ac-toolbar-btn-sm' + (iv === '1m' ? ' active' : ''),
                dataset: { interval: iv }
            }, iv);
            btn.addEventListener('click', () => this._setInterval(iv));
            intervalGroup.appendChild(btn);
        }

        // Right actions
        const rightGroup = DomUtils.el('div', { class: 'ac-toolbar-group ac-toolbar-right' });
        const zoomIn = DomUtils.el('button', { class: 'ac-toolbar-btn', title: 'Zoom In' }, '+');
        const zoomOut = DomUtils.el('button', { class: 'ac-toolbar-btn', title: 'Zoom Out' }, '−');
        const fitBtn = DomUtils.el('button', { class: 'ac-toolbar-btn', title: 'Fit All' }, '⤢');
        const clearBtn = DomUtils.el('button', { class: 'ac-toolbar-btn', title: 'Clear Drawings' }, '✕');
        const themeBtn = DomUtils.el('button', { class: 'ac-toolbar-btn', title: 'Toggle Theme', id: 'ac-theme-btn' }, '◐');
        const liveBtn = DomUtils.el('button', { class: 'ac-toolbar-btn ac-toolbar-btn-toggle', title: 'Toggle Live Feed', id: 'ac-live-btn' }, '● Live');
        zoomIn.addEventListener('click', () => this.engine.zoomBy(1.25));
        zoomOut.addEventListener('click', () => this.engine.zoomBy(0.8));
        fitBtn.addEventListener('click', () => this.engine.fitAll());
        clearBtn.addEventListener('click', () => {
            if (confirm('Clear all drawings?')) this.engine.drawingManager.clear();
            this.engine.requestRender();
        });
        themeBtn.addEventListener('click', () => this.engine.toggleTheme());
        liveBtn.addEventListener('click', () => this.engine.toggleLive());

        // Background upload button — opens a file picker for image/video/SVG.
        const bgBtn = DomUtils.el('button', { class: 'ac-toolbar-btn', title: 'Set Background (Image/Video/SVG)' }, '🖼');
        bgBtn.addEventListener('click', () => this._openBackgroundPicker());

        // Background opacity slider (inline, small).
        const bgOpacity = DomUtils.el('input', {
            type: 'range', min: '0', max: '1', step: '0.05', value: '0.15',
            class: 'ac-toolbar-btn ac-bg-opacity',
            title: 'Background opacity'
        });
        bgOpacity.style.cssText = 'width:50px;accent-color:var(--ac-accent);';
        bgOpacity.addEventListener('input', () => {
            if (this.engine.background) this.engine.background.setOpacity(parseFloat(bgOpacity.value));
        });

        // Clear background button.
        const bgClear = DomUtils.el('button', { class: 'ac-toolbar-btn', title: 'Clear Background' }, '⊘');
        bgClear.addEventListener('click', () => {
            if (this.engine.background) this.engine.background.clear();
        });

        rightGroup.append(zoomIn, zoomOut, fitBtn, clearBtn, bgBtn, bgOpacity, bgClear, themeBtn, liveBtn);

        this.element.append(brand, symbolSel, cursorBtn, drawTrigger, indTrigger, chartTypeTrigger, intervalGroup, rightGroup);
    }

    /**
     * Open a hidden file picker for image/video/SVG backgrounds.
     * The selected file is read as a data URL and set as the chart background.
     */
    _openBackgroundPicker() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*,video/*,.svg';
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                let type = 'image';
                if (file.type.startsWith('video/')) type = 'video';
                else if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) type = 'svg';
                if (this.engine.background) {
                    this.engine.background.set({ type, src: dataUrl, opacity: 0.15 });
                }
            };
            reader.readAsDataURL(file);
            input.remove();
        });
        input.click();
    }

    _toggleMenu(name, trigger) {
        this._closeMenus();
        if (this._openMenu === name) { this._openMenu = null; return; }
        const menu = DomUtils.el('div', { class: 'ac-toolbar-menu' });
        if (name === 'draw') this._buildDrawMenu(menu);
        else if (name === 'ind') this._buildIndicatorMenu(menu);
        else if (name === 'charttype') this._buildChartTypeMenu(menu);
        document.body.appendChild(menu);
        // Position below trigger
        const r = trigger.getBoundingClientRect();
        menu.style.left = r.left + 'px';
        menu.style.top = (r.bottom + 2) + 'px';
        this._openMenu = name;
        this._currentMenu = menu;
    }

    _closeMenus() {
        if (this._currentMenu) { this._currentMenu.remove(); this._currentMenu = null; }
        this._openMenu = null;
    }

    _buildDrawMenu(menu) {
        // Tools come from the DrawingToolRegistry singleton — empty by default.
        // Register tools at runtime via drawingToolRegistry.register(id, def)
        // or drawingToolRegistry.registerAll(BUILT_IN_TOOLS).
        const cats = drawingToolRegistry.categories();
        if (cats.length === 0) {
            // Empty-state hint: show the user how to add tools.
            const hint = DomUtils.el('div', { class: 'ac-menu-empty-hint' },
                'No drawing tools registered. ' +
                'Add tools via the DrawingToolRegistry API. ' +
                'See js/drawing/DrawingToolRegistry.js for docs.'
            );
            menu.appendChild(hint);
            return;
        }
        for (const cat of cats) {
            const catEl = DomUtils.el('div', { class: 'ac-menu-category' }, cat.name);
            menu.appendChild(catEl);
            for (const t of cat.tools) {
                const item = DomUtils.el('button', { class: 'ac-menu-item', dataset: { tool: t.id } }, [
                    DomUtils.el('span', { class: 'ac-menu-icon' }, t.icon),
                    DomUtils.el('span', {}, t.label)
                ]);
                item.addEventListener('click', () => {
                    this._selectTool(t.id);
                    this._closeMenus();
                });
                menu.appendChild(item);
            }
        }
    }

    _buildIndicatorMenu(menu) {
        // Group by category
        const cats = {};
        for (const [key, reg] of Object.entries(INDICATOR_REGISTRY)) {
            if (!cats[reg.category]) cats[reg.category] = [];
            cats[reg.category].push({ key, ...reg });
        }
        for (const [catName, items] of Object.entries(cats)) {
            const catEl = DomUtils.el('div', { class: 'ac-menu-category' }, catName);
            menu.appendChild(catEl);
            for (const it of items) {
                const item = DomUtils.el('button', { class: 'ac-menu-item', dataset: { indicator: it.key } }, [
                    DomUtils.el('span', { class: 'ac-menu-icon' }, it.type === 'overlay' ? '◯' : '▤'),
                    DomUtils.el('span', {}, it.key)
                ]);
                item.addEventListener('click', () => {
                    this.engine.addIndicator(it.key, {});
                    this._closeMenus();
                });
                menu.appendChild(item);
            }
        }
    }

    _buildChartTypeMenu(menu) {
        // Group by category
        const cats = {};
        for (const ct of CHART_TYPES) {
            if (!cats[ct.category]) cats[ct.category] = [];
            cats[ct.category].push(ct);
        }
        const current = this.engine.getChartType();
        for (const [catName, items] of Object.entries(cats)) {
            const catEl = DomUtils.el('div', { class: 'ac-menu-category' }, catName);
            menu.appendChild(catEl);
            for (const ct of items) {
                const isCurrent = ct.id === current;
                const item = DomUtils.el('button', { class: 'ac-menu-item' + (isCurrent ? ' active' : ''), dataset: { chartType: ct.id } }, [
                    DomUtils.el('span', { class: 'ac-menu-icon' }, isCurrent ? '●' : '○'),
                    DomUtils.el('span', {}, ct.label)
                ]);
                item.addEventListener('click', () => {
                    this.engine.setChartType(ct.id);
                    this._closeMenus();
                });
                menu.appendChild(item);
            }
        }
    }

    _selectTool(toolId) {
        const drawingTool = (toolId === 'cursor' || toolId === 'crosshair') ? null : toolId;
        this.engine.setActiveTool(drawingTool);
        for (const [id, btn] of this._buttons) btn.classList.toggle('active', id === toolId);
    }

    _setInterval(iv) {
        this.engine.setInterval(iv);
        document.querySelectorAll('[data-interval]').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-interval="${iv}"]`)?.classList.add('active');
    }

    setActiveTool(tool) {
        const toolId = tool || 'cursor';
        for (const [id, btn] of this._buttons) btn.classList.toggle('active', id === toolId);
    }
}
