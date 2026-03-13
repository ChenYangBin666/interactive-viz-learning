/**
 * nav.js — LightGBM 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: 'GBDT 回顾', path: '01-gbdt-review/', icon: '🌳' },
        { id: '02', name: '直方图算法', path: '02-histogram/', icon: '📊' },
        { id: '03', name: 'GOSS', path: '03-goss/', icon: '⚡' },
        { id: '04', name: 'EFB', path: '04-efb/', icon: '📦' },
        { id: '05', name: 'Leaf-wise 生长', path: '05-leaf-wise/', icon: '🍃' },
        { id: '06', name: '类别特征', path: '06-categorical/', icon: '🏷' },
        { id: '07', name: '并行训练', path: '07-parallel-training/', icon: '🔀' },
        { id: '08', name: '调参指南', path: '08-tuning/', icon: '🎛' },
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
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                    </svg>
                    LightGBM
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
