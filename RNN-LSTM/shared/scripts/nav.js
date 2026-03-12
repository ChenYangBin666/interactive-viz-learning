/**
 * nav.js — RNN & LSTM 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '序列数据基础', path: '01-sequence-basics/', icon: '📊' },
        { id: '02', name: '原始 RNN', path: '02-vanilla-rnn/', icon: '🔄' },
        { id: '03', name: '时间反向传播', path: '03-bptt/', icon: '⏪' },
        { id: '04', name: '梯度问题', path: '04-gradient-problems/', icon: '📉' },
        { id: '05', name: 'LSTM', path: '05-lstm/', icon: '🧠' },
        { id: '06', name: 'GRU', path: '06-gru/', icon: '⚡' },
        { id: '07', name: '序列任务', path: '07-sequence-tasks/', icon: '🎯' },
        { id: '08', name: '进阶架构', path: '08-advanced/', icon: '🏗' },
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
                        <circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/>
                        <path d="M9 12h6" marker-end="url(#arr)"/>
                        <path d="M18 9c0-3-4-3-4 0" stroke-dasharray="2 1"/>
                        <path d="M6 9c0-3-4-3-4 0" stroke-dasharray="2 1"/>
                    </svg>
                    RNN & LSTM
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
