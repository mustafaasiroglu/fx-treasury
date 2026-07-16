// Decision Engine — generates HOLD / PUBLISH / SMOOTH_STEP decisions every 10s

const { generateRates, updateClientRate, getClientRate, getClientSpread } = require('./rateEngine');

// Late-bind tickStore to avoid circular dependency
let tickStore = null;
function getTickStore() {
  if (!tickStore) tickStore = require('./tickStore');
  return tickStore;
}

let decisions = {}; // keyed by pair
let decisionCounter = 0;
let decisionHistory = { USDTRY: [], EURTRY: [] };
let lastClientRateUpdate = { USDTRY: Date.now(), EURTRY: Date.now() };

// Tunable agent parameters
let agentParams = {
  holdThreshold: 0.002,       // Gap below this → HOLD (tighter = more responsive)
  smoothStepThreshold: 0.008, // Gap above this → SMOOTH_STEP
  publishProbability: 0.85,   // High probability of PUBLISH in middle zone
  smoothStepFactor: 0.75,     // Close 75% of gap on smooth-step
  publishFactor: 0.95,        // Close 95% of gap on publish
  spreadMultiplierMin: 0.9,   // Min spread multiplier vs market spread
  spreadMultiplierMax: 1.1,   // Max spread multiplier vs market spread
  autoAcceptThresholdMs: 15000, // Auto-accept after 15s
};

const AUTO_ACCEPT_THRESHOLD_MS = agentParams.autoAcceptThresholdMs;

const DECISION_TYPES = ['HOLD', 'PUBLISH', 'SMOOTH_STEP'];
const REASONS = {
  HOLD: [
    'Market volatility within acceptable range',
    'No significant order pressure change',
    'Spread remains stable',
  ],
  PUBLISH: [
    'Market momentum persistent',
    'Order pressure skewed to buy-side',
    'Significant deviation detected between market and client rate',
  ],
  SMOOTH_STEP: [
    'Gradual adjustment recommended due to large gap',
    'Smooth transition to reduce execution risk',
    'Step-wise convergence to market rate',
  ],
};

function generateDecision(pair = 'USDTRY') {
  const rates = generateRates(pair);
  const clientMid = getClientRate(pair);
  const clientSpread = getClientSpread(pair);
  const gap = rates.median - clientMid;
  const absGap = Math.abs(gap);

  let type;
  if (absGap < agentParams.holdThreshold) {
    type = 'HOLD';
  } else if (absGap > agentParams.smoothStepThreshold) {
    type = 'SMOOTH_STEP';
  } else {
    // Mix of publish and hold based on randomness
    type = Math.random() < agentParams.publishProbability ? 'PUBLISH' : 'HOLD';
  }

  const suggestedMid = type === 'HOLD'
    ? clientMid
    : +(clientMid + gap * (type === 'SMOOTH_STEP' ? agentParams.smoothStepFactor : agentParams.publishFactor)).toFixed(4);

  // Agent also suggests a spread (may tighten or widen based on volatility)
  const marketSpread = rates.marketAsk - rates.marketBid;
  const suggestedSpread = type === 'HOLD'
    ? clientSpread
    : +(marketSpread * (agentParams.spreadMultiplierMin + Math.random() * (agentParams.spreadMultiplierMax - agentParams.spreadMultiplierMin))).toFixed(4);

  const suggestedBid = +(suggestedMid - suggestedSpread / 2).toFixed(4);
  const suggestedAsk = +(suggestedMid + suggestedSpread / 2).toFixed(4);

  const nextTarget = type === 'SMOOTH_STEP'
    ? +(clientMid + gap * 0.75).toFixed(4)
    : null;

  decisionCounter++;
  const decision = {
    id: `DEC-${decisionCounter.toString().padStart(4, '0')}`,
    pair,
    timestamp: Date.now(),
    type,
    currentMarketRate: rates.median,
    currentMarketBid: rates.marketBid,
    currentMarketAsk: rates.marketAsk,
    currentClientRate: clientMid,
    currentClientBid: +(clientMid - clientSpread / 2).toFixed(4),
    currentClientAsk: +(clientMid + clientSpread / 2).toFixed(4),
    suggestedClientRate: suggestedMid,
    suggestedClientBid: suggestedBid,
    suggestedClientAsk: suggestedAsk,
    suggestedSpread,
    nextTarget,
    confidence: absGap > 0.01 ? 'High' : absGap > 0.005 ? 'Medium' : 'Low',
    reasons: REASONS[type].slice(0, 2),
    impact: {
      revenue: +(Math.random() * 4 - 1).toFixed(1), // -1% to +3%
      conversion: +(Math.random() * -2).toFixed(1),  // 0 to -2%
      executionRisk: absGap > 0.015 ? 'Medium' : 'Low',
    },
    status: 'pending', // pending | accepted | rejected
  };

  decisions[pair] = decision;
  if (!decisionHistory[pair]) decisionHistory[pair] = [];
  decisionHistory[pair].push(decision);
  // Keep last 50
  if (decisionHistory[pair].length > 50) decisionHistory[pair].shift();

  // Push agent suggestion to tick store for chart visibility
  if (type !== 'HOLD') {
    getTickStore().setAgentSuggestion(pair, suggestedMid, suggestedAsk, suggestedBid);
  }

  return decision;
}

