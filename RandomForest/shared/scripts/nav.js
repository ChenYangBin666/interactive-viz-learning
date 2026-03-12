/**
 * nav.js — 随机森林 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '决策树基础', path: '01-decision-tree/', icon: '🌳' },
        { id: '02', name: '分裂准则', path: '02-splitting/', icon: '✂' },
        { id: '03', name: '树的构建', path: '03-tree-building/', icon: '🔨' },
        { id: '04', name: 'Bagging', path: '04-bagging/', icon: '🎒' },
        { id: '05', name: '随机子空间', path: '05-random-subspace/', icon: '🎲' },
        { id: '06', name: '随机森林', path: '06-random-forest/', icon: '🌲' },
        { id: '07', name: '投票机制', path: '07-voting/', icon: '🗳' },
        { id: '08', name: '特征重要性', path: '08-feature-importance/', icon: '📊' },
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
                        <path d="M12 3c-3 0-5 3-5 6 0 2 1 4 3 5h4c2-1 3-3 3-5 0-3-2-6-5-6z"/>
                        <path d="M10 14v5a2 2 0 002 2v0a2 2 0 002-2v-5"/>
                        <path d="M8 9c-2 0-3 2-3 4s1 3 2 4"/>
                        <path d="M16 9c2 0 3 2 3 4s-1 3-2 4"/>
                    </svg>
                    随机森林
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
