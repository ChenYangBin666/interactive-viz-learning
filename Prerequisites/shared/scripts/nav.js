/**
 * nav.js — 前置知识 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '向量基础', path: '01-vectors/', icon: '→' },
        { id: '02', name: '矩阵基础', path: '02-matrices/', icon: '▦' },
        { id: '03', name: '线性变换', path: '03-linear-transforms/', icon: '◇' },
        { id: '04', name: '特征值分解', path: '04-eigenvalue/', icon: '◎' },
        { id: '05', name: '微积分与梯度', path: '05-calculus-gradient/', icon: '∂' },
        { id: '06', name: '概率与分布', path: '06-probability/', icon: '∿' },
        { id: '07', name: '优化方法', path: '07-optimization/', icon: '⟳' },
        { id: '08', name: '神经网络基础', path: '08-neural-network-basics/', icon: '◈' },
        { id: '09', name: '反向传播', path: '09-backpropagation/', icon: '⊗' },
    ];

    function getCurrentModule() {
        const path = window.location.pathname;
        for (const m of modules) {
            if (path.includes(m.path.replace('/', ''))) return m.id;
        }
        return null;
    }

    function getBasePath() {
        const path = window.location.pathname;
        for (const m of modules) {
            if (path.includes(m.path.replace('/', ''))) return '../';
        }
        return './';
    }

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
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                    </svg>
                    前置知识
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

document.addEventListener('DOMContentLoaded', () => {
    Nav.inject();
});
