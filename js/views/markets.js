/**
 * Investment Portfolio Manager — Markets Tab View
 * Renders market prices table, search/filter, sorting, category switching, and top gainers/losers.
 */

const MarketsView = (() => {

  let marketData = [];
  let currentCategory = 'all';
  let sortColumn = 'symbol';
  let sortDirection = 'asc';
  let filterQuery = '';

  // ─── LIFECYCLE HOOKS ──────────────────────────────────────────────
  function onEnter() {
    bindEvents();
    loadMarketOverview();
  }

  function onLeave() {
    // Nothing to do
  }

  // ─── EVENTS ───────────────────────────────────────────────────────
  function bindEvents() {
    // Category tabs
    const tabs = document.getElementById('markets-category-tabs');
    if (tabs) {
      tabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.pill-tab');
        if (!tab) return;
        
        tabs.querySelectorAll('.pill-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        currentCategory = tab.dataset.category;
        renderMarketsTable();
      });
    }

    // Search input
    const searchInput = document.getElementById('markets-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        filterQuery = e.target.value.toLowerCase().trim();
        renderMarketsTable();
      });
    }

    // Table sorting
    const tableHeader = document.querySelector('#markets-table thead');
    if (tableHeader) {
      tableHeader.addEventListener('click', (e) => {
        const th = e.target.closest('th');
        if (!th || !th.dataset.sort) return;

        const col = th.dataset.sort;
        if (sortColumn === col) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = col;
          sortDirection = 'asc';
        }

        renderMarketsTable();
      });
    }
  }

  // ─── LOADING DATA ─────────────────────────────────────────────────
  async function loadMarketOverview() {
    const tableBody = document.querySelector('#markets-table tbody');
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">Fetching latest prices from API...</td></tr>`;
    }

    const allAssets = DataAPI.getAllAssets();
    marketData = [];

    // Fetch details sequentially with a small delay to avoid CoinGecko 429 rate limits
    for (let i = 0; i < allAssets.length; i++) {
      const asset = allAssets[i];
      try {
        const data = await DataAPI.fetchAssetData(asset.symbol, '1D');
        if (data.market) {
          marketData.push({
            symbol: asset.symbol,
            name: asset.name,
            type: asset.type,
            price: data.market.price,
            change24h: data.market.change24h || 0,
            currency: data.market.currency || 'USD'
          });
        }
        // Small delay if fetching multiple crypto assets to respect API limitations
        if (asset.source === 'coingecko') {
          await sleep(150);
        }
      } catch (err) {
        console.warn(`Failed to fetch market data for ${asset.symbol}:`, err);
        // Fallback placeholder using cached or dummy values
        marketData.push({
          symbol: asset.symbol,
          name: asset.name,
          type: asset.type,
          price: 0,
          change24h: 0,
          currency: 'USD'
        });
      }

      // Progressively render table so the user sees results without waiting for all 28 assets to load
      if (i % 4 === 0 || i === allAssets.length - 1) {
        renderMarketsTable();
        renderTopMovers();
      }
    }
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── RENDERING ────────────────────────────────────────────────────
  function renderMarketsTable() {
    const tableBody = document.querySelector('#markets-table tbody');
    if (!tableBody) return;

    // Filter by category
    let filtered = marketData;
    if (currentCategory !== 'all') {
      filtered = filtered.filter(item => item.type === currentCategory);
    }

    // Filter by search query
    if (filterQuery) {
      filtered = filtered.filter(item => 
        item.symbol.toLowerCase().includes(filterQuery) || 
        item.name.toLowerCase().includes(filterQuery)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      // Handle custom sorting columns
      if (sortColumn === 'change') {
        valA = a.change24h;
        valB = b.change24h;
      }

      if (typeof valA === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return sortDirection === 'asc' 
          ? valA - valB 
          : valB - valA;
      }
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No assets match filters.</td></tr>`;
      return;
    }

    tableBody.innerHTML = filtered.map(item => {
      const curLabel = item.currency === 'THB' ? '฿' : '$';
      const sign = item.change24h >= 0 ? '+' : '';
      const pColor = item.change24h >= 0 ? 'text-bullish' : 'text-bearish';
      
      return `
        <tr class="clickable-row" data-symbol="${item.symbol}">
          <td style="font-weight: 700;">${item.symbol}</td>
          <td>${item.name}</td>
          <td class="text-mono" style="font-weight: 600;">
            ${curLabel}${WatchlistManager.formatPrice(item.price)}
          </td>
          <td class="text-mono ${pColor}" style="font-weight: 600;">
            ${sign}${item.change24h.toFixed(2)}%
          </td>
          <td><span class="badge badge--${item.type}">${item.type}</span></td>
        </tr>
      `;
    }).join('');

    // Bind row click events
    tableBody.querySelectorAll('.clickable-row').forEach(row => {
      row.addEventListener('click', () => {
        const symbol = row.dataset.symbol;
        Router.navigate('#analysis');
        setTimeout(() => AnalysisView.loadAsset(symbol), 50);
      });
    });
  }

  function renderTopMovers() {
    const gainersBody = document.querySelector('#markets-gainers-table tbody');
    const losersBody = document.querySelector('#markets-losers-table tbody');
    if (!gainersBody || !losersBody) return;

    // Filter out items with 0 price (failed downloads)
    const validAssets = marketData.filter(m => m.price > 0);

    // Sort by 24h change
    const sorted = [...validAssets].sort((a, b) => b.change24h - a.change24h);

    // Top 3 Gainers
    const gainers = sorted.slice(0, 3);
    if (gainers.length === 0) {
      gainersBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>`;
    } else {
      gainersBody.innerHTML = gainers.map(item => {
        const curLabel = item.currency === 'THB' ? '฿' : '$';
        return `
          <tr class="clickable-row" data-symbol="${item.symbol}">
            <td style="font-weight: 700;">${item.symbol}</td>
            <td style="font-size:0.82rem; color:var(--text-secondary);">${item.name}</td>
            <td class="text-mono">${curLabel}${WatchlistManager.formatPrice(item.price)}</td>
            <td class="text-mono text-bullish" style="font-weight: 600;">+${item.change24h.toFixed(2)}%</td>
          </tr>
        `;
      }).join('');
    }

    // Top 3 Losers
    const losers = sorted.slice(-3).reverse();
    if (losers.length === 0) {
      losersBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>`;
    } else {
      losersBody.innerHTML = losers.map(item => {
        const curLabel = item.currency === 'THB' ? '฿' : '$';
        return `
          <tr class="clickable-row" data-symbol="${item.symbol}">
            <td style="font-weight: 700;">${item.symbol}</td>
            <td style="font-size:0.82rem; color:var(--text-secondary);">${item.name}</td>
            <td class="text-mono">${curLabel}${WatchlistManager.formatPrice(item.price)}</td>
            <td class="text-mono text-bearish" style="font-weight: 600;">${item.change24h.toFixed(2)}%</td>
          </tr>
        `;
      }).join('');
    }

    // Row click listeners for top movers
    [gainersBody, losersBody].forEach(body => {
      body.querySelectorAll('.clickable-row').forEach(row => {
        row.addEventListener('click', () => {
          const symbol = row.dataset.symbol;
          Router.navigate('#analysis');
          setTimeout(() => AnalysisView.loadAsset(symbol), 50);
        });
      });
    });
  }

  return {
    onEnter,
    onLeave
  };
})();
