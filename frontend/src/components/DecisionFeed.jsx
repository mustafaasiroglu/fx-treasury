import React, { useRef, useState } from 'react';

const TYPE_STYLES = {
  HOLD:        { label: 'HOLD',    color: '#90a0ba' },
  PUBLISH:     { label: 'PUBLISH', color: '#60d36f' },
  SMOOTH_STEP: { label: 'SMOOTH',  color: '#9b6cff' },
};

const CONF_COLOR = { High: '#60d36f', Medium: '#ffd84d', Low: '#90a0ba' };
const CONF_LEVEL = { High: 5, Medium: 3, Low: 1 };

function SignalIcon({ confidence, size = 12 }) {
  const level = CONF_LEVEL[confidence] ?? 0;
  const color = CONF_COLOR[confidence] || '#90a0ba';
  const bars = 5;
  const gap = 1;
  const barW = Math.max(1, Math.floor((size - gap * (bars - 1)) / bars));
  const w = barW * bars + gap * (bars - 1);
  return (
    <span
      title={`Confidence: ${confidence}`}
      className="inline-flex items-end shrink-0"
      style={{ width: w, height: size, gap }}
    >
      {Array.from({ length: bars }).map((_, i) => {
        const h = Math.round(((i + 1) / bars) * size);
        const active = i < level;
        return (
          <span
            key={i}
            style={{
              width: barW,
              height: h,
              background: active ? color : 'rgba(255,255,255,0.15)',
              borderRadius: 1,
            }}
          />
        );
      })}
    </span>
  );
}

const STATUS_STYLES = {
  accepted:        { label: '✓ Accepted',      color: '#60d36f' },
  'auto-accepted': { label: '⚡ Auto-Accepted', color: '#68a5ff' },
  rejected:        { label: '✗ Rejected',      color: '#ff6870' },
  expired:         { label: '⏱ Expired',       color: '#6f7a90' },
};

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function useTooltip() {
  const [hover, setHover] = useState(false);
  const [popupStyle, setPopupStyle] = useState({});
  const anchorRef = useRef(null);
  const show = () => {
    setHover(true);
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPopupStyle({
        position: 'fixed',
        left: rect.right - 260,
        top: rect.top - 8,
        transform: 'translateY(-100%)',
      });
    }
  };
  return { hover, popupStyle, anchorRef, show, hide: () => setHover(false) };
}

