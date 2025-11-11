import { SystemHeader } from "@/components/system-header"
import { DocumentViewerPage } from "@/components/document-viewer-page"

export default function ViewDocumentPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <SystemHeader breadcrumbs={[{ label: "トップページ", href: "/" }, { label: "文書閲覧画面" }]} />
      <DocumentViewerPage documentId={params.id} />
    </div>
  )
}
