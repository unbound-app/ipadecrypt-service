<script lang="ts">
  import { LoaderCircle } from 'lucide-svelte';
  import { queueDecrypt } from '../lib/api';
  import Button from '../lib/components/ui/Button.svelte';
  import Dialog from '../lib/components/ui/Dialog.svelte';
  import { addDecrypt, pushRecentBundleId } from '../lib/decrypts.svelte';
  import { requestNotificationPermission } from '../lib/notifications';
  import { showToast } from '../lib/ui.svelte';
  import { cn } from '../lib/utils';

  let { open = $bindable(), onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void } = $props();

  const MAX_BUNDLE_IDS = 50;
  const BUNDLE_ID_RE = /^[A-Za-z0-9.-]{3,200}$/;

  let text = $state('');
  let submitting = $state(false);
  let results = $state<{ bundleId: string; state: 'pending' | 'ok' | 'error'; error?: string }[]>([]);

  function parseBundleIds(raw: string): string[] {
    const ids = raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return [...new Set(ids)].slice(0, MAX_BUNDLE_IDS);
  }

  const parsed = $derived(parseBundleIds(text));

  function close(): void {
    if (submitting) return;
    text = '';
    results = [];
    onOpenChange(false);
  }

  async function submit(): Promise<void> {
    const ids = parsed;
    if (ids.length === 0) return;
    requestNotificationPermission();
    submitting = true;
    results = ids.map((bundleId) => ({ bundleId, state: 'pending' }));

    let ok = 0;
    for (const bundleId of ids) {
      if (!BUNDLE_ID_RE.test(bundleId)) {
        results = results.map((r) => (r.bundleId === bundleId ? { ...r, state: 'error', error: "doesn't look like a bundle ID" } : r));
        continue;
      }
      try {
        const { ok: queuedOk, data } = await queueDecrypt(bundleId);
        if (!queuedOk) {
          results = results.map((r) => (r.bundleId === bundleId ? { ...r, state: 'error', error: 'rejected' } : r));
          continue;
        }
        addDecrypt({ id: data.id, bundleId, trackName: bundleId, status: data.status, progress: data.progress, queue: data.queue });
        pushRecentBundleId(bundleId);
        results = results.map((r) => (r.bundleId === bundleId ? { ...r, state: 'ok' } : r));
        ok += 1;
      } catch {
        results = results.map((r) => (r.bundleId === bundleId ? { ...r, state: 'error', error: 'request failed' } : r));
      }
    }

    submitting = false;
    showToast(`Queued ${ok} of ${ids.length}${ok < ids.length ? ` - ${ids.length - ok} failed` : ''}`, ok === ids.length ? 'success' : 'error');
  }
</script>

<Dialog {open} onOpenChange={(v) => !v && close()} class="max-w-md">
  <div class="mb-1 text-sm font-medium">Batch decrypt</div>
  <div class="mb-3 text-xs text-muted">One bundle ID per line, or comma-separated. Up to {MAX_BUNDLE_IDS} at once.</div>

  {#if results.length === 0}
    <textarea
      bind:value={text}
      disabled={submitting}
      placeholder={'com.example.app\ncom.example.app2\ncom.example.app3'}
      rows="6"
      class="border-border bg-panel-muted focus:border-accent w-full rounded-md border px-3 py-2 font-mono text-xs text-text focus:outline-none disabled:opacity-60"
    ></textarea>
    <div class="mt-1.5 text-xs text-muted">{parsed.length} bundle ID{parsed.length === 1 ? '' : 's'} recognized</div>
    <Button class="mt-3 w-full" disabled={parsed.length === 0} loading={submitting} onclick={submit}>Queue all</Button>
  {:else}
    <div class="flex max-h-72 flex-col gap-1 overflow-y-auto">
      {#each results as r (r.bundleId)}
        <div class="flex items-center gap-2 text-xs">
          {#if r.state === 'pending'}
            <LoaderCircle class="h-3.5 w-3.5 shrink-0 animate-spin text-muted" />
          {:else if r.state === 'ok'}
            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-ok"></span>
          {:else}
            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-err"></span>
          {/if}
          <span class={cn('truncate font-mono', r.state === 'error' && 'text-err')}>{r.bundleId}</span>
          {#if r.error}<span class="text-muted">- {r.error}</span>{/if}
        </div>
      {/each}
    </div>
    <Button variant="secondary" class="mt-3 w-full" disabled={submitting} onclick={close}>Close</Button>
  {/if}
</Dialog>
