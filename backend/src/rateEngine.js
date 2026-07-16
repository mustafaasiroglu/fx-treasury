// FX Rate Engine — GBM-based realistic spot simulation for USD/TRY and EUR/TRY

const PAIRS = {
  USDTRY: { base: 46.45, volatility: 0.12, drift: 0.02, halfSpread: 0.0025, meanRevertStrength: 0.001 },
  EURTRY: { base: 53.24, volatility: 0.13, drift: 0.015, halfSpread: 0.003, meanRevertStrength: 0.001 },
};

// Per-pair state
const state = {
  USDTRY: { price: 46.45, lastTick: Date.now(), momentum: 0, clientMid: 46.45, clientSpread: 0.005, buyFlow: 50, sellFlow: 50, flowRegime: 0 },
  EURTRY: { price: 53.24, lastTick: Date.now(), momentum: 0, clientMid: 53.24, clientSpread: 0.006, buyFlow: 50, sellFlow: 50, flowRegime: 0 },
};

// Box-Muller transform for normal distribution
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function getFeedSpread(feedIndex, pairHalfSpread) {
  // Each feed has its own noise and spread characteristics
  const offset = (Math.random() - 0.5) * pairHalfSpread * 0.3;
  const spreadMultipliers = [1.0, 0.92, 1.08];
  const hs = pairHalfSpread * spreadMultipliers[feedIndex] * (0.95 + Math.random() * 0.1);
  return { offset, halfSpread: hs };
}

function generateRates(pair = 'USDTRY') {
  const config = PAIRS[pair] || PAIRS.USDTRY;
  const s = state[pair] || state.USDTRY;
  const now = Date.now();
  const dt = Math.min((now - s.lastTick) / 1000, 5); // seconds since last tick, cap at 5s
  s.lastTick = now;

  // Annualized params scaled to tick interval
  const dtYear = dt / (252 * 6.5 * 3600); // fraction of trading year
  const sigma = config.volatility;
  const mu = config.drift;

  // GBM increment with momentum (autocorrelation)
  const z = randn();
  const jumpProb = Math.random();
  const jump = jumpProb < 0.003 ? randn() * sigma * 3 * Math.sqrt(dtYear) : 0; // rare jumps

  // Momentum adds short-term trend persistence
  s.momentum = s.momentum * 0.85 + z * 0.15;
  const effectiveZ = z * 0.7 + s.momentum * 0.3;

  const dS = s.price * (mu * dtYear + sigma * Math.sqrt(dtYear) * effectiveZ) + jump * s.price;

  // Mean reversion toward base (prevents drift too far)
  const reversion = (config.base - s.price) * config.meanRevertStrength;

  s.price += dS + reversion;
  // Clamp within reasonable range (±3% from base)
  s.price = Math.max(config.base * 0.97, Math.min(config.base * 1.03, s.price));

  const median = s.price;

  // Dynamic spread — widens with momentum/volatility, narrows in calm
  const volatilityFactor = 1 + Math.abs(s.momentum) * 0.8 + Math.random() * 0.15;
  const dynamicHalfSpread = config.halfSpread * volatilityFactor;

  // 3 feeds around median — each with independent micro-noise
  const feeds = [0, 1, 2].map((idx) => {
    const names = ['Reuters', 'Bloomberg', 'Internal'];
    const { offset, halfSpread } = getFeedSpread(idx, dynamicHalfSpread);
    const mid = median + offset;
    return {
      name: names[idx],
      bid: +(mid - halfSpread).toFixed(4),
      ask: +(mid + halfSpread).toFixed(4),
      mid: +mid.toFixed(4),
    };
  });

  const marketAsk = +(median + dynamicHalfSpread).toFixed(4);
  const marketBid = +(median - dynamicHalfSpread).toFixed(4);

  // Order pressure — regime-based with smooth transitions
  // Regime shifts occasionally (mean-reverting random walk)
  s.flowRegime += randn() * 0.08;
  s.flowRegime *= 0.97; // mean-revert toward 0
  // Rare regime jumps (simulates large order hitting the book)
  if (Math.random() < 0.01) s.flowRegime += (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5);
  s.flowRegime = Math.max(-2, Math.min(2, s.flowRegime));

  // Target pressure based on regime + momentum correlation
  const regimeBias = s.flowRegime * 20;
  const momentumBias = Math.tanh(s.momentum) * 15;
  const targetBuy = 50 + regimeBias + momentumBias;
  const targetSell = 50 - regimeBias - momentumBias * 0.7;

  // Smooth flow toward target (EMA-like, simulates order accumulation)
  s.buyFlow = s.buyFlow * 0.92 + targetBuy * 0.08 + randn() * 2;
  s.sellFlow = s.sellFlow * 0.92 + targetSell * 0.08 + randn() * 2;

  const buyPressure = Math.round(Math.max(5, Math.min(95, s.buyFlow)));
  const sellPressure = Math.round(Math.max(5, Math.min(95, s.sellFlow)));

  return {
    pair,
    timestamp: now,
    feeds,
    median: +median.toFixed(4),
    marketBid,
    marketAsk,
    clientMid: +s.clientMid.toFixed(4),
    clientBid: +(s.clientMid - s.clientSpread / 2).toFixed(4),
    clientAsk: +(s.clientMid + s.clientSpread / 2).toFixed(4),
    clientSpread: +s.clientSpread.toFixed(4),
    orderPressure: { buy: buyPressure, sell: sellPressure },
  };
}

