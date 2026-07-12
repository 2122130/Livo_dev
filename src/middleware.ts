import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 1. クッキーやセッションからログイン状態（トークンなど）を取得
  // ※ここでは仮に 'sb-auth-token' という名前のクッキーの有無で判定しています
  // 実際のSupabase Auth実装時は `createMiddlewareClient` を使ってセッションチェックを行います
  const token = request.cookies.get('sb-auth-token')?.value;
  
  const { pathname } = request.nextUrl;

  // 2. 未ログイン状態で、ログイン画面（/bw0001-login）以外にアクセスしようとした場合
  if (!token && pathname !== '/bw0001-login') {
    // ログイン画面へ強制リダイレクト
    const loginUrl = new URL('/bw0001-login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 3. ログイン済みなのに、ログイン画面（/bw0001-login）にアクセスしようとした場合
  if (token && pathname === '/bw0001-login') {
    // メインメニュー（ / ）へリダイレクト
    const mainMenuUrl = new URL('/', request.url);
    return NextResponse.redirect(mainMenuUrl);
  }

  return NextResponse.next();
}

// 4. ミドルウェアを適用するルートを指定（静的ファイルやAPIなどを除外）
export const config = {
  matcher: [
    /*
     * 次のパスを除くすべてのリクエストパスにマッチさせます:
     * - api (APIルート)
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化ファイル)
     * - favicon.ico (ファビコン)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};