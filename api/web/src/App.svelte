<script lang="ts">
  import { Moon, Sun } from 'lucide-svelte';
  import { Toaster } from 'svelte-sonner';
  import AlertBanner from './components/AlertBanner.svelte';
  import CommandPalette from './components/CommandPalette.svelte';
  import ConfirmModal from './components/ConfirmModal.svelte';
  import Login from './components/Login.svelte';
  import SessionExpiryBanner from './components/SessionExpiryBanner.svelte';
  import ShortcutsHelp from './components/ShortcutsHelp.svelte';
  import Button from './lib/components/ui/Button.svelte';
  import Tabs from './lib/components/ui/Tabs.svelte';
  import { buttonVariants } from './lib/components/ui/variants';
  import { connectLive, disconnectLive, liveState } from './lib/live.svelte';
  import { logout, pushThemePref, refreshSession, sessionState, type Role } from './lib/session.svelte';
  import { initTheme, openHelp, openPalette, setActiveTab, setTheme, tabState, themeState, type TabId } from './lib/ui.svelte';

  const REPO_URL = 'https://github.com/unbound-app/dkrypt';
  import Docs from './tabs/Docs.svelte';
  import Home from './tabs/Home.svelte';
  import Keys from './tabs/Keys.svelte';
  import Logs from './tabs/Logs.svelte';
  import Settings from './tabs/Settings.svelte';

  initTheme();

  let homeRef: Home | undefined = $state();

  const TABS: { id: TabId; label: string; roles?: Role[] }[] = [
    { id: 'home', label: 'Home' },
    { id: 'keys', label: 'API Keys', roles: ['admin', 'operator', 'member'] },
    { id: 'logs', label: 'Logs' },
    { id: 'docs', label: 'Docs' },
    { id: 'settings', label: 'Settings', roles: ['admin'] },
  ];

  const visibleTabs = $derived(TABS.filter((t) => !t.roles || (sessionState.role && t.roles.includes(sessionState.role))));

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
      return;
    }
    if (e.key === '?' && !typingInField) {
      e.preventDefault();
      openHelp();
    }
  }

  function toggleTheme(): void {
    const next = themeState.value === 'light' ? 'dark' : 'light';
    setTheme(next);
    void pushThemePref(next);
  }
</script>

<svelte:window onkeydown={onKeydown} />

<Toaster theme={themeState.value ?? 'dark'} richColors position="bottom-right" />

{#if !sessionState.loggedIn}
  <Login />
{:else}
  <div class="min-h-screen">
    <header class="border-border flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
      <div class="flex items-center gap-3">
        <h1 class="text-[15px] font-semibold">dkrypt</h1>
        {#if liveState.overview}
          <span class="border-border inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted">
            <span class={['h-1.5 w-1.5 rounded-full', liveState.overview.schedulerEnabled ? 'bg-ok' : 'bg-muted']}></span>
            Scheduler {liveState.overview.schedulerEnabled ? 'on' : 'off'}
          </span>
        {/if}
      </div>
      <div class="flex items-center gap-2.5">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          class={buttonVariants('secondary', 'icon')}
          aria-label="View source on GitHub"
          title="View source on GitHub"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path
              d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
            />
          </svg>
        </a>
        <Button variant="secondary" size="icon" onclick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">
          {#if themeState.value === 'light'}
            <Moon class="h-4 w-4" />
          {:else}
            <Sun class="h-4 w-4" />
          {/if}
        </Button>
        <span class="max-w-[40vw] truncate text-[13px] text-muted sm:max-w-[55vw]">{sessionState.sub} ({sessionState.role})</span>
        <Button variant="secondary" size="sm" onclick={() => void logout()}>Log out</Button>
      </div>
    </header>
    <main class="mx-auto max-w-[1120px] p-6">
      <SessionExpiryBanner />
      <AlertBanner />
      <Tabs items={visibleTabs.map((t) => ({ id: t.id, label: t.label }))} value={tabState.active} onValueChange={(v) => setActiveTab(v as TabId)} class="mb-5" />

      <div class:hidden={tabState.active !== 'home'}>
        <Home bind:this={homeRef} />
      </div>
      <div class:hidden={tabState.active !== 'keys'}>
        <Keys />
      </div>
      <div class:hidden={tabState.active !== 'logs'}>
        <Logs />
      </div>
      <div class:hidden={tabState.active !== 'docs'}>
        <Docs />
      </div>
      {#if sessionState.role === 'admin'}
        <div class:hidden={tabState.active !== 'settings'}>
          <Settings />
        </div>
      {/if}
    </main>
  </div>
{/if}

<ConfirmModal />
<CommandPalette />
<ShortcutsHelp />
