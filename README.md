# Futbol Kura & Bölmeler

Mobil ve web platformlarında çalışan, 5 büyük lig ve Süper Lig takımlarıyla
entegre, heyecan verici bir futbol kura oyunu.

Futbolcu doğrulama artık **yapay zekaya değil**, yerel bir Transfermarkt veri
setine dayanıyor: `data/players-dataset.json` içinde 50.000'den fazla
futbolcunun gerçek transfer/kariyer geçmişi bulunur ve doğrulama tamamen
sunucuda, çevrimdışı ve anında yapılır (API anahtarı, internet bağlantısı
veya kota sınırı gerekmez).

## Yerelde Çalıştırma

**Gereksinimler:** Node.js

1. Bağımlılıkları yükleyin:
   `npm install`
2. Uygulamayı başlatın:
   `npm run dev`

## Futbolcu veri setini güncellemek isterseniz

`scripts/build-players-dataset.py`, [transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets)
projesinin `.duckdb` dosyasından `data/players-dataset.json` dosyasını yeniden
üretir. Daha güncel bir `.duckdb` dosyanız varsa:

```
pip install duckdb
python scripts/build-players-dataset.py /path/to/transfermarkt-datasets.duckdb
```

## Admin paneli (site içinden kulüp ve oyuncu yönetimi)

Header'daki ⚙️ butonundan açılır; şifre sunucuda doğrulanır.

- **Kulüpler** sekmesi: kulüp ekle / düzenle / sil. Liste veritabanında saklanır,
  tüm cihazlarda aynıdır.
- **Oyuncu Veritabanı** sekmesi: oyuncu ara, kulüp ekle/çıkar, yeni oyuncu ekle,
  düzenlemeyi geri al veya oyuncuyu sil. `data/players-dataset.json` (taban veri)
  değişmez; yapılan değişiklikler onun üzerine uygulanır.

### Vercel kurulumu (bir kez)

1. Vercel projesi > **Storage** > **Upstash Redis** (Marketplace) oluştur ve projeye bağla.
   `KV_REST_API_URL` ve `KV_REST_API_TOKEN` otomatik eklenir.
2. **Settings > Environment Variables** > `ADMIN_PASSWORD` ekle (kendi belirlediğin şifre).
3. Yeniden deploy et (Deployments > son deploy > Redeploy).

Yerelde (`npm run dev`) Redis gerekmez; `.env` içine `ADMIN_PASSWORD=...` yazarsan
değişiklikler `.local-store.json` dosyasına kaydedilir.
