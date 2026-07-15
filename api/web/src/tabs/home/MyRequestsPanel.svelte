<script lang="ts">
  import { PackageSearch } from 'lucide-svelte';
  import { fetchJobStatus } from '../../lib/api';
  import EmptyState from '../../components/EmptyState.svelte';
  import Badge from '../../lib/components/ui/Badge.svelte';
  import Button from '../../lib/components/ui/Button.svelte';
  import Card from '../../lib/components/ui/Card.svelte';
  import { buttonVariants } from '../../lib/components/ui/variants';
  import { dismissDecrypt, myDecryptsState, updateDecrypt } from '../../lib/decrypts.svelte';

  let pollTimer: ReturnType<typeof setTimeout> | undefined;

  async function poll(): Promise<void> {
    clearTimeout(pollTimer);
    const pending = myDecryptsState.items.filter((d) => d.status !== 'done' && d.status !== 'failed');
    if (pending.length === 0) return;

    for (const d of pending) {
      try {
        const data = await fetchJobStatus(d.id);
        updateDecrypt(d.id, { status: data.status, progress: data.progress, queue: data.queue, error: data.error });
      } catch {}
    }

    pollTimer = setTimeout(poll, 2500);
  }

  $effect(() => {
    void poll();
    return () => clearTimeout(pollTimer);
  });
</script>

<Card title="My requests">
  {#if myDecryptsState.items.length === 0}
    <EmptyState icon={PackageSearch} message="Nothing queued yet - search above." />
  {:else}
    <table>
      <thead>
        <tr>
          <th>App</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each myDecryptsState.items as d (d.id)}
          <tr>
            <td>
              {d.trackName}
              {#if d.versionLabel}
                <span class="text-muted text-xs">({d.versionLabel})</span>
              {/if}
            </td>
            <td>
              {#if d.status === 'done'}
                <Badge variant="success">done</Badge>
              {:else if d.status === 'failed'}
                <Badge variant="destructive">failed</Badge> <span class="text-muted">{d.error ?? ''}</span>
              {:else if d.status === 'running'}
                <Badge>running</Badge> <span class="text-muted">{d.progress ?? ''}</span>
              {:else}
                <Badge>queued</Badge>
                <span class="text-muted">{d.queue ? `position ${d.queue.position} of ${d.queue.total}` : ''}</span>
              {/if}
            </td>
            <td>
              {#if d.status === 'done'}
                <a class={buttonVariants('default', 'sm')} href="/v1/dashboard/jobs/{d.id}/file">Download</a>
              {:else}
                <Button size="sm" variant="secondary" onclick={() => dismissDecrypt(d.id)}>Dismiss</Button>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Card>
