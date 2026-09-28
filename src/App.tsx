/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Team, DrawMode } from './types';
import { DEFAULT_TEAMS } from './data/teams';
import { Header } from './components/Header';
import { MobileNav } from './components/MobileNav';
import { SquadDrawSlots } from './components/SquadDrawSlots';
import { TeamCatalogModal } from './components/TeamCatalogModal';
import { AdminPanelModal } from './components/AdminPanelModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { GameSetup } from './components/GameSetup';
import {
  AdminAuthError,
  clearAdminPassword,
  fetchServerTeams,
  getAdminPassword,
  loginAdmin,
  saveServerTeams,
} from './utils/adminApi';

const STORAGE_KEY_TEAMS = 'football_teams_list_v2';
const STORAGE_KEY_SLOTS_MAP = 'football_drawn_slots_map_v2';

export default function App() {
  // 1. Teams state - Loaded and saved to localStorage
  const [teams, setTeams] = useState<Team[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TEAMS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_TEAMS;
  });

  // Game Session State
  const [gameStarted, setGameStarted] = useState(false);
  const [gameConfig, setGameConfig] = useState<{
    mode: DrawMode;
    gameType: 'single' | 'multi';
    players: string[];
    startingPlayerIndex: number;
    timerDuration: number;
  }>({
    mode: 5,
    gameType: 'multi',
    players: ['Oyuncu 1', 'Oyuncu 2'],
    startingPlayerIndex: 0,
    timerDuration: 30,
  });

  // Drawn slots per mode: { 2: [null, null], 3: [null, null, null], 4: [...], 5: [...] }
  const [slotsMap, setSlotsMap] = useState<Record<DrawMode, (Team | null)[]>>(() => {
    const defaultMap: Record<DrawMode, (Team | null)[]> = {
      2: [null, null],
      3: [null, null, null],
      4: [null, null, null, null],
      5: [null, null, null, null, null],
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY_SLOTS_MAP);
      if (saved) {
        const parsedMap = JSON.parse(saved);
        const initialPool = (() => {
          try {
            const savedTeams = localStorage.getItem(STORAGE_KEY_TEAMS);
            if (savedTeams) return JSON.parse(savedTeams);
          } catch {
            // ignore
          }
          return DEFAULT_TEAMS;
        })();

        ([2, 3, 4, 5] as DrawMode[]).forEach((mode) => {
          if (Array.isArray(parsedMap[mode]) && parsedMap[mode].length === mode) {
            defaultMap[mode] = parsedMap[mode].map((id: string | null) =>
              id ? initialPool.find((t: Team) => t.id === id) || null : null
            );
          }
        });
      }
    } catch {
      // ignore
    }

    return defaultMap;
  });

  // Modals state
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminEditingTeam, setAdminEditingTeam] = useState<Team | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => !!getAdminPassword());

  // Sunucudaki (veritabanındaki) takım listesi tek doğru kaynaktır; yerel kayıt sadece önbellek.
  useEffect(() => {
    let cancelled = false;
    fetchServerTeams().then((serverTeams) => {
      if (cancelled || !serverTeams) return;
      setTeams(serverTeams);
      setSlotsMap((prev) => {
        const next = { ...prev };
        ([2, 3, 4, 5] as DrawMode[]).forEach((mode) => {
          next[mode] = next[mode].map((t) => (t ? serverTeams.find((s) => s.id === t.id) || null : null));
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync teams to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TEAMS, JSON.stringify(teams));
    } catch {
      // ignore
    }
  }, [teams]);

  // Sync drawn slots map to localStorage
  useEffect(() => {
    try {
      const serializedMap: Record<DrawMode, (string | null)[]> = {
        2: slotsMap[2].map((t) => t?.id || null),
        3: slotsMap[3].map((t) => t?.id || null),
        4: slotsMap[4].map((t) => t?.id || null),
        5: slotsMap[5].map((t) => t?.id || null),
      };
      localStorage.setItem(STORAGE_KEY_SLOTS_MAP, JSON.stringify(serializedMap));
    } catch {
      // ignore
    }
  }, [slotsMap]);

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg);
    setToastIsError(isError);
    setTimeout(() => {
      setToastMessage(null);
    }, isError ? 5000 : 3200);
  };

  // Takım listesini veritabanına kaydeder (yalnızca admin).
  const persistTeams = async (next: Team[]) => {
    try {
      await saveServerTeams(next);
    } catch (err: any) {
      if (err instanceof AdminAuthError) {
        clearAdminPassword();
        setIsAdmin(false);
      }
      showToast(`⚠ Sunucuya kaydedilemedi: ${err?.message || 'bilinmeyen hata'}`, true);
    }
  };

  const handleAdminLogin = async (password: string): Promise<string | null> => {
    const err = await loginAdmin(password);
    if (!err) setIsAdmin(true);
    return err;
  };

  const handleAdminLogout = () => {
    clearAdminPassword();
    setIsAdmin(false);
  };

  // Handle slot teams drawn from "Karıştır"
  const handleTeamsDrawn = (newTeams: (Team | null)[]) => {
    setSlotsMap((prev) => ({
      ...prev,
      [gameConfig.mode]: newTeams,
    }));
    showToast(`⚽ ${gameConfig.mode} Takım Bölmelere Yerleşti!`);
  };

  // Admin: Add Team
  const handleAddTeam = (newTeam: Team) => {
    const next = [newTeam, ...teams];
    setTeams(next);
    persistTeams(next);
    showToast(`✓ "${newTeam.name}" kulübü başarıyla eklendi!`);
  };

  // Admin: Update Team
  const handleUpdateTeam = (updatedTeam: Team) => {
    const nextTeams = teams.map((t) => (t.id === updatedTeam.id ? updatedTeam : t));
    setTeams(nextTeams);
    persistTeams(nextTeams);
    setSlotsMap((prev) => {
      const nextMap = { ...prev };
      ([2, 3, 4, 5] as DrawMode[]).forEach((mode) => {
        nextMap[mode] = nextMap[mode].map((t) => (t?.id === updatedTeam.id ? updatedTeam : t));
      });
      return nextMap;
    });
    showToast(`✓ "${updatedTeam.name}" kulübü güncellendi!`);
  };

  // Admin: Delete Team
  const handleDeleteTeam = (teamId: string) => {
    const target = teams.find((t) => t.id === teamId);
    const nextTeams = teams.filter((t) => t.id !== teamId);
    setTeams(nextTeams);
    persistTeams(nextTeams);
    setSlotsMap((prev) => {
      const nextMap = { ...prev };
      ([2, 3, 4, 5] as DrawMode[]).forEach((mode) => {
        nextMap[mode] = nextMap[mode].map((t) => (t?.id === teamId ? null : t));
      });
      return nextMap;
    });
    showToast(`"${target ? target.name : 'Kulüp'}" silindi`);
  };

  // Admin: Reset to default 40 teams
  const handleResetDefaults = () => {
    setTeams(DEFAULT_TEAMS);
    persistTeams(DEFAULT_TEAMS);
    showToast('Varsayılan 40 kulüp listesi geri yüklendi');
  };

  const handleOpenAdminWithTeam = (team?: Team) => {
    setAdminEditingTeam(team || null);
    setIsAdminModalOpen(true);
  };

  const currentDrawnTeams = slotsMap[gameConfig.mode] || new Array(gameConfig.mode).fill(null);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased pb-20 md:pb-10">
      {/* Header */}
      <Header
        activeMode={gameConfig.mode}
        onModeChange={(m) => {
          if (!gameStarted) {
            setGameConfig((prev) => ({ ...prev, mode: m }));
          }
        }}
        onOpenCatalog={() => setIsCatalogModalOpen(true)}
        onOpenAdmin={() => handleOpenAdminWithTeam()}
        teamCount={teams.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-8 space-y-4 sm:space-y-8">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none">
            <div className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl backdrop-blur-md text-white font-bold text-xs sm:text-sm shadow-2xl border ${toastIsError ? 'bg-rose-600/95 shadow-rose-500/40 border-rose-400' : 'bg-emerald-500/95 shadow-emerald-500/40 border-emerald-400'}`}>
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {!gameStarted ? (
          <GameSetup
            onStartGame={(config) => {
              setGameConfig(config);
              setGameStarted(true);
              showToast(`🎮 Oyun Başladı! İlk Sıra: ${config.players[config.startingPlayerIndex]}`);
            }}
          />
        ) : (
          <SquadDrawSlots
            teams={teams}
            activeMode={gameConfig.mode}
            drawnTeams={currentDrawnTeams}
            onTeamsDrawn={handleTeamsDrawn}
            players={gameConfig.players}
            gameType={gameConfig.gameType}
            initialActivePlayer={gameConfig.startingPlayerIndex}
            timerDuration={gameConfig.timerDuration}
            onReturnToMenu={() => setGameStarted(false)}
          />
        )}
      </main>

      {/* Team Catalog Modal */}
      <TeamCatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        teams={teams}
        onOpenAdmin={handleOpenAdminWithTeam}
      />

      {/* Admin Panel Modal */}
      <AdminPanelModal
        isOpen={isAdminModalOpen}
        onClose={() => {
          setIsAdminModalOpen(false);
          setAdminEditingTeam(null);
        }}
        teams={teams}
        onAddTeam={handleAddTeam}
        onUpdateTeam={handleUpdateTeam}
        onDeleteTeam={handleDeleteTeam}
        onResetDefaults={handleResetDefaults}
        initialEditingTeam={adminEditingTeam}
        isAdmin={isAdmin}
        onLogin={handleAdminLogin}
        onLogout={handleAdminLogout}
      />

      {/* Mobile Nav */}
      <MobileNav
        activeMode={gameConfig.mode}
        onModeChange={(m) => {
          if (!gameStarted) {
            setGameConfig((prev) => ({ ...prev, mode: m }));
          }
        }}
        onOpenCatalog={() => setIsCatalogModalOpen(true)}
        onOpenAdmin={() => handleOpenAdminWithTeam()}
        teamCount={teams.length}
      />

      {/* Offline Indicator */}
      <OfflineIndicator />
    </div>
  );
}