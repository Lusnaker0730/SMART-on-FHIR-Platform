-- Create database and user for FHIR Server
CREATE USER fhiruser WITH PASSWORD 'change-password';
CREATE DATABASE fhirdata OWNER fhiruser;
GRANT ALL PRIVILEGES ON DATABASE fhirdata TO fhiruser;
