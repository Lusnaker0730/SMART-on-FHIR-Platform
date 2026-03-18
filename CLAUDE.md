# SMART on FHIR Platform

## Architecture

Docker Compose stack with nginx HTTPS reverse proxy:

```
Browser --HTTPS--> nginx-proxy --HTTP--> internal services
                    :8180  ->  keycloak:8080      (OIDC auth)
                    :8083  ->  fhir-server:8080   (HAPI FHIR R4)
                    :9009  ->  smart-launcher:80   (SMART App Launch)
```

Supporting services:
- **PostgreSQL 16** — shared by Keycloak (`keycloak` DB) and HAPI FHIR (`fhirdata` DB)
- **seed-data** — one-shot container that loads test patient data into FHIR server
- **nginx** — HTTPS termination with self-signed certs (`nginx/certs/`)

## Key Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | All service definitions |
| `hapi-fhir/application.yaml` | HAPI FHIR config (DB, CORS, server address) |
| `keycloak-data/fhir-realm.json` | Keycloak realm import (clients, scopes, users) |
| `nginx/nginx.conf` | HTTPS reverse proxy config |
| `postgres-init/init-fhir-db.sql` | Creates `fhirdata` DB and `fhiruser` on first boot |
| `hapi-fhir/load-seed-data.sh` | Seed data loader with retry logic |
| `hapi-fhir/seed-data.json` | Test patient Bundle (Patient + Observations) |
| `nginx/certs/` | Pre-generated self-signed SSL certs (gitignored) |

## External URLs (local dev)

- SMART Launcher: `https://localhost:9009`
- FHIR Server: `https://localhost:8083/fhir`
- Keycloak Admin: `https://localhost:8180` (admin/admin)

## Internal URLs (container-to-container)

- FHIR: `http://fhir-server:8080/fhir`
- Keycloak: `http://keycloak:8080`
- Smart Launcher uses internal URLs for backend calls, external HTTPS URLs for browser redirects

## Keycloak Clients

| Client ID | Type | Purpose |
|-----------|------|---------|
| `smart_cds_platform` | Public | Frontend SMART app (standard flow) |
| `hapi-fhir-client` | Confidential | Backend FHIR access |
| `smart-launcher-client` | Confidential | Launcher backend |

Default test user: `fhir-admin` / `fhir-admin`

## HAPI FHIR Notes

- Uses `hapiproject/hapi:latest` — requires `spring.main.allow-circular-references: true` due to a Spring Bean cycle bug
- Flyway is disabled (`spring.flyway.enabled: false`) — Hibernate `hbm2ddl.auto: update` manages schema
- First startup is slow (~2 min) due to schema creation; subsequent starts are fast
- JVM heap set to `-Xms512m -Xmx2g` via `JAVA_TOOL_OPTIONS`
- Elasticsearch sniffer `Connection refused` warnings in logs are harmless (no ES configured)

## Common Tasks

```bash
# Start everything
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs <service> --tail 50

# Reload seed data
docker compose up -d seed-data

# Regenerate SSL certs (run from project root on host)
MSYS_NO_PATHCONV=1 openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout nginx/certs/selfsigned.key \
  -out nginx/certs/selfsigned.crt \
  -subj "/C=TW/ST=Local/L=Local/O=Dev/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Full reset (destroys all data)
docker compose down && docker volume rm postgres_data && docker compose up -d
```

## Known Issues

- Shell scripts must use LF line endings (not CRLF) — busybox `sh` in curl container fails on `\r`
- Port 8080 is avoided for Keycloak external port (commonly occupied); uses 8180 instead
- `fhir-seed/` directory is dead code (leftover from IBM FHIR era) — safe to delete
- `patient-picker/` directory is orphaned — custom picker was replaced by launcher's built-in one
- All passwords are hardcoded defaults — acceptable for dev, must be changed for production

## VM Deployment (187.77.155.248)

- SSH: `ssh -i ~/.ssh/id_ed25519 root@187.77.155.248`
- Hosts separate services: `smart_fhir_app` (port 9000), `docker-frontend` (port 8888), HAPI FHIR, PostgreSQL, monitoring stack
- When launching from local SMART Launcher to VM app, ISS/token URLs must use the host's real IP (not `localhost`) — otherwise the VM app cannot reach back to Keycloak for token exchange
