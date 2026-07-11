'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { ArrowLeft, Save, Loader2, Info, Trash2, FileText, Image as ImageIcon, AlertCircle, DoorOpen } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ROUTES, ROOM_STATUS_LIST } from '../../constants/routes';
import { supabase } from '../../utils/supabase';

// ステータスの型定義を厳密に指定
type RoomStatus = "空室" | "入居中" | "準備中";

// 1. useSearchParams を使用するフォームの本体コンポーネント
function HeyaTourokuForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const propertyId = searchParams.get('property_id');
  const propertyName = searchParams.get('property_name') || '対象物件';
  const roomId = searchParams.get('room_id');

  const isEditMode = !!roomId;

  const [roomNumber, setRoomNumber] = useState('');
  const [status, setStatus] = useState<RoomStatus>(ROOM_STATUS_LIST[0] as RoomStatus);
  const [layout, setLayout] = useState('');
  const [rent, setRent] = useState<number | ''>('');
  const [parkingNumber, setParkingNumber] = useState('');
  const [managementFee, setManagementFee] = useState<number | ''>('');

  const [isEvacuated, setIsEvacuated] = useState(false);
  const [isRepaired, setIsRepaired] = useState(false);
  const [isCleaned, setIsCleaned] = useState(false);

  const [guarantorCompany, setGuarantorCompany] = useState('');
  const [remarks, setRemarks] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode); // 編集時のみ既存データ待ち
  const [errorMsg, setErrorMsg] = useState('');

  const heyaIchiranPath = ROUTES.HEYA_ICHIRAN
    ? `${typeof ROUTES.HEYA_ICHIRAN === 'string' ? ROUTES.HEYA_ICHIRAN : ROUTES.HEYA_ICHIRAN.path}?id=${propertyId}`
    : `/bw0300-heya-ichiran?id=${propertyId}`;

  // 編集モード時の既存データ読み込み
  useEffect(() => {
    if (!isEditMode || !roomId) return;

    async function fetchRoomData() {
      try {
        const { data, error } = await supabase
          .from('M030_Room')
          .select('*')
          .eq('id', roomId)
          .single();

        if (error) throw error;

        if (data) {
          setRoomNumber(data.room_number || '');
          setStatus((data.status as RoomStatus) || '空室');
          setLayout(data.layout || '');
          setRent(data.rent ?? '');
          setManagementFee(data.management_fee ?? '');
          setParkingNumber(data.parking_number || '');
          setIsEvacuated(!!data.is_evacuated);
          setIsRepaired(!!data.is_repaired);
          setIsCleaned(!!data.is_cleaned);
          setGuarantorCompany(data.guarantor_company || '');
          setRemarks(data.remarks || '');
        }
      } catch (err) {
        console.error('部屋データ取得エラー:', err);
        setErrorMsg('部屋データの読み込みに失敗しました。一覧に戻ってやり直してください。');
      } finally {
        setInitialLoading(false);
      }
    }

    fetchRoomData();
  }, [isEditMode, roomId]);

  // 登録・更新処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedRoomNumber = roomNumber.trim();
    if (!trimmedRoomNumber) {
      setErrorMsg('部屋番号を入力してください。');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const roomPayload = {
      bukken_id: Number(propertyId),
      room_number: trimmedRoomNumber,
      status: status,
      layout: layout || null,
      rent: rent === '' ? 0 : Number(rent),
      management_fee: managementFee === '' ? 0 : Number(managementFee),
      parking_number: parkingNumber || null,
      is_evacuated: isEvacuated,
      is_repaired: isRepaired,
      is_cleaned: isCleaned,
      guarantor_company: guarantorCompany || null,
      remarks: remarks || null,
    };

    try {
      if (isEditMode) {
        const { error } = await supabase
          .from('M030_Room')
          .update(roomPayload)
          .eq('id', roomId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('M030_Room')
          .insert([roomPayload]);

        if (error) throw error;
      }

      // 成功時はダイアログを挟まず即一覧へ（結果は一覧で確認できる）
      router.push(heyaIchiranPath);
    } catch (err) {
      console.error('保存エラー:', err);
      // 入力内容は保持したままエラーを画面内に表示（やり直しできる）
      setErrorMsg('データの保存に失敗しました。通信環境を確認して、もう一度お試しください。');
      setIsSubmitting(false);
    }
  };

  // 削除処理
  const handleDelete = async () => {
    if (!isEditMode || !roomId) return;
    if (!confirm(`「${roomNumber}号室」の情報を完全に削除しますか？\n削除したデータは元に戻せません。`)) return;

    setIsDeleting(true);
    setErrorMsg('');

    try {
      const { error } = await supabase
        .from('M030_Room')
        .delete()
        .eq('id', roomId);

      if (error) throw error;

      router.push(heyaIchiranPath);
    } catch (err) {
      console.error('削除エラー:', err);
      setErrorMsg('データの削除に失敗しました。もう一度お試しください。');
      setIsDeleting(false);
    }
  };

  return (
    <main className="p-3 sm:p-6 max-w-4xl mx-auto space-y-3 sm:space-y-6">

      {/* 🏷️ ページヘッダー（スマホでは折り返して縦に積む） */}
      <div className="flex flex-wrap justify-between items-center gap-2 bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <Link href={heyaIchiranPath} className="btn-back" title="部屋一覧に戻る">
            <ArrowLeft className="h-4 w-4" />
            <span>戻る</span>
          </Link>

          <h2 className="text-base sm:text-lg font-extrabold border-l-4 border-emerald-600 pl-2 sm:pl-3 text-slate-950 flex items-center space-x-1.5 whitespace-nowrap">
            <DoorOpen className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{isEditMode ? '部屋情報編集' : '部屋情報登録'}</span>
          </h2>
          <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold truncate max-w-[40vw]">
            {propertyName}
          </span>
        </div>

        {isEditMode && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || isSubmitting || initialLoading}
            className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded text-xs font-bold flex items-center space-x-1 transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{isDeleting ? '削除中...' : 'この部屋を削除'}</span>
          </button>
        )}
      </div>

      {/* エラーバナー（alertの代わりに画面内で通知し、入力を失わせない） */}
      {errorMsg && (
        <div className="flex items-start space-x-2 bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm font-bold">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 📝 入力フォーム領域（編集時は既存データ読み込みが終わるまで薄く表示） */}
      <form
        onSubmit={handleSubmit}
        className={`bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-200 space-y-5 sm:space-y-6 transition-opacity ${initialLoading ? 'opacity-50 pointer-events-none' : ''}`}
      >

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* 部屋番号 */}
          <div>
            <label className="block text-sm font-bold text-slate-950 mb-1.5 flex items-center space-x-1">
              <span>部屋番号</span>
              <span className="text-red-500 text-xs font-extrabold">※必須</span>
            </label>
            <input
              type="text"
              placeholder="例: 101, 202-A"
              required
              className="w-full border-2 border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500 bg-white font-bold text-slate-900 transition"
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
            />
          </div>

          {/* 状態ステータス */}
          <div>
            <label className="block text-sm font-bold text-slate-950 mb-1.5">状態</label>
            <select
              className="w-full border-2 border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500 bg-white font-bold text-slate-900 transition"
              value={status}
              onChange={(e) => setStatus(e.target.value as RoomStatus)}
            >
              {ROOM_STATUS_LIST.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* 間取り */}
          <div>
            <label className="block text-sm font-bold text-slate-950 mb-1.5">間取り</label>
            <input
              type="text"
              placeholder="例: 1K, 2LDK, 店舗"
              className="w-full border-2 border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500 bg-white font-bold text-slate-900 transition"
              value={layout}
              onChange={(e) => setLayout(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* 賃料 */}
          <div>
            <label className="block text-sm font-bold text-slate-950 mb-1.5">賃料（月額）</label>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="例: 55000"
                className="w-full border-2 border-slate-300 rounded pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:border-emerald-500 bg-white font-bold text-right text-slate-900 transition"
                value={rent}
                onChange={(e) => setRent(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">円</span>
            </div>
          </div>

          {/* 管理費・共益費 */}
          <div>
            <label className="block text-sm font-bold text-slate-950 mb-1.5">管理費・共益費</label>
            <div className="relative">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="例: 3000"
                className="w-full border-2 border-slate-300 rounded pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:border-emerald-500 bg-white font-bold text-right text-slate-900 transition"
                value={managementFee}
                onChange={(e) => setManagementFee(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">円</span>
            </div>
          </div>

          {/* 駐車場区画番号 */}
          <div>
            <label className="block text-sm font-bold text-slate-950 mb-1.5">契約駐車場 番号</label>
            <input
              type="text"
              placeholder="例: 5番, なし"
              className="w-full border-2 border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500 bg-white font-bold text-slate-900 transition"
              value={parkingNumber}
              onChange={(e) => setParkingNumber(e.target.value)}
            />
          </div>
        </div>

        {/* 🛠️ 退去・原状回復チェック状況 */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-3 flex items-center space-x-1">
            <Info className="h-3.5 w-3.5 text-slate-400" />
            <span>退去・原状回復 進捗ステータス (空室・準備中用)</span>
          </label>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center space-x-2 cursor-pointer select-none text-sm font-bold text-slate-900">
              <input
                type="checkbox"
                className="h-5 w-5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 accent-emerald-600"
                checked={isEvacuated}
                onChange={(e) => setIsEvacuated(e.target.checked)}
              />
              <span>退去手続き・明渡し完了</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer select-none text-sm font-bold text-slate-900">
              <input
                type="checkbox"
                className="h-5 w-5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 accent-emerald-600"
                checked={isRepaired}
                onChange={(e) => setIsRepaired(e.target.checked)}
              />
              <span>室内修繕・内装工事完了</span>
            </label>

            <label className="flex items-center space-x-2 cursor-pointer select-none text-sm font-bold text-slate-900">
              <input
                type="checkbox"
                className="h-5 w-5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 accent-emerald-600"
                checked={isCleaned}
                onChange={(e) => setIsCleaned(e.target.checked)}
              />
              <span>ハウスクリーニング完了</span>
            </label>
          </div>
        </div>

        {/* 保証会社 */}
        <div>
          <label className="block text-sm font-bold text-slate-950 mb-1.5">利用保証会社</label>
          <input
            type="text"
            placeholder="例: 日本セーフティー、全保連（加入プラン名など）"
            className="w-full border-2 border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500 bg-white font-bold text-slate-900 transition"
            value={guarantorCompany}
            onChange={(e) => setGuarantorCompany(e.target.value)}
          />
        </div>

        {/* 備考欄 */}
        <div>
          <label className="block text-sm font-bold text-slate-950 mb-1.5">部屋特記事項・備考</label>
          <textarea
            rows={3}
            placeholder="例: ペット飼育可条件、エアコン2025年交換済み、日当たり良好など..."
            className="w-full border-2 border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500 bg-white font-medium text-slate-900 transition"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        {/* 📎 添付ファイル管理イメージ（プロトタイプ） */}
        <div className="border-t border-slate-200 pt-4">
          <label className="block text-sm font-bold text-slate-950 mb-2">部屋関連の添付書類・画像</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold flex justify-between items-center group hover:bg-blue-50/50 transition">
              <div className="flex items-center space-x-2 truncate">
                <ImageIcon className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-slate-900 truncate">間取り図_確定版.png</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium shrink-0">1.2 MB</span>
            </div>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold flex justify-between items-center group hover:bg-blue-50/50 transition">
              <div className="flex items-center space-x-2 truncate">
                <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-slate-900 truncate">賃貸借契約特約条項.pdf</span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium shrink-0">420 KB</span>
            </div>
          </div>
          <div className="mt-3 p-3 border-2 border-dashed border-slate-300 rounded text-center text-xs font-bold text-slate-500 bg-slate-50/30 select-none">
            ここにファイルをドラッグ＆ドロップして追加 (開発中項目)
          </div>
        </div>

        {/* 💾 アクションボタン */}
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            type="submit"
            disabled={isSubmitting || isDeleting || initialLoading}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center space-x-1 transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>保存中...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>{isEditMode ? '部屋情報を更新' : '部屋情報を登録'}</span>
              </>
            )}
          </button>
        </div>

      </form>
    </main>
  );
}

// 2. エクスポートするメインのデフォルトコンポーネント。ここでフォーム全体を Suspense でラップする
export default function HeyaTouroku() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="ml-2 text-sm text-slate-600 font-medium">読み込み中...</span>
      </div>
    }>
      <HeyaTourokuForm />
    </Suspense>
  );
}
