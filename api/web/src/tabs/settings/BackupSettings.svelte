<script lang="ts">
  import { Download, TriangleAlert, Upload } from 'lucide-svelte';
  import { backupExportUrl, importBackup } from '../../lib/api';
  import Button from '../../lib/components/ui/Button.svelte';
  import Card from '../../lib/components/ui/Card.svelte';
  import { buttonVariants } from '../../lib/components/ui/variants';
  import { confirmDialog, showToast } from '../../lib/ui.svelte';

  let fileInput: HTMLInputElement | undefined = $state();
  let selectedFile: File | null = $state(null);
  let restoring = $state(false);

  function onFileChange(): void {
    selectedFile = fileInput?.files?.[0] ?? null;
  }

  async function restore(): Promise<void> {
    if (!selectedFile) return;
    const confirmed = await confirmDialog(
      `Restore from "${selectedFile.name}"? This replaces the allowlist, API keys, scheduler settings, job history, and audit log with what's in the file - anything added since it was exported is gone.`,
      { confirmLabel: 'Restore', variant: 'destructive' },
    );
    if (!confirmed) return;

    restoring = true;
    try {
      const text = await selectedFile.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        showToast('That file is not valid JSON', 'error');
        return;
      }
      const { ok } = await importBackup(payload);
      if (ok) {
        selectedFile = null;
        if (fileInput) fileInput.value = '';
      }
    } finally {
      restoring = false;
    }
  }
</script>

<div class="flex flex-col gap-4">
  <Card title="Export">
    <div class="mb-3 text-sm text-muted">
      Downloads the allowlist, API keys (metadata and hashes, not their plaintext), scheduler settings, job history,
      and audit log as one JSON file. Treat it like a set of password hashes - it's not directly usable by an
      attacker, but it's not something to post publicly either.
    </div>
    <a href={backupExportUrl()} download class={buttonVariants('default', 'default')}>
      <Download class="h-4 w-4" />
      Download backup
    </a>
  </Card>

  <Card title="Restore">
    <div class="mb-3 flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 px-3.5 py-3 text-[13px] text-warn">
      <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" />
      <div>Restoring replaces everything above with what's in the file. There's no undo besides restoring a newer backup.</div>
    </div>
    <input bind:this={fileInput} onchange={onFileChange} type="file" accept="application/json" class="hidden" id="backup-file" />
    <div class="flex flex-wrap items-center gap-2.5">
      <label for="backup-file" class={buttonVariants('secondary', 'default')}>
        <Upload class="h-4 w-4" />
        Choose file
      </label>
      {#if selectedFile}
        <span class="text-sm text-muted">{selectedFile.name}</span>
      {/if}
    </div>
    <Button class="mt-3" variant="destructive" disabled={!selectedFile} loading={restoring} onclick={restore}>Restore from backup</Button>
  </Card>
</div>
