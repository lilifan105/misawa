'use client';

/**
 * アクセス拒否画面
 * 
 * テナントがサービスへのアクセス権限を持たない場合に表示されます。
 */

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AlertCircle, ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

function AccessDeniedContent() {
  const searchParams = useSearchParams();
  const tenantName = searchParams.get('tenant') || '不明なテナント';
  const serviceName = searchParams.get('service') || '文書管理システム';
  const reason = searchParams.get('reason') || 'アクセス権限がありません';
  const contactEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@example.com';
  const multitenantUrl = process.env.NEXT_PUBLIC_MULTITENANT_URL || 'https://portal.example.com';
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-3xl font-bold">
            アクセス権限がありません
          </CardTitle>
          <CardDescription className="text-lg">
            このサービスへのアクセスが許可されていません
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {tenantName !== '不明なテナント' ? (
                <>
                  お客様のテナント <strong className="font-semibold">{tenantName}</strong> は、
                  <strong className="font-semibold">{serviceName}</strong> へのアクセス権限がありません。
                </>
              ) : (
                <>
                  <strong className="font-semibold">{serviceName}</strong> へのアクセスが拒否されました。
                </>
              )}
            </AlertDescription>
          </Alert>
          
          {/* デバッグ情報: 拒否理由 */}
          {reason && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-sm text-yellow-800 dark:text-yellow-200">
                拒否理由（デバッグ情報）
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 font-mono">
                {reason}
              </p>
            </div>
          )}
          
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-lg">このサービスを利用するには</h3>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>システム管理者にサービスへのアクセス権限をリクエストしてください</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>サブスクリプションプランの確認が必要な場合があります</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>契約内容によっては、追加のサービス契約が必要です</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-lg flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                お問い合わせ
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                ご不明な点がございましたら、システム管理者までお問い合わせください。
              </p>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">連絡先:</span>
                <a 
                  href={`mailto:${contactEmail}`}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {contactEmail}
                </a>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              onClick={() => window.location.href = multitenantUrl}
              className="flex-1"
              size="lg"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              ポータルに戻る
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="flex-1"
              size="lg"
            >
              再試行
            </Button>
          </div>
          
          <div className="text-center text-xs text-gray-500 dark:text-gray-400 pt-4 border-t">
            <p>テナント: {tenantName}</p>
            <p>サービス: {serviceName}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">読み込み中...</div>
      </div>
    }>
      <AccessDeniedContent />
    </Suspense>
  );
}
