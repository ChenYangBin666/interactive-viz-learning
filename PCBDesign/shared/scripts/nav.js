/**
 * nav.js — PCB 设计 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '原理图基础', path: '01-schematic-basics/', icon: '📋' },
        { id: '02', name: '元器件库', path: '02-component-library/', icon: '🔧' },
        { id: '03', name: '布局摆放', path: '03-layout-placement/', icon: '📐' },
        { id: '04', name: '布线', path: '04-routing/', icon: '🔌' },
        { id: '05', name: '阻抗控制', path: '05-impedance-control/', icon: '📊' },
        { id: '06', name: '电源与地', path: '06-power-ground/', icon: '⚡' },
        { id: '07', name: 'EMC 设计', path: '07-emc-design/', icon: '🛡' },
        { id: '08', name: '制造工艺', path: '08-manufacturing/', icon: '🏭' },
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
                        <rect x="2" y="4" width="20" height="16" rx="1"/>
                        <circle cx="6" cy="8" r="1.5"/><circle cx="18" cy="8" r="1.5"/>
                        <circle cx="6" cy="16" r="1.5"/><circle cx="18" cy="16" r="1.5"/>
                        <path d="M7.5 8h3l2 4h3.5"/>
                    </svg>
                    PCB 设计
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
