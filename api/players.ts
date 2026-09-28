import { checkAdmin } from './_lib/auth.js';
import { getStore, StoreNotConfiguredError } from './_lib/store.js';
import {
  PLAYER_OVERRIDES_KEY,
  invalidateOverlay,
  isBasePlayerId,
  searchPlayers,
  type PlayerOverride,
} from './_lib/verify.js';

// Oyuncu veritabanı yönetimi (yalnızca admin):
//   GET    /api/players?q=messi          -> arama
//   POST   /api/players  {i?, n, v, c[]} -> yeni oyuncu ekle / mevcut oyuncuyu güncelle
//   DELETE /api/players?id=123           -> oyuncuyu sil
//   DELETE /api/players?id=123&reset=1   -> yapılan düzenlemeyi geri al (taban veriye dön)
function cleanClubs(input: any): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const club = String(raw ?? '').trim().slice(0, 100);
    const key = club.toLowerCase();
    if (club && !seen.has(key)) {
      seen.add(key);
      out.push(club);
    }
  }
  return out.slice(0, 80);
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (!(await checkAdmin(req, res))) return;

  try {
    if (req.method === 'GET') {
      const q = String(req.query?.q ?? '');
      const players = await searchPlayers(q, 25);
      res.status(200).json({ ok: true, players });
      return;
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const n = String(body.n ?? '').trim().slice(0, 100);
      if (!n) {
        res.status(400).json({ ok: false, message: 'Oyuncu adı boş olamaz.' });
        return;
      }
      const c = cleanClubs(body.c);
      if (c.length === 0) {
        res.status(400).json({ ok: false, message: 'En az bir kulüp eklemelisiniz.' });
        return;
      }
      const v = Math.max(0, Math.min(2_000_000_000, Number(body.v) || 0));

      let record: PlayerOverride;
      if (body.i !== undefined && body.i !== null && body.i !== '') {
        const id = Number(body.i);
        if (!Number.isFinite(id)) {
          res.status(400).json({ ok: false, message: 'Geçersiz oyuncu ID.' });
          return;
        }
        record = { i: id, n, v, c, custom: !isBasePlayerId(id) };
      } else {
        record = { i: Date.now(), n, v, c, custom: true };
      }

      await getStore().hsetJSON(PLAYER_OVERRIDES_KEY, String(record.i), record);
      invalidateOverlay();
      res.status(200).json({ ok: true, player: { ...record, source: record.custom ? 'custom' : 'edited' } });
      return;
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query?.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ ok: false, message: 'Geçersiz oyuncu ID.' });
        return;
      }
      const reset = String(req.query?.reset ?? '') === '1';
      const store = getStore();
      if (reset || !isBasePlayerId(id)) {
        await store.hdel(PLAYER_OVERRIDES_KEY, String(id));
      } else {
        const tombstone: PlayerOverride = { i: id, deleted: true };
        await store.hsetJSON(PLAYER_OVERRIDES_KEY, String(id), tombstone);
      }
      invalidateOverlay();
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('Oyuncu yönetimi hatası:', err);
    const status = err instanceof StoreNotConfiguredError ? 503 : 500;
    res.status(status).json({ ok: false, message: err?.message || 'Beklenmeyen bir hata oluştu.' });
  }
}
