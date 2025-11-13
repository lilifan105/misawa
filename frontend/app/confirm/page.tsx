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
import { createDocument } from "@/lib/api"

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

  useEffect(() => {
    // セッションストレージからデータを取得
    const savedData = sessionStorage.getItem('documentFormData')
    if (savedData) {
      setFormData(JSON.parse(savedData))
    } else {
      // データがない場合は登録画面に戻る
      router.push('/register')
    }
  }, [])

  const handleRegister = () => {
    setShowRegisterModal(true)
  }

  const handleConfirmRegister = async () => {
    if (!formData) return
    
    try {
      await createDocument(formData)
      // 登録成功後にセッションストレージをクリア
      sessionStorage.removeItem('documentFormData')
      setShowRegisterModal(false)
      router.push("/complete")
    } catch (error) {
      console.error('文書の登録に失敗:', error)
      alert('文書の登録に失敗しました')
      setShowRegisterModal(false)
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
              onClick={() => router.back()}
              className="px-12 py-3 text-base border-gray-400 text-gray-700 hover:bg-gray-100 bg-transparent transition-all duration-200 hover:scale-105 active:scale-95"
            >
              戻る
            </Button>
            <Button
              onClick={handleRegister}
              className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-3 text-base transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-lg"
            >
              登録
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
              className="bg-blue-600 hover:bg-blue-700 transition-all hover:scale-105"
            >
              登録
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
