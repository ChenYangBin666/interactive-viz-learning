/**
 * svm-utils.js — SVM 工具集
 * 核函数、线性/核SVM训练与预测、SMO简化版、数据生成、可视化辅助
 */

const SVMUtils = (() => {

    /* === 随机数 === */
    function seededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    /* === 数学工具 === */
    function dot(a, b) {
        let s = 0;
        for (let i = 0; i < a.length; i++) s += a[i] * b[i];
        return s;
    }

    function vecAdd(a, b) {
        return a.map((v, i) => v + b[i]);
    }

    function vecSub(a, b) {
        return a.map((v, i) => v - b[i]);
    }

    function vecScale(a, s) {
        return a.map(v => v * s);
    }

    function vecNorm(a) {
        return Math.sqrt(dot(a, a));
    }

    function matVecMul(M, v) {
        return M.map(row => dot(row, v));
    }

    function sign(x) {
        return x >= 0 ? 1 : -1;
    }

    /* === 核函数 === */
    function linearKernel(x, y) {
        return dot(x, y);
    }

    function polynomialKernel(x, y, degree = 3, c = 1) {
        return Math.pow(dot(x, y) + c, degree);
    }

    function rbfKernel(x, y, gamma = 1.0) {
        const diff = vecSub(x, y);
        return Math.exp(-gamma * dot(diff, diff));
    }

    function sigmoidKernel(x, y, alpha = 0.01, c = 0) {
        return Math.tanh(alpha * dot(x, y) + c);
    }

    /* === SVM 核心 === */

    /**
     * 使用SGD优化hinge loss训练线性SVM
     * @param {number[][]} data - 训练数据
     * @param {number[]} labels - 标签 (+1 或 -1)
     * @param {number} C - 正则化参数
     * @param {number} lr - 学习率
     * @param {number} epochs - 迭代次数
     * @returns {{w: number[], b: number, supportVectors: number[], history: object[]}}
     */
    function trainLinearSVM(data, labels, C = 1.0, lr = 0.01, epochs = 1000) {
        const dim = data[0].length;
        const n = data.length;
        let w = new Array(dim).fill(0);
        let b = 0;
        const history = [];

        for (let epoch = 0; epoch < epochs; epoch++) {
            // 遍历所有样本进行SGD更新
            for (let i = 0; i < n; i++) {
                const xi = data[i];
                const yi = labels[i];
                const margin = yi * (dot(w, xi) + b);

                if (margin < 1) {
                    // 违反间隔约束：更新w和b
                    w = vecAdd(vecScale(w, 1 - lr / n), vecScale(xi, lr * C * yi));
                    b += lr * C * yi;
                } else {
                    // 满足间隔约束：仅正则化w
                    w = vecScale(w, 1 - lr / n);
                }
            }

            // 记录训练历史
            if (epoch % 10 === 0 || epoch === epochs - 1) {
                const loss = hingeLoss(data, labels, w, b);
                const mg = computeMargin(w);
                history.push({ epoch, loss, margin: mg, w: [...w], b });
            }
        }

        const supportVectors = findSupportVectors(data, labels, w, b);
        return { w, b, supportVectors, history };
    }

    /**
     * 线性SVM预测
     * @returns {number} +1 或 -1
     */
    function predictSVM(x, w, b) {
        return sign(dot(w, x) + b);
    }

    /**
     * 计算hinge loss: (1/n)Σmax(0, 1 - y_i(w·x_i + b)) + (1/2)||w||^2
     */
    function hingeLoss(data, labels, w, b) {
        const n = data.length;
        let loss = 0;
        for (let i = 0; i < n; i++) {
            const margin = labels[i] * (dot(w, data[i]) + b);
            loss += Math.max(0, 1 - margin);
        }
        loss /= n;
        // 加上正则化项
        loss += 0.5 * dot(w, w);
        return loss;
    }

    /**
     * 计算间隔宽度: 2 / ||w||
     */
    function computeMargin(w) {
        const norm = vecNorm(w);
        return norm > 0 ? 2 / norm : Infinity;
    }

    /**
     * 找到支持向量的索引
     * 支持向量满足 |y_i(w·x_i + b) - 1| < tol
     */
    function findSupportVectors(data, labels, w, b, tol = 0.01) {
        const indices = [];
        for (let i = 0; i < data.length; i++) {
            const margin = labels[i] * (dot(w, data[i]) + b);
            if (Math.abs(margin - 1) < tol) {
                indices.push(i);
            }
        }
        return indices;
    }

    /**
     * 决策函数: w·x + b（有符号距离）
     */
    function decisionFunction(x, w, b) {
        return dot(w, x) + b;
    }

    /* === SMO 简化版（核SVM） === */

    /**
     * 简化版SMO算法训练核SVM
     * @param {number[][]} data - 训练数据
     * @param {number[]} labels - 标签 (+1 或 -1)
     * @param {Function} kernelFn - 核函数 (x, y) => number
     * @param {number} C - 正则化参数
     * @param {number} tol - 容差
     * @param {number} maxPasses - 最大无alpha变化的遍历次数
     * @returns {{alphas: number[], b: number, supportIndices: number[]}}
     */
    function trainKernelSVM(data, labels, kernelFn, C = 1.0, tol = 0.001, maxPasses = 10) {
        const n = data.length;
        const alphas = new Array(n).fill(0);
        let b = 0;
        let passes = 0;

        // 预计算核矩阵
        const K = [];
        for (let i = 0; i < n; i++) {
            K[i] = [];
            for (let j = 0; j < n; j++) {
                K[i][j] = kernelFn(data[i], data[j]);
            }
        }

        // 计算预测函数
        function fxi(idx) {
            let s = 0;
            for (let j = 0; j < n; j++) {
                s += alphas[j] * labels[j] * K[j][idx];
            }
            return s + b;
        }

        while (passes < maxPasses) {
            let numChangedAlphas = 0;

            for (let i = 0; i < n; i++) {
                const Ei = fxi(i) - labels[i];

                // 检查KKT条件是否违反
                if ((labels[i] * Ei < -tol && alphas[i] < C) ||
                    (labels[i] * Ei > tol && alphas[i] > 0)) {

                    // 随机选择 j != i
                    let j = i;
                    while (j === i) j = Math.floor(Math.random() * n);

                    const Ej = fxi(j) - labels[j];

                    const alphaIOld = alphas[i];
                    const alphaJOld = alphas[j];

                    // 计算L和H边界
                    let L, H;
                    if (labels[i] !== labels[j]) {
                        L = Math.max(0, alphas[j] - alphas[i]);
                        H = Math.min(C, C + alphas[j] - alphas[i]);
                    } else {
                        L = Math.max(0, alphas[i] + alphas[j] - C);
                        H = Math.min(C, alphas[i] + alphas[j]);
                    }

                    if (Math.abs(L - H) < 1e-10) continue;

                    // 计算eta
                    const eta = 2 * K[i][j] - K[i][i] - K[j][j];
                    if (eta >= 0) continue;

                    // 更新alpha_j
                    alphas[j] = alphaJOld - (labels[j] * (Ei - Ej)) / eta;

                    // 裁剪alpha_j
                    if (alphas[j] > H) alphas[j] = H;
                    else if (alphas[j] < L) alphas[j] = L;

                    if (Math.abs(alphas[j] - alphaJOld) < 1e-5) {
                        alphas[j] = alphaJOld;
                        continue;
                    }

                    // 更新alpha_i
                    alphas[i] = alphaIOld + labels[i] * labels[j] * (alphaJOld - alphas[j]);

                    // 更新偏置b
                    const b1 = b - Ei
                        - labels[i] * (alphas[i] - alphaIOld) * K[i][i]
                        - labels[j] * (alphas[j] - alphaJOld) * K[i][j];
                    const b2 = b - Ej
                        - labels[i] * (alphas[i] - alphaIOld) * K[i][j]
                        - labels[j] * (alphas[j] - alphaJOld) * K[j][j];

                    if (alphas[i] > 0 && alphas[i] < C) b = b1;
                    else if (alphas[j] > 0 && alphas[j] < C) b = b2;
                    else b = (b1 + b2) / 2;

                    numChangedAlphas++;
                }
            }

            if (numChangedAlphas === 0) passes++;
            else passes = 0;
        }

        // 找到支持向量索引 (alpha > 0)
        const supportIndices = [];
        for (let i = 0; i < n; i++) {
            if (alphas[i] > 1e-6) supportIndices.push(i);
        }

        return { alphas, b, supportIndices };
    }

    /**
     * 核SVM预测
     */
    function predictKernelSVM(x, data, labels, alphas, b, kernelFn) {
        let s = 0;
        for (let i = 0; i < data.length; i++) {
            if (alphas[i] > 1e-6) {
                s += alphas[i] * labels[i] * kernelFn(data[i], x);
            }
        }
        return sign(s + b);
    }

    /* === 数据生成 === */

    /**
     * 生成线性可分的2D数据
     */
    function generateLinearData(n = 100, noise = 0.1, seed = 42) {
        const rng = seededRandom(seed);
        const data = [];
        const labels = [];
        const half = Math.floor(n / 2);

        for (let i = 0; i < half; i++) {
            data.push([rng() * 2 - 1 + noise * (rng() - 0.5), rng() + 0.5 + noise * (rng() - 0.5)]);
            labels.push(1);
        }
        for (let i = 0; i < n - half; i++) {
            data.push([rng() * 2 - 1 + noise * (rng() - 0.5), -rng() - 0.5 + noise * (rng() - 0.5)]);
            labels.push(-1);
        }
        return { data, labels };
    }

    /**
     * 生成环形边界数据
     */
    function generateCircleData(n = 100, noise = 0.1, seed = 42) {
        const rng = seededRandom(seed);
        const data = [];
        const labels = [];
        const half = Math.floor(n / 2);

        for (let i = 0; i < half; i++) {
            const angle = rng() * 2 * Math.PI;
            const r = 0.5 + noise * (rng() - 0.5);
            data.push([r * Math.cos(angle), r * Math.sin(angle)]);
            labels.push(1);
        }
        for (let i = 0; i < n - half; i++) {
            const angle = rng() * 2 * Math.PI;
            const r = 1.5 + noise * (rng() - 0.5);
            data.push([r * Math.cos(angle), r * Math.sin(angle)]);
            labels.push(-1);
        }
        return { data, labels };
    }

    /**
     * 生成XOR模式数据
     */
    function generateXORData(n = 100, noise = 0.1, seed = 42) {
        const rng = seededRandom(seed);
        const data = [];
        const labels = [];
        const quarter = Math.floor(n / 4);

        // 第一、三象限为 +1
        for (let i = 0; i < quarter; i++) {
            data.push([rng() * 1 + 0.2 + noise * (rng() - 0.5), rng() * 1 + 0.2 + noise * (rng() - 0.5)]);
            labels.push(1);
        }
        for (let i = 0; i < quarter; i++) {
            data.push([-rng() * 1 - 0.2 + noise * (rng() - 0.5), -rng() * 1 - 0.2 + noise * (rng() - 0.5)]);
            labels.push(1);
        }
        // 第二、四象限为 -1
        for (let i = 0; i < quarter; i++) {
            data.push([-rng() * 1 - 0.2 + noise * (rng() - 0.5), rng() * 1 + 0.2 + noise * (rng() - 0.5)]);
            labels.push(-1);
        }
        for (let i = 0; i < n - 3 * quarter; i++) {
            data.push([rng() * 1 + 0.2 + noise * (rng() - 0.5), -rng() * 1 - 0.2 + noise * (rng() - 0.5)]);
            labels.push(-1);
        }
        return { data, labels };
    }

    /**
     * 生成双月形数据
     */
    function generateMoonsData(n = 100, noise = 0.1, seed = 42) {
        const rng = seededRandom(seed);
        const data = [];
        const labels = [];
        const half = Math.floor(n / 2);

        // 上半月
        for (let i = 0; i < half; i++) {
            const angle = Math.PI * (i / half) + noise * (rng() - 0.5);
            data.push([
                Math.cos(angle) + noise * (rng() - 0.5),
                Math.sin(angle) + noise * (rng() - 0.5)
            ]);
            labels.push(1);
        }
        // 下半月（偏移）
        for (let i = 0; i < n - half; i++) {
            const angle = Math.PI * (i / (n - half)) + noise * (rng() - 0.5);
            data.push([
                1 - Math.cos(angle) + noise * (rng() - 0.5),
                0.5 - Math.sin(angle) + noise * (rng() - 0.5)
            ]);
            labels.push(-1);
        }
        return { data, labels };
    }

    /**
     * 生成双螺旋数据
     */
    function generateSpiralData(n = 100, seed = 42) {
        const rng = seededRandom(seed);
        const data = [];
        const labels = [];
        const half = Math.floor(n / 2);

        for (let i = 0; i < half; i++) {
            const t = (i / half) * 2 * Math.PI + rng() * 0.2;
            const r = 0.3 + (i / half) * 1.2;
            data.push([r * Math.cos(t), r * Math.sin(t)]);
            labels.push(1);
        }
        for (let i = 0; i < n - half; i++) {
            const t = (i / (n - half)) * 2 * Math.PI + Math.PI + rng() * 0.2;
            const r = 0.3 + (i / (n - half)) * 1.2;
            data.push([r * Math.cos(t), r * Math.sin(t)]);
            labels.push(-1);
        }
        return { data, labels };
    }

    /* === 可视化辅助 === */

    /**
     * 类别标签映射到颜色: +1=绿色, -1=红色
     */
    function classToColor(label) {
        return label === 1 ? '#22c55e' : '#ef4444';
    }

    /**
     * 将连续值映射到发散色图（蓝-白-红）用于决策函数可视化
     */
    function valueToColor(value, min, max) {
        // 归一化到 [0, 1]
        const range = max - min;
        if (range === 0) return 'rgba(255,255,255,0.3)';
        const t = (value - min) / range; // 0..1

        // 蓝(0) -> 白(0.5) -> 红(1)
        let r, g, b;
        if (t < 0.5) {
            const s = t * 2; // 0..1
            r = Math.round(59 + s * 196);
            g = Math.round(130 + s * 125);
            b = Math.round(246 - s * 96);
        } else {
            const s = (t - 0.5) * 2; // 0..1
            r = Math.round(255 - s * 16);
            g = Math.round(255 - s * 187);
            b = Math.round(150 - s * 82);
        }
        return `rgba(${r},${g},${b},0.5)`;
    }

    /** 间隔可视化相关颜色常量 */
    const MARGIN_COLORS = {
        decisionBoundary: '#facc15',  // 决策边界（黄色）
        marginLine:       '#94a3b8',  // 间隔边界（灰蓝）
        supportVector:    '#f97316',  // 支持向量（橙色）
        positive:         '#22c55e',  // 正类（绿色）
        negative:         '#ef4444',  // 负类（红色）
        marginFill:       'rgba(250,204,21,0.08)' // 间隔区域填充
    };

    /* === 导出 === */
    return {
        // 随机数
        seededRandom,
        // 数学工具
        dot, vecAdd, vecSub, vecScale, vecNorm, matVecMul, sign,
        // 核函数
        linearKernel, polynomialKernel, rbfKernel, sigmoidKernel,
        // SVM 核心
        trainLinearSVM, predictSVM, hingeLoss, computeMargin,
        findSupportVectors, decisionFunction,
        // SMO 简化版
        trainKernelSVM, predictKernelSVM,
        // 数据生成
        generateLinearData, generateCircleData, generateXORData,
        generateMoonsData, generateSpiralData,
        // 可视化辅助
        classToColor, valueToColor, MARGIN_COLORS
    };
})();
