import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sendAgentChat } from '../services/api';

const TASK_EXAMPLES = [
  { label: 'Check model parameters', prompt: 'Check current model parameters and explain the active strategy.' },
  { label: 'Compare last 5m vs competitor', prompt: 'Compare our last 5 minutes of quotes against competitor pricing and highlight gaps.' },
  { label: 'Fetch latest USD/TRY news', prompt: 'Fetch the latest news related to USD/TRY and summarize market impact.' },
  { label: 'Tune for tighter spreads', prompt: 'Tighten client spreads while keeping margin healthy — suggest parameter changes.' },
];

// Icon + friendly label per tool. Unknown tools fall back to a generic gear.
const TOOL_META = {
  get_model_params:    { label: 'Read model params',    icon: 'sliders' },
  get_rate_history:    { label: 'Rate history',         icon: 'chart'   },
  compare_competitor:  { label: 'Competitor compare',   icon: 'scales'  },
  fetch_news:          { label: 'Fetch news',           icon: 'news'    },
  fetch_url:           { label: 'Fetch URL',            icon: 'link'    },
  update_model_params: { label: 'Update model params',  icon: 'wrench'  },
  run_backtest:        { label: 'Run backtest',         icon: 'replay'  },
};

const TOOLS = [
  { id: 'get_model_params', desc: 'Read active model tuning parameters' },
  { id: 'get_rate_history', desc: 'Fetch spot / client rate history for a range' },
  { id: 'compare_competitor', desc: 'Compare our quotes vs competitor feed' },
  { id: 'fetch_news', desc: 'Fetch latest FX news for a pair' },
  { id: 'fetch_url', desc: 'Safely fetch a public URL (article body, JSON, etc.)' },
  { id: 'update_model_params', desc: 'Apply new model parameters' },
  { id: 'run_backtest', desc: 'Run backtest with modified parameters' },
];

