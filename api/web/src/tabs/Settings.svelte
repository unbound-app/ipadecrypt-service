<script lang="ts">
  import { setSettingsSubtab, tabState } from '../lib/ui.svelte';
  import AppleAuthSettings from './settings/AppleAuthSettings.svelte';
  import SchedulerSettings from './settings/SchedulerSettings.svelte';
  import UsersSettings from './settings/UsersSettings.svelte';
</script>

<nav class="tabs subnav">
  <button class:active={tabState.settingsSubtab === 'scheduler'} onclick={() => setSettingsSubtab('scheduler')}>Scheduler</button>
  <button class:active={tabState.settingsSubtab === 'users'} onclick={() => setSettingsSubtab('users')}>Users</button>
  <button class:active={tabState.settingsSubtab === 'apple'} onclick={() => setSettingsSubtab('apple')}>Apple Auth</button>
</nav>

{#if tabState.settingsSubtab === 'scheduler'}
  <SchedulerSettings />
{:else if tabState.settingsSubtab === 'users'}
  <UsersSettings />
{:else if tabState.settingsSubtab === 'apple'}
  <AppleAuthSettings />
{/if}

<style>
  .subnav {
    margin-bottom: 16px;
  }
</style>
