import React from 'react';
import { Trophy, Shield, Settings, Shuffle } from 'lucide-react';
import { DrawMode } from '../types';

interface MobileNavProps {
  activeMode: DrawMode;
  onModeChange: (mode: DrawMode) => void;
  onOpenCatalog: () => void;
  onOpenAdmin: () => void;
  teamCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeMode,
  onModeChange,
  onOpenCatalog,
  onOpenAdmin,
  teamCount,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800/90 px-3 py-2 pb-safe">
      <div className="flex items-center justify-between gap-1 max-w-md mx-auto">
        {/* Draw Mode Pills for mobile */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {([2, 3, 4, 5] as DrawMode[]).map((mode) => {
            const isSelected = activeMode === mode;
            return (
              <button
                key={mode}
                onClick={() => onModeChange(mode)}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode}'li
              </button>
            );
          })}
        </div>

        {/* Clubs */}
        <button
          onClick={onOpenCatalog}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
        >
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Kulüpler</span>
        </button>

        {/* Admin */}
        <button
          onClick={onOpenAdmin}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
        >
          <Settings className="w-3.5 h-3.5 text-amber-400" />
          <span>Admin</span>
        </button>
      </div>
    </nav>
  );
};
