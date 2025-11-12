import { SystemHeader } from "@/components/system-header"
import { DocumentViewerPage } from "@/components/document-viewer-page"

export function generateStaticParams() {
  return []
}

export const dynamicParams = true

export default async function ViewDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <SystemHeader breadcrumbs={[{ label: "トップページ", href: "/" }, { label: "文書閲覧画面" }]} />
      <DocumentViewerPage documentId={id} />
    </div>
  )
}
