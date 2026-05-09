import { readJson, writeJson } from './fs.js';

export interface RegistryEnvelope<T> {
  schemaVersion: string
  updatedAt: string
  items: T[]
}

const REGISTRY_SCHEMA_VERSION = '2.0';

export function createRegistryEnvelope<T>(
  items: T[],
  updatedAt: string = new Date().toISOString(),
): RegistryEnvelope<T> {
  return {
    schemaVersion: REGISTRY_SCHEMA_VERSION,
    updatedAt,
    items,
  };
}

export function parseRegistryEnvelope<T>(raw: unknown): RegistryEnvelope<T> {
  if (Array.isArray(raw)) {
    return createRegistryEnvelope(raw);
  }

  if (raw && typeof raw === 'object') {
    const candidate = raw as Partial<RegistryEnvelope<T>>;
    if (Array.isArray(candidate.items)) {
      return {
        schemaVersion: candidate.schemaVersion || REGISTRY_SCHEMA_VERSION,
        updatedAt: candidate.updatedAt || new Date().toISOString(),
        items: candidate.items,
      };
    }
  }

  return createRegistryEnvelope([]);
}

export function readRegistryEnvelope<T>(path: string): RegistryEnvelope<T> {
  return parseRegistryEnvelope<T>(readJson<unknown>(path));
}

export function writeRegistryEnvelope<T>(path: string, items: T[]): void {
  writeJson(path, createRegistryEnvelope(items));
}

export function parseConflictRegistryItems<T>(raw: string): T[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === '{}') return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed as T[];
    if (parsed && typeof parsed === 'object') {
      const candidate = parsed as Partial<RegistryEnvelope<T>>;
      if (Array.isArray(candidate.items)) return candidate.items;
      return Object.keys(parsed as object).length === 0 ? [] : [parsed as T];
    }
  } catch {
    // Fall through to fragment parsing below.
  }

  try {
    const parsed = JSON.parse(`[${trimmed}]`) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (item && typeof item === 'object' && Array.isArray((item as Partial<RegistryEnvelope<T>>).items)) {
        return (item as Partial<RegistryEnvelope<T>>).items as T[];
      }
      return item ? [item as T] : [];
    });
  } catch {
    return [];
  }
}
