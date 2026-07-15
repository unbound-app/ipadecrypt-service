<script lang="ts">
  import RelativeTime from '../components/RelativeTime.svelte';
  import { fetchLogs, type LogEntry } from '../lib/api';
  import { liveState } from '../lib/live.svelte';

  let scopeFilter = $state(localStorage.getItem('logScopeFilter') ?? 'all');
  let levelFilter = $state(localStorage.getItem('logLevelFilter') ?? 'all');
  let searchText = $state('');
  let autoScroll = $state(localStorage.getItem('logAutoScroll') !== 'false');
  let initialLogs = $state<LogEntry[] | null>(null);
  let listEl: HTMLDivElement | undefined = $state();

  $effect(() => {
    void fetchLogs().then((d) => {
      initialLogs = d.logs;
    });
  });

  $effect(() => {
    localStorage.setItem('logScopeFilter', scopeFilter);
  });
  $effect(() => {
    localStorage.setItem('logLevelFilter', levelFilter);
  });
  $effect(() => {
    localStorage.setItem('logAutoScroll', String(autoScroll));
  });

  function entryKey(l: LogEntry): string {
    return `${l.ts}-${l.scope}-${l.level}-${l.message}`;
  }

  const combined = $derived.by((): LogEntry[] => {
    const seen = new Set<string>();
    const merged: LogEntry[] = [];
    for (const l of liveState.logs) {
      const key = entryKey(l);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(l);
      }
    }
    for (const l of initialLogs ?? []) {
      const key = entryKey(l);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(l);
      }
    }
    return merged;
  });

  function fmtLogMeta(meta?: Record<string, unknown>): string {
    if (!meta) return '';
    return Object.entries(meta)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(' ');
  }

  const scopes = $derived([...new Set(combined.map((l) => l.scope))].sort());

  const filtered = $derived(
    combined.filter(
      (l) =>
        (scopeFilter === 'all' || l.scope === scopeFilter) &&
        (levelFilter === 'all' || l.level === levelFilter) &&
        (searchText.trim() === '' ||
          l.message.toLowerCase().includes(searchText.trim().toLowerCase()) ||
          fmtLogMeta(l.meta).toLowerCase().includes(searchText.trim().toLowerCase())),
    ),
  );

  $effect(() => {
    filtered;
    if (autoScroll && listEl) listEl.scrollTop = 0;
  });
</script>

<div class="panel">
  <h2>Scheduler &amp; job logs</h2>
  <div class="log-filters">
    <div class="log-filter-group">
      <button class="action small secondary log-filter" class:active={scopeFilter === 'all'} onclick={() => (scopeFilter = 'all')}>
        All
      </button>
      {#each scopes as scope (scope)}
        <button class="action small secondary log-filter" class:active={scopeFilter === scope} onclick={() => (scopeFilter = scope)}>
          {scope}
        </button>
      {/each}
    </div>
    <select class="log-level-filter" bind:value={levelFilter}>
      <option value="all">All levels</option>
      <option value="info">Info</option>
      <option value="warn">Warnings</option>
      <option value="error">Errors</option>
    </select>
    <input style="width:auto; min-width:160px;" placeholder="Search logs…" bind:value={searchText} />
    <label class="row" style="margin:0; font-size:12px; gap:4px;">
      <input type="checkbox" bind:checked={autoScroll} />
      Auto-scroll to newest
    </label>
  </div>

  {#if initialLogs === null}
    <div class="log-list">
      {#each Array(6) as _, i (i)}
        <div class="skeleton-row" style="height:32px;"></div>
      {/each}
    </div>
  {:else}
    <div class="log-list" bind:this={listEl}>
      {#each filtered as l (entryKey(l))}
        <div class="log-entry">
          <span class="log-time"><RelativeTime ms={l.ts} /></span>
          <span class="badge loglevel-{l.level}">{l.level}</span>
          <span class="badge logscope">{l.scope}</span>
          <span class="log-msg">
            {l.message}
            {#if l.meta}
              <span class="log-meta">{fmtLogMeta(l.meta)}</span>
            {/if}
          </span>
        </div>
      {/each}
    </div>
    {#if filtered.length === 0}
      <div class="muted" style="margin-top:10px;">No log entries yet.</div>
    {/if}
  {/if}
</div>
