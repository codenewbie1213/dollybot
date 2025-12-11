/**
 * Scheduler for running scanner at regular intervals
 */

import { logger } from '../utils/logger.js';

let intervalId = null;
let isRunning = false;

/**
 * Schedule scanner to run at regular intervals
 * @param {Function} scannerFn - Scanner function to run
 * @param {number} intervalMs - Interval in milliseconds
 * @returns {Object} Control object with stop() method
 */
export function scheduleScanner(scannerFn, intervalMs) {
  if (intervalId) {
    logger.warn('Scheduler', 'Scanner already scheduled, stopping previous instance');
    stopScheduler();
  }

  logger.info('Scheduler', `Scheduling scanner to run every ${intervalMs}ms (${intervalMs / 1000}s)`);

  // Run immediately on start
  runScan(scannerFn);

  // Then schedule recurring scans
  intervalId = setInterval(() => {
    runScan(scannerFn);
  }, intervalMs);

  // Setup graceful shutdown handlers
  setupShutdownHandlers();

  return {
    stop: stopScheduler,
  };
}

/**
 * Run a single scan with error handling
 * @param {Function} scannerFn - Scanner function
 */
async function runScan(scannerFn) {
  if (isRunning) {
    logger.warn('Scheduler', 'Previous scan still running, skipping this iteration');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    logger.info('Scheduler', '=== Starting scanner cycle ===');
    await scannerFn();
    const duration = Date.now() - startTime;
    logger.info('Scheduler', `=== Scanner cycle completed in ${duration}ms ===`);
  } catch (error) {
    logger.error('Scheduler', 'Scanner cycle failed', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Stop the scheduler
 */
export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Scheduler', 'Scanner stopped');
  }
}

/**
 * Setup graceful shutdown handlers
 */
function setupShutdownHandlers() {
  const shutdown = async (signal) => {
    logger.info('Scheduler', `Received ${signal}, shutting down gracefully...`);

    stopScheduler();

    // Wait for current scan to finish
    const maxWait = 30000; // 30 seconds
    const checkInterval = 500;
    let waited = 0;

    while (isRunning && waited < maxWait) {
      await sleep(checkInterval);
      waited += checkInterval;
    }

    if (isRunning) {
      logger.warn('Scheduler', 'Scan did not complete within timeout, forcing shutdown');
    } else {
      logger.info('Scheduler', 'Graceful shutdown complete');
    }

    process.exit(0);
  };

  // Handle various shutdown signals
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default { scheduleScanner, stopScheduler };
