/**
 * rnn-utils.js — RNN & LSTM 工具集
 * 序列数据生成、RNN/LSTM/GRU 前向传播、梯度计算、可视化辅助
 */

const RNNUtils = (() => {
    /* === 随机数 === */
    function seededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    /* === 数学工具 === */
    function sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))); }
    function tanh(x) { return Math.tanh(x); }
    function softmax(arr) {
        const max = Math.max(...arr);
        const exps = arr.map(x => Math.exp(x - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        return exps.map(e => e / sum);
    }
    function relu(x) { return Math.max(0, x); }

    /* === 向量/矩阵运算 === */
    function vecAdd(a, b) { return a.map((v, i) => v + (b[i] || 0)); }
    function vecScale(a, s) { return a.map(v => v * s); }
    function vecMul(a, b) { return a.map((v, i) => v * (b[i] || 0)); }  // element-wise
    function dot(a, b) { return a.reduce((s, v, i) => s + v * (b[i] || 0), 0); }
    function vecNorm(a) { return Math.sqrt(a.reduce((s, v) => s + v * v, 0)); }

    function matVecMul(M, v) {
        return M.map(row => dot(row, v));
    }

    function matMul(A, B) {
        const rows = A.length, cols = B[0].length, inner = B.length;
        const C = Array.from({ length: rows }, () => new Array(cols).fill(0));
        for (let i = 0; i < rows; i++)
            for (let j = 0; j < cols; j++)
                for (let k = 0; k < inner; k++)
                    C[i][j] += A[i][k] * B[k][j];
        return C;
    }

    function transpose(M) {
        const rows = M.length, cols = M[0].length;
        return Array.from({ length: cols }, (_, j) => Array.from({ length: rows }, (_, i) => M[i][j]));
    }

    function randomMatrix(rows, cols, scale = 0.5, seed = 42) {
        const rng = seededRandom(seed);
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => (rng() - 0.5) * 2 * scale)
        );
    }

    function randomVector(n, scale = 0.5, seed = 42) {
        const rng = seededRandom(seed);
        return Array.from({ length: n }, () => (rng() - 0.5) * 2 * scale);
    }

    function zerosVector(n) { return new Array(n).fill(0); }
    function zerosMatrix(rows, cols) {
        return Array.from({ length: rows }, () => new Array(cols).fill(0));
    }

    /* === 序列数据生成 === */
    function generateSineSequence(length, freq = 0.1, noise = 0.1, seed = 42) {
        const rng = seededRandom(seed);
        return Array.from({ length }, (_, t) =>
            Math.sin(2 * Math.PI * freq * t) + (rng() - 0.5) * noise * 2
        );
    }

    function generateTextSequence(text) {
        const chars = [...new Set(text.split(''))].sort();
        const charToIdx = {};
        chars.forEach((c, i) => charToIdx[c] = i);
        const indices = text.split('').map(c => charToIdx[c]);
        return { chars, charToIdx, indices, vocabSize: chars.length };
    }

    function generateBinarySequence(length, seed = 42) {
        const rng = seededRandom(seed);
        return Array.from({ length }, () => rng() > 0.5 ? 1 : 0);
    }

    function generateCountingTask(seqLen, maxVal = 5, seed = 42) {
        const rng = seededRandom(seed);
        const sequence = Array.from({ length: seqLen }, () => Math.floor(rng() * (maxVal + 1)));
        const target = sequence.reduce((a, b) => a + b, 0);
        return { sequence, target };
    }

    function generateAdditionTask(seqLen = 10, seed = 42) {
        const rng = seededRandom(seed);
        const values = Array.from({ length: seqLen }, () => rng());
        const markers = new Array(seqLen).fill(0);
        const idx1 = Math.floor(rng() * (seqLen / 2));
        const idx2 = Math.floor(rng() * (seqLen / 2)) + Math.floor(seqLen / 2);
        markers[idx1] = 1;
        markers[idx2] = 1;
        const target = values[idx1] + values[idx2];
        return { values, markers, target, indices: [idx1, idx2] };
    }

    /* === One-Hot 编码 === */
    function oneHot(index, size) {
        const vec = new Array(size).fill(0);
        vec[index] = 1;
        return vec;
    }

    function oneHotSequence(indices, vocabSize) {
        return indices.map(i => oneHot(i, vocabSize));
    }

    /* === Vanilla RNN === */
    function rnnCell(x, hPrev, Wxh, Whh, bh) {
        const xPart = matVecMul(Wxh, x);
        const hPart = matVecMul(Whh, hPrev);
        const raw = vecAdd(vecAdd(xPart, hPart), bh);
        const hNew = raw.map(v => tanh(v));
        return { h: hNew, raw, xPart, hPart };
    }

    function rnnForward(xs, h0, Wxh, Whh, bh) {
        const steps = [];
        let h = h0;
        for (let t = 0; t < xs.length; t++) {
            const result = rnnCell(xs[t], h, Wxh, Whh, bh);
            steps.push({ t, x: xs[t], hPrev: h, ...result });
            h = result.h;
        }
        return { steps, finalH: h };
    }

    /* === LSTM === */
    function lstmCell(x, hPrev, cPrev, Wf, Wi, Wc, Wo, bf, bi, bc, bo) {
        const concat = [...hPrev, ...x];

        const fRaw = vecAdd(matVecMul(Wf, concat), bf);
        const f = fRaw.map(v => sigmoid(v));

        const iRaw = vecAdd(matVecMul(Wi, concat), bi);
        const i = iRaw.map(v => sigmoid(v));

        const cCandRaw = vecAdd(matVecMul(Wc, concat), bc);
        const cCand = cCandRaw.map(v => tanh(v));

        const oRaw = vecAdd(matVecMul(Wo, concat), bo);
        const o = oRaw.map(v => sigmoid(v));

        const cNew = vecAdd(vecMul(f, cPrev), vecMul(i, cCand));
        const hNew = vecMul(o, cNew.map(v => tanh(v)));

        return {
            h: hNew, c: cNew,
            gates: { f, i, cCand, o },
            raw: { fRaw, iRaw, cCandRaw, oRaw },
            concat,
        };
    }

    function lstmForward(xs, h0, c0, params) {
        const { Wf, Wi, Wc, Wo, bf, bi, bc, bo } = params;
        const steps = [];
        let h = h0, c = c0;
        for (let t = 0; t < xs.length; t++) {
            const result = lstmCell(xs[t], h, c, Wf, Wi, Wc, Wo, bf, bi, bc, bo);
            steps.push({ t, x: xs[t], hPrev: h, cPrev: c, ...result });
            h = result.h;
            c = result.c;
        }
        return { steps, finalH: h, finalC: c };
    }

    function createLSTMParams(hiddenSize, inputSize, seed = 42) {
        const concatSize = hiddenSize + inputSize;
        let s = seed;
        const next = () => { s += 137; return s; };
        return {
            Wf: randomMatrix(hiddenSize, concatSize, 0.3, next()),
            Wi: randomMatrix(hiddenSize, concatSize, 0.3, next()),
            Wc: randomMatrix(hiddenSize, concatSize, 0.3, next()),
            Wo: randomMatrix(hiddenSize, concatSize, 0.3, next()),
            bf: Array.from({ length: hiddenSize }, () => 1),   // forget bias init to 1
            bi: randomVector(hiddenSize, 0.1, next()),
            bc: randomVector(hiddenSize, 0.1, next()),
            bo: randomVector(hiddenSize, 0.1, next()),
        };
    }

    /* === GRU === */
    function gruCell(x, hPrev, Wz, Wr, Wh, bz, br, bh) {
        const concat = [...hPrev, ...x];

        const zRaw = vecAdd(matVecMul(Wz, concat), bz);
        const z = zRaw.map(v => sigmoid(v));

        const rRaw = vecAdd(matVecMul(Wr, concat), br);
        const r = rRaw.map(v => sigmoid(v));

        const rh = vecMul(r, hPrev);
        const concatR = [...rh, ...x];
        const hCandRaw = vecAdd(matVecMul(Wh, concatR), bh);
        const hCand = hCandRaw.map(v => tanh(v));

        const ones = hPrev.map(() => 1);
        const hNew = vecAdd(vecMul(vecAdd(ones, vecScale(z, -1)), hPrev), vecMul(z, hCand));

        return {
            h: hNew,
            gates: { z, r, hCand },
            raw: { zRaw, rRaw, hCandRaw },
            concat,
        };
    }

    function gruForward(xs, h0, params) {
        const { Wz, Wr, Wh, bz, br, bh } = params;
        const steps = [];
        let h = h0;
        for (let t = 0; t < xs.length; t++) {
            const result = gruCell(xs[t], h, Wz, Wr, Wh, bz, br, bh);
            steps.push({ t, x: xs[t], hPrev: h, ...result });
            h = result.h;
        }
        return { steps, finalH: h };
    }

    function createGRUParams(hiddenSize, inputSize, seed = 42) {
        const concatSize = hiddenSize + inputSize;
        let s = seed;
        const next = () => { s += 137; return s; };
        return {
            Wz: randomMatrix(hiddenSize, concatSize, 0.3, next()),
            Wr: randomMatrix(hiddenSize, concatSize, 0.3, next()),
            Wh: randomMatrix(hiddenSize, concatSize, 0.3, next()),
            bz: randomVector(hiddenSize, 0.1, next()),
            br: randomVector(hiddenSize, 0.1, next()),
            bh: randomVector(hiddenSize, 0.1, next()),
        };
    }

    /* === 梯度分析 === */
    function computeGradientNorms(steps, Why) {
        const T = steps.length;
        const norms = [];
        for (let t = 0; t < T; t++) {
            const h = steps[t].h;
            const norm = vecNorm(h);
            norms.push(norm);
        }
        return norms;
    }

    function jacobianNorm(Whh, h) {
        const n = h.length;
        let norm = 0;
        for (let i = 0; i < n; i++) {
            const dtanh = 1 - h[i] * h[i];
            for (let j = 0; j < n; j++) {
                const val = Whh[i][j] * dtanh;
                norm += val * val;
            }
        }
        return Math.sqrt(norm);
    }

    function gradientFlowAnalysis(Whh, steps) {
        const norms = [];
        for (let t = 0; t < steps.length; t++) {
            const jNorm = jacobianNorm(Whh, steps[t].h);
            norms.push(jNorm);
        }
        // Cumulative product to show gradient flow from end to start
        const cumulativeNorms = [];
        let cum = 1;
        for (let t = norms.length - 1; t >= 0; t--) {
            cum *= norms[t];
            cumulativeNorms.unshift(cum);
        }
        return { stepNorms: norms, cumulativeNorms };
    }

    /* === 输出层 === */
    function outputLayer(h, Why, by) {
        const raw = vecAdd(matVecMul(Why, h), by);
        return raw;
    }

    function classifySequence(h, Why, by) {
        const logits = outputLayer(h, Why, by);
        const probs = softmax(logits);
        const pred = probs.indexOf(Math.max(...probs));
        return { logits, probs, pred };
    }

    /* === 损失函数 === */
    function crossEntropyLoss(probs, target) {
        return -Math.log(probs[target] + 1e-10);
    }

    function mseLoss(pred, target) {
        if (Array.isArray(pred)) {
            return pred.reduce((s, p, i) => s + (p - target[i]) ** 2, 0) / pred.length;
        }
        return (pred - target) ** 2;
    }

    /* === 可视化辅助 === */
    const GATE_COLORS = {
        forget: '#ff5252',
        input: '#4fc3f7',
        candidate: '#16c79a',
        output: '#ffab40',
        update: '#4fc3f7',
        reset: '#ff5252',
    };

    function valueToColor(value, min = -1, max = 1) {
        const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
        if (t < 0.5) {
            const s = t * 2;
            return `rgb(${Math.round(255 * (1 - s))}, ${Math.round(82 + 117 * s)}, ${Math.round(82 + 72 * s)})`;
        } else {
            const s = (t - 0.5) * 2;
            return `rgba(22, 199, 154, ${0.5 + s * 0.5})`;
        }
    }

    function gateToColor(value) {
        // 0=red/closed, 1=green/open
        const r = Math.round(255 * (1 - value));
        const g = Math.round(200 * value);
        return `rgb(${r}, ${g}, 80)`;
    }

    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    return {
        seededRandom,
        sigmoid, tanh, softmax, relu,
        vecAdd, vecScale, vecMul, dot, vecNorm,
        matVecMul, matMul, transpose,
        randomMatrix, randomVector, zerosVector, zerosMatrix,
        generateSineSequence, generateTextSequence, generateBinarySequence,
        generateCountingTask, generateAdditionTask,
        oneHot, oneHotSequence,
        rnnCell, rnnForward,
        lstmCell, lstmForward, createLSTMParams,
        gruCell, gruForward, createGRUParams,
        computeGradientNorms, jacobianNorm, gradientFlowAnalysis,
        outputLayer, classifySequence,
        crossEntropyLoss, mseLoss,
        GATE_COLORS, valueToColor, gateToColor,
        lerp, clamp,
    };
})();
