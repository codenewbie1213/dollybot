/**
 * Database schema for DollyBot signals table
 */

export const schema = `
CREATE TABLE IF NOT EXISTS signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  mode TEXT NOT NULL,
  direction TEXT NOT NULL,
  entry REAL NOT NULL,
  stop_loss REAL NOT NULL,
  take_profits TEXT NOT NULL,
  confidence REAL NOT NULL,
  reason TEXT NOT NULL,
  management_hint TEXT,
  candidate_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  triggered_at DATETIME,
  closed_at DATETIME,
  outcome TEXT,
  outcome_detail TEXT,
  UNIQUE(symbol, timeframe, mode, created_at)
);

CREATE INDEX IF NOT EXISTS idx_status ON signals(status);
CREATE INDEX IF NOT EXISTS idx_symbol ON signals(symbol);
CREATE INDEX IF NOT EXISTS idx_timeframe ON signals(timeframe);
CREATE INDEX IF NOT EXISTS idx_created_at ON signals(created_at);
CREATE INDEX IF NOT EXISTS idx_closed_at ON signals(closed_at);
CREATE INDEX IF NOT EXISTS idx_symbol_status ON signals(symbol, status);
`;

export default schema;
