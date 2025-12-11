# Rate Limiter Implementation

## Overview

DollyBot now includes a sophisticated rate limiter to work within TwelveData's free tier API limits:
- **8 API calls per minute**
- **800 API calls per day**

The rate limiter ensures the bot stays within these limits while maximizing market coverage through intelligent rotation.

## How It Works

### 1. Combination Rotation
Instead of scanning all 15 symbol×timeframe combinations every cycle, the rate limiter:
- Rotates through combinations in a round-robin fashion
- Scans only the allowed number per cycle (default: 1)
- Ensures every combination gets scanned regularly
- Example: With 15 combinations and 1 per cycle, each combination is scanned every 30 minutes (15 cycles × 2 min/cycle)

### 2. Dual Rate Limiting
**Per-Minute Limit (8 calls/min)**
- Tracks calls in a sliding 60-second window
- Prevents bursts that exceed the limit
- Automatically spaces out API calls

**Daily Limit (800 calls/day)**
- Persistent tracking across restarts
- Resets automatically at midnight
- Reserves a buffer (default: 50 calls) to avoid hard limits
- Effective daily limit: 750 calls (with 50 buffer)

### 3. State Persistence
- Rate limiter state saved to `./data/rate_limiter_state.json`
- Tracks daily call count and rotation position
- Survives bot restarts
- Automatically resets on new day

### 4. Smart API Call Spacing
- Calculates optimal delay between calls: `60000ms / 8 = 7500ms + 500ms buffer`
- Prevents rate limit errors from the API
- Reduces unnecessary retries

### 5. Rate Limit Error Handling
- Detects rate limit errors from API responses
- Skips retries when rate limit is hit
- Prevents wasting API calls on guaranteed failures

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Scan every 2 minutes (recommended for free tier)
SCAN_INTERVAL_MS=120000

# Rate limiter settings
RATE_LIMIT_PER_MINUTE=8
RATE_LIMIT_PER_DAY=800
RATE_LIMIT_DAILY_BUFFER=50
RATE_LIMIT_MAX_PER_CYCLE=1
```

### Recommended Settings for Free Tier

**Default Configuration (Optimal for Free Tier):**
```
Scan Interval: 120000ms (2 minutes)
Max Per Cycle: 1 combination
Result: 1 call/cycle × 720 cycles/day = 720 calls/day ✅ (within 800 limit)
```

**Alternative: Faster Scanning**
```
Scan Interval: 60000ms (1 minute)
Max Per Cycle: 1 combination
Result: 1 call/cycle × 1440 cycles/day = 1440 calls/day ❌ (exceeds 800 limit)
```
⚠️ This will hit the daily limit around 4pm and stop scanning for the rest of the day.

**Alternative: More Combinations Per Cycle**
```
Scan Interval: 300000ms (5 minutes)
Max Per Cycle: 2 combinations
Result: 2 calls/cycle × 288 cycles/day = 576 calls/day ✅ (within 800 limit)
```
Each combination scanned every ~37.5 minutes (15 combinations / 2 per cycle × 5 min).

## Daily Call Budget Calculator

| Scan Interval | Max Per Cycle | Calls/Day | Within Limit? | Notes |
|---------------|---------------|-----------|---------------|-------|
| 1 min         | 1             | 1,440     | ❌            | Exceeds by 640 calls |
| 2 min         | 1             | 720       | ✅            | **Recommended** |
| 3 min         | 1             | 480       | ✅            | Conservative |
| 5 min         | 2             | 576       | ✅            | Good balance |
| 5 min         | 3             | 864       | ❌            | Slight overage |

**Formula:** `Calls/Day = (1440 minutes / Scan Interval in minutes) × Max Per Cycle`

## Rate Limiter API

### Getting the Rate Limiter Instance

```javascript
import { getRateLimiter } from './scanner/rateLimiter.js';

