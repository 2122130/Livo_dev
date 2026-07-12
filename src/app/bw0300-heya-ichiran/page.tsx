'use client';

import React, { useCallback, useEffect, useMemo, useState, Suspense } from 'react';
import { ArrowLeft, Building2, Plus, DoorOpen, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ROUTES, ROOM_STATUS, ROOM_STATUS_LABELS } from '../../constants/index';
import { supabase } from '../../utils/supabase';

interface Property {
  soshiki_id: number;       // 組織ID
  bukken_id: number;        // 物件ID
  bukken_name?: string | null;      // 物件名
  bukken_type?: number | null;      // 物件種別（M010_Commonと連動）
  address?: string | null;          // 住所
  management_type?: number | null;  // 管理種別
  // 必要に応じて計算用フィールドを追加
  total_rooms?: number;     // 総戸数
  vacant_rooms?: number;    // 空室数
}

interface Room {
  soshiki_id: number;       // 組織ID（複合キーの一部）
  bukken_id: number;        // 物件ID（複合キーの一部）
  heya_id: number;          // 部屋ID（または連番）
  heya_name: string;        // 部屋番号
  heya_status: number | null; // ステータス（ROOM_STATUS）
  rent: number;             // 家賃
  other_fee: number;        // その他費用
  layout: string;           // 間取り
  guarantee_company: string | null; // 保証会社
  m200_basebukken?: {
    bukken_name: string;
  };
}

type SortKey = 'heya_name' | 'heya_status' | 'layout' | 'rent' | 'other_fee';
type SortOrder = 'asc' | 'desc';

