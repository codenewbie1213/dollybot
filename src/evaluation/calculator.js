/**
 * R-multiple and outcome calculations
 */

import { logger } from '../utils/logger.js';

/**
 * Calculate R-multiple for a trade
 * @param {Object} signal - Signal object
 * @param {number} hitPrice - Price where TP/SL was hit
 * @param {string} hitType - Type of hit ('tp1', 'tp2', 'tp3', 'sl', 'timeout')
 * @returns {number} R-multiple (positive for wins, negative for losses, 0 for timeout)
 */
export function calculateRMultiple(signal, hitPrice, hitType) {
  const { entry, stop_loss, direction } = signal;

  // Calculate 1R (risk amount)
  const R = Math.abs(entry - stop_loss);

  if (R === 0) {
    logger.warn('Calculator', `Invalid R value (0) for signal ID ${signal.id}`);
    return 0;
  }

  // Stop loss hit
  if (hitType === 'sl') {
    return -1;
  }

  // Timeout (no TP or SL hit)
  if (hitType === 'timeout') {
    return 0;
  }

  // Take profit hit
  if (hitType.startsWith('tp')) {
    if (direction === 'long') {
      const profit = hitPrice - entry;
      return profit / R;
    } else if (direction === 'short') {
      const profit = entry - hitPrice;
      return profit / R;
    }
  }

  logger.warn('Calculator', `Unknown hit type: ${hitType} for signal ID ${signal.id}`);
  return 0;
}

/**
 * Determine outcome based on hit type and R-multiple
 * @param {string} hitType - Type of hit
 * @param {number} rMultiple - R-multiple value
 * @returns {string} Outcome ('win', 'loss', 'timeout', 'breakeven')
 */
export function determineOutcome(hitType, rMultiple) {
  if (hitType === 'timeout') {
    return 'timeout';
  }

  if (hitType === 'sl') {
    return 'loss';
  }

  if (hitType.startsWith('tp')) {
    if (rMultiple > 0) {
      return 'win';
    } else if (rMultiple === 0) {
      return 'breakeven';
    } else {
      return 'loss';
    }
  }

  return 'timeout';
}

/**
 * Create outcome detail object
 * @param {string} hitType - Type of hit
 * @param {number} rMultiple - R-multiple
 * @param {number} hitPrice - Price where hit occurred
 * @param {string} hitTime - Timestamp of hit
 * @returns {Object} Outcome detail object
 */
export function createOutcomeDetail(hitType, rMultiple, hitPrice, hitTime) {
  return {
    hit: hitType,
    rr: Math.round(rMultiple * 100) / 100, // Round to 2 decimals
    hitPrice: hitPrice,
    hitTime: hitTime,
  };
}

export default {
  calculateRMultiple,
  determineOutcome,
  createOutcomeDetail,
};
