/**
 * Relative Strength Index (RSI) calculation
 */

/**
 * Calculate Relative Strength Index
 * @param {Array<number>} prices - Array of prices (close prices)
 * @param {number} period - RSI period (default: 14)
 * @returns {Array<number>} Array of RSI values (0-100, with NaN for insufficient data)
 */
export function calculateRSI(prices, period = 14) {
  if (!prices || prices.length < period + 1) {
    return prices ? new Array(prices.length).fill(NaN) : [];
  }

  const rsiValues = new Array(prices.length).fill(NaN);

  // Calculate price changes
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  // Calculate initial average gain and loss
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }

  avgGain /= period;
  avgLoss /= period;

  // Calculate first RSI value
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsiValues[period] = 100 - (100 / (1 + rs));

  // Calculate subsequent RSI values using smoothed averages
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    // Smoothed moving averages
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues[i + 1] = 100 - (100 / (1 + rs));
  }

  return rsiValues;
}

/**
 * Get the latest RSI value from prices
 * @param {Array<number>} prices - Array of prices
 * @param {number} period - RSI period (default: 14)
 * @returns {number|null} Latest RSI value or null if insufficient data
 */
export function getLatestRSI(prices, period = 14) {
  const rsiValues = calculateRSI(prices, period);

  if (rsiValues.length === 0) {
    return null;
  }

  const latest = rsiValues[rsiValues.length - 1];
  return isNaN(latest) ? null : latest;
}

/**
 * Check if RSI is oversold
 * @param {number} rsi - RSI value
 * @param {number} threshold - Oversold threshold (default: 30)
 * @returns {boolean} True if oversold
 */
export function isOversold(rsi, threshold = 30) {
  return rsi < threshold;
}

/**
 * Check if RSI is overbought
 * @param {number} rsi - RSI value
 * @param {number} threshold - Overbought threshold (default: 70)
 * @returns {boolean} True if overbought
 */
export function isOverbought(rsi, threshold = 70) {
  return rsi > threshold;
}

export default { calculateRSI, getLatestRSI, isOversold, isOverbought };
