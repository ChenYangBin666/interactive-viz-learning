/**
 * nav.js — 数字逻辑基础 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '逻辑门', path: '01-logic-gates/', icon: '🔲' },
        { id: '02', name: '布尔代数', path: '02-boolean-algebra/', icon: '📐' },
        { id: '03', name: '组合逻辑', path: '03-combinational-logic/', icon: '🔀' },
        { id: '04', name: '算术电路', path: '04-arithmetic-circuits/', icon: '➕' },
        { id: '05', name: '时序逻辑', path: '05-sequential-logic/', icon: '⏱' },
        { id: '06', name: '寄存器/计数器', path: '06-registers-counters/', icon: '📊' },
        { id: '07', name: '有限状态机', path: '07-fsm/', icon: '🔄' },
        { id: '08', name: '存储器基础', path: '08-memory-basics/', icon: '💾' },
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
                        <path d="M3 8h4l2-3h6l2 3h4"/>
                        <rect x="7" y="10" width="10" height="8" rx="1"/>
                        <circle cx="12" cy="14" r="2"/>
                        <path d="M3 16h4M17 16h4"/>
                    </svg>
                    数字逻辑基础
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
