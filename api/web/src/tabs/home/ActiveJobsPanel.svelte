<script lang="ts">
  import CopyButton from '../../components/CopyButton.svelte';
  import SkeletonRows from '../../components/SkeletonRows.svelte';
  import { liveState } from '../../lib/live.svelte';

  const jobs = $derived(liveState.overview?.activeJobs ?? []);
  const loaded = $derived(liveState.overview !== null);
</script>

<div class="panel">
  <h2>Active jobs</h2>
  <div class="table-wrap">
    <table class="min-w">
      <thead>
        <tr>
          <th>Bundle ID</th>
          <th>Source</th>
          <th>Status</th>
          <th>Progress</th>
          <th>Job ID</th>
        </tr>
      </thead>
      <tbody>
        {#if !loaded}
          <SkeletonRows rows={2} colspan={5} />
        {:else}
          {#each jobs as j (j.id)}
            <tr>
              <td>{j.bundleId}</td>
              <td>{j.source}</td>
              <td><span class="badge {j.status}">{j.status}</span></td>
              <td class="muted">
                {#if j.status === 'running'}
                  <div class="progress-cell">
                    <div class="progress-indeterminate"></div>
                    <span>{j.progress}</span>
                  </div>
                {:else}
                  {j.progress}
                {/if}
              </td>
              <td>
                <code title={j.id}>{j.id.slice(0, 8)}</code>
                <CopyButton text={j.id} />
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
  {#if loaded && jobs.length === 0}
    <div class="muted">Nothing running.</div>
  {/if}
</div>

<style>
  .progress-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
