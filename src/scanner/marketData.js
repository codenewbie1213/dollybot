/**
 * Market data integration with Twelve Data API
 */

import axios from 'axios';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import { MarketDataError } from '../utils/errors.js';

// Timeframe mapping from our format to Twelve Data API format
const TIMEFRAME_MAP = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '1d': '1day',
  '1w': '1week',
  '1M': '1month',
};

/**
 * Convert internal symbol format to TwelveData API format
 * Examples:
 * - EURUSD → EUR/USD
 * - BTCUSD → BTC/USD
 * - XAUUSD → XAU/USD
 * @param {string} symbol - Internal symbol format
 * @returns {string} TwelveData API format
 */
function formatSymbolForAPI(symbol) {
  // If already has slash, return as-is
  if (symbol.includes('/')) {
    return symbol;
  }

  // Common forex pairs (6 characters)
  if (symbol.length === 6) {
    const base = symbol.substring(0, 3);
    const quote = symbol.substring(3, 6);
    return `${base}/${quote}`;
  }

  // Commodities and crypto (XAU/USD, BTC/USD, etc.)
  // Assume last 3 characters are quote currency (usually USD)
  if (symbol.length > 6) {
    const base = symbol.substring(0, symbol.length - 3);
    const quote = symbol.substring(symbol.length - 3);
    return `${base}/${quote}`;
  }

  // Fallback: return as-is
  logger.warn('MarketData', `Unknown symbol format: ${symbol}, using as-is`);
  return symbol;
}

/**
 * Fetch OHLCV candle data from Twelve Data API
 * @param {string} symbol - Trading symbol (e.g., 'EURUSD', 'BTCUSD')
 * @param {string} timeframe - Timeframe (e.g., '15m', '1h', '4h')
 * @param {number} count - Number of candles to fetch (default: 100)
 * @returns {Promise<Array<Object>>} Array of candles {time, open, high, low, close, volume}
 */
