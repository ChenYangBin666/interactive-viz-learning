/**
 * AIQuantUtils — Utility library for AI Quantitative Finance visualizations.
 * Covers math, feature engineering, ML models, deep learning simulation,
 * RL trading, NLP/sentiment, data generation, and canvas drawing helpers.
 *
 * @version 1.0.0
 * @license MIT
 */
const AIQuantUtils = (function () {
  'use strict';

  // ── 1. Random / Math ────────────────────────

  /**
   * Mulberry32 seeded PRNG — returns a function yielding [0,1) floats.
   * @param {number} seed - 32-bit integer seed
   * @returns {() => number}
   */
  function seededRandom(seed) {
    let s = seed | 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Box-Muller transform — returns a normally-distributed random number.
   * @param {number} [mu=0]    - mean
   * @param {number} [sigma=1] - standard deviation
   * @param {() => number} [rng=Math.random] - uniform RNG source
   * @returns {number}
   */
  function normalRandom(mu, sigma, rng) {
    mu = mu ?? 0; sigma = sigma ?? 1; rng = rng || Math.random;
    const u1 = rng(), u2 = rng();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1 || 1e-15)) * Math.cos(2 * Math.PI * u2);
  }

  /** Arithmetic mean. @param {number[]} arr @returns {number} */
  function mean(arr) {
    if (!arr.length) return 0;
    let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  /** Population variance. @param {number[]} arr @returns {number} */
  function variance(arr) {
    const m = mean(arr); let s = 0;
    for (let i = 0; i < arr.length; i++) s += (arr[i] - m) ** 2;
    return s / (arr.length || 1);
  }

  /** Population standard deviation. @param {number[]} arr @returns {number} */
  function std(arr) { return Math.sqrt(variance(arr)); }

  /**
   * Pearson correlation coefficient.
   * @param {number[]} a @param {number[]} b @returns {number}
   */
  function correlation(a, b) {
    const n = Math.min(a.length, b.length);
    if (n < 2) return 0;
    const ma = mean(a), mb = mean(b);
    let sab = 0, sa2 = 0, sb2 = 0;
    for (let i = 0; i < n; i++) {
      const da = a[i] - ma, db = b[i] - mb;
      sab += da * db; sa2 += da * da; sb2 += db * db;
    }
    const denom = Math.sqrt(sa2 * sb2);
    return denom === 0 ? 0 : sab / denom;
  }

  /** Softmax of an array. @param {number[]} arr @returns {number[]} */
  function softmax(arr) {
    const mx = Math.max(...arr);
    const exps = arr.map(v => Math.exp(v - mx));
    const s = exps.reduce((a, b) => a + b, 0);
    return exps.map(e => e / s);
  }

  /** Sigmoid activation. @param {number} x @returns {number} */
  function sigmoid(x) { return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x)))); }

  /** ReLU activation. @param {number} x @returns {number} */
  function relu(x) { return Math.max(0, x); }

  /** Hyperbolic tangent. @param {number} x @returns {number} */
  function tanhFn(x) { return Math.tanh(x); }

  // ── 2. Feature Engineering ──────────────────

  /**
   * Compute common technical indicators from a price array.
   * @param {number[]} prices - close prices
   * @param {object} [opts]
   * @param {number} [opts.maPeriod=20]  @param {number} [opts.rsiPeriod=14]
   * @param {number} [opts.macdFast=12]  @param {number} [opts.macdSlow=26]
   * @param {number} [opts.macdSignal=9] @param {number} [opts.bbPeriod=20]
   * @returns {{ma:number[], ema:number[], rsi:number[], macd:{line:number[], signal:number[], hist:number[]}, bollinger:{upper:number[], middle:number[], lower:number[]}}}
   */
  function technicalIndicators(prices, opts) {
    opts = opts || {};
    const n = prices.length;
    const maPer = opts.maPeriod || 20;
    const rsiPer = opts.rsiPeriod || 14;
    const fast = opts.macdFast || 12, slow = opts.macdSlow || 26, sig = opts.macdSignal || 9;
    const bbPer = opts.bbPeriod || 20;

    // Simple MA
    const ma = new Array(n).fill(NaN);
    for (let i = maPer - 1; i < n; i++) {
      let s = 0; for (let j = i - maPer + 1; j <= i; j++) s += prices[j];
      ma[i] = s / maPer;
    }

    // EMA helper
    function emaCalc(src, period) {
      const out = new Array(src.length).fill(NaN);
      const k = 2 / (period + 1);
      let first = 0; for (let j = 0; j < period; j++) first += src[j];
      out[period - 1] = first / period;
      for (let i = period; i < src.length; i++) out[i] = src[i] * k + out[i - 1] * (1 - k);
      return out;
    }
    const ema = emaCalc(prices, maPer);

    // RSI
    const rsi = new Array(n).fill(NaN);
    if (n > rsiPer) {
      let avgG = 0, avgL = 0;
      for (let i = 1; i <= rsiPer; i++) {
        const d = prices[i] - prices[i - 1];
        if (d > 0) avgG += d; else avgL -= d;
      }
      avgG /= rsiPer; avgL /= rsiPer;
      rsi[rsiPer] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
      for (let i = rsiPer + 1; i < n; i++) {
        const d = prices[i] - prices[i - 1];
        avgG = (avgG * (rsiPer - 1) + Math.max(d, 0)) / rsiPer;
        avgL = (avgL * (rsiPer - 1) + Math.max(-d, 0)) / rsiPer;
        rsi[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
      }
    }

    // MACD
    const emaFast = emaCalc(prices, fast), emaSlow = emaCalc(prices, slow);
    const macdLine = prices.map((_, i) => (isNaN(emaFast[i]) || isNaN(emaSlow[i])) ? NaN : emaFast[i] - emaSlow[i]);
    const validMacd = macdLine.filter(v => !isNaN(v));
    const macdSignal = emaCalc(validMacd, sig);
    const macdHist = validMacd.map((v, i) => isNaN(macdSignal[i]) ? NaN : v - macdSignal[i]);

    // Bollinger Bands
    const upper = new Array(n).fill(NaN), middle = new Array(n).fill(NaN), lower = new Array(n).fill(NaN);
    for (let i = bbPer - 1; i < n; i++) {
      const sl = prices.slice(i - bbPer + 1, i + 1);
      const m = mean(sl), sd = std(sl);
      middle[i] = m; upper[i] = m + 2 * sd; lower[i] = m - 2 * sd;
    }

    return { ma, ema, rsi, macd: { line: macdLine, signal: macdSignal, hist: macdHist }, bollinger: { upper, middle, lower } };
  }

  /**
   * Create lagged feature columns from a series.
   * @param {number[]} series @param {number[]} lags - e.g. [1,2,5,10]
   * @returns {number[][]} - array of lag columns (length = series.length, NaN-padded)
   */
  function lagFeatures(series, lags) {
    return lags.map(lag => series.map((_, i) => i >= lag ? series[i - lag] : NaN));
  }

  /**
   * Rolling statistics: mean, std, skewness, kurtosis.
   * @param {number[]} arr @param {number} window
   * @returns {{mean:number[], std:number[], skew:number[], kurt:number[]}}
   */
  function rollingStats(arr, window) {
    const n = arr.length;
    const rm = new Array(n).fill(NaN), rs = new Array(n).fill(NaN);
    const rsk = new Array(n).fill(NaN), rk = new Array(n).fill(NaN);
    for (let i = window - 1; i < n; i++) {
      const sl = arr.slice(i - window + 1, i + 1);
      const m = mean(sl), sd = std(sl);
      rm[i] = m; rs[i] = sd;
      if (sd > 0) {
        let s3 = 0, s4 = 0;
        for (let j = 0; j < sl.length; j++) { const z = (sl[j] - m) / sd; s3 += z ** 3; s4 += z ** 4; }
        rsk[i] = s3 / window; rk[i] = s4 / window - 3;
      }
    }
    return { mean: rm, std: rs, skew: rsk, kurt: rk };
  }

  /**
   * Cross-sectional rank (percentile rank within a single cross-section).
   * @param {number[]} values @returns {number[]} - ranks in [0,1]
   */
  function crossSectionalRank(values) {
    const n = values.length;
    const sorted = values.slice().sort((a, b) => a - b);
    return values.map(v => { const idx = sorted.indexOf(v); return idx / (n - 1 || 1); });
  }

  /**
   * Winsorize an array at the given percentile bounds.
   * @param {number[]} arr @param {number} [lo=0.05] @param {number} [hi=0.95]
   * @returns {number[]}
   */
  function winsorize(arr, lo, hi) {
    lo = lo ?? 0.05; hi = hi ?? 0.95;
    const sorted = arr.slice().sort((a, b) => a - b);
    const low = sorted[Math.floor(lo * (sorted.length - 1))];
    const high = sorted[Math.floor(hi * (sorted.length - 1))];
    return arr.map(v => Math.max(low, Math.min(high, v)));
  }

  /**
   * Z-score normalize an array. @param {number[]} arr @returns {number[]}
   */
  function zscoreNormalize(arr) {
    const m = mean(arr), s = std(arr) || 1;
    return arr.map(v => (v - m) / s);
  }

  // ── 3. ML Models ────────────────────────────

  /**
   * Ordinary least-squares linear regression.
   * @param {number[][]} X - n x p feature matrix
   * @param {number[]} y   - n target values
   * @returns {{weights:number[], bias:number, predict:(x:number[])=>number}}
   */
  function linearRegression(X, y) {
    const n = X.length, p = X[0].length;
    const xm = new Array(p).fill(0), ym = mean(y);
    for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) xm[j] += X[i][j];
    for (let j = 0; j < p; j++) xm[j] /= n;
    // Normal equation via gradient (simplified for viz)
    const w = new Array(p).fill(0);
    const lr = 0.001, iters = 200;
    let b = 0;
    for (let iter = 0; iter < iters; iter++) {
      const grad = new Array(p).fill(0); let gb = 0;
      for (let i = 0; i < n; i++) {
        let pred = b; for (let j = 0; j < p; j++) pred += w[j] * X[i][j];
        const err = pred - y[i]; gb += err;
        for (let j = 0; j < p; j++) grad[j] += err * X[i][j];
      }
      for (let j = 0; j < p; j++) w[j] -= lr * grad[j] / n;
      b -= lr * gb / n;
    }
    return { weights: w, bias: b, predict: (x) => { let s = b; for (let j = 0; j < p; j++) s += w[j] * x[j]; return s; } };
  }

  /**
   * Ridge regression (L2 regularized).
   * @param {number[][]} X @param {number[]} y @param {number} [lambda=1.0]
   * @returns {{weights:number[], bias:number, predict:(x:number[])=>number}}
   */
  function ridgeRegression(X, y, lambda) {
    lambda = lambda ?? 1.0;
    const n = X.length, p = X[0].length;
    const w = new Array(p).fill(0); let b = 0;
    const lr = 0.001, iters = 300;
    for (let iter = 0; iter < iters; iter++) {
      const grad = new Array(p).fill(0); let gb = 0;
      for (let i = 0; i < n; i++) {
        let pred = b; for (let j = 0; j < p; j++) pred += w[j] * X[i][j];
        const err = pred - y[i]; gb += err;
        for (let j = 0; j < p; j++) grad[j] += err * X[i][j];
      }
      for (let j = 0; j < p; j++) { grad[j] = grad[j] / n + lambda * w[j]; w[j] -= lr * grad[j]; }
      b -= lr * gb / n;
    }
    return { weights: w, bias: b, predict: (x) => { let s = b; for (let j = 0; j < p; j++) s += w[j] * x[j]; return s; } };
  }

  /**
   * Lasso path via coordinate descent — returns weights at several lambda values.
   * @param {number[][]} X @param {number[]} y @param {number[]} [lambdas]
   * @returns {{lambdas:number[], paths:number[][]}} - paths[j][k] = weight j at lambda k
   */
  function lassoPath(X, y, lambdas) {
    const n = X.length, p = X[0].length;
    lambdas = lambdas || [0.001, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0];
    const paths = Array.from({ length: p }, () => []);
    for (const lam of lambdas) {
      const w = new Array(p).fill(0);
      for (let iter = 0; iter < 100; iter++) {
        for (let j = 0; j < p; j++) {
          let rho = 0;
          for (let i = 0; i < n; i++) {
            let pred = 0; for (let k = 0; k < p; k++) if (k !== j) pred += w[k] * X[i][k];
            rho += X[i][j] * (y[i] - pred);
          }
          rho /= n;
          w[j] = rho > lam ? rho - lam : rho < -lam ? rho + lam : 0;
        }
      }
      for (let j = 0; j < p; j++) paths[j].push(w[j]);
    }
    return { lambdas, paths };
  }

  /**
   * Simple decision tree prediction (single split per feature, pre-built).
   * @param {number[]} x - feature vector
   * @param {{feature:number, threshold:number, left:number, right:number}[]} nodes
   * @returns {number}
   */
  function decisionTreePredict(x, nodes) {
    let node = nodes[0];
    while (node) {
      if (node.left == null && node.right == null) return node.value || 0;
      if (x[node.feature] <= node.threshold) node = nodes[node.left];
      else node = nodes[node.right];
    }
    return 0;
  }

  /**
   * Random forest prediction — average of several simple tree outputs.
   * @param {number[]} x @param {Array} forest - array of tree node arrays
   * @returns {number}
   */
  function randomForestPredict(x, forest) {
    let s = 0;
    for (const tree of forest) s += decisionTreePredict(x, tree);
    return s / forest.length;
  }

  /**
   * Simplified gradient boosting (XGBoost-like) prediction.
   * @param {number[]} x @param {{trees:Array, lr:number, basePred:number}} model
   * @returns {number}
   */
  function xgboostPredict(x, model) {
    let pred = model.basePred || 0;
    for (const tree of model.trees) pred += (model.lr || 0.1) * decisionTreePredict(x, tree);
    return pred;
  }

  // ── 4. Deep Learning Simulation ─────────────

  /**
   * Single LSTM cell forward pass.
   * @param {number[]} x  - input vector (size d)
   * @param {number[]} hPrev - previous hidden state (size h)
   * @param {number[]} cPrev - previous cell state (size h)
   * @param {{Wf:number[][], Wi:number[][], Wo:number[][], Wc:number[][], bf:number[], bi:number[], bo:number[], bc:number[]}} params
   * @returns {{h:number[], c:number[], gates:{f:number[], i:number[], o:number[], g:number[]}}}
   */
  function simpleLSTMCell(x, hPrev, cPrev, params) {
    const h = hPrev.length, d = x.length;
    const concat = x.concat(hPrev);
    function gate(W, b, act) {
      return b.map((bv, j) => {
        let s = bv; for (let k = 0; k < concat.length; k++) s += W[j][k] * concat[k];
        return act(s);
      });
    }
    const f = gate(params.Wf, params.bf, sigmoid);
    const i = gate(params.Wi, params.bi, sigmoid);
    const o = gate(params.Wo, params.bo, sigmoid);
    const g = gate(params.Wc, params.bc, tanhFn);
    const cNew = cPrev.map((cv, j) => f[j] * cv + i[j] * g[j]);
    const hNew = cNew.map((cv, j) => o[j] * tanhFn(cv));
    return { h: hNew, c: cNew, gates: { f, i, o, g } };
  }

  /**
   * Scaled dot-product attention.
   * @param {number[][]} Q - queries  (seqLen x dk)
   * @param {number[][]} K - keys     (seqLen x dk)
   * @param {number[][]} V - values   (seqLen x dv)
   * @returns {{output:number[][], weights:number[][]}}
   */
  function simpleAttention(Q, K, V) {
    const n = Q.length, dk = Q[0].length;
    const scale = Math.sqrt(dk);
    const scores = Array.from({ length: n }, (_, i) => {
      const row = new Array(n);
      for (let j = 0; j < n; j++) {
        let s = 0; for (let k = 0; k < dk; k++) s += Q[i][k] * K[j][k];
        row[j] = s / scale;
      }
      return row;
    });
    const weights = scores.map(row => softmax(row));
    const dv = V[0].length;
    const output = weights.map(wRow => {
      const o = new Array(dv).fill(0);
      for (let j = 0; j < n; j++) for (let k = 0; k < dv; k++) o[k] += wRow[j] * V[j][k];
      return o;
    });
    return { output, weights };
  }

  /**
   * Generate pre-computed LSTM prediction trajectories for visualization.
   * @param {number[]} prices - actual price series
   * @param {number} [nPaths=5] @param {number} [seed=42]
   * @returns {number[][]} - array of predicted trajectories
   */
  function generateLSTMPredictions(prices, nPaths, seed) {
    nPaths = nPaths || 5; seed = seed || 42;
    const rng = seededRandom(seed);
    const n = prices.length;
    return Array.from({ length: nPaths }, () => {
      const pred = [prices[0]];
      const lag = 0.85 + rng() * 0.1;
      const noise = 0.005 + rng() * 0.01;
      for (let i = 1; i < n; i++) {
        pred.push(pred[i - 1] + lag * (prices[i] - pred[i - 1]) + normalRandom(0, noise * prices[i], rng));
      }
      return pred;
    });
  }

  /**
   * Simplified transformer block: self-attention + feedforward.
   * @param {number[][]} X - input embeddings (seqLen x dModel)
   * @param {number} [dff=16] - feedforward hidden dim
   * @param {number} [seed=42]
   * @returns {{output:number[][], attnWeights:number[][]}}
   */
  function transformerBlock(X, dff, seed) {
    dff = dff || 16; seed = seed || 42;
    const { output: attnOut, weights: attnW } = simpleAttention(X, X, X);
    // Residual + simplified feedforward
    const out = attnOut.map((row, i) => row.map((v, j) => {
      const res = v + X[i][j];
      return relu(res) * 0.9 + res * 0.1; // leaky-like
    }));
    return { output: out, attnWeights: attnW };
  }

  // ── 5. RL Trading ───────────────────────────

  /**
   * Q-learning update step.
   * @param {Object<string,number[]>} Q - state-action table
   * @param {string} state @param {number} action @param {number} reward
   * @param {string} nextState @param {number} [alpha=0.1] @param {number} [gamma=0.99]
   * @returns {number} - updated Q-value
   */
  function qLearningStep(Q, state, action, reward, nextState, alpha, gamma) {
    alpha = alpha ?? 0.1; gamma = gamma ?? 0.99;
    if (!Q[state]) Q[state] = [0, 0, 0]; // buy, sell, hold
    if (!Q[nextState]) Q[nextState] = [0, 0, 0];
    const maxNext = Math.max(...Q[nextState]);
    Q[state][action] += alpha * (reward + gamma * maxNext - Q[state][action]);
    return Q[state][action];
  }

  /**
   * Policy gradient step — update log-probs proportional to returns.
   * @param {number[]} logProbs - log-probabilities of chosen actions
   * @param {number[]} rewards  - per-step rewards
   * @param {number} [gamma=0.99]
   * @returns {number[]} - gradient estimates per step
   */
  function policyGradientStep(logProbs, rewards, gamma) {
    gamma = gamma ?? 0.99;
    const n = rewards.length;
    const returns = new Array(n).fill(0);
    returns[n - 1] = rewards[n - 1];
    for (let i = n - 2; i >= 0; i--) returns[i] = rewards[i] + gamma * returns[i + 1];
    const m = mean(returns), s = std(returns) || 1;
    return logProbs.map((lp, i) => -lp * ((returns[i] - m) / s));
  }

  /**
   * Create a simple trading environment.
   * @param {number[]} prices - price series
   * @returns {{reset:()=>object, step:(action:number)=>{state:object, reward:number, done:boolean}}}
   */
  function tradingEnvironment(prices) {
    let idx = 0, position = 0, cash = 10000, pnl = 0;
    function getState() {
      const lookback = Math.min(idx, 10);
      const window = prices.slice(Math.max(0, idx - lookback), idx + 1);
      const ret = window.length > 1 ? (window[window.length - 1] / window[0] - 1) : 0;
      return { price: prices[idx], position, cash, pnl, returnPct: ret, step: idx };
    }
    return {
      reset() { idx = 0; position = 0; cash = 10000; pnl = 0; return getState(); },
      step(action) { // 0=buy, 1=sell, 2=hold
        const prevValue = cash + position * prices[idx];
        if (action === 0 && cash >= prices[idx]) { const qty = Math.floor(cash / prices[idx]); position += qty; cash -= qty * prices[idx]; }
        else if (action === 1 && position > 0) { cash += position * prices[idx]; position = 0; }
        idx = Math.min(idx + 1, prices.length - 1);
        const currValue = cash + position * prices[idx];
        const reward = currValue - prevValue;
        pnl = currValue - 10000;
        return { state: getState(), reward, done: idx >= prices.length - 1 };
      }
    };
  }

  /**
   * Experience replay buffer for RL.
   * @param {number} [maxSize=1000]
   * @returns {{push:(s,a,r,s2,d)=>void, sample:(n:number)=>Array, size:()=>number}}
   */
  function replayBuffer(maxSize) {
    maxSize = maxSize || 1000;
    const buf = [];
    return {
      push(s, a, r, s2, done) { buf.push({ s, a, r, s2, done }); if (buf.length > maxSize) buf.shift(); },
      sample(n) {
        const out = [];
        for (let i = 0; i < n && buf.length > 0; i++) out.push(buf[Math.floor(Math.random() * buf.length)]);
        return out;
      },
      size() { return buf.length; }
    };
  }

  // ── 6. NLP / Sentiment ──────────────────────

  const POSITIVE_WORDS = ['surge', 'gain', 'profit', 'bullish', 'rally', 'growth', 'upgrade', 'beat', 'strong', 'optimistic', 'record', 'high', 'positive', 'exceed', 'boost', 'soar'];
  const NEGATIVE_WORDS = ['drop', 'fall', 'loss', 'bearish', 'crash', 'decline', 'downgrade', 'miss', 'weak', 'pessimistic', 'low', 'negative', 'plunge', 'risk', 'cut', 'sink'];

  /**
   * Simple rule-based sentiment score from text.
   * @param {string} text @returns {number} - score in [-1, 1]
   */
  function sentimentScore(text) {
    const words = text.toLowerCase().split(/\W+/);
    let score = 0;
    for (const w of words) {
      if (POSITIVE_WORDS.includes(w)) score += 1;
      if (NEGATIVE_WORDS.includes(w)) score -= 1;
    }
    return Math.max(-1, Math.min(1, score / (words.length || 1) * 5));
  }

  /**
   * Compute TF-IDF vectors for a set of documents.
   * @param {string[]} docs @returns {{vectors:number[][], vocab:string[]}}
   */
  function tfidfVectors(docs) {
    const tokenized = docs.map(d => d.toLowerCase().split(/\W+/).filter(Boolean));
    const vocabSet = new Set(); tokenized.forEach(t => t.forEach(w => vocabSet.add(w)));
    const vocab = [...vocabSet].sort();
    const vIdx = {}; vocab.forEach((w, i) => vIdx[w] = i);
    const df = new Array(vocab.length).fill(0);
    tokenized.forEach(t => { const seen = new Set(t); seen.forEach(w => df[vIdx[w]]++); });
    const N = docs.length;
    const vectors = tokenized.map(t => {
      const tf = new Array(vocab.length).fill(0);
      t.forEach(w => tf[vIdx[w]]++);
      return tf.map((f, i) => (f / (t.length || 1)) * Math.log((N + 1) / (df[i] + 1)));
    });
    return { vectors, vocab };
  }

  /**
   * Cosine similarity between two vectors.
   * @param {number[]} a @param {number[]} b @returns {number}
   */
  function cosineSimilarity(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Generate synthetic news/sentiment data with price impact.
   * @param {number} [n=50] @param {number} [seed=42]
   * @returns {{headline:string, sentiment:number, priceImpact:number, timestamp:number}[]}
   */
  function generateSentimentData(n, seed) {
    n = n || 50; seed = seed || 42;
    const rng = seededRandom(seed);
    const templates = [
      { t: '{company} reports record quarterly earnings, stock surges', s: 0.8 },
      { t: '{company} shares plunge after weak guidance', s: -0.7 },
      { t: 'Analysts upgrade {company} on strong growth outlook', s: 0.6 },
      { t: '{company} announces major cost-cutting amid decline', s: -0.4 },
      { t: '{company} beats revenue estimates, bullish momentum', s: 0.7 },
      { t: 'Market crash fears drag {company} lower', s: -0.8 },
      { t: '{company} launches new product line, optimistic outlook', s: 0.5 },
      { t: 'Regulatory risk weighs on {company} shares', s: -0.5 },
      { t: '{company} profit soars as demand exceeds expectations', s: 0.9 },
      { t: '{company} faces class-action lawsuit, stock drops', s: -0.6 },
    ];
    const companies = ['AAPL', 'TSLA', 'GOOG', 'AMZN', 'MSFT', 'META', 'NVDA', 'JPM'];
    return Array.from({ length: n }, (_, i) => {
      const tmpl = templates[Math.floor(rng() * templates.length)];
      const co = companies[Math.floor(rng() * companies.length)];
      const noise = (rng() - 0.5) * 0.3;
      return {
        headline: tmpl.t.replace('{company}', co),
        sentiment: Math.max(-1, Math.min(1, tmpl.s + noise)),
        priceImpact: (tmpl.s + noise) * (0.5 + rng() * 1.5),
        timestamp: i
      };
    });
  }

  // ── 7. Data Generation ──────────────────────

  /**
   * Generate realistic OHLCV stock data.
   * @param {object} [opts]
   * @param {number} [opts.length=252] @param {number} [opts.start=100]
   * @param {number} [opts.drift=0.0003] @param {number} [opts.vol=0.02]
   * @param {number} [opts.seed=42]
   * @returns {{open:number[], high:number[], low:number[], close:number[], volume:number[]}}
   */
  function generateStockData(opts) {
    opts = opts || {};
    const n = opts.length || 252, start = opts.start || 100;
    const drift = opts.drift ?? 0.0003, vol = opts.vol ?? 0.02;
    const rng = seededRandom(opts.seed ?? 42);
    const open = [start], high = [start], low = [start], close = [start], volume = [Math.floor(1e6 + rng() * 5e6)];
    for (let i = 1; i < n; i++) {
      const eps = normalRandom(0, 1, rng);
      const ret = drift + vol * eps;
      const o = close[i - 1] * (1 + (rng() - 0.5) * 0.003);
      const c = close[i - 1] * Math.exp(ret);
      const intraVol = vol * (0.5 + rng());
      const h = Math.max(o, c) * (1 + Math.abs(normalRandom(0, intraVol * 0.5, rng)));
      const l = Math.min(o, c) * (1 - Math.abs(normalRandom(0, intraVol * 0.5, rng)));
      open.push(o); high.push(h); low.push(l); close.push(c);
      volume.push(Math.floor((1e6 + rng() * 5e6) * (1 + Math.abs(eps) * 0.5)));
    }
    return { open, high, low, close, volume };
  }

  /**
   * Generate synthetic alternative data streams.
   * @param {number} [length=100] @param {number} [seed=42]
   * @returns {{satellite:number[], social:number[], webTraffic:number[]}}
   */
  function generateAlternativeData(length, seed) {
    length = length || 100; seed = seed || 42;
    const rng = seededRandom(seed);
    const satellite = [], social = [], webTraffic = [];
    let satBase = 50, socBase = 1000, webBase = 50000;
    for (let i = 0; i < length; i++) {
      satBase += normalRandom(0.1, 3, rng);
      socBase += normalRandom(5, 50, rng);
      webBase += normalRandom(100, 2000, rng);
      satellite.push(Math.max(0, satBase + 10 * Math.sin(i * 0.1)));
      social.push(Math.max(0, Math.floor(socBase + 200 * Math.sin(i * 0.05))));
      webTraffic.push(Math.max(0, Math.floor(webBase + 5000 * Math.cos(i * 0.08))));
    }
    return { satellite, social, webTraffic };
  }

  /**
   * Generate synthetic news headlines with timestamps and sentiment.
   * @param {number} [n=30] @param {number} [seed=42]
   * @returns {{headline:string, timestamp:number, sentiment:number, source:string}[]}
   */
  function generateNewsData(n, seed) {
    n = n || 30; seed = seed || 42;
    const rng = seededRandom(seed);
    const sources = ['Reuters', 'Bloomberg', 'CNBC', 'WSJ', 'FT'];
    const headlines = [
      'Fed signals potential rate cut amid economic slowdown',
      'Tech stocks rally on strong earnings season',
      'Oil prices surge after OPEC supply cut announcement',
      'Inflation data comes in hotter than expected',
      'Major bank reports record trading revenue',
      'Semiconductor shortage eases, chip stocks gain',
      'Bond yields plunge as recession fears grow',
      'IPO market heats up with billion-dollar listings',
      'Crypto regulation clarity boosts digital asset markets',
      'Supply chain disruptions weigh on manufacturing sector',
      'Central bank holds rates steady, markets react cautiously',
      'Retail sales beat estimates, consumer confidence rises',
    ];
    return Array.from({ length: n }, (_, i) => {
      const h = headlines[Math.floor(rng() * headlines.length)];
      return {
        headline: h,
        timestamp: i,
        sentiment: sentimentScore(h) + (rng() - 0.5) * 0.3,
        source: sources[Math.floor(rng() * sources.length)]
      };
    });
  }

  // ── 8. Visualization Helpers ────────────────

  /** Color palette for AI Quant visualizations (dark theme). */
  const AIQUANT_COLORS = {
    primary:   '#00e5ff',
    secondary: '#7c4dff',
    accent:    '#ff6d00',
    positive:  '#00e676',
    negative:  '#ff1744',
    neutral:   '#78909c',
    bg:        '#0a0e17',
    panel:     '#121929',
    grid:      'rgba(255,255,255,0.06)',
    text:      '#e0e0e0',
    textDim:   '#78909c',
    series:    ['#00e5ff', '#7c4dff', '#ff6d00', '#00e676', '#ff1744', '#ffea00', '#18ffff', '#ea80fc'],
  };

  /**
   * Map a value to a color between two endpoints using linear interpolation.
   * @param {number} value  @param {number} min @param {number} max
   * @param {number[]} [fromRGB=[255,23,68]] @param {number[]} [toRGB=[0,230,118]]
   * @returns {string} - CSS rgb() string
   */
  function valueToColor(value, min, max, fromRGB, toRGB) {
    fromRGB = fromRGB || [255, 23, 68];
    toRGB = toRGB || [0, 230, 118];
    const t = Math.max(0, Math.min(1, (value - min) / ((max - min) || 1)));
    const r = Math.round(fromRGB[0] + t * (toRGB[0] - fromRGB[0]));
    const g = Math.round(fromRGB[1] + t * (toRGB[1] - fromRGB[1]));
    const b = Math.round(fromRGB[2] + t * (toRGB[2] - fromRGB[2]));
    return `rgb(${r},${g},${b})`;
  }

  /**
   * Format a value as percentage string.
   * @param {number} value - e.g. 0.0532 for 5.32%
   * @param {number} [decimals=2]
   * @returns {string}
   */
  function formatPercent(value, decimals) {
    decimals = decimals ?? 2;
    return (value * 100).toFixed(decimals) + '%';
  }

  /**
   * Format a number with thousands separator.
   * @param {number} value @param {number} [decimals=2] @returns {string}
   */
  function formatNumber(value, decimals) {
    decimals = decimals ?? 2;
    return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Draw labelled X and Y axes on a canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} opts
   * @param {number} opts.x @param {number} opts.y @param {number} opts.w @param {number} opts.h
   * @param {number} opts.xMin @param {number} opts.xMax
   * @param {number} opts.yMin @param {number} opts.yMax
   * @param {string} [opts.xLabel] @param {string} [opts.yLabel]
   * @param {number} [opts.ticks=5]
   * @param {string} [opts.color]
   */
  function drawAxis(ctx, opts) {
    const { x, y, w, h, xMin, xMax, yMin, yMax } = opts;
    const ticks = opts.ticks || 5;
    const color = opts.color || AIQUANT_COLORS.textDim;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = 1; ctx.font = '10px monospace'; ctx.textAlign = 'center';

    // X axis
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke();
    for (let i = 0; i <= ticks; i++) {
      const tx = x + (i / ticks) * w;
      const val = xMin + (i / ticks) * (xMax - xMin);
      ctx.beginPath(); ctx.moveTo(tx, y + h); ctx.lineTo(tx, y + h + 4); ctx.stroke();
      ctx.fillText(val.toFixed(1), tx, y + h + 14);
    }
    if (opts.xLabel) { ctx.fillText(opts.xLabel, x + w / 2, y + h + 28); }

    // Y axis
    ctx.textAlign = 'right';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.stroke();
    for (let i = 0; i <= ticks; i++) {
      const ty = y + h - (i / ticks) * h;
      const val = yMin + (i / ticks) * (yMax - yMin);
      ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x - 4, ty); ctx.stroke();
      ctx.fillText(val.toFixed(1), x - 6, ty + 3);
    }
    if (opts.yLabel) {
      ctx.save(); ctx.translate(x - 36, y + h / 2);
      ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center';
      ctx.fillText(opts.yLabel, 0, 0); ctx.restore();
    }
    ctx.restore();
  }

  // ── Public API ──────────────────────────────
  return {
    // 1. Random / Math
    seededRandom, normalRandom, mean, std, variance, correlation,
    softmax, sigmoid, relu, tanh: tanhFn,
    // 2. Feature Engineering
    technicalIndicators, lagFeatures, rollingStats,
    crossSectionalRank, winsorize, zscoreNormalize,
    // 3. ML Models
    linearRegression, ridgeRegression, lassoPath,
    decisionTreePredict, randomForestPredict, xgboostPredict,
    // 4. Deep Learning Simulation
    simpleLSTMCell, simpleAttention, generateLSTMPredictions, transformerBlock,
    // 5. RL Trading
    qLearningStep, policyGradientStep, tradingEnvironment, replayBuffer,
    // 6. NLP / Sentiment
    sentimentScore, tfidfVectors, cosineSimilarity, generateSentimentData,
    // 7. Data Generation
    generateStockData, generateAlternativeData, generateNewsData,
    // 8. Visualization Helpers
    valueToColor, AIQUANT_COLORS, formatPercent, formatNumber, drawAxis
  };
})();
