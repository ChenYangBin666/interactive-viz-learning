/**
 * nav.js — MLP 多层感知机 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '神经元', path: '01-neuron/', icon: '🔵' },
        { id: '02', name: '前向传播', path: '02-forward-propagation/', icon: '➡' },
        { id: '03', name: '激活函数', path: '03-activation-functions/', icon: '📈' },
        { id: '04', name: '反向传播', path: '04-backpropagation/', icon: '⏪' },
        { id: '05', name: '梯度下降', path: '05-gradient-descent/', icon: '📉' },
        { id: '06', name: '正则化', path: '06-regularization/', icon: '🛡' },
        { id: '07', name: '权重初始化', path: '07-initialization/', icon: '🎲' },
        { id: '08', name: '万能近似', path: '08-universal-approximation/', icon: '🎯' },
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
                        <circle cx="4" cy="8" r="2"/>
                        <circle cx="4" cy="16" r="2"/>
                        <circle cx="12" cy="5" r="2"/>
                        <circle cx="12" cy="12" r="2"/>
                        <circle cx="12" cy="19" r="2"/>
                        <circle cx="20" cy="10" r="2"/>
                        <circle cx="20" cy="16" r="2"/>
                        <line x1="6" y1="8" x2="10" y2="5.5" opacity="0.5"/>
                        <line x1="6" y1="8" x2="10" y2="12" opacity="0.5"/>
                        <line x1="6" y1="8" x2="10" y2="18.5" opacity="0.5"/>
                        <line x1="6" y1="16" x2="10" y2="5.5" opacity="0.5"/>
                        <line x1="6" y1="16" x2="10" y2="12" opacity="0.5"/>
                        <line x1="6" y1="16" x2="10" y2="18.5" opacity="0.5"/>
                        <line x1="14" y1="5.5" x2="18" y2="10" opacity="0.5"/>
                        <line x1="14" y1="5.5" x2="18" y2="16" opacity="0.5"/>
                        <line x1="14" y1="12" x2="18" y2="10" opacity="0.5"/>
                        <line x1="14" y1="12" x2="18" y2="16" opacity="0.5"/>
                        <line x1="14" y1="19" x2="18" y2="10" opacity="0.5"/>
                        <line x1="14" y1="19" x2="18" y2="16" opacity="0.5"/>
                    </svg>
                    MLP 多层感知机
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
