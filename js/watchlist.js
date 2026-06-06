/**
 * Investment Portfolio Manager — Watchlist Manager
 * Manages user's watchlist with localStorage persistence.
 * Renders as horizontal pills inside the Analysis tab.
 */

const WatchlistManager = (() => {
  const STORAGE_KEY = 'investment-analyzer-watchlist';
  const DEFAULT_WATCHLIST = ['BTC', 'ETH', 'AAPL', 'GOLD'];

  let watchlist = [];
  let activeSymbol = null;
  let containerEl = null;
  let onSelectCallback = null;

  // ─── PERSISTENCE ──────────────────────────────────────────────────
  function load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        watchlist = parsed.filter(sym => DataAPI.getAsset(sym));
      }
    } catch (e) {
      console.warn('Failed to load watchlist:', e);
    }
    if (watchlist.length === 0) {
      watchlist = [...DEFAULT_WATCHLIST];
    }
    save();
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
  }

  // ─── INIT ─────────────────────────────────────────────────────────
  function init(container, onSelect) {
    containerEl = container;
    onSelectCallback = onSelect;
    load();
    render();
    if (watchlist.length > 0) {
      setActive(watchlist[0]);
    }
  }

  // ─── OPERATIONS ───────────────────────────────────────────────────
  function add(symbol) {
    const sym = symbol.toUpperCase();
    if (!DataAPI.getAsset(sym)) return false;
    if (watchlist.includes(sym)) return false;
    watchlist.push(sym);
    save();
    render();
    updateAllWatchlistPrices();
    return true;
  }

  function remove(symbol) {
    const idx = watchlist.indexOf(symbol);
    if (idx === -1) return false;
    watchlist.splice(idx, 1);
    save();

    // Select next active
    if (activeSymbol === symbol && watchlist.length > 0) {
      setActive(watchlist[Math.min(idx, watchlist.length - 1)]);
    } else if (watchlist.length === 0) {
      activeSymbol = null;
    }
    render();
    return true;
  }

  function has(symbol) {
    return watchlist.includes(symbol);
  }

  function getAll() {
    return [...watchlist];
  }

  function setActive(symbol) {
    activeSymbol = symbol;
    render();
    if (onSelectCallback) onSelectCallback(symbol);
  }

  function setActiveSymbolQuiet(symbol) {
    activeSymbol = symbol;
    render();
  }

  function getActive() {
    return activeSymbol;
  }

  function clearAll() {
    watchlist = [...DEFAULT_WATCHLIST];
    save();
    render();
  }

  // ─── RENDER ───────────────────────────────────────────────────────
  function render() {
    if (!containerEl) return;

    containerEl.innerHTML = '';

    watchlist.forEach((symbol, index) => {
      const asset = DataAPI.getAsset(symbol);
      if (!asset) return;

      const item = document.createElement('div');
      item.className = `watchlist-pill${symbol === activeSymbol ? ' active' : ''}`;
      item.setAttribute('data-symbol', symbol);
      item.style.animationDelay = `${index * 30}ms`;
      item.classList.add('animate-slide-in');

      item.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span class="watchlist-pill__symbol">${symbol}</span>
          <span class="watchlist-pill__price" id="price-${symbol}">—</span>
        </div>
        <span class="watchlist-pill__change" id="change-${symbol}">—</span>
        <button class="watchlist-pill__remove" title="Remove ${symbol}" data-remove="${symbol}">✕</button>
      `;

      // Select row
      item.addEventListener('click', (e) => {
        if (e.target.closest('.watchlist-pill__remove')) return;
        setActive(symbol);
      });

      // Remove row
      const removeBtn = item.querySelector('.watchlist-pill__remove');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        remove(symbol);
      });

      containerEl.appendChild(item);
    });
  }

  // ─── UPDATE WATCHLIST PRICES ──────────────────────────────────────
  function updatePrice(symbol, price, change) {
    const priceEl = document.getElementById(`price-${symbol}`);
    const changeEl = document.getElementById(`change-${symbol}`);
    if (!priceEl || !changeEl) return;

    const asset = DataAPI.getAsset(symbol);
    const curSymbol = (asset && asset.type === 'stock-th') ? '฿' : '$';

    priceEl.textContent = `${curSymbol}${formatPrice(price)}`;

    if (change !== null && change !== undefined) {
      const sign = change >= 0 ? '+' : '';
      changeEl.textContent = `${sign}${change.toFixed(2)}%`;
      changeEl.className = `watchlist-pill__change ${change >= 0 ? 'text-bullish' : 'text-bearish'}`;
    }
  }

  async function updateAllWatchlistPrices() {
    const symbols = getAll();
    for (const symbol of symbols) {
      try {
        const data = await DataAPI.fetchAssetData(symbol, '1M');
        if (data.market) {
          updatePrice(symbol, data.market.price, data.market.change24h);
        }
      } catch (e) {
        console.warn(`Watchlist price fetch failed for ${symbol}:`, e.message);
      }
    }
  }

  function formatPrice(price) {
    if (price === null || price === undefined) return '—';
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────
  return {
    init,
    add,
    remove,
    has,
    getAll,
    setActive,
    setActiveSymbolQuiet,
    getActive,
    updatePrice,
    updateAllWatchlistPrices,
    formatPrice,
    clearAll,
    render
  };
})();
