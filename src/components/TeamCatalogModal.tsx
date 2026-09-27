import React, { useState } from 'react';
import { X, Search, Shield, Settings, Sliders } from 'lucide-react';
import { Team, LeagueId } from '../types';
import { LEAGUES } from '../data/teams';
import { TeamBadge } from './TeamBadge';

interface TeamCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  onOpenAdmin: (editingTeam?: Team) => void;
}

export const TeamCatalogModal: React.FC<TeamCatalogModalProps> = ({
  isOpen,
  onClose,
  teams,
  onOpenAdmin,
}) => {
  const [selectedLeague, setSelectedLeague] = useState<LeagueId | 'all'>('all');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredTeams = teams.filter((team) => {
    if (selectedLeague !== 'all' && team.leagueId !== selectedLeague) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        team.name.toLowerCase().includes(q) ||
        team.leagueName.toLowerCase().includes(q) ||
        team.shortName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[92vh] rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-4 sm:p-6 text-slate-100 flex flex-col relative overflow-hidden">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
              ⚽
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Kayıtlı Kulüpler ({teams.length} Takım)
              </h3>
              <p className="text-xs text-slate-400">
                Kura havuzundaki tüm futbol takımları ve logoları
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenAdmin();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 hover:border-emerald-500 transition active:scale-95"
              title="Admin Paneli - Kulüp Ekle / Düzenle / Sil"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kulüp Yönetimi (Admin)</span>
              <span className="sm:hidden">Admin</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="py-3.5 space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kulüp adı veya lig ara..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* League Badges filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setSelectedLeague('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedLeague === 'all'
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Tüm Ligler ({teams.length})
            </button>
            {Object.values(LEAGUES).map((league) => {
              const isSelected = selectedLeague === league.id;
              const count = teams.filter((t) => t.leagueId === league.id).length;
              return (
                <button
                  key={league.id}
                  onClick={() => setSelectedLeague(league.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{league.flag}</span>
                  <span>{league.name}</span>
                  <span className="opacity-70 text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Teams Grid - Without any +Task buttons and without any stadium names */}
        <div className="overflow-y-auto flex-1 pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTeams.map((team) => {
            return (
              <div
                key={team.id}
                className="group p-3 rounded-2xl bg-slate-950/70 border border-slate-800/90 hover:border-slate-700 flex items-center justify-between gap-3 transition-all hover:bg-slate-900"
              >
                {/* Logo and Name side-by-side */}
                <div className="flex items-center gap-3 min-w-0">
                  <TeamBadge team={team} size="md" className="shrink-0 group-hover:scale-105" />
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-sm text-white truncate leading-snug">
                      {team.name}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5 text-slate-400 text-[11px]">
                      <span>{LEAGUES[team.leagueId]?.flag || '⚽'}</span>
                      <span className="truncate">{team.leagueName}</span>
                    </div>
                  </div>
                </div>

                {/* Edit shortcut in Admin */}
                <button
                  onClick={() => {
                    onClose();
                    onOpenAdmin(team);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white text-xs transition"
                  title={`${team.name} kulübünü düzenle`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Toplam {filteredTeams.length} kulüp listeleniyor</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
