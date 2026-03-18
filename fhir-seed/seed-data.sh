#!/bin/sh

FHIR_BASE="http://fhir-server:9080/fhir-server"
KEYCLOAK_URL="http://keycloak:8080/realms/fhir/protocol/openid-connect/token"
CLIENT_ID="${KEYCLOAK_CLIENT_ID:-hapi-fhir-client}"
CLIENT_SECRET="${KEYCLOAK_CLIENT_SECRET:-hapi-secret}"
MAX_RETRIES=60
RETRY_INTERVAL=5

echo "=== FHIR Seed Data Loader ==="
echo "Waiting for FHIR Server to be ready..."

# Wait for FHIR Server to respond (any HTTP code means it's up, including 401)
retries=0
while true; do
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${FHIR_BASE}/metadata" 2>/dev/null) || HTTP_STATUS="000"
  if [ "$HTTP_STATUS" != "000" ]; then
    echo "FHIR Server is responding (HTTP ${HTTP_STATUS})"
    break
  fi
  retries=$((retries + 1))
  if [ "$retries" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: FHIR Server not ready after $((MAX_RETRIES * RETRY_INTERVAL)) seconds. Exiting."
    exit 1
  fi
  echo "  Attempt ${retries}/${MAX_RETRIES} - FHIR Server not ready, retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

echo "FHIR Server is ready!"

# Obtain access token from Keycloak using password grant
echo "Obtaining access token from Keycloak..."
TOKEN_RESPONSE=$(curl -s -X POST "$KEYCLOAK_URL" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=${CLIENT_ID}" \
  -d "client_secret=${CLIENT_SECRET}" \
  -d "username=${FHIR_ADMIN_USER:-fhir-admin}" \
  -d "password=${FHIR_ADMIN_PASSWORD:-fhir-admin}" 2>&1)

ACCESS_TOKEN=""
if [ -n "$TOKEN_RESPONSE" ]; then
  # Extract token using basic string parsing (no jq available)
  ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | sed 's/.*"access_token"[ ]*:[ ]*"\([^"]*\)".*/\1/')
fi

if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "$TOKEN_RESPONSE" ]; then
  echo "Access token obtained successfully."
else
  echo "WARNING: Could not obtain Keycloak token. Trying without authentication..."
  ACCESS_TOKEN=""
fi

# Create test patient via PUT (idempotent - safe to re-run)
echo "Creating test patient (test-patient-1)..."

if [ -n "$ACCESS_TOKEN" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    "${FHIR_BASE}/Patient/test-patient-1" \
    -H "Content-Type: application/fhir+json" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -d @/seed/test-patient.json 2>&1) || HTTP_CODE="000"
else
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    "${FHIR_BASE}/Patient/test-patient-1" \
    -H "Content-Type: application/fhir+json" \
    -d @/seed/test-patient.json 2>&1) || HTTP_CODE="000"
fi

case "$HTTP_CODE" in
  200|201)
    echo "SUCCESS: Test patient created/updated (HTTP ${HTTP_CODE})"
    ;;
  *)
    echo "WARNING: Unexpected response (HTTP ${HTTP_CODE})."
    # Try without auth as fallback
    if [ -n "$ACCESS_TOKEN" ]; then
      echo "Retrying without authentication..."
      HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
        "${FHIR_BASE}/Patient/test-patient-1" \
        -H "Content-Type: application/fhir+json" \
        -d @/seed/test-patient.json 2>&1) || HTTP_CODE="000"
      case "$HTTP_CODE" in
        200|201)
          echo "SUCCESS: Test patient created/updated without auth (HTTP ${HTTP_CODE})"
          ;;
        *)
          echo "WARNING: Could not create patient (HTTP ${HTTP_CODE}). Manual setup may be needed."
          ;;
      esac
    fi
    ;;
esac

echo "=== Seed data loading complete ==="
