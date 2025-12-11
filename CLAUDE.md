# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DollyBot is an AI-powered trading signal bot that combines technical analysis with OpenAI-driven strategy decisions. The system:
- Scans multiple markets across timeframes
- Applies technical pre-filters (EMAs, ATR, RSI, candle patterns)
- Uses OpenAI for complete trade analysis
- Evaluates trade outcomes automatically
- Sends real-time updates via Telegram
- Provides a web dashboard for performance visualization

## Architecture

The system consists of multiple independent loops and modules:

### Core Modules

**Scanner Module** (`/scanner`)
- Runs every 1 minute (configurable)
- Fetches OHLCV data for each symbol×timeframe combination
- Computes technical indicators (EMA50, EMA200, ATR14, RSI14, swing highs/lows)
- Applies pre-filter logic to identify candidate setups
- Only passes interesting candidates to the OpenAI engine

**Indicators Module** (`/indicators`)
- Pure calculation functions for technical indicators
- Must be stateless and testable
- Returns structured data for EMAs, ATR, RSI, swing highs/lows, S/R levels

**OpenAI Strategy Engine** (`/openai`)
- Receives structured market data from scanner
- Calls OpenAI with the system prompt from `system_prompt.md`
- Expects strict JSON response with trade parameters
- Validates output format and confidence thresholds
- Returns: direction, entry, stop_loss, take_profits[], confidence, reason, management_hint

**Evaluation Loop** (`/evaluation`)
- Separate process that monitors pending and triggered signals
- Updates signal status: pending → triggered → outcome (win/loss/timeout)
- Checks entry hits, TP hits, SL hits on each new candle
- Calculates R-multiples for closed trades
- Stores outcome_detail as JSON

**Database Module** (`/db`)
- Single table: `signals`
- Key fields: symbol, timeframe, mode, direction, entry, stop_loss, take_profits (JSON), confidence, status, created_at, triggered_at, closed_at, outcome, outcome_detail (JSON)
- Status values: "pending", "triggered", "expired", "win", "loss", "timeout"

**Telegram Module** (`/telegram`)
- Sends formatted notifications for all lifecycle events:
  - New signal: 🟢
  - Triggered: ⚡
  - Expired: ⚪
  - TP hit: ✅
  - SL hit: ❌
  - Timeout: ⏱️

**REST API** (`/api`)
- Express server exposing endpoints:
  - `GET /api/stats/overview` - total trades, winrate, avgR, profit factor
  - `GET /api/stats/equity-curve` - time series of cumulative R
  - `GET /api/stats/by-symbol` - performance breakdown by symbol
  - `GET /api/stats/by-timeframe` - performance breakdown by timeframe
  - `GET /api/signals?symbol=&tf=&mode=&outcome=&limit=&offset=` - paginated signals

**Dashboard** (`/dashboard`)
- Frontend visualization with charts (Chart.js)
- Performance cards, equity curve, win/loss distribution
- Trade history table with filters
- Breakdown views by symbol, timeframe, mode

## Trading Logic

### Modes

**Conservative Mode**
- Fewer, higher-quality trades
- Requires clear trend alignment (price above/below EMAs, HH/HL structure)
- SL distance: ~1.3 ATR (range: 1.0-1.8 ATR)
- Target R:R ≥ 1:2 on first TP
- TP1 at ~2R, TP2 at ~3R
- High no-trade bias

**Aggressive Mode**
- More opportunities, less strict
- Allows counter-trend reversals at strong levels
- SL distance: ~1.0 ATR (range: 0.7-1.3 ATR, up to 2.0 ATR if justified)
- TP1 at ~1.5R (can accept ~1.2R if pattern is strong)
- TP2 at ~2.5R
- Lower no-trade bias but still avoids messy markets

### Signal Lifecycle

