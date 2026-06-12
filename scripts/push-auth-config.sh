#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="zweqxjeuwwfrlpbuuayg"
SITE_URL="https://www.pocketedge.in"
REDIRECT_URLS="https://www.pocketedge.in/**,https://pocketedge.in/**,https://pocketedge-rho.vercel.app/**,http://localhost:5174/**,http://127.0.0.1:5174/**"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "Missing SUPABASE_ACCESS_TOKEN."
  echo "Create one at https://supabase.com/dashboard/account/tokens then run:"
  echo "  SUPABASE_ACCESS_TOKEN=... npm run auth:push"
  exit 1
fi

echo "Updating Supabase auth URLs for ${PROJECT_REF}..."
curl -sS -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"site_url\":\"${SITE_URL}\",\"uri_allow_list\":\"${REDIRECT_URLS}\"}" \
  | python3 -m json.tool

echo "Done. Site URL -> ${SITE_URL}"
