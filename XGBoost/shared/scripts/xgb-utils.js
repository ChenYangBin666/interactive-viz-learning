/**
 * xgb-utils.js — XGBoost 工具集
 * 梯度提升、目标函数、正则化、树构建、预测
 */

const XGBUtils = (() => {
    /* === 随机数 === */
    function seededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    /* === 数据集生成 === */
    function generateClassificationData(n, seed = 42, noise = 0.3) {
        const rng = seededRandom(seed);
        const data = [];
        for (let i = 0; i < n; i++) {
            const x = rng() * 10 - 5;
            const y = rng() * 10 - 5;
            const boundary = 0.5 * x + Math.sin(x) * 1.5;
            const label = (y > boundary + (rng() - 0.5) * noise * 4) ? 1 : 0;
            data.push({ x, y, label });
        }
        return data;
    }

    function generateRegressionData(n, seed = 42, noise = 0.5) {
        const rng = seededRandom(seed);
        const data = [];
        for (let i = 0; i < n; i++) {
            const x = rng() * 10 - 5;
            const target = Math.sin(x) * 2 + x * 0.3 + (rng() - 0.5) * noise * 2;
            data.push({ x, target });
        }
        return data;
    }

    function generateMultiFeatureData(n, nFeatures = 4, seed = 42) {
        const rng = seededRandom(seed);
        const data = [];
        for (let i = 0; i < n; i++) {
            const features = Array.from({ length: nFeatures }, () => rng() * 10 - 5);
            const score = features[0] * 0.5 + features[1] * 0.3 + (rng() - 0.5) * 2;
            const label = score > 0 ? 1 : 0;
            data.push({ features, label });
        }
        return data;
    }

    /* === 激活函数 === */
    function sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))); }
    function logOdds(p) { return Math.log((p + 1e-10) / (1 - p + 1e-10)); }

    /* === 损失函数 === */
    // 回归：MSE
    function mseLoss(y, pred) {
        return y.reduce((s, yi, i) => s + (yi - pred[i]) ** 2, 0) / y.length;
    }
    function mseGradient(y, pred) {
        return y.map((yi, i) => -(yi - pred[i]));     // negative gradient = residual方向
    }
    function mseHessian(y, pred) {
        return y.map(() => 1);
    }

    // 分类：Log loss
    function logLoss(y, rawPred) {
        let loss = 0;
        for (let i = 0; i < y.length; i++) {
            const p = sigmoid(rawPred[i]);
            loss -= y[i] * Math.log(p + 1e-10) + (1 - y[i]) * Math.log(1 - p + 1e-10);
        }
        return loss / y.length;
    }
    function logLossGradient(y, rawPred) {
        return y.map((yi, i) => sigmoid(rawPred[i]) - yi);
    }
    function logLossHessian(y, rawPred) {
        return rawPred.map(r => { const p = sigmoid(r); return p * (1 - p); });
    }

    /* === XGBoost 树构建 === */
    function computeLeafWeight(grad, hess, lambda = 1) {
        const G = grad.reduce((a, b) => a + b, 0);
        const H = hess.reduce((a, b) => a + b, 0);
        return -G / (H + lambda);
    }

    function computeLeafScore(grad, hess, lambda = 1) {
        const G = grad.reduce((a, b) => a + b, 0);
        const H = hess.reduce((a, b) => a + b, 0);
        return -(G * G) / (2 * (H + lambda));
    }

    function computeSplitGain(leftGrad, leftHess, rightGrad, rightHess, lambda = 1, gamma = 0) {
        const GL = leftGrad.reduce((a, b) => a + b, 0);
        const HL = leftHess.reduce((a, b) => a + b, 0);
        const GR = rightGrad.reduce((a, b) => a + b, 0);
        const HR = rightHess.reduce((a, b) => a + b, 0);
        const G = GL + GR;
        const H = HL + HR;

        const scoreLeft = (GL * GL) / (HL + lambda);
        const scoreRight = (GR * GR) / (HR + lambda);
        const scoreParent = (G * G) / (H + lambda);

        return 0.5 * (scoreLeft + scoreRight - scoreParent) - gamma;
    }

    function findBestSplitXGB(indices, data, grad, hess, featureIndex, lambda = 1, gamma = 0) {
        const getVal = (idx) => {
            const d = data[idx];
            return Array.isArray(d.features) ? d.features[featureIndex] : (featureIndex === 0 ? d.x : d.y);
        };

        const sorted = [...indices].sort((a, b) => getVal(a) - getVal(b));

        let bestGain = -Infinity, bestThreshold = 0;
        const leftGrad = [], leftHess = [], rightGrad = [], rightHess = [];

        // Start with all in right
        for (const idx of sorted) {
            rightGrad.push(grad[idx]);
            rightHess.push(hess[idx]);
        }

        for (let i = 0; i < sorted.length - 1; i++) {
            const idx = sorted[i];
            leftGrad.push(grad[idx]);
            leftHess.push(hess[idx]);
            rightGrad.shift();
            rightHess.shift();

            if (getVal(sorted[i]) === getVal(sorted[i + 1])) continue;

            const threshold = (getVal(sorted[i]) + getVal(sorted[i + 1])) / 2;
            const gain = computeSplitGain(leftGrad, leftHess, rightGrad, rightHess, lambda, gamma);
            if (gain > bestGain) {
                bestGain = gain;
                bestThreshold = threshold;
            }
        }

        return { featureIndex, threshold: bestThreshold, gain: bestGain };
    }

    function buildXGBTree(data, grad, hess, options = {}) {
        const {
            maxDepth = 4,
            minChildWeight = 1,
            lambda = 1,
            gamma = 0,
            colsampleBytree = 1.0,
            seed = 42,
        } = options;

        const rng = seededRandom(seed);
        const nFeat = Array.isArray(data[0].features) ? data[0].features.length : 2;
        let featureIndices = Array.from({ length: nFeat }, (_, i) => i);

        if (colsampleBytree < 1) {
            const nSelect = Math.max(1, Math.round(nFeat * colsampleBytree));
            const shuffled = [...featureIndices];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            featureIndices = shuffled.slice(0, nSelect);
        }

        function _build(indices, depth, nodeId = 0) {
            const node = { id: nodeId, depth, samples: indices.length };

            const nodeGrad = indices.map(i => grad[i]);
            const nodeHess = indices.map(i => hess[i]);
            node.weight = computeLeafWeight(nodeGrad, nodeHess, lambda);
            node.score = computeLeafScore(nodeGrad, nodeHess, lambda);

            const sumHess = nodeHess.reduce((a, b) => a + b, 0);

            if (depth >= maxDepth || indices.length < 2 || sumHess < minChildWeight) {
                node.isLeaf = true;
                return node;
            }

            let bestSplit = null;
            for (const fi of featureIndices) {
                const split = findBestSplitXGB(indices, data, grad, hess, fi, lambda, gamma);
                if (!bestSplit || split.gain > bestSplit.gain) {
                    bestSplit = split;
                }
            }

            if (!bestSplit || bestSplit.gain <= 0) {
                node.isLeaf = true;
                return node;
            }

            node.isLeaf = false;
            node.splitFeature = bestSplit.featureIndex;
            node.splitThreshold = bestSplit.threshold;
            node.gain = bestSplit.gain;

            const getVal = (idx) => {
                const d = data[idx];
                return Array.isArray(d.features) ? d.features[bestSplit.featureIndex] : (bestSplit.featureIndex === 0 ? d.x : d.y);
            };

            const leftIdx = indices.filter(i => getVal(i) <= bestSplit.threshold);
            const rightIdx = indices.filter(i => getVal(i) > bestSplit.threshold);

            if (leftIdx.length === 0 || rightIdx.length === 0) {
                node.isLeaf = true;
                return node;
            }

            node.left = _build(leftIdx, depth + 1, nodeId * 2 + 1);
            node.right = _build(rightIdx, depth + 1, nodeId * 2 + 2);

            return node;
        }

        const allIndices = Array.from({ length: data.length }, (_, i) => i);
        return _build(allIndices, 0);
    }

    function predictXGBTree(tree, point) {
        let node = tree;
        const path = [node];
        while (!node.isLeaf) {
            const val = Array.isArray(point.features)
                ? point.features[node.splitFeature]
                : (node.splitFeature === 0 ? point.x : point.y);
            node = val <= node.splitThreshold ? node.left : node.right;
            path.push(node);
        }
        return { weight: node.weight, path };
    }

    /* === XGBoost 集成 === */
    function trainXGBoost(data, options = {}) {
        const {
            nRounds = 10,
            learningRate = 0.3,
            maxDepth = 3,
            lambda = 1,
            gamma = 0,
            minChildWeight = 1,
            colsampleBytree = 1.0,
            subsample = 1.0,
            isRegression = true,
            seed = 42,
        } = options;

        const rng = seededRandom(seed);
        const n = data.length;
        const y = data.map(d => isRegression ? d.target : d.label);

        // Initial prediction
        let rawPred;
        if (isRegression) {
            const mean = y.reduce((a, b) => a + b, 0) / n;
            rawPred = new Array(n).fill(mean);
        } else {
            const posRate = y.filter(v => v === 1).length / n;
            const initLogOdds = logOdds(posRate);
            rawPred = new Array(n).fill(initLogOdds);
        }

        const trees = [];
        const lossHistory = [];

        for (let round = 0; round < nRounds; round++) {
            // Compute gradients
            const grad = isRegression ? mseGradient(y, rawPred) : logLossGradient(y, rawPred);
            const hess = isRegression ? mseHessian(y, rawPred) : logLossHessian(y, rawPred);

            // Subsample
            let trainIndices = Array.from({ length: n }, (_, i) => i);
            if (subsample < 1) {
                const nSample = Math.max(1, Math.round(n * subsample));
                const shuffled = [...trainIndices];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(rng() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                trainIndices = shuffled.slice(0, nSample);
            }

            // Build tree on gradients
            const tree = buildXGBTree(data, grad, hess, {
                maxDepth,
                minChildWeight,
                lambda,
                gamma,
                colsampleBytree,
                seed: seed + round * 137,
            });

            trees.push(tree);

            // Update predictions
            for (let i = 0; i < n; i++) {
                const { weight } = predictXGBTree(tree, data[i]);
                rawPred[i] += learningRate * weight;
            }

            // Record loss
            const loss = isRegression ? mseLoss(y, rawPred) : logLoss(y, rawPred);
            lossHistory.push(loss);
        }

        return {
            trees,
            lossHistory,
            learningRate,
            isRegression,
            initialPred: isRegression
                ? y.reduce((a, b) => a + b, 0) / n
                : logOdds(y.filter(v => v === 1).length / n),
        };
    }

    function predictXGBoost(model, point) {
        let raw = model.initialPred;
        const treeWeights = [];
        for (const tree of model.trees) {
            const { weight, path } = predictXGBTree(tree, point);
            raw += model.learningRate * weight;
            treeWeights.push({ weight, path, cumulative: raw });
        }

        if (model.isRegression) {
            return { prediction: raw, raw, treeWeights };
        } else {
            const prob = sigmoid(raw);
            return { prediction: prob >= 0.5 ? 1 : 0, probability: prob, raw, treeWeights };
        }
    }

    function evaluateXGBoost(model, data) {
        if (model.isRegression) {
            let mse = 0;
            for (const d of data) {
                const { prediction } = predictXGBoost(model, d);
                mse += (d.target - prediction) ** 2;
            }
            return { mse: mse / data.length };
        } else {
            let correct = 0;
            for (const d of data) {
                const { prediction } = predictXGBoost(model, d);
                if (prediction === d.label) correct++;
            }
            return { accuracy: correct / data.length };
        }
    }

    /* === 可视化辅助 === */
    const CLASS_COLORS = ['#ff5252', '#4fc3f7', '#16c79a', '#ffab40', '#b388ff', '#ff80ab'];
    function classColor(label) { return CLASS_COLORS[label % CLASS_COLORS.length]; }

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

    function treeNodeCount(tree) {
        if (!tree) return 0;
        if (tree.isLeaf) return 1;
        return 1 + treeNodeCount(tree.left) + treeNodeCount(tree.right);
    }

    function treeDepth(tree) {
        if (!tree || tree.isLeaf) return 0;
        return 1 + Math.max(treeDepth(tree.left), treeDepth(tree.right));
    }

    function flattenTree(tree) {
        const nodes = [];
        function traverse(node, x = 0, y = 0, dx = 1) {
            if (!node) return;
            nodes.push({ ...node, vx: x, vy: y });
            if (!node.isLeaf) {
                traverse(node.left, x - dx, y + 1, dx / 2);
                traverse(node.right, x + dx, y + 1, dx / 2);
            }
        }
        traverse(tree);
        return nodes;
    }

    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    return {
        seededRandom,
        generateClassificationData, generateRegressionData, generateMultiFeatureData,
        sigmoid, logOdds,
        mseLoss, mseGradient, mseHessian,
        logLoss, logLossGradient, logLossHessian,
        computeLeafWeight, computeLeafScore, computeSplitGain,
        findBestSplitXGB, buildXGBTree, predictXGBTree,
        trainXGBoost, predictXGBoost, evaluateXGBoost,
        classColor, CLASS_COLORS, valueToColor,
        treeNodeCount, treeDepth, flattenTree,
        lerp, clamp,
    };
})();
