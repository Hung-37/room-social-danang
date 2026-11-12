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
