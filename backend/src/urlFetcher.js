// Safe URL fetcher for agent tool use.
// Guards against SSRF, oversized responses, and non-http(s) schemes.
// Returns plaintext extracted from HTML (or raw text/xml/json) truncated to a safe size.

const dns = require('dns').promises;
const net = require('net');

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB hard cap
const MAX_TEXT_CHARS = 12000;      // truncate extracted text
const TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36 FXTreasuryAgent/1.0';

// RFC1918 + loopback + link-local + reserved ranges
function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;   // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true;                  // multicast + reserved
  return false;
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
  if (lower.startsWith('fe80')) return true;                          // link-local
  if (lower.startsWith('::ffff:')) {
    // IPv4-mapped
    const v4 = lower.slice(7);
    if (net.isIPv4(v4)) return isPrivateIPv4(v4);
  }
  return false;
}

async function assertPublicHost(hostname) {
  // Reject bracketed IPv6 literals cleanly
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIPv4(host)) {
    if (isPrivateIPv4(host)) throw new Error(`blocked private IPv4: ${host}`);
    return;
  }
  if (net.isIPv6(host)) {
    if (isPrivateIPv6(host)) throw new Error(`blocked private IPv6: ${host}`);
    return;
  }
  // Reject obvious internal names
  if (/^(localhost|.*\.local|.*\.internal|.*\.lan)$/i.test(host)) {
    throw new Error(`blocked internal hostname: ${host}`);
  }
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch (e) {
    throw new Error(`DNS lookup failed for ${host}: ${e.message}`);
  }
  for (const a of addrs) {
    if (a.family === 4 && isPrivateIPv4(a.address)) {
      throw new Error(`blocked private IP for ${host}: ${a.address}`);
    }
    if (a.family === 6 && isPrivateIPv6(a.address)) {
      throw new Error(`blocked private IP for ${host}: ${a.address}`);
    }
  }
}

function stripHtmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractMeta(html) {
  const pick = (re) => {
    const m = html.match(re);
    return m ? m[1].trim() : undefined;
  };
  const title =
    pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<title[^>]*>([^<]+)<\/title>/i);
  const description =
    pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const publishedTime = pick(
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
  );
  return { title, description, publishedTime };
}

async function readCapped(res) {
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new Error(`response exceeds ${MAX_BYTES} bytes`);
    }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return buf;
}

async function fetchOnce(target) {
  const u = new URL(target);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(`unsupported protocol: ${u.protocol}`);
  }
  await assertPublicHost(u.hostname);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), {
      redirect: 'manual',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.8,tr;q=0.6',
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchUrlSafe(target) {
  let current = target;
  let res;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    res = await fetchOnce(current);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) break;
      current = new URL(loc, current).toString();
      continue;
    }
    break;
  }

  const status = res.status;
  const finalUrl = current;
  const ctype = (res.headers.get('content-type') || '').toLowerCase();

  if (!res.ok) {
    return { status, finalUrl, contentType: ctype, error: `HTTP ${status}` };
  }

  const buf = await readCapped(res);
  const raw = buf.toString('utf8');

  if (ctype.includes('application/json')) {
    const snippet = raw.slice(0, MAX_TEXT_CHARS);
    return { status, finalUrl, contentType: ctype, text: snippet };
  }
  if (ctype.includes('html') || raw.trimStart().startsWith('<')) {
    const meta = extractMeta(raw);
    const text = stripHtmlToText(raw).slice(0, MAX_TEXT_CHARS);
    return { status, finalUrl, contentType: ctype, ...meta, text };
  }
  return { status, finalUrl, contentType: ctype, text: raw.slice(0, MAX_TEXT_CHARS) };
}

module.exports = { fetchUrlSafe };