1. **Scanner identifies candidate** → pre-filter logic generates `candidate_reason`
2. **OpenAI analyzes** → returns trade parameters or "none"
3. **DB insert** → status = "pending"
4. **Telegram notification** → new signal details
5. **Evaluation checks pending** → watches for entry hit
   - If entry hit → status = "triggered" + Telegram update
   - If X candles pass without hit → status = "expired" + Telegram update
6. **Evaluation checks triggered** → watches for TP/SL hit
   - First hit determines outcome
   - Calculate R-multiple
   - Update status + outcome_detail
   - Send final Telegram update

### R-Multiple Calculation

```
R = |entry - stop_loss|
If TP hit:
  R_multiple = (tp_price - entry) / R  (for longs)
  R_multiple = (entry - tp_price) / R  (for shorts)
If SL hit:
  R_multiple = -1
If timeout:
  R_multiple = 0 (or configurable)
```

## Development Commands

### Setup
```bash
npm install
```

### Environment Variables
Create a `.env` file with:
```
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
DATA_API_KEY=...  # optional for market data provider
PORT=3000
DASHBOARD_PORT=3001
```

### Running Components
```bash
# Run the scanner loop
node src/scanner/index.js

# Run the evaluation loop
node src/evaluation/index.js

# Run the API server
node src/api/index.js

# Run the dashboard dev server
cd dashboard && npm run dev
```

### Testing
```bash
# Run all tests
npm test

# Run specific test file
npm test -- indicators.test.js

# Run tests in watch mode
npm test -- --watch
```

## Key Implementation Requirements

### Code Style
- Use ES modules (import/export)
- Node 18+
- Async/await for all async operations
- Full error handling for API failures, OpenAI failures, DB issues
- Structured logging with timestamps

### OpenAI Integration
- System prompt must be loaded from `system_prompt.md`
- User message is a single JSON string containing: symbol, timeframe, mode, candidate_reason, candles[], indicators{}, news[]
- Response must be validated as strict JSON
- Confidence threshold check (default: 0.6)
- Handle rate limits and retries

### Database
- Use SQLite for development, Postgres for production
- take_profits and outcome_detail stored as JSON TEXT
- All timestamps as DATETIME
- Index on: status, symbol, timeframe, created_at

### Signal Expiration
- Configurable expiration threshold (e.g., 20 candles without entry hit)
- Separate from trade timeout (triggered but no TP/SL hit)

### News Module (Optional)
- Placeholder for future news API integration
- Should fetch recent headlines for symbol
- Format: [{title, summary, publishedAt, source, sentiment}]

## Critical Technical Details

### ATR-Based Stop Loss
- Conservative: SL ~1.3 ATR (acceptable: 1.0-1.8 ATR)
- Aggressive: SL ~1.0 ATR (acceptable: 0.7-1.3 ATR)
- Reject trades with SL < 0.5 ATR or > 3.0 ATR

### Candle Pattern Recognition
- Engulfing: body must fully engulf prior body
- Pin bar: long wick (≥2x body), small body at opposite end
- Location matters: patterns must occur at meaningful S/R levels

### Structure Recognition
- Uptrend: price > EMA50, EMA50 > EMA200, HH/HL structure
- Downtrend: price < EMA50, EMA50 < EMA200, LH/LL structure
- Choppy: flat EMAs, price whipsaws, unclear swing structure

### Entry Timing
- Long: entry near/above signal candle high
- Short: entry near/below signal candle low
- Reject if price already moved >1R beyond pattern area (late entry)

## Extension Stubs

### Execution Engine (Future)
- Placeholder module for actual trade execution
- Would integrate with broker APIs
- Position sizing and portfolio risk management

### Portfolio Risk Module (Future)
- Max open positions
- Correlation checks between symbols
- Overall portfolio heat limits
- Per-symbol exposure limits

## Specification Documents

The full specification is in `prompt.md` (overall system design) and `system_prompt.md` (OpenAI strategy logic). These documents are the source of truth for all trading logic and system behavior.
