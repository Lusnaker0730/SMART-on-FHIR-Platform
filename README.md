# SMART on FHIR Platform

這是一個完整的 SMART on FHIR 開發環境，包含授權伺服器、FHIR 資源伺服器和 SMART 應用程式。

## 🏗️ 架構

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  SMART Launcher │────▶│    Keycloak     │────▶│   FHIR Server   │
│   (Port 9009)   │     │   (Port 8080)   │     │   (Port 8083)   │
└────────┬────────┘     └───────┬─────────┘     └────────┬────────┘
         │                      │                        │
         │              ┌───────▼─────────┐              │
         │              │   PostgreSQL    │◀─────────────┘
         │              │   (Port 5432)   │
         │              └─────────────────┘
         ▼                       
┌─────────────────────────────────────────────────────────────────┐
│                      Platform (Port 8085)                        │
│                 CGMH EHRCALC on FHIR 應用程式                    │
└─────────────────────────────────────────────────────────────────┘
```

## ✅ 驗證狀態

| 組件 | 狀態 | 說明 |
|------|------|------|
| Keycloak OIDC | ✅ 正常 | Token 獲取、JWKS 端點正常 |
| IBM FHIR Server | ✅ 正常 | Metadata、Patient CRUD 正常 |
| SMART Launcher | ✅ 正常 | EHR 模擬頁面可用 |
| Platform | ✅ 正常 | 計算器應用正常運行 |
| Standalone Launch | ✅ 正常 | 完整 OAuth 流程驗證通過 |
| EHR Launch | ⚠️ 部分 | 需要預設 Patient ID |

## 📦 服務列表

| 服務 | URL | 說明 |
|------|-----|------|
| SMART Launcher | http://localhost:9009 | SMART 應用程式啟動器 |
| Keycloak | http://localhost:8080 | OAuth 2.0 授權伺服器 |
| Keycloak Admin | http://localhost:8080/admin | Keycloak 管理介面 |
| FHIR Server | http://localhost:8083/fhir-server | IBM FHIR Server R4 |
| FHIR Metadata | http://localhost:8083/fhir-server/metadata | FHIR CapabilityStatement |
| Platform | http://localhost:8085 | CGMH EHRCALC 前端應用 |

## 🚀 快速開始

### 1. 啟動所有服務

```bash
# 進入專案目錄
cd SMART-on-FHIR-Platform

# 建構並啟動所有容器
docker-compose up -d --build

# 查看容器狀態
docker ps
```

### 2. 等待服務就緒

服務啟動需要一些時間，特別是 FHIR Server（需要初始化數據庫 Schema，約 2-3 分鐘）：

```bash
# 查看日誌
docker-compose logs -f

# 或查看特定服務
docker-compose logs -f fhir-server
```

等待看到以下訊息表示服務已就緒：
- Keycloak: `Running the server in development mode`
- FHIR Server: `The defaultServer server is ready to run a smarter planet`

### 3. 創建測試 Patient（可選）

```powershell
# 獲取 Token
$tokenResult = Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8080/realms/fhir/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "grant_type=password&client_id=hapi-fhir-client&client_secret=hapi-secret&username=fhir-admin&password=fhir-admin"
$token = $tokenResult.access_token

# 創建 Patient
$patientJson = @'
{
  "resourceType": "Patient",
  "id": "test-patient-1",
  "name": [{"use": "official", "family": "Test", "given": ["Patient"]}],
  "gender": "male",
  "birthDate": "1990-01-15"
}
'@

Invoke-RestMethod -Uri "http://localhost:8083/fhir-server/Patient/test-patient-1" `
    -Method Put `
    -Headers @{"Authorization"="Bearer $token"; "Content-Type"="application/fhir+json"} `
    -Body $patientJson
```

### 4. 訪問應用程式

#### 方式一：Standalone Launch（推薦用於測試）

1. 直接訪問 http://localhost:8085/launch.html
2. 系統會自動重定向到 Keycloak 登入頁面
3. 使用 `fhir-admin` / `fhir-admin` 登入
4. 登入成功後自動返回 Platform 應用

