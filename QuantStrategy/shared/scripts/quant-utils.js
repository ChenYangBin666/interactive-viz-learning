/**
 * QuantUtils — Utility library for Quantitative Trading Strategy visualizations.
 * Provides math, time-series, strategy, portfolio, risk, data-generation and
 * canvas-drawing helpers used across all nine modules.
 *
 * @version 1.0.0
 * @license MIT
 */
const QuantUtils = (function () {
  'use strict';

  // ── 1. Random / Math ───────────────────────

  /**
   * Mulberry32 seeded PRNG — returns a function that yields [0,1) floats.
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
    mu = mu ?? 0;
    sigma = sigma ?? 1;
    rng = rng || Math.random;
    const u1 = rng();
    const u2 = rng();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1 || 1e-15)) * Math.cos(2 * Math.PI * u2);
  }

  /** Arithmetic mean. @param {number[]} arr @returns {number} */
  function mean(arr) {
    if (!arr.length) return 0;
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  /** Population variance. @param {number[]} arr @returns {number} */
  function variance(arr) {
    const m = mean(arr);
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += (arr[i] - m) ** 2;
    return s / (arr.length || 1);
  }

  /** Population standard deviation. @param {number[]} arr @returns {number} */
  function std(arr) { return Math.sqrt(variance(arr)); }

  /**
   * Sample covariance of two equal-length arrays.
   * @param {number[]} a @param {number[]} b @returns {number}
   */
  function covariance(a, b) {
    const n = Math.min(a.length, b.length);
    if (n < 2) return 0;
    const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
    let s = 0;
    for (let i = 0; i < n; i++) s += (a[i] - ma) * (b[i] - mb);
    return s / (n - 1);
  }

  /**
   * Pearson correlation coefficient.
   * @param {number[]} a @param {number[]} b @returns {number}
   */
  function correlation(a, b) {
    const sa = std(a), sb = std(b);
    if (sa === 0 || sb === 0) return 0;
    return covariance(a, b) / (sa * sb);
  }

  /**
   * Linear-interpolation percentile.
   * @param {number[]} arr @param {number} p - percentile 0-100 @returns {number}
   */
  function percentile(arr, p) {
    if (!arr.length) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  /** Z-score of each element. @param {number[]} arr @returns {number[]} */
  function zscore(arr) {
    const m = mean(arr), s = std(arr) || 1;
    return arr.map(v => (v - m) / s);
  }

  // ── 2. Time Series ─────────────────────────

  /**
   * Generate a price series via geometric Brownian motion.
   * @param {object} opts
   * @param {number} [opts.length=252]  - number of data points
   * @param {number} [opts.start=100]   - initial price
   * @param {number} [opts.drift=0.0005] - daily drift (mu)
   * @param {number} [opts.vol=0.02]    - daily volatility (sigma)
   * @param {number} [opts.seed]        - optional RNG seed
   * @returns {number[]}
   */
  function generatePriceSeries(opts) {
    opts = opts || {};
    const len = opts.length || 252;
    const start = opts.start || 100;
    const drift = opts.drift ?? 0.0005;
    const vol = opts.vol ?? 0.02;
    const rng = opts.seed != null ? seededRandom(opts.seed) : Math.random;
    const prices = [start];
    for (let i = 1; i < len; i++) {
      const eps = normalRandom(0, 1, rng);
      prices.push(prices[i - 1] * Math.exp(drift - 0.5 * vol * vol + vol * eps));
    }
    return prices;
  }

  /**
   * Convert a tick-level price series into OHLC bars.
   * Every `barSize` prices collapse into one bar.
   * @param {number[]} prices
   * @param {number} [barSize=5]
   * @returns {{open:number, high:number, low:number, close:number}[]}
   */
  function generateOHLC(prices, barSize) {
    barSize = barSize || 5;
    const bars = [];
    for (let i = 0; i < prices.length; i += barSize) {
      const chunk = prices.slice(i, i + barSize);
      bars.push({
        open: chunk[0],
        high: Math.max(...chunk),
        low: Math.min(...chunk),
        close: chunk[chunk.length - 1]
      });
    }
    return bars;
  }

  /**
   * Log returns from a price array.
   * @param {number[]} prices
   * @returns {number[]}
   */
  function returns(prices) {
    const r = [];
    for (let i = 1; i < prices.length; i++) {
      r.push(Math.log(prices[i] / prices[i - 1]));
    }
    return r;
  }

  /**
   * Cumulative returns (starting from 0).
   * @param {number[]} rets - simple or log returns
   * @returns {number[]}
   */
  function cumulativeReturns(rets) {
    const cr = [0];
    for (let i = 0; i < rets.length; i++) {
      cr.push(cr[i] + rets[i]);
    }
    return cr;
  }

  /**
   * Rolling mean with given window.
   * @param {number[]} arr
   * @param {number} window
   * @returns {number[]}  - length === arr.length, NaN-filled for early indices
   */
  function rollingMean(arr, window) {
    const out = new Array(arr.length).fill(NaN);
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i];
      if (i >= window) sum -= arr[i - window];
      if (i >= window - 1) out[i] = sum / window;
    }
    return out;
  }

  /**
   * Rolling standard deviation.
   * @param {number[]} arr
   * @param {number} window
   * @returns {number[]}
   */
  function rollingStd(arr, window) {
    const out = new Array(arr.length).fill(NaN);
    for (let i = window - 1; i < arr.length; i++) {
      const slice = arr.slice(i - window + 1, i + 1);
      out[i] = std(slice);
    }
    return out;
  }

  /**
   * Exponential moving average.
   * @param {number[]} arr
   * @param {number} span - EMA span (alpha = 2/(span+1))
   * @returns {number[]}
   */
  function exponentialMA(arr, span) {
    const alpha = 2 / (span + 1);
    const out = [arr[0]];
    for (let i = 1; i < arr.length; i++) {
      out.push(alpha * arr[i] + (1 - alpha) * out[i - 1]);
    }
    return out;
  }

  /**
   * Simple moving average (alias for rollingMean).
   * @param {number[]} arr
   * @param {number} window
   * @returns {number[]}
   */
  function simpleMA(arr, window) {
    return rollingMean(arr, window);
  }

  // ── 3. Strategy Signals ────────────────────

  /**
   * Momentum signal: +1 when price > price[i-lookback], else -1.
   * @param {number[]} prices
   * @param {number} [lookback=20]
   * @returns {number[]}  - signals array (same length, NaN-filled early)
   */
  function momentumSignal(prices, lookback) {
    lookback = lookback || 20;
    const sig = new Array(prices.length).fill(NaN);
    for (let i = lookback; i < prices.length; i++) {
      sig[i] = prices[i] > prices[i - lookback] ? 1 : -1;
    }
    return sig;
  }

  /**
   * Mean-reversion signal based on rolling z-score.
   * Buy (+1) when z < -threshold, sell (-1) when z > +threshold, else 0.
   * @param {number[]} prices
   * @param {number} [window=20]
   * @param {number} [threshold=1.5]
   * @returns {number[]}
   */
  function meanReversionSignal(prices, window, threshold) {
    window = window || 20;
    threshold = threshold ?? 1.5;
    const rm = rollingMean(prices, window);
    const rs = rollingStd(prices, window);
    const sig = new Array(prices.length).fill(NaN);
    for (let i = 0; i < prices.length; i++) {
      if (isNaN(rm[i]) || isNaN(rs[i]) || rs[i] === 0) continue;
      const z = (prices[i] - rm[i]) / rs[i];
      sig[i] = z < -threshold ? 1 : z > threshold ? -1 : 0;
    }
    return sig;
  }

  /**
   * Bollinger Bands.
   * @param {number[]} prices
   * @param {number} [window=20]
   * @param {number} [numStd=2]
   * @returns {{mid:number[], upper:number[], lower:number[]}}
   */
  function bollingerBands(prices, window, numStd) {
    window = window || 20;
    numStd = numStd ?? 2;
    const mid = rollingMean(prices, window);
    const rs = rollingStd(prices, window);
    const upper = mid.map((m, i) => (isNaN(m) ? NaN : m + numStd * rs[i]));
    const lower = mid.map((m, i) => (isNaN(m) ? NaN : m - numStd * rs[i]));
    return { mid, upper, lower };
  }

  /**
   * Relative Strength Index (RSI).
   * @param {number[]} prices
   * @param {number} [period=14]
   * @returns {number[]}
   */
  function rsi(prices, period) {
    period = period || 14;
    const out = new Array(prices.length).fill(NaN);
    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= period && i < prices.length; i++) {
      const delta = prices[i] - prices[i - 1];
      if (delta > 0) gainSum += delta; else lossSum -= delta;
    }
    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;
    if (period < prices.length) {
      out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    for (let i = period + 1; i < prices.length; i++) {
      const delta = prices[i] - prices[i - 1];
      const gain = delta > 0 ? delta : 0;
      const loss = delta < 0 ? -delta : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    return out;
  }

  /**
   * MACD — returns {macd, signal, histogram} arrays.
   * @param {number[]} prices
   * @param {number} [fast=12]
   * @param {number} [slow=26]
   * @param {number} [sigPeriod=9]
   * @returns {{macd:number[], signal:number[], histogram:number[]}}
   */
  function macdSignal(prices, fast, slow, sigPeriod) {
    fast = fast || 12;
    slow = slow || 26;
    sigPeriod = sigPeriod || 9;
    const emaFast = exponentialMA(prices, fast);
    const emaSlow = exponentialMA(prices, slow);
    const macdLine = emaFast.map((f, i) => f - emaSlow[i]);
    const signalLine = exponentialMA(macdLine, sigPeriod);
    const histogram = macdLine.map((m, i) => m - signalLine[i]);
    return { macd: macdLine, signal: signalLine, histogram };
  }

  /**
   * Pair spread — ratio or difference of two price series.
   * @param {number[]} pricesA
   * @param {number[]} pricesB
   * @param {'ratio'|'difference'} [mode='ratio']
   * @returns {number[]}
   */
  function pairSpread(pricesA, pricesB, mode) {
    mode = mode || 'ratio';
    const n = Math.min(pricesA.length, pricesB.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(mode === 'ratio' ? pricesA[i] / pricesB[i] : pricesA[i] - pricesB[i]);
    }
    return out;
  }

  // ── 4. Portfolio / Backtest ─────────────────

  /**
   * Backtest a signal series against prices.
   * Signals: +1 long, -1 short, 0 flat. Aligned to same indices as prices.
   * @param {number[]} prices
   * @param {number[]} signals
   * @param {number} [tradingCost=0.001] - one-way cost per trade
   * @returns {{returns:number[], cumulative:number[], positions:number[]}}
   */
  function backtestStrategy(prices, signals, tradingCost) {
    tradingCost = tradingCost ?? 0.001;
    const logRets = returns(prices);
    const stRets = [];
    const positions = [];
    let prevPos = 0;
    for (let i = 0; i < logRets.length; i++) {
      const pos = isNaN(signals[i]) ? 0 : signals[i];
      const cost = Math.abs(pos - prevPos) * tradingCost;
      stRets.push(pos * logRets[i] - cost);
      positions.push(pos);
      prevPos = pos;
    }
    return {
      returns: stRets,
      cumulative: cumulativeReturns(stRets),
      positions
    };
  }

  /**
   * Annualized Sharpe ratio.
   * @param {number[]} rets - period returns
   * @param {number} [periodsPerYear=252]
   * @param {number} [riskFreeRate=0]
   * @returns {number}
   */
  function sharpeRatio(rets, periodsPerYear, riskFreeRate) {
    periodsPerYear = periodsPerYear || 252;
    riskFreeRate = riskFreeRate || 0;
    const rfPeriod = riskFreeRate / periodsPerYear;
    const excess = rets.map(r => r - rfPeriod);
    const m = mean(excess);
    const s = std(excess);
    return s === 0 ? 0 : (m / s) * Math.sqrt(periodsPerYear);
  }

  /**
   * Annualized Sortino ratio (downside deviation only).
   * @param {number[]} rets
   * @param {number} [periodsPerYear=252]
   * @param {number} [riskFreeRate=0]
   * @returns {number}
   */
  function sortinoRatio(rets, periodsPerYear, riskFreeRate) {
    periodsPerYear = periodsPerYear || 252;
    riskFreeRate = riskFreeRate || 0;
    const rfPeriod = riskFreeRate / periodsPerYear;
    const excess = rets.map(r => r - rfPeriod);
    const m = mean(excess);
    const downside = excess.filter(r => r < 0);
    if (!downside.length) return m > 0 ? Infinity : 0;
    const ds = Math.sqrt(mean(downside.map(d => d * d)));
    return ds === 0 ? 0 : (m / ds) * Math.sqrt(periodsPerYear);
  }

  /** Max drawdown (positive number). @param {number[]} rets @returns {number} */
  function maxDrawdown(rets) {
    const dd = drawdownSeries(rets);
    let worst = 0;
    for (let i = 0; i < dd.length; i++) if (dd[i] < worst) worst = dd[i];
    return -worst;
  }

  /** Drawdown series (non-positive). @param {number[]} rets @returns {number[]} */
  function drawdownSeries(rets) {
    const cum = cumulativeReturns(rets);
    const dd = [];
    let peak = -Infinity;
    for (let i = 0; i < cum.length; i++) {
      if (cum[i] > peak) peak = cum[i];
      dd.push(cum[i] - peak);
    }
    return dd;
  }

  /** Calmar ratio. @param {number[]} rets @param {number} [periodsPerYear=252] @returns {number} */
  function calmarRatio(rets, periodsPerYear) {
    periodsPerYear = periodsPerYear || 252;
    const mdd = maxDrawdown(rets);
    return mdd === 0 ? 0 : (mean(rets) * periodsPerYear) / mdd;
  }

  /** Win rate — fraction of positive returns. @param {number[]} rets @returns {number} */
  function winRate(rets) {
    if (!rets.length) return 0;
    let w = 0;
    for (let i = 0; i < rets.length; i++) if (rets[i] > 0) w++;
    return w / rets.length;
  }

  /** Profit factor — gross profit / gross loss. @param {number[]} rets @returns {number} */
  function profitFactor(rets) {
    let g = 0, l = 0;
    for (let i = 0; i < rets.length; i++) {
      if (rets[i] > 0) g += rets[i]; else l -= rets[i];
    }
    return l === 0 ? Infinity : g / l;
  }

  /** Turnover — avg abs position change. @param {number[]} positions @returns {number} */
  function turnover(positions) {
    if (positions.length < 2) return 0;
    let t = 0;
    for (let i = 1; i < positions.length; i++) t += Math.abs(positions[i] - positions[i - 1]);
    return t / (positions.length - 1);
  }

  // ── 5. Risk ────────────────────────────────

  /**
   * Value at Risk.
   * @param {number[]} rets
   * @param {number} [confidence=0.95]
   * @param {'historical'|'parametric'} [method='historical']
   * @returns {number} - positive number representing loss threshold
   */
  function valueAtRisk(rets, confidence, method) {
    confidence = confidence ?? 0.95;
    method = method || 'historical';
    if (method === 'parametric') {
      const m = mean(rets);
      const s = std(rets);
      // z-value for left tail
      const z = -normalQuantile(1 - confidence);
      return -(m - z * s);
    }
    // historical
    return -percentile(rets, (1 - confidence) * 100);
  }

  /**
   * Approximate inverse normal CDF (rational approximation).
   * @param {number} p - probability in (0,1)
   * @returns {number}
   */
  function normalQuantile(p) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    if (p < 0.5) return -normalQuantile(1 - p);
    // Abramowitz & Stegun 26.2.23 approximation for upper half
    const t = Math.sqrt(-2 * Math.log(1 - p));
    const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
    const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
    return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
  }

  /**
   * Expected Shortfall (CVaR) — mean of losses beyond VaR.
   * @param {number[]} rets
   * @param {number} [confidence=0.95]
   * @returns {number}
   */
  function expectedShortfall(rets, confidence) {
    confidence = confidence ?? 0.95;
    const sorted = rets.slice().sort((a, b) => a - b);
    const cutoff = Math.floor(sorted.length * (1 - confidence));
    if (cutoff <= 0) return -sorted[0];
    const tail = sorted.slice(0, cutoff);
    return -mean(tail);
  }

  /**
   * Rolling beta of asset returns vs benchmark returns.
   * @param {number[]} assetRets
   * @param {number[]} benchRets
   * @param {number} [window=60]
   * @returns {number[]}
   */
  function rollingBeta(assetRets, benchRets, window) {
    window = window || 60;
    const n = Math.min(assetRets.length, benchRets.length);
    const out = new Array(n).fill(NaN);
    for (let i = window - 1; i < n; i++) {
      const aSlice = assetRets.slice(i - window + 1, i + 1);
      const bSlice = benchRets.slice(i - window + 1, i + 1);
      const cov = covariance(aSlice, bSlice);
      const v = variance(bSlice);
      out[i] = v === 0 ? 0 : cov / v;
    }
    return out;
  }

  /**
   * OLS hedge ratio (beta) of Y on X.
   * @param {number[]} y
   * @param {number[]} x
   * @returns {number}
   */
  function hedgeRatio(y, x) {
    const v = variance(x);
    return v === 0 ? 0 : covariance(y, x) / v;
  }

  /**
   * NxN correlation matrix for an array of series.
   * @param {number[][]} seriesArr - array of equal-length return arrays
   * @returns {number[][]}
   */
  function correlationMatrix(seriesArr) {
    const n = seriesArr.length;
    const mat = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      mat[i][i] = 1;
      for (let j = i + 1; j < n; j++) {
        const c = correlation(seriesArr[i], seriesArr[j]);
        mat[i][j] = c;
        mat[j][i] = c;
      }
    }
    return mat;
  }

  // ── 6. Data Generation ─────────────────────

  /**
   * Generate two cointegrated price series (mean-reverting spread).
   * @param {object} opts
   * @param {number} [opts.length=252]
   * @param {number} [opts.correlation=0.85]
   * @param {number} [opts.startA=100]
   * @param {number} [opts.startB=100]
   * @param {number} [opts.vol=0.02]
   * @param {number} [opts.seed]
   * @returns {{seriesA:number[], seriesB:number[]}}
   */
  function generateCorrelatedPairs(opts) {
    opts = opts || {};
    const len = opts.length || 252;
    const rho = opts.correlation ?? 0.85;
    const vol = opts.vol ?? 0.02;
    const rng = opts.seed != null ? seededRandom(opts.seed) : Math.random;
    const a = [opts.startA || 100];
    const b = [opts.startB || 100];
    for (let i = 1; i < len; i++) {
      const e1 = normalRandom(0, 1, rng);
      const e2 = rho * e1 + Math.sqrt(1 - rho * rho) * normalRandom(0, 1, rng);
      a.push(a[i - 1] * Math.exp(vol * e1));
      b.push(b[i - 1] * Math.exp(vol * e2));
    }
    return { seriesA: a, seriesB: b };
  }

  /**
   * Generate data with alternating trending and mean-reverting regimes.
   * @param {object} opts
   * @param {number} [opts.length=500]
   * @param {number} [opts.regimeLength=50]
   * @param {number} [opts.seed]
   * @returns {{prices:number[], regimes:string[]}}
   */
  function generateMomentumData(opts) {
    opts = opts || {};
    const len = opts.length || 500;
    const regLen = opts.regimeLength || 50;
    const rng = opts.seed != null ? seededRandom(opts.seed) : Math.random;
    const prices = [100];
    const regimes = ['trend'];
    let regime = 'trend';
    let meanLevel = 100;

    for (let i = 1; i < len; i++) {
      if (i % regLen === 0) {
        regime = regime === 'trend' ? 'revert' : 'trend';
        meanLevel = prices[i - 1];
      }
      regimes.push(regime);
      const eps = normalRandom(0, 1, rng);
      if (regime === 'trend') {
        const drift = 0.001 * (rng() > 0.5 ? 1 : -1);
        prices.push(prices[i - 1] * Math.exp(drift + 0.015 * eps));
      } else {
        const pull = 0.05 * (meanLevel - prices[i - 1]) / prices[i - 1];
        prices.push(prices[i - 1] * Math.exp(pull + 0.01 * eps));
      }
    }
    return { prices, regimes };
  }

  /**
   * Generate a synthetic order book snapshot.
   * @param {object} opts
   * @param {number} [opts.midPrice=100]
   * @param {number} [opts.levels=10]
   * @param {number} [opts.spread=0.05]
   * @param {number} [opts.seed]
   * @returns {{bids:{price:number, size:number}[], asks:{price:number, size:number}[]}}
   */
  function generateOrderBook(opts) {
    opts = opts || {};
    const mid = opts.midPrice || 100;
    const levels = opts.levels || 10;
    const spread = opts.spread ?? 0.05;
    const rng = opts.seed != null ? seededRandom(opts.seed) : Math.random;
    const bids = [];
    const asks = [];
    for (let i = 0; i < levels; i++) {
      const offset = spread * (i + 0.5);
      bids.push({
        price: +(mid - offset).toFixed(4),
        size: Math.round(50 + rng() * 200)
      });
      asks.push({
        price: +(mid + offset).toFixed(4),
        size: Math.round(50 + rng() * 200)
      });
    }
    return { bids, asks };
  }

  // ── 7. Visualization Helpers ────────────────

  /**
   * Standard palette for strategy visualizations.
   */
  const STRATEGY_COLORS = Object.freeze({
    profit:    '#00e676',
    loss:      '#ff1744',
    bullish:   '#26a69a',
    bearish:   '#ef5350',
    long:      '#00bcd4',
    short:     '#ff9800',
    neutral:   '#78909c',
    signal:    '#ffeb3b',
    benchmark: '#9e9e9e',
    ma1:       '#42a5f5',
    ma2:       '#ab47bc',
    band:      'rgba(255,235,59,0.15)',
    grid:      'rgba(255,255,255,0.06)',
    text:      '#e0e0e0',
    bg:        '#121212',
    panel:     '#1e1e1e'
  });

  /**
   * Map a price change direction to a color string.
   * @param {number} current
   * @param {number} previous
   * @returns {string}
   */
  function priceToColor(current, previous) {
    if (current > previous) return STRATEGY_COLORS.bullish;
    if (current < previous) return STRATEGY_COLORS.bearish;
    return STRATEGY_COLORS.neutral;
  }

  /**
   * Draw a single candlestick on a 2D canvas context.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} bar - {open, high, low, close}
   * @param {number} x       - center x pixel
   * @param {number} width   - candle body width in pixels
   * @param {(price:number)=>number} yScale - maps price to y pixel
   */
  function drawCandlestick(ctx, bar, x, width, yScale) {
    const bullish = bar.close >= bar.open;
    const color = bullish ? STRATEGY_COLORS.bullish : STRATEGY_COLORS.bearish;
    const bodyTop = yScale(bullish ? bar.close : bar.open);
    const bodyBot = yScale(bullish ? bar.open : bar.close);
    const bodyH = Math.max(bodyBot - bodyTop, 1);

    // wick
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yScale(bar.high));
    ctx.lineTo(x, yScale(bar.low));
    ctx.stroke();

    // body
    ctx.fillStyle = bullish ? 'rgba(38,166,154,0.85)' : 'rgba(239,83,80,0.85)';
    ctx.fillRect(x - width / 2, bodyTop, width, bodyH);
    ctx.strokeStyle = color;
    ctx.strokeRect(x - width / 2, bodyTop, width, bodyH);
  }

  /**
   * Format a number as currency string.
   * @param {number} value
   * @param {number} [decimals=2]
   * @param {string} [symbol='$']
   * @returns {string}
   */
  function formatCurrency(value, decimals, symbol) {
    decimals = decimals ?? 2;
    symbol = symbol ?? '$';
    const sign = value < 0 ? '-' : '';
    return sign + symbol + Math.abs(value).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * Format a number as a percentage string.
   * @param {number} value - e.g. 0.0532 for 5.32%
   * @param {number} [decimals=2]
   * @returns {string}
   */
  function formatPercent(value, decimals) {
    decimals = decimals ?? 2;
    return (value * 100).toFixed(decimals) + '%';
  }

  // ── Public API ──────────────────────────────
  return {
    seededRandom, normalRandom, mean, std, variance,
    covariance, correlation, percentile, zscore,
    generatePriceSeries, generateOHLC, returns, cumulativeReturns,
    rollingMean, rollingStd, exponentialMA, simpleMA,
    momentumSignal, meanReversionSignal, bollingerBands,
    rsi, macdSignal, pairSpread,
    backtestStrategy, sharpeRatio, sortinoRatio,
    maxDrawdown, drawdownSeries, calmarRatio,
    winRate, profitFactor, turnover,
    valueAtRisk, expectedShortfall, rollingBeta,
    hedgeRatio, correlationMatrix,
    generateCorrelatedPairs, generateMomentumData, generateOrderBook,
    priceToColor, STRATEGY_COLORS, drawCandlestick,
    formatCurrency, formatPercent
  };
})();
