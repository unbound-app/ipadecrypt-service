<script lang="ts">
  import { RefreshCw } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import CopyButton from '../../components/CopyButton.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import RelativeTime from '../../components/RelativeTime.svelte';
  import { fetchAllShareLinks, revokeShareLink, type ShareLinkRecord } from '../../lib/api';
  import Badge from '../../lib/components/ui/Badge.svelte';
  import Button from '../../lib/components/ui/Button.svelte';
  import Card from '../../lib/components/ui/Card.svelte';
  import { fmtUntil } from '../../lib/format';

  let links = $state<ShareLinkRecord[] | null>(null);
  let loading = $state(false);
  let revoking = $state<Set<string>>(new Set());

  async function load(): Promise<void> {
    loading = true;
    try {
      links = (await fetchAllShareLinks()).links;
    } finally {
      loading = false;
    }
  }

  async function revoke(linkId: string): Promise<void> {
    revoking = new Set(revoking).add(linkId);
    try {
      const { ok } = await revokeShareLink(linkId);
      if (ok) await load();
    } finally {
      const next = new Set(revoking);
      next.delete(linkId);
      revoking = next;
    }
  }

  onMount(load);

  function linkStatus(l: ShareLinkRecord): 'active' | 'revoked' | 'expired' | 'exhausted' {
    if (l.revoked) return 'revoked';
    if (l.expiresAt <= Date.now()) return 'expired';
    if (l.maxDownloads !== undefined && l.downloadCount >= l.maxDownloads) return 'exhausted';
    return 'active';
  }

  function statusVariant(status: ReturnType<typeof linkStatus>): 'success' | 'destructive' | 'secondary' {
    if (status === 'active') return 'success';
    if (status === 'revoked') return 'destructive';
    return 'secondary';
  }

  function downloadsLabel(l: ShareLinkRecord): string {
    return l.maxDownloads !== undefined ? `${l.downloadCount}/${l.maxDownloads}` : `${l.downloadCount}`;
  }
</script>

<Card title="Share links">
  {#snippet headerExtra()}
    <button
      type="button"
      class="text-muted hover:text-text disabled:opacity-50"
      disabled={loading}
      onclick={load}
      aria-label="Refresh"
      title="Refresh"
    >
      <RefreshCw class="h-3.5 w-3.5 {loading ? 'animate-spin' : ''}" />
    </button>
  {/snippet}
  <div class="mb-3 text-xs text-muted">Every download share link issued across all jobs. Copy or revoke any of them.</div>

  {#if links && links.length === 0}
    <EmptyState message="No share links have been issued." />
  {:else if links}
    <div class="flex flex-col gap-1.5">
      {#each links as l (l.id)}
        {@const status = linkStatus(l)}
        <div class="border-border flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5">
              <Badge variant={statusVariant(status)}>{status}</Badge>
              <span class="truncate font-mono" title={l.bundleId}>{l.bundleId}</span>
              <span class="text-muted">· {downloadsLabel(l)} downloads · by {l.issuedBy}</span>
            </div>
            <div class="text-muted mt-0.5">
              <RelativeTime ms={l.issuedAt} /> · expires {fmtUntil(l.expiresAt)}
              {#if l.lastUsedAt}
                · last used <RelativeTime ms={l.lastUsedAt} />
              {/if}
            </div>
            {#if l.url}
              <div class="mt-1.5 flex items-center gap-2">
                <code class="min-w-0 flex-1 truncate rounded bg-panel-muted px-1.5 py-1" title={l.url}>{l.url}</code>
                {#if status === 'active'}
                  <CopyButton text={l.url} label="Copy" />
                {/if}
              </div>
            {/if}
          </div>
          {#if status === 'active'}
            <Button size="sm" variant="destructive" loading={revoking.has(l.id)} onclick={() => revoke(l.id)}>Revoke</Button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</Card>
