/**
 * cnn-utils.js — CNN 工具集
 * 卷积运算、池化操作、特征图生成、可视化辅助
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

const CNNUtils = (() => {

    /* === 随机数 === */
    function seededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    /* === 数学基础 === */
    function sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))); }
    function relu(x) { return Math.max(0, x); }
    function leakyRelu(x, alpha = 0.01) { return x >= 0 ? x : alpha * x; }
    function tanh(x) { return Math.tanh(x); }

    function softmax(arr) {
        const max = Math.max(...arr);
        const exps = arr.map(x => Math.exp(x - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        return exps.map(e => e / sum);
    }

    /* === 矩阵/张量运算 === */
    function zerosMatrix(rows, cols) {
        return Array.from({ length: rows }, () => new Array(cols).fill(0));
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

    function matAdd(A, B) {
        return A.map((row, i) => row.map((v, j) => v + B[i][j]));
    }

    function matScale(A, s) {
        return A.map(row => row.map(v => v * s));
    }

    function matMul(A, B) {
        return A.map((row, i) => row.map((v, j) => v * B[i][j]));
    }

    function dot(a, b) {
        return a.reduce((s, v, i) => s + v * (b[i] || 0), 0);
    }

    /**
     * im2col — 将图像块展开为列，便于矩阵化卷积运算
     * @param {number[][]} input2d  输入二维数组
     * @param {number} kH  卷积核高度
     * @param {number} kW  卷积核宽度
     * @param {number} stride  步长
     * @param {number} padding  零填充
     * @returns {number[][]} 列矩阵，每列为一个展开的图像块
     */
    function im2col(input2d, kH, kW, stride = 1, padding = 0) {
        const padded = padding > 0 ? applyPadding(input2d, padding) : input2d;
        const inH = padded.length;
        const inW = padded[0].length;
        const outH = Math.floor((inH - kH) / stride) + 1;
        const outW = Math.floor((inW - kW) / stride) + 1;
        const cols = [];

        for (let i = 0; i < outH; i++) {
            for (let j = 0; j < outW; j++) {
                const col = [];
                for (let ki = 0; ki < kH; ki++) {
                    for (let kj = 0; kj < kW; kj++) {
                        col.push(padded[i * stride + ki][j * stride + kj]);
                    }
                }
                cols.push(col);
            }
        }
        return cols;
    }

    /* === 卷积操作 === */

    /**
     * applyPadding — 对二维数组进行零填充
     * @param {number[][]} input2d  输入二维数组
     * @param {number} pad  填充大小
     * @returns {number[][]} 填充后的二维数组
     */
    function applyPadding(input2d, pad) {
        if (pad <= 0) return input2d.map(row => [...row]);
        const h = input2d.length;
        const w = input2d[0].length;
        const newH = h + 2 * pad;
        const newW = w + 2 * pad;
        const result = zerosMatrix(newH, newW);
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                result[i + pad][j + pad] = input2d[i][j];
            }
        }
        return result;
    }

    /**
     * conv2d — 二维卷积运算
     * @param {number[][]} input2d  输入特征图
     * @param {number[][]} kernel   卷积核
     * @param {number} stride  步长（默认1）
     * @param {number} padding 零填充（默认0）
     * @returns {number[][]} 输出特征图
     */
    function conv2d(input2d, kernel, stride = 1, padding = 0) {
        const padded = padding > 0 ? applyPadding(input2d, padding) : input2d;
        const inH = padded.length;
        const inW = padded[0].length;
        const kH = kernel.length;
        const kW = kernel[0].length;
        const outH = Math.floor((inH - kH) / stride) + 1;
        const outW = Math.floor((inW - kW) / stride) + 1;
        const output = zerosMatrix(outH, outW);

        for (let i = 0; i < outH; i++) {
            for (let j = 0; j < outW; j++) {
                let sum = 0;
                for (let ki = 0; ki < kH; ki++) {
                    for (let kj = 0; kj < kW; kj++) {
                        sum += padded[i * stride + ki][j * stride + kj] * kernel[ki][kj];
                    }
                }
                output[i][j] = sum;
            }
        }
        return output;
    }

    /**
     * maxPool2d — 最大池化
     * @param {number[][]} input2d  输入特征图
     * @param {number} size  池化窗口大小（默认2）
     * @param {number} stride  步长（默认2）
     * @returns {number[][]} 池化后的特征图
     */
    function maxPool2d(input2d, size = 2, stride = 2) {
        const inH = input2d.length;
        const inW = input2d[0].length;
        const outH = Math.floor((inH - size) / stride) + 1;
        const outW = Math.floor((inW - size) / stride) + 1;
        const output = zerosMatrix(outH, outW);

        for (let i = 0; i < outH; i++) {
            for (let j = 0; j < outW; j++) {
                let maxVal = -Infinity;
                for (let pi = 0; pi < size; pi++) {
                    for (let pj = 0; pj < size; pj++) {
                        const val = input2d[i * stride + pi][j * stride + pj];
                        if (val > maxVal) maxVal = val;
                    }
                }
                output[i][j] = maxVal;
            }
        }
        return output;
    }

    /**
     * avgPool2d — 平均池化
     * @param {number[][]} input2d  输入特征图
     * @param {number} size  池化窗口大小（默认2）
     * @param {number} stride  步长（默认2）
     * @returns {number[][]} 池化后的特征图
     */
    function avgPool2d(input2d, size = 2, stride = 2) {
        const inH = input2d.length;
        const inW = input2d[0].length;
        const outH = Math.floor((inH - size) / stride) + 1;
        const outW = Math.floor((inW - size) / stride) + 1;
        const output = zerosMatrix(outH, outW);
        const count = size * size;

        for (let i = 0; i < outH; i++) {
            for (let j = 0; j < outW; j++) {
                let sum = 0;
                for (let pi = 0; pi < size; pi++) {
                    for (let pj = 0; pj < size; pj++) {
                        sum += input2d[i * stride + pi][j * stride + pj];
                    }
                }
                output[i][j] = sum / count;
            }
        }
        return output;
    }

    /**
     * globalAvgPool — 全局平均池化
     * @param {number[][]} input2d  输入特征图
     * @returns {number} 全局平均值
     */
    function globalAvgPool(input2d) {
        let sum = 0;
        let count = 0;
        for (let i = 0; i < input2d.length; i++) {
            for (let j = 0; j < input2d[0].length; j++) {
                sum += input2d[i][j];
                count++;
            }
        }
        return sum / count;
    }

    /* === 二维激活函数 === */
    function applyRelu2d(input2d) {
        return input2d.map(row => row.map(v => relu(v)));
    }

    function applySigmoid2d(input2d) {
        return input2d.map(row => row.map(v => sigmoid(v)));
    }

    function applyTanh2d(input2d) {
        return input2d.map(row => row.map(v => tanh(v)));
    }

    /* === 特征图生成 === */

    /**
     * generateSampleImage — 生成简单的测试图像
     * @param {number} size  图像尺寸（正方形）
     * @param {string} type  图像类型：edges | circles | gradients | checkerboard
     * @returns {number[][]} 二维数组表示的图像（值范围0~1）
     */
    function generateSampleImage(size, type = 'edges') {
        const img = zerosMatrix(size, size);
        const mid = Math.floor(size / 2);

        switch (type) {
            case 'edges':
                // 垂直和水平边缘
                for (let i = 0; i < size; i++) {
                    for (let j = 0; j < size; j++) {
                        if (j === mid) img[i][j] = 1;               // 垂直线
                        if (i === mid) img[i][j] = 1;               // 水平线
                        if (j === Math.floor(size * 0.25)) img[i][j] = 0.7;
                        if (i === Math.floor(size * 0.75)) img[i][j] = 0.7;
                    }
                }
                break;

            case 'circles':
                // 同心圆
                for (let i = 0; i < size; i++) {
                    for (let j = 0; j < size; j++) {
                        const dx = i - mid;
                        const dy = j - mid;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const r1 = size * 0.15;
                        const r2 = size * 0.3;
                        const r3 = size * 0.45;
                        if (Math.abs(dist - r1) < 1) img[i][j] = 1;
                        else if (Math.abs(dist - r2) < 1) img[i][j] = 0.8;
                        else if (Math.abs(dist - r3) < 1) img[i][j] = 0.6;
                    }
                }
                break;

            case 'gradients':
                // 对角渐变
                for (let i = 0; i < size; i++) {
                    for (let j = 0; j < size; j++) {
                        img[i][j] = (i + j) / (2 * (size - 1));
                    }
                }
                break;

            case 'checkerboard':
                // 棋盘格
                const blockSize = Math.max(1, Math.floor(size / 8));
                for (let i = 0; i < size; i++) {
                    for (let j = 0; j < size; j++) {
                        const bi = Math.floor(i / blockSize);
                        const bj = Math.floor(j / blockSize);
                        img[i][j] = (bi + bj) % 2 === 0 ? 1 : 0;
                    }
                }
                break;

            default:
                // 默认为边缘
                return generateSampleImage(size, 'edges');
        }
        return img;
    }

    /**
     * generateRandomKernel — 生成预定义卷积核
     * @param {number} size  卷积核尺寸（3 或 5）
     * @param {string} type  类型：edge_h | edge_v | sobel_h | sobel_v | sharpen | blur | emboss
     * @returns {number[][]} 卷积核二维数组
     */
    function generateRandomKernel(size, type = 'edge') {
        // 3x3 预定义卷积核
        const kernels3 = {
            edge_h: [
                [-1, -1, -1],
                [ 0,  0,  0],
                [ 1,  1,  1]
            ],
            edge_v: [
                [-1, 0, 1],
                [-1, 0, 1],
                [-1, 0, 1]
            ],
            sobel_h: [
                [-1, -2, -1],
                [ 0,  0,  0],
                [ 1,  2,  1]
            ],
            sobel_v: [
                [-1, 0, 1],
                [-2, 0, 2],
                [-1, 0, 1]
            ],
            sharpen: [
                [ 0, -1,  0],
                [-1,  5, -1],
                [ 0, -1,  0]
            ],
            blur: [
                [1/9, 1/9, 1/9],
                [1/9, 1/9, 1/9],
                [1/9, 1/9, 1/9]
            ],
            emboss: [
                [-2, -1, 0],
                [-1,  1, 1],
                [ 0,  1, 2]
            ],
        };

        // 5x5 预定义卷积核
        const kernels5 = {
            edge_h: [
                [-1, -1, -1, -1, -1],
                [-1, -1, -1, -1, -1],
                [ 0,  0,  0,  0,  0],
                [ 1,  1,  1,  1,  1],
                [ 1,  1,  1,  1,  1]
            ],
            edge_v: [
                [-1, -1, 0, 1, 1],
                [-1, -1, 0, 1, 1],
                [-1, -1, 0, 1, 1],
                [-1, -1, 0, 1, 1],
                [-1, -1, 0, 1, 1]
            ],
            sobel_h: [
                [-1, -4, -6, -4, -1],
                [-2, -8,-12, -8, -2],
                [ 0,  0,  0,  0,  0],
                [ 2,  8, 12,  8,  2],
                [ 1,  4,  6,  4,  1]
            ],
            sobel_v: [
                [-1, -2, 0, 2, 1],
                [-4, -8, 0, 8, 4],
                [-6,-12, 0,12, 6],
                [-4, -8, 0, 8, 4],
                [-1, -2, 0, 2, 1]
            ],
            sharpen: [
                [ 0,  0, -1,  0,  0],
                [ 0, -1, -1, -1,  0],
                [-1, -1, 13, -1, -1],
                [ 0, -1, -1, -1,  0],
                [ 0,  0, -1,  0,  0]
            ],
            blur: (() => {
                const v = 1 / 25;
                return Array.from({ length: 5 }, () => new Array(5).fill(v));
            })(),
            emboss: [
                [-2, -2, -1, 0, 0],
                [-2, -1,  0, 1, 0],
                [-1,  0,  1, 0, 1],
                [ 0,  1,  0, 1, 2],
                [ 0,  0,  1, 2, 2]
            ],
        };

        // 兼容简写 'edge' -> 'edge_h'
        let resolvedType = type;
        if (type === 'edge') resolvedType = 'edge_h';
        if (type === 'sobel') resolvedType = 'sobel_h';

        if (size === 5) {
            return kernels5[resolvedType] || kernels5.edge_h;
        }
        // 默认返回 3x3
        return kernels3[resolvedType] || kernels3.edge_h;
    }

    /**
     * computeOutputSize — 计算卷积/池化输出尺寸
     * @param {number} inputSize  输入尺寸
     * @param {number} kernelSize 卷积核尺寸
     * @param {number} stride     步长
     * @param {number} padding    填充
     * @returns {number} 输出尺寸
     */
    function computeOutputSize(inputSize, kernelSize, stride, padding) {
        return Math.floor((inputSize + 2 * padding - kernelSize) / stride) + 1;
    }

    /* === 可视化辅助 === */

    /**
     * valueToColor — 数值转热力图颜色
     * @param {number} value  数值
     * @param {number} min    最小值
     * @param {number} max    最大值
     * @returns {string} CSS 颜色字符串
     */
    function valueToColor(value, min = 0, max = 1) {
        const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
        // 蓝 -> 青 -> 绿 -> 黄 -> 红 五段渐变
        let r, g, b;
        if (t < 0.25) {
            const s = t / 0.25;
            r = 0; g = Math.round(255 * s); b = 255;
        } else if (t < 0.5) {
            const s = (t - 0.25) / 0.25;
            r = 0; g = 255; b = Math.round(255 * (1 - s));
        } else if (t < 0.75) {
            const s = (t - 0.5) / 0.25;
            r = Math.round(255 * s); g = 255; b = 0;
        } else {
            const s = (t - 0.75) / 0.25;
            r = 255; g = Math.round(255 * (1 - s)); b = 0;
        }
        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * kernelToColors — 将卷积核值映射为颜色数组
     * @param {number[][]} kernel  卷积核二维数组
     * @returns {string[][]} CSS 颜色字符串二维数组
     */
    function kernelToColors(kernel) {
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < kernel.length; i++) {
            for (let j = 0; j < kernel[0].length; j++) {
                if (kernel[i][j] < min) min = kernel[i][j];
                if (kernel[i][j] > max) max = kernel[i][j];
            }
        }
        // 防止 min === max 时除以零
        if (min === max) { min -= 1; max += 1; }
        return kernel.map(row => row.map(v => valueToColor(v, min, max)));
    }

    /** 各类CNN层的颜色配置 */
    const LAYER_COLORS = {
        conv:    '#4fc3f7',   // 卷积层 — 亮蓝
        pool:    '#ffab40',   // 池化层 — 橙色
        fc:      '#ab47bc',   // 全连接层 — 紫色
        relu:    '#16c79a',   // ReLU 激活 — 青绿
        softmax: '#ff5252',   // Softmax — 红色
    };

    /* === 返回所有工具函数 === */
    return {
        // 随机数
        seededRandom,
        // 数学基础
        sigmoid, relu, leakyRelu, tanh, softmax,
        // 矩阵/张量运算
        zerosMatrix, randomMatrix, randomVector,
        matAdd, matScale, matMul, dot,
        im2col,
        // 卷积操作
        conv2d, applyPadding,
        maxPool2d, avgPool2d, globalAvgPool,
        // 二维激活函数
        applyRelu2d, applySigmoid2d, applyTanh2d,
        // 特征图生成
        generateSampleImage, generateRandomKernel, computeOutputSize,
        // 可视化辅助
        valueToColor, kernelToColors, LAYER_COLORS,
    };
})();
