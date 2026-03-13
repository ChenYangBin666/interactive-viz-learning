/**
 * nav.js — 存储层级 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '存储层级概览', path: '01-memory-overview/', icon: '🏔' },
        { id: '02', name: 'Cache基础', path: '02-cache-basics/', icon: '📦' },
        { id: '03', name: 'Cache策略', path: '03-cache-policies/', icon: '🔄' },
        { id: '04', name: 'Cache性能', path: '04-cache-performance/', icon: '📊' },
        { id: '05', name: '虚拟内存', path: '05-virtual-memory/', icon: '🗺' },
        { id: '06', name: 'TLB', path: '06-tlb/', icon: '⚡' },
        { id: '07', name: '多级Cache', path: '07-multi-level-cache/', icon: '🏗' },
        { id: '08', name: 'Cache一致性', path: '08-cache-coherence/', icon: '🤝' },
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
                        <rect x="3" y="14" width="18" height="6" rx="1"/>
                        <rect x="5" y="8" width="14" height="6" rx="1"/>
                        <rect x="8" y="2" width="8" height="6" rx="1"/>
                    </svg>
                    存储层级
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
