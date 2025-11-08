#!/usr/bin/env bash
# Remove all files in the 'avatars' bucket and delete the bucket using Supabase CLI or REST API
# WARNING: This permanently deletes avatar images. Ensure backups exist before running.

# Option A: Supabase CLI (recommended)
# Requires: supabase CLI logged in with an account that has project access
# Usage: ./scripts/remove_avatars_bucket.sh <project_ref>

PROJECT_REF="$1"
if [ -z "$PROJECT_REF" ]; then
  echo "Usage: $0 <project_ref>\nExample: $0 corcofbmafdxehvlbesx"
  exit 1
fi

echo "Deleting all objects in 'avatars' bucket and removing the bucket (project: $PROJECT_REF)..."

# remove all objects (recursive)
supabase storage rm --project-ref "$PROJECT_REF" --bucket avatars --recursive --yes

# remove bucket itself
supabase storage bucket remove --project-ref "$PROJECT_REF" avatars --yes

echo "Done. If you don't have supabase CLI access, use the REST API alternative below."

# Option B: REST API (curl) - requires SERVICE_ROLE_KEY
# Replace REPLACE_WITH_SERVICE_ROLE_KEY with your SUPABASE_SERVICE_ROLE_KEY
# PROJECT_URL example: https://<project>.supabase.co
# Curl to list and delete objects:
# 1) List objects:
# curl -H "Authorization: Bearer REPLACE_WITH_SERVICE_ROLE_KEY" "https://$PROJECT_REF.supabase.co/storage/v1/object/list/avatars"
# 2) Delete object:
# curl -X DELETE -H "Authorization: Bearer REPLACE_WITH_SERVICE_ROLE_KEY" "https://$PROJECT_REF.supabase.co/storage/v1/object/avatars/<object-path>"

# IMPORTANT: The REST API approach requires looping over listed objects and deleting them.
