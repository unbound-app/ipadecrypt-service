<script lang="ts">
  import RelativeTime from '../../components/RelativeTime.svelte';
  import SkeletonRows from '../../components/SkeletonRows.svelte';
  import { addUser, fetchUsers, removeUser, type AllowedUser, type Role } from '../../lib/api';
  import { sessionState } from '../../lib/session.svelte';
  import { confirmDialog, showToast } from '../../lib/ui.svelte';

  let username = $state('');
  let role = $state<Role>('member');
  let users = $state<AllowedUser[] | null>(null);

  async function load(): Promise<void> {
    users = (await fetchUsers()).users;
  }

  $effect(() => {
    void load();
  });

  async function submit(): Promise<void> {
    const name = username.trim();
    if (!name) return;
    const { ok } = await addUser(name, role);
    if (ok) {
      username = '';
      void load();
    }
  }

  async function remove(name: string): Promise<void> {
    if ((sessionState.sub ?? '').toLowerCase() === name.toLowerCase()) {
      showToast("You can't remove your own account - ask another admin.", 'error');
      return;
    }
    if (!(await confirmDialog(`Remove ${name} from the allowlist?`))) return;
    const { ok } = await removeUser(name);
    if (ok) void load();
  }
</script>

<div class="panel">
  <h2>Add an allowed GitHub user</h2>
  <label for="user-username">GitHub username</label>
  <input id="user-username" placeholder="e.g. octocat" bind:value={username} />
  <label for="user-role">Role</label>
  <select id="user-role" bind:value={role}>
    <option value="member">member (read-only + own API keys)</option>
    <option value="admin">admin (full access)</option>
  </select>
  <button class="action" onclick={submit}>Add</button>
</div>

<div class="panel">
  <h2>Allowlist</h2>
  <div class="table-wrap">
    <table class="min-w">
      <thead>
        <tr>
          <th>Username</th>
          <th>Role</th>
          <th>Added</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#if users === null}
          <SkeletonRows rows={3} colspan={4} />
        {:else}
          {#each users as u (u.username)}
            <tr>
              <td>{u.username}</td>
              <td><span class="badge {u.role}">{u.role}</span></td>
              <td class="muted"><RelativeTime ms={u.addedAt} /></td>
              <td>
                {#if u.username === (sessionState.sub ?? '').toLowerCase()}
                  <span class="you-badge">(you)</span>
                {:else}
                  <button class="action small danger" onclick={() => remove(u.username)}>Remove</button>
                {/if}
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
