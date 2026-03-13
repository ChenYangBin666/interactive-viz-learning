/**
 * LightGBM 可视化工具库
 * 提供随机数、数学工具、直方图、决策树、梯度提升、GOSS、EFB、数据生成、可视化等功能
 */
const LGBMUtils = (function () {
    'use strict';

    // ========================================
    // 随机数
    // ========================================

    /**
     * 带种子的伪随机数生成器（Mulberry32）
     * @param {number} seed - 随机种子
     * @returns {function} 返回 [0,1) 的随机数生成函数
     */
    function seededRandom(seed) {
        let s = seed | 0;
        return function () {
            s = (s + 0x6d2b79f5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // ========================================
    // 数学工具
    // ========================================

    /**
     * Sigmoid 函数
     */
    function sigmoid(x) {
        if (x >= 0) {
            return 1 / (1 + Math.exp(-x));
        }
        const ex = Math.exp(x);
        return ex / (1 + ex);
    }

    /**
     * 以 2 为底的对数
     */
    function log2(x) {
        return Math.log(x) / Math.LN2;
    }

    /**
     * 信息熵
     * @param {number[]} probs - 概率数组
     */
    function entropy(probs) {
        let h = 0;
        for (let i = 0; i < probs.length; i++) {
            if (probs[i] > 0) {
                h -= probs[i] * log2(probs[i]);
            }
        }
        return h;
    }

    /**
     * 基尼不纯度
     * @param {number[]} probs - 概率数组
     */
    function gini(probs) {
        let sum = 0;
        for (let i = 0; i < probs.length; i++) {
            sum += probs[i] * probs[i];
        }
        return 1 - sum;
    }

    /**
     * 均方误差
     */
    function mse(predictions, labels) {
        let sum = 0;
        for (let i = 0; i < predictions.length; i++) {
            const d = predictions[i] - labels[i];
            sum += d * d;
        }
        return sum / predictions.length;
    }

    /**
     * 平均绝对误差
     */
    function mae(predictions, labels) {
        let sum = 0;
        for (let i = 0; i < predictions.length; i++) {
            sum += Math.abs(predictions[i] - labels[i]);
        }
        return sum / predictions.length;
    }

    /**
     * 向量加法
     */
    function vecAdd(a, b) {
        const result = new Array(a.length);
        for (let i = 0; i < a.length; i++) {
            result[i] = a[i] + b[i];
        }
        return result;
    }

    /**
     * 向量缩放
     */
    function vecScale(a, s) {
        const result = new Array(a.length);
        for (let i = 0; i < a.length; i++) {
            result[i] = a[i] * s;
        }
        return result;
    }

    /**
     * 向量点积
     */
    function dot(a, b) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            sum += a[i] * b[i];
        }
        return sum;
    }

    /**
     * 返回最大值的索引
     */
    function argmax(arr) {
        let maxIdx = 0;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] > arr[maxIdx]) maxIdx = i;
        }
        return maxIdx;
    }

    /**
     * 返回最小值的索引
     */
    function argmin(arr) {
        let minIdx = 0;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] < arr[minIdx]) minIdx = i;
        }
        return minIdx;
    }

    // ========================================
    // 直方图
    // ========================================

    /**
     * 构建直方图
     * @param {number[]} values - 数据值
     * @param {number} numBins - 分箱数量
     * @returns {{bins: number[], counts: number[], edges: number[]}}
     */
    function buildHistogram(values, numBins) {
        if (values.length === 0) {
            return { bins: [], counts: [], edges: [] };
        }

        let minVal = values[0], maxVal = values[0];
        for (let i = 1; i < values.length; i++) {
            if (values[i] < minVal) minVal = values[i];
            if (values[i] > maxVal) maxVal = values[i];
        }

        // 避免 min === max 时分箱宽度为 0
        if (maxVal === minVal) {
            maxVal = minVal + 1;
        }

        const binWidth = (maxVal - minVal) / numBins;
        const counts = new Array(numBins).fill(0);
        const edges = new Array(numBins + 1);
        const bins = new Array(numBins);

        for (let i = 0; i <= numBins; i++) {
            edges[i] = minVal + i * binWidth;
        }
        for (let i = 0; i < numBins; i++) {
            bins[i] = (edges[i] + edges[i + 1]) / 2;
        }

        for (let i = 0; i < values.length; i++) {
            let idx = Math.floor((values[i] - minVal) / binWidth);
            if (idx >= numBins) idx = numBins - 1;
            if (idx < 0) idx = 0;
            counts[idx]++;
        }

        return { bins, counts, edges };
    }

    /**
     * 合并两个直方图（要求 edges 相同）
     * @param {{bins: number[], counts: number[], edges: number[]}} hist1
     * @param {{bins: number[], counts: number[], edges: number[]}} hist2
     * @returns {{bins: number[], counts: number[], edges: number[]}}
     */
    function mergeHistograms(hist1, hist2) {
        const counts = new Array(hist1.counts.length);
        for (let i = 0; i < hist1.counts.length; i++) {
            counts[i] = hist1.counts[i] + hist2.counts[i];
        }
        return {
            bins: hist1.bins.slice(),
            counts: counts,
            edges: hist1.edges.slice()
        };
    }

    /**
     * 从直方图中寻找最佳分裂点
     * @param {{bins: number[], counts: number[], edges: number[]}} histogram
     * @param {number[]} gradients - 每个 bin 的梯度和
     * @param {number[]} hessians - 每个 bin 的 Hessian 和
     * @returns {{splitValue: number, gain: number}}
     */
    function findBestSplitFromHistogram(histogram, gradients, hessians) {
        const numBins = histogram.bins.length;
        let totalG = 0, totalH = 0;
        for (let i = 0; i < numBins; i++) {
            totalG += gradients[i];
            totalH += hessians[i];
        }

        let bestGain = -Infinity;
        let bestSplit = 0;
        let leftG = 0, leftH = 0;
        const lambda = 1; // 正则化参数

        for (let i = 0; i < numBins - 1; i++) {
            leftG += gradients[i];
            leftH += hessians[i];
            const rightG = totalG - leftG;
            const rightH = totalH - leftH;

            if (leftH + lambda <= 0 || rightH + lambda <= 0) continue;

            const gain =
                (leftG * leftG) / (leftH + lambda) +
                (rightG * rightG) / (rightH + lambda) -
                (totalG * totalG) / (totalH + lambda);

            if (gain > bestGain) {
                bestGain = gain;
                bestSplit = histogram.edges[i + 1];
            }
        }

        return { splitValue: bestSplit, gain: Math.max(0, bestGain) };
    }

    // ========================================
    // 决策树
    // ========================================

    /**
     * 构建决策树（回归树，基于方差缩减）
     * @param {number[][]} data - 样本特征矩阵
     * @param {number[]} labels - 目标值
     * @param {number} maxDepth - 最大深度
     * @param {number} minSamples - 叶节点最小样本数
     * @returns {object} 树结构 {feature, threshold, left, right, value}
     */
    function buildTree(data, labels, maxDepth, minSamples) {
        return _buildNode(data, labels, _range(data.length), maxDepth, minSamples, 0);
    }

    function _range(n) {
        const arr = new Array(n);
        for (let i = 0; i < n; i++) arr[i] = i;
        return arr;
    }

    function _mean(labels, indices) {
        let sum = 0;
        for (let i = 0; i < indices.length; i++) {
            sum += labels[indices[i]];
        }
        return sum / indices.length;
    }

    function _variance(labels, indices) {
        const m = _mean(labels, indices);
        let sum = 0;
        for (let i = 0; i < indices.length; i++) {
            const d = labels[indices[i]] - m;
            sum += d * d;
        }
        return sum / indices.length;
    }

    function _buildNode(data, labels, indices, maxDepth, minSamples, depth) {
        const value = _mean(labels, indices);

        // 终止条件：深度达到上限、样本数不足、方差为 0
        if (depth >= maxDepth || indices.length <= minSamples || _variance(labels, indices) < 1e-10) {
            return { value: value, count: indices.length };
        }

        const numFeatures = data[0].length;
        let bestGain = 0;
        let bestFeature = -1;
        let bestThreshold = 0;
        let bestLeftIdx = null;
        let bestRightIdx = null;

        const parentVar = _variance(labels, indices);

        for (let f = 0; f < numFeatures; f++) {
            // 收集该特征的唯一值并排序
            const vals = [];
            for (let i = 0; i < indices.length; i++) {
                vals.push(data[indices[i]][f]);
            }
            vals.sort((a, b) => a - b);

            // 取相邻值的中点作为候选阈值
            const thresholds = [];
            for (let i = 1; i < vals.length; i++) {
                if (vals[i] !== vals[i - 1]) {
                    thresholds.push((vals[i - 1] + vals[i]) / 2);
                }
            }

            for (let t = 0; t < thresholds.length; t++) {
                const leftIdx = [];
                const rightIdx = [];
                for (let i = 0; i < indices.length; i++) {
                    if (data[indices[i]][f] <= thresholds[t]) {
                        leftIdx.push(indices[i]);
                    } else {
                        rightIdx.push(indices[i]);
                    }
                }

                if (leftIdx.length < minSamples || rightIdx.length < minSamples) continue;

                const leftVar = _variance(labels, leftIdx);
                const rightVar = _variance(labels, rightIdx);
                const wLeft = leftIdx.length / indices.length;
                const wRight = rightIdx.length / indices.length;
                const gain = parentVar - (wLeft * leftVar + wRight * rightVar);

                if (gain > bestGain) {
                    bestGain = gain;
                    bestFeature = f;
                    bestThreshold = thresholds[t];
                    bestLeftIdx = leftIdx;
                    bestRightIdx = rightIdx;
                }
            }
        }

        // 没有找到有效分裂
        if (bestFeature === -1) {
            return { value: value, count: indices.length };
        }

        return {
            feature: bestFeature,
            threshold: bestThreshold,
            gain: bestGain,
            count: indices.length,
            value: value,
            left: _buildNode(data, labels, bestLeftIdx, maxDepth, minSamples, depth + 1),
            right: _buildNode(data, labels, bestRightIdx, maxDepth, minSamples, depth + 1)
        };
    }

    /**
     * 用决策树对单个样本进行预测
     * @param {object} tree - 树结构
     * @param {number[]} sample - 特征向量
     * @returns {number} 预测值
     */
    function predictTree(tree, sample) {
        if (tree.feature === undefined) {
            return tree.value;
        }
        if (sample[tree.feature] <= tree.threshold) {
            return predictTree(tree.left, sample);
        }
        return predictTree(tree.right, sample);
    }

    /**
     * 将树结构展平为节点数组，便于可视化
     * @param {object} tree - 树结构
     * @returns {object[]} 节点数组，每个节点含 {id, depth, parentId, side, feature, threshold, value, ...}
     */
    function treeToNodes(tree) {
        const nodes = [];
        let nextId = 0;

        function walk(node, depth, parentId, side) {
            const id = nextId++;
            const isLeaf = (node.feature === undefined);
            nodes.push({
                id: id,
                depth: depth,
                parentId: parentId,
                side: side,
                isLeaf: isLeaf,
                feature: isLeaf ? null : node.feature,
                threshold: isLeaf ? null : node.threshold,
                gain: node.gain || 0,
                value: node.value,
                count: node.count || 0
            });
            if (!isLeaf) {
                walk(node.left, depth + 1, id, 'left');
                walk(node.right, depth + 1, id, 'right');
            }
        }

        walk(tree, 0, null, null);
        return nodes;
    }

    // ========================================
    // 梯度提升
    // ========================================

    /**
     * 计算梯度和 Hessian
     * @param {number[]} predictions - 当前预测值
     * @param {number[]} labels - 真实标签
     * @param {string} loss - 损失函数类型 ('mse' | 'logloss')
     * @returns {{gradients: number[], hessians: number[]}}
     */
    function computeGradients(predictions, labels, loss) {
        loss = loss || 'mse';
        const n = predictions.length;
        const gradients = new Array(n);
        const hessians = new Array(n);

        if (loss === 'mse') {
            for (let i = 0; i < n; i++) {
                gradients[i] = predictions[i] - labels[i];
                hessians[i] = 1;
            }
        } else if (loss === 'logloss') {
            for (let i = 0; i < n; i++) {
                const p = sigmoid(predictions[i]);
                gradients[i] = p - labels[i];
                hessians[i] = p * (1 - p);
            }
        }

        return { gradients: gradients, hessians: hessians };
    }

    /**
     * 单步提升：在梯度上拟合一棵树
     * @param {number[][]} data - 样本特征矩阵
     * @param {number[]} gradients - 梯度
     * @param {number[]} hessians - Hessian
     * @param {object} params - {maxDepth, minSamples, lambda}
     * @returns {object} 拟合的树
     */
    function boostingStep(data, gradients, hessians, params) {
        const maxDepth = params.maxDepth || 3;
        const minSamples = params.minSamples || 1;
        const lambda = params.lambda || 1;

        // 用负梯度作为目标值来拟合回归树
        const targets = new Array(gradients.length);
        for (let i = 0; i < gradients.length; i++) {
            targets[i] = -gradients[i] / (hessians[i] + lambda);
        }

        return buildTree(data, targets, maxDepth, minSamples);
    }

    /**
     * 用多棵树进行预测
     * @param {object[]} trees - 树数组
     * @param {number[]} sample - 特征向量
     * @param {number} lr - 学习率
     * @returns {number} 预测值
     */
    function gbdtPredict(trees, sample, lr) {
        let pred = 0;
        for (let i = 0; i < trees.length; i++) {
            pred += lr * predictTree(trees[i], sample);
        }
        return pred;
    }

    /**
     * 完整的 GBDT 训练
     * @param {number[][]} data - 样本特征矩阵
     * @param {number[]} labels - 目标值
     * @param {object} params - {numTrees, lr, maxDepth, minSamples, lambda, loss}
     * @returns {{trees: object[], lossHistory: number[]}}
     */
    function trainGBDT(data, labels, params) {
        const numTrees = params.numTrees || 10;
        const lr = params.lr || 0.1;
        const maxDepth = params.maxDepth || 3;
        const minSamples = params.minSamples || 1;
        const loss = params.loss || 'mse';

        const n = data.length;
        const predictions = new Array(n).fill(0);
        const trees = [];
        const lossHistory = [];

        for (let t = 0; t < numTrees; t++) {
            // 计算梯度
            const gh = computeGradients(predictions, labels, loss);

            // 拟合一棵树
            const tree = boostingStep(data, gh.gradients, gh.hessians, {
                maxDepth: maxDepth,
                minSamples: minSamples,
                lambda: params.lambda || 1
            });
            trees.push(tree);

            // 更新预测值
            for (let i = 0; i < n; i++) {
                predictions[i] += lr * predictTree(tree, data[i]);
            }

            // 记录损失
            if (loss === 'mse') {
                lossHistory.push(mse(predictions, labels));
            } else if (loss === 'logloss') {
                let ll = 0;
                for (let i = 0; i < n; i++) {
                    const p = sigmoid(predictions[i]);
                    ll -= labels[i] * Math.log(p + 1e-15) + (1 - labels[i]) * Math.log(1 - p + 1e-15);
                }
                lossHistory.push(ll / n);
            }
        }

        return { trees: trees, lossHistory: lossHistory };
    }

    // ========================================
    // GOSS（基于梯度的单侧采样）
    // ========================================

    /**
     * GOSS 采样
     * @param {number[]} gradients - 梯度数组
     * @param {number} topRate - 保留梯度最大的比例（如 0.2）
     * @param {number} otherRate - 从剩余中随机采样的比例（如 0.1）
     * @param {number} seed - 随机种子
     * @returns {{indices: number[], weights: number[]}} 选中的样本索引和权重
     */
    function gossSubsample(gradients, topRate, otherRate, seed) {
        const rng = seededRandom(seed);
        const n = gradients.length;

        // 按梯度绝对值排序的索引
        const sorted = new Array(n);
        for (let i = 0; i < n; i++) sorted[i] = i;
        sorted.sort(function (a, b) {
            return Math.abs(gradients[b]) - Math.abs(gradients[a]);
        });

        const topCount = Math.max(1, Math.round(n * topRate));
        const otherCount = Math.max(1, Math.round((n - topCount) * otherRate));
        const amplify = (1 - topRate) / otherRate;

        const indices = [];
        const weights = [];

        // 保留梯度绝对值最大的 top 样本
        for (let i = 0; i < topCount; i++) {
            indices.push(sorted[i]);
            weights.push(1);
        }

        // 从剩余中随机采样
        const rest = sorted.slice(topCount);
        // Fisher-Yates 部分洗牌
        for (let i = 0; i < otherCount && i < rest.length; i++) {
            const j = i + Math.floor(rng() * (rest.length - i));
            const tmp = rest[i];
            rest[i] = rest[j];
            rest[j] = tmp;
        }
        for (let i = 0; i < otherCount && i < rest.length; i++) {
            indices.push(rest[i]);
            weights.push(amplify);
        }

        return { indices: indices, weights: weights };
    }

    // ========================================
    // EFB（互斥特征捆绑）
    // ========================================

    /**
     * 寻找互斥特征的捆绑
     * 互斥特征 = 很少同时取非零值的特征对
     * @param {number[][]} features - 特征矩阵 (n_samples x n_features)
     * @param {number} threshold - 冲突阈值（允许同时非零的最大比例）
     * @returns {number[][]} 捆绑数组，每个元素是一组特征索引
     */
    function findExclusiveBundles(features, threshold) {
        threshold = threshold || 0;
        const n = features.length;
        const numF = features[0].length;

        // 构建冲突矩阵
        const conflicts = [];
        for (let i = 0; i < numF; i++) {
            conflicts[i] = new Array(numF).fill(0);
        }

        for (let i = 0; i < numF; i++) {
            for (let j = i + 1; j < numF; j++) {
                let count = 0;
                for (let k = 0; k < n; k++) {
                    if (features[k][i] !== 0 && features[k][j] !== 0) {
                        count++;
                    }
                }
                conflicts[i][j] = count / n;
                conflicts[j][i] = count / n;
            }
        }

        // 贪心捆绑
        const assigned = new Array(numF).fill(false);
        const bundles = [];

        // 按非零次数降序排列特征
        const featureOrder = new Array(numF);
        for (let i = 0; i < numF; i++) featureOrder[i] = i;
        featureOrder.sort(function (a, b) {
            let countA = 0, countB = 0;
            for (let k = 0; k < n; k++) {
                if (features[k][a] !== 0) countA++;
                if (features[k][b] !== 0) countB++;
            }
            return countB - countA;
        });

        for (let idx = 0; idx < numF; idx++) {
            const f = featureOrder[idx];
            if (assigned[f]) continue;

            const bundle = [f];
            assigned[f] = true;

            for (let idx2 = idx + 1; idx2 < numF; idx2++) {
                const g = featureOrder[idx2];
                if (assigned[g]) continue;

                // 检查 g 与 bundle 中所有特征的冲突
                let canBundle = true;
                for (let b = 0; b < bundle.length; b++) {
                    if (conflicts[g][bundle[b]] > threshold) {
                        canBundle = false;
                        break;
                    }
                }
                if (canBundle) {
                    bundle.push(g);
                    assigned[g] = true;
                }
            }
            bundles.push(bundle);
        }

        return bundles;
    }

    /**
     * 合并捆绑内的特征为一个新特征
     * 使用偏移量编码，使不同特征的取值范围不重叠
     * @param {number[][]} features - 特征矩阵 (n_samples x n_features)
     * @param {number[]} bundle - 需要合并的特征索引数组
     * @returns {number[]} 合并后的单个特征 (长度 = n_samples)
     */
    function mergeFeatures(features, bundle) {
        const n = features.length;

        // 计算每个特征的最大值作为偏移基准
        const offsets = [0];
        for (let b = 0; b < bundle.length - 1; b++) {
            const fIdx = bundle[b];
            let maxVal = 0;
            for (let i = 0; i < n; i++) {
                if (features[i][fIdx] > maxVal) maxVal = features[i][fIdx];
            }
            offsets.push(offsets[b] + maxVal + 1);
        }

        const merged = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let b = 0; b < bundle.length; b++) {
                const val = features[i][bundle[b]];
                if (val !== 0) {
                    merged[i] = val + offsets[b];
                    break; // 互斥特征，只有一个非零
                }
            }
        }

        return merged;
    }

    // ========================================
    // 数据生成
    // ========================================

    /**
     * 生成回归数据（基于多项式 + 噪声）
     * @param {number} n - 样本数
     * @param {number} noise - 噪声标准差
     * @param {number} seed - 随机种子
     * @returns {{data: number[][], labels: number[]}}
     */
    function generateRegressionData(n, noise, seed) {
        const rng = seededRandom(seed);
        const data = [];
        const labels = [];

        for (let i = 0; i < n; i++) {
            const x = rng() * 4 - 2; // [-2, 2]
            const y = 0.5 * x * x + 0.3 * x + _gaussianNoise(rng) * noise;
            data.push([x]);
            labels.push(y);
        }

        return { data: data, labels: labels };
    }

    /**
     * 生成二分类数据（2D 特征，两类）
     * @param {number} n - 样本数
     * @param {number} noise - 噪声标准差
     * @param {number} seed - 随机种子
     * @returns {{data: number[][], labels: number[]}}
     */
    function generateClassificationData(n, noise, seed) {
        const rng = seededRandom(seed);
        const data = [];
        const labels = [];

        for (let i = 0; i < n; i++) {
            const label = (i < n / 2) ? 0 : 1;
            const cx = label === 0 ? -0.5 : 0.5;
            const cy = label === 0 ? -0.5 : 0.5;
            const x = cx + _gaussianNoise(rng) * noise;
            const y = cy + _gaussianNoise(rng) * noise;
            data.push([x, y]);
            labels.push(label);
        }

        return { data: data, labels: labels };
    }

    /**
     * 生成正弦曲线数据
     * @param {number} n - 样本数
     * @param {number} noise - 噪声标准差
     * @param {number} seed - 随机种子
     * @returns {{data: number[][], labels: number[]}}
     */
    function generateSineData(n, noise, seed) {
        const rng = seededRandom(seed);
        const data = [];
        const labels = [];

        for (let i = 0; i < n; i++) {
            const x = rng() * 2 * Math.PI;
            const y = Math.sin(x) + _gaussianNoise(rng) * noise;
            data.push([x]);
            labels.push(y);
        }

        return { data: data, labels: labels };
    }

    /**
     * Box-Muller 正态分布噪声
     */
    function _gaussianNoise(rng) {
        const u1 = rng();
        const u2 = rng();
        return Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
    }

    // ========================================
    // 可视化
    // ========================================

    /**
     * 将数值映射为颜色（蓝 → 白 → 红）
     * @param {number} value - 当前值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {string} CSS 颜色字符串
     */
    function valueToColor(value, min, max) {
        if (max === min) return 'rgb(200,200,200)';
        const t = (value - min) / (max - min); // [0, 1]

        let r, g, b;
        if (t < 0.5) {
            // 蓝 → 白
            const s = t * 2;
            r = Math.round(60 + s * 195);
            g = Math.round(80 + s * 175);
            b = Math.round(220 + s * 35);
        } else {
            // 白 → 红
            const s = (t - 0.5) * 2;
            r = 255;
            g = Math.round(255 - s * 175);
            b = Math.round(255 - s * 195);
        }

        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    /**
     * 树可视化配色方案
     */
    const TREE_COLORS = {
        node: '#4a6fa5',
        leaf: '#47b884',
        split: '#e8a838',
        nodeBorder: '#5a8fcf',
        leafBorder: '#5cd89e',
        splitBorder: '#f0c060',
        edge: '#8899aa',
        text: '#e0e0e0',
        background: '#1a1a2e'
    };

    // ========================================
    // 导出所有函数
    // ========================================

    return {
        // 随机数
        seededRandom: seededRandom,

        // 数学工具
        sigmoid: sigmoid,
        log2: log2,
        entropy: entropy,
        gini: gini,
        mse: mse,
        mae: mae,
        vecAdd: vecAdd,
        vecScale: vecScale,
        dot: dot,
        argmax: argmax,
        argmin: argmin,

        // 直方图
        buildHistogram: buildHistogram,
        mergeHistograms: mergeHistograms,
        findBestSplitFromHistogram: findBestSplitFromHistogram,

        // 决策树
        buildTree: buildTree,
        predictTree: predictTree,
        treeToNodes: treeToNodes,

        // 梯度提升
        computeGradients: computeGradients,
        boostingStep: boostingStep,
        gbdtPredict: gbdtPredict,
        trainGBDT: trainGBDT,

        // GOSS
        gossSubsample: gossSubsample,

        // EFB
        findExclusiveBundles: findExclusiveBundles,
        mergeFeatures: mergeFeatures,

        // 数据生成
        generateRegressionData: generateRegressionData,
        generateClassificationData: generateClassificationData,
        generateSineData: generateSineData,

        // 可视化
        valueToColor: valueToColor,
        TREE_COLORS: TREE_COLORS
    };

})();
