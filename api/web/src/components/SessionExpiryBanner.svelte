<script lang="ts">
  import { fmtCountdown } from '../lib/format';
  import { refreshSessionTtl, sessionState } from '../lib/session.svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import { showToast } from '../lib/ui.svelte';

  const WARN_WINDOW_MS = 5 * 60_000;

  let now = $state(Date.now());
  let refreshing = $state(false);

  $effect(() => {
    const timer = setInterval(() => {
      now = Date.now();
    }, 1000);
    return () => clearInterval(timer);
  });

  const remaining = $derived(sessionState.expiresAt ? sessionState.expiresAt - now : Infinity);
  const showWarning = $derived(sessionState.loggedIn && remaining <= WARN_WINDOW_MS && remaining > 0);

  async function staySignedIn(): Promise<void> {
    refreshing = true;
    try {
      const ok = await refreshSessionTtl();
      showToast(ok ? "You're signed in for another 12 hours" : 'Failed to extend session', ok ? 'success' : 'error');
    } finally {
      refreshing = false;
    }
  }
</script>

{#if showWarning}
  <div class="mb-4 flex items-center justify-between gap-3 rounded-lg border border-warn/40 bg-warn/10 px-3.5 py-3 text-[13px] text-warn">
    <span>Your session expires in {fmtCountdown(remaining)} - save your work or stay signed in.</span>
    <Button size="sm" variant="secondary" loading={refreshing} onclick={staySignedIn} class="shrink-0">Stay signed in</Button>
  </div>
{/if}
