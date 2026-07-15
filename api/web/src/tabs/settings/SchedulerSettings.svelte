<script lang="ts">
  import { fetchSettings, saveSettings, testWebhook, validateCron, type SchedulerSettings } from '../../lib/api';
  import { debounce } from '../../lib/format';
  import { liveState } from '../../lib/live.svelte';
  import { confirmDialog, showToast } from '../../lib/ui.svelte';

  const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

  let form = $state<SchedulerSettings>({
    watchBundleId: '',
    watchAppRepo: '',
    ghDispatchRepo: '',
    ghWorkflowFile: '',
    pollCron: '',
    notifyWebhookUrl: '',
  });
  let cronValid = $state<boolean | null>(null);
  let testingWebhook = $state(false);

  $effect(() => {
    void fetchSettings().then((s) => {
      form = { ...s };
    });
  });

  const checkCron = debounce(async (expr: string) => {
    if (!expr) {
      cronValid = null;
      return;
    }
    const { valid } = await validateCron(expr);
    cronValid = valid;
  }, 400);

  $effect(() => {
    checkCron(form.pollCron);
  });

  const repoErrors = $derived({
    watchAppRepo: form.watchAppRepo && !REPO_RE.test(form.watchAppRepo) ? "Expected owner/repo" : '',
    ghDispatchRepo: form.ghDispatchRepo && !REPO_RE.test(form.ghDispatchRepo) ? "Expected owner/repo" : '',
  });

  function wouldDisableScheduler(): boolean {
    if (!liveState.overview?.schedulerEnabled) return false;
    return form.watchBundleId === '' || form.watchAppRepo === '' || form.ghDispatchRepo === '';
  }

  async function save(): Promise<void> {
    if (cronValid === false) {
      showToast('Poll cron is not a valid cron expression', 'error');
      return;
    }
    if (repoErrors.watchAppRepo || repoErrors.ghDispatchRepo) {
      showToast('Fix the repo fields before saving', 'error');
      return;
    }
    if (wouldDisableScheduler()) {
      if (!(await confirmDialog('This will disable the scheduler (a required field is empty). Save anyway?'))) return;
    }
    const { ok, data } = await saveSettings(form);
    if (ok) form = { ...data };
  }

  async function runTestWebhook(): Promise<void> {
    testingWebhook = true;
    try {
      const { data } = await testWebhook();
      showToast(data.ok ? 'Test notification sent' : (data.error ?? 'Failed to send'), data.ok ? 'success' : 'error');
    } finally {
      testingWebhook = false;
    }
  }
</script>

<div class="panel">
  <h2>Automated watch → GitHub dispatch</h2>
  <label for="s-watchBundleId">Watch bundle ID</label>
  <input id="s-watchBundleId" bind:value={form.watchBundleId} />

  <label for="s-watchAppRepo">Watch app repo (releases tracked here)</label>
  <input id="s-watchAppRepo" bind:value={form.watchAppRepo} />
  {#if repoErrors.watchAppRepo}
    <div class="field-error">{repoErrors.watchAppRepo}</div>
  {/if}

  <label for="s-ghDispatchRepo">GitHub dispatch repo (owns the workflow)</label>
  <input id="s-ghDispatchRepo" bind:value={form.ghDispatchRepo} />
  {#if repoErrors.ghDispatchRepo}
    <div class="field-error">{repoErrors.ghDispatchRepo}</div>
  {/if}

  <label for="s-ghWorkflowFile">Workflow file</label>
  <input id="s-ghWorkflowFile" bind:value={form.ghWorkflowFile} />

  <label for="s-pollCron">Poll cron</label>
  <input id="s-pollCron" bind:value={form.pollCron} />
  {#if cronValid === false}
    <div class="field-error">Not a valid cron expression</div>
  {/if}

  <label for="s-notifyWebhookUrl">Notification webhook URL (Discord-compatible, optional)</label>
  <div class="row">
    <input id="s-notifyWebhookUrl" bind:value={form.notifyWebhookUrl} />
    <button class="action secondary small" style="margin-top:0;" disabled={testingWebhook} onclick={runTestWebhook}>
      Test
    </button>
  </div>

  <button class="action" onclick={save}>Save</button>
</div>

<style>
  .field-error {
    color: var(--err);
    font-size: 12px;
    margin-top: 4px;
  }
</style>
