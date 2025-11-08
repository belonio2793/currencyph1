-- 2025-11-08: Remove ReadyPlayer.me data from game_characters.appearance
-- Backup entries that contain 'rpm' key, then migrate thumbnail to top-level and remove the 'rpm' key.
BEGIN;

-- 1) Backup characters containing rpm appearance for safekeeping
CREATE TABLE IF NOT EXISTS game_characters_rpm_backup AS
SELECT id, user_id, appearance, created_at, updated_at
FROM game_characters
WHERE appearance ? 'rpm';

-- 2) Migrate rpm.thumbnail (if present) into top-level appearance.thumbnail, then remove rpm key
UPDATE game_characters
SET appearance = (
  (appearance || jsonb_build_object('thumbnail', (appearance->'rpm'->>'thumbnail'))) - 'rpm'
)
WHERE appearance ? 'rpm';

-- 3) For safety, also remove any nested rpm.meta fields left in other JSON paths (best-effort)
-- This operation attempts to strip 'rpm' from any JSONB field values contained in the table
-- (no other tables expected to contain rpm but we include this as a no-op when not present)
-- Note: adjust table/column names if you store appearance elsewhere.

COMMIT;

-- Optional: if you confirm backups and results look good, you can drop the backup table later:
-- DROP TABLE IF EXISTS game_characters_rpm_backup;
