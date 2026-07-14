import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config.js';

const COOKIE_NAME = 'admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function safeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function sign(expiresAtMs: number): string {
  const sig = createHmac('sha256', config.downloadSigningSecret).update(`admin.${expiresAtMs}`).digest('hex');
  return `${expiresAtMs}.${sig}`;
}

function verify(cookieValue: string): boolean {
  const [expiresAtStr, sig] = cookieValue.split('.');
  if (!expiresAtStr || !sig) return false;

  const expiresAtMs = Number.parseInt(expiresAtStr, 10);
  if (Number.isNaN(expiresAtMs) || Date.now() > expiresAtMs) return false;

  const expected = createHmac('sha256', config.downloadSigningSecret).update(`admin.${expiresAtMs}`).digest('hex');
  return safeEqualStr(sig, expected);
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.header('cookie');
  if (!header) return {};

  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function checkPassword(candidate: string): boolean {
  return safeEqualStr(candidate, config.adminPassword);
}

export function setSessionCookie(res: Response): void {
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${sign(expiresAtMs)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`,
  );
}

export function clearSessionCookie(res: Response): void {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

export function isSessionValid(req: Request): boolean {
  const cookies = parseCookies(req);
  const value = cookies[COOKIE_NAME];
  return !!value && verify(value);
}

/** Protects /v1/admin/* API routes (except login) - the static dashboard shell itself loads without this. */
export function requireAdminSession(req: Request, res: Response, next: NextFunction): void {
  if (!isSessionValid(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}
