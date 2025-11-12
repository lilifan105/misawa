# GitHub Token 権限エラー修正

## エラー
```
Resource not accessible by personal access token
```

## 原因
現在のトークンに`admin:repo_hook`権限がありません。

## 解決方法

### 1. 新しいトークンを作成
https://github.com/settings/tokens

### 2. 必要な権限
- ✅ `repo` (Full control of private repositories)
- ✅ `admin:repo_hook` (Full control of repository hooks)

### 3. terraform.tfvarsを更新
```hcl
github_access_token = "新しいトークン"
```

### 4. 再デプロイ
```bash
cd infrastructure
terraform apply
```
