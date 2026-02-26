# SMART on FHIR Platform - 伺服器遷移指南

## 概覽

本平台由 5 個 Docker 容器組成，彼此透過 URL 互相通訊。遷移到新伺服器時，主要工作是**更新所有 URL 中的主機名稱和 port**。

難度評估：**中等**。檔案多但改動模式重複，照著本指南逐步操作即可完成。

---

## 架構圖

```
瀏覽器 (使用者)
  │
  ├─► http://<HOST>:8085   → Platform (Nginx)      ← 前端網頁
  ├─► http://<HOST>:8080   → Keycloak              ← OAuth2 / 身份驗證
  ├─► http://<HOST>:8083   → FHIR Server (Liberty)  ← FHIR R4 API
  └─► http://<HOST>:9009   → SMART Launcher         ← EHR 模擬器

Docker 內部網路 (fhirnet):
  keycloak:8080, fhir-server:9080, smart-launcher:80, db:5432
```

> **關鍵概念**：有兩種 URL
> - **外部 URL**：瀏覽器使用的，包含你的伺服器 IP/域名 + 外部 port
> - **內部 URL**：容器間通訊用的（`keycloak:8080`、`fhir-server:9080`），**通常不需要改**

---

## 遷移前準備

### 1. 確認新伺服器資訊

你需要決定以下變數（後續以代號表示）：

| 代號 | 說明 | 範例（本機開發） | 範例（正式部署） |
|------|------|------------------|------------------|
| `HOST` | 伺服器主機名稱或 IP | `localhost` | `fhir.example.com` |
| `KEYCLOAK_PORT` | Keycloak 外部 port | `8080` | `8080` |
| `FHIR_PORT` | FHIR Server 外部 port | `8083` | `8083` |
| `PLATFORM_PORT` | Platform 外部 port | `8085` | `443`（如用反向代理） |
| `LAUNCHER_PORT` | SMART Launcher 外部 port | `9009` | `9009` |
| `PROTOCOL` | http 或 https | `http` | `https` |

### 2. 安裝需求

新伺服器需要：
- Docker Engine 20.10+
- Docker Compose v2+
- 至少 4GB 可用記憶體（Keycloak + FHIR Server 吃記憶體）
- 開放上述 4 個 port

---

## 逐步修改指南

### 步驟 1：複製專案到新伺服器

```bash
git clone <your-repo-url>
cd SMART-on-FHIR-Platform
```

### 步驟 2：修改 `.env` — 密碼設定

```bash
cp .env.example .env
```

編輯 `.env`，**所有 `CHANGE_ME` 都要換成強密碼**：

```env
POSTGRES_PASSWORD=<強密碼>
KEYCLOAK_ADMIN_PASSWORD=<強密碼>
FHIR_DB_PASSWORD=<強密碼>
KEYCLOAK_CLIENT_SECRET=<強密碼>
KEYSTORE_PASSWORD=<強密碼>
```

---

### 步驟 3：修改 `docker-compose.yml`

需要改的項目：

#### 3a. Keycloak 主機名稱（第 37 行）

```yaml
# 改前
KC_HOSTNAME: localhost
# 改後
KC_HOSTNAME: <HOST>
```

#### 3b. Keycloak CSP（第 39 行）

```yaml
# 改前
KC_HTTP_CONTENT_SECURITY_POLICY: "frame-ancestors 'self' http://localhost:9009 http://localhost:8085 http://127.0.0.1:8085;"
# 改後
KC_HTTP_CONTENT_SECURITY_POLICY: "frame-ancestors 'self' <PROTOCOL>://<HOST>:<LAUNCHER_PORT> <PROTOCOL>://<HOST>:<PLATFORM_PORT>;"
```

#### 3c. Port 映射（如需改 port）

```yaml
# Keycloak (第 43 行)
- "<KEYCLOAK_PORT>:8080"

# FHIR Server (第 60-61 行)
- "<FHIR_PORT>:9080"
- "<FHIR_HTTPS_PORT>:9443"  # 如需 HTTPS

# SMART Launcher (第 77 行)
- "<LAUNCHER_PORT>:80"

# Platform (第 117 行)
- "<PLATFORM_PORT>:80"
```

