-- Full Contact Support ticket lifecycle (Admin Message Box).
-- Extends the workflow_status enum added by contact_workflow_status.sql
-- with 'In Review' and 'Closed'.
ALTER TABLE contact_messages
  MODIFY COLUMN workflow_status ENUM('New','In Review','In Progress','Resolved','Closed') NOT NULL DEFAULT 'New';
