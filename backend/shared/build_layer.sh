#!/bin/bash
# Lambda Layer構築スクリプト
# 共有モジュールと依存関係をパッケージングします

set -e

echo "Lambda Layerを構築中..."

# 作業ディレクトリの作成
LAYER_DIR="layer"
rm -rf $LAYER_DIR
mkdir -p $LAYER_DIR/python

# 共有モジュールをコピー
echo "共有モジュールをコピー中..."
cp -r *.py $LAYER_DIR/python/

# 依存関係のインストール
echo "依存関係をインストール中..."
pip install -r requirements.txt -t $LAYER_DIR/python/ --upgrade

# ZIPファイルの作成
echo "ZIPファイルを作成中..."
cd $LAYER_DIR
zip -r ../shared-layer.zip python/
cd ..

# クリーンアップ
rm -rf $LAYER_DIR

echo "Lambda Layer構築完了: shared-layer.zip"
echo "サイズ: $(du -h shared-layer.zip | cut -f1)"
