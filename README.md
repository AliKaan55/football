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
