#!/usr/bin/env node
/**
 * Wikidata'dan (P54 "member of sports team") emekli/eski oyuncuların kulüp
 * geçmişini çekip data/players-dataset.json ile birleştirir.
 *
 * Kullanım (proje klasöründe, Node 18+):
 *   node scripts/import-wikidata-players.mjs --dry-run     # sadece kulüpleri Wikidata'da bulup gösterir
 *   node scripts/import-wikidata-players.mjs               # tam çalıştırma (uzun sürer, kaldığı yerden devam eder)
 *   node scripts/import-wikidata-players.mjs --merge-only  # ağa çıkmadan, önbellekteki veriyi birleştirir
 *
 * Seçenekler:
 *   --before=2014        Yalnızca bu yıldan ÖNCE başlayan kulüp dönemi olan oyuncuları al (varsayılan 2014)
 *   --all                Yıl filtresini kaldır (çok daha uzun sürer)
 *   --clubs="Göztepe,Sivasspor"   Varsayılan 40 kulübe ek kulüpler (Wikidata'da aranacak adlar)
 *   --only-clubs         Sadece --clubs ile verilenleri işle
 *   --batch=100          Kariyer sorgusu paket boyutu
 *
 * Ne yapar?
 *  1. Kulüp adlarını Wikidata'da arar (QID bulur) ve ekrana yazar — YANLIŞ eşleşme varsa aşağıdaki
 *     CLUB_QID_OVERRIDES içine doğru QID'yi yazın.
 *  2. Her kulüpte oynamış futbolcuları listeler, sonra bu futbolcuların TÜM kulüp geçmişini çeker.
 *  3. Mevcut veri setiyle birleştirir: aynı isim + en az bir ortak kulüp = aynı kişi (kulüpler eklenir);
 *     yoksa yeni oyuncu olarak eklenir. Milli takımlar ve yaş grubu/yedek takımlar alınmaz.
 *  4. Eski veri setini data/players-dataset.backup.json olarak yedekler.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATASET = path.join(ROOT, 'data', 'players-dataset.json');
const BACKUP = path.join(ROOT, 'data', 'players-dataset.backup.json');
const CACHE = path.join(ROOT, 'scripts', '.wikidata-cache.json');
const UA = 'FutbolKuraOyunu/1.0 (kisisel proje; Wikidata kariyer aktarimi)';

// Otomatik eşleşme yanlış çıkarsa: { 'Aranan ad': 'Q12345' }
const CLUB_QID_OVERRIDES = {};

const DEFAULT_CLUB_SEARCHES = [
  'Liverpool F.C.', 'Manchester City F.C.', 'Manchester United F.C.', 'Arsenal F.C.', 'Chelsea F.C.',
  'Tottenham Hotspur F.C.', 'Newcastle United F.C.', 'Aston Villa F.C.',
  'Real Madrid CF', 'FC Barcelona', 'Atlético Madrid', 'Sevilla FC', 'Valencia CF', 'Athletic Club',
  'Real Sociedad', 'Villarreal CF',
  'Juventus FC', 'Inter Milan', 'AC Milan', 'SSC Napoli', 'AS Roma', 'SS Lazio', 'Atalanta BC', 'ACF Fiorentina',
  'FC Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer 04 Leverkusen', 'Eintracht Frankfurt',
  'Paris Saint-Germain FC', 'AS Monaco FC', 'Olympique de Marseille', 'Olympique Lyonnais', 'Lille OSC',
  'Galatasaray S.K.', 'Fenerbahçe S.K.', 'Beşiktaş J.K.', 'Trabzonspor', 'İstanbul Başakşehir F.K.', 'Samsunspor',
];

// ---- argümanlar -------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : d;
};
const DRY = flag('dry-run');
const MERGE_ONLY = flag('merge-only');
const ALL = flag('all');
const BEFORE = Number(opt('before', '2014'));
const BATCH = Number(opt('batch', '100'));
const extra = (opt('clubs', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const SEARCHES = flag('only-clubs') ? extra : [...DEFAULT_CLUB_SEARCHES, ...extra];

// ---- yardımcılar ------------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GENERIC = new Set([
  'fc', 'cf', 'afc', 'sc', 'ac', 'as', 'us', 'ss', 'ssc', 'ol', 'om', 'bk', 'ik', 'fk', 'sk', 'ff', 'if', 'bc', 'cd',
  'ud', 'rc', 'sd', 'club', 'calcio', 'futbol', 'fussball', 'football', 'klub', 'kulubu', 'kulup', 'jimnastik',
  'gymnastic', 'gymnastics', 'associazione', 'sportiva', 'societa', 'spa', 'plc', 'the', 'de', 'del', 'of', 'van',
  'von', 'jk',
]);
const strip = (s) => (s || '').normalize('NFD').replace(/\u0131/g, 'i').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const normName = (s) => strip(s).replace(/[^a-z0-9]/g, '');
const tokKey = (club) =>
  strip(club).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !GENERIC.has(w)).sort().join('|');
const cleanClub = (s) => (s || '').replace(/\./g, '').replace(/\s+/g, ' ').trim(); // "F.C." -> "FC", "S.K." -> "SK"

// Milli takım/gençlik/yedek/kadın takımlarını ele
const BAD_CLUB = [
  /^Q\d+$/, /national/i, /\bU-?\d{2}\b/i, /under-?\d{2}/i, /\byouth\b/i, /\byth\b/i, /\bjuniors?\b/i,
  /\bacademy\b/i, /\breserves?\b/i, /\bwomen\b/i, /\bfemenin/i, /\bolympic\b/i, /\s(B|C|II|III|2)$/,
];
const goodClub = (label) => label && !BAD_CLUB.some((re) => re.test(label));

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE, 'utf-8'));
  } catch {
    return { clubs: {}, playersByClub: {}, careers: {} };
  }
}
const saveCache = (c) => fs.writeFileSync(CACHE, JSON.stringify(c));

async function http(url, init = {}) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...(init.headers || {}) } });
    } catch (err) {
      console.log(`  ağ hatası (${err.message}), ${attempt}. deneme...`);
      await sleep(5000 * attempt);
      continue;
    }
    if (res.ok) return res.json();
    if ([429, 500, 502, 503, 504].includes(res.status)) {
      const wait = (Number(res.headers.get('retry-after')) || 15) * 1000 * attempt;
      console.log(`  Wikidata ${res.status} döndü, ${Math.round(wait / 1000)} sn bekleniyor (${attempt}. deneme)...`);
      await sleep(wait);
      continue;
    }
    throw new Error(`HTTP ${res.status} ${url.slice(0, 120)}`);
  }
  throw new Error('Wikidata isteği tekrar denemelere rağmen başarısız oldu.');
}

const sparql = (query) =>
  http('https://query.wikidata.org/sparql', {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'query=' + encodeURIComponent(query),
  }).then((j) => j.results.bindings);

async function searchClub(term) {
  const url =
    'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=10&search=' +
    encodeURIComponent(term);
  const j = await http(url);
  const list = (j.search || []).filter(
    (x) => /football/i.test(x.description || '') && /club|team/i.test(x.description || '') && !/women|youth|reserve|under/i.test(x.description || '')
  );
  return list.map((x) => ({ qid: x.id, label: x.label, description: x.description }));
}

// ---- 1) kulüpleri çöz -------------------------------------------------------------------------
async function resolveClubs(cache) {
  console.log(`\n1/3 Kulüpler Wikidata'da aranıyor (${SEARCHES.length} kulüp)...`);
  for (const term of SEARCHES) {
    if (CLUB_QID_OVERRIDES[term]) {
      cache.clubs[term] = { qid: CLUB_QID_OVERRIDES[term], label: term + ' (elle)' };
    } else if (!cache.clubs[term]) {
      const found = await searchClub(term);
      cache.clubs[term] = found[0] ? { qid: found[0].qid, label: found[0].label, description: found[0].description } : null;
      if (DRY) cache.clubs[term] && (cache.clubs[term].alternatives = found.slice(1, 3));
      await sleep(400);
    }
    const c = cache.clubs[term];
    console.log(`  ${c ? '✓' : '✗'} ${term.padEnd(28)} -> ${c ? `${c.qid}  ${c.label} — ${c.description || ''}` : 'BULUNAMADI'}`);
  }
  saveCache(cache);
}

// ---- 2) kulüplerin oyuncularını, sonra kariyerlerini çek -------------------------------------
async function fetchPlayers(cache) {
  const clubs = Object.entries(cache.clubs).filter(([, c]) => c);
  console.log(`\n2/3 Kulüp oyuncuları çekiliyor (${clubs.length} kulüp)...`);
  let i = 0;
  for (const [term, c] of clubs) {
    i++;
    if (cache.playersByClub[c.qid]) {
      console.log(`  [${i}/${clubs.length}] ${term}: önbellekte (${cache.playersByClub[c.qid].length})`);
      continue;
    }
    const dateFilter = ALL ? '' : `FILTER(!BOUND(?start) || YEAR(?start) < ${BEFORE})`;
    const q = `SELECT DISTINCT ?p WHERE {
      ?p wdt:P106 wd:Q937857 .
      ?p p:P54 ?st . ?st ps:P54 wd:${c.qid} .
      OPTIONAL { ?st pq:P580 ?start . }
      ${dateFilter}
    }`;
    const rows = await sparql(q);
    cache.playersByClub[c.qid] = rows.map((r) => r.p.value.split('/').pop());
    saveCache(cache);
    console.log(`  [${i}/${clubs.length}] ${term}: ${cache.playersByClub[c.qid].length} oyuncu`);
    await sleep(1500);
  }

  const allIds = [...new Set(Object.values(cache.playersByClub).flat())].filter((id) => !cache.careers[id]);
  console.log(`\n3/3 ${allIds.length} oyuncunun kulüp geçmişi çekiliyor (paket: ${BATCH})...`);
  for (let s = 0; s < allIds.length; s += BATCH) {
    const ids = allIds.slice(s, s + BATCH);
    const q = `SELECT ?p ?pLabel ?sl ?teamLabel WHERE {
      VALUES ?p { ${ids.map((x) => 'wd:' + x).join(' ')} }
      ?p wikibase:sitelinks ?sl .
      ?p p:P54/ps:P54 ?team .
      ?team wdt:P31/wdt:P279* wd:Q476028 .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
    }`;
    const rows = await sparql(q);
    const got = {};
    for (const r of rows) {
      const id = r.p.value.split('/').pop();
      const o = (got[id] ||= { n: r.pLabel?.value || '', sl: Number(r.sl?.value) || 0, c: [] });
      const club = cleanClub(r.teamLabel?.value);
      if (goodClub(club) && !o.c.includes(club)) o.c.push(club);
    }
    for (const id of ids) cache.careers[id] = got[id] || { n: '', sl: 0, c: [] };
    saveCache(cache);
    console.log(`  ${Math.min(s + BATCH, allIds.length)}/${allIds.length}`);
    await sleep(1500);
  }
}

// ---- 4) birleştir -----------------------------------------------------------------------------
function merge(cache) {
  console.log('\nBirleştiriliyor...');
  const data = JSON.parse(fs.readFileSync(DATASET, 'utf-8'));
  if (!fs.existsSync(BACKUP)) fs.copyFileSync(DATASET, BACKUP);

  const byName = new Map();
  for (const p of data) {
    const k = normName(p.n);
    if (!k) continue;
    (byName.get(k) || byName.set(k, []).get(k)).push(p);
  }

  let merged = 0, addedClubsTotal = 0, added = 0, skipped = 0;
  const addedNames = [];

  for (const [qid, w] of Object.entries(cache.careers)) {
    const key = normName(w.n);
    if (!key || /^q\d+$/i.test(w.n) || w.c.length === 0) {
      skipped++;
      continue;
    }
    const wKeys = new Set(w.c.map(tokKey).filter(Boolean));

    let best = null, bestOverlap = 0;
    for (const cand of byName.get(key) || []) {
      const cKeys = new Set((cand.c || []).map(tokKey));
      let overlap = 0;
      for (const k of wKeys) if (cKeys.has(k)) overlap++;
      if (overlap > bestOverlap) {
        best = cand;
        bestOverlap = overlap;
      }
    }

    if (best) {
      const have = new Set((best.c || []).map(tokKey));
      const fresh = w.c.filter((c) => !have.has(tokKey(c)));
      if (fresh.length) {
        best.c = [...(best.c || []), ...fresh];
        merged++;
        addedClubsTotal += fresh.length;
      }
    } else {
      const qnum = Number(qid.replace(/\D/g, ''));
      const rec = { i: 2_000_000_000 + qnum, n: w.n, v: Math.min(w.sl * 150_000, 15_000_000), c: w.c };
      data.push(rec);
      (byName.get(key) || byName.set(key, []).get(key)).push(rec);
      added++;
      if (addedNames.length < 40) addedNames.push(w.n);
    }
  }

  fs.writeFileSync(DATASET, JSON.stringify(data));
  console.log(`\nBitti:`);
  console.log(`  Kulüp geçmişi tamamlanan mevcut oyuncu : ${merged} (toplam +${addedClubsTotal} kulüp)`);
  console.log(`  Yeni eklenen oyuncu                     : ${added}`);
  console.log(`  Atlanan (isimsiz/kulüpsüz)              : ${skipped}`);
  console.log(`  Veri seti toplam oyuncu                 : ${data.length}`);
  if (addedNames.length) console.log(`  Yeni eklenenlerden örnekler: ${addedNames.join(', ')}`);

  console.log('\nKontrol:');
  for (const n of ['Zinedine Zidane', 'Thierry Henry', 'Diego Maradona', 'Andrea Pirlo', 'David Beckham', 'Steven Gerrard', 'Hakan Şükür']) {
    const p = (byName.get(normName(n)) || []).sort((a, b) => b.v - a.v)[0];
    console.log(`  ${n.padEnd(18)} ${p ? (p.c || []).slice(0, 12).join(', ') : '— bulunamadı'}`);
  }
  console.log('\nVeri seti güncellendi. Şimdi commit edip push edin (yedek: data/players-dataset.backup.json, git\'e eklemeyin).');
}

// ---- ana akış ---------------------------------------------------------------------------------
(async () => {
  const cache = loadCache();
  if (!MERGE_ONLY) {
    await resolveClubs(cache);
    if (DRY) {
      console.log('\n--dry-run: Yukarıdaki eşleşmeleri kontrol edin. Yanlış olan varsa CLUB_QID_OVERRIDES içine doğru QID\'yi yazın.');
      return;
    }
    await fetchPlayers(cache);
  }
  merge(cache);
})().catch((e) => {
  console.error('\nHATA:', e.message);
  console.error('İlerleme önbellekte saklandı; aynı komutu tekrar çalıştırırsanız kaldığı yerden devam eder.');
  process.exit(1);
});
