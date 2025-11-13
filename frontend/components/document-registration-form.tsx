"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createDocument, getUploadUrl, uploadToS3, getDocument, updateDocument } from "@/lib/api"
import { useEffect } from "react"
import { saveFile, getFile, clearFile } from "@/lib/fileStorage"

export function DocumentRegistrationForm({ documentId }: { documentId?: string | null }) {
  const [activeTab, setActiveTab] = useState<"attributes" | "display">("attributes")
  const [selectedUrgency, setSelectedUrgency] = useState("normal")
  const [showInNews, setShowInNews] = useState(false)
  const [displayInOrder, setDisplayInOrder] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [formData, setFormData] = useState({
    type: '',
    title: '',
    department: '',
    number: '',
    division: '',
    date: '',
    endDate: '',
    personInCharge: '',
    internalContact: '',
    externalContact: '',
    email: '',
    distributionTarget: ''
  })
  const [pdfFile, setPdfFile] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const loadData = async () => {
      // 確認画面から戻ってきた場合のみセッションストレージからデータを復元
      const savedData = sessionStorage.getItem('documentFormData')
      const fromConfirm = sessionStorage.getItem('fromConfirm')
      
      if (savedData && !documentId && fromConfirm === 'true') {
        const data = JSON.parse(savedData)
        setFormData({
          type: data.type || '',
          title: data.title || '',
          department: data.department || '',
          number: data.number || '',
          division: data.division || '',
          date: data.date || '',
          endDate: data.endDate || '',
          personInCharge: data.personInCharge || '',
          internalContact: data.internalContact || '',
          externalContact: data.externalContact || '',
          email: data.email || '',
          distributionTarget: data.distributionTarget || ''
        })
        // IndexedDBからファイルを復元
        const file = await getFile()
        if (file) {
          setSelectedFile(file)
          setPdfFile(URL.createObjectURL(file))
        }
        // フラグをクリア
        sessionStorage.removeItem('fromConfirm')
      } else if (!documentId) {
        // 新規登録の場合はセッションストレージとファイルをクリア
        sessionStorage.removeItem('documentFormData')
        await clearFile()
      }
    }
    loadData()

    if (documentId) {
      setIsEditMode(true)
      setLoading(true)
      getDocument(documentId)
        .then((doc) => {
          setFormData({
            type: doc.type || '',
            title: doc.title || '',
            department: doc.department || '',
            number: doc.number || '',
            division: doc.division || '',
            date: doc.date || '',
            endDate: doc.endDate || '',
            personInCharge: doc.personInCharge || '',
            internalContact: doc.internalContact || '',
            externalContact: doc.externalContact || '',
            email: doc.email || '',
            distributionTarget: doc.distributionTarget || ''
          })
          if (doc.fileName) {
            setPdfFile(doc.downloadUrl || '')
          }
        })
        .catch((error) => {
          console.error('文書の取得に失敗:', error)
          alert('文書の取得に失敗しました')
        })
        .finally(() => setLoading(false))
    }
  }, [documentId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      if (file.size > 10 * 1024 * 1024) {
        alert('ファイルサイズは10MB以下にしてください')
        return
      }
      const url = URL.createObjectURL(file)
      setPdfFile(url)
      setSelectedFile(file)
    } else if (file) {
      alert('PDFファイルを選択してください')
    }
  }

  const handleComplete = async () => {
    // 必須項目のバリデーション
    const errors = []
    if (!formData.type) errors.push('文書種類')
    if (!formData.title?.trim()) errors.push('タイトル')
    if (!formData.department?.trim()) errors.push('発信部門・部')
    if (!formData.date) errors.push('掲示期間（開始日）')
    if (!isEditMode && !selectedFile) errors.push('PDFファイル')
    
    if (errors.length > 0) {
      alert(`以下の必須項目を入力してください：\n${errors.join('、')}`)
      return
    }
    
    setUploading(true)
    try {
      const dataToSave: any = {
        type: formData.type,
        title: formData.title.trim(),
        department: formData.department.trim(),
        ...(formData.number?.trim() && { number: formData.number.trim() }),
        ...(formData.division?.trim() && { division: formData.division.trim() }),
        ...(formData.date && { date: formData.date }),
        ...(formData.endDate && { endDate: formData.endDate }),
        ...(formData.personInCharge?.trim() && { personInCharge: formData.personInCharge.trim() }),
        ...(formData.internalContact?.trim() && { internalContact: formData.internalContact.trim() }),
        ...(formData.externalContact?.trim() && { externalContact: formData.externalContact.trim() }),
        ...(formData.email?.trim() && { email: formData.email.trim() }),
        ...(formData.distributionTarget?.trim() && { distributionTarget: formData.distributionTarget.trim() }),
        ...(selectedFile && { fileName: selectedFile.name })
      }
      
      if (isEditMode) {
        // 編集モード：ファイルアップロード後に更新
        if (selectedFile && selectedFile.size) {
          const { uploadUrl, fileKey } = await getUploadUrl(selectedFile.name, selectedFile.type)
          await uploadToS3(uploadUrl, selectedFile)
          dataToSave.fileKey = fileKey
        }
        await updateDocument(documentId!, dataToSave)
        alert('文書を更新しました')
        router.push(`/view/${documentId}`)
      } else {
        // 新規登録：ファイルをIndexedDBに保存して確認画面へ
        if (selectedFile) {
          await saveFile(selectedFile)
        }
        sessionStorage.setItem('documentFormData', JSON.stringify(dataToSave))
        router.push("/confirm")
      }
    } catch (error) {
      console.error('処理エラー:', error)
      alert(isEditMode ? '文書の更新に失敗しました' : 'データの保存に失敗しました')
    } finally {
      setUploading(false)
    }
  }

  const handleCancel = () => {
    setShowCancelModal(true)
  }

  const handleConfirmCancel = async () => {
    sessionStorage.removeItem('documentFormData')
    await clearFile()
    setShowCancelModal(false)
    router.push("/")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header with tabs */}
        <div className="border-b bg-white flex-shrink-0">
          <div className="flex items-center justify-between px-6">
            <div className="flex">
              <button
                onClick={() => setActiveTab("attributes")}
                className={`px-6 py-3 font-medium text-sm transition-all duration-300 border-b-2 ${
                  activeTab === "attributes"
                    ? "border-blue-600 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                属性
              </button>
              <button
                onClick={() => setActiveTab("display")}
                className={`px-6 py-3 font-medium text-sm transition-all duration-300 border-b-2 ${
                  activeTab === "display"
                    ? "border-blue-600 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                表示先
              </button>
            </div>
            <div className="py-3">
              <Button
                variant="outline"
                size="sm"
                className="text-blue-600 bg-transparent transition-all hover:scale-105"
              >
                よくある質問
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
            <div className="bg-white border border-gray-300 rounded-lg p-6 animate-in fade-in duration-500">
              {activeTab === "attributes" && (
                <>
                  <div className="mb-6">
                    <div className="flex items-center gap-4">
                      <Label className="text-sm font-medium">文書種類 <span className="text-red-500">※</span></Label>
                      <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="通達">通達</SelectItem>
                          <SelectItem value="連絡">連絡</SelectItem>
                          <SelectItem value="製品情報">製品情報</SelectItem>
                          <SelectItem value="技術情報">技術情報</SelectItem>
                          <SelectItem value="規定">規定</SelectItem>
                          <SelectItem value="お知らせ">お知らせ</SelectItem>
                          <SelectItem value="報告書">報告書</SelectItem>
                          <SelectItem value="マニュアル">マニュアル</SelectItem>
                          <SelectItem value="会議資料">会議資料</SelectItem>
                          <SelectItem value="その他">その他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Section Title */}
                  <h2 className="text-lg font-semibold mb-4 pb-2 bg-gray-100 px-4 py-2 -mx-6 border-y border-gray-300">
                    基本情報
                  </h2>

                  {/* Required Fields Alert */}
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                    <p className="text-sm text-yellow-800">※ 印は必須項目は必ず入力してください。</p>
                  </div>

                  {/* Two Column Layout */}
                  <div className="grid grid-cols-2 gap-8 mb-8">
                    {/* Left Column */}
                    <div className="space-y-4">
                      {/* Document Number */}
                      <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                        <Label className="w-32 pt-2 text-sm font-medium">
                          発信番号 <span className="text-red-500">※</span>
                        </Label>
                        <div className="flex-1 flex items-center gap-2">
                          <Input 
                            className="flex-1" 
                            value={formData.number} 
                            onChange={(e) => setFormData({...formData, number: e.target.value})} 
                            placeholder="発信番号を入力"
                          />
                        </div>
                      </div>

                      {/* Title */}
                      <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                        <Label className="w-32 pt-2 text-sm font-medium">
                          タイトル <span className="text-red-500">※</span>
                        </Label>
                        <Input className="flex-1" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
                      </div>

                      {/* Department - Bu */}
                      <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                        <Label className="w-32 pt-2 text-sm font-medium">
                          発信部門・部 <span className="text-red-500">※</span>
                        </Label>
                        <Input className="flex-1" value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} />
                      </div>

                      {/* Department - Group */}
                      <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                        <Label className="w-32 pt-2 text-sm font-medium">発信部門・グループ</Label>
                        <Input className="flex-1" value={formData.division} onChange={(e) => setFormData({...formData, division: e.target.value})} />
                      </div>

                      {/* Person in Charge */}
                      <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                        <Label className="w-32 pt-2 text-sm font-medium">
                          担当 <span className="text-red-500">※</span>
                        </Label>
                        <Input className="flex-1" value={formData.personInCharge} onChange={(e) => setFormData({...formData, personInCharge: e.target.value})} />
                      </div>

                      <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                        <Label className="w-32 pt-2 text-sm font-medium">
                          掲示期間 <span className="text-red-500">※</span>
                        </Label>
                        <div className="flex-1 flex items-center gap-2">
                          <Input type="date" className="w-40" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                          <span className="mx-2">〜</span>
                          <Input type="date" className="w-40" value={formData.endDate} onChange={(e) => setFormData({...formData, endDate: e.target.value})} />
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      {/* Creator Name */}
                      <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                        <Label className="w-32 pt-2 text-sm font-medium">作成者名</Label>
                        <div className="flex-1 bg-gray-100 p-2 rounded text-sm">作成者名</div>
                      </div>

                      {/* Creation Date */}
                      <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                        <Label className="w-32 pt-2 text-sm font-medium">作成日</Label>
                        <div className="flex-1 bg-gray-100 p-2 rounded text-sm">2025年 04月 28日</div>
                      </div>

                      {/* Update Date */}
                      <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                        <Label className="w-32 pt-2 text-sm font-medium">更新日</Label>
                        <div className="flex-1 bg-gray-100 p-2 rounded text-sm">2025年 04月 28日</div>
                      </div>

                      {/* Contact (Internal) */}
                      <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                        <Label className="w-32 pt-2 text-sm font-medium">連絡先(内線)</Label>
                        <Input className="flex-1" value={formData.internalContact} onChange={(e) => setFormData({...formData, internalContact: e.target.value})} />
                      </div>

                      {/* Contact (External) */}
                      <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                        <Label className="w-32 pt-2 text-sm font-medium">
                          連絡先(外線) <span className="text-red-500">※</span>
                        </Label>
                        <Input className="flex-1" value={formData.externalContact} onChange={(e) => setFormData({...formData, externalContact: e.target.value})} />
                      </div>

                      {/* Email */}
                      <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                        <Label className="w-32 pt-2 text-sm font-medium">e-mail</Label>
                        <Input type="email" className="flex-1" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                      </div>

                      {/* Distribution Target */}
                      <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                        <Label className="w-32 pt-2 text-sm font-medium">配布対象</Label>
                        <textarea className="flex-1 border rounded-md p-2 min-h-[100px]" value={formData.distributionTarget} onChange={(e) => setFormData({...formData, distributionTarget: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  {/* Document Attributes Section */}
                  <div className="border-t-2 border-gray-300 pt-6 space-y-6">
                    {/* Urgency Level */}
                    <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <Label className="w-32 pt-2 text-sm font-medium">需要度</Label>
                      <div className="flex-1 flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Checkbox id="important" />
                          <label htmlFor="important" className="text-sm">
                            重要
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox id="urgent" />
                          <label htmlFor="urgent" className="text-sm">
                            至急
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Disclosure Range */}
                    <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <Label className="w-32 pt-2 text-sm font-medium">開示範囲</Label>
                      <div className="flex-1">
                        <RadioGroup value={selectedUrgency} onValueChange={setSelectedUrgency}>
                          <div className="space-y-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <RadioGroupItem value="all" id="all" />
                                <label htmlFor="all" className="text-sm">
                                  部全
                                </label>
                              </div>
                              <div className="text-xs text-blue-600 ml-6 mt-1">・M部署全員しかみられない</div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <RadioGroupItem value="group" id="group" />
                                <label htmlFor="group" className="text-sm">
                                  班全
                                </label>
                              </div>
                              <div className="text-xs text-blue-600 ml-6 mt-1">・M班署全員しかみられない</div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <RadioGroupItem value="mp-registered" id="mp-registered" />
                                <label htmlFor="mp-registered" className="text-sm">
                                  MP登録者
                                </label>
                              </div>
                              <div className="text-xs text-blue-600 ml-6 mt-1">・M作業者のみ(内容登録者と配布対象)</div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <RadioGroupItem value="city-mp" id="city-mp" />
                                <label htmlFor="city-mp" className="text-sm">
                                  出向部署MP登録者
                                </label>
                              </div>
                              <div className="text-xs text-blue-600 ml-6 mt-1">・M作業者のみ(内容登録者と配布対象)</div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <RadioGroupItem value="all-mp" id="all-mp" />
                                <label htmlFor="all-mp" className="text-sm">
                                  M部署MP登録者全員
                                </label>
                              </div>
                              <div className="text-xs text-blue-600 ml-6 mt-1">
                                ・M部署全員と配布対象(内容登録者と配布対象と関係者)
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <RadioGroupItem value="middle-manager" id="middle-manager" />
                                <label htmlFor="middle-manager" className="text-sm">
                                  中間管理者全員
                                </label>
                              </div>
                              <div className="text-xs text-blue-600 ml-6 mt-1">
                                ・M中間管理者全員と配布対象(内容登録者と配布対象と関係者)
                              </div>
                            </div>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>

                    {/* Display in Order */}
                    <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <Label className="w-32 pt-2 text-sm font-medium">新着順に表示する</Label>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="display-order"
                            checked={displayInOrder}
                            onCheckedChange={(checked) => setDisplayInOrder(checked as boolean)}
                          />
                          <label htmlFor="display-order" className="text-sm">
                            表示
                          </label>
                        </div>
                        <div className="text-xs text-blue-600 ml-6 mt-1">
                          ※一覧の上から5つまで表示される場合は表示される
                        </div>
                      </div>
                    </div>

                    {/* News Display */}
                    <div className="flex items-start gap-4 pb-4 border-b border-gray-200 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <Label className="w-32 pt-2 text-sm font-medium">お知らせ表示</Label>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="show-news"
                            checked={showInNews}
                            onCheckedChange={(checked) => setShowInNews(checked as boolean)}
                          />
                          <label htmlFor="show-news" className="text-sm">
                            表示
                          </label>
                        </div>
                        <div className="text-xs text-blue-600 ml-6 mt-1">
                          ※一覧の上から5つまで表示される場合は表示される
                        </div>
                      </div>
                    </div>

                    {/* PDF Upload */}
                    <div className="flex items-start gap-4 pb-4 transition-all duration-200 hover:bg-gray-50 hover:px-2 hover:-mx-2 rounded">
                      <Label className="w-32 pt-2 text-sm font-medium">PDFファイル</Label>
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="hidden"
                            id="pdf-upload"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => document.getElementById('pdf-upload')?.click()}
                          >
                            ファイルの選択
                          </Button>
                          <span className="text-sm text-gray-700">
                            {selectedFile ? selectedFile.name : 'ファイルが選択されていません'}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-blue-600 space-y-1">
                          <p>PDFファイルのみアップロード可能です。</p>
                          <p>ファイルサイズは10MB以下にしてください。</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "display" && (
                <div className="space-y-4 animate-in fade-in duration-500">
                  <h3 className="text-base font-semibold mb-4">表示先設定</h3>
                  {/* Additional display settings can be added here */}
                </div>
              )}
            </div>
        </div>

        <div className="border-t bg-white flex-shrink-0 px-6 py-4">
          <div className="flex justify-center gap-4">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="px-12 py-3 text-base border-gray-400 text-gray-700 hover:bg-gray-100 bg-transparent transition-all duration-200 hover:scale-105 active:scale-95"
            >
              取り消し
            </Button>
            <Button
              onClick={handleComplete}
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-3 text-base transition-all duration-200 hover:scale-105 active:scale-95 hover:shadow-lg disabled:opacity-50"
            >
{uploading ? (isEditMode ? '更新中...' : 'アップロード中...') : (isEditMode ? '更新' : '完了')}
            </Button>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold mb-4">確認</h3>
            <p className="text-gray-600 mb-6">入力内容を破棄してトップページに戻りますか?</p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowCancelModal(false)}
                className="transition-all duration-200 hover:scale-105"
              >
                キャンセル
              </Button>
              <Button
                onClick={handleConfirmCancel}
                className="bg-blue-600 hover:bg-blue-700 transition-all duration-200 hover:scale-105"
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      )}


    </>
  )
}
