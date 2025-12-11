/**
 * Candle pattern detection (engulfing, pin bars, etc.)
 */

/**
 * Detect bullish engulfing pattern
 * @param {Array<Object>} candles - Array of OHLC candles (at least last 2)
 * @returns {Object} {detected: boolean, description: string}
 */
export function detectBullishEngulfing(candles) {
  if (!candles || candles.length < 2) {
    return { detected: false, description: '' };
  }

  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];

  // Previous candle must be bearish (close < open)
  const prevBearish = prev.close < prev.open;

  // Current candle must be bullish (close > open)
  const currentBullish = current.close > current.open;

  // Current body must fully engulf previous body
  const currentBody = Math.abs(current.close - current.open);
  const prevBody = Math.abs(prev.close - prev.open);

  const engulfs = current.open <= prev.close && current.close >= prev.open;

  const detected = prevBearish && currentBullish && engulfs && currentBody > prevBody;

  return {
    detected,
    description: detected
      ? 'Bullish engulfing: Current green candle fully engulfs previous red candle body'
      : '',
  };
}

/**
 * Detect bearish engulfing pattern
 * @param {Array<Object>} candles - Array of OHLC candles (at least last 2)
 * @returns {Object} {detected: boolean, description: string}
 */
export function detectBearishEngulfing(candles) {
  if (!candles || candles.length < 2) {
    return { detected: false, description: '' };
  }

  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];

  // Previous candle must be bullish (close > open)
  const prevBullish = prev.close > prev.open;

  // Current candle must be bearish (close < open)
  const currentBearish = current.close < current.open;

  // Current body must fully engulf previous body
  const currentBody = Math.abs(current.close - current.open);
  const prevBody = Math.abs(prev.close - prev.open);

  const engulfs = current.open >= prev.close && current.close <= prev.open;

  const detected = prevBullish && currentBearish && engulfs && currentBody > prevBody;

  return {
    detected,
    description: detected
      ? 'Bearish engulfing: Current red candle fully engulfs previous green candle body'
      : '',
  };
}

/**
 * Detect bullish pin bar (hammer/long lower wick)
 * @param {Object} candle - Single OHLC candle
 * @returns {Object} {detected: boolean, description: string}
 */
export function detectBullishPinBar(candle) {
  if (!candle) {
    return { detected: false, description: '' };
  }

  const body = Math.abs(candle.close - candle.open);
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const totalRange = candle.high - candle.low;

  // Requirements for bullish pin bar:
  // 1. Lower wick should be at least 2x the body
  // 2. Upper wick should be small (less than half the body)
  // 3. Body should be small relative to total range (< 30%)
  // 4. Lower wick should be significant portion of total range (> 50%)

  const longLowerWick = lowerWick >= body * 2;
  const smallUpperWick = upperWick <= body * 0.5;
  const smallBody = body < totalRange * 0.3;
  const significantLowerWick = lowerWick > totalRange * 0.5;

  const detected = longLowerWick && smallUpperWick && smallBody && significantLowerWick && totalRange > 0;

  return {
    detected,
    description: detected
      ? 'Bullish pin bar: Long lower wick with small body at top, signals rejection of lower prices'
      : '',
  };
}

/**
 * Detect bearish pin bar (shooting star/long upper wick)
 * @param {Object} candle - Single OHLC candle
 * @returns {Object} {detected: boolean, description: string}
 */
export function detectBearishPinBar(candle) {
  if (!candle) {
    return { detected: false, description: '' };
  }

  const body = Math.abs(candle.close - candle.open);
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const totalRange = candle.high - candle.low;

  // Requirements for bearish pin bar:
  // 1. Upper wick should be at least 2x the body
  // 2. Lower wick should be small (less than half the body)
  // 3. Body should be small relative to total range (< 30%)
  // 4. Upper wick should be significant portion of total range (> 50%)

  const longUpperWick = upperWick >= body * 2;
  const smallLowerWick = lowerWick <= body * 0.5;
  const smallBody = body < totalRange * 0.3;
  const significantUpperWick = upperWick > totalRange * 0.5;

  const detected = longUpperWick && smallLowerWick && smallBody && significantUpperWick && totalRange > 0;

  return {
    detected,
    description: detected
      ? 'Bearish pin bar: Long upper wick with small body at bottom, signals rejection of higher prices'
      : '',
  };
}

/**
 * Detect inside bar pattern (current bar's range is inside previous bar's range)
 * @param {Array<Object>} candles - Array of OHLC candles (at least last 2)
 * @returns {Object} {detected: boolean, description: string}
 */
export function detectInsideBar(candles) {
  if (!candles || candles.length < 2) {
    return { detected: false, description: '' };
  }

  const prev = candles[candles.length - 2];
  const current = candles[candles.length - 1];

  const detected = current.high <= prev.high && current.low >= prev.low;

  return {
    detected,
    description: detected
      ? 'Inside bar: Current candle range is completely inside previous candle range, signals consolidation'
      : '',
  };
}

/**
 * Analyze all patterns for the candle array
 * @param {Array<Object>} candles - Array of OHLC candles
 * @returns {Object} Object with all pattern detection results
 */
export function analyzePatterns(candles) {
  if (!candles || candles.length < 2) {
    return {
      bullishEngulfing: { detected: false, description: '' },
      bearishEngulfing: { detected: false, description: '' },
      bullishPin: { detected: false, description: '' },
      bearishPin: { detected: false, description: '' },
      insideBar: { detected: false, description: '' },
    };
  }

  const lastCandle = candles[candles.length - 1];

  return {
    bullishEngulfing: detectBullishEngulfing(candles),
    bearishEngulfing: detectBearishEngulfing(candles),
    bullishPin: detectBullishPinBar(lastCandle),
    bearishPin: detectBearishPinBar(lastCandle),
    insideBar: detectInsideBar(candles),
  };
}

export default {
  detectBullishEngulfing,
  detectBearishEngulfing,
  detectBullishPinBar,
  detectBearishPinBar,
  detectInsideBar,
  analyzePatterns,
};
