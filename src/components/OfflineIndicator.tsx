import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600/95 backdrop-blur-md px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-2xl border border-amber-400/40 animate-bounce">
      <WifiOff className="w-4 h-4 shrink-0 text-white" />
      <span>Çevrimdışı Mod — Verileriniz yerel hafızada korunuyor.</span>
    </div>
  );
};
