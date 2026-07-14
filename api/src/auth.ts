import type { NextFunction, Request, Response } from 'express';
import { verifyApiKey } from './store/state.js';
import { verifyDownloadToken } from './util/signedUrl.js';

/** Requires a valid `Authorization: Bearer <key>` header - the root API_KEY or any live issued key. */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token || !verifyApiKey(token)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  next();
}

/**
 * File downloads accept EITHER a valid API key OR a short-lived signed
 * `?token=` scoped to that specific job. The signed token exists so the
 * GitHub Actions runner can fetch the IPA without holding an API key.
 */
export function requireApiKeyOrSignedToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token && verifyApiKey(token)) {
    next();
    return;
  }

  const queryToken = req.query.token;
  const jobId = req.params.id;
  if (typeof queryToken === 'string' && jobId && verifyDownloadToken(jobId, queryToken)) {
    next();
    return;
  }

  res.status(401).json({ error: 'unauthorized' });
}
