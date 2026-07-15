import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.API_KEY ??= 'test-api-key';
process.env.DOWNLOAD_SIGNING_SECRET ??= 'test-signing-secret';
process.env.ADMIN_PASSWORD ??= 'test-admin-password';
process.env.STATE_DIR ??= mkdtempSync(path.join(tmpdir(), 'ipadecrypt-test-state-'));
process.env.OUTPUT_DIR ??= mkdtempSync(path.join(tmpdir(), 'ipadecrypt-test-output-'));
