'use client';

/**
 * 認証初期化コンポーネント
 * 
 * URLパラメータからトークンを取得してsessionStorageに保存します。
 * ブラウザを閉じる時にトークンをクリアします。
 */

import { useEffect } from 'react';
import { initializeTokenFromUrl } from '@/lib/auth';

export function AuthInitializer() {
  useEffect(() => {
    // URLパラメータからトークンを初期化
    initializeTokenFromUrl();
  }, []);
  
  return null; // このコンポーネントは何もレンダリングしません
}
