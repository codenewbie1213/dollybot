/**
 * Message formatters for Telegram notifications
 */

/**
 * Format new signal notification
 * @param {Object} signal - Signal object with all trade details
 * @returns {string} Formatted message
 */
export function formatNewSignal(signal) {
  const { symbol, timeframe, mode, direction, entry, stop_loss, take_profits, confidence, reason, management_hint, candidate_reason } = signal;

  const directionEmoji = direction === 'long' ? '📈' : '📉';
  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);

  // Calculate SL distance
  const slDistance = Math.abs(entry - stop_loss);
  const slPips = formatDistance(slDistance, entry);

  // Format TPs with R-multiples
  const R = slDistance;
  const tpLines = take_profits.map((tp, i) => {
    const rMultiple = Math.abs(tp - entry) / R;
    const tpDistance = formatDistance(Math.abs(tp - entry), entry);
    return `  TP${i + 1}: ${formatPrice(tp)} (${rMultiple.toFixed(1)}R / ${tpDistance})`;
  }).join('\n');

  let message = `🟢 *New AI Setup*

*Symbol:* ${symbol}
*Timeframe:* ${timeframe}
*Mode:* ${modeLabel}
*Direction:* ${direction.toUpperCase()} ${directionEmoji}

*Entry:* ${formatPrice(entry)}
*Stop Loss:* ${formatPrice(stop_loss)} (${slPips})
*Take Profits:*
${tpLines}

*Confidence:* ${Math.round(confidence * 100)}%

*Setup:* ${candidate_reason}

*Analysis:* ${reason}`;

  if (management_hint && management_hint.trim()) {
    message += `\n\n*Management:* ${management_hint}`;
  }

  return message;
}

/**
 * Format triggered notification
 * @param {Object} signal - Signal object
 * @returns {string} Formatted message
 */
export function formatTriggered(signal) {
  const { symbol, direction, entry, timeframe } = signal;
  const directionEmoji = direction === 'long' ? '📈' : '📉';

  return `⚡ *Trade Triggered*

*Symbol:* ${symbol} (${timeframe})
*Direction:* ${direction.toUpperCase()} ${directionEmoji}
*Entry:* ${formatPrice(entry)} filled

Trade is now active and being monitored.`;
}

/**
 * Format expired notification
 * @param {Object} signal - Signal object
 * @returns {string} Formatted message
 */
export function formatExpired(signal) {
  const { symbol, direction, entry, timeframe } = signal;

  return `⚪ *Setup Expired*

*Symbol:* ${symbol} (${timeframe})
*Direction:* ${direction.toUpperCase()}
*Entry:* ${formatPrice(entry)} was not hit

Price did not reach entry level within expiration threshold.`;
}

/**
 * Format outcome notification
 * @param {Object} signal - Signal object with outcome
 * @param {Object} outcomeDetail - Outcome detail with hit type and R-multiple
 * @returns {string} Formatted message
 */
export function formatOutcome(signal, outcomeDetail) {
  const { symbol, direction, entry, stop_loss, take_profits, timeframe, outcome } = signal;
  const { hit, rr, hitPrice } = outcomeDetail;

  let emoji, title, resultText;

  if (outcome === 'win') {
    emoji = '✅';
    title = 'Trade Won';

    // Determine which TP was hit
    if (hit.startsWith('tp')) {
      const tpIndex = parseInt(hit.replace('tp', ''), 10);
      resultText = `${hit.toUpperCase()} Hit`;
    } else {
      resultText = 'Target Hit';
    }
  } else if (outcome === 'loss') {
    emoji = '❌';
    title = 'Stop Loss Hit';
    resultText = 'SL Hit';
  } else if (outcome === 'timeout') {
    emoji = '⏱️';
    title = 'Trade Timeout';
    resultText = 'No TP/SL Hit';
  } else {
    emoji = '⚫';
    title = 'Trade Closed';
    resultText = outcome;
  }

  const directionEmoji = direction === 'long' ? '📈' : '📉';
  const entryExitDistance = Math.abs(hitPrice - entry);
  const distanceFormatted = formatDistance(entryExitDistance, entry);

  let message = `${emoji} *${title}*

*Symbol:* ${symbol} (${timeframe})
*Direction:* ${direction.toUpperCase()} ${directionEmoji}
*Entry:* ${formatPrice(entry)}
*Exit:* ${formatPrice(hitPrice)} (${resultText})
*R-Multiple:* ${rr >= 0 ? '+' : ''}${rr.toFixed(2)}R

*Profit/Loss:* ${distanceFormatted}`;

  // Add summary for wins/losses
  if (outcome === 'win') {
    message += `\n\n💰 Profitable trade closed successfully.`;
  } else if (outcome === 'loss') {
    message += `\n\n⚠️ Stop loss protected capital. Move on to next opportunity.`;
  } else if (outcome === 'timeout') {
    message += `\n\n⏱️ Trade timed out without hitting TP or SL.`;
  }

  return message;
}

/**
 * Format price based on magnitude
 * @param {number} price - Price to format
 * @returns {string} Formatted price
 */
function formatPrice(price) {
  if (!price || isNaN(price)) return 'N/A';

  if (price < 10) {
    return price.toFixed(5);
  } else if (price < 1000) {
    return price.toFixed(2);
  } else {
    return price.toFixed(0);
  }
}

/**
 * Format distance (for SL/TP distances)
 * @param {number} distance - Distance value
 * @param {number} referencePrice - Reference price for determining format
 * @returns {string} Formatted distance
 */
function formatDistance(distance, referencePrice) {
  if (!distance || isNaN(distance)) return 'N/A';

  // For forex (reference < 10), show as pips
  if (referencePrice < 10) {
    const pips = distance * 10000;
    return `${pips.toFixed(1)} pips`;
  }

  // For other assets, show as points/dollars
  if (referencePrice < 1000) {
    return `${distance.toFixed(2)} pts`;
  }

  return `${distance.toFixed(0)} pts`;
}

export default {
  formatNewSignal,
  formatTriggered,
  formatExpired,
  formatOutcome,
};
