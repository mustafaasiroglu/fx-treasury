// RSS-based news aggregator. Pulls FX & TRY-related feeds from Reuters,
// Investing.com and Bloomberg, merges and de-duplicates by title.

const { XMLParser } = require('fast-xml-parser');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

const CACHE_TTL_MS = 5 * 60_000; // 5 min
const cache = new Map(); // pair -> { ts, items }

// Feed sources. Some publishers block bots; we keep a Windows browser UA below.
const FEEDS = {
  common: [
    { name: 'Investing.com',   url: 'https://www.investing.com/rss/news_1.rss' },        // Forex news
    { name: 'Investing.com',   url: 'https://www.investing.com/rss/market_overview.rss' },
    { name: 'Reuters (Yahoo)', url: 'https://finance.yahoo.com/news/rssindex' },         // Yahoo (Reuters syndication)
    { name: 'FT Currencies',   url: 'https://www.ft.com/currencies?format=rss' },
  ],
  USDTRY: [
    { name: 'Investing.com',   url: 'https://www.investing.com/rss/currencies_USD_TRY.rss' },
    { name: 'Google News',     url: 'https://news.google.com/rss/search?q=USD+TRY+forex&hl=en-US&gl=US&ceid=US:en' },
    { name: 'Google News TR',  url: 'https://news.google.com/rss/search?q=dolar+TL+kur&hl=tr&gl=TR&ceid=TR:tr' },
  ],
  EURTRY: [
    { name: 'Investing.com',   url: 'https://www.investing.com/rss/currencies_EUR_TRY.rss' },
    { name: 'Google News',     url: 'https://news.google.com/rss/search?q=EUR+TRY+forex&hl=en-US&gl=US&ceid=US:en' },
    { name: 'Google News TR',  url: 'https://news.google.com/rss/search?q=euro+TL+kur&hl=tr&gl=TR&ceid=TR:tr' },
  ],
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0 Safari/537.36';

function stripHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toRawObject(node) {
  // Flatten simple RSS fields to a { key: string } dictionary for the UI
  const out = {};
  if (!node || typeof node !== 'object') return out;
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('@_')) continue;
    if (v == null) continue;
    if (typeof v === 'string' || typeof v === 'number') {
      out[k] = stripHtml(String(v));
    } else if (typeof v === 'object') {
      if (v['#text']) out[k] = stripHtml(String(v['#text']));
      else if (v['@_href']) out[k] = String(v['@_href']);
      else if (v['@_url']) out[k] = String(v['@_url']);
      // else skip nested objects/arrays we can't render simply
    }
  }
  return out;
}

function parseFeed(xml, providerHint) {
  let doc;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  // RSS 2.0
  const rssItems = doc?.rss?.channel?.item;
  if (rssItems) {
    const arr = Array.isArray(rssItems) ? rssItems : [rssItems];
    return arr.map((it) => ({
      title: stripHtml(it.title),
      url: typeof it.link === 'string' ? it.link : it.link?.['@_href'] || it.link?.['#text'] || '',
      description: stripHtml(it.description || it['content:encoded'] || ''),
      datePublished: it.pubDate ? new Date(it.pubDate).toISOString() : null,
      provider: stripHtml(it['dc:creator'] || it.source?.['#text'] || it.source || providerHint),
      categories: []
        .concat(it.category || [])
        .map((c) => (typeof c === 'string' ? c : c?.['#text']))
        .filter(Boolean),
      raw: toRawObject(it),
    }));
  }
  // Atom
  const atomEntries = doc?.feed?.entry;
  if (atomEntries) {
    const arr = Array.isArray(atomEntries) ? atomEntries : [atomEntries];
    return arr.map((e) => ({
      title: stripHtml(e.title?.['#text'] || e.title),
      url: e.link?.['@_href'] || (Array.isArray(e.link) ? e.link[0]?.['@_href'] : '') || '',
      description: stripHtml(e.summary?.['#text'] || e.summary || e.content?.['#text'] || e.content || ''),
      datePublished: e.updated || e.published || null,
      provider: providerHint,
      categories: [].concat(e.category || []).map((c) => c?.['@_term']).filter(Boolean),
      raw: toRawObject(e),
    }));
  }
  return [];
}

async function fetchOne({ name, url }) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseFeed(xml, name);
  } catch {
    return [];
  }
}

async function fetchNews({ pair = 'USDTRY' } = {}) {
  const cached = cache.get(pair);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.items;

  const feeds = [...FEEDS.common, ...(FEEDS[pair] || [])];
  const results = await Promise.all(feeds.map(fetchOne));

  // Merge, de-dupe by title, filter empty, sort by date desc
  const seen = new Set();
  const merged = [];
  for (const arr of results) {
    for (const item of arr) {
      if (!item.title || !item.url) continue;
      const key = item.title.toLowerCase().slice(0, 100);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  merged.sort((a, b) => {
    const ta = a.datePublished ? new Date(a.datePublished).getTime() : 0;
    const tb = b.datePublished ? new Date(b.datePublished).getTime() : 0;
    return tb - ta;
  });

  const items = merged.slice(0, 40);
  cache.set(pair, { ts: Date.now(), items });
  return items;
}

module.exports = { fetchNews };
