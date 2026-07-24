import type { Client } from 'ssh2';
import {
  armAppStoreAutoConfirm,
  clearAppStoreAutoConfirm,
  findInstalledAppStoreBundle,
  isAppStoreRunning,
  sendAppStoreBridgeRequest,
  sendSpringBoardBridgeRequest,
  withSSH,
} from './idevice.js';
import { scopedLogger } from './logger.js';
import { lookupCurrentVersion } from './scheduler/itunes.js';
import { getPrimaryDevice } from './store/state.js';

const log = scopedLogger('appstore');

const SAFE_BUNDLE_ID_RE = /^[A-Za-z0-9.-]{1,200}$/;
const APP_EXT_VERSION_ID_RE = /^\d{1,20}$/;

// App Store installs drive the autoinstall App Store bridge on the single primary device, the same
// way TestFlight installs drive the SpringBoard bridge.
function primaryRootDir(): string {
  return getPrimaryDevice().rootDir;
}

// Always (re)launch the App Store, even when the process is already alive: _performPurchases: only
// presents its confirmation sheet when the App Store is FOREGROUND, and a process that's merely
// running (e.g. backgrounded from an earlier install) makes the purchase silently no-op with no
// sheet to confirm. SBSLaunchApplicationWithIdentifier foregrounds an already-running app too, so
// a non-zero result is only fatal on a cold launch where there's nothing to fall back to.
async function ensureAppStoreForeground(conn: Client): Promise<void> {
  const wasRunning = await isAppStoreRunning(conn);
  const response = await sendSpringBoardBridgeRequest(conn, { action: 'launch_app', bundleId: 'com.apple.AppStore' });
  if (!wasRunning && response?.launchResult !== 0) {
    throw new Error(`autoinstall SpringBoard launch_app (AppStore) failed: ${JSON.stringify(response)}`);
  }
  // A cold launch needs time to become interactive; foregrounding an already-warm app is quicker.
  await new Promise((r) => setTimeout(r, wasRunning ? 4_000 : 8_000));
}

export interface AppStoreInstallOptions {
  // App Store external version id (appExtVrsId). When provided, pins the install to that specific
  // historical version - the same downgrade mechanism MuffinStore uses - instead of the latest.
  externalVersionId?: string;
  onProgress?: (message: string) => void;
  waitTimeoutMs?: number;
}

export async function installFromAppStore(bundleId: string, options: AppStoreInstallOptions = {}): Promise<void> {
  const { externalVersionId, onProgress, waitTimeoutMs = 5 * 60_000 } = options;

  if (!SAFE_BUNDLE_ID_RE.test(bundleId)) {
    throw new Error(`refusing to install App Store app with unsafe bundleId: ${JSON.stringify(bundleId)}`);
  }
  const versionId = externalVersionId && APP_EXT_VERSION_ID_RE.test(externalVersionId) ? Number(externalVersionId) : undefined;
  if (externalVersionId && versionId === undefined) {
    throw new Error(`refusing to install with non-numeric externalVersionId: ${JSON.stringify(externalVersionId)}`);
  }

  const report = (message: string) => {
    log.info(message, { bundleId, externalVersionId });
    onProgress?.(message);
  };

  report('resolving App Store id for bundle');
  const { trackId } = await lookupCurrentVersion(bundleId);

  await withSSH(primaryRootDir(), async (conn) => {
    // When pinning a specific version we always (re)install so the on-device version matches the
    // request; for the latest version, an already-installed copy is good enough to decrypt.
    if (!versionId) {
      const existing = await findInstalledAppStoreBundle(conn, bundleId);
      if (existing) {
        report('app already installed on device, skipping App Store install');
        return;
      }
    }

    report('bringing the App Store to the foreground');
    await ensureAppStoreForeground(conn);

    try {
      report('arming headless auto-confirm and sending install request');
      await armAppStoreAutoConfirm(conn, 'Install');

      const request: Record<string, unknown> = { action: 'install', adamId: trackId, contextMode: 'fallback' };
      if (versionId !== undefined) request.versionId = versionId;
      await sendAppStoreBridgeRequest(conn, request);
      report(
        versionId !== undefined
          ? `App Store accepted the install request (version ${versionId}), waiting for it to land`
          : 'App Store accepted the install request, waiting for it to land',
      );

      const start = Date.now();
      const deadline = start + waitTimeoutMs;
      let lastReportedAt = 0;
      while (Date.now() < deadline) {
        const bundlePath = await findInstalledAppStoreBundle(conn, bundleId);
        if (bundlePath) {
          report(`install complete in ${Math.round((Date.now() - start) / 1000)}s`);
          return;
        }
        const elapsedSec = Math.round((Date.now() - start) / 1000);
        if (elapsedSec - lastReportedAt >= 10) {
          lastReportedAt = elapsedSec;
          report(`still waiting for the App Store to finish installing (${elapsedSec}s elapsed)`);
        }
        await new Promise((r) => setTimeout(r, 5_000));
      }
      throw new Error(`timed out waiting for ${bundleId} to install from the App Store after ${Math.round(waitTimeoutMs / 1000)}s`);
    } finally {
      await clearAppStoreAutoConfirm(conn).catch(() => {});
    }
  });
}
