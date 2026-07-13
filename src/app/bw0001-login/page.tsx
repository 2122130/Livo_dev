'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { ROUTES } from '../../constants/index';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../context/AuthContext'; 


export default function Login() {
  const router = useRouter();
  const { login } = useAuth(); 
  
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const loginButtonRef = useRef<HTMLButtonElement>(null);

  // 型定義を追加
  interface LoginResult {
    login_id: string;
    account_name: string;
    soshiki_id: number;
    kengen_kbn: number;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      // RPC関数を呼び出し
      const { data, error } = await supabase
        .rpc('x100_login_check' as any, {
            p_login_id: loginId,
            p_password: password
        });

      if (error) throw error;

      if (!data || data.length === 0) {
        setErrorMsg('ログインIDまたはパスワードが正しくありません。');
        setLoading(false);
        return;
      }

      const matchedAccount = data[0];
      console.log("ログイン成功、データ:", matchedAccount); //tmp

      // 認証用Cookieをセット
      document.cookie = "sb-auth-token=dummy-session-active; path=/; max-age=86400";

      // 🌟 AuthContext を通じてログイン情報を保存（これでメインメニューと同期される）
      login({
        login_id: matchedAccount.login_id,
        account_name: matchedAccount.account_name,
        soshiki_id: matchedAccount.soshiki_id,
        kengen_kbn: matchedAccount.kengen_kbn
      });

      router.push(ROUTES.MAIN_MENU.path);
      
    } catch (err) {
      console.error('ログイン処理エラー:', err);
      setErrorMsg('サーバーとの通信に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-slate-200 p-6 sm:p-8 space-y-6">
        
        <div className="text-center space-y-2 select-none">
          <div className="inline-flex items-center justify-center bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-100 mb-2">
            <Building2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-950 tracking-tight">
            賃貸管理システム
          </h2>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-600 rounded-lg p-3 text-xs font-bold flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1">ログインID</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    passwordInputRef.current?.focus();
                  }
                }}
                className="w-full pl-9 py-2.5 bg-white border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1">パスワード</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    loginButtonRef.current?.focus();
                  }
                }}
                className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-lg text-sm"
              />
              {/* 🌟 パスワード表示切替ボタン */}
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <button
            ref={loginButtonRef}
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg text-sm font-bold transition"
          >
            {loading ? "処理中..." : "ログイン"}
          </button>
        </form>
      </div>
    </main>
  );
}