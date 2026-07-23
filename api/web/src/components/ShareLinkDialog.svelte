<script lang="ts">
  import CopyButton from './CopyButton.svelte';
  import RelativeTime from './RelativeTime.svelte';
  import { fetchShareLinks, revokeAllShareLinks, revokeShareLink, shareJobFile, type ShareLinkRecord } from '../lib/api';
  import Badge from '../lib/components/ui/Badge.svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import Dialog from '../lib/components/ui/Dialog.svelte';
  import Select from '../lib/components/ui/Select.svelte';
  import { fmtUntil } from '../lib/format';

  let { open = $bindable(), jobId, onOpenChange }: { open: boolean; jobId: string; onOpenChange: (open: boolean) => void } = $props();

  const TTL_OPTIONS = [
    { value: '5', label: '5 minutes' },
    { value: '30', label: '30 minutes' },
    { value: '60', label: '1 hour' },
    { value: '360', label: '6 hours' },
    { value: '1440', label: '24 hours' },
  ];
  const LAST_TTL_KEY = 'shareLinkLastTtlMinutes';

  let ttlMinutes = $state(localStorage.getItem(LAST_TTL_KEY) ?? '30');
  let url = $state('');
  let expiresAt = $state(0);
  let loading = $state(false);
  let links = $state<ShareLinkRecord[] | null>(null);
  let revoking = $state<Set<string>>(new Set());
  let revokingAll = $state(false);

  async function loadLinks(): Promise<void> {
    links = (await fetchShareLinks(jobId)).links;
  }

  async function generate(): Promise<void> {
    loading = true;
    try {
      localStorage.setItem(LAST_TTL_KEY, ttlMinutes);
      const { ok, data } = await shareJobFile(jobId, Number(ttlMinutes));
      if (!ok) return;
      url = data.url;
      expiresAt = data.expiresAt;
      void loadLinks();
    } finally {
      loading = false;
    }
  }

  async function revokeAll(): Promise<void> {
    revokingAll = true;
    try {
      const { ok } = await revokeAllShareLinks(jobId);
      if (ok) void loadLinks();
    } finally {
      revokingAll = false;
    }
  }

  async function revoke(linkId: string): Promise<void> {
    revoking = new Set(revoking).add(linkId);
    try {
      const { ok } = await revokeShareLink(linkId);
      if (ok) void loadLinks();
    } finally {
      const next = new Set(revoking);
      next.delete(linkId);
      revoking = next;
    }
  }

  $effect(() => {
    if (open) {
      url = '';
      links = null;
      void generate();
      void loadLinks();
    }
  });

  function linkStatus(l: ShareLinkRecord): 'active' | 'revoked' | 'expired' {
    if (l.revoked) return 'revoked';
    if (l.expiresAt <= Date.now()) return 'expired';
    return 'active';
  }

  const activeCount = $derived((links ?? []).filter((l) => linkStatus(l) === 'active').length);
</script>

<Dialog {open} {onOpenChange} class="max-w-sm">
  <div class="mb-1 text-sm font-medium">Share download link</div>
  <div class="mb-3 text-xs text-muted">
    Anyone with this link can download once, no sign-in required.
  </div>
  <label for="share-ttl" class="mb-1 block text-xs text-muted">Expires</label>
  <Select id="share-ttl" items={TTL_OPTIONS} bind:value={ttlMinutes} class="w-full" onValueChange={generate} />
  {#if loading}
    <div class="mt-3 text-sm text-muted">Generating…</div>
  {:else if url}
    <div class="border-border bg-panel-muted mt-3 rounded-md border p-2.5 text-xs break-all">
      <code>{url}</code>
      <div class="mt-2 flex items-center justify-between gap-2">
        <CopyButton text={url} label="Copy link" />
        <span class="text-muted">expires in {fmtUntil(expiresAt)}</span>
      </div>
    </div>
  {/if}
  <Button variant="secondary" size="sm" class="mt-3 w-full" loading={loading} onclick={generate}>Regenerate</Button>

  {#if links && links.length > 0}
    <div class="border-border mt-4 border-t pt-3">
      <div class="mb-2 flex items-center justify-between gap-2">
        <span class="text-xs text-muted">Issued links for this job</span>
        {#if activeCount > 0}
          <Button size="sm" variant="destructive" loading={revokingAll} onclick={revokeAll}>Revoke {activeCount} active</Button>
        {/if}
      </div>
      <div class="flex flex-col gap-1.5">
        {#each links as l (l.id)}
          {@const status = linkStatus(l)}
          <div class="border-border flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <Badge variant={status === 'active' ? 'success' : status === 'revoked' ? 'destructive' : 'secondary'}>{status}</Badge>
                <span class="text-muted">by {l.issuedBy}</span>
                {#if l.usedAt}
                  <Badge variant="secondary" title="A download was attempted with this link">downloaded</Badge>
                {/if}
              </div>
              <div class="text-muted mt-0.5">
                <RelativeTime ms={l.issuedAt} /> · expires {fmtUntil(l.expiresAt)}
                {#if l.usedAt}
                  · downloaded <RelativeTime ms={l.usedAt} />
                {/if}
              </div>
            </div>
            {#if status === 'active'}
              <Button size="sm" variant="destructive" loading={revoking.has(l.id)} onclick={() => revoke(l.id)}>Revoke</Button>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</Dialog>
