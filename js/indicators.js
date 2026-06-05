/**
 * Investment Analyzer — Technical Indicators Engine
 * Pure JavaScript calculations for RSI, MACD, SMA, EMA, Bollinger Bands, Volume Analysis
 */

const Indicators = (() => {

  // ─── HELPERS ──────────────────────────────────────────────────────

  /**
   * Extract closing prices from OHLC data
   * @param {Array<{close: number}>} data
   * @returns {number[]}
   */
  function closes(data) {
    return data.map(d => d.close);
  }

  // ─── SIMPLE MOVING AVERAGE (SMA) ─────────────────────────────────

  /**
   * Calculate Simple Moving Average
   * @param {number[]} values
   * @param {number} period
   * @returns {Array<{index: number, value: number}>}
   */
  function sma(values, period) {
    const result = [];
    if (values.length < period) return result;
    let sum = 0;
    for (let i = 0; i < period; i++) sum += values[i];
    result.push({ index: period - 1, value: sum / period });
    for (let i = period; i < values.length; i++) {
      sum += values[i] - values[i - period];
      result.push({ index: i, value: sum / period });
    }
    return result;
  }

  /**
   * SMA with time series output (aligned with source data)
   * @param {Array<{time: number, close: number}>} data
   * @param {number} period
   * @returns {Array<{time: number, value: number}>}
   */
  function smaTimeSeries(data, period) {
    const vals = closes(data);
    const smaVals = sma(vals, period);
    return smaVals.map(s => ({
      time: data[s.index].time,
      value: parseFloat(s.value.toFixed(6))
    }));
  }

  // ─── EXPONENTIAL MOVING AVERAGE (EMA) ─────────────────────────────

  /**
   * Calculate Exponential Moving Average
   * @param {number[]} values
   * @param {number} period
   * @returns {Array<{index: number, value: number}>}
   */
  function ema(values, period) {
    const result = [];
    if (values.length < period) return result;
    const multiplier = 2 / (period + 1);
    // Start with SMA for initial value
    let sum = 0;
    for (let i = 0; i < period; i++) sum += values[i];
    let emaVal = sum / period;
    result.push({ index: period - 1, value: emaVal });
    for (let i = period; i < values.length; i++) {
      emaVal = (values[i] - emaVal) * multiplier + emaVal;
      result.push({ index: i, value: emaVal });
    }
    return result;
  }

  /**
   * EMA with time series output
   */
  function emaTimeSeries(data, period) {
    const vals = closes(data);
    const emaVals = ema(vals, period);
    return emaVals.map(e => ({
      time: data[e.index].time,
      value: parseFloat(e.value.toFixed(6))
    }));
  }

  // ─── RSI (Relative Strength Index) ─────────────────────────────────

  /**
   * Calculate RSI
   * @param {number[]} values - Closing prices
   * @param {number} period - Default 14
   * @returns {Array<{index: number, value: number}>}
   */
  function rsi(values, period = 14) {
    const result = [];
    if (values.length < period + 1) return result;

    let gains = 0;
    let losses = 0;

    // Initial average gain/loss
    for (let i = 1; i <= period; i++) {
      const change = values[i] - values[i - 1];
      if (change >= 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // First RSI value
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    let rsiVal = 100 - (100 / (1 + rs));
    result.push({ index: period, value: rsiVal });

    // Subsequent values using smoothed method
    for (let i = period + 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];
      const gain = change >= 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsiVal = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
      result.push({ index: i, value: rsiVal });
    }

    return result;
  }

  /**
   * RSI with time series output
   */
  function rsiTimeSeries(data, period = 14) {
    const vals = closes(data);
    const rsiVals = rsi(vals, period);
    return rsiVals.map(r => ({
      time: data[r.index].time,
      value: parseFloat(r.value.toFixed(2))
    }));
  }

  // ─── MACD ─────────────────────────────────────────────────────────

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   * @param {number[]} values
   * @param {number} fastPeriod - Default 12
   * @param {number} slowPeriod - Default 26
   * @param {number} signalPeriod - Default 9
   * @returns {{ macd: Array, signal: Array, histogram: Array }}
   */
  function macd(values, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const fastEMA = ema(values, fastPeriod);
    const slowEMA = ema(values, slowPeriod);

    // MACD line = Fast EMA - Slow EMA
    const macdLine = [];
    let slowIdx = 0;
    for (let i = 0; i < fastEMA.length; i++) {
      while (slowIdx < slowEMA.length && slowEMA[slowIdx].index < fastEMA[i].index) {
        slowIdx++;
      }
      if (slowIdx < slowEMA.length && slowEMA[slowIdx].index === fastEMA[i].index) {
        macdLine.push({
          index: fastEMA[i].index,
          value: fastEMA[i].value - slowEMA[slowIdx].value
        });
      }
    }

    // Signal line = EMA of MACD line
    const macdValues = macdLine.map(m => m.value);
    const signalEMA = ema(macdValues, signalPeriod);

    // Align signal with MACD indices
    const signal = signalEMA.map(s => ({
      index: macdLine[s.index].index,
      value: s.value
    }));

    // Histogram = MACD - Signal
    const histogram = [];
    let sigIdx = 0;
    for (let i = 0; i < macdLine.length; i++) {
      while (sigIdx < signal.length && signal[sigIdx].index < macdLine[i].index) {
        sigIdx++;
      }
      if (sigIdx < signal.length && signal[sigIdx].index === macdLine[i].index) {
        histogram.push({
          index: macdLine[i].index,
          value: macdLine[i].value - signal[sigIdx].value
        });
      }
    }

    return { macd: macdLine, signal, histogram };
  }

  /**
   * MACD with time series output
   */
  function macdTimeSeries(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const vals = closes(data);
    const result = macd(vals, fastPeriod, slowPeriod, signalPeriod);

    return {
      macd: result.macd.map(m => ({
        time: data[m.index].time,
        value: parseFloat(m.value.toFixed(6))
      })),
      signal: result.signal.map(s => ({
        time: data[s.index].time,
        value: parseFloat(s.value.toFixed(6))
      })),
      histogram: result.histogram.map(h => ({
        time: data[h.index].time,
        value: parseFloat(h.value.toFixed(6)),
        color: h.value >= 0 ? '#00c85380' : '#ff174480'
      }))
    };
  }

  // ─── BOLLINGER BANDS ──────────────────────────────────────────────

  /**
   * Calculate Bollinger Bands
   * @param {number[]} values
   * @param {number} period - Default 20
   * @param {number} stdDev - Default 2
   * @returns {Array<{index: number, upper: number, middle: number, lower: number}>}
   */
  function bollingerBands(values, period = 20, stdDev = 2) {
    const result = [];
    if (values.length < period) return result;

    const smaVals = sma(values, period);

    for (let i = 0; i < smaVals.length; i++) {
      const idx = smaVals[i].index;
      const middle = smaVals[i].value;

      // Calculate standard deviation
      let sumSqDiff = 0;
      for (let j = idx - period + 1; j <= idx; j++) {
        sumSqDiff += Math.pow(values[j] - middle, 2);
      }
      const sd = Math.sqrt(sumSqDiff / period);

      result.push({
        index: idx,
        upper: middle + stdDev * sd,
        middle: middle,
        lower: middle - stdDev * sd,
        bandwidth: ((middle + stdDev * sd) - (middle - stdDev * sd)) / middle * 100
      });
    }

    return result;
  }

  /**
   * Bollinger Bands with time series output
   */
  function bollingerTimeSeries(data, period = 20, stdDev = 2) {
    const vals = closes(data);
    const bb = bollingerBands(vals, period, stdDev);

    return {
      upper: bb.map(b => ({ time: data[b.index].time, value: parseFloat(b.upper.toFixed(6)) })),
      middle: bb.map(b => ({ time: data[b.index].time, value: parseFloat(b.middle.toFixed(6)) })),
      lower: bb.map(b => ({ time: data[b.index].time, value: parseFloat(b.lower.toFixed(6)) }))
    };
  }

  // ─── VOLUME ANALYSIS ──────────────────────────────────────────────

  /**
   * Volume analysis with SMA comparison
   * @param {Array<{time: number, volume: number, close: number, open: number}>} data
   * @param {number} period - SMA period for volume, default 20
   * @returns {{ volumeSMA: Array, analysis: object }}
   */
  function volumeAnalysis(data, period = 20) {
    const volumes = data.map(d => d.volume || 0);
    const volSMA = sma(volumes, period);

    // Latest volume vs SMA
    const latestVol = volumes[volumes.length - 1];
    const latestSMA = volSMA.length > 0 ? volSMA[volSMA.length - 1].value : latestVol;
    let ratio = latestSMA > 0 ? latestVol / latestSMA : 1;
    if (!isFinite(ratio) || isNaN(ratio)) ratio = 1;

    // Check if latest candle is up or down
    const latest = data[data.length - 1];
    const isUp = latest.close >= latest.open;

    return {
      volumeSMA: volSMA.map(v => ({
        time: data[v.index].time,
        value: parseFloat(v.value.toFixed(2))
      })),
      currentVolume: latestVol,
      avgVolume: latestSMA,
      volumeRatio: ratio,
      isUpCandle: isUp,
      signal: ratio > 1.5 && isUp ? 'bullish' :
              ratio > 1.5 && !isUp ? 'bearish' :
              ratio < 0.5 ? 'low' : 'normal'
    };
  }

  // ─── FULL ANALYSIS (ALL INDICATORS) ───────────────────────────────

  /**
   * Compute all indicators for a given dataset
   * @param {Array<{time: number, open: number, high: number, low: number, close: number, volume: number}>} data
   * @returns {object} All computed indicators
   */
  function computeAll(data) {
    if (!data || data.length < 30) {
      return { error: 'Insufficient data (need at least 30 data points)' };
    }

    const closePrices = closes(data);
    const latestClose = closePrices[closePrices.length - 1];

    // RSI
    const rsiData = rsiTimeSeries(data, 14);
    const latestRSI = rsiData.length > 0 ? rsiData[rsiData.length - 1].value : null;

    // MACD
    const macdData = macdTimeSeries(data);
    const latestMACD = macdData.macd.length > 0 ? macdData.macd[macdData.macd.length - 1].value : null;
    const latestSignal = macdData.signal.length > 0 ? macdData.signal[macdData.signal.length - 1].value : null;
    const latestHistogram = macdData.histogram.length > 0 ? macdData.histogram[macdData.histogram.length - 1].value : null;
    // Check previous histogram for direction
    const prevHistogram = macdData.histogram.length > 1 ? macdData.histogram[macdData.histogram.length - 2].value : null;

    // Moving Averages
    const sma20 = smaTimeSeries(data, 20);
    const sma50 = data.length >= 50 ? smaTimeSeries(data, 50) : [];
    const sma200 = data.length >= 200 ? smaTimeSeries(data, 200) : [];

    const latestSMA20 = sma20.length > 0 ? sma20[sma20.length - 1].value : null;
    const latestSMA50 = sma50.length > 0 ? sma50[sma50.length - 1].value : null;
    const latestSMA200 = sma200.length > 0 ? sma200[sma200.length - 1].value : null;

    // Bollinger Bands
    const bbData = bollingerTimeSeries(data, 20, 2);
    const latestBBUpper = bbData.upper.length > 0 ? bbData.upper[bbData.upper.length - 1].value : null;
    const latestBBMiddle = bbData.middle.length > 0 ? bbData.middle[bbData.middle.length - 1].value : null;
    const latestBBLower = bbData.lower.length > 0 ? bbData.lower[bbData.lower.length - 1].value : null;

    // Volume
    const volData = volumeAnalysis(data);

    return {
      price: latestClose,
      rsi: {
        series: rsiData,
        value: latestRSI,
        signal: latestRSI !== null
          ? (latestRSI < 30 ? 'oversold' : latestRSI > 70 ? 'overbought' : 'neutral')
          : 'unknown'
      },
      macd: {
        series: macdData,
        value: latestMACD,
        signalLine: latestSignal,
        histogram: latestHistogram,
        histogramDirection: (prevHistogram !== null && latestHistogram !== null)
          ? (latestHistogram > prevHistogram ? 'rising' : 'falling')
          : 'unknown',
        signal: latestMACD !== null && latestSignal !== null
          ? (latestMACD > latestSignal ? 'bullish' : 'bearish')
          : 'unknown'
      },
      movingAverages: {
        sma20: { series: sma20, value: latestSMA20 },
        sma50: { series: sma50, value: latestSMA50 },
        sma200: { series: sma200, value: latestSMA200 },
        trend: determineMATrend(latestClose, latestSMA20, latestSMA50, latestSMA200),
        goldenCross: latestSMA50 !== null && latestSMA200 !== null && latestSMA50 > latestSMA200,
        deathCross: latestSMA50 !== null && latestSMA200 !== null && latestSMA50 < latestSMA200
      },
      bollingerBands: {
        series: bbData,
        upper: latestBBUpper,
        middle: latestBBMiddle,
        lower: latestBBLower,
        position: determineBBPosition(latestClose, latestBBUpper, latestBBMiddle, latestBBLower),
        signal: determineBBSignal(latestClose, latestBBUpper, latestBBMiddle, latestBBLower)
      },
      volume: volData
    };
  }

  // ─── HELPERS FOR SIGNAL DETERMINATION ─────────────────────────────

  function determineMATrend(price, sma20, sma50, sma200) {
    if (sma20 === null) return 'unknown';

    // If we don't have SMA50, use simplified analysis
    if (sma50 === null) {
      if (price > sma20) return 'bullish';
      if (price < sma20) return 'bearish';
      return 'neutral';
    }

    let bullishCount = 0;
    let totalChecks = 0;

    // Price vs SMAs
    totalChecks++;
    if (price > sma20) bullishCount++;
    totalChecks++;
    if (price > sma50) bullishCount++;
    totalChecks++;
    if (sma20 > sma50) bullishCount++;

    if (sma200 !== null) {
      totalChecks++;
      if (price > sma200) bullishCount++;
      totalChecks++;
      if (sma50 > sma200) bullishCount++;
    }

    const bullishRatio = bullishCount / totalChecks;

    if (bullishRatio >= 0.8) return 'strong-bullish';
    if (bullishRatio >= 0.6) return 'bullish';
    if (bullishRatio <= 0.2) return 'strong-bearish';
    if (bullishRatio <= 0.4) return 'bearish';
    return 'neutral';
  }

  function determineBBPosition(price, upper, middle, lower) {
    if (upper === null || lower === null) return 'unknown';
    const range = upper - lower;
    if (range === 0) return 'neutral';
    return ((price - lower) / range * 100).toFixed(1);
  }

  function determineBBSignal(price, upper, middle, lower) {
    if (upper === null || lower === null) return 'unknown';
    const range = upper - lower;
    if (range === 0) return 'neutral';
    const position = (price - lower) / range;
    if (position <= 0.1) return 'oversold';
    if (position >= 0.9) return 'overbought';
    if (position <= 0.3) return 'bullish';
    if (position >= 0.7) return 'bearish';
    return 'neutral';
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────

  return {
    sma,
    ema,
    smaTimeSeries,
    emaTimeSeries,
    rsi,
    rsiTimeSeries,
    macd,
    macdTimeSeries,
    bollingerBands,
    bollingerTimeSeries,
    volumeAnalysis,
    computeAll
  };

})();
