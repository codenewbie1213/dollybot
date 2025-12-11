/**
 * Exponential Moving Average (EMA) calculation
 */

/**
 * Calculate Exponential Moving Average
 * @param {Array<number>} prices - Array of prices (close prices)
 * @param {number} period - EMA period (e.g., 50, 200)
 * @returns {Array<number>} Array of EMA values (same length as input, with NaN for insufficient data)
 */
export function calculateEMA(prices, period) {
  if (!prices || prices.length === 0) {
    return [];
  }

  if (period <= 0 || period > prices.length) {
    return new Array(prices.length).fill(NaN);
  }

  const ema = new Array(prices.length);
  const multiplier = 2 / (period + 1);

  // Calculate initial SMA for first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    ema[i] = NaN;
    sum += prices[i];
  }

  // First EMA value is the SMA
  ema[period - 1] = sum / period;

  // Calculate subsequent EMA values
  for (let i = period; i < prices.length; i++) {
    ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
  }

  return ema;
}

/**
 * Get the latest EMA value from price array
 * @param {Array<number>} prices - Array of prices
 * @param {number} period - EMA period
 * @returns {number|null} Latest EMA value or null if insufficient data
 */
export function getLatestEMA(prices, period) {
  const emaValues = calculateEMA(prices, period);

  if (emaValues.length === 0) {
    return null;
  }

  const latest = emaValues[emaValues.length - 1];
  return isNaN(latest) ? null : latest;
}

export default { calculateEMA, getLatestEMA };
