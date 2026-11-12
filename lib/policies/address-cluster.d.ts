export const UNASSIGNED_CLUSTER_ID: string;
export function normalizeAddress(value?: string | null): string;
export function autoAssignCluster(
  address?: string | null,
  title?: string | null,
  summary?: string | null,
): string;
export function ensureClusterAssigned(listing: {
  address?: string | null;
  title?: string | null;
  summary?: string | null;
  clusterId?: string | null;
}): string;
