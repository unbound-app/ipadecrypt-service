<script lang="ts">
  import { cancelAppleAuth, fetchAppleAuthStatus, startAppleAuth, submitAppleInput, type AppleAuthStatus } from '../../lib/api';

  type Step = 'idle' | 'connecting' | 'signing-in' | '2fa' | 'done' | 'failed';

  const STEPS: { id: Step; label: string }[] = [
    { id: 'connecting', label: 'Connecting' },
    { id: 'signing-in', label: 'Signing in' },
    { id: '2fa', label: '2FA' },
    { id: 'done', label: 'Done' },
  ];

  let status = $state<AppleAuthStatus | null>(null);
  let inputValue = $state('');
  let inputEl: HTMLInputElement | undefined = $state();
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  async function refresh(): Promise<void> {
    status = await fetchAppleAuthStatus();
  }

  $effect(() => {
    void refresh();
    pollTimer = setInterval(() => void refresh(), 1200);
    return () => clearInterval(pollTimer);
  });

  $effect(() => {
    if (status?.waitingForInput) inputEl?.focus();
  });

  async function start(): Promise<void> {
    const { ok } = await startAppleAuth();
    if (ok) void refresh();
  }

  async function cancel(): Promise<void> {
    await cancelAppleAuth();
    void refresh();
  }

  async function submit(): Promise<void> {
    const value = inputValue;
    inputValue = '';
    await submitAppleInput(value);
    void refresh();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') void submit();
  }

  const step = $derived.by((): Step => {
    if (!status || (!status.running && !status.log)) return 'idle';
    if (!status.running && status.success === true) return 'done';
    if (!status.running && status.success === false) return 'failed';
    const log = status.log.toLowerCase();
    if (/2fa|two-factor|verification code/.test(log)) return '2fa';
    if (/sign.?in|logging in|authenticat/.test(log)) return 'signing-in';
    return 'connecting';
  });

  const stepIndex = $derived(STEPS.findIndex((s) => s.id === step));
</script>

<div class="panel">
  <h2>Apple ID re-authentication</h2>
  <div class="muted" style="margin-bottom:10px;">Redoes the App Store sign-in only - the device connection isn't touched.</div>

  {#if step !== 'idle'}
    <div class="steps">
      {#each STEPS as s, i (s.id)}
        <div class="step" class:active={i === stepIndex} class:done={i < stepIndex || step === 'done'} class:failed={step === 'failed' && i === stepIndex}>
          <div class="dot"></div>
          <span>{s.label}</span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="row">
    <button class="action" disabled={status?.running} onclick={start}>Start re-authentication</button>
    <button class="action secondary" disabled={!status?.running} onclick={cancel}>Cancel</button>
  </div>

  <details style="margin-top:14px;">
    <summary class="muted">Raw output</summary>
    <pre class="log">{status?.log || '(not started)'}</pre>
  </details>

  {#if status?.waitingForInput}
    <div class="row" style="margin-top:10px;">
      <input bind:this={inputEl} bind:value={inputValue} onkeydown={onKeydown} placeholder="type the requested value and press Enter" />
      <button class="action small" onclick={submit}>Send</button>
    </div>
  {/if}
</div>

<style>
  .steps {
    display: flex;
    gap: 6px;
    margin-bottom: 16px;
  }

  .step {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--muted);
  }

  .dot {
    width: 100%;
    height: 4px;
    border-radius: 999px;
    background: var(--border);
  }

  .step.done .dot {
    background: var(--ok);
  }

  .step.active .dot {
    background: var(--accent);
  }

  .step.active {
    color: var(--text);
  }

  .step.failed .dot {
    background: var(--err);
  }
</style>
