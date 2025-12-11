/**
 * Main indicators module - exports all indicators and provides convenience functions
 */

import { calculateEMA, getLatestEMA } from './ema.js';
import { calculateATR, getLatestATR } from './atr.js';
import { calculateRSI, getLatestRSI, isOversold, isOverbought } from './rsi.js';
import {
  findSwingHighs,
  findSwingLows,
  identifySRLevels,
  isNearSRLevel,
} from './swings.js';
import {
  detectBullishEngulfing,
  detectBearishEngulfing,
  detectBullishPinBar,
  detectBearishPinBar,
  detectInsideBar,
  analyzePatterns,
} from './patterns.js';

/**
 * Compute all technical indicators for candle data
 * @param {Array<Object>} candles - Array of OHLC candles {time, open, high, low, close, volume}
 * @returns {Object} Object containing all indicator values
 */
export function computeAllIndicators(candles) {
  if (!candles || candles.length < 50) {
    throw new Error(`Insufficient candle data: need at least 50 candles, got ${candles?.length || 0}`);
  }

  // Extract close prices for indicators
  const closes = candles.map(c => c.close);

  // Calculate EMAs
  const ema50 = getLatestEMA(closes, 50);
  const ema200 = getLatestEMA(closes, 200);

  // Calculate ATR
  const atr14 = getLatestATR(candles, 14);

  // Calculate RSI
  const rsi14 = getLatestRSI(closes, 14);

  // Find swing points
  const swingHighs = findSwingHighs(candles, 3, 3);
  const swingLows = findSwingLows(candles, 3, 3);

  // Identify S/R levels (only if we have ATR)
  const srLevels = atr14 ? identifySRLevels(swingHighs, swingLows, atr14, 0.5) : [];

  // Analyze candle patterns
  const patterns = analyzePatterns(candles);

  // Get current price
  const currentPrice = candles[candles.length - 1].close;

  // Check if near S/R level
  const nearSR = atr14 ? isNearSRLevel(currentPrice, srLevels, atr14, 0.3) : null;

  // Determine trend
  const trend = determineTrend(currentPrice, ema50, ema200, candles);

  return {
    // Moving averages
    ema50,
    ema200,

    // Volatility
    atr14,

    // Momentum
    rsi14,
    rsiOversold: rsi14 ? isOversold(rsi14) : false,
    rsiOverbought: rsi14 ? isOverbought(rsi14) : false,

    // Structure
    swings: {
      swingHighs,
      swingLows,
      srLevels,
      nearSR,
    },

    // Patterns
    patterns,

    // Trend analysis
    trend,

    // Current price
    currentPrice,
  };
}

/**
 * Determine market trend based on EMAs and price action
 * @param {number} price - Current price
 * @param {number} ema50 - EMA 50 value
 * @param {number} ema200 - EMA 200 value
 * @param {Array<Object>} candles - Recent candles for swing structure
 * @returns {Object} Trend analysis
 */
function determineTrend(price, ema50, ema200, candles) {
  if (!ema50 || !ema200) {
    return {
      direction: 'unclear',
      strength: 'weak',
      description: 'Insufficient data for trend determination',
    };
  }

  // Check EMA alignment
  const priceAboveEma50 = price > ema50;
  const ema50AboveEma200 = ema50 > ema200;

  // Check swing structure (last 20 candles)
  const recentCandles = candles.slice(-20);
  const recentHighs = findSwingHighs(recentCandles, 2, 2);
  const recentLows = findSwingLows(recentCandles, 2, 2);

  // Analyze swing structure
  const hasHigherHighs = recentHighs.length >= 2 &&
    recentHighs[recentHighs.length - 1].price > recentHighs[0].price;

  const hasHigherLows = recentLows.length >= 2 &&
    recentLows[recentLows.length - 1].price > recentLows[0].price;

  const hasLowerHighs = recentHighs.length >= 2 &&
    recentHighs[recentHighs.length - 1].price < recentHighs[0].price;

  const hasLowerLows = recentLows.length >= 2 &&
    recentLows[recentLows.length - 1].price < recentLows[0].price;

  // Determine trend
  let direction = 'unclear';
  let strength = 'weak';
  let description = '';

  if (priceAboveEma50 && ema50AboveEma200) {
    if (hasHigherHighs && hasHigherLows) {
      direction = 'uptrend';
      strength = 'strong';
      description = 'Strong uptrend: Price > EMA50 > EMA200 with HH/HL structure';
    } else if (hasHigherHighs || hasHigherLows) {
      direction = 'uptrend';
      strength = 'moderate';
      description = 'Moderate uptrend: Price > EMA50 > EMA200, partial HH/HL structure';
    } else {
      direction = 'uptrend';
      strength = 'weak';
      description = 'Weak uptrend: Price > EMA50 > EMA200 but unclear swing structure';
    }
  } else if (!priceAboveEma50 && !ema50AboveEma200) {
    if (hasLowerHighs && hasLowerLows) {
      direction = 'downtrend';
      strength = 'strong';
      description = 'Strong downtrend: Price < EMA50 < EMA200 with LH/LL structure';
    } else if (hasLowerHighs || hasLowerLows) {
      direction = 'downtrend';
      strength = 'moderate';
      description = 'Moderate downtrend: Price < EMA50 < EMA200, partial LH/LL structure';
    } else {
      direction = 'downtrend';
      strength = 'weak';
      description = 'Weak downtrend: Price < EMA50 < EMA200 but unclear swing structure';
    }
  } else {
    // Mixed signals or choppy
    const emaDistance = Math.abs(ema50 - ema200);
    const avgPrice = (ema50 + ema200) / 2;
    const emaSpread = (emaDistance / avgPrice) * 100;

    if (emaSpread < 0.5) {
      direction = 'choppy';
      strength = 'weak';
      description = 'Choppy: EMAs are flat and close together, no clear trend';
    } else {
      direction = 'transition';
      strength = 'weak';
      description = 'Transitional: Mixed EMA signals, possible trend change';
    }
  }

  return {
    direction,
    strength,
    description,
    emaAlignment: {
      priceAboveEma50,
      ema50AboveEma200,
    },
    swingStructure: {
      hasHigherHighs,
      hasHigherLows,
      hasLowerHighs,
      hasLowerLows,
    },
  };
}

// Export all indicator functions
export {
  // EMA
  calculateEMA,
  getLatestEMA,

  // ATR
  calculateATR,
  getLatestATR,

  // RSI
  calculateRSI,
  getLatestRSI,
  isOversold,
  isOverbought,

  // Swings
  findSwingHighs,
  findSwingLows,
  identifySRLevels,
  isNearSRLevel,

  // Patterns
  detectBullishEngulfing,
  detectBearishEngulfing,
  detectBullishPinBar,
  detectBearishPinBar,
  detectInsideBar,
  analyzePatterns,
};

export default {
  computeAllIndicators,
  calculateEMA,
  getLatestEMA,
  calculateATR,
  getLatestATR,
  calculateRSI,
  getLatestRSI,
  isOversold,
  isOverbought,
  findSwingHighs,
  findSwingLows,
  identifySRLevels,
  isNearSRLevel,
  detectBullishEngulfing,
  detectBearishEngulfing,
  detectBullishPinBar,
  detectBearishPinBar,
  detectInsideBar,
  analyzePatterns,
};
