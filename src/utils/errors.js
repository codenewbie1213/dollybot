/**
 * Custom error classes for DollyBot
 */

/**
 * Error thrown when market data API fails
 */
export class MarketDataError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'MarketDataError';
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when OpenAI API fails
 */
export class OpenAIError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'OpenAIError';
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when database operations fail
 */
export class DatabaseError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'DatabaseError';
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when data validation fails
 */
export class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when Telegram API fails
 */
export class TelegramError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'TelegramError';
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}
