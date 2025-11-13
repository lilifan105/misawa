"use client"

import { useSearchParams } from "next/navigation"
import { SystemHeader } from "@/components/system-header"
import { DocumentRegistrationForm } from "@/components/document-registration-form"

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const documentId = searchParams.get('id')
  
  return (
    <main className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <SystemHeader
        breadcrumbs={[
          { label: "トップページ", href: "/" },
          { label: documentId ? "文書編集画面" : "文書登録画面" },
          { label: "文書登録確認画面", disabled: true },
          { label: "完了画面", disabled: true },
        ]}
      />
      <DocumentRegistrationForm documentId={documentId} />
    </main>
  )
}
