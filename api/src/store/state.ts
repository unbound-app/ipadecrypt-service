import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { emitHistoryAdded } from '../events.js';
import type { TestFlightJobSource } from '../jobs/types.js';

export type ApiKeyStatus = 'pending' | 'approved' | 'denied';

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

function legacyRoleToPermissions(role: string): Permissions {
  switch (role) {
    case 'admin':
      return { ...ADMIN_PERMISSIONS };
    case 'operator':
      return { ...VIEWER_PERMISSIONS, decrypt: true, viewApiKeys: true, approveApiKeys: true, revokeApiKeys: true };
    case 'member':
      return { ...VIEWER_PERMISSIONS, decrypt: true };
    default:
      return { ...VIEWER_PERMISSIONS };
  }
}

interface LegacyV3Permissions {
  decrypt: boolean;
  manageKeys: boolean;
  manageSettings: boolean;
  manageUsers: boolean;
}

function migratePermissionsV3(old: LegacyV3Permissions): Permissions {
  return {
    decrypt: old.decrypt,
    viewApiKeys: old.manageKeys,
    approveApiKeys: old.manageKeys,
    revokeApiKeys: old.manageKeys,
    manageScheduler: old.manageSettings,
    manageAppleAuth: old.manageSettings && old.manageUsers,
    viewUsers: old.manageUsers,
    manageUsers: old.manageUsers,
  };
}

export interface AllowedUser {
  username: string;
  permissions: Permissions;
  addedAt: number;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  ownerId: string;
  status: ApiKeyStatus;
  hash?: string;
  pendingReveal?: string;
  createdAt: number;
  approvedAt?: number;
  lastUsedAt?: number;
  expiresAt?: number;
  allowedBundleIds?: string[];
}

export interface ApiKeyAuthResult {
  // undefined = unrestricted (root key, or a key created with no scope)
  allowedBundleIds?: string[];
}

export interface SchedulerSettings {
  watchBundleId: string;
  watchAppRepo: string;
  ghDispatchRepo: string;
  ghWorkflowFile: string;
  pollCron: string;
  notifyWebhookUrl: string;
}

export interface JobHistoryEntry {
  id: string;
  bundleId: string;
  externalVersionId?: string;
  testflight?: TestFlightJobSource;
  versionLabel?: string;
  status: 'done' | 'failed';
  error?: string;
  sizeBytes?: number;
  source: 'manual' | 'scheduler';
  createdAt: number;
  startedAt?: number;
  finishedAt: number;
}

interface AppleAuthAlert {
  suspected: boolean;
  lastError?: string;
  lastErrorAt?: number;
}

export interface UserPrefs {
  theme?: 'dark' | 'light';
}

export type AuditAction = 'user.add' | 'user.update' | 'user.remove';

export interface AuditLogEntry {
  id: string;
  ts: number;
  actor: string;
  action: AuditAction;
  target: string;
  detail?: string;
}

export interface SchedulerRunOutcome {
  triggered: boolean;
  reason: string;
}

export interface SchedulerRunEntry {
  ts: number;
  appStore: SchedulerRunOutcome;
  testflight: SchedulerRunOutcome;
}

interface PersistedState {
  version: 4;
  apiKeys: ApiKeyRecord[];
  allowedUsers: AllowedUser[];
  settings: Partial<SchedulerSettings>;
  jobHistory: JobHistoryEntry[];
  appleAuthAlert: AppleAuthAlert;
  lastSchedulerRunAt?: number;
  userPrefs: Record<string, UserPrefs>;
  auditLog: AuditLogEntry[];
  schedulerRunHistory: SchedulerRunEntry[];
}

const MAX_HISTORY = 100;
const MAX_AUDIT_LOG = 200;
const MAX_SCHEDULER_RUNS = 20;
const statePath = path.join(config.stateDir, 'state.json');

function defaultState(): PersistedState {
  return {
    version: 4,
    apiKeys: [],
    allowedUsers: [],
    settings: {},
    jobHistory: [],
    appleAuthAlert: { suspected: false },
    userPrefs: {},
    auditLog: [],
    schedulerRunHistory: [],
  };
}

