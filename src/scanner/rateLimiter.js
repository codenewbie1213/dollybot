/**
 * Rate limiter for API calls
 * Handles both per-minute and daily rate limits
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '../..');

// Rate limiter state
class RateLimiter {
  constructor(options = {}) {
    this.maxCallsPerMinute = options.maxCallsPerMinute || 8;
    this.maxCallsPerDay = options.maxCallsPerDay || 800;
    this.dailyBuffer = options.dailyBuffer || 50; // Reserve buffer to avoid hard limit
    this.stateFilePath = options.stateFilePath || path.join(projectRoot, 'data', 'rate_limiter_state.json');

    // Per-minute tracking (sliding window)
    this.minuteCallLog = [];

    // Daily tracking (persistent)
    this.dailyState = {
      date: this.getTodayDateString(),
      callCount: 0,
      lastReset: new Date().toISOString(),
    };

    // Combination rotation tracking
    this.rotationIndex = 0;

    // Load state from disk
    this.loadState();

    // Check if we need to reset daily counter
    this.checkDailyReset();
  }

  /**
   * Get today's date as YYYY-MM-DD string
   */
  getTodayDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Check if daily counter needs to be reset
   */
  checkDailyReset() {
    const today = this.getTodayDateString();

    if (this.dailyState.date !== today) {
      logger.info('RateLimiter', `New day detected, resetting daily counter (was ${this.dailyState.callCount} calls on ${this.dailyState.date})`);
      this.dailyState = {
        date: today,
        callCount: 0,
        lastReset: new Date().toISOString(),
      };
      this.rotationIndex = 0;
      this.saveState();
    }
  }

  /**
   * Load state from disk
   */
  loadState() {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const data = fs.readFileSync(this.stateFilePath, 'utf8');
        const state = JSON.parse(data);

        // Only load daily state if it's from today
        if (state.dailyState && state.dailyState.date === this.getTodayDateString()) {
          this.dailyState = state.dailyState;
          this.rotationIndex = state.rotationIndex || 0;
          logger.info('RateLimiter', `Loaded state: ${this.dailyState.callCount} calls used today, rotation index: ${this.rotationIndex}`);
        } else {
          logger.info('RateLimiter', 'State file from previous day, starting fresh');
        }
      }
    } catch (error) {
      logger.warn('RateLimiter', 'Failed to load state file, starting fresh', error);
    }
  }

  /**
   * Save state to disk
   */
  saveState() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const state = {
        dailyState: this.dailyState,
        rotationIndex: this.rotationIndex,
        lastUpdated: new Date().toISOString(),
      };

      fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2));
    } catch (error) {
      logger.error('RateLimiter', 'Failed to save state file', error);
    }
  }

  /**
   * Clean up old entries from minute call log (older than 60 seconds)
   */
  cleanMinuteCallLog() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    this.minuteCallLog = this.minuteCallLog.filter(timestamp => timestamp > oneMinuteAgo);
  }

  /**
   * Check if we can make API calls right now
   * @param {number} count - Number of calls to check
   * @returns {Object} { allowed: boolean, reason: string, remainingMinute: number, remainingDaily: number }
   */
  canMakeCall(count = 1) {
    this.checkDailyReset();
    this.cleanMinuteCallLog();

    const remainingMinute = this.maxCallsPerMinute - this.minuteCallLog.length;
    const effectiveDailyLimit = this.maxCallsPerDay - this.dailyBuffer;
    const remainingDaily = effectiveDailyLimit - this.dailyState.callCount;

    // Check per-minute limit
    if (this.minuteCallLog.length + count > this.maxCallsPerMinute) {
      return {
        allowed: false,
        reason: `Per-minute limit reached (${this.minuteCallLog.length}/${this.maxCallsPerMinute})`,
        remainingMinute,
        remainingDaily,
      };
    }

    // Check daily limit
    if (this.dailyState.callCount + count > effectiveDailyLimit) {
      return {
        allowed: false,
        reason: `Daily limit reached (${this.dailyState.callCount}/${effectiveDailyLimit})`,
        remainingMinute,
        remainingDaily,
      };
    }

    return {
      allowed: true,
      reason: 'OK',
      remainingMinute,
      remainingDaily,
    };
  }

  /**
   * Record an API call
   * @param {number} count - Number of calls to record (default: 1)
   */
  recordCall(count = 1) {
    const now = Date.now();

    // Record in per-minute log
    for (let i = 0; i < count; i++) {
      this.minuteCallLog.push(now);
    }

    // Record in daily counter
    this.dailyState.callCount += count;

    // Save state
    this.saveState();

    logger.debug('RateLimiter', `Recorded ${count} call(s). Total today: ${this.dailyState.callCount}/${this.maxCallsPerDay}, Last minute: ${this.minuteCallLog.length}/${this.maxCallsPerMinute}`);
  }

  /**
   * Get combinations to scan this cycle (rotation-based)
   * @param {Array<string>} symbols - All symbols
   * @param {Array<string>} timeframes - All timeframes
   * @param {number} maxPerCycle - Max combinations per cycle (default: based on rate limit)
   * @returns {Array<Object>} Array of {symbol, timeframe} objects to scan
   */
  getCombinationsForCycle(symbols, timeframes, maxPerCycle = null) {
    this.checkDailyReset();
    this.cleanMinuteCallLog();

    // Calculate how many we can scan
    const remainingMinute = this.maxCallsPerMinute - this.minuteCallLog.length;
    const effectiveDailyLimit = this.maxCallsPerDay - this.dailyBuffer;
    const remainingDaily = effectiveDailyLimit - this.dailyState.callCount;

    const maxAllowed = Math.min(
      maxPerCycle || this.maxCallsPerMinute,
      remainingMinute,
      remainingDaily
    );

    if (maxAllowed <= 0) {
      logger.warn('RateLimiter', 'No API calls available this cycle');
      return [];
    }

    // Generate all combinations
    const allCombinations = [];
    for (const symbol of symbols) {
      for (const timeframe of timeframes) {
        allCombinations.push({ symbol, timeframe });
      }
    }

    // Get combinations starting from rotation index
    const selected = [];
    for (let i = 0; i < maxAllowed && selected.length < allCombinations.length; i++) {
      const index = (this.rotationIndex + i) % allCombinations.length;
      selected.push(allCombinations[index]);
    }

    // Update rotation index for next cycle
    this.rotationIndex = (this.rotationIndex + maxAllowed) % allCombinations.length;
    this.saveState();

    logger.info('RateLimiter', `Selected ${selected.length}/${allCombinations.length} combinations for this cycle (rotation index: ${this.rotationIndex})`);

    return selected;
  }

  /**
   * Wait until we can make calls (for per-minute limit only)
   * @returns {Promise<number>} Milliseconds waited
   */
  async waitForAvailability() {
    this.cleanMinuteCallLog();

    if (this.minuteCallLog.length === 0) {
      return 0; // No waiting needed
    }

    // Find oldest call in the last minute
    const oldestCall = Math.min(...this.minuteCallLog);
    const now = Date.now();
    const timeSinceOldest = now - oldestCall;
    const timeToWait = 60000 - timeSinceOldest;

    if (timeToWait > 0) {
      logger.info('RateLimiter', `Waiting ${timeToWait}ms for per-minute rate limit...`);
      await sleep(timeToWait + 100); // Add small buffer
      this.cleanMinuteCallLog();
      return timeToWait;
    }

    return 0;
  }

  /**
   * Get current usage statistics
   */
  getStats() {
    this.checkDailyReset();
    this.cleanMinuteCallLog();

    const effectiveDailyLimit = this.maxCallsPerDay - this.dailyBuffer;

    return {
      minute: {
        used: this.minuteCallLog.length,
        limit: this.maxCallsPerMinute,
        remaining: this.maxCallsPerMinute - this.minuteCallLog.length,
      },
      daily: {
        used: this.dailyState.callCount,
        limit: this.maxCallsPerDay,
        effectiveLimit: effectiveDailyLimit,
        remaining: effectiveDailyLimit - this.dailyState.callCount,
        percentage: ((this.dailyState.callCount / effectiveDailyLimit) * 100).toFixed(1),
      },
      rotation: {
        index: this.rotationIndex,
      },
      date: this.dailyState.date,
    };
  }

  /**
   * Log current statistics
   */
  logStats() {
    const stats = this.getStats();
    logger.info('RateLimiter', `API Usage - Minute: ${stats.minute.used}/${stats.minute.limit}, Daily: ${stats.daily.used}/${stats.daily.effectiveLimit} (${stats.daily.percentage}%), Rotation: ${stats.rotation.index}`);
  }
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Singleton instance
let rateLimiterInstance = null;

/**
 * Get or create rate limiter instance
 */
export function getRateLimiter(options = {}) {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter(options);
  }
  return rateLimiterInstance;
}

export default { getRateLimiter, RateLimiter };
