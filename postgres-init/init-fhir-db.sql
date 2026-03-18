-- Create database and user for FHIR Server
CREATE USER fhiruser WITH PASSWORD 'change-password';
CREATE DATABASE fhirdata OWNER fhiruser;
GRANT ALL PRIVILEGES ON DATABASE fhirdata TO fhiruser;

-- Connect to fhirdata and grant schema permissions for HAPI FHIR
\c fhirdata
GRANT ALL ON SCHEMA public TO fhiruser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO fhiruser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO fhiruser;
