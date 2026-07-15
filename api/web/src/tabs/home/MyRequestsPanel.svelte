<script lang="ts">
  import { fetchJobStatus } from '../../lib/api';
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

<div class="panel">
  <h2>My requests</h2>
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
          <td>{d.trackName}</td>
          <td>
            {#if d.status === 'done'}
              <span class="badge done">done</span>
            {:else if d.status === 'failed'}
              <span class="badge failed">failed</span> <span class="muted">{d.error ?? ''}</span>
            {:else if d.status === 'running'}
              <span class="badge running">running</span> <span class="muted">{d.progress ?? ''}</span>
            {:else}
              <span class="badge queued">queued</span>
              <span class="muted">{d.queue ? `position ${d.queue.position} of ${d.queue.total}` : ''}</span>
            {/if}
          </td>
          <td>
            {#if d.status === 'done'}
              <a class="action small" href="/v1/dashboard/jobs/{d.id}/file">Download</a>
            {:else}
              <button class="action small secondary" onclick={() => dismissDecrypt(d.id)}>Dismiss</button>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  {#if myDecryptsState.items.length === 0}
    <div class="muted">Nothing queued yet - search above.</div>
  {/if}
</div>