#### 3d. SMART Launcher 環境變數（第 80-90 行）

```yaml
BASE_URL: <PROTOCOL>://<HOST>:<LAUNCHER_PORT>
FHIR_SERVER_R4: http://fhir-server:9080/fhir-server          # 內部 URL，不用改
PICKER_CONFIG_R4_FHIR_URL: <PROTOCOL>://<HOST>:<FHIR_PORT>/fhir-server
AUTH_SERVER_R4: <PROTOCOL>://<HOST>:<KEYCLOAK_PORT>/realms/fhir/protocol/openid-connect/auth
TOKEN_SERVER_R4: http://keycloak:8080/realms/fhir/protocol/openid-connect/token  # 內部 URL，不用改
```

---

### 步驟 4：修改 `keycloak-data/fhir-realm.json`

這是 Keycloak 的 realm 設定檔，包含 OAuth2 redirect URI 和 CORS 設定。

用全域搜尋替換：

| 搜尋 | 替換為 |
|------|--------|
| `http://localhost:8080` | `<PROTOCOL>://<HOST>:<KEYCLOAK_PORT>` |
| `http://localhost:8083` | `<PROTOCOL>://<HOST>:<FHIR_PORT>` |
| `http://localhost:8085` | `<PROTOCOL>://<HOST>:<PLATFORM_PORT>` |
| `http://localhost:9009` | `<PROTOCOL>://<HOST>:<LAUNCHER_PORT>` |

受影響的區域（約 13 處）：
- `browserSecurityHeaders` → `xFrameOptions`、`contentSecurityPolicy`
- `hapi-fhir-client` client → `redirectUris`
- `smart_cds_platform` client → `redirectUris`、`webOrigins`
- `smart-launcher-client` client → `redirectUris`、`webOrigins`

---

### 步驟 5：修改 `fhir-server/config/server.xml`

#### 5a. CORS 設定（第 24-30 行）

```xml
<!-- 改前 -->
allowedOrigins="http://localhost:8085, http://localhost:9009, http://127.0.0.1:8085, http://127.0.0.1:9009"
<!-- 改後 -->
allowedOrigins="<PROTOCOL>://<HOST>:<PLATFORM_PORT>, <PROTOCOL>://<HOST>:<LAUNCHER_PORT>"
```

#### 5b. JWT issuer（第 33-41 行）

```xml
<!-- jwksUri 是容器內部 URL，不用改 -->
jwksUri="http://keycloak:8080/realms/fhir/protocol/openid-connect/certs"

<!-- issuer 必須與 Keycloak 對外發出的 token 一致 -->
<!-- 改前 -->
issuer="http://localhost:8080/realms/fhir"
<!-- 改後 -->
issuer="<PROTOCOL>://<HOST>:<KEYCLOAK_PORT>/realms/fhir"
```

---

### 步驟 6：修改 `fhir-server/config/default/fhir-server-config.json`

更新 OAuth endpoint（`security.oauth` 區塊）：

```json
"regUrl": "<PROTOCOL>://<HOST>:<KEYCLOAK_PORT>/realms/fhir/clients-registrations/openid-connect",
"authUrl": "<PROTOCOL>://<HOST>:<KEYCLOAK_PORT>/realms/fhir/protocol/openid-connect/auth",
"tokenUrl": "<PROTOCOL>://<HOST>:<KEYCLOAK_PORT>/realms/fhir/protocol/openid-connect/token"
```

---

### 步驟 7：修改 `fhir-server/hapi.properties`

```properties
# 改前
server_address=http://localhost:8080/fhir
server.port=8080
# 改後
server_address=<PROTOCOL>://<HOST>:<FHIR_PORT>/fhir-server
server.port=9080
```

---

### 步驟 8：修改前端檔案

#### 8a. `platform/launch.html`

launch.html 包含 Patient Picker 導向邏輯和 FHIR ISS 設定，需要替換以下 URL：

```javascript
// PICKER_URL - Patient Picker 頁面位址
var PICKER_URL = '<PROTOCOL>://<HOST>:<LAUNCHER_PORT>/patient-select.html';

// ISS 偵測 - SMART Launcher 的主機名稱
if (iss && iss.includes('<HOST>:<LAUNCHER_PORT>')) {

// ISS 替換 - 真正的 FHIR Server 位址（出現多處）
'<PROTOCOL>://<HOST>:<FHIR_PORT>/fhir-server'
```

