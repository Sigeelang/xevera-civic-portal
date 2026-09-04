-- Xevera Portal: reintroduce report priority (Normal/High/Urgent)
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS priority ENUM('Normal','High','Urgent') NOT NULL DEFAULT 'Normal' AFTER category;