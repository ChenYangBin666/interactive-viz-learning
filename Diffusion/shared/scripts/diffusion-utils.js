/* ============================================================
   DiffusionUtils — utility library for the Diffusion-Model
   interactive learning project (扩散模型可视化学习工具库)
   ============================================================ */
const DiffusionUtils = (() => {
  'use strict';

  // ──────────────────────────────────────────────────────────
  // 1. Gaussian Noise Utilities
  // ──────────────────────────────────────────────────────────

  /**
   * Generate a single Gaussian-distributed random number
   * using the Box-Muller transform.
   * @param {number} mean - Mean of distribution (default 0)
   * @param {number} std  - Standard deviation (default 1)
   * @returns {number}
   */
  function gaussianRandom(mean = 0, std = 1) {
    let u1 = 0;
    let u2 = 0;
    // Avoid log(0)
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z * std + mean;
  }

  /**
   * Generate a 2D array (height x width) of i.i.d. Gaussian noise.
   * @param {number} width
   * @param {number} height
   * @returns {number[][]}
   */
  function generateNoise(width, height) {
    const noise = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        row.push(gaussianRandom());
      }
      noise.push(row);
    }
    return noise;
  }

  /**
   * Add scaled Gaussian noise to every element of a 2D array.
   * Returns a new array — the original is not mutated.
   * @param {number[][]} data       - 2D array of values
   * @param {number}     noiseLevel - scaling factor for noise
   * @returns {number[][]}
   */
  function addNoise(data, noiseLevel) {
    const h = data.length;
    const w = data[0].length;
    const out = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        row.push(data[y][x] + noiseLevel * gaussianRandom());
      }
      out.push(row);
    }
    return out;
  }

  // ──────────────────────────────────────────────────────────
  // 2. Forward Process  q(x_t | x_0)
  // ──────────────────────────────────────────────────────────

  /**
   * Compute noise schedule for T timesteps.
   * @param {number} T            - total diffusion timesteps
   * @param {string} scheduleType - 'linear' | 'cosine'
   * @returns {{alphas: number[], alphas_bar: number[], betas: number[]}}
   *   Arrays are length T+1 (index 0 is the identity / no-noise state).
   */
  function computeAlphaSchedule(T, scheduleType = 'linear') {
    const betas = new Array(T + 1);
    const alphas = new Array(T + 1);
    const alphas_bar = new Array(T + 1);

    betas[0] = 0;
    alphas[0] = 1;
    alphas_bar[0] = 1;

    if (scheduleType === 'cosine') {
      // Cosine schedule (Nichol & Dhariwal 2021)
      const s = 0.008; // small offset to prevent beta = 0
      const fBar = (t) => Math.cos(((t / T + s) / (1 + s)) * (Math.PI / 2)) ** 2;
      const f0 = fBar(0);
      for (let t = 1; t <= T; t++) {
        const ab = fBar(t) / f0;
        const abPrev = fBar(t - 1) / f0;
        let beta = 1 - ab / abPrev;
        beta = Math.min(Math.max(beta, 1e-6), 0.999); // clamp
        betas[t] = beta;
        alphas[t] = 1 - beta;
        alphas_bar[t] = ab;
      }
    } else {
      // Linear schedule — beta linearly from beta_start to beta_end
      const betaStart = 1e-4;
      const betaEnd = 0.02;
      for (let t = 1; t <= T; t++) {
        const beta = betaStart + (betaEnd - betaStart) * ((t - 1) / (T - 1 || 1));
        betas[t] = beta;
        alphas[t] = 1 - beta;
        alphas_bar[t] = alphas_bar[t - 1] * alphas[t];
      }
    }

    return { alphas, alphas_bar, betas };
  }

  /**
   * Single forward diffusion step: compute x_t from x_0.
   *   x_t = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * epsilon
   * Works for flat arrays (1-D data vectors).
   * @param {number[]} x        - clean data x_0
   * @param {number}   t        - timestep (1 … T)
   * @param {{alphas_bar: number[]}} schedule
   * @returns {{xt: number[], epsilon: number[]}}
   */
  function forwardStep(x, t, schedule) {
    const abT = schedule.alphas_bar[t];
    const sqrtAb = Math.sqrt(abT);
    const sqrtOneMinusAb = Math.sqrt(1 - abT);
    const epsilon = x.map(() => gaussianRandom());
    const xt = x.map((val, i) => sqrtAb * val + sqrtOneMinusAb * epsilon[i]);
    return { xt, epsilon };
  }

  /**
   * Full forward trajectory: returns x_t for every t = 0 … T.
   * Each entry stores {xt, epsilon} (epsilon is undefined for t=0).
   * @param {number[]} x0       - clean data
   * @param {number}   T        - total timesteps
   * @param {{alphas_bar: number[]}} schedule
   * @returns {{xt: number[], epsilon: number|null}[]}
   */
  function forwardProcess(x0, T, schedule) {
    const trajectory = [{ xt: x0.slice(), epsilon: null }];
    for (let t = 1; t <= T; t++) {
      const { xt, epsilon } = forwardStep(x0, t, schedule);
      trajectory.push({ xt, epsilon });
    }
    return trajectory;
  }

  // ──────────────────────────────────────────────────────────
  // 3. Reverse Process
  // ──────────────────────────────────────────────────────────

  /**
   * Single reverse (denoising) step.
   *   mu = (1/sqrt(alpha_t)) * (x_t - (beta_t / sqrt(1-alpha_bar_t)) * predicted_noise)
   *   x_{t-1} = mu + sqrt(beta_t) * z   (z ~ N(0,I), except at t=1 where z=0)
   * @param {number[]} xt              - noisy data at timestep t
   * @param {number[]} predictedNoise  - model's noise prediction
   * @param {number}   t               - current timestep (>=1)
   * @param {{alphas: number[], alphas_bar: number[], betas: number[]}} schedule
   * @returns {number[]} x_{t-1}
   */
  function reverseStep(xt, predictedNoise, t, schedule) {
    const alpha = schedule.alphas[t];
    const beta = schedule.betas[t];
    const abT = schedule.alphas_bar[t];
    const sqrtAlpha = Math.sqrt(alpha);
    const coeff = beta / Math.sqrt(1 - abT);

    const mu = xt.map((val, i) => (1 / sqrtAlpha) * (val - coeff * predictedNoise[i]));

    if (t <= 1) return mu; // no noise at the final step

    const sqrtBeta = Math.sqrt(beta);
    return mu.map((val) => val + sqrtBeta * gaussianRandom());
  }

  /**
   * Posterior mean  q(x_{t-1} | x_t, x_0):
   *   mu = (sqrt(alpha_bar_{t-1}) * beta_t / (1-alpha_bar_t)) * x_0
   *       + (sqrt(alpha_t) * (1-alpha_bar_{t-1}) / (1-alpha_bar_t)) * x_t
   * @param {number[]} xt
   * @param {number[]} x0
   * @param {number}   t
   * @param {{alphas: number[], alphas_bar: number[], betas: number[]}} schedule
   * @returns {number[]}
   */
  function computePosteriorMean(xt, x0, t, schedule) {
    const abT = schedule.alphas_bar[t];
    const abTm1 = schedule.alphas_bar[t - 1];
    const beta = schedule.betas[t];

    const c0 = (Math.sqrt(abTm1) * beta) / (1 - abT);
    const ct = (Math.sqrt(schedule.alphas[t]) * (1 - abTm1)) / (1 - abT);

    return x0.map((val, i) => c0 * val + ct * xt[i]);
  }

  /**
   * Posterior variance  beta_tilde_t:
   *   beta_tilde_t = (1 - alpha_bar_{t-1}) / (1 - alpha_bar_t) * beta_t
   * @param {number} t
   * @param {{alphas_bar: number[], betas: number[]}} schedule
   * @returns {number}
   */
  function computePosteriorVariance(t, schedule) {
    if (t <= 1) return 0;
    const abT = schedule.alphas_bar[t];
    const abTm1 = schedule.alphas_bar[t - 1];
    const beta = schedule.betas[t];
    return ((1 - abTm1) / (1 - abT)) * beta;
  }

  // ──────────────────────────────────────────────────────────
  // 4. Score and Loss
  // ──────────────────────────────────────────────────────────

  /**
   * Simple (epsilon-matching) MSE loss.
   * @param {number[]} predictedNoise
   * @param {number[]} actualNoise
   * @returns {number}
   */
  function computeSimpleLoss(predictedNoise, actualNoise) {
    if (predictedNoise.length !== actualNoise.length) {
      throw new Error('Noise arrays must have the same length');
    }
    let sum = 0;
    for (let i = 0; i < predictedNoise.length; i++) {
      const d = predictedNoise[i] - actualNoise[i];
      sum += d * d;
    }
    return sum / predictedNoise.length;
  }

  /**
   * Approximate score  ∇_x log p(x)  via finite-difference
   * kernel-density estimation with isotropic Gaussian kernel.
   *
   * For a set of samples, score at point x is:
   *   s(x) ≈ - (x - mu_weighted) / sigma^2
   * where mu_weighted is the density-weighted mean of nearby samples.
   *
   * Here we use a simplified single-point version:
   *   score ≈ -x / sigma^2
   * which is exact for a standard Gaussian.
   *
   * @param {number[]} x          - point (or vector)
   * @param {number}   noiseLevel - sigma
   * @returns {number[]} score vector (same length as x)
   */
  function estimateScore(x, noiseLevel) {
    const sigma2 = noiseLevel * noiseLevel;
    if (sigma2 === 0) return x.map(() => 0);
    return x.map((val) => -val / sigma2);
  }

  // ──────────────────────────────────────────────────────────
  // 5. 2D Data Generation  (for visualization)
  // ──────────────────────────────────────────────────────────

  /**
   * Generate Swiss-roll data in 2D.
   * @param {number} n - number of points
   * @returns {{x: number, y: number}[]}
   */
  function generateSwissRoll(n = 300) {
    const points = [];
    for (let i = 0; i < n; i++) {
      const t = (1.5 * Math.PI) * (1 + 2 * Math.random());
      const x = t * Math.cos(t) * 0.15 + gaussianRandom(0, 0.1);
      const y = t * Math.sin(t) * 0.15 + gaussianRandom(0, 0.1);
      points.push({ x, y });
    }
    return points;
  }

  /**
   * Generate a two-moons dataset.
   * @param {number} n - total number of points (split evenly)
   * @returns {{x: number, y: number}[]}
   */
  function generateMoons(n = 300) {
    const points = [];
    const half = Math.floor(n / 2);
    const noiseStd = 0.08;

    // Upper moon
    for (let i = 0; i < half; i++) {
      const angle = Math.PI * (i / half);
      points.push({
        x: Math.cos(angle) + gaussianRandom(0, noiseStd),
        y: Math.sin(angle) + gaussianRandom(0, noiseStd),
      });
    }
    // Lower moon (shifted)
    for (let i = 0; i < n - half; i++) {
      const angle = Math.PI * (i / (n - half));
      points.push({
        x: 1 - Math.cos(angle) + gaussianRandom(0, noiseStd),
        y: 1 - Math.sin(angle) - 0.5 + gaussianRandom(0, noiseStd),
      });
    }
    return points;
  }

  /**
   * Generate a mixture-of-Gaussians dataset.
   * @param {number}     n       - total number of points
   * @param {number[][]} centers - array of [cx, cy] cluster centres
   * @returns {{x: number, y: number}[]}
   */
  function generateGaussianMixture(n = 300, centers = [[0, 0], [3, 3], [-3, 3]]) {
    const points = [];
    const k = centers.length;
    const perCluster = Math.floor(n / k);
    const std = 0.5;

    for (let c = 0; c < k; c++) {
      const count = c < k - 1 ? perCluster : n - perCluster * (k - 1);
      for (let i = 0; i < count; i++) {
        points.push({
          x: centers[c][0] + gaussianRandom(0, std),
          y: centers[c][1] + gaussianRandom(0, std),
        });
      }
    }
    return points;
  }

  /**
   * Generate an evenly-spaced 2D grid — useful for plotting
   * vector fields and heatmaps.
   * @param {number} range - half-extent (grid goes from -range to +range)
   * @param {number} steps - number of steps along each axis
   * @returns {{x: number, y: number}[]}
   */
  function generate2DGrid(range = 4, steps = 20) {
    const points = [];
    const step = (2 * range) / (steps - 1);
    for (let j = 0; j < steps; j++) {
      for (let i = 0; i < steps; i++) {
        points.push({
          x: -range + i * step,
          y: -range + j * step,
        });
      }
    }
    return points;
  }

  // ──────────────────────────────────────────────────────────
  // 6. Image Utilities  (pixel-level demos)
  // ──────────────────────────────────────────────────────────

  /**
   * Convert an ImageData object to a normalised float array [0,1].
   * Returns a flat Float32Array of length width*height (grayscale average).
   * @param {ImageData} imageData
   * @returns {Float32Array}
   */
  function imageToArray(imageData) {
    const { data, width, height } = imageData;
    const len = width * height;
    const arr = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const base = i * 4;
      // Average RGB, normalise to [0, 1]
      arr[i] = (data[base] + data[base + 1] + data[base + 2]) / (3 * 255);
    }
    return arr;
  }

  /**
   * Convert a normalised float array back to an ImageData.
   * Values are clamped to [0, 1].
   * @param {Float32Array|number[]} arr
   * @param {number} width
   * @param {number} height
   * @returns {ImageData}
   */
  function arrayToImageData(arr, width, height) {
    const imageData = new ImageData(width, height);
    const d = imageData.data;
    for (let i = 0; i < width * height; i++) {
      const v = Math.max(0, Math.min(1, arr[i]));
      const byte = Math.round(v * 255);
      const base = i * 4;
      d[base] = byte;
      d[base + 1] = byte;
      d[base + 2] = byte;
      d[base + 3] = 255;
    }
    return imageData;
  }

  /**
   * Simple box-filter downsampling of a flat array treated as
   * a width×height image.
   * @param {Float32Array|number[]} arr
   * @param {number} w      - original width
   * @param {number} h      - original height
   * @param {number} factor - integer downsampling factor
   * @returns {{data: Float32Array, width: number, height: number}}
   */
  function downsample(arr, w, h, factor) {
    const nw = Math.floor(w / factor);
    const nh = Math.floor(h / factor);
    const out = new Float32Array(nw * nh);
    const area = factor * factor;

    for (let jj = 0; jj < nh; jj++) {
      for (let ii = 0; ii < nw; ii++) {
        let sum = 0;
        for (let dy = 0; dy < factor; dy++) {
          for (let dx = 0; dx < factor; dx++) {
            sum += arr[(jj * factor + dy) * w + (ii * factor + dx)];
          }
        }
        out[jj * nw + ii] = sum / area;
      }
    }
    return { data: out, width: nw, height: nh };
  }

  // ──────────────────────────────────────────────────────────
  // 7. Animation Helpers
  // ──────────────────────────────────────────────────────────

  /**
   * Linear interpolation between two values.
   * @param {number} a - start value
   * @param {number} b - end value
   * @param {number} t - parameter in [0, 1]
   * @returns {number}
   */
  function interpolate(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Smooth ease-in-out (cubic Hermite).
   * Maps [0,1] → [0,1] with zero derivative at endpoints.
   * @param {number} t - parameter in [0, 1]
   * @returns {number}
   */
  function easeInOut(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Create a simple timeline controller.
   * @param {number} steps - total number of steps (0-indexed internally)
   * @returns {{current: function(): number,
   *            progress: function(): number,
   *            next: function(): number,
   *            prev: function(): number,
   *            set: function(number): number,
   *            reset: function(): number,
   *            isEnd: function(): boolean,
   *            isStart: function(): boolean,
   *            total: number}}
   */
  function createTimeline(steps) {
    let _current = 0;
    const _total = Math.max(1, steps);

    return {
      /** Current step index */
      current()  { return _current; },
      /** Progress ratio [0, 1] */
      progress() { return _current / (_total - 1); },
      /** Advance one step; returns new index */
      next() {
        if (_current < _total - 1) _current++;
        return _current;
      },
      /** Go back one step; returns new index */
      prev() {
        if (_current > 0) _current--;
        return _current;
      },
      /** Jump to a specific step */
      set(idx) {
        _current = Math.max(0, Math.min(_total - 1, Math.floor(idx)));
        return _current;
      },
      /** Reset to step 0 */
      reset() {
        _current = 0;
        return _current;
      },
      /** True when at the last step */
      isEnd()   { return _current >= _total - 1; },
      /** True when at the first step */
      isStart() { return _current <= 0; },
      /** Total number of steps */
      total: _total,
    };
  }

  // ──────────────────────────────────────────────────────────
  // 8. Visualization Helpers
  // ──────────────────────────────────────────────────────────

  /**
   * Map a scalar value to an RGB colour string using a
   * diverging blue → white → red palette.
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {string} e.g. "rgb(255,120,120)"
   */
  function colorMap(value, min, max) {
    // Normalise to [0, 1]
    let t = (max === min) ? 0.5 : (value - min) / (max - min);
    t = Math.max(0, Math.min(1, t));

    let r, g, b;
    if (t < 0.5) {
      // Blue → White
      const s = t * 2; // 0 → 1
      r = Math.round(interpolate(59, 255, s));
      g = Math.round(interpolate(76, 255, s));
      b = Math.round(interpolate(192, 255, s));
    } else {
      // White → Red
      const s = (t - 0.5) * 2; // 0 → 1
      r = Math.round(interpolate(255, 210, s));
      g = Math.round(interpolate(255, 56, s));
      b = Math.round(interpolate(255, 56, s));
    }
    return `rgb(${r},${g},${b})`;
  }

  /**
   * Draw a 2D numeric array as a heatmap on a Canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number[][]} data     - 2D array [rows][cols]
   * @param {number}     cellSize - pixel size of each cell
   * @param {object}     [opts]
   * @param {number}     [opts.offsetX=0]
   * @param {number}     [opts.offsetY=0]
   * @param {number}     [opts.min]  - data min (auto if omitted)
   * @param {number}     [opts.max]  - data max (auto if omitted)
   */
  function drawHeatmap(ctx, data, cellSize, opts = {}) {
    const rows = data.length;
    const cols = data[0].length;
    const ox = opts.offsetX || 0;
    const oy = opts.offsetY || 0;

    // Determine data range
    let dMin = opts.min;
    let dMax = opts.max;
    if (dMin === undefined || dMax === undefined) {
      dMin = Infinity;
      dMax = -Infinity;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (data[r][c] < dMin) dMin = data[r][c];
          if (data[r][c] > dMax) dMax = data[r][c];
        }
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = colorMap(data[r][c], dMin, dMax);
        ctx.fillRect(ox + c * cellSize, oy + r * cellSize, cellSize, cellSize);
      }
    }
  }

  /**
   * Draw a 2D vector field with small arrows.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number, vx: number, vy: number}[]} vectors
   * @param {number} scale - length multiplier for arrows
   * @param {object} [opts]
   * @param {string} [opts.color='rgba(0,200,255,0.7)']
   * @param {number} [opts.headLen=5]  - arrowhead length in px
   * @param {number} [opts.lineWidth=1.5]
   */
  function drawVectorField(ctx, vectors, scale, opts = {}) {
    const color = opts.color || 'rgba(0,200,255,0.7)';
    const headLen = opts.headLen || 5;
    const lw = opts.lineWidth || 1.5;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';

    for (let i = 0; i < vectors.length; i++) {
      const { x, y, vx, vy } = vectors[i];
      const dx = vx * scale;
      const dy = vy * scale;
      const mag = Math.sqrt(dx * dx + dy * dy);
      if (mag < 0.5) continue; // skip near-zero vectors

      const ex = x + dx;
      const ey = y + dy;
      const angle = Math.atan2(dy, dx);

      // Shaft
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(
        ex - headLen * Math.cos(angle - Math.PI / 6),
        ey - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        ex - headLen * Math.cos(angle + Math.PI / 6),
        ey - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draw scatter points on a canvas.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{x: number, y: number}[]} points
   * @param {string} color  - CSS colour
   * @param {number} radius - circle radius in px
   * @param {object} [opts]
   * @param {number} [opts.alpha=1]
   * @param {boolean}[opts.stroke=false]
   * @param {string} [opts.strokeColor='#fff']
   */
  function drawParticles(ctx, points, color = '#00c8ff', radius = 3, opts = {}) {
    const alpha = opts.alpha !== undefined ? opts.alpha : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;

    if (opts.stroke) {
      ctx.strokeStyle = opts.strokeColor || '#fff';
      ctx.lineWidth = 1;
    }

    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      ctx.moveTo(p.x + radius, p.y);
      ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
    }
    ctx.fill();
    if (opts.stroke) ctx.stroke();

    ctx.restore();
  }

  // ──────────────────────────────────────────────────────────
  // 9. Math Display Helpers
  // ──────────────────────────────────────────────────────────

  /**
   * Format a number for on-screen display.
   * @param {number} n
   * @param {number} digits - decimal digits (default 3)
   * @returns {string}
   */
  function formatNumber(n, digits = 3) {
    if (Number.isNaN(n)) return 'NaN';
    if (!Number.isFinite(n)) return n > 0 ? '∞' : '-∞';
    // Use fixed-point for small numbers, exponential for very large/small
    const abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e6 || abs < 1e-4)) {
      return n.toExponential(digits);
    }
    return n.toFixed(digits);
  }

  /**
   * Compute the Kullback-Leibler divergence  D_KL(P || Q).
   * Both p and q must be probability arrays of the same length
   * (assumed to sum to 1). Bins where p[i] = 0 contribute 0.
   * Small epsilon is added to q to avoid log(0).
   * @param {number[]} p
   * @param {number[]} q
   * @returns {number}
   */
  function klDivergence(p, q) {
    if (p.length !== q.length) {
      throw new Error('Distribution arrays must have the same length');
    }
    const eps = 1e-12;
    let kl = 0;
    for (let i = 0; i < p.length; i++) {
      if (p[i] > 0) {
        kl += p[i] * Math.log(p[i] / (q[i] + eps));
      }
    }
    return kl;
  }

  // ──────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────

  return {
    // 1. Gaussian Noise
    gaussianRandom,
    generateNoise,
    addNoise,

    // 2. Forward Process
    computeAlphaSchedule,
    forwardStep,
    forwardProcess,

    // 3. Reverse Process
    reverseStep,
    computePosteriorMean,
    computePosteriorVariance,

    // 4. Score & Loss
    computeSimpleLoss,
    estimateScore,

    // 5. 2D Data Generation
    generateSwissRoll,
    generateMoons,
    generateGaussianMixture,
    generate2DGrid,

    // 6. Image Utilities
    imageToArray,
    arrayToImageData,
    downsample,

    // 7. Animation Helpers
    interpolate,
    easeInOut,
    createTimeline,

    // 8. Visualization Helpers
    colorMap,
    drawHeatmap,
    drawVectorField,
    drawParticles,

    // 9. Math Display Helpers
    formatNumber,
    klDivergence,
  };
})();
