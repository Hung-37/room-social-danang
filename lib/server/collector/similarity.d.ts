export interface SimilarityInput {
  id: string; title: string; address?: string | null; summary?: string | null;
  imageUrl?: string | null; imageHash?: string | null;
  clusterId?: string | null; url?: string | null;
}
export interface SimilarityMatch {
  left: string; right: string; leftTitle: string; rightTitle: string; score: number;
}
export function findSimilarListings(input: SimilarityInput[]): SimilarityMatch[];
export function scanSimilarListings(input: SimilarityInput[]): Promise<SimilarityMatch[]>;
