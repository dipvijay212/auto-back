import AppError from './appError.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries a function with exponential backoff on 429 Rate Limit errors.
 * @param {Function} fn - The async function to execute.
 * @param {number} maxRetries - Maximum number of retries (default: 5).
 * @param {number} initialDelay - Initial delay in milliseconds (default: 6000).
 * @returns {Promise<any>} The result of the function execution.
 */
export const retryWithBackoff = async (fn, maxRetries = 5, initialDelay = 6000) => {
  let delay = initialDelay;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isTransient = 
        error.status === 429 || 
        error.statusCode === 429 || 
        error.status === 503 ||
        error.statusCode === 503 ||
        (error.message && (
          error.message.includes('429') || 
          error.message.includes('503') ||
          error.message.includes('RESOURCE_EXHAUSTED') ||
          error.message.includes('SERVICE_UNAVAILABLE') ||
          error.message.includes('overloaded') ||
          error.message.includes('high demand')
        )) || 
        (error.stack && (
          error.stack.includes('RESOURCE_EXHAUSTED') ||
          error.stack.includes('SERVICE_UNAVAILABLE')
        ));
        
      if (isTransient && i < maxRetries - 1) {
        console.warn(`[Gemini API] Transient error (429/503) hit. Retrying in ${delay / 1000} seconds... (Attempt ${i + 1}/${maxRetries})`);
        await sleep(delay);
        // Add random jitter to prevent synchronized retries
        delay = (delay * 2) + Math.floor(Math.random() * 1000);
      } else {
        throw error;
      }
    }
  }
};

/**
 * Parses caught errors to check for rate limits/quotas and wraps them into a 429 or 500 AppError.
 */
export const handleServiceError = (error, prefixMessage) => {
  if (error instanceof AppError) {
    throw error;
  }

  const isRateLimit = 
    error.status === 429 || 
    error.statusCode === 429 || 
    (error.message && error.message.includes('429')) || 
    (error.message && error.message.includes('RESOURCE_EXHAUSTED')) ||
    (error.stack && error.stack.includes('RESOURCE_EXHAUSTED'));

  const isUnavailable = 
    error.status === 503 || 
    error.statusCode === 503 || 
    (error.message && (error.message.includes('503') || error.message.includes('SERVICE_UNAVAILABLE') || error.message.includes('overloaded') || error.message.includes('high demand')));

  if (isRateLimit) {
    throw new AppError('Gemini API rate limit or daily quota exceeded. Please try again later or switch to "Simulate (Use mock engine fallback)" in the UI.', 429);
  }

  if (isUnavailable) {
    throw new AppError('Gemini API is currently overloaded or experiencing high demand. Please try again in a few moments or use simulated mode.', 503);
  }

  throw new AppError(`${prefixMessage}: ${error.message}`, 500);
};