#### 方式二：EHR Launch（通過 SMART Launcher）

1. 訪問 http://localhost:9009
2. 設定以下參數：
   - **Launch Type**: `Provider EHR Launch`
   - **Patient ID**: `test-patient-1`（需先創建）
   - **App Launch URL**: `http://localhost:8085/launch.html`
3. 點擊 `Launch App!`
4. 在 EHR 模擬頁面登入並選擇 Patient

### 5. 登入資訊

| 用戶名 | 密碼 | 說明 |
|--------|------|------|
| fhir-admin | fhir-admin | FHIR 管理員（用於 Platform 登入） |
| admin | admin | Keycloak 管理員（用於管理介面） |

## 🔧 常用指令

### Docker 相關

```bash
# 查看容器狀態
docker ps

# 查看日誌
docker-compose logs -f [service_name]

# 停止所有容器
docker-compose stop

# 停止並移除所有容器
docker-compose down

# 完全清理（包含 volumes）- 會重置數據庫
docker-compose down -v --remove-orphans

# 重新建構並啟動
docker-compose up -d --build

# 進入容器 shell
docker exec -it [container_name] sh
```

### 測試 OAuth2

```powershell
# 獲取 Access Token
$tokenResult = Invoke-RestMethod -Method POST `
    -Uri "http://localhost:8080/realms/fhir/protocol/openid-connect/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body "grant_type=password&client_id=hapi-fhir-client&client_secret=hapi-secret&username=fhir-admin&password=fhir-admin"

$token = $tokenResult.access_token
Write-Host "Access Token: $token"

# 測試 FHIR API - 獲取 Metadata
Invoke-RestMethod -Method Get `
    -Uri "http://localhost:8083/fhir-server/metadata" `
    -Headers @{"Authorization"="Bearer $token"; "Accept"="application/fhir+json"}

# 測試 FHIR API - 搜索 Patient
Invoke-RestMethod -Method Get `
    -Uri "http://localhost:8083/fhir-server/Patient" `
    -Headers @{"Authorization"="Bearer $token"; "Accept"="application/fhir+json"}
```

### Bash 版本

```bash
# 獲取 Token
TOKEN=$(curl -s -X POST "http://localhost:8080/realms/fhir/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=hapi-fhir-client&client_secret=hapi-secret&username=fhir-admin&password=fhir-admin" \
  | jq -r '.access_token')

# 測試 FHIR API
curl -H "Authorization: Bearer $TOKEN" \
     -H "Accept: application/fhir+json" \
     "http://localhost:8083/fhir-server/Patient"
```

### 測試 Keycloak OIDC Discovery

```bash
curl http://localhost:8080/realms/fhir/.well-known/openid-configuration | jq
```

## 📁 專案結構

```
SMART-on-FHIR-Platform/
├── docker-compose.yml          # Docker Compose 配置
├── README.md                   # 本文件
├── keycloak-data/
│   └── fhir-realm.json         # Keycloak Realm 配置（clients, scopes, users）
├── fhir-server/
│   └── config/
│       ├── server.xml          # IBM FHIR Server Liberty 配置
│       └── default/
│           └── fhir-server-config.json  # FHIR Server 功能配置
├── platform/                   # CGMH EHRCALC 應用
│   ├── Dockerfile              # Platform 容器配置
│   ├── nginx.conf              # Nginx 配置
│   ├── index.html              # 主頁面
│   ├── launch.html             # SMART Launch 入口頁面
│   ├── calculator.html         # 計算器頁面
│   ├── js/                     # JavaScript 模組
│   ├── css/                    # 樣式表
│   └── src/                    # TypeScript 源碼
└── smart-launcher/             # SMART Launcher（來自官方 image）
```

## 📝 SMART on FHIR 啟動流程

### Standalone Launch 流程

```
1. 使用者訪問 Platform Launch URL
   → http://localhost:8085/launch.html
                    ↓
