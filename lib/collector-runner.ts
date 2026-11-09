import { collectConfiguredSources, mergeCollectedRuns } from '@/js/collector-service.js';
import { hasDatabaseConfig, saveListings } from '@/lib/db';
import { writeScrapedListings } from '@/lib/file-storage';
import { analyzeWithOllama } from '@/lib/ollama';
import { recordCollectorRun } from '@/lib/collector-run-storage';
import { hasCollectorDatabase, recordCollectorRunDb } from '@/lib/collector-db';
import type { CollectorSource } from '@/js/collector.js';

export async function runCollectorPipeline(sources: CollectorSource[]) {
  const { sources: enabledSources, runs } = await collectConfiguredSources({ sources });
  const { listings, duplicates } = mergeCollectedRuns(runs);
  const aiEnabled = process.env.COLLECTOR_USE_AI === 'true';
  const aiErrors: string[] = [];

  if (aiEnabled) {
    for (const listing of listings.slice(0, 20)) {
      try {
        Object.assign(listing, { aiAnalysis: await analyzeWithOllama(`${listing.title}\n${listing.summary}`) });
      } catch (error) {
        aiErrors.push(error instanceof Error ? error.message : 'Ollama không phản hồi.');
        break;
      }
    }
  }

  let persistence: {
    status: 'skipped' | 'saved' | 'partial' | 'file_cache_error';
    saved?: number;
    databaseSaved?: number;
    reason?: string;
    storage?: string;
  } = { status: 'skipped', reason: 'Không có dữ liệu để lưu' };

  if (listings.length > 0) {
    try {
      const saved = writeScrapedListings(listings);
      const databaseSaved = hasDatabaseConfig() ? await saveListings(listings) : 0;
      persistence = {
        status: databaseSaved === listings.length || !hasDatabaseConfig() ? 'saved' : 'partial',
        saved,
        databaseSaved,
        storage: 'data/cached-listings.json'
      };
    } catch (error) {
      persistence = {
        status: 'file_cache_error',
        reason: error instanceof Error ? error.message : 'Không thể lưu dữ liệu collector.'
      };
    }
  }

  const errorCount = runs.filter((run) => run.status === 'error').length;
  const runRecord = {
    ranAt: new Date().toISOString(),
    status: errorCount > 0 || persistence.status === 'partial' || persistence.status === 'file_cache_error' ? 'partial' : 'completed',
    configured: enabledSources.length,
    collected: listings.length,
    duplicates,
    errors: errorCount
  };
  recordCollectorRun(runRecord);
  if (hasCollectorDatabase()) {
    try { await recordCollectorRunDb(runRecord); } catch (error) { console.warn('Could not persist collector run in MySQL.', error); }
  }

  return {
    enabledSources,
    runs,
    listings,
    duplicates,
    persistence,
    ai: { enabled: aiEnabled, analyzed: listings.filter((listing) => 'aiAnalysis' in listing).length, errors: aiErrors }
  };
}
