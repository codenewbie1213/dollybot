# DollyBot - AI-Powered Trading Signal Bot

DollyBot is a complete AI-powered trading signal bot that combines technical analysis with OpenAI-driven strategy decisions. The system scans multiple markets across timeframes, applies technical pre-filters, uses OpenAI for complete trade analysis, evaluates trade outcomes automatically, and provides comprehensive performance visualization.

## Features

- **Automated Market Scanning** - Scans multiple symbols across multiple timeframes every minute
- **Technical Analysis** - EMA, ATR, RSI, swing highs/lows, candle patterns (engulfing, pin bars)
- **AI-Powered Strategy** - Uses OpenAI (GPT-4) for trade analysis with strict JSON output
- **Signal Lifecycle Tracking** - Monitors signals from pending → triggered → outcome (win/loss/timeout)
- **Telegram Notifications** - Real-time updates for all signal events
- **Performance Metrics** - Win rate, average R, profit factor, equity curve
- **REST API** - Exposes stats and signal data for analysis
- **Dashboard** - Web UI for performance visualization (to be implemented)

## Architecture

The system consists of **three independent processes**:

1. **Scanner Loop** - Runs every 1 minute, scans markets, generates signals via OpenAI
2. **Evaluation Loop** - Monitors signal lifecycle, calculates outcomes and R-multiples
3. **API Server** - Exposes REST endpoints for performance data

## Trading Modes

### Conservative Mode
- Fewer, higher-quality trades
- Requires clear trend alignment (EMA structure, HH/HL)
- SL distance: ~1.3 ATR (range: 1.0-1.8 ATR)
- Target R:R ≥ 1:2 on first TP
- TP1 at ~2R, TP2 at ~3R
- HIGH no-trade bias

### Aggressive Mode
- More opportunities, less strict
- Allows counter-trend reversals at strong levels
- SL distance: ~1.0 ATR (range: 0.7-1.3 ATR, up to 2.0 ATR if justified)
- TP1 at ~1.5R (accepts ~1.2R if pattern is strong)
- TP2 at ~2.5R
- Lower no-trade bias

## Installation

### Prerequisites

- Node.js 18+
- npm or yarn
- Twelve Data API key (free tier available)
- OpenAI API key
- Telegram bot token and chat ID

### Steps

1. **Clone or download the project**
   ```bash
   cd dollybot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in your API keys:
   ```env
   # Required
   OPENAI_API_KEY=sk-your_openai_api_key_here
   TWELVE_DATA_API_KEY=your_twelve_data_api_key_here
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   TELEGRAM_CHAT_ID=your_telegram_chat_id_here

   # Optional (defaults provided)
   SCAN_INTERVAL_MS=60000
   CONFIDENCE_THRESHOLD=0.6
   SYMBOLS=EURUSD,GBPUSD,USDJPY,XAUUSD,BTCUSD
   TIMEFRAMES=15m,1h,4h
   DB_PATH=./data/dollybot.db
   API_PORT=3000
   DASHBOARD_PORT=3001
   EXPIRATION_CANDLES=20
   TIMEOUT_CANDLES=100
   LOG_LEVEL=INFO
   ```

## Getting API Keys

### Twelve Data API Key
1. Sign up at https://twelvedata.com/
2. Free tier provides 8 requests/minute, 800/day (sufficient for 5 symbols × 3 timeframes)
3. Copy your API key to `.env`

### OpenAI API Key
1. Sign up at https://platform.openai.com/
2. Create an API key in your account settings
3. Copy the key to `.env`
4. Ensure you have credits/billing set up

### Telegram Bot
1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Copy the bot token to `.env`
3. Start a chat with your bot and send any message
4. Get your chat ID by visiting: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
5. Copy the `chat.id` value to `.env`

## Usage

The system requires **three separate terminal sessions** to run all components:

### Terminal 1: Scanner Loop

```bash
npm run scanner
```

This will:
- Scan configured symbols and timeframes every minute
- Apply technical pre-filters to identify candidates
- Send interesting setups to OpenAI for analysis
- Store valid signals in database
- Send Telegram notifications for new signals

### Terminal 2: Evaluation Loop

```bash
npm run evaluation
```

This will:
- Check pending signals for entry hits or expirations
- Check triggered signals for TP/SL hits
- Calculate R-multiples for closed trades
- Update database with outcomes
- Send Telegram notifications for all lifecycle events

### Terminal 3: API Server

```bash
npm run api
```

This will:
- Start REST API server on port 3000 (configurable)
- Expose endpoints for stats and signal data
- Enable CORS for dashboard access

### Optional: Dashboard (To Be Implemented)

```bash
npm run dev:dashboard
```

## API Endpoints

### Health Check
```
GET /api/health
```

### Statistics
```
GET /api/stats/overview
GET /api/stats/equity-curve
GET /api/stats/by-symbol
GET /api/stats/by-timeframe
GET /api/stats/by-mode
```

### Signals
```
GET /api/signals?symbol=&timeframe=&mode=&outcome=&limit=50&offset=0
GET /api/signals/:id
```

## Signal Lifecycle

1. **Scanner detects candidate** → Pre-filter generates candidate_reason
2. **OpenAI analyzes** → Returns trade parameters or "none"
3. **DB insert** → status = "pending", Telegram notification sent
4. **Entry hit?** → status = "triggered", Telegram notification
5. **Entry not hit after X candles?** → status = "expired", Telegram notification
6. **TP/SL hit?** → Calculate R-multiple, status = "win"/"loss"/"timeout", Telegram notification

## R-Multiple Calculation

```
R = |entry - stop_loss|

