import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import type { Session } from '@supabase/supabase-js';
import { EventNotice, ParkAlert, Park, Trip, TripType, TripTrailEntry, TripDayEntry, WeatherType, Badge, UserStats, UserProfile, ParkStatus, TripActivity, ProfileBackground, ProfileAvatar, Units, Trail, Animal, TrailDetail, AnimalDetail, ContentReportInput, TrailCompletionRow, AnimalSightingRow } from '@/types';
import { ALL_PARKS, UPCOMING_PARKS, visibleParks } from '@/data/parks';
import { ALL_BADGES } from '@/data/badges';
import { BADGE_PROGRESS } from '@/data/badgeRules';
import { ALL_TRAILS } from '@/data/trails';
import { ALL_ANIMALS } from '@/data/animals';
import { TRAIL_DETAILS } from '@/data/trailDetails';
import { ANIMAL_DETAILS } from '@/data/animalDetails';
import { fetchContentBundle } from '@/data/contentService';
import {
  loadCachedEnabledUpcomingParks,
  fetchEnabledUpcomingParks,
  loadCachedEventNotice,
  fetchEventNotice,
  loadDismissedNotices,
  saveDismissedNotices,
} from '@/data/appConfig';
import { loadCachedAlerts, fetchAlerts } from '@/data/npsAlerts';
import { loadPendingTrips, savePendingTrips } from '@/data/offlineTrips';
import { loadSnapshot, saveSnapshot, clearSnapshot, ParkStatusSnapshot, SnapshotPatch } from '@/data/localCache';
import { loadOutbox, saveOutbox, clearOutbox } from '@/data/outbox';
import {
  OutboxOp,
  NewOutboxOp,
  MAX_ATTEMPTS,
  enqueueOp,
  isNetworkError,
  overlayTrips,
  overlayParkStatus,
  overlayTrailCompletions,
  overlayProfile,
  describeOp,
  DescribeLookup,
  PendingChange,
} from '@/data/outboxCore';
import { addDays, todayDateString } from '@/utils/dates';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import { celebrateBadges } from '@/components/BadgeEarnedModal';
import { celebrateVisit } from '@/components/VisitStamp';
import { captureException } from '@/lib/sentry';
import { navigationRef } from '@/navigation/navigationRef';

// Logs the failure and surfaces a toast so a failed save is never silent —
// `action` should read naturally after "Couldn't ", e.g. "save your trip".
function reportError(action: string, error: unknown) {
  console.error(`Failed to ${action}:`, error);
  captureException(error, { action });
  showToast(`Couldn't ${action}. Please try again.`, 'error');
}

const GUEST_MODE_KEY = 'parkpal.guestMode';

// What a guest tapped before being asked to sign up, redone once they have —
// so a heart tapped as a guest isn't lost to the sign-up detour.
export type GuestAction =
  | { type: 'favorite'; parkId: string }
  | { type: 'status'; parkId: string; status: ParkStatus }
  | { type: 'trail'; trailId: string; parkId: string; name: string }
  | { type: 'tripForm'; parkId?: string; tripType: TripType }
  | { type: 'tab'; tab: 'LogTrip' | 'TripsTab' | 'ProfileTab' };

// Shown when a guest (browsing without an account) tries something that saves
// to their account — browsing parks, trails, and animals never needs one.
function promptForAccount() {
  const title = 'Create a free account';
  const message = 'Sign up to track the parks you visit, log trips, and earn badges.';
  const openAuth = () => {
    if (navigationRef.isReady()) navigationRef.navigate('Auth', { mode: 'Sign Up' });
  };
  // Alert.alert is a no-op on react-native-web.
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) openAuth();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Not Now', style: 'cancel' },
    { text: 'Log In / Sign Up', onPress: openAuth },
  ]);
}

// AuthScreen stashes the explorer style/goal/name picked during sign-up
// here when email confirmation delays the session (and therefore delays
// completeOnboarding) — see the effect below that applies it once a session
// for a not-yet-onboarded account actually shows up.
export const PENDING_ONBOARDING_KEY = 'parkpal.pendingOnboarding';

const DEFAULT_PROFILE: UserProfile = {
  name: 'Explorer',
  onboardingComplete: false,
  profileBackground: 'mountain-lake',
  avatar: 'hiking',
  units: 'mi',
};

type SyncSource = 'none' | 'cache' | 'network';
type SyncSection = 'profile' | 'parks' | 'badges' | 'trips';

const UNSYNCED: Record<SyncSection, SyncSource> = { profile: 'none', parks: 'none', badges: 'none', trips: 'none' };

// NetInfo can report "connected" when there's no real internet (a captive
// portal), so this is only used to skip a network wait that is certain to
// fail — never to decide that a save succeeded.
async function isKnownOffline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === false;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// How long a save waits on the network before it's treated as "queued and
// syncing in the background" — on weak park signal a save shouldn't hold the
// screen hostage.
const FLUSH_WAIT_MS = 8000;
// How long the initial load waits for queued changes to go out before it
// fetches fresh data anyway.
const LOAD_GATE_MS = 4000;
// How often a non-empty queue retries on its own.
const RETRY_INTERVAL_MS = 30000;

// A short, readable reason for the "waiting to sync" list.
function errorText(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  const text = typeof message === 'string' && message ? message : String(error);
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

const PROFILE_COLUMNS: Record<keyof UserProfile, string> = {
  name: 'name',
  explorerStyle: 'explorer_style',
  goal: 'goal',
  onboardingComplete: 'onboarding_complete',
  profileBackground: 'profile_background',
  avatar: 'avatar',
  units: 'units',
};

function profilePatchToColumns(patch: Partial<UserProfile>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [PROFILE_COLUMNS[key as keyof UserProfile], value])
  );
}

// Every park the app knows about, including upcoming ones that may still be
// switched off — statuses are tracked for all of them, and `parks` (below)
// exposes only the visible subset.
const PARK_ENTRIES: Park[] = [...ALL_PARKS, ...UPCOMING_PARKS];

function parksFromStatus(rows: ParkStatusSnapshot[]): Park[] {
  const byId = new Map(rows.map((row) => [row.parkId, row]));
  return PARK_ENTRIES.map((park) => {
    const row = byId.get(park.id);
    return { ...park, status: row?.status ?? 'notVisited', isFavorite: row?.isFavorite ?? false };
  });
}

// Merges the on-device queue of unsynced trips into an already-loaded list
// without disturbing the synced ones — used when a network refresh fails and
// the last-known trips should stay on screen.
function mergePendingTrips(current: Trip[], pending: Trip[]): Trip[] {
  const pendingIds = new Set(pending.map((t) => t.id));
  return [...pending, ...current.filter((t) => !pendingIds.has(t.id))].sort((a, b) =>
    b.startDate.localeCompare(a.startDate)
  );
}

interface DayActivityRow {
  trip_id: string;
  day_number: number;
  activity: string;
  viewpoint: string | null;
}

interface DayWeatherRow {
  trip_id: string;
  day_number: number;
  weather: string;
}

const TRIP_PHOTOS_BUCKET = 'trip-photos';
// Must match the bucket's file_size_limit (supabase/schema.sql).
const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
// The bucket is private (not `public: true`) — trip photos are personal, so
// they're served through short-lived signed URLs the owning user generates
// on demand, not a permanent public link anyone with it could view forever.
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 1 week — regenerated fresh every time trips load, so this only bounds how long a single session's URLs stay valid.

function storagePathFromSignedUrl(url: string): string | null {
  const marker = `/storage/v1/object/sign/${TRIP_PHOTOS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const rest = url.slice(index + marker.length);
  const queryIndex = rest.indexOf('?');
  return queryIndex === -1 ? rest : rest.slice(0, queryIndex);
}

async function signedUrlFromStoragePath(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(TRIP_PHOTOS_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}

// Batched form of the above — one request for every path instead of one
// round trip per photo, used when loading a whole trip list at once.
async function signedUrlsFromStoragePaths(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(TRIP_PHOTOS_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  data.forEach((row) => {
    if (row.signedUrl && !row.error && row.path) map[row.path] = row.signedUrl;
  });
  return map;
}

// Reconciles a trip's desired photo list (a mix of already-uploaded signed
// URLs and freshly-picked local file URIs, capped at 3 by the schema) against
// what's stored. Local URIs get uploaded; signed URLs are re-linked without
// re-uploading; anything dropped from the list is deleted from Storage too.
// `captions` is index-aligned with `photos`; the result keeps each caption
// attached to its own photo, even if one photo's link can't be produced.
async function syncTripPhotos(
  tripId: string,
  userId: string,
  photos: string[],
  captions: string[] = []
): Promise<{ photos: string[]; photoCaptions: string[] }> {
  const { data: existingRows } = await supabase
    .from('trip_photos')
    .select('storage_path')
    .eq('trip_id', tripId);

  const keptPaths = new Set<string>();
  const finalPaths: string[] = [];
  const finalCaptions: string[] = [];
  let skippedPhotos = 0;
  let oversizedPhotos = 0;
  for (const [index, photo] of photos.slice(0, 3).entries()) {
    const caption = (captions[index] ?? '').trim();
    const existingPath = storagePathFromSignedUrl(photo);
    if (existingPath) {
      finalPaths.push(existingPath);
      finalCaptions.push(caption);
      keptPaths.add(existingPath);
      continue;
    }
    const path = `${userId}/${tripId}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    // Reading a picked photo is purely local, so a failure here is never "no
    // signal" — the file is gone (on web a picked photo's link dies when the
    // page reloads; on a phone the OS can clear its cache). Skip it rather
    // than letting one dead photo hold the whole trip's sync hostage.
    let arrayBuffer: ArrayBuffer;
    try {
      const response = await fetch(photo);
      arrayBuffer = await response.arrayBuffer();
    } catch (error) {
      console.warn('Skipping a photo that is no longer readable:', error);
      skippedPhotos += 1;
      continue;
    }
    // The bucket would reject it anyway; skipping here keeps one huge photo
    // from failing (and endlessly retrying) the whole trip's sync.
    if (arrayBuffer.byteLength > MAX_PHOTO_BYTES) {
      oversizedPhotos += 1;
      continue;
    }
    const { error: uploadError } = await supabase.storage
      .from(TRIP_PHOTOS_BUCKET)
      .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;
    finalPaths.push(path);
    finalCaptions.push(caption);
  }

  if (oversizedPhotos > 0) {
    showToast(
      `${oversizedPhotos === 1 ? 'A photo was' : `${oversizedPhotos} photos were`} too large to upload (20 MB max) — try a smaller version.`,
      'error'
    );
  }

  if (skippedPhotos > 0) {
    showToast(
      `${skippedPhotos === 1 ? 'A photo' : `${skippedPhotos} photos`} couldn't be uploaded — the file is no longer available on this device.`,
      'error'
    );
  }

  const orphanedPaths = (existingRows ?? [])
    .map((row) => row.storage_path)
    .filter((path) => !keptPaths.has(path));
  if (orphanedPaths.length) {
    const { error: removeError } = await supabase.storage.from(TRIP_PHOTOS_BUCKET).remove(orphanedPaths);
    if (removeError) throw removeError;
  }

  const { error: deleteError } = await supabase.from('trip_photos').delete().eq('trip_id', tripId);
  if (deleteError) throw deleteError;
  if (finalPaths.length) {
    const { error: insertError } = await supabase
      .from('trip_photos')
      .insert(
        finalPaths.map((storage_path, slot) => ({
          trip_id: tripId,
          storage_path,
          slot,
          caption: finalCaptions[slot] || null,
        }))
      );
    if (insertError) throw insertError;
  }

  const urlMap = await signedUrlsFromStoragePaths(finalPaths);
  const shown = finalPaths.map((path, i) => ({ url: urlMap[path], caption: finalCaptions[i] })).filter((p) => !!p.url);
  return { photos: shown.map((p) => p.url), photoCaptions: shown.map((p) => p.caption) };
}

