/**
 * Investment Portfolio Manager — Portfolio Analytics Tab View
 * Renders diversification scores, realized vs unrealized profit metrics, weight stacks, and charts.
 */

const AnalyticsView = (() => {

  let pnlChart = null;

  // ─── LIFECYCLE HOOKS ──────────────────────────────────────────────
  async function onEnter() {
    renderAnalytics();
  }

  function onLeave() {
    // Nothing to do
  }

  // ─── RENDERING & CALCULATIONS ─────────────────────────────────────
  async function renderAnalytics() {
    const holdings = StorageManager.getHoldings();
    const tableBody = document.querySelector('#analytics-holdings-table tbody');
    const divValEl = document.getElementById('analytics-div-val');
    const divFillEl = document.getElementById('analytics-div-fill');
    const divLabelEl = document.getElementById('analytics-div-label');
    const divDescEl = document.getElementById('analytics-div-desc');
    const barVisualizer = document.getElementById('holdings-bar-visualizer');
    const barLegend = document.getElementById('holdings-bar-legend');

    if (holdings.length === 0) {
      divValEl.textContent = '—';
      divFillEl.style.strokeDashoffset = '326.73';
      divLabelEl.textContent = 'No Holdings';
      divLabelEl.className = 'score-card__signal neutral';
      divDescEl.textContent = 'Add transaction data to see diversification analysis.';
      
      if (barVisualizer) barVisualizer.innerHTML = '';
      if (barLegend) barLegend.innerHTML = '';
      
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-secondary);">No assets currently held.</td></tr>`;
      
      destroyChart();
      renderEmptyPnLChart();
      return;
    }

    // Load prices for holdings
    const uniqueSymbols = holdings.map(h => h.symbol);
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

    // Calculate valuations
    let totalValueUSD = 0;
    let totalRealizedPnLUSD = 0;
    let totalUnrealizedPnLUSD = 0;

    const analyzedHoldings = holdings.map(h => {
      const pInfo = prices[h.symbol];
      const curPrice = pInfo ? pInfo.price : h.avgBuyPrice;
      const convRate = (pInfo && pInfo.type === 'stock-th') ? THB_TO_USD : 1;

      const valUSD = h.quantity * curPrice * convRate;
      const costUSD = h.quantity * h.avgBuyPrice * convRate;
      const unrealizedPnL = valUSD - costUSD;
      const realizedPnL = h.realizedPnL * convRate;

      totalValueUSD += valUSD;
      totalRealizedPnLUSD += realizedPnL;
      totalUnrealizedPnLUSD += unrealizedPnL;

      return {
        ...h,
        currentPrice: curPrice,
        currency: pInfo ? pInfo.currency : 'USD',
        category: pInfo ? pInfo.type : 'stock',
        valueUSD: valUSD,
        unrealizedPnLUSD: unrealizedPnL,
        realizedPnLUSD: realizedPnL
      };
    });

    // Herfindahl-Hirschman Index (HHI) Diversification Score
    const weights = analyzedHoldings.map(h => h.valueUSD / totalValueUSD);
    const hhi = weights.reduce((sum, w) => sum + w * w, 0);
    const divScore = Math.round((1 - hhi) * 100);

    // Display Diversification Score
    divValEl.textContent = divScore.toString();
    const circumference = 2 * Math.PI * 52;
    const offset = circumference - (divScore / 100) * circumference;
    divFillEl.style.strokeDashoffset = offset;

    // Verbose levels
    let divLabelText = 'Single Position';
    let divLabelClass = 'strong-sell';
    let divDescText = 'Your portfolio is fully concentrated in a single asset. Diversification reduces risk.';
    let scoreColor = 'var(--color-strong-sell)';

    if (divScore >= 80) {
      divLabelText = 'Excellent Spread';
      divLabelClass = 'strong-buy';
      divDescText = 'High degree of diversification. Risk is distributed optimally across holdings.';
      scoreColor = 'var(--color-strong-buy)';
    } else if (divScore >= 60) {
      divLabelText = 'Good Spread';
      divLabelClass = 'buy';
      divDescText = 'Healthy balance. Position sizing is managed correctly to avoid high concentration.';
      scoreColor = 'var(--color-buy)';
    } else if (divScore >= 40) {
      divLabelText = 'Moderate Concentrated';
      divLabelClass = 'hold';
      divDescText = 'Moderately concentrated. A few assets hold large weights. Watch for sector correlation.';
      scoreColor = 'var(--color-hold)';
    } else if (divScore >= 20) {
      divLabelText = 'Highly Concentrated';
      divLabelClass = 'sell';
      divDescText = 'Highly concentrated on a small set of positions. Large movements will highly impact value.';
      scoreColor = 'var(--color-sell)';
    }

    divLabelEl.textContent = divLabelText;
    divLabelEl.className = `score-card__signal`;
    divLabelEl.setAttribute('data-signal', divLabelClass);
    divDescEl.textContent = divDescText;
    divFillEl.style.stroke = scoreColor;

    // Render weight visualizer progress bar
    analyzedHoldings.sort((a, b) => b.valueUSD - a.valueUSD);
    
    // Assign HSL colors for each element
    const palette = analyzedHoldings.map((h, idx) => ({
      symbol: h.symbol,
      color: `hsl(${(idx * (360 / analyzedHoldings.length)) % 360}, 75%, 52%)`,
      weight: totalValueUSD > 0 ? (h.valueUSD / totalValueUSD) * 100 : 0
    }));

    if (barVisualizer) {
      barVisualizer.innerHTML = palette.map(p => `
        <div style="width: ${p.weight}%; background: ${p.color}; transition: width var(--transition-slow);" title="${p.symbol}: ${p.weight.toFixed(1)}%"></div>
      `).join('');
    }

    if (barLegend) {
      barLegend.innerHTML = palette.map(p => `
        <div style="display:flex; align-items:center; gap: 4px;">
          <div style="width:10px; height:10px; border-radius:2px; background:${p.color};"></div>
          <span style="font-weight:700;">${p.symbol}</span>
          <span style="color:var(--text-secondary);">${p.weight.toFixed(1)}%</span>
        </div>
      `).join('');
    }

    // Populate holdings detail table
    tableBody.innerHTML = analyzedHoldings.map(h => {
      const curLabel = h.currency === 'THB' ? '฿' : '$';
      const weight = totalValueUSD > 0 ? (h.valueUSD / totalValueUSD) * 100 : 0;
      
      const unPnLpct = h.avgBuyPrice > 0 ? ((h.currentPrice - h.avgBuyPrice) / h.avgBuyPrice) * 100 : 0;
      const unPnLColor = h.unrealizedPnLUSD >= 0 ? 'text-bullish' : 'text-bearish';
      const rePnLColor = h.realizedPnLUSD >= 0 ? 'text-bullish' : 'text-bearish';

      return `
        <tr>
          <td style="font-weight: 700;">${h.symbol}</td>
          <td><span class="badge badge--${h.category}">${h.category}</span></td>
          <td class="text-mono">${h.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })}</td>
          <td class="text-mono">${curLabel}${h.avgBuyPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="text-mono">${curLabel}${h.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="text-mono" style="font-weight: 600;">$${h.valueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="text-mono">${weight.toFixed(1)}%</td>
          <td class="text-mono ${rePnLColor}" style="font-weight: 600;">
            $${h.realizedPnLUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td class="text-mono ${unPnLColor}" style="font-weight: 600;">
            $${h.unrealizedPnLUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${unPnLpct >= 0 ? '+' : ''}${unPnLpct.toFixed(1)}%)
          </td>
        </tr>
      `;
    }).join('');

    // Draw comparison chart
    renderPnLComparisonChart(totalRealizedPnLUSD, totalUnrealizedPnLUSD);
  }

  // ─── CHARTS DRAWING ───────────────────────────────────────────────
  function renderPnLComparisonChart(realized, unrealized) {
    const ctx = document.getElementById('analytics-pnl-comparison-chart');
    if (!ctx) return;

    destroyChart();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textThemeColor = isDark ? '#8b949e' : '#57606a';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

    pnlChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Realized P/L', 'Unrealized P/L'],
        datasets: [{
          data: [realized, unrealized],
          backgroundColor: [
            realized >= 0 ? 'rgba(0, 200, 83, 0.65)' : 'rgba(255, 23, 68, 0.65)',
            unrealized >= 0 ? 'rgba(0, 188, 212, 0.65)' : 'rgba(255, 23, 68, 0.65)'
          ],
          borderColor: [
            realized >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)',
            unrealized >= 0 ? 'var(--accent-primary)' : 'var(--color-bearish)'
          ],
          borderWidth: 1.5,
          borderRadius: 4
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
            grid: { display: false },
            ticks: { color: textThemeColor, font: { family: 'Inter', size: 11 } }
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

  function renderEmptyPnLChart() {
    const ctx = document.getElementById('analytics-pnl-comparison-chart');
    if (!ctx) return;
    
    pnlChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Realized P/L', 'Unrealized P/L'],
        datasets: [{
          data: [0, 0],
          backgroundColor: ['rgba(0, 188, 212, 0.15)', 'rgba(0, 188, 212, 0.15)'],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false } },
          y: { grid: { display: false }, display: false }
        }
      }
    });
  }

  function destroyChart() {
    if (pnlChart) {
      pnlChart.destroy();
      pnlChart = null;
    }
  }

  return {
    onEnter,
    onLeave
  };
})();
