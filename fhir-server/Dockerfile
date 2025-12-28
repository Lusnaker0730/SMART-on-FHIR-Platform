# =========================================================
# 第一階段：BUILDER (負責編譯和打包 JAR 檔案)
# =========================================================
FROM maven:3.9.6-eclipse-temurin-17 AS builder

# 設定工作目錄
WORKDIR /app

# 將 Maven 專案設定檔和原始碼複製到容器中
COPY pom.xml .
COPY src/ src/ 

# ---------------------------------------------------------
# 確保我們從乾淨的狀態開始，避免網路不穩定的部分下載檔案
# ---------------------------------------------------------
RUN rm -rf /root/.m2/repository/

# 編譯並打包專案
# 使用 -Dspring-boot.packaging=jar 確保它打包成可執行的 JAR 而不是 WAR
RUN mvn clean package -DskipTests -Dspring-boot.packaging=jar
# ---------------------------------------------------------

# =========================================================
# 第二階段：RUNTIME (使用輕量級 JRE 運行應用程式)
# =========================================================
FROM eclipse-temurin:17-jre-alpine

# 工作目錄
WORKDIR /opt/fhir-server

# 修正點：從 BUILDER 階段複製正確的 JAR 檔案
# 根據 pom.xml 的 <finalName>ROOT</finalName>，它會生成 ROOT.jar
COPY --from=builder /app/target/ROOT.jar /opt/fhir-server/hapi-fhir-server.jar 

# 複製 HAPI properties
COPY hapi.properties /hapi.properties

EXPOSE 8080

# 啟動 HAPI FHIR Server
CMD ["java", "-jar", "/opt/fhir-server/hapi-fhir-server.jar", "--spring.config.location=/hapi.properties"]