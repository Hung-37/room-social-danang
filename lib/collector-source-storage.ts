import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { publicSources } from '@/lib/collector/parser.js';
import {
  hasCollectorDatabase,
  listCollectorSourceSettings,
  saveCollectorSourceSetting
} from '@/lib/collector-db';

const SETTINGS_FILE = join(process.cwd(), 'data', 'collector-source-settings.json');
type SourceSettings = Record<string, { enabled?: boolean }>;

function readSettings(): SourceSettings {
  if (!existsSync(SETTINGS_FILE)) return {};
  try {
    const value = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as SourceSettings)
      : {};
  } catch {
    return {};
  }
}

function writeSettings(settings: SourceSettings) {
  mkdirSync(dirname(SETTINGS_FILE), { recursive: true });
  const temp = `${SETTINGS_FILE}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  renameSync(temp, SETTINGS_FILE);
}

export function getManagedSources() {
  const settings = readSettings();
  const allowDemo =
    process.env.NODE_ENV !== 'production' || process.env.COLLECTOR_INCLUDE_DEMO === 'true';
  return publicSources.map((source) => ({
    ...source,
    enabled:
      source.id === 'data-template' && !allowDemo
        ? false
        : (settings[source.id]?.enabled ?? source.enabled)
  }));
}

export async function getManagedSourcesAsync() {
  const fallback = getManagedSources();
  if (!hasCollectorDatabase()) return fallback;
  try {
    const settings = await listCollectorSourceSettings();
    const byId = new Map(settings.map((setting) => [setting.sourceId, setting]));
    const extra = settings
      .filter((s) => !fallback.some((f) => f.id === s.sourceId))
      .flatMap((s) =>
        s.config && typeof s.config === 'object' ? [s.config as (typeof fallback)[number]] : []
      );
    return [...fallback, ...extra].map((source) => {
      const saved = byId.get(source.id);
      const config =
        saved?.config && typeof saved.config === 'object'
          ? (saved.config as Partial<typeof source>)
          : {};
      const enabled = saved?.enabled ?? source.enabled;
      return {
        ...source,
        ...config,
        id: source.id,
        enabled:
          source.id === 'data-template' &&
          process.env.NODE_ENV === 'production' &&
          process.env.COLLECTOR_INCLUDE_DEMO !== 'true'
            ? false
            : enabled
      };
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Không tải được cấu hình nguồn từ MySQL.', { cause: error });
    }
    return fallback;
  }
}

export function setSourceEnabled(sourceId: string, enabled: boolean) {
  const source = publicSources.find((item) => item.id === sourceId);
  if (!source) return false;
  const settings = readSettings();
  settings[sourceId] = { ...settings[sourceId], enabled };
  writeSettings(settings);
  return true;
}

export async function setSourceEnabledAsync(
  sourceId: string,
  enabled: boolean,
  updatedBy?: string
) {
  const source = (await getManagedSourcesAsync()).find((item) => item.id === sourceId);
  if (!source) return false;
  if (hasCollectorDatabase()) {
    try {
      await saveCollectorSourceSetting(source, enabled, updatedBy);
      return true;
    } catch (error) {
      throw new Error('Không lưu được cấu hình nguồn vào MySQL. Vui lòng thử lại.', {
        cause: error
      });
    }
  }
  return setSourceEnabled(sourceId, enabled);
}
