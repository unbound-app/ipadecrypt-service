<script lang="ts">
  import { PackageSearch } from 'lucide-svelte';
  import CopyButton from '../components/CopyButton.svelte';
  import EmptyState from '../components/EmptyState.svelte';
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
  import Badge from '../lib/components/ui/Badge.svelte';
  import Button from '../lib/components/ui/Button.svelte';
  import Card from '../lib/components/ui/Card.svelte';
  import Input from '../lib/components/ui/Input.svelte';
  import Select from '../lib/components/ui/Select.svelte';
  import { statusToBadgeVariant } from '../lib/components/ui/variants';
  import { fmtUntil } from '../lib/format';
  import { sessionState } from '../lib/session.svelte';
  import { confirmDialog, showToast } from '../lib/ui.svelte';

  let keyName = $state('');
  let keyExpiry = $state('never');
  let revealedKey = $state('');
  let mine = $state<ApiKeyRecord[] | null>(null);
  let pending = $state<ApiKeyRecord[] | null>(null);
  let all = $state<ApiKeyRecord[] | null>(null);
  let statusFilter = $state('all');
  let selected = $state<Set<string>>(new Set());

  const STATUS_OPTIONS = [
    { value: 'all', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'denied', label: 'Denied' },
  ];

  const EXPIRY_OPTIONS = [
    { value: 'never', label: 'Never expires' },
    { value: '1', label: 'In 1 day' },
    { value: '7', label: 'In 7 days' },
    { value: '30', label: 'In 30 days' },
    { value: '90', label: 'In 90 days' },
  ];

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
    const expiresInDays = keyExpiry === 'never' ? undefined : Number(keyExpiry);
    const { ok, data } = await requestKey(name, expiresInDays);
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

  function curlExample(key: string): string {
    const base = sessionState.publicBaseUrl ?? location.origin;
    return `curl -H "Authorization: Bearer ${key}" "${base}/v1/decrypt?bundleId=com.example.app" -o app.ipa`;
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

<div class="flex flex-col gap-4">
  <Card title={isAdmin ? 'Get a key' : 'Request a key'}>
    <div class="mb-2.5 text-sm text-muted">
      {isAdmin ? "You get it instantly - no approval needed." : 'Needs approval from an admin before it works.'}
    </div>
    <label for="key-name" class="mb-1 block text-xs text-muted">Name</label>
    <Input id="key-name" placeholder="e.g. laptop, ci-runner" bind:value={keyName} />
    <label for="key-expiry" class="mt-3 mb-1 block text-xs text-muted">Expires</label>
    <Select id="key-expiry" items={EXPIRY_OPTIONS} bind:value={keyExpiry} class="w-full" />
    <Button class="mt-3" onclick={submitRequest}>{isAdmin ? 'Create' : 'Request'}</Button>
    {#if revealedKey}
      <div class="border-accent bg-panel-muted mt-3 rounded-md border p-2.5 text-xs break-all">
        Save this now, it won't be shown again:<br />
        <code>{revealedKey}</code>
        <CopyButton text={revealedKey} />
        <div class="mt-2">
          <CopyButton text={curlExample(revealedKey)} label="Copy curl example" />
        </div>
      </div>
    {/if}
  </Card>

  <Card title="My keys">
    <div class="overflow-x-auto">
      <table class="min-w-[480px]">
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
                <td>
                  <div class="flex flex-wrap items-center gap-1.5">
                    <Badge variant={statusToBadgeVariant(k.status)}>{k.status}</Badge>
                    {#if k.expiresAt}
                      <Badge variant="secondary">expires {fmtUntil(k.expiresAt)}</Badge>
                    {/if}
                  </div>
                </td>
                <td class="text-muted"><RelativeTime ms={k.createdAt} /></td>
                <td class="text-muted"><RelativeTime ms={k.lastUsedAt} /></td>
                <td>
                  <div class="flex flex-wrap gap-1.5">
                    {#if k.hasUnrevealedSecret}
                      <Button size="sm" onclick={() => doReveal(k.id)}>Reveal</Button>
                    {/if}
                    {#if k.status === 'approved'}
                      <Button size="sm" variant="secondary" onclick={() => doRegenerate(k.id)}>Regenerate</Button>
                    {/if}
                    <Button size="sm" variant="destructive" onclick={() => doRevoke(k.id)}>Revoke</Button>
                  </div>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </Card>

  {#if isAdmin}
    <Card title="Pending requests">
      <div class="overflow-x-auto">
        <table class="min-w-[480px]">
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
                  <td>
                    {k.name}
                    {#if k.expiresAt}
                      <Badge variant="secondary" class="ml-1.5">expires {fmtUntil(k.expiresAt)}</Badge>
                    {/if}
                  </td>
                  <td>{k.ownerId}</td>
                  <td class="text-muted"><RelativeTime ms={k.createdAt} /></td>
                  <td>
                    <div class="flex gap-1.5">
                      <Button size="sm" onclick={() => doApprove(k.id)}>Approve</Button>
                      <Button size="sm" variant="destructive" onclick={() => doDeny(k.id)}>Deny</Button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
      {#if pending !== null && pending.length === 0}
        <EmptyState icon={PackageSearch} message="Nothing pending." />
      {/if}
    </Card>

    <Card title="All keys">
      {#snippet headerExtra()}
        {#if selected.size > 0}
          <Button size="sm" variant="destructive" onclick={bulkRevoke}>Revoke {selected.size} selected</Button>
        {/if}
      {/snippet}
      <Select items={STATUS_OPTIONS} bind:value={statusFilter} class="mb-3 w-44" />
      <div class="overflow-x-auto">
        <table class="min-w-[620px]">
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
                  <td>
                    <div class="flex items-center gap-1.5">
                      <code title={k.id}>{k.id.slice(0, 8)}</code>
                      <CopyButton text={k.id} />
                    </div>
                  </td>
                  <td>{k.name}</td>
                  <td>{k.ownerId}</td>
                  <td>
                    <div class="flex flex-wrap items-center gap-1.5">
                      <Badge variant={statusToBadgeVariant(k.status)}>{k.status}</Badge>
                      {#if k.expiresAt}
                        <Badge variant="secondary">{fmtUntil(k.expiresAt)}</Badge>
                      {/if}
                    </div>
                  </td>
                  <td class="text-muted"><RelativeTime ms={k.createdAt} /></td>
                  <td class="text-muted"><RelativeTime ms={k.lastUsedAt} /></td>
                  <td><Button size="sm" variant="destructive" onclick={() => doRevoke(k.id)}>Revoke</Button></td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}
</div>
