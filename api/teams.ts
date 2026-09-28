import { checkAdmin } from './_lib/auth.js';
import { getStore } from './_lib/store.js';

const TEAMS_KEY = 'fk:teams';

function sanitizeTeam(t: any) {
  if (!t || typeof t.id !== 'string' || typeof t.name !== 'string') return null;
  const s = (v: any, max = 300) => String(v ?? '').slice(0, max);
  return {
    id: s(t.id, 120),
    name: s(t.name, 100),
    shortName: s(t.shortName, 10),
    leagueId: s(t.leagueId, 40),
    leagueName: s(t.leagueName, 80),
    logoUrl: s(t.logoUrl, 20000), // otomatik üretilen SVG rozetler data URL olabilir
    primaryColor: s(t.primaryColor, 20),
    secondaryColor: t.secondaryColor ? s(t.secondaryColor, 20) : undefined,
    founded: typeof t.founded === 'number' ? t.founded : undefined,
  };
}

// GET  /api/teams  -> { teams: Team[] | null }   (herkese açık)
// PUT  /api/teams  { teams: Team[] }             (yalnızca admin)
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    try {
      const teams = await getStore().getJSON<any[]>(TEAMS_KEY);
      res.status(200).json({ teams: Array.isArray(teams) && teams.length > 0 ? teams : null });
    } catch (err) {
      // Veritabanı bağlı değilse site varsayılan takımlarla çalışmaya devam eder.
      console.error('Takımlar okunamadı:', err);
      res.status(200).json({ teams: null });
    }
    return;
  }

  if (req.method === 'PUT') {
    if (!(await checkAdmin(req, res))) return;
    const incoming = req.body && req.body.teams;
    if (!Array.isArray(incoming) || incoming.length === 0 || incoming.length > 500) {
      res.status(400).json({ ok: false, message: 'Geçersiz takım listesi.' });
      return;
    }
    const clean = incoming.map(sanitizeTeam).filter(Boolean);
    if (clean.length !== incoming.length) {
      res.status(400).json({ ok: false, message: 'Listede geçersiz takım kaydı var.' });
      return;
    }
    try {
      await getStore().setJSON(TEAMS_KEY, clean);
      res.status(200).json({ ok: true, count: clean.length });
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err?.message || 'Takımlar kaydedilemedi.' });
    }
    return;
  }

  res.status(405).json({ ok: false, message: 'Method Not Allowed' });
}
