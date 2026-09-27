import React, { useState, useEffect } from 'react';
import { Team } from '../types';
import { Shield } from 'lucide-react';

interface TeamBadgeProps {
  team: Team;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallbackText?: boolean;
}

const sizeClasses = {
  xs: 'w-7 h-7 sm:w-8 sm:h-8 text-[11px]',
  sm: 'w-10 h-10 sm:w-11 sm:h-11 text-xs',
  md: 'w-12 h-12 sm:w-14 sm:h-14 text-sm',
  lg: 'w-16 h-16 sm:w-20 sm:h-20 text-base',
  xl: 'w-20 h-20 sm:w-24 sm:h-24 text-xl',
};

const imgBoxClasses = {
  xs: 'w-6 h-6 sm:w-7 sm:h-7',
  sm: 'w-8 h-8 sm:w-9 sm:h-9',
  md: 'w-10 h-10 sm:w-12 sm:h-12',
  lg: 'w-14 h-14 sm:w-16 sm:h-16',
  xl: 'w-16 h-16 sm:w-20 sm:h-20',
};

export const TeamBadge: React.FC<TeamBadgeProps> = ({
  team,
  size = 'md',
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  // Reset error whenever team logoUrl changes
  useEffect(() => {
    setHasError(false);
  }, [team.logoUrl, team.id]);

  // Fallback shield if external image fails
  if (hasError || !team.logoUrl) {
    return (
      <div
        className={`relative flex items-center justify-center rounded-2xl font-black shadow-inner border border-white/20 select-none shrink-0 ${sizeClasses[size]} ${className}`}
        style={{
          background: `linear-gradient(135deg, ${team.primaryColor || '#10b981'} 0%, ${team.secondaryColor || '#0f172a'} 100%)`,
          color: '#ffffff',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        }}
        title={team.name}
      >
        <span className="font-extrabold tracking-tighter uppercase">
          {team.shortName ? team.shortName.slice(0, 3) : team.name.slice(0, 3)}
        </span>
        <div className="absolute -bottom-1 -right-1 opacity-70">
          <Shield className="w-3 h-3 text-white/50" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center rounded-2xl bg-slate-900/95 border border-slate-800 shadow-md p-1 shrink-0 overflow-hidden group ${sizeClasses[size]} ${className}`}
      style={{
        boxShadow: `0 0 14px -3px ${team.primaryColor || '#10b981'}33`,
      }}
      title={`${team.name} (${team.leagueName})`}
    >
      {/* Subtle colored glow behind badge */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none rounded-2xl"
        style={{
          backgroundColor: team.primaryColor || '#10b981',
        }}
      />

      <div className={`relative flex items-center justify-center ${imgBoxClasses[size]}`}>
        <img
          src={team.logoUrl}
          alt={`${team.name} logosu`}
          loading="lazy"
          onError={() => setHasError(true)}
          className="max-w-full max-h-full object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-md select-none"
        />
      </div>
    </div>
  );
};
