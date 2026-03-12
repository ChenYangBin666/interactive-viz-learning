/**
 * nav.js — XGBoost 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '从决策树到提升', path: '01-boosting-intuition/', icon: '📈' },
        { id: '02', name: '梯度提升原理', path: '02-gradient-boosting/', icon: '🔄' },
        { id: '03', name: '目标函数', path: '03-objective-function/', icon: '🎯' },
        { id: '04', name: '树的分裂', path: '04-tree-splitting/', icon: '✂' },
        { id: '05', name: '正则化', path: '05-regularization/', icon: '🛡' },
        { id: '06', name: '工程优化', path: '06-engineering/', icon: '⚡' },
        { id: '07', name: '实战调参', path: '07-tuning/', icon: '🎛' },
        { id: '08', name: '对比分析', path: '08-comparison/', icon: '⚖' },
        { id: '09', name: '游乐场', path: '09-playground/', icon: '⚙' },
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
                        <path d="M3 20l4-8 4 4 4-10 4 6"/>
                        <path d="M3 20h18"/>
                        <circle cx="7" cy="12" r="1.5" fill="currentColor"/>
                        <circle cx="11" cy="8" r="1.5" fill="currentColor"/>
                        <circle cx="15" cy="6" r="1.5" fill="currentColor"/>
                        <circle cx="19" cy="10" r="1.5" fill="currentColor"/>
                    </svg>
                    XGBoost
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
