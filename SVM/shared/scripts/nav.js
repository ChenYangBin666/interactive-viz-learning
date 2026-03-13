/**
 * nav.js — SVM 支持向量机 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '线性分类器', path: '01-linear-classifier/', icon: '📏' },
        { id: '02', name: '最大间隔', path: '02-max-margin/', icon: '↔' },
        { id: '03', name: '支持向量', path: '03-support-vectors/', icon: '📌' },
        { id: '04', name: '软间隔', path: '04-soft-margin/', icon: '🛡' },
        { id: '05', name: '对偶问题', path: '05-dual-problem/', icon: '🔄' },
        { id: '06', name: '核技巧', path: '06-kernel-trick/', icon: '🌀' },
        { id: '07', name: '常用核函数', path: '07-kernel-types/', icon: '📊' },
        { id: '08', name: '多分类与回归', path: '08-multiclass-regression/', icon: '🎯' },
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
                        <line x1="4" y1="20" x2="20" y2="4"/>
                        <line x1="2" y1="18" x2="18" y2="2" opacity="0.4" stroke-dasharray="2 2"/>
                        <line x1="6" y1="22" x2="22" y2="6" opacity="0.4" stroke-dasharray="2 2"/>
                        <circle cx="7" cy="17" r="1.5" fill="currentColor" stroke="none"/>
                        <circle cx="17" cy="7" r="1.5" fill="currentColor" stroke="none"/>
                    </svg>
                    SVM 支持向量机
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
