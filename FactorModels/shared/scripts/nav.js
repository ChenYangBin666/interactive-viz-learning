/**
 * nav.js — 因子模型 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: 'CAPM', path: '01-capm/', icon: '📈' },
        { id: '02', name: 'APT', path: '02-apt/', icon: '🎯' },
        { id: '03', name: '三因子', path: '03-fama-french-3/', icon: '📊' },
        { id: '04', name: '五因子', path: '04-fama-french-5/', icon: '🔬' },
        { id: '05', name: 'Barra', path: '05-barra/', icon: '🏗' },
        { id: '06', name: '因子构建', path: '06-factor-construction/', icon: '⚙' },
        { id: '07', name: '因子评价', path: '07-factor-evaluation/', icon: '📋' },
        { id: '08', name: '收益归因', path: '08-portfolio-attribution/', icon: '🎯' },
        { id: '09', name: '游乐场', path: '09-playground/', icon: '🧪' },
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
                        <rect x="3" y="14" width="4" height="6" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/>
                    </svg>
                    因子模型
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
