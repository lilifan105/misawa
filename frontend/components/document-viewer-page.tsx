"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ZoomIn, ZoomOut, Download, Printer, ChevronLeft, ChevronRight, Trash2 } from "lucide-react"
import { getDocument, deleteDocument as apiDeleteDocument } from "@/lib/api"
import { useRouter } from "next/navigation"
import dynamic from 'next/dynamic'

const PDFViewer = dynamic(() => import('./pdf-viewer'), { ssr: false })

interface RelatedDocument {
  id: number
  title: string
  date: string
  type: string
}

interface PageThumbnail {
  pageNumber: number
  imageUrl: string
}

export function DocumentViewerPage({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"document" | "attributes">("document")
  const [currentPage, setCurrentPage] = useState(1)
  const [zoom, setZoom] = useState(100)
  const [pageInput, setPageInput] = useState("1")
  const [hoveredThumbnail, setHoveredThumbnail] = useState<number | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [document, setDocument] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [pdfUrl, setPdfUrl] = useState<string>('/sample.pdf')

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true)
        const doc = await getDocument(documentId)
        setDocument(doc)
        // S3からのPDF URLを設定
        if (doc.downloadUrl) {
          setPdfUrl(doc.downloadUrl)
        }
      } catch (error) {
        console.error('文書の取得に失敗:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchDocument()
  }, [documentId])

  const totalPages = 15

  const relatedDocuments: RelatedDocument[] = [
    { id: 1, title: "関連する技術情報ドキュメント", date: "25.04.25", type: "技術情報" },
    { id: 2, title: "製品仕様書 Ver2.0", date: "25.04.20", type: "製品情報" },
    { id: 3, title: "メンテナンス手順書", date: "25.04.18", type: "メンテナンス" },
    { id: 4, title: "セキュリティアップデート情報", date: "25.04.15", type: "技術情報" },
    { id: 5, title: "ユーザーマニュアル改訂版", date: "25.04.10", type: "マニュアル" },
    { id: 6, title: "システム要件定義書", date: "25.04.05", type: "技術情報" },
    { id: 7, title: "品質管理ガイドライン", date: "25.03.28", type: "規定" },
    { id: 8, title: "トラブルシューティングガイド", date: "25.03.25", type: "マニュアル" },
  ]

  const pageThumbnails: PageThumbnail[] = Array.from({ length: totalPages }, (_, i) => ({
    pageNumber: i + 1,
    imageUrl: `/placeholder.svg?height=150&width=120&query=Document page ${i + 1}`,
  }))

  const handleZoomIn = () => setZoom(Math.min(zoom + 10, 200))
  const handleZoomOut = () => setZoom(Math.max(zoom - 10, 50))
  const handlePrint = () => window.print()
  const handleDownload = () => {
    console.log("ダウンロード処理")
  }

  const handlePageDownload = (pageNum: number) => {
    console.log(`ページ ${pageNum} をダウンロード`)
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
      setPageInput(String(newPage))
    }
  }

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value)
  }

  const handlePageInputBlur = () => {
    const page = Number.parseInt(pageInput)
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    } else {
      setPageInput(String(currentPage))
    }
  }

  const documentAttributes = document ? {
    文書種類: document.type || '-',
    タイトル: document.title || '-',
    作成日: document.date || '-',
    表示終了日: document.endDate || '-',
    発番部署: document.department || '-',
    発番番号: document.number || '-',
    部署: document.division || '-',
    ステータス: document.status || '-',
  } : {}

  const handleDelete = async () => {
    try {
      await apiDeleteDocument(documentId)
      setShowDeleteModal(false)
      router.push('/')
    } catch (error) {
      console.error('文書の削除に失敗:', error)
      alert('文書の削除に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">文書が見つかりません</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="bg-white border-b px-8 py-3 flex items-center justify-between flex-shrink-0">
        <h2 className="text-gray-800 font-bold text-lg">{document.title || '文書詳細'}</h2>
      </div>

      <div className="bg-white border-b flex gap-1 px-8 pt-4 flex-shrink-0 justify-between items-end">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("document")}
            className={`px-6 py-2 font-medium transition-all duration-200 border-b-2 ${
              activeTab === "document"
                ? "border-blue-600 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-600 hover:text-blue-600 hover:bg-blue-50"
            }`}
          >
            文書
          </button>
          <button
            onClick={() => setActiveTab("attributes")}
            className={`px-6 py-2 font-medium transition-all duration-200 border-b-2 ${
              activeTab === "attributes"
                ? "border-blue-600 text-blue-600 bg-blue-50"
                : "border-transparent text-gray-600 hover:text-blue-600 hover:bg-blue-50"
            }`}
          >
            属性
          </button>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteModal(true)}
          className="mb-2 transition-all duration-200 hover:scale-105"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          削除
        </Button>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold mb-4">文書の削除</h3>
            <p className="text-gray-600 mb-6">この文書を削除してもよろしいですか？この操作は取り消せません。</p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
                className="transition-all duration-200 hover:scale-105"
              >
                キャンセル
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="transition-all duration-200 hover:scale-105"
              >
                削除
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-white border-r flex flex-col flex-shrink-0">
          <div className="flex-1 overflow-y-auto border-b">
            <div className="p-4">
              <h3 className="font-bold text-gray-800 mb-4 text-sm">関連文書</h3>
              <div className="space-y-2">
                {relatedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-blue-300"
                  >
                    <div className="text-sm font-medium text-blue-600 hover:underline mb-1">{doc.title}</div>
                    <div className="text-xs text-gray-500 flex justify-between">
                      <span>{doc.date}</span>
                      <span className="text-gray-600">{doc.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="h-80 overflow-y-auto">
            <div className="p-4">
              <h3 className="font-bold text-gray-800 mb-4 text-sm">ファイル一覧</h3>
              <div className="grid grid-cols-2 gap-3">
                {pageThumbnails.map((thumb) => (
                  <div
                    key={thumb.pageNumber}
                    className="relative group cursor-pointer"
                    onMouseEnter={() => setHoveredThumbnail(thumb.pageNumber)}
                    onMouseLeave={() => setHoveredThumbnail(null)}
                    onClick={() => handlePageChange(thumb.pageNumber)}
                  >
                    <div
                      className={`border rounded overflow-hidden transition-all duration-200 ${
                        currentPage === thumb.pageNumber
                          ? "ring-2 ring-blue-500 shadow-lg"
                          : "hover:ring-2 hover:ring-blue-300 hover:shadow-md"
                      }`}
                    >
                      <img
                        src={thumb.imageUrl || "/placeholder.svg"}
                        alt={`ページ ${thumb.pageNumber}`}
                        className="w-full h-auto"
                      />
                      <div className="bg-gray-100 px-2 py-1 text-center text-xs text-gray-700">
                        ページ {thumb.pageNumber}
                      </div>
                    </div>
                    {hoveredThumbnail === thumb.pageNumber && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded transition-opacity duration-200">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePageDownload(thumb.pageNumber)
                          }}
                          className="transition-transform duration-200 hover:scale-110"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          DL
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
          {activeTab === "document" ? (
            <>
              <div className="bg-white border-b px-6 py-3 flex items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomOut}
                    className="transition-all duration-200 hover:scale-105 bg-transparent"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[60px] text-center">{zoom}%</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomIn}
                    className="transition-all duration-200 hover:scale-105 bg-transparent"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="transition-all duration-200 hover:scale-105"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <Input
                      value={pageInput}
                      onChange={handlePageInputChange}
                      onBlur={handlePageInputBlur}
                      onKeyDown={(e) => e.key === "Enter" && handlePageInputBlur()}
                      className="w-16 text-center text-sm"
                    />
                    <span className="text-sm text-gray-600">/ {totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="transition-all duration-200 hover:scale-105"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                    className="transition-all duration-200 hover:scale-105 bg-transparent"
                  >
                    <Printer className="w-4 h-4 mr-1" />
                    印刷
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="transition-all duration-200 hover:scale-105 bg-transparent"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    ダウンロード
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center">
                <div
                  className="bg-white shadow-lg transition-all duration-300"
                  style={{
                    width: `${(zoom / 100) * 800}px`,
                    height: `${(zoom / 100) * 1100}px`,
                  }}
                >
                  <PDFViewer fileUrl={pdfUrl} pageNumber={currentPage} scale={zoom / 100} />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-auto p-6">
              <div className="bg-white rounded-lg border max-w-4xl mx-auto">
                <div className="p-6">
                  <h2 className="text-xl font-bold mb-6 text-gray-800">文書属性</h2>
                  <div className="space-y-4">
                    {Object.entries(documentAttributes).map(([key, value]) => (
                      <div key={key} className="flex border-b pb-3">
                        <div className="w-1/3 font-medium text-gray-700">{key}</div>
                        <div className="w-2/3 text-gray-900">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
