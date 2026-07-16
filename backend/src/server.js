const express = require('express');
const cors = require('cors');
const { generateRates, generateHistory } = require('./rateEngine');
const {
  getLatestDecision,
  acceptDecision,
  rejectDecision,
  getDecisionHistory,
  getAgentParams,
  updateAgentParams,
} = require('./decisionEngine');
const { generateOrderBook } = require('./orderBookEngine');
const { getHistory, setAgentSuggestion, clearAgentSuggestion, onClientRateUpdate } = require('./tickStore');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// GET /api/rates?pair=USDTRY
app.get('/api/rates', (req, res) => {
  const pair = (req.query.pair || 'USDTRY').toUpperCase();
  if (!['USDTRY', 'EURTRY'].includes(pair)) {
    return res.status(400).json({ error: 'Invalid pair. Use USDTRY or EURTRY.' });
  }
  res.json(generateRates(pair));
});

// GET /api/rates/history?pair=USDTRY&range=5m — historical data from tick store
const RANGE_MAP = { '5m': 300, '15m': 900, '1h': 3600, '24h': 86400, '7d': 604800 };
app.get('/api/rates/history', (req, res) => {
  const pair = (req.query.pair || 'USDTRY').toUpperCase();
  if (!['USDTRY', 'EURTRY'].includes(pair)) {
    return res.status(400).json({ error: 'Invalid pair. Use USDTRY or EURTRY.' });
  }
  const rangeSec = RANGE_MAP[req.query.range] || 300;
  res.json(getHistory(pair, rangeSec));
});

// GET /api/decision?pair=USDTRY
app.get('/api/decision', (req, res) => {
  const pair = (req.query.pair || 'USDTRY').toUpperCase();
  const decision = getLatestDecision(pair);
  res.json(decision || { type: 'HOLD', pair, message: 'No decision yet' });
});

// GET /api/decisions/history?pair=USDTRY
app.get('/api/decisions/history', (req, res) => {
  const pair = (req.query.pair || 'USDTRY').toUpperCase();
  res.json(getDecisionHistory(pair));
});

// POST /api/decision/:id/accept
app.post('/api/decision/:id/accept', (req, res) => {
  const result = acceptDecision(req.params.id);
  if (!result) return res.status(404).json({ error: 'Decision not found' });
  // Propagate to tick store
  onClientRateUpdate(result.pair, result.suggestedClientRate, result.suggestedSpread);
  res.json(result);
});

// POST /api/decision/:id/reject
app.post('/api/decision/:id/reject', (req, res) => {
  const result = rejectDecision(req.params.id);
  if (!result) return res.status(404).json({ error: 'Decision not found' });
  res.json(result);
});

// GET /api/orderbook?pair=USDTRY
app.get('/api/orderbook', (req, res) => {
  const pair = (req.query.pair || 'USDTRY').toUpperCase();
  if (!['USDTRY', 'EURTRY'].includes(pair)) {
    return res.status(400).json({ error: 'Invalid pair. Use USDTRY or EURTRY.' });
  }
  res.json(generateOrderBook(pair));
});

// GET /api/agent/params — get current agent parameters
app.get('/api/agent/params', (req, res) => {
  res.json(getAgentParams());
});

// PUT /api/agent/params — update agent parameters
app.put('/api/agent/params', (req, res) => {
  const updated = updateAgentParams(req.body);
  res.json(updated);
});

app.listen(PORT, () => {
  console.log(`FX Treasury Backend running on http://localhost:${PORT}`);
});
