<script lang="ts">
  import { WifiOff } from 'lucide-svelte';
  import { liveState } from '../lib/live.svelte';

  const showWarning = $derived(liveState.overview !== null && !liveState.connected);
</script>

{#if showWarning}
  <div class="mb-4 flex items-center gap-2.5 rounded-lg border border-warn/40 bg-warn/10 px-3.5 py-3 text-[13px] text-warn">
    <WifiOff class="h-4 w-4 shrink-0" />
    Live updates disconnected - what you're seeing may be stale. Reconnecting automatically…
  </div>
{/if}
