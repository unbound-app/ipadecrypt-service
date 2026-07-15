import type { JobHistoryEntry, LogEntry, OverviewPayload } from './api';

export const liveState = $state<{
  overview: OverviewPayload | null;
  logs: LogEntry[];
  historyAdditions: JobHistoryEntry[];
  connected: boolean;
}>({ overview: null, logs: [], historyAdditions: [], connected: false });

let source: EventSource | null = null;

export function connectLive(): void {
  if (source) return;

  source = new EventSource('/v1/dashboard/events');

  source.addEventListener('overview', (e) => {
    liveState.overview = JSON.parse((e as MessageEvent).data) as OverviewPayload;
    liveState.connected = true;
  });

  source.addEventListener('log', (e) => {
    const entry = JSON.parse((e as MessageEvent).data) as LogEntry;
    liveState.logs = [entry, ...liveState.logs].slice(0, 500);
  });

  source.addEventListener('history', (e) => {
    const entry = JSON.parse((e as MessageEvent).data) as JobHistoryEntry;
    liveState.historyAdditions = [entry, ...liveState.historyAdditions];
  });

  source.onerror = () => {
    liveState.connected = false;
  };
}

export function disconnectLive(): void {
  source?.close();
  source = null;
  liveState.overview = null;
  liveState.logs = [];
  liveState.historyAdditions = [];
  liveState.connected = false;
}