function getLatestDecision(pair = 'USDTRY') {
  return decisions[pair] || null;
}

function acceptDecision(id) {
  for (const pair of Object.keys(decisions)) {
    if (decisions[pair] && decisions[pair].id === id) {
      decisions[pair].status = 'accepted';
      updateClientRate(pair, decisions[pair].suggestedClientRate, decisions[pair].suggestedSpread);
      lastClientRateUpdate[pair] = Date.now();
      return decisions[pair];
    }
  }
  // Check history
  for (const pair of Object.keys(decisionHistory)) {
    const found = decisionHistory[pair].find(d => d.id === id);
    if (found) {
      found.status = 'accepted';
      updateClientRate(pair, found.suggestedClientRate, found.suggestedSpread);
      lastClientRateUpdate[pair] = Date.now();
      return found;
    }
  }
  return null;
}

function rejectDecision(id) {
  for (const pair of Object.keys(decisions)) {
    if (decisions[pair] && decisions[pair].id === id) {
      decisions[pair].status = 'rejected';
      return decisions[pair];
    }
  }
  for (const pair of Object.keys(decisionHistory)) {
    const found = decisionHistory[pair].find(d => d.id === id);
    if (found) {
      found.status = 'rejected';
      return found;
    }
  }
  return null;
}

function getDecisionHistory(pair = 'USDTRY') {
  return decisionHistory[pair] || [];
}

// Auto-generate decisions every 5 seconds for both pairs
setInterval(() => { generateDecision('USDTRY'); }, 5000);
setInterval(() => { generateDecision('EURTRY'); }, 5000);

// Auto-accept: if client rate hasn't been updated for configured threshold, accept latest pending decision
setInterval(() => {
  const now = Date.now();
  for (const pair of ['USDTRY', 'EURTRY']) {
    const elapsed = now - (lastClientRateUpdate[pair] || 0);
    if (elapsed >= agentParams.autoAcceptThresholdMs) {
      const latest = decisions[pair];
      if (latest && latest.status === 'pending' && latest.type !== 'HOLD') {
        latest.status = 'auto-accepted';
        updateClientRate(pair, latest.suggestedClientRate, latest.suggestedSpread);
        lastClientRateUpdate[pair] = now;
        getTickStore().onClientRateUpdate(pair, latest.suggestedClientRate, latest.suggestedSpread);
        getTickStore().clearAgentSuggestion(pair);
        console.log(`[AutoAccept] ${pair} — ${latest.id} auto-accepted (${elapsed}ms since last update)`);
      }
    }
  }
}, 5000); // check every 5s

// Generate initial decisions
generateDecision('USDTRY');
generateDecision('EURTRY');

function getAgentParams() {
  return { ...agentParams };
}

function updateAgentParams(newParams) {
  for (const key of Object.keys(newParams)) {
    if (key in agentParams && typeof newParams[key] === 'number') {
      agentParams[key] = newParams[key];
    }
  }
  return { ...agentParams };
}

module.exports = {
  generateDecision,
  getLatestDecision,
  acceptDecision,
  rejectDecision,
  getDecisionHistory,
  getAgentParams,
  updateAgentParams,
};