CSP meta tag（第 11 行）：
```html
connect-src 'self' ... <PROTOCOL>://<HOST>:<LAUNCHER_PORT> <PROTOCOL>://<HOST>:<FHIR_PORT> <PROTOCOL>://<HOST>:<KEYCLOAK_PORT>;
```

#### 8b. `platform/index.html`

CSP meta tag（第 10-14 行）：
```html
connect-src 'self' ... <PROTOCOL>://<HOST>:<LAUNCHER_PORT> <PROTOCOL>://<HOST>:<FHIR_PORT> <PROTOCOL>://<HOST>:<KEYCLOAK_PORT>;
```

#### 8c. `platform/nginx.conf`

```nginx
# 第 3 行
server_name <HOST>;

# 第 16 行 和 第 34 行 - CSP（出現兩次）
# 替換所有 http://localhost:9009, http://localhost:8083, http://localhost:8080
```

---

#### 8d. `patient-picker/patient-select.html`

Patient Picker 頁面直接查詢 FHIR Server，需要更新 FHIR base URL：

```javascript
// 改前
var FHIR_BASE = 'http://localhost:8083/fhir-server';
// 改後
var FHIR_BASE = '<PROTOCOL>://<HOST>:<FHIR_PORT>/fhir-server';
```

> 注意：此檔案透過 docker-compose volume 掛載到 SMART Launcher 容器的 `/app/static/` 目錄，
> 可透過 `<PROTOCOL>://<HOST>:<LAUNCHER_PORT>/patient-select.html` 存取。

---

### 步驟 9：修改 Seed 腳本（通常不用改）

`fhir-seed/seed-data.sh` 使用的是 Docker 內部網路 URL，**只有在更改容器名稱或內部 port 時才需要修改**。

---

## 快速搜尋替換一覽表

如果 port 不變，只換主機名稱，可以用以下搜尋替換（依序執行）：

```bash
# 在專案根目錄執行（排除 node_modules、.git、package-lock.json）
# 先預覽要改的地方：
grep -rn "localhost" --include="*.yml" --include="*.yaml" --include="*.xml" \
  --include="*.json" --include="*.html" --include="*.conf" --include="*.properties" \
  --include="*.env" --include="*.sh" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude="package-lock.json" .

# 確認無誤後，用 sed 批次替換（僅替換外部 URL 的 localhost）：
# ⚠️ 注意：不要替換 Docker 內部的 URL（keycloak:8080, fhir-server:9080）
```

**需要替換的外部 URL 模式**：

| 原始值 | 替換為 | 出現檔案數 |
|--------|--------|-----------|
| `http://localhost:8080` | `<PROTOCOL>://<HOST>:<KEYCLOAK_PORT>` | 7 個檔案 |
| `http://localhost:8083` | `<PROTOCOL>://<HOST>:<FHIR_PORT>` | 6 個檔案（含 patient-select.html） |
| `http://localhost:8085` | `<PROTOCOL>://<HOST>:<PLATFORM_PORT>` | 4 個檔案 |
| `http://localhost:9009` | `<PROTOCOL>://<HOST>:<LAUNCHER_PORT>` | 7 個檔案（含 launch.html Picker URL） |
| `http://127.0.0.1:8085` | `<PROTOCOL>://<HOST>:<PLATFORM_PORT>` | 2 個檔案 |
| `http://127.0.0.1:9009` | `<PROTOCOL>://<HOST>:<LAUNCHER_PORT>` | 1 個檔案 |

**不要替換的內部 URL**（這些用 Docker 服務名稱，不需要改）：

| 保留不動 | 用途 |
|----------|------|
| `http://keycloak:8080/...` | 容器間 → Keycloak |
| `http://fhir-server:9080/...` | 容器間 → FHIR Server |

---

## 正式部署額外注意事項

### HTTPS 設定

正式環境強烈建議使用 HTTPS。有兩種方式：

**方式 A：反向代理（推薦）**

