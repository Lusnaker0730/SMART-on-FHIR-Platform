# 使用 Nginx 作為基礎映像檔
FROM nginx:alpine

# 1. 複製你的前端檔案到 Nginx 預設網頁目錄
COPY index.html /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
# 如果有 CSS 檔案也請加入
# COPY styles.css /usr/share/nginx/html/

# 2. 建立 Nginx 設定，讓它在容器內監聽 8085 (與 docker-compose 對齊)
RUN echo 'server { \
    listen 8085; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# 3. 開放 8085 埠
EXPOSE 8085

# 4. 啟動 Nginx
CMD ["nginx", "-g", "daemon off;"]