-- =========================================================
-- report_workflow.sql
-- Canonical report workflow hardening.
--
-- 1) Add assigned_at so assignment time is recorded.
--    (The status enum is already canonical in the live DB:
--    'Pending','Verified','Assigned','In Progress','Resolved','Closed','Rejected')
-- =========================================================

ALTER TABLE reports
    ADD COLUMN assigned_at DATETIME NULL AFTER assigned_to;