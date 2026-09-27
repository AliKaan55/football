import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  RotateCcw,
  Sparkles,
  Link,
  ShieldAlert,
  Image as ImageIcon,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { Team, LeagueId } from '../types';
import { LEAGUES } from '../data/teams';
import { TeamBadge } from './TeamBadge';
import { soundEngine } from '../utils/audio';
import { generateBadgeDataUrl } from '../utils/svgLogoGenerator';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: Team[];
  onAddTeam: (team: Team) => void;
  onUpdateTeam: (team: Team) => void;
  onDeleteTeam: (teamId: string) => void;
  onResetDefaults: () => void;
  initialEditingTeam?: Team | null;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  teams,
  onAddTeam,
  onUpdateTeam,
  onDeleteTeam,
  onResetDefaults,
  initialEditingTeam,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeagueFilter, setSelectedLeagueFilter] = useState<LeagueId | 'all'>('all');
  
  // Form state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [leagueId, setLeagueId] = useState<LeagueId>('super-lig');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#10b981');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form helpers defined before useEffect
  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setName('');
    setShortName('');
    setLeagueId('super-lig');
    setLogoUrl('');
    setPrimaryColor('#10b981');
    setDeleteConfirmId(null);
  };

  const loadTeamToEdit = (t: Team) => {
    setIsEditing(true);
    setEditingId(t.id);
    setName(t.name);
    setShortName(t.shortName || t.name.slice(0, 3).toUpperCase());
    setLeagueId(t.leagueId);
    setLogoUrl(t.logoUrl);
    setPrimaryColor(t.primaryColor || '#10b981');
    setDeleteConfirmId(null);
  };

  // Load editing team if provided from outside or selected
  useEffect(() => {
    if (isOpen) {
      if (initialEditingTeam) {
        loadTeamToEdit(initialEditingTeam);
      } else {
        resetForm();
      }
    }
  }, [initialEditingTeam, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const leagueInfo = LEAGUES[leagueId];
    const generatedId = isEditing && editingId
      ? editingId
      : name.trim().toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();

    const finalShortName = (shortName.trim() || name.trim().slice(0, 3)).toUpperCase();
    const finalPrimaryColor = primaryColor || '#10b981';

    // Requirement: "kulüp eklemde logo url alanı boşsa alt taraftaki canlı önizleme çıkan tema rengini ve kısaltmayı yazdığımız logo logo olarak eklensin"
    const finalLogoUrl = logoUrl.trim()
      ? logoUrl.trim()
      : generateBadgeDataUrl(finalShortName, finalPrimaryColor, '#0f172a');

    const teamPayload: Team = {
      id: generatedId,
      name: name.trim(),
      shortName: finalShortName,
      leagueId,
      leagueName: leagueInfo ? leagueInfo.name : 'Futbol Ligi',
      logoUrl: finalLogoUrl,
      primaryColor: finalPrimaryColor,
      secondaryColor: '#0f172a',
    };

    if (isEditing && editingId) {
      onUpdateTeam(teamPayload);
    } else {
      onAddTeam(teamPayload);
    }

    soundEngine.playClickSound();
    resetForm();
  };

  const handleDelete = (id: string) => {
    onDeleteTeam(id);
    setDeleteConfirmId(null);
    if (editingId === id) {
      resetForm();
    }
    soundEngine.playClickSound();
  };

  const previewTeam: Team = {
    id: editingId || 'preview-temp',
    name: name.trim() || 'Örnek Kulüp',
    shortName: (shortName.trim() || name.trim().slice(0, 3) || 'KLP').toUpperCase(),
    leagueId,
    leagueName: LEAGUES[leagueId]?.name || 'Lig',
    logoUrl: logoUrl.trim(),
    primaryColor: primaryColor || '#10b981',
    secondaryColor: '#0f172a',
  };

  const filteredTeams = teams.filter((t) => {
    if (selectedLeagueFilter !== 'all' && t.leagueId !== selectedLeagueFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.leagueName.toLowerCase().includes(q) ||
        t.shortName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-5xl max-h-[92vh] rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-4 sm:p-6 text-slate-100 flex flex-col relative overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
              ⚙️
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Kulüp Yönetim Paneli (Admin)
              </h3>
              <p className="text-xs text-slate-400">
                Kulüp ekleme, silme, güncelleme ve logo bağlantılarını yönetin
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body (2 Columns on large screens: Form + List) */}
        <div className="flex-1 overflow-y-auto pt-4 grid grid-cols-1 lg:grid-cols-12 gap-6 pr-1">
          {/* LEFT COLUMN: Add / Update Team Form */}
          <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Edit2 className="w-4 h-4 text-amber-400" />
                      Kulübü Düzenle
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-emerald-400" />
                      Yeni Kulüp Ekle
                    </>
                  )}
                </h4>

                {isEditing && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Yeni Ekle Moduna Dön
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Team Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Kulüp Adı *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn: Liverpool veya Göztepe"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Grid: Short Name & League Dropdown */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Short Name / Code */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Kısa Ad / Kod
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={shortName}
                      onChange={(e) => setShortName(e.target.value.toUpperCase())}
                      placeholder="LIV, GS..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-white uppercase placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  {/* League selection via Dropdown as specifically required */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Lig Seçimi *
                    </label>
                    <select
                      value={leagueId}
                      onChange={(e) => setLeagueId(e.target.value as LeagueId)}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="super-lig">🇹🇷 Süper Lig</option>
                      <option value="premier-league">🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League</option>
                      <option value="la-liga">🇪🇸 La Liga</option>
                      <option value="serie-a">🇮🇹 Serie A</option>
                      <option value="bundesliga">🇩🇪 Bundesliga</option>
                      <option value="ligue-1">🇫🇷 Ligue 1 (Fransa)</option>
                    </select>
                  </div>
                </div>

                {/* Logo URL Input (Requirement: "logo kısmına url girilecek ve o url logo bölümüne net ve kaliteli şekilde sığdırılacak") */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Link className="w-3.5 h-3.5 text-emerald-400" />
                      Logo URL Bağlantısı (İsteğe Bağlı)
                    </span>
                    <span className="text-[10px] text-emerald-400/90 font-medium">Boşsa tema rozeti kullanılır</span>
                  </label>

                  {/* Logoları eklemeniz için site paneli / butonu */}
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <Globe className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <span className="block text-xs font-bold text-slate-200 truncate">
                          Logoları eklemeniz için site
                        </span>
                        <span className="block text-[10px] text-slate-400 font-mono truncate">
                          football-logos.cc (Yüksek Kaliteli Vektör & PNG)
                        </span>
                      </div>
                    </div>

                    <a
                      href="https://football-logos.cc"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20 transition-all shrink-0 select-none cursor-pointer"
                    >
                      <span>Siteyi Aç</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://.../logo.png (Boş bırakırsanız otomatik tema logosu oluşturulur)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                {/* Color and Live Preview Row */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                      Canlı Logo Önizleme
                    </span>
                    {/* Primary Color Picker */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">Tema Rengi:</span>
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-6 h-6 rounded-lg bg-transparent cursor-pointer border-0"
                        title="Kulüp Ana Rengini Seçin"
                      />
                    </div>
                  </div>

                  {/* Visual Live Preview of the logo fitting nicely */}
                  <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-950 border border-slate-800">
                    <TeamBadge team={previewTeam} size="lg" className="shrink-0" />
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm text-white truncate">
                        {previewTeam.name}
                      </div>
                      <div className="text-[11px] text-emerald-400">
                        {previewTeam.leagueName}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {logoUrl.trim()
                          ? 'Girdiğiniz görsel URL önizleniyor'
                          : 'URL boş: Önizlemedeki tema rengi ve kısaltma logo olarak kaydedilecek'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className={`w-full py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition active:scale-98 cursor-pointer flex items-center justify-center gap-2 ${
                    isEditing
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  }`}
                >
                  {isEditing ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      Değişiklikleri Kaydet
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 stroke-[3]" />
                      Kulübü Listeye Ekle
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Reset to defaults helper button */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500">Fabrika Ayarları:</span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Tüm kulüpleri orijinal 40 takımlı varsayılan listeye sıfırlamak istediğinize emin misiniz?')) {
                    onResetDefaults();
                    resetForm();
                  }
                }}
                className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer"
                title="Varsayılan 40 Kulübü Geri Yükle"
              >
                <RotateCcw className="w-3 h-3" />
                Varsayılanları Geri Yükle
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Existing Clubs List with Search & Actions */}
          <div className="lg:col-span-7 flex flex-col min-h-[350px]">
            {/* Filter bar */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Kayıtlı kulüpleri filtrele..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <select
                  value={selectedLeagueFilter}
                  onChange={(e) => setSelectedLeagueFilter(e.target.value as LeagueId | 'all')}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="all">Tüm Ligler ({teams.length})</option>
                  <option value="super-lig">🇹🇷 Süper Lig</option>
                  <option value="premier-league">🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League</option>
                  <option value="la-liga">🇪🇸 La Liga</option>
                  <option value="serie-a">🇮🇹 Serie A</option>
                  <option value="bundesliga">🇩🇪 Bundesliga</option>
                  <option value="ligue-1">🇫🇷 Ligue 1</option>
                </select>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>Listelenen: <strong>{filteredTeams.length}</strong> kulüp</span>
                <span>(Düzenlemek veya silmek için ilgili butona tıklayın)</span>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[480px]">
              {filteredTeams.map((team) => {
                const isSelectedForEdit = editingId === team.id;
                const isConfirmingDelete = deleteConfirmId === team.id;

                return (
                  <div
                    key={team.id}
                    className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all ${
                      isSelectedForEdit
                        ? 'bg-amber-950/20 border-amber-500/50'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700'
                    }`}
                  >
                    {/* Club Info: Logo and Name Side by Side */}
                    <div className="flex items-center gap-3 min-w-0">
                      <TeamBadge team={team} size="sm" className="shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                          <span>{team.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({team.shortName})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1">
                          <span>{LEAGUES[team.leagueId]?.flag || '⚽'}</span>
                          <span className="truncate">{team.leagueName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions: Edit & Delete */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-600/60 p-1 rounded-xl">
                          <span className="text-[10px] text-rose-300 font-semibold px-1">
                            Silinsin mi?
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDelete(team.id)}
                            className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                          >
                            Evet
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-1.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] cursor-pointer"
                          >
                            İptal
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => loadTeamToEdit(team)}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              isSelectedForEdit
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                            title="Düzenle"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(team.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredTeams.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Aramanıza uygun kulüp bulunamadı.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Tüm kulüp ekleme, silme ve güncellemeler otomatik olarak tarayıcıya (localStorage) kaydedilir.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
