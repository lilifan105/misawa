# OAuth 2.0実装サンプルコード

## 目次

1. [ポータル経由のSSO実装例（推奨）](#ポータル経由のsso実装例推奨)
2. [Python/Flask完全実装例（標準OAuth）](#pythonflask完全実装例標準oauth)
3. [Node.js/Express完全実装例（標準OAuth）](#nodejsexpress完全実装例標準oauth)
4. [認可コールバック処理](#認可コールバック処理)
5. [トークンリフレッシュ処理](#トークンリフレッシュ処理)
6. [セッション管理](#セッション管理)

---

## ポータル経由のSSO実装例（推奨）

ポータル経由のSSOを使用する場合、外部サービス側の実装は非常にシンプルです。

### 外部サービス側の実装（JavaScript）

```javascript
// URLパラメータからトークンを取得
const params = new URLSearchParams(window.location.search)
const accessToken = params.get('access_token')
const idToken = params.get('id_token')

if (!accessToken || !idToken) {
  // トークンがない場合はポータルにリダイレクト
  window.location.href = 'https://portal.example.com'
}

// IDトークンをデコードしてユーザー情報を取得
function decodeJWT(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload
  } catch (e) {
    console.error('IDトークンのデコードに失敗しました:', e)
    return null
  }
}

const userInfo = decodeJWT(idToken)
if (userInfo) {
  console.log('ユーザーID:', userInfo.sub)
  console.log('メール:', userInfo.email)
  console.log('名前:', userInfo.name)
  console.log('テナントID:', userInfo.tenant_id)
  console.log('テナント名:', userInfo.tenant_name)
  console.log('ロール:', userInfo.role)
  
  // トークンをセッションストレージに保存
  sessionStorage.setItem('access_token', accessToken)
  sessionStorage.setItem('id_token', idToken)
  sessionStorage.setItem('user_info', JSON.stringify(userInfo))
  
  // URLからトークンを削除（セキュリティのため）
  window.history.replaceState({}, document.title, window.location.pathname)
  
  // ユーザー情報を表示
  document.getElementById('user-name').textContent = userInfo.name
  document.getElementById('user-email').textContent = userInfo.email
}

// アクセストークンを使用してAPIリクエスト
async function fetchProtectedData() {
  const accessToken = sessionStorage.getItem('access_token')
  
  if (!accessToken) {
    console.error('アクセストークンがありません')
    return
  }
  
  try {
    const response = await fetch('https://api.your-portal.com/api/portal/profile', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('プロフィール:', data)
    } else {
      console.error('APIリクエスト失敗:', response.status)
    }
  } catch (error) {
    console.error('APIリクエストエラー:', error)
  }
}

// トークンの有効期限をチェック
function isTokenExpired(token) {
  const payload = decodeJWT(token)
  if (!payload || !payload.exp) {
    return true
  }
  
  const now = Math.floor(Date.now() / 1000)
  return payload.exp < now
}

// トークンの有効期限をチェックして、期限切れの場合はポータルにリダイレクト
const idToken = sessionStorage.getItem('id_token')
if (idToken && isTokenExpired(idToken)) {
  console.log('トークンの有効期限が切れています')
  sessionStorage.clear()
  window.location.href = 'https://portal.example.com'
}
```

### HTMLサンプル

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>外部サービス</title>
</head>
<body>
  <div id="app">
    <h1>ようこそ、<span id="user-name">ゲスト</span>さん</h1>
    <p>メール: <span id="user-email">-</span></p>
    <button onclick="fetchProtectedData()">プロフィールを取得</button>
    <button onclick="logout()">ログアウト</button>
  </div>
  
  <script>
    // 上記のJavaScriptコードをここに配置
    
    function logout() {
      sessionStorage.clear()
      window.location.href = 'https://portal.example.com'
    }
  </script>
</body>
</html>
```

**メリット**:
- OAuth実装が不要
- `client_secret`の管理が不要
- シンプルな実装

**注意点**:
- トークンがURLパラメータで渡されるため、すぐにセッションストレージに保存してURLから削除する
- IDトークンの署名検証は省略可能（ポータルから直接渡されるため）
- アクセストークンの有効期限は15分、IDトークンは1時間

---

## Python/Flask完全実装例（標準OAuth）

外部サービスが独立してOAuth 2.0を実装する場合のサンプルコードです。

### 必要なパッケージ

```bash
pip install flask requests pyjwt cryptography
```

### 完全な実装コード

```python
# app.py
import os
import secrets
import hashlib
import base64
import requests
from flask import Flask, redirect, request, session, url_for, jsonify
from urllib.parse import urlencode
import jwt
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'your-secret-key')

# OAuth設定
OAUTH_CONFIG = {
    'authorization_endpoint': 'https://portal.example.com/api/oauth/authorize',
    'token_endpoint': 'https://portal.example.com/api/oauth/token',
    'revoke_endpoint': 'https://portal.example.com/api/oauth/revoke',
    'client_id': os.environ.get('OAUTH_CLIENT_ID'),
    'client_secret': os.environ.get('OAUTH_CLIENT_SECRET'),
    'redirect_uri': 'https://your-service.com/oauth/callback',
    'scope': 'openid profile email'
}


def generate_code_verifier():
    """PKCEのcode_verifierを生成"""
    code_verifier = base64.urlsafe_b64encode(
        secrets.token_bytes(32)
    ).decode('utf-8').rstrip('=')
    return code_verifier


def generate_code_challenge(code_verifier):
    """PKCEのcode_challengeを生成"""
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier.encode('utf-8')).digest()
    ).decode('utf-8').rstrip('=')
    return code_challenge


def generate_state():
    """CSRF対策用のstateを生成"""
    return base64.urlsafe_b64encode(
        secrets.token_bytes(32)
    ).decode('utf-8').rstrip('=')


@app.route('/')
def index():
    """ホームページ"""
    if 'access_token' in session:
        # ログイン済み
        user_info = get_user_info_from_id_token(session.get('id_token'))
        return f"""
        <h1>ようこそ、{user_info.get('name', 'ユーザー')}さん</h1>
        <p>メール: {user_info.get('email', 'N/A')}</p>
        <a href="/logout">ログアウト</a>
        """
    else:
        # 未ログイン
        return '<h1>ようこそ</h1><a href="/login">ログイン</a>'


@app.route('/login')
def login():
    """OAuth認可フローを開始"""
    # 1. code_verifierとcode_challengeを生成
    code_verifier = generate_code_verifier()
    code_challenge = generate_code_challenge(code_verifier)
    
    # 2. stateを生成
    state = generate_state()
    
    # 3. セッションに保存
    session['oauth_state'] = state
    session['oauth_code_verifier'] = code_verifier
    
    # 4. 認可URLを構築
    params = {
        'response_type': 'code',
        'client_id': OAUTH_CONFIG['client_id'],
        'redirect_uri': OAUTH_CONFIG['redirect_uri'],
        'scope': OAUTH_CONFIG['scope'],
        'state': state,
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256'
    }
    
    authorization_url = f"{OAUTH_CONFIG['authorization_endpoint']}?{urlencode(params)}"
    
    # 5. リダイレクト
    return redirect(authorization_url)


@app.route('/oauth/callback')
def oauth_callback():
    """OAuth認可コールバック"""
    # 1. エラーチェック
    error = request.args.get('error')
    if error:
        error_description = request.args.get('error_description', 'Unknown error')
        return f"認可エラー: {error} - {error_description}", 400
    
    # 2. パラメータ取得
    code = request.args.get('code')
    state = request.args.get('state')
    
    if not code or not state:
        return "無効なコールバックパラメータ", 400
    
    # 3. state検証（CSRF対策）
    if state != session.get('oauth_state'):
        return "無効なstateパラメータ", 400
    
    # 4. トークンリクエスト
    token_data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': OAUTH_CONFIG['redirect_uri'],
        'client_id': OAUTH_CONFIG['client_id'],
        'client_secret': OAUTH_CONFIG['client_secret'],
        'code_verifier': session.get('oauth_code_verifier')
    }
    
    try:
        token_response = requests.post(
            OAUTH_CONFIG['token_endpoint'],
            data=token_data,
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=10
        )
        
        if token_response.status_code != 200:
            return f"トークン取得エラー: {token_response.text}", 400
        
        tokens = token_response.json()
        
        # 5. トークンをセッションに保存
        session['access_token'] = tokens['access_token']
        session['id_token'] = tokens['id_token']
        session['refresh_token'] = tokens.get('refresh_token')
        session['token_expires_at'] = datetime.utcnow() + timedelta(seconds=tokens['expires_in'])
        
        # 6. OAuth一時データをクリア
        session.pop('oauth_state', None)
        session.pop('oauth_code_verifier', None)
        
        # 7. ホームページにリダイレクト
        return redirect(url_for('index'))
        
    except requests.RequestException as e:
        return f"トークンリクエスト失敗: {str(e)}", 500


@app.route('/logout')
def logout():
    """ログアウト"""
    # 1. リフレッシュトークンを無効化
    refresh_token = session.get('refresh_token')
    if refresh_token:
        try:
            requests.post(
                OAUTH_CONFIG['revoke_endpoint'],
                data={
                    'token': refresh_token,
                    'token_type_hint': 'refresh_token',
                    'client_id': OAUTH_CONFIG['client_id'],
                    'client_secret': OAUTH_CONFIG['client_secret']
                },
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=10
            )
        except requests.RequestException:
            # 無効化失敗は無視
            pass
    
    # 2. セッションをクリア
    session.clear()
    
    # 3. ホームページにリダイレクト
    return redirect(url_for('index'))


@app.route('/api/protected')
def protected_api():
    """保護されたAPIエンドポイント"""
    # アクセストークンの確認
    access_token = session.get('access_token')
    if not access_token:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # トークンの有効期限確認
    token_expires_at = session.get('token_expires_at')
    if token_expires_at and datetime.utcnow() > token_expires_at:
        # トークンが期限切れの場合はリフレッシュ
        if not refresh_access_token():
            return jsonify({'error': 'Token expired'}), 401
    
    # ユーザー情報を取得
    user_info = get_user_info_from_id_token(session.get('id_token'))
    
    return jsonify({
        'message': 'Protected data',
        'user': user_info
    })


def refresh_access_token():
    """アクセストークンをリフレッシュ"""
    refresh_token = session.get('refresh_token')
    if not refresh_token:
        return False
    
    try:
        token_response = requests.post(
            OAUTH_CONFIG['token_endpoint'],
            data={
                'grant_type': 'refresh_token',
                'refresh_token': refresh_token,
                'client_id': OAUTH_CONFIG['client_id'],
                'client_secret': OAUTH_CONFIG['client_secret']
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=10
        )
        
        if token_response.status_code != 200:
            return False
        
        tokens = token_response.json()
        
        # 新しいトークンをセッションに保存
        session['access_token'] = tokens['access_token']
        session['refresh_token'] = tokens.get('refresh_token', refresh_token)
        session['token_expires_at'] = datetime.utcnow() + timedelta(seconds=tokens['expires_in'])
        
        return True
        
    except requests.RequestException:
        return False


def get_user_info_from_id_token(id_token):
    """IDトークンからユーザー情報を取得（検証なし）"""
    if not id_token:
        return {}
    
    try:
        # 注意: 本番環境では署名検証が必要
        payload = jwt.decode(id_token, options={"verify_signature": False})
        return {
            'user_id': payload.get('sub'),
            'email': payload.get('email'),
            'name': payload.get('name'),
            'nickname': payload.get('nickname')
        }
    except jwt.DecodeError:
        return {}


if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

### 環境変数の設定

```bash
export FLASK_SECRET_KEY="your-flask-secret-key"
export OAUTH_CLIENT_ID="your-client-id"
export OAUTH_CLIENT_SECRET="your-client-secret"
```

---

## Node.js/Express完全実装例（標準OAuth）

外部サービスが独立してOAuth 2.0を実装する場合のサンプルコードです。

### 必要なパッケージ

```bash
npm install express express-session axios crypto
```

### 完全な実装コード

```javascript
// app.js
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const crypto = require('crypto');
const { URLSearchParams } = require('url');

const app = express();

// セッション設定
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// OAuth設定
const OAUTH_CONFIG = {
  authorizationEndpoint: 'https://portal.example.com/api/oauth/authorize',
  tokenEndpoint: 'https://portal.example.com/api/oauth/token',
  revokeEndpoint: 'https://portal.example.com/api/oauth/revoke',
  clientId: process.env.OAUTH_CLIENT_ID,
  clientSecret: process.env.OAUTH_CLIENT_SECRET,
  redirectUri: 'https://your-service.com/oauth/callback',
  scope: 'openid profile email'
};

/**
 * PKCEのcode_verifierを生成
 */
function generateCodeVerifier() {
  return crypto.randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * PKCEのcode_challengeを生成
 */
function generateCodeChallenge(codeVerifier) {
  return crypto.createHash('sha256')
    .update(codeVerifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * CSRF対策用のstateを生成
 */
function generateState() {
  return crypto.randomBytes(32)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * ホームページ
 */
app.get('/', (req, res) => {
  if (req.session.accessToken) {
    // ログイン済み
    const userInfo = getUserInfoFromIdToken(req.session.idToken);
    res.send(`
      <h1>ようこそ、${userInfo.name || 'ユーザー'}さん</h1>
      <p>メール: ${userInfo.email || 'N/A'}</p>
      <a href="/logout">ログアウト</a>
    `);
  } else {
    // 未ログイン
    res.send('<h1>ようこそ</h1><a href="/login">ログイン</a>');
  }
});

/**
 * OAuth認可フローを開始
 */
app.get('/login', (req, res) => {
  // 1. code_verifierとcode_challengeを生成
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  // 2. stateを生成
  const state = generateState();
  
  // 3. セッションに保存
  req.session.oauthState = state;
  req.session.oauthCodeVerifier = codeVerifier;
  
  // 4. 認可URLを構築
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: OAUTH_CONFIG.scope,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });
  
  const authorizationUrl = `${OAUTH_CONFIG.authorizationEndpoint}?${params.toString()}`;
  
  // 5. リダイレクト
  res.redirect(authorizationUrl);
});

/**
 * OAuth認可コールバック
 */
app.get('/oauth/callback', async (req, res) => {
  // 1. エラーチェック
  if (req.query.error) {
    const errorDescription = req.query.error_description || 'Unknown error';
    return res.status(400).send(`認可エラー: ${req.query.error} - ${errorDescription}`);
  }
  
  // 2. パラメータ取得
  const { code, state } = req.query;
  
  if (!code || !state) {
    return res.status(400).send('無効なコールバックパラメータ');
  }
  
  // 3. state検証（CSRF対策）
  if (state !== req.session.oauthState) {
    return res.status(400).send('無効なstateパラメータ');
  }
  
  // 4. トークンリクエスト
  const tokenData = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    client_id: OAUTH_CONFIG.clientId,
    client_secret: OAUTH_CONFIG.clientSecret,
    code_verifier: req.session.oauthCodeVerifier
  });
  
  try {
    const tokenResponse = await axios.post(
      OAUTH_CONFIG.tokenEndpoint,
      tokenData.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      }
    );
    
    const tokens = tokenResponse.data;
    
    // 5. トークンをセッションに保存
    req.session.accessToken = tokens.access_token;
    req.session.idToken = tokens.id_token;
    req.session.refreshToken = tokens.refresh_token;
    req.session.tokenExpiresAt = Date.now() + (tokens.expires_in * 1000);
    
    // 6. OAuth一時データをクリア
    delete req.session.oauthState;
    delete req.session.oauthCodeVerifier;
    
    // 7. ホームページにリダイレクト
    res.redirect('/');
    
  } catch (error) {
    console.error('トークンリクエスト失敗:', error.message);
    res.status(500).send(`トークン取得エラー: ${error.message}`);
  }
});

/**
 * ログアウト
 */
app.get('/logout', async (req, res) => {
  // 1. リフレッシュトークンを無効化
  if (req.session.refreshToken) {
    try {
      const revokeData = new URLSearchParams({
        token: req.session.refreshToken,
        token_type_hint: 'refresh_token',
        client_id: OAUTH_CONFIG.clientId,
        client_secret: OAUTH_CONFIG.clientSecret
      });
      
      await axios.post(
        OAUTH_CONFIG.revokeEndpoint,
        revokeData.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000
        }
      );
    } catch (error) {
      // 無効化失敗は無視
      console.error('トークン無効化失敗:', error.message);
    }
  }
  
  // 2. セッションを破棄
  req.session.destroy((err) => {
    if (err) {
      console.error('セッション破棄エラー:', err);
    }
    // 3. ホームページにリダイレクト
    res.redirect('/');
  });
});

/**
 * 保護されたAPIエンドポイント
 */
app.get('/api/protected', async (req, res) => {
  // アクセストークンの確認
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // トークンの有効期限確認
  if (req.session.tokenExpiresAt && Date.now() > req.session.tokenExpiresAt) {
    // トークンが期限切れの場合はリフレッシュ
    const refreshed = await refreshAccessToken(req);
    if (!refreshed) {
      return res.status(401).json({ error: 'Token expired' });
    }
  }
  
  // ユーザー情報を取得
  const userInfo = getUserInfoFromIdToken(req.session.idToken);
  
  res.json({
    message: 'Protected data',
    user: userInfo
  });
});

/**
 * アクセストークンをリフレッシュ
 */
async function refreshAccessToken(req) {
  if (!req.session.refreshToken) {
    return false;
  }
  
  try {
    const tokenData = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: req.session.refreshToken,
      client_id: OAUTH_CONFIG.clientId,
      client_secret: OAUTH_CONFIG.clientSecret
    });
    
    const tokenResponse = await axios.post(
      OAUTH_CONFIG.tokenEndpoint,
      tokenData.toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
      }
    );
    
    const tokens = tokenResponse.data;
    
    // 新しいトークンをセッションに保存
    req.session.accessToken = tokens.access_token;
    req.session.refreshToken = tokens.refresh_token || req.session.refreshToken;
    req.session.tokenExpiresAt = Date.now() + (tokens.expires_in * 1000);
    
    return true;
    
  } catch (error) {
    console.error('トークンリフレッシュ失敗:', error.message);
    return false;
  }
}

/**
 * IDトークンからユーザー情報を取得（検証なし）
 */
function getUserInfoFromIdToken(idToken) {
  if (!idToken) {
    return {};
  }
  
  try {
    // 注意: 本番環境では署名検証が必要
    const payload = JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64').toString()
    );
    
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      nickname: payload.nickname
    };
  } catch (error) {
    console.error('IDトークンデコードエラー:', error.message);
    return {};
  }
}

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

### 環境変数の設定

```bash
export SESSION_SECRET="your-session-secret"
export OAUTH_CLIENT_ID="your-client-id"
export OAUTH_CLIENT_SECRET="your-client-secret"
export NODE_ENV="production"
```

---

## 認可コールバック処理

認可コールバックの処理フローの詳細：

```python
def oauth_callback():
    # 1. エラーチェック
    if 'error' in request.args:
        # エラーハンドリング
        return handle_oauth_error(request.args)
    
    # 2. パラメータ取得
    code = request.args.get('code')
    state = request.args.get('state')
    
    # 3. state検証（CSRF対策）
    if state != session.get('oauth_state'):
        return "Invalid state", 400
    
    # 4. トークンリクエスト
    tokens = exchange_code_for_tokens(code)
    
    # 5. トークン保存
    save_tokens_to_session(tokens)
    
    # 6. 一時データクリア
    clear_oauth_temp_data()
    
    # 7. リダイレクト
    return redirect('/home')
```

---

## トークンリフレッシュ処理

アクセストークンの有効期限が切れる前にリフレッシュ：

```python
def refresh_access_token():
    """アクセストークンをリフレッシュ"""
    refresh_token = session.get('refresh_token')
    
    if not refresh_token:
        return False
    
    response = requests.post(
        OAUTH_CONFIG['token_endpoint'],
        data={
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token,
            'client_id': OAUTH_CONFIG['client_id'],
            'client_secret': OAUTH_CONFIG['client_secret']
        }
    )
    
    if response.status_code == 200:
        tokens = response.json()
        session['access_token'] = tokens['access_token']
        session['refresh_token'] = tokens.get('refresh_token', refresh_token)
        return True
    
    return False
```

---

## セッション管理

### セッションの構造

```python
session = {
    # OAuth一時データ（認可フロー中のみ）
    'oauth_state': 'random-state-string',
    'oauth_code_verifier': 'random-verifier-string',
    
    # トークン（ログイン後）
    'access_token': 'jwt-access-token',
    'id_token': 'jwt-id-token',
    'refresh_token': 'random-refresh-token',
    'token_expires_at': datetime(2025, 12, 25, 12, 0, 0),
    
    # ユーザー情報（オプション）
    'user_id': 'user-uuid',
    'user_email': 'user@example.com',
    'user_name': 'ユーザー名'
}
```

### セッションのセキュリティ

1. **HTTPSのみ**: `cookie: { secure: true }`
2. **HttpOnly**: `cookie: { httpOnly: true }`
3. **SameSite**: `cookie: { sameSite: 'lax' }`
4. **タイムアウト**: 適切なセッションタイムアウトを設定

```python
# Flask
app.config.update(
    SESSION_COOKIE_SECURE=True,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    PERMANENT_SESSION_LIFETIME=timedelta(hours=24)
)
```

```javascript
// Express
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24時間
  }
}));
```

---

## まとめ

このサンプルコードを参考に、OAuth 2.0 SSOを実装してください。

### 実装パターンの選択

#### パターン1: ポータル経由のSSO（推奨）
- **メリット**: シンプル、`client_secret`管理不要、OAuth実装不要
- **デメリット**: ポータルに依存
- **適用**: ポータルと密接に連携するサービス

#### パターン2: 標準OAuth実装
- **メリット**: 独立して動作可能、標準的なOAuth 2.0フロー
- **デメリット**: 実装が複雑、`client_secret`の管理が必要
- **適用**: 独立したサービス、複数の認可サーバーに対応する必要がある場合

### 重要なポイント

1. **PKCE必須**: code_verifierとcode_challengeを正しく実装
2. **state検証**: CSRF攻撃を防ぐためにstateを必ず検証
3. **トークン管理**: アクセストークンとリフレッシュトークンを安全に保存
4. **エラーハンドリング**: すべてのエラーケースを適切に処理
5. **セキュリティ**: HTTPS、セッション管理、トークン保護を徹底
6. **トークン有効期限**: 
   - アクセストークン: 15分
   - IDトークン: 1時間
   - リフレッシュトークン: 30日
7. **認可コード有効期限**: 5分
8. **セッションタイムアウト**: 10分（ポータル経由のSSO）

---

## 参考資料

- [OAuth 2.0クライアント実装完全ガイド](./oauth-service-implementation-guide.md)
- [クライアント登録手順書](./oauth-client-registration-guide.md)
- [API仕様詳細](./oauth-api-specification.md)
