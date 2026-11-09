/**
 * Local storage fallback for when database is not available
 */

export interface LocalListing {
  externalId: string;
  title: string;
  summary: string;
  price: number | null;
  area: number | null;
  address: string | null;
  clusterId: string | null;
  sourceName: string;
  sourceUrl: string | null;
  verificationStatus: string;
  trustScore: number;
  createdAt: string;
}

const LOCAL_STORAGE_KEY = 'room-danang-listings';

export function getLocalListings(): LocalListing[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLocalListings(listings: LocalListing[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(listings));
  } catch (error) {
    console.error('Failed to save to local storage:', error);
  }
}

export function addLocalListing(listing: LocalListing): void {
  const listings = getLocalListings();
  const existingIndex = listings.findIndex(l => l.externalId === listing.externalId);
  
  if (existingIndex >= 0) {
    listings[existingIndex] = listing;
  } else {
    listings.unshift(listing);
  }
  
  saveLocalListings(listings);
}

export function clearLocalListings(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}