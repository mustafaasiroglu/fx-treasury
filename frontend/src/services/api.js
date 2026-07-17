const API_BASE = '/api';

export async function fetchRates(pair = 'USDTRY') {
  const res = await fetch(`${API_BASE}/rates?pair=${pair}`);
  if (!res.ok) throw new Error('Failed to fetch rates');
  return res.json();
}

export async function fetchRateHistory(pair = 'USDTRY', range = '5m') {
  const res = await fetch(`${API_BASE}/rates/history?pair=${pair}&range=${range}`);
  if (!res.ok) throw new Error('Failed to fetch rate history');
  return res.json();
}

export async function fetchDecision(pair = 'USDTRY') {
  const res = await fetch(`${API_BASE}/decision?pair=${pair}`);
  if (!res.ok) throw new Error('Failed to fetch decision');
  return res.json();
}

export async function fetchOrderBook(pair = 'USDTRY') {
  const res = await fetch(`${API_BASE}/orderbook?pair=${pair}`);
  if (!res.ok) throw new Error('Failed to fetch order book');
  return res.json();
}

export async function fetchDecisionHistory(pair = 'USDTRY') {
  const res = await fetch(`${API_BASE}/decisions/history?pair=${pair}`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function acceptDecision(id) {
  const res = await fetch(`${API_BASE}/decision/${id}/accept`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to accept decision');
  return res.json();
}

export async function rejectDecision(id) {
  const res = await fetch(`${API_BASE}/decision/${id}/reject`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reject decision');
  return res.json();
}

export async function fetchAgentParams() {
  const res = await fetch(`${API_BASE}/agent/params`);
  if (!res.ok) throw new Error('Failed to fetch agent params');
  return res.json();
}

export async function updateAgentParams(params) {
  const res = await fetch(`${API_BASE}/agent/params`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to update agent params');
  return res.json();
}

export async function sendAgentChat({ pair, message, history }) {
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pair, message, history }),
  });
  if (!res.ok) throw new Error('Failed to send chat');
  return res.json();
}

export async function fetchNews(pair = 'USDTRY') {
  const res = await fetch(`${API_BASE}/news?pair=${pair}`);
  if (!res.ok) throw new Error('Failed to fetch news');
  return res.json();
}
