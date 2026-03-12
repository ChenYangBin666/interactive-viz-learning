/**
 * graph-renderer.js — Cytoscape 图渲染器封装
 * 提供统一的图渲染、高亮、动画接口
 */

class GraphRenderer {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container
     * @param {Array} options.elements - Cytoscape elements
     * @param {string} [options.layout='cose'] - 布局算法
     * @param {Object} [options.style] - 额外样式覆盖
     * @param {Function} [options.onNodeClick]
     * @param {Function} [options.onNodeHover]
     * @param {Function} [options.onEdgeClick]
     * @param {boolean} [options.directed=false]
     */
    constructor(options) {
        this.container = options.container;
        this.elements = options.elements || [];
        this.layoutName = options.layout || 'cose';
        this.extraStyle = options.style || {};
        this.onNodeClick = options.onNodeClick || null;
        this.onNodeHover = options.onNodeHover || null;
        this.onEdgeClick = options.onEdgeClick || null;
        this.directed = options.directed || false;
        this.cy = null;

        this._groupColors = [
            '#16c79a', '#4fc3f7', '#b388ff', '#ffab40',
            '#ff80ab', '#ffd740', '#ff5252', '#69f0ae'
        ];

        this.init();
    }

    init() {
        if (typeof cytoscape === 'undefined') {
            console.error('Cytoscape.js not loaded');
            return;
        }

        this.cy = cytoscape({
            container: this.container,
            elements: this.elements,
            style: this._getDefaultStyle(),
            layout: this._getLayout(),
            minZoom: 0.3,
            maxZoom: 3,
            wheelSensitivity: 0.3,
        });

        this._bindEvents();

        // Fix: Cytoscape 在 CSS Grid/Flex 容器内初始化时可能无法正确获取宽度，
        // 因为 grid 的 1fr 列宽在首帧渲染前尚未计算完成。
        // 延迟执行 resize + fit 确保容器尺寸已确定。
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (this.cy) {
                    this.cy.resize();
                    this.cy.fit(undefined, 30);
                }
            });
        });
    }

    _getDefaultStyle() {
        return [
            {
                selector: 'node',
                style: {
                    'background-color': (ele) => {
                        const g = ele.data('group');
                        return g !== undefined ? this._groupColors[g % this._groupColors.length] : '#16c79a';
                    },
                    'label': 'data(label)',
                    'color': '#e8e8e8',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'font-size': '12px',
                    'font-family': 'JetBrains Mono, monospace',
                    'width': 36,
                    'height': 36,
                    'border-width': 2,
                    'border-color': 'rgba(22, 199, 154, 0.3)',
                    'text-outline-width': 2,
                    'text-outline-color': '#1a1a2e',
                    'transition-property': 'background-color, border-color, width, height, opacity',
                    'transition-duration': '300ms',
                    ...this.extraStyle.node,
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': 'rgba(22, 199, 154, 0.3)',
                    'curve-style': 'bezier',
                    'target-arrow-shape': this.directed ? 'triangle' : 'none',
                    'target-arrow-color': 'rgba(22, 199, 154, 0.3)',
                    'transition-property': 'line-color, width, opacity',
                    'transition-duration': '300ms',
                    ...this.extraStyle.edge,
                }
            },
            {
                selector: 'node.highlighted',
                style: {
                    'border-color': '#16c79a',
                    'border-width': 4,
                    'background-color': '#16c79a',
                    'z-index': 10,
                }
            },
            {
                selector: 'node.dimmed',
                style: {
                    'opacity': 0.2,
                }
            },
            {
                selector: 'edge.highlighted',
                style: {
                    'line-color': '#16c79a',
                    'width': 3,
                    'z-index': 10,
                }
            },
            {
                selector: 'edge.dimmed',
                style: {
                    'opacity': 0.1,
                }
            },
            {
                selector: 'node.source-node',
                style: {
                    'border-color': '#ff5252',
                    'border-width': 4,
                    'background-color': '#ff5252',
                }
            },
            {
                selector: 'node.target-node',
                style: {
                    'border-color': '#4fc3f7',
                    'border-width': 4,
                    'background-color': '#4fc3f7',
                }
            },
            {
                selector: 'edge.message-edge',
                style: {
                    'line-color': '#ffab40',
                    'width': 3,
                    'line-style': 'dashed',
                    'line-dash-pattern': [6, 3],
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'border-color': '#ffd740',
                    'border-width': 4,
                }
            },
        ];
    }

    _getLayout() {
        const layouts = {
            cose: {
                name: 'cose',
                animate: false,
                nodeDimensionsIncludeLabels: true,
                idealEdgeLength: 80,
                nodeRepulsion: 4000,
                gravity: 0.5,
            },
            circle: {
                name: 'circle',
                animate: false,
            },
            grid: {
                name: 'grid',
                animate: false,
            },
            concentric: {
                name: 'concentric',
                animate: false,
            },
            breadthfirst: {
                name: 'breadthfirst',
                animate: false,
                directed: this.directed,
            },
            preset: {
                name: 'preset',
            },
            random: {
                name: 'random',
                animate: false,
            },
        };
        return layouts[this.layoutName] || layouts.cose;
    }

    _bindEvents() {
        // 节点悬停：高亮邻居
        this.cy.on('mouseover', 'node', (e) => {
            const node = e.target;
            this.highlightNeighbors(node.id());
            if (this.onNodeHover) this.onNodeHover(node.id(), node.data());
        });

        this.cy.on('mouseout', 'node', () => {
            this.clearHighlights();
        });

        this.cy.on('tap', 'node', (e) => {
            const node = e.target;
            if (this.onNodeClick) this.onNodeClick(node.id(), node.data());
        });

        this.cy.on('tap', 'edge', (e) => {
            const edge = e.target;
            if (this.onEdgeClick) this.onEdgeClick(edge.data('source'), edge.data('target'));
        });
    }

    /** 高亮节点的邻居 */
    highlightNeighbors(nodeId) {
        const node = this.cy.getElementById(nodeId);
        const neighborhood = node.closedNeighborhood();
        this.cy.elements().addClass('dimmed');
        neighborhood.removeClass('dimmed');
        node.addClass('highlighted');
        neighborhood.edges().addClass('highlighted');
        neighborhood.nodes().not(node).addClass('highlighted');
    }

    /** 高亮 k-hop 邻域 */
    highlightKHop(nodeId, k) {
        this.clearHighlights();
        const node = this.cy.getElementById(nodeId);
        let currentSet = node.closedNeighborhood();

        for (let i = 1; i < k; i++) {
            currentSet = currentSet.closedNeighborhood();
        }

        this.cy.elements().addClass('dimmed');
        currentSet.removeClass('dimmed').addClass('highlighted');
        node.removeClass('highlighted').addClass('source-node');

        return currentSet;
    }

    /** 高亮指定节点集合 */
    highlightNodes(nodeIds, className = 'highlighted') {
        this.clearHighlights();
        this.cy.elements().addClass('dimmed');
        for (const id of nodeIds) {
            const node = this.cy.getElementById(String(id));
            node.removeClass('dimmed').addClass(className);
            node.connectedEdges().forEach(edge => {
                const src = edge.data('source');
                const tgt = edge.data('target');
                if (nodeIds.includes(Number(src)) && nodeIds.includes(Number(tgt))) {
                    edge.removeClass('dimmed').addClass('highlighted');
                }
            });
        }
    }

    /** 高亮一条边 */
    highlightEdge(sourceId, targetId) {
        const edge = this.cy.edges(`[source="${sourceId}"][target="${targetId}"], [source="${targetId}"][target="${sourceId}"]`);
        edge.addClass('highlighted');
        return edge;
    }

    /** 清除所有高亮 */
    clearHighlights() {
        this.cy.elements().removeClass('highlighted dimmed source-node target-node message-edge');
    }

    /** 更新节点颜色 */
    setNodeColor(nodeId, color) {
        this.cy.getElementById(String(nodeId)).style('background-color', color);
    }

    /** 更新节点大小 */
    setNodeSize(nodeId, size) {
        const node = this.cy.getElementById(String(nodeId));
        node.style({ 'width': size, 'height': size });
    }

    /** 批量更新节点大小（如按度数） */
    scaleNodesByDegree(baseSize = 30, scaleFactor = 5) {
        this.cy.nodes().forEach(node => {
            const deg = node.degree(false);
            node.style({ 'width': baseSize + deg * scaleFactor, 'height': baseSize + deg * scaleFactor });
        });
    }

    /** 添加节点 */
    addNode(data, position) {
        const ele = { data, ...(position && { position }) };
        this.cy.add(ele);
    }

    /** 添加边 */
    addEdge(sourceId, targetId) {
        this.cy.add({
            data: {
                id: `e${sourceId}-${targetId}`,
                source: String(sourceId),
                target: String(targetId),
            }
        });
    }

    /** 移除节点 */
    removeNode(nodeId) {
        this.cy.getElementById(String(nodeId)).remove();
    }

    /** 重新布局 */
    relayout(layoutName) {
        if (layoutName) this.layoutName = layoutName;
        this.cy.layout(this._getLayout()).run();
    }

    /** 适应视口 */
    fit(padding = 40) {
        this.cy.fit(undefined, padding);
    }

    /** 获取所有节点 id */
    getNodeIds() {
        return this.cy.nodes().map(n => n.id());
    }

    /** 设置边标签 */
    setEdgeLabel(sourceId, targetId, label) {
        const edge = this.cy.edges(`[source="${sourceId}"][target="${targetId}"], [source="${targetId}"][target="${sourceId}"]`);
        edge.style('label', label);
        edge.style('font-size', '10px');
        edge.style('color', '#ffab40');
        edge.style('text-outline-width', 2);
        edge.style('text-outline-color', '#1a1a2e');
    }

    /** 消息传递动画：从 source 到 target 的脉冲 */
    animateMessage(sourceId, targetId, color = '#ffab40') {
        const edge = this.cy.edges(
            `[source="${sourceId}"][target="${targetId}"], [source="${targetId}"][target="${sourceId}"]`
        );
        edge.addClass('message-edge');
        edge.style('line-color', color);
        setTimeout(() => {
            edge.removeClass('message-edge');
            edge.style('line-color', 'rgba(22, 199, 154, 0.3)');
        }, 800);
    }

    /** 销毁 */
    destroy() {
        if (this.cy) this.cy.destroy();
    }
}
