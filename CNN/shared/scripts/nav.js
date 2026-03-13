/**
 * nav.js — CNN 卷积神经网络 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '卷积基础', path: '01-convolution-basics/', icon: '🔲' },
        { id: '02', name: '池化与激活', path: '02-pooling-activation/', icon: '📐' },
        { id: '03', name: '感受野', path: '03-receptive-field/', icon: '👁' },
        { id: '04', name: 'CNN架构', path: '04-cnn-architecture/', icon: '🏗' },
        { id: '05', name: '经典网络', path: '05-classic-nets/', icon: '📜' },
        { id: '06', name: '现代网络', path: '06-modern-nets/', icon: '🚀' },
        { id: '07', name: '特征可视化', path: '07-feature-visualization/', icon: '🎨' },
        { id: '08', name: '迁移学习', path: '08-transfer-learning/', icon: '🔄' },
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
                        <rect x="2" y="4" width="7" height="7" rx="1"/>
                        <rect x="8.5" y="7.5" width="7" height="7" rx="1" opacity="0.7"/>
                        <rect x="15" y="11" width="7" height="7" rx="1" opacity="0.4"/>
                        <path d="M9 7.5l1 1" stroke-dasharray="1 1"/>
                        <path d="M15.5 11l1 1" stroke-dasharray="1 1"/>
                    </svg>
                    CNN 卷积神经网络
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