function ToolIcon({ name }) {
  const s = { width: 12, height: 12, strokeWidth: 2, fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'sliders':
      return (<svg viewBox="0 0 24 24" {...s}><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="18" r="2"/></svg>);
    case 'chart':
      return (<svg viewBox="0 0 24 24" {...s}><polyline points="3,17 9,11 13,15 21,6"/><polyline points="15,6 21,6 21,12"/></svg>);
    case 'scales':
      return (<svg viewBox="0 0 24 24" {...s}><line x1="12" y1="3" x2="12" y2="21"/><line x1="4" y1="6" x2="20" y2="6"/><path d="M4 6l-2 6a4 4 0 0 0 8 0L8 6"/><path d="M20 6l-2 6a4 4 0 0 0 8 0L24 6" transform="translate(-4 0)"/></svg>);
    case 'news':
      return (<svg viewBox="0 0 24 24" {...s}><rect x="3" y="5" width="14" height="14" rx="1"/><path d="M17 8h4v9a2 2 0 0 1-2 2h-2"/><line x1="6" y1="9" x2="14" y2="9"/><line x1="6" y1="13" x2="14" y2="13"/><line x1="6" y1="17" x2="10" y2="17"/></svg>);
    case 'link':
      return (<svg viewBox="0 0 24 24" {...s}><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>);
    case 'wrench':
      return (<svg viewBox="0 0 24 24" {...s}><path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-2.6-2.6 2.4-2.4z"/></svg>);
    case 'replay':
      return (<svg viewBox="0 0 24 24" {...s}><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3,3 3,9 9,9"/></svg>);
    default:
      return (<svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>);
  }
}

function ToolChip({ call }) {
  const meta = TOOL_META[call.name] || { label: call.name, icon: 'gear' };
  const argStr = call.args && Object.keys(call.args).length
    ? JSON.stringify(call.args, null, 2)
    : '(no args)';
  const tip = `${call.name}\n${argStr}`;
  return (
    <span
      title={tip}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple/10 border border-purple/30 text-purple hover:bg-purple/20 transition-colors cursor-help"
    >
      <ToolIcon name={meta.icon} />
      <span className="text-[9px] font-medium">{meta.label}</span>
    </span>
  );
}

const mdComponents = {
  p: ({ node, ...p }) => <p className="mb-1.5 last:mb-0" {...p} />,
  ul: ({ node, ...p }) => <ul className="list-disc pl-4 my-1 space-y-0.5" {...p} />,
  ol: ({ node, ...p }) => <ol className="list-decimal pl-4 my-1 space-y-0.5" {...p} />,
  li: ({ node, ...p }) => <li className="leading-snug" {...p} />,
  a: ({ node, ...p }) => <a target="_blank" rel="noreferrer" className="text-purple underline hover:text-purple/80" {...p} />,
  code: ({ node, inline, ...p }) => inline
    ? <code className="px-1 py-0.5 rounded bg-white/[0.08] text-[10px] font-mono text-ink" {...p} />
    : <code className="block p-2 my-1 rounded bg-white/[0.06] text-[10px] font-mono text-ink overflow-x-auto" {...p} />,
  pre: ({ node, ...p }) => <pre className="my-1" {...p} />,
  h1: ({ node, ...p }) => <h3 className="text-[12px] font-semibold mt-2 mb-1" {...p} />,
  h2: ({ node, ...p }) => <h3 className="text-[12px] font-semibold mt-2 mb-1" {...p} />,
  h3: ({ node, ...p }) => <h4 className="text-[11px] font-semibold mt-1.5 mb-0.5" {...p} />,
  strong: ({ node, ...p }) => <strong className="font-semibold text-ink" {...p} />,
  em: ({ node, ...p }) => <em className="italic text-ink/90" {...p} />,
  blockquote: ({ node, ...p }) => <blockquote className="border-l-2 border-purple/40 pl-2 my-1 text-muted italic" {...p} />,
  hr: () => <hr className="my-2 border-white/[0.08]" />,
  table: ({ node, ...p }) => <table className="my-1 text-[10px] border-collapse" {...p} />,
  th: ({ node, ...p }) => <th className="border border-white/[0.1] px-1.5 py-0.5 text-left font-semibold" {...p} />,
  td: ({ node, ...p }) => <td className="border border-white/[0.08] px-1.5 py-0.5" {...p} />,
};

function MarkdownBody({ text }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {text || ''}
      </ReactMarkdown>
    </div>
  );
}

export default function AgentChat({ pair }) {
  const makeGreeting = (p) => ({
    role: 'assistant',
    content: `Hi! I'm your FX Treasury Agent for ${p === 'USDTRY' ? 'USD/TRY' : 'EUR/TRY'}. I can inspect the model, compare against competitors, fetch news, and tune parameters. Try one of the examples below or ask anything.`,
  });
  const [messages, setMessages] = useState([makeGreeting(pair)]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    setInput('');
    // Snapshot prior conversation for the backend (excluding the greeting-only assistant
    // message renders fine — backend only cares about user/assistant turns).
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setSending(true);
    try {
      const resp = await sendAgentChat({ pair, message: msg, history });
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: resp.content || 'No response.',
        tools: resp.toolCalls || [],
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: '⚠️ Agent is offline (Azure OpenAI not yet configured). This is a placeholder response — once GPT-5.2 credentials are set, live reasoning will flow here.',
      }]);
    }
    setSending(false);
    // Return focus to the input after the round-trip so the user can keep typing.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // Listen for external "send this message" triggers (e.g. from a news row)
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const onExternal = (ev) => {
      const message = ev.detail?.message;
      if (typeof message === 'string' && message.trim()) {
        sendRef.current(message);
      }
    };
    window.addEventListener('agent-chat-send', onExternal);
    return () => window.removeEventListener('agent-chat-send', onExternal);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="ui-section-header">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
            FX Treasury Agent
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8L12 3z" fill="url(#sparkleGrad)" />
              <path d="M19 14l.9 2.5L22.4 17.4l-2.5.9L19 20.8l-.9-2.5L15.6 17.4l2.5-.9L19 14z" fill="url(#sparkleGrad)" />
              <defs>
                <linearGradient id="sparkleGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#ffd84d" />
                  <stop offset="55%" stopColor="#fd8e42" />
                  <stop offset="100%" stopColor="#9b6cff" />
                </linearGradient>
              </defs>
            </svg>
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Inspect, compare, tune
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => {
              setMessages([makeGreeting(pair)]);
              setInput('');
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            className="text-muted hover:text-purple hover:bg-purple/10 p-1.5 rounded-lg transition-colors"
            title="Reset chat"
            aria-label="Reset chat"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <polyline points="3,3 3,8 8,8" />
            </svg>
          </button>
          <button
            onClick={() => setShowTools((s) => !s)}
            className="text-[10px] text-purple hover:text-purple/80 hover:bg-purple/10 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
            title="Available tools"
          >
            <span>🔧</span> Tools
          </button>
        </div>
      </div>

      {/* Tools panel */}
      {showTools && (
        <div className="px-3 py-2 border-b border-white/[0.07] bg-white/[0.02]">
          <p className="text-[10px] text-muted mb-1.5">Available tools (invoked by the agent as needed):</p>
          <div className="space-y-1">
            {TOOLS.map((t) => {
              const meta = TOOL_META[t.id] || { label: t.id, icon: 'gear' };
              return (
                <div key={t.id} className="flex items-center gap-2 text-[10px]">
                  <span className="text-purple shrink-0 inline-flex items-center gap-1">
                    <ToolIcon name={meta.icon} />
                    <span className="font-mono">{t.id}</span>
                  </span>
                  <span className="text-muted">— {t.desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2.5">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-[11px] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-purple/20 border border-purple/40 text-ink'
                  : 'bg-white/[0.04] border border-white/[0.08] text-ink/90'
              }`}
            >
              {m.role === 'assistant'
                ? <MarkdownBody text={m.content} />
                : <div className="whitespace-pre-wrap">{m.content}</div>}
              {m.tools && m.tools.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/[0.08] flex flex-wrap gap-1">
                  {m.tools.map((t, j) => <ToolChip key={j} call={t} />)}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[11px]">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple animate-pulse" />
                <span className="w-1.5 h-1.5 rounded-full bg-purple animate-pulse" style={{ animationDelay: '0.2s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-purple animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Task examples (shown when no user messages yet) */}
      {messages.filter((m) => m.role === 'user').length === 0 && (
        <div className="px-3 pb-2 space-y-1.5">
          <p className="text-[9px] text-muted uppercase tracking-wide">Try:</p>
          <div className="flex flex-wrap gap-1.5">
            {TASK_EXAMPLES.map((t) => (
              <button
                key={t.label}
                onClick={() => send(t.prompt)}
                className="text-[10px] px-2 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] hover:bg-purple/10 hover:border-purple/40 hover:text-purple text-muted transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-white/[0.07]">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Ask the agent..."
            disabled={sending}
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-ink placeholder:text-subtle outline-none focus:border-purple/60 transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || sending}
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
    </div>
  );
}
