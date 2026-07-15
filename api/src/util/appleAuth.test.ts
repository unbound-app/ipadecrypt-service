import { describe, expect, test } from 'bun:test';
import { looksLikeAppleAuthFailure } from './appleAuth.js';

describe('looksLikeAppleAuthFailure', () => {
  test('flags common Apple sign-in failure phrasings', () => {
    expect(looksLikeAppleAuthFailure('login failed: invalid credentials')).toBe(true);
    expect(looksLikeAppleAuthFailure('2FA code required')).toBe(true);
    expect(looksLikeAppleAuthFailure('failed to authenticate with Apple ID')).toBe(true);
  });

  test('does not flag unrelated errors', () => {
    expect(looksLikeAppleAuthFailure('ipadecrypt exited with code 1: connection refused')).toBe(false);
    expect(looksLikeAppleAuthFailure('device not found over SSH')).toBe(false);
  });
});
