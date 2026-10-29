-- ============================================================================
-- CodeNest Free Academy — Token Version Migration for Safe Session Revocation
-- Target Engine: TiDB Cloud Serverless / MySQL 8.0+ Compatible
-- Target Table: users
-- 
-- IMPORTANT DEPLOYMENT INSTRUCTIONS:
-- 1. Execute this DDL migration against the target database BEFORE deploying
--    the updated backend code to production.
-- 2. Database Selection:
--    Do NOT hardcode a database name here. Ensure the correct database is
--    selected in your client session or connection configuration (e.g., via
--    process.env.DB_NAME or mysql -D <database_name>).
-- 3. Preflight Check (Read-Only — run before applying):
--    SELECT COUNT(*) AS column_exists
--    FROM INFORMATION_SCHEMA.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND TABLE_NAME = 'users'
--      AND COLUMN_NAME = 'token_version';
--    * If column_exists = 0: Proceed with executing the ALTER TABLE statement below.
--    * If column_exists = 1: The column is already present; skip this migration.
-- 4. Online DDL Behavior (TiDB Cloud):
--    TiDB processes schema changes online via its distributed asynchronous
--    schema framework without table-level write locks. Do not specify
--    MySQL-specific clauses like ALGORITHM=INSTANT.
-- 5. Rollback Limitation:
--    If backend code must be rolled back, leave this column in place. NEVER
--    drop the column (ALTER TABLE users DROP COLUMN token_version) while the
--    backend code is running.
-- ============================================================================

-- Apply column addition (Standard Universal DDL):
ALTER TABLE users 
ADD COLUMN token_version INT NOT NULL DEFAULT 1 
AFTER role;

-- ============================================================================
-- POST-MIGRATION VERIFICATION (Read-Only — run after applying):
-- ============================================================================
-- SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, IS_NULLABLE
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME = 'users'
--   AND COLUMN_NAME = 'token_version';
-- Expected result:
-- COLUMN_NAME: token_version | DATA_TYPE: int | COLUMN_DEFAULT: 1 | IS_NULLABLE: NO
-- ============================================================================
