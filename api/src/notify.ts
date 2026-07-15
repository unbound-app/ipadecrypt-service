import { log } from './logger.js';
import { getEffectiveSettings } from './store/state.js';

export async function notify(message: string): Promise<void> {
  const url = getEffectiveSettings().notifyWebhookUrl;
  if (!url) return;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
    if (!res.ok) log.warn('notify webhook returned non-2xx', { status: res.status });
  } catch (err) {
    log.warn('notify webhook failed', { error: String(err) });
  }
}

export async function sendTestNotification(): Promise<{ ok: boolean; error?: string }> {
  const url = getEffectiveSettings().notifyWebhookUrl;
  if (!url) return { ok: false, error: 'no webhook URL configured' };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '🔔 dkrypt: test notification from the dashboard.' }),
    });
    if (!res.ok) return { ok: false, error: `webhook returned HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
