import { SystemHeader } from "@/components/system-header"
import { DocumentViewerPage } from "@/components/document-viewer-page"

export function generateStaticParams() {
  return []
}

export const dynamicParams = true

export default async function ViewDocumentPage({ 
  params,
  searchParams 
}: { 
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { id } = await params
  const { page } = await searchParams
  const initialPage = page ? parseInt(page, 10) : undefined
  
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <SystemHeader breadcrumbs={[{ label: "トップページ", href: "/" }, { label: "文書閲覧画面" }]} />
      <DocumentViewerPage documentId={id} initialPage={initialPage} />
    </div>
  )
}
