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
