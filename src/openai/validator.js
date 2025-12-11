/**
 * Validator for OpenAI trade responses
 */

import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ValidationError } from '../utils/errors.js';

/**
 * Validate OpenAI trade response
 * @param {Object} response - Response from OpenAI
 * @param {string} symbol - Symbol for context
 * @param {string} mode - Trading mode for validation
 * @param {number} atrValue - ATR value for SL validation
 * @returns {Object} {valid: boolean, errors: string[]}
 */
export function validateTradeResponse(response, symbol, mode, atrValue) {
  const errors = [];

  // Check required fields
  const requiredFields = ['direction', 'entry', 'stop_loss', 'take_profits', 'confidence', 'reason', 'management_hint'];

  for (const field of requiredFields) {
    if (!(field in response)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate direction
  const validDirections = ['long', 'short', 'none'];
  if (!validDirections.includes(response.direction)) {
    errors.push(`Invalid direction: ${response.direction}. Must be one of: ${validDirections.join(', ')}`);
  }

  // If direction is "none", entry/SL/TPs should be null/empty
  if (response.direction === 'none') {
    if (response.entry !== null) {
      errors.push('For direction "none", entry must be null');
    }
    if (response.stop_loss !== null) {
      errors.push('For direction "none", stop_loss must be null');
    }
    if (response.take_profits.length > 0) {
      errors.push('For direction "none", take_profits must be empty array');
    }
    if (response.management_hint && response.management_hint.trim() !== '') {
      errors.push('For direction "none", management_hint should be empty');
    }

    // For "none" direction, confidence and reason are still required
    if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
      errors.push('Confidence must be a number between 0 and 1');
    }
    if (!response.reason || typeof response.reason !== 'string' || response.reason.trim() === '') {
      errors.push('Reason is required even for "none" direction');
    }

    return { valid: errors.length === 0, errors };
  }

  // For "long" or "short" direction, validate trade parameters
  if (response.direction === 'long' || response.direction === 'short') {
    // Entry must be a positive number
    if (typeof response.entry !== 'number' || response.entry <= 0) {
      errors.push('Entry must be a positive number');
    }

    // Stop loss must be a positive number
    if (typeof response.stop_loss !== 'number' || response.stop_loss <= 0) {
      errors.push('Stop loss must be a positive number');
    }

    // Validate entry/SL relationship
    if (response.direction === 'long' && response.entry <= response.stop_loss) {
      errors.push('For long trades, entry must be above stop_loss');
    }

    if (response.direction === 'short' && response.entry >= response.stop_loss) {
      errors.push('For short trades, entry must be below stop_loss');
    }

    // Validate take profits
    if (!Array.isArray(response.take_profits)) {
      errors.push('Take profits must be an array');
    } else {
      if (response.take_profits.length === 0) {
        errors.push('Take profits array must have at least one target');
      }

      if (response.take_profits.length > 3) {
        errors.push('Take profits array must have at most 3 targets');
      }

      // Check all TPs are positive numbers
      for (let i = 0; i < response.take_profits.length; i++) {
        const tp = response.take_profits[i];
        if (typeof tp !== 'number' || tp <= 0) {
          errors.push(`Take profit ${i + 1} must be a positive number`);
        }
      }

      // Check TP ordering
      if (response.direction === 'long') {
        // TPs should be ascending (higher than entry)
        for (const tp of response.take_profits) {
          if (tp <= response.entry) {
            errors.push('For long trades, all take profits must be above entry');
            break;
          }
        }

        // Check ascending order
        for (let i = 1; i < response.take_profits.length; i++) {
          if (response.take_profits[i] <= response.take_profits[i - 1]) {
            errors.push('For long trades, take profits must be in ascending order');
            break;
          }
        }
      }

      if (response.direction === 'short') {
        // TPs should be descending (lower than entry)
        for (const tp of response.take_profits) {
          if (tp >= response.entry) {
            errors.push('For short trades, all take profits must be below entry');
            break;
          }
        }

        // Check descending order
        for (let i = 1; i < response.take_profits.length; i++) {
          if (response.take_profits[i] >= response.take_profits[i - 1]) {
            errors.push('For short trades, take profits must be in descending order');
            break;
          }
        }
      }
    }

    // Validate ATR-based SL distance (if atrValue provided)
    if (atrValue && atrValue > 0) {
      const slDistance = Math.abs(response.entry - response.stop_loss);
      const atrMultiple = slDistance / atrValue;

      const modeConfig = config.trading[mode];
      const minATRMultiple = config.trading.minAtrMultiplier;
      const maxATRMultiple = config.trading.maxAtrMultiplier;

      if (atrMultiple < minATRMultiple) {
        errors.push(`SL distance too tight: ${atrMultiple.toFixed(2)} ATR < ${minATRMultiple} ATR minimum`);
      }

      if (atrMultiple > maxATRMultiple) {
        errors.push(`SL distance too wide: ${atrMultiple.toFixed(2)} ATR > ${maxATRMultiple} ATR maximum`);
      }

      // Mode-specific warnings (not errors, just log)
      if (mode === 'conservative') {
        if (atrMultiple < modeConfig.slAtrMin || atrMultiple > modeConfig.slAtrMax) {
          logger.warn('Validator', `Conservative mode: SL distance ${atrMultiple.toFixed(2)} ATR outside preferred range ${modeConfig.slAtrMin}-${modeConfig.slAtrMax} ATR`);
        }
      }

      if (mode === 'aggressive') {
        const maxExtended = modeConfig.slAtrMaxExtended || modeConfig.slAtrMax;
        if (atrMultiple < modeConfig.slAtrMin || atrMultiple > maxExtended) {
          logger.warn('Validator', `Aggressive mode: SL distance ${atrMultiple.toFixed(2)} ATR outside preferred range ${modeConfig.slAtrMin}-${maxExtended} ATR`);
        }
      }
    }

    // Validate confidence
    if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 1) {
      errors.push('Confidence must be a number between 0 and 1');
    }

    // Validate reason
    if (!response.reason || typeof response.reason !== 'string' || response.reason.trim() === '') {
      errors.push('Reason is required and must be a non-empty string');
    }

    // Validate management_hint
    if (typeof response.management_hint !== 'string') {
      errors.push('Management hint must be a string');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate and throw if invalid
 * @param {Object} response - Response to validate
 * @param {string} symbol - Symbol for context
 * @param {string} mode - Trading mode
 * @param {number} atrValue - ATR value
 * @throws {ValidationError} If validation fails
 */
export function validateAndThrow(response, symbol, mode, atrValue) {
  const result = validateTradeResponse(response, symbol, mode, atrValue);

  if (!result.valid) {
    logger.error('Validator', `Validation failed for ${symbol}`, { errors: result.errors, response });
    throw new ValidationError('OpenAI response validation failed', {
      symbol,
      errors: result.errors,
      response,
    });
  }

  logger.debug('Validator', `Validation passed for ${symbol}`, {
    direction: response.direction,
    confidence: response.confidence,
  });
}

export default { validateTradeResponse, validateAndThrow };
