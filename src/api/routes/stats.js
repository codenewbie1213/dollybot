/**
 * Statistics API routes
 */

import express from 'express';
import { getOverviewStats, getStatsByCategory, getClosedSignals } from '../../db/queries.js';
import { logger } from '../../utils/logger.js';

const router = express.Router();

/**
 * GET /api/stats/overview
 * Get overall performance statistics
 */
router.get('/overview', (req, res, next) => {
  try {
    const stats = getOverviewStats();
    res.json(stats);
  } catch (error) {
    logger.error('API', 'Failed to get overview stats', error);
    next(error);
  }
});

/**
 * GET /api/stats/equity-curve
 * Get cumulative R-multiple over time
 */
router.get('/equity-curve', (req, res, next) => {
  try {
    const closedSignals = getClosedSignals();

    // Calculate cumulative R over time
    let cumR = 0;
    const equityCurve = closedSignals.map(signal => {
      const r = signal.outcome_detail?.rr || 0;
      cumR += r;

      return {
        t: signal.closed_at,
        cumR: Math.round(cumR * 100) / 100,
      };
    });

    res.json(equityCurve);
  } catch (error) {
    logger.error('API', 'Failed to get equity curve', error);
    next(error);
  }
});

/**
 * GET /api/stats/by-symbol
 * Get performance breakdown by symbol
 */
router.get('/by-symbol', (req, res, next) => {
  try {
    const stats = getStatsByCategory('symbol');
    res.json(stats);
  } catch (error) {
    logger.error('API', 'Failed to get stats by symbol', error);
    next(error);
  }
});

/**
 * GET /api/stats/by-timeframe
 * Get performance breakdown by timeframe
 */
router.get('/by-timeframe', (req, res, next) => {
  try {
    const stats = getStatsByCategory('timeframe');
    res.json(stats);
  } catch (error) {
    logger.error('API', 'Failed to get stats by timeframe', error);
    next(error);
  }
});

/**
 * GET /api/stats/by-mode
 * Get performance breakdown by trading mode
 */
router.get('/by-mode', (req, res, next) => {
  try {
    const stats = getStatsByCategory('mode');
    res.json(stats);
  } catch (error) {
    logger.error('API', 'Failed to get stats by mode', error);
    next(error);
  }
});

export default router;
