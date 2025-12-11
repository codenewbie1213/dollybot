/**
 * REST API server for DollyBot
 */

import express from 'express';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import { initDatabase } from '../db/index.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import statsRoutes from './routes/stats.js';
import signalsRoutes from './routes/signals.js';

const app = express();

/**
 * Initialize API server
 */
async function initAPI() {
  try {
    // Initialize database
    await initDatabase();
    logger.info('API', 'Database initialized');

    // Middleware
    app.use(corsMiddleware);
    app.use(express.json());

    // Request logging
    app.use((req, res, next) => {
      logger.debug('API', `${req.method} ${req.path}`);
      next();
    });

    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Mount routes
    app.use('/api/stats', statsRoutes);
    app.use('/api/signals', signalsRoutes);

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ error: 'Endpoint not found' });
    });

    // Error handler (must be last)
    app.use(errorHandler);

    logger.info('API', 'API server initialized');
  } catch (error) {
    logger.error('API', 'Failed to initialize API server', error);
    throw error;
  }
}

/**
 * Start API server
 */
async function startServer() {
  await initAPI();

  const port = config.api.port;

  app.listen(port, () => {
    logger.info('API', `=== API server listening on port ${port} ===`);
    logger.info('API', `Health check: http://localhost:${port}/api/health`);
    logger.info('API', `Stats: http://localhost:${port}/api/stats/overview`);
    logger.info('API', `Signals: http://localhost:${port}/api/signals`);
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    logger.info('API', `Received ${signal}, shutting down gracefully...`);
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * Main entry point
 */
async function main() {
  try {
    logger.info('API', '=== DollyBot API Server Starting ===');
    logger.info('API', `Port: ${config.api.port}`);

    await startServer();
  } catch (error) {
    logger.error('API', 'Fatal error in API server', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('API', 'Unhandled error', error);
    process.exit(1);
  });
}

export { app, initAPI, startServer };
export default app;
