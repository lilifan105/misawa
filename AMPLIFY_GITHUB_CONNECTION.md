# AWS Amplify GitHub接続手順

## 現在の状況

- **Amplify App ID**: di2c0ccxstrcl
- **Amplify URL**: https://main.di2c0ccxstrcl.amplifyapp.com
- **API Endpoint**: https://gye5ghvoyb.execute-api.ap-northeast-1.amazonaws.com/dev
- **CORS設定**: 完了（Amplify URLが許可されています）

## GitHubリポジトリ接続手順

### 1. Amplifyコンソールを開く

https://console.aws.amazon.com/amplify/home?region=ap-northeast-1#/di2c0ccxstrcl

### 2. GitHubリポジトリを接続

1. 「ホスティング環境を設定」または「Set up hosting」をクリック
2. 「GitHub」を選択
3. 「GitHubを認証」をクリック
4. GitHubアカウントでログイン
5. リポジトリを選択:
   - **リポジトリ**: `lilifan105/misawa`
   - **ブランチ**: `main`
6. 「次へ」をクリック

### 3. ビルド設定を確認

Amplifyが自動的に検出したビルド設定を確認（すでに設定済み）:

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
- `AMPLIFY_DIFF_DEPLOY`: false
- `AMPLIFY_MONOREPO_APP_ROOT`: frontend

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
https://main.di2c0ccxstrcl.amplifyapp.com
```

## 動作確認

### 1. フロントエンド確認
- 文書一覧ページが表示される
- カテゴリツリーが表示される
- エラーがない

### 2. API接続確認
- ブラウザの開発者ツールを開く
- Networkタブで以下を確認:
  - `GET /documents` リクエストが成功
  - レスポンスにデータが含まれる
  - CORSエラーがない

### 3. 文書登録テスト
1. 「文書登録」ボタンをクリック
2. フォームに入力
3. 「完了」をクリック
4. 文書が登録されることを確認

## トラブルシューティング

### ビルドエラー
- ビルドログを確認
- `frontend/package.json` の依存関係を確認

### API接続エラー
- 環境変数が正しく設定されているか確認
- CORS設定が正しいか確認（すでに設定済み）

### 404エラー
- カスタムルールが設定されているか確認（すでに設定済み）

## 次のステップ

1. GitHubリポジトリを接続
2. ビルドが完了するまで待つ
3. アプリケーションにアクセスして動作確認
4. 問題があれば再度修正

---

**重要**: GitHubリポジトリの接続は、Amplifyコンソールで手動で行う必要があります。AWS CLIでは直接接続できません。
