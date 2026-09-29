import fs from 'fs';
import path from 'path';
import { getStore } from './store.js';

// =============================================================================
// LOCAL FOOTBALLER VERIFICATION — powered by the Transfermarkt dataset
// (https://github.com/dcaribou/transfermarkt-datasets), no AI/LLM calls.
//
// Shared between the local dev server (server.ts) and the Vercel serverless
// function (api/verify-footballer.ts), so both environments run the exact
// same logic. Every player's real transfer history is pre-processed (see
// scripts/build-players-dataset.py) into data/players-dataset.json, which is
// loaded once into memory here and used for instant, offline, deterministic
// verification. No API key, no network call, no rate limits, no hallucination
// risk.
// =============================================================================

// Dataset location: process.cwd() is the project root locally and /var/task on
// Vercel (vercel.json `includeFiles` copies data/players-dataset.json there).
// A few fallbacks are tried in case the bundler moves files around.
function findDatasetPath(): string {
  const candidates = [
    path.join(process.cwd(), 'data', 'players-dataset.json'),
    path.join('/var/task', 'data', 'players-dataset.json'),
    path.join(process.cwd(), '..', 'data', 'players-dataset.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('players-dataset.json bulunamadı. Denenen yollar: ' + candidates.join(', '));
}

interface PlayerRecord {
  i: number; // player_id
  n: string; // display name
  v: number; // market value in EUR, used as a "fame" tie-breaker
  c?: string[]; // clubs played for (chronological, from Transfermarkt transfer history)
}

interface IndexedPlayer extends PlayerRecord {
  _norm: string;
  _words: string[];
}

export interface TeamRef {
  id: string;
  name: string;
}

export interface VerificationResult {
  matchedPlayerName: string;
  identified_player: string;
  all_career_teams: string[];
  matched_teams: string[];
  missing_teams: string[];
  is_correct: boolean;
  message: string;
}

// -----------------------------------------------------------------------------
// Turkish/diacritic-aware normalization: NFD-decompose, strip combining marks
// (covers ç/ş/ğ/ö/ü as well as e.g. š/č/ć/ő), special-case Turkish dotless ı,
// lowercase, then strip anything that isn't a-z0-9.
// -----------------------------------------------------------------------------
function normalizeKey(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/\u0131/g, 'i')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Generic club-name "legal suffix" words that should be ignored when comparing
// a user-entered/custom team name against a real club name, so e.g. "Milan"
// vs "AC Milan" match while "Milan" vs "Inter Milan" correctly do NOT.
const GENERIC_CLUB_TOKENS = new Set([
  'fc', 'cf', 'afc', 'sc', 'ac', 'as', 'us', 'ss', 'ssc', 'ol', 'om', 'bk', 'ik', 'fk', 'sk', 'ff', 'if',
  'bc', 'cd', 'ud', 'rc', 'sd', 'club', 'calcio', 'futbol', 'fussball', 'football', 'klub', 'kulubu',
  'kulup', 'jimnastik', 'gymnastic', 'gymnastics', 'associazione', 'sportiva', 'societa', 'spa', 'plc',
  'the', 'de', 'del', 'of', 'van', 'von', 'jk',
]);

function tokenize(name: string): string[] {
  return (name || '')
    .normalize('NFD')
    .replace(/\u0131/g, 'i')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !GENERIC_CLUB_TOKENS.has(w));
}

function tokenSetEqual(a: string[], b: string[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  const sa = new Set(a);
  for (const x of b) if (!sa.has(x)) return false;
  return true;
}

// Basic Levenshtein distance, used to tolerate small typos in player names.
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// -----------------------------------------------------------------------------
// Exact alias table for the app's 40 default clubs (see src/data/teams.ts).
// Matching a default team goes through this list first — it's the most
// precise path and avoids ambiguity between clubs that share a city name
// (AC Milan vs Inter Milan, Real Madrid vs Atlético Madrid, Manchester City
// vs Manchester United, etc). Any OTHER team (e.g. one an admin adds manually
// via the panel) falls back to the generic token-based comparison below.
// -----------------------------------------------------------------------------
const DEFAULT_TEAM_ALIASES: Record<string, string[]> = {
  liverpool: ['Liverpool FC', 'Liverpool'],
  'man-city': ['Manchester City', 'Man City', 'Manchester City FC'],
  'man-united': ['Manchester United', 'Man United', 'Man Utd', 'Manchester United FC'],
  arsenal: ['Arsenal FC', 'Arsenal'],
  chelsea: ['Chelsea FC', 'Chelsea'],
  tottenham: ['Tottenham Hotspur', 'Tottenham', 'Spurs'],
  newcastle: ['Newcastle United', 'Newcastle'],
  'aston-villa': ['Aston Villa'],
  'real-madrid': ['Real Madrid', 'Real Madrid CF'],
  barcelona: ['FC Barcelona', 'Barcelona', 'Barça'],
  'atletico-madrid': ['Atlético de Madrid', 'Atletico Madrid', 'Atlético Madrid', 'Atletico de Madrid'],
  sevilla: ['Sevilla FC', 'Sevilla'],
  valencia: ['Valencia CF', 'Valencia'],
  'athletic-bilbao': ['Athletic Bilbao', 'Athletic Club', 'Athletic de Bilbao'],
  'real-sociedad': ['Real Sociedad'],
  villarreal: ['Villarreal CF', 'Villarreal'],
  juventus: ['Juventus FC', 'Juventus', 'Juve'],
  inter: ['Inter Milan', 'Inter', 'FC Internazionale Milano', 'Internazionale'],
  milan: ['AC Milan', 'Milan'],
  napoli: ['SSC Napoli', 'Napoli'],
  roma: ['Associazione Sportiva Roma', 'AS Roma', 'Roma'],
  lazio: ['Società Sportiva Lazio S.p.A.', 'SS Lazio', 'Lazio'],
  atalanta: ['Atalanta BC', 'Atalanta'],
  fiorentina: ['ACF Fiorentina', 'Fiorentina'],
  'bayern-munich': ['Bayern Munich', 'FC Bayern München', 'Bayern München', 'Bayern'],
  dortmund: ['Borussia Dortmund', 'Dortmund', 'BVB'],
  leipzig: ['RB Leipzig', 'Leipzig'],
  'bayer-leverkusen': ['Bayer 04 Leverkusen', 'Bayer Leverkusen', 'Leverkusen'],
  frankfurt: ['Eintracht Frankfurt', 'Frankfurt'],
  psg: ['Paris Saint-Germain', 'PSG'],
  monaco: ['AS Monaco', 'Monaco'],
  marseille: ['Olympique Marseille', 'Marseille', 'OM'],
  lyon: ['Olympique Lyon', 'Lyon', 'OL', 'Olympique Lyonnais'],
  lille: ['LOSC Lille', 'Lille', 'LOSC'],
  galatasaray: ['Galatasaray'],
  fenerbahce: ['Fenerbahce', 'Fenerbahçe'],
  besiktas: ['Beşiktaş Jimnastik Kulübü', 'Beşiktaş', 'Besiktas'],
  trabzonspor: ['Trabzonspor'],
  basaksehir: ['Basaksehir FK', 'Başakşehir', 'Istanbul Basaksehir'],
  samsunspor: ['Samsunspor'],
};

const DEFAULT_TEAM_ALIASES_NORM: Record<string, Set<string>> = {};
for (const [id, list] of Object.entries(DEFAULT_TEAM_ALIASES)) {
  DEFAULT_TEAM_ALIASES_NORM[id] = new Set(list.map(normalizeKey));
}

// Wikidata/Transfermarkt kulüp adları farklı yazılabilir ("Paris Saint-Germain FC" gibi).
// Ek olarak, genel ekler (FC, AC, SK...) atıldıktan sonra kelime kümesi bir takma adla
// birebir aynıysa da eşleşme sayılır.
const DEFAULT_TEAM_ALIAS_TOKENS: Record<string, string[][]> = {};
for (const [id, list] of Object.entries(DEFAULT_TEAM_ALIASES)) {
  DEFAULT_TEAM_ALIAS_TOKENS[id] = list.map(tokenize).filter((t) => t.length > 0);
}

// -----------------------------------------------------------------------------
// Load & index the local player dataset once when this module is first
// imported (module-level state persists across requests within the same
// warm serverless instance, same as it did in the long-running dev server).
// -----------------------------------------------------------------------------
let PLAYERS: IndexedPlayer[] = [];
const BY_EXACT_NAME = new Map<string, IndexedPlayer[]>();
const BY_WORD = new Map<string, IndexedPlayer[]>();
const BASE_IDS = new Set<number>();

let loaded = false;

function loadPlayerDataset() {
  if (loaded) return;
  const raw = fs.readFileSync(findDatasetPath(), 'utf-8');
  const parsed = JSON.parse(raw) as PlayerRecord[];

  PLAYERS = parsed.map((p) => {
    const norm = normalizeKey(p.n);
    const words = p.n.split(/\s+/).map(normalizeKey).filter(Boolean);
    return { ...p, _norm: norm, _words: words };
  });

  for (const p of PLAYERS) {
    BASE_IDS.add(p.i);
    const exactList = BY_EXACT_NAME.get(p._norm);
    if (exactList) exactList.push(p);
    else BY_EXACT_NAME.set(p._norm, [p]);

    for (const w of new Set(p._words)) {
      const wordList = BY_WORD.get(w);
      if (wordList) wordList.push(p);
      else BY_WORD.set(w, [p]);
    }
  }

  loaded = true;
  console.log(`[veritabani] ${PLAYERS.length} futbolcu ve kariyer/transfer geçmişi belleğe yüklendi.`);
}

function pickMostFamous(list: IndexedPlayer[]): IndexedPlayer {
  return list.reduce((best, current) => (current.v > best.v ? current : best));
}

// -----------------------------------------------------------------------------
// Admin panelinden yapılan değişiklikler ("overlay"): taban veri setinin
// üzerine eklenen yeni oyuncular, düzenlenen oyuncular ve silinenler.
// Veritabanında (Redis) saklanır; burada kısa süreli bellekte önbelleğe alınır.
// -----------------------------------------------------------------------------
export interface PlayerOverride {
  i: number;
  n?: string;
  v?: number;
  c?: string[];
  deleted?: boolean;
  custom?: boolean; // true: tamamen yeni eklenmiş oyuncu, false: taban oyuncunun düzenlenmiş hali
}

export const PLAYER_OVERRIDES_KEY = 'fk:player-overrides';
const OVERLAY_TTL_MS = 10_000;

interface Overlay {
  at: number;
  list: IndexedPlayer[]; // silinmemiş override kayıtları
  blocked: Set<number>; // taban veride yok sayılacak oyuncu ID'leri
  byExact: Map<string, IndexedPlayer[]>;
  byWord: Map<string, IndexedPlayer[]>;
  customIds: Set<number>;
}

let overlayCache: Overlay | null = null;

function indexPlayer(p: PlayerRecord): IndexedPlayer {
  return { ...p, _norm: normalizeKey(p.n), _words: p.n.split(/\s+/).map(normalizeKey).filter(Boolean) };
}

function buildOverlay(records: PlayerOverride[]): Overlay {
  const overlay: Overlay = {
    at: Date.now(),
    list: [],
    blocked: new Set(),
    byExact: new Map(),
    byWord: new Map(),
    customIds: new Set(),
  };
  for (const r of records) {
    overlay.blocked.add(r.i);
    if (r.deleted) continue;
    if (r.custom) overlay.customIds.add(r.i);
    const ip = indexPlayer({ i: r.i, n: r.n || '', v: r.v || 0, c: r.c || [] });
    if (!ip._norm) continue;
    overlay.list.push(ip);
    const ex = overlay.byExact.get(ip._norm);
    if (ex) ex.push(ip);
    else overlay.byExact.set(ip._norm, [ip]);
    for (const w of new Set(ip._words)) {
      const wl = overlay.byWord.get(w);
      if (wl) wl.push(ip);
      else overlay.byWord.set(w, [ip]);
    }
  }
  return overlay;
}

async function getOverlay(): Promise<Overlay> {
  if (overlayCache && Date.now() - overlayCache.at < OVERLAY_TTL_MS) return overlayCache;
  try {
    const all = await getStore().hgetallJSON<PlayerOverride>(PLAYER_OVERRIDES_KEY);
    overlayCache = buildOverlay(Object.values(all));
  } catch (err) {
    // Veritabanına ulaşılamazsa doğrulama taban veriyle çalışmaya devam eder.
    console.error('Oyuncu değişiklikleri okunamadı, taban veri kullanılıyor:', err);
    overlayCache = buildOverlay([]);
    overlayCache.at = Date.now() - OVERLAY_TTL_MS + 2000; // 2 sn sonra tekrar dene
  }
  return overlayCache;
}

export function invalidateOverlay() {
  overlayCache = null;
}

export function isBasePlayerId(id: number): boolean {
  loadPlayerDataset();
  return BASE_IDS.has(id);
}

// Finds the most likely player for a (possibly partial, misspelled, or
// surname-only) query. Priority order:
//   1. Exact full-name match OR the query matches one of the player's name
//      words exactly (handles "ronaldo" -> Cristiano Ronaldo, "messi", etc).
//      Ties among several real players sharing a name/surname are broken by
//      market value, since that's the best available proxy for "who the
//      person most likely means".
//   2. Raw substring containment, for partial names that don't line up with
//      word boundaries.
//   3. Small-edit-distance fuzzy match, to tolerate typos.
// Admin değişiklikleri (overlay) her adımda taban verinin yerine geçer.
function findPlayer(query: string, overlay: Overlay): IndexedPlayer | null {
  const q = normalizeKey(query);
  if (!q) return null;
  const { blocked } = overlay;

  const pool = new Map<number, IndexedPlayer>();
  for (const p of BY_EXACT_NAME.get(q) || []) if (!blocked.has(p.i)) pool.set(p.i, p);
  for (const p of BY_WORD.get(q) || []) if (!blocked.has(p.i)) pool.set(p.i, p);
  for (const p of overlay.byExact.get(q) || []) pool.set(p.i, p);
  for (const p of overlay.byWord.get(q) || []) pool.set(p.i, p);
  if (pool.size > 0) return pickMostFamous([...pool.values()]);

  if (q.length >= 3) {
    const substringMatches = PLAYERS.filter((p) => !blocked.has(p.i) && p._norm.includes(q)).concat(
      overlay.list.filter((p) => p._norm.includes(q))
    );
    if (substringMatches.length > 0) return pickMostFamous(substringMatches);
  }

  if (q.length >= 3) {
    let best: IndexedPlayer | null = null;
    let bestDist = Infinity;
    const threshold = Math.min(2, Math.max(1, Math.floor(q.length * 0.3)));
    const consider = (p: IndexedPlayer) => {
      const candidates = [p._words[p._words.length - 1], p._norm];
      for (const w of candidates) {
        if (!w || Math.abs(w.length - q.length) > 2) continue;
        const dist = levenshtein(q, w);
        if (dist <= threshold && (dist < bestDist || (dist === bestDist && p.v > (best?.v ?? -1)))) {
          best = p;
          bestDist = dist;
        }
      }
    };
    for (const p of PLAYERS) if (!blocked.has(p.i)) consider(p);
    for (const p of overlay.list) consider(p);
    return best;
  }

  return null;
}

export interface PlayerSearchResult {
  i: number;
  n: string;
  v: number;
  c: string[];
  source: 'base' | 'edited' | 'custom';
}

// Admin paneli için oyuncu arama (taban veri + değişiklikler birleşik).
export async function searchPlayers(query: string, limit = 25): Promise<PlayerSearchResult[]> {
  loadPlayerDataset();
  const overlay = await getOverlay();
  const q = normalizeKey(query);

  const toResult = (p: IndexedPlayer, fromOverlay: boolean): PlayerSearchResult => ({
    i: p.i,
    n: p.n,
    v: p.v,
    c: p.c || [],
    source: fromOverlay ? (overlay.customIds.has(p.i) ? 'custom' : 'edited') : 'base',
  });

  if (!q) {
    // Arama boşsa son eklenen/düzenlenen oyuncuları göster.
    return overlay.list
      .slice()
      .sort((a, b) => b.i - a.i)
      .slice(0, limit)
      .map((p) => toResult(p, true));
  }

  const found = new Map<number, PlayerSearchResult>();
  const add = (p: IndexedPlayer, fromOverlay: boolean) => {
    if (!found.has(p.i)) found.set(p.i, toResult(p, fromOverlay));
  };

  // Önce düzenlenmiş/yeni kayıtlar, sonra taban veri.
  for (const p of overlay.list) if (p._norm.includes(q)) add(p, true);
  for (const p of BY_EXACT_NAME.get(q) || []) if (!overlay.blocked.has(p.i)) add(p, false);
  for (const p of BY_WORD.get(q) || []) if (!overlay.blocked.has(p.i)) add(p, false);
  if (found.size < limit * 4) {
    for (const p of PLAYERS) {
      if (found.size >= limit * 40) break;
      if (!overlay.blocked.has(p.i) && p._norm.includes(q)) add(p, false);
    }
  }

  return [...found.values()]
    .sort((a, b) => {
      const rank = (r: PlayerSearchResult) => (r.source === 'base' ? 1 : 0);
      return rank(a) - rank(b) || b.v - a.v;
    })
    .slice(0, limit);
}

// Checks whether the identified player's club history includes the given
// team. Default (built-in) teams are matched against the precise alias table
// above; any other (e.g. admin-added custom) team falls back to comparing
// normalized "significant word" sets against every club in the player's
// history, which safely handles legal-suffix differences (e.g. "Villarreal"
// vs "Villarreal CF") without confusing clubs that share a city name.
function playerHasTeam(normClubs: Set<string>, rawClubs: string[], team: TeamRef): boolean {
  const aliasSet = DEFAULT_TEAM_ALIASES_NORM[team.id];
  if (aliasSet) {
    for (const c of normClubs) {
      if (aliasSet.has(c)) return true;
    }
  }

  const aliasTokenSets = DEFAULT_TEAM_ALIAS_TOKENS[team.id];
  if (aliasTokenSets) {
    for (const club of rawClubs) {
      const ct = tokenize(club);
      if (ct.length > 0 && aliasTokenSets.some((a) => tokenSetEqual(a, ct))) return true;
    }
  }

  const teamTokens = tokenize(team.name);
  if (teamTokens.length === 0) return false;
  for (const club of rawClubs) {
    if (tokenSetEqual(teamTokens, tokenize(club))) return true;
  }
  return false;
}

export async function verifyFootballer(footballerName: string, selectedTeams: TeamRef[]): Promise<VerificationResult> {
  loadPlayerDataset(); // lazy: yalnızca ilk istekte yüklenir, hata olursa yakalanır
  const overlay = await getOverlay();
  const cleanName = footballerName.trim();
  const player = findPlayer(cleanName, overlay);

  if (!player) {
    return {
      matchedPlayerName: cleanName,
      identified_player: cleanName,
      all_career_teams: [],
      matched_teams: [],
      missing_teams: selectedTeams.map((t) => t.name),
      is_correct: false,
      message: `"${cleanName}" adında bir futbolcu veritabanında bulunamadı. Lütfen ismi kontrol edip tekrar deneyin.`,
    };
  }

  const clubs = player.c || [];
  const normClubs = new Set(clubs.map(normalizeKey));

  const matched_teams: string[] = [];
  const missing_teams: string[] = [];
  for (const team of selectedTeams) {
    if (playerHasTeam(normClubs, clubs, team)) matched_teams.push(team.name);
    else missing_teams.push(team.name);
  }

  const is_correct = missing_teams.length === 0 && matched_teams.length === selectedTeams.length;

  let message: string;
  if (is_correct) {
    message = `${player.n} seçilen ${selectedTeams.length === 1 ? 'takımın' : 'tüm takımların'} (${matched_teams.join(', ')}) formasını giymiştir! Doğru tahmin!`;
  } else if (matched_teams.length > 0) {
    message = `${player.n}, ${matched_teams.join(', ')} kulübünde forma giymiştir ancak ${missing_teams.join(', ')} kulübünde oynamamıştır.`;
  } else {
    message = `${player.n}, seçilen takımların (${missing_teams.join(', ')}) hiçbirinde oynamamıştır.`;
  }

  return {
    matchedPlayerName: player.n,
    identified_player: player.n,
    all_career_teams: clubs,
    matched_teams,
    missing_teams,
    is_correct,
    message,
  };
}