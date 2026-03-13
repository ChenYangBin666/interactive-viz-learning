/* ============================================================
   PCBUtils — utility IIFE for the PCB设计 interactive learning project
   ============================================================ */
const PCBUtils = (() => {
    'use strict';

    // ── 9. Color & Style ────────────────────────────────────

    const PCB_COLORS = {
        board: '#2d5016', copper: '#b87333', silk: '#ffffff',
        substrate: '#c4a35a', drill: '#1a1a2e',
        topCopper: '#cc3333', bottomCopper: '#3333cc',
        topSilk: '#ffffff', bottomSilk: '#cccccc',
        topMask: '#2d5016', bottomMask: '#2d5080',
        edgeCuts: '#f0e040', gndPlane: '#996633', vccPlane: '#cc6633',
        via: '#c0c0c0', pad: '#daa520',
        grid: '#333344', background: '#0e0e1a'
    };

    function componentColor(type) {
        const map = {
            resistor: '#60b0ff', capacitor: '#ffcc44', ic: '#aa66cc',
            inductor: '#44cc88', diode: '#ff6666', led: '#ff4444',
            connector: '#888888', crystal: '#66cccc', transistor: '#cc8844',
            via: PCB_COLORS.via, pad: PCB_COLORS.pad
        };
        return map[type] || '#aaaaaa';
    }

    // ── 4. PCB Layer System ─────────────────────────────────

    const LAYERS = Object.freeze({
        TOP_COPPER: 'F.Cu', BOTTOM_COPPER: 'B.Cu',
        TOP_SILK: 'F.SilkS', BOTTOM_SILK: 'B.SilkS',
        TOP_MASK: 'F.Mask', BOTTOM_MASK: 'B.Mask',
        DRILL: 'Drill', EDGE_CUTS: 'Edge.Cuts',
        GND_PLANE: 'GND.Cu', VCC_PLANE: 'VCC.Cu'
    });

    const LAYER_COLORS = {
        [LAYERS.TOP_COPPER]: PCB_COLORS.topCopper,
        [LAYERS.BOTTOM_COPPER]: PCB_COLORS.bottomCopper,
        [LAYERS.TOP_SILK]: PCB_COLORS.topSilk,
        [LAYERS.BOTTOM_SILK]: PCB_COLORS.bottomSilk,
        [LAYERS.TOP_MASK]: PCB_COLORS.topMask,
        [LAYERS.BOTTOM_MASK]: PCB_COLORS.bottomMask,
        [LAYERS.DRILL]: PCB_COLORS.drill,
        [LAYERS.EDGE_CUTS]: PCB_COLORS.edgeCuts,
        [LAYERS.GND_PLANE]: PCB_COLORS.gndPlane,
        [LAYERS.VCC_PLANE]: PCB_COLORS.vccPlane
    };

    function getLayerColor(layer) { return LAYER_COLORS[layer] || '#888888'; }

    function _lyr(id, name, type, thickness, extra) {
        return Object.assign({ id, name, type, thickness }, extra || {});
    }

    function createLayerStack(layerCount) {
        const oz = 1;
        const cu = 0.035;
        if (layerCount === 2) {
            return { count: 2, thickness: 1.6, layers: [
                _lyr(LAYERS.TOP_MASK,      'Top Solder Mask',       'mask',       0.02),
                _lyr(LAYERS.TOP_COPPER,    'Top Copper (F.Cu)',     'copper',     cu, { weight: oz }),
                _lyr('core',               'FR-4 Core',             'dielectric', 1.5, { er: 4.5 }),
                _lyr(LAYERS.BOTTOM_COPPER, 'Bottom Copper (B.Cu)',  'copper',     cu, { weight: oz }),
                _lyr(LAYERS.BOTTOM_MASK,   'Bottom Solder Mask',    'mask',       0.02)
            ]};
        }
        if (layerCount === 4) {
            return { count: 4, thickness: 1.6, layers: [
                _lyr(LAYERS.TOP_MASK,      'Top Solder Mask',       'mask',       0.02),
                _lyr(LAYERS.TOP_COPPER,    'Top Copper (F.Cu)',     'copper',     cu, { weight: oz }),
                _lyr('prepreg1',           'Prepreg',               'dielectric', 0.2, { er: 4.2 }),
                _lyr(LAYERS.GND_PLANE,     'GND Plane (In1.Cu)',    'copper',     cu, { weight: oz }),
                _lyr('core1',              'FR-4 Core',             'dielectric', 0.8, { er: 4.5 }),
                _lyr(LAYERS.VCC_PLANE,     'VCC Plane (In2.Cu)',    'copper',     cu, { weight: oz }),
                _lyr('prepreg2',           'Prepreg',               'dielectric', 0.2, { er: 4.2 }),
                _lyr(LAYERS.BOTTOM_COPPER, 'Bottom Copper (B.Cu)',  'copper',     cu, { weight: oz }),
                _lyr(LAYERS.BOTTOM_MASK,   'Bottom Solder Mask',    'mask',       0.02)
            ]};
        }
        // 6-layer
        return { count: 6, thickness: 1.6, layers: [
            _lyr(LAYERS.TOP_MASK,      'Top Solder Mask',       'mask',       0.02),
            _lyr(LAYERS.TOP_COPPER,    'Top Copper (F.Cu)',     'copper',     cu, { weight: oz }),
            _lyr('prepreg1',           'Prepreg',               'dielectric', 0.13, { er: 4.2 }),
            _lyr(LAYERS.GND_PLANE,     'GND Plane (In1.Cu)',    'copper',     cu, { weight: oz }),
            _lyr('core1',              'FR-4 Core',             'dielectric', 0.3,  { er: 4.5 }),
            _lyr('signal_in2',         'Signal (In2.Cu)',       'copper',     cu, { weight: oz }),
            _lyr('prepreg2',           'Prepreg',               'dielectric', 0.13, { er: 4.2 }),
            _lyr('signal_in3',         'Signal (In3.Cu)',       'copper',     cu, { weight: oz }),
            _lyr('core2',              'FR-4 Core',             'dielectric', 0.3,  { er: 4.5 }),
            _lyr(LAYERS.VCC_PLANE,     'VCC Plane (In4.Cu)',    'copper',     cu, { weight: oz }),
            _lyr('prepreg3',           'Prepreg',               'dielectric', 0.13, { er: 4.2 }),
            _lyr(LAYERS.BOTTOM_COPPER, 'Bottom Copper (B.Cu)',  'copper',     cu, { weight: oz }),
            _lyr(LAYERS.BOTTOM_MASK,   'Bottom Solder Mask',    'mask',       0.02)
        ]};
    }

    // ── 1. Grid & Coordinate System ─────────────────────────

    function snapToGrid(x, y, gridSize) {
        return {
            x: Math.round(x / gridSize) * gridSize,
            y: Math.round(y / gridSize) * gridSize
        };
    }

    function createGrid(width, height, cellSize) {
        const cols = Math.ceil(width / cellSize);
        const rows = Math.ceil(height / cellSize);
        const cells = new Array(cols * rows).fill(null);
        return {
            width, height, cellSize, cols, rows, cells,
            snap(x, y) { return snapToGrid(x, y, cellSize); },
            getCell(col, row) {
                if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
                return cells[row * cols + col];
            },
            setCell(col, row, value) {
                if (col < 0 || col >= cols || row < 0 || row >= rows) return;
                cells[row * cols + col] = value;
            },
            worldToCell(x, y) {
                return { col: Math.floor(x / cellSize), row: Math.floor(y / cellSize) };
            },
            cellToWorld(col, row) {
                return { x: col * cellSize + cellSize / 2, y: row * cellSize + cellSize / 2 };
            },
            isOccupied(col, row) { return this.getCell(col, row) !== null; },
            clear() { cells.fill(null); }
        };
    }

    function milToMm(mil)  { return mil * 0.0254; }
    function mmToMil(mm)   { return mm / 0.0254; }
    function pixelToMil(px, scale)  { return px / scale; }
    function milToPixel(mil, scale) { return mil * scale; }

    // ── 2. Component Primitives ─────────────────────────────

    let _nextId = 1;
    function _uid(prefix) { return prefix + '_' + (_nextId++); }

    function _rotatePt(px, py, cx, cy, angleDeg) {
        const rad = (angleDeg * Math.PI) / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const dx = px - cx, dy = py - cy;
        return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
    }

    function createResistor(x, y, value, rotation) {
        const rot = rotation || 0;
        const bodyW = 60, bodyH = 24, leadLen = 20;
        const pin1 = _rotatePt(x - bodyW / 2 - leadLen, y, x, y, rot);
        const pin2 = _rotatePt(x + bodyW / 2 + leadLen, y, x, y, rot);
        return {
            id: _uid('R'), type: 'resistor', x, y,
            value: value || '10k', rotation: rot,
            pins: [
                { id: _uid('pin'), name: '1', x: pin1.x, y: pin1.y, net: null },
                { id: _uid('pin'), name: '2', x: pin2.x, y: pin2.y, net: null }
            ],
            bounds: { x: x - bodyW / 2 - leadLen, y: y - bodyH / 2,
                      width: bodyW + 2 * leadLen, height: bodyH },
            bodyWidth: bodyW, bodyHeight: bodyH, leadLength: leadLen
        };
    }

    function createCapacitor(x, y, value, rotation) {
        const rot = rotation || 0;
        const bodyW = 30, bodyH = 40, leadLen = 20;
        const pin1 = _rotatePt(x - bodyW / 2 - leadLen, y, x, y, rot);
        const pin2 = _rotatePt(x + bodyW / 2 + leadLen, y, x, y, rot);
        return {
            id: _uid('C'), type: 'capacitor', x, y,
            value: value || '100nF', rotation: rot,
            pins: [
                { id: _uid('pin'), name: '1', x: pin1.x, y: pin1.y, net: null },
                { id: _uid('pin'), name: '2', x: pin2.x, y: pin2.y, net: null }
            ],
            bounds: { x: x - bodyW / 2 - leadLen, y: y - bodyH / 2,
                      width: bodyW + 2 * leadLen, height: bodyH },
            bodyWidth: bodyW, bodyHeight: bodyH, leadLength: leadLen
        };
    }

    function createIC(x, y, pinCount, pitch) {
        const p = pitch || 100;
        const pinsPerSide = Math.ceil(pinCount / 2);
        const bodyH = pinsPerSide * p;
        const bodyW = Math.max(300, bodyH * 0.6);
        const pins = [];
        for (let i = 0; i < pinsPerSide; i++) {
            const py = y - bodyH / 2 + p / 2 + i * p;
            pins.push({ id: _uid('pin'), name: String(i + 1),
                         x: x - bodyW / 2 - 20, y: py, side: 'left', net: null });
        }
        for (let i = 0; i < pinsPerSide && pins.length < pinCount; i++) {
            const py = y + bodyH / 2 - p / 2 - i * p;
            pins.push({ id: _uid('pin'), name: String(pinsPerSide + i + 1),
                         x: x + bodyW / 2 + 20, y: py, side: 'right', net: null });
        }
        return {
            id: _uid('U'), type: 'ic', x, y,
            pinCount, pitch: p, rotation: 0, pins,
            bounds: { x: x - bodyW / 2 - 20, y: y - bodyH / 2,
                      width: bodyW + 40, height: bodyH },
            bodyWidth: bodyW, bodyHeight: bodyH
        };
    }

    function createVia(x, y, drill, annular) {
        const d = drill || 12, a = annular || 6;
        return {
            id: _uid('V'), type: 'via', x, y,
            drill: d, annularRing: a, outerDiameter: d + 2 * a,
            layers: [LAYERS.TOP_COPPER, LAYERS.BOTTOM_COPPER], net: null
        };
    }

    function createPad(x, y, width, height, shape) {
        return {
            id: _uid('P'), type: 'pad', x, y,
            width: width || 60, height: height || 40,
            shape: shape || 'rect',   // 'rect' | 'round' | 'oblong'
            layer: LAYERS.TOP_COPPER, net: null, thermalRelief: false
        };
    }

    // ── 3. Schematic Utilities ──────────────────────────────

    function createNet(name, pins) {
        const netObj = { id: _uid('net'), name: name || 'NET', pins: pins || [] };
        netObj.pins.forEach(p => { p.net = netObj.id; });
        return netObj;
    }

    function createWire(startPin, endPin) {
        return {
            id: _uid('W'),
            start: { x: startPin.x, y: startPin.y, pinId: startPin.id },
            end:   { x: endPin.x,   y: endPin.y,   pinId: endPin.id },
            points: [{ x: startPin.x, y: startPin.y }, { x: endPin.x, y: endPin.y }],
            net: startPin.net || endPin.net || null
        };
    }

    function _segIntersectsRect(ax, ay, bx, by, rect) {
        const { x, y, width, height } = rect;
        const l = x, r = x + width, t = y, b = y + height;
        function inside(px, py) { return px >= l && px <= r && py >= t && py <= b; }
        if (inside(ax, ay) || inside(bx, by)) return true;
        function ccw(Ax, Ay, Bx, By, Cx, Cy) {
            return (Cy - Ay) * (Bx - Ax) > (By - Ay) * (Cx - Ax);
        }
        function cross(Ax, Ay, Bx, By, Cx, Cy, Dx, Dy) {
            return ccw(Ax, Ay, Cx, Cy, Dx, Dy) !== ccw(Bx, By, Cx, Cy, Dx, Dy) &&
                   ccw(Ax, Ay, Bx, By, Cx, Cy) !== ccw(Ax, Ay, Bx, By, Dx, Dy);
        }
        const edges = [[l,t,r,t],[r,t,r,b],[r,b,l,b],[l,b,l,t]];
        for (const [cx, cy, dx, dy] of edges) {
            if (cross(ax, ay, bx, by, cx, cy, dx, dy)) return true;
        }
        return false;
    }

    function _routeBlocked(path, obstacles) {
        for (let i = 0; i < path.length - 1; i++) {
            for (const ob of obstacles) {
                const r = ob.bounds || ob;
                if (_segIntersectsRect(path[i].x, path[i].y, path[i+1].x, path[i+1].y, r))
                    return true;
            }
        }
        return false;
    }

    function autoRouteSimple(pin1, pin2, obstacles) {
        const obs = obstacles || [];
        const sx = pin1.x, sy = pin1.y, ex = pin2.x, ey = pin2.y;
        const manhattan = Math.abs(ex - sx) + Math.abs(ey - sy);

        // L-route: horizontal then vertical
        const lPath1 = [{x:sx,y:sy}, {x:ex,y:sy}, {x:ex,y:ey}];
        if (!_routeBlocked(lPath1, obs))
            return { type: 'L', points: lPath1, length: manhattan };

        // L-route: vertical then horizontal
        const lPath2 = [{x:sx,y:sy}, {x:sx,y:ey}, {x:ex,y:ey}];
        if (!_routeBlocked(lPath2, obs))
            return { type: 'L', points: lPath2, length: manhattan };

        // Z-route: horizontal, jog, horizontal
        const mx = (sx + ex) / 2;
        const zPath = [{x:sx,y:sy}, {x:mx,y:sy}, {x:mx,y:ey}, {x:ex,y:ey}];
        if (!_routeBlocked(zPath, obs)) {
            const len = Math.abs(mx - sx) + Math.abs(ey - sy) + Math.abs(ex - mx);
            return { type: 'Z', points: zPath, length: len };
        }

        // Fallback: direct
        return {
            type: 'direct',
            points: [{x:sx,y:sy}, {x:ex,y:ey}],
            length: Math.hypot(ex - sx, ey - sy),
            warning: 'No clear L/Z route found; returning direct path'
        };
    }

    // ── 5. Trace & Routing ──────────────────────────────────

    /** IPC-2221 trace width.  current (A), thickness (oz), tempRise (C) */
    function calculateTraceWidth(current, thickness, tempRise, isExternal) {
        const t = (thickness || 1) * 1.378;   // oz -> mil
        const k = isExternal ? 0.048 : 0.024;
        const area = Math.pow(current / (k * Math.pow(tempRise, 0.44)), 1 / 0.725);
        const widthMil = area / t;
        return {
            widthMil: Math.round(widthMil * 100) / 100,
            widthMm:  Math.round(widthMil * 0.0254 * 1000) / 1000
        };
    }

    /** Characteristic impedance.  w,h,t in mil, er=dielectric const, type='microstrip'|'stripline' */
    function calculateImpedance(w, h, t, er, type) {
        if (type === 'stripline') {
            const wEff = 0.8 * w + t;
            const z = (60 / Math.sqrt(er)) * Math.log(4 * h / (0.67 * Math.PI * wEff));
            return Math.round(z * 100) / 100;
        }
        // Microstrip (Hammerstad-Jensen)
        const wEff = w + (t / Math.PI) * Math.log(4 * Math.E / Math.sqrt(
            Math.pow(t / h, 2) + Math.pow(t / (w * Math.PI + 1.1 * t * Math.PI), 2)
        ));
        const u = wEff / h;
        const erEff = (er + 1) / 2 + ((er - 1) / 2) * Math.pow(1 + 12 / u, -0.5);
        const z = u <= 1
            ? (60 / Math.sqrt(erEff)) * Math.log(8 / u + u / 4)
            : (120 * Math.PI) / (Math.sqrt(erEff) * (u + 1.393 + 0.667 * Math.log(u + 1.444)));
        return Math.round(z * 100) / 100;
    }

    function pathLength(points) {
        let len = 0;
        for (let i = 1; i < points.length; i++)
            len += Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
        return len;
    }

    function createDifferentialPair(centerPath, spacing) {
        const s = spacing / 2;
        const pos = [], neg = [];
        for (let i = 0; i < centerPath.length; i++) {
            let dx, dy;
            if (i < centerPath.length - 1) {
                dx = centerPath[i+1].x - centerPath[i].x;
                dy = centerPath[i+1].y - centerPath[i].y;
            } else {
                dx = centerPath[i].x - centerPath[i-1].x;
                dy = centerPath[i].y - centerPath[i-1].y;
            }
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len, ny = dx / len;
            pos.push({ x: centerPath[i].x + nx * s, y: centerPath[i].y + ny * s });
            neg.push({ x: centerPath[i].x - nx * s, y: centerPath[i].y - ny * s });
        }
        return {
            positive: pos, negative: neg, spacing,
            lengthPos: pathLength(pos), lengthNeg: pathLength(neg),
            skew: Math.abs(pathLength(pos) - pathLength(neg))
        };
    }

    function _ptSegDist(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - ax, py - ay);
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }

    function _segSegDist(a1, a2, b1, b2) {
        return Math.min(
            _ptSegDist(a1.x, a1.y, b1.x, b1.y, b2.x, b2.y),
            _ptSegDist(a2.x, a2.y, b1.x, b1.y, b2.x, b2.y),
            _ptSegDist(b1.x, b1.y, a1.x, a1.y, a2.x, a2.y),
            _ptSegDist(b2.x, b2.y, a1.x, a1.y, a2.x, a2.y)
        );
    }

    function checkClearance(trace1, trace2, minClearance) {
        const violations = [];
        for (let i = 0; i < trace1.length - 1; i++) {
            for (let j = 0; j < trace2.length - 1; j++) {
                const d = _segSegDist(trace1[i], trace1[i+1], trace2[j], trace2[j+1]);
                if (d < minClearance) {
                    violations.push({
                        seg1: [i, i+1], seg2: [j, j+1],
                        distance: Math.round(d * 100) / 100, required: minClearance
                    });
                }
            }
        }
        return {
            pass: violations.length === 0,
            minDistance: violations.length ? Math.min(...violations.map(v => v.distance)) : Infinity,
            violations
        };
    }

    // ── 6. EMC Utilities ────────────────────────────────────

    /** Signal return-path loop area via shoelace formula. */
    function calculateLoopArea(path) {
        let area = 0;
        const n = path.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += path[i].x * path[j].y - path[j].x * path[i].y;
        }
        return Math.abs(area / 2);
    }

    /** Quarter-wave resonant frequency.  length in meters. */
    function resonantFrequency(length) {
        const f = 3e8 / (4 * length);
        return { freqHz: f, freqMHz: Math.round(f / 1e6 * 100) / 100 };
    }

    /** Skin depth (m).  freq Hz, conductivity S/m (copper 5.8e7), rel permeability. */
    function skinDepth(freq, conductivity, permeability) {
        const mu = (permeability || 1) * 4 * Math.PI * 1e-7;
        const sigma = conductivity || 5.8e7;
        return Math.sqrt(1 / (Math.PI * freq * mu * sigma));
    }

    /** Required decoupling cap.  freq Hz, impedance ohms. */
    function decouplingCapValue(freq, impedance) {
        const c = 1 / (2 * Math.PI * freq * impedance);
        let label;
        if (c >= 1e-6)      label = (c * 1e6).toFixed(2) + ' uF';
        else if (c >= 1e-9) label = (c * 1e9).toFixed(2) + ' nF';
        else                label = (c * 1e12).toFixed(2) + ' pF';
        return { farads: c, label };
    }

    // ── 7. Thermal ──────────────────────────────────────────

    /** Thermal resistance (K/W).  area m^2, thickness m, conductivity W/(m*K). */
    function thermalResistance(area, thickness, conductivity) {
        return thickness / ((conductivity || 385) * area);
    }

    /** Joule loss in trace.  current A, resistance ohm/unit, length units. */
    function jouleLoss(current, resistance, length) {
        const w = current * current * resistance * length;
        return { watts: Math.round(w * 1e6) / 1e6, mW: Math.round(w * 1e3 * 1000) / 1000 };
    }

    // ── 8. Drawing Helpers ──────────────────────────────────

    function drawGrid(ctx, width, height, gridSize, scale) {
        const s = scale || 1;
        const step = gridSize * s;
        ctx.save();
        ctx.strokeStyle = PCB_COLORS.grid;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        for (let x = 0; x <= width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = 0; y <= height; y += step) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();
        // Major grid (every 10 cells)
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1;
        const major = step * 10;
        ctx.beginPath();
        for (let x = 0; x <= width; x += major) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
        for (let y = 0; y <= height; y += major) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
        ctx.stroke();
        ctx.restore();
    }

    function drawTrace(ctx, points, width, color) {
        if (!points || points.length < 2) return;
        ctx.save();
        ctx.strokeStyle = color || PCB_COLORS.copper;
        ctx.lineWidth = width || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
        ctx.restore();
    }

    function drawViaOnCanvas(ctx, via, scale) {
        const s = scale || 1;
        const outer = (via.outerDiameter / 2) * s;
        const drill = (via.drill / 2) * s;
        ctx.save();
        ctx.beginPath();
        ctx.arc(via.x * s, via.y * s, outer, 0, Math.PI * 2);
        ctx.fillStyle = PCB_COLORS.copper;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(via.x * s, via.y * s, drill, 0, Math.PI * 2);
        ctx.fillStyle = PCB_COLORS.drill;
        ctx.fill();
        ctx.restore();
    }

    function drawPadOnCanvas(ctx, pad, scale) {
        const s = scale || 1;
        const px = pad.x * s, py = pad.y * s;
        const pw = pad.width * s, ph = pad.height * s;
        ctx.save();
        ctx.fillStyle = PCB_COLORS.pad;
        if (pad.shape === 'round') {
            const r = Math.min(pw, ph) / 2;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
        } else if (pad.shape === 'oblong') {
            const r = Math.min(pw, ph) / 2;
            ctx.beginPath();
            ctx.moveTo(px - pw/2 + r, py - ph/2);
            ctx.lineTo(px + pw/2 - r, py - ph/2);
            ctx.arcTo(px + pw/2, py - ph/2, px + pw/2, py - ph/2 + r, r);
            ctx.lineTo(px + pw/2, py + ph/2 - r);
            ctx.arcTo(px + pw/2, py + ph/2, px + pw/2 - r, py + ph/2, r);
            ctx.lineTo(px - pw/2 + r, py + ph/2);
            ctx.arcTo(px - pw/2, py + ph/2, px - pw/2, py + ph/2 - r, r);
            ctx.lineTo(px - pw/2, py - ph/2 + r);
            ctx.arcTo(px - pw/2, py - ph/2, px - pw/2 + r, py - ph/2, r);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.fillRect(px - pw/2, py - ph/2, pw, ph);
        }
        ctx.restore();
    }

    function _drawResistor(ctx, comp, scale) {
        const s = scale;
        const cx = comp.x * s, cy = comp.y * s;
        const bw = comp.bodyWidth * s, bh = comp.bodyHeight * s;
        const ll = comp.leadLength * s;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((comp.rotation * Math.PI) / 180);
        // Leads
        ctx.strokeStyle = PCB_COLORS.copper;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-bw/2 - ll, 0); ctx.lineTo(-bw/2, 0);
        ctx.moveTo(bw/2, 0);       ctx.lineTo(bw/2 + ll, 0);
        ctx.stroke();
        // Body
        ctx.fillStyle = componentColor('resistor');
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        ctx.fillRect(-bw/2, -bh/2, bw, bh);
        ctx.strokeRect(-bw/2, -bh/2, bw, bh);
        // Value label
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(9, bh * 0.5)}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(comp.value, 0, 0);
        // Pin dots
        ctx.fillStyle = PCB_COLORS.pad;
        ctx.beginPath();
        ctx.arc(-bw/2 - ll, 0, 3, 0, Math.PI * 2);
        ctx.arc(bw/2 + ll, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function _drawCapacitor(ctx, comp, scale) {
        const s = scale;
        const cx = comp.x * s, cy = comp.y * s;
        const bw = comp.bodyWidth * s, bh = comp.bodyHeight * s;
        const ll = comp.leadLength * s;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((comp.rotation * Math.PI) / 180);
        // Leads
        ctx.strokeStyle = PCB_COLORS.copper;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-bw/2 - ll, 0); ctx.lineTo(-bw/2 + 2, 0);
        ctx.moveTo(bw/2 - 2, 0);   ctx.lineTo(bw/2 + ll, 0);
        ctx.stroke();
        // Plates
        ctx.strokeStyle = componentColor('capacitor');
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-3, -bh/2); ctx.lineTo(-3, bh/2);
        ctx.moveTo( 3, -bh/2); ctx.lineTo( 3, bh/2);
        ctx.stroke();
        // Value label
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(8, bh * 0.28)}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(comp.value, 0, bh/2 + 4);
        // Pin dots
        ctx.fillStyle = PCB_COLORS.pad;
        ctx.beginPath();
        ctx.arc(-bw/2 - ll, 0, 3, 0, Math.PI * 2);
        ctx.arc(bw/2 + ll, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function _drawIC(ctx, comp, scale) {
        const s = scale;
        const cx = comp.x * s, cy = comp.y * s;
        const bw = comp.bodyWidth * s, bh = comp.bodyHeight * s;
        ctx.save();
        ctx.translate(cx, cy);
        // Body
        ctx.fillStyle = componentColor('ic');
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        ctx.fillRect(-bw/2, -bh/2, bw, bh);
        ctx.strokeRect(-bw/2, -bh/2, bw, bh);
        // Notch
        ctx.beginPath();
        ctx.arc(0, -bh/2, 6, 0, Math.PI);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        ctx.stroke();
        // Pin 1 dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-bw/2 + 10, -bh/2 + 10, 3, 0, Math.PI * 2);
        ctx.fill();
        // Pins
        ctx.strokeStyle = PCB_COLORS.copper; ctx.lineWidth = 2;
        comp.pins.forEach(pin => {
            const px = (pin.x - comp.x) * s, py = (pin.y - comp.y) * s;
            ctx.beginPath();
            if (pin.side === 'left') { ctx.moveTo(-bw/2, py); ctx.lineTo(px, py); }
            else                     { ctx.moveTo(bw/2, py);  ctx.lineTo(px, py); }
            ctx.stroke();
            ctx.fillStyle = PCB_COLORS.pad;
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
        });
        // Designator
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.max(10, bh * 0.12)}px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(comp.id, 0, 0);
        ctx.restore();
    }

    function drawComponent(ctx, component, layer, scale) {
        const s = scale || 1;
        switch (component.type) {
            case 'resistor':  _drawResistor(ctx, component, s);    break;
            case 'capacitor': _drawCapacitor(ctx, component, s);   break;
            case 'ic':        _drawIC(ctx, component, s);          break;
            case 'via':       drawViaOnCanvas(ctx, component, s);  break;
            case 'pad':       drawPadOnCanvas(ctx, component, s);  break;
            default:
                ctx.save();
                ctx.fillStyle = componentColor(component.type);
                ctx.globalAlpha = 0.6;
                const b = component.bounds;
                if (b) ctx.fillRect(b.x * s, b.y * s, b.width * s, b.height * s);
                ctx.restore();
        }
    }

    function drawLayerStackup(ctx, layers, x, y, width, height) {
        if (!layers || !layers.length) return;
        const totalThickness = layers.reduce((sum, l) => sum + l.thickness, 0);
        const layerScale = height / totalThickness;
        let cy = y;
        ctx.save();
        ctx.font = '11px monospace';
        ctx.textBaseline = 'middle';
        layers.forEach(layer => {
            const lh = Math.max(2, layer.thickness * layerScale);
            let color;
            if (layer.type === 'copper')         color = PCB_COLORS.copper;
            else if (layer.type === 'dielectric') color = PCB_COLORS.substrate;
            else if (layer.type === 'mask')       color = PCB_COLORS.board;
            else                                  color = '#555555';
            ctx.fillStyle = color;
            ctx.fillRect(x, cy, width, lh);
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.5;
            ctx.strokeRect(x, cy, width, lh);
            if (lh >= 8) {
                ctx.fillStyle = layer.type === 'copper' ? '#000000' : '#ffffff';
                ctx.textAlign = 'left';
                ctx.fillText(layer.name, x + 6, cy + lh / 2);
                ctx.textAlign = 'right';
                const thk = layer.thickness >= 0.1
                    ? layer.thickness.toFixed(2) + ' mm'
                    : (layer.thickness * 1000).toFixed(0) + ' um';
                ctx.fillText(thk, x + width - 6, cy + lh / 2);
            }
            cy += lh;
        });
        ctx.restore();
    }

    // ── Public API ──────────────────────────────────────────

    return {
        // 1. Grid & Coordinate
        createGrid, snapToGrid, milToMm, mmToMil, pixelToMil, milToPixel,
        // 2. Component Primitives
        createResistor, createCapacitor, createIC, createVia, createPad,
        // 3. Schematic Utilities
        createNet, createWire, autoRouteSimple,
        // 4. Layer System
        LAYERS, createLayerStack, getLayerColor,
        // 5. Trace & Routing
        calculateTraceWidth, calculateImpedance, pathLength,
        createDifferentialPair, checkClearance,
        // 6. EMC
        calculateLoopArea, resonantFrequency, skinDepth, decouplingCapValue,
        // 7. Thermal
        thermalResistance, jouleLoss,
        // 8. Drawing Helpers
        drawComponent, drawTrace, drawViaOnCanvas, drawPadOnCanvas,
        drawGrid, drawLayerStackup,
        // 9. Color & Style
        PCB_COLORS, componentColor
    };
})();
