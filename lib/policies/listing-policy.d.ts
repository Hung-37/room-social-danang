export function listingRejectionReason(
  listing: {
    title: string;
    summary: string;
    price: number | null;
    area: number | null;
    address: string | null;
  },
  daNangOnly?: boolean
): string;
