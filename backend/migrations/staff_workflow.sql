-- Staff Admin workflow migration
-- Extends reports.status with the full workflow statuses, migrates legacy
-- 'Claimed' rows to 'In Progress', and adds workflow tracking columns.
-- 1) Extend enum (keep legacy 'Claimed' so the data update below is valid)
ALTER TABLE reports MODIFY status ENUM('Pending','Claimed','Resolved','Rejected','Verified','Assigned','In Progress','Closed') NOT NULL DEFAULT 'Pending';

-- 2) Migrate legacy 'Claimed' rows to the canonical working status
UPDATE reports SET status = 'In Progress' WHERE status = 'Claimed';

-- 3) Drop the legacy status from the enum
ALTER TABLE reports MODIFY status ENUM('Pending','Verified','Assigned','In Progress','Resolved','Closed','Rejected') NOT NULL DEFAULT 'Pending';

-- 4) Workflow tracking columns
ALTER TABLE reports
  ADD COLUMN verified_by INT NULL AFTER verified_at,
  ADD COLUMN resolved_at DATETIME NULL AFTER updated_at,
  ADD COLUMN closed_at DATETIME NULL AFTER resolved_at,
  ADD COLUMN rejection_reason TEXT NULL AFTER closed_at,
  ADD COLUMN remarks TEXT NULL AFTER rejection_reason,
  ADD COLUMN resolution TEXT NULL AFTER remarks;

-- 5) Foreign key for verified_by
ALTER TABLE reports ADD CONSTRAINT fk_reports_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL;
