// roundRect polyfill for older browsers
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'number') r = [r, r, r, r];
        const [tl, tr, br, bl] = r;
        this.moveTo(x + tl, y);
        this.arcTo(x + w, y, x + w, y + h, tr);
        this.arcTo(x + w, y + h, x, y + h, br);
        this.arcTo(x, y + h, x, y, bl);
        this.arcTo(x, y, x + w, y, tl);
    };
}

/**
 * factor-utils.js — Factor Models Utility Library
 *
 * Pure utility functions for factor model computations,
 * portfolio math, time-series generation, and visualization helpers.
 */
const FactorUtils = (() => {
    'use strict';

    // =========================================================================
    //  1. Random / Math
    // =========================================================================

    /**
     * Seeded pseudo-random number generator (Mulberry32).
     * @param {number} seed — integer seed
     * @returns {function(): number} — returns values in [0, 1)
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
     * Generate a standard-normal variate using the Box-Muller transform.
     * Optionally accepts a uniform RNG (defaults to Math.random).
     * @param {function(): number} [rng=Math.random]
     * @returns {number}
     */
    function normalRandom(rng) {
        const u = (rng || Math.random);
        const u1 = u();
        const u2 = u();
        return Math.sqrt(-2 * Math.log(u1 || 1e-15)) * Math.cos(2 * Math.PI * u2);
    }

    /**
     * Arithmetic mean of an array.
     * @param {number[]} arr
     * @returns {number}
     */
    function mean(arr) {
        if (!arr.length) return 0;
        let s = 0;
        for (let i = 0; i < arr.length; i++) s += arr[i];
        return s / arr.length;
    }

    /**
     * Population variance of an array.
     * @param {number[]} arr
     * @returns {number}
     */
    function variance(arr) {
        const m = mean(arr);
        let s = 0;
        for (let i = 0; i < arr.length; i++) s += (arr[i] - m) * (arr[i] - m);
        return s / arr.length;
    }

    /**
     * Population standard deviation.
     * @param {number[]} arr
     * @returns {number}
     */
    function std(arr) {
        return Math.sqrt(variance(arr));
    }

    /**
     * Sample covariance between two arrays of equal length.
     * Uses N-1 denominator (sample covariance).
     * @param {number[]} x
     * @param {number[]} y
     * @returns {number}
     */
    function covariance(x, y) {
        const n = Math.min(x.length, y.length);
        if (n < 2) return 0;
        const mx = mean(x);
        const my = mean(y);
        let s = 0;
        for (let i = 0; i < n; i++) s += (x[i] - mx) * (y[i] - my);
        return s / (n - 1);
    }

    /**
     * Pearson correlation coefficient.
     * @param {number[]} x
     * @param {number[]} y
     * @returns {number}
     */
    function correlation(x, y) {
        const c = covariance(x, y);
        const sx = std(x);
        const sy = std(y);
        if (sx === 0 || sy === 0) return 0;
        // covariance uses N-1, std uses N — adjust
        const n = Math.min(x.length, y.length);
        const factor = n / (n - 1);
        return c / (sx * sy * factor);
    }

    /**
     * Ordinary Least Squares simple linear regression: y = alpha + beta * x.
     * @param {number[]} x — independent variable
     * @param {number[]} y — dependent variable
     * @returns {{ alpha: number, beta: number, r2: number, residuals: number[] }}
     */
    function linearRegression(x, y) {
        const n = Math.min(x.length, y.length);
        const mx = mean(x);
        const my = mean(y);
        let ssxy = 0, ssxx = 0;
        for (let i = 0; i < n; i++) {
            ssxy += (x[i] - mx) * (y[i] - my);
            ssxx += (x[i] - mx) * (x[i] - mx);
        }
        const beta = ssxx === 0 ? 0 : ssxy / ssxx;
        const alpha = my - beta * mx;

        const residuals = [];
        let ssRes = 0, ssTot = 0;
        for (let i = 0; i < n; i++) {
            const pred = alpha + beta * x[i];
            const r = y[i] - pred;
            residuals.push(r);
            ssRes += r * r;
            ssTot += (y[i] - my) * (y[i] - my);
        }
        const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
        return { alpha, beta, r2, residuals };
    }

    // =========================================================================
    //  2. Portfolio Math
    // =========================================================================

    /**
     * Weighted portfolio return.
     * @param {number[]} weights — portfolio weights (should sum to 1)
     * @param {number[]} returns — asset returns
     * @returns {number}
     */
    function portfolioReturn(weights, returns) {
        let r = 0;
        for (let i = 0; i < weights.length; i++) r += weights[i] * (returns[i] || 0);
        return r;
    }

    /**
     * Portfolio variance given weights and a covariance matrix.
     * @param {number[]} weights
     * @param {number[][]} covMatrix — NxN covariance matrix
     * @returns {number}
     */
    function portfolioVariance(weights, covMatrix) {
        const n = weights.length;
        let v = 0;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                v += weights[i] * weights[j] * covMatrix[i][j];
            }
        }
        return v;
    }

    /**
     * Annualised Sharpe ratio.
     * @param {number[]} returns — array of period returns
     * @param {number} [rf=0] — risk-free rate per period
     * @param {number} [annualFactor=252] — periods per year
     * @returns {number}
     */
    function sharpeRatio(returns, rf, annualFactor) {
        rf = rf || 0;
        annualFactor = annualFactor || 252;
        const excess = returns.map(r => r - rf);
        const m = mean(excess);
        const s = std(excess);
        if (s === 0) return 0;
        return (m / s) * Math.sqrt(annualFactor);
    }

    /**
     * Tracking error: annualised standard deviation of active returns.
     * @param {number[]} portfolioReturns
     * @param {number[]} benchmarkReturns
     * @param {number} [annualFactor=252]
     * @returns {number}
     */
    function trackingError(portfolioReturns, benchmarkReturns, annualFactor) {
        annualFactor = annualFactor || 252;
        const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
        const active = [];
        for (let i = 0; i < n; i++) active.push(portfolioReturns[i] - benchmarkReturns[i]);
        return std(active) * Math.sqrt(annualFactor);
    }

    /**
     * Information ratio: annualised active return / tracking error.
     * @param {number[]} portfolioReturns
     * @param {number[]} benchmarkReturns
     * @param {number} [annualFactor=252]
     * @returns {number}
     */
    function informationRatio(portfolioReturns, benchmarkReturns, annualFactor) {
        annualFactor = annualFactor || 252;
        const n = Math.min(portfolioReturns.length, benchmarkReturns.length);
        const active = [];
        for (let i = 0; i < n; i++) active.push(portfolioReturns[i] - benchmarkReturns[i]);
        const te = std(active) * Math.sqrt(annualFactor);
        if (te === 0) return 0;
        const annualActive = mean(active) * annualFactor;
        return annualActive / te;
    }

    /**
     * Maximum drawdown from a series of period returns.
     * @param {number[]} returns — array of period returns
     * @returns {number} — maximum drawdown as a positive fraction (e.g. 0.25 = 25%)
     */
    function maxDrawdown(returns) {
        let peak = 1;
        let cumulative = 1;
        let mdd = 0;
        for (let i = 0; i < returns.length; i++) {
            cumulative *= (1 + returns[i]);
            if (cumulative > peak) peak = cumulative;
            const dd = (peak - cumulative) / peak;
            if (dd > mdd) mdd = dd;
        }
        return mdd;
    }

    // =========================================================================
    //  3. Factor Model
    // =========================================================================

    /**
     * Expected return under CAPM.
     * @param {number} rf — risk-free rate
     * @param {number} beta — asset beta
     * @param {number} marketPremium — E[Rm] - Rf
     * @returns {number}
     */
    function capmReturn(rf, beta, marketPremium) {
        return rf + beta * marketPremium;
    }

    /**
     * Multiple OLS regression: regress asset returns on K factor return series.
     * Returns factor betas (loadings), alpha (intercept), and R-squared.
     *
     * Uses normal equations: beta = (X'X)^-1 X'y  where X includes intercept column.
     *
     * @param {number[]} assetReturns — T-length array
     * @param {number[][]} factorReturns — array of K arrays, each T-length
     * @returns {{ betas: number[], alpha: number, r2: number }}
     */
    function factorExposure(assetReturns, factorReturns) {
        const T = assetReturns.length;
        const K = factorReturns.length;

        // Build X matrix (T x (K+1)), first column is intercept
        // Solve via normal equations with simple Gaussian elimination

        const cols = K + 1;
        // Compute X'X  (cols x cols)
        const XtX = [];
        for (let i = 0; i < cols; i++) {
            XtX[i] = [];
            for (let j = 0; j < cols; j++) {
                let s = 0;
                for (let t = 0; t < T; t++) {
                    const xi = i === 0 ? 1 : factorReturns[i - 1][t];
                    const xj = j === 0 ? 1 : factorReturns[j - 1][t];
                    s += xi * xj;
                }
                XtX[i][j] = s;
            }
        }
        // Compute X'y  (cols x 1)
        const Xty = [];
        for (let i = 0; i < cols; i++) {
            let s = 0;
            for (let t = 0; t < T; t++) {
                const xi = i === 0 ? 1 : factorReturns[i - 1][t];
                s += xi * assetReturns[t];
            }
            Xty[i] = s;
        }

        // Gaussian elimination to solve XtX * b = Xty
        const A = XtX.map((row, i) => [...row, Xty[i]]);
        const n = cols;
        for (let col = 0; col < n; col++) {
            // Partial pivoting
            let maxRow = col;
            for (let row = col + 1; row < n; row++) {
                if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
            }
            [A[col], A[maxRow]] = [A[maxRow], A[col]];
            if (Math.abs(A[col][col]) < 1e-12) continue;
            const pivot = A[col][col];
            for (let j = col; j <= n; j++) A[col][j] /= pivot;
            for (let row = 0; row < n; row++) {
                if (row === col) continue;
                const f = A[row][col];
                for (let j = col; j <= n; j++) A[row][j] -= f * A[col][j];
            }
        }
        const b = A.map(row => row[n]);

        const alpha = b[0];
        const betas = b.slice(1);

        // R-squared
        const my = mean(assetReturns);
        let ssRes = 0, ssTot = 0;
        for (let t = 0; t < T; t++) {
            let pred = alpha;
            for (let k = 0; k < K; k++) pred += betas[k] * factorReturns[k][t];
            ssRes += (assetReturns[t] - pred) * (assetReturns[t] - pred);
            ssTot += (assetReturns[t] - my) * (assetReturns[t] - my);
        }
        const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

        return { betas, alpha, r2 };
    }

    /**
     * Construct asset covariance matrix from a factor model:
     *   Sigma = B * F * B' + D
     * where B is (N x K) loadings, F is (K x K) factor covariance, D is diagonal specific risk.
     *
     * @param {number[][]} loadings — N x K matrix of factor loadings
     * @param {number[][]} factorCov — K x K factor covariance matrix
     * @param {number[]} specificVar — N-length array of specific (idiosyncratic) variances
     * @returns {number[][]} — N x N asset covariance matrix
     */
    function factorCovariance(loadings, factorCov, specificVar) {
        const N = loadings.length;
        const K = factorCov.length;

        // BF = B * F  (N x K)
        const BF = [];
        for (let i = 0; i < N; i++) {
            BF[i] = [];
            for (let j = 0; j < K; j++) {
                let s = 0;
                for (let k = 0; k < K; k++) s += loadings[i][k] * factorCov[k][j];
                BF[i][j] = s;
            }
        }

        // Sigma = BF * B' + D  (N x N)
        const sigma = [];
        for (let i = 0; i < N; i++) {
            sigma[i] = [];
            for (let j = 0; j < N; j++) {
                let s = 0;
                for (let k = 0; k < K; k++) s += BF[i][k] * loadings[j][k];
                sigma[i][j] = s + (i === j ? (specificVar[i] || 0) : 0);
            }
        }
        return sigma;
    }

    // =========================================================================
    //  4. Time Series
    // =========================================================================

    /**
     * Generate synthetic market returns as a random walk with drift.
     * @param {number} T — number of periods
     * @param {number} [annualDrift=0.08] — annual drift (expected return)
     * @param {number} [annualVol=0.16] — annual volatility
     * @param {number} [periodsPerYear=252] — trading days per year
     * @param {function} [rng] — optional seeded RNG
     * @returns {number[]}
     */
    function generateMarketReturns(T, annualDrift, annualVol, periodsPerYear, rng) {
        annualDrift = annualDrift !== undefined ? annualDrift : 0.08;
        annualVol = annualVol !== undefined ? annualVol : 0.16;
        periodsPerYear = periodsPerYear || 252;
        const mu = annualDrift / periodsPerYear;
        const sigma = annualVol / Math.sqrt(periodsPerYear);
        const returns = [];
        for (let t = 0; t < T; t++) {
            returns.push(mu + sigma * normalRandom(rng));
        }
        return returns;
    }

    /**
     * Generate correlated factor returns for size, value, momentum, profitability, investment.
     * Uses Cholesky decomposition to introduce correlations.
     *
     * @param {number} T — number of periods
     * @param {object} [opts]
     * @param {number} [opts.periodsPerYear=252]
     * @param {function} [opts.rng] — optional seeded RNG
     * @returns {{ market: number[], size: number[], value: number[], momentum: number[], profitability: number[], investment: number[] }}
     */
    function generateFactorReturns(T, opts) {
        opts = opts || {};
        const ppy = opts.periodsPerYear || 252;
        const rng = opts.rng;

        // Annual parameters: [market, size, value, momentum, profitability, investment]
        const names = ['market', 'size', 'value', 'momentum', 'profitability', 'investment'];
        const annualMu = [0.08, 0.02, 0.03, 0.06, 0.03, 0.03];
        const annualSig = [0.16, 0.10, 0.10, 0.14, 0.08, 0.08];
        const K = names.length;

        // Correlation matrix (approximate empirical)
        const corr = [
            [1.00,  0.20, -0.15, -0.10,  0.10,  0.05],
            [0.20,  1.00,  0.10, -0.05,  0.00,  0.10],
            [-0.15, 0.10,  1.00, -0.30,  0.15,  0.20],
            [-0.10,-0.05, -0.30,  1.00, -0.10, -0.10],
            [0.10,  0.00,  0.15, -0.10,  1.00,  0.30],
            [0.05,  0.10,  0.20, -0.10,  0.30,  1.00],
        ];

        // Cholesky decomposition of correlation matrix
        const L = choleskyDecomp(corr);

        // Per-period parameters
        const mu = annualMu.map(m => m / ppy);
        const sig = annualSig.map(s => s / Math.sqrt(ppy));

        // Generate T periods of K independent normals, then correlate
        const result = {};
        names.forEach(n => { result[n] = []; });

        for (let t = 0; t < T; t++) {
            // Independent normals
            const z = [];
            for (let k = 0; k < K; k++) z.push(normalRandom(rng));
            // Correlate: x = L * z
            for (let k = 0; k < K; k++) {
                let v = 0;
                for (let j = 0; j <= k; j++) v += L[k][j] * z[j];
                result[names[k]].push(mu[k] + sig[k] * v);
            }
        }
        return result;
    }

    /**
     * Cholesky decomposition of a positive-definite symmetric matrix.
     * Returns lower-triangular matrix L such that A = L * L'.
     * @param {number[][]} A
     * @returns {number[][]}
     */
    function choleskyDecomp(A) {
        const n = A.length;
        const L = Array.from({ length: n }, () => new Array(n).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j <= i; j++) {
                let s = 0;
                for (let k = 0; k < j; k++) s += L[i][k] * L[j][k];
                if (i === j) {
                    L[i][j] = Math.sqrt(Math.max(0, A[i][i] - s));
                } else {
                    L[i][j] = L[j][j] === 0 ? 0 : (A[i][j] - s) / L[j][j];
                }
            }
        }
        return L;
    }

    /**
     * Convert period returns to cumulative return series (starting at 1).
     * @param {number[]} returns
     * @returns {number[]} — array of length returns.length + 1
     */
    function cumulativeReturns(returns) {
        const cum = [1];
        for (let i = 0; i < returns.length; i++) {
            cum.push(cum[i] * (1 + returns[i]));
        }
        return cum;
    }

    /**
     * Rolling mean with a given window size.
     * @param {number[]} arr
     * @param {number} window
     * @returns {number[]} — array of length arr.length, first (window-1) entries are NaN
     */
    function rollingMean(arr, window) {
        const out = [];
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
            sum += arr[i];
            if (i >= window) sum -= arr[i - window];
            if (i >= window - 1) {
                out.push(sum / window);
            } else {
                out.push(NaN);
            }
        }
        return out;
    }

    /**
     * Rolling standard deviation with a given window size.
     * @param {number[]} arr
     * @param {number} window
     * @returns {number[]} — array of length arr.length, first (window-1) entries are NaN
     */
    function rollingStd(arr, window) {
        const out = [];
        for (let i = 0; i < arr.length; i++) {
            if (i < window - 1) {
                out.push(NaN);
                continue;
            }
            const slice = arr.slice(i - window + 1, i + 1);
            out.push(std(slice));
        }
        return out;
    }

    // =========================================================================
    //  5. Data Generation
    // =========================================================================

    /**
     * Generate N synthetic stocks with random betas, factor exposures, and return series.
     *
     * @param {number} N — number of stocks
     * @param {number} T — number of time periods
     * @param {object} [opts]
     * @param {number} [opts.seed=42] — random seed
     * @param {number} [opts.periodsPerYear=252]
     * @returns {{ stocks: Array<{ name: string, beta: number, exposures: { size: number, value: number, momentum: number, profitability: number, investment: number }, returns: number[] }>, factorData: object }}
     */
    function generateStocks(N, T, opts) {
        opts = opts || {};
        const seed = opts.seed !== undefined ? opts.seed : 42;
        const ppy = opts.periodsPerYear || 252;
        const rng = seededRandom(seed);

        // Generate factor returns first
        const factorData = generateFactorReturns(T, { periodsPerYear: ppy, rng: rng });
        const factorNames = ['size', 'value', 'momentum', 'profitability', 'investment'];

        const stocks = [];
        for (let i = 0; i < N; i++) {
            const name = 'Stock_' + String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : '');

            // Random market beta: centered around 1, range ~[0.3, 1.8]
            const beta = 0.3 + rng() * 1.5;

            // Random factor exposures: each in ~[-0.5, 0.5]
            const exposures = {};
            for (const fn of factorNames) {
                exposures[fn] = (rng() - 0.5) * 1.0;
            }

            // Specific risk (annualised): 15% to 40%
            const specificVol = (0.15 + rng() * 0.25) / Math.sqrt(ppy);

            // Generate returns: r_i = alpha_i + beta * market + sum(exposure_k * factor_k) + epsilon
            const alpha = ((rng() - 0.5) * 0.04) / ppy; // small daily alpha
            const returns = [];
            for (let t = 0; t < T; t++) {
                let r = alpha + beta * factorData.market[t];
                for (const fn of factorNames) {
                    r += exposures[fn] * factorData[fn][t];
                }
                r += specificVol * normalRandom(rng);
                returns.push(r);
            }

            stocks.push({ name, beta, exposures, returns });
        }

        return { stocks, factorData };
    }

    /**
     * Generate T periods of factor return data (wrapper around generateFactorReturns
     * that also returns summary statistics).
     *
     * @param {number} T — number of periods
     * @param {object} [opts]
     * @param {number} [opts.seed=123]
     * @param {number} [opts.periodsPerYear=252]
     * @returns {{ returns: object, stats: object }}
     */
    function generateFactorData(T, opts) {
        opts = opts || {};
        const seed = opts.seed !== undefined ? opts.seed : 123;
        const ppy = opts.periodsPerYear || 252;
        const rng = seededRandom(seed);
        const returns = generateFactorReturns(T, { periodsPerYear: ppy, rng: rng });

        const factorNames = Object.keys(returns);
        const stats = {};
        for (const name of factorNames) {
            const r = returns[name];
            stats[name] = {
                annualReturn: mean(r) * ppy,
                annualVol: std(r) * Math.sqrt(ppy),
                sharpe: sharpeRatio(r, 0, ppy),
                maxDrawdown: maxDrawdown(r),
                count: r.length,
            };
        }

        return { returns, stats };
    }

    // =========================================================================
    //  6. Visualization Helpers
    // =========================================================================

    /**
     * Map a value to a diverging blue-white-red colour.
     * @param {number} value — the value to map
     * @param {number} [minVal=-1] — value that maps to pure blue
     * @param {number} [maxVal=1] — value that maps to pure red
     * @returns {string} — CSS rgb() colour string
     */
    function valueToColor(value, minVal, maxVal) {
        minVal = minVal !== undefined ? minVal : -1;
        maxVal = maxVal !== undefined ? maxVal : 1;
        // Normalise to [-1, 1]
        const range = maxVal - minVal;
        let t = range === 0 ? 0 : (value - minVal) / range * 2 - 1;
        t = Math.max(-1, Math.min(1, t));

        let r, g, b;
        if (t < 0) {
            // Blue to white
            const s = -t;
            r = Math.round(255 * (1 - s) + 66 * s);
            g = Math.round(255 * (1 - s) + 133 * s);
            b = Math.round(255 * (1 - s) + 244 * s);
        } else {
            // White to red
            const s = t;
            r = Math.round(255 * (1 - s) + 239 * s);
            g = Math.round(255 * (1 - s) + 71 * s);
            b = Math.round(255 * (1 - s) + 111 * s);
        }
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    /**
     * Canonical colour palette for factor names.
     * @type {Object<string, string>}
     */
    const FACTOR_COLORS = {
        market:        '#6366f1', // indigo
        size:          '#f59e0b', // amber
        value:         '#10b981', // emerald
        momentum:      '#ef4444', // red
        profitability: '#8b5cf6', // violet
        investment:    '#06b6d4', // cyan
        alpha:         '#f97316', // orange
        residual:      '#6b7280', // grey
        benchmark:     '#94a3b8', // slate
        portfolio:     '#3b82f6', // blue
    };

    /**
     * Draw an axis line with tick marks and labels on a canvas.
     *
     * @param {CanvasRenderingContext2D} ctx
     * @param {object} opts
     * @param {number} opts.x — pixel x of axis origin
     * @param {number} opts.y — pixel y of axis origin
     * @param {number} opts.length — pixel length of the axis
     * @param {'horizontal'|'vertical'} opts.direction
     * @param {number} opts.min — data minimum
     * @param {number} opts.max — data maximum
     * @param {number} [opts.ticks=5] — number of ticks
     * @param {string} [opts.color='#94a3b8']
     * @param {string} [opts.label] — axis label
     * @param {function} [opts.format] — tick label formatter
     */
    function drawAxis(ctx, opts) {
        const {
            x, y, length, direction, min, max,
            ticks: tickCount = 5,
            color = '#94a3b8',
            label = '',
            format = v => v.toFixed(2),
        } = opts;

        const isH = direction === 'horizontal';

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1;
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = isH ? 'top' : 'middle';

        // Main axis line
        ctx.beginPath();
        if (isH) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + length, y);
        } else {
            ctx.moveTo(x, y);
            ctx.lineTo(x, y - length);
        }
        ctx.stroke();

        // Ticks
        const step = (max - min) / (tickCount - 1 || 1);
        for (let i = 0; i < tickCount; i++) {
            const val = min + step * i;
            const frac = (max - min) === 0 ? 0 : (val - min) / (max - min);
            let tx, ty;
            if (isH) {
                tx = x + frac * length;
                ty = y;
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(tx, ty + 4);
                ctx.stroke();
                ctx.fillText(format(val), tx, ty + 6);
            } else {
                tx = x;
                ty = y - frac * length;
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(tx - 4, ty);
                ctx.stroke();
                ctx.textAlign = 'right';
                ctx.fillText(format(val), tx - 6, ty);
            }
        }

        // Label
        if (label) {
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            if (isH) {
                ctx.fillText(label, x + length / 2, y + 22);
            } else {
                ctx.save();
                ctx.translate(x - 36, y - length / 2);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(label, 0, 0);
                ctx.restore();
            }
        }

        ctx.restore();
    }

    /**
     * Format a number as a percentage string.
     * @param {number} value — fraction (e.g. 0.05 for 5%)
     * @param {number} [digits=2] — decimal places
     * @returns {string}
     */
    function formatPercent(value, digits) {
        digits = digits !== undefined ? digits : 2;
        return (value * 100).toFixed(digits) + '%';
    }

    /**
     * Format a number with fixed decimal places.
     * @param {number} value
     * @param {number} [digits=2]
     * @returns {string}
     */
    function formatNumber(value, digits) {
        digits = digits !== undefined ? digits : 2;
        return value.toFixed(digits);
    }

    // =========================================================================
    //  Public API
    // =========================================================================

    return {
        // Random / Math
        seededRandom,
        normalRandom,
        mean,
        std,
        variance,
        covariance,
        correlation,
        linearRegression,

        // Portfolio Math
        portfolioReturn,
        portfolioVariance,
        sharpeRatio,
        informationRatio,
        trackingError,
        maxDrawdown,

        // Factor Model
        capmReturn,
        factorExposure,
        factorCovariance,

        // Time Series
        generateMarketReturns,
        generateFactorReturns,
        cumulativeReturns,
        rollingMean,
        rollingStd,

        // Data Generation
        generateStocks,
        generateFactorData,

        // Visualization Helpers
        valueToColor,
        FACTOR_COLORS,
        drawAxis,
        formatPercent,
        formatNumber,
    };
})();
