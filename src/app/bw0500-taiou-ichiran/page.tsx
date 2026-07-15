'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, ClipboardList, ArrowUpDown, ArrowUp, ArrowDown, Search, Building2, User, SlidersHorizontal, X, RefreshCw, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ROUTES,
  MUKOU_KBN,
  TAIOU_STATUS,
  TAIOU_CATEGORY,
  TAIOU_STATUS_LABELS,
  TAIOU_CATEGORY_LABELS,
} from '../../constants/index';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../context/AuthContext';

// t300_taioulog の行に、表示用の物件名・部屋名・担当者名をマージした型
interface TaiouLogItem {
  log_id: number;
  bukken_id: number;
  heya_id: number | null;
  receive_date: string | null;
  inquiry_kbn: number | null;
  support_status: number | null;
  subject: string | null;
  content: string | null;
  completion_date: string | null;
  bikou: string | null;
  receiver_account: string | null;
  requester_name: string | null;
  rep_account: string | null;
  bukken_name: string;
  heya_name: string;
  receiver_name: string;
  rep_name: string;
}

type SortKey = 'support_status' | 'receive_date' | 'receiver_name' | 'bukken_name' | 'heya_name' | 'requester_name' | 'subject' | 'rep_name';
type SortOrder = 'asc' | 'desc';

// 状況区分の並び順優先度を定義（未処理が最優先）
const STATUS_PRIORITY: Record<number, number> = {
  [TAIOU_STATUS.MITAIOU]: 1,   // 未処理
  [TAIOU_STATUS.SHORICHU]: 2,  // 処理中
  [TAIOU_STATUS.KANRYOU]: 3,   // 完了
};

