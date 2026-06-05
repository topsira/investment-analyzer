/**
 * Investment Analyzer — Main App Controller
 * Orchestrates all modules: theme, watchlist, chart, indicators, score
 */

const App = (() => {

  // ─── STATE ────────────────────────────────────────────────────────

  let currentSymbol = null;
  let currentTimeframe = '1M';
  let currentData = null;
  let currentIndicators = null;
  let currentScore = null;
  let refreshInterval = null;
  let isLoading = false;

  // ─── DOM REFERENCES ───────────────────────────────────────────────

  const DOM = {};

  function cacheDOMRefs() {
    DOM.assetSymbol = document.getElementById('asset-symbol');
    DOM.assetName = document.getElementById('asset-name');
    DOM.assetPrice = document.getElementById('asset-price');
    DOM.assetChange = document.getElementById('asset-change');
    DOM.lastUpdated = document.getElementById('last-updated');
    DOM.chartLoading = document.getElementById('chart-loading');
    DOM.searchInput = document.getElementById('search-input');
    DOM.searchResults = document.getElementById('search-results');
    DOM.themeToggle = document.getElementById('theme-toggle');
    DOM.sidebarToggle = document.getElementById('sidebar-toggle');
    DOM.sidebar = document.getElementById('sidebar');
    DOM.sidebarOverlay = document.getElementById('sidebar-overlay');
    DOM.timeframeBar = document.getElementById('timeframe-bar');
    DOM.toastContainer = document.getElementById('toast-container');

    // Score
    DOM.scoreFill = document.getElementById('score-fill');
    DOM.scoreValue = document.getElementById('score-value');
    DOM.scoreSignal = document.getElementById('score-signal');
    DOM.scoreDetail = document.getElementById('score-detail');

    // Indicators
    DOM.rsiValue = document.getElementById('rsi-value');
    DOM.rsiSignal = document.getElementById('rsi-signal');
    DOM.rsiDetail = document.getElementById('rsi-detail');
    DOM.rsiBar = document.getElementById('rsi-bar');

    DOM.macdValue = document.getElementById('macd-value');
    DOM.macdSignal = document.getElementById('macd-signal');
    DOM.macdDetail = document.getElementById('macd-detail');
    DOM.macdBar = document.getElementById('macd-bar');

    DOM.maValue = document.getElementById('ma-value');
    DOM.maSignal = document.getElementById('ma-signal');
    DOM.maDetail = document.getElementById('ma-detail');
    DOM.maBar = document.getElementById('ma-bar');

    DOM.bbValue = document.getElementById('bb-value');
    DOM.bbSignal = document.getElementById('bb-signal');
    DOM.bbDetail = document.getElementById('bb-detail');
    DOM.bbBar = document.getElementById('bb-bar');

    DOM.volValue = document.getElementById('vol-value');
    DOM.volSignal = document.getElementById('vol-signal');
    DOM.volDetail = document.getElementById('vol-detail');
    DOM.volBar = document.getElementById('vol-bar');
  }

  // ─── INITIALIZATION ───────────────────────────────────────────────

  function init() {
    cacheDOMRefs();

    // Initialize theme
    ThemeManager.init();
    ThemeManager.onChange(() => {
      ChartModule.updateTheme();
      // Reload data to re-render chart with new theme
      if (currentData && currentIndicators) {
        ChartModule.setData(currentData.ohlcv, currentIndicators);
      }
    });

    // Initialize chart
    ChartModule.init('main-chart', 'volume-chart');

    // Initialize watchlist
    WatchlistManager.init(
      document.getElementById('watchlist'),
      (symbol) => loadAsset(symbol)
    );

    // Bind events
    bindEvents();

    // Start auto-refresh
    startAutoRefresh();
  }

  // ─── EVENT BINDINGS ───────────────────────────────────────────────

  function bindEvents() {
    // Theme toggle
    DOM.themeToggle.addEventListener('click', () => ThemeManager.toggle());

    // Sidebar toggle (mobile)
    DOM.sidebarToggle.addEventListener('click', () => {
      DOM.sidebar.classList.toggle('open');
      DOM.sidebarOverlay.classList.toggle('open');
    });
    DOM.sidebarOverlay.addEventListener('click', () => {
      DOM.sidebar.classList.remove('open');
      DOM.sidebarOverlay.classList.remove('open');
    });

    // Timeframe buttons
    DOM.timeframeBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.timeframe-btn');
      if (!btn) return;
      const tf = btn.dataset.tf;
      if (tf === currentTimeframe) return;

      // Update active button
      DOM.timeframeBar.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentTimeframe = tf;
      if (currentSymbol) loadAsset(currentSymbol);
    });

    // Search input
    DOM.searchInput.addEventListener('input', handleSearch);
    DOM.searchInput.addEventListener('focus', handleSearch);
    DOM.searchInput.addEventListener('blur', () => {
      // Delay hide to allow click on results
      setTimeout(() => DOM.searchResults.classList.remove('active'), 200);
    });

    // Keyboard shortcut: Escape to close search
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        DOM.searchResults.classList.remove('active');
        DOM.searchInput.blur();
        DOM.sidebar.classList.remove('open');
        DOM.sidebarOverlay.classList.remove('open');
      }
    });
  }

  // ─── SEARCH ───────────────────────────────────────────────────────

  function handleSearch() {
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

    // Bind click events
    DOM.searchResults.querySelectorAll('.search-results__item').forEach(item => {
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const symbol = item.dataset.symbol;

        // Add to watchlist if not already
        WatchlistManager.add(symbol);
        WatchlistManager.setActive(symbol);

        // Clear search
        DOM.searchInput.value = '';
        DOM.searchResults.classList.remove('active');

        // Close sidebar on mobile
        DOM.sidebar.classList.remove('open');
        DOM.sidebarOverlay.classList.remove('open');
      });
    });

    DOM.searchResults.classList.add('active');
  }

  // ─── LOAD ASSET DATA ─────────────────────────────────────────────

  let currentRequestId = 0;

  async function loadAsset(symbol) {
    // Generate a unique request ID to handle race conditions
    const requestId = ++currentRequestId;

    currentSymbol = symbol;
    const asset = DataAPI.getAsset(symbol);
    if (!asset) {
      showToast('Asset not found', 'error');
      return;
    }

    // Update header immediately
    DOM.assetSymbol.textContent = symbol;
    DOM.assetName.textContent = asset.name;
    DOM.assetPrice.textContent = '...';
    DOM.assetChange.textContent = '...';
    DOM.assetChange.className = 'asset-header__change';

    // Show loading
    setLoading(true);

    try {
      // Clear cache for fresh data on explicit load
      const data = await DataAPI.fetchAssetData(symbol, currentTimeframe);

      // Check if this request is still the latest one (user might have clicked another asset/timeframe)
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

      // Update analysis panels
      updateAnalysisPanels(score);

      // Update watchlist price
      if (data.market) {
        WatchlistManager.updatePrice(symbol, data.market.price, data.market.change24h);
      }

      // Update timestamp
      DOM.lastUpdated.textContent = `Updated: ${new Date().toLocaleTimeString()}`;

      // Fetch prices for other watchlist items (background)
      fetchWatchlistPrices(symbol);

    } catch (error) {
      if (requestId !== currentRequestId) return; // Stale request, ignore
      console.error('Failed to load asset:', error);
      showToast(`Failed to load ${symbol}: ${error.message}`, 'error');
    } finally {
      if (requestId === currentRequestId) {
        setLoading(false);
      }
    }
  }

  // ─── UPDATE DISPLAYS ─────────────────────────────────────────────

  function updatePriceDisplay(data) {
    const { market } = data;
    if (!market) return;

    DOM.assetPrice.textContent = WatchlistManager.formatPrice(market.price);

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

    // ── Investment Score Gauge ──
    const circumference = 2 * Math.PI * 52; // r=52
    const offset = circumference - (score.total / 100) * circumference;
    const scoreColor = ScoreEngine.getScoreColor(score.total);

    DOM.scoreFill.style.strokeDashoffset = offset;
    DOM.scoreFill.style.stroke = scoreColor;
    DOM.scoreValue.textContent = score.total;
    DOM.scoreValue.style.color = scoreColor;
    DOM.scoreSignal.textContent = score.label;
    DOM.scoreSignal.setAttribute('data-signal', score.signal);

    // Count bullish/bearish/neutral
    const signals = Object.values(score.breakdown);
    const bullish = signals.filter(s => s.signal === 'bullish').length;
    const bearish = signals.filter(s => s.signal === 'bearish').length;
    const neutral = signals.filter(s => s.signal === 'neutral').length;
    DOM.scoreDetail.textContent = `${bullish} Bullish · ${neutral} Neutral · ${bearish} Bearish`;

    // ── Individual Indicator Cards ──
    const { breakdown } = score;

    // RSI
    updateIndicatorCard('rsi', breakdown.rsi, (b) => {
      const rsiVal = b.value !== null && b.value !== undefined ? b.value.toFixed(1) : '—';
      return { value: rsiVal, barWidth: b.value || 50 };
    });

    // MACD
    updateIndicatorCard('macd', breakdown.macd, (b) => {
      const macdVal = b.value !== null && b.value !== undefined ? b.value.toFixed(4) : '—';
      return { value: macdVal, barWidth: b.score };
    });

    // Moving Averages
    updateIndicatorCard('ma', breakdown.movingAverages, (b) => {
      return { value: b.detail.split(':')[1]?.trim() || b.signal, barWidth: b.score };
    });

    // Bollinger Bands
    updateIndicatorCard('bb', breakdown.bollingerBands, (b) => {
      return { value: `${b.score}%`, barWidth: b.score };
    });

    // Volume
    updateIndicatorCard('vol', breakdown.volume, (b) => {
      return { value: b.detail.split('—')[0]?.trim() || b.signal, barWidth: b.score };
    });
  }

  function updateIndicatorCard(prefix, data, formatter) {
    const valueEl = DOM[`${prefix}Value`];
    const signalEl = DOM[`${prefix}Signal`];
    const detailEl = DOM[`${prefix}Detail`];
    const barEl = DOM[`${prefix}Bar`];

    if (!data) return;

    const formatted = formatter(data);

    valueEl.textContent = formatted.value;

    signalEl.textContent = data.signal.charAt(0).toUpperCase() + data.signal.slice(1);
    signalEl.className = `indicator-card__signal ${data.signal}`;

    detailEl.textContent = data.detail;

    const barWidth = Math.max(2, Math.min(100, formatted.barWidth || 50));
    barEl.style.width = `${barWidth}%`;
    barEl.style.background = ScoreEngine.getScoreColor(data.score);
  }

  // ─── FETCH WATCHLIST PRICES ───────────────────────────────────────

  async function fetchWatchlistPrices(excludeSymbol) {
    const symbols = WatchlistManager.getAll().filter(s => s !== excludeSymbol);

    for (const symbol of symbols) {
      try {
        const data = await DataAPI.fetchAssetData(symbol, '1M');
        if (data.market) {
          WatchlistManager.updatePrice(symbol, data.market.price, data.market.change24h);
        }
      } catch (e) {
        // Silently fail for background fetches
        console.warn(`Background fetch failed for ${symbol}:`, e.message);
      }
    }
  }

  // ─── LOADING STATE ────────────────────────────────────────────────

  function setLoading(state) {
    isLoading = state;
    DOM.chartLoading.classList.toggle('active', state);
  }

  // ─── AUTO REFRESH ─────────────────────────────────────────────────

  function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      if (currentSymbol && !isLoading) {
        DataAPI.clearCache();
        loadAsset(currentSymbol);
      }
    }, 60000); // Refresh every 60 seconds
  }

  // ─── TOAST NOTIFICATIONS ─────────────────────────────────────────

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button class="toast__close" onclick="this.parentElement.remove()">✕</button>
    `;

    DOM.toastContainer.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(16px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);
  }

  // ─── BOOT ─────────────────────────────────────────────────────────

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { loadAsset, showToast };

})();
