import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware
 * 
 * 認証が必要なページへのアクセスを制御します。
 * トークンがない、または無効な場合はアクセス拒否画面にリダイレクトします。
 */

/**
 * 認証が不要なパス（公開ページ）
 */
const PUBLIC_PATHS = [
  '/access-denied',
  '/_next',
  '/favicon.ico',
  '/icon',
  '/apple-icon.png',
];

/**
 * Base64URLデコード
 */
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) {
      throw new Error('無効なBase64URL文字列です');
    }
    base64 += new Array(5 - pad).join('=');
  }
  
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * JWTトークンの有効性を確認（簡易版）
 */
function isTokenValid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }
    
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    
    // 有効期限をチェック
    if (!payload.exp || payload.exp < now) {
      return false;
    }
    
    // 必須クレームの存在確認
    if (!payload['custom:tenant_name'] || !payload.sub) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('トークン検証エラー:', error);
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // 公開パスはスキップ
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  // URLパラメータからトークンを取得
  const tokenFromUrl = searchParams.get('token');
  
  // Cookieからトークンを取得（フォールバック）
  const tokenFromCookie = request.cookies.get('multitenant_jwt_token')?.value;
  
  const token = tokenFromUrl || tokenFromCookie;
  
  // トークンがない、または無効な場合
  if (!token || !isTokenValid(token)) {
    // アクセス拒否画面にリダイレクト
    const url = request.nextUrl.clone();
    url.pathname = '/access-denied';
    url.searchParams.set('service', '文書管理システム');
    
    // トークンがあれば、テナント名を抽出して渡す
    if (token) {
      try {
        const parts = token.split('.');
        const payload = JSON.parse(base64UrlDecode(parts[1]));
        if (payload['custom:tenant_name']) {
          url.searchParams.set('tenant', payload['custom:tenant_name']);
        }
      } catch (error) {
        // エラーは無視
      }
    }
    
    return NextResponse.redirect(url);
  }
  
  // トークンが有効な場合、Cookieに保存（sessionStorageのフォールバック）
  const response = NextResponse.next();
  if (tokenFromUrl) {
    response.cookies.set('multitenant_jwt_token', tokenFromUrl, {
      httpOnly: false, // クライアントサイドからもアクセス可能
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24時間
    });
  }
  
  return response;
}

/**
 * ミドルウェアを適用するパスの設定
 */
export const config = {
  matcher: [
    /*
     * 以下を除くすべてのパスにマッチ:
     * - api (APIルート)
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化ファイル)
     * - favicon.ico (ファビコン)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
