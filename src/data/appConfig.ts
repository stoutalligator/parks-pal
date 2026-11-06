import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { EventNotice, EventNoticeKind } from '@/types';

// Remote switches read from the Supabase `app_config` table, so things like a
// newly designated park can be turned on for everyone without an app update.
// Each switch falls back to the last value this device saw, then to off.

const ENABLED_UPCOMING_PARKS_KEY = 'enabled_upcoming_parks';
const CACHE_KEY = 'parkpal.appConfig.enabledUpcomingParks';
const EVENT_NOTICE_KEY = 'event_notice';
const EVENT_NOTICE_CACHE_KEY = 'parkpal.appConfig.eventNotice';
const DISMISSED_NOTICES_KEY = 'parkpal.dismissedNotices';

const NOTICE_KINDS: EventNoticeKind[] = ['park', 'event', 'info'];

function parseIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

const optionalString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

// The row is hand-edited in the Supabase dashboard, so anything malformed is
// treated as "no notice" rather than trusted.
function parseNotice(value: unknown): EventNotice | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const kind = NOTICE_KINDS.find((k) => k === v.kind);
  if (typeof v.id !== 'string' || !v.id || typeof v.title !== 'string' || !v.title || !kind) return null;
  return {
    id: v.id,
    kind,
    eyebrow: optionalString(v.eyebrow) ?? '',
    title: v.title,
    body: optionalString(v.body),
    parkId: optionalString(v.parkId),
    linkLabel: optionalString(v.linkLabel),
    startsAt: optionalString(v.startsAt),
    endsAt: optionalString(v.endsAt),
  };
}

async function fetchConfigValue(key: string): Promise<{ value: unknown } | null> {
  const { data, error } = await supabase.from('app_config').select('value').eq('key', key).maybeSingle();
  if (error) return null;
  return { value: data?.value ?? null };
}

async function cacheJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache is best-effort; the fetched value is still used this session.
  }
}

async function readCachedJson(key: string): Promise<unknown> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function loadCachedEnabledUpcomingParks(): Promise<string[]> {
  return parseIds(await readCachedJson(CACHE_KEY));
}

// Returns null when the switch couldn't be read (offline, table missing), so
// the caller keeps whatever value it already has.
export async function fetchEnabledUpcomingParks(): Promise<string[] | null> {
  const result = await fetchConfigValue(ENABLED_UPCOMING_PARKS_KEY);
  if (!result) return null;
  const ids = parseIds(result.value);
  await cacheJson(CACHE_KEY, ids);
  return ids;
}

export async function loadCachedEventNotice(): Promise<EventNotice | null> {
  return parseNotice(await readCachedJson(EVENT_NOTICE_CACHE_KEY));
}

// Resolves to undefined when the switch couldn't be read, and null when there
// is deliberately no notice (row missing or emptied).
export async function fetchEventNotice(): Promise<EventNotice | null | undefined> {
  const result = await fetchConfigValue(EVENT_NOTICE_KEY);
  if (!result) return undefined;
  const notice = parseNotice(result.value);
  await cacheJson(EVENT_NOTICE_CACHE_KEY, notice);
  return notice;
}

export async function loadDismissedNotices(): Promise<string[]> {
  return parseIds(await readCachedJson(DISMISSED_NOTICES_KEY));
}

export function saveDismissedNotices(ids: string[]) {
  return cacheJson(DISMISSED_NOTICES_KEY, ids);
}
