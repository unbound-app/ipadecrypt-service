<script lang="ts">
  import CopyButton from '../components/CopyButton.svelte';
  import RelativeTime from '../components/RelativeTime.svelte';
  import SkeletonRows from '../components/SkeletonRows.svelte';
  import {
    approveKey,
    bulkRevokeKeys,
    denyKey,
    fetchAllKeys,
    fetchMyKeys,
    fetchPendingKeys,
    regenerateKey,
    requestKey,
    revealKey,
    revokeKey,
    type ApiKeyRecord,
  } from '../lib/api';
  import { sessionState } from '../lib/session.svelte';
  import { confirmDialog, showToast } from '../lib/ui.svelte';

  let keyName = $state('');
  let revealedKey = $state('');
  let mine = $state<ApiKeyRecord[] | null>(null);
  let pending = $state<ApiKeyRecord[] | null>(null);
  let all = $state<ApiKeyRecord[] | null>(null);
  let statusFilter = $state<'all' | 'pending' | 'approved' | 'denied'>('all');
  let selected = $state<Set<string>>(new Set());

  const isAdmin = $derived(sessionState.role === 'admin');

  async function loadAll(): Promise<void> {
    mine = (await fetchMyKeys()).keys;
    if (!isAdmin) return;
    pending = (await fetchPendingKeys()).keys;
    all = (await fetchAllKeys()).keys;
  }

  $effect(() => {
    void loadAll();
  });

  async function submitRequest(): Promise<void> {
    const name = keyName.trim();
    if (!name) return;
    const { ok, data } = await requestKey(name);
    if (!ok) return;
    keyName = '';
    if (data.key) {
      revealedKey = data.key;
      showToast('Key created', 'success');
    } else {
      showToast('Request submitted - waiting on admin approval', 'success');
    }
    void loadAll();
  }

  async function doReveal(id: string): Promise<void> {
    const { ok, data } = await revealKey(id);
    if (!ok) return;
    revealedKey = data.key;
    void loadAll();
  }

  async function doRegenerate(id: string): Promise<void> {
    if (!(await confirmDialog('Regenerate this key? The old secret stops working immediately.'))) return;
    const { ok } = await regenerateKey(id);
    if (ok) void loadAll();
  }

  async function doRevoke(id: string): Promise<void> {
    if (!(await confirmDialog("Revoke this key? Anything using it will lose access immediately."))) return;
    const { ok } = await revokeKey(id);
    if (ok) void loadAll();
  }

  async function doApprove(id: string): Promise<void> {
    const { ok } = await approveKey(id);
    if (ok) void loadAll();
  }

  async function doDeny(id: string): Promise<void> {
    const { ok } = await denyKey(id);
    if (ok) void loadAll();
  }

  function toggleSelect(id: string): void {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected = next;
  }

  const filteredAll = $derived((all ?? []).filter((k) => statusFilter === 'all' || k.status === statusFilter));

  async function bulkRevoke(): Promise<void> {
    if (selected.size === 0) return;
    if (!(await confirmDialog(`Revoke ${selected.size} key(s)? This can't be undone.`))) return;
    await bulkRevokeKeys([...selected]);
    selected = new Set();
    void loadAll();
  }
</script>

<div class="panel">
  <h2>{isAdmin ? 'Get a key' : 'Request a key'}</h2>
  <div class="muted" style="margin-bottom:10px;">
    {isAdmin ? "You get it instantly - no approval needed." : 'Needs approval from an admin before it works.'}
  </div>
  <label for="key-name">Name</label>
  <input id="key-name" placeholder="e.g. laptop, ci-runner" bind:value={keyName} />
  <button class="action" onclick={submitRequest}>{isAdmin ? 'Create' : 'Request'}</button>
  {#if revealedKey}
    <div class="key-reveal">
      Save this now, it won't be shown again:<br />
      <code>{revealedKey}</code>
      <CopyButton text={revealedKey} />
    </div>
  {/if}
</div>

<div class="panel">
  <h2>My keys</h2>
  <div class="table-wrap">
    <table class="min-w">
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th>Created</th>
          <th>Last used</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#if mine === null}
          <SkeletonRows rows={2} colspan={5} />
        {:else}
          {#each mine as k (k.id)}
            <tr>
              <td>{k.name}</td>
              <td><span class="badge {k.status}">{k.status}</span></td>
              <td class="muted"><RelativeTime ms={k.createdAt} /></td>
              <td class="muted"><RelativeTime ms={k.lastUsedAt} /></td>
              <td class="actions-cell">
                {#if k.hasUnrevealedSecret}
                  <button class="action small" onclick={() => doReveal(k.id)}>Reveal</button>
                {/if}
                {#if k.status === 'approved'}
                  <button class="action small secondary" onclick={() => doRegenerate(k.id)}>Regenerate</button>
                {/if}
                <button class="action small danger" onclick={() => doRevoke(k.id)}>Revoke</button>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>

{#if isAdmin}
  <div class="panel">
    <h2>Pending requests</h2>
    <div class="table-wrap">
      <table class="min-w">
        <thead>
          <tr>
            <th>Name</th>
            <th>Requested by</th>
            <th>Requested</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#if pending === null}
            <SkeletonRows rows={2} colspan={4} />
          {:else}
            {#each pending as k (k.id)}
              <tr>
                <td>{k.name}</td>
                <td>{k.ownerId}</td>
                <td class="muted"><RelativeTime ms={k.createdAt} /></td>
                <td class="actions-cell">
                  <button class="action small" onclick={() => doApprove(k.id)}>Approve</button>
                  <button class="action small danger" onclick={() => doDeny(k.id)}>Deny</button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
    {#if pending !== null && pending.length === 0}
      <div class="muted">Nothing pending.</div>
    {/if}
  </div>

  <div class="panel">
    <h2>All keys</h2>
    <div class="row" style="margin-bottom:10px; justify-content:space-between; flex-wrap:wrap;">
      <select style="width:auto;" bind:value={statusFilter}>
        <option value="all">All statuses</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="denied">Denied</option>
      </select>
      {#if selected.size > 0}
        <button class="action small danger" style="margin-top:0;" onclick={bulkRevoke}>Revoke {selected.size} selected</button>
      {/if}
    </div>
    <div class="table-wrap">
      <table class="min-w">
        <thead>
          <tr>
            <th></th>
            <th>ID</th>
            <th>Name</th>
            <th>Owner</th>
            <th>Status</th>
            <th>Created</th>
            <th>Last used</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#if all === null}
            <SkeletonRows rows={3} colspan={8} />
          {:else}
            {#each filteredAll as k (k.id)}
              <tr>
                <td><input type="checkbox" checked={selected.has(k.id)} onchange={() => toggleSelect(k.id)} /></td>
                <td><code title={k.id}>{k.id.slice(0, 8)}</code> <CopyButton text={k.id} /></td>
                <td>{k.name}</td>
                <td>{k.ownerId}</td>
                <td><span class="badge {k.status}">{k.status}</span></td>
                <td class="muted"><RelativeTime ms={k.createdAt} /></td>
                <td class="muted"><RelativeTime ms={k.lastUsedAt} /></td>
                <td><button class="action small danger" onclick={() => doRevoke(k.id)}>Revoke</button></td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
{/if}
