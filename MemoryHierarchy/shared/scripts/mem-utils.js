/**
 * mem-utils.js — 存储层级工具集
 * Cache模拟、地址解析、页表、TLB、一致性协议辅助
 */

/* roundRect polyfill for older browsers */
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

const MemUtils = (() => {
    'use strict';

    /* ===== 1. Color Constants ===== */
    const COLORS = {
        green: '#16c79a', blue: '#4fc3f7', purple: '#b388ff',
        orange: '#ffab40', red: '#ff5252', yellow: '#ffd740', pink: '#ff80ab',
        cyan: '#80deea',
        bg: '#1a1a2e', bgSec: '#16213e', bgCard: '#0f3460',
        textPri: '#e8e8e8', textSec: '#a8a8b8', textMut: '#6c6c7c',
        border: '#2a2a4a',
        // Memory hierarchy colors
        register: '#ff80ab',
        l1Cache: '#ff5252',
        l2Cache: '#ffab40',
        l3Cache: '#ffd740',
        mainMem: '#4fc3f7',
        disk: '#b388ff',
        // Cache state colors
        hit: '#16c79a',
        miss: '#ff5252',
        evict: '#ffab40',
        dirty: '#ff80ab',
        // MESI protocol colors
        modified: '#ff5252',
        exclusive: '#16c79a',
        shared: '#4fc3f7',
        invalid: '#6c6c7c',
    };

    /* ===== 2. Memory Hierarchy Levels ===== */
    const HIERARCHY = [
        { name: '寄存器', eng: 'Registers', size: '~1 KB', latency: '< 1 ns', color: COLORS.register },
        { name: 'L1 Cache', eng: 'L1 Cache', size: '32-64 KB', latency: '~1 ns', color: COLORS.l1Cache },
        { name: 'L2 Cache', eng: 'L2 Cache', size: '256 KB-1 MB', latency: '~3-10 ns', color: COLORS.l2Cache },
        { name: 'L3 Cache', eng: 'L3 Cache', size: '4-64 MB', latency: '~10-30 ns', color: COLORS.l3Cache },
        { name: '主存', eng: 'Main Memory', size: '4-128 GB', latency: '~50-100 ns', color: COLORS.mainMem },
        { name: '磁盘/SSD', eng: 'Disk/SSD', size: '256 GB-4 TB', latency: '~0.1-10 ms', color: COLORS.disk },
    ];

    /* ===== 3. Address Parsing ===== */
    function parseAddress(addr, tagBits, indexBits, offsetBits) {
        const totalBits = tagBits + indexBits + offsetBits;
        const tag = (addr >>> (indexBits + offsetBits)) & ((1 << tagBits) - 1);
        const index = (addr >>> offsetBits) & ((1 << indexBits) - 1);
        const offset = addr & ((1 << offsetBits) - 1);
        return { tag, index, offset, totalBits };
    }

    function addressToBinary(addr, bits) {
        return (addr >>> 0).toString(2).padStart(bits, '0');
    }

    function calcCacheBits(cacheSize, blockSize, associativity) {
        const numBlocks = cacheSize / blockSize;
        const numSets = numBlocks / associativity;
        const offsetBits = Math.log2(blockSize);
        const indexBits = Math.log2(numSets);
        const tagBits = 32 - indexBits - offsetBits; // assume 32-bit address
        return { offsetBits, indexBits, tagBits, numSets, numBlocks };
    }

    /* ===== 4. Cache Simulation ===== */
    function createCache(numSets, associativity, blockSize) {
        const sets = [];
        for (let i = 0; i < numSets; i++) {
            const ways = [];
            for (let j = 0; j < associativity; j++) {
                ways.push({ valid: false, dirty: false, tag: -1, data: null, lruCounter: 0 });
            }
            sets.push(ways);
        }

        const stats = { accesses: 0, hits: 0, misses: 0, evictions: 0, writebacks: 0 };
        const offsetBits = Math.log2(blockSize);
        const indexBits = Math.log2(numSets);
        const tagBits = 32 - indexBits - offsetBits;

        function access(addr, isWrite, writePolicy) {
            stats.accesses++;
            const { tag, index } = parseAddress(addr, tagBits, indexBits, offsetBits);
            const set = sets[index];

            // Check for hit
            for (let i = 0; i < set.length; i++) {
                if (set[i].valid && set[i].tag === tag) {
                    stats.hits++;
                    // Update LRU
                    const hitCounter = set[i].lruCounter;
                    for (let j = 0; j < set.length; j++) {
                        if (set[j].lruCounter > hitCounter) set[j].lruCounter--;
                    }
                    set[i].lruCounter = set.length - 1;
                    if (isWrite && writePolicy === 'write-back') {
                        set[i].dirty = true;
                    }
                    return { hit: true, evicted: false, tag, index, way: i };
                }
            }

            // Miss
            stats.misses++;
            let victimWay = -1;
            let evictedTag = -1;
            let writeback = false;

            // Find empty way or LRU victim
            for (let i = 0; i < set.length; i++) {
                if (!set[i].valid) { victimWay = i; break; }
            }
            if (victimWay === -1) {
                // LRU eviction
                let minLru = Infinity;
                for (let i = 0; i < set.length; i++) {
                    if (set[i].lruCounter < minLru) {
                        minLru = set[i].lruCounter;
                        victimWay = i;
                    }
                }
                evictedTag = set[victimWay].tag;
                if (set[victimWay].dirty) {
                    stats.writebacks++;
                    writeback = true;
                }
                stats.evictions++;
            }

            // Install new block
            const evicted = set[victimWay].valid;
            set[victimWay].valid = true;
            set[victimWay].tag = tag;
            set[victimWay].dirty = isWrite && writePolicy === 'write-back';
            // Update LRU counters
            for (let j = 0; j < set.length; j++) {
                if (j !== victimWay && set[j].valid) set[j].lruCounter--;
            }
            set[victimWay].lruCounter = set.length - 1;

            return { hit: false, evicted, evictedTag, writeback, tag, index, way: victimWay };
        }

        function reset() {
            for (const set of sets) {
                for (const way of set) {
                    way.valid = false;
                    way.dirty = false;
                    way.tag = -1;
                    way.lruCounter = 0;
                }
            }
            stats.accesses = 0;
            stats.hits = 0;
            stats.misses = 0;
            stats.evictions = 0;
            stats.writebacks = 0;
        }

        return {
            access,
            reset,
            getSets: () => sets.map(s => s.map(w => ({ ...w }))),
            getStats: () => ({ ...stats }),
            getConfig: () => ({ numSets, associativity, blockSize, offsetBits, indexBits, tagBits }),
        };
    }

    /* ===== 5. Replacement Policies ===== */
    function createReplacementPolicy(type, size) {
        if (type === 'lru') {
            const order = [];
            return {
                access(item) {
                    const idx = order.indexOf(item);
                    if (idx !== -1) order.splice(idx, 1);
                    order.push(item);
                },
                getVictim() { return order.length >= size ? order[0] : null; },
                evict() { return order.shift(); },
                getOrder: () => [...order],
            };
        }
        if (type === 'fifo') {
            const queue = [];
            return {
                access(item) {
                    if (!queue.includes(item)) queue.push(item);
                },
                getVictim() { return queue.length >= size ? queue[0] : null; },
                evict() { return queue.shift(); },
                getOrder: () => [...queue],
            };
        }
        if (type === 'random') {
            const items = [];
            return {
                access(item) {
                    if (!items.includes(item)) items.push(item);
                },
                getVictim() {
                    return items.length >= size ? items[Math.floor(Math.random() * items.length)] : null;
                },
                evict() {
                    const idx = Math.floor(Math.random() * items.length);
                    return items.splice(idx, 1)[0];
                },
                getOrder: () => [...items],
            };
        }
        return null;
    }

    /* ===== 6. Page Table Simulation ===== */
    function createPageTable(numPages, pageSize) {
        const entries = [];
        for (let i = 0; i < numPages; i++) {
            entries.push({
                valid: false,
                frame: -1,
                dirty: false,
                referenced: false,
                protection: 'rwx',
            });
        }
        let nextFrame = 0;

        function translate(virtualAddr) {
            const pageBits = Math.log2(pageSize);
            const vpn = virtualAddr >>> pageBits;
            const offset = virtualAddr & (pageSize - 1);

            if (vpn >= numPages) return { fault: true, reason: 'invalid VPN' };
            const entry = entries[vpn];
            if (!entry.valid) {
                return { fault: true, vpn, offset, reason: 'page fault' };
            }
            entry.referenced = true;
            const physAddr = (entry.frame << pageBits) | offset;
            return { fault: false, vpn, offset, frame: entry.frame, physAddr };
        }

        function loadPage(vpn, frame) {
            if (frame === undefined) frame = nextFrame++;
            entries[vpn].valid = true;
            entries[vpn].frame = frame;
            entries[vpn].referenced = false;
            entries[vpn].dirty = false;
        }

        function evictPage(vpn) {
            const wasDirty = entries[vpn].dirty;
            entries[vpn].valid = false;
            entries[vpn].frame = -1;
            return wasDirty;
        }

        return {
            translate,
            loadPage,
            evictPage,
            getEntries: () => entries.map(e => ({ ...e })),
            getPageBits: () => Math.log2(pageSize),
        };
    }

    /* ===== 7. TLB Simulation ===== */
    function createTLB(numEntries, associativity) {
        const sets = numEntries / associativity;
        const tlb = [];
        for (let i = 0; i < sets; i++) {
            const ways = [];
            for (let j = 0; j < associativity; j++) {
                ways.push({ valid: false, vpn: -1, frame: -1, lruCounter: 0 });
            }
            tlb.push(ways);
        }

        const stats = { accesses: 0, hits: 0, misses: 0 };

        function lookup(vpn) {
            stats.accesses++;
            const setIdx = vpn % sets;
            const set = tlb[setIdx];

            for (let i = 0; i < set.length; i++) {
                if (set[i].valid && set[i].vpn === vpn) {
                    stats.hits++;
                    // Update LRU
                    const hitC = set[i].lruCounter;
                    for (let j = 0; j < set.length; j++) {
                        if (set[j].lruCounter > hitC) set[j].lruCounter--;
                    }
                    set[i].lruCounter = set.length - 1;
                    return { hit: true, frame: set[i].frame, setIdx, way: i };
                }
            }

            stats.misses++;
            return { hit: false, setIdx };
        }

        function insert(vpn, frame) {
            const setIdx = vpn % sets;
            const set = tlb[setIdx];

            // Find empty or LRU
            let way = -1;
            for (let i = 0; i < set.length; i++) {
                if (!set[i].valid) { way = i; break; }
            }
            if (way === -1) {
                let minLru = Infinity;
                for (let i = 0; i < set.length; i++) {
                    if (set[i].lruCounter < minLru) { minLru = set[i].lruCounter; way = i; }
                }
            }

            set[way].valid = true;
            set[way].vpn = vpn;
            set[way].frame = frame;
            for (let j = 0; j < set.length; j++) {
                if (j !== way && set[j].valid) set[j].lruCounter--;
            }
            set[way].lruCounter = set.length - 1;
        }

        function flush() {
            for (const set of tlb) {
                for (const way of set) {
                    way.valid = false;
                    way.vpn = -1;
                    way.frame = -1;
                    way.lruCounter = 0;
                }
            }
            stats.accesses = 0;
            stats.hits = 0;
            stats.misses = 0;
        }

        return {
            lookup,
            insert,
            flush,
            getSets: () => tlb.map(s => s.map(w => ({ ...w }))),
            getStats: () => ({ ...stats }),
        };
    }

    /* ===== 8. MESI Protocol Simulation ===== */
    const MESI_STATES = ['M', 'E', 'S', 'I'];
    const MESI_COLORS = {
        'M': COLORS.modified,
        'E': COLORS.exclusive,
        'S': COLORS.shared,
        'I': COLORS.invalid,
    };
    const MESI_NAMES = {
        'M': 'Modified',
        'E': 'Exclusive',
        'S': 'Shared',
        'I': 'Invalid',
    };

    function createMESIProtocol(numCores) {
        // Each core has a simple cache line state
        const cacheLines = {};  // address -> array of states per core
        const log = [];

        function getStates(addr) {
            if (!cacheLines[addr]) {
                cacheLines[addr] = new Array(numCores).fill('I');
            }
            return cacheLines[addr];
        }

        function read(core, addr) {
            const states = getStates(addr);
            const current = states[core];
            const entry = { action: 'read', core, addr, before: [...states], busAction: null };

            if (current === 'M' || current === 'E' || current === 'S') {
                // Hit
                entry.result = 'hit';
            } else {
                // Miss (I state)
                const othersHave = states.some((s, i) => i !== core && (s === 'M' || s === 'E' || s === 'S'));
                if (othersHave) {
                    // Someone else has it
                    for (let i = 0; i < numCores; i++) {
                        if (i !== core) {
                            if (states[i] === 'M') {
                                entry.busAction = 'BusRd → flush (M→S)';
                                states[i] = 'S';
                            } else if (states[i] === 'E') {
                                states[i] = 'S';
                            }
                        }
                    }
                    states[core] = 'S';
                } else {
                    states[core] = 'E';
                }
                entry.result = 'miss';
                if (!entry.busAction) entry.busAction = 'BusRd';
            }

            entry.after = [...states];
            log.push(entry);
            return entry;
        }

        function write(core, addr) {
            const states = getStates(addr);
            const current = states[core];
            const entry = { action: 'write', core, addr, before: [...states], busAction: null };

            if (current === 'M') {
                entry.result = 'hit';
            } else if (current === 'E') {
                states[core] = 'M';
                entry.result = 'hit';
            } else if (current === 'S') {
                entry.busAction = 'BusRdX (invalidate others)';
                for (let i = 0; i < numCores; i++) {
                    if (i !== core) states[i] = 'I';
                }
                states[core] = 'M';
                entry.result = 'hit';
            } else {
                // Invalid
                entry.busAction = 'BusRdX';
                for (let i = 0; i < numCores; i++) {
                    if (i !== core) {
                        if (states[i] === 'M') {
                            entry.busAction = 'BusRdX → flush (M→I)';
                        }
                        states[i] = 'I';
                    }
                }
                states[core] = 'M';
                entry.result = 'miss';
            }

            entry.after = [...states];
            log.push(entry);
            return entry;
        }

        function reset() {
            for (const addr in cacheLines) delete cacheLines[addr];
            log.length = 0;
        }

        return {
            read, write, reset,
            getStates,
            getLog: () => [...log],
        };
    }

    /* ===== 9. AMAT Calculator ===== */
    function calcAMAT(hitTime, missRate, missPenalty) {
        return hitTime + missRate * missPenalty;
    }

    function calcMultiLevelAMAT(levels) {
        // levels: [{hitTime, missRate}], last level is main memory access time
        let amat = levels[0].hitTime;
        let accumulatedMissRate = 1;
        for (let i = 0; i < levels.length; i++) {
            if (i === 0) {
                amat = levels[0].hitTime;
                accumulatedMissRate = levels[0].missRate;
            } else {
                amat += accumulatedMissRate * levels[i].hitTime;
                accumulatedMissRate *= levels[i].missRate;
            }
        }
        return amat;
    }

    /* ===== 10. Canvas Drawing Helpers ===== */
    function initCanvas(canvas, height) {
        const dpr = window.devicePixelRatio || 1;
        const parent = canvas.parentElement;
        const w = parent ? parent.getBoundingClientRect().width : canvas.clientWidth;
        const h = height || 400;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        return { ctx, w, h, dpr };
    }

    function drawMemoryBlock(ctx, x, y, w, h, label, color, opts = {}) {
        ctx.save();
        ctx.fillStyle = opts.fill || hexToRgba(color, 0.15);
        ctx.strokeStyle = color;
        ctx.lineWidth = opts.highlight ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, opts.radius || 4);
        ctx.fill();
        ctx.stroke();
        if (opts.highlight) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        ctx.fillStyle = opts.textColor || color;
        ctx.font = opts.font || `bold ${Math.min(12, h * 0.45)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + w / 2, y + h / 2);
        ctx.restore();
    }

    function drawHierarchyLevel(ctx, x, y, w, h, level, opts = {}) {
        const color = level.color;
        ctx.save();
        ctx.fillStyle = hexToRgba(color, opts.highlight ? 0.25 : 0.1);
        ctx.strokeStyle = color;
        ctx.lineWidth = opts.highlight ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();
        ctx.stroke();
        // Label
        ctx.fillStyle = color;
        ctx.font = 'bold 13px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(level.name, x + w / 2, y + h / 2 - 8);
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = COLORS.textMut;
        ctx.fillText(level.size + ' | ' + level.latency, x + w / 2, y + h / 2 + 10);
        ctx.restore();
    }

    function drawArrow(ctx, x1, y1, x2, y2, color, opts = {}) {
        const headLen = opts.headLen || 8;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        ctx.save();
        ctx.strokeStyle = color || COLORS.blue;
        ctx.fillStyle = color || COLORS.blue;
        ctx.lineWidth = opts.width || 2;
        if (opts.dashed) ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    /* ===== 11. Seeded Random ===== */
    function seededRandom(seed) {
        let s = seed;
        return () => {
            s = (s * 16807 + 0) % 2147483647;
            return (s - 1) / 2147483646;
        };
    }

    /* ===== Public API ===== */
    return {
        COLORS, HIERARCHY,
        MESI_STATES, MESI_COLORS, MESI_NAMES,
        // Address parsing
        parseAddress, addressToBinary, calcCacheBits,
        // Cache
        createCache, createReplacementPolicy,
        // Page table
        createPageTable,
        // TLB
        createTLB,
        // MESI
        createMESIProtocol,
        // AMAT
        calcAMAT, calcMultiLevelAMAT,
        // Canvas
        initCanvas, drawMemoryBlock, drawHierarchyLevel, drawArrow, hexToRgba,
        // Random
        seededRandom,
    };
})();
