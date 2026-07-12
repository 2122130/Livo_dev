'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, ClipboardList, Calendar, User, Building2, HelpCircle, Tag, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { ROUTES, TAIOU_STATUS, TAIOU_CATEGORY } from '../../constants/index';
import { supabase } from '../../utils/supabase';

// Supabase helper for legacy table names that are not present in the generated Database schema types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabaseAny = supabase as unknown as { from: (relation: string) => any };

function TaiouTourokuForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id'); // クエリパラメータからIDを取得（あれば編集モード）

  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // マスター選択肢用
  const [bukkenOptions, setBukkenOptions] = useState<{ id: number; name: string }[]>([]);
  const [roomOptions, setRoomOptions] = useState<{ id: number; bukken_id: number; room_number: string }[]>([]);

  // フォームの状態（リテラル型エラー対策として `as string` で汎用的な string 型へと拡張）
  const [formData, setFormData] = useState({
    bukken_id: '',
    room_id: '',
    uketsuke_date: new Date().toISOString().split('T')[0], // 初期値は今日の日付
    category: 0,
    status: 0,
    title: '',
    detail: '',
    completion_date: '',
    uketsukesha: '',
    iraisha: '',
    tantousha: '',
    bokou: ''
  });

  const filteredRoomOptions = useMemo(() => {
    if (!formData.bukken_id) {
      return [];
    }
    return roomOptions
      .filter((room) => room.bukken_id === Number(formData.bukken_id))
      .map(({ id, room_number }) => ({ id, room_number }));
  }, [formData.bukken_id, roomOptions]);

  // 1. 物件・部屋マスターの読み込み ＆ 編集時の初期データ取得
  useEffect(() => {
    async function initForm() {
      setLoading(true);
      try {
        // マスターデータ取得
        const [bukkenRes, roomRes] = await Promise.all([
          supabaseAny.from('M020_Bukken').select('id, name').order('id'),
          supabaseAny.from('M030_Room').select('id, bukken_id, room_number').order('room_number')
        ]);

        if (bukkenRes.data) setBukkenOptions(bukkenRes.data);
        if (roomRes.data) setRoomOptions(roomRes.data);

        // 編集モードの場合は既存データをロード
        if (editId) {
          const { data: histData, error } = await supabaseAny
            .from('T010_TaiouHist')
            .select('*')
            .eq('id', editId)
            .single();

          if (error) throw error;

          if (histData) {
            setFormData({
              bukken_id: histData.bukken_id?.toString() || '',
              room_id: histData.room_id?.toString() || '',
              uketsuke_date: histData.uketsuke_date || '',
              category: histData.category || TAIOU_CATEGORY.SHUZEN,
              status: histData.status || TAIOU_STATUS.MITAIOU,
              title: histData.title || '',
              detail: histData.detail || '',
              completion_date: histData.completion_date || '',
              uketsukesha: histData.uketsukesha || '',
              iraisha: histData.iraisha || '',
              tantousha: histData.tantousha || '',
              bokou: histData.bokou || ''
            });
          }
        }
      } catch (err) {
        console.error('初期化エラー:', err);
        setErrorMsg('マスターデータの取得または対応履歴の読み込みに失敗しました。一覧に戻ってやり直してください。');
      } finally {
        setLoading(false);
      }
    }
    initForm();
  }, [editId]);

  // 2. 物件が選択されたら、紐づく部屋の選択肢を自動フィルター
  const handleBukkenChange = (bukkenId: string) => {
    const filtered = roomOptions.filter((room) => room.bukken_id === Number(bukkenId));
    setFormData((prev) => ({
      ...prev,
      bukken_id: bukkenId,
      room_id: filtered.some((room) => room.id === Number(prev.room_id)) ? prev.room_id : ''
    }));
  };

  // 状況が「完了」になったら完了日を今日にする、それ以外ならクリアする補助
  const handleStatusChange = (statusValue: string) => {
    setFormData(prev => ({
      ...prev,
      status: statusValue,
      completion_date: statusValue === '完了' && !prev.completion_date
        ? new Date().toISOString().split('T')[0]
        : statusValue !== '完了' ? '' : prev.completion_date
    }));
  };

  // 3. 保存処理 (インサート / アップデート)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLoading) return;

    if (!formData.bukken_id || !formData.title.trim() || !formData.detail.trim()) {
      setErrorMsg('物件、対応内容・件名、詳細内容は必須入力です。');
      return;
    }

    setSaveLoading(true);
    setErrorMsg('');
    try {
      const payload = {
        bukken_id: Number(formData.bukken_id),
        room_id: formData.room_id ? Number(formData.room_id) : null, // 空欄なら共用部(NULL)
        uketsuke_date: formData.uketsuke_date,
        category: formData.category,
        status: formData.status,
        title: formData.title.trim(),
        detail: formData.detail.trim(),
        completion_date: formData.completion_date || null,
        uketsukesha: formData.uketsukesha || null,
        iraisha: formData.iraisha || null,
        tantousha: formData.tantousha || null,
        bokou: formData.bokou || null
      };

      if (editId) {
        // 編集更新
        const { error } = await supabaseAny
          .from('T010_TaiouHist')
          .update(payload)
          .eq('id', editId);
        if (error) throw error;
      } else {
        // 新規登録
        const { error } = await supabaseAny
          .from('T010_TaiouHist')
          .insert([payload]);
        if (error) throw error;
      }

      // 成功時はダイアログを挟まず即一覧へ（結果は一覧で確認できる）
      router.push(ROUTES.TAIOU_ICHIRAN.path);
      router.refresh();
    } catch (err) {
      console.error('保存エラー:', err);
      // 入力内容は保持したままエラーを画面内に表示（やり直しできる）
      setErrorMsg('データの保存に失敗しました。通信環境を確認して、もう一度お試しください。');
      setSaveLoading(false);
    }
  };

  return (
    <main className="p-3 sm:p-6 max-w-4xl mx-auto flex flex-col space-y-3 sm:space-y-4">

      {/* 🏷️ ページヘッダー（戻る・保存は読み込み中でも見える位置に固定。スマホでは折り返す） */}
      <div className="flex flex-wrap justify-between items-center gap-2 bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <Link href={ROUTES.TAIOU_ICHIRAN.path} className="btn-back">
            <ArrowLeft className="h-4 w-4" />
            <span>戻る</span>
          </Link>
          <h2 className="text-base sm:text-lg font-extrabold border-l-4 border-emerald-600 pl-2 sm:pl-3 text-slate-950 flex items-center space-x-1.5 sm:space-x-2 min-w-0">
            <ClipboardList className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="truncate">{editId ? '対応履歴の編集・詳細' : '新規対応履歴登録'}</span>
          </h2>
        </div>

        {/* form属性で下のフォームと紐づけ、ブラウザの必須チェックも効かせる */}
        <button
          type="submit"
          form="taiou-form"
          disabled={saveLoading || loading}
          className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-emerald-400 text-white px-5 py-2.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition shadow-sm cursor-pointer"
        >
          {saveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{saveLoading ? '保存中...' : '登録・保存'}</span>
        </button>
      </div>

      {/* エラーバナー（alertの代わりに画面内で通知し、入力を失わせない） */}
      {errorMsg && (
        <div className="flex items-start space-x-2 bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm font-bold">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 📝 登録・編集フォーム（読み込み中は薄く表示して構造を先に見せる） */}
      <form
        id="taiou-form"
        onSubmit={handleSave}
        className={`bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6 space-y-5 sm:space-y-6 transition-opacity ${loading ? 'opacity-50 pointer-events-none animate-pulse' : ''}`}
      >

        {/* セクション①: 対象物件情報 */}
        <div>
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-1 mb-4 pb-2 border-b border-slate-100">
            <Building2 className="h-4 w-4 text-emerald-600" />
            <span>対象物件・区画設定</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">対象物件 <span className="text-red-500">*</span></label>
              <select
                required
                value={formData.bukken_id}
                onChange={(e) => handleBukkenChange(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-950 font-bold focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="">-- 物件を選択してください --</option>
                {bukkenOptions.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">対象部屋番号</label>
              <select
                disabled={!formData.bukken_id}
                value={formData.room_id}
                onChange={(e) => setFormData(prev => ({ ...prev, room_id: e.target.value }))}
                className="w-full px-3 py-1.5 bg-white disabled:bg-slate-50 border border-slate-300 rounded text-sm text-slate-950 font-bold focus:outline-none focus:border-emerald-500 transition"
              >
                <option value="">共用部（特定の部屋ではない）</option>
                {filteredRoomOptions.map(r => (
                  <option key={r.id} value={r.id}>{r.room_number}号室</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* セクション②: 受付情報 */}
        <div>
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-1 mb-4 pb-2 border-b border-slate-100">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <span>受付・担当者情報</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">受付日付 <span className="text-red-500">*</span></label>
              <input
                type="date"
                required
                value={formData.uketsuke_date}
                onChange={(e) => setFormData(prev => ({ ...prev, uketsuke_date: e.target.value }))}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-950 font-medium focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">窓口受付者</label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="例: 管理太郎"
                  value={formData.uketsukesha}
                  onChange={(e) => setFormData(prev => ({ ...prev, uketsukesha: e.target.value }))}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-950 font-medium focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">第一申告・依頼者</label>
              <input
                type="text"
                placeholder="例: 入居者（田中様）、近隣住民"
                value={formData.iraisha}
                onChange={(e) => setFormData(prev => ({ ...prev, iraisha: e.target.value }))}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-950 font-medium focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
        </div>

        {/* セクション③: 進捗状況・分類 */}
        <div>
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-1 mb-4 pb-2 border-b border-slate-100">
            <Tag className="h-4 w-4 text-emerald-600" />
            <span>対応ステータス・区分</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">対応カテゴリ区分</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-950 font-bold focus:outline-none focus:border-emerald-500 transition"
              >
                {Object.values(TAIOU_CATEGORY).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">現在の対応状況（進捗）</label>
              <select
                value={formData.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-950 font-bold focus:outline-none focus:border-emerald-500 transition"
              >
                {Object.values(TAIOU_STATUS).map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">対応完了日</label>
              <input
                type="date"
                disabled={formData.status !== '完了'}
                value={formData.completion_date}
                onChange={(e) => setFormData(prev => ({ ...prev, completion_date: e.target.value }))}
                className="w-full px-3 py-1.5 bg-white disabled:bg-slate-50 border border-slate-300 rounded text-sm text-slate-950 font-medium focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
        </div>

        {/* セクション④: 詳細内容 */}
        <div>
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-1 mb-4 pb-2 border-b border-slate-100">
            <HelpCircle className="h-4 w-4 text-emerald-600" />
            <span>詳細対応内容</span>
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">対応内容・件名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="例: 浴室換気扇から異音、エアコン不具合など短く簡潔に"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-950 font-medium focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-900 mb-1">詳細内容・経過状況 <span className="text-red-500">*</span></label>
              <textarea
                rows={5}
                required
                placeholder="トラブルの具体的な状況、手配した業者、入居者への案内履歴など時系列で詳しく記入してください。"
                value={formData.detail}
                onChange={(e) => setFormData(prev => ({ ...prev, detail: e.target.value }))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded text-sm text-slate-950 font-medium focus:outline-none focus:border-emerald-500 transition leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* セクション⑤: 社内担当・備考 */}
        <div>
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center space-x-1 mb-4 pb-2 border-b border-slate-100">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span>社内担当・備考</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-900 mb-1">社内メイン担当者</label>
              <div className="relative">
                <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-emerald-600" />
                <input
                  type="text"
                  placeholder="例: 対応次郎"
                  value={formData.tantousha}
                  onChange={(e) => setFormData(prev => ({ ...prev, tantousha: e.target.value }))}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-950 font-medium focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-900 mb-1">備考・引き継ぎ事項</label>
              <input
                type="text"
                placeholder="例: 費用はオーナー負担確認済み、次回巡回時に確認など"
                value={formData.bokou}
                onChange={(e) => setFormData(prev => ({ ...prev, bokou: e.target.value }))}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-950 font-medium focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>
        </div>

        {/* 💾 フォーム末尾にも保存ボタン（長いフォームでスクロールを戻させない） */}
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button
            type="submit"
            disabled={saveLoading || loading}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:bg-emerald-400 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center space-x-1.5 transition shadow-sm cursor-pointer"
          >
            {saveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{saveLoading ? '保存中...' : editId ? 'この内容で更新する' : 'この内容で登録する'}</span>
          </button>
        </div>

      </form>
    </main>
  );
}

// クエリパラメータを安全に扱うためのSuspenseラップ
export default function TaiouTouroku() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-slate-800 font-bold">画面を読み込み中...</div>}>
      <TaiouTourokuForm />
    </Suspense>
  );
}