export default function TaiouIchiran() {
  const router = useRouter();
  const { user } = useAuth();
  const [histories, setHistories] = useState<TaiouLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // 検索・絞り込み用状態（'all' = すべて、それ以外は区分コード値）
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<number | 'all'>('all');

  // 手動ソート用の状態（初期値はデフォルト多重ソートのため null に設定）
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const fetchTaiouHistories = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    try {
      const [logRes, bukkenRes, heyaRes, accountRes] = await Promise.all([
        supabase.from('t300_taioulog')
          .select('*')
          .eq('soshiki_id', user.soshiki_id)
          .eq('mukou_kbn', MUKOU_KBN.有効),
        supabase.from('m200_basebukken')
          .select('bukken_id, bukken_name')
          .eq('soshiki_id', user.soshiki_id),
        supabase.from('m300_heya')
          .select('heya_id, bukken_id, heya_name')
          .eq('soshiki_id', user.soshiki_id),
        supabase.from('m100_account')
          .select('login_id, account_name')
          .eq('soshiki_id', user.soshiki_id)
      ]);

      if (logRes.error) throw logRes.error;

      const bukkenMap = new Map((bukkenRes.data || []).map(b => [b.bukken_id, b.bukken_name]));
      // 部屋IDは物件ごとの連番のため、物件ID＋部屋IDの複合キーで引く
      const heyaMap = new Map((heyaRes.data || []).map(h => [`${h.bukken_id}:${h.heya_id}`, h.heya_name]));
      const accountMap = new Map((accountRes.data || []).map(a => [a.login_id, a.account_name]));

      const mergedData: TaiouLogItem[] = (logRes.data || []).map((log) => ({
        ...log,
        bukken_name: bukkenMap.get(log.bukken_id) || '',
        heya_name: log.heya_id != null ? (heyaMap.get(`${log.bukken_id}:${log.heya_id}`) || '') : '',
        receiver_name: log.receiver_account ? (accountMap.get(log.receiver_account) || log.receiver_account) : '',
        rep_name: log.rep_account ? (accountMap.get(log.rep_account) || log.rep_account) : '',
      }));

      setHistories(mergedData);
    } catch (err) {
      console.error('対応履歴取得エラー:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTaiouHistories();
  }, [fetchTaiouHistories]);

  // フィルター・検索・ソート（派生値として計算し再レンダーを削減）
  const filteredHistories = useMemo(() => {
    let result = [...histories];

    if (selectedCategory !== 'all') {
      result = result.filter(h => h.inquiry_kbn === selectedCategory);
    }

    if (selectedStatus !== 'all') {
      result = result.filter(h => h.support_status === selectedStatus);
    }

    if (searchKeyword.trim() !== '') {
      const kw = searchKeyword.toLowerCase();
      result = result.filter(h =>
        h.subject?.toLowerCase().includes(kw) ||
        h.content?.toLowerCase().includes(kw) ||
        h.bikou?.toLowerCase().includes(kw) ||
        h.receiver_name.toLowerCase().includes(kw) ||
        h.requester_name?.toLowerCase().includes(kw) ||
        h.rep_name.toLowerCase().includes(kw) ||
        h.bukken_name.toLowerCase().includes(kw) ||
        h.heya_name.toLowerCase().includes(kw)
      );
    }

    // ⭐ ソート処理
    if (sortKey) {
      // ヘッダーがクリックされた場合の手動ソート
      result.sort((a, b) => {
        if (sortKey === 'heya_name') {
          const numA = parseInt((a.heya_name || '').replace(/[^0-9]/g, '') || '0', 10);
          const numB = parseInt((b.heya_name || '').replace(/[^0-9]/g, '') || '0', 10);
          return sortOrder === 'asc' ? numA - numB : numB - numA;
        }

        let valA: string | number = a[sortKey] ?? '';
        let valB: string | number = b[sortKey] ?? '';

        if (sortKey === 'support_status') {
          valA = STATUS_PRIORITY[Number(valA)] || 99;
          valB = STATUS_PRIORITY[Number(valB)] || 99;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // 基本ソート：【第一条件】状況区分（未処理優先） ➔ 【第二条件】受付日付（新しい順）
      result.sort((a, b) => {
        const priorityA = STATUS_PRIORITY[a.support_status ?? 0] || 99;
        const priorityB = STATUS_PRIORITY[b.support_status ?? 0] || 99;

        // 1. まず状況の優先度で比較
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        // 2. 状況が同じなら、受付日付の新しい順（降順）
        const dateA = a.receive_date || '';
        const dateB = b.receive_date || '';
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
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSortKey(null); // ソートもベース順に戻す
  };

  const isFiltered = searchKeyword !== '' || selectedCategory !== 'all' || selectedStatus !== 'all' || sortKey !== null;

  // スマホのセグメントタブ用：状況ごとの件数（全件から集計し、タブ表示を安定させる）
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: histories.length };
    Object.values(TAIOU_STATUS).forEach(st => {
      counts[st] = histories.filter(h => h.support_status === st).length;
    });
    return counts;
  }, [histories]);

  const detailPath = (id: number) => `${ROUTES.TAIOU_TOUROKU.path}?id=${id}`;

  const openDetail = (id: number) => {
    router.push(detailPath(id));
  };

  const statusLabel = (status: number | null) =>
    status != null ? (TAIOU_STATUS_LABELS[status] ?? String(status)) : '未処理';

  const categoryLabel = (category: number | null) =>
    category != null ? (TAIOU_CATEGORY_LABELS[category] ?? String(category)) : '—';

  const statusPillClass = (status: number | null) =>
    status === TAIOU_STATUS.KANRYOU
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === TAIOU_STATUS.SHORICHU
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-rose-50 text-rose-700 border-rose-200';

  const categoryPillClass = (category: number | null) =>
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
            {(['all', ...Object.values(TAIOU_CATEGORY)] as (number | 'all')[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`h-9 px-3.5 rounded-full text-xs font-bold border whitespace-nowrap shrink-0 transition ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 active:bg-slate-100'
                }`}
              >
                {cat === 'all' ? 'すべて' : categoryLabel(cat)}
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
              onChange={(e) => setSelectedStatus(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">すべて</option>
              {Object.values(TAIOU_STATUS).map((st) => (
                <option key={st} value={st}>{TAIOU_STATUS_LABELS[st] ?? String(st)}</option>
              ))}
            </select>
          </div>

          {/* カテゴリ */}
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-500 mb-1">カテゴリ</label>
            <select
              className="w-full border-2 border-slate-200 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs font-bold bg-slate-50/50 focus:bg-white text-slate-900 focus:outline-none transition cursor-pointer"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">すべて</option>
              {Object.values(TAIOU_CATEGORY).map((cat) => (
                <option key={cat} value={cat}>{TAIOU_CATEGORY_LABELS[cat] ?? String(cat)}</option>
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
        <div className="grid grid-cols-4 gap-1 bg-white/95 backdrop-blur border border-slate-200 rounded-xl p-1 shadow-sm">
          {(['all', ...Object.values(TAIOU_STATUS)] as (number | 'all')[]).map((st) => (
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
              {st === 'all' ? 'すべて' : statusLabel(st)}{!loading && ` (${statusCounts[st] ?? 0})`}
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
              key={hist.log_id}
              onClick={() => openDetail(hist.log_id)}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5 active:bg-emerald-50 transition cursor-pointer"
            >
              {/* 1行目: 状態・カテゴリ（左固定） / 受付日（右固定） */}
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-extrabold border shrink-0 ${statusPillClass(hist.support_status)}`}>
                  {statusLabel(hist.support_status)}
                </span>
                <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${categoryPillClass(hist.inquiry_kbn)}`}>
                  {categoryLabel(hist.inquiry_kbn)}
                </span>
                <span className="flex-1" />
                <span className="text-[11px] font-bold text-slate-400 shrink-0 tabular-nums">{hist.receive_date}</span>
              </div>

              {/* 2行目: 件名（最大2行で省略し、カード高さの揺れを抑える） */}
              <p className="mt-2 font-extrabold text-slate-900 text-[15px] leading-snug line-clamp-2 break-words">
                {hist.subject}
              </p>

              {/* 3行目: 場所（必ず1行に収める） */}
              <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 font-bold min-w-0">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {hist.bukken_name || `不明 (ID:${hist.bukken_id})`}
                  {hist.heya_id != null ? ` ／ ${hist.heya_name || hist.heya_id}号室` : ' ／ 共用部'}
                </span>
              </div>

              {/* 4行目: 担当（左・省略可能）＋修正ボタン（右・固定） */}
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 min-w-0 text-xs font-bold">
                  {hist.rep_name ? (
                    <>
                      <User className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="text-slate-600 truncate">担当: {hist.rep_name}</span>
                    </>
                  ) : (
                    /* 未処理なのに担当がいない案件は琥珀色で注意喚起 */
                    <span className={`truncate ${hist.support_status === TAIOU_STATUS.MITAIOU ? 'text-amber-600' : 'text-slate-300'}`}>
                      担当未定
                    </span>
                  )}
                </span>
                <Link
                  href={detailPath(hist.log_id)}
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
                <th onClick={() => handleSort('support_status')} className="px-4 py-3 w-28 cursor-pointer hover:bg-slate-100 transition group/th text-center">
                  <div className="flex items-center justify-center">
                    <span>状況</span>
                    {renderSortIcon('support_status')}
                  </div>
                </th>
                <th onClick={() => handleSort('receive_date')} className="px-4 py-3 w-36 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>日付（受付）</span>
                    {renderSortIcon('receive_date')}
                  </div>
                </th>
                <th onClick={() => handleSort('receiver_name')} className="px-4 py-3 w-32 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>受付者</span>
                    {renderSortIcon('receiver_name')}
                  </div>
                </th>
                <th onClick={() => handleSort('bukken_name')} className="px-4 py-3 w-52 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>物件名</span>
                    {renderSortIcon('bukken_name')}
                  </div>
                </th>
                <th onClick={() => handleSort('heya_name')} className="px-4 py-3 w-28 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>部屋</span>
                    {renderSortIcon('heya_name')}
                  </div>
                </th>
                <th onClick={() => handleSort('requester_name')} className="px-4 py-3 w-32 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>依頼者</span>
                    {renderSortIcon('requester_name')}
                  </div>
                </th>
                <th onClick={() => handleSort('subject')} className="px-4 py-3 w-80 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>対応内容・件名</span>
                    {renderSortIcon('subject')}
                  </div>
                </th>
                <th onClick={() => handleSort('rep_name')} className="px-4 py-3 w-32 cursor-pointer hover:bg-slate-100 transition group/th">
                  <div className="flex items-center">
                    <span>担当</span>
                    {renderSortIcon('rep_name')}
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
                    key={hist.log_id}
                    onClick={() => openDetail(hist.log_id)}
                    className="hover:bg-emerald-50/40 transition cursor-pointer"
                  >
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center text-[11px] px-2.5 py-0.5 rounded-full font-extrabold border ${statusPillClass(hist.support_status)}`}>
                        {statusLabel(hist.support_status)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">
                      <Link
                        href={detailPath(hist.log_id)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-emerald-700 font-extrabold hover:text-emerald-800 hover:underline decoration-2 underline-offset-2"
                      >
                        {hist.receive_date}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">
                      {hist.receiver_name ? (
                        <div className="flex items-center space-x-1">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[100px]">{hist.receiver_name}</span>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-800 truncate max-w-[200px]">
                      <div className="flex items-center space-x-1">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{hist.bukken_name || `不明 (ID:${hist.bukken_id})`}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-extrabold text-slate-700">
                      {hist.heya_id != null ? (
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-bold border border-slate-200">
                          {hist.heya_name || hist.heya_id}号室
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">共用部</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-700 truncate max-w-[110px]">
                      {hist.requester_name || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-800 font-bold max-w-[300px] truncate" title={hist.content || ''}>
                      <div className="flex items-center space-x-2 truncate">
                        <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${categoryPillClass(hist.inquiry_kbn)}`}>
                          {categoryLabel(hist.inquiry_kbn)}
                        </span>
                        <span className="truncate text-slate-900 font-extrabold">{hist.subject}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-800">
                      {hist.rep_name ? (
                        <div className="flex items-center space-x-1">
                          <User className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[100px]">{hist.rep_name}</span>
                        </div>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 font-medium text-xs max-w-[200px] truncate" title={hist.bikou || ''}>
                      {hist.bikou || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Link
                        href={detailPath(hist.log_id)}
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
