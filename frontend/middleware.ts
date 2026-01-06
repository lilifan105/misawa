import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware
 * 
 * 認証が必要なページへのアクセスを制御します。
 * トークンがない、または無効な場合はアクセス拒否画面にリダイレクトします。
 */

/**
 * デバッグモード（本番環境ではfalseに設定）
 */
const DEBUG_MODE = true;

/**
 * デバッグログ出力
 */
function debugLog(message: string, data?: any) {
  if (DEBUG_MODE) {
    console.log(`[Middleware Debug] ${message}`, data || '');
  }
}

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
function isTokenValid(token: string): { valid: boolean; reason?: string; payload?: any } {
  try {
    debugLog('トークン検証開始');
    
    const parts = token.split('.');
    if (parts.length !== 3) {
      debugLog('トークン形式エラー: パーツ数が3ではない', { parts: parts.length });
      return { valid: false, reason: 'トークン形式が無効です（3パーツ必要）' };
    }
    
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    debugLog('トークンペイロード解析成功', {
      iss: payload.iss,
      sub: payload.sub,
      exp: payload.exp,
      tenant_name: payload.tenant_name,
      'custom:tenant_name': payload['custom:tenant_name'],
      role: payload.role,
      'custom:role': payload['custom:role'],
      email: payload.email,
      name: payload.name
    });
    
    const now = Math.floor(Date.now() / 1000);
    
    // 有効期限をチェック
    if (!payload.exp) {
      debugLog('有効期限なし');
      return { valid: false, reason: '有効期限（exp）が見つかりません', payload };
    }
    
    if (payload.exp < now) {
      const expiredDate = new Date(payload.exp * 1000).toISOString();
      debugLog('トークン期限切れ', { exp: payload.exp, now, expiredDate });
      return { valid: false, reason: `トークンの有効期限が切れています（${expiredDate}）`, payload };
    }
    
    debugLog('有効期限チェックOK', { 
      exp: payload.exp, 
      now, 
      remainingSeconds: payload.exp - now 
    });
    
    // 必須クレームの存在確認
    // マルチテナントサービス形式（tenant_name）とCognito形式（custom:tenant_name）の両方をサポート
    const tenantName = payload['tenant_name'] || payload['custom:tenant_name'];
    const role = payload['role'] || payload['custom:role'];
    
    if (!tenantName) {
      debugLog('テナント名なし', { 
        tenant_name: payload['tenant_name'], 
        'custom:tenant_name': payload['custom:tenant_name'] 
      });
      return { valid: false, reason: 'テナント名（tenant_name または custom:tenant_name）が見つかりません', payload };
    }
    
    if (!payload.sub) {
      debugLog('ユーザーIDなし');
      return { valid: false, reason: 'ユーザーID（sub）が見つかりません', payload };
    }
    
    debugLog('トークン検証成功', { 
      tenantName, 
      role, 
      sub: payload.sub,
      email: payload.email 
    });
    
    return { valid: true, payload };
  } catch (error) {
    debugLog('トークン検証エラー', error);
    console.error('トークン検証エラー:', error);
    return { valid: false, reason: `トークン検証中にエラーが発生しました: ${error}` };
  }
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  debugLog('=== ミドルウェア開始 ===', { 
    pathname, 
    hasSearchParams: searchParams.toString().length > 0 
  });
  
  // 公開パスはスキップ
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    debugLog('公開パスのためスキップ', { pathname });
    return NextResponse.next();
  }
  
  // URLパラメータからトークンを取得
  // OAuth 2.0形式（推奨）
  const accessTokenFromUrl = searchParams.get('access_token');
  const idTokenFromUrl = searchParams.get('id_token');
  
  // レガシー形式
  const tokenFromUrl = searchParams.get('token');
  
  // Cookieからトークンを取得（フォールバック）
  const tokenFromCookie = request.cookies.get('multitenant_jwt_token')?.value;
  
  debugLog('トークン取得状況', {
    hasAccessToken: !!accessTokenFromUrl,
    hasIdToken: !!idTokenFromUrl,
    hasLegacyToken: !!tokenFromUrl,
    hasCookieToken: !!tokenFromCookie,
    accessTokenLength: accessTokenFromUrl?.length,
    idTokenLength: idTokenFromUrl?.length,
    legacyTokenLength: tokenFromUrl?.length,
    cookieTokenLength: tokenFromCookie?.length
  });
  
  // 検証用のトークン（id_tokenまたはレガシートークン）
  const token = idTokenFromUrl || tokenFromUrl || tokenFromCookie;
  
  if (!token) {
    debugLog('トークンなし - アクセス拒否画面にリダイレクト');
    
    // アクセス拒否画面にリダイレクト
    const url = request.nextUrl.clone();
    url.pathname = '/access-denied';
    url.searchParams.set('service', '文書管理システム');
    url.searchParams.set('reason', 'トークンが見つかりません');
    
    return NextResponse.redirect(url);
  }
  
  debugLog('トークン検証実行中...');
  const validationResult = isTokenValid(token);
  
  if (!validationResult.valid) {
    debugLog('トークン検証失敗 - アクセス拒否画面にリダイレクト', {
      reason: validationResult.reason
    });
    
    // アクセス拒否画面にリダイレクト
    const url = request.nextUrl.clone();
    url.pathname = '/access-denied';
    url.searchParams.set('service', '文書管理システム');
    url.searchParams.set('reason', validationResult.reason || 'トークンが無効です');
    
    // トークンがあれば、テナント名を抽出して渡す
    if (validationResult.payload) {
      const tenantName = validationResult.payload['tenant_name'] || validationResult.payload['custom:tenant_name'];
      if (tenantName) {
        url.searchParams.set('tenant', tenantName);
      }
    }
    
    return NextResponse.redirect(url);
  }
  
  debugLog('トークン検証成功 - アクセス許可');
  
  // トークンが有効な場合、Cookieに保存（sessionStorageのフォールバック）
  const response = NextResponse.next();
  const tokenToStore = idTokenFromUrl || tokenFromUrl;
  if (tokenToStore) {
    debugLog('トークンをCookieに保存', { tokenLength: tokenToStore.length });
    response.cookies.set('multitenant_jwt_token', tokenToStore, {
      httpOnly: false, // クライアントサイドからもアクセス可能
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24時間
    });
  }
  
  debugLog('=== ミドルウェア終了（アクセス許可） ===');
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
