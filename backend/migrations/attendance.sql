-- Staff Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  time_in DATETIME NULL,
  time_out DATETIME NULL,
  status VARCHAR(20) DEFAULT 'Absent',
  total_minutes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_staff_date (staff_id, attendance_date),
  FOREIGN KEY (staff_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE attendance ADD COLUMN time_out_source VARCHAR(20) DEFAULT NULL AFTER time_out;
ALTER TABLE attendance ADD COLUMN time_out_recorded_by INT DEFAULT NULL AFTER time_out_source;
ALTER TABLE attendance ADD COLUMN time_out_reason TEXT DEFAULT NULL AFTER time_out_recorded_by;
ALTER TABLE attendance ADD COLUMN time_in_source VARCHAR(20) DEFAULT 'STAFF' AFTER time_in;
ALTER TABLE attendance ADD COLUMN time_in_recorded_by INT DEFAULT NULL AFTER time_in_source;
