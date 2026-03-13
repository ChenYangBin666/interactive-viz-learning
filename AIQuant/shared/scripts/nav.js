/**
 * nav.js — AI 量化 导航栏注入
 */

const Nav = (() => {
    const modules = [
        { id: '01', name: '特征工程', path: '01-feature-engineering/', icon: '⚙' },
        { id: '02', name: 'ML 模型', path: '02-ml-models/', icon: '🤖' },
        { id: '03', name: '深度学习', path: '03-deep-learning/', icon: '🧠' },
        { id: '04', name: '强化学习', path: '04-reinforcement-learning/', icon: '🎮' },
        { id: '05', name: 'NLP 情感', path: '05-nlp-sentiment/', icon: '💬' },
        { id: '06', name: '另类数据', path: '06-alternative-data/', icon: '📡' },
        { id: '07', name: 'AutoML', path: '07-automl-pipeline/', icon: '🔄' },
        { id: '08', name: 'AI 风控', path: '08-risk-ai/', icon: '🛡' },
        { id: '09', name: '游乐场', path: '09-playground/', icon: '🧪' },
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
                        <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><path d="M3 20l4-4 3 2 4-8 4 5 3-3"/>
                    </svg>
                    AI 量化
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
