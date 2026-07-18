<script lang="ts">
  import { ArrowDown, ArrowUp, Plus, Shield } from 'lucide-svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import PermissionEditor from '../../components/PermissionEditor.svelte';
  import { createRole, deleteRole, fetchRoles, fetchUsers, reorderRoles, updateRole, type AllowedUser, type Role } from '../../lib/api';
  import Badge from '../../lib/components/ui/Badge.svelte';
  import Button from '../../lib/components/ui/Button.svelte';
  import Card from '../../lib/components/ui/Card.svelte';
  import Dialog from '../../lib/components/ui/Dialog.svelte';
  import Input from '../../lib/components/ui/Input.svelte';
  import { parseBits, permissionLabels, PermissionFlag, serializeBits } from '../../lib/permissions';
  import { sessionHasPermission } from '../../lib/session.svelte';
  import { confirmDialog } from '../../lib/ui.svelte';

  const canManageRoles = $derived(sessionHasPermission(PermissionFlag.manageRoles));

  const COLOR_PRESETS = ['#99aab5', '#1abc9c', '#3498db', '#9b59b6', '#e91e63', '#f1c40f', '#e67e22', '#e74c3c', '#5865f2', '#2ecc71'];

  let roles = $state<Role[] | null>(null);
  let users = $state<AllowedUser[] | null>(null);
  let reordering = $state(false);

  // Highest position first, like Discord's role list - the default @everyone role always sorts last.
  const displayRoles = $derived.by(() => {
    if (!roles) return [];
    return [...roles].sort((a, b) => b.position - a.position);
  });

  function memberCount(roleId: string): number {
    return (users ?? []).filter((u) => u.roleIds.includes(roleId)).length;
  }

  async function load(): Promise<void> {
    const [r, u] = await Promise.all([fetchRoles(), fetchUsers()]);
    roles = r.roles;
    users = u.users;
  }

  $effect(() => {
    void load();
  });

  let dialogOpen = $state(false);
  let editingRole = $state<Role | null>(null);
  let formName = $state('');
  let formColor = $state(COLOR_PRESETS[0]);
  let formBits = $state(0n);
  let saving = $state(false);
  let deletingId = $state<string | null>(null);

  function openAdd(): void {
    editingRole = null;
    formName = '';
    formColor = COLOR_PRESETS[Math.floor(Math.random() * COLOR_PRESETS.length)];
    formBits = 0n;
    dialogOpen = true;
  }

  function openEdit(r: Role): void {
    editingRole = r;
    formName = r.name;
    formColor = r.color;
    formBits = parseBits(r.permissions);
    dialogOpen = true;
  }

  async function save(): Promise<void> {
    if (!formName.trim()) return;
    saving = true;
    try {
      const { ok } = editingRole
        ? await updateRole(editingRole.id, { name: formName.trim(), color: formColor, permissions: serializeBits(formBits) })
        : await createRole(formName.trim(), formColor, serializeBits(formBits));
      if (ok) {
        dialogOpen = false;
        void load();
      }
    } finally {
      saving = false;
    }
  }

  async function remove(r: Role): Promise<void> {
    if (!(await confirmDialog(`Delete the "${r.name}" role? Anyone holding it loses what it grants.`))) return;
    deletingId = r.id;
    try {
      const { ok } = await deleteRole(r.id, r.name);
      if (ok) void load();
    } finally {
      deletingId = null;
    }
  }

  async function move(role: Role, direction: 'up' | 'down'): Promise<void> {
    if (!roles) return;
    // Ascending by position (index 0 = lowest, excluding the default role which never reorders).
    const ascending = roles.filter((r) => !r.isDefault).sort((a, b) => a.position - b.position);
    const idx = ascending.findIndex((r) => r.id === role.id);
    const swapWith = direction === 'up' ? idx + 1 : idx - 1;
    if (idx === -1 || swapWith < 0 || swapWith >= ascending.length) return;
    [ascending[idx], ascending[swapWith]] = [ascending[swapWith], ascending[idx]];
    reordering = true;
    try {
      const { ok, data } = await reorderRoles(ascending.map((r) => r.id));
      if (ok) roles = data.roles;
    } finally {
      reordering = false;
    }
  }
</script>

