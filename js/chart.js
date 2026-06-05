/**
 * Investment Analyzer — Chart Module
 * TradingView Lightweight Charts integration with technical overlays
 */

const ChartModule = (() => {

  let mainChart = null;
  let volumeChart = null;
  let candleSeries = null;
  let volumeSeries = null;

  // Overlay series on main chart
  let sma20Series = null;
  let sma50Series = null;
  let sma200Series = null;
  let bbUpperSeries = null;
  let bbMiddleSeries = null;
  let bbLowerSeries = null;

  // Track containers
  let mainContainer = null;
  let volumeContainer = null;

  // Resize observer
  let resizeObserver = null;

  // ─── INITIALIZE ───────────────────────────────────────────────────

  /**
   * Initialize the chart instances
   * @param {string} mainContainerId - DOM id for main chart
   * @param {string} volumeContainerId - DOM id for volume chart
   */
  function init(mainContainerId, volumeContainerId) {
    mainContainer = document.getElementById(mainContainerId);
    volumeContainer = document.getElementById(volumeContainerId);

    if (!mainContainer || !volumeContainer) {
      console.error('Chart containers not found');
      return;
    }

    createCharts();
    setupResize();
  }

  function createCharts() {
    const colors = ThemeManager.getChartColors();

    // Destroy existing charts
    destroy();

    // --- Main Chart (Candlestick + overlays) ---
    mainChart = LightweightCharts.createChart(mainContainer, {
      width: mainContainer.clientWidth,
      height: mainContainer.clientHeight || 320,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: colors.textColor,
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
        vertLine: { color: colors.crosshairColor, width: 1, style: LightweightCharts.LineStyle.Dashed },
        horzLine: { color: colors.crosshairColor, width: 1, style: LightweightCharts.LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: colors.gridColor,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: colors.gridColor,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    // Candlestick series
    candleSeries = mainChart.addCandlestickSeries({
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderDownColor: colors.downColor,
      borderUpColor: colors.upColor,
      wickDownColor: colors.wickDownColor,
      wickUpColor: colors.wickUpColor,
    });

    // SMA overlays
    sma20Series = mainChart.addLineSeries({
      color: colors.sma20Color,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'SMA 20',
    });

    sma50Series = mainChart.addLineSeries({
      color: colors.sma50Color,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'SMA 50',
    });

    sma200Series = mainChart.addLineSeries({
      color: colors.sma200Color,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: 'SMA 200',
    });

    // Bollinger Bands
    bbUpperSeries = mainChart.addLineSeries({
      color: colors.bbUpperColor,
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    bbMiddleSeries = mainChart.addLineSeries({
      color: colors.bbMiddleColor,
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    bbLowerSeries = mainChart.addLineSeries({
      color: colors.bbLowerColor,
      lineWidth: 1,
      lineStyle: LightweightCharts.LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // --- Volume Chart ---
    volumeChart = LightweightCharts.createChart(volumeContainer, {
      width: volumeContainer.clientWidth,
      height: volumeContainer.clientHeight || 100,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: colors.textColor,
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      rightPriceScale: {
        borderColor: colors.gridColor,
        scaleMargins: { top: 0.1, bottom: 0 },
      },
      timeScale: {
        borderColor: colors.gridColor,
        visible: false,
      },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
      handleScroll: false,
      handleScale: false,
    });

    volumeSeries = volumeChart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });

    // Sync time scales
    mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) {
        volumeChart.timeScale().setVisibleLogicalRange(range);
      }
    });

    volumeChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) {
        mainChart.timeScale().setVisibleLogicalRange(range);
      }
    });
  }

  // ─── UPDATE DATA ──────────────────────────────────────────────────

  /**
   * Set chart data and overlays
   * @param {Array} ohlcv - OHLCV data array
   * @param {object} indicators - Computed indicators from Indicators.computeAll()
   */
  function setData(ohlcv, indicators) {
    if (!mainChart || !candleSeries) return;

    const colors = ThemeManager.getChartColors();

    // Set candlestick data
    candleSeries.setData(ohlcv.map(d => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    })));

    // Set volume data
    volumeSeries.setData(ohlcv.map(d => ({
      time: d.time,
      value: d.volume || 0,
      color: d.close >= d.open ? colors.volumeUpColor : colors.volumeDownColor,
    })));

    // Set indicator overlays (clear all first to avoid stale data)
    sma20Series.setData([]);
    sma50Series.setData([]);
    sma200Series.setData([]);
    bbUpperSeries.setData([]);
    bbMiddleSeries.setData([]);
    bbLowerSeries.setData([]);

    if (indicators && !indicators.error) {
      // SMAs — only show if we have meaningful data (at least 5 points for a visible line)
      if (indicators.movingAverages.sma20.series.length >= 5) {
        sma20Series.setData(indicators.movingAverages.sma20.series);
      }
      if (indicators.movingAverages.sma50.series.length >= 5) {
        sma50Series.setData(indicators.movingAverages.sma50.series);
      }
      if (indicators.movingAverages.sma200.series.length >= 5) {
        sma200Series.setData(indicators.movingAverages.sma200.series);
      }

      // Bollinger Bands
      if (indicators.bollingerBands.series.upper.length >= 5) {
        bbUpperSeries.setData(indicators.bollingerBands.series.upper);
        bbMiddleSeries.setData(indicators.bollingerBands.series.middle);
        bbLowerSeries.setData(indicators.bollingerBands.series.lower);
      }
    }

    // Fit content
    mainChart.timeScale().fitContent();
    volumeChart.timeScale().fitContent();
  }

  // ─── THEME UPDATE ─────────────────────────────────────────────────

  /**
   * Recreate charts with new theme colors
   */
  function updateTheme() {
    // Store current data to re-apply after recreation
    // Simplest approach: just recreate charts
    createCharts();
  }

  // ─── RESIZE ───────────────────────────────────────────────────────

  function setupResize() {
    if (resizeObserver) resizeObserver.disconnect();

    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (entry.target === mainContainer && mainChart) {
          mainChart.applyOptions({ width });
        }
        if (entry.target === volumeContainer && volumeChart) {
          volumeChart.applyOptions({ width });
        }
      }
    });

    if (mainContainer) resizeObserver.observe(mainContainer);
    if (volumeContainer) resizeObserver.observe(volumeContainer);
  }

  // ─── DESTROY ──────────────────────────────────────────────────────

  function destroy() {
    if (mainChart) {
      mainChart.remove();
      mainChart = null;
    }
    if (volumeChart) {
      volumeChart.remove();
      volumeChart = null;
    }
    candleSeries = null;
    volumeSeries = null;
    sma20Series = null;
    sma50Series = null;
    sma200Series = null;
    bbUpperSeries = null;
    bbMiddleSeries = null;
    bbLowerSeries = null;
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────

  return {
    init,
    setData,
    updateTheme,
    destroy,
  };

})();
