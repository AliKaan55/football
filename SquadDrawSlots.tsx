import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Shuffle,
  Sparkles,
  Volume2,
  VolumeX,
  Shield,
  Trophy,
  RefreshCw,
  CheckCircle2,
  XCircle,
  User,
  ArrowRight,
  Bot,
  Check,
  RotateCcw,
  AlertCircle,
  Clock,
  Zap,
  SkipForward,
  Flame,
  Award,
  Sparkle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Team, LeagueId, DrawMode } from '../types';
import { LEAGUES } from '../data/teams';
import { TeamBadge } from './TeamBadge';
import { soundEngine } from '../utils/audio';

interface SquadDrawSlotsProps {
  teams: Team[];
  activeMode: DrawMode;
  drawnTeams: (Team | null)[];
  onTeamsDrawn: (teams: (Team | null)[]) => void;
  players: string[];
  gameType: 'single' | 'multi';
  initialActivePlayer: number;
  timerDuration?: number; // 0 (off), 30, 45, 60
  onReturnToMenu: () => void;
}

interface VerificationResult {
  is_correct: boolean;
  identifiedPlayer: string;
  allCareerTeams: string[];
  matched_teams: string[];
  missing_teams: string[];
  message: string;
  footballer: string;
  playerName: string;
  basePoints: number;
  timeBonus: number;
  totalPoints: number;
}

