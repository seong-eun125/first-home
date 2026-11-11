-- FIRST HOME 전용 DB와 사용자 만들기 (UPM과 완전히 분리된 DB입니다)
-- MySQL에 root로 접속한 뒤 실행:  mysql -u root -p < setup_db.sql
CREATE DATABASE IF NOT EXISTS firsthome CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS firsthome_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'firsthome'@'localhost' IDENTIFIED BY 'firsthome_pw';
CREATE USER IF NOT EXISTS 'firsthome'@'127.0.0.1' IDENTIFIED BY 'firsthome_pw';
GRANT ALL PRIVILEGES ON firsthome.* TO 'firsthome'@'localhost';
GRANT ALL PRIVILEGES ON firsthome.* TO 'firsthome'@'127.0.0.1';
GRANT ALL PRIVILEGES ON firsthome_test.* TO 'firsthome'@'localhost';
GRANT ALL PRIVILEGES ON firsthome_test.* TO 'firsthome'@'127.0.0.1';
FLUSH PRIVILEGES;
