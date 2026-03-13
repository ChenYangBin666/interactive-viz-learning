/**
 * nav.js — Diffusion 扩散模型 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '前向过程', path: '01-forward-process/', icon: '💨' },
        { id: '02', name: '反向去噪', path: '02-reverse-process/', icon: '🔄' },
        { id: '03', name: '噪声调度', path: '03-noise-schedule/', icon: '📈' },
        { id: '04', name: 'DDPM', path: '04-ddpm/', icon: '🎯' },
        { id: '05', name: 'Score Matching', path: '05-score-matching/', icon: '🧭' },
        { id: '06', name: '采样方法', path: '06-sampling/', icon: '🎲' },
        { id: '07', name: '条件生成', path: '07-conditional/', icon: '🎨' },
        { id: '08', name: 'U-Net 架构', path: '08-architecture/', icon: '🏗' },
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
                        <circle cx="12" cy="12" r="2"/>
                        <circle cx="12" cy="12" r="5" stroke-dasharray="3 2"/>
                        <circle cx="12" cy="12" r="9" stroke-dasharray="2 3"/>
                    </svg>
                    Diffusion 扩散模型
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
