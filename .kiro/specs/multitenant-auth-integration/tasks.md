# 実装計画: マルチテナント認証・認可統合

## 概要

設計書に基づいて、マルチテナント認証・認可機能を段階的に実装する。各タスクは独立して実装・テスト可能であり、最終的にすべてのコンポーネントを統合する。

## タスク

- [x] 1. 共有モジュールの実装
  - backend/shared/ディレクトリを作成し、共通機能を実装
  - _要件: 1, 2, 5, 7_

- [x] 1.1 JWT検証モジュールの実装
  - backend/shared/jwt_validator.pyを作成
  - Cognitoの公開鍵（JWKS）を取得してキャッシュ
  - python-joseを使用してトークン署名を検証
  - custom:tenant_name、name、custom:roleクレームを抽出
  - _要件: 1.2, 1.3_

- [ ]* 1.2 JWT検証モジュールのユニットテスト
  - tests/unit/test_jwt_validator.pyを作成
  - 有効なトークンの検証テスト
  - 無効なトークンのエラーテスト
  - 期限切れトークンのエラーテスト
  - 必須クレーム欠落のエラーテスト
  - _要件: 1.4, 1.5_

- [x] 1.3 RDS接続モジュールの実装
  - backend/shared/rds_connection.pyを作成
  - psycopg2接続プールを実装（min_conn=2, max_conn=10）
  - SSL/TLS接続を強制（sslmode=require）
  - 接続リトライロジックを実装（最大3回、指数バックオフ）
  - _要件: 5.2, 5.3, 5.5_

- [ ]* 1.4 RDS接続モジュールのユニットテスト
  - tests/unit/test_rds_connection.pyを作成
  - 接続成功テスト（モック使用）
  - 接続失敗とリトライテスト
  - クエリ実行テスト
  - _要件: 5.4_

- [x] 1.5 サブスクリプション検証モジュールの実装
  - backend/shared/subscription_validator.pyを作成
  - tenant_nameからtenant_id（UUID）を取得する関数
  - tenant_idとservice_idでサブスクリプションを確認する関数
  - 結果を5分間キャッシュ
  - _要件: 2.2, 2.3, 2.6_

- [ ]* 1.6 サブスクリプション検証モジュールのユニットテスト
  - tests/unit/test_subscription_validator.pyを作成
  - テナントID解決テスト
  - アクティブなサブスクリプション確認テスト
  - サブスクリプションなしのテスト
  - 期限切れサブスクリプションのテスト
  - _要件: 2.4, 2.5_

- [x] 1.7 テナントコンテキストモジュールの実装
  - backend/shared/tenant_context.pyを作成
  - TenantContextデータクラスを定義
  - TenantContextManagerクラスを実装
  - リクエストスコープでコンテキストを管理
  - _要件: 7.1, 7.2_


- [ ]* 1.8 テナントコンテキストモジュールのユニットテスト
  - tests/unit/test_tenant_context.pyを作成
  - コンテキスト作成テスト
  - コンテキスト取得テスト
  - コンテキスト未設定時のエラーテスト
  - _要件: 7.1_

- [x] 2. Lambda Authorizerの実装
  - API Gatewayレベルでの認証・認可を実装
  - _要件: 1, 2, 4_

- [x] 2.1 Lambda Authorizer関数の作成
  - backend/functions/authorizer/lambda_function.pyを作成
  - Authorizationヘッダーからトークンを抽出
  - JWT検証モジュールを使用してトークンを検証
  - サブスクリプション検証モジュールを使用して権限を確認
  - IAM policyとコンテキストを返す
  - _要件: 1.1, 2.1, 4.1_

- [x] 2.2 Lambda Authorizer のエラーハンドリング
  - トークン欠落時のDenyポリシー返却
  - トークン無効時のDenyポリシー返却
  - サブスクリプションなし時のDenyポリシー返却
  - データベース接続エラー時のエラーハンドリング
  - _要件: 1.4, 1.5, 2.4, 5.4_

- [x] 2.3 Lambda Authorizer のログ記録
  - 構造化ログの実装
  - 認証成功/失敗のログ記録
  - tenant_name、tenant_id、username、actionをログに含める
  - _要件: 8.1, 8.4, 8.5_

