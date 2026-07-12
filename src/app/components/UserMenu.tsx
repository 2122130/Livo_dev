'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { User, LogOut, ChevronDown } from 'lucide-react';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  console.log("現在のUser情報:", user);//tmp

  // ログイン画面の時、またはユーザー情報がない時は何も表示しない
  if (pathname === '/bw0001-login' || !user) return null;

  return (
    <div className="relative ml-auto select-none">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-emerald-800/60 hover:bg-emerald-800 border border-emerald-600/30 px-3 py-1.5 rounded-lg text-left transition cursor-pointer text-white"
      >
        <div className="bg-emerald-600 p-1 rounded-full text-emerald-100">
          <User className="h-3.5 w-3.5" />
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-extrabold leading-none">{user.account_name}</p>
          <p className="text-[10px] text-emerald-200 font-bold mt-0.5">
            {user.kengen_kbn === 1 ? '管理者' : '一般'}
          </p>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-emerald-200 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-md py-1 z-20 text-slate-950">
            <div className="px-3 py-2 border-b border-slate-100 sm:hidden">
              <p className="text-xs font-extrabold text-slate-900">{user.account_name}</p>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                {user.kengen_kbn === 1 ? '管理者' : '一般'}
              </p>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center space-x-2 transition cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>ログアウト</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}