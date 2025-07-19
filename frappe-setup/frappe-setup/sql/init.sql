-- Initialize Frappe HRMS database
CREATE DATABASE IF NOT EXISTS frappe_hrms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON frappe_hrms.* TO 'frappe'@'%';
FLUSH PRIVILEGES;