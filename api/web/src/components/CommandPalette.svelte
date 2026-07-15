<script lang="ts">
  import { logout, sessionState } from '../lib/session.svelte';
  import { closePalette, paletteState, setActiveTab, setTheme, themeState } from '../lib/ui.svelte';

  interface Command {
    id: string;
    label: string;
    run: () => void;
  }

  let query = $state('');
  let selected = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();

  const commands = $derived.by((): Command[] => {
    const base: Command[] = [
      { id: 'home', label: 'Go to Home', run: () => setActiveTab('home') },
      { id: 'keys', label: 'Go to API Keys', run: () => setActiveTab('keys') },
      { id: 'logs', label: 'Go to Logs', run: () => setActiveTab('logs') },
      { id: 'docs', label: 'Go to Docs', run: () => setActiveTab('docs') },
    ];
    if (sessionState.role === 'admin') base.push({ id: 'settings', label: 'Go to Settings', run: () => setActiveTab('settings') });
    base.push({ id: 'theme', label: 'Toggle light / dark theme', run: () => setTheme(themeState.value === 'dark' ? 'light' : 'dark') });
    base.push({ id: 'logout', label: 'Log out', run: () => void logout() });
    return base;
  });

  const filtered = $derived(
    query.trim() === '' ? commands : commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase())),
  );

  $effect(() => {
    filtered;
    selected = 0;
  });

  $effect(() => {
    if (paletteState.open) inputEl?.focus();
  });

  function run(cmd: Command): void {
    cmd.run();
    close();
  }

  function close(): void {
    query = '';
    closePalette();
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selected = Math.min(selected + 1, filtered.length - 1);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[selected];
      if (cmd) run(cmd);
    }
  }
</script>

{#if paletteState.open}
  <div class="overlay" role="button" tabindex="-1" onclick={(e) => e.target === e.currentTarget && close()} onkeydown={onKeydown}>
    <div class="palette panel" role="dialog" aria-modal="true" tabindex="-1">
      <input bind:this={inputEl} bind:value={query} onkeydown={onKeydown} placeholder="Type a command…" />
      <div class="results">
        {#each filtered as cmd, i (cmd.id)}
          <button class="result" class:selected={i === selected} onclick={() => run(cmd)}>{cmd.label}</button>
        {/each}
        {#if filtered.length === 0}
          <div class="muted empty">No matching commands.</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
    z-index: 1001;
  }

  .palette {
    width: 90%;
    max-width: 480px;
    padding: 8px;
  }

  input {
    margin-bottom: 6px;
  }

  .results {
    display: flex;
    flex-direction: column;
    max-height: 320px;
    overflow-y: auto;
  }

  .result {
    text-align: left;
    background: none;
    border: none;
    color: var(--text);
    padding: 10px 12px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
  }

  .result.selected {
    background: color-mix(in srgb, var(--accent) 15%, transparent);
  }

  .empty {
    padding: 10px 12px;
    font-size: 13px;
  }
</style>
