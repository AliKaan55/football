export type LeagueId = 'premier-league' | 'la-liga' | 'serie-a' | 'bundesliga' | 'ligue-1' | 'super-lig';
export type DrawMode = 2 | 3 | 4 | 5;

export interface League {
  id: LeagueId;
  name: string;
  country: string;
  flag: string;
  color: string;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  leagueId: LeagueId;
  leagueName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor?: string;
  founded?: number;
}

export type Priority = 'low' | 'medium' | 'high';
export type TaskCategory = 'gunluk' | 'is' | 'spor' | 'egitim' | 'kisisel';

export interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: Priority;
  category: TaskCategory;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
  assignedTeamId?: string; // Optional assignment to a football team
  slotIndex?: number;      // 0-4 if pinned to one of the 5 active slots
}

export interface SlotTeam {
  slotIndex: number;
  team: Team | null;
  assignedTaskId?: string;
}
