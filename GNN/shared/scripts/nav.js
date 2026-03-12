/**
 * nav.js — 导航栏注入
 * 自动向页面注入顶部导航和侧边导航
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '图数据基础', path: '01-graph-basics/', icon: '◉' },
        { id: '02', name: '为什么需要GNN', path: '02-why-graph/', icon: '?' },
        { id: '03', name: '消息传递', path: '03-message-passing/', icon: '→' },
        { id: '04', name: 'GCN', path: '04-gcn/', icon: '◈' },
        { id: '05', name: 'GAT', path: '05-gat/', icon: '◎' },
        { id: '06', name: 'GraphSAGE', path: '06-graphsage/', icon: '⊛' },
        { id: '07', name: '训练过程', path: '07-training/', icon: '⟳' },
        { id: '08', name: '下游任务', path: '08-tasks/', icon: '▦' },
        { id: '09', name: '游乐场', path: '09-playground/', icon: '⚙' },
    ];

    /** 判断当前页面是哪个模块 */
    function getCurrentModule() {
        const path = window.location.pathname;
        for (const m of modules) {
            if (path.includes(m.path.replace('/', ''))) return m.id;
        }
        return null;
    }

    /** 计算相对路径 */
    function getBasePath() {
        const path = window.location.pathname;
        // 如果在子目录里，返回 ../
        for (const m of modules) {
            if (path.includes(m.path.replace('/', ''))) return '../';
        }
        return './';
    }

    /** 注入导航栏 */
    function inject() {
        const current = getCurrentModule();
        const base = getBasePath();
        const rootPath = base === './' ? '../index.html' : '../../index.html';

        const nav = document.createElement('nav');
        nav.className = 'top-nav';
        nav.innerHTML = `
            <div class="nav-left">
                <a href="${rootPath}" class="nav-home" title="算法总览">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                        <path d="M3 12l9-8 9 8"/>
                        <path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/>
                    </svg>
                </a>
                <span class="nav-sep">›</span>
                <a href="${base}index.html" class="logo">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"/>
                        <circle cx="5" cy="5" r="2"/>
                        <circle cx="19" cy="5" r="2"/>
                        <circle cx="5" cy="19" r="2"/>
                        <circle cx="19" cy="19" r="2"/>
                        <line x1="7" y1="6.5" x2="10" y2="10"/>
                        <line x1="17" y1="6.5" x2="14" y2="10"/>
                        <line x1="7" y1="17.5" x2="10" y2="14"/>
                        <line x1="17" y1="17.5" x2="14" y2="14"/>
                    </svg>
                    GNN 学习
                </a>
            </div>
            <div class="nav-links">
                ${modules.map(m => `
                    <a href="${base}${m.path}index.html"
                       class="nav-link ${m.id === current ? 'current' : ''}"
                       title="${m.name}">
                        ${m.icon} ${m.id}
                    </a>
                `).join('')}
            </div>
        `;

        document.body.prepend(nav);
    }

    return { modules, inject, getBasePath, getCurrentModule };
})();

// 自动注入导航
document.addEventListener('DOMContentLoaded', () => {
    Nav.inject();
});
