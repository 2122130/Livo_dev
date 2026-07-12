import { createClient } from '@supabase/supabase-js';
// ↓ 自動生成された型定義ファイルをインポート（パスは環境に合わせて調整してください）
import { Database } from '../types/supabase'; 

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// ↓ createClient の後ろに <Database> を追加します
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);