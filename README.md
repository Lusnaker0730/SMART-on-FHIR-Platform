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
| EHR Launch | ✅ 正常 | 透過 Patient Picker 動態選擇病人 |
| Patient Picker | ✅ 正常 | 掛載於 SMART Launcher，查詢 FHIR Server |

## 📦 服務列表

| 服務 | URL | 說明 |
|------|-----|------|
| SMART Launcher | http://localhost:9009 | SMART 應用程式啟動器 |
| Patient Picker | http://localhost:9009/patient-select.html | 病人選擇頁面（掛載於 Launcher） |
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

### 3. 測試資料

啟動時 `fhir-seed` 容器會自動建立一筆測試病人（`test-patient-1`）。如需更多病人資料，可使用 `TWCOREDATA/` 生成器批次建立台灣 TWCore 格式病人。

### 4. 訪問應用程式

#### 方式一：Standalone Launch（推薦用於測試）

1. 直接訪問 http://localhost:8085/launch.html
2. 因為沒有病人 context，會自動導向 **Patient Picker** 頁面
3. 從列表中選擇一位病人
4. 系統重定向到 Keycloak 登入頁面，使用 `fhir-admin` / `fhir-admin` 登入
5. 登入成功後自動返回 Platform 應用，顯示所選病人資訊

#### 方式二：EHR Launch（通過 SMART Launcher）

**不指定病人（使用 Patient Picker）**：

1. 訪問 http://localhost:9009
2. 設定以下參數：
   - **Launch Type**: `Provider EHR Launch`
   - **Patient ID**: 留空不填
   - **App Launch URL**: `http://localhost:8085/launch.html`
3. 點擊 `Launch App!`
4. 系統自動導向 Patient Picker → 選擇病人 → Keycloak 登入 → 進入 Platform

**指定病人（跳過 Picker）**：

1. 訪問 http://localhost:9009
2. 設定 **Patient ID** 為 `test-patient-1`（或其他已存在的病人 ID）
3. 點擊 `Launch App!`
4. 直接進入 Keycloak 登入 → Platform（跳過 Picker）

#### 切換病人

進入 Platform 後，點擊病人資訊區域右側的 **「Switch Patient」** 按鈕，即可清除目前的病人 context 並導回 Patient Picker 重新選擇。

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
├── CHANGE_LOG.md               # 變更記錄
├── keycloak-data/
│   └── fhir-realm.json         # Keycloak Realm 配置（clients, scopes, users）
├── fhir-server/
│   └── config/
│       ├── server.xml          # IBM FHIR Server Liberty 配置
│       └── default/
│           └── fhir-server-config.json  # FHIR Server 功能配置
├── fhir-seed/                  # 種子資料（自動建立測試病人）
│   ├── seed-data.sh
│   └── test-patient.json
├── patient-picker/             # Patient Picker 頁面（掛載至 SMART Launcher）
│   └── patient-select.html     # 獨立病人選擇頁面（vanilla HTML+JS）
├── platform/                   # CGMH EHRCALC 應用
│   ├── Dockerfile              # Platform 容器配置
│   ├── nginx.conf              # Nginx 配置
│   ├── index.html              # 主頁面
│   ├── launch.html             # SMART Launch 入口（含 Patient Picker 導向邏輯）
│   ├── calculator.html         # 計算器頁面
│   ├── js/                     # JavaScript 模組（TypeScript 編譯產出）
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

### EHR Launch 流程（未指定病人 → Patient Picker）

```
1. 使用者訪問 SMART Launcher (http://localhost:9009)
   不填 Patient ID，點擊 Launch
                    ↓
2. launch.html 偵測到沒有病人 context
   → 導向 http://localhost:9009/patient-select.html?returnUrl=...
                    ↓
3. Patient Picker 查詢 FHIR Server 顯示病人列表
   使用者選擇一位病人
                    ↓
4. 帶著 patient ID 導回 launch.html
   → 存入 sessionStorage → 導向 Keycloak 授權
                    ↓
5. 使用者在 Keycloak 登入 (fhir-admin / fhir-admin)
                    ↓
6. Keycloak 重定向回 Platform
   → http://localhost:8085/index.html?code=xxx&state=...
                    ↓
7. Platform 從 sessionStorage 讀取 patient ID，獲取病人資料
```

### EHR Launch 流程（已指定病人 → 跳過 Picker）

```
1. 使用者在 SMART Launcher 填入 Patient ID，點擊 Launch
                    ↓
2. launch.html 從 launch context 解碼病人 ID
   → 存入 sessionStorage → 直接導向 Keycloak 授權
                    ↓
3. 後續流程同上（Keycloak 登入 → Platform）
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

### 問題：Patient Picker 顯示 "Failed to load patients"

Patient Picker 需要直接查詢 FHIR Server（不帶 token）。

**解決方案**：
1. 確認 FHIR Server 已完全啟動（約 2-3 分鐘）
2. 確認 `fhir-server/config/server.xml` 中 `FHIRUsers` 角色包含 `EVERYONE` special-subject
3. 確認 Patient Picker 使用正確的 FHIR 路徑（`/fhir-server/Patient`，不是 `/fhir-server/api/v4/Patient`）

### 問題：Launch 後不停導向 Patient Picker（循環）

**解決方案**：
1. 清除瀏覽器的 sessionStorage（DevTools → Application → Session Storage → Clear）
2. 確認 Patient Picker 的 `returnUrl` 參數正確指向 `launch.html`

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
