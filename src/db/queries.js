/**
 * Database queries for DollyBot signals
 */

import { getDatabase, executeWithRetry } from './index.js';
import { logger } from '../utils/logger.js';
import { DatabaseError } from '../utils/errors.js';

/**
 * Insert a new signal into the database
 * @param {Object} signal - Signal data
 * @returns {number} Inserted signal ID
 */
export function insertSignal(signal) {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT INTO signals (
        symbol, timeframe, mode, direction, entry, stop_loss, take_profits,
        confidence, reason, management_hint, candidate_reason, status
      ) VALUES (
        @symbol, @timeframe, @mode, @direction, @entry, @stop_loss, @take_profits,
        @confidence, @reason, @management_hint, @candidate_reason, @status
      )
    `);

    const result = executeWithRetry(() =>
      stmt.run({
        symbol: signal.symbol,
        timeframe: signal.timeframe,
        mode: signal.mode,
        direction: signal.direction,
        entry: signal.entry,
        stop_loss: signal.stop_loss,
        take_profits: JSON.stringify(signal.take_profits),
        confidence: signal.confidence,
        reason: signal.reason,
        management_hint: signal.management_hint || null,
        candidate_reason: signal.candidate_reason || null,
        status: signal.status || 'pending',
      })
    );

    logger.debug('Database', `Inserted signal ID ${result.lastInsertRowid}`, { signal });
    return result.lastInsertRowid;
  } catch (error) {
    // Check for unique constraint violation
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      logger.warn('Database', 'Duplicate signal detected, skipping insert', { signal });
      return null;
    }
    logger.error('Database', 'Failed to insert signal', error);
    throw new DatabaseError('Failed to insert signal', { error: error.message, signal });
  }
}

/**
 * Update signal status and additional fields
 * @param {number} id - Signal ID
 * @param {string} status - New status
 * @param {Object} additionalFields - Additional fields to update
 */
export function updateSignalStatus(id, status, additionalFields = {}) {
  try {
    const db = getDatabase();

    // Build dynamic update query
    const fields = ['status = @status'];
    const params = { id, status };

    if (additionalFields.triggered_at) {
      fields.push('triggered_at = @triggered_at');
      params.triggered_at = additionalFields.triggered_at;
    }

    if (additionalFields.closed_at) {
      fields.push('closed_at = @closed_at');
      params.closed_at = additionalFields.closed_at;
    }

    if (additionalFields.outcome) {
      fields.push('outcome = @outcome');
      params.outcome = additionalFields.outcome;
    }

    if (additionalFields.outcome_detail) {
      fields.push('outcome_detail = @outcome_detail');
      params.outcome_detail = JSON.stringify(additionalFields.outcome_detail);
    }

    const query = `UPDATE signals SET ${fields.join(', ')} WHERE id = @id`;
    const stmt = db.prepare(query);

    executeWithRetry(() => stmt.run(params));

    logger.debug('Database', `Updated signal ID ${id} status to ${status}`, additionalFields);
  } catch (error) {
    logger.error('Database', `Failed to update signal ID ${id}`, error);
    throw new DatabaseError('Failed to update signal', { error: error.message, id, status });
  }
}

/**
 * Get all signals with a specific status
 * @param {string} status - Signal status
 * @returns {Array} Array of signal objects
 */
export function getSignalsByStatus(status) {
  try {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM signals WHERE status = ? ORDER BY created_at DESC');

    const signals = executeWithRetry(() => stmt.all(status));

    // Parse JSON fields
    return signals.map(parseSignal);
  } catch (error) {
    logger.error('Database', `Failed to get signals by status: ${status}`, error);
    throw new DatabaseError('Failed to get signals', { error: error.message, status });
  }
}

/**
 * Get all pending signals
 * @returns {Array} Array of pending signals
 */
export function getPendingSignals() {
  return getSignalsByStatus('pending');
}

/**
 * Get all triggered signals
 * @returns {Array} Array of triggered signals
 */
export function getTriggeredSignals() {
  return getSignalsByStatus('triggered');
}

/**
 * Get signal by ID
 * @param {number} id - Signal ID
 * @returns {Object|null} Signal object or null if not found
 */
export function getSignalById(id) {
  try {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM signals WHERE id = ?');

    const signal = executeWithRetry(() => stmt.get(id));

    return signal ? parseSignal(signal) : null;
  } catch (error) {
    logger.error('Database', `Failed to get signal by ID: ${id}`, error);
    throw new DatabaseError('Failed to get signal', { error: error.message, id });
  }
}

/**
 * Get signals with filters and pagination
 * @param {Object} filters - Filter options
 * @returns {Object} { signals: Array, total: number }
 */
export function getSignals(filters = {}) {
  try {
    const db = getDatabase();
    const conditions = [];
    const params = {};

    // Build WHERE clause
    if (filters.symbol) {
      conditions.push('symbol = @symbol');
      params.symbol = filters.symbol;
    }

    if (filters.timeframe) {
      conditions.push('timeframe = @timeframe');
      params.timeframe = filters.timeframe;
    }

    if (filters.mode) {
      conditions.push('mode = @mode');
      params.mode = filters.mode;
    }

    if (filters.status) {
      conditions.push('status = @status');
      params.status = filters.status;
    }

    if (filters.outcome) {
      conditions.push('outcome = @outcome');
      params.outcome = filters.outcome;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM signals ${whereClause}`);
    const { count: total } = executeWithRetry(() => countStmt.get(params));

    // Get paginated results
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const query = `
      SELECT * FROM signals ${whereClause}
      ORDER BY created_at DESC
      LIMIT @limit OFFSET @offset
    `;

    const stmt = db.prepare(query);
    const signals = executeWithRetry(() =>
      stmt.all({ ...params, limit, offset })
    );

    return {
      signals: signals.map(parseSignal),
      total,
      limit,
      offset,
    };
  } catch (error) {
    logger.error('Database', 'Failed to get signals with filters', error);
    throw new DatabaseError('Failed to get signals', { error: error.message, filters });
  }
}

