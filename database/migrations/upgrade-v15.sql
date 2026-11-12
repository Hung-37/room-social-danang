-- Minimal tombstones prevent a deleted external ID from being collected again.
CREATE TABLE IF NOT EXISTS listing_deletions (
 external_id VARCHAR(191) PRIMARY KEY,
 title VARCHAR(255) NOT NULL,
 reason VARCHAR(500) NOT NULL,
 deleted_by VARCHAR(255) NOT NULL,
 deleted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX listing_deletions_created (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
