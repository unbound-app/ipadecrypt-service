import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { startJobSweeper } from './jobs/store.js';
import { log } from './logger.js';
import { adminRouter } from './routes/admin.js';
import { decryptRouter } from './routes/decrypt.js';
import { healthRouter } from './routes/health.js';
import { startScheduler } from './scheduler/index.js';
import { startStateFlusher } from './store/state.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const app = express();
app.use(express.json());

// Every route requires auth (see auth.ts / adminAuth.ts) - the two
// deliberate exceptions are the static dashboard shell (a login form with
// no data in it) and POST /v1/admin/login itself.
app.get('/admin', (_req, res) => res.sendFile(path.join(publicDir, 'admin.html')));

app.use(healthRouter);
app.use(decryptRouter);
app.use(adminRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});

startJobSweeper();
startStateFlusher();
startScheduler();

app.listen(config.port, config.bindHost, () => {
  log.info(`ipadecrypt-service listening on ${config.bindHost}:${config.port}`);
});
