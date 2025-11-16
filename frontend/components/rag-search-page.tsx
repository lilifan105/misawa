"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { searchDocuments } from "@/lib/api"
import { Search, FileText, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface SearchResult {
  documentId: string
  title: string
  content: string
  score: number
  s3Uri: string
  metadata: {
    pageNumber?: number
    [key: string]: any
  }
}

export function RagSearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  // 検索実行
  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setSearched(true)
    try {
      const response = await searchDocuments(query, 10)
      setResults(response.body?.results || response.results || [])
    } catch (error) {
      console.error("検索エラー:", error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  // Enterキーで検索
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  // 文書をクリックして詳細表示
  const handleDocumentClick = (result: SearchResult) => {
    const pageNumber = result.metadata?.pageNumber || 1
    router.push(`/view/${result.documentId}?page=${pageNumber}`)
  }

  // スコアを百分率に変換
  const formatScore = (score: number) => {
    return `${Math.round(score * 100)}%`
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* 検索ヘッダー */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">文書検索</h1>
        <p className="text-muted-foreground">
          AIを使った全文検索で、関連する文書を素早く見つけます
        </p>
      </div>

      {/* 検索バー */}
      <div className="mb-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder="検索キーワードを入力してください..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10"
              disabled={loading}
            />
          </div>
          <Button onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                検索中...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                検索
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 検索結果 */}
      {searched && (
        <div>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                {results.length}件の関連文書が見つかりました
              </div>
              <div className="space-y-4">
                {results.map((result, index) => (
                  <Card
                    key={index}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleDocumentClick(result)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <FileText className="h-5 w-5 text-primary mt-1" />
                          <div className="flex-1">
                            <CardTitle className="text-lg mb-1">
                              {result.title || result.documentId}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2">
                              {result.metadata?.pageNumber && (
                                <span>ページ {result.metadata.pageNumber}</span>
                              )}
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                関連度: {formatScore(result.score)}
                              </span>
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {result.content}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">検索結果が見つかりませんでした</p>
              <p className="text-sm text-muted-foreground">
                別のキーワードで検索してみてください
              </p>
            </div>
          )}
        </div>
      )}

      {/* 初期状態 */}
      {!searched && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">検索を開始してください</p>
          <p className="text-sm text-muted-foreground">
            キーワードを入力して、関連する文書を検索できます
          </p>
        </div>
      )}
    </div>
  )
}
