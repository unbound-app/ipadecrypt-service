import cron from 'node-cron';
import { config } from '../config.js';
import { enqueueDecryptJob, reclaimJobFile, waitForJob } from '../jobs/store.js';
import { scopedLogger } from '../logger.js';

const log = scopedLogger('scheduler');
import { notify } from '../notify.js';
import { getEffectiveSettings, isSchedulerEnabled, recordSchedulerRun, type SchedulerSettings } from '../store/state.js';
import { buildSignedFileUrl } from '../util/signedUrl.js';
import { compareVersions, normalizeVersion } from '../util/version.js';
import { dispatchIpaUpdate, findDispatchedRun, getRun, listReleaseVersions } from './github.js';
import { lookupCurrentVersion } from './itunes.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SCHEDULER_JOB_TIMEOUT_MS = 2 * 60 * 60 * 1000;

export interface UpdateCheck {
  itunesVersion?: string;
  normalizedVersion?: string;
  alreadyReleased?: boolean;
  wouldDispatch: boolean;
  reason: string;
}

export async function checkForUpdate(settings: SchedulerSettings): Promise<UpdateCheck> {
  let itunesVersion: string;
  try {
    itunesVersion = (await lookupCurrentVersion(settings.watchBundleId)).version;
  } catch (err) {
    return { wouldDispatch: false, reason: `iTunes lookup failed: ${String(err)}` };
  }

  const normalizedVersion = normalizeVersion(itunesVersion);

  let releaseVersions: Set<string>;
  try {
    releaseVersions = await listReleaseVersions(settings.watchAppRepo);
  } catch (err) {
    return { itunesVersion, normalizedVersion, wouldDispatch: false, reason: `failed to list releases: ${String(err)}` };
  }

  const alreadyReleased = [...releaseVersions].some((v) => compareVersions(v, normalizedVersion) === 0);
  if (alreadyReleased) {
    return {
      itunesVersion,
      normalizedVersion,
      alreadyReleased: true,
      wouldDispatch: false,
      reason: `iTunes version ${normalizedVersion} already has a matching release`,
    };
  }

  return {
    itunesVersion,
    normalizedVersion,
    alreadyReleased: false,
    wouldDispatch: true,
    reason: `no release matches iTunes version ${normalizedVersion} - would decrypt and dispatch`,
  };
}

async function pollRunToCompletion(dispatchRepo: string, workflowFile: string, dispatchedAt: Date): Promise<void> {
  const deadline = Date.now() + config.runPollTimeoutMinutes * 60_000;

  let runId: number | undefined;
  while (Date.now() < deadline && runId === undefined) {
    const run = await findDispatchedRun(dispatchRepo, workflowFile, dispatchedAt);
    if (run) {
      runId = run.id;
      break;
    }
    await sleep(config.runPollIntervalSeconds * 1000);
  }

  if (runId === undefined) {
    log.warn('gave up waiting for the dispatched workflow run to appear', { dispatchRepo, workflowFile });
    return;
  }

  while (Date.now() < deadline) {
    const run = await getRun(dispatchRepo, runId);
    if (run.status === 'completed') {
      log.info('dispatched workflow run completed', { runId, conclusion: run.conclusion });
      return;
    }
    await sleep(config.runPollIntervalSeconds * 1000);
  }

  log.warn('dispatched workflow run did not complete before timeout', { runId });
}

async function tick(): Promise<void> {
  recordSchedulerRun();
  const settings = getEffectiveSettings();
  log.info('scheduler tick', { bundleId: settings.watchBundleId, appRepo: settings.watchAppRepo });

  const check = await checkForUpdate(settings);
  if (!check.wouldDispatch) {
    if (check.alreadyReleased) {
      log.info('itunes version already has a matching release, nothing to do', {
        bundleId: settings.watchBundleId,
        version: check.normalizedVersion,
      });
    } else {
      log.error(check.reason, { bundleId: settings.watchBundleId });
    }
    return;
  }

  const normalized = check.normalizedVersion as string;
  log.info('no matching release found, decrypting', { bundleId: settings.watchBundleId, version: normalized });

  const job = enqueueDecryptJob(settings.watchBundleId, 'scheduler');
  const finished = await waitForJob(job, SCHEDULER_JOB_TIMEOUT_MS);

  if (finished.status !== 'done') {
    log.error('scheduled decrypt did not complete successfully', {
      bundleId: settings.watchBundleId,
      status: finished.status,
      error: finished.error,
    });
    return;
  }

  try {
    const ipaUrl = buildSignedFileUrl(finished.id, config.fileTtlMinutes);
    const dispatchedAt = new Date();
    await dispatchIpaUpdate(settings.ghDispatchRepo, ipaUrl, false);
    log.info('dispatched ipa-update', { dispatchRepo: settings.ghDispatchRepo, bundleId: settings.watchBundleId });

    await pollRunToCompletion(settings.ghDispatchRepo, settings.ghWorkflowFile, dispatchedAt);
    await notify(`✅ dkrypt: **${settings.watchBundleId}** v${normalized} decrypted and dispatched to \`${settings.ghDispatchRepo}\`.`);
  } catch (err) {
    log.error('dispatch/poll failed', { error: String(err) });
    await notify(`⚠️ dkrypt: dispatch/poll failed for **${settings.watchBundleId}** v${normalized}: ${String(err)}`);
  } finally {
    await reclaimJobFile(finished);
  }
}

let currentTask: cron.ScheduledTask | undefined;
let currentCronExpr: string | undefined;

export function applySchedule(): void {
  if (!isSchedulerEnabled()) {
    if (currentTask) {
      currentTask.stop();
      currentTask = undefined;
      currentCronExpr = undefined;
    }
    log.info('scheduler disabled: set a watch bundle ID, app repo, dispatch repo and GH_TOKEN to enable it');
    return;
  }

  const settings = getEffectiveSettings();
  if (currentCronExpr === settings.pollCron && currentTask) return;

  if (currentTask) currentTask.stop();

  currentCronExpr = settings.pollCron;
  currentTask = cron.schedule(settings.pollCron, () => {
    void tick().catch((err) => log.error('scheduler tick threw', { error: String(err) }));
  });

  log.info('scheduler (re)scheduled', {
    cron: settings.pollCron,
    bundleId: settings.watchBundleId,
    appRepo: settings.watchAppRepo,
  });
}

export function startScheduler(): void {
  applySchedule();
}