/**
 * Get closed signals for statistics (win, loss, timeout)
 * @returns {Array} Array of closed signals
 */
export function getClosedSignals() {
  try {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM signals
      WHERE status IN ('win', 'loss', 'timeout')
      ORDER BY closed_at ASC
    `);

    const signals = executeWithRetry(() => stmt.all());
    return signals.map(parseSignal);
  } catch (error) {
    logger.error('Database', 'Failed to get closed signals', error);
    throw new DatabaseError('Failed to get closed signals', { error: error.message });
  }
}

/**
 * Get performance statistics overview
 * @returns {Object} Statistics object
 */
export function getOverviewStats() {
  try {
    const db = getDatabase();

    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total_trades,
        SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses,
        SUM(CASE WHEN outcome = 'timeout' THEN 1 ELSE 0 END) as timeouts
      FROM signals
      WHERE status IN ('win', 'loss', 'timeout')
    `);

    const stats = executeWithRetry(() => stmt.get());

    const totalTrades = stats.total_trades || 0;
    const wins = stats.wins || 0;
    const losses = stats.losses || 0;

    // Calculate win rate (excluding timeouts)
    const decidedTrades = wins + losses;
    const winrate = decidedTrades > 0 ? wins / decidedTrades : 0;

    // Calculate average R and profit factor
    const closedSignals = getClosedSignals();
    let sumR = 0;
    let sumWinningR = 0;
    let sumLosingR = 0;

    closedSignals.forEach(signal => {
      if (signal.outcome_detail && signal.outcome_detail.rr !== undefined) {
        const r = signal.outcome_detail.rr;
        sumR += r;

        if (r > 0) {
          sumWinningR += r;
        } else if (r < 0) {
          sumLosingR += Math.abs(r);
        }
      }
    });

    const avgR = totalTrades > 0 ? sumR / totalTrades : 0;
    const profitFactor = sumLosingR > 0 ? sumWinningR / sumLosingR : (sumWinningR > 0 ? Infinity : 0);

    return {
      totalTrades,
      wins,
      losses,
      timeouts: stats.timeouts || 0,
      winrate,
      avgR,
      profitFactor: profitFactor === Infinity ? 999 : profitFactor, // Cap infinity at 999 for display
    };
  } catch (error) {
    logger.error('Database', 'Failed to get overview stats', error);
    throw new DatabaseError('Failed to get overview stats', { error: error.message });
  }
}

/**
 * Get performance statistics by category (symbol, timeframe, or mode)
 * @param {string} category - Category to group by ('symbol', 'timeframe', or 'mode')
 * @returns {Array} Array of category stats
 */
export function getStatsByCategory(category) {
  try {
    const db = getDatabase();

    const validCategories = ['symbol', 'timeframe', 'mode'];
    if (!validCategories.includes(category)) {
      throw new Error(`Invalid category: ${category}`);
    }

    const stmt = db.prepare(`
      SELECT
        ${category},
        COUNT(*) as trades,
        SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses
      FROM signals
      WHERE status IN ('win', 'loss', 'timeout')
      GROUP BY ${category}
      ORDER BY ${category}
    `);

    const results = executeWithRetry(() => stmt.all());

    // Calculate stats for each category
    return results.map(row => {
      const decidedTrades = row.wins + row.losses;
      const winrate = decidedTrades > 0 ? row.wins / decidedTrades : 0;

      // Get closed signals for this category to calculate R stats
      const closedSignals = getClosedSignals().filter(s => s[category] === row[category]);

      let sumR = 0;
      let sumWinningR = 0;
      let sumLosingR = 0;

      closedSignals.forEach(signal => {
        if (signal.outcome_detail && signal.outcome_detail.rr !== undefined) {
          const r = signal.outcome_detail.rr;
          sumR += r;

          if (r > 0) {
            sumWinningR += r;
          } else if (r < 0) {
            sumLosingR += Math.abs(r);
          }
        }
      });

      const avgR = row.trades > 0 ? sumR / row.trades : 0;
      const profitFactor = sumLosingR > 0 ? sumWinningR / sumLosingR : (sumWinningR > 0 ? 999 : 0);

      return {
        [category]: row[category],
        trades: row.trades,
        wins: row.wins,
        losses: row.losses,
        winrate,
        avgR,
        profitFactor,
      };
    });
  } catch (error) {
    logger.error('Database', `Failed to get stats by category: ${category}`, error);
    throw new DatabaseError('Failed to get stats by category', { error: error.message, category });
  }
}

/**
 * Parse signal object (parse JSON fields)
 * @param {Object} signal - Raw signal from database
 * @returns {Object} Parsed signal
 */
function parseSignal(signal) {
  return {
    ...signal,
    take_profits: signal.take_profits ? JSON.parse(signal.take_profits) : [],
    outcome_detail: signal.outcome_detail ? JSON.parse(signal.outcome_detail) : null,
  };
}

export default {
  insertSignal,
  updateSignalStatus,
  getSignalsByStatus,
  getPendingSignals,
  getTriggeredSignals,
  getSignalById,
  getSignals,
  getClosedSignals,
  getOverviewStats,
  getStatsByCategory,
};