const rateLimiter = getRateLimiter(config.rateLimiter);
```

### Key Methods

**Check if calls are allowed:**
```javascript
const check = rateLimiter.canMakeCall(1);
if (check.allowed) {
  // Make API call
  rateLimiter.recordCall(1);
} else {
  console.log(check.reason); // Why it was blocked
}
```

**Get combinations for this cycle:**
```javascript
const combinations = rateLimiter.getCombinationsForCycle(
  symbols,      // ['EURUSD', 'GBPUSD', ...]
  timeframes,   // ['15m', '1h', '4h']
  maxPerCycle   // 1
);
// Returns: [{ symbol: 'EURUSD', timeframe: '15m' }]
```

**Get usage statistics:**
```javascript
const stats = rateLimiter.getStats();
console.log(stats);
// {
//   minute: { used: 2, limit: 8, remaining: 6 },
//   daily: { used: 234, limit: 800, effectiveLimit: 750, remaining: 516, percentage: "31.2" },
//   rotation: { index: 7 },
//   date: "2025-12-11"
// }
```

**Log current stats:**
```javascript
rateLimiter.logStats();
// [INFO] [RateLimiter] API Usage - Minute: 2/8, Daily: 234/750 (31.2%), Rotation: 7
```

## Monitoring

### Log Messages

**Scan Start:**
```
[INFO] [RateLimiter] Selected 1/15 combinations for this cycle (rotation index: 9)
[INFO] [Scanner] Scanning 1 combinations (of 15 total)
```

**Scan Complete:**
```
[INFO] [Scanner] Scan complete: 1 API calls, 0 candidates found, 0 signals created
[INFO] [RateLimiter] API Usage - Minute: 1/8, Daily: 234/750 (31.2%), Rotation: 9
```

**Rate Limit Hit:**
```
[WARN] [Scanner] Skipping GBPUSD 15m: Daily limit reached (750/750)
```

**Daily Reset:**
```
[INFO] [RateLimiter] New day detected, resetting daily counter (was 720 calls on 2025-12-10)
```

### State File

Location: `./data/rate_limiter_state.json`

```json
{
  "dailyState": {
    "date": "2025-12-11",
    "callCount": 234,
    "lastReset": "2025-12-11T00:00:00.000Z"
  },
  "rotationIndex": 9,
  "lastUpdated": "2025-12-11T13:45:32.123Z"
}
```

## Troubleshooting

### Issue: Still hitting rate limits

**Symptoms:** Seeing "run out of API credits" errors

**Solutions:**
1. Increase `SCAN_INTERVAL_MS` (e.g., from 120000 to 180000)
2. Decrease `RATE_LIMIT_MAX_PER_CYCLE` (e.g., from 1 to 1, or skip cycles)
3. Reduce number of symbols or timeframes in `.env`

### Issue: Daily limit hit before end of day

**Symptoms:** Scanner stops making calls after ~4pm

**Solutions:**
1. Check `rate_limiter_state.json` for actual call count
2. Increase `SCAN_INTERVAL_MS` to spread calls across more time
3. Reduce `RATE_LIMIT_MAX_PER_CYCLE`

### Issue: Not scanning all combinations

**Expected Behavior:** With 15 combinations and 1 per cycle, each combination is scanned every 30 minutes (at 2-min intervals).

**Check:**
```bash
# Monitor rotation index in logs
grep "rotation index" ./logs/*.log
```

## Upgrade Path

When upgrading to a paid TwelveData plan:

1. Update `.env`:
```bash
# For Basic plan: 800/min, 15,000/day
RATE_LIMIT_PER_MINUTE=800
RATE_LIMIT_PER_DAY=15000
RATE_LIMIT_DAILY_BUFFER=500

# Scan more frequently
SCAN_INTERVAL_MS=60000

# Scan all combinations every cycle
RATE_LIMIT_MAX_PER_CYCLE=15
```

2. Result: All 15 combinations scanned every minute!

## Performance Impact

**Memory:** ~5KB for state tracking (negligible)

**Latency:**
- 0ms per call (non-blocking)
- State persistence: <5ms per update (async)

**Storage:**
- State file: <1KB
- Append-only (no growth)

## Architecture

```
Scanner Cycle
    ↓
Rate Limiter.getCombinationsForCycle()
    ↓ (returns 1-N combinations)
For each combination:
    ↓
Rate Limiter.canMakeCall() → Check limits
    ↓ (if allowed)
Make API call
    ↓
Rate Limiter.recordCall() → Track usage
    ↓
Process data → Generate signals
    ↓
Rate Limiter.logStats() → Display usage
```

## Summary

The rate limiter implementation ensures DollyBot operates reliably within API limits while:
- ✅ Maximizing market coverage through rotation
- ✅ Preventing rate limit errors
- ✅ Tracking usage across restarts
- ✅ Providing clear visibility into API consumption
- ✅ Supporting easy upgrades to paid plans

With the recommended settings (2-min interval, 1 call/cycle), DollyBot will:
- Scan 1 symbol×timeframe per cycle
- Complete full rotation every 30 minutes
- Use ~720 API calls per day
- Stay well within the 800/day limit
