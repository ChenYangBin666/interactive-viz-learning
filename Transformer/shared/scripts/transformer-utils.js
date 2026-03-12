/**
 * transformer-utils.js — Transformer 数学工具集
 * 矩阵运算、注意力计算、位置编码等
 */

const TransformerUtils = (() => {
    /* === 随机数 === */
    function seededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    function randomMatrix(rows, cols, seed = 42, scale = 0.5) {
        const rng = seededRandom(seed);
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => (rng() * 2 - 1) * scale)
        );
    }

    function randomVector(len, seed = 42, scale = 0.5) {
        const rng = seededRandom(seed);
        return Array.from({ length: len }, () => (rng() * 2 - 1) * scale);
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

    function add(A, B) {
        return A.map((row, i) => row.map((v, j) => v + B[i][j]));
    }

    function scale(M, s) {
        return M.map(row => row.map(v => v * s));
    }

    function zeros(rows, cols) {
        return Array.from({ length: rows }, () => new Array(cols).fill(0));
    }

    function eye(n) {
        return Array.from({ length: n }, (_, i) =>
            Array.from({ length: n }, (_, j) => i === j ? 1 : 0)
        );
    }

    /* === 激活 & 归一化 === */
    function softmax(arr) {
        const max = Math.max(...arr);
        const exps = arr.map(v => Math.exp(v - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        return exps.map(v => v / sum);
    }

    function softmaxRows(M) {
        return M.map(row => softmax(row));
    }

    function relu(x) {
        if (typeof x === 'number') return Math.max(0, x);
        return x.map(row => Array.isArray(row) ? row.map(v => Math.max(0, v)) : Math.max(0, row));
    }

    function gelu(x) {
        if (typeof x === 'number') {
            return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
        }
        return x.map(row => Array.isArray(row) ? row.map(v => gelu(v)) : gelu(row));
    }

    function layerNorm(vec) {
        const mean = vec.reduce((a, b) => a + b, 0) / vec.length;
        const variance = vec.reduce((a, b) => a + (b - mean) ** 2, 0) / vec.length;
        const std = Math.sqrt(variance + 1e-5);
        return vec.map(v => (v - mean) / std);
    }

    function layerNormMatrix(M) {
        return M.map(row => layerNorm(row));
    }

    /* === 注意力 === */
    function scaledDotProductAttention(Q, K, V, mask = null) {
        const dk = K[0].length;
        const scores = scale(matmul(Q, transpose(K)), 1 / Math.sqrt(dk));
        if (mask) {
            for (let i = 0; i < scores.length; i++) {
                for (let j = 0; j < scores[0].length; j++) {
                    if (mask[i][j] === 0) scores[i][j] = -1e9;
                }
            }
        }
        const weights = softmaxRows(scores);
        const output = matmul(weights, V);
        return { output, weights, scores };
    }

    function createCausalMask(seqLen) {
        return Array.from({ length: seqLen }, (_, i) =>
            Array.from({ length: seqLen }, (_, j) => j <= i ? 1 : 0)
        );
    }

    /* === 位置编码 === */
    function positionalEncoding(seqLen, dModel) {
        const pe = [];
        for (let pos = 0; pos < seqLen; pos++) {
            const row = [];
            for (let i = 0; i < dModel; i++) {
                const angle = pos / Math.pow(10000, (2 * Math.floor(i / 2)) / dModel);
                row.push(i % 2 === 0 ? Math.sin(angle) : Math.cos(angle));
            }
            pe.push(row);
        }
        return pe;
    }

    /* === Tokenization === */
    function tokenize(text) {
        return text.trim().split(/\s+/);
    }

    function oneHot(index, vocabSize) {
        const vec = new Array(vocabSize).fill(0);
        vec[index] = 1;
        return vec;
    }

    function embeddingLookup(indices, embeddingMatrix) {
        return indices.map(i => [...embeddingMatrix[i]]);
    }

    /* === FFN === */
    function feedForward(X, W1, W2) {
        const hidden = relu(matmul(X, W1));
        return matmul(hidden, W2);
    }

    /* === 可视化辅助 === */
    function valueToColor(value, min = -1, max = 1) {
        const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
        if (t < 0.5) {
            const s = t * 2;
            const r = Math.round(255 * (1 - s));
            const g = Math.round(82 + (199 - 82) * s);
            const b = Math.round(82 + (154 - 82) * s);
            return `rgb(${r},${g},${b})`;
        } else {
            const s = (t - 0.5) * 2;
            return `rgba(22, 199, 154, ${0.5 + s * 0.5})`;
        }
    }

    function attentionColor(weight) {
        const t = Math.max(0, Math.min(1, weight));
        return `rgba(22, 199, 154, ${0.05 + t * 0.9})`;
    }

    function cosineSimilarity(a, b) {
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
    }

    function vecNorm(v) {
        return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    }

    function vecAdd(a, b) {
        return a.map((v, i) => v + b[i]);
    }

    function vecScale(v, s) {
        return v.map(x => x * s);
    }

    return {
        seededRandom, randomMatrix, randomVector,
        matmul, transpose, add, scale, zeros, eye,
        softmax, softmaxRows, relu, gelu,
        layerNorm, layerNormMatrix,
        scaledDotProductAttention, createCausalMask,
        positionalEncoding,
        tokenize, oneHot, embeddingLookup,
        feedForward,
        valueToColor, attentionColor, cosineSimilarity,
        vecNorm, vecAdd, vecScale,
    };
})();
