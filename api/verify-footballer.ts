import { verifyFootballer, type TeamRef } from './_lib/verify';

// Vercel Node.js Serverless Function. Deployed at /api/verify-footballer.
// Mirrors the local dev endpoint defined in server.ts (both share the same
// verification logic from ./_lib/verify).
export default function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ is_error: true, message: 'Method Not Allowed' });
    return;
  }

  try {
    const { footballerName, selectedTeams } = req.body || {};

    if (!footballerName || !selectedTeams || !Array.isArray(selectedTeams) || selectedTeams.length === 0) {
      res.status(400).json({
        is_error: false,
        is_correct: false,
        identified_player: footballerName || '',
        matched_teams: [],
        missing_teams: [],
        message: 'Lütfen geçerli bir futbolcu adı ve en az 1 takım seçin.',
      });
      return;
    }

    const teams: TeamRef[] = selectedTeams.map((t: any) => ({
      id: String(t?.id ?? ''),
      name: String(t?.name ?? t?.id ?? t ?? ''),
    }));

    const result = verifyFootballer(String(footballerName), teams);
    res.status(200).json({ is_error: false, ...result });
  } catch (err: any) {
    console.error('Doğrulama hatası:', err);
    res.status(200).json({
      is_error: false,
      is_correct: false,
      identified_player: (req.body && req.body.footballerName) || '',
      matched_teams: [],
      missing_teams: [],
      message: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
    });
  }
}