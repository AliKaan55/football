import React, { useState } from 'react';
import { Trophy, Users, User, Plus, Trash2, Play, Sparkles, Shield, Dices } from 'lucide-react';
import { DrawMode } from '../types';

export interface GameConfig {
  mode: DrawMode;
  gameType: 'single' | 'multi';
  players: string[];
  startingPlayerIndex: number;
  timerDuration: number; // 0 for infinite/off, or 30, 45, 60 seconds
}

interface GameSetupProps {
  onStartGame: (config: GameConfig) => void;
}

export const GameSetup: React.FC<GameSetupProps> = ({ onStartGame }) => {
  const [selectedMode, setSelectedMode] = useState<DrawMode>(5);
  const [gameType, setGameType] = useState<'single' | 'multi'>('multi');
  const [timerDuration, setTimerDuration] = useState<number>(30); // 30s default
  const [players, setPlayers] = useState<string[]>(['Oyuncu 1', 'Oyuncu 2']);

  const handleGameTypeChange = (type: 'single' | 'multi') => {
    setGameType(type);
    if (type === 'single') {
      setPlayers(['Oyuncu 1']);
    } else {
      if (players.length < 2) {
        setPlayers(['Oyuncu 1', 'Oyuncu 2']);
      }
    }
  };

  const handleAddPlayer = () => {
    if (gameType === 'multi') {
      const nextIndex = players.length + 1;
      setPlayers((prev) => [...prev, `Oyuncu ${nextIndex}`]);
    }
  };

  const handleRemovePlayer = (index: number) => {
    if (players.length > 2 && gameType === 'multi') {
      setPlayers((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handlePlayerNameChange = (index: number, name: string) => {
    setPlayers((prev) => {
      const next = [...prev];
      next[index] = name;
      return next;
    });
  };

  const handleStart = () => {
    // Randomly select starting player
    const startingPlayerIndex = Math.floor(Math.random() * players.length);
    onStartGame({
      mode: selectedMode,
      gameType,
      players: players.map((p, i) => p.trim() || `Oyuncu ${i + 1}`),
      startingPlayerIndex,
      timerDuration,
    });
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-8">
        {/* Decorative background glows */}
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold uppercase tracking-widest shadow-inner">
            <Sparkles className="w-3.5 h-3.5" /> Futbol Kura & Canlı Meydan Okuma
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Oyun Kurulumu & Mod Seçimi
          </h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Bölme sayısını belirleyin, süreli mücadeleyi açın ve oyuncularınızla canlı düelloya başlayın!
          </p>
        </div>

        <div className="space-y-6 relative z-10">
          {/* 1. OYUN MODU SEÇ (2'li, 3'lü, 4'lü, 5'li) */}
          <div className="space-y-3">
            <label className="block text-xs font-black uppercase tracking-wider text-emerald-400">
              1. Oyun Modu Seç (Bölme Sayısı)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([2, 3, 4, 5] as DrawMode[]).map((mode) => {
                const isSelected = selectedMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectedMode(mode)}
                    className={`p-4 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/30 scale-105'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <span className="text-2xl font-black font-mono">{mode}'li</span>
                    <span className="text-xs opacity-90 font-medium">Bölme Kura</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. SÜRE / ZAMANA KARŞI MEYDAN OKUMA AYARI */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <span>⏱️ 2. Canlı Meydan Okuma & Süre Limiti</span>
              </label>
              <span className="text-[11px] text-slate-400">Hızlı cevap = Ekstra Bonus Puan</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { sec: 30, label: '30 Saniye', badge: '🔥 Klasik' },
                { sec: 45, label: '45 Saniye', badge: '⚡ İdeal' },
                { sec: 60, label: '60 Saniye', badge: '🛡️ Rahat' },
                { sec: 0, label: 'Süresiz', badge: '☕ Serbest' },
              ].map((opt) => {
                const isSelected = timerDuration === opt.sec;
                return (
                  <button
                    key={opt.sec}
                    type="button"
                    onClick={() => setTimerDuration(opt.sec)}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-300 text-white shadow-lg shadow-amber-500/30 scale-105'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <span className="text-xs font-bold opacity-90">{opt.badge}</span>
                    <span className="text-base font-black font-mono">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. OYUN TÜRÜ SEÇ (Tek / Çok Oyunculu) */}
          <div className="space-y-3">
            <label className="block text-xs font-black uppercase tracking-wider text-emerald-400">
              3. Oyun Türü
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleGameTypeChange('single')}
                className={`p-4 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-center gap-3 ${
                  gameType === 'single'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <User className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-extrabold text-sm">Tek Oyunculu</div>
                  <div className="text-[11px] opacity-80">Bireysel Skor Pratiği</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleGameTypeChange('multi')}
                className={`p-4 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-center gap-3 ${
                  gameType === 'multi'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <Users className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-extrabold text-sm">Çok Oyunculu</div>
                  <div className="text-[11px] opacity-80">Sıra Tabanlı Düello</div>
                </div>
              </button>
            </div>
          </div>

          {/* 4. OYUNCU LİSTESİ & EKLEME */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black uppercase tracking-wider text-emerald-400">
                4. Oyuncular ({players.length})
              </label>
              {gameType === 'multi' && (
                <button
                  type="button"
                  onClick={handleAddPlayer}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Oyuncu Ekle
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {players.map((playerName, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 shadow-inner"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                    {index + 1}
                  </div>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                    placeholder={`Oyuncu ${index + 1} adı`}
                    disabled={gameType === 'single'}
                    className="flex-1 bg-transparent text-white font-bold text-sm focus:outline-none px-2"
                  />
                  {gameType === 'multi' && players.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePlayer(index)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-900 transition-all cursor-pointer"
                      title="Oyuncuyu Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {gameType === 'single' && (
              <p className="text-[11px] text-slate-500 italic">
                * Tek oyunculu modda sadece Oyuncu 1 yer alır. Daha fazla oyuncu için Çok Oyunculu modu seçin.
              </p>
            )}
          </div>
        </div>

        {/* START BUTTON */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleStart}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-600 hover:from-emerald-400 hover:to-sky-500 text-white font-black text-base shadow-2xl shadow-emerald-500/40 border border-emerald-400/50 flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-95"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>Oyunu Başlat & Kura Çekmeye Başla</span>
            <Dices className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
