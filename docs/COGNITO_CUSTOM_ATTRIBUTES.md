# Cognito カスタム属性とトークンの重要な注意事項

## 概要

このドキュメントは、Amazon Cognitoのカスタム属性とトークンの関係について説明します。

## 重要: カスタム属性はIDトークンにのみ含まれる

Amazon Cognitoでは、**カスタム属性（`custom:*`）はIDトークンにのみ含まれ、アクセストークンには含まれません。**

### IDトークン vs アクセストークン

| 項目 | IDトークン | アクセストークン |
|------|-----------|----------------|
| **用途** | ユーザー情報の取得 | APIアクセス |
| **標準クレーム** | ✅ あり（sub, email, name等） | ✅ あり（sub, scope等） |
| **カスタム属性** | ✅ **あり** | ❌ **なし** |
| **有効期限** | 1時間 | 15分 |

### カスタム属性の例

このシステムでは以下のカスタム属性を使用しています：

- `custom:tenant_name`: テナント名（例: "sample-a"）
- `custom:role`: ユーザーロール（例: "admin", "user"）

これらの属性は**IDトークンにのみ含まれます**。

## トークンの内容比較

### IDトークンの例

```json
{
  "sub": "12345678-1234-1234-1234-123456789012",
  "email": "user@example.com",
  "email_verified": true,
  "name": "山田太郎",
  "custom:tenant_name": "sample-a",
  "custom:role": "admin",
  "iss": "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xF0rdWASB",
  "aud": "f5f6e5c9-9a3e-48f4-a467-97ede2a8b281",
  "exp": 1703289600,
  "iat": 1703286000
}
```

### アクセストークンの例

```json
{
  "sub": "12345678-1234-1234-1234-123456789012",
  "scope": "openid profile email",
  "client_id": "f5f6e5c9-9a3e-48f4-a467-97ede2a8b281",
  "iss": "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_xF0rdWASB",
  "exp": 1703286900,
  "iat": 1703286000
}
```

**注意**: アクセストークンには`custom:tenant_name`や`custom:role`が含まれていません！

## システムへの影響

### Lambda Authorizer

Lambda Authorizerは、テナント情報（`custom:tenant_name`）とロール情報（`custom:role`）を使用して認証・認可を行います。

そのため、**IDトークンを検証する必要があります**。

```python
# backend/functions/authorizer/lambda_function.py

# ❌ アクセストークンを使用すると失敗
# access_tokenにはcustom:tenant_nameが含まれない
claims = jwt_validator.validate_token(access_token)
tenant_name = claims['custom:tenant_name']  # KeyError!

# ✅ IDトークンを使用すると成功
# id_tokenにはcustom:tenant_nameが含まれる
claims = jwt_validator.validate_token(id_token)
tenant_name = claims['custom:tenant_name']  # OK!
```

### フロントエンド API呼び出し

フロントエンドは、API呼び出し時に**IDトークンを送信する必要があります**。

```typescript
// frontend/lib/api.ts

// ❌ アクセストークンを使用すると認証失敗
const token = getAccessToken();  // カスタム属性なし
headers['Authorization'] = `Bearer ${token}`;

// ✅ IDトークンを使用すると認証成功
const token = getIdToken();  // カスタム属性あり
headers['Authorization'] = `Bearer ${token}`;
```

## ベストプラクティス

### 1. IDトークンをAPI呼び出しに使用

```typescript
// frontend/lib/api.ts
function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  if (MULTITENANT_MODE) {
    // IDトークンを使用（カスタム属性が含まれる）
    const token = getIdToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  return headers;
}
```

### 2. 両方のトークンを保存

ポータルから両方のトークンを受け取った場合、両方を保存します：

```typescript
// frontend/lib/auth.ts
if (accessToken && idToken) {
  // 両方を保存
  sessionStorage.setItem('multitenant_access_token', accessToken);
  sessionStorage.setItem('multitenant_id_token', idToken);
  
  // id_tokenをメイントークンとして使用
  authManager.setToken(idToken);
}
```

### 3. Lambda Authorizerでカスタム属性を検証

```python
# backend/functions/authorizer/lambda_function.py
try:
    claims = jwt_validator.validate_token(token)
    
    # カスタム属性を取得（IDトークンにのみ含まれる）
    tenant_name = claims['custom:tenant_name']
    role = claims['custom:role']
    
except KeyError as e:
    # カスタム属性が見つからない場合
    # = アクセストークンが送信された可能性
    logger.error(f"カスタム属性が見つかりません: {e}")
    logger.error("IDトークンではなくアクセストークンが送信された可能性があります")
    return generate_policy(
        principal_id='unknown',
        effect='Deny',
        resource=event.get('methodArn', '*')
    )
```

## トラブルシューティング

### エラー: "カスタム属性が見つかりません"

**原因**: アクセストークンが送信されている

**解決方法**:
1. フロントエンドが`getIdToken()`を使用しているか確認
2. ポータルから`id_token`が正しく渡されているか確認
3. sessionStorageに`multitenant_id_token`が保存されているか確認

### エラー: "KeyError: 'custom:tenant_name'"

**原因**: トークンにカスタム属性が含まれていない

**解決方法**:
1. IDトークンを使用しているか確認
2. Cognitoユーザープールでカスタム属性が設定されているか確認
3. トークンをデコードして内容を確認

## 参考資料

- [Amazon Cognito User Pool Tokens](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html)
- [OAuth 2.0 Token Types](https://oauth.net/2/access-tokens/)
- [OpenID Connect ID Token](https://openid.net/specs/openid-connect-core-1_0.html#IDToken)

## まとめ

✅ **カスタム属性はIDトークンにのみ含まれる**
✅ **API呼び出しにはIDトークンを使用する**
✅ **Lambda AuthorizerはIDトークンを検証する**
✅ **アクセストークンにはカスタム属性が含まれない**

この重要な違いを理解することで、認証エラーを防ぐことができます。
