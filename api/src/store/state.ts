import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

export interface ApiKeyRecord {
  id: string;
  name: string;
  hash: string;
  createdAt: number;
  lastUsedAt?: number;
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
  status: 'done' | 'failed';
  error?: string;
  sizeBytes?: number;
  source: 'manual' | 'scheduler';
  createdAt: number;
  finishedAt: number;
}

interface AppleAuthAlert {
  suspected: boolean;
  lastError?: string;
  lastErrorAt?: number;
}

interface PersistedState {
  version: 1;
  apiKeys: ApiKeyRecord[];
  settings: Partial<SchedulerSettings>;
  jobHistory: JobHistoryEntry[];
  appleAuthAlert: AppleAuthAlert;
}

const MAX_HISTORY = 100;
const statePath = path.join(config.stateDir, 'state.json');

function defaultState(): PersistedState {
  return { version: 1, apiKeys: [], settings: {}, jobHistory: [], appleAuthAlert: { suspected: false } };
}

function load(): PersistedState {
  mkdirSync(config.stateDir, { recursive: true });
  if (!existsSync(statePath)) return defaultState();
  try {
    return { ...defaultState(), ...(JSON.parse(readFileSync(statePath, 'utf8')) as PersistedState) };
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

/** Periodic flush for low-value writes (e.g. API key lastUsedAt) that don't need to hit disk immediately. */
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

// --- api keys ---

export function createApiKey(name: string): { id: string; name: string; key: string; createdAt: number } {
  const key = randomBytes(32).toString('hex');
  const record: ApiKeyRecord = { id: randomUUID(), name, hash: hashKey(key), createdAt: Date.now() };
  state.apiKeys.push(record);
  persistNow();
  return { id: record.id, name: record.name, key, createdAt: record.createdAt };
}

export function listApiKeys(): Array<Omit<ApiKeyRecord, 'hash'>> {
  return state.apiKeys.map(({ hash: _hash, ...rest }) => rest);
}

export function revokeApiKey(id: string): boolean {
  const before = state.apiKeys.length;
  state.apiKeys = state.apiKeys.filter((k) => k.id !== id);
  const changed = state.apiKeys.length !== before;
  if (changed) persistNow();
  return changed;
}

/** True if `candidate` is the permanent root API_KEY or a live, non-revoked issued key. */
export function verifyApiKey(candidate: string): boolean {
  if (safeEqualStr(candidate, config.apiKey)) return true;

  const hash = hashKey(candidate);
  const record = state.apiKeys.find((k) => k.hash === hash);
  if (!record) return false;

  record.lastUsedAt = Date.now();
  dirty = true;
  return true;
}

// --- scheduler settings (dashboard-editable overlay on top of env defaults) ---

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

// --- job history ---

export function recordJobHistory(entry: JobHistoryEntry): void {
  state.jobHistory.unshift(entry);
  if (state.jobHistory.length > MAX_HISTORY) state.jobHistory.length = MAX_HISTORY;
  persistNow();
}

export function getJobHistory(): JobHistoryEntry[] {
  return state.jobHistory;
}

// --- apple auth alert ---

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
