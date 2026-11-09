-- Apply once on an existing installation.
ALTER TABLE listings
  ADD INDEX listings_status_updated (verification_status, updated_at),
  ADD INDEX listings_cluster_status (cluster_id, verification_status);
