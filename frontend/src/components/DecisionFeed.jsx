import React from 'react';

const TYPE_STYLES = {
  HOLD: { label: 'HOLD', color: '#90a0ba', icon: '⏸' },
  PUBLISH: { label: 'PUBLISH', color: '#60d36f', icon: '📡' },
  SMOOTH_STEP: { label: 'SMOOTH STEP', color: '#9b6cff', icon: '📈' },
};

const CONF_COLOR = { High: '#60d36f', Medium: '#ffd84d', Low: '#90a0ba' };

function DecisionCard({ decision, onAccept, onReject, isTop }) {
  const style = TYPE_STYLES[decision.type] || TYPE_STYLES.HOLD;
  const isPending = decision.status === 'pending';
  const isPassive = !isTop;
  const time = new Date(decision.timestamp).toLocaleTimeString();

  return (
    <div
      className="decision-enter rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5 mb-2.5 transition-opacity"
      style={isPassive ? { opacity: 0.52 } : undefined}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
          style={{ backgroundColor: style.color + '1f', color: style.color }}
        >
          {style.label}
        </span>
        <span
          className="text-[10px] font-bold"
          style={{ color: CONF_COLOR[decision.confidence] || '#90a0ba' }}
        >
          {decision.confidence}
        </span>
        <span className="text-[10px] text-muted ml-auto font-mono">{time}</span>
      </div>

      {/* Reasons */}
      {decision.reasons && (
        <p className="text-[11px] text-ink/80 mb-2.5 leading-relaxed">
          {decision.reasons.join(' · ')}
        </p>
      )}

      {/* Quote rows */}
      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-2.5 py-1.5">
          <div className="text-[9px] text-yellow uppercase tracking-wide mb-0.5">Market</div>
          <div className="text-[11px] font-mono font-bold text-yellow">{decision.currentMarketBid} / {decision.currentMarketAsk}</div>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-2.5 py-1.5">
          <div className="text-[9px] text-purple uppercase tracking-wide mb-0.5">
            {decision.type !== 'HOLD' ? 'Agent →' : 'Client'}
          </div>
          <div className="text-[11px] font-mono font-bold text-purple">
            {decision.type !== 'HOLD'
              ? `${decision.suggestedClientBid} / ${decision.suggestedClientAsk}`
              : `${decision.currentClientBid} / ${decision.currentClientAsk}`}
          </div>
        </div>
      </div>

      {/* Risk row */}
      {decision.impact && (
        <div className="flex items-center gap-3 mb-2.5 text-[10px] font-mono">
          <span className={decision.impact.revenue >= 0 ? 'text-green' : 'text-red'}>
            Rev {decision.impact.revenue > 0 ? '+' : ''}{decision.impact.revenue}%
          </span>
          <span className="text-orange">Conv {decision.impact.conversion}%</span>
          <span className="text-muted">Risk {decision.impact.executionRisk}</span>
        </div>
      )}

      {/* Action buttons */}
      {isPending && decision.type !== 'HOLD' ? (
        <div className="flex gap-2">
          <button
            onClick={() => onAccept(decision.id)}
            className="flex-1 bg-green/15 hover:bg-green/25 text-[#60d36f] text-[11px] font-bold py-1.5 px-2 rounded-lg border border-[#60d36f] transition-colors"
          >
            ✓ Accept
          </button>
          <button
            onClick={() => onReject(decision.id)}
            className="flex-1 bg-white/[0.04] hover:bg-white/[0.08] text-muted hover:text-ink text-[11px] font-bold py-1.5 px-2 rounded-lg border border-white/[0.07] transition-colors"
          >
            ✗ Reject
          </button>
        </div>
      ) : (
        <div className={`text-[10px] text-center py-1 rounded-lg ${
          decision.status === 'accepted' ? 'bg-green/10 text-green' :
          decision.status === 'auto-accepted' ? 'bg-blue/10 text-blue' :
          decision.status === 'rejected' ? 'bg-red/10 text-red' :
          decision.status === 'expired' ? 'bg-white/[0.03] text-subtle' :
          'bg-white/[0.03] text-muted'
        }`}>
          {decision.status === 'accepted' ? '✓ Accepted' :
           decision.status === 'auto-accepted' ? '⚡ Auto-Accepted' :
           decision.status === 'rejected' ? '✗ Rejected' :
           decision.status === 'expired' ? '⏱ Expired' :
           decision.type === 'HOLD' ? '⏸ Hold' : decision.status}
        </div>
      )}
    </div>
  );
}

export default function DecisionFeed({ decisions, onAccept, onReject }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3">
        {decisions.length === 0 ? (
          <div className="text-center text-muted text-sm mt-10">
            Waiting for agent decisions...
          </div>
        ) : (
          [...decisions].reverse().map((d, i) => (
            <DecisionCard
              key={d.id}
              decision={d}
              onAccept={onAccept}
              onReject={onReject}
              isTop={i === 0}
            />
          ))
        )}
      </div>
    </div>
  );
}
