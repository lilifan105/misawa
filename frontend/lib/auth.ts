/**
 * 認証モジュール
 * 
 * JWTトークンの管理とAPIリクエストへの付与を行います。
 * セキュリティのため、トークンはsessionStorageに保存します（localStorageは使用しません）。
 */

/**
 * トークンクレーム型定義
 */
export interface TokenClaims {
  'custom:tenant_name': string;
  name: string;
  'custom:role': string;
  sub: string;
  exp: number;
  email?: string;
}

/**
 * 認証マネージャーインターフェース
 */
export interface AuthManager {
  setToken(token: string): void;
  getToken(): string | null;
  clearToken(): void;
  isTokenValid(): boolean;
  getTokenClaims(): TokenClaims | null;
}

/**
 * sessionStorageのキー
 */
const TOKEN_STORAGE_KEY = 'multitenant_jwt_token';

/**
 * Base64URLデコード
 * JWTのペイロードをデコードするためのヘルパー関数
 */
function base64UrlDecode(str: string): string {
  // Base64URL形式をBase64形式に変換
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  
  // パディングを追加
  const pad = base64.length % 4;
  if (pad) {
    if (pad === 1) {
      throw new Error('無効なBase64URL文字列です');
    }
    base64 += new Array(5 - pad).join('=');
  }
  
  // デコード
  try {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch (e) {
    throw new Error('Base64URLデコードに失敗しました');
  }
}

/**
 * JWTトークンからペイロードを抽出（検証なし）
 * 
 * 注意: この関数は署名検証を行いません。
 * 署名検証はバックエンドのLambda Authorizerで行われます。
 */
function parseJwtPayload(token: string): TokenClaims | null {
  try {
    // JWTは "header.payload.signature" の形式
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('無効なJWTトークン形式です');
      return null;
    }
    
    // ペイロード部分をデコード
    const payload = base64UrlDecode(parts[1]);
    return JSON.parse(payload) as TokenClaims;
  } catch (error) {
    console.error('JWTトークンのパースに失敗しました:', error);
    return null;
  }
}

/**
 * 認証マネージャーの実装
 */
class AuthManagerImpl implements AuthManager {
  /**
   * トークンをsessionStorageに保存
   */
  setToken(token: string): void {
    if (typeof window === 'undefined') {
      return; // サーバーサイドでは何もしない
    }
    
    try {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      console.log('トークンを保存しました');
    } catch (error) {
      console.error('トークンの保存に失敗しました:', error);
    }
  }
  
  /**
   * sessionStorageからトークンを取得
   */
  getToken(): string | null {
    if (typeof window === 'undefined') {
      return null; // サーバーサイドではnullを返す
    }
    
    try {
      return sessionStorage.getItem(TOKEN_STORAGE_KEY);
    } catch (error) {
      console.error('トークンの取得に失敗しました:', error);
      return null;
    }
  }
  
  /**
   * sessionStorageからトークンをクリア
   */
  clearToken(): void {
    if (typeof window === 'undefined') {
      return; // サーバーサイドでは何もしない
    }
    
    try {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      console.log('トークンをクリアしました');
    } catch (error) {
      console.error('トークンのクリアに失敗しました:', error);
    }
  }
  
  /**
   * トークンの有効性を確認
   * 
   * 注意: この関数は有効期限のみをチェックします。
   * 署名検証はバックエンドで行われます。
   */
  isTokenValid(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    
    const claims = this.getTokenClaims();
    if (!claims) {
      return false;
    }
    
    // 有効期限をチェック（expはUNIXタイムスタンプ（秒））
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp < now) {
      console.log('トークンの有効期限が切れています');
      return false;
    }
    
    return true;
  }
  
  /**
   * トークンからクレームを抽出（検証なし）
   * 
   * 注意: この関数は署名検証を行いません。
   * 表示目的でのみ使用してください。
   */
  getTokenClaims(): TokenClaims | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }
    
    return parseJwtPayload(token);
  }
}

/**
 * 認証マネージャーのシングルトンインスタンス
 */
export const authManager: AuthManager = new AuthManagerImpl();

/**
 * ブラウザを閉じる時にトークンをクリアするイベントリスナーを設定
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    authManager.clearToken();
  });
}

/**
 * URLパラメータからトークンを取得して保存
 * 
 * マルチテナントサービスからリダイレクトされた際に、
 * URLパラメータ ?token=xxx からトークンを取得します。
 */
export function initializeTokenFromUrl(): void {
  if (typeof window === 'undefined') {
    return; // サーバーサイドでは何もしない
  }
  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      authManager.setToken(token);
      console.log('URLパラメータからトークンを初期化しました');
      
      // URLからトークンパラメータを削除（セキュリティのため）
      urlParams.delete('token');
      const newUrl = window.location.pathname + 
        (urlParams.toString() ? '?' + urlParams.toString() : '') +
        window.location.hash;
      window.history.replaceState({}, '', newUrl);
    }
  } catch (error) {
    console.error('URLからのトークン初期化に失敗しました:', error);
  }
}

/**
 * テナント情報を取得
 * 
 * トークンからテナント名とテナントIDを抽出します。
 */
export function getTenantInfo(): { tenantName: string; username: string; role: string } | null {
  const claims = authManager.getTokenClaims();
  if (!claims) {
    return null;
  }
  
  return {
    tenantName: claims['custom:tenant_name'],
    username: claims.name,
    role: claims['custom:role']
  };
}
