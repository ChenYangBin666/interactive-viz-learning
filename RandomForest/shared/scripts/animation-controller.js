/**
 * animation-controller.js — 播放/暂停/步进动画控制器
 * 管理分步动画的时间线
 */

class AnimationController {
    /**
     * @param {Object} options
     * @param {HTMLElement} options.container - 控件容器
     * @param {Array<{name: string, duration?: number, action: Function}>} options.steps - 动画步骤
     * @param {number} [options.defaultDuration=800] - 默认步骤时长 ms
     * @param {Function} [options.onStepChange] - 步骤变化回调
     * @param {Function} [options.onComplete] - 完成回调
     * @param {boolean} [options.autoRender=true] - 自动渲染控件
     */
    constructor(options) {
        this.container = options.container;
        this.steps = options.steps || [];
        this.defaultDuration = options.defaultDuration || 800;
        this.onStepChange = options.onStepChange || null;
        this.onComplete = options.onComplete || null;
        this.currentStep = -1;
        this.isPlaying = false;
        this.playTimer = null;
        this.speed = 1;

        if (options.autoRender !== false) {
            this.render();
        }
    }

    render() {
        this.container.innerHTML = '';
        this.container.classList.add('anim-controls');

        // 重置按钮
        this.resetBtn = this._createBtn('⟲', '重置', () => this.reset());

        // 上一步
        this.prevBtn = this._createBtn('◂', '上一步', () => this.prev());

        // 播放/暂停
        this.playBtn = this._createBtn('▶', '播放', () => this.togglePlay());
        this.playBtn.classList.add('btn-primary');

        // 下一步
        this.nextBtn = this._createBtn('▸', '下一步', () => this.next());

        // 进度条
        this.progressWrap = document.createElement('div');
        this.progressWrap.className = 'progress-bar';
        this.progressFill = document.createElement('div');
        this.progressFill.className = 'fill';
        this.progressWrap.appendChild(this.progressFill);
        this.progressWrap.addEventListener('click', (e) => {
            const rect = this.progressWrap.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            const step = Math.round(pct * (this.steps.length - 1));
            this.goTo(step);
        });

        // 速度控制
        this.speedBtn = this._createBtn('1x', '速度', () => this.cycleSpeed());
        this.speedBtn.style.minWidth = '3rem';

        // 步骤标签
        this.stepLabel = document.createElement('span');
        this.stepLabel.className = 'step-label';
        this.stepLabel.textContent = `0 / ${this.steps.length}`;

        this.container.append(
            this.resetBtn, this.prevBtn, this.playBtn, this.nextBtn,
            this.progressWrap, this.speedBtn, this.stepLabel
        );

        this._updateUI();
    }

    _createBtn(text, title, onClick) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-icon';
        btn.textContent = text;
        btn.title = title;
        btn.addEventListener('click', onClick);
        return btn;
    }

    _updateUI() {
        if (!this.stepLabel) return;
        const total = this.steps.length;
        const cur = this.currentStep + 1;
        this.stepLabel.textContent = `${cur} / ${total}`;
        const pct = total > 0 ? (cur / total) * 100 : 0;
        this.progressFill.style.width = pct + '%';
        this.prevBtn.disabled = this.currentStep < 0;
        this.nextBtn.disabled = this.currentStep >= total - 1;
        this.playBtn.textContent = this.isPlaying ? '⏸' : '▶';
        this.playBtn.title = this.isPlaying ? '暂停' : '播放';
    }

    async goTo(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.steps.length) return;

        // 如果向前跳，需要从头重放
        if (stepIndex <= this.currentStep) {
            this.currentStep = -1;
            // 快速回放到目标步骤
            for (let i = 0; i <= stepIndex; i++) {
                this.currentStep = i;
                await this.steps[i].action(i, true); // true = instant
            }
        } else {
            // 前进
            for (let i = this.currentStep + 1; i <= stepIndex; i++) {
                this.currentStep = i;
                if (i === stepIndex) {
                    await this.steps[i].action(i, false);
                } else {
                    await this.steps[i].action(i, true); // 中间步骤快进
                }
            }
        }

        this._updateUI();
        if (this.onStepChange) this.onStepChange(this.currentStep);
    }

    async next() {
        if (this.currentStep >= this.steps.length - 1) {
            this.pause();
            if (this.onComplete) this.onComplete();
            return false;
        }
        this.currentStep++;
        await this.steps[this.currentStep].action(this.currentStep, false);
        this._updateUI();
        if (this.onStepChange) this.onStepChange(this.currentStep);
        if (this.currentStep >= this.steps.length - 1) {
            this.pause();
            if (this.onComplete) this.onComplete();
        }
        return true;
    }

    async prev() {
        if (this.currentStep <= 0) {
            this.reset();
            return;
        }
        await this.goTo(this.currentStep - 1);
    }

    reset() {
        this.pause();
        this.currentStep = -1;
        this._updateUI();
        if (this.onStepChange) this.onStepChange(-1);
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    async play() {
        if (this.currentStep >= this.steps.length - 1) {
            this.reset();
        }
        this.isPlaying = true;
        this._updateUI();
        this._scheduleNext();
    }

    pause() {
        this.isPlaying = false;
        if (this.playTimer) {
            clearTimeout(this.playTimer);
            this.playTimer = null;
        }
        this._updateUI();
    }

    _scheduleNext() {
        if (!this.isPlaying) return;
        const step = this.steps[this.currentStep + 1];
        if (!step) {
            this.pause();
            return;
        }
        const dur = (step.duration || this.defaultDuration) / this.speed;
        this.playTimer = setTimeout(async () => {
            if (!this.isPlaying) return;
            const hasMore = await this.next();
            if (hasMore && this.isPlaying) {
                this._scheduleNext();
            }
        }, dur);
    }

    cycleSpeed() {
        const speeds = [0.5, 1, 1.5, 2, 3];
        const idx = speeds.indexOf(this.speed);
        this.speed = speeds[(idx + 1) % speeds.length];
        this.speedBtn.textContent = this.speed + 'x';
    }

    /** 更新步骤列表 */
    setSteps(steps) {
        this.pause();
        this.steps = steps;
        this.currentStep = -1;
        this._updateUI();
    }

    /** 获取当前步骤名 */
    getCurrentStepName() {
        if (this.currentStep < 0) return null;
        return this.steps[this.currentStep]?.name;
    }
}
