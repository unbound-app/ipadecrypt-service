import webpush from 'web-push';
import { scopedLogger } from './logger.js';
import { getOrCreateVapidKeys, getPushSubscriptions, removePushSubscription } from './store/state.js';

const log = scopedLogger('push');

let configured = false;

// A generic placeholder, not PUBLIC_BASE_URL - VAPID's subject must be `https:` or `mailto:` and
// setVapidDetails throws synchronously otherwise, which would take the whole process down the
// moment a push fires under a plain `http://` dev/LAN deployment (PUBLIC_BASE_URL has no such
// requirement anywhere else, so it can't be relied on here).
const VAPID_SUBJECT = 'mailto:push@dkrypt.local';

function ensureConfigured(): void {
  if (configured) return;
  const { publicKey, privateKey } = getOrCreateVapidKeys();
  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
  configured = true;
}

export function getVapidPublicKey(): string {
  return getOrCreateVapidKeys().publicKey;
}

export interface PushPayload {
  title: string;
  body: string;
}

// Fans a payload out to every browser the user has subscribed from - a stale subscription (the
// browser dropped it, or its push service says it's gone for good) is pruned instead of retried.
// Never throws - a bad subscription or misconfiguration should drop a notification, not take
// down the request (or, for the queue worker's fire-and-forget call, the whole process).
export async function sendPushToUser(username: string, payload: PushPayload): Promise<void> {
  try {
    ensureConfigured();
    const subs = getPushSubscriptions(username);
    if (subs.length === 0) return;

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(sub, JSON.stringify(payload));
        } catch (err) {
          const statusCode = err instanceof webpush.WebPushError ? err.statusCode : undefined;
          if (statusCode === 404 || statusCode === 410) {
            removePushSubscription(username, sub.endpoint);
            return;
          }
          log.warn('push send failed', { username, error: String(err) });
        }
      }),
    );
  } catch (err) {
    log.warn('push send failed', { username, error: String(err) });
  }
}
