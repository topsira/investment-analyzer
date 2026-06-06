/**
 * Investment Portfolio Manager — Transactions Tab View
 * Handles CRUD operations on transaction logs, search/filters, and popups.
 */

const TransactionsView = (() => {

  let filterSymbol = 'all';
  let filterType = 'all';

  // ─── LIFECYCLE HOOKS ──────────────────────────────────────────────
  function onEnter() {
    bindEvents();
    populateSymbolDropdown();
    populateFilters();
    renderTransactions();
  }

  function onLeave() {
    // Nothing to do
  }

  // ─── INITIALIZATION ───────────────────────────────────────────────
  function populateSymbolDropdown() {
    const select = document.getElementById('txn-symbol');
    if (!select) return;

    const assets = DataAPI.getAllAssets();
    // Sort alphabetically by symbol
    assets.sort((a, b) => a.symbol.localeCompare(b.symbol));

    select.innerHTML = assets.map(asset => `
      <option value="${asset.symbol}">${asset.symbol} — ${asset.name} (${asset.type.toUpperCase()})</option>
    `).join('');

    // Pre-fill price when symbol changes
    select.addEventListener('change', async (e) => {
      const sym = e.target.value;
      const priceInput = document.getElementById('txn-price');
      if (priceInput) {
        priceInput.placeholder = 'Fetching current price...';
        try {
          const data = await DataAPI.fetchAssetData(sym, '1D');
          if (data.market) {
            priceInput.value = data.market.price;
          }
        } catch (err) {
          console.warn('Could not auto-fetch price for transaction modal:', err);
          priceInput.placeholder = '0.00';
        }
      }
    });
  }

  function populateFilters() {
    const symbolFilter = document.getElementById('tx-filter-symbol');
    if (!symbolFilter) return;

    const assets = DataAPI.getAllAssets();
    assets.sort((a, b) => a.symbol.localeCompare(b.symbol));

    symbolFilter.innerHTML = '<option value="all">All Assets</option>' + assets.map(asset => `
      <option value="${asset.symbol}">${asset.symbol}</option>
    `).join('');
  }

  function bindEvents() {
    // Add Transaction button
    const addBtn = document.getElementById('btn-add-transaction');
    if (addBtn) {
      addBtn.addEventListener('click', () => openModal());
    }

    // Modal cancellation
    const cancelBtn = document.getElementById('txn-modal-cancel');
    const closeBtn = document.getElementById('txn-modal-close');
    const overlay = document.getElementById('txn-modal-overlay');

    [cancelBtn, closeBtn, overlay].forEach(el => {
      if (el) {
        el.addEventListener('click', closeModal);
      }
    });

    // Transaction Type toggle in modal
    const typeGroup = document.getElementById('txn-type-group');
    if (typeGroup) {
      typeGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-toggle');
        if (!btn) return;
        typeGroup.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    }

    // Form submission
    const form = document.getElementById('txn-form');
    if (form) {
      form.removeEventListener('submit', handleFormSubmit); // Prevent duplicate binds
      form.addEventListener('submit', handleFormSubmit);
    }

    // Filter selectors
    const symFilter = document.getElementById('tx-filter-symbol');
    const typFilter = document.getElementById('tx-filter-type');
    const resetBtn = document.getElementById('btn-clear-tx-filters');

    if (symFilter) {
      symFilter.addEventListener('change', (e) => {
        filterSymbol = e.target.value;
        renderTransactions();
      });
    }

    if (typFilter) {
      typFilter.addEventListener('change', (e) => {
        filterType = e.target.value;
        renderTransactions();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (symFilter) symFilter.value = 'all';
        if (typFilter) typFilter.value = 'all';
        filterSymbol = 'all';
        filterType = 'all';
        renderTransactions();
      });
    }
  }

  // ─── MODAL CONTROLLERS ────────────────────────────────────────────
  async function openModal(txnId = null) {
    const modal = document.getElementById('txn-modal');
    const form = document.getElementById('txn-form');
    const titleEl = document.getElementById('txn-modal-title');

    if (!modal || !form) return;

    form.reset();
    document.getElementById('txn-id').value = '';

    // Set default date to local today
    document.getElementById('txn-date').value = new Date().toISOString().split('T')[0];

    // Set transaction type to Buy by default
    const buyBtn = document.querySelector('#txn-type-group [data-type="buy"]');
    const sellBtn = document.querySelector('#txn-type-group [data-type="sell"]');
    if (buyBtn && sellBtn) {
      buyBtn.classList.add('active');
      sellBtn.classList.remove('active');
    }

    if (txnId) {
      // EDIT MODE
      titleEl.textContent = 'Edit Transaction';
      const txs = StorageManager.getTransactions();
      const tx = txs.find(t => t.id === txnId);
      
      if (tx) {
        document.getElementById('txn-id').value = tx.id;
        document.getElementById('txn-symbol').value = tx.symbol;
        document.getElementById('txn-qty').value = tx.quantity;
        document.getElementById('txn-price').value = tx.pricePerUnit;
        document.getElementById('txn-date').value = tx.date;
        document.getElementById('txn-notes').value = tx.notes || '';

        if (tx.type === 'buy') {
          buyBtn.classList.add('active');
          sellBtn.classList.remove('active');
        } else {
          buyBtn.classList.remove('active');
          sellBtn.classList.add('active');
        }
      }
    } else {
      // NEW MODE
      titleEl.textContent = 'Add Transaction';
      // Auto-populate price for default symbol
      const defaultSym = document.getElementById('txn-symbol').value;
      if (defaultSym) {
        try {
          const data = await DataAPI.fetchAssetData(defaultSym, '1D');
          if (data.market) {
            document.getElementById('txn-price').value = data.market.price;
          }
        } catch (e) {
          console.warn(e);
        }
      }
    }

    modal.classList.add('active');
  }

  function closeModal() {
    const modal = document.getElementById('txn-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('txn-id').value;
    const symbol = document.getElementById('txn-symbol').value;
    const quantity = parseFloat(document.getElementById('txn-qty').value);
    const pricePerUnit = parseFloat(document.getElementById('txn-price').value);
    const date = document.getElementById('txn-date').value;
    const notes = document.getElementById('txn-notes').value.trim();
    
    const activeTypeBtn = document.querySelector('#txn-type-group .btn-toggle.active');
    const type = activeTypeBtn ? activeTypeBtn.dataset.type : 'buy';

    const totalValue = quantity * pricePerUnit;

    const txnData = {
      symbol,
      type,
      quantity,
      pricePerUnit,
      totalValue,
      date,
      notes
    };

    try {
      if (id) {
        await StorageManager.updateTransaction(id, txnData);
        if (window.App && window.App.showToast) window.App.showToast('Transaction updated successfully', 'success');
      } else {
        await StorageManager.addTransaction(txnData);
        if (window.App && window.App.showToast) window.App.showToast('Transaction added successfully', 'success');
      }
      closeModal();
      renderTransactions();
    } catch (err) {
      console.error(err);
      if (window.App && window.App.showToast) window.App.showToast(`Error saving transaction: ${err.message}`, 'error');
    }
  }

  // ─── RENDERING ────────────────────────────────────────────────────
  async function renderTransactions() {
    const tableBody = document.querySelector('#transactions-table-list tbody');
    if (!tableBody) return;

    const transactions = StorageManager.getTransactions();

    // Elements for stats
    const txCountEl = document.getElementById('tx-count');
    const totalInvestedEl = document.getElementById('tx-total-invested');
    const currentValueEl = document.getElementById('tx-current-value');
    const netPnlEl = document.getElementById('tx-net-pnl');

    txCountEl.textContent = transactions.length.toString();

    if (transactions.length === 0) {
      totalInvestedEl.textContent = '$0.00';
      currentValueEl.textContent = '$0.00';
      netPnlEl.textContent = '$0.00';
      netPnlEl.className = 'stat-card__value';

      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; color: var(--text-secondary);">No transaction history. Click 'Add Transaction' to begin tracking.</td>
        </tr>
      `;
      return;
    }

    // Filter list
    let filtered = transactions;
    if (filterSymbol !== 'all') {
      filtered = filtered.filter(t => t.symbol === filterSymbol);
    }
    if (filterType !== 'all') {
      filtered = filtered.filter(t => t.type === filterType);
    }

    // Pull current prices for assets in transactions to calculate live P/L
    const uniqueSymbols = [...new Set(transactions.map(t => t.symbol))];
    const prices = {};
    const THB_TO_USD = 1 / 36.5;

    const pricePromises = uniqueSymbols.map(async sym => {
      try {
        const data = await DataAPI.fetchAssetData(sym, '1D');
        prices[sym] = {
          price: data.market ? data.market.price : 0,
          currency: data.market ? data.market.currency : 'USD',
          type: data.asset ? data.asset.type : 'stock'
        };
      } catch (err) {
        prices[sym] = { price: 0, currency: 'USD', type: 'stock' };
      }
    });

    await pricePromises.all ? await pricePromises.all() : await Promise.all(pricePromises);

    // Calculate Summary Stats (in USD)
    let totalInvestedUSD = 0;
    let currentValUSD = 0;

    // We compute total invested (Cost basis) as: sum of buys (USD) - sum of sells (USD)
    // and current value as: sum of (current holdings quantity * current price in USD)
    transactions.forEach(t => {
      const pInfo = prices[t.symbol];
      const convRate = (pInfo && pInfo.type === 'stock-th') ? THB_TO_USD : 1;
      
      if (t.type === 'buy') {
        totalInvestedUSD += t.totalValue * convRate;
      } else {
        totalInvestedUSD -= t.totalValue * convRate;
      }
    });

    const holdings = StorageManager.getHoldings();
    holdings.forEach(h => {
      const pInfo = prices[h.symbol];
      const price = pInfo ? pInfo.price : 0;
      const convRate = (pInfo && pInfo.type === 'stock-th') ? THB_TO_USD : 1;
      currentValUSD += h.quantity * price * convRate;
    });

    const netPnlUSD = currentValUSD - totalInvestedUSD;
    const netPnlPct = totalInvestedUSD > 0 ? (netPnlUSD / totalInvestedUSD) * 100 : 0;

    // Render Stats Card
    totalInvestedEl.textContent = `$${totalInvestedUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    currentValueEl.textContent = `$${currentValUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    netPnlEl.textContent = `${netPnlUSD >= 0 ? '+' : ''}$${netPnlUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${netPnlUSD >= 0 ? '+' : ''}${netPnlPct.toFixed(2)}%)`;
    netPnlEl.className = `stat-card__value ${netPnlUSD >= 0 ? 'text-bullish' : 'text-bearish'}`;

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; color: var(--text-secondary);">No transactions match selected filters.</td>
        </tr>
      `;
      return;
    }

    // Render Table Rows
    tableBody.innerHTML = filtered.map(tx => {
      const pInfo = prices[tx.symbol];
      const curPrice = pInfo ? pInfo.price : 0;
      const isTHB = pInfo && pInfo.type === 'stock-th';
      const curLabel = isTHB ? '฿' : '$';

      // Live unrealized P/L calculation per transaction row (for buy transaction)
      let pnlText = '—';
      let pnlClass = '';
      if (tx.type === 'buy' && curPrice > 0) {
        const pnl = (curPrice - tx.pricePerUnit) * tx.quantity;
        const pnlPct = ((curPrice - tx.pricePerUnit) / tx.pricePerUnit) * 100;
        pnlText = `${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} (${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`;
        pnlClass = pnl >= 0 ? 'text-bullish' : 'text-bearish';
      }

      return `
        <tr>
          <td style="font-size:0.82rem; color:var(--text-secondary);">${tx.date}</td>
          <td><span class="badge badge--${tx.type}">${tx.type}</span></td>
          <td style="font-weight: 700;">${tx.symbol}</td>
          <td class="text-mono">${tx.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })}</td>
          <td class="text-mono">${curLabel}${tx.pricePerUnit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
          <td class="text-mono">${curPrice > 0 ? curLabel + curPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
          <td class="text-mono" style="font-weight:600;">${curLabel}${tx.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="text-mono ${pnlClass}" style="font-weight: 600;">${pnlText}</td>
          <td style="text-align: right;">
            <button class="btn btn--secondary btn-edit-tx" data-id="${tx.id}" style="padding: 4px 8px; font-size: 0.78rem;">✏️</button>
            <button class="btn btn--danger btn-delete-tx" data-id="${tx.id}" style="padding: 4px 8px; font-size: 0.78rem;">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');

    // Bind Edit and Delete listeners
    tableBody.querySelectorAll('.btn-edit-tx').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        openModal(id);
      });
    });

    tableBody.querySelectorAll('.btn-delete-tx').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.dataset.id;
        if (confirm('Are you sure you want to delete this transaction record?')) {
          try {
            await StorageManager.deleteTransaction(id);
            if (window.App && window.App.showToast) window.App.showToast('Transaction deleted successfully', 'success');
            renderTransactions();
          } catch (err) {
            console.error(err);
          }
        }
      });
    });
  }

  return {
    onEnter,
    onLeave
  };
})();
