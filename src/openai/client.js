/**
 * OpenAI client for trade analysis
 */

import OpenAI from 'openai';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import { OpenAIError } from '../utils/errors.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
});

/**
 * Call OpenAI API with retry logic
 * @param {string} systemPrompt - System prompt instructions
 * @param {string} userMessage - User message (JSON string)
 * @returns {Promise<Object>} Parsed JSON response
 */
export async function callOpenAI(systemPrompt, userMessage) {
  let lastError;

  for (let attempt = 1; attempt <= config.openai.maxRetries; attempt++) {
    try {
      logger.debug('OpenAI', `Calling API (attempt ${attempt}/${config.openai.maxRetries})`);

      const response = await openai.chat.completions.create({
        model: config.openai.model,
        temperature: config.openai.temperature,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
      });

      // Extract response content
      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new OpenAIError('Empty response from OpenAI', {
          response: JSON.stringify(response),
        });
      }

      // Parse JSON
      const parsedResponse = JSON.parse(content);

      logger.debug('OpenAI', 'API call successful', {
        direction: parsedResponse.direction,
        confidence: parsedResponse.confidence,
      });

      return parsedResponse;
    } catch (error) {
      lastError = error;

      // Handle specific error types
      if (error.status === 429) {
        // Rate limit error
        const retryAfter = parseInt(error.headers?.['retry-after'] || '60', 10);
        logger.warn('OpenAI', `Rate limit hit, retry after ${retryAfter}s`);

        if (attempt < config.openai.maxRetries) {
          await sleep(retryAfter * 1000);
          continue;
        }
      } else if (error.status >= 500) {
        // Server error
        logger.warn('OpenAI', `Server error (${error.status}), retrying...`);

        if (attempt < config.openai.maxRetries) {
          const delayMs = 1000 * Math.pow(2, attempt - 1);
          await sleep(delayMs);
          continue;
        }
      } else if (error instanceof SyntaxError) {
        // JSON parsing error
        throw new OpenAIError('Failed to parse OpenAI response as JSON', {
          error: error.message,
          content: error.content,
        });
      } else {
        // Unknown error or non-retriable error
        logger.error('OpenAI', 'API call failed', error);
        throw new OpenAIError('OpenAI API call failed', {
          error: error.message,
          status: error.status,
        });
      }
    }
  }

  // All retries failed
  throw new OpenAIError(`Failed to call OpenAI after ${config.openai.maxRetries} attempts`, {
    lastError: lastError.message,
  });
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default { callOpenAI };
