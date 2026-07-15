<script lang="ts">
  import { liveState } from '../../lib/live.svelte';

  const overview = $derived(liveState.overview);
</script>

<div class="panel">
  <h2>Status</h2>
  <div class="stat-row">
    <div>
      <div class="stat">{overview ? (overview.schedulerEnabled ? 'On' : 'Off') : '-'}</div>
      <div class="stat-label">Scheduler</div>
    </div>
    <div>
      <div class="stat">{overview ? overview.activeJobs.length : '-'}</div>
      <div class="stat-label">Active jobs</div>
    </div>
  </div>
  <dl class="config-list">
    <div>
      <dt>Watching</dt>
      <dd>{overview?.settings.watchBundleId || '-'}</dd>
    </div>
    <div>
      <dt>Poll cron</dt>
      <dd>{overview?.settings.pollCron || '-'}</dd>
    </div>
  </dl>
</div>
