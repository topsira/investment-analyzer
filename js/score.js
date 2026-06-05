/**
 * Investment Analyzer — Investment Score Engine
 * Aggregates all technical indicators into a single 0-100 Investment Score
 */

const ScoreEngine = (() => {

  // ─── WEIGHT CONFIGURATION ─────────────────────────────────────────

  const WEIGHTS = {
    rsi: 0.20,
    macd: 0.20,
    movingAverages: 0.25,
    bollingerBands: 0.15,
    volume: 0.20
  };

  // ─── INDIVIDUAL INDICATOR SCORING ─────────────────────────────────

  /**
   * Score RSI (0-100)
   * < 20 → 95 (very oversold = very bullish)
   * 20-30 → 80 (oversold = bullish)
   * 30-45 → 65 (slightly bullish)
   * 45-55 → 50 (neutral)
   * 55-70 → 35 (slightly bearish)
   * 70-80 → 20 (overbought = bearish)
   * > 80 → 5 (very overbought = very bearish)
   */
  function scoreRSI(rsiValue) {
    if (rsiValue === null || rsiValue === undefined) return { score: 50, signal: 'unknown', detail: 'No RSI data' };

    let score;
    if (rsiValue < 20) score = 95;
    else if (rsiValue < 30) score = 70 + (30 - rsiValue) / 10 * 25;
    else if (rsiValue < 45) score = 55 + (45 - rsiValue) / 15 * 15;
    else if (rsiValue < 55) score = 45 + (55 - rsiValue) / 10 * 10;
    else if (rsiValue < 70) score = 25 + (70 - rsiValue) / 15 * 20;
    else if (rsiValue < 80) score = 10 + (80 - rsiValue) / 10 * 15;
    else score = 5;

    score = Math.round(Math.max(0, Math.min(100, score)));

    const signal = score >= 65 ? 'bullish' : score <= 35 ? 'bearish' : 'neutral';
    const detail = rsiValue < 30 ? `RSI at ${rsiValue.toFixed(1)} — Oversold territory`
                 : rsiValue > 70 ? `RSI at ${rsiValue.toFixed(1)} — Overbought territory`
                 : `RSI at ${rsiValue.toFixed(1)} — Normal range`;

    return { score, signal, detail, value: rsiValue };
  }

  /**
   * Score MACD (0-100)
   * Based on: MACD vs Signal line, histogram direction
   */
  function scoreMACD(macdData) {
    if (!macdData || macdData.value === null) return { score: 50, signal: 'unknown', detail: 'No MACD data' };

    let score = 50; // Start neutral

    // MACD above/below signal line: ±20 points
    if (macdData.signal === 'bullish') score += 20;
    else if (macdData.signal === 'bearish') score -= 20;

    // Histogram direction: ±15 points
    if (macdData.histogramDirection === 'rising') score += 15;
    else if (macdData.histogramDirection === 'falling') score -= 15;

    // Histogram magnitude relative to MACD value
    if (macdData.histogram !== null && macdData.value !== null) {
      if (macdData.histogram > 0 && macdData.value > 0) score += 10;
      else if (macdData.histogram < 0 && macdData.value < 0) score -= 10;
    }

    score = Math.round(Math.max(0, Math.min(100, score)));

    const signal = score >= 65 ? 'bullish' : score <= 35 ? 'bearish' : 'neutral';
    const crossDesc = macdData.signal === 'bullish' ? 'MACD above signal' : 'MACD below signal';
    const dirDesc = macdData.histogramDirection === 'rising' ? ', momentum rising' : macdData.histogramDirection === 'falling' ? ', momentum falling' : '';
    const detail = `${crossDesc}${dirDesc}`;

    return { score, signal, detail, value: macdData.value };
  }

  /**
   * Score Moving Averages (0-100)
   * Based on: Price vs SMAs, Golden/Death cross
   */
  function scoreMovingAverages(maData) {
    if (!maData || maData.trend === 'unknown') return { score: 50, signal: 'unknown', detail: 'No MA data' };

    let score = 50;

    // Trend scoring
    switch (maData.trend) {
      case 'strong-bullish': score = 90; break;
      case 'bullish': score = 70; break;
      case 'neutral': score = 50; break;
      case 'bearish': score = 30; break;
      case 'strong-bearish': score = 10; break;
    }

    // Golden/Death cross adjustments — cross should override trend if conflicting
    if (maData.goldenCross) {
      score = Math.max(score, 65); // At minimum bullish if golden cross
      score = Math.min(100, score + 5);
    }
    if (maData.deathCross) {
      score = Math.min(score, 35); // At most bearish if death cross
      score = Math.max(0, score - 5);
    }

    score = Math.round(Math.max(0, Math.min(100, score)));

    const signal = score >= 65 ? 'bullish' : score <= 35 ? 'bearish' : 'neutral';

    // Build detail text — use final signal for clarity, not raw trend
    let detail = `Trend: ${signal}`;
    if (maData.goldenCross) detail += ' · Golden Cross ✨';
    if (maData.deathCross) detail += ' · Death Cross ⚠️';
    if (maData.sma200 && maData.sma200.value === null) {
      detail += ' · SMA200 N/A';
    }

    return { score, signal, detail };
  }

  /**
   * Score Bollinger Bands (0-100)
   * Near lower band = potential bounce (bullish)
   * Near upper band = potential resistance (bearish)
   */
  function scoreBollingerBands(bbData) {
    if (!bbData || bbData.signal === 'unknown') return { score: 50, signal: 'unknown', detail: 'No BB data' };

    let score = 50;
    const position = parseFloat(bbData.position);

    if (!isNaN(position)) {
      // Invert position: low position (near lower band) = high score (bullish)
      score = Math.round(100 - position);
    }

    switch (bbData.signal) {
      case 'oversold': score = Math.max(score, 85); break;
      case 'bullish': score = Math.max(score, 65); break;
      case 'overbought': score = Math.min(score, 15); break;
      case 'bearish': score = Math.min(score, 35); break;
    }

    score = Math.round(Math.max(0, Math.min(100, score)));

    const signal = score >= 65 ? 'bullish' : score <= 35 ? 'bearish' : 'neutral';
    const posDesc = !isNaN(position)
      ? `Price at ${position}% of band (0%=lower, 100%=upper)`
      : 'Position unknown';

    return { score, signal, detail: posDesc };
  }

  /**
   * Score Volume (0-100)
   * High volume on up moves = bullish confirmation
   * High volume on down moves = bearish
   * Low volume = lack of conviction
   */
  function scoreVolume(volData) {
    if (!volData) return { score: 50, signal: 'unknown', detail: 'No volume data' };

    let score = 50;

    switch (volData.signal) {
      case 'bullish':
        score = 80;
        break;
      case 'bearish':
        score = 20;
        break;
      case 'low':
        score = 40; // Slightly bearish — low conviction
        break;
      case 'normal':
        score = volData.isUpCandle ? 55 : 45;
        break;
    }

    score = Math.round(Math.max(0, Math.min(100, score)));

    const signal = score >= 65 ? 'bullish' : score <= 35 ? 'bearish' : 'neutral';
    const ratioStr = (volData.volumeRatio && isFinite(volData.volumeRatio)) ? volData.volumeRatio.toFixed(2) : '1.00';
    const detail = `Volume ${ratioStr}x avg — ${volData.signal}`;

    return { score, signal, detail };
  }

  // ─── AGGREGATE SCORE ──────────────────────────────────────────────

  /**
   * Calculate the overall Investment Score
   * @param {object} indicators - Output from Indicators.computeAll()
   * @returns {object} Aggregated score with breakdown
   */
  function calculate(indicators) {
    if (indicators.error) {
      return {
        total: null,
        label: 'Unknown',
        signal: 'unknown',
        breakdown: {},
        error: indicators.error
      };
    }

    const rsiScore = scoreRSI(indicators.rsi.value);
    const macdScore = scoreMACD(indicators.macd);
    const maScore = scoreMovingAverages(indicators.movingAverages);
    const bbScore = scoreBollingerBands(indicators.bollingerBands);
    const volScore = scoreVolume(indicators.volume);

    const breakdown = {
      rsi: rsiScore,
      macd: macdScore,
      movingAverages: maScore,
      bollingerBands: bbScore,
      volume: volScore
    };

    // Weighted average
    const totalScore = Math.round(
      rsiScore.score * WEIGHTS.rsi +
      macdScore.score * WEIGHTS.macd +
      maScore.score * WEIGHTS.movingAverages +
      bbScore.score * WEIGHTS.bollingerBands +
      volScore.score * WEIGHTS.volume
    );

    // Determine label and signal
    let label, signal;
    if (totalScore >= 80) { label = 'Strong Buy'; signal = 'strong-buy'; }
    else if (totalScore >= 60) { label = 'Buy'; signal = 'buy'; }
    else if (totalScore >= 40) { label = 'Hold'; signal = 'hold'; }
    else if (totalScore >= 20) { label = 'Sell'; signal = 'sell'; }
    else { label = 'Strong Sell'; signal = 'strong-sell'; }

    return {
      total: totalScore,
      label,
      signal,
      breakdown,
      weights: WEIGHTS,
      timestamp: Date.now()
    };
  }

  /**
   * Get color for a given score value
   * @param {number} score
   * @returns {string} CSS color
   */
  function getScoreColor(score) {
    if (score === null) return '#8b949e';
    if (score >= 80) return '#00e676';
    if (score >= 60) return '#66bb6a';
    if (score >= 40) return '#ffc107';
    if (score >= 20) return '#ff9800';
    return '#f44336';
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────

  return {
    calculate,
    getScoreColor,
    scoreRSI,
    scoreMACD,
    scoreMovingAverages,
    scoreBollingerBands,
    scoreVolume,
    WEIGHTS
  };

})();
