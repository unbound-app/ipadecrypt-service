import { describe, expect, mock, test } from 'bun:test';

mock.module('./runner.js', () => ({
  runDecrypt: () => new Promise<void>(() => {}),
}));

const { cancelJob, cancelQueuedJob, enqueueDecryptJob, getActiveJobs, getJob, getQueueInfo } = await import('./store.js');

describe('enqueueDecryptJob', () => {
  test('scheduler jumps queued dashboard jobs, dedupes same bundle, never overtakes a running job', () => {
    const running = enqueueDecryptJob('com.test.running', 'manual');
    expect(running.status).toBe('running');

    const queuedManual = enqueueDecryptJob('com.test.manual', 'manual');
    const queuedManualAgain = enqueueDecryptJob('com.test.manual', 'manual');
    expect(queuedManualAgain.id).toBe(queuedManual.id);

    const queuedScheduler = enqueueDecryptJob('com.test.scheduler', 'scheduler');

    const runningPos = getQueueInfo(running.id);
    const manualPos = getQueueInfo(queuedManual.id);
    const schedulerPos = getQueueInfo(queuedScheduler.id);

    expect(runningPos?.position).toBe(1);
    expect(schedulerPos?.position).toBeLessThan(manualPos!.position);
    expect(getActiveJobs().map((j) => j.id)).toContain(running.id);
  });
});

describe('cancelQueuedJob', () => {
  test('removes a queued job from the queue and marks it failed, but not a running one', () => {
    // The single worker is permanently stuck on 'com.test.running' from the earlier test (its
    // mocked runDecrypt never resolves) - re-enqueuing the same bundle dedupes to that same,
    // genuinely-running job rather than creating a new one.
    const running = enqueueDecryptJob('com.test.running', 'manual');
    expect(running.status).toBe('running');
    const queued = enqueueDecryptJob('com.test.cancel-queued', 'manual');

    expect(cancelQueuedJob(running.id, 'tester')).toBe(false);
    expect(getActiveJobs().map((j) => j.id)).toContain(running.id);

    expect(cancelQueuedJob(queued.id, 'tester')).toBe(true);
    expect(getActiveJobs().map((j) => j.id)).not.toContain(queued.id);
    expect(getJob(queued.id)?.status).toBe('failed');
    expect(getJob(queued.id)?.error).toBe('cancelled by tester');

    expect(cancelQueuedJob('does-not-exist', 'tester')).toBe(false);
  });
});

describe('cancelJob', () => {
  test('falls back to killing a running job process when it is not queued', () => {
    const running = enqueueDecryptJob('com.test.running', 'manual');
    expect(running.status).toBe('running');

    let killedWith: string | undefined;
    const job = getJob(running.id)!;
    job.childProcess = { kill: (signal: string) => (killedWith = signal) } as unknown as typeof job.childProcess;

    expect(cancelJob(running.id, 'tester')).toBe(true);
    expect(killedWith).toBe('SIGTERM');
    expect(getJob(running.id)?.cancelledBy).toBe('tester');

    expect(cancelJob('does-not-exist', 'tester')).toBe(false);
  });
});
