/**
 * Pre-filter logic to identify interesting trading candidates
 */

import { logger } from '../utils/logger.js';

/**
 * Apply pre-filters to determine if chart is interesting for analysis
 * @param {Array<Object>} candles - Array of OHLC candles
 * @param {Object} indicators - Computed indicators from computeAllIndicators()
 * @param {string} mode - Trading mode ('conservative' or 'aggressive')
 * @returns {Object} {isCandidate: boolean, reason: string}
 */
export function applyPrefilters(candles, indicators, mode) {
  const reasons = [];

  // Check minimum data requirements
  if (!candles || candles.length < 50) {
    return {
      isCandidate: false,
      reason: 'Insufficient candle data',
    };
  }

  if (!indicators || !indicators.atr14 || !indicators.ema50 || !indicators.ema200) {
    return {
      isCandidate: false,
      reason: 'Missing required indicators',
    };
  }

  // Rejection criteria: ATR too small
  const minAtr = getMinimumATR(indicators.currentPrice);
  if (indicators.atr14 < minAtr) {
    return {
      isCandidate: false,
      reason: `ATR too small (${indicators.atr14.toFixed(5)} < ${minAtr.toFixed(5)}), insufficient volatility`,
    };
  }

  // Rejection criteria: choppy market
  if (indicators.trend.direction === 'choppy') {
    return {
      isCandidate: false,
      reason: 'Choppy market with flat EMAs, no clear trend',
    };
  }

  // Get last few candles for pattern analysis
  const lastCandle = candles[candles.length - 1];

  // Pre-filter 1: Trend-aligned engulfing pattern
  if (checkTrendAlignedEngulfing(indicators)) {
    reasons.push(checkTrendAlignedEngulfing(indicators));
  }

  // Pre-filter 2: Pin bar at structure
  if (checkPinBarAtStructure(indicators, lastCandle)) {
    reasons.push(checkPinBarAtStructure(indicators, lastCandle));
  }

  // Pre-filter 3: Pullback into trend
  if (checkPullbackIntoTrend(candles, indicators)) {
    reasons.push(checkPullbackIntoTrend(candles, indicators));
  }

  // Pre-filter 4: RSI divergence (optional, aggressive mode)
  if (mode === 'aggressive' && checkRSIDivergence(candles, indicators)) {
    reasons.push(checkRSIDivergence(candles, indicators));
  }

  // Pre-filter 5: Strong reversal at key S/R
  if (checkReversalAtSR(indicators)) {
    reasons.push(checkReversalAtSR(indicators));
  }

  // If no reasons found, not a candidate
  if (reasons.length === 0) {
    return {
      isCandidate: false,
      reason: '',
    };
  }

  // Combine all reasons
  const combinedReason = reasons.filter(Boolean).join(' + ');

  logger.debug('PreFilter', `Candidate found: ${combinedReason}`, {
    symbol: indicators.symbol || 'unknown',
    reasons: reasons.length,
  });

  return {
    isCandidate: true,
    reason: combinedReason,
  };
}

/**
 * Get minimum ATR threshold based on price level
 * @param {number} price - Current price
 * @returns {number} Minimum ATR threshold
 */
function getMinimumATR(price) {
  // For forex pairs (price around 1.0-2.0), min ATR ~0.0001
  if (price < 10) {
    return 0.0001;
  }
  // For higher priced assets, scale proportionally
  return price * 0.0001;
}

/**
 * Check for trend-aligned engulfing pattern
 * @param {Object} indicators - Indicators object
 * @returns {string|null} Reason if pattern found, null otherwise
 */
function checkTrendAlignedEngulfing(indicators) {
  const { patterns, trend, currentPrice, ema50 } = indicators;

  // Bullish engulfing in uptrend
  if (
    patterns.bullishEngulfing.detected &&
    trend.direction === 'uptrend' &&
    currentPrice > ema50
  ) {
    return 'Bullish engulfing in uptrend';
  }

  // Bearish engulfing in downtrend
  if (
    patterns.bearishEngulfing.detected &&
    trend.direction === 'downtrend' &&
    currentPrice < ema50
  ) {
    return 'Bearish engulfing in downtrend';
  }

  return null;
}

/**
 * Check for pin bar at structure (S/R level)
 * @param {Object} indicators - Indicators object
 * @param {Object} lastCandle - Last candle
 * @returns {string|null} Reason if pattern found, null otherwise
 */
