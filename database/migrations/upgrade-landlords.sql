-- Existing installations only: run once after backing up the database.
ALTER TABLE listings ADD COLUMN owner_external_id VARCHAR(191) NULL, ADD INDEX listing_owner (owner_external_id);
CREATE TABLE IF NOT EXISTS landlord_verifications (
 user_external_id VARCHAR(191) PRIMARY KEY, status ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
 reviewed_by VARCHAR(255), updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (user_external_id) REFERENCES users(external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Legacy listings remain unassigned; do not infer ownership from names.
