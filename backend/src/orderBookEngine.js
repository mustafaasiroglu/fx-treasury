// Synthetic Order Book Engine — generates buy/sell volumes at price levels
// Price levels are rounded to 2 decimal places

const { generateRates } = require('./rateEngine');

// Persistent order book state per pair
const books = {
  USDTRY: { levels: {}, lastUpdate: 0 },
  EURTRY: { levels: {}, lastUpdate: 0 },
};

const LEVEL_COUNT = 15; // levels above and below mid
const STEP = 0.01; // 2 decimal places
const UPDATE_INTERVAL_MS = 2000;

function roundToStep(val) {
  return Math.round(val / STEP) * STEP;
}

function generateOrderBook(pair = 'USDTRY') {
  const book = books[pair] || books.USDTRY;
  const now = Date.now();

  // Only regenerate periodically to keep consistent between polls
  if (now - book.lastUpdate < UPDATE_INTERVAL_MS && Object.keys(book.levels).length > 0) {
    return formatBook(book, pair);
  }

  const rates = generateRates(pair);
  const mid = rates.median;
  const roundedMid = roundToStep(mid);

  // Generate levels around the mid price
  const newLevels = {};

  for (let i = -LEVEL_COUNT; i <= LEVEL_COUNT; i++) {
    const price = roundToStep(roundedMid + i * STEP);
    const key = price.toFixed(2);

    // Existing volume decays slightly and gets new orders
    const existing = book.levels[key] || { buy: 0, sell: 0 };

    // Distance from mid affects distribution
    const dist = Math.abs(i);

    // Buy orders concentrate below mid, sell orders above mid
    let buyBase, sellBase;
    if (i < 0) {
      // Below mid: more buy orders, fewer sell orders
      buyBase = Math.max(0, 80 - dist * 3 + Math.random() * 40);
      sellBase = Math.max(0, 15 - dist * 2 + Math.random() * 10);
    } else if (i > 0) {
      // Above mid: more sell orders, fewer buy orders
      buyBase = Math.max(0, 15 - dist * 2 + Math.random() * 10);
      sellBase = Math.max(0, 80 - dist * 3 + Math.random() * 40);
    } else {
      // At mid: balanced
      buyBase = 40 + Math.random() * 30;
      sellBase = 40 + Math.random() * 30;
    }

    // Decay existing + add new
    const buy = Math.round(existing.buy * 0.6 + buyBase * 0.4);
    const sell = Math.round(existing.sell * 0.6 + sellBase * 0.4);

    newLevels[key] = { buy, sell };
  }

  book.levels = newLevels;
  book.lastUpdate = now;

  return formatBook(book, pair);
}

function formatBook(book, pair) {
  const levels = Object.entries(book.levels)
    .map(([price, vol]) => ({
      price: parseFloat(price),
      buy: vol.buy,
      sell: vol.sell,
    }))
    .sort((a, b) => b.price - a.price); // highest first

  const maxVol = Math.max(1, ...levels.map((l) => Math.max(l.buy, l.sell)));

  return { pair, levels, maxVolume: maxVol };
}

module.exports = { generateOrderBook };
