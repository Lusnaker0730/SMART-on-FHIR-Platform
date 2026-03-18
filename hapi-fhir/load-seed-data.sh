#!/bin/sh
set -e

FHIR_URL="${FHIR_URL:-http://fhir-server:8080/fhir}"
SEED_FILE="/seed-data.json"
MAX_RETRIES=60
RETRY_INTERVAL=5

echo "Waiting for HAPI FHIR server at ${FHIR_URL} ..."

retries=0
until curl -sf "${FHIR_URL}/metadata" > /dev/null 2>&1; do
  retries=$((retries + 1))
  if [ "$retries" -ge "$MAX_RETRIES" ]; then
    echo "ERROR: FHIR server not ready after $((MAX_RETRIES * RETRY_INTERVAL)) seconds. Giving up."
    exit 1
  fi
  echo "  Attempt ${retries}/${MAX_RETRIES} - FHIR server not ready, retrying in ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

echo "FHIR server is ready!"

# Check if test patient already exists
if curl -sf "${FHIR_URL}/Patient/test-patient-1" > /dev/null 2>&1; then
  echo "Seed data already loaded (Patient/test-patient-1 exists). Skipping."
  exit 0
fi

echo "Loading seed data from ${SEED_FILE} ..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${FHIR_URL}" \
  -H "Content-Type: application/fhir+json" \
  -d @"${SEED_FILE}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "Seed data loaded successfully (HTTP ${HTTP_CODE})."
else
  echo "ERROR: Failed to load seed data (HTTP ${HTTP_CODE})."
  echo "$BODY"
  exit 1
fi
