<script lang="ts">
  import { normalizePermissions, type Permissions } from '../lib/session.svelte';
  import { cn } from '../lib/utils';

  interface Props {
    value: Permissions;
  }

  let { value = $bindable() }: Props = $props();

  interface Field {
    key: keyof Permissions;
    label: string;
    description: string;
    impliedBy?: (keyof Permissions)[];
  }

  interface Group {
    title: string;
    fields: Field[];
  }

  const GROUPS: Group[] = [
    {
      title: 'Decryption',
      fields: [{ key: 'decrypt', label: 'Decrypt apps', description: 'Queue decrypts and request their own API keys' }],
    },
    {
      title: 'API keys',
      fields: [
        { key: 'viewApiKeys', label: 'View all keys', description: 'See every key across every user, not just their own', impliedBy: ['approveApiKeys', 'revokeApiKeys'] },
        { key: 'approveApiKeys', label: 'Approve requests', description: 'Approve or deny pending key requests; their own requests auto-approve' },
        { key: 'revokeApiKeys', label: "Revoke anyone's key", description: "Revoke or bulk-revoke any user's key, not just their own" },
      ],
    },
    {
      title: 'Scheduler & dispatch',
      fields: [
        { key: 'manageScheduler', label: 'Manage scheduler', description: 'Edit watch/dispatch settings, trigger dispatch, test the webhook, dismiss auth alerts' },
      ],
    },
    {
      title: 'Apple authentication',
      fields: [
        { key: 'manageAppleAuth', label: 'Apple ID re-authentication', description: 'Run the App Store sign-in flow - real Apple ID credentials pass through this' },
      ],
    },
    {
      title: 'Users',
      fields: [
        { key: 'viewUsers', label: 'View allowlist', description: 'See who has access and what they can do', impliedBy: ['manageUsers'] },
        { key: 'manageUsers', label: 'Manage allowlist', description: "Add or remove people, change anyone's permissions" },
      ],
    },
  ];

  const FIELDS = GROUPS.flatMap((g) => g.fields);

  const PRESETS: { label: string; permissions: Permissions }[] = [
    {
      label: 'Viewer',
      permissions: { decrypt: false, viewApiKeys: false, approveApiKeys: false, revokeApiKeys: false, manageScheduler: false, manageAppleAuth: false, viewUsers: false, manageUsers: false },
    },
    {
      label: 'Member',
      permissions: { decrypt: true, viewApiKeys: false, approveApiKeys: false, revokeApiKeys: false, manageScheduler: false, manageAppleAuth: false, viewUsers: false, manageUsers: false },
    },
    {
      label: 'Key manager',
      permissions: { decrypt: true, viewApiKeys: true, approveApiKeys: true, revokeApiKeys: true, manageScheduler: false, manageAppleAuth: false, viewUsers: false, manageUsers: false },
    },
    {
      label: 'Ops admin',
      permissions: { decrypt: true, viewApiKeys: false, approveApiKeys: false, revokeApiKeys: false, manageScheduler: true, manageAppleAuth: true, viewUsers: false, manageUsers: false },
    },
    {
      label: 'Admin',
      permissions: { decrypt: true, viewApiKeys: true, approveApiKeys: true, revokeApiKeys: true, manageScheduler: true, manageAppleAuth: true, viewUsers: true, manageUsers: true },
    },
  ];

  function applyPreset(p: Permissions): void {
    value = { ...p };
  }

  function matchesPreset(p: Permissions): boolean {
    return FIELDS.every((f) => value[f.key] === p[f.key]);
  }

  function toggle(key: keyof Permissions): void {
    value = normalizePermissions({ ...value, [key]: !value[key] });
  }

  function isImplied(f: Field): boolean {
    return !!f.impliedBy?.some((k) => value[k]);
  }
</script>

<div class="flex flex-wrap gap-1.5">
  {#each PRESETS as preset (preset.label)}
    <button
      type="button"
      class={cn(
        'cursor-pointer rounded-full border px-2.5 py-1 text-xs',
        matchesPreset(preset.permissions) ? 'border-accent bg-accent/15 text-text' : 'border-border text-muted hover:text-text',
      )}
      onclick={() => applyPreset(preset.permissions)}
    >
      {preset.label}
    </button>
  {/each}
</div>
<div class="mt-3 flex flex-col gap-3.5">
  {#each GROUPS as group (group.title)}
    <div>
      <div class="mb-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">{group.title}</div>
      <div class="flex flex-col gap-2">
        {#each group.fields as f (f.key)}
          {@const implied = isImplied(f)}
          <label
            class={cn(
              'border-border flex items-start gap-2.5 rounded-md border p-2.5',
              implied ? 'cursor-not-allowed opacity-70' : 'hover:bg-panel-muted cursor-pointer',
            )}
          >
            <input
              type="checkbox"
              class={cn('mt-0.5', implied ? 'cursor-not-allowed' : 'cursor-pointer')}
              checked={value[f.key] || implied}
              disabled={implied}
              onchange={() => toggle(f.key)}
            />
            <div class="min-w-0">
              <div class="text-sm">{f.label}</div>
              <div class="text-xs text-muted">{implied ? `${f.description} (included above)` : f.description}</div>
            </div>
          </label>
        {/each}
      </div>
    </div>
  {/each}
</div>
