/**
 * Configuration module for DollyBot
 * Loads and validates environment variables
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Load environment variables with explicit path
dotenv.config({ path: join(projectRoot, '.env') });

/**
 * Parse comma-separated environment variable
 * @param {string} value - Comma-separated string
 * @param {Array} defaultValue - Default array if value is empty
 */
function parseArray(value, defaultValue = []) {
  if (!value || value.trim() === '') return defaultValue;
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * Validate required environment variables
 */
function validateConfig() {
  const required = ['OPENAI_API_KEY', 'TWELVE_DATA_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Validate configuration on module load
validateConfig();

/**
 * Application configuration object
 */
export const config = {
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
  },

  // Market Data Configuration
  marketData: {
    provider: 'twelvedata',
    apiKey: process.env.TWELVE_DATA_API_KEY,
    baseUrl: 'https://api.twelvedata.com',
    maxRetries: parseInt(process.env.DATA_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.DATA_RETRY_DELAY_MS || '1000', 10),
  },

  // Telegram Configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    enabled: process.env.TELEGRAM_ENABLED !== 'false',
  },

  // Scanner Configuration
  scanner: {
    // Scan interval: 120000ms (2 min) recommended for free tier rate limits
    // At 2-min intervals with 1 call/cycle = 720 calls/day (within 800 limit)
    intervalMs: parseInt(process.env.SCAN_INTERVAL_MS || '120000', 10),
    symbols: parseArray(process.env.SYMBOLS, ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD']),
    timeframes: parseArray(process.env.TIMEFRAMES, ['15m', '1h', '4h']),
    modes: ['conservative', 'aggressive'],
    candleCount: parseInt(process.env.CANDLE_COUNT || '100', 10),
  },

  // Trading Configuration
  trading: {
    confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.6'),

    // Conservative mode parameters
    conservative: {
      slAtrMultiplier: 1.3,
      slAtrMin: 1.0,
      slAtrMax: 1.8,
      tp1RMultiple: 2.0,
      tp2RMultiple: 3.0,
      minRR: 2.0,
    },

    // Aggressive mode parameters
    aggressive: {
      slAtrMultiplier: 1.0,
      slAtrMin: 0.7,
      slAtrMax: 1.3,
      slAtrMaxExtended: 2.0,
      tp1RMultiple: 1.5,
      tp2RMultiple: 2.5,
      minRR: 1.2,
    },

    // Global validation rules
    minAtrMultiplier: 0.5,
    maxAtrMultiplier: 3.0,
  },

  // Database Configuration
  database: {
    path: process.env.DB_PATH || join(projectRoot, 'data', 'dollybot.db'),
    walMode: true,
    busyTimeout: 5000,
  },

  // API Configuration
  api: {
    port: parseInt(process.env.API_PORT || '3000', 10),
    corsOrigins: parseArray(process.env.CORS_ORIGINS, ['http://localhost:3001']),
  },

  // Dashboard Configuration
  dashboard: {
    port: parseInt(process.env.DASHBOARD_PORT || '3001', 10),
  },

  // Evaluation Configuration
  evaluation: {
    intervalMs: parseInt(process.env.EVALUATION_INTERVAL_MS || '60000', 10),
    expirationCandles: parseInt(process.env.EXPIRATION_CANDLES || '20', 10),
    timeoutCandles: parseInt(process.env.TIMEOUT_CANDLES || '100', 10),
  },

  // Rate Limiter Configuration
  rateLimiter: {
    // Maximum API calls per minute (TwelveData free tier: 8)
    maxCallsPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '8', 10),
    // Maximum API calls per day (TwelveData free tier: 800)
    maxCallsPerDay: parseInt(process.env.RATE_LIMIT_PER_DAY || '800', 10),
    // Buffer to reserve before hitting hard daily limit
    dailyBuffer: parseInt(process.env.RATE_LIMIT_DAILY_BUFFER || '50', 10),
    // Maximum combinations to scan per cycle
    // Default: 1 call per cycle at 2-min intervals = 720 calls/day (within 800 limit)
    maxPerCycle: parseInt(process.env.RATE_LIMIT_MAX_PER_CYCLE || '1', 10),
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'INFO',
  },
};

export default config;
