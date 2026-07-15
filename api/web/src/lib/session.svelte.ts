import { setTheme, themeState, type Theme } from './ui.svelte';

export type Role = 'admin' | 'operator' | 'member' | 'viewer';

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
  if (data.loggedIn) void syncThemeFromServer();
  return data;
}

async function syncThemeFromServer(): Promise<void> {
  const res = await fetch('/v1/dashboard/me/prefs');
  if (!res.ok) return;
  const prefs = (await res.json()) as { theme?: Theme };
  if (prefs.theme && prefs.theme !== themeState.value) setTheme(prefs.theme);
}

export async function pushThemePref(theme: Theme): Promise<void> {
  if (!sessionState.loggedIn) return;
  await fetch('/v1/dashboard/me/prefs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme }),
  });
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
