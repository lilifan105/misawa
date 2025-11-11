"use client"

import { useState } from "react"
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

export default function ConfirmPage() {
  const router = useRouter()
  const [showRegisterModal, setShowRegisterModal] = useState(false)

  const handleRegister = () => {
    setShowRegisterModal(true)
  }

  const handleConfirmRegister = () => {
    setShowRegisterModal(false)
    router.push("/complete")
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
                <div className="grid grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">文書種類</div>
                      <div className="flex-1 text-sm">通知</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">発信番号・部署</div>
                      <div className="flex-1 text-sm">XXX-001</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">タイトル</div>
                      <div className="flex-1 text-sm">重要なお知らせ</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">発信部門・部</div>
                      <div className="flex-1 text-sm">総務部</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">担当</div>
                      <div className="flex-1 text-sm">山田太郎</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">掲示期間</div>
                      <div className="flex-1 text-sm">2025年04月28日 〜 2025年05月31日</div>
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
                      <div className="flex-1 text-sm">2025年04月28日</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">更新日</div>
                      <div className="flex-1 text-sm">2025年04月28日</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">連絡先(外線)</div>
                      <div className="flex-1 text-sm">03-1234-5678</div>
                    </div>

                    <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <div className="w-32 text-sm font-medium text-gray-700">e-mail</div>
                      <div className="flex-1 text-sm">yamada@example.com</div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex gap-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                    <div className="w-32 text-sm font-medium text-gray-700">文書の属性</div>
                    <div className="flex-1 text-sm">
                      <div>重要度: 重要</div>
                      <div>開示範囲: 部全</div>
                      <div>新着順に表示: 表示</div>
                    </div>
                  </div>
                </div>
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
