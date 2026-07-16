import React, { useState, useEffect, useRef } from 'react';
import Chart from './components/Chart';
import DecisionFeed from './components/DecisionFeed';
import AgentParams, { PARAM_META } from './components/AgentParams';
import AgentChat from './components/AgentChat';
import EventTimeline from './components/EventTimeline';
import KpiCards from './components/KpiCards';
import OrderPressure from './components/OrderPressure';
import PairSelector from './components/PairSelector';
import { fetchRates, fetchRateHistory, fetchDecision, acceptDecision, rejectDecision, fetchAgentParams } from './services/api';

// Build a recommendation (param changes + explanation) from a free-text chat message.
function buildRecommendation(message, params) {
  if (!params) return null;
  const msg = message.toLowerCase();
  const changes = [];
  const intents = [];

  const round = (key, v) => {
    const meta = PARAM_META.find((m) => m.key === key);
    const clamped = Math.min(meta.max, Math.max(meta.min, v));
    const decimals = meta.step >= 1 ? 0 : 3;
    return Number(clamped.toFixed(decimals));
  };
  const add = (key, newVal) => {
    if (changes.some((c) => c.key === key)) return;
    const meta = PARAM_META.find((m) => m.key === key);
    const to = round(key, newVal);
    if (to === params[key]) return;
    changes.push({ key, label: meta.label, from: params[key], to });
  };

  if (/tight|narrow|lower spread|reduce spread|competitive|daralt|\bdar\b/.test(msg)) {
    add('spreadMultiplierMin', params.spreadMultiplierMin - 0.1);
    add('spreadMultiplierMax', params.spreadMultiplierMax - 0.15);
    intents.push('tightening client spreads so quotes stay more competitive');
  }
  if (/wid(e|er)|increase spread|fatten|geniş/.test(msg)) {
    add('spreadMultiplierMin', params.spreadMultiplierMin + 0.1);
    add('spreadMultiplierMax', params.spreadMultiplierMax + 0.15);
    intents.push('widening client spreads to capture more margin');
  }
  if (/aggress|publish more|react|faster pric|responsive|hızlı|agresif/.test(msg)) {
    add('holdThreshold', params.holdThreshold - 0.002);
    add('publishProbability', params.publishProbability + 0.15);
    add('publishFactor', params.publishFactor + 0.1);
    intents.push('lowering the hold threshold and publishing more often so the agent reacts faster to market moves');
  }
  if (/conservativ|hold more|stable|stabil|temkin|muhafaza|less risk|risk averse/.test(msg)) {
    add('holdThreshold', params.holdThreshold + 0.003);
    add('publishProbability', params.publishProbability - 0.15);
    intents.push('raising the hold threshold and publishing less often for a calmer, more stable quote stream');
  }
  if (/smooth|gradual|step|yumuşak|kademeli/.test(msg)) {
    add('smoothStepThreshold', params.smoothStepThreshold - 0.005);
    add('smoothStepFactor', params.smoothStepFactor - 0.1);
    intents.push('converging more gradually via smaller smooth-steps to avoid abrupt jumps');
  }
  if (/auto.?accept|otomatik|onay/.test(msg)) {
    if (/slow|manual|disable|yavaş|kapat|elle/.test(msg)) {
      add('autoAcceptThresholdMs', params.autoAcceptThresholdMs + 30000);
      intents.push('extending the auto-accept window to keep more decisions under manual review');
    } else {
      add('autoAcceptThresholdMs', params.autoAcceptThresholdMs - 30000);
      intents.push('shortening the auto-accept window so pending decisions clear faster');
    }
  }

  // Fallback: balanced nudge when nothing matched
  if (changes.length === 0) {
    add('publishProbability', params.publishProbability + 0.05);
    add('spreadMultiplierMax', params.spreadMultiplierMax - 0.05);
    intents.push('applying a balanced tuning — slightly higher publish probability with marginally tighter spreads');
  }

  const summary = `Based on your request "${message}", I recommend ${intents.join('; ')}.`;
  return { summary, changes, message };
}

