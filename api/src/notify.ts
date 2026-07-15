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
