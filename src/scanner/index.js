/**
 * Main scanner loop - scans markets and generates trade signals
 */

import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import { initDatabase } from '../db/index.js';
import { insertSignal } from '../db/queries.js';
import { fetchCandles } from './marketData.js';
import { computeAllIndicators } from '../indicators/index.js';
import { applyPrefilters } from './prefilter.js';
import { scheduleScanner } from './scheduler.js';
import { getRateLimiter } from './rateLimiter.js';

// Will be imported after those modules are built
let analyzeSetup = null;
let notifyNewSignal = null;

/**
 * Initialize scanner dependencies
 */
async function initScanner() {
  try {
    // Initialize database
    await initDatabase();
    logger.info('Scanner', 'Database initialized');

    // Try to import OpenAI and Telegram modules (may not exist yet)
    try {
      const openaiModule = await import('../openai/index.js');
      analyzeSetup = openaiModule.analyzeSetup;
      logger.info('Scanner', 'OpenAI module loaded');
    } catch (error) {
      logger.warn('Scanner', 'OpenAI module not available yet, signals will not be analyzed');
    }

    try {
      const telegramModule = await import('../telegram/index.js');
      notifyNewSignal = telegramModule.notifyNewSignal;
      logger.info('Scanner', 'Telegram module loaded');
    } catch (error) {
      logger.warn('Scanner', 'Telegram module not available yet, notifications disabled');
    }

    logger.info('Scanner', 'Scanner initialization complete');
  } catch (error) {
    logger.error('Scanner', 'Failed to initialize scanner', error);
    throw error;
  }
}

/**
 * Main scanner function - scans all symbols and timeframes with rate limiting
 */
