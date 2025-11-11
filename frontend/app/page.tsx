"use client"

import { SystemHeader } from "@/components/system-header"
import { DocumentListPage } from "@/components/document-list-page"

export default function Home() {
  return (
    <main className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <SystemHeader showActionButtons />
      <DocumentListPage />
    </main>
  )
}
