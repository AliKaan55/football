import fs from 'fs';
import path from 'path';

// =============================================================================
// Küçük bir anahtar-değer deposu.
//  - Vercel'de: Upstash Redis (REST API üzerinden, ek paket gerekmez).
//    Vercel Marketplace'ten Upstash Redis bağlayınca ortam değişkenleri
//    otomatik eklenir (KV_REST_API_URL/TOKEN veya UPSTASH_REDIS_REST_URL/TOKEN).
//  - Yerelde (npm run dev): Redis ayarlı değilse .local-store.json dosyası.
// =============================================================================

export interface Store {
  getJSON<T>(key: string): Promise<T | null>;
  setJSON(key: string, value: unknown): Promise<void>;
  hgetallJSON<T>(key: string): Promise<Record<string, T>>;
  hsetJSON(key: string, field: string, value: unknown): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
}

export class StoreNotConfiguredError extends Error {
  constructor() {
    super(
      "Veritabanı bağlı değil. Vercel projesinde Storage bölümünden Upstash Redis bağlayın (KV_REST_API_URL ve KV_REST_API_TOKEN otomatik eklenir)."
    );
    this.name = 'StoreNotConfiguredError';
  }
}

function redisStore(url: string, token: string): Store {
  async function cmd(args: (string | number)[]): Promise<any> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(`Redis hatası: ${data.error || res.status}`);
    }
    return data.result;
  }

  return {
    async getJSON<T>(key: string) {
      const raw = await cmd(['GET', key]);
      return raw == null ? null : (JSON.parse(raw) as T);
    },
    async setJSON(key, value) {
      await cmd(['SET', key, JSON.stringify(value)]);
    },
    async hgetallJSON<T>(key: string) {
      const flat: string[] = (await cmd(['HGETALL', key])) || [];
      const out: Record<string, T> = {};
      for (let i = 0; i + 1 < flat.length; i += 2) {
        try {
          out[flat[i]] = JSON.parse(flat[i + 1]) as T;
        } catch {
          // bozuk kayıt varsa atla
        }
      }
      return out;
    },
    async hsetJSON(key, field, value) {
      await cmd(['HSET', key, field, JSON.stringify(value)]);
    },
    async hdel(key, field) {
      await cmd(['HDEL', key, field]);
    },
  };
}

function fileStore(): Store {
  const file = path.join(process.cwd(), '.local-store.json');
  const read = (): Record<string, any> => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      return {};
    }
  };
  const write = (data: Record<string, any>) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

  return {
    async getJSON<T>(key: string) {
      const v = read()[key];
      return v === undefined ? null : (v as T);
    },
    async setJSON(key, value) {
      const d = read();
      d[key] = value;
      write(d);
    },
    async hgetallJSON<T>(key: string) {
      return (read()[key] || {}) as Record<string, T>;
    },
    async hsetJSON(key, field, value) {
      const d = read();
      d[key] = d[key] || {};
      d[key][field] = value;
      write(d);
    },
    async hdel(key, field) {
      const d = read();
      if (d[key]) delete d[key][field];
      write(d);
    },
  };
}

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    cached = redisStore(url, token);
  } else if (process.env.VERCEL) {
    throw new StoreNotConfiguredError();
  } else {
    cached = fileStore();
  }
  return cached;
}
