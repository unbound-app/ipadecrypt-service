import { Router } from 'express';
import { checkPassword, clearSessionCookie, isSessionValid, requireAdminSession, setSessionCookie } from '../adminAuth.js';
import { getActiveJobs } from '../jobs/store.js';
import { applySchedule } from '../scheduler/index.js';
import {
  clearAppleAuthAlert,
  createApiKey,
  getAppleAuthAlert,
  getEffectiveSettings,
  getJobHistory,
  isSchedulerEnabled,
  listApiKeys,
  revokeApiKey,
  updateSettings,
} from '../store/state.js';

export const adminRouter = Router();

adminRouter.post('/v1/admin/login', (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || !checkPassword(password)) {
    res.status(401).json({ error: 'invalid password' });
    return;
  }
  setSessionCookie(res);
  res.json({ ok: true });
});

adminRouter.post('/v1/admin/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

adminRouter.get('/v1/admin/session', (req, res) => {
  res.json({ loggedIn: isSessionValid(req) });
});

adminRouter.use(requireAdminSession);

adminRouter.get('/v1/admin/overview', (_req, res) => {
  res.json({
    schedulerEnabled: isSchedulerEnabled(),
    settings: getEffectiveSettings(),
    appleAuthAlert: getAppleAuthAlert(),
    activeJobs: getActiveJobs().map((j) => ({
      id: j.id,
      bundleId: j.bundleId,
      source: j.source,
      status: j.status,
      progress: j.progress,
      createdAt: j.createdAt,
    })),
    recentHistory: getJobHistory().slice(0, 10),
  });
});

adminRouter.get('/v1/admin/jobs', (_req, res) => {
  res.json({ history: getJobHistory() });
});

adminRouter.get('/v1/admin/keys', (_req, res) => {
  res.json({ keys: listApiKeys() });
});

adminRouter.post('/v1/admin/keys', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  res.status(201).json(createApiKey(name));
});

adminRouter.delete('/v1/admin/keys/:id', (req, res) => {
  const revoked = revokeApiKey(req.params.id);
  if (!revoked) {
    res.status(404).json({ error: 'key not found' });
    return;
  }
  res.json({ ok: true });
});

adminRouter.get('/v1/admin/settings', (_req, res) => {
  res.json(getEffectiveSettings());
});

const SETTINGS_FIELDS = ['watchBundleId', 'watchAppRepo', 'ghDispatchRepo', 'ghWorkflowFile', 'pollCron', 'notifyWebhookUrl'] as const;

adminRouter.put('/v1/admin/settings', (req, res) => {
  const body = req.body ?? {};
  const patch: Record<string, string> = {};

  for (const field of SETTINGS_FIELDS) {
    if (typeof body[field] === 'string') patch[field] = body[field].trim();
  }

  const updated = updateSettings(patch);
  applySchedule();
  res.json(updated);
});

adminRouter.post('/v1/admin/auth-alert/clear', (_req, res) => {
  clearAppleAuthAlert();
  res.json({ ok: true });
});
