<script lang="ts">
  import { toastState } from '../lib/ui.svelte';
</script>

<div class="toast-container">
  {#each toastState.items as toast (toast.id)}
    <div class="toast {toast.type}">{toast.message}</div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 1000;
    max-width: 320px;
  }

  .toast {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    animation: toast-in 0.15s ease-out;
  }

  .toast.success {
    border-color: color-mix(in srgb, var(--ok) 50%, transparent);
  }

  .toast.error {
    border-color: color-mix(in srgb, var(--err) 50%, transparent);
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
