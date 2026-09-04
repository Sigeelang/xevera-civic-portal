-- Resident Concerns workflow status migration
ALTER TABLE contact_messages
  ADD COLUMN workflow_status ENUM('New','In Progress','Resolved') NOT NULL DEFAULT 'New' AFTER status;

UPDATE contact_messages SET workflow_status = 'New' WHERE workflow_status IS NULL OR workflow_status = '';

ALTER TABLE contact_messages
  ADD INDEX idx_workflow (workflow_status);