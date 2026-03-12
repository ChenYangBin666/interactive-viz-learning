/**
 * matrix-renderer.js — 矩阵热力图渲染器
 * 用 D3.js 渲染矩阵为可交互的热力图
 */

class MatrixRenderer {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container
     * @param {number[][]} options.data - 矩阵数据
     * @param {string[]} [options.rowLabels] - 行标签
     * @param {string[]} [options.colLabels] - 列标签
     * @param {number} [options.cellSize=40]
     * @param {Function} [options.colorScale] - 自定义颜色映射
     * @param {boolean} [options.showValues=true]
     * @param {Function} [options.onCellHover] - (row, col) 悬停回调
     * @param {Function} [options.onCellClick] - (row, col) 点击回调
     * @param {string} [options.title]
     */
    constructor(options) {
        this.container = options.container;
        this.data = options.data || [];
        this.rowLabels = options.rowLabels;
        this.colLabels = options.colLabels;
        this.cellSize = options.cellSize || 40;
        this.showValues = options.showValues !== false;
        this.onCellHover = options.onCellHover || null;
        this.onCellClick = options.onCellClick || null;
        this.title = options.title || '';
        this.highlightedCells = new Set();

        // 颜色scale
        this.colorScale = options.colorScale || this._defaultColorScale.bind(this);

        this.svg = null;
        this.cells = null;

        if (this.data.length > 0) this.render();
    }

    _defaultColorScale(value) {
        const abs = Math.abs(value);
        if (value === 0) return 'rgba(42, 42, 74, 0.3)';
        if (value > 0) {
            const t = Math.min(1, abs);
            return `rgba(22, 199, 154, ${0.15 + t * 0.75})`;
        } else {
            const t = Math.min(1, abs);
            return `rgba(255, 82, 82, ${0.15 + t * 0.75})`;
        }
    }

    render() {
        this.container.innerHTML = '';
        const rows = this.data.length;
        if (rows === 0) return;
        const cols = this.data[0].length;

        const labelW = 35;
        const labelH = 35;
        const width = labelW + cols * this.cellSize;
        const height = labelH + rows * this.cellSize;

        // Title
        if (this.title) {
            const titleEl = document.createElement('div');
            titleEl.style.cssText = 'font-size:0.85rem;color:#a8a8b8;margin-bottom:0.4rem;font-weight:600;';
            titleEl.textContent = this.title;
            this.container.appendChild(titleEl);
        }

        const svgNS = 'http://www.w3.org/2000/svg';
        this.svg = document.createElementNS(svgNS, 'svg');
        this.svg.setAttribute('width', width);
        this.svg.setAttribute('height', height);
        this.svg.style.display = 'block';
        this.container.appendChild(this.svg);

        // Column labels
        const colLabels = this.colLabels || Array.from({ length: cols }, (_, i) => String(i));
        for (let j = 0; j < cols; j++) {
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', labelW + j * this.cellSize + this.cellSize / 2);
            text.setAttribute('y', labelH - 6);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', '#16c79a');
            text.setAttribute('font-size', '11');
            text.setAttribute('font-family', 'JetBrains Mono, monospace');
            text.textContent = colLabels[j];
            this.svg.appendChild(text);
        }

        // Row labels
        const rowLabels = this.rowLabels || Array.from({ length: rows }, (_, i) => String(i));
        for (let i = 0; i < rows; i++) {
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', labelW - 6);
            text.setAttribute('y', labelH + i * this.cellSize + this.cellSize / 2 + 4);
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('fill', '#16c79a');
            text.setAttribute('font-size', '11');
            text.setAttribute('font-family', 'JetBrains Mono, monospace');
            text.textContent = rowLabels[i];
            this.svg.appendChild(text);
        }

        // Cells
        this.cellElements = [];
        this.textElements = [];

        for (let i = 0; i < rows; i++) {
            this.cellElements[i] = [];
            this.textElements[i] = [];
            for (let j = 0; j < cols; j++) {
                const g = document.createElementNS(svgNS, 'g');
                g.style.cursor = 'pointer';

                const rect = document.createElementNS(svgNS, 'rect');
                rect.setAttribute('x', labelW + j * this.cellSize);
                rect.setAttribute('y', labelH + i * this.cellSize);
                rect.setAttribute('width', this.cellSize);
                rect.setAttribute('height', this.cellSize);
                rect.setAttribute('fill', this.colorScale(this.data[i][j]));
                rect.setAttribute('stroke', 'rgba(42,42,74,0.5)');
                rect.setAttribute('stroke-width', '1');
                rect.style.transition = 'fill 0.3s, stroke 0.3s';

                const text = document.createElementNS(svgNS, 'text');
                text.setAttribute('x', labelW + j * this.cellSize + this.cellSize / 2);
                text.setAttribute('y', labelH + i * this.cellSize + this.cellSize / 2 + 4);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', '#e8e8e8');
                text.setAttribute('font-size', this.cellSize < 35 ? '9' : '11');
                text.setAttribute('font-family', 'JetBrains Mono, monospace');
                text.style.pointerEvents = 'none';
                if (this.showValues) {
                    const val = this.data[i][j];
                    text.textContent = Number.isInteger(val) ? val : val.toFixed(2);
                }

                g.appendChild(rect);
                g.appendChild(text);
                this.svg.appendChild(g);

                this.cellElements[i][j] = rect;
                this.textElements[i][j] = text;

                // Events
                ((row, col) => {
                    g.addEventListener('mouseenter', () => {
                        this._highlightRowCol(row, col);
                        if (this.onCellHover) this.onCellHover(row, col);
                    });
                    g.addEventListener('mouseleave', () => {
                        this._clearHighlightRowCol();
                    });
                    g.addEventListener('click', () => {
                        if (this.onCellClick) this.onCellClick(row, col);
                    });
                })(i, j);
            }
        }
    }