If TP hit:
  R_multiple = (tp_price - entry) / R  [for longs]
  R_multiple = (entry - tp_price) / R  [for shorts]

If SL hit:
  R_multiple = -1

If timeout:
  R_multiple = 0
```

## Project Structure

```
dollybot/
├── src/
│   ├── config/          # Configuration loader
│   ├── db/              # Database (SQLite)
│   ├── indicators/      # Technical indicators (EMA, ATR, RSI, swings, patterns)
│   ├── scanner/         # Market scanner + pre-filters
│   ├── openai/          # OpenAI strategy engine
│   ├── telegram/        # Telegram notifications
│   ├── evaluation/      # Signal lifecycle tracking
│   ├── api/             # REST API server
│   └── utils/           # Logger, error classes
├── tests/               # Unit tests (to be implemented)
├── dashboard/           # React dashboard (to be implemented)
├── data/                # SQLite database (created automatically)
├── system_prompt.md     # OpenAI strategy prompt
├── CLAUDE.md            # Project guidance
├── prompt.md            # Original specification
├── package.json
├── .env.example
└── README.md
```

## Database Schema

The system uses SQLite with a single `signals` table:

```sql
CREATE TABLE signals (
  id INTEGER PRIMARY KEY,
  symbol TEXT,
  timeframe TEXT,
  mode TEXT,
  direction TEXT,
  entry REAL,
  stop_loss REAL,
  take_profits TEXT,      -- JSON array
  confidence REAL,
  reason TEXT,
  management_hint TEXT,
  candidate_reason TEXT,
  status TEXT,            -- pending/triggered/expired/win/loss/timeout
  created_at DATETIME,
  triggered_at DATETIME,
  closed_at DATETIME,
  outcome TEXT,
  outcome_detail TEXT     -- JSON
);
```

## Configuration Options

### Scanner Settings
- `SCAN_INTERVAL_MS` - How often to scan markets (default: 60000 = 1 minute)
- `SYMBOLS` - Comma-separated list of symbols to scan
- `TIMEFRAMES` - Comma-separated list of timeframes (e.g., "15m,1h,4h")
- `CONFIDENCE_THRESHOLD` - Minimum confidence to accept signal (default: 0.6)

### Evaluation Settings
- `EXPIRATION_CANDLES` - Candles before pending signal expires (default: 20)
- `TIMEOUT_CANDLES` - Candles before triggered signal times out (default: 100)

### Trading Parameters
Defined in `src/config/index.js`:
- Conservative: SL ~1.3 ATR, TP1 ~2R, TP2 ~3R
- Aggressive: SL ~1.0 ATR, TP1 ~1.5R, TP2 ~2.5R

## Troubleshooting

### Scanner Issues

**Problem**: "Missing required environment variables"
- **Solution**: Check that all required variables in `.env` are set

**Problem**: "Failed to fetch data from Twelve Data"
- **Solution**:
  - Verify API key is correct
  - Check if you've exceeded rate limits (free tier: 8 req/min)
  - Try increasing delays between requests in config

**Problem**: "OpenAI API call failed"
- **Solution**:
  - Verify API key is correct
  - Check if you have available credits
  - Check rate limits for your tier

### Evaluation Issues

**Problem**: Signals not triggering
- **Solution**:
  - Ensure evaluation loop is running
  - Check if price actually hit entry level
  - Review logs for errors

**Problem**: Telegram notifications not working
- **Solution**:
  - Verify bot token and chat ID are correct
  - Check if bot is blocked or chat is invalid
  - Test bot manually via Telegram

### Database Issues

**Problem**: "Database locked" errors
- **Solution**:
  - WAL mode is enabled by default for concurrent access
  - Ensure all three processes can access database file
  - Check file permissions on `data/` directory

## Performance Notes

### Rate Limits

**Twelve Data (Free Tier)**:
- 8 requests/minute
- 800 requests/day
- Scanner adds delays to respect limits
- Consider upgrading for production

**OpenAI**:
- Varies by tier
- Exponential backoff implemented for rate limits
- Monitor usage in OpenAI dashboard

**Telegram**:
- 30 messages/second limit
- Non-blocking notifications to prevent crashes

### Resource Usage

- SQLite database grows over time (typical: ~1KB per signal)
- Scanner uses ~50-100MB RAM
- Evaluation uses ~30-50MB RAM
- API server uses ~30-50MB RAM

## Extending the System

### Future Enhancements

The system is designed for easy extension:

1. **Trade Execution Engine** (`src/execution/`) - Integrate with broker APIs for automatic execution
2. **Portfolio Risk Module** (`src/portfolio/`) - Max open positions, correlation checks, portfolio heat
3. **News Integration** (`src/news/`) - Fetch and analyze news for additional context
4. **Dashboard** (`dashboard/`) - React UI with charts and tables for visualization
5. **Backtesting** - Test strategies on historical data
6. **Multiple Strategies** - Add strategy variants beyond conservative/aggressive

### Adding New Symbols

Edit `.env`:
```env
SYMBOLS=EURUSD,GBPUSD,USDJPY,XAUUSD,BTCUSD,AAPL,MSFT
```

### Adding New Timeframes

Edit `.env`:
```env
TIMEFRAMES=5m,15m,1h,4h,1d
```

Note: Ensure timeframes are supported by Twelve Data API.

### Modifying Trading Logic

Edit `system_prompt.md` to adjust:
- Pattern recognition rules
- ATR-based SL distances
- R:R targets
- News handling
- Mode-specific behavior

## Testing

Unit tests (to be implemented):
```bash
npm test
```

Test individual modules:
```bash
npm test -- indicators.test.js
```

## Security Considerations

- **Never commit `.env` file** - Contains sensitive API keys
- **Protect database file** - Contains trading history
- **Secure API server** - Consider adding authentication for production
- **Monitor API usage** - Prevent unexpected costs from API overuse

## Disclaimer

**IMPORTANT**: This is a signal bot, NOT an execution engine.

- Does NOT place real trades
- Does NOT manage real money
- Provides signals for educational/analysis purposes only
- Past performance does not guarantee future results
- Use at your own risk
- Always verify signals before trading manually

## Support

For issues or questions:
1. Check logs in console output (set `LOG_LEVEL=DEBUG` for verbose logging)
2. Review this README and documentation files
3. Check the specification files (`prompt.md`, `system_prompt.md`, `CLAUDE.md`)

## License

MIT License - See project files for details

## Credits

Built with:
- Node.js + ES modules
- SQLite (better-sqlite3)
- OpenAI API (GPT-4)
- Twelve Data API
- Telegram Bot API
- Express.js

---

**Happy Trading!** 📈📉
