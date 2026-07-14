const APPLE_AUTH_ERROR_RE =
  /login failed|authenticat|invalid credentials|incorrect password|2fa|two-factor|reauthenticat|sign.?in failed|password.*token/i;

/** Heuristic: does this ipadecrypt error look like the App Store session needs re-auth, rather than a device/network hiccup? */
export function looksLikeAppleAuthFailure(message: string): boolean {
  return APPLE_AUTH_ERROR_RE.test(message);
}
