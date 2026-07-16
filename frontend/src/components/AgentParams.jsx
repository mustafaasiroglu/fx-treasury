import React, { useState, useEffect } from 'react';
import { fetchAgentParams, updateAgentParams } from '../services/api';

export const PARAM_META = [
  { key: 'holdThreshold', label: 'Hold Threshold', desc: 'Gap below this value → agent holds (no rate change)', min: 0.001, max: 0.05, step: 0.001, tooltip: 'Increase: Agent intervenes less, more HOLD decisions. Decrease: Agent reacts to smaller price gaps, updates rates more frequently.' },
  { key: 'smoothStepThreshold', label: 'Smooth-Step Threshold', desc: 'Gap above this value → gradual convergence instead of full publish', min: 0.005, max: 0.1, step: 0.001, tooltip: 'Increase: Direct publish preferred even for large gaps, smooth-step becomes rare. Decrease: Earlier switch to gradual convergence mode.' },
  { key: 'publishProbability', label: 'Publish Probability', desc: 'Probability of publishing vs holding when gap is in middle zone', min: 0, max: 1, step: 0.05, tooltip: 'Increase: Higher chance of publishing in the middle zone, client rate tracks market faster. Decrease: More HOLDs in middle zone, rate updates slower.' },
  { key: 'smoothStepFactor', label: 'Smooth-Step Factor', desc: 'Fraction of gap to close per smooth-step decision (0→none, 1→full)', min: 0.1, max: 1, step: 0.05, tooltip: 'Increase: Each smooth-step closes more of the gap, faster convergence. Decrease: Smaller steps per decision, smoother but slower transition.' },
  { key: 'publishFactor', label: 'Publish Factor', desc: 'Fraction of gap to close on a full publish decision', min: 0.1, max: 1, step: 0.05, tooltip: 'Increase: Publish nearly closes the full gap, immediate market alignment. Decrease: Even publish does partial update, reduces sudden price jumps.' },
  { key: 'spreadMultiplierMin', label: 'Spread Multiplier Min', desc: 'Minimum multiplier applied to market spread for client spread', min: 0.5, max: 1.5, step: 0.05, tooltip: 'Increase: Client spread never goes below this × market spread, protects minimum margin. Decrease: Tighter spreads possible, competitive pricing but lower margin.' },
  { key: 'spreadMultiplierMax', label: 'Spread Multiplier Max', desc: 'Maximum multiplier applied to market spread for client spread', min: 0.5, max: 2, step: 0.05, tooltip: 'Increase: Client spread can widen more in volatile conditions, higher margin ceiling. Decrease: Caps the maximum spread, guarantees tighter pricing to clients.' },
  { key: 'autoAcceptThresholdMs', label: 'Auto-Accept (ms)', desc: 'Auto-accept pending decisions after this many milliseconds of inactivity', min: 10000, max: 300000, step: 5000, tooltip: 'Increase: Waits longer before auto-accepting, more time for operator review. Decrease: Decisions auto-apply faster, rate updates are not delayed.' },
];

