import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { emitJobsChanged } from '../events.js';
import { scopedLogger } from '../logger.js';

const log = scopedLogger('jobs');
import type { Job } from './types.js';

export async function runDecrypt(job: Job): Promise<void> {
  await mkdir(config.outputDir, { recursive: true });
  const outputPath = path.join(config.outputDir, `${job.id}.ipa`);
  job.filePath = outputPath;

  const args = ['decrypt', job.bundleId, '--from-appstore', '--output', outputPath];
  if (job.externalVersionId) args.push('--external-version-id', job.externalVersionId);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(config.ipadecryptBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    const onLine = (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim();
      if (!text) return;
      const lastLine = text.split('\n').at(-1) ?? text;
      job.progress = lastLine;
      log.info('ipadecrypt output', { jobId: job.id, bundleId: job.bundleId, line: lastLine });
      emitJobsChanged();
    };

    child.stdout.on('data', onLine);
    child.stderr.on('data', onLine);

    child.on('error', (err) => reject(err));

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ipadecrypt exited with code ${code}: ${job.progress}`));
      }
    });
  });

  const st = await stat(outputPath);
  job.fileSizeBytes = st.size;
}
