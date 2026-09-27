import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { verifyFootballer, type TeamRef } from './api/_lib/verify';

// =============================================================================
// Local dev server. The /api/verify-footballer route below mirrors the
// production Vercel serverless function at api/verify-footballer.ts — both
// share the exact same verification logic from api/_lib/verify.ts, so
// behavior is identical between `npm run dev` and the deployed site.
// =============================================================================

async function startServer() {
  const app = express();
  app.use(express.json());

  // API endpoint for footballer verification against selected teams — fully
  // local & synchronous now, so no loading/rate-limit/quota states needed.
  app.post('/api/verify-footballer', (req, res) => {
    try {
      const { footballerName, selectedTeams } = req.body;
      if (!footballerName || !selectedTeams || !Array.isArray(selectedTeams) || selectedTeams.length === 0) {
        return res.status(400).json({
          is_error: false,
          is_correct: false,
          identified_player: footballerName || '',
          matched_teams: [],
          missing_teams: [],
          message: 'Lütfen geçerli bir futbolcu adı ve en az 1 takım seçin.',
        });
      }

      const teams: TeamRef[] = selectedTeams.map((t: any) => ({
        id: String(t?.id ?? ''),
        name: String(t?.name ?? t?.id ?? t ?? ''),
      }));

      const result = verifyFootballer(String(footballerName), teams);
      return res.json({ is_error: false, ...result });
    } catch (err: any) {
      console.error('Doğrulama hatası:', err);
      return res.status(200).json({
        is_error: false,
        is_correct: false,
        identified_player: req.body?.footballerName || '',
        matched_teams: [],
        missing_teams: [],
        message: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
      });
    }
  });

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