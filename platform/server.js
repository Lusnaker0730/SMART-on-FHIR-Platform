const express = require('express');
const path = require('path');
const app = express();
const PORT = 8085; 

// 步驟 1: 設定靜態檔案服務路徑
// 這會處理所有對 /styles.css, /script.js 等檔案的請求
app.use(express.static(path.join(__dirname))); 

// 步驟 2: 處理所有 GET 請求的 SPA Fallback
// 這是最安全的處理方式：將所有請求 (包括 Keycloak 重定向) 都導向 index.html
app.get('/', (req, res) => {
    // 讓 App 的前端 JS 邏輯來決定下一步 (是啟動、還是處理 code= 參數)
    res.sendFile(path.join(__dirname, 'index.html'));
});


app.listen(PORT, () => {
    console.log(`SMART Platform running on port ${PORT}!`);
});