function ReasoningPopup({ decision, style, popupStyle, marketQuote, modelQuote, time }) {
  return (
    <div
      className="w-64 ui-card p-3 pointer-events-none z-[9999]"
      style={{
        ...popupStyle,
        background: 'linear-gradient(180deg, #1e2030, #181a2a)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: style.color }} />
        <span className="text-xs font-bold text-ink">{style.label}</span>
        <span className="ml-auto">
          <SignalIcon confidence={decision.confidence} size={12} />
        </span>
      </div>
      <div className="text-[10px] text-muted font-mono mb-2">⏰ {time}</div>

      {decision.reasons && decision.reasons.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] uppercase tracking-wide text-subtle mb-1">Reasoning</div>
          <ul className="text-[10px] text-ink/80 leading-relaxed list-disc list-inside space-y-0.5">
            {decision.reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <div className="text-[9px] text-yellow uppercase tracking-wide mb-0.5">Market</div>
          <div className="text-[10px] font-mono text-yellow">{marketQuote}</div>
        </div>
        <div>
          <div className="text-[9px] text-purple uppercase tracking-wide mb-0.5">
            {decision.type !== 'HOLD' ? 'Model →' : 'Client'}
          </div>
          <div className="text-[10px] font-mono text-purple">{modelQuote}</div>
        </div>
      </div>

      {decision.impact && (
        <div className="flex items-center gap-2 text-[10px] font-mono pt-2 border-t border-white/[0.06]">
          <span className={decision.impact.revenue >= 0 ? 'text-green' : 'text-red'}>
            Rev {decision.impact.revenue > 0 ? '+' : ''}{decision.impact.revenue}%
          </span>
          <span className="text-orange">Conv {decision.impact.conversion}%</span>
          <span className="text-muted">Risk {decision.impact.executionRisk}</span>
        </div>
      )}
    </div>
  );
}

// Top decision — expanded multi-line card
function TopDecisionCard({ decision, onAccept, onReject }) {
  const style = TYPE_STYLES[decision.type] || TYPE_STYLES.HOLD;
  const isPending = decision.status === 'pending';
  const isActionable = isPending && decision.type !== 'HOLD';
  const time = formatTime(decision.timestamp);
  const marketQuote = `${decision.currentMarketBid} / ${decision.currentMarketAsk}`;
  const modelQuote = decision.type !== 'HOLD'
    ? `${decision.suggestedClientBid} / ${decision.suggestedClientAsk}`
    : `${decision.currentClientBid} / ${decision.currentClientAsk}`;
  const statusStyle = STATUS_STYLES[decision.status];

  return (
    <div className="mb-2 border-b border-white/[0.08] bg-white/[0.03] px-[18px] py-3">
      {/* Header row: dot, time, type pill, confidence, actions/status on the right */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] text-muted font-mono">{time}</span>
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
          style={{ backgroundColor: style.color + '22', color: style.color }}
        >
          {style.label}
        </span>
        <span title={`Confidence: ${decision.confidence}`}>
          <SignalIcon confidence={decision.confidence} size={13} />
        </span>

        <div className="ml-auto flex items-center gap-1">
          {isActionable ? (
            <>
              <button
                onClick={() => onAccept(decision.id)}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-green/15 hover:bg-green/25 text-[#60d36f] border border-[#60d36f]/60 transition-colors"
              >
                ✓ Accept
              </button>
              <button
                onClick={() => onReject(decision.id)}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-muted hover:text-ink border border-white/[0.07] transition-colors"
              >
                ✗ Reject
              </button>
            </>
          ) : statusStyle ? (
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
              style={{ backgroundColor: statusStyle.color + '1f', color: statusStyle.color }}
            >
              {statusStyle.label}
            </span>
          ) : null}
        </div>
      </div>

      {/* Quote row */}
      <div className="flex items-center gap-2 text-[11px] font-mono mb-2">
        <span className="text-yellow">{marketQuote}</span>
        <span className="text-subtle">→</span>
        <span className="text-purple">{modelQuote}</span>
      </div>

      {/* Reasoning */}
      {decision.reasons && decision.reasons.length > 0 && (
        <p className="text-[10px] text-ink/70 leading-relaxed mb-2">
          {decision.reasons.join(' · ')}
        </p>
      )}

      {/* Impact row */}
      {decision.impact && (
        <div className="flex items-center gap-3 text-[10px] font-mono pt-2 border-t border-white/[0.06]">
          <span className={decision.impact.revenue >= 0 ? 'text-green' : 'text-red'}>
            Rev {decision.impact.revenue > 0 ? '+' : ''}{decision.impact.revenue}%
          </span>
          <span className="text-orange">Conv {decision.impact.conversion}%</span>
          <span className="text-muted">Risk {decision.impact.executionRisk}</span>
        </div>
      )}
    </div>
  );
}

// Historical rows — minimal single line, no confidence letter or quote numbers
function HistoryRow({ decision }) {
  const { hover, popupStyle, anchorRef, show, hide } = useTooltip();
  const style = TYPE_STYLES[decision.type] || TYPE_STYLES.HOLD;
  const time = formatTime(decision.timestamp);
  const marketQuote = `${decision.currentMarketBid} / ${decision.currentMarketAsk}`;
  const modelQuote = decision.type !== 'HOLD'
    ? `${decision.suggestedClientBid} / ${decision.suggestedClientAsk}`
    : `${decision.currentClientBid} / ${decision.currentClientAsk}`;
  const statusStyle = STATUS_STYLES[decision.status];

  return (
    <div
      ref={anchorRef}
      className="flex items-center gap-2 px-[18px] py-1.5 hover:bg-white/[0.03] transition-colors cursor-help"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <span className="text-[10px] text-muted font-mono w-[58px] shrink-0">{time}</span>
      <span
        className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 w-[52px] text-center"
        style={{ backgroundColor: style.color + '22', color: style.color }}
      >
        {style.label}
      </span>
      <span className="flex-1" />
      {statusStyle ? (
        <span
          className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0"
          style={{ backgroundColor: statusStyle.color + '1f', color: statusStyle.color }}
        >
          {statusStyle.label}
        </span>
      ) : (
        <span className="text-[9px] text-subtle shrink-0">—</span>
      )}

      {hover && (
        <ReasoningPopup
          decision={decision}
          style={style}
          popupStyle={popupStyle}
          marketQuote={marketQuote}
          modelQuote={modelQuote}
          time={time}
        />
      )}
    </div>
  );
}

export default function DecisionFeed({ decisions, onAccept, onReject }) {
  const ordered = [...decisions].reverse();
  const [top, ...rest] = ordered;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-1">
        {!top ? (
          <div className="text-center text-muted text-sm mt-10">
            Waiting for model decisions...
          </div>
        ) : (
          <>
            <TopDecisionCard decision={top} onAccept={onAccept} onReject={onReject} />
            {rest.map((d) => (
              <HistoryRow key={d.id} decision={d} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