在 Docker 前面加一層 Nginx/Caddy 反向代理：

```
使用者 → Nginx (443/HTTPS) → Docker 容器 (HTTP)
```

這樣 Docker 內部仍用 HTTP，只需在反向代理上設定 SSL 憑證。所有外部 URL 改為 `https://` 且 port 可省略（443）。

**方式 B：各容器單獨設定 HTTPS**

較複雜，需為每個容器掛載 SSL 憑證。不推薦。

### 防火牆

正式環境只需對外開放反向代理的 port（通常是 443）。Docker 容器的 port（8080, 8083, 8085, 9009）應只綁定到 `127.0.0.1`：

```yaml
# docker-compose.yml
ports:
  - "127.0.0.1:8080:8080"  # 只允許本機存取
```

### 密碼安全

`.env` 中的所有密碼都必須更換為強密碼。可用以下指令產生：

```bash
openssl rand -base64 32
```

### FHIR Server 認證

開發環境中，`fhir-server/config/server.xml` 設定 `EVERYONE` special-subject 以允許未認證的 FHIR 查詢（供 Patient Picker 使用）。**正式環境應移除此設定**，改為讓 Patient Picker 在查詢時攜帶 token，或使用有認證的 Picker 機制。

### 資料持久化

- PostgreSQL 資料存在 Docker volume `postgres_data`
- FHIR Server 的 Derby 資料在容器內（重建容器會遺失）
- 正式環境建議將 FHIR Server 改用 PostgreSQL 作為後端資料庫

---

## 遷移完成後驗證

```bash
# 1. 啟動所有服務
docker-compose down -v
docker-compose up -d --build

# 2. 等待啟動（約 2-3 分鐘）
docker-compose ps

# 3. 確認 fhir-seed 成功建立測試資料
docker logs fhir-seed

# 4. 測試 Keycloak
curl -s <PROTOCOL>://<HOST>:<KEYCLOAK_PORT>/realms/fhir/.well-known/openid-configuration | head -5

# 5. 測試 FHIR Server（取得 token 後查詢）
TOKEN=$(curl -s -X POST "<PROTOCOL>://<HOST>:<KEYCLOAK_PORT>/realms/fhir/protocol/openid-connect/token" \
  -d "grant_type=password&client_id=hapi-fhir-client&client_secret=<YOUR_SECRET>&username=fhir-admin&password=fhir-admin" \
  | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

curl -s -H "Authorization: Bearer $TOKEN" "<PROTOCOL>://<HOST>:<FHIR_PORT>/fhir-server/Patient/test-patient-1"

# 6. 測試 Patient Picker
curl -s -o /dev/null -w "%{http_code}" "<PROTOCOL>://<HOST>:<LAUNCHER_PORT>/patient-select.html"
# 應返回 200

# 7. 開瀏覽器測試完整流程
# 訪問 <PROTOCOL>://<HOST>:<LAUNCHER_PORT> → 不填病人 → Launch → 應導向 Patient Picker
# 選擇病人 → Keycloak 登入 → 進入 Platform
```

---

## 需要修改的檔案總覽

| # | 檔案 | 修改項目 | 難度 |
|---|------|----------|------|
| 1 | `.env` | 密碼 | 低 |
| 2 | `docker-compose.yml` | KC_HOSTNAME, CSP, port 映射, SMART Launcher env | 中 |
| 3 | `keycloak-data/fhir-realm.json` | redirectUris, webOrigins, CSP headers | 中 |
| 4 | `fhir-server/config/server.xml` | CORS origins, JWT issuer | 低 |
| 5 | `fhir-server/config/default/fhir-server-config.json` | OAuth URLs | 低 |
| 6 | `fhir-server/hapi.properties` | server_address | 低 |
| 7 | `platform/index.html` | CSP meta tag | 低 |
| 8 | `platform/launch.html` | FHIR URL, Launcher 偵測, Picker URL, CSP | 中 |
| 9 | `platform/nginx.conf` | server_name, CSP | 低 |
| 10 | `patient-picker/patient-select.html` | FHIR Server base URL | 低 |

**總共 10 個檔案，約 42 處需要修改**。模式重複，主要就是替換 4 組 `localhost:<port>` URL。
