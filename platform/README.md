# 🏥 SMART 平台 - 病患資訊管理系統

## 概述

這是一個基於 SMART on FHIR 標準的醫療資訊平台，提供完整的病患資訊管理、CDS Hook 決策支持和 SMART 應用程式整合功能。**現在支援真實的 SMART on FHIR 整合**，可以從實際的 FHIR 服務器載入病人上下文和臨床資料。

## 🚀 新功能：真實的 SMART on FHIR 整合

### 🔗 SMART on FHIR 支援
- ✅ **EHR Launch 流程**：支援從 EHR 系統啟動
- ✅ **Standalone Launch 流程**：支援獨立啟動
- ✅ **OAuth 2.0 授權**：完整的 SMART on FHIR 授權流程
- ✅ **病人上下文載入**：自動載入選定的病人資訊
- ✅ **真實 FHIR 資料**：從真實 FHIR 服務器載入資料

### 🔧 支援的 FHIR 服務器
- **SMART Health IT R4/R3**：官方測試環境
- **HAPI FHIR**：公開測試服務器
- **Cerner Sandbox**：Cerner 開發者環境
- **Epic Sandbox**：Epic 開發者環境
- **本地 HAPI 服務器**：本地開發環境

### 📊 FHIR 資源支援
- **Patient**：病人基本資訊
- **Condition**：診斷資訊
- **Observation**：檢測數據
- **MedicationRequest**：藥物處方
- **Encounter**：就診記錄
- **Practitioner**：醫護人員資訊

## 主要功能

### 📋 左側面板 - 病患基本資料
- **病患資訊卡片**: 顯示病患基本資訊，包括姓名、年齡、性別、病歷號等
- **最近診斷**: 列出病患的最新診斷記錄，包括診斷日期和醫師資訊
- **診斷狀態**: 即時顯示診斷的活躍狀態

### 💚 中間面板 - CDS Hook 展示區域
- **ASCVD 風險評估**: 心血管疾病風險計算器
- **風險因子分析**: 自動分析病患的風險因素
- **CDS 建議**: 基於證據的臨床決策支援建議
- **互動式計算器**: 完整的風險評估工具

### ⚙️ 右側面板 - 功能選單
- **CDS Hook 功能**:
  - ARC-HBR 風險權衡分析
  - ASCVD 風險評估
  - 實驗室數據趨勢分析
  - 風險評估檢測
  - 臨床報告生成
  - 系統設定

- **SMART on FHIR 應用程式**:
  - ASCVD Risk Calculator
  - Drug Interaction Checker
  - Lab Results Viewer
  - Prescribing Assistant

## 技術特色

### 🎨 現代化 UI 設計
- **響應式設計**: 適配不同螢幕尺寸
- **直觀的用戶界面**: 醫療專業人員友好的設計
- **流暢的動畫效果**: 增強用戶體驗
- **專業的顏色搭配**: 符合醫療環境的視覺風格

### 🔧 互動功能
- **即時通知系統**: 操作反饋和狀態提示
- **模態視窗**: 詳細的功能操作界面
- **動態內容更新**: 根據選擇的功能切換內容
- **實時時間顯示**: 系統狀態指示器

### 📱 響應式設計
- **桌面版**: 三欄式布局，最佳化大螢幕體驗
- **平板版**: 適配中等螢幕尺寸
- **手機版**: 單欄式布局，觸控友好

## 使用方法

### 🚀 快速開始

#### 方法 1: 使用 npm 啟動（推薦）
```bash
# 1. 安裝依賴
npm install

# 2. 啟動開發服務器
npm run dev
```
服務器將自動在 `http://localhost:8080` 啟動並開啟瀏覽器

#### 方法 2: 使用 Python HTTP 服務器
```bash
python -m http.server 8000
```

### 📋 透過 EHR Launch 啟動的詳細步驟

#### ✅ 步驟 1: EHR Launch 測試（推薦新手）
1. **啟動本地服務器**：
   ```bash
   npm run dev
   # 或 python -m http.server 8080
   ```

