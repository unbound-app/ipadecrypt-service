import type { TFBuild } from '../testflight.js';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export type JobSource = 'manual' | 'scheduler';

export interface TestFlightJobSource {
  appId: number;
  build: TFBuild;
}

export interface Job {
  id: string;
  bundleId: string;
  externalVersionId?: string;
  testflight?: TestFlightJobSource;
  versionLabel?: string;
  source: JobSource;
  status: JobStatus;
  progress: string;
  error?: string;
  filePath?: string;
  fileSizeBytes?: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  downloadedAt?: number;
  waiters: Array<(job: Job) => void>;
}
