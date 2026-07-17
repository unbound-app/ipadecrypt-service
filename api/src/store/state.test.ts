import { describe, expect, test } from 'bun:test';
import { addAllowedUser, exportBackup, importBackup, listAllowedUsers, VIEWER_PERMISSIONS } from './state.js';

describe('exportBackup / importBackup', () => {
  test('round-trips the allowlist through export and import', () => {
    addAllowedUser('roundtrip-user', { ...VIEWER_PERMISSIONS, decrypt: true }, 'tester');
    const backup = exportBackup();

    expect(backup.backupVersion).toBe(1);
    expect(backup.allowedUsers.some((u) => u.username === 'roundtrip-user')).toBe(true);

    const result = importBackup(backup, 'tester');
    expect(result.ok).toBe(true);
    expect(listAllowedUsers().some((u) => u.username === 'roundtrip-user')).toBe(true);
  });

  test('rejects a backup with the wrong version', () => {
    const backup = exportBackup();
    const result = importBackup({ ...backup, backupVersion: 99 }, 'tester');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/version/);
  });

  test('rejects a backup with a malformed allowedUsers entry', () => {
    const backup = exportBackup();
    const result = importBackup({ ...backup, allowedUsers: [{ username: 'bad' }] }, 'tester');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/allowedUsers/);
  });

  test('rejects a non-object payload', () => {
    expect(importBackup(null, 'tester').ok).toBe(false);
    expect(importBackup('not json', 'tester').ok).toBe(false);
  });

  test('strips any plaintext pendingReveal from imported API keys', () => {
    const backup = exportBackup();
    const tampered = {
      ...backup,
      apiKeys: [
        {
          id: 'k1',
          name: 'sneaky',
          ownerId: 'root',
          status: 'approved' as const,
          createdAt: Date.now(),
          pendingReveal: 'should-not-survive-import',
        },
      ],
    };
    const result = importBackup(tampered, 'tester');
    expect(result.ok).toBe(true);
    const reExported = exportBackup();
    const key = reExported.apiKeys.find((k) => k.id === 'k1');
    expect(key?.pendingReveal).toBeUndefined();
  });
});
