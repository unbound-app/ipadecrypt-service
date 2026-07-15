<script lang="ts">
  import AlertBanner from './components/AlertBanner.svelte';
  import CommandPalette from './components/CommandPalette.svelte';
  import ConfirmModal from './components/ConfirmModal.svelte';
  import Login from './components/Login.svelte';
  import SessionExpiryBanner from './components/SessionExpiryBanner.svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';
  import ToastContainer from './components/ToastContainer.svelte';
  import { connectLive, disconnectLive, liveState } from './lib/live.svelte';
  import { logout, refreshSession, sessionState } from './lib/session.svelte';
  import { initTheme, openPalette, setActiveTab, tabState, type TabId } from './lib/ui.svelte';
  import Docs from './tabs/Docs.svelte';
  import Home from './tabs/Home.svelte';
  import Keys from './tabs/Keys.svelte';
  import Logs from './tabs/Logs.svelte';
  import Settings from './tabs/Settings.svelte';

  initTheme();

  let homeRef: Home | undefined = $state();

  const TABS: { id: TabId; label: string; adminOnly?: boolean }[] = [
    { id: 'home', label: 'Home' },
    { id: 'keys', label: 'API Keys' },
    { id: 'logs', label: 'Logs' },
    { id: 'docs', label: 'Docs' },
    { id: 'settings', label: 'Settings', adminOnly: true },
  ];

  const visibleTabs = $derived(TABS.filter((t) => !t.adminOnly || sessionState.role === 'admin'));

  $effect(() => {
    void refreshSession();
  });

  $effect(() => {
    if (sessionState.loggedIn) connectLive();
    else disconnectLive();
  });

  $effect(() => {
    if (sessionState.loggedIn && !visibleTabs.some((t) => t.id === tabState.active)) setActiveTab('home');
  });

  function onKeydown(e: KeyboardEvent): void {
    const typingInField = ['INPUT', 'TEXTAREA', 'SELECT'].includes((document.activeElement as HTMLElement)?.tagName ?? '');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openPalette();
      return;
    }
    if (e.key === '/' && !typingInField && tabState.active === 'home') {
      e.preventDefault();
      homeRef?.focusSearch();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if !sessionState.loggedIn}
  <Login />
{:else}
  <div id="app">
    <header>
      <h1>
        ipadecrypt-service
        <span>{liveState.overview ? (liveState.overview.schedulerEnabled ? '· scheduler enabled' : '· scheduler disabled') : ''}</span>
      </h1>
      <div class="row">
        <ThemeToggle />
        <span class="whoami muted">{sessionState.sub} ({sessionState.role})</span>
        <button class="action secondary small" onclick={() => void logout()}>Log out</button>
      </div>
    </header>
    <main>
      <SessionExpiryBanner />
      <AlertBanner />
      <nav class="tabs">
        {#each visibleTabs as t (t.id)}
          <button class:active={tabState.active === t.id} onclick={() => setActiveTab(t.id)}>{t.label}</button>
        {/each}
      </nav>

      {#if tabState.active === 'home'}
        <Home bind:this={homeRef} />
      {:else if tabState.active === 'keys'}
        <Keys />
      {:else if tabState.active === 'logs'}
        <Logs />
      {:else if tabState.active === 'docs'}
        <Docs />
      {:else if tabState.active === 'settings'}
        <Settings />
      {/if}
    </main>
  </div>
{/if}

<ToastContainer />
<ConfirmModal />
<CommandPalette />

<style>
  .whoami {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 40vw;
    font-size: 13px;
  }

  @media (max-width: 640px) {
    .whoami {
      max-width: 55vw;
    }
  }
</style>
