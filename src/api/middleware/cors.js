/**
 * CORS middleware configuration
 */

import cors from 'cors';
import config from '../../config/index.js';

/**
 * CORS middleware configured for dashboard access
 */
export const corsMiddleware = cors({
  origin: config.api.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

export default corsMiddleware;
