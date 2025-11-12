# GitHub Personal Access Token 作成手順

## 1. GitHubでトークンを作成

1. https://github.com/settings/tokens にアクセス
2. 「Generate new token」→「Generate new token (classic)」をクリック
3. 設定:
   - **Note**: `terraform-amplify-misawa`
   - **Expiration**: 90 days (または任意)
   - **Scopes**: `repo` (Full control of private repositories) にチェック
4. 「Generate token」をクリック
5. **トークンをコピー** (ghp_で始まる文字列)

## 2. terraform.tfvarsに追加

```bash
cd infrastructure
```

terraform.tfvarsを編集:
```hcl
github_access_token = "ghp_YOUR_TOKEN_HERE"
```

## 3. Terraformでデプロイ

```bash
terraform apply
```

これでGitHub接続付きAmplifyアプリが作成されます。

## セキュリティ注意
- トークンは絶対にGitにコミットしない
- terraform.tfvarsは.gitignoreに含まれています
