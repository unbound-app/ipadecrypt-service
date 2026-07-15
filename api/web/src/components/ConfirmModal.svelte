<script lang="ts">
  import { confirmState, resolveConfirm } from '../lib/ui.svelte';
</script>

{#if confirmState.open}
  <div
    class="overlay"
    role="button"
    tabindex="-1"
    onclick={(e) => e.target === e.currentTarget && resolveConfirm(false)}
    onkeydown={(e) => e.key === 'Escape' && resolveConfirm(false)}
  >
    <div class="box panel" role="dialog" aria-modal="true" tabindex="-1">
      <div>{confirmState.message}</div>
      <div class="row actions">
        <button class="action secondary" onclick={() => resolveConfirm(false)}>Cancel</button>
        <button class="action danger" onclick={() => resolveConfirm(true)}>Confirm</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999;
  }

  .box {
    max-width: 360px;
    width: 90%;
  }

  .actions {
    justify-content: flex-end;
    margin-top: 16px;
  }
</style>
