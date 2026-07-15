<script lang="ts">
  import { loginRoot, sessionState } from '../lib/session.svelte';

  let password = $state('');
  let loginError = $state('');
  let detailsOpen = $state(!sessionState.githubOauthEnabled);
  let oauthError = $state('');

  const OAUTH_ERROR_MESSAGES: Record<string, string | ((user: string | null) => string)> = {
    state_mismatch: 'Sign-in session expired - please try again.',
    not_allowed: (user) => `GitHub user ${user ?? ''} isn't on the allowlist for this dashboard. Ask an admin to add you.`,
    disabled: "GitHub sign-in isn't configured.",
    failed: 'GitHub sign-in failed - check the server logs.',
  };

  $effect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('auth_error');
    if (!code) return;
    const message = OAUTH_ERROR_MESSAGES[code];
    oauthError = typeof message === 'function' ? message(params.get('user')) : (message ?? 'GitHub sign-in failed.');
    history.replaceState(null, '', location.pathname);
  });

  async function submit(): Promise<void> {
    const result = await loginRoot(password);
    if (!result.ok) loginError = result.error ?? 'Wrong password.';
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') void submit();
  }
</script>

<div class="login-screen">
  <div class="login-card panel">
    <div class="login-icon">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
        <path d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />
        <rect x="9" y="14" width="14" height="11" rx="2.5" fill="#ffffff" />
        <circle cx="16" cy="18.5" r="1.6" fill="var(--accent)" />
        <rect x="15.1" y="19.5" width="1.8" height="3" rx="0.9" fill="var(--accent)" />
      </svg>
    </div>
    <h2>ipadecrypt-service</h2>
    <div class="muted login-tagline">Sign in to manage decrypts, keys, and settings.</div>

    {#if sessionState.githubOauthEnabled}
      <a class="action github" href="/v1/auth/github/login">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path
            d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
          />
        </svg>
        Sign in with GitHub
      </a>
    {/if}
    {#if oauthError}
      <div class="oauth-error">{oauthError}</div>
    {/if}

    <details bind:open={detailsOpen}>
      <summary class:hidden={!sessionState.githubOauthEnabled}>Sign in with root password</summary>
      <div class="root-login-body">
        <label for="password">Root password</label>
        <input type="password" id="password" autocomplete="current-password" bind:value={password} onkeydown={onKeydown} />
        <button class="action secondary" style="width:100%;" onclick={submit}>Sign in</button>
        {#if loginError}
          <div class="muted" style="margin-top:8px;">{loginError}</div>
        {/if}
      </div>
    </details>
  </div>
</div>

<style>
  .login-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: radial-gradient(circle at 50% 15%, color-mix(in srgb, var(--panel) 60%, var(--bg)) 0%, var(--bg) 60%);
  }

  .login-card {
    width: 100%;
    max-width: 380px;
    padding: 36px 32px;
    text-align: center;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
  }

  .login-icon {
    width: 60px;
    height: 60px;
    border-radius: 15px;
    background: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    box-shadow: 0 14px 30px color-mix(in srgb, var(--accent) 35%, transparent);
  }

  h2 {
    font-size: 19px;
    margin: 0 0 6px;
  }

  .login-tagline {
    margin-bottom: 26px;
    font-size: 13px;
  }

  .action.github {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    text-decoration: none;
  }

  .oauth-error {
    margin-top: 14px;
    font-size: 12.5px;
    color: var(--err);
  }

  details {
    margin-top: 18px;
    text-align: left;
  }

  summary {
    cursor: pointer;
    font-size: 12.5px;
    color: var(--muted);
    text-align: center;
    list-style: none;
    padding: 10px 0 0;
    user-select: none;
  }

  summary.hidden {
    display: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary:hover {
    color: var(--text);
  }

  details[open] summary {
    margin-bottom: 6px;
  }

  .root-login-body {
    padding-top: 6px;
  }
</style>
