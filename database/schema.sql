CREATE TABLE IF NOT EXISTS listings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  external_id VARCHAR(512) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  price INT NULL,
  area_m2 DECIMAL(8,2) NULL,
  address VARCHAR(500) NULL,
  phone VARCHAR(40) NULL,
  image_url TEXT NULL,
  cluster_id VARCHAR(100) NULL,
  source_name VARCHAR(255) NOT NULL,
  source_url TEXT NULL,
  permission VARCHAR(64) NOT NULL,
  verification_status VARCHAR(32) NOT NULL DEFAULT 'needs_review',
  trust_score TINYINT UNSIGNED NOT NULL DEFAULT 20,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY listings_external_id (external_id)
  ,INDEX listings_status_updated (verification_status, updated_at)
  ,INDEX listings_cluster_status (cluster_id, verification_status)
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  external_id VARCHAR(128) NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'student',
  reputation INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY users_external_id (external_id),
  UNIQUE KEY users_email (email)
);

CREATE TABLE IF NOT EXISTS community_posts (
  id VARCHAR(128) NOT NULL PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  summary TEXT NOT NULL,
  cluster_id VARCHAR(100) NOT NULL,
  cluster_name VARCHAR(150) NOT NULL,
  post_kind VARCHAR(32) NOT NULL DEFAULT 'question',
  author_id BIGINT UNSIGNED NULL,
  author_name VARCHAR(120) NOT NULL,
  trust_score INT NOT NULL DEFAULT 20,
  status VARCHAR(32) NOT NULL DEFAULT 'needs_review',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX community_posts_updated (updated_at),
  INDEX community_posts_cluster (cluster_id),
  CONSTRAINT community_posts_author_fk FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS community_comments (
  id VARCHAR(128) NOT NULL PRIMARY KEY,
  post_id VARCHAR(128) NOT NULL,
  author_id BIGINT UNSIGNED NULL,
  author_name VARCHAR(120) NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX community_comments_post (post_id, created_at),
  CONSTRAINT community_comments_post_fk FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT community_comments_author_fk FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS moderation_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(128) NOT NULL,
  action VARCHAR(32) NOT NULL,
  actor_email VARCHAR(255) NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX moderation_entity (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS collector_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  status VARCHAR(32) NOT NULL,
  configured_sources INT NOT NULL DEFAULT 0,
  collected_count INT NOT NULL DEFAULT 0,
  duplicate_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  details JSON NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP NULL,
  INDEX collector_runs_started (started_at)
);

CREATE TABLE IF NOT EXISTS collector_source_settings (
  source_id VARCHAR(128) NOT NULL PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  config JSON NULL,
  updated_by VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  href VARCHAR(500) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX notifications_user (user_id, is_read, created_at),
  CONSTRAINT notifications_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_reactions (
  post_id VARCHAR(128) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  reaction VARCHAR(16) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  INDEX community_reactions_user (user_id),
  CONSTRAINT community_reactions_post_fk FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT community_reactions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS community_reports (
  id VARCHAR(128) NOT NULL PRIMARY KEY,
  post_id VARCHAR(128) NOT NULL,
  reporter_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(64) NOT NULL,
  details TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  resolved_by VARCHAR(255) NULL,
  INDEX community_reports_status (status, created_at),
  INDEX community_reports_post (post_id, created_at),
  CONSTRAINT community_reports_post_fk FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT community_reports_reporter_fk FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
);
