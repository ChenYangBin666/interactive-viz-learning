/**
 * math-utils.js — 前置知识数学工具集
 * 向量运算、矩阵运算、微积分、概率、神经网络基础
 */

const MathUtils = (() => {
    /* === 随机数 === */
    function seededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    function randomMatrix(rows, cols, seed = 42, scale = 1) {
        const rng = seededRandom(seed);
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => (rng() * 2 - 1) * scale)
        );
    }

    function randomVector(len, seed = 42, scale = 1) {
        const rng = seededRandom(seed);
        return Array.from({ length: len }, () => (rng() * 2 - 1) * scale);
    }

    /* === 向量运算 === */
    function vecAdd(a, b) { return a.map((v, i) => v + b[i]); }
    function vecSub(a, b) { return a.map((v, i) => v - b[i]); }
    function vecScale(v, s) { return v.map(x => x * s); }
    function vecDot(a, b) { return a.reduce((s, v, i) => s + v * b[i], 0); }
    function vecNorm(v) { return Math.sqrt(v.reduce((s, x) => s + x * x, 0)); }
    function vecNormalize(v) { const n = vecNorm(v); return n === 0 ? v : vecScale(v, 1 / n); }
    function vecCross2D(a, b) { return a[0] * b[1] - a[1] * b[0]; }
    function vecAngle(a, b) {
        const cos = vecDot(a, b) / (vecNorm(a) * vecNorm(b) + 1e-12);
        return Math.acos(Math.max(-1, Math.min(1, cos)));
    }
    function vecLerp(a, b, t) { return a.map((v, i) => v + (b[i] - v) * t); }
    function vecProject(a, b) {
        const scalar = vecDot(a, b) / (vecDot(b, b) + 1e-12);
        return vecScale(b, scalar);
    }

    /* === 矩阵运算 === */
    function matmul(A, B) {
        const m = A.length, n = B[0].length, k = B.length;
        return Array.from({ length: m }, (_, i) =>
            Array.from({ length: n }, (_, j) => {
                let sum = 0;
                for (let p = 0; p < k; p++) sum += A[i][p] * B[p][j];
                return sum;
            })
        );
    }

    function transpose(M) {
        if (M.length === 0) return [];
        return M[0].map((_, j) => M.map(row => row[j]));
    }

    function matAdd(A, B) { return A.map((row, i) => row.map((v, j) => v + B[i][j])); }
    function matScale(M, s) { return M.map(row => row.map(v => v * s)); }

    function zeros(rows, cols) {
        return Array.from({ length: rows }, () => new Array(cols).fill(0));
    }

    function eye(n) {
        return Array.from({ length: n }, (_, i) =>
            Array.from({ length: n }, (_, j) => i === j ? 1 : 0)
        );
    }

    function det2x2(M) { return M[0][0] * M[1][1] - M[0][1] * M[1][0]; }

    function inverse2x2(M) {
        const d = det2x2(M);
        if (Math.abs(d) < 1e-10) return null;
        return [
            [M[1][1] / d, -M[0][1] / d],
            [-M[1][0] / d, M[0][0] / d]
        ];
    }

    function trace(M) {
        let s = 0;
        for (let i = 0; i < Math.min(M.length, M[0].length); i++) s += M[i][i];
        return s;
    }

    // 矩阵×向量
    function matvec(M, v) {
        return M.map(row => row.reduce((s, val, i) => s + val * v[i], 0));
    }

    /* === 特征值（2×2 解析解）=== */
    function eigenvalues2x2(M) {
        const a = M[0][0], b = M[0][1], c = M[1][0], d = M[1][1];
        const tr = a + d;
        const det = a * d - b * c;
        const disc = tr * tr - 4 * det;
        if (disc < 0) return { real: [tr / 2, tr / 2], imag: [Math.sqrt(-disc) / 2, -Math.sqrt(-disc) / 2] };
        const sqrtDisc = Math.sqrt(disc);
        return { real: [(tr + sqrtDisc) / 2, (tr - sqrtDisc) / 2], imag: [0, 0] };
    }

    function eigenvector2x2(M, lambda) {
        const a = M[0][0] - lambda, b = M[0][1];
        if (Math.abs(b) > 1e-10) return vecNormalize([-b, a]);
        const c = M[1][0], d = M[1][1] - lambda;
        if (Math.abs(c) > 1e-10) return vecNormalize([-d, c]);
        return [1, 0];
    }

    /* === 激活函数 === */
    function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    function sigmoidDeriv(x) { const s = sigmoid(x); return s * (1 - s); }
    function relu(x) { return Math.max(0, x); }
    function reluDeriv(x) { return x > 0 ? 1 : 0; }
    function tanh_(x) { return Math.tanh(x); }
    function tanhDeriv(x) { const t = Math.tanh(x); return 1 - t * t; }
    function leakyRelu(x, alpha = 0.01) { return x > 0 ? x : alpha * x; }

    /* === Softmax === */
    function softmax(arr) {
        const max = Math.max(...arr);
        const exps = arr.map(v => Math.exp(v - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        return exps.map(v => v / sum);
    }

    /* === 损失函数 === */
    function crossEntropy(predicted, target) {
        return -target.reduce((s, t, i) => s + t * Math.log(predicted[i] + 1e-12), 0);
    }

    function mse(predicted, target) {
        const n = predicted.length;
        return predicted.reduce((s, p, i) => s + (p - target[i]) ** 2, 0) / n;
    }

    /* === 微积分 === */
    function numericalDerivative(f, x, h = 1e-5) {
        return (f(x + h) - f(x - h)) / (2 * h);
    }

    function numericalGradient(f, point, h = 1e-5) {
        return point.map((_, i) => {
            const p1 = [...point]; p1[i] += h;
            const p2 = [...point]; p2[i] -= h;
            return (f(p1) - f(p2)) / (2 * h);
        });
    }

    /* === 概率 === */
    function gaussian(x, mu = 0, sigma = 1) {
        return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
    }

    function uniform(x, a = 0, b = 1) {
        return (x >= a && x <= b) ? 1 / (b - a) : 0;
    }

    function bernoulli(k, p) {
        return k === 1 ? p : 1 - p;
    }

    function entropy(probs) {
        return -probs.reduce((s, p) => s + (p > 0 ? p * Math.log2(p) : 0), 0);
    }

    function klDivergence(p, q) {
        return p.reduce((s, pi, i) => s + (pi > 0 ? pi * Math.log(pi / (q[i] + 1e-12)) : 0), 0);
    }

    /* === 可视化辅助 === */
    function valueToColor(value, min = -1, max = 1) {
        const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
        if (t < 0.5) {
            const s = t * 2;
            const r = Math.round(255 * (1 - s));
            const g = Math.round(82 + 117 * s);
            const b = Math.round(82 + 72 * s);
            return `rgb(${r},${g},${b})`;
        } else {
            const s = (t - 0.5) * 2;
            return `rgba(22, 199, 154, ${0.5 + s * 0.5})`;
        }
    }

    function heatColor(value, min = 0, max = 1) {
        const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
        return `rgba(22, 199, 154, ${0.05 + t * 0.9})`;
    }

    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function degToRad(d) { return d * Math.PI / 180; }
    function radToDeg(r) { return r * 180 / Math.PI; }

    return {
        seededRandom, randomMatrix, randomVector,
        vecAdd, vecSub, vecScale, vecDot, vecNorm, vecNormalize,
        vecCross2D, vecAngle, vecLerp, vecProject,
        matmul, transpose, matAdd, matScale, zeros, eye,
        det2x2, inverse2x2, trace, matvec,
        eigenvalues2x2, eigenvector2x2,
        sigmoid, sigmoidDeriv, relu, reluDeriv, tanh: tanh_, tanhDeriv, leakyRelu,
        softmax, crossEntropy, mse,
        numericalDerivative, numericalGradient,
        gaussian, uniform, bernoulli, entropy, klDivergence,
        valueToColor, heatColor, lerp, clamp, degToRad, radToDeg,
    };
})();
