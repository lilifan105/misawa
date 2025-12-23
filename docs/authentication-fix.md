# 認証チェック修正ドキュメント

## 問題

メイン画面にアクセス時に、認証が通っていなくても表示されてしまい、デフォルトのアクセス権がないという画面に遷移しない問題がありました。

## 原因

1. **Next.jsミドルウェアが存在しない**: サーバーサイドでの認証チェックが行われていませんでした
2. **AuthInitializerが認証チェックを行わない**: トークンの初期化のみで、有効性チェックとリダイレクトが実装されていませんでした
3. **sessionStorageのみの使用**: ミドルウェアはサーバーサイドで動作するため、sessionStorageにアクセスできませんでした

## 実装した修正

### 1. Next.jsミドルウェアの追加 (`frontend/middleware.ts`)

**機能:**
- すべてのページアクセス時に認証チェックを実行
- トークンの有効性を検証（有効期限、必須クレームの確認）
- 無効な場合は `/access-denied` にリダイレクト
- URLパラメータのトークンをCookieに保存

**主要な処理:**
```typescript
// トークンの取得（URLパラメータまたはCookie）
const tokenFromUrl = searchParams.get('token');
const tokenFromCookie = request.cookies.get('multitenant_jwt_token')?.value;
const token = tokenFromUrl || tokenFromCookie;

// トークン検証
if (!token || !isTokenValid(token)) {
  // アクセス拒否画面にリダイレクト
  return NextResponse.redirect('/access-denied');
}
```

**公開パス（認証不要）:**
- `/access-denied` - アクセス拒否画面
- `/_next` - Next.jsの内部ファイル
- `/favicon.ico`, `/icon`, `/apple-icon.png` - アイコンファイル

### 2. AuthInitializerの強化 (`frontend/components/auth-initializer.tsx`)

**追加機能:**
- クライアントサイドでの認証チェック
- トークンが無効な場合のリダイレクト処理
- アクセス拒否ページではチェックをスキップ

**主要な処理:**
```typescript
useEffect(() => {
  initializeTokenFromUrl();
  
  // アクセス拒否ページはスキップ
  if (pathname === '/access-denied') {
    return;
  }
  
  // トークン検証
  if (!authManager.isTokenValid()) {
    router.push('/access-denied');
  }
}, [router, pathname]);
```

### 3. 認証ライブラリの改善 (`frontend/lib/auth.ts`)

**変更点:**
- sessionStorageとCookieの両方にトークンを保存
- Cookieからのトークン取得をフォールバックとして追加
- ミドルウェアとクライアントサイドの両方で動作

**トークン保存:**
```typescript
setToken(token: string): void {
  // sessionStorageに保存
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  
  // Cookieにも保存（ミドルウェア用）
  document.cookie = `${TOKEN_STORAGE_KEY}=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
}
```

**トークン取得:**
```typescript
getToken(): string | null {
  // sessionStorageから取得
  let token = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  
  // なければCookieから取得
  if (!token) {
    token = getCookieValue(TOKEN_STORAGE_KEY);
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  }
  
  return token;
}
```

### 4. メインページの改善 (`frontend/app/page.tsx`)

**追加機能:**
- 認証チェック中のローディング表示
- ユーザーエクスペリエンスの向上

**ローディング表示:**
```typescript
if (isChecking) {
  return (
    <main className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">認証を確認しています...</p>
      </div>
    </main>
  );
}
```

## 認証フロー

### 1. 初回アクセス（トークンあり）

```
ユーザー → https://app.example.com/?token=xxx
    ↓
[Middleware] トークン検証 → OK
    ↓
[AuthInitializer] URLからトークン取得 → sessionStorage & Cookie に保存
    ↓
[Page] メイン画面表示
```

### 2. 初回アクセス（トークンなし）

```
ユーザー → https://app.example.com/
    ↓
[Middleware] トークン検証 → NG
    ↓
リダイレクト → /access-denied
```

### 3. 再アクセス（Cookieあり）

```
ユーザー → https://app.example.com/
    ↓
[Middleware] Cookieからトークン取得 → 検証 → OK
    ↓
