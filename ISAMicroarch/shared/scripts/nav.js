/**
 * nav.js — 指令集与微架构 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '指令基础', path: '01-instruction-basics/', icon: '📝' },
        { id: '02', name: 'RISC vs CISC', path: '02-risc-vs-cisc/', icon: '⚖' },
        { id: '03', name: 'RISC-V 深入', path: '03-riscv-deep-dive/', icon: '🔧' },
        { id: '04', name: '流水线', path: '04-pipeline/', icon: '🏭' },
        { id: '05', name: '冒险处理', path: '05-hazards/', icon: '⚠' },
        { id: '06', name: '分支预测', path: '06-branch-prediction/', icon: '🔮' },
        { id: '07', name: '超标量', path: '07-superscalar/', icon: '⚡' },
        { id: '08', name: '乱序执行', path: '08-out-of-order/', icon: '🔄' },
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
                        <rect x="6" y="6" width="12" height="12" rx="1"/>
                        <path d="M6 9h-3M6 12h-3M6 15h-3M18 9h3M18 12h3M18 15h3"/>
                        <path d="M9 6v-3M12 6v-3M15 6v-3M9 18v3M12 18v3M15 18v3"/>
                    </svg>
                    指令集与微架构
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