function migrate(raw: Record<string, unknown>): PersistedState {
  if (raw.version === 4) return { ...defaultState(), ...raw } as PersistedState;

  if (raw.version === 3) {
    const v3Users = Array.isArray(raw.allowedUsers) ? (raw.allowedUsers as Record<string, unknown>[]) : [];
    return {
      ...defaultState(),
      ...raw,
      version: 4,
      allowedUsers: v3Users.map((u) => ({
        username: u.username as string,
        permissions: migratePermissionsV3(u.permissions as LegacyV3Permissions),
        addedAt: u.addedAt as number,
      })),
    } as PersistedState;
  }

  if (raw.version === 2) {
    const legacyUsers = Array.isArray(raw.allowedUsers) ? (raw.allowedUsers as Record<string, unknown>[]) : [];
    return {
      ...defaultState(),
      ...raw,
      version: 4,
      allowedUsers: legacyUsers.map((u) => ({
        username: u.username as string,
        permissions: legacyRoleToPermissions(String(u.role ?? '')),
        addedAt: u.addedAt as number,
      })),
    } as PersistedState;
  }

  const legacyKeys = Array.isArray(raw.apiKeys) ? (raw.apiKeys as Record<string, unknown>[]) : [];
  return {
    ...defaultState(),
    apiKeys: legacyKeys.map((k) => ({
      id: k.id as string,
      name: k.name as string,
      ownerId: 'root',
      status: 'approved',
      hash: k.hash as string,
      createdAt: k.createdAt as number,
      approvedAt: k.createdAt as number,
      lastUsedAt: k.lastUsedAt as number | undefined,
    })),
    settings: (raw.settings as Partial<SchedulerSettings>) ?? {},
    jobHistory: (raw.jobHistory as JobHistoryEntry[]) ?? [],
    appleAuthAlert: (raw.appleAuthAlert as AppleAuthAlert) ?? { suspected: false },
  };
}

function load(): PersistedState {
  mkdirSync(config.stateDir, { recursive: true });
  if (!existsSync(statePath)) return defaultState();
  try {
    return migrate(JSON.parse(readFileSync(statePath, 'utf8')));
  } catch {
    return defaultState();
  }
}

const state: PersistedState = load();
let dirty = false;

function persistNow(): void {
  writeFileSync(statePath, JSON.stringify(state, null, 2));
  dirty = false;
}

export function startStateFlusher(): void {
  setInterval(() => {
    if (dirty) persistNow();
  }, 30_000).unref();
}

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function safeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function listAllowedUsers(): AllowedUser[] {
  return state.allowedUsers;
}

export function getUserPermissions(username: string): Permissions | undefined {
  return state.allowedUsers.find((u) => u.username === username.toLowerCase())?.permissions;
}

// True if applying this change would leave nobody on the allowlist able to grant access back
// (root's ADMIN_PASSWORD still works, but GitHub-OAuth-only teams would be locked out of self-service).
export function wouldOrphanManageUsers(username: string, newPermissions: Permissions | null): boolean {
  const lower = username.toLowerCase();
  const othersHaveIt = state.allowedUsers.some((u) => u.username !== lower && u.permissions.manageUsers);
  if (othersHaveIt) return false;
  return !newPermissions?.manageUsers;
}

function permissionDiff(before: Permissions, after: Permissions): string {
  const changes = PERMISSION_KEYS.filter((k) => before[k] !== after[k]).map((k) => `${after[k] ? '+' : '-'}${k}`);
  return changes.length > 0 ? changes.join(', ') : '(no change)';
}

export function recordAudit(actor: string, action: AuditAction, target: string, detail?: string): void {
  state.auditLog.unshift({ id: randomUUID(), ts: Date.now(), actor, action, target, detail });
  if (state.auditLog.length > MAX_AUDIT_LOG) state.auditLog.length = MAX_AUDIT_LOG;
  persistNow();
}

export function getAuditLog(limit = 100): AuditLogEntry[] {
  return state.auditLog.slice(0, limit);
}

export function addAllowedUser(username: string, permissions: Permissions, actor: string): AllowedUser {
  const lower = username.toLowerCase();
  const normalized = normalizePermissions(permissions);
  const existing = state.allowedUsers.find((u) => u.username === lower);
  if (existing) {
    const detail = permissionDiff(existing.permissions, normalized);
    existing.permissions = normalized;
    persistNow();
    recordAudit(actor, 'user.update', lower, detail);
    return existing;
  }
  const record: AllowedUser = { username: lower, permissions: normalized, addedAt: Date.now() };
  state.allowedUsers.push(record);
  persistNow();
  recordAudit(actor, 'user.add', lower, permissionDiff(VIEWER_PERMISSIONS, normalized));
  return record;
}

export function updateAllowedUserPermissions(username: string, permissions: Permissions, actor: string): AllowedUser | undefined {
  const existing = state.allowedUsers.find((u) => u.username === username.toLowerCase());
  if (!existing) return undefined;
  const normalized = normalizePermissions(permissions);
  const detail = permissionDiff(existing.permissions, normalized);
  existing.permissions = normalized;
  persistNow();
  recordAudit(actor, 'user.update', existing.username, detail);
  return existing;
}

