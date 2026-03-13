# DEVLOG — Bug修复与经验记录

> 此文件记录开发过程中遇到的bug及其解决方案，供日后参考，避免重复踩坑。

---

## [2026-03-13] 全项目审计：6大系统性bug横跨38个文件

**现象：** 对全项目约150个HTML文件进行系统性排查，发现多个模块存在以下可见问题：(1) 页面在高分屏上Canvas高度翻倍、反复resize时无限膨胀；(2) Diffusion/05热力图只占1/4画布；(3) 多个路线图页面显示两个导航栏；(4) 旧版浏览器上roundRect调用崩溃；(5) Prerequisites特征值分解卡片点击无响应；(6) 门户页按钮背景透明。

**原因：**

1. **HiDPI Canvas缺style.height（14个文件）**：`canvas.height = h * dpr` 将buffer设为物理像素，但CSS显示尺寸未约束，canvas以buffer像素数作为显示高度（dpr倍放大）。更严重的是9个文件用 `canvas.getBoundingClientRect().height` 读取已膨胀的高度再乘dpr，导致每次resize高度按dpr²指数增长。

2. **putImageData忽略canvas变换（4个文件）**：`putImageData()` 直接写入物理像素坐标，完全无视 `ctx.scale(dpr, dpr)` 变换。在DPR=2的屏上，热力图数据只填满左上1/4区域。

3. **重复导航栏（11个页面）**：路线图页面同时包含硬编码 `<nav>` 和加载 `nav.js`（动态注入nav），两套导航叠加显示。

4. **roundRect无polyfill（16个使用点）**：`ctx.roundRect()` 在Chrome 99/Safari 15.4以下不存在，直接调用抛TypeError。

5. **CSS变量/颜色属性错误（3处）**：门户页 `--card-bg` 应为 `--bg-card`；Diffusion/02 `COL.textMuted` 应为 `COL.muted`；AIQuant/01 `C.accent` 未定义（死代码）。

6. **导航链接断裂（1处）**：Prerequisites路线图 `04-eigendecomposition/` 目录不存在，实际为 `04-eigenvalue/`。

**修复：**

1. **HiDPI height**：9个compounding文件改为从 `parentElement` 或HTML attribute读取尺寸，添加 `style.width/height`；5个hardcoded文件在 `canvas.height = N*dpr` 后添加 `canvas.style.height = N+'px'`。共修复20+个canvas resize函数。

2. **putImageData**：Diffusion/05、MLP/01、MLP/05 改用temp canvas + `drawImage()` 模式：先将imageData写入临时canvas，再用drawImage绘制到主canvas（drawImage尊重transform）。

3. **重复导航栏**：9个路线图index.html删除 `<script src="nav.js">`；CNN/01和RNN-LSTM/01删除硬编码 `<nav>` 块。

4. **roundRect polyfill**：7个shared utils文件（aiquant/mlp/svm/lgbm/factor/quant/cnn-utils.js）添加prototype polyfill；4个不加载utils的独立页面添加inline polyfill。

5. **CSS/颜色**：修正3处属性名。

6. **链接**：`04-eigendecomposition/` → `04-eigenvalue/`。

**教训：**

- **HiDPI Canvas的"三件套"必须同时到位**：(1) buffer尺寸×DPR，(2) CSS display尺寸=逻辑像素（显式设style.width/height），(3) ctx.scale(DPR,DPR)。缺第2步是最隐蔽的bug——开发者的1x屏看不出问题，用户的2x屏上才暴露。**排查清单**：写完HiDPI canvas代码后搜索 `style.height`，确认每个设了 `.height = N*dpr` 的canvas都有对应的style设置。
- **getBoundingClientRect()读canvas本身会形成正反馈环**：canvas的CSS高度=buffer高度→rect.height读到buffer高度→乘dpr写回buffer→下次更大。**规则**：永远从 `parentElement` 或HTML attribute读尺寸，不从canvas自身读。
- **putImageData是canvas API中唯一忽略transform的方法**：记住这个特例。凡是做了DPR缩放的canvas，都不能直接putImageData。标准解法：temp canvas + drawImage。
- **nav.js动态注入+硬编码nav是模板复制的副作用**：新建页面时确认只用一种导航方式。路线图用nav.js注入，子模块页用nav.js注入，不要两者都写。
- **新增canvas API调用前查MDN兼容性表**：roundRect、OffscreenCanvas等较新API需要polyfill。项目规则：所有polyfill统一放在shared utils的文件头部。

