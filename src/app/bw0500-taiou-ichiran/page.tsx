'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, ClipboardList, ArrowUpDown, ArrowUp, ArrowDown, Search, Building2, User, SlidersHorizontal, X, RefreshCw, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES, TAIOU_STATUS, TAIOU_CATEGORY } from '../../constants/routes';
import { supabase } from '../../utils/supabase';

interface TaiouHistoryItem {
  id: number;
  bukken_id: number;
  room_id: number | null;
  uketsuke_date: string;
  category: string;
  status: string;
  title: string;
  detail: string;
  completion_date: string | null;
  bokou: string | null;
  uketsukesha: string | null;
  iraisha: string | null;
  tantousha: string | null;
  M020_Bukken?: { name: string };
  M030_Room?: { room_number: string };
}

type SortKey = 'status' | 'uketsuke_date' | 'uketsukesha' | 'bukken_name' | 'room_number' | 'iraisha' | 'title' | 'tantousha';
type SortOrder = 'asc' | 'desc';

// 状況区分の並び順優先度を定義（未対応が最優先）
const STATUS_PRIORITY: Record<string, number> = {
  [TAIOU_STATUS.MITAIOU]: 1,  // 未対応
  [TAIOU_STATUS.KANRYOU]: 2,  // 完了
};

