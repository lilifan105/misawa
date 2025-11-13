"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { SystemHeader } from "@/components/system-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createDocument, getUploadUrl, uploadToS3 } from "@/lib/api"
import { getFile, clearFile } from "@/lib/fileStorage"
import dynamic from 'next/dynamic'

const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), { ssr: false })
const Page = dynamic(() => import('react-pdf').then(mod => mod.Page), { ssr: false })

interface FormData {
  type: string
  title: string
  department: string
  number: string
  division: string
  date: string
  endDate: string
  fileKey?: string
  fileName?: string
}

export default function ConfirmPage() {
  const router = useRouter()
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [formData, setFormData] = useState<FormData | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string>('')
  const [numPages, setNumPages] = useState(0)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    // react-pdfの初期化
    if (typeof window !== 'undefined') {
      import('react-pdf').then(mod => {
        import('react-pdf/dist/Page/AnnotationLayer.css')
        import('react-pdf/dist/Page/TextLayer.css')
        mod.pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${mod.pdfjs.version}/build/pdf.worker.min.mjs`
      })
    }

    const loadData = async () => {
      // セッションストレージからデータを取得
      const savedData = sessionStorage.getItem('documentFormData')
      if (savedData) {
        setFormData(JSON.parse(savedData))
        // IndexedDBからファイルを取得
        const file = await getFile()
        if (file) {
          setPdfFile(file)
          setPdfUrl(URL.createObjectURL(file))
        }
      } else {
        // データがない場合は登録画面に戻る
        router.push('/register')
      }
    }
    loadData()

    // クリーンアップ
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [])

  const handleRegister = () => {
    setShowRegisterModal(true)
  }

  const handleConfirmRegister = async () => {
    if (!formData || !pdfFile) return
    
    setUploading(true)
    try {
      // ファイルをアップロード
      const { uploadUrl, fileKey } = await getUploadUrl(pdfFile.name, pdfFile.type)
      await uploadToS3(uploadUrl, pdfFile)
      
      // 文書を登録
      await createDocument({
        ...formData,
        fileKey,
        fileName: pdfFile.name
      })
      
      // 登録成功後にセッションストレージとファイルをクリア
      sessionStorage.removeItem('documentFormData')
      await clearFile()
      setShowRegisterModal(false)
      router.push("/complete")
    } catch (error) {
      console.error('文書の登録に失敗:', error)
      alert('文書の登録に失敗しました')
      setShowRegisterModal(false)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <main className="h-screen flex flex-col bg-gray-50 overflow-hidden">
        <SystemHeader
          breadcrumbs={[
            { label: "トップページ", href: "/" },
            { label: "文書登録画面", href: "/register" },
            { label: "文書登録確認画面" },
            { label: "完了画面", disabled: true },
          ]}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6">
            <div className="bg-white border border-gray-300 rounded-lg p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl font-bold mb-6 pb-4 border-b">内容確認</h2>

              <div className="space-y-6">
                {formData ? (
                <>
                <div className="grid grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">文書種類</div>
                      <div className="flex-1 text-sm">{formData.type || '-'}</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">発番番号</div>
                      <div className="flex-1 text-sm">{formData.number || '-'}</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">タイトル</div>
                      <div className="flex-1 text-sm">{formData.title || '-'}</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">発信部門・部</div>
                      <div className="flex-1 text-sm">{formData.department || '-'}</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">発信部門・グループ</div>
                      <div className="flex-1 text-sm">{formData.division || '-'}</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">掲示期間</div>
                      <div className="flex-1 text-sm">
                        {formData.date || '-'} 〜 {formData.endDate || '-'}
                      </div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">PDFファイル</div>
                      <div className="flex-1 text-sm">{formData.fileName || '-'}</div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">担当</div>
                      <div className="flex-1 text-sm">{formData.personInCharge || '-'}</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">連絡先(内線)</div>
                      <div className="flex-1 text-sm">{formData.internalContact || '-'}</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">連絡先(外線)</div>
                      <div className="flex-1 text-sm">{formData.externalContact || '-'}</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">e-mail</div>
                      <div className="flex-1 text-sm">{formData.email || '-'}</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">配布対象</div>
                      <div className="flex-1 text-sm whitespace-pre-wrap">{formData.distributionTarget || '-'}</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">作成者名</div>
                      <div className="flex-1 text-sm">作成者名</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">作成日</div>
                      <div className="flex-1 text-sm">{new Date().toLocaleDateString('ja-JP')}</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">更新日</div>
                      <div className="flex-1 text-sm">{new Date().toLocaleDateString('ja-JP')}</div>
                    </div>
                  </div>
                </div>

                {/* PDFプレビュー */}
                {pdfUrl && (
                  <div className="mt-8 border-t pt-6">
                    <h3 className="text-lg font-bold mb-4">PDFプレビュー</h3>
                    <div className="border rounded-lg p-4 bg-gray-50 max-h-[600px] overflow-auto">
                      <Document
                        file={pdfUrl}
                        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                        loading={<div className="text-center py-8 text-gray-500">読み込み中...</div>}
                      >
                        {Array.from(new Array(numPages), (el, index) => (
                          <div key={`page_${index + 1}`} className="mb-4">
                            <Page
                              pageNumber={index + 1}
                              width={800}
                              renderTextLayer={false}
                              renderAnnotationLayer={false}
                            />
                          </div>
                        ))}
                      </Document>
                    </div>
                  </div>
                )}
                </>
                ) : (
                  <div className="text-center py-8 text-gray-500">読み込み中...</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t bg-white flex-shrink-0 px-6 py-4">
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                sessionStorage.setItem('fromConfirm', 'true')
                router.push('/register')
              }}
              className="px-12 py-3 text-base border-gray-400 text-gray-700 hover:bg-gray-100 bg-transparent transition-all duration-200 hover:scale-105 active:scale-95"
            >
              戻る
            </Button>
            <Button
              onClick={handleRegister}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-3 text-base transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-lg disabled:opacity-50"
            >
              {uploading ? '登録中...' : '登録'}
            </Button>
          </div>
        </div>
      </main>

      <Dialog open={showRegisterModal} onOpenChange={setShowRegisterModal}>
        <DialogContent className="animate-in fade-in zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle>確認</DialogTitle>
            <DialogDescription>この内容で登録しますか?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRegisterModal(false)}
              className="transition-all hover:scale-105"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleConfirmRegister}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700 transition-all hover:scale-105 disabled:opacity-50"
            >
              {uploading ? '登録中...' : '登録'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
