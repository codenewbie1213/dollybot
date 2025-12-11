/**
 * Entry and exit checking logic
 */

import { fetchCandles } from '../scanner/marketData.js';
import { updateSignalStatus } from '../db/queries.js';
import { logger } from '../utils/logger.js';
import { calculateRMultiple, determineOutcome, createOutcomeDetail } from './calculator.js';
import { notifyTriggered, notifyExpired, notifyOutcome } from '../telegram/index.js';
import config from '../config/index.js';

/**
 * Check if entry was hit for pending signals
 * @param {Array<Object>} pendingSignals - Array of pending signals
 */
export async function checkPendingSignals(pendingSignals) {
  logger.info('Checker', `Checking ${pendingSignals.length} pending signals for entry hits`);

  for (const signal of pendingSignals) {
    try {
      await checkPendingSignal(signal);
    } catch (error) {
      logger.error('Checker', `Failed to check pending signal ID ${signal.id}`, error);
    }
  }
}

/**
 * Check single pending signal
 * @param {Object} signal - Signal object
 */
async function checkPendingSignal(signal) {
  const { id, symbol, timeframe, entry, direction, created_at } = signal;

  // Fetch candles since signal creation
  const candles = await fetchCandles(symbol, timeframe, 50);

  // Find candles after signal creation
  const candlesAfterCreation = candles.filter(c => new Date(c.time) >= new Date(created_at));

  if (candlesAfterCreation.length === 0) {
    logger.debug('Checker', `No new candles for signal ID ${id}`);
    return;
  }

  // Check if entry was hit
  const entryHit = candlesAfterCreation.some(candle => {
    return candle.low <= entry && entry <= candle.high;
  });

  if (entryHit) {
    // Entry was hit - mark as triggered
    const triggered_at = candlesAfterCreation.find(c => c.low <= entry && entry <= c.high).time;

    updateSignalStatus(id, 'triggered', { triggered_at });
    logger.info('Checker', `✓ Signal ID ${id} triggered at ${entry}`);

    await notifyTriggered({ ...signal, triggered_at });
    return;
  }

  // Check if signal expired (too many candles without entry hit)
  const candlesSinceCreation = candles.filter(c => new Date(c.time) > new Date(created_at)).length;

  if (candlesSinceCreation >= config.evaluation.expirationCandles) {
    updateSignalStatus(id, 'expired', { closed_at: new Date().toISOString() });
    logger.info('Checker', `⚪ Signal ID ${id} expired (${candlesSinceCreation} candles without entry hit)`);

    await notifyExpired(signal);
  }
}

/**
 * Check if TP/SL was hit for triggered signals
 * @param {Array<Object>} triggeredSignals - Array of triggered signals
 */
export async function checkTriggeredSignals(triggeredSignals) {
  logger.info('Checker', `Checking ${triggeredSignals.length} triggered signals for TP/SL hits`);

  for (const signal of triggeredSignals) {
    try {
      await checkTriggeredSignal(signal);
    } catch (error) {
      logger.error('Checker', `Failed to check triggered signal ID ${signal.id}`, error);
    }
  }
}

/**
 * Check single triggered signal
 * @param {Object} signal - Signal object
 */
async function checkTriggeredSignal(signal) {
  const { id, symbol, timeframe, entry, stop_loss, take_profits, direction, triggered_at } = signal;

  // Fetch candles since trigger
  const candles = await fetchCandles(symbol, timeframe, 150);

  // Find candles after trigger
  const candlesAfterTrigger = candles.filter(c => new Date(c.time) > new Date(triggered_at));

  if (candlesAfterTrigger.length === 0) {
    logger.debug('Checker', `No new candles after trigger for signal ID ${id}`);
    return;
  }

  // Check each candle for TP/SL hit (in chronological order)
  for (const candle of candlesAfterTrigger) {
    // Check SL first (priority)
    const slHit = direction === 'long'
      ? candle.low <= stop_loss
      : candle.high >= stop_loss;

    if (slHit) {
      // Stop loss hit
      const rMultiple = calculateRMultiple(signal, stop_loss, 'sl');
      const outcome = determineOutcome('sl', rMultiple);
      const outcome_detail = createOutcomeDetail('sl', rMultiple, stop_loss, candle.time);

      updateSignalStatus(id, outcome, {
        closed_at: candle.time,
        outcome,
        outcome_detail,
      });

      logger.info('Checker', `❌ Signal ID ${id} hit SL at ${stop_loss} (R: ${rMultiple.toFixed(2)})`);
      await notifyOutcome({ ...signal, outcome, outcome_detail });
      return;
    }

    // Check TPs
    for (let i = 0; i < take_profits.length; i++) {
      const tp = take_profits[i];
      const tpHit = direction === 'long'
        ? candle.high >= tp
        : candle.low <= tp;

      if (tpHit) {
        // Take profit hit
        const hitType = `tp${i + 1}`;
        const rMultiple = calculateRMultiple(signal, tp, hitType);
        const outcome = determineOutcome(hitType, rMultiple);
        const outcome_detail = createOutcomeDetail(hitType, rMultiple, tp, candle.time);

        updateSignalStatus(id, outcome, {
          closed_at: candle.time,
          outcome,
          outcome_detail,
        });

        logger.info('Checker', `✅ Signal ID ${id} hit ${hitType.toUpperCase()} at ${tp} (R: ${rMultiple.toFixed(2)})`);
        await notifyOutcome({ ...signal, outcome, outcome_detail });
        return;
      }
    }
  }

  // Check for timeout (no TP/SL hit after many candles)
  const candlesSinceTrigger = candlesAfterTrigger.length;

  if (candlesSinceTrigger >= config.evaluation.timeoutCandles) {
    // Get current price for outcome detail
    const currentPrice = candlesAfterTrigger[candlesAfterTrigger.length - 1].close;
    const rMultiple = calculateRMultiple(signal, currentPrice, 'timeout');
    const outcome = 'timeout';
    const outcome_detail = createOutcomeDetail('timeout', rMultiple, currentPrice, candlesAfterTrigger[candlesAfterTrigger.length - 1].time);

    updateSignalStatus(id, outcome, {
      closed_at: candlesAfterTrigger[candlesAfterTrigger.length - 1].time,
      outcome,
      outcome_detail,
    });

    logger.info('Checker', `⏱️ Signal ID ${id} timed out (${candlesSinceTrigger} candles without TP/SL hit)`);
    await notifyOutcome({ ...signal, outcome, outcome_detail });
  }
}

export default {
  checkPendingSignals,
  checkTriggeredSignals,
};
