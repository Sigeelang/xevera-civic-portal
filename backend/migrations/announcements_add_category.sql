-- Add category column to announcements table
-- This column was referenced in create.php and update.php but missing from the table
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';