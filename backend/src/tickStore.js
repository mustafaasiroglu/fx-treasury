// Tick Store — accumulates real rate ticks with client & agent data
// Serves history from in-memory buffer so frontend never shows blank on refresh

const { generateRates, generateHistory: generateSyntheticHistory, PAIRS } = require('./rateEngine');

const MAX_TICKS = 5000; // ~2.7 hours at 2s intervals

// Buffers keyed by pair
const tickBuffer = {
  USDTRY: [],
  EURTRY: [],
};

// Track latest agent suggestion per pair
const latestAgent = {
  USDTRY: null,
  EURTRY: null,
};

/**
 * Bootstrap: fill buffer with synthetic history so chart is never empty on startup/refresh.
 * Generates 5 minutes of realistic data with evolving client rate.
 */
function bootstrap() {
  for (const pair of ['USDTRY', 'EURTRY']) {
    const config = PAIRS[pair];
    const syntheticPoints = generateSyntheticHistory(pair, 300, 2000);

    // Simulate client rate evolution over history
    let clientMid = config.base;
    let clientSpread = config.halfSpread * 2;

    syntheticPoints.forEach((point, i) => {
      // Every ~30 ticks (60s), drift client toward market (simulating auto-accept behavior)
      if (i > 0 && i % 30 === 0) {
        const gap = point.median - clientMid;
        clientMid = +(clientMid + gap * 0.6).toFixed(4);
      }

      tickBuffer[pair].push({
        ...point,
        clientMid: +clientMid.toFixed(4),
        clientBid: +(clientMid - clientSpread / 2).toFixed(4),
        clientAsk: +(clientMid + clientSpread / 2).toFixed(4),
        clientSpread,
        agentMid: null,
        agentAsk: null,
        agentBid: null,
      });
    });
  }
}

/**
 * Record a live tick (called every polling interval from server)
 */
function recordTick(pair) {
  const rates = generateRates(pair);
  const agent = latestAgent[pair];

  const tick = {
    ...rates,
    agentMid: agent?.mid || null,
    agentAsk: agent?.ask || null,
    agentBid: agent?.bid || null,
  };

  // Clear agent after recording — it should only appear on one tick per decision
  if (agent) {
    latestAgent[pair] = null;
  }

  tickBuffer[pair].push(tick);

  // Trim to max size
  if (tickBuffer[pair].length > MAX_TICKS) {
    tickBuffer[pair] = tickBuffer[pair].slice(-MAX_TICKS);
  }

  return tick;
}

/**
 * Update agent suggestion (called when decision engine produces non-HOLD)
 */
function setAgentSuggestion(pair, mid, ask, bid) {
  latestAgent[pair] = { mid, ask, bid };
}

/**
 * Clear agent suggestion (after it's been shown for one tick)
 */
function clearAgentSuggestion(pair) {
  latestAgent[pair] = null;
}

/**
 * Update client rate in stored ticks going forward
 * Called when a decision is accepted
 */
function onClientRateUpdate(pair, newMid, newSpread) {
  // Future ticks will pick this up from rateEngine state
  // Mark last few ticks with the new client rate for visual continuity
  const buf = tickBuffer[pair];
  if (buf.length > 0) {
    const last = buf[buf.length - 1];
    last.clientMid = +newMid.toFixed(4);
    last.clientBid = +(newMid - newSpread / 2).toFixed(4);
    last.clientAsk = +(newMid + newSpread / 2).toFixed(4);
    last.clientSpread = +newSpread.toFixed(4);
  }
}

/**
 * Get history for a given range
 */
function getHistory(pair, rangeSec) {
  const buf = tickBuffer[pair] || [];
  if (buf.length === 0) return [];

  const now = Date.now();
  const cutoff = now - rangeSec * 1000;

  // Filter ticks within range
  const filtered = buf.filter(t => t.timestamp >= cutoff);

  // If range is large, downsample to keep payload reasonable
  const maxPoints = 500;
  if (filtered.length <= maxPoints) return filtered;

  // Downsample by taking every Nth point
  const step = Math.ceil(filtered.length / maxPoints);
  const downsampled = [];
  for (let i = 0; i < filtered.length; i += step) {
    downsampled.push(filtered[i]);
  }
  // Always include last point
  if (downsampled[downsampled.length - 1] !== filtered[filtered.length - 1]) {
    downsampled.push(filtered[filtered.length - 1]);
  }
  return downsampled;
}

// Bootstrap on module load
bootstrap();

// Start recording ticks every 2 seconds
setInterval(() => {
  recordTick('USDTRY');
  recordTick('EURTRY');
}, 2000);

module.exports = {
  recordTick,
  getHistory,
  setAgentSuggestion,
  clearAgentSuggestion,
  onClientRateUpdate,
};
