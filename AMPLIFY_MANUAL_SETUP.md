# Amplify 手動セットアップ手順

## 問題
現在のAmplifyアプリ (di2c0ccxstrcl) はGitHubリポジトリと接続されていません。
Terraformで作成したアプリはリポジトリ接続なしで作成されました。

## 解決方法
AWS Amplifyコンソールから新しいアプリを作成します。

## 手順

### 1. Amplifyコンソールを開く
```
https://console.aws.amazon.com/amplify/home?region=ap-northeast-1
```

### 2. 「Deploy an app」をクリック

### 3. GitHubを選択
- 「GitHub」を選択
- 「Next」をクリック

### 4. GitHub認証
- 「Authorize AWS Amplify」をクリック
- GitHubアカウントでログイン
- リポジトリへのアクセスを許可

### 5. リポジトリとブランチを選択
- **Repository**: `lilifan105/misawa`
- **Branch**: `main`
- 「Next」をクリック

### 6. ビルド設定を確認
Amplifyが自動検出します：

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

### 7. 環境変数を追加
「Advanced settings」を展開して追加：

| Key | Value |
|-----|-------|
| NEXT_PUBLIC_API_ENDPOINT | https://gye5ghvoyb.execute-api.ap-northeast-1.amazonaws.com/dev |
| AMPLIFY_MONOREPO_APP_ROOT | frontend |

### 8. サービスロールを選択
- 「Create and use a new service role」を選択
- または既存のロールを使用

### 9. 「Save and deploy」をクリック

### 10. ビルド完了を待つ
- 約5-10分
- ビルドログで進行状況を確認

### 11. アプリケーションにアクセス
デプロイ完了後、表示されるURLにアクセス：
```
https://main.{app-id}.amplifyapp.com
```

## 完了後
新しいApp IDをTerraformにインポートするか、Terraformの管理から除外します。

## トラブルシューティング

### GitHub認証エラー
- GitHubの設定 → Applications → AWS Amplify を確認
- リポジトリへのアクセス権限を確認

### ビルドエラー
- ビルドログを確認
- 環境変数が正しく設定されているか確認
- モノレポ設定 (AMPLIFY_MONOREPO_APP_ROOT) を確認
