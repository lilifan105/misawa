"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { searchDocuments } from "@/lib/api"
import { FileText, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface SearchResult {
  documentId: string
  title: string
  content: string
  score: number
  s3Uri: string
  metadata: Record<string, any>
}

export function RagSearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setSearched(true)
    setCurrentPage(1)
    try {
      const response = await searchDocuments(query, 50)
      console.log("検索レスポンス:", response)
      const results = response.body?.results || response.results || []
      console.log("検索結果:", results)
      setResults(results)
    } catch (error) {
      console.error("検索エラー:", error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const formatScore = (score: number) => {
    return `${Math.round(score * 100)}%`
  }

  const handleDocumentClick = (result: SearchResult) => {
    const page = result.metadata?.['x-amz-bedrock-kb-document-page-number'] || result.metadata?.pageNumber || result.metadata?.page
    
    console.log('遷移先documentId:', result.documentId, 'page:', page)
    
    if (page) {
      router.push(`/view/${result.documentId}?page=${page}`)
    } else {
      router.push(`/view/${result.documentId}`)
    }
  }



  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-white border-b px-8 py-3 flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-bold text-gray-800 animate-in fade-in duration-300">AI全文検索</h2>
        <Button
          variant="outline"
          onClick={() => router.push("/")}
          className="border-blue-500 text-blue-600 hover:bg-blue-50 bg-transparent transition-all duration-200 hover:scale-105"
        >
          一覧ページに戻る
        </Button>
      </div>

      <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-lg border p-4 mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium whitespace-nowrap">検索</label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 transition-all duration-200 focus:scale-[1.01]"
                placeholder="文書の内容を検索"
              />
              <Button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                {loading ? "検索中..." : "検索"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("")
                  setResults([])
                  setSearched(false)
                  setCurrentPage(1)
                }}
                className="px-6 bg-transparent transition-all duration-200 hover:scale-105 active:scale-95"
              >
                クリア
              </Button>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">検索中...</div>
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">検索結果が見つかりませんでした</p>
            </div>
          )}

          {!loading && !searched && (
            <div className="text-center py-12">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">キーワードを入力して検索してください</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="max-w-4xl mx-auto space-y-2">
              <div className="text-sm text-gray-600 mb-3">
                {results.length}件の結果が見つかりました
              </div>
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
          )}
        </div>


      </div>
    </div>
  )
}
