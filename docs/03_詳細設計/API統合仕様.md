# API統合仕様

## フロントエンド・バックエンド統合

### API設定

**ファイル**: `frontend/lib/api.ts`

環境変数 `NEXT_PUBLIC_API_ENDPOINT` でバックエンドAPIエンドポイントを設定。

```typescript
const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:3000/api'
```

### 実装済みAPI関数

#### 1. 文書一覧取得
```typescript
getDocuments(category?: string)
```
- **エンドポイント**: `GET /documents`
- **使用箇所**: `components/document-list-page.tsx`
- **処理**: 文書一覧を取得し、テーブルに表示

#### 2. 文書詳細取得
```typescript
getDocument(id: string)
```
- **エンドポイント**: `GET /documents/{id}`
- **使用箇所**: `components/document-viewer-page.tsx`
- **処理**: 文書詳細を取得し、属性を表示

#### 3. 文書登録
```typescript
createDocument(data: any)
```
- **エンドポイント**: `POST /documents`
- **使用箇所**: `components/document-registration-form.tsx`
- **処理**: フォームデータを送信し、文書を登録

#### 4. 文書更新
```typescript
updateDocument(id: string, data: any)
```
- **エンドポイント**: `PUT /documents/{id}`
- **使用箇所**: 未実装（編集機能で使用予定）

#### 5. 文書削除
```typescript
deleteDocument(id: string)
```
- **エンドポイント**: `DELETE /documents/{id}`
- **使用箇所**: 
  - `components/document-list-page.tsx`（一覧から削除）
  - `components/document-viewer-page.tsx`（詳細画面から削除）

## データフロー

### 文書一覧表示
```
1. ページロード
   └─ useEffect() → getDocuments()
      └─ API Gateway → Lambda (documents)
         └─ DynamoDB Scan
            └─ レスポンス → State更新 → 画面表示
```

### 文書登録
```
1. フォーム入力
   └─ formData State更新

2. 完了ボタンクリック
   └─ createDocument(formData)
      └─ API Gateway → Lambda (documents)
         └─ DynamoDB PutItem
            └─ 成功 → /complete へリダイレクト
```

### 文書削除
```
1. 削除ボタンクリック
   └─ 確認モーダル表示

2. 削除確認
   └─ deleteDocument(id)
      └─ API Gateway → Lambda (documents)
         └─ DynamoDB UpdateItem (status='deleted')
            └─ 成功 → State更新 → 画面から削除
```

## エラーハンドリング

### API呼び出しエラー
```typescript
try {
  const response = await getDocuments()
  // 成功処理
} catch (error) {
  console.error('文書一覧の取得に失敗:', error)
  // エラー表示（将来的にToast通知）
}
```

### ユーザーフィードバック
- **成功**: ページ遷移または画面更新
- **失敗**: `alert()` で通知（将来的にToast UIに変更）

## 環境変数設定

### ローカル開発
```bash
# frontend/.env.local
NEXT_PUBLIC_API_ENDPOINT=https://your-api-id.execute-api.ap-northeast-1.amazonaws.com
```

### Amplify（本番）
Terraformで自動設定:
```hcl
environment_variables = {
  NEXT_PUBLIC_API_ENDPOINT = var.api_endpoint
}
```

## CORS設定

バックエンド（API Gateway）でCORS設定済み:
```hcl
cors_origins = ["http://localhost:3000", "https://main.xxx.amplifyapp.com"]
```

## 今後の改善点

### 1. 認証統合
- Cognito JWTトークンをAPIリクエストに追加
- `Authorization: Bearer {token}` ヘッダー

### 2. エラーハンドリング強化
- Toast通知（sonner使用）
- リトライロジック
- オフライン対応

### 3. ローディング状態
- Skeleton UI
- プログレスバー

### 4. キャッシング
- React Query導入
- SWR導入

### 5. ファイルアップロード
- S3 Presigned URL
- マルチパートアップロード
