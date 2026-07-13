'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { ArrowLeft, Save, Loader2, AlertCircle, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROUTES, PROPERTY_TYPES, PROPERTY_TYPE_LABELS, KANRI_KBN, KANRI_KBN_LABELS } from '../../constants/index';
import { supabase } from '../../utils/supabase';

// useSearchParams を使うためフォーム本体を分離（Suspenseでラップする）
function BukkenTourokuForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id'); // ?id= があれば編集モード
  const isEditMode = !!editId;

  const [name, setName] = useState('');
  const [type, setType] = useState<string>(PROPERTY_TYPES.MANSION.toString());
  const [address, setAddress] = useState('');
  const [managementType, setManagementType] = useState<string>(KANRI_KBN.JISHA.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode); // 編集時のみ既存データ待ち
  const [errorMsg, setErrorMsg] = useState('');

  // 編集モード時の既存データ読み込み
  useEffect(() => {
    if (!isEditMode || !editId) return;

    async function fetchBukken() {
      try {
        const { data, error } = await supabase
          .from('m200_basebukken')
          .select('*')
          .eq('bukken_id', Number(editId))
          .single();

        if (error) throw error;

        if (data) {
          setName(data.bukken_name || '');
          setType(data.bukken_type?.toString() || PROPERTY_TYPES.MANSION.toString());
          setAddress(data.address || '');
          setManagementType(data.kanri_kbn?.toString() || KANRI_KBN.JISHA.toString());
        }
      } catch (err) {
        console.error('物件データ取得エラー:', err);
        setErrorMsg('物件データの読み込みに失敗しました。一覧に戻ってやり直してください。');
      } finally {
        setInitialLoading(false);
      }
    }

    fetchBukken();
  }, [isEditMode, editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('物件名を入力してください。');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const payload = {
      soshiki_id: 1,           // 適切な組織IDを設定してください
      bukken_id: Number(Date.now().toString().slice(-6)), // 適切なID
      bukken_name: name.trim(),
      bukken_type: Number(type),      // ここを確実に数値に変換
      kanri_kbn: Number(managementType), // ここを確実に数値に変換
      address: address.trim(),
    };

    try {
      if (isEditMode) {
        const { error } = await supabase
          .from('m200_basebukken')
          .update(payload)
          .eq('bukken_id', Number(editId));
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('m200_basebukken')
          .insert([payload]);
        if (error) throw error;
      }

      // 成功時はダイアログを挟まず即一覧へ（結果は一覧で確認できる）
      router.push(ROUTES.BUKKEN_ICHIRAN.path);
      router.refresh();

    } catch (error) {
      console.error('物件保存エラー:', error);
      // 入力内容は保持したままエラーを画面内に表示（やり直しできる）
      setErrorMsg('保存に失敗しました。通信環境を確認して、もう一度お試しください。');
      setIsSubmitting(false);
    }
  };

  // 削除処理の追加
  const handleDelete = async () => {
    if (!confirm('この物件を削除しますか？\n（紐づく情報も非表示になります）')) return;

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const { error } = await supabase
        .from('m200_basebukken')
        .update({ mukou_kbn: 0 }) // 論理削除：mukou_kbnを0にする
        .eq('bukken_id', Number(editId));
      
      if (error) throw error;

      router.push(ROUTES.BUKKEN_ICHIRAN.path);
      router.refresh();
    } catch (error) {
      console.error('物件削除エラー:', error);
      setErrorMsg('削除に失敗しました。');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="p-3 sm:p-6 max-w-3xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">

        <div className="flex items-center space-x-2 sm:space-x-4 mb-6">
          <Link href={ROUTES.BUKKEN_ICHIRAN.path} className="btn-back">
            <ArrowLeft className="h-4 w-4" />
            <span>戻る</span>
          </Link>
          <h2 className="text-base sm:text-xl font-extrabold border-l-4 border-emerald-600 pl-2 sm:pl-3 text-slate-950 flex items-center space-x-1.5 min-w-0">
            <Building2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="truncate">{isEditMode ? '物件情報編集' : '新規物件登録'}</span>
          </h2>
        </div>

        {/* エラーバナー（alertの代わりに画面内で通知し、入力を失わせない） */}
        {errorMsg && (
          <div className="mb-5 flex items-start space-x-2 bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm font-bold">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 編集時は既存データ読み込みが終わるまで薄く表示 */}
        <form onSubmit={handleSubmit} className={`space-y-5 transition-opacity ${initialLoading ? 'opacity-50 pointer-events-none animate-pulse' : ''}`}>

          {/* 物件名 */}
          <div>
            <label className="block text-sm font-bold text-slate-950 mb-1.5">
              物件名 <span className="text-red-600 text-xs font-extrabold">※必須</span>
            </label>
            <input
              type="text"
              required
              autoFocus={!isEditMode}
              placeholder="例: コーポ・サザンクロス"
              className="w-full border-2 border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 bg-white font-bold text-slate-900 transition"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* 種別 */}
          <div>
            <label className="block text-sm font-bold text-slate-950 mb-1.5">物件種別</label>
            <select
              className="w-full border-2 border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 bg-white font-bold text-slate-900 transition"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {Object.entries(PROPERTY_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 管理区分 */}
          <div>
            <label className="block text-sm font-bold text-slate-950 mb-1.5">管理区分</label>
            <select
              className="w-full border-2 border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 bg-white font-bold text-slate-900 transition"
              value={managementType}
              onChange={(e) => setManagementType(e.target.value)}
            >
              {Object.entries(KANRI_KBN_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 所在地 */}
          <div>
            <label className="block text-sm font-bold text-slate-950 mb-1.5">所在地</label>
            <input
              type="text"
              placeholder="例: 東京都渋谷区..."
              className="w-full border-2 border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 bg-white font-bold text-slate-900 transition"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-200">
            {/* 削除ボタン（編集時のみ表示） */}
            {isEditMode && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="bg-red-50 hover:bg-red-100 text-red-600 px-5 py-2.5 rounded-lg text-sm font-bold border border-red-200 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                削除
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting || initialLoading}
              className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center space-x-1 transition shadow-sm cursor-pointer disabled:opacity-50 ml-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>処理中...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{isEditMode ? 'この内容で更新する' : 'この内容で登録する'}</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </main>
  );
}

// クエリパラメータを安全に扱うためのSuspenseラップ
export default function BukkenTouroku() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-slate-800 font-bold">画面を読み込み中...</div>}>
      <BukkenTourokuForm />
    </Suspense>
  );
}