export async function fetchCandles(symbol, timeframe, count = 100) {
  const apiInterval = TIMEFRAME_MAP[timeframe];

  if (!apiInterval) {
    throw new MarketDataError(`Invalid timeframe: ${timeframe}`, { symbol, timeframe });
  }

  // Convert symbol to TwelveData API format
  const apiSymbol = formatSymbolForAPI(symbol);

  const url = `${config.marketData.baseUrl}/time_series`;
  const params = {
    symbol: apiSymbol,
    interval: apiInterval,
    outputsize: count,
    apikey: config.marketData.apiKey,
    format: 'JSON',
  };

  let lastError;

  for (let attempt = 1; attempt <= config.marketData.maxRetries; attempt++) {
    try {
      logger.debug('MarketData', `Fetching ${count} candles for ${symbol} (${apiSymbol}) ${timeframe} (attempt ${attempt})`);

      const response = await axios.get(url, {
        params,
        timeout: 10000, // 10 second timeout
      });

      // Check for API errors
      if (response.data.status === 'error') {
        const errorMsg = response.data.message || 'API returned error';

        // Check if it's a rate limit error - don't retry these
        if (errorMsg.includes('run out of API credits') || errorMsg.includes('rate limit')) {
          throw new MarketDataError(errorMsg, {
            symbol,
            timeframe,
            code: response.data.code,
            isRateLimit: true,
          });
        }

        throw new MarketDataError(errorMsg, {
          symbol,
          timeframe,
          code: response.data.code,
        });
      }

      // Check if we have data
      if (!response.data.values || !Array.isArray(response.data.values)) {
        throw new MarketDataError('No data returned from API', { symbol, timeframe });
      }

      // Parse and transform candles
      const candles = response.data.values.map(candle => ({
        time: candle.datetime,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume || 0),
      }));

      // Twelve Data returns newest first, reverse to oldest first
      candles.reverse();

      // Validate data
      if (candles.length < 50) {
        throw new MarketDataError(`Insufficient data: only ${candles.length} candles returned`, {
          symbol,
          timeframe,
          count: candles.length,
        });
      }

      // Validate candle data quality
      validateCandles(candles, symbol, timeframe);

      logger.info('MarketData', `Fetched ${candles.length} candles for ${symbol} (${apiSymbol}) ${timeframe}`);

      return candles;
    } catch (error) {
      lastError = error;

      if (error instanceof MarketDataError) {
        // Already a MarketDataError, just log and potentially retry
        logger.warn('MarketData', `Fetch failed for ${symbol} ${timeframe}: ${error.message}`);

        // If it's a rate limit error, don't retry
        if (error.context?.isRateLimit) {
          logger.warn('MarketData', 'Rate limit detected, skipping retries');
          break; // Exit retry loop immediately
        }
      } else if (axios.isAxiosError(error)) {
        // Network or HTTP error
        const message = error.response?.data?.message || error.message;
        logger.warn('MarketData', `HTTP error for ${symbol} ${timeframe}: ${message}`);

        // Check for rate limit (429)
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
          logger.warn('MarketData', `Rate limit hit, retry after ${retryAfter}s`);

          if (attempt < config.marketData.maxRetries) {
            await sleep(retryAfter * 1000);
            continue;
          }
        }
      } else {
        // Unknown error
        logger.error('MarketData', `Unexpected error for ${symbol} ${timeframe}`, error);
      }

      // Exponential backoff before retry
      if (attempt < config.marketData.maxRetries) {
        const delayMs = config.marketData.retryDelayMs * Math.pow(2, attempt - 1);
        logger.debug('MarketData', `Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }

  // All retries failed
  throw new MarketDataError(
    `Failed to fetch data after ${config.marketData.maxRetries} attempts`,
    {
      symbol,
      timeframe,
      lastError: lastError.message,
    }
  );
}

/**
 * Validate candle data quality
 * @param {Array<Object>} candles - Array of candles
 * @param {string} symbol - Symbol for error reporting
 * @param {string} timeframe - Timeframe for error reporting
 */
function validateCandles(candles, symbol, timeframe) {
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    // Check for zero or negative prices
    if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0) {
      throw new MarketDataError('Invalid candle data: zero or negative prices', {
        symbol,
        timeframe,
        index: i,
        candle,
      });
    }

    // Check OHLC relationship
    if (candle.high < candle.low) {
      throw new MarketDataError('Invalid candle data: high < low', {
        symbol,
        timeframe,
        index: i,
        candle,
      });
    }

    if (candle.high < candle.open || candle.high < candle.close) {
      throw new MarketDataError('Invalid candle data: high is not the highest', {
        symbol,
        timeframe,
        index: i,
        candle,
      });
    }

    if (candle.low > candle.open || candle.low > candle.close) {
      throw new MarketDataError('Invalid candle data: low is not the lowest', {
        symbol,
        timeframe,
        index: i,
        candle,
      });
    }

    // Check for NaN
    if (
      isNaN(candle.open) ||
      isNaN(candle.high) ||
      isNaN(candle.low) ||
      isNaN(candle.close)
    ) {
      throw new MarketDataError('Invalid candle data: NaN values', {
        symbol,
        timeframe,
        index: i,
        candle,
      });
    }
  }

  logger.debug('MarketData', `Candle data validation passed for ${symbol} ${timeframe}`);
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch candles for multiple symbols in parallel with rate limiting
 * @param {Array<string>} symbols - Array of symbols
 * @param {string} timeframe - Timeframe
 * @param {number} count - Number of candles
 * @param {number} delayMs - Delay between requests (default: 8000ms for free tier)
 * @returns {Promise<Object>} Object mapping symbol to candles
 */
export async function fetchMultipleSymbols(symbols, timeframe, count = 100, delayMs = 8000) {
  const results = {};

  logger.info('MarketData', `Fetching data for ${symbols.length} symbols at ${timeframe}`);

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];

    try {
      results[symbol] = await fetchCandles(symbol, timeframe, count);

      // Add delay between requests to respect rate limits (except for last symbol)
      if (i < symbols.length - 1) {
        logger.debug('MarketData', `Waiting ${delayMs}ms before next request...`);
        await sleep(delayMs);
      }
    } catch (error) {
      logger.error('MarketData', `Failed to fetch data for ${symbol}`, error);
      results[symbol] = null; // Mark as failed but continue with other symbols
    }
  }

  const successCount = Object.values(results).filter(v => v !== null).length;
  logger.info('MarketData', `Fetched data for ${successCount}/${symbols.length} symbols`);

  return results;
}

export default { fetchCandles, fetchMultipleSymbols };