- [ ]* 2.4 Lambda Authorizer の統合テスト
  - tests/integration/test_authorizer.pyを作成
  - 有効なトークンでのアクセス許可テスト
  - 無効なトークンでのアクセス拒否テスト
  - サブスクリプションなしでのアクセス拒否テスト
  - _要件: 4.1, 4.5_

- [x] 3. 既存Lambda関数の更新
  - documents、search関数にテナントコンテキストを統合
  - _要件: 4, 7_

- [x] 3.1 共有モジュールのLambda Layer作成
  - backend/shared/をLambda Layerとしてパッケージング
  - requirements.txtに依存関係を追加（python-jose、psycopg2）
  - Terraformでレイヤーをデプロイ
  - _要件: 1, 5_

- [x] 3.2 documents Lambda関数の更新
  - Lambda Authorizerから渡されたコンテキストを取得
  - TenantContextManagerを使用してコンテキストを作成
  - すべてのDynamoDBクエリにtenant_idフィルタを追加（将来の拡張）
  - ログにtenant_name、tenant_idを含める
  - _要件: 4.2, 4.4, 7.2, 7.4_

- [x] 3.3 search Lambda関数の更新
  - Lambda Authorizerから渡されたコンテキストを取得
  - TenantContextManagerを使用してコンテキストを作成
  - ログにtenant_name、tenant_idを含める
  - _要件: 4.2, 7.2, 7.4_

- [ ]* 3.4 既存Lambda関数のユニットテスト更新
  - テナントコンテキストを含むテストケースを追加
  - 認可失敗時の403エラーテスト
  - _要件: 4.5_

- [x] 4. フロントエンド認証モジュールの実装
  - JWTトークンの管理とAPIリクエストへの付与
  - _要件: 6_

- [x] 4.1 認証モジュールの作成
  - frontend/lib/auth.tsを作成
  - AuthManagerインターフェースを実装
  - sessionStorageを使用したトークン保存
  - トークンの有効性確認関数
  - トークンクレーム抽出関数（検証なし）
  - _要件: 6.1, 6.4_

- [x] 4.2 APIクライアントの更新
  - frontend/lib/api.tsを更新
  - すべてのAPI呼び出しにAuthorizationヘッダーを追加
  - 401エラー時のリダイレクト処理
  - _要件: 6.2, 6.3_

- [x] 4.3 トークン初期化処理の実装
  - frontend/app/layout.tsxまたはmiddleware.tsを更新
  - URLパラメータ?token=xxxからトークンを取得
  - トークンをsessionStorageに保存
  - beforeunloadイベントでトークンをクリア
  - _要件: 6.1, 6.5_

- [ ]* 4.4 フロントエンド認証モジュールのユニットテスト
  - tests/frontend/auth.test.tsを作成
  - トークン保存・取得・クリアのテスト
  - トークン有効性確認のテスト
  - クレーム抽出のテスト
  - _要件: 6.4_


- [x] 5. アクセス拒否画面の実装
  - 権限がない場合のユーザーフレンドリーな画面
  - _要件: 3_

- [x] 5.1 アクセス拒否ページの作成
  - frontend/app/access-denied/page.tsxを作成
  - テナント名とサービス名を表示
  - アクセス権限がないメッセージを表示
  - システム管理者への連絡先情報を表示
  - マルチテナントサービスへの戻るリンク
  - _要件: 3.1, 3.2, 3.3, 3.4_

- [x] 5.2 アクセス拒否画面のスタイリング
  - 既存のアプリケーションと同じヘッダーとスタイルを適用
  - レスポンシブデザイン対応
  - _要件: 3.5_

- [x] 5.3 403エラー時のリダイレクト処理
  - APIクライアントで403エラーをキャッチ
  - アクセス拒否画面にリダイレクト
  - テナント名とサービス名をクエリパラメータで渡す
  - _要件: 2.4, 3.1_

- [x] 6. インフラストラクチャの更新
  - Terraformでインフラを更新
  - _要件: 5, 9_

