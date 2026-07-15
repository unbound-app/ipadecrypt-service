<script lang="ts">
  import { Inbox, type Icon as IconType } from 'lucide-svelte';

  let { icon: Icon = Inbox, message }: { icon?: typeof IconType; message: string } = $props();
</script>

<div class="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted">
  <Icon class="h-6 w-6 opacity-60" />
  {message}
</div>