function checkPinBarAtStructure(indicators, lastCandle) {
  const { patterns, swings, currentPrice } = indicators;

  // Check if near S/R level
  if (!swings.nearSR) {
    return null;
  }

  // Bullish pin at support
  if (patterns.bullishPin.detected && swings.nearSR.type === 'support') {
    return `Bullish pin bar at support level (${swings.nearSR.price.toFixed(5)})`;
  }

  // Bearish pin at resistance
  if (patterns.bearishPin.detected && swings.nearSR.type === 'resistance') {
    return `Bearish pin bar at resistance level (${swings.nearSR.price.toFixed(5)})`;
  }

  return null;
}

/**
 * Check for pullback into trend
 * @param {Array<Object>} candles - Candles array
 * @param {Object} indicators - Indicators object
 * @returns {string|null} Reason if pattern found, null otherwise
 */
function checkPullbackIntoTrend(candles, indicators) {
  const { trend, currentPrice, ema50, swings } = indicators;

  if (trend.direction !== 'uptrend' && trend.direction !== 'downtrend') {
    return null;
  }

  // Look at last 5-10 candles to see if there was a pullback
  const recentCandles = candles.slice(-10);
  const closes = recentCandles.map(c => c.close);

  // Uptrend: price pulled back to EMA50 or recent swing low, then bounced
  if (trend.direction === 'uptrend') {
    const minRecent = Math.min(...closes);
    const priceBounced = currentPrice > minRecent && closes[closes.length - 2] < currentPrice;

    // Check if pullback touched EMA50
    const touchedEMA50 = Math.abs(minRecent - ema50) / ema50 < 0.005; // Within 0.5%

    // Check if pullback touched recent swing low
    const nearSwingLow = swings.swingLows.length > 0 &&
      Math.abs(minRecent - swings.swingLows[swings.swingLows.length - 1].price) / minRecent < 0.01;

    if (priceBounced && (touchedEMA50 || nearSwingLow)) {
      return 'Pullback to support in uptrend, bouncing';
    }
  }

  // Downtrend: price pulled back to EMA50 or recent swing high, then rejected
  if (trend.direction === 'downtrend') {
    const maxRecent = Math.max(...closes);
    const priceRejected = currentPrice < maxRecent && closes[closes.length - 2] > currentPrice;

    // Check if pullback touched EMA50
    const touchedEMA50 = Math.abs(maxRecent - ema50) / ema50 < 0.005; // Within 0.5%

    // Check if pullback touched recent swing high
    const nearSwingHigh = swings.swingHighs.length > 0 &&
      Math.abs(maxRecent - swings.swingHighs[swings.swingHighs.length - 1].price) / maxRecent < 0.01;

    if (priceRejected && (touchedEMA50 || nearSwingHigh)) {
      return 'Pullback to resistance in downtrend, rejecting';
    }
  }

  return null;
}

/**
 * Check for RSI divergence (aggressive mode only)
 * @param {Array<Object>} candles - Candles array
 * @param {Object} indicators - Indicators object
 * @returns {string|null} Reason if divergence found, null otherwise
 */
function checkRSIDivergence(candles, indicators) {
  const { rsi14, swings } = indicators;

  // Need at least 2 swing points to check divergence
  if (swings.swingHighs.length < 2 || swings.swingLows.length < 2) {
    return null;
  }

  // This is a simplified check - full RSI divergence would require tracking RSI at each swing
  // For now, we'll check if RSI is in oversold/overbought territory
  if (rsi14 < 30 && swings.swingLows.length >= 2) {
    return 'RSI oversold with potential bullish divergence';
  }

  if (rsi14 > 70 && swings.swingHighs.length >= 2) {
    return 'RSI overbought with potential bearish divergence';
  }

  return null;
}

/**
 * Check for strong reversal pattern at key S/R
 * @param {Object} indicators - Indicators object
 * @returns {string|null} Reason if pattern found, null otherwise
 */
function checkReversalAtSR(indicators) {
  const { patterns, swings } = indicators;

  // Must be near a significant S/R level
  if (!swings.nearSR || swings.nearSR.touches < 2) {
    return null;
  }

  // Check for multiple bullish patterns at support
  if (swings.nearSR.type === 'support') {
    const bullishSignals = [
      patterns.bullishEngulfing.detected,
      patterns.bullishPin.detected,
    ].filter(Boolean).length;

    if (bullishSignals >= 1) {
      return `Reversal setup at strong support (${swings.nearSR.touches} touches)`;
    }
  }

  // Check for multiple bearish patterns at resistance
  if (swings.nearSR.type === 'resistance') {
    const bearishSignals = [
      patterns.bearishEngulfing.detected,
      patterns.bearishPin.detected,
    ].filter(Boolean).length;

    if (bearishSignals >= 1) {
      return `Reversal setup at strong resistance (${swings.nearSR.touches} touches)`;
    }
  }

  return null;
}

export default { applyPrefilters };
