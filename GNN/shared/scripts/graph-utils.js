/**
 * graph-utils.js — 图数据工具函数
 * 邻接矩阵生成、度矩阵、归一化、图数据转换
 */

const GraphUtils = (() => {
    /**
     * 从边列表生成邻接矩阵
     * @param {number} n - 节点数
     * @param {Array<[number, number]>} edges - 边列表
     * @param {boolean} directed - 是否有向图
     * @returns {number[][]} 邻接矩阵
     */
    function adjacencyMatrix(n, edges, directed = false) {
        const A = Array.from({ length: n }, () => new Array(n).fill(0));
        for (const [u, v] of edges) {
            A[u][v] = 1;
            if (!directed) A[v][u] = 1;
        }
        return A;
    }

    /**
     * 从邻接矩阵提取边列表
     */
    function edgesFromMatrix(A) {
        const edges = [];
        const n = A.length;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (A[i][j]) edges.push([i, j]);
            }
        }
        return edges;
    }

    /**
     * 度矩阵
     */
    function degreeMatrix(A) {
        const n = A.length;
        const D = Array.from({ length: n }, () => new Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            D[i][i] = A[i].reduce((s, v) => s + v, 0);
        }
        return D;
    }

    /**
     * 度向量
     */
    function degreeVector(A) {
        return A.map(row => row.reduce((s, v) => s + v, 0));
    }

    /**
     * A + I（加自环）
     */
    function addSelfLoops(A) {
        const n = A.length;
        return A.map((row, i) => row.map((v, j) => i === j ? v + 1 : v));
    }

    /**
     * D^{-1/2} A D^{-1/2} 对称归一化
     */
    function symmetricNormalize(A) {
        const n = A.length;
        const deg = degreeVector(A);
        const dInvSqrt = deg.map(d => d > 0 ? 1 / Math.sqrt(d) : 0);
        const result = Array.from({ length: n }, () => new Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                result[i][j] = dInvSqrt[i] * A[i][j] * dInvSqrt[j];
            }
        }
        return result;
    }

    /**
     * D^{-1} A 随机游走归一化
     */
    function randomWalkNormalize(A) {
        const n = A.length;
        const deg = degreeVector(A);
        const result = Array.from({ length: n }, () => new Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            if (deg[i] > 0) {
                for (let j = 0; j < n; j++) {
                    result[i][j] = A[i][j] / deg[i];
                }
            }
        }
        return result;
    }

    /**
     * GCN 归一化: D̂^{-1/2} Â D̂^{-1/2}，其中 Â = A + I
     */
    function gcnNormalize(A) {
        return symmetricNormalize(addSelfLoops(A));
    }

    /**
     * 矩阵乘法
     */
    function matmul(A, B) {
        const m = A.length, n = B[0].length, k = B.length;
        const C = Array.from({ length: m }, () => new Array(n).fill(0));
        for (let i = 0; i < m; i++) {
            for (let j = 0; j < n; j++) {
                for (let p = 0; p < k; p++) {
                    C[i][j] += A[i][p] * B[p][j];
                }
            }
        }
        return C;
    }

    /**
     * ReLU 激活
     */
    function relu(M) {
        return M.map(row => row.map(v => Math.max(0, v)));
    }

    /**
     * Softmax（按行）
     */
    function softmaxRows(M) {
        return M.map(row => {
            const max = Math.max(...row);
            const exps = row.map(v => Math.exp(v - max));
            const sum = exps.reduce((a, b) => a + b, 0);
            return exps.map(e => e / sum);
        });
    }

    /**
     * 生成随机特征矩阵
     */
    function randomFeatures(n, dim, seed = 42) {
        const rng = seededRandom(seed);
        return Array.from({ length: n }, () =>
            Array.from({ length: dim }, () => +(rng() * 2 - 1).toFixed(3))
        );
    }

    /**
     * 生成随机权重矩阵
     */
    function randomWeights(inDim, outDim, seed = 123) {
        const rng = seededRandom(seed);
        const scale = Math.sqrt(2 / inDim);
        return Array.from({ length: inDim }, () =>
            Array.from({ length: outDim }, () => +(rng() * scale * 2 - scale).toFixed(3))
        );
    }

    /**
     * 简单确定性随机数
     */
    function seededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return s / 2147483647;
        };
    }

    /**
     * k-hop 邻域
     * @returns {Set<number>} k-hop 内的节点 id
     */
    function kHopNeighbors(A, nodeId, k) {
        const visited = new Set([nodeId]);
        let frontier = [nodeId];
        for (let hop = 0; hop < k; hop++) {
            const next = [];
            for (const u of frontier) {
                for (let v = 0; v < A.length; v++) {
                    if (A[u][v] && !visited.has(v)) {
                        visited.add(v);
                        next.push(v);
                    }
                }
            }
            frontier = next;
        }
        return visited;
    }

    /**
     * 将图数据转为 Cytoscape 格式
     */
    function toCytoscapeElements(nodes, edges) {
        const elements = [];
        for (const node of nodes) {
            elements.push({
                data: {
                    id: String(node.id),
                    label: node.label || String(node.id),
                    ...(node.features && { features: node.features }),
                    ...(node.group !== undefined && { group: node.group }),
                }
            });
        }
        for (const [u, v] of edges) {
            elements.push({
                data: {
                    id: `e${u}-${v}`,
                    source: String(u),
                    target: String(v),
                }
            });
        }
        return elements;
    }

    /**
     * 颜色插值
     */
    function valueToColor(value, min = 0, max = 1) {
        const t = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));
        // 从深蓝到绿色
        const r = Math.round(22 + t * 0);
        const g = Math.round(30 + t * 169);
        const b = Math.round(46 + t * 108);
        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * 转置
     */
    function transpose(M) {
        const m = M.length, n = M[0].length;
        return Array.from({ length: n }, (_, j) =>
            Array.from({ length: m }, (_, i) => M[i][j])
        );
    }

    return {
        adjacencyMatrix,
        edgesFromMatrix,
        degreeMatrix,
        degreeVector,
        addSelfLoops,
        symmetricNormalize,
        randomWalkNormalize,
        gcnNormalize,
        matmul,
        relu,
        softmaxRows,
        randomFeatures,
        randomWeights,
        seededRandom,
        kHopNeighbors,
        toCytoscapeElements,
        valueToColor,
        transpose,
    };
})();