export function removeAllowedUser(username: string, actor: string): boolean {
  const before = state.allowedUsers.length;
  state.allowedUsers = state.allowedUsers.filter((u) => u.username !== username.toLowerCase());
  const changed = state.allowedUsers.length !== before;
  if (changed) {
    persistNow();
    recordAudit(actor, 'user.remove', username.toLowerCase());
  }
  return changed;
}

function redact(k: ApiKeyRecord) {
  return {
    id: k.id,
    name: k.name,
    ownerId: k.ownerId,
    status: k.status,
    createdAt: k.createdAt,
    approvedAt: k.approvedAt,
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    hasUnrevealedSecret: !!k.pendingReveal,
    allowedBundleIds: k.allowedBundleIds,
  };
}

function expiresAtFromDays(expiresInDays?: number): number | undefined {
  return expiresInDays ? Date.now() + expiresInDays * 86_400_000 : undefined;
}

function sanitizeBundleIds(allowedBundleIds?: string[]): string[] | undefined {
  return allowedBundleIds && allowedBundleIds.length > 0 ? allowedBundleIds : undefined;
}

export function createApiKey(
  name: string,
  ownerId: string,
  expiresInDays?: number,
  allowedBundleIds?: string[],
): { id: string; name: string; key: string; createdAt: number; expiresAt?: number } {
  const key = randomBytes(32).toString('hex');
  const record: ApiKeyRecord = {
    id: randomUUID(),
    name,
    ownerId,
    status: 'approved',
    hash: hashKey(key),
    pendingReveal: key,
    createdAt: Date.now(),
    approvedAt: Date.now(),
    expiresAt: expiresAtFromDays(expiresInDays),
    allowedBundleIds: sanitizeBundleIds(allowedBundleIds),
  };
  state.apiKeys.push(record);
  persistNow();
  return { id: record.id, name: record.name, key, createdAt: record.createdAt, expiresAt: record.expiresAt };
}

export function requestApiKey(name: string, ownerId: string, expiresInDays?: number, allowedBundleIds?: string[]) {
  const record: ApiKeyRecord = {
    id: randomUUID(),
    name,
    ownerId,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: expiresAtFromDays(expiresInDays),
    allowedBundleIds: sanitizeBundleIds(allowedBundleIds),
  };
  state.apiKeys.push(record);
  persistNow();
  return redact(record);
}

export function approveApiKey(id: string): boolean {
  const record = state.apiKeys.find((k) => k.id === id);
  if (!record || record.status !== 'pending') return false;
  const key = randomBytes(32).toString('hex');
  record.status = 'approved';
  record.hash = hashKey(key);
  record.pendingReveal = key;
  record.approvedAt = Date.now();
  persistNow();
  return true;
}

export function bulkApproveApiKeys(ids: string[]): string[] {
  return ids.filter((id) => approveApiKey(id));
}

export function denyApiKey(id: string): boolean {
  const record = state.apiKeys.find((k) => k.id === id);
  if (!record || record.status !== 'pending') return false;
  record.status = 'denied';
  persistNow();
  return true;
}

export function regenerateApiKey(id: string, requesterId: string): boolean {
  const record = state.apiKeys.find((k) => k.id === id);
  if (!record || record.status !== 'approved' || record.ownerId !== requesterId) return false;
  const key = randomBytes(32).toString('hex');
  record.hash = hashKey(key);
  record.pendingReveal = key;
  persistNow();
  return true;
}

export function revealApiKeySecret(id: string, requesterId: string): string | undefined {
  const record = state.apiKeys.find((k) => k.id === id);
  if (!record || record.ownerId !== requesterId || !record.pendingReveal) return undefined;
  const secret = record.pendingReveal;
  record.pendingReveal = undefined;
  persistNow();
  return secret;
}

export function listApiKeysForOwner(ownerId: string) {
  return state.apiKeys.filter((k) => k.ownerId === ownerId).map(redact);
}

export function listAllApiKeys() {
  return state.apiKeys.map(redact);
}

export function listAllApiKeysPage(offset: number, limit: number): { keys: ReturnType<typeof redact>[]; total: number } {
  const sorted = [...state.apiKeys].sort((a, b) => b.createdAt - a.createdAt);
  return { keys: sorted.slice(offset, offset + limit).map(redact), total: sorted.length };
}

export function listPendingApiKeys() {
  return state.apiKeys.filter((k) => k.status === 'pending').map(redact);
}

export function revokeApiKey(id: string, requesterId: string, requesterIsAdmin: boolean): boolean {
  const record = state.apiKeys.find((k) => k.id === id);
  if (!record) return false;
  if (!requesterIsAdmin && record.ownerId !== requesterId) return false;

  state.apiKeys = state.apiKeys.filter((k) => k.id !== id);
  persistNow();
  return true;
}

