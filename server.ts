import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import verifyHandler from './api/verify-footballer.js';
import authHandler from './api/auth.js';
import teamsHandler from './api/teams.js';
import playersHandler from './api/players.js';

// =============================================================================
// Local dev server. The /api/verify-footballer route below mirrors the
// production Vercel serverless function at api/verify-footballer.ts — both
// share the exact same verification logic from api/_lib/verify.ts, so
// behavior is identical between `npm run dev` and the deployed site.
// =============================================================================

async function startServer() {
  const app = express();
  app.use(express.json());

  // Üretimdeki Vercel fonksiyonlarının (api/*.ts) birebir aynıları burada da çalışır.
  app.all('/api/verify-footballer', (req, res) => verifyHandler(req, res));
  app.all('/api/auth', (req, res) => authHandler(req, res));
  app.all('/api/teams', (req, res) => teamsHandler(req, res));
  app.all('/api/players', (req, res) => playersHandler(req, res));

  // Vite middleware for development
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();