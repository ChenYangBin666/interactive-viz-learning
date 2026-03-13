/**
 * mlp-utils.js — MLP 工具集
 * 激活函数、前向/反向传播、数据生成、可视化辅助
 */

const MLPUtils = (() => {
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
    function sigmoidDeriv(x) { const s = sigmoid(x); return s * (1 - s); }

    function tanh(x) { return Math.tanh(x); }
    function tanhDeriv(x) { const t = Math.tanh(x); return 1 - t * t; }

    function relu(x) { return Math.max(0, x); }
    function reluDeriv(x) { return x > 0 ? 1 : 0; }

    function leakyRelu(x, alpha = 0.01) { return x > 0 ? x : alpha * x; }
    function leakyReluDeriv(x, alpha = 0.01) { return x > 0 ? 1 : alpha; }

    function softmax(arr) {
        const max = Math.max(...arr);
        const exps = arr.map(x => Math.exp(x - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        return exps.map(e => e / sum);
    }

    function crossEntropyLoss(predicted, target) {
        const eps = 1e-15;
        let loss = 0;
        for (let i = 0; i < target.length; i++) {
            loss -= target[i] * Math.log(Math.max(eps, predicted[i]));
        }
        return loss;
    }

    function mseLoss(predicted, target) {
        let sum = 0;
        for (let i = 0; i < target.length; i++) {
            const d = predicted[i] - target[i];
            sum += d * d;
        }
        return sum / target.length;
    }

    /* === 向量/矩阵运算 === */
    function vecAdd(a, b) { return a.map((v, i) => v + (b[i] || 0)); }
    function vecSub(a, b) { return a.map((v, i) => v - (b[i] || 0)); }
    function vecScale(a, s) { return a.map(v => v * s); }
    function vecMul(a, b) { return a.map((v, i) => v * (b[i] || 0)); }

    function dot(a, b) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
        return sum;
    }

    function vecNorm(a) {
        return Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    }

    function matVecMul(mat, vec) {
        return mat.map(row => dot(row, vec));
    }

    function matMul(A, B) {
        const rows = A.length;
        const cols = B[0].length;
        const inner = B.length;
        const C = [];
        for (let i = 0; i < rows; i++) {
            C[i] = [];
            for (let j = 0; j < cols; j++) {
                let sum = 0;
                for (let k = 0; k < inner; k++) sum += A[i][k] * B[k][j];
                C[i][j] = sum;
            }
        }
        return C;
    }

    function transpose(mat) {
        const rows = mat.length;
        const cols = mat[0].length;
        const T = [];
        for (let j = 0; j < cols; j++) {
            T[j] = [];
            for (let i = 0; i < rows; i++) T[j][i] = mat[i][j];
        }
        return T;
    }

    function randomMatrix(rows, cols, rng) {
        const mat = [];
        for (let i = 0; i < rows; i++) {
            mat[i] = [];
            for (let j = 0; j < cols; j++) mat[i][j] = (rng() - 0.5) * 2;
        }
        return mat;
    }

    function randomVector(len, rng) {
        const v = [];
        for (let i = 0; i < len; i++) v[i] = (rng() - 0.5) * 2;
        return v;
    }

    function zerosVector(len) { return new Array(len).fill(0); }

    function zerosMatrix(rows, cols) {
        const mat = [];
        for (let i = 0; i < rows; i++) mat[i] = new Array(cols).fill(0);
        return mat;
    }

    function onesVector(len) { return new Array(len).fill(1); }

    /* === MLP 核心 === */

    /**
     * 创建网络 — Xavier 初始化
     * @param {number[]} layerSizes 例如 [2, 8, 4, 1]
     * @param {number} seed 随机种子
     */
    function createNetwork(layerSizes, seed = 42) {
        const rng = seededRandom(seed);
        const weights = [];
        const biases = [];
        for (let l = 0; l < layerSizes.length - 1; l++) {
            const fanIn = layerSizes[l];
            const fanOut = layerSizes[l + 1];
            const scale = Math.sqrt(2 / (fanIn + fanOut)); // Xavier
            const W = [];
            for (let i = 0; i < fanOut; i++) {
                W[i] = [];
                for (let j = 0; j < fanIn; j++) {
                    W[i][j] = (rng() * 2 - 1) * scale;
                }
            }
            weights.push(W);
            biases.push(new Array(fanOut).fill(0));
        }
        return { weights, biases };
    }

    /**
     * 获取激活函数及其导数
     */
    function _getActivation(name) {
        switch (name) {
            case 'sigmoid': return { fn: sigmoid, dfn: sigmoidDeriv };
            case 'tanh':    return { fn: tanh, dfn: tanhDeriv };
            case 'leaky_relu': return { fn: leakyRelu, dfn: leakyReluDeriv };
            case 'relu':
            default:        return { fn: relu, dfn: reluDeriv };
        }
    }

    /**
     * 前向传播
     * @param {object} network { weights, biases }
     * @param {number[]} input 输入向量
     * @param {string} activation 激活函数名称
     * @returns {{ activations: number[][], preActivations: number[][] }}
     */
    function forwardPass(network, input, activation = 'relu') {
        const { weights, biases } = network;
        const act = _getActivation(activation);
        const activations = [input.slice()];
        const preActivations = [];
        let current = input;

        for (let l = 0; l < weights.length; l++) {
            const z = vecAdd(matVecMul(weights[l], current), biases[l]);
            preActivations.push(z);

            // 最后一层：若输出维度 >1 用 softmax，否则不加激活（线性输出）
            let a;
            if (l === weights.length - 1) {
                a = z.length > 1 ? softmax(z) : z.slice();
            } else {
                a = z.map(v => act.fn(v));
            }
            activations.push(a);
            current = a;
        }
        return { activations, preActivations };
    }

    /**
     * 反向传播
     * @param {object} network { weights, biases }
     * @param {object} forwardResult { activations, preActivations }
     * @param {number[]} target 目标向量
     * @param {string} lossType 'mse' | 'cross_entropy'
     * @returns {{ weightGrads: number[][][], biasGrads: number[][] }}
     */
    function backwardPass(network, forwardResult, target, lossType = 'mse') {
        const { weights, biases } = network;
        const { activations, preActivations } = forwardResult;
        const L = weights.length;
        const weightGrads = [];
        const biasGrads = [];

        // 输出层 delta
        const output = activations[L];
        let delta;
        if (lossType === 'cross_entropy' && output.length > 1) {
            // softmax + cross-entropy: delta = output - target
            delta = vecSub(output, target);
        } else {
            // MSE: delta = 2/n * (output - target) （最后一层线性）
            delta = vecSub(output, target).map(d => (2 / output.length) * d);
        }

        // 从最后一层往前
        for (let l = L - 1; l >= 0; l--) {
            const aIn = activations[l]; // 该层的输入激活
            // 权重梯度: delta (列) x aIn (行) => fanOut x fanIn
            const wGrad = [];
            for (let i = 0; i < delta.length; i++) {
                wGrad[i] = [];
                for (let j = 0; j < aIn.length; j++) {
                    wGrad[i][j] = delta[i] * aIn[j];
                }
            }
            weightGrads.unshift(wGrad);
            biasGrads.unshift(delta.slice());

            // 传播到前一层
            if (l > 0) {
                const Wt = transpose(weights[l]);
                const dPrev = matVecMul(Wt, delta);
                // 获取默认激活函数的导数（与 forwardPass 保持一致需外部匹配）
                const act = _getActivation('relu');
                delta = dPrev.map((v, i) => v * act.dfn(preActivations[l - 1][i]));
            }
        }

        return { weightGrads, biasGrads };
    }

    /**
     * SGD 权重更新（原地修改）
     */
    function updateWeights(network, grads, lr = 0.01) {
        const { weights, biases } = network;
        const { weightGrads, biasGrads } = grads;
        for (let l = 0; l < weights.length; l++) {
            for (let i = 0; i < weights[l].length; i++) {
                biases[l][i] -= lr * biasGrads[l][i];
                for (let j = 0; j < weights[l][i].length; j++) {
                    weights[l][i][j] -= lr * weightGrads[l][i][j];
                }
            }
        }
    }

    /**
     * 便捷预测 — 返回最终输出
     */
    function predict(network, input, activation = 'relu') {
        const { activations } = forwardPass(network, input, activation);
        return activations[activations.length - 1];
    }

    /* === 数据生成 === */

    /**
     * 圆形二分类数据
     */
    function generateCircleData(n = 200, noise = 0.1, seed = 42) {
        const rng = seededRandom(seed);
        const points = [];
        const labels = [];
        for (let i = 0; i < n; i++) {
            const label = i < n / 2 ? 0 : 1;
            const r = label === 0 ? rng() * 0.5 : 0.7 + rng() * 0.3;
            const angle = rng() * 2 * Math.PI;
            const x = r * Math.cos(angle) + (rng() - 0.5) * noise;
            const y = r * Math.sin(angle) + (rng() - 0.5) * noise;
            points.push([x, y]);
            labels.push(label);
        }
        return { points, labels };
    }

    /**
     * XOR 模式数据
     */
    function generateXORData(n = 200, noise = 0.15, seed = 42) {
        const rng = seededRandom(seed);
        const points = [];
        const labels = [];
        for (let i = 0; i < n; i++) {
            const qx = rng() > 0.5 ? 1 : -1;
            const qy = rng() > 0.5 ? 1 : -1;
            const x = qx * (0.3 + rng() * 0.7) + (rng() - 0.5) * noise;
            const y = qy * (0.3 + rng() * 0.7) + (rng() - 0.5) * noise;
            const label = (qx * qy > 0) ? 0 : 1;
            points.push([x, y]);
            labels.push(label);
        }
        return { points, labels };
    }

    /**
     * 螺旋数据集（多类）
     */
    function generateSpiralData(n = 300, classes = 3, seed = 42) {
        const rng = seededRandom(seed);
        const points = [];
        const labels = [];
        const perClass = Math.floor(n / classes);
        for (let c = 0; c < classes; c++) {
            for (let i = 0; i < perClass; i++) {
                const r = i / perClass;
                const t = c * (2 * Math.PI / classes) + r * 4 + (rng() - 0.5) * 0.3;
                const x = r * Math.cos(t);
                const y = r * Math.sin(t);
                points.push([x, y]);
                labels.push(c);
            }
        }
        return { points, labels };
    }

    /**
     * 双月牙数据
     */
    function generateMoonsData(n = 200, noise = 0.1, seed = 42) {
        const rng = seededRandom(seed);
        const points = [];
        const labels = [];
        const half = Math.floor(n / 2);
        for (let i = 0; i < half; i++) {
            const angle = Math.PI * i / half;
            const x = Math.cos(angle) + (rng() - 0.5) * noise;
            const y = Math.sin(angle) + (rng() - 0.5) * noise;
            points.push([x, y]);
            labels.push(0);
        }
        for (let i = 0; i < half; i++) {
            const angle = Math.PI * i / half;
            const x = 1 - Math.cos(angle) + (rng() - 0.5) * noise;
            const y = 1 - Math.sin(angle) - 0.5 + (rng() - 0.5) * noise;
            points.push([x, y]);
            labels.push(1);
        }
        return { points, labels };
    }

    /* === 可视化辅助 === */

    /**
     * 数值映射到热力图颜色（蓝 → 白 → 红）
     */
    function valueToColor(value, min = -1, max = 1) {
        const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
        let r, g, b;
        if (t < 0.5) {
            const s = t * 2;
            r = Math.round(50 + s * 205);
            g = Math.round(50 + s * 205);
            b = 255;
        } else {
            const s = (t - 0.5) * 2;
            r = 255;
            g = Math.round(255 - s * 205);
            b = Math.round(255 - s * 205);
        }
        return `rgb(${r},${g},${b})`;
    }

    /**
     * 类别索引映射到颜色
     */
    const CLASS_COLORS = [
        '#4fc3f7', '#ff7043', '#66bb6a', '#ab47bc',
        '#ffa726', '#ef5350', '#26c6da', '#d4e157'
    ];
    function classToColor(classIdx) {
        return CLASS_COLORS[classIdx % CLASS_COLORS.length];
    }

    /**
     * 层类型颜色（输入 / 隐藏 / 输出）
     */
    const LAYER_COLORS = {
        input:  '#4fc3f7',
        hidden: '#ff9800',
        output: '#66bb6a'
    };

    /* === 导出 === */
    return {
        // 随机数
        seededRandom,
        // 数学工具
        sigmoid, sigmoidDeriv,
        tanh, tanhDeriv,
        relu, reluDeriv,
        leakyRelu, leakyReluDeriv,
        softmax,
        crossEntropyLoss, mseLoss,
        // 向量/矩阵运算
        vecAdd, vecSub, vecScale, vecMul,
        dot, vecNorm,
        matVecMul, matMul, transpose,
        randomMatrix, randomVector,
        zerosVector, zerosMatrix, onesVector,
        // MLP 核心
        createNetwork, forwardPass, backwardPass, updateWeights, predict,
        // 数据生成
        generateCircleData, generateXORData, generateSpiralData, generateMoonsData,
        // 可视化辅助
        valueToColor, classToColor, LAYER_COLORS
    };
})();
