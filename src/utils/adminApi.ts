import { Team } from '../types';

// Admin şifresi yalnızca bu sekme açık kaldığı sürece (sessionStorage) tutulur.
const PW_KEY = 'fk_admin_pw';

export const getAdminPassword = (): string => {
  try {
    return sessionStorage.getItem(PW_KEY) || '';
  } catch {
    return '';
  }
};
export const setAdminPassword = (pw: string) => {
  try {
    sessionStorage.setItem(PW_KEY, pw);
  } catch {
    // ignore
  }
};
export const clearAdminPassword = () => {
  try {
    sessionStorage.removeItem(PW_KEY);
  } catch {
    // ignore
  }
};

export class AdminAuthError extends Error {
  constructor(message = 'Oturum süresi doldu veya şifre hatalı. Lütfen tekrar giriş yapın.') {
    super(message);
    this.name = 'AdminAuthError';
  }
}

async function call<T = any>(url: string, init: RequestInit = {}, admin = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (admin) headers['x-admin-password'] = getAdminPassword();
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { ...headers, ...(init.headers as any) } });
  } catch {
    throw new Error('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.');
  }
  const data: any = await res.json().catch(() => ({}));
  if (res.status === 401) throw new AdminAuthError(data?.message);
  if (!res.ok) throw new Error(data?.message || `Sunucu hatası (${res.status})`);
  return data as T;
}

// Şifreyi doğrular; başarılıysa oturuma kaydeder. Hata mesajı ya da null döner.
export async function loginAdmin(password: string): Promise<string | null> {
  try {
    await call('/api/auth', { method: 'POST', body: JSON.stringify({ password }) });
    setAdminPassword(password);
    return null;
  } catch (err: any) {
    return err?.message || 'Giriş yapılamadı.';
  }
}

export async function fetchServerTeams(): Promise<Team[] | null> {
  try {
    const data = await call<{ teams: Team[] | null }>('/api/teams');
    return Array.isArray(data.teams) && data.teams.length > 0 ? data.teams : null;
  } catch {
    return null; // çevrimdışı / sunucu yok: yerel önbellek kullanılır
  }
}

export async function saveServerTeams(teams: Team[]): Promise<void> {
  await call('/api/teams', { method: 'PUT', body: JSON.stringify({ teams }) }, true);
}

export interface AdminPlayer {
  i: number;
  n: string;
  v: number;
  c: string[];
  source: 'base' | 'edited' | 'custom';
}

export async function searchPlayersApi(q: string): Promise<AdminPlayer[]> {
  const data = await call<{ players: AdminPlayer[] }>(`/api/players?q=${encodeURIComponent(q)}`, {}, true);
  return data.players;
}

export async function savePlayerApi(p: { i?: number; n: string; v: number; c: string[] }): Promise<AdminPlayer> {
  const data = await call<{ player: AdminPlayer }>('/api/players', { method: 'POST', body: JSON.stringify(p) }, true);
  return data.player;
}

export async function deletePlayerApi(id: number, reset = false): Promise<void> {
  await call(`/api/players?id=${id}${reset ? '&reset=1' : ''}`, { method: 'DELETE' }, true);
}
