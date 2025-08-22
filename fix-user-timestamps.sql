-- Fix missing createdAt timestamps for existing users
-- Run this in your Replit database console or via a migration script

-- Update users with NULL or empty createdAt to current timestamp
UPDATE users 
SET created_at = CURRENT_TIMESTAMP 
WHERE created_at IS NULL 
   OR created_at = '' 
   OR created_at = 'null'
   OR created_at = 'undefined';

-- Also update updated_at while we're at it
UPDATE users 
SET updated_at = CURRENT_TIMESTAMP 
WHERE updated_at IS NULL 
   OR updated_at = '' 
   OR updated_at = 'null'
   OR updated_at = 'undefined';

-- Verify the fix
SELECT id, email, first_name, last_name, created_at, updated_at 
FROM users 
ORDER BY id;
