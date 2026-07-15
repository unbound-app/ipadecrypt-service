import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { scopedLogger } from './logger.js';

const log = scopedLogger('versions');

const ipadecryptRoot = path.dirname(config.ipadecryptConfigPath);
const versionsLogPath = path.join(ipadecryptRoot, 'logs', 'versions.log');
const versionsCacheDir = path.join(ipadecryptRoot, 'cache', 'versions');

export interface AppVersionEntry {
  externalVersionId: string;
  isLatest: boolean;
  displayVersion?: string;
  bundleVersion?: string;
  releaseDate?: string;
}

interface VersionsLogRecord {
  ts: string;
  kind: string;
  bundleId: string;
  metadata: Record<string, unknown>;
}

interface CachedVersionEntry {
  displayVersion?: string;
  bundleVersion?: string;
  releaseDate?: string;
}

interface VersionsCacheFile {
  bundleId: string;
  versions: Record<string, CachedVersionEntry>;
}

async function readLastListVersionsRecord(bundleId: string): Promise<VersionsLogRecord | undefined> {
  let text: string;
  try {
    text = await readFile(versionsLogPath, 'utf8');
  } catch {
    return undefined;
  }

  let last: VersionsLogRecord | undefined;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as VersionsLogRecord;
      if (rec.kind === 'list_versions' && rec.bundleId === bundleId) last = rec;
    } catch {
      // skip malformed lines
    }
  }
  return last;
}

async function readVersionsCache(bundleId: string): Promise<VersionsCacheFile | undefined> {
  try {
    const text = await readFile(path.join(versionsCacheDir, `${bundleId}.json`), 'utf8');
    return JSON.parse(text) as VersionsCacheFile;
  } catch {
    return undefined;
  }
}

function metaStr(meta: Record<string, unknown>, key: string): string | undefined {
  const v = meta[key];
  return typeof v === 'string' ? v : undefined;
}

function runIpadecryptVersions(bundleId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.ipadecryptBin, ['versions', bundleId, '--log-responses'], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) log.info('ipadecrypt versions exited non-zero (expected once the TUI hand-off is reached headlessly)', { bundleId, code, stderr: stderr.trim() });
      resolve();
    });
  });
}

async function fetchAppVersions(bundleId: string): Promise<AppVersionEntry[]> {
  await runIpadecryptVersions(bundleId);

  const record = await readLastListVersionsRecord(bundleId);
  if (!record) {
    throw new Error(
      "no version data came back - if this is the first time this instance has listed versions, SSH in and run `ipadecrypt versions <bundle-id>` once interactively to accept Apple's rate-limit warning, then retry",
    );
  }

  const meta = record.metadata;
  const rawIds = Array.isArray(meta.softwareVersionExternalIdentifiers) ? meta.softwareVersionExternalIdentifiers : [];
  const ids = rawIds.map((v) => String(v));
  const latestId = meta.softwareVersionExternalIdentifier != null ? String(meta.softwareVersionExternalIdentifier) : undefined;

  const cache = await readVersionsCache(bundleId);

  return ids
    .slice()
    .reverse()
    .map((id) => {
      const isLatest = id === latestId;
      const cached = cache?.versions[id];
      return {
        externalVersionId: id,
        isLatest,
        displayVersion: (isLatest ? metaStr(meta, 'bundleShortVersionString') : undefined) ?? cached?.displayVersion,
        bundleVersion: (isLatest ? metaStr(meta, 'bundleVersion') : undefined) ?? cached?.bundleVersion,
        releaseDate: (isLatest ? metaStr(meta, 'releaseDate') : undefined) ?? cached?.releaseDate,
      };
    });
}

const CACHE_TTL_MS = 5 * 60_000;
const resultCache = new Map<string, { at: number; entries: AppVersionEntry[] }>();
const inFlight = new Map<string, Promise<AppVersionEntry[]>>();

export function listAppVersions(bundleId: string): Promise<AppVersionEntry[]> {
  const cached = resultCache.get(bundleId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return Promise.resolve(cached.entries);

  const existing = inFlight.get(bundleId);
  if (existing) return existing;

  const promise = fetchAppVersions(bundleId)
    .then((entries) => {
      resultCache.set(bundleId, { at: Date.now(), entries });
      return entries;
    })
    .finally(() => inFlight.delete(bundleId));

  inFlight.set(bundleId, promise);
  return promise;
}
