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
const ACCESS_TOKEN_STORAGE_KEY = 'multitenant_access_token';
const ID_TOKEN_STORAGE_KEY = 'multitenant_id_token';

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
   * トークンをsessionStorageとCookieに保存
   */
  setToken(token: string): void {
    if (typeof window === 'undefined') {
      return; // サーバーサイドでは何もしない
    }
    
    try {
      // sessionStorageに保存
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      
      // Cookieにも保存（ミドルウェアで使用）
      document.cookie = `${TOKEN_STORAGE_KEY}=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
      
      console.log('トークンを保存しました');
    } catch (error) {
      console.error('トークンの保存に失敗しました:', error);
    }
  }
  
  /**
   * sessionStorageまたはCookieからトークンを取得
   */
  getToken(): string | null {
    if (typeof window === 'undefined') {
      return null; // サーバーサイドではnullを返す
    }
    
    try {
      // まずsessionStorageから取得
      let token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
      
      // sessionStorageになければCookieから取得
      if (!token) {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === TOKEN_STORAGE_KEY) {
            token = value;
            // sessionStorageにも保存
            sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
            break;
          }
        }
      }
      
      return token;
    } catch (error) {
      console.error('トークンの取得に失敗しました:', error);
      return null;
    }
  }
  
  /**
   * sessionStorageとCookieからトークンをクリア
   */
  clearToken(): void {
    if (typeof window === 'undefined') {
      return; // サーバーサイドでは何もしない
    }
    
    try {
      // sessionStorageからクリア
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      
      // Cookieからクリア
      document.cookie = `${TOKEN_STORAGE_KEY}=; path=/; max-age=0`;
      
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
 * URLパラメータからトークンを取得します。
 * 
 * サポートされるパラメータ:
 * - ?token=xxx (レガシー形式)
 * - ?access_token=xxx&id_token=yyy (OAuth 2.0形式 - 推奨)
 */
export function initializeTokenFromUrl(): void {
  if (typeof window === 'undefined') {
    return; // サーバーサイドでは何もしない
  }
  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    
    // OAuth 2.0形式のトークン（推奨）
    const accessToken = urlParams.get('access_token');
    const idToken = urlParams.get('id_token');
    
    // レガシー形式のトークン
    const legacyToken = urlParams.get('token');
    
    if (accessToken && idToken) {
      // OAuth 2.0形式: access_tokenとid_tokenの両方を保存
      sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
      sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, idToken);
      
      // id_tokenをメイントークンとして保存（ユーザー情報取得用）
      authManager.setToken(idToken);
      
      console.log('OAuth 2.0トークンを初期化しました');
      
      // URLからトークンパラメータを削除（セキュリティのため）
      urlParams.delete('access_token');
      urlParams.delete('id_token');
    } else if (legacyToken) {
      // レガシー形式: 単一のトークン
      authManager.setToken(legacyToken);
      console.log('レガシートークンを初期化しました');
      
      // URLからトークンパラメータを削除（セキュリティのため）
      urlParams.delete('token');
    }
    
    // URLを更新（トークンパラメータを削除）
    if (accessToken || idToken || legacyToken) {
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
 * アクセストークンを取得
 * 
 * 注意: Cognitoのカスタム属性はIDトークンにのみ含まれるため、
 * API呼び出しにはgetIdToken()を使用してください。
 * この関数は将来の拡張用に残しています。
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    // OAuth 2.0形式のaccess_tokenを優先
    const accessToken = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (accessToken) {
      return accessToken;
    }
    
    // フォールバック: レガシー形式のトークン
    return authManager.getToken();
  } catch (error) {
    console.error('アクセストークンの取得に失敗しました:', error);
    return null;
  }
}

/**
 * IDトークンを取得
 * 
 * ユーザー情報取得とAPI呼び出しに使用するIDトークンを取得します。
 * 
 * 重要: Cognitoのカスタム属性（custom:tenant_name、custom:role）は
 * IDトークンにのみ含まれます。アクセストークンには含まれません。
 * そのため、API呼び出しにはこのIDトークンを使用する必要があります。
 */
export function getIdToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    // OAuth 2.0形式のid_tokenを優先
    const idToken = sessionStorage.getItem(ID_TOKEN_STORAGE_KEY);
    if (idToken) {
      return idToken;
    }
    
    // フォールバック: レガシー形式のトークン
    return authManager.getToken();
  } catch (error) {
    console.error('IDトークンの取得に失敗しました:', error);
    return null;
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
