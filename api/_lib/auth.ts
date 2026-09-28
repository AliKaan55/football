import crypto from 'crypto';

// Admin işlemleri sunucu tarafında ADMIN_PASSWORD ortam değişkeniyle korunur.
// Şifre `x-admin-password` başlığıyla gönderilir. Şifre tanımlı değilse
// tüm admin işlemleri reddedilir (güvenli varsayılan).

function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export async function checkAdmin(req: any, res: any, passwordOverride?: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(503).json({
      ok: false,
      message: 'ADMIN_PASSWORD ortam değişkeni tanımlı değil. Vercel > Settings > Environment Variables bölümünden ekleyin.',
    });
    return false;
  }
  const header = req.headers?.['x-admin-password'];
  const given = String(passwordOverride ?? (Array.isArray(header) ? header[0] : header) ?? '');
  if (!given || !safeEqual(given, expected)) {
    await new Promise((r) => setTimeout(r, 600)); // kaba kuvveti yavaşlat
    res.status(401).json({ ok: false, message: 'Yönetici şifresi hatalı.' });
    return false;
  }
  return true;
}