// Shared row-building for user_trail_completions / user_animal_sightings /
// trip_day_activities / trip_day_weather inserts — used by both logTrip and
// completeTrip so the two stay in sync. Each takes the trip's full per-day
// breakdown and flattens it, tagging every row with the day it belongs to.
function buildTrailRows(days: TripDayEntry[], tripId: string, parkId: string): TrailCompletionRow[] {
  return days.flatMap((day) =>
    day.trailsHiked.map((t) => ({
      trail_id: t.trailId ?? null,
      trip_id: tripId,
      park_id: parkId,
      name: t.name,
      miles: t.miles,
      elevation_gain_ft: t.elevationGainFt,
      day_number: day.dayNumber,
    }))
  );
}

function buildAnimalRows(days: TripDayEntry[], tripId: string, parkId: string, animals: Animal[]): AnimalSightingRow[] {
  const parkAnimals = animals.filter((a) => a.parkId === parkId);
  return days.flatMap((day) =>
    day.wildlifeSightings.map((name) => ({
      animal_id: parkAnimals.find((a) => a.name.toLowerCase() === name.toLowerCase())?.id ?? null,
      trip_id: tripId,
      park_id: parkId,
      name,
      day_number: day.dayNumber,
    }))
  );
}

function buildDayActivityRows(days: TripDayEntry[], tripId: string): DayActivityRow[] {
  return days.flatMap((day) =>
    day.activities.map((a) => ({
      trip_id: tripId,
      day_number: day.dayNumber,
      activity: a.activity,
      viewpoint: a.viewpoint?.trim() || null,
    }))
  );
}

function buildDayWeatherRows(days: TripDayEntry[], tripId: string): DayWeatherRow[] {
  return days
    .filter((day) => day.weather)
    .map((day) => ({
      trip_id: tripId,
      day_number: day.dayNumber,
      weather: day.weather as string,
    }));
}

// The flat `activities`/`wildlifeSightings`/`trailsHiked`/miles/elevation
// fields on Trip stay populated as aggregates across all days — this is
// what keeps badgeRules.ts and stats working unchanged even though the
// source of truth for a trip saved through the day-by-day flow is `days`.
function aggregateFromDays(days: TripDayEntry[]) {
  const activities = Array.from(new Set(days.flatMap((d) => d.activities.map((a) => a.activity))));
  const wildlifeSightings = days.flatMap((d) => d.wildlifeSightings);
  const trailsHiked = days.flatMap((d) => d.trailsHiked);
  const milesHiked = trailsHiked.reduce((acc, t) => acc + t.miles, 0);
  const elevationGainFt = trailsHiked.reduce((acc, t) => acc + t.elevationGainFt, 0);
  return { activities, wildlifeSightings, trailsHiked, milesHiked, elevationGainFt };
}

interface AppContextValue {
  parks: Park[];
  /** Live NPS alerts (verbatim NPS content) and when they were last synced. */
  parkAlerts: ParkAlert[];
  alertsSyncedAt: string | null;
  /** The remote Home-screen notice, if one is live and not dismissed on this device. */
  eventNotice: EventNotice | null;
  /** The live notice whether or not it's dismissed, so it can be shown again. */
  liveEventNotice: EventNotice | null;
  setEventNoticeHidden: (id: string, hidden: boolean) => void;
  trips: Trip[];
  badges: Badge[];
  userProfile: UserProfile;
  stats: UserStats;
  session: Session | null;
  /** Browsing without an account — read-only until they sign up or log in. */
  isGuest: boolean;
  authLoading: boolean;
  dataLoading: boolean;
  trails: Trail[];
  animals: Animal[];
  trailDetails: Record<string, TrailDetail>;
  animalDetails: Record<string, AnimalDetail>;
  contentLoaded: boolean;

