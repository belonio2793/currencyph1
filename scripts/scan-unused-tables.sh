#!/bin/bash

# Database Scanner - Find empty and unused tables
# Usage: bash scripts/scan-unused-tables.sh

set -e

SUPABASE_URL="${SUPABASE_URL:-$VITE_PROJECT_URL}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-$VITE_SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
  exit 1
fi

# Extract PostgreSQL connection info from Supabase URL
# URL format: https://PROJECT.supabase.co
PROJECT_ID=$(echo "$SUPABASE_URL" | sed -E 's|https://([^.]+)\.supabase\.co.*|\1|')

POSTGRES_URL="postgresql://postgres.${PROJECT_ID}:${SERVICE_ROLE_KEY}@${PROJECT_ID}.postgres.supabase.co:5432/postgres"

echo "🔍 Scanning database for unused tables..."
echo "📊 Connecting to: $PROJECT_ID.postgres.supabase.co"
echo ""

# Create temp file for SQL script
TEMP_SQL=$(mktemp)

cat > "$TEMP_SQL" << 'EOF'
-- Database Schema Analysis Report
-- Find empty and unused tables

WITH table_info AS (
  SELECT 
    schemaname,
    tablename,
    CASE WHEN schemaname = 'pg_catalog' THEN TRUE ELSE FALSE END as is_system,
    CASE WHEN schemaname = 'information_schema' THEN TRUE ELSE FALSE END as is_info_schema
  FROM pg_tables
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime')
),
table_sizes AS (
  SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
  FROM pg_stat_user_tables
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime')
),
foreign_keys AS (
  SELECT 
    constraint_name,
    table_schema,
    table_name,
    column_name,
    referenced_table_schema,
    referenced_table_name,
    referenced_column_name
  FROM information_schema.key_column_usage
  WHERE referenced_table_schema IS NOT NULL
),
table_fk_in AS (
  SELECT DISTINCT
    table_schema,
    table_name,
    COUNT(*) as incoming_fk_count
  FROM foreign_keys
  WHERE referenced_table_schema NOT IN ('auth', 'storage', 'realtime')
  GROUP BY table_schema, table_name
),
table_fk_out AS (
  SELECT DISTINCT
    table_schema,
    table_name,
    COUNT(*) as outgoing_fk_count
  FROM foreign_keys
  WHERE table_schema NOT IN ('auth', 'storage', 'realtime')
  GROUP BY table_schema, table_name
),
table_triggers AS (
  SELECT DISTINCT
    trigger_schema,
    event_object_table,
    COUNT(*) as trigger_count
  FROM information_schema.triggers
  WHERE trigger_schema NOT IN ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime')
  GROUP BY trigger_schema, event_object_table
)
SELECT
  ts.schemaname,
  ts.tablename,
  ts.row_count,
  ts.size,
  COALESCE(fki.incoming_fk_count, 0) as has_incoming_fk,
  COALESCE(fko.outgoing_fk_count, 0) as has_outgoing_fk,
  COALESCE(tt.trigger_count, 0) as has_triggers,
  CASE 
    WHEN ts.row_count = 0 AND COALESCE(fki.incoming_fk_count, 0) = 0 
         AND COALESCE(tt.trigger_count, 0) = 0 
         AND tablename NOT LIKE '%_backup%'
         AND tablename NOT LIKE '%_archive%'
    THEN '⚠️ CANDIDATE FOR DELETION'
    WHEN ts.row_count = 0 
    THEN '⚠️ EMPTY (has references)'
    WHEN ts.row_count > 0 AND COALESCE(fki.incoming_fk_count, 0) = 0 
         AND COALESCE(tt.trigger_count, 0) = 0
    THEN '✓ IN USE'
    ELSE '✓ IN USE'
  END as status
FROM table_sizes ts
LEFT JOIN table_fk_in fki ON ts.schemaname = fki.table_schema AND ts.tablename = fki.table_name
LEFT JOIN table_fk_out fko ON ts.schemaname = fko.table_schema AND ts.tablename = fko.table_name
LEFT JOIN table_triggers tt ON ts.schemaname = tt.trigger_schema AND ts.tablename = tt.event_object_table
ORDER BY 
  CASE 
    WHEN ts.row_count = 0 AND COALESCE(fki.incoming_fk_count, 0) = 0 THEN 0
    WHEN ts.row_count = 0 THEN 1
    ELSE 2
  END,
  ts.row_count ASC;

-- Summary counts
SELECT 
  'SUMMARY STATISTICS' as report_type,
  COUNT(*) as total_tables,
  SUM(CASE WHEN n_live_tup = 0 THEN 1 ELSE 0 END) as empty_tables,
  SUM(CASE WHEN n_live_tup > 0 THEN 1 ELSE 0 END) as populated_tables
FROM pg_stat_user_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime');

-- Potential DROP statements (REVIEW BEFORE EXECUTING)
SELECT
  '-- WARNING: Review before executing' as notice;

WITH candidates AS (
  SELECT 
    schemaname,
    tablename,
    n_live_tup as row_count,
    COALESCE((
      SELECT COUNT(*) FROM information_schema.key_column_usage 
      WHERE referenced_table_schema = schemaname 
      AND referenced_table_name = tablename
    ), 0) as has_incoming_fk
  FROM pg_stat_user_tables
  WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'auth', 'storage', 'realtime')
  AND n_live_tup = 0
  AND tablename NOT LIKE '%_backup%'
  AND tablename NOT LIKE '%_archive%'
)
SELECT
  'DROP TABLE IF EXISTS ' || schemaname || '."' || tablename || '" CASCADE;' as drop_statement
FROM candidates
WHERE has_incoming_fk = 0
ORDER BY tablename;
EOF

echo "📋 === TABLE ANALYSIS REPORT ===" 
echo ""
psql "$POSTGRES_URL" -f "$TEMP_SQL" 2>/dev/null || {
  echo "❌ Failed to connect to database. Trying alternative method..."
  
  # Alternative: Use curl to Supabase REST API
  echo "Using HTTP API method..."
  
  curl -s "$SUPABASE_URL/rest/v1/rpc/get_table_stats" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" 2>/dev/null || {
      echo "❌ Could not connect to database via psql or HTTP API"
      echo ""
      echo "📝 Manual SQL to run in Supabase SQL Editor:"
      cat "$TEMP_SQL"
    }
}

rm -f "$TEMP_SQL"

echo ""
echo "✅ Scan complete!"
echo ""
echo "📌 Next steps:"
echo "1. Review the report above"
echo "2. Tables marked with '⚠️ CANDIDATE FOR DELETION' can be safely dropped"
echo "3. Copy the DROP statements and run in Supabase SQL Editor"
echo "4. Always backup before deleting"
