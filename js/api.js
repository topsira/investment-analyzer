/**
 * Investment Analyzer — Data API Layer
 * Fetches market data from CoinGecko (Crypto) and Yahoo Finance (Stocks/Gold)
 */

const DataAPI = (() => {

  // ─── ASSET REGISTRY ───────────────────────────────────────────────

  const ASSET_REGISTRY = {
    // Crypto — via CoinGecko
    BTC:  { source: 'coingecko', id: 'bitcoin', name: 'Bitcoin', type: 'crypto', symbol: 'BTC' },
    ETH:  { source: 'coingecko', id: 'ethereum', name: 'Ethereum', type: 'crypto', symbol: 'ETH' },
    SOL:  { source: 'coingecko', id: 'solana', name: 'Solana', type: 'crypto', symbol: 'SOL' },
    BNB:  { source: 'coingecko', id: 'binancecoin', name: 'BNB', type: 'crypto', symbol: 'BNB' },
    XRP:  { source: 'coingecko', id: 'ripple', name: 'XRP', type: 'crypto', symbol: 'XRP' },
    ADA:  { source: 'coingecko', id: 'cardano', name: 'Cardano', type: 'crypto', symbol: 'ADA' },
    DOGE: { source: 'coingecko', id: 'dogecoin', name: 'Dogecoin', type: 'crypto', symbol: 'DOGE' },
    DOT:  { source: 'coingecko', id: 'polkadot', name: 'Polkadot', type: 'crypto', symbol: 'DOT' },
    AVAX: { source: 'coingecko', id: 'avalanche-2', name: 'Avalanche', type: 'crypto', symbol: 'AVAX' },
    LINK: { source: 'coingecko', id: 'chainlink', name: 'Chainlink', type: 'crypto', symbol: 'LINK' },

    // US Stocks — via Yahoo Finance
    AAPL: { source: 'yahoo', id: 'AAPL', name: 'Apple Inc.', type: 'stock', symbol: 'AAPL' },
    MSFT: { source: 'yahoo', id: 'MSFT', name: 'Microsoft Corp.', type: 'stock', symbol: 'MSFT' },
    GOOGL: { source: 'yahoo', id: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', symbol: 'GOOGL' },
    AMZN: { source: 'yahoo', id: 'AMZN', name: 'Amazon.com', type: 'stock', symbol: 'AMZN' },
    TSLA: { source: 'yahoo', id: 'TSLA', name: 'Tesla Inc.', type: 'stock', symbol: 'TSLA' },
    NVDA: { source: 'yahoo', id: 'NVDA', name: 'NVIDIA Corp.', type: 'stock', symbol: 'NVDA' },
    META: { source: 'yahoo', id: 'META', name: 'Meta Platforms', type: 'stock', symbol: 'META' },

    // Commodities — via Yahoo Finance
    GOLD: { source: 'yahoo', id: 'GC=F', name: 'Gold Futures', type: 'commodity', symbol: 'GOLD' },
    SILVER: { source: 'yahoo', id: 'SI=F', name: 'Silver Futures', type: 'commodity', symbol: 'SILVER' },
    OIL:  { source: 'yahoo', id: 'CL=F', name: 'Crude Oil Futures', type: 'commodity', symbol: 'OIL' },

    // Thai Stocks (SET) — via Yahoo Finance (suffix .BK)
    'PTT': { source: 'yahoo', id: 'PTT.BK', name: 'PTT PCL', type: 'stock-th', symbol: 'PTT' },
    'SCC': { source: 'yahoo', id: 'SCC.BK', name: 'Siam Cement', type: 'stock-th', symbol: 'SCC' },
    'ADVANC': { source: 'yahoo', id: 'ADVANC.BK', name: 'Advanced Info Service', type: 'stock-th', symbol: 'ADVANC' },
    'CPALL': { source: 'yahoo', id: 'CPALL.BK', name: 'CP ALL PCL', type: 'stock-th', symbol: 'CPALL' },
    'KBANK': { source: 'yahoo', id: 'KBANK.BK', name: 'Kasikornbank', type: 'stock-th', symbol: 'KBANK' },
  };

  // ─── TIMEFRAME MAPPING ────────────────────────────────────────────

  const TIMEFRAMES = {
    '1D':  { cgDays: 1,   yahooRange: '1d',  yahooInterval: '5m'  },
    '7D':  { cgDays: 7,   yahooRange: '5d',  yahooInterval: '15m' },
    '1M':  { cgDays: 30,  yahooRange: '1mo', yahooInterval: '1h'  },
    '3M':  { cgDays: 90,  yahooRange: '3mo', yahooInterval: '1d'  },
    '6M':  { cgDays: 180, yahooRange: '6mo', yahooInterval: '1d'  },
    '1Y':  { cgDays: 365, yahooRange: '1y',  yahooInterval: '1d'  },
  };

  // ─── IN-MEMORY CACHE ──────────────────────────────────────────────

  const cache = new Map();
  const CACHE_TTL = 60 * 1000; // 1 minute

  function getCacheKey(symbol, timeframe) {
    return `${symbol}:${timeframe}`;
  }

  function getFromCache(key) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
    cache.delete(key);
    return null;
  }

  function setCache(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
  }

  // ─── CORS PROXY ───────────────────────────────────────────────────

  const CORS_PROXIES = [
    'https://api.allorigins.win/raw?url=',
    'https://corsproxy.io/?',
    'https://api.codetabs.com/v1/proxy?quest='
  ];

  let currentProxyIndex = 0;

  async function fetchWithProxy(url) {
    // Try each proxy in sequence
    for (let attempt = 0; attempt < CORS_PROXIES.length; attempt++) {
      const proxyIdx = (currentProxyIndex + attempt) % CORS_PROXIES.length;
      const proxyUrl = CORS_PROXIES[proxyIdx] + encodeURIComponent(url);
      try {
        const response = await fetch(proxyUrl);
        if (response.ok) {
          currentProxyIndex = proxyIdx; // Remember working proxy
          return response;
        }
      } catch (e) {
        console.warn(`Proxy ${proxyIdx} failed:`, e.message);
      }
    }
    throw new Error('All CORS proxies failed. Please try again later.');
  }

  // ─── COINGECKO API ────────────────────────────────────────────────

  /**
   * Fetch OHLC data from CoinGecko
   */
  async function fetchCoinGeckoOHLC(coinId, days) {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) throw new Error('Rate limited by CoinGecko. Please wait a moment.');
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    // CoinGecko OHLC format: [[timestamp, open, high, low, close], ...]
    return data.map(candle => ({
      time: Math.floor(candle[0] / 1000), // Convert ms to seconds
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: 0 // OHLC endpoint doesn't include volume
    }));
  }

  /**
   * Fetch market data (price, volume, etc.) from CoinGecko
   */
  async function fetchCoinGeckoMarket(coinId) {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`CoinGecko market data error: ${response.status}`);

    const data = await response.json();
    return {
      price: data.market_data.current_price.usd,
      change24h: data.market_data.price_change_percentage_24h,
      high24h: data.market_data.high_24h.usd,
      low24h: data.market_data.low_24h.usd,
      marketCap: data.market_data.market_cap.usd,
      volume24h: data.market_data.total_volume.usd,
    };
  }

  /**
   * Fetch volume data separately for crypto (market_chart endpoint)
   */
  async function fetchCoinGeckoVolume(coinId, days) {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return (data.total_volumes || []).map(v => ({
      time: Math.floor(v[0] / 1000),
      value: v[1]
    }));
  }

  // ─── YAHOO FINANCE API ────────────────────────────────────────────

  /**
   * Fetch OHLCV data from Yahoo Finance
   */
  async function fetchYahooOHLCV(symbol, range, interval) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}&includePrePost=false`;
    const response = await fetchWithProxy(url);

    if (!response.ok) throw new Error(`Yahoo Finance API error: ${response.status}`);

    const data = await response.json();

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      throw new Error('No data returned from Yahoo Finance');
    }

    const result = data.chart.result[0];
    const timestamps = result.timestamp || [];
    const quote = result.indicators.quote[0];

    const ohlcv = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] !== null && quote.close[i] !== null) {
        ohlcv.push({
          time: timestamps[i],
          open: quote.open[i],
          high: quote.high[i],
          low: quote.low[i],
          close: quote.close[i],
          volume: quote.volume[i] || 0
        });
      }
    }

    // Extract market info
    const meta = result.meta;
    const marketInfo = {
      price: meta.regularMarketPrice,
      previousClose: meta.chartPreviousClose || meta.previousClose,
      change24h: meta.chartPreviousClose
        ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose * 100)
        : 0,
      currency: meta.currency,
      exchangeName: meta.exchangeName,
    };

    return { ohlcv, marketInfo };
  }

  // ─── UNIFIED FETCH ────────────────────────────────────────────────

  /**
   * Fetch asset data regardless of source
   * @param {string} symbol - Asset symbol (e.g., 'BTC', 'AAPL')
   * @param {string} timeframe - '1D', '7D', '1M', '3M', '6M', '1Y'
   * @returns {Promise<{ohlcv: Array, market: object, asset: object}>}
   */
  async function fetchAssetData(symbol, timeframe = '3M') {
    const asset = ASSET_REGISTRY[symbol];
    if (!asset) throw new Error(`Unknown asset: ${symbol}`);

    const tf = TIMEFRAMES[timeframe];
    if (!tf) throw new Error(`Unknown timeframe: ${timeframe}`);

    // Check cache
    const cacheKey = getCacheKey(symbol, timeframe);
    const cached = getFromCache(cacheKey);
    if (cached) return cached;

    let result;

    if (asset.source === 'coingecko') {
      // Fetch OHLC + market data in parallel
      const [ohlcv, market, volumeData] = await Promise.all([
        fetchCoinGeckoOHLC(asset.id, tf.cgDays),
        fetchCoinGeckoMarket(asset.id),
        fetchCoinGeckoVolume(asset.id, tf.cgDays)
      ]);

      // Merge volume data into OHLCV by nearest timestamp
      if (volumeData.length > 0) {
        for (const candle of ohlcv) {
          const nearest = volumeData.reduce((prev, curr) =>
            Math.abs(curr.time - candle.time) < Math.abs(prev.time - candle.time) ? curr : prev
          );
          candle.volume = nearest.value || 0;
        }
      }

      result = { ohlcv, market, asset };
    } else if (asset.source === 'yahoo') {
      const { ohlcv, marketInfo } = await fetchYahooOHLCV(asset.id, tf.yahooRange, tf.yahooInterval);

      result = {
        ohlcv,
        market: {
          price: marketInfo.price,
          change24h: marketInfo.change24h,
          currency: marketInfo.currency,
          exchangeName: marketInfo.exchangeName,
        },
        asset
      };
    } else {
      throw new Error(`Unknown data source: ${asset.source}`);
    }

    // Cache result
    setCache(cacheKey, result);

    return result;
  }

  // ─── SEARCH ───────────────────────────────────────────────────────

  /**
   * Search assets by symbol or name
   * @param {string} query
   * @returns {Array<object>}
   */
  function searchAssets(query) {
    if (!query || query.length === 0) return [];
    const q = query.toUpperCase().trim();
    return Object.entries(ASSET_REGISTRY)
      .filter(([sym, asset]) =>
        sym.includes(q) || asset.name.toUpperCase().includes(q) || asset.id.toUpperCase().includes(q)
      )
      .map(([sym, asset]) => ({ ...asset, symbol: sym }))
      .slice(0, 10);
  }

  /**
   * Get asset info by symbol
   * @param {string} symbol
   * @returns {object|null}
   */
  function getAsset(symbol) {
    return ASSET_REGISTRY[symbol] || null;
  }

  /**
   * Get all available assets
   * @returns {Array<object>}
   */
  function getAllAssets() {
    return Object.entries(ASSET_REGISTRY).map(([sym, asset]) => ({
      ...asset, symbol: sym
    }));
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────

  return {
    fetchAssetData,
    searchAssets,
    getAsset,
    getAllAssets,
    TIMEFRAMES,
    ASSET_REGISTRY,
    clearCache: () => cache.clear()
  };

})();
