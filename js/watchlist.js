/**
 * Investment Analyzer — Watchlist Manager
 * Manages user's watchlist with localStorage persistence
 */

const WatchlistManager = (() => {
  const STORAGE_KEY = 'investment-analyzer-watchlist';
  const DEFAULT_WATCHLIST = ['BTC', 'ETH', 'AAPL', 'GOLD'];

  let watchlist = [];
  let activeSymbol = null;
  let containerEl = null;
  let onSelectCallback = null;
  let onRemoveCallback = null;

  // ─── PERSISTENCE ──────────────────────────────────────────────────

  function load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate that all symbols exist in registry
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
    // Auto-select first item
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
    return true;
  }

  function remove(symbol) {
    const idx = watchlist.indexOf(symbol);
    if (idx === -1) return false;
    watchlist.splice(idx, 1);
    save();
    // If removed the active item, select next
    if (activeSymbol === symbol && watchlist.length > 0) {
      setActive(watchlist[Math.min(idx, watchlist.length - 1)]);
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

  function getActive() {
    return activeSymbol;
  }

  // ─── RENDER ───────────────────────────────────────────────────────

  function render() {
    if (!containerEl) return;

    containerEl.innerHTML = '';

    watchlist.forEach((symbol, index) => {
      const asset = DataAPI.getAsset(symbol);
      if (!asset) return;

      const item = document.createElement('div');
      item.className = `watchlist__item${symbol === activeSymbol ? ' active' : ''}`;
      item.setAttribute('data-symbol', symbol);
      item.style.animationDelay = `${index * 50}ms`;
      item.classList.add('animate-slide-in');

      item.innerHTML = `
        <div class="watchlist__item-info">
          <span class="watchlist__item-symbol">${symbol}</span>
          <span class="watchlist__item-name">${asset.name}</span>
        </div>
        <div class="watchlist__item-data">
          <span class="watchlist__item-price" id="price-${symbol}">—</span>
          <span class="watchlist__item-change" id="change-${symbol}">—</span>
        </div>
        <button class="watchlist__item-remove" title="Remove ${symbol}" data-remove="${symbol}">✕</button>
      `;

      // Click to select
      item.addEventListener('click', (e) => {
        if (e.target.closest('.watchlist__item-remove')) return;
        setActive(symbol);
      });

      // Remove button
      const removeBtn = item.querySelector('.watchlist__item-remove');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        remove(symbol);
      });

      containerEl.appendChild(item);
    });
  }

  // ─── UPDATE PRICES IN SIDEBAR ─────────────────────────────────────

  function updatePrice(symbol, price, change) {
    const priceEl = document.getElementById(`price-${symbol}`);
    const changeEl = document.getElementById(`change-${symbol}`);
    if (!priceEl || !changeEl) return;

    // Format price
    const formattedPrice = formatPrice(price);
    priceEl.textContent = formattedPrice;

    // Format change
    if (change !== null && change !== undefined) {
      const sign = change >= 0 ? '+' : '';
      changeEl.textContent = `${sign}${change.toFixed(2)}%`;
      changeEl.className = `watchlist__item-change ${change >= 0 ? 'positive' : 'negative'}`;
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
    getActive,
    updatePrice,
    formatPrice,
    render
  };
})();