function updateClientRate(pair, newMid, newSpread) {
  if (state[pair]) {
    state[pair].clientMid = newMid;
    if (newSpread !== undefined) {
      state[pair].clientSpread = newSpread;
    }
  }
}

/**
 * Generate historical rate snapshots for the last N seconds (default 300 = 5min).
 * Uses seeded GBM simulation for realistic history.
 */
function generateHistory(pair = 'USDTRY', durationSec = 300, intervalMs = 2000) {
  const config = PAIRS[pair] || PAIRS.USDTRY;
  const s = state[pair] || state.USDTRY;
  const now = Date.now();
  const points = [];
  const count = Math.floor((durationSec * 1000) / intervalMs);

  // Seeded PRNG — stable within the same hour so refresh doesn't reset shape
  let seed = (now / 3600000 | 0) * 1000 + (pair === 'EURTRY' ? 7 : 3);
  function seededRand() {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 4294967296;
  }
  function seededRandn() {
    let u = 0, v = 0;
    while (u === 0) u = seededRand();
    while (v === 0) v = seededRand();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  const dtYear = (intervalMs / 1000) / (252 * 6.5 * 3600);
  let price = config.base * (0.995 + seededRand() * 0.01); // start near base
  let momentum = 0;
  let flowRegime = 0;
  let buyFlow = 50;
  let sellFlow = 50;

  for (let i = count; i >= 0; i--) {
    const ts = now - i * intervalMs;

    const z = seededRandn();
    const jumpProb = seededRand();
    const jump = jumpProb < 0.005 ? seededRandn() * config.volatility * 2.5 * Math.sqrt(dtYear) : 0;

    momentum = momentum * 0.82 + z * 0.18;
    const effectiveZ = z * 0.65 + momentum * 0.35;

    const dS = price * (config.drift * dtYear + config.volatility * Math.sqrt(dtYear) * effectiveZ) + jump * price;
    const reversion = (config.base - price) * config.meanRevertStrength * 2;
    price += dS + reversion;
    price = Math.max(config.base * 0.97, Math.min(config.base * 1.03, price));

    const median = price;

    // Dynamic spread for history
    const volFactor = 1 + Math.abs(momentum) * 0.8 + seededRand() * 0.15;
    const dynHalfSpread = config.halfSpread * volFactor;

    const feeds = [0, 1, 2].map((idx) => {
      const names = ['Reuters', 'Bloomberg', 'Internal'];
      const offset = (seededRand() - 0.5) * dynHalfSpread * 0.3;
      const hs = dynHalfSpread * [1.0, 0.92, 1.08][idx];
      const mid = median + offset;
      return {
        name: names[idx],
        bid: +(mid - hs).toFixed(4),
        ask: +(mid + hs).toFixed(4),
        mid: +mid.toFixed(4),
      };
    });

    const marketAsk = +(median + dynHalfSpread).toFixed(4);
    const marketBid = +(median - dynHalfSpread).toFixed(4);

    const pressureBias = Math.tanh(momentum) * 15;
    flowRegime += seededRandn() * 0.08;
    flowRegime *= 0.97;
    if (seededRand() < 0.01) flowRegime += (seededRand() > 0.5 ? 1 : -1) * 0.6;
    flowRegime = Math.max(-2, Math.min(2, flowRegime));
    const regimeBias = flowRegime * 20;
    buyFlow = buyFlow * 0.92 + (50 + regimeBias + pressureBias) * 0.08 + seededRandn() * 2;
    sellFlow = sellFlow * 0.92 + (50 - regimeBias - pressureBias * 0.7) * 0.08 + seededRandn() * 2;

    points.push({
      pair,
      timestamp: ts,
      feeds,
      median: +median.toFixed(4),
      marketBid,
      marketAsk,
      clientMid: +s.clientMid.toFixed(4),
      clientBid: +(s.clientMid - s.clientSpread / 2).toFixed(4),
      clientAsk: +(s.clientMid + s.clientSpread / 2).toFixed(4),
      clientSpread: +s.clientSpread.toFixed(4),
      orderPressure: {
        buy: Math.round(Math.max(5, Math.min(95, buyFlow))),
        sell: Math.round(Math.max(5, Math.min(95, sellFlow))),
      },
    });
  }

  // Set current state price to end of history for continuity
  state[pair].price = price;

  return points;
}

function getClientRate(pair) {
  return state[pair] ? state[pair].clientMid : PAIRS[pair]?.base || 46.45;
}

function getClientSpread(pair) {
  return state[pair] ? state[pair].clientSpread : PAIRS[pair]?.halfSpread * 2 || 0.005;
}

module.exports = { generateRates, generateHistory, updateClientRate, getClientRate, getClientSpread, PAIRS };
