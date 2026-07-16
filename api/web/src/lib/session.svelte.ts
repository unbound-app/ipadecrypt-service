import { setTheme, themeState, type Theme } from './ui.svelte';

export interface Permissions {
  decrypt: boolean;
  viewApiKeys: boolean;
  approveApiKeys: boolean;
  revokeApiKeys: boolean;
  manageScheduler: boolean;
  manageAppleAuth: boolean;
  viewUsers: boolean;
  manageUsers: boolean;
}

export const PERMISSION_KEYS: (keyof Permissions)[] = [
  'decrypt',
  'viewApiKeys',
  'approveApiKeys',
  'revokeApiKeys',
  'manageScheduler',
  'manageAppleAuth',
  'viewUsers',
  'manageUsers',
];

export const VIEWER_PERMISSIONS: Permissions = {
  decrypt: false,
  viewApiKeys: false,
  approveApiKeys: false,
  revokeApiKeys: false,
  manageScheduler: false,
  manageAppleAuth: false,
  viewUsers: false,
  manageUsers: false,
};

export const ADMIN_PERMISSIONS: Permissions = {
  decrypt: true,
  viewApiKeys: true,
  approveApiKeys: true,
  revokeApiKeys: true,
  manageScheduler: true,
  manageAppleAuth: true,
  viewUsers: true,
  manageUsers: true,
};

// Some capabilities imply others - keep that consistent no matter how permissions were set.
export function normalizePermissions(p: Permissions): Permissions {
  return {
    ...p,
    viewApiKeys: p.viewApiKeys || p.approveApiKeys || p.revokeApiKeys,
    viewUsers: p.viewUsers || p.manageUsers,
  };
}

export const PERMISSION_LABELS: { key: keyof Permissions; label: string; impliedBy?: (keyof Permissions)[] }[] = [
  { key: 'decrypt', label: 'Decrypt' },
  { key: 'viewApiKeys', label: 'View keys', impliedBy: ['approveApiKeys', 'revokeApiKeys'] },
  { key: 'approveApiKeys', label: 'Approve keys' },
  { key: 'revokeApiKeys', label: 'Revoke keys' },
  { key: 'manageScheduler', label: 'Scheduler' },
  { key: 'manageAppleAuth', label: 'Apple auth' },
  { key: 'viewUsers', label: 'View users', impliedBy: ['manageUsers'] },
  { key: 'manageUsers', label: 'Manage users' },
];

export function permissionsSummary(p?: Permissions): string {
  if (!p) return '';
  const values = Object.values(p);
  if (values.every(Boolean)) return 'admin';
  if (values.every((v) => !v)) return 'viewer';
  return 'custom';
}

export interface SessionInfo {
  loggedIn: boolean;
  sub?: string;
  permissions?: Permissions;
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

export async function refreshSessionTtl(): Promise<boolean> {
  const res = await fetch('/v1/auth/refresh', { method: 'POST' });
  if (!res.ok) return false;
  await refreshSession();
  return true;
}

export async function logout(): Promise<void> {
  await fetch('/v1/auth/logout', { method: 'POST' });
  await refreshSession();
}

export function markLoggedOut(): void {
  sessionState.loggedIn = false;
}
