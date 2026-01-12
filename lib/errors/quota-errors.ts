/**
 * Custom error for quota exceeded
 */
export class QuotaExceededError extends Error {
  constructor(
    public limit: number,
    public used: number,
    message?: string
  ) {
    super(message || `Daily quota exceeded: ${used}/${limit} requests used`);
    this.name = 'QuotaExceededError';
  }
}