2. launch.html 重定向到 Keycloak 進行授權
   → http://localhost:8080/realms/fhir/protocol/openid-connect/auth
                    ↓
3. 使用者在 Keycloak 登入 (fhir-admin / fhir-admin)
                    ↓
4. Keycloak 重定向回 Platform 並帶有 authorization code
   → http://localhost:8085/index.html?code=xxx&state=...
                    ↓
5. Platform 使用 fhir-client.js 自動交換 access token
                    ↓
6. Platform 可以使用 access token 從 FHIR Server 獲取資料
```

### EHR Launch 流程

```
1. 使用者訪問 SMART Launcher (http://localhost:9009)
                    ↓
2. SMART Launcher 配置 Patient ID 並啟動 Platform
   → http://localhost:8085/launch.html?launch=xxx&iss=...
                    ↓
3. Platform 的 launch.html 重定向到 Keycloak 進行授權
   → http://localhost:8080/realms/fhir/protocol/openid-connect/auth
                    ↓
4. 使用者在 Keycloak 登入 (fhir-admin / fhir-admin)
                    ↓
5. Keycloak 重定向回 Platform 並帶有 authorization code
   → http://localhost:8085/index.html?code=xxx&state=...
                    ↓
6. Platform 使用 code 交換 access token（包含 patient context）
                    ↓
7. Platform 使用 access token 從 FHIR Server 獲取病人資料
```

## ⚠️ 故障排除

### 問題：FHIR Server 返回 500 錯誤

這通常是數據庫 Schema 尚未初始化完成。

**解決方案**：
1. 等待 FHIR Server 完成啟動（約 2-3 分鐘）
2. 查看日誌確認 Schema 創建完成：
   ```bash
   docker logs fhir-server | grep "RESOURCE_TABLE"
   ```
3. 如果問題持續，重新創建 volume：
   ```bash
   docker-compose down
   docker volume rm fhir_data
   docker-compose up -d
   ```

### 問題：FHIR Server 返回 401 錯誤

**解決方案**：
1. 確認 Token 有效且未過期
2. 確認使用正確的 audience (`smart_cds_platform`)
3. 重新獲取 Token

### 問題：Keycloak 返回 invalid_scope 錯誤

**解決方案**：
確認 `platform/launch.html` 中的 scope 設置正確：
```javascript
scope: 'openid profile fhirUser launch'
```

### 問題：SMART Launcher Patient Picker 無法載入

這是因為 IBM FHIR Server 需要認證才能訪問 Patient 列表。

**解決方案**：
1. 在 SMART Launcher 中預先設定 Patient ID
2. 或使用 Standalone Launch 模式

### 問題：容器間無法通訊

確認所有容器都在 `fhirnet` 網路中：

```bash
docker network inspect fhirnet
```

### 問題：Keycloak 授權失敗

1. 確認 Keycloak 已完全啟動
2. 檢查 realm 是否正確導入：
   ```bash
   docker logs keycloak | grep "fhir"
   ```
3. 訪問 http://localhost:8080/admin 檢查 `fhir` realm 是否存在

## 🔑 重要配置說明

### Keycloak Client 配置

| Client ID | 類型 | 用途 |
|-----------|------|------|
| smart_cds_platform | Public | Platform 前端應用 |
| hapi-fhir-client | Confidential | 後端 API 測試 |
| smart-launcher-client | Confidential | SMART Launcher |

### FHIR Server API 路徑

> ⚠️ **注意**: IBM FHIR Server 的正確 API 路徑是 `/fhir-server/`，不是 `/fhir-server/api/v4/`

```
✅ 正確: http://localhost:8083/fhir-server/Patient
❌ 錯誤: http://localhost:8083/fhir-server/api/v4/Patient
```

## 📚 相關資源

- [SMART on FHIR](https://docs.smarthealthit.org/)
- [HL7 FHIR R4](https://www.hl7.org/fhir/)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [IBM FHIR Server](https://ibm.github.io/FHIR/)
- [fhir-client.js](https://docs.smarthealthit.org/client-js/)

## 📄 License

MIT License
