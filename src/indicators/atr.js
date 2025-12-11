/**
 * Average True Range (ATR) calculation
 */

import { calculateEMA } from './ema.js';

/**
 * Calculate True Range for a single candle
 * @param {Object} candle - Current candle {high, low, close}
 * @param {number} prevClose - Previous candle close price
 * @returns {number} True Range value
 */
function calculateTR(candle, prevClose) {
  const highLow = candle.high - candle.low;
  const highClose = Math.abs(candle.high - prevClose);
  const lowClose = Math.abs(candle.low - prevClose);

  return Math.max(highLow, highClose, lowClose);
}

/**
 * Calculate Average True Range
 * @param {Array<Object>} candles - Array of OHLC candles {open, high, low, close}
 * @param {number} period - ATR period (default: 14)
 * @returns {Array<number>} Array of ATR values (same length as input, with NaN for insufficient data)
 */
export function calculateATR(candles, period = 14) {
  if (!candles || candles.length < 2) {
    return candles ? new Array(candles.length).fill(NaN) : [];
  }

  if (period <= 0 || period > candles.length) {
    return new Array(candles.length).fill(NaN);
  }

  // Calculate True Range for each candle
  const trValues = [NaN]; // First candle has no previous close

  for (let i = 1; i < candles.length; i++) {
    trValues.push(calculateTR(candles[i], candles[i - 1].close));
  }

  // Calculate ATR as EMA of True Range
  // Note: We offset by 1 since first TR is NaN
  const atrValues = calculateEMA(trValues.slice(1), period);

  // Add back the first NaN
  return [NaN, ...atrValues];
}

/**
 * Get the latest ATR value from candles
 * @param {Array<Object>} candles - Array of OHLC candles
 * @param {number} period - ATR period (default: 14)
 * @returns {number|null} Latest ATR value or null if insufficient data
 */
export function getLatestATR(candles, period = 14) {
  const atrValues = calculateATR(candles, period);

  if (atrValues.length === 0) {
    return null;
  }

  const latest = atrValues[atrValues.length - 1];
  return isNaN(latest) ? null : latest;
}

export default { calculateATR, getLatestATR };
