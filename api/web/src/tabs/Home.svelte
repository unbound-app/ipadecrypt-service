<script lang="ts">
  import ActiveJobsPanel from './home/ActiveJobsPanel.svelte';
  import DecryptPanel from './home/DecryptPanel.svelte';
  import JobHistoryPanel from './home/JobHistoryPanel.svelte';
  import MyRequestsPanel from './home/MyRequestsPanel.svelte';
  import StatusPanel from './home/StatusPanel.svelte';

  let decryptPanel: DecryptPanel | undefined = $state();

  export function focusSearch(): void {
    decryptPanel?.focusSearch();
  }
</script>

<div class="home-grid">
  <div class="home-main">
    <DecryptPanel bind:this={decryptPanel} />
    <MyRequestsPanel />
    <ActiveJobsPanel />
    <JobHistoryPanel />
  </div>
  <div class="home-side">
    <StatusPanel />
  </div>
</div>
