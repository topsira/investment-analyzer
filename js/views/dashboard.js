/**
 * Investment Portfolio Manager — Dashboard Tab View
 * Renders portfolio summaries, allocation donut chart, growth line chart, and holdings summary.
 */

const DashboardView = (() => {

  let allocationChart = null;
  let growthChart = null;

  // ─── LIFECYCLE HOOKS ──────────────────────────────────────────────
  async function onEnter() {
    renderSummary();
  }

  function onLeave() {
    // Nothing to do
  }

  // ─── RENDERING & CALCULATIONS ─────────────────────────────────────
  async function renderSummary() {
    const holdings = StorageManager.getHoldings();
    const transactions = StorageManager.getTransactions();

    // Elements
    const totalValueEl = document.getElementById('db-total-value');
    const valueChangeEl = document.getElementById('db-value-change');
    const totalPnlEl = document.getElementById('db-total-pnl');
    const pnlPctEl = document.getElementById('db-pnl-pct');
    const bestPerformerEl = document.getElementById('db-best-performer');
    const bestPerfChangeEl = document.getElementById('db-best-perf-change');
    const assetsCountEl = document.getElementById('db-assets-count');
    const holdingsTableBody = document.querySelector('#db-holdings-table tbody');
    const recentTxTableBody = document.querySelector('#db-recent-tx-table tbody');

    if (holdings.length === 0) {
      // Clear charts
      destroyCharts();
      
      // Default displays
      totalValueEl.textContent = '$0.00';
      valueChangeEl.textContent = 'No active assets';
      valueChangeEl.className = 'stat-card__change text-muted';
      totalPnlEl.textContent = '$0.00';
      pnlPctEl.textContent = '0.00%';
      pnlPctEl.className = 'stat-card__change text-muted';
      bestPerformerEl.textContent = '—';
      bestPerfChangeEl.textContent = '0.00%';
      bestPerfChangeEl.className = 'stat-card__change text-muted';
      assetsCountEl.textContent = '0';

      holdingsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No holdings. Add transactions to see summary.</td></tr>`;
      recentTxTableBody.innerHTML = transactions.length === 0 
        ? `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No recent activity.</td></tr>`
        : renderRecentTransactions(transactions);
      return;
    }

    // Load current prices for held assets in parallel
    assetsCountEl.textContent = holdings.length.toString();
    const pricePromises = holdings.map(async h => {
      try {
        const data = await DataAPI.fetchAssetData(h.symbol, '1M');
        return {
          ...h,
          currentPrice: data.market ? data.market.price : h.avgBuyPrice,
          change24h: data.market ? data.market.change24h : 0,
          type: data.asset ? data.asset.type : 'stock'
        };
      } catch (err) {
        console.warn(`Failed to fetch current price for dashboard asset ${h.symbol}:`, err);
        return {
          ...h,
          currentPrice: h.avgBuyPrice,
          change24h: 0,
          type: 'stock'
        };
      }
    });

    const holdingsWithPrices = await pricePromises.all ? await pricePromises.all() : await Promise.all(pricePromises);

    // Totals calculations
    // Note: Since native currencies differ (THB vs USD), for portfolio summary we translate THB to USD using a rough fixed rate 36.5 for simplicity,
    // or keep it simple. Let's do currency conversion if necessary: 1 USD = 36.5 THB
    const THB_TO_USD = 1 / 36.5;

    let totalValueUSD = 0;
    let totalCostUSD = 0;
    let bestPerformer = null;
    let maxPnLpct = -Infinity;

    holdingsWithPrices.forEach(h => {
      const isTHB = h.type === 'stock-th';
      const convRate = isTHB ? THB_TO_USD : 1;

      h.valueUSD = h.quantity * h.currentPrice * convRate;
      h.costUSD = h.quantity * h.avgBuyPrice * convRate;
      h.pnlUSD = h.valueUSD - h.costUSD;
      h.pnlPct = h.avgBuyPrice > 0 ? ((h.currentPrice - h.avgBuyPrice) / h.avgBuyPrice) * 100 : 0;

      totalValueUSD += h.valueUSD;
      totalCostUSD += h.costUSD;

      if (h.pnlPct > maxPnLpct) {
        maxPnLpct = h.pnlPct;
        bestPerformer = h;
      }
    });

    const totalPnLUSD = totalValueUSD - totalCostUSD;
    const totalPnLPct = totalCostUSD > 0 ? (totalPnLUSD / totalCostUSD) * 100 : 0;

    // Render Stat Cards
    totalValueEl.textContent = `$${totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    valueChangeEl.textContent = 'Current Balance';
    valueChangeEl.className = 'stat-card__change text-muted';

    totalPnlEl.textContent = `${totalPnLUSD >= 0 ? '+' : ''}$${totalPnLUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    totalPnlEl.className = `stat-card__value ${totalPnLUSD >= 0 ? 'text-bullish' : 'text-bearish'}`;
    pnlPctEl.textContent = `${totalPnLUSD >= 0 ? '+' : ''}${totalPnLPct.toFixed(2)}%`;
    pnlPctEl.className = `stat-card__change ${totalPnLUSD >= 0 ? 'positive' : 'negative'}`;

    if (bestPerformer) {
      bestPerformerEl.textContent = bestPerformer.symbol;
      bestPerfChangeEl.textContent = `+${maxPnLpct.toFixed(2)}%`;
      bestPerfChangeEl.className = 'stat-card__change positive';
    } else {
      bestPerformerEl.textContent = '—';
      bestPerfChangeEl.textContent = '0.00%';
      bestPerfChangeEl.className = 'stat-card__change text-muted';
    }

    // Render Holdings Table
    // Sort holdings by value descending
    holdingsWithPrices.sort((a, b) => b.valueUSD - a.valueUSD);

    holdingsTableBody.innerHTML = holdingsWithPrices.map(h => {
      const isTHB = h.type === 'stock-th';
      const curLabel = isTHB ? '฿' : '$';
      const weight = totalValueUSD > 0 ? (h.valueUSD / totalValueUSD) * 100 : 0;

      return `
        <tr class="clickable-row" data-symbol="${h.symbol}">
          <td>
            <div style="font-weight: 700;">${h.symbol}</div>
            <div style="font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase;">${h.type}</div>
          </td>
          <td class="text-mono">${h.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })}</td>
          <td class="text-mono">${curLabel}${h.avgBuyPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="text-mono">${curLabel}${h.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="text-mono" style="font-weight: 600;">$${h.valueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="text-mono ${h.pnlPct >= 0 ? 'text-bullish' : 'text-bearish'}" style="font-weight: 600;">
            ${h.pnlPct >= 0 ? '+' : ''}${h.pnlPct.toFixed(2)}%
          </td>
          <td class="text-mono">${weight.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');

    // Table click actions
    holdingsTableBody.querySelectorAll('.clickable-row').forEach(row => {
      row.addEventListener('click', () => {
        const symbol = row.dataset.symbol;
        Router.navigate('#analysis');
        setTimeout(() => AnalysisView.loadAsset(symbol), 50);
      });
    });

    // Recent Transactions list
    recentTxTableBody.innerHTML = renderRecentTransactions(transactions);

    // Render Chart.js
    renderAllocationDonut(holdingsWithPrices);
    renderGrowthLineChart();
  }

  function renderRecentTransactions(txs) {
    const list = txs.slice(0, 5);
    if (list.length === 0) {
      return `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No transactions.</td></tr>`;
    }
    return list.map(tx => {
      const asset = DataAPI.getAsset(tx.symbol);
      const isTHB = asset && asset.type === 'stock-th';
      const curLabel = isTHB ? '฿' : '$';
      return `
        <tr>
          <td style="font-size: 0.82rem; color: var(--text-secondary);">${tx.date}</td>
          <td><span class="badge badge--${tx.type}">${tx.type}</span></td>
          <td style="font-weight: 700;">${tx.symbol}</td>
          <td class="text-mono">${tx.quantity.toLocaleString('en-US')}</td>
          <td class="text-mono">${curLabel}${tx.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');
  }

  // ─── CHARTS DRAWING ───────────────────────────────────────────────
  function renderAllocationDonut(holdings) {
    const ctx = document.getElementById('db-allocation-chart');
    if (!ctx) return;

    if (allocationChart) {
      allocationChart.destroy();
    }

    const data = holdings.map(h => h.valueUSD);
    const labels = holdings.map(h => h.symbol);

    // HSL palette
    const colors = holdings.map((_, i) => `hsl(${(i * (360 / holdings.length)) % 360}, 75%, 52%)`);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textThemeColor = isDark ? '#e6edf3' : '#24292f';

    allocationChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? '#161b22' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: textThemeColor,
              font: {
                family: 'Inter',
                size: 11
              },
              boxWidth: 12
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((val / total) * 100).toFixed(1);
                return ` ${context.label}: $${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pct}%)`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  function renderGrowthLineChart() {
    const ctx = document.getElementById('db-growth-chart');
    if (!ctx) return;

    if (growthChart) {
      growthChart.destroy();
    }

    const snapshots = StorageManager.getSnapshots();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textThemeColor = isDark ? '#8b949e' : '#57606a';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    if (snapshots.length === 0) {
      // Draw empty placeholder line
      const dates = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
      }
      growthChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [{
            label: 'Cost Basis',
            data: Array(7).fill(0),
            borderColor: 'rgba(0, 188, 212, 0.25)',
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { display: false },
            x: { display: false }
          }
        }
      });
      return;
    }

    const labels = snapshots.map(s => s.date);
    const data = snapshots.map(s => s.value);

    growthChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Portfolio Value (Cost Proxy)',
          data: data,
          borderColor: '#00bcd4',
          borderWidth: 2.5,
          pointBackgroundColor: '#00bcd4',
          pointHoverRadius: 5,
          pointRadius: snapshots.length > 20 ? 0 : 3,
          tension: 0.15,
          fill: true,
          backgroundColor: 'rgba(0, 188, 212, 0.06)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: textThemeColor,
              maxTicksLimit: 7,
              font: { family: 'Inter', size: 10 }
            }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textThemeColor,
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (value) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
            }
          }
        }
      }
    });
  }

  function destroyCharts() {
    if (allocationChart) {
      allocationChart.destroy();
      allocationChart = null;
    }
    if (growthChart) {
      growthChart.destroy();
      growthChart = null;
    }
  }

  return {
    onEnter,
    onLeave
  };
})();
