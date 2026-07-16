<script lang="ts">
  import Switch from '../lib/components/ui/Switch.svelte';
  import { normalizePermissions, PERMISSION_META, type Permissions, type PermissionGroup } from '../lib/session.svelte';
  import { cn } from '../lib/utils';

  interface Props {
    value: Permissions;
  }

  let { value = $bindable() }: Props = $props();

  const GROUP_ORDER: PermissionGroup[] = [
    'Decryption',
    'API Keys',
    'Scheduler & Dispatch',
    'Apple Authentication',
    'Logs',
    'Users',
  ];

  const groups = GROUP_ORDER.map((title) => ({ title, fields: PERMISSION_META.filter((f) => f.group === title) })).filter(
    (g) => g.fields.length > 0,
  );

  const PRESETS: { label: string; permissions: Permissions }[] = [
    {
      label: 'Viewer',
      permissions: {
        decrypt: false,
        viewApiKeys: false,
        approveApiKeys: false,
        revokeApiKeys: false,
        manageScheduler: false,
        triggerDispatch: false,
        manageAppleAuth: false,
        viewLogs: false,
        viewUsers: false,
        manageUsers: false,
      },
    },
    {
      label: 'Member',
      permissions: {
        decrypt: true,
        viewApiKeys: false,
        approveApiKeys: false,
        revokeApiKeys: false,
        manageScheduler: false,
        triggerDispatch: false,
        manageAppleAuth: false,
        viewLogs: true,
        viewUsers: false,
        manageUsers: false,
      },
    },
    {
      label: 'Key manager',
      permissions: {
        decrypt: true,
        viewApiKeys: true,
        approveApiKeys: true,
        revokeApiKeys: true,
        manageScheduler: false,
        triggerDispatch: false,
        manageAppleAuth: false,
        viewLogs: true,
        viewUsers: false,
        manageUsers: false,
      },
    },
    {
      label: 'Ops admin',
      permissions: {
        decrypt: true,
        viewApiKeys: false,
        approveApiKeys: false,
        revokeApiKeys: false,
        manageScheduler: true,
        triggerDispatch: true,
        manageAppleAuth: true,
        viewLogs: true,
        viewUsers: false,
        manageUsers: false,
      },
    },
    {
      label: 'Admin',
      permissions: {
        decrypt: true,
        viewApiKeys: true,
        approveApiKeys: true,
        revokeApiKeys: true,
        manageScheduler: true,
        triggerDispatch: true,
        manageAppleAuth: true,
        viewLogs: true,
        viewUsers: true,
        manageUsers: true,
      },
    },
  ];

  function applyPreset(p: Permissions): void {
    value = { ...p };
  }

  function matchesPreset(p: Permissions): boolean {
    return PERMISSION_META.every((f) => value[f.key] === p[f.key]);
  }

  function toggle(key: keyof Permissions): void {
    value = normalizePermissions({ ...value, [key]: !value[key] });
  }

  function isImplied(f: (typeof PERMISSION_META)[number]): boolean {
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

<div class="border-border mt-3 divide-y rounded-lg border">
  {#each groups as group (group.title)}
    <div class="px-3 py-2">
      <div class="mb-0.5 text-[10px] font-semibold tracking-wider text-muted uppercase">{group.title}</div>
      {#each group.fields as f (f.key)}
        {@const implied = isImplied(f)}
        {@const checked = value[f.key] || implied}
        <div class="flex items-center gap-3 py-1.5">
          <div class="min-w-0 flex-1">
            <div class="text-[13px] text-text">{f.label}</div>
            <div class="truncate text-[11px] text-muted" title={f.description}>
              {implied ? 'Included by a permission below' : f.description}
            </div>
          </div>
          <Switch
            checked={checked}
            disabled={implied}
            onCheckedChange={() => toggle(f.key)}
            aria-label={f.label}
          />
        </div>
      {/each}
    </div>
  {/each}
</div>
