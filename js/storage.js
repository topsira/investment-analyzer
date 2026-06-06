/**
 * Investment Analyzer / Portfolio Manager — Storage Manager
 * Handles LocalStorage storage, JSON exports, and optional Google Sheets sync.
 */

const StorageManager = (() => {
  const KEYS = {
    TRANSACTIONS: 'investment-portfolio-transactions',
    SNAPSHOTS: 'investment-portfolio-snapshots',
    SETTINGS: 'investment-portfolio-settings'
  };

  const DEFAULT_TRANSACTIONS = [
    {
      id: 'txn_demo_btc',
      date: '2026-05-10',
      type: 'buy',
      symbol: 'BTC',
      quantity: 0.15,
      pricePerUnit: 61200,
      totalValue: 9180,
      notes: 'DCA Buy',
      createdAt: 1780587889600
    },
    {
      id: 'txn_demo_eth',
      date: '2026-05-15',
      type: 'buy',
      symbol: 'ETH',
      quantity: 2.5,
      pricePerUnit: 2950,
      totalValue: 7375,
      notes: 'DCA Buy',
      createdAt: 1780587889601
    },
    {
      id: 'txn_demo_aapl',
      date: '2026-05-20',
      type: 'buy',
      symbol: 'AAPL',
      quantity: 15,
      pricePerUnit: 182.5,
      totalValue: 2737.5,
      notes: 'Monthly Portfolio Buy',
      createdAt: 1780587889602
    },
    {
      id: 'txn_demo_gold',
      date: '2026-05-25',
      type: 'buy',
      symbol: 'GOLD',
      quantity: 5,
      pricePerUnit: 2310,
      totalValue: 11550,
      notes: 'Safe haven allocation',
      createdAt: 1780587889603
    }
  ];

  let transactions = [];
  let snapshots = [];
  let settings = {
    theme: 'dark',
    storageMode: 'local', // 'local' | 'sheets'
    sheetsUrl: '',
    sheetsKey: ''
  };

  // ─── LOCAL STORAGE OPERATIONS ─────────────────────────────────────

  function loadLocal() {
    try {
      const txs = localStorage.getItem(KEYS.TRANSACTIONS);
      if (txs) {
        transactions = JSON.parse(txs);
      } else {
        transactions = [...DEFAULT_TRANSACTIONS];
        localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
      }
      
      const snaps = localStorage.getItem(KEYS.SNAPSHOTS);
      if (snaps) {
        snapshots = JSON.parse(snaps);
      }

      const sett = localStorage.getItem(KEYS.SETTINGS);
      if (sett) settings = { ...settings, ...JSON.parse(sett) };
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
  }

  function saveLocal() {
    try {
      localStorage.setItem(KEYS.TRANSACTIONS, JSON.stringify(transactions));
      localStorage.setItem(KEYS.SNAPSHOTS, JSON.stringify(snapshots));
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }

  // ─── INITIALIZATION ───────────────────────────────────────────────

  async function init() {
    loadLocal();
    if (settings.storageMode === 'sheets' && settings.sheetsUrl) {
      try {
        await syncWithSheets();
      } catch (err) {
        console.warn('Initial Google Sheets sync failed, using local fallback:', err);
      }
    }
    // Auto-generate some initial snapshot if snapshots are empty but transactions exist
    generateSnapshotsIfEmpty();
  }

  // ─── TRANSACTIONS CRUD ─────────────────────────────────────────────

  function getTransactions() {
    return [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }

  async function addTransaction(txn) {
    const newTxn = {
      ...txn,
      id: txn.id || `txn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: txn.createdAt || Date.now()
    };
    transactions.push(newTxn);
    saveLocal();
    generateSnapshots();
    
    if (settings.storageMode === 'sheets' && settings.sheetsUrl) {
      await pushToSheets();
    }
    return newTxn;
  }

  async function updateTransaction(id, updatedFields) {
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Transaction not found');
    
    transactions[idx] = {
      ...transactions[idx],
      ...updatedFields,
      totalValue: updatedFields.quantity * updatedFields.pricePerUnit
    };
    saveLocal();
    generateSnapshots();

    if (settings.storageMode === 'sheets' && settings.sheetsUrl) {
      await pushToSheets();
    }
    return transactions[idx];
  }

  async function deleteTransaction(id) {
    const idx = transactions.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Transaction not found');
    
    transactions.splice(idx, 1);
    saveLocal();
    generateSnapshots();

    if (settings.storageMode === 'sheets' && settings.sheetsUrl) {
      await pushToSheets();
    }
    return true;
  }

  // ─── PORTFOLIO STATS & CALCULATIONS ───────────────────────────────

  /**
   * Computes the current holdings: symbol -> quantity, averageBuyPrice, totalInvested
   */
  function getHoldings() {
    const holdings = {};
    
    // Sort transactions by date ascending to process buy/sells chronologically
    const chronTxns = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

    chronTxns.forEach(tx => {
      const sym = tx.symbol.toUpperCase();
      if (!holdings[sym]) {
        holdings[sym] = {
          symbol: sym,
          quantity: 0,
          totalInvested: 0,
          realizedPnL: 0,
          avgBuyPrice: 0
        };
      }

      const h = holdings[sym];
      const qty = Number(tx.quantity);
      const price = Number(tx.pricePerUnit);

      if (tx.type === 'buy') {
        const prevQty = h.quantity;
        h.quantity += qty;
        h.totalInvested += qty * price;
        if (h.quantity > 0) {
          // Average buy price calculation
          h.avgBuyPrice = (prevQty * h.avgBuyPrice + qty * price) / h.quantity;
        }
      } else if (tx.type === 'sell') {
        const sellQty = Math.min(qty, h.quantity);
        
        // Realized profit based on average buy price
        const costBasis = sellQty * h.avgBuyPrice;
        const revenue = sellQty * price;
        h.realizedPnL += (revenue - costBasis);
        
        h.quantity -= sellQty;
        h.totalInvested = Math.max(0, h.totalInvested - costBasis);
        if (h.quantity === 0) {
          h.avgBuyPrice = 0;
        }
      }
    });

    // Filter out zero holdings
    return Object.values(holdings).filter(h => h.quantity > 0);
  }

  // ─── SNAPSHOTS FOR PERFORMANCE ────────────────────────────────────

  function getSnapshots() {
    return [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Generates historical snapshots if we don't have them
   */
  function generateSnapshotsIfEmpty() {
    if (snapshots.length === 0 && transactions.length > 0) {
      generateSnapshots();
    }
  }

  function generateSnapshots() {
    if (transactions.length === 0) {
      snapshots = [];
      saveLocal();
      return;
    }

    // Find min and max dates in transactions
    const dates = transactions.map(t => t.date).sort();
    const minDateStr = dates[0];
    const maxDateStr = new Date().toISOString().split('T')[0];

    const minDate = new Date(minDateStr);
    const maxDate = new Date(maxDateStr);

    const generated = [];
    const tempHoldings = {};

    // Group transactions by date
    const txByDate = {};
    transactions.forEach(t => {
      if (!txByDate[t.date]) txByDate[t.date] = [];
      txByDate[t.date].push(t);
    });

    // Iterate through each day from minDate to maxDate
    const current = new Date(minDate);
    while (current <= maxDate) {
      const dateStr = current.toISOString().split('T')[0];
      
      // Process transactions on this day
      if (txByDate[dateStr]) {
        txByDate[dateStr].forEach(tx => {
          const sym = tx.symbol.toUpperCase();
          if (!tempHoldings[sym]) {
            tempHoldings[sym] = { qty: 0, cost: 0 };
          }
          if (tx.type === 'buy') {
            tempHoldings[sym].qty += Number(tx.quantity);
            tempHoldings[sym].cost += Number(tx.quantity) * Number(tx.pricePerUnit);
          } else {
            tempHoldings[sym].qty = Math.max(0, tempHoldings[sym].qty - Number(tx.quantity));
            if (tempHoldings[sym].qty === 0) {
              tempHoldings[sym].cost = 0;
            }
          }
        });
      }

      // Compute value of holdings on this day (using cost basis as proxy for historical snapshots)
      let totalCostBasis = 0;
      Object.keys(tempHoldings).forEach(sym => {
        if (tempHoldings[sym].qty > 0) {
          totalCostBasis += tempHoldings[sym].cost;
        }
      });

      generated.push({
        date: dateStr,
        value: totalCostBasis
      });

      current.setDate(current.getDate() + 1);
    }

    // Filter down to last 30 snapshots or similar if too large, or just keep daily
    // Let's keep daily, up to 180 days to avoid storage overflow
    snapshots = generated.slice(-180);
    saveLocal();
  }

  // ─── SETTINGS ─────────────────────────────────────────────────────

  function getSettings() {
    return { ...settings };
  }

  function updateSettings(updated) {
    settings = { ...settings, ...updated };
    saveLocal();
  }

  // ─── EXPORT / IMPORT ──────────────────────────────────────────────

  function exportJSON() {
    const data = {
      version: '1.0',
      transactions,
      snapshots,
      settings: {
        theme: settings.theme,
        storageMode: settings.storageMode,
        sheetsUrl: settings.sheetsUrl
      }
    };
    return JSON.stringify(data, null, 2);
  }

  function importJSON(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
        throw new Error('Invalid backup file structure: missing transactions array.');
      }
      
      transactions = parsed.transactions;
      if (parsed.snapshots && Array.isArray(parsed.snapshots)) {
        snapshots = parsed.snapshots;
      } else {
        generateSnapshots();
      }

      if (parsed.settings) {
        settings = {
          ...settings,
          ...parsed.settings,
          // Do not import sensitive keys unless they were included
          sheetsKey: parsed.settings.sheetsKey || settings.sheetsKey
        };
      }

      saveLocal();
      return true;
    } catch (e) {
      console.error('Import failed:', e);
      throw e;
    }
  }

  function clearAll() {
    transactions = [];
    snapshots = [];
    saveLocal();
  }

  // ─── GOOGLE SHEETS INTEGRATION ────────────────────────────────────

  async function syncWithSheets() {
    if (!settings.sheetsUrl) throw new Error('Google Sheets Web App URL is not set.');

    let url = settings.sheetsUrl;
    // Add accessKey as param
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}accessKey=${encodeURIComponent(settings.sheetsKey)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load from Sheets: HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.status === 'error') {
      throw new Error(data.message || 'Error from Google Apps Script Web App');
    }

    if (data.transactions && Array.isArray(data.transactions)) {
      transactions = data.transactions.map(t => ({
        ...t,
        quantity: Number(t.quantity),
        pricePerUnit: Number(t.pricePerUnit),
        totalValue: Number(t.totalValue),
        createdAt: Number(t.createdAt || Date.now())
      }));
      saveLocal();
      generateSnapshots();
      return true;
    }
    throw new Error('Google Sheet response is missing transactions sheet.');
  }

  async function pushToSheets() {
    if (!settings.sheetsUrl) return;

    const body = {
      action: 'saveTransactions',
      accessKey: settings.sheetsKey,
      transactions: transactions
    };

    const response = await fetch(settings.sheetsUrl, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain' // Apps Script handles text/plain best to avoid preflight issues in some environments
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Failed to save to Sheets: HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.status === 'error') {
      throw new Error(data.message || 'Error updating Google Sheets');
    }
    return true;
  }

  return {
    init,
    getTransactions,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getHoldings,
    getSnapshots,
    getSettings,
    updateSettings,
    exportJSON,
    importJSON,
    clearAll,
    syncWithSheets,
    pushToSheets
  };
})();
