/**
 * Database initialization and connection for DollyBot
 */

import Database from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { existsSync } from 'fs';
import config from '../config/index.js';
import { schema } from './schema.js';
import { logger } from '../utils/logger.js';
import { DatabaseError } from '../utils/errors.js';

let db = null;

/**
 * Initialize database connection and create tables
 * @returns {Database} SQLite database instance
 */
export async function initDatabase() {
  if (db) {
    return db;
  }

  try {
    const dbPath = config.database.path;
    const dbDir = dirname(dbPath);

    // Create data directory if it doesn't exist
    if (!existsSync(dbDir)) {
      await mkdir(dbDir, { recursive: true });
      logger.info('Database', `Created data directory: ${dbDir}`);
    }

    // Create database connection
    db = new Database(dbPath, {
      verbose: config.logging.level === 'DEBUG' ? console.log : null,
    });

    // Enable WAL mode for concurrent access
    if (config.database.walMode) {
      db.pragma('journal_mode = WAL');
      logger.info('Database', 'Enabled WAL mode for concurrent access');
    }

    // Set busy timeout for handling concurrent access
    db.pragma(`busy_timeout = ${config.database.busyTimeout}`);

    // Create tables and indexes
    db.exec(schema);
    logger.info('Database', `Database initialized at: ${dbPath}`);

    // Setup graceful shutdown
    process.on('SIGINT', () => closeDatabase());
    process.on('SIGTERM', () => closeDatabase());

    return db;
  } catch (error) {
    logger.error('Database', 'Failed to initialize database', error);
    throw new DatabaseError('Failed to initialize database', { error: error.message });
  }
}

/**
 * Get database instance
 * @returns {Database} SQLite database instance
 */
export function getDatabase() {
  if (!db) {
    throw new DatabaseError('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (db) {
    try {
      db.close();
      logger.info('Database', 'Database connection closed');
      db = null;
    } catch (error) {
      logger.error('Database', 'Error closing database', error);
    }
  }
}

/**
 * Execute a query with retry logic for handling SQLITE_BUSY
 * @param {Function} queryFn - Function that executes the query
 * @param {number} maxRetries - Maximum number of retries
 * @returns {*} Query result
 */
export function executeWithRetry(queryFn, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return queryFn();
    } catch (error) {
      lastError = error;

      // Check if error is SQLITE_BUSY
      if (error.code === 'SQLITE_BUSY' && i < maxRetries - 1) {
        logger.warn('Database', `Database busy, retrying... (attempt ${i + 1}/${maxRetries})`);
        // Wait a bit before retrying
        const delay = Math.min(100 * Math.pow(2, i), 1000);
        const now = Date.now();
        while (Date.now() - now < delay) {
          // Busy wait
        }
        continue;
      }

      // For other errors or max retries reached, throw
      throw new DatabaseError(`Database query failed after ${i + 1} attempts`, {
        error: error.message,
        code: error.code,
      });
    }
  }

  throw lastError;
}

export default { initDatabase, getDatabase, closeDatabase, executeWithRetry };
