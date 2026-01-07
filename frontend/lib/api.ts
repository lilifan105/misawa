import { authManager, getIdToken } from './auth';

// API設定
const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:3000/api';
const MULTITENANT_MODE = process.env.NEXT_PUBLIC_MULTITENANT_MODE === 'true';
const MULTITENANT_URL = process.env.NEXT_PUBLIC_MULTITENANT_URL || 'https://portal.example.com';

/**
 * 認証ヘッダーを取得
 * マルチテナントモードの場合、JWTトークンをAuthorizationヘッダーに含めます。
 * 
 * 重要: Cognitoのカスタム属性（tenant_name、role）はIDトークンにのみ含まれるため、
 * API呼び出しにはid_tokenを使用します。access_tokenにはカスタム属性が含まれません。
 */
function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  
  if (MULTITENANT_MODE) {
    // IDトークンを使用（カスタム属性が含まれる）
    const token = getIdToken();
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      console.error('トークンが取得できません');
    }
  }
  
  return headers;
}

/**
 * APIリクエストのエラーハンドリング
 * 401エラーと403エラーの場合、アクセス拒否画面にリダイレクトします。
 */
async function handleApiResponse(response: Response) {
  if (response.status === 401) {
    console.error('認証エラー: トークンが無効または期限切れです');
    
    if (MULTITENANT_MODE && typeof window !== 'undefined') {
      // トークンをクリア
      authManager.clearToken();
      
      // アクセス拒否画面にリダイレクト（401エラー用の理由を追加）
      const tenantInfo = authManager.getTokenClaims();
      const tenantName = tenantInfo?.['custom:tenant_name'] || 'unknown';
      window.location.href = `/access-denied?tenant=${encodeURIComponent(tenantName)}&service=文書管理システム&reason=${encodeURIComponent('認証エラー: ログインが必要です')}`;
    }
    
    throw new Error('認証エラー: ログインが必要です');
  }
  
  if (response.status === 403) {
    console.error('認可エラー: アクセス権限がありません');
    
    if (MULTITENANT_MODE && typeof window !== 'undefined') {
      // アクセス拒否画面にリダイレクト
      const tenantInfo = authManager.getTokenClaims();
      const tenantName = tenantInfo?.['custom:tenant_name'] || 'unknown';
      window.location.href = `/access-denied?tenant=${encodeURIComponent(tenantName)}&service=文書管理システム&reason=${encodeURIComponent('アクセス権限がありません')}`;
    }
    
    throw new Error('アクセス権限がありません');
  }
  
  if (!response.ok) {
    throw new Error(`APIエラー: ${response.status} ${response.statusText}`);
  }
  
  return response;
}

// 文書一覧取得
export async function getDocuments(params?: { category?: string; title?: string }) {
  const url = new URL(`${API_ENDPOINT}/documents`);
  if (params?.category) url.searchParams.append('category', params.category);
  if (params?.title) url.searchParams.append('title', params.title);
  
  const response = await fetch(url.toString(), {
    headers: getAuthHeaders()
  });
  await handleApiResponse(response);
  return response.json();
}

// 文書詳細取得
export async function getDocument(id: string) {
  const response = await fetch(`${API_ENDPOINT}/documents/${id}`, {
    headers: getAuthHeaders()
  });
  await handleApiResponse(response);
  return response.json();
}

// 文書登録
export async function createDocument(data: any) {
  const response = await fetch(`${API_ENDPOINT}/documents`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  await handleApiResponse(response);
  return response.json();
}

// 文書更新
export async function updateDocument(id: string, data: any) {
  const response = await fetch(`${API_ENDPOINT}/documents/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  await handleApiResponse(response);
  return response.json();
}

// 文書削除
export async function deleteDocument(id: string) {
  const response = await fetch(`${API_ENDPOINT}/documents/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  await handleApiResponse(response);
  return response.json();
}

// 署名付きURL取得
export async function getUploadUrl(fileName: string, fileType: string) {
  const response = await fetch(`${API_ENDPOINT}/documents/upload-url`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fileName, fileType })
  });
  await handleApiResponse(response);
  return response.json();
}

// S3へ直接アップロード
export async function uploadToS3(url: string, file: File) {
  const response = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type }
  });
  if (!response.ok) throw new Error('ファイルのアップロードに失敗しました');
}

// RAG全文検索
export async function searchDocuments(query: string, numberOfResults: number = 10) {
  const response = await fetch(`${API_ENDPOINT}/search`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ query, numberOfResults })
  });
  await handleApiResponse(response);
  return response.json();
}
