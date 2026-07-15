import { describe, expect, mock, test } from 'bun:test';

// runDecrypt is mocked to hang forever so the worker's synchronous drain
// suspends at its first await, before anything actually "finishes" and
// touches job history / disk state. jobs/store.ts holds module-level
// singleton state (one job can ever be "running"), so this is a single
// test rather than several - splitting it up would let one test's
// permanently-running job leak into the next.
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
