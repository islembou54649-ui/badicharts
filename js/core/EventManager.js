/**
 * EventManager.js
 * Centralized event handling for mouse, touch, keyboard, and wheel.
 *
 * TradingView-style interaction model:
 *  - Left-click drag = PAN the chart (default behavior)
 *  - Hover = crosshair follows cursor
 *  - Click on a drawing (no tool active) = select & drag it
 *  - Active tool = draw mode
 *  - Wheel = zoom; Shift+wheel = pan horizontally
 *  - Pinch (touch) = zoom
 *
 * Movement threshold prevents accidental pan on simple clicks.
 */
import { MathUtils } from '../utils/MathUtils.js';

export class EventManager {
    constructor(canvas, engine) {
        this.canvas = canvas;
        this.engine = engine;
        this.element = canvas.element;

        // Current pointer state
        this.pointerX = -1;
        this.pointerY = -1;
        this.pointerInside = false;
        this.isPointerDown = false;
        this.lastPointerX = 0;
        this.lastPointerY = 0;
        this.downX = 0;
        this.downY = 0;
        this.downTime = 0;
        this.draggedSinceDown = false;
        this.moveThreshold = 3; // px — below this we treat as click, not drag

        // The action being performed during the current pointer-down sequence
        // 'pan' | 'draw' | 'select-drag' | 'none'
        this.activeAction = 'none';

        // For select-drag: which drawing handle/anchor is being moved
        this._dragTarget = null;
        this._dragAnchorIndex = -1;

        // Multi-touch pinch
        this.pinchStartDist = 0;
        this.pinchStartSpacing = 0;
        this.pinchStartMid = null;

        // Bound handlers
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        this._onPointerLeave = this._onPointerLeave.bind(this);
        this._onWheel = this._onWheel.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);
        this._onDblClick = this._onDblClick.bind(this);
        this._onTouchStart = this._onTouchStart.bind(this);
        this._onTouchMove = this._onTouchMove.bind(this);
        this._onTouchEnd = this._onTouchEnd.bind(this);