export function verifyApiKey(candidate: string): ApiKeyAuthResult | undefined {
  if (safeEqualStr(candidate, config.apiKey)) return {};

  const hash = hashKey(candidate);
  const record = state.apiKeys.find((k) => k.status === 'approved' && k.hash === hash);
  if (!record) return undefined;
  if (record.expiresAt && Date.now() > record.expiresAt) return undefined;

  record.lastUsedAt = Date.now();
  dirty = true;
  return { allowedBundleIds: record.allowedBundleIds };
}

export function startApiKeySweeper(): void {
  setInterval(() => {
    const now = Date.now();
    const before = state.apiKeys.length;
    state.apiKeys = state.apiKeys.filter((k) => !(k.expiresAt && now > k.expiresAt));
    if (state.apiKeys.length !== before) persistNow();
  }, 60_000).unref();
}

export function getEffectiveSettings(): SchedulerSettings {
  return {
    watchBundleId: state.settings.watchBundleId ?? config.watchBundleId,
    watchAppRepo: state.settings.watchAppRepo ?? config.watchAppRepo,
    ghDispatchRepo: state.settings.ghDispatchRepo ?? config.ghDispatchRepo,
    ghWorkflowFile: state.settings.ghWorkflowFile ?? config.ghWorkflowFile,
    pollCron: state.settings.pollCron ?? config.pollCron,
    notifyWebhookUrl: state.settings.notifyWebhookUrl ?? config.notifyWebhookUrl,
  };
}

export function updateSettings(patch: Partial<SchedulerSettings>): SchedulerSettings {
  state.settings = { ...state.settings, ...patch };
  persistNow();
  return getEffectiveSettings();
}

export function isSchedulerEnabled(): boolean {
  const s = getEffectiveSettings();
  return s.watchBundleId !== '' && s.watchAppRepo !== '' && s.ghDispatchRepo !== '' && config.ghToken !== '';
}

export function recordJobHistory(entry: JobHistoryEntry): void {
  state.jobHistory.unshift(entry);
  if (state.jobHistory.length > MAX_HISTORY) state.jobHistory.length = MAX_HISTORY;
  persistNow();
  emitHistoryAdded(entry);
}

export function getJobHistoryPage(offset: number, limit: number, bundleIdSearch?: string): { entries: JobHistoryEntry[]; total: number } {
  const filtered = bundleIdSearch
    ? state.jobHistory.filter((e) => e.bundleId.toLowerCase().includes(bundleIdSearch.toLowerCase()))
    : state.jobHistory;
  return { entries: filtered.slice(offset, offset + limit), total: filtered.length };
}

export function getAllJobHistory(): JobHistoryEntry[] {
  return state.jobHistory;
}

export function getAverageJobDurationMs(bundleId: string): number | undefined {
  const durations = state.jobHistory
    .filter((j) => j.bundleId === bundleId && j.status === 'done' && j.startedAt)
    .map((j) => j.finishedAt - (j.startedAt as number));
  if (durations.length === 0) return undefined;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

export function getDailyVolume(days: number): { date: string; count: number }[] {
  const buckets = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const j of state.jobHistory) {
    if (j.status !== 'done') continue;
    const key = new Date(j.finishedAt).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

export function recordSchedulerRun(): void {
  state.lastSchedulerRunAt = Date.now();
  persistNow();
}

export function getLastSchedulerRunAt(): number | undefined {
  return state.lastSchedulerRunAt;
}

export function recordSchedulerRunOutcome(outcome: Omit<SchedulerRunEntry, 'ts'>): void {
  state.schedulerRunHistory.unshift({ ts: Date.now(), ...outcome });
  if (state.schedulerRunHistory.length > MAX_SCHEDULER_RUNS) state.schedulerRunHistory.length = MAX_SCHEDULER_RUNS;
  persistNow();
}

export function getSchedulerRunHistory(limit = 10): SchedulerRunEntry[] {
  return state.schedulerRunHistory.slice(0, limit);
}

export function getAppleAuthAlert(): AppleAuthAlert {
  return state.appleAuthAlert;
}

export function setAppleAuthAlert(error: string): void {
  state.appleAuthAlert = { suspected: true, lastError: error, lastErrorAt: Date.now() };
  persistNow();
}

export function clearAppleAuthAlert(): void {
  if (!state.appleAuthAlert.suspected) return;
  state.appleAuthAlert = { suspected: false };
  persistNow();
}

export function getUserPrefs(username: string): UserPrefs {
  return state.userPrefs[username.toLowerCase()] ?? {};
}

export function updateUserPrefs(username: string, patch: Partial<UserPrefs>): UserPrefs {
  const lower = username.toLowerCase();
  const updated = { ...(state.userPrefs[lower] ?? {}), ...patch };
  state.userPrefs[lower] = updated;
  persistNow();
  return updated;
}
