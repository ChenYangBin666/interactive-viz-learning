/**
 * isa-utils.js — 指令集与微架构工具集
 * 指令编码/解码、流水线模拟、分支预测、乱序执行可视化辅助
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

const ISAUtils = (() => {
    'use strict';

    /* ===== 1. Color Constants ===== */
    const COLORS = {
        green: '#16c79a', blue: '#4fc3f7', purple: '#b388ff',
        orange: '#ffab40', red: '#ff5252', yellow: '#ffd740', pink: '#ff80ab',
        cyan: '#80deea',
        bg: '#1a1a2e', bgSec: '#16213e', bgCard: '#0f3460',
        textPri: '#e8e8e8', textSec: '#a8a8b8', textMut: '#6c6c7c',
        border: '#2a2a4a',
        // Pipeline stage colors
        fetch: '#4fc3f7',
        decode: '#b388ff',
        execute: '#16c79a',
        memory: '#ffab40',
        writeback: '#ff80ab',
        stall: '#ff5252',
        bubble: '#6c6c7c',
    };

    /* Stage short names */
    const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'];
    const STAGE_COLORS = [COLORS.fetch, COLORS.decode, COLORS.execute, COLORS.memory, COLORS.writeback];

    /* ===== 2. RISC-V Instruction Encoding ===== */
    const RISCV_OPCODES = {
        'R': { opcode: '0110011', format: 'R-type', fields: ['funct7','rs2','rs1','funct3','rd','opcode'] },
        'I': { opcode: '0010011', format: 'I-type', fields: ['imm[11:0]','rs1','funct3','rd','opcode'] },
        'S': { opcode: '0100011', format: 'S-type', fields: ['imm[11:5]','rs2','rs1','funct3','imm[4:0]','opcode'] },
        'B': { opcode: '1100011', format: 'B-type', fields: ['imm[12|10:5]','rs2','rs1','funct3','imm[4:1|11]','opcode'] },
        'U': { opcode: '0110111', format: 'U-type', fields: ['imm[31:12]','rd','opcode'] },
        'J': { opcode: '1101111', format: 'J-type', fields: ['imm[20|10:1|11|19:12]','rd','opcode'] },
    };

    const RISCV_INSTS = {
        'add':  { type: 'R', funct3: '000', funct7: '0000000', desc: '加法' },
        'sub':  { type: 'R', funct3: '000', funct7: '0100000', desc: '减法' },
        'and':  { type: 'R', funct3: '111', funct7: '0000000', desc: '按位与' },
        'or':   { type: 'R', funct3: '110', funct7: '0000000', desc: '按位或' },
        'xor':  { type: 'R', funct3: '100', funct7: '0000000', desc: '按位异或' },
        'sll':  { type: 'R', funct3: '001', funct7: '0000000', desc: '逻辑左移' },
        'srl':  { type: 'R', funct3: '101', funct7: '0000000', desc: '逻辑右移' },
        'slt':  { type: 'R', funct3: '010', funct7: '0000000', desc: '小于置位' },
        'addi': { type: 'I', funct3: '000', desc: '立即数加法' },
        'andi': { type: 'I', funct3: '111', desc: '立即数与' },
        'ori':  { type: 'I', funct3: '110', desc: '立即数或' },
        'lw':   { type: 'I', funct3: '010', opcode: '0000011', desc: '加载字' },
        'sw':   { type: 'S', funct3: '010', desc: '存储字' },
        'beq':  { type: 'B', funct3: '000', desc: '相等跳转' },
        'bne':  { type: 'B', funct3: '001', desc: '不等跳转' },
        'jal':  { type: 'J', desc: '跳转并链接' },
        'lui':  { type: 'U', desc: '高位立即数加载' },
    };

    function regNum(name) {
        if (name === 'zero') return 0;
        const m = name.match(/x(\d+)/);
        return m ? parseInt(m[1]) : 0;
    }

    function toBin(n, bits) {
        return (n >>> 0).toString(2).padStart(bits, '0');
    }

    /* ===== 3. Pipeline Simulation ===== */
    function createPipeline(instructions) {
        const stages = STAGES.length;
        const grid = []; // grid[cycle][stage] = instruction index or null
        const n = instructions.length;
        for (let i = 0; i < n + stages - 1; i++) {
            grid.push(new Array(stages).fill(null));
        }
        // Simple pipeline without hazards
        for (let i = 0; i < n; i++) {
            for (let s = 0; s < stages; s++) {
                if (i + s < grid.length) {
                    grid[i + s][s] = i;
                }
            }
        }
        return grid;
    }

    function createPipelineWithHazards(instructions, hazards) {
        // hazards: array of { type: 'data'|'control'|'structural', afterInst: index, stallCycles: number }
        const stages = STAGES.length;
        const n = instructions.length;
        const startCycle = new Array(n).fill(0);

        // Calculate start cycles considering stalls
        for (let i = 1; i < n; i++) {
            startCycle[i] = startCycle[i - 1] + 1;
            for (const h of hazards) {
                if (h.afterInst === i - 1) {
                    startCycle[i] = Math.max(startCycle[i], startCycle[i - 1] + 1 + h.stallCycles);
                }
            }
        }

        const totalCycles = (n > 0 ? startCycle[n - 1] + stages : stages);
        const grid = [];
        for (let c = 0; c < totalCycles; c++) {
            grid.push(new Array(stages).fill(null));
        }

        for (let i = 0; i < n; i++) {
            for (let s = 0; s < stages; s++) {
                const cycle = startCycle[i] + s;
                if (cycle < totalCycles) {
                    grid[cycle][s] = i;
                }
            }
        }

        return { grid, startCycle, totalCycles };
    }

    /* ===== 4. Branch Prediction ===== */
    function createBranchPredictor(type) {
        if (type === 'static-taken') {
            return { predict: () => true, update: () => {}, getState: () => 'Always Taken' };
        }
        if (type === 'static-not-taken') {
            return { predict: () => false, update: () => {}, getState: () => 'Always Not Taken' };
        }
        if (type === '1bit') {
            let state = false; // last outcome
            return {
                predict: () => state,
                update: (taken) => { state = taken; },
                getState: () => state ? 'Predict Taken' : 'Predict Not Taken',
                getStateNum: () => state ? 1 : 0,
            };
        }
        if (type === '2bit') {
            let state = 1; // 0=strongly NT, 1=weakly NT, 2=weakly T, 3=strongly T
            return {
                predict: () => state >= 2,
                update: (taken) => {
                    if (taken) state = Math.min(3, state + 1);
                    else state = Math.max(0, state - 1);
                },
                getState: () => ['强不跳转', '弱不跳转', '弱跳转', '强跳转'][state],
                getStateNum: () => state,
            };
        }
        return null;
    }

    /* ===== 5. Out-of-Order Helpers ===== */
    function createROB(size) {
        const entries = [];
        let head = 0, tail = 0;
        return {
            enqueue(inst) {
                if (entries.length >= size) return null;
                const entry = { inst, ready: false, result: null, id: tail++ };
                entries.push(entry);
                return entry;
            },
            commit() {
                if (entries.length > 0 && entries[0].ready) {
                    return entries.shift();
                }
                return null;
            },
            markReady(id, result) {
                const e = entries.find(e => e.id === id);
                if (e) { e.ready = true; e.result = result; }
            },
            getEntries: () => [...entries],
            isFull: () => entries.length >= size,
            isEmpty: () => entries.length === 0,
        };
    }

    /* ===== 6. Canvas Drawing Helpers ===== */
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

    function drawPipelineStage(ctx, x, y, w, h, stageIdx, label, opts = {}) {
        const color = opts.color || STAGE_COLORS[stageIdx] || COLORS.blue;
        ctx.save();
        ctx.fillStyle = opts.stall ? COLORS.stall : (opts.bubble ? 'rgba(108,108,124,0.3)' : hexToRgba(color, 0.15));
        ctx.strokeStyle = opts.stall ? COLORS.stall : color;
        ctx.lineWidth = opts.stall ? 2 : 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = opts.stall ? '#fff' : color;
        ctx.font = `bold ${Math.min(12, h * 0.5)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label || STAGES[stageIdx], x + w / 2, y + h / 2);
        ctx.restore();
    }

    function drawRegister(ctx, x, y, w, h, name, value, highlight) {
        ctx.save();
        ctx.fillStyle = highlight ? hexToRgba(COLORS.green, 0.15) : COLORS.bgCard;
        ctx.strokeStyle = highlight ? COLORS.green : COLORS.border;
        ctx.lineWidth = highlight ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = COLORS.textMut;
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, x + 4, y + h / 2);
        ctx.fillStyle = highlight ? COLORS.green : COLORS.textPri;
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(value != null ? value.toString() : '-', x + w - 4, y + h / 2);
        ctx.restore();
    }

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    function drawArrow(ctx, x1, y1, x2, y2, color, opts = {}) {
        const headLen = opts.headLen || 8;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.save();
        ctx.strokeStyle = color || COLORS.blue;
        ctx.fillStyle = color || COLORS.blue;
        ctx.lineWidth = opts.width || 2;
        if (opts.dashed) ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /* ===== 7. Seeded Random ===== */
    function seededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    /* ===== Public API ===== */
    return {
        COLORS, STAGES, STAGE_COLORS,
        RISCV_OPCODES, RISCV_INSTS,
        regNum, toBin,
        createPipeline, createPipelineWithHazards,
        createBranchPredictor,
        createROB,
        initCanvas, drawPipelineStage, drawRegister, drawArrow, hexToRgba,
        seededRandom,
    };
})();
