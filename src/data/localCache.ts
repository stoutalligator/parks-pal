import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Trip, UserProfile, ParkStatus, TrailCompletionRow, AnimalSightingRow, PlantSightingRow } from '@/types';

// A last-known copy of the signed-in user's data, so the app can open with
// no connection and show real content instead of an empty profile. It's a
// read cache only — the source of truth is always Supabase, and a successful
// network load replaces whatever is cached. Scoped per user so accounts on
// the same device never see each other's data.

const CACHE_VERSION = 1;

function cacheKey(userId: string): string {
  return `parkpal.cache.${userId}`;
}

export interface ParkStatusSnapshot {
  parkId: string;
  status: ParkStatus;
  isFavorite: boolean;
}

export interface UserSnapshot {
  version: number;
  profile?: UserProfile;
  parkStatus?: ParkStatusSnapshot[];
  earnedDates?: Record<string, string>;
  trips?: Trip[];
  trailCompletions?: TrailCompletionRow[];
  animalSightings?: AnimalSightingRow[];
  plantSightings?: PlantSightingRow[];
}

export type SnapshotPatch = Partial<Omit<UserSnapshot, 'version'>>;

export async function loadSnapshot(userId: string): Promise<UserSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserSnapshot;
    return parsed.version === CACHE_VERSION ? parsed : null;
  } catch {
    return null;
  }
}

// Writes are chained so two quick saves can't interleave their read-modify-
// write and drop each other's sections.
let writeChain: Promise<void> = Promise.resolve();

export function saveSnapshot(userId: string, patch: SnapshotPatch): Promise<void> {
  writeChain = writeChain.then(async () => {
    try {
      const existing = (await loadSnapshot(userId)) ?? { version: CACHE_VERSION };
      await AsyncStorage.setItem(
        cacheKey(userId),
        JSON.stringify({ ...existing, ...patch, version: CACHE_VERSION })
      );
    } catch (error) {
      console.error('Failed to save local cache:', error);
    }
  });
  return writeChain;
}

// Personal data (trips, notes) shouldn't outlive the session on a shared
// device. Queued-but-unsynced trips are deliberately NOT cleared here — they
// live in their own store and must survive until they sync.
export function clearSnapshot(userId: string): Promise<void> {
  writeChain = writeChain.then(async () => {
    try {
      await AsyncStorage.removeItem(cacheKey(userId));
    } catch (error) {
      console.error('Failed to clear local cache:', error);
    }
  });
  return writeChain;
}
