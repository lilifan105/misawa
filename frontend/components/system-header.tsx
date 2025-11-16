"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface SystemHeaderProps {
  showActionButtons?: boolean
  breadcrumbs?: { label: string; href?: string; disabled?: boolean }[]
}

export function SystemHeader({ showActionButtons = false, breadcrumbs }: SystemHeaderProps) {
  const router = useRouter()

  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg flex-shrink-0 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="px-8 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wide">文書管理システム</h1>

        {showActionButtons && (
          <div className="flex gap-3">
            <Button
              onClick={() => router.push("/register")}
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold px-6 transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"
            >
              新規登録
            </Button>
            <Button
              onClick={() => router.push("/search")}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 transition-all duration-200 hover:scale-105 hover:shadow-lg active:scale-95"
            >
              全文検索
            </Button>
          </div>
        )}
      </div>

      {breadcrumbs && breadcrumbs.length > 0 && (
        <div className="px-8 py-2 bg-blue-800 bg-opacity-50 text-sm">
          <div className="flex items-center gap-2">
            {breadcrumbs.map((crumb, index) => (
              <div
                key={index}
                className="flex items-center gap-2 animate-in fade-in duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {crumb.href && !crumb.disabled ? (
                  <button
                    onClick={() => router.push(crumb.href!)}
                    className="hover:underline text-blue-100 hover:text-white transition-all duration-200 hover:scale-105"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className={crumb.disabled ? "text-blue-300 opacity-60" : "text-white"}>{crumb.label}</span>
                )}
                {index < breadcrumbs.length - 1 && <span className="text-blue-200">→</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
