import type { NextFunction, Request, Response } from 'express';
import { verifyApiKey } from './store/state.js';
import { verifyDownloadToken } from './util/signedUrl.js';

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  const result = scheme === 'Bearer' && token ? verifyApiKey(token) : undefined;
  if (!result) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  res.locals.apiKeyScope = result.allowedBundleIds;
  next();
}

export function requireApiKeyOrSignedToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    const result = verifyApiKey(token);
    if (result) {
      res.locals.apiKeyScope = result.allowedBundleIds;
      next();
      return;
    }
  }

  const queryToken = req.query.token;
  const jobId = req.params.id;
  if (typeof queryToken === 'string' && jobId && verifyDownloadToken(jobId, queryToken)) {
    next();
    return;
  }

  res.status(401).json({ error: 'unauthorized' });
}
