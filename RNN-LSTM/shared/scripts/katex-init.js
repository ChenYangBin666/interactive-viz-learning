/**
 * katex-init.js — KaTeX 自动渲染初始化
 * 自动查找页面中 $...$ 和 $$...$$ 并渲染
 */

document.addEventListener('DOMContentLoaded', () => {
    if (typeof renderMathInElement === 'undefined') {
        console.warn('KaTeX auto-render not loaded');
        return;
    }

    renderMathInElement(document.body, {
        delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
        trust: true,
    });
});

/** 手动渲染指定元素中的数学公式 */
function renderMath(element) {
    if (typeof renderMathInElement === 'undefined') return;
    renderMathInElement(element, {
        delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
        ],
        throwOnError: false,
        trust: true,
    });
}
