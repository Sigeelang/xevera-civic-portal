-- Xevera Portal: Attendance approval workflow (idempotent).
-- The `attendance` approval/rejection columns already exist on the live
-- install; these guards keep the schema reproducible on fresh installs.

-- Direct messages can be linked to a report for report-linked staff messaging.
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS report_id INT NULL AFTER recipient_id;

-- Official time-in approval columns
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_in_status VARCHAR(20) DEFAULT 'Approved' AFTER time_in;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_in_approved_by INT NULL AFTER time_in_status;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_in_approved_at DATETIME NULL AFTER time_in_approved_by;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_in_rejected_by INT NULL AFTER time_in_approved_at;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_in_rejected_at DATETIME NULL AFTER time_in_rejected_by;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_in_rejection_reason TEXT NULL AFTER time_in_rejected_at;

-- Official time-out approval columns
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_out_status VARCHAR(20) DEFAULT 'Approved' AFTER time_out;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_out_approved_by INT NULL AFTER time_out_status;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_out_approved_at DATETIME NULL AFTER time_out_approved_by;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_out_rejected_by INT NULL AFTER time_out_approved_at;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_out_rejected_at DATETIME NULL AFTER time_out_rejected_by;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS time_out_rejection_reason TEXT NULL AFTER time_out_rejected_at;