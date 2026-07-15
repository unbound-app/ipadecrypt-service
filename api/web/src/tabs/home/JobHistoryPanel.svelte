<script lang="ts">
  import RelativeTime from '../../components/RelativeTime.svelte';
  import SkeletonRows from '../../components/SkeletonRows.svelte';
  import { fetchJobHistory, queueDecrypt, type JobHistoryEntry } from '../../lib/api';
  import { addDecrypt, pushRecentBundleId } from '../../lib/decrypts.svelte';
  import { fmtSize } from '../../lib/format';
  import { liveState } from '../../lib/live.svelte';
  import { showToast } from '../../lib/ui.svelte';

  const PAGE_SIZE = 15;

  let entries = $state<JobHistoryEntry[]>([]);
  let total = $state(0);
  let loaded = $state(false);
  let loadingMore = $state(false);
  let seenIds = new Set<string>();

  async function loadInitial(): Promise<void> {
    const data = await fetchJobHistory(0, PAGE_SIZE);
    entries = data.history;
    total = data.total;
    seenIds = new Set(entries.map((e) => e.id));
    loaded = true;
  }

  async function loadMore(): Promise<void> {
    loadingMore = true;
    try {
      const data = await fetchJobHistory(entries.length, PAGE_SIZE);
      const additions = data.history.filter((e) => !seenIds.has(e.id));
      for (const e of additions) seenIds.add(e.id);
      entries = [...entries, ...additions];
      total = data.total;
    } finally {
      loadingMore = false;
    }
  }

  $effect(() => {
    void loadInitial();
  });

  $effect(() => {
    for (const h of liveState.historyAdditions) {
      if (!seenIds.has(h.id)) {
        entries = [h, ...entries];
        seenIds.add(h.id);
        total += 1;
      }
    }
  });

  async function decryptAgain(bundleId: string): Promise<void> {
    const { ok, data } = await queueDecrypt(bundleId);
    if (!ok) return;
    addDecrypt({ id: data.id, bundleId, trackName: bundleId, status: data.status, progress: data.progress, queue: data.queue });
    pushRecentBundleId(bundleId);
    showToast(`Queued ${bundleId}`, 'success');
  }
</script>

<div class="panel">
  <h2>Job history</h2>
  <div class="table-wrap">
    <table class="min-w">
      <thead>
        <tr>
          <th>Bundle ID</th>
          <th>Source</th>
          <th>Status</th>
          <th>Size</th>
          <th>Finished</th>
          <th>Error</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#if !loaded}
          <SkeletonRows rows={4} colspan={7} />
        {:else}
          {#each entries as j (j.id)}
            <tr>
              <td>{j.bundleId}</td>
              <td>{j.source}</td>
              <td><span class="badge {j.status}">{j.status}</span></td>
              <td>{fmtSize(j.sizeBytes)}</td>
              <td class="muted"><RelativeTime ms={j.finishedAt} /></td>
              <td class="muted">{j.error ?? ''}</td>
              <td><button class="action small secondary" onclick={() => decryptAgain(j.bundleId)}>Decrypt again</button></td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
  {#if loaded && entries.length < total}
    <div class="row" style="justify-content:center;">
      <button class="action small secondary" style="margin-top:12px;" disabled={loadingMore} onclick={loadMore}>
        Load more ({total - entries.length} older)
      </button>
    </div>
  {/if}
</div>
