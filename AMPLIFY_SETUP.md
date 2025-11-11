# AWS Amplify セットアップ手順

## ✅ デプロイ完了情報

```
amplify_app_id = "d7p9kyq423gpx"
amplify_app_url = "https://main.d7p9kyq423gpx.amplifyapp.com"
api_endpoint = "https://gye5ghvoyb.execute-api.ap-northeast-1.amazonaws.com/dev"
```

## 📋 次のステップ: GitHubリポジトリ接続

### 1. AWS Amplifyコンソールを開く

https://console.aws.amazon.com/amplify/home?region=ap-northeast-1#/d7p9kyq423gpx

### 2. リポジトリを接続

1. 「ホスティング環境を設定」をクリック
2. 「GitHub」を選択
3. 「GitHubを認証」をクリック
4. GitHubアカウントでログイン
5. リポジトリを選択:
   - **リポジトリ**: `lilifan105/misawa`
   - **ブランチ**: `main`
6. 「次へ」をクリック

### 3. ビルド設定を確認

Amplifyが自動的に検出したビルド設定を確認:

```yaml
version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
```

環境変数も自動設定されています:
- `NEXT_PUBLIC_API_ENDPOINT`: https://gye5ghvoyb.execute-api.ap-northeast-1.amazonaws.com/dev

### 4. デプロイを開始

1. 「保存してデプロイ」をクリック
2. ビルドが自動的に開始されます（約5-10分）

### 5. ビルドステータスを確認

ビルドの進行状況:
1. ✓ Provision - 環境準備
2. ✓ Build - Next.jsビルド
3. ✓ Deploy - デプロイ
4. ✓ Verify - 検証

### 6. アプリケーションにアクセス

ビルド完了後、以下のURLにアクセス:

```
https://main.d7p9kyq423gpx.amplifyapp.com
```

## 🧪 動作確認

### 1. フロントエンド確認
- 文書一覧ページが表示される
- カテゴリツリーが表示される

### 2. API接続確認
- ブラウザの開発者ツールを開く
- Networkタブで以下を確認:
  - `GET /documents` リクエストが成功
  - レスポンスにデータが含まれる

### 3. 文書登録テスト
1. 「文書登録」ボタンをクリック
2. フォームに入力:
   - 文書種類: 通達
   - タイトル: テスト文書
   - 発信部門: テスト部署
3. 「完了」をクリック
4. 文書が登録されることを確認

## 🔧 トラブルシューティング

### ビルドエラー: "Module not found"
- `frontend/package.json` の依存関係を確認
- ローカルで `npm install` を実行して確認

### ビルドエラー: "Command failed"
- ビルドログを確認
- TypeScriptエラーがないか確認

### API接続エラー
- 環境変数 `NEXT_PUBLIC_API_ENDPOINT` が正しく設定されているか確認
- API Gatewayエンドポイントが正しいか確認
- CORSが正しく設定されているか確認

### 404エラー
- カスタムルールが設定されているか確認
- `/<*>` → `/index.html` (404-200)

## 📊 コスト

### Amplify Hosting
- ビルド時間: 約5分/回
- ストレージ: ~50MB
- 転送量: 従量課金

### 月額見積もり
- ビルド: 100分/月 = $1
- ストレージ: 無料枠内
- 転送: 15GB無料、超過分 $0.15/GB

## 🔄 自動デプロイ

GitHubにプッシュすると自動的にビルド・デプロイされます:

```bash
git add .
git commit -m "Update frontend"
git push origin main
```

Amplifyが自動的に:
1. 変更を検出
2. ビルドを開始
3. デプロイを実行

## 📞 サポート

問題が発生した場合:
1. Amplifyコンソールでビルドログを確認
2. CloudWatch Logsを確認
3. GitHub Issuesで報告

---

**次のステップ**: アプリケーションにアクセスして動作確認してください！

https://main.d7p9kyq423gpx.amplifyapp.com
