You are an expert full-stack engineer and quantitative trading system architect.
Your task is to build a complete, production-ready **AI Signal Bot** with:

1. **Node.js backend service** (scanner + OpenAI engine + Telegram bot)
2. **Database** for tracking signals and outcomes
3. **Evaluation engine** for triggered trades, TP/SL hits, and performance metrics
4. **REST API** exposing signals and stats
5. **Browser dashboard** with charts + tables
6. Clean, modular, maintainable architecture
7. Easy extension later into a trade execution engine

  
============================================================
=  1. HIGH-LEVEL FUNCTIONALITY
============================================================

The system continuously scans **multiple markets** across multiple **timeframes**,
applies technical pre-filters, sends structured market data to OpenAI for full trade analysis,
stores signals in a database, evaluates trade outcomes automatically, and sends updates to Telegram.

The dashboard visualizes:
- Win rate
- Average R
- Equity curve
- Profit factor
- Performance by symbol / timeframe / mode
- Full trade history

Everything must be structured, testable, and modular.


============================================================
=  2. CORE PIPELINE OVERVIEW
============================================================

### Step 1 — Market Scanner (Node)
Runs every X minutes (default: 1 min)

For each symbol × timeframe:
- Fetch OHLCV (last 100-200 candles)
- Compute indicators:
  - EMA(50), EMA(200)
  - ATR(14)
  - RSI(14)
  - swing highs/lows
  - volatility regime classification
- Apply pre-filter logic:
  - Trend alignment
  - Engulfings
  - Pin bars
  - Pullback into structure
  - High timeframe confluence (optional flag)
  - RSI oversold/overbought in trend
  → If NOT interesting → skip
  → If interesting → candidateReason string

### Step 2 — News Scanner (optional module)
For each candidate:
- Fetch relevant macro/symbol news (API placeholder)
- Summarize top 3–5 headlines into:
  - title
  - summary
  - sentiment
  - timestamp
- Pass into OpenAI prompt for risk/context adjustments

### Step 3 — OpenAI Strategy Engine
Call OpenAI with:
- recent candles (structured OHLC)
- computed indicators
- candidateReason
- newsContext[]
- mode: "conservative" | "aggressive"

OpenAI returns strict JSON:
{
  "direction": "long" | "short" | "none",
  "entry": number | null,
  "stop_loss": number | null,
  "take_profits": [numbers],
  "confidence": number (0–1),
  "reason": "string",
  "management_hint": "string"
}

Rules inside system prompt:
- ATR-based SL distances
- R:R requirements (mode-sensitive)
- Pattern confirmation
- Higher timeframe optional logic
- News alignment / contradiction
- Return "none" if no clear trade

If confidence < threshold (default: 0.6): discard.

### Step 4 — Database Insert
Insert valid signals into DB with fields:
- symbol, timeframe, mode
- entry, stop_loss, take_profits
- confidence, reason, management_hint
- candidateReason
- status = "pending"
- created_at
- triggered_at
- outcome
- outcome_detail (JSON)
- closed_at

### Step 5 — Telegram Notification (NEW SIGNAL)
Send:
- Symbol / TF / mode
- Direction
- Entry / SL / TPs
- Confidence
- Reason summary
- Management hint
- (Optional) News summary

============================================================
=  3. TRADE LIFECYCLE MANAGEMENT
============================================================

### Pending → Triggered
A second loop checks all **pending** signals:

Triggered if:
- long: price touches entry (low <= entry <= high)
- short: price touches entry (low <= entry <= high)

When triggered:
- Update DB: status="triggered", triggered_at
- Send Telegram update: "⚡ Trade Triggered"

### Pending → Expired
If entry not hit within X candles/time threshold:
- status="expired"
- Send Telegram update: "⚪ Setup Expired"

### Triggered → Outcome (TP/SL/Timeout)
Evaluation logic:

For each triggered signal:
- Fetch candles after triggered_at
- For each candle:
  - Check if SL is hit
  - Check if any TP is hit
  - Whichever hit occurs FIRST → outcome

R-multiple calculation:
R = |entry - stop_loss|
If TP hit:
  R = (tp_n - entry) / R (long)
If SL hit:
  R = -1
If timeout (no hit after X candles):
  R = 0 or configurable

Store in DB:
- outcome: "win" | "loss" | "breakeven" | "timeout"
- outcome_detail: { hit: "tp1" or "sl", rr: number }

Send Telegram:
- TP hit → "✅"
- SL hit → "❌"
- Timeout → "⏱️"
Include R-multiple.


============================================================
=  4. DATABASE SCHEMA (SQLite or Postgres)
============================================================

