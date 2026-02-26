# Change Log

## 2026-02-27 — Patient Picker 動態選病人機制

### 背景

原本系統在 Keycloak 中硬編碼預設病人 ID（`test-patient-1`），透過 JWT token 的 `patient` claim 傳給 Platform。這導致所有使用者登入後都只能看到同一位病人，無法切換。

本次改動引入獨立的 **Patient Picker** 頁面，讓使用者在 SMART Launcher 啟動時動態選擇病人，再走 Keycloak OAuth 流程進入 Platform。

### 流程變更

```
【之前】
Launcher → launch.html → 固定從 JWT 讀 patient=test-patient-1 → Platform

【之後】
Launcher（不填病人）→ launch.html 偵測無病人
  → 導向 Patient Picker（localhost:9009/patient-select.html）
  → 查詢 FHIR Server 顯示病人列表
  → 使用者選擇 → 帶 patient ID 回 launch.html
  → 存入 sessionStorage → 走 Keycloak OAuth → Platform

Launcher（已填病人）→ launch.html 直接存 sessionStorage → 走 OAuth（跳過 Picker）
```

### 修改檔案

| 檔案 | 操作 | 說明 |
|------|------|------|
| `keycloak-data/fhir-realm.json` | 修改 | 移除 `patient-context` protocol mapper；清除 `fhir-admin` 使用者的 `patient_id` 屬性 |
| `fhir-server/config/server.xml` | 修改 | 新增 `EVERYONE` special-subject，允許未認證請求讀取 FHIR 資源（沙盒用途，供 Patient Picker 查詢） |
| `patient-picker/patient-select.html` | **新建** | 獨立的病人選擇頁面（純 HTML + vanilla JS），支援搜尋、表格顯示姓名/性別/生日/年齡/ID |
| `docker-compose.yml` | 修改 | smart-launcher 新增 volume 掛載 `patient-select.html` 至 `/app/static/` |
| `platform/launch.html` | 修改 | 新增病人偵測邏輯：檢查 `?patient=` 參數及 launch context，無病人時導向 Picker |
| `platform/src/utils.ts` | 修改 | 移除 JWT token 提取 fallback；新增「Switch Patient」按鈕（清除 session 後導回 Picker） |
| `platform/js/utils.js` | 自動產生 | 由 TypeScript 編譯產生 |

### 種子資料

使用 `TWCOREDATA/` 生成器建立 10 位台灣 TWCore 格式病人（含 Encounter、Condition、Observation、Medication、MedicationRequest），上傳至 FHIR Server。總計 23 位病人可供選擇。

### 驗證步驟

1. `docker-compose down -v && docker-compose up -d --build`
2. 開啟 `http://localhost:9009`，不填病人 ID → 點 Launch → 應導向 Patient Picker
3. 在 Picker 選擇病人 → 回到 Platform，病人資訊正確顯示
4. 在 Launcher 填入 `test-patient-1` → 點 Launch → 直接進入 Platform（跳過 Picker）
5. 在 Platform 點「Switch Patient」按鈕 → 導回 Picker → 選擇新病人 → 頁面更新

### 已知限制

- FHIR Server 設定為 `EVERYONE` 可讀，僅適用於開發/沙盒環境，正式環境需改回認證存取
- Patient Picker 頁面掛載在 SMART Launcher 容器的靜態目錄中，不屬於 Platform 本身
