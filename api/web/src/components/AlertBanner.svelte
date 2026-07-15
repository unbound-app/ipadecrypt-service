<script lang="ts">
  import { clearAuthAlert } from '../lib/api';
  import { fmtRelative, fmtTime } from '../lib/format';
  import { liveState } from '../lib/live.svelte';
  import { sessionState } from '../lib/session.svelte';

  const alert = $derived(liveState.overview?.appleAuthAlert);

  async function dismiss(): Promise<void> {
    await clearAuthAlert();
  }
</script>

{#if alert?.suspected}
  <div class="alert">
    ⚠️ App Store auth may need re-authentication (last error <span title={fmtTime(alert.lastErrorAt)}>{fmtRelative(alert.lastErrorAt)}</span>):
    <code>{alert.lastError ?? ''}</code>
    {#if sessionState.role === 'admin'}
      <div><button class="action small secondary" onclick={dismiss}>Dismiss</button></div>
    {/if}
  </div>
{/if}
