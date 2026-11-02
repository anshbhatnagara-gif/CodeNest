-- CodeNest Free Academy — MySQL Schema (v1.0)
-- Run: mysql -u root -p codenest_free_academy < backend/sql/schema.sql

CREATE DATABASE IF NOT EXISTS codenest_free_academy;
USE codenest_free_academy;

-- =============================================
-- TABLE: users
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20) DEFAULT '',
  password VARCHAR(255) NOT NULL,
  role ENUM('student', 'owner') DEFAULT 'student',
  token_version INT NOT NULL DEFAULT 1,
  xp INT DEFAULT 0,
  level INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP NULL,
  last_active_at TIMESTAMP NULL
);

-- =============================================
-- TABLE: courses
-- =============================================
CREATE TABLE IF NOT EXISTS courses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  difficulty ENUM('Beginner', 'Intermediate', 'Advanced') DEFAULT 'Beginner',
  duration VARCHAR(50),
  thumbnail VARCHAR(500),
  instructor VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_course_title (title)
);

-- =============================================
-- TABLE: modules
-- =============================================
CREATE TABLE IF NOT EXISTS modules (
  id INT PRIMARY KEY AUTO_INCREMENT,
  course_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  order_index INT DEFAULT 0,
  duration VARCHAR(50) DEFAULT '15 min',
  UNIQUE KEY uq_course_module_order (course_id, order_index),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- =============================================


-- TABLE: enrollments
-- =============================================
CREATE TABLE IF NOT EXISTS enrollments (

  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  course_id INT NOT NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_enrollment (user_id, course_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- =============================================
-- TABLE: progress
-- =============================================
CREATE TABLE IF NOT EXISTS progress (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  module_id INT NOT NULL,
  
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_progress (user_id, module_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
);

-- =============================================
-- TABLE: activity_logs
-- =============================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  action VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- TABLE: notes

-- =============================================
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