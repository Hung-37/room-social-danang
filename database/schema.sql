-- MySQL 8+ / MariaDB 10.11+. Create a database and select it before running.
CREATE TABLE IF NOT EXISTS users (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, external_id VARCHAR(191) NOT NULL UNIQUE,
 name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL,
 role ENUM('student','landlord','admin') NOT NULL DEFAULT 'student', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX users_role_id (role, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS landlord_verifications (
 user_external_id VARCHAR(191) PRIMARY KEY, status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
 reviewed_by VARCHAR(255), updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (user_external_id) REFERENCES users(external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS listings (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, external_id VARCHAR(191) NOT NULL UNIQUE,
 title VARCHAR(255) NOT NULL, summary TEXT NOT NULL, price DECIMAL(14,0), area_m2 DECIMAL(10,2), address TEXT,
 phone VARCHAR(40), image_url TEXT, cluster_id VARCHAR(191), source_name VARCHAR(255), source_url TEXT,
 permission VARCHAR(100), verification_status ENUM('needs_review','verified','rejected') NOT NULL DEFAULT 'needs_review',
 trust_score INT NOT NULL DEFAULT 30, owner_external_id VARCHAR(191),
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX listing_owner_updated (owner_external_id, updated_at), INDEX listing_status (verification_status, updated_at),
 INDEX listing_cluster_status_updated (cluster_id, verification_status, updated_at), INDEX listing_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS community_posts (
 id VARCHAR(191) PRIMARY KEY, title VARCHAR(255) NOT NULL, summary TEXT NOT NULL, cluster_id VARCHAR(191), cluster_name VARCHAR(255),
 post_kind VARCHAR(30), author_id BIGINT UNSIGNED, author_name VARCHAR(255), trust_score INT DEFAULT 20,
 status ENUM('needs_review','verified','rejected') DEFAULT 'needs_review', version INT UNSIGNED NOT NULL DEFAULT 1, deleted_at DATETIME NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX community_status_updated (status, updated_at),
 INDEX community_status_cluster_updated (status, cluster_id, updated_at),
 INDEX community_status_kind_updated (status, post_kind, updated_at),
 INDEX community_author_content(author_id,deleted_at,updated_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS community_comments (
 id VARCHAR(191) PRIMARY KEY, post_id VARCHAR(191) NOT NULL, author_id BIGINT UNSIGNED,
 author_name VARCHAR(255), body TEXT NOT NULL, version INT UNSIGNED NOT NULL DEFAULT 1, deleted_at DATETIME NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX comments_post_created (post_id, created_at), INDEX comments_author_content(author_id,deleted_at,created_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS community_reactions (
 post_id VARCHAR(191) NOT NULL, user_id BIGINT UNSIGNED NOT NULL, reaction VARCHAR(30) NOT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (post_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS notifications (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, type VARCHAR(50), title VARCHAR(255), body TEXT, href TEXT,
 is_read BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX notifications_user_created (user_id, created_at), INDEX notifications_user_unread(user_id,is_read,created_at,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS community_reports (
 id VARCHAR(191) PRIMARY KEY, post_id VARCHAR(191) NOT NULL, reporter_id BIGINT UNSIGNED NOT NULL, reason VARCHAR(255), details TEXT,
 status ENUM('pending','resolved','dismissed') DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 resolved_at TIMESTAMP NULL, resolved_by VARCHAR(255), INDEX reports_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS moderation_logs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, entity_type VARCHAR(100), entity_id VARCHAR(191), action VARCHAR(100), actor_email VARCHAR(255),
 details JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX moderation_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS collector_source_settings (
 source_id VARCHAR(191) PRIMARY KEY, enabled BOOLEAN DEFAULT FALSE, config JSON, updated_by VARCHAR(255),
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS collector_runs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, status VARCHAR(50), configured_sources INT, collected_count INT,
 duplicate_count INT, error_count INT, details JSON, started_at DATETIME, finished_at DATETIME, INDEX collector_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Discussion replies and private inbox (v7)
CREATE TABLE IF NOT EXISTS comment_replies (
 comment_id VARCHAR(191) PRIMARY KEY, parent_id VARCHAR(191) NOT NULL,
 INDEX replies_parent(parent_id),
 FOREIGN KEY(comment_id) REFERENCES community_comments(id), FOREIGN KEY(parent_id) REFERENCES community_comments(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS conversations (
 id VARCHAR(191) PRIMARY KEY, listing_id VARCHAR(191) NOT NULL, room_title VARCHAR(255) NOT NULL,
 buyer_id VARCHAR(191) NOT NULL, seller_id VARCHAR(191) NOT NULL,
 blocked_by VARCHAR(191) NULL, buyer_read BIGINT UNSIGNED NOT NULL DEFAULT 0, seller_read BIGINT UNSIGNED NOT NULL DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY conversation_room_buyer(listing_id,buyer_id), INDEX conversation_buyer(buyer_id,updated_at), INDEX conversation_seller(seller_id,updated_at),
 FOREIGN KEY(buyer_id) REFERENCES users(external_id), FOREIGN KEY(seller_id) REFERENCES users(external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS private_messages (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, conversation_id VARCHAR(191) NOT NULL,
 sender_id VARCHAR(191) NOT NULL, body TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX messages_conversation(conversation_id,id), FOREIGN KEY(conversation_id) REFERENCES conversations(id), FOREIGN KEY(sender_id) REFERENCES users(external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS conversation_reports (
 id VARCHAR(191) PRIMARY KEY, conversation_id VARCHAR(191) NOT NULL, reporter_id VARCHAR(191) NOT NULL,
 reason VARCHAR(1000) NOT NULL, status ENUM('pending','resolved','dismissed') DEFAULT 'pending', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX chat_reports_status(status,created_at), FOREIGN KEY(conversation_id) REFERENCES conversations(id), FOREIGN KEY(reporter_id) REFERENCES users(external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- V8 account favorites, room images and owner lifecycle
-- Back up first. Existing rows and data are preserved. Safe to re-run.
ALTER TABLE listings MODIFY COLUMN verification_status ENUM('needs_review','verified','rejected','hidden','rented') NOT NULL DEFAULT 'needs_review';
CREATE TABLE IF NOT EXISTS saved_posts (
 user_id VARCHAR(191) NOT NULL, post_id VARCHAR(191) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,post_id), INDEX saved_user_created(user_id,created_at),
 FOREIGN KEY(user_id) REFERENCES users(external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS listing_images (
 id VARCHAR(191) PRIMARY KEY, owner_id VARCHAR(191) NOT NULL, listing_id VARCHAR(191) NULL,
 position TINYINT UNSIGNED NOT NULL DEFAULT 0, body MEDIUMBLOB NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX images_listing_position(listing_id,position), INDEX images_owner_created(owner_id,created_at),
 FOREIGN KEY(owner_id) REFERENCES users(external_id), FOREIGN KEY(listing_id) REFERENCES listings(external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- V9 viewing appointments (UTC)
CREATE TABLE IF NOT EXISTS viewing_appointments (
 id VARCHAR(191) PRIMARY KEY, conversation_id VARCHAR(191) NOT NULL,
 buyer_id VARCHAR(191) NOT NULL, seller_id VARCHAR(191) NOT NULL,
 starts_at DATETIME NOT NULL, ends_at DATETIME NOT NULL,
 status ENUM('requested','confirmed','declined','cancelled','completed') NOT NULL DEFAULT 'requested',
 note VARCHAR(500) NOT NULL DEFAULT '', version INT UNSIGNED NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX visits_conversation_status(conversation_id,status,ends_at),
 INDEX visits_seller_time(seller_id,status,starts_at), INDEX visits_buyer_time(buyer_id,status,starts_at),
 FOREIGN KEY(conversation_id) REFERENCES conversations(id), FOREIGN KEY(buyer_id) REFERENCES users(external_id), FOREIGN KEY(seller_id) REFERENCES users(external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- V10
CREATE TABLE IF NOT EXISTS site_settings (
 id TINYINT UNSIGNED PRIMARY KEY, value JSON NOT NULL, version INT UNSIGNED NOT NULL DEFAULT 1,
 updated_by VARCHAR(255), updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS user_controls (
 user_id VARCHAR(191) PRIMARY KEY, blocked BOOLEAN NOT NULL DEFAULT FALSE, is_demo BOOLEAN NOT NULL DEFAULT FALSE,
 reason VARCHAR(500) NOT NULL DEFAULT '', version INT UNSIGNED NOT NULL DEFAULT 1, updated_by VARCHAR(255),
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS listing_ai_analysis (
 listing_id VARCHAR(191) PRIMARY KEY, status ENUM('success','error','skipped') NOT NULL,
 model VARCHAR(100) NOT NULL, prompt_version VARCHAR(40) NOT NULL, content_hash CHAR(64) NOT NULL,
 payload JSON NULL, error VARCHAR(500) NULL, analyzed_at DATETIME NOT NULL,
 FOREIGN KEY(listing_id) REFERENCES listings(external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Minimal tombstones prevent a deleted external ID from being collected again.
CREATE TABLE IF NOT EXISTS listing_deletions (
 external_id VARCHAR(191) PRIMARY KEY,
 title VARCHAR(255) NOT NULL,
 reason VARCHAR(500) NOT NULL,
 deleted_by VARCHAR(255) NOT NULL,
 deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX listing_deletions_created (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Run npm run db:upgrade-v17: its CLI also adds version/deleted_at columns safely.
CREATE TABLE IF NOT EXISTS mutation_requests (
 user_id VARCHAR(191) NOT NULL, scope VARCHAR(32) NOT NULL,
 request_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 fingerprint CHAR(64) NOT NULL, result_id VARCHAR(191), response_json JSON,
 deleted BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,scope,request_key), INDEX mutation_result(scope,result_id), INDEX mutation_created(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
