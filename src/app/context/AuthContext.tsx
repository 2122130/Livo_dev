'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

// ユーザー情報の型定義
interface AuthUser {
  login_id: string;
  account_name: string;
  soshiki_id: number;
  kengen_kbn: number;
}

// 🌟 ここに login を追加
interface AuthContextType {
  user: AuthUser | null;
  login: (userInfo: AuthUser) => void; 
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const soshikiId = localStorage.getItem('soshiki_id');
    const loginId = localStorage.getItem('login_id');
    const accountName = localStorage.getItem('account_name');
    const kengenKbn = localStorage.getItem('kengen_kbn');

    if (soshikiId && loginId && accountName && kengenKbn) {
      setUser({
        login_id: loginId,
        account_name: accountName,
        soshiki_id: Number(soshikiId),
        kengen_kbn: Number(kengenKbn),
      });
    }
  }, []);

  // 🌟 login 関数の実装
  const login = (userInfo: AuthUser) => {
    console.log("🌟 AuthContext: login関数が呼ばれました！", userInfo); // これが出るか確認
    localStorage.setItem('login_id', userInfo.login_id);
    localStorage.setItem('account_name', userInfo.account_name);
    localStorage.setItem('soshiki_id', userInfo.soshiki_id.toString());
    localStorage.setItem('kengen_kbn', userInfo.kengen_kbn.toString());
    setUser(userInfo); // これでステートが変わるはず
  };

  const logout = () => {
    setUser(null);
    localStorage.clear();
    document.cookie = "sb-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = '/bw0001-login';
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}