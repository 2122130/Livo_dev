'use client';

import React, { useEffect, useState } from 'react';
import { Search, Key, Database, MessageSquare, Plus, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { ROUTES, ROOM_STATUS, TAIOU_STATUS } from '../../constants/routes';
import { supabase } from '../../utils/supabase';

export default function Dashboard() {
  // 件数バッジは後から流し込む。メニュー自体は即時描画（体感速度優先）
  const [vacantCount, setVacantCount] = useState<number | null>(null);
  const [mitaiouCount, setMitaiouCount] = useState<number | null>(null);
  const [today, setToday] = useState('');

  useEffect(() => {
    // 日付はクライアント側で確定（SSRとのタイムゾーンずれ防止）
    setToday(new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }));

    let cancelled = false;
    async function fetchCounts() {
      try {
        const [vacantRes, mitaiouRes] = await Promise.all([
          supabase.from('M030_Room').select('id', { count: 'exact', head: true }).eq('status', ROOM_STATUS.VACANT),
          supabase.from('T010_TaiouHist').select('id', { count: 'exact', head: true }).eq('status', TAIOU_STATUS.MITAIOU),
        ]);
        if (cancelled) return;
        if (typeof vacantRes.count === 'number') setVacantCount(vacantRes.count);
        if (typeof mitaiouRes.count === 'number') setMitaiouCount(mitaiouRes.count);
      } catch (err) {
        // バッジは飾り。失敗してもメニュー自体は使えるので握りつぶす
        console.error('件数取得エラー:', err);
      }
    }
    fetchCounts();
    return () => { cancelled = true; };
  }, []);

  const hasUrgent = (mitaiouCount ?? 0) > 0;

  // 読み込み中はパルス表示、取得後に実数を表示（白カード用の淡色バッジ）
  const renderCountBadge = (count: number | null, unit: string, urgent: boolean) => {
    if (count === null) {
      return <span className="inline-block h-5 w-16 bg-slate-100 rounded-full animate-pulse align-middle" />;
    }
    if (urgent && count > 0) {
      return (
        <span className="inline-flex items-center bg-rose-50 text-rose-600 border border-rose-200 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
          未対応 {count}{unit}
        </span>
      );
    }
    if (urgent) {
      return (
        <span className="inline-flex items-center bg-slate-100 text-slate-500 border border-slate-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
          未対応なし
        </span>
      );
    }
    return (
      <span className="inline-flex items-center bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
        空室 {count}{unit}
      </span>
    );
  };

  return (
    <main className="p-3 sm:p-6 max-w-5xl mx-auto">

      {/* ヘッダーバー：見出し＋今日の日付（業務は「今日」が基準） */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 sm:px-5 sm:py-3.5 mb-3 sm:mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3 min-w-0">
          <h3 className="menu-title border-l-4 border-emerald-600 pl-3">メインメニュー</h3>
          <p className="menu-subtitle hidden sm:block">行う業務を選択</p>
        </div>
        {today && <span className="menu-date">{today}</span>}
      </div>

      {/* 4つの白カードパネル */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">

        {/* 1. 物件管理 */}
        <Link
          href={ROUTES.BUKKEN_ICHIRAN.path}
          className="menu-panel panel-bukken">
          <div className="min-w-0">
            <span className="panel-title">物件管理</span>
            <span className="panel-desc">物件の検索・登録等</span>
          </div>
          <div className="panel-icon-wrapper">
            <Search className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
        </Link>

        {/* 2. 空き物件・空室管理（部屋一覧画面の空室絞り込みへ連動） */}
        <Link
          href={`${ROUTES.HEYA_ICHIRAN.path}?status=空室`}
          className="menu-panel panel-akiya">
          <div className="min-w-0">
            <span className="panel-title">空き物件管理</span>
            <span className="panel-desc">全物件の空室・募集状況の確認</span>
            <div className="mt-2">{renderCountBadge(vacantCount, '戸', false)}</div>
          </div>
          <div className="panel-icon-wrapper">
            <Key className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
        </Link>

        {/* 3. 対応履歴（修繕・苦情）: 未対応があるときは赤く主張する */}
        <Link
          href={ROUTES.TAIOU_ICHIRAN.path}
          className={`menu-panel panel-taiou ${hasUrgent ? 'panel-urgent' : ''}`}>
          <div className="min-w-0">
            <span className="panel-title">対応履歴</span>
            <span className="panel-desc">修繕・苦情等の管理</span>
            <div className="mt-2">{renderCountBadge(mitaiouCount, '件', true)}</div>
          </div>
          <div className="panel-icon-wrapper">
            <MessageSquare className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
        </Link>

        {/* 4. 各種設定（マスタ）: 未実装のため準備中として無効化 */}
        <div className="menu-panel panel-setting opacity-60 cursor-not-allowed select-none" aria-disabled="true">
          <div className="min-w-0">
            <span className="panel-title">各種設定</span>
            <span className="panel-desc">その他のシステム設定</span>
            <div className="mt-2">
              <span className="inline-flex items-center bg-slate-100 text-slate-500 border border-slate-200 text-xs font-bold px-2.5 py-0.5 rounded-full">準備中</span>
            </div>
          </div>
          <div className="panel-icon-wrapper">
            <Database className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
        </div>

      </div>

      {/* ⚡ クイック操作：現場で頻度の高い操作へ1タップで直行 */}
      <div className="mt-4 sm:mt-5">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">クイック操作</p>
        <div className="quick-bar">
          {/* 電話を受けながらの登録が一番多い操作なので、これだけ塗りで最優先 */}
          <Link href={ROUTES.TAIOU_TOUROKU.path} className="quick-action quick-action-primary">
            <ClipboardList className="h-4 w-4" />
            <span>対応履歴を登録</span>
          </Link>
          <Link href={ROUTES.BUKKEN_TOUROKU.path} className="quick-action">
            <Plus className="h-4 w-4" />
            <span>新規物件登録</span>
          </Link>
          <Link href={`${ROUTES.HEYA_ICHIRAN.path}?status=空室`} className="quick-action">
            <Key className="h-4 w-4" />
            <span>空室だけ見る</span>
          </Link>
        </div>
      </div>

    </main>
  );
}
