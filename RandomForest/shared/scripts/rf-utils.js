/**
 * rf-utils.js — 随机森林工具集
 * 决策树构建、分裂准则、Bagging、随机子空间、投票、特征重要性
 */

const RFUtils = (() => {
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
            // Label depends mainly on feature 0 and 1
            const score = features[0] * 0.5 + features[1] * 0.3 + (rng() - 0.5) * 2;
            const label = score > 0 ? 1 : 0;
            data.push({ features, label });
        }
        return data;
    }

    /* === 信息论指标 === */
    function entropy(counts) {
        const total = counts.reduce((a, b) => a + b, 0);
        if (total === 0) return 0;
        let h = 0;
        for (const c of counts) {
            if (c > 0) {
                const p = c / total;
                h -= p * Math.log2(p);
            }
        }
        return h;
    }

    function giniImpurity(counts) {
        const total = counts.reduce((a, b) => a + b, 0);
        if (total === 0) return 0;
        let g = 1;
        for (const c of counts) {
            const p = c / total;
            g -= p * p;
        }
        return g;
    }

    function classificationError(counts) {
        const total = counts.reduce((a, b) => a + b, 0);
        if (total === 0) return 0;
        return 1 - Math.max(...counts) / total;
    }

    function informationGain(parentCounts, leftCounts, rightCounts, criterion = 'entropy') {
        const fn = criterion === 'gini' ? giniImpurity : entropy;
        const totalParent = parentCounts.reduce((a, b) => a + b, 0);
        const totalLeft = leftCounts.reduce((a, b) => a + b, 0);
        const totalRight = rightCounts.reduce((a, b) => a + b, 0);
        return fn(parentCounts)
            - (totalLeft / totalParent) * fn(leftCounts)
            - (totalRight / totalParent) * fn(rightCounts);
    }

    /* === 决策树 === */
    function countClasses(data, labelKey = 'label') {
        const counts = {};
        for (const d of data) {
            const l = d[labelKey];
            counts[l] = (counts[l] || 0) + 1;
        }
        return counts;
    }

    function majorityClass(data, labelKey = 'label') {
        const counts = countClasses(data, labelKey);
        let best = null, bestCount = -1;
        for (const [k, v] of Object.entries(counts)) {
            if (v > bestCount) { best = k; bestCount = v; }
        }
        return Number(best);
    }

    function meanTarget(data, targetKey = 'target') {
        if (data.length === 0) return 0;
        return data.reduce((s, d) => s + d[targetKey], 0) / data.length;
    }

    function findBestSplit(data, featureIndex, criterion = 'gini', labelKey = 'label') {
        const getVal = (d) => Array.isArray(d.features) ? d.features[featureIndex] : (featureIndex === 0 ? d.x : d.y);
        const sorted = [...data].sort((a, b) => getVal(a) - getVal(b));

        const classes = [...new Set(data.map(d => d[labelKey]))].sort();
        const parentCounts = classes.map(c => data.filter(d => d[labelKey] === c).length);

        let bestGain = -Infinity, bestThreshold = 0;
        const leftCounts = new Array(classes.length).fill(0);
        const rightCounts = [...parentCounts];

        for (let i = 0; i < sorted.length - 1; i++) {
            const classIdx = classes.indexOf(sorted[i][labelKey]);
            leftCounts[classIdx]++;
            rightCounts[classIdx]--;

            if (getVal(sorted[i]) === getVal(sorted[i + 1])) continue;

            const threshold = (getVal(sorted[i]) + getVal(sorted[i + 1])) / 2;
            const gain = informationGain(parentCounts, leftCounts, rightCounts, criterion);
            if (gain > bestGain) {
                bestGain = gain;
                bestThreshold = threshold;
            }
        }

        return { featureIndex, threshold: bestThreshold, gain: bestGain };
    }

    function buildTree(data, options = {}) {
        const {
            maxDepth = 5,
            minSamples = 2,
            criterion = 'gini',
            featureIndices = null,
            maxFeatures = null,
            labelKey = 'label',
            seed = 42,
            isRegression = false,
        } = options;

        const rng = seededRandom(seed);

        function _build(subset, depth, nodeId = 0) {
            const node = { id: nodeId, depth, samples: subset.length };

            if (isRegression) {
                node.prediction = meanTarget(subset);
            } else {
                const counts = countClasses(subset, labelKey);
                node.classCounts = counts;
                node.prediction = majorityClass(subset, labelKey);
            }

            // Stopping criteria
            if (depth >= maxDepth || subset.length < minSamples) {
                node.isLeaf = true;
                return node;
            }

            if (!isRegression) {
                const uniqueLabels = new Set(subset.map(d => d[labelKey]));
                if (uniqueLabels.size <= 1) {
                    node.isLeaf = true;
                    return node;
                }
            }

            // Determine features to consider
            let features = featureIndices;
            if (!features) {
                const nFeat = Array.isArray(subset[0].features) ? subset[0].features.length : 2;
                features = Array.from({ length: nFeat }, (_, i) => i);
            }

            if (maxFeatures && maxFeatures < features.length) {
                const shuffled = [...features];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(rng() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                features = shuffled.slice(0, maxFeatures);
                node.consideredFeatures = features;
            }

            // Find best split
            let bestSplit = null;
            for (const fi of features) {
                const split = findBestSplit(subset, fi, criterion, labelKey);
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

            const getVal = (d) => Array.isArray(d.features) ? d.features[bestSplit.featureIndex] : (bestSplit.featureIndex === 0 ? d.x : d.y);
            const left = subset.filter(d => getVal(d) <= bestSplit.threshold);
            const right = subset.filter(d => getVal(d) > bestSplit.threshold);

            if (left.length === 0 || right.length === 0) {
                node.isLeaf = true;
                return node;
            }

            node.left = _build(left, depth + 1, nodeId * 2 + 1);
            node.right = _build(right, depth + 1, nodeId * 2 + 2);

            return node;
        }

        return _build(data, 0);
    }

    function predictTree(tree, point) {
        let node = tree;
        const path = [node];
        while (!node.isLeaf) {
            const val = Array.isArray(point.features)
                ? point.features[node.splitFeature]
                : (node.splitFeature === 0 ? point.x : point.y);
            node = val <= node.splitThreshold ? node.left : node.right;
            path.push(node);
        }
        return { prediction: node.prediction, path };
    }

    function treeDepth(tree) {
        if (!tree || tree.isLeaf) return 0;
        return 1 + Math.max(treeDepth(tree.left), treeDepth(tree.right));
    }

    function treeNodeCount(tree) {
        if (!tree) return 0;
        if (tree.isLeaf) return 1;
        return 1 + treeNodeCount(tree.left) + treeNodeCount(tree.right);
    }

    /* === Bootstrap 采样 === */
    function bootstrapSample(data, seed = 42) {
        const rng = seededRandom(seed);
        const n = data.length;
        const sample = [];
        const oobIndices = new Set(Array.from({ length: n }, (_, i) => i));

        for (let i = 0; i < n; i++) {
            const idx = Math.floor(rng() * n);
            sample.push(data[idx]);
            oobIndices.delete(idx);
        }

        return { sample, oobIndices: [...oobIndices] };
    }

    /* === 随机森林 === */
    function buildForest(data, options = {}) {
        const {
            nTrees = 10,
            maxDepth = 4,
            minSamples = 2,
            maxFeatures = null,
            criterion = 'gini',
            labelKey = 'label',
            seed = 42,
        } = options;

        const nFeat = Array.isArray(data[0].features) ? data[0].features.length : 2;
        const mf = maxFeatures || Math.max(1, Math.round(Math.sqrt(nFeat)));

        const trees = [];
        for (let t = 0; t < nTrees; t++) {
            const { sample, oobIndices } = bootstrapSample(data, seed + t * 137);
            const tree = buildTree(sample, {
                maxDepth,
                minSamples,
                criterion,
                maxFeatures: mf,
                labelKey,
                seed: seed + t * 251,
            });
            trees.push({ tree, oobIndices, bootstrapSize: sample.length });
        }

        return { trees, nTrees, maxFeatures: mf };
    }

    function predictForest(forest, point) {
        const votes = {};
        const treePredictions = [];
        for (const { tree } of forest.trees) {
            const { prediction, path } = predictTree(tree, point);
            treePredictions.push({ prediction, path });
            votes[prediction] = (votes[prediction] || 0) + 1;
        }

        let best = null, bestCount = -1;
        for (const [k, v] of Object.entries(votes)) {
            if (v > bestCount) { best = Number(k); bestCount = v; }
        }

        return { prediction: best, votes, treePredictions };
    }

    function oobScore(data, forest) {
        let correct = 0, total = 0;
        for (let i = 0; i < data.length; i++) {
            const votes = {};
            let count = 0;
            for (const { tree, oobIndices } of forest.trees) {
                if (oobIndices.includes(i)) {
                    const { prediction } = predictTree(tree, data[i]);
                    votes[prediction] = (votes[prediction] || 0) + 1;
                    count++;
                }
            }
            if (count > 0) {
                let best = null, bestCount = -1;
                for (const [k, v] of Object.entries(votes)) {
                    if (v > bestCount) { best = Number(k); bestCount = v; }
                }
                if (best === data[i].label) correct++;
                total++;
            }
        }
        return total > 0 ? correct / total : 0;
    }

    /* === 特征重要性 === */
    function giniImportance(forest) {
        const importance = {};
        let totalGain = 0;

        function traverse(node) {
            if (!node || node.isLeaf) return;
            const fi = node.splitFeature;
            const gain = (node.gain || 0) * node.samples;
            importance[fi] = (importance[fi] || 0) + gain;
            totalGain += gain;
            traverse(node.left);
            traverse(node.right);
        }

        for (const { tree } of forest.trees) {
            traverse(tree);
        }

        if (totalGain > 0) {
            for (const k of Object.keys(importance)) {
                importance[k] /= totalGain;
            }
        }

        return importance;
    }

    function permutationImportance(data, forest, nRepeats = 5, seed = 42) {
        const rng = seededRandom(seed);
        const nFeat = Array.isArray(data[0].features) ? data[0].features.length : 2;

        // Baseline accuracy
        let baseCorrect = 0;
        for (const d of data) {
            const { prediction } = predictForest(forest, d);
            if (prediction === d.label) baseCorrect++;
        }
        const baseAcc = baseCorrect / data.length;

        const importance = {};
        for (let fi = 0; fi < nFeat; fi++) {
            let dropSum = 0;
            for (let r = 0; r < nRepeats; r++) {
                // Shuffle feature fi
                const permuted = data.map(d => {
                    const copy = { ...d };
                    if (Array.isArray(d.features)) {
                        copy.features = [...d.features];
                        const swapIdx = Math.floor(rng() * data.length);
                        copy.features[fi] = data[swapIdx].features[fi];
                    } else {
                        const swapIdx = Math.floor(rng() * data.length);
                        if (fi === 0) copy.x = data[swapIdx].x;
                        else copy.y = data[swapIdx].y;
                    }
                    return copy;
                });

                let correct = 0;
                for (const d of permuted) {
                    const { prediction } = predictForest(forest, d);
                    if (prediction === d.label) correct++;
                }
                dropSum += baseAcc - correct / data.length;
            }
            importance[fi] = dropSum / nRepeats;
        }

        return importance;
    }

    /* === 可视化辅助 === */
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

    const CLASS_COLORS = ['#ff5252', '#4fc3f7', '#16c79a', '#ffab40', '#b388ff', '#ff80ab'];

    function classColor(label) {
        return CLASS_COLORS[label % CLASS_COLORS.length];
    }

    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    /* === 树的扁平化（用于可视化） === */
    function flattenTree(tree) {
        const nodes = [];
        function traverse(node, x = 0, y = 0, dx = 1) {
            if (!node) return;
            nodes.push({
                ...node,
                vx: x,
                vy: y,
            });
            if (!node.isLeaf) {
                traverse(node.left, x - dx, y + 1, dx / 2);
                traverse(node.right, x + dx, y + 1, dx / 2);
            }
        }
        traverse(tree);
        return nodes;
    }

    return {
        seededRandom,
        generateClassificationData, generateRegressionData, generateMultiFeatureData,
        entropy, giniImpurity, classificationError, informationGain,
        countClasses, majorityClass, meanTarget,
        findBestSplit, buildTree, predictTree, treeDepth, treeNodeCount,
        bootstrapSample,
        buildForest, predictForest, oobScore,
        giniImportance, permutationImportance,
        valueToColor, classColor, CLASS_COLORS,
        lerp, clamp, flattenTree,
    };
})();
