1.	D:\Project\CGU\fhir-smart-docker
    SMART Launcher：http://localhost:9009 
    Keycloak：http://localhost:8080
    FHIR Server：http://localhost:8083/fhir/ 
    Platform：http://localhost:8085
2.	D:\Project\CGU\fhir-smart-docker\TWCOREDATA：python app.py
    http://localhost:5000/


# 指令
## Docker
docker ps 查看
docker stop + docker rm 刪除
docker-compose build 建構image
docker-compose up -d 啟動容器
docker builder prune --all --force 清快取
docker container prune -f 移除所有停止或退出的容器
docker compose down -v --remove-orphans 確保移除所有相關資源

## platform
npm install
npm start


## 測試 OAuth2：
### CMD確認
1. 進入容器 Shell
    docker run --rm -it --network fhirnet curlimages/curl:latest sh
2. 在容器內測試 JWKS URI
    curl -v http://keycloak:8080/realms/fhir/protocol/openid-connect/certs
    "HTTP/1.1 200 OK"：Keycloak 公鑰服務正常
3. exit 退出容器 shell
### PowerShell
1. 獲取 Access Token 
    $tokenResult = Invoke-WebRequest -Method POST -Uri http://localhost:8080/realms/fhir/protocol/openid-connect/token -Headers @{"Content-Type" = "application/x-www-form-urlencoded"} -Body "grant_type=password&client_id=hapi-fhir-client&client_secret=hapi-secret&username=fhir-admin&password=fhir-admin" | ConvertFrom-Json
2. 複製
    $token = $tokenResult.access_token
    Write-Host "請複製此 Token：$token"
3. 執行授權請求 (抓取 Patient 資料)
    1. 禁用 SSL 憑證檢查 (這是必須的，因為伺服器使用自簽憑證)
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    2. 構建 Headers
        $headers = @{"Authorization" = "Bearer $token"}
    3. 執行請求 (目標：/Patient)
        Invoke-RestMethod -Method Get -Uri "https://localhost:8083/fhir-server/api/v4/Patient" -Headers $headers -UseBasicParsing



4. Keycloak驗證

$token = curl -X POST http://localhost:8080/realms/fhir/protocol/openid-connect/token -H "Content-Type: application/ x-www-form-urlencoded" -d "grant_type=password&client_id=hapi-fhir-client&client_secret=hapi-secret&username=fhir-admin&password=fhir-admin" | ConvertFrom-Json




https://localhost:8443/fhir-server/api/v4/metadata
 

