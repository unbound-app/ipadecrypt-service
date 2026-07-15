export type Role = 'admin' | 'member';

export interface SessionInfo {
  loggedIn: boolean;
  sub?: string;
  role?: Role;
  expiresAt?: number;
  githubOauthEnabled: boolean;
  publicBaseUrl?: string;
}

export const sessionState = $state<SessionInfo>({ loggedIn: false, githubOauthEnabled: false });

export async function refreshSession(): Promise<SessionInfo> {
  const res = await fetch('/v1/auth/session');
  const data = (await res.json()) as SessionInfo;
  Object.assign(sessionState, data);
  return data;
}

export async function loginRoot(password: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.ok) {
    await refreshSession();
    return { ok: true };
  }
  const data = await res.json().catch(() => ({}) as { error?: string });
  return { ok: false, error: res.status === 429 ? data.error : 'Wrong password.' };
}

export async function logout(): Promise<void> {
  await fetch('/v1/auth/logout', { method: 'POST' });
  await refreshSession();
}

export function markLoggedOut(): void {
  sessionState.loggedIn = false;
}
