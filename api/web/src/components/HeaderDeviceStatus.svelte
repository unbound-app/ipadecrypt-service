<script lang="ts">
  import { CircleCheck, TriangleAlert } from 'lucide-svelte';
  import { fetchDeviceHealth, type DeviceHealth } from '../lib/api';
  import Badge from '../lib/components/ui/Badge.svelte';
  import Popover from '../lib/components/ui/Popover.svelte';
  import { liveState } from '../lib/live.svelte';

  const devices = $derived(liveState.overview?.devices.filter((d) => d.enabled) ?? []);

  let healthById = $state<Record<string, DeviceHealth>>({});

  $effect(() => {
    const ids = devices.map((d) => d.id);
    if (ids.length === 0) return;
    const load = () => {
      for (const id of ids) {
        void fetchDeviceHealth(id).then((h) => {
          healthById = { ...healthById, [id]: h };
        });
      }
    };
    load();
    const interval = setInterval(load, 20_000);
    return () => clearInterval(interval);
  });

  const unreachable = $derived(devices.filter((d) => healthById[d.id]?.reachable === false));
</script>

{#if devices.length > 0}
  <Popover triggerClass="inline-flex">
    {#snippet trigger()}
      <Badge variant={unreachable.length > 0 ? 'destructive' : 'secondary'} title="Device status">
        {#if unreachable.length > 0}
          <TriangleAlert class="mr-1 inline h-3 w-3" />
        {:else}
          <CircleCheck class="mr-1 inline h-3 w-3" />
        {/if}
        {devices.length - unreachable.length}/{devices.length} online
      </Badge>
    {/snippet}
    <div class="flex flex-col gap-1.5">
      {#each devices as d (d.id)}
        {@const h = healthById[d.id]}
        <div class="flex items-center justify-between gap-4 whitespace-nowrap">
          <span>{d.name}{d.isPrimary ? ' (primary)' : ''}</span>
          <span class={h?.reachable === false ? 'text-err' : 'text-muted'}>
            {h === undefined ? 'checking…' : h.reachable ? 'online' : 'offline'}
          </span>
        </div>
      {/each}
    </div>
  </Popover>
{/if}
