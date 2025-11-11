# Lambda Layers

## Powertools Layer

AWS Lambda Powertoolsを含むLayer

### ビルド方法

```powershell
cd backend/layers
.\build_powertools.ps1
```

### Layer構造

```
powertools.zip
└── python/
    └── aws_lambda_powertools/
        └── (Powertoolsのパッケージ)
```

### 利点

1. **デプロイサイズ削減**: 各Lambda関数のzipサイズが約10MB削減
2. **デプロイ速度向上**: Layerは一度だけアップロード
3. **バージョン管理**: Layer単位でバージョン管理
4. **再利用性**: 複数のLambda関数で共有

### サイズ比較

| 方式 | 関数サイズ | Layer サイズ | 合計 |
|------|-----------|-------------|------|
| Layer使用 | ~5KB | ~10MB | ~10MB |
| Layer未使用 | ~10MB | - | ~30MB (3関数) |

### 注意事項

- Layerは `/opt/python` にマウントされる
- `import aws_lambda_powertools` で自動的に読み込まれる
- Terraformで自動的にLambda関数にアタッチされる