function HeyaIchiranContent() {
  const searchParams = useSearchParams();
  const bukkenId = searchParams.get('id');
  const initialStatus = searchParams.get('status'); // 👈 メニューからの「?status=空室」を受け取る

  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState<string>(initialStatus || 'すべて');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const STATUS_TABS = ['すべて', '空室', '入居中', '準備中'] as const;
  const STATUS_TAB_MAP: Record<string, number | null> = {
    空室: ROOM_STATUS.AKISHITSU,
    入居中: ROOM_STATUS.NYUKYUCHU,
    準備中: ROOM_STATUS.JUNBICHU,
  };

  const normalizeRoom = (room: any): Room => ({
    soshiki_id: room.soshiki_id,
    bukken_id: room.bukken_id,
    heya_id: room.heya_id,
    heya_name: room.heya_name ?? room.room_number ?? '',
    heya_status: room.heya_status ?? room.status ?? ROOM_STATUS.AKISHITSU,
    rent: room.rent ?? 0,
    other_fee: room.other_fee ?? room.management_fee ?? 0,
    layout: room.layout ?? '',
    guarantee_company: room.guarantee_company ?? room.guarantor_company ?? null,
    m200_basebukken: room.m200_basebukken,
  });

  // 戻る先：物件経由（?id あり）なら物件一覧へ、
  // 空き物件管理から直接来た（?id なし）ならメインメニューへ
  const backHref = bukkenId ? ROUTES.BUKKEN_ICHIRAN.path : ROUTES.MAIN_MENU.path;

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setActiveTab(initialStatus || 'すべて');

      if (bukkenId) {
        // 【パターンA】特定の物件が指定されている場合（物件情報と部屋を並列取得）
        const [propRes, roomRes] = await Promise.all([
          supabase.from('m200_basebukken').select('*').eq('bukken_id', Number(bukkenId)).single(),
          supabase.from('m300_heya').select('*').eq('bukken_id', Number(bukkenId)).order('heya_name', { ascending: true }),
        ]);
        if (propRes.error) throw propRes.error;
        if (roomRes.error) throw roomRes.error;

        setProperty(propRes.data);
        setRooms((roomRes.data || []).map(normalizeRoom));
      } else {
        // 【パターンB】物件指定なし＝「空き物件管理」から全物件を対象に飛んできた場合
        setProperty({
          soshiki_id: 0,
          bukken_id: 0,
          bukken_name: '全物件（横断表示）',
          bukken_type: 0,
          address: '—',
          management_type: 0
        });

        // 物件名も一緒に表示できるようにリレーション付きで部屋を取得
        const { data: roomData, error } = await supabase.from('m300_heya').select('*, m200_basebukken(bukken_name)').order('heya_name', { ascending: true });
        if (error) throw error;
        setRooms((roomData || []).map(normalizeRoom));
      }

      setSortKey(null);
    } catch (err) {
      console.error(err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [bukkenId, initialStatus]);

  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  // タブ絞り込み＋ソート（派生値として計算し、再レンダーとカクつきを減らす）
  const filteredRooms = useMemo(() => {
    const statusFilter = activeTab === 'すべて' ? null : STATUS_TAB_MAP[activeTab];
    let result = statusFilter === null ? [...rooms] : rooms.filter(room => room.heya_status === statusFilter);

    if (sortKey) {
      result.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (sortKey === 'heya_name') {
          const numA = parseInt(String(valA ?? '').replace(/[^0-9]/g, ''), 10) || 0;
          const numB = parseInt(String(valB ?? '').replace(/[^0-9]/g, ''), 10) || 0;
          return sortOrder === 'asc' ? numA - numB : numB - numA;
        }

        if (sortKey === 'heya_status') {
          const numA = Number(valA ?? 0);
          const numB = Number(valB ?? 0);
          return sortOrder === 'asc' ? numA - numB : numB - numA;
        }

        valA = valA ?? '';
        valB = valB ?? '';

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [activeTab, rooms, sortKey, sortOrder]);

  const handleTabChange = (statusTab: string) => {
    setActiveTab(statusTab);
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

  const formatMoney = (num: number) => num ? num.toLocaleString() : '0';

  const statusBadgeClass = (status: number) =>
    status === ROOM_STATUS.AKISHITSU ? 'bg-emerald-100 text-emerald-950 border border-emerald-400' :
    status === ROOM_STATUS.JUNBICHU ? 'bg-amber-100 text-amber-950 border border-amber-400' :
    status === ROOM_STATUS.NYUKYUCHU ? 'bg-sky-100 text-sky-950 border border-sky-400' :
    'bg-amber-100 text-amber-950 border border-amber-400';

  const renderCheckBadge = (label: string, isDone: boolean | undefined) => {
    if (isDone) {
      return (
        <span className="inline-flex items-center space-x-0.5 bg-emerald-50 text-emerald-900 border border-emerald-300 px-1.5 py-0.5 rounded text-[11px] font-extrabold shrink-0">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          <span>{label}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-0.5 bg-slate-100 text-slate-500 border border-slate-300 px-1.5 py-0.5 rounded text-[11px] font-bold shrink-0 opacity-60">
        <span>未{label}</span>
      </span>
    );
  };

  const roomEditPath = (room: Room) =>
    `${ROUTES.HEYA_TOUROKU.path}?property_id=${room.bukken_id}&property_name=${encodeURIComponent(room.m200_basebukken?.bukken_name || property?.bukken_name || '')}&room_id=${room.heya_id}`;

  return (
    /* 📱 スマホ: 通常スクロール ／ 💻 PC: 画面内固定＋明細のみスクロール
       ※ スマホで 100vh を使うとアドレスバーの伸縮で画面がガタつくため md 以上のみ適用 */
    <main className="p-3 sm:p-6 max-w-7xl mx-auto flex flex-col space-y-3 sm:space-y-4 md:h-[calc(100dvh-3.5rem)] md:overflow-hidden">

      {/* 🏷️ ページタイトル ＆ 新規登録ボタン（配置は全画面共通：左=戻る+タイトル / 右=新規登録） */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 shrink-0">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <Link href={backHref} className="btn-back">
              <ArrowLeft className="h-4 w-4" />
              <span>戻る</span>
            </Link>
            <h2 className="text-base sm:text-lg font-extrabold border-l-4 border-emerald-600 pl-2 sm:pl-3 text-slate-950 flex items-center space-x-1.5 min-w-0">
              <DoorOpen className="h-5 w-5 text-emerald-600 shrink-0" />
              <span className="truncate">{ROUTES.HEYA_ICHIRAN.title}</span>
            </h2>
          </div>

          {/* 物件単体表示のときだけ新規部屋登録ボタンを出す（右上配置で統一） */}
          {!loading && property && property.bukken_id !== 0 && (
            <Link
              href={`${ROUTES.HEYA_TOUROKU.path}?property_id=${property.bukken_id}&property_name=${encodeURIComponent(property.bukken_name ?? '')}`}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center space-x-1 transition shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>新規部屋登録</span>
            </Link>
          )}
        </div>

        {/* スマホは物件名だけを1行で。詳細はPCで表示 */}
        <div className="mt-3 sm:mt-4 bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
            <div className="min-w-0">
              <span className="text-slate-900 font-bold block mb-0.5 md:mb-1 text-xs md:text-sm">対象物件名</span>
              {loading ? (
                <div className="h-5 bg-slate-200 rounded w-40 animate-pulse" />
              ) : (
                <span className="font-extrabold text-slate-950 text-sm md:text-base flex items-center space-x-1 min-w-0">
                  <Building2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{property?.bukken_name || '—'}</span>
                </span>
              )}
            </div>
            <div className="hidden md:block">
              <span className="text-slate-900 font-bold block mb-1">種別 / 管理区分</span>
              {loading ? (
                <div className="h-5 bg-slate-200 rounded w-32 animate-pulse" />
              ) : (
                <span className="font-bold text-slate-800">
                  {property?.bukken_type || '—'} ／ {property?.management_type || '—'}
                </span>
              )}
            </div>
            <div className="hidden md:block">
              <span className="text-slate-900 font-bold block mb-1">所在地</span>
              {loading ? (
                <div className="h-5 bg-slate-200 rounded w-48 animate-pulse" />
              ) : (
                <span className="text-slate-800 font-bold">{property?.address || '—'}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 🔑 部屋一覧 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-6 flex flex-col md:flex-1 md:overflow-hidden space-y-3 sm:space-y-4">
        <h3 className="text-sm sm:text-base font-extrabold text-slate-950 flex items-center space-x-1.5 min-w-0 shrink-0">
          <DoorOpen className="h-5 w-5 text-emerald-600 shrink-0" />
          <span className="truncate">
            部屋情報一覧
            {loading ? '（読み込み中...）' : `（該当: ${filteredRooms.length} / ${rooms.length}件）`}
          </span>
        </h3>

        {/* 絞り込みタブ（スマホは横スクロール可、スクロールバー非表示） */}
        <div className="flex overflow-x-auto no-scrollbar border-b border-slate-200 text-sm font-bold bg-slate-50/50 p-1 rounded-t-md border-t border-x shrink-0">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 md:py-1.5 text-xs rounded transition mr-1 cursor-pointer font-extrabold whitespace-nowrap shrink-0 ${
                activeTab === tab ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {tab}{!loading && ` (${tab === 'すべて' ? rooms.length : rooms.filter(r => r.heya_status === STATUS_TAB_MAP[tab]).length})`}
            </button>
          ))}
        </div>

        {/* 📱 スマホ用: 部屋カードリスト */}
        <div className="md:hidden space-y-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={`sk-${i}`} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 animate-pulse space-y-2">
                <div className="h-5 bg-slate-200 rounded w-1/3" />
                <div className="h-3.5 bg-slate-200 rounded w-2/3" />
                <div className="h-3.5 bg-slate-200 rounded w-1/2" />
              </div>
            ))
          ) : loadError ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <p className="text-red-600 font-bold text-sm mb-3">データの取得に失敗しました。</p>
              <button onClick={fetchDetails} className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold">
                <RefreshCw className="h-3.5 w-3.5" />
                <span>再読み込み</span>
              </button>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center text-slate-500 font-bold text-sm">
              該当する部屋情報が見つかりません。
            </div>
          ) : (
            filteredRooms.map((room) => (
              <Link
                key={room.heya_id}
                href={roomEditPath(room)}
                className="block bg-white rounded-xl border border-slate-200 shadow-sm p-4 active:bg-emerald-50 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-extrabold text-emerald-700 text-base leading-snug">
                      {room.heya_name}号室
                    </div>
                    {property?.bukken_id === 0 && (
                      <div className="text-[11px] text-slate-500 font-bold mt-0.5 truncate">
                        {room.m200_basebukken?.bukken_name}
                      </div>
                    )}
                  </div>
                  <span className={`inline-flex items-center text-xs px-2 py-1 rounded font-extrabold shrink-0 ${statusBadgeClass(room.heya_status ?? ROOM_STATUS.AKISHITSU)}`}>
                    {ROOM_STATUS_LABELS[room.heya_status ?? ROOM_STATUS.AKISHITSU] || '空室'}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">{room.layout || '間取り未設定'}</span>
                  <span className="text-[11px] font-bold text-slate-500">その他費用: {formatMoney(room.other_fee)}円</span>
                </div>

                <div className="mt-2 font-extrabold text-slate-900 text-base whitespace-nowrap">{formatMoney(room.rent)}円</div>
              </Link>
            ))
          )}
        </div>

        {/* 💻 PC用: 明細テーブル */}
        <div className="hidden md:block flex-1 overflow-y-auto overflow-x-auto border border-slate-200 rounded-b-lg min-h-0">
          <table className="w-full text-left border-collapse text-sm min-w-[1100px]">
            <thead className="sticky top-0 z-30 shadow-[0_2px_2px_-1px_rgba(0,0,0,0.05)]">
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-950 font-bold select-none">
                <th
                  onClick={() => handleSort('heya_name')}
                  className="p-0 w-44 sticky left-0 bg-slate-100 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-slate-200 cursor-pointer hover:bg-slate-200 transition group/th"
                >
                  <div className="p-3 flex items-center justify-between">
                    <span>部屋番号 {property?.bukken_id === 0 && '（物件名）'}</span>
                    {renderSortIcon('heya_name')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('heya_status')}
                  className="p-3 w-28 bg-slate-100 cursor-pointer hover:bg-slate-200 transition group/th"
                >
                  <div className="flex items-center justify-between">
                    <span>状態</span>
                    {renderSortIcon('heya_status')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('layout')}
                  className="p-3 w-28 bg-slate-100 cursor-pointer hover:bg-slate-200 transition group/th"
                >
                  <div className="flex items-center justify-between">
                    <span>間取り</span>
                    {renderSortIcon('layout')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('rent')}
                  className="p-3 w-32 bg-slate-100 cursor-pointer hover:bg-slate-200 transition group/th"
                >
                  <div className="flex items-center justify-between">
                    <span>賃料</span>
                    {renderSortIcon('rent')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('other_fee')}
                  className="p-3 w-40 bg-slate-100 cursor-pointer hover:bg-slate-200 transition group/th"
                >
                  <div className="flex items-center justify-between">
                    <span>その他費用</span>
                    {renderSortIcon('other_fee')}
                  </div>
                </th>
                <th className="p-3 w-40 bg-slate-100">保証会社</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                // スケルトン行：テーブル構造を保ったまま読み込み中を表現
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="animate-pulse">
                    <td className="p-3 sticky left-0 bg-white z-20 border-r border-slate-200"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-14" /></td>
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-12" /></td>
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                    <td className="p-3"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                  </tr>
                ))
              ) : loadError ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center bg-slate-50/50">
                    <p className="text-red-600 font-bold mb-3">データの取得に失敗しました。</p>
                    <button
                      onClick={fetchDetails}
                      className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-xs font-bold transition cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>再読み込み</span>
                    </button>
                  </td>
                </tr>
              ) : filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-bold bg-slate-50/50">
                    該当する部屋情報が見つかりません。
                  </td>
                </tr>
              ) : (
                filteredRooms.map((room) => (
                  <tr key={room.heya_id} className="hover:bg-slate-50 transition group">
                    <td className="p-0 font-extrabold text-emerald-700 text-base sticky left-0 bg-white group-hover:bg-slate-50 transition z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-slate-200">
                      <Link
                        href={roomEditPath(room)}
                        className="block p-3 w-full h-full hover:bg-emerald-50 transition underline decoration-2 underline-offset-2"
                      >
                        <div>{room.heya_name}号室</div>
                        {/* 全物件表示の時だけ、部屋番号の下に小さな文字で物件名を出してあげる */}
                        {property?.bukken_id === 0 && (
                          <div className="text-[11px] text-slate-500 font-bold mt-0.5 tracking-tight truncate max-w-[150px]">
                            {room.m200_basebukken?.bukken_name}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded font-extrabold ${statusBadgeClass(room.heya_status ?? ROOM_STATUS.AKISHITSU)}`}>{ROOM_STATUS_LABELS[room.heya_status ?? ROOM_STATUS.AKISHITSU] || '空室'}</span>
                    </td>
                    <td className="p-3 font-bold text-slate-800">{room.layout || '—'}</td>
                       <td className="p-3 font-extrabold text-slate-900">{formatMoney(room.rent)} 円</td>
                       <td className="p-3 font-bold text-slate-800">{formatMoney(room.other_fee)} 円</td>
                       <td className="p-3 font-medium text-slate-800 truncate max-w-[150px]">{room.guarantee_company || '—'}</td>
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

export default function HeyaIchiran() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-slate-800 font-bold">読み込み中...</div>}>
      <HeyaIchiranContent />
    </Suspense>
  );
}
