export const REFERENCE_LABEL: string;
export function safeSourceUrl(value: unknown): string | undefined;
export function listingPresentation(input: object): {
 contentKind: 'listing' | 'discussion'; isReference: boolean; label: string;
 canChat: boolean; showImages: boolean; sourceName: string; sourceUrl: string | undefined; updated: string;
};
