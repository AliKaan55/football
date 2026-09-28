import { checkAdmin } from './_lib/auth.js';

// POST /api/auth  { password }  ->  { ok: true } | 401
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    return;
  }
  const password = String((req.body && req.body.password) || '');
  if (await checkAdmin(req, res, password)) {
    res.status(200).json({ ok: true });
  }
}