        this._attach();
    }

    _attach() {
        this.element.addEventListener('pointerdown', this._onPointerDown);
        this.element.addEventListener('pointermove', this._onPointerMove);
        this.element.addEventListener('pointerup', this._onPointerUp);
        this.element.addEventListener('pointerleave', this._onPointerLeave);
        this.element.addEventListener('pointercancel', this._onPointerUp);
        this.element.addEventListener('wheel', this._onWheel, { passive: false });
        this.element.addEventListener('contextmenu', this._onContextMenu);
        this.element.addEventListener('dblclick', this._onDblClick);
        this.element.addEventListener('touchstart', this._onTouchStart, { passive: false });
        this.element.addEventListener('touchmove', this._onTouchMove, { passive: false });
        this.element.addEventListener('touchend', this._onTouchEnd);
        window.addEventListener('keydown', this._onKeyDown);
        this.element.style.touchAction = 'none';
    }

    _getPos(e) {
        const rect = this.element.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    _onPointerDown(e) {
        this.element.setPointerCapture(e.pointerId);
        const { x, y } = this._getPos(e);
        this.pointerX = x;
        this.pointerY = y;
        this.isPointerDown = true;
        this.lastPointerX = x;
        this.lastPointerY = y;
        this.downX = x;
        this.downY = y;
        this.downTime = performance.now();
        this.draggedSinceDown = false;

        // FIX: Check if we clicked on a pane button (indicator controls) first.
        if (this.engine.handlePaneButtonClick(x, y)) {
            this.activeAction = 'none';
            return;
        }

        // FIX: Region detection — determine if the pointer is on the price axis
        // or the time axis. These have special drag behaviors (like TradingView):
        //   - Price axis: vertical drag SCALES the price range (zoom)
        //   - Time axis: drag PANS horizontally only (no price shift)
        //   - Chart area: drag pans (horizontal) — no vertical price shift
        const vp = this.engine.viewport;
        const priceAxisW = this.engine.priceScale.width;
        const inPriceAxis = x >= vp.width - priceAxisW;
        // Check if we're on the time axis strip (bottom of the chart)
        const regions = this.engine.indicatorManager.paneManager.getRegions();
        const timeAxisRegion = regions.find(r => r.id === 'timeaxis');
        const inTimeAxis = timeAxisRegion && y >= timeAxisRegion.rect.y && y <= timeAxisRegion.rect.y + timeAxisRegion.rect.h;

        // Detect DOUBLE-CLICK on the price axis or time axis → reset that axis
        // to auto-fit. TradingView behavior: dblclick on price axis resets the
        // vertical scale; dblclick on time axis resets the horizontal zoom.
        const now = performance.now();
        const isDoubleClick = (now - (this._lastClickTime || 0)) < 350
            && Math.abs(x - (this._lastClickX || -9999)) < 5
            && Math.abs(y - (this._lastClickY || -9999)) < 5;
        this._lastClickTime = now;
        this._lastClickX = x;
        this._lastClickY = y;

        if (isDoubleClick) {
            if (inPriceAxis) {
                // Reset price scale to auto-fit.
                vp.autoScale = true;
                vp.updatePriceRange(this.engine.dataManager);
                this.engine.requestRender();
                this.activeAction = 'none';
                return;
            } else if (inTimeAxis) {
                // Reset horizontal zoom to default bar spacing + scroll to right.
                vp.barSpacing = 8;
                vp.rightOffset = 10;
                vp.scrollToRight(this.engine.dataManager.size);
                vp.updatePriceRange(this.engine.dataManager);
                this.engine.requestRender();
                this.activeAction = 'none';
                return;
            }
        }

        // Decide what action to start
        if (this.engine.activeTool) {
            this.activeAction = 'draw';
            this.engine.drawingManager.onPointerDown(x, y, this.engine.activeTool);
        } else if (inPriceAxis) {
            // Price axis drag — TradingView-style:
            //   - VERTICAL drag (up/down) = PAN the chart vertically (move
            //     the visible price range up/down so the user can scroll
            //     through prices).
            //   - HORIZONTAL drag (left/right) on the price axis = SCALE
            //     (zoom in/out the price range).
            // The direction is detected on first move.
            this.activeAction = 'price-axis-pending';
            this._scaleStartRange = { ...vp.priceRange };
            this._scaleStartY = y;
            this._scaleStartX = x;
            const mainRegion = regions.find(r => r.id === 'main');
            if (mainRegion) {
                const cursorYInMain = y - mainRegion.rect.y;
                const priceAtCursor = vp.yToPrice(cursorYInMain);
                this._scaleAnchorPrice = priceAtCursor;
            } else {
                this._scaleAnchorPrice = null;
            }
            this._priceAxisDirection = null; // 'vertical' | 'horizontal'
        } else if (inTimeAxis) {
            // Time-axis drag = horizontal PAN (default chart behavior).
            // The previous 'scale-time' (zoom via drag) feature was removed
            // per user request — zoom on the time axis is now done only
            // via the +/- toolbar buttons or the mouse wheel.
            this.activeAction = 'pan';
        } else if (e.button === 2 || e.shiftKey) {
            // Right button or shift = force pan
            this.activeAction = 'pan';
        } else {
            // Default: check if we clicked on a drawing (for select/drag).
            // Otherwise pan. The decision happens on first move with threshold.
            this.activeAction = 'pending';
            this._dragTarget = this.engine.drawingManager
                ? this.engine.drawingManager.hitTestTopMost(x, y)
                : null;
        }
        this.engine.requestRender();
    }

    _onPointerMove(e) {
        const { x, y } = this._getPos(e);
        this.pointerX = x;
        this.pointerY = y;
        this.pointerInside = true;

        if (this.isPointerDown) {
            const dx = x - this.lastPointerX;
            const dy = y - this.lastPointerY;
            const totalMove = Math.abs(x - this.downX) + Math.abs(y - this.downY);
            if (totalMove > this.moveThreshold) this.draggedSinceDown = true;

            // Resolve pending action once movement exceeds threshold
            if (this.activeAction === 'pending' && this.draggedSinceDown) {
                if (this._dragTarget) {
                    this.activeAction = 'select-drag';
                    // FIX: determine which handle we grabbed ONCE at drag start.
                    // This prevents both anchors from moving together.
                    this.engine.drawingManager.startDrag(this._dragTarget, this.downX, this.downY);
                } else {
                    this.activeAction = 'pan';
                }
            }

            if (this.activeAction === 'pan') {
                // Chart-area and time-axis pan = HORIZONTAL ONLY. Price
                // scaling is done via the 'scale-price' action (price axis
                // drag). Time-axis zoom is done via +/- buttons or wheel.
                this.engine.viewport.panBy(dx);
                this.engine.viewport.updatePriceRange(this.engine.dataManager);
            } else if (this.activeAction === 'price-axis-pending' || this.activeAction === 'scale-price' || this.activeAction === 'pan-price') {
                const vp = this.engine.viewport;
                vp.autoScale = false;
                const totalDy = y - this._scaleStartY;
                const totalDx = x - this._scaleStartX;

                // Detect direction on first significant move.
                if (this.activeAction === 'price-axis-pending') {
                    if (Math.abs(totalDy) > 5 && Math.abs(totalDy) > Math.abs(totalDx)) {
                        this._priceAxisDirection = 'vertical';
                        this.activeAction = 'pan-price';
                    } else if (Math.abs(totalDx) > 5 && Math.abs(totalDx) > Math.abs(totalDy)) {
                        this._priceAxisDirection = 'horizontal';
                        this.activeAction = 'scale-price';
                    } else {
                        return; // not enough movement yet
                    }
                }

                if (this._priceAxisDirection === 'vertical' || this.activeAction === 'pan-price') {
                    // VERTICAL drag = PAN the chart vertically.
                    // Move the price range up/down by the drag amount.
                    const span = this._scaleStartRange.max - this._scaleStartRange.min;
                    if (span <= 0) return;
                    // Convert pixel drag to price shift.
                    const priceShift = -totalDy / vp.priceHeight * span;
                    vp.priceRange = {
                        min: this._scaleStartRange.min + priceShift,
                        max: this._scaleStartRange.max + priceShift
                    };
                } else if (this._priceAxisDirection === 'horizontal' || this.activeAction === 'scale-price') {
                    // HORIZONTAL drag = SCALE (zoom in/out).
                    // Drag LEFT → zoom IN, drag RIGHT → zoom OUT.
                    const sensitivity = 200;
                    let factor = Math.exp(-totalDx / sensitivity);
                    factor = Math.max(0.05, Math.min(20, factor));
                    const startMin = this._scaleStartRange.min;
                    const startMax = this._scaleStartRange.max;
                    const startSpan = startMax - startMin;
                    if (!isFinite(startSpan) || startSpan <= 0) return;
                    const newSpan = Math.max(startSpan * factor, 1e-9);
                    // Pivot around the cursor's price.
                    const pivot = (typeof this._scaleAnchorPrice === 'number' && isFinite(this._scaleAnchorPrice))
                        ? this._scaleAnchorPrice
                        : (startMin + startMax) / 2;
                    const pivotT = (pivot - startMin) / startSpan;
                    const newMin = pivot - pivotT * newSpan;
                    const newMax = newMin + newSpan;
                    vp.priceRange = { min: newMin, max: newMax };
                }
            } else if (this.activeAction === 'draw') {
                this.engine.drawingManager.onPointerMove(x, y);
            } else if (this.activeAction === 'select-drag' && this._dragTarget) {
                this.engine.drawingManager.dragDrawing(this._dragTarget, x, y, dx, dy);
            }
            this.lastPointerX = x;
            this.lastPointerY = y;
        } else {
            // Hover only — update crosshair and drawing hover state
            if (this.engine.drawingManager && this.engine.activeTool) {
                this.engine.drawingManager.onPointerHover(x, y);
            } else if (this.engine.drawingManager) {
                this.engine.drawingManager.updateHover(x, y);
            }
            // Update pane-button hover state so the buttons feel interactive.
            this._updatePaneButtonHover(x, y);
        }

        this.engine.crosshair.update(x, y, this.pointerInside);
        this.engine.requestRender();
    }

    /**
     * Update the `hovered` flag on every pane button based on the current
     * pointer position. Called on every hover move so the buttons light up
     * as the cursor passes over them — making them feel interactive.
     */
    _updatePaneButtonHover(x, y) {
        const panes = this.engine.indicatorManager.paneManager.panes;
        const regions = this.engine.indicatorManager.paneManager.getRegions();
        const regionByPane = new Map();
        for (const r of regions) regionByPane.set(r.pane, r.rect);
        let changed = false;
        for (const pane of panes) {
            if (!pane._buttons || pane._buttons.length === 0) continue;
            const rect = regionByPane.get(pane);
            if (!rect) continue;
            for (const btn of pane._buttons) {
                const btnY = rect.y + btn.y;
                const isHover = x >= btn.x && x <= btn.x + btn.w
                    && y >= btnY && y <= btnY + btn.h;
                if (btn.hovered !== isHover) {
                    btn.hovered = isHover;
                    changed = true;
                }
            }
        }
        if (changed) this.engine.requestRender();
    }

    _onPointerUp(e) {
        const { x, y } = this._getPos(e);

        if (this.activeAction === 'draw') {
            this.engine.drawingManager.onPointerUp(x, y);
        } else if (this.activeAction === 'pending' && !this.draggedSinceDown) {
            // It was a click, not a drag — try to select/deselect a drawing
            this.engine.drawingManager.handleClick(x, y);
        } else if (this.activeAction === 'select-drag') {
            // End the drag — clear the handle index
            this.engine.drawingManager.endDrag();
        }
        this.isPointerDown = false;
        this.activeAction = 'none';
        this._dragTarget = null;
        this.engine.requestRender();
    }

    _onPointerLeave() {
        this.pointerInside = false;
        this.engine.crosshair.visible = false;
        this.engine.requestRender();
    }

    _onWheel(e) {
        e.preventDefault();
        const { x, y } = this._getPos(e);
        if (e.ctrlKey) {
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            this.engine.viewport.zoomAt(x, factor);
        } else if (e.shiftKey) {
            // Shift + wheel = horizontal pan
            this.engine.viewport.panBy(e.deltaY);
        } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            this.engine.viewport.panBy(e.deltaX);
        } else {
            const factor = e.deltaY < 0 ? 1.15 : 0.87;
            this.engine.viewport.zoomAt(x, factor);
        }
        this.engine.viewport.updatePriceRange(this.engine.dataManager);
        this.engine.requestRender();
    }

    _onContextMenu(e) {
        e.preventDefault();
        const { x, y } = this._getPos(e);
        // FIX: Right-click on the PRICE AXIS resets the price scale to auto-fit.
        // This is TradingView behavior — right-click on price axis → reset scale.
        const vp = this.engine.viewport;
        const priceAxisW = this.engine.priceScale.width;
        if (x >= vp.width - priceAxisW) {
            vp.autoScale = true;
            vp.updatePriceRange(this.engine.dataManager);
            this.engine.requestRender();
            return;
        }
        // FIX: Right-click on a drawing selects it and shows the settings card.
        const drawing = this.engine.drawingManager.hitTestTopMost(x, y);
        if (drawing) {
            this.engine.drawingManager.handleClick(x, y);
            if (this.engine.drawingManager.selectedId === drawing.id) {
                this.engine.settingsCard.show(drawing);
            }
        } else {
            this.engine.settingsCard.hide();
        }
        this.engine.requestRender();
    }

    _onKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'Escape' && this.engine.drawingManager) {
            this.engine.drawingManager.cancelDrawing();
            this.engine.setActiveTool(null);
        }
        if (e.key === 'Enter' && this.engine.drawingManager) {
            // Finish a multi-point drawing (e.g. Polyline) on Enter.
            this.engine.drawingManager.finishDrawing();
            this.engine.requestRender();
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.engine.drawingManager.selectedId) {
            this.engine.drawingManager.deleteSelected();
            this.engine.requestRender();
        }
    }

    /**
     * Double-click handler: finishes a multi-point drawing (e.g. Polyline).
     * If no drawing is in progress, this is a no-op (the dblclick on the
     * price/time axis is handled separately in _onPointerDown).
     */
    _onDblClick(e) {
        if (this.engine.drawingManager && this.engine.drawingManager.activeTool) {
            this.engine.drawingManager.finishDrawing();
            this.engine.requestRender();
        }
    }

    _onTouchStart(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const [t1, t2] = [e.touches[0], e.touches[1]];
            this.pinchStartDist = MathUtils.distance(t1.clientX, t1.clientY, t2.clientX, t2.clientY);
            this.pinchStartSpacing = this.engine.viewport.barSpacing;
            const rect = this.element.getBoundingClientRect();
            this.pinchStartMid = {
                x: ((t1.clientX + t2.clientX) / 2) - rect.left,
                y: ((t1.clientY + t2.clientY) / 2) - rect.top
            };
            // Cancel any in-progress draw/select
            this.activeAction = 'none';
        }
    }

    _onTouchMove(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            const [t1, t2] = [e.touches[0], e.touches[1]];
            const dist = MathUtils.distance(t1.clientX, t1.clientY, t2.clientX, t2.clientY);
            if (this.pinchStartDist > 0 && this.pinchStartMid) {
                const factor = dist / this.pinchStartDist;
                this.engine.viewport.barSpacing = MathUtils.clamp(
                    this.pinchStartSpacing * factor,
                    this.engine.viewport.minBarSpacing,
                    this.engine.viewport.maxBarSpacing
                );
                this.engine.viewport.updatePriceRange(this.engine.dataManager);
                this.engine.requestRender();
            }
        }
    }

    _onTouchEnd(e) {
        if (e.touches.length < 2) {
            this.pinchStartDist = 0;
            this.pinchStartMid = null;
        }
    }

    destroy() {
        this.element.removeEventListener('pointerdown', this._onPointerDown);
        this.element.removeEventListener('pointermove', this._onPointerMove);
        this.element.removeEventListener('pointerup', this._onPointerUp);
        this.element.removeEventListener('pointerleave', this._onPointerLeave);
        this.element.removeEventListener('wheel', this._onWheel);
        this.element.removeEventListener('contextmenu', this._onContextMenu);
        this.element.removeEventListener('dblclick', this._onDblClick);
        this.element.removeEventListener('touchstart', this._onTouchStart);
        this.element.removeEventListener('touchmove', this._onTouchMove);
        this.element.removeEventListener('touchend', this._onTouchEnd);
        window.removeEventListener('keydown', this._onKeyDown);
    }
}