export default function TaiouIchiran() {
  const router = useRouter();
  const [histories, setHistories] = useState<TaiouHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // 検索・絞り込み用状態
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('すべて');
  const [selectedStatus, setSelectedStatus] = useState('すべて');

  // 手動ソート用の状態（初期値はデフォルト多重ソートのため null に設定）
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const fetchTaiouHistories = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [histRes, bukkenRes, roomRes] = await Promise.all([
        supabase.from('T010_TaiouHist').select('*'),
        supabase.from('M020_Bukken').select('id, name'),
        supabase.from('M030_Room').select('id, bukken_id, room_number')
      ]);

      if (histRes.error) throw histRes.error;

      const bukkenMap = new Map((bukkenRes.data || []).map(b => [Number(b.id), b]));
      const roomMap = new Map((roomRes.data || []).map(r => [Number(r.id), r]));

      const mergedData: TaiouHistoryItem[] = (histRes.data || []).map((hist: any) => {
        const bId = hist.bukken_id ? Number(hist.bukken_id) : null;
        const rId = hist.room_id ? Number(hist.room_id) : null;

        const bukkenData = bId ? bukkenMap.get(bId) : null;
        const roomData = rId ? roomMap.get(rId) : null;

        return {
          ...hist,
          M020_Bukken: bukkenData ? { name: bukkenData.name } : undefined,
          M030_Room: roomData ? { room_number: roomData.room_number } : undefined
        };
      });

      setHistories(mergedData);
    } catch (err) {
      console.error('対応履歴取得エラー:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTaiouHistories();
  }, [fetchTaiouHistories]);

  // フィルター・検索・ソート（派生値として計算し再レンダーを削減）
  const filteredHistories = useMemo(() => {
    let result = [...histories];

    if (selectedCategory !== 'すべて') {
      result = result.filter(h => h.category === selectedCategory);
    }

    if (selectedStatus !== 'すべて') {
      result = result.filter(h => h.status === selectedStatus);
    }

    if (searchKeyword.trim() !== '') {
      const kw = searchKeyword.toLowerCase();
      result = result.filter(h =>
        h.title?.toLowerCase().includes(kw) ||
        h.detail?.toLowerCase().includes(kw) ||
        h.bokou?.toLowerCase().includes(kw) ||
        h.uketsukesha?.toLowerCase().includes(kw) ||
        h.iraisha?.toLowerCase().includes(kw) ||
        h.tantousha?.toLowerCase().includes(kw) ||
        h.M020_Bukken?.name?.toLowerCase().includes(kw) ||
        h.M030_Room?.room_number?.toLowerCase().includes(kw)
      );
    }

    // ⭐ ソート処理
    if (sortKey) {
      // ヘッダーがクリックされた場合の手動ソート
      result.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (sortKey === 'bukken_name') {
          valA = a.M020_Bukken?.name || '';
          valB = b.M020_Bukken?.name || '';
        } else if (sortKey === 'room_number') {
          const numA = parseInt((a.M030_Room?.room_number || '').replace(/[^0-9]/g, '') || '0', 10);
          const numB = parseInt((b.M030_Room?.room_number || '').replace(/[^0-9]/g, '') || '0', 10);
          return sortOrder === 'asc' ? numA - numB : numB - numA;
        } else {
          const regularKey = sortKey as keyof TaiouHistoryItem;
          valA = a[regularKey];
          valB = b[regularKey];
        }

        valA = valA ?? '';
        valB = valB ?? '';

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // 基本ソート：【第一条件】状況区分（未対応優先） ➔ 【第二条件】受付日付（新しい順）
      result.sort((a, b) => {
        const priorityA = STATUS_PRIORITY[a.status] || 99;
        const priorityB = STATUS_PRIORITY[b.status] || 99;

        // 1. まず状況の優先度で比較
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        // 2. 状況が同じなら、受付日付の新しい順（降順）
        const dateA = a.uketsuke_date || '';
        const dateB = b.uketsuke_date || '';
        if (dateA < dateB) return 1;
        if (dateA > dateB) return -1;
        return 0;
      });
    }

    return result;
  }, [histories, searchKeyword, selectedCategory, selectedStatus, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-4 w-4 text-slate-400 ml-1.5 shrink-0 group-hover/th:text-slate-600 transition" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="h-4 w-4 text-emerald-600 ml-1.5 shrink-0" />
      : <ArrowDown className="h-4 w-4 text-emerald-600 ml-1.5 shrink-0" />;
  };

  const clearFilters = () => {
    setSearchKeyword('');
    setSelectedCategory('すべて');
    setSelectedStatus('すべて');
    setSortKey(null); // ソートもベース順に戻す
  };

  const isFiltered = searchKeyword !== '' || selectedCategory !== 'すべて' || selectedStatus !== 'すべて' || sortKey !== null;

  // スマホのセグメントタブ用：状況ごとの件数（全件から集計し、タブ表示を安定させる）
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { 'すべて': histories.length };
    Object.values(TAIOU_STATUS).forEach(st => {
      counts[st] = histories.filter(h => h.status === st).length;
    });
    return counts;
  }, [histories]);

  const detailPath = (id: number) => `${ROUTES.TAIOU_TOUROKU.path}?id=${id}`;

  const openDetail = (id: number) => {
    router.push(detailPath(id));
  };

  const statusPillClass = (status: string) =>
    status === TAIOU_STATUS.MITAIOU
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  const categoryPillClass = (category: string) =>
    category === TAIOU_CATEGORY.SHUZEN ? 'bg-amber-50 text-amber-700 border-amber-200' :
    category === TAIOU_CATEGORY.KUJOU ? 'bg-rose-50 text-rose-700 border-rose-200' :
    category === TAIOU_CATEGORY.YOUBOU ? 'bg-sky-50 text-sky-700 border-sky-200' :
    'bg-slate-50 text-slate-700 border-slate-200';

  return (
    /* 📱 スマホ: 通常スクロール ／ 💻 PC: 画面内固定＋明細のみスクロール
       ※ スマホで 100vh を使うとアドレスバーの伸縮で画面がガタつくため md 以上のみ適用 */
    <main className="p-3 sm:p-6 max-w-7xl mx-auto flex flex-col space-y-3 sm:space-y-6 overflow-x-clip md:h-[calc(100dvh-3.5rem)] md:overflow-hidden">

      {/* 🏷️ ページタイトル ＆ 新規登録ボタン（配置は全画面共通：左=戻る+タイトル / 右=新規登録） */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 flex flex-wrap justify-between items-center gap-2 sm:gap-4 shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <Link href={ROUTES.MAIN_MENU.path} className="btn-back">
            <ArrowLeft className="h-4 w-4" />
            <span>戻る</span>
          </Link>
          <h2 className="text-base sm:text-lg font-extrabold border-l-4 border-emerald-600 pl-2 sm:pl-3 text-slate-950 flex items-center space-x-1.5 min-w-0">
            <ClipboardList className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="truncate">{ROUTES.TAIOU_ICHIRAN.title}</span>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 sm:px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 shrink-0">
              {loading ? '...' : `${filteredHistories.length} 件`}
            </span>
          </h2>
        </div>

        <Link
          href={ROUTES.TAIOU_TOUROKU.path}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition shadow-sm cursor-pointer grow sm:grow-0 justify-center"
        >
          <Plus className="h-4 w-4" />
          <span>対応履歴の新規登録</span>
        </Link>
      </div>

      {/* 🔍 検索・条件絞り込みフィルター */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 shrink-0 flex flex-col space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center space-x-1.5 text-slate-700 font-bold text-xs">
            <SlidersHorizontal className="h-4 w-4 text-slate-500" />
            <span>検索・絞り込み条件</span>
          </div>
          {isFiltered && (
            <button
              onClick={clearFilters}
              className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded flex items-center space-x-1 transition cursor-pointer shadow-sm"
            >
              <X className="h-3.5 w-3.5" />
              <span>クリア</span>
            </button>
          )}
        </div>

        {/* 📱 スマホ用: 検索＋カテゴリチップ（セレクトの縦積みをやめ、指で選べるUIに） */}
        <div className="md:hidden space-y-2.5">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="物件名、内容、担当などから検索..."
              className="w-full h-11 pl-9 pr-3 border-2 border-slate-200 focus:border-emerald-500 rounded-xl text-sm font-bold text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-none transition"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
          </div>
          {/* カテゴリは横スワイプできるチップで1タップ切替 */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 py-0.5">
            {['すべて', ...Object.values(TAIOU_CATEGORY)].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`h-9 px-3.5 rounded-full text-xs font-bold border whitespace-nowrap shrink-0 transition ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 active:bg-slate-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 💻 PC用: 12カラムグリッド */}
        <div className="hidden md:grid md:grid-cols-12 gap-4 items-end">
          {/* 状況 */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">状況（進捗）</label>
            <select
              className="w-full border-2 border-slate-200 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs font-bold bg-slate-50/50 focus:bg-white text-slate-900 focus:outline-none transition cursor-pointer"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="すべて">すべて</option>
              {Object.values(TAIOU_STATUS).map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* カテゴリ */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">カテゴリ</label>
            <select
              className="w-full border-2 border-slate-200 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs font-bold bg-slate-50/50 focus:bg-white text-slate-900 focus:outline-none transition cursor-pointer"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="すべて">すべて</option>
              {Object.values(TAIOU_CATEGORY).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* キーワード検索 */}
          <div className="md:col-span-6">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">キーワード検索</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="物件名、内容、担当などから検索..."
                className="w-full pl-9 pr-3 py-2 border-2 border-slate-200 focus:border-emerald-500 rounded-lg text-xs font-bold text-slate-900 bg-slate-50/50 focus:bg-white focus:outline-none transition"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 📱 スマホ用: 状況セグメントタブ（スクロール中もヘッダー直下に吸着し、いつでも切替できる） */}
      <div className="md:hidden sticky top-[3.75rem] z-20">
        <div className="grid grid-cols-3 gap-1 bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-1 shadow-sm">
          {['すべて', ...Object.values(TAIOU_STATUS)].map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`h-10 rounded-lg text-xs font-extrabold transition whitespace-nowrap ${
                selectedStatus === st
                  ? st === TAIOU_STATUS.MITAIOU
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 active:bg-slate-100'
              }`}
            >
              {st}{!loading && ` (${statusCounts[st] ?? 0})`}
            </button>
          ))}
        </div>
      </div>

      {/* 📱 スマホ用: 案件カードリスト */}
      <div className="md:hidden space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`sk-${i}`} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 animate-pulse space-y-2.5">
              <div className="flex gap-1.5">
                <div className="h-5 bg-slate-200 rounded-full w-14" />
                <div className="h-5 bg-slate-200 rounded-full w-12" />
                <div className="flex-1" />
                <div className="h-4 bg-slate-200 rounded w-16" />
              </div>
              <div className="h-4 bg-slate-200 rounded w-4/5" />
              <div className="h-3.5 bg-slate-200 rounded w-3/5" />
              <div className="h-8 bg-slate-100 rounded w-full" />
            </div>
          ))
        ) : loadError ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <p className="text-red-600 font-bold text-sm mb-3">データの取得に失敗しました。</p>
            <button onClick={fetchTaiouHistories} className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>再読み込み</span>
            </button>
          </div>
        ) : filteredHistories.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 font-bold text-sm">
            該当する対応履歴が見つかりません。
          </div>
        ) : (
          filteredHistories.map((hist) => (
            /* カード全体タップ=詳細へ。右下に明示的な修正ボタンも置く。
               全要素に truncate / shrink-0 を指定し、横はみ出し（左右の揺れ）を根絶する */
            <div
              key={hist.id}
              onClick={() => openDetail(hist.id)}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 active:bg-emerald-50 transition cursor-pointer"
            >
              {/* 1行目: 状態・カテゴリ（左固定） / 受付日（右固定） */}
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-extrabold border shrink-0 ${statusPillClass(hist.status)}`}>
                  {hist.status || '未対応'}
                </span>
                <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${categoryPillClass(hist.category)}`}>
                  {hist.category}
                </span>
                <span className="flex-1" />
                <span className="text-[11px] font-bold text-slate-400 shrink-0 tabular-nums">{hist.uketsuke_date}</span>
              </div>

              {/* 2行目: 件名（最大2行で省略し、カード高さの揺れを抑える） */}
              <p className="mt-2 font-extrabold text-slate-900 text-[15px] leading-snug line-clamp-2 break-words">
                {hist.title}
              </p>

              {/* 3行目: 場所（必ず1行に収める） */}
              <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 font-bold min-w-0">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {hist.M020_Bukken?.name || `不明 (ID:${hist.bukken_id})`}
                  {hist.room_id ? ` ／ ${hist.M030_Room?.room_number || hist.room_id}号室` : ' ／ 共用部'}
                </span>
              </div>

              {/* 4行目: 担当（左・省略可能）＋修正ボタン（右・固定） */}
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 min-w-0 text-xs font-bold">
                  {hist.tantousha ? (
                    <>
                      <User className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="text-slate-600 truncate">担当: {hist.tantousha}</span>
                    </>
                  ) : (
                    /* 未対応なのに担当がいない案件は琥珀色で注意喚起 */
                    <span className={`truncate ${hist.status === TAIOU_STATUS.MITAIOU ? 'text-amber-600' : 'text-slate-300'}`}>
                      担当未定
                    </span>
                  )}
                </span>
                <Link
                  href={detailPath(hist.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="btn-row-edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>修正</span>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 💻 PC用: メインデータテーブル */}
      <div className="hidden md:flex bg-white rounded-xl shadow-sm border border-slate-200 flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
          <table className="w-full text-left border-collapse text-xs min-w-[1480px]">
            <thead className="sticky top-0 z-30 shadow-[0_2px_2px_-1px_rgba(0,0,0,0.05)]">
              <tr className="bg-slate-50/70 backdrop-blur-sm border-b border-slate-200 text-slate-700 font-bold select-none">
                <th onClick={() => handleSort('status')} className="px-4 py-3 w-28 cursor-pointer hover:bg-slate-100 transition group/th text-center">
                  <div className="flex items-center justify-center">
                    <span>状況</span>
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th onClick={() => handleSort('uketsuke_date')} className="px-4 py-3 w-36 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>日付（受付）</span>
                    {renderSortIcon('uketsuke_date')}
                  </div>
                </th>
                <th onClick={() => handleSort('uketsukesha')} className="px-4 py-3 w-32 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>受付者</span>
                    {renderSortIcon('uketsukesha')}
                  </div>
                </th>
                <th onClick={() => handleSort('bukken_name')} className="px-4 py-3 w-52 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>物件名</span>
                    {renderSortIcon('bukken_name')}
                  </div>
                </th>
                <th onClick={() => handleSort('room_number')} className="px-4 py-3 w-28 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>部屋</span>
                    {renderSortIcon('room_number')}
                  </div>
                </th>
                <th onClick={() => handleSort('iraisha')} className="px-4 py-3 w-32 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>依頼者</span>
                    {renderSortIcon('iraisha')}
                  </div>
                </th>
                <th onClick={() => handleSort('title')} className="px-4 py-3 w-80 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>対応内容・件名</span>
                    {renderSortIcon('title')}
                  </div>
                </th>
                <th onClick={() => handleSort('tantousha')} className="px-4 py-3 w-32 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>担当</span>
                    {renderSortIcon('tantousha')}
                  </div>
                </th>
                <th className="px-4 py-3 min-w-[160px]">備考</th>
                <th className="px-4 py-3 w-24 text-center">操作</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                // スケルトン行：レイアウトを確定させたまま読み込みを見せる
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded-full w-16 mx-auto" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-32" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-14" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-3/4" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-12 mx-auto" /></td>
                  </tr>
                ))
              ) : loadError ? (
                <tr>
                  <td colSpan={10} className="p-16 text-center bg-slate-50/20">
                    <p className="text-red-600 font-bold mb-3">データの取得に失敗しました。</p>
                    <button
                      onClick={fetchTaiouHistories}
                      className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-xs font-bold transition cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>再読み込み</span>
                    </button>
                  </td>
                </tr>
              ) : filteredHistories.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-16 text-center text-slate-400 font-bold bg-slate-50/20">
                    該当する対応履歴が見つかりません。
                  </td>
                </tr>
              ) : (
                filteredHistories.map((hist) => (
                  // 行全体をクリックで詳細へ（クリック可能領域を最大化）
                  <tr
                    key={hist.id}
                    onClick={() => openDetail(hist.id)}
                    className="hover:bg-emerald-50/40 transition cursor-pointer"
                  >
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full font-extrabold border ${statusPillClass(hist.status)}`}>
                        {hist.status || '未対応'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">
                      <Link
                        href={detailPath(hist.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-emerald-700 font-extrabold hover:text-emerald-800 hover:underline decoration-2 underline-offset-2"
                      >
                        {hist.uketsuke_date}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">
                      {hist.uketsukesha ? (
                        <div className="flex items-center space-x-1">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[100px]">{hist.uketsukesha}</span>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-800 truncate max-w-[200px]">
                      <div className="flex items-center space-x-1">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{hist.M020_Bukken?.name || `不明 (ID:${hist.bukken_id})`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-extrabold text-slate-700">
                      {hist.room_id ? (
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold border border-slate-200">
                          {hist.M030_Room?.room_number || hist.room_id}号室
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">共用部</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-700 truncate max-w-[110px]">
                      {hist.iraisha || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800 font-bold max-w-[300px] truncate" title={hist.detail}>
                      <div className="flex items-center space-x-2 truncate">
                        <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${categoryPillClass(hist.category)}`}>
                          {hist.category}
                        </span>
                        <span className="truncate text-slate-900 font-extrabold">{hist.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">
                      {hist.tantousha ? (
                        <div className="flex items-center space-x-1">
                          <User className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[100px]">{hist.tantousha}</span>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 font-medium text-xs max-w-[200px] truncate" title={hist.bokou || ''}>
                      {hist.bokou || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Link
                        href={detailPath(hist.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="btn-row-edit"
                      >
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
