export interface SimilarityInput {
  id: string; title: string; address?: string | null; summary?: string | null;
  imageUrl?: string | null; imageHash?: string | null;
  clusterId?: string | null; url?: string | null;
}
export interface SimilarityMatch {
  left: string; right: string; leftTitle: string; rightTitle: string; score: number;
  near?: number;
}
export interface AutoDuplicateMatch extends SimilarityMatch {
  near: number;
}
export function findSimilarListings(input: SimilarityInput[]): SimilarityMatch[];
export function findAutoDuplicates(input: SimilarityInput[]): AutoDuplicateMatch[];
export function scanSimilarListings(input: SimilarityInput[]): Promise<SimilarityMatch[]>;
export function scanAutoDuplicates(input: SimilarityInput[]): Promise<AutoDuplicateMatch[]>;

export function reviewCollectedBatch(listings: Array<{
  externalId: string; title: string; summary?: string | null; address?: string | null;
  imageUrl?: unknown; clusterId?: string | null; source: { url: string | null };
}>): Promise<{ similarListings: SimilarityMatch[]; similarityScanned: number }>;
