<script lang="ts">
  import { queueDecrypt, searchApps, type AppStoreSearchResult } from '../../lib/api';
  import { addDecrypt, myDecryptsState, pushRecentBundleId, recentBundleIdsState } from '../../lib/decrypts.svelte';
  import { debounce } from '../../lib/format';
  import { liveState } from '../../lib/live.svelte';
  import { showToast } from '../../lib/ui.svelte';

  let term = $state('');
  let results = $state<AppStoreSearchResult[]>([]);
  let loading = $state(false);
  let searched = $state(false);
  let highlighted = $state(-1);
  let inputEl: HTMLInputElement | undefined = $state();

  const statusByBundle = $derived.by(() => {
    const map = new Map<string, string>();
    for (const d of myDecryptsState.items) map.set(d.bundleId, d.status);
    for (const j of liveState.overview?.activeJobs ?? []) if (!map.has(j.bundleId)) map.set(j.bundleId, j.status);
    return map;
  });

  async function runSearch(q: string): Promise<void> {
    const trimmed = q.trim();
    if (!trimmed) {
      results = [];
      searched = false;
      return;
    }
    loading = true;
    try {
      const data = await searchApps(trimmed);
      if ('error' in data) {
        showToast(data.error, 'error');
        results = [];
      } else {
        results = data.results;
      }
      searched = true;
      highlighted = -1;
    } finally {
      loading = false;
    }
  }

  const debouncedSearch = debounce((q: string) => void runSearch(q), 400);

  function onInput(): void {
    if (!term.trim()) {
      results = [];
      searched = false;
      return;
    }
    debouncedSearch(term);
  }

  async function queue(bundleId: string, trackName: string): Promise<void> {
    const { ok, data } = await queueDecrypt(bundleId);
    if (!ok) return;
    addDecrypt({ id: data.id, bundleId, trackName, status: data.status, progress: data.progress, queue: data.queue });
    pushRecentBundleId(bundleId);
    showToast(`Queued ${trackName}`, 'success');
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = highlighted >= 0 ? results[highlighted] : undefined;
      if (target && target.price === 0) void queue(target.bundleId, target.trackName);
      else void runSearch(term);
    } else if (e.key === 'ArrowDown' && results.length > 0) {
      e.preventDefault();
      highlighted = Math.min(highlighted + 1, results.length - 1);
    } else if (e.key === 'ArrowUp' && results.length > 0) {
      e.preventDefault();
      highlighted = Math.max(highlighted - 1, -1);
    }
  }

  function pickRecent(bundleId: string): void {
    term = bundleId;
    void runSearch(bundleId);
  }

  export function focusSearch(): void {
    inputEl?.focus();
  }
</script>

<div class="panel">
  <h2>Decrypt an app</h2>
  <div class="row">
    <input
      bind:this={inputEl}
      bind:value={term}
      oninput={onInput}
      onkeydown={onKeydown}
      placeholder="Search the App Store to decrypt… (press / to focus)"
    />
    <button class="action" style="margin-top:0;" onclick={() => runSearch(term)}>Search</button>
  </div>

  {#if !term.trim() && recentBundleIdsState.items.length > 0}
    <div class="recent-chips">
      {#each recentBundleIdsState.items as bundleId (bundleId)}
        <button class="chip" onclick={() => pickRecent(bundleId)}>{bundleId}</button>
      {/each}
    </div>
  {/if}

  <div class="results">
    {#if loading}
      <div class="muted">Searching…</div>
    {:else if searched && results.length === 0}
      <div class="muted">No results.</div>
    {:else}
      {#each results as r, i (r.bundleId)}
        <div class="search-result" class:highlighted={i === highlighted}>
          {#if r.artworkUrl}
            <img src={r.artworkUrl} alt="" />
          {/if}
          <div class="meta">
            <div class="name">{r.trackName}</div>
            <div class="sub" title={r.bundleId}>{r.bundleId} · v{r.version} · {r.sellerName}</div>
          </div>
          {#if r.price > 0}
            <span class="badge failed" title="ipadecrypt only supports free apps">Paid</span>
          {:else if statusByBundle.has(r.bundleId)}
            <span class="badge {statusByBundle.get(r.bundleId)}">{statusByBundle.get(r.bundleId)}</span>
          {:else}
            <button class="action small" onclick={() => queue(r.bundleId, r.trackName)}>Decrypt</button>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .results {
    margin-top: 14px;
  }

  .recent-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }

  .chip {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--muted);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11.5px;
    font-family: ui-monospace, monospace;
    cursor: pointer;
  }

  .chip:hover {
    color: var(--text);
    border-color: var(--accent);
  }
</style>
