import { SystemHeader } from "@/components/system-header"
import { RagSearchPage } from "@/components/rag-search-page"

export default function SearchPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <SystemHeader />
      <RagSearchPage />
    </div>
  )
}
