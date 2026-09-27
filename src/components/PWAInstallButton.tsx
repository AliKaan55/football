import React, { useState } from 'react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-500 active:scale-95 transition-all ${
          compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
        }`}
        title="Uygulamayı Ana Ekrana Yükle"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Uygulamayı İndir</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/40 font-medium active:scale-95 transition-all ${
            compact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'
          }`}
          title="iOS Ana Ekrana Ekle"
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>iOS'a Ekle</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700/80 p-5 sm:p-6 shadow-2xl text-slate-100 relative my-auto animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-3.5 right-3.5 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/80 hover:bg-slate-850 active:scale-95 transition-all cursor-pointer z-10"
                aria-label="Kapat"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4 pr-8">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-emerald-500/30 shrink-0">
                  ⚽
                </div>
                <div>
                  <h3 className="text-base font-black text-white leading-tight">iPhone / iPad'e Yükle</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Safari üzerinden ana ekranınıza ekleyin</p>
                </div>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-slate-300 bg-slate-950/70 p-3.5 sm:p-4 rounded-xl border border-slate-800/90 mb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                    <Share className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white">1. Adım:</span> Safari ekranının altındaki <strong>Paylaş</strong> simgesine dokunun.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white">2. Adım:</span> Aşağı kaydırıp <strong>"Ana Ekrana Ekle"</strong> butonuna basın.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 py-3 text-sm font-extrabold text-white shadow-lg shadow-emerald-500/30 transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Anladım, Kapat</span>
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
