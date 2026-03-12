/**
 * nav.js — Transformer 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '序列与嵌入', path: '01-sequence-embedding/', icon: '▤' },
        { id: '02', name: '注意力直觉', path: '02-attention-intuition/', icon: '◉' },
        { id: '03', name: '缩放点积注意力', path: '03-scaled-dot-product/', icon: '⊗' },
        { id: '04', name: '多头注意力', path: '04-multi-head/', icon: '◈' },
        { id: '05', name: '位置编码', path: '05-positional-encoding/', icon: '∿' },
        { id: '06', name: '编码器', path: '06-encoder/', icon: '⊞' },
        { id: '07', name: '解码器', path: '07-decoder/', icon: '⊟' },
        { id: '08', name: '训练与优化', path: '08-training/', icon: '⟳' },
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
                        <rect x="3" y="3" width="7" height="7" rx="1"/>
                        <rect x="14" y="3" width="7" height="7" rx="1"/>
                        <rect x="3" y="14" width="7" height="7" rx="1"/>
                        <rect x="14" y="14" width="7" height="7" rx="1"/>
                        <path d="M10 6.5h4M10 17.5h4M6.5 10v4M17.5 10v4" stroke-dasharray="2 1"/>
                    </svg>
                    Transformer 学习
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
