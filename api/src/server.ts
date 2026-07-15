import express from 'express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { startJobSweeper } from './jobs/store.js';
import { log } from './logger.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { decryptRouter } from './routes/decrypt.js';
import { healthRouter } from './routes/health.js';
import { startScheduler } from './scheduler/index.js';
import { startStateFlusher } from './store/state.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const app = express();
// Caddy is the only thing that can reach the app directly (see
// docker-compose.yml), so its X-Forwarded-For can be trusted for req.ip.
app.set('trust proxy', 'loopback');
app.use(express.json());

// Every response is session/state-dependent (the dashboard shell reflects
// live login state, API responses reflect live job/key state) except the
// two static assets below - nothing here should ever be cached by a
// browser or intermediary, or a client can get stuck seeing stale state
// no amount of reloading fixes.
app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Every route requires auth (see auth.ts / session.ts) - the deliberate
// exceptions are the static dashboard shell itself (a login form with no
// data in it), its favicon/OG image (so link-preview crawlers can fetch
// them without an API key), and the login/OAuth routes needed to
// establish a session.
//
// og:image/og:url need absolute URLs, so the placeholder in index.html's
// meta tags is filled in with the real PUBLIC_BASE_URL once at startup
// rather than being hardcoded to any one deployment's domain.
const indexHtml = readFileSync(path.join(publicDir, 'index.html'), 'utf8').replaceAll(
  '__PUBLIC_BASE_URL__',
  config.publicBaseUrl,
);
app.get('/', (_req, res) => res.type('html').send(indexHtml));
app.get('/favicon.svg', (_req, res) =>
  res.set('Cache-Control', 'public, max-age=86400').sendFile(path.join(publicDir, 'favicon.svg')),
);
app.get('/og-image.png', (_req, res) =>
  res.set('Cache-Control', 'public, max-age=86400').sendFile(path.join(publicDir, 'og-image.png')),
);

app.use(healthRouter);
app.use(decryptRouter);
app.use(authRouter);
app.use(dashboardRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'not found' });
});

startJobSweeper();
startStateFlusher();
startScheduler();

app.listen(config.port, config.bindHost, () => {
  log.info(`ipadecrypt-service listening on ${config.bindHost}:${config.port}`);
});