async function scan() {
  const { symbols, timeframes, modes } = config.scanner;
  const rateLimiter = getRateLimiter(config.rateLimiter);

  // Get combinations to scan this cycle (respects rate limits)
  const combinations = rateLimiter.getCombinationsForCycle(
    symbols,
    timeframes,
    config.rateLimiter?.maxPerCycle
  );

  if (combinations.length === 0) {
    logger.warn('Scanner', 'No combinations available due to rate limits, skipping cycle');
    rateLimiter.logStats();
    return;
  }

  logger.info('Scanner', `Scanning ${combinations.length} combinations (of ${symbols.length * timeframes.length} total)`);

  let totalCandidates = 0;
  let totalSignals = 0;
  let apiCallsThisCycle = 0;

  for (let i = 0; i < combinations.length; i++) {
    const { symbol, timeframe } = combinations[i];

    try {
      // Check if we can make a call
      const check = rateLimiter.canMakeCall(1);
      if (!check.allowed) {
        logger.warn('Scanner', `Skipping ${symbol} ${timeframe}: ${check.reason}`);
        break; // Stop scanning if we hit limits mid-cycle
      }

      // Add delay before API call to space out requests (except first call)
      if (i > 0) {
        const delayMs = Math.ceil(60000 / config.rateLimiter.maxCallsPerMinute) + 500; // Add buffer
        logger.debug('Scanner', `Waiting ${delayMs}ms before next API call...`);
        await sleep(delayMs);
      }

      // Fetch candle data
      logger.debug('Scanner', `Fetching data for ${symbol} ${timeframe}`);
      const candles = await fetchCandles(symbol, timeframe, config.scanner.candleCount);

      // Record the API call
      rateLimiter.recordCall(1);
      apiCallsThisCycle++;

      // Compute indicators
      logger.debug('Scanner', `Computing indicators for ${symbol} ${timeframe}`);
      const indicators = computeAllIndicators(candles);

      // DEBUG: Output full data structure as JSON
      console.log('\n========== DATA STRUCTURE DEBUG ==========');
      console.log(`Symbol: ${symbol}, Timeframe: ${timeframe}`);
      console.log('\n--- Last 5 Candles ---');
      console.log(JSON.stringify(candles.slice(-5), null, 2));
      console.log('\n--- Computed Indicators ---');
      console.log(JSON.stringify(indicators, null, 2));
      console.log('==========================================\n');

      // Apply pre-filters for each mode
      for (const mode of modes) {
        const prefilterResult = applyPrefilters(candles, indicators, mode);

        if (!prefilterResult.isCandidate) {
          logger.debug('Scanner', `${symbol} ${timeframe} ${mode}: Not a candidate - ${prefilterResult.reason || 'no setup'}`);
          continue;
        }

        totalCandidates++;
        logger.info('Scanner', `✓ Candidate found: ${symbol} ${timeframe} ${mode} - ${prefilterResult.reason}`);

        // Analyze with OpenAI (if available)
        if (analyzeSetup) {
          try {
            const signal = await analyzeSetup(
              symbol,
              timeframe,
              mode,
              candles,
              indicators,
              prefilterResult.reason
            );

            if (signal) {
              // Check confidence threshold
              if (signal.confidence < config.trading.confidenceThreshold) {
                logger.info('Scanner', `Signal rejected: confidence ${signal.confidence} below threshold ${config.trading.confidenceThreshold}`);
                continue;
              }

              // Insert signal into database
              const signalId = insertSignal({
                symbol,
                timeframe,
                mode,
                direction: signal.direction,
                entry: signal.entry,
                stop_loss: signal.stop_loss,
                take_profits: signal.take_profits,
                confidence: signal.confidence,
                reason: signal.reason,
                management_hint: signal.management_hint,
                candidate_reason: prefilterResult.reason,
                status: 'pending',
              });

              if (signalId) {
                totalSignals++;
                logger.info('Scanner', `✅ New signal created: ID ${signalId} - ${symbol} ${timeframe} ${mode} ${signal.direction.toUpperCase()}`);

                // Send Telegram notification (if available)
                if (notifyNewSignal) {
                  try {
                    await notifyNewSignal({ id: signalId, ...signal, symbol, timeframe, mode, candidate_reason: prefilterResult.reason });
                  } catch (telegramError) {
                    logger.error('Scanner', 'Failed to send Telegram notification', telegramError);
                    // Continue even if notification fails
                  }
                }
              } else {
                logger.info('Scanner', 'Duplicate signal detected, skipped');
              }
            } else {
              logger.info('Scanner', `OpenAI returned no trade for ${symbol} ${timeframe} ${mode}`);
            }
          } catch (openaiError) {
            logger.error('Scanner', `OpenAI analysis failed for ${symbol} ${timeframe} ${mode}`, openaiError);
            // Continue with other symbols
          }
        } else {
          logger.info('Scanner', `Would analyze: ${symbol} ${timeframe} ${mode} - ${prefilterResult.reason} (OpenAI not available)`);
        }
      }
    } catch (error) {
      logger.error('Scanner', `Failed to process ${symbol} ${timeframe}`, error);
      // Continue with other symbols
    }
  }

  logger.info('Scanner', `Scan complete: ${apiCallsThisCycle} API calls, ${totalCandidates} candidates found, ${totalSignals} signals created`);
  rateLimiter.logStats();
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main entry point
 */
async function main() {
  try {
    logger.info('Scanner', '=== DollyBot Scanner Starting ===');
    logger.info('Scanner', `Mode: ${config.scanner.modes.join(', ')}`);
    logger.info('Scanner', `Symbols: ${config.scanner.symbols.join(', ')}`);
    logger.info('Scanner', `Timeframes: ${config.scanner.timeframes.join(', ')}`);
    logger.info('Scanner', `Interval: ${config.scanner.intervalMs}ms (${config.scanner.intervalMs / 1000}s)`);

    // Initialize scanner
    await initScanner();

    // Schedule recurring scans
    scheduleScanner(scan, config.scanner.intervalMs);

    logger.info('Scanner', '=== Scanner is running ===');
  } catch (error) {
    logger.error('Scanner', 'Fatal error in scanner', error);
    process.exit(1);
  }
}

// Run scanner if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Scanner', 'Unhandled error', error);
    process.exit(1);
  });
}

export { scan, initScanner };
export default { scan, initScanner };
