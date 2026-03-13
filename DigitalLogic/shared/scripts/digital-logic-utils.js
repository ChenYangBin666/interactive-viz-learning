/**
 * digital-logic-utils.js — 数字逻辑工具集
 * 逻辑门运算、真值表生成、布尔代数、电路模拟、可视化辅助
 */

/* roundRect polyfill for older browsers */
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'number') r = [r, r, r, r];
        const [tl, tr, br, bl] = r;
        this.moveTo(x + tl, y);
        this.arcTo(x + w, y, x + w, y + h, tr);
        this.arcTo(x + w, y + h, x, y + h, br);
        this.arcTo(x, y + h, x, y, bl);
        this.arcTo(x, y, x + w, y, tl);
    };
}

const DLUtils = (() => {
    'use strict';

    /* ===== 1. Color Constants ===== */
    const COLORS = {
        green: '#16c79a', blue: '#4fc3f7', purple: '#b388ff',
        orange: '#ffab40', red: '#ff5252', yellow: '#ffd740', pink: '#ff80ab',
        bg: '#1a1a2e', bgSec: '#16213e', bgCard: '#0f3460',
        textPri: '#e8e8e8', textSec: '#a8a8b8', textMut: '#6c6c7c',
        border: '#2a2a4a',
        high: '#16c79a',   // logic HIGH color
        low: '#6c6c7c',    // logic LOW color
        wire: '#4fc3f7',   // wire color
        wireActive: '#16c79a', // active wire
        gate: '#b388ff',   // gate fill
    };

    /* ===== 2. Logic Gate Functions ===== */
    function AND(...inputs) { return inputs.every(v => v === 1) ? 1 : 0; }
    function OR(...inputs) { return inputs.some(v => v === 1) ? 1 : 0; }
    function NOT(a) { return a === 1 ? 0 : 1; }
    function NAND(...inputs) { return NOT(AND(...inputs)); }
    function NOR(...inputs) { return NOT(OR(...inputs)); }
    function XOR(a, b) { return a !== b ? 1 : 0; }
    function XNOR(a, b) { return a === b ? 1 : 0; }

    const GATES = { AND, OR, NOT, NAND, NOR, XOR, XNOR };

    /* ===== 3. Truth Table Generation ===== */
    function generateTruthTable(numInputs, fn) {
        const rows = [];
        const total = 1 << numInputs;
        for (let i = 0; i < total; i++) {
            const inputs = [];
            for (let bit = numInputs - 1; bit >= 0; bit--) {
                inputs.push((i >> bit) & 1);
            }
            const output = fn(...inputs);
            rows.push({ inputs, output });
        }
        return rows;
    }

    /* ===== 4. Boolean Expression Evaluation ===== */
    function evalBoolExpr(expr, vars) {
        let s = expr;
        for (const [k, v] of Object.entries(vars)) {
            s = s.replace(new RegExp('\\b' + k + '\\b', 'g'), v.toString());
        }
        s = s.replace(/NOT\s*\(([^)]+)\)/gi, (_, inner) => NOT(parseInt(inner)));
        s = s.replace(/'/g, m => ''); // handle A' notation later
        try {
            s = s.replace(/AND/gi, '&&').replace(/OR/gi, '||').replace(/NOT/gi, '!');
            return Function('"use strict"; return (' + s + ') ? 1 : 0;')();
        } catch {
            return 0;
        }
    }

    /* ===== 5. Binary Arithmetic ===== */
    function halfAdder(a, b) {
        return { sum: XOR(a, b), carry: AND(a, b) };
    }

    function fullAdder(a, b, cin) {
        const first = halfAdder(a, b);
        const second = halfAdder(first.sum, cin);
        return { sum: second.sum, carry: OR(first.carry, second.carry) };
    }

    function rippleCarryAdd(a, b, bits) {
        const result = [];
        let carry = 0;
        for (let i = 0; i < bits; i++) {
            const bitA = (a >> i) & 1;
            const bitB = (b >> i) & 1;
            const fa = fullAdder(bitA, bitB, carry);
            result.push(fa.sum);
            carry = fa.carry;
        }
        return { bits: result, carry, value: result.reduce((acc, b, i) => acc + (b << i), 0) + (carry << bits) };
    }

    /* ===== 6. Karnaugh Map ===== */
    function generateKMap(numVars, truthTable) {
        if (numVars === 2) {
            // 2x2 kmap: rows=A, cols=B
            const map = [[0, 0], [0, 0]];
            truthTable.forEach(row => {
                map[row.inputs[0]][row.inputs[1]] = row.output;
            });
            return { map, rowLabels: ['0', '1'], colLabels: ['0', '1'] };
        }
        if (numVars === 3) {
            // 2x4 kmap: rows=A, cols=BC in Gray code
            const map = [[0, 0, 0, 0], [0, 0, 0, 0]];
            const grayOrder = [0, 1, 3, 2]; // 00, 01, 11, 10
            truthTable.forEach(row => {
                const r = row.inputs[0];
                const bc = row.inputs[1] * 2 + row.inputs[2];
                const c = grayOrder.indexOf(bc);
                map[r][c] = row.output;
            });
            return { map, rowLabels: ['0', '1'], colLabels: ['00', '01', '11', '10'] };
        }
        if (numVars === 4) {
            // 4x4 kmap: rows=AB, cols=CD in Gray code
            const map = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
            const grayOrder = [0, 1, 3, 2];
            truthTable.forEach(row => {
                const ab = row.inputs[0] * 2 + row.inputs[1];
                const cd = row.inputs[2] * 2 + row.inputs[3];
                const r = grayOrder.indexOf(ab);
                const c = grayOrder.indexOf(cd);
                map[r][c] = row.output;
            });
            return { map, rowLabels: ['00', '01', '11', '10'], colLabels: ['00', '01', '11', '10'] };
        }
        return null;
    }

    /* ===== 7. FSM Simulation ===== */
    function createFSM(states, transitions, initialState) {
        let current = initialState;
        const history = [current];

        function step(input) {
            const key = current + ',' + input;
            const t = transitions[key];
            if (t) {
                current = t.next;
                history.push(current);
                return { state: current, output: t.output };
            }
            history.push(current);
            return { state: current, output: null };
        }

        function reset() {
            current = initialState;
            history.length = 0;
            history.push(current);
        }

        return { step, reset, getState: () => current, getHistory: () => [...history] };
    }

    /* ===== 8. Signal / Waveform Generation ===== */
    function generateClock(periods, samplesPerPeriod) {
        const signal = [];
        for (let p = 0; p < periods; p++) {
            for (let s = 0; s < samplesPerPeriod; s++) {
                signal.push(s < samplesPerPeriod / 2 ? 1 : 0);
            }
        }
        return signal;
    }

    function generateSignal(values, samplesPerBit) {
        const signal = [];
        for (const v of values) {
            for (let s = 0; s < samplesPerBit; s++) {
                signal.push(v);
            }
        }
        return signal;
    }

    /* ===== 9. Canvas Drawing Helpers ===== */
    function initCanvas(canvas, height) {
        const dpr = window.devicePixelRatio || 1;
        const parent = canvas.parentElement;
        const w = parent ? parent.getBoundingClientRect().width : canvas.clientWidth;
        const h = height || 400;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        return { ctx, w, h, dpr };
    }

    function drawWire(ctx, x1, y1, x2, y2, active, opts = {}) {
        ctx.save();
        ctx.strokeStyle = active ? COLORS.wireActive : COLORS.wire;
        ctx.lineWidth = opts.width || 2;
        ctx.lineCap = 'round';
        if (opts.dashed) ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        if (opts.elbow) {
            const midX = (x1 + x2) / 2;
            ctx.lineTo(midX, y1);
            ctx.lineTo(midX, y2);
        }
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    function drawGateBody(ctx, x, y, w, h, label, opts = {}) {
        ctx.save();
        ctx.fillStyle = opts.fill || COLORS.bgCard;
        ctx.strokeStyle = opts.stroke || COLORS.gate;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = opts.textColor || COLORS.textPri;
        ctx.font = opts.font || 'bold 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + w / 2, y + h / 2);
        ctx.restore();
    }

    function drawBit(ctx, x, y, value, radius) {
        const r = radius || 14;
        ctx.save();
        ctx.fillStyle = value ? COLORS.high : COLORS.low;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = value ? '#000' : COLORS.textMut;
        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(value.toString(), x, y);
        ctx.restore();
    }

    function drawTimingDiagram(ctx, x, y, w, h, signal, label, color) {
        const stepW = w / signal.length;
        ctx.save();
        // label
        ctx.fillStyle = color || COLORS.textSec;
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x - 8, y + h / 2);
        // waveform
        ctx.strokeStyle = color || COLORS.green;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < signal.length; i++) {
            const sx = x + i * stepW;
            const sy = signal[i] ? y : y + h;
            if (i === 0) {
                ctx.moveTo(sx, sy);
            } else {
                const prevY = signal[i - 1] ? y : y + h;
                if (prevY !== sy) {
                    ctx.lineTo(sx, prevY);
                }
                ctx.lineTo(sx, sy);
            }
        }
        ctx.lineTo(x + signal.length * stepW, signal[signal.length - 1] ? y : y + h);
        ctx.stroke();
        // grid lines
        ctx.strokeStyle = COLORS.border;
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 4]);
        for (let i = 0; i <= signal.length; i += Math.max(1, Math.floor(signal.length / 16))) {
            ctx.beginPath();
            ctx.moveTo(x + i * stepW, y - 2);
            ctx.lineTo(x + i * stepW, y + h + 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    /* ===== 10. Seeded Random ===== */
    function seededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    /* ===== Public API ===== */
    return {
        COLORS,
        // Gates
        AND, OR, NOT, NAND, NOR, XOR, XNOR, GATES,
        // Truth table
        generateTruthTable,
        // Boolean
        evalBoolExpr,
        // Arithmetic
        halfAdder, fullAdder, rippleCarryAdd,
        // Karnaugh
        generateKMap,
        // FSM
        createFSM,
        // Signals
        generateClock, generateSignal,
        // Canvas
        initCanvas, drawWire, drawGateBody, drawBit, drawTimingDiagram,
        // Random
        seededRandom,
    };
})();
