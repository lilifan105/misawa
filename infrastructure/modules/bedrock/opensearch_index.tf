# OpenSearchインデックスは手動で作成する必要があります
#
# Terraform apply実行後、以下のコマンドでインデックスを作成してください：
#
# PowerShell:
# cd modules\bedrock\scripts
# .\create_index.ps1
#
# または、curlコマンドで直接作成：
# $endpoint = terraform output -raw collection_endpoint
# $body = Get-Content index_schema.json -Raw
# curl --aws-sigv4 "aws:amz:ap-northeast-1:aoss" `
#   --user "$env:AWS_ACCESS_KEY_ID:$env:AWS_SECRET_ACCESS_KEY" `
#   -X PUT `
#   -H "Content-Type: application/json" `
#   -d $body `
#   "$endpoint/bedrock-kb-index"