[AuthInitializer] Cookieからトークン取得 → sessionStorageに保存
    ↓
[Page] メイン画面表示
```

### 4. トークン期限切れ

```
ユーザー → https://app.example.com/
    ↓
[Middleware] トークン検証 → 期限切れ
    ↓
リダイレクト → /access-denied?tenant=xxx
```

## セキュリティ考慮事項

### トークン保存

- **sessionStorage**: メインストレージ、タブを閉じると削除
- **Cookie**: ミドルウェア用フォールバック、24時間で期限切れ
- **Cookie設定**:
  - `httpOnly: false` - クライアントサイドからもアクセス可能
  - `secure: true` (本番環境) - HTTPS通信のみ
  - `sameSite: 'lax'` - CSRF攻撃対策

### トークン検証

- **有効期限チェック**: `exp`クレームを確認
- **必須クレームチェック**: `custom:tenant_name`, `sub`の存在確認
- **署名検証**: バックエンドのLambda Authorizerで実施

### URLからトークンを削除

セキュリティのため、トークンをsessionStorageに保存後、URLから削除します:

```typescript
urlParams.delete('token');
const newUrl = window.location.pathname + 
  (urlParams.toString() ? '?' + urlParams.toString() : '');
window.history.replaceState({}, '', newUrl);
```

## テスト方法

### 1. トークンなしでアクセス

```bash
# ブラウザで直接アクセス
https://your-app.example.com/
```

**期待結果**: `/access-denied` にリダイレクト

### 2. 有効なトークンでアクセス

```bash
# マルチテナントポータルからリダイレクト
https://your-app.example.com/?token=valid_jwt_token
```

**期待結果**: メイン画面が表示される

### 3. 期限切れトークンでアクセス

```bash
# 期限切れトークンを使用
https://your-app.example.com/?token=expired_jwt_token
```

**期待結果**: `/access-denied` にリダイレクト

### 4. タブを閉じて再度開く

1. 有効なトークンでログイン
2. タブを閉じる
3. 新しいタブで同じURLにアクセス

**期待結果**: 
- sessionStorageはクリアされる
- Cookieが有効なら自動的にログイン
- Cookieも期限切れなら `/access-denied` にリダイレクト

## トラブルシューティング

### 問題: ミドルウェアが動作しない

**確認事項:**
1. `frontend/middleware.ts` が正しい場所にあるか
2. Next.jsのバージョンが12.2以上か
3. `config.matcher` が正しく設定されているか

**解決方法:**
```bash
cd frontend
npm run build
npm run start
```

### 問題: トークンが保存されない

**確認事項:**
1. ブラウザのCookie設定が有効か
2. sessionStorageが利用可能か
3. コンソールにエラーが出ていないか

**解決方法:**
- ブラウザの開発者ツールでApplication → Storage を確認
- プライベートブラウジングモードを無効化

### 問題: 無限リダイレクトループ

**確認事項:**
1. `/access-denied` が公開パスに含まれているか
2. `AuthInitializer` でアクセス拒否ページをスキップしているか

**解決方法:**
```typescript
// middleware.ts
const PUBLIC_PATHS = [
  '/access-denied',  // これが必須
  // ...
];

// auth-initializer.tsx
if (pathname === '/access-denied') {
  return;  // チェックをスキップ
}
```

## 今後の改善案

1. **リフレッシュトークンの実装**: 長期間のセッション維持
2. **トークン自動更新**: 有効期限が近づいたら自動更新
3. **ログアウト機能の強化**: すべてのストレージをクリア
4. **セッション管理**: 複数タブでの同期
5. **監査ログ**: 認証失敗のログ記録

## 関連ファイル

- `frontend/middleware.ts` - Next.jsミドルウェア（サーバーサイド認証）
- `frontend/components/auth-initializer.tsx` - 認証初期化コンポーネント
- `frontend/lib/auth.ts` - 認証ライブラリ
- `frontend/app/page.tsx` - メインページ
- `frontend/app/access-denied/page.tsx` - アクセス拒否画面
- `backend/functions/authorizer/lambda_function.py` - Lambda Authorizer（署名検証）

## 参考資料

- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
