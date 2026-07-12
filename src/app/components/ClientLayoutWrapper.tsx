'use client';

import React from 'react';
import { AuthProvider } from '../context/AuthContext';

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}