- [x] 6.1 Lambda Authorizer のTerraform設定
  - infrastructure/modules/lambda/authorizer.tfを作成
  - Lambda関数リソースを定義
  - VPC設定（RDSアクセス用）
  - セキュリティグループ設定
  - 環境変数設定
  - _要件: 5.1, 5.2_

- [x] 6.2 API Gateway Authorizer の設定
  - infrastructure/modules/api/main.tfを更新
  - Lambda Authorizerリソースを追加
  - すべてのルートにAuthorizerを適用
  - _要件: 4.1_

- [x] 6.3 Lambda Layer の設定
  - infrastructure/modules/lambda/layer.tfを作成
  - 共有モジュールのレイヤーを定義
  - 既存Lambda関数にレイヤーをアタッチ
  - _要件: 1_

- [x] 6.4 環境変数の設定
  - 既存Lambda関数に環境変数を追加
  - COGNITO_REGION、COGNITO_USER_POOL_ID
  - MULTITENANT_RDS_*（接続情報）
  - DOCUMENT_SERVICE_ID
  - MULTITENANT_MODE
  - _要件: 5.1, 10.4_

- [x] 6.5 VPCとセキュリティグループの設定
  - Lambda関数用のセキュリティグループを作成
  - RDSへのアウトバウンド通信を許可（ポート5432）
  - HTTPSへのアウトバウンド通信を許可（ポート443）
  - _要件: 5.2_

- [x] 7. サービス登録とデータベース初期化
  - マルチテナントサービスのデータベースに登録
  - _要件: 9_

- [x] 7.1 サービス登録SQLスクリプトの作成
  - scripts/register_service.sqlを作成
  - serviceテーブルにINSERT文を記述
  - service_id、service_name、description、service_url、icon_urlを設定
  - _要件: 9.1, 9.2, 9.3, 9.4_

- [x] 7.2 サービス登録の実行
  - マルチテナントサービスのRDSに接続
  - SQLスクリプトを実行
  - service_idを環境変数DOCUMENT_SERVICE_IDに設定
  - _要件: 9.5_

- [x] 7.3 テストテナントのサブスクリプション作成
  - tenant_service_subscriptionテーブルにテストデータを挿入
  - テスト用テナントに文書管理システムへのアクセス権を付与
  - _要件: 2.3_

- [ ] 8. 統合とE2Eテスト
  - すべてのコンポーネントを統合してテスト
  - _要件: 全体_

- [ ] 8.1 E2Eテストシナリオの作成
  - tests/e2e/test_multitenant_auth.pyを作成
  - 有効なトークンでのアクセステスト
  - 無効なトークンでのリダイレクトテスト
  - サブスクリプションなしでのアクセス拒否テスト
  - API呼び出しとデータ取得テスト
  - _要件: 全体_

- [ ]* 8.2 E2Eテストの実行
  - テスト環境でE2Eテストを実行
  - すべてのシナリオが成功することを確認
  - _要件: 全体_

- [x] 9. ドキュメントと設定ガイドの作成
  - 運用ドキュメントを作成
  - _要件: 10_

- [x] 9.1 環境変数設定ガイドの作成
  - docs/multitenant-setup.mdを作成
  - 必要な環境変数のリスト
  - 各環境変数の説明と設定例
  - _要件: 5.1, 10.4_

- [x] 9.2 モード切り替えガイドの作成
  - スタンドアロンモードとマルチテナントモードの切り替え手順
  - 環境変数MULTITENANT_MODEの設定方法
  - _要件: 10.1, 10.2, 10.3, 10.5_

- [x] 9.3 トラブルシューティングガイドの作成
  - よくあるエラーと対処方法
  - ログの確認方法
  - デバッグ手順
  - _要件: 8_

- [ ] 10. 最終チェックポイント
  - すべてのテストが成功することを確認
  - ドキュメントが完成していることを確認
  - ユーザーに質問があれば対応

## 注意事項

- `*`マークのタスクはオプション（テスト関連）で、より速いMVPのためにスキップ可能
- 各タスクは要件番号を参照しており、トレーサビリティを確保
- チェックポイントタスクで段階的な検証を実施
- プロパティテストは実装の正確性を検証するために重要
