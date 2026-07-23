import type { NextFunction, Request, Response } from 'express';

interface Bucket {
  count: number;
  windowStartedAt: number;
}

// Per-user (session sub), fixed-window limiter for dashboard endpoints that are cheap to call but
// expensive to serve - each hit drives the shared physical device over SSH, or calls out to
// iTunes/GitHub live. Session-cookie auth has no equivalent to an API key's daily limit, so a
// signed-in low-priority user could otherwise hammer these for free.
export function rateLimitPerUser(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.windowStartedAt > windowMs) buckets.delete(key);
    }
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = res.locals.session?.sub ?? req.ip ?? 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStartedAt > windowMs) {
      buckets.set(key, { count: 1, windowStartedAt: now });
      next();
      return;
    }

    if (bucket.count >= maxRequests) {
      const retryAfterS = Math.ceil((bucket.windowStartedAt + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterS));
      res.status(429).json({ error: `too many requests - try again in ${retryAfterS}s` });
      return;
    }

    bucket.count += 1;
    next();
  };
}
