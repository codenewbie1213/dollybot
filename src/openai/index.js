/**
 * OpenAI strategy engine - main analysis module
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import { OpenAIError } from '../utils/errors.js';
import { callOpenAI } from './client.js';
import { validateAndThrow } from './validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Cache system prompt
let systemPromptCache = null;

/**
 * Load system prompt from file
 * @returns {Promise<string>} System prompt text
 */
async function loadSystemPrompt() {
  if (systemPromptCache) {
    return systemPromptCache;
  }

  try {
    const promptPath = join(projectRoot, 'system_prompt.md');
    systemPromptCache = await readFile(promptPath, 'utf-8');
    logger.info('OpenAI', `Loaded system prompt from: ${promptPath}`);
    return systemPromptCache;
  } catch (error) {
    logger.error('OpenAI', 'Failed to load system prompt', error);
    throw new OpenAIError('Failed to load system prompt file', { error: error.message });
  }
}

/**
 * Analyze trading setup and generate trade parameters
 * @param {string} symbol - Trading symbol
 * @param {string} timeframe - Timeframe
 * @param {string} mode - Trading mode ('conservative' or 'aggressive')
 * @param {Array<Object>} candles - Array of OHLC candles
 * @param {Object} indicators - Computed indicators
 * @param {string} candidateReason - Pre-filter reason
 * @param {Array<Object>} news - News items (optional)
 * @returns {Promise<Object|null>} Trade signal or null if direction is "none"
 */
export async function analyzeSetup(
  symbol,
  timeframe,
  mode,
  candles,
  indicators,
  candidateReason,
  news = []
) {
  try {
    logger.info('OpenAI', `Analyzing setup: ${symbol} ${timeframe} ${mode}`);
    logger.debug('OpenAI', `Candidate reason: ${candidateReason}`);

    // Load system prompt
    const systemPrompt = await loadSystemPrompt();

    // Prepare user message JSON
    const userMessage = constructUserMessage(
      symbol,
      timeframe,
      mode,
      candles,
      indicators,
      candidateReason,
      news
    );

    logger.debug('OpenAI', `User message size: ${userMessage.length} characters`);

    // Call OpenAI API
    const response = await callOpenAI(systemPrompt, userMessage);

    // Validate response
    validateAndThrow(response, symbol, mode, indicators.atr14);

    // Check if direction is "none"
    if (response.direction === 'none') {
      logger.info('OpenAI', `No trade recommended: ${response.reason}`);
      return null;
    }

    // Return validated trade signal
    logger.info('OpenAI', `Trade signal generated: ${response.direction.toUpperCase()} at ${response.entry}, confidence ${response.confidence}`);

    return {
      direction: response.direction,
      entry: response.entry,
      stop_loss: response.stop_loss,
      take_profits: response.take_profits,
      confidence: response.confidence,
      reason: response.reason,
      management_hint: response.management_hint,
    };
  } catch (error) {
    logger.error('OpenAI', `Analysis failed for ${symbol} ${timeframe} ${mode}`, error);
    throw error;
  }
}

/**
 * Construct user message JSON for OpenAI
 * @param {string} symbol - Symbol
 * @param {string} timeframe - Timeframe
 * @param {string} mode - Mode
 * @param {Array<Object>} candles - Candles
 * @param {Object} indicators - Indicators
 * @param {string} candidateReason - Candidate reason
 * @param {Array<Object>} news - News items
 * @returns {string} JSON string for user message
 */
function constructUserMessage(
  symbol,
  timeframe,
  mode,
  candles,
  indicators,
  candidateReason,
  news
) {
  // Take last 50 candles to reduce token usage
  const recentCandles = candles.slice(-50);

  // Simplify candles for API (remove volume if not needed)
  const simplifiedCandles = recentCandles.map(c => ({
    time: c.time,
    open: roundPrice(c.open),
    high: roundPrice(c.high),
    low: roundPrice(c.low),
    close: roundPrice(c.close),
  }));

  // Construct simplified swing data
  const swings = {
    swingHighs: indicators.swings.swingHighs.slice(-5).map(s => ({
      price: roundPrice(s.price),
      time: s.time,
    })),
    swingLows: indicators.swings.swingLows.slice(-5).map(s => ({
      price: roundPrice(s.price),
      time: s.time,
    })),
    srLevels: indicators.swings.srLevels.slice(0, 10).map(sr => ({
      price: roundPrice(sr.price),
      type: sr.type,
      touches: sr.touches,
    })),
  };

  // Construct message object
  const messageObj = {
    symbol,
    timeframe,
    mode,
    candidate_reason: candidateReason,
    candles: simplifiedCandles,
    indicators: {
      ema50: roundPrice(indicators.ema50),
      ema200: roundPrice(indicators.ema200),
      atr14: roundPrice(indicators.atr14),
      rsi14: Math.round(indicators.rsi14 * 10) / 10,
      swings,
    },
    news: news || [],
  };

  return JSON.stringify(messageObj);
}

/**
 * Round price to appropriate decimal places
 * @param {number} price - Price to round
 * @returns {number} Rounded price
 */
function roundPrice(price) {
  if (!price || isNaN(price)) return null;

  // For prices < 10 (forex pairs), use 5 decimals
  if (price < 10) {
    return Math.round(price * 100000) / 100000;
  }

  // For prices 10-1000, use 2 decimals
  if (price < 1000) {
    return Math.round(price * 100) / 100;
  }

  // For prices >= 1000, use whole numbers
  return Math.round(price);
}

export default { analyzeSetup };
