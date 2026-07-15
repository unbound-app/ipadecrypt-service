<script lang="ts">
  import { setTheme, themeState } from '../lib/ui.svelte';

  function effectiveTheme(): 'dark' | 'light' {
    if (themeState.value) return themeState.value;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function toggle(): void {
    setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark');
  }
</script>

<button class="action secondary small theme-toggle" onclick={toggle} title="Toggle theme" aria-label="Toggle theme">
  {#if effectiveTheme() === 'dark'}
    ☀️
  {:else}
    🌙
  {/if}
</button>

<style>
  .theme-toggle {
    line-height: 1;
    padding: 6px 10px;
  }
</style>
