/**
 * Telegram notification functions
 */

import { sendMessageSafe } from './client.js';
import {
  formatNewSignal,
  formatTriggered,
  formatExpired,
  formatOutcome,
} from './formatter.js';
import { logger } from '../utils/logger.js';

/**
 * Send new signal notification
 * @param {Object} signal - Signal object
 */
export async function notifyNewSignal(signal) {
  try {
    const message = formatNewSignal(signal);
    await sendMessageSafe(message);
    logger.info('Telegram', `Sent new signal notification for ${signal.symbol} ${signal.timeframe}`);
  } catch (error) {
    logger.error('Telegram', 'Failed to send new signal notification', error);
  }
}

/**
 * Send triggered notification
 * @param {Object} signal - Signal object
 */
export async function notifyTriggered(signal) {
  try {
    const message = formatTriggered(signal);
    await sendMessageSafe(message);
    logger.info('Telegram', `Sent triggered notification for signal ID ${signal.id}`);
  } catch (error) {
    logger.error('Telegram', 'Failed to send triggered notification', error);
  }
}

/**
 * Send expired notification
 * @param {Object} signal - Signal object
 */
export async function notifyExpired(signal) {
  try {
    const message = formatExpired(signal);
    await sendMessageSafe(message);
    logger.info('Telegram', `Sent expired notification for signal ID ${signal.id}`);
  } catch (error) {
    logger.error('Telegram', 'Failed to send expired notification', error);
  }
}

/**
 * Send outcome notification
 * @param {Object} signal - Signal object with outcome
 */
export async function notifyOutcome(signal) {
  try {
    if (!signal.outcome_detail) {
      logger.warn('Telegram', `No outcome detail for signal ID ${signal.id}, skipping notification`);
      return;
    }

    const message = formatOutcome(signal, signal.outcome_detail);
    await sendMessageSafe(message);
    logger.info('Telegram', `Sent outcome notification for signal ID ${signal.id}: ${signal.outcome}`);
  } catch (error) {
    logger.error('Telegram', 'Failed to send outcome notification', error);
  }
}

export default {
  notifyNewSignal,
  notifyTriggered,
  notifyExpired,
  notifyOutcome,
};
