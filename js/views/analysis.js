/**
 * Investment Portfolio Manager — Technical Analysis Tab View
 * Manages the candlestick chart, indicators overlay, timeframe select, and watchlist select
 */

const AnalysisView = (() => {

  // ─── STATE ────────────────────────────────────────────────────────
  let currentSymbol = null;
  let currentTimeframe = '1M';
  let currentData = null;
  let currentIndicators = null;
  let currentScore = null;
  let refreshInterval = null;
  let isLoading = false;
  let currentRequestId = 0;

  // ─── DOM REFERENCES ───────────────────────────────────────────────
  const DOM = {};

  function cacheDOM() {
    DOM.assetSymbol = document.getElementById('asset-symbol');
    DOM.assetName = document.getElementById('asset-name');
    DOM.assetPrice = document.getElementById('asset-price');
    DOM.assetChange = document.getElementById('asset-change');
    DOM.lastUpdated = document.getElementById('last-updated');
    DOM.chartLoading = document.getElementById('chart-loading');
    
    // Search
    DOM.searchInput = document.getElementById('search-input');
    DOM.searchResults = document.getElementById('search-results');
    
    // Timeframe
    DOM.timeframeBar = document.getElementById('timeframe-bar');

    // Score Card
    DOM.scoreFill = document.getElementById('score-fill');
    DOM.scoreValue = document.getElementById('score-value');
    DOM.scoreSignal = document.getElementById('score-signal');
    DOM.scoreDetail = document.getElementById('score-detail');

    // Indicator Card DOM fields
    const indicatorsList = ['rsi', 'macd', 'ma', 'bb', 'vol'];
    indicatorsList.forEach(ind => {
      DOM[`${ind}Value`] = document.getElementById(`${ind}-value`);
      DOM[`${ind}Signal`] = document.getElementById(`${ind}-signal`);
      DOM[`${ind}Detail`] = document.getElementById(`${ind}-detail`);
      DOM[`${ind}Bar`] = document.getElementById(`${ind}-bar`);
    });
  }

  // ─── LIFECYCLE HOOKS ──────────────────────────────────────────────
  function onEnter() {
    cacheDOM();
    bindEvents();
    
    // Re-initialize charts if they haven't been or need re-sizing
    ChartModule.init('main-chart', 'volume-chart');
    ChartModule.updateTheme();
    
    // Select first asset in watchlist or 'BTC' as fallback
    const activeWatchlistSymbol = WatchlistManager.getActive() || 'BTC';
    if (!currentSymbol || currentSymbol !== activeWatchlistSymbol) {
      loadAsset(activeWatchlistSymbol);
    } else {
      // Re-draw chart to ensure container sizing aligns correctly after tab transition
      if (currentData && currentIndicators) {
        setTimeout(() => {
          ChartModule.setData(currentData.ohlcv, currentIndicators);
        }, 100);
      }
    }

    startAutoRefresh();
  }

  function onLeave() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  }

  // ─── EVENTS ───────────────────────────────────────────────────────
  function bindEvents() {
    // Timeframe bar
    DOM.timeframeBar.addEventListener('click', handleTimeframeChange);

    // Search bar
    DOM.searchInput.addEventListener('input', handleSearchInput);
    DOM.searchInput.addEventListener('focus', handleSearchInput);
    DOM.searchInput.addEventListener('blur', () => {
      setTimeout(() => DOM.searchResults.classList.remove('active'), 250);
    });
  }

  function handleTimeframeChange(e) {
    const btn = e.target.closest('.timeframe-btn');
    if (!btn) return;
    const tf = btn.dataset.tf;
    if (tf === currentTimeframe) return;

    DOM.timeframeBar.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentTimeframe = tf;
    if (currentSymbol) {
      loadAsset(currentSymbol);
    }
  }

  function handleSearchInput() {
    const query = DOM.searchInput.value.trim();
    if (query.length === 0) {
      DOM.searchResults.classList.remove('active');
      return;
    }

    const results = DataAPI.searchAssets(query);
    if (results.length === 0) {
      DOM.searchResults.classList.remove('active');
      return;
    }

    DOM.searchResults.innerHTML = results.map(asset => `
      <div class="search-results__item" data-symbol="${asset.symbol}">
        <div>
          <span class="search-results__item-symbol">${asset.symbol}</span>
          <span class="search-results__item-name">${asset.name}</span>
        </div>
        <span class="search-results__item-type" data-type="${asset.type}">${asset.type}</span>
      </div>
    `).join('');

    DOM.searchResults.querySelectorAll('.search-results__item').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const symbol = item.dataset.symbol;

        // Add to watchlist
        WatchlistManager.add(symbol);
        WatchlistManager.setActive(symbol);

        // Clear search
        DOM.searchInput.value = '';
        DOM.searchResults.classList.remove('active');

        // Load asset
        loadAsset(symbol);
      });
    });

    DOM.searchResults.classList.add('active');
  }

  // ─── LOAD ASSET ───────────────────────────────────────────────────
  async function loadAsset(symbol) {
    const requestId = ++currentRequestId;
    currentSymbol = symbol;
    
    // Sync the Watchlist's active item
    WatchlistManager.setActiveSymbolQuiet(symbol);

    const asset = DataAPI.getAsset(symbol);
    if (!asset) {
      console.error('Unknown asset:', symbol);
      return;
    }

    // Prepare display state
    if (!DOM.assetSymbol) cacheDOM();
    DOM.assetSymbol.textContent = symbol;
    DOM.assetName.textContent = asset.name;
    DOM.assetPrice.textContent = '...';
    DOM.assetChange.textContent = '...';
    DOM.assetChange.className = 'asset-header__change';

    setLoading(true);

    try {
      const data = await DataAPI.fetchAssetData(symbol, currentTimeframe);

      // Avoid rendering stale requests
      if (requestId !== currentRequestId) return;

      currentData = data;

      // Update price display
      updatePriceDisplay(data);

      // Compute indicators
      const indicators = Indicators.computeAll(data.ohlcv);
      currentIndicators = indicators;

      // Calculate score
      const score = ScoreEngine.calculate(indicators);
      currentScore = score;

      // Update chart
      ChartModule.setData(data.ohlcv, indicators);

      // Update indicators card score metrics
      updateAnalysisPanels(score);

      // Update Watchlist background values
      if (data.market) {
        WatchlistManager.updatePrice(symbol, data.market.price, data.market.change24h);
      }

      // Update last refreshed status
      const timeStr = new Date().toLocaleTimeString();
      DOM.lastUpdated.textContent = `Updated: ${timeStr}`;
      
      // Background pull for other watchlist prices
      WatchlistManager.updateAllWatchlistPrices();

    } catch (err) {
      if (requestId !== currentRequestId) return;
      console.error('Failed to load asset details:', err);
      if (window.App && window.App.showToast) {
        window.App.showToast(`Failed to load ${symbol}: ${err.message}`, 'error');
      }
    } finally {
      if (requestId === currentRequestId) {
        setLoading(false);
      }
    }
  }

  function updatePriceDisplay(data) {
    const { market } = data;
    if (!market) return;

    // Currency label mapping
    const curSymbol = market.currency === 'THB' ? '฿' : '$';
    DOM.assetPrice.textContent = `${curSymbol}${WatchlistManager.formatPrice(market.price)}`;

    if (market.change24h !== null && market.change24h !== undefined) {
      const sign = market.change24h >= 0 ? '+' : '';
      DOM.assetChange.textContent = `${sign}${market.change24h.toFixed(2)}%`;
      DOM.assetChange.className = `asset-header__change ${market.change24h >= 0 ? 'positive' : 'negative'}`;
    }
  }

  function updateAnalysisPanels(score) {
    if (!score || score.total === null) {
      DOM.scoreValue.textContent = '—';
      DOM.scoreSignal.textContent = 'No Data';
      DOM.scoreDetail.textContent = 'Insufficient data for analysis';
      return;
    }

    // Gauge circle calculation
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (score.total / 100) * circumference;
    const scoreColor = ScoreEngine.getScoreColor(score.total);

    DOM.scoreFill.style.strokeDashoffset = offset;
    DOM.scoreFill.style.stroke = scoreColor;
    DOM.scoreValue.textContent = score.total;
    DOM.scoreValue.style.color = scoreColor;
    DOM.scoreSignal.textContent = score.label;
    DOM.scoreSignal.setAttribute('data-signal', score.signal);

    const signals = Object.values(score.breakdown);
    const bullish = signals.filter(s => s.signal === 'bullish').length;
    const bearish = signals.filter(s => s.signal === 'bearish').length;
    const neutral = signals.filter(s => s.signal === 'neutral').length;
    DOM.scoreDetail.textContent = `${bullish} Bullish · ${neutral} Neutral · ${bearish} Bearish`;

    // Render individual indicators
    const { breakdown } = score;

    updateIndicatorCard('rsi', breakdown.rsi, (b) => {
      const rsiVal = b.value !== null && b.value !== undefined ? b.value.toFixed(1) : '—';
      return { value: rsiVal, barWidth: b.value || 50 };
    });

    updateIndicatorCard('macd', breakdown.macd, (b) => {
      const macdVal = b.value !== null && b.value !== undefined ? b.value.toFixed(4) : '—';
      return { value: macdVal, barWidth: b.score };
    });

    updateIndicatorCard('ma', breakdown.movingAverages, (b) => {
      return { value: b.detail.split(':')[1]?.trim() || b.signal, barWidth: b.score };
    });

    updateIndicatorCard('bb', breakdown.bollingerBands, (b) => {
      return { value: `${b.score}%`, barWidth: b.score };
    });

    updateIndicatorCard('vol', breakdown.volume, (b) => {
      return { value: b.detail.split('—')[0]?.trim() || b.signal, barWidth: b.score };
    });
  }

  function updateIndicatorCard(prefix, data, formatter) {
    const valueEl = DOM[`${prefix}Value`];
    const signalEl = DOM[`${prefix}Signal`];
    const detailEl = DOM[`${prefix}Detail`];
    const barEl = DOM[`${prefix}Bar`];

    if (!data || !valueEl) return;

    const formatted = formatter(data);
    valueEl.textContent = formatted.value;

    signalEl.textContent = data.signal.charAt(0).toUpperCase() + data.signal.slice(1);
    signalEl.className = `indicator-card__signal ${data.signal}`;

    detailEl.textContent = data.detail;

    const barWidth = Math.max(2, Math.min(100, formatted.barWidth || 50));
    barEl.style.width = `${barWidth}%`;
    barEl.style.background = ScoreEngine.getScoreColor(data.score);
  }

  function setLoading(state) {
    isLoading = state;
    if (DOM.chartLoading) {
      DOM.chartLoading.classList.toggle('active', state);
    }
  }

  function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      if (currentSymbol && !isLoading && Router.getCurrentRoute() === '#analysis') {
        DataAPI.clearCache();
        loadAsset(currentSymbol);
      }
    }, 60000);
  }

  return {
    onEnter,
    onLeave,
    loadAsset,
    getCurrentSymbol: () => currentSymbol
  };
})();
