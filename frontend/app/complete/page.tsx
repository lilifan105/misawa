"use client"

import { useRouter } from "next/navigation"
import { SystemHeader } from "@/components/system-header"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"

export default function CompletePage() {
  const router = useRouter()

  return (
    <main className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <SystemHeader
        breadcrumbs={[
          { label: "トップページ", href: "/" },
          { label: "文書登録画面", href: "/register" },
          { label: "文書登録確認画面", href: "/confirm" },
          { label: "完了画面" },
        ]}
      />

      <div className="flex-1 overflow-y-auto flex items-center justify-center">
        <div className="max-w-4xl mx-auto p-6 text-center">
          <div className="flex justify-center mb-6 animate-in fade-in zoom-in duration-500">
            <CheckCircle2 className="w-24 h-24 text-green-500 animate-in spin-in duration-700" />
          </div>

          <h2
            className="text-2xl font-bold mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: "200ms" }}
          >
            登録が完了しました
          </h2>

          <p
            className="text-gray-600 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: "400ms" }}
          >
            文書の登録が正常に完了しました。
          </p>
        </div>
      </div>

      <div className="border-t bg-white flex-shrink-0 px-6 py-4">
        <div className="flex justify-center gap-4">
          <Button
            onClick={() => router.push("/")}
            className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-3 text-base transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"
          >
            トップへ戻る
          </Button>
        </div>
      </div>
    </main>
  )
}
