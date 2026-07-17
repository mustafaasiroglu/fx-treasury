// Agent Chat — Azure OpenAI (gpt-5.2) backed. Falls back to a stub reply when
// AZURE_OPENAI_* env vars are not configured.
//
// Env vars (all required for live mode):
//   AZURE_OPENAI_ENDPOINT   — e.g. https://<resource>.openai.azure.com
//   AZURE_OPENAI_API_KEY    — API key
//   AZURE_OPENAI_DEPLOYMENT — deployment name for gpt-5.2 (e.g. "gpt-5.2")
//   AZURE_OPENAI_API_VERSION — e.g. "2024-10-21"

const { getAgentParams } = require('./decisionEngine');
const { getHistory } = require('./tickStore');
const { fetchUrlSafe } = require('./urlFetcher');
const { fetchNews } = require('./newsProvider');

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_model_params',
      description: 'Read the current tuning parameters of the treasury pricing model.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rate_history',
      description: 'Fetch spot / client rate history for a currency pair.',
      parameters: {
        type: 'object',
        properties: {
          pair: { type: 'string', enum: ['USDTRY', 'EURTRY'] },
          range_sec: { type: 'number', description: 'Range in seconds (default 300)' },
        },
        required: ['pair'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_competitor',
      description: 'Compare our quotes vs competitor pricing feed over a time window.',
      parameters: {
        type: 'object',
        properties: {
          pair: { type: 'string' },
          window_sec: { type: 'number' },
        },
        required: ['pair'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_news',
      description: 'Fetch latest FX-related news headlines (title, url, provider, publish date) for a currency pair from aggregated RSS sources. Returns links only — call fetch_url on a specific link to read the article body.',
      parameters: {
        type: 'object',
        properties: {
          pair: { type: 'string', enum: ['USDTRY', 'EURTRY'] },
          limit: { type: 'number', description: 'Max items to return (default 15)' },
        },
        required: ['pair'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_url',
      description:
        'Safely fetch a public http(s) URL and return extracted plaintext (or JSON body). ' +
        'Use this to read a news article after fetch_news, or to inspect a page the user pasted. ' +
        'Response is truncated to ~12k characters. Blocks private/internal hosts.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Absolute http:// or https:// URL to fetch.' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_model_params',
      description: 'Apply new model tuning parameters.',
      parameters: {
        type: 'object',
        properties: {
          changes: {
            type: 'object',
            description: 'Partial params object with fields to update',
          },
        },
        required: ['changes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_backtest',
      description: 'Run backtest with modified parameters against historical data.',
      parameters: {
        type: 'object',
        properties: {
          params: { type: 'object' },
          range_sec: { type: 'number' },
        },
        required: ['params'],
      },
    },
  },
];

function isConfigured() {
  return (
    !!process.env.AZURE_OPENAI_ENDPOINT &&
    !!process.env.AZURE_OPENAI_API_KEY &&
    !!process.env.AZURE_OPENAI_DEPLOYMENT
  );
}

async function callAzureOpenAI(messages) {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '');
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.AZURE_OPENAI_API_KEY,
    },
    body: JSON.stringify({
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure OpenAI error ${res.status}: ${text}`);
  }
  return res.json();
}

// Simple local tool executors (used when in stub mode or when the model
// requests a tool — a real implementation would loop until no more tools).
async function executeTool(name, args) {
  switch (name) {
    case 'get_model_params':
      return getAgentParams();
    case 'get_rate_history': {
      const history = getHistory(args.pair || 'USDTRY', args.range_sec || 300);
      return { points: history.length, first: history[0], last: history[history.length - 1] };
    }
    case 'compare_competitor':
      return { status: 'stub', note: 'Competitor feed not yet wired.' };
    case 'fetch_news': {
      try {
        const items = await fetchNews(args.pair || 'USDTRY');
        const limit = Math.min(Math.max(args.limit || 15, 1), 30);
        return {
          count: items.length,
          items: items.slice(0, limit).map((n) => ({
            title: n.title,
            url: n.url,
            provider: n.provider,
            datePublished: n.datePublished,
            description: n.description ? String(n.description).slice(0, 300) : undefined,
          })),
        };
      } catch (e) {
        return { error: e.message };
      }
    }
    case 'fetch_url': {
      if (!args.url) return { error: 'url required' };
      try {
        return await fetchUrlSafe(args.url);
      } catch (e) {
        return { error: e.message };
      }
    }
    case 'update_model_params':
      return { status: 'stub', note: 'Confirm via UI before applying.' };
    case 'run_backtest':
      return { status: 'stub', note: 'Backtest engine not yet implemented.' };
    default:
      return { error: `unknown tool ${name}` };
  }
}

function stubReply(message, pair) {
  const params = getAgentParams();
  const msg = message.toLowerCase();

  if (/param|tune|setting/.test(msg)) {
    return {
      content: `Current model parameters for ${pair}:\n\n` +
        `• Hold threshold: ${params.holdThreshold}\n` +
        `• Smooth-step threshold: ${params.smoothStepThreshold}\n` +
        `• Publish probability: ${params.publishProbability}\n` +
        `• Publish factor: ${params.publishFactor}\n` +
        `• Spread multiplier: ${params.spreadMultiplierMin}× – ${params.spreadMultiplierMax}×\n` +
        `• Auto-accept: ${params.autoAcceptThresholdMs / 1000}s\n\n` +
        `_(Live reasoning available once Azure OpenAI is configured.)_`,
      toolCalls: [{ name: 'get_model_params', args: {} }],
    };
  }

  if (/competitor|compar/.test(msg)) {
    return {
      content: `Competitor comparison for the last 5 minutes on ${pair} would require the competitor feed. This is a placeholder — the tool skeleton is in place and will run against real data once integrated.`,
      toolCalls: [{ name: 'compare_competitor', args: { pair, window_sec: 300 } }],
    };
  }

  if (/news/.test(msg)) {
    return {
      content: `Fetching latest ${pair} news is stubbed — news source needs to be wired. When live, this will summarize recent macro events, CBRT actions, and rate impact.`,
      toolCalls: [{ name: 'fetch_news', args: { pair, limit: 5 } }],
    };
  }

  return {
    content: `⚠️ Azure OpenAI is not configured yet. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT to enable live GPT-5.2 responses.\n\nYou asked: "${message}"`,
    toolCalls: [],
  };
}

async function handleChat({ pair = 'USDTRY', message, history = [] }) {
  if (!isConfigured()) {
    return stubReply(message, pair);
  }

  try {
    const systemPrompt =
      `You are an FX treasury pricing agent for ${pair}. ` +
      `You help operators inspect the pricing model, compare against competitors, ` +
      `fetch news, and tune parameters. ` +
      `When the user asks about a news article, first call fetch_news (or use the URL they provided) ` +
      `and then call fetch_url on the article link to read its body before summarizing. ` +
      `Cite the source name and prefer 3-5 bullet points. Be concise.`;

    // Sanitize history: only keep user/assistant string turns, cap length,
    // and skip anything that looks empty.
    const priorTurns = Array.isArray(history) ? history : [];
    const cleanHistory = priorTurns
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-20) // keep last 20 turns to bound token usage
      .map((m) => ({ role: m.role, content: m.content }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...cleanHistory,
      { role: 'user', content: message },
    ];

    const allToolCalls = [];
    const MAX_TURNS = 4;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const resp = await callAzureOpenAI(messages);
      const choice = resp.choices?.[0];
      const asstMsg = choice?.message || {};
      const toolCalls = asstMsg.tool_calls || [];

      if (toolCalls.length === 0) {
        return {
          content: asstMsg.content || '(no content)',
          toolCalls: allToolCalls,
        };
      }

      messages.push(asstMsg);
      for (const tc of toolCalls) {
        const name = tc.function?.name;
        let args = {};
        try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { /* ignore */ }
        allToolCalls.push({ name, args });
        const result = await executeTool(name, args);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result).slice(0, 20000),
        });
      }
    }

    return {
      content: '(tool loop exceeded — no final answer)',
      toolCalls: allToolCalls,
    };
  } catch (err) {
    console.error('[AgentChat] Azure OpenAI failed:', err.message);
    return {
      content: `⚠️ Azure OpenAI request failed: ${err.message}`,
      toolCalls: [],
    };
  }
}

module.exports = { handleChat, TOOLS, isConfigured };
