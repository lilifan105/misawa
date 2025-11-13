'use client'

import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFViewerProps {
  fileUrl: string
  pageNumber?: number
  scale?: number
  onLoadSuccess?: (numPages: number) => void
}

export default function PDFViewer({ fileUrl, pageNumber = 1, scale = 1, onLoadSuccess }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
    if (onLoadSuccess) {
      onLoadSuccess(numPages)
    }
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
