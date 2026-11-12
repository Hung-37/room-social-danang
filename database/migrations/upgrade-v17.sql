-- Run npm run db:upgrade-v17: its CLI also adds version/deleted_at columns safely.
CREATE TABLE IF NOT EXISTS mutation_requests (
 user_id VARCHAR(191) NOT NULL, scope VARCHAR(32) NOT NULL,
 request_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 fingerprint CHAR(64) NOT NULL, result_id VARCHAR(191), response_json JSON,
 deleted BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,scope,request_key), INDEX mutation_result(scope,result_id), INDEX mutation_created(created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
