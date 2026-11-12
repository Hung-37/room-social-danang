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
