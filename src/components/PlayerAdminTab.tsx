import React, { useEffect, useRef, useState } from 'react';
import { Search, Plus, Trash2, RotateCcw, X, Check, Edit2 } from 'lucide-react';
import { Team } from '../types';
import {
  AdminAuthError,
  AdminPlayer,
  deletePlayerApi,
  savePlayerApi,
  searchPlayersApi,
} from '../utils/adminApi';

interface Props {
  teams: Team[];
  onAuthError: () => void;
}

const SOURCE_LABEL: Record<AdminPlayer['source'], { text: string; cls: string }> = {
  base: { text: 'Taban veri', cls: 'bg-slate-800 text-slate-400' },
  edited: { text: 'Düzenlendi', cls: 'bg-amber-500/20 text-amber-300' },
  custom: { text: 'Sizin eklediğiniz', cls: 'bg-emerald-500/20 text-emerald-300' },
};

export const PlayerAdminTab: React.FC<Props> = ({ teams, onAuthError }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  // Editor state: null = kapalı, 'new' = yeni oyuncu, AdminPlayer = düzenleme
  const [editing, setEditing] = useState<AdminPlayer | 'new' | null>(null);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [clubs, setClubs] = useState<string[]>([]);
  const [clubInput, setClubInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const searchSeq = useRef(0);

  const fail = (err: any) => {
    if (err instanceof AdminAuthError) {
      onAuthError();
      return;
    }
    setNotice({ text: err?.message || 'Bir hata oluştu.', error: true });
  };

  const runSearch = async (q: string) => {
    const seq = ++searchSeq.current;
    setLoading(true);
    try {
      const players = await searchPlayersApi(q);
      if (seq === searchSeq.current) setResults(players);
    } catch (err) {
      if (seq === searchSeq.current) fail(err);
    } finally {
      if (seq === searchSeq.current) setLoading(false);
    }
  };

  // Yazdıkça (350 ms gecikmeyle) ara; boşken son eklenen/düzenlenenleri göster.
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  const openEditor = (p: AdminPlayer | 'new') => {
    setEditing(p);
    setConfirmDelete(false);
    setNotice(null);
    setClubInput('');
    if (p === 'new') {
      setName(query.trim());
      setValue('');
      setClubs([]);
    } else {
      setName(p.n);
      setValue(p.v ? String(p.v) : '');
      setClubs([...p.c]);
    }
  };

  const addClub = (raw: string) => {
    const club = raw.trim();
    if (!club) return;
    if (!clubs.some((c) => c.toLowerCase() === club.toLowerCase())) setClubs((prev) => [...prev, club]);
    setClubInput('');
  };

  const handleSave = async () => {
    if (!editing) return;
    const pendingClub = clubInput.trim();
    const finalClubs =
      pendingClub && !clubs.some((c) => c.toLowerCase() === pendingClub.toLowerCase()) ? [...clubs, pendingClub] : clubs;
    setSaving(true);
    setNotice(null);
    try {
      const saved = await savePlayerApi({
        i: editing === 'new' ? undefined : editing.i,
        n: name.trim(),
        v: Number(value) || 0,
        c: finalClubs,
      });
      setNotice({ text: `✓ "${saved.n}" kaydedildi. Değişiklik anında geçerli.`, error: false });
      setEditing(null);
      setQuery(saved.n);
      await runSearch(saved.n);
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (reset: boolean) => {
    if (!editing || editing === 'new') return;
    setSaving(true);
    try {
      await deletePlayerApi(editing.i, reset);
      setNotice({ text: reset ? '✓ Düzenleme geri alındı, taban veri geçerli.' : '✓ Oyuncu silindi.', error: false });
      setEditing(null);
      await runSearch(query);
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const teamNames = Array.from(new Set(teams.map((t) => t.name)));
  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500';

  return (
    <div className="flex-1 overflow-y-auto pt-4 grid grid-cols-1 lg:grid-cols-12 gap-6 pr-1">
      {/* Sol: arama + sonuç listesi */}
      <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col min-h-[320px]">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-extrabold text-sm sm:text-base text-white">Oyuncu Ara</h4>
          <button
            type="button"
            onClick={() => openEditor('new')}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Yeni Oyuncu
          </button>
        </div>
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Örn: Messi, Arda Güler..."
            className={inputCls + ' pl-9'}
          />
        </div>
        {notice && (
          <div
            className={`mb-3 px-3 py-2 rounded-xl text-xs font-semibold border ${
              notice.error
                ? 'bg-rose-950/60 border-rose-700/60 text-rose-300'
                : 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
            }`}
          >
            {notice.text}
          </div>
        )}
        <div className="text-[11px] text-slate-500 mb-2">
          {query.trim() ? `${results.length} sonuç` : 'Son eklenen / düzenlenen oyuncular'}
          {loading && ' · aranıyor...'}
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[46vh] pr-1">
          {results.map((p) => (
            <button
              key={p.i}
              type="button"
              onClick={() => openEditor(p)}
              className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer ${
                editing !== 'new' && editing?.i === p.i
                  ? 'bg-amber-500/10 border-amber-500/50'
                  : 'bg-slate-900/70 border-slate-800 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-white truncate">{p.n}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold shrink-0 ${SOURCE_LABEL[p.source].cls}`}>
                  {SOURCE_LABEL[p.source].text}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {p.c.slice(0, 4).join(' · ')}
                {p.c.length > 4 ? ` +${p.c.length - 4}` : ''}
              </div>
            </button>
          ))}
          {!loading && results.length === 0 && (
            <div className="py-10 text-center text-slate-500 text-xs">
              {query.trim() ? 'Oyuncu bulunamadı. "Yeni Oyuncu" ile ekleyebilirsiniz.' : 'Henüz eklenen/düzenlenen oyuncu yok. Arama yapın.'}
            </div>
          )}
        </div>
      </div>

      {/* Sağ: düzenleyici */}
      <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 sm:p-5">
        {!editing ? (
          <div className="h-full min-h-[200px] flex items-center justify-center text-center text-slate-500 text-sm px-6">
            Soldan bir oyuncu seçin ya da "Yeni Oyuncu" ile ekleyin. Kulüp ekleyip çıkardığınız değişiklikler anında tahmin
            doğrulamasına yansır, yeniden yayın gerekmez.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                {editing === 'new' ? (
                  <>
                    <Plus className="w-4 h-4 text-emerald-400" /> Yeni Oyuncu
                  </>
                ) : (
                  <>
                    <Edit2 className="w-4 h-4 text-amber-400" /> Oyuncuyu Düzenle
                  </>
                )}
              </h4>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Oyuncu Adı *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Örn: Arda Güler" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">Değer (€)</label>
                <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} placeholder="60000000" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Oynadığı Kulüpler * ({clubs.length})
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  list="fk-team-names"
                  value={clubInput}
                  onChange={(e) => setClubInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addClub(clubInput);
                    }
                  }}
                  className={inputCls}
                  placeholder="Kulüp adı yazın veya listeden seçin"
                />
                <datalist id="fk-team-names">
                  {teamNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={() => addClub(clubInput)}
                  className="px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer shrink-0"
                >
                  Ekle
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                İpucu: Kulüp adı, oyundaki takım adıyla aynı olmalı (örn. "Galatasaray", "Real Madrid"). FC, AC, SK gibi ekler sayılmaz.
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3 max-h-40 overflow-y-auto">
                {clubs.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-slate-800 text-xs text-slate-200">
                    {c}
                    <button
                      type="button"
                      onClick={() => setClubs((prev) => prev.filter((x) => x !== c))}
                      className="p-0.5 rounded hover:bg-rose-500/30 text-slate-400 hover:text-rose-300 cursor-pointer"
                      title="Kaldır"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {clubs.length === 0 && <span className="text-xs text-slate-500">Henüz kulüp yok.</span>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                disabled={saving || !name.trim() || (clubs.length === 0 && !clubInput.trim())}
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-sm font-bold cursor-pointer"
              >
                <Check className="w-4 h-4" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>

              {editing !== 'new' && editing.source === 'edited' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleDelete(true)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                  title="Yaptığınız düzenlemeyi geri alıp taban veriye döner"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Düzenlemeyi Geri Al
                </button>
              )}

              {editing !== 'new' &&
                (confirmDelete ? (
                  <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-600/60 p-1 rounded-xl">
                    <span className="text-[11px] text-rose-300 font-semibold px-1.5">Oyuncu silinsin mi?</span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleDelete(false)}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                    >
                      Evet, sil
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] cursor-pointer"
                    >
                      Vazgeç
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-semibold cursor-pointer ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Sil
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
