-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: xevera_civic
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `activity_logs`
--

DROP TABLE IF EXISTS `activity_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `target_type` varchar(50) NOT NULL,
  `target_id` int(11) DEFAULT NULL,
  `detail` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `activity_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=70 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `activity_logs`
--

LOCK TABLES `activity_logs` WRITE;
/*!40000 ALTER TABLE `activity_logs` DISABLE KEYS */;
INSERT INTO `activity_logs` VALUES (1,NULL,'system_init','system',NULL,'Database initialized with sample data','2026-07-27 09:02:02'),(2,9,'login','auth',NULL,'User logged in','2026-07-27 09:24:15'),(3,9,'login','auth',NULL,'User logged in','2026-07-27 09:28:00'),(4,9,'login','auth',NULL,'User logged in','2026-07-27 09:32:17'),(5,9,'login','auth',NULL,'User logged in','2026-07-29 17:07:27'),(6,9,'login','auth',NULL,'User logged in','2026-07-29 17:53:48'),(7,9,'login','auth',NULL,'User logged in','2026-07-29 18:44:48'),(8,1,'login','auth',NULL,'User logged in','2026-07-29 19:06:09'),(9,9,'login','auth',NULL,'User logged in','2026-07-29 19:55:20'),(10,1,'logout','auth',NULL,'User logged out','2026-07-29 20:01:00'),(11,2,'login','auth',NULL,'User logged in','2026-07-29 20:22:52'),(12,NULL,'create_report','report',9,'Report submitted: XR-2026-001008 - water','2026-07-29 20:27:20'),(13,NULL,'create_report','report',10,'Report submitted: XR-2026-001000 - water','2026-07-29 20:35:16'),(14,NULL,'create_report','report',11,'Report submitted: XR-2026-001000 - water','2026-07-29 20:37:55'),(15,2,'logout','auth',NULL,'User logged out','2026-07-29 20:52:37'),(16,2,'login','auth',NULL,'User logged in','2026-07-30 17:54:31'),(17,6,'login','auth',NULL,'User logged in','2026-07-30 18:26:35'),(18,8,'login','auth',NULL,'User logged in','2026-07-30 18:28:45'),(19,NULL,'create_report','report',12,'Report submitted: XR-2026-001001 - nasapaw yung kanal','2026-07-30 18:29:31'),(20,8,'login','auth',NULL,'User logged in','2026-07-30 19:05:52'),(21,8,'login','auth',NULL,'User logged in','2026-07-30 19:05:56'),(22,8,'logout','auth',NULL,'User logged out','2026-07-30 19:06:08'),(23,8,'login','auth',NULL,'User logged in','2026-07-30 19:09:51'),(24,8,'logout','auth',NULL,'User logged out','2026-07-30 19:09:56'),(25,8,'login','auth',NULL,'User logged in','2026-07-30 19:14:52'),(26,8,'logout','auth',NULL,'User logged out','2026-07-30 19:17:10'),(27,8,'login','auth',NULL,'User logged in','2026-07-30 19:17:17'),(28,8,'logout','auth',NULL,'User logged out','2026-07-30 19:17:23'),(29,2,'login','auth',NULL,'User logged in','2026-07-30 19:18:50'),(30,2,'logout','auth',NULL,'User logged out','2026-07-30 19:19:07'),(31,1,'login','auth',NULL,'User logged in','2026-07-30 19:21:27'),(32,1,'logout','auth',NULL,'User logged out','2026-07-30 19:23:17'),(33,2,'login','auth',NULL,'User logged in','2026-07-30 20:07:50'),(34,2,'logout','auth',NULL,'User logged out','2026-07-30 20:08:49'),(35,9,'login','auth',NULL,'User logged in','2026-07-30 20:12:53'),(36,9,'logout','auth',NULL,'User logged out','2026-07-30 20:13:06'),(37,1,'login','auth',NULL,'User logged in','2026-07-31 20:17:33'),(38,3,'login','auth',NULL,'User logged in','2026-07-31 20:17:38'),(39,6,'login','auth',NULL,'User logged in','2026-07-31 20:17:43'),(40,2,'login','auth',NULL,'User logged in','2026-07-31 20:17:49'),(41,2,'login','auth',NULL,'User logged in','2026-07-31 20:18:44'),(42,2,'login','auth',NULL,'User logged in','2026-08-03 13:29:52'),(43,2,'logout','auth',NULL,'User logged out','2026-08-03 13:30:13'),(44,2,'logout','auth',NULL,'User logged out','2026-08-03 13:33:48'),(45,3,'login','auth',NULL,'User logged in','2026-08-03 13:34:39'),(46,3,'logout','auth',NULL,'User logged out','2026-08-03 13:34:48'),(47,1,'login','auth',NULL,'User logged in','2026-08-03 13:43:08'),(48,1,'logout','auth',NULL,'User logged out','2026-08-03 13:45:17'),(49,3,'login','auth',NULL,'User logged in','2026-08-03 13:52:48'),(50,3,'logout','auth',NULL,'User logged out','2026-08-03 13:53:44'),(51,1,'login','auth',NULL,'User logged in','2026-08-03 13:55:53'),(52,1,'login','auth',NULL,'User logged in','2026-08-03 13:56:57'),(53,1,'logout','auth',NULL,'User logged out','2026-08-03 13:58:12'),(54,1,'login','auth',NULL,'User logged in','2026-08-03 13:58:34'),(55,1,'logout','auth',NULL,'User logged out','2026-08-03 13:58:47'),(56,3,'login','auth',NULL,'User logged in','2026-08-03 14:10:12'),(57,3,'logout','auth',NULL,'User logged out','2026-08-03 14:11:17'),(58,2,'login','auth',NULL,'User logged in','2026-08-03 14:11:26'),(59,2,'logout','auth',NULL,'User logged out','2026-08-03 14:12:13'),(60,1,'login','auth',NULL,'User logged in','2026-08-03 14:12:19'),(61,1,'logout','auth',NULL,'User logged out','2026-08-03 14:13:32'),(62,2,'login','auth',NULL,'User logged in','2026-08-03 14:35:45'),(63,2,'logout','auth',NULL,'User logged out','2026-08-03 14:36:48'),(64,1,'login','auth',NULL,'User logged in','2026-08-03 14:41:48'),(65,1,'update_settings','settings',NULL,'Updated: site_name, contact_email, contact_phone, barangay_address, hero_title, hero_subtitle, reports_per_page, max_photos, max_file_size_mb, categories','2026-08-03 14:42:09'),(66,1,'logout','auth',NULL,'User logged out','2026-08-03 14:42:11'),(67,1,'login','auth',NULL,'User logged in','2026-08-04 17:04:10'),(68,1,'update_settings','settings',NULL,'Updated: site_name, contact_email, contact_phone, barangay_address, hero_title, hero_subtitle, reports_per_page, max_photos, max_file_size_mb, categories','2026-08-04 17:04:15'),(69,1,'logout','auth',NULL,'User logged out','2026-08-04 17:04:17');
/*!40000 ALTER TABLE `activity_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `announcements`
--

DROP TABLE IF EXISTS `announcements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `announcements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `category` varchar(50) DEFAULT 'general',
  `status` varchar(20) DEFAULT 'published',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `announcements`
--

LOCK TABLES `announcements` WRITE;
/*!40000 ALTER TABLE `announcements` DISABLE KEYS */;
/*!40000 ALTER TABLE `announcements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feedback`
--

DROP TABLE IF EXISTS `feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `feedback` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `report_id` int(11) NOT NULL,
  `resident_id` int(11) DEFAULT NULL,
  `rating` int(11) DEFAULT NULL,
  `comment` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `report_id` (`report_id`),
  CONSTRAINT `feedback_ibfk_1` FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feedback`
--

LOCK TABLES `feedback` WRITE;
/*!40000 ALTER TABLE `feedback` DISABLE KEYS */;
/*!40000 ALTER TABLE `feedback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rate_limits`
--

DROP TABLE IF EXISTS `rate_limits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `rate_limits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `identifier` varchar(255) NOT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'ip',
  `endpoint` varchar(50) NOT NULL DEFAULT 'report_submit',
  `window_start` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lookup` (`identifier`,`type`,`endpoint`,`window_start`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rate_limits`
--

LOCK TABLES `rate_limits` WRITE;
/*!40000 ALTER TABLE `rate_limits` DISABLE KEYS */;
INSERT INTO `rate_limits` VALUES (1,'user_2','user','report_submit','2026-07-31 02:29:31');
/*!40000 ALTER TABLE `rate_limits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reports`
--

DROP TABLE IF EXISTS `reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ref_id` varchar(20) NOT NULL,
  `title` varchar(200) NOT NULL,
  `category` enum('Waste','Water','Road & Infrastructure','Electrical','Public Safety') NOT NULL,
  `description` text NOT NULL,
  `location` varchar(255) NOT NULL,
  `status` enum('Pending','Claimed','Resolved') NOT NULL DEFAULT 'Pending',
  `assigned_to` int(11) DEFAULT NULL,
  `reporter_name` varchar(100) DEFAULT NULL,
  `reporter_phone` varchar(20) DEFAULT NULL,
  `reporter_email` varchar(100) DEFAULT NULL,
  `photo_paths` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`photo_paths`)),
  `likes` int(11) DEFAULT 0,
  `comments_count` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `ref_id` (`ref_id`),
  KEY `assigned_to` (`assigned_to`),
  CONSTRAINT `reports_ibfk_1` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reports`
--

LOCK TABLES `reports` WRITE;
/*!40000 ALTER TABLE `reports` DISABLE KEYS */;
INSERT INTO `reports` VALUES (11,'XR-2026-001000','water','Water','asfda','gasgasfdgafdsg','Pending',NULL,'Hanz','0860696986','seng@gmai.com','[\"uploads\\/photo_6a6a64a348cea.jpeg\",\"uploads\\/photo_6a6a64a3492b2.jpeg\"]',0,0,'2026-07-29 20:37:55','2026-07-29 20:37:55'),(12,'XR-2026-001001','nasapaw yung kanal','Water','tadoooooooo','jan lang','Pending',NULL,'Ana Reyes','846846657484','hajsfhjas@gmail.com','[\"uploads\\/photo_6a6b980b744ad.jpg\",\"uploads\\/photo_6a6b980b7515e.jpg\"]',0,0,'2026-07-30 18:29:31','2026-07-30 18:29:31');
/*!40000 ALTER TABLE `reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_settings`
--

DROP TABLE IF EXISTS `system_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `system_settings` (
  `key` varchar(50) NOT NULL,
  `value` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_settings`
--

LOCK TABLES `system_settings` WRITE;
/*!40000 ALTER TABLE `system_settings` DISABLE KEYS */;
INSERT INTO `system_settings` VALUES ('barangay_address','Barangay Hall, San Isidro, Xevera','2026-07-29 19:27:40'),('categories','[\"Waste\",\"Water\",\"Road & Infrastructure\",\"Electrical\",\"Public Safety\"]','2026-07-29 19:27:40'),('contact_email','civicdesk@xevera.gov.ph','2026-07-29 19:27:40'),('contact_phone','(02) 8123-4567','2026-07-29 19:27:40'),('hero_subtitle','Report environmental and civic issues in your community.','2026-07-29 19:27:40'),('hero_title','Together, let\'s build a cleaner and better Xevera.','2026-07-29 19:27:40'),('max_file_size_mb','5','2026-07-29 19:27:40'),('max_photos','8','2026-08-03 14:42:09'),('reports_per_page','1','2026-08-03 14:42:09'),('site_name','Xevera Civic Platform','2026-07-29 19:27:40');
/*!40000 ALTER TABLE `system_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `username` varchar(50) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `role` enum('Super Admin','Admin','Staff','Resident') NOT NULL DEFAULT 'Resident',
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Super Admin','super.admin','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','super.admin@xevera.gov.ph',NULL,'Super Admin','Active','2026-07-27 09:02:02'),(2,'Juan Dela Cruz','juan.dc','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','juan.dc@xevera.gov.ph',NULL,'Admin','Active','2026-07-27 09:02:02'),(3,'Maria Santos','maria.s','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','maria.s@xevera.gov.ph',NULL,'Staff','Active','2026-07-27 09:02:02'),(4,'Ana Cruz','ana.cruz','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','ana.cruz@xevera.gov.ph',NULL,'Staff','Active','2026-07-27 09:02:02'),(5,'Pedro Reyes','pedro.reyes','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','pedro.reyes@xevera.gov.ph',NULL,'Staff','Inactive','2026-07-27 09:02:02'),(6,'Maria Santos','maria.santos','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','maria@email.com','Block 3, Phase 1, Xevera','Resident','Active','2026-07-27 09:02:02'),(7,'Juan Resident',NULL,'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','juan@email.com','Block 5, Phase 2, Xevera','Resident','Active','2026-07-27 09:02:02'),(8,'Ana Reyes','ana.reyes','$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi','ana@email.com','Block 2, Phase 3, Xevera','Resident','Active','2026-07-27 09:02:02'),(9,'Hanz','hanz','$2y$10$/NnRjcW2vTKBLbUHwbpbnuMddx5EUuNi94hRhchiDYhY92Jcpi7Aq','hanz@gmail.com','','Resident','Active','2026-07-27 09:02:02');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'xevera_civic'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-05  1:07:22
