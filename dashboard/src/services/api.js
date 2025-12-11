import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

/**
 * Get overview statistics
 */
export async function getOverview() {
  const response = await api.get('/stats/overview');
  return response.data;
}

/**
 * Get equity curve data
 */
export async function getEquityCurve() {
  const response = await api.get('/stats/equity-curve');
  return response.data;
}

/**
 * Get performance by symbol
 */
export async function getBySymbol() {
  const response = await api.get('/stats/by-symbol');
  return response.data;
}

/**
 * Get performance by timeframe
 */
export async function getByTimeframe() {
  const response = await api.get('/stats/by-timeframe');
  return response.data;
}

/**
 * Get performance by mode
 */
export async function getByMode() {
  const response = await api.get('/stats/by-mode');
  return response.data;
}

/**
 * Get signals with filters
 */
export async function getSignals(filters = {}) {
  const params = new URLSearchParams();

  if (filters.symbol) params.append('symbol', filters.symbol);
  if (filters.timeframe) params.append('timeframe', filters.timeframe);
  if (filters.mode) params.append('mode', filters.mode);
  if (filters.status) params.append('status', filters.status);
  if (filters.outcome) params.append('outcome', filters.outcome);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);

  const response = await api.get(`/signals?${params.toString()}`);
  return response.data;
}

/**
 * Get single signal by ID
 */
export async function getSignalById(id) {
  const response = await api.get(`/signals/${id}`);
  return response.data;
}

/**
 * Health check
 */
export async function healthCheck() {
  const response = await api.get('/health');
  return response.data;
}

export default {
  getOverview,
  getEquityCurve,
  getBySymbol,
  getByTimeframe,
  getByMode,
  getSignals,
  getSignalById,
  healthCheck,
};