<Card title="Roles">
  {#snippet headerExtra()}
    {#if canManageRoles}
      <Button size="sm" onclick={openAdd}>
        <Plus class="h-3.5 w-3.5" />
        Add role
      </Button>
    {/if}
  {/snippet}
  <div class="mb-3 text-sm text-muted">
    Every added user automatically holds <strong>@everyone</strong>. Build additional roles out of individual permission bits, then
    assign them to people on the Users tab - a user's effective access is the union of every role they hold.
  </div>
  {#if roles === null}
    <div class="flex flex-col gap-2">
      {#each Array(3) as _, i (i)}
        <div class="skeleton bg-panel-muted h-14 w-full rounded-lg"></div>
      {/each}
    </div>
  {:else}
    <div class="flex flex-col gap-2">
      {#each displayRoles as r, i (r.id)}
        {@const labels = permissionLabels(parseBits(r.permissions))}
        {@const ascendingIdx = displayRoles.length - 2 - i}
        <div class="border-border rounded-lg border p-3">
          <div class="flex flex-wrap items-center gap-2">
            <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color: {r.color}"></span>
            <span class="text-[13px] font-medium">{r.name}</span>
            {#if labels[0] === 'Administrator'}
              <Badge variant="destructive"><Shield class="mr-1 h-3 w-3" />Administrator</Badge>
            {/if}
            <span class="text-xs text-muted">{memberCount(r.id)} member{memberCount(r.id) === 1 ? '' : 's'}</span>
            <div class="ml-auto flex flex-wrap items-center gap-1.5">
              {#if canManageRoles && !r.isDefault}
                <Button
                  size="icon"
                  variant="secondary"
                  disabled={reordering || ascendingIdx === displayRoles.length - 2}
                  onclick={() => void move(r, 'up')}
                  aria-label="Move {r.name} up"
                  title="Move up"
                >
                  <ArrowUp class="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  disabled={reordering || ascendingIdx === 0}
                  onclick={() => void move(r, 'down')}
                  aria-label="Move {r.name} down"
                  title="Move down"
                >
                  <ArrowDown class="h-3.5 w-3.5" />
                </Button>
              {/if}
              {#if canManageRoles}
                <Button size="sm" variant="secondary" onclick={() => openEdit(r)}>Edit</Button>
                {#if !r.isDefault}
                  <Button size="sm" variant="destructive" loading={deletingId === r.id} onclick={() => remove(r)}>Delete</Button>
                {/if}
              {/if}
            </div>
          </div>
          {#if labels.length > 0 && labels[0] !== 'Administrator'}
            <div class="mt-1.5 flex flex-wrap gap-1">
              {#each labels as label (label)}
                <Badge variant="secondary">{label}</Badge>
              {/each}
            </div>
          {:else if labels.length === 0}
            <div class="mt-1.5 text-xs text-muted">No permissions granted.</div>
          {/if}
        </div>
      {/each}
    </div>
    {#if roles.length === 0}
      <EmptyState message="No roles yet." />
    {/if}
  {/if}
</Card>

{#if canManageRoles}
  <Dialog open={dialogOpen} onOpenChange={(v) => (dialogOpen = v)} class="max-w-md">
    <div class="mb-3 text-sm font-medium">{editingRole ? `Edit ${editingRole.name}` : 'Add role'}</div>
    <div class="max-h-[65vh] overflow-y-auto pr-0.5">
      <label for="r-name" class="mb-1 block text-xs text-muted">Name</label>
      <Input id="r-name" placeholder="e.g. Key Manager" bind:value={formName} disabled={editingRole?.isDefault} />

      <div class="mt-3 mb-1 text-xs text-muted">Color</div>
      <div class="flex flex-wrap gap-1.5">
        {#each COLOR_PRESETS as c (c)}
          <button
            type="button"
            class="h-6 w-6 cursor-pointer rounded-full border-2"
            style="background-color: {c}; border-color: {formColor === c ? 'var(--color-text)' : 'transparent'};"
            onclick={() => (formColor = c)}
            aria-label="Color {c}"
          ></button>
        {/each}
      </div>

      <div class="mt-3.5">
        <PermissionEditor bind:value={formBits} />
      </div>
    </div>
    <Button class="mt-3.5 w-full" loading={saving} onclick={save} disabled={!formName.trim()}>{editingRole ? 'Save' : 'Add'}</Button>
  </Dialog>
{/if}
