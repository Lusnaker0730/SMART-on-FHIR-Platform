-- 建立 keycloak user
DO
$$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'keycloak') THEN
      CREATE ROLE keycloak LOGIN PASSWORD 'keycloak123';
   END IF;
END
$$;

CREATE DATABASE keycloak WITH OWNER = keycloak ENCODING 'UTF8' LC_COLLATE 'en_US.utf8' LC_CTYPE 'en_US.utf8' TEMPLATE template0;


-- 建立 fhir user
DO
$$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'fhir') THEN
      CREATE ROLE fhir LOGIN PASSWORD 'fhir123';
   END IF;
END
$$;

-- -- 建立 hapi database (單獨語句)
CREATE DATABASE hapi WITH OWNER = fhir ENCODING 'UTF8' LC_COLLATE 'en_US.utf8' LC_CTYPE 'en_US.utf8' TEMPLATE template0;

-- 權限
GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;
GRANT ALL PRIVILEGES ON DATABASE hapi TO fhir;

