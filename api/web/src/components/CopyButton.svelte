<script lang="ts">
  let { text }: { text: string } = $props();
  let label = $state('Copy');

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      label = 'Copied!';
      setTimeout(() => {
        label = 'Copy';
      }, 1200);
    } catch {
      label = 'Failed';
      setTimeout(() => {
        label = 'Copy';
      }, 1200);
    }
  }
</script>

<button class="copy" onclick={copy}>{label}</button>
