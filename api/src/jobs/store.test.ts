import { describe, expect, mock, test } from 'bun:test';

mock.module('./runner.js', () => ({
  runDecrypt: () => new Promise<void>(() => {}),
}));

const { enqueueDecryptJob, getActiveJobs, getQueueInfo } = await import('./store.js');

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
