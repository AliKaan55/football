import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// LOCAL FOOTBALLER VERIFICATION — powered by the Transfermarkt dataset
// (https://github.com/dcaribou/transfermarkt-datasets), no AI/LLM calls.
//
// This replaces the previous Gemini AI + Google Search grounding + TheSportsDB
// integration. Every player's real transfer history is pre-processed (see
// scripts/build-players-dataset.py) into data/players-dataset.json, which is
// loaded once into memory here and used for instant, offline, deterministic
// verification. No API key, no network call, no rate limits, no hallucination
// risk — and since the source dataset is refreshed periodically, it stays
// accurate for recent transfers too.
// =============================================================================

const DATA_PATH = path.join(__dirname, 'data', 'players-dataset.json');

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

interface TeamRef {
  id: string;
  name: string;
}

interface VerificationResult {
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
  'the', 'de', 'del', 'of', 'van', 'von',
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

// -----------------------------------------------------------------------------
// Load & index the local player dataset once at startup.
// -----------------------------------------------------------------------------
let PLAYERS: IndexedPlayer[] = [];
const BY_EXACT_NAME = new Map<string, IndexedPlayer[]>();
const BY_WORD = new Map<string, IndexedPlayer[]>();

function loadPlayerDataset() {
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as PlayerRecord[];

  PLAYERS = parsed.map((p) => {
    const norm = normalizeKey(p.n);
    const words = p.n.split(/\s+/).map(normalizeKey).filter(Boolean);
    return { ...p, _norm: norm, _words: words };
  });

  for (const p of PLAYERS) {
    const exactList = BY_EXACT_NAME.get(p._norm);
    if (exactList) exactList.push(p);
    else BY_EXACT_NAME.set(p._norm, [p]);

    for (const w of new Set(p._words)) {
      const wordList = BY_WORD.get(w);
      if (wordList) wordList.push(p);
      else BY_WORD.set(w, [p]);
    }
  }

  console.log(`[veritabani] ${PLAYERS.length} futbolcu ve kariyer/transfer geçmişi belleğe yüklendi.`);
}

function pickMostFamous(list: IndexedPlayer[]): IndexedPlayer {
  return list.reduce((best, current) => (current.v > best.v ? current : best));
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
function findPlayer(query: string): IndexedPlayer | null {
  const q = normalizeKey(query);
  if (!q) return null;

  const pool = new Map<number, IndexedPlayer>();
  for (const p of BY_EXACT_NAME.get(q) || []) pool.set(p.i, p);
  for (const p of BY_WORD.get(q) || []) pool.set(p.i, p);
  if (pool.size > 0) return pickMostFamous([...pool.values()]);

  if (q.length >= 3) {
    const substringMatches = PLAYERS.filter((p) => p._norm.includes(q));
    if (substringMatches.length > 0) return pickMostFamous(substringMatches);
  }

  if (q.length >= 3) {
    let best: IndexedPlayer | null = null;
    let bestDist = Infinity;
    const threshold = Math.min(2, Math.max(1, Math.floor(q.length * 0.3)));
    for (const p of PLAYERS) {
      const candidates = [p._words[p._words.length - 1], p._norm];
      for (const w of candidates) {
        if (!w || Math.abs(w.length - q.length) > 2) continue;
        const dist = levenshtein(q, w);
        if (dist <= threshold && (dist < bestDist || (dist === bestDist && p.v > (best?.v ?? -1)))) {
          best = p;
          bestDist = dist;
        }
      }
    }
    return best;
  }

  return null;
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

  const teamTokens = tokenize(team.name);
  if (teamTokens.length === 0) return false;
  for (const club of rawClubs) {
    if (tokenSetEqual(teamTokens, tokenize(club))) return true;
  }
  return false;
}

function verifyFootballer(footballerName: string, selectedTeams: TeamRef[]): VerificationResult {
  const cleanName = footballerName.trim();
  const player = findPlayer(cleanName);

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

async function startServer() {
  loadPlayerDataset();

  const app = express();
  app.use(express.json());

  // API endpoint for footballer verification against selected teams — fully
  // local & synchronous now, so no loading/rate-limit/quota states needed.
  app.post('/api/verify-footballer', (req, res) => {
    try {
      const { footballerName, selectedTeams } = req.body;
      if (!footballerName || !selectedTeams || !Array.isArray(selectedTeams) || selectedTeams.length === 0) {
        return res.status(400).json({
          is_error: false,
          is_correct: false,
          identified_player: footballerName || '',
          matched_teams: [],
          missing_teams: [],
          message: 'Lütfen geçerli bir futbolcu adı ve en az 1 takım seçin.',
        });
      }

      const teams: TeamRef[] = selectedTeams.map((t: any) => ({
        id: String(t?.id ?? ''),
        name: String(t?.name ?? t?.id ?? t ?? ''),
      }));

      const result = verifyFootballer(String(footballerName), teams);
      return res.json({ is_error: false, ...result });
    } catch (err: any) {
      console.error('Doğrulama hatası:', err);
      return res.status(200).json({
        is_error: false,
        is_correct: false,
        identified_player: req.body?.footballerName || '',
        matched_teams: [],
        missing_teams: [],
        message: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
      });
    }
  });

  // Vite middleware for development
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
