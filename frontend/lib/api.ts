// API設定
const API_ENDPOINT = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:3000/api'

// 文書一覧取得
export async function getDocuments(params?: { category?: string; title?: string }) {
  const url = new URL(`${API_ENDPOINT}/documents`)
  if (params?.category) url.searchParams.append('category', params.category)
  if (params?.title) url.searchParams.append('title', params.title)
  
  const response = await fetch(url.toString())
  if (!response.ok) throw new Error('文書一覧の取得に失敗しました')
  return response.json()
}

// 文書詳細取得
export async function getDocument(id: string) {
  const response = await fetch(`${API_ENDPOINT}/documents/${id}`)
  if (!response.ok) throw new Error('文書の取得に失敗しました')
  return response.json()
}

// 文書登録
export async function createDocument(data: any) {
  const response = await fetch(`${API_ENDPOINT}/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) throw new Error('文書の登録に失敗しました')
  return response.json()
}

// 文書更新
export async function updateDocument(id: string, data: any) {
  const response = await fetch(`${API_ENDPOINT}/documents/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  if (!response.ok) throw new Error('文書の更新に失敗しました')
  return response.json()
}

// 文書削除
export async function deleteDocument(id: string) {
  const response = await fetch(`${API_ENDPOINT}/documents/${id}`, {
    method: 'DELETE'
  })
  if (!response.ok) throw new Error('文書の削除に失敗しました')
  return response.json()
}
