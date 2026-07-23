// Distinguishes "the remote API is rate-limiting us" from a hard failure (bad token, 404, etc.) -
// without this, a transient rate limit and a persistent config error read identically as
// "HTTP 4xx" and retry on the same fixed schedule instead of backing off appropriately.
export function describeHttpError(context: string, res: Response): string {
  const retryAfter = res.headers.get('retry-after');
  const rateRemaining = res.headers.get('x-ratelimit-remaining');
  const isRateLimited = res.status === 429 || (res.status === 403 && rateRemaining === '0');

  if (isRateLimited) {
    return `${context}: rate limited (HTTP ${res.status})${retryAfter ? ` - retry after ${retryAfter}s` : ''}`;
  }
  if (res.status === 503) {
    return `${context}: service temporarily unavailable (HTTP 503)`;
  }
  return `${context}: HTTP ${res.status}`;
}