    /** 更新数据并重渲染颜色 */
    updateData(newData, animate = true) {
        this.data = newData;
        const rows = newData.length;
        if (rows === 0) return;
        const cols = newData[0].length;

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (!this.cellElements[i] || !this.cellElements[i][j]) continue;
                const rect = this.cellElements[i][j];
                const text = this.textElements[i][j];
                const val = newData[i][j];
                rect.setAttribute('fill', this.colorScale(val));
                if (this.showValues) {
                    text.textContent = Number.isInteger(val) ? val : val.toFixed(2);
                }
            }
        }
    }

    /** 高亮单元格 */
    highlightCell(row, col, color = '#16c79a') {
        const key = `${row},${col}`;
        this.highlightedCells.add(key);
        if (this.cellElements[row]?.[col]) {
            this.cellElements[row][col].setAttribute('stroke', color);
            this.cellElements[row][col].setAttribute('stroke-width', '2.5');
        }
    }

    /** 清除高亮 */
    clearHighlights() {
        this.highlightedCells.clear();
        const rows = this.data.length;
        const cols = this.data[0]?.length || 0;
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (this.cellElements[i]?.[j]) {
                    this.cellElements[i][j].setAttribute('stroke', 'rgba(42,42,74,0.5)');
                    this.cellElements[i][j].setAttribute('stroke-width', '1');
                }
            }
        }
    }

    /** 高亮某行某列 */
    _highlightRowCol(row, col) {
        const rows = this.data.length;
        const cols = this.data[0]?.length || 0;
        for (let j = 0; j < cols; j++) {
            if (this.cellElements[row]?.[j]) {
                this.cellElements[row][j].setAttribute('stroke', 'rgba(22,199,154,0.5)');
                this.cellElements[row][j].setAttribute('stroke-width', '1.5');
            }
        }
        for (let i = 0; i < rows; i++) {
            if (this.cellElements[i]?.[col]) {
                this.cellElements[i][col].setAttribute('stroke', 'rgba(79,195,247,0.5)');
                this.cellElements[i][col].setAttribute('stroke-width', '1.5');
            }
        }
        // 交叉点最亮
        if (this.cellElements[row]?.[col]) {
            this.cellElements[row][col].setAttribute('stroke', '#16c79a');
            this.cellElements[row][col].setAttribute('stroke-width', '2.5');
        }
    }

    _clearHighlightRowCol() {
        const rows = this.data.length;
        const cols = this.data[0]?.length || 0;
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                const key = `${i},${j}`;
                if (this.highlightedCells.has(key)) continue;
                if (this.cellElements[i]?.[j]) {
                    this.cellElements[i][j].setAttribute('stroke', 'rgba(42,42,74,0.5)');
                    this.cellElements[i][j].setAttribute('stroke-width', '1');
                }
            }
        }
    }

    /** 高亮行（标记） */
    highlightRow(row, color = 'rgba(22,199,154,0.3)') {
        const cols = this.data[0]?.length || 0;
        for (let j = 0; j < cols; j++) {
            if (this.cellElements[row]?.[j]) {
                this.cellElements[row][j].setAttribute('stroke', color);
                this.cellElements[row][j].setAttribute('stroke-width', '2');
                this.highlightedCells.add(`${row},${j}`);
            }
        }
    }

    /** 动画展示矩阵乘法的某行×某列 */
    animateMultiply(row, col, duration = 600) {
        this.highlightRow(row, 'rgba(22,199,154,0.5)');
        // 外部自行处理列高亮和动画
    }
}