export default function AgentParams({ onClose, recommendation, onApplied }) {
  const [params, setParams] = useState(null);
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    fetchAgentParams().then(setParams).catch(() => {});
  }, []);

  const handleChange = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: parseFloat(value) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateAgentParams(params);
      setParams(updated);
    } catch (e) { /* ignore */ }
    setSaving(false);
  };

  const handleReset = async () => {
    const defaults = await fetchAgentParams();
    setParams(defaults);
  };

  const handleApplyAll = async () => {
    if (!recommendation) return;
    const next = { ...params };
    recommendation.changes.forEach((c) => { next[c.key] = c.to; });
    setParams(next);
    setSaving(true);
    try {
      const updated = await updateAgentParams(next);
      setParams(updated);
      setApplied(true);
      onApplied?.();
    } catch (e) { /* ignore */ }
    setSaving(false);
  };

  if (!params) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <span className="text-muted text-sm">Loading parameters...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm">⚙️</span>
          <span className="text-xs font-bold text-primary">Agent Parameters</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted hover:text-primary text-xs px-1.5 py-0.5 rounded hover:bg-surface transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Algorithm description */}
      <div className="px-3 py-2 border-b border-border bg-surface/50">
        <p className="text-[10px] text-muted leading-relaxed">
          <span className="text-purple-400 font-bold">Algorithm:</span> Agent computes the gap between market mid and client mid.
          If gap &lt; <span className="text-yellow-400">holdThreshold</span> → <span className="text-gray-300">HOLD</span>.
          If gap &gt; <span className="text-yellow-400">smoothStepThreshold</span> → <span className="text-purple-300">SMOOTH_STEP</span> (close <span className="text-yellow-400">smoothStepFactor</span> of gap).
          Otherwise → <span className="text-green-300">PUBLISH</span> with <span className="text-yellow-400">publishProbability</span> (close <span className="text-yellow-400">publishFactor</span> of gap).
          Client spread = market spread × [<span className="text-yellow-400">min</span>, <span className="text-yellow-400">max</span>] multiplier.
        </p>
      </div>

      {/* AI recommendation banner */}
      {recommendation && (
        <div className="px-3 py-2.5 border-b border-purple-500/30 bg-purple-500/[0.07]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">🤖</span>
            <span className="text-[11px] font-bold text-purple-300">AI Recommended Changes</span>
          </div>
          <p className="text-[10px] text-ink/80 leading-relaxed mb-2.5">{recommendation.summary}</p>
          <div className="space-y-1 mb-2.5">
            {recommendation.changes.map((c) => (
              <div key={c.key} className="flex items-center gap-2 text-[10px]">
                <span className="text-muted flex-1 truncate">{c.label}</span>
                <span className="font-mono text-muted/70 line-through">{c.from}</span>
                <span className="text-muted">→</span>
                <span className="font-mono text-purple-300 font-bold">{c.to}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleApplyAll}
            disabled={saving || applied}
            className="w-full bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-50 text-purple-200 text-[11px] font-bold py-1.5 px-2 rounded-lg border border-purple-400/50 transition-colors"
          >
            {applied ? '✓ Applied' : saving ? 'Applying...' : '✓ Apply All'}
          </button>
        </div>
      )}

      {/* Parameters */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {PARAM_META.map(({ key, label, desc, min, max, step, tooltip }) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[11px] font-medium text-primary flex items-center gap-1.5">
                {label}
                {tooltip && (
                  <span className="relative group">
                    <span className="w-[14px] h-[14px] inline-grid place-items-center rounded-full bg-white/[0.08] text-muted text-[9px] cursor-help">?</span>
                    <span className="absolute top-full left-0 mt-2 px-3 py-2 rounded-lg text-[10px] text-ink leading-relaxed w-56 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50" style={{ background: 'linear-gradient(180deg, #1e2030, #181a2a)', border: '1px solid rgba(255,255,255,0.12)' }}>
                      {tooltip}
                    </span>
                  </span>
                )}
              </span>
              <input
                type="number"
                value={params[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                min={min}
                max={max}
                step={step}
                className="w-20 text-[11px] text-right bg-surface border border-border rounded px-1.5 py-0.5 text-primary focus:outline-none focus:border-purple-500"
              />
            </div>
            <input
              type="range"
              value={params[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              min={min}
              max={max}
              step={step}
              className="w-full h-1 accent-purple-500 cursor-pointer"
            />
            <p className="text-[9px] text-muted mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex gap-2 px-3 py-2 border-t border-border">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-[11px] font-bold py-1.5 px-2 rounded transition-colors"
        >
          {saving ? 'Saving...' : '✓ Apply'}
        </button>
        <button
          onClick={handleReset}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-[11px] font-bold py-1.5 px-2 rounded transition-colors"
        >
          ↺ Reset
        </button>
      </div>
    </div>
  );
}
