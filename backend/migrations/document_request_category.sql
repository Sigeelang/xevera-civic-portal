-- Xevera Portal: document request category (idempotent)
ALTER TABLE reports MODIFY COLUMN category ENUM('Waste','Water','Road & Infrastructure','Electrical','Public Safety','Document Request') NOT NULL DEFAULT 'Waste';
