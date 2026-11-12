import { deduplicateListings, fetchHtmlListings, fetchLocalFileData, fetchPublicListings, publicSources } from './parser.js';

export async function collectConfiguredSources({ sources = publicSources, delayMs = 0, concurrency = 3 } = {}) {
  const enabledSources = sources.filter(
    (source) => source.enabled && ['public_api', 'public_feed', 'public_html', 'local_file'].includes(source.permission)
  );
  const runs = new Array(enabledSources.length);
  const workerCount = Math.min(Math.max(Number(concurrency) || 1, 1), 4);
  let nextIndex = 0;

  async function collectOne(source, index) {
    if (index > 0 && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      const fetchSource = () => source.permission === 'public_html'
        ? fetchHtmlListings(source)
        : source.permission === 'local_file'
          ? fetchLocalFileData(source)
          : fetchPublicListings(source);
      let listings;
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          listings = await fetchSource();
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
        }
      }
      if (!listings) throw lastError ?? new Error('Collector failed');
      runs[index] = {
        sourceId: source.id,
        sourceName: source.name,
        status: 'success',
        count: listings.length,
        warning: listings.length === 0 ? 'Nguồn phản hồi thành công nhưng không trích xuất được tin.' : undefined,
        listings
      };
    } catch (error) {
      runs[index] = {
        sourceId: source.id,
        sourceName: source.name,
        status: 'error',
        count: 0,
        error: error instanceof Error ? error.message : 'Collector failed'
      };
    }
  }

  async function worker() {
    while (nextIndex < enabledSources.length) {
      const index = nextIndex++;
      await collectOne(enabledSources[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return { sources: enabledSources, runs };
}

export function mergeCollectedRuns(runs) {
  const sourceListings = runs.flatMap((run) => run.listings ?? []);
  const listings = deduplicateListings(sourceListings);
  return { sourceListings, listings, duplicates: sourceListings.length - listings.length };
}