**相关文件：** 38个文件，涉及 AIQuant/、CNN/、MLP/、SVM/、LightGBM/、FactorModels/、QuantStrategy/、Diffusion/、PCBDesign/、RNN-LSTM/、Prerequisites/、index.html（门户页）全部模块的shared utils和子页面。

---

## [2026-03-13] AIQuant/03-deep-learning 页面完全无法交互 + 图表显示不全 + 滑条无效

**现象：** 部署页面 `AIQuant/03-deep-learning/index.html` 三个bug同时存在：(1) 所有交互功能完全失效，页面无任何响应；(2) 折线图只显示上半部分，下半截被截断；(3) "预测窗口"滑条拖动无任何效果。

**原因：**

1. **脚本加载顺序错误**：`aiquant-utils.js` 在 `<head>` 中用 `defer` 加载，但页面底部的内联 `<script>` 在解析时立即执行。内联代码中 `const rng = AIQuantUtils.seededRandom(77)` 调用时 `AIQuantUtils` 尚未定义，导致 LSTM IIFE 崩溃，后续所有模块（TCN、Transformer、Seq2Seq、对比）全部无法初始化。

2. **HiDPI Canvas 尺寸未设置 CSS 显示尺寸**：`initCanvas` 将 canvas buffer 设为 `width * DPR` 和 `height * DPR`，但未设置 `c.style.width` / `c.style.height`。在 DPR=2 的屏幕上，canvas 以 buffer 原始像素尺寸显示（双倍大小），内容只填充了正确缩放的上半部分。同时 `getBoundingClientRect()` 直接测量 canvas 本身而非父元素，导致尺寸不准。

3. **`predWindow` 变量未在绘图中使用**：滑条的 `oninput` 正确更新了 `predWindow` 并调用 `draw()`，但 `draw()` 函数从未读取 `predWindow`，导致滑条拖动后图表无任何变化。

**修复：**

1. 移除 `<head>` 中 `defer` 的 `aiquant-utils.js`，在内联 `<script>` 之前同步加载：`<script src="../shared/scripts/aiquant-utils.js"></script>`

2. 重写 `initCanvas`：测量 `c.parentElement.getBoundingClientRect()` 获取正确宽度，显式设置 `c.style.width = w + 'px'` 和 `c.style.height = h + 'px'`（参考 `01-feature-engineering` 中正常工作的 `resizeCanvas` 模式）

3. 在 `draw()` 中使用 `predWindow`：计算 `splitIdx = showN - predWindow` 作为分界点，历史区域预测线变为半透明细线，预测窗口区域加橙色底色 + 置信区间 + 粗预测线 + 虚线分界线 + 标签

**教训：**

- **`defer` vs 内联脚本**：`defer` 脚本在 DOM 解析完成后、`DOMContentLoaded` 前执行，而内联脚本在解析到时立即执行。如果内联脚本依赖外部库，该库必须同步加载或放在内联脚本之前。排查思路：看到"XXX is not defined"错误时，首先检查脚本加载顺序和 `defer`/`async` 属性。
- **HiDPI Canvas 三件套**：设置 canvas 高分辨率必须同时做三件事：(1) buffer 尺寸乘 DPR，(2) CSS 显示尺寸设为逻辑像素，(3) ctx.scale(DPR, DPR)。缺任何一步都会导致显示异常。测量尺寸应该用父元素而非 canvas 本身。
- **变量声明了但未使用**：新增交互控件时，确保控件更新的变量确实在渲染逻辑中被引用。可以全局搜索变量名确认使用情况。

**相关文件：** `AIQuant/03-deep-learning/index.html`, `AIQuant/shared/scripts/aiquant-utils.js`, `AIQuant/01-feature-engineering/index.html`（参考正确实现）

---
