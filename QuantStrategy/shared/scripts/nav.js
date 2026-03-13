/**
 * nav.js — 量化交易策略 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '动量策略', path: '01-momentum/', icon: '📈' },
        { id: '02', name: '均值回归', path: '02-mean-reversion/', icon: '🔄' },
        { id: '03', name: '配对交易', path: '03-pairs-trading/', icon: '🔗' },
        { id: '04', name: '统计套利', path: '04-statistical-arbitrage/', icon: '📊' },
        { id: '05', name: '市场微观', path: '05-market-microstructure/', icon: '🔬' },
        { id: '06', name: '回测框架', path: '06-backtesting/', icon: '⚙' },
        { id: '07', name: '风险管理', path: '07-risk-management/', icon: '🛡' },
        { id: '08', name: '交易执行', path: '08-execution/', icon: '⚡' },
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
                        <path d="M3 3v18h18"/><path d="M7 14l3-4 3 2 4-6 2 3"/>
                    </svg>
                    量化交易策略
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
