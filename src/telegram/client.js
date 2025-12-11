/**
 * Telegram bot client wrapper
 */

import TelegramBot from 'node-telegram-bot-api';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import { TelegramError } from '../utils/errors.js';

let bot = null;

/**
 * Initialize Telegram bot
 * @returns {TelegramBot} Bot instance
 */
export function initTelegramBot() {
  if (bot) {
    return bot;
  }

  if (!config.telegram.enabled) {
    logger.warn('Telegram', 'Telegram notifications disabled in config');
    return null;
  }

  try {
    bot = new TelegramBot(config.telegram.botToken, {
      polling: false, // We only send messages, don't need to receive
    });

    logger.info('Telegram', 'Telegram bot initialized');
    return bot;
  } catch (error) {
    logger.error('Telegram', 'Failed to initialize Telegram bot', error);
    throw new TelegramError('Failed to initialize Telegram bot', { error: error.message });
  }
}

/**
 * Send message to configured chat
 * @param {string} text - Message text (supports Markdown)
 * @param {Object} options - Additional options
 * @returns {Promise<void>}
 */
export async function sendMessage(text, options = {}) {
  if (!config.telegram.enabled) {
    logger.debug('Telegram', 'Telegram disabled, skipping message');
    return;
  }

  if (!bot) {
    bot = initTelegramBot();
  }

  if (!bot) {
    logger.warn('Telegram', 'Bot not initialized, skipping message');
    return;
  }

  try {
    await bot.sendMessage(config.telegram.chatId, text, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...options,
    });

    logger.debug('Telegram', 'Message sent successfully');
  } catch (error) {
    logger.error('Telegram', 'Failed to send message', error);

    // Check for specific error types
    if (error.response && error.response.body) {
      const errorCode = error.response.body.error_code;
      const errorDesc = error.response.body.description;

      if (errorCode === 400) {
        throw new TelegramError(`Invalid message: ${errorDesc}`, {
          error_code: errorCode,
          description: errorDesc,
        });
      }

      if (errorCode === 401) {
        throw new TelegramError('Invalid bot token', {
          error_code: errorCode,
        });
      }

      if (errorCode === 403) {
        throw new TelegramError(`Bot blocked or chat invalid: ${errorDesc}`, {
          error_code: errorCode,
          description: errorDesc,
        });
      }
    }

    throw new TelegramError('Failed to send Telegram message', {
      error: error.message,
    });
  }
}

/**
 * Send message with error handling (non-blocking)
 * @param {string} text - Message text
 * @param {Object} options - Additional options
 */
export async function sendMessageSafe(text, options = {}) {
  try {
    await sendMessage(text, options);
  } catch (error) {
    // Log but don't throw - this is for non-critical notifications
    logger.error('Telegram', 'Failed to send message (non-blocking)', error);
  }
}

export default { initTelegramBot, sendMessage, sendMessageSafe };
