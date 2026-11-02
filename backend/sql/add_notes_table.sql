-- CodeNest Free Academy — Notes Table Migration
USE codenest_free_academy;

CREATE TABLE IF NOT EXISTS notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content LONGTEXT,
  course_id INT NOT NULL,
  module_id INT NULL,
  file_url VARCHAR(1000) NULL,
  file_name VARCHAR(255) NULL,
  file_type VARCHAR(50) NULL,
  file_size INT NULL,
  status ENUM('draft', 'published') DEFAULT 'draft',
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notes_course (course_id),
  INDEX idx_notes_module (module_id),
  INDEX idx_notes_status (status),
  INDEX idx_notes_created_by (created_by)
);


