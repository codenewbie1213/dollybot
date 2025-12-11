/**
 * Main evaluation loop - monitors signal lifecycle
 */

import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import { initDatabase } from '../db/index.js';
import { getPendingSignals, getTriggeredSignals } from '../db/queries.js';
import { checkPendingSignals, checkTriggeredSignals } from './checker.js';

/**
 * Initialize evaluation engine
 */
async function initEvaluation() {
  try {
    // Initialize database
    await initDatabase();
    logger.info('Evaluation', 'Database initialized');

    logger.info('Evaluation', 'Evaluation engine initialization complete');
  } catch (error) {
    logger.error('Evaluation', 'Failed to initialize evaluation engine', error);
    throw error;
  }
}

/**
 * Main evaluation function - checks all signals
 */
async function evaluate() {
  try {
    logger.debug('Evaluation', 'Starting evaluation cycle');

    // Check pending signals (entry hits / expirations)
    const pendingSignals = getPendingSignals();
    if (pendingSignals.length > 0) {
      await checkPendingSignals(pendingSignals);
    } else {
      logger.debug('Evaluation', 'No pending signals to check');
    }

    // Check triggered signals (TP/SL hits / timeouts)
    const triggeredSignals = getTriggeredSignals();
    if (triggeredSignals.length > 0) {
      await checkTriggeredSignals(triggeredSignals);
    } else {
      logger.debug('Evaluation', 'No triggered signals to check');
    }

    logger.debug('Evaluation', 'Evaluation cycle complete');
  } catch (error) {
    logger.error('Evaluation', 'Evaluation cycle failed', error);
    throw error;
  }
}

/**
 * Start evaluation loop
 */
function startEvaluationLoop() {
  logger.info('Evaluation', `Starting evaluation loop (interval: ${config.evaluation.intervalMs}ms)`);

  // Run immediately
  evaluate().catch(error => {
    logger.error('Evaluation', 'Initial evaluation failed', error);
  });

  // Then run at intervals
  const intervalId = setInterval(() => {
    evaluate().catch(error => {
      logger.error('Evaluation', 'Scheduled evaluation failed', error);
    });
  }, config.evaluation.intervalMs);

  // Graceful shutdown
  const shutdown = (signal) => {
    logger.info('Evaluation', `Received ${signal}, shutting down...`);
    clearInterval(intervalId);
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * Main entry point
 */
async function main() {
  try {
    logger.info('Evaluation', '=== DollyBot Evaluation Engine Starting ===');
    logger.info('Evaluation', `Interval: ${config.evaluation.intervalMs}ms (${config.evaluation.intervalMs / 1000}s)`);
    logger.info('Evaluation', `Expiration threshold: ${config.evaluation.expirationCandles} candles`);
    logger.info('Evaluation', `Timeout threshold: ${config.evaluation.timeoutCandles} candles`);

    // Initialize
    await initEvaluation();

    // Start loop
    startEvaluationLoop();

    logger.info('Evaluation', '=== Evaluation engine is running ===');
  } catch (error) {
    logger.error('Evaluation', 'Fatal error in evaluation engine', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Evaluation', 'Unhandled error', error);
    process.exit(1);
  });
}

export { evaluate, initEvaluation };
export default { evaluate, initEvaluation };
