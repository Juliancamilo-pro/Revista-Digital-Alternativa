import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrCreateUser } from './src/db/users.ts';
import { requireAuth } from './src/middleware/auth.ts';
import type { AuthRequest } from './src/middleware/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/users/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || '';
      const displayName = typeof req.user?.name === 'string' ? req.user.name : undefined;

      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Missing user identifier' });
      }

      const user = await getOrCreateUser(uid, email, displayName);
      return res.json({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      });
    } catch (error) {
      console.error('Failed to sync user:', error);
      return res.status(500).json({ error: 'Failed to synchronize user profile' });
    }
  });

  app.get('/api/users/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || '';
      const displayName = typeof req.user?.name === 'string' ? req.user.name : undefined;

      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized: Missing user identifier' });
      }

      const user = await getOrCreateUser(uid, email, displayName);
      return res.json({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      });
    } catch (error) {
      console.error('Failed to fetch authenticated user:', error);
      return res.status(500).json({ error: 'Failed to fetch user profile' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
