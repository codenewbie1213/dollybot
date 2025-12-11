/**
 * Structured logging utility for DollyBot
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class Logger {
  constructor(logLevel = 'INFO') {
    this.currentLevel = LOG_LEVELS[logLevel.toUpperCase()] ?? LOG_LEVELS.INFO;
  }

  /**
   * Format timestamp in ISO format with local timezone
   */
  formatTimestamp() {
    return new Date().toISOString().replace('T', ' ').split('.')[0];
  }

  /**
   * Format log message
   * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
   * @param {string} module - Module name
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  formatMessage(level, module, message, data = null) {
    const timestamp = this.formatTimestamp();
    let formatted = `[${timestamp}] [${level}] [${module}] ${message}`;

    if (data) {
      // Pretty print JSON data
      formatted += `\n${JSON.stringify(data, null, 2)}`;
    }

    return formatted;
  }

  /**
   * Log debug message
   */
  debug(module, message, data) {
    if (this.currentLevel <= LOG_LEVELS.DEBUG) {
      console.log(this.formatMessage('DEBUG', module, message, data));
    }
  }

  /**
   * Log info message
   */
  info(module, message, data) {
    if (this.currentLevel <= LOG_LEVELS.INFO) {
      console.log(this.formatMessage('INFO', module, message, data));
    }
  }

  /**
   * Log warning message
   */
  warn(module, message, data) {
    if (this.currentLevel <= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', module, message, data));
    }
  }

  /**
   * Log error message
   */
  error(module, message, error) {
    if (this.currentLevel <= LOG_LEVELS.ERROR) {
      const errorData = error ? {
        message: error.message,
        stack: error.stack,
        ...(error.details || {}),
      } : null;

      console.error(this.formatMessage('ERROR', module, message, errorData));
    }
  }
}

// Create singleton instance
const logLevel = process.env.LOG_LEVEL || 'INFO';
export const logger = new Logger(logLevel);

export default logger;