2. **開啟 SMART Health IT Launcher**：
   - 訪問：[https://launch.smarthealthit.org/](https://launch.smarthealthit.org/)
   
3. **配置啟動參數**：
   - **App Launch URL**：`http://localhost:8080/launch.html`
   - **FHIR Version**：選擇 `R4 (4.0.x)`
   - **Simulate EHR Launch**：保持勾選
   
4. **選擇測試環境**：
   - **Provider**：選擇任一醫師
   - **Patient**：選擇測試病患（如：Alayna Kassulke）
   - **Encounter**：選擇就診紀錄（可選）

5. **啟動應用**：
   - 點擊綠色的 **"Launch App"** 按鈕
   - 系統會自動重定向到您的應用並載入選定病患的資料

#### ✅ 步驟 2: 直接 Standalone Launch
如果您想跳過 launcher 直接測試：
```bash
# 直接在瀏覽器開啟：
http://localhost:8080/launch.html?iss=https://r4.smarthealthit.org
```

#### ✅ 步驟 3: 使用特定病患 ID 測試
```bash
# 指定特定病患的測試：
http://localhost:8080/launch.html?iss=https://r4.smarthealthit.org&launch=WzAsImIzODYzNzFhLTkzN2QtNGUxMi04ODI3LWY4OGY4ZTc5MzE5YSIsIkFsbCJd
```

### 🔍 Launch 流程說明

當您透過 EHR Launch 啟動應用時，會發生以下流程：

1. **EHR 系統調用**：EHR 調用您的 `launch.html` 並傳遞參數：
   - `iss`: FHIR 服務器的 URL
   - `launch`: EHR 系統生成的啟動權杖

2. **授權請求**：`launch.html` 自動重定向到 FHIR 服務器進行 OAuth 授權

3. **用戶同意**：用戶同意應用存取權限（在測試環境中通常自動通過）

4. **重定向回應**：授權完成後重定向到 `index.html` 並帶上授權碼

5. **載入應用**：`index.html` 使用授權碼獲取存取令牌並載入病患資料

### 🛠️ 故障排除

#### 問題 1: "Launch 失敗" 錯誤
**解決方案**：
- 確認服務器正在運行
- 檢查瀏覽器控制台的錯誤訊息
- 確認啟動 URL 正確：`http://localhost:8080/launch.html`

#### 問題 2: 無法載入病患資料
**解決方案**：
- 檢查網路連線
- 確認 FHIR 服務器狀態：https://r4.smarthealthit.org/metadata
- 檢查瀏覽器是否阻擋了跨源請求

#### 問題 3: HTTPS 相關錯誤  
**解決方案**：
- 本地開發使用 HTTP 即可
- 生產環境必須使用 HTTPS

### 🔧 配置不同的 FHIR 服務器

修改 `config.json` 文件來配置不同的 FHIR 服務器：

```json
{
  "servers": {
    "your-server": {
      "name": "Your FHIR Server",
      "fhirServiceUrl": "https://your-fhir-server.com/fhir",
      "clientId": "your-client-id",
      "scope": "launch openid fhirUser patient/*.read",
      "requiresAuth": true
    }
  }
}
```

### 📋 基本操作
1. **查看病患資訊**: 左側面板顯示從 FHIR 服務器載入的真實病患資料
2. **選擇 CDS 功能**: 點擊右側功能選單中的任一功能按鈕
3. **執行風險評估**: 使用中間面板的計算器工具
4. **開啟 SMART 應用**: 點擊快速動作區域的應用程式按鈕

### 🔍 進階功能
- **診斷詳情**: 點擊左側診斷項目查看完整的 FHIR 資源資訊
- **風險計算**: 使用 ASCVD 計算器進行詳細風險評估
- **功能切換**: 通過右側選單切換不同的 CDS Hook 功能
- **相關資料**: 從診斷詳情頁面載入相關的檢測數據和藥物資訊

### 🛠️ 開發者功能
- **FHIR 資源檢視**: 在診斷詳情中查看完整的 FHIR JSON
- **調試模式**: 開啟瀏覽器開發工具查看 FHIR 請求和響應
- **多服務器支援**: 在配置文件中添加多個 FHIR 服務器

## 檔案結構

```
CDSplayground/
├── index.html          # 主要應用程式頁面
├── launch.html         # SMART on FHIR 啟動頁面
├── styles.css          # 樣式表
├── script.js           # JavaScript 功能腳本
├── config.json         # FHIR 服務器配置文件
└── README.md          # 說明文件
```

## 依賴項目

### 外部資源
- **FHIR Client JS**: SMART on FHIR JavaScript 客戶端庫
  - CDN: `https://cdn.jsdelivr.net/npm/fhirclient/build/fhir-client.js`
  - 版本: 最新穩定版
- **Font Awesome 6.0.0**: 圖示庫
- **Google Fonts**: 字型支援（可選）

### 技術棧
- **HTML5**: 結構標記
- **CSS3**: 樣式和動畫
- **Vanilla JavaScript**: 功能實現
- **SMART on FHIR**: 醫療資訊交換標準
- **OAuth 2.0**: 授權協議
- **Grid & Flexbox**: 響應式布局

## 功能詳細說明

### ASCVD 風險評估
- 基於 ACC/AHA 2013 指南
- 支援 10 年心血管疾病風險計算
- 自動帶入病患資料
- 提供詳細的風險因子分析

### CDS Hook 系統
- 模擬真實的 CDS Hook 工作流程
- 支援多種臨床決策支援工具
- 即時建議和警告系統
- 與 FHIR 標準相容

### SMART on FHIR 整合
- 支援外部 SMART 應用程式
- 模擬應用程式啟動流程
- 標準化的 API 介面
- 安全的資料存取

## 自定義和擴展

### 添加新的 CDS Hook
1. 在 `script.js` 中添加新的功能函數
2. 在 `updateCenterPanel()` 函數中添加對應的 case
3. 在 `index.html` 中添加功能按鈕

### 自定義樣式
- 修改 `styles.css` 中的 CSS 變數
- 調整顏色方案和字型
- 添加自定義動畫效果

### 整合真實 FHIR 資料
- 修改 `loadPatientData()` 函數
- 添加 FHIR 客戶端庫
- 實現真實的資料來源連接

## 瀏覽器支援

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 部署說明

### 本地開發
1. **複製檔案**到本地目錄
2. **啟動 HTTP 服務器**（必需，不能直接開啟檔案）：
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   
   # Node.js
   npx http-server -p 8000
   ```
3. **測試 SMART 啟動**：
   - EHR Launch: 使用 [SMART Health IT Launcher](http://launch.smarthealthit.org/)
   - Standalone Launch: 直接訪問 `http://localhost:8000/launch.html?iss=https://r4.smarthealthit.org`

### 生產環境
1. **部署到 Web 服務器**
2. **配置 HTTPS**（SMART on FHIR 要求）
3. **註冊 SMART 應用程式**：
   - 在目標 EHR 系統註冊應用程式
   - 獲取 `client_id`
   - 配置重定向 URI：`https://your-domain.com/index.html`
   - 更新 `launch.html` 中的 `clientId`
4. **設定適當的安全標頭**
5. **配置 CORS**（如果需要）

### Cerner 沙盒配置
1. 在 [Cerner Developer Console](https://code.cerner.com/) 註冊應用程式
2. 設定重定向 URI：`http://localhost:8000/index.html`
3. 更新 `config.json` 中的 Cerner 配置
4. 在 `launch.html` 中使用 Cerner 的 `clientId`

### Epic 沙盒配置
1. 在 [Epic Developer Console](https://fhir.epic.com/) 註冊應用程式
2. 設定重定向 URI：`http://localhost:8000/index.html`
3. 更新 `config.json` 中的 Epic 配置
4. 注意：Epic 的重定向 URI 變更需要 24 小時生效

## 安全考慮

- 使用 HTTPS 進行資料傳輸
- 實施適當的身份驗證
- 確保 FHIR 資料的安全存取
- 定期更新依賴項目

## 貢獻指南

1. Fork 專案
2. 創建功能分支
3. 提交變更
4. 發起 Pull Request

## 許可證

MIT License - 詳見 LICENSE 文件

## 聯絡資訊

如有問題或建議，請聯絡開發團隊。

---

© 2024 SMART 平台開發團隊 