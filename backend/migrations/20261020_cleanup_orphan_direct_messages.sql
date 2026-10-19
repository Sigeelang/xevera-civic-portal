-- Remove direct messages whose sender or recipient no longer exists.
--
-- The canonical schema defines ON DELETE CASCADE foreign keys for
-- direct_messages, but rows created before those constraints were enforced
-- can still be orphaned. Orphans are invisible in list.php / updates.php
-- (INNER JOIN users) and make the Message Box look empty or broken.
--
-- Run once after restoring an older database:
--   mysql xevera_civic < 20261020_cleanup_orphan_direct_messages.sql

DELETE dm
FROM direct_messages dm
LEFT JOIN users s ON s.id = dm.sender_id
LEFT JOIN users r ON r.id = dm.recipient_id
WHERE s.id IS NULL OR r.id IS NULL;
