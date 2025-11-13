"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deleteDocument as apiDeleteDocument, getDocuments } from "@/lib/api"
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Edit, MoreVertical, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

interface Category {
  id: string
  name: string
  expanded?: boolean
  children?: Category[]
}

interface Document {
  id: string
  type: string
  date: string
  title: string
  endDate: string
  department: string
  number: string
  division: string
  topCategory?: string
  categories?: string[]
}

export function DocumentListPage() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState("メーカー発信文書")
  const [titleSearch, setTitleSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["maker"]))
  const [checkedCategories, setCheckedCategories] = useState<Set<string>>(new Set())
  const [selectedTopCategory, setSelectedTopCategory] = useState<string | null>("maker")
  const [sortField, setSortField] = useState<'type' | 'date' | 'title' | 'endDate' | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })

  // typeからtopCategoryへのマッピング
  const typeToTopCategory: Record<string, string> = {
    '通達': 'internal',
    '連絡': 'internal',
    '規定': 'internal',
    'お知らせ': 'internal',
    '報告書': 'internal',
    '製品情報': 'maker',
    '技術情報': 'maker',
    'マニュアル': 'manual',
    '会議資料': 'meeting'
  }

  const categories: Category[] = [
    {
      id: "maker",
      name: "メーカー発信文書",
      children: [
        {
          id: "maker-tech",
          name: "技術情報",
          children: [
            { id: "maker-tech-hard", name: "ハードウェア" },
            { id: "maker-tech-soft", name: "ソフトウェア" },
            { id: "maker-tech-network", name: "ネットワーク" },
          ],
        },
        {
          id: "maker-product",
          name: "製品情報",
          children: [
            { id: "maker-product-new", name: "新製品" },
            { id: "maker-product-update", name: "アップデート" },
          ],
        },
        { id: "maker-service", name: "サービス情報" },
        { id: "maker-maintenance", name: "メンテナンス情報" },
      ],
    },
    {
      id: "internal",
      name: "社内文書",
      children: [
        { id: "internal-notice", name: "通達" },
        { id: "internal-rules", name: "規定" },
        { id: "internal-announce", name: "お知らせ" },
        { id: "internal-report", name: "報告書" },
      ],
    },
    {
      id: "external",
      name: "外部文書",
      children: [
        { id: "external-partner", name: "取引先文書" },
        { id: "external-govt", name: "官公庁文書" },
      ],
    },
    {
      id: "manual",
      name: "マニュアル",
      children: [
        { id: "manual-operation", name: "操作マニュアル" },
        { id: "manual-maintenance", name: "保守マニュアル" },
        { id: "manual-training", name: "研修資料" },
      ],
    },
    {
      id: "meeting",
      name: "会議資料",
      children: [
        { id: "meeting-board", name: "取締役会" },
        { id: "meeting-dept", name: "部門会議" },
        { id: "meeting-project", name: "プロジェクト会議" },
      ],
    },
    {
      id: "hr",
      name: "人事関連",
      children: [
        { id: "hr-recruitment", name: "採用情報" },
        { id: "hr-evaluation", name: "評価制度" },
        { id: "hr-training", name: "研修制度" },
      ],
    },
    {
      id: "finance",
      name: "経理関連",
      children: [
        { id: "finance-expense", name: "経費精算" },
        { id: "finance-budget", name: "予算管理" },
      ],
    },
  ]

  const [allDocuments, setAllDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)

  // 文書一覧を取得
  const fetchDocuments = async (searchTitle?: string) => {
    try {
      setLoading(true)
      const params: any = {}
      if (searchTitle) params.title = searchTitle
      
      const response = await getDocuments(params)
      const docs = response.documents.map((doc: any) => ({
        id: doc.id,
        type: doc.type || '未分類',
        date: doc.date || '',
        title: doc.title || '無題',
        endDate: doc.endDate || '',
        department: doc.department || '',
        number: doc.number || '',
        division: doc.division || ''
      }))
      setAllDocuments(docs)
      setCurrentPage(1)
    } catch (error) {
      console.error('文書一覧の取得に失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [])

  const findCategoryById = (id: string, cats: Category[]): Category | null => {
    for (const cat of cats) {
      if (cat.id === id) return cat
      if (cat.children) {
        const found = findCategoryById(id, cat.children)
        if (found) return found
      }
    }
    return null
  }

  const getAllSubCategoryIds = (category: Category): string[] => {
    let ids: string[] = []
    if (category.children) {
      for (const child of category.children) {
        ids.push(child.id)
        ids = ids.concat(getAllSubCategoryIds(child))
      }
    }
    return ids
  }

  const getFilteredDocuments = () => {
    let filtered = allDocuments

    // 大カテゴリでフィルタ
    if (selectedTopCategory) {
      const topCat = categories.find(c => c.id === selectedTopCategory)
      if (topCat) {
        // typeフィールドが大カテゴリ名またはサブカテゴリ名を含むかチェック
        filtered = filtered.filter(doc => {
          // 大カテゴリ名でマッチ
          if (doc.type.includes(topCat.name)) return true
          // サブカテゴリ名でマッチ
          return getAllSubCategories(topCat).some(sub => doc.type.includes(sub.name))
        })
      }
    }

    // チェックされたサブカテゴリでさらにフィルタ
    if (checkedCategories.size > 0) {
      filtered = filtered.filter(doc => {
        return Array.from(checkedCategories).some(catId => {
          const category = findCategoryById(catId, categories)
          return category && doc.type.includes(category.name)
        })
      })
    }

    return filtered
  }

  const getAllSubCategories = (category: Category): Category[] => {
    let subs: Category[] = []
    if (category.children) {
      for (const child of category.children) {
        subs.push(child)
        subs = subs.concat(getAllSubCategories(child))
      }
    }
    return subs
  }

  const getSortedDocuments = (docs: Document[]) => {
    if (!sortField) return docs
    return [...docs].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      const comparison = aVal.localeCompare(bVal)
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }

  const handleSort = (field: 'type' | 'date' | 'title' | 'endDate') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const filteredDocuments = getSortedDocuments(getFilteredDocuments())
  const itemsPerPage = 10
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentDocuments = filteredDocuments.slice(startIndex, endIndex)

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    setCurrentPage(newPage)
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [checkedCategories, selectedTopCategory])

  const toggleCategory = (categoryId: string, isTopLevel: boolean) => {
    if (isTopLevel) {
      if (expandedCategories.has(categoryId)) {
        setExpandedCategories(new Set())
        setSelectedTopCategory(null)
      } else {
        setExpandedCategories(new Set([categoryId]))
        setSelectedTopCategory(categoryId)
        setCheckedCategories(new Set())
      }
    } else {
      const newExpanded = new Set(expandedCategories)
      if (newExpanded.has(categoryId)) {
        newExpanded.delete(categoryId)
      } else {
        newExpanded.add(categoryId)
      }
      setExpandedCategories(newExpanded)
    }
  }

  const toggleCheckbox = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newChecked = new Set(checkedCategories)
    if (newChecked.has(categoryId)) {
      newChecked.delete(categoryId)
    } else {
      newChecked.add(categoryId)
    }
    setCheckedCategories(newChecked)
  }

  const renderCategory = (category: Category, level = 0) => {
    const isExpanded = expandedCategories.has(category.id)
    const hasChildren = category.children && category.children.length > 0
    const isChecked = checkedCategories.has(category.id)
    const isTopLevel = level === 0

    return (
      <div key={category.id}>
        <div
          className={`flex items-center gap-2 py-2 px-3 cursor-pointer transition-all duration-200 ${
            isTopLevel
              ? "mx-2 mb-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow-sm hover:shadow-md hover:scale-[1.02] font-medium"
              : "hover:bg-blue-50 text-gray-700 hover:translate-x-1"
          }`}
          style={{ paddingLeft: isTopLevel ? "12px" : `${level * 16 + 12}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleCategory(category.id, isTopLevel)
            }
            setSelectedCategory(category.name)
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${isTopLevel ? "text-white" : "text-gray-600"}`}
              />
            ) : (
              <ChevronRight
                className={`w-4 h-4 transition-transform duration-200 ${isTopLevel ? "text-white" : "text-gray-600"}`}
              />
            )
          ) : (
            <span className="w-4"></span>
          )}
          {!isTopLevel && (
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => toggleCheckbox(category.id, e as any)}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          )}
          <span className={`text-sm ${isTopLevel ? "text-white" : "text-blue-700 hover:underline"}`}>
            {category.name}
          </span>
        </div>
        {hasChildren && isExpanded && (
          <div className="animate-in slide-in-from-top-2 duration-300">
            {category.children!.map((child) => renderCategory(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const getPaginationButtons = () => {
    const buttons = []
    const maxButtons = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2))
    const endPage = Math.min(totalPages, startPage + maxButtons - 1)

    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(i)
    }
    return buttons
  }

  const handleDelete = async (docId: string) => {
    try {
      await apiDeleteDocument(docId)
      setAllDocuments(prev => prev.filter(doc => doc.id !== docId))
      setShowDeleteModal(false)
      setDocumentToDelete(null)
      setActiveActionMenu(null)
    } catch (error) {
      console.error('文書の削除に失敗:', error)
      alert('文書の削除に失敗しました')
    }
  }

  const handleEdit = (docId: string) => {
    console.log(`文書 ${docId} を編集`)
    router.push(`/register?id=${docId}`)
    setActiveActionMenu(null)
  }

  const handleActionMenuClick = (e: React.MouseEvent, docId: string) => {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuPosition({
      top: rect.bottom,
      left: rect.left + rect.width + 8,
    })
    setActiveActionMenu(activeActionMenu === docId ? null : docId)
  }

  useEffect(() => {
    const handleClickOutside = () => {
      setActiveActionMenu(null)
    }

    if (activeActionMenu !== null) {
      document.addEventListener("click", handleClickOutside)
    }

    return () => {
      document.removeEventListener("click", handleClickOutside)
    }
  }, [activeActionMenu])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {activeActionMenu !== null && (
        <div
          className="fixed bg-white border rounded-lg shadow-xl z-50 min-w-[120px] animate-in fade-in zoom-in duration-200"
          style={{
            top: `${menuPosition.top}px`,
            left: `${menuPosition.left}px`,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleEdit(activeActionMenu)
            }}
            className="w-full flex items-center gap-2 px-4 py-2 hover:bg-blue-50 text-sm text-gray-700 transition-colors duration-150 rounded-t-lg"
          >
            <Edit className="w-4 h-4" />
            編集
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setDocumentToDelete(activeActionMenu)
              setShowDeleteModal(true)
            }}
            className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-50 text-sm text-red-600 transition-colors duration-150 rounded-b-lg"
          >
            <Trash2 className="w-4 h-4" />
            削除
          </button>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold mb-4">文書の削除</h3>
            <p className="text-gray-600 mb-6">この文書を削除してもよろしいですか？この操作は取り消せません。</p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false)
                  setDocumentToDelete(null)
                }}
                className="transition-all duration-200 hover:scale-105"
              >
                キャンセル
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(documentToDelete!)}
                className="transition-all duration-200 hover:scale-105"
              >
                削除
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border-b px-8 py-3 flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-bold text-gray-800 animate-in fade-in duration-300">{selectedCategory}</h2>
        <Button
          variant="outline"
          className="border-blue-500 text-blue-600 hover:bg-blue-50 bg-transparent transition-all duration-200 hover:scale-105"
        >
          よくある質問
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 bg-white border-r overflow-y-auto flex-shrink-0">
          <div className="py-4">{categories.map((category) => renderCategory(category))}</div>
        </div>

        <div className="flex-1 bg-gray-50 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">読み込み中...</div>
              </div>
            )}
            {!loading && (
            <>
            <div className="bg-white rounded-lg border p-4 mb-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium whitespace-nowrap">タイトル</label>
                <Input
                  value={titleSearch}
                  onChange={(e) => setTitleSearch(e.target.value)}
                  className="flex-1 transition-all duration-200 focus:scale-[1.01]"
                  placeholder="タイトルで検索"
                />
                <Button 
                  className="bg-gray-500 hover:bg-gray-600 text-white px-6 transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={() => fetchDocuments(titleSearch)}
                >
                  絞り込み
                </Button>
                <Button
                  variant="outline"
                  className="px-6 bg-transparent transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={() => {
                    setTitleSearch('')
                    fetchDocuments()
                  }}
                >
                  全表示
                </Button>
                <Button
                  variant="outline"
                  className="px-6 bg-transparent transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={() => fetchDocuments(titleSearch)}
                >
                  更新
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 w-16">操作</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                        <button
                          onClick={() => handleSort('type')}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          文書種類
                          {sortField === 'type' && (
                            sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 text-blue-600" /> : <ArrowDown className="w-4 h-4 text-blue-600" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                        <button
                          onClick={() => handleSort('date')}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          日付
                          {sortField === 'date' && (
                            sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 text-blue-600" /> : <ArrowDown className="w-4 h-4 text-blue-600" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                        <button
                          onClick={() => handleSort('title')}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          タイトル
                          {sortField === 'title' && (
                            sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 text-blue-600" /> : <ArrowDown className="w-4 h-4 text-blue-600" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">
                        <button
                          onClick={() => handleSort('endDate')}
                          className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                        >
                          表示終了日
                          {sortField === 'endDate' && (
                            sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 text-blue-600" /> : <ArrowDown className="w-4 h-4 text-blue-600" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">発番部署</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">発番番号</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">部署</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {currentDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-blue-50 transition-all duration-150 hover:shadow-sm">
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={(e) => handleActionMenuClick(e, doc.id)}
                            className="p-1 hover:bg-gray-200 rounded transition-all duration-200 hover:scale-110"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-600" />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => router.push(`/view/${doc.id}`)}>
                          {doc.type}
                        </td>
                        <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => router.push(`/view/${doc.id}`)}>
                          {doc.date}
                        </td>
                        <td
                          className="px-4 py-3 text-sm text-blue-600 hover:underline transition-all cursor-pointer"
                          onClick={() => router.push(`/view/${doc.id}`)}
                        >
                          {doc.title}
                        </td>
                        <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => router.push(`/view/${doc.id}`)}>
                          {doc.endDate}
                        </td>
                        <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => router.push(`/view/${doc.id}`)}>
                          {doc.department}
                        </td>
                        <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => router.push(`/view/${doc.id}`)}>
                          {doc.number}
                        </td>
                        <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => router.push(`/view/${doc.id}`)}>
                          {doc.division}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </>
            )}
          </div>

          <div className="bg-white border-t px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div className="text-sm text-gray-600 animate-in fade-in duration-300">
              全 {filteredDocuments.length} 件 ({startIndex + 1}-{Math.min(endIndex, filteredDocuments.length)} 件を表示)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(1)}
                className="transition-all duration-200 hover:scale-105 disabled:hover:scale-100 disabled:opacity-50"
                title="先頭へ"
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="transition-all duration-200 hover:scale-105 disabled:hover:scale-100 disabled:opacity-50"
              >
                前へ
              </Button>
              <div className="flex items-center gap-1">
                {getPaginationButtons().map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className={`w-8 h-8 p-0 transition-all duration-200 hover:scale-110 ${
                      currentPage === page ? "bg-blue-600 hover:bg-blue-700 scale-110 shadow-lg" : "hover:bg-blue-50"
                    }`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className="transition-all duration-200 hover:scale-105 disabled:hover:scale-100 disabled:opacity-50"
              >
                次へ
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(totalPages)}
                className="transition-all duration-200 hover:scale-105 disabled:hover:scale-100 disabled:opacity-50"
                title="末尾へ"
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
