import React from 'react';
import { Trophy, Shield, Settings, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { soundEngine } from '../utils/audio';
import { DrawMode } from '../types';

export type NavTab = 'draw' | 'catalog';

interface HeaderProps {
  activeMode: DrawMode;
  onModeChange: (mode: DrawMode) => void;
  onOpenCatalog: () => void;
  onOpenAdmin: () => void;
  teamCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeMode,
  onModeChange,
  onOpenCatalog,
  onOpenAdmin,
  teamCount,
}) => {
  const [isMuted, setIsMuted] = React.useState(soundEngine.muted);

  const toggleSound = () => {
    const next = soundEngine.toggleMute();
    setIsMuted(next);
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-slate-950/85 border-b border-slate-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 select-none">
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-sky-500 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-xl">
                ⚽
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base sm:text-lg text-white tracking-tight leading-none">
                  Futbol Kura & Bölmeler
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block mt-0.5">
                2'li, 3'lü, 4'lü ve 5'li Takım Çekilişi
              </p>
            </div>
          </div>

          {/* Desktop Navigation Tabs: Kura Bölmeleri (with mode switcher), Kulüpler, Admin */}
          <nav className="hidden md:flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800/90 shadow-inner">
            {/* Kura Bölmeleri Mode Switcher Pill Group */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80">
              <span className="text-xs font-bold text-slate-300 px-2 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden lg:inline">Kura:</span>
              </span>
              {([2, 3, 4, 5] as DrawMode[]).map((mode) => {
                const isSelected = activeMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => onModeChange(mode)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-850'
                    }`}
                  >
                    {mode}'li
                  </button>
                );
              })}
            </div>

            {/* Kulüpler Sekmesi */}
            <button
              onClick={onOpenCatalog}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800/70 transition-all cursor-pointer"
              title="Kayıtlı kulüpleri görüntüle"
            >
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Kulüpler ({teamCount})</span>
            </button>

            {/* Admin Paneli */}
            <button
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold text-slate-300 hover:text-white hover:bg-slate-800/70 transition-all cursor-pointer"
              title="Kulüp Ekle, Sil, Güncelle"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              <span>Admin Paneli</span>
            </button>
          </nav>

          {/* Right Header Actions: Sound Toggle + PWA Install */}
          <div className="flex items-center gap-2.5">
            {/* Quick buttons on mobile */}
            <div className="flex md:hidden items-center gap-1.5">
              <button
                onClick={onOpenCatalog}
                className="p-2 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 hover:text-white flex items-center gap-1 text-xs font-semibold"
                title="Kulüpler"
              >
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="hidden xs:inline">Kulüpler</span>
              </button>

              <button
                onClick={onOpenAdmin}
                className="p-2 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 hover:text-white flex items-center gap-1 text-xs font-semibold"
                title="Admin Paneli"
              >
                <Settings className="w-4 h-4 text-amber-400" />
                <span className="hidden xs:inline">Admin</span>
              </button>
            </div>

            <button
              onClick={toggleSound}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isMuted
                  ? 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
              }`}
              title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* In-App PWA Install Button as required by PWA skill */}
            <PWAInstallButton />
          </div>
        </div>
      </div>
    </header>
  );
};
