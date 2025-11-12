'use client'

import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFViewerProps {
  fileUrl: string
  pageNumber?: number
  scale?: number
}

export default function PDFViewer({ fileUrl, pageNumber = 1, scale = 1 }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
  }

  return (
    <div className="h-full w-full flex items-center justify-center overflow-auto">
      <Document
        file={fileUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={<div className="text-gray-500">読み込み中...</div>}
        error={<div className="text-red-500">PDFの読み込みに失敗しました</div>}
      >
        <Page pageNumber={pageNumber} scale={scale} />
      </Document>
    </div>
  )
}
