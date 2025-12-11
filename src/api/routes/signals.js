/**
 * Signals API routes
 */

import express from 'express';
import { getSignals, getSignalById } from '../../db/queries.js';
import { logger } from '../../utils/logger.js';

const router = express.Router();

/**
 * GET /api/signals
 * Get paginated signals with optional filters
 */
router.get('/', (req, res, next) => {
  try {
    const filters = {
      symbol: req.query.symbol,
      timeframe: req.query.timeframe,
      mode: req.query.mode,
      status: req.query.status,
      outcome: req.query.outcome,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
    };

    const result = getSignals(filters);
    res.json(result);
  } catch (error) {
    logger.error('API', 'Failed to get signals', error);
    next(error);
  }
});

/**
 * GET /api/signals/:id
 * Get single signal by ID
 */
router.get('/:id', (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid signal ID' });
    }

    const signal = getSignalById(id);

    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }

    res.json(signal);
  } catch (error) {
    logger.error('API', `Failed to get signal ${req.params.id}`, error);
    next(error);
  }
});

export default router;
