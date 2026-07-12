'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, Building2, MapPin, SlidersHorizontal, Layers, X, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, RefreshCw, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES, ROOM_STATUS, PROPERTY_TYPES, PROPERTY_TYPE_LABELS, MANAGEMENT_TYPES, MANAGEMENT_TYPE_LABELS } from '../../constants/index';
import { supabase } from '../../utils/supabase';

interface Property {
  bukken_id: number;
  bukken_name: string;
  bukken_type: number | null;
  address: string | null;
  kanri_kbn: number | null;
  total_rooms?: number;
  vacant_rooms?: number;
}

type SortKey = 'bukken_name' | 'bukken_type' | 'kanri_kbn' | 'vacant_rooms' | 'address';
type SortOrder = 'asc' | 'desc';

export default function BukkenIchiran() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // 検索・絞り込み用状態（定数の数値に合わせるため初期値は文字列 'all'）
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedManagement, setSelectedManagement] = useState<string>('all');

  // ソート用状態
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // 仮のログイン組織ID
  const currentSoshikiId = 1;

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      // 自分の組織のデータのみを並列取得
      const [bukkenRes, heyaRes] = await Promise.all([
        supabase
          .from('m200_basebukken')
          .select('*')
          .eq('soshiki_id', currentSoshikiId)
          .order('bukken_id', { ascending: true }),
        supabase
          .from('m300_heya')
          .select('bukken_id, heya_status')
          .eq('soshiki_id', currentSoshikiId),
      ]);

      if (bukkenRes.error) throw bukkenRes.error;
      if (heyaRes.error) throw heyaRes.error;

      // 物件ごとの戸数・空室数を1パスで集計
      const countMap = new Map<number, { total: number; vacant: number }>();
      (heyaRes.data || []).forEach(r => {
        const entry = countMap.get(r.bukken_id) || { total: 0, vacant: 0 };
        entry.total += 1;
        if (r.heya_status === ROOM_STATUS.AKISHITSU) entry.vacant += 1;
        countMap.set(r.bukken_id, entry);
      });

      const updatedProperties: Property[] = (bukkenRes.data || []).map(prop => ({
        ...prop,
        total_rooms: countMap.get(prop.bukken_id)?.total ?? 0,
        vacant_rooms: countMap.get(prop.bukken_id)?.vacant ?? 0,
      }));

      setProperties(updatedProperties);
    } catch (err) {
      console.error('データ取得エラー:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // 検索・絞り込み・ソート
  const filteredProperties = useMemo(() => {
    let result = [...properties];

    if (searchKeyword.trim() !== '') {
      const kw = searchKeyword.toLowerCase();
      result = result.filter(p =>
        p.bukken_name.toLowerCase().includes(kw) ||
        (p.address && p.address.toLowerCase().includes(kw))
      );
    }

    if (selectedType !== 'all') {
      const typeNum = Number(selectedType);
      result = result.filter(p => p.bukken_type === typeNum);
    }

    if (selectedManagement !== 'all') {
      const mgmtNum = Number(selectedManagement);
      result = result.filter(p => p.kanri_kbn === mgmtNum);
    }

    if (sortKey) {
      result.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        // 各カラムのフォールバック値の調整
        if (sortKey === 'bukken_name' || sortKey === 'address') {
          valA = valA ?? '';
          valB = valB ?? '';
        } else {
          valA = valA ?? 0;
          valB = valB ?? 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [searchKeyword, selectedType, selectedManagement, properties, sortKey, sortOrder]);

  const handleClearFilters = () => {
    setSearchKeyword('');
    setSelectedType('all');
    setSelectedManagement('all');
    setSortKey(null);
    setSortOrder('asc');
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 ml-1 shrink-0 group-hover/th:text-slate-600 transition" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-emerald-600 ml-1 shrink-0" />
      : <ArrowDown className="h-3.5 w-3.5 text-emerald-600 ml-1 shrink-0" />;
  };

  const isFiltered = searchKeyword !== '' || selectedType !== 'all' || selectedManagement !== 'all' || sortKey !== null;

  const editPath = (id: number) => `${ROUTES.BUKKEN_TOUROKU.path}?id=${id}`;

  return (
    <main className="p-3 sm:p-6 max-w-7xl mx-auto flex flex-col space-y-3 sm:space-y-4 md:h-[calc(100dvh-3.5rem)] md:overflow-hidden">
      {/* 🏷️ ページタイトル ＆ 新規登録ボタン */}
      <div className="flex flex-wrap justify-between items-center gap-2 bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200 shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <Link href={ROUTES.MAIN_MENU.path} className="btn-back">
            <ArrowLeft className="h-4 w-4" />
            <span>戻る</span>
          </Link>
          <h2 className="text-base sm:text-lg font-extrabold border-l-4 border-emerald-600 pl-2 sm:pl-3 text-slate-950 flex items-center space-x-1.5 min-w-0">
            <Building2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="truncate">{ROUTES.BUKKEN_ICHIRAN.title}</span>
          </h2>
        </div>
        <Link
          href={ROUTES.BUKKEN_TOUROKU.path}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition shadow-sm cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>新規物件登録</span>
        </Link>
      </div>

      {/* 🔍 検索・絞り込みパネル */}
      <div className="bg-white p-3 sm:p-5 rounded-xl shadow-sm border border-slate-200 space-y-3 sm:space-y-4 shrink-0">
        <div className="flex justify-between items-center select-none">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
            <span>検索・絞り込み条件</span>
          </h3>
          {isFiltered && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded flex items-center space-x-1 transition cursor-pointer shadow-sm"
            >
              <X className="h-3.5 w-3.5" />
              <span>クリア</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-xs font-bold text-slate-900 mb-1">物件名・所在地</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="例: メゾンあすなろ、宮崎市..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-9 pr-4 py-2 md:py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-950 font-medium placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1">物件種別</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 md:py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-950 font-bold focus:outline-none focus:border-emerald-500 transition"
            >
              <option value="all">すべて</option>
              <option value={PROPERTY_TYPES.MANSION}>マンション</option>
              <option value={PROPERTY_TYPES.APARTMENT}>アパート</option>
              <option value={PROPERTY_TYPES.HOUSE}>戸建て</option>
              <option value={PROPERTY_TYPES.TENPO}>店舗</option>
              <option value={PROPERTY_TYPES.LAND}>土地</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1">管理区分</label>
            <select
              value={selectedManagement}
              onChange={(e) => setSelectedManagement(e.target.value)}
              className="w-full px-3 py-2 md:py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-950 font-bold focus:outline-none focus:border-emerald-500 transition"
            >
              <option value="all">すべて</option>
              <option value={MANAGEMENT_TYPES.JISHA}>自社</option>
              <option value={MANAGEMENT_TYPES.KANRI}>管理</option>
            </select>
          </div>
        </div>
      </div>

      {/* 📱 スマホ用: カード型リスト */}
      <div className="md:hidden space-y-2 overflow-y-auto flex-1 min-h-0">
        <p className="text-xs font-bold text-slate-500 px-1">
          {loading ? '読み込み中...' : `該当: ${filteredProperties.length}件 / 総数: ${properties.length}件`}
        </p>

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`sk-${i}`} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 animate-pulse space-y-2">
              <div className="h-5 bg-slate-200 rounded w-2/3" />
              <div className="h-3.5 bg-slate-200 rounded w-1/3" />
              <div className="h-3.5 bg-slate-200 rounded w-1/2" />
            </div>
          ))
        ) : loadError ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
            <p className="text-red-600 font-bold text-sm mb-3">データの取得に失敗しました。</p>
            <button onClick={fetchProperties} className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>再読み込み</span>
            </button>
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-500 font-bold text-sm">
            該当する物件が見つかりません。
          </div>
        ) : (
          filteredProperties.map((prop) => (
            <div
              key={prop.bukken_id}
              onClick={() => router.push(`${ROUTES.HEYA_ICHIRAN.path}?id=${prop.bukken_id}`)}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 active:bg-emerald-50 transition cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-extrabold text-emerald-700 text-base leading-snug">{prop.bukken_name}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded">
                      {prop.bukken_type !== null ? PROPERTY_TYPE_LABELS[prop.bukken_type] : '未設定'}
                    </span>
                    <span className="text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded">
                      {prop.kanri_kbn !== null ? MANAGEMENT_TYPE_LABELS[prop.kanri_kbn] : '未設定'}
                    </span>
                  </div>
                  {prop.address && (
                    <div className="mt-1.5 text-xs text-slate-500 font-medium flex items-center space-x-1 min-w-0">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{prop.address}</span>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0 flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-400">空室 / 総戸数</span>
                  <span className="leading-none mt-0.5">
                    <span className="text-emerald-600 font-extrabold text-2xl">{prop.vacant_rooms ?? 0}</span>
                    <span className="text-slate-400 text-sm font-bold"> / {prop.total_rooms ?? 0}</span>
                  </span>
                  <Link
                    href={editPath(prop.bukken_id)}
                    onClick={(e) => e.stopPropagation()}
                    className="btn-row-edit mt-2"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>修正</span>
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 💻 PC用: データテーブル */}
      <div className="hidden md:flex bg-white rounded-xl shadow-sm border border-slate-200 flex-col flex-1 overflow-hidden">
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center select-none shrink-0">
          <h3 className="text-sm font-extrabold text-slate-950 flex items-center space-x-1.5">
            <Layers className="h-4 w-4 text-emerald-600" />
            <span>
              登録物件一覧
              {loading ? '（読み込み中...）' : `（該当: ${filteredProperties.length}件 / 総数: ${properties.length}件）`}
            </span>
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
          <table className="w-full text-left border-collapse text-sm min-w-[980px]">
            <thead className="sticky top-0 z-20 shadow-[0_2px_2px_-1px_rgba(0,0,0,0.05)]">
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-950 font-bold select-none">
                <th onClick={() => handleSort('bukken_name')} className="px-4 py-3 w-72 cursor-pointer hover:bg-slate-200 transition group/th">
                  <div className="flex items-center justify-between">
                    <span>物件名 (クリックで部屋一覧へ)</span>
                    {renderSortIcon('bukken_name')}
                  </div>
                </th>
                <th onClick={() => handleSort('bukken_type')} className="px-4 py-3 w-32 cursor-pointer hover:bg-slate-200 transition group/th">
                  <div className="flex items-center justify-between">
                    <span>物件種別</span>
                    {renderSortIcon('bukken_type')}
                  </div>
                </th>
                <th onClick={() => handleSort('kanri_kbn')} className="px-4 py-3 w-32 cursor-pointer hover:bg-slate-200 transition group/th">
                  <div className="flex items-center justify-between">
                    <span>管理区分</span>
                    {renderSortIcon('kanri_kbn')}
                  </div>
                </th>
                <th onClick={() => handleSort('vacant_rooms')} className="px-4 py-3 w-36 cursor-pointer hover:bg-slate-200 transition group/th">
                  <div className="flex items-center justify-center">
                    <span>空室 / 総戸数</span>
                    {renderSortIcon('vacant_rooms')}
                  </div>
                </th>
                <th onClick={() => handleSort('address')} className="px-4 py-3 cursor-pointer hover:bg-slate-200 transition group/th">
                  <div className="flex items-center justify-between">
                    <span>所在地</span>
                    {renderSortIcon('address')}
                  </div>
                </th>
                <th className="px-4 py-3 w-24 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-3/4" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-14" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-16 mx-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-2/3" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-12 mx-auto" /></td>
                  </tr>
                ))
              ) : loadError ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center bg-slate-50/50">
                    <p className="text-red-600 font-bold mb-3">データの取得に失敗しました。</p>
                    <button onClick={fetchProperties} className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-xs font-bold transition cursor-pointer">
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>再読み込み</span>
                    </button>
                  </td>
                </tr>
              ) : filteredProperties.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-bold bg-slate-50/50">
                    該当する物件が見つかりません。条件を変えてお試しください。
                  </td>
                </tr>
              ) : (
                filteredProperties.map((prop) => (
                  <tr key={prop.bukken_id} className="hover:bg-slate-50/60 transition group">
                    <td className="p-0 font-extrabold text-emerald-700">
                      <Link
                        href={`${ROUTES.HEYA_ICHIRAN.path}?id=${prop.bukken_id}`}
                        className="block w-full h-full px-4 py-3 hover:bg-emerald-50/70 transition underline decoration-2 underline-offset-2"
                      >
                        {prop.bukken_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800">
                      {prop.bukken_type !== null ? PROPERTY_TYPE_LABELS[prop.bukken_type] : '未設定'}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-700">
                      {prop.kanri_kbn !== null ? MANAGEMENT_TYPE_LABELS[prop.kanri_kbn] : '未設定'}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-700">
                      <span className="text-emerald-600 font-extrabold text-base">
                        {prop.vacant_rooms ?? 0}
                      </span>
                      <span className="text-slate-400 mx-1 font-normal">/</span>
                      <span>{prop.total_rooms ?? 0} 戸</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">
                      {prop.address ? (
                        <span className="flex items-center space-x-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-xs md:max-w-md">{prop.address}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={editPath(prop.bukken_id)} className="btn-row-edit">
                        <Pencil className="h-3.5 w-3.5" />
                        <span>修正</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}