export default function App() {
  const [pair, setPair] = useState('USDTRY');
  const [timeRange, setTimeRange] = useState('5m');
  const [rateHistory, setRateHistory] = useState([]);
  const [visiblePriceRange, setVisiblePriceRange] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [latestDecision, setLatestDecision] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [showAgentParams, setShowAgentParams] = useState(false);
  const [agentParams, setAgentParams] = useState(null);
  const [chatRecommendation, setChatRecommendation] = useState(null);

  const lastDecisionIdRef = useRef(null);
  const latestDecisionRef = useRef(null);
  const pendingAgentPlotRef = useRef(false);

  // Load agent params once for the info panel / recommendations
  useEffect(() => {
    fetchAgentParams().then(setAgentParams).catch(() => {});
  }, []);

  const handleChatSubmit = (message) => {
    const rec = buildRecommendation(message, agentParams);
    setChatRecommendation(rec);
    setShowAgentParams(true);
  };

  const closeAgentParams = () => {
    setShowAgentParams(false);
    setChatRecommendation(null);
  };

  // Keep ref in sync with state
  useEffect(() => {
    latestDecisionRef.current = latestDecision;
  }, [latestDecision]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Polling effect — only re-runs when pair or timeRange changes
  useEffect(() => {
    // Only reset decisions on pair change (not timeRange change)
    setDecisions([]);
    setLatestDecision(null);
    lastDecisionIdRef.current = null;
    latestDecisionRef.current = null;
    pendingAgentPlotRef.current = false;

    // Load historical data for selected range — keep old data visible until new arrives
    fetchRateHistory(pair, timeRange).then((history) => {
      setRateHistory(history);
      setConnectionStatus('connected');
    }).catch(() => {});

    const pollRates = async () => {
      if (pausedRef.current) return;
      try {
        const data = await fetchRates(pair);
        setConnectionStatus('connected');
        // Read & consume pending flag OUTSIDE setState to avoid StrictMode double-invoke
        const dec = latestDecisionRef.current;
        const showAgent = pendingAgentPlotRef.current && dec?.type !== 'HOLD';
        if (pendingAgentPlotRef.current) pendingAgentPlotRef.current = false;
        const agentMid = showAgent ? dec.suggestedClientRate : null;
        const agentAsk = showAgent ? dec.suggestedClientAsk : null;
        const agentBid = showAgent ? dec.suggestedClientBid : null;
        setRateHistory((prev) => {
          const newPoint = {
            ...data,
            agentMid,
            agentAsk,
            agentBid,
          };
          const updated = [...prev, newPoint];
          return updated.slice(-300);
        });
      } catch {
        setConnectionStatus('error');
      }
    };

    const pollDecision = async () => {
      if (pausedRef.current) return;
      try {
        const data = await fetchDecision(pair);
        if (data.id && data.id !== lastDecisionIdRef.current) {
          lastDecisionIdRef.current = data.id;
          latestDecisionRef.current = data;
          pendingAgentPlotRef.current = true;
          setLatestDecision(data);
          setDecisions((prev) => {
            const exists = prev.find((d) => d.id === data.id);
            if (exists) return prev;
            // Expire all previous pending decisions
            const expired = prev.map((d) =>
              d.status === 'pending' ? { ...d, status: 'expired' } : d
            );
            return [...expired, data].slice(-30);
          });
        }
      } catch {
        // Silent fail
      }
    };

    pollRates();
    pollDecision();

    const rateInterval = setInterval(pollRates, 2000);
    const decisionInterval = setInterval(pollDecision, 5000);

    return () => {
      clearInterval(rateInterval);
      clearInterval(decisionInterval);
    };
  }, [pair, timeRange]);

  // Handle accept
  const handleAccept = async (id) => {
    try {
      const result = await acceptDecision(id);
      setDecisions((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'accepted' } : d))
      );
      if (latestDecision?.id === id) {
        setLatestDecision({ ...latestDecision, status: 'accepted' });
      }
    } catch {
      // Silent fail
    }
  };

  // Handle reject
  const handleReject = async (id) => {
    try {
      await rejectDecision(id);
      setDecisions((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: 'rejected' } : d))
      );
      if (latestDecision?.id === id) {
        setLatestDecision({ ...latestDecision, status: 'rejected' });
      }
    } catch {
      // Silent fail
    }
  };

  const pairLabel = pair === 'USDTRY' ? 'USD/TRY' : 'EUR/TRY';
  const currentRate = rateHistory.length > 0 ? rateHistory[rateHistory.length - 1] : null;

  return (
    <div className="min-h-screen text-ink">
      <main className="max-w-[1720px] mx-auto px-6 pt-5 pb-8">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between gap-5 border-b border-white/[0.07] mb-5">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="w-9 h-9 rounded-xl shrink-0"
              style={{
                background: 'linear-gradient(135deg, #ffd84d, #fd8e42 46%, #9b6cff)',
                boxShadow: '0 12px 35px rgba(255,216,77,.17)',
              }}
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight whitespace-nowrap text-ink">
                FX Treasury Intelligence Cloud
              </h1>
              <p className="text-xs text-muted mt-0.5">Decision-first treasury cockpit</p>
            </div>
            <PairSelector selected={pair} onChange={setPair} />
          </div>
          <div className="flex items-center gap-5 flex-wrap justify-end text-[13px] text-muted">
            {currentRate && (
              <>
                <span className="whitespace-nowrap">
                  Spot Mid: <strong className="text-yellow text-[15px] font-bold">{currentRate.median}</strong>
                </span>
                <span className="whitespace-nowrap">
                  Client: <strong className="text-mint text-[15px] font-bold">{currentRate.clientBid} / {currentRate.clientAsk}</strong>
                </span>
              </>
            )}
            <span
              className="inline-flex items-center gap-2 cursor-pointer select-none hover:opacity-80 transition-opacity"
              onClick={() => setPaused((p) => !p)}
              title={paused ? 'Click to resume data feed' : 'Click to pause data feed'}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  paused ? 'bg-yellow animate-pulse' :
                  connectionStatus === 'connected' ? 'bg-green' :
                  connectionStatus === 'error' ? 'bg-red' : 'bg-yellow animate-pulse'
                }`}
                style={!paused && connectionStatus === 'connected' ? { boxShadow: '0 0 0 4px rgba(96,211,111,.12)' } : undefined}
              />
              {paused ? 'paused' : connectionStatus}
            </span>
          </div>
        </header>

        {/* Layout: main stack + right panel */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(720px,1fr)_420px] gap-[18px] items-start">
          {/* Main stack */}
          <div className="grid gap-[18px] min-w-0">
            {/* KPI Cards */}
            <KpiCards rateHistory={rateHistory} />

            {/* Chart card */}
            <section className="ui-card overflow-hidden" style={{ minHeight: 510 }}>
              <div style={{ height: 510 }} className="flex flex-col">
                <Chart rateHistory={rateHistory} pair={pair} onPairChange={setPair} onVisiblePriceRange={setVisiblePriceRange} timeRange={timeRange} onTimeRangeChange={setTimeRange} />
              </div>
            </section>

            {/* Bottom grid — Order Pressure + Market News */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <section className="ui-card overflow-hidden" style={{ height: 220 }}>
                <OrderPressure rateHistory={rateHistory} />
              </section>
              <section className="ui-card overflow-hidden" style={{ height: 220 }}>
                <EventTimeline />
              </section>
            </div>
          </div>

          {/* Right panel — Agent Decision Stream */}
          <aside className="grid gap-3 xl:sticky xl:top-[18px]">
            <section className="ui-card flex flex-col overflow-hidden" style={{ minHeight: 'min(760px, calc(100vh - 56px))', maxHeight: 'calc(100vh - 56px)' }}>
              <div className="ui-section-header">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                    Agent Decision Stream
                    {latestDecision?.status === 'pending' && latestDecision?.type !== 'HOLD' && (
                      <span className="blink-dot w-2 h-2 rounded-full bg-purple" />
                    )}
                  </h2>
                  <p className="text-xs text-muted mt-0.5">Prioritized, explainable, and action-oriented.</p>
                </div>
                <button
                  onClick={() => (showAgentParams ? closeAgentParams() : setShowAgentParams(true))}
                  className="text-[10px] text-purple hover:text-purple/80 hover:bg-purple/10 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                >
                  <span>⚙️</span> Parameters
                </button>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                {showAgentParams ? (
                  <AgentParams
                    onClose={closeAgentParams}
                    recommendation={chatRecommendation}
                    onApplied={() => fetchAgentParams().then(setAgentParams).catch(() => {})}
                  />
                ) : (
                  <>
                    <AgentChat
                      rateHistory={rateHistory}
                      params={agentParams}
                      onSubmit={handleChatSubmit}
                    />
                    <div className="flex-1 overflow-hidden">
                      <DecisionFeed
                        decisions={decisions}
                        onAccept={handleAccept}
                        onReject={handleReject}
                      />
                    </div>
                  </>
                )}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