Table: signals

id (PK)
symbol TEXT
timeframe TEXT
mode TEXT
direction TEXT
entry REAL
stop_loss REAL
take_profits TEXT (JSON array)
confidence REAL
reason TEXT
management_hint TEXT
candidate_reason TEXT
status TEXT ("pending", "triggered", "expired", "win", "loss", "timeout")
created_at DATETIME
triggered_at DATETIME
closed_at DATETIME
outcome TEXT
outcome_detail TEXT (JSON)


============================================================
=  5. TELEGRAM NOTIFICATIONS (ALL EVENTS)
============================================================

### A) New signal
🟢 New AI Setup  
Symbol, TF, Mode  
Direction, Entry, SL, TPs  
Confidence  
Reason  
Management hint  

### B) Triggered
⚡ Trade Triggered  
Entry filled  

### C) Expired
⚪ Setup Expired  

### D) Outcome
If TP → ✅  
If SL → ❌  
If Timeout → ⏱️  

Include final R-multiple every time.

============================================================
=  6. DASHBOARD (WEB UI)
============================================================

Tech: React or simple static HTML+JS

Backend: Express API

### API Routes
GET /api/stats/overview  
→ Returns:
{
  totalTrades,
  wins,
  losses,
  winrate,
  avgR,
  profitFactor
}

GET /api/stats/equity-curve  
→ [{ t, cumR }]

GET /api/stats/by-symbol  
→ [{ symbol, trades, winrate, avgR, profitFactor }]

GET /api/stats/by-timeframe  
→ same structure

GET /api/signals?symbol=&tf=&mode=&outcome=&limit=50&offset=0  
→ paginated signals list

### Frontend Pages

#### Dashboard Home
- Cards:
  - Total trades
  - Winrate
  - Avg R
  - Profit factor
- Equity curve chart (Chart.js line chart)
- Win/loss distribution (pie)

#### Performance Breakdown
- By symbol (bar chart + table)
- By timeframe
- By mode

#### Trade History Table
Columns:
- Date
- Symbol
- Timeframe
- Direction
- Entry / SL / TP
- Outcome
- R-multiple
- Confidence
- Expandable "reason"

Filters:
- Date range
- Symbol
- Timeframe
- Outcome
- Mode

============================================================
=  7. SYSTEM PROMPT FOR OPENAI ENGINE
============================================================

The system prompt must include:

- Candle-pattern logic:
  - Engulfings
  - Pin bars
  - Inside bars
  - Multi-candle reversals
- Structure logic:
  - Trend (HH/HL, LH/LL)
  - HTF confluence (optional)
  - S/R zones
- ATR rules:
  - SL ≈ 1.0–1.5 ATR (mode-dependent)
  - TP based on 1.5–3R (mode-dependent)
  - Reject trades when SL too tight or too wide
- Mode rules:
  - Conservative = higher-quality setups, higher confidence threshold, larger confluence requirements
  - Aggressive = allows cleaner counter-trend or volatility setups
- News rules (optional):
  - If news supports trade → allow slightly higher confidence
  - If news contradicts → reduce confidence OR return none
  - If major high-impact news is imminent → favor no trade
- Output must ALWAYS be valid JSON.

============================================================
=  8. CODE REQUIREMENTS
============================================================

- Use ES modules (import/export)
- Node 18+
- Clean modular folder structure:
  /scanner  
  /indicators  
  /openai  
  /db  
  /telegram  
  /evaluation  
  /api  
  /dashboard  
- Use async/await cleanly
- Full error handling for:
  - API failures
  - OpenAI failures
  - DB corruption
- Logging with timestamps
- Environment variables:
  - OPENAI_API_KEY
  - TELEGRAM_BOT_TOKEN
  - TELEGRAM_CHAT_ID
  - DATA_API_KEY (optional for market data)
  - PORT
  - DASHBOARD_PORT


============================================================
=  9. DELIVERABLES
============================================================

Produce:

1. **Complete Node.js source code**, including:
   - scanner loop
   - evaluation loop
   - OpenAI integration
   - DB models + migrations
   - Telegram module
   - REST API server
   - Dashboard frontend code

2. **System prompt** for OpenAI (detailed instructions for strategy).

3. **Instructions**:
   - How to install dependencies
   - How to run the scanner
   - How to run the dashboard server
   - How to configure environment variables

4. **Future extension stubs**:
   - Execution engine placeholder
   - Portfolio risk module placeholder

Ensure code is production-ready, readable, and modular.
Return everything in clean folder structure with explanations.


============================================================
=  END OF SPEC
============================================================