export const SquadDrawSlots: React.FC<SquadDrawSlotsProps> = ({
  teams,
  activeMode,
  drawnTeams,
  onTeamsDrawn,
  players,
  gameType,
  initialActivePlayer,
  timerDuration = 30,
  onReturnToMenu,
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinProgress, setSpinProgress] = useState(0); // 0 to 1
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState<LeagueId | 'all'>('all');
  const [isMuted, setIsMuted] = useState(soundEngine.muted);

  // Card preview states during 3-second spin
  const [previewTeams, setPreviewTeams] = useState<(Team | null)[]>([]);
  const [lockedSlots, setLockedSlots] = useState<boolean[]>([]);

  // Turn-Based Game State
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(initialActivePlayer);
  const [playerScores, setPlayerScores] = useState<number[]>(() => new Array(players.length).fill(0));
  const [roundCount, setRoundCount] = useState<number>(1);

  // Team selection state (User can select subset or all drawn teams)
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  // Footballer name input
  const [footballerInput, setFootballerInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastResult, setLastResult] = useState<VerificationResult | null>(null);
  const [errorWarning, setErrorWarning] = useState<string | null>(null);

  // ⏱️ Live Challenge / Timer State
  const [timeLeft, setTimeLeft] = useState<number>(timerDuration);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 🃏 Jokers State (Per Player: 1 Pass joker, 1 Reroll-Slot joker per game/turn)
  const [playerJokers, setPlayerJokers] = useState<
    Record<number, { passCount: number; rerollCount: number }>
  >(() => {
    const init: Record<number, { passCount: number; rerollCount: number }> = {};
    for (let i = 0; i < players.length; i++) {
      init[i] = { passCount: 1, rerollCount: 1 };
    }
    return init;
  });

  const soundCleanupRef = useRef<(() => void) | null>(null);
  // Tracks a pending auto-advance-to-next-turn timeout (after a correct/incorrect
  // guess, timer expiry, or pass joker). Kept in a ref so that whichever happens
  // first — the timeout firing, or the user manually clicking "Sıradaki Tura Geç" —
  // cancels the other, preventing the turn from being advanced twice (which used to
  // cause the turn to silently return to the SAME player, e.g. in a 2-player game).
  const nextTurnTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Make sure a pending auto-advance never fires after the component unmounts
  useEffect(() => {
    return () => {
      if (nextTurnTimeoutRef.current) {
        clearTimeout(nextTurnTimeoutRef.current);
      }
    };
  }, []);

  // Initialize preview and locked states when activeMode changes
  useEffect(() => {
    setPreviewTeams(new Array(activeMode).fill(null));
    setLockedSlots(new Array(activeMode).fill(false));
    setSelectedTeamIds([]);
    setLastResult(null);
  }, [activeMode]);

  // Clear selected teams if drawnTeams change
  useEffect(() => {
    setSelectedTeamIds([]);
    setLastResult(null);
  }, [drawnTeams]);

  // Filter pool based on selected league
  const availableTeams = selectedLeagueFilter === 'all'
    ? teams
    : teams.filter((t) => t.leagueId === selectedLeagueFilter);

  // Helper to pick distinct random teams
  const pickRandomTeams = (pool: Team[], count: number): Team[] => {
    const validPool = pool.length >= count ? pool : teams;
    const shuffled = [...validPool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, shuffled.length));
  };

  const toggleSound = () => {
    const newMuted = soundEngine.toggleMute();
    setIsMuted(newMuted);
  };

  // Staggered slot locking delays for dramatic effect over ~3s
  const getLockDelays = (count: number): number[] => {
    switch (count) {
      case 2:
        return [2300, 3000];
      case 3:
        return [2100, 2550, 3000];
      case 4:
        return [2000, 2350, 2700, 3000];
      case 5:
      default:
        return [2000, 2250, 2500, 2750, 3000];
    }
  };

  // Start round timer (called after draw is done)
  const startRoundTimer = useCallback(() => {
    if (timerDuration <= 0) return;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setTimeLeft(timerDuration);
    setIsTimerRunning(true);
  }, [timerDuration]);

  // Stop round timer
  const stopRoundTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsTimerRunning(false);
  }, []);

  // Timer Tick effect
  useEffect(() => {
    if (!isTimerRunning || timerDuration <= 0) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Timer Expired!
          clearInterval(timerIntervalRef.current!);
          timerIntervalRef.current = null;
          setIsTimerRunning(false);

          soundEngine.playTimeUpBuzzer();
          const activeName = players[activePlayerIndex] || 'Oyuncu';

          setLastResult({
            is_correct: false,
            identifiedPlayer: 'Süre Doldu',
            allCareerTeams: [],
            matched_teams: [],
            missing_teams: [],
            message: `⏱️ Süre doldu! ${activeName} zamanında tahmin yapamadı (0 Puan).`,
            footballer: '-',
            playerName: activeName,
            basePoints: 0,
            timeBonus: 0,
            totalPoints: 0,
          });

          // Move to next player after brief timeout
          scheduleAutoAdvance(3500);

          return 0;
        }

        // Ticking audio in final 5 seconds
        if (prev <= 6 && prev > 1) {
          soundEngine.playCountdownTick(prev <= 3);
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning, timerDuration, activePlayerIndex, players]);

  // Main 3-second shuffle animation
  const handleShuffle = () => {
    if (isSpinning) return;
    if (teams.length === 0) return;

    stopRoundTimer();
    setIsSpinning(true);
    setLockedSlots(new Array(activeMode).fill(false));
    setSpinProgress(0);
    setSelectedTeamIds([]);
    setLastResult(null);
    setErrorWarning(null);
    setFootballerInput('');

    // 1. Start thrilling audio synthesis
    soundCleanupRef.current = soundEngine.playExcitingShuffleSound();

    // 2. Select final teams
    const targetPool = availableTeams.length >= activeMode ? availableTeams : teams;
    const finalTeams = pickRandomTeams(targetPool, activeMode);

    while (finalTeams.length < activeMode && teams.length > 0) {
      finalTeams.push(teams[Math.floor(Math.random() * teams.length)]);
    }

    // 3. Pacing & Timing setup
    const startTime = Date.now();
    const duration = 3000; // 3.0 seconds
    const lockDelays = getLockDelays(activeMode);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      setSpinProgress(progress);

      setPreviewTeams(() => {
        return finalTeams.map((finalT, idx) => {
          if (elapsed >= (lockDelays[idx] || duration)) {
            return finalT;
          }
          const randomIdx = Math.floor(Math.random() * teams.length);
          return teams[randomIdx] || finalT;
        });
      });

      setLockedSlots((prev) => {
        return prev.map((locked, idx) => locked || elapsed >= (lockDelays[idx] || duration));
      });

      if (elapsed >= duration) {
        clearInterval(interval);
        setIsSpinning(false);
        setLockedSlots(new Array(activeMode).fill(true));
        setPreviewTeams(finalTeams);
        onTeamsDrawn(finalTeams);

        // Auto-select all drawn teams by default for faster play
        const allIds = finalTeams.filter(Boolean).map((t) => t!.id);
        setSelectedTeamIds(allIds);

        // Start countdown timer after draw completes
        if (timerDuration > 0) {
          startRoundTimer();
        }

        try {
          confetti({
            particleCount: 75,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10B981', '#38BDF8', '#F59E0B', '#EF4444', '#8B5CF6'],
          });
        } catch {
          // ignore
        }
      }
    }, 50);
  };

  // Advance to next player
  const handleAdvanceToNextPlayer = () => {
    setActivePlayerIndex((prev) => {
      const nextIdx = (prev + 1) % players.length;
      if (nextIdx === 0) {
        setRoundCount((rc) => rc + 1);
      }
      return nextIdx;
    });
  };

  // Next Turn action (shuffle new cards for next player)
  // IMPORTANT: this is the ONLY place that should ever advance the turn. It
  // cancels any pending auto-advance timeout first, so it's always safe to call
  // this both automatically (via scheduleAutoAdvance) and manually (button click)
  // without the turn ever being advanced twice.
  const handleNextTurnReset = () => {
    if (nextTurnTimeoutRef.current) {
      clearTimeout(nextTurnTimeoutRef.current);
      nextTurnTimeoutRef.current = null;
    }
    stopRoundTimer();
    setLastResult(null);
    setFootballerInput('');
    setSelectedTeamIds([]);
    handleAdvanceToNextPlayer();
    handleShuffle();
  };

  // Schedules the turn to auto-advance after `delay` ms, unless the user clicks
  // "Sıradaki Tura Geç" first (which calls handleNextTurnReset and cancels this).
  const scheduleAutoAdvance = (delay: number) => {
    if (nextTurnTimeoutRef.current) {
      clearTimeout(nextTurnTimeoutRef.current);
    }
    nextTurnTimeoutRef.current = setTimeout(() => {
      nextTurnTimeoutRef.current = null;
      handleNextTurnReset();
    }, delay);
  };

  // Reroll single slot (Direct or via Joker)
  const handleRerollSlot = (slotIndex: number, isJokerAction: boolean = false) => {
    if (isSpinning) return;
    const currentTeamIds = (isSpinning ? previewTeams : drawnTeams)
      .map((t) => t?.id)
      .filter(Boolean);
    const available = (availableTeams.length > 0 ? availableTeams : teams).filter(
      (t) => !currentTeamIds.includes(t.id)
    );
    const pool = available.length > 0 ? available : teams;
    if (pool.length === 0) return;
    const newTeam = pool[Math.floor(Math.random() * pool.length)];

    const updated = [...drawnTeams];
    updated[slotIndex] = newTeam;
    onTeamsDrawn(updated);

    if (isJokerAction) {
      soundEngine.playJokerUsedSound();
      setPlayerJokers((prev) => ({
        ...prev,
        [activePlayerIndex]: {
          ...prev[activePlayerIndex],
          rerollCount: Math.max(0, (prev[activePlayerIndex]?.rerollCount || 1) - 1),
        },
      }));
    } else {
      soundEngine.playClickSound();
    }
  };

  // 🃏 JOKER 1: Pas Geç (Pass Turn to Next Player without penalty)
  const handleUsePassJoker = () => {
    const activeJokers = playerJokers[activePlayerIndex] || { passCount: 1, rerollCount: 1 };
    if (activeJokers.passCount <= 0 || isSpinning || isVerifying) return;

    soundEngine.playJokerUsedSound();
    stopRoundTimer();

    setPlayerJokers((prev) => ({
      ...prev,
      [activePlayerIndex]: {
        ...prev[activePlayerIndex],
        passCount: 0,
      },
    }));

    const activeName = players[activePlayerIndex];
    setErrorWarning(null);

    setLastResult({
      is_correct: false,
      identifiedPlayer: 'Pas Geçildi 🃏',
      allCareerTeams: [],
      matched_teams: [],
      missing_teams: [],
      message: `${activeName} "Pas Geç" jokerini kullandı ve cezasız şekilde sırasını devretti.`,
      footballer: 'Pas',
      playerName: activeName,
      basePoints: 0,
      timeBonus: 0,
      totalPoints: 0,
    });

    scheduleAutoAdvance(2500);
  };

  // 🃏 JOKER 2: Rastgele 1 Zor Takımı Yeniden Çek
  const handleUseRerollJoker = () => {
    const activeJokers = playerJokers[activePlayerIndex] || { passCount: 1, rerollCount: 1 };
    if (activeJokers.rerollCount <= 0 || isSpinning || isVerifying) return;

    // Pick first drawn slot or random slot to reroll
    const targetSlotIndex = Math.floor(Math.random() * activeMode);
    handleRerollSlot(targetSlotIndex, true);
  };

  // Toggle team selection for AI verification
  const handleToggleSelectTeam = (team: Team | null) => {
    if (!team || isSpinning) return;
    setSelectedTeamIds((prev) => {
      if (prev.includes(team.id)) {
        return prev.filter((id) => id !== team.id);
      } else {
        return [...prev, team.id];
      }
    });
    soundEngine.playClickSound();
  };

  // Select all drawn teams
  const handleSelectAllTeams = () => {
    const allValidIds = drawnTeams.filter((t): t is Team => t !== null).map((t) => t.id);
    setSelectedTeamIds(allValidIds);
    soundEngine.playClickSound();
  };

  // AI Verification Handler with Timer Bonus Scoring
  const handleVerifyGuess = async () => {
    if (isVerifying || isSpinning) return;
    if (!footballerInput.trim()) {
      setErrorWarning('Lütfen kontrol edilecek futbolcu adını girin.');
      return;
    }
    if (selectedTeamIds.length === 0) {
      setErrorWarning('Lütfen en az 1 takım seçin.');
      return;
    }

    setErrorWarning(null);
    setIsVerifying(true);
    stopRoundTimer(); // Stop timer while evaluating

    const activePlayerName = players[activePlayerIndex] || 'Oyuncu';
    const selectedTeamsObjects = drawnTeams.filter((t): t is Team => t !== null && selectedTeamIds.includes(t.id));

    try {
      const response = await fetch('/api/verify-footballer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          footballerName: footballerInput.trim(),
          selectedTeams: selectedTeamsObjects,
        }),
      });

      const data = await response.json();

      if (data.is_error) {
        setErrorWarning(data.message || 'Sunucu yoğunluğu nedeniyle bağlantı kurulamadı, lütfen birkaç saniye sonra tekrar deneyin.');
        setIsVerifying(false);
        // Resume timer if failed
        if (timerDuration > 0 && timeLeft > 0) setIsTimerRunning(true);
        return;
      }

      const isCorrect = Boolean(data.is_correct);

      // 🏆 SCORING SYSTEM:
      // Base points: 1 point per selected team
      // Time bonus: If answered with > 50% time left => +2 bonus points, with > 25% time left => +1 bonus point
      const basePoints = isCorrect ? selectedTeamIds.length : 0;
      let timeBonus = 0;
      if (isCorrect && timerDuration > 0) {
        const timeRatio = timeLeft / timerDuration;
        if (timeRatio >= 0.5) {
          timeBonus = 2; // Lightning fast!
        } else if (timeRatio >= 0.25) {
          timeBonus = 1; // Good pace!
        }
      }

      const totalPoints = basePoints + timeBonus;

      if (isCorrect) {
        setPlayerScores((prev) => {
          const next = [...prev];
          next[activePlayerIndex] = (next[activePlayerIndex] || 0) + totalPoints;
          return next;
        });

        soundEngine.playTaskCompletedSound();

        try {
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.5 },
            colors: ['#10B981', '#38BDF8', '#F59E0B', '#E11D48'],
          });
        } catch {
          // ignore
        }
      }

      setLastResult({
        is_correct: isCorrect,
        identifiedPlayer: data.matchedPlayerName || data.identified_player || footballerInput.trim(),
        allCareerTeams: data.all_career_teams || [],
        matched_teams: data.matched_teams || [],
        missing_teams: data.missing_teams || [],
        message: data.message || (isCorrect ? 'Tebrikler!' : 'Hatalı tahmin.'),
        footballer: footballerInput.trim(),
        playerName: activePlayerName,
        basePoints,
        timeBonus,
        totalPoints,
      });

      // Automatically switch turn after showing result & wait 4s, or the player
      // can click "Sıradaki Tura Geç" to skip the wait — either way this now
      // performs the FULL turn transition (advance + reshuffle) exactly once.
      scheduleAutoAdvance(4000);

    } catch (err: any) {
      console.error(err);
      setErrorWarning('Yapay zeka sunucusuna bağlanırken hata oluştu.');
      if (timerDuration > 0 && timeLeft > 0) setIsTimerRunning(true);
    } finally {
      setIsVerifying(false);
    }
  };

  const currentDisplayTeams = isSpinning ? previewTeams : drawnTeams;
  const hasAnyTeamDrawn = drawnTeams.some((t) => t !== null);

  const getGridClasses = () => {
    switch (activeMode) {
      case 2:
        return 'grid grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto gap-3 sm:gap-6';
      case 3:
        return 'grid grid-cols-1 sm:grid-cols-3 max-w-5xl mx-auto gap-2.5 sm:gap-4';
      case 4:
        return 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto gap-2 sm:gap-4';
      case 5:
      default:
        return 'flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-5 w-full gap-1.5 sm:gap-3.5';
    }
  };

  const getSlotContainerClasses = (index: number) => {
    switch (activeMode) {
      case 2:
        return 'min-h-[140px] sm:min-h-[195px] p-3 sm:p-4';
      case 3:
        return 'min-h-[105px] sm:min-h-[185px] p-2.5 sm:p-4';
      case 4:
        return 'min-h-[95px] sm:min-h-[175px] p-2 sm:p-3.5';
      case 5:
      default:
        return 'min-h-[46px] sm:min-h-[175px] px-2.5 py-1.5 sm:p-3.5';
    }
  };

  const getBadgeSize = (): 'xs' | 'sm' | 'md' | 'lg' => {
    if (activeMode <= 3) return 'lg';
    return 'md';
  };

  const activePlayerName = players[activePlayerIndex] || 'Oyuncu';
  const currentJokers = playerJokers[activePlayerIndex] || { passCount: 1, rerollCount: 1 };
  const timerPercentage = timerDuration > 0 ? (timeLeft / timerDuration) * 100 : 100;

  return (
    <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800/80 shadow-2xl p-3 sm:p-6 lg:p-8 space-y-6">
      {/* Background stadium glow */}
      <div className="absolute inset-0 pointer-events-none opacity-25">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute -bottom-32 right-10 w-80 h-80 rounded-full bg-amber-500/20 blur-3xl" />
      </div>

      {/* TOP HEADER & RETURN TO MENU */}
      <div className="relative z-10 flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-extrabold text-xs">
            {activeMode}'li Bölme Modu
          </div>
          {timerDuration > 0 ? (
            <div className="flex items-center gap-1 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>{timerDuration}s Zamana Karşı Meydan Okuma</span>
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-400 font-medium text-xs">
              Süresiz Mod
            </div>
          )}
          <div className="text-xs text-slate-400 font-medium hidden md:block">
            {gameType === 'single' ? 'Bireysel Skor' : `Çok Oyunculu Düello (Tur #${roundCount})`}
          </div>
        </div>

        <button
          onClick={onReturnToMenu}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer border border-slate-700"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Ana Menüye Dön
        </button>
      </div>

      {/* 1. TURN-BASED SCOREBOARD & CANLI MEYDAN OKUMA PANEL */}
      <div className="relative z-10 bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-inner space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Active Player Banner */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Sıra Tabanlı Canlı Düello</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
                Sıradaki Oyuncu:{' '}
                <span className="px-3 py-0.5 rounded-lg text-sm sm:text-base font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  {activePlayerName}
                </span>
              </h3>
            </div>
          </div>

          {/* ⏱️ COUNTDOWN TIMER DISPLAY (If enabled) */}
          {timerDuration > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-md">
              <div className="relative flex items-center justify-center">
                <Clock className={`w-6 h-6 ${timeLeft <= 5 ? 'text-red-400 animate-bounce' : 'text-amber-400'}`} />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Kalan Süre
                </div>
                <div className={`font-mono font-black text-xl leading-none ${
                  timeLeft <= 5 ? 'text-red-400 animate-pulse' : timeLeft <= 10 ? 'text-amber-300' : 'text-white'
                }`}>
                  00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
                </div>
              </div>
              {/* Quick speed bonus indicator */}
              {isTimerRunning && (
                <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>{timeLeft >= timerDuration * 0.5 ? '+2 Hız Bonusu' : timeLeft >= timerDuration * 0.25 ? '+1 Hız Bonusu' : 'Standart Puan'}</span>
                </div>
              )}
            </div>
          )}

          {/* Players Score Comparison Cards */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 w-full lg:w-auto">
            {players.map((pName, idx) => {
              const isCurrent = idx === activePlayerIndex;
              const pScore = playerScores[idx] || 0;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 px-3.5 py-2 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-emerald-950/70 border-emerald-500/70 shadow-lg shadow-emerald-500/20 scale-105'
                      : 'bg-slate-900/60 border-slate-800 opacity-80'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isCurrent ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-bold text-xs text-white max-w-[100px] truncate">{pName}</div>
                    <div className="text-[11px] text-emerald-400 font-extrabold">{pScore} Puan</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Timer Bar */}
        {timerDuration > 0 && isTimerRunning && (
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-1000 ${
                timeLeft <= 5
                  ? 'bg-gradient-to-r from-red-600 to-rose-500 animate-pulse'
                  : timeLeft <= 10
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400'
              }`}
              style={{ width: `${timerPercentage}%` }}
            />
          </div>
        )}

        {/* 🃏 JOKER / YARDIM HAKLARI PANELİ */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-slate-300">{activePlayerName} Joker Hakları:</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Joker 1: Pas Geç */}
            <button
              onClick={handleUsePassJoker}
              disabled={currentJokers.passCount <= 0 || isSpinning || isVerifying || !hasAnyTeamDrawn}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                currentJokers.passCount > 0 && hasAnyTeamDrawn && !isSpinning && !isVerifying
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/40 hover:scale-105 shadow-sm'
                  : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-60'
              }`}
              title="Zor takımlarda cezasız sırayı sonraki oyuncuya geçir"
            >
              <SkipForward className="w-3.5 h-3.5" />
              <span>Pas Geç Jokeri ({currentJokers.passCount}/1)</span>
            </button>

            {/* Joker 2: 1 Takımı Yeniden Çek */}
            <button
              onClick={handleUseRerollJoker}
              disabled={currentJokers.rerollCount <= 0 || isSpinning || isVerifying || !hasAnyTeamDrawn}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                currentJokers.rerollCount > 0 && hasAnyTeamDrawn && !isSpinning && !isVerifying
                  ? 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border-sky-500/40 hover:scale-105 shadow-sm'
                  : 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-60'
              }`}
              title="1 adet takımı rastgele yeniden çeker"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>1 Takımı Değiştir Jokeri ({currentJokers.rerollCount}/1)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Header bar */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
              {activeMode}'li Takım Bölmeleri & Seçim
              {isSpinning && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 animate-spin" />
                  Kura Çekiliyor ({Math.max(1, Math.round((1 - spinProgress) * 3))}s)
                </span>
              )}
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {activePlayerName}, çıkan takımlardan istediklerini seçerek tahmin yapabilir! (Seçilen her takım +1 puan kazandırır)
          </p>
        </div>

        {/* Controls: League Filter & Sound Toggle */}
        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          {hasAnyTeamDrawn && !isSpinning && (
            <button
              onClick={handleSelectAllTeams}
              className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              Tümünü Seç ({drawnTeams.filter(Boolean).length})
            </button>
          )}

          <select
            value={selectedLeagueFilter}
            onChange={(e) => setSelectedLeagueFilter(e.target.value as LeagueId | 'all')}
            disabled={isSpinning}
            className="flex-1 sm:flex-none bg-slate-800/90 border border-slate-700/80 text-[11px] sm:text-xs text-slate-200 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 cursor-pointer"
          >
            <option value="all">🌍 Tüm Ligler ({teams.length} Takım)</option>
            <option value="super-lig">🇹🇷 Süper Lig</option>
            <option value="premier-league">🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League</option>
            <option value="la-liga">🇪🇸 La Liga</option>
            <option value="serie-a">🇮🇹 Serie A</option>
            <option value="bundesliga">🇩🇪 Bundesliga</option>
            <option value="ligue-1">🇫🇷 Ligue 1</option>
          </select>

          <button
            onClick={toggleSound}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isMuted
                ? 'bg-slate-800/60 text-slate-500 border-slate-700'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
            title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Progress Bar during spin */}
      {isSpinning && (
        <div className="relative z-10 w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 transition-all duration-75"
            style={{ width: `${spinProgress * 100}%` }}
          />
        </div>
      )}

      {/* DYNAMIC SLOTS CONTAINER (Clickable cards for selection) */}
      <div className={`relative z-10 ${getGridClasses()}`}>
        {Array.from({ length: activeMode }).map((_, index) => {
          const team = currentDisplayTeams[index];
          const isSlotLocked = lockedSlots[index];
          const isSlotSpinning = isSpinning && !isSlotLocked;
          const isSelected = team ? selectedTeamIds.includes(team.id) : false;

          if (!team && !isSpinning) {
            return (
              <div
                key={index}
                className={`relative flex flex-col justify-between ${getSlotContainerClasses(index)} rounded-xl sm:rounded-2xl border-2 border-dashed border-slate-800/90 bg-slate-950/40 text-center`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                  <span className="w-5 h-5 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 font-bold text-[10px]">
                    {index + 1}
                  </span>
                  <span className="text-[10px] uppercase text-slate-500">Boş</span>
                </div>
                <div className="flex flex-col items-center justify-center my-auto py-1">
                  <Shield className="w-5 h-5 text-slate-600 mb-1" />
                  <p className="text-[11px] font-medium text-slate-400">Takım Bekleniyor</p>
                </div>
              </div>
            );
          }

          if (isSlotSpinning) {
            return (
              <div
                key={index}
                className={`relative flex flex-col justify-between ${getSlotContainerClasses(index)} rounded-xl sm:rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-b from-slate-900 to-slate-950 overflow-hidden shadow-lg`}
              >
                <div className="flex items-center justify-between text-xs font-semibold mb-1">
                  <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                    {index + 1}
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono animate-pulse">Dönüyor...</span>
                </div>
                <div className="flex items-center gap-2 my-auto p-2 bg-slate-900/70 rounded-lg">
                  {team && <TeamBadge team={team} size="sm" className="animate-bounce" />}
                  <div className="h-3 bg-slate-700 rounded animate-pulse w-20" />
                </div>
              </div>
            );
          }

          return (
            <div
              key={index}
              onClick={() => handleToggleSelectTeam(team)}
              className={`relative flex flex-col justify-between ${getSlotContainerClasses(index)} rounded-xl sm:rounded-2xl border transition-all cursor-pointer group select-none ${
                isSelected
                  ? 'bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/70 shadow-lg shadow-emerald-500/30 scale-[1.01]'
                  : 'bg-gradient-to-b from-slate-900/95 via-slate-900 to-slate-950 border-slate-800 hover:border-slate-700 shadow-md hover:scale-[1.01]'
              }`}
              style={{
                boxShadow: team && isSelected ? `0 0 20px -4px ${team.primaryColor}50` : undefined,
              }}
            >
              {/* Top header with selection checkmark */}
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center text-white font-extrabold text-[10px] shadow-sm"
                    style={{ backgroundColor: team?.primaryColor || '#10b981' }}
                  >
                    {index + 1}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-slate-300">
                    {isSelected ? 'Seçildi ✓' : 'Seçmek için tıkla'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRerollSlot(index);
                    }}
                    disabled={isSpinning}
                    className="opacity-70 sm:opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                    title="Bu Bölmeyi Yeniden Çek"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Side-by-side team logo & name */}
              {team && (
                <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 my-auto shadow-inner min-w-0">
                  <TeamBadge team={team} size={getBadgeSize()} className="shrink-0 group-hover:scale-105 transition-transform" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-sm sm:text-base text-white tracking-tight truncate leading-snug group-hover:text-emerald-400 transition-colors">
                      {team.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs">{LEAGUES[team.leagueId]?.flag || '⚽'}</span>
                      <span className="text-[11px] text-slate-300 font-medium truncate">{team.leagueName}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-1 pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Bölme #{index + 1}</span>
                <span className={isSelected ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {isSelected ? `+${selectedTeamIds.length} Puan Değeri` : 'Pasif'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. PLAYER INPUT & AI VERIFICATION CONTROLS */}
      <div className="relative z-10 bg-slate-950/90 border border-slate-800/90 rounded-2xl p-4 sm:p-6 space-y-4 shadow-inner">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Footballer Name Input */}
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-300">
                ⚽ {activePlayerName} - Futbolcu Adını Girin:
              </label>
              {timerDuration > 0 && isTimerRunning && (
                <span className="text-[11px] font-mono text-amber-400 font-extrabold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Kalan: {timeLeft}s</span>
                </span>
              )}
            </div>
            <input
              type="text"
              value={footballerInput}
              onChange={(e) => {
                setFootballerInput(e.target.value);
                if (errorWarning) setErrorWarning(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isVerifying && !isSpinning && hasAnyTeamDrawn) {
                  e.preventDefault();
                  handleVerifyGuess();
                }
              }}
              placeholder="Örn: Lionel Messi, Eden Hazard, Mateo Kovačić..."
              disabled={isVerifying || isSpinning}
              className="w-full bg-slate-900 border border-slate-700/80 text-white placeholder-slate-500 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 shadow-inner"
            />
          </div>

          {/* Tahmin Et Button */}
          <div className="w-full md:w-auto flex items-end">
            <button
              onClick={handleVerifyGuess}
              disabled={isVerifying || isSpinning || !hasAnyTeamDrawn}
              className={`w-full md:w-auto px-8 py-3.5 rounded-xl font-extrabold text-sm text-white shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isVerifying || isSpinning || !hasAnyTeamDrawn
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-600 hover:from-emerald-400 hover:to-sky-500 active:scale-95 shadow-emerald-500/30 border border-emerald-400/40'
              }`}
            >
              {isVerifying ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-emerald-300" />
                  <span>Yapay Zeka İnceliyor...</span>
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4" />
                  <span>
                    Tahmin Et ({selectedTeamIds.length} Takım = +{selectedTeamIds.length} Puan
                    {timerDuration > 0 && timeLeft >= timerDuration * 0.5 ? ' +2 Hız' : ''})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Warning if validation fails */}
        {errorWarning && (
          <div className="p-3.5 rounded-xl bg-amber-950/85 border border-amber-500/60 text-amber-200 text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-lg shadow-amber-500/10">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
            <span>{errorWarning}</span>
          </div>
        )}

        {/* AI VERIFICATION RESULT DISPLAY BANNER */}
        {lastResult && (
          <div className={`p-4 sm:p-5 rounded-2xl border animate-in fade-in slide-in-from-top-2 duration-300 ${
            lastResult.is_correct
              ? 'bg-emerald-950/80 border-emerald-500/60 shadow-xl shadow-emerald-500/20 text-emerald-100'
              : 'bg-red-950/80 border-red-500/60 shadow-xl shadow-red-500/20 text-red-100'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-white shadow-lg ${
                  lastResult.is_correct ? 'bg-emerald-500 shadow-emerald-500/40' : 'bg-red-500 shadow-red-500/40'
                }`}>
                  {lastResult.is_correct ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className="font-black text-base sm:text-lg tracking-tight">
                    {lastResult.is_correct ? (
                      <span className="text-emerald-300">
                        Tebrikler {lastResult.playerName}! "{lastResult.footballer}" seçilen tüm takımlarda oynadı!
                        {' '}(+{lastResult.totalPoints} Puan{lastResult.timeBonus > 0 ? ` [${lastResult.basePoints} Takım + ${lastResult.timeBonus} Hız Bonusu ⚡]` : ''})
                      </span>
                    ) : (
                      <span className="text-red-300">
                        {lastResult.identifiedPlayer === 'Süre Doldu'
                          ? '⏱️ Süre Doldu! Zamanında doğru tahmin yapılamadı.'
                          : lastResult.identifiedPlayer.includes('Pas')
                          ? '🃏 Pas Jokeri Kullanıldı'
                          : `Hatalı Tahmin! "${lastResult.footballer}" seçilen tüm takımlarda oynamadı.`}
                      </span>
                    )}
                  </h4>
                  <p className="text-xs sm:text-sm mt-1 opacity-90 leading-relaxed">
                    {lastResult.message}
                  </p>

                  {lastResult.identifiedPlayer && !lastResult.identifiedPlayer.includes('Pas') && lastResult.identifiedPlayer !== 'Süre Doldu' && (
                    <div className="mt-2 text-xs font-bold text-slate-200 bg-slate-900/60 px-2.5 py-1 rounded-lg inline-block border border-slate-700/80">
                      🔍 Tespit Edilen Oyuncu: <span className="text-emerald-400">{lastResult.identifiedPlayer}</span>
                    </div>
                  )}

                  {lastResult.allCareerTeams && lastResult.allCareerTeams.length > 0 && (
                    <div className="mt-1.5 text-xs text-slate-300">
                      <span className="font-semibold text-slate-400">Tüm Kariyer Takımları:</span> {lastResult.allCareerTeams.join(', ')}
                    </div>
                  )}

                  {lastResult.missing_teams.length > 0 && (
                    <div className="mt-2 text-xs font-semibold text-red-200">
                      Oynamadığı/Eksik Takımlar: {lastResult.missing_teams.join(', ')}
                    </div>
                  )}
                  {lastResult.matched_teams.length > 0 && (
                    <div className="mt-1 text-xs font-semibold text-emerald-200">
                      Oynadığı Takımlar: {lastResult.matched_teams.join(', ')}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleNextTurnReset}
                className="px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-700 text-xs font-bold text-white transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>Sıradaki Tura Geç</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* UNDERNEATH THE SLOTS: THE "KARIŞTIR" BUTTON */}
      <div className="relative z-10 pt-2 flex flex-col items-center justify-center gap-2">
        <button
          onClick={handleShuffle}
          disabled={isSpinning}
          className={`relative group inline-flex items-center justify-center gap-2 sm:gap-3 px-6 sm:px-12 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg text-white shadow-2xl transition-all duration-200 select-none ${
            isSpinning
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-600 hover:from-emerald-400 hover:via-teal-400 hover:to-sky-500 active:scale-95 shadow-emerald-500/30 hover:shadow-emerald-500/50 border border-emerald-400/40 cursor-pointer'
          }`}
        >
          <Shuffle
            className={`w-4 h-4 sm:w-6 sm:h-6 shrink-0 transition-transform ${
              isSpinning ? 'animate-spin text-emerald-400' : 'group-hover:rotate-180 duration-500'
            }`}
          />
          <span className="tracking-wide">
            {isSpinning ? `${activeMode}'li Çekiliyor (3s)...` : `${activeMode}'li Kura Çek & Canlı Meydan Oku`}
          </span>
          <span className="text-base sm:text-xl">⚽</span>
        </button>

        <p className="text-[11px] sm:text-xs text-slate-400 text-center max-w-md px-2">
          {hasAnyTeamDrawn
            ? `Takımları yeniden karıştırmak için butona basabilir; süre bitmeden en hızlı şekilde tahmin yaparak ekstra bonus puan kazanabilirsiniz.`
            : `Butona bastığınızda ${activeMode} takım dönerek bölmelere yerleşecek ve geri sayım sayacı başlayacaktır.`}
        </p>
      </div>
    </section>
  );
};
