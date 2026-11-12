import { collectConfiguredSources, mergeCollectedRuns } from '@/lib/collector/service.js';
import { processListings } from './listing-pipeline';
import { getSiteSettings } from './site-settings';
import type { CollectorSource } from '@/lib/collector/parser.js';
export async function runCollectorPipeline(sources: CollectorSource[]) {
  const { settings } = await getSiteSettings();
  if (!settings.collectorEnabled)
    throw new Error('Thu thập tự động đang tắt trong cấu hình Admin.');
  const { sources: enabledSources, runs } = await collectConfiguredSources({ sources });
  const merged = mergeCollectedRuns(runs);
  const result = await processListings(merged.listings, {
    configured: enabledSources.length,
    sourceErrors: runs.filter((r) => r.status === 'error').length,
    duplicates: merged.duplicates
  });
  return { ...result, enabledSources, runs };
}
