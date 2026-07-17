import { EventEmitter } from 'node:events';
import type { LogEntry } from './logger.js';
import type { JobHistoryEntry } from './store/state.js';

export const dashboardEvents = new EventEmitter();
dashboardEvents.setMaxListeners(0);

export function emitJobsChanged(): void {
  dashboardEvents.emit('jobsChanged');
}

export function emitLogAdded(entry: LogEntry): void {
  dashboardEvents.emit('logAdded', entry);
}

export function emitHistoryAdded(entry: JobHistoryEntry): void {
  dashboardEvents.emit('historyAdded', entry);
}

export function emitAppleAuthChanged(): void {
  dashboardEvents.emit('appleAuthChanged');
}
