import React, { useState } from 'react';

const BRANCH_STYLE = {
  HOLD: { label: 'HOLD', color: '#90a0ba' },
  PUBLISH: { label: 'PUBLISH', color: '#60d36f' },
  SMOOTH_STEP: { label: 'SMOOTH STEP', color: '#9b6cff' },
};

export default function AgentChat({ rateHistory, params, onSubmit }) {
  const [text, setText] = useState('');

  const latest = rateHistory.length > 0 ? rateHistory[rateHistory.length - 1] : null;
  const marketMid = latest?.median;
  const clientMid = latest?.clientMid;
  const gap = marketMid != null && clientMid != null ? Math.abs(marketMid - clientMid) : null;

  let branch = null;
  if (gap != null && params) {
    if (gap < params.holdThreshold) branch = 'HOLD';
    else if (gap > params.smoothStepThreshold) branch = 'SMOOTH_STEP';
    else branch = 'PUBLISH';
  }
  const branchStyle = branch ? BRANCH_STYLE[branch] : null;

  const fmt = (v) => (v != null ? v.toFixed(4) : '—');
  const pct = (v) => (v != null ? `${Math.round(v * 100)}%` : '—');

  const handleSend = () => {
    const msg = text.trim();
    if (!msg) return;
    onSubmit(msg);
    setText('');
  };

  return (
    <div className="px-3.5 py-3 border-b border-white/[0.07]">
      {/* Algorithm with real values */}
      <p className="text-[10px] text-muted leading-relaxed mb-2.5">
        <span className="font-bold" style={{ color: branchStyle ? branchStyle.color : '#9b6cff' }}>
          Current Strategy:
        </span>{' '}
        Agent computes the gap between market mid (<span className="text-yellow font-mono">{fmt(marketMid)}</span>) and
        client mid (<span className="text-mint font-mono">{fmt(clientMid)}</span>) → gap <span className="text-ink font-mono">{fmt(gap)}</span>.
        {' '}If gap &lt; <span className="text-ink font-mono">{params ? params.holdThreshold : '—'}</span> → HOLD.
        {' '}If gap &gt; <span className="text-ink font-mono">{params ? params.smoothStepThreshold : '—'}</span> → SMOOTH_STEP (close <span className="text-ink font-mono">{params ? pct(params.smoothStepFactor) : '—'}</span> of gap).
        {' '}Otherwise → PUBLISH with <span className="text-ink font-mono">{params ? pct(params.publishProbability) : '—'}</span> probability (close <span className="text-ink font-mono">{params ? pct(params.publishFactor) : '—'}</span> of gap).
        {' '}Client spread = market spread × [<span className="text-ink font-mono">{params ? params.spreadMultiplierMin : '—'}</span>, <span className="text-ink font-mono">{params ? params.spreadMultiplierMax : '—'}</span>] multiplier.
      </p>

      {/* Chat input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Chat with agent to fine-tune parameters"
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-ink placeholder:text-subtle outline-none focus:border-purple/60 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          aria-label="Send"
          title="Send"
          className="shrink-0 bg-purple/20 hover:bg-purple/30 disabled:opacity-40 text-purple grid place-items-center w-9 h-9 rounded-lg border border-purple/40 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