  updateParkStatus: (parkId: string, status: ParkStatus) => void;
  toggleFavorite: (parkId: string) => void;
  logTrip: (trip: Omit<Trip, 'id'>) => Promise<void>;
  updateTrip: (trip: Trip) => Promise<boolean>;
  completeTrip: (trip: Trip) => Promise<boolean>;
  deleteTrip: (tripId: string) => void;
  completeOnboarding: (profile: Partial<UserProfile>) => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
  updateProfileBackground: (background: ProfileBackground) => void;
  updateProfileAvatar: (avatar: ProfileAvatar) => void;
  updateUnits: (units: Units) => void;
  continueAsGuest: () => void;
  /**
   * True when signed in; otherwise prompts the guest to sign up and returns
   * false. `action` is redone automatically if they sign up from that prompt.
   */
  requireAccount: (action?: GuestAction) => boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  isTrailCompleted: (trailId: string) => boolean;
  isAnimalSpotted: (animalId: string) => boolean;
  markTrailCompleted: (trailId: string, parkId: string, name: string) => void;
  unmarkTrailCompleted: (trailId: string) => void;
  isTripPending: (tripId: string) => boolean;
  submitContentReport: (report: ContentReportInput) => Promise<boolean>;
  // Changes saved on this device that haven't reached the server yet.
  pendingChangeCount: number;
  pendingChanges: PendingChange[];
  isOffline: boolean;
  retrySync: () => Promise<void>;
  /** Pull-to-refresh: sync queued changes, then reload the user's data in place. */
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [parkStates, setParks] = useState<Park[]>(PARK_ENTRIES);
  const [enabledUpcomingParks, setEnabledUpcomingParks] = useState<string[]>([]);
  const parks = useMemo(() => {
    const visibleIds = new Set(visibleParks(enabledUpcomingParks).map((p) => p.id));
    return parkStates.filter((p) => visibleIds.has(p.id));
  }, [parkStates, enabledUpcomingParks]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [earnedDates, setEarnedDates] = useState<Record<string, string>>({});
  const earnedIdsRef = useRef<Set<string>>(new Set());
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [session, setSession] = useState<Session | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const isGuest = guestMode && !session;
  const [authLoading, setAuthLoading] = useState(true);
  const [trailCompletions, setTrailCompletions] = useState<TrailCompletionRow[]>([]);
  const [animalSightings, setAnimalSightings] = useState<AnimalSightingRow[]>([]);
  // Tracks whether the signed-in user's own parks/profile/badges/trips have
  // finished loading from Supabase, so the UI can hold a spinner instead of
  // briefly showing zeroed-out stats for a returning user with real history.
  const [parksLoaded, setParksLoaded] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [badgesLoaded, setBadgesLoaded] = useState(false);
  const [tripsLoaded, setTripsLoaded] = useState(false);
  // Pull-to-refresh re-runs the four loads below without resetting the
  // loaded flags (which would swap the app for the loading screen);
  // refreshData resolves once all four have finished.
  const [reloadKey, setReloadKey] = useState(0);
  const silentReloadRef = useRef(false);
  const refreshWaitRef = useRef<{ remaining: number; resolve: () => void } | null>(null);
  const finishRefreshStep = useCallback(() => {
    const wait = refreshWaitRef.current;
    if (!wait) return;
    wait.remaining -= 1;
    if (wait.remaining > 0) return;
    refreshWaitRef.current = null;
    silentReloadRef.current = false;
    wait.resolve();
  }, []);
  const dataLoading = !!session && !(parksLoaded && profileLoaded && badgesLoaded && tripsLoaded);

  // Where each section of the user's data last came from: 'network' (loaded
  // fresh from Supabase), 'cache' (restored from the on-device snapshot while
  // the network is slow or unreachable), or 'none' (still defaults). Refs, not
  // state — they only gate what gets hydrated/persisted and shouldn't rerender.
  const syncedRef = useRef<Record<SyncSection, SyncSource>>({ ...UNSYNCED });
  // Keyed on the user id, not the session object: Supabase hands out a fresh
  // session object on every token refresh, which isn't a change of user and
  // shouldn't reset what's been loaded or re-restore an older cached copy.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    syncedRef.current = { ...UNSYNCED };
    pendingFailuresRef.current.clear();
    setSyncIssues({});
  }, [userId]);

  // Trips created while offline (or while a Supabase write failed) — the
  // full trip objects, mirrored to AsyncStorage, so this is the single
  // source of truth for "still needs to sync" rather than a separate id set
  // that could drift out of sync with the persisted queue.
  const [pendingTrips, setPendingTrips] = useState<Trip[]>([]);
  const pendingTripsRef = useRef<Trip[]>([]);
  pendingTripsRef.current = pendingTrips;
  const syncInFlightRef = useRef(false);

  // Every other change made while offline (edits/deletes of synced trips,
  // trail marks, bucket list, profile, badges, reports) — see outboxCore.ts.
  // The ref is the source of truth for the async flush loop; the state copy
  // only exists to re-render the pending indicators.
  const [outboxOps, setOutboxOps] = useState<OutboxOp[]>([]);
  const outboxRef = useRef<OutboxOp[]>([]);
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const flushingRef = useRef<Promise<void> | null>(null);
  const needsAnotherPassRef = useRef(false);
  // Set once something was queued while offline or a flush hit the network
  // failing, so the eventual "all synced" toast only appears after a real
  // offline stretch — not after every ordinary online save.
  const queuedOfflineRef = useRef(false);
  const [isOffline, setIsOffline] = useState(false);
  const isOfflineRef = useRef(false);
  const flushOutboxRef = useRef<() => Promise<void>>(async () => {});
  // Why a queued new trip hasn't synced (its own queue has no per-item
  // metadata, unlike the outbox). The ref drives retry decisions; the state
  // mirrors just the messages so the pending list can show them.
  const pendingFailuresRef = useRef<Map<string, { attempts: number; message: string }>>(new Map());
  const [syncIssues, setSyncIssues] = useState<Record<string, string>>({});
  const recordTripIssue = useCallback((tripId: string, failure: { attempts: number; message: string } | null) => {
    if (failure) pendingFailuresRef.current.set(tripId, failure);
    else pendingFailuresRef.current.delete(tripId);
    setSyncIssues((prev) => {
      const next = { ...prev };
      if (failure) next[tripId] = failure.message;
      else delete next[tripId];
      return next;
    });
  }, []);
  const loadGateRef = useRef<Promise<void>>(Promise.resolve());

  // Guest mode ends once they sign in, so signing out later returns to Welcome.
  useEffect(() => {
    if (!session) return;
    setGuestMode(false);
    AsyncStorage.removeItem(GUEST_MODE_KEY).catch(() => {});
  }, [session]);

  const continueAsGuest = useCallback(() => {
    setGuestMode(true);
    AsyncStorage.setItem(GUEST_MODE_KEY, 'true').catch(() => {});
  }, []);

  const pendingGuestActionRef = useRef<GuestAction | null>(null);

  const requireAccount = useCallback((action?: GuestAction) => {
    if (sessionRef.current) return true;
    pendingGuestActionRef.current = action ?? null;
    promptForAccount();
    return false;
  }, []);

  const isTripPending = useCallback(
    (tripId: string) =>
      pendingTrips.some((t) => t.id === tripId) ||
      outboxOps.some((o) => o.type === 'trip.edit' && o.trip.id === tripId),
    [pendingTrips, outboxOps]
  );

  const commitOutbox = useCallback((next: OutboxOp[]) => {
    outboxRef.current = next;
    setOutboxOps(next);
    const uid = sessionRef.current?.user.id;
    if (uid) saveOutbox(uid, next);
  }, []);

  const queueOp = useCallback(
    (op: NewOutboxOp) => {
      if (!sessionRef.current) return; // logged-out/local-only usage — nothing to sync
      if (isOfflineRef.current) queuedOfflineRef.current = true;
      commitOutbox(
        enqueueOp(outboxRef.current, op, { id: Crypto.randomUUID(), createdAt: new Date().toISOString() })
      );
    },
    [commitOutbox]
  );

  // Kicks a flush off in the background — the local state has already been
  // updated optimistically, so nothing waits on the result.
  const flushInBackground = useCallback(() => {
    flushOutboxRef.current().catch((error) => console.error('Outbox flush failed:', error));
  }, []);

  // Trip-list edits that still need to reach the server, applied in place so
  // an edit to a not-yet-synced new trip just rewrites its queued copy.
  const commitPendingTrips = useCallback((updater: (prev: Trip[]) => Trip[]) => {
    const next = updater(pendingTripsRef.current);
    pendingTripsRef.current = next;
    setPendingTrips(next);
    const uid = sessionRef.current?.user.id;
    if (uid) savePendingTrips(uid, next);
  }, []);

  // Announces the end of an offline stretch once everything has gone out.
  const announceIfSynced = useCallback(() => {
    if (queuedOfflineRef.current && outboxRef.current.length === 0 && pendingTripsRef.current.length === 0) {
      queuedOfflineRef.current = false;
      showToast('Back online. Your changes are synced.', 'success');
    }
  }, []);

  // Load gate: before fetching fresh data, give any queued changes a short
  // chance to go out, so the fetch doesn't briefly show them as undone. It's
  // bounded — being offline mustn't hold up loading.
  useEffect(() => {
    if (!userId) {
      outboxRef.current = [];
      setOutboxOps([]);
      loadGateRef.current = Promise.resolve();
      return;
    }
    loadGateRef.current = (async () => {
      const stored = await loadOutbox(userId);
      outboxRef.current = stored;
      setOutboxOps(stored);
      if (stored.length) await Promise.race([flushOutboxRef.current(), sleep(LOAD_GATE_MS)]);
    })().catch((error) => console.error('Failed to load the offline outbox:', error));
  }, [userId]);

  // Trail/animal reference content — public, not per-user, so this loads
  // once on mount independent of session/auth, unlike the data above.
  const [trails, setTrails] = useState<Trail[]>(ALL_TRAILS);
  const [animals, setAnimals] = useState<Animal[]>(ALL_ANIMALS);
  const [trailDetails, setTrailDetails] = useState<Record<string, TrailDetail>>(TRAIL_DETAILS);
  const [animalDetails, setAnimalDetails] = useState<Record<string, AnimalDetail>>(ANIMAL_DETAILS);
  const [contentLoaded, setContentLoaded] = useState(false);
  // Tracks whether the last content load fell back to the bundled static
  // data (Supabase unreachable/empty) — a ref, not state, since it only
  // gates a background retry and shouldn't itself trigger a re-render.
  const usedContentFallbackRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchContentBundle().then((bundle) => {
      if (cancelled) return;
      usedContentFallbackRef.current = bundle.trails === ALL_TRAILS;
      setTrails(bundle.trails);
      setAnimals(bundle.animals);
      setTrailDetails(bundle.trailDetails);
      setAnimalDetails(bundle.animalDetails);
      setContentLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [parkAlerts, setParkAlerts] = useState<ParkAlert[]>([]);
  const [alertsSyncedAt, setAlertsSyncedAt] = useState<string | null>(null);

  const [remoteNotice, setRemoteNotice] = useState<EventNotice | null>(null);
  const [dismissedNotices, setDismissedNotices] = useState<string[]>([]);

  const refreshAppConfig = useCallback(() => {
    fetchEnabledUpcomingParks().then((ids) => {
      if (ids) setEnabledUpcomingParks(ids);
    });
    fetchEventNotice().then((notice) => {
      if (notice !== undefined) setRemoteNotice(notice);
    });
    fetchAlerts().then((snapshot) => {
      if (!snapshot) return;
      setParkAlerts(snapshot.alerts);
      setAlertsSyncedAt(snapshot.syncedAt);
    });
  }, []);

  useEffect(() => {
    Promise.all([
      loadCachedEnabledUpcomingParks().then(setEnabledUpcomingParks),
      loadCachedEventNotice().then(setRemoteNotice),
      loadDismissedNotices().then(setDismissedNotices),
      loadCachedAlerts().then((snapshot) => {
        if (!snapshot) return;
        setParkAlerts(snapshot.alerts);
        setAlertsSyncedAt(snapshot.syncedAt);
      }),
    ]).then(refreshAppConfig);
  }, [refreshAppConfig]);

  // A notice is live inside its date window when the park it points at is
  // shown in this build; it's visible unless dismissed on this device.
  const liveEventNotice = useMemo(() => {
    if (!remoteNotice) return null;
    const today = todayDateString();
    if (remoteNotice.startsAt && today < remoteNotice.startsAt) return null;
    if (remoteNotice.endsAt && today > remoteNotice.endsAt) return null;
    if (remoteNotice.parkId && !parks.some((p) => p.id === remoteNotice.parkId)) return null;
    return remoteNotice;
  }, [remoteNotice, parks]);
  const eventNotice = liveEventNotice && !dismissedNotices.includes(liveEventNotice.id) ? liveEventNotice : null;

  const setEventNoticeHidden = useCallback((id: string, hidden: boolean) => {
    setDismissedNotices((prev) => {
      const next = hidden ? [...prev.filter((d) => d !== id), id] : prev.filter((d) => d !== id);
      saveDismissedNotices(next);
      return next;
    });
  }, []);

  const refreshContentIfFallenBack = useCallback(() => {
    if (!usedContentFallbackRef.current) return;
    fetchContentBundle().then((bundle) => {
      if (bundle.trails === ALL_TRAILS) return; // still unreachable — stay on fallback silently
      usedContentFallbackRef.current = false;
      setTrails(bundle.trails);
      setAnimals(bundle.animals);
      setTrailDetails(bundle.trailDetails);
      setAnimalDetails(bundle.animalDetails);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(GUEST_MODE_KEY)
      .then((value) => {
        if (value === 'true') setGuestMode(true);
      })
      .catch(() => {})
      .then(() => supabase.auth.getSession())
      .then(({ data }) => {
        setSession(data.session);
      })
      .catch((error) => {
        console.error('Failed to get Supabase session:', error);
      })
      .finally(() => {
        setAuthLoading(false);
      });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // These load effects are keyed on the user id (not the session object, which
  // changes on every token refresh) and wait on the load gate so queued
  // changes get a chance to go out first; whatever is still queued is then
  // re-applied over the fetched data so it never appears undone.
  useEffect(() => {
    if (!userId) {
      setUserProfile(DEFAULT_PROFILE);
      setProfileLoaded(false);
      return;
    }
    if (!silentReloadRef.current) setProfileLoaded(false);
    loadGateRef.current
      .then(() => supabase.from('profiles').select('*').eq('id', userId).single())
      .then(({ data, error }) => {
        // PGRST116 = "no profile row yet" (a brand-new account) — a real
        // answer. Any other error is the network failing, and must not wipe a
        // cached profile back to defaults (which would also bounce an
        // onboarded user into onboarding).
        if (error && error.code !== 'PGRST116') return;
        syncedRef.current.profile = 'network';
        if (error || !data) {
          setUserProfile(overlayProfile(DEFAULT_PROFILE, outboxRef.current));
          return;
        }
        setUserProfile(
          overlayProfile(
            {
              name: data.name,
              explorerStyle: data.explorer_style ?? undefined,
              goal: data.goal ?? undefined,
              onboardingComplete: data.onboarding_complete,
              profileBackground: data.profile_background,
              avatar: data.avatar,
              units: (data.units as Units) ?? 'mi',
            },
            outboxRef.current
          )
        );
      })
      .then(() => {
        setProfileLoaded(true);
        finishRefreshStep();
      });
  }, [userId, reloadKey]);

  useEffect(() => {
    if (!userId) {
      setParks(PARK_ENTRIES);
      setParksLoaded(false);
      return;
    }
    if (!silentReloadRef.current) setParksLoaded(false);
    loadGateRef.current
      .then(() => supabase.from('user_park_status').select('*').eq('user_id', userId))
      .then(({ data, error }) => {
        if (error || !data) return; // keep cached/default statuses on a failed load
        syncedRef.current.parks = 'network';
        setParks(
          parksFromStatus(
            overlayParkStatus(
              data.map((row) => ({
                parkId: row.park_id,
                status: row.status as ParkStatus,
                isFavorite: row.is_favorite ?? false,
              })),
              outboxRef.current
            )
          )
        );
      })
      .then(() => {
        setParksLoaded(true);
        finishRefreshStep();
      });
  }, [userId, reloadKey]);

  useEffect(() => {
    if (!userId) {
      setEarnedDates({});
      earnedIdsRef.current = new Set();
      setBadgesLoaded(false);
      return;
    }
    if (!silentReloadRef.current) setBadgesLoaded(false);
    loadGateRef.current
      .then(() =>
        supabase.from('user_badges').select('badge_id, earned_date').eq('user_id', userId).eq('earned', true)
      )
      .then(({ data, error }) => {
        if (error || !data) return; // keep cached badge dates on a failed load
        syncedRef.current.badges = 'network';
        const dates: Record<string, string> = {};
        data.forEach((row) => {
          if (row.earned_date) dates[row.badge_id] = row.earned_date;
        });
        // A badge earned offline that hasn't synced yet still counts as earned.
        outboxRef.current.forEach((op) => {
          if (op.type === 'badge.earn') op.badges.forEach((b) => (dates[b.badgeId] ??= b.earnedAt));
        });
        setEarnedDates(dates);
        earnedIdsRef.current = new Set(Object.keys(dates));
      })
      .then(() => {
        setBadgesLoaded(true);
        finishRefreshStep();
      });
  }, [userId, reloadKey]);

  useEffect(() => {
    if (!userId) {
      setTrailCompletions([]);
      setAnimalSightings([]);
      setTrips([]);
      setPendingTrips([]);
      setTripsLoaded(false);
      return;
    }
    if (!silentReloadRef.current) setTripsLoaded(false);
    loadGateRef.current.then(() => Promise.all([
      supabase
        .from('user_trail_completions')
        .select('trail_id, trip_id, park_id, name, miles, elevation_gain_ft, day_number')
        .eq('user_id', userId),
      supabase
        .from('user_animal_sightings')
        .select('animal_id, trip_id, park_id, name, day_number')
        .eq('user_id', userId),
      supabase
        .from('trip_day_activities')
        .select('trip_id, day_number, activity, viewpoint')
        .eq('user_id', userId),
      supabase
        .from('trip_day_weather')
        .select('trip_id, day_number, weather')
        .eq('user_id', userId),
      supabase
        .from('trips')
        .select('*')
        .eq('user_id', userId)
        .order('start_date', { ascending: false }),
      supabase
        .from('trip_photos')
        .select('trip_id, storage_path, slot, caption')
        .eq('user_id', userId),
      loadPendingTrips(userId),
    ])).then(async ([trailRes, animalRes, dayActivityRes, dayWeatherRes, tripRes, photoRes, loadedPendingTrips]) => {
      // Offline, or any one of these failing: supabase-js resolves with an
      // error rather than throwing. A half-loaded set would silently drop trips'
      // photos/days and then be cached as if it were complete, so treat it as
      // "couldn't refresh" — keep whatever is on screen (the cached copy, if
      // any) and just make sure the on-device queue is still shown.
      const refreshFailed = [trailRes, animalRes, dayActivityRes, dayWeatherRes, tripRes, photoRes].some(
        (res) => res.error
      );
      if (refreshFailed) {
        setPendingTrips(loadedPendingTrips);
        setTrips((prev) => mergePendingTrips(prev, loadedPendingTrips));
        return;
      }
      syncedRef.current.trips = 'network';
      const trailRows: TrailCompletionRow[] = trailRes.data ?? [];
      const animalRows: AnimalSightingRow[] = animalRes.data ?? [];
      const dayActivityRows: DayActivityRow[] = dayActivityRes.data ?? [];
      const dayWeatherRows: DayWeatherRow[] = dayWeatherRes.data ?? [];
      const photoRows = photoRes.data ?? [];
      setTrailCompletions(overlayTrailCompletions(trailRows, outboxRef.current));
      setAnimalSightings(animalRows);
      const fetchedTripRows = tripRes.data ?? [];
      const fetchedIds = new Set(fetchedTripRows.map((row) => row.id));
      // A pending trip whose id already came back from Supabase synced from
      // elsewhere (or a previous sync pass) between being queued and now —
      // drop it from the queue rather than showing/syncing it twice.
      const stillPending = loadedPendingTrips.filter((t) => !fetchedIds.has(t.id));
      setPendingTrips(stillPending);
      if (stillPending.length !== loadedPendingTrips.length) {
        savePendingTrips(userId, stillPending);
      }
      if (!tripRes.data) {
        setTrips(stillPending);
        return;
      }
      // One batched signed-URL request for every trip's photos, rather than
      // one Storage round trip per photo.
      const photoUrlMap = await signedUrlsFromStoragePaths(photoRows.map((p) => p.storage_path));
      const fetchedTrips: Trip[] = tripRes.data.map((row) => {
          const tripTrailRows = trailRows.filter((t) => t.trip_id === row.id);
          const tripAnimalRows = animalRows.filter((a) => a.trip_id === row.id);
          const tripDayActivityRows = dayActivityRows.filter((a) => a.trip_id === row.id);
          const tripDayWeatherRows = dayWeatherRows.filter((w) => w.trip_id === row.id);
          // Keep only photos whose link could be produced, so each caption
          // stays attached to the photo it was written for.
          const tripPhotos = photoRows
            .filter((p) => p.trip_id === row.id)
            .sort((a, b) => a.slot - b.slot)
            .filter((p) => !!photoUrlMap[p.storage_path]);
          // A trip only has `days` if it was saved through the per-day flow —
          // legacy trips (nothing tagged with a day_number) get none, so
          // TripDetailScreen falls back to the flat fields below unchanged.
          const dayNumbers = Array.from(
            new Set([
              ...tripTrailRows.map((t) => t.day_number).filter((n): n is number => n != null),
              ...tripAnimalRows.map((a) => a.day_number).filter((n): n is number => n != null),
              ...tripDayActivityRows.map((a) => a.day_number),
              ...tripDayWeatherRows.map((w) => w.day_number),
            ])
          ).sort((a, b) => a - b);
          const days: TripDayEntry[] = dayNumbers.map((dayNumber) => ({
            dayNumber,
            date: addDays(row.start_date, dayNumber - 1),
            activities: tripDayActivityRows
              .filter((a) => a.day_number === dayNumber)
              .map((a) => ({ activity: a.activity as TripActivity, viewpoint: a.viewpoint ?? undefined })),
            trailsHiked: tripTrailRows
              .filter((t) => t.day_number === dayNumber)
              .map((t) => ({
                trailId: t.trail_id ?? undefined,
                name: t.name,
                miles: t.miles,
                elevationGainFt: t.elevation_gain_ft,
                dayNumber,
              })),
            wildlifeSightings: tripAnimalRows.filter((a) => a.day_number === dayNumber).map((a) => a.name),
            weather: tripDayWeatherRows.find((w) => w.day_number === dayNumber)?.weather as WeatherType | undefined,
          }));
          return {
            id: row.id,
            parkId: row.park_id,
            tripType: (row.trip_type as TripType) ?? 'logged',
            startDate: row.start_date,
            endDate: row.end_date,
            activities: row.activities as TripActivity[],
            notes: row.notes,
            photos: tripPhotos.map((p) => photoUrlMap[p.storage_path]),
            photoCaptions: tripPhotos.map((p) => p.caption ?? ''),
            weather: row.weather ?? undefined,
            favoriteTrail: row.favorite_trail ?? undefined,
            wildlifeSightings: tripAnimalRows.map((a) => a.name),
            trailsHiked: tripTrailRows.map((t) => ({
              trailId: t.trail_id ?? undefined,
              name: t.name,
              miles: t.miles,
              elevationGainFt: t.elevation_gain_ft,
              dayNumber: t.day_number ?? undefined,
            })),
            rating: row.rating ?? undefined,
            milesHiked: row.miles_hiked ?? undefined,
            elevationGainFt: row.elevation_gain_ft ?? undefined,
            days: days.length > 0 ? days : undefined,
          };
      });
      setTrips(
        [...stillPending, ...overlayTrips(fetchedTrips, outboxRef.current)].sort((a, b) =>
          b.startDate.localeCompare(a.startDate)
        )
      );
    })
      .catch((error) => {
        console.error('Failed to load trips/trail completions/animal sightings:', error);
        // Keep what's already on screen (cached data, if any) and make sure a
        // locally-queued trip survives — that's exactly the offline case.
        loadPendingTrips(userId).then((queued) => {
          setPendingTrips(queued);
          setTrips((prev) => mergePendingTrips(prev, queued));
        });
      })
      .finally(() => {
        setTripsLoaded(true);
        finishRefreshStep();
      });
  }, [userId, reloadKey]);

  // Restores the last-known copy of the user's data from the device, so the
  // app opens instantly (and works offline) instead of waiting on — or being
  // blank without — the network. A section is only restored if the network
  // hasn't already delivered fresher data for it; a later successful load
  // simply replaces it.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([loadSnapshot(userId), loadPendingTrips(userId), loadOutbox(userId)]).then(([snapshot, queued, ops]) => {
      if (cancelled || !snapshot) return;
      const synced = syncedRef.current;
      // The snapshot is written on a short debounce, so a change made just
      // before the app was closed may only be in the outbox — apply it over
      // the restored copy.
      if (snapshot.profile && synced.profile === 'none') {
        synced.profile = 'cache';
        setUserProfile(overlayProfile(snapshot.profile, ops));
        setProfileLoaded(true);
      }
      if (snapshot.parkStatus && synced.parks === 'none') {
        synced.parks = 'cache';
        setParks(parksFromStatus(overlayParkStatus(snapshot.parkStatus, ops)));
        setParksLoaded(true);
      }
      if (snapshot.earnedDates && synced.badges === 'none') {
        synced.badges = 'cache';
        setEarnedDates(snapshot.earnedDates);
        earnedIdsRef.current = new Set(Object.keys(snapshot.earnedDates));
        setBadgesLoaded(true);
      }
      if (snapshot.trips && synced.trips === 'none') {
        synced.trips = 'cache';
        setTrailCompletions(overlayTrailCompletions(snapshot.trailCompletions ?? [], ops));
        setAnimalSightings(snapshot.animalSightings ?? []);
        setPendingTrips(queued);
        setTrips(mergePendingTrips(overlayTrips(snapshot.trips, ops), queued));
        setTripsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Keeps the snapshot current as the user's data changes (including local
  // edits made while online), debounced so a burst of changes is one write.
  // A section is only written once it has real data — either loaded from the
  // network or restored from the cache — so an offline launch that only has
  // defaults can never overwrite a good snapshot with empty state.
  useEffect(() => {
    if (!userId) return;
    const timer = setTimeout(() => {
      const synced = syncedRef.current;
      const patch: SnapshotPatch = {};
      if (synced.profile !== 'none') patch.profile = userProfile;
      if (synced.parks !== 'none') {
        patch.parkStatus = parkStates.map((p) => ({ parkId: p.id, status: p.status, isFavorite: p.isFavorite }));
      }
      if (synced.badges !== 'none') patch.earnedDates = earnedDates;
      if (synced.trips !== 'none') {
        const pendingIds = new Set(pendingTrips.map((t) => t.id));
        patch.trips = trips.filter((t) => !pendingIds.has(t.id));
        patch.trailCompletions = trailCompletions;
        patch.animalSightings = animalSightings;
      }
      if (Object.keys(patch).length) saveSnapshot(userId, patch);
    }, 800);
    return () => clearTimeout(timer);
  }, [userId, userProfile, parkStates, earnedDates, trips, pendingTrips, trailCompletions, animalSightings]);

  const isTrailCompleted = useCallback(
    (trailId: string) => trailCompletions.some((row) => row.trail_id === trailId),
    [trailCompletions]
  );

  const isAnimalSpotted = useCallback(
    (animalId: string) => animalSightings.some((row) => row.animal_id === animalId),
    [animalSightings]
  );

  const badges: Badge[] = useMemo(() => {
    // Only actually-taken trips count toward badge progress — a planned trip
    // hasn't happened yet, so it must not be able to trigger e.g. 'camper' or
    // 'perfect-trip' before the user has actually gone.
    const loggedTrips = trips.filter((t) => t.tripType === 'logged');
    const completedTrailIds = trailCompletions.map((row) => row.trail_id).filter((id): id is string => !!id);
    const spottedAnimalIds = animalSightings.map((row) => row.animal_id).filter((id): id is string => !!id);
    return ALL_BADGES.map((badge) => {
      const goal = badge.id === 'parks-all' ? parks.length : badge.goal ?? 1;
      const rawProgress = BADGE_PROGRESS[badge.id]?.({ parks, trips: loggedTrips, completedTrailIds, spottedAnimalIds }) ?? 0;
      const progress = Math.min(rawProgress, goal);
      const earned = progress >= goal;
      return { ...badge, progress, goal, earned, earnedDate: earned ? earnedDates[badge.id] : undefined };
    });
  }, [parks, trips, trailCompletions, animalSightings, earnedDates]);

  // The first time a badge's live-computed progress clears its goal, freeze
  // an earned_date server-side so "earned N days ago" stays stable rather
  // than recalculating to "today" on every load.
  useEffect(() => {
    if (!session) return;
    const newlyEarned = badges.filter((b) => b.earned && !earnedIdsRef.current.has(b.id));
    if (newlyEarned.length === 0) return;
    const earnedAt = new Date().toISOString();
    // Only pop the celebration once the initial server hydration (badgesLoaded)
    // has actually completed — otherwise the async race between trips/parks
    // loading and user_badges loading would make every already-earned badge
    // look "newly earned" on a plain app open.
    if (badgesLoaded) celebrateBadges(newlyEarned);
    newlyEarned.forEach((b) => earnedIdsRef.current.add(b.id));
    queueOp({
      type: 'badge.earn',
      badges: newlyEarned.map((b) => ({ badgeId: b.id, earnedAt, progress: b.progress ?? 0 })),
    });
    flushInBackground();
    setEarnedDates((prev) => {
      const next = { ...prev };
      newlyEarned.forEach((b) => {
        next[b.id] = earnedAt;
      });
      return next;
    });
  }, [badges, session, badgesLoaded, queueOp, flushInBackground]);

  // Lets a user hand-check a trail that was part of a custom/combined route
  // they logged rather than picked from the catalog. Recorded as a
  // trip_id-less completion row with zero miles/elevation so it flips the
  // "completed" indicator without touching mileage stats.
  const markTrailCompleted = useCallback((trailId: string, parkId: string, name: string) => {
    if (!requireAccount({ type: 'trail', trailId, parkId, name })) return;
    if (trailCompletions.some((row) => row.trail_id === trailId)) return;
    const row: TrailCompletionRow = { trail_id: trailId, trip_id: null, park_id: parkId, name, miles: 0, elevation_gain_ft: 0 };
    setTrailCompletions((prev) => [...prev, row]);
    queueOp({ type: 'trail.complete', row });
    flushInBackground();
  }, [trailCompletions, queueOp, flushInBackground, requireAccount]);

  // Only clears the manual (trip_id-less) completion — a completion earned
  // by an actual logged trip is left alone, since that's real history.
  const unmarkTrailCompleted = useCallback((trailId: string) => {
    if (!requireAccount()) return;
    setTrailCompletions((prev) => prev.filter((row) => !(row.trail_id === trailId && row.trip_id === null)));
    queueOp({ type: 'trail.uncomplete', trailId });
    flushInBackground();
  }, [queueOp, flushInBackground, requireAccount]);

  // A user flagging a trail/animal as wrong. It's queued like any other change,
  // so a report made with no signal isn't lost — it goes out on reconnect.
  const submitContentReport = useCallback(
    async (report: ContentReportInput): Promise<boolean> => {
      if (!requireAccount()) return false;
      queueOp({ type: 'report.submit', report });
      await Promise.race([flushOutboxRef.current(), sleep(FLUSH_WAIT_MS)]);
      return true;
    },
    [queueOp, requireAccount]
  );

  // Same reasoning as the badges useMemo above — stats represent things that
  // actually happened, so a merely-planned trip must not count toward them.
  const loggedTrips = trips.filter((t) => t.tripType === 'logged');

  const stats: UserStats = {
    totalParks: parks.length,
    totalVisited: parks.filter((p) => p.status === 'visited').length,
    totalRemaining: parks.length - parks.filter((p) => p.status === 'visited').length,
    bucketListCount: parks.filter((p) => p.isFavorite).length,
    completionPercentage: Math.round(
      (parks.filter((p) => p.status === 'visited').length / parks.length) * 100
    ),
    totalTrips: loggedTrips.length,
    totalPhotos: loggedTrips.reduce((acc, t) => acc + t.photos.length, 0),
    totalMilesHiked: loggedTrips.reduce((acc, t) => acc + (t.milesHiked ?? 0), 0),
    totalElevationGain: loggedTrips.reduce((acc, t) => acc + (t.elevationGainFt ?? 0), 0),
    statesVisited: new Set(
      parks.filter((p) => p.status === 'visited').map((p) => p.state)
    ).size,
    favoriteActivity: getMostCommonActivity(loggedTrips),
  };

  const persistParkStatus = useCallback(
    (parkId: string, status: ParkStatus, isFavorite: boolean) => {
      queueOp({ type: 'park.status', parkId, status, isFavorite });
      flushInBackground();
    },
    [queueOp, flushInBackground]
  );

  const updateParkStatus = useCallback((parkId: string, status: ParkStatus) => {
    if (!requireAccount({ type: 'status', parkId, status })) return;
    const park = parks.find((p) => p.id === parkId);
    if (park && status === 'visited' && park.status !== 'visited') celebrateVisit(park);
    setParks((prev) =>
      prev.map((p) => (p.id === parkId ? { ...p, status } : p))
    );
    const isFavorite = park?.isFavorite ?? false;
    persistParkStatus(parkId, status, isFavorite);
  }, [parks, persistParkStatus, requireAccount]);

  const toggleFavorite = useCallback((parkId: string) => {
    if (!requireAccount({ type: 'favorite', parkId })) return;
    const current = parks.find((p) => p.id === parkId);
    const nextFavorite = !(current?.isFavorite ?? false);
    setParks((prev) =>
      prev.map((p) => (p.id === parkId ? { ...p, isFavorite: nextFavorite } : p))
    );
    persistParkStatus(parkId, current?.status ?? 'notVisited', nextFavorite);
  }, [parks, persistParkStatus, requireAccount]);

  // Writes a trip (and its day-by-day rows/photos) to Supabase, upserting
  // the trip row by its already-known client-generated id rather than
  // inserting, so retrying a trip that partially synced on a previous
  // attempt is safe to redo instead of hitting a duplicate-key error. Day
  // rows are deleted-then-reinserted, the same idempotent pattern
  // `updateTrip` already uses below, for the same reason. Throws on any
  // stage failure instead of swallowing it — a background sync retry needs
  // "did this fully succeed or not" as a single answer, unlike the
  // immediate/online path where a user is present to see a per-stage toast.
  //
  // `isEdit` is for re-sending an already-synced trip after the user changed
  // it: photos are always reconciled (they may have removed them all) and the
  // day rows are replaced whenever the trip has a `days` breakdown.
  const persistTripToSupabase = useCallback(async (trip: Trip, activeSession: Session, opts: { isEdit?: boolean } = {}): Promise<Trip> => {
    const { error: upsertError } = await supabase.from('trips').upsert({
      id: trip.id,
      park_id: trip.parkId,
      trip_type: trip.tripType,
      start_date: trip.startDate,
      end_date: trip.endDate,
      activities: trip.activities,
      notes: trip.notes,
      favorite_trail: trip.favoriteTrail ?? null,
      wildlife_sightings: trip.wildlifeSightings ?? null,
      rating: trip.rating ?? null,
      miles_hiked: trip.milesHiked ?? null,
      elevation_gain_ft: trip.elevationGainFt ?? null,
    });
    if (upsertError) throw upsertError;

    let photos = trip.photos;
    let photoCaptions = trip.photoCaptions;
    if (photos.length || opts.isEdit) {
      const synced = await syncTripPhotos(trip.id, activeSession.user.id, photos, photoCaptions);
      photos = synced.photos;
      photoCaptions = synced.photoCaptions;
    }

    const days = trip.days;
    if (days && (opts.isEdit || days.length)) {
      await Promise.all([
        supabase.from('user_trail_completions').delete().eq('trip_id', trip.id),
        supabase.from('user_animal_sightings').delete().eq('trip_id', trip.id),
        supabase.from('trip_day_activities').delete().eq('trip_id', trip.id),
        supabase.from('trip_day_weather').delete().eq('trip_id', trip.id),
      ]);
      const trailRows = buildTrailRows(days, trip.id, trip.parkId);
      const animalRows = buildAnimalRows(days, trip.id, trip.parkId, animals);
      const activityRows = buildDayActivityRows(days, trip.id);
      const weatherRows = buildDayWeatherRows(days, trip.id);
      if (trailRows.length) {
        const { error } = await supabase.from('user_trail_completions').insert(trailRows);
        if (error) throw error;
      }
      setTrailCompletions((prev) => [...prev.filter((t) => t.trip_id !== trip.id), ...trailRows]);
      if (animalRows.length) {
        const { error } = await supabase.from('user_animal_sightings').insert(animalRows);
        if (error) throw error;
      }
      setAnimalSightings((prev) => [...prev.filter((a) => a.trip_id !== trip.id), ...animalRows]);
      if (activityRows.length) {
        const { error } = await supabase.from('trip_day_activities').insert(activityRows);
        if (error) throw error;
      }
      if (weatherRows.length) {
        const { error } = await supabase.from('trip_day_weather').insert(weatherRows);
        if (error) throw error;
      }
    }

    return { ...trip, photos, photoCaptions };
  }, [animals]);

  // Removes a trip server-side, including its photo files (Storage objects
  // don't cascade with the row). Safe to repeat if a previous attempt stopped
  // partway.
  const deleteTripRemote = useCallback(async (tripId: string) => {
    const { data, error } = await supabase.from('trip_photos').select('storage_path').eq('trip_id', tripId);
    if (error) throw error;
    if (data?.length) {
      const { error: removeError } = await supabase.storage
        .from(TRIP_PHOTOS_BUCKET)
        .remove(data.map((row) => row.storage_path));
      if (removeError) throw removeError;
    }
    const { error: deleteError } = await supabase.from('trips').delete().eq('id', tripId);
    if (deleteError) throw deleteError;
  }, []);

  // Sends one queued change. Every case is safe to replay (upsert, delete by
  // key, or insert-if-missing), and throws on failure so the flush loop can
  // tell "still offline" from "the server said no".
  const executeOp = useCallback(
    async (op: OutboxOp, activeSession: Session): Promise<void> => {
      switch (op.type) {
        case 'trip.edit': {
          const synced = await persistTripToSupabase(op.trip, activeSession, { isEdit: true });
          // If the user edited it again while this was sending, the newer
          // version is already on screen — don't replace it with this one.
          const newerEditQueued = outboxRef.current.some(
            (o) => o.type === 'trip.edit' && o.trip.id === op.trip.id && o.id !== op.id
          );
          if (!newerEditQueued) setTrips((prev) => prev.map((t) => (t.id === synced.id ? synced : t)));
          return;
        }
        case 'trip.delete':
          await deleteTripRemote(op.tripId);
          return;
        case 'trail.complete': {
          if (!op.row.trail_id) return;
          const { data, error } = await supabase
            .from('user_trail_completions')
            .select('trail_id')
            .eq('trail_id', op.row.trail_id)
            .is('trip_id', null)
            .limit(1);
          if (error) throw error;
          if (data?.length) return; // already recorded — a replay must not duplicate it
          const { error: insertError } = await supabase.from('user_trail_completions').insert(op.row);
          if (insertError) throw insertError;
          return;
        }
        case 'trail.uncomplete': {
          const { error } = await supabase
            .from('user_trail_completions')
            .delete()
            .eq('trail_id', op.trailId)
            .is('trip_id', null);
          if (error) throw error;
          return;
        }
        case 'park.status': {
          const { error } = await supabase
            .from('user_park_status')
            .upsert({ park_id: op.parkId, status: op.status, is_favorite: op.isFavorite }, { onConflict: 'user_id,park_id' });
          if (error) throw error;
          return;
        }
        case 'profile.patch': {
          const columns = profilePatchToColumns(op.patch);
          if (Object.keys(columns).length === 0) return;
          const { error } = await supabase.from('profiles').update(columns).eq('id', activeSession.user.id);
          if (error) throw error;
          return;
        }
        case 'badge.earn': {
          const { error } = await supabase.from('user_badges').upsert(
            op.badges.map((b) => ({ badge_id: b.badgeId, earned: true, earned_date: b.earnedAt, progress: b.progress })),
            { onConflict: 'user_id,badge_id' }
          );
          if (error) throw error;
          return;
        }
        case 'report.submit': {
          const { report } = op;
          const { error } = await supabase.from('content_reports').insert({
            entry_type: report.entryType,
            entry_id: report.entryId,
            entry_name: report.entryName,
            park_id: report.parkId,
            reason: report.reason,
            note: report.note?.trim() ? report.note.trim() : null,
            platform: Platform.OS,
          });
          // 23505 = the same report is already open — that's a success.
          if (error && error.code !== '23505') throw error;
          return;
        }
      }
    },
    [persistTripToSupabase, deleteTripRemote]
  );

  // Sends queued changes in the order they were made. A dropped connection
  // stops the run and leaves everything queued (not the ops' fault, so it
  // doesn't count against them); a server rejection is counted and the op is
  // given up on after MAX_ATTEMPTS so one bad change can't block the rest
  // forever. A second call while one is running just requests another pass.
  const flushOutbox = useCallback((): Promise<void> => {
    if (flushingRef.current) {
      needsAnotherPassRef.current = true;
      return flushingRef.current;
    }
    const run = async () => {
      do {
        needsAnotherPassRef.current = false;
        const attempted = new Set<string>();
        for (;;) {
          const activeSession = sessionRef.current;
          if (!activeSession) return;
          const op = outboxRef.current.find((o) => !attempted.has(o.id));
          if (!op) break;
          attempted.add(op.id);
          try {
            await executeOp(op, activeSession);
            commitOutbox(outboxRef.current.filter((o) => o.id !== op.id));
          } catch (error) {
            if (isNetworkError(error)) {
              queuedOfflineRef.current = true;
              commitOutbox(
                outboxRef.current.map((o) => (o.id === op.id ? { ...o, lastError: 'No connection — will retry' } : o))
              );
              return;
            }
            console.error(`Change "${op.type}" was rejected:`, error);
            if (op.attempts + 1 >= MAX_ATTEMPTS) {
              commitOutbox(outboxRef.current.filter((o) => o.id !== op.id));
              reportError('sync one of your changes', error);
            } else {
              commitOutbox(
                outboxRef.current.map((o) =>
                  o.id === op.id ? { ...o, attempts: o.attempts + 1, lastError: errorText(error) } : o
                )
              );
            }
          }
        }
      } while (needsAnotherPassRef.current);
      announceIfSynced();
    };
    flushingRef.current = run().finally(() => {
      flushingRef.current = null;
    });
    return flushingRef.current;
  }, [executeOp, commitOutbox, announceIfSynced]);
  flushOutboxRef.current = flushOutbox;

  // Attempts every queued new trip in the order it was created. A dropped
  // connection stops the run (trying the rest would just repeat the failure);
  // a trip the server keeps rejecting is skipped after MAX_ATTEMPTS so it
  // can't block the ones behind it, but stays in the queue — it's the user's
  // data — until they retry it from the "waiting to sync" list.
  const syncPendingTrips = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession || syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    try {
      for (const pending of [...pendingTripsRef.current]) {
        const failure = pendingFailuresRef.current.get(pending.id);
        if (failure && failure.attempts >= MAX_ATTEMPTS) continue;
        try {
          const synced = await persistTripToSupabase(pending, activeSession);
          const current = pendingTripsRef.current.find((t) => t.id === pending.id);
          if (!current) {
            // Deleted while it was uploading — the row now exists server-side,
            // so queue its removal instead of leaving it behind.
            queueOp({ type: 'trip.delete', tripId: pending.id });
            flushInBackground();
            continue;
          }
          // Edited while it was uploading: keep the newer copy queued so the
          // next pass sends it, rather than dropping the edit.
          if (current !== pending) continue;
          setTrips((prev) => prev.map((t) => (t.id === synced.id ? synced : t)));
          commitPendingTrips((prev) => prev.filter((t) => t.id !== pending.id));
          recordTripIssue(pending.id, null);
        } catch (error) {
          console.error('Trip sync failed, will retry later:', error);
          if (isNetworkError(error)) {
            queuedOfflineRef.current = true;
            recordTripIssue(pending.id, { attempts: failure?.attempts ?? 0, message: 'No connection — will retry' });
            break;
          }
          recordTripIssue(pending.id, { attempts: (failure?.attempts ?? 0) + 1, message: errorText(error) });
        }
      }
    } finally {
      syncInFlightRef.current = false;
    }
    announceIfSynced();
  }, [persistTripToSupabase, queueOp, flushInBackground, commitPendingTrips, announceIfSynced, recordTripIssue]);

  // While anything is waiting, keep trying: NetInfo and app-focus events are
  // the fast paths, but on a weak or flaky signal neither may fire, and a
  // queue that only retries on an event can sit there indefinitely.
  const hasPendingChanges = pendingTrips.length + outboxOps.length > 0;
  useEffect(() => {
    if (!userId || !hasPendingChanges) return;
    const timer = setInterval(() => {
      syncPendingTrips();
      flushInBackground();
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [userId, hasPendingChanges, syncPendingTrips, flushInBackground]);

  // Manual retry from the "waiting to sync" list: forgets earlier failures
  // (including the give-up on a trip the server kept rejecting) and tries now.
  const retrySync = useCallback(async () => {
    pendingFailuresRef.current.clear();
    setSyncIssues({});
    commitOutbox(outboxRef.current.map((o) => ({ ...o, attempts: 0, lastError: undefined })));
    await Promise.all([syncPendingTrips(), flushOutboxRef.current()]);
  }, [commitOutbox, syncPendingTrips]);

  // Pull-to-refresh: send anything queued, then re-fetch the user's data in
  // place. Bounded so a dead connection can't leave the spinner running.
  const refreshData = useCallback(async () => {
    refreshAppConfig();
    refreshContentIfFallenBack();
    if (!sessionRef.current || refreshWaitRef.current) return;
    await Promise.race([Promise.all([syncPendingTrips(), flushOutboxRef.current()]), sleep(FLUSH_WAIT_MS)]);
    const reloaded = new Promise<void>((resolve) => {
      refreshWaitRef.current = { remaining: 4, resolve };
    });
    silentReloadRef.current = true;
    setReloadKey((k) => k + 1);
    await Promise.race([reloaded, sleep(15000)]);
    refreshWaitRef.current = null;
    silentReloadRef.current = false;
  }, [refreshAppConfig, refreshContentIfFallenBack, syncPendingTrips]);

  const pendingChanges: PendingChange[] = useMemo(() => {
    const lookup: DescribeLookup = {
      parkName: (id) => parks.find((p) => p.id === id)?.name ?? id,
      trailName: (id) => trails.find((t) => t.id === id)?.name ?? id,
      badgeName: (id) => ALL_BADGES.find((b) => b.id === id)?.name ?? id,
    };
    const newTrips = pendingTrips.map((t) => ({
      id: `trip:${t.id}`,
      title: 'New trip',
      detail: `${lookup.parkName(t.parkId)} · ${t.startDate}${t.photos.length ? ` · ${t.photos.length} photo${t.photos.length === 1 ? '' : 's'}` : ''}`,
      error: syncIssues[t.id],
    }));
    const ops = outboxOps.map((op) => ({ id: op.id, ...describeOp(op, lookup), error: op.lastError }));
    return [...newTrips, ...ops];
  }, [pendingTrips, outboxOps, syncIssues, parks, trails]);

  const logTrip = useCallback(async (trip: Omit<Trip, 'id'>) => {
    const aggregate = trip.days?.length ? aggregateFromDays(trip.days) : null;
    const activities = aggregate?.activities ?? trip.activities;
    const wildlifeSightings = aggregate?.wildlifeSightings ?? trip.wildlifeSightings;
    const trailsHiked = aggregate?.trailsHiked ?? trip.trailsHiked;
    const milesHiked = aggregate?.milesHiked ?? trip.trailsHiked?.reduce((acc, t) => acc + t.miles, 0) ?? trip.milesHiked;
    const elevationGainFt = aggregate?.elevationGainFt ?? trip.trailsHiked?.reduce((acc, t) => acc + t.elevationGainFt, 0) ?? trip.elevationGainFt;

    const tripId = Crypto.randomUUID();
    const newTrip: Trip = { ...trip, activities, wildlifeSightings, trailsHiked, milesHiked, elevationGainFt, id: tripId };

    // Show it right away, before any network attempt — the point of this
    // queue is that "did this save" shouldn't wait on connectivity.
    setTrips((prev) => [newTrip, ...prev]);

    // Logging a trip always means "I went" — 'visited', as before. Planning
    // one sets 'planned' unless the park is already 'visited' (don't
    // downgrade a park you've actually been to just because you're planning
    // a return trip). This happens regardless of sync outcome below — the
    // park status reflects what the user did, not whether it's synced yet.
    const currentStatus = parks.find((p) => p.id === trip.parkId)?.status ?? 'notVisited';
    const isFavorite = parks.find((p) => p.id === trip.parkId)?.isFavorite ?? false;
    const nextStatus: ParkStatus =
      trip.tripType === 'logged' ? 'visited' : currentStatus === 'visited' ? 'visited' : 'planned';
    if (nextStatus !== currentStatus) {
      setParks((prev) => prev.map((p) => (p.id === trip.parkId ? { ...p, status: nextStatus } : p)));
      persistParkStatus(trip.parkId, nextStatus, isFavorite);
    }

    if (!session) return; // logged-out/local-only usage — nothing to sync

    const queueForLater = () => {
      queuedOfflineRef.current = true;
      commitPendingTrips((prev) => [...prev, newTrip]);
    };

    // Known-offline: don't make the user wait on a request that can't work.
    if (await isKnownOffline()) {
      queueForLater();
      return;
    }

    try {
      const synced = await persistTripToSupabase(newTrip, session);
      setTrips((prev) => prev.map((t) => (t.id === tripId ? synced : t)));
    } catch (error) {
      // Not a failure the user needs a toast for — this is the expected,
      // handled path now. The pending indicator on the trip card communicates
      // status instead, and syncPendingTrips retries automatically.
      console.error('Failed to sync new trip, queuing for later:', error);
      queueForLater();
    }
  }, [parks, persistParkStatus, session, persistTripToSupabase, commitPendingTrips]);

  // Reconnecting (or coming back to the app) is what triggers a retry — NetInfo
  // decides *when* to attempt a sync, never whether a save queues or goes
  // live (that's decided by whether the real Supabase call actually succeeds,
  // since NetInfo's "connected" can be a false positive, e.g. a wifi captive
  // portal with no real internet).
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      isOfflineRef.current = offline;
      setIsOffline(offline);
      if (state.isConnected) {
        syncPendingTrips();
        flushInBackground();
        refreshContentIfFallenBack();
        refreshAppConfig();
      }
    });
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        syncPendingTrips();
        flushInBackground();
      }
    });
    return () => {
      unsubscribe();
      appStateSub.remove();
    };
  }, [syncPendingTrips, flushInBackground, refreshContentIfFallenBack, refreshAppConfig]);

  // Applies a saved edit to a trip locally and gets it to the server: a
  // not-yet-synced new trip just has its queued copy rewritten; an already-
  // synced trip has its new version queued as an edit. Either way the UI
  // shows the change immediately, and a slow or missing connection never
  // fails the save — it just leaves the trip marked as waiting to sync.
  const saveTripChanges = useCallback(
    async (updatedTrip: Trip): Promise<void> => {
      setTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
      if (!sessionRef.current) return; // logged-out/local-only usage — nothing to sync

      if (pendingTripsRef.current.some((t) => t.id === updatedTrip.id)) {
        commitPendingTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
        await Promise.race([syncPendingTrips(), sleep(FLUSH_WAIT_MS)]);
        return;
      }

      // Reflect the new trails/wildlife in checkmarks and badges straight away.
      if (updatedTrip.days) {
        const days = updatedTrip.days;
        const trailRows = buildTrailRows(days, updatedTrip.id, updatedTrip.parkId);
        const animalRows = buildAnimalRows(days, updatedTrip.id, updatedTrip.parkId, animals);
        setTrailCompletions((prev) => [...prev.filter((t) => t.trip_id !== updatedTrip.id), ...trailRows]);
        setAnimalSightings((prev) => [...prev.filter((a) => a.trip_id !== updatedTrip.id), ...animalRows]);
      }
      queueOp({ type: 'trip.edit', trip: updatedTrip });
      await Promise.race([flushOutboxRef.current(), sleep(FLUSH_WAIT_MS)]);
    },
    [commitPendingTrips, syncPendingTrips, queueOp, animals]
  );

  const updateTrip = useCallback(async (trip: Trip) => {
    const previousTrip = trips.find((t) => t.id === trip.id);
    const aggregate = trip.days?.length ? aggregateFromDays(trip.days) : null;
    const activities = aggregate?.activities ?? trip.activities;
    const wildlifeSightings = aggregate?.wildlifeSightings ?? trip.wildlifeSightings;
    const trailsHiked = aggregate?.trailsHiked ?? trip.trailsHiked;
    const milesHiked = aggregate?.milesHiked ?? trip.milesHiked;
    const elevationGainFt = aggregate?.elevationGainFt ?? trip.elevationGainFt;
    const updatedTrip: Trip = { ...trip, activities, wildlifeSightings, trailsHiked, milesHiked, elevationGainFt };
    await saveTripChanges(updatedTrip);

    // Editing a still-planned trip onto a different park moves the
    // 'planned' status with it — the old park is no longer backed by
    // anything, and the new one should pick it up (unless already visited).
    if (previousTrip && trip.tripType === 'planned' && previousTrip.parkId !== trip.parkId) {
      const oldPark = parks.find((p) => p.id === previousTrip.parkId);
      const oldParkStillPlanned = trips.some(
        (t) => t.id !== trip.id && t.parkId === previousTrip.parkId && t.tripType === 'planned'
      );
      if (oldPark && oldPark.status === 'planned' && !oldParkStillPlanned) {
        updateParkStatus(previousTrip.parkId, 'notVisited');
      }
      const newPark = parks.find((p) => p.id === trip.parkId);
      if (newPark && newPark.status === 'notVisited') {
        updateParkStatus(trip.parkId, 'planned');
      }
    }
    return true;
  }, [trips, parks, updateParkStatus, saveTripChanges]);

  // Converts a planned trip to logged in place (same row id, not a new
  // insert) — fills in the "what actually happened" fields (photos, trails,
  // wildlife, rating, weather) and always sets the park to 'visited', unlike
  // the conditional plan-time status in logTrip. Editing the whole day
  // breakdown at once covers both a fresh completion and re-completing after
  // further edits.
  const completeTrip = useCallback(async (trip: Trip) => {
    const aggregate = trip.days?.length ? aggregateFromDays(trip.days) : null;
    const activities = aggregate?.activities ?? trip.activities;
    const wildlifeSightings = aggregate?.wildlifeSightings ?? trip.wildlifeSightings;
    const trailsHiked = aggregate?.trailsHiked ?? trip.trailsHiked;
    const milesHiked = aggregate?.milesHiked ?? trip.trailsHiked?.reduce((acc, t) => acc + t.miles, 0) ?? trip.milesHiked;
    const elevationGainFt = aggregate?.elevationGainFt ?? trip.trailsHiked?.reduce((acc, t) => acc + t.elevationGainFt, 0) ?? trip.elevationGainFt;
    const completedTrip: Trip = { ...trip, tripType: 'logged', activities, wildlifeSightings, trailsHiked, milesHiked, elevationGainFt };

    setParks((prev) => prev.map((p) => (p.id === trip.parkId ? { ...p, status: 'visited' } : p)));
    const isFavorite = parks.find((p) => p.id === trip.parkId)?.isFavorite ?? false;
    persistParkStatus(trip.parkId, 'visited', isFavorite);

    await saveTripChanges(completedTrip);
    return true;
  }, [parks, persistParkStatus, saveTripChanges]);

  const deleteTrip = useCallback((tripId: string) => {
    const deletedTrip = trips.find((t) => t.id === tripId);
    // Only a trip that has never reached the server is "pending" here — one
    // with just a queued edit does exist server-side and must be deleted there.
    const wasPending = pendingTripsRef.current.some((t) => t.id === tripId);
    setTrips((prev) => prev.filter((t) => t.id !== tripId));
    if (wasPending) {
      // No row exists server-side yet for a still-queued trip — nothing to
      // delete remotely, just drop it from the queue so it never gets synced.
      commitPendingTrips((prev) => prev.filter((t) => t.id !== tripId));
    } else {
      queueOp({
        type: 'trip.delete',
        tripId,
        label: deletedTrip
          ? `${parks.find((p) => p.id === deletedTrip.parkId)?.name ?? 'Trip'} · ${deletedTrip.startDate}`
          : undefined,
      });
      flushInBackground();
      // Cascades server-side too; mirror locally so counts/checkmarks update immediately.
      setTrailCompletions((prev) => prev.filter((r) => r.trip_id !== tripId));
      setAnimalSightings((prev) => prev.filter((r) => r.trip_id !== tripId));
    }

    // A park's 'planned' status exists only because a planned trip put it
    // there — if that was the last planned trip for this park, the park
    // shouldn't be stuck showing "Planned" with nothing behind it anymore.
    if (deletedTrip && deletedTrip.tripType === 'planned') {
      const park = parks.find((p) => p.id === deletedTrip.parkId);
      const stillHasPlannedTrip = trips.some(
        (t) => t.id !== tripId && t.parkId === deletedTrip.parkId && t.tripType === 'planned'
      );
      if (park && park.status === 'planned' && !stillHasPlannedTrip) {
        updateParkStatus(deletedTrip.parkId, 'notVisited');
      }
    }
  }, [trips, parks, updateParkStatus, commitPendingTrips, queueOp, flushInBackground]);

  // Patches profile fields without touching onboarding_complete — used by
  // Settings screens editing an already-onboarded profile. completeOnboarding
  // below is the one place that's allowed to flip onboarding_complete to true.
  const updateProfile = useCallback((profile: Partial<UserProfile>) => {
    setUserProfile((prev) => ({ ...prev, ...profile }));
    queueOp({
      type: 'profile.patch',
      patch: {
        ...(profile.name !== undefined && { name: profile.name }),
        ...(profile.explorerStyle !== undefined && { explorerStyle: profile.explorerStyle }),
        ...(profile.goal !== undefined && { goal: profile.goal }),
      },
    });
    flushInBackground();
  }, [queueOp, flushInBackground]);

  const completeOnboarding = useCallback((profile: Partial<UserProfile>) => {
    setUserProfile((prev) => ({ ...prev, ...profile, onboardingComplete: true }));
    queueOp({
      type: 'profile.patch',
      patch: {
        ...(profile.name !== undefined && { name: profile.name }),
        ...(profile.explorerStyle !== undefined && { explorerStyle: profile.explorerStyle }),
        ...(profile.goal !== undefined && { goal: profile.goal }),
        onboardingComplete: true,
      },
    });
    flushInBackground();
  }, [queueOp, flushInBackground]);

  // Applies onboarding details stashed locally by AuthScreen when sign-up
  // couldn't call completeOnboarding immediately (email confirmation was
  // required, so there was no session yet to save them against). Runs once
  // a session and profile are both loaded for an account that hasn't
  // actually finished onboarding — covers both the normal "confirm, then
  // log in" path and logging in again on the same device later.
  useEffect(() => {
    if (!session || !profileLoaded || userProfile.onboardingComplete) return;
    AsyncStorage.getItem(PENDING_ONBOARDING_KEY).then((raw) => {
      if (!raw) return;
      AsyncStorage.removeItem(PENDING_ONBOARDING_KEY);
      try {
        completeOnboarding(JSON.parse(raw));
      } catch (error) {
        console.error('Failed to apply pending onboarding data:', error);
      }
    });
  }, [session, profileLoaded, userProfile.onboardingComplete, completeOnboarding]);

  const updateProfileBackground = useCallback((background: ProfileBackground) => {
    setUserProfile((prev) => ({ ...prev, profileBackground: background }));
    queueOp({ type: 'profile.patch', patch: { profileBackground: background } });
    flushInBackground();
  }, [queueOp, flushInBackground]);

  const updateProfileAvatar = useCallback((avatar: ProfileAvatar) => {
    setUserProfile((prev) => ({ ...prev, avatar }));
    queueOp({ type: 'profile.patch', patch: { avatar } });
    flushInBackground();
  }, [queueOp, flushInBackground]);

  const updateUnits = useCallback((units: Units) => {
    setUserProfile((prev) => ({ ...prev, units }));
    queueOp({ type: 'profile.patch', patch: { units } });
    flushInBackground();
  }, [queueOp, flushInBackground]);

  // Redoes what a guest tapped before signing up, once their own data has
  // loaded — so it applies to their account rather than the empty guest state.
  // Each case is a no-op if the account already has it.
  useEffect(() => {
    const action = pendingGuestActionRef.current;
    if (!session || dataLoading || !action) return;
    pendingGuestActionRef.current = null;
    const park = 'parkId' in action ? parks.find((p) => p.id === action.parkId) : undefined;
    switch (action.type) {
      case 'favorite':
        if (park && !park.isFavorite) toggleFavorite(action.parkId);
        return;
      case 'status':
        if (park && park.status !== action.status) updateParkStatus(action.parkId, action.status);
        return;
      case 'trail':
        markTrailCompleted(action.trailId, action.parkId, action.name);
        return;
      case 'tripForm':
        if (navigationRef.isReady()) {
          navigationRef.navigate('Main', {
            screen: 'LogTrip',
            params: { screen: 'LogTripForm', params: { parkId: action.parkId, initialTripType: action.tripType } },
          });
        }
        return;
      case 'tab':
        if (!navigationRef.isReady()) return;
        if (action.tab === 'LogTrip') {
          navigationRef.navigate('Main', { screen: 'LogTrip', params: { screen: 'TripChooser' } });
        } else {
          navigationRef.navigate('Main', { screen: action.tab });
        }
        return;
    }
  }, [session, dataLoading, parks, toggleFavorite, updateParkStatus, markTrailCompleted]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUserProfile(DEFAULT_PROFILE);
    if (userId) clearSnapshot(userId);
  }, [userId]);

  const deleteAccount = useCallback(async () => {
    if (!session) return;
    // trip_photos rows cascade with the account, but the underlying Storage
    // objects don't — remove those explicitly before the row disappears.
    const { data: photoRows, error: photoListError } = await supabase
      .from('trip_photos')
      .select('storage_path')
      .eq('user_id', session.user.id);
    if (photoListError) {
      reportError('delete your account', photoListError);
      return;
    }
    if (photoRows?.length) {
      const { error: removeError } = await supabase
        .storage.from(TRIP_PHOTOS_BUCKET)
        .remove(photoRows.map((row) => row.storage_path));
      if (removeError) {
        reportError('delete your account', removeError);
        return;
      }
    }
    const { error } = await supabase.rpc('delete_own_account');
    if (error) {
      reportError('delete your account', error);
      return;
    }
    await supabase.auth.signOut();
    setUserProfile(DEFAULT_PROFILE);
    // The account is gone, so nothing queued for it (or cached) can ever sync.
    clearSnapshot(session.user.id);
    clearOutbox(session.user.id);
    savePendingTrips(session.user.id, []);
  }, [session]);

  return (
    <AppContext.Provider
      value={{
        parks,
        parkAlerts,
        alertsSyncedAt,
        eventNotice,
        liveEventNotice,
        setEventNoticeHidden,
        trips,
        badges,
        userProfile,
        stats,
        session,
        isGuest,
        authLoading,
        dataLoading,
        trails,
        animals,
        trailDetails,
        animalDetails,
        contentLoaded,
        updateParkStatus,
        toggleFavorite,
        logTrip,
        updateTrip,
        completeTrip,
        deleteTrip,
        completeOnboarding,
        updateProfile,
        updateProfileBackground,
        updateProfileAvatar,
        updateUnits,
        continueAsGuest,
        requireAccount,
        signOut,
        deleteAccount,
        isTrailCompleted,
        isAnimalSpotted,
        markTrailCompleted,
        unmarkTrailCompleted,
        isTripPending,
        submitContentReport,
        pendingChangeCount: pendingTrips.length + outboxOps.length,
        pendingChanges,
        isOffline,
        retrySync,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

function getMostCommonActivity(trips: Trip[]): string {
  const counts: Record<string, number> = {};
  trips.forEach((t) =>
    t.activities.forEach((a) => {
      counts[a] = (counts[a] ?? 0) + 1;
    })
  );
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? 'Hiking';
}
