/**
 * Swing highs/lows detection and support/resistance levels
 */

/**
 * Find swing highs in candle data
 * @param {Array<Object>} candles - Array of OHLC candles
 * @param {number} leftBars - Number of bars to the left that must be lower
 * @param {number} rightBars - Number of bars to the right that must be lower
 * @returns {Array<Object>} Array of swing highs {price, time, index}
 */
export function findSwingHighs(candles, leftBars = 3, rightBars = 3) {
  if (!candles || candles.length < leftBars + rightBars + 1) {
    return [];
  }

  const swingHighs = [];

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const currentHigh = candles[i].high;
    let isSwingHigh = true;

    // Check left bars
    for (let j = i - leftBars; j < i; j++) {
      if (candles[j].high >= currentHigh) {
        isSwingHigh = false;
        break;
      }
    }

    if (!isSwingHigh) continue;

    // Check right bars
    for (let j = i + 1; j <= i + rightBars; j++) {
      if (candles[j].high >= currentHigh) {
        isSwingHigh = false;
        break;
      }
    }

    if (isSwingHigh) {
      swingHighs.push({
        price: currentHigh,
        time: candles[i].time,
        index: i,
      });
    }
  }

  return swingHighs;
}

/**
 * Find swing lows in candle data
 * @param {Array<Object>} candles - Array of OHLC candles
 * @param {number} leftBars - Number of bars to the left that must be higher
 * @param {number} rightBars - Number of bars to the right that must be higher
 * @returns {Array<Object>} Array of swing lows {price, time, index}
 */
export function findSwingLows(candles, leftBars = 3, rightBars = 3) {
  if (!candles || candles.length < leftBars + rightBars + 1) {
    return [];
  }

  const swingLows = [];

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    const currentLow = candles[i].low;
    let isSwingLow = true;

    // Check left bars
    for (let j = i - leftBars; j < i; j++) {
      if (candles[j].low <= currentLow) {
        isSwingLow = false;
        break;
      }
    }

    if (!isSwingLow) continue;

    // Check right bars
    for (let j = i + 1; j <= i + rightBars; j++) {
      if (candles[j].low <= currentLow) {
        isSwingLow = false;
        break;
      }
    }

    if (isSwingLow) {
      swingLows.push({
        price: currentLow,
        time: candles[i].time,
        index: i,
      });
    }
  }

  return swingLows;
}

/**
 * Cluster nearby swing points into support/resistance levels
 * @param {Array<Object>} swingHighs - Array of swing highs
 * @param {Array<Object>} swingLows - Array of swing lows
 * @param {number} atrValue - ATR value for clustering threshold
 * @param {number} threshold - Clustering threshold as multiple of ATR (default: 0.5)
 * @returns {Array<Object>} Array of S/R levels {price, type: 'resistance'|'support', touches}
 */
export function identifySRLevels(swingHighs, swingLows, atrValue, threshold = 0.5) {
  if (!atrValue || atrValue <= 0) {
    return [];
  }

  const clusterThreshold = atrValue * threshold;
  const srLevels = [];

  // Cluster swing highs into resistance levels
  const resistanceClusters = clusterSwings(swingHighs, clusterThreshold);
  resistanceClusters.forEach(cluster => {
    srLevels.push({
      price: cluster.avgPrice,
      type: 'resistance',
      touches: cluster.touches,
    });
  });

  // Cluster swing lows into support levels
  const supportClusters = clusterSwings(swingLows, clusterThreshold);
  supportClusters.forEach(cluster => {
    srLevels.push({
      price: cluster.avgPrice,
      type: 'support',
      touches: cluster.touches,
    });
  });

  // Sort by price descending
  srLevels.sort((a, b) => b.price - a.price);

  return srLevels;
}

/**
 * Cluster swing points that are close together
 * @param {Array<Object>} swings - Array of swing points
 * @param {number} threshold - Clustering threshold
 * @returns {Array<Object>} Array of clusters {avgPrice, touches}
 */
function clusterSwings(swings, threshold) {
  if (swings.length === 0) return [];

  // Sort by price
  const sorted = [...swings].sort((a, b) => a.price - b.price);

  const clusters = [];
  let currentCluster = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const priceDiff = Math.abs(sorted[i].price - currentCluster[0].price);

    if (priceDiff <= threshold) {
      // Add to current cluster
      currentCluster.push(sorted[i]);
    } else {
      // Start new cluster
      if (currentCluster.length > 0) {
        const avgPrice = currentCluster.reduce((sum, s) => sum + s.price, 0) / currentCluster.length;
        clusters.push({
          avgPrice,
          touches: currentCluster.length,
        });
      }
      currentCluster = [sorted[i]];
    }
  }

  // Add last cluster
  if (currentCluster.length > 0) {
    const avgPrice = currentCluster.reduce((sum, s) => sum + s.price, 0) / currentCluster.length;
    clusters.push({
      avgPrice,
      touches: currentCluster.length,
    });
  }

  return clusters;
}

/**
 * Check if price is near a support/resistance level
 * @param {number} price - Current price
 * @param {Array<Object>} srLevels - Array of S/R levels
 * @param {number} atrValue - ATR value
 * @param {number} threshold - Proximity threshold as multiple of ATR (default: 0.3)
 * @returns {Object|null} Nearest S/R level if within threshold, null otherwise
 */
export function isNearSRLevel(price, srLevels, atrValue, threshold = 0.3) {
  if (!srLevels || srLevels.length === 0 || !atrValue) {
    return null;
  }

  const proximityThreshold = atrValue * threshold;

  // Find closest S/R level
  let closest = null;
  let minDistance = Infinity;

  for (const level of srLevels) {
    const distance = Math.abs(price - level.price);

    if (distance < minDistance) {
      minDistance = distance;
      closest = level;
    }
  }

  return minDistance <= proximityThreshold ? closest : null;
}

export default {
  findSwingHighs,
  findSwingLows,
  identifySRLevels,
  isNearSRLevel,
};
