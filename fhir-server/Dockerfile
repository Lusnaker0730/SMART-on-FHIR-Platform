FROM hapiproject/hapi:v7.2.0

# # 安裝 PostgreSQL JDBC Driver
# RUN apt-get update && apt-get install -y wget && \
#     wget https://jdbc.postgresql.org/download/postgresql-42.7.3.jar -O /opt/hapi-fhir/lib/postgresql.jar

# # 設定資料庫為 PostgreSQL
# ENV JAVA_OPTS="-Dhapi.properties=/opt/hapi-fhir/hapi.properties"

# 建立設定檔
COPY hapi.properties /opt/hapi-fhir/hapi.properties

EXPOSE 8080