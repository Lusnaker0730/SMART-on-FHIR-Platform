@echo off
echo 🏥 SMART 平台 - 安全啟動腳本
echo ================================

echo 正在檢查端口可用性...
netstat -an | findstr ":8081" >nul
if %errorlevel% == 0 (
    echo 端口 8081 已被佔用，嘗試使用端口 8082...
    set PORT=8082
) else (
    echo 端口 8081 可用
    set PORT=8081
)

echo.
echo 正在啟動 HTTP 服務器 (端口 %PORT%)...
echo URL: http://localhost:%PORT%
echo.
echo ⚠️  重要提示：
echo    請確保使用 localhost 而不是 IP 地址來訪問應用
echo    這樣可以避免 Web Crypto API 安全上下文錯誤
echo.
echo 📝 測試步驟：
echo    1. 等待服務器啟動完成
echo    2. 瀏覽器會自動開啟到 http://localhost:%PORT%
echo    3. 測試 SMART 啟動：http://localhost:%PORT%/launch.html?iss=https://r4.smarthealthit.org
echo.
echo 按 Ctrl+C 停止服務器
echo ================================
echo.

npx http-server -p %PORT% -c-1 -o --cors

pause 