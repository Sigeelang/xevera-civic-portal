-- Xevera Portal: event RSVPs (idempotent)
CREATE TABLE IF NOT EXISTS event_rsvps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rsvp (event_id, user_id),
  KEY idx_rsvp_event (event_id),
  KEY idx_rsvp_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
